const { createPublicClient, http, formatEther } = require('viem');
const { anvil } = require('viem/chains');
const contracts = require('./src/contracts.json');

async function test() {
  const client = createPublicClient({ chain: anvil, transport: http('http://127.0.0.1:8545') });
  const abi = [
    { name: 'trackedAssets', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] },
    { name: 'priceFeeds', type: 'function', stateMutability: 'view', inputs: [{ name: 'asset', type: 'address' }], outputs: [{ name: '', type: 'address' }] },
    { name: 'assetDecimals', type: 'function', stateMutability: 'view', inputs: [{ name: 'asset', type: 'address' }], outputs: [{ name: '', type: 'uint8' }] },
    { name: 'getAssetValue', type: 'function', stateMutability: 'view', inputs: [{ name: 'asset', type: 'address' }, { name: 'feed', type: 'address' }, { name: 'decimals_', type: 'uint8' }], outputs: [{ name: '', type: 'uint256' }] }
  ];

  const erc20Abi = [{ inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' }];

  for (let i = 0; i < 5; i++) {
    try {
      const asset = await client.readContract({ address: contracts.TREASURY, abi, functionName: 'trackedAssets', args: [BigInt(i)] });
      const feed = await client.readContract({ address: contracts.TREASURY, abi, functionName: 'priceFeeds', args: [asset] });
      const decs = await client.readContract({ address: contracts.TREASURY, abi, functionName: 'assetDecimals', args: [asset] });
      const bal = await client.readContract({ address: asset, abi: erc20Abi, functionName: 'balanceOf', args: [contracts.TREASURY] });
      const val = await client.readContract({ address: contracts.TREASURY, abi, functionName: 'getAssetValue', args: [asset, feed, decs] });
      console.log('Asset #' + i + ':', asset, '| Feed:', feed, '| Decimals:', decs, '| Balance:', formatEther(bal), '| ValueUSD:', formatEther(val));
    } catch (e) {
      console.log('End of trackedAssets at index', i);
      break;
    }
  }
}
test().catch(console.error);
