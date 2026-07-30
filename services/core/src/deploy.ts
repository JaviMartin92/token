import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrum } from 'viem/chains';
import fs from 'fs';
import path from 'path';

const ANVIL_URL = process.env.ANVIL_URL || 'http://localhost:8545';

// SECURITY: Private key MUST be supplied via environment variable.
// Never hardcode private keys in source code.
const OPERATOR_KEY = process.env.BACKEND_OPERATOR_PRIVATE_KEY;
if (!OPERATOR_KEY) {
  throw new Error('BACKEND_OPERATOR_PRIVATE_KEY environment variable is not set. Aborting deploy.');
}
const account = privateKeyToAccount(OPERATOR_KEY as `0x${string}`);

const publicClient = createPublicClient({
  chain: arbitrum,
  transport: http(ANVIL_URL)
});

const walletClient = createWalletClient({
  account,
  chain: arbitrum,
  transport: http(ANVIL_URL)
});

function loadArtifact(name: string, file: string) {
  const p1 = path.resolve(__dirname, `../../../contracts/out/${file}/${name}.json`);
  const p2 = path.resolve(__dirname, `../../../contracts/out/adapters/${file}/${name}.json`);
  const p = fs.existsSync(p1) ? p1 : fs.existsSync(p2) ? p2 : p1;
  if (!fs.existsSync(p)) {
    throw new Error(`Artifact not found at ${p1} nor ${p2}. Run forge compile first.`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function main() {
  console.log('[*] Starting full deployment of Sandbox Smart Contracts onto Anvil...');

  const MockERC20 = loadArtifact('MockERC20', 'Treasury.t.sol');
  const MockChainlinkFeed = loadArtifact('MockChainlinkFeed', 'Treasury.t.sol');
  const MockSwapRouter = loadArtifact('MockSwapRouter', 'Treasury.t.sol');
  const Treasury = loadArtifact('Treasury', 'Treasury.sol');
  const CircuitBreaker = loadArtifact('CircuitBreaker', 'CircuitBreaker.sol');
  const AtomicSwapReceiver = loadArtifact('AtomicSwapReceiver', 'AtomicSwapReceiver.sol');
  const YieldStreamingVault = loadArtifact('YieldStreamingVault', 'YieldStreamingVault.sol');
  const CorporateContribution = loadArtifact('CorporateContribution', 'CorporateContribution.sol');

  // 1. Deploy Mock USDC and Mock USDT
  const usdcTx = await walletClient.deployContract({
    abi: MockERC20.abi,
    bytecode: MockERC20.bytecode.object,
    args: ['USD Coin', 'USDC']
  });
  const usdcAddr = (await publicClient.waitForTransactionReceipt({ hash: usdcTx })).contractAddress!;
  console.log(`[+] Mock USDC deployed at: ${usdcAddr}`);

  const usdtTx = await walletClient.deployContract({
    abi: MockERC20.abi,
    bytecode: MockERC20.bytecode.object,
    args: ['Tether USD', 'USDT']
  });
  const usdtAddr = (await publicClient.waitForTransactionReceipt({ hash: usdtTx })).contractAddress!;
  console.log(`[+] Mock USDT deployed at: ${usdtAddr}`);

  // 2. Deploy Mock Feed
  const feedTx = await walletClient.deployContract({
    abi: MockChainlinkFeed.abi,
    bytecode: MockChainlinkFeed.bytecode.object,
    args: [8, 100000000n]
  });
  const feedAddr = (await publicClient.waitForTransactionReceipt({ hash: feedTx })).contractAddress!;
  console.log(`[+] Mock Price Feed deployed at: ${feedAddr}`);

  // 3. Deploy Mock Swap Router
  const routerTx = await walletClient.deployContract({
    abi: MockSwapRouter.abi,
    bytecode: MockSwapRouter.bytecode.object,
    args: [usdcAddr, address(0x999)]
  });
  const routerAddr = (await publicClient.waitForTransactionReceipt({ hash: routerTx })).contractAddress!;
  console.log(`[+] Mock Swap Router deployed at: ${routerAddr}`);

  // 4. Deploy Treasury
  const treasuryTx = await walletClient.deployContract({
    abi: Treasury.abi,
    bytecode: Treasury.bytecode.object,
    args: [account.address, usdcAddr, 18]
  });
  const treasuryAddr = (await publicClient.waitForTransactionReceipt({ hash: treasuryTx })).contractAddress!;
  console.log(`[+] Treasury Contract deployed at: ${treasuryAddr}`);

  // 5. Deploy CircuitBreaker
  const cbTx = await walletClient.deployContract({
    abi: CircuitBreaker.abi,
    bytecode: CircuitBreaker.bytecode.object,
    args: [account.address]
  });
  const cbAddr = (await publicClient.waitForTransactionReceipt({ hash: cbTx })).contractAddress!;
  console.log(`[+] CircuitBreaker Contract deployed at: ${cbAddr}`);

  // 6. Deploy AtomicSwapReceiver
  const swapTx = await walletClient.deployContract({
    abi: AtomicSwapReceiver.abi,
    bytecode: AtomicSwapReceiver.bytecode.object,
    args: [usdtAddr, usdcAddr, routerAddr, treasuryAddr, account.address]
  });
  const swapAddr = (await publicClient.waitForTransactionReceipt({ hash: swapTx })).contractAddress!;
  console.log(`[+] AtomicSwapReceiver Contract deployed at: ${swapAddr}`);

  // 7. Deploy YieldStreamingVault
  const yieldTx = await walletClient.deployContract({
    abi: YieldStreamingVault.abi,
    bytecode: YieldStreamingVault.bytecode.object,
    args: [usdcAddr, account.address]
  });
  const yieldAddr = (await publicClient.waitForTransactionReceipt({ hash: yieldTx })).contractAddress!;
  console.log(`[+] YieldStreamingVault Contract deployed at: ${yieldAddr}`);

  // 8. Deploy CorporateContribution
  const corpTx = await walletClient.deployContract({
    abi: CorporateContribution.abi,
    bytecode: CorporateContribution.bytecode.object,
    args: [usdcAddr, address(0x999), address(0x888), routerAddr, account.address]
  });
  const corpAddr = (await publicClient.waitForTransactionReceipt({ hash: corpTx })).contractAddress!;
  console.log(`[+] CorporateContribution Contract deployed at: ${corpAddr}`);

  // 9. Deploy VaultPositionNFT
  const nftArtifact = loadArtifact('VaultPositionNFT', 'VaultPositionNFT.sol');
  const nftTx = await walletClient.deployContract({
    abi: nftArtifact.abi,
    bytecode: nftArtifact.bytecode.object,
    args: [account.address]
  });
  const nftAddr = (await publicClient.waitForTransactionReceipt({ hash: nftTx })).contractAddress!;
  console.log(`[+] VaultPositionNFT Contract deployed at: ${nftAddr}`);

  // 10. Deploy GovernanceStaking
  const stakingArtifact = loadArtifact('GovernanceStaking', 'GovernanceStaking.sol');
  const stakingTx = await walletClient.deployContract({
    abi: stakingArtifact.abi,
    bytecode: stakingArtifact.bytecode.object,
    args: [treasuryAddr, usdcAddr, account.address] // ALPHA token = treasuryAddr
  });
  const stakingAddr = (await publicClient.waitForTransactionReceipt({ hash: stakingTx })).contractAddress!;
  console.log(`[+] GovernanceStaking Contract deployed at: ${stakingAddr}`);

  // 11. Deploy RealYieldRouter
  const routerYieldArtifact = loadArtifact('RealYieldRouter', 'RealYieldRouter.sol');
  const ryRouterTx = await walletClient.deployContract({
    abi: routerYieldArtifact.abi,
    bytecode: routerYieldArtifact.bytecode.object,
    args: [usdcAddr, treasuryAddr, routerAddr, stakingAddr, account.address]
  });
  const ryRouterAddr = (await publicClient.waitForTransactionReceipt({ hash: ryRouterTx })).contractAddress!;
  console.log(`[+] RealYieldRouter Contract deployed at: ${ryRouterAddr}`);

  // Authorize RealYieldRouter on GovernanceStaking to claim rewards
  const authStakingTx = await walletClient.writeContract({
    address: stakingAddr,
    abi: stakingArtifact.abi,
    functionName: 'setAuthorizedCaller',
    args: [ryRouterAddr, true],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: authStakingTx });
  console.log(`[+] Authorized RealYieldRouter on GovernanceStaking.`);

  // 11.5 Deploy Corporate OpEx and Profit Vaults
  const opExArtifact = loadArtifact('CorporateOpExVault', 'CorporateOpExVault.sol');
  const opExTx = await walletClient.deployContract({
    abi: opExArtifact.abi,
    bytecode: opExArtifact.bytecode.object,
    args: [treasuryAddr, account.address],
    account
  });
  const corpOpExAddr = (await publicClient.waitForTransactionReceipt({ hash: opExTx })).contractAddress!;
  console.log(`[+] CorporateOpExVault Contract deployed at: ${corpOpExAddr}`);

  const profitArtifact = loadArtifact('CorporateProfitVault', 'CorporateProfitVault.sol');
  const profitTx = await walletClient.deployContract({
    abi: profitArtifact.abi,
    bytecode: profitArtifact.bytecode.object,
    args: [treasuryAddr, account.address],
    account
  });
  const corpProfitAddr = (await publicClient.waitForTransactionReceipt({ hash: profitTx })).contractAddress!;
  console.log(`[+] CorporateProfitVault Contract deployed at: ${corpProfitAddr}`);

  // Set Treasury, Corporate OpEx Vault, Corporate Profit Vault on RealYieldRouter for 50/25/25 fee split with Auto-Swap
  const setRyWalletsTx = await walletClient.writeContract({
    address: ryRouterAddr,
    abi: routerYieldArtifact.abi,
    functionName: 'setCorporateVaults',
    args: [treasuryAddr, corpOpExAddr, corpProfitAddr, treasuryAddr],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: setRyWalletsTx });
  console.log(`[+] Configured 50/25/25 Corporate Auto-Staking Vaults (50% Treasury, 25% OpEx ALPHA Vault, 25% Profit ALPHA Vault) on RealYieldRouter.`);

  // 12. Deploy VestedDiscountVault
  const vaultArtifact = loadArtifact('VestedDiscountVault', 'VestedDiscountVault.sol');
  const vestedVaultTx = await walletClient.deployContract({
    abi: vaultArtifact.abi,
    bytecode: vaultArtifact.bytecode.object,
    args: [usdcAddr, nftAddr, treasuryAddr, account.address, ryRouterAddr, treasuryAddr, account.address]
  });
  const vestedVaultAddr = (await publicClient.waitForTransactionReceipt({ hash: vestedVaultTx })).contractAddress!;
  console.log(`[+] VestedDiscountVault Contract deployed at: ${vestedVaultAddr}`);

  // Set minter on VaultPositionNFT
  const setMinterHash = await walletClient.writeContract({
    address: nftAddr,
    abi: nftArtifact.abi,
    functionName: 'setMinter',
    args: [vestedVaultAddr]
  });
  await publicClient.waitForTransactionReceipt({ hash: setMinterHash });
  console.log('[+] Configured VestedDiscountVault as minter on VaultPositionNFT.');

  // Set GovernanceStaking on VestedDiscountVault for tier discount bonuses
  const setGovStakingHash = await walletClient.writeContract({
    address: vestedVaultAddr,
    abi: vaultArtifact.abi,
    functionName: 'setGovernanceStaking',
    args: [stakingAddr]
  });
  await publicClient.waitForTransactionReceipt({ hash: setGovStakingHash });
  console.log('[+] Configured GovernanceStaking on VestedDiscountVault.');

  // Configure VestedDiscountVault parameters for 5%/10%/15%/20%/25% discount scale
  const setParamsHash = await walletClient.writeContract({
    address: vestedVaultAddr,
    abi: vaultArtifact.abi,
    functionName: 'setVaultParameters',
    args: [500n, 2000n, 0n, 100n] // 500 BPS base yield (5%/yr), 0 BPS subsidy
  });
  await publicClient.waitForTransactionReceipt({ hash: setParamsHash });
  console.log('[+] Configured VestedDiscountVault discount scale (5%/10%/15%/20%/25%).');

  // 13. Deploy P2PLendingMarket
  const p2pArtifact = loadArtifact('P2PLendingMarket', 'P2PLendingMarket.sol');
  const p2pTx = await walletClient.deployContract({
    abi: p2pArtifact.abi,
    bytecode: p2pArtifact.bytecode.object,
    args: [usdcAddr, nftAddr, ryRouterAddr, feedAddr, account.address]
  });
  const p2pAddr = (await publicClient.waitForTransactionReceipt({ hash: p2pTx })).contractAddress!;
  console.log(`[+] P2PLendingMarket Contract deployed at: ${p2pAddr}`);

  // Configure Treasury address on P2PLendingMarket for reserve repayments
  const setP2pTreasuryHash = await walletClient.writeContract({
    address: p2pAddr,
    abi: p2pArtifact.abi,
    functionName: 'setTreasury',
    args: [treasuryAddr]
  });
  await publicClient.waitForTransactionReceipt({ hash: setP2pTreasuryHash });
  console.log('[+] Linked Treasury address into P2PLendingMarket for reserve repayments.');

  // Configure tracked asset
  const setTrackedHash = await walletClient.writeContract({
    address: treasuryAddr,
    abi: Treasury.abi,
    functionName: 'setTrackedAsset',
    args: [usdcAddr, feedAddr, 18]
  });
  await publicClient.waitForTransactionReceipt({ hash: setTrackedHash });
  console.log('[+] Configured USDC as tracked asset in Treasury.');

  // Configure protocol modules for Proof of Reserves
  const setModulesHash = await walletClient.writeContract({
    address: treasuryAddr,
    abi: Treasury.abi,
    functionName: 'setProtocolModules',
    args: [vestedVaultAddr, p2pAddr, ryRouterAddr, stakingAddr, '0x1111111111111111111111111111111111111111', '0x2222222222222222222222222222222222222222']
  });
  await publicClient.waitForTransactionReceipt({ hash: setModulesHash });
  console.log('[+] Configured protocol modules in Treasury for Proof of Reserves.');

  // Wire Treasury address into GovernanceStaking for NAV-based staked value computation
  const stakingAbi = loadArtifact('GovernanceStaking', 'GovernanceStaking.sol').abi;
  const setTreasuryHash = await walletClient.writeContract({
    address: stakingAddr,
    abi: stakingAbi,
    functionName: 'setTreasury',
    args: [treasuryAddr]
  });
  await publicClient.waitForTransactionReceipt({ hash: setTreasuryHash });
  console.log('[+] Linked Treasury address into GovernanceStaking for PoR staked value.');

  // 14. Deploy MorphoYieldVaultAdapter
  const morphoArtifact = loadArtifact('MorphoYieldVaultAdapter', 'MorphoYieldVaultAdapter.sol');
  const morphoTx = await walletClient.deployContract({
    abi: morphoArtifact.abi,
    bytecode: morphoArtifact.bytecode.object,
    args: [usdcAddr, treasuryAddr, account.address]
  });
  const morphoAddr = (await publicClient.waitForTransactionReceipt({ hash: morphoTx })).contractAddress!;
  console.log(`[+] MorphoYieldVaultAdapter Contract deployed at: ${morphoAddr}`);

  // Link MorphoYieldVaultAdapter into Treasury for 80/20 USDC sub-reserve routing
  const setMorphoHash = await walletClient.writeContract({
    address: treasuryAddr,
    abi: Treasury.abi,
    functionName: 'setMorphoAdapter',
    args: [morphoAddr]
  });
  await publicClient.waitForTransactionReceipt({ hash: setMorphoHash });
  console.log('[+] Linked MorphoYieldVaultAdapter into Treasury for 80/20 USDC sub-reserve auto-routing.');

  // 15. Deploy PromotionalIncentiveVault (10% ALPHA Pool)
  const promoArtifact = loadArtifact('PromotionalIncentiveVault', 'PromotionalIncentiveVault.sol');
  const promoTx = await walletClient.deployContract({
    abi: promoArtifact.abi,
    bytecode: promoArtifact.bytecode.object,
    args: [usdcAddr, account.address]
  });
  const promoAddr = (await publicClient.waitForTransactionReceipt({ hash: promoTx })).contractAddress!;
  console.log(`[+] PromotionalIncentiveVault Contract deployed at: ${promoAddr}`);

  // 16. Deploy DynamicYieldOracleRouter (Autonomous APY Engine)
  const oracleArtifact = loadArtifact('DynamicYieldOracleRouter', 'DynamicYieldOracleRouter.sol');
  const oracleTx = await walletClient.deployContract({
    abi: oracleArtifact.abi,
    bytecode: oracleArtifact.bytecode.object,
    args: [account.address]
  });
  const oracleAddr = (await publicClient.waitForTransactionReceipt({ hash: oracleTx })).contractAddress!;
  console.log(`[+] DynamicYieldOracleRouter Contract deployed at: ${oracleAddr}`);

  // 17. Deploy TreasuryReserveManager (Production Execution Manager)
  const mgrArtifact = loadArtifact('TreasuryReserveManager', 'TreasuryReserveManager.sol');
  const mgrTx = await walletClient.deployContract({
    abi: mgrArtifact.abi,
    bytecode: mgrArtifact.bytecode.object,
    args: [treasuryAddr, usdcAddr, usdcAddr, usdcAddr, account.address]
  });
  const mgrAddr = (await publicClient.waitForTransactionReceipt({ hash: mgrTx })).contractAddress!;
  console.log(`[+] TreasuryReserveManager Contract deployed at: ${mgrAddr}`);

  // Link DynamicYieldOracleRouter into TreasuryReserveManager
  const setOracleHash = await walletClient.writeContract({
    address: mgrAddr,
    abi: mgrArtifact.abi,
    functionName: 'setOracleRouter',
    args: [oracleAddr]
  });
  await publicClient.waitForTransactionReceipt({ hash: setOracleHash });
  console.log('[+] Linked DynamicYieldOracleRouter into TreasuryReserveManager.');

  // 12. Pre-fund Admin and User accounts with 10,000 USDC mock
  console.log('[+] Pre-funding Admin and User accounts with 10,000 USDC mock...');
  const userAccountAddr = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const mintAbi = [{ inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'mint', outputs: [], stateMutability: 'nonpayable', type: 'function' }] as const;

  const m1 = await walletClient.writeContract({
    address: usdcAddr as `0x${string}`,
    abi: mintAbi,
    functionName: 'mint',
    args: [account.address, parseEther('10000')]
  });
  await publicClient.waitForTransactionReceipt({ hash: m1 });

  const m2 = await walletClient.writeContract({
    address: usdcAddr as `0x${string}`,
    abi: mintAbi,
    functionName: 'mint',
    args: [userAccountAddr as `0x${string}`, parseEther('10000')]
  });
  await publicClient.waitForTransactionReceipt({ hash: m2 });
  console.log('[+] Admin and User wallets pre-funded successfully.');

  // Write addresses to root .env file & frontend contracts.json
  const envPath = path.resolve(__dirname, '../../../.env');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Helper to replace or append env vars
  function updateEnvVar(key: string, value: string) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }

  // Update variables with VITE_ prefix for React compatibility
  updateEnvVar('VITE_USDC_ADDRESS', usdcAddr);
  updateEnvVar('VITE_USDT_ADDRESS', usdtAddr);
  updateEnvVar('VITE_TREASURY_ADDRESS', treasuryAddr);
  updateEnvVar('VITE_CORPORATE_CONTRIBUTION_ADDRESS', corpAddr);
  updateEnvVar('VITE_ATOMIC_SWAP_ADDRESS', swapAddr);
  updateEnvVar('VITE_YIELD_VAULT_ADDRESS', yieldAddr);
  updateEnvVar('VITE_CIRCUIT_BREAKER_ADDRESS', cbAddr);
  updateEnvVar('VITE_POSITION_NFT_ADDRESS', nftAddr);
  updateEnvVar('VITE_VESTED_VAULT_ADDRESS', vestedVaultAddr);
  updateEnvVar('VITE_P2P_MARKET_ADDRESS', p2pAddr);
  updateEnvVar('VITE_STAKING_ADDRESS', stakingAddr);
  updateEnvVar('VITE_CORPORATE_OPEX_VAULT_ADDRESS', corpOpExAddr);
  updateEnvVar('VITE_CORPORATE_PROFIT_VAULT_ADDRESS', corpProfitAddr);

  fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');

  // Also write JSON artifact for frontend dynamic import
  const jsonPath = path.resolve(__dirname, '../../../frontend/src/contracts.json');
  const addressesJson = {
    USDC: usdcAddr,
    USDT: usdtAddr,
    TREASURY: treasuryAddr,
    CORPORATE_CONTRIBUTION: corpAddr,
    ATOMIC_SWAP: swapAddr,
    YIELD_VAULT: yieldAddr,
    CIRCUIT_BREAKER: cbAddr,
    POSITION_NFT: nftAddr,
    VESTED_VAULT: vestedVaultAddr,
    P2P_MARKET: p2pAddr,
    STAKING: stakingAddr,
    REAL_YIELD_ROUTER: ryRouterAddr,
    CORPORATE_OPEX_VAULT: corpOpExAddr,
    CORPORATE_PROFIT_VAULT: corpProfitAddr,
    MORPHO_ADAPTER: morphoAddr,
    PROMO_VAULT: promoAddr,
    RESERVE_MANAGER: mgrAddr,
    ORACLE_ROUTER: oracleAddr
  };
  fs.writeFileSync(jsonPath, JSON.stringify(addressesJson, null, 2), 'utf8');

  console.log('[+] Deployed contract addresses written to root .env file and frontend/src/contracts.json.');
  process.exit(0);
}

function address(val: number): `0x${string}` {
  return `0x${val.toString(16).padStart(40, '0')}`;
}

main().catch((error) => {
  console.error('[!] Deployment failed:', error);
  process.exit(1);
});
