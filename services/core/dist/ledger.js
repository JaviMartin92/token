"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordLedgerTransaction = recordLedgerTransaction;
const database_js_1 = require("./database.js");
const viem_1 = require("viem");
const NUMBER_REGEX = /^\d+(\.\d{1,18})?$/;
function validateNumericString(val, fieldName) {
    const trimmed = val ? val.trim() : '0';
    if (!NUMBER_REGEX.test(trimmed)) {
        throw new Error(`Ledger Error: Invalid numeric string for ${fieldName}: "${val}"`);
    }
    return trimmed;
}
/**
 * Creates an audit-compliant double-entry ledger transaction.
 * Ensures total debits equal total credits per asset, preventing NaN bypass and TOCTOU races.
 */
async function recordLedgerTransaction(description, referenceType, referenceId, entries) {
    if (!entries || entries.length === 0) {
        throw new Error('Ledger Error: Cannot record transaction with empty entries');
    }
    // Validate equilibrium per asset
    const assetGroups = new Map();
    let totalDebits = 0;
    let totalCredits = 0;
    for (const entry of entries) {
        if (!entry.assetAddress || !entry.accountCode) {
            throw new Error(`Ledger Error: Missing assetAddress or accountCode in entry`);
        }
        const debitStr = validateNumericString(entry.debit, 'debit');
        const creditStr = validateNumericString(entry.credit, 'credit');
        const assetKey = entry.assetAddress.toLowerCase();
        let group = assetGroups.get(assetKey);
        if (!group) {
            group = { debitsWei: 0n, creditsWei: 0n, debitsNum: 0, creditsNum: 0 };
            assetGroups.set(assetKey, group);
        }
        const dWei = (0, viem_1.parseUnits)(debitStr, 18);
        const cWei = (0, viem_1.parseUnits)(creditStr, 18);
        group.debitsWei += dWei;
        group.creditsWei += cWei;
        const dNum = parseFloat(debitStr);
        const cNum = parseFloat(creditStr);
        if (Number.isNaN(dNum) || Number.isNaN(cNum)) {
            throw new Error(`Ledger Error: NaN detected in numeric parsing for entry`);
        }
        group.debitsNum += dNum;
        group.creditsNum += cNum;
        totalDebits += dNum;
        totalCredits += cNum;
    }
    for (const [asset, group] of assetGroups.entries()) {
        const deviation = Math.abs(group.debitsNum - group.creditsNum);
        if (group.debitsWei !== group.creditsWei && deviation > 0.00000001) {
            throw new Error(`Ledger Error: Double-entry violation for asset ${asset}. Debits (${group.debitsNum}) do not equal Credits (${group.creditsNum}). Deviation: ${deviation}`);
        }
    }
    // Atomic TOCTOU-safe query and commit
    return await database_js_1.prisma.$transaction(async (tx) => {
        if (referenceId) {
            const existing = await tx.ledgerTransaction.findFirst({
                where: { referenceId, referenceType },
                include: { entries: true }
            });
            if (existing) {
                return existing;
            }
        }
        return await tx.ledgerTransaction.create({
            data: {
                description,
                referenceType,
                referenceId,
                entries: {
                    create: entries.map((e) => ({
                        accountCode: e.accountCode,
                        debit: (e.debit ? e.debit.trim() : '0') || '0',
                        credit: (e.credit ? e.credit.trim() : '0') || '0',
                        assetAddress: e.assetAddress,
                    })),
                },
            },
            include: {
                entries: true,
            },
        });
    });
}
//# sourceMappingURL=ledger.js.map