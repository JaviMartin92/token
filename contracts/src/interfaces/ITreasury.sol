// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITreasury {
    struct AssetWeights {
        uint256 stablecoins;          // Target: 50% (Min 40%, Max 60%)
        uint256 wbtc;                 // Target: 25% (Min 20%, Max 30%)
        uint256 weth;                 // Target: 12.5% (Min 10%, Max 15%)
        uint256 alphaProtocolStaking; // Target: 12.5% (Min 5%, Max 15%) - Auto-staked for Real Yield
    }

    event WeightsAdjusted(AssetWeights newWeights);
    event Redeemed(address indexed user, uint256 sharesBurned, uint256 assetAmountOut, uint256 feeCharged);
    event Rebalanced(uint256 timestamp);

    /**
     * @notice Returns the Net Asset Value (NAV) of the Treasury in USD with 18 decimal places.
     */
    function getNAV() external view returns (uint256);

    /**
     * @notice Returns the amount of specific asset held by the Treasury (including yield vaults).
     */
    function getAssetBalance(address asset) external view returns (uint256);

    /**
     * @notice Allows an investor to redeem shares directly for stablecoins based on the NAV.
     * @param sharesAmount The amount of native shares/tokens to redeem.
     * @return assetsReceived The net amount of USDC/EURC stablecoins received.
     */
    function redeem(uint256 sharesAmount) external returns (uint256 assetsReceived);

    /**
     * @notice Validates that the current portfolio weights are within the sanity bounds.
     */
    function validateSanityBounds() external view returns (bool);

    /**
     * @notice Performs a rebalancing operation, realigning current weights to targets.
     */
    function rebalance() external;

    /**
     * @notice Allows VestedDiscountVault to request reimbursement payouts upon ragequit/maturity.
     */
    function releaseVaultPayout(address to, uint256 amount) external;

    /**
     * @notice Processes 1% staking entry fee ALPHA tokens, burning them and routing equivalent USDC yield to RealYieldRouter (50/25/25 flywheel).
     */
    function processStakingFee(uint256 feeShares) external;
}
