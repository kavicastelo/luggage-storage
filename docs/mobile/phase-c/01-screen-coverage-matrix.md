# Stage C0.1 — Mobile Screen Coverage Matrix & 113-Screen Reconciliation

**Reference Registry:** `docs/product/ux/master-screen-registry.md` (113 Active Catalogued Screens + 11 Reserved IDs = 124 Span, plus shared Auth/Account routes).

---

## 1. Platform Classification Summary

| Surface | Prefix | Active Spec Count | Reserved IDs | Target Runtime | Phase C Scope |
| :--- | :--- | :---: | :---: | :--- | :--- |
| Traveller Mobile | `TM-xxx` | 39 | 5 (`TM-009,010,025,026,038`) | Expo React Native (`apps/mobile`) | **IN SCOPE** (Standalone routes + modal/sub-flows; backend gaps flagged honestly) |
| Host Mobile | `HM-xxx` | 31 | 6 (`HM-008,012,015,016,017,032`) | Expo React Native (`apps/mobile`) | **IN SCOPE** (Standalone routes + modal/sub-flows; owner/staff RBAC enforced) |
| Shared Identity/Account | App Router | 9 | 0 | Expo React Native (`apps/mobile`) | **IN SCOPE** (`app/index.tsx`, `(auth)/*`, `(account)/*`, `__DEV__` icon catalogue) |
| Public Web | `PW-xxx` | 11 | 0 | React + Vite (`apps/web`) | **NOT APPLICABLE** (Web-only) |
| Host Web Dashboard | `HD-xxx` | 14 | 0 | React + Vite (`apps/web`) | **NOT APPLICABLE** (Web-only; mobile `HM` counterparts covered) |
| Superadmin Web Dashboard | `AD-xxx` | 18 | 0 | React + Vite (`apps/web`) | **NOT APPLICABLE** (Admin Web-only) |
| **Total Spec Catalogued** | | **113** | **11** | | **70 Mobile Spec Screens + Shared Auth/Account in scope; 43 Web/Admin N/A** |

---

## 2. Traveller Mobile Application (`TM-001`..`TM-044` — 39 Active Screens)

| Screen ID | Screen Name | Expo Router Route / Flow | User Role | Baseline Status | API Dependency | API Status | Interaction Status | Test Coverage | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `TM-001` | Splash & Entry | `app/index.tsx`, `_layout.tsx` | Shared | Partial (legacy `#2563eb` UI) | `POST /auth/refresh`, `GET /auth/me` | Connected | Functional | `auth-store.test.ts` | P0 |
| `TM-002` | Onboarding Welcome | `/(traveller)/onboarding` | Traveller | Partial (uncontracted copy removed, no storage flag) | None (client intro) | N/A | Partial | `traveller-mobile-audit-verification.test.ts` | P2 |
| `TM-003` | Permissions Request | Modal/inline in `explore` & `onboarding` | Traveller | Partial (no real location prompt flow) | None (OS permissions) | N/A | Partial | Minimal | P2 |
| `TM-004` | Language & Currency Selector | Inline in `profile` / `onboarding` | Traveller | Partial (`LKR` only market, display only) | None (LKR launch) | N/A | Partial | None | P2 |
| `TM-005` | Login Screen | `/(auth)/login` | Shared | Partial (legacy UI, broken TM-008 link) | `POST /auth/login` | Connected | Functional | `auth-flows.test.ts` | P0 |
| `TM-006` | Registration Screen | `/(auth)/register` | Shared | Partial (legacy UI, broken TM-008 link) | `POST /auth/register` | Connected | Functional | `auth-flows.test.ts` | P0 |
| `TM-007` | Forgot Password | `/(auth)/forgot-password` + `reset-password` | Shared | Partial (legacy UI, `reset-password` ignores `?token`) | `POST /auth/forgot-password`, `POST /auth/reset-password` | Connected | Functional | `auth-flows.test.ts` | P0 |
| `TM-008` | Email Verification | `/(auth)/verify-email` *(missing -> create)* | Shared | **Missing** (broken query param redirect) | `POST /auth/verify-email`, `POST /auth/resend-verification` | **Disconnected** | Dead | `auth-flows.test.ts` (API client only) | P0 |
| `TM-011` | Home & Destination Search | `/(traveller)/index` -> consolidated with `explore` | Traveller | **Broken** (100% `DEMO_LOCATIONS`/`DEMO_BOOKINGS`) | `GET /discovery/locations`, `GET /bookings` | Mocked | Partial | `traveller-mobile-journeys.test.ts` | P0 |
| `TM-012` | Geospatial Discovery | `/(traveller)/explore` (area/radius/city filter view) | Traveller | Partial (falls back to `DEMO_LOCATIONS`) | `GET /discovery/locations`, `GET /availability/search` | Partial | Partial | Minimal | P0 |
| `TM-013` | Discovery List & Filters | `/(traveller)/explore` | Traveller | Partial (fabricates rating/insurance/capacity) | `GET /discovery/locations` | Partial | Partial | Minimal | P0 |
| `TM-014` | Filter Modal / Sheet | `BottomSheet` in `/(traveller)/explore` | Traveller | Partial (filter state on mock items) | `GET /discovery/locations`, `GET /availability/search` | Mocked | Partial | Minimal | P1 |
| `TM-015` | Storage Location Details | `/(traveller)/location?id=<uuid>` | Traveller | **Broken** (`DEMO_LOCATIONS` only; ignores live ID) | `GET /discovery/locations/:locationId` | **Mocked** | Dead (real IDs) | None | P0 |
| `TM-016` | Location Reviews & Ratings | Section in `/(traveller)/location` | Traveller | Broken (fake `4.8` / `24`) | **Missing Backend** (`averageRating: null, reviewCount: 0`) | Missing | N/A | None | P2 |
| `TM-017` | Booking Date & Time Picker | `/(traveller)/checkout` (Schedule step) | Traveller | **Broken** (static `"Today • Nov 09"`, hardcoded `+24h`) | Input to `POST /bookings/quote` | Mocked | Dead | Minimal | P0 |
| `TM-018` | Bag Selection & Counter | `/(traveller)/checkout` (Luggage step) | Traveller | Partial | Input to `POST /bookings/quote` | Partial | Partial | Minimal | P0 |
| `TM-019` | Price Breakdown & Checkout | `/(traveller)/checkout` (Quote + Confirm) | Traveller | Partial (fake pass `setTimeout` fallback) | `POST /bookings/quote`, `POST /bookings` | Partial | Partial | `phase-b-mobile-flows.test.ts` | P0 |
| `TM-020` | Payment Gateway Handoff | `/(traveller)/checkout` (`REDIRECT_TO_PROVIDER` / `SANDBOX_SIMULATION`) | Traveller | **Broken fallback** (`else` triggers `simulateSandboxPayment`) | `POST /payments/intents`, `/payments/handoff/:t` | Partial | Partial | `phase-b-checkout-handoff.test.ts` | P0 |
| `TM-021` | Payment Status Polling | `PaymentStatusPanel` in `checkout` | Traveller | Partial | `GET /payments/checkout-status` | Connected | Partial | `phase-b-checkout-handoff.test.ts` | P0 |
| `TM-022` | Host Approval Pending | State card in `checkout` & `bookings` | Traveller | Broken (`bookings.tsx` maps to `CONFIRMED`) | `GET /bookings/:bookingId` | Partial | Partial | None | P0 |
| `TM-023` | Payment Failed State | `ErrorState` / retry card in `checkout` | Traveller | Partial | `POST /payments/intents` retry | Partial | Partial | `phase-b-checkout-handoff.test.ts` | P0 |
| `TM-024` | Booking Confirmation | State/link to `/(traveller)/pass?bookingId=` | Traveller | Partial | `GET /bookings/:bookingId` | Partial | Partial | `phase-b-checkout-handoff.test.ts` | P0 |
| `TM-027` | Booking Detail View | Modal/sheet in `bookings` & `pass` | Traveller | Partial (`DEMO_BOOKINGS` spread) | `GET /bookings/:bookingId` | Partial | Partial | None | P0 |
| `TM-028` | Check-in Handover Pass | `/(traveller)/pass?bookingId=` | Traveller | Broken (fake QR icon + `demoBooking` spread) | `POST /bookings/:id/custody-pass` (`CHECK_IN`) | Partial | Partial | `phase-b-checkout-handoff.test.ts` | P0 |
| `TM-029` | In-Storage Live Status | Section in `bookings` & `pass` | Traveller | Partial (fake `setTimeout` extension modal) | `GET /bookings/:bookingId` | Partial | Partial | None | P1 |
| `TM-030` | Collection Handover Pass | `/(traveller)/pass?bookingId=` | Traveller | Broken (fake QR icon + `demoBooking` spread) | `POST /bookings/:id/custody-pass` (`COLLECTION`) | Partial | Partial | None | P0 |
| `TM-031` | Booking Cancellation Flow | Modal in `/(traveller)/bookings` | Traveller | Broken (swallows errors in `catch {}`) | `POST /bookings/:bookingId/cancel` | Partial | Partial | `phase-b-mobile-flows.test.ts` | P0 |
| `TM-032` | Cancellation Receipt & Status | Detail view in `/(traveller)/bookings` | Traveller | Partial | `GET /bookings/:bookingId` | Partial | Partial | None | P1 |
| `TM-033` | Refund Detail Information | Card in `/(traveller)/bookings` | Traveller | Partial (static demo progress bar) | `GET /bookings/:bookingId` (`refund` data when present) | Partial | Partial | `traveller-mobile-journeys.test.ts` | P1 |
| `TM-034` | Submit Review & Rating | Removed fake modal -> Backend Gap | Traveller | Fake local modal | **Missing Backend** | Missing | N/A | N/A | P2 |
| `TM-035` | Booking History List | `/(traveller)/bookings` | Traveller | Partial (shows `DEMO_BOOKINGS` when empty) | `GET /bookings` | Partial | Partial | `phase-b-mobile-flows.test.ts` | P0 |
| `TM-036` | Saved Favourites | `/(traveller)/saved` | Traveller | **Broken** (`DEMO_LOCATIONS` hardcoded IDs) | No backend endpoint -> device UUIDs + `GET /discovery/locations/:id` | Client + Live Hydrate | Dead | None | P1 |
| `TM-037` | Notifications Feed | Derived status alerts only | Traveller | Not implemented as server inbox | **Missing Backend** | Missing | N/A | N/A | P2 |
| `TM-039` | Help & Support Centre | `/(traveller)/support` | Traveller | Partial (static demo FAQs, fake chat reply) | `POST /bookings/:id/exceptions` (disputes only) | Partial | Partial | `traveller-mobile-audit-verification.test.ts` | P1 |
| `TM-040` | Report Booking Exception | Modal in `support` / `bookings` | Traveller | **Missing** (`support.tsx` simulates ticket locally) | `POST /bookings/:bookingId/exceptions` | Missing in UI | Dead | None | P1 |
| `TM-041` | Ticket Conversation Thread | Replaced by honest backend-gap notice | Traveller | Fake hardcoded thread | **Missing Backend** | Missing | N/A | N/A | P2 |
| `TM-042` | Traveller Profile & Account | `/(traveller)/profile` & `/(account)/profile` | Shared | Partial (legacy UI) | `GET /auth/me` (`PATCH /identity/profile` missing in API) | Connected (read) | Partial | Minimal | P0 |
| `TM-043` | Security & Sessions | `/(account)/security` & `/(account)/sessions` | Shared | Partial (legacy UI, `Alert.alert`, emoji) | `POST /auth/change-password`, `GET/DELETE /auth/sessions`, `POST /auth/logout-all` | Connected | Functional | Minimal | P0 |
| `TM-044` | App Settings | Section in `/(traveller)/profile` | Traveller | Partial | Local prefs / auth links | N/A | Partial | None | P2 |

*(Reserved `TM-009`, `TM-010`, `TM-025`, `TM-026`, `TM-038` are not active screens and remain unimplemented.)*

---

## 3. Host Mobile Application (`HM-001`..`HM-037` — 31 Active Screens)

| Screen ID | Screen Name | Expo Router Route / Flow | User Role | Baseline Status | API Dependency | API Status | Interaction Status | Test Coverage | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `HM-001` | Host Portal Entry & Guard | `/(host)/_layout` | Host / Staff | **Broken** (allows unauth Demo Mode) | `GET /auth/me`, `GET /hosts/businesses` | Partial | Partial | `host-mobile-journeys.test.ts` | P0 |
| `HM-002` | Host Login / Entry | `/(auth)/login` + Host RBAC gate | Host / Staff | Connected | `POST /auth/login` | Connected | Functional | `auth-flows.test.ts` | P0 |
| `HM-003` | Business Profile Setup | `/(host)/onboarding` & `settings` | Host Owner | **Missing** | `POST /hosts/businesses`, `PATCH /hosts/businesses/:id`, `POST /auth/refresh` | **Missing in UI** | Dead | None | P0 |
| `HM-004` | KYC Document Upload | `/(host)/onboarding` | Host Owner | **Missing** | `POST /uploads/presigned-url`, `PUT` R2, `POST /uploads/confirm` | **Missing in UI** | Dead | None | P0 |
| `HM-005` | Host Application Status | `/(host)/onboarding` & banner on `index` | Host Owner | **Missing** | `POST /hosts/businesses/:id/verification`, `GET .../verification` | **Missing in UI** | Dead | None | P0 |
| `HM-006` | Host Operations Dashboard | `/(host)/index` | Host / Staff | **Broken** (100% mock `useHostStore`) | `GET /hosts/businesses`, `/hosts/locations`, `/hosts/bookings`, `/hosts/finance/summary` | **Mocked** | Dead | `host-mobile-journeys.test.ts` | P0 |
| `HM-007` | Today's Expected Schedule | Section in `/(host)/index` & `requests` | Host / Staff | **Broken** (mock `useHostStore`) | `GET /hosts/bookings` | Mocked | Dead | Minimal | P0 |
| `HM-009` | Storage Location Profile | `/(host)/locations` & `location-editor` | Host Owner | **Missing** | `GET/POST/PATCH /hosts/locations`, `POST /submit`, `POST /disable`, media upload | **Missing in UI** | Dead | None | P0 |
| `HM-010` | Operating Hours Editor | Section in `/(host)/location-editor` | Host Owner | **Missing** | `PUT /hosts/locations/:id/opening-hours` | **Missing in UI** | Dead | None | P0 |
| `HM-011` | Schedule Exceptions | Section in `/(host)/location-editor` | Host Owner | **Missing** | `POST /hosts/locations/:id/exceptions` | **Missing in UI** | Dead | None | P1 |
| `HM-013` | Capacity Pools & Zones | Section in `/(host)/location-editor` | Host Owner | **Missing** | `POST .../zones`, `GET/POST .../capacity-pools`, `PATCH .../capacity-pools/:poolId` | **Missing in UI** | Dead | None | P0 |
| `HM-014` | Pricing Rules Editor | Section in `/(host)/location-editor` | Host Owner | **Missing** | `GET/PUT /hosts/locations/:id/pricing` | **Missing in UI** | Dead | None | P0 |
| `HM-018` | Booking Requests Queue | `/(host)/requests` | Host / Staff | Partial (`DEMO_HOST_BOOKINGS` fallback, bad status map) | `GET /hosts/bookings` | Partial | Partial | `phase-b-mobile-flows.test.ts` | P0 |
| `HM-019` | Request Review & Decision | Card + `ConfirmDialog` in `requests` | Host / Staff | Partial (hidden by status bug) | `POST /hosts/bookings/:id/accept`, `.../reject`, `.../cancel` | Partial | Partial | `phase-b-mobile-flows.test.ts` | P0 |
| `HM-020` | Active Bookings List | `/(host)/requests` & `/(host)/vault` | Host / Staff | Partial (`useHostStore` mix) | `GET /hosts/bookings` | Partial | Partial | Minimal | P0 |
| `HM-021` | Check-in Scanner & PIN | `/(host)/scanner` | Host / Staff | Partial (allows bypassing API when no `bookingId`) | `POST /hosts/custody/verify` | Partial | Partial | `host-mobile-journeys.test.ts` | P0 |
| `HM-022` | Bag Inspection & Tagging | `/(host)/intake` | Host / Staff | Partial (hardcodes `BAG_MEDIUM`, mock zones fallback) | `POST /hosts/custody/:id/check-in` | Partial | Partial | `phase-b-mobile-flows.test.ts` | P0 |
| `HM-023` | Check-in Evidence Option | Step in `/(host)/intake` (`OQ-014` / `DEC-001`) | Host / Staff | Partial (`expo-image-picker` local only) | No backend custody photo endpoint (`OQ-014` optional) | Client-only per `OQ-014` | Partial | `host-mobile-journeys.test.ts` | P1 |
| `HM-024` | Collection Verification | `/(host)/scanner?operation=COLLECTION` | Host / Staff | Partial (hardcodes `CHECK_IN` fallback) | `POST /hosts/custody/verify` (`COLLECTION`) | Partial | Partial | Minimal | P0 |
| `HM-025` | Handover Release | Modal in `/(host)/vault` via verified PIN/QR | Host / Staff | Partial (`useHostStore` mix) | `POST /hosts/custody/:id/check-out` | Partial | Partial | `phase-b-mobile-flows.test.ts` | P0 |
| `HM-026` | Overdue Bags View | Filter in `/(host)/vault` | Host / Staff | Mocked (`useHostStore`) | `GET /hosts/custody/:bookingId`, `GET /hosts/bookings` | Mocked | Dead | `host-mobile-journeys.test.ts` | P0 |
| `HM-027` | Overdue Fee Info | Computed readout in `completeCollection` | Host / Staff | Mocked | Returned by `POST /check-out` (`overdueMinutes`, `overdueFeeMinor`) | Partial | Dead | None | P1 |
| `HM-028` | Mandatory Release (`BR-035`) | Release in `/(host)/vault` (`OQ-015`) | Host / Staff | Partial | `POST /hosts/custody/:id/check-out` | Partial | Partial | `host-mobile-journeys.test.ts` | P0 |
| `HM-029` | Host Earnings & Balance | `/(host)/earnings` | Host Owner | Partial (`DEMO_HOST_TRANSACTIONS` rendered always) | `GET /hosts/finance/summary` | Partial | Partial | `phase-b-mobile-flows.test.ts` | P0 |
| `HM-030` | Payout Bank Account Details | Section in `/(host)/earnings` | Host Owner | **Missing** | `GET /hosts/businesses/:id/payout-details` | **Missing in UI** | Dead | None | P0 |
| `HM-031` | Payout Payables & Adjustments | List in `/(host)/earnings` | Host Owner | **Broken** (renders `DEMO_HOST_TRANSACTIONS`) | `GET /hosts/finance/summary` (`payables[]`) | Disconnected | Dead | None | P0 |
| `HM-033` | Staff Management List | Notice in `/(host)/settings` | Host Owner | Mocked (`Roshan Fernando`, etc.) | **Missing Backend** (`OQ-017` invites not mounted) | Missing | N/A | N/A | P2 |
| `HM-034` | Invite Staff Member | Documented backend dependency | Host Owner | Not supported in API | **Missing Backend** | Missing | N/A | N/A | P2 |
| `HM-035` | Host Customer Reviews | Documented backend dependency | Host / Staff | Not supported in API | **Missing Backend** | Missing | N/A | N/A | P2 |
| `HM-036` | Incident / Exception Report | Modal in `requests` / `vault` | Host / Staff | **Missing** | `POST /bookings/:id/exceptions` | Missing in UI | Dead | None | P1 |
| `HM-037` | Host Business Settings | `/(host)/settings` | Host Owner | Broken (read-only + demo reset button) | `PATCH /hosts/businesses/:id`, sign-out, nav to locations/onboarding | Disconnected | Dead | `host-mobile-journeys.test.ts` | P0 |

*(Reserved `HM-008`, `HM-012`, `HM-015`, `HM-016`, `HM-017`, `HM-032` remain unimplemented. Web `PW-001`..`PW-011`, `HD-001`..`HD-014`, and `AD-001`..`AD-018` are `NOT APPLICABLE` to mobile.)*
