/* solhint-disable no-inline-assembly */
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IProtocolErrors.sol";

/**
 * @title TreasuryProxy
 * @author Alpha Centauri Architecture Team
 * @notice ERC-1967 upgradeable proxy delegating calls to an implementation address.
 *         Uses standard EIP-1967 slots for implementation and admin to prevent storage collisions.
 *         Inline assembly is required by EIP-1967 specification for slot reading and delegatecall.
 */
contract TreasuryProxy {
    // Standard ERC-1967 implementation slot: keccak-256("eip1967.proxy.implementation") - 1
    bytes32 private constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    // Standard ERC-1967 admin slot: keccak-256("eip1967.proxy.admin") - 1
    bytes32 private constant ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    error InvalidImplementation();
    error MigrationCallFailed();

    event Upgraded(address indexed implementation);
    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);

    /**
     * @notice Initializes proxy with initial implementation contract and sets deployer as initial admin
     * @param _implementation Address of deployed logic implementation contract
     */
    constructor(address _implementation) {
        if (_implementation == address(0)) revert IProtocolErrors.ZeroAddress();
        if (_implementation.code.length == 0) revert InvalidImplementation();
        _setAdmin(msg.sender);
        _setImplementation(_implementation);
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

    function _setAdmin(address newAdmin) internal {
        assembly {
            sstore(ADMIN_SLOT, newAdmin)
        }
    }

    /**
     * @notice Transfers proxy administrative ownership (TimelockController in production)
     * @param newAdmin Address of new proxy admin
     */
    function changeAdmin(address newAdmin) external onlyOwner {
        if (newAdmin == address(0)) revert IProtocolErrors.ZeroAddress();
        address oldAdmin = owner();
        _setAdmin(newAdmin);
        emit AdminChanged(oldAdmin, newAdmin);
    }

    /**
     * @notice Upgrades proxy logic to a new implementation contract
     * @param newImplementation Address of new logic implementation
     */
    function upgradeTo(address newImplementation) external onlyOwner {
        if (newImplementation == address(0)) revert IProtocolErrors.ZeroAddress();
        if (newImplementation.code.length == 0) revert InvalidImplementation();
        _setImplementation(newImplementation);
        emit Upgraded(newImplementation);
    }

    /**
     * @notice Upgrades proxy logic and atomically executes a migration call
     * @param newImplementation Address of new logic implementation
     * @param data Migration calldata to execute via delegatecall
     */
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable onlyOwner {
        if (newImplementation == address(0)) revert IProtocolErrors.ZeroAddress();
        if (newImplementation.code.length == 0) revert InvalidImplementation();
        _setImplementation(newImplementation);
        emit Upgraded(newImplementation);

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

    /**
     * @notice Delegates all unrecognized calls to the current implementation contract
     */
    fallback() external payable {
        assembly {
            let impl := sload(IMPLEMENTATION_SLOT)
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    /**
     * @notice Receives native ETH
     */
    receive() external payable {}
}
