export interface LoanData {
    id: number;
    borrower: string;
    lender: string;
    positionTokenId?: number;
    collateralType?: 'nft' | 'alpha' | 'wbtc' | 'weth';
    collateralAmount?: string;
    collateralValueUSD?: number;
    borrowAmountUSD: number;
    interestRateAprPct: number;
    durationDays: number;
    startTimeSec: number;
    state: number;
}
export interface LoanEvaluation {
    loanId: number;
    borrower: string;
    canLiquidate: boolean;
    isExpired: boolean;
    isUnderCollateralized: boolean;
    healthFactor: number;
    reason?: string;
    totalDebtUSD: number;
    collateralValueUSD: number;
}
export interface LiquidationWatchdogReport {
    timestamp: number;
    totalActiveLoans: number;
    safeLoans: number;
    atRiskLoans: number;
    liquidatableCount: number;
    liquidatableLoans: LoanEvaluation[];
}
export interface IPrivateMempoolRelay {
    sendPrivateTransaction(rawTx: `0x${string}`): Promise<{
        txHash: string;
        isProtected: boolean;
    }>;
}
/**
 * Standard / Mock Relay for Devnet & local Anvil execution
 */
export declare class StandardRpcRelay implements IPrivateMempoolRelay {
    sendPrivateTransaction(rawTx: `0x${string}`): Promise<{
        txHash: string;
        isProtected: boolean;
    }>;
}
/**
 * Flashbots / MEV-Share Private Relay to neutralize front-running on Mainnet & L2s
 */
export declare class FlashbotsPrivateRelay implements IPrivateMempoolRelay {
    private relayEndpoint;
    constructor(relayEndpoint?: string);
    sendPrivateTransaction(rawTx: `0x${string}`): Promise<{
        txHash: string;
        isProtected: boolean;
    }>;
}
export declare class LiquidationWatchdogService {
    private minHealthFactorThreshold;
    private atRiskThreshold;
    private privateRelay;
    constructor(minHealthFactor?: number, relay?: IPrivateMempoolRelay);
    /**
     * Evaluates health and liquidation status for a single loan
     */
    evaluateLoan(loan: LoanData, assetPrices?: {
        wbtc: number;
        weth: number;
        alpha: number;
        usdc: number;
    }, currentTimestampSec?: number): LoanEvaluation;
    /**
     * Scans a batch of loans and produces a consolidated risk report
     */
    generateAuditReport(loans: LoanData[], assetPrices?: {
        wbtc: number;
        weth: number;
        alpha: number;
        usdc: number;
    }, currentTimestampSec?: number): LiquidationWatchdogReport;
    /**
     * Dispatches a liquidation transaction through MEV-protected private relay
     */
    dispatchMevProtectedLiquidation(loanId: number, rawTx: `0x${string}`): Promise<{
        loanId: number;
        txHash: string;
        isProtected: boolean;
    }>;
}
