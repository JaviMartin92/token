// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IAggregatorV3.sol";
import "./ProtocolRoles.sol";
import "./ProtocolAddressProvider.sol";

interface ISequencerUptimeFeed {
    function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/**
 * @title OracleHub
 * @notice Centralized Oracle manager for fetching asset prices and checking staleness.
 *         Supports primary Chainlink feeds, secondary Pyth/Fallback feeds, and L2 Sequencer Uptime verification.
 * @dev Invariant: Ensures asset price valuations > 0 and fresh within oracleStalenessLimit.
 */
contract OracleHub is AccessControl {
    ProtocolAddressProvider public immutable addressProvider;

    address[] public trackedAssets;
    mapping(address => address) public priceFeeds;
    mapping(address => address) public secondaryPriceFeeds;
    mapping(address => uint8) public assetDecimals;

    address public sequencerUptimeFeed;
    uint256 public constant GRACE_PERIOD_TIME = 3600; // 1 hour grace period post sequencer recovery
    uint256 public oracleStalenessLimit = 365 days; // Sandbox default

    event OracleStalenessUpdated(uint256 newLimit);
    event AssetFeedUpdated(address indexed asset, address indexed feed, address indexed secondaryFeed, uint8 decimals);
    event SequencerUptimeFeedUpdated(address indexed feed);

    constructor(ProtocolAddressProvider _addressProvider, address initialAdmin) {
        require(address(_addressProvider) != address(0), "OracleHub: Zero address provider");
        addressProvider = _addressProvider;
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    }

    /**
     * @notice Updates the oracle price feed staleness limit.
     * @param limit New staleness limit in seconds.
     */
    function setOracleStalenessLimit(uint256 limit) external onlyRole(ProtocolRoles.ORACLE_MANAGER_ROLE) {
        oracleStalenessLimit = limit;
        emit OracleStalenessUpdated(limit);
    }

    /**
     * @notice Sets the L2 Sequencer Uptime Feed address.
     * @param feed Sequencer uptime feed contract address.
     */
    function setSequencerUptimeFeed(address feed) external onlyRole(ProtocolRoles.ORACLE_MANAGER_ROLE) {
        sequencerUptimeFeed = feed;
        emit SequencerUptimeFeedUpdated(feed);
    }

    /**
     * @notice Adds or updates an asset tracking configuration with optional secondary fallback feed.
     * @param asset Target asset address.
     * @param feed Primary Chainlink price feed address.
     * @param secondaryFeed Secondary Pyth/Fallback feed address (optional, zero if none).
     * @param decimals_ Underlying asset decimals.
     */
    function setTrackedAsset(address asset, address feed, address secondaryFeed, uint8 decimals_) public onlyRole(ProtocolRoles.ORACLE_MANAGER_ROLE) {
        require(asset != address(0), "OracleHub: Zero asset");
        require(feed != address(0), "OracleHub: Zero feed");
        
        if (priceFeeds[asset] == address(0)) {
            trackedAssets.push(asset);
        }
        priceFeeds[asset] = feed;
        secondaryPriceFeeds[asset] = secondaryFeed;
        assetDecimals[asset] = decimals_;
        emit AssetFeedUpdated(asset, feed, secondaryFeed, decimals_);
    }

    /**
     * @notice Checks L2 Sequencer status if configured.
     */
    function checkSequencerUptime() public view {
        if (sequencerUptimeFeed != address(0)) {
            (, int256 answer, uint256 startedAt, , ) = ISequencerUptimeFeed(sequencerUptimeFeed).latestRoundData();
            bool isSequencerUp = answer == 0;
            require(isSequencerUp, "OracleHub: L2 Sequencer is down");
            uint256 timeSinceUp = block.timestamp - startedAt;
            require(timeSinceUp >= GRACE_PERIOD_TIME, "OracleHub: Grace period not elapsed");
        }
    }

    /**
     * @notice Safely fetches the USD value of an asset balance using primary feed with automatic secondary fallback.
     * @param asset Target asset address.
     * @param assetBalance Raw asset balance wei.
     * @return usdValue USD value scaled to 18 decimals.
     * @dev Invariant: usdValue >= 0 and never relies on stale feeds.
     */
    function getAssetUsdValue(address asset, uint256 assetBalance) public view returns (uint256 usdValue) {
        if (assetBalance == 0) return 0;
        checkSequencerUptime();

        address primaryFeed = priceFeeds[asset];
        require(primaryFeed != address(0), "OracleHub: Asset not tracked");
        
        int256 price;
        uint256 updatedAt;
        bool primaryValid = false;

        try IAggregatorV3(primaryFeed).latestRoundData() returns (uint80, int256 p, uint256, uint256 u, uint80) {
            if (p > 0 && block.timestamp >= u && block.timestamp - u <= oracleStalenessLimit) {
                price = p;
                updatedAt = u;
                primaryValid = true;
            }
        } catch {}

        if (!primaryValid) {
            address secondaryFeed = secondaryPriceFeeds[asset];
            require(secondaryFeed != address(0), "OracleHub: Primary stale and no secondary fallback");
            (, price, , updatedAt, ) = IAggregatorV3(secondaryFeed).latestRoundData();
            require(price > 0, "OracleHub: Secondary invalid price");
            require(block.timestamp >= updatedAt && block.timestamp - updatedAt <= oracleStalenessLimit, "OracleHub: Secondary stale price feed");
        }

        uint8 feedDecimals = IAggregatorV3(primaryFeed).decimals();
        uint8 assetDec = assetDecimals[asset];

        usdValue = (assetBalance * uint256(price) * 10**18) / (10**assetDec * 10**feedDecimals);
    }

    /**
     * @notice Returns array of tracked assets.
     */
    function getTrackedAssets() external view returns (address[] memory) {
        return trackedAssets;
    }
}
