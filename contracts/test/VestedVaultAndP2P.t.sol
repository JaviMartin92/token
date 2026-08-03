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

contract MockToken is ERC20 {
    uint8 private _dec;
    constructor(string memory name, string memory symbol, uint8 dec_) ERC20(name, symbol) { _dec = dec_; }
    function decimals() public view override returns (uint8) { return _dec; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract MockAggregator is IAggregatorV3 {
    int256 private _price;
    uint8 private _decimals;

    constructor(uint8 decimals_, int256 price_) {
        _decimals = decimals_;
        _price = price_;
    }

    function setPrice(int256 price_) external {
        _price = price_;
    }

    function decimals() external view override returns (uint8) { return _decimals; }
    function description() external pure override returns (string memory) { return "Mock Feed"; }
    function version() external pure override returns (uint256) { return 1; }
    function getRoundData(uint80) external view override returns (uint80, int256, uint256, uint256, uint80) {
        return (1, _price, block.timestamp, block.timestamp, 1);
    }
    function latestRoundData() external view override returns (uint80, int256, uint256, uint256, uint80) {
        return (1, _price, block.timestamp, block.timestamp, 1);
    }
}

contract VestedVaultAndP2PTest is Test {
    MockToken public usdc;
    MockToken public alphaToken;
    MockToken public wbtc;
    MockAggregator public usdcFeed;

    Treasury public treasury;
    VaultPositionNFT public positionNFT;
    VestedDiscountVault public vault;
    P2PLendingMarket public p2pMarket;
    GovernanceStaking public staking;
    RealYieldRouter public realYieldRouter;

    address public owner = address(100);
    address public buyer = address(101);
    address public borrower = address(102);
    address public referrer = address(103);
    address public bunker = address(104);
    address public ops = address(105);
    address public feeCollector = address(106);

    function setUp() public {
        vm.startPrank(owner);

        usdc = new MockToken("USD Coin", "USDC", 6);
        alphaToken = new MockToken("Alpha Centauri", "ALPHA", 18);
        wbtc = new MockToken("Wrapped BTC", "WBTC", 8);
        usdcFeed = new MockAggregator(8, 100000000); // $1.00

        treasury = new Treasury(owner, address(usdc), 6);
        treasury.setTrackedAsset(address(usdc), address(usdcFeed), 6);

        positionNFT = new VaultPositionNFT(owner);
        staking = new GovernanceStaking(address(alphaToken), address(usdc), owner);
        realYieldRouter = new RealYieldRouter(address(usdc), address(wbtc), address(0), address(staking), owner);

        vault = new VestedDiscountVault(
            address(usdc),
            address(positionNFT),
            bunker,
            ops,
            address(realYieldRouter),
            address(alphaToken),
            owner
        );

        positionNFT.setMinter(address(vault));
        staking.setTreasury(address(treasury));
        staking.setAuthorizedCaller(address(realYieldRouter), true);
        realYieldRouter.setAuthorizedYieldCaller(address(vault), true);
        realYieldRouter.setAuthorizedYieldCaller(address(staking), true);
        realYieldRouter.setAuthorizedYieldCaller(owner, true);

        p2pMarket = new P2PLendingMarket(
            address(usdc),
            address(positionNFT),
            feeCollector,
            address(usdcFeed),
            owner
        );

        vm.stopPrank();

        // Mint initial tokens (USDC = 6 decimals, ALPHA = 18 decimals)
        usdc.mint(buyer, 100_000 * 10**6);
        usdc.mint(borrower, 100_000 * 10**6);
        alphaToken.mint(buyer, 10_000 * 10**18);
        alphaToken.mint(owner, 50_000 * 10**18);

        vm.prank(buyer);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(buyer);
        usdc.approve(address(p2pMarket), type(uint256).max);

        vm.prank(borrower);
        usdc.approve(address(p2pMarket), type(uint256).max);
    }

    function testVestedDiscountVaultBondPurchaseAndReferral() public {
        uint256 principal = 10_000 * 10**6;

        uint256 expectedDiscount = vault.calculateDiscountBps(buyer, 3);
        assertEq(expectedDiscount, 1500); // 3 yrs * 500 Bps = 1500 (15%)

        uint256 discountedPrice = (principal * (10000 - 1500)) / 10000;
        uint256 expectedRefReward = (discountedPrice * 150) / 10000;

        uint256 buyerBalBefore = usdc.balanceOf(buyer);
        uint256 refBalBefore = usdc.balanceOf(referrer);

        vm.prank(buyer);
        uint256 tokenId = vault.buyVestedBond(principal, 3, referrer);

        assertEq(tokenId, 1);
        assertEq(positionNFT.ownerOf(tokenId), buyer);

        assertEq(usdc.balanceOf(referrer) - refBalBefore, expectedRefReward);
        assertEq(buyerBalBefore - usdc.balanceOf(buyer), discountedPrice);

        VaultPositionNFT.Position memory pos = positionNFT.getPosition(tokenId);
        assertEq(pos.principalAmount, principal);
        assertEq(pos.discountedPricePaid, discountedPrice);
        assertEq(pos.lockYears, 3);
        assertEq(pos.expirationTimestamp, block.timestamp + 3 * 365 days);
    }

    function testRagequitPenaltySplits() public {
        uint256 principal = 10_000 * 10**6;
        vm.prank(buyer);
        uint256 tokenId = vault.buyVestedBond(principal, 2, address(0));

        usdc.mint(address(treasury), principal);

        VaultPositionNFT.Position memory pos = positionNFT.getPosition(tokenId);
        uint256 paid = pos.discountedPricePaid;

        uint256 penaltyBps = vault.RAGEQUIT_PENALTY_BPS(); // 1500 = 15%
        uint256 penaltyTotal = (paid * penaltyBps) / 10000;
        uint256 expectedReturn = paid - penaltyTotal;

        uint256 bunkerBefore = usdc.balanceOf(bunker);
        uint256 opsBefore = usdc.balanceOf(ops);
        uint256 yieldBefore = usdc.balanceOf(address(realYieldRouter));
        uint256 buyerBefore = usdc.balanceOf(buyer);

        vm.prank(buyer);
        vault.ragequit(tokenId);

        assertEq(usdc.balanceOf(bunker) - bunkerBefore, penaltyTotal / 2);
        assertEq(usdc.balanceOf(ops) - opsBefore, penaltyTotal / 4);
        uint256 totalYieldReceived = (usdc.balanceOf(address(realYieldRouter)) + usdc.balanceOf(address(staking))) - yieldBefore;
        assertEq(totalYieldReceived, penaltyTotal - (penaltyTotal / 2) - (penaltyTotal / 4));
        assertEq(usdc.balanceOf(buyer) - buyerBefore, expectedReturn);
    }

    function testP2PLendingFlowAndAutoLiquidation() public {
        vm.prank(buyer);
        uint256 tokenId = vault.buyVestedBond(10_000 * 10**6, 3, address(0));

        VaultPositionNFT.Position memory pos = positionNFT.getPosition(tokenId);

        uint256 maxBorrow = (pos.discountedPricePaid * 7000) / 10000;
        uint256 borrowAmount = maxBorrow;

        vm.startPrank(buyer);
        positionNFT.approve(address(p2pMarket), tokenId);
        uint256 loanId = p2pMarket.createLoanOffer(tokenId, borrowAmount, 1000, 30);
        vm.stopPrank();

        uint256 collateral = (borrowAmount * 140) / 100;
        uint256 feeCollectorBefore = usdc.balanceOf(feeCollector);
        uint256 originationFee = (borrowAmount * 50) / 10000;

        vm.prank(borrower);
        p2pMarket.acceptLoanAndDepositCollateral(loanId, collateral);

        assertEq(usdc.balanceOf(feeCollector) - feeCollectorBefore, originationFee);
        assertEq(p2pMarket.calculateHealthFactor(loanId), 142);

        vm.warp(block.timestamp + 15 days);
        assertLe(p2pMarket.calculateHealthFactor(loanId), 142);

        (uint256 totalOwed, ) = p2pMarket.calculateTotalOwed(loanId);
        usdc.mint(borrower, totalOwed + 1000);

        vm.startPrank(borrower);
        usdc.approve(address(p2pMarket), type(uint256).max);
        p2pMarket.repayLoan(loanId);
        vm.stopPrank();

        assertEq(positionNFT.ownerOf(tokenId), buyer);
    }

    function testP2PAutoLiquidationUnder115Percent() public {
        vm.prank(buyer);
        uint256 tokenId = vault.buyVestedBond(10_000 * 10**6, 3, address(0));

        VaultPositionNFT.Position memory pos = positionNFT.getPosition(tokenId);
        uint256 borrowAmount = (pos.discountedPricePaid * 7000) / 10000;

        vm.startPrank(buyer);
        positionNFT.approve(address(p2pMarket), tokenId);
        uint256 loanId = p2pMarket.createLoanOffer(tokenId, borrowAmount, 1000, 30);
        vm.stopPrank();

        uint256 collateral = (borrowAmount * 130) / 100;
        vm.prank(borrower);
        p2pMarket.acceptLoanAndDepositCollateral(loanId, collateral);

        assertEq(p2pMarket.calculateHealthFactor(loanId), 142);

        vm.warp(block.timestamp + 31 days);

        address liquidator = address(200);
        vm.prank(liquidator);
        p2pMarket.liquidateLoan(loanId);

        assertEq(positionNFT.ownerOf(tokenId), buyer);
    }

    function testGovernanceStakingAndRealYieldRouting() public {
        uint256 stakeAmount = 5_000 * 10**18;

        vm.startPrank(buyer);
        alphaToken.approve(address(staking), stakeAmount);
        staking.stake(stakeAmount);
        vm.stopPrank();

        uint256 rewardAmount = 1_000 * 10**6; // USDC reward = 6 decimals
        usdc.mint(owner, rewardAmount);

        vm.startPrank(owner);
        usdc.approve(address(staking), rewardAmount);
        staking.notifyRewardAmount(rewardAmount);
        vm.stopPrank();

        assertApproxEqAbs(staking.earned(buyer), rewardAmount, 1000);

        vm.startPrank(buyer);
        realYieldRouter.setPayoutPreference(RealYieldRouter.PayoutPreference.OPTION_A_STABLECOIN);
        uint256 buyerUsdcBefore = usdc.balanceOf(buyer);
        realYieldRouter.claimRealYield();
        vm.stopPrank();

        assertApproxEqAbs(usdc.balanceOf(buyer) - buyerUsdcBefore, rewardAmount, 1000);
    }

    function testProofOfReservesAndTvlCap() public {
        usdc.mint(address(treasury), 10_000 * 10**6);
        (uint256 totalAssets, , uint256 ratio) = treasury.getProofOfReserves();
        assertGt(totalAssets, 0);
        assertEq(ratio, 10000); // 100%

        vm.prank(owner);
        vault.setTvlCap(500 * 10**6);
        vm.expectRevert("VestedVault: TVL Cap Exceeded");
        vm.prank(buyer);
        vault.buyVestedBond(1000 * 10**6, 1, address(0));
    }
}