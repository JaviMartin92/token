/* solhint-disable gas-struct-packing */
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./ProtocolRoles.sol";
import "./ProtocolAddressProvider.sol";
import "./lib/security/ReentrancyGuard.sol";
import "./interfaces/IProtocolErrors.sol";

interface IVirajeVaultBuyback {
    function transferFunds(address token, address to, uint256 amount) external;
    function getBalance(address token) external view returns (uint256);
}

interface IVirajeTokenBuyback {
    function burn(uint256 amount) external;
}

interface ITreasuryManagerBuyback {
    function getNAVPerShare() external view returns (uint256);
    function getProofOfReserves()
        external
        view
        returns (uint256 totalAssetsUSD, uint256 totalLiabilitiesUSD, uint256 collateralRatioBps);
    function recordBurn(uint256 amount) external;
}

interface IOracleHubBuyback {
    function getPriceBase18(address asset) external view returns (uint256);
}

interface ICircuitBreakerBuyback {
    function isFrozen(address asset) external view returns (bool);
}

interface ISwapRouterBuyback {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external returns (uint256 amountOut);
}

/**
 * @title DiscountBuybackEngine
 * @author Viraje Protocol Architecture Team
 * @notice Autonomous Algorithmic Market Stabilizer & Deflationary Buyback Engine.
 *         Executes discount buyback & burns when VIRAJE trades on DEX at a discount >= 5% vs NAV.
 *         Enforces 10 institutional safety locks to eliminate liquidity bleed, flash-loan manipulation,
 *         MEV sandwich attacks, and black swan vulnerability.
 * @custom:security-note 10 Institutional Safety Locks Matrix:
 *                       1. Minimum Discount: Buybacks require >= 5.00% discount vs Oracle NAV.
 *                       2. Daily Budget Cap: Max 2.50% of vault liquid reserves spent per 24 hours.
 *                       3. Immediate Burn: Purchased shares are burned immediately upon receipt.
 *                       4. Packed Storage: Control parameters are packed into a single 32-byte storage slot.
 *                       5. Strict Slippage: Hard execution bound (max 1.00% slippage vs Chainlink reference).
 *                       6. Cooldown Period: Mandatory 4-hour cooldown between successive buyback executions.
 *                       7. Reentrancy Protection: Protected with nonReentrant guard.
 *                       8. Circuit Breaker Check: Aborts if collateral asset is frozen by CircuitBreaker.
 *                       9. Solvency Guarantee: Reverts if Proof of Reserves collateral ratio < 100.00%.
 *                       10. Max Trade Impact: Single trade volume capped at 1.00% of vault liquid balance.
 */
contract DiscountBuybackEngine is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant SWAP_DEADLINE_BUFFER = 15 minutes;

    // Domain Specific Errors
    error DEXSwapFailed();
    error UninitializedProvider();

    ProtocolAddressProvider public immutable addressProvider;
    address public immutable redemptionToken; // USDC
    uint8 public immutable redemptionTokenDecimals; // 6

    address public swapRouter;

    // --- Gas Optimized Packed Storage Layout (Fits in 1 single 32-byte storage slot) ---
    uint32 public minDiscountBps = 500; // 5.00% minimum discount vs NAV
    uint32 public maxSlippageBps = 100; // 1.00% max allowable slippage (Candado 5)
    uint32 public maxDailyBudgetBps = 250; // 2.50% of liquid vault reserves per 24h
    uint32 public cooldownPeriod = 4 hours; // 14400 seconds (4 hours cooldown, Candado 6)
    uint32 public minPoRRatioBps = 10000; // 100.00% minimum collateral ratio
    uint32 public maxTradeImpactBps = 100; // 1.00% max of vault liquid balance per trade
    uint24 public poolFee = 3000; // 0.30% Uniswap v3 fee tier default
    uint16 public keeperBountyBps = 0; // 0.00% default Keeper incentive reward cap (max 50 Bps)
    bool public isPaused;

    // --- Dynamic State Variables (Separate slots) ---
    uint256 public spentToday;
    uint256 public lastBudgetResetTimestamp;
    uint256 public lastExecutionTimestamp;

    // --- Tracking Metrics ---
    uint256 public totalBuybackVolumeUSD;
    uint256 public totalVirajeBurned;

    // --- Events ---
    event DiscountBuybackExecuted(
        uint256 usdcSpent,
        uint256 virajeBurned,
        uint256 spotPriceUSD,
        uint256 navPerShareUSD,
        uint256 discountBps,
        uint256 timestamp
    );
    event ParametersUpdated(
        uint256 minDiscountBps,
        uint256 maxDailyBudgetBps,
        uint256 cooldownPeriod,
        uint256 minPoRRatioBps,
        uint256 maxTradeImpactBps
    );
    event MaxSlippageUpdated(uint32 oldSlippage, uint32 newSlippage);
    event SwapRouterUpdated(address oldRouter, address newRouter);
    event PoolFeeUpdated(uint24 oldFee, uint24 newFee);
    event KeeperBountyUpdated(uint16 oldBounty, uint16 newBounty);
    event TokensSwept(address indexed token, address indexed to, uint256 amount);
    event EnginePaused(bool isPaused);

    /**
     * @notice Initializes the buyback engine with immutable registries
     * @param _addressProvider Canonical protocol address provider
     * @param _redemptionToken Address of primary collateral stablecoin (USDC)
     * @param _redemptionTokenDecimals Decimals of collateral stablecoin (6)
     * @param _swapRouter Uniswap V3 swap router address
     * @param initialAdmin Protocol governance / timelock address
     */
    constructor(
        ProtocolAddressProvider _addressProvider,
        address _redemptionToken,
        uint8 _redemptionTokenDecimals,
        address _swapRouter,
        address initialAdmin
    ) {
        if (address(_addressProvider) == address(0)) revert UninitializedProvider();
        if (_redemptionToken == address(0) || initialAdmin == address(0)) revert IProtocolErrors.ZeroAddress();
        if (_redemptionTokenDecimals > 18) revert IProtocolErrors.InvalidParameters();

        addressProvider = _addressProvider;
        redemptionToken = _redemptionToken;
        redemptionTokenDecimals = _redemptionTokenDecimals;
        swapRouter = _swapRouter;

        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(ProtocolRoles.ADMIN_ROLE, initialAdmin);
        _grantRole(ProtocolRoles.KEEPER_ROLE, initialAdmin);

        lastBudgetResetTimestamp = block.timestamp;
    }

    // --- Administration ---

    /**
     * @notice Updates the Uniswap v3 SwapRouter address
     * @param _swapRouter New Uniswap V3 router address
     */
    function setSwapRouter(address _swapRouter) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_swapRouter == address(0)) revert IProtocolErrors.ZeroAddress();
        address old = swapRouter;
        swapRouter = _swapRouter;
        emit SwapRouterUpdated(old, _swapRouter);
    }

    /**
     * @notice Updates the core engine parameters under strict sanity constraints
     */
    function setParameters(
        uint256 _minDiscountBps,
        uint256 _maxDailyBudgetBps,
        uint256 _cooldownPeriod,
        uint256 _minPoRRatioBps,
        uint256 _maxTradeImpactBps
    ) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_minDiscountBps < 100 || _maxDailyBudgetBps > 1000 || _minPoRRatioBps < 10000 || _maxTradeImpactBps > 500) {
            revert IProtocolErrors.InvalidParameters();
        }

        minDiscountBps = uint32(_minDiscountBps);
        maxDailyBudgetBps = uint32(_maxDailyBudgetBps);
        cooldownPeriod = uint32(_cooldownPeriod);
        minPoRRatioBps = uint32(_minPoRRatioBps);
        maxTradeImpactBps = uint32(_maxTradeImpactBps);

        emit ParametersUpdated(
            _minDiscountBps, _maxDailyBudgetBps, _cooldownPeriod, _minPoRRatioBps, _maxTradeImpactBps
        );
    }

    /**
     * @notice Updates max allowable slippage tolerance (max 500 bps / 5%)
     */
    function setMaxSlippageBps(uint32 _maxSlippageBps) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_maxSlippageBps == 0 || _maxSlippageBps > 500) revert IProtocolErrors.InvalidParameters();
        uint32 old = maxSlippageBps;
        maxSlippageBps = _maxSlippageBps;
        emit MaxSlippageUpdated(old, _maxSlippageBps);
    }

    /**
     * @notice Pauses or unpauses buyback execution
     */
    function setPaused(bool _paused) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        isPaused = _paused;
        emit EnginePaused(_paused);
    }

    /**
     * @notice Configures Uniswap v3 fee tier for buyback swaps
     */
    function setPoolFee(uint24 _poolFee) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_poolFee != 100 && _poolFee != 500 && _poolFee != 3000 && _poolFee != 10000) {
            revert IProtocolErrors.InvalidParameters();
        }
        uint24 old = poolFee;
        poolFee = _poolFee;
        emit PoolFeeUpdated(old, _poolFee);
    }

    /**
     * @notice Sets keeper bounty reward in basis points (capped at 50 bps / 0.50%)
     */
    function setKeeperBountyBps(uint16 _bountyBps) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (_bountyBps > 50) revert IProtocolErrors.InvalidParameters();
        uint16 old = keeperBountyBps;
        keeperBountyBps = _bountyBps;
        emit KeeperBountyUpdated(old, _bountyBps);
    }

    /**
     * @notice Sweeps accidentally sent tokens
     */
    function sweepTokens(address token, address to) external onlyRole(ProtocolRoles.ADMIN_ROLE) {
        if (token == address(0) || to == address(0)) revert IProtocolErrors.ZeroAddress();
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal == 0) revert IProtocolErrors.InvalidAmount();
        IERC20(token).safeTransfer(to, bal);
        emit TokensSwept(token, to, bal);
    }

    function _validateSystemHealth(address treasuryManager) internal view {
        // --- LOCK 6: Cooldown Period (Rate Limiting) ---
        if (lastExecutionTimestamp > 0 && block.timestamp < lastExecutionTimestamp + cooldownPeriod) {
            revert IProtocolErrors.CooldownActive(lastExecutionTimestamp + cooldownPeriod);
        }

        // --- LOCK 8: CircuitBreaker Check ---
        address circuitBreaker = addressProvider.getCircuitBreaker();
        if (circuitBreaker != address(0) && ICircuitBreakerBuyback(circuitBreaker).isFrozen(redemptionToken)) {
            revert IProtocolErrors.CircuitBreakerActive(redemptionToken);
        }

        // --- LOCK 9: Superior Solvency Invariant (PoR >= minPoRRatioBps) ---
        (,, uint256 collateralRatioBps) = ITreasuryManagerBuyback(treasuryManager).getProofOfReserves();
        if (collateralRatioBps < minPoRRatioBps) {
            revert IProtocolErrors.Undercollateralized(collateralRatioBps, minPoRRatioBps);
        }
    }

    function _validateDiscountAndPrice(address treasuryManager, address oracleHub, address virajeToken)
        internal
        view
        returns (uint256 navPerShareUSD, uint256 spotPriceUSD, uint256 discountBps)
    {
        // --- LOCK 1 & LOCK 5: Minimum Discount Threshold (5%) via TWAP / Oracle ---
        navPerShareUSD = ITreasuryManagerBuyback(treasuryManager).getNAVPerShare();
        spotPriceUSD = IOracleHubBuyback(oracleHub).getPriceBase18(virajeToken);
        if (spotPriceUSD == 0) revert IProtocolErrors.InvalidPrice();
        if (spotPriceUSD >= navPerShareUSD) revert IProtocolErrors.NoDiscountVsNAV();

        discountBps = ((navPerShareUSD - spotPriceUSD) * BPS_DENOMINATOR) / navPerShareUSD;
        if (discountBps < minDiscountBps) {
            revert IProtocolErrors.DiscountTooLow(discountBps, minDiscountBps);
        }
    }

    function _validateBudgetAndLimits(address virajeVault, uint256 usdcToSpend) internal {
        // --- LOCK 2 & LOCK 10: Daily Budget Cap & Max Trade Impact Size ---
        if (block.timestamp >= lastBudgetResetTimestamp + 1 days) {
            spentToday = 0;
            lastBudgetResetTimestamp = block.timestamp;
        }

        uint256 liquidVaultBalance = IVirajeVaultBuyback(virajeVault).getBalance(redemptionToken);
        if (liquidVaultBalance == 0) revert IProtocolErrors.InvalidAmount();

        uint256 maxDailyBudget = (liquidVaultBalance * maxDailyBudgetBps) / BPS_DENOMINATOR;
        if (spentToday + usdcToSpend > maxDailyBudget) {
            revert IProtocolErrors.DailyBudgetExceeded(spentToday + usdcToSpend, maxDailyBudget);
        }

        uint256 maxSingleTrade = (liquidVaultBalance * maxTradeImpactBps) / BPS_DENOMINATOR;
        if (usdcToSpend > maxSingleTrade) {
            revert IProtocolErrors.TradeSizeTooLarge(usdcToSpend, maxSingleTrade);
        }
    }

    function _executeSwap(address virajeVault, address virajeToken, uint256 usdcToSpend, uint256 minVirajeOut)
        internal
        returns (uint256 virajeReceived)
    {
        if (swapRouter == address(0)) revert IProtocolErrors.ZeroAddress();

        IVirajeVaultBuyback(virajeVault).transferFunds(redemptionToken, address(this), usdcToSpend);

        IERC20(redemptionToken).safeApprove(swapRouter, 0);
        IERC20(redemptionToken).safeApprove(swapRouter, usdcToSpend);
        try ISwapRouterBuyback(swapRouter)
            .exactInputSingle(
                ISwapRouterBuyback.ExactInputSingleParams({
                tokenIn: redemptionToken,
                tokenOut: virajeToken,
                fee: poolFee,
                recipient: address(this),
                deadline: block.timestamp + SWAP_DEADLINE_BUFFER,
                amountIn: usdcToSpend,
                amountOutMinimum: minVirajeOut,
                sqrtPriceLimitX96: 0
            })
            ) returns (
            uint256 amountOut
        ) {
            virajeReceived = amountOut;
        } catch {
            revert DEXSwapFailed();
        }

        if (virajeReceived < minVirajeOut) {
            revert IProtocolErrors.SlippageExceeded(minVirajeOut, virajeReceived);
        }
    }

    /**
     * @notice Executes algorithmic discount buyback & immediate cryptographic burn.
     *         Enforces all 10 institutional safety locks.
     * @param usdcToSpend Amount of USDC to withdraw from VirajeVault for buyback.
     * @param minVirajeOut Minimum VIRAJE tokens expected from the DEX.
     */
    function executeDiscountBuyback(uint256 usdcToSpend, uint256 minVirajeOut)
        external
        nonReentrant
        onlyRole(ProtocolRoles.KEEPER_ROLE)
        returns (uint256 virajeBurned)
    {
        if (isPaused) revert IProtocolErrors.ProtocolPaused();
        if (usdcToSpend == 0) revert IProtocolErrors.ZeroAmount();

        address treasuryManager = addressProvider.getTreasuryManager();
        address virajeVault = addressProvider.getVirajeVault();
        address virajeToken = addressProvider.getVirajeToken();
        address oracleHub = addressProvider.getOracleHub();

        if (
            treasuryManager == address(0) || virajeVault == address(0) || virajeToken == address(0)
                || oracleHub == address(0)
        ) {
            revert UninitializedProvider();
        }

        _validateSystemHealth(treasuryManager);

        (uint256 navPerShareUSD, uint256 spotPriceUSD, uint256 discountBps) =
            _validateDiscountAndPrice(treasuryManager, oracleHub, virajeToken);

        _validateBudgetAndLimits(virajeVault, usdcToSpend);

        minVirajeOut = _calculateMinViraje(usdcToSpend, spotPriceUSD, minVirajeOut);

        // --- EXECUTION: Pull Funds from Vault, Swap & Burn ---
        uint256 virajeReceived = _executeSwap(virajeVault, virajeToken, usdcToSpend, minVirajeOut);

        // --- LOCK 3: Immediate Cryptographic Burn ---
        IVirajeTokenBuyback(virajeToken).burn(virajeReceived);
        try ITreasuryManagerBuyback(treasuryManager).recordBurn(virajeReceived) {
            // Burn recorded successfully in treasury
        } catch {
            // Ignore notification revert if treasury does not track manual recordBurn
        }

        // --- KEEPER BOUNTY INCENTIVE ---
        uint256 totalOutflow = _payKeeperBounty(virajeVault, usdcToSpend);

        // --- State Updates ---
        spentToday += totalOutflow;
        lastExecutionTimestamp = block.timestamp;
        totalBuybackVolumeUSD += usdcToSpend;
        totalVirajeBurned += virajeReceived;

        emit DiscountBuybackExecuted(
            usdcToSpend, virajeReceived, spotPriceUSD, navPerShareUSD, discountBps, block.timestamp
        );
        return virajeReceived;
    }

    function _calculateMinViraje(uint256 usdcToSpend, uint256 spotPriceUSD, uint256 minVirajeOut) private view returns (uint256) {
        uint256 expectedVirajeFromOracle = (usdcToSpend * (10 ** (18 - redemptionTokenDecimals)) * 1e18) / spotPriceUSD;
        uint256 minAllowedViraje = (expectedVirajeFromOracle * (BPS_DENOMINATOR - maxSlippageBps)) / BPS_DENOMINATOR;
        return (minVirajeOut < minAllowedViraje) ? minAllowedViraje : minVirajeOut;
    }

    function _payKeeperBounty(address virajeVault, uint256 usdcToSpend) private returns (uint256 totalOutflow) {
        totalOutflow = usdcToSpend;
        if (keeperBountyBps > 0) {
            uint256 bounty = (usdcToSpend * keeperBountyBps) / BPS_DENOMINATOR;
            if (bounty > 0) {
                try IVirajeVaultBuyback(virajeVault).transferFunds(redemptionToken, msg.sender, bounty) {
                    totalOutflow += bounty;
                } catch {}
            }
        }
    }
}
