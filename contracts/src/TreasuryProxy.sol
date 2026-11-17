/* solhint-disable no-inline-assembly, avoid-low-level-calls */
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IProtocolErrors.sol";

/**
 * @title TreasuryProxy
 * @author Viraje Protocol Architecture Team
 * @notice Standard EIP-1967 upgradeable proxy delegating execution to the TreasuryManager logic contract.
 * @dev Storage slots for implementation and administrator are hardcoded constants calculated according
 *      to EIP-1967 specifications:
 *      - Implementation slot: bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1)
 *      - Admin slot: bytes32(uint256(keccak256("eip1967.proxy.admin")) - 1)
 *      Inline assembly is required by the EIP-1967 specification for slot reading, storage writes,
 *      and delegatecall invocation.
 * @custom:security-note Storage Safety: This proxy declares zero sequential state variables.
 *                       All proxy-level state is maintained in dedicated EIP-1967 storage slots,
 *                       guaranteeing zero storage collisions with implementation storage layouts.
 * @custom:security-note Governance Handoff: The administrative role must be assigned to the
 *                       TimelockController in production, enforcing an unbypassable 72-hour delay
 *                       on all implementation upgrades or admin modifications.
 */
contract TreasuryProxy {
    // Standard ERC-1967 implementation slot: keccak-256("eip1967.proxy.implementation") - 1
    bytes32 private constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    // Standard ERC-1967 admin slot: keccak-256("eip1967.proxy.admin") - 1
    bytes32 private constant ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    /// @notice Thrown when the target implementation address contains no runtime bytecode
    error InvalidImplementation();
    /// @notice Thrown when an atomic upgrade migration call reverts without returning error data
    error MigrationCallFailed();

    /// @notice Emitted when the proxy implementation is upgraded
    event Upgraded(address indexed implementation);
    /// @notice Canonical EIP-1967 event emitted when proxy admin is updated
    event AdminChanged(address previousAdmin, address newAdmin);

    /**
     * @notice Initializes the proxy with the initial logic implementation and assigns deployer as admin
     * @param _implementation Address of the deployed logic implementation contract
     */
    constructor(address _implementation) {
        if (_implementation == address(0)) revert IProtocolErrors.ZeroAddress();
        if (_implementation.code.length == 0) revert InvalidImplementation();
        _setAdmin(msg.sender);
        _setImplementation(_implementation);
        emit AdminChanged(address(0), msg.sender);
        emit Upgraded(_implementation);
    }

    modifier onlyOwner() {
        if (msg.sender != owner()) revert IProtocolErrors.Unauthorized();
        _;
    }

    /**
     * @notice Returns the proxy administrator address
     */
    function owner() public view returns (address adm) {
        assembly {
            adm := sload(ADMIN_SLOT)
        }
    }

    /**
     * @notice Canonical EIP-1967 getter returning the proxy administrator address
     */
    function admin() external view returns (address) {
        return owner();
    }

    function _setAdmin(address newAdmin) internal {
        assembly {
            sstore(ADMIN_SLOT, newAdmin)
        }
    }

    /**
     * @notice Transfers proxy administrative ownership (assigned to TimelockController in production)
     * @param newAdmin Address of the new proxy administrator
     */
    function changeAdmin(address newAdmin) external onlyOwner {
        if (newAdmin == address(0)) revert IProtocolErrors.ZeroAddress();
        address oldAdmin = owner();
        _setAdmin(newAdmin);
        emit AdminChanged(oldAdmin, newAdmin);
    }

    /**
     * @notice Upgrades the proxy logic to a new implementation contract
     * @param newImplementation Address of the new logic implementation
     */
    function upgradeTo(address newImplementation) external onlyOwner {
        _upgradeTo(newImplementation);
    }

    /**
     * @notice Upgrades proxy logic and atomically executes a migration call
     * @param newImplementation Address of the new logic implementation
     * @param data Migration calldata to execute via delegatecall in proxy context
     */
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable onlyOwner {
        _upgradeTo(newImplementation);

        if (data.length > 0) {
            (bool success, bytes memory returnData) = newImplementation.delegatecall(data);
            if (!success) {
                if (returnData.length > 0) {
                    assembly {
                        let returndata_size := mload(returnData)
                        revert(add(32, returnData), returndata_size)
                    }
                } else {
                    revert MigrationCallFailed();
                }
            }
        }
    }

    /**
     * @notice Returns the current logic implementation contract address
     */
    function implementation() public view returns (address impl) {
        assembly {
            impl := sload(IMPLEMENTATION_SLOT)
        }
    }

    function _setImplementation(address newImplementation) internal {
        assembly {
            sstore(IMPLEMENTATION_SLOT, newImplementation)
        }
    }

    function _upgradeTo(address newImplementation) internal {
        if (newImplementation == address(0)) revert IProtocolErrors.ZeroAddress();
        if (newImplementation.code.length == 0) revert InvalidImplementation();
        _setImplementation(newImplementation);
        emit Upgraded(newImplementation);
    }

    /// @dev Internal forwarding function using EIP-1967 canonical delegatecall assembly
    function _delegate(address impl) internal {
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    /**
     * @notice Delegates all unrecognized calls to the current implementation contract
     */
    fallback() external payable {
        _delegate(implementation());
    }

    /**
     * @notice Delegates plain ETH transfers to the current implementation contract
     */
    receive() external payable {
        _delegate(implementation());
    }
}
