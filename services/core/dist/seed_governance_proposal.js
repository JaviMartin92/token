"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const contractsJson = JSON.parse(fs_1.default.readFileSync(path_1.default.resolve(__dirname, '../../../frontend/src/contracts.json'), 'utf8'));
const ANVIL_URL = process.env.ANVIL_URL || 'http://127.0.0.1:8545';
// Use Anvil Account #2 (0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC) which has 10,000 ETH prefunded on Anvil
const DELEGATE_KEY = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';
const delegateAccount = (0, accounts_1.privateKeyToAccount)(DELEGATE_KEY);
const localChain = {
    id: 31337,
    name: 'Anvil Localhost',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [ANVIL_URL] } }
};
const publicClient = (0, viem_1.createPublicClient)({
    chain: localChain,
    transport: (0, viem_1.http)(ANVIL_URL)
});
const delegateWallet = (0, viem_1.createWalletClient)({
    account: delegateAccount,
    chain: localChain,
    transport: (0, viem_1.http)(ANVIL_URL)
});
async function main() {
    console.log('[*] Seeding Governance Staking & Initial Proposal on Anvil...');
    const usdcAddr = contractsJson.USDC;
    const alphaToken = contractsJson.ALPHA_TOKEN;
    const stakingAddr = contractsJson.STAKING;
    const governorAddr = contractsJson.GOVERNOR;
    const treasuryAddr = contractsJson.TREASURY;
    // 1. Fund Delegate #9 with 50,000 USDC mock
    console.log('[*] Minting 50,000 USDC to Delegate #9...');
    const txMintUSDC = await delegateWallet.writeContract({
        address: usdcAddr,
        abi: [{ name: 'mint', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] }],
        functionName: 'mint',
        args: [delegateAccount.address, 50000n * 10n ** 6n]
    });
    await publicClient.waitForTransactionReceipt({ hash: txMintUSDC });
    // 2. Approve Treasury to deposit USDC
    const txApproveUSDC = await delegateWallet.writeContract({
        address: usdcAddr,
        abi: [{ name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] }],
        functionName: 'approve',
        args: [treasuryAddr, 50000n * 10n ** 6n]
    });
    await publicClient.waitForTransactionReceipt({ hash: txApproveUSDC });
    // 3. Deposit 50,000 USDC into TreasuryManager to receive fully-backed ALPHA shares (preserving NAV >= $1.00 and PoR = 100%)
    console.log('[*] Depositing 50,000 USDC into TreasuryManager to mint backed ALPHA...');
    const txDeposit = await delegateWallet.writeContract({
        address: treasuryAddr,
        abi: [{ name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'stableAmount', type: 'uint256' }, { name: 'minSharesOut', type: 'uint256' }], outputs: [{ name: 'sharesMinted', type: 'uint256' }] }],
        functionName: 'deposit',
        args: [50000n * 10n ** 6n, 0n]
    });
    await publicClient.waitForTransactionReceipt({ hash: txDeposit });
    // Check ALPHA balance of delegate
    const alphaBalance = await publicClient.readContract({
        address: alphaToken,
        abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }],
        functionName: 'balanceOf',
        args: [delegateAccount.address]
    });
    // 4. Approve GovernanceStaking to stake ALPHA
    console.log(`[*] Approving ${alphaBalance} ALPHA to GovernanceStaking...`);
    const txApprove = await delegateWallet.writeContract({
        address: alphaToken,
        abi: [{ name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] }],
        functionName: 'approve',
        args: [stakingAddr, alphaBalance]
    });
    await publicClient.waitForTransactionReceipt({ hash: txApprove });
    // 5. Stake ALPHA into GovernanceStaking to acquire stALPHA voting power
    console.log('[*] Staking ALPHA into GovernanceStaking for stALPHA voting power...');
    const txStake = await delegateWallet.writeContract({
        address: stakingAddr,
        abi: [{ name: 'stake', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] }],
        functionName: 'stake',
        args: [alphaBalance]
    });
    await publicClient.waitForTransactionReceipt({ hash: txStake });
    // 6. Advance 1 block on Anvil for checkpoint snapshot
    await publicClient.request({ method: 'evm_mine' });
    // 7. Submit Proposal #1 to GovernorAlphaCentauri
    console.log('[*] Submitting Proposal #1 to GovernorAlphaCentauri...');
    const weightsCalldata = (0, viem_1.encodeFunctionData)({
        abi: [{
                name: 'setTargetWeights',
                type: 'function',
                stateMutability: 'nonpayable',
                inputs: [
                    { name: 'usdcBps', type: 'uint256' },
                    { name: 'wbtcBps', type: 'uint256' },
                    { name: 'wethBps', type: 'uint256' },
                    { name: 'altsBps', type: 'uint256' }
                ],
                outputs: []
            }],
        functionName: 'setTargetWeights',
        args: [5000n, 2500n, 1250n, 1250n]
    });
    const txPropose = await delegateWallet.writeContract({
        address: governorAddr,
        abi: [{
                name: 'propose',
                type: 'function',
                stateMutability: 'nonpayable',
                inputs: [
                    { name: 'target', type: 'address' },
                    { name: 'value', type: 'uint256' },
                    { name: 'data', type: 'bytes' },
                    { name: 'description', type: 'string' }
                ],
                outputs: [{ name: 'proposalId', type: 'uint256' }]
            }],
        functionName: 'propose',
        args: [
            treasuryAddr,
            0n,
            weightsCalldata,
            'Ajuste Trimestral de Ponderaciones de Reserva (50% USDC / 25% WBTC / 12.5% WETH / 12.5% stALPHA)'
        ]
    });
    await publicClient.waitForTransactionReceipt({ hash: txPropose });
    console.log('[+] Proposal #1 created successfully on GovernorAlphaCentauri!');
    // 8. Advance 2 blocks to open voting period
    await publicClient.request({ method: 'evm_mine' });
    await publicClient.request({ method: 'evm_mine' });
    console.log('[+] Advanced blocks: Voting period is now ACTIVE on proposal #1.');
}
main().catch((err) => {
    console.error('Error seeding governance proposal:', err);
    process.exit(1);
});
//# sourceMappingURL=seed_governance_proposal.js.map