// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./lib/security/ReentrancyGuard.sol";
import "./interfaces/IProtocolErrors.sol";

interface IGovernanceStakingYield {
    function notifyRewardAmount(uint256 amount) external;
}

/**
 * @title CommunityYieldVault
 * @author Alpha Centauri Architecture Team
 * @notice Bóveda descentralizada Pure DeFi para la captación y distribución del 50% de comisiones protocolarias (Real Yield).
 * @dev Recibe USDC líquido del `RealYieldRouter.sol` y lo canaliza de forma atómica hacia `GovernanceStaking.sol`
 *      para dividendos continuos a los tenedores de stALPHA.
 *      Cumple con el Considerando 22 del Reglamento MiCA de la UE: 100% del rendimiento real fluye a la comunidad sin intermediarios.
 */
contract CommunityYieldVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Token estable colateral utilizado para los dividendos (USDC).
    IERC20 public immutable stablecoin;

    /// @notice Dirección del contrato de Staking de Gobernanza receptor de los dividendos.
    address public stakingPool;

    // =========================================================================
    // 📢 EVENTOS DE RENDIMIENTO
    // =========================================================================
    event YieldDeposited(address indexed source, uint256 amount);
    event StakingPoolSet(address indexed stakingPool);
    event YieldFlushed(uint256 amount);

    /**
     * @notice Constructor del Vault de Rendimiento Comunitario.
     * @param _stablecoin Dirección del contrato ERC-20 del stablecoin (ej. USDC).
     * @param _initialOwner Dirección administradora génesis (TimelockController en mainnet).
     */
    constructor(address _stablecoin, address _initialOwner) {
        if (_stablecoin == address(0)) revert IProtocolErrors.ZeroAddress();
        if (_initialOwner == address(0)) revert IProtocolErrors.ZeroAddress();
        stablecoin = IERC20(_stablecoin);

        _grantRole(DEFAULT_ADMIN_ROLE, _initialOwner);
        _grantRole(ProtocolRoles.ADMIN_ROLE, _initialOwner);
    }

    /**
     * @notice Configura o actualiza el contrato de Staking receptor de recompensas.
     * @param _stakingPool Dirección del contrato `GovernanceStaking.sol`.
     */
    function setStakingPool(address _stakingPool) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_stakingPool == address(0)) revert IProtocolErrors.ZeroAddress();
        stakingPool = _stakingPool;
        emit StakingPoolSet(_stakingPool);
    }

    /**
     * @notice Recibe comisiones en USDC líquido y notifica a GovernanceStaking para distribución inmediata de dividendos.
     * @param amount Cantidad exacta de USDC a depositar y distribuir.
     */
    function depositYield(uint256 amount) external nonReentrant {
        if (amount == 0) revert IProtocolErrors.ZeroAmount();
        stablecoin.safeTransferFrom(msg.sender, address(this), amount);

        if (stakingPool != address(0)) {
            stablecoin.safeApprove(stakingPool, 0);
            stablecoin.safeApprove(stakingPool, amount);
            try IGovernanceStakingYield(stakingPool).notifyRewardAmount(amount) {
                // Notificación exitosa
            } catch {
                // Si la llamada transitoria falla, los fondos permanecen seguros en la bóveda
            }
        }

        emit YieldDeposited(msg.sender, amount);
    }

    /**
     * @notice Canaliza cualquier saldo remanente acumulado de USDC hacia el pool de staking.
     * @dev Función pública para garantizar que ningún rendimiento quede bloqueado en la bóveda.
     */
    function flushPendingYield() external nonReentrant {
        if (stakingPool == address(0)) revert IProtocolErrors.ZeroAddress();
        uint256 bal = stablecoin.balanceOf(address(this));
        if (bal == 0) revert IProtocolErrors.ZeroAmount();

        stablecoin.safeApprove(stakingPool, 0);
        stablecoin.safeApprove(stakingPool, bal);
        IGovernanceStakingYield(stakingPool).notifyRewardAmount(bal);
        emit YieldFlushed(bal);
    }

    /**
     * @notice Retorna el balance de USDC custodiado actualmente en la bóveda.
     */
    function getBalance() external view returns (uint256) {
        return stablecoin.balanceOf(address(this));
    }
}
