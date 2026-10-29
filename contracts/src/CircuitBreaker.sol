// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ICircuitBreaker.sol";
import "./interfaces/IAggregatorV3.sol";
import "./interfaces/IProtocolErrors.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";

/**
 * @title CircuitBreaker
 * @author Alpha Centauri Architecture Team
 * @notice Protects treasury solvency by freezing purchase orders for collateral assets
 *         experiencing rapid price drops (>15% within a 6-hour sliding window by default).
 * @dev Employs a circular ring buffer (max 50 points) to achieve O(1) storage writes
 *      and bounded lookback scans, immune to gas exhaustion attacks.
 */
contract CircuitBreaker is ICircuitBreaker, AccessControl {
    mapping(address => address) public priceFeeds;
    mapping(address => bool) private frozenAssets;

    struct PricePoint {
        uint256 price;
        uint256 timestamp;
    }

    // Circular price history buffer (max 50 entries per asset) - prevents gas DoS
    uint256 public constant MAX_PRICE_HISTORY = 50;
    mapping(address => PricePoint[50]) public priceHistoryBuffer;
    mapping(address => uint256) public priceHistoryHead;
    mapping(address => uint256) public priceHistoryCount;

    // Default 24 hours (86400s) for test/dev; set to 1 hour for production
    uint256 public oracleStalenessLimit = 86400;

    // Configurable Circuit Breaker trigger parameters
    uint256 public dropThresholdPct = 15; // 15% default price drop
    uint256 public dropWindow = 6 hours; // 6 hours lookback window default

    // Events
    event DropThresholdsUpdated(uint256 oldDropPct, uint256 newDropPct, uint256 oldWindow, uint256 newWindow);
    event PriceFeedUpdated(address indexed asset, address indexed feed);
    event OracleStalenessLimitUpdated(uint256 oldLimit, uint256 newLimit);

    /**
     * @notice Initializes CircuitBreaker with governance and emergency roles
     * @param _initialOwner Protocol governance/timelock address
     */
    constructor(address _initialOwner) {
        if (_initialOwner == address(0)) revert IProtocolErrors.ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, _initialOwner);
        _grantRole(ProtocolRoles.ADMIN_ROLE, _initialOwner);
        _grantRole(ProtocolRoles.EMERGENCY_ADMIN_ROLE, _initialOwner);
    }

    /**
     * @notice Configures the maximum allowable age for Chainlink oracle price reports
     * @param limit Staleness threshold in seconds
     */
    function setOracleStalenessLimit(uint256 limit) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (limit < 60 || limit > 30 days) revert IProtocolErrors.InvalidParameters();
        emit OracleStalenessLimitUpdated(oracleStalenessLimit, limit);
        oracleStalenessLimit = limit;
    }

    /**
     * @notice Updates the drawdown percentage threshold and lookback time window
     * @param _dropPct Percentage drop required to trigger breaker (1% to 50%)
     * @param _window Sliding window in seconds (15 minutes to 48 hours)
     */
    function setDropThresholds(uint256 _dropPct, uint256 _window) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_dropPct < 1 || _dropPct > 50 || _window < 15 minutes || _window > 48 hours) {
            revert IProtocolErrors.InvalidParameters();
        }
        uint256 oldDrop = dropThresholdPct;
        uint256 oldWin = dropWindow;
        dropThresholdPct = _dropPct;
        dropWindow = _window;
        emit DropThresholdsUpdated(oldDrop, _dropPct, oldWin, _window);
    }

    /**
     * @notice Links an asset token to its canonical Chainlink AggregatorV3 price feed
     * @param asset ERC-20 collateral token address
     * @param feed Chainlink AggregatorV3 feed address
     */
    function setPriceFeed(address asset, address feed) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (asset == address(0) || feed == address(0)) revert IProtocolErrors.ZeroAddress();
        priceFeeds[asset] = feed;
        emit PriceFeedUpdated(asset, feed);
    }

    /// @dev Internal: push a new price point into the circular ring buffer.
    function _updateBuffer(address asset, uint256 currentPrice, uint256 updatedAt) internal returns (uint256 count) {
        count = priceHistoryCount[asset];
        uint256 head = priceHistoryHead[asset];
        uint256 tail = (head + count) % MAX_PRICE_HISTORY;

        bool shouldAdd = (count == 0)
            || (updatedAt
                    >= priceHistoryBuffer[asset][(tail + MAX_PRICE_HISTORY - 1) % MAX_PRICE_HISTORY].timestamp
                        + 15 minutes);

        if (shouldAdd) {
            if (count < MAX_PRICE_HISTORY) {
                priceHistoryBuffer[asset][tail] = PricePoint({price: currentPrice, timestamp: updatedAt});
                unchecked {
                    ++priceHistoryCount[asset];
                }
            } else {
                priceHistoryBuffer[asset][head] = PricePoint({price: currentPrice, timestamp: updatedAt});
                priceHistoryHead[asset] = (head + 1) % MAX_PRICE_HISTORY;
            }
            count = priceHistoryCount[asset];
        }
    }

    /// @dev Internal: scan circular buffer backwards to detect if any price within dropWindow
    ///      exceeded currentPrice by at least dropThresholdPct.
    function _detectDrop(address asset, uint256 currentPrice, uint256 updatedAt) internal returns (bool) {
        uint256 count = priceHistoryCount[asset];
        uint256 head = priceHistoryHead[asset];

        for (uint256 i = 1; i < count;) {
            uint256 idx = (head + count - 1 - i) % MAX_PRICE_HISTORY;
            PricePoint memory p = priceHistoryBuffer[asset][idx];

            if (updatedAt >= p.timestamp && updatedAt - p.timestamp <= dropWindow) {
                if (p.price > currentPrice) {
                    uint256 dropPct = ((p.price - currentPrice) * 100) / p.price;
                    if (dropPct >= dropThresholdPct) {
                        frozenAssets[asset] = true;
                        emit CircuitTriggered(asset, dropPct, updatedAt);
                        return true;
                    }
                }
            } else if (updatedAt >= p.timestamp && updatedAt - p.timestamp > dropWindow) {
                // Buffer entries are ordered chronologically; older points will exceed dropWindow
                break;
            }
            unchecked {
                ++i;
            }
        }
        return false;
    }

    /// @inheritdoc ICircuitBreaker
    function checkAssetDeviation(address asset) external override returns (bool) {
        if (asset == address(0)) revert IProtocolErrors.ZeroAddress();
        address feed = priceFeeds[asset];
        if (feed == address(0)) revert IProtocolErrors.PriceFeedNotSet();

        (uint80 roundId, int256 price,, uint256 updatedAt, uint80 answeredInRound) = IAggregatorV3(feed).latestRoundData();
        if (price <= 0) revert IProtocolErrors.InvalidPrice();
        if (updatedAt == 0 || updatedAt > block.timestamp) revert IProtocolErrors.InvalidPrice();
        if (answeredInRound < roundId) revert IProtocolErrors.StalePriceFeed(updatedAt, oracleStalenessLimit);
        if (block.timestamp - updatedAt > oracleStalenessLimit) {
            revert IProtocolErrors.StalePriceFeed(updatedAt, oracleStalenessLimit);
        }

        uint256 count = _updateBuffer(asset, uint256(price), updatedAt);
        if (count > 1) {
            return _detectDrop(asset, uint256(price), updatedAt);
        }
        return false;
    }

    /// @inheritdoc ICircuitBreaker
    function isFrozen(address asset) external view override returns (bool) {
        return frozenAssets[asset];
    }

    /// @inheritdoc ICircuitBreaker
    function resetBreaker(address asset) external override onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (asset == address(0)) revert IProtocolErrors.ZeroAddress();
        frozenAssets[asset] = false;
        emit CircuitReset(asset, block.timestamp);
    }

    /**
     * @notice Emergency manual freeze by authorized governance or emergency guardian
     * @param asset Address of asset to immediately freeze
     */
    function triggerFreeze(address asset) external {
        if (
            !hasRole(ProtocolRoles.ADMIN_ROLE, msg.sender) &&
            !hasRole(ProtocolRoles.EMERGENCY_ADMIN_ROLE, msg.sender)
        ) {
            revert IProtocolErrors.Unauthorized();
        }
        if (asset == address(0)) revert IProtocolErrors.ZeroAddress();

        frozenAssets[asset] = true;
        emit CircuitTriggered(asset, 100, block.timestamp);
    }
}
