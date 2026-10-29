// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IUniversalYieldAdapter} from "../interfaces/IUniversalYieldAdapter.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "../lib/access/Ownable.sol";

/**
 * @title AaveV3Adapter
 * @notice Mock implementation of an Aave V3 adapter for testing Universal Yield Routing.
 */
contract AaveV3Adapter is IUniversalYieldAdapter, Ownable {
    using SafeERC20 for IERC20;
    IERC20 public immutable underlyingAsset;

    mapping(address => uint256) public _balances;
    uint256 public _totalSupply;

    // To simulate yield
    uint256 public yieldFactor = 10000; // 10000 = 1:1, 10500 = 5% yield
    uint256 public constant MIN_YIELD_FACTOR = 10000; // 1.0x (100%)
    uint256 public constant MAX_YIELD_FACTOR = 50000; // 5.0x (500%)

    error InvalidYieldFactorRange(uint256 factor);

    constructor(address _asset) Ownable() {
        underlyingAsset = IERC20(_asset);
        _totalSupply = 1000; // Virtual shares to neutralize vault inflation attacks (AC-10)
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
    error UnauthorizedCaller();

    mapping(address => mapping(address => uint256)) public allowances;

    function approve(address spender, uint256 amount) external returns (bool) {
        allowances[msg.sender][spender] = amount;
        return true;
    }

    function withdraw(uint256 assets, address receiver, address owner) external override returns (uint256 shares) {
        shares = convertToShares(assets);
        if (_balances[owner] < shares) revert InsufficientBalance();

        if (msg.sender != owner) {
            uint256 allowed = allowances[owner][msg.sender];
            if (allowed != type(uint256).max) {
                if (allowed < shares) revert UnauthorizedCaller();
                allowances[owner][msg.sender] = allowed - shares;
            }
        }

        _balances[owner] -= shares;
        _totalSupply -= shares;

        underlyingAsset.safeTransfer(receiver, assets);
        return shares;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    /// @notice Ajuste de factor de rendimiento restringido exclusivamente al propietario con límites económicos seguros
    function setYieldFactor(uint256 newFactor) public onlyOwner {
        if (newFactor < MIN_YIELD_FACTOR || newFactor > MAX_YIELD_FACTOR) {
            revert InvalidYieldFactorRange(newFactor);
        }
        yieldFactor = newFactor;
    }

    /// @notice Alias protegido para compatibilidad de pruebas
    function simulateYield(uint256 newFactor) external onlyOwner {
        setYieldFactor(newFactor);
    }

    // Mock ERC20 transfer
    function transfer(address to, uint256 amount) external returns (bool) {
        if (_balances[msg.sender] < amount) revert InsufficientBalance();
        _balances[msg.sender] -= amount;
        _balances[to] += amount;
        return true;
    }
}
