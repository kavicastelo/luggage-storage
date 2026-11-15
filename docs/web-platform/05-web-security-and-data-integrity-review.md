# Web Security & Data Integrity Review

> **Document Classification:** Principal Architectural Gap Analysis — Security, RBAC & Data Integrity Audit  
> **Repository Snapshot:** `dev` branch, commit `b09fa68` (clean working tree)  
> **Scope:** Cross-stack security, session integrity, RBAC, tenant isolation, object storage, payment handoff, custody/ledger correctness, and synthetic data isolation across [apps/web](file:///d:/luggage-storage/luggage-storage/apps/web), [apps/api](file:///d:/luggage-storage/luggage-storage/apps/api), and [packages/contracts](file:///d:/luggage-storage/luggage-storage/packages/contracts)  
> **Verification Status:** Static source audit (`CONFIRMED`, `UNVERIFIED`, `BLOCKED`); live CLI/runtime execution did not run in this environment (see [Section 9](#9-verification-limitations--runtime-test-plan)).

---

## 1. Executive Risk Summary & Audit Methodology

The platform backend ([apps/api](file:///d:/luggage-storage/luggage-storage/apps/api)) implements strong foundational primitives—`HttpOnly` `SameSite=Strict` refresh token rotation, in-memory JWT access tokens, `requirePermission` / `requireAllPermissions` route decorators with `AUTH_ACCESS_DENIED` audit logging, PostGIS coordinate rounding, double-entry ledger splits, and zero-possessory-lien custody state transitions.

However, **four Critical and seven High-severity integration, authorization, and data-integrity defects** currently render the live Web platform unsafe for production launch:

1. **Silent Logout Failure & Session Resurrection (`SEC-01` — Critical, `CONFIRMED`)**: Every empty-body `POST` (`logout`, `logoutAll`, `revokeSession`, `submitLocationForReview`, `disableLocation`) sends `"Content-Type": "application/json"` with `body: undefined`, triggering Fastify `400 FST_ERR_CTP_EMPTY_JSON_BODY`, while [useAuthStore.ts](file:///d:/luggage-storage/luggage-storage/apps/web/src/store/useAuthStore.ts#L165-L188) swallows the error and leaves the `HttpOnly` refresh cookie + database session alive. Reloading the tab silently logs the user back in.
2. **Unprotected Host Location/Capacity/Pricing Mutators & `SUPPORT` Privilege Escalation (`SEC-04` — Critical, `CONFIRMED`)**: All 10 routes in [locations.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/locations/locations.routes.ts#L15-L332), 3 routes in [capacity.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/capacity/capacity.routes.ts#L11-L109), and 2 routes in [pricing.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/pricing/pricing.routes.ts#L10-L74) omit `app.requirePermission(...)`. Worse, [locations.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/locations/locations.service.ts#L216) checks `["SUPERADMIN", "SUPPORT"].includes(r)`, enabling read-only `SUPPORT` accounts to mutate or disable any host's locations, capacity, and LKR pricing.
3. **Clean Check-Out Disputed Corruption & Double-Entry Ledger Suppression (`DI-01` — Critical, `CONFIRMED`)**: `HD-009` check-out in [HostDashboardPages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L2387) unconditionally submits `exceptionNotes: "Released via Host Counter Web Desk"`. [custody.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/custody/custody.service.ts#L747-L757) treats any truthy `exceptionNotes` as `hasDisputeException = true`, forcing every Web checkout into `DISPUTED_RELEASE` / `DISPUTED` / `host_payables = "ON_HOLD"` and blocking the 85%/15% ledger revenue split. Simultaneously, [HostDashboardPages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L2345) + [L2405-L2413](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L2405-L2413) intercepts `LS-*` booking references with a fake `700ms` timer instead of resolving the booking UUID.
4. **Fabricated Insurance, Capacity, Policies & Fallback Demo Records Shown as Authoritative (`DI-02` & `DI-03` — Critical, `CONFIRMED`)**: Even with `AUD-007` blocking `?preview=demo` routes in production ([demo-preview.ts](file:///d:/luggage-storage/luggage-storage/apps/web/src/config/demo-preview.ts)), live Traveller, Host, and Admin pages fabricate `hasInsurance: true`, `insuranceLimitLkr: 250000`, `45/50` capacity, `gracePeriodMinutes: 30`, hourly tiers ([PublicMarketplacePages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L95-L140)), `CONFIRMED` status for `PENDING_PAYMENT` bookings ([L3037](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L3037), [L3299](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L3299)), and fall back to `DEMO_LOCATIONS` / `DEMO_BOOKINGS` on empty results or API errors.

### Finding Classification Convention

| Tag | Meaning |
| --- | --- |
| `CONFIRMED` | Directly observed in source files in commit `b09fa68` and verified line-for-line. |
| `PARTIALLY CONFIRMED` | Mechanism exists in code, but full end-to-end persistence or UI binding is incomplete. |
| `UNVERIFIED` | Depends on runtime execution, external cloud config, or environment variables not inspectable from static repo source. |
| `BLOCKED` | Stopped by an open governance/vendor/legal gate (`OQ-*`) or external provisioning dependency. |

---

## 2. Authentication & Session Security (`SEC-01` to `SEC-03`)

### `SEC-01` — Unconditional `Content-Type: application/json` Breaks Empty-Body Mutations & Revives Logged-Out Sessions
- **Status / Severity:** `CONFIRMED` | **Critical**
- **Affected Files:**
  - [api-client.ts](file:///d:/luggage-storage/luggage-storage/apps/web/src/lib/api-client.ts#L112-L115)
  - [useAuthStore.ts](file:///d:/luggage-storage/luggage-storage/apps/web/src/store/useAuthStore.ts#L82-L109), [L165-L188](file:///d:/luggage-storage/luggage-storage/apps/web/src/store/useAuthStore.ts#L165-L188)
  - [auth-api.ts](file:///d:/luggage-storage/luggage-storage/apps/web/src/services/auth-api.ts#L63-L66), [L74-L76](file:///d:/luggage-storage/luggage-storage/apps/web/src/services/auth-api.ts#L74-L76), [L100-L102](file:///d:/luggage-storage/luggage-storage/apps/web/src/services/auth-api.ts#L100-L102)
  - [marketplace-api.ts](file:///d:/luggage-storage/luggage-storage/apps/web/src/services/marketplace-api.ts#L182-L184), [L189-L191](file:///d:/luggage-storage/luggage-storage/apps/web/src/services/marketplace-api.ts#L189-L191)
- **Root Cause & Impact:**
  - `api-client.ts` merges `"Content-Type": "application/json"` into every request header map even when `options?.body === undefined`. Fastify's built-in JSON parser rejects `POST` requests declaring `application/json` with zero bytes, returning `400 FST_ERR_CTP_EMPTY_JSON_BODY`.
  - Five live endpoints are deterministically broken by this single defect: `authApi.logout`, `authApi.logoutAll`, `authApi.revokeSession`, `marketplaceApi.submitLocationForReview`, and `marketplaceApi.disableLocation`.
  - In `useAuthStore.ts:165-188`, `logout()` and `logoutAll()` wrap the API call in an empty `catch {}` block and clear only in-memory Zustand state (`accessToken`, `user`). The `HttpOnly` refresh cookie and `auth_sessions` database record remain active. On next page reload, `initAuth()` (`L82-L109`) calls `POST /auth/refresh` (which carries `{}` or refresh cookie) and **silently re-authenticates the user**. On shared kiosk/host-desk browsers, this represents a direct account takeover / session persistence vulnerability.
- **Required Fix:** Set `"Content-Type": "application/json"` in `api-client.ts` **only** when `options?.body !== undefined` and body is not `FormData`/`Blob`. Clear cookies deterministically by calling `/auth/logout` cleanly and surfacing failure warnings if session revocation fails instead of swallowing errors silently.

### `SEC-02` — Cookie Path Divergence Between Unversioned `/auth*` and Versioned `/api/v1/auth*` + Unguarded Refresh JSON Parsing
- **Status / Severity:** `CONFIRMED` | **High**
- **Affected Files:**
  - [auth.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/auth/auth.routes.ts#L32-L40)
  - [api-client.ts](file:///d:/luggage-storage/luggage-storage/apps/web/src/lib/api-client.ts#L86-L88), [L145](file:///d:/luggage-storage/luggage-storage/apps/web/src/lib/api-client.ts#L145)
- **Root Cause & Impact:**
  - `getCookieConfig` (`auth.routes.ts:32-40`) inspects route registration context and sets `path: "/"` on unversioned `/auth*` mounts versus `path: "/api/v1/auth"` on `/api/v1/auth*`. If any client/proxy/test mixes prefixes or logs in via one prefix and logs out/refreshes via the other, duplicate `refresh_token` cookies scoped to `/` and `/api/v1/auth` can coexist or fail to clear.
  - Meanwhile, `api-client.ts:86-88` handles HTTP 200 responses during token refresh without calling `onAuthFailure()` if the JSON payload is malformed, and `L145` calls `await retryResponse.json()` without guarding against non-JSON proxy error responses (e.g., 502 HTML), crashing callers with `SyntaxError` rather than structured `ApiClientError`.
- **Required Fix:** Standardize Web client exclusively on `/api/v1/*`, ensure `clearCookie` on logout clears matching cookie paths consistently if dual mounts remain supported, and guard `refreshResponse` + `retryResponse` JSON parsing in `api-client.ts` with deterministic `onAuthFailure()` cleanup on malformed 200 auth responses.

### `SEC-03` — Stale JWT Role Claims After Host Onboarding (`POST /hosts/businesses`) & Email Verification
- **Status / Severity:** `CONFIRMED` | **High**
- **Affected Files:**
  - [hosts.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/hosts/hosts.service.ts#L69-L84)
  - [uploads.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/uploads/uploads.service.ts#L51)
  - [ledger.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/finance/ledger.service.ts#L413)
  - [VerifyEmailPage.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/VerifyEmailPage.tsx)
- **Root Cause & Impact:**
  - When a signed-in `TRAVELLER` submits `POST /api/v1/hosts/businesses`, `hosts.service.ts:69-84` writes the `HOST_OWNER` role assignment (`self_assign_host_owner_role`) into PostgreSQL without re-issuing or rotating the access token. The browser still holds the pre-onboarding JWT containing `roles: ["TRAVELLER"]` until access-token expiry (up to 15 minutes).
  - Both `uploads.service.ts:51` (`context.roles.includes("HOST_OWNER") || isSuperadmin`) and `ledger.service.ts:413` (`!isSuperadmin && !userRoles.includes("HOST_OWNER")`) inspect JWT `context.roles` rather than DB roles/permissions, returning `403 Forbidden` immediately after host creation when the user tries to upload KYC verification documents or inspect finance.
  - Additionally, `VerifyEmailPage.tsx` completes verification without calling `refreshUser()`, leaving `user.emailVerified` stale in `useAuthStore`.
- **Required Fix:** After `POST /hosts/businesses` and email verification succeed on the client, immediately call silent `/api/v1/auth/refresh` + `refreshUser()` (`GET /api/v1/auth/me`) so fresh JWT claims and DB-loaded permissions propagate synchronously. Long-term, backend services (`uploads.service.ts`, `ledger.service.ts`) should resolve ownership/permissions cleanly rather than relying solely on `roles[]` strings in short-lived tokens.

---

## 3. RBAC, Permission Enforcement & Admin Privilege Boundaries (`SEC-04` to `SEC-06`)

### `SEC-04` — Missing `requirePermission` Middleware & `SUPPORT` Host-Mutation Escalation Across Locations, Capacity & Pricing
- **Status / Severity:** `CONFIRMED` | **Critical**
- **Affected Files:**
  - [locations.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/locations/locations.routes.ts#L15-L332)
  - [capacity.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/capacity/capacity.routes.ts#L11-L109)
  - [pricing.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/pricing/pricing.routes.ts#L10-L74)
  - [locations.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/locations/locations.service.ts#L173-L221)
  - [packages/contracts/src/rbac/index.ts](file:///d:/luggage-storage/luggage-storage/packages/contracts/src/rbac/index.ts#L15-L75)
- **Root Cause & Impact:**
  1. All 10 routes in `locations.routes.ts`, all 3 routes in `capacity.routes.ts`, and both routes in `pricing.routes.ts` declare only `preHandler: [app.authenticate]` with **zero** `app.requirePermission(...)` checks.
  2. Every mutating method in `locations.service.ts` calls `this.getLocationById(locationId, context)` (`L173-L221`), where `L216` checks `["SUPERADMIN", "SUPPORT"].includes(r)`. Consequently, a `SUPPORT` user (intended by `OQ-011` and [admin-phase-b.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/admin/admin-phase-b.routes.ts#L36) to have read-only oversight) can **bypass host ownership** and edit/disable/submit locations, alter operating hours/exceptions/zones, modify bag capacity, and overwrite LKR pricing for **any host on the platform**.
  3. Conversely, `locations.service.ts:173-221` checks business `ownerUserId` without inspecting `host_staff_memberships`, blocking authorized `HOST_STAFF` where staff location viewing is expected.
  4. `packages/contracts/src/rbac/index.ts:15-75` `SYSTEM_PERMISSIONS` stops at Phase A and omits all 12 Phase B permissions used in backend routes (`bookings.*`, `custody.*`, `admin.booking.*`, `admin.payment.*`, `admin.refund.*`, `admin.finance.*`, etc.), risking UI permission constant drift.
- **Required Fix:**
  - Separate read authorization (`getLocationById`, permitting owner, scoped `HOST_STAFF`, `SUPERADMIN`, read-only `SUPPORT`) from write authorization (`assertLocationWriteAccess`, permitting only business `ownerUserId` or `SUPERADMIN`, rejecting `SUPPORT` with `403`).
  - Attach explicit `app.requirePermission(...)` preHandlers on `locations.routes.ts`, `capacity.routes.ts`, and `pricing.routes.ts`.
  - Synchronize all Phase B permissions into `@luggage-storage/contracts` (`SYSTEM_PERMISSIONS`).

### `SEC-05` — Nonexistent `ADMIN_FINANCIAL` Role Check + Frontend Route/Navigation RBAC Drift
- **Status / Severity:** `CONFIRMED` | **High**
- **Affected Files:**
  - [hosts.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/hosts/hosts.service.ts#L429)
  - [AdminDashboardPages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx#L77-L94), [L727](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx#L727)
  - [HostDashboardPages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L188-L214), [L632-L642](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L632-L642)
  - [AppShell.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/components/layout/AppShell.tsx#L90-L110)
  - [App.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/app/App.tsx#L105-L116)
- **Root Cause & Impact:**
  - **Backend Dead Role String (`hosts.service.ts:429`)**: `getPayoutDetails` computes `const isFinancialAdmin = context.roles.includes("SUPERADMIN") || context.roles.includes("ADMIN_FINANCIAL");`. No `ADMIN_FINANCIAL` role exists in `packages/contracts` RBAC definitions; the check only passes for `SUPERADMIN`.
  - **Host Staff Nav Prefix Bypass (`HostDashboardPages.tsx:188-214`)**: `operationalNavItems` places `/host/locations` (`ownerOnly: false`) ahead of `/host/locations/${selectedLocationId}/*` (`ownerOnly: true`). `.startsWith()` route matching grants `HOST_STAFF` direct UI access to `HD-003`..`HD-006` (Location Edit, Hours, Zones, Capacity, Pricing), even though `HOST_STAFF` must only view operational custody/bookings. Additionally, `HD-001` (`L632-L642`) exposes `"Net Cleared Earnings"` to `HOST_STAFF` (violating `OQ-017`).
  - **Admin vs Support Inversion (`AdminDashboardPages.tsx:77-94, 727`, `AppShell.tsx:102-110`)**: Admin nav marks `AD-002`, `AD-004`, `AD-006`, `AD-007`, and `AD-018` `superadminOnly: true`, blocking `SUPPORT` from screens whose backend APIs grant `SUPPORT` read access (`admin.host.read`, `admin.location.read`, `admin.payment.read`, `admin.refund.read`, `admin.user.read`). Meanwhile `AD-005` (`L727`) exposes `"Admin Cancel"` (`admin.booking.manage`, `SUPERADMIN`-only) to `SUPPORT`, resulting in `403` errors on click. `AppShell.tsx:102-110` links `SUPPORT` directly to `/admin` (which may fail if `AD-001` assumes `SUPERADMIN` metrics).
  - **Traveller Unprotected / Host-Blocked Routes (`App.tsx:105-116`, `AppShell.tsx:90-95`)**: `/booking/confirm`, `/checkout/payhere/*`, `/portal`, and `/portal/bookings` sit outside `ProtectedRoute`, letting unauthenticated tabs render dead/fallback shells; conversely, `/host/*` blocks `TRAVELLER` from reaching `/host/settings` even though onboarding (`POST /hosts/businesses`) begins as `TRAVELLER`; `AppShell.tsx:90-95` shows `"Host Portal"` to everyone regardless of role.
- **Required Fix:** Replace ad-hoc `ownerOnly` / `superadminOnly` nav heuristics with permission-driven guards mirroring exact backend `requirePermission` codes (`hasPermission(...)`); separate `/become-a-host` outside `HOST_OWNER` guard while gating `/host/*` on `HOST_OWNER | HOST_STAFF`; wrap `/booking/confirm`, `/checkout/payhere/*`, and `/portal*` inside `ProtectedRoute`.

### `SEC-06` — Unnecessary Internal Metadata Exposure on Authenticated Profile & 404 Views
- **Status / Severity:** `CONFIRMED` | **Low**
- **Affected Files:**
  - [ProfilePage.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/ProfilePage.tsx#L135-L213)
  - [NotFoundPage.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/NotFoundPage.tsx#L20-L26)
- **Root Cause & Impact:**
  - `ProfilePage.tsx:135-213` prints raw internal user UUIDs and flat RBAC permission code arrays directly to regular travellers/hosts (`user.id`, raw permission slugs), giving unnecessary internal schema reconnaissance to end users while offering no editable profile fields (even though `UpdateProfileRequestSchema` already exists in `packages/contracts/src/identity/index.ts:52-106`).
  - `NotFoundPage.tsx:20-L26` prints internal page spec identifiers `(PW-001)` / `(PW-002)` to external visitors.
- **Required Fix:** Restrict raw permission arrays / internal IDs to Superadmin audit/user drawers (`AD-017` / `AD-018`) and remove internal `PW-*` IDs from user-facing error pages.

---

## 4. Host / Tenant Isolation & Sensitive Financial Exposure (`SEC-07` to `SEC-09`)

### `SEC-07` — Commission & Platform Take-Rate Exposure on `getBookingDetail`
- **Status / Severity:** `CONFIRMED` | **High** (`BR-095` Violation)
- **Affected Files:**
  - [bookings.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/bookings/bookings.service.ts#L481-L483)
- **Root Cause & Impact:**
  - `getBookingDetail` (`GET /api/v1/bookings/:bookingId`) selects and returns `commissionRateBps`, `platformCommissionMinor`, and `hostPayableMinor` indiscriminately regardless of caller role. Both `TRAVELLER` and `HOST_STAFF` receive platform commission margins and wholesale host settlement amounts (`BR-095` mandates hiding platform-internal split/payable details from travellers and unauthorized staff).
- **Required Fix:** Redact `commissionRateBps`, `platformCommissionMinor`, and `hostPayableMinor` unless caller holds `hosts.finance.read` (as owning `HOST_OWNER`) or `admin.finance.read` / `SUPERADMIN`.

### `SEC-08` — Host Staff Dashboard Financial Leak & Onboarding Verification Status Vocabulary Mismatch
- **Status / Severity:** `CONFIRMED` | **Medium**
- **Affected Files:**
  - [HostDashboardPages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L632-L642)
  - [hosts.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/hosts/hosts.service.ts#L379)
- **Root Cause & Impact:**
  - `HD-001` (`HostDashboardPages.tsx:632-642`) unconditionally renders `"Net Cleared Earnings"` even when `user` is `HOST_STAFF` without `hosts.finance.read` (`OQ-017` prohibits exposing business payouts/revenue to counter staff).
  - `hosts.service.ts:379` transitions `host_businesses.status` to `"PENDING_VERIFICATION"` when submitted, whereas the verification record enters `"PENDING_REVIEW"`. UI helpers must handle both domain statuses distinctly (`business.status` vs `verification.status`) instead of conflating them or fabricating `"ACTIVE"` fallback states.
- **Required Fix:** Gate all finance widgets, routes (`/host/finance`), and summaries in Web UI on `hasPermission("hosts.finance.read")` backed by server redaction; map both `"PENDING_VERIFICATION"` and `"PENDING_REVIEW"` accurately in UI status badges.

### `SEC-09` — Public Registration Privilege-Escalation Prevention (`POSITIVE CONTROL`) & Portal Link Hygiene
- **Status / Severity:** `CONFIRMED` | **Informational / Low**
- **Affected Files:**
  - [RegisterPage.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/RegisterPage.tsx#L54)
  - [AppShell.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/components/layout/AppShell.tsx#L90-L95)
- **Observed Behavior:**
  - `RegisterPage.tsx:54` **correctly** submits public signups without a user-selectable `role` field, enforcing backend default `TRAVELLER` assignment and preventing self-signup privilege escalation (`Register` -> `ADMIN`/`HOST` tampering).
  - However, `AppShell.tsx:90-95` displays the `"Host Portal"` top-nav link to all authenticated users (including ordinary `TRAVELLER` accounts without a business) while directing them into guarded `/host/*` routes that bounce back or hit dead states, and omits a mobile navigation drawer at `L40` (`hidden lg:flex`).
- **Required Fix:** Preserve role-free registration; in `AppShell.tsx`, label the traveller-facing link `"Become a Host"` (`/become-a-host`) until the user holds `hosts.location.read` or `hosts.custody.operate`, and add responsive mobile navigation.

---

## 5. Object Storage & Upload Security (`SEC-10`)

### `SEC-10` — Document / Media Presigned Upload Flow, CORS Exposure & Stale-Role `403`
- **Status / Severity:** `CONFIRMED` (code) / `UNVERIFIED` (Cloudflare R2 live CORS) | **High**
- **Affected Files:**
  - [uploads.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/uploads/uploads.routes.ts#L1-L98)
  - [uploads.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/uploads/uploads.service.ts#L1-L562)
  - [app.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/app.ts#L1-L80)
- **Verified Server Controls:**
  - `POST /api/v1/uploads/presigned-url` requires `UPLOAD_INITIATE` permission and supports strictly `"HOST_VERIFICATION"` and `"LOCATION_IMAGE"` upload purposes (`upload_intents` tracking).
  - `GET /api/v1/uploads/documents/:documentId/download` enforces `authenticate`, authorizes only the owning host or `["SUPERADMIN", "SUPPORT"]`, generates short-lived (`900s`) presigned download URLs, and records `DOCUMENT_ACCESSED` audit events.
- **Confirmed Gaps & Unverified Infrastructure Dependencies:**
  1. **Stale JWT Rejection (`SEC-03` overlap)**: `uploads.service.ts:51` verifies `context.roles.includes("HOST_OWNER") || isSuperadmin`, rejecting newly onboarded hosts until JWT refresh occurs.
  2. **Broken Web Client Binary `PUT` & Intent Confirmation**: `api-client.ts` forces JSON headers; multipart/binary `PUT` to presigned R2 URLs must bypass `api-client` JSON injection, `Authorization` headers (never send platform Bearer JWT to R2 signed URLs!), and call `POST /api/v1/uploads/confirm` after byte upload completes.
  3. **Cloudflare R2 Bucket CORS (`UNVERIFIED` / `BLOCKED` on Cloud Infra)**: Fastify `isCorsOriginAllowed` in `app.ts` governs API calls only; direct browser `PUT` from the Vite/production Web origin to Cloudflare R2 presigned URLs **requires explicit `AllowedOrigins` + `PUT` + `Content-Type` CORS rules on the R2 bucket**. Local dev without R2 credentials falls back to stub URLs that fail `PUT` unless handled or pointed at an emulator/live dev bucket.
  4. **Missing Deletion Routes**: No `DELETE` route exists in [locations.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/locations/locations.routes.ts#L1-L333) for uploaded location media (`LOCATION_IMAGE`).

---

## 6. Payment Gateway Handoff, Refund State & Webhook Integrity (`SEC-11`)

### `SEC-11` — Premature Booking Confirmation Display + Incomplete Admin Refund Transitions
- **Status / Severity:** `CONFIRMED` (Web defects) / `BLOCKED` (`OQ-003`, `OQ-013`) | **High**
- **Affected Files:**
  - [PublicMarketplacePages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L3037), [L3299](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L3299), [L3426](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L3426)
  - [AdminDashboardPages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx#L900-L915)
  - [admin-phase-b.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/admin/admin-phase-b.routes.ts#L1-L217)
- **Root Cause & Impact:**
  - **False Confirmation of Unpaid Bookings (`PW-011`)**: `PublicMarketplacePages.tsx:3037` maps backend status `"PENDING_PAYMENT"` to display state `"CONFIRMED"` (`L3299` `"Confirmed & Reserved"`). If PayHere checkout is cancelled, abandoned, or webhook `notify_url` fails/lags, the Web UI falsely tells the traveller their booking is confirmed without verified payment capture.
  - **Misleading 100% Refund Quote (`PW-011` / `L3426`)**: Booking detail/cancellation displays `100%` of `totalAmountLkr` rather than quoting authoritative cancellation/refund policy calculations returned by the backend.
  - **Truncated Admin Refund State Machine (`AD-007`)**: `AdminDashboardPages.tsx:900-915` restricts `nextRefundStage` to linear forward completion and provides **no UI actions** to transition refunds to `FAILED` or `MANUAL_REVIEW_REQUIRED` (both essential for PayHere manual-settlement workflows and error handling).
  - **Unverified / Blocked Vendor Dependencies**:
    - `OQ-003` (`BLOCKED`, `VENDOR_CONFIRMATION_REQUIRED`): PayHere live merchant/marketplace settlement approval.
    - `OQ-013` (`UNVERIFIED` / open governance): Whether PayHere refunds execute automatically via API or manually via merchant portal before `POST /api/v1/admin/refunds/:id/transition`.
    - `OQ-010` (`BLOCKED`, `LEGAL_REVIEW_REQUIRED`, `TAX_REVIEW_REQUIRED`): Sri Lanka VAT/SSCL/WHT invoicing rules on receipts/payout statements.
- **Required Fix:** Strictly render `"Awaiting Payment Confirmation"` while status is `PENDING_PAYMENT` and poll/reconcile `GET /api/v1/bookings/:id` + payment status upon PayHere `return_url`/`cancel_url` without trusting URL query parameters alone; support full backend refund transition states (`FAILED`, `MANUAL_REVIEW_REQUIRED`, `COMPLETED`) in `AD-007`.

---

## 7. Audit Logging & Non-Repudiation (`SEC-12`)

### `SEC-12` — Incomplete Admin Governance Integration (`AD-018`) & Unaudited `SUPPORT` Override Paths
- **Status / Severity:** `CONFIRMED` | **Medium**
- **Affected Files:**
  - [admin.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/admin/admin.routes.ts#L1-L637)
  - [auth-api.ts](file:///d:/luggage-storage/luggage-storage/apps/web/src/services/auth-api.ts#L169-L185)
  - [app.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/app.ts#L230-L366)
- **Observed State:**
  - Backend properly emits audit events across auth, RBAC mutations, `AUTH_ACCESS_DENIED` rejections (`app.ts`), `DOCUMENT_ACCESSED` (`uploads.service.ts`), and Phase B admin actions (`admin.routes.ts`, `admin-phase-b.routes.ts`).
  - `auth-api.ts:169-185` implements `listAdminAuditEvents`, making `AD-017` partially operational.
  - **Gaps**: Zero client API wrappers exist in `auth-api.ts` for any of the 12 admin user/role/permission routes in `admin.routes.ts` (`AD-018`: inspect user, suspend, reinstate, deactivate, reactivate, force verify email, assign/revoke roles, list permissions). Consequently, user governance cannot be performed cleanly via the audited admin UI; meanwhile `SEC-04` leaves host location/pricing/capacity mutations unguarded by `requirePermission` (bypassing `AUTH_ACCESS_DENIED` telemetry on unauthorized attempts).

---

## 8. Data Integrity, Custody State & Demo-Data Contamination (`DI-01` to `DI-04`)

### `DI-01` — Web Check-Out Unconditionally Forces `DISPUTED_RELEASE` + Fake `700ms` Local Check-Out for `LS-*` Codes
- **Status / Severity:** `CONFIRMED` | **Critical** (Financial & Operational Corruption)
- **Affected Files:**
  - [HostDashboardPages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L2345), [L2387](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L2387), [L2405-L2413](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L2405-L2413)
  - [custody.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/custody/custody.service.ts#L747-L757)
- **Exact Corruption Mechanism:**
  1. In `HD-009` (`HostDashboardPages.tsx:2387`), the check-out submission sends hardcoded `exceptionNotes: "Released via Host Counter Web Desk"` even for completely normal checkouts.
  2. In `custody.service.ts:747-757`, `completeCollection` evaluates:
     ```ts
     const hasDisputeException = Boolean(input.exceptionNotes) || bookingRow.status === "DISPUTED";
     ```
     Because `input.exceptionNotes` is non-empty, the backend marks `custody_records.status = "DISPUTED_RELEASE"`, `bookings.status = "DISPUTED"`, `handoverCondition = "EXCEPTION_RECORDED"`, and `host_payables.status = "ON_HOLD"` instead of `RELEASED_TO_TRAVELLER` / `COMPLETED` / `ELIGIBLE` + posting the 85%/15% double-entry revenue split! **Every clean Web check-out corrupts custody, booking status, and host settlement ledgers.**
  3. Simultaneously, when the host enters a human-readable `LS-*` booking reference rather than a raw UUID, `isHostUuid` (`L2345`) falls into `L2405-L2413`, executing a fake `700ms` `setTimeout` and displaying a success toast with **zero database persistence** (`OQ-015` zero-possessory-lien audit trail is also lost).
- **Required Fix:** Omit `exceptionNotes` unless an actual exception checkbox/textarea is filled by the host; support resolving `LS-*` booking references to `bookingId` via `GET /api/v1/hosts/bookings` before dispatching `POST /api/v1/hosts/custody/check-in` or `check-out` (enforcing `verifiedBagCount` on check-in).

### `DI-02` — Authoritative Backend Attributes Replaced by Fabricated Marketplace Guarantees (`mapPublicLocationToItem`)
- **Status / Severity:** `CONFIRMED` | **Critical** (Consumer Misrepresentation / Legal Risk)
- **Affected Files:**
  - [PublicMarketplacePages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L95-L140)
  - [discovery.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/discovery/discovery.service.ts#L195-L315)
- **Root Cause & Impact:**
  - `discovery.service.ts` deliberately enforces `locationStatus === "ACTIVE"` and `businessStatus === "ACTIVE"`, rounds coordinates (`toFixed(2)`), sets `averageRating: null, reviewCount: 0`, and returns `operatingHoursSummary` + `baseRateMinor` in `getPublicLocationDetails`.
  - `mapPublicLocationToItem` (`PublicMarketplacePages.tsx:95-L140`) overrides/augments missing fields with hardcoded fabrications presented as host guarantees: `hasInsurance: true`, `insuranceLimitLkr: 250000`, synthetic `45/50` remaining/total capacity, `gracePeriodMinutes: 30`, and hardcoded hourly pricing tiers. Presenting uncontracted LKR 250,000 insurance guarantees and invented capacity exposes the platform to legal liability and failed counter handovers.
- **Required Fix:** Extend `GET /api/v1/locations/:locationId` (public details) to expose authoritative weekly operating hours, upcoming exceptions, bag-category multipliers (`DEFAULT_CATEGORY_MULTIPLIERS_BPS`), and current capacity/pricing unit (`CALENDAR_DAY` vs `24_HOUR_BLOCK`), and remove all fabricated insurance/rating/capacity defaults from `PublicMarketplacePages.tsx`. Only display platform protection/insurance language if legally backed and flagged by backend metadata.

### `DI-03` — `DEMO_LOCATIONS` / `DEMO_BOOKINGS` Initializers & Fallback Contamination Across All 3 Live Surfaces
- **Status / Severity:** `CONFIRMED` | **High**
- **Affected Files:**
  - Guard preserved: [demo-preview.ts](file:///d:/luggage-storage/luggage-storage/apps/web/src/config/demo-preview.ts) (`AUD-007`)
  - Traveller contamination: [PublicMarketplacePages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L158), [L578](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L578), [L886](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L886), [L3090](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L3090), [L3104](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L3104)
  - Host contamination: [HostDashboardPages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L166), [L990](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L990), [L1940](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L1940), [L2684](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L2684)
  - Admin contamination: [AdminDashboardPages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx#L458), [L736](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx#L736), [L842](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx#L842), [L1639](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx#L1639)
- **Root Cause & Impact:**
  - While `AUD-007` blocks `/preview/*` routes when `VITE_ENABLE_DEMO_PREVIEW !== "true"`, live operational components across all three portals still import synthetic fixtures directly in `useState(...)` defaults, `length === 0` empty fallbacks, and `.catch(...)` error fallbacks. A host with zero bookings or an admin encountering a `500` API error silently sees fake host names, fake LKR revenue figures, or fake disputes disguised as production data.
- **Required Fix:** Strictly isolate demo fixtures behind `?preview=demo` (`isDemoPreviewMode()`) via an explicit preview data adapter; forbid importing `DEMO_*` inside live production page modules and replace silent catch/empty fallbacks with honest loading skeletons, empty states, and retryable error banners.

### `DI-04` — Decorative QR Icons Replacing Cryptographic Custody Pass Tokens + Non-Persistent Host / Admin Actions
- **Status / Severity:** `CONFIRMED` | **High**
- **Affected Files:**
  - [PublicMarketplacePages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L2263), [L2379](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L2379), [L3483](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L3483)
- **Root Cause & Impact:**
  - Booking confirmation and pass views render static Lucide `<QrCode />` vector icons (`PW-010`, `PW-011`) rather than calling `POST /api/v1/bookings/:bookingId/custody-pass` to retrieve `{ qrToken, pin }` and rendering a scannable QR matrix representing the real `qrToken` payload. Hosts scanning the screen with mobile/camera devices cannot verify custody passes.
  - Related non-persistent paths include missing `DELETE` endpoints for host zones, exceptions, and media (`locations.routes.ts`), unpersisted admin support/dispute/review/promo/setting UI actions (`AdminDashboardPages.tsx`), and client-only staff/payout state in Host Portal.

---

## 9. Consolidated Security & Data Integrity Register

| ID | Category | Finding Summary | Confidence | Severity | Primary Remediation Target |
| --- | --- | --- | --- | --- | --- |
| `SEC-01` | Session / Client | Unconditional JSON `Content-Type` triggers `400` on empty `POST`; swallowed `logout`/`logoutAll` errors revive session on refresh | `CONFIRMED` | Critical | [api-client.ts](file:///d:/luggage-storage/luggage-storage/apps/web/src/lib/api-client.ts#L112-L115), [useAuthStore.ts](file:///d:/luggage-storage/luggage-storage/apps/web/src/store/useAuthStore.ts#L165-L188) |
| `SEC-02` | Session / Cookie | Cookie `path` divergence (`/` vs `/api/v1/auth`) + unguarded refresh/retry JSON parsing | `CONFIRMED` | High | [auth.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/auth/auth.routes.ts#L32-L40), [api-client.ts](file:///d:/luggage-storage/luggage-storage/apps/web/src/lib/api-client.ts#L86-L88) |
| `SEC-03` | Auth Claims | Stale JWT `roles[]` after `POST /hosts/businesses` & email verification causes `403` in `uploads` and `ledger` | `CONFIRMED` | High | [hosts.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/hosts/hosts.service.ts#L69-L84), [uploads.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/uploads/uploads.service.ts#L51) |
| `SEC-04` | RBAC / API | Zero `requirePermission` on location/capacity/pricing routes; `SUPPORT` can mutate any host's location; missing `Phase B` RBAC constants in contracts | `CONFIRMED` | Critical | [locations.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/locations/locations.routes.ts#L15-L332), [locations.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/locations/locations.service.ts#L216), [rbac/index.ts](file:///d:/luggage-storage/luggage-storage/packages/contracts/src/rbac/index.ts#L15-L75) |
| `SEC-05` | RBAC / UI | Nonexistent `ADMIN_FINANCIAL` check; Host nav prefix bypass lets `HOST_STAFF` into owner routes; Admin vs `SUPPORT` permission inversion; unprotected `/portal*` | `CONFIRMED` | High | [hosts.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/hosts/hosts.service.ts#L429), [HostDashboardPages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L188-L214), [AdminDashboardPages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx#L77-L94), [App.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/app/App.tsx#L105-L116) |
| `SEC-06` | Info Exposure | `ProfilePage` prints raw UUIDs & permission slugs; `NotFoundPage` prints `(PW-001)`/`(PW-002)` | `CONFIRMED` | Low | [ProfilePage.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/ProfilePage.tsx#L135-L213), [NotFoundPage.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/NotFoundPage.tsx#L20-L26) |
| `SEC-07` | Tenant / Financial | `getBookingDetail` leaks `commissionRateBps`, `platformCommissionMinor`, `hostPayableMinor` to `TRAVELLER` & `HOST_STAFF` (`BR-095`) | `CONFIRMED` | High | [bookings.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/bookings/bookings.service.ts#L481-L483) |
| `SEC-08` | Tenant / UI | `HD-001` shows Net Earnings to `HOST_STAFF` (`OQ-017`); `PENDING_VERIFICATION` vs `PENDING_REVIEW` state split | `CONFIRMED` | Medium | [HostDashboardPages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L632-L642), [hosts.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/hosts/hosts.service.ts#L379) |
| `SEC-09` | Onboarding | `RegisterPage` properly blocks role injection (good); `AppShell` shows `"Host Portal"` link to non-hosts and lacks mobile menu | `CONFIRMED` | Low | [RegisterPage.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/RegisterPage.tsx#L54), [AppShell.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/components/layout/AppShell.tsx#L40-L110) |
| `SEC-10` | Storage / R2 | Presigned upload confirm + R2 Web-origin `PUT` CORS unconfigured/unverified; missing media `DELETE`; dev stub PUT 404 | `CONFIRMED` / `UNVERIFIED` | High | [uploads.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/uploads/uploads.routes.ts#L1-L98), [uploads.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/uploads/uploads.service.ts#L51) |
| `SEC-11` | Payments | `PENDING_PAYMENT` shown as `"CONFIRMED"`; `100%` refund UI hardcode; `AD-007` omits `FAILED`/`MANUAL_REVIEW_REQUIRED`; PayHere gates `OQ-003`/`013`/`010` open | `CONFIRMED` / `BLOCKED` | High | [PublicMarketplacePages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L3037), [AdminDashboardPages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx#L900-L915) |
| `SEC-12` | Audit / Governance | Zero `/admin/users*` or `/admin/roles*` wrappers in `auth-api.ts` for `AD-018`; missing `requirePermission` suppresses `AUTH_ACCESS_DENIED` logs | `CONFIRMED` | Medium | [admin.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/admin/admin.routes.ts#L1-L637), [auth-api.ts](file:///d:/luggage-storage/luggage-storage/apps/web/src/services/auth-api.ts#L169-L185) |
| `DI-01` | Custody / Ledger | `HD-009` passes `exceptionNotes` forcing `DISPUTED_RELEASE` + `ON_HOLD` payable; `LS-*` runs fake `700ms` timer | `CONFIRMED` | Critical | [HostDashboardPages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L2345-L2413), [custody.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/custody/custody.service.ts#L747-L757) |
| `DI-02` | Integrity / Listing | `mapPublicLocationToItem` fabricates LKR 250k insurance, `45/50` capacity, 30-min grace, hourly tiers | `CONFIRMED` | Critical | [PublicMarketplacePages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L95-L140), [discovery.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/discovery/discovery.service.ts#L195-L315) |
| `DI-03` | Mock Leakage | Live Traveller, Host & Admin components initialize/fall back to `DEMO_LOCATIONS` / `DEMO_BOOKINGS` on empty/error | `CONFIRMED` | High | [PublicMarketplacePages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L158), [HostDashboardPages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L166), [AdminDashboardPages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx#L458) |
| `DI-04` | Custody / QR | Static `<QrCode />` SVG rendered instead of `issuedPass.qrToken`; missing `DELETE` endpoints for exceptions/zones/media | `CONFIRMED` | High | [PublicMarketplacePages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L2263), [locations.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/locations/locations.routes.ts#L1-L333) |

---

## 10. Verification Limitations & Runtime Test Plan

### Verification Scope Limitations
- **Static Source Audit Only**: Every finding classified `CONFIRMED` above was established by direct source inspection across `apps/web`, `apps/api`, `packages/contracts`, and existing stabilization documentation on `dev` (`b09fa68`).
- **No Live Execution in This Assignment**: Node/pnpm commands (`pnpm --filter @luggage-storage/web test`, typecheck, API/Playwright runtime execution) were not runnable inside the sandboxed read environment (`nvm-windows` binary directory sits outside sandbox access), and live infrastructure (Cloudflare R2 CORS, PayHere merchant checkout/webhook callbacks, MapTiler keys, Zoho SMTP DNS) requires environment-specific verification during execution.
- **Note on Existing Web Test Suite**: [vitest.config.ts](file:///d:/luggage-storage/luggage-storage/apps/web/vitest.config.ts#L1-L16) sets `environment: "node"`, meaning existing unit coverage cannot mount React DOM components without adding `jsdom` + `@testing-library/react`.

### Mandatory Runtime Verification Scenarios (`VRF-01` to `VRF-12`)

Every implementation PR closing the gaps above **must** execute and assert the following 12 end-to-end verification tests against a real PostgreSQL + PostGIS + Fastify API + Vite build (no synthetic API stubs for core flows):

| Test ID | Target Finding(s) | Scenario & Deterministic Pass Assertion (API / UI / DB) |
| --- | --- | --- |
| `VRF-01` | `SEC-01`, `SEC-02` | Click Sign Out -> assert `POST /api/v1/auth/logout` returns `200`, `auth_sessions.revoked_at IS NOT NULL`, `refresh_token` cookie cleared, and hard browser reload lands unauthenticated (`user === null`). Repeat for `logoutAll`, `revokeSession`, `submitLocationForReview`, and `disableLocation`. |
| `VRF-02` | `SEC-03` | Authenticate as `TRAVELLER`, submit `POST /api/v1/hosts/businesses` via `/become-a-host`, immediately initiate `POST /api/v1/uploads/presigned-url` without logging out -> assert client refreshes token cleanly and upload intent succeeds (`200/201`) with zero `403` errors. |
| `VRF-03` | `SEC-04` | Authenticate as `SUPPORT` and call `PATCH /api/v1/hosts/locations/:id`, `PUT .../capacity`, `PUT .../pricing`, `POST .../submit`, and `POST .../disable` on another host's location -> assert backend rejects with `403` and logs `AUTH_ACCESS_DENIED` while `GET` oversight still succeeds (`200`). |
| `VRF-04` | `SEC-05`, `SEC-08` | Authenticate as `HOST_STAFF` -> assert `/host/locations/${id}/edit`, `/host/locations/${id}/pricing`, `/host/finance`, and Net Earnings cards are hidden/redirected in Web UI, and direct API calls to owner finance/location mutations return `403`. |
| `VRF-05` | `SEC-05` | Authenticate as `SUPPORT` -> assert Admin sidebar allows read-only access to Hosts, Locations, Bookings, Payments, Refunds, and Users without 403 crashes, while Superadmin-only mutations (`Admin Cancel`, verification approve/reject, refund state mutations, role assign) are disabled/absent and enforced `403` server-side. |
| `VRF-06` | `SEC-07` | Request `GET /api/v1/bookings/:id` as booking `TRAVELLER` and as `HOST_STAFF` -> assert JSON omits `commissionRateBps`, `platformCommissionMinor`, and `hostPayableMinor`, while owning `HOST_OWNER` and `SUPERADMIN` retain authorized fields. |
| `VRF-07` | `SEC-10` | From Web origin, request presigned `HOST_VERIFICATION` & `LOCATION_IMAGE` URLs, perform browser binary `PUT` directly to R2 CORS endpoint without Bearer header, call `POST /uploads/confirm`, and retrieve `900s` download URL -> assert file persisted and `DOCUMENT_ACCESSED` logged. |
| `VRF-08` | `SEC-11` | Create booking (`PENDING_PAYMENT`), cancel PayHere / omit webhook -> assert `PW-011` and `/portal` render `"Awaiting Payment Confirmation"` (never `"Confirmed & Reserved"`). Deliver signed PayHere webhook -> assert booking transitions to confirmed (`PAID` / `CONFIRMED`) after live backend reload. |
| `VRF-09` | `SEC-11` | In `AD-007` Refund Review, transition an eligible refund to `MANUAL_REVIEW_REQUIRED` and `FAILED` as well as `COMPLETED` -> assert `POST /api/v1/admin/refunds/:id/transition` persists exact status and audit event. |
| `VRF-10` | `DI-01` | In `HD-009` Host Check-Out, enter a human-readable `LS-*` reference with zero exception notes -> assert resolution of `bookingId`, `POST /api/v1/hosts/custody/check-out` omits `exceptionNotes`, `custody_records.status = "RELEASED_TO_TRAVELLER"`, `bookings.status = "COMPLETED"`, `host_payables.status = "ELIGIBLE"`, and double-entry 85%/15% ledger postings exist. Re-test with an explicit exception note -> verify `DISPUTED_RELEASE` + `ON_HOLD` works intentionally. |
| `VRF-11` | `DI-02`, `DI-03` | Search with `VITE_ENABLE_DEMO_PREVIEW=false` against an empty city or stopped API -> assert zero `DEMO_LOCATIONS` / `DEMO_BOOKINGS` entries appear, zero `"LKR 250,000"` insurance badges or `45/50` stock badges render, and honest empty/retry banners appear instead. |
| `VRF-12` | `DI-04` | Open confirmed paid booking in `PW-010` / `PW-011` -> assert `POST /api/v1/bookings/:id/custody-pass` populates `qrToken` + `pin`, the rendered QR code decodes deterministically to `qrToken`, and scanning/submitting it in `HD-009` check-in (`verifiedBagCount` verified) transitions custody in PostgreSQL. |

