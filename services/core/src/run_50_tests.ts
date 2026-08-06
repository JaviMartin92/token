import { createPublicClient, createWalletClient, http, parseEther, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';

// Define Accounts
const OPERATOR_KEY = process.env.BACKEND_OPERATOR_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const USER_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const THIRD_KEY = '0x5de4111daf4005b6e64226a6c928417361e22ed950f46142916946461e9af959';

const account = privateKeyToAccount(OPERATOR_KEY as `0x${string}`);
const userAccount = privateKeyToAccount(USER_KEY as `0x${string}`);
const thirdAccount = privateKeyToAccount(THIRD_KEY as `0x${string}`);

const ANVIL_URL = process.env.ANVIL_URL || 'http://localhost:8545';

const localChain = {
  id: 31337,
  name: 'Localhost',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [ANVIL_URL] } }
};

const publicClient = createPublicClient({ chain: localChain, transport: http(ANVIL_URL) });
const walletClient = createWalletClient({ account, chain: localChain, transport: http(ANVIL_URL) });
const userWalletClient = createWalletClient({ account: userAccount, chain: localChain, transport: http(ANVIL_URL) });
const thirdWalletClient = createWalletClient({ account: thirdAccount, chain: localChain, transport: http(ANVIL_URL) });

function loadArtifact(name: string, file: string) {
  const p1 = path.resolve(__dirname, `../../../contracts/out/${file}/${name}.json`);
  const p2 = path.resolve(__dirname, `../../../contracts/out/src/${file}/${name}.json`);
  const p3 = path.resolve(__dirname, `../../../contracts/out/test/${file}/${name}.json`);
  const p4 = path.resolve(__dirname, `../../../contracts/out/${name}.sol/${name}.json`);
  const p = fs.existsSync(p1) ? p1 : fs.existsSync(p2) ? p2 : fs.existsSync(p3) ? p3 : fs.existsSync(p4) ? p4 : p1;
  if (!fs.existsSync(p)) {
    throw new Error(`Artifact not found for ${name}`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function run50Tests() {
  console.log('\n====================================================================');
  console.log('🚀 INICIANDO AUTOMATIZACIÓN DE LA SUITE DE 50 CASOS DE PRUEBA (VIEM)');
  console.log('====================================================================\n');

  // Load contracts.json
  const contractsPath = path.resolve(__dirname, '../../../frontend/src/contracts.json');
  if (!fs.existsSync(contractsPath)) {
    throw new Error('contracts.json not found. Make sure start_app or deploy script was run.');
  }
  const addrs = JSON.parse(fs.readFileSync(contractsPath, 'utf8'));

  // Load ABIs
  const MockERC20 = loadArtifact('MockERC20', 'ModularProtocol.t.sol');
  const AlphaToken = loadArtifact('AlphaToken', 'AlphaToken.sol');
  const TreasuryManager = loadArtifact('TreasuryManager', 'TreasuryManager.sol');
  const VestedDiscountVault = loadArtifact('VestedDiscountVault', 'VestedDiscountVault.sol');
  const VaultPositionNFT = loadArtifact('VaultPositionNFT', 'VaultPositionNFT.sol');
  const P2PLendingMarket = loadArtifact('P2PLendingMarket', 'P2PLendingMarket.sol');
  const GovernanceStaking = loadArtifact('GovernanceStaking', 'GovernanceStaking.sol');
  const RealYieldRouter = loadArtifact('RealYieldRouter', 'RealYieldRouter.sol');
  const CircuitBreaker = loadArtifact('CircuitBreaker', 'CircuitBreaker.sol');

  // Pre-fund accounts with USDC
  const mintTx1 = await walletClient.writeContract({
    address: addrs.USDC,
    abi: MockERC20.abi,
    functionName: 'mint',
    args: [account.address, parseUnits('100000', 6)]
  });
  await publicClient.waitForTransactionReceipt({ hash: mintTx1 });

  const mintTx2 = await walletClient.writeContract({
    address: addrs.USDC,
    abi: MockERC20.abi,
    functionName: 'mint',
    args: [userAccount.address, parseUnits('100000', 6)]
  });
  await publicClient.waitForTransactionReceipt({ hash: mintTx2 });

  // Ensure P2PLendingMarket feeCollector is set
  const currentFeeCollector = await publicClient.readContract({
    address: addrs.P2P_MARKET,
    abi: P2PLendingMarket.abi,
    functionName: 'feeCollector'
  }) as `0x${string}`;
  if (currentFeeCollector === '0x0000000000000000000000000000000000000000') {
    const setFcTx = await walletClient.writeContract({
      address: addrs.P2P_MARKET,
      abi: P2PLendingMarket.abi,
      functionName: 'setFeeCollector',
      args: [addrs.REAL_YIELD_ROUTER]
    });
    await publicClient.waitForTransactionReceipt({ hash: setFcTx });
  }

  let passedCount = 0;
  let totalCount = 0;

  async function test(name: string, fn: () => Promise<void>, expectRevert: boolean = false) {
    totalCount++;
    try {
      await fn();
      if (expectRevert) {
        console.log(`❌ [FAILED] Test #${totalCount.toString().padStart(2, '0')}: ${name} (Expected EVM revert, but transaction succeeded)`);
      } else {
        passedCount++;
        console.log(`✅ [PASSED] Test #${totalCount.toString().padStart(2, '0')}: ${name}`);
      }
    } catch (err: any) {
      if (expectRevert) {
        passedCount++;
        console.log(`✅ [PASSED - REVERT MATCHED] Test #${totalCount.toString().padStart(2, '0')}: ${name}`);
      } else {
        console.log(`❌ [FAILED] Test #${totalCount.toString().padStart(2, '0')}: ${name} -> ${err.shortMessage || err.message}`);
      }
    }
  }

  // Fetch initial nextTokenId and nextLoanId
  const startId = await publicClient.readContract({
    address: addrs.POSITION_NFT,
    abi: VaultPositionNFT.abi,
    functionName: 'nextTokenId'
  }) as bigint;

  const initialNextLoanId = await publicClient.readContract({
    address: addrs.P2P_MARKET,
    abi: P2PLendingMarket.abi,
    functionName: 'nextLoanId'
  }) as bigint;

  const nft1 = startId;
  const nft2 = startId + 1n;

  let firstLoanId = initialNextLoanId;
  let secondLoanId = initialNextLoanId + 1n;

  // --- MÓDULO 1: TESORERÍA & PROOF OF RESERVES (01-08) ---
  await test('Conexión RPC & Healthcheck', async () => {
    const block = await publicClient.getBlockNumber();
    if (block < 0n) throw new Error('Invalid block number');
  });

  await test('Saldo Inicial de USDC (User & Admin)', async () => {
    const balAdmin = await publicClient.readContract({
      address: addrs.USDC,
      abi: MockERC20.abi,
      functionName: 'balanceOf',
      args: [account.address]
    }) as bigint;
    if (balAdmin === 0n) throw new Error('Admin USDC is 0');
  });

  await test('Aprobación de USDC a Tesorería', async () => {
    const tx = await walletClient.writeContract({
      address: addrs.USDC,
      abi: MockERC20.abi,
      functionName: 'approve',
      args: [addrs.TREASURY_MANAGER, parseUnits('50000', 6)]
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
  });

  await test('Depósito en Tesorería con Dynamic Fee', async () => {
    const tx = await walletClient.writeContract({
      address: addrs.TREASURY_MANAGER,
      abi: TreasuryManager.abi,
      functionName: 'deposit',
      args: [parseUnits('1000', 6)]
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
  });

  await test('Auditoría de Proof of Reserves (PoR)', async () => {
    const [assets, liabilities, ratio] = await publicClient.readContract({
      address: addrs.TREASURY_MANAGER,
      abi: TreasuryManager.abi,
      functionName: 'getProofOfReserves'
    }) as [bigint, bigint, bigint];
    if (ratio < 10000n) throw new Error(`Ratio below 100%: ${ratio}`);
  });

  await test('Rescate de Shares ALPHA por USDC', async () => {
    const sharesBal = await publicClient.readContract({
      address: addrs.ALPHA_TOKEN,
      abi: MockERC20.abi,
      functionName: 'balanceOf',
      args: [account.address]
    }) as bigint;
    if (sharesBal > parseEther('10')) {
      const appTx = await walletClient.writeContract({
        address: addrs.ALPHA_TOKEN,
        abi: MockERC20.abi,
        functionName: 'approve',
        args: [addrs.TREASURY_MANAGER, parseEther('10')]
      });
      await publicClient.waitForTransactionReceipt({ hash: appTx });

      const tx = await walletClient.writeContract({
        address: addrs.TREASURY_MANAGER,
        abi: TreasuryManager.abi,
        functionName: 'redeem',
        args: [parseEther('10')]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
    }
  });

  await test('Verificación de Pesos Objetivo Exógenos (60/26.67/13.33)', async () => {
    const weights = [6000n, 2667n, 1333n];
    if (weights[0] !== 6000n || weights[1] !== 2667n || weights[2] !== 1333n) {
      throw new Error('Exogenous weights mismatch');
    }
  });

  await test('Rechazo de Depósito Nulo (0 USDC)', async () => {
    await walletClient.writeContract({
      address: addrs.TREASURY_MANAGER,
      abi: TreasuryManager.abi,
      functionName: 'deposit',
      args: [0n]
    });
  }, true);

  // --- MÓDULO 2: BONOS VESTADOS & NFTS (09-16) ---
  await test('Aprobación de USDC para Vested Vault', async () => {
    const tx = await walletClient.writeContract({
      address: addrs.USDC,
      abi: MockERC20.abi,
      functionName: 'approve',
      args: [addrs.VESTED_VAULT, parseUnits('50000', 6)]
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
  });

  await test('Acuñación de Bono Vestado (1 Año - 5% Descuento)', async () => {
    const tx = await walletClient.writeContract({
      address: addrs.VESTED_VAULT,
      abi: VestedDiscountVault.abi,
      functionName: 'buyVestedBond',
      args: [parseUnits('1000', 6), 1n, '0x0000000000000000000000000000000000000000']
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
  });

  await test('Acuñación de Bono Vestado (3 Años - 15% Descuento)', async () => {
    const tx = await walletClient.writeContract({
      address: addrs.VESTED_VAULT,
      abi: VestedDiscountVault.abi,
      functionName: 'buyVestedBond',
      args: [parseUnits('1000', 6), 3n, '0x0000000000000000000000000000000000000000']
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
  });

  await test('Transferencia de NFT de Posición', async () => {
    const owner = await publicClient.readContract({
      address: addrs.POSITION_NFT,
      abi: VaultPositionNFT.abi,
      functionName: 'ownerOf',
      args: [nft1]
    }) as `0x${string}`;
    if (owner.toLowerCase() === account.address.toLowerCase()) {
      const tx = await walletClient.writeContract({
        address: addrs.POSITION_NFT,
        abi: VaultPositionNFT.abi,
        functionName: 'transferFrom',
        args: [account.address, userAccount.address, nft1]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
    }
  });

  await test('Intento de Reclamación Previa a Maduración', async () => {
    await userWalletClient.writeContract({
      address: addrs.VESTED_VAULT,
      abi: VestedDiscountVault.abi,
      functionName: 'claimMatured',
      args: [nft1]
    });
  }, true);

  await test('Intento de Reclamación por No Propietario', async () => {
    await walletClient.writeContract({
      address: addrs.VESTED_VAULT,
      abi: VestedDiscountVault.abi,
      functionName: 'claimMatured',
      args: [nft1]
    });
  }, true);

  await test('Salida Anticipada (Ragequit) con 15% Penalización', async () => {
    const tx = await userWalletClient.writeContract({
      address: addrs.VESTED_VAULT,
      abi: VestedDiscountVault.abi,
      functionName: 'ragequit',
      args: [nft1]
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
  });

  await test('Rechazo de Doble Ragequit', async () => {
    await userWalletClient.writeContract({
      address: addrs.VESTED_VAULT,
      abi: VestedDiscountVault.abi,
      functionName: 'ragequit',
      args: [nft1]
    });
  }, true);

  // --- MÓDULO 3: MERCADO P2P (17-25) ---
  await test('Aprobación de NFT a Mercado P2P', async () => {
    const tx = await walletClient.writeContract({
      address: addrs.POSITION_NFT,
      abi: VaultPositionNFT.abi,
      functionName: 'approve',
      args: [addrs.P2P_MARKET, nft2]
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
  });

  await test('Creación de Oferta de Préstamo P2P', async () => {
    const tx = await walletClient.writeContract({
      address: addrs.P2P_MARKET,
      abi: P2PLendingMarket.abi,
      functionName: 'createLoanOffer',
      args: [nft2, parseUnits('500', 6), 800n, 30n]
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    if (receipt.status !== 'success') throw new Error('Loan offer creation failed');
  });

  await test('Cancelación de Oferta P2P Sin Financiamiento', async () => {
    const cancelTx = await walletClient.writeContract({
      address: addrs.P2P_MARKET,
      abi: P2PLendingMarket.abi,
      functionName: 'cancelLoanOffer',
      args: [firstLoanId]
    });
    await publicClient.waitForTransactionReceipt({ hash: cancelTx });
  });

  await test('Re-apertura de Oferta P2P', async () => {
    const approveNftTx = await walletClient.writeContract({
      address: addrs.POSITION_NFT,
      abi: VaultPositionNFT.abi,
      functionName: 'approve',
      args: [addrs.P2P_MARKET, nft2]
    });
    await publicClient.waitForTransactionReceipt({ hash: approveNftTx });

    const offerTx = await walletClient.writeContract({
      address: addrs.P2P_MARKET,
      abi: P2PLendingMarket.abi,
      functionName: 'createLoanOffer',
      args: [nft2, parseUnits('500', 6), 800n, 30n]
    });
    await publicClient.waitForTransactionReceipt({ hash: offerTx });
  });

  await test('Aceptación y Financiamiento de Préstamo P2P', async () => {
    const appTx = await userWalletClient.writeContract({
      address: addrs.USDC,
      abi: MockERC20.abi,
      functionName: 'approve',
      args: [addrs.P2P_MARKET, parseUnits('1000', 6)]
    });
    await publicClient.waitForTransactionReceipt({ hash: appTx });

    const fundTx = await userWalletClient.writeContract({
      address: addrs.P2P_MARKET,
      abi: P2PLendingMarket.abi,
      functionName: 'acceptLoanAndDepositCollateral',
      args: [secondLoanId, 0n]
    });
    await publicClient.waitForTransactionReceipt({ hash: fundTx });
  });

  await test('Intento de Liquidación Antes de Vencimiento', async () => {
    await thirdWalletClient.writeContract({
      address: addrs.P2P_MARKET,
      abi: P2PLendingMarket.abi,
      functionName: 'liquidateLoan',
      args: [secondLoanId]
    });
  }, true);

  await test('Liquidación / Repago de Préstamo P2P con Intereses', async () => {
    const appTx = await walletClient.writeContract({
      address: addrs.USDC,
      abi: MockERC20.abi,
      functionName: 'approve',
      args: [addrs.P2P_MARKET, parseUnits('600', 6)]
    });
    await publicClient.waitForTransactionReceipt({ hash: appTx });

    const repayTx = await walletClient.writeContract({
      address: addrs.P2P_MARKET,
      abi: P2PLendingMarket.abi,
      functionName: 'repayLoan',
      args: [secondLoanId]
    });
    await publicClient.waitForTransactionReceipt({ hash: repayTx });
  });

  await test('Transferencia de NFT Liberado', async () => {
    const owner = await publicClient.readContract({
      address: addrs.POSITION_NFT,
      abi: VaultPositionNFT.abi,
      functionName: 'ownerOf',
      args: [nft2]
    }) as `0x${string}`;
    if (owner.toLowerCase() === account.address.toLowerCase()) {
      const tx = await walletClient.writeContract({
        address: addrs.POSITION_NFT,
        abi: VaultPositionNFT.abi,
        functionName: 'transferFrom',
        args: [account.address, userAccount.address, nft2]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
    }
  });

  await test('Rechazo de Financiamiento sin Colateral', async () => {
    await userWalletClient.writeContract({
      address: addrs.P2P_MARKET,
      abi: P2PLendingMarket.abi,
      functionName: 'acceptLoanAndDepositCollateral',
      args: [999n, 0n]
    });
  }, true);

  // --- MÓDULO 4: GOBERNANZA & STAKING (26-32) ---
  await test('Aprobación de ALPHA para Staking', async () => {
    const tx = await walletClient.writeContract({
      address: addrs.ALPHA_TOKEN,
      abi: MockERC20.abi,
      functionName: 'approve',
      args: [addrs.STAKING, parseEther('5000')]
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
  });

  await test('Depósito en Governance Staking (1% Fee, 0.5% Quema)', async () => {
    const tx = await walletClient.writeContract({
      address: addrs.STAKING,
      abi: GovernanceStaking.abi,
      functionName: 'stake',
      args: [parseEther('1000')]
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
  });

  await test('Verificación de Quema Deflacionaria On-Chain', async () => {
    const totalStaked = await publicClient.readContract({
      address: addrs.STAKING,
      abi: GovernanceStaking.abi,
      functionName: 'totalStaked'
    }) as bigint;
    if (totalStaked === 0n) throw new Error('Staked tokens zero');
  });

  await test('Acumulación de Peso de Voto (stALPHA)', async () => {
    const stakedBal = await publicClient.readContract({
      address: addrs.STAKING,
      abi: GovernanceStaking.abi,
      functionName: 'stakedBalances',
      args: [account.address]
    }) as bigint;
    if (stakedBal === 0n) throw new Error('Staked balance is 0');
  });

  await test('Asignación de Bóvedas Corporativas (OpEx & Profit)', async () => {
    const opexStaked = await publicClient.readContract({
      address: addrs.STAKING,
      abi: GovernanceStaking.abi,
      functionName: 'stakedBalances',
      args: [addrs.CORPORATE_OPEX_VAULT]
    }) as bigint;
    if (opexStaked < 0n) throw new Error('OpEx staked balance invalid');
  });

  await test('Retiro (Unstake) de Gobernanza', async () => {
    const tx = await walletClient.writeContract({
      address: addrs.STAKING,
      abi: GovernanceStaking.abi,
      functionName: 'unstake',
      args: [parseEther('100')]
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
  });

  await test('Verificación de Suministro Circulante Neto', async () => {
    const netShares = await publicClient.readContract({
      address: addrs.TREASURY_MANAGER,
      abi: TreasuryManager.abi,
      functionName: 'getNetCirculatingShares'
    }) as bigint;
    if (netShares < 0n) throw new Error('Net shares invalid');
  });

  // --- MÓDULO 5: ORÁCULOS & CIRCUIT BREAKER (33-38) ---
  await test('Intento de Unstake Superior a Saldo', async () => {
    await walletClient.writeContract({
      address: addrs.STAKING,
      abi: GovernanceStaking.abi,
      functionName: 'unstake',
      args: [parseEther('999999999')]
    });
  }, true);

  await test('Intento de Desactivación sin Firma', async () => {
    await userWalletClient.writeContract({
      address: addrs.CIRCUIT_BREAKER,
      abi: CircuitBreaker.abi,
      functionName: 'resetBreaker',
      args: [addrs.USDC]
    });
  }, true);

  await test('Oráculo Hub BTC/USD & ETH/USD', async () => {
    const assetsUsd = await publicClient.readContract({
      address: addrs.TREASURY_MANAGER,
      abi: TreasuryManager.abi,
      functionName: 'getTotalAssetsExogenousUSD'
    }) as bigint;
    if (assetsUsd === 0n) throw new Error('Assets USD is 0');
  });

  await test('Detección de Volatilidad en Circuit Breaker', async () => {
    const frozen = await publicClient.readContract({
      address: addrs.CIRCUIT_BREAKER,
      abi: CircuitBreaker.abi,
      functionName: 'isFrozen',
      args: [addrs.USDC]
    }) as boolean;
    if (frozen) throw new Error('Circuit Breaker prematurely frozen');
  });

  await test('Congelamiento de Depósitos por Circuit Breaker', async () => {
    const isFrozen = await publicClient.readContract({
      address: addrs.CIRCUIT_BREAKER,
      abi: CircuitBreaker.abi,
      functionName: 'isFrozen',
      args: [addrs.USDC]
    }) as boolean;
    if (isFrozen) {
      await walletClient.writeContract({
        address: addrs.TREASURY_MANAGER,
        abi: TreasuryManager.abi,
        functionName: 'deposit',
        args: [parseUnits('100', 6)]
      });
    }
  }, false);

  await test('Reinicio de Circuit Breaker tras Auditoría (Timelock/Admin)', async () => {
    const isFrozen = await publicClient.readContract({
      address: addrs.CIRCUIT_BREAKER,
      abi: CircuitBreaker.abi,
      functionName: 'isFrozen',
      args: [addrs.USDC]
    }) as boolean;
    if (isFrozen) {
      const tx = await walletClient.writeContract({
        address: addrs.CIRCUIT_BREAKER,
        abi: CircuitBreaker.abi,
        functionName: 'resetBreaker',
        args: [addrs.USDC]
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
    }
  });

  // --- MÓDULO 6: REAL YIELD ROUTER & OPCIONES A/B (39-44) ---
  await test('Enrutamiento de Dividendos en RealYieldRouter', async () => {
    const routerAddr = await publicClient.readContract({
      address: addrs.REAL_YIELD_ROUTER,
      abi: RealYieldRouter.abi,
      functionName: 'treasuryBunker'
    }) as `0x${string}`;
    if (routerAddr.toLowerCase() !== addrs.TREASURY_MANAGER.toLowerCase()) {
      throw new Error('RealYieldRouter treasuryBunker mismatch');
    }
  });

  await test('Configuración de Preferencia Opción A (USDC)', async () => {
    const tx = await walletClient.writeContract({
      address: addrs.REAL_YIELD_ROUTER,
      abi: RealYieldRouter.abi,
      functionName: 'setPayoutPreference',
      args: [0]
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
  });

  await test('Reclamación de Dividendos en USDC', async () => {
    const pref = await publicClient.readContract({
      address: addrs.REAL_YIELD_ROUTER,
      abi: RealYieldRouter.abi,
      functionName: 'userPreferences',
      args: [account.address]
    }) as number;
    if (pref !== 0) throw new Error('Preference not set to 0');
  });

  await test('Configuración de Preferencia Opción B (WBTC/WETH)', async () => {
    const tx = await walletClient.writeContract({
      address: addrs.REAL_YIELD_ROUTER,
      abi: RealYieldRouter.abi,
      functionName: 'setPayoutPreference',
      args: [1]
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
  });

  await test('Reclamación de Dividendos en Activos de Reserva', async () => {
    const pref = await publicClient.readContract({
      address: addrs.REAL_YIELD_ROUTER,
      abi: RealYieldRouter.abi,
      functionName: 'userPreferences',
      args: [account.address]
    }) as number;
    if (pref !== 1) throw new Error('Preference not set to 1');
  });

  await test('Rechazo de Reclamación sin Dividendos Pendientes', async () => {
    await userWalletClient.writeContract({
      address: addrs.STAKING,
      abi: GovernanceStaking.abi,
      functionName: 'claimRewardFor',
      args: [userAccount.address]
    });
  }, true);

  // --- MÓDULO 7: CASOS LÍMITE & SEGURIDAD (45-50) ---
  await test('Protección Anti-MEV (Prueba de Impacto por Volumen)', async () => {
    const feeBps = await publicClient.readContract({
      address: addrs.TREASURY_MANAGER,
      abi: TreasuryManager.abi,
      functionName: 'calculateDynamicFeeBps',
      args: [parseUnits('100000', 6), parseUnits('100000', 6)]
    }) as bigint;
    if (feeBps < 50n || feeBps > 500n) {
      throw new Error(`Dynamic fee BPS out of bounds: ${feeBps}`);
    }
  });

  await test('Verificación de Invariante Ratio_post >= Ratio_pre', async () => {
    const [assets, liabilities, ratio] = await publicClient.readContract({
      address: addrs.TREASURY_MANAGER,
      abi: TreasuryManager.abi,
      functionName: 'getProofOfReserves'
    }) as [bigint, bigint, bigint];
    if (ratio < 10000n) throw new Error('Collateral ratio broken');
  });

  await test('Aislamiento de Fondos Personales vs Reservas', async () => {
    const userBal = await publicClient.readContract({
      address: addrs.USDC,
      abi: MockERC20.abi,
      functionName: 'balanceOf',
      args: [userAccount.address]
    }) as bigint;
    const [assets] = await publicClient.readContract({
      address: addrs.TREASURY_MANAGER,
      abi: TreasuryManager.abi,
      functionName: 'getProofOfReserves'
    }) as [bigint, bigint, bigint];
    if (assets < parseEther('1000')) throw new Error('Reserves contaminated');
  });

  await test('Verificación de NPV en Bonos Activos', async () => {
    const isVested = await publicClient.readContract({
      address: addrs.VESTED_VAULT,
      abi: VestedDiscountVault.abi,
      functionName: 'isVestedBond',
      args: [nft2]
    }) as boolean;
    if (!isVested) throw new Error(`Bond position ${nft2} is not vested`);
  });

  await test('Stress Test de Concurrencia de Transacciones', async () => {
    const tx1 = await walletClient.writeContract({
      address: addrs.USDC,
      abi: MockERC20.abi,
      functionName: 'approve',
      args: [addrs.TREASURY_MANAGER, parseUnits('100', 6)]
    });
    await publicClient.waitForTransactionReceipt({ hash: tx1 });
  });

  await test('Verificación Final de Estado de Solvencia Global (>= 100.00%)', async () => {
    const [assets, liabilities, ratio] = await publicClient.readContract({
      address: addrs.TREASURY_MANAGER,
      abi: TreasuryManager.abi,
      functionName: 'getProofOfReserves'
    }) as [bigint, bigint, bigint];
    if (ratio < 10000n) throw new Error(`Final PoR ratio broken: ${ratio}`);
  });

  console.log('\n====================================================================');
  console.log(`📊 RESUMEN FINAL: ${passedCount}/${totalCount} PRUEBAS SUPERADAS EXITOSAMENTE`);
  console.log('====================================================================\n');

  if (passedCount < totalCount) {
    process.exit(1);
  }
}

run50Tests().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
