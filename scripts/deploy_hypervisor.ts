import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toHex,
  formatEther
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';

import * as readline from 'readline';

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

function getEnvKey(): string {
  if (process.env.DEPLOYER_KEY) return process.env.DEPLOYER_KEY;
  if (process.env.PRIVATE_KEY) return process.env.PRIVATE_KEY;
  if (process.env.BACKEND_OPERATOR_PRIVATE_KEY) return process.env.BACKEND_OPERATOR_PRIVATE_KEY;

  const envPath = path.resolve(rootDir, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
        if ((k === 'DEPLOYER_KEY' || k === 'PRIVATE_KEY' || k === 'BACKEND_OPERATOR_PRIVATE_KEY') && v) {
          return v;
        }
      }
    }
  }
  return '';
}

async function main() {
  console.log('================================================================');
  console.log('    🚀 DESPLIEGUE DEL HYPERVISOR DE VIRAJE EN ARBITRUM SEPOLIA   ');
  console.log('================================================================\n');

  let rawKey = getEnvKey().trim();
  if (!rawKey) {
    rawKey = await askQuestion('👉 Introduce la clave privada del desplegador (0x...): ');
  }
  if (!rawKey.startsWith('0x')) {
    rawKey = `0x${rawKey}`;
  }

  const account = privateKeyToAccount(rawKey as `0x${string}`);
  console.log(`[+] Cuenta de administración: ${account.address}`);

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
  console.log(`[+] Saldo disponible: ${formatEther(balance)} ETH\n`);

  if (balance === 0n) {
    throw new Error('La cuenta de despliegue no tiene saldo para gas.');
  }

  const contractsPath = path.resolve(rootDir, 'frontend/src/contracts.json');
  const contracts = JSON.parse(fs.readFileSync(contractsPath, 'utf8'));
  const addressProviderAddr = contracts.PROTOCOL_ADDRESS_PROVIDER as `0x${string}`;

  console.log(`[+] ProtocolAddressProvider: ${addressProviderAddr}`);

  // Cargar artefacto compilado
  const artifactPath = path.resolve(rootDir, 'contracts/out/VirajeHypervisor.sol/VirajeHypervisor.json');
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artefacto no encontrado en ${artifactPath}. Ejecuta scripts/build_hypervisor_artifact.js primero.`);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

  async function getGasFees() {
    try {
      const fees = await publicClient.estimateFeesPerGas();
      const maxFee = fees.maxFeePerGas ? (fees.maxFeePerGas * 150n) / 100n : 50000000n;
      const maxPriority = fees.maxPriorityFeePerGas ? fees.maxPriorityFeePerGas : 1000000n;
      return { maxFeePerGas: maxFee > 36000000n ? maxFee : 36000000n, maxPriorityFeePerGas: maxPriority };
    } catch (_) {
      return { maxFeePerGas: 45000000n, maxPriorityFeePerGas: 1000000n };
    }
  }

  // 1. Despliegue de VirajeHypervisor
  process.stdout.write(`[*] Desplegando VirajeHypervisor                   ... `);
  const gas = await getGasFees();
  const deployHash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode.object as `0x${string}`,
    args: [addressProviderAddr, account.address],
    account,
    ...gas
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  if (receipt.status !== 'success') {
    throw new Error(`Fallo en el despliegue del contrato. Tx: ${deployHash}`);
  }

  const hypervisorAddr = receipt.contractAddress as `0x${string}`;
  console.log(`✅ ${hypervisorAddr}`);

  // 2. Registro en ProtocolAddressProvider
  process.stdout.write(`[*] Registrando HYPERVISOR en AddressProvider     ... `);
  const apArtifactPath = path.resolve(rootDir, 'contracts/out/ProtocolAddressProvider.sol/ProtocolAddressProvider.json');
  const apArtifact = JSON.parse(fs.readFileSync(apArtifactPath, 'utf8'));

  const idHypervisor = keccak256(toHex('HYPERVISOR'));
  const apGas = await getGasFees();
  const setAddressTx = await walletClient.writeContract({
    address: addressProviderAddr,
    abi: apArtifact.abi,
    functionName: 'setAddress',
    args: [idHypervisor, hypervisorAddr],
    account,
    ...apGas
  });

  const apReceipt = await publicClient.waitForTransactionReceipt({ hash: setAddressTx });
  if (apReceipt.status !== 'success') {
    throw new Error(`Fallo al registrar en AddressProvider. Tx: ${setAddressTx}`);
  }
  console.log(`✅ OK (Tx: ${setAddressTx.slice(0, 10)}...)`);

  // 3. Verificación de Salud en Vivo
  process.stdout.write(`[*] Verificando lectura on-chain de salud        ... `);
  const healthData = await publicClient.readContract({
    address: hypervisorAddr,
    abi: artifact.abi,
    functionName: 'assessTreasuryHealth'
  }) as any;

  console.log(`✅ OK (Saludable: ${healthData.isHealthy}, NAV: $${Number(healthData.navPerShare) / 1e18}, CR: ${Number(healthData.collateralRatioBps) / 100}%)`);

  // 4. Actualizar frontend/src/contracts.json
  contracts.HYPERVISOR = hypervisorAddr;
  fs.writeFileSync(contractsPath, JSON.stringify(contracts, null, 2) + '\n', 'utf8');
  console.log(`[+] frontend/src/contracts.json actualizado con HYPERVISOR: ${hypervisorAddr}`);

  // 5. Actualizar .env si existe
  const envPath = path.resolve(rootDir, '.env');
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('VITE_HYPERVISOR_ADDRESS=')) {
      envContent = envContent.replace(/VITE_HYPERVISOR_ADDRESS=.*/, `VITE_HYPERVISOR_ADDRESS=${hypervisorAddr}`);
    } else {
      envContent += `\nVITE_HYPERVISOR_ADDRESS=${hypervisorAddr}\n`;
    }
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log(`[+] .env actualizado con VITE_HYPERVISOR_ADDRESS`);
  }

  console.log('\n================================================================');
  console.log('  🎉 ¡HYPERVISOR DESPLEGADO Y ACTIVADO CON ÉXITO EN SEPOLIA!    ');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('\n[FATAL ERROR]:', err);
  process.exit(1);
});
