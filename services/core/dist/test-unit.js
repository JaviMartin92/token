"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const database_js_1 = require("./database.js");
// 1. Mock the Prisma client globally before importing the ledger logic
database_js_1.prisma.ledgerTransaction.create = async (args) => {
    return {
        id: 'mock-uuid-12345',
        description: args.data.description,
        referenceType: args.data.referenceType,
        referenceId: args.data.referenceId,
        entries: args.data.entries.create.map((e, index) => ({
            id: `entry-mock-${index}`,
            accountCode: e.accountCode,
            debit: e.debit,
            credit: e.credit,
            assetAddress: e.assetAddress
        }))
    };
};
// 2. Import the recordLedgerTransaction function
const ledger_js_1 = require("./ledger.js");
async function runUnitTests() {
    console.log('==================================================');
    console.log('       ALPHA CENTAURI CORE UNIT TEST RUNNER');
    console.log('==================================================');
    // Test Case 1: Balanced Transaction (Should succeed)
    try {
        const balancedEntries = [
            {
                accountCode: 'TREASURY_LIQUID_USDC',
                debit: '1000.00',
                credit: '0.00',
                assetAddress: '0x123'
            },
            {
                accountCode: 'CORPORATE_EQUITY',
                debit: '0.00',
                credit: '1000.00',
                assetAddress: '0x123'
            }
        ];
        console.log('[*] Test 1: Recording balanced transaction (1000 Debits / 1000 Credits)...');
        const result = await (0, ledger_js_1.recordLedgerTransaction)('Test Balanced Injection', 'CORP_INJECTION', '0xabc', balancedEntries);
        assert_1.default.strictEqual(result.id, 'mock-uuid-12345');
        assert_1.default.strictEqual(result.description, 'Test Balanced Injection');
        assert_1.default.strictEqual(result.entries.length, 2);
        console.log('[+] Test 1: PASSED (Transaction recorded successfully).');
    }
    catch (err) {
        console.error('[!] Test 1: FAILED', err);
        process.exit(1);
    }
    // Test Case 2: Unbalanced Transaction (Should throw error)
    try {
        const unbalancedEntries = [
            {
                accountCode: 'TREASURY_LIQUID_USDC',
                debit: '1000.00',
                credit: '0.00',
                assetAddress: '0x123'
            },
            {
                accountCode: 'CORPORATE_EQUITY',
                debit: '0.00',
                credit: '950.00', // Missing 50 credits!
                assetAddress: '0x123'
            }
        ];
        console.log('[*] Test 2: Recording unbalanced transaction (1000 Debits / 950 Credits)...');
        await (0, ledger_js_1.recordLedgerTransaction)('Test Unbalanced Injection', 'CORP_INJECTION', '0xabc', unbalancedEntries);
        // If it reaches here, the test failed because it should have thrown an error
        console.error('[!] Test 2: FAILED (Expected exception was not thrown).');
        process.exit(1);
    }
    catch (err) {
        // Assert that the error is indeed a double-entry violation
        assert_1.default.ok(err.message.includes('Double-entry violation'));
        console.log('[+] Test 2: PASSED (Correctly rejected unbalanced entries).');
    }
    console.log('\n[+] All core backend unit tests completed successfully!');
    console.log('==================================================');
    process.exit(0);
}
runUnitTests().catch((err) => {
    console.error('[!] Unit test execution failed:', err);
    process.exit(1);
});
//# sourceMappingURL=test-unit.js.map