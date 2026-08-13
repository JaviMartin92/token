// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TreasuryProxy
 * @notice ERC-1967 upgradeable proxy delegating calls to an implementation address.
 *         Uses standard EIP-1967 slots for implementation and admin to prevent storage collisions.
 */
contract TreasuryProxy {
    // Standard ERC-1967 implementation slot: keccak-256("eip1967.proxy.implementation") - 1
    bytes32 private constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    // Standard ERC-1967 admin slot: keccak-256("eip1967.proxy.admin") - 1
    bytes32 private constant ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    event Upgraded(address indexed implementation);
    event AdminChanged(address indexed previousAdmin, address indexed newAdmin);

    constructor(address _implementation) {
        require(_implementation != address(0), "TreasuryProxy: Zero implementation");
        _setAdmin(msg.sender);
        _setImplementation(_implementation);
    }

    modifier onlyOwner() {
        require(msg.sender == owner(), "TreasuryProxy: caller is not the owner");
        _;
    }

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

    function changeAdmin(address newAdmin) external onlyOwner {
        require(newAdmin != address(0), "TreasuryProxy: Zero address admin");
        address oldAdmin = owner();
        _setAdmin(newAdmin);
        emit AdminChanged(oldAdmin, newAdmin);
    }

    function upgradeTo(address newImplementation) external onlyOwner {
        require(newImplementation != address(0), "TreasuryProxy: Zero address implementation");
        _setImplementation(newImplementation);
        emit Upgraded(newImplementation);
    }

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

    receive() external payable {
        // Allow receive ether
    }
}
