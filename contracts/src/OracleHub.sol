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
    mapping(address => uint256) public lastValidPrimaryPrice18;

    address public sequencerUptimeFeed;
    uint256 public constant GRACE_PERIOD_TIME = 3600; // 1 hour grace period post sequencer recovery
    uint256 public constant MAX_DIVERGENCE_BPS = 500; // 5% max allowed divergence between primary and secondary
    uint256 public oracleStalenessLimit = 3600; // 1 hour default

    event OracleStalenessUpdated(uint256 newLimit);
    event AssetFeedUpdated(address indexed asset, address indexed feed, address indexed secondaryFeed, uint8 decimals);
    event SequencerUptimeFeedUpdated(address indexed feed);

    constructor(ProtocolAddressProvider _addressProvider, address initialAdmin) {
        require(address(_addressProvider) != address(0), "OracleHub: Zero address provider");
        addressProvider = _addressProvider;
        address admin = (initialAdmin != address(0)) ? initialAdmin : msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ProtocolRoles.ADMIN_ROLE, admin);
        _grantRole(ProtocolRoles.ORACLE_MANAGER_ROLE, admin);
    }

    /**
     * @notice Updates the oracle price feed staleness limit.
     * @param limit New staleness limit in seconds.
     */
    function setOracleStalenessLimit(uint256 limit) external onlyRole(ProtocolRoles.ORACLE_MANAGER_ROLE) {
        require(limit > 0 && limit <= 1 days, "OracleHub: Staleness limit out of bounds");
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

    function updatePrimaryPriceCache(address asset) public {
        address primaryFeed = priceFeeds[asset];
        if (primaryFeed != address(0)) {
            try IAggregatorV3(primaryFeed).latestRoundData() returns (uint80, int256 p, uint256, uint256 u, uint80) {
                if (p > 0 && block.timestamp >= u && block.timestamp - u <= oracleStalenessLimit) {
                    uint8 pDec = IAggregatorV3(primaryFeed).decimals();
                    lastValidPrimaryPrice18[asset] = (uint256(p) * 10**18) / (10**pDec);
                }
            } catch {}
        }
    }

    /**
     * @notice Internal helper to resolve asset price base 18 with divergence verification.
     */
    function _fetchPriceBase18(address asset) internal view returns (uint256 priceBase18) {
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

        if (primaryValid) {
            uint8 pDec = IAggregatorV3(primaryFeed).decimals();
            priceBase18 = (uint256(price) * 10**18) / (10**pDec);
        } else {
            address activeFeed = secondaryPriceFeeds[asset];
            require(activeFeed != address(0), "OracleHub: Primary stale and no secondary fallback");
            (, price, , updatedAt, ) = IAggregatorV3(activeFeed).latestRoundData();
            require(price > 0, "OracleHub: Secondary invalid price");
            require(block.timestamp >= updatedAt && block.timestamp - updatedAt <= oracleStalenessLimit, "OracleHub: Secondary stale price feed");
            
            uint8 sDec = IAggregatorV3(activeFeed).decimals();
            priceBase18 = (uint256(price) * 10**18) / (10**sDec);

            // AC-04: Divergence verification against last known primary price
            uint256 lastPrimary = lastValidPrimaryPrice18[asset];
            if (lastPrimary > 0) {
                uint256 diff = priceBase18 > lastPrimary ? priceBase18 - lastPrimary : lastPrimary - priceBase18;
                require((diff * 10000) / lastPrimary <= MAX_DIVERGENCE_BPS, "OracleHub: High primary/secondary price divergence");
            }
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
        uint256 priceBase18 = _fetchPriceBase18(asset);
        uint8 assetDec = assetDecimals[asset];
        usdValue = (assetBalance * priceBase18) / (10**assetDec);
    }

    /**
     * @notice Fetches the price of an asset in USD scaled to 18 decimals.
     */
    function getPriceBase18(address asset) public view returns (uint256 priceBase18) {
        priceBase18 = _fetchPriceBase18(asset);
    }

    /**
     * @notice Returns array of tracked assets.
     */
    function getTrackedAssets() external view returns (address[] memory) {
        return trackedAssets;
    }
}
