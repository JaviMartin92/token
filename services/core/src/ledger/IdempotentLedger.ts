import { createHash } from 'crypto';
import { type ILedgerStorageDriver, InMemoryLedgerStorage } from './PersistentLedgerStorage.js';
import { BACKEND_STRINGS } from '../constants/strings.js';

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

export class IdempotentLedgerEngine {
  private storage: ILedgerStorageDriver;

  constructor(storageDriver?: ILedgerStorageDriver) {
    this.storage = storageDriver || new InMemoryLedgerStorage();
  }

  /**
   * Generates a deterministic idempotency key for a blockchain log event
   */
  public generateIdempotencyKey(txHash: string, logIndex: number, referenceType: string): string {
    return createHash('sha256')
      .update(`${txHash.toLowerCase()}:${logIndex}:${referenceType.toUpperCase()}`)
      .digest('hex');
  }

  /**
   * Validates double-entry accounting equilibrium: Sum(Debits) === Sum(Credits)
   */
  public validateEquilibrium(entries: LedgerEntryData[]): { isValid: boolean; totalDebits: number; totalCredits: number; deviation: number } {
    let totalDebits = 0;
    let totalCredits = 0;

    for (const e of entries) {
      totalDebits += parseFloat(e.debit || '0');
      totalCredits += parseFloat(e.credit || '0');
    }

    const deviation = Math.abs(totalDebits - totalCredits);
    const isValid = deviation < 0.00000001;

    return { isValid, totalDebits, totalCredits, deviation };
  }

  /**
   * Records a ledger transaction with idempotency and balance enforcement
   */
  public async recordTransaction(payload: LedgerTransactionPayload): Promise<LedgerRecordResult> {
    const idempotencyKey = this.generateIdempotencyKey(payload.txHash, payload.logIndex, payload.referenceType);
    if (!payload.status) {
      payload.status = 'CANONICAL';
    }

    // 1. Idempotency Check
    const exists = await this.storage.hasKey(idempotencyKey);
    if (exists) {
      const existing = await this.storage.getTransaction(idempotencyKey);
      const entries = existing ? existing.entries : payload.entries;
      const eq = this.validateEquilibrium(entries);
      return {
        idempotencyKey,
        isDuplicate: true,
        totalDebits: eq.totalDebits,
        totalCredits: eq.totalCredits,
        recordedAt: Date.now(),
        entriesCount: entries.length
      };
    }

    // 2. Equilibrium Validation
    const eq = this.validateEquilibrium(payload.entries);
    if (!eq.isValid) {
      throw new Error(
        BACKEND_STRINGS.LEDGER.ERR_DOUBLE_ENTRY_VIOLATION(eq.totalDebits, eq.totalCredits, eq.deviation)
      );
    }

    // 3. Commit to Storage Driver
    await this.storage.saveTransaction(idempotencyKey, payload);

    return {
      idempotencyKey,
      isDuplicate: false,
      totalDebits: eq.totalDebits,
      totalCredits: eq.totalCredits,
      recordedAt: Date.now(),
      entriesCount: payload.entries.length
    };
  }

  /**
   * Rollback for reorgs: marks transactions from orphaned blocks as ORPHANED and computes reverted amounts atomically
   */
  public async rollbackOrphanedBlockRange(fromBlock: bigint, toBlock: bigint): Promise<{ orphanedCount: number; revertedDebits: number; revertedCredits: number }> {
    const all = await this.storage.getAllTransactions();
    const keysToOrphan: string[] = [];
    let revertedDebits = 0;
    let revertedCredits = 0;

    for (const [key, tx] of all.entries()) {
      if (tx.blockNumber) {
        const bNum = BigInt(tx.blockNumber);
        if (bNum >= fromBlock && bNum <= toBlock && tx.status !== 'ORPHANED') {
          keysToOrphan.push(key);
          const eq = this.validateEquilibrium(tx.entries);
          revertedDebits += eq.totalDebits;
          revertedCredits += eq.totalCredits;
        }
      }
    }

    if (keysToOrphan.length > 0) {
      await this.storage.markTransactionsOrphaned(keysToOrphan);
    }

    return {
      orphanedCount: keysToOrphan.length,
      revertedDebits,
      revertedCredits
    };
  }

  /**
   * Computes the net balance of an account considering ONLY CANONICAL (non-orphaned) entries
   */
  public async getCanonicalAccountBalance(accountCode: string): Promise<number> {
    const all = await this.storage.getAllTransactions();
    let balance = 0;

    for (const tx of all.values()) {
      if (tx.status !== 'ORPHANED') {
        for (const entry of tx.entries) {
          if (entry.accountCode === accountCode) {
            balance += parseFloat(entry.debit || '0') - parseFloat(entry.credit || '0');
          }
        }
      }
    }

    return balance;
  }

  /**
   * Creates balanced entries for Treasury Deposit
   */
  public static buildDepositEntries(user: string, grossUsdc: number, dynamicFee: number, netUsdc: number): LedgerEntryData[] {
    const feeReserves = dynamicFee * 0.5;
    const feeCommunity = dynamicFee * 0.5;

    return [
      { accountCode: 'TREASURY_LIQUID_USDC', debit: netUsdc.toFixed(6), credit: '0.0', assetAddress: 'USDC' },
      { accountCode: 'TREASURY_FEE_RESERVES', debit: feeReserves.toFixed(6), credit: '0.0', assetAddress: 'USDC' },
      { accountCode: 'COMMUNITY_YIELD_VAULT', debit: feeCommunity.toFixed(6), credit: '0.0', assetAddress: 'USDC' },
      { accountCode: `USER_EQUITY_${user.slice(0, 8)}`, debit: '0.0', credit: grossUsdc.toFixed(6), assetAddress: 'USDC' }
    ];
  }

  /**
   * Creates balanced entries for Staking with 1% Entry Fee (50% burn, 50% community vault)
   */
  public static buildStakingEntries(user: string, grossAlpha: number): LedgerEntryData[] {
    const feeAlpha = grossAlpha * 0.01;
    const netStaked = grossAlpha * 0.99;
    const burnAlpha = feeAlpha * 0.5;
    const communityAlpha = feeAlpha * 0.5;

    return [
      { accountCode: 'GOVERNANCE_STAKING_POOL', debit: netStaked.toFixed(6), credit: '0.0', assetAddress: 'ALPHA' },
      { accountCode: 'DEAD_BURN_ADDRESS', debit: burnAlpha.toFixed(6), credit: '0.0', assetAddress: 'ALPHA' },
      { accountCode: 'COMMUNITY_YIELD_VAULT', debit: communityAlpha.toFixed(6), credit: '0.0', assetAddress: 'ALPHA' },
      { accountCode: `USER_WALLET_${user.slice(0, 8)}`, debit: '0.0', credit: grossAlpha.toFixed(6), assetAddress: 'ALPHA' }
    ];
  }

  public async getTotalProcessedTransactions(): Promise<number> {
    const all = await this.storage.getAllTransactions();
    return all.size;
  }
}
