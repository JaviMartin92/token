Aquí tienes el documento oficial de Tokenomics en Markdown limpio, con el formato de ecuaciones LaTeX corregido para evitar errores de renderizado y adaptado al modelo **Pure DeFi Edition**. Puedes copiarlo y pegarlo directamente en tu archivo `docs/TOKENOMICS.md`:

```markdown
# 📜 BIBLIA DEFINITIVA DE TOKENOMICS — ALPHA CENTAURI PROTOCOL (PURE DEFI EDITION)

## 🛡️ 0. DIRECTIVAS INMUTABLES E INVARIANTES DEL PROTOCOLO

El Protocolo Alpha Centauri está gobernado por 3 Directivas Inmutables de Inmunidad Operativa, codificadas a nivel de bytecode en la EVM y no modificables por ninguna entidad:

### 1. Directiva de Invariante de Colateralización Incondicional

Ratio_post_tx >= Ratio_pre_tx

* **Mecanismo On-Chain:** Evaluado en `TreasuryManager.sol` en las funciones `deposit()` y `redeem()`.
* **Reversión Obligatoria:** Si cualquier transacción provocara una caída en el porcentaje de reservas (por redondeo, desajuste de oráculo o arbitraje), la EVM la revierte de inmediato con el mensaje: `"TreasuryManager: Security Violation - Transaction reduced collateralization ratio"`.

### 2. Prohibición Absoluta de Minteado Inflacionario Sin Respaldo

* **Regla:** Ninguna billetera, bóveda de ecosistema, equipo o fundador puede recibir tokens ALPHA minteados sin ingreso patrimonial previo o sin estar respaldados dinámicamente por la masa de colateral.
* **Mecanismo:** La acuñación solo existe cuando ingresa colateral real en USDC en la Tesorería o cuando los devengos del `GenesisVestingVault.sol` cumplen la validación del Proof of Reserves >= 100.00%. Las comisiones asignadas a las bóvedas de ecosistema (25% OpEx Grants / 25% Community Yield) provienen exclusivamente de compras reales en el mercado DEX efectuadas por `RealYieldRouter.sol`.

### 3. Invariante Deflacionario Incondicional (Quema Permanente)

* **Staking:** El 50% de la comisión de entrada al pool de gobernanza (0.50% del total bloqueado) es destruido de forma irreversible mediante `_burn`.
* **Ragequit:** Al cancelar anticipadamente un bono vestado (`VestedDiscountVault.sol`), el 100% de los tokens ALPHA asociados en vesting son destruidos de forma irreversible, además de retener la penalización del 15.00% en USDC para las reservas.

---

## 🌟 Visión General y Filosofía de Real Yield Descentralizado

El Protocolo Alpha Centauri opera bajo un modelo estricto de Real Yield Respaldado por Activos Exógenos y Proof of Reserves (PoR) en Tiempo Real. Todos los tokens ALPHA emitidos cuentan con respaldo patrimonial verificable on-chain con un ratio de solvencia garantizado >= 100.00%. Bajo la arquitectura Pure DeFi, el protocolo es un bien público inmutable gobernado exclusivamente por la comunidad vía Smart Contracts.

---

## 🏛️ 1. Reparto Universal de Comisiones (Modelo Pure DeFi Binario 50/50)

Toda comisión generada por cualquier operativa de la plataforma (depósitos, rescates, compra de bonos vestados, penalizaciones por *ragequit*, originación e intereses de préstamos P2P) ingresa a través del contrato `RealYieldRouter.sol` y se distribuye estrictamente bajo un modelo binario, habiendo erradicado cualquier extracción corporativa para cumplir con la exención del Recital 22 de MiCA:

* **50.00% - Reservas Estratégicas (`TreasuryManager.sol`):** Inyección directa al `AlphaVault.sol`. Incrementa instantáneamente el $NAV_{\text{spot}}$ por token y fortalece el respaldo patrimonial de los activos exógenos.
* **50.00% - Community Real Yield Vault (`CommunityYieldVault.sol`):** Capital líquido destinado exclusivamente a los *stakers* de la comunidad. Se acabó la bóveda de operaciones (OpEx); el protocolo es un bien público puro.

---

## 🏦 2. Composición de Activos Exógenos Puros y Gestión de Liquidez

La Tesorería de `TreasuryManager.sol` mantiene una cartera de reservas exclusivamente exógena con las siguientes ponderaciones objetivo (*Target Asset Allocation*):

* **60.00%: USDC / Stablecoins:** Sub-Reserva orientada a rendimiento y liquidez: **90.0% colocado en Bóvedas MetaMorpho de Morpho Blue (6.45% APY)** + **10.0% Búfer Líquido de Tesorería** retenido en `AlphaVault.sol` para rescates inmediatos e inyecciones a la Línea de Crédito P2P.
* **26.67%: Wrapped Bitcoin (WBTC):** Staking Lombard (LBTC) / Suministro Morpho (3.80% APY) valorado on-chain vía Oráculos Chainlink BTC/USD (`OracleHub.sol`).
* **13.33%: Wrapped Ethereum (WETH):** Liquid Staking Lido (wstETH) (4.20% APY) / Colateral Morpho valorado on-chain vía Oráculos Chainlink ETH/USD (`OracleHub.sol`).

*Nota de Arquitectura y Saneamiento Contable:* Los tokens ALPHA stapeados en Gobernanza forman parte de la sub-reserva interna retenida respaldada 1:1 por USDC y nunca se contabilizan dentro de la tabla de activos exógenos para evitar doble contabilización patrimonial.

---

## 🔄 3. Mecanismo de Liquidez, Desembolso y Gestión de Insuficiencias

Para garantizar que el protocolo responda de manera impecable ante situaciones de tensión de liquidez (por ejemplo, cuando hay alta demanda de rescates o desembolsos de créditos y el pool líquido inmediato se contrae):

* **Línea Directa del Búfer Líquido:** Las solicitudes de crédito o salidas de capital se originan directamente desde el búfer de stablecoins de la tesorería sin comprometer el colateral principal de los activos exógenos estables en Morpho/Lombard/Lido.
* **Resguardo del Invariante de Solvencia:** Si una operación de rescate o préstamo redujera la liquidez de caja, los contratos inteligentes fuerzan validaciones strictly de solvencia on-chain. Ninguna salida de fondos puede superar el límite de caja disponible ni violar la directiva incondicional post-transacción (`Ratio_post_tx >= Ratio_pre_tx`), evitando déficits o acuñaciones inflacionarias descontroladas.

---

## 🔐 4. Bóveda de Vesting de Génesis para Fundadores (`GenesisVestingVault.sol`)

Para remunerar al desarrollador/fundador sin requerir un minteo inflacionario ni violar la Directiva 2:

1. **Asignación en Génesis:** Se deposita un paquete inicial en el contrato inmutable `GenesisVestingVault.sol` con un calendario de liberación de 1 año de *cliff* y 36 meses de liberación lineal.
2. **Backing-on-Claim:** Los tokens no circulantes no computan como pasivo en el PoR. Al momento de ejecutar `claimVestedTokens()`, la EVM valida que el acumulado de comisiones de la Tesorería mantenga el `PoR_post_claim >= 100.00%` antes de permitir la emisión de los tokens liberados.

---

## 🔒 5. Bóvedas de Ecosistema Exclusivas en Token ALPHA

Las carteras del ecosistema para Infraestructura (OpEx) y Rendimiento Comunitario no acumulan stablecoins ni activos heterogéneos:

1. **Moneda Única (ALPHA):** Si una comisión ingresa en USDC u otro token, `RealYieldRouter.sol` efectúa una compra en mercado (DEX) del token ALPHA.
2. **Auto-Staking:** El token ALPHA resultante se deposita inmediatamente en `GovernanceStaking.sol` asignado a las bóvedas segregadas `ProtocolOpExVault` y `CommunityYieldVault`.

---

## 🔀 6. Opciones de Cobro de Yield para Usuarios (`RealYieldRouter.sol`)

Los usuarios stakers de stALPHA pueden configurar su preferencia de cobro de dividendos en cualquier momento:

* **Opción A (`OPTION_A_STABLECOIN`):** Cobro directo de dividendos en USDC líquido en su billetera.
* **Opción B (`OPTION_B_RESERVE_ASSET`):** Auto-compounding mediante la conversión de dividendos a activos de reserva WBTC / WETH.

---

## 🛡️ 7. Mecanismo de Emisión Anti-Dilución: Dynamic Slippage Fee (NAV Protection)

Para proteger la masa patrimonial del protocolo y evitar arbitrajes por volumen o ataques de tipo sándwich, la emisión de nuevos tokens ALPHA a valor NAV utiliza un algoritmo de Slippage Dinámico por Tamaño de Depósito integrado en la ejecución de la EVM.

1. **Lógica Financiera y Curva de Impacto:**
   * *Depósitos Minoristas (Bajo Impacto):* Pagan únicamente la comisión base del 0.50% (50 bps).
   * *Depósitos Masivos / Ballenas (Alto Impacto):* La comisión escala automáticamente en función del tamaño del depósito relativo a los Activos Exógenos de Reserva actuales (A0).

2. **Formulación Matemática (Complejidad O(1)):**
   DynamicFeeBps = min(FeeBase + ((MontoUSD * 10000 / (A0 + MontoUSD)) * Gamma / 10000), CapMax)
   * FeeBase = 50 bps (0.50%)
   * MontoUSD = Monto bruto del depósito en USD
   * A0 = Reserva Exógena Actual (USDC + WBTC + WETH)
   * Gamma = 500 bps (5.00%)
   * CapMax = 500 bps (5.00%)

3. **Accreción Automática de NAV (Flywheel Benefit):**
   El 100% del sobreprecio recaudado por depósitos de alto impacto se inyecta directamente como Real Yield de Tesorería (50% a Bóvedas de Ecosistema / 50% a Stakers).

---

## 📊 8. Matriz Completa de Comisiones On-Chain (`ProtocolTokenomicsEngine.sol`)

* **Depósito en Tesorería (`TreasuryManager.sol`):** Dinámico (0.50% a 5.00%) -> Reparto: 50% Reservas / 50% Community Yield.
* **Rescate / Redeem (`TreasuryManager.sol`):** 1.00% fijo -> Reparto: 50% Reservas / 50% Community Yield.
* **Entrada a Staking (`GovernanceStaking.sol`):** 1.00% -> Reparto: 0.50% Quema Deflacionaria Permanente, 0.50% Community Yield.
* **Originación Préstamo P2P (`P2PLendingMarket.sol`):** 0.50% -> Reparto: 50% Reservas / 50% Community Yield.

---

## 📜 9. Escala de Descuentos para Bonos Vestados, Tiers VIP y Ragequit

Los bonos con descuento se mintean como NFTs de Posición (`VaultPositionNFT.sol`):

* **Bloqueo 1 Año:** Descuento Base 5.00% | Bonus VIP +1.00% (>= 5k stALPHA) | Descuento Máximo Cap 50.00% | Penalización Ragequit 15.00% + Quema 100% Unvested.
* **Bloqueo 2 Años:** Descuento Base 10.00% | Bonus VIP +2.00% (>= 10k stALPHA) | Descuento Máximo Cap 50.00% | Penalización Ragequit 15.00% + Quema 100% Unvested.
* **Bloqueo 3 Años:** Descuento Base 15.00% | Bonus VIP +3.00% (>= 20k stALPHA) | Descuento Máximo Cap 50.00% | Penalización Ragequit 15.00% + Quema 100% Unvested.
* **Bloqueo 4 Años:** Descuento Base 20.00% | Bonus VIP +3.00% (>= 20k stALPHA) | Descuento Máximo Cap 50.00% | Penalización Ragequit 15.00% + Quema 100% Unvested.

---

## 🤝 10. Parámetros de Préstamos P2P y Búfer de Tesorería (`P2PLendingMarket.sol`)

* **LTV Máximo:** 70.00% para Position NFTs (ERC-721), 50.00% para token ALPHA líquido (valorado dinámicamente vía `getNAVPerShare()`).
* **Liquidadibilidad Min Health Factor:** 115.00% (`minHealthFactorBps = 11500`).
* **Línea Directa de Tesorería (20.0% Máx. Cap):** Origen de fondos desde la línea de crédito autorizada del 20.0% de las Reservas Exógenas. El capital no solicitado permanece colocado en Morpho Blue al 6.45% APY hasta su desembolso.
* **Custodia en Escrow:** NFTs de posición retenidos en el mercado P2P como garantía hasta el pago total del principal + intereses (8.00% APR Tasa Variable Real + 10.0% Spread de Margen).

---

## ⚡ 11. Gobernanza Descentralizada, Timelock y Circuit Breaker (`CircuitBreaker.sol`)

* **Gobernanza Timelock (Pure DeFi):** La administración del protocolo reside en `TimelockController.sol` con un retraso de ejecución de 72 horas para cualquier cambio de parámetros.
* **Comité de Emergencia (*Security Council*):** Un Multisig comunitario posee el rol de pausado en `CircuitBreaker.sol` únicamente para congelar operaciones ante obsolescencia de oráculos (`staleness > 86400s`) o desviaciones de precio > 10%, sin capacidad de transferir fondos.
* **Invariante PoR Garantizado:** Evaluado dinámicamente antes y después de cada transacción de depósito/rescate (`Ratio_post_tx >= Ratio_pre_tx`).

---

## 🛡️ 12. Proof of Reserves (PoR) e Invariante de Solvencia

El contrato `TreasuryManager.sol` calcula en todo momento la solvencia del protocolo combinando los activos custodiados con las obligaciones vigentes:

Activos Totales Exógenos USD = USDC Bóveda + Morpho Yield + WBTC/WETH + Préstamos P2P Activos

Pasivos Totales USD = (Circulante Neto ALPHA) * NAV + Obligaciones Bonos Vestados

Ratio PoR = (Activos Totales Exógenos USD / Pasivos Totales USD) * 100 >= 100.00%