import { OllamaClient } from './OllamaClient';
import {
  DeFiAgentEnv,
  ALICE_KEY,
  BOB_KEY,
  EVE_KEY
} from './DeFiAgentEnv';
import { TeamLeadOrchestrator } from './TeamLeadOrchestrator';
import { privateKeyToAccount } from 'viem/accounts';

// Parse command line arguments for duration (default: 120 minutes)
const args = process.argv.slice(2);
let durationMinutes = 120; // 2 hours by default
const durationIdx = args.findIndex(a => a === '--duration' || a === '-d');
if (durationIdx !== -1 && args[durationIdx + 1]) {
  const parsed = parseInt(args[durationIdx + 1], 10);
  if (!isNaN(parsed) && parsed > 0) durationMinutes = parsed;
}

async function runAutonomousSecurityCampaign() {
  console.log('\n================================================================');
  console.log('🏛️  AUTONOMOUS DEFI SECURITY AUDIT CAMPAIGN (Qwen3:8B + Team Lead)');
  console.log(`⏱️  DURACIÓN PROGRAMADA: ${durationMinutes} MINUTOS (${(durationMinutes / 60).toFixed(1)} Horas)`);
  console.log('================================================================\n');

  const ollama = new OllamaClient('http://127.0.0.1:11434', 'qwen3:8b');
  const env = new DeFiAgentEnv('http://127.0.0.1:8545');
  const teamLead = new TeamLeadOrchestrator(ollama);

  const cipherAcc = privateKeyToAccount(EVE_KEY);    // Zero-Day Hunter
  const apexAcc = privateKeyToAccount(BOB_KEY);       // MEV Arbitrageur
  const echoAcc = privateKeyToAccount(ALICE_KEY);     // Temporal State Fuzzer

  console.log('🔧 [1/4] Capturando Snapshot Base Génesis para aislamiento...');
  let baseSnapshot = await env.createSnapshot();
  console.log('✅ Snapshot base guardado. Cada acción se ejecutará sobre un sistema inmaculado.\n');

  const targetContracts = [
    'TREASURY',
    'STAKING',
    'DISCOUNT_BUYBACK_ENGINE',
    'P2P_MARKET',
    'REAL_YIELD_ROUTER',
    'CIRCUIT_BREAKER'
  ];

  const protocolManifest = env.registry.getProtocolManifest(targetContracts);
  console.log(`📋 [2/4] Catálogo de contratos expuesto al equipo: ${targetContracts.join(', ')}`);

  const agents = [
    {
      name: 'Cipher',
      key: EVE_KEY,
      role: 'Zero-Day Security Researcher',
      objective: 'Sondear accesos no autorizados, bypass de roles en contratos DeFi y llamadas con argumentos anómalos.',
      history: [] as Array<{ action: string; result: string }>
    },
    {
      name: 'Apex',
      key: BOB_KEY,
      role: 'MEV Arbitrageur & Liquidity Sniper',
      objective: 'Atacar Buyback Engine, Tesorería y préstamos P2P buscando discrepancias de precios o descuentos ventajosos.',
      history: [] as Array<{ action: string; result: string }>
    },
    {
      name: 'Echo',
      key: ALICE_KEY,
      role: 'State Machine & Temporal Fuzzer',
      objective: 'Probar staking, mecanismos de dividendos y avanzar el tiempo de la cadena para evaluar vencimientos.',
      history: [] as Array<{ action: string; result: string }>
    }
  ];

  const startTime = Date.now();
  const endTime = startTime + durationMinutes * 60 * 1000;
  let round = 0;
  let totalApprovedCalls = 0;
  let totalRejectionsByLead = 0;

  console.log('🧠 [3/4] Desplegando bucle continuo de auditoría supervisada por el Jefe de Equipo...\n');

  while (Date.now() < endTime) {
    round++;
    const elapsedMinutes = ((Date.now() - startTime) / 60000).toFixed(1);
    const remainingMinutes = Math.max(0, ((endTime - Date.now()) / 60000)).toFixed(1);

    console.log(`\n================================================================`);
    console.log(`📍 RONDA #${round} | ⏳ Transcurrido: ${elapsedMinutes}m | Restante: ${remainingMinutes}m`);
    console.log(`================================================================`);

    // El Jefe de Equipo evalúa y actualiza directivas cada 2 rondas
    if (round === 1 || round % 2 === 1) {
      console.log('👑 [Jefe de Equipo Orion]: Evaluando diversidad del equipo y emitiendo directiva...');
      const directive = await teamLead.evaluateAndIssueDirective(targetContracts);
      console.log(`   🎖️ Puntuación del Equipo: ${directive.overallScore}/100`);
      console.log(`   🎯 Foco Asignado: ${directive.focusAreas.join(', ')}`);
      if (directive.bannedFunctions.length > 0) {
        console.log(`   🚫 Funciones Restringidas: ${directive.bannedFunctions.join(', ')}`);
      }
      console.log(`   📜 Directiva Táctica: "${directive.guidance}"`);
    }

    const currentDirective = teamLead.getCurrentDirective();

    for (const agent of agents) {
      if (Date.now() >= endTime) break;

      // Reseteo estricto a estado limpio antes de cada acción
      await env.revertSnapshot(baseSnapshot);
      baseSnapshot = await env.createSnapshot();

      const client = env.getWalletClient(agent.key as `0x${string}`);
      await env.setupInitialLiquidity(client.account!.address, 20000, 2000);
      const state = await env.getAgentState(client.account!.address);

      console.log(`\n🕵️  Agente: [${agent.name}] (${agent.role})`);
      console.log(`   [ESTADO LIMPIO] NAV: $${state.protocol.navPerShareUSD.toFixed(4)} | Saldo: ${state.balances.USDC.toFixed(2)} USDC`);
      console.log(`   Pensando hipótesis con Qwen3:8B bajo directiva del Jefe...`);

      try {
        const t0 = Date.now();
        const decision = await ollama.decideOpenEndedAction({
          personaName: `${agent.name} (Bajo supervisión de Orion. Foco obligatorio: ${currentDirective.focusAreas.join(', ')})`,
          personaRole: agent.role,
          personaObjective: `${agent.objective} IMPORTANTE: Obedece la directiva del Jefe de Equipo: "${currentDirective.guidance}". EVITA repetir llamadas ya probadas.`,
          currentState: state,
          protocolManifest,
          recentHistory: agent.history.slice(-3)
        });
        const elapsed = ((Date.now() - t0) / 1000).toFixed(2);

        const targetContract = (decision.contract || 'TREASURY').toUpperCase().trim();
        const targetFunction = (decision.function || 'deposit').trim();

        console.log(`   💡 Hipótesis (${elapsed}s): "${decision.hypothesis}"`);
        console.log(`   🎯 Acción propuesta: [${targetContract}::${targetFunction}] con args:`, JSON.stringify(decision.args));

        // Control de Calidad del Jefe de Equipo (Anti-repetición)
        const check = teamLead.isRepetitiveAction(agent.name, targetContract, targetFunction);
        if (check.repetitive) {
          totalRejectionsByLead++;
          console.warn(`   👮 [Jefe de Equipo RECHAZA]: ${check.reason}`);
          agent.history.push({
            action: `${targetContract}::${targetFunction}`,
            result: 'REVERT: Rechazado por el Jefe de Equipo (Acción repetitiva)'
          });
          continue; // Pasa al siguiente agente para no desperdiciar tiempo en llamadas redundantes
        }

        totalApprovedCalls++;

        if (targetContract === 'BLOCKCHAIN' && targetFunction === 'warp_time') {
          const seconds = Number(decision.args[0] || 86400);
          await env.warpTime(seconds);
          const msg = `Tiempo avanzado en Anvil: ${(seconds / 86400).toFixed(1)} días`;
          console.log(`   ⏰ ${msg}`);

          teamLead.recordAction({
            agent: agent.name,
            round,
            contract: 'BLOCKCHAIN',
            function: 'warp_time',
            args: decision.args,
            hypothesis: decision.hypothesis,
            result: 'SUCCESS',
            detail: msg,
            timestamp: new Date().toLocaleTimeString()
          });
          agent.history.push({ action: `warp_time(${seconds}s)`, result: 'SUCCESS' });
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
            teamLead.recordAction({
              agent: agent.name,
              round,
              contract: targetContract,
              function: targetFunction,
              args: decision.args,
              hypothesis: decision.hypothesis,
              result: 'SUCCESS',
              detail: `Status: ${result.result}`,
              timestamp: new Date().toLocaleTimeString()
            });
            agent.history.push({ action: `${targetContract}::${targetFunction}`, result: 'SUCCESS' });
          } else {
            console.log(`   🛡️ Revert / Bloqueo del protocolo: "${result.error}"`);
            teamLead.recordAction({
              agent: agent.name,
              round,
              contract: targetContract,
              function: targetFunction,
              args: decision.args,
              hypothesis: decision.hypothesis,
              result: 'REVERT',
              detail: result.error || 'Revert',
              timestamp: new Date().toLocaleTimeString()
            });
            agent.history.push({ action: `${targetContract}::${targetFunction}`, result: `REVERT: ${result.error}` });
          }
        }

        // Comprobar invariantes tras la acción
        const invariants = await env.checkInvariants();
        const failedInvs = invariants.filter(i => !i.passed);
        if (failedInvs.length > 0) {
          console.error(`   ⚠️ ALERTA DE SEGURIDAD: Invariante violado tras la acción:`, failedInvs.map(f => f.name).join(', '));
        } else {
          console.log(`   🔒 Invariantes del protocolo: 100% SALUDABLES`);
        }
      } catch (err: any) {
        console.error(`   ⚠️ Error en turno de agente: ${err.message}`);
      }
    }
  }

  console.log('\n================================================================');
  console.log('🏆 CAMPAÑA DE SEGURIDAD AUTÓNOMA FINALIZADA');
  console.log('================================================================');
  console.log(`  • Rondas completadas:                 ${round}`);
  console.log(`  • Llamadas validadas y ejecutadas:    ${totalApprovedCalls}`);
  console.log(`  • Acciones redundantes bloqueadas:   ${totalRejectionsByLead}`);
  console.log(`  • Reporte en tiempo real guardado en: services/core/src/agents/reports/campaign_audit_report.md`);
  console.log('================================================================\n');

  await env.revertSnapshot(baseSnapshot);
}

runAutonomousSecurityCampaign().catch(err => {
  console.error('Fatal campaign error:', err);
  process.exit(1);
});
