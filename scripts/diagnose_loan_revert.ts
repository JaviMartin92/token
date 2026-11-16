import { createPublicClient, http, formatUnits } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';

async function test() {
  const rootDir = path.resolve(__dirname, '..');
  const contractsPath = path.resolve(rootDir, 'frontend/src/contracts.json');
  const contracts = JSON.parse(fs.readFileSync(contractsPath, 'utf8'));

  const user = '0x13c8510359aB6f3f9210d02260d924139B616630' as `0x${string}`;
  const client = createPublicClient({
    chain: arbitrumSepolia,
    transport: http('https://sepolia-rollup.arbitrum.io/rpc')
  });

  const p2p = contracts.P2P_MARKET as `0x${string}`;
  const treasury = contracts.TREASURY as `0x${string}`;

  const treasuryAbi = [{
    inputs: [],
    name: 'treasuryLoanLimits',
    outputs: [
      { name: 'limit', type: 'uint256' },
      { name: 'outstanding', type: 'uint256' },
      { name: 'capacity', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  }] as const;

  const [limit, outstanding, capacity] = await client.readContract({
    address: treasury,
    abi: treasuryAbi,
    functionName: 'treasuryLoanLimits'
  });

  console.log('Treasury Loan Limits:');
  console.log(`  Limit: $${formatUnits(limit, 6)} USDC`);
  console.log(`  Outstanding: $${formatUnits(outstanding, 6)} USDC`);
  console.log(`  Capacity: $${formatUnits(capacity, 6)} USDC`);

  const p2pAbi = [{
    inputs: [],
    name: 'circularCollateralCapBps',
    outputs: [{ type: 'uint256', name: '' }],
    stateMutability: 'view',
    type: 'function'
  }, {
    inputs: [],
    name: 'treasuryCircularDebtUSD',
    outputs: [{ type: 'uint256', name: '' }],
    stateMutability: 'view',
    type: 'function'
  }] as const;

  const circularCapBps = await client.readContract({
    address: p2p,
    abi: p2pAbi,
    functionName: 'circularCollateralCapBps'
  });

  const circularDebt = await client.readContract({
    address: p2p,
    abi: p2pAbi,
    functionName: 'treasuryCircularDebtUSD'
  });

  const circularLimit = (limit * circularCapBps) / 10000n;
  const circularCapacity = circularLimit > circularDebt ? circularLimit - circularDebt : 0n;

  console.log('P2P Circular Collateral Limits:');
  console.log(`  Circular Cap Bps: ${circularCapBps} (${Number(circularCapBps)/100}%)`);
  console.log(`  Circular Debt: $${formatUnits(circularDebt, 6)} USDC`);
  console.log(`  Circular Limit: $${formatUnits(circularLimit, 6)} USDC`);
  console.log(`  Circular Capacity: $${formatUnits(circularCapacity, 6)} USDC`);

  // Let's test binary search for max borrow on NFT #1
  const p2pFullAbi = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'contracts/out/P2PLendingMarket.sol/P2PLendingMarket.json'), 'utf8')).abi;
  for (let amt = 2120n; amt <= 2126n; amt++) {
    const amtWei = amt * 1000000n;
    try {
      await client.simulateContract({
        address: p2p,
        abi: p2pFullAbi,
        functionName: 'borrowFromTreasury',
        args: [1n, amtWei, 30n],
        account: user
      });
      console.log(`  [SIMULATION OK] ${amt} USDC`);
    } catch(err: any) {
      console.log(`  [SIMULATION REVERT] ${amt} USDC: ${err.message?.substring(0, 100)}`);
    }
  }
}

test().catch(console.error);
