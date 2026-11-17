// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IProtocolContribution.sol";
import "./interfaces/ISwapRouter.sol";
import "./interfaces/IProtocolErrors.sol";
import "./interfaces/IOracleHub.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./lib/security/ReentrancyGuard.sol";

interface IBurnableToken {
    function burn(uint256 amount) external;
}

/**
 * @title ProtocolContribution
 * @author Viraje Protocol Architecture Team
 * @notice Contrato fiduciario para recepción de ingresos externos y ejecución programada TWAP de recompras.
 * @dev Recibe ingresos en USDC y ejecuta órdenes TWAP para adquirir tokens nativos VIRAJE en Uniswap v3/DEX.
 *      Los tokens adquiridos son quemados al 100% para apreciar de forma deflacionaria el NAV del protocolo.
 *      Incorpora contabilidad de compromiso estricto (totalCommittedUsdc) para prevenir sobregiros/doble gasto,
 *      tolerancia a deslizamiento parametrizable con protección MEV vía oráculo, y rescate seguro de tokens foráneos.
 */
contract ProtocolContribution is IProtocolContribution, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Constantes de escala y precisión institucional
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant MAX_SLIPPAGE_BPS = 500; // 5.00% máximo deslizamiento
    uint256 public constant USDC_DECIMALS_FACTOR = 1e12; // Conversión 6 a 18 decimales
    uint256 public constant WAD = 1e18;
    uint24 public constant DEFAULT_POOL_FEE = 3000; // 0.30% fee tier Uniswap v3
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // Errores tipados de dominio
    error InsufficientContractBalance();
    error OrderFullyExecuted();
    error IntervalLockActive();
    error ZeroTokensBought();
    error OvercommittedBalance();

    // Direcciones inmutables
    address public immutable usdcToken;
    address public immutable nativeToken;
    address public immutable stakingAddress;

    // Direcciones y parámetros configurables
    address public swapRouter;
    address public oracleHub;
    uint24 public poolFee = DEFAULT_POOL_FEE;
    uint256 public slippageToleranceBps = 100; // 1.00% deslizamiento por defecto

    // Gestión de órdenes TWAP y contabilidad de balance comprometido
    uint256 public nextOrderId;
    uint256 public totalCommittedUsdc;
    mapping(uint256 => TwapOrder) public twapOrders;

    // Métricas acumulativas de telemetría on-chain
    uint256 public totalUsdcInjected;
    uint256 public totalUsdcSpent;
    uint256 public totalTokensBought;
    uint256 public totalTokensBurned;

    // Eventos
    event SwapRouterUpdated(address indexed oldRouter, address indexed newRouter);
    event OracleHubUpdated(address indexed oldHub, address indexed newHub);
    event PoolFeeUpdated(uint24 oldFee, uint24 newFee);
    event SlippageToleranceUpdated(uint256 oldBps, uint256 newBps);
    event TwapOrderCancelled(uint256 indexed orderId, uint256 unspentAmount);
    event TokensSwept(address indexed token, address indexed to, uint256 amount);

    /**
     * @notice Constructor del módulo de contribuciones y recompras.
     * @param _usdcToken Dirección del token estable de liquidación (USDC).
     * @param _nativeToken Dirección del token nativo de gobernanza (VIRAJE).
     * @param _stakingAddress Dirección del contrato de staking (preservado por compatibilidad de interfaz).
     * @param _swapRouter Dirección del enrutador Uniswap v3 / DEX.
     * @param _initialOwner Dirección receptora de roles administrativos génesis.
     */
    constructor(
        address _usdcToken,
        address _nativeToken,
        address _stakingAddress,
        address _swapRouter,
        address _initialOwner
    ) {
        if (_usdcToken == address(0) || _nativeToken == address(0) || _stakingAddress == address(0)) {
            revert IProtocolErrors.ZeroAddress();
        }
        if (_initialOwner == address(0)) revert IProtocolErrors.ZeroAddress();

        usdcToken = _usdcToken;
        nativeToken = _nativeToken;
        stakingAddress = _stakingAddress;
        swapRouter = _swapRouter;

        _grantRole(DEFAULT_ADMIN_ROLE, _initialOwner);
        _grantRole(ProtocolRoles.ADMIN_ROLE, _initialOwner);
    }

    function burnAddress() external pure returns (address) {
        return BURN_ADDRESS;
    }

    function setSwapRouter(address _swapRouter) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_swapRouter == address(0)) revert IProtocolErrors.ZeroAddress();
        address old = swapRouter;
        swapRouter = _swapRouter;
        emit SwapRouterUpdated(old, _swapRouter);
    }

    function setOracleHub(address _oracleHub) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        address old = oracleHub;
        oracleHub = _oracleHub;
        emit OracleHubUpdated(old, _oracleHub);
    }

    function setPoolFee(uint24 _poolFee) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_poolFee == 0) revert IProtocolErrors.InvalidParameters();
        uint24 old = poolFee;
        poolFee = _poolFee;
        emit PoolFeeUpdated(old, _poolFee);
    }

    function setSlippageToleranceBps(uint256 _slippageToleranceBps) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_slippageToleranceBps > MAX_SLIPPAGE_BPS) revert IProtocolErrors.InvalidParameters();
        uint256 old = slippageToleranceBps;
        slippageToleranceBps = _slippageToleranceBps;
        emit SlippageToleranceUpdated(old, _slippageToleranceBps);
    }

    /**
     * @inheritdoc IProtocolContribution
     */
    function injectFunds(uint256 amount, string calldata auditRef) external override nonReentrant {
        if (amount == 0) revert IProtocolErrors.ZeroAmount();
        
        totalUsdcInjected += amount;
        IERC20(usdcToken).safeTransferFrom(msg.sender, address(this), amount);
        
        emit ContributionReceived(amount, auditRef);
    }

    /**
     * @inheritdoc IProtocolContribution
     */
    function createTwapOrder(uint256 amount, uint256 intervals, uint256 intervalSeconds)
        external
        override
        onlyRole(ProtocolRoles.ADMIN_ROLE)
    {
        if (amount == 0 || intervals == 0 || intervalSeconds == 0) revert IProtocolErrors.InvalidParameters();
        
        uint256 currentBal = IERC20(usdcToken).balanceOf(address(this));
        if (currentBal < totalCommittedUsdc + amount) revert InsufficientContractBalance();

        totalCommittedUsdc += amount;

        uint256 orderId = nextOrderId;
        unchecked {
            ++nextOrderId;
        }
        uint256 amountPerInterval = amount / intervals;

        twapOrders[orderId] = TwapOrder({
            id: orderId,
            totalAmount: amount,
            amountPerInterval: amountPerInterval,
            intervalSeconds: intervalSeconds,
            nextExecutionTime: block.timestamp,
            executionsRemaining: intervals
        });

        emit TwapOrderCreated(orderId, amount, intervals);
    }

    /**
     * @notice Cancela una orden TWAP activa y libera el capital no gastado de los compromisos de la bóveda.
     * @param orderId Identificador único de la orden TWAP a cancelar.
     */
    function cancelTwapOrder(uint256 orderId) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        TwapOrder storage order = twapOrders[orderId];
        if (order.executionsRemaining == 0) revert OrderFullyExecuted();
        
        uint256 unspent = order.executionsRemaining * order.amountPerInterval;
        order.executionsRemaining = 0;
        
        if (totalCommittedUsdc >= unspent) {
            totalCommittedUsdc -= unspent;
        } else {
            totalCommittedUsdc = 0;
        }

        emit TwapOrderCancelled(orderId, unspent);
    }

    /**
     * @inheritdoc IProtocolContribution
     */
    function executeTwapStep(uint256 orderId) external override nonReentrant {
        if (swapRouter == address(0)) revert IProtocolErrors.ZeroAddress();
        TwapOrder storage order = twapOrders[orderId];
        if (order.executionsRemaining == 0) revert OrderFullyExecuted();
        if (block.timestamp < order.nextExecutionTime) revert IntervalLockActive();

        unchecked {
            --order.executionsRemaining;
        }
        order.nextExecutionTime = block.timestamp + order.intervalSeconds;

        uint256 amountToSwap = order.amountPerInterval;
        if (totalCommittedUsdc >= amountToSwap) {
            totalCommittedUsdc -= amountToSwap;
        } else {
            totalCommittedUsdc = 0;
        }

        totalUsdcSpent += amountToSwap;

        // Reset to 0 first, then approve amountToSwap
        IERC20(usdcToken).safeApprove(swapRouter, 0);
        IERC20(usdcToken).safeApprove(swapRouter, amountToSwap);

        // Calculate MEV-protected amountOutMinimum (scaled to native token 18 decimals)
        uint256 minOut = 0;
        if (oracleHub != address(0)) {
            try IOracleHub(oracleHub).getPriceBase18(nativeToken) returns (uint256 price18) {
                if (price18 > 0) {
                    uint256 expectedTokens = (amountToSwap * USDC_DECIMALS_FACTOR * WAD) / price18;
                    minOut = (expectedTokens * (BPS_DENOMINATOR - slippageToleranceBps)) / BPS_DENOMINATOR;
                } else {
                    revert IProtocolErrors.InvalidPrice();
                }
            } catch {
                revert IProtocolErrors.InvalidPrice();
            }
        } else {
            // Default 18-decimal base floor for local testing or unconfigured oracle
            minOut = (amountToSwap * USDC_DECIMALS_FACTOR * (BPS_DENOMINATOR - slippageToleranceBps)) / BPS_DENOMINATOR;
        }

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: usdcToken,
            tokenOut: nativeToken,
            fee: poolFee,
            recipient: address(this),
            deadline: block.timestamp + 15 minutes,
            amountIn: amountToSwap,
            amountOutMinimum: minOut,
            sqrtPriceLimitX96: 0
        });

        uint256 tokensBought = ISwapRouter(swapRouter).exactInputSingle(params);
        if (tokensBought == 0) revert ZeroTokensBought();

        // Reset allowance on router to prevent dangling approvals
        IERC20(usdcToken).safeApprove(swapRouter, 0);

        totalTokensBought += tokensBought;
        totalTokensBurned += tokensBought;

        // 100% supply burn to accretively increase protocol NAV for all holders & stakers
        try IBurnableToken(nativeToken).burn(tokensBought) {
            // Burned directly from total supply
        } catch {
            IERC20(nativeToken).safeTransfer(BURN_ADDRESS, tokensBought);
        }

        emit TwapStepExecuted(orderId, tokensBought, amountToSwap);
    }

    /**
     * @notice Rescata tokens ERC-20 transferidos por error a este contrato.
     * @dev Bloquea taxativamente el rescate de usdcToken y nativeToken para preservar la integridad de fondos.
     * @param token Dirección del activo a rescatar.
     * @param to Dirección beneficiaria.
     * @param amount Cantidad exacta de tokens a rescatar.
     */
    function sweepTokens(address token, address to, uint256 amount) public onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (token == address(0) || to == address(0)) revert IProtocolErrors.ZeroAddress();
        if (token == usdcToken || token == nativeToken) revert IProtocolErrors.InvalidParameters();
        if (amount == 0) revert IProtocolErrors.ZeroAmount();

        IERC20(token).safeTransfer(to, amount);
        emit TokensSwept(token, to, amount);
    }

    /**
     * @notice Rescata el saldo completo de un token ERC-20 accidental.
     * @param token Dirección del activo a rescatar.
     * @param to Dirección beneficiaria.
     */
    function sweepTokens(address token, address to) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (token == address(0) || to == address(0)) revert IProtocolErrors.ZeroAddress();
        uint256 bal = IERC20(token).balanceOf(address(this));
        sweepTokens(token, to, bal);
    }
}
