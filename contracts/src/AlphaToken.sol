// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./VirajeToken.sol";

/**
 * @notice Alias compatible para contratos y tests históricos.
 */
contract VirajeToken is VirajeToken {
    constructor(ProtocolAddressProvider _addressProvider, address initialAdmin)
        VirajeToken(_addressProvider, initialAdmin)
    {}
}
