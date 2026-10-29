import type { LedgerTransactionPayload } from './IdempotentLedger.js';
export interface BlockHeaderRecord {
    blockNumber: string;
    blockHash: string;
    parentHash: string;
    status: 'CANONICAL' | 'ORPHANED';
    indexedAt: number;
}
export interface ILedgerStorageDriver {
    hasKey(key: string): Promise<boolean>;
    saveTransaction(idempotencyKey: string, payload: LedgerTransactionPayload): Promise<void>;
    getTransaction(idempotencyKey: string): Promise<LedgerTransactionPayload | undefined>;
    getAllTransactions(): Promise<Map<string, LedgerTransactionPayload>>;
    markTransactionsOrphaned(keys: string[]): Promise<void>;
    saveBlockHeader(blockNumber: string, header: BlockHeaderRecord): Promise<void>;
    getBlockHeader(blockNumber: string): Promise<BlockHeaderRecord | undefined>;
    getAllBlockHeaders(): Promise<Map<string, BlockHeaderRecord>>;
    saveCheckpoint(key: string, value: string): Promise<void>;
    getCheckpoint(key: string): Promise<string | undefined>;
}
/**
 * In-memory storage driver for transient or test execution
 */
export declare class InMemoryLedgerStorage implements ILedgerStorageDriver {
    private auditLog;
    private blockHeaders;
    private checkpoints;
    hasKey(key: string): Promise<boolean>;
    saveTransaction(idempotencyKey: string, payload: LedgerTransactionPayload): Promise<void>;
    getTransaction(idempotencyKey: string): Promise<LedgerTransactionPayload | undefined>;
    getAllTransactions(): Promise<Map<string, LedgerTransactionPayload>>;
    markTransactionsOrphaned(keys: string[]): Promise<void>;
    saveBlockHeader(blockNumber: string, header: BlockHeaderRecord): Promise<void>;
    getBlockHeader(blockNumber: string): Promise<BlockHeaderRecord | undefined>;
    getAllBlockHeaders(): Promise<Map<string, BlockHeaderRecord>>;
    saveCheckpoint(key: string, value: string): Promise<void>;
    getCheckpoint(key: string): Promise<string | undefined>;
}
/**
 * Production-ready Atomic Persistent JSON Store with journaled disk synchronization
 */
export declare class JsonFilePersistentStorage implements ILedgerStorageDriver {
    private filePath;
    private checkpointsPath;
    private headersPath;
    private cache;
    private blockHeaders;
    private checkpoints;
    constructor(storageDir?: string);
    private loadFromDisk;
    private persistToDisk;
    private persistHeadersToDisk;
    private persistCheckpointsToDisk;
    hasKey(key: string): Promise<boolean>;
    saveTransaction(idempotencyKey: string, payload: LedgerTransactionPayload): Promise<void>;
    getTransaction(idempotencyKey: string): Promise<LedgerTransactionPayload | undefined>;
    getAllTransactions(): Promise<Map<string, LedgerTransactionPayload>>;
    markTransactionsOrphaned(keys: string[]): Promise<void>;
    saveBlockHeader(blockNumber: string, header: BlockHeaderRecord): Promise<void>;
    getBlockHeader(blockNumber: string): Promise<BlockHeaderRecord | undefined>;
    getAllBlockHeaders(): Promise<Map<string, BlockHeaderRecord>>;
    saveCheckpoint(key: string, value: string): Promise<void>;
    getCheckpoint(key: string): Promise<string | undefined>;
}
