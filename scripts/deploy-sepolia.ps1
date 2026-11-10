# PowerShell Script para Desplegar Contratos en Arbitrum Sepolia
param (
    [string]$PrivateKey = "",
    [switch]$TokensOnly = $false
)

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  DESPLIEGUE AUTOMÁTICO EN ARBITRUM SEPOLIA (TESTNET)" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# 1. Asegurar detección de Node.js y módulos Web3
$ROOT_DIR = (Get-Location).Path
$env:NODE_PATH = "${ROOT_DIR}\frontend\node_modules;${ROOT_DIR}\services\core\node_modules;$env:NODE_PATH"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    if (Test-Path "C:\Program Files\nodejs") {
        $env:PATH = "C:\Program Files\nodejs;$env:PATH"
    }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js no está instalado o no se encuentra en el PATH." -ForegroundColor Red
    exit 1
}

# 2. Configurar clave privada si fue provista
if ($PrivateKey -ne "") {
    $env:DEPLOYER_KEY = $PrivateKey
}

$flags = @()
if ($TokensOnly) {
    $flags += "--tokens-only"
}

# 3. Ejecutar script de despliegue mediante tsx
npx tsx scripts/deploy_sepolia.ts @flags

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[*] Re-compilando frontend con las nuevas direcciones..." -ForegroundColor Yellow
    Push-Location frontend
    npm run build:sandbox
    Pop-Location
    Write-Host "`n✅ ¡Listo! Puedes refrescar la web e importar tu USDC en MetaMask para empezar a enviar fondos a tus amigos." -ForegroundColor Green
}
