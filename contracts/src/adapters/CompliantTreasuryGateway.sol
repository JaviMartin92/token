// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../lib/security/ReentrancyGuard.sol";
import "../ProtocolRoles.sol";
import "../interfaces/IProtocolErrors.sol";

interface ITreasuryManagerGateway {
    function deposit(uint256 stableAmount, uint256 minSharesOut) external returns (uint256 sharesMinted);
    function depositFor(address beneficiary, uint256 stableAmount, uint256 minSharesOut) external returns (uint256 sharesMinted);
    function redeem(uint256 sharesAmount, uint256 minUsdcOut) external returns (uint256 assetsReceived);
    function redeemFor(address beneficiary, address recipient, uint256 sharesAmount, uint256 minUsdcOut) external returns (uint256 assetsReceived);
    function redemptionToken() external view returns (address);
}

/**
 * @title CompliantTreasuryGateway
 * @author Viraje Protocol Architecture Team
 * @notice Pasarela fiduciaria y aislador regulatorio sin estado para inversores institucionales (MiCA/AML).
 * @dev Delega el 100% de la ejecución en TreasuryManager.sol sin mantener fondos propios ni pools paralelos,
 *      eliminando discrepancias de precios, fragmentación de liquidez y oportunidades de arbitraje MEV.
 *      Implementa higiene estricta de asignación residual cero (Zero Dangling Approvals).
 */
contract CompliantTreasuryGateway is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- Constantes Institucionales ---
    uint256 public constant MAX_BATCH_SIZE = 250;

    // --- Errores Personalizados de Dominio (EIP-838) ---
    error KYCVerificationFailed(address user);
    error GatewayZeroAddress();

    ITreasuryManagerGateway public immutable treasuryManager;
    address public immutable virajeToken;
    address public immutable stablecoin;

    mapping(address => bool) public isKYCVerified;
    mapping(address => uint256) public userLastDepositBlock;

    // --- Eventos Institucionales ---
    event InstitutionalKYCUpdated(address indexed account, bool status);
    event InstitutionalDepositForwarded(address indexed institution, uint256 usdcIn, uint256 sharesOut);
    event InstitutionalRedeemForwarded(address indexed institution, uint256 sharesIn, uint256 usdcOut);
    event TokensSwept(address indexed token, address indexed to, uint256 amount);

    /**
     * @notice Inicializa la pasarela con las referencias fiduciarias del protocolo.
     * @param _treasuryManager Dirección del contrato TreasuryManager.
     * @param _virajeToken Dirección del token nativo VIRAJE.
     * @param _admin Dirección del administrador de gobernanza inicial.
     */
    constructor(address _treasuryManager, address _virajeToken, address _admin) {
        if (_treasuryManager == address(0) || _virajeToken == address(0)) revert GatewayZeroAddress();
        treasuryManager = ITreasuryManagerGateway(_treasuryManager);
        virajeToken = _virajeToken;
        stablecoin = ITreasuryManagerGateway(_treasuryManager).redemptionToken();

        address admin = (_admin != address(0)) ? _admin : msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ProtocolRoles.ADMIN_ROLE, admin);
        _grantRole(ProtocolRoles.COMPLIANCE_ROLE, admin);
    }

    modifier onlyKYC(address account) {
        if (!isKYCVerified[account]) revert KYCVerificationFailed(account);
        _;
    }

    /**
     * @notice Actualiza el estado de verificación KYC de una entidad institucional individual.
     * @param account Dirección de la institución.
     * @param status True si cumple con los requisitos fiduciarios / MiCA.
     */
    function setKYCStatus(address account, bool status) external onlyRole(ProtocolRoles.COMPLIANCE_ROLE) {
        if (account == address(0)) revert IProtocolErrors.ZeroAddress();
        isKYCVerified[account] = status;
        emit InstitutionalKYCUpdated(account, status);
    }

    /**
     * @notice Actualiza el estado KYC de múltiples entidades en un único lote acotado.
     * @param accounts Lista de direcciones a parametrizar (máximo 250 por transacción).
     * @param status Nuevo estado de verificación.
     */
    function batchSetKYCStatus(address[] calldata accounts, bool status)
        external
        onlyRole(ProtocolRoles.COMPLIANCE_ROLE)
    {
        uint256 len = accounts.length;
        if (len > MAX_BATCH_SIZE) revert IProtocolErrors.InvalidParameters();

        for (uint256 i = 0; i < len;) {
            if (accounts[i] != address(0)) {
                isKYCVerified[accounts[i]] = status;
                emit InstitutionalKYCUpdated(accounts[i], status);
            }
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Reenvía depósitos institucionales directamente a TreasuryManager de forma atómica.
     * @dev Operación sin estado: los fondos pasan instantáneamente del usuario a la Tesorería central,
     *      acuñando participaciones VIRAJE directamente a favor de la institución.
     * @param stableAmount Monto exacto de stablecoin a depositar (6 decimales).
     * @param minSharesOut Cantidad mínima de participaciones VIRAJE esperadas (protección contra slippage).
     * @return sharesMinted Cantidad neta de participaciones acuñadas.
     */
    function depositCompliant(uint256 stableAmount, uint256 minSharesOut)
        external
        nonReentrant
        onlyKYC(msg.sender)
        returns (uint256 sharesMinted)
    {
        if (stableAmount == 0) revert IProtocolErrors.ZeroAmount();

        // 1. Extracción de stablecoin desde la institución
        IERC20(stablecoin).safeTransferFrom(msg.sender, address(this), stableAmount);
        IERC20(stablecoin).safeApprove(address(treasuryManager), 0);
        IERC20(stablecoin).safeApprove(address(treasuryManager), stableAmount);

        // 2. Ejecución fiduciaria central: acuña directamente para msg.sender
        sharesMinted = treasuryManager.depositFor(msg.sender, stableAmount, minSharesOut);
        userLastDepositBlock[msg.sender] = block.number;

        // 3. Higiene de aprobaciones: eliminación incondicional de asignación residual
        IERC20(stablecoin).safeApprove(address(treasuryManager), 0);

        emit InstitutionalDepositForwarded(msg.sender, stableAmount, sharesMinted);
    }

    /**
     * @notice Reenvía solicitudes de reembolso institucional directamente a TreasuryManager.
     * @dev Operación sin estado: quema participaciones VIRAJE y transfiere USDC directamente al usuario.
     *      Aplica una salvaguarda anti-flash-loan que prohíbe reembolsos en el mismo bloque del depósito.
     * @param sharesAmount Cantidad de participaciones VIRAJE a reembolsar (18 decimales).
     * @param minUsdcOut Monto mínimo de stablecoin a recibir (protección contra slippage).
     * @return assetsReceived Cantidad neta de stablecoins entregada a la institución.
     */
    function redeemCompliant(uint256 sharesAmount, uint256 minUsdcOut)
        external
        nonReentrant
        onlyKYC(msg.sender)
        returns (uint256 assetsReceived)
    {
        if (sharesAmount == 0) revert IProtocolErrors.ZeroAmount();
        if (userLastDepositBlock[msg.sender] >= block.number) {
            revert IProtocolErrors.SameBlockCooldown(msg.sender, block.number);
        }

        // 1. Extracción de participaciones VIRAJE desde la institución
        IERC20(virajeToken).safeTransferFrom(msg.sender, address(this), sharesAmount);
        IERC20(virajeToken).safeApprove(address(treasuryManager), 0);
        IERC20(virajeToken).safeApprove(address(treasuryManager), sharesAmount);

        // 2. Ejecución fiduciaria central: quema de participaciones y transferencia directa de USDC
        assetsReceived = treasuryManager.redeemFor(address(this), msg.sender, sharesAmount, minUsdcOut);

        // 3. Higiene de aprobaciones: eliminación incondicional de asignación residual
        IERC20(virajeToken).safeApprove(address(treasuryManager), 0);

        emit InstitutionalRedeemForwarded(msg.sender, sharesAmount, assetsReceived);
    }

    /**
     * @notice Rescata tokens ERC-20 transferidos accidentalmente al contrato.
     * @param token Dirección del activo a transferir.
     * @param to Destinatario de los fondos rescatados.
     * @param amount Cantidad a transferir.
     */
    function sweepTokens(address token, address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token == address(0) || to == address(0)) revert IProtocolErrors.ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        emit TokensSwept(token, to, amount);
    }
}
