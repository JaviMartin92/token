import { createPublicClient, createWalletClient, http, formatUnits, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';

const ANVIL_URL = process.env.ANVIL_URL || 'http://localhost:8545';

const OPERATOR_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const USER_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

const adminAccount = privateKeyToAccount(OPERATOR_KEY);
const userAccount = privateKeyToAccount(USER_KEY);

const anvilChain = {
  id: 31337,
  name: 'Anvil Localhost',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [ANVIL_URL] } }
};

const publicClient = createPublicClient({
  chain: anvilChain,
  transport: http(ANVIL_URL)
});

const adminWallet = createWalletClient({
  account: adminAccount,
  chain: anvilChain,
  transport: http(ANVIL_URL)
});

const userWallet = createWalletClient({
  account: userAccount,
  chain: anvilChain,
  transport: http(ANVIL_URL)
});

function loadFrontendContracts() {
  const p = path.resolve(__dirname, '../../../frontend/src/contracts.json');
  if (!fs.existsSync(p)) {
    throw new Error(`Frontend contracts.json not found at ${p}`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function loadArtifact(name: string, file: string) {
  const p1 = path.resolve(__dirname, `../../../contracts/out/${file}/${name}.json`);
  const p2 = path.resolve(__dirname, `../../../contracts/out/src/${file}/${name}.json`);
  const p3 = path.resolve(__dirname, `../../../contracts/out/test/${file}/${name}.json`);
  const p4 = path.resolve(__dirname, `../../../contracts/out/adapters/${file}/${name}.json`);
  const p5 = path.resolve(__dirname, `../../../contracts/out/${name}.sol/${name}.json`);
  const p = fs.existsSync(p1) ? p1 : fs.existsSync(p2) ? p2 : fs.existsSync(p3) ? p3 : fs.existsSync(p4) ? p4 : fs.existsSync(p5) ? p5 : p1;
  if (!fs.existsSync(p)) {
    throw new Error(`Compiled artifact not found at ${p1} nor ${p2}`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function main() {
  console.log('\n============================================================');
  console.log('    FRONTEND / BACKEND CONTRACT ALIGNMENT VERIFICATION TEST  ');
  console.log('============================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] ${testName} - ${detail || 'Assertion failed'}`);
      failedTests++;
    }
  }

  // TEST 1: ABI Consistency
  console.log('[1/4] Verifying Frontend Addresses & Compiled Smart Contracts...');
  const addresses = loadFrontendContracts();
  const contractsToVerify = [
    { key: 'TREASURY', file: 'Treasury.sol', artifact: 'Treasury' },
    { key: 'POSITION_NFT', file: 'VaultPositionNFT.sol', artifact: 'VaultPositionNFT' },
    { key: 'VESTED_VAULT', file: 'VestedDiscountVault.sol', artifact: 'VestedDiscountVault' },
    { key: 'P2P_MARKET', file: 'P2PLendingMarket.sol', artifact: 'P2PLendingMarket' },
    { key: 'STAKING', file: 'GovernanceStaking.sol', artifact: 'GovernanceStaking' },
    { key: 'REAL_YIELD_ROUTER', file: 'RealYieldRouter.sol', artifact: 'RealYieldRouter' },
    { key: 'CIRCUIT_BREAKER', file: 'CircuitBreaker.sol', artifact: 'CircuitBreaker' },
    { key: 'CORPORATE_CONTRIBUTION', file: 'CorporateContribution.sol', artifact: 'CorporateContribution' },
    { key: 'TOKENOMICS_ENGINE', file: 'ProtocolTokenomicsEngine.sol', artifact: 'ProtocolTokenomicsEngine' },
  ];

  for (const item of contractsToVerify) {
    try {
      const compiled = loadArtifact(item.artifact, item.file);
      assert(!!compiled.abi && Array.isArray(compiled.abi), `Compiled ABI valid for ${item.key}`);
      assert(typeof addresses[item.key] === 'string' && addresses[item.key].startsWith('0x'), `Deployed address valid for ${item.key} (${addresses[item.key]})`);
    } catch (e: any) {
      assert(false, `Artifact check for ${item.key}`, e.message);
    }
  }

  // TEST 2: Token Decimal Checks On-Chain
  console.log('\n[2/4] Verifying On-Chain Token Decimals...');
  const usdcAddr = addresses.USDC;
  const treasuryAddr = addresses.TREASURY;

  try {
    const usdcDecimals = await publicClient.readContract({
      address: usdcAddr as `0x${string}`,
      abi: [{ name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] }],
      functionName: 'decimals'
    }) as number;

    assert(usdcDecimals === 6, 'Mock USDC on-chain is exactly 6 decimals', `Got ${usdcDecimals}`);

    const treasuryRedemptionDecimals = await publicClient.readContract({
      address: treasuryAddr as `0x${string}`,
      abi: [{ name: 'redemptionTokenDecimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] }],
      functionName: 'redemptionTokenDecimals'
    }) as number;

    assert(treasuryRedemptionDecimals === 6, 'Treasury redemptionTokenDecimals matches USDC (6 decimals)', `Got ${treasuryRedemptionDecimals}`);
  } catch (e: any) {
    assert(false, 'On-chain decimals verification', e.message);
  }

  // TEST 3: User Flow Interaction (USDC Faucet & Treasury Deposit)
  console.log('\n[3/4] Testing Frontend Flow Alignment (USDC Mint & Deposit)...');
  try {
    const depositAmountUsdc = '1000';
    const amountWei6 = parseUnits(depositAmountUsdc, 6); // 1,000 * 10^6

    // Faucet 1,000 USDC to user
    const txMint = await adminWallet.writeContract({
      address: usdcAddr as `0x${string}`,
      abi: [{ name: 'mint', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] }],
      functionName: 'mint',
      args: [userAccount.address, amountWei6]
    });
    await publicClient.waitForTransactionReceipt({ hash: txMint });

    const userUsdcBalBefore = await publicClient.readContract({
      address: usdcAddr as `0x${string}`,
      abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] }],
      functionName: 'balanceOf',
      args: [userAccount.address]
    }) as bigint;

    assert(userUsdcBalBefore >= amountWei6, 'User wallet received 1,000 USDC mock');

    // Approve Treasury
    const txApp = await userWallet.writeContract({
      address: usdcAddr as `0x${string}`,
      abi: [{ name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] }],
      functionName: 'approve',
      args: [treasuryAddr as `0x${string}`, amountWei6]
    });
    await publicClient.waitForTransactionReceipt({ hash: txApp });

    const treasuryArtifact = loadArtifact('Treasury', 'Treasury.sol');

    // Deposit into Treasury
    const txDep = await userWallet.writeContract({
      address: treasuryAddr as `0x${string}`,
      abi: treasuryArtifact.abi,
      functionName: 'deposit',
      args: [amountWei6]
    });
    await publicClient.waitForTransactionReceipt({ hash: txDep });

    const userShares = await publicClient.readContract({
      address: treasuryAddr as `0x${string}`,
      abi: treasuryArtifact.abi,
      functionName: 'balanceOf',
      args: [userAccount.address]
    }) as bigint;

    const nav = await publicClient.readContract({
      address: treasuryAddr as `0x${string}`,
      abi: treasuryArtifact.abi,
      functionName: 'getNAV'
    }) as bigint;

    const sharesFormatted = parseFloat(formatUnits(userShares, 18)); // ALPHA shares = 18 decimals
    const navFormatted = parseFloat(formatUnits(nav, 18)); // NAV = 18 decimals

    assert(sharesFormatted >= 990 && sharesFormatted <= 1000, `User received realistic ALPHA shares (${sharesFormatted.toFixed(2)})`, `Got ${sharesFormatted}`);
    assert(navFormatted >= 990 && navFormatted <= 50_000_000, `NAV value is in realistic USD range ($${navFormatted.toFixed(2)})`, `Got $${navFormatted}`);

  } catch (e: any) {
    assert(false, 'USDC Deposit Flow', e.message);
  }

  // TEST 4: Proof of Reserves Verification
  console.log('\n[4/4] Verifying Proof of Reserves & Solvency Metrics...');
  try {
    const treasuryArtifact = loadArtifact('Treasury', 'Treasury.sol');
    const por = await publicClient.readContract({
      address: treasuryAddr as `0x${string}`,
      abi: treasuryArtifact.abi,
      functionName: 'getProofOfReserves'
    }) as readonly [bigint, bigint, bigint];

    const totalAssetsUSD = parseFloat(formatUnits(por[0], 18));
    const totalLiabilitiesUSD = parseFloat(formatUnits(por[1], 18));
    const ratioBps = Number(por[2]);

    assert(totalAssetsUSD >= totalLiabilitiesUSD, `Fee Accretion Flywheel Active: Total Assets ($${totalAssetsUSD}) >= Total Liabilities ($${totalLiabilitiesUSD})`);
    assert(ratioBps >= 10000, `Collateralization Ratio Accredited >= 100.00% (${(ratioBps / 100).toFixed(2)}%)`);
    assert(totalAssetsUSD < 100_000_000, `Total Assets USD is realistic (Not Quadrillions): $${totalAssetsUSD.toLocaleString('en-US')}`);
  } catch (e: any) {
    assert(false, 'Proof of Reserves check', e.message);
  }

  console.log('\n============================================================');
  console.log(` RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error in alignment test:', err);
  process.exit(1);
});
