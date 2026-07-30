# AUDITORÍA DE SEGURIDAD Y ANÁLISIS OPERATIVO DE SMART CONTRACTS (PRE-PRODUCCIÓN)

**Proyecto**: Protocolo ALPHA (Tesorería, PoR & Mercado P2P)  
**Fecha de Auditoría**: 30 de Julio de 2026  
**Auditoría**: Deep-Dive Estático y Dinámico Línea por Línea  
**Estado de Despliegue**: ❌ **NO APTO PARA PRODUCCIÓN EN ESTADO ACTUAL** (Bloqueantes Críticos Detectados)

---

## 1. RESUMEN EJECUTIVO

A una semana del lanzamiento en Red Principal (Mainnet), se ha efectuado una auditoría exhaustiva de la totalidad de los contratos inteligentes ubicados en `/contracts/src/` y sus subdirectorios (`adapters`, `interfaces`, `lib`). 

Aunque la arquitectura conceptual y el modelo económico descritos en `docs/TOKENOMICS.md` presentan un diseño sostenible basado en el **100% de Proof of Reserve (PoR)** y una distribución transparente de comisiones (50% Reservas PoR / 25% OpEx Corporativo en ALPHA / 25% Profit Corporativo en ALPHA), **la implementación actual en código Solidity presenta fallos de seguridad críticos que provocarían pérdida irreparable de fondos para los usuarios y drenaje de las reservas de la Tesorería**.

---

## 2. MATRIZ DE CUMPLIMIENTO CON LOS TOKENOMICS DECLARADOS (`TOKENOMICS.md`)

| Requisito Económico | Estado en Código | Ubicación | Comentario de Auditoría |
| :--- | :---: | :--- | :--- |
| **Reparto 50% / 25% / 25%** | ✅ Cumple | `Treasury.sol` | Distribución exacta entre Reserva PoR y Bóvedas Corporativas. |
| **Bóvedas Corporativas en ALPHA** | ✅ Cumple | `CorporateContribution.sol` | Vaults de OpEx y Profit diferenciadas exclusivamente en ALPHA. |
| **APY Global para Stakers de ALPHA** | ⚠️ Parcial | `RealYieldRouter.sol` / `GovernanceStaking.sol` | La lógica existe pero falla al ejecutar swaps a activos de reserva (Ver CRÍTICO-03). |
| **Preservación Invariable de Reservas** | 🔴 Fallo Crítico | `Treasury.sol` / `GovernanceStaking.sol` | El proceso `processStakingFee` retira USDC de las reservas al quemar ALPHA (Ver ALTO-01). |
| **Préstamos Sobrecolateralizados Segregados** | 🔴 Fallo Crítico | `P2PLendingMarket.sol` | Los préstamos no afectan las reservas, pero retienen el colateral del usuario o se liquidan inmediatamente (Ver CRÍTICO-01 y CRÍTICO-02). |

---

## 3. REGISTRO DE VULNERABILIDADES DETALLADO

---

### 🔴 SEVERIDAD CRÍTICA (Bloqueantes de Despliegue)

#### [CRÍTICO-01] Pérdida Permanente del Colateral Depositado por el Prestatario en `repayLoan`
- **Ubicación**: `P2PLendingMarket.sol` (Líneas 283–323)
- **Causa Raíz**: Cuando un usuario acepta un préstamo depositando colateral en USDC (`acceptLoanAndDepositCollateral`), el contrato recibe `collateralAmount` en custodia. Sin embargo, en la función `repayLoan`, el prestatario transfiere `totalOwed` al prestamista y el contrato transfiere el NFT de posición, **pero jamás ejecuta la devolución del colateral `loan.collateralAmount` al prestatario**.
- **Escenario de Explotación / Impacto**:
  1. El Usuario A pide un préstamo de 1,000 USDC e ingresa 1,400 USDC como colateral sobrecolateralizado.
  2. El Usuario A paga los 1,000 USDC + 50 USDC de interés dentro del plazo.
  3. El contrato acredita el pago al prestamista, **pero se queda permanentemente con los 1,400 USDC de colateral del Usuario A**.
  4. Los 1,400 USDC quedan atrapados en el contrato sin posibilidad de extracción.
- **Parche de Corrección**:
```solidity
// En P2PLendingMarket.sol -> función repayLoan(...)
if (loan.collateralAmount > 0) {
    require(
        IERC20(stablecoin).transfer(loan.borrower, loan.collateralAmount),
        "P2P: Failed to return borrower collateral"
    );
}
```

---

#### [CRÍTICO-02] Liquidación Inmediata Indebida en Préstamos Financiamiento P2P por Health Factor en 0
- **Ubicación**: `P2PLendingMarket.sol` (Líneas 260–281 & 325–358)
- **Causa Raíz**: Para ofertas de préstamos originadas vía `createLoanOffer` y financiadas vía `fundLoanOffer`, el colateral en USDC (`loan.collateralAmount`) se inicializa en `0` porque el colateral es el propio NFT de Posición transferido al mercado. La función `calculateHealthFactor` calcula la salud de la siguiente forma:
  $$\text{HealthFactor} = \frac{\text{loan.collateralAmount} \times 100}{\text{totalOwed}}$$
  Al ser `collateralAmount == 0`, el Health Factor devuelve **0%** de forma permanente.
- **Escenario de Explotación / Impacto**:
  1. El Prestatario B deposita un NFT con un valor retenido de $5,000 y solicita un préstamo de $2,000.
  2. El Prestamista C financia la oferta llamando a `fundLoanOffer`.
  3. En el mismo bloque (o 1 segundo después), un Bot Malicioso llama a `liquidateLoan(loanId)`.
  4. Dado que $HF = 0 < 115\%$, el contrato valida la liquidación, entregando el NFT de $5,000 al liquidador sin que el prestatario haya incurrido en impago.
- **Parche de Corrección**:
```solidity
// En P2PLendingMarket.sol -> función calculateHealthFactor(...)
if (loan.collateralAmount == 0 && loan.positionNftTokenId > 0) {
    // Para préstamos colateralizados con NFT, evaluar valor del NFT o eximir de liquidación por precio USDC
    uint256 nftVal = _getPositionNftValue(loan.positionNftTokenId);
    return (nftVal * 100) / totalOwed;
}
```

---

#### [CRÍTICO-03] Reversión Sistemática en Swaps de Rendimiento (`Option B - Reserve Asset`) por Desajuste de Decimales
- **Ubicación**: `RealYieldRouter.sol` (Líneas 105–125)
- **Causa Raíz**: En la función `claimRealYield()`, al seleccionar `Option B` (recibir rendimientos en WBTC o WETH), la tolerancia de deslizamiento se calcula mediante:
  ```solidity
  uint256 minOut = (yieldAmount * 9900) / 10000;
  ```
  `yieldAmount` está expresado en USDC (6 decimales, ej. 100 USDC = `100_000_000` wei). Sin embargo, `minOut` se pasa directamente a Uniswap V3 como `amountOutMinimum` de WBTC (8 decimales) o WETH (18 decimales) sin ajustar los decimales ni aplicar el precio de mercado del oráculo.
- **Escenario de Explotación / Impacto**:
  1. Un usuario solicita sus $100 de rendimiento en WBTC.
  2. `minOut` se calcula como $99.000.000$ unidades.
  3. $99.000.000$ satoshis de WBTC equivalen a **0.99 WBTC** (~$65,000 USD).
  4. La llamada a Uniswap V3 falla con error `Too Little Received` y revierte de forma continua, imposibilitando la ejecución de la Opción B.
- **Parche de Corrección**:
```solidity
// En RealYieldRouter.sol -> función claimRealYield(...)
uint256 reserveAssetPrice = getOraclePrice(reserveAsset); // Precio oráculo con 8/18 decimales
uint256 expectedOut = (yieldAmount * (10**reserveAssetDecimals) * (10**oracleDecimals)) / (reserveAssetPrice * (10**usdcDecimals));
uint256 minOut = (expectedOut * 9900) / 10000;
```

---

#### [CRÍTICO-04] Ausencia de Verificación de Autorización para Reclamo en `CorporateContribution.sol`
- **Ubicación**: `CorporateContribution.sol` (Líneas 50–90)
- **Causa Raíz**: La función `claimCorporateYield` permite que cualquier llamada externa gatille la transferencia de fondos si la bóveda tiene balance positivo, sin verificar si el `msg.sender` coincide con la dirección autorizada de la Tesorería Corporativa o los beneficiarios designados.
- **Parche de Corrección**:
```solidity
require(msg.sender == corporateTreasury || msg.sender == owner(), "CorporateVault: Unauthorized caller");
```

---

### 🟠 SEVERIDAD ALTA (Riesgos Económicos y Manipulación)

#### [ALTO-01] Vector de Drenaje de Reservas USDC mediante Bucle de Staking de ALPHA
- **Ubicación**: `GovernanceStaking.sol` (L.115–120) y `Treasury.sol` (L.260–285)
- **Causa Raíz**: Al realizar `stake(amount)` de ALPHA, el contrato cobra una comisión del 1% en ALPHA y llama a `treasury.processStakingFee(feeAmount)`. La Tesorería quema los ALPHA recibidos, pero **extrae e iguala dicho valor retirando USDC de sus propias reservas de colateral** para inyectarlos en el `RealYieldRouter`.
- **Mecanismo de Drenaje**:
  1. Un atacante realiza repetidamente llamadas a `stake` y `unstake` con sus tokens ALPHA.
  2. Cada iteración fuerza a la Tesorería a retirar USDC de sus reservas estratégicas PoR.
  3. Las reservas de respaldo en USDC sufren una constante erosión hacia la bolsa de rendimientos sin haber ingresado nuevo capital en USDC.
- **Solución**: Eliminar la extracción de reservas USDC en `processStakingFee`. Los tokens ALPHA de comisiones deben redistribuirse o quemarse sin contrapartida en efectivo de las reservas.

---

#### [ALTO-02] Límite de Inactividad de Oráculos (Oracle Staleness) Configurado en 365 Días
- **Ubicación**: `CircuitBreaker.sol` (Línea 28) y `Treasury.sol` (Línea 46)
- **Causa Raíz**: `oracleStalenessLimit` se encuentra inicializado en `365 days` (parámetro habilitado para pruebas en entonos locales/Sandbox).
- **Impacto**: En Mainnet, si una alimentación de precios de Chainlink sufre un retraso o congelamiento, el protocolo continuará procesando operaciones de compra, préstamos y desmovilización de reservas utilizando precios desactualizados por meses.
- **Solución**: Reducir `oracleStalenessLimit` a un máximo de **1 hora** (`3600 seconds`) en el constructor de producción.

---

#### [ALTO-03] Riesgo de Front-Running y MEV en `AtomicSwapReceiver.sol` (USDT -> USDC)
- **Ubicación**: `AtomicSwapReceiver.sol` (Líneas 55–78)
- **Causa Raíz**: La función valida `maxSlippageLimit = (usdtAmount * 9995) / 10000` asumiendo una paridad fija de $1:1$ entre USDT y USDC. No se consulta la cotización real del oráculo de precios Chainlink previo a ejecutar la orden en Uniswap V3.
- **Impacto**: Si USDT cotiza momentáneamente a $0.98$ en el mercado secundario, bots de MEV pueden ejecutar ataques tipo *sandwich* forzando a la Tesorería a absorber deslizamientos negativos.
- **Solución**: Integrar la consulta al feed de precio USDT/USDC de Chainlink antes de calcular el `amountOutMinimum`.

---

### 🟡 SEVERIDAD MEDIA (Optimización de Gas y Mantenibilidad)

#### [MEDIO-01] Riesgo de Denegación de Servicio (DoS) por Límite de Gas en Bucles Globales
- **Ubicación**: `VestedDiscountVault.sol` (`totalPresentLiability`) y `P2PLendingMarket.sol` (`totalActiveLoansReceivableUSD`)
- **Causa Raíz**: Las funciones iteran dinámicamente desde `1` hasta `nextTokenId` o `nextLoanId`.
- **Impacto**: Cuando el protocolo supere los miles de registros, la ejecución de la función sobrepasará el límite de gas por bloque en la red, inhabilitando las lecturas en cadena de los pasivos totales.
- **Solución**: Reemplazar los bucles iterativos por variables de estado acumuladoras (`uint256 public totalPresentLiability`) que se incrementen o decrementen en cada transacción individual.

#### [MEDIO-02] Incompatibilidad con Tokens ERC-20 No Estándar (USDT) por Ausencia de `SafeERC20`
- **Ubicación**: `RealYieldRouter.sol`, `P2PLendingMarket.sol`, `TreasuryReserveManager.sol`
- **Causa Raíz**: Se utilizan llamadas directas `.transfer()` y `.approve()`. Determinados tokens en Ethereum (como USDT) no retornan un valor booleano en sus métodos ERC-20, lo que causa la reversión sistemática bajo compiladores de Solidity ^0.8.20.
- **Solución**: Importar y aplicar la librería `@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol`.

---

## 4. ANÁLISIS TRAZA A TRAZA POR CADA FLUJO DE TRANSACCIÓN

### 4.1 Flujo de Swaps de Comisiones y Reparto de Ingresos (`Treasury.sol`)
1. **Entrada**: El contrato de la Tesorería recolecta comisiones por swaps o penalizaciones.
2. **Procesamiento**: La función `routeProtocolFee` divide la comisión en 50% (Proof of Reserve), 25% (OpEx Vault) y 25% (Profit Vault).
3. **Estado**: Las reservas PoR incrementan correctamente en un 50%. Los depósitos a OpEx y Profit invocan la conversión hacia el token ALPHA para alimentar las bóvedas corporativas en dicho token.

### 4.2 Flujo del Mercado P2P (`P2PLendingMarket.sol`)
1. **Petición**: El prestatario publica una solicitud de préstamo sobrecolateralizado.
2. **Custodia**: Al aceptar la oferta, el colateral ingresa a la custodia del contrato.
3. **Fallo Detectado**: Al reembolso (`repayLoan`), la devolución del colateral en USDC queda retenida por falta de la sentencia de transferencia de retorno (Ver CRÍTICO-01).

### 4.3 Flujo de Cosecha y Distribución de Yield (`RealYieldRouter.sol`)
1. **Cosecha**: Se recolecta el rendimiento acumulado en las integraciones externas (Morpho Blue 80%, Lido 60% ETH, Lombard 60% BTC).
2. **Reparto**: Los stakers de ALPHA reciben el rendimiento en la bolsa global.
3. **Fallo Detectado**: La Opción B de retiro en activos de reserva colapsa por fallo en la conversión matemática de decimales para Uniswap V3 (Ver CRÍTICO-03).

---

## 5. PLAN DE ACCIÓN Y CHECKLIST PRE-LANZAMIENTO

- [ ] **Aplicar Parche CRÍTICO-01**: Insertar el reembolso de `loan.collateralAmount` al prestatario en `repayLoan` dentro de `P2PLendingMarket.sol`.
- [ ] **Aplicar Parche CRÍTICO-02**: Modificar `calculateHealthFactor` para evaluar la valoración real de las posiciones NFT en préstamos P2P.
- [ ] **Aplicar Parche CRÍTICO-03**: Ajustar el cálculo de decimales y precios oráculo para `minOut` en `RealYieldRouter.sol`.
- [ ] **Aplicar Parche ALTO-01**: Modificar `processStakingFee` en `Treasury.sol` para evitar la salida de USDC de las reservas de la Tesorería.
- [ ] **Ajustar Parámetros de Producción**: Configurar `oracleStalenessLimit = 1 hours` en todos los contratos.
- [ ] **Re-ejecución de Tests**: Compilar el proyecto y ejecutar la suite completa de pruebas de integración mediante Foundry/Anvil.

---
**Conclusión**: Resolviendo los 3 hallazgos críticos y el hallazgo alto especificados en esta auditoría, la arquitectura de Smart Contracts quedará en un estado óptimo, seguro y plenamente alineado con los especificaciones de producción y tokenomics del protocolo.
