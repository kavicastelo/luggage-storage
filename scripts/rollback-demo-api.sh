#!/usr/bin/env bash
# =============================================================================
# scripts/rollback-demo-api.sh — AWS EC2 Demo API Rollback Script
# =============================================================================

set -euo pipefail

APP_NAME="luggage-storage-api"
DEPLOY_DIR="/opt/luggage-storage"
RELEASES_DIR="${DEPLOY_DIR}/releases"
CURRENT_SYMLINK="${DEPLOY_DIR}/current"
HEALTH_CHECK_URL="http://127.0.0.1:3000/live"

echo "[$(date)] Initiating emergency rollback..."

# Find previous release
PREVIOUS_RELEASE=$(ls -dt "${RELEASES_DIR}"/*/ | sed -n '2p' | sed 's:/*$::')

if [ -z "${PREVIOUS_RELEASE}" ] || [ ! -d "${PREVIOUS_RELEASE}" ]; then
  echo "Error: No previous release found to roll back to."
  exit 1
fi

echo "[$(date)] Rolling back current symlink to: ${PREVIOUS_RELEASE}..."
ln -sfn "${PREVIOUS_RELEASE}" "${CURRENT_SYMLINK}"

# Restart process
if command -v pm2 >/dev/null 2>&1; then
  pm2 reload "${APP_NAME}" || pm2 restart "${APP_NAME}"
else
  sudo systemctl restart "${APP_NAME}"
fi

# Verify health
STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_CHECK_URL}" || true)
if [ "${STATUS_CODE}" = "200" ]; then
  echo "[$(date)] Rollback succeeded! API service restored at ${PREVIOUS_RELEASE}."
else
  echo "CRITICAL: Service health check failed after rollback (HTTP ${STATUS_CODE}). Manual inspection required."
  exit 1
fi
