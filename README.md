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
5. [Estrategia de Ramas Git & Flujo de Desarrollo](#-estrategia-de-ramas-git--flujo-de-desarrollo)
6. [Proof of Reserves (PoR) & Sistema NPV](#-proof-of-reserves-por--sistema-npv)
7. [Documentación Adicional](#-documentación-adicional)

---

## 🏛️ Visión General & Modelo de Reservas Exógenas Puras

El **Protocolo Alpha Centauri** es una infraestructura financiera descentralizada construida sobre Ethereum/EVM que opera bajo un **Modelo de Reservas Exógenas Puras (100% Exógeno)**:
- **60.00% Stablecoins (USDC)**: Destinados a Bóvedas Morpho Blue y Préstamos P2P sobrecolateralizados.
- **26.67% Bitcoin (WBTC)**: Colateralizado en Staking Lombard (LBTC) y Morpho.
- **13.33% Ethereum (WETH)**: Colateralizado en Liquid Staking Lido (stETH) y Aave.

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
- 🧪 [**Flujo de Simulación Master Playwright**](file:///C:/Users/Admin/Desktop/token/MASTER_TOKENOMICS_SIMULATION_FLOW.md)
