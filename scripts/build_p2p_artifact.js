const solc = require('solc');
const fs = require('fs');
const path = require('path');

function findImports(importPath) {
  if (importPath.startsWith('@openzeppelin/contracts/')) {
    const p = path.resolve('contracts/src/lib', importPath.replace('@openzeppelin/contracts/', ''));
    const f = p.endsWith('.sol') ? p : p + '.sol';
    if (fs.existsSync(f)) return { contents: fs.readFileSync(f, 'utf8') };
  }
  const p1 = path.resolve('contracts/src', importPath);
  if (fs.existsSync(p1)) return { contents: fs.readFileSync(p1, 'utf8') };
  const p2 = path.resolve('contracts/src/lib', importPath);
  if (fs.existsSync(p2)) return { contents: fs.readFileSync(p2, 'utf8') };
  return { error: 'Not found: ' + importPath };
}

console.log('[*] Compilando P2PLendingMarket.sol con optimizador (runs: 1)...');
const content = fs.readFileSync('contracts/src/P2PLendingMarket.sol', 'utf8');

const input = {
  language: 'Solidity',
  sources: { 'P2PLendingMarket.sol': { content } },
  settings: {
    optimizer: { enabled: true, runs: 1 },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode', 'metadata']
      }
    }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
if (output.errors && output.errors.some(e => e.severity === 'error')) {
  console.error('Compilation errors:', output.errors.filter(e => e.severity === 'error'));
  process.exit(1);
}

const contract = output.contracts['P2PLendingMarket.sol']['P2PLendingMarket'];
const runtimeSize = contract.evm.deployedBytecode.object.length / 2;
console.log(`[+] Runtime size de P2PLendingMarket: ${runtimeSize} bytes (Límite EIP-170: 24,576 bytes)`);

if (runtimeSize > 24576) {
  console.error(`[ERROR] P2PLendingMarket excede el límite EIP-170 por ${runtimeSize - 24576} bytes.`);
  process.exit(1);
}

const artifactDir = path.resolve('contracts/out/P2PLendingMarket.sol');
if (!fs.existsSync(artifactDir)) {
  fs.mkdirSync(artifactDir, { recursive: true });
}

const artifactPath = path.join(artifactDir, 'P2PLendingMarket.json');
const artifactData = {
  abi: contract.abi,
  bytecode: {
    object: '0x' + contract.evm.bytecode.object.replace(/^0x/, '')
  },
  deployedBytecode: {
    object: '0x' + contract.evm.deployedBytecode.object.replace(/^0x/, '')
  }
};

fs.writeFileSync(artifactPath, JSON.stringify(artifactData, null, 2), 'utf8');
console.log(`[+] Artefacto guardado exitosamente en: ${artifactPath}`);
