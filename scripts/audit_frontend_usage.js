const fs = require('fs');
const path = require('path');

const empty = [
  'ATOMIC_SWAP',
  'YIELD_VAULT',
  'P2P_MARKET',
  'MORPHO_ADAPTER',
  'PROMO_VAULT',
  'DYNAMIC_YIELD_ORACLE',
  'RESERVE_MANAGER',
  'GOVERNOR',
  'TIMELOCK'
];

function scanDir(dir) {
  let files = [];
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      files = files.concat(scanDir(full));
    } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
      files.push(full);
    }
  }
  return files;
}

const srcFiles = scanDir('frontend/src');

console.log('--- REVISIÓN DE USO EN EL FRONTEND DE CONTRATOS VACÍOS ---\n');

empty.forEach(k => {
  const matches = [];
  srcFiles.forEach(f => {
    const content = fs.readFileSync(f, 'utf8');
    const needle = 'CONTRACT_ADDRESSES.' + k;
    if (content.includes(needle)) {
      matches.push(path.relative('frontend/src', f));
    }
  });
  console.log(k.padEnd(25) + ' Usado en ' + matches.length + ' archivos: ' + matches.join(', '));
});
