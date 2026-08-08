// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./lib/security/ReentrancyGuard.sol";

interface IGovernanceStakingYield {
    function notifyRewardAmount(uint256 amount) external;
}

/**
 * @title CommunityYieldVault
 * @notice Pure DeFi vault receiving the 25% protocol Real Yield in liquid USDC.
 *         Distributes 100% of liquid USDC yields directly to stALPHA community stakers.
 */
contract CommunityYieldVault is Ownable, ReentrancyGuard {
    IERC20 public immutable stablecoin;
    address public stakingPool;

    event YieldDeposited(address indexed source, uint256 amount);
    event StakingPoolSet(address indexed stakingPool);

    constructor(address _stablecoin, address _initialOwner) Ownable() {
        require(_stablecoin != address(0), "CommunityYieldVault: Zero stablecoin");
        stablecoin = IERC20(_stablecoin);

        if (_initialOwner != address(0) && _initialOwner != msg.sender) {
            transferOwnership(_initialOwner);
        }
    }

    function setStakingPool(address _stakingPool) external onlyOwner {
        stakingPool = _stakingPool;
        emit StakingPoolSet(_stakingPool);
    }

    /**
     * @notice Receives liquid USDC fees from RealYieldRouter and notifies GovernanceStaking for real-time dividend payouts.
     */
    function depositYield(uint256 amount) external nonReentrant {
        require(amount > 0, "CommunityYieldVault: Amount 0");
        require(stablecoin.transferFrom(msg.sender, address(this), amount), "CommunityYieldVault: Transfer failed");

        if (stakingPool != address(0)) {
            stablecoin.approve(stakingPool, amount);
            try IGovernanceStakingYield(stakingPool).notifyRewardAmount(amount) {} catch {}
        }

        emit YieldDeposited(msg.sender, amount);
    }

    function getBalance() external view returns (uint256) {
        return stablecoin.balanceOf(address(this));
    }
}
