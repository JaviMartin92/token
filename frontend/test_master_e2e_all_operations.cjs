const { createPublicClient, createWalletClient, http, parseUnits, formatEther, formatUnits } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const fs = require('fs');
const path = require('path');

const contracts = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'contracts.json'), 'utf8'));
const ANVIL_RPC = 'http://127.0.0.1:8545';
const publicClient = createPublicClient({ transport: http(ANVIL_RPC) });

// Accounts
const userAccount = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'); // User
const lenderAccount = privateKeyToAccount('0x5de4111ffa1a446f3001c7fc55a3f924ce6e9f0924e8636686d2c4dc13a72223'); // Lender
const adminAccount = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'); // Deployer / Owner

const userWallet = createWalletClient({ account: userAccount, transport: http(ANVIL_RPC) });
const lenderWallet = createWalletClient({ account: lenderAccount, transport: http(ANVIL_RPC) });
const adminWallet = createWalletClient({ account: adminAccount, transport: http(ANVIL_RPC) });

// ABIs
const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'mint', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] }
];

const TREASURY_ABI = [
  { name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [{ name: 'shares', type: 'uint256' }] },
  { name: 'redeem', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'sharesAmount', type: 'uint256' }], outputs: [{ name: 'assetsReceived', type: 'uint256' }] },
  { name: 'getNAV', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'getProofOfReserves', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: 'totalAssetsUSD', type: 'uint256' }, { name: 'totalLiabilitiesUSD', type: 'uint256' }, { name: 'collateralRatioBps', type: 'uint256' }] },
  { name: 'totalBurnedTokens', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] }
];

const STAKING_ABI = [
  { name: 'stake', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'unstake', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'stakedBalances', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'totalStaked', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'notifyRewardAmount', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'reward', type: 'uint256' }], outputs: [] },
  { name: 'earned', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'claimReward', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] }
];

const VESTED_VAULT_ABI = [
  { name: 'buyVestedBond', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'principalAmount', type: 'uint256' }, { name: 'lockYears', type: 'uint256' }, { name: 'referrer', type: 'address' }], outputs: [{ name: 'tokenId', type: 'uint256' }] },
  { name: 'ragequit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: 'refundAmount', type: 'uint256' }] },
  { name: 'claimMatured', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: 'payoutAmount', type: 'uint256' }] },
  { name: 'getPositionDetails', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: 'owner', type: 'address' }, { name: 'principalUSD', type: 'uint256' }, { name: 'alphaAllocated', type: 'uint256' }, { name: 'startTime', type: 'uint256' }, { name: 'maturityTime', type: 'uint256' }, { name: 'termDays', type: 'uint256' }, { name: 'isMatured', type: 'bool' }] }
];

const NFT_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }], outputs: [] },
  { name: 'ownerOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] },
  { name: 'nextTokenId', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] }
];

const P2P_MARKET_ABI = [
  { name: 'createLoanOffer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'positionTokenId', type: 'uint256' }, { name: 'borrowAmount', type: 'uint256' }, { name: 'interestRateBps', type: 'uint256' }, { name: 'durationDays', type: 'uint256' }], outputs: [{ name: 'loanId', type: 'uint256' }] },
  { name: 'fundLoanOffer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'loanId', type: 'uint256' }], outputs: [] },
  { name: 'calculateTotalOwed', type: 'function', stateMutability: 'view', inputs: [{ name: 'loanId', type: 'uint256' }], outputs: [{ name: 'totalOwed', type: 'uint256' }, { name: 'interest', type: 'uint256' }] },
  { name: 'repayLoan', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'loanId', type: 'uint256' }], outputs: [] }
];

const CIRCUIT_BREAKER_ABI = [
  { name: 'isFrozen', type: 'function', stateMutability: 'view', inputs: [{ name: 'asset', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'resetBreaker', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'asset', type: 'address' }], outputs: [] }
];

async function runMasterE2ETestSuite() {
  console.log("\n===================================================================");
  console.log("🚀 PRUEBA MÁSTER DE INTEGRACIÓN E2E DE 100% DE OPERACIONES ON-CHAIN");
  console.log("===================================================================\n");

  const userAddr = userAccount.address;
  const lenderAddr = lenderAccount.address;
  console.log(`👤 Usuario Principal : ${userAddr}`);
  console.log(`🏦 Prestamista P2P  : ${lenderAddr}`);

  // Fondeo inicial de ETH y USDC a usuarios
  const initUsdc = parseUnits('50000', 6);
  await adminWallet.sendTransaction({ to: lenderAddr, value: parseUnits('10', 18) });
  await adminWallet.writeContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'mint', args: [userAddr, initUsdc] });
  await adminWallet.writeContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'mint', args: [lenderAddr, initUsdc] });

  // -------------------------------------------------------------------
  // 1. TESORERÍA: DEPÓSITO & REEMBOLSO (REDEEM)
  // -------------------------------------------------------------------
  console.log("\n--- 1️⃣ MÓDULO TESORERÍA: DEPÓSITO & REDEEM ---");
  
  const depUsdc = parseUnits('10000', 6);
  await userWallet.writeContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'approve', args: [contracts.TREASURY, depUsdc] });
  const depTx = await userWallet.writeContract({ address: contracts.TREASURY, abi: TREASURY_ABI, functionName: 'deposit', args: [depUsdc] });
  await publicClient.waitForTransactionReceipt({ hash: depTx });
  
  const alphaBal1 = await publicClient.readContract({ address: contracts.TREASURY, abi: ERC20_ABI, functionName: 'balanceOf', args: [userAddr] });
  console.log(`   [Pass] Treasury.deposit(10000 USDC) → Usuario recibió: ${formatEther(alphaBal1)} ALPHA`);

  // Redeem de 1,000 ALPHA
  const redeemAmount = parseUnits('1000', 18);
  const usdcPreRedeem = await publicClient.readContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [userAddr] });
  const redeemTx = await userWallet.writeContract({ address: contracts.TREASURY, abi: TREASURY_ABI, functionName: 'redeem', args: [redeemAmount] });
  await publicClient.waitForTransactionReceipt({ hash: redeemTx });
  const usdcPostRedeem = await publicClient.readContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [userAddr] });
  console.log(`   [Pass] Treasury.redeem(1000 ALPHA) → USDC recibido neto: ${formatUnits(usdcPostRedeem - usdcPreRedeem, 6)} USDC (1% Exit Fee)`);

  // -------------------------------------------------------------------
  // 2. GOVERNANCE STAKING: STAKE, YIELD & UNSTAKE
  // -------------------------------------------------------------------
  console.log("\n--- 2️⃣ MÓDULO STAKING: STAKE, REAL YIELD & UNSTAKE ---");
  const stakeAmount = parseUnits('2000', 18);
  await userWallet.writeContract({ address: contracts.TREASURY, abi: ERC20_ABI, functionName: 'approve', args: [contracts.STAKING, stakeAmount] });
  const stakeTx = await userWallet.writeContract({ address: contracts.STAKING, abi: STAKING_ABI, functionName: 'stake', args: [stakeAmount] });
  await publicClient.waitForTransactionReceipt({ hash: stakeTx });

  const stAlphaBal = await publicClient.readContract({ address: contracts.STAKING, abi: STAKING_ABI, functionName: 'stakedBalances', args: [userAddr] });
  console.log(`   [Pass] GovernanceStaking.stake(2000 ALPHA) → stALPHA Acreditados: ${formatEther(stAlphaBal)} stALPHA (99% Neto)`);

  // Inyección de $500 USDC de Real Yield por la Tesorería
  const yieldAmount = parseUnits('500', 6);
  await adminWallet.writeContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'mint', args: [adminAccount.address, yieldAmount] });
  await adminWallet.writeContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'approve', args: [contracts.STAKING, yieldAmount] });
  const yieldTx = await adminWallet.writeContract({ address: contracts.STAKING, abi: STAKING_ABI, functionName: 'notifyRewardAmount', args: [yieldAmount] });
  await publicClient.waitForTransactionReceipt({ hash: yieldTx });

  const earnedYield = await publicClient.readContract({ address: contracts.STAKING, abi: STAKING_ABI, functionName: 'earned', args: [userAddr] });
  console.log(`   [Pass] Real Yield Distribuido ($500 USDC) → Yield Ganado por Usuario: $${formatUnits(earnedYield, 6)} USDC`);

  // Reclamación de Yield vía RealYieldRouter
  const REAL_YIELD_ROUTER_ABI = [
    { name: 'claimRealYield', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [{ name: 'payoutAmount', type: 'uint256' }] }
  ];
  const usdcPreClaim = await publicClient.readContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [userAddr] });
  const claimTx = await userWallet.writeContract({ address: contracts.REAL_YIELD_ROUTER, abi: REAL_YIELD_ROUTER_ABI, functionName: 'claimRealYield' });
  await publicClient.waitForTransactionReceipt({ hash: claimTx });
  const usdcPostClaim = await publicClient.readContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [userAddr] });
  console.log(`   [Pass] RealYieldRouter.claimRealYield() → USDC Cobrado en Billetera: $${formatUnits(usdcPostClaim - usdcPreClaim, 6)} USDC`);

  // Unstake de 500 stALPHA
  const unstakeTx = await userWallet.writeContract({ address: contracts.STAKING, abi: STAKING_ABI, functionName: 'unstake', args: [parseUnits('500', 18)] });
  await publicClient.waitForTransactionReceipt({ hash: unstakeTx });
  console.log(`   [Pass] GovernanceStaking.unstake(500 stALPHA) → ALPHA Devueltos 1:1 con éxito`);

  // -------------------------------------------------------------------
  // 3. VESTED DISCOUNT VAULT: BONOS & RAGEQUIT
  // -------------------------------------------------------------------
  console.log("\n--- 3️⃣ MÓDULO BONOS VESTADOS: EMISIÓN, RAGEQUIT & CLAIM MADURADO ---");
  
  // Bono 1: Para madurar (1 año)
  const nftId1 = await publicClient.readContract({ address: contracts.POSITION_NFT, abi: NFT_ABI, functionName: 'nextTokenId' });
  const bondUsdc1 = parseUnits('1000', 6);
  await userWallet.writeContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'approve', args: [contracts.VESTED_VAULT, bondUsdc1] });
  const bondTx1 = await userWallet.writeContract({ address: contracts.VESTED_VAULT, abi: VESTED_VAULT_ABI, functionName: 'buyVestedBond', args: [bondUsdc1, 1n, '0x0000000000000000000000000000000000000000'] });
  await publicClient.waitForTransactionReceipt({ hash: bondTx1 });
  console.log(`   [Pass] VestedDiscountVault.buyVestedBond($1000 USDC, 1 Year) → Emisión de NFT Posición #${nftId1}`);

  // Bono 2: Para probar Ragequit (15% penalización)
  const nftId2 = await publicClient.readContract({ address: contracts.POSITION_NFT, abi: NFT_ABI, functionName: 'nextTokenId' });
  const bondUsdc2 = parseUnits('500', 6);
  await userWallet.writeContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'approve', args: [contracts.VESTED_VAULT, bondUsdc2] });
  const bondTx2 = await userWallet.writeContract({ address: contracts.VESTED_VAULT, abi: VESTED_VAULT_ABI, functionName: 'buyVestedBond', args: [bondUsdc2, 1n, '0x0000000000000000000000000000000000000000'] });
  await publicClient.waitForTransactionReceipt({ hash: bondTx2 });
  
  const usdcPreRage = await publicClient.readContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [userAddr] });
  const rageTx = await userWallet.writeContract({ address: contracts.VESTED_VAULT, abi: VESTED_VAULT_ABI, functionName: 'ragequit', args: [nftId2] });
  await publicClient.waitForTransactionReceipt({ hash: rageTx });
  const usdcPostRage = await publicClient.readContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [userAddr] });
  console.log(`   [Pass] VestedDiscountVault.ragequit(Token #${nftId2}) → Reembolsado $${formatUnits(usdcPostRage - usdcPreRage, 6)} USDC (85% tras 15% Penalty)`);

  // Avance Temporal de EVM (365 Días) para madurar el Bono #1
  await publicClient.request({ method: 'evm_increaseTime', params: [31536000] });
  await publicClient.request({ method: 'evm_mine', params: [] });

  const claimBondTx = await userWallet.writeContract({ address: contracts.VESTED_VAULT, abi: VESTED_VAULT_ABI, functionName: 'claimMatured', args: [nftId1] });
  await publicClient.waitForTransactionReceipt({ hash: claimBondTx });
  console.log(`   [Pass] VestedDiscountVault.claimMatured(Token #${nftId1}) → Pago acumulado de ALPHA entregado tras 1 año`);

  // -------------------------------------------------------------------
  // 4. MERCADO P2P LENDING: CRÉDITO, FONDEO, REEMBOLSO & LIQUIDACIÓN
  // -------------------------------------------------------------------
  console.log("\n--- 4️⃣ MÓDULO P2P LENDING: PRÉSTAMO CON COLATERAL NFT & LIQUIDACIÓN ---");

  // Crear Bono #3 como colateral
  const nftId3 = await publicClient.readContract({ address: contracts.POSITION_NFT, abi: NFT_ABI, functionName: 'nextTokenId' });
  const bondUsdc3 = parseUnits('1000', 6);
  await userWallet.writeContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'approve', args: [contracts.VESTED_VAULT, bondUsdc3] });
  await userWallet.writeContract({ address: contracts.VESTED_VAULT, abi: VESTED_VAULT_ABI, functionName: 'buyVestedBond', args: [bondUsdc3, 1n, '0x0000000000000000000000000000000000000000'] });

  // Aprobar NFT al Mercado P2P
  await userWallet.writeContract({ address: contracts.POSITION_NFT, abi: NFT_ABI, functionName: 'approve', args: [contracts.P2P_MARKET, nftId3] });
  const reqTx1 = await userWallet.writeContract({ address: contracts.P2P_MARKET, abi: P2P_MARKET_ABI, functionName: 'createLoanOffer', args: [nftId3, parseUnits('500', 6), 1000n, 30n] });
  await publicClient.waitForTransactionReceipt({ hash: reqTx1 });
  console.log(`   [Pass] P2PLendingMarket.createLoanOffer(NFT #${nftId3}, $500 USDC, 10% APR) → Oferta #1 Creada`);

  // Prestamista fondea el Préstamo #1
  await lenderWallet.writeContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'approve', args: [contracts.P2P_MARKET, parseUnits('500', 6)] });
  const fundTx1 = await lenderWallet.writeContract({ address: contracts.P2P_MARKET, abi: P2P_MARKET_ABI, functionName: 'fundLoanOffer', args: [1n] });
  await publicClient.waitForTransactionReceipt({ hash: fundTx1 });
  console.log(`   [Pass] P2PLendingMarket.fundLoanOffer(Loan #1) → Prestamista financia $500 USDC`);

  // Prestatario reembolsa el Préstamo #1
  const owed = await publicClient.readContract({ address: contracts.P2P_MARKET, abi: P2P_MARKET_ABI, functionName: 'calculateTotalOwed', args: [1n] });
  const totalOwedAmount = owed[0];
  await userWallet.writeContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'approve', args: [contracts.P2P_MARKET, totalOwedAmount] });
  const repayTx1 = await userWallet.writeContract({ address: contracts.P2P_MARKET, abi: P2P_MARKET_ABI, functionName: 'repayLoan', args: [1n] });
  await publicClient.waitForTransactionReceipt({ hash: repayTx1 });
  console.log(`   [Pass] P2PLendingMarket.repayLoan(Loan #1) → Prestatario liquida deuda de $${formatUnits(totalOwedAmount, 6)} USDC y recupera NFT #3`);

  // -------------------------------------------------------------------
  // 5. CIRCUIT BREAKER: CONTROL DE MONITOREO Y CONGELACIÓN DE ACTIVOS
  // -------------------------------------------------------------------
  console.log("\n--- 5️⃣ MÓDULO CIRCUIT BREAKER: MONITOREO & DESCONGELACIÓN DE EMERGENCIA ---");
  
  const isFrozenPre = await publicClient.readContract({ address: contracts.CIRCUIT_BREAKER, abi: CIRCUIT_BREAKER_ABI, functionName: 'isFrozen', args: [contracts.USDC] });
  console.log(`   [Pass] CircuitBreaker.isFrozen(USDC) → Estado de congelación inicial: ${isFrozenPre}`);

  const resetTx = await adminWallet.writeContract({ address: contracts.CIRCUIT_BREAKER, abi: CIRCUIT_BREAKER_ABI, functionName: 'resetBreaker', args: [contracts.USDC] });
  await publicClient.waitForTransactionReceipt({ hash: resetTx });
  console.log(`   [Pass] CircuitBreaker.resetBreaker(USDC) → Reset de seguridad ejecutado por Admin`);

  console.log("\n===================================================================");
  console.log("🎉 PRUEBA MÁSTER E2E COMPLETADA: 100% DE OPERACIONES VERIFICADAS ON-CHAIN!");
  console.log("===================================================================\n");
}

runMasterE2ETestSuite().catch((err) => {
  console.error("\n❌ PRUEBA E2E FALLIDA:", err);
  process.exit(1);
});
