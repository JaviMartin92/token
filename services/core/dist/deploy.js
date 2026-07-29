"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
const chains_1 = require("viem/chains");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ANVIL_URL = process.env.ANVIL_URL || 'http://localhost:8545';
const OPERATOR_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const account = (0, accounts_1.privateKeyToAccount)(OPERATOR_KEY);
const publicClient = (0, viem_1.createPublicClient)({
    chain: chains_1.arbitrum,
    transport: (0, viem_1.http)(ANVIL_URL)
});
const walletClient = (0, viem_1.createWalletClient)({
    account,
    chain: chains_1.arbitrum,
    transport: (0, viem_1.http)(ANVIL_URL)
});
function loadArtifact(name, file) {
    const p = path_1.default.resolve(__dirname, `../../../contracts/out/${file}/${name}.json`);
    if (!fs_1.default.existsSync(p)) {
        throw new Error(`Artifact not found at ${p}. Run forge compile first.`);
    }
    return JSON.parse(fs_1.default.readFileSync(p, 'utf8'));
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
    const usdcAddr = (await publicClient.waitForTransactionReceipt({ hash: usdcTx })).contractAddress;
    console.log(`[+] Mock USDC deployed at: ${usdcAddr}`);
    const usdtTx = await walletClient.deployContract({
        abi: MockERC20.abi,
        bytecode: MockERC20.bytecode.object,
        args: ['Tether USD', 'USDT']
    });
    const usdtAddr = (await publicClient.waitForTransactionReceipt({ hash: usdtTx })).contractAddress;
    console.log(`[+] Mock USDT deployed at: ${usdtAddr}`);
    // 2. Deploy Mock Feed
    const feedTx = await walletClient.deployContract({
        abi: MockChainlinkFeed.abi,
        bytecode: MockChainlinkFeed.bytecode.object,
        args: [8, 100000000n]
    });
    const feedAddr = (await publicClient.waitForTransactionReceipt({ hash: feedTx })).contractAddress;
    console.log(`[+] Mock Price Feed deployed at: ${feedAddr}`);
    // 3. Deploy Mock Swap Router
    const routerTx = await walletClient.deployContract({
        abi: MockSwapRouter.abi,
        bytecode: MockSwapRouter.bytecode.object,
        args: [usdcAddr, address(0x999)]
    });
    const routerAddr = (await publicClient.waitForTransactionReceipt({ hash: routerTx })).contractAddress;
    console.log(`[+] Mock Swap Router deployed at: ${routerAddr}`);
    // 4. Deploy Treasury
    const treasuryTx = await walletClient.deployContract({
        abi: Treasury.abi,
        bytecode: Treasury.bytecode.object,
        args: [account.address, usdcAddr, 18]
    });
    const treasuryAddr = (await publicClient.waitForTransactionReceipt({ hash: treasuryTx })).contractAddress;
    console.log(`[+] Treasury Contract deployed at: ${treasuryAddr}`);
    // 5. Deploy CircuitBreaker
    const cbTx = await walletClient.deployContract({
        abi: CircuitBreaker.abi,
        bytecode: CircuitBreaker.bytecode.object,
        args: [account.address]
    });
    const cbAddr = (await publicClient.waitForTransactionReceipt({ hash: cbTx })).contractAddress;
    console.log(`[+] CircuitBreaker Contract deployed at: ${cbAddr}`);
    // 6. Deploy AtomicSwapReceiver
    const swapTx = await walletClient.deployContract({
        abi: AtomicSwapReceiver.abi,
        bytecode: AtomicSwapReceiver.bytecode.object,
        args: [usdtAddr, usdcAddr, routerAddr, treasuryAddr, account.address]
    });
    const swapAddr = (await publicClient.waitForTransactionReceipt({ hash: swapTx })).contractAddress;
    console.log(`[+] AtomicSwapReceiver Contract deployed at: ${swapAddr}`);
    // 7. Deploy YieldStreamingVault
    const yieldTx = await walletClient.deployContract({
        abi: YieldStreamingVault.abi,
        bytecode: YieldStreamingVault.bytecode.object,
        args: [usdcAddr, account.address]
    });
    const yieldAddr = (await publicClient.waitForTransactionReceipt({ hash: yieldTx })).contractAddress;
    console.log(`[+] YieldStreamingVault Contract deployed at: ${yieldAddr}`);
    // 8. Deploy CorporateContribution
    const corpTx = await walletClient.deployContract({
        abi: CorporateContribution.abi,
        bytecode: CorporateContribution.bytecode.object,
        args: [usdcAddr, address(0x999), address(0x888), routerAddr, account.address]
    });
    const corpAddr = (await publicClient.waitForTransactionReceipt({ hash: corpTx })).contractAddress;
    console.log(`[+] CorporateContribution Contract deployed at: ${corpAddr}`);
    // Configure tracked asset
    const setTrackedHash = await walletClient.writeContract({
        address: treasuryAddr,
        abi: Treasury.abi,
        functionName: 'setTrackedAsset',
        args: [usdcAddr, feedAddr, 18]
    });
    await publicClient.waitForTransactionReceipt({ hash: setTrackedHash });
    console.log('[+] Configured USDC as tracked asset in Treasury.');
    // Write addresses to root .env file
    const envPath = path_1.default.resolve(__dirname, '../../../../.env');
    let envContent = '';
    if (fs_1.default.existsSync(envPath)) {
        envContent = fs_1.default.readFileSync(envPath, 'utf8');
    }
    // Helper to replace or append env vars
    function updateEnvVar(key, value) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `${key}=${value}`);
        }
        else {
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
    fs_1.default.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
    console.log('[+] Deployed contract addresses written to root .env file with VITE_ prefixes.');
    process.exit(0);
}
function address(val) {
    return `0x${val.toString(16).padStart(40, '0')}`;
}
main().catch((error) => {
    console.error('[!] Deployment failed:', error);
    process.exit(1);
});
//# sourceMappingURL=deploy.js.map