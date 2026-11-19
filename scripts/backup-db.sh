#!/usr/bin/env bash
# =============================================================================
# scripts/backup-db.sh — PostgreSQL + PostGIS Backup Automation
# =============================================================================
# Supports local, AWS RDS, and Supabase PostgreSQL instances with TLS.
# =============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="luggage_storage_backup_${TIMESTAMP}.dump"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting PostgreSQL database backup..."

if [ -n "${DATABASE_URL:-}" ]; then
  # Parse connection string or pass directly to pg_dump
  pg_dump "${DATABASE_URL}" \
    -F c \
    -b \
    -v \
    -f "${BACKUP_PATH}"
else
  pg_dump \
    -h "${DB_HOST:-localhost}" \
    -p "${DB_PORT:-5432}" \
    -U "${DB_USER:-luggage_migrator}" \
    -d "${DB_NAME:-luggage_storage_dev}" \
    -F c \
    -b \
    -v \
    -f "${BACKUP_PATH}"
fi

echo "[$(date)] Backup completed successfully: ${BACKUP_PATH} ($(du -h "${BACKUP_PATH}" | cut -f1))"

# Optional OpenSSL AES-256-CBC encryption if secret provided
if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "[$(date)] Encrypting backup with AES-256-CBC..."
  openssl enc -aes-256-cbc -salt -pbkdf2 \
    -in "${BACKUP_PATH}" \
    -out "${BACKUP_PATH}.enc" \
    -pass "pass:${BACKUP_ENCRYPTION_KEY}"
  rm -f "${BACKUP_PATH}"
  BACKUP_PATH="${BACKUP_PATH}.enc"
  echo "[$(date)] Encrypted backup created: ${BACKUP_PATH}"
fi

# Optional upload to offsite S3 / Cloudflare R2 bucket
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  echo "[$(date)] Uploading backup to s3://${BACKUP_S3_BUCKET}/db-backups/..."
  aws s3 cp "${BACKUP_PATH}" "s3://${BACKUP_S3_BUCKET}/db-backups/" ${R2_ENDPOINT_URL:+--endpoint-url "${R2_ENDPOINT_URL}"}
fi

# Retention cleanup: remove local backups older than retention window
find "${BACKUP_DIR}" -type f -name "luggage_storage_backup_*" -mtime +"${RETENTION_DAYS}" -delete || true

echo "[$(date)] Backup job completed successfully."
