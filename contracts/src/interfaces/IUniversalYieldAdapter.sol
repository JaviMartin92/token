// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IUniversalYieldAdapter
 * @notice Standard interface for yield adapters, highly inspired by ERC-4626.
 */
interface IUniversalYieldAdapter {
    function asset() external view returns (address);
    function totalAssets() external view returns (uint256);
    function convertToShares(uint256 assets) external view returns (uint256);
    function convertToAssets(uint256 shares) external view returns (uint256);

    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);

    function balanceOf(address account) external view returns (uint256);
}
