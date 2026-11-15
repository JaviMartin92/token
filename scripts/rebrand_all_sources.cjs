const fs = require('fs');
const path = require('path');

const EXCLUDE_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'cache', 'out', 'artifacts',
  '.system_generated', 'brain', 'reports', '.turbo', '.next', 'build'
]);

const EXCLUDE_FILES = new Set([
  'audit_alpha_references.js',
  'rebrand_all_sources.cjs'
]);

const TARGET_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs', '.sol', '.md', '.json', '.yml', '.yaml', '.conf', '.spec', '.properties', '.sh', '.ps1'
]);

function replaceBranding(content, filePath) {
  let s = content;

  // Case-insensitive exact brand phrases
  s = s.replace(/Alpha Centauri Protocol/gi, 'Viraje Protocol');
  s = s.replace(/AlphaCentauriProtocol/gi, 'VirajeProtocol');
  s = s.replace(/Alpha Centauri/gi, 'Viraje Protocol');
  s = s.replace(/AlphaCentauri/gi, 'Viraje');
  s = s.replace(/GovernorAlphaCentauri/gi, 'GovernorViraje');

  // Docker & configs
  s = s.replace(/alpha_centauri_db/g, 'viraje_db');
  s = s.replace(/alpha_centauri_redis/g, 'viraje_redis');
  s = s.replace(/alpha_centauri_anvil/g, 'viraje_anvil');
  s = s.replace(/alpha_centauri_frontend/g, 'viraje_frontend');
  s = s.replace(/alpha_centauri/g, 'viraje');
  s = s.replace(/alpha-anvil/g, 'viraje-anvil');
  s = s.replace(/alpha-frontend/g, 'viraje-frontend');
  s = s.replace(/alpha-centauri-protocol/g, 'viraje-protocol');
  s = s.replace(/alpha-centauri-dao/g, 'viraje-dao');
  s = s.replace(/alpha_centauri_audit_sources/g, 'viraje_audit_sources');

  // Environment variables
  s = s.replace(/VITE_ALPHA_TOKEN_ADDRESS/g, 'VITE_VIRAJE_TOKEN_ADDRESS');
  s = s.replace(/VITE_ALPHA_VAULT_ADDRESS/g, 'VITE_VIRAJE_VAULT_ADDRESS');

  // Contracts & ABIs
  s = s.replace(/\bAlphaToken\b/g, 'VirajeToken');
  s = s.replace(/\bAlphaVault\b/g, 'VirajeVault');
  s = s.replace(/\bALPHA_TOKEN\b/g, 'VIRAJE_TOKEN');
  s = s.replace(/\bALPHA_VAULT\b/g, 'VIRAJE_VAULT');
  s = s.replace(/\bID_ALPHA_TOKEN\b/g, 'ID_VIRAJE_TOKEN');
  s = s.replace(/\bID_ALPHA_VAULT\b/g, 'ID_VIRAJE_VAULT');

  // Test tokens & feeds
  s = s.replace(/\balphaToken\b/g, 'virajeToken');
  s = s.replace(/\balphaVault\b/g, 'virajeVault');
  s = s.replace(/\balphaFeed\b/g, 'virajeFeed');
  s = s.replace(/\balphaPrice\b/g, 'virajePrice');
  s = s.replace(/\balphaPriceUSD\b/g, 'virajePriceUSD');
  s = s.replace(/\balphaPriceUSD18\b/g, 'virajePriceUSD18');
  s = s.replace(/\bexpectedAlpha\b/g, 'expectedViraje');
  s = s.replace(/\bminAlphaOut\b/g, 'minVirajeOut');
  s = s.replace(/\buserAlpha\b/g, 'userViraje');
  s = s.replace(/\bstakedAlpha\b/g, 'stakedViraje');
  s = s.replace(/\bburnedAlpha\b/g, 'burnedViraje');
  s = s.replace(/\bclaimedAlpha\b/g, 'claimedViraje');
  s = s.replace(/\balphaPaid\b/g, 'virajePaid');
  s = s.replace(/\balphaAmount\b/g, 'virajeAmount');
  s = s.replace(/\bAlphaClaimed\b/g, 'VirajeClaimed');
  s = s.replace(/\bclaimVestedAlpha\b/g, 'claimVestedViraje');
  s = s.replace(/\bborrowFromTreasuryWithAlpha\b/g, 'borrowFromTreasuryWithViraje');
  s = s.replace(/\b_alpha\b/g, '_viraje');
  s = s.replace(/\balpha\b/g, (match, offset, str) => {
    // Avoid replacing if it is part of another word like alphabet or alpha in Greek letters outside our protocol
    // Check preceding and following chars
    const prev = offset > 0 ? str[offset - 1] : ' ';
    const next = offset + 5 < str.length ? str[offset + 5] : ' ';
    if (/[a-zA-Z0-9_]/.test(prev) || /[a-zA-Z0-9_]/.test(next)) return match;
    return 'viraje';
  });

  // Token symbols
  s = s.replace(/\bstALPHA\b/g, 'stVIRAJE');
  s = s.replace(/\bstAlpha\b/g, 'stViraje');
  s = s.replace(/\bALPHA\b/g, 'VIRAJE');

  // Common phrases in tests and markdown
  s = s.replace(/Alpha tokens/gi, 'VIRAJE tokens');
  s = s.replace(/Alpha token/gi, 'VIRAJE token');
  s = s.replace(/Alpha vault/gi, 'Viraje vault');
  s = s.replace(/Alpha shares/gi, 'VIRAJE shares');
  s = s.replace(/Alpha Staking/gi, 'Viraje Staking');
  s = s.replace(/StakedAlpha/gi, 'StakedViraje');
  s = s.replace(/alpha_horizon/gi, 'viraje_horizon');

  return s;
}

function processDirectory(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      processDirectory(fullPath);
    } else if (entry.isFile()) {
      if (EXCLUDE_FILES.has(entry.name)) continue;
      const ext = path.extname(entry.name);
      const isDotEnv = entry.name.startsWith('.env');
      if (!TARGET_EXTENSIONS.has(ext) && !isDotEnv) continue;

      try {
        const original = fs.readFileSync(fullPath, 'utf8');
        const modified = replaceBranding(original, relPath);
        if (modified !== original) {
          fs.writeFileSync(fullPath, modified, 'utf8');
          console.log(`Updated: ${relPath}`);
        }
      } catch (e) {
        console.error(`Error processing ${relPath}:`, e.message);
      }
    }
  }
}

console.log('Running deep rebranding pass across all project files...');
processDirectory(process.cwd());
console.log('Deep rebranding pass complete.');
