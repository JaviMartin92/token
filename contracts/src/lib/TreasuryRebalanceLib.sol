// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../ProtocolAddressProvider.sol";
import "../VirajeVault.sol";
import "../VirajeToken.sol";
import "../interfaces/IOracleHub.sol";
import "../interfaces/ISwapRouter.sol";
import "../interfaces/ITreasury.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IGovernanceStakingRebalance {
    function stake(uint256 amount) external;
}

/**
 * @title TreasuryRebalanceLib
 * @notice Internal library executing automatic DEX portfolio rebalancing and dynamic VIRAJE sub-reserve allocation.
 */
library TreasuryRebalanceLib {
    using SafeERC20 for IERC20;
    struct RebalanceParams {
        ProtocolAddressProvider addressProvider;
        VirajeVault vault;
        VirajeToken token;
        address swapRouter;
        address wbtcToken;
        address wethToken;
        address redemptionToken;
        uint8 redemptionTokenDecimals;
        uint256 slippageToleranceBps;
        uint256 stableWeight;
        uint256 wbtcWeight;
        uint256 wethWeight;
        uint256 virajeWeight;
        uint256 netDeposited;
        uint256 totalNavUSD;
        address treasuryContract;
    }

    event SwapRebalanceFailed(address indexed tokenOut, uint256 amountIn);

    /**
     * @notice Executes automatic swap rebalancing into WBTC, WETH and allocates VIRAJE sub-reserves.
     */
    function executeRebalanceSwaps(RebalanceParams memory params) public {
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
                    params.vault.approveFunds(params.redemptionToken, params.swapRouter, 0);
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
                    params.vault.approveFunds(params.redemptionToken, params.swapRouter, 0);
                    emit SwapRebalanceFailed(params.wethToken, ethUsdc);
                }
            }
        }

        // 3. VIRAJE Dynamic Sub-Reserve Allocation
        uint256 altsUsdc = (params.netDeposited * params.virajeWeight) / 10000;
        allocateVirajeReserve(params, altsUsdc);
    }

    /**
     * @notice Dynamically allocates VIRAJE sub-reserve via DEX swap with automatic NAV Fallback mint + auto-staking.
     */
    function allocateVirajeReserve(RebalanceParams memory params, uint256 altsUsdc) public {
        if (altsUsdc == 0) return;

        address virajeTokenAddr = address(params.token);
        address stakingPool = params.addressProvider.getAddress(params.addressProvider.ID_GOVERNANCE_STAKING());
        if (stakingPool == address(0)) return;

        bool dexSuccess = false;
        uint256 virajeObtained = 0;

        // 1. DEX Swap Route
        if (params.swapRouter != address(0)) {
            try IOracleHub(params.addressProvider.getOracleHub()).getPriceBase18(virajeTokenAddr) returns (
                uint256 virajePrice18
            ) {
                uint256 currentNav = ITreasury(params.treasuryContract).getNAVPerShare();
                if (virajePrice18 > 0 && virajePrice18 <= currentNav) {
                    uint256 expectedViraje = (altsUsdc * 10 ** 30) / virajePrice18;
                    uint256 minViraje = (expectedViraje * (10000 - params.slippageToleranceBps)) / 10000;

                    params.vault.approveFunds(params.redemptionToken, params.swapRouter, altsUsdc);

                    try ISwapRouter(params.swapRouter)
                        .exactInputSingle(
                            ISwapRouter.ExactInputSingleParams(
                                params.redemptionToken,
                                virajeTokenAddr,
                                3000,
                                params.treasuryContract,
                                block.timestamp + 15 minutes,
                                altsUsdc,
                                minViraje,
                                0
                            )
                        ) returns (
                        uint256 amountOut
                    ) {
                        if (amountOut >= minViraje) {
                            dexSuccess = true;
                            virajeObtained = amountOut;
                        }
                    } catch {
                        // DEX swap failed, fall back to NAV mint
                    }

                    if (!dexSuccess) {
                        params.vault.approveFunds(params.redemptionToken, params.swapRouter, 0);
                        emit SwapRebalanceFailed(virajeTokenAddr, altsUsdc);
                    }
                }
            } catch {
                // Oracle query failed, fall back to NAV mint
            }
        }

        // Never mint unbacked VIRAJE when DEX swap is unavailable; retain USDC in VirajeVault.

        // 2. Auto-stake into GovernanceStaking for Treasury POL only if real VIRAJE was obtained via swap
        if (virajeObtained > 0) {
            params.token.approve(stakingPool, virajeObtained);
            try IGovernanceStakingRebalance(stakingPool).stake(virajeObtained) {
                // Auto-staked successfully
            } catch {
                // Keep unstaked in treasury custody if staking pool reverts: transfer to VirajeVault
                if (address(params.vault) != address(0)) {
                    IERC20(address(params.token)).safeTransfer(address(params.vault), virajeObtained);
                }
            }
        }
    }
}
