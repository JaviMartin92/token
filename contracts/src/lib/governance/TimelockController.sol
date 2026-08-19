// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../access/AccessControl.sol";

contract TimelockController is AccessControl {
    bytes32 public constant TIMELOCK_ADMIN_ROLE = keccak256("TIMELOCK_ADMIN_ROLE");
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant CANCELLER_ROLE = keccak256("CANCELLER_ROLE");

    uint256 public minDelay;
    mapping(bytes32 => uint256) public timestamps;

    event CallScheduled(
        bytes32 indexed id,
        uint256 indexed index,
        address target,
        uint256 value,
        bytes data,
        bytes32 predecessor,
        uint256 delay
    );
    event CallExecuted(bytes32 indexed id, uint256 indexed index, address target, uint256 value, bytes data);
    event Cancelled(bytes32 indexed id);
    event MinDelayChange(uint256 newDelay, uint256 oldDelay);

    constructor(uint256 _minDelay, address[] memory proposers, address[] memory executors, address admin) {
        minDelay = _minDelay;
        _grantRole(TIMELOCK_ADMIN_ROLE, admin);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);

        for (uint256 i = 0; i < proposers.length; ++i) {
            _grantRole(PROPOSER_ROLE, proposers[i]);
            _grantRole(CANCELLER_ROLE, proposers[i]);
        }
        for (uint256 i = 0; i < executors.length; ++i) {
            _grantRole(EXECUTOR_ROLE, executors[i]);
        }
    }

    function hashOperation(address target, uint256 value, bytes calldata data, bytes32 predecessor, bytes32 salt)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(target, value, data, predecessor, salt));
    }

    function schedule(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delay
    ) public onlyRole(PROPOSER_ROLE) {
        bytes32 id = hashOperation(target, value, data, predecessor, salt);
        require(delay >= minDelay, "Timelock: delay < minDelay");
        require(timestamps[id] == 0, "Timelock: already scheduled");
        timestamps[id] = block.timestamp + delay;
        emit CallScheduled(id, 0, target, value, data, predecessor, delay);
    }

    function execute(address target, uint256 value, bytes calldata data, bytes32 predecessor, bytes32 salt)
        public
        payable
        onlyRole(EXECUTOR_ROLE)
    {
        bytes32 id = hashOperation(target, value, data, predecessor, salt);
        uint256 readyTime = timestamps[id];
        require(readyTime != 0, "Timelock: operation not scheduled");
        require(block.timestamp >= readyTime, "Timelock: operation not ready");

        delete timestamps[id];

        (bool success,) = target.call{value: value}(data);
        require(success, "Timelock: execution failed");

        emit CallExecuted(id, 0, target, value, data);
    }

    function cancel(bytes32 id) public onlyRole(CANCELLER_ROLE) {
        require(timestamps[id] != 0, "Timelock: operation not scheduled");
        delete timestamps[id];
        emit Cancelled(id);
    }
}
