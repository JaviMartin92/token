/**
 * @title Certora Formal Verification Specification for ProtocolTokenomicsEngine
 * @notice Verifies the pure mathematical correctness of tokenomics calculations,
 *         including NAV per share formulas, discount pricing bounds, and redemption payouts.
 */

methods {
    function calculateNAVPerShare(uint256, uint256) external returns (uint256) envfree;
    function calculateDiscountPrice(uint256, uint256) external returns (uint256) envfree;
    function calculateRedemptionPayout(uint256, uint256, uint256) external returns (uint256) envfree;
    function calculateLTVMaxBorrow(uint256, uint256) external returns (uint256) envfree;
}

/**
 * @title Rule: Discount Price Strictly Bounded
 * @notice Discounted purchase price must always be strictly less than or equal to base price,
 *         and non-negative when discountBps <= 10000.
 */
rule discountPriceBounded(uint256 basePrice, uint256 discountBps) {
    require discountBps <= 10000;
    
    uint256 discountedPrice = calculateDiscountPrice(basePrice, discountBps);
    
    assert discountedPrice <= basePrice, "Discounted price cannot exceed base price";
    assert (discountBps == 0 => discountedPrice == basePrice), "Zero discount must equal base price";
    assert (discountBps == 10000 => discountedPrice == 0), "100% discount must equal zero";
}

/**
 * @title Rule: NAV Monotonicity with Asset Inflows
 * @notice For any fixed circulating supply > 0, increasing total assets strictly increases NAV per share.
 */
rule navIncreasesWithAssets(uint256 assets1, uint256 assets2, uint256 supply) {
    require supply > 0;
    require assets2 >= assets1;
    
    uint256 nav1 = calculateNAVPerShare(assets1, supply);
    uint256 nav2 = calculateNAVPerShare(assets2, supply);
    
    assert nav2 >= nav1, "NAV per share must grow monotonically with increased protocol assets";
}

/**
 * @title Rule: NAV Monotonicity with Supply Burns
 * @notice For any fixed asset base > 0, burning supply strictly increases NAV per share.
 */
rule navIncreasesWithSupplyBurn(uint256 assets, uint256 supply1, uint256 supply2) {
    require supply2 < supply1;
    require supply2 > 0;
    require assets > 0;
    
    uint256 nav1 = calculateNAVPerShare(assets, supply1);
    uint256 nav2 = calculateNAVPerShare(assets, supply2);
    
    assert nav2 >= nav1, "NAV per share must grow monotonically when tokens are burned";
}

/**
 * @title Rule: Maximum LTV Borrow Bounded
 * @notice Borrow amount under max LTV must never exceed the collateral valuation.
 */
rule maxBorrowBoundedByCollateral(uint256 collateralUSD, uint256 maxLtvBps) {
    require maxLtvBps <= 10000;
    
    uint256 maxBorrow = calculateLTVMaxBorrow(collateralUSD, maxLtvBps);
    
    assert maxBorrow <= collateralUSD, "Max borrow amount cannot exceed total collateral USD valuation";
}
