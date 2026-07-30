// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./lib/security/ReentrancyGuard.sol";
import "./GovernanceStaking.sol";
import "./CorporateOpExVault.sol";
import "./CorporateProfitVault.sol";
import "./interfaces/ISwapRouter.sol";

/**
 * @title RealYieldRouter
 * @notice Universal Fee Router enforcing the strict 50 / 25 / 25 Tokenomics Specification:
 *         - 50%: Strategic Reserve (Treasury.sol)
 *         - 25%: Corporate OpEx Vault (Auto-Swapped to ALPHA & Auto-Staked)
 *         - 25%: Corporate Profit Vault (Auto-Swapped to ALPHA & Auto-Staked)
 */
contract RealYieldRouter is Ownable, ReentrancyGuard {
    enum PayoutPreference { OPTION_A_STABLECOIN, OPTION_B_RESERVE_ASSET }

    address public immutable stablecoin;
    address public immutable reserveAsset; // e.g. WBTC/WETH
    address public immutable swapRouter;
    GovernanceStaking public immutable stakingPool;

    address public treasuryBunker;
    address public corporateOpExVault;
    address public corporateProfitVault;
    address public alphaToken;

    mapping(address => PayoutPreference) public userPreferences;
    mapping(address => bool) public authorizedYieldCallers;

    event PayoutPreferenceSet(address indexed user, PayoutPreference preference);
    event YieldClaimed(address indexed user, uint256 yieldAmount, PayoutPreference preference, uint256 payoutAmount);
    event UniversalFeeRouted(address indexed feeToken, uint256 totalAmount, uint256 toTreasury, uint256 toOpExAlpha, uint256 toProfitAlpha);

    modifier onlyAuthorizedYield() {
        require(authorizedYieldCallers[msg.sender] || msg.sender == owner(), "RealYieldRouter: Not authorized");
        _;
    }

    constructor(
        address _stablecoin,
        address _reserveAsset,
        address _swapRouter,
        address _stakingPool
    ) Ownable(msg.sender) {
        stablecoin = _stablecoin;
        reserveAsset = _reserveAsset;
        swapRouter = _swapRouter;
        stakingPool = GovernanceStaking(_stakingPool);
    }

    function setCorporateVaults(address _opExVault, address _profitVault, address _treasuryBunker, address _alphaToken) external onlyOwner {
        corporateOpExVault = _opExVault;
        corporateProfitVault = _profitVault;
        treasuryBunker = _treasuryBunker;
        alphaToken = _alphaToken;
    }

    function setAuthorizedYieldCaller(address caller, bool authorized) external onlyOwner {
        authorizedYieldCallers[caller] = authorized;
    }

    function setPayoutPreference(PayoutPreference preference) external {
        userPreferences[msg.sender] = preference;
        emit PayoutPreferenceSet(msg.sender, preference);
    }

    /**
     * @notice Routes incoming fees according to the 50/25/25 Tokenomics Specification:
     *         50% Strategic Reserve, 25% OpEx (Auto-Swapped to ALPHA & Auto-Staked), 25% Profit (Auto-Swapped to ALPHA & Auto-Staked).
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
        uint256 corporateShare = bal - toTreasury; // 50% for OpEx + Profit

        if (toTreasury > 0 && treasuryBunker != address(0)) {
            require(IERC20(feeToken).transfer(treasuryBunker, toTreasury), "RealYieldRouter: Treasury transfer failed");
        }

        if (corporateShare > 0) {
            uint256 alphaAmount = 0;

            // Auto-Swap non-ALPHA fee tokens into ALPHA tokens on secondary market
            if (feeToken == alphaToken || alphaToken == address(0)) {
                alphaAmount = corporateShare;
            } else {
                bool swapped = false;
                if (swapRouter != address(0)) {
                    IERC20(feeToken).approve(swapRouter, corporateShare);
                    try ISwapRouter(swapRouter).exactInputSingle(
                        ISwapRouter.ExactInputSingleParams({
                            tokenIn: feeToken,
                            tokenOut: alphaToken,
                            fee: 3000,
                            recipient: address(this),
                            deadline: block.timestamp + 15 minutes,
                            amountIn: corporateShare,
                            amountOutMinimum: 0,
                            sqrtPriceLimitX96: 0
                        })
                    ) returns (uint256 tokensBought) {
                        if (tokensBought > 0) {
                            alphaAmount = tokensBought;
                            swapped = true;
                        }
                    } catch {}
                }

                if (!swapped && treasuryBunker != address(0)) {
                    IERC20(feeToken).approve(treasuryBunker, corporateShare);
                    try ITreasury(treasuryBunker).mintCorporateFeeShares(corporateShare) returns (uint256 sharesMinted) {
                        alphaAmount = sharesMinted;
                    } catch {
                        IERC20(feeToken).transfer(treasuryBunker, corporateShare);
                        alphaAmount = 0;
                    }
                }
            }

            uint256 opExShare = alphaAmount / 2;       // 25%
            uint256 profitShare = alphaAmount - opExShare; // 25%

            if (opExShare > 0 && corporateOpExVault != address(0)) {
                IERC20(alphaToken).approve(corporateOpExVault, opExShare);
                try CorporateOpExVault(corporateOpExVault).depositStaking(opExShare) {} catch {
                    IERC20(alphaToken).transfer(corporateOpExVault, opExShare);
                }
            }

            if (profitShare > 0 && corporateProfitVault != address(0)) {
                IERC20(alphaToken).approve(corporateProfitVault, profitShare);
                try CorporateProfitVault(corporateProfitVault).depositStaking(profitShare) {} catch {
                    IERC20(alphaToken).transfer(corporateProfitVault, profitShare);
                }
            }

            emit UniversalFeeRouted(feeToken, bal, toTreasury, opExShare, profitShare);
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
