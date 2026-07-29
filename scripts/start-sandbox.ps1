# PowerShell Sandbox Launcher for Alpha Centauri (V4)

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  ALPHA CENTAURI LOCAL SANDBOX LAUNCHER" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Environment Setup
if (-not (Test-Path ".env")) {
    Write-Host "[*] .env file not found. Copying .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
} else {
    Write-Host "[+] .env file already exists." -ForegroundColor Green
}

# Load environment variables
Get-Content .env | ForEach-Object {
    if ($_ -match "^(?<key>[^#\s=]+)=(?<val>.*)$") {
        $envKey = $Matches['key'].Trim()
        $envVal = $Matches['val'].Trim()
        [System.Environment]::SetEnvironmentVariable($envKey, $envVal)
    }
}

# 2. Spin up Docker containers
Write-Host "[*] Launching PostgreSQL, Redis, and Anvil via Docker..." -ForegroundColor Yellow
docker-compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to launch Docker containers. Make sure Docker Desktop is running."
    exit 1
}

# 3. Wait for services to be ready
Write-Host "[*] Waiting for services to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Test Anvil Connection
Write-Host "[*] Testing Anvil RPC availability..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8545" -Method Post -ContentType "application/json" -Body '{"jsonrpc":"2.0","method":"net_version","params":[],"id":1}' -ErrorAction Stop
    Write-Host "[+] Anvil RPC is responsive! Net Version: $($response.result)" -ForegroundColor Green
} catch {
    Write-Warning "Could not reach Anvil RPC on http://localhost:8545. It might still be starting."
}

# 4. Initialize Core database
Write-Host "[*] Running Prisma schema check/push..." -ForegroundColor Yellow
if (Test-Path "services/core") {
    Push-Location "services/core"
    if (Test-Path "node_modules") {
        npx prisma db push --accept-data-loss
    } else {
        Write-Warning "Prisma packages not installed yet. DB initialization skipped until packages are installed."
    }
    Pop-Location
}

Write-Host "`n[+] Sandbox is ready!" -ForegroundColor Green
Write-Host "    - Anvil RPC: http://localhost:8545" -ForegroundColor Cyan
Write-Host "    - Redis: localhost:6379" -ForegroundColor Cyan
Write-Host "    - Postgres: localhost:5432" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
