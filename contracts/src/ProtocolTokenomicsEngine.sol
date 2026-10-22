// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./interfaces/IProtocolErrors.sol";

/**
 * @title ProtocolTokenomicsEngine
 * @notice Centralized Master Math & Tokenomics Engine for Alpha Centauri Protocol.
 * @dev Enforces 100% mathematical consistency, decimal conversions, fee splits,
 *      bond discounts, LTV capacity, interest calculations, and Proof-of-Reserves solvency.
 */
contract ProtocolTokenomicsEngine is AccessControl {
    // --- PROTOCOL PARAMETERS & BASIS POINTS ---
    uint256 public constant BPS_DENOMINATOR = 10000;

    // Default Fees (in BPS)
    uint256 public depositFeeBps = 50; // 0.50%
    uint256 public redeemFeeBps = 100; // 1.00%
    uint256 public originationFeeBps = 50; // 0.50%
    uint256 public interestSpreadBps = 1000; // 10.00% to Staking Flywheel
    uint256 public ragequitPenaltyBps = 1500; // 15.00%
    uint256 public mintFeeBps = 150; // 1.50%
    uint256 public referralFeeBps = 150; // 1.50%
    uint256 public stakingEntryFeeBps = 100; // 1.00%

    // Bounds & Caps
    uint256 public baseYieldRateBps = 500; // 5.00% per year lockup
    uint256 public maxBondDiscountBps = 5000; // 50.00% Max Discount Cap
    uint256 public maxLtvBps = 7000; // 70.00% Max LTV
    uint256 public minHealthFactorBps = 11500; // 115% Liquidation Threshold
    uint256 public maxAprBps = 5000; // 50.00% Max APR
    uint256 public treasuryBorrowAprBps = 800; // 8.00% Fixed Treasury Borrow APR default

    event ParametersUpdated(string parameterGroup);
    event TreasuryBorrowAprUpdated(uint256 newAprBps);

    constructor(address initialOwner) {
        address admin = (initialOwner != address(0)) ? initialOwner : msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ProtocolRoles.ADMIN_ROLE, admin);
    }

    // =========================================================================
    // 1. TREASURY DEPOSIT & SHARE PRICING MATH
    // =========================================================================

    struct DepositCalculation {
        uint256 feeAmountUsdc;
        uint256 netDepositedUsdc;
        uint256 depositValueUSD18;
    }

    /**
     * @notice Calculates deposit entry fee and scales USDC (6 decimals) to 18-decimal USD value.
     */
    function calculateDeposit(uint256 actualDepositedUsdc, bool isRouterCall, uint8 redemptionTokenDecimals)
        external
        view
        returns (DepositCalculation memory calc)
    {
        if (actualDepositedUsdc == 0) return calc;

        calc.feeAmountUsdc = isRouterCall ? 0 : (actualDepositedUsdc * depositFeeBps) / BPS_DENOMINATOR;
        calc.netDepositedUsdc = actualDepositedUsdc - calc.feeAmountUsdc;

        uint256 scaleMultiplier = 10 ** (18 - redemptionTokenDecimals);
        calc.depositValueUSD18 = calc.netDepositedUsdc * scaleMultiplier;
    }

    /**
     * @notice Calculates exact ALPHA Shares to mint for a deposit given current NAV and shares supply.
     */
    function calculateSharesToMint(uint256 depositValueUSD18, uint256 currentSharesSupply, uint256 navBefore18)
        external
        pure
        returns (uint256 sharesToMint)
    {
        if (depositValueUSD18 == 0) return 0;
        if (currentSharesSupply == 0 || navBefore18 == 0) {
            return depositValueUSD18;
        }
        return (depositValueUSD18 * currentSharesSupply) / navBefore18;
    }

    // =========================================================================
    // 2. TREASURY REDEMPTION & EXIT FEE MATH
    // =========================================================================

    struct RedemptionCalculation {
        uint256 grossAssetValueUSD18;
        uint256 feeChargedUSD18;
        uint256 netAssetValueUSD18;
        uint256 assetsReceivedTokens;
        uint256 feeTokenAmount;
    }

    /**
     * @notice Calculates gross USD entitlement, exit fee, and net tokens returned for a redemption.
     */
    function calculateRedemption(
        uint256 sharesAmount,
        uint256 totalSharesSupply,
        uint256 totalNavUSD18,
        uint8 redemptionTokenDecimals
    ) external view returns (RedemptionCalculation memory calc) {
        if (sharesAmount == 0) revert IProtocolErrors.ZeroAmount();
        if (totalSharesSupply == 0) revert IProtocolErrors.ZeroTotalSupply();

        calc.grossAssetValueUSD18 = (sharesAmount * totalNavUSD18) / totalSharesSupply;
        calc.feeChargedUSD18 = (calc.grossAssetValueUSD18 * redeemFeeBps) / BPS_DENOMINATOR;
        calc.netAssetValueUSD18 = calc.grossAssetValueUSD18 - calc.feeChargedUSD18;

        uint256 scaleFactor = 10 ** (18 - redemptionTokenDecimals);
        calc.assetsReceivedTokens = calc.netAssetValueUSD18 / scaleFactor;
        calc.feeTokenAmount = calc.feeChargedUSD18 / scaleFactor;
    }

    // =========================================================================
    // 3. VESTED DISCOUNT VAULT MATH
    // =========================================================================

    struct BondDiscountCalculation {
        uint256 discountBps;
        uint256 discountedPricePaid;
        uint256 referralReward;
        uint256 protocolMintFee;
        uint256 netToTreasury;
    }

    /**
     * @notice Calculates progressive lockup discount, tiered staking bonus, and fee splits for bond purchase.
     */
    function calculateBondDiscount(uint256 principalAmountUsdc, uint256 lockYears, uint256 userStakedBalanceAlpha)
        external
        view
        returns (BondDiscountCalculation memory calc)
    {
        if (principalAmountUsdc == 0) revert IProtocolErrors.ZeroAmount();
        if (lockYears < 1 || lockYears > 5) revert IProtocolErrors.InvalidLockYears();

        // Base discount = lockYears * 5% (500 BPS)
        uint256 rawDiscount = lockYears * baseYieldRateBps;

        // Governance Staking Bonus Tier
        uint256 tierBonus = 0;
        if (userStakedBalanceAlpha >= 20000 * 1e18) {
            tierBonus = 300; // +3%
        } else if (userStakedBalanceAlpha >= 10000 * 1e18) {
            tierBonus = 200; // +2%
        } else if (userStakedBalanceAlpha >= 5000 * 1e18) {
            tierBonus = 100; // +1%
        }

        calc.discountBps = rawDiscount + tierBonus;
        if (calc.discountBps > maxBondDiscountBps) {
            calc.discountBps = maxBondDiscountBps;
        }

        calc.discountedPricePaid = (principalAmountUsdc * (BPS_DENOMINATOR - calc.discountBps)) / BPS_DENOMINATOR;
        calc.referralReward = (calc.discountedPricePaid * referralFeeBps) / BPS_DENOMINATOR;
        calc.protocolMintFee = (calc.discountedPricePaid * mintFeeBps) / BPS_DENOMINATOR;
        calc.netToTreasury = calc.discountedPricePaid - calc.referralReward - calc.protocolMintFee;
    }

    struct RagequitCalculation {
        uint256 penaltyTotal;
        uint256 userRefund;
        uint256 bunkerShare;
        uint256 opsShare;
        uint256 flywheelShare;
    }

    /**
     * @notice Calculates early exit 15% penalty and splits for ragequitting a bond.
     */
    function calculateRagequitPenalty(uint256 discountedPricePaid)
        external
        view
        returns (RagequitCalculation memory calc)
    {
        if (discountedPricePaid == 0) revert IProtocolErrors.ZeroAmount();

        calc.penaltyTotal = (discountedPricePaid * ragequitPenaltyBps) / BPS_DENOMINATOR;
        calc.userRefund = discountedPricePaid - calc.penaltyTotal;

        calc.bunkerShare = calc.penaltyTotal / 2; // 50% Strategic Reserve
        calc.opsShare = 0; // Pure DeFi: 0% corporate extraction
        calc.flywheelShare = calc.penaltyTotal - calc.bunkerShare; // 50% Community Yield Flywheel
    }

    // =========================================================================
    // 4. P2P LENDING MARKET MATH
    // =========================================================================

    struct LoanCalculation {
        uint256 maxBorrowAmount;
        uint256 originationFee;
        uint256 netDisbursed;
        uint256 interestOwed;
        uint256 totalOwed;
        bool isLtvValid;
    }

    /**
     * @notice Calculates loan origination fees, maximum 70% LTV borrow capacity, and simple interest.
     */
    function calculateLoanTerms(
        uint256 collateralValueUsd,
        uint256 requestedBorrowAmountUsd,
        uint256 aprBps,
        uint256 durationDays
    ) external view returns (LoanCalculation memory calc) {
        if (collateralValueUsd == 0) revert IProtocolErrors.ZeroAmount();
        if (aprBps > maxAprBps) revert IProtocolErrors.InvalidParameters();

        calc.maxBorrowAmount = (collateralValueUsd * maxLtvBps) / BPS_DENOMINATOR;
        calc.isLtvValid = requestedBorrowAmountUsd <= calc.maxBorrowAmount;

        calc.originationFee = (requestedBorrowAmountUsd * originationFeeBps) / BPS_DENOMINATOR;
        calc.netDisbursed = requestedBorrowAmountUsd - calc.originationFee;

        calc.interestOwed = (requestedBorrowAmountUsd * aprBps * durationDays) / (365 * BPS_DENOMINATOR);
        calc.totalOwed = requestedBorrowAmountUsd + calc.interestOwed;
    }

    struct HealthFactorResult {
        uint256 healthFactorRatioPct; // e.g. 11500 = 115.00%
        bool isLiquidatable;
    }

    /**
     * @notice Calculates Health Factor ratio and checks liquidation condition (HF < 115% or Expired).
     */
    function calculateHealthFactor(uint256 collateralUsd, uint256 totalOwedUsd, bool isExpired)
        external
        view
        returns (HealthFactorResult memory res)
    {
        if (totalOwedUsd == 0) {
            return HealthFactorResult({healthFactorRatioPct: 999000, isLiquidatable: false});
        }
        res.healthFactorRatioPct = (collateralUsd * 10000) / totalOwedUsd; // 10000 BPS = 100.00%
        res.isLiquidatable = (res.healthFactorRatioPct < minHealthFactorBps) || isExpired;
    }

    // =========================================================================
    // 5. PROOF OF RESERVES & SOLVENCY MATH
    // =========================================================================

    struct SolvencyResult {
        uint256 collateralRatioBps;
        bool isSolvent;
    }

    /**
     * @notice Validates 100% solvency requirement (Total Assets USD >= Total Liabilities USD).
     */
    function calculateProofOfReserves(uint256 totalAssetsUSD18, uint256 totalLiabilitiesUSD18)
        external
        pure
        returns (SolvencyResult memory res)
    {
        if (totalLiabilitiesUSD18 == 0) {
            return SolvencyResult({collateralRatioBps: 10000, isSolvent: true});
        }
        res.collateralRatioBps = (totalAssetsUSD18 * BPS_DENOMINATOR) / totalLiabilitiesUSD18;
        res.isSolvent = totalAssetsUSD18 >= totalLiabilitiesUSD18 && res.collateralRatioBps >= BPS_DENOMINATOR;
    }

    /**
     * @notice Updates the Treasury borrowing APR (in BPS).
     * @param newAprBps New APR in basis points (e.g. 800 = 8.00% APR).
     */
    function setTreasuryBorrowAprBps(uint256 newAprBps) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (newAprBps < 100 || newAprBps > maxAprBps) revert IProtocolErrors.InvalidParameters();
        treasuryBorrowAprBps = newAprBps;
        emit TreasuryBorrowAprUpdated(newAprBps);
    }
}
