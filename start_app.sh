#!/usr/bin/env bash
# ==============================================================================
# Alpha Centauri Protocol: Native Linux / Cloud Sandbox Launcher (start_app.sh)
# Optimized for Google AI Studio, Argon, GitHub Codespaces & Headless Linux
# ==============================================================================

set -e

# ANSI Color Codes
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}=======================================================${NC}"
echo -e "${CYAN} ALPHA CENTAURI PROTOCOL: LAUNCHER CLOUD / LINUX       ${NC}"
echo -e "${CYAN} Optimizado para AI Studio, Argon y entornos Sandbox  ${NC}"
echo -e "${CYAN}=======================================================${NC}\n"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# 1. Verificar dependencias esenciales
command -v node >/dev/null 2>&1 || {
  echo -e "${RED}[ERROR] Node.js no encontrado. Instala Node.js v20+ LTS.${NC}" >&2
  exit 1
}

# 2. Verificar o instalar Foundry (Anvil + Forge) de manera nativa sin Docker
if ! command -v anvil >/dev/null 2>&1 || ! command -v forge >/dev/null 2>&1; then
  if [ -f "$HOME/.foundry/bin/anvil" ] && [ -f "$HOME/.foundry/bin/forge" ]; then
    export PATH="$HOME/.foundry/bin:$PATH"
  else
    echo -e "${YELLOW}[!] Foundry no detectado en PATH. Instalando Foundry nativo...${NC}"
    curl -L https://foundry.paradigm.xyz | bash
    export PATH="$HOME/.foundry/bin:$PATH"
    "$HOME/.foundry/bin/foundryup"
  fi
fi

echo -e "${GREEN}[OK] Foundry detectado:${NC} $(forge --version | head -n 1)"
echo -e "${GREEN}[OK] Node.js detectado:${NC} $(node -v)"

# 3. Liberar puertos si ya estuviesen ocupados
for port in 8545 5173; do
  if command -v lsof >/dev/null 2>&1; then
    PID=$(lsof -ti :$port || true)
    if [ -n "$PID" ]; then
      echo -e "${YELLOW}[!] Puerto $port ocupado por PID $PID. Liberando...${NC}"
      kill -9 $PID 2>/dev/null || true
    fi
  elif command -v fuser >/dev/null 2>&1; then
    fuser -k ${port}/tcp >/dev/null 2>&1 || true
  fi
done

# 4. Iniciar nodo Anvil Blockchain a Estado 0 en segundo plano
echo -e "\n${YELLOW}[1/4] Iniciando nodo Anvil Blockchain (Estado 0 / ChainID 31337)...${NC}"
anvil --host 0.0.0.0 --port 8545 --chain-id 31337 --code-size-limit 120000 > /tmp/anvil.log 2>&1 &
ANVIL_PID=$!

cleanup() {
  echo -e "\n${YELLOW}[*] Deteniendo procesos en segundo plano...${NC}"
  kill "$ANVIL_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Esperar a que el RPC de Anvil esté disponible
echo -n "Esperando conexión RPC en http://127.0.0.1:8545..."
for i in {1..30}; do
  if curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"net_version","params":[],"id":1}' http://127.0.0.1:8545 >/dev/null 2>&1; then
    echo -e " ${GREEN}[CONECTADO]${NC}"
    break
  fi
  sleep 1
  echo -n "."
done

# 5. Generar Prisma Client en services
echo -e "\n${YELLOW}[2/4] Generando cliente Prisma ORM en services...${NC}"
(cd services && npx prisma generate --schema=core/prisma/schema.prisma)

# 6. Compilar Smart Contracts con Forge
echo -e "\n${YELLOW}[3/4] Compilando 26 smart contracts con Forge (ABIs y Bytecode)...${NC}"
(cd contracts && forge build --extra-output-files abi --quiet)

# 7. Desplegar Smart Contracts a Estado 0 e Inicializar Tesorería
echo -e "\n${YELLOW}[4/4] Desplegando Smart Contracts e inicializando reservas génesis...${NC}"
export BACKEND_OPERATOR_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
export ANVIL_URL="http://127.0.0.1:8545"
npx tsx services/core/src/deploy.ts

# 8. Compilar bundle de frontend y servir
echo -e "\n${YELLOW}[*] Compilando bundle de producción de Frontend Web3...${NC}"
(cd frontend && npm run build:sandbox)

echo -e "\n${GREEN}=======================================================${NC}"
echo -e "${GREEN} PROTOCOLO ALPHA CENTAURI DESPLEGADO Y LISTO!          ${NC}"
echo -e "${GREEN}=======================================================${NC}"
echo -e " Servidor activo en:"
echo -e " -> ${CYAN}http://0.0.0.0:5173${NC} (Para Cloud Web Previews en AI Studio)"
echo -e " -> ${CYAN}http://localhost:5173${NC}"
echo -e " Proxy RPC interno activo en: ${CYAN}/rpc${NC} -> 127.0.0.1:8545"
echo -e " Presiona Ctrl+C para detener todos los servicios.\n"

export ANVIL_HOST="127.0.0.1"
cd frontend && node server.cjs
