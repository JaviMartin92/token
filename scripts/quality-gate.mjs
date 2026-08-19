import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

console.log('============================================================');
console.log('  ALPHA CENTAURI: INSTITUTIONAL QUALITY GATE CHECK');
console.log('============================================================\n');

const checks = [
  {
    name: '1. Frontend Strict Typecheck (tsc -b)',
    command: 'cd frontend && npx tsc -b --noEmit',
    category: 'TypeScript'
  },
  {
    name: '2. Backend Services Strict Typecheck (tsc)',
    command: 'cd services && npx tsc --noEmit',
    category: 'TypeScript'
  },
  {
    name: '3. Frontend Fast Linter (Oxlint)',
    command: 'cd frontend && npm run lint',
    category: 'Code Quality'
  },
  {
    name: '4. Frontend Unit Tests (Vitest 21/21)',
    command: 'npm run test:frontend:unit',
    category: 'Testing'
  },
  {
    name: '5. Frontend Production Bundle Build (Vite)',
    command: 'npm run test:frontend:build',
    category: 'Build'
  },
  {
    name: '6. Backend Architecture & Reorg Tests (43/43)',
    command: 'npm run test:backend',
    category: 'Testing'
  },
  {
    name: '7. Frontend / Smart Contract Alignment (18/18)',
    command: 'npm run test:alignment',
    category: 'Alignment'
  },
  {
    name: '8. Institutional E2E Multi-Persona Suite (5 Personas)',
    command: 'npm run test:personas',
    category: 'E2E Simulation'
  },
  {
    name: '9. Chaos & Market Shock Stress Suite',
    command: 'npm run test:chaos',
    category: 'Stress & Chaos'
  },
  {
    name: '10. Dependencies Security Audit (npm audit)',
    command: 'npm audit --audit-level=high',
    category: 'Security'
  },
  {
    name: '11. Smart Contracts Security Linter (Solhint)',
    command: 'npx solhint "contracts/src/**/*.sol"',
    category: 'Solidity Security'
  },
  {
    name: '12. Dead Code & Orphaned Exports Scanner (Knip)',
    command: 'npx knip',
    category: 'Code Cleanliness'
  }
];

let passedCount = 0;
let failedCount = 0;
const results = [];

for (const check of checks) {
  process.stdout.write(`[*] Running: ${check.name}... `);
  const start = Date.now();
  try {
    execSync(check.command, { stdio: 'pipe', encoding: 'utf8' });
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`\x1b[32m[PASS]\x1b[0m (${duration}s)`);
    results.push({ name: check.name, category: check.category, status: 'PASS', duration: `${duration}s` });
    passedCount++;
  } catch (error) {
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`\x1b[31m[FAIL]\x1b[0m (${duration}s)`);
    console.error(error.stdout || error.message);
    results.push({ name: check.name, category: check.category, status: 'FAIL', duration: `${duration}s` });
    failedCount++;
  }
}

console.log('\n============================================================');
console.log(` SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log('============================================================');

if (failedCount > 0) {
  console.error('\n❌ Quality Gate Rejected: Institutional compliance thresholds not met.');
  process.exit(1);
} else {
  console.log('\n✅ Quality Gate Approved: 100% Institutional Quality & Security Standards Met.');
  process.exit(0);
}
