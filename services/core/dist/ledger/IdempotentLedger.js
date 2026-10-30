"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdempotentLedgerEngine = void 0;
const crypto_1 = require("crypto");
const viem_1 = require("viem");
const PersistentLedgerStorage_js_1 = require("./PersistentLedgerStorage.js");
const strings_js_1 = require("../constants/strings.js");
class IdempotentLedgerEngine {
    storage;
    constructor(storageDriver) {
        this.storage = storageDriver || new PersistentLedgerStorage_js_1.InMemoryLedgerStorage();
    }
    /**
     * Generates a deterministic idempotency key for a blockchain log event
     */
    generateIdempotencyKey(txHash, logIndex, referenceType) {
        return (0, crypto_1.createHash)('sha256')
            .update(`${txHash.toLowerCase()}:${logIndex}:${referenceType.toUpperCase()}`)
            .digest('hex');
    }
    /**
     * Validates double-entry accounting equilibrium: Sum(Debits) === Sum(Credits) strictly per asset
     */
    validateEquilibrium(entries) {
        const NUMBER_REGEX = /^\d+(\.\d{1,18})?$/;
        const assetGroups = new Map();
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
            const dWei = (0, viem_1.parseUnits)(dStr, 18);
            const cWei = (0, viem_1.parseUnits)(cStr, 18);
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
            if (assetDev > maxDeviation)
                maxDeviation = assetDev;
            if (group.debitsWei !== group.creditsWei && assetDev > 0.00000001) {
                return { isValid: false, totalDebits, totalCredits, deviation: assetDev };
            }
        }
        return { isValid: true, totalDebits, totalCredits, deviation: maxDeviation };
    }
    /**
     * Records a ledger transaction with idempotency and balance enforcement
     */
    async recordTransaction(payload) {
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
            throw new Error(strings_js_1.BACKEND_STRINGS.LEDGER.ERR_DOUBLE_ENTRY_VIOLATION(eq.totalDebits, eq.totalCredits, eq.deviation));
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
    async rollbackOrphanedBlockRange(fromBlock, toBlock) {
        const all = await this.storage.getAllTransactions();
        const keysToOrphan = [];
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
    async getCanonicalAccountBalanceBigInt(accountCode) {
        const all = await this.storage.getAllTransactions();
        let balance = 0n;
        for (const tx of all.values()) {
            if (tx.status !== 'ORPHANED') {
                for (const entry of tx.entries) {
                    if (entry.accountCode === accountCode) {
                        const debit = (0, viem_1.parseUnits)((entry.debit || '0').toString(), 18);
                        const credit = (0, viem_1.parseUnits)((entry.credit || '0').toString(), 18);
                        balance += debit - credit;
                    }
                }
            }
        }
        return balance;
    }
    async getCanonicalAccountBalance(accountCode) {
        const balBig = await this.getCanonicalAccountBalanceBigInt(accountCode);
        return parseFloat((0, viem_1.formatUnits)(balBig, 18));
    }
    /**
     * Creates balanced entries for Treasury Deposit
     */
    static buildDepositEntries(user, grossUsdc, dynamicFee, netUsdc) {
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
    static buildStakingEntries(user, grossAlpha) {
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
    async getTotalProcessedTransactions() {
        const all = await this.storage.getAllTransactions();
        return all.size;
    }
}
exports.IdempotentLedgerEngine = IdempotentLedgerEngine;
//# sourceMappingURL=IdempotentLedger.js.map