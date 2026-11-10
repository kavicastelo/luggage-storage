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
- `DB_IDENTITY_SECRET`: HMAC-SHA256 signing secret for PostgreSQL database identity assertions.
- `PAYOUT_ENCRYPTION_KEY` / `PAYOUT_ENCRYPTION_KEY_PREVIOUS`: AES-256-GCM bank account encryption keys.
- `JWT_SECRET` / `COOKIE_SECRET`: Authentication token and cookie signing keys.
- `RATE_LIMIT_HASH_SECRET`: HMAC secret for client identifier anonymization.
- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`: Cloudflare R2 object storage access keys.
- `ZOHO_SMTP_PASSWORD`: Transactional email credentials.

### Public Client Configuration (Safe for Bundling)
Only variables explicitly designed for client bundle inclusion are permitted:
- `VITE_API_URL`: Fastify API backend URL consumed by React web app.
- `VITE_ENABLE_DEMO_PREVIEW`: Boolean flag toggling read-only sandbox preview mode.
- `EXPO_PUBLIC_API_URL`: Fastify API backend URL consumed by React Native mobile app.

---

## 3. Cryptographic Secret Generation

For local development and testing, generate high-entropy 256-bit cryptographic secrets using either:

```bash
# Using OpenSSL:
openssl rand -hex 32

# Using Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Each security domain (`DB_IDENTITY_SECRET`, `PAYOUT_ENCRYPTION_KEY`, `JWT_SECRET`, `COOKIE_SECRET`, `RATE_LIMIT_HASH_SECRET`) **must have its own distinct, randomly generated key**. Reusing a secret across multiple domains is prohibited.

---

## 4. Database Identity Secret Provisioning Lifecycle

The `DB_IDENTITY_SECRET` authorizes role assignment and revocation operations in PostgreSQL:

1. **Environment Validation:** `EnvSchema` validates that `DB_IDENTITY_SECRET` is present, $\ge 32$ characters, and does not match any revoked development secret.
2. **Database Provisioning:** When `pnpm db:migrate` runs, `syncTrustedAuthSecret()` inserts or updates the secret in `public.trusted_auth_secrets` under `key_id = 'active'`.
3. **Table Isolation:** Table `public.trusted_auth_secrets` is owned by `luggage_role_assigner`. The runtime application role `luggage_user` is explicitly denied `SELECT`, `INSERT`, `UPDATE`, and `DELETE` access.
4. **Assertion Verification:** In-database function `public.verify_identity_assertion()` (a `SECURITY DEFINER` routine owned by `luggage_role_assigner`) reads the secret to verify HMAC-SHA256 signatures, validates TTL ($\le 120\text{s}$), and writes the assertion nonce to `public.consumed_auth_assertions` to prevent replay attacks.
5. **Fail-Closed Protection:** If `trusted_auth_secrets` lacks an active secret, or if the secret matches a revoked key, `verify_identity_assertion` raises an exception, rendering privileged operations impossible.

---

## 5. Secret Rotation Procedures

### 5.1 Rotating `DB_IDENTITY_SECRET`
1. Generate a new 64-character random hex secret.
2. Update the environment variable `DB_IDENTITY_SECRET` in your secret manager.
3. Run the migration runner or trigger `syncTrustedAuthSecret()` on the database.
4. Deploy the updated backend service. Previous assertions expire within 60 seconds.

### 5.2 Rotating `PAYOUT_ENCRYPTION_KEY` (Dual-Key Cutover)
1. Generate a new 64-character random hex secret for the new primary key.
2. Set `PAYOUT_ENCRYPTION_KEY_PREVIOUS` to the current key.
3. Set `PAYOUT_ENCRYPTION_KEY` to the new key.
4. Deploy the application. `decryptPayoutAccountNumber()` attempts the new key first; if authentication tag validation fails, it falls back to `PAYOUT_ENCRYPTION_KEY_PREVIOUS`.
5. Run the re-encryption utility to update historical records to the new key.
6. Once all records are re-encrypted, unset `PAYOUT_ENCRYPTION_KEY_PREVIOUS`.

### 5.3 Rotating Session Tokens (`JWT_SECRET` & `COOKIE_SECRET`)
1. Generate new 64-character random hex secrets.
2. Update `JWT_SECRET` and `COOKIE_SECRET` in the secret manager.
3. Deploy the application. Existing short-lived access tokens (15m TTL) will expire, prompting clients to refresh using their session tokens or re-authenticate.

---

## 6. Production Security Checklist

- [ ] All `.env` files are excluded from version control via `.gitignore`.
- [ ] `NODE_ENV` is set to `production`.
- [ ] `DATABASE_SSL` is set to `true` with `DATABASE_SSL_REJECT_UNAUTHORIZED=true`.
- [ ] `STORAGE_PROVIDER` is set to `r2` with valid Cloudflare R2 credentials.
- [ ] `EMAIL_PROVIDER` is set to `zoho` with valid SMTP application credentials.
- [ ] `CORS_ORIGIN` contains explicit trusted domains (no wildcard `*`).
- [ ] No secret begins with `dev_` or `test_`.
- [ ] `VITE_ENABLE_DEMO_PREVIEW` is set to `false`.

