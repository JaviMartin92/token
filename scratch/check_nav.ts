import { createPublicClient, http } from 'viem';
import { foundry } from 'viem/chains';
import contracts from '../frontend/src/contracts.json' assert { type: 'json' };
import { ABIS } from '../frontend/src/utils/web3.js';

const client = createPublicClient({ chain: foundry, transport: http('http://127.0.0.1:8545') });

async function check() {
  try {
    const overview: any = await client.readContract({
      address: contracts.TREASURY as `0x${string}`,
      abi: ABIS.TREASURY,
      functionName: 'getProtocolOverview'
    });
    console.log('--- OVERVIEW ---');
    console.log('totalAssetsUSD:', overview.totalAssetsUSD.toString());
    console.log('totalLiabilitiesUSD:', overview.totalLiabilitiesUSD.toString());
    console.log('collateralRatioBps:', overview.collateralRatioBps.toString());
    console.log('navPerShareUSD:', overview.navPerShareUSD.toString());
    console.log('netCirculatingShares:', overview.netCirculatingShares.toString());
  } catch (err) {
    console.error('ERROR IN OVERVIEW:', err);
  }
}
check();
