import { type PublicClient } from 'viem';
import type { ILedgerStorageDriver } from '../ledger/PersistentLedgerStorage.js';
import type { IdempotentLedgerEngine } from '../ledger/IdempotentLedger.js';
export interface IndexerConfig {
    rpcUrl: string;
    startBlock?: bigint;
    confirmationBlocks?: number;
    batchSize?: number;
    contractAddresses?: {
        treasury?: `0x${string}`;
        vestedVault?: `0x${string}`;
        p2pMarket?: `0x${string}`;
        staking?: `0x${string}`;
        circuitBreaker?: `0x${string}`;
    };
}
export interface DomainBlockchainEvent {
    id: string;
    eventName: string;
    contractAddress: string;
    blockNumber: bigint;
    blockHash?: string;
    transactionHash: string;
    logIndex: number;
    status: 'CANONICAL' | 'ORPHANED';
    args: Record<string, any>;
    timestamp: number;
}
export type EventHandler = (event: DomainBlockchainEvent) => Promise<void>;
export declare class BlockIndexerService {
    private config;
    private client;
    private lastIndexedBlock;
    private confirmationBlocks;
    private batchSize;
    private isRunning;
    private handlers;
    private pollingTimer?;
    private storageDriver?;
    private ledgerEngine?;
    private indexedEvents;
    constructor(config: IndexerConfig, clientOverride?: PublicClient, storageDriver?: ILedgerStorageDriver, ledgerEngine?: IdempotentLedgerEngine);
    registerHandler(eventName: string, handler: EventHandler): void;
    getLastIndexedBlock(): bigint;
    setLastIndexedBlock(block: bigint): void;
    /**
     * Tracks and validates block headers to detect blockchain reorganizations (Reorgs)
     */
    trackBlockHeader(blockNumber: bigint, blockHash: string, parentHash: string): Promise<{
        isReorg: boolean;
        forkBlock?: bigint;
    }>;
    /**
     * Executes atomic rollback on orphaned blocks without blind DELETE:
     * Marks headers and events as ORPHANED and rolls back ledger balance accumulators in a single transaction.
     */
    handleReorgRollback(fromBlock: bigint, toBlock: bigint): Promise<{
        orphanedEventsCount: number;
        revertedDebits: number;
        revertedCredits: number;
    }>;
    /**
     * Indexes the next chunk of blocks up to safe target block (latest - confirmationBlocks)
     */
    indexNextBatch(maxTargetBlock?: bigint): Promise<{
        fromBlock: bigint;
        toBlock: bigint;
        eventsCount: number;
    }>;
    /**
     * Fetches raw logs across protocol events for a specific block range
     */
    fetchLogsForRange(fromBlock: bigint, toBlock: bigint): Promise<DomainBlockchainEvent[]>;
    private parseLogToDomainEvent;
    startPolling(intervalMs?: number): void;
    stopPolling(): void;
}
