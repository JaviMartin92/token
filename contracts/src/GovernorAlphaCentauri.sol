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
 * @notice On-chain DAO Governor with 72-hour timelock execution, anti-spam proposal threshold,
 *         minimum quorum requirements, and immutable veto on system vaults.
 */
contract GovernorAlphaCentauri is AccessControl {
    IGovernanceStakingVotes public immutable stakingToken;
    address public timelock;

    // System vault addresses vetoed from participating in governance voting
    address public alphaVault;
    address public communityYieldVault;
    address public treasuryManager;

    uint256 public constant VOTING_DELAY = 1; // 1 block voting delay
    uint256 public constant VOTING_PERIOD = 50400; // ~7 days in blocks (Arbitrum / EVM standard)
    
    // Institutional Anti-Spam & Quorum Governance Parameters
    uint256 public proposalThreshold = 25000e18; // Minimum 25,000 stALPHA to submit a proposal
    uint256 public quorumVotes = 80000e18; // Minimum 80,000 stALPHA (~4% of circulating voting power)

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
        uint256 startBlock;
        uint256 endBlock;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        uint256 eta;
        bool canceled;
        bool executed;
        bytes32 timelockTxHash;
    }

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => address) public proposalTargets;
    mapping(uint256 => uint256) public proposalValues;
    mapping(uint256 => bytes) public proposalCalldatas;
    mapping(uint256 => string) public proposalDescriptions;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ProposalCreated(
        uint256 indexed id,
        address indexed proposer,
        address target,
        uint256 value,
        bytes data,
        string description,
        uint256 startBlock,
        uint256 endBlock
    );
    event VoteCast(address indexed voter, uint256 indexed proposalId, uint8 support, uint256 weight, string reason);
    event ProposalCanceled(uint256 indexed id);
    event ProposalQueued(uint256 indexed id, bytes32 txHash, uint256 eta);
    event ProposalExecuted(uint256 indexed id);
    event ProposalThresholdUpdated(uint256 newThreshold);
    event QuorumVotesUpdated(uint256 newQuorum);

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

    /**
     * @notice Creates an on-chain DAO proposal. Requires proposer to hold at least proposalThreshold stALPHA.
     */
    function propose(
        address target,
        uint256 value,
        bytes calldata data,
        string memory description
    ) public returns (uint256 proposalId) {
        uint256 voterVotes = _getVotes(msg.sender, block.number - 1);
        if (voterVotes < proposalThreshold) revert ProposerVotesBelowThreshold(voterVotes, proposalThreshold);

        unchecked {
            proposalId = ++proposalCount;
        }
        uint256 startBlock = block.number + VOTING_DELAY;
        uint256 endBlock = startBlock + VOTING_PERIOD;

        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
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

        proposalTargets[proposalId] = target;
        proposalValues[proposalId] = value;
        proposalCalldatas[proposalId] = data;
        proposalDescriptions[proposalId] = description;

        emit ProposalCreated(proposalId, msg.sender, target, value, data, description, startBlock, endBlock);
    }

    /**
     * @notice Legacy propose overload without explicit description.
     */
    function propose(address target, uint256 value, bytes calldata data) external returns (uint256 proposalId) {
        return propose(target, value, data, "");
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
        if (msg.sender != p.proposer && _getVotes(p.proposer, block.number - 1) >= proposalThreshold) {
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
        if (p.forVotes <= p.againstVotes || totalVotes < quorumVotes) return ProposalState.Defeated;
        if (p.timelockTxHash == bytes32(0)) return ProposalState.Succeeded;
        return ProposalState.Queued;
    }

    function queue(uint256 proposalId) external returns (bytes32 txHash) {
        if (state(proposalId) != ProposalState.Succeeded) revert ProposalNotSucceeded();
        Proposal storage p = proposals[proposalId];

        address target = proposalTargets[proposalId];
        uint256 value = proposalValues[proposalId];
        bytes memory data = proposalCalldatas[proposalId];

        txHash = ITimelock(timelock).queueTransaction(target, value, data);
        p.timelockTxHash = txHash;
        p.eta = block.timestamp + ITimelock(timelock).delay();
        emit ProposalQueued(proposalId, txHash, p.eta);
    }

    function execute(uint256 proposalId) external payable returns (bytes memory) {
        if (state(proposalId) != ProposalState.Queued) revert ProposalNotQueued();
        Proposal storage p = proposals[proposalId];
        p.executed = true;

        address target = proposalTargets[proposalId];
        uint256 value = proposalValues[proposalId];
        bytes memory data = proposalCalldatas[proposalId];

        bytes memory res = ITimelock(timelock).executeTransaction(target, value, data, p.eta);
        emit ProposalExecuted(proposalId);
        return res;
    }

    function getProposalActions(uint256 proposalId)
        external
        view
        returns (address target, uint256 value, bytes memory data, string memory description)
    {
        return (
            proposalTargets[proposalId],
            proposalValues[proposalId],
            proposalCalldatas[proposalId],
            proposalDescriptions[proposalId]
        );
    }

    function setProposalThreshold(uint256 newThreshold) external {
        if (msg.sender != timelock && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert Unauthorized();
        proposalThreshold = newThreshold;
        emit ProposalThresholdUpdated(newThreshold);
    }

    function setQuorumVotes(uint256 newQuorum) external {
        if (msg.sender != timelock && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert Unauthorized();
        quorumVotes = newQuorum;
        emit QuorumVotesUpdated(newQuorum);
    }
}
