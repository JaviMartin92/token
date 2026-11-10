# PowerShell Script para Configurar Enlaces de Rendimiento en Arbitrum Sepolia
param (
    [string]$PrivateKey = ""
)

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  VINCULACIÓN DE PERMISOS REAL YIELD (ARBITRUM)      " -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

$ROOT_DIR = (Get-Location).Path
$env:NODE_PATH = "${ROOT_DIR}\frontend\node_modules;${ROOT_DIR}\services\core\node_modules;$env:NODE_PATH"

if ($PrivateKey -ne "") {
    $env:DEPLOYER_KEY = $PrivateKey
}

npx tsx scripts/configure_yield_wires.ts
