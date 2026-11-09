# 03 — Production Security Hardening (`AUD-003` & `AUD-004`)

**Project:** Global Luggage Storage Marketplace  
**Branch:** `feat/phase-1b-identity`  
**Audit Findings Addressed:**
- `AUD-003` (Medium — Enforce Production Database TLS)
- `AUD-004` (Medium — Rate Limiting & Identifier Hash Hardening)  
**Status:** `COMPLETE & VERIFIED`

---

## 1. Mandatory Production Database TLS Enforcement (`AUD-003`)

### 1.1 Vulnerability / Gap Addressed
Previously, `EnvSchema` in `apps/api/src/config/env.ts` only rejected `DATABASE_SSL_REJECT_UNAUTHORIZED=false` *when `DATABASE_SSL=true`*, which meant `NODE_ENV=production` with `DATABASE_SSL=false` could pass validation and connect to PostgreSQL without transport encryption.

### 1.2 Remediation Implemented (`apps/api/src/config/env.ts`, `connection.ts`, `migrate.ts`)
- In `EnvSchema.superRefine`, when `NODE_ENV === "production"`:
  1. `DATABASE_SSL` **must** be `true` (rejects `DATABASE_SSL=false` with `"DATABASE_SSL must be true in production; unencrypted database transport is prohibited"`).
  2. `DATABASE_SSL_REJECT_UNAUTHORIZED` **must** be `true` (rejects `DATABASE_SSL_REJECT_UNAUTHORIZED=false` with `"DATABASE_SSL_REJECT_UNAUTHORIZED cannot be false in production; trusted TLS certificate verification is mandatory"`).
- Added optional `DATABASE_SSL_CA` support to `EnvSchema` and `buildDatabaseSslConfig(config)`, automatically normalizing escaped `\n` sequences in PEM certificate bundles and passing `{ rejectUnauthorized: true, ca }` to both the runtime PostgreSQL pool (`connection.ts`) and migration pool (`migrate.ts`).
- Local `development` and `test` environments continue to work against local Docker PostgreSQL (`DATABASE_SSL=false`).

---

## 2. Authoritative Rate-Limit Policies & Keyed HMAC-SHA-256 Hashing (`AUD-004`)

### 2.1 Single Authoritative Rate-Limit Policy Table (`RATE_LIMIT_POLICIES`)
All authentication rate-limit thresholds are consolidated in `RATE_LIMIT_POLICIES` (`apps/api/src/modules/auth/rate-limit.service.ts`) and aligned with `EnvSchema` defaults and `.env.example` files:

| Endpoint / Action | Scope Key | Dimension | Threshold | Window |
|:---|:---|:---|:---|:---|
| `POST /api/v1/auth/login` | `auth_login_ip` | Client IP | `20` requests | `15 minutes` (`900s`) |
| `POST /api/v1/auth/login` | `auth_login_email` | Normalized Email | `5` failed attempts | `15 minutes` (`900s`, reset on success) |
| `POST /api/v1/auth/register` | `auth_register_ip` | Client IP | `10` requests | `15 minutes` (`900s`) |
| `POST /api/v1/auth/register` | `auth_register_email` | Normalized Email | `5` requests | `1 hour` (`3600s`) |
| `POST /api/v1/auth/resend-verification` | `auth_verify_resend_ip` | Client IP | `10` requests | `15 minutes` (`900s`) |
| `POST /api/v1/auth/resend-verification` | `auth_verify_resend_email` | Normalized Email | `3` requests | `15 minutes` (`900s`) |
| `POST /api/v1/auth/forgot-password` | `auth_recovery_ip` | Client IP | `10` requests | `15 minutes` (`900s`) |
| `POST /api/v1/auth/forgot-password` | `auth_recovery_email` | Normalized Email | `3` requests | `15 minutes` (`900s`) |

### 2.2 Keyed `HMAC-SHA-256` Identifier Protection (`RATE_LIMIT_HASH_SECRET`)
- Replaced unsalted `SHA-256(scope:identifier)` with keyed `HMAC-SHA-256`:
  ```ts
  createHmac("sha256", secret).update(`v1:${scope}:${normalized}`).digest("hex")
  ```
- Added `RATE_LIMIT_HASH_SECRET` (minimum 32 characters) to `EnvSchema` (`apps/api/src/config/env.ts`); `EnvSchema.superRefine` rejects `dev_` placeholder secrets when `NODE_ENV === "production"`.
- Prevents offline rainbow-table reversal of predictable IPv4 addresses or known email lists even if a read-only database snapshot of `auth_rate_limits` were ever exposed.

### 2.3 Standardized `429 RATE_LIMITED` & `Retry-After` Header
- `AppError.rateLimited(message, retryAfterSeconds)` attaches `retryAfterSeconds` to the error instance.
- `globalErrorHandler` (`apps/api/src/common/middleware/error-handler.ts`) sets the standard HTTP `Retry-After: <seconds>` header on every `429` response and `RateLimitService.consume` emits `AUTH_RATE_LIMIT_EXCEEDED` in `security_audit_events`.
