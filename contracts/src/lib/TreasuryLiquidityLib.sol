// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../AlphaVault.sol";
import "../interfaces/IUniversalYieldAdapter.sol";

/**
 * @title TreasuryLiquidityLib
 * @notice Internal library managing Treasury liquid stablecoin buffers and ERC-4626 withdrawals.
 */
library TreasuryLiquidityLib {
    /**
     * @notice Ensures sufficient liquid stablecoins in AlphaVault by auto-withdrawing from active Yield Adapters.
     * @param vault The protocol AlphaVault instance.
     * @param redemptionToken Address of the primary stablecoin (USDC).
     * @param activeYieldAdapters Array of registered yield adapters.
     * @param requiredUsdc Total USDC required for payout.
     * @param treasuryContract Address of the calling TreasuryManager contract.
     */
    function ensureLiquidBuffer(
        AlphaVault vault,
        address redemptionToken,
        address[] memory activeYieldAdapters,
        uint256 requiredUsdc,
        address treasuryContract
    ) internal {
        uint256 vaultBal = vault.getBalance(redemptionToken);
        if (vaultBal < requiredUsdc) {
            uint256 deficit = requiredUsdc - vaultBal;

            for (uint256 i = 0; i < activeYieldAdapters.length && deficit > 0;) {
                address adapter = activeYieldAdapters[i];
                try IUniversalYieldAdapter(adapter).balanceOf(address(vault)) returns (uint256 shares) {
                    if (shares > 0) {
                        try IUniversalYieldAdapter(adapter).convertToAssets(shares) returns (uint256 assets) {
                            uint256 toWithdraw = (assets > deficit) ? deficit : assets;

                            try vault.transferFunds(
                                adapter, treasuryContract, IUniversalYieldAdapter(adapter).convertToShares(toWithdraw)
                            ) {
                                IUniversalYieldAdapter(adapter).withdraw(toWithdraw, address(vault), treasuryContract);
                                deficit = (toWithdraw > deficit) ? 0 : deficit - toWithdraw;
                            } catch {
                                // Ignore transfer failure to next adapter
                            }
                        } catch {
                            // Ignore conversion revert
                        }
                    }
                } catch {
                    // Ignore query revert on adapter
                }
                unchecked {
                    ++i;
                }
            }
        }
    }
}
