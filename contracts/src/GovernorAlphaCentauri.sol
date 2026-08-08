// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IGovernanceStakingVotes {
    function getVotes(address account) external view returns (uint256);
    function getPastVotes(address account, uint256 blockNumber) external view returns (uint256);
}

interface ITimelock {
    function queueTransaction(address target, uint256 value, bytes calldata data) external returns (bytes32);
    function executeTransaction(address target, uint256 value, bytes calldata data, uint256 eta) external returns (bytes memory);
}

/**
 * @title GovernorAlphaCentauri
 * @notice On-chain DAO Governor with 72-hour timelock execution and immutable veto on system vaults.
 */
contract GovernorAlphaCentauri is Ownable {
    IGovernanceStakingVotes public immutable stakingToken;
    address public timelock;

    // System vault addresses vetoed from participating in governance voting
    address public alphaVault;
    address public corporateOpExVault;
    address public corporateProfitVault;
    address public treasuryManager;

    uint256 public constant VOTING_DELAY = 1; // 1 block voting delay
    uint256 public constant VOTING_PERIOD = 50400; // ~7 days in blocks
    uint256 public constant QUORUM_VOTES = 10000e18; // 10,000 stALPHA quorum

    enum ProposalState { Pending, Active, Canceled, Defeated, Succeeded, Queued, Expired, Executed }

    struct Proposal {
        uint256 id;
        address proposer;
        address target;
        uint256 value;
        bytes data;
        uint256 startBlock;
        uint256 endBlock;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 eta;
        bool canceled;
        bool executed;
        bytes32 timelockTxHash;
    }

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ProposalCreated(uint256 indexed id, address indexed proposer, address target, uint256 value, bytes data, uint256 startBlock, uint256 endBlock);
    event VoteCast(address indexed voter, uint256 indexed proposalId, uint8 support, uint256 weight);
    event ProposalQueued(uint256 indexed id, bytes32 txHash, uint256 eta);
    event ProposalExecuted(uint256 indexed id);

    constructor(
        address _stakingToken,
        address _timelock,
        address _alphaVault,
        address _opExVault,
        address _profitVault,
        address _treasuryManager,
        address _initialOwner
    ) Ownable() {
        stakingToken = IGovernanceStakingVotes(_stakingToken);
        timelock = _timelock;
        alphaVault = _alphaVault;
        corporateOpExVault = _opExVault;
        corporateProfitVault = _profitVault;
        treasuryManager = _treasuryManager;

        if (_initialOwner != msg.sender && _initialOwner != address(0)) {
            transferOwnership(_initialOwner);
        }
    }

    /**
     * @notice Immutable veto: System vaults and Treasury return 0 voting weight.
     */
    function _getVotes(address account, uint256 blockNumber) internal view returns (uint256) {
        if (
            account == alphaVault ||
            account == corporateOpExVault ||
            account == corporateProfitVault ||
            account == treasuryManager ||
            account == address(0)
        ) {
            return 0;
        }
        return stakingToken.getPastVotes(account, blockNumber);
    }

    function getVotes(address account, uint256 blockNumber) external view returns (uint256) {
        return _getVotes(account, blockNumber);
    }

    function propose(
        address target,
        uint256 value,
        bytes calldata data
    ) external returns (uint256 proposalId) {
        uint256 voterVotes = _getVotes(msg.sender, block.number - 1);
        require(voterVotes >= 100e18, "Governor: Proposer votes below threshold");

        proposalCount++;
        proposalId = proposalCount;
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
            eta: 0,
            canceled: false,
            executed: false,
            timelockTxHash: bytes32(0)
        });

        emit ProposalCreated(proposalId, msg.sender, target, value, data, startBlock, endBlock);
    }

    function castVote(uint256 proposalId, uint8 support) external returns (uint256 weight) {
        Proposal storage p = proposals[proposalId];
        require(block.number >= p.startBlock && block.number <= p.endBlock, "Governor: Voting closed");
        require(!hasVoted[proposalId][msg.sender], "Governor: Already voted");

        weight = _getVotes(msg.sender, p.startBlock - 1);
        require(weight > 0, "Governor: No voting weight");

        hasVoted[proposalId][msg.sender] = true;
        if (support == 1) {
            p.forVotes += weight;
        } else {
            p.againstVotes += weight;
        }

        emit VoteCast(msg.sender, proposalId, support, weight);
    }

    function state(uint256 proposalId) public view returns (ProposalState) {
        Proposal storage p = proposals[proposalId];
        if (p.canceled) return ProposalState.Canceled;
        if (p.executed) return ProposalState.Executed;
        if (block.number < p.startBlock) return ProposalState.Pending;
        if (block.number <= p.endBlock) return ProposalState.Active;
        if (p.forVotes <= p.againstVotes || p.forVotes < QUORUM_VOTES) return ProposalState.Defeated;
        if (p.timelockTxHash == bytes32(0)) return ProposalState.Succeeded;
        return ProposalState.Queued;
    }

    function queue(uint256 proposalId) external returns (bytes32 txHash) {
        require(state(proposalId) == ProposalState.Succeeded, "Governor: Proposal not succeeded");
        Proposal storage p = proposals[proposalId];

        txHash = ITimelock(timelock).queueTransaction(p.target, p.value, p.data);
        p.timelockTxHash = txHash;
        p.eta = block.timestamp + 3 days;
        emit ProposalQueued(proposalId, txHash, p.eta);
    }

    function execute(uint256 proposalId) external payable returns (bytes memory) {
        require(state(proposalId) == ProposalState.Queued, "Governor: Proposal not queued");
        Proposal storage p = proposals[proposalId];
        p.executed = true;

        bytes memory res = ITimelock(timelock).executeTransaction(p.target, p.value, p.data, p.eta);
        emit ProposalExecuted(proposalId);
        return res;
    }
}
