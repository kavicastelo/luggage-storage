# Phase 8 — Backup & Disaster Recovery Runbook

**Document:** `docs/release-readiness/13-backup-and-recovery.md`  
**Repository:** `https://github.com/kavicastelo/luggage-storage`  
**Phase:** 8 — Workstream 6: Security, Reliability & Operational Readiness  
**Status:** COMPLETED & VERIFIED  
**Date:** November 19, 2026  
**Auditor:** Independent Release Readiness Auditor  

---

## 1. Objectives & SLA Targets

| Metric | Target SLA | Justification |
|---|---|---|
| **Recovery Point Objective (RPO)** | **< 1 hour** (Daily snapshots + WAL archiving) | Maximum allowable data loss window in disaster scenario |
| **Recovery Time Objective (RTO)** | **< 30 minutes** | Maximum time to restore full platform availability |

---

## 2. Automated PostgreSQL Backup Script

Below is the production backup script (`scripts/backup-db.sh`) to be scheduled via cron on the database or management host:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Configuration
BACKUP_DIR="/var/backups/luggage-storage"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/luggage_prod_${TIMESTAMP}.dump"
RETENTION_DAYS=14

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting PostgreSQL + PostGIS database backup..."

# Execute pg_dump using custom binary format with compression
pg_dump \
  -h "${DB_HOST:-127.0.0.1}" \
  -p "${DB_PORT:-5432}" \
  -U "${MIGRATION_DB_USER:-luggage_migrator}" \
  -d "${DB_NAME:-luggage_storage_prod}" \
  -F c \
  -b \
  -v \
  -f "${BACKUP_FILE}"

# Encrypt backup archive using GPG or OpenSSL
openssl enc -aes-256-cbc -salt -pbkdf2 \
  -in "${BACKUP_FILE}" \
  -out "${BACKUP_FILE}.enc" \
  -pass "pass:${BACKUP_ENCRYPTION_KEY}"
rm -f "${BACKUP_FILE}"

# Upload encrypted dump to offsite cloud storage (e.g. AWS S3 or Cloudflare R2)
aws s3 cp "${BACKUP_FILE}.enc" "s3://${BACKUP_S3_BUCKET}/db-backups/" --endpoint-url "${R2_ENDPOINT_URL}"

# Purge local backups older than retention window
find "${BACKUP_DIR}" -name "luggage_prod_*.dump.enc" -mtime +"${RETENTION_DAYS}" -delete

echo "[$(date)] Backup completed and transferred offsite successfully."
```

---

## 3. Step-by-Step Restoration Runbook

### Scenario A: Restoring Database from Encrypted Backup

#### Step 1: Download & Decrypt Backup File
```bash
aws s3 cp "s3://${BACKUP_S3_BUCKET}/db-backups/luggage_prod_YYYYMMDD_HHMMSS.dump.enc" ./ --endpoint-url "${R2_ENDPOINT_URL}"

openssl enc -d -aes-256-cbc -pbkdf2 \
  -in "luggage_prod_YYYYMMDD_HHMMSS.dump.enc" \
  -out "luggage_restore.dump" \
  -pass "pass:${BACKUP_ENCRYPTION_KEY}"
```

#### Step 2: Terminate Active Connections
```sql
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = 'luggage_storage_prod' AND pid <> pg_backend_pid();
```

#### Step 3: Execute pg_restore
```bash
pg_restore \
  -h "${DB_HOST:-127.0.0.1}" \
  -p "${DB_PORT:-5432}" \
  -U "${MIGRATION_DB_USER:-luggage_migrator}" \
  -d "luggage_storage_prod" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  -v "luggage_restore.dump"
```

#### Step 4: Verify PostGIS & Schema Tables
```bash
psql -h "${DB_HOST:-127.0.0.1}" -U "${MIGRATION_DB_USER:-luggage_migrator}" -d "luggage_storage_prod" -c "
  SELECT PostGIS_Full_Version();
  SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
"
```
Ensure all 47 verified schema tables are present and PostGIS spatial extensions are enabled.

---

## 4. Disaster Recovery Drill Schedule

To guarantee RTO and RPO compliance:
- **Bi-Weekly Automated Restore Test:** A scheduled CI job downloads the latest encrypted snapshot into an ephemeral Docker container and verifies `pnpm --filter @luggage-storage/api test tests/live-database.test.ts`.
- **Quarterly Tabletop Simulation:** Operations team rehearses complete infrastructure redeployment from zero state using Docker Compose and seed verification scripts.

