// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./ProtocolAddressProvider.sol";

/**
 * @title AlphaToken
 * @notice The core ERC20 token for the Alpha Centauri protocol. 
 *         Minting and burning are strictly controlled via RBAC, typically granted to the TreasuryManager.
 */
contract AlphaToken is ERC20, AccessControl {
    ProtocolAddressProvider public immutable addressProvider;

    constructor(ProtocolAddressProvider _addressProvider, address initialAdmin) ERC20("Alpha Centauri Shares", "ALPHA") {
        require(address(_addressProvider) != address(0), "AlphaToken: Zero address provider");
        addressProvider = _addressProvider;
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    }

    /**
     * @notice Mints new ALPHA tokens. Strictly restricted to MINTER_ROLE.
     */
    function mint(address to, uint256 amount) external onlyRole(ProtocolRoles.MINTER_ROLE) {
        _mint(to, amount);
    }

    /**
     * @notice Burns ALPHA tokens from the caller. 
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    /**
     * @notice Burns ALPHA tokens from a specific account. Restricted to BURNER_ROLE.
     */
    function burnFrom(address account, uint256 amount) external onlyRole(ProtocolRoles.BURNER_ROLE) {
        _spendAllowance(account, msg.sender, amount);
        _burn(account, amount);
    }
}
