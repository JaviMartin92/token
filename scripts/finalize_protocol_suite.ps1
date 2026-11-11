# PowerShell Script para Desplegar la Suite Completa 100% Mainnet-Ready en Arbitrum Sepolia
param (
    [string]$PrivateKey = ""
)

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  FINALIZACIÓN TOTAL DE LA SUITE (100% MAINNET-READY)" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

$ROOT_DIR = (Get-Location).Path
$env:NODE_PATH = "${ROOT_DIR}\frontend\node_modules;${ROOT_DIR}\services\core\node_modules;$env:NODE_PATH"

if ($PrivateKey -ne "") {
    $env:DEPLOYER_KEY = $PrivateKey
}

npx tsx scripts/finalize_protocol_suite.ts

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[*] Re-compilando frontend para integrar todos los módulos desplegados..." -ForegroundColor Yellow
    Push-Location frontend
    npm run build:sandbox
    Pop-Location
    Write-Host "`n✅ ¡Listo! Toda la suite está desplegada, enlazada y verificada on-chain." -ForegroundColor Green
}
