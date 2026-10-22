// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./interfaces/IProtocolErrors.sol";

interface IGovernanceStakingVotes {
    function getVotes(address account) external view returns (uint256);
    function getPastVotes(address account, uint256 blockNumber) external view returns (uint256);
}

interface ITimelock {
    function delay() external view returns (uint256);
    function queueTransaction(address target, uint256 value, bytes calldata data) external returns (bytes32);
    function executeTransaction(address target, uint256 value, bytes calldata data, uint256 eta)
        external
        returns (bytes memory);
}

/**
 * @title GovernorAlphaCentauri
 * @notice On-chain DAO Governor with 72-hour timelock execution and immutable veto on system vaults.
 */
contract GovernorAlphaCentauri is AccessControl {
    IGovernanceStakingVotes public immutable stakingToken;
    address public timelock;

    // System vault addresses vetoed from participating in governance voting
    address public alphaVault;
    address public communityYieldVault;
    address public treasuryManager;

    uint256 public constant VOTING_DELAY = 1; // 1 block voting delay
    uint256 public constant VOTING_PERIOD = 50400; // ~7 days in blocks
    uint256 public constant QUORUM_VOTES = 10000e18; // 10,000 stALPHA quorum

    enum ProposalState {
        Pending,
        Active,
        Canceled,
        Defeated,
        Succeeded,
        Queued,
        Expired,
        Executed
    }

    struct Proposal {
        uint256 id;
        address proposer;
        bool canceled;
        bool executed;
        address target;
        uint256 value;
        bytes data;
        uint256 startBlock;
        uint256 endBlock;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        uint256 eta;
        bytes32 timelockTxHash;
    }

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ProposalCreated(
        uint256 indexed id,
        address indexed proposer,
        address target,
        uint256 value,
        bytes data,
        uint256 startBlock,
        uint256 endBlock
    );
    event VoteCast(address indexed voter, uint256 indexed proposalId, uint8 support, uint256 weight, string reason);
    event ProposalCanceled(uint256 indexed id);
    event ProposalQueued(uint256 indexed id, bytes32 txHash, uint256 eta);
    event ProposalExecuted(uint256 indexed id);

    constructor(
        address _stakingToken,
        address _timelock,
        address _alphaVault,
        address _communityYieldVault,
        address _treasuryManager,
        address _initialOwner
    ) {
        address admin = (_initialOwner != address(0)) ? _initialOwner : msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ProtocolRoles.ADMIN_ROLE, admin);
        stakingToken = IGovernanceStakingVotes(_stakingToken);
        timelock = _timelock;
        alphaVault = _alphaVault;
        communityYieldVault = _communityYieldVault;
        treasuryManager = _treasuryManager;
    }

    /**
     * @notice Immutable veto: System vaults and Treasury return 0 voting weight.
     */
    function _getVotes(address account, uint256 blockNumber) internal view returns (uint256) {
        if (
            account == alphaVault || account == communityYieldVault || account == treasuryManager
                || account == address(0)
        ) {
            return 0;
        }
        return stakingToken.getPastVotes(account, blockNumber);
    }

    function getVotes(address account, uint256 blockNumber) external view returns (uint256) {
        return _getVotes(account, blockNumber);
    }

    error ProposerVotesBelowThreshold(uint256 actual, uint256 threshold);
    error VotingClosed();
    error AlreadyVoted();
    error NoVotingWeight();
    error ProposalNotSucceeded();
    error ProposalNotQueued();
    error InvalidVoteType();
    error ProposalAlreadyExecuted();
    error Unauthorized();

    function propose(address target, uint256 value, bytes calldata data) external returns (uint256 proposalId) {
        uint256 voterVotes = _getVotes(msg.sender, block.number - 1);
        if (voterVotes < 100e18) revert ProposerVotesBelowThreshold(voterVotes, 100e18);

        unchecked {
            proposalId = ++proposalCount;
        }
        uint256 startBlock = block.number + VOTING_DELAY;
        uint256 endBlock = startBlock + VOTING_PERIOD;

        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            target: target,
            value: value,
            data: data,
            startBlock: startBlock,
            endBlock: endBlock,
            forVotes: 0,
            againstVotes: 0,
            abstainVotes: 0,
            eta: 0,
            canceled: false,
            executed: false,
            timelockTxHash: bytes32(0)
        });

        emit ProposalCreated(proposalId, msg.sender, target, value, data, startBlock, endBlock);
    }

    function castVote(uint256 proposalId, uint8 support) external returns (uint256 weight) {
        return _castVoteInternal(proposalId, support, "");
    }

    function castVoteWithReason(uint256 proposalId, uint8 support, string calldata reason) external returns (uint256 weight) {
        return _castVoteInternal(proposalId, support, reason);
    }

    function _castVoteInternal(uint256 proposalId, uint8 support, string memory reason) internal returns (uint256 weight) {
        if (support > 2) revert InvalidVoteType();
        Proposal storage p = proposals[proposalId];
        if (block.number < p.startBlock || block.number > p.endBlock) revert VotingClosed();
        if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted();

        weight = _getVotes(msg.sender, p.startBlock - 1);
        if (weight == 0) revert NoVotingWeight();

        hasVoted[proposalId][msg.sender] = true;
        if (support == 0) {
            p.againstVotes += weight;
        } else if (support == 1) {
            p.forVotes += weight;
        } else if (support == 2) {
            p.abstainVotes += weight;
        }

        emit VoteCast(msg.sender, proposalId, support, weight, reason);
    }

    function cancel(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        if (p.executed) revert ProposalAlreadyExecuted();
        if (p.canceled) revert IProtocolErrors.InvalidParameters();
        if (msg.sender != p.proposer && _getVotes(p.proposer, block.number - 1) >= 100e18) {
            revert Unauthorized();
        }

        p.canceled = true;
        emit ProposalCanceled(proposalId);
    }

    function state(uint256 proposalId) public view returns (ProposalState) {
        Proposal storage p = proposals[proposalId];
        if (p.canceled) return ProposalState.Canceled;
        if (p.executed) return ProposalState.Executed;
        if (block.number < p.startBlock) return ProposalState.Pending;
        if (block.number <= p.endBlock) return ProposalState.Active;
        uint256 totalVotes = p.forVotes + p.abstainVotes;
        if (p.forVotes <= p.againstVotes || totalVotes < QUORUM_VOTES) return ProposalState.Defeated;
        if (p.timelockTxHash == bytes32(0)) return ProposalState.Succeeded;
        return ProposalState.Queued;
    }

    function queue(uint256 proposalId) external returns (bytes32 txHash) {
        if (state(proposalId) != ProposalState.Succeeded) revert ProposalNotSucceeded();
        Proposal storage p = proposals[proposalId];

        txHash = ITimelock(timelock).queueTransaction(p.target, p.value, p.data);
        p.timelockTxHash = txHash;
        p.eta = block.timestamp + ITimelock(timelock).delay();
        emit ProposalQueued(proposalId, txHash, p.eta);
    }

    function execute(uint256 proposalId) external payable returns (bytes memory) {
        if (state(proposalId) != ProposalState.Queued) revert ProposalNotQueued();
        Proposal storage p = proposals[proposalId];
        p.executed = true;

        bytes memory res = ITimelock(timelock).executeTransaction(p.target, p.value, p.data, p.eta);
        emit ProposalExecuted(proposalId);
        return res;
    }
}
