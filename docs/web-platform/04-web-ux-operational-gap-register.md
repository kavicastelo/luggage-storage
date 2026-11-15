# 04 — Web Platform UX and Operational Gap Register

**Baseline:** Commit `b09fa68` (`dev`) | **Total Verified Gaps:** 36 (`GAP-001` through `GAP-036`)  
All gaps below reflect actual source-verified user-facing, operational, security-UX, and data-authority defects.

---

## Cross-Cutting, Navigation & Authentication Gaps (`GAP-001` – `GAP-006`)

### `GAP-001` — Unconditional `Content-Type: application/json` Breaks Bodyless Logout, Session Revoke & Location Mutations
- **Affected Role(s):** All authenticated roles (`TRAVELLER`, `HOST_OWNER`, `HOST_STAFF`, `SUPPORT`, `SUPERADMIN`)
- **Affected Screen(s) & Route(s):** Global header logout (`AppShell.tsx:17`), Active Sessions (`/settings/sessions`), Host Locations (`/host/locations`)
- **Current Behavior:** [`fetchApi`](file:///d:/luggage-storage/luggage-storage/apps/web/src/lib/api-client.ts#L112-L115) unconditionally injects `"Content-Type": "application/json"` on every request, including bodyless `POST` (`logout`, `logoutAll`, `submitLocationForReview`, `disableLocation`) and `DELETE` (`revokeSession`). Fastify 5 rejects requests with `Content-Type: application/json` and empty body with `400 Bad Request` (`FST_ERR_CTP_EMPTY_JSON_BODY`). On logout, [`useAuthStore.ts`](file:///d:/luggage-storage/luggage-storage/apps/web/src/store/useAuthStore.ts#L165-L188) catches and ignores errors, clearing only in-memory React state.
- **Expected Behavior:** Bodyless requests omit `Content-Type` (or set it only when `options.body` is a JSON string/object), allowing `POST /auth/logout`, `/auth/logout-all`, `DELETE /auth/sessions/:id`, `/submit`, and `/disable` to succeed (`200`).
- **User Impact:** Clicking Sign Out looks like it logged out, but refreshing the page silently re-authenticates the user via the un-revoked `HttpOnly` refresh cookie (`initAuth`). Revoking individual sessions or submitting/disabling locations fails with 400 errors.
- **Business Impact:** Severe security hazard on shared/hotel/kiosk browsers; broken host location lifecycle controls.
- **Technical Cause:** [`api-client.ts:112-115`](file:///d:/luggage-storage/luggage-storage/apps/web/src/lib/api-client.ts#L112-L115) merges `"Content-Type": "application/json"` into `headers` unconditionally before `fetch()`. Also `L86-88` omits `onAuthFailure()` on malformed 200 refresh JSON and `L145` parses `retryResponse.json()` unguarded.
- **Recommended Correction:** Conditionally attach `"Content-Type": "application/json"` only when `options?.body !== undefined && !(options.body instanceof FormData) && !(options.body instanceof Blob)`. Harden refresh/retry JSON parsing.
- **Dependencies:** None (root client fix).
- **Priority:** **Critical**
- **Evidence:** [`api-client.ts:112-115`](file:///d:/luggage-storage/luggage-storage/apps/web/src/lib/api-client.ts#L112-L115), [`auth-api.ts:63-102`](file:///d:/luggage-storage/luggage-storage/apps/web/src/services/auth-api.ts#L63-L102), [`marketplace-api.ts:182-191`](file:///d:/luggage-storage/luggage-storage/apps/web/src/services/marketplace-api.ts#L182-L191), [`useAuthStore.ts:165-188`](file:///d:/luggage-storage/luggage-storage/apps/web/src/store/useAuthStore.ts#L165-L188).

### `GAP-002` — Host Onboarding RBAC Deadlock & Stale JWT Role Claims
- **Affected Role(s):** `TRAVELLER` onboarding to become `HOST_OWNER`
- **Affected Screen(s) & Route(s):** `/become-a-host` (`PW-006`), `/host/settings` (`HD-014`), `/host/*`
- **Current Behavior:** `/become-a-host` directs travellers to register (`/register`, which strictly assigns `TRAVELLER`) and then visit `/host/dashboard` or `/host/settings`. However, [`App.tsx:113-116`](file:///d:/luggage-storage/luggage-storage/apps/web/src/app/App.tsx#L113-L116) wraps all `/host/*` routes in `ProtectedRoute allowedRoles={["HOST_OWNER", "HOST_STAFF", "SUPERADMIN"]}`, redirecting travellers to `/forbidden`. Even if a traveller hits `POST /hosts/businesses`, Web never refreshes its JWT (`authApi.refresh()`), leaving `request.user.roles = ["TRAVELLER"]` and triggering `403` on KYC upload and finance endpoints.
- **Expected Behavior:** Authenticated verified `TRAVELLER`s can reach a dedicated Host Onboarding screen (`/host/onboarding`), submit `createBusiness`, have Web immediately rotate refresh token + `refreshUser()` to acquire `HOST_OWNER`, and land in `HD-014` KYC upload.
- **User Impact:** New hosts are completely locked out of creating a business and submitting KYC on the Web.
- **Business Impact:** Zero self-serve host supply growth on Web.
- **Technical Cause:** Missing pre-host onboarding route outside the `HOST_OWNER` guard + missing post-business `authApi.refresh()` + stale JWT checks in `uploads.service.ts:51` and `ledger.service.ts:413`.
- **Recommended Correction:** Add `/host/onboarding` (accessible to verified `TRAVELLER`s); trigger token refresh + `useAuthStore.refreshUser()` immediately after `createBusiness`; fix backend role checks in `uploads`/`ledger` to verify DB state.
- **Dependencies:** Backend verification of `hosts.business.create` permission for `TRAVELLER` & stale-JWT guard fix.
- **Priority:** **Critical**
- **Evidence:** [`App.tsx:103, 113-116`](file:///d:/luggage-storage/luggage-storage/apps/web/src/app/App.tsx#L103), [`RegisterPage.tsx:54-60`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/RegisterPage.tsx#L54-L60), [`hosts.service.ts:69-84`](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/hosts/hosts.service.ts#L69-L84), [`uploads.service.ts:51`](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/uploads/uploads.service.ts#L51).

### `GAP-003` — Live Mock-Data Fallback on Empty DB & Silent `.catch(() => {})` Across All Surfaces
- **Affected Role(s):** `TRAVELLER`, `HOST_OWNER`, `HOST_STAFF`, `SUPPORT`, `SUPERADMIN`
- **Affected Screen(s) & Route(s):** `PW-001..003`, `PW-011`, `HD-001..014`, `AD-001`, `AD-003`, `AD-005..007`, `AD-010`, `AD-017`
- **Current Behavior:** Page components initialize `useState(DEMO_LOCATIONS)` / `useState(DEMO_BOOKINGS)`, check `if (res.items.length > 0)`, or wrap API fetches in `.catch(() => {})`. When the database returns `0` legitimate records or an API call fails, real authenticated users are silently shown fake Colombo hubs, fake bookings (`#LS-2026-8841`), fake balances (`LKR 217,058`), and fake ledger/audit lines.
- **Expected Behavior:** Live mode never imports `DEMO_LOCATIONS` or `DEMO_BOOKINGS`. `0` records renders an honest empty/onboarding state; API errors display an explicit error banner with Retry action and correlation ID. Demo data renders strictly inside isolated opt-in `?preview=demo` mode.
- **User Impact:** Travellers book non-existent places; hosts manage fake reservations; admins audit fake financial records when DB queries return empty or error out.
- **Business Impact:** Severe marketplace trust, financial reconciliation, and legal misrepresentation failures.
- **Technical Cause:** Ad-hoc `useEffect` layering atop Phase 2C prototype state without removing mock defaults or migrating to TanStack Query `isLoading`/`isError`/`data`.
- **Recommended Correction:** Migrate data loading to TanStack Query hooks + Demo Preview Adapter; ban direct `DEMO_*` imports in live page components.
- **Dependencies:** TanStack Query hook suite.
- **Priority:** **Critical**
- **Evidence:** [`PublicMarketplacePages.tsx:158, 578, 886, 3090, 3104`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L3090-L3104), [`HostDashboardPages.tsx:166, 990, 1940, 2684`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L166), [`AdminDashboardPages.tsx:458, 736, 842, 1639`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx#L736).

### `GAP-004` — Primary Navigation Hidden Below `lg` Breakpoint Without Mobile Menu
- **Affected Role(s):** All Web mobile/tablet users (`TRAVELLER`, Guests)
- **Affected Screen(s) & Route(s):** Global header ([`AppShell.tsx`](file:///d:/luggage-storage/luggage-storage/apps/web/src/components/layout/AppShell.tsx#L40))
- **Current Behavior:** Primary nav (`Find Storage`, `How It Works`, `Become a Host`, `My Bookings`, `Help`) uses `className="hidden lg:flex ..."` with no hamburger toggle or mobile drawer.
- **Expected Behavior:** Accessible `<button aria-expanded>` mobile drawer/sheet renders navigation links and role-scoped portals cleanly on `< lg` viewports.
- **User Impact:** Smartphone and tablet travellers cannot reach Search, My Bookings, or Help from the top navigation bar.
- **Business Impact:** High mobile-web bounce rate for on-the-go travellers at stations/airports.
- **Technical Cause:** Responsive drawer omitted during `AppShell.tsx` Phase 2C build.
- **Recommended Correction:** Add accessible responsive drawer toggle in `AppShell.tsx` with `Escape` close and focus return.
- **Dependencies:** None.
- **Priority:** **High**
- **Evidence:** [`AppShell.tsx:40-84`](file:///d:/luggage-storage/luggage-storage/apps/web/src/components/layout/AppShell.tsx#L40-L84).

### `GAP-005` — Role-Blind Header Portal Links & `SUPPORT` Redirect Trap
- **Affected Role(s):** `TRAVELLER`, `SUPPORT`, Unauthenticated visitors
- **Affected Screen(s) & Route(s):** Global header (`AppShell.tsx:90-110`), `/admin` (`AD-001`)
- **Current Behavior:** `"Host Portal"` link (`L90-95`) displays to everyone including guests and `TRAVELLER`s (who hit `/login` or `/forbidden`). Clicking `"Admin"` (`L103-109`) routes `SUPPORT` users to `/admin` (`AD-001`), which has `superadminOnly: true`, triggering a red RBAC block screen.
- **Expected Behavior:** Show `"Host Portal"` only to `HOST_OWNER`/`HOST_STAFF`/`SUPERADMIN` (show `"Become a Host"` / `"Resume Host Onboarding"` otherwise); route `SUPPORT` `"Admin"` link to `/admin/bookings` or `/admin/support` (their permitted queue).
- **User Impact:** Repeated 403/RBAC block friction for `SUPPORT` staff and travellers clicking visible CTAs.
- **Business Impact:** Confusing multi-role UX and increased internal support confusion.
- **Technical Cause:** Unconditional link rendering in `AppShell.tsx:90-109`.
- **Recommended Correction:** Conditionally compute portal CTAs from `useAuthStore` roles/permissions.
- **Dependencies:** Alignment of `AdminDashboardLayout` `SUPPORT` permissions.
- **Priority:** **Medium**
- **Evidence:** [`AppShell.tsx:90-110`](file:///d:/luggage-storage/luggage-storage/apps/web/src/components/layout/AppShell.tsx#L90-L110), [`AdminDashboardPages.tsx:77, 164-210`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx#L77).

### `GAP-006` — Read-Only `/profile` Exposing Raw IDs/Permissions, Stale Post-Verify State & Internal Screen Codes on 404
- **Affected Role(s):** All signed-in users & public visitors hitting 404
- **Affected Screen(s) & Route(s):** `/profile`, `/verify-email`, `*` (`NotFoundPage.tsx`)
- **Current Behavior:** `ProfilePage.tsx` has zero edit form, exposes raw `sessionId` UUID & internal RBAC permission keys (`L135-213`), `VerifyEmailPage.tsx:45-47` doesn't refresh `useAuthStore` after verification, and `NotFoundPage.tsx:20-26` leaks `(PW-001)` / `(PW-002)` developer IDs in customer buttons.
- **Expected Behavior:** `/profile` edits display name, phone, and emergency contact via `/identity/profile`; `VerifyEmailPage` refreshes auth store immediately; `NotFoundPage` displays clean customer copy; internal permission matrices move to dev/admin views.
- **User Impact:** Travellers cannot update name, phone, or emergency contact before checkout.
- **Business Impact:** Incomplete traveller KYC/contact profile and unpolished external brand presentation.
- **Technical Cause:** Missing Fastify route wrapper over existing `packages/contracts/src/identity/index.ts`; missing `refreshUser()` call; leftover Phase 2C copy in `NotFoundPage`.
- **Recommended Correction:** Wire `/identity/profile` backend + form; call `refreshUser()` on email verification; clean `NotFoundPage.tsx`.
- **Dependencies:** Register `/api/v1/identity/profile` routes.
- **Priority:** **Medium**
- **Evidence:** [`ProfilePage.tsx:130-213`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/ProfilePage.tsx#L130-L213), [`VerifyEmailPage.tsx:43-50`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/VerifyEmailPage.tsx#L43-L50), [`NotFoundPage.tsx:20-26`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/NotFoundPage.tsx#L20-L26).

---

## Public Traveller Website Gaps (`GAP-007` – `GAP-016`)

### `GAP-007` — Landing Page Hardcodes Fake Featured Hubs, Past Date & Demo URLs
- **Affected Role(s):** Public visitors / `TRAVELLER`
- **Affected Screen(s) & Route(s):** `PW-001` (`/`)
- **Current Behavior:** `featuredHubs` uses `DEMO_LOCATIONS.slice(0, 3)` (`L158`), date picker defaults to hardcoded `"2026-11-10"` (`L149`), CTA states `"Explore All 5 Hubs on Map"` (`L332`), and cards link to synthetic `/locations/colombo-fort-railway-hub` & `/checkout/loc-cmb-fort-01`.
- **Expected Behavior:** Fetch live hubs from `GET /api/v1/discovery/locations?limit=3` (showing honest launch-soon empty state if zero active hubs exist), default dates dynamically to today/tomorrow in user/Colombo timezone, and link via live location IDs.
- **User Impact:** Travellers click fake hubs on the homepage and enter fake demo checkout.
- **Business Impact:** Zero conversion from `/` into live marketplace inventory.
- **Technical Cause:** `PublicLandingPage` makes 0 API calls.
- **Recommended Correction:** Wire `useDiscoveryLocations({ limit: 3 })` and dynamic date defaults (`new Date()`).
- **Dependencies:** Live `discovery` hook.
- **Priority:** **High**
- **Evidence:** [`PublicMarketplacePages.tsx:145-335`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L145-L335).

### `GAP-008` — `mapPublicLocationToItem` Fabricates Insurance (`LKR 250k`), Capacity (`45/50`), Grace Period & Hourly Rates
- **Affected Role(s):** `TRAVELLER` / Public visitors
- **Affected Screen(s) & Route(s):** `PW-002` (`/search`), `PW-003` (`/locations/:slug`), `PW-004` (`/checkout/:locId`)
- **Current Behavior:** [`mapPublicLocationToItem`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L95-L140) takes real `PublicStorageLocation` objects and overwrites/invents: `hasInsurance: true`, `insuranceLimitLkr: 250000`, `photoEvidencePolicy`, `gracePeriodMinutes: 30`, `lateFeePolicyLabel`, hourly + daily cap pricing (`baseRateMinor / 600` etc.), `totalCapacity: 50`, `availableCapacity: 45`, `distanceKm: 1.0`, fake `zones`, and drops `images`.
- **Expected Behavior:** UI binds directly to `PublicStorageLocation` / `PublicStorageLocationDetail` / `AvailabilityResult` from `@luggage-storage/contracts`, rendering only server-verified pricing units (`CALENDAR_DAY` / `24_HOUR_BLOCK`), gallery photos, real pool/availability counts, and honest unconfigured badges if insurance/reviews are absent.
- **User Impact:** Travellers are promised false LKR 250,000 insurance and hourly rates that do not match actual server checkout quotes (`POST /bookings/quote`).
- **Business Impact:** Regulatory/consumer protection liability and checkout price shock.
- **Technical Cause:** Adapter function built to coerce live API responses into `DemoStorageLocation` shape.
- **Recommended Correction:** Delete `mapPublicLocationToItem` in production views and extend `GET /discovery/locations/:locationId` for full public location metadata.
- **Dependencies:** Enriched `GET /discovery/locations/:locationId`.
- **Priority:** **Critical**
- **Evidence:** [`PublicMarketplacePages.tsx:95-140`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L95-L140).

### `GAP-009` — Broken Search Filters/Sorting, Ignored Schedule Params, Unwired Availability Search & CSS Grid Pseudo-Map
- **Affected Role(s):** `TRAVELLER`
- **Affected Screen(s) & Route(s):** `PW-002` (`/search`)
- **Current Behavior:** Early return on [`L574-576`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L574-L576) returns `liveLocations.map(...)` *before* `only24Hours`, `onlyClimateControl`, or `sortBy` execute! Empty live search results fall through to `DEMO_LOCATIONS` (`L578`). Search misses `?date=`/`?bags=` params from Landing, never calls `GET /availability/search`, omits `searchTerm` text input & `acceptsOversized` query flag, and renders a CSS button grid (`L785-852`) instead of a real map.
- **Expected Behavior:** Synchronize all search params (`searchTerm`, `city`, `dropOffAt`, `collectionAt`, `small/medium/large/oversizedBags`, `amenities`, `sortBy`) in URL search params; invoke `GET /availability/search` when dates/bags are specified and `GET /discovery/locations` otherwise; execute filters/sorting properly; render MapLibre vector map (gated cleanly on `OQ-018` tile key availability, or honest coordinate list view without CSS box "map").
- **User Impact:** Toggle filters and sort dropdowns appear interactive but have zero effect on live listings; sold-out hubs appear bookable until final checkout.
- **Business Impact:** Failed bookings at checkout and user frustration.
- **Technical Cause:** Short-circuit `if (liveLocations.length > 0) return ...` in `useMemo` + missing `useAvailabilitySearch` hook.
- **Recommended Correction:** Rewrite `PW-002` around query-param-driven TanStack Query hooks; remove `DEMO_LOCATIONS` fallback.
- **Dependencies:** `OQ-018` commercial tile API key for MapLibre rendering.
- **Priority:** **High**
- **Evidence:** [`PublicMarketplacePages.tsx:519-858`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L519-L858), [`marketplace-api.ts:355-407`](file:///d:/luggage-storage/luggage-storage/apps/web/src/services/marketplace-api.ts#L355-L407).

### `GAP-010` — Location Detail Missing Authoritative Weekly Hours, Exceptions, Gallery & Tier Pricing + Falls Back to Demo on 404
- **Affected Role(s):** `TRAVELLER`
- **Affected Screen(s) & Route(s):** `PW-003` (`/locations/:slug`, `/location/:slug`, `/location`)
- **Current Behavior:** If location ID is non-UUID, inactive, or fails to load, `.catch(() => {})` (`L877`) silently loads `DEMO_LOCATIONS[0]` (`L886-889`). Furthermore, `GET /discovery/locations/:locationId` (`discovery.service.ts:218-313`) returns only a summary string (`operatingHoursSummary`) and single `baseRateMinor`, omitting per-day opening hours, closure exceptions, and per-bag-size `tierRates` (`BAG_SMALL`/`BAG_MEDIUM`/`BAG_LARGE`/`BAG_OVERSIZED`).
- **Expected Behavior:** Show an honest loading skeleton and explicit 404/unavailable state for missing/inactive venues; display full server weekly opening hours, upcoming holiday exceptions, R2 photo gallery, and exact minor-unit tier pricing + live server quote estimator.
- **User Impact:** Travellers cannot see weekend hours, upcoming holiday closures, or real multi-bag pricing before clicking Reserve.
- **Business Impact:** Late arrivals to closed hosts and abandoned checkouts.
- **Technical Cause:** Incomplete public detail DTO on `discovery.service.ts:289-311` + silent catch & demo fallback on `PW-003`.
- **Recommended Correction:** Extend `getPublicLocationDetails` response DTO (`openingHours`, `upcomingExceptions`, `pricingPolicy`, `images`) while keeping `OQ-012` coarse location privacy; remove `DEMO_LOCATIONS` fallback.
- **Dependencies:** Backend `discovery.service.ts` detail extension.
- **Priority:** **Critical**
- **Evidence:** [`PublicMarketplacePages.tsx:863-905`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L863-L905), [`discovery.service.ts:218-313`](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/discovery/discovery.service.ts#L218-L313).

### `GAP-011` — Checkout Past Default Dates, Undebounced Quotes & Lost Auth Redirect Context
- **Affected Role(s):** `TRAVELLER`
- **Affected Screen(s) & Route(s):** `PW-004` (`/checkout/:locId`)
- **Current Behavior:** Drop-off & collection default to hardcoded past timestamps `"2026-11-10T09:00"` (`L1141-1142`), immediately rejecting quote requests with "in the past". Every bag quantity increment dispatches an un-debounced `POST /bookings/quote`. Unauthenticated checkout submit calls `navigate("/login")` (`L1273`) *without* passing `{ state: { from: location } }`, so after logging in the user lands on `/profile` instead of back on checkout!
- **Expected Behavior:** Initialize drop-off/collection relative to current venue/local clock (`now + 1h` / `now + 5h`), debounce quote requests (`300ms`), and preserve checkout URL + selected schedule/bag state across `/login` redirect.
- **User Impact:** Immediate error on checkout load and lost reservation progress when asked to sign in.
- **Business Impact:** Severe checkout funnel drop-off right before PayHere payment.
- **Technical Cause:** Static date constants + missing `state={{ from: location }}` navigation + missing query debounce.
- **Recommended Correction:** Dynamic defaults (`Date.now() + ...`), `useDebouncedValue`, sessionStorage draft keyed by `locationId`, and `navigate("/login", { state: { from: location } })`.
- **Dependencies:** Checkout draft persistence helper.
- **Priority:** **High**
- **Evidence:** [`PublicMarketplacePages.tsx:1138-1145, 1273`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L1273).

### `GAP-012` — Non-Scannable Decorative `<QrCode />` Icon Instead of Real Encoded `qrToken` QR Code + Missing Regeneration on `PW-005`
- **Affected Role(s):** `TRAVELLER`, `HOST_OWNER`, `HOST_STAFF`
- **Affected Screen(s) & Route(s):** `PW-005` (`/booking/confirm`), `PW-011` (`/portal/bookings`)
- **Current Behavior:** Both `PW-005` (`L2263`, `L2379`) and `PW-011` (`L3483`) display a static `lucide-react` `<QrCode />` vector glyph **that does not encode `issuedPass.qrToken`**. `apps/web` has no QR generation library installed (`apps/web/package.json`). Moreover, `PW-005` omits a `"Regenerate Pass"` control when the 15-minute pass expires.
- **Expected Behavior:** Encode actual `issuedPass.qrToken` (or canonical JSON/token string compatible with Mobile/Host scanner) into an authentic SVG/Canvas QR matrix using `qrcode`, show live 15-minute expiration countdown, display 6-digit backup `verificationPin`, and allow single-click regeneration.
- **User Impact:** Optical QR scanning at the host counter (`Mobile` / USB scanner) cannot work from Web passes!
- **Business Impact:** Breaks QR custody verification; forces manual 6-digit typing on every Web booking.
- **Technical Cause:** Placeholder icon left over from Phase 2C UI prototype (`QrCode` imported at `L11`).
- **Recommended Correction:** Add `qrcode` (or `qrcode.react`) and build shared `<CustodyQrPassCard />` used by both `PW-005` and `PW-011`.
- **Dependencies:** Approved lightweight `qrcode` dependency.
- **Priority:** **Critical**
- **Evidence:** [`PublicMarketplacePages.tsx:11, 2263, 2379, 3483`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L2263), [`custody/index.ts:41-51`](file:///d:/luggage-storage/luggage-storage/packages/contracts/src/custody/index.ts#L41-L51).

### `GAP-013` — Unprotected `/booking/confirm` & `/portal/bookings` Leak Fake Synthetic Bookings
- **Affected Role(s):** Unauthenticated visitors & 0-booking `TRAVELLER`s
- **Affected Screen(s) & Route(s):** `PW-005` (`/booking/confirm`), `PW-011` (`/portal`, `/portal/bookings`)
- **Current Behavior:** [`App.tsx:105-108`](file:///d:/luggage-storage/luggage-storage/apps/web/src/app/App.tsx#L105-L108) leaves `/booking/confirm` and `/portal/bookings` outside `ProtectedRoute`. `PW-005` renders fake confirmed `#LS-2026-8841` when visited without UUID (`L2311-2433`); `PW-011` initializes `useState(DEMO_BOOKINGS)` (`L3090`) and only replaces state `if (res.bookings.length > 0)` (`L3104`).
- **Expected Behavior:** Both routes require `ProtectedRoute`; `0` bookings renders `"No bookings yet — Find Storage"` empty state; missing booking UUID on `/booking/confirm` redirects or shows explicit 404.
- **User Impact:** Newly signed-up travellers opening "My Bookings" see 6 fake strangers' reservations including fake custody PINs.
- **Business Impact:** Severe privacy/trust confusion and customer support load.
- **Technical Cause:** Routes left public in `App.tsx` + `useState(DEMO_BOOKINGS)` initialization.
- **Recommended Correction:** Wrap routes in `ProtectedRoute` (`allowDemoPreview` ONLY when `?preview=demo` & dev-enabled); wire `useMyBookings()`.
- **Dependencies:** Demo Preview Adapter isolation.
- **Priority:** **Critical**
- **Evidence:** [`App.tsx:105-108`](file:///d:/luggage-storage/luggage-storage/apps/web/src/app/App.tsx#L105-L108), [`PublicMarketplacePages.tsx:2311, 3090-3104`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L3090-L3104).

### `GAP-014` — Unpaid `PENDING_PAYMENT` Bookings Displayed as `"CONFIRMED"` / `"Confirmed & Reserved"`
- **Affected Role(s):** `TRAVELLER`
- **Affected Screen(s) & Route(s):** `PW-011` (`/portal/bookings`)
- **Current Behavior:** [`PublicMarketplacePages.tsx:3037`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L3037) contains `else if (detail.status === "PENDING_PAYMENT") mappedStatus = "CONFIRMED";`, causing unpaid bookings whose payment was abandoned or failed to appear in `"Upcoming"` as `"Confirmed & Reserved"` (`L3299`) alongside Pass buttons!
- **Expected Behavior:** Map `PENDING_PAYMENT` to a dedicated `"Awaiting Payment"` badge showing hold expiration timer (`holdExpiresAt`) and a `"Complete Payment"` button (navigating to `PW-005` PayHere retry), never allowing custody pass generation before capture.
- **User Impact:** Travellers believe unpaid holds are confirmed bookings and arrive at hosts without paid reservations.
- **Business Impact:** Abandoned holds expire in 10 minutes causing stranded travellers and angry hosts.
- **Technical Cause:** Forced coercion of 11 backend `BookingStatus` values into 6 `DemoBookingRecord["status"]` values.
- **Recommended Correction:** Remove `DemoBookingRecord` coercion and bind `PW-011` directly to authoritative `BookingStatus` enum.
- **Dependencies:** Remove `mock-marketplace` booking types from live UI.
- **Priority:** **Critical**
- **Evidence:** [`PublicMarketplacePages.tsx:3030-3045, 3299`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L3037).

### `GAP-015` — Overstated 100% Refund Amounts, Misclassified `EXPIRED`/`REJECTED` Refunds & Dead VAT Invoice Button
- **Affected Role(s):** `TRAVELLER`
- **Affected Screen(s) & Route(s):** `PW-011` (`/portal/bookings` — Past & Refunds tabs)
- **Current Behavior:** Refunds tab (`L3426`) prints `formatLkr(b.totalAmountLkr)` instead of `detail.refundSummary.amountMinor` (so a 50% or 0% `OQ-009` cancellation falsely promises a 100% refund!), places unpaid `EXPIRED` & `REJECTED` bookings into Refunds, uses mock 7-stage labels (`REFUND_SEVEN_STAGES`), and renders an unwired `"Download VAT Invoice"` button (`L3399`).
- **Expected Behavior:** Display exact `refundSummary.amountMinor / 100` (`50%` or `100%` or `0%` tier notice), map actual backend `REFUND_STATUSES`, separate `EXPIRED`/`REJECTED` into Cancelled/Expired history, and either render printable server-backed Booking Receipt or hide "VAT Invoice" until `OQ-010` tax counsel approval.
- **User Impact:** Travellers expect full refunds on late cancellations and click a dead button expecting a VAT document.
- **Business Impact:** Payment disputes, chargebacks, and premature "VAT Invoice" legal exposure (`OQ-010` `BLOCKED`).
- **Technical Cause:** `DEMO_BOOKINGS` field reuse (`b.totalAmountLkr`) + no handler on Invoice button.
- **Recommended Correction:** Bind Refunds tab directly to `BookingDetail.refundSummary` + `REFUND_STATUSES`; replace `"Download VAT Invoice"` with `"View Booking Receipt"` modal using authoritative snapshot.
- **Dependencies:** `OQ-010` external gate for formal tax/VAT invoicing.
- **Priority:** **High**
- **Evidence:** [`PublicMarketplacePages.tsx:3399-3456`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L3399-L3456).

### `GAP-016` — Missing Traveller Dispute/Exception UI & Fake Support Ticket `#TKT-COL-2026-441`
- **Affected Role(s):** `TRAVELLER`, `SUPPORT`
- **Affected Screen(s) & Route(s):** `PW-011` (`/portal/bookings`), `PW-009` (`/contact`)
- **Current Behavior:** `PW-011` has no UI button calling `marketplaceApi.reportBookingException` (`POST /bookings/:id/exceptions`). Meanwhile `/contact` (`L2795-2822`) flips local React state `setSubmitted(true)` without calling any backend API and displays fake ticket `#TKT-COL-2026-441`.
- **Expected Behavior:** Active/completed bookings include a `"Report Problem"` modal wired to `POST /bookings/:bookingId/exceptions`; `/contact` persists real support tickets once the backend Support module exists (and until then displays an honest direct email/phone contact notice rather than fabricating a fake ticket ID).
- **User Impact:** Travellers have no in-app path to report lost/damaged luggage from Web and falsely believe contact forms reached support.
- **Business Impact:** Unlogged customer complaints and missed escrow holds (`host_payables ON_HOLD`).
- **Technical Cause:** `reportBookingException` never wired in `PW-011`; `ContactUsPage` left as Phase 2C simulation.
- **Recommended Correction:** Wire `useReportBookingException` in `PW-011`; replace fake `/contact` submission with honest channel or live `/support/tickets` integration in Initiative 6.
- **Dependencies:** Support module (`support_tickets` schema/API) for `PW-009` live persistence.
- **Priority:** **High**
- **Evidence:** [`PublicMarketplacePages.tsx:2788-2828`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx#L2788-L2828), [`marketplace-api.ts:461-470`](file:///d:/luggage-storage/luggage-storage/apps/web/src/services/marketplace-api.ts#L461-L470).

---

## Host Web Dashboard Gaps (`GAP-017` – `GAP-027`)

### `GAP-017` — Global Host Venue Selector Hardcoded to `DEMO_LOCATIONS` (`"loc-cmb-fort-01"`)
- **Affected Role(s):** `HOST_OWNER`, `HOST_STAFF`, `SUPERADMIN`
- **Affected Screen(s) & Route(s):** Global `HostDashboardLayout` (`HostDashboardPages.tsx:122-524`)
- **Current Behavior:** `HostDashboardLayout` makes **0 API calls**. `selectedLocationId` initializes to `"loc-cmb-fort-01"` (`L162`), `currentLocation` resolves via `DEMO_LOCATIONS.find(...) || DEMO_LOCATIONS[0]` (`L166`), the sidebar `<select>` renders `DEMO_LOCATIONS` (`L290-291`), the business badge hardcodes `"Sample Host Partner Profile (Demo Preview)"` (`L276`), and `L302-332` renders an interactive role preview switcher.
- **Expected Behavior:** Hydrate `useHostContextStore` from live `GET /hosts/businesses` + `GET /hosts/locations` (for `HOST_OWNER` and assigned `HOST_STAFF`); show authentic user/business name & KYC badge; render clean empty onboarding prompt if 0 businesses or 0 locations exist; hide demo role switcher in live mode.
- **User Impact:** Authenticated hosts log in and immediately see synthetic `"Colombo Fort Railway Storage Hub"` context instead of their actual venues.
- **Business Impact:** Total breakdown of multi-tenant host isolation at the UI presentation layer.
- **Technical Cause:** Phase 2C `HostVenueContext` never integrated with live `/hosts/*` queries.
- **Recommended Correction:** Implement Zustand `useHostContextStore` synced with TanStack Query (`useHostBusinesses`, `useHostLocations`); fix `locations.service.ts` to return `HOST_STAFF`-assigned venues.
- **Dependencies:** `locations.service.ts` `HOST_STAFF` read fix.
- **Priority:** **Critical**
- **Evidence:** [`HostDashboardPages.tsx:122-332`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L122-L332).

### `GAP-018` — Frontend `HOST_STAFF` RBAC Bypass on Location Sub-Routes & Revenue KPIs
- **Affected Role(s):** `HOST_STAFF`, `HOST_OWNER`
- **Affected Screen(s) & Route(s):** `HostDashboardLayout` (`L188-214`), `HD-001` (`L632-642`)
- **Current Behavior:** `operationalNavItems` places `{ to: "/host/locations", ownerOnly: false }` before `{ to: "/host/locations/${id}/schedule", ownerOnly: true }`. Route evaluation uses `.startsWith(item.to)`, matching `/host/locations` (`ownerOnly: false`) first — **allowing `HOST_STAFF` into `HD-003` Location Editor, `HD-004` Schedule, `HD-005` Capacity, and `HD-006` Pricing!** Additionally, `HD-001` renders `"Net Cleared Earnings"` & revenue cards (`L632-642`) unconditionally to `HOST_STAFF`, violating `OQ-017`.
- **Expected Behavior:** Match nav item by exact match / longest-prefix match and guard `HD-003`–`HD-006`, `HD-010`, `HD-011`, `HD-013`, `HD-014` with `PermissionGate` (`hosts.location.update_own`, `hosts.location.configure`, `hosts.finance.read_own`). Hide financial KPIs from `HOST_STAFF` on `HD-001`.
- **User Impact:** Staff see configuration and revenue screens they are unauthorized to edit/view (hitting unexpected API 403s).
- **Business Impact:** Violates `OQ-017` least-privilege staff permission boundary.
- **Technical Cause:** Ordered `.find(item => pathname.startsWith(item.to))` bug + missing `PermissionGate` checks on `HD-001`.
- **Recommended Correction:** Replace matching logic with explicit route metadata / `PermissionGate` + backend `app.requirePermission` enforcement.
- **Dependencies:** None.
- **Priority:** **High**
- **Evidence:** [`HostDashboardPages.tsx:188-214, 632-642`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L188-L214).

### `GAP-019` — Impossible Host KYC Verification & Unwired R2 Uploads on `HD-014`
- **Affected Role(s):** `HOST_OWNER`
- **Affected Screen(s) & Route(s):** `HD-014` (`/host/settings`)
- **Current Behavior:** `HD-014` (`L3404-3833`) calls only `getOwnedBusinesses` + `createBusiness`. It never calls `updateBusiness`, `initiateUpload`, `confirmUpload`, `submitVerification`, or `getVerification`, has no `<input type="file">`, `apps/web` lacks a binary `PUT` helper to R2, checks `"PENDING_VERIFICATION"` instead of verification contract status `"PENDING_REVIEW"` (`L3587`), and renders fake `"Ceylon Transit Hospitality"` KYC cards when `businesses.length === 0` (`L3596-3659`).
- **Expected Behavior:** Hosts can edit business details (`PATCH /hosts/businesses/:id`), upload BRN/TIN/Owner ID PDFs/images directly via presigned R2 `PUT` + confirm, submit KYC application (`POST .../verification`), track real status (`PENDING_REVIEW` / `MORE_INFO_REQUIRED` / `ACTIVE` / `REJECTED`), and view uploaded document names.
- **User Impact:** Zero hosts can become KYC-verified or active through the Web dashboard.
- **Business Impact:** Complete supply-side onboarding stoppage on Web.
- **Technical Cause:** Frontend upload/verification UI never built over already-wrapped `marketplaceApi` methods + missing dev mock `PUT` endpoint on backend.
- **Recommended Correction:** Build R2 uploader component + KYC submission workflow in `HD-014`; add dev mock `PUT` route in `uploads.routes.ts`.
- **Dependencies:** `GAP-002` onboarding & R2 binary upload helper.
- **Priority:** **Critical**
- **Evidence:** [`HostDashboardPages.tsx:3404-3659`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L3404-L3659), [`marketplace-api.ts:102-151, 319-340`](file:///d:/luggage-storage/luggage-storage/apps/web/src/services/marketplace-api.ts#L102-L151).

### `GAP-020` — Premature `submitLocationForReview` Fails Draft Creation (`HD-002`)
- **Affected Role(s):** `HOST_OWNER`
- **Affected Screen(s) & Route(s):** `HD-002` (`/host/locations`)
- **Current Behavior:** [`handleCreateLocation`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L963-L980) calls `createLocation` and **immediately invokes `submitLocationForReview(newLoc.id)` at line `977`** — before opening hours, capacity pools, pricing policy, or verified business exist. Backend always rejects `/submit` (`400`/`422`), plus `GAP-001` triggers `400 FST_ERR_CTP_EMPTY_JSON_BODY`, leaving an orphaned `DRAFT` location while falling back to `DEMO_LOCATIONS` (`L990-1005`).
- **Expected Behavior:** `createLocation` creates a `DRAFT` and redirects cleanly to the Location Setup Checklist (`HD-003`/`004`/`005`/`006`), enabling `"Submit for Review"` only once hours, capacity pool, pricing policy, and active verified business checks pass.
- **User Impact:** Every attempt to create a new storage location errors out mid-flow.
- **Business Impact:** Hosts cannot publish new storage venues.
- **Technical Cause:** Coupled `createLocation` + `submitLocationForReview` call on `L977`.
- **Recommended Correction:** Decouple draft creation from explicit readiness-gated `"Submit for Review"` action; remove `DEMO_LOCATIONS` fallback.
- **Dependencies:** `GAP-001`, `GAP-021`.
- **Priority:** **Critical**
- **Evidence:** [`HostDashboardPages.tsx:963-1005`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L963-L1005).

### `GAP-021` — Zero-API Simulated Location Editor (`HD-003`), Schedule (`HD-004`), Capacity (`HD-005`) & Pricing (`HD-006`)
- **Affected Role(s):** `HOST_OWNER`
- **Affected Screen(s) & Route(s):** `HD-003`, `HD-004`, `HD-005`, `HD-006`
- **Current Behavior:** All 4 screens (`L1267-1914`) make **0 API calls**, look up `:id` in `DEMO_LOCATIONS`, simulate saves with `setTimeout`, include dead `"Configure Zone Limits"` (`L1702`) & no-op `"Add Zone"` modals (`L1761`), and `HD-006` displays incompatible hourly/daily-cap price fields instead of backend `CALENDAR_DAY`/`24_HOUR_BLOCK` minor units. Meanwhile 12 matching methods already exist in `marketplaceApi` (`L166-296`) unused!
- **Expected Behavior:** Every tab loads from live `GET /hosts/locations/:id`, `getCapacityPools`, and `getPricingPolicy`, uploads gallery photos to R2 (`addLocationMedia`), saves changes cleanly to PostgreSQL, and invalidates host + discovery caches.
- **User Impact:** Hosts edit settings, see green `"Saved"` toasts, and discover nothing persisted on reload or appeared in search.
- **Business Impact:** Hosts cannot configure valid operating hours, capacities, or pricing required to go live.
- **Technical Cause:** Leftover Phase 2C `useState`/`setTimeout` prototypes despite Phase A API wrappers being present.
- **Recommended Correction:** Decompose `HD-003`–`HD-006` into modular feature components wired to `marketplaceApi` via TanStack Query + `react-hook-form` + Zod.
- **Dependencies:** `GAP-017`, `GAP-020`.
- **Priority:** **Critical**
- **Evidence:** [`HostDashboardPages.tsx:1267-1914`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L1267-L1914), [`marketplace-api.ts:166-296`](file:///d:/luggage-storage/luggage-storage/apps/web/src/services/marketplace-api.ts#L166-L296).

### `GAP-022` — Critical Check-Out Data Corruption Marks Every Clean Web Release as `DISPUTED` (`ON_HOLD` Payable)
- **Affected Role(s):** `HOST_OWNER`, `HOST_STAFF`, `TRAVELLER`, `SUPERADMIN`
- **Affected Screen(s) & Route(s):** `HD-009` (`/host/operations`)
- **Current Behavior:** Line [`2387`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L2387) unconditionally sends `exceptionNotes: "Released via Host Counter Web Desk"` inside `marketplaceApi.completeCollection`. In [`custody.service.ts:747-757`](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/custody/custody.service.ts#L747-L757), `hasDisputeException = Boolean(input.exceptionNotes) || ...` transitions `custody_records.status = "DISPUTED_RELEASE"`, `bookings.status = "DISPUTED"`, freezes `host_payables` as `"ON_HOLD"`, and suppresses double-entry revenue split!
- **Expected Behavior:** Normal luggage collection release **omits** `exceptionNotes` (`undefined`) so `completeCollection` transitions the booking to `COMPLETED`, releases custody cleanly (`RELEASED_TO_TRAVELLER`), posts ledger revenue split, and marks `host_payables` `ELIGIBLE`. `exceptionNotes` must only be supplied when staff explicitly flag a discrepancy/missing/damaged bag.
- **User Impact:** Every normal Web check-out looks successful to staff (`DISPUTED_RELEASE` banner even printed silently!) while flagging the traveller as disputed and freezing host earnings forever.
- **Business Impact:** Financial settlement freeze across 100% of Web-checked-out bookings and spurious dispute backlog for Superadmins.
- **Technical Cause:** Developer passed an audit remark string into an exception field without reading `custody.service.ts:747-757`.
- **Recommended Correction:** Remove `exceptionNotes` from normal check-out submission; add explicit optional `"Flag Collection Discrepancy / Exception"` toggle for damaged/short-count handovers only.
- **Dependencies:** Add unit/integration test asserting `bookings.status === "COMPLETED"` after Web check-out.
- **Priority:** **Critical**
- **Evidence:** [`HostDashboardPages.tsx:2383-2395`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L2383-L2395), [`custody.service.ts:747-757`](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/custody/custody.service.ts#L747-L757).

### `GAP-023` — Counter `LS-*` Reference Lookup Siloed in Fake `setTimeout`, Ignored `?ref=` Deep Links & Hardcoded Bag Tags
- **Affected Role(s):** `HOST_OWNER`, `HOST_STAFF`
- **Affected Screen(s) & Route(s):** `HD-009` (`/host/operations`)
- **Current Behavior:** Desk pre-fills `"LS-2026-8841"` (`L2331`), **but** `if (isAuthenticated && isHostUuid(trimmedBookingId))` (`L2345`) skips the live API completely and triggers a fake `700ms` `setTimeout` (`L2405-2413`) whenever a human-readable `LS-*` reference is typed! It also ignores `?ref=`/`?mode=` URL parameters linked from `HD-001`/`HD-007` (`L766`), hardcodes `TAG-1`, `BAG_MEDIUM`, `SEAL-LK-90211` (`L2365-2369`), omits `zoneId` selection, and never captures check-in evidence photos.
- **Expected Behavior:** Accept both `LS-*` reference codes (resolving via `GET /hosts/bookings?search=...` to UUID + pre-loading expected bags/zones) and booking UUIDs; hydrate from `?ref=&mode=` search params; allow dynamic per-bag category/tag/seal/zone editing; never simulate handover via `setTimeout` in authenticated mode.
- **User Impact:** Counter staff entering the customer's human booking code `LS-...` accidentally run fake check-in while leaving live DB custody untouched!
- **Business Impact:** Physical bags taken into storage with zero digital chain of custody or ledger tracking.
- **Technical Cause:** `isHostUuid` branch fallback into Phase 2C simulation `setTimeout`.
- **Recommended Correction:** Resolve `LS-*` via `GET /hosts/bookings` before calling `/custody/verify`; delete `setTimeout` simulation path from live mode; wire `zoneId` from live location zones.
- **Dependencies:** `GAP-022`, `GET /hosts/bookings` search hook.
- **Priority:** **Critical**
- **Evidence:** [`HostDashboardPages.tsx:2327-2414`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L2327-L2414).

### `GAP-024` — Host Bookings Status Collapse (`PENDING_PAYMENT`/`DISPUTED` -> `"CONFIRMED"`), Fixed Reject Reasons & Fake Custody Timeline
- **Affected Role(s):** `HOST_OWNER`, `HOST_STAFF`
- **Affected Screen(s) & Route(s):** `HD-007` (`/host/bookings`), `HD-008` (`/host/bookings/:id`)
- **Current Behavior:** [`mapHostBookingToRecord`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L70-L84) defaults unknown statuses (`PENDING_PAYMENT`, `DISPUTED`) to `"CONFIRMED"`; `L1940` leaks `DEMO_BOOKINGS` when `res.bookings.length === 0`; reject/cancel use hardcoded reasons (`L1994-2003`) instead of host input; `HD-008` shows a fake 4-step custody timeline when `events.length === 0` (`L2216-2277`); and there is zero UI for `reportBookingException`.
- **Expected Behavior:** Map all 11 backend statuses faithfully (blocking check-in on `PENDING_PAYMENT`); display clean empty state on `0` bookings; require reject/cancel reason modal; display real `custody_events` (or empty custody state pre-check-in); include `"Report Exception"` action.
- **User Impact:** Staff mistake unpaid `PENDING_PAYMENT` holds for confirmed drop-offs and see fabricated check-in timestamps when none exist.
- **Business Impact:** Physical custody accepted for unpaid bookings.
- **Technical Cause:** Forced `DemoBookingRecord` mapper + missing modal state.
- **Recommended Correction:** Bind directly to `BookingDetail` + `CustodyRecordDetail`; add `getHostBookingDetail` to `marketplaceApi`.
- **Dependencies:** Remove `DEMO_BOOKINGS` import.
- **Priority:** **High**
- **Evidence:** [`HostDashboardPages.tsx:70-84, 1919-2322`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L70-L84).

### `GAP-025` — Host Finance Empty-DB Synthetic Totals & Fake CSV Download (`HD-010`)
- **Affected Role(s):** `HOST_OWNER`
- **Affected Screen(s) & Route(s):** `HD-010` (`/host/finance`)
- **Current Behavior:** Displays fake `LKR 217,058 / 184,500` balances and `DEMO_BOOKINGS` table rows whenever `res.payables.length === 0` (`L2684, L2830`); Export CSV button (`L2728`) only toggles a 3-second fake toast with zero file download.
- **Expected Behavior:** Show authentic minor-unit totals (`0.00 LKR` when no payables exist) strictly for the active business; generate and trigger real CSV download from `liveFinance.payables`.
- **User Impact:** New hosts see phantom `LKR 184,500` net earnings before hosting a single bag.
- **Business Impact:** Severe host billing confusion and payout disputes.
- **Technical Cause:** Empty-array guard reusing Phase 2C mock totals + unimplemented CSV serializer.
- **Recommended Correction:** Remove mock fallback; implement client CSV download helper; scope summary by `selectedBusinessId` (`?businessId=`).
- **Dependencies:** `useHostContextStore` business filter.
- **Priority:** **High**
- **Evidence:** [`HostDashboardPages.tsx:2673-2850`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L2673-L2850).

### `GAP-026` — Unwired Host Bank Payout Details & Dead Statement Actions (`HD-011`)
- **Affected Role(s):** `HOST_OWNER`
- **Affected Screen(s) & Route(s):** `HD-011` (`/host/payouts`)
- **Current Behavior:** `HD-011` (`L2855-3049`) makes **0 API calls**, shows hardcoded demo bank/statement fixtures, has a dead `"Download Sample PDF"` button (`L2979`), and an in-memory bank modal. `marketplaceApi` lacks `getBusinessPayoutDetails`.
- **Expected Behavior:** Read live decrypted/masked payout bank profile via `GET /hosts/businesses/:id/payout-details`, save updates via `PATCH /hosts/businesses/:id` (with confirmation), and display real payout batches once Initiative 6 settlement routes are live.
- **User Impact:** Hosts cannot verify or update their actual Sri Lankan settlement bank account after onboarding.
- **Business Impact:** Failed/misrouted host bank disbursements.
- **Technical Cause:** Missing `marketplaceApi.getBusinessPayoutDetails` wrapper and mocked `HD-011`.
- **Recommended Correction:** Wrap `getBusinessPayoutDetails`, wire edit form to `updateBusiness`, fix `hosts.service.ts:429` role check, and gate disbursement history on live `payout_batches`.
- **Dependencies:** Payout batch endpoints for statement history.
- **Priority:** **Medium**
- **Evidence:** [`HostDashboardPages.tsx:2855-3049`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L2855-L3049), [`hosts.routes.ts:197-227`](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/hosts/hosts.routes.ts#L197-L227).

### `GAP-027` — Missing Host Staff Management API/UI (`HD-013`) & Simulated Reviews (`HD-012`)
- **Affected Role(s):** `HOST_OWNER`
- **Affected Screen(s) & Route(s):** `HD-013` (`/host/staff`), `HD-012` (`/host/reviews`)
- **Current Behavior:** `HD-013` (`L3197-3399`) displays fake staff (`Roshan Fernando`) with dead `"Edit Scope"` (`L3325`) despite `host_staff_memberships` DB table and `assertHostLocationAccess` existing on backend! `HD-012` (`L3054-3192`) displays fake guest reviews & simulated reply toast despite zero `reviews` table/API.
- **Expected Behavior:** Wire `HD-013` to new `/hosts/businesses/:id/staff` endpoints over `host_staff_memberships`; replace `HD-012` fake reviews with honest feature-unavailable / post-MVP notice until reviews backend is built.
- **User Impact:** Host owners cannot onboard real counter staff; owners waste time replying to fake guest reviews.
- **Business Impact:** Prevents real multi-staff store counter operations.
- **Technical Cause:** Backend routes omitted for `host_staff_memberships`; mock screens left active.
- **Recommended Correction:** Implement `/hosts/businesses/:id/staff` endpoints & wire `HD-013`; feature-gate `HD-012`.
- **Dependencies:** Staff API endpoints in Initiative 3.
- **Priority:** **High (`HD-013`) / Low (`HD-012` feature-gate)**
- **Evidence:** [`HostDashboardPages.tsx:3054-3399`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/HostDashboardPages.tsx#L3054-L3399), [`hosts.ts:131-154`](file:///d:/luggage-storage/luggage-storage/apps/api/src/infrastructure/database/schema/hosts.ts#L131-L154).

---

## Superadmin & Support Dashboard Gaps (`GAP-028` – `GAP-036`)

### `GAP-028` — Blind KYC Moderation Without Business Metadata or Document Download (`AD-002`)
- **Affected Role(s):** `SUPERADMIN`, `SUPPORT`
- **Affected Screen(s) & Route(s):** `AD-002` (`/admin/hosts/review`)
- **Current Behavior:** Renders raw `businessId` UUID in queue, never calls `getVerificationDetails` (`marketplace-api.ts:648`) or `getDocumentDownloadUrl` (`L341`), hardcodes `adminNotes: "Superadmin action: ..."` (`AdminDashboardPages.tsx:334`), lacks rejection reason / info-request note prompt, and blocks `SUPPORT` (`L78`).
- **Expected Behavior:** Display legal/trade name, BRN/TIN, owner contact, and clickable presigned document viewer links (`15m` R2 URLs) in an inspection drawer; require structured `rejectionReason` on Reject/Request Info; allow `SUPPORT` read-only view (`admin.host.read`).
- **User Impact:** Admins must blindly approve or reject KYC applications without seeing uploaded BRN/ID files or entering feedback.
- **Business Impact:** Compliance breach — unverified/fraudulent businesses could be approved blind.
- **Technical Cause:** Inspection detail & presigned download endpoints never wired into `AD-002`; queue endpoint omits business details & status filters.
- **Recommended Correction:** Wire `getVerificationDetails` + `getDocumentDownloadUrl` + review note form; enrich `GET /admin/verifications`.
- **Dependencies:** Enriched `GET /admin/verifications` query.
- **Priority:** **Critical**
- **Evidence:** [`AdminDashboardPages.tsx:78, 284-440`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx#L284-L440), [`marketplace-api.ts:341-349, 648-653`](file:///d:/luggage-storage/luggage-storage/apps/web/src/services/marketplace-api.ts#L341-L349).

### `GAP-029` — Blind Location Moderation Without Photos, Hours, Pricing or Coordinates (`AD-004`)
- **Affected Role(s):** `SUPERADMIN`, `SUPPORT`
- **Affected Screen(s) & Route(s):** `AD-004` (`/admin/locations`)
- **Current Behavior:** Approves or rejects listings from a summary list without calling `getLocationById` (`marketplace-api.ts:166`), so reviewers never inspect R2 photos, exact street address/coordinates, opening hours, capacity pools, or pricing rates; hardcodes `adminNotes` (`L525`).
- **Expected Behavior:** Opening a pending listing loads full `GET /hosts/locations/:locationId` details (gallery, map pin/address, weekly hours, capacity pools, pricing policy) and requires clear feedback on Reject.
- **User Impact:** Reviewers cannot verify safety, photos, or location accuracy before publishing venues to travellers.
- **Business Impact:** Unsafe or inaccurately located listings could go live.
- **Technical Cause:** `getLocationById` unused in `AD-004`.
- **Recommended Correction:** Add Location Inspection Drawer in `AD-004` calling `getLocationById`; allow `SUPPORT` read-only (`admin.location.read`).
- **Dependencies:** `location.routes.ts` read check allowing `ADMIN_LOCATION_READ`.
- **Priority:** **Critical**
- **Evidence:** [`AdminDashboardPages.tsx:80, 482-623`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx#L482-L623).

### `GAP-030` — Unwired User Governance & RBAC UI Despite 12 Live Backend Endpoints (`AD-018`)
- **Affected Role(s):** `SUPERADMIN`
- **Affected Screen(s) & Route(s):** `AD-018` (`/admin/staff`)
- **Current Behavior:** [`AdminStaffRbacManagementPage`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx#L1674-L1698) renders 2 static `<p>` lines claiming RBAC enforcement while making **0 API calls**! All 12 `/admin/users*`, `/admin/roles`, `/admin/permissions` endpoints in `admin.routes.ts:40-543` have zero Web client wrappers or UI.
- **Expected Behavior:** Full Admin Users & RBAC console allowing user search/status filter, inspecting user effective permissions, suspending/reinstating/deactivating/reactivating/verifying users with required reason modals, and assigning/revoking roles (`SUPPORT`, `HOST_OWNER`, `HOST_STAFF`, `SUPERADMIN`) respecting last-Superadmin guard.
- **User Impact:** Superadmins cannot provision Support staff, suspend abusive accounts, or manage roles via the Web app.
- **Business Impact:** Platform operations depend on raw SQL or curl calls instead of audited Web tooling.
- **Technical Cause:** Phase 1B admin endpoints were never wrapped in `auth-api.ts` or wired into `AD-018`.
- **Recommended Correction:** Add 12 client wrappers + build `AD-018` User & RBAC Governance workspace.
- **Dependencies:** Sync `SYSTEM_PERMISSIONS` in `packages/contracts/src/rbac/index.ts`.
- **Priority:** **Critical**
- **Evidence:** [`AdminDashboardPages.tsx:1674-1698`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx#L1674-L1698), [`admin.routes.ts:40-543`](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/admin/admin.routes.ts#L40-L543).

### `GAP-031` — Linear-Only Refund Transition UI Blocks `FAILED` / `MANUAL_REVIEW_REQUIRED` Recovery (`AD-007`)
- **Affected Role(s):** `SUPERADMIN`, `SUPPORT`
- **Affected Screen(s) & Route(s):** `AD-007` (`/admin/refunds`)
- **Current Behavior:** `nextRefundStage` (`AdminDashboardPages.tsx:900-915`) forces linear forward progression (`REQUESTED -> AUTHORIZED -> INITIATED -> PROCESSING -> SUCCEEDED`), leaving no UI path to flag `MANUAL_REVIEW_REQUIRED`, mark `FAILED`, or recover stalled refunds (`MANUAL_REVIEW_REQUIRED -> SUCCEEDED`). UI also references mock 7-stage labels (`L1190`).
- **Expected Behavior:** Provide explicit allowed transition buttons/selector based on current backend refund status (e.g., `PROCESSING` -> `SUCCEEDED` | `MANUAL_REVIEW_REQUIRED` | `FAILED`, and `MANUAL_REVIEW_REQUIRED` -> `SUCCEEDED` | `FAILED`), capturing `gatewayRefundReference`, `failureReason`, and `evidenceNotes`.
- **User Impact:** Stuck or failed bank refunds cannot be resolved or retried cleanly by Superadmins.
- **Business Impact:** Unsettled customer refunds and inaccurate ledger reconciliation.
- **Technical Cause:** Hardcoded linear `nextRefundStage` helper in `AD-007`.
- **Recommended Correction:** Replace single next-step helper with full state-transition picker using `REFUND_STATUSES`.
- **Dependencies:** None.
- **Priority:** **High**
- **Evidence:** [`AdminDashboardPages.tsx:900-915, 1190`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx#L900-L915).

### `GAP-032` — Silent Fake-Data Fallback Across Live Admin Screens (`AD-005`, `AD-006`, `AD-007`, `AD-010`, `AD-017`)
- **Affected Role(s):** `SUPERADMIN`, `SUPPORT`
- **Affected Screen(s) & Route(s):** `/admin/bookings`, `/admin/payments`, `/admin/refunds`, `/admin/finance/ledger`, `/admin/audit`
- **Current Behavior:** All 5 partially live screens render `DEMO_BOOKINGS`, `#RFD-8799`, `JRN-901..903`, or sample `AUTH_LOGIN_SUCCESS` strings (`AD-017` `L1639-1656`) whenever live arrays are empty, queries are loading, or `.catch(() => {})` swallows a network/403 failure.
- **Expected Behavior:** Loading state renders table skeleton; `0` matching rows renders `"No records match the current filter"`; API errors render explicit red alert with Retry button.
- **User Impact:** Operators filtering for a refund or audit event see fake historical fixtures instead of "0 results", causing wrong operational conclusions.
- **Business Impact:** High risk of financial/compliance misreporting.
- **Technical Cause:** Ternary `liveItems.length > 0 ? liveItems : DEMO_*` rendering pattern + swallowed catches.
- **Recommended Correction:** Remove all `DEMO_*` / hardcoded table arrays from live Admin components via TanStack Query states.
- **Dependencies:** Demo Preview Adapter isolation.
- **Priority:** **Critical**
- **Evidence:** [`AdminDashboardPages.tsx:736, 842, 1639-1656`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx#L1639-L1656).

### `GAP-033` — Frontend/Backend `SUPPORT` Role Drift Across Admin Navigation & Actions
- **Affected Role(s):** `SUPPORT`, `SUPERADMIN`
- **Affected Screen(s) & Route(s):** `AdminDashboardLayout` (`L77-94`), `AD-001`, `AD-002`, `AD-004`, `AD-005`, `AD-006`, `AD-007`, `AD-018`
- **Current Behavior:** Backend (`0006` + `0012`) explicitly grants `SUPPORT` read-only access to `admin.host.read`, `admin.location.read`, `admin.booking.read`, `admin.payment.read`, `admin.refund.read`, and `admin.user.read`. Yet Web sidebar (`L77-94`) sets `superadminOnly: true` on `AD-002`, `AD-004`, `AD-006`, `AD-007`, `AD-018` (blocking `SUPPORT`), while `AD-005` (`L727`) exposes `"Admin Cancel"` to `SUPPORT` who then hits a `403` error!
- **Expected Behavior:** Drive sidebar visibility and mutation button gating directly from `user.permissions` (`SYSTEM_PERMISSIONS` codes) aligned 1:1 with backend `requirePermission` guards (`SUPPORT` gets read-only visibility on users/hosts/locations/bookings/payments/refunds; `SUPERADMIN` retains write/finance actions).
- **User Impact:** Support agents are blocked from viewing payments, refunds, and KYC applications they need to answer customer tickets, while clicking `"Admin Cancel"` triggers unexpected `403` errors.
- **Business Impact:** Support team cannot investigate customer issues independently.
- **Technical Cause:** Binary `superadminOnly` nav boolean ignoring granular `SYSTEM_PERMISSIONS` + missing `PermissionGate` on `AD-005` Cancel button.
- **Recommended Correction:** Replace `superadminOnly` flags with `requiredPermissions[]` checked against `useAuthStore.hasAnyPermission`.
- **Dependencies:** Sync `SYSTEM_PERMISSIONS` in `@luggage-storage/contracts`.
- **Priority:** **High**
- **Evidence:** [`AdminDashboardPages.tsx:77-94, 727, 791, 870-872`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx#L77-L94).

### `GAP-034` — Hardcoded Platform KPIs (`AD-001`) & Host Directory (`AD-003`)
- **Affected Role(s):** `SUPERADMIN`, `SUPPORT`
- **Affected Screen(s) & Route(s):** `AD-001` (`/admin`), `AD-003` (`/admin/hosts`)
- **Current Behavior:** `AD-001` (`L223-440`) hardcodes `LKR 4,280,000` GMV and displays a developer screen-index catalog (`WEB_ADMIN_SCREENS`); `AD-003` (`L444-478`) displays `DEMO_LOCATIONS` rows as the host business directory.
- **Expected Behavior:** Wire `AD-001` to live `GET /admin/metrics/summary` (role-scoped, removing dev `WEB_ADMIN_SCREENS` directory from production UI) and wire `AD-003` to `GET /admin/hosts` + host detail/suspend controls.
- **User Impact:** Executives and operators see completely synthetic GMV numbers and fake businesses.
- **Business Impact:** Zero operational observability for live platform launch.
- **Technical Cause:** Backend summary & admin host directory endpoints absent; Phase 2C UI left active.
- **Recommended Correction:** Add `GET /admin/metrics/summary` and `GET/POST /admin/hosts*` routes + TanStack Query hooks.
- **Dependencies:** Backend admin host & metrics extensions.
- **Priority:** **High**
- **Evidence:** [`AdminDashboardPages.tsx:221-280, 442-478`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx#L221-L280).

### `GAP-035` — Disconnected Incidents & Disputes Workspace (`AD-013`)
- **Affected Role(s):** `SUPERADMIN`
- **Affected Screen(s) & Route(s):** `AD-013` (`/admin/incidents`)
- **Current Behavior:** `AD-013` (`L1412-1439`) renders a static text block despite live `DISPUTED` bookings and `GET /admin/bookings/:id/custody` existing on the backend (and despite `GAP-022` actively creating `DISPUTED` rows!).
- **Expected Behavior:** Display live `GET /admin/bookings?status=DISPUTED` queue, inspect chain-of-custody logs & exception notes, and resolve disputes via new `POST /admin/bookings/:id/resolve-dispute` (`COMPLETED` + payable release vs `CANCELLED`/refund).
- **User Impact:** Superadmins have no Web screen to review or resolve custody disputes.
- **Business Impact:** Disputed bookings and `ON_HOLD` host payables pile up unresolvable from the UI.
- **Technical Cause:** Static placeholder left in `AD-013` + missing dispute resolution backend transition.
- **Recommended Correction:** Wire `AD-013` to `GET /admin/bookings?status=DISPUTED` + custody detail + new `resolve-dispute` endpoint.
- **Dependencies:** Dispute resolution backend endpoint.
- **Priority:** **High**
- **Evidence:** [`AdminDashboardPages.tsx:1412-1439`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx#L1412-L1439).

### `GAP-036` — Unimplemented Payout Batches, Support Queue, Reviews, Promotions & Unsaved Settings Controls (`AD-008`, `AD-009`, `AD-011`, `AD-012`, `AD-014`–`AD-016`)
- **Affected Role(s):** `SUPERADMIN`, `SUPPORT`
- **Affected Screen(s) & Route(s):** `/admin/payouts/*`, `/admin/support/*`, `/admin/reviews`, `/admin/promotions`, `/admin/settings`
- **Current Behavior:** `AD-008`, `AD-009`, `AD-014`, `AD-015` render `DeferredBackendNotice`; `AD-011`/`AD-012` render static fake `TKT-9042` prototype workspace; and **`AD-016` (`L1485-1553`) renders interactive `<select>`/`<input>` configuration controls with no Save button and zero persistence**.
- **Expected Behavior:** Implement MVP persistence for Payout Batches (`AD-008`/`009`) and Support Tickets (`AD-011`/`012`) in Initiative 6; cleanly gate post-MVP growth modules (`AD-014` Reviews, `AD-015` Promotions) behind feature flags; replace `AD-016` fake inputs with read-only display of authoritative backend constants until dynamic settings are built.
- **User Impact:** Admins think changing dropdowns on `/admin/settings` reconfigures commission/grace rules when nothing saves; Support triage shows hardcoded fake ticket `TKT-9042`.
- **Business Impact:** Operational confusion and unpersisted administrative actions.
- **Technical Cause:** Unbuilt backend modules (`payout_batches`, `support_tickets`, `reviews`, `promotions`, `platform_settings`).
- **Recommended Correction:** Separate MVP-required operations (`payout_batches`, `support_tickets`) from cleanly gated post-MVP growth features (`AD-014`–`016`) and remove interactive fake inputs on `AD-016`.
- **Dependencies:** Initiative 6 backend modules + external `OQ-003`/`OQ-010` gates on live payouts.
- **Priority:** **High (`AD-008/009/011/012`) / Medium (`AD-016` misleading controls) / Low (`AD-014/015` feature-gate)**
- **Evidence:** [`AdminDashboardPages.tsx:1206-1553`](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/AdminDashboardPages.tsx#L1206-L1553).

