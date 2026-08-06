// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./lib/security/ReentrancyGuard.sol";

interface IGovernanceStakingOpEx {
    function stake(uint256 amount) external;
    function unstake(uint256 amount) external;
}

/**
 * @title CorporateOpExVault
 * @notice Restricted corporate vault that automatically holds and stakes the 25% OpEx protocol fees in ALPHA tokens.
 *         Used exclusively for funding platform infrastructure, oracles, gas, and security audits.
 */
contract CorporateOpExVault is Ownable, ReentrancyGuard {
    IERC20 public immutable alphaToken;
    address public stakingPool;

    uint256 public totalStakedOpEx;

    event OpExStaked(address indexed source, uint256 amount);
    event OpExWithdrawn(address indexed recipient, uint256 amount, string purpose);
    event StakingPoolSet(address indexed stakingPool);

    constructor(address _alphaToken, address _initialOwner) Ownable() {
        require(_alphaToken != address(0), "CorporateOpExVault: Zero alpha token");
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
     * @notice Receives and registers ALPHA tokens from RealYieldRouter fee distributions into the OpEx Staking Pool.
     */
    function depositStaking(uint256 amount) external nonReentrant {
        require(amount > 0, "CorporateOpExVault: Amount 0");
        require(alphaToken.transferFrom(msg.sender, address(this), amount), "CorporateOpExVault: Transfer failed");
        totalStakedOpEx += amount;

        if (stakingPool != address(0)) {
            alphaToken.approve(stakingPool, amount);
            try IGovernanceStakingOpEx(stakingPool).stake(amount) {} catch {}
        }

        emit OpExStaked(msg.sender, amount);
    }

    /**
     * @notice Withdraws ALPHA tokens for operational expenses (audits, infrastructure, gas). Restricted to owner.
     */
    function withdrawOpEx(address recipient, uint256 amount, string calldata purpose) external onlyOwner nonReentrant {
        require(recipient != address(0), "CorporateOpExVault: Zero recipient");

        uint256 currentBalance = alphaToken.balanceOf(address(this));
        if (amount > currentBalance && stakingPool != address(0)) {
            uint256 needed = amount - currentBalance;
            try IGovernanceStakingOpEx(stakingPool).unstake(needed) {} catch {}
            currentBalance = alphaToken.balanceOf(address(this));
        }

        require(amount <= currentBalance, "CorporateOpExVault: Insufficient balance");

        if (amount <= totalStakedOpEx) {
            totalStakedOpEx -= amount;
        } else {
            totalStakedOpEx = 0;
        }

        require(alphaToken.transfer(recipient, amount), "CorporateOpExVault: Withdraw failed");
        emit OpExWithdrawn(recipient, amount, purpose);
    }

    function getBalance() external view returns (uint256) {
        return alphaToken.balanceOf(address(this));
    }
}
