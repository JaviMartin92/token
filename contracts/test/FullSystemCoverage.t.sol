// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ProtocolAddressProvider.sol";
import "../src/AlphaToken.sol";
import "../src/AlphaVault.sol";
import "../src/TreasuryProxy.sol";
import "../src/OracleHub.sol";
import "../src/TreasuryManager.sol";
import "../src/RealYieldRouter.sol";
import "../src/ProtocolOpExVault.sol";
import "../src/CommunityYieldVault.sol";
import "../src/ProtocolTokenomicsEngine.sol";
import "../src/VestedDiscountVault.sol";
import "../src/VaultPositionNFT.sol";
import "../src/P2PLendingMarket.sol";
import "../src/CircuitBreaker.sol";
import "../src/GovernanceStaking.sol";
import "../src/ProtocolContribution.sol";
import "../src/PromotionalIncentiveVault.sol";
import "../src/YieldStreamingVault.sol";
import "../src/AtomicSwapReceiver.sol";
import "../src/adapters/MorphoYieldVaultAdapter.sol";
import "../src/ProtocolRoles.sol";

contract MockERC20Coverage is ERC20 {
    uint8 private _dec;

    constructor(string memory name, string memory symbol, uint8 dec_) ERC20(name, symbol) {
        _dec = dec_;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockFeedCoverage {
    int256 private _price;
    uint8 private _decimals;

    constructor(int256 price, uint8 dec) {
        _price = price;
        _decimals = dec;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, _price, block.timestamp, block.timestamp, 1);
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }
}

contract FullSystemCoverageTest is Test {
    ProtocolAddressProvider public provider;
    AlphaToken public alphaToken;
    AlphaVault public vault;
    OracleHub public oracleHub;
    TreasuryManager public manager;
    RealYieldRouter public router;
    ProtocolOpExVault public opExVault;
    CommunityYieldVault public yieldVault;
    ProtocolTokenomicsEngine public engine;
    VestedDiscountVault public vestedVault;
    VaultPositionNFT public nft;
    P2PLendingMarket public p2pMarket;
    CircuitBreaker public circuitBreaker;
    MorphoYieldVaultAdapter public morphoAdapter;
    GovernanceStaking public staking;
    ProtocolContribution public contribution;
    PromotionalIncentiveVault public promoVault;
    YieldStreamingVault public yieldStream;
    AtomicSwapReceiver public atomicSwap;

    MockERC20Coverage public usdc;
    MockERC20Coverage public wbtc;
    MockFeedCoverage public usdcFeed;

    address public admin = address(0x10);
    address public user = address(0x20);
    address public lender = address(0x30);

    function setUp() public {
        vm.startPrank(admin);

        usdc = new MockERC20Coverage("USDC", "USDC", 6);
        wbtc = new MockERC20Coverage("WBTC", "WBTC", 8);
        usdcFeed = new MockFeedCoverage(1_00000000, 8); // $1.00 USD

        provider = new ProtocolAddressProvider(admin);

        alphaToken = new AlphaToken(provider, admin);
        provider.setAddress(keccak256("ALPHA_TOKEN"), address(alphaToken));

        vault = new AlphaVault(provider, admin);
        provider.setAddress(keccak256("ALPHA_VAULT"), address(vault));

        oracleHub = new OracleHub(provider, admin);
        provider.setAddress(keccak256("ORACLE_HUB"), address(oracleHub));
        oracleHub.grantRole(ProtocolRoles.ORACLE_MANAGER_ROLE, admin);
        oracleHub.setTrackedAsset(address(usdc), address(usdcFeed), address(0), 6);

        opExVault = new ProtocolOpExVault(address(usdc), admin);
        provider.setAddress(keccak256("PROTOCOL_OPEX_VAULT"), address(opExVault));

        yieldVault = new CommunityYieldVault(address(usdc), admin);
        provider.setAddress(keccak256("COMMUNITY_YIELD_VAULT"), address(yieldVault));

        staking = new GovernanceStaking(address(alphaToken), address(usdc), admin);
        provider.setAddress(keccak256("GOVERNANCE_STAKING"), address(staking));

        router = new RealYieldRouter(address(usdc), address(wbtc), address(0), address(staking), admin);
        router.setProtocolVaults(address(vault), address(yieldVault));
        provider.setAddress(keccak256("REAL_YIELD_ROUTER"), address(router));

        engine = new ProtocolTokenomicsEngine(admin);
        provider.setAddress(keccak256("TOKENOMICS_ENGINE"), address(engine));

        TreasuryManager logic = new TreasuryManager(provider);
        TreasuryProxy proxy = new TreasuryProxy(address(logic));
        manager = TreasuryManager(address(proxy));
        manager.initialize(admin, address(usdc), 6);
        provider.setAddress(keccak256("TREASURY_MANAGER"), address(manager));

        nft = new VaultPositionNFT(admin);
        vestedVault = new VestedDiscountVault(
            address(usdc), address(nft), address(vault), address(router), address(alphaToken), admin
        );
        provider.setAddress(keccak256("VESTED_VAULT"), address(vestedVault));

        p2pMarket = new P2PLendingMarket(address(usdc), address(nft), address(router), address(usdcFeed), admin);
        p2pMarket.setTreasury(address(manager));
        provider.setAddress(keccak256("P2P_MARKET"), address(p2pMarket));

        circuitBreaker = new CircuitBreaker(admin);

        morphoAdapter = new MorphoYieldVaultAdapter(address(usdc), address(manager), admin);
        provider.setAddress(keccak256("MORPHO_ADAPTER"), address(morphoAdapter));

        contribution = new ProtocolContribution(address(usdc), address(alphaToken), address(staking), address(0), admin);
        promoVault = new PromotionalIncentiveVault(address(alphaToken), admin);
        yieldStream = new YieldStreamingVault(address(usdc), admin);
        atomicSwap = new AtomicSwapReceiver(address(usdc), address(usdc), address(0), address(vault), admin);

        nft.setMinter(address(vestedVault));
        staking.setProtocolVaults(address(yieldVault));

        alphaToken.grantRole(ProtocolRoles.MINTER_ROLE, address(manager));
        alphaToken.grantRole(ProtocolRoles.MINTER_ROLE, admin);
        alphaToken.grantRole(ProtocolRoles.MINTER_ROLE, address(this));
        alphaToken.grantRole(ProtocolRoles.BURNER_ROLE, address(manager));
        vault.grantRole(ProtocolRoles.VAULT_MANAGER_ROLE, address(manager));
        vault.grantRole(ProtocolRoles.VAULT_MANAGER_ROLE, address(router));

        vm.stopPrank();
    }

    function test_RealYieldRouter_50_50_FeeRouting() public {
        usdc.mint(address(router), 1000 * 10 ** 6);

        vm.prank(admin);
        router.routeUniversalFee(address(usdc));

        assertEq(usdc.balanceOf(address(yieldVault)), 500 * 10 ** 6);
    }

    function test_ProtocolTokenomicsEngine_AllMath() public view {
        ProtocolTokenomicsEngine.DepositCalculation memory calc = engine.calculateDeposit(1000 * 10 ** 6, false, 6);
        assertGt(calc.feeAmountUsdc, 0);

        ProtocolTokenomicsEngine.RedemptionCalculation memory red =
            engine.calculateRedemption(1000 * 10 ** 18, 1000 * 10 ** 18, 1000 * 10 ** 18, 6);
        assertGt(red.assetsReceivedTokens, 0);

        ProtocolTokenomicsEngine.BondDiscountCalculation memory bond =
            engine.calculateBondDiscount(1000 * 10 ** 6, 3, 10000 * 10 ** 18);
        assertEq(bond.discountBps, 1700);

        ProtocolTokenomicsEngine.RagequitCalculation memory rage = engine.calculateRagequitPenalty(1000 * 10 ** 6);
        assertEq(rage.penaltyTotal, 150 * 10 ** 6);

        ProtocolTokenomicsEngine.LoanCalculation memory loan =
            engine.calculateLoanTerms(1000 * 10 ** 18, 500 * 10 ** 18, 1000, 30);
        assertTrue(loan.isLtvValid);

        ProtocolTokenomicsEngine.HealthFactorResult memory hf =
            engine.calculateHealthFactor(1000 * 10 ** 18, 500 * 10 ** 18, false);
        assertFalse(hf.isLiquidatable);
    }

    function test_GovernanceStaking_FullCycle() public {
        alphaToken.mint(user, 1000 * 10 ** 18);

        vm.startPrank(user);
        alphaToken.approve(address(staking), 1000 * 10 ** 18);
        staking.stake(1000 * 10 ** 18);
        assertEq(staking.balanceOf(user), 990 * 10 ** 18); // 1% staking fee

        vm.warp(block.timestamp + 7 days);
        staking.unstake(400 * 10 ** 18);
        assertEq(staking.balanceOf(user), 590 * 10 ** 18);
        vm.stopPrank();

        vm.prank(admin);
        staking.setExcludedAddress(user, true);
        assertTrue(staking.isExcludedFromYield(user));
    }

    function test_P2PLendingMarket_FullLoanCycle() public {
        usdc.mint(user, 1000 * 10 ** 6);

        vm.startPrank(user);
        usdc.approve(address(vestedVault), 1000 * 10 ** 6);
        uint256 tokenId = vestedVault.buyVestedBond(1000 * 10 ** 6, 1, address(0));
        nft.approve(address(p2pMarket), tokenId);
        uint256 loanId = p2pMarket.createLoanOffer(tokenId, 500 * 10 ** 6, 1000, 30);
        vm.stopPrank();

        usdc.mint(lender, 500 * 10 ** 6);
        vm.startPrank(lender);
        usdc.approve(address(p2pMarket), 500 * 10 ** 6);
        p2pMarket.acceptLoanAndDepositCollateral(loanId, 0);
        vm.stopPrank();

        vm.startPrank(user);
        usdc.mint(user, 600 * 10 ** 6);
        usdc.approve(address(p2pMarket), 600 * 10 ** 6);
        p2pMarket.repayLoan(loanId);
        vm.stopPrank();

        assertEq(nft.ownerOf(tokenId), user);
    }

    function test_AuxiliaryVaults_BasicOps() public {
        // ProtocolContribution
        usdc.mint(admin, 100 * 10 ** 6);
        vm.startPrank(admin);
        usdc.approve(address(contribution), 100 * 10 ** 6);
        contribution.injectFunds(100 * 10 ** 6, "AUDIT_REF_01");
        contribution.createTwapOrder(100 * 10 ** 6, 5, 3600);
        vm.stopPrank();

        // PromotionalIncentiveVault
        alphaToken.mint(address(promoVault), 1000 * 10 ** 18);
        vm.startPrank(admin);
        uint256 cId = promoVault.createCampaign("TEST_CAMPAIGN", 500 * 10 ** 18);
        promoVault.distributeReward(cId, user, 100 * 10 ** 18);
        vm.stopPrank();
        assertEq(alphaToken.balanceOf(user), 100 * 10 ** 18);

        // YieldStreamingVault
        usdc.mint(address(yieldStream), 500 * 10 ** 6);
        assertEq(usdc.balanceOf(address(yieldStream)), 500 * 10 ** 6);

        // AtomicSwapReceiver
        vm.prank(admin);
        atomicSwap.setTreasury(address(vault));
        assertEq(atomicSwap.treasury(), address(vault));
    }
}
