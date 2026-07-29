// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./lib/security/ReentrancyGuard.sol";
import "./interfaces/ITreasury.sol";

/**
 * @title GovernanceStaking
 * @notice Staking pool for ALPHA governance token holders to earn real yield from protocol fees.
 *         Unallocated yields for non-staked tokens are automatically redistributed to active stakers.
 */
contract GovernanceStaking is Ownable, ReentrancyGuard {
    IERC20 public immutable govToken;
    IERC20 public immutable rewardToken; // e.g. USDC

    uint256 public totalStaked;
    mapping(address => uint256) public stakedBalances;

    // Treasury reference to compute NAV-based staked asset value
    address public treasury;

    // Authorized callers allowed to notify new reward amounts (Treasury, RealYieldRouter)
    mapping(address => bool) public authorizedCallers;

    uint256 public rewardPerTokenStored;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardAdded(uint256 rewardAmount);
    event RewardClaimed(address indexed user, uint256 reward);

    constructor(address _govToken, address _rewardToken, address _initialOwner) Ownable() {
        govToken = IERC20(_govToken);
        rewardToken = IERC20(_rewardToken);

        if (_initialOwner != msg.sender) {
            transferOwnership(_initialOwner);
        }
    }

    /**
     * @notice Sets the Treasury address for NAV-based staked value computation.
     */
    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }

    /**
     * @notice Grants or revokes permission for an address to call notifyRewardAmount.
     */
    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        require(caller != address(0), "Staking: Zero address");
        authorizedCallers[caller] = authorized;
    }

    modifier onlyAuthorized() {
        require(authorizedCallers[msg.sender] || msg.sender == owner(), "Staking: Not authorized to notify rewards");
        _;
    }

    /**
     * @notice Returns the total USDC reward balance currently held in this contract.
     *         Used by Treasury PoR to track real-yield liquidity in the staking pool.
     */
    function totalRewardBalance() external view returns (uint256) {
        return rewardToken.balanceOf(address(this));
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    function rewardPerToken() public view returns (uint256) {
        // rewardPerTokenStored is incremented in notifyRewardAmount every time new
        // rewards arrive: rewardPerTokenStored += (amount * 1e18) / totalStaked
        // This view simply exposes the accumulated value so earned() can compute deltas.
        return rewardPerTokenStored;
    }

    function earned(address account) public view returns (uint256) {
        return (stakedBalances[account] * (rewardPerToken() - userRewardPerTokenPaid[account])) / 1e18 + rewards[account];
    }

    function notifyRewardAmount(uint256 amount) external nonReentrant onlyAuthorized updateReward(address(0)) {
        require(amount > 0, "Staking: Reward amount must be > 0");
        require(totalStaked > 0, "Staking: No active stakers, cannot distribute rewards");
        require(rewardToken.transferFrom(msg.sender, address(this), amount), "Staking: Reward transfer failed");

        // 100% of incoming reward split among active stakers (unstaked tokens generate no yield)
        rewardPerTokenStored += (amount * 1e18) / totalStaked;

        emit RewardAdded(amount);
    }

    function stake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Staking: Cannot stake 0");

        // 1% Staking Entry Fee — transferred to Treasury and processed via 50/25/25 Real Yield Flywheel
        uint256 fee = (amount * 100) / 10000;
        uint256 netStake = amount - fee;

        totalStaked += netStake;
        stakedBalances[msg.sender] += netStake;

        require(govToken.transferFrom(msg.sender, address(this), netStake), "Staking: Net stake transfer failed");
        if (fee > 0) {
            require(govToken.transferFrom(msg.sender, treasury, fee), "Staking: Fee transfer to Treasury failed");
            if (treasury.code.length > 0) {
                try ITreasury(treasury).processStakingFee(fee) {} catch {}
            }
        }

        emit Staked(msg.sender, netStake);
    }

    function unstake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Staking: Cannot unstake 0");
        require(stakedBalances[msg.sender] >= amount, "Staking: Exceeds staked balance");

        totalStaked -= amount;
        stakedBalances[msg.sender] -= amount;
        require(govToken.transfer(msg.sender, amount), "Staking: Unstake transfer failed");

        emit Unstaked(msg.sender, amount);
    }

    function claimRewardFor(address user) external nonReentrant onlyAuthorized updateReward(user) returns (uint256 reward) {
        reward = rewards[user];
        if (reward > 0) {
            rewards[user] = 0;
            // Pays to msg.sender (authorized router) so router can process Option A / Option B
            require(rewardToken.transfer(msg.sender, reward), "Staking: Reward payout failed");
            emit RewardClaimed(user, reward);
        }
    }
}
