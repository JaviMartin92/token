import fs from 'fs';
import path from 'path';

const hookPath = path.join('.git', 'hooks', 'pre-push');
const content = `#!/usr/bin/env node

const { execSync } = require('child_process');
console.log('\\x1b[36m🔒 [GIT PRE-PUSH HOOK] Ejecutando Quality Gate Institucional (14/14 Checks)...\\x1b[0m');
try {
  execSync('npm run quality', { stdio: 'inherit' });
  console.log('\\x1b[32m✅ Quality Gate Aprobado. Procediendo con el push.\\x1b[0m');
  process.exit(0);
} catch (e) {
  console.error('\\x1b[31m❌ Push Abortado: El Quality Gate o las pruebas de navegador han fallado.\\x1b[0m');
  process.exit(1);
}
`;

fs.writeFileSync(hookPath, content, { mode: 0o755 });
console.log('✅ Git Pre-Push Hook instalado exitosamente.');
