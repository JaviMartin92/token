# PowerShell Script para Desplegar P2P Lending Market y Corregir Permisos de Staking
param (
    [string]$PrivateKey = ""
)

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  DESPLIEGUE P2P Y HABILITACIÓN DE STAKING (ARBITRUM) " -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

$ROOT_DIR = (Get-Location).Path
$env:NODE_PATH = "${ROOT_DIR}\frontend\node_modules;${ROOT_DIR}\services\core\node_modules;$env:NODE_PATH"

if ($PrivateKey -ne "") {
    $env:DEPLOYER_KEY = $PrivateKey
}

npx tsx scripts/deploy_p2p_and_fix_staking.ts

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[*] Re-compilando frontend para integrar el nuevo P2PLendingMarket..." -ForegroundColor Yellow
    Push-Location frontend
    npm run build:sandbox
    Pop-Location
    Write-Host "`n✅ ¡Listo! Puedes refrescar la web e interactuar inmediatamente con Staking y Préstamos de Tesorería." -ForegroundColor Green
}
