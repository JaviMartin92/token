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

  console.log('🔧 [1/4] Capturando Snapshot Base Génesis para aislamiento...');
  let baseSnapshot = await env.createSnapshot();
  console.log('✅ Snapshot base guardado. Cada acción se ejecutará sobre un sistema inmaculado.\n');

  const agents = [
    {
      name: 'Cipher',
      key: EVE_KEY,
      role: 'Zero-Day Security Researcher',
      objective: 'Sondear accesos no autorizados, bypass de roles de administración, timelock, governance y llamadas a circuit breakers.',
      assignedContracts: ['CIRCUIT_BREAKER', 'TREASURY', 'STAKING', 'TIMELOCK', 'GOVERNOR', 'POST_QUANTUM_GUARD', 'FOUNDER_VESTING_VAULT', 'ATOMIC_SWAP'],
      history: [] as Array<{ action: string; result: string }>
    },
    {
      name: 'Apex',
      key: BOB_KEY,
      role: 'MEV Arbitrageur & Liquidity Sniper',
      objective: 'Atacar Buyback Engine, Mercado P2P, Alpha Vault y Router de rendimientos buscando discrepancias de precios o liquidaciones.',
      assignedContracts: ['DISCOUNT_BUYBACK_ENGINE', 'P2P_MARKET', 'REAL_YIELD_ROUTER', 'ALPHA_VAULT', 'MORPHO_ADAPTER', 'TOKENOMICS_ENGINE', 'ORACLE_HUB', 'DYNAMIC_YIELD_ORACLE'],
      history: [] as Array<{ action: string; result: string }>
    },
    {
      name: 'Echo',
      key: ALICE_KEY,
      role: 'State Machine & Temporal Fuzzer',
      objective: 'Estresar bóvedas de vesting, incentivos promocionales, posiciones NFT y avanzar el tiempo temporal de la cadena.',
      assignedContracts: ['VESTED_VAULT', 'COMMUNITY_YIELD_VAULT', 'PROMO_VAULT', 'POSITION_NFT', 'RESERVE_MANAGER', 'ALPHA_TOKEN', 'USDC', 'BLOCKCHAIN'],
      history: [] as Array<{ action: string; result: string }>
    }
  ];

  const allMonitoredContracts = Array.from(new Set(agents.flatMap(a => a.assignedContracts))).filter(c => c !== 'BLOCKCHAIN');
  console.log(`📋 [2/4] Contratos bajo supervisión activa (${allMonitoredContracts.length} contratos): ${allMonitoredContracts.join(', ')}`);

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
      const directive = await teamLead.evaluateAndIssueDirective(allMonitoredContracts);
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

      // Obtener el manifiesto base para los contratos del agente
      const rawManifest = env.registry.getProtocolManifest(agent.assignedContracts.filter(c => c !== 'BLOCKCHAIN'));
      if (agent.assignedContracts.includes('BLOCKCHAIN')) {
        rawManifest['BLOCKCHAIN'] = {
          address: '0x0000000000000000000000000000000000000000',
          functions: ['warp_time(uint256 seconds)']
        };
      }

      // Filtrar el manifiesto eliminando funciones saturadas y repetitivas
      let activeManifest = teamLead.filterManifest(rawManifest, agent.name);

      // Calcular funciones vírgenes (nunca probadas por ningún agente)
      const uncovered = teamLead.getUncoveredFunctions(agent.assignedContracts, env.registry);
      const saturated = teamLead.getSaturatedFunctions(agent.name);

      console.log(`\n🕵️  Agente: [${agent.name}] (${agent.role})`);
      console.log(`   [ESTADO LIMPIO] NAV: $${state.protocol.navPerShareUSD.toFixed(4)} | Saldo: ${state.balances.USDC.toFixed(2)} USDC`);
      console.log(`   🎯 Opciones activas sin saturar: ${Object.keys(activeManifest).length} contratos | Vírgenes: ${uncovered.length}`);
      console.log(`   Pensando hipótesis con Qwen3:8B bajo directiva de Orion...`);

      try {
        let approved = false;
        let attempt = 0;
        let targetContract = agent.assignedContracts[0];
        let targetFunction = 'deposit';
        let finalArgs: any[] = [];
        let finalHypothesis = '';

        while (!approved && attempt < 3) {
          attempt++;
          const t0 = Date.now();

          // Construir directivas y recomendaciones precisas para Qwen3:8B
          const uncoveredHint = uncovered.length > 0
            ? `\n🎯 OBJETIVO RECOMENDADO POR ORION (AÚN INTACTO): Prioriza atacar una de estas funciones nunca probadas: ${uncovered.slice(0, 3).map(u => `${u.contract}::${u.function}`).join(', ')}.`
            : '';
          const saturatedWarning = saturated.length > 0
            ? `\n🚫 ESTRICTAMENTE PROHIBIDO repetir estas funciones saturadas: ${saturated.slice(0, 5).join(', ')}.`
            : '';

          const personaObjective = attempt === 1
            ? `${agent.objective} DIRECTIVA DE ORION: "${currentDirective.guidance}". Foco prioritario: ${agent.assignedContracts.slice(0, 4).join(', ')}.${uncoveredHint}${saturatedWarning}`
            : `⛔ RECHAZO DE ORION: Tu propuesta anterior fue bloqueada por ser repetitiva o saturada. DEBES seleccionar un contrato y función DIFERENTE del catálogo filtrado.${uncoveredHint}`;

          const decision = await ollama.decideOpenEndedAction({
            personaName: `${agent.name} (Supervisado por Orion)`,
            personaRole: agent.role,
            personaObjective,
            currentState: state,
            protocolManifest: activeManifest,
            recentHistory: agent.history.slice(-2)
          });
          const elapsed = ((Date.now() - t0) / 1000).toFixed(2);

          targetContract = (decision.contract || agent.assignedContracts[0]).toUpperCase().trim();
          targetFunction = (decision.function || 'deposit').trim();
          finalArgs = decision.args;
          finalHypothesis = decision.hypothesis;

          // Si el modelo propuso un contrato fuera de sus asignados, reasignar a uno de sus contratos activos
          if (!agent.assignedContracts.includes(targetContract)) {
            const availableContracts = Object.keys(activeManifest);
            targetContract = availableContracts.length > 0 ? availableContracts[0] : agent.assignedContracts[0];
          }

          const check = teamLead.isRepetitiveAction(agent.name, targetContract, targetFunction);
          if (check.repetitive) {
            totalRejectionsByLead++;
            console.warn(`   👮 [Orion RECHAZA intento #${attempt}]: ${check.reason}`);
            agent.history.push({
              action: `${targetContract}::${targetFunction}`,
              result: 'REVERT: Rechazado por Orion (Repetitivo)'
            });

            // Podar inmediatamente la función rechazada del manifiesto activo para el siguiente intento
            if (activeManifest[targetContract]?.functions) {
              activeManifest[targetContract].functions = activeManifest[targetContract].functions.filter(
                (f: string) => !f.toLowerCase().startsWith(targetFunction.toLowerCase())
              );
              if (activeManifest[targetContract].functions.length === 0) {
                delete activeManifest[targetContract];
              }
            }

            // Si el modelo vuelve a fallar en el intento 2, Orion interviene y asigna directamente una función virgen
            if (attempt >= 2) {
              if (uncovered.length > 0) {
                const pick = uncovered[Math.floor(Math.random() * Math.min(3, uncovered.length))];
                targetContract = pick.contract;
                targetFunction = pick.function;
                finalArgs = targetContract === 'BLOCKCHAIN' ? [86400] : [];
                finalHypothesis = `Asignación táctica forzada por Orion sobre función virgen [${targetContract}::${targetFunction}] para erradicar repetición`;
                approved = true;
                console.log(`   🔄 [Orion Desbloquea]: Asignando forzosamente función intacta [${targetContract}::${targetFunction}]`);
              } else {
                // Si no hay vírgenes, tomar cualquier función de contrato alternativo disponible en activeManifest
                const altContracts = Object.keys(activeManifest).filter(c => c !== targetContract);
                const pickContract = altContracts.length > 0 ? altContracts[0] : agent.assignedContracts[0];
                const funcs = activeManifest[pickContract]?.functions || ['deposit'];
                targetContract = pickContract;
                targetFunction = (funcs[0] || 'deposit').split('(')[0];
                finalHypothesis = `Reasignación táctica de Orion a ${targetContract}::${targetFunction}`;
                approved = true;
                console.log(`   🔄 [Orion Desbloquea]: Reasignando a [${targetContract}::${targetFunction}]`);
              }
            }
          } else {
            approved = true;
            console.log(`   💡 Hipótesis (${elapsed}s): "${finalHypothesis}"`);
            console.log(`   🎯 Acción aprobada: [${targetContract}::${targetFunction}] con args:`, JSON.stringify(finalArgs));
          }
        }

        totalApprovedCalls++;

        if (targetContract === 'BLOCKCHAIN' && targetFunction === 'warp_time') {
          const seconds = Number(finalArgs[0] || 86400);
          await env.warpTime(seconds);
          const msg = `Tiempo avanzado en Anvil: ${(seconds / 86400).toFixed(1)} días`;
          console.log(`   ⏰ ${msg}`);

          teamLead.recordAction({
            agent: agent.name,
            round,
            contract: 'BLOCKCHAIN',
            function: 'warp_time',
            args: finalArgs,
            hypothesis: finalHypothesis,
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
            finalArgs
          );

          if (result.success) {
            console.log(`   ✅ Ejecución EXITOSA en contrato`);
            if (result.txHash) console.log(`      Tx Hash: ${result.txHash.slice(0, 18)}...`);
            teamLead.recordAction({
              agent: agent.name,
              round,
              contract: targetContract,
              function: targetFunction,
              args: finalArgs,
              hypothesis: finalHypothesis,
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
              args: finalArgs,
              hypothesis: finalHypothesis,
              result: 'REVERT',
              detail: result.error || 'Revert',
              timestamp: new Date().toLocaleTimeString()
            });
            agent.history.push({ action: `${targetContract}::${targetFunction}`, result: `REVERT: ${result.error}` });
          }
        }

        // Comprobación de invariantes post-acción
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
