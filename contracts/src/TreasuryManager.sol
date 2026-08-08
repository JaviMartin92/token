// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./lib/security/ReentrancyGuard.sol";
import "./ProtocolAddressProvider.sol";
import "./ProtocolRoles.sol";
import "./AlphaVault.sol";
import "./AlphaToken.sol";
import "./OracleHub.sol";
import "./interfaces/IYieldStrategy.sol";

interface IGovernanceStakingOpEx {
    function stake(uint256 amount) external;
}

// --- Interfaces ---
interface IProtocolTokenomicsEngine {
    function calculateDeposit(uint256 actualDepositedUsdc, bool isRouterCall, uint8 redemptionTokenDecimals) external view returns (uint256 feeAmountUsdc, uint256 netDepositedUsdc, uint256 depositValueUSD18);
    function calculateSharesToMint(uint256 depositValueUSD18, uint256 currentSharesSupply, uint256 navBefore18) external view returns (uint256 sharesToMint);
    function calculateRedemption(uint256 sharesAmount, uint256 totalSharesSupply, uint256 totalNavUSD18, uint8 redemptionTokenDecimals) external view returns (uint256 grossAssetValueUSD18, uint256 feeChargedUSD18, uint256 netAssetValueUSD18, uint256 assetsReceivedTokens, uint256 feeTokenAmount);
    function calculateProofOfReserves(uint256 totalAssetsUSD18, uint256 totalLiabilitiesUSD18) external view returns (uint256 collateralRatioBps, bool isSolvent);
}

interface ICircuitBreaker {
    function isFrozen(address asset) external view returns (bool);
}

interface IGovernanceStaking {
    function totalStaked() external view returns (uint256);
    function stakedBalances(address account) external view returns (uint256);
    function stake(uint256 amount) external;
    function corporateOpExVault() external view returns (address);
    function corporateProfitVault() external view returns (address);
}

interface IRealYieldRouter {
    function routeUniversalFee(address feeToken) external;
}

interface IP2PLendingMarket {
    function treasuryLoansReceivableUSD() external view returns (uint256);
}

interface IVestedDiscountVault {
    function totalPresentLiability() external view returns (uint256);
}

interface ISwapRouter {
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
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface IMockERC20 {
    function mint(address to, uint256 amount) external;
}

/**
 * @title TreasuryManager
 * @notice Central logic for handling deposits, redemptions, NAV, and Proof of Reserves.
 *         Delegates custody to AlphaVault, Token to AlphaToken, and Prices to OracleHub.
 */
contract TreasuryManager is AccessControl, ReentrancyGuard {
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

    // Direct tracked assets for routing
    address public wbtcToken;
    address public wethToken;
    address public swapRouter;
    address public opsWallet;
    address public corporateRevenueWallet;

    event Deposited(address indexed user, uint256 usdcAmount, uint256 sharesMinted);
    event Redeemed(address indexed user, uint256 sharesAmount, uint256 usdcReturned);
    event AssetWeightsUpdated(uint256 stablecoins, uint256 wbtc, uint256 weth, uint256 alpha);
    event ProofOfReservesAudited(uint256 totalAssetsUSD, uint256 totalLiabilitiesUSD, uint256 collateralRatioBps, uint256 timestamp);
    event Rebalanced(uint256 timestamp);

    constructor(
        ProtocolAddressProvider _addressProvider,
        address _initialAdmin,
        address _redemptionToken,
        uint8 _redemptionTokenDecimals
    ) {
        require(address(_addressProvider) != address(0), "TreasuryManager: Zero address provider");
        addressProvider = _addressProvider;
        _grantRole(DEFAULT_ADMIN_ROLE, _initialAdmin);
        _grantRole(ProtocolRoles.VAULT_MANAGER_ROLE, _initialAdmin);

        redemptionToken = _redemptionToken;
        redemptionTokenDecimals = _redemptionTokenDecimals;
        tvlCap = 50_000_000 * (10**_redemptionTokenDecimals);

        currentWeights = AssetWeights({
            stablecoins: 6000,
            wbtc: 2667,
            weth: 1333,
            alphaProtocolStaking: 0
        });
    }

    function setConfig(
        address _wbtc, address _weth, address _swapRouter, address _opsWallet, address _corpWallet
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        wbtcToken = _wbtc;
        wethToken = _weth;
        swapRouter = _swapRouter;
        opsWallet = _opsWallet;
        corporateRevenueWallet = _corpWallet;
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

    function recordBurn(uint256 amount) external {
        // GovernanceStaking directly calls this when executing deflationary burns
        totalBurnedTokens += amount;
    }

    function notifyReserveFee(uint256 usdcFeeAmount) external {
        // Sweep the reserve fee revenue directly into the AlphaVault to maintain PoR >= 100%
        address vault = addressProvider.getAlphaVault();
        if (vault != address(0) && usdcFeeAmount > 0) {
            uint256 bal = IERC20(redemptionToken).balanceOf(address(this));
            uint256 toTransfer = usdcFeeAmount > bal ? bal : usdcFeeAmount;
            if (toTransfer > 0) {
                IERC20(redemptionToken).transfer(vault, toTransfer);
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

        // 5. Liabilities
        address govAddr = addressProvider.getGovernanceStaking();
        uint256 protocolOwnedAlpha = vault.getBalance(address(token)) + token.balanceOf(address(this));
        if (govAddr != address(0)) {
            protocolOwnedAlpha += IERC20(govAddr).balanceOf(address(vault)) + IERC20(govAddr).balanceOf(address(this));
            try IGovernanceStaking(govAddr).corporateOpExVault() returns (address opEx) {
                if (opEx != address(0)) {
                    protocolOwnedAlpha += token.balanceOf(opEx) + IERC20(govAddr).balanceOf(opEx);
                }
            } catch {}
            try IGovernanceStaking(govAddr).corporateProfitVault() returns (address profit) {
                if (profit != address(0)) {
                    protocolOwnedAlpha += token.balanceOf(profit) + IERC20(govAddr).balanceOf(profit);
                }
            } catch {}
        }

        uint256 circulatingAlpha = token.totalSupply();
        if (circulatingAlpha > protocolOwnedAlpha) {
            uint256 netAlphaLiability = circulatingAlpha - protocolOwnedAlpha;
            if (netAlphaLiability > 0) {
                uint256 alphaPrice = 10**18; // Default $1 peg approximation
                totalLiabilitiesUSD += (netAlphaLiability * alphaPrice) / 10**18;
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
        AlphaToken token = AlphaToken(addressProvider.getAddress(addressProvider.ID_ALPHA_TOKEN()));
        return token.totalSupply();
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
    function deposit(uint256 stableAmount) external nonReentrant returns (uint256 sharesMinted) {
        require(stableAmount > 0, "TreasuryManager: Deposit amount must be > 0");

        (, uint256 totalLiabilitiesUSD, uint256 preRatioBps) = getProofOfReserves();

        // 1. Read Exogenous Assets and Net Circulating Shares BEFORE funds enter the vault
        uint256 totalAssetsExogenous = getTotalAssetsExogenousUSD();
        AlphaToken token = AlphaToken(addressProvider.getAddress(addressProvider.ID_ALPHA_TOKEN()));

        // 2. Send funds to Vault
        AlphaVault vault = AlphaVault(addressProvider.getAddress(addressProvider.ID_ALPHA_VAULT()));
        uint256 balanceBefore = vault.getBalance(redemptionToken);
        require(IERC20(redemptionToken).transferFrom(msg.sender, address(vault), stableAmount), "TreasuryManager: transferFrom failed");
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
        if (feeAmount > 0) {
            if (routerAddr != address(0)) {
                vault.transferFunds(redemptionToken, routerAddr, feeAmount);
                IRealYieldRouter(routerAddr).routeUniversalFee(redemptionToken);
            } else {
                uint256 opsShare = feeAmount / 4;
                uint256 corpRevenueShare = feeAmount / 4;
                if (opsWallet != address(0)) vault.transferFunds(redemptionToken, opsWallet, opsShare);
                if (corporateRevenueWallet != address(0)) vault.transferFunds(redemptionToken, corporateRevenueWallet, corpRevenueShare);
            }
        }

        // Reserve Auto-Allocations (Simplified for Modular Vault)
        if (netDeposited > 0) {
            if (swapRouter != address(0)) {
                uint256 btcUsdc = (netDeposited * currentWeights.wbtc) / 10000;
                if (btcUsdc > 0 && wbtcToken != address(0)) {
                    vault.approveFunds(redemptionToken, swapRouter, btcUsdc);
                    try ISwapRouter(swapRouter).exactInputSingle(
                        ISwapRouter.ExactInputSingleParams(redemptionToken, wbtcToken, 3000, address(vault), block.timestamp + 15 minutes, btcUsdc, 0, 0)
                    ) returns (uint256) {} catch {
                        // Sandbox fallback
                        uint256 btcBought = (btcUsdc * 10**8) / (60000 * (10**redemptionTokenDecimals));
                        try IMockERC20(wbtcToken).mint(address(vault), btcBought) {} catch {}
                    }
                }

                uint256 ethUsdc = (netDeposited * currentWeights.weth) / 10000;
                if (ethUsdc > 0 && wethToken != address(0)) {
                    vault.approveFunds(redemptionToken, swapRouter, ethUsdc);
                    try ISwapRouter(swapRouter).exactInputSingle(
                        ISwapRouter.ExactInputSingleParams(redemptionToken, wethToken, 3000, address(vault), block.timestamp + 15 minutes, ethUsdc, 0, 0)
                    ) returns (uint256) {} catch {
                        uint256 ethBought = (ethUsdc * 10**18) / (3000 * (10**redemptionTokenDecimals));
                        try IMockERC20(wethToken).mint(address(vault), ethBought) {} catch {}
                    }
                }
            }

            uint256 altsUsdc = (netDeposited * currentWeights.alphaProtocolStaking) / 10000;
            _allocateAlphaReserve(altsUsdc, token);
        }

        (, , uint256 postRatioBps) = getProofOfReserves();
        require(postRatioBps >= 10000, "TreasuryManager: Security Violation - Undercollateralized (PoR < 100%)");

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
            
            // Expected ALPHA amount at $1.00 USD peg / current NAV
            uint256 expectedAlpha = (altsUsdc * 10**18) / (10**redemptionTokenDecimals);
            // Minimum output for 0.5% max slippage (99.5% minimum received)
            uint256 minAlphaOutput = (expectedAlpha * 9950) / 10000;

            vault.approveFunds(redemptionToken, swapRouter, altsUsdc);

            try ISwapRouter(swapRouter).exactInputSingle(
                ISwapRouter.ExactInputSingleParams(
                    redemptionToken,
                    alphaTokenAddr,
                    3000,
                    address(this),
                    block.timestamp + 15 minutes,
                    altsUsdc,
                    minAlphaOutput,
                    0
                )
            ) returns (uint256 amountOut) {
                if (amountOut >= minAlphaOutput) {
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

    function redeem(uint256 sharesAmount) external nonReentrant returns (uint256 assetsReceived) {
        require(sharesAmount > 0, "TreasuryManager: Redeeming 0 shares");
        AlphaToken token = AlphaToken(addressProvider.getAddress(addressProvider.ID_ALPHA_TOKEN()));
        uint256 totalShares = getNetCirculatingShares();
        
        (, , uint256 preRatioBps) = getProofOfReserves();

        uint256 nav = getTotalNavUSD();
        uint256 grossAssetValueUSD = (sharesAmount * nav) / totalShares;
        uint256 feeChargedUSD = (grossAssetValueUSD * 100) / 10000;
        uint256 netAssetValueUSD = grossAssetValueUSD - feeChargedUSD;

        assetsReceived = netAssetValueUSD / (10**(18 - redemptionTokenDecimals));
        require(assetsReceived > 0, "TreasuryManager: Net redeemed asset amount is 0");

        AlphaVault vault = AlphaVault(addressProvider.getAddress(addressProvider.ID_ALPHA_VAULT()));
        
        token.burnFrom(msg.sender, sharesAmount);
        totalBurnedTokens += sharesAmount;
        vault.transferFunds(redemptionToken, msg.sender, assetsReceived);

        // Fee Distribution
        uint256 feeTokenAmount = feeChargedUSD / (10**(18 - redemptionTokenDecimals));
        address routerAddr = addressProvider.getAddress(addressProvider.ID_REAL_YIELD_ROUTER());
        if (feeTokenAmount > 0 && routerAddr != address(0)) {
            vault.transferFunds(redemptionToken, routerAddr, feeTokenAmount);
            try IRealYieldRouter(routerAddr).routeUniversalFee(redemptionToken) {} catch {}
        } else if (feeTokenAmount > 0) {
            if (opsWallet != address(0)) vault.transferFunds(redemptionToken, opsWallet, feeTokenAmount / 4);
            if (corporateRevenueWallet != address(0)) vault.transferFunds(redemptionToken, corporateRevenueWallet, feeTokenAmount / 4);
        }

        (, , uint256 postRatioBps) = getProofOfReserves();
        require(postRatioBps >= preRatioBps, "TreasuryManager: Security Violation - Transaction reduced collateralization ratio");

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
