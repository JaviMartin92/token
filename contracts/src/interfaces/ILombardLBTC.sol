// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILombardLBTC {
    function mint(address to, uint256 amount) external returns (bool);
    function burn(uint256 amount) external returns (bool);
    function getBtcExchangeRate() external view returns (uint256);
}
