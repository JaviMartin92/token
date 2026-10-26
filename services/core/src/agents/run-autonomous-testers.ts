import { OllamaClient } from './OllamaClient';
import {
  DeFiAgentEnv,
  ALICE_KEY,
  BOB_KEY,
  EVE_KEY
} from './DeFiAgentEnv';
import { privateKeyToAccount } from 'viem/accounts';

async function runAutonomousAgentSuite() {
  console.log('\n================================================================');
  console.log('🤖  AUTONOMOUS MULTI-AGENT DEFI TESTER SUITE (Powered by Qwen3:8B)');
  console.log('================================================================\n');

  const ollama = new OllamaClient('http://127.0.0.1:11434', 'qwen3:8b');
  const env = new DeFiAgentEnv('http://127.0.0.1:8545');

  const aliceAcc = privateKeyToAccount(ALICE_KEY);
  const bobAcc = privateKeyToAccount(BOB_KEY);
  const eveAcc = privateKeyToAccount(EVE_KEY);

  console.log('🔧 [1/4] Inicializando liquidez y cuentas de prueba...');
  const snapshotId = await env.createSnapshot();

  // Asegurar reserva base en Tesorería
  try {
    await env.adminClient.writeContract({
      address: env.contracts.USDC,
      abi: [
        { name: 'mint', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] }
      ],
      functionName: 'mint',
      args: [env.contracts.ALPHA_VAULT, BigInt(100000 * 1e6)]
    });
  } catch {}

  await env.setupInitialLiquidity(aliceAcc.address, 10000, 1000);
  await env.setupInitialLiquidity(bobAcc.address, 50000, 5000);
  await env.setupInitialLiquidity(eveAcc.address, 5000, 500);
  console.log('✅ Cuentas fondeadas y registradas en KYC de Tesorería.\n');

  const personas = [
    {
      name: 'Alice',
      key: ALICE_KEY,
      role: 'Retail Staker & Rendimiento Pasivo',
      objective: 'Maximizar el rendimiento acumulando stALPHA en gobernanza, configurar el router de recompensas a USDC o ALPHA según convenga.',
      actions: [
        {
          name: 'stake_alpha',
          description: 'Hacer staking de ALPHA para recibir stALPHA con derecho a voto y yield real',
          parameters: { amount: 'cantidad en tokens ALPHA a stakear (ej: 250)' }
        },
        {
          name: 'set_payout_preference',
          description: 'Elegir si los dividendos se pagan en USDC o se autocompoundean en ALPHA',
          parameters: { preference: "'USDC' o 'ALPHA'" }
        },
        {
          name: 'claim_rewards',
          description: 'Reclamar las recompensas generadas por el staking de gobernanza',
          parameters: {}
        }
      ]
    },
    {
      name: 'Bob',
      key: BOB_KEY,
      role: 'Institutional Whale & Prestatario',
      objective: 'Aportar capital fresco en USDC a la tesorería para respaldar el NAV o solicitar préstamos contra garantía en el mercado P2P.',
      actions: [
        {
          name: 'deposit_treasury_usdc',
          description: 'Depositar USDC en la Tesorería para emitir nuevos tokens ALPHA según el NAV',
          parameters: { amount: 'cantidad en USDC (ej: 5000)' }
        },
        {
          name: 'borrow_from_treasury',
          description: 'Pedir un préstamo en USDC aportando colateral',
          parameters: {
            collateralAmount: 'cantidad de USDC colateral (ej: 2000)',
            borrowAmount: 'cantidad de USDC a pedir prestada (ej: 1000)',
            durationDays: 'días del préstamo (ej: 30)'
          }
        },
        {
          name: 'redeem_alpha_usdc',
          description: 'Redimir tokens ALPHA en la tesorería para retirar USDC líquido',
          parameters: { amount: 'cantidad de ALPHA a redimir (ej: 100)' }
        }
      ]
    },
    {
      name: 'Eve',
      key: EVE_KEY,
      role: 'Chaos Monkey & Red Team Exploiter',
      objective: 'Buscar vulnerabilidades, intentar saltos en el tiempo (warp) o ejecutar llamadas con límites extremos para comprobar que el protocolo se defiende.',
      actions: [
        {
          name: 'warp_time_days',
          description: 'Adelantar el reloj de la blockchain para probar el fin de periodos de bloqueo o expiración de préstamos',
          parameters: { days: 'días a avanzar (ej: 15)' }
        },
        {
          name: 'probe_unauthorized_call',
          description: 'Intentar rescatar una cantidad absurda de fondos sin balance suficiente para probar el revert seguro',
          parameters: {}
        },
        {
          name: 'stake_alpha',
          description: 'Stakear ALPHA para probar la consistencia tras saltos temporales',
          parameters: { amount: 'cantidad de ALPHA (ej: 50)' }
        }
      ]
    }
  ];

  console.log('🧠 [2/4] Ejecutando simulación de toma de decisiones autónomas...\n');

  for (let round = 1; round <= 2; round++) {
    console.log(`----------------------------------------------------------------`);
    console.log(`📍 RONDA DE PRUEBAS #${round}`);
    console.log(`----------------------------------------------------------------`);

    for (const persona of personas) {
      const client = env.getWalletClient(persona.key as `0x${string}`);
      const state = await env.getAgentState(client.account!.address);

      console.log(`\n👤 Agente: [${persona.name}] (${persona.role})`);
      console.log(`   Balance: ${state.balances.USDC.toFixed(2)} USDC | ${state.balances.ALPHA.toFixed(2)} ALPHA | ${state.balances.stALPHA.toFixed(2)} stALPHA`);
      console.log(`   Consultando razonamiento a Qwen3:8B...`);

      try {
        const t0 = Date.now();
        const decision = await ollama.decideAction({
          personaName: persona.name,
          personaRole: persona.role,
          personaObjective: persona.objective,
          currentState: state,
          availableActions: persona.actions
        });
        const elapsed = ((Date.now() - t0) / 1000).toFixed(2);

        console.log(`   💭 Razón (${elapsed}s): "${decision.reasoning}"`);
        console.log(`   🎯 Acción elegida: [${decision.action}] con parámetros:`, JSON.stringify(decision.parameters));

        const result = await env.executeAction(client, decision.action, decision.parameters);
        if (result.success) {
          console.log(`   ✅ Resultado: ${result.message}`);
          if (result.txHash) console.log(`      Tx Hash: ${result.txHash.slice(0, 18)}...`);
        } else {
          console.log(`   🛡️ Protocol Guard: ${result.message}`);
        }
      } catch (err: any) {
        console.error(`   ⚠️ Error durante el turno del agente: ${err.message}`);
      }
    }
  }

  console.log('\n================================================================');
  console.log('🔍 [3/4] VERIFICACIÓN FORMAL DE INVARIANTES POST-EJECUCIÓN');
  console.log('================================================================');

  const invariants = await env.checkInvariants();
  let allPassed = true;

  for (const inv of invariants) {
    if (inv.passed) {
      console.log(`  ✅ [PASS] ${inv.name}`);
      console.log(`     ↳ ${inv.metric}`);
    } else {
      allPassed = false;
      console.error(`  ❌ [FAIL] ${inv.name}`);
      console.error(`     ↳ ${inv.metric}`);
      if (inv.error) console.error(`     ↳ Detalle: ${inv.error}`);
    }
  }

  console.log('\n================================================================');
  console.log('📊 [4/4] RESUMEN DE LA SESIÓN DE AGENTES TESTER');
  console.log('================================================================');
  if (allPassed) {
    console.log('🏆 ESTADO DEL PROTOCOLO: 100% SALUDABLE');
    console.log('   Los agentes autónomos interactuaron sin corromper el balance');
    console.log('   de tesorería, manteniendo el respaldo 1:1 y los circuit breakers.');
  } else {
    console.error('⚠️ ALERTA: Uno o más invariantes se han quebrado.');
  }
  console.log('================================================================\n');
}

runAutonomousAgentSuite().catch(err => {
  console.error('Fatal agent suite error:', err);
  process.exit(1);
});
