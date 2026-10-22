// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TreasuryFeeLib
 * @notice Internal library providing dynamic anti-dilution and emergency fee formulas for TreasuryManager.
 */
library TreasuryFeeLib {
    uint256 public constant BASE_FEE_BPS = 50; // 0.50%
    uint256 public constant IMPACT_SENSITIVITY_BPS = 500; // 5.00%
    uint256 public constant MAX_DYNAMIC_FEE_BPS = 500; // 5.00%
    uint256 public constant EMERGENCY_FEE_BPS = 500; // 5.00%

    struct RedeemCalculation {
        uint256 grossAssetValueUSD;
        uint256 feeChargedUSD;
        uint256 netAssetValueUSD;
        uint256 assetsReceived;
        uint256 feeTokenAmount;
    }

    /**
     * @notice Computes dynamic slippage fee (0.50% - 5.00%) based on deposit size relative to exogenous reserves.
     * @param grossDepositUSD Gross USD value of the incoming deposit (18 decimals).
     * @param totalAssetsExogenousUSD Current total exogenous USD reserves (18 decimals).
     * @return dynamicFeeBps Fee in basis points (e.g. 50 = 0.50%).
     */
    function calculateDynamicFeeBps(uint256 grossDepositUSD, uint256 totalAssetsExogenousUSD)
        internal
        pure
        returns (uint256)
    {
        if (totalAssetsExogenousUSD == 0) return BASE_FEE_BPS;

        uint256 totalDenom = totalAssetsExogenousUSD + grossDepositUSD;
        uint256 impactRatio = (grossDepositUSD * 10000) / totalDenom;
        uint256 dynamicFeeBps = BASE_FEE_BPS + ((impactRatio * IMPACT_SENSITIVITY_BPS) / 10000);

        if (dynamicFeeBps > MAX_DYNAMIC_FEE_BPS) {
            dynamicFeeBps = MAX_DYNAMIC_FEE_BPS;
        }
        return dynamicFeeBps;
    }

    /**
     * @notice Computes emergency retention fee (5.00%) for non-whitelisted account redemptions.
     * @param grossUsdValue Gross USD value of redeemed shares (18 decimals).
     * @return emergencyFeeUsd Retained USD fee (18 decimals).
     */
    function calculateEmergencyFee(uint256 grossUsdValue) internal pure returns (uint256) {
        return (grossUsdValue * EMERGENCY_FEE_BPS) / 10000;
    }

    /**
     * @notice Computes standard redemption amounts and fees while optimizing EVM stack depth.
     */
    function calculateRedemption(uint256 sharesAmount, uint256 totalNavUSD, uint256 totalShares, uint8 decimals)
        internal
        pure
        returns (RedeemCalculation memory calc)
    {
        calc.grossAssetValueUSD = (sharesAmount * totalNavUSD) / totalShares;
        calc.feeChargedUSD = (calc.grossAssetValueUSD * 100) / 10000;
        calc.netAssetValueUSD = calc.grossAssetValueUSD - calc.feeChargedUSD;

        uint256 scale = 10 ** (18 - decimals);
        calc.assetsReceived = calc.netAssetValueUSD / scale;
        calc.feeTokenAmount = calc.feeChargedUSD / scale;
    }
}
