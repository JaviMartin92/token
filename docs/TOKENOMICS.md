# 📜 BIBLIA DEFINITIVA DE TOKENOMICS — ALPHA CENTAURI PROTOCOL (PURE DEFI EDITION)

## 🛡️ 0. DIRECTIVAS INMUTABLES E INVARIANTES DEL PROTOCOLO

El Protocolo Alpha Centauri está gobernado por 3 Directivas Inmutables de Inmunidad Operativa, codificadas a nivel de bytecode en la EVM y no modificables por ninguna entidad:

### 1. Directiva de Invariante de Colateralización Incondicional

$$\text{Ratio}_{\text{post\_tx}} \ge \text{Ratio}_{\text{pre\_tx}} \ge 100.00\%$$

* **Mecanismo On-Chain:** Evaluado en [`TreasuryManager.sol`](file:///c:/Users/Admin/Desktop/token/contracts/src/TreasuryManager.sol) en las funciones `deposit()` y `redeem()`.
* **Reversión Obligatoria:** Si cualquier transacción provocara una caída en el porcentaje de reservas (por redondeo, desajuste de oráculo o arbitraje), la EVM la revierte de inmediato con el error de seguridad:
  `"TreasuryManager: Security Violation - Transaction reduced collateralization ratio"`.

---

### 2. Prohibición Absoluta de Minteado Inflacionario Sin Respaldo

* **Regla Inquebrantable:** Ninguna billetera, equipo, inversor o fundador puede recibir tokens ALPHA minteados sin un ingreso patrimonial previo o sin estar respaldados al 100% por la masa de colateral exógeno.
* **Mecanismo:** La acuñación solo existe cuando ingresa colateral real en la Tesorería valorado a precio oficial $NAV_{\text{spot}}$, o a través de bonos con descuento temporalmente bloqueados en [`VestedDiscountVault.sol`](file:///c:/Users/Admin/Desktop/token/contracts/src/VestedDiscountVault.sol).

---

### 3. Invariante Deflacionario Incondicional (Quema Permanente)

* **Staking:** El 50% de la comisión de entrada al pool de gobernanza (0.50% del total bloqueado) es destruido de forma irreversible en la dirección de quema `0x000000000000000000000000000000000000dEaD` mediante `_burn`.
* **Ragequit de Bonos:** Al cancelar anticipadamente un bono vestado, el 100% de los tokens ALPHA en vesting no consolidados son destruidos de forma irreversible, reteniendo además una penalización del 15.00% en USDC que acrece el NAV de la Tesorería.

---

## 🌟 Visión General y Filosofía de Real Yield Descentralizado

Alpha Centauri opera bajo un modelo estricto de **Real Yield Respaldado por Activos Exógenos y Proof of Reserves (PoR) en Tiempo Real**. Todos los tokens ALPHA emitidos cuentan con respaldo patrimonial verificable on-chain con un ratio de solvencia garantizado $\ge 100.00\%$. 

Bajo la arquitectura **Pure DeFi (MiCA Exemption Recital 22)**, el protocolo es un bien público inmutable sin comisiones corporativas ni intermediarios centralizados.

---

## 🏛️ 1. Reparto Universal de Comisiones (Modelo Binario 50/50)

Toda comisión generada por cualquier operativa del ecosistema (depósitos, rescates, compra de bonos vestados, penalizaciones de *ragequit*, comisiones de originación P2P y spreads de interés) ingresa a través del contrato [`RealYieldRouter.sol`](file:///c:/Users/Admin/Desktop/token/contracts/src/RealYieldRouter.sol) y se distribuye estrictamente:

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
        │ como dividendos en USDC a   │                   │ `AlphaVault.sol`, elevando  │
        │ los stakers de `stALPHA`.   │                   │ el $NAV_{\text{spot}}$ de ALPHA. │
        └─────────────────────────────┘                   └─────────────────────────────┘
```

---

## 🏦 2. Composición de Activos Exógenos y Ponderaciones de Reserva

La Tesorería de [`TreasuryManager.sol`](file:///c:/Users/Admin/Desktop/token/contracts/src/TreasuryManager.sol#L63-L69) mantiene una cartera diversificada de reservas exógenas con las siguientes ponderaciones objetivo (*Target Asset Allocation*):

| Activo de Reserva | Ponderación Objetivo | Rango Permitido (Min - Max) | Estrategia de Custodia y Rendimiento | Oráculo de Precio |
| :--- | :---: | :---: | :--- | :--- |
| **💵 USDC / Stablecoins** | **50.00%** (5,000 BPS) | 40.00% - 60.00% | • **80-90% Bóvedas Morpho Blue** (rendimiento pasivo institucional de bajo riesgo).<br>• **10-20% Búfer Líquido de Tesorería** en `AlphaVault.sol`. | Chainlink `USDC/USD` |
| **🪙 Wrapped Bitcoin (WBTC)** | **25.00%** (2,500 BPS) | 20.00% - 30.00% | Colateral duro de máxima solidez y reserva de valor exógena custodiada en `AlphaVault.sol`. | Chainlink `BTC/USD` |
| **💎 Wrapped Ethereum (WETH)** | **12.50%** (1,250 BPS) | 10.00% - 15.00% | Colateral exógeno de alta liquidez e infraestructura base DeFi en `AlphaVault.sol`. | Chainlink `ETH/USD` |
| **🏛️ Sub-Reserva ALPHA Staking (POL)** | **12.50%** (1,250 BPS) | 5.00% - 15.00% | Sub-reserva institucional de Protocol-Owned Liquidity (POL) auto-bloqueada en `GovernanceStaking.sol`. | Valorado a $NAV_{\text{spot}}$ oficial |

---

## 🥩 3. Desglose de los 3 Niveles de Staking del Protocolo

El contrato [`GovernanceStaking.sol`](file:///c:/Users/Admin/Desktop/token/contracts/src/GovernanceStaking.sol#L312-L330) audita y desglosa en todo momento los 3 niveles de staking on-chain:

```solidity
function getStakingBreakdown() external view returns (StakingBreakdown memory breakdown) {
    // 1. Stake en Bóveda Comunitaria
    breakdown.communityVaultStaked = balanceOf(communityYieldVault) + govToken.balanceOf(communityYieldVault);
    
    // 2. Stake en Reservas de Tesorería (Protocol-Owned Staking)
    breakdown.treasuryStaked = balanceOf(treasury) + balanceOf(alphaVault) + balanceOf(promoVault);
    
    // 3. Stake de la Comunidad (Inversores y Usuarios Particulares)
    breakdown.communityStaked = totalStaked - (communityVaultStaked + treasuryStaked);
    
    // Total Global en Staking
    breakdown.globalTotalStaked = breakdown.communityStaked + breakdown.communityVaultStaked + breakdown.treasuryStaked;
}
```

### Tabla Resumen de los 3 Tiers de Staking:

| Nivel de Stake | Dueño On-Chain | Propósito / Beneficio |
| :--- | :--- | :--- |
| **👤 Stake Comunidad** | Usuarios e inversores individuales. | Bloqueo de ALPHA a cambio de `stALPHA` (Poder de voto DAO 1:1 + cobro continuo de dividendos de Real Yield en USDC). |
| **💎 Stake Bóveda Comunitaria** | [`CommunityYieldVault.sol`](file:///c:/Users/Admin/Desktop/token/contracts/src/CommunityYieldVault.sol) | Fondo comunitario nutrido con el 50% de las comisiones de entrada a staking (0.50% del depósito) para programas de incentivo futuros. |
| **🏛️ Stake Reservas** | [`TreasuryManager.sol`](file:///c:/Users/Admin/Desktop/token/contracts/src/TreasuryManager.sol) / [`AlphaVault.sol`](file:///c:/Users/Admin/Desktop/token/contracts/src/AlphaVault.sol) | Sub-reserva institucional de Protocol-Owned Liquidity (POL) para proteger la gobernanza y canalizar rendimientos de vuelta al NAV. |

---

## 🔄 4. Mecanismo de Entrada a Staking y Quema Deflacionaria

Al ingresar al pool de gobernanza [`GovernanceStaking.sol`](file:///c:/Users/Admin/Desktop/token/contracts/src/GovernanceStaking.sol#L240):

$$\text{Comisión Entrada} = \text{Monto ALPHA} \times 1.00\%$$

* **50% de la Comisión (0.50% Total):** Se envía a la dirección de quema `0x000...dEaD` (**Quema Definitiva e Irreversible**). Reduce el suministro global de ALPHA permanentemente.
* **50% de la Comisión (0.50% Total):** Se transfiere a [`CommunityYieldVault.sol`](file:///c:/Users/Admin/Desktop/token/contracts/src/CommunityYieldVault.sol) (**Fondo de Reserva Comunitario**).
* **99.00% Restante:** Se bloquea en el contrato de staking y se acuñan participaciones `stALPHA` 1:1 para el usuario.

---

## 🛡️ 5. Mecanismo de Emisión Anti-Dilución: Dynamic Slippage Fee (NAV Protection)

Para proteger la masa patrimonial del protocolo y evitar arbitrajes por depósitos masivos de ballenas, la emisión de nuevos tokens ALPHA a valor NAV utiliza un algoritmo de Slippage Dinámico:

$$\text{DynamicFeeBps} = \min\left(\text{FeeBase} + \left(\frac{\text{MontoUSD} \times 10000}{\text{ReservasActuales} + \text{MontoUSD}}\right) \times \frac{\gamma}{10000},\; \text{CapMax}\right)$$

* $\text{FeeBase} = 50\text{ bps (0.50\%)}$
* $\gamma = 500\text{ bps (5.00\%)}$
* $\text{CapMax} = 500\text{ bps (5.00\%)}$

**Accreción Automática de NAV:** El 100% de la comisión recaudada se divide 50% para reservas (acreciendo el NAV) y 50% para la Bóveda Comunitaria de Real Yield.

---

## 📊 6. Matriz Completa de Comisiones On-Chain (`ProtocolTokenomicsEngine.sol`)

| Operación On-Chain | Contrato Ejecutor | Comisión Aplicada | Distribución de la Comisión |
| :--- | :--- | :---: | :--- |
| **Depósito en Tesorería** | [`TreasuryManager.sol`](file:///c:/Users/Admin/Desktop/token/contracts/src/TreasuryManager.sol) | Dinámica (0.50% - 5.00%) | 50% Reservas (Accretion) / 50% Community Yield |
| **Rescate de Shares (Redeem)** | [`TreasuryManager.sol`](file:///c:/Users/Admin/Desktop/token/contracts/src/TreasuryManager.sol) | 1.00% Fijo | 50% Reservas (Accretion) / 50% Community Yield |
| **Entrada a Staking** | [`GovernanceStaking.sol`](file:///c:/Users/Admin/Desktop/token/contracts/src/GovernanceStaking.sol) | 1.00% Fijo | 50% Quema Permanente / 50% Community Yield |
| **Originación Préstamo P2P** | [`P2PLendingMarket.sol`](file:///c:/Users/Admin/Desktop/token/contracts/src/P2PLendingMarket.sol) | 0.50% Fijo | 50% Reservas (Accretion) / 50% Community Yield |
| **Spread de Margen Préstamos** | [`P2PLendingMarket.sol`](file:///c:/Users/Admin/Desktop/token/contracts/src/P2PLendingMarket.sol) | 10.00% del Interés | 90% Acrecimiento Tesorería / 10% Community Yield |
| **Penalización Ragequit Bonos** | [`VestedDiscountVault.sol`](file:///c:/Users/Admin/Desktop/token/contracts/src/VestedDiscountVault.sol) | 15.00% Principal USDC | 100% Inyección a Reservas + Quema 100% ALPHA no vestado |

---

## 📜 7. Escala de Descuentos para Bonos Vestados (`VestedDiscountVault.sol`)

Los bonos con descuento se emiten como NFTs de Posición ERC-721 ([`VaultPositionNFT.sol`](file:///c:/Users/Admin/Desktop/token/contracts/src/VaultPositionNFT.sol)):

| Plazo de Bloqueo | Descuento Base | Bonus VIP ($\ge 5\text{k stALPHA}$) | Descuento Máximo Cap | Penalización Ragequit |
| :---: | :---: | :---: | :---: | :---: |
| **1 Año** | 5.00% | +1.00% | 50.00% | 15.00% USDC + Quema 100% ALPHA no vestado |
| **2 Años** | 10.00% | +2.00% | 50.00% | 15.00% USDC + Quema 100% ALPHA no vestado |
| **3 Años** | 15.00% | +3.00% | 50.00% | 15.00% USDC + Quema 100% ALPHA no vestado |
| **4 Años** | 20.00% | +3.00% | 50.00% | 15.00% USDC + Quema 100% ALPHA no vestado |

---

## 🤝 8. Préstamos P2P y Línea de Crédito de Tesorería (`P2PLendingMarket.sol`)

* **LTV Máximo Permitido:** 70.00% para Position NFTs (ERC-721) / 50.00% para colaterales ALPHA líquidos.
* **Umbral Mínimo de Liquidación (Health Factor):** 115.00% ($HF < 1.15 \rightarrow \text{Liquidación}$).
* **Línea de Crédito Institucional:** Hasta un 20.00% del búfer de stablecoins de la Tesorería puede ser colocado en préstamos sobrecolateralizados devengando intereses continuos para el protocolo.
* **Colaterales Aceptados:** NFTs de Posición, WBTC, WETH y tokens ALPHA.

---

## 🛡️ 9. Proof of Reserves (PoR) y Fórmula de Solvencia

El contrato [`TreasuryManager.sol`](file:///c:/Users/Admin/Desktop/token/contracts/src/TreasuryManager.sol#L313-L329) calcula en cada bloque la solvencia del protocolo:

$$\text{Activos Totales Exógenos USD} = \text{USDC}_{\text{Vault}} + \text{Morpho}_{\text{Yield}} + (\text{WBTC} \times P_{\text{BTC}}) + (\text{WETH} \times P_{\text{ETH}}) + \text{DeudaP2P}_{\text{USD}}$$

$$\text{Pasivos Totales USD} = (\text{Circulante Neto ALPHA} \times \text{NAV}) + \text{Pasivos Bonos Vestados}$$

$$\text{Ratio PoR} = \left(\frac{\text{Activos Totales Exógenos USD}}{\text{Pasivos Totales USD}}\right) \times 100 \ge \mathbf{100.00\%}$$

$$\text{NAV Oficial por Share} = \frac{\text{Activos Totales Exógenos USD}}{\text{Circulante Neto ALPHA}}$$

---

## 🔥 10. Motor Autónomo de Recompra por Descuento (`DiscountBuybackEngine.sol`)

Cuando el token $ALPHA$ cotiza en mercados secundarios (DEX) con un descuento significativo respecto a su $NAV_{\text{spot}}$, el protocolo activa recompras directas utilizando reservas líquidas exógenas y destruye los tokens adquiridos en la misma transacción:

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

