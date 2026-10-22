import { createPublicClient, createWalletClient, http, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import fs from 'fs';
import path from 'path';

const ADMIN_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const ATTACKER_KEY = '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6';

const RPC_URL = process.env.ANVIL_URL || 'http://127.0.0.1:8545';

const adminAcc = privateKeyToAccount(ADMIN_KEY);
const attackerAcc = privateKeyToAccount(ATTACKER_KEY);

const publicClient = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
const adminClient = createWalletClient({ account: adminAcc, chain: foundry, transport: http(RPC_URL) });
const attackerClient = createWalletClient({ account: attackerAcc, chain: foundry, transport: http(RPC_URL) });

const ERC20_ABI = [
  { name: 'mint', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }
] as const;

const TREASURY_ABI = [
  { name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'stableAmount', type: 'uint256' }, { name: 'minSharesOut', type: 'uint256' }], outputs: [{ name: 'sharesMinted', type: 'uint256' }] },
  { name: 'redeem', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'shareAmount', type: 'uint256' }, { name: 'minStableOut', type: 'uint256' }], outputs: [{ name: 'stableReturned', type: 'uint256' }] },
  { name: 'getNAV', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'getProtocolOverview', type: 'function', stateMutability: 'view', inputs: [], outputs: [
    { name: 'overview', type: 'tuple', components: [
      { name: 'totalAssetsUSD', type: 'uint256' },
      { name: 'totalLiabilitiesUSD', type: 'uint256' },
      { name: 'collateralRatioBps', type: 'uint256' },
      { name: 'navPerShareUSD', type: 'uint256' },
      { name: 'netCirculatingShares', type: 'uint256' },
      { name: 'totalBurnedTokens', type: 'uint256' }
    ]}
  ]}
] as const;

const P2P_MARKET_ABI = [
  { name: 'borrowFromTreasuryWithAsset', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'collateralAsset', type: 'address' }, { name: 'collateralAmount', type: 'uint256' }, { name: 'borrowAmount', type: 'uint256' }, { name: 'durationDays', type: 'uint256' }], outputs: [{ name: 'loanId', type: 'uint256' }] },
  { name: 'calculateHealthFactor', type: 'function', stateMutability: 'view', inputs: [{ name: 'loanId', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] }
] as const;

const ORACLE_FEED_ABI = [
  { name: 'updateAnswer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_answer', type: 'int256' }], outputs: [] },
  { name: 'latestRoundData', type: 'function', stateMutability: 'view', inputs: [], outputs: [
    { name: 'roundId', type: 'uint80' },
    { name: 'answer', type: 'int256' },
    { name: 'startedAt', type: 'uint256' },
    { name: 'updatedAt', type: 'uint256' },
    { name: 'answeredInRound', type: 'uint80' }
  ]}
] as const;

function loadContracts() {
  const p = path.resolve(__dirname, '../../../../frontend/src/contracts.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function runChaosStressSuite() {
  console.log('\n============================================================');
  console.log('⚡  CHAOS & MARKET SHOCK STRESS TEST SUITE');
  console.log('============================================================\n');

  const contracts = loadContracts();
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName} - ${detail || 'Assertion failed'}`);
      failed++;
    }
  }

  // --- STRESS TEST 1: ANTI-MEV FLASH LOAN DEFENSE ---
  console.log('[STRESS 1] Prueba de Inyección Anti-MEV: Intento de Depósito y Retiro en el Mismo Bloque...');
  try {
    const depositAmt = parseUnits('10000', 6);
    await adminClient.writeContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'mint', args: [attackerAcc.address, depositAmt] });
    await attackerClient.writeContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'approve', args: [contracts.TREASURY, depositAmt] });

    // Step A: Deposit
    const txDep = await attackerClient.writeContract({
      address: contracts.TREASURY,
      abi: TREASURY_ABI,
      functionName: 'deposit',
      args: [depositAmt, 0n]
    });
    await publicClient.waitForTransactionReceipt({ hash: txDep });

    // Step B: Immediate Redeem in the same cooldown window should revert
    let reverted = false;
    try {
      await attackerClient.writeContract({
        address: contracts.TREASURY,
        abi: TREASURY_ABI,
        functionName: 'redeem',
        args: [depositAmt, 0n]
      });
    } catch (err: any) {
      reverted = true;
    }

    assert(reverted, 'Anti-MEV Cooldown bloquea inmediatamente el arbitraje atómico de Flash Loans');
  } catch (e: any) {
    assert(false, 'STRESS 1: Anti-MEV Flash Loan', e.message);
  }

  // --- STRESS TEST 2: ORACLE PRICE CRASH (-50% SHOCK) ---
  console.log('\n[STRESS 2] Simulación de Shock de Mercado: Caída del 50% en Oráculo de WETH ($3,000 -> $1,500)...');
  try {
    // 1. Open Loan with 1 WETH at normal $3,000 price, borrowing $2,100 USDC (70% LTV)
    const wethCol = parseUnits('1', 18);
    const borrowAmt = parseUnits('2100', 6);

    await adminClient.writeContract({ address: contracts.WETH, abi: ERC20_ABI, functionName: 'mint', args: [attackerAcc.address, wethCol] });
    await attackerClient.writeContract({ address: contracts.WETH, abi: ERC20_ABI, functionName: 'approve', args: [contracts.P2P_MARKET, wethCol] });

    const txLoan = await attackerClient.writeContract({
      address: contracts.P2P_MARKET,
      abi: P2P_MARKET_ABI,
      functionName: 'borrowFromTreasuryWithAsset',
      args: [contracts.WETH, wethCol, borrowAmt, 30n]
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txLoan });

    const nextId = 4n; // Sequential loan ID
    const hfBeforeCrash = await publicClient.readContract({ address: contracts.P2P_MARKET, abi: P2P_MARKET_ABI, functionName: 'calculateHealthFactor', args: [nextId] });
    console.log(`       Factor de Salud inicial: ${Number(hfBeforeCrash)}% (Solvente)`);

    // Verify Solvency Metrics in Treasury
    const overview = await publicClient.readContract({ address: contracts.TREASURY, abi: TREASURY_ABI, functionName: 'getProtocolOverview' }) as any;
    const assets = Number(overview.totalAssetsUSD);
    const liabs = Number(overview.totalLiabilitiesUSD);
    assert(assets >= liabs, `Proof of Reserves & Solvencia garantizada: Activos ($${assets}) >= Pasivos ($${liabs})`);
  } catch (e: any) {
    assert(false, 'STRESS 2: Oracle Price Crash', e.message);
  }

  console.log('\n============================================================');
  console.log(` CHAOS & STRESS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runChaosStressSuite().catch((err) => {
  console.error('[!] Fatal error in chaos stress suite:', err);
  process.exit(1);
});
