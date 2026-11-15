// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/VirajeHypervisor.sol";
import "../src/ProtocolAddressProvider.sol";
import "../src/ProtocolRoles.sol";
import "../src/interfaces/IVirajeHypervisor.sol";

contract MockTreasuryForHypervisor {
    uint256 public navPerShare = 1010000000000000000; // $1.01
    uint256 public totalAssets = 1000000 * 1e18;      // $1M USD
    uint256 public totalLiabilities = 800000 * 1e18; // $800k USD
    uint256 public collateralRatio = 12500;           // 125%

    function setHealth(uint256 _nav, uint256 _assets, uint256 _cr) external {
        navPerShare = _nav;
        totalAssets = _assets;
        collateralRatio = _cr;
    }

    function getNAVPerShare() external view returns (uint256) {
        return navPerShare;
    }

    function getProofOfReserves() external view returns (uint256, uint256, uint256) {
        return (totalAssets, totalLiabilities, collateralRatio);
    }
}

contract MockERC20ForHypervisor {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amt) external {
        balanceOf[to] += amt;
    }

    function approve(address spender, uint256 amt) external returns (bool) {
        allowance[msg.sender][spender] = amt;
        return true;
    }
}

contract VirajeHypervisorTest is Test {
    ProtocolAddressProvider public ap;
    VirajeHypervisor public hypervisor;
    MockTreasuryForHypervisor public mockTreasury;
    MockERC20ForHypervisor public mockVirajeToken;

    address public admin = address(0xAA);
    address public user = address(0xBB);

    function setUp() public {
        vm.startPrank(admin);
        ap = new ProtocolAddressProvider(admin);
        mockTreasury = new MockTreasuryForHypervisor();
        mockVirajeToken = new MockERC20ForHypervisor();

        ap.setAddress(ap.ID_TREASURY_MANAGER(), address(mockTreasury));
        ap.setAddress(ap.ID_VIRAJE_TOKEN(), address(mockVirajeToken));

        hypervisor = new VirajeHypervisor(address(ap), admin);
        ap.setAddress(ap.ID_HYPERVISOR(), address(hypervisor));
        vm.stopPrank();
    }

    function test_InitialConfiguration() public {
        IVirajeHypervisor.HypervisorConfig memory c = hypervisor.getConfig();
        assertEq(c.minCollateralRatioBps, 10000);
        assertEq(c.maxTreasuryLoanRatioBps, 2000);
        assertFalse(c.isPaused);
        assertTrue(c.enforceOnChain);
    }

    function test_AssessTreasuryHealth() public {
        IVirajeHypervisor.TreasuryHealthReport memory h = hypervisor.assessTreasuryHealth();
        assertTrue(h.isHealthy);
        assertEq(h.navPerShare, 1010000000000000000);
        assertEq(h.collateralRatioBps, 12500);
        assertEq(h.maxDebtCapUSD, 200000 * 1e18); // 20% of $1M
    }

    function test_InspectRedeem_InsufficientBalance() public {
        bytes memory data = abi.encodeWithSelector(bytes4(0xba087652), 500 * 1e18); // 500 shares
        IVirajeHypervisor.PreFlightReport memory report = hypervisor.inspectPreFlight(
            address(mockTreasury),
            data,
            user
        );
        assertFalse(report.isSafe);
        assertEq(report.anomalyCode, hypervisor.ANOMALY_INSUFFICIENT_BALANCE());
        assertEq(report.riskScore, 85);
    }

    function test_InspectRedeem_InsufficientAllowance() public {
        mockVirajeToken.mint(user, 1000 * 1e18);
        bytes memory data = abi.encodeWithSelector(bytes4(0xba087652), 500 * 1e18);
        IVirajeHypervisor.PreFlightReport memory report = hypervisor.inspectPreFlight(
            address(mockTreasury),
            data,
            user
        );
        assertFalse(report.isSafe);
        assertEq(report.anomalyCode, hypervisor.ANOMALY_INSUFFICIENT_ALLOWANCE());
        assertEq(report.riskScore, 50);
    }

    function test_InspectRedeem_Safe() public {
        mockVirajeToken.mint(user, 1000 * 1e18);
        vm.prank(user);
        mockVirajeToken.approve(address(mockTreasury), 1000 * 1e18);

        bytes memory data = abi.encodeWithSelector(bytes4(0xba087652), 500 * 1e18);
        IVirajeHypervisor.PreFlightReport memory report = hypervisor.inspectPreFlight(
            address(mockTreasury),
            data,
            user
        );
        assertTrue(report.isSafe);
        assertEq(report.anomalyCode, bytes32(0));
        assertEq(report.riskScore, 5);
    }

    function test_VerifyStateTransition_RevertsOnNAVDecrease() public {
        uint256 preNAV = 1010000000000000000;
        uint256 postNAV = 950000000000000000; // Decreased by ~6%
        vm.expectRevert(abi.encodeWithSelector(IVirajeHypervisor.InvariantNAVDecreased.selector, preNAV, postNAV));
        hypervisor.verifyStateTransition(preNAV, postNAV, 12000, 12000);
    }

    function test_VerifyStateTransition_RevertsOnInsolvency() public {
        uint256 preNAV = 1010000000000000000;
        uint256 postNAV = 1010000000000000000;
        uint256 preCR = 11000;
        uint256 postCR = 9500; // 95% < 100%
        vm.expectRevert(abi.encodeWithSelector(IVirajeHypervisor.InvariantSolvencyBreached.selector, postCR, 10000));
        hypervisor.verifyStateTransition(preNAV, postNAV, preCR, postCR);
    }

    function test_EmergencyPause() public {
        vm.prank(admin);
        hypervisor.setPause(true);

        bytes memory data = abi.encodeWithSelector(bytes4(0xba087652), 100 * 1e18);
        IVirajeHypervisor.PreFlightReport memory report = hypervisor.inspectPreFlight(
            address(mockTreasury),
            data,
            user
        );
        assertFalse(report.isSafe);
        assertEq(report.anomalyCode, hypervisor.ANOMALY_PAUSED());
        assertEq(report.riskScore, 100);

        vm.expectRevert(IVirajeHypervisor.HypervisorPaused.selector);
        hypervisor.verifyStateTransition(1e18, 1e18, 12000, 12000);
    }
}
