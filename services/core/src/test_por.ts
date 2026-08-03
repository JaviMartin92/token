import { createPublicClient, http } from 'viem';
import { arbitrum } from 'viem/chains';
import fs from 'fs';
import path from 'path';

async function main() {
  const pc = createPublicClient({ chain: arbitrum, transport: http('http://localhost:8545') });
  const p = path.resolve(__dirname, '../../frontend/src/contracts.json');
  const addrs = JSON.parse(fs.readFileSync(p, 'utf8'));
  const abi = [{ name: 'getProofOfReserves', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }] }];
  const res = await pc.readContract({ address: addrs.TREASURY, abi, functionName: 'getProofOfReserves' });
  console.log(res);
}
main();
