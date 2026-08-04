// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";

/**
 * @title ProtocolAddressProvider
 * @notice Centralized registry for all protocol smart contract addresses.
 *         Allows upgradability and easy resolution of protocol modules by a central source of truth.
 */
contract ProtocolAddressProvider is AccessControl {
    // String identifiers for core contracts
    bytes32 public constant ID_TREASURY_MANAGER = keccak256("TREASURY_MANAGER");
    bytes32 public constant ID_ALPHA_VAULT = keccak256("ALPHA_VAULT");
    bytes32 public constant ID_ALPHA_TOKEN = keccak256("ALPHA_TOKEN");
    bytes32 public constant ID_ORACLE_HUB = keccak256("ORACLE_HUB");
    bytes32 public constant ID_TOKENOMICS_ENGINE = keccak256("TOKENOMICS_ENGINE");
    bytes32 public constant ID_GOVERNANCE_STAKING = keccak256("GOVERNANCE_STAKING");
    bytes32 public constant ID_REAL_YIELD_ROUTER = keccak256("REAL_YIELD_ROUTER");
    bytes32 public constant ID_P2P_MARKET = keccak256("P2P_MARKET");
    bytes32 public constant ID_VESTED_VAULT = keccak256("VESTED_VAULT");

    mapping(bytes32 => address) private _addresses;

    event AddressUpdated(bytes32 indexed id, address indexed oldAddress, address indexed newAddress);

    constructor(address initialAdmin) {
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    }

    /**
     * @notice Updates the address for a specific identifier.
     * @param id The identifier for the protocol component (e.g., ID_TREASURY_MANAGER).
     * @param newAddress The new address.
     */
    function setAddress(bytes32 id, address newAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newAddress != address(0), "AddressProvider: Zero address");
        address oldAddress = _addresses[id];
        _addresses[id] = newAddress;
        emit AddressUpdated(id, oldAddress, newAddress);
    }

    /**
     * @notice Returns the address registered to a specific identifier.
     * @param id The identifier to query.
     * @return The registered address.
     */
    function getAddress(bytes32 id) public view returns (address) {
        return _addresses[id];
    }

    // Convenience Getters
    function getTreasuryManager() external view returns (address) { return getAddress(ID_TREASURY_MANAGER); }
    function getAlphaVault() external view returns (address) { return getAddress(ID_ALPHA_VAULT); }
    function getAlphaToken() external view returns (address) { return getAddress(ID_ALPHA_TOKEN); }
    function getOracleHub() external view returns (address) { return getAddress(ID_ORACLE_HUB); }
    function getTokenomicsEngine() external view returns (address) { return getAddress(ID_TOKENOMICS_ENGINE); }
    function getGovernanceStaking() external view returns (address) { return getAddress(ID_GOVERNANCE_STAKING); }
    function getRealYieldRouter() external view returns (address) { return getAddress(ID_REAL_YIELD_ROUTER); }
    function getP2PMarket() external view returns (address) { return getAddress(ID_P2P_MARKET); }
    function getVestedVault() external view returns (address) { return getAddress(ID_VESTED_VAULT); }
}
