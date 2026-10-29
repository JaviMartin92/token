// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./interfaces/IProtocolErrors.sol";

/**
 * @title TimelockController
 * @author Alpha Centauri Architecture Team
 * @notice Delays administrative and governance operations by 72 hours (configurable 1 to 30 days)
 *         for transparency and user protection (pure DeFi ragequit window).
 * @dev Enforces Checks-Effects-Interactions pattern for proposal executions.
 *      Propagates low-level revert data on call failure for actionable error diagnostics.
 */
contract TimelockController is AccessControl {
    // --- Domain Custom Errors ---
    error InvalidDelay();
    error TransactionNotQueued();
    error DelayNotElapsed();
    error TransactionStale();
    error TransactionAlreadyExecuted();
    error CallExecutionFailed();

    uint256 public constant MIN_DELAY = 1 days;
    uint256 public constant MAX_DELAY = 30 days;
    uint256 public constant GRACE_PERIOD = 14 days;

    struct Transaction {
        address target;
        uint64 timestamp;
        bool executed;
        uint256 value;
        bytes data;
    }

    mapping(bytes32 => Transaction) public queuedTransactions;
    uint256 public delay;

    // --- Events ---
    event TransactionQueued(bytes32 indexed txHash, address indexed target, uint256 value, bytes data, uint256 eta);
    event TransactionExecuted(bytes32 indexed txHash, address indexed target, uint256 value, bytes data);
    event TransactionCancelled(bytes32 indexed txHash);
    event DelayUpdated(uint256 oldDelay, uint256 newDelay);

    /**
     * @notice Initializes Timelock with operational delay and governance administrator
     * @param _delay Delay in seconds (between MIN_DELAY and MAX_DELAY)
     * @param _initialOwner Address of initial admin / governance
     */
    constructor(uint256 _delay, address _initialOwner) {
        if (_initialOwner == address(0)) revert IProtocolErrors.ZeroAddress();
        if (_delay < MIN_DELAY || _delay > MAX_DELAY) revert InvalidDelay();

        _grantRole(DEFAULT_ADMIN_ROLE, _initialOwner);
        _grantRole(ProtocolRoles.ADMIN_ROLE, _initialOwner);
        delay = _delay;
    }

    /**
     * @notice Enables the contract to receive ETH for payable call executions
     */
    receive() external payable {}

    /**
     * @notice Updates the timelock execution delay.
     * @dev Strictly restricted to self-invocation via passed on-chain timelock proposal.
     * @param newDelay New delay in seconds
     */
    function setDelay(uint256 newDelay) external {
        if (msg.sender != address(this)) revert IProtocolErrors.Unauthorized();
        if (newDelay < MIN_DELAY || newDelay > MAX_DELAY) revert InvalidDelay();
        emit DelayUpdated(delay, newDelay);
        delay = newDelay;
    }

    /**
     * @notice Queues a proposal or administrative call for execution after delay
     * @param target Contract being invoked
     * @param value Native ETH value sent with the call
     * @param data Calldata payload
     * @return txHash Unique hash of the queued transaction
     */
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

    /**
     * @notice Executes a previously queued transaction once its delay has matured
     * @param target Target contract address
     * @param value ETH value forwarded
     * @param data Calldata executed
     * @param eta Scheduled execution timestamp
     * @return returnData Low-level bytes returned by the call
     */
    function executeTransaction(address target, uint256 value, bytes calldata data, uint256 eta)
        external
        onlyRole(ProtocolRoles.ADMIN_ROLE)
        returns (bytes memory)
    {
        bytes32 txHash = keccak256(abi.encode(target, value, data, eta));
        Transaction storage txRecord = queuedTransactions[txHash];

        if (txRecord.timestamp == 0) revert TransactionNotQueued();
        if (block.timestamp < txRecord.timestamp) revert DelayNotElapsed();
        if (block.timestamp > txRecord.timestamp + GRACE_PERIOD) revert TransactionStale();
        if (txRecord.executed) revert TransactionAlreadyExecuted();

        txRecord.executed = true;

        (bool success, bytes memory returnData) = target.call{value: value}(data);
        if (!success) {
            if (returnData.length > 0) {
                assembly {
                    let returndata_size := mload(returnData)
                    revert(add(32, returnData), returndata_size)
                }
            } else {
                revert CallExecutionFailed();
            }
        }

        emit TransactionExecuted(txHash, target, value, data);
        return returnData;
    }

    /**
     * @notice Cancels an unexecuted queued transaction
     * @param txHash Hash of the queued transaction
     */
    function cancelTransaction(bytes32 txHash) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (queuedTransactions[txHash].timestamp == 0) revert TransactionNotQueued();
        if (queuedTransactions[txHash].executed) revert TransactionAlreadyExecuted();

        delete queuedTransactions[txHash];
        emit TransactionCancelled(txHash);
    }
}
