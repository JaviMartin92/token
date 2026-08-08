// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./lib/security/ReentrancyGuard.sol";
import "./GovernanceStaking.sol";
import "./ProtocolOpExVault.sol";
import "./CommunityYieldVault.sol";
import "./interfaces/ISwapRouter.sol";

/**
 * @title RealYieldRouter
 * @notice Universal Fee Router enforcing Pure DeFi MiCA Compliance:
 *         - 50%: Strategic Reserve (Treasury.sol - Subida inmediata de NAV)
 *         - 25%: Protocol OpEx Vault (Liquid USDC for RPCs, Oracles, Dev Grants)
 *         - 25%: Community Yield Vault (Liquid USDC for stALPHA stakers real-time dividend claims)
 */
contract RealYieldRouter is Ownable, ReentrancyGuard {
    enum PayoutPreference { OPTION_A_STABLECOIN, OPTION_B_RESERVE_ASSET }

    address public immutable stablecoin;
    address public immutable reserveAsset; // e.g. WBTC/WETH
    address public immutable swapRouter;
    GovernanceStaking public immutable stakingPool;

    address public treasuryBunker;
    address public protocolOpExVault;
    address public communityYieldVault;

    mapping(address => PayoutPreference) public userPreferences;
    mapping(address => bool) public authorizedYieldCallers;

    event PayoutPreferenceSet(address indexed user, PayoutPreference preference);
    event YieldClaimed(address indexed user, uint256 yieldAmount, PayoutPreference preference, uint256 payoutAmount);
    event UniversalFeeRouted(address indexed feeToken, uint256 totalAmount, uint256 toTreasury, uint256 toOpExUsdc, uint256 toCommunityYieldUsdc);

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

        if (_initialOwner != address(0) && _initialOwner != msg.sender) {
            transferOwnership(_initialOwner);
        }
    }

    function setProtocolVaults(address _treasuryBunker, address _opExVault, address _communityYieldVault) external onlyOwner {
        treasuryBunker = _treasuryBunker;
        protocolOpExVault = _opExVault;
        communityYieldVault = _communityYieldVault;
    }

    function setWallets(address _treasuryBunker, address _opsWallet, address _communityVault) external onlyOwner {
        treasuryBunker = _treasuryBunker;
        protocolOpExVault = _opsWallet;
        communityYieldVault = _communityVault;
    }

    function setAuthorizedYieldCaller(address caller, bool authorized) external onlyOwner {
        authorizedYieldCallers[caller] = authorized;
    }

    function setPayoutPreference(PayoutPreference preference) external {
        userPreferences[msg.sender] = preference;
        emit PayoutPreferenceSet(msg.sender, preference);
    }

    /**
     * @notice Routes incoming fees according to 50 / 25 / 25 Liquid USDC Specification:
     *         50% Strategic Reserve, 25% Protocol OpEx (Liquid USDC), 25% Community Real Yield (Liquid USDC).
     */
    function notifyYield(uint256 /* amount */) external onlyAuthorizedYield {
        routeUniversalFee(stablecoin);
    }

    /**
     * @notice Universal fee processing for ANY token collected as fee across modules.
     */
    function routeUniversalFee(address feeToken) public nonReentrant {
        uint256 bal = IERC20(feeToken).balanceOf(address(this));
        if (bal == 0) return;

        uint256 toTreasury = (treasuryBunker != address(0)) ? (bal * 5000) / 10000 : 0;
        uint256 communitySharePool = bal - toTreasury; // 50% for OpEx + Community Yield

        if (toTreasury > 0 && treasuryBunker != address(0)) {
            require(IERC20(feeToken).transfer(treasuryBunker, toTreasury), "RealYieldRouter: Treasury transfer failed");
            if (feeToken == stablecoin) {
                try ITreasury(treasuryBunker).notifyReserveFee(toTreasury) {} catch {}
            }
        }

        if (communitySharePool > 0) {
            uint256 opExShare = communitySharePool / 2;               // 25%
            uint256 communityShare = communitySharePool - opExShare; // 25%

            if (opExShare > 0 && protocolOpExVault != address(0)) {
                IERC20(feeToken).approve(protocolOpExVault, opExShare);
                try ProtocolOpExVault(protocolOpExVault).depositOpEx(opExShare) {} catch {
                    IERC20(feeToken).transfer(protocolOpExVault, opExShare);
                }
            }

            if (communityShare > 0 && communityYieldVault != address(0)) {
                IERC20(feeToken).approve(communityYieldVault, communityShare);
                try CommunityYieldVault(communityYieldVault).depositYield(communityShare) {} catch {
                    IERC20(feeToken).transfer(communityYieldVault, communityShare);
                }
            } else if (communityShare > 0 && address(stakingPool) != address(0) && feeToken == stablecoin) {
                IERC20(feeToken).approve(address(stakingPool), communityShare);
                try stakingPool.notifyRewardAmount(communityShare) {} catch {
                    IERC20(feeToken).transfer(address(stakingPool), communityShare);
                }
            }

            emit UniversalFeeRouted(feeToken, bal, toTreasury, opExShare, communityShare);
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
            // Option B: Reserve Asset
            if (swapRouter != address(0)) {
                IERC20(stablecoin).approve(swapRouter, yieldAmount);
                try ISwapRouter(swapRouter).exactInputSingle(
                    ISwapRouter.ExactInputSingleParams({
                        tokenIn: stablecoin,
                        tokenOut: reserveAsset,
                        fee: 3000,
                        recipient: msg.sender,
                        deadline: block.timestamp + 15 minutes,
                        amountIn: yieldAmount,
                        amountOutMinimum: 0,
                        sqrtPriceLimitX96: 0
                    })
                ) returns (uint256 tokensBought) {
                    payoutAmount = tokensBought;
                } catch {
                    payoutAmount = yieldAmount;
                    require(IERC20(stablecoin).transfer(msg.sender, payoutAmount), "RealYieldRouter: Fallback stablecoin transfer failed");
                }
            } else {
                payoutAmount = yieldAmount;
                require(IERC20(stablecoin).transfer(msg.sender, payoutAmount), "RealYieldRouter: Fallback stablecoin transfer failed");
            }
        }

        emit YieldClaimed(msg.sender, yieldAmount, pref, payoutAmount);
    }
}
