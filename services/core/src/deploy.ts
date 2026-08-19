import { createPublicClient, createWalletClient, http, parseEther, keccak256, toHex, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrum } from 'viem/chains';
import fs from 'fs';
import path from 'path';

const ANVIL_URL = process.env.ANVIL_URL || 'http://localhost:8545';

// Development fallback uses standard Anvil Account #0 key if environment variable is not passed
const OPERATOR_KEY = (process.env.BACKEND_OPERATOR_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80').trim();
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
  const p1 = path.resolve(__dirname, `../../../contracts/out/src/${file}/${name}.json`);
  const p2 = path.resolve(__dirname, `../../../contracts/out/${file}/${name}.json`);
  const p3 = path.resolve(__dirname, `../../../contracts/out/test/${file}/${name}.json`);
  const p4 = path.resolve(__dirname, `../../../contracts/out/adapters/${file}/${name}.json`);
  const p5 = path.resolve(__dirname, `../../../contracts/out/${name}.sol/${name}.json`);
  const p = fs.existsSync(p1) ? p1 : fs.existsSync(p2) ? p2 : fs.existsSync(p3) ? p3 : fs.existsSync(p4) ? p4 : fs.existsSync(p5) ? p5 : p1;
  if (!fs.existsSync(p)) {
    throw new Error(`Artifact not found for ${name} in ${file}. Run forge compile first.`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function loadArtifactSafe(name: string, file: string) {
  try {
    return loadArtifact(name, file);
  } catch (e) {
    return null;
  }
}

async function main() {
  const deployEnv = process.env.DEPLOY_ENV || 'sandbox';
  const isProduction = deployEnv === 'production' || process.env.NODE_ENV === 'production';
  if (isProduction) {
    console.error('CRITICAL: deploy.ts is dedicated to sandbox and local simulation fixtures. For production, deploy via deterministic scripts using verified external tokens, Chainlink feeds, and multisig timelock.');
    throw new Error('Production deployment guard: Mock deployments blocked in production mode.');
  }

  console.log('[*] Starting full deployment of Sandbox Smart Contracts onto Anvil...');

  const TreasuryProxy = loadArtifact('TreasuryProxy', 'TreasuryProxy.sol');
  const MockERC20 = loadArtifact('MockERC20', 'ModularProtocol.t.sol');
  const MockChainlinkFeed = loadArtifact('MockChainlinkFeed', 'ModularProtocol.t.sol');

  const CircuitBreaker = loadArtifact('CircuitBreaker', 'CircuitBreaker.sol');
  const AtomicSwapReceiver = loadArtifact('AtomicSwapReceiver', 'AtomicSwapReceiver.sol');
  const YieldStreamingVault = loadArtifact('YieldStreamingVault', 'YieldStreamingVault.sol');

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

  // 3. Deploy ProtocolAddressProvider & ProtocolRoles
  const apArtifact = loadArtifact('ProtocolAddressProvider', 'ProtocolAddressProvider.sol');
  const apTx = await walletClient.deployContract({
    abi: apArtifact.abi,
    bytecode: apArtifact.bytecode.object,
    args: [account.address]
  });
  const apAddr = (await publicClient.waitForTransactionReceipt({ hash: apTx })).contractAddress!;
  console.log(`[+] ProtocolAddressProvider Contract deployed at: ${apAddr}`);

  // 4. Deploy OracleHub
  const oracleArtifact = loadArtifact('OracleHub', 'OracleHub.sol');
  const oracleTx = await walletClient.deployContract({
    abi: oracleArtifact.abi,
    bytecode: oracleArtifact.bytecode.object,
    args: [apAddr, account.address]
  });
  const oracleAddr = (await publicClient.waitForTransactionReceipt({ hash: oracleTx })).contractAddress!;
  console.log(`[+] OracleHub Contract deployed at: ${oracleAddr}`);

  // Register Feeds in OracleHub
  const zeroAddr = '0x0000000000000000000000000000000000000000' as `0x${string}`;
  const setFeedTx = await walletClient.writeContract({
    address: oracleAddr,
    abi: oracleArtifact.abi,
    functionName: 'setTrackedAsset',
    args: [usdcAddr, feedAddr, zeroAddr, 6],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: setFeedTx });

  const setWbtcFeedTx = await walletClient.writeContract({
    address: oracleAddr,
    abi: oracleArtifact.abi,
    functionName: 'setTrackedAsset',
    args: [wbtcAddr, wbtcFeedAddr, zeroAddr, 8],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: setWbtcFeedTx });

  const setWethFeedTx = await walletClient.writeContract({
    address: oracleAddr,
    abi: oracleArtifact.abi,
    functionName: 'setTrackedAsset',
    args: [wethAddr, wethFeedAddr, zeroAddr, 18],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: setWethFeedTx });
  console.log(`[+] Registered USDC, WBTC, and WETH Feeds in OracleHub.`);

  // Register ORACLE_HUB in ProtocolAddressProvider
  const idOracle = keccak256(toHex('ORACLE_HUB'));
  const hOracle = await walletClient.writeContract({
    address: apAddr,
    abi: apArtifact.abi,
    functionName: 'setAddress',
    args: [idOracle, oracleAddr],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: hOracle });

  // 5. Deploy CircuitBreaker
  const cbTx = await walletClient.deployContract({
    abi: CircuitBreaker.abi,
    bytecode: CircuitBreaker.bytecode.object,
    args: [account.address]
  });
  const cbAddr = (await publicClient.waitForTransactionReceipt({ hash: cbTx })).contractAddress!;
  console.log(`[+] CircuitBreaker Contract deployed at: ${cbAddr}`);

  // Set feeds in CircuitBreaker
  await publicClient.waitForTransactionReceipt({
    hash: await walletClient.writeContract({
      address: cbAddr,
      abi: CircuitBreaker.abi,
      functionName: 'setPriceFeed',
      args: [usdcAddr, feedAddr],
      account
    })
  });
  await publicClient.waitForTransactionReceipt({
    hash: await walletClient.writeContract({
      address: cbAddr,
      abi: CircuitBreaker.abi,
      functionName: 'setPriceFeed',
      args: [wbtcAddr, wbtcFeedAddr],
      account
    })
  });
  await publicClient.waitForTransactionReceipt({
    hash: await walletClient.writeContract({
      address: cbAddr,
      abi: CircuitBreaker.abi,
      functionName: 'setPriceFeed',
      args: [wethAddr, wethFeedAddr],
      account
    })
  });

  const idCb = keccak256(toHex('CIRCUIT_BREAKER'));
  const hCb = await walletClient.writeContract({
    address: apAddr,
    abi: apArtifact.abi,
    functionName: 'setAddress',
    args: [idCb, cbAddr],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: hCb });

  // 6. Deploy AlphaToken
  const alphaArtifact = loadArtifact('AlphaToken', 'AlphaToken.sol');
  const alphaTx = await walletClient.deployContract({
    abi: alphaArtifact.abi,
    bytecode: alphaArtifact.bytecode.object,
    args: [apAddr, account.address]
  });
  const alphaTokenAddr = (await publicClient.waitForTransactionReceipt({ hash: alphaTx })).contractAddress!;
  console.log(`[+] AlphaToken Contract deployed at: ${alphaTokenAddr}`);

  const idAlpha = keccak256(toHex('ALPHA_TOKEN'));
  const hAlpha = await walletClient.writeContract({
    address: apAddr,
    abi: apArtifact.abi,
    functionName: 'setAddress',
    args: [idAlpha, alphaTokenAddr],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: hAlpha });

  // 7. Deploy AlphaVault
  const alphaVaultArtifact = loadArtifact('AlphaVault', 'AlphaVault.sol');
  const alphaVaultTx = await walletClient.deployContract({
    abi: alphaVaultArtifact.abi,
    bytecode: alphaVaultArtifact.bytecode.object,
    args: [apAddr, account.address]
  });
  const vaultAddr = (await publicClient.waitForTransactionReceipt({ hash: alphaVaultTx })).contractAddress!;
  console.log(`[+] AlphaVault Contract deployed at: ${vaultAddr}`);

  const idVault = keccak256(toHex('ALPHA_VAULT'));
  const hVault = await walletClient.writeContract({
    address: apAddr,
    abi: apArtifact.abi,
    functionName: 'setAddress',
    args: [idVault, vaultAddr],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: hVault });

  // Deploy TreasuryImplementation
  const tmImplArtifact = loadArtifact('TreasuryManager', 'TreasuryManager.sol');
  const tmImplTx = await walletClient.deployContract({
    abi: tmImplArtifact.abi,
    bytecode: tmImplArtifact.bytecode.object,
    args: [apAddr]
  });
  const tmImplAddr = (await publicClient.waitForTransactionReceipt({ hash: tmImplTx })).contractAddress!;
  console.log(`[+] TreasuryManager Implementation deployed at: ${tmImplAddr}`);

  // Deploy TreasuryProxy
  const proxyTx = await walletClient.deployContract({
    abi: TreasuryProxy.abi,
    bytecode: TreasuryProxy.bytecode.object,
    args: [tmImplAddr]
  });
  const treasuryAddr = (await publicClient.waitForTransactionReceipt({ hash: proxyTx })).contractAddress!;
  console.log(`[+] TreasuryManager Proxy deployed at: ${treasuryAddr}`);

  // Initialize TreasuryManager via Proxy
  const initTx = await walletClient.writeContract({
    address: treasuryAddr,
    abi: tmImplArtifact.abi,
    functionName: 'initialize',
    args: [account.address, usdcAddr, 6],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: initTx });

  const idTreasury = keccak256(toHex('TREASURY_MANAGER'));
  const hTreasury = await walletClient.writeContract({
    address: apAddr,
    abi: apArtifact.abi,
    functionName: 'setAddress',
    args: [idTreasury, treasuryAddr],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: hTreasury });

  // Grant VAULT_MANAGER_ROLE to TreasuryManager in AlphaVault
  const acAbi = [
    { name: 'grantRole', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'role', type: 'bytes32' }, { name: 'account', type: 'address' }], outputs: [] }
  ] as const;
  const VAULT_MANAGER_ROLE = keccak256(toHex('VAULT_MANAGER_ROLE'));
  const MINTER_ROLE = keccak256(toHex('MINTER_ROLE'));
  const BURNER_ROLE = keccak256(toHex('BURNER_ROLE'));
  const COMPLIANCE_ROLE = keccak256(toHex('COMPLIANCE_ROLE'));

  const setAuthVault = await walletClient.writeContract({
    address: vaultAddr,
    abi: acAbi,
    functionName: 'grantRole',
    args: [VAULT_MANAGER_ROLE, treasuryAddr],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: setAuthVault });

  // Grant MINTER_ROLE and BURNER_ROLE to TreasuryManager on AlphaToken
  const hashMint = await walletClient.writeContract({ address: alphaTokenAddr, abi: acAbi, functionName: 'grantRole', args: [MINTER_ROLE, treasuryAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hashMint });

  const hashBurn = await walletClient.writeContract({ address: alphaTokenAddr, abi: acAbi, functionName: 'grantRole', args: [BURNER_ROLE, treasuryAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hashBurn });

  // Grant COMPLIANCE_ROLE to deployer and KYC whitelist deployer account
  const hashCompliance = await walletClient.writeContract({ address: treasuryAddr, abi: acAbi, functionName: 'grantRole', args: [COMPLIANCE_ROLE, account.address], account });
  await publicClient.waitForTransactionReceipt({ hash: hashCompliance });

  const kycAbi = [
    { name: 'setKYCStatus', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'account', type: 'address' }, { name: 'status', type: 'bool' }], outputs: [] },
    { name: 'setConfig', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_wbtc', type: 'address' }, { name: '_weth', type: 'address' }, { name: '_swapRouter', type: 'address' }], outputs: [] }
  ] as const;

  const hashKyc = await walletClient.writeContract({ address: treasuryAddr, abi: kycAbi, functionName: 'setKYCStatus', args: [account.address, true], account });
  await publicClient.waitForTransactionReceipt({ hash: hashKyc });

  const defaultUser = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as `0x${string}`;
  const hashKycUser = await walletClient.writeContract({ address: treasuryAddr, abi: kycAbi, functionName: 'setKYCStatus', args: [defaultUser, true], account });
  await publicClient.waitForTransactionReceipt({ hash: hashKycUser });

  console.log(`[+] Granted MINTER_ROLE and BURNER_ROLE to TreasuryManager on AlphaToken.`);

  // Deploy Mock Uniswap V3 Router
  const mockRouter = loadArtifact('MockSwapRouter', 'MockSwapRouter.sol');
  const routerTx = await walletClient.deployContract({
    abi: mockRouter.abi,
    bytecode: mockRouter.bytecode.object,
    args: [usdcAddr, wbtcAddr, wethAddr, account.address]
  });
  const routerAddr = (await publicClient.waitForTransactionReceipt({ hash: routerTx })).contractAddress!;
  console.log(`[+] Mock Swap Router deployed at: ${routerAddr}`);

  const hashConfig = await walletClient.writeContract({
    address: treasuryAddr,
    abi: kycAbi,
    functionName: 'setConfig',
    args: [wbtcAddr, wethAddr, routerAddr],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: hashConfig });

  // Deploy AtomicSwapReceiver
  const swapTx = await walletClient.deployContract({
    abi: AtomicSwapReceiver.abi,
    bytecode: AtomicSwapReceiver.bytecode.object,
    args: [usdtAddr, usdcAddr, routerAddr, treasuryAddr, account.address]
  });
  const swapAddr = (await publicClient.waitForTransactionReceipt({ hash: swapTx })).contractAddress!;
  console.log(`[+] AtomicSwapReceiver Contract deployed at: ${swapAddr}`);

  const hashSwapMint = await walletClient.writeContract({ address: alphaTokenAddr, abi: acAbi, functionName: 'grantRole', args: [MINTER_ROLE, swapAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hashSwapMint });

  // Deploy YieldStreamingVault
  const yieldTx = await walletClient.deployContract({
    abi: YieldStreamingVault.abi,
    bytecode: YieldStreamingVault.bytecode.object,
    args: [usdcAddr, account.address]
  });
  const yieldAddr = (await publicClient.waitForTransactionReceipt({ hash: yieldTx })).contractAddress!;
  console.log(`[+] YieldStreamingVault Contract deployed at: ${yieldAddr}`);

  // 8. Deploy VaultPositionNFT
  const nftArtifact = loadArtifact('VaultPositionNFT', 'VaultPositionNFT.sol');
  const nftTx = await walletClient.deployContract({
    abi: nftArtifact.abi,
    bytecode: nftArtifact.bytecode.object,
    args: [account.address]
  });
  const nftAddr = (await publicClient.waitForTransactionReceipt({ hash: nftTx })).contractAddress!;
  console.log(`[+] VaultPositionNFT Contract deployed at: ${nftAddr}`);

  // 9. Deploy GovernanceStaking
  const stakingArtifact = loadArtifact('GovernanceStaking', 'GovernanceStaking.sol');
  const stakingTx = await walletClient.deployContract({
    abi: stakingArtifact.abi,
    bytecode: stakingArtifact.bytecode.object,
    args: [alphaTokenAddr, usdcAddr, account.address]
  });
  const stakingAddr = (await publicClient.waitForTransactionReceipt({ hash: stakingTx })).contractAddress!;
  console.log(`[+] GovernanceStaking Contract deployed at: ${stakingAddr}`);

  const idGovStaking = keccak256(toHex('GOVERNANCE_STAKING'));
  const hGovStaking = await walletClient.writeContract({ address: apAddr, abi: apArtifact.abi, functionName: 'setAddress', args: [idGovStaking, stakingAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hGovStaking });
  console.log(`[+] Registered GOVERNANCE_STAKING in ProtocolAddressProvider.`);

  const hashStakingBurn = await walletClient.writeContract({ address: alphaTokenAddr, abi: acAbi, functionName: 'grantRole', args: [BURNER_ROLE, stakingAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hashStakingBurn });
  console.log(`[+] Granted BURNER_ROLE to GovernanceStaking on AlphaToken.`);

  const hashTreasuryStakingBurn = await walletClient.writeContract({ address: treasuryAddr, abi: acAbi, functionName: 'grantRole', args: [BURNER_ROLE, stakingAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hashTreasuryStakingBurn });
  console.log(`[+] Granted BURNER_ROLE to GovernanceStaking on TreasuryManager.`);

  const hashSetTreasury = await walletClient.writeContract({
    address: stakingAddr,
    abi: stakingArtifact.abi,
    functionName: 'setTreasury',
    args: [treasuryAddr],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: hashSetTreasury });
  console.log(`[+] Linked TreasuryManager into GovernanceStaking.`);

  // 10. Deploy RealYieldRouter (Pure DeFi 50/50)
  const routerYieldArtifact = loadArtifact('RealYieldRouter', 'RealYieldRouter.sol');
  const ryRouterTx = await walletClient.deployContract({
    abi: routerYieldArtifact.abi,
    bytecode: routerYieldArtifact.bytecode.object,
    args: [usdcAddr, wbtcAddr, routerAddr, stakingAddr, account.address]
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

  // Authorize TreasuryManager on RealYieldRouter so deposit/redeem protocol fee routing succeeds
  const authTreasuryYieldTx = await walletClient.writeContract({
    address: ryRouterAddr,
    abi: routerYieldArtifact.abi,
    functionName: 'setAuthorizedYieldCaller',
    args: [treasuryAddr, true],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: authTreasuryYieldTx });
  console.log(`[+] Authorized TreasuryManager on RealYieldRouter.`);

  // 11. Deploy Community Yield Vault (50% Real Yield for stALPHA stakers)
  const communityYieldArtifact = loadArtifactSafe('CommunityYieldVault', 'CommunityYieldVault.sol') || YieldStreamingVault;
  const communityYieldTx = await walletClient.deployContract({
    abi: communityYieldArtifact.abi,
    bytecode: communityYieldArtifact.bytecode.object,
    args: [usdcAddr, account.address],
    account
  });
  const communityYieldVaultAddr = (await publicClient.waitForTransactionReceipt({ hash: communityYieldTx })).contractAddress!;
  console.log(`[+] CommunityYieldVault Contract deployed at: ${communityYieldVaultAddr}`);

  // Set Treasury and Community Yield Vault on RealYieldRouter for 50/50 liquid USDC fee split
  const setRyWalletsTx = await walletClient.writeContract({
    address: ryRouterAddr,
    abi: routerYieldArtifact.abi,
    functionName: 'setProtocolVaults',
    args: [treasuryAddr, communityYieldVaultAddr],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: setRyWalletsTx });
  console.log(`[+] Configured 50/50 Liquid USDC Vaults (50% Treasury, 50% Community Real Yield) on RealYieldRouter.`);

  const setRyBreakerTx = await walletClient.writeContract({
    address: ryRouterAddr,
    abi: routerYieldArtifact.abi,
    functionName: 'setCircuitBreaker',
    args: [cbAddr],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: setRyBreakerTx });

  const setCommunityVaultHash = await walletClient.writeContract({
    address: stakingAddr,
    abi: stakingArtifact.abi,
    functionName: 'setProtocolVaults',
    args: [communityYieldVaultAddr],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: setCommunityVaultHash });

  // Configure GovernanceStaking address on Community Yield Vault for liquid USDC reward distribution
  const setStakingProfit = await walletClient.writeContract({
    address: communityYieldVaultAddr,
    abi: communityYieldArtifact.abi,
    functionName: 'setStakingPool',
    args: [stakingAddr]
  });
  await publicClient.waitForTransactionReceipt({ hash: setStakingProfit });

  console.log('[+] Configured 50/50 Pure DeFi fee routing: reserves and community yield only.');

  // 12. Deploy VestedDiscountVault
  const vaultArtifact = loadArtifact('VestedDiscountVault', 'VestedDiscountVault.sol');
  const vestedVaultTx = await walletClient.deployContract({
    abi: vaultArtifact.abi,
    bytecode: vaultArtifact.bytecode.object,
    args: [usdcAddr, nftAddr, treasuryAddr, ryRouterAddr, alphaTokenAddr, account.address],
    account
  });
  const vestedVaultAddr = (await publicClient.waitForTransactionReceipt({ hash: vestedVaultTx })).contractAddress!;
  console.log(`[+] VestedDiscountVault Contract deployed at: ${vestedVaultAddr}`);

  const hashVestedBurner = await walletClient.writeContract({ address: treasuryAddr, abi: acAbi, functionName: 'grantRole', args: [BURNER_ROLE, vestedVaultAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hashVestedBurner });

  const hashVestedMint = await walletClient.writeContract({ address: alphaTokenAddr, abi: acAbi, functionName: 'grantRole', args: [MINTER_ROLE, vestedVaultAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hashVestedMint });

  const hashNftMinter = await walletClient.writeContract({ address: nftAddr, abi: acAbi, functionName: 'grantRole', args: [MINTER_ROLE, vestedVaultAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hashNftMinter });
  
  const idVestedVault = keccak256(toHex('VESTED_VAULT'));
  const hVestedVault = await walletClient.writeContract({ address: apAddr, abi: apArtifact.abi, functionName: 'setAddress', args: [idVestedVault, vestedVaultAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hVestedVault });
  console.log(`[+] Configured permissions and registered VestedDiscountVault in ProtocolAddressProvider.`);

  // 13. Deploy P2PLendingMarket
  const p2pArtifact = loadArtifact('P2PLendingMarket', 'P2PLendingMarket.sol');
  const p2pTx = await walletClient.deployContract({
    abi: p2pArtifact.abi,
    bytecode: p2pArtifact.bytecode.object,
    args: [usdcAddr, nftAddr, ryRouterAddr, oracleAddr, account.address],
    account
  });
  const p2pAddr = (await publicClient.waitForTransactionReceipt({ hash: p2pTx })).contractAddress!;
  console.log(`[+] P2PLendingMarket Contract deployed at: ${p2pAddr}`);

  const idP2p = keccak256(toHex('P2P_MARKET'));
  const hP2p = await walletClient.writeContract({ address: apAddr, abi: apArtifact.abi, functionName: 'setAddress', args: [idP2p, p2pAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hP2p });

  const idP2pAlt = keccak256(toHex('P2P_LENDING_MARKET'));
  const hP2pAlt = await walletClient.writeContract({ address: apAddr, abi: apArtifact.abi, functionName: 'setAddress', args: [idP2pAlt, p2pAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hP2pAlt });

  const hashP2pNft = await walletClient.writeContract({ address: nftAddr, abi: acAbi, functionName: 'grantRole', args: [MINTER_ROLE, p2pAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hashP2pNft });
  console.log(`[+] Registered P2PLendingMarket and authorized on VaultPositionNFT.`);

  const setP2pTreasury = await walletClient.writeContract({
    address: p2pAddr,
    abi: p2pArtifact.abi,
    functionName: 'setTreasury',
    args: [treasuryAddr],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: setP2pTreasury });
  console.log(`[+] Linked TreasuryManager into P2PLendingMarket.`);

  const setP2pPriceFeed = await walletClient.writeContract({
    address: p2pAddr,
    abi: p2pArtifact.abi,
    functionName: 'setPriceFeed',
    args: [oracleAddr],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: setP2pPriceFeed });

  const setP2pFeeCollector = await walletClient.writeContract({
    address: p2pAddr,
    abi: p2pArtifact.abi,
    functionName: 'setFeeCollector',
    args: [ryRouterAddr],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: setP2pFeeCollector });

  const setP2pAlpha = await walletClient.writeContract({
    address: p2pAddr,
    abi: p2pArtifact.abi,
    functionName: 'setAlphaToken',
    args: [alphaTokenAddr],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: setP2pAlpha });

  const setP2pWbtc = await walletClient.writeContract({
    address: p2pAddr,
    abi: p2pArtifact.abi,
    functionName: 'setWbtcToken',
    args: [wbtcAddr],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: setP2pWbtc });

  const setP2pWeth = await walletClient.writeContract({
    address: p2pAddr,
    abi: p2pArtifact.abi,
    functionName: 'setWethToken',
    args: [wethAddr],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: setP2pWeth });

  const setP2pBreaker = await walletClient.writeContract({
    address: p2pAddr,
    abi: p2pArtifact.abi,
    functionName: 'setCircuitBreaker',
    args: [cbAddr],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: setP2pBreaker });
  console.log(`[+] Configured AlphaToken, WBTC, WETH and OracleHub in P2PLendingMarket.`);

  // Authorize P2PLendingMarket and VestedDiscountVault on RealYieldRouter
  const authP2pYield = await walletClient.writeContract({
    address: ryRouterAddr,
    abi: routerYieldArtifact.abi,
    functionName: 'setAuthorizedYieldCaller',
    args: [p2pAddr, true],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: authP2pYield });

  const authVestedYield = await walletClient.writeContract({
    address: ryRouterAddr,
    abi: routerYieldArtifact.abi,
    functionName: 'setAuthorizedYieldCaller',
    args: [vestedVaultAddr, true],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: authVestedYield });

  // 14. Deploy MorphoYieldVaultAdapter
  const morphoArtifact = loadArtifact('MorphoYieldVaultAdapter', 'MorphoYieldVaultAdapter.sol');
  const morphoTx = await walletClient.deployContract({
    abi: morphoArtifact.abi,
    bytecode: morphoArtifact.bytecode.object,
    args: [usdcAddr, treasuryAddr, account.address],
    account
  });
  const morphoAddr = (await publicClient.waitForTransactionReceipt({ hash: morphoTx })).contractAddress!;
  console.log(`[+] MorphoYieldVaultAdapter deployed at: ${morphoAddr}`);

  // 15. Deploy PromotionalIncentiveVault
  const promoArtifact = loadArtifact('PromotionalIncentiveVault', 'PromotionalIncentiveVault.sol');
  const promoTx = await walletClient.deployContract({
    abi: promoArtifact.abi,
    bytecode: promoArtifact.bytecode.object,
    args: [alphaTokenAddr, account.address],
    account
  });
  const promoAddr = (await publicClient.waitForTransactionReceipt({ hash: promoTx })).contractAddress!;
  console.log(`[+] PromotionalIncentiveVault deployed at: ${promoAddr}`);

  // Link Reserve Vaults into GovernanceStaking
  const hashSetReserveVaults = await walletClient.writeContract({
    address: stakingAddr,
    abi: stakingArtifact.abi,
    functionName: 'setReserveVaults',
    args: [vaultAddr, promoAddr],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: hashSetReserveVaults });
  console.log(`[+] Linked Reserve Vaults (AlphaVault, PromotionalVault) into GovernanceStaking.`);

  // 16. Deploy DynamicYieldOracleRouter
  const yieldOracleArtifact = loadArtifact('DynamicYieldOracleRouter', 'DynamicYieldOracleRouter.sol');
  const yieldOracleTx = await walletClient.deployContract({
    abi: yieldOracleArtifact.abi,
    bytecode: yieldOracleArtifact.bytecode.object,
    args: [account.address],
    account
  });
  const yieldOracleAddr = (await publicClient.waitForTransactionReceipt({ hash: yieldOracleTx })).contractAddress!;
  console.log(`[+] DynamicYieldOracleRouter deployed at: ${yieldOracleAddr}`);

  // 17. Deploy TreasuryReserveManager
  const mgrArtifact = loadArtifact('TreasuryReserveManager', 'TreasuryReserveManager.sol');
  const mgrTx = await walletClient.deployContract({
    abi: mgrArtifact.abi,
    bytecode: mgrArtifact.bytecode.object,
    args: [treasuryAddr, usdcAddr, wbtcAddr, wethAddr, account.address],
    account
  });
  const mgrAddr = (await publicClient.waitForTransactionReceipt({ hash: mgrTx })).contractAddress!;
  console.log(`[+] TreasuryReserveManager deployed at: ${mgrAddr}`);

  // 18. Deploy ProtocolTokenomicsEngine
  const engineArtifact = loadArtifact('ProtocolTokenomicsEngine', 'ProtocolTokenomicsEngine.sol');
  const engineTx = await walletClient.deployContract({
    abi: engineArtifact.abi,
    bytecode: engineArtifact.bytecode.object,
    args: [account.address],
    account
  });
  const engineAddr = (await publicClient.waitForTransactionReceipt({ hash: engineTx })).contractAddress!;
  console.log(`[+] ProtocolTokenomicsEngine Contract deployed at: ${engineAddr}`);

  // Register in AddressProvider
  const idEngine = keccak256(toHex('TOKENOMICS_ENGINE'));
  const hEngine = await walletClient.writeContract({ address: apAddr, abi: apArtifact.abi, functionName: 'setAddress', args: [idEngine, engineAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hEngine });

  // Wire ProtocolTokenomicsEngine into VestedDiscountVault and P2PLendingMarket

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

  // 19. Deploy TimelockController (72h Delay)
  const timelockArtifact = loadArtifact('TimelockController', 'TimelockController.sol');
  const timelockTx = await walletClient.deployContract({
    abi: timelockArtifact.abi,
    bytecode: timelockArtifact.bytecode.object,
    args: [259200n, account.address] // 72 hours delay
  });
  const timelockAddr = (await publicClient.waitForTransactionReceipt({ hash: timelockTx })).contractAddress!;
  console.log(`[+] TimelockController Contract (72h Delay) deployed at: ${timelockAddr}`);

  // 20. Deploy GovernorAlphaCentauri
  const governorArtifact = loadArtifact('GovernorAlphaCentauri', 'GovernorAlphaCentauri.sol');
  const governorTx = await walletClient.deployContract({
    abi: governorArtifact.abi,
    bytecode: governorArtifact.bytecode.object,
    args: [stakingAddr, timelockAddr, vaultAddr, communityYieldVaultAddr, treasuryAddr, account.address]
  });
  const governorAddr = (await publicClient.waitForTransactionReceipt({ hash: governorTx })).contractAddress!;
  console.log(`[+] GovernorAlphaCentauri Contract deployed at: ${governorAddr}`);

  // Wire Timelock ownership to GovernorAlphaCentauri
  const adminRoleHash = keccak256(toHex('ADMIN_ROLE'));
  const setTimeOwnerHash = await walletClient.writeContract({
    address: timelockAddr,
    abi: timelockArtifact.abi,
    functionName: 'grantRole',
    args: [adminRoleHash, governorAddr]
  });
  await publicClient.waitForTransactionReceipt({ hash: setTimeOwnerHash });
  console.log('[+] Transferred Timelock administration to GovernorAlphaCentauri DAO.');

  // Register in AddressProvider
  const idGov = keccak256(toHex('GOVERNOR'));
  const hGov = await walletClient.writeContract({ address: apAddr, abi: apArtifact.abi, functionName: 'setAddress', args: [idGov, governorAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hGov });

  const idTime = keccak256(toHex('TIMELOCK'));
  const hTime = await walletClient.writeContract({ address: apAddr, abi: apArtifact.abi, functionName: 'setAddress', args: [idTime, timelockAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hTime });

  // 21. Deploy DiscountBuybackEngine (Autonomous 10-Lock Peg Stabilizer)
  const buybackArtifact = loadArtifact('DiscountBuybackEngine', 'DiscountBuybackEngine.sol');
  const buybackTx = await walletClient.deployContract({
    abi: buybackArtifact.abi,
    bytecode: buybackArtifact.bytecode.object,
    args: [apAddr, usdcAddr, 6, zeroAddr, account.address],
    account
  });
  const buybackAddr = (await publicClient.waitForTransactionReceipt({ hash: buybackTx })).contractAddress!;
  console.log(`[+] DiscountBuybackEngine Contract deployed at: ${buybackAddr}`);

  const idBuyback = keccak256(toHex('DISCOUNT_BUYBACK_ENGINE'));
  const hBuyback = await walletClient.writeContract({ address: apAddr, abi: apArtifact.abi, functionName: 'setAddress', args: [idBuyback, buybackAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hBuyback });

  // Grant VAULT_MANAGER_ROLE on AlphaVault to DiscountBuybackEngine
  const hBuybackVault = await walletClient.writeContract({ address: vaultAddr, abi: acAbi, functionName: 'grantRole', args: [VAULT_MANAGER_ROLE, buybackAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hBuybackVault });

  // Grant BURNER_ROLE on AlphaToken and TreasuryManager to DiscountBuybackEngine
  const hBuybackBurn = await walletClient.writeContract({ address: alphaTokenAddr, abi: acAbi, functionName: 'grantRole', args: [BURNER_ROLE, buybackAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hBuybackBurn });
  const hBuybackTreasuryBurn = await walletClient.writeContract({ address: treasuryAddr, abi: acAbi, functionName: 'grantRole', args: [BURNER_ROLE, buybackAddr], account });
  await publicClient.waitForTransactionReceipt({ hash: hBuybackTreasuryBurn });

  // Ensure GovernanceStaking has Treasury linked for burning on-chain accounting
  const hStakingTreasury = await walletClient.writeContract({
    address: stakingAddr,
    abi: stakingArtifact.abi,
    functionName: 'setTreasury',
    args: [treasuryAddr],
    account
  });
  await publicClient.waitForTransactionReceipt({ hash: hStakingTreasury });
  console.log('[+] Linked TreasuryManager into GovernanceStaking.');

  // ─────────────────────────────────────────────────────────────────────────────
  // Initial Reserves Seeding
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('[*] Realizando depósito de génesis en Tesorería...');
  const initialDeposit = 100_000n * 1_000_000n; // 100,000 USDC (6 decimals)
  const mintInitialUSDC = await walletClient.writeContract({
    address: usdcAddr as `0x${string}`,
    abi: MockERC20.abi,
    functionName: 'mint',
    args: [account.address, initialDeposit]
  });
  await publicClient.waitForTransactionReceipt({ hash: mintInitialUSDC });

  const approveInitialUSDC = await walletClient.writeContract({
    address: usdcAddr as `0x${string}`,
    abi: MockERC20.abi,
    functionName: 'approve',
    args: [treasuryAddr as `0x${string}`, initialDeposit]
  });
  await publicClient.waitForTransactionReceipt({ hash: approveInitialUSDC });

  const depositAbi = [
    {
      name: 'deposit',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [{ name: 'usdcAmount', type: 'uint256' }, { name: 'minAlphaOut', type: 'uint256' }],
      outputs: [{ name: '', type: 'uint256' }]
    }
  ] as const;

  const depositInitial = await walletClient.writeContract({
    address: treasuryAddr as `0x${string}`,
    abi: depositAbi,
    functionName: 'deposit',
    args: [initialDeposit, 0n]
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

  function removeEnvVar(key: string) {
    envContent = envContent.replace(new RegExp(`^${key}=.*(?:\\r?\\n|$)`, 'm'), '');
  }

  // Update variables with VITE_ prefix for React compatibility
  updateEnvVar('VITE_USDC_ADDRESS', usdcAddr);
  updateEnvVar('VITE_USDT_ADDRESS', usdtAddr);
  updateEnvVar('VITE_TREASURY_ADDRESS', treasuryAddr);
  updateEnvVar('VITE_ATOMIC_SWAP_ADDRESS', swapAddr);
  updateEnvVar('VITE_YIELD_VAULT_ADDRESS', yieldAddr);
  updateEnvVar('VITE_CIRCUIT_BREAKER_ADDRESS', cbAddr);
  updateEnvVar('VITE_POSITION_NFT_ADDRESS', nftAddr);
  updateEnvVar('VITE_VESTED_VAULT_ADDRESS', vestedVaultAddr);
  updateEnvVar('VITE_P2P_MARKET_ADDRESS', p2pAddr);
  updateEnvVar('VITE_STAKING_ADDRESS', stakingAddr);
  updateEnvVar('VITE_COMMUNITY_YIELD_VAULT_ADDRESS', communityYieldVaultAddr);
  updateEnvVar('VITE_DISCOUNT_BUYBACK_ENGINE_ADDRESS', buybackAddr);
  removeEnvVar('VITE_CORPORATE_CONTRIBUTION_ADDRESS');
  removeEnvVar('VITE_PROTOCOL_OPEX_VAULT_ADDRESS');
  removeEnvVar('VITE_ADMIN_KEY');
  removeEnvVar('VITE_USER_KEY');

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
    ATOMIC_SWAP: swapAddr,
    YIELD_VAULT: yieldAddr,
    CIRCUIT_BREAKER: cbAddr,
    POSITION_NFT: nftAddr,
    VESTED_VAULT: vestedVaultAddr,
    P2P_MARKET: p2pAddr,
    STAKING: stakingAddr,
    REAL_YIELD_ROUTER: ryRouterAddr,
    TOKENOMICS_ENGINE: engineAddr,
    COMMUNITY_YIELD_VAULT: communityYieldVaultAddr,
    MORPHO_ADAPTER: morphoAddr,
    PROMO_VAULT: promoAddr,
    DYNAMIC_YIELD_ORACLE: yieldOracleAddr,
    RESERVE_MANAGER: mgrAddr,
    ORACLE_ROUTER: oracleAddr,
    GOVERNOR: governorAddr,
    TIMELOCK: timelockAddr,
    DISCOUNT_BUYBACK_ENGINE: buybackAddr
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
