# 🚀 ALPHA CENTAURI PROTOCOL — V6.0.0

[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue.svg)](https://soliditylang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2.1-purple.svg)](https://vitejs.dev/)
[![Foundry](https://img.shields.io/badge/Foundry-Anvil-orange.svg)](https://getfoundry.sh/)
[![Docker](https://img.shields.io/badge/Docker-WSL2-blue.svg)](https://www.docker.com/)

> **Protocolo DeFi de Tesorería Descentralizada con Proof of Reserves (PoR) en Tiempo Real, Bonos Vestados con NFTs ERC-721, Mercado de Préstamos P2P Colateralizados y Flywheel de Real Yield.**

---

## 📋 Índice
1. [Visión General & Arquitectura](#-visión-general--arquitectura)
2. [Despliegue Rápido (Un Solo Clic)](#-despliegue-rápido-un-solo-clic)
3. [Estructura del Proyecto & Clean Architecture](#-estructura-del-proyecto--clean-architecture)
4. [Módulos Principales del Protocolo](#-módulos-principales-del-protocolo)
5. [Proof of Reserves (PoR) & Sistema NPV](#-proof-of-reserves-por--sistema-npv)
6. [Guía de Comandos](#-guía-de-comandos)
7. [Documentación Adicional](#-documentación-adicional)

---

## 🏛️ Visión General & Arquitectura

El **Protocolo Alpha Centauri** es una infraestructura financiera descentralizada construida sobre Ethereum/EVM que ofrece:
- **Reserva Líquida Búnker**: Respaldo dinámico en stablecoins (USDC) y activos colaterales (WBTC, WETH).
- **Bonos Vestados con Descuento**: Emisión de bonos a 3 y 5 años respaldados por NFTs ERC-721 representativos.
- **Mercado P2P Colateralizado**: Utilización de NFTs de Posición como colateral para solicitar u ofrecer préstamos en USDC sin custodia de terceros.
- **Gobernanza & Real Yield Staking**: Distribución del 100% del flujo de comisiones del protocolo bajo el modelo Flywheel (50% Reacumulación en Tesorería, 25% Fondo Operativo Ops, 25% Dividendo Directo a Stakers).

---

## ⚡ Despliegue Rápido (Un Solo Clic)

### 🚀 Lanzamiento y Despliegue Ultrarrápido

El proyecto cuenta con scripts optimizados de despliegue en un solo paso:

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

### Opción C — Doble Clic (Windows):
Simplemente haz doble clic sobre el archivo **`start_app.bat`** en la carpeta principal.

#### 🔄 ¿Qué ejecuta el script automáticamente?
1. Limpia y reinicia contenedores Docker existentes.
2. Levanta el nodo Anvil Blockchain en el puerto `8545`.
3. Despliega la suite completa de Smart Contracts y actualiza las direcciones on-chain.
4. Compila el bundle de producción del Frontend Web3.
5. Acredita **10,000.00 USDC mock** tanto a la cuenta Admin como a la de Usuario.
6. Inicia el servidor web estático y proxy RPC `/rpc` en **[http://localhost:5173](http://localhost:5173)**.

---

## 📁 Estructura del Proyecto & Clean Architecture

El proyecto sigue patrones de arquitectura limpia y desacoplada:

```
├── contracts/               # Smart Contracts Solidity (Foundry)
│   ├── src/                 # Contratos principales (Treasury, VestedDiscountVault, P2PMarket, Staking)
│   └── test/                # Test suites unitarias y de integración Foundry
├── frontend/                # Aplicación Web3 (React + TypeScript + Viem + Vite)
│   ├── src/
│   │   ├── components/      # Componentes UI (TreasuryDashboard, VestedVaults, P2PMarketplace, Header)
│   │   ├── hooks/           # Custom Hooks modulares (useWeb3State, useTreasuryActions, useP2PLendingActions)
│   │   └── utils/           # Clientes Viem, configuraciones RPC y ABIs
│   └── server.cjs           # Servidor estático con proxy RPC /rpc sin dependencias
├── services/                # Servicios backend (core deployment, satélite, inyección TWAP)
├── docs/                    # Documentación técnica extendida
├── start_app.ps1            # Script de lanzamiento completo PowerShell
└── start_app.bat            # Ejecutable Batch para Windows
```

---

## 🛡️ Proof of Reserves (PoR) & Sistema NPV

- **Auditoría On-Chain en Tiempo Real**: El contrato [`Treasury.sol`](file:///C:/Users/Admin/Desktop/token/contracts/src/Treasury.sol) calcula dinámicamente la ratio de colateralización sobre los activos custodios.
- **Sistema NPV (Net Present Liability)**: Para evitar caídas artificiales del ratio al emitir bonos con descuento, [`VestedDiscountVault.sol`](file:///C:/Users/Admin/Desktop/token/contracts/src/VestedDiscountVault.sol) registra la obligación presente proporcional al tiempo transcurrido en el bloqueo, garantizando **cobertura 1:1 desde el primer día**.
- **Aislamiento de Billeteras Personales**: Las billeteras de los usuarios y administradores están estrictamente separadas de los balances de la tesorería del protocolo.

---

## 📚 Documentación Adicional

La carpeta [`docs/`](file:///C:/Users/Admin/Desktop/token/docs) contiene los manuales técnicos extendidos del sistema:

- 📖 [**Guía de Usuario & Tutoriales**](file:///C:/Users/Admin/Desktop/token/docs/USER_GUIDE.md)
- 📑 [**Referencia de API & Smart Contracts**](file:///C:/Users/Admin/Desktop/token/docs/SMART_CONTRACTS_API.md)
- 🔒 [**Seguridad, Auditoría & Operaciones**](file:///C:/Users/Admin/Desktop/token/docs/SECURITY_AND_OPERATIONS.md)
- 📊 [**Modelo Económico & Tokenomics**](file:///C:/Users/Admin/Desktop/token/docs/TOKENOMICS.md)
- 📄 [**Whitepaper Completo**](file:///C:/Users/Admin/Desktop/token/docs/WHITE_PAPER.md)
