const fs = require('fs');
const path = require('path');

const srcDir = path.resolve('contracts/src');
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.sol'));

console.log('--- AUDITORÍA DE ROLES RBAC Y ENLACES ENTRE CONTRATOS ---\n');

// 1. Scan for role definitions in ProtocolRoles.sol
const rolesContent = fs.readFileSync(path.join(srcDir, 'ProtocolRoles.sol'), 'utf8');
const roleRegex = /bytes32\s+public\s+constant\s+([A-Z_]+)\s*=\s*keccak256\("([^"]+)"\);/g;
let match;
const definedRoles = {};
while ((match = roleRegex.exec(rolesContent)) !== null) {
  definedRoles[match[1]] = match[2];
}
console.log('Roles definidos en ProtocolRoles.sol:', Object.keys(definedRoles));

// 2. Scan contracts for onlyRole, hasRole, addressProvider calls
const roleGuards = [];
const addressProviderLookups = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // onlyRole
    if (line.includes('onlyRole(')) {
      roleGuards.push({ file, line: idx + 1, text: line.trim() });
    }
    // hasRole
    if (line.includes('hasRole(') && !line.includes('function hasRole')) {
      roleGuards.push({ file, line: idx + 1, text: line.trim() });
    }
    // addressProvider.getAddress
    if (line.includes('addressProvider.getAddress(')) {
      addressProviderLookups.push({ file, line: idx + 1, text: line.trim() });
    }
  });
}

console.log('\n[+] Puntos de control RBAC detectados en código:', roleGuards.length);
roleGuards.forEach(g => {
  console.log(`  - [${g.file}:${g.line}] ${g.text}`);
});

console.log('\n[+] Consultas a ProtocolAddressProvider detectadas:', addressProviderLookups.length);
addressProviderLookups.forEach(a => {
  console.log(`  - [${a.file}:${a.line}] ${a.text}`);
});

// 3. Inspect AddressProvider IDs
const apContent = fs.readFileSync(path.join(srcDir, 'ProtocolAddressProvider.sol'), 'utf8');
const idRegex = /bytes32\s+public\s+constant\s+(ID_[A-Z_]+)\s*=\s*keccak256\("([^"]+)"\);/g;
const apIds = {};
while ((match = idRegex.exec(apContent)) !== null) {
  apIds[match[1]] = match[2];
}
console.log('\n[+] IDs canónicos en ProtocolAddressProvider:', apIds);

// 4. Verify deployment scripts grant all required roles
const deployMainnet = fs.readFileSync('contracts/script/DeployMainnet.s.sol', 'utf8');
const deploySepolia = fs.readFileSync('scripts/deploy_sepolia.ts', 'utf8');
const deployP2pStaking = fs.readFileSync('scripts/deploy_p2p_and_fix_staking.ts', 'utf8');

console.log('\n--- VERIFICACIÓN CRUZADA DE ASIGNACIÓN DE ROLES ---');
const requiredGrants = [
  { role: 'MINTER_ROLE', on: 'AlphaToken', to: 'Treasury' },
  { role: 'BURNER_ROLE', on: 'AlphaToken', to: 'Treasury' },
  { role: 'VAULT_MANAGER_ROLE', on: 'AlphaVault', to: 'Treasury' },
  { role: 'VAULT_MANAGER_ROLE', on: 'AlphaVault', to: 'DiscountBuybackEngine' },
  { role: 'BURNER_ROLE', on: 'Treasury', to: 'GovernanceStaking' },
  { role: 'BURNER_ROLE', on: 'Treasury', to: 'DiscountBuybackEngine' },
  { role: 'MINTER_ROLE', on: 'VaultPositionNFT', to: 'VestedDiscountVault' },
  { role: 'COMPLIANCE_ROLE', on: 'Treasury', to: 'Deployer/Gateway' }
];

requiredGrants.forEach(rg => {
  const inMainnet = deployMainnet.includes(rg.role) && (deployMainnet.includes(rg.on) || deployMainnet.includes(rg.to));
  const inSepolia = deploySepolia.includes(rg.role);
  const inP2pScript = deployP2pStaking.includes(rg.role);
  console.log(`- Permiso: [${rg.role}] en ${rg.on} hacia ${rg.to} -> Mainnet: ${inMainnet ? '✅' : '❌'} | Sepolia Deploy: ${inSepolia ? '✅' : '❌'} | Fix Script: ${inP2pScript ? '✅' : '❌'}`);
});
