#!/usr/bin/env bash
# =============================================================================
# scripts/deploy-demo-api.sh — AWS EC2 Demo API Deployment Script
# =============================================================================
# Deploys the compiled Node.js distribution directly to AWS EC2.
# ZERO DOCKER DEPENDENCY. Uses systemd/PM2 and Nginx reverse proxy.
# =============================================================================

set -euo pipefail

# Configuration
APP_NAME="luggage-storage-api"
DEPLOY_DIR="/opt/luggage-storage"
RELEASES_DIR="${DEPLOY_DIR}/releases"
SHARED_DIR="${DEPLOY_DIR}/shared"
CURRENT_SYMLINK="${DEPLOY_DIR}/current"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RELEASE_DIR="${RELEASES_DIR}/${TIMESTAMP}"
HEALTH_CHECK_URL="http://127.0.0.1:3000/live"
MAX_HEALTH_ATTEMPTS=15
HEALTH_INTERVAL_SECONDS=2

echo "[$(date)] Starting API deployment release: ${TIMESTAMP}..."

# 1. Prerequisite verification
if [ ! -d "${SHARED_DIR}" ]; then
  echo "Error: Shared directory ${SHARED_DIR} does not exist. Please initialize EC2 host."
  exit 1
fi

if [ ! -f "${SHARED_DIR}/.env.demo" ]; then
  echo "Error: ${SHARED_DIR}/.env.demo not found. Demo environment configuration required."
  exit 1
fi

# 2. Prepare new release directory
mkdir -p "${RELEASE_DIR}"
echo "[$(date)] Created release target: ${RELEASE_DIR}"

# 3. Unpack compiled distribution artifact
if [ ! -f "/tmp/api-dist.tar.gz" ]; then
  echo "Error: Distribution archive /tmp/api-dist.tar.gz not found."
  exit 1
fi

tar -xzf /tmp/api-dist.tar.gz -C "${RELEASE_DIR}"
rm -f /tmp/api-dist.tar.gz

# 4. Link shared environment file
ln -sfn "${SHARED_DIR}/.env.demo" "${RELEASE_DIR}/.env"

# 5. Execute safe database migrations against Supabase
echo "[$(date)] Running database migrations against Supabase..."
cd "${RELEASE_DIR}"
if ! node dist/infrastructure/database/migrate.js; then
  echo "Error: Database migration failed. Aborting deployment before activation."
  rm -rf "${RELEASE_DIR}"
  exit 1
fi

# 6. Activate release by switching symlink atomically
echo "[$(date)] Switching current symlink to ${RELEASE_DIR}..."
ln -sfn "${RELEASE_DIR}" "${CURRENT_SYMLINK}"

# 7. Restart API process (PM2 or systemd)
echo "[$(date)] Restarting ${APP_NAME} process..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 reload "${APP_NAME}" || pm2 start "${CURRENT_SYMLINK}/dist/server.js" --name "${APP_NAME}"
elif systemctl is-active --quiet "${APP_NAME}"; then
  sudo systemctl restart "${APP_NAME}"
else
  echo "Warning: Neither PM2 nor active systemd service found. Starting with systemd..."
  sudo systemctl start "${APP_NAME}" || true
fi

# 8. Verify service health
echo "[$(date)] Verifying service health at ${HEALTH_CHECK_URL}..."
HEALTHY=false
for i in $(seq 1 "${MAX_HEALTH_ATTEMPTS}"); do
  STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_CHECK_URL}" || true)
  if [ "${STATUS_CODE}" = "200" ]; then
    HEALTHY=true
    echo "[$(date)] Health probe succeeded (HTTP 200) on attempt ${i}."
    break
  fi
  echo "Attempt ${i}/${MAX_HEALTH_ATTEMPTS}: Health probe returned ${STATUS_CODE}, retrying in ${HEALTH_INTERVAL_SECONDS}s..."
  sleep "${HEALTH_INTERVAL_SECONDS}"
done

if [ "${HEALTHY}" = "false" ]; then
  echo "Error: Health verification failed after ${MAX_HEALTH_ATTEMPTS} attempts."
  echo "Initiating automatic rollback..."
  if [ -f "scripts/rollback-demo-api.sh" ]; then
    bash scripts/rollback-demo-api.sh
  fi
  exit 1
fi

# 9. Clean up old releases (keep last 5)
echo "[$(date)] Pruning old releases (retaining 5 most recent)..."
cd "${RELEASES_DIR}"
ls -dt */ | tail -n +6 | xargs -r rm -rf

echo "[$(date)] Deployment successfully finished. Release ${TIMESTAMP} is live."
