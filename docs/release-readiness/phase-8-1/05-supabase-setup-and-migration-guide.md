# Phase 8.1 — Workstream 2: Supabase Setup & Migration Runbook

**Document:** `docs/release-readiness/phase-8-1/05-supabase-setup-and-migration-guide.md`  
**Repository:** `https://github.com/kavicastelo/luggage-storage`  
**Phase:** 8.1 — Checkpoint 1  
**Date:** November 19, 2026  
**Auditor:** Independent Release Readiness Lead  

---

## 1. Prerequisites & Account Setup

1. Log in to [Supabase Console](https://supabase.com/dashboard).
2. Click **New Project**:
   - **Name:** `luggage-storage-demo`
   - **Database Password:** Generate high-entropy 32+ character password.
   - **Region:** `US East (N. Virginia)` (or closest region to target AWS EC2 instance).
   - **Plan:** Free Tier.

---

## 2. Enabling Required PostgreSQL Extensions

In the Supabase Dashboard, navigate to **SQL Editor** and execute:

```sql
-- 1. Enable PostGIS Spatial Extensions
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- 2. Enable pgcrypto Extension for UUID Generation
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- 3. Verify Extension Activation
SELECT name, default_version, installed_version 
FROM pg_available_extensions 
WHERE name IN ('postgis', 'postgis_topology', 'pgcrypto');
```

---

## 3. Extracting Connection URLs

Under **Project Settings** -> **Database** -> **Connection string**:

- **Direct Connection URI (Port 5432) — REQUIRED:**
  ```text
  postgresql://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?sslmode=require
  ```
- Set this connection string for both:
  - `DATABASE_URL`
  - `MIGRATION_DATABASE_URL`

---

## 4. Running Migrations & Seeding Against Supabase

From the local terminal or deployment runner:

```bash
# 1. Export Supabase credentials for the migration engine
export DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?sslmode=require"
export MIGRATION_DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?sslmode=require"
export DATABASE_SSL="true"
export DATABASE_SSL_REJECT_UNAUTHORIZED="false"
export APP_ENV="demo"
export NODE_ENV="production"

# 2. Run Drizzle migrations
pnpm --filter @luggage-storage/api db:migrate

# 3. Seed demo accounts, host locations, and active booking pass
pnpm --filter @luggage-storage/api db:seed

# 4. Instant Reset Drill (truncation + re-seed in < 5 seconds)
pnpm --filter @luggage-storage/api db:reset
```

---

## 5. Verification Checklist

- [ ] `__drizzle_migrations` table records all 20 migrations (0000 to 0019).
- [ ] 47 tables created in `public` schema.
- [ ] PostGIS spatial GiST indexes created on `storage_locations.coordinates`.
- [ ] 8 demo users seeded across TRAVELLER, HOST_OWNER, HOST_STAFF, SUPPORT, and SUPERADMIN roles.
- [ ] Active demo booking `DEMO-COLOMBO-001` with HMAC custody token seeded.
