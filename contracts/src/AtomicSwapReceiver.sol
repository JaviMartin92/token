// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IAtomicSwapReceiver.sol";
import "./interfaces/ISwapRouter.sol";
import "./interfaces/IProtocolErrors.sol";
import "./interfaces/ICircuitBreaker.sol";
import "./interfaces/ITreasury.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./lib/security/ReentrancyGuard.sol";

/**
 * @title AtomicSwapReceiver
 * @author Viraje Protocol Architecture Team
 * @notice Pasarela institucional de arbitraje y swap atómico para depósitos en Tether USD (USDT).
 * @dev Recibe USDT de usuarios, ejecuta un swap atómico hacia USDC en Uniswap V3 (Arbitrum One)
 *      y deposita el resultado en TreasuryManager para acuñar participaciones VIRAJE en una única
 *      transacción libre de aprobaciones residuales (Zero Dangling Approvals) y protegida contra MEV.
 */
contract AtomicSwapReceiver is IAtomicSwapReceiver, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- Constantes Institucionales ---
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant MAX_SLIPPAGE_BPS_CAP = 500; // 5.00% cota máxima de slippage

    // --- Direcciones Inmutables del Núcleo ---
    address public immutable usdtToken;
    address public immutable usdcToken;

    // --- Parámetros de Enrutamiento y Gobernanza ---
    address public swapRouter;
    address public treasury;
    address public circuitBreaker;

    uint24 public poolFee = 100; // 0.01% pool fee estándar de stablecoins en Uniswap V3
    uint24 public constant MAX_POOL_FEE = 3000; // 0.30% fee máximo admisible
    uint256 public maxSlippageBps = 50; // 0.50% slippage máximo permitido por defecto

    // --- Eventos Institucionales ---
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event SwapRouterUpdated(address indexed oldRouter, address indexed newRouter);
    event PoolFeeUpdated(uint24 oldFee, uint24 newFee);
    event MaxSlippageBpsUpdated(uint256 oldBps, uint256 newBps);
    event CircuitBreakerUpdated(address indexed oldBreaker, address indexed newBreaker);
    event TokensSwept(address indexed token, address indexed to, uint256 amount);

    /**
     * @notice Inicializa el contrato con los componentes fiduciarios del protocolo.
     * @param _usdtToken Dirección del contrato Tether USD en Arbitrum One.
     * @param _usdcToken Dirección del contrato USD Coin nativo en Arbitrum One.
     * @param _swapRouter Dirección del SwapRouter de Uniswap V3.
     * @param _treasury Dirección del contrato TreasuryManager de Viraje Protocol.
     * @param _initialOwner Dirección del administrador fiduciario inicial.
     */
    constructor(
        address _usdtToken,
        address _usdcToken,
        address _swapRouter,
        address _treasury,
        address _initialOwner
    ) {
        if (_usdtToken == address(0) || _usdcToken == address(0) || _treasury == address(0)) {
            revert IProtocolErrors.ZeroAddress();
        }
        usdtToken = _usdtToken;
        usdcToken = _usdcToken;
        swapRouter = _swapRouter;
        treasury = _treasury;

        address admin = (_initialOwner != address(0)) ? _initialOwner : msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ProtocolRoles.ADMIN_ROLE, admin);
    }

    /**
     * @notice Actualiza la dirección de la Tesorería receptora de depósitos.
     * @param _treasury Nueva dirección de la Tesorería.
     */
    function setTreasury(address _treasury) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_treasury == address(0)) revert IProtocolErrors.ZeroAddress();
        address old = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(old, _treasury);
    }

    /**
     * @notice Actualiza la dirección del enrutador de swaps (Uniswap V3 SwapRouter).
     * @param _swapRouter Nueva dirección del router.
     */
    function setSwapRouter(address _swapRouter) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_swapRouter == address(0)) revert IProtocolErrors.ZeroAddress();
        address old = swapRouter;
        swapRouter = _swapRouter;
        emit SwapRouterUpdated(old, _swapRouter);
    }

    /**
     * @notice Configura el fee tier del pool de Uniswap V3 (e.g. 100 = 0.01%, 500 = 0.05%).
     * @param _poolFee Fee tier en unidades de Uniswap.
     */
    function setPoolFee(uint24 _poolFee) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_poolFee > MAX_POOL_FEE) revert IProtocolErrors.InvalidParameters();
        uint24 old = poolFee;
        poolFee = _poolFee;
        emit PoolFeeUpdated(old, _poolFee);
    }

    /**
     * @notice Configura la tolerancia máxima de deslizamiento admisible en el swap atómico.
     * @param _slippageBps Deslizamiento en puntos básicos (máximo 500 BPS = 5.00%).
     */
    function setMaxSlippageBps(uint256 _slippageBps) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_slippageBps > MAX_SLIPPAGE_BPS_CAP) revert IProtocolErrors.InvalidParameters();
        uint256 old = maxSlippageBps;
        maxSlippageBps = _slippageBps;
        emit MaxSlippageBpsUpdated(old, _slippageBps);
    }

    /**
     * @notice Actualiza la referencia del oráculo de Circuit Breaker.
     * @param _circuitBreaker Dirección del contrato CircuitBreaker.
     */
    function setCircuitBreaker(address _circuitBreaker) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        address old = circuitBreaker;
        circuitBreaker = _circuitBreaker;
        emit CircuitBreakerUpdated(old, _circuitBreaker);
    }

    /**
     * @inheritdoc IAtomicSwapReceiver
     */
    function depositUSDT(uint256 usdtAmount, uint256 minUsdcExpected)
        external
        override
        returns (uint256 usdcDeposited)
    {
        return depositUSDT(usdtAmount, minUsdcExpected, 0);
    }

    /**
     * @notice Recibe USDT del usuario, realiza el swap a USDC en Uniswap V3 y deposita en Tesorería.
     * @param usdtAmount Monto exacto de USDT a transferir y convertir (6 decimales).
     * @param minUsdcExpected Monto mínimo de USDC que se espera recibir del swap (6 decimales).
     * @param minSharesOut Cantidad mínima de participaciones VIRAJE a emitir por la Tesorería.
     * @return usdcDeposited Monto neto de USDC depositado en la Tesorería.
     */
    function depositUSDT(uint256 usdtAmount, uint256 minUsdcExpected, uint256 minSharesOut)
        public
        override
        nonReentrant
        returns (uint256 usdcDeposited)
    {
        if (usdtAmount == 0) revert IProtocolErrors.ZeroAmount();
        if (treasury == address(0) || swapRouter == address(0)) revert IProtocolErrors.ZeroAddress();

        // 1. Verificación de Circuit Breaker para ambos tokens
        if (circuitBreaker != address(0)) {
            if (ICircuitBreaker(circuitBreaker).isFrozen(usdtToken)) {
                revert IProtocolErrors.CircuitBreakerActive(usdtToken);
            }
            if (ICircuitBreaker(circuitBreaker).isFrozen(usdcToken)) {
                revert IProtocolErrors.CircuitBreakerActive(usdcToken);
            }
        }

        // 2. Control de deslizamiento estricto contra MEV / sándwich
        uint256 maxSlippageLimit = (usdtAmount * (BPS_DENOMINATOR - maxSlippageBps)) / BPS_DENOMINATOR;
        if (minUsdcExpected < maxSlippageLimit) {
            revert IProtocolErrors.SlippageExceeded(maxSlippageLimit, minUsdcExpected);
        }

        // 3. Extracción de USDT del remitente
        IERC20(usdtToken).safeTransferFrom(msg.sender, address(this), usdtAmount);

        // 4. Aprobación temporal e higiénica a Uniswap SwapRouter
        IERC20(usdtToken).safeApprove(swapRouter, 0);
        IERC20(usdtToken).safeApprove(swapRouter, usdtAmount);

        // 5. Parámetros del Swap en Uniswap V3
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: usdtToken,
            tokenOut: usdcToken,
            fee: poolFee,
            recipient: address(this),
            deadline: block.timestamp + 15 minutes,
            amountIn: usdtAmount,
            amountOutMinimum: minUsdcExpected,
            sqrtPriceLimitX96: 0
        });

        // 6. Ejecución atómica del swap
        usdcDeposited = ISwapRouter(swapRouter).exactInputSingle(params);

        // 7. Erradicación incondicional de asignación residual en USDT
        IERC20(usdtToken).safeApprove(swapRouter, 0);

        // 8. Depósito en Tesorería y emisión de participaciones VIRAJE
        IERC20(usdcToken).safeApprove(treasury, 0);
        IERC20(usdcToken).safeApprove(treasury, usdcDeposited);
        ITreasury(treasury).depositFor(msg.sender, usdcDeposited, minSharesOut);

        // 9. Erradicación incondicional de asignación residual en USDC
        IERC20(usdcToken).safeApprove(treasury, 0);

        // 10. Emisión de telemetría institucional
        uint256 feePaid = (usdtAmount > usdcDeposited) ? (usdtAmount - usdcDeposited) : 0;
        emit AtomicSwapExecuted(msg.sender, usdtAmount, usdcDeposited, feePaid);

        return usdcDeposited;
    }

    /**
     * @notice Rescata tokens transferidos erróneamente al contrato.
     * @param token Dirección del activo a transferir.
     * @param to Dirección del receptor del rescate.
     * @param amount Cantidad a transferir.
     */
    function sweepTokens(address token, address to, uint256 amount) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (token == address(0) || to == address(0)) revert IProtocolErrors.ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        emit TokensSwept(token, to, amount);
    }
}
