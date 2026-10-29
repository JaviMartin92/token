/**
 * @title Certora Formal Verification Specification for ProtocolTokenomicsEngine
 * @notice Verifies the pure mathematical correctness of tokenomics calculations,
 *         including NAV per share formulas, discount pricing bounds, and redemption payouts.
 */

methods {
    function calculateSharesToMint(uint256, uint256, uint256) external returns (uint256) envfree;
    function calculateRagequitPenalty(uint256) external returns (uint256) envfree;
    function calculateProofOfReserves(uint256, uint256) external returns (uint256, bool) envfree;
}

/**
 * @title Rule: Shares to Mint Strict Monotonicity with Deposit Value
 * @notice Given positive supply and NAV, a larger deposit strictly produces greater or equal shares.
 */
rule sharesToMintMonotonicWithDeposit(uint256 depositVal1, uint256 depositVal2, uint256 supply, uint256 nav) {
    require supply > 0;
    require nav > 0;
    require depositVal2 >= depositVal1;
    require depositVal1 > 0;

    uint256 shares1 = calculateSharesToMint(depositVal1, supply, nav);
    uint256 shares2 = calculateSharesToMint(depositVal2, supply, nav);

    assert shares2 >= shares1, "Shares minted must grow monotonically with deposit value";
}

/**
 * @title Rule: Ragequit Penalty Strictly Bounded by Principal
 * @notice Ragequit penalty must always be strictly less than or equal to discounted price paid.
 */
rule ragequitPenaltyBounded(uint256 discountedPricePaid) {
    uint256 penalty = calculateRagequitPenalty(discountedPricePaid);

    assert penalty <= discountedPricePaid, "Penalty cannot exceed discounted price paid";
}

/**
 * @title Rule: Proof of Reserves Solvency Check
 * @notice Solvency flag is strictly true when assets >= liabilities.
 */
rule proofOfReservesSolvency(uint256 assets18, uint256 liabilities18) {
    require liabilities18 > 0;
    uint256 ratio;
    bool isSolvent;
    ratio, isSolvent = calculateProofOfReserves(assets18, liabilities18);

    assert (assets18 >= liabilities18 <=> isSolvent), "System must be solvent if and only if assets >= liabilities";
}
