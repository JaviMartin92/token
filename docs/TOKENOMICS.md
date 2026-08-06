# 📜 BIBLIA COMPLETA DE TOKENOMICS — ALPHA CENTAURI PROTOCOL

## 🛡️ 0. DIRECTIVAS INMUTABLES E INVARIANTES DEL PROTOCOLO

El Protocolo Alpha Centauri está gobernado por 3 Directivas Inmutables de Inmunidad Operativa, codificadas a nivel de bytecode en la EVM y no modificables por ninguna entidad:

### 1. Directiva de Invariante de Colateralización Incondicional

Ratio_post_tx >= Ratio_pre_tx

* Mecanismo On-Chain: Evaluado en TreasuryManager.sol en las funciones deposit() y redeem().
* Reversión Obligatoria: Si cualquier transacción provocara una caída en el porcentaje de reservas (por redondeo, desajuste de oráculo o arbitraje), la EVM la revierte de inmediato con el mensaje: "TreasuryManager: Security Violation - Transaction reduced collateralization ratio".

### 2. Prohibición Absoluta de Minteado Inflacionario Sin Respaldo

* Regla: Ninguna billetera corporativa (CorporateOpExVault, CorporateProfitVault, equipo o fundadores) puede recibir tokens ALPHA minteados sin ingreso patrimonial previo.
* Mecanismo: La acuñación solo existe cuando ingresa colateral real en USDC en la Tesorería. Las comisiones asignadas a las bóvedas corporativas (25% OpEx / 25% Profit) provienen exclusivamente de compras reales en el mercado DEX efectuadas por RealYieldRouter.sol.

### 3. Invariante Deflacionario Incondicional (Quema Permanente)

* Staking: El 50% de la comisión de entrada al pool de gobernanza (0.50% del total bloqueado) es destruido de forma irreversible mediante _burn.
* Ragequit: Al cancelar anticipadamente un bono vestado (VestedDiscountVault.sol), el 100% de los tokens ALPHA asociados en vesting son destruidos de forma irreversible, además de retener la penalización del 15% en USDC para las reservas.

---

## 🌟 Visión General y Filosofía de Real Yield

El Protocolo Alpha Centauri opera bajo un modelo estricto de Real Yield Respaldado por Activos Exógenos y Proof of Reserves (PoR) en Tiempo Real. Todos los tokens ALPHA emitidos cuentan con respaldo patrimonial verificable on-chain con un ratio de solvencia garantizado >= 100.00%.

---

## 🏛️ 1. Reparto Universal de Comisiones (Modelo 50 / 25 / 25)

Toda comisión generada por cualquier operativa de la plataforma (depósitos, rescates, compra de bonos vestados, penalizaciones por ragequit, originación e intereses de préstamos P2P) ingresa a través del contrato RealYieldRouter.sol y se distribuye estrictamente bajo la siguiente regla universal:

* 50.00%: Reservas Estratégicas (TreasuryManager.sol) -> Depósito directo en Tesorería (AlphaVault.sol) -> Incrementa el NAV por token y fortalece las reservas respaldadas por activos.
* 25.00%: Corporate OpEx Vault (CorporateOpExVault.sol) -> Auto-Swap en DEX a ALPHA y Staking -> Financia gastos operativos acumulando tokens ALPHA reales comprados en mercado.
* 25.00%: Corporate Profit Vault (CorporateProfitVault.sol) -> Auto-Swap en DEX a ALPHA y Staking -> Acumula beneficios corporativos exclusivamente en tokens ALPHA reales comprados en mercado.

---

## 🏦 2. Composición de Activos Exógenos Puros y Gestión de Liquidez

La Tesorería de TreasuryManager.sol mantiene una cartera de reservas exclusivamente exógena con las siguientes ponderaciones objetivo (Target Asset Allocation):

* 60.00%: USDC / Stablecoins -> Sub-Reserva orientada a rendimiento y liquidez: Bóvedas Morpho Blue (Rendimiento Real APY) + Búfer Líquido de Tesorería para originación de Préstamos P2P sobrecolateralizados.
* 26.67%: Wrapped Bitcoin (WBTC) -> Staking Lombard (LBTC) / Suministro Morpho valorado on-chain vía Oráculos Chainlink BTC/USD (OracleHub.sol).
* 13.33%: Wrapped Ethereum (WETH) -> Liquid Staking Lido (stETH) / Colateral Morpho valorado on-chain vía Oráculos Chainlink ETH/USD (OracleHub.sol).

Nota de Arquitectura y Saneamiento Contable: Los tokens $ALPHA stapeados en Gobernanza forman parte de la sub-reserva interna retenida respaldada 1:1 por USDC y nunca se contabilizan dentro de la tabla de activos exógenos para evitar doble contabilización patrimonial.

---

## 🔄 3. Mecanismo de Liquidez, Desembolso y Gestión de Insuficiencias

Para garantizar que el protocolo responda de manera impecable ante situaciones de tensión de liquidez (por ejemplo, cuando hay alta demanda de rescates o desembolsos de créditos y el pool líquido inmediato se contrae):

* Línea Directa del Búfer Líquido: Las solicitudes de crédito o salidas de capital se originan directamente desde el búfer de stablecoins de la tesorería sin comprometer el colateral principal de los activos exógenos estables en Morpho/Lombard/Lido.
* Resguardo del Invariante de Solvencia: Si una operación de rescate o préstamo redujera la liquidez de caja, los contratos inteligentes fuerzan validaciones estrictas de solvencia on-chain. Ninguna salida de fondos puede superar el límite de caja disponible ni violar la directiva incondicional post-transacción (`Ratio_post_tx >= Ratio_pre_tx`), evitando déficits o acuñaciones inflacionarias descontroladas.

---

## 🔒 4. Bóvedas Corporativas Exclusivas en Token ALPHA

Las carteras corporativas de OpEx y Beneficios no acumulan stablecoins ni activos heterogéneos:

1. Moneda Única (ALPHA): Si una comisión ingresa en USDC u otro token, el RealYieldRouter efectúa una compra en mercado (DEX) del token ALPHA.
2. Auto-Staking: El token ALPHA resultante se deposita inmediatamente en GovernanceStaking.sol asignado a las bóvedas segregadas CorporateOpExVault y CorporateProfitVault.

---

## 🔀 5. Opciones de Cobro de Yield para Usuarios (RealYieldRouter.sol)

Los usuarios stakers de stALPHA pueden configurar su preferencia de cobro de dividendos en cualquier momento:

* Opción A (OPTION_A_STABLECOIN): Cobro directo de dividendos en USDC líquido en su billetera.
* Opción B (OPTION_B_RESERVE_ASSET): Auto-compounding mediante la conversión de dividendos a activos de reserva WBTC / WETH.

---

## 🛡️ 6. Mecanismo de Emisión Anti-Dilución: Dynamic Slippage Fee (NAV Protection)

Para proteger la masa patrimonial del protocolo y evitar arbitrajes por volumen o ataques de tipo sándwich, la emisión de nuevos tokens ALPHA a valor NAV utiliza un algoritmo de Slippage Dinámico por Tamaño de Depósito integrado en la ejecución de la EVM.

1. Lógica Financiera y Curva de Impacto:

* Depósitos Minoristas (Bajo Impacto): Pagan únicamente la comisión base del 0.50% (50 bps).
* Depósitos Masivos / Ballenas (Alto Impacto): La comisión escala automáticamente en función del tamaño del depósito relativo a los Activos Exógenos de Reserva actuales (A0).

2. Formulación Matemática (Complejidad O(1)):
DynamicFeeBps = min(FeeBase + ((MontoUSD * 10000 / (A0 + MontoUSD)) * Gamma / 10000), CapMax)
Donde:

* FeeBase = 50 bps (0.50%)
* MontoUSD = Monto bruto del depósito en USD
* A0 = Reserva Exógena Actual (USDC + WBTC + WETH)
* Gamma = 500 bps (5.00%)
* CapMax = 500 bps (5.00%)

3. Escenarios de Ejecución:

* Retail: Depósito $1,000 USD | Reserva $100,000 USD | Impacto 0.99% | Comisión 54 bps (0.54%)
* Mid-Tier: Depósito $10,000 USD | Reserva $100,000 USD | Impacto 9.09% | Comisión 95 bps (0.95%)
* Whale: Depósito $100,000 USD | Reserva $100,000 USD | Impacto 50.00% | Comisión 300 bps (3.00%)
* Institutional: Depósito $500,000 USD | Reserva $100,000 USD | Impacto 83.33% | Comisión 466 bps (4.66%) [Cap 5.00%]

4. Accreción Automática de NAV (Flywheel Benefit):
El 100% del sobreprecio recaudado por depósitos de alto impacto se inyecta directamente como Real Yield de Tesorería:

* 50% de la Comisión: Se canaliza a las Bóvedas Corporativas (OpEx / Profit).
* 50% de la Comisión: Se distribuye como Real Yield (USDC) a los stakers de ALPHA.
Efecto Red: Cada gran entrada de capital incrementa de forma instantánea el valor patrimonial (NAV) de todos los tokens en circulación, garantizando un suelo de rescate ascendente para la comunidad y bloqueando de forma absoluta cualquier intento de arbitraje o ataques MEV / Flash Loans.

---

## 📊 7. Matriz Completa de Comisiones On-Chain (ProtocolTokenomicsEngine.sol)

* Depósito en Tesorería (TreasuryManager.sol): Dinámico (0.50% a 5.00%) (50 a 500 BPS) -> Reparto: 50% Reservas / 25% OpEx / 25% Profit.
* Rescate / Redeem (TreasuryManager.sol): 1.00% (100 BPS) -> Reparto: 50% Reservas / 25% OpEx / 25% Profit.
* Entrada a Staking (GovernanceStaking.sol): 1.00% (100 BPS) -> Reparto: 0.50% Quema Deflacionaria Permanente, 0.25% OpEx, 0.25% Profit.
* Acuñación de Bonos (VestedDiscountVault.sol): 1.50% Mint Fee + 1.50% Referidos -> Reparto: 50% Reservas / 25% OpEx / 25% Profit.
* Ragequit de Bonos (VestedDiscountVault.sol): 15.00% Penalización USDC -> Reparto: 100% de la penalización enrutada 50/25/25 + Quema 100% Unvested.
* Originación Préstamo P2P (P2PLendingMarket.sol): 0.50% (50 BPS) -> Reparto: 50% Reservas / 25% OpEx / 25% Profit.
* Spread Interés P2P (P2PLendingMarket.sol): 10.00% del Interés Generado -> Reparto: 50% Reservas / 25% OpEx / 25% Profit.

---

## 📜 8. Escala de Descuentos para Bonos Vestados y Tiers VIP

Los bonos con descuento se mintean como NFTs de Posición (VaultPositionNFT.sol):

* Bloqueo 1 Año: Descuento Base 5.00% | Bonus VIP +1.00% (>= 5k stALPHA) | Descuento Máximo Cap 50.00% | Penalización Ragequit 15.00% + Quema 100% Unvested.
* Bloqueo 2 Años: Descuento Base 10.00% | Bonus VIP +2.00% (>= 10k stALPHA) | Descuento Máximo Cap 50.00% | Penalización Ragequit 15.00% + Quema 100% Unvested.
* Bloqueo 3 Años: Descuento Base 15.00% | Bonus VIP +3.00% (>= 20k stALPHA) | Descuento Máximo Cap 50.00% | Penalización Ragequit 15.00% + Quema 100% Unvested.
* Bloqueo 4 Años: Descuento Base 20.00% | Bonus VIP +3.00% (>= 20k stALPHA) | Descuento Máximo Cap 50.00% | Penalización Ragequit 15.00% + Quema 100% Unvested.

---

## 🤝 9. Parámetros de Préstamos P2P y Búfer de Tesorería (P2PLendingMarket.sol)

* LTV Máximo: 70.00% para Activos Estándar / Position NFTs, 50.00% para token ALPHA líquido.
* Liquidadibilidad Min Health Factor: 115.00% (minHealthFactorBps = 11500).
* Línea Directa de Tesorería: Origen de fondos desde el Búfer Líquido de Tesorería.
* Custodia en Escrow: NFTs de posición retenidos en el mercado P2P como garantía hasta el pago total del principal + intereses.

---

## ⚡ 10. Control de Seguridad y Circuit Breaker (CircuitBreaker.sol)

* Pausa de Emergencia: Congelación inmediata del protocolo ante obsolescencia de oráculos (staleness > 86400s) o anomalías de volatilidad.
* Invariante PoR Garantizado: Evaluado dinámicamente antes y después de cada transacción de depósito/rescate (postRatioBps >= preRatioBps).

---

## 🛡️ 11. Proof of Reserves (PoR) e Invariante de Solvencia

El contrato TreasuryManager.sol calcula en todo momento la solvencia del protocolo combinando los activos custodiados con las obligaciones vigentes:

Activos Totales Exógenos USD = USDC Bóveda + Morpho Yield + WBTC/WETH + Préstamos P2P Activos

Pasivos Totales USD = (Circulante Neto ALPHA) * NAV + Obligaciones Bonos Vestados

Ratio PoR = (Activos Totales Exógenos USD / Pasivos Totales USD) * 100 >= 100.00%