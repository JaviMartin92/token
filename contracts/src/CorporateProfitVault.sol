// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./lib/security/ReentrancyGuard.sol";

interface IGovernanceStakingProfit {
    function stake(uint256 amount) external;
    function unstake(uint256 amount) external;
}

/**
 * @title CorporateProfitVault
 * @notice Restricted corporate vault that automatically holds and stakes the 25% Profit protocol fees in ALPHA tokens.
 *         Used exclusively for platform founders, core team dividends, and long-term corporate reserves.
 */
contract CorporateProfitVault is Ownable, ReentrancyGuard {
    IERC20 public immutable alphaToken;
    address public stakingPool;

    uint256 public totalStakedProfit;

    event ProfitStaked(address indexed source, uint256 amount);
    event ProfitWithdrawn(address indexed recipient, uint256 amount, string purpose);
    event StakingPoolSet(address indexed stakingPool);

    constructor(address _alphaToken, address _initialOwner) Ownable() {
        require(_alphaToken != address(0), "CorporateProfitVault: Zero alpha token");
        alphaToken = IERC20(_alphaToken);

        if (_initialOwner != msg.sender) {
            transferOwnership(_initialOwner);
        }
    }

    function setStakingPool(address _stakingPool) external onlyOwner {
        stakingPool = _stakingPool;
        emit StakingPoolSet(_stakingPool);
    }

    /**
     * @notice Receives and registers ALPHA tokens from RealYieldRouter fee distributions into the Profit Staking Pool.
     */
    function depositStaking(uint256 amount) external nonReentrant {
        require(amount > 0, "CorporateProfitVault: Amount 0");
        require(alphaToken.transferFrom(msg.sender, address(this), amount), "CorporateProfitVault: Transfer failed");
        totalStakedProfit += amount;

        if (stakingPool != address(0)) {
            alphaToken.approve(stakingPool, amount);
            try IGovernanceStakingProfit(stakingPool).stake(amount) {} catch {}
        }

        emit ProfitStaked(msg.sender, amount);
    }

    /**
     * @notice Withdraws ALPHA tokens for corporate profit distribution. Restricted to owner.
     */
    function withdrawProfit(address recipient, uint256 amount, string calldata purpose) external onlyOwner nonReentrant {
        require(recipient != address(0), "CorporateProfitVault: Zero recipient");

        uint256 currentBalance = alphaToken.balanceOf(address(this));
        if (amount > currentBalance && stakingPool != address(0)) {
            uint256 needed = amount - currentBalance;
            try IGovernanceStakingProfit(stakingPool).unstake(needed) {} catch {}
            currentBalance = alphaToken.balanceOf(address(this));
        }

        require(amount <= currentBalance, "CorporateProfitVault: Insufficient balance");

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
