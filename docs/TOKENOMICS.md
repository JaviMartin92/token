# 📜 BIBLIA DEFINITIVA DE TOKENOMICS — Viraje Protocol (PURE DEFI EDITION)

**Versión:** 7.0.0-Institutional  
**Fecha:** Noviembre 2026  
**Clasificación:** Infraestructura Descentralizada Institucional (Pure DeFi / MiCA Recital 22)  
**Red Canónica:** Arbitrum Sepolia (`421614`) / Arbitrum One (`42161`)  

---

## 🛡️ 0. DIRECTIVAS INMUTABLES E INVARIANTES DEL PROTOCOLO

El Protocolo Viraje Protocol está gobernado por 4 Directivas Inmutables de Inmunidad Operativa, codificadas a nivel de bytecode en la EVM y no modificables por ninguna entidad:

### 1. Directiva de Invariante de Colateralización Incondicional

$$\text{Ratio}_{\text{post\_tx}} \ge \text{Ratio}_{\text{pre\_tx}} \ge 100.00\%$$

* **Mecanismo On-Chain:** Evaluado en [`TreasuryManager.sol`](../contracts/src/TreasuryManager.sol) mediante la librería vinculada [`TreasuryPoRLib.sol`](../contracts/src/lib/TreasuryPoRLib.sol) en las funciones `deposit()` y `redeem()`.
* **Reversión Obligatoria:** Si cualquier transacción provocara una caída en el porcentaje de reservas (por redondeo, desajuste de oráculo o arbitraje), la EVM la revierte de inmediato con el error de seguridad:
  `"TreasuryManager: Security Violation - Transaction reduced collateralization ratio"`.

---

### 2. Prohibición Absoluta de Minteado Inflacionario Sin Respaldo

* **Regla Inquebrantable:** Ninguna billetera, equipo, inversor o fundador puede recibir tokens VIRAJE minteados sin un ingreso patrimonial previo o sin estar respaldados al 100% por la masa de colateral exógeno.
* **Mecanismo:** La acuñación solo existe cuando ingresa colateral real en la Tesorería valorado a precio oficial $NAV_{\text{spot}}$, o a través de bonos con descuento temporalmente bloqueados en [`VestedDiscountVault.sol`](../contracts/src/VestedDiscountVault.sol).
* **Asignación del Fundador (Bóveda Dedicada de Vesting por Superávit):**
  - La asignación inicial del creador (100,000 VIRAJE) se encuentra custodiada en el contrato autónomo [`FounderReserveVestingVault.sol`](../contracts/src/FounderReserveVestingVault.sol).
  - **Exclusión del Suministro Circulante:** Los 100,000 VIRAJE bloqueados **no computan como circulante libre** ni como pasivo exigible en el estado génesis (garantizando un inicio limpio con 0.00 VIRAJE en circulación y NAV exacto de $1.0000 USD).
  - **Desbloqueo Dinámico Condicionado a la Salud de Reservas:** La liberación de tokens no depende del transcurso ciego del tiempo, sino del superávit matemático real de la Tesorería ($\text{Solvencia} > 100.00\%$):
    $$\text{Superávit USD} = \max\left(0, \text{Total Activos USD} - \text{Total Pasivos USD}\right)$$
  - **Límite de Reclamo (10% Máximo) y Cooldown:** En cada ciclo solo se puede reclamar hasta el 10% del superávit convertido a VIRAJE a valor NAV oficial, imponiendo un enfriamiento estricto de 72 horas entre reclamos sucesivos.
  - **Inmunidad de Reservas:** El reclamo transfiere exclusivamente tokens VIRAJE custodiados en la bóveda hacia la billetera del fundador; **ningún activo de reserva (USDC/WBTC/WETH) es extraído jamás**, asegurando que el respaldo del protocolo permanezca intacto.

---

### 3. Invariante Deflacionario Incondicional (Quema Permanente)

* **Unstaking Exit Fee:** Al des-stakear participaciones de gobernanza, se retiene un 0.50% de comisión de salida. El 50% de esta cuota (0.25% del principal) es destruido de forma irreversible mediante `IBurnable(govToken).burn()` e informado a `ITreasury.recordBurn()`.
* **Ragequit de Bonos:** Al cancelar anticipadamente un bono vestado, el 100% de los tokens VIRAJE en vesting no consolidados son destruidos de forma irreversible, reteniendo además una penalización del 15.00% en USDC que acrece el NAV de la Tesorería (50%) y remunera a los stakers (50%).
* **Discount Buyback Engine:** Todos los tokens VIRAJE recomprados por el motor autónomo de estabilización en mercados secundarios (DEX) cuando $P_{\text{DEX}} \le NAV_{\text{spot}} \times 0.95$ son quemados atómicamente en la misma transacción.

---

### 4. Centinela Pre-Transaccional Institucional (`VirajeHypervisor.sol`)

Para erradicar transacciones fallidas y proteger a los usuarios de picos de gas artificiales en MetaMask (30M gas limit por revert de EVM), el contrato [`VirajeHypervisor.sol`](../contracts/src/VirajeHypervisor.sol) actúa como centinela previo:
* **Pre-Flight Invariant Simulation:** Simula el impacto de depósitos, rescates o préstamos antes de su confirmación, certificando que no se sobrepasen los techos de crédito ni los límites de exposición prudencial.
* **Monitoreo de Salud On-Chain:** Evalúa la frescura de los oráculos Chainlink/Pyth y el estado del secuenciador L2 de Arbitrum en tiempo real.

---

## 🌟 Visión General y Filosofía de Real Yield Descentralizado

Viraje Protocol opera bajo un modelo estricto de **Real Yield Respaldado por Activos Exógenos y Proof of Reserves (PoR) en Tiempo Real**. Todos los tokens VIRAJE emitidos cuentan con respaldo patrimonial verificable on-chain con un ratio de solvencia garantizado $\ge 100.00\%$. 

Bajo la arquitectura **Pure DeFi (MiCA Exemption Recital 22)**, el protocolo es un bien público inmutable sin comisiones corporativas ni intermediarios centralizados.

---

## 🏛️ 1. Reparto Universal de Comisiones (Modelo Binario 50/50)

Toda comisión recaudada por el protocolo (rescates de VIRAJE, des-staking, originación de créditos P2P, penalizaciones de *ragequit* y spreads de interés) ingresa a través del contrato [`RealYieldRouter.sol`](../contracts/src/RealYieldRouter.sol) y se distribuye estrictamente:

```
                            ┌────────────────────────────────────────┐
                            │    COMISIÓN GENERADA ON-CHAIN (USDC)   │
                            └───────────────────┬────────────────────┘
                                                │
                       ┌────────────────────────┴────────────────────────┐
                       │                                                 │
                 50.00% Real Yield                                 50.00% Accretion
                       │                                                 │
                       ▼                                                 ▼
        ┌─────────────────────────────┐                   ┌─────────────────────────────┐
        │ 💎 Community Yield Vault    │                   │ 🏛️ Reservas de Tesorería    │
        │ (`CommunityYieldVault.sol`) │                   │ (`TreasuryManager.sol`)     │
        │ Distribuido en tiempo real  │                   │ Inyectado directamente al   │
        │ como dividendos en USDC a   │                   │ `VirajeVault.sol`, elevando  │
        │ los stakers de `stVIRAJE`.   │                   │ el NAV spot de VIRAJE.      │
        └─────────────────────────────┘                   └─────────────────────────────┘
```

---

## 🏦 2. Composición de Activos Exógenos y Ponderaciones de Reserva

La Tesorería de [`TreasuryManager.sol`](../contracts/src/TreasuryManager.sol) mantiene una cartera diversificada de reservas exógenas con las siguientes ponderaciones objetivo (*Target Asset Allocation*):

| Activo de Reserva | Ponderación Objetivo | Rango Permitido (Min - Max) | Estrategia de Custodia y Rendimiento | Oráculo de Precio |
| :--- | :---: | :---: | :--- | :--- |
| **💵 USDC / Stablecoins** | **50.00%** (5,000 BPS) | 40.00% - 60.00% | • **80-90% Bóvedas Morpho Blue** (rendimiento pasivo institucional de bajo riesgo, ~5.5-6.5% APY).<br>• **10-20% Búfer Líquido de Tesorería** en `VirajeVault.sol` para préstamos P2P. | Chainlink `USDC/USD` |
| **🪙 Wrapped Bitcoin (WBTC)** | **25.00%** (2,500 BPS) | 20.00% - 30.00% | Colateral duro de máxima solidez y reserva de valor exógena custodiada en `VirajeVault.sol`. | Chainlink `BTC/USD` |
| **💎 Wrapped Ethereum (WETH)** | **12.50%** (1,250 BPS) | 10.00% - 15.00% | Colateral exógeno de alta liquidez e infraestructura base DeFi en `VirajeVault.sol`. | Chainlink `ETH/USD` |
| **🏛️ Sub-Reserva VIRAJE Staking (POL)** | **12.50%** (1,250 BPS) | 5.00% - 15.00% | Sub-reserva institucional de Protocol-Owned Liquidity (POL) auto-bloqueada en `GovernanceStaking.sol`. | Valorado a $NAV_{\text{spot}}$ oficial |

---

## 🥩 3. Desglose de los 3 Niveles de Staking del Protocolo

El contrato [`GovernanceStaking.sol`](../contracts/src/GovernanceStaking.sol) audita y desglosa en todo momento los 3 niveles de staking on-chain:

```solidity
function getStakingBreakdown() external view returns (StakingBreakdown memory breakdown) {
    // 1. Stake en Bóveda Comunitaria
    breakdown.communityVaultStaked = balanceOf(communityYieldVault) + govToken.balanceOf(communityYieldVault);
    
    // 2. Stake en Reservas de Tesorería (Protocol-Owned Staking)
    breakdown.treasuryStaked = balanceOf(treasury) + balanceOf(virajeVault) + balanceOf(promoVault);
    
    // 3. Stake de la Comunidad (Inversores y Usuarios Particulares)
    breakdown.communityStaked = totalStaked - (communityVaultStaked + treasuryStaked);
    
    // Total Global en Staking
    breakdown.globalTotalStaked = breakdown.communityStaked + breakdown.communityVaultStaked + breakdown.treasuryStaked;
}
```

### Tabla Resumen de los 3 Tiers de Staking:

| Nivel de Stake | Dueño On-Chain | Propósito / Beneficio |
| :--- | :--- | :--- |
| **👤 Stake Comunidad** | Usuarios e inversores individuales. | Bloqueo de VIRAJE a cambio de `stVIRAJE` (Poder de voto DAO 1:1 + cobro continuo de dividendos de Real Yield en USDC). Entrada **100% sin comisiones (0.00%)**. |
| **💎 Stake Bóveda Comunitaria** | [`CommunityYieldVault.sol`](../contracts/src/CommunityYieldVault.sol) | Fondo comunitario nutrido con el 50% de las comisiones de salida (unstake) para incentivos futuros y pools de recompensa. |
| **🏛️ Stake Reservas** | [`TreasuryManager.sol`](../contracts/src/TreasuryManager.sol) / [`VirajeVault.sol`](../contracts/src/VirajeVault.sol) | Sub-reserva institucional de Protocol-Owned Liquidity (POL) para proteger la gobernanza y canalizar rendimientos de vuelta al NAV. |

---

## 🔄 4. Arquitectura de Entrada y Salida de Staking

Para garantizar máxima tracción y lealtad de capital, la política de staking sigue la filosofía institucional de **cero fricción al entrar y comisión prudencial al salir**:

* **Entrada (Stake): `0.00%` Fricción.** El 100% de los tokens VIRAJE bloqueados se convierten 1:1 en `stVIRAJE`.
* **Salida (Unstake): `0.50%` Exit Fee.**
  * **50% de la Comisión (0.25% del total):** Se quema de manera permanente e irreversible (`IBurnable.burn()`), reduciendo la masa circulante y acreciendo el NAV de todos los holders.
  * **50% de la Comisión (0.25% del total):** Se deposita en `CommunityYieldVault.sol` como recompensa de Real Yield inmediato para los stakers que permanecen fieles en el protocolo.
  * **99.50% Restante:** Se entrega de forma líquida e inmediata en tokens VIRAJE a la billetera del usuario.

---

## 🛡️ 5. Mecanismo de Emisión: 0.00% Base y Protección Anti-Ballenas

En [`TreasuryFeeLib.sol`](../contracts/src/lib/TreasuryFeeLib.sol), la acuñación de nuevas participaciones VIRAJE a valor NAV elimina cualquier fricción de entrada para el 99.9% de las transacciones:

* **Depósitos Normales ($\text{Impacto} \le 20.00\%$ de las Reservas):**
  $$\text{Comisión de Acuñación} = \mathbf{0.00\%}$$
  Los inversores reciben exactamente $1.0000$ USD de valor NAV en tokens VIRAJE por cada $1.0000$ USDC depositado.
* **Ataques de Ballenas o Arbitraje Extremo ($\text{Impacto} > 20.00\%$ de las Reservas):**
  Para evitar que un depósito colosal diluya el rendimiento de la tesorería o manipule el precio spot mediante flash loans, se aplica una comisión de slippage dinámico estrictamente sobre el exceso:
  $$\text{DynamicFeeBps} = \min\left(\frac{(\text{ImpactRatio} - 2000) \times \text{Sensitivity}}{10000},\; 200\text{ bps (2.00\%)}\right)$$

---

## 📊 6. Matriz Completa de Comisiones On-Chain (`ProtocolTokenomicsEngine.sol`)

| Operación On-Chain | Contrato Ejecutor | Comisión Aplicada | Distribución de la Comisión |
| :--- | :--- | :---: | :--- |
| **Depósito en Tesorería** | [`TreasuryManager.sol`](../contracts/src/TreasuryManager.sol) | **0.00%** (Base)<br>Máx. 2.00% solo si impacto > 20% | 50% Reservas (Accretion) / 50% Community Yield |
| **Rescate de Shares (Redeem)** | [`TreasuryManager.sol`](../contracts/src/TreasuryManager.sol) | **1.00% Fijo** | 50% Reservas (Accretion) / 50% Community Yield |
| **Entrada a Staking** | [`GovernanceStaking.sol`](../contracts/src/GovernanceStaking.sol) | **0.00%** (1:1 stVIRAJE) | Cero fricción de entrada |
| **Salida de Staking (Unstake)** | [`GovernanceStaking.sol`](../contracts/src/GovernanceStaking.sol) | **0.50% Fijo** | 50% Quema Permanente / 50% Community Yield |
| **Emisión de Bonos Vestados** | [`VestedDiscountVault.sol`](../contracts/src/VestedDiscountVault.sol) | **0.00%** (Fricción cero) | Emisión limpia en NFT de Posición |
| **Originación Préstamo P2P** | [`P2PLendingMarket.sol`](../contracts/src/P2PLendingMarket.sol) | **0.25% Fijo** | 100% Inyectado a Stakers (Real Yield) |
| **Línea de Crédito Tesorería** | [`P2PLendingMarket.sol`](../contracts/src/P2PLendingMarket.sol) | **6.00% APR Fijo** | 90% Reservas Tesorería / 10% Community Yield |
| **Spread de Margen Préstamos** | [`P2PLendingMarket.sol`](../contracts/src/P2PLendingMarket.sol) | **10.00% del Interés** | 90% Acrecimiento Tesorería / 10% Community Yield |
| **Penalización Ragequit Bonos** | [`VestedDiscountVault.sol`](../contracts/src/VestedDiscountVault.sol) | **15.00% Principal USDC** | 50% Reservas + 50% Stakers + Quema 100% VIRAJE no vestado |

---

## 📜 7. Escala de Bonos Vestados y Sostenibilidad Financiera

Los bonos con descuento se emiten como NFTs de Posición ERC-721 ([`VaultPositionNFT.sol`](../contracts/src/VaultPositionNFT.sol)):

| Plazo de Bloqueo | Descuento Base | Bonus VIP ($\ge 5\text{k stVIRAJE}$) | Descuento Efectivo Total | Penalización Ragequit |
| :---: | :---: | :---: | :---: | :---: |
| **1 Año** | **10.00%** | +1.00% | Hasta 11.00% | 15.00% USDC + Quema 100% VIRAJE |
| **2 Años** | **20.00%** | +2.00% | Hasta 22.00% | 15.00% USDC + Quema 100% VIRAJE |
| **3 Años** | **30.00%** | +3.00% | Hasta 33.00% | 15.00% USDC + Quema 100% VIRAJE |
| **4 Años** | **40.00%** | +4.00% | Hasta 44.00% | 15.00% USDC + Quema 100% VIRAJE |
| **5 Años** | **50.00%** | +5.00% | Hasta 55.00% | 15.00% USDC + Quema 100% VIRAJE |

### 🧮 Demostración Matemática de Sostenibilidad (Zero-Coupon Bond Economics)

Un bono vestado funciona como un **bono cupón cero pre-financiado**: el inversor entrega el capital el Día 1. El protocolo coloca el 80% de este capital en adaptadores de rendimiento (Morpho Blue / Aave v3) a un APY promedio del **6.00%**:

Para un bono de 3 años con valor nominal de **$10,000 USD** adquirido con **30% de descuento** (pago inicial de **$7,000 USDC**):

$$\text{Capital Compuesto en Bóvedas Morpho (6.00% APY)} = \$7,000 \times (1 + 0.06)^3 = \$7,000 \times 1.191016 = \$8,337.11\text{ USD}$$

Sumando la cuota de acreditación y los ingresos por spreads de crédito en la Tesorería sobre el búfer líquido restante, el capital acumulado al vencimiento supera el valor de rescate debido, garantizando **cero riesgo de insolvencia** para el protocolo.

---

## 🤝 8. Préstamos P2P y Línea de Crédito de Tesorería (`P2PLendingMarket.sol`)

* **Parámetros Institucionales de Colateralización:**
  * **NFTs de Posición de Bonos:** Haircut institucional del **65.00%** sobre el valor base $\times$ LTV Máximo del **70.00%** = **`45.50%` LTV Efectivo**.
  * **Wrapped Bitcoin (WBTC):** **`75.00%` LTV Máximo** (oráculo Chainlink BTC/USD).
  * **Wrapped Ethereum (WETH):** **`80.00%` LTV Máximo** (oráculo Chainlink ETH/USD).
  * **Tokens VIRAJE:** Haircut del 50% $\times$ 50% LTV = **`25.00%` LTV Efectivo**.
* **Techo Prudencial de Colateral Reflexivo:** `circularCollateralCapBps = 4500` (45.00% de la línea de crédito = **$3,435.41 USDC** de capacidad máxima permitida para VIRAJE/NFTs), restringiendo el riesgo reflexivo a menos del 9% de las reservas totales.
* **Umbral de Liquidación (Health Factor):** $HF < 1.15$ ($115.00\% \rightarrow \text{Liquidación}$).
* **Línea de Crédito Institucional:** Tasa fija de **`6.00% APR`** financiada por la Tesorería.
* **Defensa Asimétrica en Sequencer Grace Period (L2):** Si el secuenciador de Arbitrum se detiene o reinicia, los prestatarios pueden amortizar deuda (`repayLoan`), pero las liquidaciones agresivas quedan temporalmente congeladas para proteger al usuario de caídas falsas de oráculos.

---

## 🛡️ 9. Proof of Reserves (PoR) y Fórmula de Solvencia

El contrato [`TreasuryManager.sol`](../contracts/src/TreasuryManager.sol) junto a [`TreasuryPoRLib.sol`](../contracts/src/lib/TreasuryPoRLib.sol) calcula en cada bloque la solvencia del protocolo y el valor patrimonial neto con deducción estricta de deuda externa:

$$\text{Activos Totales Exógenos USD} = \text{USDC}_{\text{Vault}} + \text{Morpho}_{\text{Yield}} + (\text{WBTC} \times P_{\text{BTC}}) + (\text{WETH} \times P_{\text{ETH}}) + \text{DeudaP2P}_{\text{USD}}$$

$$\text{Pasivos Totales USD} = (\text{Circulante Neto VIRAJE} \times \text{NAV}) + \text{Pasivos Deuda Bonos Vestados USD}$$

$$\text{Ratio PoR} = \left(\frac{\text{Activos Totales Exógenos USD}}{\text{Pasivos Totales USD}}\right) \times 100 \ge \mathbf{100.00\%}$$

### Cálculo Institucional de Patrimonio Neto (Net Equity) y NAV por Acción

$$\text{Patrimonio Neto Libre (Net Equity USD)} = \max\left(0, \text{Activos Totales Exógenos USD} - \text{Pasivos Deuda Bonos Vestados USD}\right)$$

$$\mathbf{\text{NAV Oficial por Share}} = \frac{\text{Patrimonio Neto Libre (Net Equity USD)}}{\text{Circulante Neto VIRAJE}}$$

* **Blindaje contra Distorsión:** La emisión de un bono mantiene invariable el NAV spot de VIRAJE.
* **Acreción Orgánica Real:** El NAV de VIRAJE solo se incrementa cuando las reservas generan rendimientos pasivos (Morpho Blue / spread P2P) o cuando se recaudan cuotas de protocolo.

---

## 🔥 10. Motor Autónomo de Recompra por Descuento (`DiscountBuybackEngine.sol`)

Cuando el token $VIRAJE$ cotiza en mercados secundarios (DEX) con un descuento significativo respecto a su $NAV_{\text{spot}}$, el protocolo activa recompras directas utilizando reservas líquidas exógenas y destruye los tokens adquiridos en la misma transacción:

### 10 Candados de Control Matemático Estricto:

1. **Candado 1 (Descuento Mínimo $\ge 5.00\%$):** $P_{\text{DEX}} \le NAV_{\text{spot}} \times 0.95$.
2. **Candado 2 (Presupuesto Diario $\le 2.50\%$):** Límite máximo de gasto diario del 2.50% de las reservas líquidas de tesorería.
3. **Candado 3 (Monotonicidad Obligatoria $\Delta NAV > 0$):** $NAV_{\text{post}} > NAV_{\text{pre}}$.
4. **Candado 4 (Quema Atómica On-Chain):** Los tokens adquiridos se queman inmediatamente mediante `_burn()`.
5. **Candado 5 (Slippage Máximo 1.00%):** Protección contra fluctuaciones de precio en el pool.
6. **Candado 6 (Cooldown Anti-Spam de 4h):** Período de enfriamiento obligatorio entre recompras sucesivas.
7. **Candado 7 (Exclusividad de Activos Exógenos):** Fondos de recompra obtenidos exclusivamente de reservas USDC.
8. **Candado 8 (Integración con CircuitBreaker):** Bloqueo automático ante congelamiento por volatilidad extrema.
9. **Candado 9 (Ratio de Solvencia $PoR \ge 100.00\%$):** Verificación matemática previa y posterior a la transacción.
10. **Candado 10 (Límite por Trade $\le 1.00\%$ de Liquidez):** Mitiga el impacto en el libro de órdenes / pool AMM.

---

## 🔐 11. Blindaje Post-Cuántico de la Tesorería (`PostQuantumGuard.sol`)

Para proteger la gobernanza y la tesorería ante la computación cuántica (algoritmo de Shor contra curvas $secp256k1$), el protocolo integra [`PostQuantumGuard.sol`](../contracts/src/PostQuantumGuard.sol):

* **Firmas W-OTS+ (NIST SP 800-208):** Esquema de firmas basadas en árboles y cadenas de hash Keccak-256 evaluadas en gas nativo EVM sin precompilados experimentales.
* **Seguridad Grover de 128 bits:** Inmune a aceleración cuántica de búsqueda.
* **Autorización Híbrida Dual:** Operaciones críticas de gobernanza pueden exigir firma ECDSA estándar + certificación W-OTS+ con protección estricta anti-replay.
