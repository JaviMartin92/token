// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../src/ProtocolAddressProvider.sol";
import "../src/AlphaToken.sol";
import "../src/AlphaVault.sol";
import "../src/OracleHub.sol";
import "../src/TreasuryManager.sol";
import "../src/TreasuryProxy.sol";
import "../src/ProtocolTokenomicsEngine.sol";
import "../src/CommunityYieldVault.sol";
import "../src/GovernanceStaking.sol";
import "../src/RealYieldRouter.sol";
import "../src/VestedDiscountVault.sol";
import "../src/VaultPositionNFT.sol";
import "../src/P2PLendingMarket.sol";
import "../src/ProtocolRoles.sol";
import "../src/interfaces/IProtocolErrors.sol";
import "../src/adapters/CompliantTreasuryGateway.sol";

contract MockERC20PR1 is ERC20 {
    uint8 private immutable _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockFeedPR1 {
    int256 private immutable _answer;
    uint8 private immutable _decimals;

    constructor(int256 answer_, uint8 decimals_) {
        _answer = answer_;
        _decimals = decimals_;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, _answer, block.timestamp, block.timestamp, 1);
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }
}

/**
 * @title SecurityRemediationPR1Test
 * @notice Regression suite for PR-1: C-01 (redeemFor KYC bypass), C-02 (bond liability
 *         understatement) and C-03 (treasury credit cap + circular collateral).
 */
contract SecurityRemediationPR1Test is Test {
    uint256 internal constant SEED_ASSETS = 1_100_000 * 1e6;
    uint256 internal constant SEED_SHARES = 1_000_000 * 1e18;
    uint256 internal constant FACILITY_CAP_BPS = 2000;

    ProtocolAddressProvider internal provider;
    AlphaToken internal alphaToken;
    AlphaVault internal vault;
    OracleHub internal oracleHub;
    TreasuryManager internal manager;
    RealYieldRouter internal router;
    ProtocolTokenomicsEngine internal engine;
    CommunityYieldVault internal communityVault;
    GovernanceStaking internal staking;
    VestedDiscountVault internal vestedVault;
    VaultPositionNFT internal nft;
    P2PLendingMarket internal p2pMarket;
    CompliantTreasuryGateway internal gateway;

    MockERC20PR1 internal usdc;
    MockERC20PR1 internal wbtc;

    address internal admin = address(0xA11CE);
    address internal investor = address(0x1);
    address internal attacker = address(0xBAD);
    address internal beneficiary = address(0xB0B);

    function setUp() public {
        vm.startPrank(admin);

        usdc = new MockERC20PR1("USDC", "USDC", 6);
        wbtc = new MockERC20PR1("WBTC", "WBTC", 8);
        MockFeedPR1 usdcFeed = new MockFeedPR1(1_00000000, 8);
        MockFeedPR1 btcFeed = new MockFeedPR1(60_000_00000000, 8);

        provider = new ProtocolAddressProvider(admin);

        alphaToken = new AlphaToken(provider, admin);
        provider.setAddress(provider.ID_ALPHA_TOKEN(), address(alphaToken));

        vault = new AlphaVault(provider, admin);
        provider.setAddress(provider.ID_ALPHA_VAULT(), address(vault));

        oracleHub = new OracleHub(provider, admin);
        provider.setAddress(provider.ID_ORACLE_HUB(), address(oracleHub));
        oracleHub.setTrackedAsset(address(usdc), address(usdcFeed), address(0), 6);
        oracleHub.setTrackedAsset(address(wbtc), address(btcFeed), address(0), 8);

        engine = new ProtocolTokenomicsEngine(admin);
        provider.setAddress(keccak256("TOKENOMICS_ENGINE"), address(engine));

        TreasuryManager logic = new TreasuryManager(provider);
        TreasuryProxy proxy = new TreasuryProxy(address(logic));
        manager = TreasuryManager(payable(address(proxy)));
        manager.initialize(admin, address(usdc), 6);
        provider.setAddress(provider.ID_TREASURY_MANAGER(), address(manager));

        communityVault = new CommunityYieldVault(address(usdc), admin);
        provider.setAddress(provider.ID_COMMUNITY_YIELD_VAULT(), address(communityVault));

        staking = new GovernanceStaking(address(alphaToken), address(usdc), admin);
        staking.setTreasury(address(manager));
        staking.setProtocolVaults(address(communityVault));
        provider.setAddress(provider.ID_GOVERNANCE_STAKING(), address(staking));

        router = new RealYieldRouter(address(usdc), address(wbtc), address(0), address(staking), admin);
        router.setProtocolVaults(address(vault), address(communityVault));
        router.setAuthorizedYieldCaller(address(manager), true);
        provider.setAddress(provider.ID_REAL_YIELD_ROUTER(), address(router));

        nft = new VaultPositionNFT(admin);
        vestedVault = new VestedDiscountVault(
            address(usdc),
            address(nft),
            address(manager),
            address(router),
            address(alphaToken),
            admin
        );
        vestedVault.setTokenomicsEngine(address(engine));
        vestedVault.setGovernanceStaking(address(staking));
        router.setAuthorizedYieldCaller(address(vestedVault), true);
        provider.setAddress(provider.ID_VESTED_VAULT(), address(vestedVault));

        p2pMarket = new P2PLendingMarket(address(usdc), address(nft), address(router), address(oracleHub), admin);
        p2pMarket.setTreasury(address(manager));
        p2pMarket.setAlphaToken(address(alphaToken));
        p2pMarket.setWbtcToken(address(wbtc));
        provider.setAddress(provider.ID_P2P_MARKET(), address(p2pMarket));

        nft.setMinter(address(vestedVault));

        alphaToken.grantRole(ProtocolRoles.MINTER_ROLE, address(manager));
        alphaToken.grantRole(ProtocolRoles.BURNER_ROLE, address(manager));
        alphaToken.grantRole(ProtocolRoles.MINTER_ROLE, admin);
        vault.grantRole(ProtocolRoles.VAULT_MANAGER_ROLE, address(manager));
        vault.grantRole(ProtocolRoles.VAULT_MANAGER_ROLE, address(router));

        manager.grantRole(ProtocolRoles.COMPLIANCE_ROLE, admin);

        vm.stopPrank();
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    /// @dev Seeds NAV = 1.1 USD/share: 1.1M of reserves against 1M circulating ALPHA.
    function _seedTreasury() internal {
        usdc.mint(address(vault), SEED_ASSETS);
        vm.prank(admin);
        alphaToken.mint(investor, SEED_SHARES);
    }

    function _buyBond(uint256 principal, uint256 lockYears) internal returns (uint256 tokenId) {
        usdc.mint(investor, principal);
        vm.startPrank(investor);
        usdc.approve(address(vestedVault), principal);
        tokenId = vestedVault.buyVestedBond(principal, lockYears, address(0));
        vm.stopPrank();
    }

    // =========================================================================
    // C-01: redeemFor must not let an unverified caller burn against a KYC'd beneficiary
    // =========================================================================

    function test_C01_RedeemForRejectsUnauthorizedCaller() public {
        _seedTreasury();

        // The attacker holds shares but is not the beneficiary. Give them a balance so the
        // old vulnerable path would have burned it.
        vm.prank(admin);
        alphaToken.mint(attacker, 100 * 1e18);

        vm.startPrank(admin);
        manager.setKYCForced(true);
        manager.setKYCStatus(beneficiary, true);
        vm.stopPrank();

        vm.prank(attacker);
        vm.expectRevert(
            abi.encodeWithSelector(TreasuryManager.UnauthorizedRedemption.selector, attacker, beneficiary)
        );
        manager.redeemFor(beneficiary, attacker, 100 * 1e18, 0);
    }

    function test_C01_RedeemForSelfStillWorks() public {
        _seedTreasury();

        address user = address(0xCAFE);
        vm.prank(admin);
        alphaToken.mint(user, 1_000 * 1e18);

        vm.startPrank(admin);
        manager.setKYCForced(true);
        manager.setKYCStatus(user, true);
        vm.stopPrank();

        vm.startPrank(user);
        alphaToken.approve(address(manager), 1_000 * 1e18);
        uint256 assets = manager.redeemFor(user, user, 1_000 * 1e18, 0);
        vm.stopPrank();
        assertGt(assets, 0);
        assertEq(alphaToken.balanceOf(user), 0);
    }

    function test_C01_GatewayRedemptionStillWorks() public {
        _seedTreasury();

        address institution = address(0x1234);
        gateway = new CompliantTreasuryGateway(address(manager), address(alphaToken), admin);

        vm.startPrank(admin);
        manager.setKYCForced(true);
        // Only the gateway is whitelisted in the core treasury.
        manager.setKYCStatus(address(gateway), true);
        gateway.setKYCStatus(institution, true);
        vm.stopPrank();

        uint256 amount = 1_000 * 1e6;
        usdc.mint(institution, amount);

        vm.startPrank(institution);
        usdc.approve(address(gateway), amount);
        uint256 shares = gateway.depositCompliant(amount, 0);
        assertGt(shares, 0);

        vm.roll(block.number + 1);
        alphaToken.approve(address(gateway), shares);
        uint256 assets = gateway.redeemCompliant(shares, 0);
        vm.stopPrank();

        assertGt(assets, 0);
        assertEq(alphaToken.balanceOf(institution), 0);
    }

    // =========================================================================
    // C-02: linear accretion to principal, no cliff, no NAV change on settlement
    // =========================================================================

    function test_C02_LiabilityAccretesLinearlyToPrincipal() public {
        _seedTreasury();

        uint256 principal = 1_000 * 1e6;
        uint256 discounted = 950 * 1e6; // 5% discount for a 1-year lock
        uint256 tokenId = _buyBond(principal, 1);

        uint256 start = block.timestamp;
        uint256 expiry = start + 365 days;

        assertEq(vestedVault.totalPresentLiability(), discounted * 1e12);
        assertEq(vestedVault.totalInvested(), principal);
        assertEq(vestedVault.discountedOutstanding(), discounted);

        // Halfway through the lock the liability is halfway between price and principal.
        vm.warp(start + (365 days / 2));
        assertApproxEqAbs(vestedVault.totalPresentLiability(), (discounted + (principal - discounted) / 2) * 1e12, 2e12);

        // At maturity the linear curve tops out at principal; accrue() moves the bond into
        // the fixed bucket without a material jump.
        vm.warp(expiry);
        uint256 preAccrual = vestedVault.totalPresentLiability();
        vestedVault.accrue();
        uint256 postAccrual = vestedVault.totalPresentLiability();

        assertEq(postAccrual, principal * 1e12);
        assertLe(preAccrual, postAccrual);
        assertLe(postAccrual - preAccrual, 1e12); // <= 1 stablecoin micro-unit of rounding
        assertEq(vestedVault.settledPrincipal(), principal);
        assertEq(vestedVault.discountedOutstanding(), 0);

        // Claiming settles the debt and returns the principal to the holder.
        vm.prank(investor);
        vestedVault.claimMatured(tokenId);

        assertEq(vestedVault.totalPresentLiability(), 0);
        assertEq(vestedVault.totalInvested(), 0);
        // The buyer spent `discounted` and recovered the full `principal`.
        assertEq(usdc.balanceOf(investor), principal + (principal - discounted));
    }

    function test_C02_ClaimLeavesNavUnchanged() public {
        _seedTreasury();

        uint256 principal = 1_000 * 1e6;
        uint256 tokenId = _buyBond(principal, 1);

        vm.warp(block.timestamp + 365 days);
        vestedVault.accrue();

        uint256 navBefore = manager.getNAVPerShare();
        uint256 assetsBefore = manager.getTotalNavUSD();

        vm.prank(investor);
        vestedVault.claimMatured(tokenId);

        uint256 navAfter = manager.getNAVPerShare();
        uint256 assetsAfter = manager.getTotalNavUSD();

        // Assets and liabilities both fall by the principal: NAV per share is unchanged.
        assertEq(assetsBefore - assetsAfter, principal * 1e12);
        assertApproxEqAbs(navAfter, navBefore, 1e6);
        assertEq(vestedVault.totalPresentLiability(), 0);
    }

    function test_C02_LiabilityNeverExceedsPrincipalAndSolvencyHolds() public {
        _seedTreasury();

        uint256 principal = 1_000 * 1e6;
        _buyBond(principal, 3);

        uint256 cap = principal * 1e12;
        for (uint256 i = 0; i < 6; ++i) {
            vm.warp(block.timestamp + 180 days);
            vestedVault.accrue();
            assertLe(vestedVault.totalPresentLiability(), cap);

            (uint256 assets, uint256 liabilities, uint256 ratio) = manager.getProofOfReserves();
            assertGe(assets, liabilities);
            assertGe(ratio, 10000);
        }
    }

    // =========================================================================
    // C-03: aggregate treasury credit cap and reflexive collateral haircuts
    // =========================================================================

    function test_C03_TreasuryLoanCapEnforced() public {
        _seedTreasury();

        (uint256 limit, uint256 outstanding, uint256 capacity) = manager.treasuryLoanLimits();
        assertEq(limit, (SEED_ASSETS * FACILITY_CAP_BPS) / 10000);
        assertEq(outstanding, 0);
        assertEq(capacity, limit);

        address recipient = address(0xCAFE);
        vm.prank(admin);
        manager.disburseTreasuryLoan(recipient, limit);
        assertEq(usdc.balanceOf(recipient), limit);
        assertEq(manager.treasuryLoansOutstanding(), limit);

        (, outstanding, capacity) = manager.treasuryLoanLimits();
        assertEq(outstanding, limit);
        assertEq(capacity, 0);

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(TreasuryManager.TreasuryLoanCapExceeded.selector, 1, 0));
        manager.disburseTreasuryLoan(recipient, 1);
    }

    function test_C03_RepaymentRetiresOutstandingCredit() public {
        _seedTreasury();

        address recipient = address(0xCAFE);
        vm.prank(admin);
        manager.disburseTreasuryLoan(recipient, 100_000 * 1e6);

        vm.prank(address(p2pMarket));
        manager.recordTreasuryLoanRepayment(40_000 * 1e6);

        assertEq(manager.treasuryLoansOutstanding(), 60_000 * 1e6);
    }

    function test_C03_UnauthorizedRepaymentRecorderReverts() public {
        vm.prank(attacker);
        vm.expectRevert(TreasuryManager.UnauthorizedDisburseLoans.selector);
        manager.recordTreasuryLoanRepayment(1);
    }

    function test_C03_UnauthorizedDisbursementReverts() public {
        vm.prank(attacker);
        vm.expectRevert(TreasuryManager.UnauthorizedDisburseLoans.selector);
        manager.disburseTreasuryLoan(attacker, 1);
    }

    function test_C03_CapParameterHasHardCeiling() public {
        vm.prank(admin);
        vm.expectRevert(IProtocolErrors.InvalidParameters.selector);
        manager.setTreasuryLoanCapBps(5001);

        vm.prank(admin);
        manager.setTreasuryLoanCapBps(5000);
        assertEq(manager.treasuryLoanCapBps(), 5000);
    }

    function test_C03_AlphaCollateralHaircutReducesBorrowingPower() public {
        _seedTreasury();

        address borrower = address(0xBEEF);
        vm.prank(admin);
        alphaToken.mint(borrower, 1_000 * 1e18);

        vm.startPrank(borrower);
        alphaToken.approve(address(p2pMarket), 1_000 * 1e18);

        // 1,000 ALPHA at the current NAV, with the 50% haircut and the 50% ALPHA LTV.
        uint256 nav = manager.getNAVPerShare();
        uint256 collateralUSD = (((1_000 * 1e18 * nav) / 1e30) * p2pMarket.alphaCollateralHaircutBps()) / 10000;
        uint256 maxBorrow = (collateralUSD * 5000) / 10000;
        vm.expectRevert(abi.encodeWithSelector(P2PLendingMarket.MaxLTVExceeded.selector, 300 * 1e6, maxBorrow));
        p2pMarket.borrowFromTreasuryWithAlpha(1_000 * 1e18, 300 * 1e6, 30);

        p2pMarket.borrowFromTreasuryWithAlpha(1_000 * 1e18, maxBorrow, 30);
        vm.stopPrank();

        assertEq(usdc.balanceOf(borrower), (maxBorrow * 9950) / 10000);
        assertEq(manager.treasuryLoansOutstanding(), maxBorrow);
        assertEq(p2pMarket.treasuryCircularDebtUSD(), maxBorrow);
    }

    function test_C03_BondCollateralHaircutReducesBorrowingPower() public {
        _seedTreasury();

        uint256 tokenId = _buyBond(1_000 * 1e6, 1);

        // Discounted bond = 950; 50% haircut => 475; 70% LTV => 332.5.
        uint256 bondCollateral = (950 * 1e6 * p2pMarket.bondCollateralHaircutBps()) / 10000;
        uint256 maxBorrow = (bondCollateral * 7000) / 10000;

        vm.startPrank(investor);
        nft.approve(address(p2pMarket), tokenId);

        vm.expectRevert(abi.encodeWithSelector(P2PLendingMarket.MaxLTVExceeded.selector, 350 * 1e6, maxBorrow));
        p2pMarket.borrowFromTreasury(tokenId, 350 * 1e6, 30);

        p2pMarket.borrowFromTreasury(tokenId, 300 * 1e6, 30);
        vm.stopPrank();

        assertEq(nft.ownerOf(tokenId), address(p2pMarket));
        assertEq(manager.treasuryLoansOutstanding(), 300 * 1e6);
        assertEq(p2pMarket.treasuryCircularDebtUSD(), 300 * 1e6);
    }

    function test_C03_CircularCollateralCapEnforced() public {
        _seedTreasury();

        // Tighten the reflexive-collateral budget to 0.1% of the facility limit.
        vm.prank(admin);
        p2pMarket.setCollateralRiskParams(5000, 8500, 5000, 10);

        uint256 tokenId = _buyBond(1_000 * 1e6, 1);

        (uint256 facilityLimit,,) = manager.treasuryLoanLimits();
        uint256 circularCapacity = (facilityLimit * 10) / 10000;

        vm.startPrank(investor);
        nft.approve(address(p2pMarket), tokenId);

        vm.expectRevert(
            abi.encodeWithSelector(P2PLendingMarket.CircularCollateralCapExceeded.selector, 300 * 1e6, circularCapacity)
        );
        p2pMarket.borrowFromTreasury(tokenId, 300 * 1e6, 30);

        // 200 USD fits inside the reduced circular budget.
        p2pMarket.borrowFromTreasury(tokenId, 200 * 1e6, 30);
        vm.stopPrank();

        assertEq(p2pMarket.treasuryCircularDebtUSD(), 200 * 1e6);
    }
}
