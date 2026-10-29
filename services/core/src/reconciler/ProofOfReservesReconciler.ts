import { BACKEND_STRINGS } from '../constants/strings.js';

export interface TokenQuantitiesSnapshot {
  usdcUnits: number;
  wbtcUnits: number;
  wethUnits: number;
  loanPrincipalUSDC: number;
}

export interface TokenQuantityReconciliationReport {
  isBalanced: boolean;
  usdcVariancePct: number;
  wbtcVariancePct: number;
  wethVariancePct: number;
  loansVariancePct: number;
  status: 'QUANTITY_MATCH' | 'QUANTITY_MISMATCH';
}

export interface OnChainReservesSnapshot {
  stablesUSD: number;
  wbtcUSD: number;
  wethUSD: number;
  activeLoansUSD: number;
  totalAssetsExogenousUSD: number;
  totalLiabilitiesUSD: number;
  collateralRatioBps: number;
  navPerShareUSD: number;
  tokenQuantities?: TokenQuantitiesSnapshot;
}

export interface OffChainLedgerSnapshot {
  treasuryStablesUSD: number;
  treasuryWbtcUSD: number;
  treasuryWethUSD: number;
  activeLoansLentUSD: number;
  totalLedgerAssetsUSD: number;
  tokenQuantities?: TokenQuantitiesSnapshot;
}

export interface PoRReconciliationReport {
  timestamp: number;
  isBalanced: boolean;
  varianceUSD: number;
  variancePct: number;
  tolerancePct: number;
  onChainTotalUSD: number;
  offChainTotalUSD: number;
  collateralRatioPct: number;
  status: 'SOLVENT_EXACT' | 'SOLVENT_ACCEPTABLE_VARIANCE' | 'DISCREPANCY_ALERT';
  discrepancyDetails?: {
    stablesDiffUSD: number;
    wbtcDiffUSD: number;
    wethDiffUSD: number;
    loansDiffUSD: number;
  };
}

export class ProofOfReservesReconciler {
  private tolerancePct: number;

  constructor(tolerancePct: number = 0.01) { // 0.01% default tolerance threshold
    this.tolerancePct = tolerancePct;
  }

  /**
   * Performs an audit comparison between on-chain PoR assets and internal ledger records
   */
  public reconcile(
    onChain: OnChainReservesSnapshot,
    offChain: OffChainLedgerSnapshot
  ): PoRReconciliationReport {
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

    let status: PoRReconciliationReport['status'] = BACKEND_STRINGS.RECONCILER.STATUS_DISCREPANCY_ALERT;
    if (varianceUSD === 0 || variancePct < 0.00001) {
      status = BACKEND_STRINGS.RECONCILER.STATUS_SOLVENT_EXACT;
    } else if (isBalanced) {
      status = BACKEND_STRINGS.RECONCILER.STATUS_SOLVENT_ACCEPTABLE_VARIANCE;
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
  public reconcileTokenQuantities(
    onChain: TokenQuantitiesSnapshot,
    offChain: TokenQuantitiesSnapshot
  ): TokenQuantityReconciliationReport {
    const calcVar = (a: number, b: number) => (a > 0 ? (Math.abs(a - b) / a) * 100 : b > 0 ? 100 : 0);
    const usdcVar = calcVar(onChain.usdcUnits, offChain.usdcUnits);
    const wbtcVar = calcVar(onChain.wbtcUnits, offChain.wbtcUnits);
    const wethVar = calcVar(onChain.wethUnits, offChain.wethUnits);
    const loansVar = calcVar(onChain.loanPrincipalUSDC, offChain.loanPrincipalUSDC);

    const isBalanced =
      usdcVar <= this.tolerancePct &&
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
