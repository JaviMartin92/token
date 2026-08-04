// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ProtocolRoles
 * @notice Central registry of all AccessControl roles used throughout the Alpha Centauri protocol.
 */
library ProtocolRoles {
    // Standard Roles
    bytes32 public constant ADMIN_ROLE = 0x00;
    
    // Treasury & Vault Roles
    bytes32 public constant VAULT_MANAGER_ROLE = keccak256("VAULT_MANAGER_ROLE");
    bytes32 public constant RESERVE_MANAGER_ROLE = keccak256("RESERVE_MANAGER_ROLE");
    bytes32 public constant YIELD_ROUTER_ROLE = keccak256("YIELD_ROUTER_ROLE");
    
    // Token Minting/Burning
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    // Operations
    bytes32 public constant ORACLE_MANAGER_ROLE = keccak256("ORACLE_MANAGER_ROLE");
    bytes32 public constant EMERGENCY_ADMIN_ROLE = keccak256("EMERGENCY_ADMIN_ROLE");
}
