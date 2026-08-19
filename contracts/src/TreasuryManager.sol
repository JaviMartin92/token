// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./lib/security/ReentrancyGuard.sol";
import "./ProtocolAddressProvider.sol";
import "./ProtocolRoles.sol";
import "./AlphaVault.sol";
import "./AlphaToken.sol";
import "./OracleHub.sol";

import "./lib/TreasuryFeeLib.sol";
import "./lib/TreasuryPoRLib.sol";
import "./lib/TreasuryLiquidityLib.sol";
import "./lib/TreasuryRebalanceLib.sol";

import "./interfaces/IRealYieldRouter.sol";
import "./interfaces/IUniversalYieldAdapter.sol";

/**
 * @title TreasuryManager
 * @notice Central orchestrator for deposits, redemptions, NAV accounting, and Proof of Reserves.
 *         Delegates custody to AlphaVault, token minting to AlphaToken, pricing to OracleHub,
 *         and specialized accounting/rebalancing logic to internal Solidity libraries.
 */
contract TreasuryManager is Initializable, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Custom Errors for Gas Optimization and Bytecode Efficiency (Morpho Standard)
    error KYCRequired(address account);
    error SameBlockCooldown(address account, uint256 currentBlock);
    error SlippageExceeded(uint256 expectedMin, uint256 actual);
    error InvariantNAVDecreased(uint256 preNav, uint256 postNav);
    error InvariantSolvencyDecreased(uint256 preRatio, uint256 postRatio);
    error Undercollateralized(uint256 ratioBps);
    error ZeroAmount();
    error TVLCapExceeded(uint256 attempted, uint256 cap);
    error InvalidWeightsSum(uint256 sum);
    error ZeroAddressProvider();
    error InvalidAdapterAddress();
    error AdapterAlreadyActive();
    error AdapterNotActive();
    error InsufficientLiquidBuffer();
    error AccountIsWhitelisted();
    error InsufficientShareBalance();
    error ZeroNetCirculatingShares();
    error OnlyRealYieldRouter();
    error TransferFromFailed();
    error UnauthorizedDisburseLoans();
    error UnauthorizedVaultPayout();
    error InsufficientLiquidity();

    ProtocolAddressProvider public immutable addressProvider;

    // Gas Optimized: Packed into a single 32-byte storage slot (4 * 64 = 256 bits)
    struct AssetWeights {
        uint64 stablecoins;
        uint64 wbtc;
        uint64 weth;
        uint64 alphaProtocolStaking;
    }
    AssetWeights public currentWeights;

    address public redemptionToken;
    uint8 public redemptionTokenDecimals;
    uint256 public tvlCap;
    uint256 public totalBurnedTokens;
    uint256 public slippageToleranceBps;

    address[] public activeYieldAdapters;

    mapping(address => uint256) public lastDepositBlock;

    // Compliance (B-04)
    mapping(address => bool) public kycWhitelist;

    event WhitelistUpdated(address indexed account, bool isWhitelisted);

    modifier onlyWhitelisted(address account) {
        if (!kycWhitelist[account]) revert KYCRequired(account);
        _;
    }

    // Direct tracked assets for routing
    address public wbtcToken;
    address public wethToken;
    address public swapRouter;

    uint256 public lastSettledNAVPerShare = 1e18;

    event Deposited(address indexed user, uint256 usdcAmount, uint256 sharesMinted);
    event Redeemed(address indexed user, uint256 sharesAmount, uint256 usdcReturned);
    event SwapRebalanceFailed(address indexed tokenOut, uint256 amountIn);
    event AssetWeightsUpdated(uint256 stablecoins, uint256 wbtc, uint256 weth, uint256 alpha);
    event ProofOfReservesAudited(
        uint256 totalAssetsUSD, uint256 totalLiabilitiesUSD, uint256 collateralRatioBps, uint256 timestamp
    );
    event Rebalanced(uint256 timestamp);

    constructor(ProtocolAddressProvider _addressProvider) {
        if (address(_addressProvider) == address(0)) revert ZeroAddressProvider();
        addressProvider = _addressProvider;
        _disableInitializers();
    }

    function initialize(address _initialAdmin, address _redemptionToken, uint8 _redemptionTokenDecimals)
        public
        initializer
    {
        _ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _initialAdmin);
        _grantRole(ProtocolRoles.ADMIN_ROLE, _initialAdmin);
        _grantRole(ProtocolRoles.VAULT_MANAGER_ROLE, _initialAdmin);

        redemptionToken = _redemptionToken;
        redemptionTokenDecimals = _redemptionTokenDecimals;
        tvlCap = 50_000_000 * (10 ** _redemptionTokenDecimals);
        slippageToleranceBps = 100; // 1% default

        currentWeights = AssetWeights({stablecoins: 5000, wbtc: 2500, weth: 1250, alphaProtocolStaking: 1250});
    }

    function setConfig(address _wbtc, address _weth, address _swapRouter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        wbtcToken = _wbtc;
        wethToken = _weth;
        swapRouter = _swapRouter;
    }

    function setSwapRouter(address _swapRouter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        swapRouter = _swapRouter;
    }

    // --- Compliance Functions ---
    function setKYCStatus(address account, bool status) external onlyRole(ProtocolRoles.COMPLIANCE_ROLE) {
        kycWhitelist[account] = status;
        emit WhitelistUpdated(account, status);
    }

    function addYieldAdapter(address adapter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (adapter == address(0)) revert InvalidAdapterAddress();
        uint256 len = activeYieldAdapters.length;
        for (uint256 i = 0; i < len;) {
            if (activeYieldAdapters[i] == adapter) revert AdapterAlreadyActive();
            unchecked {
                ++i;
            }
        }
        activeYieldAdapters.push(adapter);
    }

    function removeYieldAdapter(address adapter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 len = activeYieldAdapters.length;
        for (uint256 i = 0; i < len;) {
            if (activeYieldAdapters[i] == adapter) {
                activeYieldAdapters[i] = activeYieldAdapters[len - 1];
                activeYieldAdapters.pop();
                break;
            }
            unchecked {
                ++i;
            }
        }
    }

    function setAssetWeights(uint256 _stables, uint256 _wbtc, uint256 _weth, uint256 _alpha)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (_stables + _wbtc + _weth + _alpha != 10000) {
            revert InvalidWeightsSum(_stables + _wbtc + _weth + _alpha);
        }
        currentWeights = AssetWeights({
            stablecoins: uint64(_stables),
            wbtc: uint64(_wbtc),
            weth: uint64(_weth),
            alphaProtocolStaking: uint64(_alpha)
        });
        emit AssetWeightsUpdated(_stables, _wbtc, _weth, _alpha);
    }

    function setTvlCap(uint256 newCap) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newCap == 0) revert ZeroAmount();
        tvlCap = newCap;
    }

    function recordBurn(uint256 amount) external onlyRole(ProtocolRoles.BURNER_ROLE) {
        totalBurnedTokens += amount;
    }

    function notifyReserveFee(uint256 usdcFeeAmount) external onlyRole(ProtocolRoles.VAULT_MANAGER_ROLE) {
        address vault = addressProvider.getAlphaVault();
        if (vault != address(0) && usdcFeeAmount > 0) {
            uint256 bal = IERC20(redemptionToken).balanceOf(address(this));
            uint256 toTransfer = usdcFeeAmount > bal ? bal : usdcFeeAmount;
            if (toTransfer > 0) {
                IERC20(redemptionToken).safeTransfer(vault, toTransfer);
            }
        }
    }

    // --- Proof of Reserves & NAV (Delegated to TreasuryPoRLib) ---
    function getTotalNavUSD() public view returns (uint256) {
        (uint256 assets,,) = getProofOfReserves();
        return assets;
    }

    function getNAV() external view returns (uint256) {
        return getTotalNavUSD();
    }

    function getNAVPerShare() public view returns (uint256) {
        uint256 totalAssetsUSD = getTotalNavUSD();
        uint256 circulatingShares = getNetCirculatingShares();
        if (circulatingShares == 0) return 1e18;
        return Math.mulDiv(totalAssetsUSD, 1e18, circulatingShares, Math.Rounding.Floor);
    }

    struct ProtocolOverview {
        uint256 totalAssetsUSD;
        uint256 totalLiabilitiesUSD;
        uint256 collateralRatioBps;
        uint256 navPerShareUSD;
        uint256 netCirculatingShares;
        uint256 totalBurnedTokens;
    }

    function getProtocolOverview() external view returns (ProtocolOverview memory overview) {
        (overview.totalAssetsUSD, overview.totalLiabilitiesUSD, overview.collateralRatioBps) = getProofOfReserves();
        overview.navPerShareUSD = getNAVPerShare();
        overview.netCirculatingShares = getNetCirculatingShares();
        overview.totalBurnedTokens = totalBurnedTokens;
    }

    function getProofOfReserves()
        public
        view
        returns (uint256 totalAssetsUSD, uint256 totalLiabilitiesUSD, uint256 collateralRatioBps)
    {
        return TreasuryPoRLib.getProofOfReserves(
            TreasuryPoRLib.PoRContext({
                addressProvider: addressProvider,
                redemptionToken: redemptionToken,
                redemptionTokenDecimals: redemptionTokenDecimals,
                lastSettledNAVPerShare: lastSettledNAVPerShare,
                treasuryManagerContract: address(this)
            }),
            activeYieldAdapters
        );
    }

    function auditProofOfReserves()
        external
        returns (uint256 totalAssetsUSD, uint256 totalLiabilitiesUSD, uint256 collateralRatioBps)
    {
        (totalAssetsUSD, totalLiabilitiesUSD, collateralRatioBps) = getProofOfReserves();
        emit ProofOfReservesAudited(totalAssetsUSD, totalLiabilitiesUSD, collateralRatioBps, block.timestamp);
    }

    function getNetCirculatingShares() public view returns (uint256) {
        return TreasuryPoRLib.getNetCirculatingShares(addressProvider, address(this));
    }

    function getTotalAssetsExogenousUSD() public view returns (uint256) {
        (uint256 assetsUSD,,) = getProofOfReserves();
        return assetsUSD;
    }

    function getAssetBreakdown()
        external
        view
        returns (uint256 stablesUsd, uint256 wbtcUsd, uint256 wethUsd, uint256 loansUsd)
    {
        return TreasuryPoRLib.getAssetBreakdown(
            TreasuryPoRLib.AssetBreakdownParams({
                addressProvider: addressProvider,
                redemptionToken: redemptionToken,
                redemptionTokenDecimals: redemptionTokenDecimals,
                wbtcToken: wbtcToken,
                wethToken: wethToken,
                treasuryManagerContract: address(this)
            }),
            activeYieldAdapters
        );
    }

    function calculateDynamicFeeBps(uint256 grossDepositUSD, uint256 totalAssetsExogenousUSD)
        public
        pure
        returns (uint256)
    {
        return TreasuryFeeLib.calculateDynamicFeeBps(grossDepositUSD, totalAssetsExogenousUSD);
    }

    // --- Core Operations ---
    struct DepositResult {
        uint256 actualDeposited;
        uint256 feeAmount;
        uint256 netDeposited;
        uint256 sharesMinted;
    }

    function _processDeposit(
        uint256 stableAmount,
        uint256 totalAssetsExogenous,
        uint256 preNavUSD,
        address routerAddr,
        AlphaVault vault
    ) internal returns (DepositResult memory res) {
        uint256 balanceBefore = vault.getBalance(redemptionToken);
        IERC20(redemptionToken).safeTransferFrom(msg.sender, address(vault), stableAmount);
        res.actualDeposited = vault.getBalance(redemptionToken) - balanceBefore;
        if (res.actualDeposited == 0) revert ZeroAmount();

        uint256 grossDepositUSD = res.actualDeposited * (10 ** (18 - redemptionTokenDecimals));
        uint256 dynamicFeeBps =
            (msg.sender == routerAddr) ? 0 : calculateDynamicFeeBps(grossDepositUSD, totalAssetsExogenous);

        res.feeAmount = Math.mulDiv(res.actualDeposited, dynamicFeeBps, 10000, Math.Rounding.Ceil);
        res.netDeposited = res.actualDeposited - res.feeAmount;
        uint256 depositValueUSD = res.netDeposited * (10 ** (18 - redemptionTokenDecimals));

        if (preNavUSD == 0 || totalAssetsExogenous == 0) {
            res.sharesMinted = depositValueUSD;
        } else {
            res.sharesMinted = Math.mulDiv(depositValueUSD, 1e18, preNavUSD, Math.Rounding.Floor);
        }
    }

    /**
     * @notice Mints Alpha Shares in exchange for deposited USDC. Routes funds to Yield Adapters and P2P Buffers.
     * @param stableAmount The amount of stablecoin (USDC) to deposit.
     * @param minSharesOut Minimum shares expected to receive (slippage protection).
     * @return sharesMinted The amount of Alpha shares minted to the user.
     */
    function deposit(uint256 stableAmount, uint256 minSharesOut) public nonReentrant returns (uint256 sharesMinted) {
        if (stableAmount == 0) revert ZeroAmount();
        lastDepositBlock[msg.sender] = block.number;

        (uint256 preAssetsUSD,, uint256 preRatioBps) = getProofOfReserves();
        uint256 netCirculating = getNetCirculatingShares();
        uint256 preNavUSD =
            (netCirculating == 0) ? 1e18 : Math.mulDiv(preAssetsUSD, 1e18, netCirculating, Math.Rounding.Floor);

        AlphaVault vault = AlphaVault(addressProvider.getAddress(addressProvider.ID_ALPHA_VAULT()));
        address routerAddr = addressProvider.getAddress(addressProvider.ID_REAL_YIELD_ROUTER());

        DepositResult memory res = _processDeposit(stableAmount, preAssetsUSD, preNavUSD, routerAddr, vault);
        sharesMinted = res.sharesMinted;

        AlphaToken token = AlphaToken(addressProvider.getAddress(addressProvider.ID_ALPHA_TOKEN()));
        token.mint(msg.sender, sharesMinted);

        if (res.feeAmount > 0 && routerAddr != address(0)) {
            vault.transferFunds(redemptionToken, routerAddr, res.feeAmount);
            IRealYieldRouter(routerAddr).routeUniversalFee(redemptionToken);
        }

        if (res.netDeposited > 0) {
            TreasuryRebalanceLib.executeRebalanceSwaps(
                TreasuryRebalanceLib.RebalanceParams({
                    addressProvider: addressProvider,
                    vault: vault,
                    token: token,
                    swapRouter: swapRouter,
                    wbtcToken: wbtcToken,
                    wethToken: wethToken,
                    redemptionToken: redemptionToken,
                    redemptionTokenDecimals: redemptionTokenDecimals,
                    slippageToleranceBps: slippageToleranceBps,
                    stableWeight: currentWeights.stablecoins,
                    wbtcWeight: currentWeights.wbtc,
                    wethWeight: currentWeights.weth,
                    alphaWeight: currentWeights.alphaProtocolStaking,
                    netDeposited: res.netDeposited,
                    totalNavUSD: preAssetsUSD + (res.netDeposited * (10 ** (18 - redemptionTokenDecimals))),
                    treasuryContract: address(this)
                })
            );
        }

        uint256 postNavUSD = getNAVPerShare();
        if (postNavUSD < preNavUSD) revert InvariantNAVDecreased(preNavUSD, postNavUSD);

        (,, uint256 postRatioBps) = getProofOfReserves();
        if (postRatioBps < preRatioBps) revert InvariantSolvencyDecreased(preRatioBps, postRatioBps);
        if (sharesMinted < minSharesOut) revert SlippageExceeded(minSharesOut, sharesMinted);

        lastSettledNAVPerShare = postNavUSD;

        emit Deposited(msg.sender, res.actualDeposited, sharesMinted);
    }

    /**
     * @notice Atomic permit + deposit in a single transaction (EIP-2612).
     */
    function depositWithPermit(
        uint256 stableAmount,
        uint256 minSharesOut,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256 sharesMinted) {
        try IERC20Permit(redemptionToken).permit(msg.sender, address(this), stableAmount, deadline, v, r, s) {
            // Permit executed successfully
        } catch {
            // Fallback: Proceed if approval was granted via standard approve()
        }
        return deposit(stableAmount, minSharesOut);
    }

    /**
     * @notice Moves idle USDC from the AlphaVault into a registered Yield Adapter.
     */
    function depositToYieldAdapter(address adapter, uint256 amount)
        external
        onlyRole(ProtocolRoles.VAULT_MANAGER_ROLE)
        nonReentrant
    {
        if (amount == 0) revert ZeroAmount();

        bool isActive = false;
        uint256 len = activeYieldAdapters.length;
        for (uint256 i = 0; i < len;) {
            if (activeYieldAdapters[i] == adapter) {
                isActive = true;
                break;
            }
            unchecked {
                ++i;
            }
        }
        if (!isActive) revert AdapterNotActive();

        AlphaVault vault = AlphaVault(addressProvider.getAlphaVault());
        if (vault.getBalance(redemptionToken) < amount) revert InsufficientLiquidBuffer();

        vault.transferFunds(redemptionToken, address(this), amount);
        IERC20(redemptionToken).approve(adapter, amount);
        IUniversalYieldAdapter(adapter).deposit(amount, address(vault));
    }

    /**
     * @notice Burns Alpha Shares in exchange for USDC from the Treasury.
     * @param sharesAmount The amount of Alpha shares to burn.
     * @param minUsdcOut Minimum USDC expected to receive (slippage protection).
     * @return assetsReceived The amount of USDC transferred to the user, net of fees.
     */
    function redeem(uint256 sharesAmount, uint256 minUsdcOut) external nonReentrant returns (uint256 assetsReceived) {
        if (sharesAmount == 0) revert ZeroAmount();
        if (lastDepositBlock[msg.sender] >= block.number) revert SameBlockCooldown(msg.sender, block.number);

        (uint256 preAssetsUSD,, uint256 preRatioBps) = getProofOfReserves();
        uint256 netCirculating = getNetCirculatingShares();
        uint256 preNavUSD =
            (netCirculating == 0) ? 1e18 : Math.mulDiv(preAssetsUSD, 1e18, netCirculating, Math.Rounding.Floor);

        TreasuryFeeLib.RedeemCalculation memory calc =
            TreasuryFeeLib.calculateRedemption(sharesAmount, preAssetsUSD, netCirculating, redemptionTokenDecimals);
        assetsReceived = calc.assetsReceived;
        if (assetsReceived == 0) revert ZeroAmount();

        AlphaVault vault = AlphaVault(addressProvider.getAddress(addressProvider.ID_ALPHA_VAULT()));
        TreasuryLiquidityLib.ensureLiquidBuffer(
            vault, redemptionToken, activeYieldAdapters, assetsReceived, address(this)
        );

        AlphaToken(addressProvider.getAddress(addressProvider.ID_ALPHA_TOKEN())).burnFrom(msg.sender, sharesAmount);
        totalBurnedTokens += sharesAmount;
        vault.transferFunds(redemptionToken, msg.sender, assetsReceived);

        // Fee Distribution
        address routerAddr = addressProvider.getAddress(addressProvider.ID_REAL_YIELD_ROUTER());
        if (calc.feeTokenAmount > 0 && routerAddr != address(0)) {
            vault.transferFunds(redemptionToken, routerAddr, calc.feeTokenAmount);
            IRealYieldRouter(routerAddr).routeUniversalFee(redemptionToken);
        }

        (,, uint256 postRatioBps) = getProofOfReserves();
        if (postRatioBps < preRatioBps) revert InvariantSolvencyDecreased(preRatioBps, postRatioBps);
        uint256 postNav = getNAVPerShare();
        if (postNav < preNavUSD) revert InvariantNAVDecreased(preNavUSD, postNav);
        if (assetsReceived < minUsdcOut) revert SlippageExceeded(minUsdcOut, assetsReceived);

        lastSettledNAVPerShare = postNav;

        emit Redeemed(msg.sender, sharesAmount, assetsReceived);
    }

    function _updateLastSettledNAV() internal {
        try this.getNAVPerShare() returns (uint256 nav) {
            if (nav > 0) {
                lastSettledNAVPerShare = nav;
            }
        } catch {
            // Keep previous settled NAV on transient query revert
        }
    }

    /**
     * @notice Emergency redemption for accounts whose KYC whitelist status was revoked.
     *         Applies a 5.0% retention fee synchronously routed to RealYieldRouter to prevent arbitrage.
     * @param sharesAmount The amount of Alpha shares to redeem.
     * @param minUsdcOut Minimum USDC to receive, guarding against NAV slippage.
     * @return assetsReceived Net USDC returned to the user.
     */
    function emergencyRedeem(uint256 sharesAmount, uint256 minUsdcOut)
        external
        nonReentrant
        returns (uint256 assetsReceived)
    {
        if (kycWhitelist[msg.sender]) revert AccountIsWhitelisted();
        if (sharesAmount == 0) revert ZeroAmount();

        AlphaToken token = AlphaToken(addressProvider.getAlphaToken());
        if (token.balanceOf(msg.sender) < sharesAmount) revert InsufficientShareBalance();

        (uint256 totalAssetsUSD,,) = getProofOfReserves();
        uint256 netCirculating = getNetCirculatingShares();
        if (netCirculating == 0) revert ZeroNetCirculatingShares();

        uint256 grossUsdValue = Math.mulDiv(sharesAmount, totalAssetsUSD, netCirculating, Math.Rounding.Floor);

        // 5.0% Emergency retention fee calculated via TreasuryFeeLib
        uint256 emergencyFeeUsd = TreasuryFeeLib.calculateEmergencyFee(grossUsdValue);
        uint256 netUsdValue = grossUsdValue - emergencyFeeUsd;

        uint256 scaleFactor = 10 ** (18 - redemptionTokenDecimals);
        assetsReceived = netUsdValue / scaleFactor;
        uint256 feeTokenAmount = emergencyFeeUsd / scaleFactor;

        if (assetsReceived == 0) revert ZeroAmount();

        AlphaVault vault = AlphaVault(addressProvider.getAlphaVault());
        TreasuryLiquidityLib.ensureLiquidBuffer(
            vault, redemptionToken, activeYieldAdapters, assetsReceived + feeTokenAmount, address(this)
        );

        token.burnFrom(msg.sender, sharesAmount);
        totalBurnedTokens += sharesAmount;
        vault.transferFunds(redemptionToken, msg.sender, assetsReceived);

        address routerAddr = addressProvider.getRealYieldRouter();
        if (routerAddr != address(0) && feeTokenAmount > 0) {
            vault.transferFunds(redemptionToken, routerAddr, feeTokenAmount);
            try IRealYieldRouter(routerAddr).routeUniversalFee(redemptionToken) {
                // Fee routed successfully
            } catch {
                // Ignore transient yield routing failure during emergency exit
            }
        }

        if (assetsReceived < minUsdcOut) revert SlippageExceeded(minUsdcOut, assetsReceived);
        _updateLastSettledNAV();

        emit Redeemed(msg.sender, sharesAmount, assetsReceived);
        return assetsReceived;
    }

    function mintCorporateFeeShares(uint256 stableAmount) external returns (uint256 sharesMinted) {
        if (msg.sender != addressProvider.getAddress(addressProvider.ID_REAL_YIELD_ROUTER())) {
            revert OnlyRealYieldRouter();
        }
        if (stableAmount == 0) revert ZeroAmount();

        AlphaVault vault = AlphaVault(addressProvider.getAddress(addressProvider.ID_ALPHA_VAULT()));
        if (!IERC20(redemptionToken).transferFrom(msg.sender, address(vault), stableAmount)) {
            revert TransferFromFailed();
        }

        uint256 depositValueUSD = stableAmount * (10 ** (18 - redemptionTokenDecimals));
        uint256 navBefore = getTotalNavUSD();
        AlphaToken token = AlphaToken(addressProvider.getAddress(addressProvider.ID_ALPHA_TOKEN()));
        uint256 currentShares = token.totalSupply();

        if (currentShares == 0 || navBefore == 0) {
            sharesMinted = depositValueUSD;
        } else {
            sharesMinted = Math.mulDiv(depositValueUSD, currentShares, navBefore, Math.Rounding.Floor);
        }

        token.mint(msg.sender, sharesMinted);
        return sharesMinted;
    }

    function disburseTreasuryLoan(address recipient, uint256 amount) external nonReentrant {
        if (
            msg.sender != addressProvider.getAddress(addressProvider.ID_P2P_MARKET())
                && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)
        ) {
            revert UnauthorizedDisburseLoans();
        }
        if (amount == 0) revert ZeroAmount();

        AlphaVault vault = AlphaVault(addressProvider.getAddress(addressProvider.ID_ALPHA_VAULT()));

        uint256 available = vault.getBalance(redemptionToken);
        if (available < amount) revert InsufficientLiquidity();

        vault.transferFunds(redemptionToken, recipient, amount);
    }

    function releaseVaultPayout(address recipient, uint256 amount) external nonReentrant {
        if (
            msg.sender != addressProvider.getVestedVault()
                && msg.sender != addressProvider.getAddress(addressProvider.ID_VESTED_VAULT())
                && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)
        ) {
            revert UnauthorizedVaultPayout();
        }
        if (amount == 0) revert ZeroAmount();

        AlphaVault vault = AlphaVault(addressProvider.getAlphaVault());
        uint256 available = vault.getBalance(redemptionToken);
        if (available < amount) revert InsufficientLiquidity();

        vault.transferFunds(redemptionToken, recipient, amount);
    }

    // Reserved storage gap to prevent storage collisions in future UUPS upgrades
    uint256[50] private __gap;
}
