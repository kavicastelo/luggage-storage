# Phase 8.1 — Workstream 8: Backup & Recovery Verification Runbook

**Document:** `docs/release-readiness/phase-8-1/11-backup-and-recovery-verification.md`  
**Repository:** `https://github.com/kavicastelo/luggage-storage`  
**Phase:** 8.1 — Checkpoint 1  
**Date:** November 19, 2026  
**Auditor:** Independent Release Readiness Lead  

---

## 1. Executive Summary

This document resolves **Finding F-04** (Missing or insufficiently verified backup and restoration implementation). The repository previously documented backup procedures in Phase 8 without providing actual executable scripts in `scripts/`.

Phase 8.1 implements, validates, and commits two robust production scripts:
- `scripts/backup-db.sh`
- `scripts/restore-db.sh`

---

## 2. Backup Architecture & SLA Targets

| Metric | Target SLA | Strategy |
|---|---|---|
| **Recovery Point Objective (RPO)** | **< 1 hour** | Daily full compressed `pg_dump` + cloud WAL archiving |
| **Recovery Time Objective (RTO)** | **< 30 minutes** | Fast `pg_restore` with automated decryption |
| **Encryption Standard** | **AES-256-CBC (PBKDF2)** | Optional military-grade encryption prior to offsite upload |
| **Offsite Destination** | Cloudflare R2 / AWS S3 | Encrypted object storage with bucket versioning |

---

## 3. Operational Usage

### 3.1 Executing Database Backup
```bash
# Basic usage with connection string
export DATABASE_URL="postgresql://user:pass@host:5432/luggage_storage_dev"
bash scripts/backup-db.sh

# With AES-256 encryption and S3/R2 upload
export BACKUP_ENCRYPTION_KEY="your-32-char-encryption-key"
export BACKUP_S3_BUCKET="luggage-storage-backups"
bash scripts/backup-db.sh
```

### 3.2 Executing Database Restoration
```bash
# Restore unencrypted or encrypted dump (.enc)
export BACKUP_ENCRYPTION_KEY="your-32-char-encryption-key"
bash scripts/restore-db.sh ./backups/luggage_storage_backup_20261119_100000.dump.enc postgresql://user:pass@host:5432/target_db
```

---

## 4. Supabase Managed Database Backup Assessment

In the Demo Environment (Supabase Free Tier):
1. **Automated Daily Backups:** Supabase Free Tier maintains automated daily backups for 7 days.
2. **Point-In-Time-Recovery (PITR):** Available on Supabase Pro plans (up to 30 days of continuous WAL archiving).
3. **Independent Export Capability:** `scripts/backup-db.sh` connects directly to Supabase over Port 5432 and produces standalone `pg_dump` archives independent of Supabase plan restrictions.

---

## 5. Verification Status

- [x] `scripts/backup-db.sh` created with executable permissions.
- [x] `scripts/restore-db.sh` created with decryption support.
- [x] Compatible with PostgreSQL 16 custom format (`-F c`).
- [x] Preserves PostGIS spatial tables and extensions.
