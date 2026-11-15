# Initiative 1 — RBAC, Ownership & Financial Privacy Matrix

> **Branch:** `feature/initiative-1-foundation-hardening`  
> **Contracts Permissions:** [packages/contracts/src/rbac/index.ts](file:///d:/luggage-storage/luggage-storage/packages/contracts/src/rbac/index.ts)  
> **API Access Helper:** [apps/api/src/modules/bookings/host-access.helper.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/bookings/host-access.helper.ts)

---

## 1. Backend API Permission & Ownership Enforcement Matrix

All authenticated API requests resolve `request.user.roles` live from PostgreSQL in [app.ts](file:///d:/luggage-storage/luggage-storage/apps/api/src/app.ts) via `rbacService.getUserRoles(request.user.sub)`, preventing stale JWT role drift after business creation or role changes.

| Domain & Endpoint | Permission Guard (`requirePermission` / `requireAnyPermission`) | Ownership / Role Enforcement in Service | Permitted Actors | Explicitly Blocked Actors |
| --- | --- | --- | --- | --- |
| **Host Businesses** | | | | |
| `POST /api/v1/hosts/businesses` | `app.authenticate` (self-onboarding endpoint; mints business & assigns `HOST_OWNER`) | Self-assigns `HOST_OWNER` via database verification | Authenticated user (`TRAVELLER` onboarding) | Unauthenticated |
| `GET /api/v1/hosts/businesses` | `HOSTS_BUSINESS_READ_OWN` | Returns owned businesses for caller | `HOST_OWNER`, `SUPERADMIN` | `TRAVELLER`, `HOST_STAFF` |
| `GET /api/v1/hosts/businesses/:businessId` | `HOSTS_BUSINESS_READ_OWN` or admin read | Business owner, `SUPERADMIN`, or read-only `SUPPORT` | Owning `HOST_OWNER`, `SUPPORT` (read), `SUPERADMIN` | Other `HOST_OWNER`, `TRAVELLER` |
| `PATCH /api/v1/hosts/businesses/:businessId` | `HOSTS_BUSINESS_UPDATE_OWN` | `business.ownerUserId === context.userId \|\| SUPERADMIN` | Owning `HOST_OWNER`, `SUPERADMIN` | `SUPPORT`, `HOST_STAFF`, other hosts |
| `POST /api/v1/hosts/businesses/:businessId/verification` | `HOSTS_VERIFICATION_SUBMIT` | Owner or `SUPERADMIN` | Owning `HOST_OWNER`, `SUPERADMIN` | `SUPPORT`, `HOST_STAFF` |
| `GET /api/v1/hosts/businesses/:businessId/verification` | `HOSTS_BUSINESS_READ_OWN` or admin host read | Owner, `SUPPORT` (read-only), or `SUPERADMIN` | Owning `HOST_OWNER`, `SUPPORT`, `SUPERADMIN` | Other hosts, `TRAVELLER` |
| `GET /api/v1/hosts/businesses/:businessId/payout-details` | `HOSTS_BUSINESS_READ_OWN` or admin read | Owner or `SUPERADMIN` (removed nonexistent `ADMIN_FINANCIAL` check) | Owning `HOST_OWNER`, `SUPERADMIN` | `SUPPORT`, `HOST_STAFF`, other hosts |
| **Host Locations, Opening Hours, Exceptions, Zones & Media** | | | | |
| `POST /api/v1/hosts/locations` | `HOSTS_LOCATION_CREATE` | `business.ownerUserId === context.userId \|\| SUPERADMIN` | Owning `HOST_OWNER`, `SUPERADMIN` | `SUPPORT`, `HOST_STAFF`, non-owner `HOST_OWNER` |
| `GET /api/v1/hosts/locations` | `HOSTS_LOCATION_READ_OWN` | Scoped by ownership / active staff assignment | `HOST_OWNER`, `HOST_STAFF` (assigned), `SUPERADMIN` | `TRAVELLER` |
| `GET /api/v1/hosts/locations/:locationId` | `HOSTS_LOCATION_READ_OWN` | `assertHostLocationAccess` / `SUPPORT` or `SUPERADMIN` oversight | Assigned host team, owning `HOST_OWNER`, `SUPPORT`, `SUPERADMIN` | Non-assigned hosts |
| `PATCH /api/v1/hosts/locations/:locationId` | `HOSTS_LOCATION_UPDATE_OWN` | `assertLocationOwnerOrSuperadmin` (`SUPPORT` rejected with `403`) | Owning `HOST_OWNER`, `SUPERADMIN` | `SUPPORT`, `HOST_STAFF`, other hosts |
| `POST /api/v1/hosts/locations/:locationId/submit` | `HOSTS_LOCATION_SUBMIT` | `assertLocationOwnerOrSuperadmin` (`SUPPORT` rejected with `403`) | Owning `HOST_OWNER`, `SUPERADMIN` | `SUPPORT`, `HOST_STAFF`, other hosts |
| `POST /api/v1/hosts/locations/:locationId/disable` | `HOSTS_LOCATION_DISABLE` | `assertLocationOwnerOrSuperadmin` (`SUPPORT` rejected with `403`) | Owning `HOST_OWNER`, `SUPERADMIN` | `SUPPORT`, `HOST_STAFF`, other hosts |
| `PUT /api/v1/hosts/locations/:locationId/opening-hours` | `HOSTS_LOCATION_CONFIGURE` | `assertLocationOwnerOrSuperadmin` (`SUPPORT` rejected with `403`) | Owning `HOST_OWNER`, `SUPERADMIN` | `SUPPORT`, `HOST_STAFF`, other hosts |
| `POST /api/v1/hosts/locations/:locationId/exceptions` | `HOSTS_LOCATION_CONFIGURE` | `assertLocationOwnerOrSuperadmin` (`SUPPORT` rejected with `403`) | Owning `HOST_OWNER`, `SUPERADMIN` | `SUPPORT`, `HOST_STAFF`, other hosts |
| `POST /api/v1/hosts/locations/:locationId/zones` | `HOSTS_LOCATION_CONFIGURE` | `assertLocationOwnerOrSuperadmin` (`SUPPORT` rejected with `403`) | Owning `HOST_OWNER`, `SUPERADMIN` | `SUPPORT`, `HOST_STAFF`, other hosts |
| `POST /api/v1/hosts/locations/:locationId/media` | `HOSTS_LOCATION_CONFIGURE` | `assertLocationOwnerOrSuperadmin` (`SUPPORT` rejected with `403`) | Owning `HOST_OWNER`, `SUPERADMIN` | `SUPPORT`, `HOST_STAFF`, other hosts |
| **Capacity Pools & Pricing Rules** | | | | |
| `GET /api/v1/hosts/locations/:locationId/capacity-pools` | `requireAnyPermission([HOSTS_LOCATION_READ_OWN, ADMIN_LOCATION_READ])` | `verifyLocationReadAccess`: `SUPERADMIN`/`SUPPORT` or `assertHostLocationAccess` | Assigned host team, owning `HOST_OWNER`, `SUPPORT`, `SUPERADMIN` | Other hosts, `TRAVELLER` |
| `POST /api/v1/hosts/locations/:locationId/capacity-pools` | `HOSTS_LOCATION_CONFIGURE` | `verifyLocationWriteAccess`: owner or `SUPERADMIN` only | Owning `HOST_OWNER`, `SUPERADMIN` | `SUPPORT`, `HOST_STAFF`, other hosts |
| `PATCH /api/v1/hosts/capacity-pools/:poolId` | `HOSTS_LOCATION_CONFIGURE` | `verifyLocationWriteAccess`: owner or `SUPERADMIN` only | Owning `HOST_OWNER`, `SUPERADMIN` | `SUPPORT`, `HOST_STAFF`, other hosts |
| `GET /api/v1/hosts/locations/:locationId/pricing` | `requireAnyPermission([HOSTS_LOCATION_READ_OWN, ADMIN_LOCATION_READ])` | `verifyLocationReadAccess`: `SUPERADMIN`/`SUPPORT` or `assertHostLocationAccess` | Assigned host team, owning `HOST_OWNER`, `SUPPORT`, `SUPERADMIN` | Other hosts, `TRAVELLER` |
| `PUT /api/v1/hosts/locations/:locationId/pricing` | `HOSTS_LOCATION_CONFIGURE` | `verifyLocationWriteAccess`: owner or `SUPERADMIN` only | Owning `HOST_OWNER`, `SUPERADMIN` | `SUPPORT`, `HOST_STAFF`, other hosts |
| **Uploads & Documents** | | | | |
| `POST /api/v1/uploads/presigned-url` | `UPLOAD_INITIATE` | Business (`HOST_OWNER \|\| SUPERADMIN`) or location (`ownerUserId === userId \|\| SUPERADMIN`) | Owning `HOST_OWNER`, `SUPERADMIN` | `SUPPORT`, `HOST_STAFF`, `TRAVELLER`, other hosts |
| `POST /api/v1/uploads/confirm` | `UPLOAD_INITIATE` | Upload creator or `SUPERADMIN`, plus business/location ownership | Uploading owner, `SUPERADMIN` | `SUPPORT`, `HOST_STAFF`, other users |
| `GET /api/v1/uploads/documents/:documentId/download` | `requireAnyPermission([HOSTS_BUSINESS_READ_OWN, ADMIN_HOST_READ])` | Document host owner, `SUPPORT`, or `SUPERADMIN` | Owning `HOST_OWNER`, `SUPPORT`, `SUPERADMIN` | `HOST_STAFF`, other hosts, `TRAVELLER` |
| **Bookings, Custody & Host Finance** | | | | |
| `POST /api/v1/bookings` | `bookings.create` | Traveller booking ownership set from caller JWT | `TRAVELLER` / permitted caller | Unpermissioned callers |
| `GET /api/v1/bookings` | `bookings.read_own` | Scoped to caller `travellerUserId` | Booking owner | Other travellers |
| `GET /api/v1/bookings/:bookingId` | `app.authenticate` + service authorization | `isAdminOrSupport \|\| isTravellerOwner \|\| assertHostLocationAccess` | Booking traveller, assigned host team, `SUPPORT`, `SUPERADMIN` | Unrelated users/hosts |
| `POST /api/v1/bookings/:bookingId/cancel` | `bookings.cancel_own` | Booking traveller ownership check | Booking owner | Other users |
| `POST /api/v1/bookings/:bookingId/exceptions` | `requireAnyPermission([BOOKINGS_CREATE, HOSTS_BOOKINGS_MANAGE_OWN, HOSTS_CUSTODY_OPERATE, ADMIN_BOOKING_MANAGE])` | Traveller owner, host actor, or `SUPERADMIN` (`SUPPORT` override label removed) | Authorized traveller/host/`SUPERADMIN` | `SUPPORT`, unrelated users |
| `POST /api/v1/bookings/:bookingId/custody-pass` | `bookings.read_own` | Booking traveller ownership check | Booking owner | Other users |
| `GET /api/v1/hosts/bookings` / `/:bookingId` | `hosts.bookings.read_own` | `getAccessibleHostLocationIds` / `assertHostLocationAccess` | Assigned `HOST_STAFF`, owning `HOST_OWNER`, `SUPERADMIN` | Unassigned staff, other hosts, `TRAVELLER` |
| `POST /api/v1/hosts/bookings/:bookingId/accept` / `reject` / `cancel` | `hosts.bookings.manage_own` | `assertHostLocationAccess` | Authorized `HOST_OWNER`/`HOST_STAFF`, `SUPERADMIN` | Unassigned staff, other hosts, `TRAVELLER` |
| `GET /api/v1/hosts/finance/summary` | `hosts.finance.read_own` | Business owner or `SUPERADMIN` | Owning `HOST_OWNER`, `SUPERADMIN` | `HOST_STAFF`, `SUPPORT`, `TRAVELLER` |
| `POST /api/v1/hosts/custody/verify`, `GET /custody/:bookingId`, `POST .../check-in`, `POST .../check-out` | `hosts.custody.operate` | `assertHostLocationAccess` (active staff assignment / owner / `SUPERADMIN`) | Assigned `HOST_STAFF`, owning `HOST_OWNER`, `SUPERADMIN` | Unassigned staff, other hosts, `TRAVELLER` |
| **Admin Moderation, Governance & Finance** | | | | |
| `/api/v1/admin/host-verifications*` (GET vs POST verify) | `admin.host.read` (GET) vs `admin.host.verify` (POST) | Server role/permission enforcement | `SUPPORT` (GET only), `SUPERADMIN` (GET + POST) | `SUPPORT` on POST verify, non-admin |
| `/api/v1/admin/locations/moderation*` (GET queue vs POST review) | `admin.location.read` (GET) vs `admin.location.moderate` (POST) | Server role/permission enforcement | `SUPPORT` (GET only), `SUPERADMIN` (GET + POST) | `SUPPORT` on POST review, non-admin |
| `/api/v1/admin/bookings*` (GET vs POST cancel) | `admin.booking.read` (GET) vs `admin.booking.manage` (POST cancel) | Server role/permission enforcement | `SUPPORT` (GET only), `SUPERADMIN` (GET + POST) | `SUPPORT` on POST cancel, non-admin |
| `/api/v1/admin/payments/transactions` | `admin.payment.read` | Read oversight | `SUPPORT`, `SUPERADMIN` | Non-admin |
| `/api/v1/admin/refunds` (GET vs POST transition) | `admin.refund.read` (GET) vs `admin.refund.manage` (POST transition) | Server role/permission enforcement | `SUPPORT` (GET only), `SUPERADMIN` (GET + POST) | `SUPPORT` on POST transition, non-admin |
| `/api/v1/admin/finance/ledger` | `admin.financial.manage` | Platform ledger oversight | `SUPERADMIN` | `SUPPORT`, Host, Traveller |
| `/api/v1/admin/users*` / `/roles*` / `/audit-events*` | Specific `admin.user.*`, `admin.role.*`, `admin.permission.read`, `admin.audit.read` permissions | Per-endpoint permission check (`onRequest`) | Permitted Admin (`SUPERADMIN`) | `SUPPORT`, Host, Traveller |

---

## 2. Financial & Commission Privacy Matrix

The commission fields `commissionRateBps`, `platformCommissionMinor`, and `hostPayableMinor` are governed across API responses and Web UI columns:

| Surface / Endpoint | Unauthenticated | `TRAVELLER` | `HOST_STAFF` (Counter Staff) | Owning `HOST_OWNER` | `SUPPORT` | `SUPERADMIN` |
| --- | --- | --- | --- | --- | --- | --- |
| `POST /api/v1/bookings/quote` | Omitted | Omitted | Omitted | Omitted | Omitted | Omitted |
| `GET /api/v1/availability/search` (quotes) | Omitted | Omitted | Omitted | Omitted | Omitted | Omitted |
| `GET /api/v1/bookings/:bookingId` | 401 Denied | Omitted | Omitted | **Included** | Omitted | **Included** |
| Host Web `/host/bookings` `"Host Net"` column | Redirected (`/login`) | Redirected (`/forbidden`) | **Hidden** (`effectiveHostRole === "HOST_STAFF"`) | **Visible** | Redirected (`/forbidden`) | **Visible** (when switching to owner view) |
| Host Web `/host/finance`, `/host/payouts`, location setup | Redirected (`/login`) | Redirected (`/forbidden`) | **Restricted / Guarded** | **Visible** | Redirected (`/forbidden`) | **Visible** |

---

## 3. Web Route & Portal Gating Summary (`App.tsx`, `AppShell.tsx`, Layouts)

| Web Route Group | `App.tsx` Guard | Authenticated Role Access | UI Enforcement Notes |
| --- | --- | --- | --- |
| `/`, `/search`, `/locations/:slug`, `/checkout/:locId`, `/become-a-host`, `/how-it-works`, `/help`, `/contact`, `/terms` | Public | All | Zero `DEMO_*` fallback when unauthenticated without `?preview=demo` or when authenticated (even with `?preview=demo`). |
| `/booking/confirm`, `/portal/bookings` | `<ProtectedRoute allowDemoPreview={true} />` | Any authenticated user (or unauthenticated opt-in `?preview=demo` in non-prod preview builds) | Authenticated requests render live API state cleanly without demo fixtures. |
| `/host/*` (`HostDashboardLayout`) | `<ProtectedRoute requiredRoles={["HOST_OWNER", "HOST_STAFF", "SUPERADMIN"]} allowDemoPreview={true} />` | `HOST_OWNER`, `HOST_STAFF`, `SUPERADMIN` | Authenticated `HOST_STAFF` is locked to `effectiveHostRole = "HOST_STAFF"`, suppressing `Host Net` columns, finance cards, and owner configuration links. |
| `/admin/*` (`AdminDashboardLayout`) | `<ProtectedRoute requiredRoles={["SUPERADMIN", "SUPPORT"]} allowDemoPreview={true} />` | `SUPERADMIN`, `SUPPORT` | Authenticated `SUPPORT` at `/admin` is redirected to `/admin/bookings`; `SUPPORT` is limited to `SUPPORT_ALLOWED_EXACT_PATHS` + `/admin/support/:id` and read-only views (zero mutating buttons for verification, moderation, refund transitions, or cancellations). |
| `AppShell` Top-Bar CTA | Role-derived (`hasHostAccess`, `hasAdminAccess`) | Contextual | `Host Portal` shown only to `HOST_OWNER`/`HOST_STAFF`/`SUPERADMIN`; `Become a Host` shown otherwise. `Admin` links to `/admin` for `SUPERADMIN` and `/admin/bookings` for `SUPPORT`. |
