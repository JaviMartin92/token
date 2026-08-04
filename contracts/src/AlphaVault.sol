// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ProtocolRoles.sol";
import "./ProtocolAddressProvider.sol";

/**
 * @title AlphaVault
 * @notice Ultra-secure custody vault for all protocol assets (USDC, WBTC, WETH).
 *         It holds the tokens, but has NO business logic.
 *         Only the VAULT_MANAGER_ROLE (usually TreasuryManager) can move funds.
 */
contract AlphaVault is AccessControl {
    ProtocolAddressProvider public immutable addressProvider;

    event FundsTransferred(address indexed token, address indexed to, uint256 amount);
    event FundsApproved(address indexed token, address indexed spender, uint256 amount);

    constructor(ProtocolAddressProvider _addressProvider, address initialAdmin) {
        require(address(_addressProvider) != address(0), "AlphaVault: Zero address provider");
        addressProvider = _addressProvider;
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    }

    /**
     * @notice Safely transfers funds out of the vault.
     */
    function transferFunds(address token, address to, uint256 amount) external onlyRole(ProtocolRoles.VAULT_MANAGER_ROLE) {
        require(to != address(0), "AlphaVault: Transfer to zero address");
        require(amount > 0, "AlphaVault: Amount must be > 0");
        require(IERC20(token).transfer(to, amount), "AlphaVault: Transfer failed");
        emit FundsTransferred(token, to, amount);
    }

    /**
     * @notice Approves a third party to spend funds from the vault (e.g., Morpho, SwapRouter).
     */
    function approveFunds(address token, address spender, uint256 amount) external onlyRole(ProtocolRoles.VAULT_MANAGER_ROLE) {
        require(spender != address(0), "AlphaVault: Approve to zero address");
        require(IERC20(token).approve(spender, amount), "AlphaVault: Approve failed");
        emit FundsApproved(token, spender, amount);
    }

    /**
     * @notice Returns the balance of a specific token held in the vault.
     */
    function getBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
