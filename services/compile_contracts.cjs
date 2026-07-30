const solc = require('solc');
const fs = require('fs');
const path = require('path');

function compileContract(filename, contractName, subfolder = '') {
  const filePath = path.resolve(__dirname, `../contracts/src/${filename}`);
  const sourceCode = fs.readFileSync(filePath, 'utf8');

  function findImports(importPath) {
    if (importPath.startsWith('@openzeppelin/contracts/')) {
      const actualPath = importPath.replace('@openzeppelin/contracts/', 'lib/');
      const fullPath = path.resolve(__dirname, `../contracts/src/${actualPath}`);
      if (fs.existsSync(fullPath)) {
        return { contents: fs.readFileSync(fullPath, 'utf8') };
      }
    }
    const relPath = path.resolve(path.dirname(filePath), importPath);
    if (fs.existsSync(relPath)) {
      return { contents: fs.readFileSync(relPath, 'utf8') };
    }
    return { error: 'File not found' };
  }

  const input = {
    language: 'Solidity',
    sources: {
      [filename]: { content: sourceCode }
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode']
        }
      },
      optimizer: { enabled: true, runs: 200 }
    }
  };

  console.log(`Compilando ${filename}...`);
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  if (output.errors) {
    const errs = output.errors.filter((e) => e.severity === 'error');
    if (errs.length > 0) {
      console.error(`Error compilando ${filename}:`, errs);
      throw new Error(`Fallo en compilación de ${filename}`);
    }
  }

  const compiled = output.contracts[filename][contractName];
  const artifactPath = path.resolve(__dirname, `../contracts/out/${subfolder ? subfolder + '/' : ''}${filename}/${contractName}.json`);
  
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  const existing = fs.existsSync(artifactPath) ? JSON.parse(fs.readFileSync(artifactPath, 'utf8')) : {};

  existing.abi = compiled.abi;
  existing.bytecode = { object: '0x' + compiled.evm.bytecode.object };

  fs.writeFileSync(artifactPath, JSON.stringify(existing, null, 2));
  console.log(`✅ Compilado y actualizado ${artifactPath}`);
}

try {
  compileContract('YieldStreamingVault.sol', 'YieldStreamingVault');
  compileContract('GovernanceStaking.sol', 'GovernanceStaking');
  compileContract('VestedDiscountVault.sol', 'VestedDiscountVault');
  compileContract('Treasury.sol', 'Treasury');
  console.log('🎉 Compilación de Smart Contracts completada con éxito!');
} catch (e) {
  console.error(e);
}
