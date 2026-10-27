# 🚀 ALPHA CENTAURI PROTOCOL — V6.2.0 (AUDIT-READY)

[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue.svg)](https://soliditylang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2.1-purple.svg)](https://vitejs.dev/)
[![Foundry](https://img.shields.io/badge/Foundry-Anvil-orange.svg)](https://getfoundry.sh/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E--Audit-green.svg)](https://playwright.dev/)
[![Docker](https://img.shields.io/badge/Docker-WSL2-blue.svg)](https://www.docker.com/)
[![Local AI Testing](https://img.shields.io/badge/Autonomous%20AI-Qwen3%3A8B%20RTX%20GPU-brightgreen.svg)](docs/AI_TESTING_FRAMEWORK.md)

> **Protocolo DeFi de Tesorería Descentralizada con Proof of Reserves (PoR) Exógeno Puro, Invariantes Matemáticas Formales, Protección Anti-MEV Flash Loan, Bonos Vestados ERC-721, Vesting por Salud de Reservas, Mercado P2P Colateralizado y Verificación Continua por Enjambres de IA Autónomos.**

---

## 📋 Índice
1. [Visión General & Modelo de Reservas Exógenas Puras](#-visión-general--modelo-de-reservas-exógenas-puras)
2. [Arquitectura de Seguridad & Auditoría Institucional (5 Pilares)](#-arquitectura-de-seguridad--auditoría-institucional-5-pilares)
3. [Marco de Verificación Autónoma con IA & Aceleración GPU (Qwen3:8B + Orion)](#-marco-de-verificación-autónoma-con-ia--aceleración-gpu-qwen38b--orion)
4. [Despliegue Rápido (Un Solo Clic)](#-despliegue-rápido-un-solo-clic)
5. [Estructura del Proyecto & Clean Architecture](#-estructura-del-proyecto--clean-architecture)
6. [Los 9 Pilares Centrales Auditados (100% Mainnet-Ready)](#-los-9-pilares-centrales-auditados-100-mainnet-ready)
7. [Institutional Quality Gate (14/14 Comprobaciones en Verde)](#-institutional-quality-gate-1414-comprobaciones-en-verde)
8. [Estrategia de Ramas Git & Flujo de Desarrollo](#-estrategia-de-ramas-git--flujo-de-desarrollo)
9. [Guía de Traspaso / Handover para Agentes de IA](#-guía-de-traspaso--handover-para-agentes-de-ia)
10. [Documentación Adicional & Informes de Auditoría](#-documentación-adicional--informes-de-auditoría)

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

## 🛡️ Arquitectura de Seguridad & Auditoría Institucional (5 Pilares)

El protocolo cuenta con una suite de auditoría matemática de grado Mainnet dividida en 5 pilares complementarios:

### 1. Invariantes Formales & Fuzzing en Solidity (Foundry)
Ubicado en [`contracts/test/InstitutionalAuditInvariants.t.sol`](contracts/test/InstitutionalAuditInvariants.t.sol) y [`contracts/test/FounderReserveVestingVault.t.sol`](contracts/test/FounderReserveVestingVault.t.sol):
- **Fuzzing Masivo de Fee Dinámico (`testFuzz_CalculateDynamicFeeBps`)**: Certifica que el fee devuelto se mantenga estrictamente entre $50\text{ BPS (0.50\%)}$ y $500\text{ BPS (5.00\%)}$ para entradas de $1\text{ wei}$ a $10^9\text{ tokens}$ sin desbordamientos de enteros.
- **Invariante de Solvencia (`test_Invariant_AssetsExceedLiabilities`)**: Garantiza formalmente $TotalAssetsExogenousUSD \ge TotalLiabilitiesUSD$.
- **Invariante de Monotonicidad (`test_Invariant_NAVMonotonicity`)**: Demuestra que $NAV_{post} \ge NAV_{pre}$ tras cualquier depósito.
- **Invariante de Vesting por Salud de Reservas**: Certifica que el fundador solo puede reclamar tokens cuando $Solvencia > 100\%$, con tope del 10% del superávit y cooldown de 72h.

### 2. Protección Anti-MEV / Flash Loans
- **Curva Dinámica de Impacto**: La tarifa de depósito escala dinámicamente según el tamaño de la transacción respecto a la tesorería existente ($50\text{ BPS} \rightarrow 500\text{ BPS}$).
- **Circuito Breaker de Colateralización**: La función `redeem()` en [`TreasuryManager.sol`](contracts/src/TreasuryManager.sol) revierte cualquier intento de extracción relámpago que reduzca la ratio de colateralización.
- **Pérdida Neta Demostrada**: Pruebas unitarias demuestran que un ataque Flash Loan sufre una pérdida neta de capital de $\sim 2.44\%$, haciendo matemáticamente imposible el arbitraje de NAV por MEV.

### 3. Aserciones Contables E2E en Playwright
En [`master_tokenomics_simulation.spec.ts`](frontend/tests/master_tokenomics_simulation.spec.ts), cada uno de los 15 pasos de simulación valida que la suma de las filas de reservas coincida con el total en pantalla con un margen estricto $\le \$0.02\text{ USD}$:
$$\text{expect}(\text{Math.abs}(\text{porAssetsTotal} - \text{sumRows})).\text{toBeLessThanOrEqual}(0.02)$$

### 4. Blindaje Criptográfico Post-Cuántico (NIST SP 800-208 / W-OTS+)
Ubicado en [`contracts/src/PostQuantumGuard.sol`](contracts/src/PostQuantumGuard.sol):
- **Resistencia Algoritmo de Shor**: Implementación de firmas basadas en hash Winternitz OTS+ ($w=4$, 67 cadenas de hash Keccak-256) inmunes a ataques cuánticos sobre curvas elípticas ($secp256k1$).
- **Seguridad Grover 128-bit**: Funciones hash simétricas unidireccionales evaluadas en gas nativo EVM sin requerir precompilados experimentales.
- **Autorización Híbrida Dual**: Gobernanza y operaciones críticas de tesorería pueden exigir firma ECDSA estándar + certificación cuántica W-OTS+ con protección estricta anti-replay.

### 5. Suite de Verificación Autónoma con Enjambres de IA (Qwen3:8B + Orion)
Ubicado en [`services/core/src/agents/`](services/core/src/agents/) y documentado en detalle en [`docs/AI_TESTING_FRAMEWORK.md`](docs/AI_TESTING_FRAMEWORK.md):
- **Jefe de Equipo Orquestador (Orion)**: Poda dinámica de manifiesto negativo que erradica bucles de llamadas repetitivas y prioriza funciones con cero cobertura histórica.
- **Aislamiento Génesis por Snapshots (`anvil_snapshot` / `anvil_revert`)**: Cada acción o ataque se ejecuta sobre un estado limpio y determinista, garantizando telemetría incorruptible.
- **Aceleración por GPU Local**: Inferencia local con Tensor Cores en NVIDIA RTX 4060, Flash Attention y caché KV Q8_0, sin dependencias de API externa ni coste por token.

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
- **Despliegue Completo (Cold Start)**:
  ```powershell
  .\start_app.ps1
  # O bien mediante ejecutable batch:
  start_app.bat
  ```

- **Modo Ultra-Rápido (Hot Re-deploy en 8-10 segundos)**:
  ```powershell
  .\start_app.ps1 -Fast
  # O bien mediante ejecutable batch:
  start_app.bat -Fast
  ```

#### 🔄 ¿Qué ejecuta el script automáticamente?
1. Limpia y reinicia contenedores Docker existentes (`alpha-anvil` y `alpha-frontend`).
2. Levanta el nodo Anvil Blockchain en el puerto `8545`.
3. Despliega los 26 Smart Contracts y actualiza las direcciones on-chain.
4. Acuña los 100,000 ALPHA bloqueados en `FounderReserveVestingVault.sol`.
5. Pre-fondea **10,000.00 USDC mock** tanto al Admin como al Usuario.
6. Compila el bundle de producción del Frontend Web3.
7. Servidor web estático y proxy RPC activo en **[http://localhost:5173](http://localhost:5173)**.

---

## 📁 Estructura del Proyecto & Clean Architecture

```
├── contracts/               # Smart Contracts Solidity (Foundry)
│   ├── src/                 # Contratos principales (TreasuryManager, VestedDiscountVault, FounderReserveVestingVault, Staking)
│   │   └── lib/             # Librerías O(1) (TreasuryPoRLib, TreasuryRebalanceLib, TreasuryFeeLib, TreasuryLiquidityLib)
│   └── test/                # Test suites Foundry (ModularProtocol.t.sol, InstitutionalAuditInvariants.t.sol, etc.)
├── frontend/                # Aplicación Web3 (React + TypeScript + Viem + Vite)
│   ├── src/
│   │   ├── components/      # Componentes UI (TreasuryDashboard, FounderVestingCard, P2PMarketplace, MetricsDashboard)
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
│       │   └── BlockIndexer.ts # Indexador de bloques con detección de reorgs
├── docs/                    # Documentación técnica institucional (Whitepaper, Arquitectura, IA Framework, Argon Guide)
├── start_app.sh             # Script de lanzamiento nativo Linux / Google AI Studio (Argon)
├── start_app.ps1            # Script de lanzamiento completo PowerShell para Windows
└── start_app.bat            # Ejecutable Batch para Windows
```

---

## 🏛️ Los 9 Pilares Centrales Auditados (100% Mainnet-Ready)

| Módulo | Contrato Principal | Características Clave & Invariantes |
| :--- | :--- | :--- |
| **1. Tesorería & NAV On-Chain** | [`TreasuryManager.sol`](contracts/src/TreasuryManager.sol) | 4 Librerías PoR $O(1)$, Invariante de Solvencia $100\%$, Slippage $0.05\%$, NAV por Net Equity libre de deuda de bonos, Anti-MEV Cooldown. |
| **2. Bonos Vestados vPOS** | [`VestedDiscountVault.sol`](contracts/src/VestedDiscountVault.sol) | NFTs ERC-721 transferibles, Descuento dinámico 5-25%, Ragequit con 15% penalty 50/50, Deuda deducida del NAV spot. |
| **3. Préstamos Multi-Colateral** | [`P2PLendingMarket.sol`](contracts/src/P2PLendingMarket.sol) | Fair Liquidation con restitución de equity al prestatario, APR dinámico por DAO y Circuit Breaker. |
| **4. Motor de Recompras** | [`DiscountBuybackEngine.sol`](contracts/src/DiscountBuybackEngine.sol) | 10 Candados de Control Matemático, Fee Tier configurable, Keeper Bounty y Sweep Tokens. |
| **5. Real Yield Router 50/50** | [`RealYieldRouter.sol`](contracts/src/RealYieldRouter.sol) | Reparto Pure DeFi, Fee Tier de reserva configurable, Protección Circuit Breaker y Sweep Tokens. |
| **6. Circuit Breaker Automático** | [`CircuitBreaker.sol`](contracts/src/CircuitBreaker.sol) | Búfer circular gas $O(1)$, Umbrales configurables por DAO y blindaje en préstamos. |
| **7. Gobernanza DAO & Timelock 72h** | [`GovernorAlphaCentauri.sol`](contracts/src/GovernorAlphaCentauri.sol) | Veto inmutable a bóvedas, Timelock 72h, Cancelación de propuestas y Votación de 3 Vías con Razón. |
| **8. Vesting Fundador por Superávit** | [`FounderReserveVestingVault.sol`](contracts/src/FounderReserveVestingVault.sol) | 100k ALPHA bloqueados en génesis, Liberación dinámica condicionada a Solvencia $>100\%$, Cap del 10% del superávit, Cooldown 72h y Cero extracción de reservas. |
| **9. Blindaje Post-Cuántico W-OTS+** | [`PostQuantumGuard.sol`](contracts/src/PostQuantumGuard.sol) | Firmas hash Winternitz OTS+ ($w=4$, 67 cadenas Keccak-256), Dual-Auth EVM, Forward Secrecy y resistencia matemática Shor/Grover. |

---

## 🚦 Institutional Quality Gate (14/14 Comprobaciones en Verde)

El pipeline de integración y calidad institucional certifica la integridad del protocolo ejecutando:
```bash
npm run quality
```
1. **Frontend Strict Typecheck** (`tsc -b`)
2. **Backend Services Strict Typecheck** (`tsc`)
3. **Frontend Fast Linter** (`oxlint`)
4. **Frontend Unit Tests** (`vitest 21/21`)
5. **Frontend Production Bundle Build** (`vite`)
6. **Backend Architecture & Reorg Tests** (`44/44`)
7. **Frontend / Smart Contract Alignment** (`26/26`)
8. **Omni-Transaction Integration Matrix** (`52/52 Vectors`)
9. **Institutional E2E Multi-Persona Suite** (`5 Personas - 11/11 Checks`)
10. **Chaos & Market Shock Stress Suite** (`2/2 Checks`)
11. **Dependencies Security Audit** (`npm audit`)
12. **Smart Contracts Security Linter** (`solhint`)
13. **Dead Code & Orphaned Exports Scanner** (`knip`)
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

- 🤖 [**Framework de Pruebas Autónomas con IA (Whitepaper Técnico)**](docs/AI_TESTING_FRAMEWORK.md)
- 🤖 [**Manual de Traspaso Técnico para Agentes de IA**](docs/AGENT_HANDOVER.md)
- 📊 [**Modelo Económico & Tokenomics (Biblia Canónica)**](docs/TOKENOMICS.md)
- 🏗️ [**Especificación de Arquitectura Completa**](docs/FULL_ARCHITECTURE_SPECIFICATION.md)
- 📄 [**Whitepaper Completo**](docs/WHITE_PAPER.md)
- 🛡️ [**Informe de Campaña de Seguridad Red Team (1 Hora / 217 Acciones)**](services/core/src/agents/reports/campaign_audit_report.md)
- 👥 [**Informe de Campaña de Perfiles de Usuario (1 Hora / 214 Flujos)**](services/core/src/agents/reports/user_personas_audit_report.md)
- 🧪 [**Auditoría de Interfaz y UI Testing**](ui_audit_report.md)
