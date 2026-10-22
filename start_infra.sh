#!/bin/bash
set -e

echo "=========================================="
echo "🚀 Pre-flight checks for Alpha Centauri   "
echo "=========================================="

# 1. Environment Validation
if [ ! -f .env ]; then
  echo "[ERROR] .env file is missing. Please create it from .env.example."
  exit 1
fi

source .env

if [ -z "$POSTGRES_PASSWORD" ]; then
  echo "[ERROR] POSTGRES_PASSWORD is empty in the .env file."
  exit 1
fi

echo "[OK] Environment variables validated."

# 2. Port Check
# We check the ports used in docker-compose.yml
PORTS=(5432 6379 8545 5173)
for PORT in "${PORTS[@]}"; do
  # Use bash /dev/tcp to check if the port is in use
  if (echo > /dev/tcp/127.0.0.1/$PORT) >/dev/null 2>&1; then
    echo "[ERROR] Port $PORT is already in use. Please free it before starting the infrastructure."
    exit 1
  fi
done

echo "[OK] All required ports are free."

# 3. Start Infrastructure
echo "Starting Docker containers in the background..."
docker-compose up -d

# Wait for database to be healthy
echo "Waiting for PostgreSQL database to be healthy..."
while ! docker inspect --format "{{json .State.Health.Status }}" alpha_centauri_db | grep -q '"healthy"'; do
  echo -n "."
  sleep 2
done
echo ""
echo "[OK] PostgreSQL is healthy and accepting connections."

# Optional: Wait for other essential services (Redis, Anvil)
echo "Waiting for Redis to be healthy..."
while ! docker inspect --format "{{json .State.Health.Status }}" alpha_centauri_redis | grep -q '"healthy"'; do
  echo -n "."
  sleep 2
done
echo ""
echo "[OK] Redis is healthy."

echo "Waiting for Anvil to be healthy..."
while ! docker inspect --format "{{json .State.Health.Status }}" alpha_centauri_anvil | grep -q '"healthy"'; do
  echo -n "."
  sleep 2
done
echo ""
echo "[OK] Anvil (Local RPC) is healthy."

echo "=========================================="
echo "✅ Infrastructure is UP and READY!        "
echo "=========================================="
