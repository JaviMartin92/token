import { createPublicClient, createWalletClient, http, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import fs from 'fs';
import path from 'path';

const rootDir = path.resolve(__dirname, '..');
const RPC_URL = process.env.ARBITRUM_SEPOLIA_RPC_URL || process.env.VITE_PUBLIC_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc';

async function main() {
  const privateKey = (
    process.env.DEPLOYER_KEY ||
    process.env.PRIVATE_KEY ||
    process.env.BACKEND_OPERATOR_PRIVATE_KEY ||
    ''
  ).trim();

  if (!privateKey) {
    console.error('❌ Error: Configura la variable de entorno DEPLOYER_KEY o pásala antes de ejecutar.');
    console.error('Ejemplo: $env:DEPLOYER_KEY="0x..."; npx tsx scripts/mint_tokens.ts --to 0xAmigo --amount 50000');
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const contractsJsonPath = path.resolve(rootDir, 'frontend/src/contracts.json');
  if (!fs.existsSync(contractsJsonPath)) {
    console.error('❌ Error: No se encontró contracts.json. Despliega primero con deploy:sepolia.');
    process.exit(1);
  }
  const contracts = JSON.parse(fs.readFileSync(contractsJsonPath, 'utf8'));

  // Parse args
  const args = process.argv.slice(2);
  let recipient = account.address;
  let amountStr = '100000';
  let tokenType = 'USDC';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--to' && args[i + 1]) recipient = args[++i] as `0x${string}`;
    if (args[i] === '--amount' && args[i + 1]) amountStr = args[++i];
    if (args[i] === '--token' && args[i + 1]) tokenType = args[++i].toUpperCase();
  }

  const tokenAddr = contracts[tokenType] as `0x${string}`;
  if (!tokenAddr) {
    console.error(`❌ Error: Token ${tokenType} no encontrado en contracts.json.`);
    process.exit(1);
  }

  const decimals = tokenType === 'WBTC' ? 8 : 6;
  const amountWei = parseUnits(amountStr, decimals);

  const erc20Abi = [
    {
      name: 'mint',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
      outputs: []
    },
    {
      name: 'balanceOf',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'account', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }]
    }
  ] as const;

  const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, chain: arbitrumSepolia, transport: http(RPC_URL) });

  console.log(`[*] Minteando ${amountStr} ${tokenType} para ${recipient}...`);
  const tx = await walletClient.writeContract({
    address: tokenAddr,
    abi: erc20Abi,
    functionName: 'mint',
    args: [recipient, amountWei],
    account
  });
  console.log(`    Transacción enviada: https://sepolia.arbiscan.io/tx/${tx}`);
  await publicClient.waitForTransactionReceipt({ hash: tx });

  const newBal = await publicClient.readContract({
    address: tokenAddr,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [recipient]
  });

  console.log(`✅ ¡Éxito! Nuevo saldo de ${recipient}: ${formatUnits(newBal, decimals)} ${tokenType}`);
}

main().catch((err) => {
  console.error('❌ Error al mintear tokens:', err);
  process.exit(1);
});
