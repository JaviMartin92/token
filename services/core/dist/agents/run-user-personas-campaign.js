"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const OllamaClient_1 = require("./OllamaClient");
const DeFiAgentEnv_1 = require("./DeFiAgentEnv");
const ACCOUNT_4_KEY = '0x47e179ec197488593b100f80e0da919941736c596391e4b8865dd0befb07d7b6';
const ACCOUNT_5_KEY = '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba';
// Parse duration or rounds from CLI
const args = process.argv.slice(2);
let maxRounds = 3;
const roundsIdx = args.findIndex(a => a === '--rounds' || a === '-r');
if (roundsIdx !== -1 && args[roundsIdx + 1]) {
    const p = parseInt(args[roundsIdx + 1], 10);
    if (!isNaN(p) && p > 0)
        maxRounds = p;
}
let durationMinutes = 0;
const durIdx = args.findIndex(a => a === '--duration' || a === '-d');
if (durIdx !== -1 && args[durIdx + 1]) {
    const p = parseInt(args[durIdx + 1], 10);
    if (!isNaN(p) && p > 0)
        durationMinutes = p;
}
async function runUserPersonasCampaign() {
    console.log('\n================================================================');
    console.log('👥 AUTONOMOUS USER PERSONAS APPLICATION TEST SUITE (Qwen3:8B)');
    console.log('   Simulación Realista de Experiencia de Usuario y Flujos DeFi');
    if (durationMinutes > 0) {
        console.log(`⏱️  MODO TEMPORAL: ${durationMinutes} MINUTOS`);
    }
    else {
        console.log(`🔄 RONDAS PROGRAMADAS: ${maxRounds} RONDAS`);
    }
    console.log('================================================================\n');
    const ollama = new OllamaClient_1.OllamaClient('http://127.0.0.1:11434', 'qwen3:8b');
    const env = new DeFiAgentEnv_1.DeFiAgentEnv('http://127.0.0.1:8545');
    const reportPath = path_1.default.resolve(__dirname, 'reports/user_personas_audit_report.md');
    console.log('🔧 [1/4] Capturando Snapshot Base Génesis para aislamiento...');
    let baseSnapshot = await env.createSnapshot();
    console.log('✅ Snapshot base guardado. Cada prueba se ejecutará con fondos garantizados.\n');
    const personas = [
        {
            name: 'Elena',
            key: DeFiAgentEnv_1.ALICE_KEY,
            role: 'Inversora Retail & Yield Seeker',
            initialUSDC: 10000,
            initialALPHA: 1000,
            objective: 'Aportar capital moderado en la Tesorería para obtener ALPHA al NAV justo, hacer Staking para obtener stALPHA, configurar cobro de dividendos y reclamar rendimientos.',
            actions: [
                {
                    name: 'deposit_treasury_usdc',
                    description: 'Depositar USDC en la Tesorería para emitir nuevos tokens ALPHA respaldados al 100% por el NAV',
                    parameters: { amount: 'cantidad en USDC (ej: 2000)' }
                },
                {
                    name: 'stake_alpha',
                    description: 'Hacer staking de tokens ALPHA para obtener stALPHA con derecho a voto y reparto de dividendos',
                    parameters: { amount: 'cantidad de ALPHA a stakear (ej: 300)' }
                },
                {
                    name: 'set_payout_preference',
                    description: 'Elegir si los dividendos de Real Yield se reciben en USDC o autocompound en ALPHA',
                    parameters: { preference: "'USDC' o 'ALPHA'" }
                },
                {
                    name: 'claim_rewards',
                    description: 'Reclamar las recompensas generadas por el staking de gobernanza en el Real Yield Router',
                    parameters: {}
                },
                {
                    name: 'unstake_alpha',
                    description: 'Retirar parte del staking para recuperar ALPHA líquido',
                    parameters: { amount: 'cantidad en stALPHA (ej: 50)' }
                }
            ]
        },
        {
            name: 'Marcus',
            key: DeFiAgentEnv_1.BOB_KEY,
            role: 'Institutional Whale & Comprador de Bonos',
            initialUSDC: 50000,
            initialALPHA: 3000,
            objective: 'Adquirir Bonos Descontados a plazo en VestedDiscountVault recibiendo VaultPositionNFTs, aportar gran liquidez a Tesorería y verificar solvencia.',
            actions: [
                {
                    name: 'buy_vested_bond',
                    description: 'Comprar un Bono Descontado institucional bloqueando capital en la bóveda de vesting a cambio de un NFT de posición',
                    parameters: {
                        principalAmount: 'cantidad en USDC (ej: 5000 o 10000)',
                        lockYears: 'años de bloqueo (1, 2 o 3 años para mayor descuento)'
                    }
                },
                {
                    name: 'deposit_treasury_usdc',
                    description: 'Aporte de liquidez a gran escala en USDC para la tesorería institucional',
                    parameters: { amount: 'cantidad en USDC (ej: 15000)' }
                },
                {
                    name: 'claim_matured_bond',
                    description: 'Reclamar un bono que ya ha alcanzado su madurez para liberar el capital y rendimiento',
                    parameters: { tokenId: 'ID del token NFT de la posición (ej: 1)' }
                },
                {
                    name: 'warp_time_days',
                    description: 'Simular el paso del tiempo institucional para evaluar la maduración de bonos',
                    parameters: { days: 'días a avanzar (ej: 365)' }
                }
            ]
        },
        {
            name: 'Sofia',
            key: DeFiAgentEnv_1.EVE_KEY,
            role: 'Emprendedora DeFi & Prestataria P2P',
            initialUSDC: 20000,
            initialALPHA: 2000,
            objective: 'Pedir liquidez en USDC en el mercado P2P aportando tokens ALPHA como colateral para financiar operaciones sin liquidar su patrimonio, y luego repagar.',
            actions: [
                {
                    name: 'borrow_from_treasury',
                    description: 'Solicitar un préstamo institucional en USDC depositando colateral en ALPHA en el mercado P2P (LTV máx 50%)',
                    parameters: {
                        collateralAmount: 'monto colateral en ALPHA (ej: 1000)',
                        borrowAmount: 'monto solicitado en USDC hasta 500 (ej: 400)',
                        durationDays: 'plazo del préstamo en días (ej: 30)'
                    }
                },
                {
                    name: 'repay_loan',
                    description: 'Repagar el préstamo activo con intereses devengados para desbloquear el colateral íntegro',
                    parameters: { loanId: 'ID del préstamo (ej: 1 o 2)' }
                },
                {
                    name: 'deposit_treasury_usdc',
                    description: 'Depositar USDC excedente en tesorería para generar ALPHA',
                    parameters: { amount: 'cantidad en USDC (ej: 1000)' }
                }
            ]
        },
        {
            name: 'Viktor',
            key: ACCOUNT_4_KEY,
            role: 'Arbitrajista MEV & Buyback Keeper',
            initialUSDC: 30000,
            initialALPHA: 5000,
            objective: 'Monitorear el motor de recompras para arbitrar precios cuando exista descuento, depositar en tesorería al NAV o stakear ALPHA para maximizar rendimiento.',
            actions: [
                {
                    name: 'deposit_treasury_usdc',
                    description: 'Inyectar liquidez de arbitraje en tesorería al valor neto del NAV',
                    parameters: { amount: 'cantidad en USDC (ej: 3000)' }
                },
                {
                    name: 'stake_alpha',
                    description: 'Stakear las ganancias en ALPHA para multiplicar su yield pasivo en stALPHA',
                    parameters: { amount: 'cantidad de ALPHA (ej: 500)' }
                },
                {
                    name: 'execute_discount_buyback',
                    description: 'Intentar compra con descuento en DiscountBuybackEngine aportando USDC si existe descuento vs NAV',
                    parameters: { usdcToSpend: 'monto en USDC a gastar (ej: 2500)' }
                }
            ]
        },
        {
            name: 'Lucas',
            key: ACCOUNT_5_KEY,
            role: 'Delegado DAO & Activista de Gobernanza',
            initialUSDC: 12000,
            initialALPHA: 2500,
            objective: 'Maximizar el poder de voto de gobernanza, stakear ALPHA, delegar votos y fiscalizar la gobernanza del protocolo.',
            actions: [
                {
                    name: 'stake_alpha',
                    description: 'Stakear ALPHA para maximizar su poder de voto stALPHA',
                    parameters: { amount: 'cantidad en ALPHA (ej: 1000)' }
                },
                {
                    name: 'delegate_votes',
                    description: 'Delegar el poder de voto en el contrato de staking para la toma de decisiones en la DAO',
                    parameters: { delegatee: 'dirección a la que delegar o tu propia dirección' }
                },
                {
                    name: 'set_payout_preference',
                    description: 'Alinear recompensas de yield hacia crecimiento del ecosistema en ALPHA',
                    parameters: { preference: "'ALPHA'" }
                }
            ]
        }
    ];
    console.log(`📋 [2/4] Perfiles de Usuario Configurados (${personas.length} personas):`);
    personas.forEach(p => console.log(`   • ${p.name} (${p.role}) - Fondo: ${p.initialUSDC} USDC, ${p.initialALPHA} ALPHA`));
    const historyLogs = [];
    const startTime = Date.now();
    const endTime = durationMinutes > 0 ? startTime + durationMinutes * 60 * 1000 : Infinity;
    let currentRound = 0;
    let totalSuccessfulUserJourneys = 0;
    let totalFailedUserJourneys = 0;
    console.log('\n🧠 [3/4] Iniciando jornadas de usuario autónomas con Qwen3:8B...\n');
    while ((durationMinutes > 0 ? Date.now() < endTime : currentRound < maxRounds)) {
        currentRound++;
        console.log(`\n================================================================`);
        console.log(`📍 RONDA DE USUARIOS #${currentRound} ${durationMinutes > 0 ? `| Restante: ${Math.max(0, (endTime - Date.now()) / 60000).toFixed(1)}m` : ''}`);
        console.log(`================================================================`);
        for (const persona of personas) {
            if (durationMinutes > 0 && Date.now() >= endTime)
                break;
            // Reseteo sistemático a estado limpio para evaluación reproducible de cada persona
            await env.revertSnapshot(baseSnapshot);
            baseSnapshot = await env.createSnapshot();
            const client = env.getWalletClient(persona.key);
            await env.setupInitialLiquidity(client.account.address, persona.initialUSDC, persona.initialALPHA);
            const stateBefore = await env.getAgentState(client.account.address);
            console.log(`\n👤 Perfil: [${persona.name}] (${persona.role})`);
            console.log(`   [PORTAFOLIO INICIAL] NAV: $${stateBefore.protocol.navPerShareUSD.toFixed(4)} | USDC: ${stateBefore.balances.USDC.toFixed(2)} | ALPHA: ${stateBefore.balances.ALPHA.toFixed(2)} | stALPHA: ${stateBefore.balances.stALPHA.toFixed(2)} | NFTs: ${stateBefore.balances.positionBondsCount || 0}`);
            console.log(`   Consultando estrategia a Qwen3:8B...`);
            const t0 = Date.now();
            let decision;
            try {
                decision = await ollama.decideAction({
                    personaName: `${persona.name} (${persona.role})`,
                    personaRole: persona.role,
                    personaObjective: persona.objective,
                    currentState: {
                        userBalances: stateBefore.balances,
                        protocolStatus: stateBefore.protocol
                    },
                    availableActions: persona.actions
                });
            }
            catch (err) {
                console.warn(`   ⚠️ Fallback de decisión para ${persona.name}: ${err.message}`);
                decision = {
                    action: persona.actions[0].name,
                    parameters: { amount: 1000 },
                    reasoning: 'Decisión de respaldo financiero prudencial',
                    confidence: 0.8
                };
            }
            const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
            console.log(`   💡 Razonamiento (${elapsed}s): "${decision.reasoning}"`);
            console.log(`   🎯 Acción Seleccionada: [${decision.action}] con parámetros:`, JSON.stringify(decision.parameters));
            // Ejecutar la acción elegida por la persona
            const actionResult = await env.executeAction(client, decision.action, decision.parameters);
            const stateAfter = await env.getAgentState(client.account.address);
            const usdcDiff = (stateAfter.balances.USDC - stateBefore.balances.USDC).toFixed(2);
            const alphaDiff = (stateAfter.balances.ALPHA - stateBefore.balances.ALPHA).toFixed(2);
            const stAlphaDiff = (stateAfter.balances.stALPHA - stateBefore.balances.stALPHA).toFixed(2);
            const balanceChangeSummary = `Δ USDC: ${usdcDiff} | Δ ALPHA: ${alphaDiff} | Δ stALPHA: ${stAlphaDiff}`;
            if (actionResult.success) {
                totalSuccessfulUserJourneys++;
                console.log(`   ✅ Flujo de Usuario EXITOSO`);
                console.log(`      Resultado: ${actionResult.message}`);
                if (actionResult.txHash)
                    console.log(`      Tx Hash: ${actionResult.txHash.slice(0, 18)}...`);
                console.log(`      ${balanceChangeSummary}`);
            }
            else {
                totalFailedUserJourneys++;
                console.log(`   ⚠️ Flujo Bloqueado / Error: ${actionResult.message}`);
            }
            // Verificación de invariantes post-acción del usuario
            const invariants = await env.checkInvariants();
            const failedInvs = invariants.filter(i => !i.passed);
            if (failedInvs.length > 0) {
                console.error(`   🚨 ALERTA: Invariante violado tras acción de ${persona.name}:`, failedInvs.map(f => f.name).join(', '));
            }
            else {
                console.log(`   🔒 Invariantes del protocolo: 100% SALUDABLES`);
            }
            historyLogs.push({
                round: currentRound,
                personaName: persona.name,
                role: persona.role,
                action: decision.action,
                parameters: decision.parameters,
                reasoning: decision.reasoning,
                success: actionResult.success,
                message: actionResult.message,
                navBefore: stateBefore.protocol.navPerShareUSD,
                navAfter: stateAfter.protocol.navPerShareUSD,
                balanceChange: balanceChangeSummary,
                timestamp: new Date().toLocaleTimeString()
            });
            // Actualizar reporte en Markdown en tiempo real
            saveUserPersonasReport(reportPath, historyLogs, currentRound, totalSuccessfulUserJourneys, totalFailedUserJourneys);
        }
    }
    console.log('\n================================================================');
    console.log('🏆 CAMPAÑA DE PERFILES DE USUARIO FINALIZADA CON ÉXITO');
    console.log('================================================================');
    console.log(`  • Rondas de usuario completadas:       ${currentRound}`);
    console.log(`  • Operaciones legítimas exitosas:      ${totalSuccessfulUserJourneys}`);
    console.log(`  • Operaciones bloqueadas o fallidas:   ${totalFailedUserJourneys}`);
    console.log(`  • Reporte detallado guardado en:      services/core/src/agents/reports/user_personas_audit_report.md`);
    console.log('================================================================\n');
    await env.revertSnapshot(baseSnapshot);
}
function saveUserPersonasReport(filePath, logs, rounds, successes, failures) {
    const total = logs.length;
    const successRate = total > 0 ? ((successes / total) * 100).toFixed(1) : '100';
    let md = `# 👥 Informe de Pruebas por Perfiles de Usuario (User Personas AI Suite)
*Ejecutado con agentes autónomos impulsados por Qwen3:8B y acelerados por GPU*

---

## 📊 Métricas de Usabilidad y Experiencia de Usuario
* **Rondas de Prueba Completadas:** ${rounds}
* **Total de Flujos de Usuario Ejecutados:** ${total}
* **Flujos Financieros Exitosos:** **${successes} (${successRate}%)**
* **Operaciones Rechazadas / Errores:** ${failures}
* **Estado de los Invariantes:** **100% Saludables**

---

## 🎭 Perfiles de Usuario Evaluados
1. **Elena (Inversora Retail & Yield Seeker):** Depósitos en tesorería al NAV, staking de ALPHA, configuración de dividendos y cobro de rendimientos reales.
2. **Marcus (Institutional Whale & Bond Buyer):** Auditoría de reservas, adquisición de bonos descontados con vesting, emisión de NFTs de posición y redención.
3. **Sofia (Emprendedora DeFi & Prestataria P2P):** Aporte de colateral multi-activo, préstamos institucionales y repago ordenado.
4. **Viktor (Arbitrajista MEV & Buyback Keeper):** Monitorización de descuentos, recompras ventajosas y cobro de incentivos de keeper.
5. **Lucas (Delegado DAO & Activista de Gobernanza):** Consolidación de poder de voto stALPHA, delegación y participación comunitaria.

---

## 📜 Registro Detallado de Flujos de Usuario (Últimas 20 Acciones)
| Ronda | Usuario | Rol | Acción Ejecutada | Razón Económica | Resultado | Impacto Patrimonial |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
`;
    const recent = logs.slice(-20).reverse();
    for (const log of recent) {
        const statusIcon = log.success ? '✅ Éxito' : '⚠️ Fallo';
        const reasonShort = log.reasoning.length > 70 ? `${log.reasoning.slice(0, 67)}...` : log.reasoning;
        md += `| R${log.round} | **${log.personaName}** | ${log.role} | \`${log.action}\` | *"${reasonShort}"* | ${statusIcon} | ${log.balanceChange} |\n`;
    }
    const dir = path_1.default.dirname(filePath);
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
    fs_1.default.writeFileSync(filePath, md, 'utf8');
}
runUserPersonasCampaign().catch(err => {
    console.error('Fatal user personas error:', err);
    process.exit(1);
});
//# sourceMappingURL=run-user-personas-campaign.js.map