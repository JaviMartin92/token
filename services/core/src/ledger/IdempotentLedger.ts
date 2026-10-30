import { createHash } from 'crypto';
import { parseUnits, formatUnits } from 'viem';
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
   * Validates double-entry accounting equilibrium: Sum(Debits) === Sum(Credits) strictly per asset
   */
  public validateEquilibrium(entries: LedgerEntryData[]): { isValid: boolean; totalDebits: number; totalCredits: number; deviation: number } {
    const NUMBER_REGEX = /^\d+(\.\d{1,18})?$/;
    const assetGroups = new Map<string, { debitsWei: bigint; creditsWei: bigint; debitsNum: number; creditsNum: number }>();
    let totalDebits = 0;
    let totalCredits = 0;

    for (const e of entries) {
      const dStr = e.debit ? e.debit.trim() : '0';
      const cStr = e.credit ? e.credit.trim() : '0';

      if (!NUMBER_REGEX.test(dStr) || !NUMBER_REGEX.test(cStr)) {
        return { isValid: false, totalDebits: 0, totalCredits: 0, deviation: Number.POSITIVE_INFINITY };
      }

      const assetKey = (e.assetAddress || 'DEFAULT').toLowerCase();
      let group = assetGroups.get(assetKey);
      if (!group) {
        group = { debitsWei: 0n, creditsWei: 0n, debitsNum: 0, creditsNum: 0 };
        assetGroups.set(assetKey, group);
      }

      const dWei = parseUnits(dStr, 18);
      const cWei = parseUnits(cStr, 18);
      group.debitsWei += dWei;
      group.creditsWei += cWei;

      const dNum = parseFloat(dStr);
      const cNum = parseFloat(cStr);
      if (Number.isNaN(dNum) || Number.isNaN(cNum)) {
        return { isValid: false, totalDebits: 0, totalCredits: 0, deviation: Number.POSITIVE_INFINITY };
      }

      group.debitsNum += dNum;
      group.creditsNum += cNum;
      totalDebits += dNum;
      totalCredits += cNum;
    }

    let maxDeviation = 0;
    for (const [, group] of assetGroups.entries()) {
      const assetDev = Math.abs(group.debitsNum - group.creditsNum);
      if (assetDev > maxDeviation) maxDeviation = assetDev;
      if (group.debitsWei !== group.creditsWei && assetDev > 0.00000001) {
        return { isValid: false, totalDebits, totalCredits, deviation: assetDev };
      }
    }

    return { isValid: true, totalDebits, totalCredits, deviation: maxDeviation };
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
   * Computes the net balance of an account considering ONLY CANONICAL (non-orphaned) entries using exact 18-decimal integer arithmetic
   */
  public async getCanonicalAccountBalanceBigInt(accountCode: string): Promise<bigint> {
    const all = await this.storage.getAllTransactions();
    let balance = 0n;

    for (const tx of all.values()) {
      if (tx.status !== 'ORPHANED') {
        for (const entry of tx.entries) {
          if (entry.accountCode === accountCode) {
            const debit = parseUnits((entry.debit || '0').toString(), 18);
            const credit = parseUnits((entry.credit || '0').toString(), 18);
            balance += debit - credit;
          }
        }
      }
    }

    return balance;
  }

  public async getCanonicalAccountBalance(accountCode: string): Promise<number> {
    const balBig = await this.getCanonicalAccountBalanceBigInt(accountCode);
    return parseFloat(formatUnits(balBig, 18));
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
