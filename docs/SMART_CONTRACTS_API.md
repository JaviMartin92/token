# Alpha Centauri V6 — Referencia de API & Contratos Inteligentes

**Versión:** 6.0.0-Mainnet  
**Licencia:** MIT  

---

## 1. `Treasury.sol` & `TreasuryProxy.sol`

El contrato núcleo del protocolo encargada de custodiar colateral, calcular el valor NAV y acuñar/quemar participaciones de ALPHA.

### 1.1. Funciones Principales

#### `deposit(uint256 amount) external returns (uint256 shares)`
Sustrae USDC del usuario, verifica que `CircuitBreaker.isFrozen(USDC) == false`, inyecta el colateral a las reservas y acuña participaciones ALPHA a valor NAV.
- **Parámetros:** `amount` (monto en unidades base wei de 18 decimales).
- **Retorno:** `shares` (monto de tokens ALPHA acuñados).
- **Eventos:** `Deposit(address indexed user, uint256 amount, uint256 shares)`.

#### `redeem(uint256 shares) external returns (uint256 amount)`
Quema participaciones ALPHA del usuario y transfiere el monto equivalente en USDC a valor NAV actual.
- **Parámetros:** `shares` (monto de participaciones a quemar).
- **Retorno:** `amount` (USDC reembolsado al usuario).

#### `getProofOfReserves() external view returns (uint256 totalAssetsUSD, uint256 totalLiabilitiesUSD, uint256 collateralRatioBps)`
Retorna la auditoría en tiempo real del estado de solvencia de la Tesorería.
- **Retorno:** 
  - `totalAssetsUSD`: Valor total de los activos en dólares con 18 decimales.
  - `totalLiabilitiesUSD`: Valor total de los pasivos emitidos en dólares.
  - `collateralRatioBps`: Ratio de colateralización en puntos básicos ($10,000 = 100\%$).

---

## 2. `VestedDiscountVault.sol` & `VaultPositionNFT.sol`

Gestión de la emisión de bonos vestados a 3 y 5 años respaldados por NFTs ERC-721 colateralizables.

### 2.1. Funciones Principales

#### `buyVestedBond(uint256 principal, uint256 lockYears, address referrer) external returns (uint256 tokenId)`
Emite un bono vestado, adquiere el colateral y acuña un NFT en `VaultPositionNFT.sol`.
- **Parámetros:**
  - `principal`: Monto en USDC a invertir.
  - `lockYears`: Duración del bloqueo (3 o 5 años).
  - `referrer`: Dirección opcional para comisión de referido.
- **Retorno:** `tokenId` (Identificador del NFT ERC-721 acuñado).

#### `claimMatured(uint256 tokenId) external`
Permite al propietario del NFT reclamar el $100\%$ de su principal una vez cumplida la fecha de expiración.

#### `ragequit(uint256 tokenId) external`
Ejecuta la salida anticipada aplicando la penalización del $30\%$ sobre el principal.

---

## 3. `P2PLendingMarket.sol`

Mercado de préstamos peer-to-peer descentralizado sin custodia directa de terceros.

### 3.1. Funciones Principales

#### `createLoanOffer(uint256 tokenId, uint256 borrowAmount, uint256 interestBps, uint256 durationDays) external returns (uint256 loanId)`
Deposita un NFT de Posición como colateral y abre una solicitud de préstamo en el mercado.

#### `acceptLoanAndDepositCollateral(uint256 loanId, uint256 collateralUSDC) external`
Financia un préstamo aceptando la oferta y depositando colateral secundario en USDC.

#### `repayLoan(uint256 loanId) external`
El prestatario liquida la deuda principal más intereses, recuperando su NFT colateral.

#### `liquidateLoan(uint256 loanId) external`
Si un préstamo sobrepasa la fecha de vencimiento sin ser reembolsado, el prestamista puede ejecutar la auto-liquidación y reclamar el propiedad del NFT colateral.

---

## 4. `GovernanceStaking.sol` & `RealYieldRouter.sol`

Módulo de participación en gobernanza y enrutamiento inteligente de dividendos real yield.

### 4.1. Funciones Principales

#### `stake(uint256 amount) external`
Bloquea tokens ALPHA en el contrato de staking para acumular peso de voto y derechos de dividendo.

#### `claimRealYield() external`
Enruta los dividendos acumulados a través de `RealYieldRouter.sol` según la preferencia configurada por el usuario:
- **Opción 0 (USDC)**: Swapea los rendimientos a USDC sintético de alta liquidez.
- **Opción 1 (WBTC/WETH)**: Distribuye directamente activos de reserva de la Tesorería.

#### `setPayoutPreference(uint8 preference) external`
Configura la opción de cobro preferida del usuario (0 o 1).

---

## 5. `CircuitBreaker.sol` & `TimelockController.sol`

Módulos de seguridad protocolar y gobernanza diferida.

### 5.1. Funciones Principales (`CircuitBreaker.sol`)

#### `isFrozen(address asset) external view returns (boolean)`
Retorna `true` si el activo dado ha sido congelado por volatilidad o intervención administrativa.

#### `checkAssetDeviation(address asset) external returns (boolean triggered)`
Revisa la variación del último precio reportado por el oráculo contra el búffer circular. Si la variación excede el umbral, congela el activo.

#### `resetBreaker(address asset) external`
Función exclusiva de gobernanza para reactivar la operativa de un activo congelado.
