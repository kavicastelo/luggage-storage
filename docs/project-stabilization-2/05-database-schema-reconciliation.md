# Phase 2 Stabilization Remediation — Database Schema & Documentation Reconciliation (`AUD-006`)

**Date:** 2026-04-06  
**Finding Addressed:** `AUD-006` — Database Documentation Still Conflicts with the Actual Schema  
**Status:** **RESOLVED & VERIFIED**

---

## 1. Finding Summary

During the independent audit (`AUD-006`), inconsistencies were identified between the authoritative SQL migration (`0005_stabilization_verification_and_rate_limits.sql`), the Drizzle ORM schema (`apps/api/src/infrastructure/database/schema/auth.ts`), and the previous stabilization reports (`docs/project-stabilization/04-security-remediation-report.md` and `docs/project-stabilization/05-database-and-migration-report.md`):

1. **Migration Inventory Discrepancies:** `05-database-and-migration-report.md` previously referenced fictional migration tags (`0000_ambitious_silver_samurai`, `system_metadata`) instead of the actual migrations (`0000_outgoing_thunderbolt_ross` through `0005_stabilization_verification_and_rate_limits`).
2. **`email_verification_tokens` Schema Discrepancies:** Documentation previously mentioned non-existent columns (`requested_ip`, `user_agent`) instead of the actual columns (`id`, `user_id`, `token_hash`, `expires_at`, `used_at`, `created_at`) and indexes (`email_verification_tokens_token_hash_unique`, `email_verification_tokens_user_expires_idx`).
3. **`auth_rate_limits` Schema Discrepancies:** Documentation previously referred to `window_started_at` or omitted `expires_at` in one section while mentioning `expires_at` in another, instead of the exact columns (`key`, `scope`, `attempt_count`, `window_start`, `expires_at`, `updated_at`) and indexes (`auth_rate_limits_expires_at_idx`, `auth_rate_limits_scope_idx`).

---

## 2. Authoritative Schema Verification

### 2.1 Migration Inventory (`0000`–`0005`)

| Index | Migration Tag | SQL File | Tables Created / Modified |
| :--- | :--- | :--- | :--- |
| `0` | `0000_outgoing_thunderbolt_ross` | `0000_outgoing_thunderbolt_ross.sql` | `users`, `traveller_profiles`, `host_profiles` |
| `1` | `0001_aberrant_starjammers` | `0001_aberrant_starjammers.sql` | `roles`, `permissions`, `user_roles`, `role_permissions` |
| `2` | `0002_flawless_sentinel` | `0002_flawless_sentinel.sql` | `auth_sessions`, `password_reset_tokens` |
| `3` | `0003_security_audit_events` | `0003_security_audit_events.sql` | `security_audit_events` |
| `4` | `0004_phase_1b_schema_remediation` | `0004_phase_1b_schema_remediation.sql` | Schema constraints, indexes, and role/permission refinements |
| `5` | `0005_stabilization_verification_and_rate_limits` | `0005_stabilization_verification_and_rate_limits.sql` | `email_verification_tokens`, `auth_rate_limits` |

Together with `__drizzle_migrations` in the `public` schema, a clean migrated database contains **13 public tables**, all verified by `verifyMigratedSchema()` in `apps/api/src/infrastructure/database/migrate.ts`.

### 2.2 `email_verification_tokens` Exact Specification

| Column / Index | Type / Definition | Source Parity |
| :--- | :--- | :--- |
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL` | SQL `0005` + Drizzle `auth.ts` + Docs `04`/`05` |
| `user_id` | `uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE` | SQL `0005` + Drizzle `auth.ts` + Docs `04`/`05` |
| `token_hash` | `varchar(128) NOT NULL` | SQL `0005` + Drizzle `auth.ts` + Docs `04`/`05` |
| `expires_at` | `timestamp with time zone NOT NULL` | SQL `0005` + Drizzle `auth.ts` + Docs `04`/`05` |
| `used_at` | `timestamp with time zone` (nullable) | SQL `0005` + Drizzle `auth.ts` + Docs `04`/`05` |
| `created_at` | `timestamp with time zone DEFAULT now() NOT NULL` | SQL `0005` + Drizzle `auth.ts` + Docs `04`/`05` |
| `email_verification_tokens_token_hash_unique` | `UNIQUE INDEX ON (token_hash)` | SQL `0005` + Drizzle `auth.ts` + Docs `04`/`05` |
| `email_verification_tokens_user_expires_idx` | `INDEX ON (user_id, expires_at)` | SQL `0005` + Drizzle `auth.ts` + Docs `04`/`05` |

### 2.3 `auth_rate_limits` Exact Specification

| Column / Index | Type / Definition | Source Parity |
| :--- | :--- | :--- |
| `key` | `varchar(255) PRIMARY KEY NOT NULL` | SQL `0005` + Drizzle `auth.ts` + Docs `04`/`05` |
| `scope` | `varchar(64) NOT NULL` | SQL `0005` + Drizzle `auth.ts` + Docs `04`/`05` |
| `attempt_count` | `integer NOT NULL DEFAULT 1` | SQL `0005` + Drizzle `auth.ts` + Docs `04`/`05` |
| `window_start` | `timestamp with time zone DEFAULT now() NOT NULL` | SQL `0005` + Drizzle `auth.ts` + Docs `04`/`05` |
| `expires_at` | `timestamp with time zone NOT NULL` | SQL `0005` + Drizzle `auth.ts` + Docs `04`/`05` |
| `updated_at` | `timestamp with time zone DEFAULT now() NOT NULL` | SQL `0005` + Drizzle `auth.ts` + Docs `04`/`05` |
| `auth_rate_limits_expires_at_idx` | `INDEX ON (expires_at)` | SQL `0005` + Drizzle `auth.ts` + Docs `04`/`05` |
| `auth_rate_limits_scope_idx` | `INDEX ON (scope)` | SQL `0005` + Drizzle `auth.ts` + Docs `04`/`05` |

---

## 3. Remediation & Automated Parity Guard

1. **Updated `docs/project-stabilization/04-security-remediation-report.md`:** Corrected the schema descriptions for `email_verification_tokens` and `auth_rate_limits` and updated the rate-limit hashing documentation to describe keyed `HMAC-SHA-256` (`RATE_LIMIT_HASH_SECRET`).
2. **Updated `docs/project-stabilization/05-database-and-migration-report.md`:** Replaced the inaccurate migration table and column lists with the exact SQL `0000`–`0005` definitions and Drizzle ORM schema definitions.
3. **Automated Parity Test (`apps/api/tests/stabilization-security.test.ts`):** Added a regression test (`AUD-006: Database schema & documentation parity`) that inspects the live PostgreSQL `information_schema.columns` and `pg_indexes` for `email_verification_tokens` and `auth_rate_limits` and asserts that `04-security-remediation-report.md` and `05-database-and-migration-report.md` contain every exact column and index name and contain none of the deprecated fictional column/table names (`window_started_at`, `requested_ip`, `system_metadata`).
