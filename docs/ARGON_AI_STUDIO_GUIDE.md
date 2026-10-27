# 📘 MANUAL DE EJECUCIÓN INSTITUCIONAL EN GOOGLE AI STUDIO (ARGON GUIDE)
> **ALPHA CENTAURI PROTOCOL — V6.2.0 (AUDIT-READY / PURE DEFI)**  
> **Destinatario Principal:** Agente de IA **Argon** (Gemini) en el entorno Cloud Sandbox de **Google AI Studio**.  
> **Propósito:** Proporcionar una guía técnica determinista, exhaustiva y libre de dependencias de Docker o Windows para compilar, desplegar, probar y servir el protocolo en entornos Linux Cloud.

---

## 📑 Índice
1. [Resumen Ejecutivo & Contexto de Argon](#1-resumen-ejecutivo--contexto-de-argon)
2. [Diagnóstico de Fallos Habituales en AI Studio (Las 8 Causas Raíz)](#2-diagnóstico-de-fallos-habituales-en-ai-studio-las-8-causas-raíz)
3. [Arranque Rápido en 1 Solo Comando (One-Click Quickstart)](#3-arranque-rápido-en-1-solo-comando-one-click-quickstart)
4. [Flujo Manual de Ejecución Paso a Paso](#4-flujo-manual-de-ejecución-paso-a-paso)
5. [Configuración de Web Preview y Proxy RPC en AI Studio](#5-configuración-de-web-preview-y-proxy-rpc-en-ai-studio)
6. [Batería de Pruebas Institucionales & Quality Gate (14/14 Checks)](#6-batería-de-pruebas-institucionales--quality-gate-1414-checks)
7. [Framework de Agentes de IA & Simulación de Usuarios](#7-framework-de-agentes-de-ia--simulación-de-usuarios)
8. [Reglas de Oro del Repositorio para Argon](#8-reglas-de-oro-del-repositorio-para-argon)

---

## 🏛️ 1. Resumen Ejecutivo & Contexto de Argon

El **Protocolo Alpha Centauri** es una infraestructura DeFi institucional con 26 Smart Contracts en Solidity, un frontend en React/Vite/Viem, un orquestador de despliegue en TypeScript y un marco de pruebas autónomas con agentes de IA.

En entornos de desarrollo locales en Windows, el proyecto utiliza Docker Desktop (`alpha-anvil` y `alpha-frontend`) y scripts PowerShell (`start_app.ps1`). Sin embargo, **Google AI Studio** opera dentro de contenedores sandbox Linux ligeros y no privilegiados donde:
- **No hay demonio de Docker** (`/var/run/docker.sock` no está disponible).
- **No se pueden ejecutar scripts `.ps1` ni `.bat` de Windows**.
- **Foundry (Anvil/Forge) no viene preinstalado en el PATH**.
- **El acceso a Web Preview requiere binding estricto a `0.0.0.0`**.

Este documento detalla cómo Argon puede superar el 100% de estas restricciones utilizando la infraestructura nativa POSIX Bash provista en el repositorio.

---

## 🔍 2. Diagnóstico de Fallos Habituales en AI Studio (Las 8 Causas Raíz)

A continuación se detallan los 8 errores más frecuentes al abrir el proyecto en Google AI Studio y cómo están resueltos:

### ❌ Causa 1: `Cannot connect to the Docker daemon at unix:///var/run/docker.sock`
* **Por qué ocurre:** Las sandbox de Google Cloud / AI Studio no permiten ejecutar Docker-in-Docker (DinD) por razones de seguridad del hipervisor. Cualquier comando como `docker run` o `docker compose` fallará inmediatamente.
* **Solución:** **No usar Docker.** El protocolo se ejecuta de forma 100% nativa en el host Linux usando binarios locales de Foundry (`anvil` y `forge`) y el servidor estático Node.js [`frontend/server.cjs`](file:///c:/Users/javil/Desktop/token/frontend/server.cjs).

### ❌ Causa 2: `start_app.ps1: command not found` o error de PowerShell
* **Por qué ocurre:** AI Studio ejecuta una shell estándar Bash (`/bin/bash`). Intentar ejecutar scripts de PowerShell (`.ps1`) o ejecutables Batch (`.bat`) genera errores de sintaxis o de intérprete.
* **Solución:** Utilizar exclusivamente el lanzador Bash nativo [`start_app.sh`](file:///c:/Users/javil/Desktop/token/start_app.sh) o ejecutar `npm run start:linux`.

### ❌ Causa 3: `forge: command not found` o `anvil: command not found`
* **Por qué ocurre:** La imagen del contenedor de AI Studio incluye Node.js y Git, pero no Foundry.
* **Solución:** Instalar Foundry en el directorio de usuario (`$HOME/.foundry`) mediante el instalador oficial:
  ```bash
  curl -L https://foundry.paradigm.xyz | bash
  export PATH="$HOME/.foundry/bin:$PATH"
  foundryup
  ```
  *(El script [`start_app.sh`](file:///c:/Users/javil/Desktop/token/start_app.sh) realiza esta comprobación e instalación automáticamente si detecta que Foundry no está en el PATH).*

### ❌ Causa 4: Error `ENOTFOUND host.docker.internal` en llamadas RPC
* **Por qué ocurre:** En Windows con Docker Desktop, `host.docker.internal` resuelve a la máquina anfitriona. En un contenedor nativo de Linux sin Docker, este dominio no existe en `/etc/hosts`, provocando que el proxy de frontend falle al intentar comunicarse con Anvil.
* **Solución:** En [`frontend/server.cjs`](file:///c:/Users/javil/Desktop/token/frontend/server.cjs), la variable `ANVIL_HOST` detecta automáticamente si existe el entorno Docker (`/.dockerenv`). Si no existe, recurre de forma determinista a `127.0.0.1`.

### ❌ Causa 5: Error 502 Bad Gateway / Conexión Rechazada en Web Preview
* **Por qué ocurre:** El sistema de Cloud Web Preview de Google enruta el tráfico HTTP entrante hacia el contenedor. Si el servidor web escucha únicamente en `127.0.0.1` (localhost), el tráfico del proxy inverso es rechazado.
* **Solución:** Tanto el servidor Anvil como [`frontend/server.cjs`](file:///c:/Users/javil/Desktop/token/frontend/server.cjs) escuchan en `0.0.0.0`, permitiendo que el visor web de AI Studio renderice la interfaz inmediatamente.

### ❌ Causa 6: Error `Cannot find module '@prisma/client'` o falta de tipos en `services/`
* **Por qué ocurre:** El ORM Prisma genera sus tipos TypeScript dinámicamente en `node_modules/@prisma/client`. Tras clonar o instalar dependencias, es necesario generar los tipos antes de compilar o verificar TypeScript.
* **Solución:** Ejecutar en el subdirectorio de servicios:
  ```bash
  cd services && npx prisma generate --schema=core/prisma/schema.prisma && cd ..
  ```

### ❌ Causa 7: Ausencia de Extensión Web3 (MetaMask) en el navegador del Sandbox
* **Por qué ocurre:** Los visores embebidos de Google AI Studio son navegadores aislados que carecen de extensiones instaladas. Si la dApp requiere MetaMask obligatoriamente, se queda bloqueada en "Connect Wallet".
* **Solución:** El frontend de Alpha Centauri incluye un **Mock EIP-1193 Integrado** ([`frontend/tests/helpers/eip1193.ts`](file:///c:/Users/javil/Desktop/token/frontend/tests/helpers/eip1193.ts)). El bundle de sandbox (`npm run build:sandbox`) activa automáticamente el modo de demostración con 10,000.00 USDC precargados, permitiendo probar toda la funcionalidad sin extensiones externas.

### ❌ Causa 8: Playwright faltante en Linux Headless (`Executable doesn't exist`)
* **Por qué ocurre:** Playwright requiere binarios de navegador compilados para la arquitectura del sistema operativo.
* **Solución:** Instalar Chromium headless para Linux con sus librerías del sistema:
  ```bash
  npx playwright install --with-deps chromium
  ```

---

## ⚡ 3. Arranque Rápido en 1 Solo Comando (One-Click Quickstart)

Argon puede desplegar el sistema completo ejecutando un único comando en la terminal de AI Studio:

```bash
chmod +x start_app.sh && ./start_app.sh
```

O equivalentemente vía npm:
```bash
npm run start:linux
```

### ¿Qué hace `start_app.sh` automáticamente?
1. **Comprueba dependencias:** Verifica que Node.js (v20+) y npm estén instalados.
2. **Auto-instala Foundry:** Si `anvil` o `forge` no existen en `$PATH` o en `~/.foundry/bin`, ejecuta el instalador oficial y `foundryup`.
3. **Libera puertos:** Detecta y finaliza cualquier proceso residual en los puertos `8545` (EVM) y `5173` (Frontend).
4. **Lanza Anvil en segundo plano:** Inicia el nodo local en `0.0.0.0:8545` con Chain ID `31337` y límite de tamaño de código ampliado a 120,000 bytes.
5. **Genera Prisma Client:** Construye los esquemas de bases de datos de auditoría en `services/`.
6. **Compila Smart Contracts:** Ejecuta `forge build --extra-output-files abi` generando ABIs y bytecodes en `contracts/out`.
7. **Despliega los 26 Smart Contracts:** Ejecuta [`services/core/src/deploy.ts`](file:///c:/Users/javil/Desktop/token/services/core/src/deploy.ts) inicializando la Tesorería, los oráculos, el mercado P2P, los bonos vPOS, el Timelock 72h, acuñando los 100,000 ALPHA bloqueados en `FounderReserveVestingVault` y pre-fondeando 10,000 USDC.
8. **Compila y Sirve el Frontend:** Genera el bundle de producción Web3 y arranca el servidor en `http://0.0.0.0:5173` con proxy RPC `/rpc` transparente hacia Anvil.

---

## 🛠️ 4. Flujo Manual de Ejecución Paso a Paso

Si Argon prefiere ejecutar cada fase individualmente para depuración o introspección detallada:

### Paso 4.1: Instalación de Dependencias
```bash
# 1. Dependencias de la raíz
npm install

# 2. Dependencias del frontend
cd frontend && npm install && cd ..

# 3. Dependencias de servicios y backend
cd services && npm install && cd ..
```

### Paso 4.2: Instalación de Foundry (Forge & Anvil)
```bash
if ! command -v forge >/dev/null 2>&1; then
  curl -L https://foundry.paradigm.xyz | bash
  export PATH="$HOME/.foundry/bin:$PATH"
  foundryup
fi
```

### Paso 4.3: Generación del Cliente Prisma ORM
```bash
cd services
npx prisma generate --schema=core/prisma/schema.prisma
cd ..
```

### Paso 4.4: Iniciar el Nodo Anvil en Segundo Plano
```bash
anvil --host 0.0.0.0 --port 8545 --chain-id 31337 --code-size-limit 120000 > /tmp/anvil.log 2>&1 &
# Verificar que responde:
curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"net_version","params":[],"id":1}' http://127.0.0.1:8545
```

### Paso 4.5: Compilar Smart Contracts
```bash
cd contracts
forge build --extra-output-files abi
cd ..
```

### Paso 4.6: Desplegar a Estado 0 Génesis
```bash
export BACKEND_OPERATOR_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
export ANVIL_URL="http://127.0.0.1:8545"
npx tsx services/core/src/deploy.ts
```

### Paso 4.7: Compilar Frontend y Servir
```bash
cd frontend
npm run build:sandbox
export ANVIL_HOST="127.0.0.1"
node server.cjs
```

---

## 🌐 5. Configuración de Web Preview y Proxy RPC en AI Studio

Google AI Studio proporciona vistas previas web mediante túneles inversos HTTPS. Para que la dApp funcione sin fallos de CORS ni de Mixed Content (HTTPS -> HTTP):

1. **Proxy RPC Integrado (`/rpc`):**
   El navegador del usuario se conecta al frontend vía el puerto `5173`. Todas las llamadas RPC a la blockchain son enviadas a `http://<preview-host>:5173/rpc`, donde [`frontend/server.cjs`](file:///c:/Users/javil/Desktop/token/frontend/server.cjs) actúa como reverse proxy interno reenviando la petición directamente a `http://127.0.0.1:8545`.
2. **Sin Bloqueos de Contenido Mixto:**
   Gracias a `/rpc`, el navegador nunca intenta conectarse directamente al puerto `8545` sobre HTTP no seguro desde un contexto HTTPS.
3. **Persistencia de Estado Génesis:**
   Cada vez que se reinicia Anvil, el protocolo regresa a **Estado 0 Puro** ($0.00 ALPHA en circulación, NAV exacto de $1.0000 USD, 100,000 ALPHA bloqueados en vesting). El servidor static emite cabeceras HTTP `Cache-Control: no-store` para evitar que el navegador almacene en caché estados obsoletos.

---

## 🚦 6. Batería de Pruebas Institucionales & Quality Gate (14/14 Checks)

El proyecto cuenta con un riguroso Quality Gate institucional automatizado en [`scripts/quality-gate.mjs`](file:///c:/Users/javil/Desktop/token/scripts/quality-gate.mjs).

### Ejecución del Quality Gate Completo:
Con Anvil en ejecución y los contratos desplegados:
```bash
npm run quality
```

### Desglose de las 14 Comprobaciones:
| # | Comprobación | Comando | Ámbito |
| :---: | :--- | :--- | :--- |
| **1** | Frontend Strict Typecheck | `cd frontend && npx tsc -b --noEmit` | Cero errores de TypeScript en UI |
| **2** | Backend Services Typecheck | `cd services && npx tsc --noEmit` | Cero errores en servicios y agentes |
| **3** | Frontend Fast Linter | `cd frontend && npm run lint` | Oxlint sin advertencias |
| **4** | Frontend Unit Tests | `npm run test:frontend:unit` | 21/21 pruebas unitarias Vitest |
| **5** | Production Bundle Build | `npm run test:frontend:build` | Compilación Vite sin advertencias |
| **6** | Backend Architecture Tests | `npm run test:backend` | 43/43 pruebas de indexador y keeper |
| **7** | Contract Alignment Test | `npm run test:alignment` | 18/18 comprobaciones de ABIs y métodos |
| **8** | Omni-Transaction Matrix | `npm run test:matrix` | 52/52 vectores de transacción DeFi |
| **9** | E2E Multi-Persona Suite | `npm run test:personas` | 5 perfiles institucionales evaluados |
| **10** | Chaos & Market Shock Stress | `npm run test:chaos` | Pruebas de estrés y reentrancia |
| **11** | Security Audit | `npm audit --audit-level=high` | Cero vulnerabilidades críticas |
| **12** | Solidity Security Linter | `npx solhint "contracts/src/**/*.sol"` | Reglas Solhint cumplidas |
| **13** | Dead Code Scanner | `npx knip` | Cero exports huérfanos o archivos muertos |
| **14** | Browser E2E Matrix | `npm run test:e2e:browser` | 6/6 suites Playwright Chromium |

### Pruebas Nativas de Smart Contracts con Foundry:
En lugar de depender de Docker, Argon puede ejecutar directamente:
```bash
# Ejecutar suite rápida de contratos (excluyendo fuzz pesado):
npm run test:contracts:fast:native

# Ejecutar todos los 38 tests de contratos incluyendo invariantes y blindaje post-cuántico:
npm run test:contracts:native
```

---

## 🤖 7. Framework de Agentes de IA & Simulación de Usuarios

El directorio [`services/core/src/agents/`](file:///c:/Users/javil/Desktop/token/services/core/src/agents/) alberga el marco de auditoría continua con enjambres de IA:

* **Orquestador Principal:** [`TeamLeadOrchestrator.ts`](file:///c:/Users/javil/Desktop/token/services/core/src/agents/TeamLeadOrchestrator.ts) (Orion), dotado de **Poda Negativa de Manifiesto** (erradica bucles de llamadas repetidas) y priorización de funciones vírgenes (cero cobertura previa).
* **Aislamiento por Snapshots:** [`DeFiAgentEnv.ts`](file:///c:/Users/javil/Desktop/token/services/core/src/agents/DeFiAgentEnv.ts) utiliza `anvil_snapshot` y `anvil_revert` para ejecutar cada transacción de prueba en aislamiento atómico sin corromper el estado global.
* **Inferencia Local vs Mock:** Por defecto, los agentes se conectan a un servidor Ollama local en `http://127.0.0.1:11434`. Si en AI Studio no hay servidor Ollama activo, el fuzzer exploratorio [`run-exploratory-fuzzer.ts`](file:///c:/Users/javil/Desktop/token/services/core/src/agents/run-exploratory-fuzzer.ts) puede ejecutarse de forma determinista para probar todas las combinaciones de contratos y funciones.

---

## 🛡️ 8. Reglas de Oro del Repositorio para Argon

Argon **DEBE** adherirse estrictamente a las siguientes directivas institucionales del proyecto:

1. **PROHIBIDO EL GIT PUSH INCONSULTADO (REGLA DE ORO):**
   > [!CAUTION]
   > **NUNCA ejecutes `git push` de forma autónoma o especulativa.**  
   > Solo está permitido ejecutar `git push` si el usuario humano escribe **explícitamente** la palabra `"push"` o autoriza de forma inequívoca el envío al repositorio remoto.
2. **POLÍTICA DE RAMAS:**
   - Todo el trabajo de desarrollo, pruebas y refactorización se realiza sobre la rama **`desarrollo`**.
   - La rama **`main`** es exclusiva de producción y solo recibe código mediante Pull Requests o merges auditados.
3. **HOOK PRE-PUSH OBLIGATORIO:**
   - El hook `.git/hooks/pre-push` ejecuta automáticamente `npm run quality` (14/14 checks) antes de permitir cualquier push. Si un solo check falla, el push será rechazado por Git.
4. **FORMATO DE ENLACES A ARCHIVOS:**
   - Todos los enlaces a archivos del proyecto deben formatearse con enlaces clicables estilo Markdown con prefijo `file:///` (ejemplo: [`README.md`](file:///c:/Users/javil/Desktop/token/README.md)).
5. **ESTADO GÉNESIS LIMPIO:**
   - Al desplegar en Anvil, certificar que el suministro circulante de $ALPHA$ sea exactamente **0.00** y que los 100,000 ALPHA iniciales estén bloqueados en [`FounderReserveVestingVault.sol`](file:///c:/Users/javil/Desktop/token/contracts/src/FounderReserveVestingVault.sol).

---
*Manual verificado y certificado para el entorno Google AI Studio / Argon. Alpha Centauri Protocol Core Engineering.*
