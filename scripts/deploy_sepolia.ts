import { createPublicClient, createWalletClient, http, formatEther, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
const { compile } = require('./compile_contracts.js');

const rootDir = path.resolve(__dirname, '..');
const RPC_URL = process.env.ARBITRUM_SEPOLIA_RPC_URL || process.env.VITE_PUBLIC_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc';

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

function loadArtifact(name: string, file: string) {
  const p1 = path.resolve(rootDir, `contracts/out/src/${file}/${name}.json`);
  const p2 = path.resolve(rootDir, `contracts/out/${file}/${name}.json`);
  const p3 = path.resolve(rootDir, `contracts/out/test/${file}/${name}.json`);
  const p4 = path.resolve(rootDir, `contracts/out/adapters/${file}/${name}.json`);
  const p5 = path.resolve(rootDir, `contracts/out/${name}.sol/${name}.json`);
  const p6 = path.resolve(rootDir, `contracts/out/mocks/${file}/${name}.json`);
  const p7 = path.resolve(rootDir, `contracts/out/test/mocks/${file}/${name}.json`);
  const p = [p1, p2, p3, p4, p5, p6, p7].find((f) => fs.existsSync(f));
  if (!p) {
    throw new Error(`[Artifact Error] No se encontró el artifact compilado para ${name} (${file}).`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function main() {
  console.log('================================================================');
  console.log('  VIRAJE PROTOCOL - DESPLIEGUE EN ARBITRUM SEPOLIA (TESTNET)    ');
  console.log('================================================================');
  console.log(`[i] Conectando a RPC: ${RPC_URL}`);
  console.log(`[i] Chain ID objetivo: ${arbitrumSepolia.id} (Arbitrum Sepolia)\n`);

  let privateKey = (
    process.env.DEPLOYER_KEY ||
    process.env.PRIVATE_KEY ||
    process.env.BACKEND_OPERATOR_PRIVATE_KEY ||
    ''
  ).trim();

  if (!privateKey) {
    console.log('ℹ️  No se detectó DEPLOYER_KEY en las variables de entorno.');
    privateKey = await askQuestion('👉 Introduce la clave privada con fondos de Sepolia ETH (formato 0x...): ');
  }

  if (!privateKey.startsWith('0x')) {
    privateKey = `0x${privateKey}`;
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    console.error('❌ Error: Formato de clave privada inválido. Debe ser una cadena hexadecimal de 64 caracteres precedida por 0x.');
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log(`\n[+] Billetera de despliegue cargada: ${account.address}`);

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
  const balanceEth = formatEther(balance);
  console.log(`[+] Saldo en Arbitrum Sepolia: ${balanceEth} ETH`);

  if (balance === 0n) {
    console.error(`\n❌ Error: La cuenta ${account.address} tiene 0.00 ETH en Arbitrum Sepolia.`);
    process.exit(1);
  }

  // Leer contratos actuales para preservar
  const contractsJsonPath = path.resolve(rootDir, 'frontend/src/contracts.json');
  let currentContracts: Record<string, string> = {};
  if (fs.existsSync(contractsJsonPath)) {
    currentContracts = JSON.parse(fs.readFileSync(contractsJsonPath, 'utf8'));
  }

  let usdcAddr = currentContracts['USDC'] as `0x${string}`;
  let usdtAddr = currentContracts['USDT'] as `0x${string}`;
  let wbtcAddr = currentContracts['WBTC'] as `0x${string}`;

  // Verificar si el USDC ya desplegado existe y tiene código
  let needDeployTokens = true;
  if (usdcAddr && /^0x[0-9a-fA-F]{40}$/.test(usdcAddr)) {
    const code = await publicClient.getBytecode({ address: usdcAddr });
    if (code && code.length > 2) {
      console.log(`\n[*] Contrato USDC existente verificado en Arbitrum Sepolia: ${usdcAddr}`);
      needDeployTokens = false;
    }
  }

  const MockERC20 = loadArtifact('MockERC20', 'ModularProtocol.t.sol');

  if (needDeployTokens) {
    console.log('\n[1/3] Desplegando Mock USDC (6 decimales)...');
    const usdcTx = await walletClient.deployContract({
      abi: MockERC20.abi,
      bytecode: MockERC20.bytecode.object,
      args: ['USD Coin', 'USDC', 6]
    });
    console.log(`      Transacción enviada: https://sepolia.arbiscan.io/tx/${usdcTx}`);
    const usdcReceipt = await publicClient.waitForTransactionReceipt({ hash: usdcTx });
    usdcAddr = usdcReceipt.contractAddress!;
    console.log(`  ✅ Mock USDC desplegado en: ${usdcAddr}`);

    console.log('\n[2/3] Desplegando Mock USDT (6 decimales)...');
    const usdtTx = await walletClient.deployContract({
      abi: MockERC20.abi,
      bytecode: MockERC20.bytecode.object,
      args: ['Tether USD', 'USDT', 6]
    });
    const usdtReceipt = await publicClient.waitForTransactionReceipt({ hash: usdtTx });
    usdtAddr = usdtReceipt.contractAddress!;
    console.log(`  ✅ Mock USDT desplegado en: ${usdtAddr}`);

    console.log('\n[3/3] Desplegando Mock WBTC (8 decimales)...');
    const wbtcTx = await walletClient.deployContract({
      abi: MockERC20.abi,
      bytecode: MockERC20.bytecode.object,
      args: ['Wrapped BTC', 'WBTC', 8]
    });
    const wbtcReceipt = await publicClient.waitForTransactionReceipt({ hash: wbtcTx });
    wbtcAddr = wbtcReceipt.contractAddress!;
    console.log(`  ✅ Mock WBTC desplegado en: ${wbtcAddr}`);

    // Acuñar 1,000,000 USDC
    console.log(`\n[*] Acuñando 1,000,000 USDC directamente a tu billetera (${account.address})...`);
    const mintUsdcTx = await walletClient.writeContract({
      address: usdcAddr,
      abi: MockERC20.abi,
      functionName: 'mint',
      args: [account.address, parseUnits('1000000', 6)],
      account
    });
    await publicClient.waitForTransactionReceipt({ hash: mintUsdcTx });
    console.log(`  💰 ¡1,000,000 USDC acreditados con éxito!`);
  }

  currentContracts['USDC'] = usdcAddr;
  currentContracts['USDT'] = usdtAddr;
  currentContracts['WBTC'] = wbtcAddr;

  // 2. Compilar y Desplegar SepoliaVirajeToken y SepoliaTreasury
  console.log('\n================================================================');
  console.log('  DESPLEGANDO TESORERÍA Y TOKEN VIRAJE EN ARBITRUM SEPOLIA       ');
  console.log('================================================================');

  const { SepoliaVirajeToken, SepoliaTreasury } = compile();

  console.log('[*] Desplegando SepoliaVirajeToken (VIRAJE Shares)...');
  const tokenTx = await walletClient.deployContract({
    abi: SepoliaVirajeToken.abi,
    bytecode: SepoliaVirajeToken.bytecode,
    args: [account.address]
  });
  console.log(`    Transacción: https://sepolia.arbiscan.io/tx/${tokenTx}`);
  const tokenReceipt = await publicClient.waitForTransactionReceipt({ hash: tokenTx });
  const virajeTokenAddr = tokenReceipt.contractAddress!;
  console.log(`  ✅ SepoliaVirajeToken desplegado en: ${virajeTokenAddr}`);

  console.log('\n[*] Desplegando SepoliaTreasury (Custodia de Reservas)...');
  const treasuryTx = await walletClient.deployContract({
    abi: SepoliaTreasury.abi,
    bytecode: SepoliaTreasury.bytecode,
    args: [usdcAddr, account.address]
  });
  console.log(`    Transacción: https://sepolia.arbiscan.io/tx/${treasuryTx}`);
  const treasuryReceipt = await publicClient.waitForTransactionReceipt({ hash: treasuryTx });
  const treasuryAddr = treasuryReceipt.contractAddress!;
  console.log(`  ✅ SepoliaTreasury desplegada en: ${treasuryAddr}`);

  // Configurar permisos cruzados
  console.log('\n[*] Vinculando Tesorería y Token VIRAJE...');
  const setTokenTx = await walletClient.writeContract({
    address: treasuryAddr,
    abi: SepoliaTreasury.abi,
    functionName: 'setAlphaToken',
    args: [virajeTokenAddr],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: setTokenTx });

  const setMinterTx = await walletClient.writeContract({
    address: virajeTokenAddr,
    abi: SepoliaVirajeToken.abi,
    functionName: 'setMinter',
    args: [treasuryAddr],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: setMinterTx });
  console.log('  ✅ Permisos configurados: Tesorería autorizada para acuñar/quemar participaciones.');

  // Actualizar contracts.json
  currentContracts['ALPHA_TOKEN'] = virajeTokenAddr;
  currentContracts['VIRAJE_TOKEN'] = virajeTokenAddr;
  currentContracts['TREASURY'] = treasuryAddr;
  currentContracts['TREASURY_MANAGER'] = treasuryAddr;

  // Actualizar frontend/src/contracts.json
  console.log('\n[*] Actualizando frontend/src/contracts.json...');
  fs.writeFileSync(contractsJsonPath, JSON.stringify(currentContracts, null, 2), 'utf8');

  // Actualizar .env
  const envPath = path.resolve(rootDir, '.env');
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    const updateEnv = (key: string, val: string) => {
      const reg = new RegExp(`^${key}=.*$`, 'm');
      if (reg.test(envContent)) {
        envContent = envContent.replace(reg, `${key}=${val}`);
      } else {
        envContent += `\n${key}=${val}`;
      }
    };
    updateEnv('VITE_USDC_ADDRESS', currentContracts['USDC']);
    updateEnv('VITE_USDT_ADDRESS', currentContracts['USDT']);
    updateEnv('VITE_ALPHA_TOKEN_ADDRESS', virajeTokenAddr);
    updateEnv('VITE_TREASURY_ADDRESS', treasuryAddr);
    fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
  }

  console.log('\n================================================================');
  console.log('  ¡DESPLIEGUE FINALIZADO CON ÉXITO EN ARBITRUM SEPOLIA!         ');
  console.log('================================================================');
  console.log(`USDC (Fondos):    ${currentContracts['USDC']}`);
  console.log(`VIRAJE (Shares):  ${virajeTokenAddr}`);
  console.log(`Tesorería:        ${treasuryAddr}`);
  console.log('================================================================\n');
  console.log('🎉 ¡El sistema está 100% operativo on-chain!');
  console.log('  1. Los depósitos deducirán tus USDC reales de Arbitrum Sepolia.');
  console.log('  2. Se te acuñarán tokens VIRAJE Shares en tu billetera de forma inmediata.');
  console.log('  3. Puedes importar la dirección de VIRAJE Shares a MetaMask:');
  console.log(`     ${virajeTokenAddr}`);
}

main().catch((err) => {
  console.error('\n❌ [Error fatal durante el despliegue]:', err);
  process.exit(1);
});
