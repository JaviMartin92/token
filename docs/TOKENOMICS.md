# Alpha Centauri V6 — Tokenómica & Modelo Económico Financiero

**Versión:** 6.0.0-Mainnet  
**Clasificación:** Grado Financiero Auditado  

---

## 1. Distribución Protocolar de Comisiones

El motor financiero de Alpha Centauri V6 opera bajo una regla de reparto estricta e inalterable aplicada a todas las comisiones generadas por transacciones, rendimientos de arbitraje y compras de bonos:

```mermaid
pie title Reparto de Comisiones Protocolarias
    "50% Tesorería Protocolar (Reacumulación)" : 50
    "25% Gastos Operativos (OpEx)" : 25
    "25% Revenue Corporativo (Empresa)" : 25
```

### 1.1. Asignaciones Específicas
- **$50\%$ Tesorería Protocolar**: Se inyecta directamente a la reserva colateral de la Tesorería para incrementar el Net Asset Value ($NAV$) global por cada token ALPHA.
- **$25\%$ Gastos Operativos (OpEx)**: Financia los costos de infraestructura, gas relayer para claims gasless, nodos oráculo Chainlink y mantenimiento de servidores.
- **$25\%$ Revenue Corporativo**: Retorno distribuido a los fundadores y tesorería corporativa de la entidad emisora.

---

## 2. Matriz de Asignación de Activos (Asset Allocation Target)

La reserva del protocolo no mantiene un único activo, sino un portafolio equilibrado con rebalanceo automático gestionado por la gobernanza:

| Activo | Símbolo | Tipo de Activo | Peso Objetivo (*Target Weight*) | Función Financiera |
| :--- | :--- | :--- | :--- | :--- |
| **Stablecoins** | `USDC / EURC` | Reserva Líquida | **$50.0\%$** | Cobertura contra volatilidad y liquidez inmediata para rescates NAV. |
| **Wrapped Bitcoin** | `WBTC` | Activo Macro | **$25.0\%$** | Crecimiento patrimonial a largo plazo y apreciación del colateral. |
| **Wrapped Ethereum** | `WETH` | Liquid Staking | **$12.5\%$** | Generación de staking yield pasivo sobre Ethereum. |
| **ALPHA Staking** | `ALPHA` | Gobernanza Native | **$12.5\%$** | Bloqueo nativo en pool de gobernanza para sostener la demanda del token. |

### 2.1. Invariante de Rebalanceo
$$\sum_{i=1}^{4} Weight_i = 5000_{bps} + 2500_{bps} + 1250_{bps} + 1250_{bps} = 10,000_{bps} \quad (100.0\%)$$

---

## 3. Curva de Descuento de Bonos Vestados (*Vested Bonds*)

Los usuarios pueden adquirir bonos vestados depositando USDC en `VestedDiscountVault.sol`. A cambio de bloquear su liquidez por un período determinado, reciben un descuento sobre el valor NAV del token ALPHA:

```mermaid
gantt
    title Períodos de Vesting y Descuentos Dinámicos
    dateFormat  X
    axisFormat %s
    section Bono a 3 Años
    Bloqueo de Principal (15% Descuento) : active, 0, 3
    Desbloqueo de Principal 100% : milestone, 3, 3
    section Bono a 5 Años
    Bloqueo de Principal (20% Descuento) : active, 0, 5
    Desbloqueo de Principal 100% : milestone, 5, 5
```

### 3.1. Fórmulas de Adquisición
- **Bono 3 Años ($15\%$ Descuento)**:
  $$Tokens_{Minted} = \frac{Principal_{USDC}}{NAV \times (1 - 0.15)} = \frac{Principal_{USDC}}{NAV \times 0.85}$$
- **Bono 5 Años ($20\%$ Descuento)**:
  $$Tokens_{Minted} = \frac{Principal_{USDC}}{NAV \times (1 - 0.20)} = \frac{Principal_{USDC}}{NAV \times 0.80}$$

---

## 4. Mecanismo de Desintegración Anticipada (*Ragequit*)

Si un titular de un NFT de Posición de Bono necesita liquidez inmediata antes del vencimiento del bloqueo, el protocolo le permite ejecutar un **Ragequit** en `VestedDiscountVault.sol`.

### 4.1. Penalización Fija del 30%
Al ejecutar el Ragequit, el sistema aplica una penalización incondicional del **$30\%$ sobre el capital nominal depositado**:

$$\text{Retorno Usuario} = Principal \times 70\%$$

$$\text{Monto Penalización} = Principal \times 30\%$$

### 4.2. Distribución de la Penalización del 30%
La penalización cobrada se divide automáticamente en tres fracciones equitativas:

```mermaid
graph LR
    Penalty[30% Penalización Ragequit] -->|50% (15% del total)| Treasury[Tesorería Protocolar]
    Penalty -->|25% (7.5% del total)| Stakers[Governance Staking Pool]
    Penalty -->|25% (7.5% del total)| Burn[Burn Address (Deflación)]
```

1. **$50\%$ de la Penalización ($15\%$ del Principal)**: Inyectado a la Tesorería para incrementar el NAV de todos los holders restantes.
2. **$25\%$ de la Penalización ($7.5\%$ del Principal)**: Transferido a `GovernanceStaking.sol` como dividendo instantáneo para los stakers de ALPHA.
3. **$25\%$ de la Penalización ($7.5\%$ del Principal)**: Enviado a la dirección de quemado (`0x0000...dead`) reduciendo el suministro circulante de ALPHA.
