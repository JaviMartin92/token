// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./lib/security/ReentrancyGuard.sol";
import "./ProtocolAddressProvider.sol";
import "./ProtocolRoles.sol";
import "./AlphaVault.sol";
import "./AlphaToken.sol";
import "./OracleHub.sol";

import "./interfaces/IOracleHub.sol";
import {IRealYieldRouter} from "./interfaces/IRealYieldRouter.sol";
import {IUniversalYieldAdapter} from "./interfaces/IUniversalYieldAdapter.sol";
import "./interfaces/IYieldStrategy.sol";
import "./interfaces/ICircuitBreaker.sol";
import "./interfaces/ISwapRouter.sol";

interface IGovernanceStakingOpEx {
    function stake(uint256 amount) external;
}

interface IMorphoYieldVaultAdapter {
    function withdrawLiquidity(uint256 amount) external returns (uint256);
}

// --- Interfaces ---
interface IProtocolTokenomicsEngine {
    function calculateDeposit(uint256 actualDepositedUsdc, bool isRouterCall, uint8 redemptionTokenDecimals) external view returns (uint256 feeAmountUsdc, uint256 netDepositedUsdc, uint256 depositValueUSD18);
    function calculateSharesToMint(uint256 depositValueUSD18, uint256 currentSharesSupply, uint256 navBefore18) external view returns (uint256 sharesToMint);
    function calculateRedemption(uint256 sharesAmount, uint256 totalSharesSupply, uint256 totalNavUSD18, uint8 redemptionTokenDecimals) external view returns (uint256 grossAssetValueUSD18, uint256 feeChargedUSD18, uint256 netAssetValueUSD18, uint256 assetsReceivedTokens, uint256 feeTokenAmount);
    function calculateProofOfReserves(uint256 totalAssetsUSD18, uint256 totalLiabilitiesUSD18) external view returns (uint256 collateralRatioBps, bool isSolvent);
}

interface IGovernanceStaking {
    function totalStaked() external view returns (uint256);
    function stakedBalances(address account) external view returns (uint256);
    function stake(uint256 amount) external;
    function protocolOpExVault() external view returns (address);
    function communityYieldVault() external view returns (address);
}

interface IP2PLendingMarket {
    function treasuryLoansReceivableUSD() external view returns (uint256);
}

interface IVestedDiscountVault {
    function totalPresentLiability() external view returns (uint256);
}

interface IMockERC20 {
    function mint(address to, uint256 amount) external;
}

/**
 * @title TreasuryManager
 * @notice Central logic for handling deposits, redemptions, NAV, and Proof of Reserves.
 *         Delegates custody to AlphaVault, Token to AlphaToken, and Prices to OracleHub.
 */
contract TreasuryManager is Initializable, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    ProtocolAddressProvider public immutable addressProvider;

    struct AssetWeights {
        uint256 stablecoins;
        uint256 wbtc;
        uint256 weth;
        uint256 alphaProtocolStaking;
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
        require(kycWhitelist[account], "TreasuryManager: KYC verification required");
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
    event ProofOfReservesAudited(uint256 totalAssetsUSD, uint256 totalLiabilitiesUSD, uint256 collateralRatioBps, uint256 timestamp);
    event Rebalanced(uint256 timestamp);

    constructor(ProtocolAddressProvider _addressProvider) {
        require(address(_addressProvider) != address(0), "TreasuryManager: Zero address provider");
        addressProvider = _addressProvider;
        _disableInitializers();
    }

    function initialize(
        address _initialAdmin,
        address _redemptionToken,
        uint8 _redemptionTokenDecimals
    ) initializer public {
        _ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _initialAdmin);
        _grantRole(ProtocolRoles.ADMIN_ROLE, _initialAdmin);
        _grantRole(ProtocolRoles.VAULT_MANAGER_ROLE, _initialAdmin);

        redemptionToken = _redemptionToken;
        redemptionTokenDecimals = _redemptionTokenDecimals;
        tvlCap = 50_000_000 * (10**_redemptionTokenDecimals);
        slippageToleranceBps = 100; // 1% default

        currentWeights = AssetWeights({
            stablecoins: 6000,
            wbtc: 2667,
            weth: 1333,
            alphaProtocolStaking: 0
        });
    }

    function setConfig(
        address _wbtc, address _weth, address _swapRouter
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        wbtcToken = _wbtc;
        wethToken = _weth;
        swapRouter = _swapRouter;
    }

    function setSwapRouter(address _swapRouter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        swapRouter = _swapRouter;
    }

    // --- Compliance Functions ---
    /**
     * @notice Grants or revokes KYC whitelist status for an account.
     * @param account The address of the user.
     * @param status True to whitelist, false to revoke.
     */
    function setKYCStatus(address account, bool status) external onlyRole(ProtocolRoles.COMPLIANCE_ROLE) {
        kycWhitelist[account] = status;
        emit WhitelistUpdated(account, status);
    }

    /**
     * @notice Adds a new ERC-4626 Yield Adapter to the active routing list.
     * @param adapter The address of the deployed IUniversalYieldAdapter contract.
     */
    function addYieldAdapter(address adapter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(adapter != address(0), "TreasuryManager: Invalid adapter address");
        // Ensure not already added
        for (uint i = 0; i < activeYieldAdapters.length; i++) {
            require(activeYieldAdapters[i] != adapter, "TreasuryManager: Adapter already active");
        }
        activeYieldAdapters.push(adapter);
    }

    /**
     * @notice Removes an existing Yield Adapter from the active routing list.
     * @param adapter The address of the adapter to remove.
     */
    function removeYieldAdapter(address adapter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        for (uint i = 0; i < activeYieldAdapters.length; i++) {
            if (activeYieldAdapters[i] == adapter) {
                activeYieldAdapters[i] = activeYieldAdapters[activeYieldAdapters.length - 1];
                activeYieldAdapters.pop();
                break;
            }
        }
    }

    function setAssetWeights(uint256 _stables, uint256 _wbtc, uint256 _weth, uint256 _alpha) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_stables + _wbtc + _weth + _alpha == 10000, "TreasuryManager: Weights must sum to 10000 (100%)");
        currentWeights = AssetWeights({ stablecoins: _stables, wbtc: _wbtc, weth: _weth, alphaProtocolStaking: _alpha });
        emit AssetWeightsUpdated(_stables, _wbtc, _weth, _alpha);
    }

    function setTvlCap(uint256 newCap) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newCap > 0, "TreasuryManager: TVL cap must be > 0");
        tvlCap = newCap;
    }

    function recordBurn(uint256 amount) external onlyRole(ProtocolRoles.BURNER_ROLE) {
        // GovernanceStaking directly calls this when executing deflationary burns
        totalBurnedTokens += amount;
    }

    function notifyReserveFee(uint256 usdcFeeAmount) external onlyRole(ProtocolRoles.VAULT_MANAGER_ROLE) {
        // Sweep the reserve fee revenue directly into the AlphaVault to maintain PoR >= 100%
        address vault = addressProvider.getAlphaVault();
        if (vault != address(0) && usdcFeeAmount > 0) {
            uint256 bal = IERC20(redemptionToken).balanceOf(address(this));
            uint256 toTransfer = usdcFeeAmount > bal ? bal : usdcFeeAmount;
            if (toTransfer > 0) {
                IERC20(redemptionToken).safeTransfer(vault, toTransfer);
            }
        }
    }

    function getTotalNavUSD() public view returns (uint256) {
        (uint256 assets, , ) = getProofOfReserves();
        return assets;
    }

    function getNAV() external view returns (uint256) {
        return getTotalNavUSD();
    }

    function getNAVPerShare() public view returns (uint256) {
        uint256 totalAssetsUSD = getTotalNavUSD();
        uint256 circulatingShares = getNetCirculatingShares();
        if (circulatingShares == 0) return 1e18; // Default $1.00 USD peg if zero shares in circulation
        return (totalAssetsUSD * 1e18) / circulatingShares;
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

    function getProofOfReserves() public view returns (uint256 totalAssetsUSD, uint256 totalLiabilitiesUSD, uint256 collateralRatioBps) {
        AlphaVault vault = AlphaVault(addressProvider.getAlphaVault());
        OracleHub oracle = OracleHub(addressProvider.getOracleHub());
        AlphaToken token = AlphaToken(addressProvider.getAlphaToken());
        
        // 1. Treasury Stablecoin Balance (Vault + TreasuryManager contract)
        uint256 treasuryStables = vault.getBalance(redemptionToken) + IERC20(redemptionToken).balanceOf(address(this));
        uint256 treasuryStablesUsd = oracle.getAssetUsdValue(redemptionToken, treasuryStables);
        totalAssetsUSD += treasuryStablesUsd;

        // 2. Tracked Assets (WBTC, WETH) in Vault
        address[] memory assets = oracle.getTrackedAssets();
        for (uint i = 0; i < assets.length; i++) {
            if (assets[i] != redemptionToken) {
                uint256 bal = vault.getBalance(assets[i]);
                totalAssetsUSD += oracle.getAssetUsdValue(assets[i], bal);
            }
        }

        // 3. P2P Market
        address p2pAddr = addressProvider.getP2PMarket();
        if (p2pAddr != address(0)) {
            try IP2PLendingMarket(p2pAddr).treasuryLoansReceivableUSD() returns (uint256 trl) {
                totalAssetsUSD += trl * (10**(18 - redemptionTokenDecimals));
            } catch {}
        }

        // 4. External Yield Adapters (ERC-4626)
        for (uint i = 0; i < activeYieldAdapters.length; i++) {
            try IUniversalYieldAdapter(activeYieldAdapters[i]).balanceOf(address(vault)) returns (uint256 shares) {
                if (shares > 0) {
                    try IUniversalYieldAdapter(activeYieldAdapters[i]).convertToAssets(shares) returns (uint256 adapterAssets) {
                        uint256 assetsUsd = oracle.getAssetUsdValue(redemptionToken, adapterAssets);
                        totalAssetsUSD += assetsUsd;
                    } catch {}
                }
            } catch {}
        }

        // 5. Liabilities
        address govAddr = addressProvider.getGovernanceStaking();
        uint256 protocolOwnedAlpha = vault.getBalance(address(token)) + token.balanceOf(address(this));
        if (govAddr != address(0)) {
            protocolOwnedAlpha += IERC20(govAddr).balanceOf(address(vault)) + IERC20(govAddr).balanceOf(address(this));
            try IGovernanceStaking(govAddr).protocolOpExVault() returns (address opEx) {
                if (opEx != address(0)) {
                    protocolOwnedAlpha += token.balanceOf(opEx) + IERC20(govAddr).balanceOf(opEx);
                }
            } catch {}
            try IGovernanceStaking(govAddr).communityYieldVault() returns (address yieldVault) {
                if (yieldVault != address(0)) {
                    protocolOwnedAlpha += token.balanceOf(yieldVault) + IERC20(govAddr).balanceOf(yieldVault);
                }
            } catch {}
        }

        uint256 circulatingAlpha = token.totalSupply();
        if (circulatingAlpha > protocolOwnedAlpha) {
            uint256 netAlphaLiability = circulatingAlpha - protocolOwnedAlpha;
            if (netAlphaLiability > 0) {
                // AC-11: Pasivos de ALPHA se valúan con el último NAV registrado para evitar circularidad matemática
                totalLiabilitiesUSD += (netAlphaLiability * lastSettledNAVPerShare) / 10**18;
            }
        }

        address vestedAddr = addressProvider.getVestedVault();
        if (vestedAddr != address(0)) {
            try IVestedDiscountVault(vestedAddr).totalPresentLiability() returns (uint256 vL) {
                totalLiabilitiesUSD += vL;
            } catch {}
        }

        address engineAddr = addressProvider.getTokenomicsEngine();
        if (engineAddr != address(0)) {
            try IProtocolTokenomicsEngine(engineAddr).calculateProofOfReserves(totalAssetsUSD, totalLiabilitiesUSD) returns (uint256 c, bool s) {
                collateralRatioBps = c;
            } catch {
                if (totalLiabilitiesUSD == 0) collateralRatioBps = 10000;
                else collateralRatioBps = (totalAssetsUSD * 10000) / totalLiabilitiesUSD;
            }
        } else {
            if (totalLiabilitiesUSD == 0) collateralRatioBps = 10000;
            else collateralRatioBps = (totalAssetsUSD * 10000) / totalLiabilitiesUSD;
        }
    }

    function auditProofOfReserves() external returns (uint256 totalAssetsUSD, uint256 totalLiabilitiesUSD, uint256 collateralRatioBps) {
        (totalAssetsUSD, totalLiabilitiesUSD, collateralRatioBps) = getProofOfReserves();
        emit ProofOfReservesAudited(totalAssetsUSD, totalLiabilitiesUSD, collateralRatioBps, block.timestamp);
    }

    function getNetCirculatingShares() public view returns (uint256) {
        address tokenAddr = addressProvider.getAlphaToken();
        address vaultAddr = addressProvider.getAlphaVault();
        address govAddr = addressProvider.getGovernanceStaking();

        if (tokenAddr == address(0)) return 0;

        AlphaToken token = AlphaToken(tokenAddr);
        AlphaVault vault = AlphaVault(vaultAddr);

        uint256 total = token.totalSupply();
        uint256 protocolOwned = (vaultAddr != address(0)) ? vault.getBalance(tokenAddr) : 0;
        protocolOwned += token.balanceOf(address(this));

        if (govAddr != address(0)) {
            if (vaultAddr != address(0)) {
                protocolOwned += IERC20(govAddr).balanceOf(vaultAddr);
            }
            protocolOwned += IERC20(govAddr).balanceOf(address(this));

            try IGovernanceStaking(govAddr).protocolOpExVault() returns (address opEx) {
                if (opEx != address(0)) {
                    protocolOwned += token.balanceOf(opEx) + IERC20(govAddr).balanceOf(opEx);
                }
            } catch {}
            try IGovernanceStaking(govAddr).communityYieldVault() returns (address yieldVault) {
                if (yieldVault != address(0)) {
                    protocolOwned += token.balanceOf(yieldVault) + IERC20(govAddr).balanceOf(yieldVault);
                }
            } catch {}
        }

        return total > protocolOwned ? total - protocolOwned : 0;
    }

    function getTotalAssetsExogenousUSD() public view returns (uint256) {
        (uint256 assetsUSD, , ) = getProofOfReserves();
        return assetsUSD;
    }

    function getAssetBreakdown() external view returns (uint256 stablesUsd, uint256 wbtcUsd, uint256 wethUsd, uint256 loansUsd) {
        AlphaVault vault = AlphaVault(addressProvider.getAlphaVault());
        OracleHub oracle = OracleHub(addressProvider.getOracleHub());

        uint256 treasuryStables = vault.getBalance(redemptionToken) + IERC20(redemptionToken).balanceOf(address(this));
        stablesUsd = oracle.getAssetUsdValue(redemptionToken, treasuryStables);

        if (wbtcToken != address(0)) {
            wbtcUsd = oracle.getAssetUsdValue(wbtcToken, vault.getBalance(wbtcToken));
        }

        if (wethToken != address(0)) {
            wethUsd = oracle.getAssetUsdValue(wethToken, vault.getBalance(wethToken));
        }

        address p2pAddr = addressProvider.getP2PMarket();
        if (p2pAddr != address(0)) {
            try IP2PLendingMarket(p2pAddr).treasuryLoansReceivableUSD() returns (uint256 trl) {
                loansUsd = trl * (10**(18 - redemptionTokenDecimals));
            } catch {}
        }
        
        for (uint i = 0; i < activeYieldAdapters.length; i++) {
            try IUniversalYieldAdapter(activeYieldAdapters[i]).balanceOf(address(vault)) returns (uint256 shares) {
                if (shares > 0) {
                    try IUniversalYieldAdapter(activeYieldAdapters[i]).convertToAssets(shares) returns (uint256 adapterAssets) {
                        stablesUsd += oracle.getAssetUsdValue(redemptionToken, adapterAssets);
                    } catch {}
                }
            } catch {}
        }
    }

    function calculateDynamicFeeBps(uint256 grossDepositUSD, uint256 totalAssetsExogenousUSD) public pure returns (uint256) {
        uint256 feeBase = 50; // 50 BPS (0.50%)
        uint256 impactSensitivity = 500; // 500 BPS (5.00%)
        
        if (totalAssetsExogenousUSD == 0) return feeBase;

        uint256 totalDenom = totalAssetsExogenousUSD + grossDepositUSD;
        uint256 impactRatio = (grossDepositUSD * 10000) / totalDenom;
        uint256 dynamicFeeBps = feeBase + ((impactRatio * impactSensitivity) / 10000);
        if (dynamicFeeBps > 500) {
            dynamicFeeBps = 500; // Capped at 500 BPS (5.00%)
        }
        return dynamicFeeBps;
    }

    // --- Core Operations ---
    /**
     * @notice Mints Alpha Shares in exchange for deposited USDC. Routes funds to Yield Adapters and P2P Buffers.
     * @param stableAmount The amount of stablecoin (USDC) to deposit.
     * @return sharesMinted The amount of Alpha shares minted to the user.
     */
    function deposit(uint256 stableAmount, uint256 minSharesOut) external nonReentrant onlyWhitelisted(msg.sender) returns (uint256 sharesMinted) {
        require(stableAmount > 0, "TreasuryManager: Deposit amount must be > 0");
        lastDepositBlock[msg.sender] = block.number;

        (, uint256 totalLiabilitiesUSD, uint256 preRatioBps) = getProofOfReserves();
        uint256 preNavUSD = getNAVPerShare();

        // 1. Read Exogenous Assets and Net Circulating Shares BEFORE funds enter the vault
        uint256 totalAssetsExogenous = getTotalAssetsExogenousUSD();
        AlphaToken token = AlphaToken(addressProvider.getAddress(addressProvider.ID_ALPHA_TOKEN()));

        // 2. Send funds to Vault
        AlphaVault vault = AlphaVault(addressProvider.getAddress(addressProvider.ID_ALPHA_VAULT()));
        uint256 balanceBefore = vault.getBalance(redemptionToken);
        IERC20(redemptionToken).safeTransferFrom(msg.sender, address(vault), stableAmount);
        uint256 actualDeposited = vault.getBalance(redemptionToken) - balanceBefore;
        require(actualDeposited > 0, "TreasuryManager: Actual deposited amount is 0");

        address routerAddr = addressProvider.getAddress(addressProvider.ID_REAL_YIELD_ROUTER());
        
        uint256 grossDepositUSD = actualDeposited * (10**(18 - redemptionTokenDecimals));
        uint256 dynamicFeeBps = (msg.sender == routerAddr) ? 0 : calculateDynamicFeeBps(grossDepositUSD, totalAssetsExogenous);

        uint256 feeAmount = (actualDeposited * dynamicFeeBps) / 10000;
        uint256 netDeposited = actualDeposited - feeAmount;
        uint256 depositValueUSD = netDeposited * (10**(18 - redemptionTokenDecimals));

        if (totalLiabilitiesUSD == 0 || totalAssetsExogenous == 0) {
            sharesMinted = depositValueUSD;
        } else {
            sharesMinted = (depositValueUSD * totalLiabilitiesUSD) / totalAssetsExogenous;
        }

        // Mint via AlphaToken
        token.mint(msg.sender, sharesMinted);

        // Handle Fee
            if (routerAddr != address(0)) {
                vault.transferFunds(redemptionToken, routerAddr, feeAmount);
                IRealYieldRouter(routerAddr).routeUniversalFee(redemptionToken);
            } else {
                // If no router, keep 100% of the fee in the vault to accrue NAV for all users
            }

        // Reserve Auto-Allocations (Simplified for Modular Vault)
        if (netDeposited > 0) {
            if (swapRouter != address(0)) {
                uint256 btcUsdc = (netDeposited * currentWeights.wbtc) / 10000;
                if (btcUsdc > 0 && wbtcToken != address(0)) {
                    uint256 btcPrice18 = IOracleHub(addressProvider.getOracleHub()).getPriceBase18(wbtcToken);
                    uint256 expectedWbtc = (btcUsdc * 10**20) / btcPrice18; // btcUsdc is 6 dec, wbtc is 8 dec: 6 + 18 - 8 = 16? No: usd_value = (btcUsdc * 10**12). wbtc = usd_value * 10**8 / price18 = btcUsdc * 10**20 / price18.
                    uint256 minWbtc = (expectedWbtc * (10000 - slippageToleranceBps)) / 10000;

                    vault.approveFunds(redemptionToken, swapRouter, btcUsdc);
                    try ISwapRouter(swapRouter).exactInputSingle(
                        ISwapRouter.ExactInputSingleParams(redemptionToken, wbtcToken, 3000, address(vault), block.timestamp + 15 minutes, btcUsdc, minWbtc, 0)
                    ) returns (uint256) {} catch { emit SwapRebalanceFailed(wbtcToken, btcUsdc); }
                }

                uint256 ethUsdc = (netDeposited * currentWeights.weth) / 10000;
                if (ethUsdc > 0 && wethToken != address(0)) {
                    uint256 ethPrice18 = IOracleHub(addressProvider.getOracleHub()).getPriceBase18(wethToken);
                    uint256 expectedWeth = (ethUsdc * 10**30) / ethPrice18;
                    uint256 minWeth = (expectedWeth * (10000 - slippageToleranceBps)) / 10000;

                    vault.approveFunds(redemptionToken, swapRouter, ethUsdc);
                    try ISwapRouter(swapRouter).exactInputSingle(
                        ISwapRouter.ExactInputSingleParams(redemptionToken, wethToken, 3000, address(vault), block.timestamp + 15 minutes, ethUsdc, minWeth, 0)
                    ) returns (uint256) {} catch { emit SwapRebalanceFailed(wethToken, ethUsdc); }
                }
            }

            uint256 altsUsdc = (netDeposited * currentWeights.alphaProtocolStaking) / 10000;
            _allocateAlphaReserve(altsUsdc, token);
        }

        (uint256 postAssetsUSD, , uint256 postRatioBps) = getProofOfReserves();
        uint256 postNavUSD = getNAVPerShare();

        require(postRatioBps >= 9990, "TreasuryManager: Security Violation - Undercollateralized (PoR < 99.9%)");
        require(postNavUSD >= preNavUSD, "TreasuryManager: Invariant Violation - NAV per share decreased");
        require(postRatioBps >= preRatioBps, "TreasuryManager: Invariant Violation - Solvency ratio decreased");
        require(sharesMinted >= minSharesOut, "TreasuryManager: High Slippage");

        _updateLastSettledNAV();

        emit Deposited(msg.sender, actualDeposited, sharesMinted);
        return sharesMinted;
    }

    /**
     * @notice Dynamically allocates the 12.5% ALPHA sub-reserve via DEX swap (<= 0.5% max slippage)
     *         with automatic Fallback NAV Mint if liquidity is missing or slippage > 0.5% (Genesis Sandbox).
     */
    function _allocateAlphaReserve(uint256 altsUsdc, AlphaToken token) internal {
        if (altsUsdc == 0) return;

        address alphaTokenAddr = address(token);
        address stakingPool = addressProvider.getAddress(addressProvider.ID_GOVERNANCE_STAKING());
        if (stakingPool == address(0)) return;

        bool dexSuccess = false;
        uint256 alphaObtained = 0;

        // 1. Query DEX depth & calculate price impact (Slippage <= 0.5% BPS / 50 BPS)
        if (swapRouter != address(0)) {
            AlphaVault vault = AlphaVault(addressProvider.getAddress(addressProvider.ID_ALPHA_VAULT()));
            
            uint256 alphaPrice18 = IOracleHub(addressProvider.getOracleHub()).getPriceBase18(address(token));
            uint256 expectedAlpha = (altsUsdc * 10**30) / alphaPrice18; // altsUsdc 6 dec, alpha 18 dec
            uint256 minAlpha = (expectedAlpha * (10000 - slippageToleranceBps)) / 10000;

            vault.approveFunds(redemptionToken, swapRouter, altsUsdc);

            try ISwapRouter(swapRouter).exactInputSingle(
                ISwapRouter.ExactInputSingleParams(
                    redemptionToken,
                    alphaTokenAddr,
                    3000,
                    address(this),
                    block.timestamp + 15 minutes,
                    altsUsdc,
                    minAlpha,
                    0
                )
            ) returns (uint256 amountOut) {
                if (amountOut >= minAlpha) {
                    dexSuccess = true;
                    alphaObtained = amountOut;
                }
            } catch {}
        }

        // 2. Fallback (Genesis / Pool Inexistente / Slippage > 0.5% BPS):
        // Retain USDC in reserve for 100% PoR backing, and mint ALPHA at official NAV (USDC_monto / NAV_actual)
        if (!dexSuccess) {
            uint256 totalShares = token.totalSupply();
            uint256 totalNav = getTotalNavUSD();

            if (totalShares == 0 || totalNav == 0) {
                alphaObtained = (altsUsdc * 10**18) / (10**redemptionTokenDecimals);
            } else {
                uint256 depositValueUSD = altsUsdc * (10**(18 - redemptionTokenDecimals));
                alphaObtained = (depositValueUSD * totalShares) / totalNav;
            }
            token.mint(address(this), alphaObtained);
        }

        // 3. Auto-stake acquired or minted ALPHA tokens in GovernanceStaking for Treasury
        if (alphaObtained > 0) {
            token.approve(stakingPool, alphaObtained);
            try IGovernanceStakingOpEx(stakingPool).stake(alphaObtained) {} catch {}
        }
    }

    /**
     * @notice Ensures liquid USDC buffer in AlphaVault by auto-withdrawing from Yield Adapters if needed.
     */
    function _ensureLiquidBuffer(AlphaVault vault, uint256 requiredUsdc) internal {
        uint256 vaultBal = vault.getBalance(redemptionToken);
        if (vaultBal < requiredUsdc) {
            uint256 deficit = requiredUsdc - vaultBal;
            
            for (uint i = 0; i < activeYieldAdapters.length && deficit > 0; i++) {
                address adapter = activeYieldAdapters[i];
                try IUniversalYieldAdapter(adapter).balanceOf(address(vault)) returns (uint256 shares) {
                    if (shares > 0) {
                        try IUniversalYieldAdapter(adapter).convertToAssets(shares) returns (uint256 assets) {
                            uint256 toWithdraw = (assets > deficit) ? deficit : assets;
                            
                            // Normally we would just call withdraw on the adapter as the vault,
                            // but since the vault holds the shares, the TreasuryManager needs to ask the vault 
                            // to execute the withdrawal. Assuming vault has an execute call or we can do it via a specialized adapter wrapper.
                            // To keep it simple and aligned with the previous implementation, we will use a direct call if the vault supports it,
                            // or have the vault approve the TreasuryManager to pull shares.
                            // Let's assume the vault executes the transaction or we transfer the shares first.
                            // Wait, earlier it was: IMorphoYieldVaultAdapter(morphoAdapterAddr).withdrawLiquidity(deficit).
                            // Let's have the TreasuryManager request the Vault to withdraw from the ERC4626 adapter.
                            
                            // Since Vault does not natively know ERC4626, we will transfer shares to TreasuryManager, withdraw, and send back.
                            try vault.transferFunds(adapter, address(this), IUniversalYieldAdapter(adapter).convertToShares(toWithdraw)) {
                                uint256 sharesToWithdraw = IUniversalYieldAdapter(adapter).balanceOf(address(this));
                                IUniversalYieldAdapter(adapter).withdraw(toWithdraw, address(vault), address(this));
                                deficit = (toWithdraw > deficit) ? 0 : deficit - toWithdraw;
                            } catch {}
                        } catch {}
                    }
                } catch {}
            }
        }
    }

    /**
     * @notice Moves idle USDC from the AlphaVault into a registered Yield Adapter.
     */
    function depositToYieldAdapter(address adapter, uint256 amount) external onlyRole(ProtocolRoles.VAULT_MANAGER_ROLE) nonReentrant {
        require(amount > 0, "TreasuryManager: Amount must be > 0");
        
        bool isActive = false;
        for (uint i = 0; i < activeYieldAdapters.length; i++) {
            if (activeYieldAdapters[i] == adapter) {
                isActive = true;
                break;
            }
        }
        require(isActive, "TreasuryManager: Adapter not active");

        AlphaVault vault = AlphaVault(addressProvider.getAlphaVault());
        require(vault.getBalance(redemptionToken) >= amount, "TreasuryManager: Insufficient liquid buffer");

        vault.transferFunds(redemptionToken, address(this), amount);
        IERC20(redemptionToken).approve(adapter, amount);
        IUniversalYieldAdapter(adapter).deposit(amount, address(vault));
    }

    /**
     * @notice Burns Alpha Shares in exchange for USDC from the Treasury.
     * @param sharesAmount The amount of Alpha shares to burn.
     * @return assetsReceived The amount of USDC transferred to the user, net of fees.
     */
    function redeem(uint256 sharesAmount, uint256 minUsdcOut) external nonReentrant onlyWhitelisted(msg.sender) returns (uint256 assetsReceived) {
        require(sharesAmount > 0, "TreasuryManager: Redeeming 0 shares");
        require(lastDepositBlock[msg.sender] < block.number, "TreasuryManager: Same-block deposit/redeem cooldown");
        AlphaToken token = AlphaToken(addressProvider.getAddress(addressProvider.ID_ALPHA_TOKEN()));
        uint256 totalShares = getNetCirculatingShares();
        
        (, , uint256 preRatioBps) = getProofOfReserves();
        uint256 preNavUSD = getNAVPerShare();

        uint256 nav = getTotalNavUSD();
        uint256 grossAssetValueUSD = (sharesAmount * nav) / totalShares;
        uint256 feeChargedUSD = (grossAssetValueUSD * 100) / 10000;
        uint256 netAssetValueUSD = grossAssetValueUSD - feeChargedUSD;

        assetsReceived = netAssetValueUSD / (10**(18 - redemptionTokenDecimals));
        require(assetsReceived > 0, "TreasuryManager: Net redeemed asset amount is 0");

        AlphaVault vault = AlphaVault(addressProvider.getAddress(addressProvider.ID_ALPHA_VAULT()));
        _ensureLiquidBuffer(vault, assetsReceived);
        
        token.burnFrom(msg.sender, sharesAmount);
        totalBurnedTokens += sharesAmount;
        vault.transferFunds(redemptionToken, msg.sender, assetsReceived);

        // Fee Distribution
        uint256 feeTokenAmount = feeChargedUSD / (10**(18 - redemptionTokenDecimals));
        address routerAddr = addressProvider.getAddress(addressProvider.ID_REAL_YIELD_ROUTER());
        if (feeTokenAmount > 0) {
            if (routerAddr != address(0)) {
                vault.transferFunds(redemptionToken, routerAddr, feeTokenAmount);
                IRealYieldRouter(routerAddr).routeUniversalFee(redemptionToken);
            } else {
                // Keep 100% of the exit fee in the vault to accrue NAV
            }
        }

        (, , uint256 postRatioBps) = getProofOfReserves();
        uint256 postNavUSD = getNAVPerShare();
        require(postRatioBps >= preRatioBps, "TreasuryManager: Security Violation - Transaction reduced collateralization ratio");
        require(postNavUSD >= preNavUSD, "TreasuryManager: Invariant Violation - NAV per share decreased");
        require(assetsReceived >= minUsdcOut, "TreasuryManager: High Slippage");

        _updateLastSettledNAV();

        emit Redeemed(msg.sender, sharesAmount, assetsReceived);
        return assetsReceived;
    }

    function _updateLastSettledNAV() internal {
        try this.getNAVPerShare() returns (uint256 nav) {
            if (nav > 0) {
                lastSettledNAVPerShare = nav;
            }
        } catch {}
    }

    /**
     * @notice Emergency redemption for accounts whose KYC whitelist status was revoked.
     *         Applies a 5.0% retention fee synchronously routed to RealYieldRouter to prevent arbitrage.
     * @param sharesAmount The amount of Alpha shares to redeem.
     * @param minUsdcOut Minimum USDC to receive, guarding against NAV slippage.
     * @return assetsReceived Net USDC returned to the user.
     */
    function emergencyRedeem(uint256 sharesAmount, uint256 minUsdcOut) external nonReentrant returns (uint256 assetsReceived) {
        require(!kycWhitelist[msg.sender], "TreasuryManager: Account is whitelisted, use standard redeem");
        require(sharesAmount > 0, "TreasuryManager: Zero shares");

        AlphaToken token = AlphaToken(addressProvider.getAlphaToken());
        require(token.balanceOf(msg.sender) >= sharesAmount, "TreasuryManager: Insufficient share balance");

        (uint256 totalAssetsUSD, , ) = getProofOfReserves();
        uint256 netCirculating = getNetCirculatingShares();
        require(netCirculating > 0, "TreasuryManager: Zero net circulating shares");

        uint256 grossUsdValue = (sharesAmount * totalAssetsUSD) / netCirculating;
        
        // 5.0% Emergency retention fee to neutralize arbitrage
        uint256 emergencyFeeUsd = (grossUsdValue * 500) / 10000;
        uint256 netUsdValue = grossUsdValue - emergencyFeeUsd;

        uint256 scaleFactor = 10**(18 - redemptionTokenDecimals);
        assetsReceived = netUsdValue / scaleFactor;
        uint256 feeTokenAmount = emergencyFeeUsd / scaleFactor;

        require(assetsReceived > 0, "TreasuryManager: Net emergency redemption amount is 0");

        AlphaVault vault = AlphaVault(addressProvider.getAlphaVault());
        _ensureLiquidBuffer(vault, assetsReceived + feeTokenAmount);

        token.burnFrom(msg.sender, sharesAmount);
        totalBurnedTokens += sharesAmount;
        vault.transferFunds(redemptionToken, msg.sender, assetsReceived);

        // Synchronously route retained emergency fee to RealYieldRouter (AC-06 requirement)
        address routerAddr = addressProvider.getRealYieldRouter();
        if (routerAddr != address(0) && feeTokenAmount > 0) {
            vault.transferFunds(redemptionToken, routerAddr, feeTokenAmount);
            try IRealYieldRouter(routerAddr).routeUniversalFee(redemptionToken) {} catch {}
        }

        require(assetsReceived >= minUsdcOut, "TreasuryManager: High Slippage");
        _updateLastSettledNAV();

        emit Redeemed(msg.sender, sharesAmount, assetsReceived);
        return assetsReceived;
    }

    function mintCorporateFeeShares(uint256 stableAmount) external returns (uint256 sharesMinted) {
        require(msg.sender == addressProvider.getAddress(addressProvider.ID_REAL_YIELD_ROUTER()), "TreasuryManager: Only RealYieldRouter");
        require(stableAmount > 0, "TreasuryManager: Amount must be > 0");

        AlphaVault vault = AlphaVault(addressProvider.getAddress(addressProvider.ID_ALPHA_VAULT()));
        require(IERC20(redemptionToken).transferFrom(msg.sender, address(vault), stableAmount), "TreasuryManager: transferFrom failed");

        uint256 depositValueUSD = stableAmount * (10**(18 - redemptionTokenDecimals));
        uint256 navBefore = getTotalNavUSD();
        AlphaToken token = AlphaToken(addressProvider.getAddress(addressProvider.ID_ALPHA_TOKEN()));
        uint256 currentShares = token.totalSupply();

        if (currentShares == 0 || navBefore == 0) {
            sharesMinted = depositValueUSD;
        } else {
            sharesMinted = (depositValueUSD * currentShares) / navBefore;
        }

        token.mint(msg.sender, sharesMinted);
        return sharesMinted;
    }

    function disburseTreasuryLoan(address recipient, uint256 amount) external nonReentrant {
        require(msg.sender == addressProvider.getAddress(addressProvider.ID_P2P_MARKET()) || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "TreasuryManager: Unauthorized to disburse loans");
        require(amount > 0, "TreasuryManager: Loan amount must be > 0");
        
        AlphaVault vault = AlphaVault(addressProvider.getAddress(addressProvider.ID_ALPHA_VAULT()));
        
        // Ensure Treasury has enough stablecoin liquidity
        uint256 available = vault.getBalance(redemptionToken);
        require(available >= amount, "TreasuryManager: Insufficient liquidity for loan");
        
        vault.transferFunds(redemptionToken, recipient, amount);
    }

    function releaseVaultPayout(address recipient, uint256 amount) external nonReentrant {
        require(
            msg.sender == addressProvider.getVestedVault() ||
            msg.sender == addressProvider.getAddress(addressProvider.ID_VESTED_VAULT()) ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "TreasuryManager: Unauthorized vault payout"
        );
        require(amount > 0, "TreasuryManager: Payout amount must be > 0");

        AlphaVault vault = AlphaVault(addressProvider.getAlphaVault());
        uint256 available = vault.getBalance(redemptionToken);
        require(available >= amount, "TreasuryManager: Insufficient liquidity for payout");

        vault.transferFunds(redemptionToken, recipient, amount);
    }
}
