# 05 — Database and Migration Report

**Project:** Global Luggage Storage Marketplace  
**Assignment:** Project Stabilization & Previous Phase Completion  
**Scope:** Workstream E (Database Schema, Drizzle Migration Chain, Snapshots, and Privilege Hardening)

---

## 1. Drizzle Migration Chain & Snapshot Integrity

Prior to stabilization, migrations `0003_system_roles.sql` and `0004_permissions_and_rbac.sql` lacked corresponding Drizzle snapshot files (`0003_snapshot.json`, `0004_snapshot.json`). During stabilization, the complete migration chain was reconciled and extended with `0005_stabilization_verification_and_rate_limits.sql`.

| Index | Tag | SQL File | Snapshot File | Purpose |
|---|---|---|---|---|
| `0` | `0000_outgoing_thunderbolt_ross` | `0000_outgoing_thunderbolt_ross.sql` | `meta/0000_snapshot.json` | Core identity, roles, permissions, profiles, sessions, password resets, and audit schema |
| `1` | `0001_empty_puff_adder` | `0001_empty_puff_adder.sql` | `meta/0001_snapshot.json` | `auth_sessions_previous_token_hash_idx`, `users_normalized_email_match_check`, and initial audit immutability trigger |
| `2` | `0002_marvelous_hercules` | `0002_marvelous_hercules.sql` | `meta/0002_snapshot.json` | Audit immutability hardening, catalog privilege revocations, and `assign_default_traveller_role` function |
| `3` | `0003_system_roles` | `0003_system_roles.sql` | `meta/0003_snapshot.json` | Seeds canonical system roles (`SUPERADMIN`, `SUPPORT`, `HOST_OWNER`, `HOST_STAFF`) |
| `4` | `0004_permissions_and_rbac` | `0004_permissions_and_rbac.sql` | `meta/0004_snapshot.json` | Seeds 26 canonical permissions, role-permission mappings, and `assign_user_role`/`revoke_user_role` functions |
| `5` | `0005_stabilization_verification_and_rate_limits` | `0005_stabilization_verification_and_rate_limits.sql` | `meta/0005_snapshot.json` | `users.email_verified_at`, `email_verification_tokens`, `auth_rate_limits`, and `REVOKE ALL ... FROM PUBLIC` on functions |

---

## 2. Schema Additions in `0005_stabilization_verification_and_rate_limits.sql`

1. **`users.email_verified_at` (`TIMESTAMPTZ`):**
   - Tracks the exact timestamp at which a user completed email verification. Backfilled for pre-existing verified users (`UPDATE "users" SET "email_verified_at" = "updated_at" WHERE "is_email_verified" = true AND "email_verified_at" IS NULL`).
2. **`email_verification_tokens` Table:**
   - Columns: `id` (`uuid PRIMARY KEY DEFAULT gen_random_uuid()`), `user_id` (`uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`), `token_hash` (`varchar(64) NOT NULL`), `expires_at` (`timestamptz NOT NULL`), `used_at` (`timestamptz`), `created_at` (`timestamptz NOT NULL DEFAULT now()`).
   - Indexes: Unique `email_verification_tokens_token_hash_unique` on `(token_hash)` and composite `email_verification_tokens_user_expires_idx` on `(user_id, expires_at)`.
3. **`auth_rate_limits` Table:**
   - Columns: `key_hash` (`varchar(64) PRIMARY KEY NOT NULL`), `scope` (`varchar(32) NOT NULL`), `points` (`integer NOT NULL DEFAULT 1`), `window_start` (`timestamptz NOT NULL DEFAULT now()`), `expires_at` (`timestamptz NOT NULL`), `updated_at` (`timestamptz NOT NULL DEFAULT now()`).
   - Indexes: `auth_rate_limits_expires_at_idx` on `(expires_at)` and `auth_rate_limits_scope_idx` on `(scope)`.
4. **Function Execution Privilege Hardening:**
   - Revokes `PUBLIC` execute permission on `public.assign_user_role(uuid, varchar, uuid)`, `public.revoke_user_role(uuid, varchar)`, and `public.prevent_audit_tampering()` and grants `EXECUTE` explicitly to `luggage_user` and `luggage_migrator`.

---

## 3. Migration Execution Verification

- Executed `pnpm --filter @luggage-storage/api db:migrate` against `luggage_storage_dev`:
  - `0005_stabilization_verification_and_rate_limits.sql` applied cleanly (`appliedCount: 1`, `totalTracked: 6`).
- Re-executed `runMigrations()` inside automated integration suites (`apps/api/tests/stabilization-security.test.ts`), confirming idempotent `0` pending migrations and full schema parity between Drizzle ORM (`apps/api/src/infrastructure/database/schema/identity.ts`) and PostgreSQL 16.

