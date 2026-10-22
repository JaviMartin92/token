// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../ERC20.sol";
import "./IERC20Permit.sol";
import "../../../utils/cryptography/ECDSA.sol";

abstract contract ERC20Permit is ERC20, IERC20Permit {
    mapping(address => uint256) private _nonces;
    bytes32 private immutable _cachedDomainSeparator;
    uint256 private immutable _cachedChainId;
    bytes32 private immutable _hashedName;
    bytes32 private constant _PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    constructor(string memory name) {
        _hashedName = keccak256(bytes(name));
        _cachedChainId = block.chainid;
        _cachedDomainSeparator = _buildDomainSeparator();
    }

    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        public
        virtual
        override
    {
        require(block.timestamp <= deadline, "ERC20Permit: expired deadline");

        bytes32 structHash = keccak256(abi.encode(_PERMIT_TYPEHASH, owner, spender, value, _useNonce(owner), deadline));
        bytes32 hash = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), structHash));

        address signer = ECDSA.recover(hash, v, r, s);
        require(signer == owner, "ERC20Permit: invalid signature");

        _approve(owner, spender, value);
    }

    function nonces(address owner) public view virtual override returns (uint256) {
        return _nonces[owner];
    }

    function DOMAIN_SEPARATOR() public view virtual override returns (bytes32) {
        if (block.chainid == _cachedChainId) {
            return _cachedDomainSeparator;
        } else {
            return _buildDomainSeparator();
        }
    }

    function _buildDomainSeparator() private view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                _hashedName,
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function _useNonce(address owner) internal virtual returns (uint256 current) {
        current = _nonces[owner];
        _nonces[owner]++;
    }
}
