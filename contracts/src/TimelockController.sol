// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TimelockController
 * @notice Delays administrative and governance operations by 72 hours for transparency and user protection.
 */
contract TimelockController is Ownable {
    uint256 public constant MIN_DELAY = 1 days;
    uint256 public constant MAX_DELAY = 30 days;

    struct Transaction {
        address target;
        uint256 value;
        bytes data;
        uint256 timestamp;
        bool executed;
    }

    mapping(bytes32 => Transaction) public queuedTransactions;
    uint256 public delay;

    event TransactionQueued(bytes32 indexed txHash, address indexed target, uint256 value, bytes data, uint256 eta);
    event TransactionExecuted(bytes32 indexed txHash, address indexed target, uint256 value, bytes data);
    event TransactionCancelled(bytes32 indexed txHash);

    constructor(uint256 _delay, address _initialOwner) Ownable() {
        require(_delay >= MIN_DELAY && _delay <= MAX_DELAY, "Timelock: Invalid delay");
        delay = _delay;
        if (_initialOwner != msg.sender && _initialOwner != address(0)) {
            transferOwnership(_initialOwner);
        }
    }

    function queueTransaction(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlyOwner returns (bytes32 txHash) {
        require(target != address(0), "Timelock: Zero target address");
        uint256 eta = block.timestamp + delay;
        txHash = keccak256(abi.encode(target, value, data, eta));

        queuedTransactions[txHash] = Transaction({
            target: target,
            value: value,
            data: data,
            timestamp: eta,
            executed: false
        });

        emit TransactionQueued(txHash, target, value, data, eta);
    }

    function executeTransaction(
        address target,
        uint256 value,
        bytes calldata data,
        uint256 eta
    ) external onlyOwner returns (bytes memory) {
        bytes32 txHash = keccak256(abi.encode(target, value, data, eta));
        Transaction storage txRecord = queuedTransactions[txHash];

        require(txRecord.timestamp != 0, "Timelock: Transaction not queued");
        require(block.timestamp >= txRecord.timestamp, "Timelock: Delay has not elapsed");
        require(block.timestamp <= txRecord.timestamp + 14 days, "Timelock: Transaction stale");
        require(!txRecord.executed, "Timelock: Transaction already executed");

        txRecord.executed = true;

        (bool success, bytes memory returnData) = target.call{value: value}(data);
        require(success, "Timelock: Call execution failed");

        emit TransactionExecuted(txHash, target, value, data);
        return returnData;
    }

    function cancelTransaction(bytes32 txHash) external onlyOwner {
        require(queuedTransactions[txHash].timestamp != 0, "Timelock: Not queued");
        delete queuedTransactions[txHash];
        emit TransactionCancelled(txHash);
    }
}