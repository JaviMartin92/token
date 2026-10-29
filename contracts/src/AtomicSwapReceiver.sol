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
 * @notice Accepts USDT deposits and atomically swaps them to USDC via Uniswap V3 on Arbitrum One.
 *         Applies SafeERC20 approval sequences to guarantee compatibility with non-standard USDT.
 */
contract AtomicSwapReceiver is IAtomicSwapReceiver, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable usdtToken;
    address public immutable usdcToken;
    address public swapRouter;
    address public treasury;
    address public circuitBreaker;

    uint24 public poolFee = 100; // 0.01% standard stablecoin pool fee
    uint24 public constant MAX_POOL_FEE = 3000; // 0.30% max allowable pool fee
    uint256 public maxSlippageBps = 50; // 0.50% default maximum allowable slippage (accommodates 0.05% - 0.30% fee tiers)

    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event SwapRouterUpdated(address oldRouter, address newRouter);
    event PoolFeeUpdated(uint24 oldFee, uint24 newFee);
    event MaxSlippageBpsUpdated(uint256 oldBps, uint256 newBps);
    event CircuitBreakerUpdated(address oldBreaker, address newBreaker);
    event TokensSwept(address indexed token, address indexed to, uint256 amount);

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
     * @notice Updates the treasury address.
     */
    function setTreasury(address _treasury) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_treasury == address(0)) revert IProtocolErrors.ZeroAddress();
        address old = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(old, _treasury);
    }

    /**
     * @notice Updates the swap router address.
     */
    function setSwapRouter(address _swapRouter) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_swapRouter == address(0)) revert IProtocolErrors.ZeroAddress();
        address old = swapRouter;
        swapRouter = _swapRouter;
        emit SwapRouterUpdated(old, _swapRouter);
    }

    /**
     * @notice Updates the Uniswap V3 pool fee tier.
     */
    function setPoolFee(uint24 _poolFee) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_poolFee > MAX_POOL_FEE) revert IProtocolErrors.InvalidParameters();
        uint24 old = poolFee;
        poolFee = _poolFee;
        emit PoolFeeUpdated(old, _poolFee);
    }

    /**
     * @notice Updates the maximum allowable slippage basis points for the USDT -> USDC swap.
     */
    function setMaxSlippageBps(uint256 _slippageBps) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_slippageBps > 500) revert IProtocolErrors.InvalidParameters(); // Max 5%
        uint256 old = maxSlippageBps;
        maxSlippageBps = _slippageBps;
        emit MaxSlippageBpsUpdated(old, _slippageBps);
    }

    /**
     * @notice Updates the Circuit Breaker reference.
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
     * @notice Receives USDT from a user and atomically swaps it to USDC, then deposits into Treasury.
     * @param usdtAmount The amount of USDT being deposited.
     * @param minUsdcExpected Minimum USDC expected from Uniswap swap.
     * @param minSharesOut Minimum ALPHA shares expected from Treasury deposit.
     */
    function depositUSDT(uint256 usdtAmount, uint256 minUsdcExpected, uint256 minSharesOut)
        public
        override
        nonReentrant
        returns (uint256 usdcDeposited)
    {
        if (usdtAmount == 0) revert IProtocolErrors.ZeroAmount();
        if (treasury == address(0) || swapRouter == address(0)) revert IProtocolErrors.ZeroAddress();

        if (circuitBreaker != address(0)) {
            if (ICircuitBreaker(circuitBreaker).isFrozen(usdtToken)) {
                revert IProtocolErrors.CircuitBreakerActive(usdtToken);
            }
            if (ICircuitBreaker(circuitBreaker).isFrozen(usdcToken)) {
                revert IProtocolErrors.CircuitBreakerActive(usdcToken);
            }
        }

        // Enforce configurable slippage limit (default 0.50% to accommodate Uniswap fees)
        uint256 maxSlippageLimit = (usdtAmount * (10000 - maxSlippageBps)) / 10000;
        if (minUsdcExpected < maxSlippageLimit) {
            revert IProtocolErrors.SlippageExceeded(maxSlippageLimit, minUsdcExpected);
        }

        // 1. Pull USDT from sender to this contract
        IERC20(usdtToken).safeTransferFrom(msg.sender, address(this), usdtAmount);

        // 2. Approve SwapRouter to spend USDT via SafeERC20 (reset to 0 first for USDT compliance)
        IERC20(usdtToken).safeApprove(swapRouter, 0);
        IERC20(usdtToken).safeApprove(swapRouter, usdtAmount);

        // 3. Configure Uniswap swap parameters
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

        // 4. Execute atomic swap on Uniswap V3
        usdcDeposited = ISwapRouter(swapRouter).exactInputSingle(params);

        // 5. Transfer resulting USDC to Treasury & mint ALPHA to depositor
        IERC20(usdcToken).forceApprove(treasury, usdcDeposited);
        ITreasury(treasury).depositFor(msg.sender, usdcDeposited, minSharesOut);

        emit AtomicSwapExecuted(msg.sender, usdtAmount, usdcDeposited, minSharesOut);
        return usdcDeposited;
    }

    /**
     * @notice Rescues erroneously transferred tokens.
     */
    function sweepTokens(address token, address to, uint256 amount) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (token == address(0) || to == address(0)) revert IProtocolErrors.ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        emit TokensSwept(token, to, amount);
    }
}
