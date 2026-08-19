// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../ProtocolAddressProvider.sol";
import "../AlphaVault.sol";
import "../AlphaToken.sol";
import "../OracleHub.sol";
import "../interfaces/IUniversalYieldAdapter.sol";

interface IP2PLendingMarketPoR {
    function treasuryLoansReceivableUSD() external view returns (uint256);
}

interface IGovernanceStakingPoR {
    function communityYieldVault() external view returns (address);
}

interface IVestedDiscountVaultPoR {
    function totalPresentLiability() external view returns (uint256);
}

interface IProtocolTokenomicsEnginePoR {
    function calculateProofOfReserves(uint256 totalAssetsUSD18, uint256 totalLiabilitiesUSD18)
        external
        view
        returns (uint256 collateralRatioBps, bool isSolvent);
}

/**
 * @title TreasuryPoRLib
 * @notice Internal library handling multi-asset Proof of Reserves, NAV accounting, and circulating supply calculations.
 */
library TreasuryPoRLib {
    struct PoRContext {
        ProtocolAddressProvider addressProvider;
        address redemptionToken;
        uint8 redemptionTokenDecimals;
        uint256 lastSettledNAVPerShare;
        address treasuryManagerContract;
    }

    struct AssetBreakdownParams {
        ProtocolAddressProvider addressProvider;
        address redemptionToken;
        uint8 redemptionTokenDecimals;
        address wbtcToken;
        address wethToken;
        address treasuryManagerContract;
    }

    /**
     * @notice Computes total USD value of all exogenous reserves (USDC, WBTC, WETH, P2P loans, Yield Adapters).
     */
    function calculatePoRAssets(PoRContext memory ctx, address[] memory activeYieldAdapters)
        internal
        view
        returns (uint256 totalAssetsUSD)
    {
        AlphaVault vault = AlphaVault(ctx.addressProvider.getAlphaVault());
        OracleHub oracle = OracleHub(ctx.addressProvider.getOracleHub());

        // 1. Treasury Stablecoin Balance (Vault + TreasuryManager contract)
        uint256 treasuryStables =
            vault.getBalance(ctx.redemptionToken) + IERC20(ctx.redemptionToken).balanceOf(ctx.treasuryManagerContract);
        totalAssetsUSD += oracle.getAssetUsdValue(ctx.redemptionToken, treasuryStables);

        // 2. Tracked Assets (WBTC, WETH) in Vault
        address[] memory assets = oracle.getTrackedAssets();
        uint256 assetsLen = assets.length;
        for (uint256 i = 0; i < assetsLen;) {
            if (assets[i] != ctx.redemptionToken) {
                uint256 bal = vault.getBalance(assets[i]);
                totalAssetsUSD += oracle.getAssetUsdValue(assets[i], bal);
            }
            unchecked {
                ++i;
            }
        }

        // 3. P2P Lending Market Receivables
        address p2pAddr = ctx.addressProvider.getP2PMarket();
        if (p2pAddr != address(0)) {
            try IP2PLendingMarketPoR(p2pAddr).treasuryLoansReceivableUSD() returns (uint256 trl) {
                totalAssetsUSD += trl * (10 ** (18 - ctx.redemptionTokenDecimals));
            } catch {
                // Ignore P2P query revert in PoR assets calculation
            }
        }

        // 4. External Yield Adapters (ERC-4626)
        uint256 adaptersLen = activeYieldAdapters.length;
        for (uint256 i = 0; i < adaptersLen;) {
            try IUniversalYieldAdapter(activeYieldAdapters[i]).balanceOf(address(vault)) returns (uint256 shares) {
                if (shares > 0) {
                    try IUniversalYieldAdapter(activeYieldAdapters[i]).convertToAssets(shares) returns (
                        uint256 adapterAssets
                    ) {
                        totalAssetsUSD += oracle.getAssetUsdValue(ctx.redemptionToken, adapterAssets);
                    } catch {
                        // Ignore convertToAssets revert
                    }
                }
            } catch {
                // Ignore adapter balanceOf revert
            }
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Computes total USD liabilities (Circulating ALPHA at settled NAV + Vested Discount liabilities).
     */
    function calculatePoRLiabilities(PoRContext memory ctx) internal view returns (uint256 totalLiabilitiesUSD) {
        AlphaVault vault = AlphaVault(ctx.addressProvider.getAlphaVault());
        AlphaToken token = AlphaToken(ctx.addressProvider.getAlphaToken());
        address govAddr = ctx.addressProvider.getGovernanceStaking();

        uint256 protocolOwnedAlpha = vault.getBalance(address(token)) + token.balanceOf(ctx.treasuryManagerContract);
        if (govAddr != address(0)) {
            protocolOwnedAlpha += IERC20(govAddr).balanceOf(address(vault))
            + IERC20(govAddr).balanceOf(ctx.treasuryManagerContract);
            try IGovernanceStakingPoR(govAddr).communityYieldVault() returns (address yieldVault) {
                if (yieldVault != address(0)) {
                    protocolOwnedAlpha += token.balanceOf(yieldVault) + IERC20(govAddr).balanceOf(yieldVault);
                }
            } catch {
                // Ignore query revert on community vault
            }
        }

        uint256 circulatingAlpha = token.totalSupply();
        if (circulatingAlpha > protocolOwnedAlpha) {
            uint256 netAlphaLiability = circulatingAlpha - protocolOwnedAlpha;
            if (netAlphaLiability > 0) {
                totalLiabilitiesUSD += (netAlphaLiability * ctx.lastSettledNAVPerShare) / 10 ** 18;
            }
        }

        address vestedAddr = ctx.addressProvider.getVestedVault();
        if (vestedAddr != address(0)) {
            try IVestedDiscountVaultPoR(vestedAddr).totalPresentLiability() returns (uint256 vL) {
                totalLiabilitiesUSD += vL;
            } catch {
                // Ignore vested liability query revert
            }
        }
    }

    /**
     * @notice Calculates Proof of Reserves and Solvency ratio.
     */
    function getProofOfReserves(PoRContext memory ctx, address[] memory activeYieldAdapters)
        internal
        view
        returns (uint256 totalAssetsUSD, uint256 totalLiabilitiesUSD, uint256 solvencyRatioBps)
    {
        totalAssetsUSD = calculatePoRAssets(ctx, activeYieldAdapters);
        totalLiabilitiesUSD = calculatePoRLiabilities(ctx);

        if (totalLiabilitiesUSD == 0) {
            solvencyRatioBps = totalAssetsUSD > 0 ? 10000 : 0;
        } else {
            solvencyRatioBps = (totalAssetsUSD * 10000) / totalLiabilitiesUSD;
        }
    }

    function getNetCirculatingShares(ProtocolAddressProvider addressProvider, address treasuryManagerContract)
        internal
        view
        returns (uint256)
    {
        address tokenAddr = addressProvider.getAlphaToken();
        address vaultAddr = addressProvider.getAlphaVault();
        address govAddr = addressProvider.getGovernanceStaking();

        if (tokenAddr == address(0)) return 0;

        AlphaToken token = AlphaToken(tokenAddr);
        uint256 total = token.totalSupply();
        uint256 protocolOwned = (vaultAddr != address(0)) ? token.balanceOf(vaultAddr) : 0;
        protocolOwned += token.balanceOf(treasuryManagerContract);

        if (govAddr != address(0)) {
            if (vaultAddr != address(0)) {
                protocolOwned += IERC20(govAddr).balanceOf(vaultAddr);
            }
            protocolOwned += IERC20(govAddr).balanceOf(treasuryManagerContract);

            try IGovernanceStakingPoR(govAddr).communityYieldVault() returns (address yieldVault) {
                if (yieldVault != address(0)) {
                    protocolOwned += token.balanceOf(yieldVault) + IERC20(govAddr).balanceOf(yieldVault);
                }
            } catch {
                // Ignore community yield query revert
            }
        }

        return total > protocolOwned ? total - protocolOwned : 0;
    }

    /**
     * @notice Detailed asset breakdown for frontend dashboards and transparent auditing.
     */
    function getAssetBreakdown(AssetBreakdownParams memory params, address[] memory activeYieldAdapters)
        internal
        view
        returns (uint256 stablesUsd, uint256 wbtcUsd, uint256 wethUsd, uint256 loansUsd)
    {
        AlphaVault vault = AlphaVault(params.addressProvider.getAlphaVault());
        OracleHub oracle = OracleHub(params.addressProvider.getOracleHub());

        uint256 treasuryStables = vault.getBalance(params.redemptionToken)
            + IERC20(params.redemptionToken).balanceOf(params.treasuryManagerContract);
        stablesUsd = oracle.getAssetUsdValue(params.redemptionToken, treasuryStables);

        if (params.wbtcToken != address(0)) {
            wbtcUsd = oracle.getAssetUsdValue(params.wbtcToken, vault.getBalance(params.wbtcToken));
        }

        if (params.wethToken != address(0)) {
            wethUsd = oracle.getAssetUsdValue(params.wethToken, vault.getBalance(params.wethToken));
        }

        address p2pAddr = params.addressProvider.getP2PMarket();
        if (p2pAddr != address(0)) {
            try IP2PLendingMarketPoR(p2pAddr).treasuryLoansReceivableUSD() returns (uint256 trl) {
                loansUsd = trl * (10 ** (18 - params.redemptionTokenDecimals));
            } catch {
                // Ignore P2P query revert in breakdown
            }
        }

        uint256 adaptersLen = activeYieldAdapters.length;
        for (uint256 i = 0; i < adaptersLen;) {
            try IUniversalYieldAdapter(activeYieldAdapters[i]).balanceOf(address(vault)) returns (uint256 shares) {
                if (shares > 0) {
                    try IUniversalYieldAdapter(activeYieldAdapters[i]).convertToAssets(shares) returns (
                        uint256 adapterAssets
                    ) {
                        stablesUsd += oracle.getAssetUsdValue(params.redemptionToken, adapterAssets);
                    } catch {
                        // Ignore convertToAssets revert
                    }
                }
            } catch {
                // Ignore adapter query revert
            }
            unchecked {
                ++i;
            }
        }
    }
}
