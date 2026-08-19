// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title ProtocolTimelock
 * @notice Enforces an institutional time delay (e.g. 24 hours minimum) on critical protocol parameter updates.
 *         Follows the OpenZeppelin TimelockController standard (Compound/Olympus Bophodes Tier-1 pattern).
 */
contract ProtocolTimelock is TimelockController {
    constructor(uint256 minDelay, address[] memory proposers, address[] memory executors, address admin)
        TimelockController(minDelay, proposers, executors, admin)
    {}
}
