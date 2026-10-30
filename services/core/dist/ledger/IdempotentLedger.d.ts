import { type ILedgerStorageDriver } from './PersistentLedgerStorage.js';
export interface LedgerEntryData {
    accountCode: string;
    debit: string;
    credit: string;
    assetAddress: string;
}
export interface LedgerTransactionPayload {
    description: string;
    referenceType: string;
    referenceId: string;
    txHash: string;
    logIndex: number;
    blockNumber?: string;
    status?: 'CANONICAL' | 'ORPHANED';
    entries: LedgerEntryData[];
}
export interface LedgerRecordResult {
    idempotencyKey: string;
    isDuplicate: boolean;
    totalDebits: number;
    totalCredits: number;
    recordedAt: number;
    entriesCount: number;
}
export declare class IdempotentLedgerEngine {
    private storage;
    constructor(storageDriver?: ILedgerStorageDriver);
    /**
     * Generates a deterministic idempotency key for a blockchain log event
     */
    generateIdempotencyKey(txHash: string, logIndex: number, referenceType: string): string;
    /**
     * Validates double-entry accounting equilibrium: Sum(Debits) === Sum(Credits) strictly per asset
     */
    validateEquilibrium(entries: LedgerEntryData[]): {
        isValid: boolean;
        totalDebits: number;
        totalCredits: number;
        deviation: number;
    };
    /**
     * Records a ledger transaction with idempotency and balance enforcement
     */
    recordTransaction(payload: LedgerTransactionPayload): Promise<LedgerRecordResult>;
    /**
     * Rollback for reorgs: marks transactions from orphaned blocks as ORPHANED and computes reverted amounts atomically
     */
    rollbackOrphanedBlockRange(fromBlock: bigint, toBlock: bigint): Promise<{
        orphanedCount: number;
        revertedDebits: number;
        revertedCredits: number;
    }>;
    /**
     * Computes the net balance of an account considering ONLY CANONICAL (non-orphaned) entries using exact 18-decimal integer arithmetic
     */
    getCanonicalAccountBalanceBigInt(accountCode: string): Promise<bigint>;
    getCanonicalAccountBalance(accountCode: string): Promise<number>;
    /**
     * Creates balanced entries for Treasury Deposit
     */
    static buildDepositEntries(user: string, grossUsdc: number, dynamicFee: number, netUsdc: number): LedgerEntryData[];
    /**
     * Creates balanced entries for Staking with 1% Entry Fee (50% burn, 50% community vault)
     */
    static buildStakingEntries(user: string, grossAlpha: number): LedgerEntryData[];
    getTotalProcessedTransactions(): Promise<number>;
}
