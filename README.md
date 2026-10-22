# 🚀 ALPHA CENTAURI PROTOCOL — V6.2.0 (AUDIT-READY)

[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue.svg)](https://soliditylang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2.1-purple.svg)](https://vitejs.dev/)
[![Foundry](https://img.shields.io/badge/Foundry-Anvil-orange.svg)](https://getfoundry.sh/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E--Audit-green.svg)](https://playwright.dev/)
[![Docker](https://img.shields.io/badge/Docker-WSL2-blue.svg)](https://www.docker.com/)

> **Protocolo DeFi de Tesorería Descentralizada con Proof of Reserves (PoR) Exógeno Puro, Invariantes Matemáticas Formales, Protección Anti-MEV Flash Loan, Bonos Vestados ERC-721, Vesting por Salud de Reservas y Mercado P2P Colateralizado.**

---

## 📋 Índice
1. [Visión General & Modelo de Reservas Exógenas Puras](#-visión-general--modelo-de-reservas-exógenas-puras)
2. [Arquitectura de Seguridad & Auditoría Institucional](#-arquitectura-de-seguridad--auditoría-institucional)
3. [Despliegue Rápido (Un Solo Clic)](#-despliegue-rápido-un-solo-clic)
4. [Estructura del Proyecto & Clean Architecture](#-estructura-del-proyecto--clean-architecture)
5. [Los 8 Pilares Centrales Auditados](#-los-8-pilares-centrales-auditados-100-mainnet-ready)
6. [Institutional Quality Gate (14/14 Comprobaciones en Verde)](#-institutional-quality-gate-1414-comprobaciones-en-verde)
7. [Estrategia de Ramas Git & Flujo de Desarrollo](#-estrategia-de-ramas-git--flujo-de-desarrollo)
8. [Guía de Traspaso / Handover para Agentes de IA](#-guía-de-traspaso--handover-para-agentes-de-ia)
9. [Documentación Adicional](#-documentación-adicional)

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

## 🛡️ Arquitectura de Seguridad & Auditoría Institucional

El protocolo cuenta con una suite de auditoría matemática de grado Mainnet dividida en 3 pilares:

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

---

## ⚡ Despliegue Rápido (Un Solo Clic)

### 🚀 Lanzamiento y Despliegue Ultrarrápido

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
3. Despliega los 25 Smart Contracts y actualiza las direcciones on-chain.
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
├── services/                # Servicios backend (core deployment, indexador de bloques, reconciliador PoR)
├── docs/                    # Documentación técnica extendida (Handover, Tokenomics, Arquitectura)
├── start_app.ps1            # Script de lanzamiento completo PowerShell
└── start_app.bat            # Ejecutable Batch para Windows
```

---

## 🏛️ Los 8 Pilares Centrales Auditados (100% Mainnet-Ready)

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

Incluye el estado completo del repositorio, cómo levantar Anvil/Frontend paso a paso, mitigaciones de carteras Web3 (Rabby/MetaMask), y registro de decisiones de arquitectura.

---

## 📚 Documentación Adicional

La carpeta [`docs/`](docs) contiene los manuales técnicos extendidos del sistema:

- 🤖 [**Manual de Traspaso Técnico para Agentes de IA**](docs/AGENT_HANDOVER.md)
- 📊 [**Modelo Económico & Tokenomics (Biblia Canónica)**](docs/TOKENOMICS.md)
- 🏗️ [**Especificación de Arquitectura Completa**](docs/FULL_ARCHITECTURE_SPECIFICATION.md)
- 📄 [**Whitepaper Completo**](docs/WHITE_PAPER.md)
- 🧪 [**Auditoría de Interfaz y UI Testing**](ui_audit_report.md)
