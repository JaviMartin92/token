// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./lib/security/ReentrancyGuard.sol";
import "./GovernanceStaking.sol";
import "./ProtocolOpExVault.sol";
import "./CommunityYieldVault.sol";
import "./interfaces/ISwapRouter.sol";

import "./interfaces/IOracleHub.sol";

/**
 * @title RealYieldRouter
 * @notice Universal Fee Router enforcing Pure DeFi MiCA Compliance:
 *         - 50%: Strategic Reserve (Treasury.sol - Subida inmediata de NAV)
 *         - 50%: Community Yield Vault (Liquid USDC for stALPHA stakers real-time dividend claims)
 */
contract RealYieldRouter is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    enum PayoutPreference { OPTION_A_STABLECOIN, OPTION_B_RESERVE_ASSET }

    address public immutable stablecoin;
    address public immutable reserveAsset; // e.g. WBTC/WETH
    address public immutable swapRouter;
    GovernanceStaking public immutable stakingPool;

    address public treasuryBunker;
    address public communityYieldVault;
    
    address public oracleHub;
    uint256 public slippageToleranceBps = 100; // default 1%

    mapping(address => PayoutPreference) public userPreferences;
    mapping(address => bool) public authorizedYieldCallers;

    event PayoutPreferenceSet(address indexed user, PayoutPreference preference);
    event YieldClaimed(address indexed user, uint256 yieldAmount, PayoutPreference preference, uint256 payoutAmount);
    event UniversalFeeRouted(address indexed feeToken, uint256 totalAmount, uint256 toTreasury, uint256 toCommunityYieldUsdc);

    modifier onlyAuthorizedYield() {
        require(authorizedYieldCallers[msg.sender] || hasRole(ProtocolRoles.ADMIN_ROLE, msg.sender), "RealYieldRouter: Not authorized");
        _;
    }

    constructor(
        address _stablecoin,
        address _reserveAsset,
        address _swapRouter,
        address _stakingPool,
        address _initialOwner
    ) {
        stablecoin = _stablecoin;
        reserveAsset = _reserveAsset;
        swapRouter = _swapRouter;
        stakingPool = GovernanceStaking(_stakingPool);

        address admin = (_initialOwner != address(0)) ? _initialOwner : msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ProtocolRoles.ADMIN_ROLE, admin);
    }

    function setProtocolVaults(address _treasuryBunker, address _communityYieldVault) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        treasuryBunker = _treasuryBunker;
        communityYieldVault = _communityYieldVault;
    }

    function setAuthorizedYieldCaller(address caller, bool authorized) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        authorizedYieldCallers[caller] = authorized;
    }

    function setOracleConfig(address _oracleHub, uint256 _slippageBps) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        oracleHub = _oracleHub;
        slippageToleranceBps = _slippageBps;
    }

    function setPayoutPreference(PayoutPreference preference) external {
        userPreferences[msg.sender] = preference;
        emit PayoutPreferenceSet(msg.sender, preference);
    }

    /**
     * @notice Routes incoming fees according to 50 / 50 Liquid USDC Specification:
     *         50% Strategic Reserve, 50% Community Real Yield (Liquid USDC).
     */
    function notifyYield(uint256 /* amount */) external onlyAuthorizedYield {
        routeUniversalFee(stablecoin);
    }

    /**
     * @notice Universal fee processing for ANY token collected as fee across modules.
     */
    function routeUniversalFee(address feeToken) public nonReentrant onlyAuthorizedYield {
        uint256 bal = IERC20(feeToken).balanceOf(address(this));
        if (bal == 0) return;

        uint256 toTreasury = (treasuryBunker != address(0)) ? (bal * 5000) / 10000 : 0;
        uint256 communityShare = bal - toTreasury; // 50% for Community Yield

        if (toTreasury > 0 && treasuryBunker != address(0)) {
            IERC20(feeToken).safeTransfer(treasuryBunker, toTreasury);
            if (feeToken == stablecoin) {
                try ITreasury(treasuryBunker).notifyReserveFee(toTreasury) {} catch {}
            }
        }

        if (communityShare > 0) {
            if (communityYieldVault != address(0)) {
                IERC20(feeToken).approve(communityYieldVault, communityShare);
                try CommunityYieldVault(communityYieldVault).depositYield(communityShare) {} catch {
                    IERC20(feeToken).safeTransfer(communityYieldVault, communityShare);
                }
            } else if (address(stakingPool) != address(0) && feeToken == stablecoin) {
                IERC20(feeToken).approve(address(stakingPool), communityShare);
                try stakingPool.notifyRewardAmount(communityShare) {} catch {
                    IERC20(feeToken).safeTransfer(address(stakingPool), communityShare);
                }
            }

            emit UniversalFeeRouted(feeToken, bal, toTreasury, communityShare);
        }
    }

    function claimRealYield() external nonReentrant returns (uint256 payoutAmount) {
        PayoutPreference pref = userPreferences[msg.sender];
        uint256 yieldAmount = stakingPool.claimRewardFor(msg.sender);
        require(yieldAmount > 0, "RealYieldRouter: No yield claimable");

        if (pref == PayoutPreference.OPTION_A_STABLECOIN) {
            payoutAmount = yieldAmount;
            IERC20(stablecoin).safeTransfer(msg.sender, payoutAmount);
        } else {
            // Option B: Reserve Asset
            if (swapRouter != address(0)) {
                uint256 minReserve = 0;
                if (oracleHub != address(0)) {
                    uint256 reservePrice18 = IOracleHub(oracleHub).getPriceBase18(reserveAsset);
                    uint8 reserveDec = 8;
                    (bool success, bytes memory data) = reserveAsset.staticcall(abi.encodeWithSignature("decimals()"));
                    if (success && data.length > 0) {
                        reserveDec = abi.decode(data, (uint8));
                    }
                    // yieldAmount has 6 decimals (stablecoin).
                    // USD value (18 dec) = yieldAmount * 10**12
                    // reserveAmount = (USD value * 10**reserveDec) / reservePrice18
                    uint256 expectedReserve = (yieldAmount * 10**12 * 10**reserveDec) / reservePrice18;
                    minReserve = (expectedReserve * (10000 - slippageToleranceBps)) / 10000;
                }

                IERC20(stablecoin).approve(swapRouter, yieldAmount);
                try ISwapRouter(swapRouter).exactInputSingle(
                    ISwapRouter.ExactInputSingleParams({
                        tokenIn: stablecoin,
                        tokenOut: reserveAsset,
                        fee: 3000,
                        recipient: msg.sender,
                        deadline: block.timestamp + 15 minutes,
                        amountIn: yieldAmount,
                        amountOutMinimum: minReserve,
                        sqrtPriceLimitX96: 0
                    })
                ) returns (uint256 tokensBought) {
                    payoutAmount = tokensBought;
                } catch {
                    payoutAmount = yieldAmount;
                    IERC20(stablecoin).safeTransfer(msg.sender, payoutAmount);
                }
            } else {
                payoutAmount = yieldAmount;
                IERC20(stablecoin).safeTransfer(msg.sender, payoutAmount);
            }
        }

        emit YieldClaimed(msg.sender, yieldAmount, pref, payoutAmount);
    }
}
