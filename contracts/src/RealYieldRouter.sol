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
 * @author Viraje Protocol Architecture Team
 * @notice Universal Fee Router enforcing Pure DeFi MiCA Compliance & Universal Multi-Asset Real Yield Basket:
 *         - Universal Fee Routing: Strict 50/50 split between Strategic Reserve (Treasury) and Community Real Yield.
 *         - Multi-Asset Yield Basket: 50.00% USDC, 25.00% WBTC, 12.50% WETH, 12.50% VIRAJE (minted at spot NAV).
 * @dev Employs SafeERC20 zero-reset hygiene on both normal and catch execution paths to eliminate dangling approvals.
 */
contract RealYieldRouter is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Canonical Basis Points Denominator (10,000 = 100.00%)
    uint256 public constant BPS_DENOMINATOR = 10000;

    /// @notice Pure DeFi Strategic Reserve Allocation (5,000 BPS = 50.00%)
    uint256 public constant STRATEGIC_RESERVE_SHARE_BPS = 5000;

    /// @notice Pure DeFi Community Real Yield Allocation (5,000 BPS = 50.00%)
    uint256 public constant COMMUNITY_YIELD_SHARE_BPS = 5000;

    /// @notice Basket WBTC Allocation (2,500 BPS = 25.00%)
    uint256 public constant BASKET_WBTC_BPS = 2500;

    /// @notice Basket WETH Allocation (1,250 BPS = 12.50%)
    uint256 public constant BASKET_WETH_BPS = 1250;

    /// @notice Basket VIRAJE Token Allocation (1,250 BPS = 12.50%)
    uint256 public constant BASKET_VIRAJE_BPS = 1250;

    /// @notice Maximum Permissible Slippage Tolerance (1,000 BPS = 10.00%)
    uint256 public constant MAX_SLIPPAGE_TOLERANCE_BPS = 1000;

    /// @notice Uniswap V3 Swap Deadline Buffer (15 minutes)
    uint256 public constant SWAP_DEADLINE_BUFFER = 15 minutes;

    /// @notice Decimal Conversion Multiplier from 6 decimals (USDC) to 18 decimals base (1e12)
    uint256 public constant USDC_TO_WAD_MULTIPLIER = 1e12;

    address public immutable stablecoin;
    address public immutable reserveAsset; // Backward-compatibility
    address public immutable swapRouter;
    GovernanceStaking public immutable stakingPool;

    address public treasuryBunker;
    address public communityYieldVault;
    address public circuitBreaker;

    address public oracleHub;
    uint256 public slippageToleranceBps = 100; // default 1.00%
    uint24 public reserveFeeTier = 3000; // 0.30% Uniswap v3 fee tier default

    address public wbtc;
    address public weth;
    address public virajeToken;

    enum PayoutPreference { BASKET, ALL_USDC }
    mapping(address => PayoutPreference) public userPayoutPreference;
    mapping(address => bool) public authorizedYieldCallers;

    // --- Events ---
    event UserPayoutPreferenceSet(address indexed user, PayoutPreference preference);
    event BasketAssetsUpdated(address indexed wbtc, address indexed weth, address indexed virajeToken);
    event RealYieldBasketClaimed(
        address indexed user,
        uint256 totalYieldUSD,
        uint256 usdcPaid,
        uint256 wbtcPaid,
        uint256 wethPaid,
        uint256 virajePaid
    );
    event UniversalFeeRouted(
        address indexed feeToken, uint256 totalAmount, uint256 toTreasury, uint256 toCommunityYieldUsdc
    );
    event ProtocolVaultsUpdated(address indexed treasuryBunker, address indexed communityYieldVault);
    event OracleConfigUpdated(address indexed oracleHub, uint256 slippageBps);
    event AuthorizedYieldCallerUpdated(address indexed caller, bool authorized);
    event ReserveFeeTierUpdated(uint24 oldTier, uint24 newTier);
    event CircuitBreakerUpdated(address indexed oldBreaker, address indexed newBreaker);
    event TokensSwept(address indexed token, address indexed to, uint256 amount);

    modifier onlyAuthorizedYield() {
        if (!authorizedYieldCallers[msg.sender] && !hasRole(ProtocolRoles.ADMIN_ROLE, msg.sender)) {
            revert IProtocolErrors.Unauthorized();
        }
        _;
    }

    /**
     * @notice Initializes the fee router with core asset addresses and staking pool
     * @param _stablecoin Canonical settlement stablecoin (USDC)
     * @param _reserveAsset Primary reserve asset (WBTC) for backward compatibility
     * @param _swapRouter Uniswap V3 SwapRouter address
     * @param _stakingPool GovernanceStaking contract address
     * @param _initialOwner Governance administrator
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
        if (_treasuryBunker == address(0) || _communityYieldVault == address(0)) {
            revert IProtocolErrors.ZeroAddress();
        }
        treasuryBunker = _treasuryBunker;
        communityYieldVault = _communityYieldVault;
        emit ProtocolVaultsUpdated(_treasuryBunker, _communityYieldVault);
    }

    /**
     * @notice Sets addresses of the multi-asset real yield payout basket
     * @param _wbtc WBTC token contract address
     * @param _weth WETH token contract address
     * @param _virajeToken VIRAJE token contract address
     */
    function setBasketAssets(address _wbtc, address _weth, address _virajeToken)
        external
        onlyRole(ProtocolRoles.ADMIN_ROLE)
    {
        if (_wbtc == address(0) || _weth == address(0) || _virajeToken == address(0)) {
            revert IProtocolErrors.ZeroAddress();
        }
        wbtc = _wbtc;
        weth = _weth;
        virajeToken = _virajeToken;
        emit BasketAssetsUpdated(_wbtc, _weth, _virajeToken);
    }

    /**
     * @notice Configures the circuit breaker contract
     * @param _circuitBreaker Address of CircuitBreaker contract
     */
    function setCircuitBreaker(address _circuitBreaker) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        address old = circuitBreaker;
        circuitBreaker = _circuitBreaker;
        emit CircuitBreakerUpdated(old, _circuitBreaker);
    }

    /**
     * @notice Configures Uniswap v3 fee tier for reserve swaps
     * @param _feeTier Fee tier (100 = 0.01%, 500 = 0.05%, 3000 = 0.30%, 10000 = 1.00%)
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
     * @param token Address of ERC20 token to sweep
     * @param to Destination address
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
     * @param caller Target contract address
     * @param authorized True to authorize, false to revoke
     */
    function setAuthorizedYieldCaller(address caller, bool authorized) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (caller == address(0)) revert IProtocolErrors.ZeroAddress();
        authorizedYieldCallers[caller] = authorized;
        emit AuthorizedYieldCallerUpdated(caller, authorized);
    }

    /**
     * @notice Configures the oracle hub and max slippage tolerance
     * @param _oracleHub OracleHub address
     * @param _slippageBps Slippage tolerance in BPS (max 1000 bps = 10.00%)
     */
    function setOracleConfig(address _oracleHub, uint256 _slippageBps) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_slippageBps > MAX_SLIPPAGE_TOLERANCE_BPS) revert IProtocolErrors.InvalidParameters();
        oracleHub = _oracleHub;
        slippageToleranceBps = _slippageBps;
        emit OracleConfigUpdated(_oracleHub, _slippageBps);
    }

    /**
     * @dev Checks if an asset is currently frozen by the Circuit Breaker
     */
    function _isAssetFrozen(address asset) internal view returns (bool) {
        if (circuitBreaker == address(0) || asset == address(0)) return false;
        try ICircuitBreakerRouter(circuitBreaker).isFrozen(asset) returns (bool frozen) {
            return frozen;
        } catch {
            return false;
        }
    }

    /**
     * @notice Allows users to set their preferred payout preference (Multi-asset Basket or 100% USDC)
     * @param preference BASKET (0) or ALL_USDC (1)
     */
    function setUserPayoutPreference(PayoutPreference preference) external {
        userPayoutPreference[msg.sender] = preference;
        emit UserPayoutPreferenceSet(msg.sender, preference);
    }

    /**
     * @notice Routes incoming fees according to 50 / 50 Liquid USDC Specification
     */
    function notifyYield(uint256 /* amount */) external onlyAuthorizedYield {
        routeUniversalFee(stablecoin);
    }

    /**
     * @notice Universal fee processing for ANY token collected as fee across modules
     * @dev Enforces 50/50 split between Strategic Reserve and Community Yield Vault
     * @param feeToken Address of the ERC20 token collected as fee
     */
    function routeUniversalFee(address feeToken) public nonReentrant onlyAuthorizedYield {
        uint256 bal = IERC20(feeToken).balanceOf(address(this));
        if (bal == 0) return;

        uint256 toTreasury = (treasuryBunker != address(0))
            ? (bal * STRATEGIC_RESERVE_SHARE_BPS) / BPS_DENOMINATOR
            : 0;
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
                    // Reset dangling approval before direct fallback safeTransfer
                    IERC20(feeToken).safeApprove(communityYieldVault, 0);
                    IERC20(feeToken).safeTransfer(communityYieldVault, communityShare);
                }
            } else if (address(stakingPool) != address(0) && feeToken == stablecoin) {
                IERC20(feeToken).safeApprove(address(stakingPool), 0);
                IERC20(feeToken).safeApprove(address(stakingPool), communityShare);
                try stakingPool.notifyRewardAmount(communityShare) {} catch {
                    // Reset dangling approval before direct fallback safeTransfer
                    IERC20(feeToken).safeApprove(address(stakingPool), 0);
                    IERC20(feeToken).safeTransfer(address(stakingPool), communityShare);
                }
            }

            emit UniversalFeeRouted(feeToken, bal, toTreasury, communityShare);
        }
    }

    /**
     * @dev Swaps stablecoin for target token via Uniswap V3 with Oracle slippage floor
     * @param tokenOut Address of token being purchased (WBTC or WETH)
     * @param tokenDecimalsMultiplier Scaling factor (1e8 for WBTC, 1e18 for WETH)
     * @param usdcAmount Amount of stablecoin in USDC (6 decimals) allocated to this swap
     * @return tokenBought Actual tokens bought and sent to msg.sender (0 if fallback triggered)
     * @return usdcFallback Amount of USDC to be added back to usdcPayout upon swap failure
     */
    function _executeSwap(
        address tokenOut,
        uint256 tokenDecimalsMultiplier,
        uint256 usdcAmount
    ) internal returns (uint256 tokenBought, uint256 usdcFallback) {
        if (tokenOut == address(0) || swapRouter == address(0) || _isAssetFrozen(tokenOut)) {
            return (0, usdcAmount);
        }

        uint256 minOut = 0;
        if (oracleHub != address(0)) {
            try IOracleHub(oracleHub).getPriceBase18(tokenOut) returns (uint256 price18) {
                if (price18 > 0) {
                    uint256 expected = (usdcAmount * USDC_TO_WAD_MULTIPLIER * tokenDecimalsMultiplier) / price18;
                    minOut = (expected * (BPS_DENOMINATOR - slippageToleranceBps)) / BPS_DENOMINATOR;
                }
            } catch {}
        }

        if (minOut == 0) {
            return (0, usdcAmount);
        }

        IERC20(stablecoin).safeApprove(swapRouter, 0);
        IERC20(stablecoin).safeApprove(swapRouter, usdcAmount);
        try ISwapRouter(swapRouter).exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: stablecoin,
                tokenOut: tokenOut,
                fee: reserveFeeTier,
                recipient: msg.sender,
                deadline: block.timestamp + SWAP_DEADLINE_BUFFER,
                amountIn: usdcAmount,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            })
        ) returns (uint256 bought) {
            return (bought, 0);
        } catch {
            // Reset dangling approval upon swap failure and return amount for USDC fallback payout
            IERC20(stablecoin).safeApprove(swapRouter, 0);
            return (0, usdcAmount);
        }
    }

    /**
     * @notice Universal Multi-Asset Real Yield Basket Claim (Exclusive & Mandatory):
     *         Distributes 100% of accumulated yield across the 4 portfolio pillars:
     *         - 50.00% in Liquid USDC
     *         - 25.00% in WBTC (swapped via Chainlink oracle pricing floor)
     *         - 12.50% in WETH (swapped via Chainlink oracle pricing floor)
     *         - 12.50% in VIRAJE (minted at current NAV directly into protocol reserves)
     * @return payoutAmount Total liquid USDC delivered to user (including fallback tranches)
     * @return wbtcPaid WBTC amount delivered to user
     * @return wethPaid WETH amount delivered to user
     * @return virajePaid VIRAJE shares delivered to user
     */
    function claimRealYield()
        external
        nonReentrant
        returns (uint256 payoutAmount, uint256 wbtcPaid, uint256 wethPaid, uint256 virajePaid)
    {
        uint256 yieldAmount = stakingPool.claimRewardFor(msg.sender);
        if (yieldAmount == 0) revert IProtocolErrors.ZeroAmount();

        if (userPayoutPreference[msg.sender] == PayoutPreference.ALL_USDC) {
            IERC20(stablecoin).safeTransfer(msg.sender, yieldAmount);
            emit RealYieldBasketClaimed(msg.sender, yieldAmount, yieldAmount, 0, 0, 0);
            return (yieldAmount, 0, 0, 0);
        }

        uint256 usdcShare = (yieldAmount * STRATEGIC_RESERVE_SHARE_BPS) / BPS_DENOMINATOR; // 50.00%
        uint256 wbtcShare = (yieldAmount * BASKET_WBTC_BPS) / BPS_DENOMINATOR;             // 25.00%
        uint256 wethShare = (yieldAmount * BASKET_WETH_BPS) / BPS_DENOMINATOR;             // 12.50%
        uint256 virajeShare = yieldAmount - usdcShare - wbtcShare - wethShare;             // 12.50% residual

        uint256 usdcPayout = usdcShare;

        // 1. WBTC Allocation (25.00%)
        uint256 wbtcFallback;
        (wbtcPaid, wbtcFallback) = _executeSwap(wbtc, 1e8, wbtcShare);
        usdcPayout += wbtcFallback;

        // 2. WETH Allocation (12.50%)
        uint256 wethFallback;
        (wethPaid, wethFallback) = _executeSwap(weth, 1e18, wethShare);
        usdcPayout += wethFallback;

        // 3. VIRAJE Allocation (12.50% at current NAV)
        if (treasuryBunker != address(0) && virajeToken != address(0)) {
            IERC20(stablecoin).safeApprove(treasuryBunker, 0);
            IERC20(stablecoin).safeApprove(treasuryBunker, virajeShare);
            try ITreasury(treasuryBunker).mintCorporateFeeShares(virajeShare) returns (uint256 mintedShares) {
                virajePaid = mintedShares;
                IERC20(virajeToken).safeTransfer(msg.sender, mintedShares);
            } catch {
                // Reset dangling approval and fallback to USDC
                IERC20(stablecoin).safeApprove(treasuryBunker, 0);
                usdcPayout += virajeShare;
            }
        } else {
            usdcPayout += virajeShare;
        }

        // 4. Transfer USDC (50% Base + any fallback)
        if (usdcPayout > 0) {
            IERC20(stablecoin).safeTransfer(msg.sender, usdcPayout);
        }

        payoutAmount = usdcPayout;

        emit RealYieldBasketClaimed(msg.sender, yieldAmount, usdcPayout, wbtcPaid, wethPaid, virajePaid);
    }
}
