# Initiative 1 — Foundation Remediation Summary

> **Branch:** `feature/initiative-1-foundation-hardening` (from `dev` `ce0afbd`)  
> **Scope Covered:** Workstreams A, B, C, D, E, F & Verification Workstream G across `@luggage-storage/contracts`, `@luggage-storage/api`, and `@luggage-storage/web`.

---

## Workstream A — Authentication, Transport & Session Lifecycle (`7eca2e3`)

### API Layer
- **[app.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/app.ts)**:
  - `authenticate` hook now hydrates live database roles via `rbacService.getUserRoles(request.user.sub)` so newly assigned or revoked roles (such as `HOST_OWNER` after host business registration) apply immediately without waiting for JWT expiry.
  - Added a custom `application/json` content-type parser treating empty/whitespace strings as `undefined` rather than failing with `FST_ERR_CTP_EMPTY_JSON_BODY`, enabling legacy/external bodyless `POST` requests with `Content-Type: application/json` to succeed while malformed JSON still returns HTTP `400`.
- **[payments.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/payments/payments.routes.ts)**:
  - Called `webhookScope.removeContentTypeParser("application/json")` inside the webhook plugin scope so PayHere raw webhook signature parsing remains isolated from the root JSON parser change.
- **[auth.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/auth/auth.routes.ts)**:
  - Extracted `clearRefreshCookies(reply, requestUrl)` to clear `refresh_token` across both `"/api/v1/auth"` and `"/"` with matching cookie security attributes (`httpOnly: true`, `secure: isSecure`, `sameSite: "strict"`).
  - Replaced unverified `app.jwt.decode` in logout session extraction with `app.jwt.verify<{ sessionId?: string }>(token, { ignoreExpiration: true })`.

### Web Layer
- **[api-client.ts](file:///d:/luggage-storage/luggage-storage/apps/web/src/lib/api-client.ts)**:
  - Added `normalizeApiBaseUrl` and `normalizeEndpointPath` so endpoints with or without `/api/v1` prefixes resolve cleanly against `API_BASE`.
  - Replaced `AUTH_NO_REFRESH_ENDPOINTS` substring matching with an exact normalized path check (`isNoRefreshAuthEndpoint`) covering `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout`, `/auth/change-password`, `/auth/verify-email`, `/auth/resend-verification`, `/auth/forgot-password`, and `/auth/reset-password`.
  - Implemented `buildRequestHeaders`: sets `"Content-Type": "application/json"` only for candidate JSON bodies, omits `Content-Type` on bodyless requests (`POST`, `DELETE`, `GET`), and strips any caller-supplied `Content-Type` on `FormData` so the browser preserves multipart boundaries.
  - Added safe `parseResponseBody` handling (`INVALID_RESPONSE` error if non-204 responses return unparseable JSON) and invoked `onAuthFailure()` when `refreshAccessToken()` receives malformed/incomplete payload data.
- **[query-client.ts](file:///d:/luggage-storage/luggage-storage/apps/web/src/lib/query-client.ts)** & **[App.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/app/App.tsx)**:
  - Extracted `queryClient` into a shared singleton so auth transitions can purge cached queries cleanly.
- **[useAuthStore.ts](file:///d:/luggage-storage/luggage-storage/apps/web/src/store/useAuthStore.ts)**:
  - Added `logoutWarning`, shared `logoutInFlight` promise deduplication for concurrent `logout()` calls, `queryClient.clear()` in `setAuthFailureHandler` / `clearAuth` / `login`, and `refreshSessionAndUser()` for atomic token rotation + `/auth/me` claim reload.
  - Preserved local session wipe on server `logout`/`logoutAll` failure while surfacing `"Signed out locally, but server session revocation could not be confirmed."` in `logoutWarning`.
- **[SessionsPage.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/SessionsPage.tsx)**, **[VerifyEmailPage.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/VerifyEmailPage.tsx)**, **[PublicOnlyRoute.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/components/auth/PublicOnlyRoute.tsx)**, **[LoginPage.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/LoginPage.tsx)**:
  - Updated `SessionsPage` to call `clearAuth()` after revoking the active session via `DELETE` instead of triggering a failing extra `/auth/logout`.
  - Updated `VerifyEmailPage` to reload user state after verification and link authenticated users to `/profile`.
  - Preserved `pathname + search + hash` in post-login redirect targets.

---

## Workstream B — RBAC Permission Parity, Ownership & UI Access Control (`9d4269e`)

- **Contracts ([rbac/index.ts](file:///d:/luggage-storage/luggage-storage/packages/contracts/src/rbac/index.ts))**:
  - Synchronized `SYSTEM_PERMISSIONS` with Phase B permissions: `BOOKINGS_CREATE`, `BOOKINGS_READ_OWN`, `BOOKINGS_CANCEL_OWN`, `HOSTS_BOOKINGS_READ_OWN`, `HOSTS_BOOKINGS_MANAGE_OWN`, `HOSTS_CUSTODY_OPERATE`, `HOSTS_FINANCE_READ_OWN`, `ADMIN_BOOKING_READ`, `ADMIN_BOOKING_MANAGE`, `ADMIN_PAYMENT_READ`, `ADMIN_REFUND_READ`, and `ADMIN_REFUND_MANAGE`.
- **API Route & Service Ownership Enforcement**:
  - Added `requirePermission` / `requireAnyPermission` guards across all routes in [locations.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/locations/locations.routes.ts), [capacity.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/capacity/capacity.routes.ts), [pricing.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/pricing/pricing.routes.ts), [uploads.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/uploads/uploads.routes.ts), and `POST /bookings/:bookingId/exceptions` in [bookings.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/bookings/bookings.routes.ts).
  - Enforced owner-or-`SUPERADMIN` write guards across [locations.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/locations/locations.service.ts) (`assertLocationOwnerOrSuperadmin`), [capacity.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/capacity/capacity.service.ts), [pricing.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/pricing/pricing.service.ts), [hosts.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/hosts/hosts.service.ts), and [uploads.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/uploads/uploads.service.ts), blocking `SUPPORT` write escalation while preserving `SUPPORT` read-only inspection via separate read paths.
  - Replaced the invalid `"ADMIN_FINANCIAL"` role check in [hosts.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/hosts/hosts.service.ts) `getPayoutDetails` with `"SUPERADMIN"`.
- **Web Route & Role Scoping**:
  - Wrapped `/booking/confirm` and `/portal/bookings` in `<ProtectedRoute allowDemoPreview={true} />` in [App.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/app/App.tsx).
  - Hardened [AppShell.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/components/layout/AppShell.tsx) header navigation (`Host Portal` vs `Become a Host`, `SUPPORT` entry at `/admin/bookings`).
  - Enforced `HOST_STAFF` vs `HOST_OWNER` route/CTA boundaries in [HostDashboardPages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx) and `SUPPORT` read-only allowlist (`SUPPORT_ALLOWED_EXACT_PATHS` and `/admin/support/:id`) in [AdminDashboardPages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx), and cleaned internal tracking strings from [NotFoundPage.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/NotFoundPage.tsx).

---

## Workstreams C, D & F — Financial Privacy, Status Honesty & Demo Quarantine (`7d08418`)

- **Workstream C — Financial & Commission Redaction**:
  - Made `commissionRateBps`, `platformCommissionMinor`, and `hostPayableMinor` optional in `BookingQuoteResponseSchema` and `BookingPricingSnapshotSchema` ([packages/contracts/src/bookings/index.ts](file:///d:/luggage-storage/luggage-storage/packages/contracts/src/bookings/index.ts)).
  - Stripped those three fields from `POST /api/v1/bookings/quote` ([bookings.routes.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/bookings/bookings.routes.ts)) and availability search quotes ([quotation-availability.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/bookings/quotation-availability.service.ts)).
  - Restricted `commissionRateBps`, `platformCommissionMinor`, and `hostPayableMinor` in `getBookingDetail` ([bookings.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/bookings/bookings.service.ts)) to `SUPERADMIN` and the owning `HOST_OWNER` (`canViewCommissionFields`).
  - Redacted host financial columns (`Host Net`) and financial summaries from `HOST_STAFF` views in [HostDashboardPages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx).
- **Workstream D — Truthful Booking Statuses & Location Attributes**:
  - Created [booking-status.ts](file:///d:/luggage-storage/luggage-storage/apps/web/src/lib/booking-status.ts) exporting `getBookingStatusDisplay(status, options)` so `PENDING_PAYMENT` renders as `"Pending Payment"` (`warning`), `CONFIRMED` renders as `"Confirmed & Reserved"`, overdue `IN_STORAGE`/`CHECKED_IN` renders as `"Overdue Custody"` (`danger`), `EXPIRED` renders as `"Hold Expired"`, and `DISPUTED` renders as `"Custody Exception / Disputed"`.
  - Removed hardcoded marketplace guarantees (fabricated LKR 250,000 insurance, synthetic 45/50 capacity, fake 30m grace, synthetic hourly tiers) from live Traveller paths in [PublicMarketplacePages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx).
- **Workstream F — Demo-Data Quarantine & Error Recovery**:
  - Eliminated unguarded `DEMO_LOCATIONS` / `DEMO_BOOKINGS` state defaults and error fallbacks across [PublicMarketplacePages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx), [HostDashboardPages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx), and [AdminDashboardPages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx).
  - Live routes show honest loading, empty, and error states with explicit `Retry` controls when unauthenticated without `?preview=demo` or when authenticated, even if `?preview=demo` is appended to the URL.

---

## Workstream E — Custody Collection Integrity (`36a920c`, `5acccd9`)

- **Contracts ([packages/contracts/src/custody/index.ts](file:///d:/luggage-storage/luggage-storage/packages/contracts/src/custody/index.ts))**: Added optional `collectionNotes: z.string().trim().max(500).optional()` to `CompleteCollectionRequestSchema` while keeping `exceptionNotes` optional and exclusive to exceptions.
- **API ([custody.service.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/custody/custody.service.ts))**: Persisted `collectionNotes` in custody completion metadata and audit event details without activating `hasDisputeException`, preserving normal `RELEASED_TO_TRAVELLER` / `COMPLETED` / `ELIGIBLE` host payable transitions and ledger postings.
- **Web ([HostDashboardPages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx) & [counter-custody.ts](file:///d:/luggage-storage/luggage-storage/apps/web/src/lib/counter-custody.ts))**:
  - Removed the hardcoded `exceptionNotes: "Released via Host Counter Web Desk"` from live `CHECK_OUT` submissions.
  - Added optional `Collection Handover Notes` input and an explicit `Report custody exception or discrepancy` checkbox with mandatory 3-character exception details when enabled.
  - Extracted pure testable `executeCounterCustodyHandover` helper rejecting unauthenticated calls and non-UUID live lookups before dispatch.
