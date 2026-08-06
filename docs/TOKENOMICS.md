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
- **Ragequit:** Al cancelar anticipadamente un bono vestado (`VestedDiscountVault.sol`), el **100% de los tokens ALPHA asociados en vesting son destruidos de forma irreversible**, además de retener la penalización del 15% en USDC para las reservas.

---

## 🌟 Visión General y Filosofía de Real Yield

El Protocolo **Alpha Centauri** opera bajo un modelo estricto de **Real Yield Respaldado por Activos** y **Proof of Reserves (PoR) en Tiempo Real**. Todos los tokens `ALPHA` emitidos cuentan con respaldo patrimonial verificable on-chain con un ratio de solvencia garantizado **$\ge 100.00\%$**.

---

## 🏛️ 1. Reparto Universal de Comisiones (Modelo 50 / 25 / 25)

Toda comisión generada por cualquier operativa de la plataforma (depósitos, rescates, compra de bonos vestados, penalizaciones por ragequit, originación e intereses de préstamos P2P) ingresa a través del contrato `RealYieldRouter.sol` y se distribuye estrictamente bajo la siguiente regla universal:

| Porcentaje | Destino On-Chain | Mecanismo On-Chain | Propósito Económico |
| :--- | :--- | :--- | :--- |
| **50.00%** | **Reservas Estratégicas** (`TreasuryManager.sol`) | Depósito directo en Tesorería (`AlphaVault.sol`) | Incrementa el NAV por token y fortalece las reservas respaldadas por activos |
| **25.00%** | **Corporate OpEx Vault** (`CorporateOpExVault.sol`) | Auto-Swap en DEX a `ALPHA` y Staking | Financia gastos operativos acumulando tokens ALPHA reales comprados en mercado |
| **25.00%** | **Corporate Profit Vault** (`CorporateProfitVault.sol`) | Auto-Swap en DEX a `ALPHA` y Staking | Acumula beneficios corporativos exclusivamente en tokens ALPHA reales comprados en mercado |

---

## 🏦 2. Composición de Activos y Sub-Reserva 80 / 20 de USDC

La Tesorería de `TreasuryManager.sol` mantiene una cartera diversificada multi-activo con las siguientes ponderaciones objetivo (`Target Asset Allocation`):

| Ponderación Target | Activo de Reserva | Estrategia de Liquidez y Rendimiento |
| :---: | :--- | :--- |
| **50.00%** | **USDC / Stablecoins** | **Sub-Reserva 80/20**: 80% auto-depositado en `MorphoYieldVaultAdapter.sol` (productos seguros con APY del ~6.45%) + 20% en Búfer Líquido de Tesorería (`treasuryLoanBuffer`) para originar Préstamos P2P y préstamos directos. |
| **25.00%** | **Wrapped Bitcoin (WBTC)** | En Staking / Rendimiento valorado on-chain vía Oráculos Chainlink BTC/USD (`OracleHub.sol`). |
| **12.50%** | **Wrapped Ethereum (WETH)** | Liquid Staking de ETH valorado on-chain vía Oráculos Chainlink ETH/USD (`OracleHub.sol`). |
| **12.50%** | **Native ALPHA Staking** | Reserva en staking nativo `$ALPHA` para respaldo de liquidez. |

---

## 🔒 3. Bóvedas Corporativas Exclusivas en Token ALPHA

Las carteras corporativas de OpEx y Beneficios no acumulan stablecoins ni activos heterogéneos:

1. **Moneda Única (`ALPHA`)**: Si una comisión ingresa en USDC u otro token, el `RealYieldRouter` efectúa una compra en mercado (DEX) del token `ALPHA`.
2. **Auto-Staking**: El token `ALPHA` resultante se deposita inmediatamente en `GovernanceStaking.sol` asignado a las bóvedas segregadas `CorporateOpExVault` y `CorporateProfitVault`.

---

## 🔀 4. Opciones de Cobro de Yield para Usuarios (`RealYieldRouter.sol`)

Los usuarios stakers de `stALPHA` pueden configurar su preferencia de cobro de dividendos en cualquier momento:

- **Opción A (`OPTION_A_STABLECOIN`)**: Cobro directo de dividendos en **USDC líquido** en su billetera.
- **Opción B (`OPTION_B_RESERVE_ASSET`)**: Auto-compounding mediante la conversión de dividendos a activos de reserva **WBTC / WETH**.

---

## 📊 5. Matriz Completa de Comisiones On-Chain (`ProtocolTokenomicsEngine.sol`)

| Operativa | Contrato Responsable | Comisión / Penalización | Reparto On-Chain |
| :--- | :--- | :--- | :--- |
| **Depósito en Tesorería** | `TreasuryManager.sol` | **0.50%** (50 BPS) | 50% Reservas / 25% OpEx / 25% Profit |
| **Rescate (Redeem)** | `TreasuryManager.sol` | **1.00%** (100 BPS) | 50% Reservas / 25% OpEx / 25% Profit |
| **Entrada a Staking** | `GovernanceStaking.sol` | **1.00%** (100 BPS) | **0.50% Quema Deflacionaria Permanente**, 0.25% OpEx, 0.25% Profit |
| **Acuñación de Bonos** | `VestedDiscountVault.sol` | **1.50%** Mint Fee + **1.50%** Referidos | 50% Reservas / 25% OpEx / 25% Profit |
| **Ragequit de Bonos** | `VestedDiscountVault.sol` | **15.00%** Penalización USDC | **100% de la penalización enrutada 50/25/25 + Quema 100% Unvested** |
| **Originación Préstamo P2P** | `P2PLendingMarket.sol` | **0.50%** (50 BPS) | 50% Reservas / 25% OpEx / 25% Profit |
| **Spread Interés P2P** | `P2PLendingMarket.sol` | **10.00%** del Interés Generado | 50% Reservas / 25% OpEx / 25% Profit |

---

## 📜 6. Escala de Descuentos para Bonos Vestados y Tiers VIP

Los bonos con descuento se mintean como **NFTs de Posición** (`VaultPositionNFT.sol`):

| Bloqueo | Descuento Base | Bonus VIP Staking Tier | Descuento Máximo Cap | Penalización Ragequit |
| :---: | :---: | :---: | :---: | :---: |
| **1 Año** | **5.00%** | **+1.00%** (>= 5k stALPHA) | **50.00%** | **15.00%** + Quema 100% Unvested |
| **2 Años** | **10.00%** | **+2.00%** (>= 10k stALPHA) | **50.00%** | **15.00%** + Quema 100% Unvested |
| **3 Años** | **15.00%** | **+3.00%** (>= 20k stALPHA) | **50.00%** | **15.00%** + Quema 100% Unvested |
| **4 Años** | **20.00%** | **+3.00%** (>= 20k stALPHA) | **50.00%** | **15.00%** + Quema 100% Unvested |

---

## 🤝 7. Parámetros de Préstamos P2P y Búfer de Tesorería (`P2PLendingMarket.sol`)

- **LTV Máximo:** **70.00%** para Activos Estándar / Position NFTs, **50.00%** para token ALPHA líquido.
- **Liquidadibilidad Min Health Factor:** **115.00%** (`minHealthFactorBps = 11500`).
- **Línea Directa de Tesorería:** Origen de fondos desde el 20% del Búfer Líquido de Tesorería.
- **Custodia en Escrow:** NFTs de posición retenidos en el mercado P2P como garantía hasta el pago total del principal + intereses.

---

## ⚡ 8. Control de Seguridad y Circuit Breaker (`CircuitBreaker.sol`)

- **Pausa de Emergencia:** Congelación inmediata del protocolo ante obsolescencia de oráculos (`staleness > 86400s`) o anomalías de volatilidad.
- **Invariante PoR Garantizado:** Evaluado dinámicamente antes y después de cada transacción de depósito/rescate (`postRatioBps >= preRatioBps`).

---

## 🛡️ 9. Proof of Reserves (PoR) e Invariante de Solvencia

El contrato `TreasuryManager.sol` calcula en todo momento la solvencia del protocolo combinando los activos custodiados con las obligaciones vigentes:

$$\text{Activos Totales USD} = \text{USDC Bóveda} + \text{Morpho Yield} + \text{WBTC/WETH} + \text{Préstamos P2P Activos}$$

$$\text{Pasivos Totales USD} = \text{Circulante ALPHA} \times \text{NAV} + \text{Obligaciones Bonos Vestados}$$

$$\text{Ratio PoR} = \left( \frac{\text{Activos Totales USD}}{\text{Pasivos Totales USD}} \right) \times 100 \ge \mathbf{100.00\%}$$
