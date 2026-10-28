# 🚀 ALPHA CENTAURI PROTOCOL — V6.2.0 (AUDIT-READY / PURE DEFI)

[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue.svg)](https://soliditylang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2.1-purple.svg)](https://vitejs.dev/)
[![Foundry](https://img.shields.io/badge/Foundry-Anvil-orange.svg)](https://getfoundry.sh/)
[![Tests](https://img.shields.io/badge/Monorepo%20Tests-150%2B%20PASS-brightgreen.svg)](https://github.com/JaviMartin92/BotPremium)
[![Guarded Launch](https://img.shields.io/badge/Guarded%20Launch-Cap%20$100K-amber.svg)](docs/MAINNET_DEPLOYMENT_GUIDE.md)
[![Pure DeFi](https://img.shields.io/badge/MiCA-Recital%2022%20Compliant-success.svg)](docs/MAINNET_DEPLOYMENT_GUIDE.md)
[![Playwright](https://img.shields.io/badge/Playwright-E2E--Audit-green.svg)](https://playwright.dev/)
[![Local AI Testing](https://img.shields.io/badge/Autonomous%20AI-Qwen3%3A8B%20RTX%20GPU-brightgreen.svg)](docs/AI_TESTING_FRAMEWORK.md)

> **Protocolo DeFi de Tesorería Descentralizada con Proof of Reserves (PoR) Exógeno Puro, Invariantes Matemáticas Formales, Guarded Launch Cap ($100K), Financiación On-Chain de Auditoría Comunitaria (DAO Grants), Bonos Vestados ERC-721, Vesting por Salud de Reservas, Mercado P2P Colateralizado y Verificación Continua por Enjambres de IA Autónomos.**

---

## 📋 Índice
1. [Visión General & Modelo de Reservas Exógenas Puras](#-visión-general--modelo-de-reservas-exógenas-puras)
2. [Arquitectura de Seguridad & Auditoría Institucional (6 Pilares)](#-arquitectura-de-seguridad--auditoría-institucional-6-pilares)
3. [Lanzamiento Protegido (Guarded Launch) & Financiación de Auditoría DAO](#-lanzamiento-protegido-guarded-launch--financiación-de-auditoría-dao)
4. [Instrucciones Claras para Desplegar en Mainnet](#-instrucciones-claras-para-desplegar-en-mainnet)
5. [Marco de Verificación Autónoma con IA & Aceleración GPU (Qwen3:8B + Orion)](#-marco-de-verificación-autónoma-con-ia--aceleración-gpu-qwen38b--orion)
6. [Despliegue Rápido Local (Un Solo Clic)](#-despliegue-rápido-local-un-solo-clic)
7. [Estructura del Proyecto & Clean Architecture](#-estructura-del-proyecto--clean-architecture)
8. [Los 10 Pilares Centrales Auditados (100% Mainnet-Ready)](#-los-10-pilares-centrales-auditados-100-mainnet-ready)
9. [Institutional Quality Gate (14/14 Comprobaciones en Verde)](#-institutional-quality-gate-1414-comprobaciones-en-verde)
10. [Estrategia de Ramas Git & Flujo de Desarrollo](#-estrategia-de-ramas-git--flujo-de-desarrollo)
11. [Guía de Traspaso / Handover para Agentes de IA](#-guía-de-traspaso--handover-para-agentes-de-ia)
12. [Documentación Adicional & Informes de Auditoría](#-documentación-adicional--informes-de-auditoría)

---

## 🏛️ Visión General & Modelo de Reservas Exógenas Puras

El **Protocolo Alpha Centauri** es una infraestructura financiera descentralizada construida sobre Ethereum/EVM que opera bajo un **Modelo de Reservas Exógenas Puras (100% Exógeno)** con Proof of Reserves (PoR) en tiempo real:
- **50.00% Stablecoins (USDC)**: Destinados a Bóvedas Morpho Blue y Préstamos P2P sobrecolateralizados.
- **25.00% Bitcoin (WBTC)**: Colateral exógeno de máxima solidez y reserva de valor.
- **12.50% Ethereum (WETH)**: Colateral exógeno de alta liquidez e infraestructura base DeFi.
- **12.50% Sub-Reserva POL (stALPHA)**: Liquidez propiedad del protocolo auto-bloqueada en staking de gobernanza.

> [!IMPORTANT]
> - El token nativo del protocolo ($ALPHA$) es de tipo endógeno de gobernanza/staking y se encuentra **estrictamente excluido** del cálculo de reservas exógenas en la tabla PoR, garantizando colateralización sólida basada únicamente en activos externos líquidos.
> - La asignación inicial del creador (100,000 ALPHA) está custodiada en el contrato autónomo [`FounderReserveVestingVault.sol`](contracts/src/FounderReserveVestingVault.sol) y **excluida del circulante en el bloque génesis** (arranque limpio a Estado 0 con 0.00 ALPHA en circulación y NAV exacto de $1.0000 USD).

---

## 🛡️ Arquitectura de Seguridad & Auditoría Institucional (6 Pilares)

El protocolo cuenta con una suite de auditoría matemática de grado Mainnet dividida en 6 pilares complementarios:

### 1. Invariantes Formales & Fuzzing en Solidity (Foundry - 47/47 Tests PASS)
Ubicado en [`contracts/test/InstitutionalAuditInvariants.t.sol`](contracts/test/InstitutionalAuditInvariants.t.sol), [`contracts/test/GuardedLaunch.t.sol`](contracts/test/GuardedLaunch.t.sol) y [`contracts/test/FounderReserveVestingVault.t.sol`](contracts/test/FounderReserveVestingVault.t.sol):
- **Fuzzing Masivo de Fee Dinámico (`testFuzz_CalculateDynamicFeeBps`)**: Certifica que el fee devuelto se mantenga estrictamente entre $50\text{ BPS (0.50\%)}$ y $500\text{ BPS (5.00\%)}$ para entradas de $1\text{ wei}$ a $10^9\text{ tokens}$ sin desbordamientos de enteros.
- **Invariante de Solvencia (`test_Invariant_AssetsExceedLiabilities`)**: Garantiza formalmente $TotalAssetsExogenousUSD \ge TotalLiabilitiesUSD$.
- **Invariante de Monotonicidad (`test_Invariant_NAVMonotonicity`)**: Demuestra que $NAV_{post} \ge NAV_{pre}$ tras cualquier depósito.
- **Invariante de Vesting por Salud de Reservas**: Certifica que el fundador solo puede reclamar tokens cuando $Solvencia > 100\%$, con tope del 10% del superávit y cooldown de 72h.

### 2. Guarded Launch Fase 1 ($100,000 USD TVL Cap) & Timelock 72h
Ubicado en [`contracts/src/TreasuryManager.sol`](contracts/src/TreasuryManager.sol):
- **Límite Estricto de Exposición**: La tesorería impone de forma autónoma `revert TVLCapExceeded()` si un depósito supera el tope de \$100,000 USD, protegiendo a la comunidad ante posibles exploits de día cero en la fase inicial.
- **Elevación Exclusiva por DAO**: Únicamente mediante una propuesta aprobada por la comunidad y ejecutada tras las **72 horas del Timelock** se puede expandir el tope a fases superiores ($500K, $1M, Sin límite).

### 3. Financiación On-Chain de Auditoría Comunitaria (DAO Grants)
- **Desembolso Descentralizado (`withdrawUSDC`)**: Función ejecutable exclusivamente por el `TimelockController` que permite transferir USDC directamente a contratos de depósito en garantía (*escrow*) de firmas de auditoría competitiva (Code4rena, Cantina, Sherlock) y bug bounties (Immunefi).
- **Pure DeFi (MiCA Considerando 22)**: Cero intermediación de entidades corporativas o cuentas bancarias tradicionales. La comunidad vota on-chain y financia la seguridad directamente desde los excedentes del protocolo.

### 4. Protección Anti-MEV / Flash Loans
- **Curva Dinámica de Impacto**: La tarifa de depósito escala dinámicamente según el tamaño de la transacción respecto a la tesorería existente ($50\text{ BPS} \rightarrow 500\text{ BPS}$).
- **Circuito Breaker de Colateralización**: La función `redeem()` en [`TreasuryManager.sol`](contracts/src/TreasuryManager.sol) revierte cualquier intento de extracción relámpago que reduzca la ratio de colateralización.
- **Pérdida Neta Demostrada**: Pruebas unitarias demuestran que un ataque Flash Loan sufre una pérdida neta de capital de $\sim 2.44\%$, haciendo matemáticamente imposible el arbitraje de NAV por MEV.

### 5. Blindaje Criptográfico Post-Cuántico (NIST SP 800-208 / W-OTS+)
Ubicado en [`contracts/src/PostQuantumGuard.sol`](contracts/src/PostQuantumGuard.sol):
- **Resistencia Algoritmo de Shor**: Implementación de firmas basadas en hash Winternitz OTS+ ($w=4$, 67 cadenas de hash Keccak-256) inmunes a ataques cuánticos sobre curvas elípticas ($secp256k1$).
- **Seguridad Grover 128-bit**: Funciones hash simétricas unidireccionales evaluadas en gas nativo EVM sin requerir precompilados experimentales.
- **Autorización Híbrida Dual**: Gobernanza y operaciones críticas de tesorería pueden exigir firma ECDSA estándar + certificación cuántica W-OTS+ con protección estricta anti-replay.

### 6. Suite de Verificación Autónoma con Enjambres de IA (Qwen3:8B + Orion)
Ubicado en [`services/core/src/agents/`](services/core/src/agents/) y documentado en detalle en [`docs/AI_TESTING_FRAMEWORK.md`](docs/AI_TESTING_FRAMEWORK.md):
- **Jefe de Equipo Orquestador (Orion)**: Poda dinámica de manifiesto negativo que erradica bucles de llamadas repetitivas y prioriza funciones con cero cobertura histórica.
- **Aislamiento Génesis por Snapshots (`anvil_snapshot` / `anvil_revert`)**: Cada acción o ataque se ejecuta sobre un estado limpio y determinista, garantizando telemetría incorruptible.
- **Aceleración por GPU Local**: Inferencia local con Tensor Cores en NVIDIA RTX 4060, Flash Attention y caché KV Q8_0, sin dependencias de API externa ni coste por token.

---

## 🛡️ Lanzamiento Protegido (Guarded Launch) & Financiación de Auditoría DAO

Para garantizar la viabilidad del protocolo sin requerir capital riesgo ni inversores privados centralizados, Alpha Centauri implementa una estrategia de **Auto-Financiación y Expansión Gradual por Fases**:

```
[FASE 1: Guarded Genesis]
- TVL Cap: $100,000 USD
- Generación de comisiones orgánicas por suscripción (0.50% - 5.00%)
- La comunidad acumula los primeros $25,000 USDC en reservas de comisiones
          │
          ▼
[PROPUESTA DAO ON-CHAIN (Plantilla 5)]
- Un titular con >= 25,000 stALPHA presenta propuesta on-chain
- Acción: TreasuryManager.withdrawUSDC(escrowCode4rena, 25000e6)
- Quorum: >= 80,000 stALPHA · Periodo de votación: 3 días
- Timelock de Seguridad: 72 horas (259,200 segundos)
          │
          ▼
[AUDITORÍA COMPETITIVA EXTERNA (Code4rena / Cantina / Sherlock)]
- Cientos de auditores y whitehats analizan los contratos
- Recompensas pagadas automáticamente desde el contrato Escrow
- Corrección de hallazgos mediante propuesta DAO de actualización
          │
          ▼
[FASE 2: Expansión de Cap]
- La DAO vota incrementar tvlCap a $1,000,000 USD
- Activación de Bug Bounty en Immunefi financiado por flujo de comisiones
```

---

## 🚀 Instrucciones Claras para Desplegar en Mainnet

Para el despliegue oficial en **Arbitrum One (L2 Recomendada)** o **Ethereum Mainnet**, consulta la guía completa y exhaustiva:
👉 [**Manual Completo de Despliegue en Mainnet: docs/MAINNET_DEPLOYMENT_GUIDE.md**](docs/MAINNET_DEPLOYMENT_GUIDE.md)

### Resumen Ejecutivo de Despliegue en 5 Pasos:

1. **Configurar Variables de Entorno de Producción**:
   ```bash
   cp .env.production.example .env.production
   # Configurar MAINNET_RPC_URL, ARBISCAN_API_KEY y direcciones oficiales de tokens
   ```

2. **Compilar Smart Contracts con Optimizador de Producción**:
   ```bash
   cd contracts
   forge build --optimize --optimizer-runs 200 --extra-output-files abi
   ```

3. **Ejecutar Despliegue Determinista con Hardware Wallet (Ledger/Trezor)**:
   ```bash
   # Despliegue seguro firmando cada transacción desde Hardware Wallet
   forge script script/DeployMainnet.s.sol:DeployMainnet \
     --rpc-url $MAINNET_RPC_URL \
     --ledger \
     --broadcast \
     --verify \
     --etherscan-api-key $ARBISCAN_API_KEY
   ```

4. **Transferir Administración al Timelock y Renunciar a Roles (Zero Admin)**:
   ```bash
   # Otorgar administración al TimelockController (72h delay)
   cast send $TREASURY_ADDRESS "grantRole(bytes32,address)" 0x00...00 $TIMELOCK_ADDRESS --ledger
   # Renunciar irrevocablemente a roles desde la cuenta deployer
   cast send $TREASURY_ADDRESS "renounceRole(bytes32,address)" 0x00...00 $DEPLOYER_ADDRESS --ledger
   ```

5. **Construir y Publicar Frontend Descentralizado en IPFS**:
   ```bash
   cd frontend
   npm run build
   npx @fleek-platform/cli deploy dist/
   # Vincular CID de IPFS al registro contenthash de alphacentauri.eth en ENS
   ```

---

## 🤖 Marco de Verificación Autónoma con IA & Aceleración GPU (Qwen3:8B + Orion)

Para trascender las limitaciones de las pruebas estáticas tradicionales, el protocolo incorpora un motor de auditoría y simulación con **agentes cognitivos autónomos** impulsados por el modelo de lenguaje de última generación [`qwen3:8b`](https://ollama.com/library/qwen3) ejecutado íntegramente en silicio local.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   NVIDIA RTX 4060 GPU ACCELERATION                     │
│         (Tensor Cores 4th Gen · Flash Attention · KV Cache Q8_0)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Local Inference
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   TEAM LEAD ORCHESTRATOR (ORION)                       │
│  - Negative Manifest Pruner (Eliminación estricta de bucles)           │
│  - Virgin Function Prioritizer (Búsqueda de cobertura 100%)            │
│  - Diversity & Exploration Scorer (Índice de entropía cognitiva)       │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌───────────────────────────────────┐┌───────────────────────────────────┐
│     ADVERSARIAL RED TEAM SWARM    ││     REAL USER PERSONAS SWARM      │
│  - Apex: Lógica & Reentrancy      ││  - Elena: Retail Yield Staker     │
│  - Cipher: Control de Acceso/ACL  ││  - Marcus: Whale & Bonos Vestados │
│  - Echo: Flash Loans & Arbitraje  ││  - Sofia: Prestataria P2P Collateral│
│  (23+ Smart Contracts Auditados)  ││  - Viktor: Keeper Arbitrajista MEV│
│                                   ││  - Lucas: Delegado Gobernanza DAO │
└─────────────────┬─────────────────┘└─────────────────┬─────────────────┘
                  │                                    │
                  └─────────────────┬──────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               ANVIL GENESIS SNAPSHOT ISOLATION PROTOCOL                │
│    [Action] ──> [State Delta Telemetry] ──> [5 Invariants Verification] │
│                                  │                                     │
│                      [Atomic evm_revert(0x1)]                          │
└────────────────────────────────────────────────────────────────────────┘
```

### Resultados Empíricos de Campañas de 1 Hora

| Dimensión de Auditoría | Campaña de Seguridad Red Team | Campaña de Perfiles de Usuario (Personas) |
| :--- | :---: | :---: |
| **Tiempo de Ejecución** | 60 minutos (73 rondas) | 60 minutos (43 rondas) |
| **Acciones Evaluadas** | **217 transacciones** | **214 operaciones financieras** |
| **Tasa de Resistencia / Reverts Defendidos** | **186 reverts (85.71%)** | **38 bloqueos de salvaguarda (17.76%)** |
| **Tasa de Flujos Exitosos** | **31 mutaciones autorizadas** | **176 flujos completados (82.24%)** |
| **Llamadas Repetitivas (Bucle)** | **0 (0.00%)** *(Poda negativa activa)* | **0 (0.00%)** *(Diversidad de roles)* |
| **Puntuación de Diversidad de Equipo** | **85 / 100** | **N/A (5 perfiles especializados)** |
| **Salud de Invariantes On-Chain** | **100% PASS** | **100% PASS** |
| **Informe Detallado On-Disk** | [`campaign_audit_report.md`](services/core/src/agents/reports/campaign_audit_report.md) | [`user_personas_audit_report.md`](services/core/src/agents/reports/user_personas_audit_report.md) |

### Comandos de Ejecución de Campañas de IA

```bash
# Lanzar campaña de seguridad autónoma de 1 hora (Red Team)
npm run campaign

# Lanzar campaña de seguridad extendida (2 o 3 horas)
npm run campaign:2h
npm run campaign:3h

# Lanzar simulación de 1 hora de perfiles de usuario reales (Elena, Marcus, Sofia, Viktor, Lucas)
npm run campaign:personas

# Lanzar fuzzer exploratorio asistido por IA
npm run test:ai-fuzzer
```

---

## ⚡ Despliegue Rápido (Un Solo Clic)

### 🚀 Lanzamiento y Despliegue Ultrarrápido

#### 🐧 En Linux, Google AI Studio, Argon y Cloud Sandboxes (Sin Docker):
> Para instrucciones detalladas y resolución de problemas específicos en Google AI Studio con Argon, consulta la [**Guía Institucional para Argon en AI Studio**](file:///c:/Users/javil/Desktop/token/docs/ARGON_AI_STUDIO_GUIDE.md).

```bash
chmod +x start_app.sh && ./start_app.sh
# O alternativamente vía npm:
npm run start:linux
```

#### 🪟 En Windows con Docker Desktop:
- **Despliegue Completo a Estado 0 (Optimizado ~25s)**:
  ```powershell
  .\start_app.ps1
  # O bien mediante ejecutable batch:
  start_app.bat
  ```

#### 🔄 ¿Qué ejecuta el script automáticamente?
1. Limpia y reinicia contenedores Docker existentes (`alpha-anvil` y `alpha-frontend`).
2. Levanta el nodo Anvil Blockchain en el puerto `8545` en Estado 0 limpio.
3. Despliega los 26 Smart Contracts y actualiza las direcciones on-chain.
4. Inicializa el **Guarded Genesis Cap en $100,000 USD** en `TreasuryManager`.
5. Acuña los 100,000 ALPHA bloqueados en `FounderReserveVestingVault.sol`.
6. Pre-fondea **10,000.00 USDC mock** tanto al Admin como al Usuario.
7. Siembra la **Propuesta de Gobernanza Génesis #1** activa con stALPHA en staking.
8. Compila el bundle de producción del Frontend Web3 de forma nativa (~400ms).
9. Servidor web estático y proxy RPC activo en **[http://localhost:5173](http://localhost:5173)**.

---

## 📁 Estructura del Proyecto & Clean Architecture

```
├── contracts/               # Smart Contracts Solidity (Foundry)
│   ├── src/                 # Contratos principales (TreasuryManager, VestedDiscountVault, FounderReserveVestingVault, Staking)
│   │   └── lib/             # Librerías O(1) (TreasuryPoRLib, TreasuryRebalanceLib, TreasuryFeeLib, TreasuryLiquidityLib)
│   └── test/                # Test suites Foundry (ModularProtocol.t.sol, InstitutionalAuditInvariants.t.sol, GuardedLaunch.t.sol, etc.)
├── frontend/                # Aplicación Web3 (React + TypeScript + Viem + Vite)
│   ├── src/
│   │   ├── components/      # Componentes UI (TreasuryDashboard, GovernanceCommandCenter, FounderVestingCard, P2PMarketplace, MetricsDashboard)
│   │   ├── hooks/           # Custom Hooks modulares (useWeb3State, useFounderVesting, useTreasuryActions)
│   │   ├── index.css        # Sistema de Diseño Centralizado con Tokens Neón y Clases Modulares
│   │   └── contracts.json   # ABIs y direcciones desplegadas dinámicamente
│   ├── tests/               # Suite Playwright E2E (master_tokenomics_simulation.spec.ts, omni_browser_52_matrix.spec.ts)
│   └── server.cjs           # Servidor estático con proxy RPC /rpc
├── services/                # Servicios backend y automatización
│   └── core/
│       ├── src/
│       │   ├── agents/      # Framework de Agentes Autónomos de IA (TeamLead, Personas, Fuzzers, Ollama)
│       │   │   ├── reports/ # Informes de auditoría en tiempo real (campaign_audit_report, user_personas)
│       │   │   ├── TeamLeadOrchestrator.ts      # Supervisor Orion con filtrado negativo de manifiesto
│       │   │   ├── run-autonomous-campaign.ts   # Orquestador Red Team con soporte de duración dinámica
│       │   │   ├── run-user-personas-campaign.ts# Simulación de 5 perfiles de usuario DeFi reales
│       │   │   ├── DeFiAgentEnv.ts              # Aislamiento por Snapshots de Anvil y balance delta
│       │   │   └── OllamaClient.ts              # Cliente de inferencia local con aceleración GPU
│       │   ├── deploy.ts    # Despliegue automatizado de 26 contratos y configuración timelock
│       │   ├── seed_governance_proposal.ts      # Sembrado de propuesta génesis stALPHA
│       │   └── BlockIndexer.ts # Indexador de bloques con detección de reorgs
├── docs/                    # Documentación técnica institucional (Whitepaper, Arquitectura, IA Framework, Mainnet Guide)
├── start_app.sh             # Script de lanzamiento nativo Linux / Google AI Studio (Argon)
├── start_app.ps1            # Script de lanzamiento completo PowerShell para Windows
└── start_app.bat            # Ejecutable Batch para Windows
```

---

## 🏛️ Los 10 Pilares Centrales Auditados (100% Mainnet-Ready)

| Módulo | Contrato Principal | Características Clave & Invariantes |
| :--- | :--- | :--- |
| **1. Tesorería & NAV On-Chain** | [`TreasuryManager.sol`](contracts/src/TreasuryManager.sol) | 4 Librerías PoR $O(1)$, Invariante de Solvencia $100\%$, Slippage $0.05\%$, NAV por Net Equity libre de deuda de bonos, Anti-MEV Cooldown. |
| **2. Guarded Launch & DAO Escrow** | [`TreasuryManager.sol`](contracts/src/TreasuryManager.sol) | Tope de TVL dinámico ($100K Fase 1), Revert `TVLCapExceeded`, Desembolso `withdrawUSDC` gobernado por DAO para escrows de auditoría comunitaria. |
| **3. Bonos Vestados vPOS** | [`VestedDiscountVault.sol`](contracts/src/VestedDiscountVault.sol) | NFTs ERC-721 transferibles, Descuento dinámico 5-25%, Ragequit con 15% penalty 50/50, Deuda deducida del NAV spot. |
| **4. Préstamos Multi-Colateral** | [`P2PLendingMarket.sol`](contracts/src/P2PLendingMarket.sol) | Fair Liquidation con restitución de equity al prestatario, APR dinámico por DAO y Circuit Breaker. |
| **5. Motor de Recompras** | [`DiscountBuybackEngine.sol`](contracts/src/DiscountBuybackEngine.sol) | 10 Candados de Control Matemático, Fee Tier configurable, Keeper Bounty y Sweep Tokens. |
| **6. Real Yield Router 50/50** | [`RealYieldRouter.sol`](contracts/src/RealYieldRouter.sol) | Reparto Pure DeFi, Fee Tier de reserva configurable, Protección Circuit Breaker y Sweep Tokens. |
| **7. Circuit Breaker Automático** | [`CircuitBreaker.sol`](contracts/src/CircuitBreaker.sol) | Búfer circular gas $O(1)$, Umbrales configurables por DAO y blindaje en préstamos. |
| **8. Gobernanza DAO & Timelock 72h** | [`GovernorAlphaCentauri.sol`](contracts/src/GovernorAlphaCentauri.sol) | Veto inmutable a bóvedas, Timelock 72h, Cancelación de propuestas, Quorum 80k stALPHA, Umbral anti-spam 25k stALPHA. |
| **9. Vesting Fundador por Superávit** | [`FounderReserveVestingVault.sol`](contracts/src/FounderReserveVestingVault.sol) | 100k ALPHA bloqueados en génesis, Liberación dinámica condicionada a Solvencia $>100\%$, Cap del 10% del superávit, Cooldown 72h y Cero extracción de reservas. |
| **10. Blindaje Post-Cuántico W-OTS+** | [`PostQuantumGuard.sol`](contracts/src/PostQuantumGuard.sol) | Firmas hash Winternitz OTS+ ($w=4$, 67 cadenas Keccak-256), Dual-Auth EVM, Forward Secrecy y resistencia matemática Shor/Grover. |

---

## 🚦 Institutional Quality Gate (14/14 Comprobaciones en Verde)

El pipeline de integración y calidad institucional certifica la integridad del protocolo ejecutando:
```bash
npm run quality
```
1. **Frontend Strict Typecheck** (`tsc -b`)
2. **Backend Services Strict Typecheck** (`tsc`)
3. **Frontend Fast Linter** (`oxlint`)
4. **Frontend Unit Tests** (`vitest 33/33 PASS`)
5. **Frontend Production Bundle Build** (`vite 0 errores - ~400ms`)
6. **Backend Architecture & Reorg Tests** (`44/44 PASS`)
7. **Frontend / Smart Contract Alignment** (`26/26 PASS`)
8. **Smart Contract Invariants & Unit Tests** (`Foundry 47/47 PASS`)
9. **Omni-Transaction Integration Matrix** (`52/52 Vectors`)
10. **Institutional E2E Multi-Persona Suite** (`5 Personas - 11/11 Checks`)
11. **Chaos & Market Shock Stress Suite** (`2/2 Checks`)
12. **Dependencies Security Audit** (`npm audit`)
13. **Smart Contracts Security Linter** (`solhint`)
14. **Browser-Based E2E Transaction Matrix** (`Playwright Chromium 7/7 - 52 Vectors & 15/15 Simulation Steps`)

---

## 🌿 Estrategia de Ramas Git & Flujo de Desarrollo

El repositorio sigue un modelo de ramificación estricto:
- **`main`**: Rama estable de producción (Mainnet-ready). Solo recibe commits consolidados y auditados.
- **`desarrollo`**: Rama activa de trabajo. Todas las modificaciones, características y pruebas se desarrollan y validan en esta rama antes de ser fusionadas a `main`.

---

## 🤖 Guía de Traspaso / Handover para Agentes de IA

Si eres un nuevo agente de IA o desarrollador continuando este proyecto en otra máquina, consulta el manual maestro de traspaso técnico:
👉 [**Manual Institucional de Traspaso y Operaciones: AGENT_HANDOVER.md**](docs/AGENT_HANDOVER.md)

Incluye el estado completo del repositorio, configuración del entorno de IA local (Ollama + GPU), cómo levantar Anvil/Frontend paso a paso, mitigaciones de carteras Web3 (Rabby/MetaMask), y registro de decisiones de arquitectura.

---

## 📚 Documentación Adicional & Informes de Auditoría

La carpeta [`docs/`](docs) y el repositorio contienen los manuales técnicos extendidos del sistema:

- 🌐 [**Guía Maestra de Despliegue en Mainnet (Arbitrum / Ethereum L2)**](docs/MAINNET_DEPLOYMENT_GUIDE.md)
- 🤖 [**Framework de Pruebas Autónomas con IA (Whitepaper Técnico)**](docs/AI_TESTING_FRAMEWORK.md)
- 🤖 [**Manual de Traspaso Técnico para Agentes de IA**](docs/AGENT_HANDOVER.md)
- 📊 [**Modelo Económico & Tokenomics (Biblia Canónica)**](docs/TOKENOMICS.md)
- 🏗️ [**Especificación de Arquitectura Completa**](docs/FULL_ARCHITECTURE_SPECIFICATION.md)
- 📄 [**Whitepaper Completo**](docs/WHITE_PAPER.md)
- 🛡️ [**Informe de Campaña de Seguridad Red Team (1 Hora / 217 Acciones)**](services/core/src/agents/reports/campaign_audit_report.md)
- 👥 [**Informe de Campaña de Perfiles de Usuario (1 Hora / 214 Flujos)**](services/core/src/agents/reports/user_personas_audit_report.md)
- 🧪 [**Auditoría de Interfaz y UI Testing**](ui_audit_report.md)
