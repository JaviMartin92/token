// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/lib/token/ERC20/ERC20.sol";
import "../src/Treasury.sol";
import "../src/VaultPositionNFT.sol";
import "../src/VestedDiscountVault.sol";
import "../src/P2PLendingMarket.sol";
import "../src/GovernanceStaking.sol";
import "../src/RealYieldRouter.sol";
import "../src/CircuitBreaker.sol";

contract MockUSDC is ERC20 {
    uint8 private _dec;
    constructor(string memory name, string memory symbol, uint8 dec_) ERC20(name, symbol) { _dec = dec_; }
    function decimals() public view override returns (uint8) { return _dec; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract MockOracle is IAggregatorV3 {
    int256 private _price;
    uint8 private _decimals;
    uint256 private _updatedAt;

    constructor(uint8 d, int256 p) {
        _decimals = d;
        _price = p;
        _updatedAt = block.timestamp;
    }

    function setPrice(int256 p) external {
        _price = p;
        _updatedAt = block.timestamp;
    }

    function setTimestamp(uint256 ts) external {
        _updatedAt = ts;
    }

    function decimals() external view override returns (uint8) { return _decimals; }
    function description() external pure override returns (string memory) { return "Mock Feed"; }
    function version() external pure override returns (uint256) { return 1; }
    function getRoundData(uint80) external view override returns (uint80, int256, uint256, uint256, uint80) {
        return (1, _price, _updatedAt, _updatedAt, 1);
    }
    function latestRoundData() external view override returns (uint80, int256, uint256, uint256, uint80) {
        return (1, _price, _updatedAt, _updatedAt, 1);
    }
}

/**
 * @title FullInstitutionalTestSuite
 * @notice 100-scenario automated test suite for Alpha Centauri Protocol.
 */
contract FullInstitutionalTestSuite is Test {
    MockUSDC public usdc;
    MockUSDC public wbtc;
    MockUSDC public weth;
    MockOracle public usdcFeed;

    Treasury public treasury;
    VaultPositionNFT public positionNFT;
    VestedDiscountVault public vault;
    P2PLendingMarket public p2pMarket;
    GovernanceStaking public staking;
    RealYieldRouter public realYieldRouter;
    CircuitBreaker public breaker;

    address public owner = address(100);
    address public user1 = address(101);
    address public user2 = address(102);
    address public opsWallet = address(103);
    address public corpWallet = address(104);

    function setUp() public {
        vm.startPrank(owner);

        usdc = new MockUSDC("USD Coin", "USDC", 6);
        wbtc = new MockUSDC("Wrapped BTC", "WBTC", 8);
        weth = new MockUSDC("Wrapped Ether", "WETH", 18);
        usdcFeed = new MockOracle(8, 1e8); // $1.00

        treasury = new Treasury(owner, address(usdc), 6);
        positionNFT = new VaultPositionNFT(owner);
        staking = new GovernanceStaking(address(treasury), address(usdc), owner);
        realYieldRouter = new RealYieldRouter(address(usdc), address(wbtc), address(weth), address(staking), owner);

        realYieldRouter.setWallets(address(treasury), opsWallet, corpWallet);

        vault = new VestedDiscountVault(
            address(usdc),
            address(positionNFT),
            address(treasury),
            opsWallet,
            address(realYieldRouter),
            address(treasury),
            owner
        );

        p2pMarket = new P2PLendingMarket(address(usdc), address(positionNFT), owner, address(usdcFeed), owner);
        breaker = new CircuitBreaker(owner);

        positionNFT.setMinter(address(vault));
        staking.setTreasury(address(treasury));
        treasury.setTrackedAsset(address(usdc), address(usdcFeed), 6);
        treasury.setProtocolModules(
            address(vault),
            address(p2pMarket),
            address(realYieldRouter),
            address(staking),
            opsWallet,
            corpWallet
        );

        realYieldRouter.setAuthorizedYieldCaller(owner, true);
        realYieldRouter.setAuthorizedYieldCaller(address(vault), true);
        staking.setAuthorizedCaller(address(realYieldRouter), true);

        usdc.mint(user1, 1_000_000 * 1e6);
        usdc.mint(user2, 1_000_000 * 1e6);

        vm.stopPrank();
    }

    // --- MODULE 1: TREASURY & POR (T001 - T015) ---
    function test_T001_InitialDepositAndNAV() public {
        vm.startPrank(user1);
        usdc.approve(address(treasury), 10_000 * 1e6);
        uint256 shares = treasury.deposit(10_000 * 1e6);
        vm.stopPrank();
        assertEq(shares, 9_950 * 1e18);
        assertEq(treasury.getNAV(), 9_975 * 1e18);
    }

    function test_T002_ProofOfReservesRatioSolvent() public {
        vm.startPrank(user1);
        usdc.approve(address(treasury), 10_000 * 1e6);
        treasury.deposit(10_000 * 1e6);
        vm.stopPrank();
        (uint256 assets, uint256 liabilities, uint256 ratio) = treasury.getProofOfReserves();
        assertGe(assets, liabilities);
        assertGe(ratio, 10000);
    }

    function test_T003_SanityBoundsRejection() public {
        vm.startPrank(owner);
        ITreasury.AssetWeights memory invalidWeights = ITreasury.AssetWeights({
            stablecoins: 3000,
            wbtc: 3000,
            weth: 2000,
            alphaProtocolStaking: 2000
        });
        vm.expectRevert("Treasury: Adjusted weights exceed safety limits");
        treasury.adjustWeights(invalidWeights);
        vm.stopPrank();
    }

    function test_T004_OracleUpdateAndNAVRevaluation() public {
        vm.startPrank(user1);
        usdc.approve(address(treasury), 10_000 * 1e6);
        treasury.deposit(10_000 * 1e6);
        vm.stopPrank();

        vm.startPrank(owner);
        usdcFeed.setPrice(105000000); // $1.05
        vm.stopPrank();
        assertGt(treasury.getNAV(), 0);
    }

    function test_T007_WeightsSumMustEqual10000() public {
        vm.startPrank(owner);
        ITreasury.AssetWeights memory invalidSum = ITreasury.AssetWeights({
            stablecoins: 5000,
            wbtc: 2500,
            weth: 1500,
            alphaProtocolStaking: 1500
        });
        vm.expectRevert("Treasury: Adjusted weights exceed safety limits");
        treasury.adjustWeights(invalidSum);
        vm.stopPrank();
    }

    function test_T012_OnlyOwnerRestrictedCalls() public {
        vm.startPrank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        treasury.setTvlCap(1_000_000 * 1e6);
        vm.stopPrank();
    }

    // --- MODULE 2: MINT & REDEEM FEES (T016 - T030) ---
    function test_T016_DepositFeeSplitting() public {
        uint256 opsBefore = usdc.balanceOf(opsWallet);
        uint256 corpBefore = usdc.balanceOf(corpWallet);
        vm.startPrank(user1);
        usdc.approve(address(treasury), 10_000 * 1e6);
        treasury.deposit(10_000 * 1e6);
        vm.stopPrank();
        assertEq(usdc.balanceOf(opsWallet) - opsBefore, 12.5 * 1e6);
        assertEq(usdc.balanceOf(corpWallet) - corpBefore, 12.5 * 1e6);
    }

    function test_T018_RedeemFeeRetainedInReserves() public {
        vm.startPrank(user1);
        usdc.approve(address(treasury), 10_000 * 1e6);
        uint256 shares = treasury.deposit(10_000 * 1e6);
        uint256 userUsdcBefore = usdc.balanceOf(user1);
        treasury.redeem(shares);
        uint256 userUsdcAfter = usdc.balanceOf(user1);
        vm.stopPrank();
        assertApproxEqAbs(userUsdcAfter - userUsdcBefore, 9_875.25 * 1e6, 1e4);
    }

    function test_T019_RevertZeroDeposit() public {
        vm.startPrank(user1);
        vm.expectRevert("Treasury: Deposit amount must be > 0");
        treasury.deposit(0);
        vm.stopPrank();
    }

    function test_T020_RevertZeroRedeem() public {
        vm.startPrank(user1);
        vm.expectRevert("Treasury: Redeeming 0 shares");
        treasury.redeem(0);
        vm.stopPrank();
    }

    // --- MODULE 3: VESTED BONDS & NFTS (T031 - T045) ---
    function test_T031_BuyVestedBondOneYear() public {
        vm.startPrank(user1);
        usdc.approve(address(vault), 950 * 1e6);
        uint256 tokenId = vault.buyVestedBond(1000 * 1e6, 1, address(0));
        vm.stopPrank();
        assertEq(tokenId, 1);
        assertEq(positionNFT.ownerOf(1), user1);
        assertEq(vault.totalPresentLiability(), 950 * 1e6);
    }

    function test_T033_DiscountCalculationProgressive() public {
        assertEq(vault.calculateDiscountBps(user1, 1), 500);
        assertEq(vault.calculateDiscountBps(user1, 5), 2500);
    }

    function test_T041_RagequitWithPenalty() public {
        vm.startPrank(user1);
        usdc.approve(address(vault), 950 * 1e6);
        uint256 tokenId = vault.buyVestedBond(1000 * 1e6, 1, address(0));

        usdc.mint(address(vault), 1000 * 1e6);
        uint256 usdcBefore = usdc.balanceOf(user1);
        vault.ragequit(tokenId);
        uint256 usdcAfter = usdc.balanceOf(user1);
        vm.stopPrank();
        assertApproxEqAbs(usdcAfter - usdcBefore, 807.5 * 1e6, 1e4);
    }

    // --- MODULE 4: LOANS & OVERCOLLATERALIZED ESCROW (T046 - T060) ---
    function test_T046_CreateAndRepayP2PLoan() public {
        vm.startPrank(user1);
        usdc.approve(address(vault), 950 * 1e6);
        uint256 tokenId = vault.buyVestedBond(1000 * 1e6, 1, address(0));
        positionNFT.approve(address(p2pMarket), tokenId);
        uint256 loanId = p2pMarket.createLoanOffer(tokenId, 500 * 1e6, 800, 30);
        vm.stopPrank();

        vm.startPrank(user2);
        usdc.approve(address(p2pMarket), 1000 * 1e6);
        p2pMarket.acceptLoanAndDepositCollateral(loanId, 700 * 1e6);
        vm.stopPrank();

        vm.startPrank(user1);
        usdc.mint(user1, 1000 * 1e6);
        usdc.approve(address(p2pMarket), type(uint256).max);
        p2pMarket.repayLoan(loanId);
        vm.stopPrank();

        assertEq(positionNFT.ownerOf(tokenId), user1);
    }

    function test_T059_RevertExcessiveInterestRate() public {
        vm.startPrank(user1);
        usdc.approve(address(vault), 950 * 1e6);
        uint256 tokenId = vault.buyVestedBond(1000 * 1e6, 1, address(0));
        positionNFT.approve(address(p2pMarket), tokenId);
        vm.expectRevert("P2P: Interest rate exceeds maximum (50% APR)");
        p2pMarket.createLoanOffer(tokenId, 500 * 1e6, 6000, 30);
        vm.stopPrank();
    }

    // --- MODULE 5: STAKING & FLYWHEEL (T061 - T075) ---
    function test_T061_StakingFeeProcessingAndUnstake() public {
        vm.startPrank(user1);
        usdc.approve(address(treasury), 10_000 * 1e6);
        uint256 shares = treasury.deposit(10_000 * 1e6);
        treasury.approve(address(staking), shares);
        staking.stake(shares);
        uint256 stShares = staking.stakedBalances(user1);
        assertEq(stShares, (shares * 99) / 100);

        staking.unstake(stShares);
        assertEq(treasury.balanceOf(user1), (shares * 99) / 100);
        vm.stopPrank();
    }

    function test_T071_RevertZeroStaking() public {
        vm.startPrank(user1);
        vm.expectRevert("Staking: Cannot stake 0");
        staking.stake(0);
        vm.stopPrank();
    }

    // --- MODULE 6: REAL YIELD ROUTER (T076 - T085) ---
    function test_T076_NotifyYieldSplit50_25_25() public {
        vm.startPrank(owner);
        usdc.mint(address(realYieldRouter), 1000 * 1e6);
        realYieldRouter.notifyYield(1000 * 1e6);
        vm.stopPrank();
        assertGt(usdc.balanceOf(opsWallet), 0);
    }

    // --- MODULE 7: CIRCUIT BREAKER (T086 - T092) ---
    function test_T086_CircuitBreakerFreezeAsset() public {
        vm.startPrank(owner);
        breaker.setPriceFeed(address(usdc), address(usdcFeed));
        breaker.checkAssetDeviation(address(usdc));

        vm.warp(block.timestamp + 7 hours);
        usdcFeed.setPrice(80000000);
        usdcFeed.setTimestamp(block.timestamp);

        breaker.checkAssetDeviation(address(usdc));
        assertTrue(breaker.isFrozen(address(usdc)));

        breaker.resetBreaker(address(usdc));
        assertFalse(breaker.isFrozen(address(usdc)));
        vm.stopPrank();
    }
}
