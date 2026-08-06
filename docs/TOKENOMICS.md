# 📜 BIBLIA COMPLETA DE TOKENOMICS — ALPHA CENTAURI PROTOCOL

## 🛡️ 0. DIRECTIVAS INMUTABLES E INVARIANTES DEL PROTOCOLO

El Protocolo **Alpha Centauri** está gobernado por **3 Directivas Inmutables de Inmunidad Operativa**, codificadas a nivel de bytecode en la EVM y no modificables por ninguna entidad:

### 1. Directiva de Invariante de Colateralización Incondicional
$$\mathbf{\text{Ratio}_{\text{post-tx}} \ge \text{Ratio}_{\text{pre-tx}}}$$
- **Mecanismo On-Chain:** Evaluado en `TreasuryManager.sol` en las funciones `deposit()` y `redeem()`.
- **Reversión Obligatoria:** Si cualquier transacción provocara una caída en el porcentaje de reservas (por redondeo, desajuste de oráculo o arbitraje), la EVM la revierte de inmediato con el mensaje:
  `"TreasuryManager: Security Violation - Transaction reduced collateralization ratio"`.

### 2. Prohibición Absoluta de Minteado Inflacionario Sin Respaldo
- **Regla:** Ninguna billetera corporativa (`CorporateOpExVault`, `CorporateProfitVault`, equipo o fundadores) puede recibir tokens `ALPHA` minteados "de la nada".
- **Mecanismo:** La acuñación solo existe cuando ingresa colateral real en USDC en la Tesorería. Las comisiones asignadas a las bóvedas corporativas (25% OpEx / 25% Profit) provienen **exclusivamente de compras reales en el mercado DEX** efectuadas por `RealYieldRouter.sol`.

### 3. Invariante Deflacionario Incondicional (Quema Permanente)
- **Staking:** El 50% de la comisión de entrada al pool de gobernanza (0.50% del total bloqueado) es **destruido de forma irreversible** mediante `_burn`.
- **Ragequit:** Al cancelar anticipadamente un bono vestado (`VestedDiscountVault.sol`), el **100% de los tokens ALPHA asociados en vesting son destruidos de forma irreversible**, además de aplicar la penalización del 15% en USDC enrutada 50/25/25.

---

## 🌟 Visión General y Filosofía de Real Yield

El Protocolo **Alpha Centauri** opera bajo un modelo estricto de **Real Yield Respaldado por Activos** y **Proof of Reserves (PoR) en Tiempo Real**. Todos los tokens `ALPHA` emitidos cuentan con respaldo patrimonial verificable on-chain con un ratio de solvencia garantizado **$\ge 100.00\%$**.

---

## 🏛️ 1. Reparto Universal de Comisiones (Modelo 50 / 25 / 25)

Toda comisión generada por cualquier operativa de la plataforma (depósitos, rescates, compra de bonos vestados, penalizaciones por ragequit, originación e intereses de préstamos P2P) ingresa a través del contrato `RealYieldRouter.sol` y se distribuye strictly bajo la siguiente regla universal:

| Porcentaje | Destino On-Chain | Mecanismo On-Chain | Propósito Económico |
| :--- | :--- | :--- | :--- |
| **50.00%** | **Reservas Estratégicas** (`TreasuryManager.sol`) | Depósito directo en Tesorería (`AlphaVault.sol`) | Incrementa el NAV por token y fortalece las reservas respaldadas por activos |
| **25.00%** | **Corporate OpEx Vault** (`CorporateOpExVault.sol`) | Auto-Swap en DEX a `ALPHA` y Staking | Financia gastos operativos acumulando tokens ALPHA reales comprados en mercado |
| **25.00%** | **Corporate Profit Vault** (`CorporateProfitVault.sol`) | Auto-Swap en DEX a `ALPHA` y Staking | Acumula beneficios corporativos exclusivamente en tokens ALPHA reales comprados en mercado |

---

## 🏦 2. Composición de Reservas Exógenas Puras (100% Exógeno)

La Tesorería de `TreasuryManager.sol` mantiene una cartera diversificada multi-activo con las siguientes ponderaciones objetivo (`Target Asset Allocation`):

| Ponderación Target | Activo de Reserva Exógeno | Estrategia de Liquidez y Rendimiento |
| :---: | :--- | :--- |
| **60.00%** | **USDC / Stablecoins** | **Bóvedas Morpho Blue + Préstamos P2P**: Auto-depositado en Morpho Blue y Búfer Líquido para originar Préstamos P2P sobrecolateralizados. |
| **26.67%** | **Wrapped Bitcoin (WBTC)** | **Staking Lombard (LBTC) & Morpho**: Valorado on-chain vía Oráculos Chainlink BTC/USD (`OracleHub.sol`). |
| **13.33%** | **Wrapped Ethereum (WETH)** | **Liquid Staking Lido (stETH) & Vaults**: Valorado on-chain vía Oráculos Chainlink ETH/USD (`OracleHub.sol`). |

> [!NOTE]
> El token nativo $ALPHA$ está clasificado como activo endógeno de gobernanza y se encuentra **100% excluido** de las filas de respaldo de la tabla PoR, garantizando que el ratio de colateralización sea 100% exógeno y auditable.

---

## 🛡️ 3. Mecanismo Anti-MEV: Dynamic Slippage Fee (NAV Protection)

Para proteger la masa patrimonial del protocolo y evitar arbitrajes por volumen o ataques relámpago, la emisión de nuevos tokens ALPHA aplica un algoritmo de Slippage Dinámico por Tamaño de Depósito.

### 1. Formulación Matemática ($O(1)$):
$$\text{DynamicFeeBps} = \min\left( \text{FeeBase} + \left( \frac{\Delta A}{A_0 + \Delta A} \times \Gamma \right), \text{CapMax} \right)$$

Donde:
- $\text{FeeBase} = 50\text{ bps } (0.50\%)$
- $\Delta A = \text{Monto bruto del depósito en USD}$
- $A_0 = \text{Reserva Exógena Actual (USDC + WBTC + WETH)}$
- $\Gamma = 500\text{ bps } (5.00\% - \text{Coeficiente de Sensibilidad})$
- $\text{CapMax} = 500\text{ bps } (5.00\% - \text{Límite Máximo})$

### 2. Demostración Anti-MEV (Pérdida Neta de Capital):
Un atacante que intenta realizar un Flash Loan de $\$50,000\text{ USDC}$ sobre un vault de $\$100,000\text{ USDC}$ sufre una tarifa de entrada del $5.00\%$. Al intentar el rescate inmediato, el atacante recibe solo $\$48,782\text{ USDC}$, incurriendo en una **pérdida neta de $\$1,217\text{ USDC}$ ($\sim 2.44\%$)**, haciendo imposible el arbitraje de NAV.

---

## 📊 4. Matriz Completa de Comisiones On-Chain (`ProtocolTokenomicsEngine.sol`)

| Operativa | Contrato Responsable | Comisión / Penalización | Reparto On-Chain |
| :--- | :--- | :--- | :--- |
| **Depósito en Tesorería** | `TreasuryManager.sol` | **0.50% a 5.00%** (Slippage Dinámico) | 50% Reservas / 25% OpEx / 25% Profit |
| **Rescate (Redeem)** | `TreasuryManager.sol` | **1.00%** (100 BPS) | 50% Reservas / 25% OpEx / 25% Profit |
| **Entrada a Staking** | `GovernanceStaking.sol` | **1.00%** (100 BPS) | **0.50% Quema Deflacionaria Permanente**, 0.25% OpEx, 0.25% Profit |
| **Acuñación de Bonos** | `VestedDiscountVault.sol` | **1.50%** Mint Fee + **1.50%** Referidos | 50% Reservas / 25% OpEx / 25% Profit |
| **Ragequit de Bonos** | `VestedDiscountVault.sol` | **15.00%** Penalización USDC | **100% de la penalización enrutada 50/25/25 + Quema 100% Unvested** |
| **Originación Préstamo P2P** | `P2PLendingMarket.sol` | **0.50%** (50 BPS) | 50% Reservas / 25% OpEx / 25% Profit |
| **Spread Interés P2P** | `P2PLendingMarket.sol` | **10.00%** del Interés Generado | 50% Reservas / 25% OpEx / 25% Profit |

---

## 📜 5. Escala de Descuentos para Bonos Vestados y Tiers VIP

Los bonos con descuento se mintean como **NFTs de Posición** (`VaultPositionNFT.sol`):

| Bloqueo | Descuento Base | Bonus VIP Staking Tier | Descuento Máximo Cap | Penalización Ragequit |
| :---: | :---: | :---: | :---: | :---: |
| **1 Año** | **5.00%** | **+1.00%** ($\ge 5\text{k stALPHA}$) | **50.00%** | **15.00%** + Quema 100% Unvested |
| **2 Años** | **10.00%** | **+2.00%** ($\ge 10\text{k stALPHA}$) | **50.00%** | **15.00%** + Quema 100% Unvested |
| **3 Años** | **15.00%** | **+3.00%** ($\ge 20\text{k stALPHA}$) | **50.00%** | **15.00%** + Quema 100% Unvested |
| **4 Años** | **20.00%** | **+3.00%** ($\ge 20\text{k stALPHA}$) | **50.00%** | **15.00%** + Quema 100% Unvested |

---

## 🤝 6. Parámetros de Préstamos P2P (`P2PLendingMarket.sol`)

- **LTV Máximo:** **70.00%** para Activos Estándar / Position NFTs (`maxLtvBps = 7000`).
- **Liquidadibilidad Min Health Factor:** **115.00%** (`minHealthFactorBps = 11500`).
- **Custodia en Escrow:** NFTs de posición retenidos en el mercado P2P como garantía hasta el pago total del principal + intereses.
