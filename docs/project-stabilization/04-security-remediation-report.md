# 04 — Security Remediation Report

**Project:** Global Luggage Storage Marketplace  
**Assignment:** Project Stabilization & Previous Phase Completion  
**Scope:** Workstream B (Identity, Verification, Rate Limiting, Transport & CORS, Audit API, State Transitions) & Workstream C (Database Function Privilege Hardening & Role-Boundary Enforcement)

---

## 1. Executive Summary

All security remediation items identified in the Baseline Assessment (`REM-B01` through `REM-B08` and `REM-C01` through `REM-C03`) have been implemented and verified with automated integration tests against PostgreSQL 16.

---

## 2. Detailed Security Controls Implemented

### 2.1 Self-Service Email Verification Lifecycle (`REM-B01`, `REM-B02`)

- **Token Storage (`email_verification_tokens`):**
  - Columns: `id` (`uuid PK`), `user_id` (`uuid FK -> users.id ON DELETE CASCADE`), `token_hash` (`varchar(128) NOT NULL`), `expires_at` (`timestamptz NOT NULL`), `used_at` (`timestamptz`), `created_at` (`timestamptz NOT NULL DEFAULT now()`).
  - Stores only SHA-256 hex digests (`token_hash`, 64 chars) of 32-byte (256-bit) cryptographically random tokens (`crypto.randomBytes(32).toString("hex")`).
  - Enforces a 24-hour expiration window (`expires_at`) and single-use consumption (`used_at`); client forensic metadata (`ip_address`, `user_agent`) is recorded in `security_audit_events`.
- **Verification Endpoint (`POST /api/v1/auth/verify-email`):**
  - Validates the submitted raw token by hashing with SHA-256 and atomically locking (`FOR UPDATE`) and marking the token consumed (`used_at = NOW()`).
  - Transitions `users.status` from `PENDING_VERIFICATION` to `ACTIVE` (validated via `isValidAccountStateTransition`), sets `is_email_verified = true` and `email_verified_at = NOW()`, and records `AUTH_EMAIL_VERIFICATION_COMPLETED` in `security_audit_events`.
- **Resend Verification Endpoint (`POST /api/v1/auth/resend-verification`):**
  - Enumeration-resistant response (`200 OK`) regardless of whether the email exists or is already verified.
  - Dispatches via `EmailDeliveryAdapter.sendEmailVerificationEmail` (`ZohoSmtpEmailAdapter` in production) and invalidates prior unused verification tokens only after confirming email delivery succeeded (`EmailSendResult.delivered === true`), preserving any prior valid token if SMTP delivery fails.
- **Unverified Login & Session Enforcement:**
  - `AuthService.login`, `SessionService.rotateRefreshToken`, and `AuthService.getMe` strictly reject accounts in `PENDING_VERIFICATION` or with `isEmailVerified === false` (`403 FORBIDDEN`), preventing unverified accounts from acquiring or rotating active sessions.

### 2.2 PostgreSQL-Backed Multi-Dimensional Rate Limiting (`REM-B03`, `REM-B04`, `AUD-004`)

- **Rate Limit Storage (`auth_rate_limits`):**
  - Columns: `key_hash` (`varchar(64) PRIMARY KEY`), `scope` (`varchar(32) NOT NULL`), `points` (`integer NOT NULL DEFAULT 1`), `window_start` (`timestamptz NOT NULL DEFAULT now()`), `expires_at` (`timestamptz NOT NULL`), `updated_at` (`timestamptz NOT NULL DEFAULT now()`).
  - Persists fixed-window counters keyed by versioned `HMAC-SHA-256` digests (`HMAC_SHA256(RATE_LIMIT_HASH_SECRET, "v1:" + scope + ":" + normalized_identifier)`), preventing offline rainbow-table enumeration of emails or IP addresses in `auth_rate_limits`.
- **Authoritative Policies (`RATE_LIMIT_POLICIES`):**
  - `POST /api/v1/auth/login`: `auth_login_ip` (`20 / 15m`) + `auth_login_email` (`5 / 15m`). Successful authentication resets the `auth_login_email` counter.
  - `POST /api/v1/auth/register`: `auth_register_ip` (`10 / 15m`) + `auth_register_email` (`5 / 1h`).
  - `POST /api/v1/auth/resend-verification`: `auth_resend_verification_ip` (`10 / 15m`) + `auth_resend_verification_email` (`3 / 15m`).
  - `POST /api/v1/auth/forgot-password`: `auth_password_reset_ip` (`10 / 15m`) + `auth_password_reset_email` (`3 / 15m`).
- **Standardized `429` Response & Audit Logging:**
  - Returns `429 TOO_MANY_REQUESTS` (`error.code = "RATE_LIMITED"`), sets the HTTP `Retry-After` header in seconds (`retryAfterSeconds`), and records `AUTH_RATE_LIMIT_EXCEEDED` in `security_audit_events`.

### 2.3 PostgreSQL TLS Verification & Production CORS Enforcement (`REM-B05`, `REM-B06`, `AUD-003`)

- **Database TLS (`DATABASE_SSL` & `DATABASE_SSL_REJECT_UNAUTHORIZED`):**
  - Enforced via Zod `.superRefine` in `EnvSchema` (`apps/api/src/config/env.ts`): in `NODE_ENV === "production"`, both `DATABASE_SSL=true` and `DATABASE_SSL_REJECT_UNAUTHORIZED=true` are strictly required (with optional custom CA certificate bundle via `DATABASE_SSL_CA`).
  - Wired into both `apps/api/src/infrastructure/database/connection.ts` and `apps/api/src/infrastructure/database/migrate.ts`.
- **CORS Origin Validation (`CORS_ORIGIN`):**
  - Enforced via Zod `.superRefine`: wildcard `*` is forbidden in `NODE_ENV === "production"`.
  - `isCorsOriginAllowed(requestOrigin, configuredOrigin)` in `apps/api/src/app.ts` supports comma-separated allowlists and rejects unauthorized cross-origin requests cleanly.

### 2.4 Administrative Audit Retrieval API & Centralized Account Lifecycle State Machine (`REM-B07`, `REM-B08`)

- **Audit Retrieval Endpoints:**
  - `GET /api/v1/admin/audit-events` and `GET /api/v1/admin/audit-events/:eventId` protected by `authenticate` and `requirePermission("admin.audit.read")` (`SUPERADMIN` only).
  - Supports filtering by `actorUserId`, `targetUserId`, `eventType`, `from`, `to`, `page`, and `limit`, and records `ADMIN_AUDIT_LOG_ACCESSED` in `security_audit_events`.
- **Account Lifecycle State Machine (`isValidAccountStateTransition`):**
  - Explicitly defines allowed transitions (`PENDING_VERIFICATION -> ACTIVE | SUSPENDED | DEACTIVATED`, `ACTIVE -> SUSPENDED | DEACTIVATED`, `SUSPENDED -> ACTIVE | DEACTIVATED`, `DEACTIVATED -> ACTIVE`) and rejects invalid transitions (`409 CONFLICT`).

### 2.5 Database Function Privilege Hardening & Role-Boundary Enforcement (`REM-C01`, `REM-C02`, `REM-C03`)

- **PostgreSQL `SECURITY DEFINER` Hardening (`REM-C01`):**
  - Migration `0005_stabilization_verification_and_rate_limits.sql` and `infrastructure/docker/init.sql` execute `REVOKE ALL ON FUNCTION ... FROM PUBLIC` on `public.assign_user_role(uuid, varchar, uuid)`, `public.revoke_user_role(uuid, varchar)`, and `public.prevent_audit_tampering()`, granting `EXECUTE` strictly to `luggage_user` and `luggage_migrator`.
  - Verified directly against `has_function_privilege('public', ...)` in `apps/api/tests/stabilization-security.test.ts`.
- **Web & Mobile Role Boundaries (`REM-C02`, `REM-C03`):**
  - Web `/host` (`HOST_OWNER`, `HOST_STAFF`, `SUPERADMIN`) and `/admin` (`SUPERADMIN`, `SUPPORT_ADMIN`) routes are wrapped in `ProtectedRoute` (`allowDemoPreview`), blocking unauthorized authenticated users with `403 Access Denied` and locking `actorRole` to the authenticated user's actual role assignments.
  - Mobile `/(host)` and `/(account)` layouts enforce role and authentication boundaries and disable client-side role elevation when authenticated.

