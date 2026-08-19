import * as fs from 'fs';
import * as path from 'path';
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
export class InMemoryLedgerStorage implements ILedgerStorageDriver {
  private auditLog = new Map<string, LedgerTransactionPayload>();
  private blockHeaders = new Map<string, BlockHeaderRecord>();
  private checkpoints = new Map<string, string>();

  public async hasKey(key: string): Promise<boolean> {
    return this.auditLog.has(key);
  }

  public async saveTransaction(idempotencyKey: string, payload: LedgerTransactionPayload): Promise<void> {
    this.auditLog.set(idempotencyKey, payload);
  }

  public async getTransaction(idempotencyKey: string): Promise<LedgerTransactionPayload | undefined> {
    return this.auditLog.get(idempotencyKey);
  }

  public async getAllTransactions(): Promise<Map<string, LedgerTransactionPayload>> {
    return new Map(this.auditLog);
  }

  public async markTransactionsOrphaned(keys: string[]): Promise<void> {
    for (const k of keys) {
      const tx = this.auditLog.get(k);
      if (tx) {
        tx.status = 'ORPHANED';
        this.auditLog.set(k, tx);
      }
    }
  }

  public async saveBlockHeader(blockNumber: string, header: BlockHeaderRecord): Promise<void> {
    this.blockHeaders.set(blockNumber, header);
  }

  public async getBlockHeader(blockNumber: string): Promise<BlockHeaderRecord | undefined> {
    return this.blockHeaders.get(blockNumber);
  }

  public async getAllBlockHeaders(): Promise<Map<string, BlockHeaderRecord>> {
    return new Map(this.blockHeaders);
  }

  public async saveCheckpoint(key: string, value: string): Promise<void> {
    this.checkpoints.set(key, value);
  }

  public async getCheckpoint(key: string): Promise<string | undefined> {
    return this.checkpoints.get(key);
  }
}

/**
 * Production-ready Atomic Persistent JSON Store with journaled disk synchronization
 */
export class JsonFilePersistentStorage implements ILedgerStorageDriver {
  private filePath: string;
  private checkpointsPath: string;
  private headersPath: string;
  private cache = new Map<string, LedgerTransactionPayload>();
  private blockHeaders = new Map<string, BlockHeaderRecord>();
  private checkpoints = new Map<string, string>();

  constructor(storageDir: string = './.data') {
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    this.filePath = path.join(storageDir, 'ledger_journal.json');
    this.checkpointsPath = path.join(storageDir, 'indexer_checkpoints.json');
    this.headersPath = path.join(storageDir, 'block_headers.json');
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        for (const [k, v] of Object.entries(parsed)) {
          this.cache.set(k, v as LedgerTransactionPayload);
        }
      }
      if (fs.existsSync(this.checkpointsPath)) {
        const raw = fs.readFileSync(this.checkpointsPath, 'utf-8');
        const parsed = JSON.parse(raw);
        for (const [k, v] of Object.entries(parsed)) {
          this.checkpoints.set(k, String(v));
        }
      }
      if (fs.existsSync(this.headersPath)) {
        const raw = fs.readFileSync(this.headersPath, 'utf-8');
        const parsed = JSON.parse(raw);
        for (const [k, v] of Object.entries(parsed)) {
          this.blockHeaders.set(k, v as BlockHeaderRecord);
        }
      }
    } catch (err) {
      console.warn('[JsonFilePersistentStorage] Failed to read existing journal from disk, starting fresh:', err);
    }
  }

  private persistToDisk(): void {
    try {
      const obj: Record<string, LedgerTransactionPayload> = {};
      for (const [k, v] of this.cache.entries()) {
        obj[k] = v;
      }
      const tmpPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(obj, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.filePath);
    } catch (err) {
      console.error('[JsonFilePersistentStorage] Error persisting ledger journal to disk:', err);
    }
  }

  private persistHeadersToDisk(): void {
    try {
      const obj: Record<string, BlockHeaderRecord> = {};
      for (const [k, v] of this.blockHeaders.entries()) {
        obj[k] = v;
      }
      const tmpPath = `${this.headersPath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(obj, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.headersPath);
    } catch (err) {
      console.error('[JsonFilePersistentStorage] Error persisting headers to disk:', err);
    }
  }

  private persistCheckpointsToDisk(): void {
    try {
      const obj: Record<string, string> = {};
      for (const [k, v] of this.checkpoints.entries()) {
        obj[k] = v;
      }
      const tmpPath = `${this.checkpointsPath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(obj, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.checkpointsPath);
    } catch (err) {
      console.error('[JsonFilePersistentStorage] Error persisting checkpoints to disk:', err);
    }
  }

  public async hasKey(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  public async saveTransaction(idempotencyKey: string, payload: LedgerTransactionPayload): Promise<void> {
    this.cache.set(idempotencyKey, payload);
    this.persistToDisk();
  }

  public async getTransaction(idempotencyKey: string): Promise<LedgerTransactionPayload | undefined> {
    return this.cache.get(idempotencyKey);
  }

  public async getAllTransactions(): Promise<Map<string, LedgerTransactionPayload>> {
    return new Map(this.cache);
  }

  public async markTransactionsOrphaned(keys: string[]): Promise<void> {
    for (const k of keys) {
      const tx = this.cache.get(k);
      if (tx) {
        tx.status = 'ORPHANED';
        this.cache.set(k, tx);
      }
    }
    this.persistToDisk();
  }

  public async saveBlockHeader(blockNumber: string, header: BlockHeaderRecord): Promise<void> {
    this.blockHeaders.set(blockNumber, header);
    this.persistHeadersToDisk();
  }

  public async getBlockHeader(blockNumber: string): Promise<BlockHeaderRecord | undefined> {
    return this.blockHeaders.get(blockNumber);
  }

  public async getAllBlockHeaders(): Promise<Map<string, BlockHeaderRecord>> {
    return new Map(this.blockHeaders);
  }

  public async saveCheckpoint(key: string, value: string): Promise<void> {
    this.checkpoints.set(key, value);
    this.persistCheckpointsToDisk();
  }

  public async getCheckpoint(key: string): Promise<string | undefined> {
    return this.checkpoints.get(key);
  }
}
