// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../ProtocolAddressProvider.sol";
import "../AlphaVault.sol";
import "../AlphaToken.sol";
import "../interfaces/IOracleHub.sol";
import "../interfaces/ISwapRouter.sol";

interface IGovernanceStakingRebalance {
    function stake(uint256 amount) external;
}

/**
 * @title TreasuryRebalanceLib
 * @notice Internal library executing automatic DEX portfolio rebalancing and dynamic ALPHA sub-reserve allocation.
 */
library TreasuryRebalanceLib {
    struct RebalanceParams {
        ProtocolAddressProvider addressProvider;
        AlphaVault vault;
        AlphaToken token;
        address swapRouter;
        address wbtcToken;
        address wethToken;
        address redemptionToken;
        uint8 redemptionTokenDecimals;
        uint256 slippageToleranceBps;
        uint256 stableWeight;
        uint256 wbtcWeight;
        uint256 wethWeight;
        uint256 alphaWeight;
        uint256 netDeposited;
        uint256 totalNavUSD;
        address treasuryContract;
    }

    event SwapRebalanceFailed(address indexed tokenOut, uint256 amountIn);

    /**
     * @notice Executes automatic swap rebalancing into WBTC, WETH and allocates ALPHA sub-reserves.
     */
    function executeRebalanceSwaps(RebalanceParams memory params) internal {
        if (params.swapRouter != address(0)) {
            // 1. WBTC Rebalance Swap
            uint256 btcUsdc = (params.netDeposited * params.wbtcWeight) / 10000;
            if (btcUsdc > 0 && params.wbtcToken != address(0)) {
                uint256 btcPrice18 = IOracleHub(params.addressProvider.getOracleHub()).getPriceBase18(params.wbtcToken);
                uint256 expectedWbtc = (btcUsdc * 10 ** 20) / btcPrice18;
                uint256 minWbtc = (expectedWbtc * (10000 - params.slippageToleranceBps)) / 10000;

                params.vault.approveFunds(params.redemptionToken, params.swapRouter, btcUsdc);
                try ISwapRouter(params.swapRouter)
                    .exactInputSingle(
                        ISwapRouter.ExactInputSingleParams(
                            params.redemptionToken,
                            params.wbtcToken,
                            3000,
                            address(params.vault),
                            block.timestamp + 15 minutes,
                            btcUsdc,
                            minWbtc,
                            0
                        )
                    ) returns (
                    uint256
                ) {
                    // Swap to WBTC completed
                }
                catch {
                    emit SwapRebalanceFailed(params.wbtcToken, btcUsdc);
                }
            }

            // 2. WETH Rebalance Swap
            uint256 ethUsdc = (params.netDeposited * params.wethWeight) / 10000;
            if (ethUsdc > 0 && params.wethToken != address(0)) {
                uint256 ethPrice18 = IOracleHub(params.addressProvider.getOracleHub()).getPriceBase18(params.wethToken);
                uint256 expectedWeth = (ethUsdc * 10 ** 30) / ethPrice18;
                uint256 minWeth = (expectedWeth * (10000 - params.slippageToleranceBps)) / 10000;

                params.vault.approveFunds(params.redemptionToken, params.swapRouter, ethUsdc);
                try ISwapRouter(params.swapRouter)
                    .exactInputSingle(
                        ISwapRouter.ExactInputSingleParams(
                            params.redemptionToken,
                            params.wethToken,
                            3000,
                            address(params.vault),
                            block.timestamp + 15 minutes,
                            ethUsdc,
                            minWeth,
                            0
                        )
                    ) returns (
                    uint256
                ) {
                    // Swap to WETH completed
                }
                catch {
                    emit SwapRebalanceFailed(params.wethToken, ethUsdc);
                }
            }
        }

        // 3. ALPHA Dynamic Sub-Reserve Allocation
        uint256 altsUsdc = (params.netDeposited * params.alphaWeight) / 10000;
        allocateAlphaReserve(params, altsUsdc);
    }

    /**
     * @notice Dynamically allocates ALPHA sub-reserve via DEX swap with automatic NAV Fallback mint + auto-staking.
     */
    function allocateAlphaReserve(RebalanceParams memory params, uint256 altsUsdc) internal {
        if (altsUsdc == 0) return;

        address alphaTokenAddr = address(params.token);
        address stakingPool = params.addressProvider.getAddress(params.addressProvider.ID_GOVERNANCE_STAKING());
        if (stakingPool == address(0)) return;

        bool dexSuccess = false;
        uint256 alphaObtained = 0;

        // 1. DEX Swap Route
        if (params.swapRouter != address(0)) {
            try IOracleHub(params.addressProvider.getOracleHub()).getPriceBase18(alphaTokenAddr) returns (
                uint256 alphaPrice18
            ) {
                if (alphaPrice18 > 0) {
                    uint256 expectedAlpha = (altsUsdc * 10 ** 30) / alphaPrice18;
                    uint256 minAlpha = (expectedAlpha * (10000 - params.slippageToleranceBps)) / 10000;

                    params.vault.approveFunds(params.redemptionToken, params.swapRouter, altsUsdc);

                    try ISwapRouter(params.swapRouter)
                        .exactInputSingle(
                            ISwapRouter.ExactInputSingleParams(
                                params.redemptionToken,
                                alphaTokenAddr,
                                3000,
                                params.treasuryContract,
                                block.timestamp + 15 minutes,
                                altsUsdc,
                                minAlpha,
                                0
                            )
                        ) returns (
                        uint256 amountOut
                    ) {
                        if (amountOut >= minAlpha) {
                            dexSuccess = true;
                            alphaObtained = amountOut;
                        }
                    } catch {
                        // DEX swap failed, fall back to NAV mint
                    }
                }
            } catch {
                // Oracle query failed, fall back to NAV mint
            }
        }

        // 2. NAV Mint Fallback (Genesis Sandbox / Liquidity Protection)
        if (!dexSuccess) {
            uint256 totalShares = params.token.totalSupply();
            if (totalShares == 0 || params.totalNavUSD == 0) {
                alphaObtained = (altsUsdc * 10 ** 18) / (10 ** params.redemptionTokenDecimals);
            } else {
                uint256 depositValueUSD = altsUsdc * (10 ** (18 - params.redemptionTokenDecimals));
                alphaObtained = (depositValueUSD * totalShares) / params.totalNavUSD;
            }
            params.token.mint(params.treasuryContract, alphaObtained);
        }

        // 3. Auto-stake into GovernanceStaking for Treasury POL
        if (alphaObtained > 0) {
            params.token.approve(stakingPool, alphaObtained);
            try IGovernanceStakingRebalance(stakingPool).stake(alphaObtained) {
                // Auto-staked successfully
            } catch {
                // Keep unstaked in treasury if staking pool reverts
            }
        }
    }
}
