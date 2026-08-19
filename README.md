# 🚀 ALPHA CENTAURI PROTOCOL — V6.0.0 (AUDIT-READY)

[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue.svg)](https://soliditylang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2.1-purple.svg)](https://vitejs.dev/)
[![Foundry](https://img.shields.io/badge/Foundry-Anvil-orange.svg)](https://getfoundry.sh/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E--Audit-green.svg)](https://playwright.dev/)
[![Docker](https://img.shields.io/badge/Docker-WSL2-blue.svg)](https://www.docker.com/)

> **Protocolo DeFi de Tesorería Descentralizada con Proof of Reserves (PoR) Exógeno Puro, Invariantes Matemáticas Formales, Protección Anti-MEV Flash Loan, Bonos Vestados ERC-721 y Mercado P2P Colateralizado.**

---

## 📋 Índice
1. [Visión General & Modelo de Reservas Exógenas Puras](#-visión-general--modelo-de-reservas-exógenas-puras)
2. [Arquitectura de Seguridad & Auditoría Institucional](#-arquitectura-de-seguridad--auditoría-institucional)
3. [Despliegue Rápido (Un Solo Clic)](#-despliegue-rápido-un-solo-clic)
4. [Estructura del Proyecto & Clean Architecture](#-estructura-del-proyecto--clean-architecture)
5. [Los 7 Pilares Centrales Auditados](#-los-7-pilares-centrales-auditados-100-mainnet-ready)
6. [Institutional Quality Gate](#-institutional-quality-gate-1212-comprobaciones-en-verde)
7. [Estrategia de Ramas Git & Flujo de Desarrollo](#-estrategia-de-ramas-git--flujo-de-desarrollo)
8. [Documentación Adicional](#-documentación-adicional)

---

## 🏛️ Visión General & Modelo de Reservas Exógenas Puras

El **Protocolo Alpha Centauri** es una infraestructura financiera descentralizada construida sobre Ethereum/EVM que opera bajo un **Modelo de Reservas Exógenas Puras (100% Exógeno)** con Proof of Reserves (PoR) en tiempo real:
- **50.00% Stablecoins (USDC)**: Destinados a Bóvedas Morpho Blue y Préstamos P2P sobrecolateralizados.
- **25.00% Bitcoin (WBTC)**: Colateral exógeno de máxima solidez y reserva de valor.
- **12.50% Ethereum (WETH)**: Colateral exógeno de alta liquidez e infraestructura base DeFi.
- **12.50% Sub-Reserva POL (stALPHA)**: Liquidez propiedad del protocolo auto-bloqueada en staking de gobernanza.

> [!IMPORTANT]
> El token nativo del protocolo ($ALPHA$) es de tipo endógeno de gobernanza/staking y se encuentra **estrictamente excluido** del cálculo de reservas exógenas en la tabla PoR, garantizando colateralización sólida basada únicamente en activos externos líquidos.

---

## 🛡️ Arquitectura de Seguridad & Auditoría Institucional

El protocolo cuenta con una suite de auditoría matemática de grado Mainnet dividida en 3 pilares:

### 1. Invariantes Formales & Fuzzing en Solidity (Foundry)
Ubicado en [`contracts/test/InstitutionalAuditInvariants.t.sol`](file:///c:/Users/Admin/Desktop/token/contracts/test/InstitutionalAuditInvariants.t.sol):
- **Fuzzing Masivo de Fee Dinámico (`testFuzz_CalculateDynamicFeeBps`)**: Certifica que el fee devuelto se mantenga estrictamente entre $50\text{ BPS (0.50\%)}$ y $500\text{ BPS (5.00\%)}$ para entradas de $1\text{ wei}$ a $10^9\text{ tokens}$ sin desbordamientos de enteros.
- **Invariante de Solvencia (`test_Invariant_AssetsExceedLiabilities`)**: Garantiza formalmente $TotalAssetsExogenousUSD \ge TotalLiabilitiesUSD$.
- **Invariante de Monotonicidad (`test_Invariant_NAVMonotonicity`)**: Demuestra que $NAV_{post} \ge NAV_{pre}$ tras cualquier depósito.

### 2. Protección Anti-MEV / Flash Loans
- **Curva Dinámica de Impacto**: La tarifa de depósito escala dinámicamente según el tamaño de la transacción respecto a la tesorería existente ($50\text{ BPS} \rightarrow 500\text{ BPS}$).
- **Circuito Breaker de Colateralización**: La función `redeem()` en [`TreasuryManager.sol`](file:///c:/Users/Admin/Desktop/token/contracts/src/TreasuryManager.sol) revierte cualquier intento de extracción relámpago que reduzca la ratio de colateralización.
- **Pérdida Neta Demostrada**: Pruebas unitarias demuestran que un ataque Flash Loan sufre una pérdida neta de capital de $\sim 2.44\%$, haciendo matemáticamente imposible el arbitraje de NAV por MEV.

### 3. Aserciones Contables E2E en Playwright
En [`master_tokenomics_simulation.spec.ts`](file:///c:/Users/Admin/Desktop/token/frontend/tests/master_tokenomics_simulation.spec.ts), cada uno de los 15 pasos de simulación valida que la suma de las filas de reservas coincida con el total en pantalla con un margen estricto $\le \$0.02\text{ USD}$:
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
3. Despliega los 24 Smart Contracts y actualiza las direcciones on-chain.
4. Pre-fondea **10,000.00 USDC mock** tanto al Admin como al Usuario.
5. Compila el bundle de producción del Frontend Web3.
6. Servidor web estático y proxy RPC activo en **[http://localhost:5173](http://localhost:5173)**.

---

## 📁 Estructura del Proyecto & Clean Architecture

```
├── contracts/               # Smart Contracts Solidity (Foundry)
│   ├── src/                 # Contratos principales (TreasuryManager, VestedDiscountVault, P2PMarket, Staking)
│   └── test/                # Test suites Foundry (ModularProtocol.t.sol, InstitutionalAuditInvariants.t.sol)
├── frontend/                # Aplicación Web3 (React + TypeScript + Viem + Vite)
│   ├── src/
│   │   ├── components/      # Componentes UI (TreasuryDashboard, ProtocolAnalyticsCharts, P2PMarketplace)
│   │   ├── hooks/           # Custom Hooks modulares (useWeb3State, useTreasuryActions, useP2PLendingActions)
│   │   ├── index.css        # Sistema de Diseño Centralizado con Tokens Neón y Clases Modulares
│   │   └── contracts.json   # ABIs y direcciones desplegadas dinámicamente
│   ├── tests/               # Suite Playwright E2E (master_tokenomics_simulation.spec.ts)
│   └── server.cjs           # Servidor estático con proxy RPC /rpc
├── services/                # Servicios backend (core deployment, scripts de alineación)
├── docs/                    # Documentación técnica extendida
├── start_app.ps1            # Script de lanzamiento completo PowerShell
└── start_app.bat            # Ejecutable Batch para Windows
```

---

## 🏛️ Los 7 Pilares Centrales Auditados (100% Mainnet-Ready)

| Módulo | Contrato Principal | Características Clave & Invariantes |
| :--- | :--- | :--- |
| **1. Tesorería & NAV On-Chain** | [`TreasuryManager.sol`](file:///c:/Users/Admin/Desktop/token/contracts/src/TreasuryManager.sol) | 4 Librerías PoR $O(1)$, Invariante de Solvencia $100\%$, Slippage $0.05\%$, Anti-MEV Cooldown. |
| **2. Bonos Vestados vPOS** | [`VestedDiscountVault.sol`](file:///c:/Users/Admin/Desktop/token/contracts/src/VestedDiscountVault.sol) | NFTs ERC-721 transferibles, Descuento dinámico 5-25%, Ragequit con 15% penalty 50/50. |
| **3. Préstamos Multi-Colateral** | [`P2PLendingMarket.sol`](file:///c:/Users/Admin/Desktop/token/contracts/src/P2PLendingMarket.sol) | Fair Liquidation con restitución de equity al prestatario, APR dinámico por DAO y Circuit Breaker. |
| **4. Motor de Recompras** | [`DiscountBuybackEngine.sol`](file:///c:/Users/Admin/Desktop/token/contracts/src/DiscountBuybackEngine.sol) | 10 Candados de Control Matemático, Fee Tier configurable, Keeper Bounty y Sweep Tokens. |
| **5. Real Yield Router 50/50** | [`RealYieldRouter.sol`](file:///c:/Users/Admin/Desktop/token/contracts/src/RealYieldRouter.sol) | Reparto Pure DeFi, Fee Tier de reserva configurable, Protección Circuit Breaker y Sweep Tokens. |
| **6. Circuit Breaker Automático** | [`CircuitBreaker.sol`](file:///c:/Users/Admin/Desktop/token/contracts/src/CircuitBreaker.sol) | Búfer circular gas $O(1)$, Umbrales configurables por DAO y blindaje en préstamos. |
| **7. Gobernanza DAO & Timelock 72h** | [`GovernorAlphaCentauri.sol`](file:///c:/Users/Admin/Desktop/token/contracts/src/GovernorAlphaCentauri.sol) | Veto inmutable a bóvedas, Timelock 72h, Cancelación de propuestas y Votación de 3 Vías con Razón. |

---

## 🚦 Institutional Quality Gate (12/12 Comprobaciones en Verde)

El pipeline de integración y calidad institucional certifica la integridad del protocolo ejecutando:
```bash
npm run quality
```
1. **Frontend Strict Typecheck** (`tsc -b`)
2. **Backend Services Strict Typecheck** (`tsc`)
3. **Frontend Fast Linter** (`oxlint`)
4. **Frontend Unit Tests** (`vitest 21/21`)
5. **Frontend Production Bundle Build** (`vite`)
6. **Backend Architecture & Reorg Tests** (`43/43`)
7. **Frontend / Smart Contract Alignment** (`18/18`)
8. **Institutional E2E Multi-Persona Suite** (5 Personas)
9. **Chaos & Market Shock Stress Suite**
10. **Dependencies Security Audit** (`npm audit`)
11. **Smart Contracts Security Linter** (`solhint`)
12. **Dead Code & Orphaned Exports Scanner** (`knip`)

---

## 🌿 Estrategia de Ramas Git & Flujo de Desarrollo

El repositorio sigue un modelo de ramificación estricto:
- **`main`**: Rama estable de producción (Mainnet-ready). Solo recibe commits consolidados y auditados.
- **`desarrollo`**: Rama activa de trabajo. Todas las modificaciones, características y pruebas se desarrollan y validan en esta rama antes de ser fusionadas a `main`.

---

## 📚 Documentación Adicional

La carpeta [`docs/`](file:///C:/Users/Admin/Desktop/token/docs) contiene los manuales técnicos extendidos del sistema:

- 📖 [**Guía de Usuario & Tutoriales**](file:///C:/Users/Admin/Desktop/token/docs/USER_GUIDE.md)
- 📑 [**Referencia de API & Smart Contracts**](file:///C:/Users/Admin/Desktop/token/docs/SMART_CONTRACTS_API.md)
- 🔒 [**Seguridad, Auditoría & Operaciones**](file:///C:/Users/Admin/Desktop/token/docs/SECURITY_AND_OPERATIONS.md)
- 📊 [**Modelo Económico & Tokenomics (Biblia Canónica)**](file:///C:/Users/Admin/Desktop/token/docs/TOKENOMICS.md)
- 📄 [**Whitepaper Completo**](file:///C:/Users/Admin/Desktop/token/docs/WHITE_PAPER.md)
- 🏗️ [**Especificación de Arquitectura Completa**](file:///C:/Users/Admin/Desktop/token/docs/FULL_ARCHITECTURE_SPECIFICATION.md)
- 🧪 [**Flujo de Simulación Master Playwright**](file:///C:/Users/Admin/Desktop/token/MASTER_TOKENOMICS_SIMULATION_FLOW.md)
