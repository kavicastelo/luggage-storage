# 05 — Database and Migration Report

**Project:** Global Luggage Storage Marketplace  
**Assignment:** Project Stabilization & Previous Phase Completion  
**Scope:** Workstream E (Database Schema, Drizzle Migration Chain, Snapshots, and Privilege Hardening)

---

## 1. Drizzle Migration Chain & Snapshot Integrity

Prior to stabilization, migrations `0003_wp07_rbac_permissions.sql` and `0004_wp12_audit_immutability.sql` lacked corresponding Drizzle snapshot files (`0003_snapshot.json`, `0004_snapshot.json`). During stabilization, the complete migration chain was reconciled and extended with `0005_stabilization_verification_and_rate_limits.sql`.

| Index | Tag | SQL File | Snapshot File | Purpose |
|---|---|---|---|---|
| `0` | `0000_ambitious_silver_samurai` | `0000_ambitious_silver_samurai.sql` | `meta/0000_snapshot.json` | Initial system metadata table |
| `1` | `0001_empty_puff_adder` | `0001_empty_puff_adder.sql` | `meta/0001_snapshot.json` | Core identity, roles, sessions, password resets, and audit schema |
| `2` | `0002_wp02_identity_hardening` | `0002_wp02_identity_hardening.sql` | `meta/0002_snapshot.json` | Trigger guards, partial unique indexes, and role helper functions |
| `3` | `0003_wp07_rbac_permissions` | `0003_wp07_rbac_permissions.sql` | `meta/0003_snapshot.json` | 26 canonical permissions and role-permission mappings |
| `4` | `0004_wp12_audit_immutability` | `0004_wp12_audit_immutability.sql` | `meta/0004_snapshot.json` | Append-only immutability triggers on `security_audit_events` |
| `5` | `0005_stabilization_verification_and_rate_limits` | `0005_stabilization_verification_and_rate_limits.sql` | `meta/0005_snapshot.json` | `users.email_verified_at`, `email_verification_tokens`, `auth_rate_limits`, and `REVOKE ALL ... FROM PUBLIC` on functions |

---

## 2. Schema Additions in `0005_stabilization_verification_and_rate_limits.sql`

1. **`users.email_verified_at` (`TIMESTAMPTZ`):**
   - Tracks the exact timestamp at which a user completed email verification. Backfilled for pre-existing verified users (`UPDATE "users" SET "email_verified_at" = "updated_at" WHERE "is_email_verified" = true AND "email_verified_at" IS NULL`).
2. **`email_verification_tokens` Table:**
   - Columns: `id` (`UUID PK`), `user_id` (`UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`), `token_hash` (`VARCHAR(64) NOT NULL`), `expires_at` (`TIMESTAMPTZ NOT NULL`), `used_at` (`TIMESTAMPTZ`), `requested_ip` (`VARCHAR(45)`), `user_agent` (`TEXT`), `created_at` (`TIMESTAMPTZ NOT NULL DEFAULT NOW()`).
   - Indexes: Unique `email_verification_tokens_token_hash_idx` on `(token_hash)` and composite `email_verification_tokens_user_id_expires_idx` on `(user_id, expires_at)`.
3. **`auth_rate_limits` Table:**
   - Columns: `key_hash` (`VARCHAR(128) PRIMARY KEY`), `scope` (`VARCHAR(64) NOT NULL`), `points` (`INTEGER NOT NULL DEFAULT 0`), `window_started_at` (`TIMESTAMPTZ NOT NULL DEFAULT NOW()`), `expires_at` (`TIMESTAMPTZ NOT NULL`), `updated_at` (`TIMESTAMPTZ NOT NULL DEFAULT NOW()`).
   - Index: `auth_rate_limits_expires_at_idx` on `(expires_at)`.
4. **Function Execution Privilege Hardening:**
   - Revokes `PUBLIC` execute permission on `public.assign_user_role(uuid, varchar, uuid)`, `public.revoke_user_role(uuid, varchar)`, and `public.prevent_audit_tampering()` and grants `EXECUTE` explicitly to `luggage_user` and `luggage_migrator`.

---

## 3. Migration Execution Verification

- Executed `pnpm --filter @luggage-storage/api db:migrate` against `luggage_storage_dev`:
  - `0005_stabilization_verification_and_rate_limits.sql` applied cleanly (`appliedCount: 1`, `totalTracked: 6`).
- Re-executed `runMigrations()` inside automated integration suites (`apps/api/tests/stabilization-security.test.ts`), confirming idempotent `0` pending migrations and full schema parity between Drizzle ORM (`apps/api/src/infrastructure/database/schema/identity.ts`) and PostgreSQL 16.

