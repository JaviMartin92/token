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
        if (vaultBal >= requiredUsdc) return;

        uint256 deficit = requiredUsdc - vaultBal;
        uint256 maxAdapters = activeYieldAdapters.length > 10 ? 10 : activeYieldAdapters.length;
        for (uint256 i = 0; i < maxAdapters && deficit > 0;) {
            deficit = _withdrawFromAdapter(activeYieldAdapters[i], vault, treasuryContract, deficit);
            unchecked {
                ++i;
            }
        }
    }

    function _withdrawFromAdapter(
        address adapter,
        AlphaVault vault,
        address treasuryContract,
        uint256 deficit
    ) private returns (uint256) {
        try IUniversalYieldAdapter(adapter).balanceOf(address(vault)) returns (uint256 vaultShares) {
            if (vaultShares == 0) return deficit;
            try IUniversalYieldAdapter(adapter).convertToAssets(vaultShares) returns (uint256 assets) {
                uint256 toWithdraw = (assets > deficit) ? deficit : assets;
                uint256 sharesNeeded = IUniversalYieldAdapter(adapter).convertToShares(toWithdraw);
                if (sharesNeeded > vaultShares) sharesNeeded = vaultShares;

                try vault.transferFunds(adapter, treasuryContract, sharesNeeded) {
                    IUniversalYieldAdapter(adapter).withdraw(toWithdraw, address(vault), treasuryContract);
                    return (toWithdraw > deficit) ? 0 : deficit - toWithdraw;
                } catch {
                    try IUniversalYieldAdapter(adapter).withdraw(toWithdraw, address(vault), address(vault)) {
                        return (toWithdraw > deficit) ? 0 : deficit - toWithdraw;
                    } catch {
                        return deficit;
                    }
                }
            } catch {
                return deficit;
            }
        } catch {
            return deficit;
        }
    }
}
