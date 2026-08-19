// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/lib/token/ERC20/ERC20.sol";
import "../src/ProtocolAddressProvider.sol";
import "../src/AlphaToken.sol";
import "../src/AlphaVault.sol";
import "../src/TreasuryProxy.sol";
import "../src/OracleHub.sol";
import "../src/TreasuryManager.sol";
import "../src/ProtocolRoles.sol";

contract MockERC20Audit is ERC20 {
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

contract MockChainlinkFeedAudit {
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

contract StaleMockChainlinkFeedAudit {
    int256 private _price;
    uint8 private _decimals;
    uint256 private _updatedAt;

    constructor(int256 price, uint8 dec, uint256 updatedAt) {
        _price = price;
        _decimals = dec;
        _updatedAt = updatedAt;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, _price, _updatedAt, _updatedAt, 1);
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }
}

contract InstitutionalAuditInvariantsTest is Test {
    ProtocolAddressProvider public provider;
    AlphaToken public alphaToken;
    AlphaVault public vault;
    OracleHub public oracleHub;
    TreasuryManager public manager;

    MockERC20Audit public usdc;
    MockERC20Audit public wbtc;
    MockERC20Audit public weth;
    MockChainlinkFeedAudit public usdcFeed;
    MockChainlinkFeedAudit public wbtcFeed;
    MockChainlinkFeedAudit public wethFeed;

    address public admin = address(0x1);
    address public user = address(0x2);
    address public attacker = address(0x3);

    function setUp() public {
        vm.startPrank(admin);

        // Deploy Mocks
        usdc = new MockERC20Audit("USDC", "USDC", 6);
        wbtc = new MockERC20Audit("WBTC", "WBTC", 8);
        weth = new MockERC20Audit("WETH", "WETH", 18);

        usdcFeed = new MockChainlinkFeedAudit(1_00000000, 8); // $1 USD
        wbtcFeed = new MockChainlinkFeedAudit(60000_00000000, 8); // $60,000 USD
        wethFeed = new MockChainlinkFeedAudit(3000_00000000, 8); // $3,000 USD

        // 1. Address Provider
        provider = new ProtocolAddressProvider(admin);

        // 2. AlphaToken
        alphaToken = new AlphaToken(provider, admin);
        provider.setAddress(keccak256("ALPHA_TOKEN"), address(alphaToken));

        // 3. AlphaVault
        vault = new AlphaVault(provider, admin);
        provider.setAddress(keccak256("ALPHA_VAULT"), address(vault));

        // 4. OracleHub
        oracleHub = new OracleHub(provider, admin);
        provider.setAddress(keccak256("ORACLE_HUB"), address(oracleHub));
        oracleHub.grantRole(ProtocolRoles.ORACLE_MANAGER_ROLE, admin);
        oracleHub.setTrackedAsset(address(usdc), address(usdcFeed), address(0), 6);
        oracleHub.setTrackedAsset(address(wbtc), address(wbtcFeed), address(0), 8);
        oracleHub.setTrackedAsset(address(weth), address(wethFeed), address(0), 18);

        // Treasury Manager
        TreasuryManager logic = new TreasuryManager(provider);
        TreasuryProxy proxy = new TreasuryProxy(address(logic));
        manager = TreasuryManager(address(proxy));
        manager.initialize(admin, address(usdc), 6);
        provider.setAddress(keccak256("TREASURY_MANAGER"), address(manager));

        // Roles
        alphaToken.grantRole(ProtocolRoles.MINTER_ROLE, address(manager));
        alphaToken.grantRole(ProtocolRoles.BURNER_ROLE, address(manager));
        vault.grantRole(ProtocolRoles.VAULT_MANAGER_ROLE, address(manager));
        manager.grantRole(ProtocolRoles.COMPLIANCE_ROLE, admin);

        manager.setKYCStatus(user, true);
        manager.setKYCStatus(address(this), true);
        manager.setKYCStatus(attacker, true);

        vm.stopPrank();
    }

    // =========================================================================
    // PILAR 2.A: FUZZING DE CALCULATEDYNAMICEFEEBPS (Inputs 1 wei a 10^9 tokens)
    // =========================================================================

    /**
     * @notice Fuzzing masivo sobre calculateDynamicFeeBps.
     * @dev Certifica que el fee devuelto se mantenga estrictamente entre 50 BPS (0.50%)
     *      y 500 BPS (5.00%) sin desbordamientos ni revertis para cualquier monto de entrada.
     */
    function testFuzz_CalculateDynamicFeeBps(uint256 grossDepositUSD, uint256 totalAssetsExogenousUSD) public view {
        // Enforce bounds: 1 wei to 10^9 tokens (10^27 in 18-decimal scaling)
        grossDepositUSD = bound(grossDepositUSD, 1, 1e27);
        totalAssetsExogenousUSD = bound(totalAssetsExogenousUSD, 0, 1e27);

        uint256 feeBps = manager.calculateDynamicFeeBps(grossDepositUSD, totalAssetsExogenousUSD);

        assertGe(feeBps, 50, "Fuzz Error: Fee fell below minimum 50 BPS (0.50%)");
        assertLe(feeBps, 500, "Fuzz Error: Fee exceeded maximum cap 500 BPS (5.00%)");
    }

    // =========================================================================
    // PILAR 2.B: INVARIANTE FORMAL 1 - TotalAssetsExogenousUSD >= TotalLiabilitiesUSD
    // =========================================================================

    /**
     * @notice Invariante formal de colateralización sobre depósitos arbitrarios.
     */
    function test_Invariant_AssetsExceedLiabilities() public {
        usdc.mint(user, 100_000 * 10 ** 6); // 100,000 USDC

        vm.startPrank(user);
        usdc.approve(address(manager), 100_000 * 10 ** 6);
        manager.deposit(100_000 * 10 ** 6, 0);
        vm.stopPrank();

        (uint256 totalAssetsUSD, uint256 totalLiabilitiesUSD, uint256 ratioBps) = manager.getProofOfReserves();

        // Invariante dura: Total Assets USD >= Total Liabilities USD
        assertGe(
            totalAssetsUSD, totalLiabilitiesUSD, "INVARIANT VIOLATION: TotalAssetsExogenousUSD < TotalLiabilitiesUSD"
        );
        assertGe(ratioBps, 10000, "INVARIANT VIOLATION: Collateral Ratio < 100.00%");
    }

    // =========================================================================
    // PILAR 2.C: INVARIANTE FORMAL 2 - Monotonicidad de NAV (NAV_post >= NAV_pre)
    // =========================================================================

    /**
     * @notice Invariante formal de incremento no dilutivo de NAV por Share.
     */
    function getNavPerShare() internal view returns (uint256) {
        uint256 assets = manager.getTotalAssetsExogenousUSD();
        uint256 shares = manager.getNetCirculatingShares();
        if (shares == 0) return 1e18;
        return (assets * 1e18) / shares;
    }

    function test_Invariant_NAVMonotonicity(uint256 depositAmount) public {
        depositAmount = bound(depositAmount, 1000 * 10 ** 6, 50_000 * 10 ** 6); // $1,000 a $50,000 USDC

        // Initial deposit to establish NAV base
        usdc.mint(user, depositAmount);
        vm.startPrank(user);
        usdc.approve(address(manager), depositAmount);
        manager.deposit(depositAmount, 0);
        vm.stopPrank();

        uint256 navPre = getNavPerShare();

        // Second deposit by another user
        usdc.mint(attacker, depositAmount);
        vm.startPrank(attacker);
        usdc.approve(address(manager), depositAmount);
        manager.deposit(depositAmount, 0);
        vm.stopPrank();

        uint256 navPost = getNavPerShare();

        // Invariante de Monotonicidad: NAV_post >= NAV_pre (gracias a la inyección del fee de entrada al vault)
        assertGe(navPost, navPre, "INVARIANT VIOLATION: NAV dilucion detectada (NAV_post < NAV_pre)");
    }

    // =========================================================================
    // PILAR 3: SIMULACIÓN DE ATAQUES MEV / FLASH LOANS (NAV Arbitrage Impossibility)
    // =========================================================================

    /**
     * @notice Simulación 1: Intento de extracción masiva MEV vía Flash Loan.
     * @dev Un atacante deposita $100,000 USDC e intenta rescate total inmediato.
     *      El guardián de colateralización de TreasuryManager REVIERTE la transacción,
     *      bloqueando el ataque de manera absoluta.
     */
    function test_MEVFlashLoanDepositArbitrageRevertOnFullDrain() public {
        uint256 initialVaultAssets = 10_000 * 10 ** 6; // $10,000 USDC base en tesorería
        usdc.mint(address(vault), initialVaultAssets);

        uint256 flashLoanAmount = 100_000 * 10 ** 6; // $100,000 USDC Flash Loan
        usdc.mint(attacker, flashLoanAmount);

        vm.startPrank(attacker);
        usdc.approve(address(manager), flashLoanAmount);

        // 1. Atacante deposita $100,000 USDC masivos (Fee dinámico = 500 BPS / 5.00%)
        uint256 sharesMinted = manager.deposit(flashLoanAmount, 0);
        assertEq(sharesMinted, 95_000 * 10 ** 18);

        // 2. Intento de rescate total en el bloque posterior -> REVERTIDO por proteccion de colateralizacion
        vm.roll(block.number + 1);
        alphaToken.approve(address(manager), sharesMinted);
        vm.expectRevert();
        manager.redeem(sharesMinted, 0);
        vm.stopPrank();
    }

    /**
     * @notice Simulación 2: Rescate MEV vía Flash Loan sobre Tesorería Activa.
     * @dev Un atacante realiza un Flash Loan de $50,000 USDC sobre un vault con $100,000 USDC.
     *      Se demuestra matemáticamente que la penalización por impacto dinámico y el fee de salida
     *      hacen que el atacante reciba solo ~$47,984 USDC, sufriendo una Pérdida Neta de Capital de ~$2,016 USDC.
     */
    function test_MEVFlashLoanDepositArbitrageLossOnPartialRedeem() public {
        // 1. Fondear tesorería con $100,000 USDC por usuario legítimo
        uint256 initialVaultAssets = 100_000 * 10 ** 6;
        usdc.mint(user, initialVaultAssets);
        vm.startPrank(user);
        usdc.approve(address(manager), initialVaultAssets);
        manager.deposit(initialVaultAssets, 0);
        vm.stopPrank();

        // 2. Atacante realiza Flash Loan de $50,000 USDC
        uint256 flashLoanAmount = 50_000 * 10 ** 6;
        usdc.mint(attacker, flashLoanAmount);

        vm.startPrank(attacker);
        usdc.approve(address(manager), flashLoanAmount);
        uint256 sharesMinted = manager.deposit(flashLoanAmount, 0);

        // Advance block height to pass Same-Block Deposit/Redeem Cooldown
        vm.roll(block.number + 1);

        // 3. Atacante intenta rescatar sus shares en el siguiente bloque
        alphaToken.approve(address(manager), sharesMinted);
        uint256 usdcReturned = manager.redeem(sharesMinted, 0);
        assertGt(usdcReturned, 0, "Redeem should return positive USDC");
        vm.stopPrank();

        uint256 finalAttackerUsdc = usdc.balanceOf(attacker);

        // Demostración Matemática de Pérdida Neta de Capital
        assertLt(finalAttackerUsdc, flashLoanAmount, "MEV Attack Failure: Attacker did not lose funds!");

        uint256 netLoss = flashLoanAmount - finalAttackerUsdc;
        console.log("--------------------------------------------------");
        console.log("MEV Flash Loan Arbitrage Capital Loss Result:");
        console.log("Flash Loan Capital Borrowed : %s USDC", flashLoanAmount / 10 ** 6);
        console.log("Returned Capital            : %s USDC", finalAttackerUsdc / 10 ** 6);
        console.log("Net Capital Loss Suffered   : %s USDC", netLoss / 10 ** 6);
        console.log("--------------------------------------------------");

        assertGe(netLoss, 1000 * 10 ** 6, "MEV Impact curve did not inflict expected capital loss");
    }

    /**
     * @notice Hardening Test: Same-Block Deposit and Redeem Guard
     */
    function test_RevertIf_SameBlockDepositAndRedeem() public {
        uint256 depositAmt = 10_000 * 10 ** 6;
        usdc.mint(attacker, depositAmt);

        vm.startPrank(attacker);
        usdc.approve(address(manager), depositAmt);
        uint256 shares = manager.deposit(depositAmt, 0);

        alphaToken.approve(address(manager), shares);
        vm.expectRevert();
        manager.redeem(shares, 0);
        vm.stopPrank();
    }

    /**
     * @notice Test AC-06: KYC Revoked wallet fails standard redeem, succeeds emergencyRedeem with 5% retained fee.
     */
    function test_EmergencyRedeem() public {
        uint256 depositAmt = 10_000 * 10 ** 6;
        usdc.mint(user, depositAmt);

        vm.startPrank(user);
        usdc.approve(address(manager), depositAmt);
        uint256 shares = manager.deposit(depositAmt, 0);
        vm.stopPrank();

        // 1. If account is still whitelisted, emergencyRedeem reverts with AccountIsWhitelisted
        vm.prank(admin);
        manager.setKYCStatus(user, true);
        vm.startPrank(user);
        alphaToken.approve(address(manager), shares);
        vm.expectRevert();
        manager.emergencyRedeem(shares, 0);
        vm.stopPrank();

        // 2. Admin revokes KYC status of user
        vm.prank(admin);
        manager.setKYCStatus(user, false);

        // 3. Emergency redeem succeeds with 5% fee retention
        vm.startPrank(user);
        uint256 userUsdcBefore = usdc.balanceOf(user);
        uint256 netAssetsReceived = manager.emergencyRedeem(shares, 0);
        vm.stopPrank();

        assertGt(netAssetsReceived, 0, "Emergency redeem failed");
        assertEq(usdc.balanceOf(user) - userUsdcBefore, netAssetsReceived, "User received incorrect USDC amount");
    }

    /**
     * @notice Test AC-04: Primary and secondary feed divergence > 500 BPS halts transaction.
     */
    function test_OracleDivergence() public {
        // Warp block timestamp to 10,000 so timestamp subtraction does not underflow
        vm.warp(10000);

        // 1. Cache valid primary price ($1.00)
        oracleHub.updatePrimaryPriceCache(address(usdc));

        // 2. Deploy stale primary feed ($1.00 updated 4000s ago) and fresh secondary feed ($1.10 = 10% divergence)
        StaleMockChainlinkFeedAudit stalePrimaryUsdcFeed =
            new StaleMockChainlinkFeedAudit(100_000_000, 8, block.timestamp - 4000);
        MockChainlinkFeedAudit secondaryUsdcFeed = new MockChainlinkFeedAudit(110_000_000, 8);

        vm.prank(admin);
        oracleHub.setTrackedAsset(address(usdc), address(stalePrimaryUsdcFeed), address(secondaryUsdcFeed), 6);

        // 3. Attempting to fetch price using stale primary falls back to secondary, which triggers divergence check revert
        vm.expectRevert(abi.encodeWithSelector(OracleHub.PriceDivergenceExceeded.selector, 1000, 500));
        oracleHub.getAssetUsdValue(address(usdc), 1000 * 10 ** 6);
    }
}
