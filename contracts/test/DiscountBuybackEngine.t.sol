// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/lib/token/ERC20/ERC20.sol";
import "../src/ProtocolAddressProvider.sol";
import "../src/VirajeToken.sol";
import "../src/VirajeVault.sol";
import "../src/TreasuryProxy.sol";
import "../src/OracleHub.sol";
import "../src/TreasuryManager.sol";
import "../src/ProtocolRoles.sol";
import "../src/CircuitBreaker.sol";
import "../src/ProtocolTokenomicsEngine.sol";
import "../src/DiscountBuybackEngine.sol";
import "../src/interfaces/IProtocolErrors.sol";

contract MockBuybackERC20 is ERC20 {
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

contract MockBuybackChainlinkFeed {
    int256 private _price;
    uint8 private _decimals;

    constructor(int256 price, uint8 dec) {
        _price = price;
        _decimals = dec;
    }

    function setPrice(int256 newPrice) external {
        _price = newPrice;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, _price, block.timestamp, block.timestamp, 1);
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }
}

contract MockBuybackSwapRouter is ISwapRouterBuyback {
    address public usdc;
    address public viraje;
    uint256 public virajePriceUSD18 = 90 * 10 ** 16; // $0.90 (18 decimals)

    constructor(address _usdc, address _viraje) {
        usdc = _usdc;
        viraje = _viraje;
    }

    function setVirajePriceUSD(uint256 newPrice18) external {
        virajePriceUSD18 = newPrice18;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external override returns (uint256 amountOut) {
        // Transfer USDC in
        IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);

        // amountIn is in USDC (6 dec). Convert to USD 18 dec: amountIn * 1e12
        // amountOut = (USD 18 dec * 1e18) / virajePriceUSD18
        uint256 usdValue18 = params.amountIn * 10 ** 12;
        amountOut = (usdValue18 * 10 ** 18) / virajePriceUSD18;

        // Transfer pre-existing VIRAJE from DEX liquidity pool
        IERC20(viraje).transfer(params.recipient, amountOut);
    }
}

contract DiscountBuybackEngineTest is Test {
    ProtocolAddressProvider public provider;
    VirajeToken public virajeToken;
    VirajeVault public vault;
    OracleHub public oracleHub;
    TreasuryManager public manager;
    CircuitBreaker public circuitBreaker;
    ProtocolTokenomicsEngine public engine;
    DiscountBuybackEngine public buybackEngine;
    MockBuybackSwapRouter public mockRouter;

    MockBuybackERC20 public usdc;
    MockBuybackChainlinkFeed public usdcFeed;
    MockBuybackChainlinkFeed public virajeFeed;

    address public admin = address(0x1);
    address public user = address(0x2);

    function setUp() public {
        vm.startPrank(admin);

        // 1. Tokens & Feeds
        usdc = new MockBuybackERC20("USDC", "USDC", 6);
        usdcFeed = new MockBuybackChainlinkFeed(1_00000000, 8); // $1.00
        virajeFeed = new MockBuybackChainlinkFeed(90000000, 8); // $0.90 (10% discount vs $1.00 NAV)

        // 2. Provider
        provider = new ProtocolAddressProvider(admin);

        // 3. VirajeToken
        virajeToken = new VirajeToken(provider, admin);
        provider.setAddress(keccak256("VIRAJE_TOKEN"), address(virajeToken));

        // 4. VirajeVault
        vault = new VirajeVault(provider, admin);
        provider.setAddress(keccak256("VIRAJE_VAULT"), address(vault));

        // 5. OracleHub
        oracleHub = new OracleHub(provider, admin);
        provider.setAddress(keccak256("ORACLE_HUB"), address(oracleHub));
        oracleHub.grantRole(ProtocolRoles.ORACLE_MANAGER_ROLE, admin);
        oracleHub.setTrackedAsset(address(usdc), address(usdcFeed), address(0), 6);
        oracleHub.setTrackedAsset(address(virajeToken), address(virajeFeed), address(0), 18);

        // 6. CircuitBreaker
        circuitBreaker = new CircuitBreaker(admin);
        provider.setAddress(keccak256("CIRCUIT_BREAKER"), address(circuitBreaker));

        // 7. Tokenomics Engine
        engine = new ProtocolTokenomicsEngine(admin);
        provider.setAddress(keccak256("TOKENOMICS_ENGINE"), address(engine));

        // 8. TreasuryManager
        TreasuryManager logic = new TreasuryManager(provider);
        TreasuryProxy proxy = new TreasuryProxy(address(logic));
        manager = TreasuryManager(address(proxy));
        manager.initialize(admin, address(usdc), 6);
        provider.setAddress(keccak256("TREASURY_MANAGER"), address(manager));

        // 9. SwapRouter Mock
        mockRouter = new MockBuybackSwapRouter(address(usdc), address(virajeToken));

        // 10. DiscountBuybackEngine
        buybackEngine = new DiscountBuybackEngine(provider, address(usdc), 6, address(mockRouter), admin);
        provider.setAddress(keccak256("DISCOUNT_BUYBACK_ENGINE"), address(buybackEngine));

        // Roles & Permissions
        virajeToken.grantRole(ProtocolRoles.MINTER_ROLE, admin);
        virajeToken.grantRole(ProtocolRoles.MINTER_ROLE, address(manager));
        virajeToken.grantRole(ProtocolRoles.BURNER_ROLE, address(manager));
        virajeToken.grantRole(ProtocolRoles.BURNER_ROLE, address(buybackEngine));
        manager.grantRole(ProtocolRoles.BURNER_ROLE, address(buybackEngine));
        vault.grantRole(ProtocolRoles.VAULT_MANAGER_ROLE, address(manager));
        vault.grantRole(ProtocolRoles.VAULT_MANAGER_ROLE, address(buybackEngine));
        manager.grantRole(ProtocolRoles.COMPLIANCE_ROLE, admin);

        manager.setKYCStatus(user, true);

        // Bootstrap Initial Liquidity in Protocol
        // User deposits 100,000 USDC into Treasury -> receives ~99,000 VIRAJE
        usdc.mint(user, 100_000 * 10 ** 6);
        vm.stopPrank();

        vm.startPrank(user);
        usdc.approve(address(manager), 100_000 * 10 ** 6);
        manager.deposit(100_000 * 10 ** 6, 0);
        // Transfer 10,000 VIRAJE to mockRouter to simulate DEX liquidity pool
        virajeToken.transfer(address(mockRouter), 10_000 * 10 ** 18);
        vm.stopPrank();
    }

    function test_Lock1_RevertIf_DiscountTooLow() public {
        vm.startPrank(admin);
        // Set VIRAJE market price = $1.00 (NAV is $1.005 -> ~0.50% discount < 5% min)
        virajeFeed.setPrice(100000000); // $1.00

        // Attempt buyback of 100 USDC
        vm.expectRevert(abi.encodeWithSelector(IProtocolErrors.DiscountTooLow.selector, 49, 500));
        buybackEngine.executeDiscountBuyback(100 * 10 ** 6, 1);
        vm.stopPrank();
    }

    function test_Lock2_RevertIf_DailyBudgetExceeded() public {
        vm.startPrank(admin);
        virajeFeed.setPrice(90000000); // $0.90 (10% discount)

        // Liquid USDC in vault is approx 100,000 USDC. Max daily budget is 2.50% = 2,500 USDC.
        // Trying to spend 3,000 USDC must revert
        vm.expectRevert(
            abi.encodeWithSelector(IProtocolErrors.DailyBudgetExceeded.selector, 3000 * 10 ** 6, 2500 * 10 ** 6)
        );
        buybackEngine.executeDiscountBuyback(3000 * 10 ** 6, 1);
        vm.stopPrank();
    }

    function test_Lock6_RevertIf_CooldownActive() public {
        vm.startPrank(admin);
        virajeFeed.setPrice(90000000); // $0.90 (10% discount)

        // 1st buyback of 500 USDC succeeds
        uint256 expectedViraje = (uint256(500 * 10 ** 12) * 10 ** 18) / uint256(90 * 10 ** 16);
        uint256 minVirajeOut = (expectedViraje * 9900) / 10000;
        buybackEngine.executeDiscountBuyback(500 * 10 ** 6, minVirajeOut);

        // Immediate 2nd buyback must revert with cooldown active
        vm.expectRevert(abi.encodeWithSelector(IProtocolErrors.CooldownActive.selector, block.timestamp + 14400));
        buybackEngine.executeDiscountBuyback(500 * 10 ** 6, minVirajeOut);

        // Warp time forward by 4 hours (14400s) -> now it succeeds!
        vm.warp(block.timestamp + 14401);
        buybackEngine.executeDiscountBuyback(500 * 10 ** 6, minVirajeOut);
        vm.stopPrank();
    }

    function test_Lock8_RevertIf_CircuitBreakerFrozen() public {
        vm.startPrank(admin);
        virajeFeed.setPrice(90000000);

        // Manually freeze USDC in CircuitBreaker
        circuitBreaker.triggerFreeze(address(usdc));

        uint256 expectedViraje = (uint256(500 * 10 ** 12) * 10 ** 18) / uint256(90 * 10 ** 16);
        uint256 minVirajeOut = (expectedViraje * 9900) / 10000;

        vm.expectRevert(abi.encodeWithSelector(IProtocolErrors.CircuitBreakerActive.selector, address(usdc)));
        buybackEngine.executeDiscountBuyback(500 * 10 ** 6, minVirajeOut);
        vm.stopPrank();
    }

    function test_Lock9_RevertIf_PoRBelowThreshold() public {
        vm.startPrank(admin);
        virajeFeed.setPrice(90000000);

        // Raise minPoRRatioBps to 11000 (110%) while actual PoR is ~100%
        buybackEngine.setParameters(500, 250, 14400, 11000, 100);

        uint256 expectedViraje = (uint256(500 * 10 ** 12) * 10 ** 18) / uint256(90 * 10 ** 16);
        uint256 minVirajeOut = (expectedViraje * 9900) / 10000;

        vm.expectRevert(abi.encodeWithSelector(IProtocolErrors.Undercollateralized.selector, 10000, 11000));
        buybackEngine.executeDiscountBuyback(500 * 10 ** 6, minVirajeOut);
        vm.stopPrank();
    }

    function test_Lock10_RevertIf_TradeSizeTooLarge() public {
        vm.startPrank(admin);
        virajeFeed.setPrice(90000000);

        // Max single trade is 1.00% of liquid balance (~1,000 USDC).
        // Trying to spend 1,500 USDC in 1 trade must revert
        vm.expectRevert(
            abi.encodeWithSelector(IProtocolErrors.TradeSizeTooLarge.selector, 1500 * 10 ** 6, 1000 * 10 ** 6)
        );
        buybackEngine.executeDiscountBuyback(1500 * 10 ** 6, 1);
        vm.stopPrank();
    }

    function test_SuccessfulBuyback_BurnsViraje_And_IncreasesNAV() public {
        vm.startPrank(admin);
        virajeFeed.setPrice(90000000); // 10% discount ($0.90)

        uint256 navBefore = manager.getNAVPerShare();
        uint256 supplyBefore = virajeToken.totalSupply();
        uint256 burnedBefore = manager.totalBurnedTokens();

        uint256 usdcToSpend = 500 * 10 ** 6; // 500 USDC
        uint256 expectedViraje = (uint256(usdcToSpend * 10 ** 12) * 10 ** 18) / uint256(90 * 10 ** 16);
        uint256 minVirajeOut = (expectedViraje * 9900) / 10000;

        uint256 virajeBurned = buybackEngine.executeDiscountBuyback(usdcToSpend, minVirajeOut);

        uint256 navAfter = manager.getNAVPerShare();
        uint256 supplyAfter = virajeToken.totalSupply();
        uint256 burnedAfter = manager.totalBurnedTokens();

        // Verifications
        assertGt(virajeBurned, 0, "Viraje burned should be > 0");
        assertEq(supplyBefore - supplyAfter, virajeBurned, "Total supply should be reduced by virajeBurned");
        assertEq(burnedAfter - burnedBefore, virajeBurned, "Total burned counter in treasury should increase");
        assertGe(navAfter, navBefore, "NAV per share must strictly increase or stay equal");
        assertEq(buybackEngine.spentToday(), usdcToSpend, "Spent today must equal usdcToSpend");
        assertEq(buybackEngine.totalBuybackVolumeUSD(), usdcToSpend, "Total volume tracked");
        vm.stopPrank();
    }

    function test_ConfigurablePoolFee_And_KeeperBounty_And_SweepTokens() public {
        vm.startPrank(admin);

        // 1. Test Pool Fee
        buybackEngine.setPoolFee(500); // 0.05% fee tier
        assertEq(buybackEngine.poolFee(), 500, "Pool fee should be 500");

        // Invalid fee tier must revert
        vm.expectRevert(IProtocolErrors.InvalidParameters.selector);
        buybackEngine.setPoolFee(400);

        // 2. Test Keeper Bounty
        buybackEngine.setKeeperBountyBps(10); // 0.10% bounty
        assertEq(buybackEngine.keeperBountyBps(), 10, "Keeper bounty should be 10 bps");

        // Exceeding 50 bps cap must revert
        vm.expectRevert(IProtocolErrors.InvalidParameters.selector);
        buybackEngine.setKeeperBountyBps(60);

        // 3. Test Sweep Tokens
        MockBuybackERC20 strayToken = new MockBuybackERC20("STRAY", "STR", 18);
        strayToken.mint(address(buybackEngine), 1000 * 10 ** 18);

        uint256 adminBalBefore = strayToken.balanceOf(admin);
        buybackEngine.sweepTokens(address(strayToken), admin);
        uint256 adminBalAfter = strayToken.balanceOf(admin);

        assertEq(adminBalAfter - adminBalBefore, 1000 * 10 ** 18, "Admin should receive swept tokens");
        vm.stopPrank();
    }
}
