const solc = require('solc');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function findImports(importPath) {
  let resolvedPath = '';
  if (importPath.startsWith('@openzeppelin/contracts/')) {
    resolvedPath = path.resolve(rootDir, 'contracts/src/lib', importPath.replace('@openzeppelin/contracts/', ''));
  } else if (importPath.startsWith('./lib/')) {
    resolvedPath = path.resolve(rootDir, 'contracts/src/lib', importPath.replace('./lib/', ''));
  } else if (importPath.startsWith('../lib/')) {
    resolvedPath = path.resolve(rootDir, 'contracts/src/lib', importPath.replace('../lib/', ''));
  } else if (importPath.startsWith('lib/')) {
    resolvedPath = path.resolve(rootDir, 'contracts/src/lib', importPath.replace('lib/', ''));
  } else if (path.isAbsolute(importPath)) {
    resolvedPath = importPath;
  } else {
    const p1 = path.resolve(rootDir, 'contracts/src', importPath);
    if (fs.existsSync(p1) || fs.existsSync(p1 + '.sol')) {
      resolvedPath = p1;
    } else {
      resolvedPath = path.resolve(rootDir, 'contracts/src/lib', importPath);
    }
  }
  if (!resolvedPath.endsWith('.sol') && fs.existsSync(resolvedPath + '.sol')) {
    resolvedPath += '.sol';
  }
  if (fs.existsSync(resolvedPath)) {
    return { contents: fs.readFileSync(resolvedPath, 'utf8') };
  }
  return { error: 'Not found: ' + importPath };
}

function compileContract(contractName, fileName) {
  const file = fileName || (contractName + '.sol');
  const possiblePaths = [
    path.resolve(rootDir, 'contracts/src', file),
    path.resolve(rootDir, 'contracts/src/lib', file),
    path.resolve(rootDir, 'contracts/test/mocks', file),
    path.resolve(rootDir, 'contracts/test', file),
    path.resolve(rootDir, 'contracts/src/adapters', file)
  ];
  const foundFile = possiblePaths.find((p) => fs.existsSync(p));
  if (!foundFile) {
    throw new Error(`[Compiler Error] Source file for ${contractName} not found in search paths.`);
  }

  const content = fs.readFileSync(foundFile, 'utf8');
  const baseName = path.basename(foundFile);
  const input = {
    language: 'Solidity',
    sources: { [baseName]: { content } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object']
        }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  if (output.errors && output.errors.some((e) => e.severity === 'error')) {
    throw new Error(`Failed to compile ${contractName}: ${JSON.stringify(output.errors)}`);
  }

  const contract = output.contracts[baseName][contractName] || Object.values(output.contracts[baseName])[0];
  const bytecodeObj = contract.evm.bytecode.object;
  const deployedBytecodeObj = contract.evm.deployedBytecode.object;

  const artifact = {
    abi: contract.abi,
    bytecode: { object: `0x${bytecodeObj.replace(/^0x/, '')}` },
    deployedBytecode: { object: `0x${deployedBytecodeObj.replace(/^0x/, '')}` }
  };

  const outDir = path.resolve(rootDir, `contracts/out/${baseName}`);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(path.join(outDir, `${contractName}.json`), JSON.stringify(artifact, null, 2));

  return artifact;
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
  compileContract,
  compileLibrary,
  compileTreasuryManager
};
