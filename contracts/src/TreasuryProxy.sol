// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TreasuryProxy
 * @notice ERC-1967 upgradeable proxy delegating calls to an implementation address stored in slot 0x360894...
 */
contract TreasuryProxy {
    // Standard ERC-1967 implementation slot: keccak-256("eip1967.proxy.implementation") - 1
    bytes32 private constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    
    address private _owner;

    event Upgraded(address indexed implementation);

    constructor(address _implementation) {
        _owner = msg.sender;
        _setImplementation(_implementation);
    }

    modifier onlyOwner() {
        require(msg.sender == _owner, "TreasuryProxy: caller is not the owner");
        _;
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
