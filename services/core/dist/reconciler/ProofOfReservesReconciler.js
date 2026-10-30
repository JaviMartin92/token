"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProofOfReservesReconciler = void 0;
const strings_js_1 = require("../constants/strings.js");
class ProofOfReservesReconciler {
    tolerancePct;
    constructor(tolerancePct = 0.01) {
        this.tolerancePct = tolerancePct;
    }
    /**
     * Performs an audit comparison between on-chain PoR assets and internal ledger records
     */
    reconcile(onChain, offChain) {
        const onChainTotal = onChain.totalAssetsExogenousUSD;
        const offChainTotal = offChain.totalLedgerAssetsUSD;
        const varianceUSD = Math.abs(onChainTotal - offChainTotal);
        const variancePct = onChainTotal > 0 ? (varianceUSD / onChainTotal) * 100 : 0;
        const stablesDiffUSD = Math.abs(onChain.stablesUSD - offChain.treasuryStablesUSD);
        const wbtcDiffUSD = Math.abs(onChain.wbtcUSD - offChain.treasuryWbtcUSD);
        const wethDiffUSD = Math.abs(onChain.wethUSD - offChain.treasuryWethUSD);
        const loansDiffUSD = Math.abs(onChain.activeLoansUSD - offChain.activeLoansLentUSD);
        const isBalanced = variancePct <= this.tolerancePct;
        const collateralRatioPct = (onChain.collateralRatioBps / 100);
        let status = strings_js_1.BACKEND_STRINGS.RECONCILER.STATUS_DISCREPANCY_ALERT;
        if (varianceUSD === 0 || variancePct < 0.00001) {
            status = strings_js_1.BACKEND_STRINGS.RECONCILER.STATUS_SOLVENT_EXACT;
        }
        else if (isBalanced) {
            status = strings_js_1.BACKEND_STRINGS.RECONCILER.STATUS_SOLVENT_ACCEPTABLE_VARIANCE;
        }
        return {
            timestamp: Date.now(),
            isBalanced,
            varianceUSD,
            variancePct,
            tolerancePct: this.tolerancePct,
            onChainTotalUSD: onChainTotal,
            offChainTotalUSD: offChainTotal,
            collateralRatioPct,
            status,
            discrepancyDetails: {
                stablesDiffUSD,
                wbtcDiffUSD,
                wethDiffUSD,
                loansDiffUSD
            }
        };
    }
    /**
     * Reconciles token-for-token and share-for-share native quantities
     * independently of volatile USD market prices (M-06 fix).
     */
    reconcileTokenQuantities(onChain, offChain) {
        const calcVar = (a, b) => (a > 0 ? (Math.abs(a - b) / a) * 100 : b > 0 ? 100 : 0);
        const usdcVar = calcVar(onChain.usdcUnits, offChain.usdcUnits);
        const wbtcVar = calcVar(onChain.wbtcUnits, offChain.wbtcUnits);
        const wethVar = calcVar(onChain.wethUnits, offChain.wethUnits);
        const loansVar = calcVar(onChain.loanPrincipalUSDC, offChain.loanPrincipalUSDC);
        const isBalanced = usdcVar <= this.tolerancePct &&
            wbtcVar <= this.tolerancePct &&
            wethVar <= this.tolerancePct &&
            loansVar <= this.tolerancePct;
        return {
            isBalanced,
            usdcVariancePct: usdcVar,
            wbtcVariancePct: wbtcVar,
            wethVariancePct: wethVar,
            loansVariancePct: loansVar,
            status: isBalanced ? 'QUANTITY_MATCH' : 'QUANTITY_MISMATCH'
        };
    }
}
exports.ProofOfReservesReconciler = ProofOfReservesReconciler;
//# sourceMappingURL=ProofOfReservesReconciler.js.map