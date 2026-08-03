// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/interfaces/IAggregatorV3.sol";
import "../src/interfaces/ISwapRouter.sol";
import "../src/lib/token/ERC20/ERC20.sol";
import "../src/Treasury.sol";
import "../src/CircuitBreaker.sol";
import "../src/AtomicSwapReceiver.sol";
import "../src/YieldStreamingVault.sol";
import "../src/CorporateContribution.sol";

// ==========================================
// MOCK CONTRACTS FOR TESTING
// ==========================================

contract MockERC20 is ERC20 {
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

contract MockChainlinkFeed is IAggregatorV3 {
    uint8 private _decimals;
    int256 private _price;
    uint256 private _updatedAt;

    constructor(uint8 decimals_, int256 price_) {
        _decimals = decimals_;
        _price = price_;
        _updatedAt = block.timestamp;
    }

    function setPrice(int256 price_) external {
        _price = price_;
        _updatedAt = block.timestamp;
    }

    function setTimestamp(uint256 timestamp_) external {
        _updatedAt = timestamp_;
    }

    function decimals() external view override returns (uint8) {
        return _decimals;
    }

    function description() external pure override returns (string memory) {
        return "Mock Chainlink Feed";
    }

    function version() external pure override returns (uint256) {
        return 1;
    }

    function getRoundData(uint80) external view override returns (
        uint80, int256, uint256, uint256, uint80
    ) {
        return (1, _price, _updatedAt, _updatedAt, 1);
    }

    function latestRoundData() external view override returns (
        uint80, int256, uint256, uint256, uint80
    ) {
        return (1, _price, _updatedAt, _updatedAt, 1);
    }
}

contract MockSwapRouter is ISwapRouter {
    address public usdcToken;
    address public nativeToken;

    constructor(address _usdcToken, address _nativeToken) {
        usdcToken = _usdcToken;
        nativeToken = _nativeToken;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable override returns (uint256 amountOut) {
        // Transfer tokenIn from sender to router
        ERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);

        // 1:1 USD-value swap — scale amountIn (tokenIn decimals) to amountOut (tokenOut decimals)
        // Both prices are $1.00 in this sandbox so USD value is preserved directly.
        uint8 decIn = ERC20(params.tokenIn).decimals();
        uint8 decOut = ERC20(params.tokenOut).decimals();

        if (decOut == 8) {
            // WBTC ($60,000 USD per WBTC)
            amountOut = (params.amountIn * 10**8) / (60000 * (10 ** uint256(decIn)));
        } else if (decOut == 18 && params.tokenOut != usdcToken) {
            // WETH ($3,000 USD per WETH) or ALPHA ($1 USD per ALPHA)
            string memory symbol = "";
            try ERC20(params.tokenOut).symbol() returns (string memory sym) { symbol = sym; } catch {}
            if (keccak256(bytes(symbol)) == keccak256(bytes("WETH"))) {
                amountOut = (params.amountIn * 10**18) / (3000 * (10 ** uint256(decIn)));
            } else {
                amountOut = (params.amountIn * 10**18) / (10 ** uint256(decIn));
            }
        } else if (decOut >= decIn) {
            amountOut = params.amountIn * (10 ** uint256(decOut - decIn));
        } else {
            amountOut = params.amountIn / (10 ** uint256(decIn - decOut));
        }

        // Try minting tokenOut to recipient, or transfer from router balance if mint is not supported
        try MockERC20(params.tokenOut).mint(params.recipient, amountOut) {} catch {
            IERC20(params.tokenOut).transfer(params.recipient, amountOut);
        }
        return amountOut;
    }
}

// ==========================================
// ALPHA CENTAURI TEST SUITE
// ==========================================

contract TreasuryTest is Test {
    // Mock contracts
    MockERC20 public usdc;
    MockERC20 public usdt;
    MockERC20 public wbtc;
    MockERC20 public weth;
    MockERC20 public altcoin;
    MockERC20 public nativeToken;

    MockChainlinkFeed public usdcFeed;
    MockChainlinkFeed public wbtcFeed;
    MockChainlinkFeed public wethFeed;
    MockChainlinkFeed public altcoinFeed;

    MockSwapRouter public swapRouter;

    // Core System Contracts
    Treasury public treasury;
    CircuitBreaker public circuitBreaker;
    AtomicSwapReceiver public swapReceiver;
    YieldStreamingVault public yieldVault;
    CorporateContribution public corpContribution;

    // Test addresses
    address public governance = address(0x9);
    address public investor = address(0x10);
    address public company = address(0x11);
    address public stakingAddress = address(0x12);

    // Private key for EIP-712 test
    uint256 public investorPrivateKey = 0xA11CE;

    function setUp() public {
        // 1. Deploy Mock Tokens with REAL decimals
        usdc = new MockERC20("USD Coin", "USDC", 6);
        usdt = new MockERC20("Tether USD", "USDT", 6);
        wbtc = new MockERC20("Wrapped BTC", "WBTC", 8);
        weth = new MockERC20("Wrapped ETH", "WETH", 18);
        altcoin = new MockERC20("Altcoin Token", "ALT", 18);
        nativeToken = new MockERC20("Alpha Centauri Token", "ALPHA", 18);

        // 2. Deploy Mock Oracles (USDC: 8 decimals, WBTC/WETH: 8 decimals, Alts: 8 decimals)
        usdcFeed = new MockChainlinkFeed(8, 1_00000000);     // $1.00
        wbtcFeed = new MockChainlinkFeed(8, 60000_00000000);  // $60,000.00
        wethFeed = new MockChainlinkFeed(8, 3000_00000000);   // $3,000.00
        altcoinFeed = new MockChainlinkFeed(8, 10_00000000);  // $10.00 (Top 20 Altcoin mock)

        // 3. Deploy Mock Uniswap Router
        swapRouter = new MockSwapRouter(address(usdc), address(nativeToken));

        // 4. Deploy Core Protocols
        treasury = new Treasury(governance, address(usdc), 6); // USDC = 6 decimals
        circuitBreaker = new CircuitBreaker(governance);
        swapReceiver = new AtomicSwapReceiver(address(usdt), address(usdc), address(swapRouter), address(treasury), governance);
        yieldVault = new YieldStreamingVault(address(usdc), governance);
        corpContribution = new CorporateContribution(address(usdc), address(nativeToken), stakingAddress, address(swapRouter), governance);

        // 5. Config Treasury tracked assets
        vm.startPrank(governance);
        treasury.setTrackedAsset(address(usdc), address(usdcFeed), 6);
        treasury.setTrackedAsset(address(wbtc), address(wbtcFeed), 8); // WBTC (8 decimals)
        treasury.setTrackedAsset(address(weth), address(wethFeed), 18); // WETH (18 decimals)
        treasury.setTrackedAsset(address(altcoin), address(altcoinFeed), 18); // Altcoin (18 decimals)

        circuitBreaker.setPriceFeed(address(altcoin), address(altcoinFeed));
        vm.stopPrank();
    }

    // ==========================================
    // 1. TEST PORTFOLIO SANITY BOUNDS
    // ==========================================
    function testSanityBoundsValidation() public {
        assertTrue(treasury.validateSanityBounds());

        // Adjust weights inside boundaries: Stables 45%, WBTC 25%, WETH 15%, Alts 15% (Total 100%)
        vm.startPrank(governance);
        treasury.adjustWeights(ITreasury.AssetWeights({
            stablecoins: 45_00,
            wbtc: 25_00,
            weth: 15_00,
            alphaProtocolStaking: 15_00
        }));
        assertTrue(treasury.validateSanityBounds());

        // Violate Sanity Bounds: Stables 35% (Minimum is 40%)
        vm.expectRevert("Treasury: Adjusted weights exceed safety limits");
        treasury.adjustWeights(ITreasury.AssetWeights({
            stablecoins: 35_00,
            wbtc: 35_00,
            weth: 15_00,
            alphaProtocolStaking: 15_00
        }));
        vm.stopPrank();
    }

    // ==========================================
    // 2. TEST NAV CALCULATION & DIRECT REDEMPTION
    // ==========================================
    function testRedemptionAndNAV() public {
        address user = vm.addr(investorPrivateKey);
        
        // Deposit 1,000 USDC into Treasury (USDC has 6 decimals)
        usdc.mint(user, 1000 * 10**6);
        vm.startPrank(user);
        usdc.approve(address(treasury), type(uint256).max);
        
        uint256 sharesMinted = treasury.deposit(1000 * 10**6);
        assertTrue(sharesMinted > 0);
        assertEq(treasury.balanceOf(user), sharesMinted);

        // Redeem shares
        uint256 initialUSDC = usdc.balanceOf(user);
        uint256 assetsReceived = treasury.redeem(sharesMinted);
        
        assertEq(assetsReceived, 990 * 10**6);
        assertEq(usdc.balanceOf(user), initialUSDC + (990 * 10**6));
        assertEq(treasury.balanceOf(user), 0);
        vm.stopPrank();
    }

    // ==========================================
    // 3. TEST CIRCUIT BREAKER (STOP-LOSS)
    // ==========================================
    function testCircuitBreakerTrigger() public {
        address alt = address(altcoin);

        // Record Initial Price: $10.00
        circuitBreaker.checkAssetDeviation(alt);
        assertFalse(circuitBreaker.isFrozen(alt));

        // Travel 7 hours in time
        vm.warp(block.timestamp + 7 hours);

        // Price drops 20% to $8.00 (deviation > 15%)
        altcoinFeed.setPrice(8_00000000);
        altcoinFeed.setTimestamp(block.timestamp);

        // Check deviation -> triggers circuit breaker
        bool triggered = circuitBreaker.checkAssetDeviation(alt);
        assertTrue(triggered);
        assertTrue(circuitBreaker.isFrozen(alt));

        // Reset requires Governance (multisig)
        vm.startPrank(governance);
        circuitBreaker.resetBreaker(alt);
        assertFalse(circuitBreaker.isFrozen(alt));
        vm.stopPrank();
    }

    // ==========================================
    // 4. TEST ATOMIC SWAP USDT -> USDC
    // ==========================================
    function testAtomicSwapUSDTtoUSDC() public {
        // Mint USDT to user (USDT has 6 decimals)
        usdt.mint(investor, 1000 * 10**6);
        
        vm.startPrank(investor);
        usdt.approve(address(swapReceiver), type(uint256).max);

        // Swap USDT to USDC: 0.05% slippage check -> expects at least 999.5 USDC
        uint256 usdcExpected = 999_500000; // 999.5 (6 decimals)
        uint256 usdcOut = swapReceiver.depositUSDT(1000 * 10**6, usdcExpected);
        
        assertTrue(usdcOut >= usdcExpected);
        assertEq(usdc.balanceOf(address(treasury)), usdcOut);
        vm.stopPrank();
    }

    function testAtomicSwapSlippageRevert() public {
        usdt.mint(investor, 1000 * 10**6);
        vm.startPrank(investor);
        usdt.approve(address(swapReceiver), type(uint256).max);

        // Reverts if requested min USDC expected is too low (violates 0.05% max slip check on-chain)
        vm.expectRevert("AtomicSwapReceiver: Slippage input exceeds 0.05% limit");
        swapReceiver.depositUSDT(1000 * 10**6, 990 * 10**6);
        vm.stopPrank();
    }

    // ==========================================
    // 5. TEST EIP-712 YIELD CLAIMING
    // ==========================================
    function testYieldClaimGasless() public {
        address user = vm.addr(investorPrivateKey);

        // Pre-allocate mock yield in vault
        vm.startPrank(governance);
        usdc.mint(address(yieldVault), 500 * 10**6);
        yieldVault.allocateYield(user, 100 * 10**6);
        vm.stopPrank();

        assertEq(yieldVault.getPendingYield(user), 100 * 10**6);

        // Prepare EIP-712 Signature parameters
        uint256 nonce = yieldVault.nonces(user);
        uint256 deadline = block.timestamp + 1 hours;
        uint256 amountToClaim = 50 * 10**6;

        bytes32 structHash = keccak256(
            abi.encode(
                yieldVault.CLAIM_TYPEHASH(),
                user,
                amountToClaim,
                nonce,
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", yieldVault.DOMAIN_SEPARATOR(), structHash));

        // Sign the digest
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(investorPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Anyone (e.g. backend relay operator) submits the transaction gasless
        address relayOperator = address(0x22);
        vm.startPrank(relayOperator);
        
        IYieldStreamingVault.ClaimRequest memory request = IYieldStreamingVault.ClaimRequest({
            user: user,
            amount: amountToClaim,
            nonce: nonce,
            deadline: deadline
        });
        
        yieldVault.claimYieldGasless(request, signature);
        vm.stopPrank();

        // Verify balances updated
        assertEq(yieldVault.getPendingYield(user), 50 * 10**6);
        assertEq(usdc.balanceOf(user), 50 * 10**6);
    }

    // ==========================================
    // 6. TEST CORPORATE INJECTION & TWAP SCHEDULER
    // ==========================================
    function testCorporateTWAPBuyback() public {
        // Mint corporate USDC (USDC has 6 decimals)
        usdc.mint(company, 1000 * 10**6);

        vm.startPrank(company);
        usdc.approve(address(corpContribution), type(uint256).max);
        
        // 1. Audit Injection
        corpContribution.injectFunds(1000 * 10**6, "STATEMENT_Q2_HASH");
        assertEq(usdc.balanceOf(address(corpContribution)), 1000 * 10**6);
        vm.stopPrank();

        // 2. Create TWAP: 4 steps, 1 hour interval (USDC has 6 decimals)
        vm.startPrank(governance);
        corpContribution.createTwapOrder(1000 * 10**6, 4, 1 hours);
        vm.stopPrank();

        // Order details check
        (,, uint256 amountPerInterval,,,) = corpContribution.twapOrders(0);
        assertEq(amountPerInterval, 250 * 10**6);

        // 3. Trigger TWAP Step 1
        corpContribution.executeTwapStep(0);
        
        // MockSwapRouter swaps 250 USDC for 500 Native tokens
        // Split 50/50: 250 Native to Staking, 250 to Burn Address (0x000000000000000000000000000000000000dEaD)
        assertEq(nativeToken.balanceOf(stakingAddress), 250 * 10**18);
        assertEq(nativeToken.balanceOf(0x000000000000000000000000000000000000dEaD), 250 * 10**18);

        // Attempting to run step 2 immediately should fail
        vm.expectRevert("CorporateContribution: Interval lock active");
        corpContribution.executeTwapStep(0);

        // Warp time 1 hour and run step 2
        vm.warp(block.timestamp + 1 hours + 1 seconds);
        corpContribution.executeTwapStep(0);

        assertEq(nativeToken.balanceOf(stakingAddress), 500 * 10**18);
    }
}
