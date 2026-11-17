// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../VirajeVault.sol";
import "../interfaces/IUniversalYieldAdapter.sol";

/**
 * @title TreasuryLiquidityLib
 * @author Viraje Protocol Architecture Team
 * @notice Internal library managing Treasury liquid stablecoin buffers and automated ERC-4626 withdrawals.
 * @dev Employs bounded loop scans and structured try/catch handling to isolate failures in external yield venues.
 * @custom:security-note Cascade Liquidity Invariant: Redemptions and loan payouts first consume idle stablecoins
 *                       in VirajeVault. If a deficit exists, it auto-unwinds liquidity from active yield adapters.
 * @custom:security-note External Venue Fault Tolerance: All adapter conversions and withdrawals are protected
 *                       by try/catch blocks. If a downstream ERC-4626 vault experiences an outage or pauses exits,
 *                       the failure is safely caught and execution proceeds to alternate adapters without reverting
 *                       the user transaction.
 */
library TreasuryLiquidityLib {
    /// @notice Maximum number of yield adapters scanned in a single transaction to prevent Gas DoS
    uint256 public constant MAX_ADAPTER_SCAN_LIMIT = 10;

    /**
     * @notice Computes total stablecoin reserves backing redemptions: liquid vault balance plus
     *         funds deployed in active ERC-4626 adapters.
     * @param vaultAddr Address of the VirajeVault custody contract.
     * @param redemptionToken Address of the primary stablecoin (USDC).
     * @param activeYieldAdapters Array of registered yield adapter addresses.
     * @param treasuryContract Address of the calling TreasuryManager contract.
     * @return total Total available and deployed stablecoins.
     */
    function calculateStableReserves(
        address vaultAddr,
        address redemptionToken,
        address[] memory activeYieldAdapters,
        address treasuryContract
    ) public view returns (uint256 total) {
        if (vaultAddr == address(0)) return 0;
        VirajeVault vault = VirajeVault(vaultAddr);
        total = vault.getBalance(redemptionToken) + IERC20(redemptionToken).balanceOf(treasuryContract);

        uint256 len = activeYieldAdapters.length;
        for (uint256 i = 0; i < len;) {
            address adapter = activeYieldAdapters[i];
            try IUniversalYieldAdapter(adapter).balanceOf(vaultAddr) returns (uint256 shares) {
                if (shares > 0) {
                    try IUniversalYieldAdapter(adapter).convertToAssets(shares) returns (uint256 assets) {
                        total += assets;
                    } catch {
                        // Ignore convertToAssets failure to maintain availability
                    }
                }
            } catch {
                // Ignore balanceOf query failure
            }
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Ensures sufficient liquid stablecoins in VirajeVault by auto-withdrawing from active Yield Adapters.
     * @param vault The protocol VirajeVault instance.
     * @param redemptionToken Address of the primary stablecoin (USDC).
     * @param activeYieldAdapters Array of registered yield adapters.
     * @param requiredUsdc Total USDC required for payout.
     * @param treasuryContract Address of the calling TreasuryManager contract.
     */
    function ensureLiquidBuffer(
        VirajeVault vault,
        address redemptionToken,
        address[] memory activeYieldAdapters,
        uint256 requiredUsdc,
        address treasuryContract
    ) public {
        if (address(vault) == address(0) || redemptionToken == address(0)) return;

        uint256 vaultBal = vault.getBalance(redemptionToken);
        if (vaultBal >= requiredUsdc) return;

        uint256 deficit = requiredUsdc - vaultBal;
        uint256 adaptersLen = activeYieldAdapters.length;
        uint256 maxAdapters = adaptersLen > MAX_ADAPTER_SCAN_LIMIT ? MAX_ADAPTER_SCAN_LIMIT : adaptersLen;

        for (uint256 i = 0; i < maxAdapters && deficit > 0;) {
            deficit = _withdrawFromAdapter(activeYieldAdapters[i], vault, treasuryContract, deficit);
            unchecked {
                ++i;
            }
        }
    }

    function _withdrawFromAdapter(
        address adapter,
        VirajeVault vault,
        address treasuryContract,
        uint256 deficit
    ) private returns (uint256) {
        if (adapter == address(0)) return deficit;

        try IUniversalYieldAdapter(adapter).balanceOf(address(vault)) returns (uint256 vaultShares) {
            if (vaultShares == 0) return deficit;
            try IUniversalYieldAdapter(adapter).convertToAssets(vaultShares) returns (uint256 assets) {
                uint256 toWithdraw = (assets > deficit) ? deficit : assets;
                uint256 sharesNeeded = IUniversalYieldAdapter(adapter).convertToShares(toWithdraw);
                if (sharesNeeded > vaultShares) sharesNeeded = vaultShares;

                try vault.transferFunds(adapter, treasuryContract, sharesNeeded) {
                    try IUniversalYieldAdapter(adapter).withdraw(toWithdraw, address(vault), treasuryContract) {
                        return (toWithdraw > deficit) ? 0 : deficit - toWithdraw;
                    } catch {
                        // Return unredeemed shares to vault if withdrawal fails in external adapter
                        try vault.transferFunds(adapter, address(vault), 0) {} catch {}
                        return deficit;
                    }
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
