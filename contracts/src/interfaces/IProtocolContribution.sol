// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IProtocolContribution {
    struct TwapOrder {
        uint256 id;
        uint256 totalAmount;
        uint256 amountPerInterval;
        uint256 intervalSeconds;
        uint256 nextExecutionTime;
        uint256 executionsRemaining;
    }

    event ContributionReceived(uint256 amount, string auditRef);
    event TwapOrderCreated(uint256 indexed orderId, uint256 totalAmount, uint256 intervals);
    event TwapStepExecuted(uint256 indexed orderId, uint256 tokensBought, uint256 usdcSpent);

    function injectFunds(uint256 amount, string calldata auditRef) external;
    function createTwapOrder(uint256 amount, uint256 intervals, uint256 intervalSeconds) external;
    function executeTwapStep(uint256 orderId) external;
}
