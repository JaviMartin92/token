// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IOracleHub {
    function getAssetUsdValue(address asset, uint256 assetBalance) external view returns (uint256);
    function getPriceBase18(address asset) external view returns (uint256);
    function isSequencerGracePeriod() external view returns (bool);
}
