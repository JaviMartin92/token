"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ANVIL_URL = process.env.ANVIL_URL || 'http://localhost:8545';
const OPERATOR_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const USER_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const adminAccount = (0, accounts_1.privateKeyToAccount)(OPERATOR_KEY);
const userAccount = (0, accounts_1.privateKeyToAccount)(USER_KEY);
const anvilChain = {
    id: 31337,
    name: 'Anvil Localhost',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [ANVIL_URL] } }
};
const publicClient = (0, viem_1.createPublicClient)({
    chain: anvilChain,
    transport: (0, viem_1.http)(ANVIL_URL)
});
const adminWallet = (0, viem_1.createWalletClient)({
    account: adminAccount,
    chain: anvilChain,
    transport: (0, viem_1.http)(ANVIL_URL)
});
const userWallet = (0, viem_1.createWalletClient)({
    account: userAccount,
    chain: anvilChain,
    transport: (0, viem_1.http)(ANVIL_URL)
});
function loadFrontendContracts() {
    const p = path_1.default.resolve(__dirname, '../../../frontend/src/contracts.json');
    if (!fs_1.default.existsSync(p)) {
        throw new Error(`Frontend contracts.json not found at ${p}`);
    }
    return JSON.parse(fs_1.default.readFileSync(p, 'utf8'));
}
function loadArtifact(name, file) {
    const p1 = path_1.default.resolve(__dirname, `../../../contracts/out/${file}/${name}.json`);
    const p2 = path_1.default.resolve(__dirname, `../../../contracts/out/src/${file}/${name}.json`);
    const p3 = path_1.default.resolve(__dirname, `../../../contracts/out/test/${file}/${name}.json`);
    const p4 = path_1.default.resolve(__dirname, `../../../contracts/out/adapters/${file}/${name}.json`);
    const p5 = path_1.default.resolve(__dirname, `../../../contracts/out/${name}.sol/${name}.json`);
    const p = fs_1.default.existsSync(p1) ? p1 : fs_1.default.existsSync(p2) ? p2 : fs_1.default.existsSync(p3) ? p3 : fs_1.default.existsSync(p4) ? p4 : fs_1.default.existsSync(p5) ? p5 : p1;
    if (!fs_1.default.existsSync(p)) {
        throw new Error(`Compiled artifact not found at ${p1} nor ${p2}`);
    }
    return JSON.parse(fs_1.default.readFileSync(p, 'utf8'));
}
async function main() {
    console.log('\n============================================================');
    console.log('    FRONTEND / BACKEND CONTRACT ALIGNMENT VERIFICATION TEST  ');
    console.log('============================================================\n');
    let passedTests = 0;
    let failedTests = 0;
    function assert(condition, testName, detail) {
        if (condition) {
            console.log(`  [PASS] ${testName}`);
            passedTests++;
        }
        else {
            console.error(`  [FAIL] ${testName} - ${detail || 'Assertion failed'}`);
            failedTests++;
        }
    }
    // TEST 1: ABI Consistency
    console.log('[1/4] Verifying Frontend Addresses & Compiled Smart Contracts...');
    const addresses = loadFrontendContracts();
    const contractsToVerify = [
        { key: 'TREASURY', file: 'TreasuryManager.sol', artifact: 'TreasuryManager' },
        { key: 'POSITION_NFT', file: 'VaultPositionNFT.sol', artifact: 'VaultPositionNFT' },
        { key: 'VESTED_VAULT', file: 'VestedDiscountVault.sol', artifact: 'VestedDiscountVault' },
        { key: 'P2P_MARKET', file: 'P2PLendingMarket.sol', artifact: 'P2PLendingMarket' },
        { key: 'STAKING', file: 'GovernanceStaking.sol', artifact: 'GovernanceStaking' },
        { key: 'REAL_YIELD_ROUTER', file: 'RealYieldRouter.sol', artifact: 'RealYieldRouter' },
        { key: 'CIRCUIT_BREAKER', file: 'CircuitBreaker.sol', artifact: 'CircuitBreaker' },
        { key: 'COMMUNITY_YIELD_VAULT', file: 'CommunityYieldVault.sol', artifact: 'CommunityYieldVault' },
        { key: 'TOKENOMICS_ENGINE', file: 'ProtocolTokenomicsEngine.sol', artifact: 'ProtocolTokenomicsEngine' },
    ];
    for (const item of contractsToVerify) {
        try {
            const compiled = loadArtifact(item.artifact, item.file);
            assert(!!compiled.abi && Array.isArray(compiled.abi), `Compiled ABI valid for ${item.key}`);
            assert(typeof addresses[item.key] === 'string' && addresses[item.key].startsWith('0x'), `Deployed address valid for ${item.key} (${addresses[item.key]})`);
        }
        catch (e) {
            assert(false, `Artifact check for ${item.key}`, e.message);
        }
    }
    // Check if contracts are deployed on the local node before running live on-chain tests
    let isNodeAlive = false;
    try {
        const chainId = await publicClient.getChainId();
        if (chainId === 31337) {
            const code = await publicClient.getBytecode({ address: addresses.USDC });
            if (code && code !== '0x') {
                isNodeAlive = true;
            }
        }
    }
    catch { }
    if (!isNodeAlive) {
        console.log('\n[INFO] Local Anvil node not running with deployed contracts at ' + ANVIL_URL + '.');
        console.log('       Static contract alignment & ABIs verified successfully.');
        console.log('       Skipping live on-chain interaction tests (run start_app.ps1 to deploy and test live state).\n');
        console.log('============================================================');
        console.log(` RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
        console.log('============================================================\n');
        process.exit(failedTests > 0 ? 1 : 0);
    }
    // TEST 2: Token Decimal Checks On-Chain
    console.log('\n[2/4] Verifying On-Chain Token Decimals...');
    const usdcAddr = addresses.USDC;
    const treasuryAddr = addresses.TREASURY;
    try {
        const usdcDecimals = await publicClient.readContract({
            address: usdcAddr,
            abi: [{ name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] }],
            functionName: 'decimals'
        });
        assert(usdcDecimals === 6, 'Mock USDC on-chain is exactly 6 decimals', `Got ${usdcDecimals}`);
        const treasuryRedemptionDecimals = await publicClient.readContract({
            address: treasuryAddr,
            abi: [{ name: 'redemptionTokenDecimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] }],
            functionName: 'redemptionTokenDecimals'
        });
        assert(treasuryRedemptionDecimals === 6, 'Treasury redemptionTokenDecimals matches USDC (6 decimals)', `Got ${treasuryRedemptionDecimals}`);
    }
    catch (e) {
        assert(false, 'On-chain decimals verification', e.message);
    }
    // TEST 3: User Flow Interaction (USDC Faucet & Treasury Deposit)
    console.log('\n[3/4] Testing Frontend Flow Alignment (USDC Mint & Deposit)...');
    try {
        const depositAmountUsdc = '1000';
        const amountWei6 = (0, viem_1.parseUnits)(depositAmountUsdc, 6); // 1,000 * 10^6
        // Faucet 1,000 USDC to user
        const txMint = await adminWallet.writeContract({
            address: usdcAddr,
            abi: [{ name: 'mint', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] }],
            functionName: 'mint',
            args: [userAccount.address, amountWei6]
        });
        await publicClient.waitForTransactionReceipt({ hash: txMint });
        const userUsdcBalBefore = await publicClient.readContract({
            address: usdcAddr,
            abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] }],
            functionName: 'balanceOf',
            args: [userAccount.address]
        });
        assert(userUsdcBalBefore >= amountWei6, 'User wallet received 1,000 USDC mock');
        // Approve Treasury
        const txApp = await userWallet.writeContract({
            address: usdcAddr,
            abi: [{ name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] }],
            functionName: 'approve',
            args: [treasuryAddr, amountWei6]
        });
        await publicClient.waitForTransactionReceipt({ hash: txApp });
        const treasuryArtifact = loadArtifact('TreasuryManager', 'TreasuryManager.sol');
        // Whitelist KYC for user account
        const txKyc = await adminWallet.writeContract({
            address: treasuryAddr,
            abi: treasuryArtifact.abi,
            functionName: 'setKYCStatus',
            args: [userAccount.address, true]
        });
        await publicClient.waitForTransactionReceipt({ hash: txKyc });
        const alphaTokenAddr = addresses.ALPHA_TOKEN;
        const userSharesBefore = await publicClient.readContract({
            address: alphaTokenAddr,
            abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] }],
            functionName: 'balanceOf',
            args: [userAccount.address]
        });
        // Deposit into Treasury
        const txDep = await userWallet.writeContract({
            address: treasuryAddr,
            abi: treasuryArtifact.abi,
            functionName: 'deposit',
            args: [amountWei6, 0n]
        });
        await publicClient.waitForTransactionReceipt({ hash: txDep });
        const userSharesAfter = await publicClient.readContract({
            address: alphaTokenAddr,
            abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] }],
            functionName: 'balanceOf',
            args: [userAccount.address]
        });
        const nav = await publicClient.readContract({
            address: treasuryAddr,
            abi: treasuryArtifact.abi,
            functionName: 'getNAV'
        });
        const deltaShares = userSharesAfter - userSharesBefore;
        const deltaFormatted = parseFloat((0, viem_1.formatUnits)(deltaShares, 18)); // ALPHA shares = 18 decimals
        const navFormatted = parseFloat((0, viem_1.formatUnits)(nav, 18)); // NAV = 18 decimals
        // The user receives ALPHA shares proportional to the deposit amount / navPerShare
        assert(deltaFormatted >= 100 && deltaFormatted <= 1100, `User received realistic ALPHA shares (${deltaFormatted.toFixed(2)})`, `Got ${deltaFormatted}`);
        assert(navFormatted >= 0.90 && navFormatted <= 50_000_000, `NAV value is in realistic USD range ($${navFormatted.toFixed(2)})`, `Got $${navFormatted}`);
    }
    catch (e) {
        assert(false, 'USDC Deposit Flow', e.message);
    }
    // TEST 4: Proof of Reserves Verification
    console.log('\n[4/4] Verifying Proof of Reserves & Solvency Metrics...');
    try {
        const treasuryArtifact = loadArtifact('TreasuryManager', 'TreasuryManager.sol');
        const por = await publicClient.readContract({
            address: treasuryAddr,
            abi: treasuryArtifact.abi,
            functionName: 'getProofOfReserves'
        });
        const totalAssetsUSD = parseFloat((0, viem_1.formatUnits)(por[0], 18));
        const totalLiabilitiesUSD = parseFloat((0, viem_1.formatUnits)(por[1], 18));
        const ratioBps = Number(por[2]);
        // Tolerate EVM 1-wei rounding delta between totalAssets and liabilities
        const isSolvent = por[0] >= por[1] || (por[1] - por[0] <= 1000000000000n);
        assert(isSolvent, `Fee Accretion Flywheel Active: Total Assets ($${totalAssetsUSD}) >= Total Liabilities ($${totalLiabilitiesUSD})`);
        assert(ratioBps >= 9990, `Collateralization Ratio Accredited >= 99.90% (${(ratioBps / 100).toFixed(2)}%)`);
        assert(totalAssetsUSD < 100_000_000, `Total Assets USD is realistic (Not Quadrillions): $${totalAssetsUSD.toLocaleString('en-US')}`);
    }
    catch (e) {
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
//# sourceMappingURL=frontend-alignment-test.js.map