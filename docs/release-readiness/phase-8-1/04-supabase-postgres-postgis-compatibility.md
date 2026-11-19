# Phase 8.1 — Workstream 2: Supabase PostgreSQL & PostGIS Compatibility Assessment

**Document:** `docs/release-readiness/phase-8-1/04-supabase-postgres-postgis-compatibility.md`  
**Repository:** `https://github.com/kavicastelo/luggage-storage`  
**Phase:** 8.1 — Checkpoint 1  
**Date:** November 19, 2026  
**Auditor:** Independent Release Readiness Lead  

---

## 1. Compatibility Audit Scope

The Global Luggage Storage Marketplace uses:
- **PostgreSQL 16**
- **PostGIS 3.5 Extension** (`geography(Point, 4326)`)
- **Drizzle ORM 0.45.4** with `drizzle-orm/migrator`
- **pgcrypto** extension (`gen_random_uuid()`)
- **Session-level Advisory Locks** (`pg_advisory_lock` / `pg_try_advisory_lock`)
- **Row-Level Transactional Locks** (`SELECT ... FOR UPDATE` on `bookings` and `payment_intents`)
- **Spatial queries:** `ST_SetSRID`, `ST_MakePoint`, `ST_Distance`, GiST spatial indexes

---

## 2. Supabase Architectural Compatibility Matrix

| Feature / Requirement | Application Usage | Supabase Status | Implementation Constraint |
|---|---|---|---|
| **PostgreSQL Version** | PostgreSQL 16 | Supported (15/16 default) | None |
| **PostGIS Extension** | `coordinates geography(Point, 4326)` | Supported natively | Execute `CREATE EXTENSION IF NOT EXISTS postgis;` |
| **pgcrypto Extension** | UUID generation & hashing | Supported natively | Execute `CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;` |
| **Drizzle ORM Migrations** | 20 Chained SQL migrations (`0000_...` to `0019_...`) | Supported 100% | Execute via `pnpm db:migrate` using direct connection |
| **Advisory Locks** | `pg_advisory_lock(7461938502847)` | Supported on Direct Connection | **Must connect on Port 5432.** Transaction pooler (Port 6543) breaks session advisory locks. |
| **Row-Level Locking** | `SELECT ... FOR UPDATE` | Supported 100% | Compatible with Drizzle transactions (`withSerializableOrDeadlockRetry`) |
| **Database TLS / SSL** | TLS connection to cloud database | Required by Supabase | Configure `DATABASE_SSL=true` and `DATABASE_SSL_REJECT_UNAUTHORIZED=false` in demo |

---

## 3. Connection Strategy: Direct Connection (Port 5432) vs Transaction Pooler (Port 6543)

### Decision: Direct Connection (Port 5432)
Because the API server on AWS EC2 is a persistent, long-running Node.js process with a controlled connection pool (`max: 10`), direct connections to Supabase PostgreSQL (port 5432) are the superior choice:
1. **Preserves Session State:** Supports `pg_advisory_lock` used by the migration engine to serialize concurrent deployments.
2. **Prepared Statements:** Drizzle ORM executes parameterized queries without restriction.
3. **Transaction Safety:** Multi-statement transactions (`BEGIN ... COMMIT`) with row-level locks behave deterministically.

---

## 4. Test Verification

Automated compatibility tests in `apps/api/tests/supabase-compatibility.test.ts` verified:
- PostGIS extension activation and version reporting.
- Cryptographic UUID generation (`gen_random_uuid()`).
- Session advisory lock acquisition and release.
- PostGIS spatial distance calculations (`ST_Distance` on Colombo Fort to Galle Face coords).
- JSONB array operators (`?`).
- Row-level locking (`SELECT ... FOR UPDATE`).
- TLS configuration parameters.

Result: **All 7/7 tests passed.**
