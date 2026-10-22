import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const forbidden = [/0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80/i, /VITE_(ADMIN|USER)_KEY/];

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

for (const file of files(root)) {
  const content = readFileSync(file, 'utf8');
  if (forbidden.some((pattern) => pattern.test(content))) {
    throw new Error(`Production build blocked: sensitive sandbox material found in ${file}.`);
  }
}

if (process.env.VITE_APP_ENV === 'sandbox') {
  throw new Error('Production build blocked: VITE_APP_ENV=sandbox. Use build:sandbox for local development.');
}
