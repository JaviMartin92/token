import * as fs from 'fs';
import * as path from 'path';
import { BlockIndexerService } from '../indexer/BlockIndexer.js';
import { LiquidationWatchdogService, FlashbotsPrivateRelay, StandardRpcRelay, type LoanData } from '../watchdog/LiquidationWatchdog.js';
import { ResilientRpcManager } from '../rpc/ResilientRpcManager.js';
import { IdempotentLedgerEngine } from '../ledger/IdempotentLedger.js';
import { JsonFilePersistentStorage, InMemoryLedgerStorage } from '../ledger/PersistentLedgerStorage.js';
import { ProofOfReservesReconciler } from '../reconciler/ProofOfReservesReconciler.js';

async function runBackendImprovementsTestSuite() {
  console.log('============================================================');
  console.log('  ALPHA CENTAURI: 5 BACKEND ARCHITECTURAL IMPROVEMENTS TEST  ');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      failed++;
    }
  }

  // ---------------------------------------------------------
  // 1. BlockIndexerService Tests with Persistent Checkpoints
  // ---------------------------------------------------------
  console.log('[1/5] Testing BlockIndexerService & Checkpoint Persistence...');
  {
    const storage = new InMemoryLedgerStorage();
    const mockClient = {
      getBlockNumber: async () => 100n,
      getLogs: async () => []
    } as any;

    const indexer = new BlockIndexerService({
      rpcUrl: 'http://127.0.0.1:8545',
      startBlock: 50n,
      confirmationBlocks: 3,
      batchSize: 20
    }, mockClient, storage);

    assert(indexer.getLastIndexedBlock() === 50n, 'Initial startBlock cursor initialized correctly (50n)');

    let receivedEvents = 0;
    indexer.registerHandler('SharesMinted', async () => {
      receivedEvents++;
    });

    const batch1 = await indexer.indexNextBatch(100n);
    assert(batch1.fromBlock === 51n, 'First batch fromBlock is next block (51n)');
    assert(batch1.toBlock === 70n, 'First batch toBlock matches batchSize 20 (70n)');
    assert(indexer.getLastIndexedBlock() === 70n, 'Cursor advanced to 70n after batch execution');

    const batch2 = await indexer.indexNextBatch(100n);
    assert(batch2.fromBlock === 71n, 'Second batch starts from 71n');
    assert(batch2.toBlock === 90n, 'Second batch reaches 90n');

    const batch3 = await indexer.indexNextBatch(100n);
    // Safe max is latest(100) - confirmation(3) = 97n
    assert(batch3.toBlock === 97n, 'Third batch stops at safe block height 97n with 3 confirmation blocks');

    const savedCp = await storage.getCheckpoint('lastIndexedBlock');
    assert(savedCp === '97', 'Checkpoint persisted to storage driver matching safe block height 97');

    // ---------------------------------------------------------
    // 1.b Reorg Tracking & Atomic Rollback Tests (Constraint 2)
    // ---------------------------------------------------------
    console.log('  Testing Block Header Tracking & Atomic Reorg Rollback...');
    await indexer.trackBlockHeader(1n, '0xhash1', '0xgen');
    await indexer.trackBlockHeader(2n, '0xhash2_canon', '0xhash1');
    await indexer.trackBlockHeader(3n, '0xhash3_canon', '0xhash2_canon');

    // Feed a block that has a conflicting parentHash (simulating a fork / reorg)
    const reorgDetection = await indexer.trackBlockHeader(3n, '0xhash3_fork', '0xhash2_fork_different');
    assert(reorgDetection.isReorg, 'ParentHash mismatch correctly triggers isReorg: true');
    assert(reorgDetection.forkBlock === 2n, 'Fork point accurately identified at block 2');

    // Atomic Rollback Execution: mark ORPHANED instead of blind DELETE
    const rollbackResult = await indexer.handleReorgRollback(2n, 3n);
    assert(indexer.getLastIndexedBlock() === 1n, 'Indexer cursor rewound to safe pre-fork ancestor (1n)');
    const orphanedHeader = await storage.getBlockHeader('2');
    assert(orphanedHeader?.status === 'ORPHANED', 'Orphaned block header status marked as ORPHANED (no blind DELETE)');
  }

  // ---------------------------------------------------------
  // 2. LiquidationWatchdogService & Flashbots MEV Protection Tests
  // ---------------------------------------------------------
  console.log('\n[2/5] Testing LiquidationWatchdogService & Flashbots MEV Relay...');
  {
    const flashbotsRelay = new FlashbotsPrivateRelay();
    const watchdog = new LiquidationWatchdogService(1.0, flashbotsRelay);
    const nowSec = 1700000000;

    const healthyLoan: LoanData = {
      id: 1,
      borrower: '0x1111111111111111111111111111111111111111',
      lender: '0x2222222222222222222222222222222222222222',
      collateralType: 'wbtc',
      collateralAmount: '0.1', // 0.1 WBTC = $6,000
      borrowAmountUSD: 3000,
      interestRateAprPct: 10,
      durationDays: 30,
      startTimeSec: nowSec - (10 * 86400), // 10 days in
      state: 1
    };

    const healthyEval = watchdog.evaluateLoan(healthyLoan, { wbtc: 60000, weth: 3000, alpha: 1.0, usdc: 1.0 }, nowSec);
    assert(!healthyEval.canLiquidate, 'Healthy loan with 200% collateral cannot be liquidated');
    assert(healthyEval.healthFactor > 1.5, `Health factor is strong (${healthyEval.healthFactor.toFixed(2)})`);

    const expiredLoan: LoanData = {
      ...healthyLoan,
      id: 2,
      startTimeSec: nowSec - (35 * 86400) // 35 days in (> 30 days duration)
    };
    const expiredEval = watchdog.evaluateLoan(expiredLoan, { wbtc: 60000, weth: 3000, alpha: 1.0, usdc: 1.0 }, nowSec);
    assert(expiredEval.canLiquidate && expiredEval.isExpired, 'Expired loan triggers liquidation flag with expiration reason');

    const underCollateralizedLoan: LoanData = {
      id: 3,
      borrower: '0x3333333333333333333333333333333333333333',
      lender: '0x4444444444444444444444444444444444444444',
      collateralType: 'wbtc',
      collateralAmount: '0.05', // 0.05 WBTC at $40,000 = $2,000
      borrowAmountUSD: 2500, // Debt ($2500) > Collateral ($2000)
      interestRateAprPct: 10,
      durationDays: 30,
      startTimeSec: nowSec - (5 * 86400),
      state: 1
    };
    const underColEval = watchdog.evaluateLoan(underCollateralizedLoan, { wbtc: 40000, weth: 2000, alpha: 1.0, usdc: 1.0 }, nowSec);
    assert(underColEval.canLiquidate && underColEval.isUnderCollateralized, 'Under-collateralized loan (HF < 1.0) triggers instant liquidation');

    const report = watchdog.generateAuditReport([healthyLoan, expiredLoan, underCollateralizedLoan], { wbtc: 40000, weth: 2000, alpha: 1.0, usdc: 1.0 }, nowSec);
    assert(report.totalActiveLoans === 3, 'Watchdog report counted 3 active loans');
    assert(report.liquidatableCount === 2, 'Watchdog report detected exactly 2 liquidatable loans');

    // Test MEV-protected execution
    const mevExecution = await watchdog.dispatchMevProtectedLiquidation(3, '0xdeadbeef1234');
    assert(mevExecution.isProtected, 'Liquidation dispatched via Flashbots Private Mempool relay isProtected: true');

    // Test Standard Relay execution
    const standardRelay = new StandardRpcRelay();
    const standardWatchdog = new LiquidationWatchdogService(1.0, standardRelay);
    const stdExecution = await standardWatchdog.dispatchMevProtectedLiquidation(3, '0xdeadbeef1234');
    assert(!stdExecution.isProtected, 'StandardRpcRelay returns isProtected: false');
  }

  // ---------------------------------------------------------
  // 3. ResilientRpcManager Tests
  // ---------------------------------------------------------
  console.log('\n[3/5] Testing ResilientRpcManager...');
  {
    const rpcManager = new ResilientRpcManager({
      endpoints: ['http://127.0.0.1:8545', 'http://127.0.0.1:8546'],
      maxRetries: 2
    });

    const statusList = rpcManager.getStatusList();
    assert(statusList.length === 2, 'Configured with 2 RPC endpoints');

    const { endpoint } = rpcManager.getHealthyClient();
    assert(endpoint === 'http://127.0.0.1:8545', 'Primary endpoint selected as healthy default');

    // Simulate mock call with automatic failover
    let callAttempts = 0;
    const result = await rpcManager.executeWithFallback(async () => {
      callAttempts++;
      if (callAttempts === 1) {
        throw new Error('RPC Node Timeout 504');
      }
      return 'SUCCESS_AFTER_FALLBACK';
    });

    assert(result === 'SUCCESS_AFTER_FALLBACK', 'Automatic failover succeeded when primary threw timeout');
    assert(callAttempts === 2, 'Tried primary, failed, then recovered seamlessly on fallback endpoint');
  }

  // ---------------------------------------------------------
  // 4. IdempotentLedgerEngine & Persistent Storage Tests
  // ---------------------------------------------------------
  console.log('\n[4/5] Testing IdempotentLedgerEngine & Persistent Storage...');
  {
    const testDir = path.join(process.cwd(), '.tmp_test_data');
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    const diskStorage = new JsonFilePersistentStorage(testDir);
    const ledger = new IdempotentLedgerEngine(diskStorage);

    const txHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    const logIndex = 3;
    const refType = 'TREASURY_DEPOSIT';

    const entries = IdempotentLedgerEngine.buildDepositEntries('0xUser1234567890', 1000, 10, 990);
    const eqCheck = ledger.validateEquilibrium(entries);
    assert(eqCheck.isValid, 'Double-entry template guarantees Sum(Debits) === Sum(Credits) ($1000.00)');

    const record1 = await ledger.recordTransaction({
      description: 'Deposit 1000 USDC',
      referenceType: refType,
      referenceId: 'DEP-101',
      txHash,
      logIndex,
      entries
    });

    assert(!record1.isDuplicate, 'First transaction entry recorded successfully');
    assert((await ledger.getTotalProcessedTransactions()) === 1, 'Total transactions counter equals 1');

    // Duplicate replay attempt
    const record2 = await ledger.recordTransaction({
      description: 'Duplicate Deposit Replay',
      referenceType: refType,
      referenceId: 'DEP-101',
      txHash,
      logIndex,
      entries
    });

    assert(record2.isDuplicate, 'Replay of same txHash + logIndex correctly flagged as isDuplicate: true');
    assert(record2.idempotencyKey === record1.idempotencyKey, 'Idempotency key matches deterministically');
    assert((await ledger.getTotalProcessedTransactions()) === 1, 'Total transactions counter remains 1 (No duplicate posting)');

    // Verify recovery by creating a new engine instance loading from same disk path
    const recoveredStorage = new JsonFilePersistentStorage(testDir);
    const recoveredLedger = new IdempotentLedgerEngine(recoveredStorage);
    assert((await recoveredLedger.getTotalProcessedTransactions()) === 1, 'New Ledger instance recovered journal from disk with 1 transaction');

    // Cleanup temp test dir
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    // Atomic Reorg Rollback of Ledger Transactions (Constraint 2)
    const reorgLedgerStorage = new InMemoryLedgerStorage();
    const reorgLedger = new IdempotentLedgerEngine(reorgLedgerStorage);
    await reorgLedger.recordTransaction({
      description: 'Canonical Deposit Block 10',
      referenceType: 'DEPOSIT',
      referenceId: 'DEP-10',
      txHash: '0xcanon10',
      logIndex: 0,
      blockNumber: '10',
      entries: [
        { accountCode: 'TREASURY_USDC', debit: '500.00', credit: '0.0', assetAddress: 'USDC' },
        { accountCode: 'USER_EQUITY', debit: '0.0', credit: '500.00', assetAddress: 'USDC' }
      ]
    });
    await reorgLedger.recordTransaction({
      description: 'Orphaned Deposit Block 11',
      referenceType: 'DEPOSIT',
      referenceId: 'DEP-11',
      txHash: '0xorphaned11',
      logIndex: 0,
      blockNumber: '11',
      entries: [
        { accountCode: 'TREASURY_USDC', debit: '300.00', credit: '0.0', assetAddress: 'USDC' },
        { accountCode: 'USER_EQUITY', debit: '0.0', credit: '300.00', assetAddress: 'USDC' }
      ]
    });

    const preBalance = await reorgLedger.getCanonicalAccountBalance('TREASURY_USDC');
    assert(preBalance === 800, 'Pre-rollback balance includes both blocks ($800)');

    // Execute atomic rollback on block 11
    const rollRes = await reorgLedger.rollbackOrphanedBlockRange(11n, 11n);
    assert(rollRes.orphanedCount === 1, 'Exactly 1 transaction in block 11 marked as ORPHANED');
    assert(rollRes.revertedDebits === 300, 'Reverted debits match $300.00');

    const postBalance = await reorgLedger.getCanonicalAccountBalance('TREASURY_USDC');
    assert(postBalance === 500, 'Post-rollback canonical balance atomically updated to $500 (orphaned entries excluded)');

    // Violating equilibrium test
    const brokenEntries = [
      { accountCode: 'TREASURY', debit: '100.00', credit: '0.0', assetAddress: 'USDC' },
      { accountCode: 'USER', debit: '0.0', credit: '90.00', assetAddress: 'USDC' } // $10 imbalance!
    ];

    let caughtViolation = false;
    try {
      await ledger.recordTransaction({
        description: 'Imbalanced entry',
        referenceType: 'CORRUPT',
        referenceId: 'BAD-1',
        txHash: '0x999999',
        logIndex: 0,
        entries: brokenEntries
      });
    } catch {
      caughtViolation = true;
    }
    assert(caughtViolation, 'Imbalanced entries correctly rejected by Double-entry equilibrium validation');
  }

  // ---------------------------------------------------------
  // 5. ProofOfReservesReconciler Tests
  // ---------------------------------------------------------
  console.log('\n[5/5] Testing ProofOfReservesReconciler...');
  {
    const reconciler = new ProofOfReservesReconciler(0.01); // 0.01% tolerance

    const onChainSnapshot = {
      stablesUSD: 50000,
      wbtcUSD: 25000,
      wethUSD: 15000,
      activeLoansUSD: 10000,
      totalAssetsExogenousUSD: 100000,
      totalLiabilitiesUSD: 100000,
      collateralRatioBps: 10000,
      navPerShareUSD: 1.00
    };

    const perfectOffChain = {
      treasuryStablesUSD: 50000,
      treasuryWbtcUSD: 25000,
      treasuryWethUSD: 15000,
      activeLoansLentUSD: 10000,
      totalLedgerAssetsUSD: 100000
    };

    const report1 = reconciler.reconcile(onChainSnapshot, perfectOffChain);
    assert(report1.isBalanced, 'Exact matching records produce isBalanced: true');
    assert(report1.status === 'SOLVENT_EXACT', 'Status is SOLVENT_EXACT for 0% variance');
    assert(report1.collateralRatioPct === 100.0, 'Collateral ratio confirmed at 100.00%');

    // Minor deviation under tolerance
    const minorDeviationOffChain = {
      ...perfectOffChain,
      treasuryStablesUSD: 50005, // $5 variance on $100,000 = 0.005% (< 0.01%)
      totalLedgerAssetsUSD: 100005
    };
    const report2 = reconciler.reconcile(onChainSnapshot, minorDeviationOffChain);
    assert(report2.isBalanced, 'Deviation within 0.01% tolerance evaluates as isBalanced: true');
    assert(report2.status === 'SOLVENT_ACCEPTABLE_VARIANCE', 'Status is SOLVENT_ACCEPTABLE_VARIANCE');

    // Major discrepancy test
    const majorDiscrepancyOffChain = {
      ...perfectOffChain,
      treasuryStablesUSD: 40000, // $10,000 discrepancy!
      totalLedgerAssetsUSD: 90000
    };
    const report3 = reconciler.reconcile(onChainSnapshot, majorDiscrepancyOffChain);
    assert(!report3.isBalanced, 'Major discrepancy ($10,000) triggers isBalanced: false');
    assert(report3.status === 'DISCREPANCY_ALERT', 'Status flagged as DISCREPANCY_ALERT');
    assert(report3.variancePct === 10.0, 'Variance calculated accurately at 10.00%');
  }

  console.log('\n============================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runBackendImprovementsTestSuite().catch((err) => {
  console.error('[!] Test suite crash:', err);
  process.exit(1);
});
