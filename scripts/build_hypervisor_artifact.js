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
  const p3 = path.resolve('contracts/src/interfaces', importPath.replace('./interfaces/', ''));
  if (fs.existsSync(p3)) return { contents: fs.readFileSync(p3, 'utf8') };
  return { error: 'Not found: ' + importPath };
}

console.log('[*] Compilando VirajeHypervisor.sol con optimizador (runs: 200)...');
const content = fs.readFileSync('contracts/src/VirajeHypervisor.sol', 'utf8');

const input = {
  language: 'Solidity',
  sources: { 'VirajeHypervisor.sol': { content } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
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

const contract = output.contracts['VirajeHypervisor.sol']['VirajeHypervisor'];
const runtimeSize = contract.evm.deployedBytecode.object.length / 2;
console.log(`[+] Runtime size de VirajeHypervisor: ${runtimeSize} bytes (Límite EIP-170: 24,576 bytes)`);

if (runtimeSize > 24576) {
  console.error(`[ERROR] VirajeHypervisor excede el límite EIP-170 por ${runtimeSize - 24576} bytes.`);
  process.exit(1);
}

const artifactDir = path.resolve('contracts/out/VirajeHypervisor.sol');
if (!fs.existsSync(artifactDir)) {
  fs.mkdirSync(artifactDir, { recursive: true });
}

const artifactPath = path.join(artifactDir, 'VirajeHypervisor.json');
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

// Compilamos también ProtocolAddressProvider para actualizar su artefacto
console.log('[*] Actualizando artefacto de ProtocolAddressProvider.sol...');
const apContent = fs.readFileSync('contracts/src/ProtocolAddressProvider.sol', 'utf8');
const apInput = {
  language: 'Solidity',
  sources: { 'ProtocolAddressProvider.sol': { content: apContent } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode']
      }
    }
  }
};
const apOutput = JSON.parse(solc.compile(JSON.stringify(apInput), { import: findImports }));
if (apOutput.errors && apOutput.errors.some(e => e.severity === 'error')) {
  console.error('AP Compilation errors:', apOutput.errors.filter(e => e.severity === 'error'));
  process.exit(1);
}
const apContract = apOutput.contracts['ProtocolAddressProvider.sol']['ProtocolAddressProvider'];
const apDir = path.resolve('contracts/out/ProtocolAddressProvider.sol');
if (!fs.existsSync(apDir)) fs.mkdirSync(apDir, { recursive: true });
fs.writeFileSync(path.join(apDir, 'ProtocolAddressProvider.json'), JSON.stringify({
  abi: apContract.abi,
  bytecode: { object: '0x' + apContract.evm.bytecode.object.replace(/^0x/, '') },
  deployedBytecode: { object: '0x' + apContract.evm.deployedBytecode.object.replace(/^0x/, '') }
}, null, 2), 'utf8');
console.log('[+] Artefacto de ProtocolAddressProvider actualizado.');
