const fs = require('fs');
const path = require('path');
const { createPublicClient, http } = require(path.resolve(__dirname, '../frontend/node_modules/viem'));
const { arbitrumSepolia } = require(path.resolve(__dirname, '../frontend/node_modules/viem/chains'));

const client = createPublicClient({
  chain: arbitrumSepolia,
  transport: http('https://sepolia-rollup.arbitrum.io/rpc')
});

const contracts = JSON.parse(fs.readFileSync('frontend/src/contracts.json', 'utf8'));

async function checkAll() {
  console.log('--- VERIFICANDO BYTECODE EN ARBITRUM SEPOLIA PARA CADA CONTRATO ---\n');
  const entries = Object.entries(contracts);
  const emptyAddresses = [];

  for (const [name, addr] of entries) {
    try {
      const code = await client.getCode({ address: addr });
      const hasCode = code && code.length > 2;
      const len = hasCode ? (code.length - 2) / 2 : 0;
      const status = hasCode ? '✅ ON-CHAIN' : '❌ SIN CÓDIGO';
      if (!hasCode) emptyAddresses.push({ name, addr });
      console.log(status.padEnd(16) + ' ' + name.padEnd(28) + ' ' + addr + ' (' + len + ' bytes)');
    } catch (e) {
      console.log('⚠️ ERROR         ' + name.padEnd(28) + ' ' + addr + ': ' + e.message);
    }
  }

  console.log('\n--- RESUMEN DE CONTRATOS VACÍOS O NO DESPLEGADOS ---');
  if (emptyAddresses.length === 0) {
    console.log('✅ TODOS los contratos en contracts.json están desplegados con bytecode en Sepolia.');
  } else {
    console.log('❌ ATENCIÓN: Se encontraron ' + emptyAddresses.length + ' contratos vacíos:');
    emptyAddresses.forEach(e => console.log('   - ' + e.name + ': ' + e.addr));
  }
}

checkAll().catch(console.error);
