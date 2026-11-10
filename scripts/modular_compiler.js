const solc = require('solc');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function findImports(importPath) {
  if (importPath.startsWith('@openzeppelin/contracts/')) {
    const p = path.resolve(rootDir, 'contracts/src/lib', importPath.replace('@openzeppelin/contracts/', ''));
    const f = p.endsWith('.sol') ? p : p + '.sol';
    if (fs.existsSync(f)) return { contents: fs.readFileSync(f, 'utf8') };
  }
  const p1 = path.resolve(rootDir, 'contracts/src', importPath);
  if (fs.existsSync(p1)) return { contents: fs.readFileSync(p1, 'utf8') };
  const p2 = path.resolve(rootDir, 'contracts/src/lib', importPath);
  if (fs.existsSync(p2)) return { contents: fs.readFileSync(p2, 'utf8') };
  return { error: 'Not found: ' + importPath };
}

function compileLibrary(libName) {
  const libFile = path.resolve(rootDir, `contracts/src/lib/${libName}.sol`);
  const content = fs.readFileSync(libFile, 'utf8');
  const input = {
    language: 'Solidity',
    sources: { [`${libName}.sol`]: { content } },
    settings: {
      optimizer: { enabled: true, runs: 1 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } }
    }
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  if (output.errors && output.errors.some((e) => e.severity === 'error')) {
    throw new Error(`Failed to compile ${libName}: ${JSON.stringify(output.errors)}`);
  }
  const contract = output.contracts[`${libName}.sol`][libName];
  return {
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object.replace(/^0x/, '')}`
  };
}

function compileTreasuryManager(libraries) {
  const tmSource = fs.readFileSync(path.resolve(rootDir, 'contracts/src/TreasuryManager.sol'), 'utf8');
  const input = {
    language: 'Solidity',
    sources: { 'TreasuryManager.sol': { content: tmSource } },
    settings: {
      optimizer: { enabled: true, runs: 1 },
      libraries: {
        'lib/TreasuryFeeLib.sol': { TreasuryFeeLib: libraries.TreasuryFeeLib },
        'lib/TreasuryLiquidityLib.sol': { TreasuryLiquidityLib: libraries.TreasuryLiquidityLib },
        'lib/TreasuryPoRLib.sol': { TreasuryPoRLib: libraries.TreasuryPoRLib },
        'lib/TreasuryRebalanceLib.sol': { TreasuryRebalanceLib: libraries.TreasuryRebalanceLib }
      },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object', 'evm.bytecode.linkReferences']
        }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  if (output.errors && output.errors.some((e) => e.severity === 'error')) {
    throw new Error(`Failed to compile TreasuryManager: ${JSON.stringify(output.errors)}`);
  }

  const contract = output.contracts['TreasuryManager.sol']['TreasuryManager'];
  const bytecodeObj = contract.evm.bytecode.object;
  const deployedBytecodeObj = contract.evm.deployedBytecode.object;

  return {
    abi: contract.abi,
    bytecode: `0x${bytecodeObj.replace(/^0x/, '')}`,
    deployedBytecode: `0x${deployedBytecodeObj.replace(/^0x/, '')}`,
    runtimeSize: deployedBytecodeObj.replace(/^0x/, '').length / 2
  };
}

module.exports = {
  compileLibrary,
  compileTreasuryManager
};
