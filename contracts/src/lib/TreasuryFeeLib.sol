// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TreasuryFeeLib
 * @author Viraje Protocol Architecture Team
 * @notice Pure mathematical library providing frictionless deposit, dynamic anti-dilution,
 *         and standard/emergency redemption fee calculations for TreasuryManager.
 * @dev All basis point (BPS) calculations use a canonical denominator of 10,000 (100% = 10,000 BPS).
 * @custom:security-note Sub-additive Truncation: In redemption calculations, both net assets received
 *                       and fee token amounts are truncated (floored) upon decimal scaling. This guarantees
 *                       mathematically that total tokens disbursed never exceed the gross redeemed value.
 * @custom:security-note Zero-Friction Invariant: Deposits representing <= 20.00% of pool reserves incur
 *                       strictly 0.00% fees, ensuring frictionless onboarding for standard users.
 */
library TreasuryFeeLib {
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant BASE_FEE_BPS = 0; // 0.00% Base Deposit Fee (Frictionless Institutional Onboarding)
    uint256 public constant WHALE_IMPACT_THRESHOLD_BPS = 2000; // 20.00% Pool Impact Threshold
    uint256 public constant IMPACT_SENSITIVITY_BPS = 200; // 2.00% Whale Dilution Sensitivity
    uint256 public constant MAX_DYNAMIC_FEE_BPS = 200; // 2.00% Max Slippage Fee
    uint256 public constant STANDARD_REDEMPTION_FEE_BPS = 100; // 1.00% Exit Fee (50% NAV accrual / 50% yield)
    uint256 public constant EMERGENCY_FEE_BPS = 500; // 5.00% Emergency KYC Revocation Retention Fee

    struct RedeemCalculation {
        uint256 grossAssetValueUSD;
        uint256 feeChargedUSD;
        uint256 netAssetValueUSD;
        uint256 assetsReceived;
        uint256 feeTokenAmount;
    }

    /**
     * @notice Computes dynamic anti-dilution fee (0.00% for standard deposits <= 20% pool impact, up to 2.00% max for whale deposits).
     * @param grossDepositUSD Gross USD value of the incoming deposit (18 decimals).
     * @param totalAssetsExogenousUSD Current total exogenous USD reserves (18 decimals).
     * @return dynamicFeeBps Fee in basis points (e.g. 0 = 0.00%, 200 = 2.00%).
     */
    function calculateDynamicFeeBps(uint256 grossDepositUSD, uint256 totalAssetsExogenousUSD)
        public
        pure
        returns (uint256)
    {
        if (totalAssetsExogenousUSD == 0) return BASE_FEE_BPS;

        uint256 totalDenom = totalAssetsExogenousUSD + grossDepositUSD;
        uint256 impactRatio = (grossDepositUSD * BPS_DENOMINATOR) / totalDenom;

        // Normal deposits (<= 20% of reserves) are 100% frictionless (0.00% fee)
        if (impactRatio <= WHALE_IMPACT_THRESHOLD_BPS) {
            return BASE_FEE_BPS;
        }

        // Anti-dilution fee strictly for massive whale deposits (> 20% pool impact)
        uint256 excessImpact = impactRatio - WHALE_IMPACT_THRESHOLD_BPS;
        uint256 dynamicFeeBps = (excessImpact * IMPACT_SENSITIVITY_BPS) / BPS_DENOMINATOR;

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
    function calculateEmergencyFee(uint256 grossUsdValue) public pure returns (uint256) {
        return (grossUsdValue * EMERGENCY_FEE_BPS) / BPS_DENOMINATOR;
    }

    /**
     * @notice Computes emergency redemption amounts and fees while optimizing EVM stack depth.
     * @param sharesAmount Amount of shares being redeemed (18 decimals).
     * @param netEquityUSD Net free equity backing circulating shares (18 decimals).
     * @param totalShares Net circulating shares in existence (18 decimals).
     * @param decimals Decimals of the redemption collateral token (e.g. 6 for USDC).
     * @return calc Struct containing USD valuations, assets disbursed, and fee tokens routed.
     */
    function calculateEmergencyRedemption(uint256 sharesAmount, uint256 netEquityUSD, uint256 totalShares, uint8 decimals)
        public
        pure
        returns (RedeemCalculation memory calc)
    {
        calc.grossAssetValueUSD = (sharesAmount * netEquityUSD) / totalShares;
        calc.feeChargedUSD = (calc.grossAssetValueUSD * EMERGENCY_FEE_BPS) / BPS_DENOMINATOR;
        calc.netAssetValueUSD = calc.grossAssetValueUSD - calc.feeChargedUSD;

        uint256 scale = 10 ** (18 - decimals);
        calc.assetsReceived = calc.netAssetValueUSD / scale;
        calc.feeTokenAmount = calc.feeChargedUSD / scale;
    }

    /**
     * @notice Computes standard redemption amounts and fees while optimizing EVM stack depth.
     * @param sharesAmount Amount of shares being redeemed (18 decimals).
     * @param totalNavUSD Net free equity backing circulating shares (18 decimals).
     * @param totalShares Net circulating shares in existence (18 decimals).
     * @param decimals Decimals of the redemption collateral token (e.g. 6 for USDC).
     * @return calc Struct containing USD valuations, assets disbursed, and fee tokens routed.
     */
    function calculateRedemption(uint256 sharesAmount, uint256 totalNavUSD, uint256 totalShares, uint8 decimals)
        public
        pure
        returns (RedeemCalculation memory calc)
    {
        calc.grossAssetValueUSD = (sharesAmount * totalNavUSD) / totalShares;
        calc.feeChargedUSD = (calc.grossAssetValueUSD * STANDARD_REDEMPTION_FEE_BPS) / BPS_DENOMINATOR;
        calc.netAssetValueUSD = calc.grossAssetValueUSD - calc.feeChargedUSD;

        uint256 scale = 10 ** (18 - decimals);
        calc.assetsReceived = calc.netAssetValueUSD / scale;
        calc.feeTokenAmount = calc.feeChargedUSD / scale;
    }
}
