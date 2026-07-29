"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordLedgerTransaction = recordLedgerTransaction;
exports.getTrialBalance = getTrialBalance;
const database_js_1 = require("./database.js");
/**
 * Creates an audit-compliant double-entry ledger transaction.
 * Ensures total debits equal total credits.
 */
async function recordLedgerTransaction(description, referenceType, referenceId, entries) {
    // Validate double-entry accounting rule: Sum(Debits) === Sum(Credits)
    let totalDebits = 0;
    let totalCredits = 0;
    for (const entry of entries) {
        totalDebits += parseFloat(entry.debit);
        totalCredits += parseFloat(entry.credit);
    }
    // Use a small epsilon for floating-point safety, or exact comparisons when converting to BigInt/Decimal
    const deviation = Math.abs(totalDebits - totalCredits);
    if (deviation > 0.00000001) {
        throw new Error(`Ledger Error: Double-entry violation. Debits (${totalDebits}) do not equal Credits (${totalCredits}). Deviation: ${deviation}`);
    }
    return await database_js_1.prisma.ledgerTransaction.create({
        data: {
            description,
            referenceType,
            referenceId,
            entries: {
                create: entries.map((e) => ({
                    accountCode: e.accountCode,
                    debit: e.debit,
                    credit: e.credit,
                    assetAddress: e.assetAddress,
                })),
            },
        },
        include: {
            entries: true,
        },
    });
}
/**
 * Validates and aggregates all trial balances to verify ledger integrity.
 */
async function getTrialBalance() {
    const entries = await database_js_1.prisma.ledgerEntry.findMany();
    const balances = {};
    for (const entry of entries) {
        if (!balances[entry.accountCode]) {
            balances[entry.accountCode] = { debits: 0, credits: 0, net: 0 };
        }
        const d = entry.debit.toNumber();
        const c = entry.credit.toNumber();
        balances[entry.accountCode].debits += d;
        balances[entry.accountCode].credits += c;
        balances[entry.accountCode].net += (d - c);
    }
    return balances;
}
//# sourceMappingURL=ledger.js.map