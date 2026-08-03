// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ProtocolTokenomicsEngine.sol";

contract ProtocolTokenomicsEngineTest is Test {
    ProtocolTokenomicsEngine public engine;
    address public owner = address(0x1111);

    function setUp() public {
        engine = new ProtocolTokenomicsEngine(owner);
    }

    function test_DepositCalculation() public view {
        // Test deposit 1,000 USDC (6 decimals)
        uint256 depositAmount = 1000 * 1e6; // 1,000 USDC
        
        ProtocolTokenomicsEngine.DepositCalculation memory calc = engine.calculateDeposit(depositAmount, false, 6);
        
        // Fee = 0.50% of 1,000 = 5 USDC (5 * 1e6)
        assertEq(calc.feeAmountUsdc, 5 * 1e6);
        // Net Deposited = 995 USDC (995 * 1e6)
        assertEq(calc.netDepositedUsdc, 995 * 1e6);
        // Deposit Value USD (18 decimals) = 995 * 1e18
        assertEq(calc.depositValueUSD18, 995 * 1e18);
    }

    function test_SharePricingMath() public view {
        uint256 depositUsd = 1000 * 1e18;
        
        // First deposit: 1:1 share ratio
        uint256 shares1 = engine.calculateSharesToMint(depositUsd, 0, 0);
        assertEq(shares1, 1000 * 1e18);

        // Second deposit: NAV = 1000 USD, Total Shares = 1000 ALPHA
        uint256 shares2 = engine.calculateSharesToMint(depositUsd, 1000 * 1e18, 1000 * 1e18);
        assertEq(shares2, 1000 * 1e18);
    }

    function test_RedemptionMath() public view {
        uint256 sharesToRedeem = 500 * 1e18; // 500 ALPHA
        uint256 totalShares = 1000 * 1e18;   // 1000 ALPHA
        uint256 nav = 1000 * 1e18;          // $1000 NAV

        ProtocolTokenomicsEngine.RedemptionCalculation memory calc = engine.calculateRedemption(sharesToRedeem, totalShares, nav, 6);
        
        // Gross USD = $500 (500 * 1e18)
        assertEq(calc.grossAssetValueUSD18, 500 * 1e18);
        // 1.00% Exit Fee = $5 (5 * 1e18)
        assertEq(calc.feeChargedUSD18, 5 * 1e18);
        // Net USD = $495 (495 * 1e18)
        assertEq(calc.netAssetValueUSD18, 495 * 1e18);
        // Assets Received USDC = 495 USDC (495 * 1e6)
        assertEq(calc.assetsReceivedTokens, 495 * 1e6);
    }

    function test_BondDiscountAndTierBonus() public view {
        uint256 principal = 1000 * 1e6; // 1,000 USDC
        
        // 3 years lockup, 12,000 ALPHA staked (+2% bonus)
        ProtocolTokenomicsEngine.BondDiscountCalculation memory calc = engine.calculateBondDiscount(principal, 3, 12000 * 1e18);
        
        // Discount BPS = 3 * 500 + 200 = 1700 BPS (17.00%)
        assertEq(calc.discountBps, 1700);
        // Discounted Price Paid = 1000 * (10000 - 1700) / 10000 = 830 USDC
        assertEq(calc.discountedPricePaid, 830 * 1e6);
        // 1.5% Referral = 830 * 0.015 = 12.45 USDC
        assertEq(calc.referralReward, 12450000);
        // 1.5% Mint Fee = 12.45 USDC
        assertEq(calc.protocolMintFee, 12450000);
        // Net to Treasury = 830 - 12.45 - 12.45 = 805.10 USDC
        assertEq(calc.netToTreasury, 805100000);
    }

    function test_P2PLoanTermsAndHealthFactor() public view {
        uint256 collateralUsd = 1000 * 1e6; // $1,000 collateral
        uint256 borrowUsd = 500 * 1e6;      // $500 borrow (50% LTV <= 70% Max)
        
        ProtocolTokenomicsEngine.LoanCalculation memory calc = engine.calculateLoanTerms(collateralUsd, borrowUsd, 1000, 365); // 10% APR, 1 Year
        
        assertEq(calc.maxBorrowAmount, 700 * 1e6); // 70% LTV = $700
        assertTrue(calc.isLtvValid);
        assertEq(calc.originationFee, 2500000);   // 0.5% of $500 = $2.50
        assertEq(calc.interestOwed, 50 * 1e6);     // 10% of $500 = $50
        assertEq(calc.totalOwed, 550 * 1e6);       // $500 + $50 = $550

        // Health Factor Check
        ProtocolTokenomicsEngine.HealthFactorResult memory hf = engine.calculateHealthFactor(collateralUsd, calc.totalOwed, false);
        // Collateral $1000 * 10000 / $550 = 18181 (181.81% HF)
        assertEq(hf.healthFactorRatioPct, 18181);
        assertFalse(hf.isLiquidatable);
    }

    function test_ProofOfReservesSolvency() public view {
        ProtocolTokenomicsEngine.SolvencyResult memory res1 = engine.calculateProofOfReserves(1000 * 1e18, 1000 * 1e18);
        assertTrue(res1.isSolvent);
        assertEq(res1.collateralRatioBps, 10000); // 100.00%

        ProtocolTokenomicsEngine.SolvencyResult memory res2 = engine.calculateProofOfReserves(900 * 1e18, 1000 * 1e18);
        assertFalse(res2.isSolvent);
        assertEq(res2.collateralRatioBps, 9000); // 90.00%
    }
}
