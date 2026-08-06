# Catálogo de Pruebas de Calidad (50 Test Cases Suite) — Alpha Centauri V6

**Versión del Protocolo:** 6.0.0-Mainnet  
**Resultado de Ejecución Automatizada:** 50/50 PASADAS (100% Éxito)  
**Compatibilidad:** Ejecución Manual (Humano en DApp) y Ejecución Automatizada (Agente AI vía Viem / RPC)  

---

## 📋 Resumen Ejecutivo

Esta suite contiene **50 casos de prueba rigurosos** diseñados para verificar de punta a punta cada función, interfaz, contrato inteligente, control de accesos y regla de negocio del protocolo Alpha Centauri V6.

---

## 1. Módulo 1: Tesorería & Proof of Reserves (Pruebas 01 - 08)

### Test #01: Faucet USDC Mock
- **Categoría:** Tesorería
- **Instrucción Humana:** Hacer clic en "Reclamar Faucet USDC" en la interfaz.
- **Ejecución Automatizada AI:** `usdc.mint(userAddress, parseEther('10000'))`
- **Resultado Esperado:** Incremento de 10,000.00 USDC en la billetera.

### Test #02: Aprobación de USDC a Tesorería
- **Categoría:** Tesorería / ERC-20
- **Instrucción Humana:** Ingresar 5000 USDC y presionar "Depositar". Confirmar aprobación.
- **Ejecución Automatizada AI:** `usdc.approve(TreasuryAddress, parseEther('5000'))`
- **Resultado Esperado:** `allowance(user, Treasury) == 5000 USDC`.

### Test #03: Depósito en Tesorería -> Acuñar ALPHA Shares
- **Categoría:** Tesorería
- **Instrucción Humana:** Confirmar transacción de depósito de 1,000 USDC en Tesorería.
- **Ejecución Automatizada AI:** `treasury.deposit(parseEther('1000'))`
- **Resultado Esperado:** Balance de participaciones ALPHA mayor a 0 a valor NAV.

### Test #04: Consulta de Net Asset Value (NAV)
- **Categoría:** Tesorería
- **Instrucción Humana:** Verificar el badge "VALOR NAV / SHARE" en la cabecera ($1.00 USD).
- **Ejecución Automatizada AI:** `treasury.getNAV()`
- **Resultado Esperado:** Retorna valor NAV $\ge 1.00$ USD.

### Test #05: Auditoría de Proof of Reserves (PoR)
- **Categoría:** PoR & Solvencia
- **Instrucción Humana:** Hacer clic en "Auditar PoR On-Chain" en el panel de Tesorería.
- **Ejecución Automatizada AI:** `treasury.getProofOfReserves()`
- **Resultado Esperado:** `collateralRatioBps >= 10000` (Solvencia $\ge 100\%$).

### Test #06: Rescate de Shares ALPHA por USDC
- **Categoría:** Tesorería
- **Instrucción Humana:** Ingresar 100 ALPHA y hacer clic en "Rescatar USDC".
- **Ejecución Automatizada AI:** `treasury.redeem(parseEther('100'))`
- **Resultado Esperado:** Quemado de 100 ALPHA y recepción de USDC a valor NAV.

### Test #07: Verificación de Pesos Objetivo Exógenos (60/26.67/13.33)
- **Categoría:** Tesorería / Portfolio
- **Instrucción Humana:** Revisar la tabla de desglose colateral PoR.
- **Ejecución Automatizada AI:** `treasury.currentWeights()`
- **Resultado Esperado:** Pesos en puntos básicos `[6000, 2667, 1333]` (60.00% USDC, 26.67% WBTC, 13.33% WETH).

### Test #08: Rechazo de Depósito Nulo (0 USDC)
- **Categoría:** Validación & Control de Errores
- **Instrucción Humana:** Intentar depositar 0 USDC en Tesorería.
- **Ejecución Automatizada AI:** `treasury.deposit(0)`
- **Resultado Esperado:** Transacción revertida con error de validación.

---

## 2. Módulo 2: Bonos Vestados & NFTs ERC-721 (Pruebas 09 - 16)

### Test #09: Aprobación de USDC para Vested Vault
- **Categoría:** Bonos Vestados
- **Instrucción Humana:** En la sección Bonos, ingresar $1,000 USD y autorizar USDC.
- **Ejecución Automatizada AI:** `usdc.approve(VestedVaultAddress, parseEther('10000'))`
- **Resultado Esperado:** Allowance confirmado para VestedVault.

### Test #10: Adquisición de Bono a 3 Años (15% Descuento)
- **Categoría:** Bonos Vestados
- **Instrucción Humana:** Seleccionar plazo de 3 Años y presionar "Comprar Bono Vestado".
- **Ejecución Automatizada AI:** `vestedVault.buyVestedBond(parseEther('1000'), 3, address(0))`
- **Resultado Esperado:** Acuñación de bono con $15\%$ de descuento sobre NAV.

### Test #11: Verificación de Propiedad de Position NFT #1
- **Categoría:** ERC-721
- **Instrucción Humana:** Inspeccionar la tarjeta de bono NFT #1 en la galería de usuario.
- **Ejecución Automatizada AI:** `positionNft.ownerOf(1)`
- **Resultado Esperado:** `ownerOf(1) == userAddress`.

### Test #12: Consulta de Metadatos de Posición NFT
- **Categoría:** ERC-721 / Metadatos
- **Instrucción Humana:** Revisar el valor principal y fecha de expiración en el NFT #1.
- **Ejecución Automatizada AI:** `positionNft.getPosition(1)`
- **Resultado Esperado:** Retorna estructura con `principalUSD == 1000 ether`.

### Test #13: Compra de Bono a 5 Años con Referido (20% Descuento)
- **Categoría:** Bonos Vestados / Referidos
- **Instrucción Humana:** Ingresar dirección de referido y comprar bono a 5 años.
- **Ejecución Automatizada AI:** `vestedVault.buyVestedBond(parseEther('1000'), 5, referrerAddress)`
- **Resultado Esperado:** Bono acuñado con $20\%$ descuento y registro de referido.

### Test #14: Rechazo de Reclamo Prematuro de Bono
- **Categoría:** Control de Tiempo / Lockup
- **Instrucción Humana:** Intentar reclamar principal en un bono no vencido.
- **Ejecución Automatizada AI:** `vestedVault.claimMatured(1)`
- **Resultado Esperado:** Transacción revertida por estar dentro del período de vestado.

### Test #15: Salida Anticipada (Ragequit) con 15% Penalización
- **Precondición:** Billetera posee NFT #2 de posición vestada activa.
- **Instrucción Humana:** Hacer clic en "Ejecutar Ragequit (15% Penalización)" en el NFT #2.
- **Ejecución Automatizada AI:** `vestedVault.ragequit(2)`
- **Resultado Esperado:** Retorno del 85% del principal; 15% penalizado y enrutado 50/25/25 + quema del 100% de tokens unvested.

### Test #16: Rechazo de Doble Ragequit
- **Categoría:** Invariante de Negocio
- **Instrucción Humana:** Intentar presionar "Ragequit" nuevamente en un NFT desintegrado.
- **Ejecución Automatizada AI:** `vestedVault.ragequit(2)`
- **Resultado Esperado:** Transacción revertida por estar ya desintegrado (`isRagequitted == true`).

---

## 3. Módulo 3: Mercado de Préstamos P2P (Pruebas 17 - 25)

### Test #17: Aprobación de NFT colateral para P2P Market
- **Categoría:** P2P Lending
- **Instrucción Humana:** Seleccionar NFT #1 y autorizar al mercado P2P.
- **Ejecución Automatizada AI:** `positionNft.approve(P2PMarketAddress, 1)`
- **Resultado Esperado:** NFT autorizado para custodia temporal.

### Test #18: Publicación de Oferta de Préstamo P2P
- **Categoría:** P2P Lending
- **Instrucción Humana:** Solicitar $500 USDC a 10% interés por 30 días con el NFT #1.
- **Ejecución Automatizada AI:** `p2pMarket.createLoanOffer(1, parseEther('500'), 1000, 30)`
- **Resultado Esperado:** Oferta publicada y NFT transferido al contrato P2P.

### Test #19: Aprobación de Fondos por Prestamista
- **Categoría:** P2P Lending
- **Instrucción Humana:** Cambiar a rol "Prestamista" y aprobar USDC.
- **Ejecución Automatizada AI:** `usdc.approve(P2PMarketAddress, parseEther('10000'))`
- **Resultado Esperado:** Fondos aprobados para financiar la oferta.

### Test #20: Aceptación de Préstamo P2P
- **Categoría:** P2P Lending
- **Instrucción Humana:** Hacer clic en "Aceptar y Financiar Préstamo #1".
- **Ejecución Automatizada AI:** `p2pMarket.acceptLoanAndDepositCollateral(1, parseEther('700'))`
- **Resultado Esperado:** Transferencia de USDC al prestatario y estado activo.

### Test #21: Aprobación de Reembolso por Prestatario
- **Categoría:** P2P Lending
- **Instrucción Humana:** Cambiar a Prestatario y aprobar USDC para pago de deuda.
- **Ejecución Automatizada AI:** `usdc.approve(P2PMarketAddress, parseEther('1000'))`
- **Resultado Esperado:** Fondos listos para el reembolso.

### Test #22: Reembolso de Préstamo P2P -> Devolución de NFT
- **Categoría:** P2P Lending
- **Instrucción Humana:** Presionar "Reembolsar Préstamo #1".
- **Ejecución Automatizada AI:** `p2pMarket.repayLoan(1)`
- **Resultado Esperado:** Liquidación de deuda e intereses y devolución del NFT #1.

### Test #23: Verificación de Devolución de NFT al Prestatario
- **Categoría:** P2P / ERC-721
- **Instrucción Humana:** Verificar que el NFT #1 vuelve a aparecer en tu galería.
- **Ejecución Automatizada AI:** `positionNft.ownerOf(1)`
- **Resultado Esperado:** `ownerOf(1) == borrowerAddress`.

### Test #24: Creación de Préstamo #2 para Test de Liquidación
- **Categoría:** P2P / Liquidaciones
- **Instrucción Humana:** Crear oferta de préstamo con duración de 1 día.
- **Ejecución Automatizada AI:** `p2pMarket.createLoanOffer(1, parseEther('400'), 1000, 1)`
- **Resultado Esperado:** Nueva oferta ID #2 creada.

### Test #25: Rechazo de Liquidación Prematura
- **Categoría:** Liquidaciones
- **Instrucción Humana:** Intentar liquidar el Préstamo #2 antes del plazo de vencimiento.
- **Ejecución Automatizada AI:** `p2pMarket.liquidateLoan(2)`
- **Resultado Esperado:** Reversión de la transacción por estar dentro del plazo de vigencia.

---

## 4. Módulo 4: Gobernanza & Real Yield Router (Pruebas 26 - 34)

### Test #26: Aprobación de Tokens ALPHA para Staking
- **Categoría:** Staking
- **Instrucción Humana:** En la pestaña Gobernanza, autorizar tokens ALPHA.
- **Ejecución Automatizada AI:** `alphaToken.approve(StakingAddress, parseEther('500'))`
- **Resultado Esperado:** Approval otorgado al contrato `GovernanceStaking.sol`.

### Test #27: Bloqueo (Stake) de 100 ALPHA
- **Categoría:** Staking
- **Instrucción Humana:** Ingresar 100 ALPHA y hacer clic en "Stake ALPHA".
- **Ejecución Automatizada AI:** `staking.stake(parseEther('100'))`
- **Resultado Esperado:** Incremento del balance bloqueado en el pool.

### Test #28: Consulta de Balance Staked
- **Categoría:** Staking
- **Instrucción Humana:** Verificar el badge "TU SALDO EN STAKING" (100.00 ALPHA).
- **Ejecución Automatizada AI:** `staking.stakedBalances(userAddress)`
- **Resultado Esperado:** `stakedBalances(user) == 100 ether`.

### Test #29: Configuración de Payout Opción 0 (USDC)
- **Categoría:** Real Yield Router
- **Instrucción Humana:** Seleccionar "Opción A: Recibir Dividendos en USDC".
- **Ejecución Automatizada AI:** `realYieldRouter.setPayoutPreference(0)`
- **Resultado Esperado:** Preferencia configurada en 0 on-chain.

### Test #30: Configuración de Payout Opción 1 (WBTC/WETH)
- **Categoría:** Real Yield Router
- **Instrucción Humana:** Seleccionar "Opción B: Recibir Dividendos en Reservas (WBTC/WETH)".
- **Ejecución Automatizada AI:** `realYieldRouter.setPayoutPreference(1)`
- **Resultado Esperado:** Preferencia actualizada a 1 on-chain.

### Test #31: Reclamo de Dividendos Real Yield
- **Categoría:** Real Yield Router
- **Instrucción Humana:** Hacer clic en "Reclamar Real Yield".
- **Ejecución Automatizada AI:** `realYieldRouter.claimRealYield()`
- **Resultado Esperado:** Dividendos transferidos a la billetera.

### Test #32: Liberación (Unstake) de 50 ALPHA
- **Categoría:** Staking
- **Instrucción Humana:** Ingresar 50 ALPHA y presionar "Unstake ALPHA".
- **Ejecución Automatizada AI:** `staking.unstake(parseEther('50'))`
- **Resultado Esperado:** 50 ALPHA devueltos a la billetera principal.

### Test #33: Rechazo de Unstake Excesivo
- **Categoría:** Control de Balance
- **Instrucción Humana:** Intentar retirar un monto mayor al saldo staked.
- **Ejecución Automatizada AI:** `staking.unstake(parseEther('10000'))`
- **Resultado Esperado:** Reversión por saldo insuficiente.

### Test #34: Rechazo de Stake Nulo (0 ALPHA)
- **Categoría:** Validación
- **Instrucción Humana:** Intentar hacer stake de 0 ALPHA.
- **Ejecución Automatizada AI:** `staking.stake(0)`
- **Resultado Esperado:** Reversión por monto nulo.

---

## 5. Módulo 5: CircuitBreaker & Oráculos (Pruebas 35 - 40)

### Test #35: Consulta de Dirección de Oráculo Price Feed
- **Categoría:** Oráculos
- **Instrucción Humana:** Revisar la dirección de oráculo en el panel administrativo.
- **Ejecución Automatizada AI:** `treasury.priceFeeds(USDCAddress)`
- **Resultado Esperado:** Retorna dirección válida de oráculo Chainlink.

### Test #36: Verificación de Estado Normal de CircuitBreaker
- **Categoría:** Seguridad
- **Instrucción Humana:** Comprobar que no hay alertas rojas en el header.
- **Ejecución Automatizada AI:** `circuitBreaker.isFrozen(USDCAddress)`
- **Resultado Esperado:** `isFrozen == false`.

### Test #37: Ejecución de Chequeo de Desviación sin Anomalías
- **Categoría:** Volatilidad
- **Instrucción Humana:** Hacer clic en "Chequear Desviación Oráculo".
- **Ejecución Automatizada AI:** `circuitBreaker.checkAssetDeviation(USDCAddress)`
- **Resultado Esperado:** Retorna `false` (sin activación de congelamiento).

### Test #38: Reinicio por Gobernanza de CircuitBreaker
- **Categoría:** Gobernanza / Emergencia
- **Instrucción Humana:** Presionar "Reiniciar CircuitBreaker" desde la cuenta Admin.
- **Ejecución Automatizada AI:** `circuitBreaker.resetBreaker(USDCAddress)`
- **Resultado Esperado:** Restablecimiento de operaciones normales.

### Test #39: Simulación de Variación de Precio en Oráculo Mock
- **Categoría:** Oráculos / Tests de Volatilidad
- **Instrucción Humana:** Ingresar nuevo precio en "Actualizar Oráculo Chainlink".
- **Ejecución Automatizada AI:** `oracleFeed.setPrice(100000000)`
- **Resultado Esperado:** Actualización del precio del oráculo a $1.00 USD.

### Test #40: Recálculo Dinámico de NAV tras cambio de Precio
- **Categoría:** Tesorería / NAV
- **Instrucción Humana:** Verificar la actualización automática del NAV en tiempo real.
- **Ejecución Automatizada AI:** `treasury.getNAV()`
- **Resultado Esperado:** NAV recalculado conforme a los nuevos precios de oráculo.

---

## 6. Módulo 6: Operaciones Corporativas TWAP (Pruebas 41 - 45)

### Test #41: Aprobación USDC para Recompra Corporativa
- **Categoría:** TWAP / Buyback
- **Instrucción Humana:** En el Panel Admin, ingresar monto a inyectar y aprobar USDC.
- **Ejecución Automatizada AI:** `usdc.approve(CorporateContributionAddress, parseEther('1000'))`
- **Resultado Esperado:** Approval concedido para la orden TWAP.

### Test #42: Creación de Orden TWAP de Recompra
- **Categoría:** TWAP / Buyback
- **Instrucción Humana:** Presionar "Ejecutar Recompra TWAP ($1,000 USD)".
- **Ejecución Automatizada AI:** `corporateContribution.createTWAPOrder(parseEther('1000'), 5, 300)`
- **Resultado Esperado:** Creación de orden TWAP con 5 intervalos.

### Test #43: Verificación de Fondos Custodiados en TWAP
- **Categoría:** TWAP
- **Instrucción Humana:** Consultar el balance reservado en el contrato de recompra.
- **Ejecución Automatizada AI:** `usdc.balanceOf(CorporateContributionAddress)`
- **Resultado Esperado:** `balance == 1000 USDC`.

### Test #44: Rechazo de Orden TWAP por Fondos Insuficientes
- **Categoría:** Control de Errores
- **Instrucción Humana:** Intentar crear un TWAP por un monto astronómico sin saldo.
- **Ejecución Automatizada AI:** `corporateContribution.createTWAPOrder(parseEther('1000000000'), 5, 300)`
- **Resultado Esperado:** Reversión por saldo insuficiente.

### Test #45: Verificación de Aumento de Reservas Post-TWAP
- **Categoría:** Tesorería
- **Instrucción Humana:** Auditar PoR tras la ejecución del TWAP.
- **Ejecución Automatizada AI:** `treasury.getProofOfReserves()`
- **Resultado Esperado:** Incremento colateral en la Tesorería.

---

## 7. Módulo 7: Infraestructura & RPC Anvil (Pruebas 46 - 50)

### Test #46: Creación de Snapshot EVM via JSON-RPC
- **Categoría:** Infraestructura / RPC
- **Instrucción Humana:** Presionar "Reactivar / Reiniciar Entorno Anvil".
- **Ejecución Automatizada AI:** `provider.send('evm_snapshot', [])`
- **Resultado Esperado:** Retorna ID numérico de Snapshot EVM.

### Test #47: Consulta de Bloque Actual y Timestamp EVM
- **Categoría:** EVM / Tiempo
- **Instrucción Humana:** Verificar el indicador "FECHA EVM / BLOQUE" en el header.
- **Ejecución Automatizada AI:** `provider.getBlock('latest')`
- **Resultado Esperado:** Retorna número de bloque y timestamp válidos.

### Test #48: Minado Simulado de Bloque EVM (`evm_mine`)
- **Categoría:** Simulación EVM
- **Instrucción Humana:** Ejecutar una transacción para avanzar el tiempo de bloque.
- **Ejecución Automatizada AI:** `provider.send('evm_mine', [])`
- **Resultado Esperado:** Incremento del número de bloque en +1.

### Test #49: Reversión de Estado Anvil (`evm_revert`)
- **Categoría:** Simulación EVM / Rollback
- **Instrucción Humana:** Confirmar reinicio del entorno desde la interfaz DApp.
- **Ejecución Automatizada AI:** `provider.send('evm_revert', [snapshotId])`
- **Resultado Esperado:** Estado de la blockchain restaurado al momento del Snapshot.

### Test #50: Verificación de Solvencia Final del Protocolo
- **Categoría:** Auditoría Global
- **Instrucción Humana:** Auditar globalmente el protocolo en el header final.
- **Ejecución Automatizada AI:** `treasury.getProofOfReserves()`
- **Resultado Esperado:** `collateralRatioBps >= 10000` ($100\%$ Solvente).

---

## 🚀 Cómo Ejecutar esta Suite Automatizada por la IA

Para ejecutar los **50 casos de prueba en tiempo real sin abrir el navegador**:

```bash
docker run --rm --network host \
  -v "C:\Users\Admin\Desktop\token:/app" \
  -w /app node:20-alpine \
  node /app/scripts/run_50_tests.mjs
```
