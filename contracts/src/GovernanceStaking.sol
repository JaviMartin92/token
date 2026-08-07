// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./lib/security/ReentrancyGuard.sol";
import "./interfaces/ITreasury.sol";

interface IBurnable {
    function burn(uint256 amount) external;
}

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

    // Corporate Vaults for 50/25/25 Staking Fee distribution
    address public corporateOpExVault;
    address public corporateProfitVault;

    // Authorized callers allowed to notify new reward amounts (Treasury, RealYieldRouter)
    mapping(address => bool) public authorizedCallers;

    uint256 public rewardPerTokenStored;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardAdded(uint256 rewardAmount);
    event RewardClaimed(address indexed user, uint256 reward);
    // Excluded addresses (e.g. CEX accounts/vaults) ineligible for yield payouts
    mapping(address => bool) public isExcludedFromYield;

    event AddressExclusionSet(address indexed account, bool excluded);

    constructor(address _govToken, address _rewardToken, address _initialOwner) Ownable() {
        govToken = IERC20(_govToken);
        rewardToken = IERC20(_rewardToken);

        if (_initialOwner != msg.sender) {
            transferOwnership(_initialOwner);
        }
    }

    /**
     * @notice Registers or unregisters CEX accounts so they do not receive yield distribution.
     */
    function setExcludedAddress(address account, bool excluded) external onlyOwner {
        require(account != address(0), "Staking: Zero address");
        isExcludedFromYield[account] = excluded;
        emit AddressExclusionSet(account, excluded);
    }

    /**
     * @notice Sets the Treasury address for NAV-based staked value computation.
     */
    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }

    /**
     * @notice Sets Corporate OpEx and Profit Vaults for 50/25/25 Staking Fee distribution.
     */
    function setCorporateVaults(address _opExVault, address _profitVault) external onlyOwner {
        corporateOpExVault = _opExVault;
        corporateProfitVault = _profitVault;
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

        require(govToken.transferFrom(msg.sender, address(this), amount), "Staking: Stake transfer failed");
        if (fee > 0) {
            uint256 treasuryShare = fee / 2; // 50%
            uint256 opExShare = fee / 4;      // 25%
            uint256 profitShare = fee - treasuryShare - opExShare; // 25%

            if (treasuryShare > 0) {
                IBurnable(address(govToken)).burn(treasuryShare);
                if (treasury != address(0)) {
                    ITreasury(treasury).recordBurn(treasuryShare);
                }
            }
            if (opExShare > 0 && corporateOpExVault != address(0)) {
                require(govToken.transfer(corporateOpExVault, opExShare), "Staking: Fee to OpEx Vault failed");
            }
            if (profitShare > 0 && corporateProfitVault != address(0)) {
                require(govToken.transfer(corporateProfitVault, profitShare), "Staking: Fee to Profit Vault failed");
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

    struct StakingBreakdown {
        uint256 communityStaked;
        uint256 corporateStaked;
        uint256 treasuryStaked;
        uint256 globalTotalStaked;
        uint256 netCirculatingSupply;
        uint256 totalBurned;
    }

    function getStakingBreakdown() external view returns (StakingBreakdown memory breakdown) {
        uint256 opExStaked = corporateOpExVault != address(0) ? stakedBalances[corporateOpExVault] : 0;
        uint256 profitStaked = corporateProfitVault != address(0) ? stakedBalances[corporateProfitVault] : 0;
        uint256 opExBal = corporateOpExVault != address(0) ? govToken.balanceOf(corporateOpExVault) : 0;
        uint256 profitBal = corporateProfitVault != address(0) ? govToken.balanceOf(corporateProfitVault) : 0;

        breakdown.corporateStaked = opExStaked + profitStaked + opExBal + profitBal;

        uint256 tmStaked = treasury != address(0) ? stakedBalances[treasury] : 0;
        uint256 tmBal = treasury != address(0) ? govToken.balanceOf(treasury) : 0;

        breakdown.treasuryStaked = tmStaked + tmBal;

        uint256 instGovStaked = opExStaked + profitStaked + tmStaked;
        breakdown.communityStaked = totalStaked > instGovStaked ? totalStaked - instGovStaked : totalStaked;
        breakdown.globalTotalStaked = breakdown.communityStaked + breakdown.corporateStaked + breakdown.treasuryStaked;

        uint256 totalSupply = govToken.totalSupply();
        uint256 burned = 0;
        if (treasury != address(0)) {
            try ITreasury(treasury).totalBurnedTokens() returns (uint256 b) {
                burned = b;
            } catch {}
        }
        breakdown.totalBurned = burned;
        breakdown.netCirculatingSupply = totalSupply > burned ? totalSupply - burned : totalSupply;
    }

    function getUserStakingInfo(address account) external view returns (uint256 stakedBalance, uint256 claimableYieldUSD) {
        stakedBalance = stakedBalances[account];
        claimableYieldUSD = earned(account);
    }
}
