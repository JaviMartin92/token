const solc = require('solc');
const fs = require('fs');
const path = require('path');

let porLibSource = fs.readFileSync('contracts/src/lib/TreasuryPoRLib.sol', 'utf8');
porLibSource = porLibSource.replaceAll('internal view', 'public view').replaceAll('internal pure', 'public pure').replaceAll('internal', 'public');

let rebalanceLibSource = fs.readFileSync('contracts/src/lib/TreasuryRebalanceLib.sol', 'utf8');
rebalanceLibSource = rebalanceLibSource.replaceAll('internal', 'public');

let liqLibSource = fs.readFileSync('contracts/src/lib/TreasuryLiquidityLib.sol', 'utf8');
liqLibSource = liqLibSource.replaceAll('internal', 'public');

let feeLibSource = fs.readFileSync('contracts/src/lib/TreasuryFeeLib.sol', 'utf8');
feeLibSource = feeLibSource.replaceAll('internal', 'public');

function findImports(importPath) {
  if (importPath.endsWith('TreasuryPoRLib.sol')) return { contents: porLibSource };
  if (importPath.endsWith('TreasuryRebalanceLib.sol')) return { contents: rebalanceLibSource };
  if (importPath.endsWith('TreasuryLiquidityLib.sol')) return { contents: liqLibSource };
  if (importPath.endsWith('TreasuryFeeLib.sol')) return { contents: feeLibSource };

  let resolved;
  if (importPath.startsWith('@openzeppelin/contracts/')) {
    resolved = path.resolve('contracts/src/lib', importPath.replace('@openzeppelin/contracts/', ''));
  } else {
    resolved = path.resolve('contracts/src', importPath);
  }
  if (!resolved.endsWith('.sol')) resolved += '.sol';
  if (fs.existsSync(resolved)) return { contents: fs.readFileSync(resolved, 'utf8') };
  return { error: 'Not found: ' + resolved };
}

let tmSource = fs.readFileSync('contracts/src/TreasuryManager.sol', 'utf8');

const { createPublicClient, http, encodeDeployData } = require('../frontend/node_modules/viem');
const { arbitrumSepolia } = require('../frontend/node_modules/viem/chains');

const dummy = '0x1111111111111111111111111111111111111111';

const input = {
  language: 'Solidity',
  sources: { 'TreasuryManager.sol': { content: tmSource } },
  settings: {
    optimizer: { enabled: true, runs: 1 },
    libraries: {
      'lib/TreasuryFeeLib.sol': { 'TreasuryFeeLib': dummy },
      'lib/TreasuryLiquidityLib.sol': { 'TreasuryLiquidityLib': dummy },
      'lib/TreasuryPoRLib.sol': { 'TreasuryPoRLib': dummy },
      'lib/TreasuryRebalanceLib.sol': { 'TreasuryRebalanceLib': dummy }
    },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object', 'evm.bytecode.linkReferences'] } }
  }
};

const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
if (out.contracts && out.contracts['TreasuryManager.sol']) {
  const tm = out.contracts['TreasuryManager.sol']['TreasuryManager'];
  const deployBytes = tm.evm.bytecode.object.length / 2;
  const runtimeBytes = tm.evm.deployedBytecode.object.length / 2;
  console.log('Unlinked refs remaining:', Object.keys(tm.evm.bytecode.linkReferences).length);
  console.log('Deploy bytecode size:', deployBytes, 'bytes');
  console.log('Runtime bytecode size (EIP-170 limit is 24576):', runtimeBytes, 'bytes');
  if (runtimeBytes <= 24576) {
    console.log('🎉 SUCCESS! IT FITS UNDER 24,576 BYTES! Room to spare:', 24576 - runtimeBytes, 'bytes');
  }

  async function testGas() {
    const client = createPublicClient({ chain: arbitrumSepolia, transport: http('https://sepolia-rollup.arbitrum.io/rpc') });
    const deployData = encodeDeployData({
      abi: tm.abi,
      bytecode: '0x' + tm.evm.bytecode.object,
      args: [dummy]
    });
    console.log('Deploy data length:', deployData.length);
    try {
      const gas = await client.estimateGas({ data: deployData, account: dummy });
      console.log('🎉 ESTIMATE GAS ON ARBITRUM SEPOLIA SUCCESS! Gas:', gas.toString());
    } catch(e) {
      console.error('EstimateGas failed:', e);
    }
  }
  testGas();
} else {
  console.log('Error:', out.errors);
}
