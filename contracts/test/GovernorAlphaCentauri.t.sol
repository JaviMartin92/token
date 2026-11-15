// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/GovernorViraje.sol";
import "../src/TimelockController.sol";
import "../src/GovernanceStaking.sol";
import "../src/VirajeToken.sol";
import "../src/VirajeVault.sol";
import "../src/ProtocolAddressProvider.sol";
import "../src/ProtocolRoles.sol";

contract MockTargetContract {
    uint256 public value;
    event ValueUpdated(uint256 newValue);

    function setValue(uint256 _value) external {
        value = _value;
        emit ValueUpdated(_value);
    }
}

contract GovernorVirajeTest is Test {
    GovernorViraje public governor;
    TimelockController public timelock;
    GovernanceStaking public staking;
    VirajeToken public virajeToken;
    VirajeVault public vault;
    ProtocolAddressProvider public provider;
    MockTargetContract public targetContract;

    address public admin = address(0xAA);
    address public whale = address(0x11); // 100,000 stVIRAJE
    address public minProposer = address(0x22); // 25,000 stVIRAJE
    address public smallUser = address(0x33); // 1,000 stVIRAJE (below threshold)

    function setUp() public {
        vm.startPrank(admin);

        provider = new ProtocolAddressProvider(admin);
        virajeToken = new VirajeToken(provider, admin);
        provider.setAddress(keccak256("VIRAJE_TOKEN"), address(virajeToken));

        vault = new VirajeVault(provider, admin);
        provider.setAddress(keccak256("VIRAJE_VAULT"), address(vault));

        address mockUsdc = address(0x55);
        staking = new GovernanceStaking(address(virajeToken), mockUsdc, admin);
        provider.setAddress(keccak256("GOVERNANCE_STAKING"), address(staking));

        timelock = new TimelockController(3 days, admin);

        governor = new GovernorViraje(
            address(staking),
            address(timelock),
            address(vault),
            address(0),
            address(0),
            admin
        );

        // Grant ADMIN_ROLE on Timelock to Governor
        timelock.grantRole(ProtocolRoles.ADMIN_ROLE, address(governor));

        targetContract = new MockTargetContract();

        // Mint VIRAJE tokens and stake
        virajeToken.grantRole(ProtocolRoles.MINTER_ROLE, admin);
        virajeToken.mint(whale, 105000e18);
        virajeToken.mint(minProposer, 26000e18);
        virajeToken.mint(smallUser, 1500e18);

        vm.stopPrank();

        // Users stake their VIRAJE (delegates to themselves)
        vm.startPrank(whale);
        virajeToken.approve(address(staking), type(uint256).max);
        staking.stake(101011e18); // leaves ~100k net after 1% fee
        staking.delegate(whale);
        vm.stopPrank();

        vm.startPrank(minProposer);
        virajeToken.approve(address(staking), type(uint256).max);
        staking.stake(25500e18); // leaves ~25,245 net after 1% fee
        staking.delegate(minProposer);
        vm.stopPrank();

        vm.startPrank(smallUser);
        virajeToken.approve(address(staking), type(uint256).max);
        staking.stake(1011e18); // leaves ~1,000 net after 1% fee
        staking.delegate(smallUser);
        vm.stopPrank();

        // Advance 2 blocks for voting checkpoint
        vm.roll(block.number + 2);
    }

    function test_RevertIf_ProposerBelow25000Threshold() public {
        bytes memory data = abi.encodeWithSelector(MockTargetContract.setValue.selector, 42);

        vm.startPrank(smallUser);
        vm.expectRevert();
        governor.propose(address(targetContract), 0, data, "Should Fail Spam");
        vm.stopPrank();
    }

    function test_SuccessfulProposalCreation_ByMinProposer() public {
        bytes memory data = abi.encodeWithSelector(MockTargetContract.setValue.selector, 42);

        vm.startPrank(minProposer);
        uint256 proposalId = governor.propose(address(targetContract), 0, data, "Actualizar Parametro a 42");
        vm.stopPrank();

        assertEq(proposalId, 1);
        (uint256 id, address proposer,,,,,,,,,) = governor.proposals(1);
        (address target,,, string memory desc) = governor.getProposalActions(1);

        assertEq(id, 1);
        assertEq(proposer, minProposer);
        assertEq(target, address(targetContract));
        assertEq(desc, "Actualizar Parametro a 42");
        assertTrue(governor.state(1) == GovernorViraje.ProposalState.Pending);
    }

    function test_Voting_Quorum_And_TimelockExecution() public {
        bytes memory data = abi.encodeWithSelector(MockTargetContract.setValue.selector, 999);

        vm.startPrank(minProposer);
        uint256 proposalId = governor.propose(address(targetContract), 0, data, "Ajustar Mock a 999");
        vm.stopPrank();

        // Advance past voting delay (1 block)
        vm.roll(block.number + 2);
        assertTrue(governor.state(proposalId) == GovernorViraje.ProposalState.Active);

        // Whale votes FOR (100k votes, exceeds 80k quorum)
        vm.prank(whale);
        governor.castVote(proposalId, 1); // 1 = FOR

        // Small user votes AGAINST
        vm.prank(smallUser);
        governor.castVote(proposalId, 0); // 0 = AGAINST

        // Advance past voting period (50,400 blocks)
        vm.roll(block.number + 50401);
        assertTrue(governor.state(proposalId) == GovernorViraje.ProposalState.Succeeded);

        // Queue in Timelock
        governor.queue(proposalId);
        assertTrue(governor.state(proposalId) == GovernorViraje.ProposalState.Queued);

        // Attempt execution before delay reverts
        vm.expectRevert();
        governor.execute(proposalId);

        // Warp past 3-day delay
        vm.warp(block.timestamp + 3 days + 1);

        // Execute proposal via Timelock
        governor.execute(proposalId);
        assertTrue(governor.state(proposalId) == GovernorViraje.ProposalState.Executed);
        assertEq(targetContract.value(), 999);
    }

    function test_ProposalDefeated_IfBelowQuorum() public {
        bytes memory data = abi.encodeWithSelector(MockTargetContract.setValue.selector, 100);

        vm.startPrank(minProposer);
        uint256 proposalId = governor.propose(address(targetContract), 0, data, "Defeated Proposal");
        vm.stopPrank();

        vm.roll(block.number + 2);

        // Only minProposer votes (~25k votes < 80k quorum)
        vm.prank(minProposer);
        governor.castVote(proposalId, 1);

        // Advance past voting period
        vm.roll(block.number + 50401);

        // Defeated due to not reaching quorum
        assertTrue(governor.state(proposalId) == GovernorViraje.ProposalState.Defeated);
    }
}
