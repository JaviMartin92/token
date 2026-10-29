// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./lib/token/ERC20/ERC20.sol";
import "./lib/security/ReentrancyGuard.sol";
import "./interfaces/ITreasury.sol";
import "./interfaces/IProtocolErrors.sol";

interface IBurnable {
    function burn(uint256 amount) external;
}

/**
 * @title GovernanceStaking
 * @notice Staking pool for ALPHA governance token holders to earn real yield from protocol fees.
 *         Unallocated yields for non-staked tokens are automatically redistributed to active stakers.
 *         Inherits ERC20 ("Staked ALPHA", "stALPHA") with block-based voting checkpoints for DAO governance.
 */
contract GovernanceStaking is ERC20, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 public immutable govToken;
    IERC20 public immutable rewardToken; // e.g. USDC

    uint256 public totalStaked;

    // Backward-compatible stakedBalances getter mapping to ERC20 balanceOf
    function stakedBalances(address account) public view returns (uint256) {
        return balanceOf(account);
    }

    // --- VOTING CHECKPOINTS & DELEGATION (IERC20Votes compatibility) ---
    struct Checkpoint {
        uint32 fromBlock;
        uint224 votes;
    }
    mapping(address => address) private _delegates;
    mapping(address => mapping(uint32 => Checkpoint)) private _checkpoints;
    mapping(address => uint32) private _numCheckpoints;

    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);
    event DelegateVotesChanged(address indexed delegate, uint256 previousBalance, uint256 newBalance);

    function delegates(address account) public view returns (address) {
        address current = _delegates[account];
        return current == address(0) ? account : current;
    }

    function delegate(address delegatee) public {
        _delegate(msg.sender, delegatee);
    }

    function getVotes(address account) public view returns (uint256) {
        uint32 nCheckpoints = _numCheckpoints[account];
        return nCheckpoints > 0 ? _checkpoints[account][nCheckpoints - 1].votes : 0;
    }

    function getPastVotes(address account, uint256 blockNumber) public view returns (uint256) {
        if (blockNumber >= block.number) revert IProtocolErrors.BlockNotMined(blockNumber, block.number);
        uint32 nCheckpoints = _numCheckpoints[account];
        if (nCheckpoints == 0) return 0;
        if (_checkpoints[account][nCheckpoints - 1].fromBlock <= blockNumber) {
            return _checkpoints[account][nCheckpoints - 1].votes;
        }
        if (_checkpoints[account][0].fromBlock > blockNumber) {
            return 0;
        }
        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2;
            Checkpoint memory cp = _checkpoints[account][center];
            if (cp.fromBlock == blockNumber) {
                return cp.votes;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return _checkpoints[account][lower].votes;
    }

    function _delegate(address delegator, address delegatee) internal {
        address currentDelegate = delegates(delegator);
        uint256 delegatorBalance = balanceOf(delegator);
        _delegates[delegator] = delegatee;
        emit DelegateChanged(delegator, currentDelegate, delegatee);
        _moveVotingPower(currentDelegate, delegatee, delegatorBalance);
    }

    function _moveVotingPower(address src, address dst, uint256 amount) internal {
        if (src != dst && amount > 0) {
            if (src != address(0)) {
                uint32 srcNum = _numCheckpoints[src];
                uint256 srcOld = srcNum > 0 ? _checkpoints[src][srcNum - 1].votes : 0;
                uint256 srcNew = srcOld - amount;
                _writeCheckpoint(src, srcNum, srcOld, srcNew);
            }
            if (dst != address(0)) {
                uint32 dstNum = _numCheckpoints[dst];
                uint256 dstOld = dstNum > 0 ? _checkpoints[dst][dstNum - 1].votes : 0;
                uint256 dstNew = dstOld + amount;
                _writeCheckpoint(dst, dstNum, dstOld, dstNew);
            }
        }
    }

    function _writeCheckpoint(address delegatee, uint32 nCheckpoints, uint256 oldVotes, uint256 newVotes) internal {
        require(newVotes <= type(uint224).max, "Votes overflow");
        uint32 blockNum = uint32(block.number);
        if (nCheckpoints > 0 && _checkpoints[delegatee][nCheckpoints - 1].fromBlock == blockNum) {
            _checkpoints[delegatee][nCheckpoints - 1].votes = uint224(newVotes);
        } else {
            _checkpoints[delegatee][nCheckpoints] = Checkpoint(blockNum, uint224(newVotes));
            _numCheckpoints[delegatee] = nCheckpoints + 1;
        }
        emit DelegateVotesChanged(delegatee, oldVotes, newVotes);
    }

    // Treasury reference to compute NAV-based staked asset value
    address public treasury;

    // Protocol Vaults for Staking Fee distribution
    address public communityYieldVault;

    // Authorized callers allowed to notify new reward amounts (Treasury, RealYieldRouter)
    mapping(address => bool) public authorizedCallers;

    uint256 public rewardPerTokenStored;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    // Timelock state (Anti Flash-Loan Voting)
    uint256 public constant MIN_STAKE_DURATION = 7 days;
    mapping(address => uint256) public lastStakeTime;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardAdded(uint256 rewardAmount);
    event RewardClaimed(address indexed user, uint256 reward);
    // Excluded addresses (e.g. CEX accounts/vaults) ineligible for yield payouts
    mapping(address => bool) public isExcludedFromYield;

    event AddressExclusionSet(address indexed account, bool excluded);
    event TreasuryUpdated(address indexed newTreasury);
    event ProtocolVaultsUpdated(address indexed newCommunityYieldVault);
    event ReserveVaultsUpdated(address indexed alphaVault, address indexed promoVault);
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);

    constructor(address _govToken, address _rewardToken, address _initialOwner) ERC20("Staked ALPHA", "stALPHA") {
        if (_govToken == address(0) || _rewardToken == address(0)) revert IProtocolErrors.ZeroAddress();
        govToken = IERC20(_govToken);
        rewardToken = IERC20(_rewardToken);

        address admin = (_initialOwner != address(0)) ? _initialOwner : msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ProtocolRoles.ADMIN_ROLE, admin);
    }

    /**
     * @notice Registers or unregisters CEX accounts so they do not receive yield distribution.
     */
    function setExcludedAddress(address account, bool excluded) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (account == address(0)) revert IProtocolErrors.ZeroAddress();
        isExcludedFromYield[account] = excluded;
        emit AddressExclusionSet(account, excluded);
    }

    /**
     * @notice Sets the Treasury address for NAV-based staked value computation.
     */
    function setTreasury(address _treasury) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_treasury == address(0)) revert IProtocolErrors.ZeroAddress();
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    /**
     * @notice Sets Protocol Community Yield Vault for Staking Fee distribution.
     */
    function setProtocolVaults(address _communityYieldVault) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_communityYieldVault == address(0)) revert IProtocolErrors.ZeroAddress();
        communityYieldVault = _communityYieldVault;
        emit ProtocolVaultsUpdated(_communityYieldVault);
    }

    /**
     * @notice Grants or revokes permission for an address to call notifyRewardAmount.
     */
    function setAuthorizedCaller(address caller, bool authorized) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (caller == address(0)) revert IProtocolErrors.ZeroAddress();
        authorizedCallers[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    modifier onlyAuthorized() {
        if (!authorizedCallers[msg.sender] && !hasRole(ProtocolRoles.ADMIN_ROLE, msg.sender)) {
            revert IProtocolErrors.Unauthorized();
        }
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
        return rewardPerTokenStored;
    }

    function earned(address account) public view returns (uint256) {
        if (isExcludedFromYield[account]) return 0;
        return (balanceOf(account) * (rewardPerToken() - userRewardPerTokenPaid[account])) / 1e18 + rewards[account];
    }

    function notifyRewardAmount(uint256 amount) external nonReentrant onlyAuthorized updateReward(address(0)) {
        if (amount == 0) revert IProtocolErrors.ZeroAmount();
        if (totalStaked == 0) revert IProtocolErrors.NoActiveStakers();
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);

        rewardPerTokenStored += (amount * 1e18) / totalStaked;

        emit RewardAdded(amount);
    }

    /**
     * @notice Stakes Governance tokens into the protocol, applying a 1% entry fee.
     *         Staked tokens gain voting power and accumulate USDC rewards.
     * @param amount The amount of Governance tokens to stake.
     */
    function stake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        if (amount == 0) revert IProtocolErrors.ZeroAmount();

        lastStakeTime[msg.sender] = block.timestamp;

        // 1% Staking Entry Fee — transferred to Treasury and processed via Real Yield Flywheel
        uint256 fee = (amount * 100) / 10000;
        uint256 netStake = amount - fee;

        totalStaked += netStake;
        // AC-15: _mint already calls _moveVotingPower internally via ERC20 override
        _mint(msg.sender, netStake);

        govToken.safeTransferFrom(msg.sender, address(this), amount);
        if (fee > 0) {
            uint256 treasuryShare = fee / 2; // 50%
            uint256 communityShare = fee - treasuryShare; // 50%

            if (treasuryShare > 0) {
                IBurnable(address(govToken)).burn(treasuryShare);
                if (treasury != address(0)) {
                    ITreasury(treasury).recordBurn(treasuryShare);
                }
            }
            if (communityShare > 0) {
                if (communityYieldVault != address(0)) {
                    govToken.safeTransfer(communityYieldVault, communityShare);
                } else {
                    IBurnable(address(govToken)).burn(communityShare);
                    if (treasury != address(0)) {
                        ITreasury(treasury).recordBurn(communityShare);
                    }
                }
            }
        }

        emit Staked(msg.sender, netStake);
    }

    /**
     * @notice Unstakes Governance tokens, subject to a timelock cooldown.
     *         Withdraws principal and removes corresponding voting power.
     * @param amount The amount of staked tokens to withdraw.
     */
    function unstake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        if (amount == 0) revert IProtocolErrors.ZeroAmount();
        if (balanceOf(msg.sender) < amount) {
            revert IProtocolErrors.InsufficientStakedBalance(amount, balanceOf(msg.sender));
        }
        if (block.timestamp < lastStakeTime[msg.sender] + MIN_STAKE_DURATION) {
            revert IProtocolErrors.TimelockActive(lastStakeTime[msg.sender] + MIN_STAKE_DURATION);
        }

        totalStaked -= amount;
        // AC-15: _burn already calls _moveVotingPower internally via ERC20 override
        _burn(msg.sender, amount);

        govToken.safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    /**
     * @notice Allows a staker to claim their accrued USDC rewards directly.
     * @return reward The amount of reward tokens transferred to msg.sender.
     */
    function claimReward() external nonReentrant updateReward(msg.sender) returns (uint256 reward) {
        if (isExcludedFromYield[msg.sender]) return 0;
        reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardToken.safeTransfer(msg.sender, reward);
            emit RewardClaimed(msg.sender, reward);
        }
    }

    function claimRewardFor(address user)
        external
        nonReentrant
        onlyAuthorized
        updateReward(user)
        returns (uint256 reward)
    {
        if (isExcludedFromYield[user]) return 0;
        reward = rewards[user];
        if (reward > 0) {
            rewards[user] = 0;
            rewardToken.safeTransfer(msg.sender, reward);
            emit RewardClaimed(user, reward);
        }
    }

    struct StakingBreakdown {
        uint256 communityStaked;
        uint256 communityVaultStaked;
        uint256 treasuryStaked;
        uint256 globalTotalStaked;
        uint256 netCirculatingSupply;
        uint256 totalBurned;
    }

    address public alphaVault;
    address public promoVault;

    function setReserveVaults(address _alphaVault, address _promoVault) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_alphaVault == address(0) || _promoVault == address(0)) revert IProtocolErrors.ZeroAddress();
        alphaVault = _alphaVault;
        promoVault = _promoVault;
        emit ReserveVaultsUpdated(_alphaVault, _promoVault);
    }

    function getStakingBreakdown() external view returns (StakingBreakdown memory breakdown) {
        uint256 communityVaultStaked = communityYieldVault != address(0) ? balanceOf(communityYieldVault) : 0;
        uint256 tmStaked = treasury != address(0) ? balanceOf(treasury) : 0;
        uint256 avStaked = alphaVault != address(0) ? balanceOf(alphaVault) : 0;
        uint256 pvStaked = promoVault != address(0) ? balanceOf(promoVault) : 0;

        breakdown.communityVaultStaked = communityVaultStaked;
        breakdown.treasuryStaked = tmStaked + avStaked + pvStaked;

        uint256 institutionalStaked = breakdown.treasuryStaked + breakdown.communityVaultStaked;
        breakdown.communityStaked = totalStaked > institutionalStaked ? totalStaked - institutionalStaked : 0;
        breakdown.globalTotalStaked = totalStaked;

        uint256 totalSupply = govToken.totalSupply();
        uint256 burned = 0;
        if (treasury != address(0)) {
            try ITreasury(treasury).totalBurnedTokens() returns (uint256 b) {
                burned = b;
            } catch {
                // Default to 0 burned on query revert
            }
        }
        breakdown.totalBurned = burned;
        if (treasury != address(0)) {
            try ITreasury(treasury).getNetCirculatingShares() returns (uint256 netCirc) {
                breakdown.netCirculatingSupply = netCirc;
            } catch {
                breakdown.netCirculatingSupply = totalSupply;
            }
        } else {
            breakdown.netCirculatingSupply = totalSupply;
        }
    }

    function getUserStakingInfo(address account)
        external
        view
        returns (uint256 stakedBalance, uint256 claimableYieldUSD)
    {
        stakedBalance = balanceOf(account);
        claimableYieldUSD = earned(account);
    }

    // --- Voting Power Synchronization ---
    function _transfer(address from, address to, uint256 value) internal virtual override {
        if (from != address(0) && block.timestamp < lastStakeTime[from] + MIN_STAKE_DURATION) {
            revert IProtocolErrors.TimelockActive(lastStakeTime[from] + MIN_STAKE_DURATION);
        }
        if (to != address(0)) {
            lastStakeTime[to] = block.timestamp;
        }
        super._transfer(from, to, value);
        _moveVotingPower(delegates(from), delegates(to), value);
    }

    function _mint(address account, uint256 value) internal virtual override {
        super._mint(account, value);
        _moveVotingPower(address(0), delegates(account), value);
    }

    function _burn(address account, uint256 value) internal virtual override {
        super._burn(account, value);
        _moveVotingPower(delegates(account), address(0), value);
    }
}
