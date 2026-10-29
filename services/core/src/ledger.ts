import { prisma } from './database.js';
import { ReferenceType } from '@prisma/client';

export interface EntryInput {
  accountCode: string;
  debit: string;   // Decimal input as string
  credit: string;  // Decimal input as string
  assetAddress: string;
}

/**
 * Creates an audit-compliant double-entry ledger transaction.
 * Ensures total debits equal total credits.
 */
export async function recordLedgerTransaction(
  description: string,
  referenceType: ReferenceType,
  referenceId: string | null,
  entries: EntryInput[]
) {
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
    throw new Error(
      `Ledger Error: Double-entry violation. Debits (${totalDebits}) do not equal Credits (${totalCredits}). Deviation: ${deviation}`
    );
  }

  return await prisma.ledgerTransaction.create({
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

