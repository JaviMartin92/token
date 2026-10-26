import { OllamaClient } from './OllamaClient';
import {
  DeFiAgentEnv,
  ALICE_KEY,
  BOB_KEY,
  EVE_KEY
} from './DeFiAgentEnv';
import { privateKeyToAccount } from 'viem/accounts';

async function runAutonomousExploratoryFuzzer() {
  console.log('\n================================================================');
  console.log('⚔️  AUTONOMOUS ZERO-RESTRICTION DEFI EXPLORATORY FUZZER (Qwen3:8B)');
  console.log('   [MODO AISLAMIENTO: RESETEO A ESTADO LIMPIO ENTRE PRUEBA Y PRUEBA]');
  console.log('================================================================\n');

  const ollama = new OllamaClient('http://127.0.0.1:11434', 'qwen3:8b');
  const env = new DeFiAgentEnv('http://127.0.0.1:8545');

  const cipherAcc = privateKeyToAccount(EVE_KEY);    // Zero-Day Hunter
  const apexAcc = privateKeyToAccount(BOB_KEY);       // MEV & Financial Arbitrageur
  const echoAcc = privateKeyToAccount(ALICE_KEY);     // State Machine Fuzzer

  console.log('🔧 [1/4] Capturando Snapshot Base Génesis...');
  let baseSnapshot = await env.createSnapshot();
  console.log('✅ Snapshot base guardado. Cada acción se ejecutará sobre estado inmaculado.\n');

  const targetContracts = [
    'TREASURY',
    'STAKING',
    'DISCOUNT_BUYBACK_ENGINE',
    'P2P_MARKET',
    'REAL_YIELD_ROUTER',
    'CIRCUIT_BREAKER'
  ];

  const protocolManifest = env.registry.getProtocolManifest(targetContracts);
  console.log(`📋 [2/4] Catálogo de contratos expuesto al modelo: ${targetContracts.join(', ')}`);
  for (const [cName, spec] of Object.entries(protocolManifest)) {
    console.log(`   • ${cName}: ${spec.functions.length} métodos disponibles`);
  }
  console.log('');

  const agents = [
    {
      name: 'Cipher',
      key: EVE_KEY,
      role: 'Zero-Day Security Researcher & Exploit Hunter',
      objective: 'Sondear llamadas no autorizadas, bypass de roles (onlyOwner/onlyTimelock), llamadas con argumentos límite (0, max uint) o intentos de retiro forzado.',
      history: [] as Array<{ action: string; result: string }>
    },
    {
      name: 'Apex',
      key: BOB_KEY,
      role: 'MEV Arbitrageur & Liquidity Sniper',
      objective: 'Interactuar con Tesorería, Buyback Engine o Mercado P2P para ejecutar swaps, arbitrajes de descuento o préstamos con parámetros agresivos.',
      history: [] as Array<{ action: string; result: string }>
    },
    {
      name: 'Echo',
      key: ALICE_KEY,
      role: 'Temporal State Fuzzer & Invariant Tester',
      objective: 'Alternar entre staking, avance temporal (warp_time) y reclamación de recompensas para estresar los timers de bloqueo y los dividendos.',
      history: [] as Array<{ action: string; result: string }>
    }
  ];

  console.log('🧠 [3/4] Iniciando bucle OODA con Reseteo Automático de Estado...\n');

  const TOTAL_ROUNDS = 2;
  let totalCalls = 0;
  let defendedAttacks = 0;
  let successfulMutations = 0;
  let allInvariantsHealthy = true;

  for (let round = 1; round <= TOTAL_ROUNDS; round++) {
    console.log(`----------------------------------------------------------------`);
    console.log(`📍 RONDA EXPLORATORIA #${round}/${TOTAL_ROUNDS}`);
    console.log(`----------------------------------------------------------------`);

    for (const agent of agents) {
      // 1. Revertir blockchain al estado génesis limpio
      await env.revertSnapshot(baseSnapshot);
      baseSnapshot = await env.createSnapshot();

      const client = env.getWalletClient(agent.key as `0x${string}`);
      // 2. Fondeo limpio exclusivo para este turno
      await env.setupInitialLiquidity(client.account!.address, 20000, 2000);
      const state = await env.getAgentState(client.account!.address);

      console.log(`\n🕵️  Agente: [${agent.name}] (${agent.role})`);
      console.log(`   [ESTADO LIMPIO] NAV: $${state.protocol.navPerShareUSD.toFixed(4)} | Saldo: ${state.balances.USDC.toFixed(2)} USDC | ${state.balances.ALPHA.toFixed(2)} ALPHA`);
      console.log(`   Pensando hipótesis con Qwen3:8B...`);

      try {
        const t0 = Date.now();
        const decision = await ollama.decideOpenEndedAction({
          personaName: agent.name,
          personaRole: agent.role,
          personaObjective: agent.objective,
          currentState: state,
          protocolManifest,
          recentHistory: agent.history.slice(-3)
        });
        const elapsed = ((Date.now() - t0) / 1000).toFixed(2);

        const targetContract = (decision.contract || 'TREASURY').toUpperCase().trim();
        const targetFunction = (decision.function || 'deposit').trim();

        console.log(`   💡 Hipótesis (${elapsed}s): "${decision.hypothesis}"`);
        console.log(`   🎯 Acción seleccionada: [${targetContract}::${targetFunction}] con args:`, JSON.stringify(decision.args));

        totalCalls++;

        if (targetContract === 'BLOCKCHAIN' && targetFunction === 'warp_time') {
          const seconds = Number(decision.args[0] || 86400);
          await env.warpTime(seconds);
          const msg = `Tiempo avanzado en Anvil: ${(seconds / 86400).toFixed(1)} días`;
          console.log(`   ⏰ ${msg}`);
          agent.history.push({ action: `warp_time(${seconds}s)`, result: 'SUCCESS' });
          successfulMutations++;
        } else {
          const result = await env.executeArbitraryCall(
            client,
            targetContract,
            targetFunction,
            decision.args
          );

          if (result.success) {
            console.log(`   ✅ Ejecución EXITOSA en contrato`);
            if (result.txHash) console.log(`      Tx Hash: ${result.txHash.slice(0, 18)}...`);
            if (result.result !== undefined) console.log(`      Retorno:`, result.result);
            agent.history.push({ action: `${targetContract}::${targetFunction}`, result: 'SUCCESS' });
            successfulMutations++;
          } else {
            console.log(`   🛡️ Revert / Bloqueo del protocolo: "${result.error}"`);
            agent.history.push({ action: `${targetContract}::${targetFunction}`, result: `REVERT: ${result.error}` });
            defendedAttacks++;
          }
        }

        // 3. Comprobación de invariantes post-acción
        const invariants = await env.checkInvariants();
        const failedInvs = invariants.filter(i => !i.passed);
        if (failedInvs.length > 0) {
          allInvariantsHealthy = false;
          console.error(`   ⚠️ ALERTA: Invariante quebrado tras la acción:`, failedInvs.map(f => f.name).join(', '));
        } else {
          console.log(`   🔒 Invariantes post-acción: 100% SALUDABLES`);
        }
      } catch (err: any) {
        console.error(`   ⚠️ Error en turno exploratorio: ${err.message}`);
      }
    }
  }

  console.log('\n================================================================');
  console.log('🔍 [4/4] RESUMEN DE SEGURIDAD DEL FUZZER AISLADO');
  console.log('================================================================');
  console.log(`  • Llamadas exploradas:             ${totalCalls}`);
  console.log(`  • Mutaciones legítimas exitosas:   ${successfulMutations}`);
  console.log(`  • Intentos de ataque defendidos:   ${defendedAttacks}`);
  console.log(`  • Integridad de invariantes:       ${allInvariantsHealthy ? '✅ 100% INTACTOS (Protocolo blindado)' : '❌ QUEBRADOS'}`);
  console.log('================================================================\n');

  // Dejar Anvil limpio al finalizar
  await env.revertSnapshot(baseSnapshot);
}

runAutonomousExploratoryFuzzer().catch(err => {
  console.error('Fatal fuzzer error:', err);
  process.exit(1);
});
