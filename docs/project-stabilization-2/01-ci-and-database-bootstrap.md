# 01 — CI and Deterministic Database Bootstrap (`AUD-001`)

**Project:** Global Luggage Storage Marketplace  
**Branch:** `feat/phase-1b-identity`  
**Audit Finding Addressed:** `AUD-001` (High — Clean Database Bootstrap & CI Migration Failures)  
**Status:** `COMPLETE & VERIFIED`

---

## 1. Root Cause Analysis

1. **Missing Migration Step in GitHub Actions CI (`.github/workflows/ci.yml`):**
   - Previously, `.github/workflows/ci.yml` provisioned `postgis/postgis:16-3.4-alpine` and executed `infrastructure/docker/init.sql` (creating roles `luggage_migrator`, `luggage_user`, `luggage_role_assigner` and enabling extensions `uuid-ossp`, `pgcrypto`, `postgis`), then immediately ran `pnpm verify` (`turbo run lint typecheck test build`) **without running `pnpm db:migrate`**.
   - As a result, on a clean PostgreSQL container, none of the 6 Drizzle SQL migrations (`0000_outgoing_thunderbolt_ross.sql` through `0005_stabilization_verification_and_rate_limits.sql`) had been applied when API integration tests started, causing `42P01: relation "users" does not exist`.
2. **Test Runner Independence from Manual Migration Steps:**
   - Running `pnpm --filter @luggage-storage/api test` directly on a fresh database could fail if a developer or CI runner had not manually invoked `db:migrate` beforehand.
3. **Lack of Post-Migration Schema Verification:**
   - `runMigrations()` in `apps/api/src/infrastructure/database/migrate.ts` applied pending SQL files but did not explicitly assert that `postgis` and all required public tables were present after migration completion.

---

## 2. Remediation Implemented

### 2.1 Post-Migration Schema Verification (`apps/api/src/infrastructure/database/migrate.ts`)

- Exported `REQUIRED_PUBLIC_TABLES` (13 tables: `__drizzle_migrations`, `users`, `traveller_profiles`, `host_profiles`, `roles`, `permissions`, `user_roles`, `role_permissions`, `auth_sessions`, `password_reset_tokens`, `security_audit_events`, `email_verification_tokens`, `auth_rate_limits`) and `verifyMigratedSchema(client)`.
- `runMigrations()` now invokes `verifyMigratedSchema(client)` before releasing the PostgreSQL migration advisory lock (`7461938502847`), verifying both `pg_extension` (`postgis`) and `information_schema.tables` for all 13 required tables.

### 2.2 Automatic Vitest Global Setup & Sequential Database Execution (`apps/api/vitest.config.ts`, `apps/api/tests/setup/global-setup.ts`)

- Created `apps/api/tests/setup/global-setup.ts` which invokes `await runMigrations()` automatically before any Vitest test file executes.
- Created `apps/api/vitest.config.ts` registering `globalSetup: ["./tests/setup/global-setup.ts"]` and `fileParallelism: false` so database-backed integration suites execute deterministically without cross-file race conditions.

### 2.3 Root `db:migrate` Script & CI Workflow Update (`package.json`, `.github/workflows/ci.yml`)

- Added `"db:migrate": "pnpm --filter @luggage-storage/api db:migrate"` to root `package.json`.
- Updated `.github/workflows/ci.yml` to:
  1. Trigger on `main`, `develop`, `feat/phase-1b-identity`, and `feat/**`.
  2. Run `infrastructure/docker/init.sql` against the clean `postgis/postgis:16-3.4-alpine` service container.
  3. Build `@luggage-storage/contracts` (`pnpm --filter @luggage-storage/contracts build`).
  4. Explicitly run `pnpm db:migrate` (with `DATABASE_URL`, `MIGRATION_DATABASE_URL`, and `RATE_LIMIT_HASH_SECRET` configured).
  5. Run `pnpm verify` (`turbo run lint typecheck test build`).

---

## 3. Verification Evidence

- Executed `pnpm --filter @luggage-storage/api db:migrate` and `pnpm test`:
  - `[Migration Engine] Verified required schema tables and PostGIS extension` (`verifiedTables: 13`).
- Automated test `should deterministically verify all required PostgreSQL tables and PostGIS extension (AUD-001)` in `apps/api/tests/stabilization-security.test.ts` passes (`100%`).
