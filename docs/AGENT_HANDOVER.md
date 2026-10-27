# 🤖 MANUAL INSTITUCIONAL DE TRASPASO TÉCNICO Y OPERACIONES (AGENT HANDOVER)
> **ALPHA CENTAURI PROTOCOL — V6.2.0 (AUDIT-READY / PURE DEFI)**  
> **Destinatario:** Agente de IA o Desarrollador que continúe el proyecto en un nuevo entorno o equipo.

---

## 📑 1. Identificación y Estado del Repositorio

* **Rama Principal de Producción:** `main` (Audited, Stable & Mainnet-Ready).
* **Rama de Trabajo / Desarrollo:** `desarrollo`.
* **Cumplimiento de Calidad Institucional:** **14/14 comprobaciones superadas (100% PASS)** en `npm run quality`.
* **Smart Contracts Auditados:** **26 Smart Contracts** y 4 Librerías matemáticas $O(1)$ con **38/38 tests Foundry superados** (incluyendo el blindaje post-cuántico [`PostQuantumGuard.sol`](../contracts/src/PostQuantumGuard.sol)).
* **Framework de Verificación Autónoma con IA (Qwen3:8B):**
  * **Campaña de Seguridad Red Team (1 Hora):** 73 rondas, 217 llamadas, 0 repetitivas, 186 reverts defendidos, 31 éxitos, invariantes 100% saludables. Diversidad de exploración: **85/100**.
  * **Campaña de Perfiles de Usuario (1 Hora):** 43 rondas, 214 flujos financieros, 176 exitosos (82.2%), 38 protecciones matemáticas (`NoDiscountVsNAV`), invariantes 100% saludables.
* **Estado Génesis del Protocolo:**
  * Suministro Circulante Inicial: **0.00 ALPHA** (Estado 0 Puro).
  * Asignación del Fundador: **100,000.00 ALPHA** bloqueados en [`FounderReserveVestingVault.sol`](../contracts/src/FounderReserveVestingVault.sol) (excluidos del circulante libre).
  * NAV Inicial: **$1.0000 USD / ALPHA**.
  * Solvencia Proof of Reserves (PoR): **100.00%**.
  * Prefondeo Inicial de Sandbox: **10,000.00 USDC** para el usuario y para el admin.

---

## 🛠️ 2. Requisitos Previos del Sistema en el Nuevo Equipo

Para ejecutar el protocolo de manera óptima en una máquina nueva, asegúrate de que el entorno cuente con:

1. **Node.js**: Versión `20.x LTS` o superior (`v20.20.2` recomendada).
2. **Gestor de Paquetes**: `npm` versión `10.x` o superior.
3. **Docker Desktop**:
   * Windows: Docker Desktop con integración WSL2 activa.
   * Linux / macOS: Docker Engine y Docker Compose activos.
4. **Git**: Con acceso de lectura/escritura al repositorio remoto.
5. **Foundry / Forge**:
   * *Opcional*: No es obligatorio tener Foundry instalado localmente en el Host, ya que el script [`start_app.ps1`](../start_app.ps1) ejecuta la compilación y los tests de smart contracts mediante la imagen oficial de Docker: `ghcr.io/foundry-rs/foundry:latest`.
6. **Ollama & Aceleración por GPU (Para Framework de IA Autónomo):**
   * Ollama instalado y accesible en `http://127.0.0.1:11434`.
   * Modelo descargado: `ollama pull qwen3:8b`.
   * GPU recomendada: NVIDIA GeForce RTX (Ampere o Ada Lovelace con Tensor Cores y $\ge 8\text{ GB}$ VRAM).
   * Backend Ollama configurado con soporte CUDA (`num_gpu: 99`) y Flash Attention habilitado.
7. **Puertos del Host Requeridos Libres:**
   * `8545`: Nodo EVM Anvil Blockchain.
   * `5173`: Aplicación Frontend Web3 (Vite).
   * `11434`: Servidor Ollama LLM (opcional para campañas de agentes).
   * `5432`: Base de Datos PostgreSQL de auditoría (opcional para servicios extendidos).

---

## 🚀 3. Guía de Despliegue Rápido Paso a Paso

### Paso 1: Clonar e Instalar Dependencias
```bash
git clone <URL_DEL_REPOSITORIO> token
cd token
npm install
cd frontend && npm install && cd ..
cd services && npm install && cd ..
```

### Paso 2: Configurar Variables de Entorno
El archivo `.env` en la raíz contiene las direcciones dinámicas y claves privadas locales:
```bash
# Si el archivo .env no existe, copiar desde el ejemplo:
cp .env.example .env
```
*(Nota: Al ejecutar `start_app.ps1`, el script regenera y actualiza automáticamente las direcciones de los contratos en `.env` y en `frontend/src/contracts.json`).*

### Paso 3: Despliegue Ultrarrápido a Estado 0 (Un Solo Clic)
En **Windows PowerShell**:
```powershell
.\start_app.ps1
```
O mediante el lanzador batch para Windows:
```cmd
start_app.bat
```

#### ¿Qué ejecuta `start_app.ps1` entre bastidores?
1. **Reset Total de Anvil (Estado 0)**: Destruye el contenedor previo `alpha-anvil` y levanta una instancia limpia de Foundry Anvil en el puerto `8545` (`chain-id: 31337`).
2. **Compilación Solidity en Docker**: Compila todos los smart contracts con `forge build --extra-output-files abi`.
3. **Despliegue Maestro (`services/core/src/deploy.ts`)**:
   - Despliega los 26 smart contracts (Tesorería, Oráculos, Bóvedas, P2P, Staking, Gobernanza, Bonos, Post-Quantum Guard).
   - Despliega `FounderReserveVestingVault` y acuña los 100,000 ALPHA bloqueados.
   - Despliega y registra `PostQuantumGuard` para firmas W-OTS+ y seguridad criptográfica cuántica.
   - Transfiere la administración del Timelock (72h) a la DAO `GovernorAlphaCentauri`.
   - Exporta las direcciones actualizadas a `.env` y `frontend/src/contracts.json`.
4. **Construcción y Servidor Frontend**:
   - Recompila el bundle de Vite con el modo sandbox.
   - Levanta el contenedor `alpha-frontend` en el puerto `5173` con proxy RPC integrado `/rpc`.
5. **Listo para navegar**: Accede en el navegador a **`http://localhost:5173`**.

---

## 🚦 4. Matriz de Pruebas y Quality Gate Institucional

Antes de realizar cualquier commit o modificación estructural, ejecuta los comandos de verificación:

| Comando | Propósito | Resultado Esperado |
| :--- | :--- | :---: |
| `npm run quality` | **Pipeline Completo Quality Gate (14 Comprobaciones)** | **14/14 PASS** |
| `npm run test:contracts:fast` | Tests unitarios e invariantes en Foundry (Docker) | **34/34 PASS** |
| `npm run test:frontend:unit` | Tests unitarios de componentes React y hooks (Vitest) | **21/21 PASS** |
| `npm run test:backend` | Tests de servicios backend, indexador de bloques y reorgs | **44/44 PASS** |
| `npm run test:alignment` | Alineación estricta de ABIs y flujo de depósito on-chain | **26/26 PASS** |
| `npm run test:matrix` | Matriz omni-transaccional de 52 vectores institucionales | **52/52 PASS** |
| `npm run test:personas` | Simulación E2E de 5 personas (inversor, prestatario, bot) | **11/11 PASS** |
| `npm run test:chaos` | Pruebas de estrés anti-MEV y caída de oráculos al 50% | **2/2 PASS** |
| `npm run test:e2e:browser` | Ejecución en Chromium real headless (Playwright) | **7/7 PASS (1.6m)** |
| `npm run campaign` | **Campaña de Seguridad Autónoma Red Team (1 Hora / Qwen3:8B)** | **217 Acciones / Invariantes 100% OK** |
| `npm run campaign:personas` | **Simulación E2E de Perfiles de Usuario Reales (1 Hora / 5 Roles)** | **214 Flujos / 176 Éxitos / Invariantes OK** |
| `npm run campaign:2h` | Campaña de Seguridad Autónoma Extendida (2 Horas) | **Supervisada por Orion** |
| `npm run campaign:3h` | Campaña de Seguridad Autónoma Extendida (3 Horas) | **Supervisada por Orion** |
| `npm run test:ai-fuzzer` | Fuzzer exploratorio de llamadas mutantes con IA | **PASS** |

---

## 🦊 5. Configuración de Carteras Web3 y Mitigación de Nonces

### Parámetros de Red Local
* **Nombre de Red:** `Foundry Anvil Local`
* **RPC URL:** `http://127.0.0.1:8545` (o vía proxy: `http://localhost:5173/rpc`)
* **Chain ID:** `31337`
* **Símbolo de Moneda:** `ETH`

### Cuentas Pre-configuradas (Claves Privadas de Anvil)
* **Billetera 1 (Admin / Deployer):**
  * Dirección: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
  * Private Key: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
* **Billetera 2 (Usuario Inversor):**
  * Dirección: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
  * Private Key: `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`

### ⚠️ Solución al Error de Nonce Desincronizado (Rabby / MetaMask)
Cuando se reinicia Anvil a Estado 0, la cadena vuelve a empezar desde el `nonce = 0`. Sin embargo, carteras como Rabby o MetaMask retienen en memoria el historial previo (ej. esperando `nonce = 27`), mostrando el mensaje *"Nonce #0 omitido en la cadena Foundry. Transacción pendiente"*.

**Cómo resolverlo:**
1. **Solución On-Chain / Código**: En [`frontend/src/utils/web3.ts`](../frontend/src/utils/web3.ts) se utiliza `getFreshNonce(account)` consultando directamente el recuento real de transacciones pendientes en la blockchain:
   ```typescript
   export async function getFreshNonce(address: `0x${string}`) {
     return await publicClient.getTransactionCount({ address, blockTag: 'pending' });
   }
   ```
2. **Solución en la Cartera (UI)**:
   * **Rabby Wallet**: Ir a `Ajustes` -> `Clear Pending Transactions` / `Reset Account Nonce`.
   * **MetaMask**: Ir a `Configuración` -> `Avanzado` -> `Borrar datos de pestañas de actividad y transacciones`.

---

## 🧠 6. Registro de Decisiones de Arquitectura Recientes

Para que comprendas la evolución del código sin necesidad de explorar el historial completo de commits:

### A. Asignación del Fundador en Bóveda Dedicada (`FounderReserveVestingVault.sol`)
* **Decisión:** El fundador recibe 100,000 ALPHA custodiados en una bóveda independiente en lugar de una inyección artificial en reservas.
* **Mecanismo:** La liberación está condicionada matemáticamente a la salud de la Tesorería. Solo se puede reclamar hasta el **10% del superávit de reservas** ($\text{TotalAssetsUSD} - \text{TotalLiabilitiesUSD}$), con un cooldown estricto de **72 horas**.
* **Inmunidad:** Ningún dólar o activo sale de la Tesorería. Solo se transfieren tokens ALPHA propios de la bóveda.
* **Génesis Limpio:** Los 100,000 ALPHA bloqueados se descuentan del circulante en `TreasuryPoRLib.getNetCirculatingShares()`, logrando un Estado 0 con 0.00 ALPHA en circulación libre y $1.0000 de NAV.

### B. Fórmula de NAV por Patrimonio Neto Libre (Net Equity)
* **Decisión:** Los ingresos por compra de bonos vestados (`VestedDiscountVault.sol`) representan una obligación futura de pago (deuda), no patrimonio libre.
* **Implementación:** `TreasuryManager.getNetEquityUSD()` descuenta la deuda exigible antes de calcular el NAV:
  $$\text{NetEquityUSD} = \max\left(0, \text{TotalAssetsUSD} - \text{DebtLiabilitiesUSD}\right)$$
  $$\text{NAVPerShare} = \frac{\text{NetEquityUSD}}{\text{NetCirculatingShares}}$$
* **Beneficio:** Evita que la compra de bonos dispare artificialmente el NAV de ALPHA o desestabilice el mercado de préstamos P2P.

### C. Corrección del Rebalanceo Automático de Tesorería
* En [`TreasuryRebalanceLib.sol`](../contracts/src/lib/TreasuryRebalanceLib.sol), la asignación del 12.5% a la sub-reserva de ALPHA ahora utiliza `navPerShare` on-chain en lugar de dividir erróneamente entre el `totalSupply` global.

### D. Eliminación del Doble Conteo en Staking
* En [`GovernanceStaking.sol`](../contracts/src/GovernanceStaking.sol), `getStakingBreakdown` reporta exactamente `totalStaked = treasuryStaked + communityStaked + communityVaultStaked`, eliminando la duplicidad que inflaba el ratio de staking por encima del 100%.

### E. Orquestación Autónoma con IA y Poda Negativa de Manifiesto (`TeamLeadOrchestrator.ts`)
* **Problema:** Los LLM presentan sesgos cognitivos hacia métodos conocidos (`STAKING::stake`, `ALPHA_TOKEN::permit`), generando bucles de llamadas repetitivas.
* **Solución Implementada:**
  1. *Poda Dinámica Negativa*: Orion elimina del manifiesto ABI inyectado al agente cualquier función que supere el umbral de saturación.
  2. *Priorización de Funciones Vírgenes*: Detecta métodos con 0 ejecuciones y los inyecta proactivamente como directivas de ataque de alta prioridad.
  3. *Aislamiento Génesis por Snapshots*: [`DeFiAgentEnv.ts`](../services/core/src/agents/DeFiAgentEnv.ts) revierte mediante `evm_revert` al snapshot `0x1` entre cada acción, eliminando contaminación de estado y asegurando telemetría limpia.
  4. *Guarda de Escalares vs Tokens*: Inspección de regex (`isCountOrDuration`) para evitar multiplicar por $10^6$ o $10^{18}$ parámetros enteros como años de bloqueo o días de préstamo.

### F. Suite de Simulación de Perfiles de Usuario Reales (`run-user-personas-campaign.ts`)
* **Propósito:** Validar el comportamiento del protocolo ante 5 arquetipos financieros reales:
  - *Elena*: Retail Yield Staker (depósito al NAV, staking y cobro de dividendos).
  - *Marcus*: Institutional Whale (bonos vestados 1-5 años y liquidaciones ragequit).
  - *Sofia*: Prestataria P2P (colateral multi-activo y amortización).
  - *Viktor*: MEV Keeper (recompras con descuento por arbitraje).
  - *Lucas*: Delegado DAO (voto de gobernanza y alineación de recompensas).
* **Validación de Salvaguardas:** Confirmó que el 100% de las 38 denegaciones se debieron al candado `revert NoDiscountVsNAV()`, protegiendo la tesorería de recompras no ventajosas.

---

## 📜 7. Reglas de Oro Obligatorias para el Agente

Al trabajar en este proyecto, sigue de forma estricta las siguientes directivas:

1. 🔒 **REGLA DE PUSH:** **NUNCA** ejecutes `git push` a ninguna rama remota a menos que el usuario lo solicite explícitamente en el mensaje actual.
2. 🔍 **REVISIÓN DE CÓDIGO:** **SIEMPRE** inspecciona los archivos relevantes con las herramientas de lectura de código antes de responder al usuario (`"a partir de ahora revisa el codigo antes de hablar"`).
3. 🛡️ **CALIDAD OBLIGATORIA:** **SIEMPRE** corre los tests (`npm run test:contracts:fast` y `npm run quality`) antes de considerar concluida una tarea de backend o frontend.
4. 🖥️ **FRONTEND LIMPIO:** Toda la lógica matemática pesada debe residir en smart contracts o hooks tipados, nunca dejes cálculos aritméticos ad-hoc duplicados en componentes visuales.
5. 🌐 **ENLACES GITHUB MARKDOWN:** Al referenciar archivos o símbolos en el chat, utiliza enlaces en formato `[archivo.sol](file:///path/to/file)`.

---
*Manual redactado y certificado bajo directivas de Clean Architecture y Pure DeFi.*
