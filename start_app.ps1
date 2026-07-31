# Alpha Centauri High-Performance Launcher Script (Windows PowerShell)
param (
  [switch]$Fast
)

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host " INICIANDO DESPLIEGUE ULTRARRAPIDO A ESTADO 0...       " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# Verificar si Docker Daemon esta activo
docker info >$null 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "[ERROR] Docker Desktop no se encuentra iniciado." -ForegroundColor Red
  Write-Host "Por favor, abre Docker Desktop en tu sistema y vuelve a ejecutar start_app.ps1" -ForegroundColor Yellow
  exit 1
}

$ROOT_DIR = Get-Location

# 1. Reset instantaneo de Anvil Blockchain a Estado 0 (Purga completa de memoria)
Write-Host "[1/3] Reiniciando memoria de Anvil Blockchain a Estado 0 (Fresh Genesis)..." -ForegroundColor Yellow
docker rm -f alpha-anvil 2>$null | Out-Null
docker run -d --name alpha-anvil -p 8545:8545 --entrypoint anvil ghcr.io/foundry-rs/foundry:latest --host 0.0.0.0 --port 8545 --chain-id 31337 | Out-Null
Start-Sleep -Seconds 2

# 2. Desplegar Smart Contracts y Pre-fondear Billeteras
Write-Host "[2/3] Desplegando Smart Contracts y Pre-fondeando 10,000 USDC..." -ForegroundColor Yellow
$env:BACKEND_OPERATOR_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
$env:ANVIL_URL="http://127.0.0.1:8545"

npx tsx services/core/src/deploy.ts

# 3. Re-compilar Bundle Frontend con las nuevas direcciones y Servir
Write-Host "[3/3] Purgando Cache y Re-compilando Bundle Frontend a Estado 0..." -ForegroundColor Yellow
docker rm -f alpha-frontend 2>$null | Out-Null
Remove-Item -Recurse -Force "${ROOT_DIR}\frontend\dist" 2>$null | Out-Null
Remove-Item -Recurse -Force "${ROOT_DIR}\frontend\node_modules\.vite" 2>$null | Out-Null
docker run --rm -v "${ROOT_DIR}/frontend:/app" -w /app node:20-alpine npx vite build
docker run -d --name alpha-frontend -p 5173:5173 --add-host=host.docker.internal:host-gateway -v "${ROOT_DIR}/frontend:/app" -w /app node:20-alpine node server.cjs | Out-Null

Write-Host "=======================================================" -ForegroundColor Green
Write-Host " APLICACION REINICIADA Y LISTA EN ESTADO 0!            " -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host " Abre en tu navegador:" -ForegroundColor White
Write-Host " -> http://localhost:5173" -ForegroundColor Cyan
Write-Host " -> http://127.0.0.1:5173" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Green
