// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title VaultPositionNFT
 * @notice Represents ownership of a locked position in the Vested Discount Vaults.
 */
contract VaultPositionNFT is ERC721, Ownable {
    struct Position {
        uint256 id;
        address underlyingAsset;
        uint256 principalAmount;
        uint256 discountedPricePaid;
        uint256 depositTimestamp;
        uint256 expirationTimestamp;
        uint256 lockYears;
        bool isRagequitted;
        bool isMaturedClaimed;
    }

    uint256 public nextTokenId = 1;
    address public minter;

    mapping(uint256 => Position) public positions;

    modifier onlyMinter() {
        require(msg.sender == minter || msg.sender == owner(), "VaultPositionNFT: Caller is not minter or owner");
        _;
    }

    constructor(address _initialOwner) ERC721("Vested Position NFT", "vPOS") Ownable() {
        if (_initialOwner != msg.sender) {
            transferOwnership(_initialOwner);
        }
    }

    function setMinter(address _minter) external onlyOwner {
        require(_minter != address(0), "VaultPositionNFT: Zero address minter");
        minter = _minter;
    }

    function mintPosition(
        address to,
        address underlyingAsset,
        uint256 principalAmount,
        uint256 discountedPricePaid,
        uint256 lockYears
    ) external onlyMinter returns (uint256 tokenId) {
        tokenId = nextTokenId++;

        positions[tokenId] = Position({
            id: tokenId,
            underlyingAsset: underlyingAsset,
            principalAmount: principalAmount,
            discountedPricePaid: discountedPricePaid,
            depositTimestamp: block.timestamp,
            expirationTimestamp: block.timestamp + (lockYears * 365 days),
            lockYears: lockYears,
            isRagequitted: false,
            isMaturedClaimed: false
        });

        _mint(to, tokenId);
    }

    function markRagequitted(uint256 tokenId) external onlyMinter {
        require(_ownerOf(tokenId) != address(0), "VaultPositionNFT: Nonexistent token");
        positions[tokenId].isRagequitted = true;
    }

    function markClaimed(uint256 tokenId) external onlyMinter {
        require(_ownerOf(tokenId) != address(0), "VaultPositionNFT: Nonexistent token");
        positions[tokenId].isMaturedClaimed = true;
    }

    function burn(uint256 tokenId) external onlyMinter {
        _burn(tokenId);
        // Preserve positions[tokenId] so historic metadata & claimed status remain readable on-chain
    }

    function getPosition(uint256 tokenId) external view returns (Position memory) {
        require(tokenId > 0 && tokenId < nextTokenId, "VaultPositionNFT: Nonexistent token");
        return positions[tokenId];
    }
}
