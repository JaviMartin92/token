const fs = require('fs');
const path = require('path');

const contracts = JSON.parse(fs.readFileSync('./src/contracts.json', 'utf8'));
console.log('Current src/contracts.json:', contracts);

const files = fs.readdirSync('./dist/assets').filter(f => f.endsWith('.js'));
for (const f of files) {
  const c = fs.readFileSync('./dist/assets/' + f, 'utf8');
  console.log(f, 'includes current USDC address (0x5fbdb2...):', c.includes('0x5fbdb2315678afecb367f032d93f642f64180aa3'));
}
