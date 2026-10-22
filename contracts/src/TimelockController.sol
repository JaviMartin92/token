// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./interfaces/IProtocolErrors.sol";

/**
 * @title TimelockController
 * @notice Delays administrative and governance operations by 72 hours for transparency and user protection.
 */
contract TimelockController is AccessControl {
    // Domain Custom Errors
    error InvalidDelay();
    error TransactionNotQueued();
    error DelayNotElapsed();
    error TransactionStale();
    error TransactionAlreadyExecuted();
    error CallExecutionFailed();

    uint256 public constant MIN_DELAY = 1 days;
    uint256 public constant MAX_DELAY = 30 days;

    struct Transaction {
        address target;
        uint64 timestamp;
        bool executed;
        uint256 value;
        bytes data;
    }

    mapping(bytes32 => Transaction) public queuedTransactions;
    uint256 public delay;

    event TransactionQueued(bytes32 indexed txHash, address indexed target, uint256 value, bytes data, uint256 eta);
    event TransactionExecuted(bytes32 indexed txHash, address indexed target, uint256 value, bytes data);
    event TransactionCancelled(bytes32 indexed txHash);

    constructor(uint256 _delay, address _initialOwner) {
        address admin = (_initialOwner != address(0)) ? _initialOwner : msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ProtocolRoles.ADMIN_ROLE, admin);
        if (_delay < MIN_DELAY || _delay > MAX_DELAY) revert InvalidDelay();
        delay = _delay;
    }

    function queueTransaction(address target, uint256 value, bytes calldata data)
        external
        onlyRole(ProtocolRoles.ADMIN_ROLE)
        returns (bytes32 txHash)
    {
        if (target == address(0)) revert IProtocolErrors.ZeroAddress();
        uint256 eta = block.timestamp + delay;
        txHash = keccak256(abi.encode(target, value, data, eta));

        queuedTransactions[txHash] =
            Transaction({target: target, timestamp: uint64(eta), executed: false, value: value, data: data});

        emit TransactionQueued(txHash, target, value, data, eta);
    }

    function executeTransaction(address target, uint256 value, bytes calldata data, uint256 eta)
        external
        onlyRole(ProtocolRoles.ADMIN_ROLE)
        returns (bytes memory)
    {
        bytes32 txHash = keccak256(abi.encode(target, value, data, eta));
        Transaction storage txRecord = queuedTransactions[txHash];

        if (txRecord.timestamp == 0) revert TransactionNotQueued();
        if (block.timestamp < txRecord.timestamp) revert DelayNotElapsed();
        if (block.timestamp > txRecord.timestamp + 14 days) revert TransactionStale();
        if (txRecord.executed) revert TransactionAlreadyExecuted();

        txRecord.executed = true;

        (bool success, bytes memory returnData) = target.call{value: value}(data);
        if (!success) revert CallExecutionFailed();

        emit TransactionExecuted(txHash, target, value, data);
        return returnData;
    }

    function cancelTransaction(bytes32 txHash) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (queuedTransactions[txHash].timestamp == 0) revert TransactionNotQueued();
        delete queuedTransactions[txHash];
        emit TransactionCancelled(txHash);
    }
}
