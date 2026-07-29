// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICircuitBreaker {
    event CircuitTriggered(address indexed asset, uint256 dropPercentage, uint256 timestamp);
    event CircuitReset(address indexed asset, uint256 timestamp);

    /**
     * @notice Performs a deviation check against Chainlink Oracles to identify >15% drops in 6 hours.
     * @param asset The address of the asset to verify.
     * @return triggered True if the asset triggered the circuit breaker.
     */
    function checkAssetDeviation(address asset) external returns (bool triggered);

    /**
     * @notice Returns whether an asset is currently frozen for purchasing.
     */
    function isFrozen(address asset) external view returns (bool);

    /**
     * @notice Unfreezes the purchase of a specific asset. Callable only by governance.
     */
    function resetBreaker(address asset) external;
}
