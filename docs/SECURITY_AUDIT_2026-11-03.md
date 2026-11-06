# Auditoría técnica integral — Alpha Centauri

**Fecha:** 2026-11-03
**Rama auditada:** `desarrollo` @ `843f277`
**Alcance:** `contracts/src` (superficie principal), `contracts/script/DeployMainnet.s.sol`, `services/core`, `frontend`
**Rol:** ingeniería lead / responsable de la plataforma
**Estado:** análisis estático + ejecución de la suite Foundry existente. No se han modificado contratos.

---

## 1. Resumen ejecutivo

La base de código está bien estructurada, con separación de librerías, roles y control de acceso
consistente. Sin embargo, **el proyecto no está en condiciones de ir a mainnet**: existen cuatro
problemas que rompen supuestos centrales del producto (KYC, contabilidad de pasivos, crédito de
tesorería y traspaso de privilegios), y el script de despliegue de producción no reproduce el
estado que sí construye el entorno sandbox.

Los tres riesgos que más me preocupan, por orden:

1. **`redeemFor` permite a cualquier holder no verificado retirar USDC** pasando como
   `beneficiary` una dirección whitelisteada. El control KYC —que es la premisa regulatoria del
   protocolo— queda anulado por completo.
2. **Los bonos descuentan pero no devengan el pasivo.** Se registra como obligación el precio
   pagado, no el principal que se paga al vencimiento. El NAV queda sobreestimado y el último
   inversor en salir paga el interés de todos.
3. **El crédito de tesorería no tiene tope agregado** y está colateralizado, en parte, con activos
   cuyo valor depende de la propia tesorería (NFTs de bono y ALPHA). Es riesgo circular y reflexivo.

Además, el despliegue de mainnet deja al EOA del despliegador con `KEEPER_ROLE` en el motor de
buyback y como admin del gateway y del vault de fundadores; nunca registra el vault de fundadores
en el `ProtocolAddressProvider`, nunca mintea su reserva y no aplica el TVL cap de lanzamiento.

**Veredicto:** NO-GO para mainnet. Sí para testnet con usuarios internos, tras cerrar C-01…C-04.

---

## 2. Alcance y método

| Actividad | Resultado |
|---|---|
| Revisión manual de contratos core, librerías, adaptadores, scripts y servicios | Completada |
| Ejecución de la suite Foundry (Docker `ghcr.io/foundry-rs/foundry:latest`) | **52 tests, 0 fallos, 11 suites** |
| Cobertura real vs. documentada | README declara 150+; la suite ejecuta 52 |
| Fuzzing / invariants / simbolismo | No existe campaña de invariants ni fuzzing configurado |
| Revisión de frontend/backend | Completada (config, guards, indexer, watchdog) |
| Test de integración end-to-end contra fork de Arbitrum | No ejecutado en esta auditoría |

> Nota operativa: `forge` en el PATH del equipo es `electron-forge`, no Foundry. Todos los comandos
> de contratos deben ejecutarse vía Docker o con el binario correcto para evitar falsos positivos.

---

## 3. Tabla de hallazgos

| ID | Severidad | Título | Ubicación |
|---|---|---|---|
| C-01 | Crítica | Bypass de KYC en `redeemFor` | `TreasuryManager.sol:564-597` |
| C-02 | Crítica | Pasivo de bonos no devenga interés | `VestedDiscountVault.sol:246,252,369,378` |
| C-03 | Crítica | Crédito de tesorería sin tope agregado + colateral circular | `P2PLendingMarket.sol:302`, `TreasuryManager.sol:724` |
| C-04 | Crítica | Mainnet deja roles privilegiados en el EOA del deployer | `DeployMainnet.s.sol:313-318` |
| H-01 | Alta | Vault de fundadores no cableado, no financiado, no registrado | `DeployMainnet.s.sol:230-236` |
| H-02 | Alta | TVL cap de lanzamiento ($100K) nunca se aplica | `TreasuryManager.sol:143` / script |
| H-03 | Alta | Circuit breaker sin llamadores: el freeze automático no existe | `CircuitBreaker.sol` |
| H-04 | Alta | Health factor cae a cantidades brutas si falla el oráculo | `P2PLendingMarket.sol:610-626` |
| H-05 | Alta | Equity del prestatario queda permanentemente irretirable | `P2PLendingMarket.sol:805,848` vs `860` |
| H-06 | Alta | `routeUniversalFee` enruta tokens no-USDC a un vault que solo acepta USDC | `RealYieldRouter.sol` / `CommunityYieldVault.sol:67-69` |
| H-07 | Alta | Período de votación = ~3,5 h en Arbitrum, no 7 días | `GovernorAlphaCentauri.sol:44` |
| H-08 | Alta | `cancel` es griefable por cualquiera | `GovernorAlphaCentauri.sol:276-289` |
| H-09 | Alta | Frontend de producción sirve direcciones de Anvil | `frontend/src/contracts.json` |
| H-10 | Alta | Watchdog de liquidaciones es un stub | `services/core/src/watchdog/LiquidationWatchdog.ts` |
| M-01 | Media | Motor de tokenomics no integrado en el cálculo de fees | `TreasuryFeeLib.sol` |
| M-02 | Media | Rebalanceo por pesos fijos y fee tier hardcodeado | `TreasuryRebalanceLib.sol` |
| M-03 | Media | `claimRewardFor` paga a `msg.sender`, no al beneficiario | `GovernanceStaking.sol` |
| M-04 | Media | Sin feeds secundarios; el grace period del sequencer puede bloquear precios | `OracleHub.sol` |
| M-05 | Media | `ProtocolAddressProvider` sin `ID_GOVERNOR` / `ID_TIMELOCK` / fundadores | `DeployMainnet.s.sol` |
| M-06 | Media | `mintCorporateFeeShares` barre USDC local y mintea al caller | `TreasuryManager.sol:693-719` |
| M-07 | Media | Backend confía en JSON de Redis sin validar y hardcodea el token | `services/core/src/index.ts` |
| M-08 | Media | `emergencyRedeem` permite salir sin KYC (por diseño) sin control de sanciones | `TreasuryManager.sol:634` |
| M-09 | Media | Buyback sin feed de ALPHA configurado → inoperante | `DeployMainnet.s.sol:220` |

---

## 4. Detalle de hallazgos críticos

### C-01 — Bypass del control KYC en `redeemFor`

**Evidencia** — `contracts/src/TreasuryManager.sol:564-597`

```solidity
function redeemFor(address beneficiary, address recipient, uint256 sharesAmount, uint256 minUsdcOut)
    public nonReentrant onlyWhitelisted(beneficiary) ...
{
    ...
    AlphaToken(...).burnFrom(msg.sender, sharesAmount);   // quema las shares del caller
    vault.transferFunds(redemptionToken, recipient, assetsReceived); // paga al recipient
}
```

El modificador valida `beneficiary`, pero las shares que se queman son las de `msg.sender` y el USDC
va a `recipient`. Los tres parámetros son independientes y no se exige ninguna relación entre ellos.

**Ataque:** un holder no verificado llama
`redeemFor(direcciónKYC, miPropiaDirección, balance, 0)`. Pasa el whitelist, quema sus propias
shares y recibe el USDC. El KYC deja de tener efecto económico.

**Impacto:** incumplimiento regulatorio directo (AML/KYC), posible pérdida de licencias y de
acuerdos con custodios; además rompe la segregación entre cuentas verificadas y no verificadas.
`CompliantTreasuryGateway` funciona solo porque ahí `msg.sender == beneficiary == gateway`, lo que
enmascara el fallo en los tests.

**Remediación**
- Exigir `msg.sender == beneficiary` salvo que el caller tenga `COMPLIANCE_ROLE`/sea el gateway.
- Alternativa más limpia: `redeemFor` solo invocable por el gateway, y `redeem` para el flujo
  directo del holder.
- Añadir tests: caller no-KYC con beneficiary KYC debe revertir; caller KYC con recipient distinto
  solo permitido vía gateway.

---

### C-02 — El pasivo de los bonos no devenga y el NAV se sobreestima

**Evidencia** — `contracts/src/VestedDiscountVault.sol`

```solidity
totalPresentObligation += discountedPrice;       // :246  (precio pagado)
bondPresentObligation[tokenId] = discountedPrice; // :252
...
IERC20(stablecoin).safeTransfer(msg.sender, pos.principalAmount); // :369 (principal)
```

`totalPresentLiability()` (:378-381) devuelve la suma de precios descontados, escalada a 18
decimales. Nunca se recalcula ni se devenga el descuento a lo largo del tiempo. Al vencimiento se
pagan `principalAmount`, que es mayor que el pasivo registrado.

**Impacto económico**
- El NAV por share ignora el gasto por intereses: se sobreestima durante toda la vida del bono.
- En el vencimiento hay una caída súbita y no anticipada del NAV, absorbida por quien quede dentro.
- Incentivo a entrar barato y salir antes del vencimiento → dinámica de bank run.
- `_validateSolvency()` (:415-423) solo comprueba `netEquity != 0`; no valida cobertura del pasivo.

**Remediación**
- Registrar el pasivo a valor principal y devengarlo linealmente (o usar un índice de deuda por
  bono), descontando el gasto del NAV de forma continua.
- `totalPresentLiability()` debe devolver obligación devengada, no precio de compra.
- Añadir invariante: `sum(obligaciones devengadas) <= activos elegibles`; test de vencimiento
  múltiple con NAV estable antes/después.

---

### C-03 — Crédito de tesorería sin tope y colateral circular

**Evidencia** — `contracts/src/P2PLendingMarket.sol:302-367` y `TreasuryManager.sol:724-745`

`borrowFromTreasury` solo limita el préstamo por LTV sobre el colateral individual. No existe tope
agregado contra las reservas de la tesorería, ni en el mercado ni en `disburseTreasuryLoan`, que
solo comprueba liquidez disponible. Los documentos del protocolo hablan de un límite del 20 % de
reservas que no está implementado en ninguna parte.

Además el colateral es, en parte, **una claim sobre la propia tesorería**:
- NFTs de bono valorados a `discountedPricePaid` (:318-320, :605-606).
- ALPHA valorado con `getNAVPerShare()` (:612-617), que es el NAV de la tesorería.

Si el NAV cae, cae a la vez el colateral y la liquidez que lo respalda. Es riesgo reflexivo: el
prestamista y el colateral son la misma entidad económica.

**Impacto:** un préstamo grande puede drenar la liquidez de redención; una caída de NAV dispara
liquidaciones de colateral que vale menos precisamente cuando más se necesita.

**Remediación**
- Tope duro: `treasuryLoansOutstanding <= X% de reservas líquidas`, con X gobernado por timelock.
- Excluir ALPHA y NFTs de bono del cómputo de colateral elegible, o aplicar haircuts explícitos y
  un límite de concentración.
- Añadir un presupuesto de liquidez de redención: reservar un buffer mínimo antes de prestar.

---

### C-04 — El deploy de mainnet deja privilegios en el EOA

**Evidencia** — `contracts/script/DeployMainnet.s.sol:313-318`

```solidity
buybackEngine.grantRole(ProtocolRoles.KEEPER_ROLE, address(timelock));
buybackEngine.grantRole(ProtocolRoles.KEEPER_ROLE, deployer);   // ← no se revoca
```

Y en `_deploySecurityAndExtensions`:
- `DiscountBuybackEngine` se construye con `deployer` como admin (:225).
- `FounderReserveVestingVault` con `deployer` como admin **y beneficiario** (:230-235).
- `CompliantTreasuryGateway` con `deployer` como admin (:238-242).

Ninguno de esos tres se transfiere al timelock en `_wirePermissions`. El EOA conserva poder de
mover fondos del gateway, de vesting de fundadores y de ejecutar buybacks.

**Impacto:** contradice el modelo de confianza que se comunica a inversores y auditores; un
compromiso de la clave del deployer es un vector directo de pérdida de fondos.

**Remediación**
- Transferir admin de gateway/founderVault al timelock y renunciar explícitamente.
- Revocar `KEEPER_ROLE` del deployer y dejar solo timelock/keeper operativo.
- Añadir un test post-deploy que recorra todos los contratos y falle si el deployer conserva
  cualquier rol.

---

## 5. Hallazgos altos (resumen y evidencia)

### H-01 — Vault de fundadores no operativo
`DeployMainnet.s.sol:230-236` despliega el vault, pero `_wirePermissions` no lo registra en el
`ProtocolAddressProvider`, no le da rol de minter sobre ALPHA, no lo financia y no mintea la
reserva fundacional. El sandbox (`services/core/src/deploy.ts`) sí lo hace. Resultado: el token
sale a mainnet sin la asignación de fundadores y con getters que devuelven `address(0)`.

### H-02 — TVL cap de lanzamiento no aplicado
`TreasuryManager.sol:143` fija `tvlCap = 50_000_000e18` en `initialize`. El script de mainnet nunca
llama a `setTvlCap`, así que el "guarded launch" de $100K que describe la documentación no existe.

### H-03 — Circuit breaker decorativo
`CircuitBreaker.checkAssetDeviation` no tiene ningún llamador en el protocolo. El freeze automático
no se dispara desde depósitos, redenciones, préstamos ni liquidaciones. Solo funciona si un admin lo
activa manualmente, y en mainnet ese admin es el timelock.

### H-04 — Health factor incorrecto ante fallo de oráculo
`P2PLendingMarket.sol:610-626`: los `catch` asignan `collateralUSD = loan.collateralAmount`, es
decir, unidades crudas del token (6 o 18 decimales) tratadas como USD. Para WBTC esto produce un
health factor artificialmente alto o bajo y retrasa o adelanta liquidaciones de forma arbitraria.
El fallback correcto es revertir o usar el último precio válido con staleness acotado.

### H-05 — Equity del prestatario irretirable
`_liquidateNFTCollateral` acredita `claimableBorrowerEquityAssets[...]` (:805, :848), pero
`claimBorrowerEquity()` lee `claimableBorrowerEquity[msg.sender]` (:860), que nunca se escribe. El
prestatario liquidado solo puede retirar stablecoin vía `claimBorrowerEquityAsset`; el surplus en
otros activos queda bloqueado en el contrato.

### H-06 — Router universal incompatible con el vault comunitario
`RealYieldRouter.routeUniversalFee(token)` es genérico, pero `CommunityYieldVault.depositYield`
siempre hace `stablecoin.safeTransferFrom(...)` (`CommunityYieldVault.sol:69`). Si se enruta WBTC,
WETH o ALPHA, la llamada revierte o los fondos quedan atrapados según el `try/catch` del caller.

### H-07 — Ventana de votación insuficiente en Arbitrum
`GovernorAlphaCentauri.sol:44`: `VOTING_PERIOD = 50400` bloques. En Arbitrum (~0,25 s/bloque) son
~3,5 horas, no los 7 días que indica el comentario. Una governance de timelock de 72 h con 3,5 h de
votación es operativamente insegura.

### H-08 — `cancel` griefable
`GovernorAlphaCentauri.sol:276-289`: cualquiera puede cancelar si el proposer bajó del threshold.
Un atacante puede forzar la salida del proposer (p. ej. moviendo delegaciones) y cancelar
propuestas legítimas en curso.

### H-09 — Frontend con direcciones de sandbox
`frontend/src/contracts.json` contiene direcciones de Anvil (`0xb820…`, `0x1f10…`). El guard
`assert-production-safe.mjs` solo bloquea la clave de Anvil y `VITE_APP_ENV=sandbox`, no el chain ID
ni las direcciones. Un build "de producción" puede apuntar a contratos inexistentes o, peor, a
contratos de prueba.

### H-10 — Watchdog sin implementación real
`LiquidationWatchdog.ts` devuelve hashes de transacción falsos y usa threshold 1.0 frente al 1.15
on-chain. No protege nada; da falsa sensación de monitorización.

---

## 6. Gaps de despliegue (mainnet vs. sandbox)

| Elemento | Sandbox (`deploy.ts`) | Mainnet (`DeployMainnet.s.sol`) |
|---|---|---|
| TVL cap | Configurado | Por defecto $50M |
| Founder vault | Registrado, financiado, minteado | Desplegado y abandonado |
| `ID_GOVERNOR` / `ID_TIMELOCK` | — | No registrados |
| Gateway admin | — | Deployer |
| Founder vault admin | — | Deployer |
| Buyback keeper | — | Deployer + timelock |
| `TreasuryProxy.admin` | Deployer | Timelock ✔ |
| Price feed ALPHA (buyback) | Configurado | Ausente |
| Feeds secundarios de oráculo | — | Ausentes |

Esta divergencia es en sí un hallazgo: **el script de producción no es el artefacto que se prueba**.
La suite pasa porque valida el estado sandbox.

---

## 7. Frontend y backend

- `frontend/src/config/contracts.ts`: carga `contracts.json` estático y hace fallback a
  `address(0)` para direcciones críticas. Sin validación de `chainId` contra el RPC.
- `frontend/src/utils/web3.ts`: no valida que el `chainId` de la wallet coincida con el de los
  contratos desplegados antes de firmar.
- `services/core/src/index.ts`: hardcodea `USDC_TOKEN_MOCK` en asientos del ledger y deserializa
  eventos de Redis sin esquema ni verificación de firma/origen.
- `IdempotentLedger` y `ResilientRpcManager` están bien planteados, pero el ledger no reconcilia
  contra `ProofOfReservesReconciler` de forma automática.
- El `ProofOfReservesReconciler` existe pero no está conectado a alertas ni a un job programado
  verificable en CI.

---

## 8. Cobertura de pruebas

- 52 tests, 0 fallos. Buena base unitaria para treasury, vault, staking y P2P.
- **No hay** tests de invariantes (`invariant_*`), ni fuzzing stateful, ni fork tests de Arbitrum.
- **No hay** tests negativos de compliance (el bypass C-01 pasaría desapercibido).
- **No hay** tests post-deploy que verifiquen el estado de roles ni el cableado del
  `ProtocolAddressProvider`.
- La afirmación de "150+ tests" del README no se sostiene: hay que corregirla o ampliar la suite.

Recomendación: añadir `foundry.toml` con `[invariant] runs = 256, depth = 64` y tres invariantes
mínimos: solvencia (`assets >= liabilities`), conservación de shares y no-regresión del NAV.

---

## 9. Plan de remediación

### PR-1 — Bloqueantes de seguridad (1 semana)
1. C-01: restringir `redeemFor` a gateway/compliance y exigir relación caller-beneficiario.
2. C-02: devengo lineal del pasivo de bonos + `totalPresentLiability` correcto.
3. C-03: tope agregado de crédito y exclusión/haircut de colateral circular.
4. C-04: transferir admin de gateway/founder/buyback al timelock y revocar roles del deployer.
5. Tests negativos de los cuatro puntos + test post-deploy de roles.

### PR-2 — Operatividad de mainnet (1 semana)
6. H-01/H-02/M-05/M-09: cablear founder vault, aplicar TVL cap, registrar governor/timelock,
   configurar feed de ALPHA.
7. H-07/H-08: voting period basado en tiempo o por red, y `cancel` restringido.
8. H-03: conectar `checkAssetDeviation` a los flujos críticos.
9. Test de fork de Arbitrum que ejecute el script completo y valide el estado final.

### PR-3 — Integridad de producto y observabilidad (1–2 semanas)
10. H-04/H-05/H-06: health factor seguro, claim de equity, routing por activo.
11. M-01/M-02: usar `ProtocolTokenomicsEngine` en fees y rebalanceo por drift.
12. H-09/H-10/M-07: guard de producción por chain+addresses, watchdog real, validación de eventos.
13. Invariants + fuzzing + CI con `forge fmt --check`, `forge test`, `tsc` y build de frontend.

---

## 10. Conclusión

El diseño es ambicioso y la ingeniería base es sólida, pero hoy hay **cuatro fallos que invalidan
supuestos del producto**, no solo detalles de implementación. Mi recomendación como responsable de
ingeniería es congelar el despliegue a mainnet, ejecutar PR-1 y PR-2, y no anunciar "producción"
hasta que exista un test de fork que reproduzca el estado final del despliegue y un test post-deploy
que demuestre que ningún EOA conserva privilegios.

Mientras tanto, el sandbox puede seguir usándose para desarrollo, dejando claro en la UI que no es
producción.
