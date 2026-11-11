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

const files = fs.readdirSync('contracts/src').filter(f => f.endsWith('.sol'));
console.log('Auditing ' + files.length + ' contract files for EIP-170 size compliance...\n');

const results = [];
for (const file of files) {
  const content = fs.readFileSync(path.join('contracts/src', file), 'utf8');
  const input = {
    language: 'Solidity',
    sources: { [file]: { content } },
    settings: {
      optimizer: { enabled: true, runs: 1 },
      outputSelection: { '*': { '*': ['evm.deployedBytecode.object'] } }
    }
  };
  try {
    const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
    if (output.contracts && output.contracts[file]) {
      for (const [cName, cData] of Object.entries(output.contracts[file])) {
        const bin = cData.evm && cData.evm.deployedBytecode ? cData.evm.deployedBytecode.object : '';
        const bytes = bin.length / 2;
        if (bytes > 0) {
          results.push({ contract: cName, file, bytes, eip170: bytes <= 24576, margin: 24576 - bytes });
        }
      }
    }
  } catch (e) {
    console.error('Error compiling', file, e.message);
  }
}

results.sort((a, b) => b.bytes - a.bytes);
console.log('--- EIP-170 AUDIT RESULTS ---');
let hasViolations = false;
results.forEach(r => {
  const status = r.eip170 ? (r.margin < 1500 ? '⚠️ TIGHT' : '✅ OK') : '❌ EXCEEDS LIMIT';
  if (!r.eip170) hasViolations = true;
  console.log(status.padEnd(16) + ' ' + r.contract.padEnd(30) + ' ' + String(r.bytes).padStart(6) + ' bytes (Margin: ' + String(r.margin).padStart(6) + ' B) [' + r.file + ']');
});

if (hasViolations) {
  console.log('\n❌ VIOLATIONS FOUND: Contracts exceeding EIP-170 limit (24,576 bytes)!');
} else {
  console.log('\n✅ ALL CONTRACTS COMPLIANT: No contract exceeds EIP-170 limit.');
}
