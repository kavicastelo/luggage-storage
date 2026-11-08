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
  - Stores only SHA-256 hex digests (`token_hash`, 64 chars) of 32-byte (256-bit) cryptographically random tokens (`crypto.randomBytes(32).toString("hex")`).
  - Enforces a 24-hour expiration window (`expires_at`), single-use consumption (`used_at`), and client forensic metadata (`requested_ip`, `user_agent`).
- **Verification Endpoint (`POST /api/v1/auth/verify-email`):**
  - Validates the submitted raw token by hashing with SHA-256 and atomically marking the token consumed (`WHERE id = $1 AND used_at IS NULL AND expires_at > NOW()`).
  - Transitions `users.status` from `PENDING_VERIFICATION` to `ACTIVE` (validated via `isValidAccountStateTransition`), sets `is_email_verified = true` and `email_verified_at = NOW()`, and records `AUTH_EMAIL_VERIFICATION_COMPLETED` in `security_audit_events`.
- **Resend Verification Endpoint (`POST /api/v1/auth/resend-verification`):**
  - Enumeration-resistant response (`200 OK`) regardless of whether the email exists or is already verified.
  - Invalidates prior unused verification tokens for the user before issuing a fresh token and dispatching via `EmailDeliveryAdapter.sendEmailVerificationEmail`.
- **Unverified Login & Session Enforcement:**
  - `AuthService.login`, `SessionService.rotateRefreshToken`, and `AuthService.getMe` strictly reject accounts in `PENDING_VERIFICATION` or with `isEmailVerified === false` (`403 FORBIDDEN`), preventing unverified accounts from acquiring or rotating active sessions.

### 2.2 PostgreSQL-Backed Multi-Dimensional Rate Limiting (`REM-B03`, `REM-B04`)

- **Rate Limit Storage (`auth_rate_limits`):**
  - Persists sliding fixed-window counters keyed by privacy-preserving SHA-256 hashes (`scope:SHA256(key)`), avoiding plaintext storage of raw emails or IP addresses in rate-limit buckets.
- **Protected Endpoints & Thresholds:**
  - `POST /api/v1/auth/login`: IP scope (`20 / 15m`) + IP+Email composite scope (`5 / 15m`). Successful authentication resets the IP+Email composite counter (`rateLimitService.reset("auth:login:ip_email", ...)`).
  - `POST /api/v1/auth/register`: IP scope (`10 / 60m`).
  - `POST /api/v1/auth/forgot-password`: IP scope (`10 / 15m`) + Email scope (`3 / 15m`).
  - `POST /api/v1/auth/reset-password`: IP scope (`10 / 15m`).
  - `POST /api/v1/auth/verify-email`: IP scope (`15 / 15m`).
  - `POST /api/v1/auth/resend-verification`: IP scope (`10 / 15m`) + Email scope (`3 / 15m`).
- **Standardized `429` Response & Audit Logging:**
  - Returns `429 TOO_MANY_REQUESTS` (`error.code = "RATE_LIMITED"`), sets the HTTP `Retry-After` header in seconds, and records `AUTH_RATE_LIMIT_EXCEEDED` in `security_audit_events`.

### 2.3 PostgreSQL TLS Verification & Production CORS Enforcement (`REM-B05`, `REM-B06`)

- **Database TLS (`DATABASE_SSL_REJECT_UNAUTHORIZED`):**
  - Defaults to `true` in `EnvSchema` (`apps/api/src/config/env.ts`).
  - Enforced via Zod `.superRefine`: in `NODE_ENV === "production"`, setting `DATABASE_SSL_REJECT_UNAUTHORIZED=false` when `DATABASE_SSL=true` is rejected at startup.
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

