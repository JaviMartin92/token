const fs = require('fs');
const path = require('path');

const excludeDirs = new Set(['.git', 'node_modules', 'dist', 'cache', 'out', 'artifacts', '.system_generated', 'brain', 'reports', '.turbo', '.next']);

const categories = {
  contracts_src: [],
  contracts_test: [],
  contracts_script: [],
  frontend_ui: [],
  frontend_hooks_utils: [],
  frontend_tests: [],
  frontend_other: [],
  services: [],
  scripts: [],
  docs: [],
  root_configs: [],
  other: []
};

function scan(dir) {
  let list;
  try { list = fs.readdirSync(dir); } catch(e) { return; }
  for (const item of list) {
    if (excludeDirs.has(item) || item === 'playwright-report') continue;
    const full = path.join(dir, item);
    let stat;
    try { stat = fs.statSync(full); } catch(e) { continue; }
    if (stat.isDirectory()) {
      scan(full);
    } else if (stat.isFile()) {
      if (item.endsWith('.png') || item.endsWith('.jpg') || item.endsWith('.zip') || item.endsWith('.log') || item.endsWith('.ico') || item.endsWith('.woff2') || item.endsWith('.pdf') || item.endsWith('.svg')) continue;
      // Skip the audit script itself
      if (item === 'audit_alpha_references.js' || item === 'purge_alpha_branding.cjs' || item === 'rebrand_all_sources.cjs') continue;

      const rel = path.relative('.', full).replace(/\\/g, '/');
      try {
        const text = fs.readFileSync(full, 'utf8');
        const lines = text.split('\n');
        lines.forEach((l, idx) => {
          if (/alpha/i.test(l)) {
            const entry = { file: rel, line: idx + 1, text: l.trim() };
            if (rel.startsWith('contracts/src/')) {
              categories.contracts_src.push(entry);
            } else if (rel.startsWith('contracts/test/')) {
              categories.contracts_test.push(entry);
            } else if (rel.startsWith('contracts/script/')) {
              categories.contracts_script.push(entry);
            } else if (rel.startsWith('frontend/src/components/') || rel.startsWith('frontend/src/constants/')) {
              categories.frontend_ui.push(entry);
            } else if (rel.startsWith('frontend/src/hooks/') || rel.startsWith('frontend/src/utils/')) {
              categories.frontend_hooks_utils.push(entry);
            } else if (rel.includes('__tests__') || rel.endsWith('.test.ts') || rel.endsWith('.test.tsx')) {
              categories.frontend_tests.push(entry);
            } else if (rel.startsWith('frontend/')) {
              categories.frontend_other.push(entry);
            } else if (rel.startsWith('services/')) {
              categories.services.push(entry);
            } else if (rel.startsWith('scripts/')) {
              categories.scripts.push(entry);
            } else if (rel.startsWith('docs/')) {
              categories.docs.push(entry);
            } else if (!rel.includes('/')) {
              categories.root_configs.push(entry);
            } else {
              categories.other.push(entry);
            }
          }
        });
      } catch(e) {}
    }
  }
}

scan('.');

let total = 0;
console.log('================================================================');
console.log('          INFORME DE AUDITORÍA EXHAUSTIVA DE "ALPHA"            ');
console.log('================================================================');
for (const [cat, items] of Object.entries(categories)) {
  total += items.length;
  console.log(`\n📁 CATEGORÍA: ${cat.toUpperCase()} (${items.length} ocurrencias)`);
  if (items.length > 0) {
    items.forEach(it => {
      console.log(`  ${it.file}:${it.line} -> ${it.text.substring(0, 120)}`);
    });
  }
}
console.log('\n================================================================');
console.log(`TOTAL GENERAL DE COINCIDENCIAS CON "ALPHA": ${total}`);
console.log('================================================================');
