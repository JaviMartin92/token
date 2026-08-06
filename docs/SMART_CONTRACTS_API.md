# Alpha Centauri V6 — Referencia de API & Contratos Inteligentes

**Versión:** 6.0.0-Mainnet  
**Licencia:** MIT  

---

## 1. `TreasuryManager.sol` & `AlphaVault.sol`

El contrato núcleo del protocolo encargado de custodiar colateral en `AlphaVault`, calcular el valor NAV y acuñar/quemar participaciones de ALPHA.

### 1.1. Funciones Principales

#### `deposit(uint256 stableAmount) external returns (uint256 sharesMinted)`
Sustrae USDC del usuario, calcula la tarifa de deslizamiento dinámico (`calculateDynamicFeeBps`), transfiere los fondos a `AlphaVault` y acuña participaciones ALPHA a valor NAV actual.
- **Parámetros:** `stableAmount` (monto en unidades base USDC de 6 decimales).
- **Retorno:** `sharesMinted` (monto de tokens ALPHA acuñados con 18 decimales).

#### `redeem(uint256 sharesAmount) external returns (uint256 usdcReturned)`
Quema participaciones ALPHA del usuario, aplica el guardián de colateralización `require(postRatio >= preRatio)` y transfiere el monto neto equivalente en USDC a valor NAV.
- **Parámetros:** `sharesAmount` (monto de participaciones a quemar).
- **Retorno:** `usdcReturned` (USDC reembolsado al usuario).

#### `calculateDynamicFeeBps(uint256 grossDepositUSD, uint256 totalAssetsExogenousUSD) public pure returns (uint256 dynamicFeeBps)`
Calcula la tarifa de deslizamiento dinámico anti-MEV acotada entre $50\text{ BPS (0.50\%)}$ y $500\text{ BPS (5.00\%)}$.
- **Fórmula**:
  $$\text{Fee} = 50 + \left( \frac{\text{GrossDepositUSD} \times 10000}{\text{TotalAssetsUSD} + \text{GrossDepositUSD}} \times 500 \right) / 10000$$

#### `getProofOfReserves() public view returns (uint256 totalAssetsUSD, uint256 totalLiabilitiesUSD, uint256 collateralRatioBps)`
Retorna la auditoría en tiempo real del estado de solvencia de la Tesorería sobre activos exógenos puros (USDC, WBTC, WETH).
- **Retorno:**
  - `totalAssetsUSD`: Valor total de los activos exógenos custodios en dólares ($18\text{ decimales}$).
  - `totalLiabilitiesUSD`: Valor total de los pasivos emitidos en dólares.
  - `collateralRatioBps`: Ratio de colateralización en puntos básicos ($10,000 = 100\%$).

#### `getTotalAssetsExogenousUSD() public view returns (uint256)`
Retorna el valor en USD ($18\text{ decimales}$) del total de reservas exógenas puras excluyendo activos endógenos.

#### `getNetCirculatingShares() public view returns (uint256)`
Retorna la oferta neta de shares circulantes en manos de usuarios (deduciendo tokens pertenecientes a la tesorería o bóvedas corporativas).

---

## 2. `ProtocolTokenomicsEngine.sol`

Motor centralizado de cálculo matemático y parámetros tokenómicos.

### 2.1. Funciones Principales

#### `calculateDeposit(uint256 actualDepositedUsdc, bool isRouterCall, uint8 redemptionTokenDecimals) external view`
Calcula comisiones de entrada y escala montos a 18 decimales.

#### `calculateSharesToMint(uint256 depositValueUSD18, uint256 currentSharesSupply, uint256 navBefore18) external pure returns (uint256)`
Calcula la cantidad exacta de shares a emitir manteniendo el NAV no dilutivo.

#### `calculateProofOfReserves(uint256 totalAssetsUSD18, uint256 totalLiabilitiesUSD18) external pure returns (SolvencyResult)`
Valida formalmente si $TotalAssetsUSD \ge TotalLiabilitiesUSD$.

---

## 3. `VestedDiscountVault.sol` & `VaultPositionNFT.sol`

Gestión de la emisión de bonos vestados a 3 y 5 años respaldados por NFTs ERC-721 colateralizables.

### 3.1. Funciones Principales

#### `buyVestedBond(uint256 principal, uint256 lockYears, address referrer) external returns (uint256 tokenId)`
Emite un bono vestado, adquiere el colateral y acuña un NFT en `VaultPositionNFT.sol`.

#### `claimMatured(uint256 tokenId) external`
Permite al propietario del NFT reclamar el $100\%$ de su principal una vez cumplida la fecha de expiración.

#### `ragequit(uint256 tokenId) external`
Ejecuta la salida anticipada aplicando la penalización del $15\%$ sobre el principal.

---

## 4. `P2PLendingMarket.sol`

Mercado de préstamos peer-to-peer descentralizado sin custodia directa de terceros.

### 4.1. Funciones Principales

#### `createLoanOffer(uint256 tokenId, uint256 borrowAmount, uint256 interestBps, uint256 durationDays) external returns (uint256 loanId)`
Deposita un NFT de Posición como colateral y abre una solicitud de préstamo en el mercado.

#### `acceptLoanAndDepositCollateral(uint256 loanId, uint256 collateralUSDC) external`
Financia un préstamo aceptando la oferta y depositando colateral secundario en USDC.

#### `repayLoan(uint256 loanId) external`
El prestatario liquida la deuda principal más intereses, recuperando su NFT colateral.

---

## 5. `GovernanceStaking.sol` & `RealYieldRouter.sol`

Módulo de participación en gobernanza y enrutamiento inteligente de dividendos real yield (50% Tesorería, 25% OpEx Vault, 25% Profit Vault).

---

## 🛡️ 6. Suite de Pruebas de Invariantes (`InstitutionalAuditInvariants.t.sol`)

Contrato de verificación formal e invulnerabilidad en Foundry:
- `testFuzz_CalculateDynamicFeeBps`: Fuzzing de tarifa dinámica ($1\text{ wei} \rightarrow 10^9\text{ tokens}$).
- `test_Invariant_AssetsExceedLiabilities`: Invariante $Assets \ge Liabilities$.
- `test_Invariant_NAVMonotonicity`: Invariante de monotonicidad $NAV_{post} \ge NAV_{pre}$.
- `test_MEVFlashLoanDepositArbitrageRevertOnFullDrain`: Test de reversión anti-MEV.
- `test_MEVFlashLoanDepositArbitrageLossOnPartialRedeem`: Demostración de pérdida neta de capital ($\sim 2.44\%$).
