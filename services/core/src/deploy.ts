import { createPublicClient, createWalletClient, http, parseEther, keccak256, toHex } from 'viem';
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

const localChain = {
  id: 31337,
  name: 'Localhost',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [ANVIL_URL] } }
};

const publicClient = createPublicClient({
  chain: localChain,
  transport: http(ANVIL_URL)
});

const walletClient = createWalletClient({
  account,
  chain: localChain,
  transport: http(ANVIL_URL)
});

function loadArtifact(name: string, file: string) {
  const p1 = path.resolve(__dirname, `../../../contracts/out/${file}/${name}.json`);
  const p2 = path.resolve(__dirname, `../../../contracts/out/src/${file}/${name}.json`);
  const p3 = path.resolve(__dirname, `../../../contracts/out/test/${file}/${name}.json`);
  const p4 = path.resolve(__dirname, `../../../contracts/out/adapters/${file}/${name}.json`);
  const p5 = path.resolve(__dirname, `../../../contracts/out/${name}.sol/${name}.json`);
  const p = fs.existsSync(p1) ? p1 : fs.existsSync(p2) ? p2 : fs.existsSync(p3) ? p3 : fs.existsSync(p4) ? p4 : fs.existsSync(p5) ? p5 : p1;
  if (!fs.existsSync(p)) {
    throw new Error(`Artifact not found for ${name} in ${file}. Run forge compile first.`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function main() {
  console.log('[*] Starting full deployment of Sandbox Smart Contracts onto Anvil...');

  const MockERC20 = loadArtifact('MockERC20', 'ModularProtocol.t.sol');
  const MockChainlinkFeed = loadArtifact('MockChainlinkFeed', 'ModularProtocol.t.sol');

  const CircuitBreaker = loadArtifact('CircuitBreaker', 'CircuitBreaker.sol');
  const AtomicSwapReceiver = loadArtifact('AtomicSwapReceiver', 'AtomicSwapReceiver.sol');
  const YieldStreamingVault = loadArtifact('YieldStreamingVault', 'YieldStreamingVault.sol');
  const CorporateContribution = loadArtifact('CorporateContribution', 'CorporateContribution.sol');

  // 1. Deploy Mock USDC and Mock USDT with CORRECT decimals (6)
  const usdcTx = await walletClient.deployContract({
    abi: MockERC20.abi,
    bytecode: MockERC20.bytecode.object,
    args: ['USD Coin', 'USDC', 6]
  });
  const usdcAddr = (await publicClient.waitForTransactionReceipt({ hash: usdcTx })).contractAddress!;
  console.log(`[+] Mock USDC deployed at: ${usdcAddr}`);

  const usdtTx = await walletClient.deployContract({
    abi: MockERC20.abi,
    bytecode: MockERC20.bytecode.object,
    args: ['Tether USD', 'USDT', 6]
  });
  const usdtAddr = (await publicClient.waitForTransactionReceipt({ hash: usdtTx })).contractAddress!;
  console.log(`[+] Mock USDT deployed at: ${usdtAddr}`);

  // WBTC: 8 decimals (real-world standard)
  const wbtcTx = await walletClient.deployContract({
    abi: MockERC20.abi,
    bytecode: MockERC20.bytecode.object,
    args: ['Wrapped BTC', 'WBTC', 8]
  });
  const wbtcAddr = (await publicClient.waitForTransactionReceipt({ hash: wbtcTx })).contractAddress!;
  console.log(`[+] Mock WBTC deployed at: ${wbtcAddr}`);

  // WETH: 18 decimals (real-world standard)
  const wethTx = await walletClient.deployContract({
    abi: MockERC20.abi,
    bytecode: MockERC20.bytecode.object,
    args: ['Wrapped Ether', 'WETH', 18]
  });
  const wethAddr = (await publicClient.waitForTransactionReceipt({ hash: wethTx })).contractAddress!;
  console.log(`[+] Mock WETH deployed at: ${wethAddr}`);

  // 2. Deploy Mock Price Feeds with REALISTIC sandbox prices
  const feedTx = await walletClient.deployContract({
    abi: MockChainlinkFeed.abi,
    bytecode: MockChainlinkFeed.bytecode.object,
    args: [100000000n, 8]  // USDC = $1.00
  });
  const feedAddr = (await publicClient.waitForTransactionReceipt({ hash: feedTx })).contractAddress!;
  console.log(`[+] Mock USDC Price Feed deployed at: ${feedAddr}`);

  const wbtcFeedTx = await walletClient.deployContract({
    abi: MockChainlinkFeed.abi,
    bytecode: MockChainlinkFeed.bytecode.object,
    args: [6000000000000n, 8]  // WBTC = $60,000.00
  });
  const wbtcFeedAddr = (await publicClient.waitForTransactionReceipt({ hash: wbtcFeedTx })).contractAddress!;
  console.log(`[+] Mock WBTC Price Feed deployed at: ${wbtcFeedAddr}`);

  const wethFeedTx = await walletClient.deployContract({
    abi: MockChainlinkFeed.abi,
    bytecode: MockChainlinkFeed.bytecode.object,
    args: [300000000000n, 8]  // WETH = $3,000.00
  });
  const wethFeedAddr = (await publicClient.waitForTransactionReceipt({ hash: wethFeedTx })).contractAddress!;
  console.log(`[+] Mock WETH Price Feed deployed at: ${wethFeedAddr}`);

  // 3. Deploy Mock Swap Router (REMOVED - Not used in modular architecture currently)
  const routerAddr = '0x0000000000000000000000000000000000000000'; // Dummy for routerAddr references
  // 4. Deploy Modular DeFi Core Architecture
  const ProtocolAddressProvider = loadArtifact('ProtocolAddressProvider', 'ProtocolAddressProvider.sol');
  const AlphaToken = loadArtifact('AlphaToken', 'AlphaToken.sol');
  const AlphaVault = loadArtifact('AlphaVault', 'AlphaVault.sol');
  const OracleHub = loadArtifact('OracleHub', 'OracleHub.sol');
  const TreasuryManager = loadArtifact('TreasuryManager', 'TreasuryManager.sol');

  const apTx = await walletClient.deployContract({ abi: ProtocolAddressProvider.abi, bytecode: ProtocolAddressProvider.bytecode.object, args: [account.address] });
  const apAddr = (await publicClient.waitForTransactionReceipt({ hash: apTx })).contractAddress!;
  console.log(`[+] ProtocolAddressProvider deployed at: ${apAddr}`);

  const tokenTx = await walletClient.deployContract({ abi: AlphaToken.abi, bytecode: AlphaToken.bytecode.object, args: [apAddr, account.address] });
  const alphaTokenAddr = (await publicClient.waitForTransactionReceipt({ hash: tokenTx })).contractAddress!;
  console.log(`[+] AlphaToken deployed at: ${alphaTokenAddr}`);

  const vaultTx = await walletClient.deployContract({ abi: AlphaVault.abi, bytecode: AlphaVault.bytecode.object, args: [apAddr, account.address] });
  const vaultAddr = (await publicClient.waitForTransactionReceipt({ hash: vaultTx })).contractAddress!;
  console.log(`[+] AlphaVault deployed at: ${vaultAddr}`);

  const oracleTx = await walletClient.deployContract({ abi: OracleHub.abi, bytecode: OracleHub.bytecode.object, args: [apAddr, account.address] });
  const oracleAddr = (await publicClient.waitForTransactionReceipt({ hash: oracleTx })).contractAddress!;
  console.log(`[+] OracleHub deployed at: ${oracleAddr}`);

  const tmTx = await walletClient.deployContract({ abi: TreasuryManager.abi, bytecode: TreasuryManager.bytecode.object, args: [apAddr, account.address, usdcAddr, 6] });
  const treasuryAddr = (await publicClient.waitForTransactionReceipt({ hash: tmTx })).contractAddress!;
  console.log(`[+] TreasuryManager deployed at: ${treasuryAddr}`);

  // Link core modules in AddressProvider
  const idToken = keccak256(toHex('ALPHA_TOKEN'));
  const idVault = keccak256(toHex('ALPHA_VAULT'));
  const idOracle = keccak256(toHex('ORACLE_HUB'));
  const idTm = keccak256(toHex('TREASURY_MANAGER'));

  const h1 = await walletClient.writeContract({ address: apAddr, abi: ProtocolAddressProvider.abi, functionName: 'setAddress', args: [idToken, alphaTokenAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: h1 });
  const h2 = await walletClient.writeContract({ address: apAddr, abi: ProtocolAddressProvider.abi, functionName: 'setAddress', args: [idVault, vaultAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: h2 });
  const h3 = await walletClient.writeContract({ address: apAddr, abi: ProtocolAddressProvider.abi, functionName: 'setAddress', args: [idOracle, oracleAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: h3 });
  const h4 = await walletClient.writeContract({ address: apAddr, abi: ProtocolAddressProvider.abi, functionName: 'setAddress', args: [idTm, treasuryAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: h4 });
  console.log(`[+] Core Modules registered in ProtocolAddressProvider.`);

  const MINTER_ROLE = '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6';
  const BURNER_ROLE = '0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848';
  const VAULT_MANAGER_ROLE = '0xd1473398bb66596de5d1ea1fc8e303ff2ac23265adc9144b1b52065dc4f0934b';
  const ORACLE_MANAGER_ROLE = '0xced6982f480260bdd8ad5cb18ff2854f0306d78d904ad6cc107e8f3a0f526c18';
  
  const acAbi = [
    { name: 'grantRole', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'role', type: 'bytes32' }, { name: 'account', type: 'address' }], outputs: [] }
  ] as const;

  const hashMint = await walletClient.writeContract({ address: alphaTokenAddr, abi: acAbi, functionName: 'grantRole', args: [MINTER_ROLE, treasuryAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hashMint });

  const hashBurn = await walletClient.writeContract({ address: alphaTokenAddr, abi: acAbi, functionName: 'grantRole', args: [BURNER_ROLE, treasuryAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hashBurn });

  const hashVault = await walletClient.writeContract({ address: vaultAddr, abi: acAbi, functionName: 'grantRole', args: [VAULT_MANAGER_ROLE, treasuryAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hashVault });

  const hashOracle = await walletClient.writeContract({ address: oracleAddr, abi: acAbi, functionName: 'grantRole', args: [ORACLE_MANAGER_ROLE, account.address], account });
  await publicClient.waitForTransactionReceipt({ hash: hashOracle });

  console.log(`[+] Role assignments configured correctly.`);

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

  const hashSwapMint = await walletClient.writeContract({ address: alphaTokenAddr, abi: acAbi, functionName: 'grantRole', args: [MINTER_ROLE, swapAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hashSwapMint });

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
    args: [alphaTokenAddr, usdcAddr, account.address]
  });
  const stakingAddr = (await publicClient.waitForTransactionReceipt({ hash: stakingTx })).contractAddress!;
  console.log(`[+] GovernanceStaking Contract deployed at: ${stakingAddr}`);

  const idGovStaking = keccak256(toHex('GOVERNANCE_STAKING'));
  const hGovStaking = await walletClient.writeContract({ address: apAddr, abi: ProtocolAddressProvider.abi, functionName: 'setAddress', args: [idGovStaking, stakingAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hGovStaking });
  console.log(`[+] Registered GOVERNANCE_STAKING in ProtocolAddressProvider.`);

  const hashStakingBurn = await walletClient.writeContract({ address: alphaTokenAddr, abi: acAbi, functionName: 'grantRole', args: [BURNER_ROLE, stakingAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hashStakingBurn });
  console.log(`[+] Granted BURNER_ROLE to GovernanceStaking on AlphaToken.`);

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
    args: [treasuryAddr, corpOpExAddr, corpProfitAddr, alphaTokenAddr],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: setRyWalletsTx });
  console.log(`[+] Configured 50/25/25 Corporate Auto-Staking Vaults (50% Treasury, 25% OpEx ALPHA Vault, 25% Profit ALPHA Vault) on RealYieldRouter.`);

  const setGovCorpHash = await walletClient.writeContract({
    address: stakingAddr,
    abi: stakingArtifact.abi,
    functionName: 'setCorporateVaults',
    args: [corpOpExAddr, corpProfitAddr]
  });
  await publicClient.waitForTransactionReceipt({ hash: setGovCorpHash });

  // Configure GovernanceStaking address on Corporate OpEx and Profit Vaults for auto-staking
  const setStakingOpEx = await walletClient.writeContract({
    address: corpOpExAddr,
    abi: opExArtifact.abi,
    functionName: 'setStakingPool',
    args: [stakingAddr]
  });
  await publicClient.waitForTransactionReceipt({ hash: setStakingOpEx });

  const setStakingProfit = await walletClient.writeContract({
    address: corpProfitAddr,
    abi: profitArtifact.abi,
    functionName: 'setStakingPool',
    args: [stakingAddr]
  });
  await publicClient.waitForTransactionReceipt({ hash: setStakingProfit });

  console.log('[+] Configured 50/25/25 Corporate Auto-Staking Vaults on GovernanceStaking.');

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

  // Configure tracked assets
  const setTrackedUsdcHash = await walletClient.writeContract({
    address: oracleAddr,
    abi: OracleHub.abi,
    functionName: 'setTrackedAsset',
    args: [usdcAddr, feedAddr, 6]  // USDC = 6 decimals
  });
  await publicClient.waitForTransactionReceipt({ hash: setTrackedUsdcHash });

  const setTrackedWbtcHash = await walletClient.writeContract({
    address: oracleAddr,
    abi: OracleHub.abi,
    functionName: 'setTrackedAsset',
    args: [wbtcAddr, wbtcFeedAddr, 8]  // WBTC = 8 decimals
  });
  await publicClient.waitForTransactionReceipt({ hash: setTrackedWbtcHash });

  const setTrackedWethHash = await walletClient.writeContract({
    address: oracleAddr,
    abi: OracleHub.abi,
    functionName: 'setTrackedAsset',
    args: [wethAddr, wethFeedAddr, 18]  // WETH = 18 decimals
  });
  await publicClient.waitForTransactionReceipt({ hash: setTrackedWethHash });
  // Set oracle staleness limit to 100 years for sandbox time-travel testing
  const setStalenessHash = await walletClient.writeContract({
    address: oracleAddr,
    abi: OracleHub.abi,
    functionName: 'setOracleStalenessLimit',
    args: [3153600000n]
  });
  await publicClient.waitForTransactionReceipt({ hash: setStalenessHash });
  console.log('[+] Configured USDC, WBTC, and WETH as tracked reserve assets in OracleHub.');

  const tmConfigAbi = [
    { name: 'setConfig', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_wbtc', type: 'address' }, { name: '_weth', type: 'address' }, { name: '_swapRouter', type: 'address' }, { name: '_opsWallet', type: 'address' }, { name: '_corpWallet', type: 'address' }], outputs: [] }
  ] as const;

  const setTmConfigHash = await walletClient.writeContract({
    address: treasuryAddr,
    abi: tmConfigAbi,
    functionName: 'setConfig',
    args: [wbtcAddr, wethAddr, routerAddr, account.address, account.address]
  });
  await publicClient.waitForTransactionReceipt({ hash: setTmConfigHash });
  console.log('[+] Configured setConfig on TreasuryManager with SwapRouter, WBTC, WETH, and Corporate Wallets.');

  // Configure protocol modules for Proof of Reserves
  // Handled dynamically via AddressProvider now.
  /*
  const setModulesHash = await walletClient.writeContract({
    address: treasuryAddr,
    abi: Treasury.abi,
    functionName: 'setProtocolModules',
    args: [vestedVaultAddr, p2pAddr, ryRouterAddr, stakingAddr, '0x1111111111111111111111111111111111111111', '0x2222222222222222222222222222222222222222']
  });
  await publicClient.waitForTransactionReceipt({ hash: setModulesHash });
  console.log('[+] Configured protocol modules in Treasury for Proof of Reserves.');

  // Configure SwapRouter and token pairs on Treasury for open market reserve swaps
  const setSwapHash = await walletClient.writeContract({
    address: treasuryAddr,
    abi: Treasury.abi,
    functionName: 'setSwapRouter',
    args: [routerAddr, wbtcAddr, wethAddr]
  });
  await publicClient.waitForTransactionReceipt({ hash: setSwapHash });
  console.log('[+] Configured SwapRouter on Treasury for open market WBTC, WETH, and ALPHA reserve buy pressure.');
  */

  // Pre-fund MockSwapRouter with ALPHA, WBTC, and WETH liquidity so DEX swaps succeed on-chain
  // (REMOVED - Router is disabled in sandbox currently)
  /*
  const erc20Abi = [
    { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
    { name: 'mint', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] }
  ] as const;

  const mintWbtcRouter = await walletClient.writeContract({
    address: wbtcAddr,
    abi: erc20Abi,
    functionName: 'mint',
    args: [routerAddr, 100n * 10n**18n]
  });
  await publicClient.waitForTransactionReceipt({ hash: mintWbtcRouter });

  const mintWethRouter = await walletClient.writeContract({
    address: wethAddr,
    abi: erc20Abi,
    functionName: 'mint',
    args: [routerAddr, 1000n * 10n**18n]
  });
  await publicClient.waitForTransactionReceipt({ hash: mintWethRouter });
  */
  console.log('[+] Protocol initialized 100% clean at State 0 ($0.00 USD Reserves, 0 ALPHA Supply).');

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
  // Handled dynamically via AddressProvider now.
  /*
  const setMorphoHash = await walletClient.writeContract({
    address: treasuryAddr,
    abi: Treasury.abi,
    functionName: 'setMorphoAdapter',
    args: [morphoAddr]
  });
  await publicClient.waitForTransactionReceipt({ hash: setMorphoHash });
  console.log('[+] Linked MorphoYieldVaultAdapter into Treasury for 80/20 USDC sub-reserve auto-routing.');
  */

  // 15. Deploy PromotionalIncentiveVault (10% ALPHA Pool)
  const promoArtifact = loadArtifact('PromotionalIncentiveVault', 'PromotionalIncentiveVault.sol');
  const promoTx = await walletClient.deployContract({
    abi: promoArtifact.abi,
    bytecode: promoArtifact.bytecode.object,
    args: [treasuryAddr, account.address]
  });
  const promoAddr = (await publicClient.waitForTransactionReceipt({ hash: promoTx })).contractAddress!;
  console.log(`[+] PromotionalIncentiveVault Contract deployed at: ${promoAddr}`);

  // 16. Deploy DynamicYieldOracleRouter (Autonomous APY Engine)
  const oracleArtifact = loadArtifact('DynamicYieldOracleRouter', 'DynamicYieldOracleRouter.sol');
  const yieldOracleTx = await walletClient.deployContract({
    abi: oracleArtifact.abi,
    bytecode: oracleArtifact.bytecode.object,
    args: [account.address]
  });
  const yieldOracleAddr = (await publicClient.waitForTransactionReceipt({ hash: yieldOracleTx })).contractAddress!;
  console.log(`[+] DynamicYieldOracleRouter Contract deployed at: ${yieldOracleAddr}`);

  // 17. Deploy TreasuryReserveManager (Production Execution Manager)
  const mgrArtifact = loadArtifact('TreasuryReserveManager', 'TreasuryReserveManager.sol');
  const mgrTx = await walletClient.deployContract({
    abi: mgrArtifact.abi,
    bytecode: mgrArtifact.bytecode.object,
    args: [treasuryAddr, usdcAddr, usdcAddr, usdcAddr, account.address]
  });
  const mgrAddr = (await publicClient.waitForTransactionReceipt({ hash: mgrTx })).contractAddress!;
  console.log(`[+] TreasuryReserveManager Contract deployed at: ${mgrAddr}`);

  // 18. Deploy ProtocolTokenomicsEngine (Master Math Engine)
  const engineArtifact = loadArtifact('ProtocolTokenomicsEngine', 'ProtocolTokenomicsEngine.sol');
  const engineTx = await walletClient.deployContract({
    abi: engineArtifact.abi,
    bytecode: engineArtifact.bytecode.object,
    args: [account.address]
  });
  const engineAddr = (await publicClient.waitForTransactionReceipt({ hash: engineTx })).contractAddress!;
  console.log(`[+] ProtocolTokenomicsEngine Contract deployed at: ${engineAddr}`);

  // Link ProtocolTokenomicsEngine into Treasury, VestedDiscountVault, and P2PLendingMarket
  const idEngine = keccak256(toHex('TOKENOMICS_ENGINE'));
  const idRouter = keccak256(toHex('REAL_YIELD_ROUTER'));
  const idStaking = keccak256(toHex('GOVERNANCE_STAKING'));
  const idVested = keccak256(toHex('VESTED_VAULT'));
  const idP2p = keccak256(toHex('P2P_MARKET'));

  const hR = await walletClient.writeContract({ address: apAddr, abi: ProtocolAddressProvider.abi, functionName: 'setAddress', args: [idRouter, ryRouterAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hR });
  const hS = await walletClient.writeContract({ address: apAddr, abi: ProtocolAddressProvider.abi, functionName: 'setAddress', args: [idStaking, stakingAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hS });
  const hV = await walletClient.writeContract({ address: apAddr, abi: ProtocolAddressProvider.abi, functionName: 'setAddress', args: [idVested, vestedVaultAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hV });
  const hP = await walletClient.writeContract({ address: apAddr, abi: ProtocolAddressProvider.abi, functionName: 'setAddress', args: [idP2p, p2pAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hP });

  const setTreasuryEngineHash = await walletClient.writeContract({
    address: apAddr,
    abi: ProtocolAddressProvider.abi,
    functionName: 'setAddress',
    args: [idEngine, engineAddr],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: setTreasuryEngineHash });

  const setVaultEngineHash = await walletClient.writeContract({
    address: vestedVaultAddr,
    abi: vaultArtifact.abi,
    functionName: 'setTokenomicsEngine',
    args: [engineAddr]
  });
  await publicClient.waitForTransactionReceipt({ hash: setVaultEngineHash });

  const setP2pEngineHash = await walletClient.writeContract({
    address: p2pAddr,
    abi: p2pArtifact.abi,
    functionName: 'setTokenomicsEngine',
    args: [engineAddr]
  });
  await publicClient.waitForTransactionReceipt({ hash: setP2pEngineHash });
  console.log('[+] Linked ProtocolTokenomicsEngine into Treasury, VestedDiscountVault, and P2PLendingMarket.');

  // 12. Pre-fund Admin and User accounts with 10,000 USDC mock
  console.log('[+] Pre-funding Admin and User accounts with 10,000 USDC mock...');
  const userAccountAddr = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const mintAbi = [{ inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'mint', outputs: [], stateMutability: 'nonpayable', type: 'function' }] as const;

  const m1 = await walletClient.writeContract({
    address: usdcAddr as `0x${string}`,
    abi: mintAbi,
    functionName: 'mint',
    args: [account.address, 110000n * 10n**6n]  // 110k: 100k initial deposit + 10k for testing
  });
  await publicClient.waitForTransactionReceipt({ hash: m1 });

  const m2 = await walletClient.writeContract({
    address: usdcAddr as `0x${string}`,
    abi: mintAbi,
    functionName: 'mint',
    args: [userAccountAddr as `0x${string}`, 10000n * 10n**6n]
  });
  await publicClient.waitForTransactionReceipt({ hash: m2 });
  console.log('[+] Admin and User wallets pre-funded successfully.');

  // ─── FONDEO INICIAL DEL PROTOCOLO ───────────────────────────────────────────
  // El Admin realiza un depósito inicial de 100,000 USDC como primer fondeo.
  // Esto genera la primera emisión de ALPHA, bootstrappea las reservas de la
  // Tesorería y activa el flywheel: fee → notifyReserveFee → swap USDC→ALPHA
  // → stake en GovernanceStaking (Stake Reservas).
  const depositAbi = [
    { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
    { name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'stableAmount', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] }
  ] as const;

  const initialDeposit = 100000n * 10n**6n; // 100,000 USDC

  const approveInitial = await walletClient.writeContract({
    address: usdcAddr as `0x${string}`,
    abi: depositAbi,
    functionName: 'approve',
    args: [treasuryAddr as `0x${string}`, initialDeposit]
  });
  await publicClient.waitForTransactionReceipt({ hash: approveInitial });

  const depositInitial = await walletClient.writeContract({
    address: treasuryAddr as `0x${string}`,
    abi: depositAbi,
    functionName: 'deposit',
    args: [initialDeposit]
  });
  await publicClient.waitForTransactionReceipt({ hash: depositInitial });
  console.log('[+] Protocolo fondeado con 100,000 USDC iniciales. Reservas activas y Stake Reservas iniciado.');
  // ─────────────────────────────────────────────────────────────────────────────

  // Write addresses to root .env file & frontend contracts.json
  const envPath = path.resolve(process.cwd(), '.env');
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
  
  // Inject Anvil Private Keys for Frontend E2E & Development
  updateEnvVar('VITE_ADMIN_KEY', '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
  updateEnvVar('VITE_USER_KEY', '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');

  fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');

  // Also write JSON artifact for frontend dynamic import
  const jsonPath = path.resolve(process.cwd(), 'frontend/src/contracts.json');
  const addressesJson = {
    USDC: usdcAddr,
    USDT: usdtAddr,
    WBTC: wbtcAddr,
    WETH: wethAddr,
    TREASURY: treasuryAddr, // Legacy name for TREASURY_MANAGER
    TREASURY_MANAGER: treasuryAddr,
    PROTOCOL_ADDRESS_PROVIDER: apAddr,
    ALPHA_TOKEN: alphaTokenAddr,
    ALPHA_VAULT: vaultAddr,
    ORACLE_HUB: oracleAddr,
    CORPORATE_CONTRIBUTION: corpAddr,
    ATOMIC_SWAP: swapAddr,
    YIELD_VAULT: yieldAddr,
    CIRCUIT_BREAKER: cbAddr,
    POSITION_NFT: nftAddr,
    VESTED_VAULT: vestedVaultAddr,
    P2P_MARKET: p2pAddr,
    STAKING: stakingAddr,
    REAL_YIELD_ROUTER: ryRouterAddr,
    TOKENOMICS_ENGINE: engineAddr,
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
