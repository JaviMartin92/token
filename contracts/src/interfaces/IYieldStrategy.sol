// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IYieldStrategy
 * @notice Standardized interface for external yield strategies (Morpho, Aave, Compound).
 *         Similar conceptually to ERC-4626 but tailored to the protocol's specific push/pull needs.
 */
interface IYieldStrategy {
    /**
     * @notice Deposits the specified amount of stablecoins into the yield protocol.
     * @param amount The amount of stablecoins to deposit.
     * @return success True if the deposit succeeded.
     */
    function depositStablecoins(uint256 amount) external returns (bool success);

    /**
     * @notice Withdraws the specified amount of stablecoins from the yield protocol.
     * @param amount The amount of stablecoins to withdraw.
     * @return withdrawnAmount The actual amount withdrawn (could be less if liquidity is low).
     */
    function withdrawStablecoins(uint256 amount) external returns (uint256 withdrawnAmount);

    /**
     * @notice Returns the total stablecoin value currently invested in this strategy.
     */
    function totalStablecoinInvested() external view returns (uint256);
}
