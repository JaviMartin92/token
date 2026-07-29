"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
const chains_1 = require("viem/chains");
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../../../.env') });
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
// Load artifacts
function loadArtifact(name, file) {
    return JSON.parse(fs_1.default.readFileSync(path_1.default.resolve(__dirname, `../../../contracts/out/${file}/${name}.json`), 'utf8'));
}
async function main() {
    // Load addresses from .env
    const usdcAddr = '0x641b24b0537b3b539604092db57a1c3fe4253a26'; // Mock USDC deployed in setup
    const corpAddr = process.env.CORP_CONTRIBUTION_ADDRESS;
    if (!corpAddr) {
        console.error('[!] Deployed contract addresses not found in .env');
        process.exit(1);
    }
    console.log(`[+] Found deployed CorporateContribution contract at: ${corpAddr}`);
    const MockERC20 = loadArtifact('MockERC20', 'Treasury.t.sol');
    const CorporateContribution = loadArtifact('CorporateContribution', 'CorporateContribution.sol');
    console.log('[*] Minting 2,500 USDC to operator...');
    const mintTx = await walletClient.writeContract({
        address: usdcAddr,
        abi: MockERC20.abi,
        functionName: 'mint',
        args: [account.address, (0, viem_1.parseEther)('2500')]
    });
    await publicClient.waitForTransactionReceipt({ hash: mintTx });
    console.log('[*] Approving CorporateContribution contract...');
    const approveTx = await walletClient.writeContract({
        address: usdcAddr,
        abi: MockERC20.abi,
        functionName: 'approve',
        args: [corpAddr, (0, viem_1.parseEther)('2500')]
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
    console.log('[*] Calling injectFunds() on-chain...');
    const injectTx = await walletClient.writeContract({
        address: corpAddr,
        abi: CorporateContribution.abi,
        functionName: 'injectFunds',
        args: [(0, viem_1.parseEther)('2500'), 'LIVE_STATEMENT_Q4_AUDIT']
    });
    console.log(`[+] Sent transaction hash: ${injectTx}`);
    console.log('[*] Waiting for transaction receipt...');
    const receipt = await publicClient.waitForTransactionReceipt({ hash: injectTx });
    console.log(`[+] Transaction successfully mined in block ${receipt.blockNumber}!`);
    process.exit(0);
}
main().catch(console.error);
//# sourceMappingURL=trigger-injection.js.map