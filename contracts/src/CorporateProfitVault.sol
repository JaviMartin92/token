// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./lib/security/ReentrancyGuard.sol";

/**
 * @title CorporateProfitVault
 * @notice Restricted corporate vault that automatically holds and stakes the 25% Profit protocol fees in ALPHA tokens.
 *         Used exclusively for platform founders, core team dividends, and long-term corporate reserves.
 */
contract CorporateProfitVault is Ownable, ReentrancyGuard {
    IERC20 public immutable alphaToken;

    uint256 public totalStakedProfit;

    event ProfitStaked(address indexed source, uint256 amount);
    event ProfitWithdrawn(address indexed recipient, uint256 amount, string purpose);

    constructor(address _alphaToken, address _initialOwner) Ownable() {
        require(_alphaToken != address(0), "CorporateProfitVault: Zero alpha token");
        alphaToken = IERC20(_alphaToken);

        if (_initialOwner != msg.sender) {
            transferOwnership(_initialOwner);
        }
    }

    /**
     * @notice Receives and registers ALPHA tokens from RealYieldRouter fee distributions into the Profit Staking Pool.
     */
    function depositStaking(uint256 amount) external nonReentrant {
        require(amount > 0, "CorporateProfitVault: Amount 0");
        require(alphaToken.transferFrom(msg.sender, address(this), amount), "CorporateProfitVault: Transfer failed");
        totalStakedProfit += amount;
        emit ProfitStaked(msg.sender, amount);
    }

    /**
     * @notice Withdraws ALPHA tokens for corporate profit distribution. Restricted to owner.
     */
    function withdrawProfit(address recipient, uint256 amount, string calldata purpose) external onlyOwner nonReentrant {
        require(recipient != address(0), "CorporateProfitVault: Zero recipient");
        require(amount <= alphaToken.balanceOf(address(this)), "CorporateProfitVault: Insufficient balance");

        if (amount <= totalStakedProfit) {
            totalStakedProfit -= amount;
        } else {
            totalStakedProfit = 0;
        }

        require(alphaToken.transfer(recipient, amount), "CorporateProfitVault: Withdraw failed");
        emit ProfitWithdrawn(recipient, amount, purpose);
    }

    function getBalance() external view returns (uint256) {
        return alphaToken.balanceOf(address(this));
    }
}
