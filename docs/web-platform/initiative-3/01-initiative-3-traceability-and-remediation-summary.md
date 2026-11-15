# Initiative 3 — Host Onboarding, KYC R2 Uploads, Location Sub-Resources & Staff RBAC: Traceability & Remediation Summary

**Branch:** `feature/initiative-3-host-onboarding-locations`  
**Base Commit:** `47002b6` (`docs(platform): document initiative 2 traveller completion`)  
**Implementation Commits:** `dd85c9f`, `79b3d85`, `fe5b26f`, `647b046`

---

## 1. Executive Summary

Initiative 3 delivered end-to-end live integration for the Host partner onboarding flow, Cloudflare R2 / local mock binary document & photo uploads, full storage location sub-resource configuration, and multi-business Host Staff RBAC across `@luggage-storage/contracts`, `@luggage-storage/api`, and `@luggage-storage/web`. All placeholder forms on `/become-a-host`, `/host/onboarding`, and Host Dashboard setup/administration pages (`HD-002`–`HD-006`, `HD-013`, `HD-014`) were replaced with TanStack Query hooks backed by PostgreSQL persistence and strict role-based isolation.

---

## 2. Tracking ID Traceability Matrix

| Tracking ID | Scope & Confirmed Behavior | Primary Contracts & Backend Implementation | Primary Web Implementation | Verification Coverage |
|---|---|---|---|---|
| **GAP-002** | Authenticated 3-step `/host/onboarding` wizard and role-aware `/become-a-host` landing CTAs (`Guest -> /host/onboarding & /register`, `TRAVELLER -> /host/onboarding`, `HOST_OWNER -> /host/dashboard`). | `POST /api/v1/hosts/businesses`, `POST /api/v1/auth/refresh`, `POST /api/v1/hosts/businesses/:id/verification`, `POST /api/v1/hosts/locations` | `apps/web/src/features/host/HostOnboardingPage.tsx`, `apps/web/src/features/traveller/StaticInfoPages.tsx`, `apps/web/src/app/App.tsx` | API Test #2; Web Test #2 |
| **GAP-017** | Business creation promotes `TRAVELLER` to `HOST_OWNER`, and `/auth/refresh` immediately mints updated `HOST_OWNER` JWT claims; KYC supports upload, `REJECTED` feedback display, re-upload (`PENDING_REVIEW`), and approval (`ACTIVE`). | `apps/api/src/modules/hosts/hosts.routes.ts`, `hosts.service.ts`, `host-verification.routes.ts`, `packages/contracts/src/hosts/index.ts` | `HostOnboardingPage.tsx`, `HostBusinessSettingsPage.tsx` (`HD-014`), `apps/web/src/hooks/queries/use-host-portal.ts` | API Test #2; Web Tests #2, #4 |
| **GAP-018** | Full location sub-resource configuration (locations, weekly opening hours, closure/special-hour exceptions, storage zones, capacity pools, active pricing policy, primary media) plus image-free location moderation submission (`PENDING_REVIEW`) when open hours/capacity/pricing exist. | `apps/api/src/modules/locations/locations.routes.ts`, `locations.service.ts`, `capacity.routes.ts`, `capacity.service.ts`, `pricing.routes.ts`, `pricing.service.ts` | `HostLocationsPage.tsx` (`HD-002`), `HostLocationEditorPage.tsx` (`HD-003`), `HostSchedulePage.tsx` (`HD-004`), `HostCapacityZonesPage.tsx` (`HD-005`), `HostPricingPage.tsx` (`HD-006`) | API Test #3; Web Test #4 |
| **GAP-019** | End-to-end R2 / mock-storage binary upload flow (`initiate` -> direct `PUT` -> `confirm`), including atomic `isPrimary` promotion/reassignment on location media and authenticated KYC download URLs. | `apps/api/src/modules/uploads/uploads.routes.ts`, `uploads.service.ts`, `storage.service.ts` | `apps/web/src/lib/r2-uploader.ts`, `HostOnboardingPage.tsx`, `HostLocationEditorPage.tsx` | API Tests #2, #3; Web Test #1 |
| **GAP-020** | Active custody and capacity reservation integrity guards returning `409 Conflict` when attempting to delete or deactivate zones with active custody records or delete capacity pools referenced by active reservations. | `apps/api/src/modules/locations/locations.service.ts`, `apps/api/src/modules/capacity/capacity.service.ts` | `HostCapacityZonesPage.tsx` (displays conflict alerts cleanly without dropping form state) | API Test #3 |
| **GAP-021** | Live host context persistence (active business & selected location synced to `HOST_STAFF` assigned locations), gating `useOwnedBusinessesQuery` away from `HOST_STAFF` and pre-onboarding `TRAVELLER` accounts to avoid spurious `403`s. | `apps/api/src/modules/hosts/hosts.routes.ts`, `hosts.service.ts`, `locations.routes.ts`, `locations.service.ts` | `apps/web/src/store/useHostContextStore.ts`, `apps/web/src/features/host/HostDashboardLayout.tsx`, `HostOnboardingPage.tsx` | API Test #4; Web Test #3 |
| **GAP-027 / HD-013** | Full Host Staff & RBAC management UI and backend CRUD across owned businesses and assigned locations, scoped via `hosts.staff.read_own` and `hosts.staff.manage_own`. | `0016_initiative_3_host_staff_rbac.sql`, `packages/contracts/src/rbac/index.ts`, `packages/contracts/src/hosts/index.ts`, `hosts.routes.ts`, `hosts.service.ts` | `apps/web/src/features/host/HostStaffPage.tsx`, `HostDashboardLayout.tsx` | API Test #4; Web Tests #3, #4 |
| **SEC-03** | Multi-business `HOST_STAFF` isolation: staff can read/operate only within assigned locations, are blocked from owner-only profile/pricing/payout/staff endpoints (`403`), and lose the global `HOST_STAFF` role only once their last active membership is removed. | `0016_initiative_3_host_staff_rbac.sql` (`assign_host_staff_role`, `revoke_host_staff_role_if_unassigned`), `hosts.service.ts`, `locations.service.ts` | `HostDashboardLayout.tsx` (`canActAsHostOwner` route guards block owner routes cleanly for `HOST_STAFF`) | API Test #4; Web Test #3 |
| **SEC-08** | Direct binary `PUT` to pre-signed R2 / mock-storage URLs omits cookies (`credentials: "omit"`) and omits `Authorization` headers; pre-signed PUT endpoints accept unauthenticated binary uploads validated by URL token/key without leaking session credentials. | `apps/api/src/modules/uploads/uploads.routes.ts`, `storage.service.ts` | `apps/web/src/lib/r2-uploader.ts` (`validateFileForUpload`, `uploadFileToR2`) | API Test #2; Web Test #1 |
| **SEC-10** | CORS configuration explicitly advertises and permits `PUT`, `PATCH`, and `DELETE` alongside `GET`/`POST`/`OPTIONS` preflight headers for browser host sub-resource mutations and direct uploads. | `apps/api/src/app.ts` | `apps/web/src/services/marketplace-api.ts`, `apps/web/src/lib/r2-uploader.ts` | API Test #1 |
| **WF-HST-01 – WF-HST-09, WF-HST-16** | Host business registration, KYC upload/resubmission, hub creation, profile/media updates, weekly schedule & holiday exceptions, zone & pool setup, pricing configuration, staff assignment, and business/payout compliance settings. | `hosts`, `host-verification`, `locations`, `capacity`, `pricing`, `uploads` API modules | Modular Host portal under `apps/web/src/features/host/` + `App.tsx` | API Tests #1–#4; Web Tests #1–#4 |
| **AC-10 – AC-14** | Acceptance criteria covering host onboarding transition, private KYC upload/review lifecycle, sub-resource CRUD + moderation readiness, `409` delete guards, and `HOST_STAFF` role assignment/revocation. | API routes + DB migration `0016` | Host onboarding + `HD-002`–`HD-006`, `HD-013`, `HD-014` | API Tests #2–#4; Web Tests #1–#4 |
| **VRF-02, VRF-04, VRF-07** | Verification evidence spanning private KYC access control (`SUPPORT` read + owner access vs unauthorized denial), R2 header/credential isolation, and live Host SSR/query rendering with zero demo or developer code leakage. | `uploads`, `hosts`, `locations`, `audit` API modules | `apps/web/src/features/host/host-helpers.tsx`, modular host pages | API Tests #1–#4; Web Tests #1–#4 |

---

## 3. Key Architecture & Implementation Highlights

### 3.1 Database & RBAC Scoped Role Sync (`0016_initiative_3_host_staff_rbac.sql`)
- Added permissions `hosts.staff.read_own` and `hosts.staff.manage_own` (assigned to `HOST_OWNER` and `SUPERADMIN` roles and mirrored in `packages/contracts/src/rbac/index.ts`).
- Added `SECURITY DEFINER` PostgreSQL functions `public.assign_host_staff_role(uuid, uuid, jsonb)` and `public.revoke_host_staff_role_if_unassigned(uuid, uuid, jsonb)` owned by `luggage_role_assigner` with explicit actor ownership/Superadmin assertions so staff role lifecycle stays transactional and preserves `HOST_STAFF` while any other active business membership remains.

### 3.2 Uploads & `InMemoryStorageAdapter` Dev/Test Fidelity
- `apps/api/src/modules/uploads/uploads.routes.ts` and `storage.service.ts` expose local mock R2 `PUT`/`GET` binary routes for development/Vitest runs alongside Cloudflare R2 presigned URLs in production.
- `apps/web/src/lib/r2-uploader.ts` (`validateFileForUpload`, `uploadFileToR2`) enforces client MIME/size checks against shared `@luggage-storage/contracts` constants and sends raw `File` binary via `fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file, credentials: "omit" })`.

### 3.3 Integrity Guards & Moderation Readiness
- `apps/api/src/modules/locations/locations.service.ts` checks active custody statuses (`["CHECKED_IN", "IN_STORAGE", "OVERDUE", "DISPUTED_RELEASE", "ABANDONED"]`) before permitting zone deletion or deactivation (`409 Conflict`), enforces single-primary `locationMedia` promotion/reassignment inside transactions, and permits `submitLocationForReview` (`PENDING_REVIEW`) once open weekly hours, capacity, and an `ACTIVE` pricing policy are present without requiring images.
- `apps/api/src/modules/capacity/capacity.service.ts` enforces a `409 Conflict` pre-delete check against `capacity_reservations` inside `deleteCapacityPool`.

### 3.4 Modular Web Host Surface & Gated Queries
- Extracted and wired modular Host components under `apps/web/src/features/host/` (`HostDashboardLayout`, `HostOnboardingPage`, `HostLocationManagementPage`, `HostLocationProfileEditorPage`, `HostScheduleCalendarEditorPage`, `HostCapacityPoolsZonesPage`, `HostPricingRulesMultipliersPage`, `HostStaffManagementRbacPage`, `HostBusinessProfileLegalPage`), backed by `useHostContextStore` and `use-host-portal.ts`.
- Gated `useOwnedBusinessesQuery` in `HostDashboardLayout.tsx` (`canActAsHostOwner`) and `HostOnboardingPage.tsx` (`isAuthenticated && isHostOwnerOrAdmin`) so `HOST_STAFF` and pre-onboarding `TRAVELLER` users never trigger spurious `403` requests.

---

## 4. Intentional Scope Boundaries & Initiative 4 Deferrals

- **`apps/mobile`**: Completely untouched (`git diff --name-only main -- apps/mobile` returns empty).
- **`mock-marketplace.ts` screen count**: `/host/onboarding` was intentionally kept out of mock screen arrays so `phase-2-screens-and-mascots.test.ts` continues validating the 43 catalogued screens.
- **Deferred to Initiative 4**: `HD-001` (`HostOverviewDashboardPage`) and `HD-007`–`HD-012` (Host Bookings Hub, Check-In & Out Desk / custody handover, Financial Revenue Ledger, Payout Accounts History, and Review Management) in `apps/web/src/pages/HostDashboardPages.tsx` remain untouched and scoped for Initiative 4.
