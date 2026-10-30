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
export declare class ProofOfReservesReconciler {
    private tolerancePct;
    constructor(tolerancePct?: number);
    /**
     * Performs an audit comparison between on-chain PoR assets and internal ledger records
     */
    reconcile(onChain: OnChainReservesSnapshot, offChain: OffChainLedgerSnapshot): PoRReconciliationReport;
    /**
     * Reconciles token-for-token and share-for-share native quantities
     * independently of volatile USD market prices (M-06 fix).
     */
    reconcileTokenQuantities(onChain: TokenQuantitiesSnapshot, offChain: TokenQuantitiesSnapshot): TokenQuantityReconciliationReport;
}
