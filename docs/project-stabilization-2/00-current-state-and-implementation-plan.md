# 00 — Current State and Implementation Plan

**Project:** Global Luggage Storage Marketplace  
**Repository:** `https://github.com/kavicastelo/luggage-storage`  
**Branch:** `feat/phase-1b-identity`  
**Base Commit:** `4a8614dcc22cdf8665381556f968f0c93f979ab0` (`Add email verification and marketplace surfaces`)  
**Initial Working Tree State:** Clean (`0` uncommitted or untracked files)

---

## 1. Existing Implementation Preserved

The current codebase on `feat/phase-1b-identity` (`4a8614d`) includes:
- Phase 1A monorepo infrastructure (`packages/contracts`, `apps/api`, `apps/web`, `apps/mobile`, Docker PostgreSQL 16 + PostGIS 3.5).
- Phase 1B unified identity schema (`users`, `traveller_profiles`, `host_profiles`, `roles`, `permissions`, `user_roles`, `role_permissions`, `auth_sessions`, `password_reset_tokens`, `security_audit_events`, `email_verification_tokens`, `auth_rate_limits`), Argon2id password hashing, JWT access tokens, rotating refresh tokens, RBAC guards, and append-only audit logging.
- Phase 2 product UI across Web and Mobile (123 active screens + 20 mascot assets).
- Stabilization Round 1 email verification (`POST /api/v1/auth/verify-email`, `POST /api/v1/auth/resend-verification`), admin audit log API (`GET /api/v1/admin/audit-events`), and Drizzle migration `0005_stabilization_verification_and_rate_limits.sql`.

---

## 2. Revalidation of Audit Findings (`AUD-001` – `AUD-007`) Against Current Codebase

| Finding | Revalidated Current State | Planned Remediation |
|---|---|---|
| **AUD-001** (Clean DB Bootstrap & CI Migrations) | **Confirmed Open:** `.github/workflows/ci.yml` starts PostgreSQL and runs `pnpm verify` without executing `db:migrate` first. Furthermore, Vitest in `apps/api` lacks a `globalSetup` hook to guarantee migrations complete before parallel test suites (`auth.test.ts`, `session.test.ts`, etc.) run against an empty database. | 1. Update `.github/workflows/ci.yml` to build `@luggage-storage/contracts` and run `pnpm --filter @luggage-storage/api db:migrate` before `pnpm verify`, and trigger on `feat/phase-1b-identity`.<br>2. Add `apps/api/vitest.config.ts` with `globalSetup` (`apps/api/tests/setup/global-setup.ts`) calling `runMigrations()`.<br>3. Enhance `runMigrations()` in `apps/api/src/infrastructure/database/migrate.ts` to verify all 12 core tables and PostGIS extension exist after migration execution. |
| **AUD-002** (Production Zoho Mail Delivery) | **Confirmed Open:** `email.service.ts` currently supports `resend`, `console`, `noop`, and `test`, with no Zoho Mail SMTP adapter (`ZohoSmtpEmailAdapter`), no Zoho SMTP env vars, no production rejection of `noop`/`console`/`test`, and `auth.service.ts` / `password.service.ts` do not inspect `EmailSendResult.delivered` or protect existing tokens when resend delivery fails. | 1. Add `nodemailer` (`@types/nodemailer`) to `apps/api` and implement `ZohoSmtpEmailAdapter` + HTML/text email templates (`email.templates.ts`).<br>2. Add `EMAIL_PROVIDER=zoho`, `ZOHO_SMTP_HOST`, `ZOHO_SMTP_PORT`, `ZOHO_SMTP_SECURE`, `ZOHO_SMTP_USER`, `ZOHO_SMTP_PASSWORD`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` to `env.ts`, `.env.example`, `apps/api/.env.example`, and `apps/api/.env` (placeholders only).<br>3. Require `EMAIL_PROVIDER=zoho` and valid SMTP config in `production`.<br>4. Update `register`, `resendVerificationEmail`, and `requestPasswordReset` to check `EmailSendResult.delivered`, preserve existing valid tokens on resend failure, and log/audit safely without exposing tokens. |
| **AUD-003** (Production Database TLS Enforcement) | **Confirmed Open:** `EnvSchema` in `apps/api/src/config/env.ts` defaults `DATABASE_SSL` to `false` and only checks `DATABASE_SSL_REJECT_UNAUTHORIZED` when `DATABASE_SSL` is `true`, allowing `DATABASE_SSL=false` in `production`. | Require `DATABASE_SSL=true` and `DATABASE_SSL_REJECT_UNAUTHORIZED=true` when `NODE_ENV === "production"` in `EnvSchema`, while supporting optional `DATABASE_SSL_CA`. |
| **AUD-004** (Rate Limiting & Keyed HMAC Identifiers) | **Confirmed Open:** `EnvSchema` sets `RATE_LIMIT_IP_MAX=2000` and `RATE_LIMIT_RECOVERY_MAX=5` / `RATE_LIMIT_VERIFICATION_RESEND_MAX=5`, diverging from the documented baseline (`20/15m` login IP, `5/15m` login email, `10/15m` register IP, `5/1h` register email, `10/15m` resend IP, `3/15m` resend email, `10/15m` recovery IP, `3/15m` recovery email). Also, `RateLimitService.hashKey` uses unsalted SHA-256 instead of keyed HMAC-SHA-256 (`RATE_LIMIT_HASH_SECRET`). | 1. Establish a single authoritative `RATE_LIMIT_POLICIES` configuration matching the baseline table and wire `Retry-After` headers on HTTP `429` responses.<br>2. Replace unsalted SHA-256 in `RateLimitService.hashKey` with keyed `HMAC-SHA-256` using `RATE_LIMIT_HASH_SECRET` (validated in production) and `v1:` key prefixing. |
| **AUD-005** (Product Decisions & Open Questions Governance) | **Confirmed Open:** `docs/product/assumptions-and-open-questions.md` and `docs/project-stabilization/03-product-decision-resolution.md` need the explicit 7-status model (`RESOLVED_INTERNAL`, `OWNER_APPROVAL_REQUIRED`, `VENDOR_CONFIRMATION_REQUIRED`, `LEGAL_REVIEW_REQUIRED`, `TAX_REVIEW_REQUIRED`, `DEFERRED`, `BLOCKED`), updated recommendations for `OQ-002`, `OQ-003`, `OQ-010`, `OQ-013`, `OQ-016`–`OQ-021`, and separation of internal engineering decisions from external/owner gates. | Update `docs/product/assumptions-and-open-questions.md`, `docs/project-stabilization/03-product-decision-resolution.md`, `docs/project-stabilization/08-final-stabilization-report.md`, and create `docs/project-stabilization-2/04-product-decisions-and-open-gates.md`. |
| **AUD-006** (Database Documentation vs Actual Schema) | **Confirmed Open:** `docs/project-stabilization/04-security-remediation-report.md` and `05-database-and-migration-report.md` inaccurately mention `requested_ip` and `user_agent` on `email_verification_tokens` and `window_started_at` (`varchar(128)`) on `auth_rate_limits`. | Reconcile all database documentation with the actual Drizzle schema (`identity.ts`) and SQL migration (`0005`), and add an automated schema-documentation verification test. |
| **AUD-007** (Demo Preview Boundaries) | **Confirmed Open:** `ProtectedRoute.tsx` allows `?preview=demo` whenever `allowDemoPreview` prop is true, without an explicit environment flag (`VITE_ENABLE_DEMO_PREVIEW`) that disables demo preview by default in production. | Create `apps/web/src/config/demo-preview.ts` (disabled by default in production unless `VITE_ENABLE_DEMO_PREVIEW=true`), enforce in `ProtectedRoute.tsx`, label simulated interactions clearly in `HostDashboardPages.tsx` and `AdminDashboardPages.tsx`, and add automated tests. |

---

## 3. Implementation Sequence

1. **Step 1 (`AUD-001`):** Implement deterministic DB bootstrap (`migrate.ts`, `vitest.config.ts`, `global-setup.ts`, `.github/workflows/ci.yml`, root `package.json`).
2. **Step 2 (`AUD-002`, `AUD-003`, `AUD-004`):** Install `nodemailer`, update `env.ts` + `.env*` files, implement `ZohoSmtpEmailAdapter` + `email.templates.ts`, update `auth.service.ts` + `password.service.ts` delivery-result handling, enforce production DB TLS, and update `rate-limit.service.ts` + `app.ts` (`HMAC-SHA-256`, authoritative rate-limit policies, `Retry-After` header).
3. **Step 3 (`AUD-007`):** Implement `apps/web/src/config/demo-preview.ts`, update `ProtectedRoute.tsx`, `HostDashboardPages.tsx`, `AdminDashboardPages.tsx`, and add web demo-preview tests.
4. **Step 4 (`AUD-005`, `AUD-006`):** Reconcile open questions and database schema documentation across `docs/product/`, `docs/architecture/`, `docs/project-stabilization/`, and `docs/project-stabilization-2/`.
5. **Step 5 (Verification & Git Commit):** Execute fresh empty-DB bootstrap test, run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm verify`, and create the verified Git commit.
