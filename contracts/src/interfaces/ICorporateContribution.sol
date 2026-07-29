// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICorporateContribution {
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
    event TwapStepExecuted(uint256 indexed orderId, uint256 tokensBought, uint256 costUsdc);

    /**
     * @notice Injects corporate revenues to backing pools, referencing audited records.
     * @param amount The USDC/EURC amount injected.
     * @param auditRef The audit document hash or transaction check reference.
     */
    function injectFunds(uint256 amount, string calldata auditRef) external;

    /**
     * @notice Creates and schedules a new multi-step TWAP buyback order.
     * @param amount The total USDC allocated to the TWAP.
     * @param intervals The number of purchasing steps.
     * @param intervalSeconds The wait time in seconds between purchases.
     */
    function createTwapOrder(uint256 amount, uint256 intervals, uint256 intervalSeconds) external;

    /**
     * @notice Triggers execution of the next step in a scheduled TWAP order.
     * @param orderId The identifier of the TWAP order to update.
     */
    function executeTwapStep(uint256 orderId) external;
}
