#!/usr/bin/env bash
# Bash Sandbox Launcher for Alpha Centauri (V4)

echo -e "\033[0;36m=========================================\033[0m"
echo -e "\033[0;36m  ALPHA CENTAURI LOCAL SANDBOX LAUNCHER\033[0m"
echo -e "\033[0;36m=========================================\033[0m"

# 1. Environment Setup
if [ ! -f .env ]; then
    echo -e "\033[0;33m[*] .env file not found. Copying .env.example...\033[0m"
    cp .env.example .env
else
    echo -e "\033[0;32m[+] .env file already exists.\033[0m"
fi

# Load variables
export $(grep -v '^#' .env | xargs)

# 2. Spin up Docker containers
echo -e "\033[0;33m[*] Launching PostgreSQL, Redis, and Anvil via Docker...\033[0m"
docker-compose up -d

if [ $? -ne 0 ]; then
    echo -e "\033[0;31m[!] Failed to launch Docker containers. Make sure Docker is running.\033[0m"
    exit 1
fi

# 3. Wait for services to be ready
echo -e "\033[0;33m[*] Waiting for services to initialize...\033[0m"
sleep 5

# Test Anvil Connection
echo -e "\033[0;33m[*] Testing Anvil RPC availability...\033[0m"
curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"net_version","params":[],"id":1}' http://localhost:8545 > /dev/null
if [ $? -eq 0 ]; then
    echo -e "\033[0;32m[+] Anvil RPC is responsive!\033[0m"
else
    echo -e "\033[0;33m[!] Could not reach Anvil RPC on http://localhost:8545. It might still be starting.\033[0m"
fi

# 4. Initialize Core database
echo -e "\033[0;33m[*] Running Prisma schema check/push...\033[0m"
if [ -d "services/core" ]; then
    cd services/core
    if [ -d "node_modules" ]; then
        npx prisma db push --accept-data-loss
    else
        echo -e "\033[0;33m[!] Prisma packages not installed yet. DB initialization skipped.\033[0m"
    fi
    cd ../..
fi

echo -e "\n\033[0;32m[+] Sandbox is ready!\033[0m"
echo -e "    - Anvil RPC: http://localhost:8545"
echo -e "    - Redis: localhost:6379"
echo -e "    - Postgres: localhost:5432"
echo -e "\033[0;36m=========================================\033[0m"
