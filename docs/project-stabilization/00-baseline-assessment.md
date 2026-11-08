# Project Stabilization — 00: Independent Repository Baseline Assessment

**Project:** Global Luggage Storage Marketplace  
**Document ID:** `DOC-STAB-00`  
**Branch:** `feat/phase-1b-identity`  
**Assessment Date:** 2026-11-09  
**Role:** Principal Software Architect, Senior Full-Stack Engineer, Database Engineer, Security Engineer, QA Lead & Technical Product Analyst  
**Status:** `BASELINE ESTABLISHED`

---

## 1. Purpose

This document records the independently inspected baseline state of the `luggage-storage` repository prior to executing the Project Stabilization & Previous Phase Completion remediation workstreams (Workstreams A through G). Historical completion claims from Phases `0A` through `2` are compared directly against the actual source code, database migrations, configuration manifests, and automated test suites.

---

## 2. Actual Repository Structure

```text
d:/luggage-storage/luggage-storage/
├── Assets/                          # 20 original mascot PNG illustrations (LS-mascot_01..20)
├── apps/
│   ├── api/                         # Fastify 5.2.1 + Drizzle ORM 0.45.4 + PostgreSQL/PostGIS backend
│   │   ├── src/
│   │   │   ├── common/              # AppError, error/not-found middleware
│   │   │   ├── config/              # Zod environment schema (env.ts)
│   │   │   ├── infrastructure/      # PostgreSQL connection pool, Drizzle schema, custom migrator
│   │   │   └── modules/             # health, auth, admin, audit, email
│   │   └── tests/                   # 8 Vitest integration/security test suites
│   ├── web/                         # React 18.3.1 + Vite 6.2.0 + Tailwind CSS 3.4.3 web application
│   │   ├── public/assets/mascots/   # 20 mascot PNG assets served statically
│   │   ├── src/                     # Auth pages, Public (PW), Host (HD), Admin (AD) surfaces
│   │   └── tests/                   # 6 Vitest unit/integration test suites
│   └── mobile/                      # React Native 0.88.1 + Expo ~58.0.23 + Expo Router ~58.0.30
│       ├── app/                     # (auth), (account), (traveller), (host) route groups
│       ├── assets/mascots/          # 20 mascot PNG assets bundled via Metro
│       ├── src/                     # Auth store, SecureStore wrapper, API client, mock catalogue
│       └── tests/                   # 7 Vitest test suites
├── packages/
│   ├── contracts/                   # Shared Zod 4.6.7 schemas & TypeScript contracts (9 test suites)
│   ├── eslint-config/               # Shared ESLint 10.14.0 flat configuration
│   └── typescript-config/           # Shared TypeScript strict configurations
├── infrastructure/
│   └── docker/init.sql              # Three-tier PostgreSQL role & PostGIS bootstrap script
└── docs/                            # Product, Architecture, Engineering, Governance & Security docs
```

---

## 3. Historical Claims vs. Independently Verified Reality

| Area / Claim | Historical Report Claim | Independently Verified Baseline State | Discrepancy / Finding |
|:---|:---|:---|:---|
| **Phase 0A–0C Requirements & Domain** | 72 normalized requirements, 122 acceptance criteria, 44 workflows, 100 business rules, 22 OQs (`OQ-001`–`OQ-022`). | Documented across `docs/product/` and `docs/architecture/`. | `OQ-002`, `OQ-003`, `OQ-010`, `OQ-012` (partial), `OQ-013`, `OQ-016`–`OQ-021` remain unresolved or pending formal reconciliation. |
| **Screen Registry (`DOC-UX-001`)** | 113 active screens (`39 TM`, `31 HM`, `11 PW`, `14 HD`, `18 AD`) + 11 reserved screen IDs. | All 113 screen IDs exist in Web/Mobile registries and UI views; 11 reserved IDs are excluded. **However, `docs/product/ux/master-screen-registry.md` marks all 113 screens as `Backend-Complete`.** | **Inaccurate Status Claim:** Only Identity/Auth/RBAC/Admin-User screens have live backend endpoints. Marketplace domain backends (locations, bookings, payments, custody, ledger, payouts, refunds, reviews, tickets) are **not implemented** (`Deferred to Phases 3–12`). |
| **Dependency Matrix (`ENG-DEP-001`)** | Claims Fastify `^4.27.0`, Expo `~52.0.49`, React Native `0.76.9`, Zod `^3.23.8`, Node `>=20.0.0`. | Actual manifests use Fastify `^5.2.1`, Expo `~58.0.23`, React Native `0.88.1`, React `19.3.0` (mobile), Zod `^4.6.7`, ESLint `10.14.0`, Node `>=26.0.0`. | **Outdated Documentation:** `docs/engineering/dependency-compatibility-matrix.md` was not updated after the Phase 1A-RC3 framework upgrades. |
| **Email Verification Lifecycle (Phase 1B)** | Reported complete in Phase 1B. | `register()` creates users with `status: 'PENDING_VERIFICATION'` and `isEmailVerified: false`, **but `login()` does not reject unverified/pending users**, and no self-service email verification token table or endpoints (`/auth/verify-email`, `/auth/resend-verification`) exist. | **Critical Functional & Security Gap:** Unverified accounts can log in immediately; no self-service token verification flow exists (only admin override `POST /admin/users/:userId/verify-email`). |
| **Authentication Rate Limiting (Phase 1B)** | Reported as abuse-resistant. | Only `PasswordService.requestPasswordReset` has an in-memory `Map` rate limiter. Login, registration, and verification resend have **no rate limiting**, and in-memory maps do not work across multiple API instances. | **Security Defect:** Requires multi-instance-safe PostgreSQL-backed rate limiting across login, registration, password reset, and verification resend. |
| **Database TLS Configuration** | Production-ready database connection. | `apps/api/src/infrastructure/database/connection.ts` uses `ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false` and `migrate.ts` omits SSL configuration entirely. | **Security Defect:** `rejectUnauthorized: false` disables TLS certificate validation in production, exposing database traffic to MITM attacks. |
| **CORS Configuration** | Secure CORS setup. | `apps/api/src/config/env.ts` defaults `CORS_ORIGIN` to `"*"` even in production, and `app.ts` combines `origin: "*"` with `credentials: true`. | **Security Defect:** Production startup must reject wildcard origins and enforce explicit allowlisted origins. |
| **Administrative Audit Retrieval API** | Audit service implemented in WP-12. | `auditService` writes immutable events and has internal query helpers, **but `admin.routes.ts` exposes zero HTTP endpoints to query or filter `security_audit_events`**, and `AD-017` displays static mock rows. | **Incomplete Feature:** Missing `GET /api/v1/admin/audit-events` endpoint protected by `admin.audit.read` with pagination, date range, and event/user filtering. |
| **Web Route & Role Authorization** | RBAC integrated in Web UI. | In `apps/web/src/app/App.tsx`, `/host/*` and `/admin/*` are **not wrapped in `<ProtectedRoute>`**. `HostDashboardLayout` and `AdminDashboardLayout` use local `useState` (`hostRoleMode`, `adminRoleMode`) defaulting to `HOST_OWNER` and `SUPERADMIN`. `PermissionGate` is never imported in application pages. | **Security & Authorization Defect:** Unauthenticated or ordinary `TRAVELLER` users can navigate directly to `/host` or `/admin` unless guarded, and local state toggles can impersonate privileged roles without explicit demo-mode isolation. |
| **Mobile Route & Role Authorization** | Role-aware mobile navigation. | In `apps/mobile/app/index.tsx`, `handleSelectHost` navigates to `/(host)` regardless of authentication or role. `apps/mobile/app/(host)/_layout.tsx` and `(account)/_layout.tsx` lack route-level auth/role guards. `HostMobileHubScreen` uses local `useState("HOST_OWNER")`. | **Security & Authorization Defect:** Unauthenticated or `TRAVELLER`-only users can enter `/(host)` screens and toggle `HOST_OWNER` locally. |
| **Drizzle Migration Journal vs. Snapshots** | 5 migrations (`0000`–`0004`) tracked cleanly. | `meta/_journal.json` lists 5 migrations (`0000`–`0004`), but `meta/` only contains `0000_snapshot.json`, `0001_snapshot.json`, and `0002_snapshot.json`. | **Migration Metadata Inconsistency:** Missing `0003_snapshot.json` and `0004_snapshot.json` (plus upcoming `0005` migration snapshot). |
| **Database Function Execution Grants** | Least-privilege three-tier DB model. | `infrastructure/docker/init.sql` grants `EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO luggage_user` and sets default privileges granting `EXECUTE ON FUNCTIONS` to `luggage_user`. | **Privilege Hardening Needed:** SECURITY DEFINER functions should restrict `EXECUTE` explicitly to `luggage_user` and `luggage_migrator` (revoking `PUBLIC` and avoiding blanket function execution grants). |

---

## 4. Baseline Verification Command Results

Prior to stabilization modifications, the full uncached verification pipeline was executed:

- **Command:** `pnpm turbo run lint typecheck test build --force`
- **Tasks:** `16 successful, 16 total` (`0 cached`)
- **Test Suites:** `30 passed (30)` (`9` contracts, `8` api, `6` web, `7` mobile)
- **Tests:** `309 passed (309)` (`59` contracts, `180` api, `38` web, `32` mobile)
- **Lint / Typecheck:** `0 errors, 0 warnings`
- **Production Builds:** `packages/contracts` (`tsc`), `apps/api` (`tsc`), `apps/web` (`vite build`), `apps/mobile` (`expo export`) all succeeded.

---

## 5. Summary of Areas Requiring Modification

1. **Documentation & Governance (`docs/`):**
   - `docs/product/ux/master-screen-registry.md` & `docs/engineering/phase-2-screen-implementation-tracker.md` (multi-dimensional status columns replacing false `Backend-Complete` labels on marketplace screens).
   - `docs/engineering/dependency-compatibility-matrix.md` (synchronize with actual `package.json` and `pnpm-lock.yaml` versions).
   - `docs/product/assumptions-and-open-questions.md` & `docs/architecture/phase-0c-open-decisions.md` (reconcile `OQ-001`–`OQ-022`).
   - `docs/project-stabilization/00` through `08` deliverables.
2. **Shared Contracts (`packages/contracts/`):**
   - Email verification & resend schemas (`VerifyEmailRequestSchema`, `VerifyEmailResponseDataSchema`, `ResendVerificationRequestSchema`, `ResendVerificationResponseDataSchema`).
   - Administrative audit log query & response schemas (`AdminAuditEventQuerySchema`, `SecurityEventType` additions for email verification and rate-limiting).
3. **Database & Migrations (`apps/api/src/infrastructure/database/`, `infrastructure/docker/init.sql`):**
   - Restore missing `0003_snapshot.json` and `0004_snapshot.json`.
   - Create migration `0005_stabilization_verification_and_rate_limits.sql` (and `0005_snapshot.json`) adding `email_verification_tokens`, `auth_rate_limits`, `users.email_verified_at`, and least-privilege function execution grants.
   - Harden TLS certificate verification in `connection.ts` and `migrate.ts`.
4. **Backend API (`apps/api/src/`):**
   - Implement `EmailVerificationService` and routes (`POST /auth/verify-email`, `POST /auth/resend-verification`).
   - Enforce `PENDING_VERIFICATION` / `isEmailVerified` check on `POST /auth/login`, `POST /auth/refresh`, and `GET /auth/me`.
   - Implement production-ready HTTP/SMTP configurable `EmailDeliveryAdapter` alongside explicit dev/test adapters in `email.service.ts`.
   - Implement PostgreSQL-backed `RateLimitService` across login, registration, password reset, and verification resend.
   - Harden production CORS validation in `env.ts` and `app.ts`.
   - Implement administrative audit log endpoints (`GET /admin/audit-events`, `GET /admin/audit-events/:eventId`) protected by `admin.audit.read`.
5. **Web Application (`apps/web/src/`):**
   - Protect `/host/*` and `/admin/*` routes with `ProtectedRoute` and role/permission guards while providing an explicit, opt-in, visually isolated UI Preview Sandbox mode for unauthenticated UX review.
   - Integrate `PermissionGate` and derive active roles from `useAuthStore` when authenticated.
   - Add Email Verification page (`/verify-email`) and pending-verification resend workflow on `/login` and `/register`.
   - Wire `AD-017` (`AdminSecurityComplianceAuditLogPage`) to the live `/api/v1/admin/audit-events` API when authenticated as `SUPERADMIN`.
6. **Mobile Application (`apps/mobile/`):**
   - Enforce authentication and role checks in `app/index.tsx`, `app/(host)/_layout.tsx`, `app/(account)/_layout.tsx`, and `app/(host)/index.tsx` so `TRAVELLER` users cannot escalate to `HOST_OWNER` or access protected Host routes without authorization (unless in an explicitly labeled Demo Preview mode).
   - Connect `TM-008` (`Email / Phone OTP Verification`) and auth screens (`login.tsx`, `register.tsx`) to the real email verification and resend endpoints.

