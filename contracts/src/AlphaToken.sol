// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./ProtocolAddressProvider.sol";
import "./interfaces/IProtocolErrors.sol";

/**
 * @title AlphaToken
 * @notice The core ERC20 token for the Alpha Centauri protocol with EIP-2612 Permit support.
 *         Minting and burning are strictly controlled via RBAC, typically granted to the TreasuryManager.
 */
contract AlphaToken is ERC20, ERC20Permit, AccessControl {
    ProtocolAddressProvider public immutable addressProvider;

    constructor(ProtocolAddressProvider _addressProvider, address initialAdmin)
        ERC20("Alpha Centauri Shares", "ALPHA")
        ERC20Permit("Alpha Centauri Shares")
    {
        if (address(_addressProvider) == address(0)) {
            revert IProtocolErrors.ZeroAddressProvider();
        }
        addressProvider = _addressProvider;
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    }

    /**
     * @notice Mints new ALPHA tokens. Strictly restricted to MINTER_ROLE.
     * @param to The address that will receive the minted tokens.
     * @param amount The number of tokens to mint.
     */
    function mint(address to, uint256 amount) external onlyRole(ProtocolRoles.MINTER_ROLE) {
        _mint(to, amount);
    }

    /**
     * @notice Burns ALPHA tokens from the caller.
     * @param amount The number of tokens to burn.
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    /**
     * @notice Burns ALPHA tokens from a specific account. Restricted to BURNER_ROLE.
     * @param account The account from which to burn the tokens.
     * @param amount The number of tokens to burn.
     */
    function burnFrom(address account, uint256 amount) external onlyRole(ProtocolRoles.BURNER_ROLE) {
        if (account != msg.sender) {
            _spendAllowance(account, msg.sender, amount);
        }
        _burn(account, amount);
    }
}
