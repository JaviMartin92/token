import { createPublicClient, http } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const client = createPublicClient({ chain: arbitrumSepolia, transport: http('https://sepolia-rollup.arbitrum.io/rpc') });
  const user = '0x13c8510359aB6f3f9210d02260d924139B616630' as `0x${string}`;

  const txCount = await client.getTransactionCount({ address: user });
  console.log('Transaction Count (nonce):', txCount);

  const contracts = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'frontend/src/contracts.json'), 'utf8'));

  const erc20Abi = [{
    inputs: [{ type: 'address', name: 'owner' }, { type: 'address', name: 'spender' }],
    name: 'allowance',
    outputs: [{ type: 'uint256', name: '' }],
    stateMutability: 'view',
    type: 'function'
  }] as const;

  console.log('\n--- Checking VIRAJE allowances ---');
  for (const [name, addr] of Object.entries(contracts)) {
    if (addr && typeof addr === 'string' && addr.startsWith('0x') && addr !== contracts.VIRAJE_TOKEN) {
      try {
        const allow = await client.readContract({
          address: contracts.VIRAJE_TOKEN,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [user, addr as `0x${string}`]
        });
        if (allow > 0n) {
          console.log(`VIRAJE approved for ${name} (${addr}): ${Number(allow) / 1e18}`);
        }
      } catch(e) {}
    }
  }

  console.log('\n--- Checking NFT positions ---');
  const nftAbi = [{
    inputs: [{ type: 'address', name: 'owner' }],
    name: 'balanceOf',
    outputs: [{ type: 'uint256', name: '' }],
    stateMutability: 'view',
    type: 'function'
  }, {
    inputs: [{ type: 'uint256', name: 'tokenId' }],
    name: 'getPosition',
    outputs: [{
      type: 'tuple',
      name: '',
      components: [
        { name: 'id', type: 'uint256' },
        { name: 'underlyingAsset', type: 'address' },
        { name: 'depositTimestamp', type: 'uint64' },
        { name: 'lockYears', type: 'uint32' },
        { name: 'expirationTimestamp', type: 'uint64' },
        { name: 'isRagequitted', type: 'bool' },
        { name: 'isMaturedClaimed', type: 'bool' },
        { name: 'principalAmount', type: 'uint256' },
        { name: 'discountedPricePaid', type: 'uint256' }
      ]
    }],
    stateMutability: 'view',
    type: 'function'
  }] as const;

  const nftBal = await client.readContract({
    address: contracts.POSITION_NFT,
    abi: nftAbi,
    functionName: 'balanceOf',
    args: [user]
  });
  console.log('NFT Balance:', Number(nftBal));

  for (let i = 1n; i <= 5n; i++) {
    try {
      const pos = await client.readContract({
        address: contracts.POSITION_NFT,
        abi: nftAbi,
        functionName: 'getPosition',
        args: [i]
      });
      console.log(`Position #${i}: Principal=$${Number(pos.principalAmount)/1e6}, Discounted=$${Number(pos.discountedPricePaid)/1e6}, Ragequitted=${pos.isRagequitted}, Claimed=${pos.isMaturedClaimed}`);
    } catch(e) {}
  }
}

main().catch(console.error);
