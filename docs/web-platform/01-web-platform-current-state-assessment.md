# 01 — Web Platform Current-State Assessment

**Repository:** `d:/luggage-storage/luggage-storage`  
**Baseline Assessed:** Git branch `dev` (`origin/dev`), commit `b09fa68` (`docs(payments): add PayHere sandbox remediation report`), clean working tree  
**Assessment Date:** 2026-11-15  
**Scope:** Full source-level assessment of `apps/web` (`@luggage-storage/web`) integrated against `apps/api` (`@luggage-storage/api`), `packages/contracts` (`@luggage-storage/contracts`), and reference implementations in `apps/mobile` and `docs/`.

---

## 1. Executive Summary & Answers to the Five Core Architectural Questions

### Root Architectural Diagnosis

The Web application (`apps/web`) exhibits a sharp architectural split between its authentication foundation and its three marketplace surfaces. During **Phase 1B**, the team delivered production-grade identity, JWT + `HttpOnly` refresh-cookie rotation, RBAC (`SYSTEM_PERMISSIONS`), and session auditing. During **Phase 2C**, the team authored three large, self-contained UI simulation files—[`PublicMarketplacePages.tsx`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx) (`3,572` lines), [`HostDashboardPages.tsx`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx) (`3,833` lines), and [`AdminDashboardPages.tsx`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx) (`1,699` lines)—totalling `9,104` lines powered by [`mock-marketplace.ts`](file:///d:/luggage-storage/luggage-storage/apps/web/src/data/mock-marketplace.ts) (`886` lines of `DEMO_LOCATIONS` and `DEMO_BOOKINGS`).

Subsequently, **Phases A and B** implemented a comprehensive Fastify + PostgreSQL/PostGIS + Drizzle ORM backend (`apps/api`, **93 logical HTTP endpoints** across 30 domain + 2 internal PostgreSQL tables) covering discovery, server-side quotations, capacity holds, PayHere `PaymentGatewayPort` channel checkout, single-use QR/PIN custody handovers, double-entry financial ledger accounting, host verification, and admin user/RBAC governance. While `apps/mobile` was refactored with TanStack Query hooks and a host context store in **Phase C**, `apps/web` had ad-hoc `useEffect` calls bolted onto a minority of screens while leaving `useState(DEMO_*)` initializers, `if (items.length > 0)` replacement guards, and `.catch(() => {})` fallbacks intact.

As a result, although `QueryClientProvider` is mounted in [`App.tsx`](file:///d:/luggage-storage/luggage-storage/apps/web/src/app/App.tsx#L76-L83), **only [`HealthPage.tsx`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HealthPage.tsx) calls `useQuery`** (`0` `useMutation` or `useQueryClient` usages across `apps/web`), and `react-hook-form` (`apps/web/package.json`) has `0` imports.

### Direct Answers to the Five Fundamental Questions

1. **What is genuinely implemented in the current Web application?**
   - Complete Phase 1B authentication and self-service flows (`/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/settings/security`, `/settings/sessions`) backed by in-memory JWT storage ([`api-client.ts`](file:///d:/luggage-storage/luggage-storage/apps/web/src/lib/api-client.ts)) and `HttpOnly` refresh cookie rotation ([`useAuthStore.ts`](file:///d:/luggage-storage/luggage-storage/apps/web/src/store/useAuthStore.ts)), **subject to a critical empty-body logout/revocation bug** ([`api-client.ts`](file:///d:/luggage-storage/luggage-storage/apps/web/src/lib/api-client.ts#L112-L115)).
   - Core UUID Traveller checkout & payment reconciliation (`PW-004` quote/hold/PayHere `DIRECT_POST` handoff via [`payment-handoff.ts`](file:///d:/luggage-storage/luggage-storage/apps/web/src/lib/payment-handoff.ts) + `PW-005` read-only checkout-status polling + 15-minute custody pass issuance via `POST /bookings/:bookingId/custody-pass`).
   - Partial Admin moderation & finance queues (`AD-002`, `AD-004`, `AD-005`, `AD-006`, `AD-007`, `AD-010`, `AD-017`) that mutate/read PostgreSQL **when authenticated as `SUPERADMIN` and non-empty**, though most moderate blindly or fall back to fake rows on empty/error responses.
2. **What is partially implemented, mocked, simulated, disconnected, or misleading?**
   - **Public Traveller Web:** Synthetic featured hubs on `/` (`DEMO_LOCATIONS.slice(0, 3)`), fabricated insurance (`LKR 250,000`), fake capacity (`45/50`), fake hourly/daily-cap pricing tiers (`mapPublicLocationToItem`), broken Search filters/sorting, skipped `GET /availability/search`, static decorative `<QrCode />` icon instead of a scannable QR code (`PW-005` / `PW-011`), unprotected booking portal displaying `DEMO_BOOKINGS`, unpaid `PENDING_PAYMENT` holds mapped to `"CONFIRMED"`, overstated 100% refund displays, dead VAT invoice buttons, missing exception reporting UI, and fake `#TKT-COL-2026-441` support submissions.
   - **Host Dashboard:** Global venue context selector hardcoded to `DEMO_LOCATIONS[0]` (`"loc-cmb-fort-01"`), deadlocked onboarding (`TRAVELLER` blocked from `/host/*`), `9` of `14` `HD-*` screens running zero API calls (`HD-001`, `HD-003`–`HD-006`, `HD-011`–`HD-013`), broken KYC flow (R2 upload and `submitVerification` unwired), premature `submitLocationForReview` failing on draft creation (`400`/`422`), `HOST_STAFF` sidebar prefix-match bypass exposing owner-only routes, silent `setTimeout` simulation on human `LS-*` custody lookups, and **every live Web check-out corrupted to `DISPUTED` / `DISPUTED_RELEASE` (`ON_HOLD` payable)** because `exceptionNotes: "Released via Host Counter Web Desk"` is hardcoded (`HostDashboardPages.tsx:2387`).
   - **Superadmin & Support Dashboard:** `11` of `18` `AD-*` screens make zero API calls (`AD-001`, `AD-003`, `AD-008`, `AD-009`, `AD-011`–`AD-016`, `AD-018`); `AD-018` Staff & RBAC displays 2 static lines despite all `12` backend user/role endpoints being live; `AD-002` & `AD-004` approve/reject without viewing uploaded documents or location profiles; `AD-007` blocks non-linear refund recovery; `AD-005, 006, 007, 010, 017` show fake fixtures on empty DB responses; and `SUPPORT` users hit a hard block screen on `/admin`.
3. **Which existing backend capabilities can be reused directly?**
   - Over **75** of the **93** logical backend endpoints are complete and production-aligned, including **all 12 Admin User & RBAC endpoints** ([`admin.routes.ts`](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/admin/admin.routes.ts#L40-L543)), KYC inspection & presigned document download ([`host-verification.routes.ts`](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/host-verification/host-verification.routes.ts#L41-L74), [`uploads.routes.ts`](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/uploads/uploads.routes.ts#L67-L97)), **18+ host methods already defined in [`marketplace-api.ts`](file:///d:/luggage-storage/luggage-storage/apps/web/src/services/marketplace-api.ts)** (business edit, KYC submission, location edit, hours, exceptions, zones, media, capacity pools, pricing policies, R2 upload initiate/confirm), `GET /availability/search`, `POST /bookings/:id/exceptions`, `GET /hosts/bookings/:id`, `GET /hosts/businesses/:id/payout-details`, and `GET /admin/bookings/:id` + `GET /admin/audit-events/:eventId`.
4. **What exact work is necessary to make all three Web surfaces operational?**
   - **(a)** Fix the critical API client bug (`Content-Type` header on empty bodies + R2 binary `PUT` helper) and backend security bugs (`SUPPORT` write privilege escalation on locations/capacity/pricing, `getBookingDetail` commission redaction, `HOST_STAFF` location reads, post-onboarding JWT refresh, `SYSTEM_PERMISSIONS` Phase B sync, local dev mock-storage `PUT` route).
   - **(b)** Quarantine `DEMO_LOCATIONS` / `DEMO_BOOKINGS` inside an explicit Demo Preview Adapter so zero real users ever see synthetic locations, rates, or bookings.
   - **(c)** Decompose the 3 monolithic page files into modular feature slices powered by TanStack Query hooks (matching `apps/mobile`), wire all unused existing API wrappers, add QR encoding (`qrcode`), and add lightweight backend extensions only where genuinely absent (enriched `GET /discovery/locations/:id`, admin host/dispute/staff/payout/support endpoints, and `GET/PATCH /identity/profile` over existing `traveller_profiles` & `packages/contracts/src/identity/index.ts`).
5. **What is the most efficient, dependency-aware implementation strategy?**
   - Execute **Initiative 1** (API client/security fixes + demo-data quarantine + test harness) first as the mandatory sequential foundation, then run **Initiatives 2–3** (Host KYC & Venue Readiness), **Initiative 4** (Traveller End-to-End Flow), and live **Admin/Governance** work in parallel across isolated feature folders before closing **Initiatives 5–6** (Counter custody/finance reconciliation, MVP payout batches & support tickets, feature-gating post-MVP modules, and full browser E2E verification).

---

## 2. Repository & Architecture Overview

| Layer | Workspace / Package | Key Technologies & Versions (Observed) | Current Role in Monorepo |
| :--- | :--- | :--- | :--- |
| Monorepo | Root (`package.json`) | `pnpm` workspace + `turbo`, TypeScript `5.x` | Orchestrates shared builds, typechecks, and tests across apps/packages |
| Shared Contracts | `packages/contracts` (`@luggage-storage/contracts`) | `zod ^3.24.2`, Vitest `^3.0.5` | Single source of truth for request/response Zod schemas and API envelopes |
| Backend API | `apps/api` (`@luggage-storage/api`) | Fastify `^5.2.0`, Drizzle ORM `^0.39.0`, PostgreSQL + PostGIS, `@fastify/jwt`, `@fastify/cookie`, `argon2`, Zoho SMTP, R2/S3 SDK, PayHere MD5 `PaymentGatewayPort` | Modular monolith exposing **93 logical HTTP endpoints** (dual-mounted at `/api/v1/*` and `/*`) across 30 application + 2 Drizzle/PostGIS internal tables |
| Web Frontend | `apps/web` (`@luggage-storage/web`) | React `^18.3.1`, Vite `^6.0.11`, `react-router-dom ^6.28.0`, `@tanstack/react-query ^5.66.0`, `zustand ^5.0.3`, `react-hook-form ^7.54.2`, Tailwind CSS `^3.4.17`, `lucide-react`, Vitest `^3.0.5` | Serves Traveller (`/*`), Host (`/host/*`), and Superadmin/Support (`/admin/*`) in a single SPA ([`App.tsx`](file:///d:/luggage-storage/luggage-storage/apps/web/src/app/App.tsx)) |
| Mobile App (Reference) | `apps/mobile` (`@luggage-storage/mobile`) | Expo / React Native, TanStack Query, Zustand (`useHostStore`), PayHere SDK | Completed Phase C live integration using TanStack Query hooks (`use-*.ts`) and binary R2 `PUT` uploads |

### Web Routing & Client Infrastructure Verified (`CONFIRMED`)
- **Router (`apps/web/src/app/App.tsx:86-198`):** Public Traveller routes (`/`, `/search`, `/locations/:slug`, `/location/:slug`, `/location`, `/checkout/:locationId`, `/checkout/payhere/return`, `/checkout/payhere/cancel`, `/booking/confirm`, `/become-a-host`, `/how-it-works`, `/help`, `/contact`, `/terms`, `/portal`, `/portal/bookings`, `/health`); Auth routes (`/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`); Protected account routes (`/profile`, `/settings/security`, `/settings/sessions`); Role-protected Host routes (`/host/*` requiring `["HOST_OWNER", "HOST_STAFF", "SUPERADMIN"]` via `ProtectedRoute`); Role-protected Admin routes (`/admin/*` requiring `["SUPERADMIN", "SUPPORT"]` via `ProtectedRoute`).
- **Service Layer:** [`api-client.ts`](file:///d:/luggage-storage/luggage-storage/apps/web/src/lib/api-client.ts) (`fetchApi`, single-flight `refreshAccessToken`), [`auth-api.ts`](file:///d:/luggage-storage/luggage-storage/apps/web/src/services/auth-api.ts) (12 auth methods + `listAdminAuditEvents`), [`marketplace-api.ts`](file:///d:/luggage-storage/luggage-storage/apps/web/src/services/marketplace-api.ts) (741 lines wrapping discovery, bookings, custody, uploads, host, and Phase A/B admin endpoints), [`payment-handoff.ts`](file:///d:/luggage-storage/luggage-storage/apps/web/src/lib/payment-handoff.ts) (PayHere hidden HTML `<form method="POST">` auto-submission).

---

## 3. Current Surface Maturity Assessments & Explicit Basis

| Surface | Maturity Rating | Classification | Basis for Rating (Verified Source Evidence) |
| :--- | :--- | :--- | :--- |
| **A. Public Traveller Website** | **2.5 / 5** — Partial / Unsafe Hybrid Prototype | `CONFIRMED` | Auth flows and live UUID checkout/PayHere return polling hit real persisted APIs, **but** `/` uses `DEMO_LOCATIONS`, Search drops filters/schedule/availability API, `mapPublicLocationToItem` fabricates LKR 250k insurance & capacity, Custody Pass draws a fake `<QrCode />` icon instead of `issuedPass.qrToken`, and `/portal/bookings` is unprotected and mislabels `PENDING_PAYMENT` as `CONFIRMED`. |
| **B. Host Web Dashboard** | **1.5 / 5** — Mostly Simulated / Operationally Broken Hybrid | `CONFIRMED` | `9/14` screens make zero API calls (`HostDashboardLayout` venue selector locked to `DEMO_LOCATIONS[0]`); `TRAVELLER` onboarding is deadlocked at `/host/settings`; KYC upload/submit (`HD-014`) is unwired; `HD-002` creates broken drafts (`L977`); `HOST_STAFF` nav RBAC bypasses owner routes (`L188-214`); `HD-009` check-out corrupts every live release into `DISPUTED` via hardcoded `exceptionNotes` (`L2387`). |
| **C. Superadmin & Support Dashboard** | **2.0 / 5** — Partial Operational Queues | `CONFIRMED` | `7/18` screens hit live endpoints, **but** KYC (`AD-002`) & Location (`AD-004`) moderate blind without viewing docs/listings; `AD-007` locks refunds to happy-path transitions; `5` live screens fall back to synthetic rows when empty/errored; `AD-018` Staff & RBAC ignores `12` live `/admin/users*` & `/admin/roles*` endpoints; `11/18` screens have zero API integration; `SUPPORT` is misrouted to blocked `AD-001`. |

---

## 4. Capability Classification Across the Web Platform

### 4.1 Genuinely Implemented End-to-End (`CONFIRMED`)
- **Account Registration, Login, Refresh & Password Flows:** `LoginPage.tsx`, `RegisterPage.tsx`, `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`, `SecuritySettingsPage.tsx`, `ActiveSessionsPage.tsx` (note: logout/session revocation fails on empty JSON body due to `GAP-001`).
- **System Health & Readiness:** `HealthPage.tsx` (`GET /health`, `GET /ready` via TanStack Query `useQuery`).
- **Live UUID Checkout & PayHere Web Handoff (`PW-004`, `PW-005`):** When navigated directly with an active PostgreSQL location UUID and valid future dates, `WebCheckoutSchedulePage` computes a server quote (`POST /bookings/quote`), creates a capacity-locked booking (`POST /bookings`), initiates a `WEB` payment intent (`POST /payments/intents`), and submits PayHere's signed `DIRECT_POST` form; `WebPaymentConfirmationPage` reconciles via `GET /payments/checkout-status` (3s polling) without trusting browser query flags and issues custody pass secrets (`POST /bookings/:id/custody-pass`).

### 4.2 Partially Implemented / Defective Integration (`CONFIRMED`)
- **Logout & Session Revocation (`useAuthStore.ts:165-188`, `ActiveSessionsPage.tsx`):** `api-client.ts:112-115` unconditionally sends `"Content-Type": "application/json"` with no body, triggering Fastify `400 FST_ERR_CTP_EMPTY_JSON_BODY` on `POST /auth/logout`, `POST /auth/logout-all`, and `DELETE /auth/sessions/:sessionId`. Memory state clears while the DB session & `HttpOnly` cookie survive.
- **Email Verification (`VerifyEmailPage.tsx:45-47`):** Verifies the email in PostgreSQL (`POST /auth/verify-email`), **but** does not call `refreshUser()` / `getMe()` when already signed in, leaving `useAuthStore.user.isEmailVerified` stale.
- **Traveller Discovery, Detail & Portal (`PW-002`, `PW-003`, `PW-011`):** Calls `searchLocations` / `getPublicLocationDetails` / `getMyBookings`, **but** overwrites or bypasses filters (`L574-576`), fabricates insurance/capacity/hourly tiers (`L95-140`), skips `GET /availability/search`, displays a non-scannable `<QrCode />` icon (`L2263, 2379, 3483`), and corrupts status badges (`PENDING_PAYMENT` -> `CONFIRMED` at `L3037`).
- **Host Onboarding, Locations, Bookings, Operations, Finance & Settings (`HD-002, 007, 008, 009, 010, 014`):** Calls isolated endpoints alongside `DEMO_*` fallbacks, blocks `TRAVELLER` onboarding, lacks R2 binary upload wiring, fails draft submission (`L977`), and marks every check-out as `DISPUTED` (`L2387`).
- **Admin Moderation, Bookings, Payments, Refunds, Ledger & Audit (`AD-002, 004, 005, 006, 007, 010, 017`):** Lacks document/listing inspection drawers, misses pagination/filters, omits `MANUAL_REVIEW_REQUIRED`/`FAILED` refund branches (`AdminDashboardPages.tsx:900-915`), and reverts to synthetic mock rows whenever the DB returns `0` items or errors.

### 4.3 Mocked / Simulated on Web — Backend Exists (or Partially Exists) (`CONFIRMED`)
| Capability | Web Screen(s) | Existing Backend Asset Ready to Reuse |
| :--- | :--- | :--- |
| Featured Landing Hubs | `PW-001` (`/`) | `GET /api/v1/discovery/locations` (`discovery.routes.ts:10`) |
| Schedule & Bag Availability Search | `PW-002` (`/search`) | `GET /api/v1/availability/search` (`bookings.routes.ts:42`) |
| Location Editor, Hours, Exceptions, Zones, Capacity, Pricing, Media | `HD-003`–`HD-006` | `PATCH /hosts/locations/:id`, `PUT .../opening-hours`, `POST .../exceptions`, `POST .../zones`, `POST .../media`, `capacity.routes.ts`, `pricing.routes.ts`, `uploads.routes.ts` (already wrapped in `marketplace-api.ts:166-296, 319-340`!) |
| Business KYC Upload & Verification | `HD-014` (`/host/settings`) | `PATCH /hosts/businesses/:id`, `POST /hosts/businesses/:id/verification`, `POST /uploads/presigned-url`, `POST /uploads/confirm` |
| Host Payout Bank View | `HD-011` (`/host/payouts`) | `GET /hosts/businesses/:id/payout-details` (`hosts.routes.ts:197`) |
| Admin User Directory & Role/Permission RBAC | `AD-018` (`/admin/staff`) | **12 live endpoints** in [`admin.routes.ts`](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/admin/admin.routes.ts#L40-L543) |
| Exception / Dispute Filing & Inspection | `PW-011`, `HD-008`, `AD-013` | `POST /bookings/:id/exceptions`, `GET /admin/bookings?status=DISPUTED` (`bookings.routes.ts:171`, `admin-phase-b.routes.ts:40`) |

### 4.4 Missing Capabilities — Backend & Frontend Absent (`CONFIRMED`)
1. **Customer Support Ticketing (`PW-009` Contact Form Submission, `AD-011`, `AD-012`):** `support.ticket.read` / `support.ticket.update` permissions exist in seed SQL, **but** zero `support_tickets` DB table, Zod schemas, or endpoints exist (`ContactUsPage.tsx:2795-2822` fabricates `#TKT-COL-2026-441`).
2. **Reviews & Ratings (`PW-002`, `PW-003`, `HD-012`, `AD-014`):** Zero `reviews` table or endpoints (`discovery.service.ts:200, 307` hardcodes `averageRating: null, reviewCount: 0`).
3. **Promotions & Vouchers (`PW-004`, `AD-015`):** `booking_pricing_snapshots.discount_minor` column exists (hardcoded `0`), with zero promo/coupon tables or endpoints.
4. **Dynamic Platform System Settings (`AD-016` `/admin/settings`):** `admin.platform.manage` permission is seeded, **but** zero settings tables or APIs exist (`1500` bps commission is a contract constant in `packages/contracts/src/bookings/index.ts:40`).
5. **Admin Payout Batches & Manual Disbursement Settlement (`AD-008`, `AD-009`):** `host_payables` accrual works (`ACCRUED` -> `ELIGIBLE` -> `ON_HOLD`), **but** no `payout_batches` table, batch generator, or `ELIGIBLE -> PAID` disbursement endpoints exist.
6. **Host Staff Management API (`HD-013` `/host/staff`):** `host_staff_memberships` table and `HOST_STAFF` RBAC exist and are enforced by `assertHostLocationAccess`, **but** zero `/hosts/businesses/:id/staff` API routes exist to invite/add/remove staff.
7. **User / Traveller Profile Update API (`/profile`):** `traveller_profiles` table, `identity.profile.read/update` permissions, and `UpdateProfileRequestSchema` ([`identity/index.ts`](file:///d:/luggage-storage/luggage-storage/packages/contracts/src/identity/index.ts#L52-L106)) exist, **but** no `/api/v1/identity/profile` Fastify route module is registered in `app.ts`.
8. **Admin Command Metrics (`AD-001`), Host Directory List/Suspend (`AD-003`), Dispute Resolution Transition (`AD-013`):** Individual tables exist, but aggregate metrics, non-KYC host listing/suspension, and `DISPUTED -> COMPLETED` resolution routes are missing.
9. **Custody Bag Photo Upload Purpose:** `CompleteCheckInRequestSchema` (`bags[].photoFileKey`) expects photos, **but** `UPLOAD_PURPOSES` in [`uploads/index.ts`](file:///d:/luggage-storage/luggage-storage/packages/contracts/src/uploads/index.ts#L8) and [`uploads.service.ts`](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/uploads/uploads.service.ts#L49-L115) only support `["HOST_VERIFICATION", "LOCATION_IMAGE"]`.

---

## 5. Backend Integration, Persistence, Security & Authorization Summary

- **Strong Persisted Core (`apps/api`):** All Phase 1B, Phase A, and Phase B flows use parameterized Drizzle queries + serializable/row-locked PostgreSQL transactions (`SELECT ... FOR UPDATE`), HMAC-SHA256 single-use custody tokens with 5-attempt lockout, PayHere MD5 constant-time signature verification, atomic capacity-pool reservations, OQ-012 post-confirmation address disclosure, OQ-015 Zero Possessory Lien collection release, and balanced double-entry ledger postings (`trial balance = 0`).
- **Confirmed High-Risk Defects Across Layers:**
  1. **Empty JSON Body Bug (`Critical`, Web Client):** `apps/web/src/lib/api-client.ts:112-115` unconditionally sets `"Content-Type": "application/json"` on `logout`, `logoutAll`, `revokeSession`, `submitLocationForReview`, and `disableLocation`, causing Fastify 5 `400 FST_ERR_CTP_EMPTY_JSON_BODY`.
  2. **`SUPPORT` Role Write Escalation (`Critical`, Backend AuthZ):** `locations.routes.ts`, `capacity.routes.ts`, and `pricing.routes.ts` only run `[app.authenticate]` (missing `app.requirePermission(...)`), and `locations.service.ts:216` treats `["SUPERADMIN", "SUPPORT"]` as authorized for `getLocationById`, which all write methods call for access control.
  3. **Check-Out `DISPUTED` Data Corruption (`Critical`, Host Web):** `HostDashboardPages.tsx:2387` hardcodes `exceptionNotes` on every `completeCollection`, forcing clean handovers into `DISPUTED` / `DISPUTED_RELEASE` and freezing host payables (`ON_HOLD`).
  4. **Booking Commission Disclosure (`High`, Backend Service):** `bookings.service.ts:481-483` (`getBookingDetail`) returns `commissionRateBps`, `platformCommissionMinor`, and `hostPayableMinor` unredacted to `TRAVELLER` and `HOST_STAFF` (violating `BR-095`).
  5. **Host Onboarding Deadlock & Stale JWT (`High`, Web + Backend):** `/host/*` blocks `TRAVELLER`; `POST /hosts/businesses` assigns `HOST_OWNER` in DB without refreshing the JWT, causing immediate `403` in `uploads.service.ts:51` and `ledger.service.ts:413`.
  6. **Local Dev Mock Upload Receiver Missing (`Medium`, Backend Dev Adapter):** When R2 env vars are unset, `storage.service.ts` emits `/api/v1/uploads/mock-storage/...` URLs that 404 because no Fastify `PUT` handler exists.

---

## 6. Testing & QA Status (`CONFIRMED`)

- **Backend (`apps/api/tests` — 24 files) & Contracts (`packages/contracts/tests` — 3 files):** Real unit, contract, RBAC, ledger invariant, PayHere webhook, custody state-machine, and PostgreSQL transactional integration suites exist on the backend.
- **Web (`apps/web/tests` — 5 files):**
  - [`apps/web/vitest.config.ts:13-15`](file:///d:/luggage-storage/luggage-storage/apps/web/vitest.config.ts#L13-L15) configures `environment: "node"` (no `jsdom` or `happy-dom`, zero `@testing-library/react`, zero Playwright/Cypress browser E2E).
  - [`host-dashboard-journeys.test.tsx`](file:///d:/luggage-storage/luggage-storage/apps/web/tests/host-dashboard-journeys.test.tsx) and sibling UI test files execute synchronous SSR via `react-dom/server` `renderToString()`. Because `useEffect` never executes during `renderToString()`, **zero live API fetches, error branches, or user interactions are exercised**, and tests pass solely because component `useState` initializes from `DEMO_LOCATIONS` and `DEMO_BOOKINGS`. This creates a false sense of verification coverage.

---

## 7. Confirmed Technical Debt

1. **Monolithic Page Bundles (`9,104` lines in 3 files):** All PW, HD, and AD screens live in three tightly coupled files (`PublicMarketplacePages.tsx`, `HostDashboardPages.tsx`, `AdminDashboardPages.tsx`), blocking code-splitting and maintainable hook decomposition.
2. **Unused Data & Form Libraries:** `@tanstack/react-query` (installed & provider-mounted) and `react-hook-form` (installed) sit unused across 99% of `apps/web`, causing manual `useEffect` race conditions, duplicate requests, and stale cross-screen caches.
3. **Divergent Mock Domain Models (`mock-marketplace.ts`):** Mock types use major-unit LKR floats, non-existent hourly rates (`hourlyRateLkr`/`dailyCapLkr`), invented booking statuses (`CHECKED_IN`, `OVERDUE`, `DISPUTED_OVERDUE`, `CANCELLED_REFUNDED`), and invented 7-stage refund names rather than importing `@luggage-storage/contracts` (`PricingPolicy` minor units + `CALENDAR_DAY`/`24_HOUR_BLOCK`, `BookingStatus`, `RefundStatus`).
4. **`SYSTEM_PERMISSIONS` Drift (`packages/contracts/src/rbac/index.ts:15-75`):** Contains 29 Phase A constants while omitting all **12 Phase B permissions** seeded in `0012_phase_b_booking_escrow_custody.sql` (`bookings.*`, `hosts.bookings.*`, `hosts.custody.operate`, `hosts.finance.read_own`, `admin.booking.*`, `admin.payment.read`, `admin.refund.*`).
5. **Pagination Envelope Inconsistency:** `createPaginatedResponse` places `pagination` (`hasNext`, `hasPrev`) at the top level alongside `data: T[]`, while 4 Phase A/discovery endpoints (`/discovery/locations`, `/admin/verifications`, `/admin/locations/moderation-queue`, `/admin/finance/ledger`) nest `{ items, pagination }` inside `data` via `createSuccessResponse`; `auth-api.ts:169-185` discards `res.pagination` completely.

---

## 8. Revalidation of Previous / Historical Findings (`HISTORICAL` vs `CONFIRMED`)

| Prior Finding / Reference | Revalidation Verdict | Source Evidence & Nuance |
| :--- | :--- | :--- |
| `AUD-007` — `?preview=demo` bypasses `/host/*` & `/admin/*` in production builds (`docs/project-stabilization-2/06-demo-preview-security.md`) | **`HISTORICAL` (Route Guard Resolved)** / **`CONFIRMED` (Component Contamination Active)** | `isDemoPreviewConfigEnabled` in [`demo-preview.ts`](file:///d:/luggage-storage/luggage-storage/apps/web/src/config/demo-preview.ts#L14-L59) and [`ProtectedRoute.tsx`](file:///d:/luggage-storage/luggage-storage/apps/web/src/components/auth/ProtectedRoute.tsx#L41-L67) correctly block `?preview=demo` in `PROD` unless `VITE_ENABLE_DEMO_PREVIEW=true`. **However**, when demo preview is OFF and for authenticated users, `DEMO_LOCATIONS` and `DEMO_BOOKINGS` still contaminate `/` (`PW-001`), `/search`, `/locations/:slug`, `/portal/bookings`, `/host/*`, and `/admin/*`. |
| Stale role code `SUPPORT_ADMIN` (`docs/project-stabilization/06-frontend-integration-report.md:20-23`) | **`HISTORICAL` (Resolved in `App.tsx`)** / **`PARTIALLY CONFIRMED` (Stale Doc Examples)** | [`App.tsx`](file:///d:/luggage-storage/luggage-storage/apps/web/src/app/App.tsx#L141) enforces `["SUPERADMIN", "SUPPORT"]`. Doc references to `host.locations.manage` / `admin.users.write` do not match actual `SYSTEM_PERMISSIONS` (`hosts.location.*`, `admin.user.*`). |
| Public marketplace `DEMO_LOCATIONS` & fabricated `mapPublicLocationToItem()` fields (Section 5.3 prompt baseline) | **`CONFIRMED`** | [`PublicMarketplacePages.tsx`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L61-L158) still imports `DEMO_LOCATIONS`/`DEMO_BOOKINGS` and fabricates insurance (`250000`), grace period (`30`), hourly pricing, and capacity (`45/50`). |
| Host dashboard resolving `currentLocation` via `DEMO_LOCATIONS.find(...) \|\| DEMO_LOCATIONS[0]` (Section 5.3) | **`CONFIRMED`** | [`HostDashboardPages.tsx`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L165-L168) hardcodes `currentLocation` and the entire sidebar venue `<select>` (`L290-291`) to `DEMO_LOCATIONS`. |
| Admin dashboard synthetic datasets & unimplemented Support/Reviews/Promotions/Settings (Section 5.3) | **`CONFIRMED`** | [`AdminDashboardPages.tsx`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx#L45-L50) uses `DEMO_LOCATIONS`/`DEMO_BOOKINGS` across `AD-003, 005, 006, 007, 010, 017`, while `AD-008, 009, 011–016, 018` have zero live API calls on Web. |

---

## 9. Verification Limitations & Remaining Unknowns

1. **Static Source-Level Verification Only:** Inside the constrained assessment sandbox, `pnpm --filter @luggage-storage/web test` / `typecheck` / `lint` exited with code `1` because `nvm-windows` hosts `node.exe` outside the sandbox-readable path (`C:\Users\talno\AppData\Local\nvm` — access denied), and no live Fastify/PostgreSQL/Vite dev server or Playwright browser session was executed during this read-only audit. **No runtime or production verification claims are made.**
2. **External Provider Runtime Unknowns (`UNVERIFIED` / `BLOCKED`):**
   - Cloudflare R2 production bucket CORS headers (`PUT` from Web origin) and public CDN asset URL resolution (`ASSET_BASE_URL` / `R2_PUBLIC_URL`).
   - PayHere live production merchant approval (`OQ-003`, `OQ-013`), Sri Lankan legal/tax sign-off on VAT/SSCL/WHT (`OQ-010`), statutory Sri Lanka KYC checklist (`OQ-002`), Zoho Mail `SPF/DKIM/DMARC` DNS verification (`OQ-019`), and MapTiler commercial API key provisioning (`OQ-018`).

