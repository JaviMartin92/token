// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/TreasuryManager.sol";
import "../src/TreasuryProxy.sol";
import "../src/ProtocolAddressProvider.sol";
import "../src/AlphaToken.sol";
import "../src/AlphaVault.sol";
import "../src/OracleHub.sol";
import "../src/ProtocolRoles.sol";
import "./ModularProtocol.t.sol";

contract GuardedLaunchTest is Test {
    ProtocolAddressProvider public provider;
    AlphaToken public alphaToken;
    AlphaVault public vault;
    OracleHub public oracleHub;
    TreasuryManager public treasury;

    MockERC20 public usdc;
    MockChainlinkFeed public usdcFeed;

    address public admin = address(0xAA);
    address public user = address(0xB1);
    address public auditEscrow = address(0xC4);

    function setUp() public {
        vm.startPrank(admin);

        usdc = new MockERC20("USD Coin", "USDC", 6);
        usdcFeed = new MockChainlinkFeed(1_00000000, 8); // $1.00

        provider = new ProtocolAddressProvider(admin);

        alphaToken = new AlphaToken(provider, admin);
        provider.setAddress(keccak256("ALPHA_TOKEN"), address(alphaToken));

        vault = new AlphaVault(provider, admin);
        provider.setAddress(keccak256("ALPHA_VAULT"), address(vault));

        oracleHub = new OracleHub(provider, admin);
        provider.setAddress(keccak256("ORACLE_HUB"), address(oracleHub));
        oracleHub.grantRole(ProtocolRoles.ORACLE_MANAGER_ROLE, admin);
        oracleHub.setTrackedAsset(address(usdc), address(usdcFeed), address(0), 6);

        TreasuryManager impl = new TreasuryManager(provider);
        TreasuryProxy proxy = new TreasuryProxy(address(impl));
        treasury = TreasuryManager(address(proxy));
        treasury.initialize(admin, address(usdc), 6);
        provider.setAddress(keccak256("TREASURY_MANAGER"), address(treasury));

        alphaToken.grantRole(ProtocolRoles.MINTER_ROLE, address(treasury));
        alphaToken.grantRole(ProtocolRoles.BURNER_ROLE, address(treasury));
        vault.grantRole(ProtocolRoles.VAULT_MANAGER_ROLE, address(treasury));

        // Fund user with USDC
        usdc.mint(user, 500_000 * 1e6);
        vm.stopPrank();

        vm.prank(user);
        usdc.approve(address(treasury), type(uint256).max);
    }

    function test_GuardedLaunch_RevertsIf_DepositExceedsTvlCap() public {
        vm.startPrank(admin);
        // Set Guarded Launch Cap to 100,000 USD (in 18 decimals)
        treasury.setTvlCap(100_000 * 1e18);
        vm.stopPrank();

        // 1. User deposits 60,000 USDC -> Succeeds
        vm.prank(user);
        treasury.deposit(60_000 * 1e6, 0);

        assertGt(treasury.getTotalNavUSD(), 0);

        // 2. User tries to deposit 50,000 USDC (60k + 50k = 110k > 100k cap) -> Reverts
        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(
                TreasuryManager.TVLCapExceeded.selector,
                treasury.getTotalNavUSD() + (50_000 * 1e18),
                100_000 * 1e18
            )
        );
        treasury.deposit(50_000 * 1e6, 0);

        // 3. DAO expands cap to 200,000 USD via governance
        vm.prank(admin);
        treasury.setTvlCap(200_000 * 1e18);

        // 4. User can now deposit the 50,000 USDC
        vm.prank(user);
        treasury.deposit(50_000 * 1e6, 0);

        assertGt(treasury.getTotalNavUSD(), 100_000 * 1e18);
    }

    function test_DAO_Can_WithdrawUSDC_ForAuditEscrow() public {
        // User deposits 80,000 USDC into protocol
        vm.prank(user);
        treasury.deposit(80_000 * 1e6, 0);

        // Non-admin cannot withdraw funds
        vm.prank(user);
        vm.expectRevert();
        treasury.withdrawUSDC(auditEscrow, 25_000 * 1e6);

        // Admin/Timelock calls withdrawUSDC to pay Code4rena audit escrow
        uint256 escrowBalBefore = usdc.balanceOf(auditEscrow);
        vm.prank(admin);
        treasury.withdrawUSDC(auditEscrow, 25_000 * 1e6);

        uint256 escrowBalAfter = usdc.balanceOf(auditEscrow);
        assertEq(escrowBalAfter - escrowBalBefore, 25_000 * 1e6);
    }
}
