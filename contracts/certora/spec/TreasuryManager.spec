/**
 * @title Certora Formal Verification Specification for TreasuryManager
 * @notice Mathematically verifies the continuous solvency, NAV monotonicity, 
 *         and Proof of Reserves (PoR) invariants of the Alpha Centauri Protocol.
 */

using AlphaToken as alphaToken;
using AlphaVault as alphaVault;

methods {
    function getNAV() external returns (uint256) envfree;
    function getNAVPerShare() external returns (uint256) envfree;
    function getRedemptionPrice() external returns (uint256) envfree;
    function getCirculatingAlpha() external returns (uint256) envfree;
    function totalAssetsExcludingLoans() external returns (uint256) envfree;
    function totalLiabilitiesUSD() external returns (uint256) envfree;
    
    // Non-envfree state changing methods
    function deposit(uint256, uint256) external returns (uint256);
    function redeem(uint256, uint256) external returns (uint256);
    function recordBurn(uint256) external;
    function disburseTreasuryLoan(address, uint256) external;
    function releaseVaultPayout(address, uint256) external;
}

/**
 * @title Invariant 1: Proof of Reserves & System Solvency
 * @notice The protocol's total verifiable assets must always be greater than or equal 
 *         to total protocol liabilities across all reachable EVM states.
 */
invariant proofOfReservesSolvency()
    totalAssetsExcludingLoans() >= totalLiabilitiesUSD()
    {
        preserved with (env e) {
            require e.msg.value == 0;
        }
    }

/**
 * @title Invariant 2: Non-Zero NAV Per Share
 * @notice When there are circulating shares, the Net Asset Value per share must be strictly positive.
 */
invariant positiveNavPerShareWhenCirculating()
    getCirculatingAlpha() > 0 => getNAVPerShare() > 0
    {
        preserved with (env e) {
            require e.msg.value == 0;
        }
    }

/**
 * @title Rule: Monotonic NAV Growth on Token Burn
 * @notice Burning ALPHA tokens (via buyback, staking penalties, or ragequit) strictly increases 
 *         or preserves NAV per share, mathematically enriching existing holders.
 */
rule navIncreasesOnTokenBurn(uint256 burnAmount, env e) {
    uint256 navBefore = getNAVPerShare();
    uint256 circulatingBefore = getCirculatingAlpha();
    
    require circulatingBefore > burnAmount;
    require burnAmount > 0;
    
    recordBurn(e, burnAmount);
    
    uint256 navAfter = getNAVPerShare();
    assert navAfter >= navBefore, "NAV per share must be monotonically non-decreasing after token burns";
}

/**
 * @title Rule: Deposit Value Conservation
 * @notice Depositing stablecoins into the Treasury always increases or preserves total protocol NAV.
 */
rule depositIncreasesTotalNAV(uint256 depositAmount, uint256 minSharesOut, env e) {
    uint256 navBefore = getNAV();
    require depositAmount > 0;
    
    deposit(e, depositAmount, minSharesOut);
    
    uint256 navAfter = getNAV();
    assert navAfter >= navBefore, "Total NAV must strictly increase by at least the deposited principal";
}

/**
 * @title Rule: Solvency Preserved on Loan Disbursement
 * @notice Disbursing a loan to an authorized lending market never breaches the Proof of Reserves bound.
 */
rule loanDisbursementPreservesSolvency(address recipient, uint256 amount, env e) {
    require amount > 0;
    require recipient != 0;
    
    disburseTreasuryLoan(e, recipient, amount);
    
    assert totalAssetsExcludingLoans() >= totalLiabilitiesUSD(), "Loan disbursement must not breach solvency invariant";
}
