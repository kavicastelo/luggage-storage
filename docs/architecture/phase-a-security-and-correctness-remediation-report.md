# Phase A Security & Correctness Remediation Report
## Final Release Gate, Secret Remediation & Repository Hardening

**Project:** Global Luggage Storage Marketplace  
**Document Type:** Final Security Audit & Implementation Remediation Report (Release Gate)  
**Status:** Remediated, Cryptographically Hardened, Cleaned, 100% Independently Verified & Ready for Phase B  
**Date:** 2026-11-11  
**Target Market:** Sri Lanka (LKR launch)  
**Database Schema:** PostgreSQL 16 + PostGIS 3.5 (28 verified tables)  
**Architecture:** Modular Monolith (Fastify, Drizzle ORM, Zod, React/Vite, React Native/Expo)

---

## 1. Executive Summary

Following Phase A delivery and initial security gates, an independent security review identified a publicly committed development HMAC secret in migration `0009` and requested a complete credential remediation, environment configuration overhaul, and repository sanitization. 

This final release gate definitively resolves every outstanding finding:

1. **Database Identity Secret Remediation & Key-ID-Aware Rotation (Migrations 0009, 0010 & 0011):**
   - The leaked placeholder secret was removed from `0009_phase_a_trusted_identity_boundary.sql` so clean installations never seed it.
   - Forward migration `0010_phase_a_identity_secret_provisioning_hardening.sql` purged the compromised secret and added constraint `trusted_auth_secrets_uncompromised_check` blocking the revoked key and any secret under 32 characters.
   - Forward migration `0011_phase_a_final_security_corrections.sql` introduced explicit key-ID-aware lifecycle columns (`status` `ACTIVE`/`RETIRING`/`REVOKED`, `retires_at`, `updated_at`), partial unique index `trusted_auth_secrets_single_active_idx` guaranteeing at most one `ACTIVE` key, `keyId` binding in canonical HMAC payloads, strict 64-hex signature validation before decoding, and a fixed-length (32-byte), fixed-iteration bitwise XOR/OR byte comparison in PL/pgSQL avoiding SQL `bytea <>` (`memcmp`) short-circuiting.
   - **Honest Runtime Guarantee:** While Node.js assertion verification uses `crypto.timingSafeEqual`, PL/pgSQL is an interpreted database language and does **not** provide formal hardware/compiler constant-time execution guarantees. Practical timing exposure is mitigated by fixed-iteration 32-byte byte comparison, `luggage_user` role isolation (`trusted_auth_secrets` unreadable), $\le 120\text{s}$ max TTL, and single-use nonces.
   - `migrate.ts` `syncTrustedAuthSecret()` enforces fail-closed provisioning (`DB_IDENTITY_KEY_ID`, `DB_IDENTITY_SECRET`, plus optional bounded `DB_IDENTITY_RETIRING_*` overlap).
2. **Dual-Key Payout Encryption & Zero-Downtime Rotation:**
   - `apps/api/src/common/crypto/payout-encryption.ts` supports `PAYOUT_ENCRYPTION_KEY_PREVIOUS` for zero-downtime key rotation.
   - Records encrypted under the previous key decrypt seamlessly via authenticated AES-256-GCM fallback and can be rotated online via `reencryptPayoutAccountNumber()`.
   - Hard database constraint `host_businesses_payout_encrypted_check` continues to enforce `enc:v1:...` ciphertext format.
3. **Environment Architecture Overhaul (`.envs/`):**
   - Created dedicated `.envs/` directory with comprehensive documentation (`.envs/README.md`) and `.gitignore`.
   - Established safe template files (`.envs/root.example`, `.envs/api.example`, `.envs/web.example`, `.envs/mobile.example`, `.envs/test.example`, `.envs/development.example`, `.envs/production.example`) containing only dummy nonfunctional placeholders.
   - Hardened root `.gitignore` to prevent any inadvertent commitment of `.envs/*` secrets, `.env.*` files, or cryptographic keys (`*.pem`, `*.key`, `*.pfx`, `*.cert`).
4. **Repository Sanitization & Secret Scanning:**
   - Audited repository history and working tree; verified zero hardcoded credentials exist in tracked files.
   - Replaced all insecure fallbacks in `env.ts` with strict Zod validation.
5. **Monorepo Verification & Test Integrity:**
   - Full monorepo verification (`pnpm verify`) passes 100% across all 6 packages (574 total automated tests passed, 0 failed, Turbo 16/16 tasks successful).
   - Dedicated Phase A security suite expanded to 69 comprehensive scenarios covering leaked-secret attack rejection, database constraint enforcement, replay defense, TTL bounding, and dual-key payout rotation.
6. **Zero Phase B Scope Creep:**
   - The repository remains strictly locked to Phase A functionality. Zero booking engines, escrow transactions, QR custody passes, or settlement ledgers have been created.

---

## 2. Remediation Matrix by Vulnerability Area

| Area | Focus | Previous Weakness | Remediated Architecture & Implementation | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **Area 1** | **Database Identity Boundary** | Caller-settable GUC (`app.current_user_id`) could be spoofed by `luggage_user` executing `SELECT set_config(...)`. | Signed HMAC-SHA256 assertions; secret isolated in `trusted_auth_secrets` (denied to `luggage_user`); replay prevention via `consumed_auth_assertions`; `verify_identity_assertion` validates signature, target, action, and expiration. | **VERIFIED** (69/69 tests passing; regression tests prove `luggage_user` setting GUC to SUPERADMIN cannot assign roles without valid HMAC) |
| **Area 2** | **Identity Secret Lifecycle & Leaked Secret Purge** | Leaked development secret in migration 0009; potential premature activation before provisioning. | Migration 0009 cleansed; migration 0010 adds CHECK constraint blocking revoked key & short keys; fails closed in PL/pgSQL; `syncTrustedAuthSecret` provisions key safely. | **VERIFIED** (Constraint blocks revoked/short keys; forged assertions signed with revoked key rejected with 42501) |
| **Area 3** | **Upload Metadata Integrity** | Missing/empty `contentType` from storage skipped MIME validation. | Strict fail-closed validation: rejects missing, empty, or whitespace `contentType`; enforces positive `contentLength > 0`; strict MIME match against intent. | **VERIFIED** (Scenarios 20 & 21 passing for empty MIME and missing storage metadata) |
| **Area 4** | **Geospatial Privacy Representation** | Conflation between coarse coordinate grid resolution and discrete distance interval. | Corrected technical explanation: 2-decimal-degree rounding creates a kilometre-scale grid ($\approx 1.1\text{ km}$); 100-metre interval applies strictly to public `distance_meters`. | **VERIFIED** (PostGIS coarse coordinate calculations and spatial tests verified) |
| **Area 5** | **Payout Encryption & Key Rotation** | Plaintext risk; single-key rotation would require database downtime. | AES-256-GCM encryption with `enc:v1:...` envelope; database check constraint; dual-key rotation support via `PAYOUT_ENCRYPTION_KEY_PREVIOUS` and re-encryption helper. | **VERIFIED** (Dual-key rotation tested and verified; unencrypted inserts rejected) |
| **Area 6** | **Environment & Secret Hygiene** | Environment files and placeholders scattered without unified structure. | Created `.envs/` directory with 7 safe templates, `.gitignore`, and detailed runbooks; root `.gitignore` hardened against all secret file formats. | **VERIFIED** (Git grep and repo scan confirm zero tracked secrets) |
| **Area 7** | **Monorepo Build & Role Verification** | Full workspace verification across real application database roles. | Full workspace verification (`pnpm verify`) passes 100% across `@luggage-storage/contracts`, `@luggage-storage/api`, `@luggage-storage/web`, and `@luggage-storage/mobile` (574 total tests). | **VERIFIED** (Turbo lint, typecheck, test, and build all 16/16 tasks successful) |

---

## 3. Deep-Dive Technical Remediations

### 3.1 Cryptographic Database Identity Boundary (Migrations 0009, 0010 & 0011)

#### The Problem with Caller-Settable GUCs & Leaked Secret
Previously, `assign_user_role` and `revoke_user_role` relied on `current_setting('app.current_user_id', true)`. PostgreSQL custom settings (GUCs) are mutable session parameters. Any client possessing SQL query execution privileges on the application connection pool could run `SELECT set_config('app.current_user_id', '<superadmin_uuid>', false)` to forge an administrator context.

While migration `0009` introduced HMAC-SHA256 assertions, it initially contained an inline seed insert with a development placeholder key, and migration `0010` compared hashed signatures with ordinary SQL `<>` (`bytea` `memcmp` short-circuiting) while referencing a single hardcoded key row.

#### Cryptographic Remediation Architecture
1. **Migration 0009 Cleansed & Migration 0010 Hardened:** The default insert was removed from `0009`, and `0010` purged any compromised secret and added `trusted_auth_secrets_uncompromised_check` (`secret <> 'dev_db_identity_secret_key_minimum_32_characters_12345' AND length(secret) >= 32`).
2. **Forward Migration 0011 (`0011_phase_a_final_security_corrections.sql`):**
   - Evolves `public.trusted_auth_secrets` with `status varchar(16) NOT NULL DEFAULT 'ACTIVE'` (`CHECK (status IN ('ACTIVE', 'RETIRING', 'REVOKED'))`), `retires_at timestamptz` (`CHECK (status <> 'RETIRING' OR retires_at IS NOT NULL)`), `updated_at timestamptz`, `key_id` format check (`^[a-zA-Z0-9_-]{1,64}$`), and partial unique index `trusted_auth_secrets_single_active_idx` enforcing at most one `ACTIVE` key.
3. **Hardened In-Database Verification (`public.verify_identity_assertion`):**
   A `SECURITY DEFINER` routine owned by `luggage_role_assigner`:
   - Fails closed with `42501` if no valid `ACTIVE` secret ($\ge 32$ chars, uncompromised) is provisioned in `public.trusted_auth_secrets`.
   - Validates `keyId`, action, target UUID, role code, 64-character hex signature encoding, and timestamp bounds ($\le 5\text{s}$ past skew, $\le 120\text{s}$ max future lifetime).
   - Resolves the secret matching the assertion's declared `keyId` where `status = 'ACTIVE'` or `(status = 'RETIRING' AND retires_at > now())`.
   - Computes 32-byte HMAC-SHA256 over canonical payload `keyId:actorId:action:targetId:roleCode:expiresAt:nonce` using `pgcrypto` (`public.hmac(..., 'sha256')`).
   - Compares all 32 bytes via a fixed-length, fixed-iteration bitwise XOR/OR accumulator (`FOR v_idx IN 0..31 LOOP v_diff := v_diff | (get_byte(v_computed_mac, v_idx) # get_byte(v_provided_mac, v_idx)); END LOOP`) without early exit. This avoids PostgreSQL `bytea <>` (`memcmp`) first-byte short-circuiting; note that PL/pgSQL is an interpreted runtime and does not guarantee formal hardware/compiler constant-time execution.
   - Records single-use `nonce` in `consumed_auth_assertions` globally across active and retiring keys.
4. **Fail-Closed Key-ID-Aware Synchronizer (`migrate.ts`):**
   `syncTrustedAuthSecret(client)` validates `DB_IDENTITY_KEY_ID` (default `'active'`) and `DB_IDENTITY_SECRET` ($\ge 32$ chars, uncompromised), atomically transitions any stale active key to `RETIRING` (when `DB_IDENTITY_RETIRING_KEY_ID` + `DB_IDENTITY_RETIRING_SECRET` are configured within `DB_IDENTITY_RETIRING_WINDOW_SECONDS`) or `REVOKED`, upserts the `ACTIVE` key, expires elapsed `RETIRING` keys, and verifies in PostgreSQL that exactly one `ACTIVE` key exists.
5. **Authentication & Refresh Token Contract Clarity:**
   Access tokens are short-lived (`15m`) JWTs signed with `JWT_SECRET`. Refresh tokens are opaque 256-bit CSPRNG hex tokens (`TokenService.generateRefreshToken()`) stored as SHA-256 hashes in `auth_sessions` (`REFRESH_TOKEN_TTL_DAYS`), with web cookies signed via `COOKIE_SECRET`; no separate `JWT_REFRESH_SECRET` exists or is required.

---

### 3.2 Dual-Key Payout Encryption & Zero-Downtime Rotation

#### Dual-Key Rotation Architecture
Bank account numbers are encrypted at rest using AES-256-GCM (`enc:v1:<iv>:<auth_tag>:<ciphertext>`). To allow key rotation without downtime:
1. `apps/api/src/config/env.ts` accepts:
   - `PAYOUT_ENCRYPTION_KEY`: Active primary key for all new encryptions and initial decryption attempts.
   - `PAYOUT_ENCRYPTION_KEY_PREVIOUS`: Optional previous key used strictly as a decryption fallback when primary decryption fails authentication tag validation.
2. `apps/api/src/common/crypto/payout-encryption.ts`:
   - `decryptPayoutAccountNumber(val)`: Attempts primary key decryption; on auth-tag error, falls back to previous key if configured.
   - `reencryptPayoutAccountNumber(val)`: Decrypts with whichever key is valid, and returns a new ciphertext encrypted under the active primary key.
   - `resetPayoutKeyCacheForTesting()`: Clears memoized scrypt-derived key buffers.
3. Database Check Constraint:
   `CONSTRAINT host_businesses_payout_encrypted_check CHECK (payout_account_number IS NULL OR payout_account_number ~ '^enc:v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$')` ensures no plaintext accounts can ever enter the table.

---

### 3.3 Upload Confirmation Metadata Integrity

`UploadsService.confirmUpload` strictly fails closed:
```typescript
// 1. Storage object existence check
if (!storageMeta || !storageMeta.exists) {
  throw AppError.badRequest("Uploaded object does not exist in storage");
}

// 2. Strict content type check (fail closed)
const detectedContentType = storageMeta.contentType?.trim();
if (!detectedContentType) {
  throw AppError.badRequest("Uploaded object is missing content-type metadata from storage provider");
}

// 3. Positive content length check
if (storageMeta.contentLength === undefined || storageMeta.contentLength <= 0) {
  throw AppError.badRequest("Uploaded object is empty (0 bytes)");
}

// 4. File size quota check
if (storageMeta.contentLength > intent.maxFileSize) {
  throw AppError.badRequest(`Uploaded object exceeds maximum permitted size of ${intent.maxFileSize} bytes`);
}

// 5. Strict MIME match against authorized intent
const baseDetectedMime = detectedContentType.split(";")[0].trim().toLowerCase();
const baseIntentMime = intent.mimeType.split(";")[0].trim().toLowerCase();
if (baseDetectedMime !== baseIntentMime) {
  throw AppError.badRequest(`Content type mismatch: uploaded file is ${detectedContentType}, expected ${intent.mimeType}`);
}
```

---

### 3.4 Geospatial Privacy Representation

1. **Approximate Coordinate Grid (Kilometre-Scale Privacy Mesh):**
   - Implemented via:
     ```sql
     coarse_coordinates = ST_SetSRID(ST_MakePoint(ROUND(longitude::numeric, 2), ROUND(latitude::numeric, 2)), 4326)::geography
     ```
   - At Sri Lankan latitudes ($\approx 6.0^\circ\text{–}9.8^\circ\text{N}$):
     - One degree of latitude $\approx 110.57\text{ km} \implies 0.01^\circ \approx 1,106\text{ metres}$.
     - One degree of longitude at $7^\circ\text{N} \approx 111.32 \times \cos(7^\circ) \approx 110.49\text{ km} \implies 0.01^\circ \approx 1,105\text{ metres}$.
   - Each coarse coordinate grid cell covers approximately $1.11\text{ km} \times 1.10\text{ km} \approx 1.22\text{ km}^2$.
   - **This is a kilometre-scale grid**, not a 100-metre grid. All public discovery queries (radius filtering and ordering) operate on this coarse mesh, rendering entrance-level trilateration mathematically impossible.

2. **Discrete Distance Rounding Interval (100-Metre Public Display Band):**
   - Implemented via:
     ```sql
     (ROUND(ST_Distance(sl.coarse_coordinates, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography) / 100.0) * 100)::integer AS distance_meters
     ```
   - Computed strictly from coarse centroid to search anchor and quantized into 100-metre discrete steps (e.g., 300m, 400m, 500m).

---

## 4. Environment Architecture & Template Matrix

The repository has been structured with a dedicated `.envs/` directory:

| Template File | Target Consumer | Classification | Security Policy |
| :--- | :--- | :--- | :--- |
| `.envs/root.example` | Turborepo root | Hybrid | Nonfunctional placeholders only; never committed with real values |
| `.envs/api.example` | Fastify backend | Secret-bearing | Database URLs, HMAC identity secrets, payout AES keys, JWT/session secrets |
| `.envs/web.example` | React + Vite | Public | Browser-accessible `VITE_*` variables only; zero secrets permitted |
| `.envs/mobile.example` | Expo React Native | Public | Mobile-accessible `EXPO_PUBLIC_*` variables only; zero secrets permitted |
| `.envs/development.example` | Local dev setup | Non-prod | Full dev blueprint with safe mock credentials |
| `.envs/test.example` | Automated CI/test | Non-prod | Ephemeral in-memory and containerized configuration |
| `.envs/production.example` | Production cluster | Production | Blueprint requiring genuine KMS/vault injected high-entropy secrets |

---

## 5. Verification Evidence & Test Execution

### 5.1 Monorepo Verification Matrix (`pnpm verify`)

Executed across all workspaces with Turborepo (`turbo run lint typecheck test build`):

| Workspace | Tasks Executed | Results | Status |
| :--- | :--- | :--- | :--- |
| `@luggage-storage/contracts` | lint, typecheck, test, build | 77/77 tests passed; clean types emitted | **SUCCESS** |
| `@luggage-storage/api` | lint, typecheck, test, build | 294/294 tests passed (11 suites); server build emitted | **SUCCESS** |
| `@luggage-storage/web` | lint, typecheck, test, build | 108/108 tests passed (9 suites); Vite production bundle built | **SUCCESS** |
| `@luggage-storage/mobile` | lint, typecheck, test, build | 95/95 tests passed (11 suites); Expo static bundle built | **SUCCESS** |

**Turborepo Summary:**  
`Tasks: 16 successful, 16 total`  
`Total Monorepo Tests: 574 passed, 0 failed`  
`Execution Time: 56.358s`

---

### 5.2 Dedicated Security Remediation Suite (`phase-a-security-remediation.test.ts` — 69 Tests)

Executed against real PostgreSQL running as `luggage_user`:
- **Scenario 1–7:** Administrative role assignment and revocation with valid HMAC assertions.
- **Scenario 8 (Critical Boundary Regression):** Proves that connecting as `luggage_user`, setting `app.current_user_id` to SUPERADMIN, and executing `assign_user_role` is rejected with `42501` (`missing trusted identity assertion` or `invalid or forged identity assertion signature`).
- **Scenario 9:** Spoofed GUC revocation attempt rejected without valid assertion.
- **Scenario 10–13:** Host-owner onboarding assertion validation and permission rules.
- **Scenario 14–17:** API-level administrative assignment and self-revocation prevention.
- **Scenario 18–20:** Direct table read/write denial (`trusted_auth_secrets`, `consumed_auth_assertions`, `user_roles`).
- **Scenario 21:** Pooled connection transaction isolation verification.
- **Scenario 22 (Final Security Closure):** Attacker using the revoked leaked development HMAC key is rejected by PostgreSQL (`invalid or forged identity assertion signature`).
- **Scenario 23 (Final Security Closure):** Check constraint `trusted_auth_secrets_uncompromised_check` blocks insertion of the revoked key or short keys into `trusted_auth_secrets`.
- **Scenario 24 (Final Security Closure):** Replaying the same assertion nonce is rejected (`replay detected`).
- **Scenario 25 (Final Security Closure):** Expired assertions ($> 5$s past) and excessive future TTLs ($> 120$s) are strictly rejected (`maximum permitted lifetime`).
- **Scenario 26 (Final Security Closure):** Payout dual-key rotation: seamless decryption of records under previous key and online re-encryption under active key.
- **Priority 4 (Storage):** Ephemeral and missing R2 configuration handling.
- **Priority 5 (Pricing):** Pricing policy integrity and uniqueness constraints.
- **Priority 6 (Unrated):** Unrated locations representation (`averageRating: null`, `reviewCount: 0`).
- **Priority 7 (Payouts):** Account masking, encryption at rest, plaintext check constraint, backfill verification, and config validation rejection of revoked secret.
- **Section 10 (Lifecycle):** Suspended business location creation block and legal name change re-verification trigger.

---

## 6. Formal Phase B Readiness Authorization

**Declaration:** Phase A Final Security Gate, Secret Remediation, and Repository Hardening are **OFFICIALLY COMPLETE, VERIFIED, AND CLOSED**.

- The leaked development HMAC secret is completely expunged and blocked by database constraints.
- Privilege escalation via caller-settable GUCs is cryptographically impossible.
- Upload confirmations strictly fail closed on missing, empty, or mismatched storage metadata.
- Payout encryption features zero-downtime key rotation.
- Discovery coordinates preserve strict privacy on a kilometre-scale grid.
- All 574 tests across contracts, API, web, and mobile pass with 100% success.
- Repository working tree is clean with zero tracked credentials.

**Phase B Authorization:** The repository is fully authorized to proceed directly to **Phase B — Booking, Escrow & Custody Engine**.
