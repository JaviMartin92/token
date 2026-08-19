// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./interfaces/IProtocolErrors.sol";

/**
 * @title VaultPositionNFT
 * @notice Represents ownership of a locked position in the Vested Discount Vaults.
 */
contract VaultPositionNFT is ERC721, AccessControl {
    // Domain Custom Errors
    error NotMinterOrAdmin();
    error NonexistentToken();

    struct Position {
        uint256 id;
        address underlyingAsset;
        uint64 depositTimestamp;
        uint32 lockYears;
        uint64 expirationTimestamp;
        bool isRagequitted;
        bool isMaturedClaimed;
        uint256 principalAmount;
        uint256 discountedPricePaid;
    }

    uint256 public nextTokenId = 1;
    address public minter;

    mapping(uint256 => Position) public positions;

    modifier onlyMinter() {
        if (
            msg.sender != minter &&
            !hasRole(ProtocolRoles.MINTER_ROLE, msg.sender) &&
            !hasRole(ProtocolRoles.ADMIN_ROLE, msg.sender)
        ) {
            revert NotMinterOrAdmin();
        }
        _;
    }

    constructor(address _initialOwner) ERC721("Vested Position NFT", "vPOS") {
        address admin = (_initialOwner != address(0)) ? _initialOwner : msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ProtocolRoles.ADMIN_ROLE, admin);
    }

    function setMinter(address _minter) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_minter == address(0)) revert IProtocolErrors.ZeroAddress();
        minter = _minter;
    }

    function mintPosition(
        address to,
        address underlyingAsset,
        uint256 principalAmount,
        uint256 discountedPricePaid,
        uint256 lockYears
    ) external onlyMinter returns (uint256 tokenId) {
        tokenId = nextTokenId;
        unchecked {
            ++nextTokenId;
        }

        positions[tokenId] = Position({
            id: tokenId,
            underlyingAsset: underlyingAsset,
            depositTimestamp: uint64(block.timestamp),
            lockYears: uint32(lockYears),
            expirationTimestamp: uint64(block.timestamp + (lockYears * 365 days)),
            isRagequitted: false,
            isMaturedClaimed: false,
            principalAmount: principalAmount,
            discountedPricePaid: discountedPricePaid
        });

        _mint(to, tokenId);
    }

    function markRagequitted(uint256 tokenId) external onlyMinter {
        if (_ownerOf(tokenId) == address(0)) revert NonexistentToken();
        positions[tokenId].isRagequitted = true;
    }

    function markClaimed(uint256 tokenId) external onlyMinter {
        if (_ownerOf(tokenId) == address(0)) revert NonexistentToken();
        positions[tokenId].isMaturedClaimed = true;
    }

    function burn(uint256 tokenId) external onlyMinter {
        _burn(tokenId);
        // Preserve positions[tokenId] so historic metadata & claimed status remain readable on-chain
    }

    function getPosition(uint256 tokenId) external view returns (Position memory) {
        if (tokenId == 0 || tokenId >= nextTokenId) revert NonexistentToken();
        return positions[tokenId];
    }
}
