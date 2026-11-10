import { createPublicClient, createWalletClient, http, parseEther, formatEther, keccak256, toHex, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

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
    console.error('Por favor, transfiere Sepolia ETH a esta dirección para pagar las tarifas de gas antes de continuar.');
    process.exit(1);
  }

  const isTokensOnlyArg = process.argv.includes('--tokens-only') || process.argv.includes('--tokens');
  const shouldDoTokensOnly = isTokensOnlyArg || balance < parseEther('0.003');

  if (shouldDoTokensOnly && !isTokensOnlyArg) {
    console.log(`\n⚠️  Saldo detectado (${balanceEth} ETH < 0.003 ETH).`);
    console.log('    Se ejecutará el modo Optimizado (Tokens Mock USDC, USDT, WBTC) para garantizar que el faucet opere sin agotar el gas.');
  }

  // 1. Cargar Artifacts Fundamentales
  console.log('\n[*] Cargando artifacts de contratos...');
  const MockERC20 = loadArtifact('MockERC20', 'ModularProtocol.t.sol');
  const MockChainlinkFeed = loadArtifact('MockChainlinkFeed', 'ModularProtocol.t.sol');

  // Leer contratos actuales para preservar los no tocados
  const contractsJsonPath = path.resolve(rootDir, 'frontend/src/contracts.json');
  let currentContracts: Record<string, string> = {};
  if (fs.existsSync(contractsJsonPath)) {
    currentContracts = JSON.parse(fs.readFileSync(contractsJsonPath, 'utf8'));
  }

  // Desplegar Mock USDC
  console.log('\n[1/3] Desplegando Mock USDC (6 decimales) con Faucet público...');
  const usdcTx = await walletClient.deployContract({
    abi: MockERC20.abi,
    bytecode: MockERC20.bytecode.object,
    args: ['USD Coin', 'USDC', 6]
  });
  console.log(`      Transacción enviada: https://sepolia.arbiscan.io/tx/${usdcTx}`);
  const usdcReceipt = await publicClient.waitForTransactionReceipt({ hash: usdcTx });
  const usdcAddr = usdcReceipt.contractAddress!;
  console.log(`  ✅ Mock USDC desplegado en: ${usdcAddr}`);

  // Desplegar Mock USDT
  console.log('\n[2/3] Desplegando Mock USDT (6 decimales)...');
  const usdtTx = await walletClient.deployContract({
    abi: MockERC20.abi,
    bytecode: MockERC20.bytecode.object,
    args: ['Tether USD', 'USDT', 6]
  });
  console.log(`      Transacción enviada: https://sepolia.arbiscan.io/tx/${usdtTx}`);
  const usdtReceipt = await publicClient.waitForTransactionReceipt({ hash: usdtTx });
  const usdtAddr = usdtReceipt.contractAddress!;
  console.log(`  ✅ Mock USDT desplegado en: ${usdtAddr}`);

  // Desplegar Mock WBTC
  console.log('\n[3/3] Desplegando Mock WBTC (8 decimales)...');
  const wbtcTx = await walletClient.deployContract({
    abi: MockERC20.abi,
    bytecode: MockERC20.bytecode.object,
    args: ['Wrapped BTC', 'WBTC', 8]
  });
  console.log(`      Transacción enviada: https://sepolia.arbiscan.io/tx/${wbtcTx}`);
  const wbtcReceipt = await publicClient.waitForTransactionReceipt({ hash: wbtcTx });
  const wbtcAddr = wbtcReceipt.contractAddress!;
  console.log(`  ✅ Mock WBTC desplegado en: ${wbtcAddr}`);

  // Minteo Automático Génesis de 1,000,000 USDC directamente para el usuario
  console.log(`\n[*] Acuñando 1,000,000 USDC directamente a tu billetera (${account.address})...`);
  const mintUsdcTx = await walletClient.writeContract({
    address: usdcAddr,
    abi: MockERC20.abi,
    functionName: 'mint',
    args: [account.address, parseUnits('1000000', 6)],
    account
  });
  console.log(`      Transacción de minteo: https://sepolia.arbiscan.io/tx/${mintUsdcTx}`);
  await publicClient.waitForTransactionReceipt({ hash: mintUsdcTx });
  console.log(`  💰 ¡1,000,000 USDC acreditados con éxito en tu billetera!`);

  // Minteo complementario de USDT y WBTC para soporte multi-activo
  console.log(`[*] Acuñando 1,000,000 USDT y 50 WBTC de fondos de prueba a tu billetera...`);
  const mintUsdtTx = await walletClient.writeContract({
    address: usdtAddr,
    abi: MockERC20.abi,
    functionName: 'mint',
    args: [account.address, parseUnits('1000000', 6)],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: mintUsdtTx });

  const mintWbtcTx = await walletClient.writeContract({
    address: wbtcAddr,
    abi: MockERC20.abi,
    functionName: 'mint',
    args: [account.address, parseUnits('50', 8)],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: mintWbtcTx });
  console.log(`  💰 Fondos de prueba complementarios acreditados.`);

  // Actualizar mapa de direcciones y guardar inmediatamente
  currentContracts['USDC'] = usdcAddr;
  currentContracts['USDT'] = usdtAddr;
  currentContracts['WBTC'] = wbtcAddr;
  fs.writeFileSync(contractsJsonPath, JSON.stringify(currentContracts, null, 2), 'utf8');
  console.log('[*] Direcciones de tokens guardadas preventivamente en frontend/src/contracts.json.');

  // Si se solicita o si hay saldo suficiente, intentar desplegar el resto del protocolo
  if (!shouldDoTokensOnly) {
    console.log('\n================================================================');
    console.log('  DESPLEGANDO PROTOCOLO COMPLETO (TESORERÍA, VAULTS, STAKING)   ');
    console.log('================================================================');

    try {
      // Desplegar Feeds
      console.log('[*] Desplegando Oráculos Chainlink Mock...');
      const feedTx = await walletClient.deployContract({
        abi: MockChainlinkFeed.abi,
        bytecode: MockChainlinkFeed.bytecode.object,
        args: [100000000n, 8] // USDC = $1.00
      });
      const feedAddr = (await publicClient.waitForTransactionReceipt({ hash: feedTx })).contractAddress!;
      console.log(`  ✅ Oráculo USDC desplegado en: ${feedAddr}`);

      const wbtcFeedTx = await walletClient.deployContract({
        abi: MockChainlinkFeed.abi,
        bytecode: MockChainlinkFeed.bytecode.object,
        args: [6000000000000n, 8] // WBTC = $60,000.00
      });
      const wbtcFeedAddr = (await publicClient.waitForTransactionReceipt({ hash: wbtcFeedTx })).contractAddress!;
      console.log(`  ✅ Oráculo WBTC desplegado en: ${wbtcFeedAddr}`);

      const wethFeedTx = await walletClient.deployContract({
        abi: MockChainlinkFeed.abi,
        bytecode: MockChainlinkFeed.bytecode.object,
        args: [300000000000n, 8] // WETH = $3,000.00
      });
      const wethFeedAddr = (await publicClient.waitForTransactionReceipt({ hash: wethFeedTx })).contractAddress!;
      console.log(`  ✅ Oráculo WETH desplegado en: ${wethFeedAddr}`);

      // AddressProvider
      console.log('[*] Desplegando ProtocolAddressProvider...');
      const apArtifact = loadArtifact('ProtocolAddressProvider', 'ProtocolAddressProvider.sol');
      const apTx = await walletClient.deployContract({
        abi: apArtifact.abi,
        bytecode: apArtifact.bytecode.object,
        args: [account.address]
      });
      const apAddr = (await publicClient.waitForTransactionReceipt({ hash: apTx })).contractAddress!;
      currentContracts['PROTOCOL_ADDRESS_PROVIDER'] = apAddr;
      console.log(`  ✅ AddressProvider desplegado en: ${apAddr}`);

      // OracleHub
      console.log('[*] Desplegando OracleHub...');
      const oracleArtifact = loadArtifact('OracleHub', 'OracleHub.sol');
      const oracleTx = await walletClient.deployContract({
        abi: oracleArtifact.abi,
        bytecode: oracleArtifact.bytecode.object,
        args: [apAddr, account.address]
      });
      const oracleAddr = (await publicClient.waitForTransactionReceipt({ hash: oracleTx })).contractAddress!;
      currentContracts['ORACLE_HUB'] = oracleAddr;
      currentContracts['ORACLE_ROUTER'] = oracleAddr;
      console.log(`  ✅ OracleHub desplegado en: ${oracleAddr}`);

      const zeroAddr = '0x0000000000000000000000000000000000000000' as `0x${string}`;
      await publicClient.waitForTransactionReceipt({
        hash: await walletClient.writeContract({
          address: oracleAddr,
          abi: oracleArtifact.abi,
          functionName: 'setTrackedAsset',
          args: [usdcAddr, feedAddr, zeroAddr, 6],
          account
        })
      });

      // CircuitBreaker
      console.log('[*] Desplegando CircuitBreaker...');
      const CircuitBreaker = loadArtifact('CircuitBreaker', 'CircuitBreaker.sol');
      const cbTx = await walletClient.deployContract({
        abi: CircuitBreaker.abi,
        bytecode: CircuitBreaker.bytecode.object,
        args: [account.address]
      });
      const cbAddr = (await publicClient.waitForTransactionReceipt({ hash: cbTx })).contractAddress!;
      currentContracts['CIRCUIT_BREAKER'] = cbAddr;
      console.log(`  ✅ CircuitBreaker desplegado en: ${cbAddr}`);

      // AlphaToken (VirajeToken)
      console.log('[*] Desplegando AlphaToken (VirajeToken)...');
      const alphaArtifact = loadArtifact('AlphaToken', 'AlphaToken.sol');
      const alphaTx = await walletClient.deployContract({
        abi: alphaArtifact.abi,
        bytecode: alphaArtifact.bytecode.object,
        args: [apAddr, account.address]
      });
      const alphaTokenAddr = (await publicClient.waitForTransactionReceipt({ hash: alphaTx })).contractAddress!;
      currentContracts['ALPHA_TOKEN'] = alphaTokenAddr;
      currentContracts['VIRAJE_TOKEN'] = alphaTokenAddr;
      console.log(`  ✅ VirajeToken desplegado en: ${alphaTokenAddr}`);

      // AlphaVault (VirajeVault)
      console.log('[*] Desplegando AlphaVault (VirajeVault)...');
      const alphaVaultArtifact = loadArtifact('AlphaVault', 'AlphaVault.sol');
      const alphaVaultTx = await walletClient.deployContract({
        abi: alphaVaultArtifact.abi,
        bytecode: alphaVaultArtifact.bytecode.object,
        args: [apAddr, account.address]
      });
      const vaultAddr = (await publicClient.waitForTransactionReceipt({ hash: alphaVaultTx })).contractAddress!;
      currentContracts['ALPHA_VAULT'] = vaultAddr;
      currentContracts['VIRAJE_VAULT'] = vaultAddr;
      console.log(`  ✅ VirajeVault desplegado en: ${vaultAddr}`);

      // TreasuryManager Implementation & Proxy
      const tmImplArtifact = loadArtifact('TreasuryManager', 'TreasuryManager.sol');
      const tmBytecodeLen = tmImplArtifact.bytecode.object.length / 2;
      
      if (tmBytecodeLen > 24576) {
        console.warn(`\n⚠️  [Límite EVM EIP-170 detectado]:`);
        console.warn(`    El bytecode compilado de TreasuryManager (${tmBytecodeLen} bytes) supera los 24,576 bytes permitidos en redes públicas.`);
        console.warn(`    En testnet pública Arbitrum Sepolia, los tokens (USDC, USDT, WBTC) ya están 100% operativos para transferencias y pruebas.`);
      } else {
        console.log('[*] Desplegando implementación de TreasuryManager...');
        const tmImplTx = await walletClient.deployContract({
          abi: tmImplArtifact.abi,
          bytecode: tmImplArtifact.bytecode.object,
          args: [apAddr]
        });
        const tmImplAddr = (await publicClient.waitForTransactionReceipt({ hash: tmImplTx })).contractAddress!;

        const TreasuryProxy = loadArtifact('TreasuryProxy', 'TreasuryProxy.sol');
        const proxyTx = await walletClient.deployContract({
          abi: TreasuryProxy.abi,
          bytecode: TreasuryProxy.bytecode.object,
          args: [tmImplAddr]
        });
        const treasuryAddr = (await publicClient.waitForTransactionReceipt({ hash: proxyTx })).contractAddress!;
        currentContracts['TREASURY'] = treasuryAddr;
        currentContracts['TREASURY_MANAGER'] = treasuryAddr;

        // Inicializar Tesorería
        await publicClient.waitForTransactionReceipt({
          hash: await walletClient.writeContract({
            address: treasuryAddr,
            abi: tmImplArtifact.abi,
            functionName: 'initialize',
            args: [account.address, usdcAddr, 6],
            account
          })
        });

        // Configurar Tope de TVL Anti-Exploit en $1,000,000 USD (1M) on-chain
        await publicClient.waitForTransactionReceipt({
          hash: await walletClient.writeContract({
            address: treasuryAddr,
            abi: tmImplArtifact.abi,
            functionName: 'setTvlCap',
            args: [parseEther('1000000')],
            account
          })
        });
        console.log('  🛡️ Configurado Anti-Exploit Cap en $1,000,000 USD (1M).');

        // Whitelist KYC para la cuenta del desplegador
        const kycAbi = [
          { name: 'setKYCStatus', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'account', type: 'address' }, { name: 'status', type: 'bool' }], outputs: [] }
        ] as const;
        await publicClient.waitForTransactionReceipt({
          hash: await walletClient.writeContract({
            address: treasuryAddr,
            abi: kycAbi,
            functionName: 'setKYCStatus',
            args: [account.address, true],
            account
          })
        });

        // Permisos Minteo en VirajeToken
        const acAbi = [
          { name: 'grantRole', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'role', type: 'bytes32' }, { name: 'account', type: 'address' }], outputs: [] }
        ] as const;
        const MINTER_ROLE = keccak256(toHex('MINTER_ROLE'));
        const BURNER_ROLE = keccak256(toHex('BURNER_ROLE'));
        const VAULT_MANAGER_ROLE = keccak256(toHex('VAULT_MANAGER_ROLE'));

        await publicClient.waitForTransactionReceipt({
          hash: await walletClient.writeContract({
            address: alphaTokenAddr,
            abi: acAbi,
            functionName: 'grantRole',
            args: [MINTER_ROLE, treasuryAddr],
            account
          })
        });

        await publicClient.waitForTransactionReceipt({
          hash: await walletClient.writeContract({
            address: alphaTokenAddr,
            abi: acAbi,
            functionName: 'grantRole',
            args: [BURNER_ROLE, treasuryAddr],
            account
          })
        });

        await publicClient.waitForTransactionReceipt({
          hash: await walletClient.writeContract({
            address: vaultAddr,
            abi: acAbi,
            functionName: 'grantRole',
            args: [VAULT_MANAGER_ROLE, treasuryAddr],
            account
          })
        });

        console.log(`  ✅ Tesorería inicializada y vinculada a VirajeToken con éxito.`);
      }
    } catch (contractErr: any) {
      console.warn(`\n⚠️  [Despliegue secundario omitido]: ${contractErr?.shortMessage || contractErr?.message}`);
      console.warn(`    Los tokens primarios (USDC, USDT, WBTC) se han desplegado y configurado exitosamente.`);
    }
  }

  // 4. Guardar archivo contracts.json
  console.log('\n[*] Actualizando frontend/src/contracts.json...');
  fs.writeFileSync(contractsJsonPath, JSON.stringify(currentContracts, null, 2), 'utf8');

  // 5. Actualizar archivo .env en la raíz
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
    if (currentContracts['TREASURY']) updateEnv('VITE_TREASURY_ADDRESS', currentContracts['TREASURY']);
    fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
    console.log('[*] Actualizado archivo .env de la raíz con las nuevas direcciones.');
  }

  console.log('\n================================================================');
  console.log('  ¡DESPLIEGUE FINALIZADO CON ÉXITO EN ARBITRUM SEPOLIA!         ');
  console.log('================================================================');
  console.log(`USDC:            ${currentContracts['USDC']}`);
  console.log(`                 https://sepolia.arbiscan.io/address/${currentContracts['USDC']}`);
  console.log(`USDT:            ${currentContracts['USDT']}`);
  console.log(`WBTC:            ${currentContracts['WBTC']}`);
  if (currentContracts['TREASURY']) {
    console.log(`Tesorería:       ${currentContracts['TREASURY']}`);
    console.log(`                 https://sepolia.arbiscan.io/address/${currentContracts['TREASURY']}`);
  }
  console.log('================================================================\n');
  console.log('🎉 ¡Tu billetera ya tiene 1,000,000 USDC acreditados en Arbitrum Sepolia!');
  console.log('\n💡 Instrucciones para ti y tus amigos:');
  console.log('1. En MetaMask, ve a "Importar tokens" y pega la dirección de USDC:');
  console.log(`   ${currentContracts['USDC']}`);
  console.log('2. Para enviar fondos a tus amigos:');
  console.log('   Usa el botón "Enviar" de MetaMask, introduce la dirección de tu amigo y la cantidad (ej. 10,000 USDC).');
  console.log('3. Al conectar sus billeteras a la plataforma, verán su saldo listo para operar.');
}

main().catch((err) => {
  console.error('\n❌ [Error fatal durante el despliegue]:', err);
  process.exit(1);
});
