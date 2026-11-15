# PowerShell Script para Desplegar el Hypervisor de Viraje en Arbitrum Sepolia
param (
    [string]$PrivateKey = ""
)

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  DESPLIEGUE DEL HYPERVISOR EN ARBITRUM SEPOLIA       " -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

$ROOT_DIR = (Get-Location).Path
$env:NODE_PATH = "${ROOT_DIR}\frontend\node_modules;${ROOT_DIR}\services\core\node_modules;$env:NODE_PATH"

if ($PrivateKey -ne "") {
    $env:DEPLOYER_KEY = $PrivateKey
}

npx tsx scripts/deploy_hypervisor.ts

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[*] Re-compilando frontend para integrar el Hypervisor..." -ForegroundColor Yellow
    Push-Location frontend
    npm run build:sandbox
    Pop-Location
    Write-Host "`n✅ ¡Listo! El Hypervisor está desplegado, enlazado y verificado on-chain." -ForegroundColor Green
}
