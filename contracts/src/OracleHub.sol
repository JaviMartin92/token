// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IAggregatorV3.sol";
import "./interfaces/IProtocolErrors.sol";
import "./ProtocolRoles.sol";
import "./ProtocolAddressProvider.sol";

interface ISequencerUptimeFeed {
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/**
 * @title OracleHub
 * @author Alpha Centauri Architecture Team
 * @notice Centralized institutional oracle hub for collateral valuation and treasury NAV pricing.
 *         Supports primary Chainlink feeds, secondary fallback feeds with divergence guards,
 *         and Arbitrum L2 Sequencer Uptime verification with automated post-restart grace period.
 * @dev Invariants:
 *      1. Valuation is always fresh within `oracleStalenessLimit`.
 *      2. Prices must be strictly positive and from completed rounds (`answeredInRound >= roundId`).
 *      3. Secondary fallback is rejected if price diverges > 5% (500 bps) from last primary.
 *      4. If Arbitrum sequencer is down or in grace period, state-modifying pricing calls revert.
 */
contract OracleHub is AccessControl {
    // --- Domain Custom Errors ---
    error SequencerDown();
    error GracePeriodNotElapsed();
    error AssetNotTracked();
    error PriceDivergenceExceeded(uint256 diffBps, uint256 maxBps);

    // --- State Variables & Immutables ---
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

    // --- Events ---
    event OracleStalenessUpdated(uint256 newLimit);
    event AssetFeedUpdated(address indexed asset, address indexed feed, address indexed secondaryFeed, uint8 decimals);
    event AssetFeedRemoved(address indexed asset);
    event SequencerUptimeFeedUpdated(address indexed feed);

    /**
     * @notice Initializes OracleHub with address provider and initial administrator
     * @param _addressProvider Address provider registry
     * @param initialAdmin Protocol timelock or governance administrator
     */
    constructor(ProtocolAddressProvider _addressProvider, address initialAdmin) {
        if (address(_addressProvider) == address(0) || initialAdmin == address(0)) {
            revert IProtocolErrors.ZeroAddress();
        }
        addressProvider = _addressProvider;
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(ProtocolRoles.ADMIN_ROLE, initialAdmin);
        _grantRole(ProtocolRoles.ORACLE_MANAGER_ROLE, initialAdmin);
    }

    /**
     * @notice Updates the oracle price feed staleness limit.
     * @param limit New staleness limit in seconds (max 1 day).
     */
    function setOracleStalenessLimit(uint256 limit) external onlyRole(ProtocolRoles.ORACLE_MANAGER_ROLE) {
        if (limit == 0 || limit > 1 days) revert IProtocolErrors.InvalidParameters();
        oracleStalenessLimit = limit;
        emit OracleStalenessUpdated(limit);
    }

    /**
     * @notice Sets the Arbitrum L2 Sequencer Uptime Feed address.
     * @param feed Sequencer uptime feed contract address (or address(0) to disable).
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
     * @param decimals_ Underlying asset decimals (1 to 30).
     */
    function setTrackedAsset(address asset, address feed, address secondaryFeed, uint8 decimals_)
        public
        onlyRole(ProtocolRoles.ORACLE_MANAGER_ROLE)
    {
        if (asset == address(0) || feed == address(0)) revert IProtocolErrors.ZeroAddress();
        if (decimals_ == 0 || decimals_ > 30) revert IProtocolErrors.InvalidParameters();

        if (priceFeeds[asset] == address(0)) {
            trackedAssets.push(asset);
        }
        priceFeeds[asset] = feed;
        secondaryPriceFeeds[asset] = secondaryFeed;
        assetDecimals[asset] = decimals_;
        updatePrimaryPriceCache(asset);
        emit AssetFeedUpdated(asset, feed, secondaryFeed, decimals_);
    }

    /**
     * @notice Removes an asset from the tracked registry
     * @param asset Asset address to delist
     */
    function removeTrackedAsset(address asset) external onlyRole(ProtocolRoles.ORACLE_MANAGER_ROLE) {
        if (asset == address(0)) revert IProtocolErrors.ZeroAddress();
        if (priceFeeds[asset] == address(0)) revert AssetNotTracked();

        delete priceFeeds[asset];
        delete secondaryPriceFeeds[asset];
        delete assetDecimals[asset];
        delete lastValidPrimaryPrice18[asset];

        uint256 len = trackedAssets.length;
        for (uint256 i = 0; i < len; ++i) {
            if (trackedAssets[i] == asset) {
                trackedAssets[i] = trackedAssets[len - 1];
                trackedAssets.pop();
                break;
            }
        }
        emit AssetFeedRemoved(asset);
    }

    /**
     * @notice Returns true if the L2 Sequencer is down or currently within the 1-hour post-restart grace period.
     */
    function isSequencerGracePeriod() public view returns (bool) {
        if (sequencerUptimeFeed == address(0)) return false;
        try ISequencerUptimeFeed(sequencerUptimeFeed).latestRoundData() returns (
            uint80 roundId, int256 answer, uint256 startedAt, uint256, uint80 answeredInRound
        ) {
            if (roundId == 0 || startedAt == 0 || startedAt > block.timestamp || answeredInRound < roundId) {
                return true;
            }
            if (answer != 0) return true; // Sequencer is down
            return (block.timestamp - startedAt < GRACE_PERIOD_TIME); // In grace period
        } catch {
            return true; // Fail-safe: treat revert as unsafe grace period
        }
    }

    /**
     * @notice Checks that the sequencer is actively running (answer == 0), without enforcing the grace period.
     */
    function checkSequencerActive() public view {
        if (sequencerUptimeFeed != address(0)) {
            (uint80 roundId, int256 answer, uint256 startedAt,, uint80 answeredInRound) =
                ISequencerUptimeFeed(sequencerUptimeFeed).latestRoundData();
            if (roundId == 0 || startedAt == 0 || startedAt > block.timestamp || answeredInRound < roundId || answer != 0) {
                revert SequencerDown();
            }
        }
    }

    /**
     * @notice Checks full L2 Sequencer status including post-restart grace period.
     */
    function checkSequencerUptime() public view {
        if (sequencerUptimeFeed != address(0)) {
            (uint80 roundId, int256 answer, uint256 startedAt,, uint80 answeredInRound) =
                ISequencerUptimeFeed(sequencerUptimeFeed).latestRoundData();
            if (roundId == 0 || startedAt == 0 || startedAt > block.timestamp || answeredInRound < roundId) {
                revert SequencerDown();
            }
            if (answer != 0) revert SequencerDown();
            uint256 timeSinceUp = block.timestamp - startedAt;
            if (timeSinceUp < GRACE_PERIOD_TIME) revert GracePeriodNotElapsed();
        }
    }

    /**
     * @notice Caches the latest valid primary price for an asset for subsequent divergence checks
     * @param asset Target asset address
     */
    function updatePrimaryPriceCache(address asset) public {
        address primaryFeed = priceFeeds[asset];
        if (primaryFeed != address(0)) {
            try IAggregatorV3(primaryFeed).latestRoundData() returns (
                uint80 roundId, int256 p, uint256, uint256 u, uint80 answeredInRound
            ) {
                if (
                    p > 0 &&
                    u > 0 &&
                    block.timestamp >= u &&
                    block.timestamp - u <= oracleStalenessLimit &&
                    answeredInRound >= roundId
                ) {
                    uint8 pDec = IAggregatorV3(primaryFeed).decimals();
                    lastValidPrimaryPrice18[asset] = (uint256(p) * 10 ** 18) / (10 ** pDec);
                }
            } catch {
                // Ignore transient oracle revert during cache warmup
            }
        }
    }

    /**
     * @notice Updates primary price caches for all tracked assets in a single batch transaction.
     */
    function updateAllPrimaryPriceCaches() external {
        uint256 len = trackedAssets.length;
        for (uint256 i = 0; i < len; ++i) {
            updatePrimaryPriceCache(trackedAssets[i]);
        }
    }

    /**
     * @notice Internal helper to resolve asset price base 18 with divergence verification.
     */
    function _fetchPriceBase18(address asset) internal view returns (uint256 priceBase18) {
        checkSequencerUptime();
        address primaryFeed = priceFeeds[asset];
        if (primaryFeed == address(0)) revert AssetNotTracked();

        int256 price;
        uint256 updatedAt;
        bool primaryValid = false;

        try IAggregatorV3(primaryFeed).latestRoundData() returns (
            uint80 roundId, int256 p, uint256, uint256 u, uint80 answeredInRound
        ) {
            if (
                p > 0 &&
                u > 0 &&
                block.timestamp >= u &&
                block.timestamp - u <= oracleStalenessLimit &&
                answeredInRound >= roundId
            ) {
                price = p;
                updatedAt = u;
                primaryValid = true;
            }
        } catch {
            // Primary oracle failed or reverted; trigger fallback to secondary feed
        }

        if (primaryValid) {
            uint8 pDec = IAggregatorV3(primaryFeed).decimals();
            priceBase18 = (uint256(price) * 10 ** 18) / (10 ** pDec);
        } else {
            address activeFeed = secondaryPriceFeeds[asset];
            if (activeFeed == address(0)) revert IProtocolErrors.PriceFeedNotSet();

            (uint80 sRoundId, int256 sPrice,, uint256 sUpdatedAt, uint80 sAnsweredInRound) =
                IAggregatorV3(activeFeed).latestRoundData();

            if (sPrice <= 0 || sUpdatedAt == 0 || block.timestamp < sUpdatedAt || sAnsweredInRound < sRoundId) {
                revert IProtocolErrors.InvalidPrice();
            }
            if (block.timestamp - sUpdatedAt > oracleStalenessLimit) {
                revert IProtocolErrors.StalePriceFeed(sUpdatedAt, oracleStalenessLimit);
            }

            uint8 sDec = IAggregatorV3(activeFeed).decimals();
            priceBase18 = (uint256(sPrice) * 10 ** 18) / (10 ** sDec);

            // AC-04: Divergence verification against last known primary price
            uint256 lastPrimary = lastValidPrimaryPrice18[asset];
            if (lastPrimary > 0) {
                uint256 diff = priceBase18 > lastPrimary ? priceBase18 - lastPrimary : lastPrimary - priceBase18;
                uint256 diffBps = (diff * 10000) / lastPrimary;
                if (diffBps > MAX_DIVERGENCE_BPS) {
                    revert PriceDivergenceExceeded(diffBps, MAX_DIVERGENCE_BPS);
                }
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
        usdValue = (assetBalance * priceBase18) / (10 ** assetDec);
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
