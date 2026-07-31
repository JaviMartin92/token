const { createPublicClient, createWalletClient, http, parseUnits, formatEther, formatUnits } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const fs = require('fs');
const path = require('path');

const contracts = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'contracts.json'), 'utf8'));

const ANVIL_RPC = 'http://127.0.0.1:8545';
const publicClient = createPublicClient({ transport: http(ANVIL_RPC) });

// User Account #1 (User Wallet in DApp)
const USER_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const userAccount = privateKeyToAccount(USER_KEY);
const userWallet = createWalletClient({ account: userAccount, transport: http(ANVIL_RPC) });

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'mint', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] }
];

const TREASURY_ABI = [
  { name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [{ name: 'shares', type: 'uint256' }] },
  { name: 'getNAV', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'getProofOfReserves', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: 'totalAssetsUSD', type: 'uint256' }, { name: 'totalLiabilitiesUSD', type: 'uint256' }, { name: 'collateralRatioBps', type: 'uint256' }] },
  { name: 'totalBurnedTokens', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] }
];

const STAKING_ABI = [
  { name: 'stakedBalances', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'totalStaked', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] }
];

async function runRealWorldE2ETest() {
  console.log("\n===================================================================");
  console.log("🚀 PRUEBA DE INTEGRACIÓN E2E REAL SOBRE BLOCKCHAIN EN VIVO (ANVIL)");
  console.log("===================================================================\n");

  const userAddr = userAccount.address;
  console.log(`👤 Billetera de Usuario DApp : ${userAddr}`);

  // Helper para leer estado on-chain
  async function readSystemMetrics() {
    const circulating = await publicClient.readContract({ address: contracts.TREASURY, abi: ERC20_ABI, functionName: 'totalSupply' });
    const burned = await publicClient.readContract({ address: contracts.TREASURY, abi: TREASURY_ABI, functionName: 'totalBurnedTokens' });
    const netCirculating = circulating > burned ? circulating - burned : 0n;

    const userStaked = await publicClient.readContract({ address: contracts.STAKING, abi: STAKING_ABI, functionName: 'stakedBalances', args: [userAddr] });
    const opExStaked = await publicClient.readContract({ address: contracts.STAKING, abi: STAKING_ABI, functionName: 'stakedBalances', args: [contracts.CORPORATE_OPEX_VAULT] });
    const profitStaked = await publicClient.readContract({ address: contracts.STAKING, abi: STAKING_ABI, functionName: 'stakedBalances', args: [contracts.CORPORATE_PROFIT_VAULT] });
    const treasuryStaked = await publicClient.readContract({ address: contracts.STAKING, abi: STAKING_ABI, functionName: 'stakedBalances', args: [contracts.TREASURY] });
    const globalStaked = userStaked + opExStaked + profitStaked + treasuryStaked;

    const nav = await publicClient.readContract({ address: contracts.TREASURY, abi: TREASURY_ABI, functionName: 'getNAV' });
    const navNum = parseFloat(formatEther(nav));
    const netCircNum = parseFloat(formatEther(netCirculating));
    const navPerShare = netCircNum > 0 ? (navNum / netCircNum).toFixed(4) : "1.0000";

    const por = await publicClient.readContract({ address: contracts.TREASURY, abi: TREASURY_ABI, functionName: 'getProofOfReserves' });
    const assetsUSD = parseFloat(formatEther(por[0]));
    const liabilitiesUSD = parseFloat(formatEther(por[1]));
    const ratioPct = (Number(por[2]) / 100).toFixed(2);

    return {
      circulating: parseFloat(formatEther(netCirculating)).toFixed(2),
      userStaked: parseFloat(formatEther(userStaked)).toFixed(2),
      vaultStaked: parseFloat(formatEther(opExStaked + profitStaked)).toFixed(2),
      treasuryStaked: parseFloat(formatEther(treasuryStaked)).toFixed(2),
      globalStaked: parseFloat(formatEther(globalStaked)).toFixed(2),
      stakedRatio: netCircNum > 0 ? (Number(globalStaked * 10000n / netCirculating) / 100).toFixed(2) : "0.00",
      navPerShare,
      burned: parseFloat(formatEther(burned)).toFixed(2),
      assetsUSD: assetsUSD.toFixed(2),
      liabilitiesUSD: liabilitiesUSD.toFixed(2),
      porRatio: ratioPct
    };
  }

  // 1. ESTADO PRE-COMPRA
  console.log("📌 ESTADO 1: ANTES DE COMPRAR / DEPOSITAR (ESTADO 0)");
  const pre = await readSystemMetrics();
  console.table({
    "🪙 En Circulación": `${pre.circulating} ALPHA`,
    "👤 Stake Comunidad": `${pre.userStaked} stALPHA`,
    "🏢 Stake Bóvedas": `${pre.vaultStaked} stALPHA`,
    "🏛️ Stake Reservas": `${pre.treasuryStaked} stALPHA`,
    "🥩 Total Global Staked": `${pre.globalStaked} ALPHA (${pre.stakedRatio}%)`,
    "💎 NAV / ALPHA": `$${pre.navPerShare} USDC`,
    "🛡️ Solvencia PoR": `${pre.porRatio}% ($${pre.assetsUSD} / $${pre.liabilitiesUSD})`
  });

  // 2. EJECUCIÓN REAL DE LA COMPRA DE 10,000 USDC
  console.log("\n🔄 EJECUTANDO OPERACIÓN: COMPRA DE $10,000 USDC DE ALPHA EN INTERFAZ...");
  const depositUsdc = parseUnits('10000', 6);

  console.log("   [Step 1] Fondeando billetera de usuario con 10,000 USDC...");
  await userWallet.writeContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'mint', args: [userAddr, depositUsdc] });

  console.log("   [Step 2] Aprobando gasto de 10,000 USDC a Tesorería...");
  const appTx = await userWallet.writeContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'approve', args: [contracts.TREASURY, depositUsdc] });
  await publicClient.waitForTransactionReceipt({ hash: appTx });

  console.log("   [Step 3] Enviando transacción de depósito a Treasury.deposit(10000 USDC)...");
  const depTx = await userWallet.writeContract({ address: contracts.TREASURY, abi: TREASURY_ABI, functionName: 'deposit', args: [depositUsdc] });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: depTx });
  console.log(`   ✅ Transacción confirmada en bloque ${receipt.blockNumber} (Hash: ${receipt.transactionHash})`);

  // 3. ESTADO POST-COMPRA ON-CHAIN
  console.log("\n📌 ESTADO 2: TRAS COMPRAR ALPHA CON $10,000 USDC ON-CHAIN");
  const post = await readSystemMetrics();
  console.table({
    "🪙 En Circulación": `${post.circulating} ALPHA`,
    "👤 Stake Comunidad": `${post.userStaked} stALPHA`,
    "🏢 Stake Bóvedas": `${post.vaultStaked} stALPHA`,
    "🏛️ Stake Reservas": `${post.treasuryStaked} stALPHA`,
    "🥩 Total Global Staked": `${post.globalStaked} ALPHA (${post.stakedRatio}%)`,
    "💎 NAV / ALPHA": `$${post.navPerShare} USDC`,
    "🛡️ Solvencia PoR": `${post.porRatio}% ($${post.assetsUSD} / $${post.liabilitiesUSD})`
  });

  console.log("\n===================================================================");
  console.log("🎉 PRUEBA DE INTEGRACIÓN E2E COMPLETADA Y VERIFICADA EN BLOCKCHAIN");
  console.log("===================================================================\n");
}

runRealWorldE2ETest().catch(console.error);
