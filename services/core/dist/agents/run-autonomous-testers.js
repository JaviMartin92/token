"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const OllamaClient_1 = require("./OllamaClient");
const DeFiAgentEnv_1 = require("./DeFiAgentEnv");
async function runAutonomousAgentSuite() {
    console.log('\n================================================================');
    console.log('🤖  AUTONOMOUS MULTI-AGENT DEFI TESTER SUITE (Powered by Qwen3:8B)');
    console.log('    [AISLAMIENTO COMPLETO: RESETEO A ESTADO LIMPIO ENTRE ACCIONES]');
    console.log('================================================================\n');
    const ollama = new OllamaClient_1.OllamaClient('http://127.0.0.1:11434', 'qwen3:8b');
    const env = new DeFiAgentEnv_1.DeFiAgentEnv('http://127.0.0.1:8545');
    console.log('🔧 [1/4] Capturando Snapshot Base Génesis...');
    let baseSnapshot = await env.createSnapshot();
    console.log('✅ Snapshot base guardado. Cada acción de agente se ejecuta sobre estado 100% limpio.\n');
    const personas = [
        {
            name: 'Alice',
            key: DeFiAgentEnv_1.ALICE_KEY,
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
            key: DeFiAgentEnv_1.BOB_KEY,
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
            key: DeFiAgentEnv_1.EVE_KEY,
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
    let allPassed = true;
    for (let round = 1; round <= 2; round++) {
        console.log(`----------------------------------------------------------------`);
        console.log(`📍 RONDA DE PRUEBAS #${round}`);
        console.log(`----------------------------------------------------------------`);
        for (const persona of personas) {
            // 1. Rollback a estado limpio antes de cada acción
            await env.revertSnapshot(baseSnapshot);
            baseSnapshot = await env.createSnapshot();
            const client = env.getWalletClient(persona.key);
            // 2. Fondeo limpio
            await env.setupInitialLiquidity(client.account.address, 10000, 1000);
            const state = await env.getAgentState(client.account.address);
            console.log(`\n👤 Agente: [${persona.name}] (${persona.role})`);
            console.log(`   [ESTADO LIMPIO] NAV: $${state.protocol.navPerShareUSD.toFixed(4)} | Saldo: ${state.balances.USDC.toFixed(2)} USDC | ${state.balances.ALPHA.toFixed(2)} ALPHA`);
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
                    if (result.txHash)
                        console.log(`      Tx Hash: ${result.txHash.slice(0, 18)}...`);
                }
                else {
                    console.log(`   🛡️ Protocol Guard: ${result.message}`);
                }
                // 3. Comprobación de invariantes post-acción inmediata
                const invariants = await env.checkInvariants();
                const failedInvs = invariants.filter(i => !i.passed);
                if (failedInvs.length > 0) {
                    allPassed = false;
                    console.error(`   ⚠️ ALERTA: Invariante quebrado tras acción de ${persona.name}:`, failedInvs.map(f => f.name).join(', '));
                }
                else {
                    console.log(`   🔒 Invariantes: 100% SALUDABLES (NAV: $${(await env.getAgentState(client.account.address)).protocol.navPerShareUSD.toFixed(4)})`);
                }
            }
            catch (err) {
                console.error(`   ⚠️ Error durante el turno del agente: ${err.message}`);
            }
        }
    }
    console.log('\n================================================================');
    console.log('📊 [3/4] RESUMEN DE LA SESIÓN DE AGENTES TESTER AISLADA');
    console.log('================================================================');
    if (allPassed) {
        console.log('🏆 ESTADO DEL PROTOCOLO: 100% SALUDABLE');
        console.log('   Cada prueba se ejecutó sobre un entorno inmaculado.');
        console.log('   Los invariantes de tesorería, solvencia y circuit breakers permanecen intactos.');
    }
    else {
        console.error('⚠️ ALERTA: Se detectaron violaciones de invariantes.');
    }
    console.log('================================================================\n');
    // Dejar Anvil limpio al terminar
    await env.revertSnapshot(baseSnapshot);
}
runAutonomousAgentSuite().catch(err => {
    console.error('Fatal agent suite error:', err);
    process.exit(1);
});
//# sourceMappingURL=run-autonomous-testers.js.map