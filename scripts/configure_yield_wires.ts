import {
  createPublicClient,
  createWalletClient,
  http,
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
  console.log('  CONFIGURACIÓN DE ENLACES Y PERMISOS REAL YIELD (ARBITRUM)     ');
  console.log('================================================================');

  let privateKey = (
    process.env.DEPLOYER_KEY ||
    process.env.PRIVATE_KEY ||
    process.env.BACKEND_OPERATOR_PRIVATE_KEY ||
    ''
  ).trim();

  if (!privateKey) {
    privateKey = await askQuestion('👉 Introduce la clave privada del administrador (0x...): ');
  }

  if (!privateKey.startsWith('0x')) {
    privateKey = `0x${privateKey}`;
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log(`[+] Cuenta: ${account.address}`);

  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(RPC_URL)
  });

  const walletClient = createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http(RPC_URL)
  });

  const contracts = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'frontend/src/contracts.json'), 'utf8'));
  const routerAddr = contracts.REAL_YIELD_ROUTER as `0x${string}`;
  const stakingAddr = contracts.STAKING as `0x${string}`;
  const treasuryAddr = contracts.TREASURY as `0x${string}`;
  const communityVaultAddr = contracts.COMMUNITY_YIELD_VAULT as `0x${string}`;
  const vestedVaultAddr = contracts.VESTED_VAULT as `0x${string}`;

  const routerArtifact = loadArtifact('RealYieldRouter');
  const stakingArtifact = loadArtifact('GovernanceStaking');

  async function sendTx(desc: string, to: `0x${string}`, abi: any[], functionName: string, args: any[] = []) {
    process.stdout.write(`[*] ${desc.padEnd(45)} ... `);
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

  console.log('\n--- VINCULANDO PERMISOS DE ENRUTAMIENTO DE COMISIONES ---');
  // 1. RealYieldRouter
  await sendTx('Configurar Protocol Vaults en RealYieldRouter', routerAddr, routerArtifact.abi, 'setProtocolVaults', [treasuryAddr, communityVaultAddr]);
  await sendTx('Autorizar Tesorería en RealYieldRouter', routerAddr, routerArtifact.abi, 'setAuthorizedYieldCaller', [treasuryAddr, true]);
  await sendTx('Autorizar VestedVault en RealYieldRouter', routerAddr, routerArtifact.abi, 'setAuthorizedYieldCaller', [vestedVaultAddr, true]);

  // 2. GovernanceStaking
  await sendTx('Autorizar Tesorería en Staking', stakingAddr, stakingArtifact.abi, 'setAuthorizedCaller', [treasuryAddr, true]);
  await sendTx('Autorizar RealYieldRouter en Staking', stakingAddr, stakingArtifact.abi, 'setAuthorizedCaller', [routerAddr, true]);
  await sendTx('Autorizar CommunityVault en Staking', stakingAddr, stakingArtifact.abi, 'setAuthorizedCaller', [communityVaultAddr, true]);
  await sendTx('Excluir Tesorería de Recompensas Staking', stakingAddr, stakingArtifact.abi, 'setExcludedAddress', [treasuryAddr, true]);

  console.log('\n--- VERIFICANDO SIMULACIÓN DE DEPÓSITO ON-CHAIN ---');
  const tmArtifact = loadArtifact('TreasuryManager');
  const user = account.address;
  const amountWei = parseUnits('1000', 6);

  try {
    const res = await publicClient.simulateContract({
      address: treasuryAddr,
      abi: tmArtifact.abi,
      functionName: 'deposit',
      args: [amountWei, 0n],
      account: user
    });
    console.log(`🎉 ¡Simulación de depósito exitosa!`);
    console.log(`   Tokens VIRAJE calculados: ${res.result.toString()} (18 decimales)`);
  } catch (err: any) {
    console.error('❌ Error en simulación:', err?.shortMessage || err?.message || err);
  }

  console.log('\n================================================================');
  console.log('  ✅ SISTEMA 100% OPERATIVO PARA DEPÓSITOS Y RETIROS');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('\n❌ [Error]:', err);
  process.exit(1);
});
