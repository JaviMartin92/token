const { createPublicClient, createWalletClient, http, parseUnits, formatEther } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const fs = require('fs');
const path = require('path');

const contracts = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'contracts.json'), 'utf8'));
const ANVIL_RPC = 'http://127.0.0.1:8545';
const publicClient = createPublicClient({ transport: http(ANVIL_RPC) });
const userAccount = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
const userWallet = createWalletClient({ account: userAccount, transport: http(ANVIL_RPC) });

const ERC20_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'mint', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] }
];
const TREASURY_ABI = [
  { name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [{ name: 'shares', type: 'uint256' }] }
];

async function debug() {
  const depositUsdc = parseUnits('10000', 6);
  await userWallet.writeContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'mint', args: [userAccount.address, depositUsdc] });
  await userWallet.writeContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'approve', args: [contracts.TREASURY, depositUsdc] });
  
  // Call simulate to get exact revert trace
  try {
    const res = await publicClient.simulateContract({
      account: userAccount.address,
      address: contracts.TREASURY,
      abi: TREASURY_ABI,
      functionName: 'deposit',
      args: [depositUsdc]
    });
    console.log("Simulate success:", res);
  } catch (err) {
    console.error("Simulate error:", err);
  }
}
debug();
