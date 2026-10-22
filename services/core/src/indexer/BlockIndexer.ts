import { createPublicClient, http, parseAbiItem, type PublicClient, type Log } from 'viem';
import type { ILedgerStorageDriver, BlockHeaderRecord } from '../ledger/PersistentLedgerStorage.js';
import type { IdempotentLedgerEngine } from '../ledger/IdempotentLedger.js';
import { BACKEND_STRINGS } from '../constants/strings.js';

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

export class BlockIndexerService {
  private client: PublicClient;
  private lastIndexedBlock: bigint;
  private confirmationBlocks: number;
  private batchSize: number;
  private isRunning: boolean = false;
  private handlers: Map<string, EventHandler[]> = new Map();
  private pollingTimer?: NodeJS.Timeout;
  private storageDriver?: ILedgerStorageDriver;
  private ledgerEngine?: IdempotentLedgerEngine;
  private indexedEvents = new Map<string, DomainBlockchainEvent>();

  constructor(
    private config: IndexerConfig,
    clientOverride?: PublicClient,
    storageDriver?: ILedgerStorageDriver,
    ledgerEngine?: IdempotentLedgerEngine
  ) {
    this.client = clientOverride || createPublicClient({
      transport: http(config.rpcUrl)
    });
    this.lastIndexedBlock = config.startBlock ?? 0n;
    this.confirmationBlocks = config.confirmationBlocks ?? 3;
    this.batchSize = config.batchSize ?? 1000;
    this.storageDriver = storageDriver;
    this.ledgerEngine = ledgerEngine;

    // Async hydration from persistent checkpoint if available
    if (this.storageDriver && config.startBlock === undefined) {
      this.storageDriver.getCheckpoint('lastIndexedBlock').then(cp => {
        if (cp) {
          this.lastIndexedBlock = BigInt(cp);
        }
      }).catch(() => {});
    }
  }

  public registerHandler(eventName: string, handler: EventHandler): void {
    const list = this.handlers.get(eventName) || [];
    list.push(handler);
    this.handlers.set(eventName, list);
  }

  public getLastIndexedBlock(): bigint {
    return this.lastIndexedBlock;
  }

  public setLastIndexedBlock(block: bigint): void {
    this.lastIndexedBlock = block;
    if (this.storageDriver) {
      this.storageDriver.saveCheckpoint('lastIndexedBlock', block.toString()).catch(() => {});
    }
  }

  /**
   * Tracks and validates block headers to detect blockchain reorganizations (Reorgs)
   */
  public async trackBlockHeader(blockNumber: bigint, blockHash: string, parentHash: string): Promise<{ isReorg: boolean; forkBlock?: bigint }> {
    if (this.storageDriver && blockNumber > 1n) {
      const prevBlock = await this.storageDriver.getBlockHeader((blockNumber - 1n).toString());
      if (prevBlock && prevBlock.status === 'CANONICAL' && prevBlock.blockHash !== parentHash) {
        // Parent hash mismatch: a reorganization occurred at or before this block height
        return { isReorg: true, forkBlock: blockNumber - 1n };
      }

      await this.storageDriver.saveBlockHeader(blockNumber.toString(), {
        blockNumber: blockNumber.toString(),
        blockHash,
        parentHash,
        status: 'CANONICAL',
        indexedAt: Date.now()
      });
    }

    return { isReorg: false };
  }

  /**
   * Executes atomic rollback on orphaned blocks without blind DELETE:
   * Marks headers and events as ORPHANED and rolls back ledger balance accumulators in a single transaction.
   */
  public async handleReorgRollback(fromBlock: bigint, toBlock: bigint): Promise<{ orphanedEventsCount: number; revertedDebits: number; revertedCredits: number }> {
    // 1. Mark in-memory events as ORPHANED
    let orphanedEventsCount = 0;
    for (const event of this.indexedEvents.values()) {
      if (event.blockNumber >= fromBlock && event.blockNumber <= toBlock && event.status !== 'ORPHANED') {
        event.status = 'ORPHANED';
        orphanedEventsCount++;
      }
    }

    // 2. Mark storage block headers as ORPHANED
    if (this.storageDriver) {
      for (let b = fromBlock; b <= toBlock; b++) {
        const header = await this.storageDriver.getBlockHeader(b.toString());
        if (header) {
          header.status = 'ORPHANED';
          await this.storageDriver.saveBlockHeader(b.toString(), header);
        }
      }
    }

    // 3. Atomically reverse ledger accumulators
    let revertedDebits = 0;
    let revertedCredits = 0;
    if (this.ledgerEngine) {
      const res = await this.ledgerEngine.rollbackOrphanedBlockRange(fromBlock, toBlock);
      revertedDebits = res.revertedDebits;
      revertedCredits = res.revertedCredits;
    }

    // 4. Rewind indexer cursor to pre-fork safe ancestor
    const safeAncestor = fromBlock > 1n ? fromBlock - 1n : 0n;
    this.setLastIndexedBlock(safeAncestor);

    return {
      orphanedEventsCount,
      revertedDebits,
      revertedCredits
    };
  }

  /**
   * Indexes the next chunk of blocks up to safe target block (latest - confirmationBlocks)
   */
  public async indexNextBatch(maxTargetBlock?: bigint): Promise<{ fromBlock: bigint; toBlock: bigint; eventsCount: number }> {
    const latestBlock = maxTargetBlock ?? await this.client.getBlockNumber();
    const safeLatestBlock = latestBlock > BigInt(this.confirmationBlocks) 
      ? latestBlock - BigInt(this.confirmationBlocks) 
      : latestBlock;

    if (this.lastIndexedBlock >= safeLatestBlock) {
      return { fromBlock: this.lastIndexedBlock, toBlock: this.lastIndexedBlock, eventsCount: 0 };
    }

    const fromBlock = this.lastIndexedBlock + 1n;
    const toBlock = fromBlock + BigInt(this.batchSize) - 1n > safeLatestBlock 
      ? safeLatestBlock 
      : fromBlock + BigInt(this.batchSize) - 1n;

    const events = await this.fetchLogsForRange(fromBlock, toBlock);

    for (const event of events) {
      this.indexedEvents.set(event.id, event);
      const handlers = this.handlers.get(event.eventName) || [];
      const wildcardHandlers = this.handlers.get('*') || [];
      const allHandlers = [...handlers, ...wildcardHandlers];

      for (const handler of allHandlers) {
        try {
          await handler(event);
        } catch (err) {
          console.error(BACKEND_STRINGS.INDEXER.HANDLER_ERROR(event.eventName, event.transactionHash), err);
        }
      }
    }

    this.setLastIndexedBlock(toBlock);
    return { fromBlock, toBlock, eventsCount: events.length };
  }

  /**
   * Fetches raw logs across protocol events for a specific block range
   */
  public async fetchLogsForRange(fromBlock: bigint, toBlock: bigint): Promise<DomainBlockchainEvent[]> {
    const eventsToQuery = [
      parseAbiItem('event SharesMinted(address indexed user, uint256 stableAmount, uint256 sharesMinted)'),
      parseAbiItem('event SharesRedeemed(address indexed user, uint256 sharesAmount, uint256 assetsReceived)'),
      parseAbiItem('event VestedBondPurchased(uint256 indexed tokenId, address indexed buyer, uint256 principal, uint256 lockYears)'),
      parseAbiItem('event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 borrowAmount)'),
      parseAbiItem('event LoanFunded(uint256 indexed loanId, address indexed lender)'),
      parseAbiItem('event LoanRepaid(uint256 indexed loanId)'),
      parseAbiItem('event Staked(address indexed user, uint256 amount)'),
      parseAbiItem('event Unstaked(address indexed user, uint256 amount)'),
      parseAbiItem('event BreakerTriggered(address indexed asset, uint256 dropPercentage)')
    ];

    const results: DomainBlockchainEvent[] = [];

    for (const eventAbi of eventsToQuery) {
      try {
        const logs = await this.client.getLogs({
          event: eventAbi,
          fromBlock,
          toBlock
        });

        for (const log of logs) {
          const parsed = this.parseLogToDomainEvent(log, eventAbi.name);
          if (parsed) {
            results.push(parsed);
          }
        }
      } catch (e: any) {
        console.debug(BACKEND_STRINGS.INDEXER.LOGS_QUERY_NOTE(eventAbi.name, e.message || e));
      }
    }

    // Sort deterministically by blockNumber and logIndex
    results.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return a.blockNumber < b.blockNumber ? -1 : 1;
      }
      return a.logIndex - b.logIndex;
    });

    return results;
  }

  private parseLogToDomainEvent(log: Log, eventName: string): DomainBlockchainEvent | null {
    if (!log.transactionHash || log.blockNumber === null || log.logIndex === null) return null;

    return {
      id: `${log.transactionHash}-${log.logIndex}`,
      eventName,
      contractAddress: log.address,
      blockNumber: log.blockNumber,
      blockHash: log.blockHash || undefined,
      transactionHash: log.transactionHash,
      logIndex: log.logIndex,
      status: 'CANONICAL',
      args: (log as any).args || {},
      timestamp: Date.now()
    };
  }

  public startPolling(intervalMs: number = 5000): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const poll = async () => {
      if (!this.isRunning) return;
      try {
        await this.indexNextBatch();
      } catch (err) {
        console.error(BACKEND_STRINGS.INDEXER.POLLING_ERROR, err);
      } finally {
        if (this.isRunning) {
          this.pollingTimer = setTimeout(poll, intervalMs);
        }
      }
    };

    poll();
  }

  public stopPolling(): void {
    this.isRunning = false;
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = undefined;
    }
  }
}
