"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockIndexerService = void 0;
const viem_1 = require("viem");
const strings_js_1 = require("../constants/strings.js");
class BlockIndexerService {
    config;
    client;
    lastIndexedBlock;
    confirmationBlocks;
    batchSize;
    isRunning = false;
    handlers = new Map();
    pollingTimer;
    storageDriver;
    ledgerEngine;
    indexedEvents = new Map();
    constructor(config, clientOverride, storageDriver, ledgerEngine) {
        this.config = config;
        this.client = clientOverride || (0, viem_1.createPublicClient)({
            transport: (0, viem_1.http)(config.rpcUrl)
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
            }).catch(() => { });
        }
    }
    registerHandler(eventName, handler) {
        const list = this.handlers.get(eventName) || [];
        list.push(handler);
        this.handlers.set(eventName, list);
    }
    getLastIndexedBlock() {
        return this.lastIndexedBlock;
    }
    setLastIndexedBlock(block) {
        this.lastIndexedBlock = block;
        if (this.storageDriver) {
            this.storageDriver.saveCheckpoint('lastIndexedBlock', block.toString()).catch(() => { });
        }
    }
    /**
     * Tracks and validates block headers to detect blockchain reorganizations (Reorgs)
     */
    async trackBlockHeader(blockNumber, blockHash, parentHash) {
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
    async handleReorgRollback(fromBlock, toBlock) {
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
    async indexNextBatch(maxTargetBlock) {
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
                }
                catch (err) {
                    console.error(strings_js_1.BACKEND_STRINGS.INDEXER.HANDLER_ERROR(event.eventName, event.transactionHash), err);
                }
            }
        }
        this.setLastIndexedBlock(toBlock);
        return { fromBlock, toBlock, eventsCount: events.length };
    }
    /**
     * Fetches raw logs across protocol events for a specific block range
     */
    async fetchLogsForRange(fromBlock, toBlock) {
        const eventsToQuery = [
            (0, viem_1.parseAbiItem)('event Deposited(address indexed user, uint256 stableAmount, uint256 sharesMinted, uint256 feePaid)'),
            (0, viem_1.parseAbiItem)('event Redeemed(address indexed user, uint256 sharesAmount, uint256 usdcReturned)'),
            (0, viem_1.parseAbiItem)('event BondPurchased(address indexed buyer, uint256 indexed tokenId, uint256 principalAmount, uint256 discountedPricePaid, uint256 lockYears, address referrer)'),
            (0, viem_1.parseAbiItem)('event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 interestRateBps, uint256 durationDays, uint256 positionTokenId, uint256 collateralAmount)'),
            (0, viem_1.parseAbiItem)('event LoanAccepted(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256 amount)'),
            (0, viem_1.parseAbiItem)('event LoanRepaid(uint256 indexed loanId, uint256 totalRepaid)'),
            (0, viem_1.parseAbiItem)('event Staked(address indexed user, uint256 amount)'),
            (0, viem_1.parseAbiItem)('event Unstaked(address indexed user, uint256 amount)'),
            (0, viem_1.parseAbiItem)('event CircuitTriggered(address indexed asset, uint256 oldPrice, uint256 newPrice)')
        ];
        const results = [];
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
            }
            catch (e) {
                console.debug(strings_js_1.BACKEND_STRINGS.INDEXER.LOGS_QUERY_NOTE(eventAbi.name, e.message || e));
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
    parseLogToDomainEvent(log, eventName) {
        if (!log.transactionHash || log.blockNumber === null || log.logIndex === null)
            return null;
        return {
            id: `${log.transactionHash}-${log.logIndex}`,
            eventName,
            contractAddress: log.address,
            blockNumber: log.blockNumber,
            blockHash: log.blockHash || undefined,
            transactionHash: log.transactionHash,
            logIndex: log.logIndex,
            status: 'CANONICAL',
            args: log.args || {},
            timestamp: Date.now()
        };
    }
    startPolling(intervalMs = 5000) {
        if (this.isRunning)
            return;
        this.isRunning = true;
        const poll = async () => {
            if (!this.isRunning)
                return;
            try {
                await this.indexNextBatch();
            }
            catch (err) {
                console.error(strings_js_1.BACKEND_STRINGS.INDEXER.POLLING_ERROR, err);
            }
            finally {
                if (this.isRunning) {
                    this.pollingTimer = setTimeout(poll, intervalMs);
                }
            }
        };
        poll();
    }
    stopPolling() {
        this.isRunning = false;
        if (this.pollingTimer) {
            clearTimeout(this.pollingTimer);
            this.pollingTimer = undefined;
        }
    }
}
exports.BlockIndexerService = BlockIndexerService;
//# sourceMappingURL=BlockIndexer.js.map