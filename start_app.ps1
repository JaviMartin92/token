# Alpha Centauri High-Performance Launcher Script (Windows PowerShell)
param (
  [switch]$Fast
)

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host " INICIANDO DESPLIEGUE OPTIMIZADO DE ALPHA CENTAURI...  " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# Verificar si Docker Daemon esta activo
docker info >$null 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "[ERROR] Docker Desktop no se encuentra iniciado." -ForegroundColor Red
  Write-Host "Por favor, abre Docker Desktop en tu sistema y vuelve a ejecutar start_app.bat" -ForegroundColor Yellow
  exit 1
}

$ROOT_DIR = Get-Location

if ($Fast) {
  Write-Host "Mode Fast Activado." -ForegroundColor Green

  # Re-run deploy inside existing environment
  Write-Host "[1/2] Re-desplegando contratos y fondeando cuentas..." -ForegroundColor Yellow
  docker run --rm --network host -v "${ROOT_DIR}:/app" -w /app/services -e BACKEND_OPERATOR_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 -e ANVIL_URL=http://localhost:8545 node:20-alpine node node_modules/ts-node/dist/bin.js --project tsconfig.json core/src/deploy.ts

  Write-Host "[2/2] Actualizando servidor frontend..." -ForegroundColor Yellow
  docker exec alpha-frontend sh -c "npx vite build" | Out-Null
} else {
  # 1. Limpieza rapida de contenedores previos
  Write-Host "[1/4] Limpiando contenedores anteriores..." -ForegroundColor Yellow
  docker rm -f alpha-anvil alpha-frontend alpha_centauri_frontend alpha_centauri_anvil 2>$null | Out-Null

  # 2. Iniciar Nodo Anvil Blockchain
  Write-Host "[2/4] Iniciando Nodo Blockchain Anvil (puerto 8545)..." -ForegroundColor Yellow
  docker run -d --name alpha-anvil -p 8545:8545 --entrypoint anvil ghcr.io/foundry-rs/foundry:latest --host 0.0.0.0 --port 8545 --chain-id 31337 | Out-Null
  Start-Sleep -Seconds 1

  # 3. Desplegar Smart Contracts y Pre-fondear Billeteras (Todo-en-Uno)
  Write-Host "[3/4] Desplegando Smart Contracts y Pre-fondeando Billeteras..." -ForegroundColor Yellow
  docker run --rm --network host -v "${ROOT_DIR}:/app" -w /app/services -e BACKEND_OPERATOR_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 -e ANVIL_URL=http://localhost:8545 node:20-alpine node node_modules/ts-node/dist/bin.js --project tsconfig.json core/src/deploy.ts

  # 4. Lanzar Servidor Web Frontend y Compilar Bundle
  Write-Host "[4/4] Iniciando Servidor Web y Proxy RPC (puerto 5173)..." -ForegroundColor Yellow
  docker rm -f alpha-frontend 2>$null | Out-Null
  docker run --rm -v "${ROOT_DIR}/frontend:/app" -w /app node:20-alpine sh -c "npm run build" | Out-Null
  docker run -d --name alpha-frontend -p 5173:5173 --add-host=host.docker.internal:host-gateway -v "${ROOT_DIR}/frontend:/app" -w /app node:20-alpine node server.cjs | Out-Null
  Start-Sleep -Seconds 1
}

Write-Host "=======================================================" -ForegroundColor Green
Write-Host " APLICACION LISTA EN TIEMPO RECORD!                    " -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host " Abre en tu navegador:" -ForegroundColor White
Write-Host " -> http://localhost:5173" -ForegroundColor Cyan
Write-Host " -> http://127.0.0.1:5173" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Green
