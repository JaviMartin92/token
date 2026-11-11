const fs = require('fs');
const path = require('path');

console.log('--- AUDITORÍA DE FIRMAS ABI (FRONTEND vs SOLIDITY) ---\n');

// 1. Load compiled artifacts
function loadArtifact(name) {
  const p = path.resolve(`contracts/out/${name}.sol/${name}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// 2. Load web3.ts ABIs
const web3Content = fs.readFileSync('frontend/src/utils/web3.ts', 'utf8');

const contractMap = {
  TREASURY: 'TreasuryManager',
  ALPHA_TOKEN: 'AlphaToken',
  ALPHA_VAULT: 'AlphaVault',
  ORACLE_HUB: 'OracleHub',
  CIRCUIT_BREAKER: 'CircuitBreaker',
  POSITION_NFT: 'VaultPositionNFT',
  VESTED_VAULT: 'VestedDiscountVault',
  P2P_MARKET: 'P2PLendingMarket',
  STAKING: 'GovernanceStaking',
  REAL_YIELD_ROUTER: 'RealYieldRouter',
  TOKENOMICS_ENGINE: 'ProtocolTokenomicsEngine',
  COMMUNITY_YIELD_VAULT: 'CommunityYieldVault',
  DISCOUNT_BUYBACK_ENGINE: 'DiscountBuybackEngine',
  FOUNDER_VESTING_VAULT: 'FounderReserveVestingVault',
  POST_QUANTUM_GUARD: 'PostQuantumGuard',
  GOVERNOR: 'GovernorAlphaCentauri',
  DYNAMIC_YIELD_ORACLE: 'DynamicYieldOracleRouter'
};

const missingMethods = [];
const signatureMismatches = [];

for (const [abiKey, contractName] of Object.entries(contractMap)) {
  const artifact = loadArtifact(contractName);
  if (!artifact) {
    console.log(`⚠️ Artefacto no encontrado para ${contractName} (${abiKey})`);
    continue;
  }

  // Extract function definitions from artifact ABI
  const contractFunctions = new Map();
  artifact.abi.forEach(item => {
    if (item.type === 'function') {
      const inputs = (item.inputs || []).map(i => i.type).join(',');
      contractFunctions.set(item.name, {
        inputs,
        stateMutability: item.stateMutability,
        outputs: (item.outputs || []).map(o => o.type).join(',')
      });
    }
  });

  // Check functions defined in web3.ts for this contract
  // Locate ABIS.<abiKey> in web3Content
  const abiBlockRegex = new RegExp(`${abiKey}:\\s*\\[([\\s\\S]*?)\\]\\s*as\\s*const`, 'm');
  const blockMatch = web3Content.match(abiBlockRegex);
  if (!blockMatch) {
    // Check if defined differently
    continue;
  }

  const blockText = blockMatch[1];
  const nameRegex = /name:\s*['"]([a-zA-Z0-9_]+)['"]/g;
  let nMatch;
  const web3Funcs = new Set();
  while ((nMatch = nameRegex.exec(blockText)) !== null) {
    const fnName = nMatch[1];
    // filter out parameter names, only consider function names
    if (blockText.includes(`name: '${fnName}', type: 'function'`) || blockText.includes(`name: "${fnName}", type: "function"`)) {
      web3Funcs.add(fnName);
    }
  }

  console.log(`Auditing ${abiKey} (${contractName}): ${web3Funcs.size} functions in frontend ABI...`);
  web3Funcs.forEach(fn => {
    if (!contractFunctions.has(fn)) {
      missingMethods.push({ abiKey, contractName, functionName: fn });
      console.log(`  ❌ Función ${fn} NO EXISTE en ${contractName}.sol`);
    } else {
      // verified
    }
  });
}

console.log('\n--- RESUMEN DE MÉTODOS DISCORDANTES ---');
if (missingMethods.length === 0) {
  console.log('✅ TODAS las funciones de las ABIs del frontend existen en los contratos Solidity compilados.');
} else {
  console.log(`❌ Se encontraron ${missingMethods.length} funciones faltantes:`);
  missingMethods.forEach(m => console.log(`   - ${m.abiKey} (${m.contractName}): ${m.functionName}`));
}
