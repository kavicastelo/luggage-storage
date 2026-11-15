# 03 — Backend API Reuse and Integration Specification

**Baseline:** Commit `b09fa68` (`dev`) | **Canonical Prefix:** `/api/v1` (unversioned aliases also registered in [`app.ts`](file:///d:/luggage-storage/luggage-storage/apps/api/src/app.ts#L311-L364))  
**Rule of Separation:** Every section below strictly separates **Confirmed Existing Endpoints** (`apps/api/src/modules/**`) from **Proposed Backend Work (Not Yet Implemented)**. Do not invent or assume unimplemented routes exist.

---

## Master Summary Inventory — Confirmed Existing API Endpoints (93 Logical Routes)

| Module | Route File | Endpoint Count | Auth / Access Model | Web Reuse Verdict |
| :--- | :--- | :---: | :--- | :--- |
| Health & Readiness | `health/health.routes.ts` | 2 | Public | Already integrated (`HealthPage.tsx`) |
| Auth & Sessions | `auth/auth.routes.ts` | 13 | Public + `authenticate` | Needs empty-body header fix (`api-client.ts:112-115`) & `/verify-email` `refreshUser()` |
| Admin Users, RBAC & Audit | `admin/admin.routes.ts` | 14 | `authenticate` + `requirePermission` | `1` partial (`audit-events`), `13` unwired on Web (ready for direct reuse!) |
| Host Businesses & KYC | `hosts/hosts.routes.ts` | 7 | `authenticate` + `requirePermission` | `2` partial, `5` unwired (requires post-create JWT refresh & dead role fix in `hosts.service.ts:429`) |
| Admin Host Verification | `host-verification/host-verification.routes.ts` | 3 | `ADMIN_HOST_READ` / `ADMIN_HOST_VERIFY` | `2` live (`AD-002`), `1` unused (`GET /verifications/:id`); list needs business join & status filter |
| Storage Locations & Config | `locations/locations.routes.ts` | 10 | `authenticate` (**missing `requirePermission`!**) | `3` partial, `7` unwired; **requires security fix** + `HOST_STAFF` read fix + `DELETE` sub-routes |
| Admin Location Moderation | `locations/location-moderation.routes.ts` | 2 | `ADMIN_LOCATION_READ` / `ADMIN_LOCATION_MODERATE` | `2` live (`AD-004`); queue needs business join & status filter |
| Capacity Pools | `capacity/capacity.routes.ts` | 3 | `authenticate` (**missing `requirePermission`!**) | `0` used in UI (wrapped in `marketplace-api.ts`); **requires security fix** |
| Pricing Policies | `pricing/pricing.routes.ts` | 2 | `authenticate` (**missing `requirePermission`!**) | `0` used in UI (wrapped in `marketplace-api.ts`); **requires security fix** |
| Uploads & R2 Downloads | `uploads/uploads.routes.ts` | 3 | `authenticate` / `UPLOAD_INITIATE` | `0` used in UI (wrapped in `marketplace-api.ts`); needs Web binary `PUT` helper + dev mock `PUT` route |
| Public Discovery | `discovery/discovery.routes.ts` | 2 | Public | Both live; `/locations/:id` needs full hours/exceptions/gallery/tier rates for `PW-003` |
| Availability & Quotations | `bookings/bookings.routes.ts` | 2 | Public | `POST /quote` live; `GET /availability/search` unused in Web UI |
| Traveller Bookings & Exceptions | `bookings/bookings.routes.ts` | 5 | `authenticate` + `requirePermission` | `3` live, `POST /:id/exceptions` unused; `getBookingDetail` needs commission redaction |
| Host Bookings & Finance | `bookings/bookings.routes.ts` | 6 | `authenticate` + `hosts.bookings.*` / `hosts.finance.read_own` | `5` live, `GET /hosts/bookings/:id` unused in Web UI |
| Host Custody Desk | `custody/custody.routes.ts` | 4 | `authenticate` + `hosts.custody.operate` | All 4 wired; `completeCollection` corrupted by `HostDashboardPages.tsx:2387` |
| Payments & Webhooks | `payments/payments.routes.ts` | 6 | Auth (`bookings.*`) + Public HMAC/MD5 webhooks + Retired `410` | `intents`, `checkout-status`, `sandbox-simulate` live in Web UUID checkout |
| Admin Phase B Governance | `admin/admin-phase-b.routes.ts` | 8 | `admin.booking.*`, `admin.payment.read`, `admin.refund.*`, `admin.financial.manage` | `6` partial (`AD-005..007`, `010`), `1` unused (`GET /admin/bookings/:id`) |
| **Total Confirmed** | **13 route files** | **93** (+ 2 `/ready` / `/health` already counted) | Dual-mounted `/api/v1/*` & `/*` | Zero justification to rewrite backend |

---

## Domain-by-Domain Integration Specification (All 25 Mandatory Domains)

### 1. Identity and Authentication
1. **Confirmed Existing API Capabilities (`auth.routes.ts`, `health.routes.ts`):**
   - `GET /api/v1/health` & `GET /api/v1/ready` (`health.routes.ts:7-103`, Public): Liveness and PostgreSQL/PostGIS readiness.
   - `POST /api/v1/auth/register` (`auth.routes.ts:53-122`, Public): `RegisterRequestSchema` -> `201` `RegisterResponseData`. Assigns `TRAVELLER` role regardless of client payload (`role` ignored).
   - `POST /api/v1/auth/login` (`L128-235`, Public): `LoginRequestSchema` (`clientType: "WEB" | "MOBILE"`) -> `200` `LoginResponseData` (`accessToken` 15m JWT + sets `HttpOnly`, `SameSite=Strict` `refresh_token` cookie for `WEB`).
   - `POST /api/v1/auth/refresh` (`L241-331`, Public via cookie/body): Atomic rotation under `auth_sessions` `SELECT ... FOR UPDATE` with token-family reuse revocation -> `200` `RefreshResponseData`.
   - `POST /api/v1/auth/logout` (`L337-420`) & `POST /api/v1/auth/logout-all` (`L425-459`, `authenticate`): Revoke session(s) in `auth_sessions` and clear cookies.
   - `GET /api/v1/auth/me` (`L465-531`, `authenticate`): Returns `{ user: { id, email, displayName, status, isEmailVerified, isPhoneVerified, roles, permissions, lastLoginAt }, sessionId, permissions }`.
   - `GET /api/v1/auth/sessions` (`L537-594`, `authenticate`) & `DELETE /api/v1/auth/sessions/:sessionId` (`L600-670`, `authenticate`): Inspect and revoke owned sessions.
   - `POST /api/v1/auth/change-password` (`L676-742`, `authenticate`), `POST /api/v1/auth/forgot-password` (`L748-809`), `POST /api/v1/auth/reset-password` (`L815-878`), `POST /api/v1/auth/verify-email` (`L884-949`), `POST /api/v1/auth/resend-verification` (`L955-1013`).
2. **Existing Frontend Integration:** [`auth-api.ts`](file:///d:/luggage-storage/luggage-storage/apps/web/src/services/auth-api.ts#L1-L187) wraps all 13 endpoints; `useAuthStore` + Auth pages consume them.
3. **Required Frontend Integration:** Fix `api-client.ts:112-115` so bodyless `POST` (`logout`, `logoutAll`) and `DELETE` (`revokeSession`) do **not** send `Content-Type: application/json`; call `onAuthFailure()` on malformed refresh JSON (`api-client.ts:86-88`) and wrap `retryResponse.json()` (`L145`) in `try/catch`; call `useAuthStore.getState().refreshUser()` after email verification ([`VerifyEmailPage.tsx:45-47`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/VerifyEmailPage.tsx#L45-L47)); preserve redirect location when sending unauthenticated users to `/login` (`state: { from: location }`); enforce explicit feedback instead of silent `.catch(() => {})` on logout.
4. **Proposed (Not Yet Implemented):**
   - Extend `GET /api/v1/auth/me` (`auth.service.ts:382-416`) to optionally include `phoneNumber` and `travellerProfile` summary for checkout prefill.
   - Normalize `getCookieConfig` (`auth.routes.ts:32-38`) so refresh cookies always use consistent `/api/v1/auth` path (when called via `/api/v1`) or standardize all Web traffic onto `/api/v1/*`.
5. **Required Contract Changes:** None required for core auth; optional extension to `AuthMeResponseDataSchema` if `phoneNumber`/`travellerProfile` is added.
6. **Authorization Requirements:** `logoutAll`, `me`, `sessions`, `revokeSession`, `changePassword` require valid Bearer JWT (`app.authenticate`); `verifyEmail` / `forgotPassword` / `resendVerification` enforce PostgreSQL HMAC-SHA256 rate limiting.
7. **Persistence Expectations:** All sessions persisted in `auth_sessions`; refresh family reuse revokes entire family; security events logged to `security_audit_events`.
8. **Error Handling:** Handle `400`, `401`, `403`, `409` (`409` email exists on register), `429` (rate limit retry-after feedback).
9. **Testing Requirements:** Live Fastify + Web `api-client` integration tests verifying `POST /api/v1/auth/logout`, `POST /api/v1/auth/logout-all`, and `DELETE /api/v1/auth/sessions/:sessionId` return `200`, revoke `auth_sessions`, clear cookie, and do not re-authenticate on reload.

---

### 2. Users and Profiles
1. **Confirmed Existing API Capabilities:** Only `GET /api/v1/auth/me` (read-only core user fields) and `GET/POST /api/v1/admin/users*` (Section 19) exist.
2. **Existing Frontend Integration:** [`ProfilePage.tsx`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/ProfilePage.tsx) reads `useAuthStore.user` and renders a read-only view exposing internal UUID `sessionId` and raw RBAC permission strings (`L135-213`).
3. **Required Frontend Integration:** Replace read-only internal debug dump with an editable Traveller/User Profile form (displayName, phone, emergency contact, preferred language/currency), hiding raw `sessionId`/permissions behind dev-only or admin views.
4. **Proposed (Not Yet Implemented):** Register `profileRoutes` under `/api/v1/identity/profile` (`GET` & `PATCH`):
   - `GET /api/v1/identity/profile` (`[app.authenticate, app.requirePermission("identity.profile.read")]`) -> returns `UserProfileResponseDataSchema`.
   - `PATCH /api/v1/identity/profile` (`[app.authenticate, app.requirePermission("identity.profile.update")]`) -> validates `UpdateProfileRequestSchema`, updates `users.display_name`, `users.phone_number`, and upserts `traveller_profiles`.
5. **Required Contract Changes:** None! [`packages/contracts/src/identity/index.ts`](file:///d:/luggage-storage/luggage-storage/packages/contracts/src/identity/index.ts#L52-L106) **already defines** `UserProfileResponseDataSchema`, `UpdateProfileRequestSchema`, and `UpdateProfileResponseDataSchema`, and `traveller_profiles` + `identity.profile.read/update` permissions already exist in DB/seed!
6. **Authorization Requirements:** Strict self-scope (`userId = request.user.sub`) enforced on service layer; phone change must reset `isPhoneVerified = false`.
7. **Persistence Expectations:** Transactional update of `users` + `traveller_profiles` + `security_audit_events`.
8. **Error Handling:** Field-level Zod mapping for `E164PhoneNumberSchema` and `CurrencyCodeSchema`.
9. **Testing Requirements:** Contract + Supertest + Web form submission test asserting persisted emergency contact and updated `useAuthStore.user.displayName`.

---

### 3. Host Businesses
1. **Confirmed Existing API Capabilities (`hosts.routes.ts:15-227`):**
   - `POST /api/v1/hosts/businesses` (`authenticate`): Validates `CreateHostBusinessRequestSchema` -> `201` `HostBusinessSchema`. Creates `host_businesses` (`DRAFT`) and runs `self_assign_host_owner_role` in `user_roles`.
   - `GET /api/v1/hosts/businesses` (`authenticate`): Returns businesses owned by `request.user.sub` (`{ businesses }`).
   - `GET /api/v1/hosts/businesses/:businessId` (`authenticate`): Returns single owned business (+ latest `verification`).
   - `PATCH /api/v1/hosts/businesses/:businessId` (`authenticate`): Validates `UpdateHostBusinessRequestSchema`; updates details including payout banking (AES-256-GCM encrypted).
   - `GET /api/v1/hosts/businesses/:businessId/payout-details` (`authenticate`): Decrypts bank details for business owner or `SUPERADMIN` (**BUG**: `hosts.service.ts:429` also checks nonexistent role `"ADMIN_FINANCIAL"` instead of `admin.financial.manage`).
2. **Existing Frontend Integration:** `marketplaceApi` wraps `createBusiness`, `getOwnedBusinesses`, `getBusinessById`, `updateBusiness` (`marketplace-api.ts:102-127`), **missing `getBusinessPayoutDetails`**. Only `getOwnedBusinesses` and `createBusiness` are used in `HD-014` (`HostDashboardPages.tsx:3404-3833`).
3. **Required Frontend Integration:**
   - Unblock `TRAVELLER` -> `HOST_OWNER` onboarding (`/host/onboarding` or onboarding gate in `/host/settings`), and **immediately call `authApi.refresh()` + `useAuthStore.getState().refreshUser()` after `createBusiness`** so the JWT receives `HOST_OWNER`.
   - Add `getBusinessPayoutDetails` wrapper to `marketplaceApi`, wire `useHostContextStore`, and wire `updateBusiness` in `HD-014` and payout bank editing in `HD-011`.
4. **Proposed (Not Yet Implemented):**
   - **Fix `POST /api/v1/hosts/businesses`** (or backend role check): Alongside Web calling `authApi.refresh()`, update `uploads.service.ts:51` and `ledger.service.ts:413` to verify DB role/ownership (`rbacService.getUserRoles`) or issue rotated tokens so stale JWTs cannot `403` newly onboarded hosts.
   - **Fix `hosts.service.ts:429`:** Replace `"ADMIN_FINANCIAL"` with `rbacService.hasPermission(..., "admin.financial.manage")` / `SUPERADMIN`.
   - **New Admin Host Directory endpoints (for `AD-003`):**
     - `GET /api/v1/admin/hosts` (`[authenticate, requirePermission("admin.host.read")]`) supporting `?status=&search=&page=&limit=`.
     - `POST /api/v1/admin/hosts/:businessId/suspend` & `.../reinstate` (`requirePermission("admin.host.verify")`).
5. **Required Contract Changes:** Add `AdminHostListQuerySchema`, `AdminHostSummarySchema`, `AdminSuspendHostRequestSchema` in `packages/contracts/src/hosts/index.ts`.
6. **Authorization Requirements:** Enforce `hosts.business.*` permissions on `hosts.routes.ts` (note: allow `TRAVELLER` with `hosts.business.create` on `POST /hosts/businesses` — check RBAC seed or grant `hosts.business.create` to `TRAVELLER` if omitted).
7. **Persistence Expectations:** `host_businesses`, encrypted `payout_account_number_encrypted`, `user_roles`, audit event.
8. **Error Handling:** `409` duplicate BRN if applicable, `403` ownership violation, `400`/`422` validation.
9. **Testing Requirements:** E2E test verifying a newly registered `TRAVELLER` creates a business, refreshes token silently, edits business & bank details, and inspects them in `HD-014` & `HD-011`.

---

### 4. Host Verification (KYC & R2 Document Uploads)
1. **Confirmed Existing API Capabilities (`hosts.routes.ts`, `host-verification.routes.ts`, `uploads.routes.ts`):**
   - `POST /api/v1/uploads/presigned-url` (`[authenticate, requirePermission("upload.initiate")]`): `InitiateUploadRequestSchema` (`purpose: "HOST_VERIFICATION" | "LOCATION_IMAGE"`, `resourceId`, `fileName`, `mimeType`, `fileSize`) -> creates `upload_intents (PENDING, 15m TTL)` and returns `{ intentId, uploadUrl, fileKey, expiresInSeconds }`.
   - `POST /api/v1/uploads/confirm` (`authenticate`): `ConfirmUploadRequestSchema` -> verifies HEAD metadata (`> 0` bytes, `<= maxFileSize`, exact MIME match), transitions intent `CONFIRMED` (or `CONSUMED` for `LOCATION_IMAGE`) under `FOR UPDATE`.
   - `GET /api/v1/uploads/documents/:documentId/download` (`authenticate`): Owner or `SUPERADMIN`/`SUPPORT` -> returns 15m presigned `downloadUrl`, auditing `DOCUMENT_ACCESSED`.
   - `POST /api/v1/hosts/businesses/:businessId/verification` (`authenticate`): Consumes confirmed `upload_intents`, inserts `host_verifications (PENDING_REVIEW)` + `host_verification_documents`, transitions `host_businesses.status` to `PENDING_VERIFICATION`.
   - `GET /api/v1/hosts/businesses/:businessId/verification` (`authenticate`): Returns latest verification + documents.
   - `GET /api/v1/admin/verifications` (`ADMIN_HOST_READ`): Lists `PENDING_REVIEW` queue (`{ items, pagination }`, omits business name/BRN/owner email).
   - `GET /api/v1/admin/verifications/:verificationId` (`ADMIN_HOST_READ`): Returns full application, business summary, and documents array (`document.id` for presigned download).
   - `POST /api/v1/admin/verifications/:verificationId/review` (`ADMIN_HOST_VERIFY`): `ReviewHostVerificationRequestSchema` (`APPROVE | REJECT | REQUEST_MORE_INFO`, `rejectionReason`, `adminNotes`) -> updates `host_verifications` & `host_businesses.status` (`ACTIVE` / `REJECTED` / `MORE_INFO_REQUIRED`).
2. **Existing Frontend Integration:** `marketplaceApi` wraps all 8 endpoints (`L129-151, 319-349, 636-659`). **HOWEVER**: `apps/web` has **zero** binary `PUT` helper to upload the `File` to `uploadUrl`; `HD-014` never calls upload/submit/getVerification; `AD-002` calls `list` + `review` only and never calls `getVerificationDetails` or `getDocumentDownloadUrl`.
3. **Required Frontend Integration:**
   - Implement `uploadFileToPresignedUrl(uploadUrl, file, mimeType)` in [`api-client.ts`](file:///d:/luggage-storage/luggage-storage/apps/web/src/lib/api-client.ts) or `marketplace-api.ts` (matching [`apps/mobile/src/services/marketplace-api.ts:300-317`](file:///d:/luggage-storage/luggage-storage/apps/mobile/src/services/marketplace-api.ts#L300-L317), strictly omitting `Authorization` header so R2 presigned signature succeeds).
   - Build multi-document KYC upload wizard in `HD-014` (`BRN_CERTIFICATE`, `OWNER_ID`, `TIN_CERTIFICATE`, etc.) + status display using actual contract statuses (`PENDING_REVIEW`, `ACTIVE`, `REJECTED`, `MORE_INFO_REQUIRED`).
   - Build inspection drawer in `AD-002` calling `getVerificationDetails` and rendering document preview/download buttons via `getDocumentDownloadUrl`, plus mandatory notes/reason form for Reject/Request Info.
4. **Proposed (Not Yet Implemented):**
   - Extend `GET /api/v1/admin/verifications` (`host-verification.service.ts:39-105`) to accept optional `?status=` filter (default `PENDING_REVIEW`, allow `ALL` / `APPROVED` / `REJECTED` / `MORE_INFO_REQUIRED`) and include joined `legalBusinessName`, `tradeName`, `businessRegistrationNumber`, and owner `email` in queue rows.
   - Add development-only `PUT /api/v1/uploads/mock-storage/*` route when `STORAGE_PROVIDER` uses `InMemoryStorageAdapter` (`uploads/storage.service.ts:136-140`), so local dev uploads without R2 credentials do not 404.
5. **Required Contract Changes:** Extend `PendingVerificationItemSchema` / query schema in `packages/contracts/src/hosts/index.ts`; later add `CUSTODY_EVIDENCE` to `UPLOAD_PURPOSES` (`packages/contracts/src/uploads/index.ts:8`).
6. **Authorization Requirements:** Document download restricted to business owner, `SUPPORT`, and `SUPERADMIN`; KYC decisions restricted to `admin.host.verify` (`SUPERADMIN`); `SUPPORT` allowed read-only inspection via `admin.host.read`.
7. **Persistence Expectations:** `upload_intents` (`PENDING -> CONFIRMED -> CONSUMED`), `host_verifications`, `host_verification_documents`, `host_businesses`, `security_audit_events`.
8. **Error Handling:** File size/MIME pre-check on client matching contract limits; R2 CORS/network failure retry; `400` expired/unconfirmed intent handling.
9. **Testing Requirements:** Integration test covering initiate -> mock `PUT` -> confirm -> submit verification -> admin inspect & download URL -> approve (`host_businesses.status = ACTIVE`).

---

### 5. Locations
1. **Confirmed Existing API Capabilities (`locations.routes.ts`, `location-moderation.routes.ts`):**
   - `POST /api/v1/hosts/locations` (`L15`): `CreateLocationRequestSchema` -> `201` `StorageLocationSchema` (`DRAFT`).
   - `GET /api/v1/hosts/locations` (`L41`): Lists owned locations (`getOwnedLocations`).
   - `GET /api/v1/hosts/locations/:locationId` (`L66`): Full detail including exact street address & private instructions (`StorageLocationDetailSchema`).
   - `PATCH /api/v1/hosts/locations/:locationId` (`L99`): Updates fields/coordinates.
   - `POST /api/v1/hosts/locations/:locationId/submit` (`L132`): Validates readiness (hours configured, active capacity pool, active pricing policy) and transitions to `PENDING_REVIEW`.
   - `POST /api/v1/hosts/locations/:locationId/disable` (`L165`): Transitions location to `DISABLED`.
   - `POST /api/v1/hosts/locations/:locationId/media` (`L301`): Consumes confirmed `LOCATION_IMAGE` `upload_intents` and attaches photo to `location_media`.
   - `GET /api/v1/admin/locations/moderation-queue` (`location-moderation.routes.ts:11`, `ADMIN_LOCATION_READ`): Lists `PENDING_REVIEW` locations.
   - `POST /api/v1/admin/locations/:locationId/review` (`L41`, `ADMIN_LOCATION_MODERATE`): Approves (`ACTIVE`) or rejects (`REJECTED`) listing.
2. **Existing Frontend Integration:** `marketplaceApi` wraps all 9 methods (`L157-296, 661-680`). Currently `HD-002` calls `create` + broken immediate `submit` (`L977`), `AD-004` calls queue + review without detail inspection, and `HD-003` is completely mocked.
3. **Required Frontend Integration:** Fix empty-body `POST /submit` & `/disable` via `api-client.ts`; remove premature submit on draft creation; implement `HD-003` Location Editor + R2 Gallery Uploader (`initiateUpload(LOCATION_IMAGE)` -> binary `PUT` -> `confirmUpload` -> `addLocationMedia`) + explicit readiness checklist + `"Submit for Review"` CTA; wire `AD-004` drawer to call `getLocationById` before moderating.
4. **Proposed (Not Yet Implemented):**
   - **CRITICAL Security Fix:** Add explicit `app.requirePermission(...)` preHandlers on `locations.routes.ts` (`hosts.location.create`, `read_own`, `update_own`, `submit`, `disable`, `configure`) AND restrict write operations in `locations.service.ts:216, 322, 382, 414, 437, 485, 531, 563` so `SUPPORT` **cannot** call write methods (only `SUPERADMIN` or owning `HOST_OWNER`).
   - **Update `locations.service.ts:173-221`:** Include `HOST_STAFF` via `host_staff_memberships` for read endpoints (`hosts.location.read_own`), resolving `WF-HST-02` for staff users.
   - **New Sub-Resource Delete/Reorder:** Add `DELETE /api/v1/hosts/locations/:locationId/media/:mediaId` & primary-photo toggle.
   - **Extend `GET /api/v1/admin/locations/moderation-queue`:** Support `?status=` filter and include business name & verification status.
5. **Required Contract Changes:** Optional `AdminLocationQueueQuerySchema` and `DeleteMediaParamsSchema`.
6. **Authorization Requirements:** Strict `HOST_OWNER` write isolation; `HOST_STAFF` read-only location scope; `SUPPORT` read-only (`ADMIN_LOCATION_READ`); `SUPERADMIN` moderation (`ADMIN_LOCATION_MODERATE`).
7. **Persistence Expectations:** `storage_locations` (`PostGIS` coarse & exact `GEOGRAPHY(POINT, 4326)`), `location_media`, `security_audit_events`.
8. **Error Handling:** Surface `422` readiness errors cleanly (linking host to Hours/Capacity/Pricing tabs) instead of generic error text.
9. **Testing Requirements:** Supertest test asserting `SUPPORT` receives `403 Forbidden` on `PATCH /hosts/locations/:id`, `HOST_STAFF` sees assigned locations on `GET /hosts/locations`, and Web readiness gate blocks premature submit.

---

### 6. Operating Hours and Exceptions
1. **Confirmed Existing API Capabilities (`locations.routes.ts:198-264`):**
   - `PUT /api/v1/hosts/locations/:locationId/opening-hours` (`L198`): Replaces 7-day `SetOpeningHoursRequestSchema` (`{ schedules: OpeningHourItemInput[] }`, validating `openTime < closeTime` unless `isClosed`).
   - `POST /api/v1/hosts/locations/:locationId/exceptions` (`L233`): Upserts holiday/maintenance exception (`exceptionDate`, `exceptionType: "CLOSURE" | "SPECIAL_HOURS"`, `openTime`, `closeTime`, `reason`) via `onConflictDoUpdate`.
   - Read via `GET /api/v1/hosts/locations/:locationId` (`openingHours`, `exceptions`).
2. **Existing Frontend Integration:** `marketplaceApi.setOpeningHours` & `addOpeningHoursException` exist (`L199-215`), **0 UI usage**. (`HD-004` simulates locally.)
3. **Required Frontend Integration:** Replace `HD-004` (`HostDashboardPages.tsx:1449-1601`) mock state with hydrated weekly schedule editor (`dayOfWeek 0..6`, `is24Hours` quick toggle using `00:00:00`–`23:59:59`, `allowsDropoff`, `allowsCollection`) and holiday exception table/form.
4. **Proposed (Not Yet Implemented):** Add `app.requirePermission("hosts.location.configure")` to both routes + `DELETE /api/v1/hosts/locations/:locationId/exceptions/:exceptionId` to remove mistaken future closures.
5. **Required Contract Changes:** `DeleteOpeningExceptionResponseSchema` (optional).
6. **Authorization Requirements:** Owner `HOST_OWNER` or `SUPERADMIN` only (`HOST_STAFF` read-only).
7. **Persistence Expectations:** Transactional delete+insert on `opening_hours`; unique `(location_id, exception_date)` upsert on `opening_hours_exceptions`.
8. **Error Handling:** Validate `openTime < closeTime` client-side via Zod before submit and show day-specific error banner.
9. **Testing Requirements:** Test round-trip 7-day save + reload persistence + quotation rejection on closed exception dates.

---

### 7. Storage Zones
1. **Confirmed Existing API Capabilities (`locations.routes.ts:267-298`):**
   - `POST /api/v1/hosts/locations/:locationId/zones` (`L267`): Validates `CreateStorageZoneRequestSchema` (`name`, `zoneType`, `securityTier`, `isActive`) -> `201` zone record. Read via `GET /hosts/locations/:id`.
2. **Existing Frontend Integration:** `marketplaceApi.createStorageZone` (`L217-225`) unused. (`HD-005` `"Add Zone"` modal at `L1761` is a no-op.)
3. **Required Frontend Integration:** Wire zone list, creation modal, and check-in `zoneId` selector (`HD-009`) using real `storageZones` from `getLocationById`.
4. **Proposed (Not Yet Implemented):** Add `app.requirePermission("hosts.location.configure")`; add `PATCH /api/v1/hosts/locations/:locationId/zones/:zoneId` and `DELETE /api/v1/hosts/locations/:locationId/zones/:zoneId` (soft-disable / delete when unused by active custody records).
5. **Required Contract Changes:** `UpdateStorageZoneRequestSchema` in `packages/contracts/src/locations/index.ts`.
6. **Authorization Requirements:** `HOST_OWNER` / `SUPERADMIN` for configuration; `HOST_STAFF` read-only for `HD-009` check-in placement.
7. **Persistence Expectations:** `storage_zones` FK to `storage_locations`.
8. **Error Handling:** Prevent deleting a zone referenced by active `custody_records` (`409 Conflict`).
9. **Testing Requirements:** Verify created zones persist across reloads and appear as check-in dropdown options in `HD-009`.

---

### 8. Capacity
1. **Confirmed Existing API Capabilities (`capacity.routes.ts:11-109`):**
   - `GET /api/v1/hosts/locations/:locationId/capacity-pools` (`L11`) -> `{ pools }`.
   - `POST /api/v1/hosts/locations/:locationId/capacity-pools` (`L44`): `CreateCapacityPoolRequestSchema` (`bagCategory`, `zoneId?`, `maxConcurrentUnits`, `isActive`) -> `201`.
   - `PATCH /api/v1/hosts/capacity-pools/:poolId` (`L78`): `UpdateCapacityPoolRequestSchema` (`maxConcurrentUnits`, `isActive`) -> `200`.
2. **Existing Frontend Integration:** `marketplaceApi.getCapacityPools`, `createCapacityPool`, `updateCapacityPool` (`L235-259`) exist, **0 UI usage**.
3. **Required Frontend Integration:** Replace `HD-005` mock capacities & dead `"Configure Zone Limits"` button (`HostDashboardPages.tsx:1702`) with live pool table showing `maxConcurrentUnits`, `reservedUnits` (read-only live lock count), available headroom, and create/edit controls.
4. **Proposed (Not Yet Implemented):** Add `app.requirePermission("hosts.location.read_own")` on `GET` and `app.requirePermission("hosts.location.configure")` on `POST`/`PATCH`, plus fix `capacity.service.ts:34` write escalation (`SUPPORT` read-only vs write).
5. **Required Contract Changes:** None required.
6. **Authorization Requirements:** `HOST_OWNER` / `SUPERADMIN` write; `HOST_STAFF` read-only (for counter awareness).
7. **Persistence Expectations:** `storage_capacity_pools` with `reserved_units <= max_concurrent_units` invariant (cannot shrink below active `reserved_units`).
8. **Error Handling:** Surface `409`/`422` when host attempts to reduce `maxConcurrentUnits` below active `reservedUnits`.
9. **Testing Requirements:** Test creating pool -> updating `maxConcurrentUnits` -> attempting reduction below `reservedUnits` displays server error cleanly.

---

### 9. Pricing
1. **Confirmed Existing API Capabilities (`pricing.routes.ts:10-74`, [`pricing/index.ts`](file:///d:/luggage-storage/luggage-storage/packages/contracts/src/pricing/index.ts#L8-L67)):**
   - `GET /api/v1/hosts/locations/:locationId/pricing` (`L10`) -> `PricingPolicySchema`.
   - `PUT /api/v1/hosts/locations/:locationId/pricing` (`L43`): `ConfigurePricingPolicyRequestSchema` (`currency: "LKR"`, `pricingUnit: "CALENDAR_DAY" | "24_HOUR_BLOCK"`, `baseRateMinor` integer minor units, optional `tierRates` across `BAG_SMALL`, `BAG_MEDIUM`, `BAG_LARGE`, `BAG_OVERSIZED`) -> archives previous active policy cleanly and activates new policy.
2. **Existing Frontend Integration:** `marketplaceApi.getPricingPolicy` & `configurePricingPolicy` (`L265-296`) exist, **0 UI usage**. (`HD-006` uses fictional major-unit hourly/cap fields.)
3. **Required Frontend Integration:** Replace `HD-006` (`HostDashboardPages.tsx:1779-1914`) with a genuine `CALENDAR_DAY` / `24_HOUR_BLOCK` policy editor converting major LKR input <-> integer minor units (`lkr * 100`) cleanly, displaying exact tier multipliers (`8000`, `10000`, `12000`, `15000` bps) and clear platform fee disclosures (`15%` platform fee / `85%` host share).
4. **Proposed (Not Yet Implemented):** Add `app.requirePermission("hosts.location.read_own")` on `GET` and `app.requirePermission("hosts.location.configure")` on `PUT`; restrict `pricing.service.ts:34` writes to `HOST_OWNER` / `SUPERADMIN` (`SUPPORT` read-only or denied).
5. **Required Contract Changes:** None required.
6. **Authorization Requirements:** `HOST_OWNER` / `SUPERADMIN` only (`OQ-017` excludes `HOST_STAFF` from pricing edits).
7. **Persistence Expectations:** Versioned `pricing_policies` (`ACTIVE`/`ARCHIVED`) + `pricing_tier_rates`, preserving immutable historical `booking_pricing_snapshots`.
8. **Error Handling:** Reject non-positive rates cleanly via Zod before submission.
9. **Testing Requirements:** Test `PUT /pricing` updates active policy and subsequent `POST /bookings/quote` reflects updated minor-unit rates.

---

### 10. Discovery
1. **Confirmed Existing API Capabilities (`discovery.routes.ts:10-48`):**
   - `GET /api/v1/discovery/locations` (`L10`): Public PostGIS search (`latitude`, `longitude`, `radiusMeters`, `city`, `searchTerm`, `amenities`, `acceptsOversized`, `page`, `limit`) -> `{ locations: PublicStorageLocation[], pagination }`. Enforces `location.status === 'ACTIVE'` AND `business.status === 'ACTIVE'`, and rounds coarse coordinates to 2 decimal places (`~1.1km`, OQ-012).
   - `GET /api/v1/discovery/locations/:locationId` (`L27`): Public location profile -> `PublicStorageLocation`.
2. **Existing Frontend Integration:** `marketplaceApi.searchLocations` (`L355-376`, **omits `acceptsOversized`**) & `getPublicLocationDetails` (`L383-387`). Both `PW-002` and `PW-003` corrupt real results through `mapPublicLocationToItem` (`L95-140`), and `PW-001` does not call discovery at all.
3. **Required Frontend Integration:** Delete `mapPublicLocationToItem`; add `acceptsOversized` parameter to `marketplaceApi.searchLocations`; wire `PW-001` to live `useDiscoveryLocations({ limit: 3 })`; wire `PW-002` search box (`searchTerm`), amenity filters, `acceptsOversized`, and server sorting without falling back to `DEMO_LOCATIONS`; wire `PW-003` directly to live location detail without fabricated insurance/capacity/hourly rates.
4. **Proposed (Not Yet Implemented):**
   - **Extend `GET /api/v1/discovery/locations/:locationId` (`discovery.service.ts:218-313`):** Include non-sensitive weekly `openingHours` array, upcoming `exceptions` (next 30 days), active `pricingPolicy` (unit, `baseRateMinor`, bag category `tierRates`), and coarse `capacityOverview` (`acceptsOversized`, supported bag categories, `totalMaxConcurrentUnits` or simple `hasAvailablePools` boolean without leaking private internal rack structure) while preserving `OQ-012` address redaction. Also support optional `slug` resolution (`GET /discovery/locations/:idOrSlug`) if clean SEO slugs are kept.
   - Add `sortBy` (`distance | price_asc | price_desc`) support on `GET /discovery/locations`.
5. **Required Contract Changes:** Extend `PublicStorageLocationDetailSchema` & `SearchLocationsQuerySchema` (`sortBy`) in `packages/contracts/src/discovery/index.ts`.
6. **Authorization Requirements:** Public unauthenticated read; strictly returns `ACTIVE` locations of `ACTIVE` businesses and never leaks exact street address, entrance instructions, owner contact, or bank data.
7. **Persistence Expectations:** Read-only PostGIS spatial queries over `storage_locations`, `location_media`, `opening_hours`, `pricing_policies`.
8. **Error Handling:** `404` on inactive/draft/nonexistent location must show an honest "Location unavailable or removed" page on `PW-003`, never falling back to `DEMO_LOCATIONS[0]`.
9. **Testing Requirements:** Verify inactive/draft/unverified business locations never appear in `/search` or `/locations/:id`; verify zero fabricated insurance or capacity text appears in DOM.

---

### 11. Availability
1. **Confirmed Existing API Capabilities (`bookings.routes.ts:41-56`):**
   - `GET /api/v1/availability/search` (`L42`): Validates `AvailabilitySearchQuerySchema` (`city`, `searchTerm`, `dropOffAt`, `collectionAt`, `smallBags`, `mediumBags`, `largeBags`, `oversizedBags`, optional `latitude`/`longitude`/`radiusMeters`) -> returns candidate locations with live remaining pool capacity and pre-calculated server quotation.
2. **Existing Frontend Integration:** `marketplaceApi.searchAvailability` (`L389-407`) exists, **0 UI usage**.
3. **Required Frontend Integration:** When the traveller provides drop-off/collection timestamps and bag counts (from `PW-001` hero search or `PW-002` filter bar), call `GET /api/v1/availability/search` instead of `GET /api/v1/discovery/locations` so unavailable/closed/sold-out venues are accurately flagged or excluded and prices reflect real schedule totals!
4. **Proposed (Not Yet Implemented):** None required for core functionality (optional pagination support if inventory grows large).
5. **Required Contract Changes:** None required.
6. **Authorization Requirements:** Public read (`OQ-012` coarse location privacy maintained).
7. **Persistence Expectations:** Evaluates `opening_hours`, `opening_hours_exceptions`, and `storage_capacity_pools` (`max_concurrent_units - reserved_units` against overlapping active holds/bookings).
8. **Error Handling:** Validate `collectionAt > dropOffAt` before dispatching request; surface `400`/`422` schedule validation errors cleanly inline.
9. **Testing Requirements:** Integration test verifying closed-exception date or zero-capacity pool excludes/marks location unavailable in `/search`.

---

### 12. Quotations
1. **Confirmed Existing API Capabilities (`bookings.routes.ts:63-77`):**
   - `POST /api/v1/bookings/quote` (`L64`): Public `BookingQuoteRequestSchema` (`locationId`, `dropOffAt`, `collectionAt`, `items: [{ bagCategory, quantity }]`) -> `200` server-authoritative breakdown (`durationUnits`, `pricingUnit`, `lineItems`, `storageSubtotalMinor`, `oversizedFeeMinor`, `discountMinor`, `taxMinor`, `totalAmountMinor`, `currencyCode`, `available`). Note: strips internal `businessId`/`policyId`/`allocations` on line `74`.
2. **Existing Frontend Integration:** `marketplaceApi.quoteBooking` (`L413-419`) wired in `PW-004`, **but** called synchronously without debouncing (`PW-004` also falls back to client-side arithmetic for non-UUID routes).
3. **Required Frontend Integration:** Use debounced (`300ms`) TanStack Query (`useBookingQuote`) on both `PW-003` quick calculator and `PW-004` checkout; remove all frontend price multiplication fallback.
4. **Proposed (Not Yet Implemented):** None required.
5. **Required Contract Changes:** None required.
6. **Authorization Requirements:** Public read-only server computation.
7. **Persistence Expectations:** Stateless read against `pricing_policies`, `pricing_tier_rates`, `opening_hours`, `opening_hours_exceptions`, and `storage_capacity_pools`.
8. **Error Handling:** Handle `available: false` or `409`/`422` capacity/hours conflicts by disabling checkout submit and explaining why (closed day vs insufficient capacity).
9. **Testing Requirements:** Verify Web `PW-004` displayed total exactly equals `totalAmountMinor / 100` from `POST /bookings/quote`.

---

### 13. Bookings
1. **Confirmed Existing API Capabilities (`bookings.routes.ts:80-342`, `admin-phase-b.routes.ts:40-107`):**
   - `POST /api/v1/bookings` (`[authenticate, bookings.create]`): `CreateBookingRequestSchema` -> `201` (`PENDING_PAYMENT` for `INSTANT`, `PENDING_HOST_APPROVAL` for `REQUEST_TO_BOOK`). Locks pools `FOR UPDATE`, writes immutable `booking_pricing_snapshots`.
   - `GET /api/v1/bookings` (`[authenticate, bookings.read_own]`): Paginated list of traveller's bookings (`BookingListQuerySchema`).
   - `GET /api/v1/bookings/:bookingId` (`authenticate`): Full detail (`BookingDetailSchema`) with `OQ-012` exact address gated to `CONFIRMED`/`IN_STORAGE`/`COMPLETED`. **SECURITY DEFECT (`bookings.service.ts:481-483`): returns `commissionRateBps`, `platformCommissionMinor`, `hostPayableMinor` to `TRAVELLER` & `HOST_STAFF`.**
   - `POST /api/v1/bookings/:bookingId/cancel` (`[authenticate, bookings.cancel_own]`): Cancels & evaluates `OQ-009` refund policy (`100%` / `50%` / `0%`).
   - `GET /api/v1/hosts/bookings` (`[authenticate, hosts.bookings.read_own]`): Scoped to owned or `host_staff_memberships` locations (`search`, `status`, `locationId`, `page`, `limit`).
   - `GET /api/v1/hosts/bookings/:bookingId` (`[authenticate, hosts.bookings.read_own]`): Single host booking detail.
   - `POST /api/v1/hosts/bookings/:bookingId/accept` (`[authenticate, hosts.bookings.manage_own]`): Opens 10-minute traveller payment window.
   - `POST /api/v1/hosts/bookings/:bookingId/reject` (`[authenticate, hosts.bookings.manage_own]`): Rejects request and releases capacity.
   - `POST /api/v1/hosts/bookings/:bookingId/cancel` (`[authenticate, hosts.bookings.manage_own]`): Host cancel with 100% traveller refund if captured.
   - `GET /api/v1/admin/bookings` (`admin.booking.read`), `GET /api/v1/admin/bookings/:bookingId` (`admin.booking.read`), `POST /api/v1/admin/bookings/:bookingId/cancel` (`admin.booking.manage`).
2. **Existing Frontend Integration:** `marketplaceApi` wraps traveller/host/admin booking endpoints **except `getHostBookingDetail` (`GET /hosts/bookings/:bookingId`)**. Critical Web defects: `PW-011` maps `PENDING_PAYMENT -> "CONFIRMED"` (`L3037`); `HD-007` maps `PENDING_PAYMENT`/`DISPUTED` -> `"CONFIRMED"` (`L70-84`); both fall back to `DEMO_BOOKINGS`; `AD-005` exposes Admin Cancel to `SUPPORT`.
3. **Required Frontend Integration:** Protect `/portal/bookings` and `/booking/confirm` via `ProtectedRoute`; remove `DEMO_BOOKINGS` fallbacks; map every `BookingStatus` 1:1; add `getHostBookingDetail`; gate `AD-005` Admin Cancel strictly to `hasPermission("admin.booking.manage")`; wire search/status/location filters on `HD-007` and `AD-005`.
4. **Proposed (Not Yet Implemented):**
   - **SECURITY FIX (`bookings.service.ts:481-483`):** Redact `commissionRateBps`, `platformCommissionMinor`, and `hostPayableMinor` (set to `null` or omit) when requester is a `TRAVELLER` or `HOST_STAFF` (`BR-095` / `OQ-017`).
   - Add downloadable structured receipt/invoice data endpoint (`GET /bookings/:bookingId/receipt`) or generate client receipt from authoritative `booking_pricing_snapshots` (subject to `OQ-010` tax counsel approval before branding as "Tax/VAT Invoice").
5. **Required Contract Changes:** Make financial split fields nullable/optional on `BookingPricingSnapshotSchema` (`packages/contracts/src/bookings/index.ts`) for traveller/staff serialization.
6. **Authorization Requirements:** Enforce owner/host/staff/admin scope on every read/mutation; `SUPPORT` read-only on admin bookings (`admin.booking.read`, no cancel button).
7. **Persistence Expectations:** Serializable transactions on capacity release, immutable `booking_status_history` rows.
8. **Error Handling:** `409 Conflict` when hold expired or already transitioned (`PENDING_PAYMENT` timeout).
9. **Testing Requirements:** Verify `GET /bookings/:id` omits commission fields for `TRAVELLER` and `HOST_STAFF`; verify `PENDING_PAYMENT` booking displays `"Awaiting Payment"` and `"Complete Payment"` button on Web.

---

### 14. Payments
1. **Confirmed Existing API Capabilities (`payments.routes.ts:33-186`):**
   - `POST /api/v1/payments/intents` (`[authenticate, bookings.create]`): Creates channel-isolated (`WEB` -> `DIRECT_POST`) intent with PayHere MD5 `hash` and `checkoutFields` (`idempotencyKey` enforced).
   - `GET /api/v1/payments/handoff/:handoffToken` (`L55`): Permanently `410 GONE` (retired bridge).
   - `GET /api/v1/payments/checkout-status` (`[authenticate, bookings.read_own]`): Authoritative read-only status for return/cancel polling.
   - `POST /api/v1/payments/intents/:intentId/sandbox-simulate` (`[authenticate, bookings.create]`): Non-prod only (`403` in production).
   - `POST /api/v1/payments/webhooks/sandbox` & `POST /api/v1/payments/webhooks/payhere`: HMAC / PayHere `md5sig` verified server-to-server webhooks; auto-refunds late captures on expired/cancelled bookings.
2. **Existing Frontend Integration:** Live UUID flow in `PW-004` + [`payment-handoff.ts`](file:///d:/luggage-storage/luggage-storage/apps/web/src/lib/payment-handoff.ts) + `PW-005` works well; `AD-006` (`GET /admin/payments/transactions`, [`admin-phase-b.routes.ts:132-155`](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/admin/admin-phase-b.routes.ts#L132-L155)) works partially (no pagination/filter, blocks `SUPPORT`, falls back to fake data).
3. **Required Frontend Integration:** Enforce `ProtectedRoute` on `/booking/confirm` & PayHere return routes; prefill PayHere customer fields from authenticated profile; remove `DEMO_BOOKINGS` fallback on `AD-006`; enable `SUPPORT` read-only access via `hasPermission("admin.payment.read")`; wire pagination & `bookingId` filter on `AD-006`.
4. **Proposed (Not Yet Implemented):** Fix typo in `payments.service.ts:595` (`["CONFIRMED", "IN_STORAGE"].includes(booking.status)` — remove `"CHECKED_IN"` which is a `CustodyStatus`, not a `BookingStatus`).
5. **Required Contract Changes:** None required.
6. **Authorization Requirements:** Payment intents scoped strictly to booking owner (`travellerUserId === userId`); `/admin/payments/transactions` accessible to `SUPPORT` + `SUPERADMIN` via `admin.payment.read`.
7. **Persistence Expectations:** `payment_intents`, `payment_webhook_events`, `payment_transactions`, double-entry `journal_entries`.
8. **Error Handling:** Handle expired 10-minute payment holds (`409` / `GONE`) cleanly with "Hold expired — create a new booking" CTA instead of stale form retry.
9. **Testing Requirements:** Verify PayHere return URL without auth redirects to login (saving return target), and `AD-006` renders empty state instead of fake bookings when `transactions = []`.

---

### 15. Refunds
1. **Confirmed Existing API Capabilities (`admin-phase-b.routes.ts:158-197`):**
   - `GET /api/v1/admin/refunds` (`[authenticate, admin.refund.read]`): Paginated refund records (`status`, `bookingId`, `page`, `limit`).
   - `POST /api/v1/admin/refunds/:refundId/transition` (`[authenticate, admin.refund.manage]`): `AdminTransitionRefundRequestSchema` (`targetStatus` in `REFUND_STATUSES`: `REQUESTED, AUTHORIZED, INITIATED, PROCESSING, MANUAL_REVIEW_REQUIRED, SUCCEEDED, FAILED`, `gatewayRefundReference`, `failureReason`, `evidenceNotes`). `SUCCEEDED` posts ledger `2030 REFUND_LIABILITY` DEBIT / `1010 PLATFORM_CLEARING_RECEIVABLE` CREDIT.
2. **Existing Frontend Integration:** `AD-007` wraps both endpoints, **but**: `AdminDashboardLayout:83` blocks `SUPPORT` (`admin.refund.read`); `nextRefundStage` (`L900-915`) only supports linear forward steps (cannot transition to `FAILED` or recover `MANUAL_REVIEW_REQUIRED`); falls back to fake `#RFD-8799` when empty; `PW-011` displays wrong refund amount (`totalAmountLkr`) and wrong stage labels.
3. **Required Frontend Integration:** Allow `SUPPORT` read-only viewing on `AD-007` (`admin.refund.read`) while gating mutation controls to `admin.refund.manage`; replace linear `nextRefundStage` with state-machine transition selector allowing valid target statuses (`SUCCEEDED`, `FAILED`, `MANUAL_REVIEW_REQUIRED`); display real `refundSummary.amountMinor` & `REFUND_STATUSES` timeline in `PW-011`; remove empty-list mock fallback.
4. **Proposed (Not Yet Implemented):** None required in backend state machine (already supports all 7 stages and manual portal settlement per `OQ-013`).
5. **Required Contract Changes:** None required.
6. **Authorization Requirements:** `SUPPORT` = `admin.refund.read` only; `SUPERADMIN` = `admin.refund.manage`.
7. **Persistence Expectations:** `refund_records`, `journal_entries`, `security_audit_events`.
8. **Error Handling:** Display invalid state transition errors (`409`/`422`) and missing settlement reference validation inline.
9. **Testing Requirements:** Test transitioning refund to `MANUAL_REVIEW_REQUIRED` -> `SUCCEEDED` -> verify `journal_entries` balance and Web `PW-011` reflects `"SUCCEEDED"` with exact minor-unit refund total.

---

### 16. Custody
1. **Confirmed Existing API Capabilities (`bookings.routes.ts:196-217`, `custody.routes.ts:33-125`, `admin-phase-b.routes.ts:110-129`):**
   - `POST /api/v1/bookings/:bookingId/custody-pass` (`bookings.routes.ts:197`, `bookings.read_own`): Issues 15-minute single-use `qrToken` (64-char hex) + 6-digit `verificationPin` (`CHECK_IN` or `COLLECTION`).
   - `POST /api/v1/hosts/custody/verify` (`custody.routes.ts:34`, `hosts.custody.operate`): Pre-verifies QR token or 6-digit PIN without consuming token (5-attempt lockout).
   - `GET /api/v1/hosts/custody/:bookingId` (`L57`, `hosts.custody.operate`): Returns `CustodyRecordDetailSchema` (`bags`, `events`).
   - `POST /api/v1/hosts/custody/:bookingId/check-in` (`L79`, `hosts.custody.operate`): Consumes `CHECK_IN` token, verifies `bags.length === expectedBagCount`, records tags/seals/zone/photos -> transitions booking to `IN_STORAGE`.
   - `POST /api/v1/hosts/custody/:bookingId/check-out` (`L104`, `hosts.custody.operate`): Consumes `COLLECTION` token, enforces **OQ-015 Zero Possessory Lien** (never blocks overdue physical release), releases capacity pool; transitions booking to `COMPLETED` (+ ledger 85%/15% split + `host_payables ELIGIBLE`) OR `DISPUTED` if `exceptionNotes` is non-empty or bag discrepancy exists!
   - `GET /api/v1/admin/bookings/:bookingId/custody` (`admin-phase-b.routes.ts:111`, `admin.booking.read`): Admin/Support custody inspection.
2. **Existing Frontend Integration:** All 6 endpoints wrapped in `marketplaceApi`, **with two critical defects**:
   - Web renders static `lucide-react` `<QrCode />` icon (`PublicMarketplacePages.tsx:2263, 2379, 3483`) instead of encoding `issuedPass.qrToken`.
   - `HD-009` (`HostDashboardPages.tsx:2387`) hardcodes `exceptionNotes: "Released via Host Counter Web Desk"` on `completeCollection`, forcing every Web checkout into `DISPUTED` (`custody.service.ts:747-757`)! Also `HD-009` runs a fake `setTimeout` (`L2405-2413`) whenever a human `LS-*` reference is entered instead of a UUID (`L2345`).
3. **Required Frontend Integration:**
   - Install `qrcode` (or `qrcode.react`) and encode actual `issuedPass.qrToken` into a scannable QR code on `PW-005` & `PW-011`, plus add `"Regenerate QR/PIN Pass"` button on `PW-005`.
   - **Fix `HD-009`:** Omit `exceptionNotes` on normal release (send only if staff checks `"Report Release Discrepancy / Damage"`), support lookup by `LS-*` `referenceCode` via `GET /hosts/bookings?search=...`, read `?ref=&mode=` query parameters, populate storage zone selector from `getLocationById`, and allow per-bag tag/category/seal editing.
4. **Proposed (Not Yet Implemented):** Add `"CUSTODY_EVIDENCE"` to `UPLOAD_PURPOSES` (`packages/contracts/src/uploads/index.ts:8` & `uploads.service.ts:49-115`) so host check-in photo evidence (`photoFileKey` in `BagCustodyItemInputSchema`) can be uploaded cleanly to R2. Also guard `custody.service.ts` against treating whitespace-only `exceptionNotes` as discrepancy (secondary defense alongside Web fix).
5. **Required Contract Changes:** Extend `UPLOAD_PURPOSES` in `packages/contracts/src/uploads/index.ts`.
6. **Authorization Requirements:** `HOST_OWNER` & `HOST_STAFF` (`hosts.custody.operate` + `assertHostLocationAccess`); traveller owns pass generation (`travellerUserId === userId`).
7. **Persistence Expectations:** Serializable transactions; SHA-256 token hashing; immutable `custody_events`.
8. **Error Handling:** Show remaining PIN attempts on failure and clear lockout guidance after 5 failures (`429`/`403` -> ask traveller to regenerate pass).
9. **Testing Requirements:** **Mandatory regression test:** Clean Web check-out via `HD-009` sends `exceptionNotes: undefined` -> DB `bookings.status === "COMPLETED"`, `custody_records.status === "RELEASED_TO_TRAVELLER"`, `host_payables.status === "ELIGIBLE"`, and ledger split posted!

---

### 17. Incidents (Booking Exceptions & Disputes)
1. **Confirmed Existing API Capabilities (`bookings.routes.ts:171-193`, `admin-phase-b.routes.ts:40-107`):**
   - `POST /api/v1/bookings/:bookingId/exceptions` (`authenticate`): Validates `RecordBookingExceptionRequestSchema` (`exceptionType`, `description`) -> transitions booking to `DISPUTED`, logs `booking_status_history` & `custody_events`, sets `host_payables` to `ON_HOLD`.
   - `GET /api/v1/admin/bookings?status=DISPUTED` (`admin.booking.read`) & `POST /api/v1/admin/bookings/:bookingId/cancel` (`admin.booking.manage` — 100% traveller refund).
2. **Existing Frontend Integration:** `marketplaceApi.reportBookingException` (`L461-470`) has **zero UI anywhere** (`PW-011`, `HD-008`, `HD-009`); `AD-013` (`/admin/incidents`) renders only a static placeholder ignoring live `DISPUTED` bookings.
3. **Required Frontend Integration:** Add `"Report Problem / Exception"` modal on `PW-011` & `HD-008`; wire `AD-013` (`AdminDashboardPages.tsx:1412-1439`) to live `GET /admin/bookings?status=DISPUTED` + custody detail drawer.
4. **Proposed (Not Yet Implemented):** Add `POST /api/v1/admin/bookings/:bookingId/resolve-dispute` (`[authenticate, admin.booking.manage]`) supporting outcomes: `RELEASE_TO_HOST` (`DISPUTED -> COMPLETED`, posts 85%/15% ledger split & releases `host_payables ON_HOLD -> ELIGIBLE`) or `REFUND_TRAVELLER` (full/partial refund + ledger reversal).
5. **Required Contract Changes:** `ResolveDisputeRequestSchema` & `ResolveDisputeResponseSchema` in `packages/contracts/src/bookings/index.ts`.
6. **Authorization Requirements:** Participants (`TRAVELLER` owner, `HOST_OWNER`, assigned `HOST_STAFF`) + `SUPERADMIN` may file exceptions; only `SUPERADMIN` may adjudicate `DISPUTED` resolution (`OQ-016`).
7. **Persistence Expectations:** Transactional booking + custody event + `host_payables` + `journal_entries` + audit log.
8. **Error Handling:** Prevent duplicate resolution on terminal bookings (`409`).
9. **Testing Requirements:** Integration test filing traveller exception -> verifying `host_payables` moves to `ON_HOLD` -> admin resolving dispute.

---

### 18. Finance (Host Payables, Ledger & Payouts)
1. **Confirmed Existing API Capabilities (`bookings.routes.ts:345-366`, `admin-phase-b.routes.ts:200-215`):**
   - `GET /api/v1/hosts/finance/summary` (`[authenticate, hosts.finance.read_own]`): `HOST_OWNER` / `SUPERADMIN` only (`OQ-017`) -> returns totals (`ACCRUED`, `ELIGIBLE`, `ON_HOLD`, `PAID` in integer minor units) + `payables[]`.
   - `GET /api/v1/admin/finance/ledger` (`[authenticate, admin.financial.manage]`): Double-entry `journal_entries` + `journal_lines` + proof of balanced debits == credits.
2. **Existing Frontend Integration:** `HD-010` wraps `getHostFinanceSummary` **but leaks mock LKR 217,058 / `DEMO_BOOKINGS` when `payables.length === 0`** and fakes CSV export; `HD-011` (`getBusinessPayoutDetails`) is unwired; `AD-010` wraps `getAdminLedger` **but shows mock `JRN-901..903` when empty** and omits filters; `AD-008` & `AD-009` show `DeferredBackendNotice`.
3. **Required Frontend Integration:** Remove all fake fallback metrics in `HD-010` & `AD-010` (show honest LKR 0.00 / empty ledger message); implement real client-side RFC-4180 CSV download of live `payables` rows in `HD-010`; wire `HD-011` to `getBusinessPayoutDetails` + `updateBusiness`; add `entryType` / `bookingId` / date filters to `AD-010`.
4. **Proposed (Not Yet Implemented):**
   - Fix `ledger.service.ts:413` stale JWT check (`verify DB host_businesses owner OR user_roles` for newly onboarded hosts).
   - **For `AD-008` & `AD-009` (MVP Host Settlement):** Create `payout_batches` & `payout_disbursements` schema/migrations and register:
     - `GET /api/v1/admin/payouts/eligible-payables` (`admin.financial.manage`)
     - `POST /api/v1/admin/payouts/batches` (`admin.financial.manage`) — locks selected `ELIGIBLE` `host_payables` into a batch
     - `POST /api/v1/admin/payouts/batches/:batchId/mark-paid` (`admin.financial.manage`) — records bank transfer reference, moves `host_payables` `ELIGIBLE -> PAID`, and posts ledger `2020 HOST_PAYABLE_LIABILITY` DEBIT / `1020 BANK_PAYOUT_CLEARING` CREDIT.
     - Expose `GET /api/v1/hosts/payouts` (`hosts.finance.read_own`) for `HD-011` real disbursement statements.
5. **Required Contract Changes:** `PayoutBatchSchema`, `CreatePayoutBatchRequestSchema`, `MarkPayoutBatchPaidRequestSchema` in `packages/contracts/src/finance/index.ts`.
6. **Authorization Requirements:** Strict `HOST_OWNER` (`hosts.finance.read_own`, zero `HOST_STAFF` access per `OQ-017`) and `SUPERADMIN` (`admin.financial.manage`).
7. **Persistence Expectations:** Double-entry `SUM(debit) === SUM(credit)` invariant enforced on every settlement entry.
8. **Error Handling:** Prevent double-batching an already batched/paid payable (`409` under `SELECT ... FOR UPDATE`).
9. **Testing Requirements:** Verify batching + marking paid keeps trial balance = `0` and transitions host `HD-010`/`HD-011` balances from `ELIGIBLE` to `PAID`.

---

### 19. Administration (Users & Platform Command Metrics)
1. **Confirmed Existing API Capabilities (`admin.routes.ts:40-360`):**
   - `GET /api/v1/admin/users` (`admin.user.read`): Paginated (`page`, `limit`), filterable (`status`, `search`, `role`).
   - `GET /api/v1/admin/users/:userId` (`admin.user.read`): Comprehensive user detail (never exposes password hashes).
   - `POST /api/v1/admin/users/:userId/suspend` (`admin.user.suspend`, `reason`): Suspends & revokes all active `auth_sessions`.
   - `POST /api/v1/admin/users/:userId/reinstate` (`admin.user.reinstate`): `SUSPENDED -> ACTIVE`.
   - `POST /api/v1/admin/users/:userId/deactivate` (`admin.user.deactivate`, `reason`) & `.../reactivate` (`admin.user.reactivate`).
   - `POST /api/v1/admin/users/:userId/verify-email` (`admin.user.verify_email`): Admin override email verification.
2. **Existing Frontend Integration:** **ZERO Web integration.** Neither `auth-api.ts` nor `marketplace-api.ts` wraps any of these 7 routes, and `AD-018` (`AdminDashboardPages.tsx:1674-1698`) is a 2-line static notice.
3. **Required Frontend Integration:** Add all 7 client methods in `auth-api.ts` (or `admin-api.ts`) + TanStack Query hooks; build a complete User Management tab inside `AD-018` (`/admin/staff` or `/admin/users`) with search, status/role filters, pagination, user detail drawer, and audited confirmation modals requiring reasons for suspend/deactivate; ensure `SUPPORT` gets read-only `GET /admin/users*` (`admin.user.read`) without mutation buttons.
4. **Proposed (Not Yet Implemented):**
   - `GET /api/v1/admin/metrics/summary` (`[authenticate, requirePermission("admin.booking.read")]` / role-tailored response for `SUPERADMIN` vs `SUPPORT`): Live aggregates replacing `AD-001` hardcoded `LKR 4,280,000` GMV (counts of active locations, pending KYCs, pending location reviews, active/disputed bookings, open refunds; financial totals gated to `admin.financial.manage`).
5. **Required Contract Changes:** `AdminMetricsSummaryResponseSchema` in `packages/contracts/src/admin/index.ts`.
6. **Authorization Requirements:** `SUPPORT` holds `admin.user.read` only; lifecycle mutations strictly restricted to `SUPERADMIN` permissions; self-suspension / last-Superadmin guard enforced in `admin.service.ts`.
7. **Persistence Expectations:** Immediate `auth_sessions` revocation on suspend/deactivate + audit log entry.
8. **Error Handling:** Surface `403` last-Superadmin protection message clearly in modal without closing drawer.
9. **Testing Requirements:** Playwright/Vitest test suspending a test user from `AD-018` and verifying their active session fails `refresh` with `401`.

---

### 20. RBAC (Roles, Permissions & Host Staff)
1. **Confirmed Existing API Capabilities (`admin.routes.ts:365-543`):**
   - `GET /api/v1/admin/roles` (`admin.role.read`): Returns all 5 roles (`TRAVELLER`, `HOST_OWNER`, `HOST_STAFF`, `SUPPORT`, `SUPERADMIN`) and their mapped permission codes.
   - `GET /api/v1/admin/permissions` (`admin.permission.read`): Returns full permission catalogue.
   - `GET /api/v1/admin/users/:userId/permissions` (`admin.role.read`): Effective roles & permissions for target user.
   - `POST /api/v1/admin/users/:userId/roles` (`admin.role.assign`, `{ roleCode }`) & `DELETE /api/v1/admin/users/:userId/roles/:roleCode` (`admin.role.revoke`): Assign/revoke roles with last-Superadmin protection and immediate permission DB evaluation.
2. **Existing Frontend Integration:** **ZERO Web integration.** All 5 endpoints are absent from `apps/web/src/services/`, and `HD-013` (`/host/staff`) is 100% static mock data.
3. **Required Frontend Integration:** Build Role & Permission Matrix + User Role Assignment UI in `AD-018` (`AdminDashboardPages.tsx:1674`); fix `HostDashboardLayout` nav matching (`L188-214`) using exact/specificity ordering + `PermissionGate`; fix `AdminDashboardLayout` (`L77-94`) to align `AD-001`–`AD-018` access with actual backend permissions (`admin.host.read`, `admin.location.read`, `admin.payment.read`, `admin.refund.read` for `SUPPORT`) and route `SUPPORT` to `/admin/bookings` or `/admin/support` instead of blocked `AD-001`.
4. **Proposed (Not Yet Implemented):**
   - **Sync `packages/contracts/src/rbac/index.ts:15-75`:** Export all 12 Phase B permissions from `0012_phase_b_booking_escrow_custody.sql` inside `SYSTEM_PERMISSIONS` (`BOOKINGS_CREATE`, `BOOKINGS_READ_OWN`, `BOOKINGS_CANCEL_OWN`, `HOSTS_BOOKINGS_READ_OWN`, `HOSTS_BOOKINGS_MANAGE_OWN`, `HOSTS_CUSTODY_OPERATE`, `HOSTS_FINANCE_READ_OWN`, `ADMIN_BOOKING_READ`, `ADMIN_BOOKING_MANAGE`, `ADMIN_PAYMENT_READ`, `ADMIN_REFUND_READ`, `ADMIN_REFUND_MANAGE`).
   - **Host Staff Management API (`HD-013`) over existing `host_staff_memberships` table:**
     - `GET /api/v1/hosts/businesses/:businessId/staff` (`HOST_OWNER`)
     - `POST /api/v1/hosts/businesses/:businessId/staff` (`HOST_OWNER` — assigns verified existing user or sends staff invite scoped to `locationId`, granting `HOST_STAFF` role cleanly)
     - `PATCH` / `DELETE /api/v1/hosts/businesses/:businessId/staff/:membershipId` (`HOST_OWNER` — revokes membership & `HOST_STAFF` role if no active memberships remain).
5. **Required Contract Changes:** Extend `SYSTEM_PERMISSIONS` (`rbac/index.ts`) + add host staff assignment/update schemas in `hosts/index.ts`.
6. **Authorization Requirements:** Only `SUPERADMIN` may grant/revoke `SUPERADMIN` or `SUPPORT`; only `HOST_OWNER` may manage staff for locations they own; `HOST_STAFF` barred from `HD-003`–`HD-006`, `HD-010`, `HD-011`, `HD-013`, `HD-014`.
7. **Persistence Expectations:** `user_roles`, `host_staff_memberships`, `security_audit_events`.
8. **Error Handling:** Prevent removing last `SUPERADMIN` (`400`/`409`) and prevent host from granting `HOST_OWNER` via staff endpoint.
9. **Testing Requirements:** Verify `HOST_STAFF` user cannot hit `HD-003`–`HD-006` in Web router OR mutate locations/pricing on API (`403`), and `AD-018` role grant/revoke updates user permissions in DB.

---

### 21. Audit
1. **Confirmed Existing API Capabilities (`admin.routes.ts:548-636`):**
   - `GET /api/v1/admin/audit-events` (`admin.audit.read` — `SUPERADMIN` only): Supports `page`, `limit`, `eventType`, `userId`, `from`, `to` via `createPaginatedResponse`.
   - `GET /api/v1/admin/audit-events/:eventId` (`admin.audit.read`): Single immutable `security_audit_events` row with full `metadata`, `ipAddress`, `userAgent`.
2. **Existing Frontend Integration:** `authApi.listAdminAuditEvents` (`auth-api.ts:169-185`) **discards `res.pagination`** and omits `from`/`to`/`userId`; `AD-017` (`AdminDashboardPages.tsx:1557-1670`) only lists 7 of 67 event types, never calls `:eventId`, and renders fake audit lines during loading or 0 results.
3. **Required Frontend Integration:** Return `{ items, pagination }` from `listAdminAuditEvents`, add `getAdminAuditEventById`, expose full `SecurityEventType` filter dropdown + date range + user UUID search + pagination controls + JSON metadata inspection drawer in `AD-017`, and render honest empty state when filters return 0 records.
4. **Proposed (Not Yet Implemented):** None required in backend (already PostgreSQL trigger-protected append-only log with 67 `SecurityEventType` codes).
5. **Required Contract Changes:** None required.
6. **Authorization Requirements:** Strictly `admin.audit.read` (`SUPERADMIN` only).
7. **Persistence Expectations:** Trigger prevents `UPDATE`/`DELETE` on `security_audit_events`.
8. **Error Handling:** Display explicit API failure notice instead of fallback sample logs.
9. **Testing Requirements:** Filter by `CUSTODY_CHECKED_OUT` -> paginate -> open detail drawer -> verify metadata matches persisted action.

---

### 22. Support (`PW-009`, `AD-011`, `AD-012`)
1. **Confirmed Existing API Capabilities:** **NONE.** Only permission codes `support.ticket.read` and `support.ticket.update` exist in seed data (`rbac/index.ts:48-49`). Zero DB tables or HTTP routes exist.
2. **Existing Frontend Integration:** `PW-009` (`ContactUsPage.tsx:2795-2822`) fakes local submission `#TKT-COL-2026-441`; `AD-011` & `AD-012` (`AdminDashboardPages.tsx:1351-1408`) render static prototype links (`TKT-9042`).
3. **Required Frontend Integration:** Wire `PW-009` contact submission, Traveller/Host "My Support Tickets" view (or confirmation ID), and `AD-011`/`AD-012` triage queue & threaded reply workspace once backend endpoints below are built. (Until built, replace fake `#TKT-COL-2026-441` success banner with an honest fallback `mailto:support@luggagestorage.lk` or feature-gated notice so users are never misled.)
4. **Proposed (Not Yet Implemented):**
   - DB tables: `support_tickets` (`id`, `ticketNumber`, `requesterUserId?`, `requesterEmail`, `bookingId?`, `category`, `priority`, `status`, `subject`, `assignedToUserId?`, `createdAt`, `updatedAt`) + `support_ticket_messages` (`id`, `ticketId`, `authorUserId?`, `authorRole`, `isInternalNote`, `body`, `createdAt`).
   - Routes: `POST /api/v1/support/tickets` (Public/Auth rate-limited intake), `GET /api/v1/support/tickets/me` (`authenticate`), `GET /api/v1/admin/support/tickets` (`support.ticket.read`), `GET /api/v1/admin/support/tickets/:ticketId` (`support.ticket.read`), `POST /api/v1/admin/support/tickets/:ticketId/messages` (`support.ticket.update`), `PATCH /api/v1/admin/support/tickets/:ticketId` (`support.ticket.update` status/assignee).
5. **Required Contract Changes:** New `packages/contracts/src/support/index.ts` schemas.
6. **Authorization Requirements:** Public submission rate-limited; `SUPPORT` & `SUPERADMIN` triage; internal agent notes stripped from requester responses.
7. **Persistence Expectations:** PostgreSQL persistence + Zoho SMTP acknowledgement email.
8. **Error Handling:** Spam/rate-limit `429` feedback on contact form.
9. **Testing Requirements:** Submit ticket on `PW-009` -> triage & reply in `AD-011`/`AD-012` -> verify DB persistence.

---

### 23. Reviews (`PW-002`, `PW-003`, `HD-012`, `AD-014`)
1. **Confirmed Existing API Capabilities:** **NONE.** `discovery.service.ts:200, 307` hardcodes `averageRating: null, reviewCount: 0` with no `reviews` table or endpoints.
2. **Existing Frontend Integration:** `PW-002`/`PW-003` display `New Partner (0 reviews)` cleanly when null, while `HD-012` (`HostDashboardPages.tsx:3054-3192`) shows 100% synthetic reviews & fake reply toast, and `AD-014` (`AdminDashboardPages.tsx:1443`) shows `DeferredBackendNotice`.
3. **Required Frontend Integration:** Remove synthetic reviews from `HD-012` (render clean `Feature Unavailable / Post-MVP` state or wire if backend built); do not display synthetic star ratings in `PW-002`/`PW-003`.
4. **Proposed (Not Yet Implemented — Post-Core / Feature-Gated):** If included in launch scope, add `location_reviews` table (unique per `COMPLETED` booking), `POST /bookings/:bookingId/review`, `GET /discovery/locations/:locationId/reviews`, `POST /hosts/reviews/:reviewId/reply`, `GET/POST /admin/reviews` moderation. Recommendation: **Defer cleanly via feature flag** in Initiative 6 so core marketplace launch is not blocked.
5. **Required Contract Changes:** Only if un-deferred (`packages/contracts/src/reviews/index.ts`).
6. **Authorization Requirements:** Strictly verified `COMPLETED` booking holder (`bookings.read_own`).
7. **Persistence Expectations:** Recomputed aggregate rating cached/queried safely on `storage_locations`.
8. **Error Handling:** One review per completed booking (`409 Conflict`).
9. **Testing Requirements:** Verify zero synthetic ratings (`4.9`, `128 reviews`) ever appear on live locations.

---

### 24. Promotions (`PW-004`, `AD-015`)
1. **Confirmed Existing API Capabilities:** **NONE.** Only `discount_minor = 0` placeholder exists in `booking_pricing_snapshots` (`bookings.ts:211`).
2. **Existing Frontend Integration:** `AD-015` shows `DeferredBackendNotice`. `PW-004` does not collect promo codes.
3. **Required Frontend Integration:** Keep hidden behind feature flag (`VITE_FEATURE_PROMOTIONS=false`) until Promo Engine is built; remove any misleading hardcoded promo percentages from landing copy.
4. **Proposed (Not Yet Implemented — Post-Core / Feature-Gated):** `promotions` & `promotion_redemptions` tables + optional `promoCode` field in `BookingQuoteRequestSchema` / `CreateBookingRequestSchema` + `admin.platform.manage` CRUD endpoints.
5. **Required Contract Changes:** Only when activated.
6. **Authorization Requirements:** Server-side validation of promo eligibility & redemption limits inside booking creation transaction (`FOR UPDATE`); `SUPERADMIN` management only.
7. **Persistence Expectations:** Atomic redemption count increment on capture / release on cancel/expiry.
8. **Error Handling:** Inline invalid/expired promo rejection in `POST /bookings/quote`.
9. **Testing Requirements:** Confirm `discountMinor` in live Web quotes remains strictly server-derived (`0` until promo module activates).

---

### 25. Platform Settings (`AD-016`)
1. **Confirmed Existing API Capabilities:** **NONE.** Only `admin.platform.manage` permission is seeded (`rbac/index.ts:43`), while commission bps (`1500`) and grace minutes (`30`) are compile-time constants (`packages/contracts/src/bookings/index.ts:40`, `custody.service.ts`).
2. **Existing Frontend Integration:** `AD-016` (`AdminDashboardPages.tsx:1485-1553`) renders stateful `<select>`/`<input>` controls with **no Save button and no persistence** — misleading admins into thinking platform settings exist or save.
3. **Required Frontend Integration:** Replace interactive mock controls with a read-only **"Active System Policy Constants"** display reflecting authoritative backend constants (`15% / 1500 bps` platform fee, `30 min` grace window, `LKR` minor-unit billing, `10 min` payment hold TTL, `15 min` custody pass TTL) until `platform_settings` is implemented.
4. **Proposed (Not Yet Implemented — Post-Core / Feature-Gated):** `platform_settings` key/value audited table + `GET/PATCH /api/v1/admin/settings` (`admin.platform.manage`) overriding hardcoded commission/grace defaults cleanly.
5. **Required Contract Changes:** Only if runtime config overrides are promoted to MVP.
6. **Authorization Requirements:** `SUPERADMIN` (`admin.platform.manage`) only; every mutation logged to `security_audit_events`.
7. **Persistence Expectations:** Snapshot current fee rates onto each booking (`booking_pricing_snapshots`) so mid-flight changes never alter historical bookings.
8. **Error Handling:** Range-bound validation (`commissionRateBps <= 5000`).
9. **Testing Requirements:** Verify `AD-016` never pretends unsaved dropdown selections are persisted platform rules.

