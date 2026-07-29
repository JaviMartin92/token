// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/ICircuitBreaker.sol";
import "./interfaces/IAggregatorV3.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CircuitBreaker
 * @notice Freezes buying orders for assets experiencing major losses (>15% in 6 hours).
 */
contract CircuitBreaker is ICircuitBreaker, Ownable {
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

    // Default 365 days for Sandbox; set to 1 hour for production
    uint256 public oracleStalenessLimit = 365 days;

    constructor(address _initialOwner) {
        if (_initialOwner != msg.sender) {
            transferOwnership(_initialOwner);
        }
    }

    function setOracleStalenessLimit(uint256 limit) external onlyOwner {
        oracleStalenessLimit = limit;
    }

    function setPriceFeed(address asset, address feed) external onlyOwner {
        require(asset != address(0), "CircuitBreaker: Zero address asset");
        require(feed != address(0), "CircuitBreaker: Zero address feed");
        priceFeeds[asset] = feed;
    }

    /// @dev Internal: push a new price point into the circular buffer.
    function _updateBuffer(address asset, uint256 currentPrice, uint256 updatedAt) internal returns (uint256 count) {
        count = priceHistoryCount[asset];
        uint256 head = priceHistoryHead[asset];
        uint256 tail = (head + count) % MAX_PRICE_HISTORY;

        bool shouldAdd = (count == 0) ||
            (updatedAt >= priceHistoryBuffer[asset][(tail + MAX_PRICE_HISTORY - 1) % MAX_PRICE_HISTORY].timestamp + 15 minutes);

        if (shouldAdd) {
            if (count < MAX_PRICE_HISTORY) {
                priceHistoryBuffer[asset][tail] = PricePoint({ price: currentPrice, timestamp: updatedAt });
                priceHistoryCount[asset]++;
            } else {
                priceHistoryBuffer[asset][head] = PricePoint({ price: currentPrice, timestamp: updatedAt });
                priceHistoryHead[asset] = (head + 1) % MAX_PRICE_HISTORY;
            }
            count = priceHistoryCount[asset];
        }
    }

    /// @dev Internal: scan buffer backwards for a 6h-old price and check for >=15% drop.
    function _detectDrop(address asset, uint256 currentPrice, uint256 updatedAt) internal returns (bool) {
        uint256 count = priceHistoryCount[asset];
        uint256 head = priceHistoryHead[asset];

        for (uint256 i = 1; i < count; i++) {
            uint256 idx = (head + count - 1 - i) % MAX_PRICE_HISTORY;
            PricePoint memory p = priceHistoryBuffer[asset][idx];

            if (updatedAt >= p.timestamp && updatedAt - p.timestamp >= 6 hours) {
                if (p.price > currentPrice) {
                    uint256 dropPct = ((p.price - currentPrice) * 100) / p.price;
                    if (dropPct >= 15) {
                        frozenAssets[asset] = true;
                        emit CircuitTriggered(asset, dropPct, updatedAt);
                        return true;
                    }
                }
                break;
            }
        }
        return false;
    }

    /// @inheritdoc ICircuitBreaker
    function checkAssetDeviation(address asset) external override returns (bool) {
        address feed = priceFeeds[asset];
        require(feed != address(0), "CircuitBreaker: Price feed not set");

        (, int256 price, , uint256 updatedAt, ) = IAggregatorV3(feed).latestRoundData();
        require(price > 0, "CircuitBreaker: Price must be positive");
        require(block.timestamp - updatedAt <= oracleStalenessLimit, "CircuitBreaker: Stale price feed");

        // casting to 'uint256' is safe because we already require(price > 0) above
        // forge-lint: disable-next-line(unsafe-typecast)
        uint256 count = _updateBuffer(asset, uint256(price), updatedAt);
        if (count > 1) {
            // forge-lint: disable-next-line(unsafe-typecast)
            return _detectDrop(asset, uint256(price), updatedAt);
        }
        return false;
    }

    /// @inheritdoc ICircuitBreaker
    function isFrozen(address asset) external view override returns (bool) {
        return frozenAssets[asset];
    }

    /// @inheritdoc ICircuitBreaker
    function resetBreaker(address asset) external override onlyOwner {
        frozenAssets[asset] = false;
        emit CircuitReset(asset, block.timestamp);
    }
}