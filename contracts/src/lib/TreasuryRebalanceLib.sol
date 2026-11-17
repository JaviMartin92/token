/* solhint-disable gas-struct-packing */
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
 * @author Viraje Protocol Architecture Team
 * @notice Internal library executing automatic DEX portfolio rebalancing and dynamic VIRAJE sub-reserve allocation.
 * @dev Enforces oracle-bounded slippage thresholds and isolates oracle or DEX failures to ensure user deposits never revert.
 * @custom:security-note Fault-Tolerant Rebalancing: Asset rebalancing swaps are strictly opportunistic.
 *                       If an oracle query reverts or a DEX pool lacks liquidity, the failure is caught,
 *                       approvals are reset to zero, and the funds remain safely in USDC within VirajeVault.
 * @custom:security-note Anti-MEV Protection: All swap transactions enforce strict minimum outputs calculated
 *                       from fresh Chainlink oracle reference prices adjusted by slippageToleranceBps.
 * @custom:security-note Zero Unbacked Minting: The protocol never mints unbacked VIRAJE shares for treasury reserves;
 *                       sub-reserves are acquired solely through market swaps when VIRAJE trades at or below NAV.
 */
library TreasuryRebalanceLib {
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10000;
    uint24 public constant UNISWAP_POOL_FEE_TIER = 3000; // 0.30% Uniswap V3 Pool Fee Tier
    uint256 public constant SWAP_DEADLINE_BUFFER = 15 minutes;

    struct RebalanceParams {
        ProtocolAddressProvider addressProvider;
        VirajeVault vault;
        VirajeToken token;
        address swapRouter;
        address wbtcToken;
        address wethToken;
        address redemptionToken;
        address treasuryContract;
        uint8 redemptionTokenDecimals;
        uint256 slippageToleranceBps;
        uint256 stableWeight;
        uint256 wbtcWeight;
        uint256 wethWeight;
        uint256 virajeWeight;
        uint256 netDeposited;
        uint256 totalNavUSD;
    }

    event SwapRebalanceFailed(address indexed tokenOut, uint256 amountIn);

    /**
     * @notice Executes automatic swap rebalancing into WBTC, WETH and allocates VIRAJE sub-reserves.
     * @param params Complete configuration and balance parameters for the rebalance transaction.
     */
    function executeRebalanceSwaps(RebalanceParams memory params) public {
        if (params.swapRouter != address(0)) {
            // 1. WBTC Rebalance Swap
            uint256 btcUsdc = (params.netDeposited * params.wbtcWeight) / BPS_DENOMINATOR;
            if (btcUsdc > 0 && params.wbtcToken != address(0)) {
                _executeTokenSwap(params, params.wbtcToken, btcUsdc, 10 ** 20);
            }

            // 2. WETH Rebalance Swap
            uint256 ethUsdc = (params.netDeposited * params.wethWeight) / BPS_DENOMINATOR;
            if (ethUsdc > 0 && params.wethToken != address(0)) {
                _executeTokenSwap(params, params.wethToken, ethUsdc, 10 ** 30);
            }
        }

        // 3. VIRAJE Dynamic Sub-Reserve Allocation
        uint256 altsUsdc = (params.netDeposited * params.virajeWeight) / BPS_DENOMINATOR;
        allocateVirajeReserve(params, altsUsdc);
    }

    function _executeTokenSwap(
        RebalanceParams memory params,
        address tokenOut,
        uint256 amountIn,
        uint256 scaleFactor
    ) private {
        address oracleHubAddr = params.addressProvider.getOracleHub();
        if (oracleHubAddr == address(0)) return;

        try IOracleHub(oracleHubAddr).getPriceBase18(tokenOut) returns (uint256 priceBase18) {
            if (priceBase18 == 0) return;

            uint256 expectedOut = (amountIn * scaleFactor) / priceBase18;
            uint256 minOut = (expectedOut * (BPS_DENOMINATOR - params.slippageToleranceBps)) / BPS_DENOMINATOR;

            params.vault.approveFunds(params.redemptionToken, params.swapRouter, amountIn);
            try ISwapRouter(params.swapRouter).exactInputSingle(
                ISwapRouter.ExactInputSingleParams(
                    params.redemptionToken,
                    tokenOut,
                    UNISWAP_POOL_FEE_TIER,
                    address(params.vault),
                    block.timestamp + SWAP_DEADLINE_BUFFER,
                    amountIn,
                    minOut,
                    0
                )
            ) returns (uint256) {
                // Swap completed successfully
            } catch {
                params.vault.approveFunds(params.redemptionToken, params.swapRouter, 0);
                emit SwapRebalanceFailed(tokenOut, amountIn);
            }
        } catch {
            emit SwapRebalanceFailed(tokenOut, amountIn);
        }
    }

    /**
     * @notice Dynamically allocates VIRAJE sub-reserve via DEX swap with automatic NAV Fallback mint + auto-staking.
     * @param params Complete configuration and balance parameters for the rebalance transaction.
     * @param altsUsdc Amount of USDC designated for the VIRAJE sub-reserve allocation.
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
                    uint256 minViraje = (expectedViraje * (BPS_DENOMINATOR - params.slippageToleranceBps)) / BPS_DENOMINATOR;

                    params.vault.approveFunds(params.redemptionToken, params.swapRouter, altsUsdc);

                    try ISwapRouter(params.swapRouter).exactInputSingle(
                        ISwapRouter.ExactInputSingleParams(
                            params.redemptionToken,
                            virajeTokenAddr,
                            UNISWAP_POOL_FEE_TIER,
                            params.treasuryContract,
                            block.timestamp + SWAP_DEADLINE_BUFFER,
                            altsUsdc,
                            minViraje,
                            0
                        )
                    ) returns (uint256 amountOut) {
                        if (amountOut >= minViraje) {
                            dexSuccess = true;
                            virajeObtained = amountOut;
                        }
                    } catch {
                        // DEX swap failed, retain USDC in vault
                    }

                    if (!dexSuccess) {
                        params.vault.approveFunds(params.redemptionToken, params.swapRouter, 0);
                        emit SwapRebalanceFailed(virajeTokenAddr, altsUsdc);
                    }
                }
            } catch {
                // Oracle query failed, retain USDC in vault
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
