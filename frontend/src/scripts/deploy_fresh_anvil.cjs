/**
 * deploy_fresh_anvil.cjs
 * Fresh 0-state deployment of Alpha Centauri V6 contracts.
 * Run: docker exec alpha-frontend node /app/src/scripts/deploy_fresh_anvil.cjs
 */
const { createPublicClient, createWalletClient, http, parseEther, defineChain } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const fs = require('fs');
const path = require('path');

const anvilChain = defineChain({
  id: 31337,
  name: 'Anvil Localhost',
  network: 'anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['http://alpha-anvil:8545'] } }
});

const ADMIN_PK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const USER_PK  = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const adminAccount = privateKeyToAccount(ADMIN_PK);
const userAccount  = privateKeyToAccount(USER_PK);

const rpcUrl = 'http://alpha-anvil:8545';
const publicClient = createPublicClient({ chain: anvilChain, transport: http(rpcUrl) });
const walletClient = createWalletClient({ account: adminAccount, chain: anvilChain, transport: http(rpcUrl) });

function load(name) {
  const p = path.resolve(__dirname, `artifacts/${name}.json`);
  if (!fs.existsSync(p)) throw new Error(`Artifact not found: ${p}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function deploy(abi, bytecode, args = []) {
  const hash = await walletClient.deployContract({ abi, bytecode, args });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return receipt.contractAddress;
}

async function call(address, abi, functionName, args = []) {
  const hash = await walletClient.writeContract({ address, abi, functionName, args });
  await publicClient.waitForTransactionReceipt({ hash });
}

async function callAs(account, address, abi, functionName, args = []) {
  const wc = createWalletClient({ account, chain: anvilChain, transport: http(rpcUrl) });
  const hash = await wc.writeContract({ address, abi, functionName, args });
  await publicClient.waitForTransactionReceipt({ hash });
}

async function main() {
  console.log('----------------------------------------------------');
  console.log('🚀 ALPHA CENTAURI V6 — FRESH 0-STATE DEPLOYMENT');
  console.log('   Admin:', adminAccount.address);
  console.log('   User: ', userAccount.address);
  console.log('----------------------------------------------------');

  const MockERC20           = load('MockERC20');
  const MockChainlinkFeed   = load('MockChainlinkFeed');
  const MockSwapRouter      = load('MockSwapRouter');
  const TreasuryArt         = load('Treasury');
  const CircuitBreakerArt   = load('CircuitBreaker');
  const AtomicSwapArt       = load('AtomicSwapReceiver');
  const YieldVaultArt       = load('YieldStreamingVault');
  const CorporateArt        = load('CorporateContribution');
  const NFTArt              = load('VaultPositionNFT');
  const StakingArt          = load('GovernanceStaking');
  const RYRouterArt         = load('RealYieldRouter');
  const VestedArt           = load('VestedDiscountVault');
  const P2PArt              = load('P2PLendingMarket');
  const ReserveMgrArt       = load('TreasuryReserveManager');

  // ── STEP 1: Mock tokens ─────────────────────────────────────────
  const usdc = await deploy(MockERC20.abi, MockERC20.bytecode.object, ['USD Coin', 'USDC']);
  console.log('[+] USDC deployed at:', usdc);

  const usdt = await deploy(MockERC20.abi, MockERC20.bytecode.object, ['Tether USD', 'USDT']);
  console.log('[+] USDT deployed at:', usdt);

  // ── STEP 2: Mock price feed (8 decimals, $1.00 = 100_000_000) ──
  const feed = await deploy(MockChainlinkFeed.abi, MockChainlinkFeed.bytecode.object, [8, 100000000n]);
  console.log('[+] PriceFeed deployed at:', feed);

  // ── STEP 3: Mock swap router ────────────────────────────────────
  const swapRouter = await deploy(MockSwapRouter.abi, MockSwapRouter.bytecode.object, [usdc, '0x0000000000000000000000000000000000000999']);
  console.log('[+] MockSwapRouter deployed at:', swapRouter);

  // ── STEP 4: Treasury (ALPHA token + reserve vault) ─────────────
  const treasury = await deploy(TreasuryArt.abi, TreasuryArt.bytecode.object, [adminAccount.address, usdc, 18]);
  console.log('[+] Treasury deployed at:', treasury);

  // ── STEP 5: CircuitBreaker ──────────────────────────────────────
  const cb = await deploy(CircuitBreakerArt.abi, CircuitBreakerArt.bytecode.object, [adminAccount.address]);
  await call(treasury, TreasuryArt.abi, 'setCircuitBreaker', [cb]);
  console.log('[+] CircuitBreaker deployed & wired:', cb);

  // ── STEP 6: AtomicSwapReceiver ──────────────────────────────────
  const atomicSwap = await deploy(AtomicSwapArt.abi, AtomicSwapArt.bytecode.object, [usdt, usdc, swapRouter, treasury, adminAccount.address]);

  // ── STEP 7: YieldStreamingVault ────────────────────────────────
  const yieldVault = await deploy(YieldVaultArt.abi, YieldVaultArt.bytecode.object, [usdc, adminAccount.address]);

  // ── STEP 8: CorporateContribution ──────────────────────────────
  const corp = await deploy(CorporateArt.abi, CorporateArt.bytecode.object, [usdc, '0x0000000000000000000000000000000000000999', '0x0000000000000000000000000000000000000888', swapRouter, adminAccount.address]);

  // ── STEP 9: VaultPositionNFT ────────────────────────────────────
  const nft = await deploy(NFTArt.abi, NFTArt.bytecode.object, [adminAccount.address]);
  console.log('[+] VaultPositionNFT deployed at:', nft);

  // ── STEP 10: GovernanceStaking ──────────────────────────────────
  // ALPHA token = treasury (Treasury.sol is also an ERC20)
  const staking = await deploy(StakingArt.abi, StakingArt.bytecode.object, [treasury, usdc, adminAccount.address]);
  console.log('[+] GovernanceStaking deployed at:', staking);

  // ── STEP 11: RealYieldRouter ────────────────────────────────────
  const ryRouter = await deploy(RYRouterArt.abi, RYRouterArt.bytecode.object, [usdc, usdc, swapRouter, staking, adminAccount.address]);
  await call(staking, StakingArt.abi, 'setAuthorizedCaller', [ryRouter, true]);
  await call(ryRouter, RYRouterArt.abi, 'setWallets', [treasury, adminAccount.address]);
  console.log('[+] RealYieldRouter deployed & wired:', ryRouter);

  // ── STEP 12: VestedDiscountVault ────────────────────────────────
  // constructor(_stablecoin, _positionNFT, _treasuryBunker, _opsWallet, _realYieldRouter, _govToken, _initialOwner)
  const vestedVault = await deploy(VestedArt.abi, VestedArt.bytecode.object, [usdc, nft, treasury, adminAccount.address, ryRouter, treasury, adminAccount.address]);
  await call(nft, NFTArt.abi, 'setMinter', [vestedVault, true]);
  await call(vestedVault, VestedArt.abi, 'setGovernanceStaking', [staking]);
  console.log('[+] VestedDiscountVault deployed at:', vestedVault);

  // ── STEP 13: P2PLendingMarket ───────────────────────────────────
  // constructor(_stablecoin, _positionNFT, _feeCollector, _priceFeed, _initialOwner)
  const p2pMarket = await deploy(P2PArt.abi, P2PArt.bytecode.object, [usdc, nft, adminAccount.address, feed, adminAccount.address]);
  await call(nft, NFTArt.abi, 'setMinter', [p2pMarket, true]);
  console.log('[+] P2PLendingMarket deployed at:', p2pMarket);

  // ── STEP 14: TreasuryReserveManager ────────────────────────────
  // constructor(_treasury, _usdcToken, _wbtcToken, _wethToken, _initialOwner)
  const reserveMgr = await deploy(ReserveMgrArt.abi, ReserveMgrArt.bytecode.object, [treasury, usdc, usdc, usdc, adminAccount.address]);

  // ── STEP 15: Wire all modules into Treasury ─────────────────────
  // setProtocolModules(_vestedVault, _p2pMarket, _realYieldRouter, _governanceStaking, _opsWallet, _corporateRevenueWallet)
  await call(treasury, TreasuryArt.abi, 'setProtocolModules', [vestedVault, p2pMarket, ryRouter, staking, adminAccount.address, adminAccount.address]);
  console.log('[+] Treasury protocol modules wired.');

  // ── STEP 16: Register USDC as tracked asset ─────────────────────
  // setTrackedAsset(asset, feed, decimals)
  await call(treasury, TreasuryArt.abi, 'setTrackedAsset', [usdc, feed, 18]);
  console.log('[+] USDC registered as tracked asset.');

  // ── STEP 17: Mint fresh USDC balances ───────────────────────────
  await call(usdc, MockERC20.abi, 'mint', [adminAccount.address, parseEther('1000000')]);
  await call(usdc, MockERC20.abi, 'mint', [userAccount.address, parseEther('100000')]);
  console.log('[+] Minted 1,000,000 USDC → Admin | 100,000 USDC → User');

  // ── STEP 18: Deposit 20,000 USDC into Treasury (mints 20,000 ALPHA to Admin)
  await call(usdc, MockERC20.abi, 'approve', [treasury, parseEther('20000')]);
  await call(treasury, TreasuryArt.abi, 'deposit', [parseEther('20000')]);
  console.log('[+] Deposited 20,000 USDC into Treasury reserves (20,000 ALPHA minted to Admin).');

  // ── STEP 19: Transfer ALPHA tokens to User for staking ──────────
  // Treasury.sol is the ALPHA ERC20 — admin already has supply from deployment
  await call(treasury, TreasuryArt.abi, 'transfer', [userAccount.address, parseEther('10000')]);
  console.log('[+] Transferred 10,000 ALPHA → User for staking.');

  // ── SAVE new contracts.json ──────────────────────────────────────
  const deployedContracts = {
    USDC: usdc,
    USDT: usdt,
    TREASURY: treasury,
    CORPORATE_CONTRIBUTION: corp,
    ATOMIC_SWAP: atomicSwap,
    YIELD_VAULT: yieldVault,
    CIRCUIT_BREAKER: cb,
    POSITION_NFT: nft,
    VESTED_VAULT: vestedVault,
    P2P_MARKET: p2pMarket,
    STAKING: staking,
    REAL_YIELD_ROUTER: ryRouter,
    RESERVE_MANAGER: reserveMgr
  };

  const contractsJsonPath = path.resolve(__dirname, '../contracts.json');
  fs.writeFileSync(contractsJsonPath, JSON.stringify(deployedContracts, null, 2));

  console.log('');
  console.log('✅ contracts.json updated:', contractsJsonPath);
  console.log('');
  console.log('====================================================');
  console.log('🎉 FRESH 0-STATE DEPLOYMENT COMPLETED!');
  console.log('   Saldos iniciales:');
  console.log('   Admin  → 1,000,000 USDC | 990,000 ALPHA (10,000 en Treasury)');
  console.log('   User   →   100,000 USDC |  10,000 ALPHA');
  console.log('   Treasury → 10,000 USDC en reservas');
  console.log('====================================================');
}

main().catch(err => {
  console.error('\n❌ Deployment failed:', err.message || err);
  process.exit(1);
});
