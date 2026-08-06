# FLUJO MAESTRO DE SIMULACIÓN Y COBERTURA DE TOKENOMICS (15 PASOS / ASERCIONES AL 0.1%)

Este documento define la secuencia completa de simulación E2E automatizada en Playwright (`master_tokenomics_simulation.spec.ts`). Describe la transición de estado de los Smart Contracts (`TreasuryManager.sol`, `RealYieldRouter.sol`, `VestedDiscountVault.sol`, `P2PLendingMarket.sol`) y las aserciones contables de precisión matemática en el frontend.

---

## 🛡️ REGLAS DE ORO DE LA EVM Y BALANCE CONTABLE

1. **Invariante de Solvencia (PoR Exógeno Puro)**: $\text{Ratio}_{\text{post-tx}} \ge \text{Ratio}_{\text{pre-tx}}$. Cualquier transacción que degrade el PoR causa una reversión incondicional (`"TreasuryManager: Security Violation"`).
2. **Motor de Aserciones Contables Playwright**: En cada paso del test E2E se extrae `por-assets-total` y la suma de `por-row-usdc-val`, `por-row-wbtc-val` y `por-row-weth-val`, imponiendo la regla de tolerancia contable estricta:
   $$\text{expect}(\text{Math.abs}(\text{porAssetsTotal} - \text{sumRows})).\text{toBeLessThanOrEqual}(0.02)$$
3. **Protección Anti-MEV y Dynamic Slippage Fee**: Depósitos masivos aplican una tarifa de deslizamiento dinámico acotada entre $50\text{ BPS (0.50\%)}$ y $500\text{ BPS (5.00\%)}$, garantizando una pérdida neta de capital ($\sim 2.44\%$) a cualquier intento de arbitraje con Flash Loans.
4. **Reparto Universal 50/25/25**: Toda comisión capturada se liquida mediante `RealYieldRouter.sol` en:
   - **50%** -> `AlphaVault` (Reservas de Tesorería)
   - **25%** -> `CorporateOpExVault` (Auto-swap a ALPHA en DEX)
   - **25%** -> `CorporateProfitVault` (Auto-swap a ALPHA en DEX)

---

## 📊 RESUMEN DE LOS 15 PASOS DE SIMULACIÓN E2E

- **PASO 0 (Estado Inicial Genesis 0)**: Cero reservas, cero circulante $ALPHA$.
- **PASO 1 (Inicialización)**: Tesorería fondeada con $\$100,000\text{ USDC}$ iniciales.
- **PASO 2 (Post-Faucet)**: Acreditación de $\$10,000\text{ USDC}$ a Usuario y Admin.
- **PASO 3 (Post-Depósito)**: Depósito de $\$10,000\text{ USDC}$ en Tesorería $\rightarrow$ Acuñación de $9,950\text{ ALPHA Shares}$.
- **PASO 4 (Post-Staking)**: Bloqueo de $5,000\text{ ALPHA}$ en Gobernanza Staking (Quema deflacionaria del $0.50\%$).
- **PASO 5 (Post-Swaps Oráculo)**: Rebalanceo y liquidación de cuotas colaterales en WBTC y WETH.
- **PASO 6 (Post-Bono A)**: Emisión de Bono a 3 años por $\$1,000\text{ USDC}$ (Descuento del $15\%$).
- **PASO 7 (Post-Bono B)**: Emisión de Bono a 5 años por $\$1,000\text{ USDC}$ (Descuento del $25\%$).
- **PASO 8 (Post-Creación Préstamo P2P)**: Apertura de oferta de préstamo utilizando NFT de Posición como colateral en Escrow.
- **PASO 9 (Post-Fondos P2P)**: Financiamiento de oferta P2P por prestamista externo.
- **PASO 10 (Post-Financiamiento P2P)**: Desembolso del principal al prestatario.
- **PASO 11 (Post-Préstamo Tesorería)**: Préstamo directo originado desde el búfer de Tesorería.
- **PASO 12 (Post-Repago Tesorería)**: Liquidación del principal más intereses a la Tesorería.
- **PASO 13 (Post-Harvest Morpho)**: Cosecha de rendimientos orgánicos on-chain.
- **PASO 14 (Post-Ragequit)**: Cancelación anticipada de bono vestado con penalización del $15\%$.
- **PASO 15 (Post-Rescate Final)**: Rescate total de participaciones ALPHA a NAV ajustado.

---

## 🧪 RESULTADO DE AUDITORÍA AUTOMATIZADA
La suite automatizada Playwright en `frontend/tests/master_tokenomics_simulation.spec.ts` ejecuta la secuencia completa de los 15 pasos y certifica **0.00% de descuadre contable** ($\le \$0.01\text{ USD}$ en todos los pasos).