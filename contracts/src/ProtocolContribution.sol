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
 * @notice Receives external revenues and schedules TWAP orders to buy the native token,
 *         sending 50% to staking and 50% to the burn address / supply burn.
 *         Features MEV-protected slippage bounds and reentrancy defense.
 */
contract ProtocolContribution is IProtocolContribution, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Domain Custom Errors
    error InsufficientContractBalance();
    error OrderFullyExecuted();
    error IntervalLockActive();
    error ZeroTokensBought();

    address public immutable usdcToken;
    address public immutable nativeToken;
    address public immutable stakingAddress;
    address public swapRouter;
    address public oracleHub;
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    function burnAddress() external pure returns (address) {
        return BURN_ADDRESS;
    }

    uint256 public slippageToleranceBps = 100; // 1.00% default slippage
    uint256 public constant MAX_SLIPPAGE_BPS = 500; // 5.00% maximum slippage

    uint256 public nextOrderId;
    mapping(uint256 => TwapOrder) public twapOrders;

    event SwapRouterUpdated(address oldRouter, address newRouter);
    event OracleHubUpdated(address oldHub, address newHub);
    event SlippageToleranceUpdated(uint256 oldBps, uint256 newBps);
    event TwapOrderCancelled(uint256 indexed orderId, uint256 unspentAmount);
    event TokensSwept(address indexed token, address indexed to, uint256 amount);

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
        usdcToken = _usdcToken;
        nativeToken = _nativeToken;
        stakingAddress = _stakingAddress;
        swapRouter = _swapRouter;

        address admin = (_initialOwner != address(0)) ? _initialOwner : msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ProtocolRoles.ADMIN_ROLE, admin);
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
        if (IERC20(usdcToken).balanceOf(address(this)) < amount) revert InsufficientContractBalance();

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
     * @notice Cancels an active TWAP order and marks remaining executions to 0.
     */
    function cancelTwapOrder(uint256 orderId) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        TwapOrder storage order = twapOrders[orderId];
        if (order.executionsRemaining == 0) revert OrderFullyExecuted();
        uint256 unspent = order.executionsRemaining * order.amountPerInterval;
        order.executionsRemaining = 0;
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

        // Reset to 0 first, then approve amountToSwap
        IERC20(usdcToken).safeApprove(swapRouter, 0);
        IERC20(usdcToken).safeApprove(swapRouter, amountToSwap);

        // Calculate MEV-protected amountOutMinimum (scaled to native token 18 decimals)
        uint256 minOut = 0;
        if (oracleHub != address(0)) {
            try IOracleHub(oracleHub).getPriceBase18(nativeToken) returns (uint256 price18) {
                if (price18 > 0) {
                    // amountToSwap is 6 decimals, price18 is 18 decimals -> expected tokens in 18 decimals
                    uint256 expectedTokens = (amountToSwap * 1e12 * 1e18) / price18;
                    minOut = (expectedTokens * (10000 - slippageToleranceBps)) / 10000;
                }
            } catch {
                // Fallback to nominal 18-decimal base if oracle query fails
                minOut = (amountToSwap * 1e12 * (10000 - slippageToleranceBps)) / 10000;
            }
        } else {
            // Default 18-decimal base floor
            minOut = (amountToSwap * 1e12 * (10000 - slippageToleranceBps)) / 10000;
        }

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: usdcToken,
            tokenOut: nativeToken,
            fee: 3000,
            recipient: address(this),
            deadline: block.timestamp + 15 minutes,
            amountIn: amountToSwap,
            amountOutMinimum: minOut,
            sqrtPriceLimitX96: 0
        });

        uint256 tokensBought = ISwapRouter(swapRouter).exactInputSingle(params);
        if (tokensBought == 0) revert ZeroTokensBought();

        uint256 half = tokensBought / 2;
        uint256 otherHalf = tokensBought - half;

        IERC20(nativeToken).safeTransfer(stakingAddress, half);

        // Attempt actual supply burn if authorized, fallback to dead address
        if (otherHalf > 0) {
            try IBurnableToken(nativeToken).burn(otherHalf) {
                // Tokens burned from total supply
            } catch {
                IERC20(nativeToken).safeTransfer(BURN_ADDRESS, otherHalf);
            }
        }

        emit TwapStepExecuted(orderId, tokensBought, amountToSwap);
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
