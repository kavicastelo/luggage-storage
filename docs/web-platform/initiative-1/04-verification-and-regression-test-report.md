# Initiative 1 — Verification & Regression Test Report

> **Branch:** `feature/initiative-1-foundation-hardening`  
> **Verification Date:** 2026-11-15  
> **Test Environment Note:** Executed after Commit 5 (`5acccd9`) across live local PostgreSQL 3.5 PostGIS and Node/Vitest (Option 2: `apps/web/vitest.config.ts` retains `environment: "node"` without adding `jsdom` or `@testing-library/react`).

---

## 1. Monorepo Verification Suite Results

Every command below ran cleanly with exit code `0` and zero test failures after the final code and test commit (`5acccd9`):

| Check | Exact Command | Result Summary |
| --- | --- | --- |
| **Contracts Build** | `pnpm --filter @luggage-storage/contracts build` | Exited `0` (`tsc`) |
| **API Full Suite** | `pnpm --filter @luggage-storage/api test` | **17 passed (17)** test files, **346 passed (346)** tests (`161.57s`) against live PostgreSQL + PostGIS |
| **Web Full Suite** | `pnpm --filter @luggage-storage/web test` | **12 passed (12)** test files, **138 passed (138)** tests (`3.17s`) |
| **Mobile Full Suite** | `pnpm --filter @luggage-storage/mobile test` | **18 passed (18)** test files, **121 passed (121)** tests (`3.80s`) |
| **Monorepo Lint** | `pnpm lint` | Exited `0`, **5 successful, 5 total** tasks (`0` errors; only pre-existing warnings: 54 warnings in API, 13 warnings in Web) |
| **Monorepo Typecheck** | `pnpm typecheck` | Exited `0`, **5 successful, 5 total** tasks |
| **Monorepo Build** | `pnpm build` | Exited `0`, **4 successful, 4 total** tasks (`@luggage-storage/contracts`, `@luggage-storage/api`, `@luggage-storage/web`, `@luggage-storage/mobile`) |

---

## 2. Per-File Test Breakdown (`@luggage-storage/api` & `@luggage-storage/web`)

### API Test Suite (17 files / 346 tests passed)
1. `tests/phase-b-security-remediation.test.ts` — **17 tests** passed
2. `tests/phase-b-booking-escrow-custody.test.ts` — **10 tests** passed
3. `tests/phase-a-security-remediation.test.ts` — **76 tests** passed
4. `tests/phase-b-refund-evidence.test.ts` — **5 tests** passed
5. `tests/auth.test.ts` — **53 tests** passed
6. `tests/admin-account-lifecycle.test.ts` — **27 tests** passed
7. `tests/initiative-1-security-hardening.test.ts` — **4 tests** passed *(Added in Initiative 1)*
8. `tests/marketplace-foundation.test.ts` — **26 tests** passed
9. `tests/security-regression-suite.test.ts` — **26 tests** passed
10. `tests/rbac-permissions.test.ts` — **21 tests** passed
11. `tests/payhere-sandbox-remediation.test.ts` — **5 tests** passed
12. `tests/phase-b-payhere-checkout.test.ts` — **4 tests** passed
13. `tests/audit-logging.test.ts` — **15 tests** passed
14. `tests/stabilization-security.test.ts` — **19 tests** passed
15. `tests/identity-database.test.ts` — **31 tests** passed
16. `tests/live-database.test.ts` — **2 tests** passed
17. `tests/health.test.ts` — **5 tests** passed

### Web Test Suite (12 files / 138 tests passed)
1. `tests/store.test.ts` — **3 tests** passed
2. `tests/auth-flows.test.ts` — **10 tests** passed
3. `tests/api-client.test.ts` — **9 tests** passed *(Extended in Initiative 1)*
4. `tests/phase-2-screens-and-mascots.test.ts` — **5 tests** passed
5. `tests/auth-store.test.ts` — **11 tests** passed *(Extended in Initiative 1)*
6. `tests/foundation-and-boundary.test.tsx` — **10 tests** passed
7. `tests/phase-b-checkout-handoff.test.tsx` — **7 tests** passed
8. `tests/public-web-journeys.test.tsx` — **22 tests** passed
9. `tests/validation.test.ts` — **11 tests** passed
10. `tests/initiative-1-foundation-hardening.test.tsx` — **11 tests** passed *(Added in Initiative 1)*
11. `tests/phase-b-marketplace-flows.test.tsx` — **6 tests** passed
12. `tests/host-dashboard-journeys.test.tsx` — **33 tests** passed

---

## 3. Initiative 1 Regression Test Coverage Highlights

### API Integration Suite ([initiative-1-security-hardening.test.ts](file:///d:/luggage-storage/luggage-storage/apps/api/tests/initiative-1-security-hardening.test.ts)) — 4 End-to-End Scenarios
1. **Workstream A (`SEC-01`/`SEC-02`)**: Sends bodyless `POST /api/v1/auth/logout` with `Content-Type: application/json`; verifies HTTP `200`, database session revocation, cleared `refresh_token` cookie across mount paths, and prevention of session resurrection via `/auth/refresh`.
2. **Workstream B (`SEC-04`/`SEC-05`)**: Exercises live `SUPPORT` and cross-host callers against host business, location, capacity, and pricing mutators; verifies `SUPPORT` writes fail with `403` and cross-host IDOR mutations fail while authorized read oversight continues to succeed.
3. **Workstream C (`SEC-07`)**: Verifies public `POST /api/v1/bookings/quote`, search quotes, and `GET /api/v1/bookings/:bookingId` (for `TRAVELLER` and `HOST_STAFF`) omit `commissionRateBps`, `platformCommissionMinor`, and `hostPayableMinor`, while owning `HOST_OWNER` and `SUPERADMIN` retain authorized breakdown fields.
4. **Workstream E (`DI-01`)**: Verifies `POST /api/v1/hosts/custody/:bookingId/check-out` with `collectionNotes` and no `exceptionNotes` transitions booking to `COMPLETED`, custody record to `RELEASED_TO_TRAVELLER`, and payable to `ELIGIBLE`, whereas submitting `exceptionNotes` intentionally transitions to `DISPUTED` / `DISPUTED_RELEASE` / `ON_HOLD`.

### Web Regression Suites
- **[api-client.test.ts](file:///d:/luggage-storage/luggage-storage/apps/web/tests/api-client.test.ts)**: Covers omission of `Content-Type` on bodyless `POST` (`logout`) and `DELETE` (`sessions/:id`), conditional `Content-Type: application/json` for serialized JSON vs header stripping for `FormData`, bypassing refresh on `/api/v1/auth/login` `401`, and invoking `onAuthFailure` when refresh returns malformed data.
- **[auth-store.test.ts](file:///d:/luggage-storage/luggage-storage/apps/web/tests/auth-store.test.ts)**: Verifies `logout()` cleanup + `logoutWarning` surfacing when server revocation fails, concurrent `logout()` promise deduplication via `logoutInFlight`, and `refreshSessionAndUser()` success + fail-closed cleanup.
- **[initiative-1-foundation-hardening.test.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/tests/initiative-1-foundation-hardening.test.tsx)**:
  - Demo-preview quarantine across unauthenticated non-demo routes (`PublicLandingPage`, `WebSearchDiscoveryPage`, `LocationProfileDetailPage`, `TravellerWebPortalPage`, `HostBookingManagementHubPage`, `HostWebCheckInOutOperationsPage`, `HostFinancialRevenueLedgerPage`, `AdminCommandDashboardPage`, `AdminGlobalBookingsLedgerPage`, `AdminRefundManagementQueuePage`) and authenticated `?preview=demo` isolation.
  - RBAC helper (`evaluateRouteAuthorization`), `<ProtectedRoute>` gating for unauthenticated, `?preview=demo` opt-in, and missing-permission scenarios, plus `"Host Net"` column redaction for `HOST_STAFF` vs visibility for `HOST_OWNER`.
  - Canonical `getBookingStatusDisplay` assertions across `PENDING_PAYMENT`, `PENDING_HOST_APPROVAL`, `CONFIRMED`, `IN_STORAGE`, overdue `IN_STORAGE`, `COMPLETED`, `DISPUTED`, `CANCELLED_BY_TRAVELLER`, `REJECTED`, and `EXPIRED`.
  - `executeCounterCustodyHandover` unit tests confirming unauthenticated / non-UUID live blocking, clean `collectionNotes` submission without `exceptionNotes` on normal `CHECK_OUT`, and 3-char validation + `exceptionNotes` dispatch when discrepancy is reported.
  - Static source invariants checking error alert accessibility (`Alert.tsx`, inline `role="alert"` banners in Host/Admin pages, `Retry` actions across all 3 portals) and verifying `HostWebCheckInOutOperationsPage` no longer hardcodes `exceptionNotes: "Released via Host Counter Web Desk"`.
