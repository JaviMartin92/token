// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./lib/security/ReentrancyGuard.sol";
import "./GovernanceStaking.sol";
import "./interfaces/ISwapRouter.sol";

/**
 * @title RealYieldRouter
 * @notice Routes Real Yield distributions according to user preference (Option A: Stablecoin vs Option B: Reserve Asset).
 */
contract RealYieldRouter is Ownable, ReentrancyGuard {
    enum PayoutPreference { OPTION_A_STABLECOIN, OPTION_B_RESERVE_ASSET }

    address public immutable stablecoin;
    address public immutable reserveAsset; // e.g. WBTC/WETH
    address public immutable swapRouter;
    GovernanceStaking public immutable stakingPool;

    address public treasuryBunker;
    address public opsWallet;
    address public corporateRevenueWallet;

    mapping(address => PayoutPreference) public userPreferences;

    // Authorized callers for notifyYield (VestedDiscountVault, Treasury)
    mapping(address => bool) public authorizedYieldCallers;

    event PayoutPreferenceSet(address indexed user, PayoutPreference preference);
    event YieldClaimed(address indexed user, uint256 yieldAmount, PayoutPreference preference, uint256 payoutAmount);

    modifier onlyAuthorizedYield() {
        require(authorizedYieldCallers[msg.sender] || msg.sender == owner(), "RealYieldRouter: Not authorized");
        _;
    }

    constructor(
        address _stablecoin,
        address _reserveAsset,
        address _swapRouter,
        address _stakingPool,
        address _initialOwner
    ) Ownable() {
        stablecoin = _stablecoin;
        reserveAsset = _reserveAsset;
        swapRouter = _swapRouter;
        stakingPool = GovernanceStaking(_stakingPool);

        if (_initialOwner != msg.sender) {
            transferOwnership(_initialOwner);
        }
    }

    function setWallets(address _treasuryBunker, address _opsWallet, address _corporateRevenueWallet) external onlyOwner {
        treasuryBunker = _treasuryBunker;
        opsWallet = _opsWallet;
        corporateRevenueWallet = _corporateRevenueWallet;
    }

    function setAuthorizedYieldCaller(address caller, bool authorized) external onlyOwner {
        require(caller != address(0), "RealYieldRouter: Zero address");
        authorizedYieldCallers[caller] = authorized;
    }

    function setPayoutPreference(PayoutPreference preference) external {
        userPreferences[msg.sender] = preference;
        emit PayoutPreferenceSet(msg.sender, preference);
    }

    /**
     * @notice Notifies incoming stablecoin fee yields and routes them according to the strict 50/25/25 protocol fee split:
     *         50% Treasury Reserves (NAV Growth), 25% Protocol Ops Fund (Alpha Labs SL), 25% Owner Corporate Revenue.
     */
    function notifyYield(uint256 /* amount */) external onlyAuthorizedYield {
        uint256 bal = IERC20(stablecoin).balanceOf(address(this));
        if (bal > 0) {
            uint256 toTreasury = (treasuryBunker != address(0)) ? (bal * 5000) / 10000 : 0;
            uint256 toOps = (opsWallet != address(0)) ? (bal * 2500) / 10000 : 0;
            uint256 toCorp = (corporateRevenueWallet != address(0)) ? (bal * 2500) / 10000 : bal - toTreasury - toOps;

            if (toTreasury > 0) {
                require(IERC20(stablecoin).transfer(treasuryBunker, toTreasury), "RealYieldRouter: Treasury transfer failed");
            }
            if (toOps > 0) {
                require(IERC20(stablecoin).transfer(opsWallet, toOps), "RealYieldRouter: Ops transfer failed");
            }
            if (toCorp > 0) {
                require(IERC20(stablecoin).transfer(corporateRevenueWallet, toCorp), "RealYieldRouter: Corp transfer failed");
            }
        }
    }

    function claimRealYield() external nonReentrant returns (uint256 payoutAmount) {
        PayoutPreference pref = userPreferences[msg.sender];
        uint256 yieldAmount = stakingPool.claimRewardFor(msg.sender);
        require(yieldAmount > 0, "RealYieldRouter: No yield claimable");

        if (pref == PayoutPreference.OPTION_A_STABLECOIN) {
            payoutAmount = yieldAmount;
            require(IERC20(stablecoin).transfer(msg.sender, payoutAmount), "RealYieldRouter: Stablecoin payout failed");
        } else {
            // Option B: Reserve Asset (atomic swap or stablecoin fallback if router fails)
            if (swapRouter != address(0)) {
                IERC20(stablecoin).approve(swapRouter, yieldAmount);
                // Minimum 1% slippage protection to prevent MEV sandwich attacks
                uint256 minOut = (yieldAmount * 9900) / 10000;
                try ISwapRouter(swapRouter).exactInputSingle(
                    ISwapRouter.ExactInputSingleParams({
                        tokenIn: stablecoin,
                        tokenOut: reserveAsset,
                        fee: 3000,
                        recipient: msg.sender,
                        deadline: block.timestamp + 15 minutes,
                        amountIn: yieldAmount,
                        amountOutMinimum: minOut,
                        sqrtPriceLimitX96: 0
                    })
                ) returns (uint256 tokensBought) {
                    payoutAmount = tokensBought;
                } catch {
                    payoutAmount = yieldAmount;
                    require(IERC20(stablecoin).transfer(msg.sender, payoutAmount), "RealYieldRouter: Fallback payout failed");
                }
            } else {
                payoutAmount = yieldAmount;
                require(IERC20(stablecoin).transfer(msg.sender, payoutAmount), "RealYieldRouter: Direct payout failed");
            }
        }

        emit YieldClaimed(msg.sender, yieldAmount, pref, payoutAmount);
    }
}
