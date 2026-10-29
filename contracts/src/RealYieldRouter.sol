// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ProtocolRoles.sol";
import "./lib/security/ReentrancyGuard.sol";
import "./GovernanceStaking.sol";
import "./CommunityYieldVault.sol";
import "./interfaces/ISwapRouter.sol";
import "./interfaces/IProtocolErrors.sol";
import "./interfaces/IOracleHub.sol";
import "./interfaces/ITreasury.sol";

interface ICircuitBreakerRouter {
    function isFrozen(address asset) external view returns (bool);
}

/**
 * @title RealYieldRouter
 * @author Alpha Centauri Architecture Team
 * @notice Universal Fee Router enforcing Pure DeFi MiCA Compliance & Universal Multi-Asset Real Yield Basket:
 *         - Fee Routing: 50% Strategic Reserve, 50% Community Real Yield (Liquid USDC).
 *         - Universal Payout Basket: 50% USDC + 25% WBTC + 12.5% WETH + 12.5% ALPHA (at current NAV).
 * @dev Employs SafeERC20 zero-reset approvals to ensure full compatibility with USDT and non-standard tokens.
 */
contract RealYieldRouter is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable stablecoin;
    address public immutable reserveAsset; // Backward-compatibility
    address public immutable swapRouter;
    GovernanceStaking public immutable stakingPool;

    address public treasuryBunker;
    address public communityYieldVault;
    address public circuitBreaker;

    address public oracleHub;
    uint256 public slippageToleranceBps = 100; // default 1%
    uint24 public reserveFeeTier = 3000; // 0.30% Uniswap v3 fee tier default

    address public wbtc;
    address public weth;
    address public alphaToken;

    mapping(address => bool) public authorizedYieldCallers;

    // --- Events ---
    event BasketAssetsUpdated(address indexed wbtc, address indexed weth, address indexed alphaToken);
    event RealYieldBasketClaimed(
        address indexed user,
        uint256 totalYieldUSD,
        uint256 usdcPaid,
        uint256 wbtcPaid,
        uint256 wethPaid,
        uint256 alphaPaid
    );
    event UniversalFeeRouted(
        address indexed feeToken, uint256 totalAmount, uint256 toTreasury, uint256 toCommunityYieldUsdc
    );
    event ProtocolVaultsUpdated(address indexed treasuryBunker, address indexed communityYieldVault);
    event OracleConfigUpdated(address indexed oracleHub, uint256 slippageBps);
    event AuthorizedYieldCallerUpdated(address indexed caller, bool authorized);
    event ReserveFeeTierUpdated(uint24 oldTier, uint24 newTier);
    event CircuitBreakerUpdated(address oldBreaker, address newBreaker);
    event TokensSwept(address indexed token, address indexed to, uint256 amount);

    modifier onlyAuthorizedYield() {
        if (!authorizedYieldCallers[msg.sender] && !hasRole(ProtocolRoles.ADMIN_ROLE, msg.sender)) {
            revert IProtocolErrors.Unauthorized();
        }
        _;
    }

    /**
     * @notice Initializes the fee router with core asset addresses and staking pool
     */
    constructor(
        address _stablecoin,
        address _reserveAsset,
        address _swapRouter,
        address _stakingPool,
        address _initialOwner
    ) {
        if (_stablecoin == address(0) || _stakingPool == address(0) || _initialOwner == address(0)) {
            revert IProtocolErrors.ZeroAddress();
        }

        stablecoin = _stablecoin;
        reserveAsset = _reserveAsset;
        wbtc = _reserveAsset;
        swapRouter = _swapRouter;
        stakingPool = GovernanceStaking(_stakingPool);

        _grantRole(DEFAULT_ADMIN_ROLE, _initialOwner);
        _grantRole(ProtocolRoles.ADMIN_ROLE, _initialOwner);
    }

    /**
     * @notice Configures protocol vault destinations
     * @param _treasuryBunker Address of the Treasury bunker vault
     * @param _communityYieldVault Address of the Community Yield vault
     */
    function setProtocolVaults(address _treasuryBunker, address _communityYieldVault)
        external
        onlyRole(ProtocolRoles.ADMIN_ROLE)
    {
        treasuryBunker = _treasuryBunker;
        communityYieldVault = _communityYieldVault;
        emit ProtocolVaultsUpdated(_treasuryBunker, _communityYieldVault);
    }

    /**
     * @notice Sets addresses of the multi-asset real yield payout basket
     */
    function setBasketAssets(address _wbtc, address _weth, address _alphaToken)
        external
        onlyRole(ProtocolRoles.ADMIN_ROLE)
    {
        wbtc = _wbtc;
        weth = _weth;
        alphaToken = _alphaToken;
        emit BasketAssetsUpdated(_wbtc, _weth, _alphaToken);
    }

    /**
     * @notice Configures the circuit breaker contract
     */
    function setCircuitBreaker(address _circuitBreaker) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        address old = circuitBreaker;
        circuitBreaker = _circuitBreaker;
        emit CircuitBreakerUpdated(old, _circuitBreaker);
    }

    /**
     * @notice Configures Uniswap v3 fee tier for reserve swaps
     */
    function setReserveFeeTier(uint24 _feeTier) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_feeTier != 100 && _feeTier != 500 && _feeTier != 3000 && _feeTier != 10000) {
            revert IProtocolErrors.InvalidParameters();
        }
        uint24 old = reserveFeeTier;
        reserveFeeTier = _feeTier;
        emit ReserveFeeTierUpdated(old, _feeTier);
    }

    /**
     * @notice Rescues accidentally sent tokens
     */
    function sweepTokens(address token, address to) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (token == address(0) || to == address(0)) revert IProtocolErrors.ZeroAddress();
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal == 0) revert IProtocolErrors.InvalidAmount();
        IERC20(token).safeTransfer(to, bal);
        emit TokensSwept(token, to, bal);
    }

    /**
     * @notice Authorizes or revokes an external contract to trigger yield routing
     */
    function setAuthorizedYieldCaller(address caller, bool authorized) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (caller == address(0)) revert IProtocolErrors.ZeroAddress();
        authorizedYieldCallers[caller] = authorized;
        emit AuthorizedYieldCallerUpdated(caller, authorized);
    }

    /**
     * @notice Configures the oracle hub and max slippage tolerance (max 10% / 1000 bps)
     */
    function setOracleConfig(address _oracleHub, uint256 _slippageBps) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_slippageBps > 1000) revert IProtocolErrors.InvalidParameters();
        oracleHub = _oracleHub;
        slippageToleranceBps = _slippageBps;
        emit OracleConfigUpdated(_oracleHub, _slippageBps);
    }

    function _isAssetFrozen(address asset) internal view returns (bool) {
        if (circuitBreaker == address(0) || asset == address(0)) return false;
        try ICircuitBreakerRouter(circuitBreaker).isFrozen(asset) returns (bool frozen) {
            return frozen;
        } catch {
            return false;
        }
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
                IERC20(feeToken).safeApprove(communityYieldVault, 0);
                IERC20(feeToken).safeApprove(communityYieldVault, communityShare);
                try CommunityYieldVault(communityYieldVault).depositYield(communityShare) {} catch {
                    IERC20(feeToken).safeTransfer(communityYieldVault, communityShare);
                }
            } else if (address(stakingPool) != address(0) && feeToken == stablecoin) {
                IERC20(feeToken).safeApprove(address(stakingPool), 0);
                IERC20(feeToken).safeApprove(address(stakingPool), communityShare);
                try stakingPool.notifyRewardAmount(communityShare) {} catch {
                    IERC20(feeToken).safeTransfer(address(stakingPool), communityShare);
                }
            }

            emit UniversalFeeRouted(feeToken, bal, toTreasury, communityShare);
        }
    }

    /**
     * @notice Universal Multi-Asset Real Yield Basket Claim (Exclusive & Mandatory):
     *         Distributes 100% of accumulated yield across the 4 portfolio pillars:
     *         - 50.00% in Liquid USDC
     *         - 25.00% in WBTC (swapped via Chainlink oracle pricing)
     *         - 12.50% in WETH (swapped via Chainlink oracle pricing)
     *         - 12.50% in ALPHA (minted at current NAV directly into protocol reserves)
     */
    function claimRealYield()
        external
        nonReentrant
        returns (uint256 payoutAmount, uint256 wbtcPaid, uint256 wethPaid, uint256 alphaPaid)
    {
        uint256 yieldAmount = stakingPool.claimRewardFor(msg.sender);
        if (yieldAmount == 0) revert IProtocolErrors.ZeroAmount();

        uint256 usdcShare = (yieldAmount * 5000) / 10000;
        uint256 wbtcShare = (yieldAmount * 2500) / 10000;
        uint256 wethShare = (yieldAmount * 1250) / 10000;
        uint256 alphaShare = yieldAmount - usdcShare - wbtcShare - wethShare;

        uint256 usdcPayout = usdcShare;

        // 1. WBTC Allocation (25.00%)
        if (wbtc != address(0) && swapRouter != address(0) && !_isAssetFrozen(wbtc)) {
            uint256 minWbtc = 0;
            if (oracleHub != address(0)) {
                try IOracleHub(oracleHub).getPriceBase18(wbtc) returns (uint256 price18) {
                    if (price18 > 0) {
                        uint256 expected = (wbtcShare * 1e12 * 1e8) / price18;
                        minWbtc = (expected * (10000 - slippageToleranceBps)) / 10000;
                    }
                } catch {}
            }
            IERC20(stablecoin).safeApprove(swapRouter, 0);
            IERC20(stablecoin).safeApprove(swapRouter, wbtcShare);
            try ISwapRouter(swapRouter).exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: stablecoin,
                    tokenOut: wbtc,
                    fee: reserveFeeTier,
                    recipient: msg.sender,
                    deadline: block.timestamp + 15 minutes,
                    amountIn: wbtcShare,
                    amountOutMinimum: minWbtc,
                    sqrtPriceLimitX96: 0
                })
            ) returns (uint256 bought) {
                wbtcPaid = bought;
            } catch {
                usdcPayout += wbtcShare; // Fallback to USDC
            }
        } else {
            usdcPayout += wbtcShare;
        }

        // 2. WETH Allocation (12.50%)
        if (weth != address(0) && swapRouter != address(0) && !_isAssetFrozen(weth)) {
            uint256 minWeth = 0;
            if (oracleHub != address(0)) {
                try IOracleHub(oracleHub).getPriceBase18(weth) returns (uint256 price18) {
                    if (price18 > 0) {
                        uint256 expected = (wethShare * 1e12 * 1e18) / price18;
                        minWeth = (expected * (10000 - slippageToleranceBps)) / 10000;
                    }
                } catch {}
            }
            IERC20(stablecoin).safeApprove(swapRouter, 0);
            IERC20(stablecoin).safeApprove(swapRouter, wethShare);
            try ISwapRouter(swapRouter).exactInputSingle(
                ISwapRouter.ExactInputSingleParams({
                    tokenIn: stablecoin,
                    tokenOut: weth,
                    fee: reserveFeeTier,
                    recipient: msg.sender,
                    deadline: block.timestamp + 15 minutes,
                    amountIn: wethShare,
                    amountOutMinimum: minWeth,
                    sqrtPriceLimitX96: 0
                })
            ) returns (uint256 bought) {
                wethPaid = bought;
            } catch {
                usdcPayout += wethShare; // Fallback to USDC
            }
        } else {
            usdcPayout += wethShare;
        }

        // 3. ALPHA Allocation (12.50% at current NAV)
        if (treasuryBunker != address(0) && alphaToken != address(0)) {
            IERC20(stablecoin).safeApprove(treasuryBunker, 0);
            IERC20(stablecoin).safeApprove(treasuryBunker, alphaShare);
            try ITreasury(treasuryBunker).mintCorporateFeeShares(alphaShare) returns (uint256 mintedShares) {
                alphaPaid = mintedShares;
                IERC20(alphaToken).safeTransfer(msg.sender, mintedShares);
            } catch {
                usdcPayout += alphaShare; // Fallback to USDC
            }
        } else {
            usdcPayout += alphaShare;
        }

        // 4. Transfer USDC (50% Base + any fallback)
        if (usdcPayout > 0) {
            IERC20(stablecoin).safeTransfer(msg.sender, usdcPayout);
        }

        payoutAmount = usdcPayout;

        emit RealYieldBasketClaimed(msg.sender, yieldAmount, usdcPayout, wbtcPaid, wethPaid, alphaPaid);
    }
}
