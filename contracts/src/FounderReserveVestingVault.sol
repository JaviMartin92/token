// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./lib/security/ReentrancyGuard.sol";
import "./interfaces/ITreasury.sol";
import "./interfaces/IProtocolErrors.sol";

/**
 * @title FounderReserveVestingVault
 * @author Viraje Protocol Architecture Team
 * @notice Bóveda fiduciaria de consolidación (vesting) para el fundador y colaboradores clave del protocolo.
 * @dev La liberación de tokens VIRAJE está estrictamente indexada a la solvencia de las reservas de tesorería:
 *      - Reclamaciones condicionadas a un Ratio de Solvencia > 100% (Activos > Pasivos).
 *      - Capped a un máximo del 10.00% del excedente de reservas (Assets - Liabilities) valorado al NAV contable.
 *      - Cero reclamaciones si el NAV por token se encuentra por debajo de la paridad ($1.00 USD).
 *      - Cooldown inmutable de 72 horas entre reclamaciones sucesivas.
 *      - Asignación total máxima incondicional de 100,000 VIRAJE.
 *      - Rescate seguro de tokens ERC-20 foráneos con bloqueo incondicional del token VIRAJE de la bóveda.
 */
contract FounderReserveVestingVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- Domain Custom Errors ---
    error NoReserveSurplus(uint256 totalAssetsUSD, uint256 totalLiabilitiesUSD);
    error CooldownActive(uint256 nextAvailableTimestamp);
    error ExceedsRemainingAllocation(uint256 attempted, uint256 remaining);
    error AllocationExhausted();
    error UnauthorizedBeneficiary();
    error TreasuryNotConfigured();
    error InsufficientVaultBalance(uint256 requested, uint256 available);

    // --- Constantes Institucionales ---
    uint256 public constant TOTAL_ALLOCATION = 100_000 * 1e18; // 100,000 VIRAJE
    uint256 public constant COOLDOWN_PERIOD = 72 hours; // 72 horas
    uint256 public constant MAX_SURPLUS_BPS = 1000; // 10.00% (1000 / 10000)
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant WAD = 1e18;

    // --- Immutables & State Variables ---
    IERC20 public immutable virajeToken;
    address public treasuryManager;
    address public beneficiary;

    uint256 public totalClaimed;
    uint256 public lastClaimTimestamp;

    // --- Events ---
    event VirajeClaimed(
        address indexed beneficiary,
        uint256 amountViraje,
        uint256 surplusUSD,
        uint256 timestamp
    );
    event BeneficiaryUpdated(address indexed oldBeneficiary, address indexed newBeneficiary);
    event TreasuryManagerUpdated(address indexed oldTreasury, address indexed newTreasury);
    event TokensSwept(address indexed token, address indexed to, uint256 amount);

    /**
     * @notice Constructor de la bóveda de consolidación de fundadores.
     * @param _virajeToken Dirección del token nativo VIRAJE en custodia.
     * @param _treasuryManager Dirección del contrato TreasuryManager para verificación de solvencia.
     * @param _beneficiary Dirección receptora institucional de los tokens consolidados.
     * @param _initialAdmin Dirección administradora génesis (TimelockController en mainnet).
     */
    constructor(
        address _virajeToken,
        address _treasuryManager,
        address _beneficiary,
        address _initialAdmin
    ) {
        if (
            _virajeToken == address(0) ||
            _treasuryManager == address(0) ||
            _beneficiary == address(0) ||
            _initialAdmin == address(0)
        ) {
            revert IProtocolErrors.ZeroAddress();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, _initialAdmin);
        _grantRole(ProtocolRoles.ADMIN_ROLE, _initialAdmin);

        virajeToken = IERC20(_virajeToken);
        treasuryManager = _treasuryManager;
        beneficiary = _beneficiary;
    }

    /**
     * @notice Actualiza la dirección del contrato TreasuryManager.
     * @dev Restringido a `ADMIN_ROLE` (TimelockController con 72h de retardo).
     * @param _treasuryManager Nueva dirección del TreasuryManager.
     */
    function setTreasuryManager(address _treasuryManager) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_treasuryManager == address(0)) revert IProtocolErrors.ZeroAddress();
        emit TreasuryManagerUpdated(treasuryManager, _treasuryManager);
        treasuryManager = _treasuryManager;
    }

    /**
     * @notice Actualiza la dirección beneficiaria del vesting.
     * @dev Restringido a `ADMIN_ROLE` (gobernanza Timelock).
     * @param _newBeneficiary Nueva dirección beneficiaria.
     */
    function setBeneficiary(address _newBeneficiary) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_newBeneficiary == address(0)) revert IProtocolErrors.ZeroAddress();
        emit BeneficiaryUpdated(beneficiary, _newBeneficiary);
        beneficiary = _newBeneficiary;
    }

    /**
     * @notice Devuelve la asignación restante no consolidada en la bóveda.
     * @return Cantidad de tokens VIRAJE pendientes de consolidar (escala 18 decimales).
     */
    function remainingAllocation() public view returns (uint256) {
        if (totalClaimed >= TOTAL_ALLOCATION) return 0;
        return TOTAL_ALLOCATION - totalClaimed;
    }

    /**
     * @notice Calcula la cantidad consolidable en tiempo real según el excedente de solvencia de la tesorería.
     * @return claimableViraje Cantidad de tokens VIRAJE que pueden reclamarse inmediatamente.
     * @return surplusUSD Excedente neto de reservas en USD (18 decimales).
     * @return nextAvailableTimestamp Marca de tiempo a partir de la cual expira el cooldown.
     * @return canClaim Booleano que indica si se satisfacen todas las condiciones (cooldown, solvencia, NAV >= $1).
     */
    function getClaimableInfo()
        public
        view
        returns (
            uint256 claimableViraje,
            uint256 surplusUSD,
            uint256 nextAvailableTimestamp,
            bool canClaim
        )
    {
        nextAvailableTimestamp = lastClaimTimestamp + COOLDOWN_PERIOD;
        bool cooldownPassed = (block.timestamp >= nextAvailableTimestamp) || (lastClaimTimestamp == 0);

        uint256 remaining = remainingAllocation();
        if (remaining == 0 || treasuryManager == address(0)) {
            return (0, 0, nextAvailableTimestamp, false);
        }

        try ITreasury(treasuryManager).getProofOfReserves() returns (
            uint256 totalAssetsUSD,
            uint256 totalLiabilitiesUSD,
            uint256 /* collateralRatioBps */
        ) {
            if (totalAssetsUSD > totalLiabilitiesUSD) {
                surplusUSD = totalAssetsUSD - totalLiabilitiesUSD;
                uint256 maxClaimableUSD = (surplusUSD * MAX_SURPLUS_BPS) / BPS_DENOMINATOR;

                uint256 navPerShare = WAD;
                try ITreasury(treasuryManager).getNAVPerShare() returns (uint256 nav) {
                    if (nav > 0) navPerShare = nav;
                } catch {}

                uint256 virajeFromSurplus = (maxClaimableUSD * WAD) / navPerShare;
                claimableViraje = virajeFromSurplus > remaining ? remaining : virajeFromSurplus;
                canClaim = cooldownPassed && (claimableViraje > 0) && (navPerShare >= WAD);
            }
        } catch {
            return (0, 0, nextAvailableTimestamp, false);
        }
    }

    /**
     * @notice Reclama los tokens VIRAJE consolidados, estrictamente acotados al 10% del excedente de solvencia.
     * @dev Requiere que el llamador sea el beneficiario o el rol ADMIN_ROLE en su nombre.
     *      Las transferencias se dirigen incondicionalmente a la dirección `beneficiary`.
     * @return claimedAmount Cantidad neta de tokens VIRAJE transferidos al beneficiario.
     */
    function claimVestedViraje() public nonReentrant returns (uint256 claimedAmount) {
        if (msg.sender != beneficiary && !hasRole(ProtocolRoles.ADMIN_ROLE, msg.sender)) {
            revert UnauthorizedBeneficiary();
        }

        if (totalClaimed >= TOTAL_ALLOCATION) {
            revert AllocationExhausted();
        }

        if (treasuryManager == address(0)) {
            revert TreasuryNotConfigured();
        }

        (
            uint256 claimableViraje,
            uint256 surplusUSD,
            uint256 nextAvailableTimestamp,
            bool canClaim
        ) = getClaimableInfo();

        if (block.timestamp < nextAvailableTimestamp && lastClaimTimestamp > 0) {
            revert CooldownActive(nextAvailableTimestamp);
        }
        if (surplusUSD == 0 || claimableViraje == 0 || !canClaim) {
            (uint256 assets, uint256 liabilities,) = ITreasury(treasuryManager).getProofOfReserves();
            revert NoReserveSurplus(assets, liabilities);
        }

        claimedAmount = claimableViraje;
        uint256 vaultBal = virajeToken.balanceOf(address(this));
        if (vaultBal < claimedAmount) {
            revert InsufficientVaultBalance(claimedAmount, vaultBal);
        }

        totalClaimed += claimedAmount;
        lastClaimTimestamp = block.timestamp;

        virajeToken.safeTransfer(beneficiary, claimedAmount);

        emit VirajeClaimed(beneficiary, claimedAmount, surplusUSD, block.timestamp);
    }

    /**
     * @notice Rescata tokens ERC-20 transferidos accidentalmente a esta bóveda (excluyendo el token VIRAJE).
     * @dev Bloquea incondicionalmente el token VIRAJE de consolidación para proteger los fondos en custodia.
     *      Restringido exclusivamente a `ADMIN_ROLE` (gobernanza Timelock).
     * @param token Dirección del activo a rescatar.
     * @param to Dirección receptora de los tokens rescatados.
     */
    function sweepTokens(address token, address to) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (token == address(0) || to == address(0)) revert IProtocolErrors.ZeroAddress();
        if (token == address(virajeToken)) revert IProtocolErrors.InvalidParameters();

        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal == 0) revert IProtocolErrors.InvalidAmount();

        IERC20(token).safeTransfer(to, bal);
        emit TokensSwept(token, to, bal);
    }
}
