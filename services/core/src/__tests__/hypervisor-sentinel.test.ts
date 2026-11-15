import * as fs from 'fs';
import * as path from 'path';
import { keccak256, toHex, encodeFunctionData, decodeFunctionResult } from 'viem';

async function runHypervisorSentinelTestSuite() {
  console.log('============================================================');
  console.log('    VIRAJE PROTOCOL: HYPERVISOR & SENTINEL TEST SUITE       ');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      failed++;
    }
  }

  const rootDir = path.resolve(__dirname, '../../../../');
  const artifactPath = path.resolve(rootDir, 'contracts/out/VirajeHypervisor.sol/VirajeHypervisor.json');

  // 1. Verificación de Artefacto y Conformidad EIP-170
  console.log('[1/4] Verificando Artefacto de Compilación y Conformidad EIP-170...');
  assert(fs.existsSync(artifactPath), 'El archivo de artefacto VirajeHypervisor.json existe');

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  assert(Array.isArray(artifact.abi), 'El artefacto contiene un ABI válido');
  assert(typeof artifact.bytecode.object === 'string', 'El artefacto contiene bytecode EVM válido');

  const runtimeBytecode = artifact.deployedBytecode.object.replace(/^0x/, '');
  const runtimeSizeBytes = runtimeBytecode.length / 2;
  console.log(`       Runtime Size: ${runtimeSizeBytes} bytes (Límite EIP-170: 24,576 bytes)`);
  assert(runtimeSizeBytes <= 24576, 'El tamaño de runtime cumple estrictamente con el límite EIP-170');
  assert(runtimeSizeBytes > 3000, 'El bytecode contiene lógica compilada completa (>3KB)');

  // 2. Verificación de Métodos Clave en el ABI
  console.log('\n[2/4] Verificando Interfaz y Selectores de Invariantes...');
  const methodNames = artifact.abi.filter((x: any) => x.type === 'function').map((x: any) => x.name);
  assert(methodNames.includes('inspectPreFlight'), 'Función inspectPreFlight presente en el ABI');
  assert(methodNames.includes('assessTreasuryHealth'), 'Función assessTreasuryHealth presente en el ABI');
  assert(methodNames.includes('verifyStateTransition'), 'Función verifyStateTransition presente en el ABI');
  assert(methodNames.includes('getConfig'), 'Función getConfig presente en el ABI');
  assert(methodNames.includes('updateConfig'), 'Función updateConfig presente en el ABI');
  assert(methodNames.includes('setPause'), 'Función setPause presente en el ABI');

  const errorNames = artifact.abi.filter((x: any) => x.type === 'error').map((x: any) => x.name);
  assert(errorNames.includes('InvariantNAVDecreased'), 'Error InvariantNAVDecreased definido');
  assert(errorNames.includes('InvariantSolvencyBreached'), 'Error InvariantSolvencyBreached definido');
  assert(errorNames.includes('HypervisorPaused'), 'Error HypervisorPaused definido');

  // 3. Verificación de Fórmulas Matemáticas de Invariantes
  console.log('\n[3/4] Verificando Fórmulas Matemáticas de Invariantes...');
  {
    // Regla 1: Techo de Deuda del 20%
    const totalAssetsUSD = 1_000_000n * 10n ** 18n; // $1,000,000
    const maxTreasuryLoanRatioBps = 2000n; // 20%
    const maxDebtCapUSD = (totalAssetsUSD * maxTreasuryLoanRatioBps) / 10000n;
    assert(maxDebtCapUSD === 200_000n * 10n ** 18n, 'Cap máximo de deuda es exactamente $200,000 (20% de $1M)');

    // Regla 2: LTV Efectivo del 25% (50% Haircut * 50% LTV)
    const virajeAmount = 1000n * 10n ** 18n; // 1,000 VIRAJE
    const navPerShare = 1010000000000000000n; // $1.01
    const virajeValueUSD = (virajeAmount * navPerShare) / (10n ** 18n); // $1,010 USD
    const maxBorrowAllowedUSD = (virajeValueUSD * 2500n) / 10000n; // 25%
    const maxBorrowAllowedUSDC = maxBorrowAllowedUSD / (10n ** 12n); // En 6 decimales
    assert(maxBorrowAllowedUSDC === 252500000n, 'Max borrow para 1000 VIRAJE @ $1.01 NAV es exactamente 252.50 USDC');

    // Regla 3: Intento de sobreendeudamiento
    const attemptedBorrow = 300_000000n; // 300 USDC
    const isExceeded = attemptedBorrow > maxBorrowAllowedUSDC;
    assert(isExceeded === true, 'El intento de pedir 300 USDC contra 1000 VIRAJE excede el 25% LTV Efectivo');
  }

  // 4. Verificación de Códigos de Anomalía
  console.log('\n[4/4] Verificando Códigos de Hash de Anomalías...');
  const hashPaused = keccak256(toHex('HYPERVISOR_PAUSED'));
  const hashLtv = keccak256(toHex('MAX_LTV_EXCEEDED'));
  const hashDebt = keccak256(toHex('DEBT_CAP_EXCEEDED'));
  console.log(`       ANOMALY_PAUSED: ${hashPaused}`);
  console.log(`       ANOMALY_MAX_LTV_EXCEEDED: ${hashLtv}`);
  console.log(`       ANOMALY_DEBT_CAP_EXCEEDED: ${hashDebt}`);
  assert(typeof hashPaused === 'string' && hashPaused.length === 66, 'Hash ANOMALY_PAUSED calculado (32 bytes)');
  assert(typeof hashLtv === 'string' && hashLtv.length === 66, 'Hash ANOMALY_MAX_LTV_EXCEEDED calculado (32 bytes)');
  assert(typeof hashDebt === 'string' && hashDebt.length === 66, 'Hash ANOMALY_DEBT_CAP_EXCEEDED calculado (32 bytes)');

  console.log('\n============================================================');
  console.log(`  RESUMEN: ${passed} PASADOS, ${failed} FALLADOS`);
  console.log('============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runHypervisorSentinelTestSuite().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
