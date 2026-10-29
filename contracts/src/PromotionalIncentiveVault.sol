// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./lib/security/ReentrancyGuard.sol";
import "./interfaces/IProtocolErrors.sol";

/**
 * @title PromotionalIncentiveVault
 * @notice Dedicated vault holding the 10% ALPHA token promotional & campaign pool.
 *         Enforces linear release, budget commitment tracking, and governance-approved
 *         distributions for marketing, referral rewards, and ecosystem partnerships.
 * @dev Fully non-custodial and Timelock-governed. Supports batch distributions and
 *      reclaiming unspent campaign allocations.
 */
contract PromotionalIncentiveVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- Domain Custom Errors ---
    error ExceedsPromotionalPool(uint256 requested, uint256 available);
    error CampaignNotActive();
    error CampaignBudgetExceeded(uint256 attempted, uint256 budget);
    error InvalidCampaignId();
    error EmptyCampaignName();
    error ArrayLengthMismatch();

    // --- Immutables & State Variables ---
    IERC20 public immutable alphaToken;

    uint256 public totalAllocatedPool;
    uint256 public totalDistributed;
    uint256 public campaignCount;

    struct Campaign {
        uint256 id;
        string name;
        uint256 totalRewardAmount;
        uint256 claimedRewardAmount;
        bool isActive;
    }

    mapping(uint256 => Campaign) public campaigns;

    // --- Events ---
    event CampaignCreated(uint256 indexed campaignId, string name, uint256 rewardAmount);
    event CampaignToggled(uint256 indexed campaignId, bool isActive);
    event CampaignClosed(uint256 indexed campaignId, uint256 unspentAmountRecovered);
    event RewardDistributed(uint256 indexed campaignId, address indexed recipient, uint256 amount);

    /**
     * @notice Initializes the promotional vault with ALPHA token and initial administrator
     * @param _alphaToken Address of the canonical ALPHA ERC20 token
     * @param _initialOwner Address of the protocol governance or timelock admin
     */
    constructor(address _alphaToken, address _initialOwner) {
        if (_alphaToken == address(0) || _initialOwner == address(0)) {
            revert IProtocolErrors.ZeroAddress();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, _initialOwner);
        _grantRole(ProtocolRoles.ADMIN_ROLE, _initialOwner);
        alphaToken = IERC20(_alphaToken);
    }

    /**
     * @notice Returns uncommitted balance available for new campaign allocations
     */
    function availableUnallocatedBalance() public view returns (uint256) {
        uint256 vaultBalance = alphaToken.balanceOf(address(this));
        uint256 unspentCommitments = totalAllocatedPool - totalDistributed;
        return vaultBalance > unspentCommitments ? vaultBalance - unspentCommitments : 0;
    }

    /**
     * @notice Creates a new marketing or referral incentive campaign
     * @param name Descriptive label for the campaign
     * @param rewardAmount Total ALPHA allocation committed for this campaign
     * @return campaignId Unique ID assigned to the new campaign
     */
    function createCampaign(string calldata name, uint256 rewardAmount)
        external
        onlyRole(ProtocolRoles.ADMIN_ROLE)
        returns (uint256 campaignId)
    {
        if (bytes(name).length == 0) revert EmptyCampaignName();
        if (rewardAmount == 0) revert IProtocolErrors.ZeroAmount();

        uint256 available = availableUnallocatedBalance();
        if (rewardAmount > available) {
            revert ExceedsPromotionalPool(rewardAmount, available);
        }

        campaignId = ++campaignCount;
        totalAllocatedPool += rewardAmount;

        campaigns[campaignId] = Campaign({
            id: campaignId,
            name: name,
            totalRewardAmount: rewardAmount,
            claimedRewardAmount: 0,
            isActive: true
        });

        emit CampaignCreated(campaignId, name, rewardAmount);
    }

    /**
     * @notice Distributes ALPHA tokens to a user participating in a promo campaign
     * @param campaignId ID of the active campaign
     * @param recipient Address receiving the reward
     * @param amount Tokens to distribute
     * @return Success status
     */
    function distributeReward(uint256 campaignId, address recipient, uint256 amount)
        external
        onlyRole(ProtocolRoles.ADMIN_ROLE)
        nonReentrant
        returns (bool)
    {
        if (campaignId == 0 || campaignId > campaignCount) revert InvalidCampaignId();
        if (recipient == address(0)) revert IProtocolErrors.ZeroAddress();
        if (amount == 0) revert IProtocolErrors.ZeroAmount();

        Campaign storage campaign = campaigns[campaignId];
        if (!campaign.isActive) revert CampaignNotActive();
        if (campaign.claimedRewardAmount + amount > campaign.totalRewardAmount) {
            revert CampaignBudgetExceeded(campaign.claimedRewardAmount + amount, campaign.totalRewardAmount);
        }

        campaign.claimedRewardAmount += amount;
        totalDistributed += amount;

        alphaToken.safeTransfer(recipient, amount);
        emit RewardDistributed(campaignId, recipient, amount);
        return true;
    }

    /**
     * @notice Distributes ALPHA tokens in batch to multiple recipients
     * @param campaignId ID of the active campaign
     * @param recipients Array of recipient addresses
     * @param amounts Array of reward amounts
     */
    function distributeRewardBatch(
        uint256 campaignId,
        address[] calldata recipients,
        uint256[] calldata amounts
    )
        external
        onlyRole(ProtocolRoles.ADMIN_ROLE)
        nonReentrant
    {
        if (recipients.length != amounts.length) revert ArrayLengthMismatch();
        if (campaignId == 0 || campaignId > campaignCount) revert InvalidCampaignId();

        Campaign storage campaign = campaigns[campaignId];
        if (!campaign.isActive) revert CampaignNotActive();

        uint256 totalBatch = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalBatch += amounts[i];
        }

        if (campaign.claimedRewardAmount + totalBatch > campaign.totalRewardAmount) {
            revert CampaignBudgetExceeded(campaign.claimedRewardAmount + totalBatch, campaign.totalRewardAmount);
        }

        campaign.claimedRewardAmount += totalBatch;
        totalDistributed += totalBatch;

        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] == address(0)) revert IProtocolErrors.ZeroAddress();
            if (amounts[i] == 0) revert IProtocolErrors.ZeroAmount();
            alphaToken.safeTransfer(recipients[i], amounts[i]);
            emit RewardDistributed(campaignId, recipients[i], amounts[i]);
        }
    }

    /**
     * @notice Toggles active status of a promotional campaign
     * @param campaignId Campaign to toggle
     * @param isActive New status
     */
    function toggleCampaign(uint256 campaignId, bool isActive) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (campaignId == 0 || campaignId > campaignCount) revert InvalidCampaignId();
        campaigns[campaignId].isActive = isActive;
        emit CampaignToggled(campaignId, isActive);
    }

    /**
     * @notice Closes a campaign early and reclaims unspent allocation back to the unallocated pool
     * @param campaignId Campaign to permanently close
     */
    function closeCampaign(uint256 campaignId) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (campaignId == 0 || campaignId > campaignCount) revert InvalidCampaignId();
        Campaign storage campaign = campaigns[campaignId];
        if (!campaign.isActive) revert CampaignNotActive();

        uint256 unspent = campaign.totalRewardAmount - campaign.claimedRewardAmount;
        campaign.isActive = false;
        campaign.totalRewardAmount = campaign.claimedRewardAmount;
        totalAllocatedPool -= unspent;

        emit CampaignClosed(campaignId, unspent);
    }

    /**
     * @notice Returns total campaign count
     */
    function getCampaignCount() external view returns (uint256) {
        return campaignCount;
    }
}
