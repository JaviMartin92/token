// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./GovernorViraje.sol";

/**
 * @notice Alias compatible para gobernanza previa.
 */
contract GovernorViraje is GovernorViraje {
    constructor(
        address _stakingToken,
        address _timelock,
        address _virajeVault,
        address _communityYieldVault,
        address _treasuryManager,
        address _initialOwner
    ) GovernorViraje(_stakingToken, _timelock, _virajeVault, _communityYieldVault, _treasuryManager, _initialOwner) {}
}
