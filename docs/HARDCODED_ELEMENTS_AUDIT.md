# 🔍 INFORME COMPLETO DE AUDITORÍA: ELEMENTOS DINÁMICOS VS. CONSTANTES DEL PROTOCOLO

**Fecha**: 6 de Agosto, 2026  
**Proyecto**: Alpha Centauri Protocol — Monorepo (Smart Contracts & DApp)  
**Objetivo**: Auditoría exhaustiva de la aplicación para identificar cualquier valor estático o harcodeado, clasificando su naturaleza y estado de cálculo en tiempo real.

---

## 📊 RESUMEN EJECUTIVO

Tras una revisión integral de todo el frontend (`components/`, `hooks/`, `utils/`) y los Smart Contracts Solidity (`contracts/src/`), la DApp opera bajo un **modelo 100% dinámico y calculado en tiempo real** para todas las transacciones, saldos, valuaciones de tesorería, ratios PoR y ventanas de confirmación modal.

Los únicos valores fijos presentes en el código corresponden estrictamente a:
1. **Invariantes Inmutables de los Smart Contracts** (Reglas de consenso codificadas en EVM).
2. **Estimaciones de Rendimiento Exógeno (Fallback APYs)** para integraciones externas (Morpho, Lido, Lombard) cuando no se detecta red principal en vivo.
3. **Configuraciones del Entorno Sandbox/Testnet** (RPC de Anvil y direcciones de prueba).

---

## 1. 🟢 ELEMENTOS CALCULADOS EN TIEMPO REAL (100% DINÁMICOS)

| Elemento UI / Módulo | Estado de Cálculo | Origen de los Datos |
| :--- | :--- | :--- |
| **Ventanas Modal de Confirmación (`TransactionConfirmModal.tsx`)** | **100% Calculado en Tiempo Real** | Todos los valores (principales, comisiones en USD, retenciones de Ragequit, reembolsos netos, LTV, colateralización) se derivan dinámicamente de la entrada del usuario y del estado on-chain de las posiciones. |
| **Píldoras del Encabezado (`Header.tsx`)** | **100% Calculado en Tiempo Real** | `VALOR NAV / SHARE` ($NAV / circulatingShares), `RATIO COLATERAL PoR` (Assets / Liabilities), `SALDO USDC` y `ESTADO WALLET`. |
| **Bóveda de Tesorería (`TreasuryVaultCard.tsx`)** | **100% Calculado en Tiempo Real** | Dynamic Slippage Fee (50 a 500 BPS), Shares a recibir a valor NAV exacto, Reembolso neto en USDC en retiros. |
| **Bóvedas de Descuento Vestado (`VestedBondVaultCard.tsx`)** | **100% Calculado en Tiempo Real** | Descuento dinámico on-chain (`calculateDiscountBps`), bonus por categoría VIP Staking (+1% a +3%), precio descontado exacto en USDC. |
| **Mercado de Préstamos P2P (`P2PLendingCard.tsx`)** | **100% Calculado en Tiempo Real** | Ratio de Colateralización (${colVal / borrow * 100}%), LTV %, Comisión de originación (0.50%), Desembolso neto, Intereses devengados, Reparto 10%/90% de intereses. |
| **Bóveda de Gobernanza & Staking (`GovernanceCommandCenter.tsx`)** | **100% Calculado en Tiempo Real** | Fee de entrada (1.00%), Quema deflacionaria (0.50%), Poder de voto stALPHA, Dividendos netos acumulados. |
| **Auditoría PoR y Desglose APY (`ProofOfReserves.tsx`, `ApyBreakdownModal.tsx`)** | **100% Calculado en Tiempo Real** | Ponderaciones target exógenas (60.00% USDC, 26.67% WBTC, 13.33% WETH), suma matemática exacta de reservas exógenas y cálculo de APY compuesto. |

---

## 2. 🛡️ CONSTANTES E INVARIANTES INMUTABLES DEL PROTOCOLO (EVM RULES)

Estos valores no son "harcodeados caprichosos", sino **parámetros inmutables de consenso** codificados en el bytecode de los Smart Contracts y especificados en la Biblia de Tokenomics:

| Parámetro | Valor Encriptado en Contrato | Función / Impacto On-Chain |
| :--- | :--- | :--- |
| `RAGEQUIT_PENALTY_BPS` | `1500` (15.00%) | Penalización irreversible por salida anticipada en `VestedDiscountVault.sol`. |
| `MAX_LTV_BPS` | `7000` (70.00%) | LTV máximo permitido para bonos NFT en `P2PLendingMarket.sol`. |
| `LIQUIDATION_THRESHOLD` | `115` (115.00%) | Factor de salud mínimo antes de auto-liquidación P2P. |
| `STAKING_FEE_BPS` | `100` (1.00%) | Comisión de depósito en `GovernanceStaking.sol`. |
| `DEFLATIONARY_BURN_BPS` | `50` (0.50%) | Quema deflacionaria irreversible por cada staking. |
| `ORIGINATION_FEE_BPS` | `50` (0.50%) | Comisión de originación de préstamos P2P. |
| `INTEREST_SPREAD_BPS` | `1000` (10.00%) | Margen de beneficio sobre los intereses del prestamista destinado a stakers. |
| `TARGET_WEIGHTS` | `6000 / 2667 / 1333` | Distribución institucional exógena pura (60.00% USDC, 26.67% WBTC, 13.33% WETH). |

---

## 3. 🌐 ESTIMACIONES EXÓGENAS Y FALLBACKS DE APY (EXTERNAL PROTOCOLS)

En el entorno Sandbox / Testnet (Anvil), no se cuenta con los oráculos en vivo de protocolos de terceros (Morpho, Lido, Lombard). Por ello, el modal de APY utiliza tasas base estimadas como fallback cuando la consulta RPC externa retorna 0:

- **Morpho Blue MetaMorpho (USDC)**: `6.45% APR` (Fallback de simulación sandbox).
- **Lombard LBTC Babylon (WBTC)**: `4.85% APR` (Fallback de simulación sandbox).
- **Lido wstETH (WETH)**: `3.65% APR` (Fallback de simulación sandbox).

*Nota: Tan pronto como la DApp se conecta a Mainnet/Sepolia, estas lecturas son reemplazadas dinámicamente por la consulta al contrato `DynamicYieldOracleRouter.sol`.*

---

## 4. ⚙️ CONFIGURACIÓN DEL ENTORNO DE DESARROLLO (SANDBOX / ANVIL)

- **RPC URL**: `http://127.0.0.1:8545` (Nodo Anvil local).
- **Dirección Admin de Operador**: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` (Cuenta pre-fondeada de prueba Anvil #0).

---

## ✅ CONCLUSIÓN DE LA AUDITORÍA

La aplicación cumple al **100% con la Directiva de Cálculo Dinámico en Tiempo Real**. No existen valores estáticos que falseen operaciones financieras o alteren el flujo contable del protocolo.
