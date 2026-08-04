// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IAggregatorV3.sol";
import "./ProtocolRoles.sol";
import "./ProtocolAddressProvider.sol";

/**
 * @title OracleHub
 * @notice Centralized Oracle manager for fetching asset prices and checking staleness.
 *         Allows the protocol to independently determine NAV without cluttering the Treasury.
 */
contract OracleHub is AccessControl {
    ProtocolAddressProvider public immutable addressProvider;

    // Tracked assets & price feeds
    address[] public trackedAssets;
    mapping(address => address) public priceFeeds;
    mapping(address => uint8) public assetDecimals;

    // Safety check threshold to detect stale oracles
    uint256 public oracleStalenessLimit = 365 days; // Default for Sandbox

    event OracleStalenessUpdated(uint256 newLimit);
    event AssetFeedUpdated(address indexed asset, address indexed feed, uint8 decimals);

    constructor(ProtocolAddressProvider _addressProvider, address initialAdmin) {
        require(address(_addressProvider) != address(0), "OracleHub: Zero address provider");
        addressProvider = _addressProvider;
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    }

    /**
     * @notice Updates the oracle price feed staleness check limit.
     */
    function setOracleStalenessLimit(uint256 limit) external onlyRole(ProtocolRoles.ORACLE_MANAGER_ROLE) {
        oracleStalenessLimit = limit;
        emit OracleStalenessUpdated(limit);
    }

    /**
     * @notice Adds or updates an asset tracking config.
     */
    function setTrackedAsset(address asset, address feed, uint8 decimals_) external onlyRole(ProtocolRoles.ORACLE_MANAGER_ROLE) {
        require(asset != address(0), "OracleHub: Zero asset");
        require(feed != address(0), "OracleHub: Zero feed");
        
        if (priceFeeds[asset] == address(0)) {
            trackedAssets.push(asset);
        }
        priceFeeds[asset] = feed;
        assetDecimals[asset] = decimals_;
        emit AssetFeedUpdated(asset, feed, decimals_);
    }

    /**
     * @notice Safely fetches the USD value of an asset balance.
     * @return usdValue USD value scaled to 18 decimals.
     */
    function getAssetUsdValue(address asset, uint256 assetBalance) public view returns (uint256 usdValue) {
        if (assetBalance == 0) return 0;
        address feedAddress = priceFeeds[asset];
        require(feedAddress != address(0), "OracleHub: Asset not tracked");
        
        (, int256 price, , uint256 updatedAt, ) = IAggregatorV3(feedAddress).latestRoundData();
        require(price > 0, "OracleHub: Invalid price");
        require(block.timestamp - updatedAt <= oracleStalenessLimit, "OracleHub: Stale price feed");

        uint8 feedDecimals = IAggregatorV3(feedAddress).decimals();
        uint8 assetDec = assetDecimals[asset];

        usdValue = (assetBalance * uint256(price) * 10**18) / (10**assetDec * 10**feedDecimals);
    }

    function getTrackedAssets() external view returns (address[] memory) {
        return trackedAssets;
    }
}
