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
 *         Enforces linear release and administrative approvals for marketing, referral rewards, and partnerships.
 */
contract PromotionalIncentiveVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Domain Custom Errors
    error ExceedsPromotionalPool(uint256 requested, uint256 available);
    error CampaignNotActive();
    error CampaignBudgetExceeded(uint256 attempted, uint256 budget);
    error InvalidCampaignId();

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

    event CampaignCreated(uint256 indexed campaignId, string name, uint256 rewardAmount);
    event RewardDistributed(uint256 indexed campaignId, address indexed recipient, uint256 amount);

    constructor(address _alphaToken, address _initialOwner) {
        address admin = (_initialOwner != address(0)) ? _initialOwner : msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ProtocolRoles.ADMIN_ROLE, admin);
        alphaToken = IERC20(_alphaToken);
    }

    /**
     * @notice Creates a new marketing or referral incentive campaign
     */
    function createCampaign(string calldata name, uint256 rewardAmount)
        external
        onlyRole(ProtocolRoles.ADMIN_ROLE)
        returns (uint256 campaignId)
    {
        if (rewardAmount == 0) revert IProtocolErrors.ZeroAmount();
        uint256 vaultBalance = alphaToken.balanceOf(address(this));
        if (totalDistributed + rewardAmount > vaultBalance) {
            revert ExceedsPromotionalPool(totalDistributed + rewardAmount, vaultBalance);
        }

        campaignId = ++campaignCount;
        campaigns[campaignId] = Campaign({
            id: campaignId, name: name, totalRewardAmount: rewardAmount, claimedRewardAmount: 0, isActive: true
        });

        emit CampaignCreated(campaignId, name, rewardAmount);
    }

    /**
     * @notice Distributes ALPHA tokens to a user participating in a promo campaign
     */
    function distributeReward(uint256 campaignId, address recipient, uint256 amount)
        external
        onlyRole(ProtocolRoles.ADMIN_ROLE)
        nonReentrant
        returns (bool)
    {
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
     * @notice Toggles active status of a promotional campaign
     */
    function toggleCampaign(uint256 campaignId, bool isActive) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (campaignId == 0 || campaignId > campaignCount) revert InvalidCampaignId();
        campaigns[campaignId].isActive = isActive;
    }

    /**
     * @notice Returns total campaign count
     */
    function getCampaignCount() external view returns (uint256) {
        return campaignCount;
    }
}
