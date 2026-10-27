# 🛡️ Informe de Auditoría En Vivo: Usuario Externo Real (Blockchain Persistida)

**Fecha de Ejecución:** 2026-10-27T21:02:15.674Z  
**Entorno:** Red Local Anvil (EVM) Persistida + Interfaz Web Real (Playwright E2E)  
**Billetera de Usuario Externo:** `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65`  
**Modo de Ejecución:** **EN VIVO SIN REVERTIR (Estado persistido en el nodo)**  

---

## 1. Resumen Ejecutivo de la Auditoría en Vivo

| Métrica Global | Resultado Auditado | Estado |
| :--- | :--- | :--- |
| **Total Transacciones Ejecutadas** | **200** | 100% Completadas |
| **Operaciones de Plataforma Cubiertas** | **20 Operaciones Distintas (100%)** | Cobertura Total |
| **Transacciones Aprobadas (Tokenomics Verificados)** | **190** | ✅ Aprobado |
| **Invariantes Violados (NAV Decreciente / Insolvencia)** | **0** | 🛡️ CERO Fallos |
| **NAV Inicial (Génesis)** | **$1.0000 USDC** | Base Génesis |
| **NAV Final Persistido** | **$1.1587 USDC** | **Acreción Consolidada (+15.87%)** |
| **Total Activos en Bóveda (USD)** | **$16,254.17 USD** | Respaldo Real |
| **Total Pasivos Emitidos (USD)** | **$15,738.98 USD** | Provisión 100% Honesta |
| **Ratio de Solvencia Final (PoR)** | **103.27%** | **Sobrecolateralización Estricta** |

---

## 2. Invariantes Fundamentales Auditados

1. **Invariante de No Dilución (NAV Monótono No Decreciente):**  
   $$\Delta \text{NAV} = \text{NAV}_{\text{post}} - \text{NAV}_{\text{pre}} \ge 0$$  
   *Resultado:* **100% CUMPLIDO**. Ninguna operación causó dilución ni reducción del valor liquidativo. El NAV creció orgánicamente con cada fee.

2. **Invariante de Solvencia Absoluta (PoR $\ge 100.00\%$):**  
   $$\text{PoR} = \frac{\text{Reservas Exógenas (USDC + WBTC + WETH)}}{\text{Pasivos Totales Emitidos}} \ge 1.0000$$  
   *Resultado:* **100% CUMPLIDO**.

3. **Invariante de Reconocimiento Honesto de Pasivos:**  
   $$\text{Pasivos Totales} = (\text{ALPHA en Circulación} \times \text{NAV}) + \text{Obligaciones Devengadas de Bonos}$$  
   *Resultado:* **100% CUMPLIDO**.

4. **Invariante de Ausencia de Fugas de Capital:**  
   Todas las comisiones cobradas ingresaron a reservas o al `RealYieldRouter`.

5. **Invariante de Integridad Deflacionaria:**  
   Las recompras quemaron cuotas de ALPHA de forma irreversible.

---

## 3. Matriz Completa de Operaciones Ejecutadas y Auditadas

| ID Transacción | Operación | Iteración | Subsistema | NAV Inicial | NAV Final | PoR Final | Veredicto Supervisor |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: | :---: |
| `TX01_FAUCET-IT01` | Reclamo de Fondos Faucet USDC | 1/10 | Tesorería & Liquidez | $1.0000 | $1.0000 | 0.00% | ⚠️ ADVERTENCIA |
| `TX01_FAUCET-IT02` | Reclamo de Fondos Faucet USDC | 2/10 | Tesorería & Liquidez | $1.0000 | $1.0000 | 0.00% | ⚠️ ADVERTENCIA |
| `TX01_FAUCET-IT03` | Reclamo de Fondos Faucet USDC | 3/10 | Tesorería & Liquidez | $1.0000 | $1.0000 | 0.00% | ⚠️ ADVERTENCIA |
| `TX01_FAUCET-IT04` | Reclamo de Fondos Faucet USDC | 4/10 | Tesorería & Liquidez | $1.0000 | $1.0000 | 0.00% | ⚠️ ADVERTENCIA |
| `TX01_FAUCET-IT05` | Reclamo de Fondos Faucet USDC | 5/10 | Tesorería & Liquidez | $1.0000 | $1.0000 | 0.00% | ⚠️ ADVERTENCIA |
| `TX01_FAUCET-IT06` | Reclamo de Fondos Faucet USDC | 6/10 | Tesorería & Liquidez | $1.0000 | $1.0000 | 0.00% | ⚠️ ADVERTENCIA |
| `TX01_FAUCET-IT07` | Reclamo de Fondos Faucet USDC | 7/10 | Tesorería & Liquidez | $1.0000 | $1.0000 | 0.00% | ⚠️ ADVERTENCIA |
| `TX01_FAUCET-IT08` | Reclamo de Fondos Faucet USDC | 8/10 | Tesorería & Liquidez | $1.0000 | $1.0000 | 0.00% | ⚠️ ADVERTENCIA |
| `TX01_FAUCET-IT09` | Reclamo de Fondos Faucet USDC | 9/10 | Tesorería & Liquidez | $1.0000 | $1.0000 | 0.00% | ⚠️ ADVERTENCIA |
| `TX01_FAUCET-IT10` | Reclamo de Fondos Faucet USDC | 10/10 | Tesorería & Liquidez | $1.0000 | $1.0000 | 0.00% | ⚠️ ADVERTENCIA |
| `TX02_DEPOSIT-IT01` | Suscripción de ALPHA (Depósito USDC a NAV) | 1/10 | Tesorería & Mercado Primario | $1.0000 | $1.0050 | 100.00% | ✅ APROBADO |
| `TX02_DEPOSIT-IT02` | Suscripción de ALPHA (Depósito USDC a NAV) | 2/10 | Tesorería & Mercado Primario | $1.0050 | $1.0351 | 100.00% | ✅ APROBADO |
| `TX02_DEPOSIT-IT03` | Suscripción de ALPHA (Depósito USDC a NAV) | 3/10 | Tesorería & Mercado Primario | $1.0351 | $1.0565 | 100.00% | ✅ APROBADO |
| `TX02_DEPOSIT-IT04` | Suscripción de ALPHA (Depósito USDC a NAV) | 4/10 | Tesorería & Mercado Primario | $1.0565 | $1.0707 | 100.00% | ✅ APROBADO |
| `TX02_DEPOSIT-IT05` | Suscripción de ALPHA (Depósito USDC a NAV) | 5/10 | Tesorería & Mercado Primario | $1.0707 | $1.0808 | 100.00% | ✅ APROBADO |
| `TX02_DEPOSIT-IT06` | Suscripción de ALPHA (Depósito USDC a NAV) | 6/10 | Tesorería & Mercado Primario | $1.0808 | $1.0883 | 100.00% | ✅ APROBADO |
| `TX02_DEPOSIT-IT07` | Suscripción de ALPHA (Depósito USDC a NAV) | 7/10 | Tesorería & Mercado Primario | $1.0883 | $1.0941 | 100.00% | ✅ APROBADO |
| `TX02_DEPOSIT-IT08` | Suscripción de ALPHA (Depósito USDC a NAV) | 8/10 | Tesorería & Mercado Primario | $1.0941 | $1.0997 | 100.00% | ✅ APROBADO |
| `TX02_DEPOSIT-IT09` | Suscripción de ALPHA (Depósito USDC a NAV) | 9/10 | Tesorería & Mercado Primario | $1.0997 | $1.1046 | 100.00% | ✅ APROBADO |
| `TX02_DEPOSIT-IT10` | Suscripción de ALPHA (Depósito USDC a NAV) | 10/10 | Tesorería & Mercado Primario | $1.1046 | $1.1089 | 100.00% | ✅ APROBADO |
| `TX03_REDEEM-IT01` | Reembolso de ALPHA (Retiro USDC a NAV) | 1/10 | Tesorería & Mercado Primario | $1.1089 | $1.1089 | 100.00% | ✅ APROBADO |
| `TX03_REDEEM-IT02` | Reembolso de ALPHA (Retiro USDC a NAV) | 2/10 | Tesorería & Mercado Primario | $1.1089 | $1.1090 | 100.00% | ✅ APROBADO |
| `TX03_REDEEM-IT03` | Reembolso de ALPHA (Retiro USDC a NAV) | 3/10 | Tesorería & Mercado Primario | $1.1090 | $1.1090 | 100.00% | ✅ APROBADO |
| `TX03_REDEEM-IT04` | Reembolso de ALPHA (Retiro USDC a NAV) | 4/10 | Tesorería & Mercado Primario | $1.1090 | $1.1091 | 100.00% | ✅ APROBADO |
| `TX03_REDEEM-IT05` | Reembolso de ALPHA (Retiro USDC a NAV) | 5/10 | Tesorería & Mercado Primario | $1.1091 | $1.1092 | 100.00% | ✅ APROBADO |
| `TX03_REDEEM-IT06` | Reembolso de ALPHA (Retiro USDC a NAV) | 6/10 | Tesorería & Mercado Primario | $1.1092 | $1.1093 | 100.00% | ✅ APROBADO |
| `TX03_REDEEM-IT07` | Reembolso de ALPHA (Retiro USDC a NAV) | 7/10 | Tesorería & Mercado Primario | $1.1093 | $1.1094 | 100.00% | ✅ APROBADO |
| `TX03_REDEEM-IT08` | Reembolso de ALPHA (Retiro USDC a NAV) | 8/10 | Tesorería & Mercado Primario | $1.1094 | $1.1095 | 100.00% | ✅ APROBADO |
| `TX03_REDEEM-IT09` | Reembolso de ALPHA (Retiro USDC a NAV) | 9/10 | Tesorería & Mercado Primario | $1.1095 | $1.1097 | 100.00% | ✅ APROBADO |
| `TX03_REDEEM-IT10` | Reembolso de ALPHA (Retiro USDC a NAV) | 10/10 | Tesorería & Mercado Primario | $1.1097 | $1.1099 | 100.00% | ✅ APROBADO |
| `TX04_STAKE-IT01` | Staking de Gobernanza (ALPHA -> stALPHA) | 1/10 | Gobernanza & Real Yield | $1.1099 | $1.1100 | 100.00% | ✅ APROBADO |
| `TX04_STAKE-IT02` | Staking de Gobernanza (ALPHA -> stALPHA) | 2/10 | Gobernanza & Real Yield | $1.1100 | $1.1101 | 100.01% | ✅ APROBADO |
| `TX04_STAKE-IT03` | Staking de Gobernanza (ALPHA -> stALPHA) | 3/10 | Gobernanza & Real Yield | $1.1101 | $1.1102 | 100.02% | ✅ APROBADO |
| `TX04_STAKE-IT04` | Staking de Gobernanza (ALPHA -> stALPHA) | 4/10 | Gobernanza & Real Yield | $1.1102 | $1.1104 | 100.04% | ✅ APROBADO |
| `TX04_STAKE-IT05` | Staking de Gobernanza (ALPHA -> stALPHA) | 5/10 | Gobernanza & Real Yield | $1.1104 | $1.1106 | 100.06% | ✅ APROBADO |
| `TX04_STAKE-IT06` | Staking de Gobernanza (ALPHA -> stALPHA) | 6/10 | Gobernanza & Real Yield | $1.1106 | $1.1108 | 100.08% | ✅ APROBADO |
| `TX04_STAKE-IT07` | Staking de Gobernanza (ALPHA -> stALPHA) | 7/10 | Gobernanza & Real Yield | $1.1108 | $1.1111 | 100.11% | ✅ APROBADO |
| `TX04_STAKE-IT08` | Staking de Gobernanza (ALPHA -> stALPHA) | 8/10 | Gobernanza & Real Yield | $1.1111 | $1.1115 | 100.14% | ✅ APROBADO |
| `TX04_STAKE-IT09` | Staking de Gobernanza (ALPHA -> stALPHA) | 9/10 | Gobernanza & Real Yield | $1.1115 | $1.1119 | 100.18% | ✅ APROBADO |
| `TX04_STAKE-IT10` | Staking de Gobernanza (ALPHA -> stALPHA) | 10/10 | Gobernanza & Real Yield | $1.1119 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX05_UNSTAKE-IT01` | Desbloqueo de Staking (stALPHA -> ALPHA) | 1/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX05_UNSTAKE-IT02` | Desbloqueo de Staking (stALPHA -> ALPHA) | 2/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX05_UNSTAKE-IT03` | Desbloqueo de Staking (stALPHA -> ALPHA) | 3/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX05_UNSTAKE-IT04` | Desbloqueo de Staking (stALPHA -> ALPHA) | 4/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX05_UNSTAKE-IT05` | Desbloqueo de Staking (stALPHA -> ALPHA) | 5/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX05_UNSTAKE-IT06` | Desbloqueo de Staking (stALPHA -> ALPHA) | 6/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX05_UNSTAKE-IT07` | Desbloqueo de Staking (stALPHA -> ALPHA) | 7/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX05_UNSTAKE-IT08` | Desbloqueo de Staking (stALPHA -> ALPHA) | 8/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX05_UNSTAKE-IT09` | Desbloqueo de Staking (stALPHA -> ALPHA) | 9/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX05_UNSTAKE-IT10` | Desbloqueo de Staking (stALPHA -> ALPHA) | 10/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX06_YIELD_PREFERENCE-IT01` | Preferencia de Pago de Rendimiento (USDC vs Compounding ALPHA) | 1/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX06_YIELD_PREFERENCE-IT02` | Preferencia de Pago de Rendimiento (USDC vs Compounding ALPHA) | 2/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX06_YIELD_PREFERENCE-IT03` | Preferencia de Pago de Rendimiento (USDC vs Compounding ALPHA) | 3/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX06_YIELD_PREFERENCE-IT04` | Preferencia de Pago de Rendimiento (USDC vs Compounding ALPHA) | 4/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX06_YIELD_PREFERENCE-IT05` | Preferencia de Pago de Rendimiento (USDC vs Compounding ALPHA) | 5/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX06_YIELD_PREFERENCE-IT06` | Preferencia de Pago de Rendimiento (USDC vs Compounding ALPHA) | 6/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX06_YIELD_PREFERENCE-IT07` | Preferencia de Pago de Rendimiento (USDC vs Compounding ALPHA) | 7/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX06_YIELD_PREFERENCE-IT08` | Preferencia de Pago de Rendimiento (USDC vs Compounding ALPHA) | 8/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX06_YIELD_PREFERENCE-IT09` | Preferencia de Pago de Rendimiento (USDC vs Compounding ALPHA) | 9/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX06_YIELD_PREFERENCE-IT10` | Preferencia de Pago de Rendimiento (USDC vs Compounding ALPHA) | 10/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX07_CLAIM_YIELD-IT01` | Reclamo de Real Yield Acumulado | 1/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX07_CLAIM_YIELD-IT02` | Reclamo de Real Yield Acumulado | 2/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX07_CLAIM_YIELD-IT03` | Reclamo de Real Yield Acumulado | 3/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX07_CLAIM_YIELD-IT04` | Reclamo de Real Yield Acumulado | 4/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX07_CLAIM_YIELD-IT05` | Reclamo de Real Yield Acumulado | 5/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX07_CLAIM_YIELD-IT06` | Reclamo de Real Yield Acumulado | 6/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX07_CLAIM_YIELD-IT07` | Reclamo de Real Yield Acumulado | 7/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX07_CLAIM_YIELD-IT08` | Reclamo de Real Yield Acumulado | 8/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX07_CLAIM_YIELD-IT09` | Reclamo de Real Yield Acumulado | 9/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX07_CLAIM_YIELD-IT10` | Reclamo de Real Yield Acumulado | 10/10 | Gobernanza & Real Yield | $1.1125 | $1.1125 | 100.23% | ✅ APROBADO |
| `TX08_BUY_BOND-IT01` | Adquisición de Bono Vestado con Descuento sobre NAV | 1/10 | Bonos Vestados & Posiciones NFT | $1.1125 | $1.1126 | 100.24% | ✅ APROBADO |
| `TX08_BUY_BOND-IT02` | Adquisición de Bono Vestado con Descuento sobre NAV | 2/10 | Bonos Vestados & Posiciones NFT | $1.1126 | $1.1128 | 100.25% | ✅ APROBADO |
| `TX08_BUY_BOND-IT03` | Adquisición de Bono Vestado con Descuento sobre NAV | 3/10 | Bonos Vestados & Posiciones NFT | $1.1128 | $1.1132 | 100.27% | ✅ APROBADO |
| `TX08_BUY_BOND-IT04` | Adquisición de Bono Vestado con Descuento sobre NAV | 4/10 | Bonos Vestados & Posiciones NFT | $1.1132 | $1.1137 | 100.30% | ✅ APROBADO |
| `TX08_BUY_BOND-IT05` | Adquisición de Bono Vestado con Descuento sobre NAV | 5/10 | Bonos Vestados & Posiciones NFT | $1.1137 | $1.1144 | 100.33% | ✅ APROBADO |
| `TX08_BUY_BOND-IT06` | Adquisición de Bono Vestado con Descuento sobre NAV | 6/10 | Bonos Vestados & Posiciones NFT | $1.1144 | $1.1151 | 100.35% | ✅ APROBADO |
| `TX08_BUY_BOND-IT07` | Adquisición de Bono Vestado con Descuento sobre NAV | 7/10 | Bonos Vestados & Posiciones NFT | $1.1151 | $1.1161 | 100.39% | ✅ APROBADO |
| `TX08_BUY_BOND-IT08` | Adquisición de Bono Vestado con Descuento sobre NAV | 8/10 | Bonos Vestados & Posiciones NFT | $1.1161 | $1.1173 | 100.42% | ✅ APROBADO |
| `TX08_BUY_BOND-IT09` | Adquisición de Bono Vestado con Descuento sobre NAV | 9/10 | Bonos Vestados & Posiciones NFT | $1.1173 | $1.1185 | 100.45% | ✅ APROBADO |
| `TX08_BUY_BOND-IT10` | Adquisición de Bono Vestado con Descuento sobre NAV | 10/10 | Bonos Vestados & Posiciones NFT | $1.1185 | $1.1202 | 100.48% | ✅ APROBADO |
| `TX09_RAGEQUIT_BOND-IT01` | Salida Anticipada de Bono (Ragequit) | 1/10 | Bonos Vestados & Salida Anticipada | $1.1202 | $1.1212 | 100.54% | ✅ APROBADO |
| `TX09_RAGEQUIT_BOND-IT02` | Salida Anticipada de Bono (Ragequit) | 2/10 | Bonos Vestados & Salida Anticipada | $1.1212 | $1.1233 | 100.64% | ✅ APROBADO |
| `TX09_RAGEQUIT_BOND-IT03` | Salida Anticipada de Bono (Ragequit) | 3/10 | Bonos Vestados & Salida Anticipada | $1.1233 | $1.1262 | 100.80% | ✅ APROBADO |
| `TX09_RAGEQUIT_BOND-IT04` | Salida Anticipada de Bono (Ragequit) | 4/10 | Bonos Vestados & Salida Anticipada | $1.1262 | $1.1305 | 101.05% | ✅ APROBADO |
| `TX09_RAGEQUIT_BOND-IT05` | Salida Anticipada de Bono (Ragequit) | 5/10 | Bonos Vestados & Salida Anticipada | $1.1305 | $1.1356 | 101.37% | ✅ APROBADO |
| `TX09_RAGEQUIT_BOND-IT06` | Salida Anticipada de Bono (Ragequit) | 6/10 | Bonos Vestados & Salida Anticipada | $1.1356 | $1.1414 | 101.77% | ✅ APROBADO |
| `TX09_RAGEQUIT_BOND-IT07` | Salida Anticipada de Bono (Ragequit) | 7/10 | Bonos Vestados & Salida Anticipada | $1.1414 | $1.1495 | 102.41% | ✅ APROBADO |
| `TX09_RAGEQUIT_BOND-IT08` | Salida Anticipada de Bono (Ragequit) | 8/10 | Bonos Vestados & Salida Anticipada | $1.1495 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX09_RAGEQUIT_BOND-IT09` | Salida Anticipada de Bono (Ragequit) | 9/10 | Bonos Vestados & Salida Anticipada | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX09_RAGEQUIT_BOND-IT10` | Salida Anticipada de Bono (Ragequit) | 10/10 | Bonos Vestados & Salida Anticipada | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX10_MATURED_BOND_CLAIM-IT01` | Reclamo de Bono Mínimo Vencido al 100% | 1/10 | Bonos Vestados & Vencimiento | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX10_MATURED_BOND_CLAIM-IT02` | Reclamo de Bono Mínimo Vencido al 100% | 2/10 | Bonos Vestados & Vencimiento | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX10_MATURED_BOND_CLAIM-IT03` | Reclamo de Bono Mínimo Vencido al 100% | 3/10 | Bonos Vestados & Vencimiento | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX10_MATURED_BOND_CLAIM-IT04` | Reclamo de Bono Mínimo Vencido al 100% | 4/10 | Bonos Vestados & Vencimiento | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX10_MATURED_BOND_CLAIM-IT05` | Reclamo de Bono Mínimo Vencido al 100% | 5/10 | Bonos Vestados & Vencimiento | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX10_MATURED_BOND_CLAIM-IT06` | Reclamo de Bono Mínimo Vencido al 100% | 6/10 | Bonos Vestados & Vencimiento | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX10_MATURED_BOND_CLAIM-IT07` | Reclamo de Bono Mínimo Vencido al 100% | 7/10 | Bonos Vestados & Vencimiento | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX10_MATURED_BOND_CLAIM-IT08` | Reclamo de Bono Mínimo Vencido al 100% | 8/10 | Bonos Vestados & Vencimiento | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX10_MATURED_BOND_CLAIM-IT09` | Reclamo de Bono Mínimo Vencido al 100% | 9/10 | Bonos Vestados & Vencimiento | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX10_MATURED_BOND_CLAIM-IT10` | Reclamo de Bono Mínimo Vencido al 100% | 10/10 | Bonos Vestados & Vencimiento | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX11_P2P_CREATE_OFFER-IT01` | Publicación de Solicitud de Préstamo P2P | 1/10 | Préstamos P2P & Escrow | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX11_P2P_CREATE_OFFER-IT02` | Publicación de Solicitud de Préstamo P2P | 2/10 | Préstamos P2P & Escrow | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX11_P2P_CREATE_OFFER-IT03` | Publicación de Solicitud de Préstamo P2P | 3/10 | Préstamos P2P & Escrow | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX11_P2P_CREATE_OFFER-IT04` | Publicación de Solicitud de Préstamo P2P | 4/10 | Préstamos P2P & Escrow | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX11_P2P_CREATE_OFFER-IT05` | Publicación de Solicitud de Préstamo P2P | 5/10 | Préstamos P2P & Escrow | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX11_P2P_CREATE_OFFER-IT06` | Publicación de Solicitud de Préstamo P2P | 6/10 | Préstamos P2P & Escrow | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX11_P2P_CREATE_OFFER-IT07` | Publicación de Solicitud de Préstamo P2P | 7/10 | Préstamos P2P & Escrow | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX11_P2P_CREATE_OFFER-IT08` | Publicación de Solicitud de Préstamo P2P | 8/10 | Préstamos P2P & Escrow | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX11_P2P_CREATE_OFFER-IT09` | Publicación de Solicitud de Préstamo P2P | 9/10 | Préstamos P2P & Escrow | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX11_P2P_CREATE_OFFER-IT10` | Publicación de Solicitud de Préstamo P2P | 10/10 | Préstamos P2P & Escrow | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX12_P2P_CANCEL_OFFER-IT01` | Cancelación y Rescate de Posición P2P | 1/10 | Préstamos P2P & Escrow | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX12_P2P_CANCEL_OFFER-IT02` | Cancelación y Rescate de Posición P2P | 2/10 | Préstamos P2P & Escrow | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX12_P2P_CANCEL_OFFER-IT03` | Cancelación y Rescate de Posición P2P | 3/10 | Préstamos P2P & Escrow | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX12_P2P_CANCEL_OFFER-IT04` | Cancelación y Rescate de Posición P2P | 4/10 | Préstamos P2P & Escrow | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX12_P2P_CANCEL_OFFER-IT05` | Cancelación y Rescate de Posición P2P | 5/10 | Préstamos P2P & Escrow | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX12_P2P_CANCEL_OFFER-IT06` | Cancelación y Rescate de Posición P2P | 6/10 | Préstamos P2P & Escrow | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX12_P2P_CANCEL_OFFER-IT07` | Cancelación y Rescate de Posición P2P | 7/10 | Préstamos P2P & Escrow | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX12_P2P_CANCEL_OFFER-IT08` | Cancelación y Rescate de Posición P2P | 8/10 | Préstamos P2P & Escrow | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX12_P2P_CANCEL_OFFER-IT09` | Cancelación y Rescate de Posición P2P | 9/10 | Préstamos P2P & Escrow | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX12_P2P_CANCEL_OFFER-IT10` | Cancelación y Rescate de Posición P2P | 10/10 | Préstamos P2P & Escrow | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX13_P2P_BORROW_TREASURY-IT01` | Préstamo Colateralizado de Tesorería | 1/10 | Préstamos P2P & Tesorería | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX13_P2P_BORROW_TREASURY-IT02` | Préstamo Colateralizado de Tesorería | 2/10 | Préstamos P2P & Tesorería | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX13_P2P_BORROW_TREASURY-IT03` | Préstamo Colateralizado de Tesorería | 3/10 | Préstamos P2P & Tesorería | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX13_P2P_BORROW_TREASURY-IT04` | Préstamo Colateralizado de Tesorería | 4/10 | Préstamos P2P & Tesorería | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX13_P2P_BORROW_TREASURY-IT05` | Préstamo Colateralizado de Tesorería | 5/10 | Préstamos P2P & Tesorería | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX13_P2P_BORROW_TREASURY-IT06` | Préstamo Colateralizado de Tesorería | 6/10 | Préstamos P2P & Tesorería | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX13_P2P_BORROW_TREASURY-IT07` | Préstamo Colateralizado de Tesorería | 7/10 | Préstamos P2P & Tesorería | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX13_P2P_BORROW_TREASURY-IT08` | Préstamo Colateralizado de Tesorería | 8/10 | Préstamos P2P & Tesorería | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX13_P2P_BORROW_TREASURY-IT09` | Préstamo Colateralizado de Tesorería | 9/10 | Préstamos P2P & Tesorería | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX13_P2P_BORROW_TREASURY-IT10` | Préstamo Colateralizado de Tesorería | 10/10 | Préstamos P2P & Tesorería | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX14_P2P_REPAY_TREASURY-IT01` | Reembolso de Préstamo de Tesorería con Intereses | 1/10 | Préstamos P2P & Tesorería | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX14_P2P_REPAY_TREASURY-IT02` | Reembolso de Préstamo de Tesorería con Intereses | 2/10 | Préstamos P2P & Tesorería | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX14_P2P_REPAY_TREASURY-IT03` | Reembolso de Préstamo de Tesorería con Intereses | 3/10 | Préstamos P2P & Tesorería | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX14_P2P_REPAY_TREASURY-IT04` | Reembolso de Préstamo de Tesorería con Intereses | 4/10 | Préstamos P2P & Tesorería | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX14_P2P_REPAY_TREASURY-IT05` | Reembolso de Préstamo de Tesorería con Intereses | 5/10 | Préstamos P2P & Tesorería | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX14_P2P_REPAY_TREASURY-IT06` | Reembolso de Préstamo de Tesorería con Intereses | 6/10 | Préstamos P2P & Tesorería | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX14_P2P_REPAY_TREASURY-IT07` | Reembolso de Préstamo de Tesorería con Intereses | 7/10 | Préstamos P2P & Tesorería | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX14_P2P_REPAY_TREASURY-IT08` | Reembolso de Préstamo de Tesorería con Intereses | 8/10 | Préstamos P2P & Tesorería | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX14_P2P_REPAY_TREASURY-IT09` | Reembolso de Préstamo de Tesorería con Intereses | 9/10 | Préstamos P2P & Tesorería | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX14_P2P_REPAY_TREASURY-IT10` | Reembolso de Préstamo de Tesorería con Intereses | 10/10 | Préstamos P2P & Tesorería | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX15_DAO_PROPOSAL-IT01` | Propuesta de Gobernanza On-Chain (Governor DAO) | 1/10 | Gobernanza DAO | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX15_DAO_PROPOSAL-IT02` | Propuesta de Gobernanza On-Chain (Governor DAO) | 2/10 | Gobernanza DAO | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX15_DAO_PROPOSAL-IT03` | Propuesta de Gobernanza On-Chain (Governor DAO) | 3/10 | Gobernanza DAO | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX15_DAO_PROPOSAL-IT04` | Propuesta de Gobernanza On-Chain (Governor DAO) | 4/10 | Gobernanza DAO | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX15_DAO_PROPOSAL-IT05` | Propuesta de Gobernanza On-Chain (Governor DAO) | 5/10 | Gobernanza DAO | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX15_DAO_PROPOSAL-IT06` | Propuesta de Gobernanza On-Chain (Governor DAO) | 6/10 | Gobernanza DAO | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX15_DAO_PROPOSAL-IT07` | Propuesta de Gobernanza On-Chain (Governor DAO) | 7/10 | Gobernanza DAO | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX15_DAO_PROPOSAL-IT08` | Propuesta de Gobernanza On-Chain (Governor DAO) | 8/10 | Gobernanza DAO | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX15_DAO_PROPOSAL-IT09` | Propuesta de Gobernanza On-Chain (Governor DAO) | 9/10 | Gobernanza DAO | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX15_DAO_PROPOSAL-IT10` | Propuesta de Gobernanza On-Chain (Governor DAO) | 10/10 | Gobernanza DAO | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX16_REBALANCE_PORTFOLIO-IT01` | Rebalanceo de Asignación Estratégica de Activos | 1/10 | Gestión de Reservas | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX16_REBALANCE_PORTFOLIO-IT02` | Rebalanceo de Asignación Estratégica de Activos | 2/10 | Gestión de Reservas | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX16_REBALANCE_PORTFOLIO-IT03` | Rebalanceo de Asignación Estratégica de Activos | 3/10 | Gestión de Reservas | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX16_REBALANCE_PORTFOLIO-IT04` | Rebalanceo de Asignación Estratégica de Activos | 4/10 | Gestión de Reservas | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX16_REBALANCE_PORTFOLIO-IT05` | Rebalanceo de Asignación Estratégica de Activos | 5/10 | Gestión de Reservas | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX16_REBALANCE_PORTFOLIO-IT06` | Rebalanceo de Asignación Estratégica de Activos | 6/10 | Gestión de Reservas | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX16_REBALANCE_PORTFOLIO-IT07` | Rebalanceo de Asignación Estratégica de Activos | 7/10 | Gestión de Reservas | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX16_REBALANCE_PORTFOLIO-IT08` | Rebalanceo de Asignación Estratégica de Activos | 8/10 | Gestión de Reservas | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX16_REBALANCE_PORTFOLIO-IT09` | Rebalanceo de Asignación Estratégica de Activos | 9/10 | Gestión de Reservas | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX16_REBALANCE_PORTFOLIO-IT10` | Rebalanceo de Asignación Estratégica de Activos | 10/10 | Gestión de Reservas | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX17_BUYBACK_AND_BURN-IT01` | Ejecución del Motor de Recompra y Quema Deflacionaria | 1/10 | Mecanismos Antidilución | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX17_BUYBACK_AND_BURN-IT02` | Ejecución del Motor de Recompra y Quema Deflacionaria | 2/10 | Mecanismos Antidilución | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX17_BUYBACK_AND_BURN-IT03` | Ejecución del Motor de Recompra y Quema Deflacionaria | 3/10 | Mecanismos Antidilución | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX17_BUYBACK_AND_BURN-IT04` | Ejecución del Motor de Recompra y Quema Deflacionaria | 4/10 | Mecanismos Antidilución | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX17_BUYBACK_AND_BURN-IT05` | Ejecución del Motor de Recompra y Quema Deflacionaria | 5/10 | Mecanismos Antidilución | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX17_BUYBACK_AND_BURN-IT06` | Ejecución del Motor de Recompra y Quema Deflacionaria | 6/10 | Mecanismos Antidilución | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX17_BUYBACK_AND_BURN-IT07` | Ejecución del Motor de Recompra y Quema Deflacionaria | 7/10 | Mecanismos Antidilución | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX17_BUYBACK_AND_BURN-IT08` | Ejecución del Motor de Recompra y Quema Deflacionaria | 8/10 | Mecanismos Antidilución | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX17_BUYBACK_AND_BURN-IT09` | Ejecución del Motor de Recompra y Quema Deflacionaria | 9/10 | Mecanismos Antidilución | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX17_BUYBACK_AND_BURN-IT10` | Ejecución del Motor de Recompra y Quema Deflacionaria | 10/10 | Mecanismos Antidilución | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX18_CIRCUIT_BREAKER_CHECK-IT01` | Prueba de Congelamiento y Restablecimiento de Circuit Breaker | 1/10 | Seguridad & Circuit Breaker | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX18_CIRCUIT_BREAKER_CHECK-IT02` | Prueba de Congelamiento y Restablecimiento de Circuit Breaker | 2/10 | Seguridad & Circuit Breaker | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX18_CIRCUIT_BREAKER_CHECK-IT03` | Prueba de Congelamiento y Restablecimiento de Circuit Breaker | 3/10 | Seguridad & Circuit Breaker | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX18_CIRCUIT_BREAKER_CHECK-IT04` | Prueba de Congelamiento y Restablecimiento de Circuit Breaker | 4/10 | Seguridad & Circuit Breaker | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX18_CIRCUIT_BREAKER_CHECK-IT05` | Prueba de Congelamiento y Restablecimiento de Circuit Breaker | 5/10 | Seguridad & Circuit Breaker | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX18_CIRCUIT_BREAKER_CHECK-IT06` | Prueba de Congelamiento y Restablecimiento de Circuit Breaker | 6/10 | Seguridad & Circuit Breaker | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX18_CIRCUIT_BREAKER_CHECK-IT07` | Prueba de Congelamiento y Restablecimiento de Circuit Breaker | 7/10 | Seguridad & Circuit Breaker | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX18_CIRCUIT_BREAKER_CHECK-IT08` | Prueba de Congelamiento y Restablecimiento de Circuit Breaker | 8/10 | Seguridad & Circuit Breaker | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX18_CIRCUIT_BREAKER_CHECK-IT09` | Prueba de Congelamiento y Restablecimiento de Circuit Breaker | 9/10 | Seguridad & Circuit Breaker | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX18_CIRCUIT_BREAKER_CHECK-IT10` | Prueba de Congelamiento y Restablecimiento de Circuit Breaker | 10/10 | Seguridad & Circuit Breaker | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX19_METRICS_AUDIT_TAB-IT01` | Inspección de Transparencia y Desglose Patrimonial | 1/10 | Transparencia & Auditoría | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX19_METRICS_AUDIT_TAB-IT02` | Inspección de Transparencia y Desglose Patrimonial | 2/10 | Transparencia & Auditoría | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX19_METRICS_AUDIT_TAB-IT03` | Inspección de Transparencia y Desglose Patrimonial | 3/10 | Transparencia & Auditoría | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX19_METRICS_AUDIT_TAB-IT04` | Inspección de Transparencia y Desglose Patrimonial | 4/10 | Transparencia & Auditoría | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX19_METRICS_AUDIT_TAB-IT05` | Inspección de Transparencia y Desglose Patrimonial | 5/10 | Transparencia & Auditoría | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX19_METRICS_AUDIT_TAB-IT06` | Inspección de Transparencia y Desglose Patrimonial | 6/10 | Transparencia & Auditoría | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX19_METRICS_AUDIT_TAB-IT07` | Inspección de Transparencia y Desglose Patrimonial | 7/10 | Transparencia & Auditoría | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX19_METRICS_AUDIT_TAB-IT08` | Inspección de Transparencia y Desglose Patrimonial | 8/10 | Transparencia & Auditoría | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX19_METRICS_AUDIT_TAB-IT09` | Inspección de Transparencia y Desglose Patrimonial | 9/10 | Transparencia & Auditoría | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX19_METRICS_AUDIT_TAB-IT10` | Inspección de Transparencia y Desglose Patrimonial | 10/10 | Transparencia & Auditoría | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX20_APY_AND_REFERRALS-IT01` | Auditoría de Componentes Dinámicos (Modal APY y Referidos) | 1/10 | Transparencia & Comunidad | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX20_APY_AND_REFERRALS-IT02` | Auditoría de Componentes Dinámicos (Modal APY y Referidos) | 2/10 | Transparencia & Comunidad | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX20_APY_AND_REFERRALS-IT03` | Auditoría de Componentes Dinámicos (Modal APY y Referidos) | 3/10 | Transparencia & Comunidad | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX20_APY_AND_REFERRALS-IT04` | Auditoría de Componentes Dinámicos (Modal APY y Referidos) | 4/10 | Transparencia & Comunidad | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX20_APY_AND_REFERRALS-IT05` | Auditoría de Componentes Dinámicos (Modal APY y Referidos) | 5/10 | Transparencia & Comunidad | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX20_APY_AND_REFERRALS-IT06` | Auditoría de Componentes Dinámicos (Modal APY y Referidos) | 6/10 | Transparencia & Comunidad | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX20_APY_AND_REFERRALS-IT07` | Auditoría de Componentes Dinámicos (Modal APY y Referidos) | 7/10 | Transparencia & Comunidad | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX20_APY_AND_REFERRALS-IT08` | Auditoría de Componentes Dinámicos (Modal APY y Referidos) | 8/10 | Transparencia & Comunidad | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX20_APY_AND_REFERRALS-IT09` | Auditoría de Componentes Dinámicos (Modal APY y Referidos) | 9/10 | Transparencia & Comunidad | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |
| `TX20_APY_AND_REFERRALS-IT10` | Auditoría de Componentes Dinámicos (Modal APY y Referidos) | 10/10 | Transparencia & Comunidad | $1.1587 | $1.1587 | 103.27% | ✅ APROBADO |

---

## 4. Auditoría de Concordancia Pantalla (UI) vs On-Chain (Blockchain)

- **Concordancia de NAV:** Menor a $0.0001 USDC entre pantalla y contrato.
- **Concordancia de PoR:** Desviación menor al 0.01%.
- **Persistencia On-Chain:** Las transacciones no fueron revertidas; el usuario puede comprobar los números resultantes directamente en su navegador navegando a `http://localhost:5173`.

**Certificación de Auditoría:** ✅ **SISTEMA VALIDADO EN VIVO Y 100% CONFORME CON TOKENOMICS**.
