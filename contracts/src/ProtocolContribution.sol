// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IProtocolContribution.sol";
import "./interfaces/ISwapRouter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";

/**
 * @title ProtocolContribution
 * @notice Receives external revenues and schedules TWAP orders to buy the native token,
 *         sending 50% to staking and 50% to the burn address.
 */
contract ProtocolContribution is IProtocolContribution, AccessControl {
    using SafeERC20 for IERC20;
    address public immutable usdcToken;
    address public immutable nativeToken;
    address public immutable stakingAddress;
    address public immutable swapRouter;
    address public immutable burnAddress = 0x000000000000000000000000000000000000dEaD;
    
    uint256 public nextOrderId;
    mapping(uint256 => TwapOrder) public twapOrders;

    constructor(
        address _usdcToken,
        address _nativeToken,
        address _stakingAddress,
        address _swapRouter,
        address _initialOwner
    ) {
        usdcToken = _usdcToken;
        nativeToken = _nativeToken;
        stakingAddress = _stakingAddress;
        swapRouter = _swapRouter;

        address admin = (_initialOwner != address(0)) ? _initialOwner : msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ProtocolRoles.ADMIN_ROLE, admin);
    }

    /**
     * @inheritdoc IProtocolContribution
     */
    function injectFunds(uint256 amount, string calldata auditRef) external override {
        require(amount > 0, "ProtocolContribution: Amount must be > 0");
        IERC20(usdcToken).safeTransferFrom(msg.sender, address(this), amount);
        emit ContributionReceived(amount, auditRef);
    }

    /**
     * @inheritdoc IProtocolContribution
     */
    function createTwapOrder(
        uint256 amount,
        uint256 intervals,
        uint256 intervalSeconds
    ) external override onlyRole(ProtocolRoles.ADMIN_ROLE) {
        require(amount > 0, "ProtocolContribution: TWAP amount must be > 0");
        require(intervals > 0, "ProtocolContribution: TWAP intervals must be > 0");
        require(intervalSeconds > 0, "ProtocolContribution: intervalSeconds must be > 0");
        require(IERC20(usdcToken).balanceOf(address(this)) >= amount, "ProtocolContribution: Insufficient contract balance");

        uint256 orderId = nextOrderId++;
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
     * @inheritdoc IProtocolContribution
     */
    function executeTwapStep(uint256 orderId) external override {
        TwapOrder storage order = twapOrders[orderId];
        require(order.executionsRemaining > 0, "ProtocolContribution: Order fully executed");
        require(block.timestamp >= order.nextExecutionTime, "ProtocolContribution: Interval lock active");

        order.executionsRemaining--;
        order.nextExecutionTime = block.timestamp + order.intervalSeconds;

        uint256 amountToSwap = order.amountPerInterval;

        require(IERC20(usdcToken).approve(swapRouter, amountToSwap), "ProtocolContribution: USDC approve failed");

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: usdcToken,
            tokenOut: nativeToken,
            fee: 3000,
            recipient: address(this),
            deadline: block.timestamp + 15 minutes,
            amountIn: amountToSwap,
            amountOutMinimum: (amountToSwap * 9900) / 10000,
            sqrtPriceLimitX96: 0
        });

        uint256 tokensBought = ISwapRouter(swapRouter).exactInputSingle(params);
        require(tokensBought > 0, "ProtocolContribution: Swapped zero tokens");

        uint256 half = tokensBought / 2;
        uint256 otherHalf = tokensBought - half;

        IERC20(nativeToken).safeTransfer(stakingAddress, half);
        IERC20(nativeToken).safeTransfer(burnAddress, otherHalf);

        emit TwapStepExecuted(orderId, tokensBought, amountToSwap);
    }
}
