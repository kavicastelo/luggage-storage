# Environment Configuration & Secret Management Architecture

This directory (`.envs/`) documents the canonical environment configuration structure for the **Global Luggage Storage Marketplace**.

---

## 1. Directory Structure

```text
.envs/
  ├── README.md               # This document (specification & operations)
  ├── .gitignore              # Ignores all non-example local environment files
  ├── root.example            # Root monorepo template (Docker, toolchains)
  ├── api.example             # Fastify API server template
  ├── web.example             # React + Vite web client template
  ├── mobile.example          # React Native + Expo mobile client template
  ├── test.example            # Automated test runner & Vitest profile
  ├── development.example     # Local developer machine profile
  └── production.example      # Production deployment reference specification
```

---

## 2. Server-Only Secrets vs. Public Client Configuration

To prevent client-side credential leakage, the monorepo strictly separates runtime environments:

### Server-Only Secrets (NEVER expose to clients)
These variables must **never** be prefixed with `VITE_` or `EXPO_PUBLIC_`, and must never be referenced by `apps/web` or `apps/mobile`:
- `DATABASE_URL` / `MIGRATION_DATABASE_URL`: Direct database connection strings.
- `DB_IDENTITY_SECRET` / `DB_IDENTITY_RETIRING_SECRET`: HMAC-SHA256 signing secrets for PostgreSQL database identity assertions (`DB_IDENTITY_KEY_ID` / `DB_IDENTITY_RETIRING_KEY_ID` identify keys).
- `PAYOUT_ENCRYPTION_KEY` / `PAYOUT_ENCRYPTION_KEY_PREVIOUS`: AES-256-GCM bank account encryption keys.
- `JWT_SECRET` / `COOKIE_SECRET`: Short-lived access JWT and signed web cookie keys.
- `RATE_LIMIT_HASH_SECRET`: HMAC secret for client identifier anonymization.
- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`: Cloudflare R2 object storage access keys.
- `ZOHO_SMTP_PASSWORD` / `RESEND_API_KEY`: Transactional email credentials.
- `PAYMENT_WEBHOOK_SECRET` / `PAYHERE_MERCHANT_SECRET`: Payment webhook HMAC signing secret and PayHere merchant verification secret.
- `CUSTODY_TOKEN_HMAC_SECRET`: Dedicated keyed HMAC-SHA256 secret ($\ge 32$ characters, never stored in PostgreSQL or client bundles) used exclusively for single-use custody QR tokens and 6-digit PIN verification (`hmac-sha256-v2`).

### Public Client Configuration (Safe for Bundling)
Only variables explicitly designed for client bundle inclusion are permitted:
- `VITE_API_URL`: Fastify API backend URL consumed by React web app.
- `VITE_ENABLE_DEMO_PREVIEW`: Boolean flag toggling read-only sandbox preview mode (`false` in production).
- `EXPO_PUBLIC_API_URL`: Fastify API backend URL consumed by React Native mobile app.

---

## 3. Authentication & Refresh Token Design

The platform uses a split token architecture (`apps/api/src/modules/auth/token.service.ts` and `session.service.ts`):
1. **Access Tokens (Stateless JWT):** Signed using `JWT_SECRET` via `@fastify/jwt` with short lifetime `JWT_ACCESS_EXPIRATION` (default `15m`).
2. **Refresh Tokens (Opaque CSPRNG + SHA-256 Hash):** Refresh tokens are **not** JWTs and there is **no** `JWT_REFRESH_SECRET` environment variable. `TokenService.generateRefreshToken()` generates 256-bit cryptographically random hex strings (`crypto.randomBytes(32).toString('hex')`) and persists only SHA-256 hashes (`refresh_token_hash`, `previous_token_hash`) in PostgreSQL `auth_sessions` bounded by `REFRESH_TOKEN_TTL_DAYS` (default `7` days), with row-locked rotation and automatic session revocation on token reuse.
3. **Web Session Cookies:** HTTP-only refresh cookies for web clients are signed using `COOKIE_SECRET` (`COOKIE_SECURE=true` in production).

---

## 4. Cryptographic Secret Generation

Generate distinct, high-entropy 256-bit cryptographic secrets for each domain:

```bash
# Using OpenSSL:
openssl rand -hex 32

# Using Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Each security domain (`DB_IDENTITY_SECRET`, `PAYOUT_ENCRYPTION_KEY`, `JWT_SECRET`, `COOKIE_SECRET`, `RATE_LIMIT_HASH_SECRET`, `PAYMENT_WEBHOOK_SECRET`, `CUSTODY_TOKEN_HMAC_SECRET`) **must have its own distinct, randomly generated key**. Reusing a secret across domains is prohibited (`EnvSchema` rejects reuse of `CUSTODY_TOKEN_HMAC_SECRET` across identity, rate-limit, and payment webhook secrets).

---

## 5. Database Identity Secret Provisioning & Verification Guarantees

The `DB_IDENTITY_SECRET` authorizes privileged role assignment and revocation operations in PostgreSQL:

1. **Environment Validation:** `EnvSchema` validates `DB_IDENTITY_KEY_ID` (`^[a-zA-Z0-9_-]{1,64}$`, default `active`) and `DB_IDENTITY_SECRET` ($\ge 32$ chars, never matching any revoked development secret).
2. **Database Provisioning (`public.trusted_auth_secrets`):** When `pnpm db:migrate` runs, `syncTrustedAuthSecret()` synchronizes `trusted_auth_secrets (key_id, secret, status, retires_at, updated_at)`. Partial unique index `trusted_auth_secrets_single_active_idx` enforces at most one `ACTIVE` key at any instant.
3. **Table Isolation:** `public.trusted_auth_secrets` and `public.consumed_auth_assertions` are inaccessible to `PUBLIC` and runtime role `luggage_user`. Only `luggage_role_assigner` (owner of the `SECURITY DEFINER` routines) can read `trusted_auth_secrets` and manage `consumed_auth_assertions`.
4. **Assertion Verification (`public.verify_identity_assertion`):**
   - Validates `keyId`, action, target UUID, role code, and timestamp bounds ($\le 5\text{s}$ clock skew past, $\le 120\text{s}$ max future lifetime).
   - Validates 64-character hex signature encoding prior to decoding.
   - Computes HMAC-SHA256 over canonical payload `keyId:actorId:action:targetId:roleCode:expiresAt:nonce` using `pgcrypto`.
   - Compares all 32 MAC bytes via a fixed-length, fixed-iteration bitwise XOR/OR accumulator without early exit (avoiding SQL `bytea <>` short-circuiting). Note: PL/pgSQL is an interpreted runtime and does not provide formal hardware/compiler constant-time guarantees; practical timing exposure is further bounded by role isolation, $\le 120\text{s}$ TTL, and single-use nonces.
   - Records single-use `nonce` in `public.consumed_auth_assertions` globally across active and retiring keys.
5. **Fail-Closed Protection:** If `trusted_auth_secrets` has no valid `ACTIVE` row, or if an assertion references an unknown, `REVOKED`, or expired `RETIRING` `keyId`, `verify_identity_assertion` raises error `42501`.

---

## 6. Secret Rotation Procedures

### 6.1 Rotating `DB_IDENTITY_SECRET` (Key-ID-Aware Bounded Overlap)
1. Generate a new 64-character hex secret and choose a new key identifier (e.g. `key_2026_11_b`).
2. Configure the rotation overlap in the migration/API environment:
   - `DB_IDENTITY_KEY_ID=key_2026_11_b`
   - `DB_IDENTITY_SECRET=<NEW_64_CHAR_HEX_SECRET>`
   - `DB_IDENTITY_RETIRING_KEY_ID=<PREVIOUS_KEY_ID>` (e.g. `active`)
   - `DB_IDENTITY_RETIRING_SECRET=<PREVIOUS_SECRET>`
   - `DB_IDENTITY_RETIRING_WINDOW_SECONDS=300` (bounded overlap: 30–3600s)
3. Run `pnpm --filter @luggage-storage/api db:migrate` (invokes `syncTrustedAuthSecret()`), which atomically sets the new key to `ACTIVE` and transitions the previous key to `RETIRING` until `NOW() + 300s`.
4. Roll out API instances with the new `DB_IDENTITY_KEY_ID` and `DB_IDENTITY_SECRET`. In-flight assertions signed with the retiring key continue to verify during the bounded window while nonce replay protection remains enforced globally.
5. After `DB_IDENTITY_RETIRING_WINDOW_SECONDS` elapses (exceeding the 60s assertion TTL), PostgreSQL automatically rejects the expired `RETIRING` key (`retires_at <= now()`). Unset `DB_IDENTITY_RETIRING_KEY_ID` and `DB_IDENTITY_RETIRING_SECRET`; subsequent runs of `syncTrustedAuthSecret()` mark the retired row `REVOKED`.
6. **Emergency Immediate Revocation:** To invalidate a suspected key immediately without an overlap window, omit `DB_IDENTITY_RETIRING_*`, set the new `DB_IDENTITY_KEY_ID` and `DB_IDENTITY_SECRET`, and run `pnpm --filter @luggage-storage/api db:migrate`. All previous keys are immediately marked `REVOKED` in the same transaction.

### 6.2 Rotating `PAYOUT_ENCRYPTION_KEY` (Dual-Key Cutover)
1. Generate a new 64-character random hex secret for the new primary key.
2. Set `PAYOUT_ENCRYPTION_KEY_PREVIOUS` to the current key and `PAYOUT_ENCRYPTION_KEY` to the new key.
3. Deploy the application (`decryptPayoutAccountNumber()` tries primary first and falls back to `PAYOUT_ENCRYPTION_KEY_PREVIOUS`).
4. Re-encrypt historical records with `reencryptPayoutAccountNumber()`, then unset `PAYOUT_ENCRYPTION_KEY_PREVIOUS`.

### 6.3 Rotating Session Signing Secrets (`JWT_SECRET` & `COOKIE_SECRET`)
1. Generate new 64-character random hex secrets for `JWT_SECRET` and/or `COOKIE_SECRET`.
2. Update the secret manager and deploy. Short-lived access JWTs (`15m`) signed with the old `JWT_SECRET` expire or trigger opaque refresh-token rotation; rotating `COOKIE_SECRET` invalidates existing signed web cookies and requires web re-authentication.

### 6.4 Rotating `CUSTODY_TOKEN_HMAC_SECRET` & Legacy Token Invalidation
1. Custody passes (`qrToken` and 6-digit `verificationPin`) are short-lived (15-minute TTL) single-use credentials stored only as domain-separated `hmac-sha256-v2` digests in `public.custody_tokens`. `CUSTODY_TOKEN_HMAC_SECRET` is never stored in PostgreSQL or logged.
2. During scheduled rotation (or emergency compromise response), generate a new 64-character hex `CUSTODY_TOKEN_HMAC_SECRET`, deploy updated API instances during a maintenance cutover, and revoke unconsumed passes (`UPDATE public.custody_tokens SET revoked_at = NOW() WHERE consumed_at IS NULL AND revoked_at IS NULL; UPDATE public.custody_records SET checkin_pin_hash = NULL, collection_pin_hash = NULL WHERE status IN ('EXPECTED', 'CHECKED_IN', 'IN_STORAGE', 'OVERDUE');`).
3. Completed custody history (`custody_records`, `bag_custody_items`, `custody_events`, consumed `custody_tokens`) remains completely intact; travellers with upcoming bookings simply issue a fresh pass via `POST /api/v1/bookings/:bookingId/custody-pass`. Migration `0013` automatically applied this invalidation to pre-HMAC legacy SHA-256 passes.

---

## 7. Production Security Checklist

- [ ] All `.env` files are excluded from version control via `.gitignore`.
- [ ] `NODE_ENV` is set to `production`.
- [ ] `DATABASE_SSL` is set to `true` with `DATABASE_SSL_REJECT_UNAUTHORIZED=true`.
- [ ] `STORAGE_PROVIDER` is set to `r2` with valid Cloudflare R2 credentials.
- [ ] `EMAIL_PROVIDER` is set to `zoho` with valid SMTP application credentials.
- [ ] `CORS_ORIGIN` contains explicit trusted domains (no wildcard `*`).
- [ ] No secret begins with `dev_` or `test_`.
- [ ] `VITE_ENABLE_DEMO_PREVIEW` is set to `false`.
