// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./lib/security/ReentrancyGuard.sol";

/**
 * @title ProtocolOpExVault
 * @notice Pure DeFi vault holding the 25% protocol OpEx fees in liquid USDC/stablecoins.
 *         Used exclusively for funding platform infrastructure, oracles, RPC nodes, gas, and DAO dev grants.
 */
contract ProtocolOpExVault is Ownable, ReentrancyGuard {
    IERC20 public immutable stablecoin;

    event OpExDeposited(address indexed source, uint256 amount);
    event OpExWithdrawn(address indexed recipient, uint256 amount, string purpose);

    constructor(address _stablecoin, address _initialOwner) Ownable() {
        require(_stablecoin != address(0), "ProtocolOpExVault: Zero stablecoin");
        stablecoin = IERC20(_stablecoin);

        if (_initialOwner != address(0) && _initialOwner != msg.sender) {
            transferOwnership(_initialOwner);
        }
    }

    /**
     * @notice Receives liquid USDC fee distributions from RealYieldRouter.
     */
    function depositOpEx(uint256 amount) external nonReentrant {
        require(amount > 0, "ProtocolOpExVault: Amount 0");
        require(stablecoin.transferFrom(msg.sender, address(this), amount), "ProtocolOpExVault: Transfer failed");
        emit OpExDeposited(msg.sender, amount);
    }

    /**
     * @notice Withdraws liquid USDC for operational expenses (audits, infrastructure, RPCs, dev grants).
     */
    function withdrawOpEx(address recipient, uint256 amount, string calldata purpose) external onlyOwner nonReentrant {
        require(recipient != address(0), "ProtocolOpExVault: Zero recipient");
        uint256 currentBalance = stablecoin.balanceOf(address(this));
        require(amount <= currentBalance, "ProtocolOpExVault: Insufficient balance");

        require(stablecoin.transfer(recipient, amount), "ProtocolOpExVault: Withdraw failed");
        emit OpExWithdrawn(recipient, amount, purpose);
    }

    function getBalance() external view returns (uint256) {
        return stablecoin.balanceOf(address(this));
    }
}
