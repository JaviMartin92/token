// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IUniversalYieldAdapter} from "../interfaces/IUniversalYieldAdapter.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title OndoRWAAdapter
 * @notice Mock implementation of an Ondo RWA adapter for testing Universal Yield Routing.
 */
contract OndoRWAAdapter is IUniversalYieldAdapter {
    using SafeERC20 for IERC20;
    IERC20 public immutable underlyingAsset;

    mapping(address => uint256) public _balances;
    uint256 public _totalSupply;

    // To simulate yield
    uint256 public yieldFactor = 10000; // 10000 = 1:1, 10500 = 5% yield

    constructor(address _asset) {
        underlyingAsset = IERC20(_asset);
    }

    function asset() external view override returns (address) {
        return address(underlyingAsset);
    }

    function totalAssets() external view override returns (uint256) {
        return (_totalSupply * yieldFactor) / 10000;
    }

    function convertToShares(uint256 assets) public view override returns (uint256) {
        if (_totalSupply == 0) return assets;
        return (assets * 10000) / yieldFactor;
    }

    function convertToAssets(uint256 shares) public view override returns (uint256) {
        return (shares * yieldFactor) / 10000;
    }

    function deposit(uint256 assets, address receiver) external override returns (uint256 shares) {
        shares = convertToShares(assets);
        underlyingAsset.safeTransferFrom(msg.sender, address(this), assets);

        _balances[receiver] += shares;
        _totalSupply += shares;
        return shares;
    }

    error InsufficientBalance();

    function withdraw(uint256 assets, address receiver, address owner) external override returns (uint256 shares) {
        shares = convertToShares(assets);
        if (_balances[owner] < shares) revert InsufficientBalance();

        // If caller is not owner, we'd normally check allowance, but this is a mock.

        _balances[owner] -= shares;
        _totalSupply -= shares;

        underlyingAsset.safeTransfer(receiver, assets);
        return shares;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function simulateYield(uint256 newFactor) external {
        yieldFactor = newFactor;
    }

    // Mock ERC20 transfer
    function transfer(address to, uint256 amount) external returns (bool) {
        if (_balances[msg.sender] < amount) revert InsufficientBalance();
        _balances[msg.sender] -= amount;
        _balances[to] += amount;
        return true;
    }
}
