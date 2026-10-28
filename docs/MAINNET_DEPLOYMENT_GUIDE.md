# 🌐 GUÍA MAESTRA DE DESPLIEGUE EN MAINNET (ARBITRUM / ETHEREUM L2)
> **ALPHA CENTAURI PROTOCOL — V6.2.0 (PURE DEFI / MAINNET-READY)**  
> **Arquitectura:** Cero Privilegios Centralizados · Cumplimiento MiCA Recital 22 · Guarded Launch Fase 1 · Gobernanza Timelocked 72h · Financiación On-Chain de Auditoría

---

## 📋 Índice
1. [Filosofía de Despliegue: Pure DeFi & Zero Backdoors](#1-filosofía-de-despliegue-pure-defi--zero-backdoors)
2. [Prerrequisitos de Seguridad e Infraestructura](#2-prerrequisitos-de-seguridad-e-infraestructura)
3. [Matriz de Direcciones de Producción (Arbitrum One vs Ethereum)](#3-matriz-de-direcciones-de-producción-arbitrum-one-vs-ethereum)
4. [Configuración de Variables de Entorno (`.env.production`)](#4-configuración-de-variables-de-entorno-envproduction)
5. [Secuencia de Despliegue Determinista de Smart Contracts](#5-secuencia-de-despliegue-determinista-de-smart-contracts)
6. [Protocolo de Transferencia Irrevocable de Gobernanza (Renuncia Total de Admin)](#6-protocolo-de-transferencia-irrevocable-de-gobernanza-renuncia-total-de-admin)
7. [Verificación en Block Explorers (Arbiscan / Etherscan)](#7-verificación-en-block-explorers-arbiscan--etherscan)
8. [Despliegue y Alojamiento Descentralizado del Frontend (IPFS / ENS)](#8-despliegue-y-alojamiento-descentralizado-del-frontend-ipfs--ens)
9. [Primera Acción Génesis: Propuesta DAO para Escrow de Auditoría](#9-primera-acción-génesis-propuesta-dao-para-escrow-de-auditoría)
10. [Checklist Institucional de Go-Live](#10-checklist-institucional-de-go-live)

---

## 1. Filosofía de Despliegue: Pure DeFi & Zero Backdoors

El Protocolo Alpha Centauri está concebido bajo los principios más estrictos de **finanzas descentralizadas puras**:
* **Sin Llaves Maestras**: El deployer (EOA inicial) no retiene ningún rol de administración (`DEFAULT_ADMIN_ROLE`) tras el despliegue.
* **Timelock de 72 Horas Inmutable**: Toda modificación de parámetros (pesos de reserva, tarifas, límites de compra, actualización de oráculos) debe originarse obligatoriamente mediante una propuesta aprobada en [`GovernorAlphaCentauri.sol`](../contracts/src/GovernorAlphaCentauri.sol) y someterse a un retraso de seguridad mínimo de **72 horas (259,200 segundos)** en [`TimelockController.sol`](../contracts/src/TimelockController.sol).
* **Guarded Launch Fase 1 (Tope de TVL $100K)**: Para proteger los fondos de los usuarios ante posibles vulnerabilidades no detectadas antes de las auditorías públicas, el contrato de tesorería impone un límite programático (`tvlCap = 100_000 * 1e18`) en depósitos. Este tope solo puede incrementarse mediante votación democrática de la DAO.
* **Financiación Comunitaria de Auditorías (DAO Grants)**: Los fondos para auditorías externas formales (Code4rena, Cantina, Sherlock) y bug bounties (Immunefi) se desembolsan directamente desde la tesorería hacia los contratos *escrow* previa propuesta aprobada por la comunidad, preservando la exención de descentralización de **MiCA (Considerando 22)**.

---

## 2. Prerrequisitos de Seguridad e Infraestructura

Antes de ejecutar el despliegue en la red principal:

1. **Hardware Wallet Segregada**:
   - Utilizar un dispositivo físico de firma en frío (Ledger Nano X / Trezor Model T) configurado a través de Foundry (`--ledger` o `--trezor`) o una dirección Safe Multi-Signature.
   - **NUNCA** almacenar la clave privada de despliegue en archivos de texto plano o repositorios Git.
2. **Endpoints RPC de Grado Institucional**:
   - Endpoint Primario: Nodo privado dedicado (Alchemy, Infura, QuickNode) con soporte HTTP y WebSockets (WSS).
   - Endpoint de Respaldo: Proveedor alternativo configurado como fallback automático.
3. **Presupuesto de Gas para Despliegue**:
   - En **Arbitrum One (L2 Recomendada)**: Se requieren aproximadamente **0.05 a 0.15 ETH** para el despliegue de los 26 contratos, inicialización de roles y acuñación del bloque génesis.
   - En **Ethereum L1**: Se requieren aproximadamente **0.8 a 2.5 ETH** dependiendo del gas price actual (15-30 Gwei).
4. **API Keys de Explorador de Bloques**:
   - Arbiscan API Key (para Arbitrum) o Etherscan API Key (para Ethereum) con el fin de verificar automáticamente el código fuente en el explorador.

---

## 3. Matriz de Direcciones de Producción (Arbitrum One vs Ethereum)

En Mainnet se utilizan los tokens oficiales y los oráculos descentralizados de Chainlink con soporte de Sequencer Uptime:

| Activo / Contrato | Arbitrum One (`ChainID: 42161`) | Ethereum Mainnet (`ChainID: 1`) | Decimales |
| :--- | :--- | :--- | :---: |
| **USDC** (Nativo) | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | 6 |
| **USDT** | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | 6 |
| **WBTC** | `0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f` | `0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599` | 8 |
| **WETH** | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | 18 |
| **Feed Chainlink USDC / USD** | `0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3` | `0x8fFf6443831854eE89307844d0FE95CA0b106477` | 8 |
| **Feed Chainlink USDT / USD** | `0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7` | `0xEe9150604c2594754dd6fb5191441400508553AC` | 8 |
| **Feed Chainlink BTC / USD** | `0x6ce185860a4963106506C203335A2910413708e9` | `0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c` | 8 |
| **Feed Chainlink ETH / USD** | `0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612` | `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` | 8 |
| **Feed Sequencer Uptime (L2)** | `0xFdB631F5EE196F0ed6FAa767959853A9F217697D` | *N/A (L1 no requiere Sequencer Feed)* | 1 |

---

## 4. Configuración de Variables de Entorno (`.env.production`)

Crea un archivo `.env.production` en la raíz del proyecto asegurando los siguientes parámetros de seguridad:

```ini
# ==============================================================================
# CONFIGURACIÓN DE PRODUCCIÓN - MAINNET ARBITRUM ONE
# ==============================================================================
NODE_ENV=production
DEPLOY_ENV=production
VITE_ENVIRONMENT=production

# RPC Providers
MAINNET_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/TU_ALCHEMY_API_KEY
MAINNET_RPC_BACKUP_URL=https://arbitrum-one.publicnode.com
CHAIN_ID=42161

# Parámetros de Seguridad y Gobernanza
TIMELOCK_MIN_DELAY=259200
PROPOSAL_THRESHOLD=25000000000000000000000
QUORUM_VOTES=80000000000000000000000
VOTING_PERIOD_BLOCKS=21600
INITIAL_TVL_CAP_USD=100000000000000000000000

# Tokens Exógenos en Arbitrum
USDC_ADDRESS=0xaf88d065e77c8cC2239327C5EDb3A432268e5831
USDT_ADDRESS=0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9
WBTC_ADDRESS=0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f
WETH_ADDRESS=0x82aF49447D8a07e3bd95BD0d56f35241523fBab1

# Oráculos Chainlink
CHAINLINK_USDC_FEED=0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3
CHAINLINK_USDT_FEED=0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7
CHAINLINK_WBTC_FEED=0x6ce185860a4963106506C203335A2910413708e9
CHAINLINK_WETH_FEED=0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612
CHAINLINK_SEQUENCER_FEED=0xFdB631F5EE196F0ed6FAa767959853A9F217697D

# Verificación
ARBISCAN_API_KEY=TU_ARBISCAN_API_KEY
```

---

## 5. Secuencia de Despliegue Determinista de Smart Contracts

El despliegue debe seguir un orden topológico estricto para satisfacer las dependencias circulares y registrar cada dirección en [`ProtocolAddressProvider.sol`](../contracts/src/ProtocolAddressProvider.sol):

### Fase 1: Registro Maestro e Infraestructura Base
1. **`ProtocolAddressProvider`**: Desplegar el Service Locator central.
2. **`AlphaToken (ALPHA)`**: Desplegar el token de gobernanza ERC-20 con soporte ERC-2612 Permit y puntos de control (checkpoints).
3. **`VaultPositionNFT`**: Desplegar el contrato ERC-721 para la titulización de bonos vestados.
4. **`OracleHub`**: Configurar con los Feeds oficiales de Chainlink y el `SequencerUptimeFeed` con periodo de gracia de 3,600 segundos para proteger contra transacciones estancadas en reinicios de L2.

### Fase 2: Bóvedas de Custodia y Tesorería
5. **`AlphaVault`**: Bóveda fría de colateral segregada para activos exógenos.
6. **`TreasuryManager`**:
   - Inicializar con los tokens USDC, USDT, WBTC, WETH.
   - Configurar ponderaciones objetivo de reserva: 50% Stables, 25% WBTC, 12.5% WETH, 12.5% stALPHA Sub-Reserva.
   - **Activar Guarded Genesis Cap**: Ejecutar `setTvlCap(100_000 * 1e18)`.

### Fase 3: Ecosistema Real Yield y Mercados
7. **`GovernanceStaking (stALPHA)`**: Bóveda de staking para emisión de votos y distribución de dividendos.
8. **`CommunityYieldVault`**: Contrato receptor del 50% de las comisiones en USDC para reparto pro-rata a stakers.
9. **`RealYieldRouter`**: Enrutador inmutable con regla 50/50 (50% a reservas de tesorería, 50% a stakers).
10. **`VestedDiscountVault`**: Motor de bonos vestados (1-5 años) con penalización de ragequit del 15%.
11. **`P2PLendingMarket`**: Mercado de préstamos sobrecolateralizados sin pool de rehipotecación.
12. **`DiscountBuybackEngine`**: Motor de recompras automáticas en DEX activado solo cuando el precio de mercado cotice con descuento bajo el NAV.
13. **`CircuitBreaker`**: Cortafuegos de volatilidad con ventana rodante $O(1)$ para congelar temporalmente retiros en caso de despegue de oráculos.

### Fase 4: Bóveda del Creador & Seguridad Cuántica
14. **`FounderReserveVestingVault`**:
   - Desplegar la bóveda autónoma de vesting.
   - Acuñar los 100,000 ALPHA bloqueados del fundador directamente en este contrato.
   - Los tokens quedan bloqueados sin circular y sujetos estrictamente a la regla: *Liberación máxima del 10% del superávit de reservas con solvencia > 100% y cooldown de 72h*.
15. **`PostQuantumGuard`**:
   - Desplegar el validador criptográfico de firmas Winternitz OTS+ ($w=4$, Keccak-256) resistente al algoritmo de Shor.

### Fase 5: Gobernanza Descentralizada Timelocked
16. **`TimelockController`**:
   - Desplegar con retardo mínimo de **259,200 segundos (72 horas)**.
   - Proposers iniciales: `[]` (se asignará en la siguiente fase).
   - Executors iniciales: `[]`.
   - Admin temporal: Dirección del deployer.
17. **`GovernorAlphaCentauri`**:
   - Conectar al token `GovernanceStaking (stALPHA)`.
   - Conectar al `TimelockController`.
   - Parámetros: Umbral de propuesta = 25,000 stALPHA, Quorum = 80,000 stALPHA, Periodo de votación = 21,600 bloques (~3 días).

---

## 6. Protocolo de Transferencia Irrevocable de Gobernanza (Renuncia Total de Admin)

Esta es la fase más crítica. Debe ejecutarse inmediatamente después del despliegue para garantizar **Pure DeFi**:

```bash
# ==============================================================================
# COMANDOS DE ASIGNACIÓN DE ROLES Y RENUNCIA IRREVOCABLE (FOUNDRY / CAST)
# ==============================================================================

# 1. Asignar rol PROPOSER_ROLE del Timelock exclusivamente al GovernorAlphaCentauri
cast send $TIMELOCK_ADDRESS "grantRole(bytes32,address)" \
  $(cast keccak "PROPOSER_ROLE") $GOVERNOR_ADDRESS \
  --rpc-url $MAINNET_RPC_URL --ledger

# 2. Asignar rol EXECUTOR_ROLE a address(0) para permitir ejecución comunitaria tras 72h
cast send $TIMELOCK_ADDRESS "grantRole(bytes32,address)" \
  $(cast keccak "EXECUTOR_ROLE") 0x0000000000000000000000000000000000000000 \
  --rpc-url $MAINNET_RPC_URL --ledger

# 3. Asignar rol CANCELLER_ROLE al GovernorAlphaCentauri
cast send $TIMELOCK_ADDRESS "grantRole(bytes32,address)" \
  $(cast keccak "CANCELLER_ROLE") $GOVERNOR_ADDRESS \
  --rpc-url $MAINNET_RPC_URL --ledger

# 4. Asignar DEFAULT_ADMIN_ROLE de todos los contratos al TimelockController
cast send $TREASURY_ADDRESS "grantRole(bytes32,address)" \
  0x0000000000000000000000000000000000000000000000000000000000000000 $TIMELOCK_ADDRESS \
  --rpc-url $MAINNET_RPC_URL --ledger

# 5. RENUNCIA IRREVOCABLE del Deployer en el TimelockController
cast send $TIMELOCK_ADDRESS "renounceRole(bytes32,address)" \
  $(cast keccak "TIMELOCK_ADMIN_ROLE") $DEPLOYER_ADDRESS \
  --rpc-url $MAINNET_RPC_URL --ledger

# 6. RENUNCIA IRREVOCABLE del Deployer en la Tesorería y demás contratos
cast send $TREASURY_ADDRESS "renounceRole(bytes32,address)" \
  0x0000000000000000000000000000000000000000000000000000000000000000 $DEPLOYER_ADDRESS \
  --rpc-url $MAINNET_RPC_URL --ledger
```

> [!CAUTION]
> Una vez ejecutada la renuncia, ninguna persona, entidad o servidor puede alterar los contratos sin someter una propuesta a votación abierta en la DAO y aguardar las 72 horas del Timelock.

---

## 7. Verificación en Block Explorers (Arbiscan / Etherscan)

Verifica cada contrato desplegado en el explorador oficial utilizando `forge verify-contract`:

```bash
# Ejemplo: Verificación de TreasuryManager
forge verify-contract \
  --chain-id 42161 \
  --num-of-optimizations 200 \
  --compiler-version v0.8.20+commit.a1b79de6 \
  $TREASURY_ADDRESS \
  contracts/src/TreasuryManager.sol:TreasuryManager \
  --etherscan-api-key $ARBISCAN_API_KEY
```

---

## 8. Despliegue y Alojamiento Descentralizado del Frontend (IPFS / ENS)

Para evitar la censura o dependencia de proveedores de hosting web centralizados (AWS, Vercel, Cloudflare), el frontend debe alojarse en la red descentralizada IPFS:

1. **Construir el Bundle de Producción**:
   ```bash
   cd frontend
   npm run build
   ```
2. **Subir a IPFS vía Fleek o Pinata**:
   ```bash
   # Subir la carpeta dist/ resultante a IPFS
   npx @fleek-platform/cli deploy dist/
   ```
3. **Vincular el Hash IPFS al Dominio ENS**:
   - En el registrador ENS de Ethereum, configurar el registro `contenthash` del dominio `alphacentauri.eth` con el CID de IPFS obtenido (`ipfs://Qm...` o `ipfs://bafy...`).
   - Los usuarios podrán acceder directamente mediante navegadores con soporte ENS (Brave, Opera) o mediante pasarelas descentralizadas (`alphacentauri.eth.limo`).

---

## 9. Primera Acción Génesis: Propuesta DAO para Escrow de Auditoría

Una vez que el protocolo está desplegado y los primeros usuarios suscriben ALPHA y hacen staking de stALPHA, se procede a financiar la auditoría formal on-chain:

1. En la pestaña **Gobernanza**, el delegado accede a la **Plantilla 5 (Asignación de Fondos de Tesorería / Subvención)**.
2. Hace clic en:  
   `🛡️ Pre-llenar Auditoría Comunitaria (Code4rena Escrow 25K USDC)`
3. Esto configura de forma determinista:
   - **Beneficiario**: Dirección del contrato Escrow de Code4rena / Cantina.
   - **Monto**: `25,000 USDC` (provenientes de las comisiones acumuladas por suscripciones).
   - **Llamada On-Chain**: `TreasuryManager.withdrawUSDC(escrowAddress, 25_000 * 1e6)`.
4. La propuesta se vota durante 3 días. Tras alcanzar el quorum de 80,000 stALPHA y ser aprobada, se encola en el `TimelockController` durante 72 horas y finalmente se ejecuta.
5. Los auditores reciben los fondos directamente del smart contract sin intermediarios legales corporativos.

---

## 10. Checklist Institucional de Go-Live

| # | Comprobación de Seguridad | Estado |
| :---: | :--- | :---: |
| 1 | Todos los tests del monorepo (`npm test`) superados al 100% (150+ tests). | ✅ |
| 2 | Parámetros de oráculos Chainlink con Sequencer Feed activos. | ⏳ |
| 3 | Guarded Genesis Cap configurado en $100,000 USD en `TreasuryManager`. | ⏳ |
| 4 | 100k ALPHA asignados al fundador bloqueados en `FounderReserveVestingVault`. | ⏳ |
| 5 | Contratos verificados en Arbiscan / Etherscan con código fuente público. | ⏳ |
| 6 | Roles de administración transferidos exclusivamente al `TimelockController` (72h). | ⏳ |
| 7 | `DEFAULT_ADMIN_ROLE` del deployer revocado y confirmado en 0 direcciones EOA. | ⏳ |
| 8 | Bundle frontend desplegado en IPFS y verificado contra el proxy RPC de mainnet. | ⏳ |

---
*Manual verificado conforme a directivas de descentralización de Clean Architecture y MiCA Recital 22.*
