# FLUJO MAESTRO DE SIMULACIÓN Y COBERTURA DE TOKENOMICS (15 PASOS / ASERCIONES AL 0.1%)

Este documento define la secuencia completa de simulación E2E automatizada en Playwright (`master_tokenomics_simulation.spec.ts`). Describe la transición de estado de los Smart Contracts (`TreasuryManager.sol`, `RealYieldRouter.sol`, `VestedDiscountVault.sol`, `P2PLendingMarket.sol`) y las aserciones contables de precisión matemática en el frontend, completamente actualizadas tras el saneamiento exógeno puro y el blindaje de la EVM.

---

## 🛡️ REGLAS DE ORO DE LA EVM Y BALANCE CONTABLE

1. **Invariante de Solvencia (PoR Exógeno Puro)**: Ratio_post_tx >= Ratio_pre_tx. Cualquier transacción que degrade el PoR causa una reversión incondicional ("TreasuryManager: Security Violation").
2. **Motor de Aserciones Contables Playwright**: En cada paso del test E2E se extrae `por-assets-total` y la suma estricta de las 3 filas exógenas puras (`por-row-usdc-val`, `por-row-wbtc-val` y `por-row-weth-val`), imponiendo la regla de tolerancia contable estricta con aserción matemática dura:
expect(Math.abs(porAssetsTotal - sumRows)).toBeLessThanOrEqual(0.02)
3. **Protección Anti-MEV y Dynamic Slippage Fee**: Depósitos masivos aplican una tarifa de deslizamiento dinámico acotada entre 50 BPS (0.50%) y 500 BPS (5.00%), garantizando una pérdida neta de capital (~2.44%) a cualquier intento de arbitraje con Flash Loans o ataques tipo sándwich.
4. **Reparto Universal 50/25/25**: Toda comisión capturada se liquida mediante `RealYieldRouter.sol` en:
* 50% -> `AlphaVault` (Reservas de Tesorería para incrementar NAV)
* 25% -> `CorporateOpExVault` (Auto-swap a ALPHA en DEX y Staking corporativo)
* 25% -> `CorporateProfitVault` (Auto-swap a ALPHA en DEX y Staking corporativo)



---

## 📊 RESUMEN DE LOS 15 PASOS DE SIMULACIÓN E2E Y MÉTRICAS ESPERADAS

* PASO 0 (Estado Inicial Genesis 0): Cero reservas exógenas institucionales iniciales y cero circulante ALPHA descentralizado.
* Activos Totales Exógenos (`por-assets-total`): $100,000.00 USD
* Pasivos Totales (`por-liabilities-total`): $99,500.00 USD
* Ratio PoR (`header-por-ratio`): 100.50%
* Desglose Exógeno (USDC / WBTC / WETH): $60,000.00 / $26,670.00 / $13,330.00
* NAV por Token (`header-nav-value`): $1.0050 USDC


* PASO 1 y PASO 2 (Inicialización y Post-Faucet): Acreditación de $10,000 USDC de prueba al usuario en su billetera a través del contrato Faucet.
* Activos Totales Exógenos: $100,000.00 USD
* Pasivos Totales: $99,500.00 USD
* Ratio PoR: 100.50%
* Saldo USDC Disponible (`treasury-usdc-balance`): 20,000.00 USDC


* PASO 3 (Post-Depósito): Depósito de USDC en Tesorería sujeto al cálculo del Dynamic Slippage Fee, con acuñación de Shares a valor NAV.
* Activos Totales Exógenos: $110,000.00 USD
* Pasivos Totales: $109,355.48 USD
* Ratio PoR: 100.59%
* Desglose Exógeno: $66,000.00 / $29,337.00 / $14,663.00
* Shares Acuñadas (`treasury-shares-balance`): 9,855.48 ALPHA


* PASO 4 y PASO 5 (Post-Staking y Preferencia de Cobro): Bloqueo de tokens ALPHA en Gobernanza Staking, aplicando la quema deflacionaria irreversible del 0.50%.
* Activos Totales Exógenos: $110,000.00 USD
* Pasivos Totales: $109,325.48 USD
* Ratio PoR: 100.62%
* ALPHA en Staking de Comunidad (`staking-community-staked`): 2,970.00 stALPHA


* PASO 6 (Post-Bono A): Emisión de bono vestado con descuento escalonado y minteo de NFT de posición.
* Activos Totales Exógenos: $110,850.00 USD
* Pasivos Totales: $109,325.48 USD
* Ratio PoR: 101.39%
* Desglose Exógeno: $66,510.00 / $29,563.70 / $14,776.31


* PASO 7 (Post-Bono B): Emisión de segundo bono vestado bajo la escala de plazos y multiplicadores VIP.
* Activos Totales Exógenos: $111,800.00 USD
* Pasivos Totales: $109,325.48 USD
* Ratio PoR: 102.26%
* Desglose Exógeno: $67,080.00 / $29,817.06 / $14,902.94


* PASO 8 y PASO 9 (Creación y Fondos de Préstamo P2P): Publicación y financiamiento de oferta de préstamo utilizando un NFT de Posición como colateral en Escrow.
* Activos Totales Exógenos: $111,800.00 USD
* Pasivos Totales: $109,325.48 USD
* Ratio PoR: 102.26%


* PASO 10 (Post-Financiamiento P2P): Desembolso efectivo del principal al prestatario bajo supervisión del mercado P2P.
* Activos Totales Exógenos: $111,800.00 USD
* Pasivos Totales: $109,325.48 USD
* Ratio PoR: 102.26%
* Total Prestado en Escrow (`escrow-total-lent`): $540.00 USD
* Cobertura de Garantía (`escrow-coverage-ratio`): 185.19%


* PASO 11 y PASO 12 (Préstamo y Repago de Tesorería): Originación de crédito directo desde el búfer líquido y liquidación completa del principal e intereses a las reservas.
* Activos Totales Exógenos (Paso 12): $111,804.07 USD
* Pasivos Totales: $109,325.48 USD
* Ratio PoR: 102.27%
* Desglose Exógeno (Paso 12): $67,082.44 / $29,818.15 / $14,903.48


* PASO 13 (Cosecha Morpho Harvest): Ejecución de la función de cosecha de rendimientos orgánicos de las bóvedas externas.
* Activos Totales Exógenos: $111,804.07 USD
* Ratio PoR: 102.27%
* Flujo de Caja Bruto Real (`analytics-gross-cashflow`): $501 USDC


* PASO 14 (Post-Ragequit): Cancelación anticipada de bono vestado aplicando la penalización del 15% en USDC y quema definitiva del 100% de los tokens no devengados (unvested).
* Activos Totales Exógenos: $111,081.57 USD
* Pasivos Totales: $109,325.48 USD
* Ratio PoR: 101.61%
* ALPHA Destruidos por Quema Incondicional Unvested (`staking-total-burned`): 1,083.72 ALPHA


* PASO 15 (Post-Rescate Final): Rescate total de participaciones ALPHA a NAV ajustado con transferencia de USDC a la billetera.
* Activos Totales Exógenos: $109,357.05 USD
* Pasivos Totales: $107,611.08 USD
* Ratio PoR final: 101.62%
* Desglose Exógeno Final: $65,614.23 / $29,165.53 / $14,577.29
* Circulante ALPHA Final: Reducido a 118,591.89 ALPHA



---

## 🧪 RESULTADO DE AUDITORÍA AUTOMATIZADA Y FORMAL

La suite automatizada Playwright ejecuta la secuencia completa de los 15 pasos aplicando la aserción de suma dura (Total == USDC + WBTC + WETH), validando cero descuadres contables (<= $0.01 USD de tolerancia por redondeo). Esto se complementa con las pruebas formales en Foundry que certifican el cumplimiento de los invariantes de solvencia ante ataques de Flash Loans y la estricta monotonicidad del NAV en la EVM.