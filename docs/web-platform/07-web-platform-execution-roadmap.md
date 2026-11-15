# Web Platform Execution Roadmap

> **Document Classification:** Principal Technical Program Roadmap  
> **Repository Snapshot:** `dev` branch, commit `b09fa68` (clean working tree)  
> **Companion Blueprint:** [06-web-platform-implementation-blueprint.md](file:///d:/luggage-storage/luggage-storage/docs/web-platform/06-web-platform-implementation-blueprint.md)  
> **Planning Principle:** Execution is organized into **6 dependency-ordered Implementation Initiatives**. Sequence is governed by technical dependencies and security/data-integrity risk—without speculative calendar or hour estimates.

---

## Parallel vs. Sequential Execution Matrix

| Execution Wave | Active Initiative(s) | Concurrency Mode | Prerequisites Before Start | Downstream Unblocked |
| --- | --- | --- | --- | --- |
| **Wave 1** | **Initiative 1** (Foundation Hardening, Auth/RBAC Repair & Mock Isolation) | **Sequential Gate (Must Merge First)** | Baseline `dev` commit `b09fa68` | Unblocks Initiatives 2, 3, and RBAC groundwork for 5 |
| **Wave 2** | **Initiative 2** (Traveller Discovery & Checkout-to-QR Pass) + **Initiative 3** (Host Onboarding, KYC R2, Location Config & Staff RBAC) | **Parallel Execution** (Disjoint feature slices) | Initiative 1 merged | Real active locations + paid bookings feed Initiative 4 & moderation in Initiative 5 |
| **Wave 3** | **Initiative 4** (Host Counter Check-In/Out Integrity, Bookings & Owner Finance) | **Sequential after Waves 1–2** (Can start custody fix immediately once Init 1–3 contracts settle) | Initiative 1 merged; coordinated with Initiative 3 host context (`useHostContextStore`) | Real check-out / dispute states & ledger payables feed Initiative 5 |
| **Wave 4** | **Initiative 5** (Superadmin & Support Oversight, Moderation Drawers, Refund Recovery & User RBAC) | **Sequential (UI RBAC / `AD-018` can overlap Wave 2; Moderation/Refunds after Wave 2–3)** | Initiative 1 merged (`SYSTEM_PERMISSIONS` + `SUPPORT` guard); Initiatives 3–4 for live KYC/location/refund E2E | Unblocks full operational launch readiness & Initiative 6 |
| **Wave 5** | **Initiative 6** (MVP Extensions: Payout Batches, Dispute Adjudication, Support Tickets, Feature Gating & E2E QA) | **Sequential Finalization** | Initiatives 1–5 merged (external `OQ-*` gates govern live production activation) | Full Web Platform Launch Readiness (`AC-01`–`AC-20`, `VRF-01`–`VRF-12`) |

---

## Initiative 1: Platform Foundation Hardening, Auth/RBAC Repair & Mock-Data Isolation

### 1. Objective
Eliminate root transport, session-revocation, RBAC boundary, and synthetic data leakage defects across [apps/web](file:///d:/luggage-storage/luggage-storage/apps/web), [apps/api](file:///d:/luggage-storage/luggage-storage/apps/api), and [packages/contracts](file:///d:/luggage-storage/luggage-storage/packages/contracts), while establishing shared TanStack Query, R2 upload, permission gating, and DOM testing scaffolding.

### 2. Business Value
Closes critical security vulnerabilities (zombie sessions after logout, `SUPPORT` privilege escalation over host locations), enforces authoritative data hygiene across all portals, and creates clean modular extension points so Traveller, Host, and Admin initiatives can execute concurrently without merge conflicts.

### 3. Scope
- **Included:** `api-client.ts` empty-body JSON header and refresh/retry parsing fixes; `useAuthStore` guaranteed server logout; `auth.routes.ts` cookie path alignment; `locations.routes.ts` / `capacity.routes.ts` / `pricing.routes.ts` `requirePermission` + `assertLocationWriteAccess` rejecting `SUPPORT` writes; `SYSTEM_PERMISSIONS` Phase B sync; `r2-uploader.ts` + dev mock `PUT` route; `/api/v1/identity/profile` endpoints + editable `/profile`; `VerifyEmailPage` `refreshUser()`; `AppShell` responsive drawer & role-accurate portal links; `App.tsx` `ProtectedRoute` fixes; `NotFoundPage` cleanup; isolated `features/preview/` adapter (`AUD-007` preserved); `query-keys.ts`, `QueryStateView`, `PermissionGate`, `formatters.ts`, `csv-export.ts`; installing `qrcode`, `jsdom`, `@testing-library/react`.
- **Excluded:** Individual Traveller/Host/Admin feature page rewrites (handled in Initiatives 2–6).
- **Gaps & Findings Resolved:** `GAP-001`, `GAP-003` (scaffolding), `GAP-004`, `GAP-005`, `GAP-006`, `SEC-01`, `SEC-02`, `SEC-04`, `SEC-05` (nav/backend guard core), `SEC-06`, `SEC-09`.

### 4. Affected Surfaces
- **Cross-Cutting Web:** [api-client.ts](file:///d:/luggage-storage/luggage-storage/apps/web/src/lib/api-client.ts), [useAuthStore.ts](file:///d:/luggage-storage/luggage-storage/apps/web/src/store/useAuthStore.ts), [AppShell.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/components/layout/AppShell.tsx), [App.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/app/App.tsx), [ProfilePage.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/ProfilePage.tsx), [VerifyEmailPage.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/VerifyEmailPage.tsx), [NotFoundPage.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/NotFoundPage.tsx).
- **Contracts & API:** [rbac/index.ts](file:///d:/luggage-storage/luggage-storage/packages/contracts/src/rbac/index.ts), [identity/index.ts](file:///d:/luggage-storage/luggage-storage/packages/contracts/src/identity/index.ts), [auth.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/auth/auth.routes.ts), [locations.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/locations/locations.routes.ts), [locations.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/locations/locations.service.ts), [capacity.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/capacity/capacity.routes.ts), [pricing.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/pricing/pricing.routes.ts), [uploads.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/uploads/uploads.routes.ts).

### 5. Required Backend Integration
- Fix `getCookieConfig` in `auth.routes.ts:32-40` so logout clears cookies cleanly across dual mount paths.
- Attach `app.requirePermission(...)` to all endpoints in `locations.routes.ts`, `capacity.routes.ts`, and `pricing.routes.ts`, splitting read authorization from `assertLocationWriteAccess` (owner or `SUPERADMIN` only—rejecting `SUPPORT` with `403` + `AUTH_ACCESS_DENIED`).
- Register `GET /api/v1/identity/profile` & `PATCH /api/v1/identity/profile` backed by existing `packages/contracts/src/identity/index.ts:52-106` schemas and `users` / `traveller_profiles` tables.
- Add dev-only `PUT` route matching local stub URLs in `uploads.routes.ts` when `InMemoryStorageAdapter` is active.
- Synchronize all Phase B + `support.ticket.*` permissions into `SYSTEM_PERMISSIONS` (`packages/contracts/src/rbac/index.ts:15-75`).

### 6. Frontend Changes
- Conditionalize `"Content-Type": "application/json"` in `api-client.ts:112-115` strictly on `options?.body !== undefined && !(options.body instanceof FormData) && !(options.body instanceof Blob)`; harden `L86-88` (`onAuthFailure()` on malformed refresh) & `L145` retry JSON parse; target `/api/v1/*`.
- Replace empty `catch {}` blocks in `useAuthStore.ts:165-188` with verified session revocation + explicit error feedback.
- Build shared `r2-uploader.ts`, `query-keys.ts`, `QueryStateView`, `PermissionGate`, `formatters.ts`, `csv-export.ts`, and `features/preview/` adapter; install `qrcode`, `jsdom`, `@testing-library/react`.
- Add accessible mobile drawer to `AppShell.tsx:40`, fix `"Become a Host"` vs `"Host Portal"` link (`L90-95`), route `SUPPORT` `"Admin"` link (`L102-110`) to `/admin/bookings`.
- Wrap `/booking/confirm`, `/checkout/payhere/*`, and `/portal*` inside `ProtectedRoute`; implement editable `ProfilePage` (removing UUID/permission dumps); call `refreshUser()` on `VerifyEmailPage`; remove `(PW-001)`/`(PW-002)` from `NotFoundPage`.

### 7. Dependencies
- None (foundational initiative).

### 8. Acceptance Criteria
- Blueprint [AC-01](file:///d:/luggage-storage/luggage-storage/docs/web-platform/06-web-platform-implementation-blueprint.md#L246) (Logout/Revoke cookie clearing & non-resurrection) & [AC-02](file:///d:/luggage-storage/luggage-storage/docs/web-platform/06-web-platform-implementation-blueprint.md#L247) (Editable profile & post-verify refresh).
- Review [VRF-01](file:///d:/luggage-storage/luggage-storage/docs/web-platform/05-web-security-and-data-integrity-review.md#L289) & [VRF-03](file:///d:/luggage-storage/luggage-storage/docs/web-platform/05-web-security-and-data-integrity-review.md#L291) (`SUPPORT` write rejection returning `403` + `AUTH_ACCESS_DENIED`).
- CI static check enforcing zero imports of `src/data/mock-marketplace` outside `features/preview/`.

### 9. Testing Strategy
- API integration tests covering bodyless `POST`/`DELETE` routes, `SUPPORT` write rejections across location/capacity/pricing routes, and `GET/PATCH /api/v1/identity/profile`.
- Vitest (`jsdom` + `@testing-library/react`) tests verifying `api-client.ts` omits `Content-Type` on empty body, `useAuthStore.logout` failure handling, `AppShell` responsive nav + role-scoped CTAs, and `ProtectedRoute` gating `/portal*`.

### 10. Risks
- Adding `requirePermission` to host routes may break unpermissioned test helpers if test tokens omit RBAC claims; mitigate by verifying existing API test helpers use seeded RBAC permissions matching `SYSTEM_PERMISSIONS`.

### 11. Completion Definition
- `api-client.ts` bodyless `400` defect is eliminated; logout passes end-to-end against PostgreSQL + cookie jar (`AC-01`); `SUPPORT` cannot mutate host entities (`VRF-03`); Phase B permissions live in `@luggage-storage/contracts`; `jsdom` test harness runs cleanly in CI.

---

## Initiative 2: Public Traveller Discovery, Detail Privacy & Checkout-to-QR Pass Completion

### 1. Objective
Deliver an authoritative, zero-fabrication Public Traveller Web experience (`PW-001`–`PW-011`) from destination/availability discovery through PayHere payment return, scannable QR custody passes, tiered refund accuracy, and exception reporting.

### 2. Business Value
Enables real travellers to discover verified Sri Lankan storage venues, view truthful hours/pricing/capacity, complete protected bookings via PayHere, present counter-scannable QR passes, and manage cancellations/exceptions without consumer-misrepresentation risk.

### 3. Scope
- **Included:** `PW-001` Landing, `PW-002` Search & Availability, `PW-003` Location Details (plus API detail enrichment), `PW-004` Booking Quote & PayHere Handoff, `PW-005` Return/Reconciliation, `PW-011` Bookings Portal (`Upcoming`, `Past`, `Refunds`, Receipt modal, Exception reporting), shared `<CustodyQrPassCard />`, honest `/contact` channel notice until Initiative 6 support backend lands, `bookings.service.ts` commission redaction (`BR-095`), extraction of `PublicMarketplacePages.tsx` into `features/traveller/`.
- **Excluded:** Post-MVP public reviews (`averageRating`/`reviewCount` remain empty/null) and persisted `/support/tickets` backend (Initiative 6).
- **Gaps & Findings Resolved:** `GAP-007`–`GAP-016`, `SEC-07`, `SEC-11` (Traveller), `DI-02`, `DI-03` (Traveller), `DI-04` (QR), `WF-TRV-01`–`WF-TRV-13`.

### 4. Affected Surfaces
- **Web:** [PublicMarketplacePages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx) decomposed into `features/traveller/*` + shared `CustodyQrPassCard.tsx`.
- **API:** [discovery.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/discovery/discovery.service.ts), [discovery.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/discovery/discovery.routes.ts), [bookings.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/bookings/bookings.service.ts).

### 5. Required Backend Integration
- Extend `getPublicLocationDetails` (`discovery.service.ts:218-313`) + contract DTO to expose `openingHours[]`, `upcomingExceptions[]`, `pricingPolicy` (bag tiers & `CALENDAR_DAY` / `24_HOUR_BLOCK` unit), `capacitySummary`, `images[]`, and `acceptsOversized`, strictly preserving `OQ-012` rounded coordinates (`toFixed(2)`) and omitting pre-payment exact street address.
- Enforce role-based financial redaction in `bookings.service.ts:481-483` (`getBookingDetail`), omitting `commissionRateBps`, `platformCommissionMinor`, and `hostPayableMinor` for `TRAVELLER` and `HOST_STAFF` callers (`BR-095`).

### 6. Frontend Changes
- Wire `PW-001` to `useDiscoveryLocations({ limit: 3 })` with dynamic current/tomorrow date defaults and live UUID links (`L145-335`).
- Rewrite `PW-002` filters/sorting (`only24Hours`, `onlyClimateControl`, `acceptsOversized`, `searchTerm`, `sortBy`), remove `L574-576` short-circuit bug, integrate `GET /api/v1/availability/search` (`L389-407`), integrate MapLibre gated on `VITE_MAPTILER_KEY` (`OQ-018`) replacing CSS box grid (`L785-852`).
- Delete `mapPublicLocationToItem` (`L95-140`) removing fake `LKR 250,000` insurance, `45/50` stock, 30m grace period, and hourly tiers; render authoritative detail or explicit 404 on `PW-003`.
- Implement `PW-004` dynamic date defaults, `300ms` debounced quote hook, `sessionStorage` draft persistence + `navigate("/login", { state: { from: location } })`, and PayHere `submitPayhereCheckoutForm`.
- Fix `PW-005` missing-UUID `#LS-2026-8841` fallback (`L2311-2433`) and wire checkout status polling + `"Regenerate Pass"`.
- Fix `PW-011`: delete `DEMO_BOOKINGS` defaults (`L3090`, `L3104`); map `PENDING_PAYMENT` to `"Awaiting Payment"` with hold countdown + retry (deleting `L3037` `"CONFIRMED"` lie); build `<CustodyQrPassCard />` with `qrcode` encoding `issuedPass.qrToken`; render `refundSummary.amountMinor` & `REFUND_STATUSES` in Refunds (`L3426`); separate `EXPIRED`/`REJECTED` into Past; replace `"Download VAT Invoice"` (`L3399`) with Booking Receipt view (`OQ-010`); wire `"Report Problem"` modal (`reportBookingException`).
- Replace fake `/contact` `#TKT-COL-2026-441` (`L2795-2822`) with honest direct email/phone notice until Initiative 6 `/support/tickets` lands.

### 7. Dependencies
- **Blocked On:** Initiative 1 merged.
- **External Gates:** `OQ-018` MapTiler key for interactive vector map tiles; `OQ-003` PayHere production settlement; `OQ-010` VAT/tax invoicing format.

### 8. Acceptance Criteria
- Blueprint [AC-03](file:///d:/luggage-storage/luggage-storage/docs/web-platform/06-web-platform-implementation-blueprint.md#L248) through [AC-09](file:///d:/luggage-storage/luggage-storage/docs/web-platform/06-web-platform-implementation-blueprint.md#L254).
- Review [VRF-06](file:///d:/luggage-storage/luggage-storage/docs/web-platform/05-web-security-and-data-integrity-review.md#L294), [VRF-08](file:///d:/luggage-storage/luggage-storage/docs/web-platform/05-web-security-and-data-integrity-review.md#L296), [VRF-11](file:///d:/luggage-storage/luggage-storage/docs/web-platform/05-web-security-and-data-integrity-review.md#L299), [VRF-12](file:///d:/luggage-storage/luggage-storage/docs/web-platform/05-web-security-and-data-integrity-review.md#L300).

### 9. Testing Strategy
- API tests asserting enriched `getPublicLocationDetails` payload preserves `OQ-012` privacy and `getBookingDetail` omits commission fields for `TRAVELLER` & `HOST_STAFF`.
- Vitest DOM tests asserting `PW-002` filter/sort behavior with `[]` empty result, `PW-004` login redirect state retention, `PW-011` `PENDING_PAYMENT` rendering, `refundSummary.amountMinor` display, and `CustodyQrPassCard` encoding `qrToken` deterministically.

### 10. Risks
- If MapTiler commercial key (`OQ-018`) is unavailable in staging/dev, fallback must render an honest non-interactive coordinate summary without reviving fake CSS map buttons.

### 11. Completion Definition
- Travellers complete search, authoritative listing inspection, debounced quote, PayHere sandbox checkout, honest pending/confirmed tracking, scannable QR pass generation, accurate tiered cancellation, and exception reporting with zero fabricated marketplace attributes or `DEMO_*` records.

---

## Initiative 3: Host Onboarding, KYC R2 Uploads, Location Sub-Resources & Staff RBAC

### 1. Objective
Unblock self-service host onboarding (`TRAVELLER` -> `HOST_OWNER`), build end-to-end R2 KYC verification uploads, replace simulated host setup tabs (`HD-002`–`HD-006`) with persisted API forms, enforce `HOST_STAFF` privilege boundaries, and deliver staff management (`HD-013`).

### 2. Business Value
Enables real storage partners to sign up, submit KYC documents, draft and configure storage venues (photos, hours, exceptions, zones, capacity, pricing), submit clean readiness-verified listings for admin approval, and manage counter staff securely.

### 3. Scope
- **Included:** `/host/onboarding` + automatic `/auth/refresh` + `refreshUser()`; `uploads.service.ts:51` & `ledger.service.ts:413` stale-JWT decoupling; `useHostContextStore` (eliminating `loc-cmb-fort-01` & `"Sample Host Partner Profile"`); `locations.service.ts:173-221` `HOST_STAFF` read scope & `ADMIN_LOCATION_READ`; missing sub-resource routes (`PATCH/DELETE` zone, `DELETE` exception/media); `/hosts/businesses/:id/staff` backend & `HD-013` UI; `HostDashboardLayout` nav prefix bypass fix (`L188-214`) & `HOST_STAFF` financial hiding (`L632-642`, `OQ-017`); `HD-014` business edit + R2 KYC upload + verification workflow; `HD-002:977` premature `/submit` decoupling + Readiness Checklist; `HD-003`–`HD-006` full wiring.
- **Excluded:** Host operational counter check-in/out (`HD-009`), bookings desk (`HD-007`/`008`), finance (`HD-010`), payouts (`HD-011`) -> Initiative 4.
- **Gaps & Findings Resolved:** `GAP-002`, `GAP-017`–`GAP-021`, `GAP-027` (`HD-013`), `SEC-03`, `SEC-08`, `SEC-10`, `WF-HST-01`–`WF-HST-09`, `WF-HST-16`.

### 4. Affected Surfaces
- **Web:** Layout, Onboarding, Settings/KYC, Locations, Schedule, Capacity, Pricing, and Staff slices extracted from [HostDashboardPages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx).
- **API:** [hosts.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/hosts/hosts.routes.ts), [hosts.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/hosts/hosts.service.ts), [locations.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/locations/locations.routes.ts), [locations.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/locations/locations.service.ts), [uploads.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/uploads/uploads.service.ts), [ledger.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/finance/ledger.service.ts).

### 5. Required Backend Integration
- Fix `uploads.service.ts:51` and `ledger.service.ts:413` to check DB `host_businesses.ownerUserId` / persisted `user_roles` cleanly alongside `HOST_OWNER` so freshly created hosts never hit `403`.
- Update `locations.service.ts:173-221` (`getOwnedLocations` & `getLocationById`) so assigned `HOST_STAFF` (via `host_staff_memberships`) and `ADMIN_LOCATION_READ` reviewers can read assigned/moderated locations safely.
- Add `PATCH/DELETE .../zones/:zoneId`, `DELETE .../exceptions/:exceptionId`, and `DELETE .../media/:mediaId` to `locations.routes.ts` / `locations.service.ts`.
- Implement `GET/POST/PATCH/DELETE /api/v1/hosts/businesses/:businessId/staff` over existing `host_staff_memberships` table ([hosts.ts:131-154](file:///d:/luggage-storage/luggage-storage/apps/api/src/infrastructure/database/schema/hosts.ts#L131-L154)).

### 6. Frontend Changes
- Create `/host/onboarding` accessible to verified `TRAVELLER`s; trigger `/auth/refresh` + `refreshUser()` immediately on `createBusiness` success.
- Implement `useHostContextStore` hydrated by `GET /hosts/businesses` + `GET /hosts/locations`, replacing `loc-cmb-fort-01`, `"Sample Host Partner Profile"`, and role preview widget (`L122-332`).
- Fix `operationalNavItems` matching in `HostDashboardLayout` (`L188-214`) to exact/longest-prefix + `<PermissionGate>` and hide Net Earnings KPI (`L632-642`) from `HOST_STAFF`.
- Build `HD-014` business edit (`getBusinessById`, `updateBusiness`), `r2-uploader.ts` document upload (`HOST_VERIFICATION`), verification status (`PENDING_VERIFICATION` / `PENDING_REVIEW` / `MORE_INFO_REQUIRED` / `ACTIVE` / `REJECTED`), and verification submit (removing `"Ceylon Transit Hospitality"` fallback `L3596-3659`).
- Fix `HD-002:977` so `createLocation` creates `DRAFT` and navigates to Location Checklist; wire `HD-003` (`updateLocation`, `disableLocation`, R2 gallery `LOCATION_IMAGE` + `addLocationMedia` + delete), `HD-004` (`setOpeningHours`, `addOpeningHoursException` + delete), `HD-005` (`getCapacityPools`, `createCapacityPool`, `updateCapacityPool`, `createStorageZone` + edit/delete), `HD-006` (`getPricingPolicy`, `configurePricingPolicy` using minor units & `PRICING_UNITS`), and `HD-013` staff assignment CRUD.

### 7. Dependencies
- **Blocked On:** Initiative 1 merged (fixed bodyless `POST`, `requirePermission`, `r2-uploader.ts` + dev mock `PUT`, synced RBAC permissions).
- **External Gates:** Cloudflare R2 bucket Web `PUT` CORS (`SEC-10`) for staging/production; `OQ-002` KYC document legal sign-off; `OQ-017` host staff scope confirmation.

### 8. Acceptance Criteria
- Blueprint [AC-10](file:///d:/luggage-storage/luggage-storage/docs/web-platform/06-web-platform-implementation-blueprint.md#L255) through [AC-14](file:///d:/luggage-storage/luggage-storage/docs/web-platform/06-web-platform-implementation-blueprint.md#L259).
- Review [VRF-02](file:///d:/luggage-storage/luggage-storage/docs/web-platform/05-web-security-and-data-integrity-review.md#L290), [VRF-04](file:///d:/luggage-storage/luggage-storage/docs/web-platform/05-web-security-and-data-integrity-review.md#L292), [VRF-07](file:///d:/luggage-storage/luggage-storage/docs/web-platform/05-web-security-and-data-integrity-review.md#L295).

### 9. Testing Strategy
- API integration tests covering newly onboarded owner uploading verification intent without `403`, `HOST_STAFF` read vs write rejection, location sub-resource `PATCH`/`DELETE`, and `/hosts/businesses/:id/staff` lifecycle.
- Vitest DOM tests verifying `HD-014` R2 upload state machine, `HD-002` decoupled draft flow, `HD-003`–`HD-006` form submissions persisting cleanly, and `HostDashboardLayout` blocking `HOST_STAFF` from `/host/locations/:id/pricing` & Net Earnings cards.

### 10. Risks
- Real browser R2 `PUT` will fail preflight CORS in non-mock environments unless bucket CORS rules allow the Web origin (`PUT`, `Content-Type`). Mitigate via dev local `PUT` handler + staging R2 CORS verification check before launch.

### 11. Completion Definition
- A brand-new `TRAVELLER` can onboard into a `HOST_OWNER`, upload KYC docs, submit business verification, draft and configure a full venue (`HD-002`–`HD-006`), pass the readiness check to submit for moderation, and invite scoped `HOST_STAFF` (`HD-013`) with zero `DEMO_*` leakage.

---

## Initiative 4: Host Counter Check-In/Out Integrity, Bookings Desk & Owner Finance

### 1. Objective
Eliminate the critical custody/ledger corruption bug on `HD-009` check-out (`DI-01`, `GAP-022`), eliminate fake `setTimeout` check-in/out simulation (`GAP-023`), connect Host Overview (`HD-001`), Bookings (`HD-007`/`008`), Finance (`HD-010`), and Payout Details (`HD-011`), and cleanly gate unsupported Reviews (`HD-012`).

### 2. Business Value
Protects platform financial solvency and host trust: every clean customer bag release records `RELEASED_TO_TRAVELLER`, moves booking to `COMPLETED`, posts the 85%/15% double-entry ledger split, marks `host_payables` `ELIGIBLE`, and gives owners authentic revenue CSV exports and payout account visibility.

### 3. Scope
- **Included:** `HD-009` `exceptionNotes` removal + explicit discrepancy toggle; `LS-*` reference resolution via `/hosts/bookings` + `?ref=&mode=` deep links + deletion of `700ms` `setTimeout` (`L2405-2413`) + zone/tag/seal/`verifiedBagCount` UI + optional `CUSTODY_EVIDENCE` upload; `HD-001` live bookings & owner-scoped KPIs; `HD-007`/`008` exact 11-status mapping (`L70-84`), `getHostBookingDetail`, reject/cancel reason modals, real `custody_events` timeline (removing `L2216-2277`), and host `reportBookingException`; `HD-010` real totals + RFC-4180 CSV download (`L2728`); `HD-011` `getBusinessPayoutDetails` + edit + `hosts.service.ts:429` `ADMIN_FINANCIAL` fix; `HD-012` fake review removal.
- **Excluded:** Platform payout batch disbursement creation (`AD-008`/`009` in Initiative 6).
- **Gaps & Findings Resolved:** `GAP-022`–`GAP-026`, `GAP-027` (`HD-012`), `DI-01`, `DI-03` (Host operational), `WF-HST-05`, `WF-HST-10`–`WF-HST-15`.

### 4. Affected Surfaces
- **Web:** Overview, Bookings, Operations Desk (`HD-009`), Finance, Payouts, Reviews slices extracted from [HostDashboardPages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx) + [marketplace-api.ts](file:///d:/luggage-storage/luggage-storage/apps/web/src/services/marketplace-api.ts).
- **API:** [hosts.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/hosts/hosts.service.ts#L429), [uploads.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/uploads/uploads.service.ts) (`CUSTODY_EVIDENCE` purpose if enabled in check-in/out UI).

### 5. Required Backend Integration
- Replace dead `"ADMIN_FINANCIAL"` role check in `hosts.service.ts:429` (`getPayoutDetails`) with valid permission check (`admin.financial.manage` / `SUPERADMIN` or owning host).
- Add `"CUSTODY_EVIDENCE"` upload purpose to `uploads.service.ts` + contracts if bag photo capture is enabled alongside check-in/out.
- Support optional `?businessId=` / `?locationId=` & `?search=` query alignment on `GET /api/v1/hosts/bookings` and `GET /api/v1/hosts/finance/summary`.

### 6. Frontend Changes
- **CRITICAL (`HD-009:2387`):** Remove hardcoded `exceptionNotes: "Released via Host Counter Web Desk"` on `completeCollection`; include an explicit unchecked `"Report Handover Exception / Damage"` checkbox + required notes input used strictly when counter staff intentionally flag a dispute.
- **CRITICAL (`HD-009:2345, 2405-2413`):** Delete `isHostUuid` `700ms` `setTimeout` fallback; resolve `LS-*` references cleanly against `/hosts/bookings`, consume `?ref=&mode=` search params, render live `storage_zones` dropdown, and enforce `verifiedBagCount` & individual bag tags/categories. Keep clear `OQ-015` Zero Possessory Lien notice banner on overdue collections.
- Wire `HD-001` to live host queries (`useHostBookings`, plus `useHostFinanceSummary` gated by `hosts.finance.read`).
- Add `getHostBookingDetail` & `getBusinessPayoutDetails` to `marketplace-api.ts`; fix `mapHostBookingToRecord` (`L70-84`), add reject/cancel reason modals (`L1994-2003`), delete fake 4-step timeline (`L2216-2277`), wire host `reportBookingException`.
- Remove synthetic `LKR 217,058 / 184,500` & `DEMO_BOOKINGS` fallbacks from `HD-010` (`L2684`, `L2830`) and implement `csv-export.ts` download (`L2728`).
- Wire `HD-011` bank details view/update (`PATCH /hosts/businesses/:id`); gate settlement batch statement tab cleanly pending Initiative 6 (`payout_batches`); replace `HD-012` simulated reviews (`L3054-3192`) with feature-gated status banner.

### 7. Dependencies
- **Blocked On:** Initiative 1 merged + Initiative 3 `useHostContextStore` & location zone data (and Initiative 2 paid bookings for live counter check-in E2E).

### 8. Acceptance Criteria
- Blueprint [AC-15](file:///d:/luggage-storage/luggage-storage/docs/web-platform/06-web-platform-implementation-blueprint.md#L260) (`LS-*` check-in) & [AC-16](file:///d:/luggage-storage/luggage-storage/docs/web-platform/06-web-platform-implementation-blueprint.md#L261) (Clean check-out -> `COMPLETED` + `ELIGIBLE` + 85%/15% ledger split; discrepancy toggle -> `DISPUTED_RELEASE` + `ON_HOLD`).
- Review [VRF-10](file:///d:/luggage-storage/luggage-storage/docs/web-platform/05-web-security-and-data-integrity-review.md#L298).

### 9. Testing Strategy
- Integration tests asserting normal Web `completeCollection` payload omits `exceptionNotes` and produces `custody_records.status = "RELEASED_TO_TRAVELLER"`, `bookings.status = "COMPLETED"`, `host_payables.status = "ELIGIBLE"`, and balanced 85%/15% `journal_entries`, whereas flagging discrepancy triggers `DISPUTED_RELEASE` + `ON_HOLD`.
- Vitest DOM tests verifying `HD-009` resolves `LS-*` queries, rejects zero-action `setTimeout` stubs, renders empty state on `HD-010` (`LKR 0.00`), and hides finance/reject CTAs per RBAC.

### 10. Risks
- If existing hosts still have stale `DISPUTED` bookings created before `HD-009` fix, operations need Initiative 5/6 `AD-013` dispute resolution to settle legitimate backlog cleanly.

### 11. Completion Definition
- Host staff check-in/out flows work end-to-end using QR tokens, 6-digit PINs, or `LS-*` references; clean check-outs settle revenue cleanly into double-entry ledgers and `ELIGIBLE` payables; host finance displays zero synthetic totals and exports authentic CSV files.

---

## Initiative 5: Superadmin & Support Oversight, Moderation Drawers, Refund Recovery & User RBAC

### 1. Objective
Turn the Admin & Support dashboard ([AdminDashboardPages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx)) into an accurate, permission-aligned operational control center with full KYC/location inspection drawers, non-linear refund recovery, live metrics/host directory, full audit filtering, and all 12 `AD-018` user/RBAC governance capabilities.

### 2. Business Value
Equips `SUPERADMIN` and `SUPPORT` staff to inspect real KYC/venue evidence before moderating supply, resolve customer booking/payment/refund escalations safely without accidental `403` traps, enforce RBAC & account suspensions with full auditability, and view real platform metrics.

### 3. Scope
- **Included:** `AD-001` Metrics (`GET /admin/metrics/summary`), `AD-002` KYC Inspection Drawer (`getVerificationDetails` + `getDocumentDownloadUrl` R2 signed viewer + moderator notes), `AD-003` Host Directory (`GET/POST /admin/hosts*`), `AD-004` Location Inspection Drawer (`getLocationById` photos/address/hours/capacity/pricing + notes), `AD-005`/`AD-006` search/filters/pagination/detail & custody drawers, `AD-007` full `REFUND_STATUSES` transition picker (`FAILED`, `MANUAL_REVIEW_REQUIRED`, `SUCCEEDED`), `AD-010` ledger filters & trial balance badge, `AD-017` pagination + full `SecurityEventType` filters + `getAuditEventDetail`, `AD-018` all 12 `/admin/users*` + `/admin/roles*` wrappers & governance console, `SUPPORT` permission-aligned nav & `<PermissionGate>` fixes (`AD-005:727`), total removal of `DEMO_*`/`#RFD-8799`/`JRN-901..903`/sample audit fallbacks.
- **Excluded:** `payout_batches`, `resolve-dispute` endpoint, `support_tickets` CRUD, and post-MVP feature-gating cleanup -> Initiative 6.
- **Gaps & Findings Resolved:** `GAP-028`–`GAP-034`, `SEC-05` (`SUPPORT`/Admin drift), `SEC-11` (`AD-007`), `SEC-12`, `DI-03` (Admin), `WF-ADM-01`–`WF-ADM-10`, `WF-ADM-15`.

### 4. Affected Surfaces
- **Web:** `AdminDashboardLayout` & modularized `features/admin/*` replacing [AdminDashboardPages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx), plus [auth-api.ts](file:///d:/luggage-storage/luggage-storage/apps/web/src/services/auth-api.ts) & [marketplace-api.ts](file:///d:/luggage-storage/luggage-storage/apps/web/src/services/marketplace-api.ts).
- **API:** [host-verification.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/host-verification/host-verification.routes.ts), [location-moderation.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/locations/location-moderation.routes.ts), new admin metrics & host directory endpoints in `apps/api/src/modules/admin/`.

### 5. Required Backend Integration
- Add `GET /api/v1/admin/metrics/summary` returning role-scoped live counts/totals from `users`, `host_businesses`, `storage_locations`, `bookings`, `payment_transactions`, and `refund_records`.
- Add `GET /api/v1/admin/hosts`, `GET /api/v1/admin/hosts/:businessId`, `POST /api/v1/admin/hosts/:businessId/suspend` | `/reinstate` guarded by `admin.host.read` / `admin.host.verify` (or `admin.host.manage`).
- Enrich `GET /api/v1/admin/verifications` and `GET /api/v1/admin/locations/moderation-queue` with business legal/trade name, location title, owner email, and `?status=` filter.

### 6. Frontend Changes
- Replace `superadminOnly` nav checks (`L77-94`) with granular `requiredPermissions` matching backend (`SUPPORT` gains read-only `AD-002`, `AD-004`, `AD-005`, `AD-006`, `AD-007`, `AD-018`); guard `"Admin Cancel"` (`L727`), moderation approvals, refund transitions, and user/role mutations with `<PermissionGate>`.
- Wire `AD-001` live KPIs (removing `LKR 4,280,000` & `WEB_ADMIN_SCREENS`) and `AD-003` live Host Directory (`L444-478`).
- Build KYC Drawer (`AD-002`) calling `getVerificationDetails` & clickable `900s` `getDocumentDownloadUrl` links + note input (`L334`); build Location Drawer (`AD-004`) calling `getLocationById` (photos, coordinates, hours, capacity, pricing) + note input (`L525`).
- Wire `AD-005` filters, pagination, `getAdminBookingDetail`, and `getAdminBookingCustody`; wire `AD-006` `bookingId` search & pagination; wire `AD-010` date/type/booking filters.
- Replace linear `nextRefundStage` (`L900-915`) in `AD-007` with explicit state selector over `REFUND_STATUSES` (`SUCCEEDED`, `MANUAL_REVIEW_REQUIRED`, `FAILED`) + gateway ref/notes fields.
- Expand `listAdminAuditEvents` (`auth-api.ts:169-185`) to return pagination + filter by `from`, `to`, `userId`, and full `SecurityEventType` codes + inspect `getAuditEventDetail`.
- Add all 12 admin user/role wrappers to `auth-api.ts` for [admin.routes.ts:40-543](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/admin/admin.routes.ts#L40-L543) and build `AD-018` searchable User & RBAC Governance workspace.
- Delete all synthetic table fallbacks (`DEMO_BOOKINGS`, `#RFD-8799`, `JRN-901..903`, `ADMIN_LOGIN_SUCCESS` at `L1639-1656`).

### 7. Dependencies
- **Blocked On:** Initiative 1 merged (synced `SYSTEM_PERMISSIONS`, permission guards). Coordinated with Initiatives 3 & 4 for full end-to-end R2 KYC/listing moderation & refund flows.

### 8. Acceptance Criteria
- Blueprint [AC-17](file:///d:/luggage-storage/luggage-storage/docs/web-platform/06-web-platform-implementation-blueprint.md#L262), [AC-18](file:///d:/luggage-storage/luggage-storage/docs/web-platform/06-web-platform-implementation-blueprint.md#L263), [AC-19](file:///d:/luggage-storage/luggage-storage/docs/web-platform/06-web-platform-implementation-blueprint.md#L264) (refund portion), and [AC-20](file:///d:/luggage-storage/luggage-storage/docs/web-platform/06-web-platform-implementation-blueprint.md#L265).
- Review [VRF-05](file:///d:/luggage-storage/luggage-storage/docs/web-platform/05-web-security-and-data-integrity-review.md#L293), [VRF-09](file:///d:/luggage-storage/luggage-storage/docs/web-platform/05-web-security-and-data-integrity-review.md#L297).

### 9. Testing Strategy
- API integration tests covering enriched queues, `GET /admin/metrics/summary`, `GET/POST /admin/hosts*`, `SUPPORT` read-only vs `403` write verification, and `MANUAL_REVIEW_REQUIRED` / `FAILED` refund state transitions.
- Vitest DOM tests asserting `SUPPORT` vs `SUPERADMIN` sidebar/button visibility (`AD-002`, `AD-005` Cancel), empty/error banners without `DEMO_*`, `AD-007` non-linear refund buttons, and `AD-018` user suspend + last-Superadmin error display.

### 10. Risks
- Allowing `SUPPORT` read access across verification/location drawers could accidentally expose write controls if `<PermissionGate>` checks role strings instead of exact `SYSTEM_PERMISSIONS`. Mitigate strictly by gating actions on `hasPermission("admin.host.verify")`, `hasPermission("admin.location.moderate")`, `hasPermission("admin.booking.manage")`, etc.

### 11. Completion Definition
- `SUPERADMIN` and `SUPPORT` can execute all read oversight, evidence-backed KYC/location moderation, non-linear refund recovery, audit drill-downs, and full user/role governance without touching mock rows or hitting unexpected `403` screens.

---

## Initiative 6: MVP Extensions (Payout Batches, Disputes, Support Tickets), Feature Gating & E2E Acceptance QA

### 1. Objective
Complete the remaining MVP operational capabilities backed by real database schemas (`AD-008`/`009` payout batches, `AD-013` dispute adjudication, `PW-009`/`AD-011`/`AD-012` support ticketing), cleanly feature-gate uncommissioned post-MVP modules (`AD-014` Reviews, `AD-015` Promotions, `AD-016` fake settings controls), and pass full Vitest + Playwright end-to-end verification across `AC-01`–`AC-20` & `VRF-01`–`VRF-12`.

### 2. Business Value
Closes the final operational loops (settling host payouts, resolving custody disputes unlocking `ON_HOLD` payables, and capturing/resolving real customer support tickets), removes every remaining misleading interactive placeholder, and delivers release-grade automated E2E evidence.

### 3. Scope
- **Included:** `POST /api/v1/admin/bookings/:id/resolve-dispute` + `AD-013` UI; `payout_batches` & `payout_batch_items` schema/migration + `/admin/payouts/batches*` endpoints + `AD-008`/`AD-009` UI + `HD-011` settlement statements view; `support_tickets` & `support_ticket_messages` schema/migration + `/support/tickets*` & `/admin/support/tickets*` endpoints + `PW-009` (`/contact`) & `AD-011`/`AD-012` live inbox; feature-gating `AD-014`/`AD-015` (`VITE_FEATURE_REVIEWS=false`, `VITE_FEATURE_PROMOTIONS=false`) & converting `AD-016` (`L1485-1553`) to read-only authoritative platform rules; full E2E verification run.
- **Excluded:** SMS OTP (`OQ-020` deferred), automated PayHere marketplace fund splits (`OQ-003` external vendor gate), formal VAT invoice PDFs (`OQ-010` legal/tax gate), public review rating & promotion voucher engines (post-MVP).
- **Gaps & Findings Resolved:** `GAP-016` (`/contact` persistence), `GAP-035`, `GAP-036`.

### 4. Affected Surfaces
- **DB Schema & Migrations:** New Drizzle schemas/migrations in [apps/api/src/infrastructure/database/schema/](file:///d:/luggage-storage/luggage-storage/apps/api/src/infrastructure/database/schema) for `payout_batches`, `payout_batch_items`, `support_tickets`, `support_ticket_messages`.
- **API:** Admin payout, dispute resolution, and support modules under `apps/api/src/modules/`.
- **Contracts & Web:** `@luggage-storage/contracts` schemas + `PW-009` (`/contact`), `HD-011` statements, `AD-008`, `AD-009`, `AD-011`, `AD-012`, `AD-013`, `AD-014`–`AD-016`.

### 5. Required Backend Integration
- **Disputes (`AD-013`):** Add `POST /api/v1/admin/bookings/:bookingId/resolve-dispute` (`admin.booking.manage`) transitioning `DISPUTED` bookings cleanly (`COMPLETED` + move `host_payables` `ON_HOLD -> ELIGIBLE` + post revenue split if host fault cleared, or `CANCELLED`/partial refund + ledger reversal), logging immutable audit entries.
- **Payout Batches (`AD-008`/`AD-009`):** Add `payout_batches` + `payout_batch_items` schema, migration, `GET/POST /api/v1/admin/payouts/batches`, and `POST /api/v1/admin/payouts/batches/:batchId/disburse` transitioning included `ELIGIBLE` `host_payables` -> `PAID` with settlement reference and double-entry payout ledger posting; expose host settlement batch read on `GET /api/v1/hosts/finance/payout-batches` (`hosts.finance.read`).
- **Support Tickets (`PW-009`, `AD-011`, `AD-012`):** Add `support_tickets` + `support_ticket_messages` tables & routes guarded by seeded `support.ticket.read` / `support.ticket.manage` (`POST /api/v1/support/tickets` for guests/authenticated travellers/hosts, `GET /api/v1/admin/support/tickets`, `GET .../tickets/:id`, `PATCH .../tickets/:id` reply/status transition).

### 6. Frontend Changes
- Build `AD-013` Disputes Queue wired to `GET /admin/bookings?status=DISPUTED` + `GET /admin/bookings/:id/custody` + `resolve-dispute` adjudication modal (removing static `L1412-1439`).
- Build `AD-008` Batch Generator & `AD-009` Manual Disbursement Register replacing `DeferredBackendNotice` (`L1206-1250`), and wire `HD-011` settlement statements tab to real `payout_batches`.
- Replace `/contact` direct-channel placeholder with `POST /api/v1/support/tickets` persistence returning real ticket reference; wire `AD-011`/`AD-012` live ticket queue, assignee/status controls, and reply thread (deleting static `TKT-9042` at `L1351-1408`).
- Gate `AD-014` (Reviews) & `AD-015` (Promotions) cleanly behind feature flags and replace `AD-016:1485-1553` unsaved interactive settings selects with read-only display of authoritative backend commission/refund/zero-possessory-lien rules.

### 7. Dependencies
- **Blocked On:** Initiatives 1–5 merged.
- **External Governance Gates for Live Production Transfer:** `OQ-003` (PayHere settlement account sign-off) & `OQ-010` (VAT/SSCL/WHT tax sign-off) govern live money transfers and formal tax invoicing; manual batch tracking can be verified cleanly with test/staging ledgers immediately.

### 8. Acceptance Criteria
- Blueprint [AC-19](file:///d:/luggage-storage/luggage-storage/docs/web-platform/06-web-platform-implementation-blueprint.md#L264) (dispute portion) + full [AC-01](file:///d:/luggage-storage/luggage-storage/docs/web-platform/06-web-platform-implementation-blueprint.md#L246)–[AC-20](file:///d:/luggage-storage/luggage-storage/docs/web-platform/06-web-platform-implementation-blueprint.md#L265) and Security Review [VRF-01](file:///d:/luggage-storage/luggage-storage/docs/web-platform/05-web-security-and-data-integrity-review.md#L289)–[VRF-12](file:///d:/luggage-storage/luggage-storage/docs/web-platform/05-web-security-and-data-integrity-review.md#L300).

### 9. Testing Strategy
- API unit + Drizzle/Postgres integration tests for `resolve-dispute` ledger balance (`debit === credit`), `payout_batches` atomic `ELIGIBLE -> PAID` locking (preventing double disbursement), and `support_tickets` RBAC (`SUPPORT` read/manage vs non-staff denial).
- Full Playwright E2E suite exercising a live multi-role lifecycle against Fastify + PostgreSQL/PostGIS + PayHere sandbox + R2 dev/staging bucket: Traveller signup -> Search/Quote/PayHere Checkout -> QR Pass generation -> Host onboarding/KYC/Venue approval -> Counter `LS-*` Check-In -> Clean Check-Out -> Payout batch settlement -> Dispute resolution -> Support ticket triage -> `SUPPORT` vs `SUPERADMIN` security checks -> Logout & cookie revocation.

### 10. Risks
- External third-party readiness (`OQ-003`, `OQ-010`, `OQ-018`, `OQ-019`, Cloudflare R2 CORS) can hold production go-live even after code completes. Mitigate by tracking an explicit external pre-flight checklist separate from code completion.

### 11. Completion Definition
- Disputes settle cleanly (`ON_HOLD` -> `ELIGIBLE` or refund); payout batches track `ELIGIBLE -> PAID` disbursements without double-spend; customer support tickets persist end-to-end; zero fake controls remain (`AD-016` read-only, `AD-014`/`015` & `HD-012` cleanly gated); entire Vitest + API + Playwright suite passes `100%` against real persistence.

---

## Platform Launch Completion Definition (Definition of Done)

Web Platform completion is reached **only when every condition below is verified in CI and staging**:

1. **Zero Security & Integrity Regressions (`VRF-01`–`VRF-12` Pass):**
   - Bodyless `logout` / `logoutAll` / `revokeSession` / `submit` / `disable` return `200`; `logout` revokes server session and clears cookies so page reload remains signed out.
   - `SUPPORT` is strictly blocked (`403` + `AUTH_ACCESS_DENIED`) from mutating host locations, capacity, pricing, bookings, verifications, or refunds while retaining full read oversight.
   - `HOST_STAFF` cannot access `HD-003`–`HD-006`, `HD-010`, `HD-011`, `HD-013`, `HD-014`, Net Earnings cards, or commission split amounts (`BR-095`, `OQ-017`).
   - Clean Web check-out (`HD-009`) writes `RELEASED_TO_TRAVELLER`, `COMPLETED`, `ELIGIBLE`, and balanced 85%/15% ledger postings—never forcing `DISPUTED_RELEASE`.
2. **Zero Synthetic Production Data (`DI-02`, `DI-03` Closed):**
   - Static check confirms zero imports of `DEMO_*` / `mock-marketplace` outside `features/preview/` (`VITE_ENABLE_DEMO_PREVIEW=false` in production builds).
   - Zero fabricated `"LKR 250,000"` insurance badges, `45/50` stock badges, `"Confirmed & Reserved"` unpaid bookings, `100%` refund lies, decorative QR SVGs, or silent `.catch(() => {})` fallbacks exist anywhere on live routes.
3. **Full Multi-Surface E2E Persistence (`AC-01`–`AC-20` Pass):**
   - Vitest (API + `jsdom` Web) and Playwright E2E suites pass end-to-end against real PostgreSQL/PostGIS and PayHere sandbox.
4. **External Go-Live Gates Signed Off:**
   - Cloudflare R2 Web-origin `PUT` CORS verified (`SEC-10`); `OQ-002`, `OQ-003`, `OQ-010`, `OQ-013`, `OQ-018`, `OQ-019` resolved and configured in production environment secrets before DNS cutover.
