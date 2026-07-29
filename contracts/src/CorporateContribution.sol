// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ICorporateContribution.sol";
import "./interfaces/ISwapRouter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CorporateContribution
 * @notice Receives external revenues and schedules TWAP orders to buy the native token,
 *         sending 50% to staking and 50% to the burn address.
 */
contract CorporateContribution is ICorporateContribution, Ownable {
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
    ) Ownable() {
        usdcToken = _usdcToken;
        nativeToken = _nativeToken;
        stakingAddress = _stakingAddress;
        swapRouter = _swapRouter;

        if (_initialOwner != msg.sender) {
            transferOwnership(_initialOwner);
        }
    }

    /**
     * @inheritdoc ICorporateContribution
     */
    function injectFunds(uint256 amount, string calldata auditRef) external override {
        require(amount > 0, "CorporateContribution: Amount must be > 0");
        
        // Pull USDC from corporate sender
        require(IERC20(usdcToken).transferFrom(msg.sender, address(this), amount), "CorporateContribution: USDC transferFrom failed");
        
        emit ContributionReceived(amount, auditRef);
    }

    /**
     * @inheritdoc ICorporateContribution
     */
    function createTwapOrder(
        uint256 amount,
        uint256 intervals,
        uint256 intervalSeconds
    ) external override onlyOwner {
        require(amount > 0, "CorporateContribution: TWAP amount must be > 0");
        require(intervals > 0, "CorporateContribution: TWAP intervals must be > 0");
        require(intervalSeconds > 0, "CorporateContribution: intervalSeconds must be > 0");
        require(IERC20(usdcToken).balanceOf(address(this)) >= amount, "CorporateContribution: Insufficient contract balance");

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
     * @inheritdoc ICorporateContribution
     */
    function executeTwapStep(uint256 orderId) external override {
        TwapOrder storage order = twapOrders[orderId];
        require(order.executionsRemaining > 0, "CorporateContribution: Order fully executed");
        require(block.timestamp >= order.nextExecutionTime, "CorporateContribution: Interval lock active");

        order.executionsRemaining--;
        order.nextExecutionTime = block.timestamp + order.intervalSeconds;

        uint256 amountToSwap = order.amountPerInterval;

        // Approve SwapRouter to spend USDC
        require(IERC20(usdcToken).approve(swapRouter, amountToSwap), "CorporateContribution: USDC approve failed");

        // Swap USDC -> Native Token with minimum 1% slippage protection
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: usdcToken,
            tokenOut: nativeToken,
            fee: 3000, // 0.3% pool fee standard for altcoins
            recipient: address(this),
            deadline: block.timestamp + 15 minutes,
            amountIn: amountToSwap,
            amountOutMinimum: (amountToSwap * 9900) / 10000, // 1% max slippage
            sqrtPriceLimitX96: 0
        });

        uint256 tokensBought = ISwapRouter(swapRouter).exactInputSingle(params);
        require(tokensBought > 0, "CorporateContribution: Swapped zero tokens");

        // Split: 50% to Staking, 50% to Burn
        uint256 half = tokensBought / 2;
        uint256 otherHalf = tokensBought - half;

        require(IERC20(nativeToken).transfer(stakingAddress, half), "CorporateContribution: staking transfer failed");
        require(IERC20(nativeToken).transfer(burnAddress, otherHalf), "CorporateContribution: burn transfer failed");

        emit TwapStepExecuted(orderId, tokensBought, amountToSwap);
    }
}
