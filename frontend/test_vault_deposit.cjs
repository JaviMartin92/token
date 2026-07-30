const { createPublicClient, createWalletClient, http, parseEther, formatEther } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { arbitrum } = require('viem/chains');
const fs = require('fs');
const path = require('path');

const ANVIL_URL = 'http://127.0.0.1:8545';
const contractsJsonPath = path.resolve(__dirname, './src/contracts.json');
const contracts = JSON.parse(fs.readFileSync(contractsJsonPath, 'utf8'));

const ADMIN_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const USER_KEY  = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

const adminAccount = privateKeyToAccount(ADMIN_KEY);
const userAccount  = privateKeyToAccount(USER_KEY);

const publicClient = createPublicClient({ chain: arbitrum, transport: http(ANVIL_URL) });
const adminClient  = createWalletClient({ account: adminAccount, chain: arbitrum, transport: http(ANVIL_URL) });
const userClient   = createWalletClient({ account: userAccount, chain: arbitrum, transport: http(ANVIL_URL) });

const ERC20_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'mint', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] }
];

const TREASURY_ABI = [
  { name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'stableAmount', type: 'uint256' }], outputs: [{ name: 'sharesMinted', type: 'uint256' }] }
];

const ROUTER_ABI = [
  { name: 'corporateOpExVault', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { name: 'corporateProfitVault', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] }
];

async function run() {
  await adminClient.writeContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'mint', args: [userAccount.address, parseEther('20000')] });
  await userClient.writeContract({ address: contracts.USDC, abi: ERC20_ABI, functionName: 'approve', args: [contracts.TREASURY, parseEther('20000')] });

  const opExAddr = await publicClient.readContract({ address: contracts.REAL_YIELD_ROUTER, abi: ROUTER_ABI, functionName: 'corporateOpExVault' });
  const profitAddr = await publicClient.readContract({ address: contracts.REAL_YIELD_ROUTER, abi: ROUTER_ABI, functionName: 'corporateProfitVault' });

  const opExBefore = await publicClient.readContract({ address: contracts.TREASURY, abi: ERC20_ABI, functionName: 'balanceOf', args: [opExAddr] });
  const profitBefore = await publicClient.readContract({ address: contracts.TREASURY, abi: ERC20_ABI, functionName: 'balanceOf', args: [profitAddr] });

  console.log('Depositing $20,000 USDC into Treasury...');
  const tx = await userClient.writeContract({ address: contracts.TREASURY, abi: TREASURY_ABI, functionName: 'deposit', args: [parseEther('20000')] });
  await publicClient.waitForTransactionReceipt({ hash: tx });

  const opExAfter = await publicClient.readContract({ address: contracts.TREASURY, abi: ERC20_ABI, functionName: 'balanceOf', args: [opExAddr] });
  const profitAfter = await publicClient.readContract({ address: contracts.TREASURY, abi: ERC20_ABI, functionName: 'balanceOf', args: [profitAddr] });

  console.log('OpEx Vault ALPHA Balance Increment  :', formatEther(opExAfter - opExBefore));
  console.log('Profit Vault ALPHA Balance Increment:', formatEther(profitAfter - profitBefore));
}

run().catch(console.error);
