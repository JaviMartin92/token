import { createPublicClient, createWalletClient, http, parseEther, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';

const contractsJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../frontend/src/contracts.json'), 'utf8')
);

const ANVIL_URL = process.env.ANVIL_URL || 'http://127.0.0.1:8545';
const OPERATOR_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const account = privateKeyToAccount(OPERATOR_KEY);

const localChain = {
  id: 31337,
  name: 'Anvil Localhost',
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

async function main() {
  console.log('[*] Seeding Governance Staking & Initial Proposal on Anvil...');

  const alphaToken = contractsJson.ALPHA_TOKEN as `0x${string}`;
  const stakingAddr = contractsJson.STAKING as `0x${string}`;
  const governorAddr = contractsJson.GOVERNOR as `0x${string}`;
  const treasuryAddr = contractsJson.TREASURY as `0x${string}`;

  // 1. Mint 100,000 ALPHA to Account #0
  console.log('[*] Minting 100,000 ALPHA to Account #0...');
  const txMint = await walletClient.writeContract({
    address: alphaToken,
    abi: [{ name: 'mint', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] }],
    functionName: 'mint',
    args: [account.address, parseEther('100000')]
  });
  await publicClient.waitForTransactionReceipt({ hash: txMint });

  // 2. Approve GovernanceStaking to spend 50,000 ALPHA
  console.log('[*] Approving ALPHA to GovernanceStaking...');
  const txApprove = await walletClient.writeContract({
    address: alphaToken,
    abi: [{ name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] }],
    functionName: 'approve',
    args: [stakingAddr, parseEther('50000')]
  });
  await publicClient.waitForTransactionReceipt({ hash: txApprove });

  // 3. Stake 50,000 ALPHA into GovernanceStaking
  console.log('[*] Staking 50,000 ALPHA into GovernanceStaking (50,000 stALPHA)...');
  const txStake = await walletClient.writeContract({
    address: stakingAddr,
    abi: [{ name: 'stake', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] }],
    functionName: 'stake',
    args: [parseEther('50000')]
  });
  await publicClient.waitForTransactionReceipt({ hash: txStake });

  // 4. Advance 1 block on Anvil for checkpoint snapshot
  await publicClient.request({ method: 'evm_mine' as any });

  // 5. Submit Proposal #1 to GovernorAlphaCentauri
  console.log('[*] Submitting Proposal #1 to GovernorAlphaCentauri...');
  const weightsCalldata = encodeFunctionData({
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
    }] as const,
    functionName: 'setTargetWeights',
    args: [5000n, 2500n, 1250n, 1250n]
  });

  const txPropose = await walletClient.writeContract({
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

  // 6. Advance 2 blocks to open voting period
  await publicClient.request({ method: 'evm_mine' as any });
  await publicClient.request({ method: 'evm_mine' as any });
  console.log('[+] Advanced blocks: Voting period is now ACTIVE on proposal #1.');
}

main().catch((err) => {
  console.error('Error seeding governance proposal:', err);
  process.exit(1);
});
