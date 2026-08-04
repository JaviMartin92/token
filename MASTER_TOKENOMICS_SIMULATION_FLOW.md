# 📜 FLUJO MAESTRO DE SIMULACIÓN DE TOKENOMICS (15 PASOS Y 57 MÉTRICAS UI)

Este documento sirve como la **Guía Maestra y Especificación de Aserciones** para la prueba de integración E2E automatizada en `frontend/tests/master_tokenomics_simulation.spec.ts`.

---

## 🛡️ 0. DIRECTIVAS INMUTABLES E INVARIANTES DEL PROTOCOLO

1. **Directiva de Colateralización Incondicional:**
   $$\mathbf{\text{Ratio}_{\text{post-tx}} \ge \text{Ratio}_{\text{pre-tx}}}$$
   Evaluado en `TreasuryManager.sol`. Reversión de la EVM si el porcentaje de colateralización disminuye.

2. **Prohibición de Minteado Inflacionario Sin Respaldo:**
   Las carteras corporativas (`CorporateOpExVault` y `CorporateProfitVault`) **NUNCA** reciben tokens ALPHA minteados de la nada. Toda asignación proviene exclusivamente de swaps de mercado DEX con comisiones reales capturadas.

3. **Invariante Deflacionario Incondicional (Quema Permanente):**
   - 0.50% de la comisión de entrada al staking se quema permanentemente (`_burn`).
   - 100% de los tokens ALPHA en vesting de un bono cancelado por ragequit se queman permanentemente.

---

## 🌐 INVENTARIO DE LAS 57 MÉTRICAS SUPERVISADAS EN EL FRONTEND

| # | Selector / Campo UI | Componente Frontend | Descripción y Fórmula On-Chain |
| :---: | :--- | :--- | :--- |
| **1** | `header-nav-total` | `Header.tsx` | Total NAV de Tesorería en USD |
| **2** | `header-por-ratio` | `Header.tsx` | Proof of Reserves Ratio (%) |
| **3** | `header-nav-per-share` | `Header.tsx` | NAV por Acción (USD / ALPHA) |
| **4** | `header-real-yield-apy` | `Header.tsx` | Real Yield APY (%) |
| **5** | `header-circuit-breaker` | `Header.tsx` | Estado Operativo (🟢 Operativo / 🔴 Pausado) |
| **6** | `header-wallet-address` | `Header.tsx` | Dirección Billetera Conectada |
| **7** | `header-active-role` | `Header.tsx` | Rol Activo en la App (Admin / User) |
| **8** | `user-usdc-balance` | `Header.tsx` / Modales | Saldo USDC Líquido en Billetera |
| **9** | `user-alpha-balance` | `Header.tsx` / Modales | Saldo ALPHA Shares en Billetera |
| **10**| `user-stalpha-balance` | `Header.tsx` / Staking | Saldo stALPHA Staked en Gobernanza |
| **11**| `user-claimable-yield` | `Header.tsx` / Staking | Dividendos Reclamables ($ USDC) |
| **12**| `por-assets-usd` | `TreasuryDashboard.tsx` | Activos Totales en Reservas ($ USD) |
| **13**| `por-liabilities-usd` | `TreasuryDashboard.tsx` | Pasivos Totales en Reservas ($ USD) |
| **14**| `por-collateral-ratio` | `TreasuryDashboard.tsx` | Ratio de Colateralización PoR (%) |
| **15**| `por-solvency-label` | `TreasuryDashboard.tsx` | Etiqueta Solvencia (🟢 100% Solvente) |
| **16**| `asset-usdc-usd` | `TreasuryDashboard.tsx` | Desglose USDC ($ USD y %) |
| **17**| `asset-wbtc-usd` | `TreasuryDashboard.tsx` | Desglose WBTC ($ USD y %) |
| **18**| `asset-weth-usd` | `TreasuryDashboard.tsx` | Desglose WETH ($ USD y %) |
| **19**| `asset-p2p-usd` | `TreasuryDashboard.tsx` | Desglose P2P Assets / Protocol Staking ($ USD y %) |
| **20**| `treasury-p2p-loans` | `TreasuryDashboard.tsx` | Préstamos P2P Concedidos por Tesorería ($) |
| **21**| `p2p-escrow-collateral`| `TreasuryDashboard.tsx` | Colateral P2P en Escrow de Tesorería ($) |
| **22**| `p2p-overcollateral` | `TreasuryDashboard.tsx` | Ratio Sobre-Colateralización P2P (%) |
| **23**| `deposit-input-usd` | `TreasuryDashboard.tsx` | Monto Input Depósito ($ USDC) |
| **24**| `redeem-input-shares` | `TreasuryDashboard.tsx` | Monto Input Rescate (ALPHA Shares) |
| **25**| `deposit-fee-pct` | `TreasuryDashboard.tsx` | Comisión de Depósito (0.50%) |
| **26**| `redeem-fee-pct` | `TreasuryDashboard.tsx` | Comisión de Rescate (1.00%) |
| **27**| `staking-user-balance` | `GovernanceStakingUI.tsx` | Tu Staking en Gobernanza (stALPHA) |
| **28**| `staking-claimable-yield`| `GovernanceStakingUI.tsx` | Real Yield Acumulado Reclamable ($) |
| **29**| `circulating-supply` | `GovernanceStakingUI.tsx` | Oferta Circulante Neta (ALPHA) |
| **30**| `community-staked-supply`| `GovernanceStakingUI.tsx` | Stake de la Comunidad (stALPHA) |
| **31**| `corporate-staked-supply`| `GovernanceStakingUI.tsx` | Stake Bóvedas Corporativas (stALPHA) |
| **32**| `treasury-staked-supply` | `GovernanceStakingUI.tsx` | Stake Reservas Tesorería (stALPHA) |
| **33**| `total-staked-supply` | `GovernanceStakingUI.tsx` | Total Global Staked (ALPHA) |
| **34**| `staking-ratio-pct` | `GovernanceStakingUI.tsx` | Ratio de Staking Global (%) |
| **35**| `total-burned-tokens` | `GovernanceStakingUI.tsx` | Tokens Quemados Totales (ALPHA) |
| **36**| `payout-preference-active`| `GovernanceStakingUI.tsx` | Preferencia Dividendos (Opción A / B) |
| **37**| `stake-input-amount` | `GovernanceStakingUI.tsx` | Monto Input Stake / Unstake |
| **38**| `bond-calculated-discount`| `VestedVaults.tsx` | Descuento Calculado Total (%) |
| **39**| `bond-base-discount` | `VestedVaults.tsx` | Descuento Base por Años (%) |
| **40**| `bond-vip-bonus` | `VestedVaults.tsx` | VIP Staking Bonus Discount (%) |
| **41**| `bond-price-paid` | `VestedVaults.tsx` | Precio Descontado Pagado ($ USDC) |
| **42**| `bond-savings-amount` | `VestedVaults.tsx` | Ahorro Estimado ($ USDC) |
| **43**| `bond-mint-fee` | `VestedVaults.tsx` | Comisión Mint (1.50% USD) |
| **44**| `bond-referral-reward` | `VestedVaults.tsx` | Recompensa Referido (1.50% USD) |
| **45**| `total-bonds-count` | `VestedVaults.tsx` | Total Posiciones NFT Emitidas |
| **46**| `present-liability-usd`| `VestedVaults.tsx` | Valor Pasivo Presente ($ USD) |
| **47**| `ragequit-penalty-usd` | `VestedVaults.tsx` | Penalización Ragequit (15% USD) |
| **48**| `ragequit-refund-usd` | `VestedVaults.tsx` | Reembolso Neto Ragequit ($ USDC) |
| **49**| `p2p-active-offers` | `P2PMarketplace.tsx` | Ofertas P2P Activas Publicadas |
| **50**| `p2p-active-loans` | `P2PMarketplace.tsx` | Préstamos P2P Financiados en Curso |
| **51**| `p2p-escrow-total-usd` | `P2PMarketplace.tsx` | Total Colateral P2P en Escrow ($ USD) |
| **52**| `p2p-total-lent-usd` | `P2PMarketplace.tsx` | Total Préstamos Concedidos P2P ($ USD) |
| **53**| `p2p-origination-fee-usd`| `P2PMarketplace.tsx` | Origination Fee P2P (0.50% USD) |
| **54**| `opex-vault-balance` | `AdminControlPanel.tsx` | Balance Corporate OpEx Vault ($ USD) |
| **55**| `profit-vault-balance` | `AdminControlPanel.tsx` | Balance Corporate Profit Vault ($ USD) |
| **56**| `promotions-fund-balance`| `AdminControlPanel.tsx` | Fondo Promociones ($ USD) |
| **57**| `treasury-loan-buffer` | `AdminControlPanel.tsx` | Búfer Préstamos Tesorería ($ USDC) |

---

## 📊 MATRIZ MAESTRA DETALLADA DE LOS 15 PASOS

---

### 📍 PASO 0: ESTADO GENESIS ($0 TVL)
- **NAV Total:** $0.00 | **PoR Ratio:** 100.00% | **NAV per Share:** $1.0000 | **APY:** 0.00% | **Estado:** 🟢 Operativo.
- **Saldos Usuario:** USDC = $0.00 | ALPHA = 0.00 | stALPHA = 0.00 | Yield = $0.00.
- **Tesorería:** Activos = $0.00 | Pasivos = $0.00 | Solvencia = 🟢 100% Solvente | USDC = $0.00 | WBTC = $0.00 | WETH = $0.00 | P2P Assets = $0.00.
- **Staking:** Circulante = 0.00 ALPHA | Stake Com. = 0.00 | Stake Bóvedas = 0.00 | Total Staked = 0.00 | Staking Ratio = 0.00% | Quemados = 0.00 ALPHA.
- **Command Center:** OpEx Vault = $0.00 | Profit Vault = $0.00 | Búfer Préstamos = $0.00.

---

### 📍 PASO 1: TU COMPRA DE PREFONDEO INICIAL ($100,000.00 USDC)
- **Mecanismo:** Depositas $100k USDC. Fee 0.50% ($500 USDC):
  - $250.00 USDC ➔ Reservas Tesorería (`AlphaVault.sol`).
  - $125.00 USDC ➔ Auto-swapped a **124.688 ALPHA** y auto-staked en OpEx Vault.
  - $125.00 USDC ➔ Auto-swapped a **124.688 ALPHA** y auto-staked en Profit Vault.
- **Shares Emitidas:** **99,500.00 ALPHA**.
- **NAV Total:** **$99,750.00** | **PoR Ratio:** **100.25125%** | **NAV per Share:** **$1.0025125** | **APY:** 12.45%.
- **Saldos Usuario:** USDC = $0.00 | ALPHA = 99,500.00 | stALPHA = 0.00.
- **Tesorería:** Activos = $99,750.00 | Pasivos = $99,500.00 | Solvencia = 🟢 100% Solvente | USDC = $49,875.00 | WBTC = $24,937.50 | WETH = $12,468.75 | P2P Assets = $12,468.75.
- **Staking:** Circulante = 99,500.00 ALPHA | Stake Com. = 0.00 | **Stake Bóvedas = 249.376 stALPHA** | **Total Staked = 249.376 ALPHA** | **Staking Ratio = 0.2506%** | Quemados = 0.00 ALPHA.
- **Command Center:** OpEx Vault = $125.00 | Profit Vault = $125.00 | **Búfer Préstamos = $9,975.00** *(20% de la Sub-Reserva del 50% de USDC)*.

---

### 📍 PASO 2: USUARIO RETAIL SOLICITA FAUCET ($10,000.00 USDC)
- **Mecanismo:** Reclamar Faucet mock de $10,000 USDC.
- **NAV Total:** **$99,750.00** | **PoR Ratio:** **100.25125%** | **NAV per Share:** **$1.0025125**.
- **Saldos Usuario:** USDC = **$10,000.00** | ALPHA = 0.00 | stALPHA = 0.00.
- **Staking:** Circulante = 99,500.00 ALPHA | Stake Bóvedas = 249.376 stALPHA | Total Staked = 249.376 | Staking Ratio = 0.2506%.

---

### 📍 PASO 3: USUARIO DEPOSITA $5,000.00 USDC EN TESORERÍA (BUY ALPHA)
- **Mecanismo:** Depósito $5,000 USDC. Fee 0.50% ($25 USDC ➔ $12.50 Reservas, $6.25 OpEx auto-staked 6.233 ALPHA, $6.25 Profit auto-staked 6.233 ALPHA).
- **Shares Emitidas:** **4,962.5313 ALPHA**.
- **NAV Total:** **$104,737.50** | **PoR Ratio:** **100.26322%** | **NAV per Share:** **$1.0026322** | **APY:** 12.50%.
- **Saldos Usuario:** USDC = **$5,000.00** | ALPHA = **4,962.5313** | stALPHA = 0.00.
- **Tesorería:** Activos = $104,737.50 | Pasivos = $104,462.5313 | Solvencia = 🟢 100% Solvente | USDC = $52,368.75 | WBTC = $26,184.38 | WETH = $13,092.19 | P2P Assets = $13,092.19.
- **Staking:** Circulante = 104,462.5313 ALPHA | Stake Com. = 0.00 | **Stake Bóvedas = 261.842 stALPHA** | **Total Staked = 261.842 ALPHA** | **Staking Ratio = 0.2506%** | Quemados = 0.00 ALPHA.
- **Command Center:** OpEx Vault = $131.25 | Profit Vault = $131.25 | Búfer Préstamos = $10,473.75.

---

### 📍 PASO 4: USUARIO STAKEA 3,000.00 ALPHA EN GOBERNANZA
- **Mecanismo:** Stake 3,000 ALPHA. Fee 1.00% (30 ALPHA ➔ **15 ALPHA Quemados**, 7.5 OpEx auto-staked, 7.5 Profit auto-staked).
- **Recibe:** **2,970.00 stALPHA**.
- **NAV Total:** **$104,737.50** | **PoR Ratio:** **100.27762%** | **NAV per Share:** **$1.0027762** | **APY:** 12.65%.
- **Saldos Usuario:** USDC = $5,000.00 | ALPHA = 1,962.5313 | **stALPHA = 2,970.00**.
- **Tesorería:** Activos = $104,737.50 | Pasivos = 104,447.5313 | Solvencia = 🟢 100% Solvente.
- **Staking:** Circulante = 104,447.5313 ALPHA | **Stake Com. = 2,970.00** | **Stake Bóvedas = 276.842 stALPHA** | **Total Staked = 3,246.842 ALPHA** | **Staking Ratio = 3.1086%** | **Quemados = 15.00 ALPHA**.

---

### 📍 PASO 5: ELIGE PREFERENCIA DE COBRO (OPCIÓN A - DIRECT USDC)
- **Mecanismo:** Configura Payout Preference = Opción A.
- **NAV Total:** **$104,737.50** | **PoR Ratio:** **100.27762%** | **NAV per Share:** **$1.0027762**.
- **Saldos Usuario:** USDC = $5,000.00 | ALPHA = 1,962.5313 | stALPHA = 2,970.00.
- **Staking:** Preferencia = **Opción A (Direct USDC)** | Total Staked = 3,246.842 | Quemados = 15.00 ALPHA.

---

### 📍 PASO 6: COMPRA BONO A (3 AÑOS LOCKUP - $1,000.00 PRINCIPAL)
- **Mecanismo:** Descuento 15.00% ($850 USDC pagados). Devengo lineal $t_0$ (Pasivo Presente Inicial = $850 USD). Mint Fee $12.75 ($6.375 Reservas, $3.1875 OpEx, $3.1875 Profit). NFT #1 emitido (**997.2315 ALPHA** $= 1000 / 1.0027762$).
- **NAV Total:** **$105,581.125** | **PoR Ratio:** **100.1124%** | **NAV per Share:** **$1.001124** | **APY:** 12.80%.
- **Saldos Usuario:** USDC = **$4,150.00** | stALPHA = 2,970.00 | **NFTs = 1 (NFT #1)**.
- **Tesorería:** Activos = $105,581.125 | Pasivos = $105,297.5313 | Solvencia = 🟢 100.11% Solvente | USDC = $52,790.56 | WBTC = $26,395.28 | WETH = $13,197.64 | P2P Assets = $13,197.64.
- **Staking:** Stake Com. = 2,970.00 | **Stake Bóvedas = 283.142 stALPHA** | **Total Staked = 3,253.142 ALPHA** | **Staking Ratio = 3.1146%** | Quemados = 15.00 ALPHA.
- **Bonos:** Descuento = 15.00% | Precio Pagado = $850.00 | Total NFTs = 1 | Pasivo Presente Inicial = $850.00.

---

### 📍 PASO 7: COMPRA BONO B (1 AÑO LOCKUP - $1,000.00 PRINCIPAL)
- **Mecanismo:** Descuento 5.00% ($950 USDC pagados). Devengo lineal $t_0$ (Pasivo Presente Inicial = $950 USD). Mint Fee $14.25 ($7.125 Reservas, $3.5625 OpEx, $3.5625 Profit). NFT #2 emitido (997.2315 ALPHA).
- **NAV Total:** **$106,524.00** | **PoR Ratio:** **100.2215%** | **NAV per Share:** **$1.002215** | **APY:** 13.05%.
- **Saldos Usuario:** USDC = **$3,200.00** | stALPHA = 2,970.00 | **NFTs = 2 (NFT #1, NFT #2)**.
- **Tesorería:** Activos = $106,524.00 | Pasivos = $106,247.5313 | Solvencia = 🟢 100.22% Solvente | USDC = $53,262.00 | WBTC = $26,631.00 | WETH = $13,315.50 | P2P Assets = $13,315.50.
- **Staking:** Stake Com. = 2,970.00 | **Stake Bóvedas = 290.122 stALPHA** | **Total Staked = 3,260.122 ALPHA** | **Staking Ratio = 3.1213%** | Quemados = 15.00 ALPHA.
- **Bonos:** Descuento = 5.00% | Precio Pagado = $950.00 | Total NFTs = 2 | Pasivo Presente Acumulado = $1,800.00.

---

### 📍 PASOS 8 Y 9: CREAR Y CANCELAR OFERTA P2P CON NFT #2
- **Mecanismo:** Publicación y cancelación de oferta P2P.
- **NAV Total:** **$106,524.00** | **PoR Ratio:** **100.2215%** | **NAV per Share:** **$1.002215**.
- **Saldos Usuario:** USDC = $3,200.00 | NFTs = 2 (NFT #1, NFT #2).
- **Staking:** Total Staked = 3,260.122 ALPHA | Quemados = 15.00 ALPHA.

---

### 📍 PASO 10: FINANCIA PRÉSTAMO P2P DE UN TERCERO ($500.00 USDC)
- **Mecanismo:** Financiamiento P2P a tercero. Paga $500 USDC. Derechobienamiento P2P suma $500.
- **Segregación:** El colateral NFT del tercero en Escrow ($700 USD) **permanece segregado** en `P2PLendingMarket.sol` y NO se suma a `por-assets-usd` de la tesorería propia.
- **NAV Total:** **$106,524.00** | **PoR Ratio:** **100.2215%** | **NAV per Share:** **$1.002215**.
- **Saldos Usuario:** USDC = **$2,700.00** | NFTs = 2 | Derechobienamiento P2P = **$500.00**.
- **P2P:** Préstamos Financiados = 1 | Escrow P2P (Segregado) = $700.00 | Préstamos Concedidos = $500.00.

---

### 📍 PASO 11: SOLICITA PRÉSTAMO A TESORERÍA ($300.00 USDC CONTRA NFT #1)
- **Mecanismo:** Origination Fee $1.50 ($0.75 Reservas). Disbursa $298.50. Cuentas por cobrar suma +$300.00.
- **NAV Total:** **$106,524.76** | **PoR Ratio:** **100.2222%** | **NAV per Share:** **$1.002222**.
- **Saldos Usuario:** USDC = **$2,998.50** | Posiciones NFT = **1 (NFT #2 en mano, NFT #1 en Escrow Tesorería)**.
- **Tesorería:** Activos = $106,524.76 | Pasivos = $106,247.5313 | Solvencia = 🟢 100.22% Solvente.

---

### 📍 PASO 12: REPAGA PRÉSTAMO A TESORERÍA ($300.00 USDC + $2.46 INTERÉS)
- **Mecanismo:** Repago $302.46. Spread 10% ($0.246 ➔ $0.123 Reservas, **+$0.0615 USD OpEx Vault**, **+$0.0615 USD Profit Vault**). Recupera NFT #1.
- **NAV Total:** **$106,528.833** | **PoR Ratio:** **100.2260%** | **NAV per Share:** **$1.002260**.
- **Saldos Usuario:** USDC = **$2,696.04** | Posiciones NFT = **2 (NFT #1, NFT #2)**.
- **Tesorería:** Activos = $106,528.833 | Pasivos = $106,247.5313 | Solvencia = 🟢 100.22% Solvente.

---

### 📍 PASO 13: LIQUIDA PRÉSTAMO P2P INCUMPLIDO DE TERCERO
- **Mecanismo:** Adquiere colateral NFT #3 del deudor por impago.
- **NAV Total:** **$106,528.833** | **PoR Ratio:** **100.2260%** | **NAV per Share:** **$1.002260**.
- **Saldos Usuario:** USDC = $2,696.04 | Posiciones NFT = **3 (NFT #1, NFT #2, NFT #3 liquidado)**.

---

### 📍 PASO 14: RAGEQUIT DEL NFT #2 (BONO 1 AÑO - PAGÓ $950.00 USDC)
- **Mecanismo:** Cancelación NFT #2. Penalización 15% ($142.50 ➔ $71.25 Reservas, $35.625 OpEx, $35.625 Profit auto-swapped 69.14 ALPHA). Reembolso: $807.50 USDC. **Quema de 997.23 ALPHA del NFT #2**.
- **NAV Total:** **$106,600.083** | **PoR Ratio:** **101.2785%** | **NAV per Share:** **$1.012785** | **APY:** 13.50%.
- **Saldos Usuario:** USDC = **$3,503.54** | stALPHA = 2,970.00 | Posiciones NFT = **2 (NFT #1, NFT #3)**.
- **Tesorería:** Activos = $106,600.083 | Pasivos = $105,250.3113 | Solvencia = 🟢 101.28% Solvente.
- **Staking:** Circulante = 105,250.3113 ALPHA | Stake Com. = 2,970.00 | **Stake Bóvedas = 359.262 stALPHA** | **Total Staked = 3,329.262 ALPHA** | **Staking Ratio = 3.1631%** | **Quemados = 1,012.23 ALPHA**.
- **Bonos:** Total NFTs = 2 | Pasivo Presente = $850.00 | Penalización = $142.50 | Reembolso = $807.50.

---

### 📍 PASO 15: RECLAMO YIELD + UNSTAKE + RESCATE FINAL EN TESORERÍA (REDEEM)
- **Mecanismo:**
  1. Reclama **$45.00 USDC** de dividendos (`handleClaimYield`).
  2. Retira sus **2,970.00 stALPHA** de Staking (recibe 2,970.00 ALPHA).
  3. Rescata sus **4,962.5313 ALPHA** en Tesorería al NAV de **$1.012785**: Exit Fee 1.00% ($51.136 USD ➔ $25.568 Reservas, **+$12.784 OpEx**, **+$12.784 Profit**). Recibe **$5,062.49 USDC**.
- **NAV Total:** **$101,537.593** | **PoR Ratio:** **103.09664%** | **NAV per Share:** **$1.0309664** | **APY:** 13.55%.
- **Saldos Usuario Final:** USDC = **$8,611.03** | ALPHA = 0.00 | stALPHA = 0.00 | Posiciones NFT = **2 (NFT #1, NFT #3)**.
- **Tesorería:** Activos = $101,537.593 | Pasivos = 98,487.78 | Solvencia = 🟢 103.10% Solvente.
- **Staking:** Circulante = **98,487.78 ALPHA** | Stake Com. = 0.00 | **Stake Bóvedas = 371.83 ALPHA** | Total Staked = **371.83 ALPHA** | Staking Ratio = **0.3775%** | **Quemados = 1,012.23 ALPHA**.
- **Command Center:** **OpEx Vault = $199.6295** | **Profit Vault = $199.6295** | Búfer Préstamos = $10,153.75.
