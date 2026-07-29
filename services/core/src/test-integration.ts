import { createPublicClient, createWalletClient, http, parseAbiItem, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrum } from 'viem/chains';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

// Setup environment and paths
const ANVIL_URL = process.env.ANVIL_URL || 'http://localhost:8545';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5432/alpha_centauri?schema=public';

// Standard Anvil Operator account
const OPERATOR_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const account = privateKeyToAccount(OPERATOR_KEY);

const prisma = new PrismaClient({
  datasources: { db: { url: DB_URL } }
});

const redisPub = new Redis(REDIS_URL);
const redisSub = new Redis(REDIS_URL);
const channel = 'alpha_centauri_events';

// Client setups
const publicClient = createPublicClient({
  chain: arbitrum,
  transport: http(ANVIL_URL)
});

const walletClient = createWalletClient({
  account,
  chain: arbitrum,
  transport: http(ANVIL_URL)
});

// Helper to load artifacts
function loadArtifact(name: string, file: string) {
  const p = path.resolve(__dirname, `../../../contracts/out/${file}/${name}.json`);
  if (!fs.existsSync(p)) {
    throw new Error(`Artifact not found at ${p}. Run forge compile first.`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function main() {
  console.log('\n==================================================');
  console.log('       ALPHA CENTAURI INTEGRATION E2E RUNNER');
  console.log('==================================================\n');

  // 1. Clean Database
  console.log('[*] Cleaning old database tables...');
  await prisma.ledgerEntry.deleteMany({});
  await prisma.ledgerTransaction.deleteMany({});
  await prisma.twapHistory.deleteMany({});
  await prisma.twapOrder.deleteMany({});
  await prisma.corporateContribution.deleteMany({});
  console.log('[+] Database tables cleared.');

  // 2. Load ABIs and Bytecodes
  console.log('[*] Loading Solidity compiled artifacts...');
  const MockERC20 = loadArtifact('MockERC20', 'Treasury.t.sol');
  const MockChainlinkFeed = loadArtifact('MockChainlinkFeed', 'Treasury.t.sol');
  const MockSwapRouter = loadArtifact('MockSwapRouter', 'Treasury.t.sol');
  const Treasury = loadArtifact('Treasury', 'Treasury.sol');
  const CorporateContribution = loadArtifact('CorporateContribution', 'CorporateContribution.sol');

  // 3. Deploy Mocks & Core Contracts
  console.log('[*] Deploying Mock USDC token on Anvil...');
  const usdcTx = await walletClient.deployContract({
    abi: MockERC20.abi,
    bytecode: MockERC20.bytecode.object,
    args: ['USD Coin', 'USDC']
  });
  const usdcReceipt = await publicClient.waitForTransactionReceipt({ hash: usdcTx });
  const usdcAddr = usdcReceipt.contractAddress!;
  console.log(`[+] Mock USDC deployed at: ${usdcAddr}`);

  console.log('[*] Deploying Mock Chainlink USDC Price Feed...');
  const feedTx = await walletClient.deployContract({
    abi: MockChainlinkFeed.abi,
    bytecode: MockChainlinkFeed.bytecode.object,
    args: [8, 100000000n] // $1.00 with 8 decimals
  });
  const feedReceipt = await publicClient.waitForTransactionReceipt({ hash: feedTx });
  const feedAddr = feedReceipt.contractAddress!;
  console.log(`[+] Mock Price Feed deployed at: ${feedAddr}`);

  console.log('[*] Deploying Mock Swap Router...');
  const routerTx = await walletClient.deployContract({
    abi: MockSwapRouter.abi,
    bytecode: MockSwapRouter.bytecode.object,
    args: [usdcAddr, address(0x999)] // mock native token destination
  });
  const routerReceipt = await publicClient.waitForTransactionReceipt({ hash: routerTx });
  const routerAddr = routerReceipt.contractAddress!;
  console.log(`[+] Mock Swap Router deployed at: ${routerAddr}`);

  console.log('[*] Deploying Treasury Contract...');
  const treasuryTx = await walletClient.deployContract({
    abi: Treasury.abi,
    bytecode: Treasury.bytecode.object,
    args: [account.address, usdcAddr, 18]
  });
  const treasuryReceipt = await publicClient.waitForTransactionReceipt({ hash: treasuryTx });
  const treasuryAddr = treasuryReceipt.contractAddress!;
  console.log(`[+] Treasury Contract deployed at: ${treasuryAddr}`);

  console.log('[*] Deploying CorporateContribution Contract...');
  const corpTx = await walletClient.deployContract({
    abi: CorporateContribution.abi,
    bytecode: CorporateContribution.bytecode.object,
    args: [usdcAddr, address(0x999), address(0x888), routerAddr, account.address]
  });
  const corpReceipt = await publicClient.waitForTransactionReceipt({ hash: corpTx });
  const corpAddr = corpReceipt.contractAddress!;
  console.log(`[+] CorporateContribution Contract deployed at: ${corpAddr}`);

  // 4. Configure Treasury Assets
  console.log('[*] Configuring Treasury tracked asset (USDC)...');
  const setTrackedHash = await walletClient.writeContract({
    address: treasuryAddr,
    abi: Treasury.abi,
    functionName: 'setTrackedAsset',
    args: [usdcAddr, feedAddr, 18]
  });
  await publicClient.waitForTransactionReceipt({ hash: setTrackedHash });
  console.log('[+] Tracked asset configured.');

  // 5. Spin up E2E Listener & Core subscriber loops internally
  console.log('[*] Starting Satellite log listening loop...');
  publicClient.watchEvent({
    address: corpAddr,
    event: parseAbiItem('event ContributionReceived(uint256 amount, string auditRef)'),
    onLogs: (logs: any[]) => {
      for (const log of logs) {
        console.log(`[Satellite] Captured ContributionReceived event in block ${log.blockNumber}!`);
        const eventMsg = {
          type: 'CORPORATE_CONTRIBUTION_INJECTED',
          txHash: log.transactionHash,
          payload: {
            amount: log.args.amount?.toString(),
            auditRef: log.args.auditRef
          }
        };
        redisPub.publish(channel, JSON.stringify(eventMsg));
      }
    }
  });

  console.log('[*] Starting Core ledger subscriber loop...');
  redisSub.subscribe(channel);
  redisSub.on('message', async (chan: string, msg: string) => {
    if (chan === channel) {
      const event = JSON.parse(msg);
      console.log(`[Core] Processing Redis event: ${event.type}`);
      if (event.type === 'CORPORATE_CONTRIBUTION_INJECTED') {
        const { amount, auditRef } = event.payload;
        
        // Write double-entry transaction
        const tx = await prisma.ledgerTransaction.create({
          data: {
            description: `Corporate contribution received: Ref ${auditRef}`,
            referenceType: 'CORP_INJECTION',
            referenceId: event.txHash,
            entries: {
              create: [
                {
                  accountCode: 'TREASURY_LIQUID_USDC',
                  debit: amount,
                  credit: '0.0',
                  assetAddress: usdcAddr
                },
                {
                  accountCode: 'CORPORATE_EQUITY',
                  debit: '0.0',
                  credit: amount,
                  assetAddress: usdcAddr
                }
              ]
            }
          },
          include: { entries: true }
        });
        console.log(`[Core] Ledger double-entry written. Transaction ID: ${tx.id}`);
        console.log(`       Debited TREASURY_LIQUID_USDC by ${amount}`);
        console.log(`       Credited CORPORATE_EQUITY by ${amount}`);
      }
    }
  });

  // 6. Simulate Corporate Capital Injection
  console.log('\n--- SIMULATING CORPORATE INJECTION ---');
  
  // Mint USDC to corporate user (account.address)
  console.log('[*] Minting 5,000 mock USDC to operator...');
  const mintTx = await walletClient.writeContract({
    address: usdcAddr,
    abi: MockERC20.abi,
    functionName: 'mint',
    args: [account.address, parseEther('5000')]
  });
  await publicClient.waitForTransactionReceipt({ hash: mintTx });

  // Approve CorporateContribution contract
  console.log('[*] Approving CorporateContribution contract to spend USDC...');
  const approveTx = await walletClient.writeContract({
    address: usdcAddr,
    abi: MockERC20.abi,
    functionName: 'approve',
    args: [corpAddr, parseEther('5000')]
  });
  await publicClient.waitForTransactionReceipt({ hash: approveTx });

  // Call injectFunds()
  console.log('[*] Triggering injectFunds() on-chain...');
  const injectTx = await walletClient.writeContract({
    address: corpAddr,
    abi: CorporateContribution.abi,
    functionName: 'injectFunds',
    args: [parseEther('5000'), 'STATEMENT_Q3_AUDITED']
  });
  console.log(`[+] Sent injectFunds transaction: ${injectTx}`);
  console.log('[*] Waiting for transaction to be mined...');
  const injectReceipt = await publicClient.waitForTransactionReceipt({ hash: injectTx });
  console.log(`[+] Transaction mined successfully in block ${injectReceipt.blockNumber}!`);

  // Wait a few seconds for event propagation and ledger write
  console.log('[*] Waiting for event pipeline to process logs...');
  await new Promise((r) => setTimeout(r, 6000));

  // 7. Verify persistent ledger balances
  console.log('\n--- VERIFYING LEDGER INTEGRITY ---');
  const transactions = await prisma.ledgerTransaction.findMany({
    include: { entries: true }
  });

  console.log(`Total DB Ledger Transactions recorded: ${transactions.length}`);
  for (const tx of transactions) {
    console.log(`- Transaction: "${tx.description}" [Ref ID: ${tx.referenceId}]`);
    let totalDebit = 0;
    let totalCredit = 0;
    for (const entry of tx.entries) {
      console.log(`  |-- Account: ${entry.accountCode.padEnd(25)} | Debit: ${entry.debit.toString().padEnd(20)} | Credit: ${entry.credit.toString()}`);
      totalDebit += parseFloat(entry.debit.toString());
      totalCredit += parseFloat(entry.credit.toString());
    }
    console.log(`  |=> SUM DEBITS: ${totalDebit} | SUM CREDITS: ${totalCredit} | Balanced: ${totalDebit === totalCredit}`);
    if (totalDebit !== totalCredit) {
      console.error('[!!!] Accounting Ledger Error: Double-entry imbalance detected!');
      process.exit(1);
    }
  }

  console.log('\n[+] E2E Pipeline Integration Test: SUCCESSFUL!');
  console.log('==================================================\n');

  // Close connections
  redisPub.disconnect();
  redisSub.disconnect();
  await prisma.$disconnect();
  process.exit(0);
}

function address(val: number): `0x${string}` {
  return `0x${val.toString(16).padStart(40, '0')}`;
}

main().catch((error) => {
  console.error('[!] Integration test failed:', error);
  process.exit(1);
});
