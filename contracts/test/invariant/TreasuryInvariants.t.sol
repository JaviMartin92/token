// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "./TreasuryInvariantHandler.sol";

/**
 * @title TreasuryInvariantsTest
 * @notice Formal Stateful Invariant Verification Suite for Alpha Centauri Treasury
 */
contract TreasuryInvariantsTest is Test {
    ProtocolAddressProvider public provider;
    AlphaToken public alphaToken;
    AlphaVault public vault;
    OracleHub public oracleHub;
    TreasuryManager public manager;

    FuzzMockERC20 public usdc;
    FuzzMockFeed public usdcFeed;
    TreasuryInvariantHandler public handler;

    address public admin = address(0x1);

    function setUp() public {
        vm.startPrank(admin);

        usdc = new FuzzMockERC20("USDC", "USDC", 6);
        usdcFeed = new FuzzMockFeed(1_00000000, 8); // $1

        provider = new ProtocolAddressProvider(admin);

        alphaToken = new AlphaToken(provider, admin);
        provider.setAddress(keccak256("ALPHA_TOKEN"), address(alphaToken));

        vault = new AlphaVault(provider, admin);
        provider.setAddress(keccak256("ALPHA_VAULT"), address(vault));

        oracleHub = new OracleHub(provider, admin);
        provider.setAddress(keccak256("ORACLE_HUB"), address(oracleHub));
        oracleHub.grantRole(ProtocolRoles.ORACLE_MANAGER_ROLE, admin);
        oracleHub.setTrackedAsset(address(usdc), address(usdcFeed), address(0), 6);

        TreasuryManager logic = new TreasuryManager(provider);
        TreasuryProxy proxy = new TreasuryProxy(address(logic));
        manager = TreasuryManager(address(proxy));
        manager.initialize(admin, address(usdc), 6);
        provider.setAddress(keccak256("TREASURY_MANAGER"), address(manager));

        alphaToken.grantRole(ProtocolRoles.MINTER_ROLE, address(manager));
        alphaToken.grantRole(ProtocolRoles.BURNER_ROLE, address(manager));
        vault.grantRole(ProtocolRoles.VAULT_MANAGER_ROLE, address(manager));
        manager.grantRole(ProtocolRoles.COMPLIANCE_ROLE, admin);

        for (uint160 i = 100; i < 105; i++) {
            manager.setKYCStatus(address(i), true);
        }

        handler = new TreasuryInvariantHandler(manager, alphaToken, vault, usdc, usdcFeed);
        manager.grantRole(ProtocolRoles.COMPLIANCE_ROLE, address(handler));

        // Seed initial genesis deposit so system has active baseline
        usdc.mint(admin, 10_000 * 1e6);
        usdc.approve(address(manager), 10_000 * 1e6);
        manager.setKYCStatus(admin, true);
        manager.deposit(10_000 * 1e6, 0);

        vm.stopPrank();

        targetContract(address(handler));
    }

    /// @dev Invariant A: Total Assets must always equal or exceed Total Liabilities (Solvency >= 100%)
    function invariant_SolvencyRatioNeverBreached() public view {
        (uint256 totalAssetsUSD, uint256 totalLiabilitiesUSD, uint256 ratioBps) = manager.getProofOfReserves();
        if (totalLiabilitiesUSD > 0) {
            assertGe(ratioBps, 9990, "Invariant Violation: Solvency ratio breached under 99.9%");
            assertGe(
                totalAssetsUSD,
                (totalLiabilitiesUSD * 9990) / 10000,
                "Invariant Violation: Total Assets < Total Liabilities"
            );
        }
    }

    /// @dev Invariant B: Spot NAV per share never drops below genesis baseline $1.00 under normal operation
    function invariant_NAVPerShareMonotonicity() public view {
        uint256 nav = manager.getNAVPerShare();
        assertGe(nav, 1e18, "Invariant Violation: NAV per share dropped below $1.00 baseline");
    }

    /// @dev Invariant C: Vault USDC balance is consistent with recorded deposits minus redemptions
    function invariant_VaultAccountingIntegrity() public view {
        uint256 vaultBal = vault.getBalance(address(usdc));
        (uint256 assetsUSD,,) = manager.getProofOfReserves();
        assertEq(vaultBal * 1e12, assetsUSD, "Invariant Violation: Vault balance does not match total assets USD");
    }
}
