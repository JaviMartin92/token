import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toHex,
  parseUnits
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const rootDir = path.resolve(__dirname, '..');
const RPC_URL =
  process.env.ARBITRUM_SEPOLIA_RPC_URL ||
  process.env.VITE_PUBLIC_RPC_URL ||
  'https://sepolia-rollup.arbitrum.io/rpc';

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

function loadArtifact(name: string) {
  const p = path.resolve(rootDir, `contracts/out/${name}.sol/${name}.json`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function main() {
  console.log('================================================================');
  console.log('  DESPLIEGUE P2P LENDING & CORRECCIÓN DE ROLES STAKING          ');
  console.log('================================================================');

  let privateKey = (
    process.env.DEPLOYER_KEY ||
    process.env.PRIVATE_KEY ||
    process.env.BACKEND_OPERATOR_PRIVATE_KEY ||
    ''
  ).trim();

  if (!privateKey) {
    privateKey = await askQuestion('👉 Introduce la clave privada del desplegador (0x...): ');
  }

  if (!privateKey.startsWith('0x')) {
    privateKey = `0x${privateKey}`;
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log(`[+] Cuenta de despliegue: ${account.address}`);

  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(RPC_URL)
  });

  const walletClient = createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http(RPC_URL)
  });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`[+] Saldo disponible: ${Number(balance) / 1e18} ETH\n`);

  const contractsPath = path.resolve(rootDir, 'frontend/src/contracts.json');
  const contracts = JSON.parse(fs.readFileSync(contractsPath, 'utf8'));

  const treasuryAddr = contracts.TREASURY as `0x${string}`;
  const stakingAddr = contracts.STAKING as `0x${string}`;
  const buybackAddr = contracts.DISCOUNT_BUYBACK_ENGINE as `0x${string}`;
  const routerAddr = contracts.REAL_YIELD_ROUTER as `0x${string}`;
  const usdcAddr = contracts.USDC as `0x${string}`;
  const positionNftAddr = contracts.POSITION_NFT as `0x${string}`;
  const oracleHubAddr = contracts.ORACLE_HUB as `0x${string}`;
  const circuitBreakerAddr = contracts.CIRCUIT_BREAKER as `0x${string}`;
  const alphaTokenAddr = contracts.ALPHA_TOKEN as `0x${string}`;
  const wbtcAddr = contracts.WBTC as `0x${string}`;
  const wethAddr = contracts.WETH as `0x${string}`;
  const tokenomicsEngineAddr = contracts.TOKENOMICS_ENGINE as `0x${string}`;
  const addressProviderAddr = contracts.PROTOCOL_ADDRESS_PROVIDER as `0x${string}`;

  async function sendTx(desc: string, to: `0x${string}`, abi: any[], functionName: string, args: any[] = []) {
    process.stdout.write(`[*] ${desc.padEnd(52)} ... `);
    const hash = await walletClient.writeContract({
      address: to,
      abi,
      functionName,
      args,
      account,
      maxFeePerGas: 36000000n,
      maxPriorityFeePerGas: 1000000n
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`✅ OK`);
  }

  const BURNER_ROLE = keccak256(toHex('BURNER_ROLE'));

  // 1. Asignar BURNER_ROLE en Treasury a GovernanceStaking y DiscountBuybackEngine
  console.log('--- PASO 1: ASIGNACIÓN DE BURNER_ROLE EN TESORERÍA ---');
  const treasuryArtifact = loadArtifact('TreasuryManager');
  await sendTx('Conceder BURNER_ROLE a GovernanceStaking', treasuryAddr, treasuryArtifact.abi, 'grantRole', [BURNER_ROLE, stakingAddr]);
  await sendTx('Conceder BURNER_ROLE a DiscountBuybackEngine', treasuryAddr, treasuryArtifact.abi, 'grantRole', [BURNER_ROLE, buybackAddr]);

  // 2. Desplegar P2PLendingMarket
  console.log('\n--- PASO 2: DESPLIEGUE INSTITUCIONAL DE P2PLENDINGMARKET ---');
  const p2pArtifact = loadArtifact('P2PLendingMarket');
  process.stdout.write(`[*] Desplegando P2PLendingMarket `.padEnd(54) + '... ');
  const deployHash = await walletClient.deployContract({
    abi: p2pArtifact.abi,
    bytecode: p2pArtifact.bytecode.object as `0x${string}`,
    args: [
      usdcAddr,
      positionNftAddr,
      routerAddr,
      oracleHubAddr,
      account.address
    ],
    account,
    maxFeePerGas: 36000000n,
    maxPriorityFeePerGas: 1000000n
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  const p2pMarketAddr = receipt.contractAddress as `0x${string}`;
  console.log(`✅ ${p2pMarketAddr}`);

  // 3. Configuración de dependencias en P2PLendingMarket
  console.log('\n--- PASO 3: CONFIGURACIÓN DE P2PLENDINGMARKET ---');
  await sendTx('Configurar PriceFeed en P2PLendingMarket', p2pMarketAddr, p2pArtifact.abi, 'setPriceFeed', [oracleHubAddr]);
  await sendTx('Configurar Tesorería en P2PLendingMarket', p2pMarketAddr, p2pArtifact.abi, 'setTreasury', [treasuryAddr]);
  await sendTx('Configurar TokenomicsEngine en P2P', p2pMarketAddr, p2pArtifact.abi, 'setTokenomicsEngine', [tokenomicsEngineAddr]);
  await sendTx('Configurar CircuitBreaker en P2P', p2pMarketAddr, p2pArtifact.abi, 'setCircuitBreaker', [circuitBreakerAddr]);
  await sendTx('Configurar AlphaToken en P2P', p2pMarketAddr, p2pArtifact.abi, 'setAlphaToken', [alphaTokenAddr]);
  await sendTx('Configurar WBTC en P2P', p2pMarketAddr, p2pArtifact.abi, 'setWbtcToken', [wbtcAddr]);
  await sendTx('Configurar WETH en P2P', p2pMarketAddr, p2pArtifact.abi, 'setWethToken', [wethAddr]);

  // 4. Registro en AddressProvider y autorización en RealYieldRouter
  console.log('\n--- PASO 4: REGISTRO CENTRAL Y ENRUTAMIENTO DE COMISIONES ---');
  const apArtifact = loadArtifact('ProtocolAddressProvider');
  await sendTx('Registrar P2P_MARKET en AddressProvider', addressProviderAddr, apArtifact.abi, 'setAddress', [keccak256(toHex('P2P_MARKET')), p2pMarketAddr]);

  const routerArtifact = loadArtifact('RealYieldRouter');
  await sendTx('Autorizar P2P_MARKET en RealYieldRouter', routerAddr, routerArtifact.abi, 'setAuthorizedYieldCaller', [p2pMarketAddr, true]);

  // 5. Persistencia
  console.log('\n--- PASO 5: PERSISTENCIA EN FRONTEND Y VARIABLES ---');
  contracts['P2P_MARKET'] = p2pMarketAddr;
  fs.writeFileSync(contractsPath, JSON.stringify(contracts, null, 2), 'utf8');
  console.log(`[+] frontend/src/contracts.json actualizado con P2P_MARKET: ${p2pMarketAddr}`);

  const envPath = path.resolve(rootDir, '.env');
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('VITE_P2P_MARKET_ADDRESS=')) {
      envContent = envContent.replace(/VITE_P2P_MARKET_ADDRESS=.*/g, `VITE_P2P_MARKET_ADDRESS=${p2pMarketAddr}`);
    } else {
      envContent += `\nVITE_P2P_MARKET_ADDRESS=${p2pMarketAddr}\n`;
    }
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log(`[+] Archivo .env sincronizado.`);
  }

  // 6. Verificación por simulación On-Chain
  console.log('\n--- PASO 6: VERIFICACIÓN ON-CHAIN (SIMULACIONES) ---');
  const stakingArtifact = loadArtifact('GovernanceStaking');

  try {
    process.stdout.write(`[*] Simulando llamada GovernanceStaking.stake(100 VIRAJE) ... `);
    await publicClient.simulateContract({
      address: stakingAddr,
      abi: stakingArtifact.abi,
      functionName: 'stake',
      args: [parseUnits('100', 18)],
      account: account.address
    });
    console.log(`✅ SIMULACIÓN EXITOSA (Staking 100% Operativo)`);
  } catch (e: any) {
    console.log(`❌ Revert: ${e.shortMessage || e.message}`);
  }

  try {
    process.stdout.write(`[*] Simulando P2PLendingMarket.borrowFromTreasuryWithAlpha ... `);
    await publicClient.simulateContract({
      address: p2pMarketAddr,
      abi: p2pArtifact.abi,
      functionName: 'borrowFromTreasuryWithAlpha',
      args: [parseUnits('200', 18), parseUnits('100', 6), 30n],
      account: account.address
    });
    console.log(`✅ SIMULACIÓN EXITOSA (Préstamo Tesorería 100% Operativo)`);
  } catch (e: any) {
    console.log(`❌ Revert: ${e.shortMessage || e.message}`);
  }

  console.log('\n================================================================');
  console.log('  🎉 ¡CONFIGURACIÓN Y DESPLIEGUE FINALIZADOS CON ÉXITO!           ');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('\n[FATAL ERROR]', err);
  process.exit(1);
});
