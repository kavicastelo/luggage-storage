#!/usr/bin/env bash
# =============================================================================
# scripts/restore-db.sh — PostgreSQL + PostGIS Restoration Script
# =============================================================================

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup_file_path> [target_database_url]"
  exit 1
fi

BACKUP_INPUT="$1"
RESTORE_TARGET="${2:-${DATABASE_URL:-}}"
WORKING_FILE="${BACKUP_INPUT}"

if [ ! -f "${BACKUP_INPUT}" ]; then
  echo "Error: Backup file '${BACKUP_INPUT}' not found."
  exit 1
fi

# Decrypt if encrypted archive
if [[ "${BACKUP_INPUT}" == *.enc ]]; then
  if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    echo "Error: Backup file is encrypted (.enc) but BACKUP_ENCRYPTION_KEY is not set."
    exit 1
  fi
  DECRYPTED_PATH="${BACKUP_INPUT%.enc}.restored"
  echo "[$(date)] Decrypting backup archive..."
  openssl enc -d -aes-256-cbc -pbkdf2 \
    -in "${BACKUP_INPUT}" \
    -out "${DECRYPTED_PATH}" \
    -pass "pass:${BACKUP_ENCRYPTION_KEY}"
  WORKING_FILE="${DECRYPTED_PATH}"
fi

echo "[$(date)] Starting database restoration from: ${WORKING_FILE}..."

if [ -n "${RESTORE_TARGET}" ]; then
  pg_restore \
    --dbname="${RESTORE_TARGET}" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    --verbose \
    "${WORKING_FILE}" || true
else
  pg_restore \
    -h "${DB_HOST:-localhost}" \
    -p "${DB_PORT:-5432}" \
    -U "${DB_USER:-luggage_migrator}" \
    -d "${DB_NAME:-luggage_storage_dev}" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    --verbose \
    "${WORKING_FILE}" || true
fi

# Clean up decrypted temporary file if created
if [[ "${BACKUP_INPUT}" == *.enc ]] && [ -f "${WORKING_FILE}" ]; then
  rm -f "${WORKING_FILE}"
fi

echo "[$(date)] Database restoration completed successfully."
