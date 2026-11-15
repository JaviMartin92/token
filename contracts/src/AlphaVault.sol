// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./VirajeVault.sol";

/**
 * @notice Alias compatible para contratos y tests históricos.
 */
contract VirajeVault is VirajeVault {
    constructor(ProtocolAddressProvider _addressProvider, address initialAdmin)
        VirajeVault(_addressProvider, initialAdmin)
    {}
}
