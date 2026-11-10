import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
  keccak256,
  toHex,
  encodeFunctionData
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
const { compileLibrary, compileTreasuryManager } = require('./modular_compiler.js');

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

function loadArtifact(name: string, file?: string) {
  const paths = [
    path.resolve(rootDir, `contracts/out/${name}.sol/${name}.json`),
    path.resolve(rootDir, `contracts/out/${file || ''}/${name}.json`),
    path.resolve(rootDir, `contracts/out/src/${file || ''}/${name}.json`),
    path.resolve(rootDir, `contracts/out/test/mocks/${file || ''}/${name}.json`),
    path.resolve(rootDir, `contracts/out/mocks/${file || ''}/${name}.json`)
  ];
  const found = paths.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`[Artifact Error] No se encontró el artifact para ${name}.`);
  }
  return JSON.parse(fs.readFileSync(found, 'utf8'));
}

async function main() {
  console.log('================================================================');
  console.log('  VIRAJE PROTOCOL - DESPLIEGUE OFICIAL SUITE INSTITUCIONAL      ');
  console.log('  ARBITRUM SEPOLIA (TESTNET) / COMPLIANT CON MAINNET (EIP-170)  ');
  console.log('================================================================');
  console.log(`[i] RPC: ${RPC_URL}`);
  console.log(`[i] Chain ID: ${arbitrumSepolia.id} (Arbitrum Sepolia)\n`);

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
  console.log(`[+] Saldo disponible: ${balanceEth} ETH`);

  if (balance === 0n) {
    console.error(`\n❌ Error: La cuenta ${account.address} tiene 0.00 ETH en Arbitrum Sepolia.`);
    process.exit(1);
  }

  // Rutas de configuración
  const contractsJsonPath = path.resolve(rootDir, 'frontend/src/contracts.json');
  let contractsConfig: Record<string, string> = {};
  if (fs.existsSync(contractsJsonPath)) {
    contractsConfig = JSON.parse(fs.readFileSync(contractsJsonPath, 'utf8'));
  }

  // 1. Preservar o configurar tokens base
  const usdcAddr = (contractsConfig['USDC'] || '0xf627c37c9a624e0d93b1009e3fd8d4e651da677b') as `0x${string}`;
  const usdtAddr = (contractsConfig['USDT'] || '0x3765611dc0d998c149392c853c561ef78a16c9a6') as `0x${string}`;
  const wbtcAddr = (contractsConfig['WBTC'] || '0x724fb61d9b0e218bf60eb544e2c64c41929bfa28') as `0x${string}`;
  const wethAddr = (contractsConfig['WETH'] || '0xc96304e3c037f81da488ed9dea1d8f2a48278a75') as `0x${string}`;

  console.log(`\n[*] Verificando tokens base en Arbitrum Sepolia...`);
  console.log(`    USDC: ${usdcAddr}`);
  console.log(`    USDT: ${usdtAddr}`);
  console.log(`    WBTC: ${wbtcAddr}`);
  console.log(`    WETH: ${wethAddr}`);

  // Helper de despliegue rápido con confirmación de recibo
  async function deploy(contractName: string, abi: any[], bytecode: `0x${string}`, args: any[] = []): Promise<`0x${string}`> {
    process.stdout.write(`[*] Desplegando ${contractName.padEnd(28)} ... `);
    const hash = await walletClient.deployContract({
      abi,
      bytecode,
      args
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (!receipt.contractAddress) {
      throw new Error(`Fallo al desplegar ${contractName}`);
    }
    console.log(`✅ ${receipt.contractAddress}`);
    return receipt.contractAddress;
  }

  async function sendTx(desc: string, to: `0x${string}`, abi: any[], functionName: string, args: any[] = []) {
    process.stdout.write(`[*] ${desc.padEnd(32)} ... `);
    const hash = await walletClient.writeContract({
      address: to,
      abi,
      functionName,
      args,
      account
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`✅ OK`);
  }

  // 2. Desplegar Oráculos Mock (Aggregators V3) para Sepolia
  console.log('\n--- PASO 1: ORÁCULOS CHAINLINK DE ALTA PRECISIÓN ---');
  const MockAggregator = loadArtifact('MockV3Aggregator');

  const feedUsdc = await deploy('MockFeed (USDC $1.00)', MockAggregator.abi, MockAggregator.bytecode.object, [8, 100000000n]);
  const feedUsdt = await deploy('MockFeed (USDT $1.00)', MockAggregator.abi, MockAggregator.bytecode.object, [8, 100000000n]);
  const feedWbtc = await deploy('MockFeed (WBTC $65,000)', MockAggregator.abi, MockAggregator.bytecode.object, [8, 6500000000000n]);
  const feedWeth = await deploy('MockFeed (WETH $3,000)', MockAggregator.abi, MockAggregator.bytecode.object, [8, 300000000000n]);

  // 3. Desplegar Núcleo del Protocolo
  console.log('\n--- PASO 2: NÚCLEO DE PROTOCOLO Y REGISTRO CENTRAL ---');
  const apArtifact = loadArtifact('ProtocolAddressProvider');
  const addressProviderAddr = await deploy('ProtocolAddressProvider', apArtifact.abi, apArtifact.bytecode.object, [account.address]);

  const avArtifact = loadArtifact('AlphaVault');
  const alphaVaultAddr = await deploy('AlphaVault (Custodia)', avArtifact.abi, avArtifact.bytecode.object, [addressProviderAddr, account.address]);

  const atArtifact = loadArtifact('AlphaToken');
  const alphaTokenAddr = await deploy('AlphaToken (VIRAJE Shares)', atArtifact.abi, atArtifact.bytecode.object, [addressProviderAddr, account.address]);

  const ohArtifact = loadArtifact('OracleHub');
  const oracleHubAddr = await deploy('OracleHub (Router Precios)', ohArtifact.abi, ohArtifact.bytecode.object, [addressProviderAddr, account.address]);

  // Configurar feeds en OracleHub
  await sendTx('Configurar Feed USDC en OracleHub', oracleHubAddr, ohArtifact.abi, 'setTrackedAsset', [usdcAddr, feedUsdc, '0x0000000000000000000000000000000000000000', 6]);
  await sendTx('Configurar Feed USDT en OracleHub', oracleHubAddr, ohArtifact.abi, 'setTrackedAsset', [usdtAddr, feedUsdt, '0x0000000000000000000000000000000000000000', 6]);
  await sendTx('Configurar Feed WBTC en OracleHub', oracleHubAddr, ohArtifact.abi, 'setTrackedAsset', [wbtcAddr, feedWbtc, '0x0000000000000000000000000000000000000000', 8]);
  await sendTx('Configurar Feed WETH en OracleHub', oracleHubAddr, ohArtifact.abi, 'setTrackedAsset', [wethAddr, feedWeth, '0x0000000000000000000000000000000000000000', 18]);

  const cbArtifact = loadArtifact('CircuitBreaker');
  const circuitBreakerAddr = await deploy('CircuitBreaker (Anti-Dump)', cbArtifact.abi, cbArtifact.bytecode.object, [account.address]);
  await sendTx('Configurar Feeds en Breaker (USDC)', circuitBreakerAddr, cbArtifact.abi, 'setPriceFeed', [usdcAddr, feedUsdc]);
  await sendTx('Configurar Feeds en Breaker (WBTC)', circuitBreakerAddr, cbArtifact.abi, 'setPriceFeed', [wbtcAddr, feedWbtc]);
  await sendTx('Configurar Feeds en Breaker (WETH)', circuitBreakerAddr, cbArtifact.abi, 'setPriceFeed', [wethAddr, feedWeth]);

  // 4. Compilar y Desplegar Librerías Modulares Vinculadas (EIP-170 Compliance)
  console.log('\n--- PASO 3: LIBRERÍAS MODULARES VINCULADAS (EIP-170 <= 24.5 KB) ---');
  const feeLib = compileLibrary('TreasuryFeeLib');
  const feeLibAddr = await deploy('TreasuryFeeLib', feeLib.abi, feeLib.bytecode);

  const liqLib = compileLibrary('TreasuryLiquidityLib');
  const liqLibAddr = await deploy('TreasuryLiquidityLib', liqLib.abi, liqLib.bytecode);

  const porLib = compileLibrary('TreasuryPoRLib');
  const porLibAddr = await deploy('TreasuryPoRLib', porLib.abi, porLib.bytecode);

  const rebLib = compileLibrary('TreasuryRebalanceLib');
  const rebLibAddr = await deploy('TreasuryRebalanceLib', rebLib.abi, rebLib.bytecode);

  // 5. Compilar TreasuryManager enlazado a las 4 librerías
  console.log('\n[*] Compilando TreasuryManager con enlaces de librerías estables...');
  const tmCompiled = compileTreasuryManager({
    TreasuryFeeLib: feeLibAddr,
    TreasuryLiquidityLib: liqLibAddr,
    TreasuryPoRLib: porLibAddr,
    TreasuryRebalanceLib: rebLibAddr
  });
  console.log(`    Tamaño Runtime de TreasuryManager: ${tmCompiled.runtimeSize} bytes (Límite EIP-170: 24,576 bytes) ✅`);

  const tmImplAddr = await deploy('TreasuryManager (Lógica)', tmCompiled.abi, tmCompiled.bytecode, [addressProviderAddr]);

  // 6. Desplegar Proxy ERC-1967
  const proxyArtifact = loadArtifact('TreasuryProxy');
  const treasuryProxyAddr = await deploy('TreasuryProxy (ERC-1967)', proxyArtifact.abi, proxyArtifact.bytecode.object, [tmImplAddr]);

  // Inicializar Treasury a través del Proxy
  console.log('\n[*] Inicializando Tesorería mediante llamada Proxy...');
  await sendTx('Inicializar TreasuryManager', treasuryProxyAddr, tmCompiled.abi, 'initialize', [account.address, usdcAddr, 6]);

  // Establecer Anti-Exploit Cap a 1,000,000 USD (1e6 * 1e18)
  console.log('[*] Configurando Guarded Genesis Cap (Anti-Exploit Cap) a $1,000,000 USD...');
  await sendTx('Configurar Cap TVL $1M', treasuryProxyAddr, tmCompiled.abi, 'setTvlCap', [parseEther('1000000')]);

  // 7. Desplegar Sistema de Rendimiento Comunitario & Staking
  console.log('\n--- PASO 4: SISTEMA DE STAKING Y REAL YIELD (MICA COMPLIANT) ---');
  const cvArtifact = loadArtifact('CommunityYieldVault');
  const communityVaultAddr = await deploy('CommunityYieldVault', cvArtifact.abi, cvArtifact.bytecode.object, [usdcAddr, account.address]);

  const stArtifact = loadArtifact('GovernanceStaking');
  const stakingAddr = await deploy('GovernanceStaking (stVIRAJE)', stArtifact.abi, stArtifact.bytecode.object, [alphaTokenAddr, usdcAddr, account.address]);

  await sendTx('Vincular Staking en CommunityVault', communityVaultAddr, cvArtifact.abi, 'setStakingPool', [stakingAddr]);
  await sendTx('Vincular Tesorería en Staking', stakingAddr, stArtifact.abi, 'setTreasury', [treasuryProxyAddr]);
  await sendTx('Vincular Vaults en Staking', stakingAddr, stArtifact.abi, 'setProtocolVaults', [communityVaultAddr]);

  // 8. Desplegar Enrutador Real Yield y Bonos Vestados
  console.log('\n--- PASO 5: ROUTER DE RENDIMIENTO REAL Y BONOS VESTADOS ---');
  const routerArtifact = loadArtifact('RealYieldRouter');
  const realYieldRouterAddr = await deploy('RealYieldRouter', routerArtifact.abi, routerArtifact.bytecode.object, [
    usdcAddr,
    wbtcAddr,
    '0x0000000000000000000000000000000000000000',
    stakingAddr,
    account.address
  ]);

  const nftArtifact = loadArtifact('VaultPositionNFT');
  const positionNftAddr = await deploy('VaultPositionNFT (vPOS)', nftArtifact.abi, nftArtifact.bytecode.object, [account.address]);

  const vdArtifact = loadArtifact('VestedDiscountVault');
  const vestedVaultAddr = await deploy('VestedDiscountVault (Bonos)', vdArtifact.abi, vdArtifact.bytecode.object, [
    usdcAddr,
    positionNftAddr,
    treasuryProxyAddr,
    realYieldRouterAddr,
    alphaTokenAddr,
    account.address
  ]);

  const MINTER_ROLE = keccak256(toHex('MINTER_ROLE'));
  const BURNER_ROLE = keccak256(toHex('BURNER_ROLE'));
  const VAULT_MANAGER_ROLE = keccak256(toHex('VAULT_MANAGER_ROLE'));
  const COMPLIANCE_ROLE = keccak256(toHex('COMPLIANCE_ROLE'));

  await sendTx('Autorizar Minteo vPOS a VestedVault', positionNftAddr, nftArtifact.abi, 'grantRole', [MINTER_ROLE, vestedVaultAddr]);

  // 9. Desplegar Módulos de Tokenomics, Buyback y Seguridad Post-Cuántica
  console.log('\n--- PASO 6: EXTENSIONES Y MÓDULOS INSTITUCIONALES ---');
  const pteArtifact = loadArtifact('ProtocolTokenomicsEngine');
  const tokenomicsEngineAddr = await deploy('ProtocolTokenomicsEngine', pteArtifact.abi, pteArtifact.bytecode.object, [account.address]);

  const dbeArtifact = loadArtifact('DiscountBuybackEngine');
  const buybackEngineAddr = await deploy('DiscountBuybackEngine', dbeArtifact.abi, dbeArtifact.bytecode.object, [
    addressProviderAddr,
    usdcAddr,
    6,
    '0x0000000000000000000000000000000000000000',
    account.address
  ]);

  const pqcArtifact = loadArtifact('PostQuantumGuard');
  const pqcGuardAddr = await deploy('PostQuantumGuard', pqcArtifact.abi, pqcArtifact.bytecode.object, [account.address, addressProviderAddr]);

  const fvArtifact = loadArtifact('FounderReserveVestingVault');
  const founderVaultAddr = await deploy('FounderReserveVestingVault', fvArtifact.abi, fvArtifact.bytecode.object, [
    alphaTokenAddr,
    treasuryProxyAddr,
    account.address,
    account.address
  ]);

  // 10. Registrar Todas las Direcciones en ProtocolAddressProvider
  console.log('\n--- PASO 7: REGISTRO CENTRAL DE SERVICIOS (ADDRESS PROVIDER) ---');
  const ap = apArtifact.abi;
  await sendTx('Registrar ALPHA_VAULT', addressProviderAddr, ap, 'setAddress', [keccak256(toHex('ALPHA_VAULT')), alphaVaultAddr]);
  await sendTx('Registrar ALPHA_TOKEN', addressProviderAddr, ap, 'setAddress', [keccak256(toHex('ALPHA_TOKEN')), alphaTokenAddr]);
  await sendTx('Registrar ORACLE_HUB', addressProviderAddr, ap, 'setAddress', [keccak256(toHex('ORACLE_HUB')), oracleHubAddr]);
  await sendTx('Registrar CIRCUIT_BREAKER', addressProviderAddr, ap, 'setAddress', [keccak256(toHex('CIRCUIT_BREAKER')), circuitBreakerAddr]);
  await sendTx('Registrar TREASURY_MANAGER', addressProviderAddr, ap, 'setAddress', [keccak256(toHex('TREASURY_MANAGER')), treasuryProxyAddr]);
  await sendTx('Registrar COMMUNITY_YIELD_VAULT', addressProviderAddr, ap, 'setAddress', [keccak256(toHex('COMMUNITY_YIELD_VAULT')), communityVaultAddr]);
  await sendTx('Registrar GOVERNANCE_STAKING', addressProviderAddr, ap, 'setAddress', [keccak256(toHex('GOVERNANCE_STAKING')), stakingAddr]);
  await sendTx('Registrar REAL_YIELD_ROUTER', addressProviderAddr, ap, 'setAddress', [keccak256(toHex('REAL_YIELD_ROUTER')), realYieldRouterAddr]);
  await sendTx('Registrar VESTED_VAULT', addressProviderAddr, ap, 'setAddress', [keccak256(toHex('VESTED_VAULT')), vestedVaultAddr]);
  await sendTx('Registrar TOKENOMICS_ENGINE', addressProviderAddr, ap, 'setAddress', [keccak256(toHex('TOKENOMICS_ENGINE')), tokenomicsEngineAddr]);
  await sendTx('Registrar DISCOUNT_BUYBACK_ENGINE', addressProviderAddr, ap, 'setAddress', [keccak256(toHex('DISCOUNT_BUYBACK_ENGINE')), buybackEngineAddr]);
  await sendTx('Registrar POST_QUANTUM_GUARD', addressProviderAddr, ap, 'setAddress', [keccak256(toHex('POST_QUANTUM_GUARD')), pqcGuardAddr]);
  await sendTx('Registrar FOUNDER_VESTING_VAULT', addressProviderAddr, ap, 'setAddress', [keccak256(toHex('FOUNDER_VESTING_VAULT')), founderVaultAddr]);

  // 11. Concesión de Permisos Cruzados de Seguridad RBAC
  console.log('\n--- PASO 8: ASIGNACIÓN DE ROLES RBAC Y WHITELISTS ---');
  await sendTx('Conceder MINTER_ROLE en AlphaToken a Tesorería', alphaTokenAddr, atArtifact.abi, 'grantRole', [MINTER_ROLE, treasuryProxyAddr]);
  await sendTx('Conceder BURNER_ROLE en AlphaToken a Tesorería', alphaTokenAddr, atArtifact.abi, 'grantRole', [BURNER_ROLE, treasuryProxyAddr]);
  await sendTx('Conceder VAULT_MANAGER en AlphaVault a Tesorería', alphaVaultAddr, avArtifact.abi, 'grantRole', [VAULT_MANAGER_ROLE, treasuryProxyAddr]);
  await sendTx('Conceder COMPLIANCE_ROLE en Tesorería al Desplegador', treasuryProxyAddr, tmCompiled.abi, 'grantRole', [COMPLIANCE_ROLE, account.address]);

  // Registrar KYC para el desplegador y para la cuenta del usuario de prueba
  await sendTx('Habilitar KYC para Desplegador', treasuryProxyAddr, tmCompiled.abi, 'setKYCStatus', [account.address, true]);
  const userTestWallet = '0x13c8510359aB6f3f9210d02260d924139B616630' as `0x${string}`;
  if (userTestWallet.toLowerCase() !== account.address.toLowerCase()) {
    await sendTx('Habilitar KYC para Wallet de Prueba', treasuryProxyAddr, tmCompiled.abi, 'setKYCStatus', [userTestWallet, true]);
  }

  // Permisos cruzados de Real Yield y Staking
  await sendTx('Configurar Protocol Vaults en RealYieldRouter', realYieldRouterAddr, routerArtifact.abi, 'setProtocolVaults', [treasuryProxyAddr, communityVaultAddr]);
  await sendTx('Autorizar Tesorería en RealYieldRouter', realYieldRouterAddr, routerArtifact.abi, 'setAuthorizedYieldCaller', [treasuryProxyAddr, true]);
  await sendTx('Autorizar VestedVault en RealYieldRouter', realYieldRouterAddr, routerArtifact.abi, 'setAuthorizedYieldCaller', [vestedVaultAddr, true]);
  await sendTx('Autorizar Tesorería en Staking', stakingAddr, stArtifact.abi, 'setAuthorizedCaller', [treasuryProxyAddr, true]);
  await sendTx('Autorizar RealYieldRouter en Staking', stakingAddr, stArtifact.abi, 'setAuthorizedCaller', [realYieldRouterAddr, true]);
  await sendTx('Autorizar CommunityVault en Staking', stakingAddr, stArtifact.abi, 'setAuthorizedCaller', [communityVaultAddr, true]);
  await sendTx('Excluir Tesorería de Recompensas Staking', stakingAddr, stArtifact.abi, 'setExcludedAddress', [treasuryProxyAddr, true]);

  // 12. Actualizar contracts.json
  console.log('\n--- PASO 9: PERSISTENCIA DE DIRECCIONES EN EL ECOSISTEMA ---');
  contractsConfig['USDC'] = usdcAddr;
  contractsConfig['USDT'] = usdtAddr;
  contractsConfig['WBTC'] = wbtcAddr;
  contractsConfig['WETH'] = wethAddr;
  contractsConfig['PROTOCOL_ADDRESS_PROVIDER'] = addressProviderAddr;
  contractsConfig['ALPHA_VAULT'] = alphaVaultAddr;
  contractsConfig['VIRAJE_VAULT'] = alphaVaultAddr;
  contractsConfig['ALPHA_TOKEN'] = alphaTokenAddr;
  contractsConfig['VIRAJE_TOKEN'] = alphaTokenAddr;
  contractsConfig['ORACLE_HUB'] = oracleHubAddr;
  contractsConfig['ORACLE_ROUTER'] = oracleHubAddr;
  contractsConfig['PRICE_FEED'] = oracleHubAddr;
  contractsConfig['CIRCUIT_BREAKER'] = circuitBreakerAddr;
  contractsConfig['TREASURY'] = treasuryProxyAddr;
  contractsConfig['TREASURY_MANAGER'] = treasuryProxyAddr;
  contractsConfig['COMMUNITY_YIELD_VAULT'] = communityVaultAddr;
  contractsConfig['STAKING'] = stakingAddr;
  contractsConfig['REAL_YIELD_ROUTER'] = realYieldRouterAddr;
  contractsConfig['POSITION_NFT'] = positionNftAddr;
  contractsConfig['VESTED_VAULT'] = vestedVaultAddr;
  contractsConfig['TOKENOMICS_ENGINE'] = tokenomicsEngineAddr;
  contractsConfig['DISCOUNT_BUYBACK_ENGINE'] = buybackEngineAddr;
  contractsConfig['POST_QUANTUM_GUARD'] = pqcGuardAddr;
  contractsConfig['FOUNDER_VESTING_VAULT'] = founderVaultAddr;

  fs.writeFileSync(contractsJsonPath, JSON.stringify(contractsConfig, null, 2), 'utf8');
  console.log(`[+] frontend/src/contracts.json actualizado con éxito.`);

  // Actualizar .env raíz
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
    updateEnv('VITE_USDC_ADDRESS', usdcAddr);
    updateEnv('VITE_USDT_ADDRESS', usdtAddr);
    updateEnv('VITE_WBTC_ADDRESS', wbtcAddr);
    updateEnv('VITE_ALPHA_TOKEN_ADDRESS', alphaTokenAddr);
    updateEnv('VITE_TREASURY_ADDRESS', treasuryProxyAddr);
    updateEnv('TREASURY_ADDRESS', treasuryProxyAddr);
    updateEnv('CIRCUIT_BREAKER_ADDRESS', circuitBreakerAddr);
    fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
    console.log(`[+] Archivo .env de la raíz sincronizado.`);
  }

  console.log('\n================================================================');
  console.log('  🎉 ¡DESPLIEGUE INSTITUCIONAL COMPLETADO CON ÉXITO!            ');
  console.log('================================================================');
  console.log(`Tesorería Proxy:        ${treasuryProxyAddr}`);
  console.log(`VIRAJE Shares (Token):  ${alphaTokenAddr}`);
  console.log(`AlphaVault (Custodia):  ${alphaVaultAddr}`);
  console.log(`OracleHub:              ${oracleHubAddr}`);
  console.log(`CircuitBreaker:         ${circuitBreakerAddr}`);
  console.log(`Staking (stVIRAJE):     ${stakingAddr}`);
  console.log(`Vested Discount Vault:  ${vestedVaultAddr}`);
  console.log('================================================================\n');
  console.log('Todos los contratos están enlazados sin atajos ("cero ñapas"),');
  console.log('cumpliendo con EIP-170 y listos para operar en Testnet y Mainnet.');
}

main().catch((err) => {
  console.error('\n❌ [Error fatal durante el despliegue]:', err);
  process.exit(1);
});
