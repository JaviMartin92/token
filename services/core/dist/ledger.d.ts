import { ReferenceType } from '@prisma/client';
export interface EntryInput {
    accountCode: string;
    debit: string;
    credit: string;
    assetAddress: string;
}
/**
 * Creates an audit-compliant double-entry ledger transaction.
 * Ensures total debits equal total credits per asset, preventing NaN bypass and TOCTOU races.
 */
export declare function recordLedgerTransaction(description: string, referenceType: ReferenceType, referenceId: string | null, entries: EntryInput[]): Promise<{
    entries: {
        id: string;
        debit: import("@prisma/client/runtime/library").Decimal;
        credit: import("@prisma/client/runtime/library").Decimal;
        accountCode: string;
        assetAddress: string;
        transactionId: string;
    }[];
} & {
    id: string;
    timestamp: Date;
    description: string;
    referenceType: import(".prisma/client").$Enums.ReferenceType;
    referenceId: string | null;
}>;
