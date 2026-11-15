// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/FounderReserveVestingVault.sol";
import "../src/VirajeToken.sol";
import "../src/ProtocolAddressProvider.sol";
import "../src/TreasuryManager.sol";
import "../src/TreasuryProxy.sol";
import "./mocks/MockERC20.sol";

contract MockTreasuryForVesting is ITreasury {
    uint256 public mockAssets = 100_000 * 1e18;
    uint256 public mockLiabilities = 100_000 * 1e18;
    uint256 public mockNav = 1e18;

    function setMockState(uint256 _assets, uint256 _liabilities, uint256 _nav) external {
        mockAssets = _assets;
        mockLiabilities = _liabilities;
        mockNav = _nav;
    }

    function getProofOfReserves() external view returns (uint256, uint256, uint256) {
        uint256 ratio = mockLiabilities == 0 ? 10000 : (mockAssets * 10000) / mockLiabilities;
        return (mockAssets, mockLiabilities, ratio);
    }

    function getNAVPerShare() external view returns (uint256) {
        return mockNav;
    }

    // Unused interface stubs
    function getNAV() external pure returns (uint256) { return 0; }
    function getNetCirculatingShares() external pure returns (uint256) { return 0; }
    function deposit(uint256, uint256) external pure returns (uint256) { return 0; }
    function depositFor(address, uint256, uint256) external pure returns (uint256) { return 0; }
    function deposit(uint256) external pure returns (uint256) { return 0; }
    function mintCorporateFeeShares(uint256) external pure returns (uint256) { return 0; }
    function notifyReserveFee(uint256) external {}
    function redeem(uint256) external pure returns (uint256) { return 0; }
    function redeem(uint256, uint256) external pure returns (uint256) { return 0; }
    function redeemFor(address, address, uint256, uint256) external pure returns (uint256) { return 0; }
    function releaseVaultPayout(address, uint256) external {}
    function recordBurn(uint256) external {}
    function virajeVault() external pure returns (address) { return address(0); }
    function disburseTreasuryLoan(address, uint256) external {}
    function treasuryLoanLimits() external pure returns (uint256, uint256, uint256) { return (0, 0, 0); }
    function recordTreasuryLoanRepayment(uint256) external {}
    function totalBurnedTokens() external pure returns (uint256) { return 0; }
}

contract FounderReserveVestingVaultTest is Test {
    FounderReserveVestingVault public vault;
    VirajeToken public virajeToken;
    MockTreasuryForVesting public mockTreasury;
    ProtocolAddressProvider public ap;

    address public admin = address(0xAD);
    address public founder = address(0xF0);
    address public attacker = address(0xBAD);

    function setUp() public {
        vm.startPrank(admin);
        ap = new ProtocolAddressProvider(admin);
        virajeToken = new VirajeToken(ap, admin);
        mockTreasury = new MockTreasuryForVesting();

        vault = new FounderReserveVestingVault(
            address(virajeToken),
            address(mockTreasury),
            founder,
            admin
        );

        // Grant MINTER_ROLE to admin and mint 100,000 VIRAJE into vault
        virajeToken.grantRole(ProtocolRoles.MINTER_ROLE, admin);
        virajeToken.mint(address(vault), 100_000 * 1e18);
        vm.stopPrank();
    }

    function test_InitialState() public view {
        assertEq(vault.remainingAllocation(), 100_000 * 1e18);
        assertEq(vault.totalClaimed(), 0);
        assertEq(vault.beneficiary(), founder);
    }

    function test_ClaimBlockedWhenNoSurplus() public {
        // Solvency = 100% (Assets == Liabilities) -> Surplus = 0
        mockTreasury.setMockState(100_000 * 1e18, 100_000 * 1e18, 1e18);

        (uint256 claimable, uint256 surplus,, bool canClaim) = vault.getClaimableInfo();
        assertEq(claimable, 0);
        assertEq(surplus, 0);
        assertFalse(canClaim);

        vm.prank(founder);
        vm.expectRevert();
        vault.claimVestedViraje();
    }

    function test_ClaimAllowedOnSurplus() public {
        // Assets = 150,000 USD, Liabilities = 100,000 USD -> Surplus = 50,000 USD
        mockTreasury.setMockState(150_000 * 1e18, 100_000 * 1e18, 1e18);

        // 10% of 50,000 USD = 5,000 USD -> 5,000 VIRAJE at $1.00 NAV
        (uint256 claimable, uint256 surplus,, bool canClaim) = vault.getClaimableInfo();
        assertEq(surplus, 50_000 * 1e18);
        assertEq(claimable, 5_000 * 1e18);
        assertTrue(canClaim);

        vm.prank(founder);
        uint256 claimed = vault.claimVestedViraje();

        assertEq(claimed, 5_000 * 1e18);
        assertEq(virajeToken.balanceOf(founder), 5_000 * 1e18);
        assertEq(vault.totalClaimed(), 5_000 * 1e18);
        assertEq(vault.remainingAllocation(), 95_000 * 1e18);
    }

    function test_CooldownEnforced() public {
        mockTreasury.setMockState(150_000 * 1e18, 100_000 * 1e18, 1e18);

        vm.prank(founder);
        vault.claimVestedViraje();

        // Immediate second claim must revert due to 72h cooldown
        vm.prank(founder);
        vm.expectRevert();
        vault.claimVestedViraje();

        // Warp 71 hours (still active)
        vm.warp(block.timestamp + 71 hours);
        vm.prank(founder);
        vm.expectRevert();
        vault.claimVestedViraje();

        // Warp to 72 hours + 1s -> Allowed
        vm.warp(block.timestamp + 1 hours + 1);
        vm.prank(founder);
        uint256 secondClaim = vault.claimVestedViraje();
        assertEq(secondClaim, 5_000 * 1e18);
        assertEq(virajeToken.balanceOf(founder), 10_000 * 1e18);
    }

    function test_NonBeneficiaryCannotClaim() public {
        mockTreasury.setMockState(150_000 * 1e18, 100_000 * 1e18, 1e18);

        vm.prank(attacker);
        vm.expectRevert(FounderReserveVestingVault.UnauthorizedBeneficiary.selector);
        vault.claimVestedViraje();
    }
}
