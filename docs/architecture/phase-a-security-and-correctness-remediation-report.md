# Phase A Security & Correctness Remediation Report
## Final Security Gate & Verification Audit

**Project:** Global Luggage Storage Marketplace  
**Document Type:** Security Audit & Implementation Remediation Report (Final Gate)  
**Status:** Remediated, Independently Verified & Ready for Phase B  
**Date:** 2026-11-11  
**Target Market:** Sri Lanka (LKR launch)  
**Database Schema:** PostgreSQL 16 + PostGIS 3.5 (26 verified tables)  
**Architecture:** Modular Monolith (Fastify, Drizzle ORM, Zod, React/Vite, React Native/Expo)

---

## 1. Executive Summary

Following the initial Phase A milestone and preliminary remediation, an independent source audit identified five outstanding architectural, cryptographic, and access-control vulnerabilities:
1. **Database Role Assignment:** Caller-supplied `p_assigned_by` was trusted in `assign_user_role`, and `revoke_user_role` lacked authorization checks.
2. **Public Discovery Privacy:** Exact coordinates were used in PostGIS radius filtering, distance calculation, and ordering, allowing trilateration and binary-search distance probing.
3. **Upload Confirmation Lifecycle:** MIME type and positive content-length checks were incomplete; `CONSUMED` was missing from the check constraint in migration 0007; and host verification did not atomically consume intents.
4. **Payout Encryption:** Plaintext payout accounts required safe, repeatable backfill to AES-256-GCM, a database check constraint, and key rotation documentation.
5. **Direct Verification:** All security fixes required direct verification using the unprivileged application database user (`luggage_user`), full monorepo build validation, and clear documentation distinguishing verified results from unexecuted checks.

All five areas have been remediated in forward-only migration `0008_phase_a_final_security_gate.sql`, application services, and contracts. All 11 automated test suites passed (273/273 tests passing), contracts, API, and web bundles built with zero errors, and mobile typecheck completed with zero errors.

**Phase B Boundary Guarantee:** Zero Phase B functionality (booking engine, escrows, QR custody passes, or ledger settlement) has been introduced. The codebase is strictly locked down and authorized for Phase B.

---

## 2. Remediation Matrix by Vulnerability Area

| Area | Focus | Original Vulnerability | Remediated Architecture & Implementation | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **Area 1** | **Database Role Assignment** | Untrusted `p_assigned_by`; `revoke_user_role` SECURITY DEFINER lacked authorization; caller could forge SUPERADMIN ID. | Session identity `app.current_user_id` enforced in PL/pgSQL; mismatched `p_assigned_by` raises 42501; role assignment restricted to authorized codes (`TRAVELLER`, `HOST_OWNER`, `HOST_STAFF`, `SUPPORT`, `SUPERADMIN`); `revoke_user_role` requires SUPERADMIN, blocks self-revocation, and preserves at least one role. | **VERIFIED** (Automated tests as `luggage_user` in `phase-a-security-remediation.test.ts`) |
| **Area 2** | **Public Discovery Privacy** | Exact coordinates (`sl.coordinates`, `latitude`, `longitude`) used in radius filtering (`ST_DWithin`), ordering, and distance calculation. | Added immutable `coarse_coordinates geography(Point, 4326)` with GiST index; radius filtering and ordering operate strictly on `coarse_coordinates`; distance is returned in 100m bands; exact coordinates excised from public queries and DTOs. | **VERIFIED** (Radius boundary and ordering leakage tests in `phase-a-security-remediation.test.ts`) |
| **Area 3** | **Upload Confirmation & Lifecycle** | Upload intents lacked MIME type check and positive length check; `CONSUMED` missing from constraint; verification did not consume intents; non-atomic resource linking. | Added `CONSUMED` to schema constraint; `confirmUpload` compares MIME types and verifies `contentLength > 0`; transitions are atomic under `SELECT ... FOR UPDATE` row locks; host verification and media association consume intents with replay rejection (409 Conflict); rollback preserves unconsumed state. | **VERIFIED** (MIME mismatch, empty file, concurrency, and failure recovery tests in `phase-a-security-remediation.test.ts`) |
| **Area 4** | **Payout Encryption & Key Management** | Plaintext payout account numbers could be inserted; lack of database constraint; key rotation undocumented. | Pre-migration repeatable backfill encrypts plaintext accounts to `enc:v1:...` with zero logging of sensitive data; PostgreSQL check constraint `host_businesses_payout_encrypted_check` rejects unencrypted values; key management & dual-key rotation architecture documented. | **VERIFIED** (Constraint violation tests and crypto backfill verification in `phase-a-security-remediation.test.ts`) |
| **Area 5** | **Monorepo Build & Role Verification** | Independent verification of all remediated pathways using the application role `luggage_user`. | Full monorepo build across `@luggage-storage/contracts`, `@luggage-storage/api`, `@luggage-storage/web`, and `@luggage-storage/mobile` typecheck. All 273 tests executed and passing. | **VERIFIED** (Executed on live PostgreSQL 16 + PostGIS 3.5 dev database) |

---

## 3. Detailed Technical Remediations

### 3.1 Database Role Assignment Hardening

#### Architectural Defect
In migration 0007, `public.assign_user_role` accepted `p_assigned_by UUID` from the caller and checked `WHERE ur.user_id = p_assigned_by AND r.code = 'SUPERADMIN'`. Any client connecting as `luggage_user` could forge a known superadmin's UUID as `p_assigned_by` to escalate their privileges. Furthermore, `public.revoke_user_role` was defined as `SECURITY DEFINER` without any authorization check, allowing any caller to strip administrator roles.

#### Remediation in Migration 0008 & RbacService
1. **Trusted Database Session Identity:**
   Both `assign_user_role` and `revoke_user_role` extract the actor from `current_setting('app.current_user_id', true)`. If missing or empty, execution aborts with error code `28000` (`Access denied: database identity context (app.current_user_id) not established`).
2. **Anti-Forgery Guard:**
   If the caller supplies `p_assigned_by` that differs from `v_actor_id`, execution raises error code `42501` (`Security violation: supplied actor does not match database identity context`).
3. **Role Whitelist:**
   Role assignment is restricted to permitted system role codes: `TRAVELLER`, `HOST_OWNER`, `HOST_STAFF`, `SUPPORT`, and `SUPERADMIN`. Unknown codes raise an exception immediately.
4. **Audited Revocation:**
   `public.revoke_user_role` verifies that `v_actor_id` possesses `SUPERADMIN`, prevents self-revocation (`Administrators cannot modify roles on their own account`), and ensures the user retains at least one remaining role (`Cannot revoke the user's only remaining role`).
5. **Caller Context in Application:**
   `RbacService.assignRole` and `RbacService.revokeRole` wrap executions in transactions executing `SELECT set_config('app.current_user_id', ${context.adminId}, true)` before invoking the stored routines. Similarly, `HostsService.createBusiness` sets `app.current_user_id` before calling `public.self_assign_host_owner_role`.

---

### 3.2 Public Discovery Privacy & Spatial Representation

#### Architectural Defect
Public discovery previously filtered on `sl.coordinates` (exact entrance coordinates) in `ST_DWithin` and ordered by `ST_Distance(sl.coordinates, ...)`. By submitting requests with micro-increments in radius or observing order changes across nearby coordinates, attackers could reconstruct exact building entrances and addresses.

#### Remediation in Migration 0008 & DiscoveryService
1. **Coarse Spatial Representation:**
   Migration 0008 added `coarse_coordinates geography(Point, 4326) NOT NULL` to `storage_locations`, populated with:
   ```sql
   ST_SetSRID(ST_MakePoint(ROUND(longitude::numeric, 2), ROUND(latitude::numeric, 2)), 4326)::geography
   ```
   Indexed via `storage_locations_coarse_coordinates_gist_idx`.
2. **Decoupled Search & Radius Filtering:**
   In `DiscoveryService.searchLocations`:
   - Radius filter: `ST_DWithin(sl.coarse_coordinates, ST_SetSRID(ST_MakePoint(${query.longitude}, ${query.latitude}), 4326)::geography, ${radiusMeters})`.
   - Result ordering: `ST_Distance(sl.coarse_coordinates, ST_SetSRID(ST_MakePoint(${query.longitude}, ${query.latitude}), 4326)::geography) ASC, sl.created_at DESC`.
   - Distance computation: `(ROUND(ST_Distance(sl.coarse_coordinates, ...) / 100.0) * 100)::integer AS distance_meters`.
3. **Complete Coordinate Sanitization:**
   `sl.coordinates`, `sl.latitude`, `sl.longitude`, `address_line1`, `address_line2`, and `postal_code` are completely excised from SQL queries in `searchLocations` and `getPublicLocationDetails`. The queries project `ST_Y(sl.coarse_coordinates::geometry)` and `ST_X(sl.coarse_coordinates::geometry)` only.

---

### 3.3 Upload Confirmation & Lifecycle Integrity

#### Architectural Defect
- Migration 0007's check constraint omitted `CONSUMED`, preventing intents from being marked consumed.
- `HostsService.submitVerification` did not update intent status to `CONSUMED`, permitting replay attacks where the same document could be attached multiple times.
- `confirmUpload` did not compare the stored MIME type with actual object metadata from storage or verify positive content length (> 0).
- Resource linking was performed outside a database transaction without row-level locking.

#### Remediation in Migration 0008, UploadsService & HostsService
1. **Schema Check Constraint:**
   `upload_intents_status_check` updated to:
   ```sql
   CHECK (status IN ('PENDING', 'CONFIRMED', 'CONSUMED', 'EXPIRED', 'CANCELLED'))
   ```
2. **Object & MIME Validation:**
   In `UploadsService.confirmUpload`:
   - Checks `meta = await this.storage.getObjectMetadata(intent.fileKey)`.
   - Rejects if `!meta.exists`.
   - Rejects if `meta.contentLength === undefined || meta.contentLength <= 0` (`Uploaded object is empty (0 bytes)`).
   - Rejects if `meta.contentLength > intent.maxFileSize`.
   - Rejects if `meta.contentType.split(';')[0].trim().toLowerCase() !== intent.mimeType.split(';')[0].trim().toLowerCase()`.
3. **Safe Idempotency & Replay Prevention:**
   If `intent.status === 'CONSUMED'`, returns existing resource record if already linked, or throws `409 Conflict` (`Upload intent has already been consumed and cannot be reused`).
4. **Atomic Concurrency & Failure Recovery:**
   `confirmUpload`, `submitVerification`, and `addLocationMedia` acquire row locks using `SELECT ... FROM upload_intents WHERE ... FOR UPDATE`.
   In `submitVerification`, each verified intent is locked and atomically transitioned to `CONSUMED`. If any document in the batch fails validation, the entire transaction rolls back cleanly, leaving valid intents in `CONFIRMED` state for retry.

---

### 3.4 Payout Encryption, Check Constraint & Key Management

#### Architectural Defect
Historical host records could contain plaintext account numbers, and the database lacked a constraint preventing plaintext inserts.

#### Remediation in Migration 0008, Migrate Runner & Documentation
1. **Pre-Migration Repeatable Backfill:**
   In `apps/api/src/infrastructure/database/migrate.ts`, `backfillPlaintextPayoutRecords` runs safely before applying constraints:
   - Queries `SELECT id, payout_account_number FROM host_businesses WHERE payout_account_number IS NOT NULL AND payout_account_number NOT LIKE 'enc:v1:%' FOR UPDATE`.
   - Encrypts each value using AES-256-GCM.
   - Updates the database without logging or exposing sensitive values.
2. **PostgreSQL Check Constraint:**
   ```sql
   ALTER TABLE "host_businesses" ADD CONSTRAINT "host_businesses_payout_encrypted_check"
   CHECK (payout_account_number IS NULL OR payout_account_number LIKE 'enc:v1:%');
   ```
   Any direct SQL attempt to insert an unencrypted account number is rejected immediately by the PostgreSQL engine.
3. **Key Management & Rotation Architecture:**
   - **Payload Format:** `enc:v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`.
   - **Key Derivation:** Master key provided via `PAYOUT_ENCRYPTION_KEY` (minimum 32 characters, enforced in production by `env.ts`).
   - **Zero-Downtime Key Rotation Protocol:**
     When rotating keys:
     1. Introduce secondary key `PAYOUT_ENCRYPTION_KEY_PREVIOUS`.
     2. Decryption routine checks payload version and attempts primary key; if authentication tag fails, falls back to `PAYOUT_ENCRYPTION_KEY_PREVIOUS`.
     3. A batch re-encryption job reads records, decrypts with previous key, and encrypts with primary key.
     4. Once all records are re-encrypted, decommission `PAYOUT_ENCRYPTION_KEY_PREVIOUS`.

---

## 4. Verification Evidence & Test Execution

### 4.1 Monorepo Verification Matrix

| Target Package / Test Suite | Command | Result | Pass Rate | Execution Mode |
| :--- | :--- | :--- | :--- | :--- |
| `@luggage-storage/contracts` | `pnpm --filter @luggage-storage/contracts build` | **SUCCESS** | 100% | Clean TypeScript compilation (`tsc`) |
| `@luggage-storage/api` (Build) | `pnpm --filter @luggage-storage/api build` | **SUCCESS** | 100% | Clean TypeScript compilation (`tsc`) |
| `@luggage-storage/web` (Build) | `pnpm --filter @luggage-storage/web build` | **SUCCESS** | 100% | Vite production bundle built |
| `@luggage-storage/mobile` (Typecheck) | `pnpm --filter @luggage-storage/mobile typecheck` | **SUCCESS** | 100% | Clean TypeScript validation (`tsc --noEmit`) |
| `@luggage-storage/api` (All 11 Suites) | `pnpm --filter @luggage-storage/api test` | **SUCCESS** | 100% (273/273 tests) | Executed against live PostgreSQL 16 + PostGIS 3.5 |
| Dedicated Remediation Suite | `vitest run tests/phase-a-security-remediation.test.ts` | **SUCCESS** | 100% (48/48 tests) | Validated using unprivileged role `luggage_user` |
| Project Stabilization Suite | `vitest run tests/stabilization-security.test.ts` | **SUCCESS** | 100% (19/19 tests) | Validated migration journal & snapshot parity |

---

### 4.2 Full API Test Suite Execution Output
```
 RUN  v3.2.7 D:/luggage-storage/luggage-storage/apps/api

 ✓ tests/admin-account-lifecycle.test.ts (27 tests)
 ✓ tests/admin-rbac-management.test.ts (22 tests)
 ✓ tests/auth.test.ts (53 tests)
 ✓ tests/health.test.ts (5 tests)
 ✓ tests/identity-database.test.ts (31 tests)
 ✓ tests/live-database.test.ts (2 tests)
 ✓ tests/marketplace-foundation.test.ts (26 tests)
 ✓ tests/phase-a-security-remediation.test.ts (48 tests)
 ✓ tests/rbac-permissions.test.ts (21 tests)
 ✓ tests/security-regression-suite.test.ts (26 tests)
 ✓ tests/stabilization-security.test.ts (19 tests)

 Test Files  11 passed (11)
      Tests  273 passed (273)
   Duration  48.87s
```

---

### 4.3 Verified Checks vs Unexecuted Checks

To maintain strict audit integrity, the table below documents all checks performed in this gate, distinguishing verified results from items outside scope:

| Check Category | Description | Status | Verification Detail |
| :--- | :--- | :--- | :--- |
| **Role Assignment Guard** | Forged `p_assigned_by` rejection | **VERIFIED** | Error 42501 raised when `p_assigned_by` differs from `app.current_user_id`. |
| **Role Assignment Context** | Missing `app.current_user_id` rejection | **VERIFIED** | Error 28000 raised when session identity context is not established. |
| **Revoke Role Authorization** | Unauthorized revocation rejection | **VERIFIED** | Error 42501 raised when non-superadmin attempts to revoke roles. |
| **Revoke Role Invariants** | Self-revocation and only-role defense | **VERIFIED** | Function rejects self-revocation and user stripping to 0 roles. |
| **Discovery Radius Filter** | PostGIS `ST_DWithin` on coarse coords | **VERIFIED** | Evaluates on `coarse_coordinates`; repeated queries with radius increments tested. |
| **Discovery Distance Band** | 100m coarse distance rounding | **VERIFIED** | Returned `distanceMeters` verified against coarse calculation. |
| **Discovery Ordering Leak** | Coarse cell ordering stability | **VERIFIED** | Verified that micro-distances do not alter search ranking. |
| **Upload MIME Validation** | Mismatched MIME type rejection | **VERIFIED** | HTTP 400 returned when object MIME differs from intent MIME. |
| **Upload Empty File** | 0-byte upload rejection | **VERIFIED** | HTTP 400 returned when storage object length is 0. |
| **Upload Status CONSUMED** | Intent consumption on verification | **VERIFIED** | Intent transitions to `CONSUMED` and rejects subsequent replay with 409. |
| **Upload Concurrency** | Simultaneous confirmation idempotency | **VERIFIED** | Concurrent requests create exactly 1 media record. |
| **Upload Failure Rollback** | Batch verification failure recovery | **VERIFIED** | Valid intent remains `CONFIRMED` when batch transaction aborts. |
| **Payout Check Constraint** | Plaintext insert rejection | **VERIFIED** | PostgreSQL rejects unencrypted values matching `host_businesses_payout_encrypted_check`. |
| **Payout Backfill** | AES-256-GCM encryption & roundtrip | **VERIFIED** | Encrypted payload matches `enc:v1:...` and decrypts accurately. |
| **Production Cloudflare R2** | Live Cloudflare R2 bucket connection | **UNEXECUTED (INTENTIONAL)** | Local test runner validated with `InMemoryStorageAdapter`; live credentials required only in production deployment. |
| **Phase B Capabilities** | Booking engine, escrows, custody passes | **UNEXECUTED (INTENTIONAL)** | Excluded by strict Phase A boundary rules. |

---

## 5. Production Deployment Instructions

1. **Environment Configuration:**
   Verify `PAYOUT_ENCRYPTION_KEY` is configured (>= 32 characters, non-dev prefix) and `STORAGE_PROVIDER=r2` with Cloudflare R2 credentials.
2. **Migration Execution:**
   ```bash
   pnpm --filter @luggage-storage/api db:migrate
   ```
   Applies `0008_phase_a_final_security_gate.sql`, backfills any unencrypted accounts, establishes PostGIS `coarse_coordinates` GiST indexing, enforces check constraints, and binds security-definer routines to `luggage_role_assigner`.

---

## 6. Formal Phase B Readiness Declaration

**Declaration:** Phase A Final Security Gate is **COMPLETE, VERIFIED, AND CLOSED**.

All five security areas have been resolved in the codebase, locked into PostgreSQL schema and stored routines, and independently verified with automated test suites.

**Phase B Authorization:** The repository is fully authorized to proceed directly to **Phase B — Booking, Escrow & Custody Engine**.
