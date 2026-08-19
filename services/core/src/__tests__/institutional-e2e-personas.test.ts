import { createPublicClient, createWalletClient, http, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import fs from 'fs';
import path from 'path';

// Accounts from Anvil standard deterministic mnemonic
const ADMIN_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Account #0
const USER1_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; // Account #1 (Bond Investor)
const USER2_KEY = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'; // Account #2 (Multi-Collateral Borrower)
const LIQUIDATOR_KEY = '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6'; // Account #3 (Liquidator Bot)

const RPC_URL = process.env.ANVIL_URL || 'http://127.0.0.1:8545';

const adminAcc = privateKeyToAccount(ADMIN_KEY);
const user1Acc = privateKeyToAccount(USER1_KEY);
const user2Acc = privateKeyToAccount(USER2_KEY);
const liquidatorAcc = privateKeyToAccount(LIQUIDATOR_KEY);

const publicClient = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
const adminClient = createWalletClient({ account: adminAcc, chain: foundry, transport: http(RPC_URL) });
const user1Client = createWalletClient({ account: user1Acc, chain: foundry, transport: http(RPC_URL) });
const user2Client = createWalletClient({ account: user2Acc, chain: foundry, transport: http(RPC_URL) });
const liquidatorClient = createWalletClient({ account: liquidatorAcc, chain: foundry, transport: http(RPC_URL) });

const ERC20_ABI = [
  { name: 'mint', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }
] as const;

const VESTED_VAULT_ABI = [
  { name: 'buyVestedBond', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'principalAmount', type: 'uint256' }, { name: 'lockYears', type: 'uint256' }, { name: 'referrer', type: 'address' }], outputs: [{ name: 'tokenId', type: 'uint256' }] },
  { name: 'claimMatured', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [] }
] as const;

const POSITION_NFT_ABI = [
  { name: 'ownerOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] },
  { name: 'getPosition', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [
    { name: 'position', type: 'tuple', components: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'owner', type: 'address' },
      { name: 'bondTier', type: 'uint8' },
      { name: 'discountBps', type: 'uint256' },
      { name: 'depositTimestamp', type: 'uint256' },
      { name: 'maturityTimestamp', type: 'uint256' },
      { name: 'lastClaimTimestamp', type: 'uint256' },
      { name: 'principalAmount', type: 'uint256' },
      { name: 'discountedPricePaid', type: 'uint256' },
      { name: 'isRedeemed', type: 'bool' }
    ]}
  ]}
] as const;

const P2P_MARKET_ABI = [
  { name: 'borrowFromTreasuryWithAsset', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'collateralAsset', type: 'address' }, { name: 'collateralAmount', type: 'uint256' }, { name: 'borrowAmount', type: 'uint256' }, { name: 'durationDays', type: 'uint256' }], outputs: [{ name: 'loanId', type: 'uint256' }] },
  { name: 'repayLoan', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'loanId', type: 'uint256' }], outputs: [] },
  { name: 'liquidateLoan', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'loanId', type: 'uint256' }], outputs: [] },
  { name: 'calculateHealthFactor', type: 'function', stateMutability: 'view', inputs: [{ name: 'loanId', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'calculateTotalOwed', type: 'function', stateMutability: 'view', inputs: [{ name: 'loanId', type: 'uint256' }], outputs: [{ name: 'totalOwed', type: 'uint256' }, { name: 'interest', type: 'uint256' }] },
  { name: 'nextLoanId', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'loans', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'uint256' }], outputs: [
    { name: 'id', type: 'uint256' },
    { name: 'lender', type: 'address' },
    { name: 'borrower', type: 'address' },
    { name: 'positionTokenId', type: 'uint256' },
    { name: 'borrowAmount', type: 'uint256' },
    { name: 'collateralAmount', type: 'uint256' },
    { name: 'interestRateBps', type: 'uint256' },
    { name: 'durationDays', type: 'uint256' },
    { name: 'startTime', type: 'uint256' },
    { name: 'state', type: 'uint8' }
  ]}
] as const;

const CIRCUIT_BREAKER_ABI = [
  { name: 'isFrozen', type: 'function', stateMutability: 'view', inputs: [{ name: 'asset', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'resetBreaker', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'asset', type: 'address' }], outputs: [] }
] as const;

async function timeWarp(seconds: number) {
  await publicClient.request({ method: 'evm_increaseTime' as any, params: [seconds] as any });
  await publicClient.request({ method: 'evm_mine' as any, params: [] as any });
}

function loadContracts() {
  const p = path.resolve(__dirname, '../../../../frontend/src/contracts.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function runInstitutionalPersonasE2E() {
  console.log('\n============================================================');
  console.log('🏛️  INSTITUTIONAL E2E MULTI-PERSONA TEST SUITE');
  console.log('============================================================\n');

  const contracts = loadContracts();
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, stepName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${stepName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${stepName} - ${detail || 'Assertion failed'}`);
      failed++;
    }
  }

  // --- PERSONA 1: INVERSOR DE RENTA FIJA (vPOS DISCOUNT BONDS) ---
  console.log('[PERSONA 1] Inversor Institucional de Renta Fija (vPOS Bonds)...');
  try {
    const bondPrincipal = parseUnits('5000', 6); // 5,000 USDC
    await adminClient.writeContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'mint', args: [user1Acc.address, bondPrincipal] });
    await user1Client.writeContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'approve', args: [contracts.VESTED_VAULT, bondPrincipal] });

    const txBond = await user1Client.writeContract({
      address: contracts.VESTED_VAULT,
      abi: VESTED_VAULT_ABI,
      functionName: 'buyVestedBond',
      args: [bondPrincipal, 1n, '0x0000000000000000000000000000000000000000']
    });
    await publicClient.waitForTransactionReceipt({ hash: txBond });

    const bondTokenId = (await publicClient.readContract({
      address: contracts.POSITION_NFT,
      abi: [{ name: 'nextTokenId', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }],
      functionName: 'nextTokenId'
    })) - 1n;

    const nftOwner = await publicClient.readContract({
      address: contracts.POSITION_NFT,
      abi: POSITION_NFT_ABI,
      functionName: 'ownerOf',
      args: [bondTokenId]
    });
    assert(nftOwner.toLowerCase() === user1Acc.address.toLowerCase(), `P1: vPOS NFT #${bondTokenId} emitido y custodiado por User1`);

    // Time warp 366 days to mature 1-year bond
    await timeWarp(366 * 86400);

    const balBeforeRedeem = await publicClient.readContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [user1Acc.address] });
    const txRedeem = await user1Client.writeContract({
      address: contracts.VESTED_VAULT,
      abi: VESTED_VAULT_ABI,
      functionName: 'claimMatured',
      args: [bondTokenId]
    });
    await publicClient.waitForTransactionReceipt({ hash: txRedeem });
    const balAfterRedeem = await publicClient.readContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [user1Acc.address] });

    assert(balAfterRedeem > balBeforeRedeem, `P1: Posición #${bondTokenId} liquidada y principal retornado a User1 tras vencimiento`);
  } catch (e: any) {
    assert(false, 'P1: Flujo de Renta Fija vPOS', e.message);
  }

  // --- PERSONA 2: PRESTATARIO INSTITUCIONAL MULTI-COLATERAL ---
  console.log('\n[PERSONA 2] Prestatario Multi-Colateral (WBTC, WETH, ALPHA)...');
  try {
    // 1. WBTC Loan (8 decimals, 70% Max LTV)
    const wbtcCol = parseUnits('0.2', 8); // 0.2 WBTC = $12,000 USD
    const borrowWbtcUsdc = parseUnits('6000', 6); // $6,000 USDC borrow (50% LTV, well under 70%)

    const wbtcBalStart = await publicClient.readContract({ address: contracts.WBTC, abi: ERC20_ABI, functionName: 'balanceOf', args: [user2Acc.address] });
    await adminClient.writeContract({ address: contracts.WBTC, abi: ERC20_ABI, functionName: 'mint', args: [user2Acc.address, wbtcCol] });
    await user2Client.writeContract({ address: contracts.WBTC, abi: ERC20_ABI, functionName: 'approve', args: [contracts.P2P_MARKET, wbtcCol] });

    const txBorrowWbtc = await user2Client.writeContract({
      address: contracts.P2P_MARKET,
      abi: P2P_MARKET_ABI,
      functionName: 'borrowFromTreasuryWithAsset',
      args: [contracts.WBTC, wbtcCol, borrowWbtcUsdc, 30n]
    });
    await publicClient.waitForTransactionReceipt({ hash: txBorrowWbtc });

    const wbtcLoanId = (await publicClient.readContract({ address: contracts.P2P_MARKET, abi: P2P_MARKET_ABI, functionName: 'nextLoanId' })) - 1n;

    const hfWbtc = await publicClient.readContract({ address: contracts.P2P_MARKET, abi: P2P_MARKET_ABI, functionName: 'calculateHealthFactor', args: [wbtcLoanId] });
    assert(Number(hfWbtc) >= 190, `P2: Préstamo WBTC #${wbtcLoanId} activo y solvente (Salud: ${Number(hfWbtc)}% >= 190%)`);

    // Repay WBTC Loan with exact calculation + buffer for block time interest
    const [totalOwedWbtc] = await publicClient.readContract({ address: contracts.P2P_MARKET, abi: P2P_MARKET_ABI, functionName: 'calculateTotalOwed', args: [wbtcLoanId] });
    const wbtcRepayFund = totalOwedWbtc + parseUnits('50', 6);
    await adminClient.writeContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'mint', args: [user2Acc.address, wbtcRepayFund] });
    await user2Client.writeContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'approve', args: [contracts.P2P_MARKET, wbtcRepayFund] });

    const txRepayWbtc = await user2Client.writeContract({ address: contracts.P2P_MARKET, abi: P2P_MARKET_ABI, functionName: 'repayLoan', args: [wbtcLoanId] });
    await publicClient.waitForTransactionReceipt({ hash: txRepayWbtc });

    const finalWbtcBal = await publicClient.readContract({ address: contracts.WBTC, abi: ERC20_ABI, functionName: 'balanceOf', args: [user2Acc.address] });
    assert(finalWbtcBal === wbtcBalStart + wbtcCol, 'P2: Deuda WBTC reembolsada y 100% de WBTC restituido exactamente');

    // 2. WETH Loan (18 decimals, 75% Max LTV)
    const wethCol = parseUnits('3', 18); // 3 WETH = $9,000 USD
    const borrowWethUsdc = parseUnits('4500', 6); // $4,500 USDC borrow (50% LTV)

    const wethBalStart = await publicClient.readContract({ address: contracts.WETH, abi: ERC20_ABI, functionName: 'balanceOf', args: [user2Acc.address] });
    await adminClient.writeContract({ address: contracts.WETH, abi: ERC20_ABI, functionName: 'mint', args: [user2Acc.address, wethCol] });
    await user2Client.writeContract({ address: contracts.WETH, abi: ERC20_ABI, functionName: 'approve', args: [contracts.P2P_MARKET, wethCol] });

    const txBorrowWeth = await user2Client.writeContract({
      address: contracts.P2P_MARKET,
      abi: P2P_MARKET_ABI,
      functionName: 'borrowFromTreasuryWithAsset',
      args: [contracts.WETH, wethCol, borrowWethUsdc, 30n]
    });
    await publicClient.waitForTransactionReceipt({ hash: txBorrowWeth });

    const wethLoanId = (await publicClient.readContract({ address: contracts.P2P_MARKET, abi: P2P_MARKET_ABI, functionName: 'nextLoanId' })) - 1n;

    const hfWeth = await publicClient.readContract({ address: contracts.P2P_MARKET, abi: P2P_MARKET_ABI, functionName: 'calculateHealthFactor', args: [wethLoanId] });
    assert(Number(hfWeth) >= 190, `P2: Préstamo WETH #${wethLoanId} activo y solvente (Salud: ${Number(hfWeth)}% >= 190%)`);

    const [totalOwedWeth] = await publicClient.readContract({ address: contracts.P2P_MARKET, abi: P2P_MARKET_ABI, functionName: 'calculateTotalOwed', args: [wethLoanId] });
    const wethRepayFund = totalOwedWeth + parseUnits('50', 6);
    await adminClient.writeContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'mint', args: [user2Acc.address, wethRepayFund] });
    await user2Client.writeContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'approve', args: [contracts.P2P_MARKET, wethRepayFund] });

    const txRepayWeth = await user2Client.writeContract({ address: contracts.P2P_MARKET, abi: P2P_MARKET_ABI, functionName: 'repayLoan', args: [wethLoanId] });
    await publicClient.waitForTransactionReceipt({ hash: txRepayWeth });

    const finalWethBal = await publicClient.readContract({ address: contracts.WETH, abi: ERC20_ABI, functionName: 'balanceOf', args: [user2Acc.address] });
    assert(finalWethBal === wethBalStart + wethCol, 'P2: Deuda WETH reembolsada y 100% de WETH restituido exactamente');
  } catch (e: any) {
    assert(false, 'P2: Flujo Multi-Colateral', e.message);
  }

  // --- PERSONA 3: BOT DE AUTO-LIQUIDACIÓN Y ARBITRAJE ---
  console.log('\n[PERSONA 3] Bot Liquidador (Defensa contra Reversiones y Ejecución por Impago)...');
  try {
    // Open a 3rd loan with 1 WETH ($3,000 USD) borrowing $2,000 USDC (66.6% LTV)
    const wethCol3 = parseUnits('1', 18);
    const borrowAmt3 = parseUnits('2000', 6);

    await adminClient.writeContract({ address: contracts.WETH, abi: ERC20_ABI, functionName: 'mint', args: [user2Acc.address, wethCol3] });
    await user2Client.writeContract({ address: contracts.WETH, abi: ERC20_ABI, functionName: 'approve', args: [contracts.P2P_MARKET, wethCol3] });
    const tx3 = await user2Client.writeContract({
      address: contracts.P2P_MARKET,
      abi: P2P_MARKET_ABI,
      functionName: 'borrowFromTreasuryWithAsset',
      args: [contracts.WETH, wethCol3, borrowAmt3, 30n]
    });
    await publicClient.waitForTransactionReceipt({ hash: tx3 });

    const liqLoanId = (await publicClient.readContract({ address: contracts.P2P_MARKET, abi: P2P_MARKET_ABI, functionName: 'nextLoanId' })) - 1n;

    // Step A: Negative Test - Attempting to liquidate a healthy loan should be rejected
    const hfHealthy = await publicClient.readContract({ address: contracts.P2P_MARKET, abi: P2P_MARKET_ABI, functionName: 'calculateHealthFactor', args: [liqLoanId] });
    assert(Number(hfHealthy) >= 115, `P3: Préstamo #${liqLoanId} es solvente (${Number(hfHealthy)}% >= 115%), protegido contra liquidaciones abusivas`);

    // Step B: Simulate Delinquency via Time Expiration (31 days)
    await timeWarp(31 * 86400);

    // Step C: Liquidator Bot pays exact debt and seizes only fair collateral (Debt + 10% Bonus)
    const [totalOwed3] = await publicClient.readContract({ address: contracts.P2P_MARKET, abi: P2P_MARKET_ABI, functionName: 'calculateTotalOwed', args: [liqLoanId] });
    await adminClient.writeContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'mint', args: [liquidatorAcc.address, totalOwed3] });
    await liquidatorClient.writeContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'approve', args: [contracts.P2P_MARKET, totalOwed3] });

    const borrowerWethBefore = await publicClient.readContract({ address: contracts.WETH, abi: ERC20_ABI, functionName: 'balanceOf', args: [user2Acc.address] });
    const liqWethBefore = await publicClient.readContract({ address: contracts.WETH, abi: ERC20_ABI, functionName: 'balanceOf', args: [liquidatorAcc.address] });

    const txLiq = await liquidatorClient.writeContract({
      address: contracts.P2P_MARKET,
      abi: P2P_MARKET_ABI,
      functionName: 'liquidateLoan',
      args: [liqLoanId]
    });
    await publicClient.waitForTransactionReceipt({ hash: txLiq });

    const liqWethAfter = await publicClient.readContract({ address: contracts.WETH, abi: ERC20_ABI, functionName: 'balanceOf', args: [liquidatorAcc.address] });
    const borrowerWethAfter = await publicClient.readContract({ address: contracts.WETH, abi: ERC20_ABI, functionName: 'balanceOf', args: [user2Acc.address] });

    const liqWethReceived = liqWethAfter - liqWethBefore;
    const borrowerWethRestituted = borrowerWethAfter - borrowerWethBefore;

    assert(liqWethReceived > 0n && liqWethReceived < wethCol3, `P3: Fair Liquidation entregó colateral justo + 10% bonus al liquidador (${formatUnits(liqWethReceived, 18)} WETH)`);
    assert(borrowerWethRestituted > 0n, `P3: Fair Liquidation restituyó el excedente de colateral (${formatUnits(borrowerWethRestituted, 18)} WETH) a la wallet del prestatario`);
  } catch (e: any) {
    assert(false, 'P3: Flujo de Liquidación', e.message);
  }

  // --- PERSONA 5: GUARDIÁN DEL CIRCUIT BREAKER ---
  console.log('\n[PERSONA 5] Guardián de Seguridad & Circuit Breaker...');
  try {
    const isFrozenBefore = await publicClient.readContract({ address: contracts.CIRCUIT_BREAKER, abi: CIRCUIT_BREAKER_ABI, functionName: 'isFrozen', args: [contracts.USDC] });
    assert(!isFrozenBefore, 'P5: Circuit Breaker en estado normal operativo para USDC');

    // Reset breaker (already normal)
    const txReset = await adminClient.writeContract({
      address: contracts.CIRCUIT_BREAKER,
      abi: CIRCUIT_BREAKER_ABI,
      functionName: 'resetBreaker',
      args: [contracts.USDC]
    });
    await publicClient.waitForTransactionReceipt({ hash: txReset });

    const isFrozenFinal = await publicClient.readContract({ address: contracts.CIRCUIT_BREAKER, abi: CIRCUIT_BREAKER_ABI, functionName: 'isFrozen', args: [contracts.USDC] });
    assert(!isFrozenFinal, 'P5: Protocolo verificado en operatividad normal');
  } catch (e: any) {
    assert(false, 'P5: Flujo de Circuit Breaker', e.message);
  }

  console.log('\n============================================================');
  console.log(` INSTITUTIONAL E2E SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runInstitutionalPersonasE2E().catch((err) => {
  console.error('[!] Fatal error in E2E personas:', err);
  process.exit(1);
});
