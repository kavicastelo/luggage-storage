# Stage C0.3 — Mock Data & Placeholder Inventory

Audit across `apps/mobile/app/**` and `apps/mobile/src/**` classifying every hardcoded fixture, fake timer, fallback, and placeholder into Categories 1–3.

---

## Classification Key

- **Category 1 — Test-Only Fixture:** Isolated test fixtures and test harnesses (`apps/mobile/tests/**` and fixture constants exported exclusively for automated verification / unit tests). Keep out of production runtime journeys.
- **Category 2 — Explicit Development Demonstration:** Developer tooling strictly gated behind `__DEV__` (`MobileDevDrawer`, dev Icon Catalogue, explicit opt-in `__DEV__` preview toggles) and disabled/hidden in production bundles.
- **Category 3 — Unintended Production Fallback (MUST REMOVE):** Mock data, fake calculations, or `setTimeout` simulations that leak into production Traveller or Host workflows on empty results, errors, or default state.

---

## Inventory Table

| File & Lines | Identifier / Pattern | Classification | Required Phase C Action |
| :--- | :--- | :---: | :--- |
| `apps/mobile/tests/mocks/expo-secure-store.ts` | In-memory SecureStore Vitest mock | Category 1 | Keep (test harness only). |
| `apps/mobile/src/data/mock-marketplace.ts` (`L1-915`) | `TRAVELLER_MOBILE_SCREENS`, `HOST_MOBILE_SCREENS`, `RESERVED_MOBILE_SCREEN_IDS` metadata registry | Category 1 / Category 2 | Keep screen metadata registry for QA/tests (`phase-2-screens-and-mascots.test.ts`, `__DEV__` drawer); strip all production consumer screen imports of `DEMO_*`. |
| `apps/mobile/src/data/mock-marketplace.ts` (`L922-1350`) | `DEMO_LOCATIONS`, `DEMO_BOOKINGS` | Category 1 (referenced by fixture tests) / **Category 3 in screens** | **Remove all imports from `app/(traveller)/*.tsx`**. Retain export in `mock-marketplace.ts` solely for unit fixture tests (`traveller-mobile-journeys.test.ts` fixture checks) with `@deprecated TEST FIXTURE ONLY` docblock. |
| `apps/mobile/src/data/mock-host-data.ts` & `src/store/useHostStore.ts` | `DEMO_HOST_HUB`, `DEMO_HOST_BOOKINGS`, `DEMO_HOST_TRANSACTIONS`, `DEMO_SCANNER_FIXTURES` | Category 1 (referenced by `host-mobile-journeys.test.ts`) / **Category 3 in screens** | **Remove all imports from `app/(host)/*.tsx`**. Host UI must read/mutate exclusively via live TanStack Query + `marketplaceApi`. |
| `apps/mobile/app/(traveller)/index.tsx` (`L13-49, 251-386`) | Renders `DEMO_BOOKINGS` active banner & `DEMO_LOCATIONS` list; fake `"24/7 OPEN"` | **Category 3** | **Remove.** Consolidate/wire Home to live `marketplaceApi.searchLocations` + authenticated `marketplaceApi.getMyBookings`. |
| `apps/mobile/app/(traveller)/explore.tsx` (`L10-19, 150`) | Falls back to `DEMO_LOCATIONS`, fabricates `rating: 4.8`, `insuranceLimitLkr: 250000`, `totalCapacity: 50` | **Category 3** | **Remove.** Render only live API locations with honest `ErrorState` / `EmptyState` and real rate fields. |
| `apps/mobile/app/(traveller)/location.tsx` (`L10-20, 80, 141`) | Looks up location solely in `DEMO_LOCATIONS` (`DEMO_LOCATIONS[0]` fallback) | **Category 3** | **Remove.** Fetch real `marketplaceApi.getPublicLocationDetails(id)`. |
| `apps/mobile/app/(traveller)/checkout.tsx` (`L19-40, 369, 478, 490`) | `DEMO_LOCATIONS` lookup, static `"Today • Nov 09"`, hardcoded `+24h/+33h`, `setTimeout` unauth redirect, **dangerous `else` fallback to `simulateSandboxPayment`** | **Category 3 (Critical Security/Functional)** | **Remove.** Live location details, real interactive `DateTimeSelector`, strict fail-closed `nextAction` branches (`REDIRECT_TO_PROVIDER` vs explicit `SANDBOX_SIMULATION` only), remove fake unauth timeout redirect. |
| `apps/mobile/app/(traveller)/pass.tsx` (`L11-25, 187`) | Spreads `demoBooking` onto live passes; `<MobileIcon name="qr-code" />` fake QR | **Category 3** | **Remove.** Server-issued pass only + real `QrCodeMatrix` encoding `qrToken`. |
| `apps/mobile/app/(traveller)/bookings.tsx` (`L12-61, 468`) | `DEMO_BOOKINGS` default, bad `PENDING_HOST_APPROVAL` -> `"CONFIRMED"` map, swallowed cancel error, `setTimeout` extend modal, fake review modal | **Category 3** | **Remove.** Live `getMyBookings`, exact backend statuses, real error surfacing, remove fake extend/review modals, add real `reportBookingException`. |
| `apps/mobile/app/(traveller)/saved.tsx` (`L4-18, 65`) | `DEMO_LOCATIONS` hardcoded slice + fake `"24/7 OPEN"` | **Category 3** | **Remove.** Persist saved UUIDs locally via `AsyncStorage` and hydrate from live `getPublicLocationDetails`. |
| `apps/mobile/app/(traveller)/support.tsx` (`L94`) | Fake hardcoded support reply `"Colombo Fort Vault is open 24/7... Zone RACK-A"` & demo hotline chat simulation | **Category 3** | **Remove.** Replace fake ticket/chat simulation with honest FAQ + real `reportBookingException` for bookings. |
| `apps/mobile/app/(host)/_layout.tsx` (`L47-99`) | Unauthenticated Host Demo Mode toggle banner | **Category 3** | **Remove.** Enforce authenticated session + Host Onboarding CTA for non-host users. |
| `apps/mobile/app/(host)/index.tsx` | 100% mock `useHostStore` metrics & mock bookings | **Category 3** | **Remove.** Wire to live Host businesses, locations, bookings, finance summary queries. |
| `apps/mobile/app/(host)/requests.tsx` | `DEMO_HOST_BOOKINGS` fallback, `PENDING_HOST_APPROVAL` mapped to `"CONFIRMED"` | **Category 3** | **Remove.** Live `getHostBookings` + accurate status tabs & Accept/Reject/Cancel mutations. |
| `apps/mobile/app/(host)/scanner.tsx` (`L16, 239, 290`) | `DEMO_SCANNER_FIXTURES` simulator & client-side lookup fallback | **Category 3** | **Remove from production path.** Strict server verification via `POST /hosts/custody/verify` only. |
| `apps/mobile/app/(host)/intake.tsx` | Hardcoded `RACK-A`/`LOCKER-B`/`FLOOR-C` & `BAG_MEDIUM`, mock store mutations | **Category 3** | **Remove mock fallback.** Read booking/zones/bags dynamically and execute `completeCheckIn`. |
| `apps/mobile/app/(host)/vault.tsx` (`L80, 90`) | Mock `useHostStore` stored bags + fake `setTimeout` alerts | **Category 3** | **Remove.** Live `IN_STORAGE` & `COMPLETED` host bookings + `getCustodyDetail` + verified `completeCollection`. |
| `apps/mobile/app/(host)/earnings.tsx` | Fake `LKR 24,004` fallback & `DEMO_HOST_TRANSACTIONS` rendered permanently | **Category 3** | **Remove.** Render real `getHostFinanceSummary` & `getBusinessPayoutDetails` `payables[]`. |
| `apps/mobile/app/(host)/settings.tsx` (`L78`) | Read-only fake facility details, mock staff (`Roshan Fernando`), `Reset Demo State` button | **Category 3** | **Remove.** Real Host Business edit, links to Onboarding/Verification & Locations, sign-out; document `HM-033`/`HM-034` staff backend gap. |
| `apps/mobile/src/components/MobileIcon.tsx` (`L257, 300-307`) | Native bullet `"•"` & emoji fallback + silent `info` substitution | **Defect (P0)** | **Replace completely** with `lucide-react-native` + `react-native-svg` typed icon registry. |
| `apps/mobile/src/components/MobileDevDrawer.tsx` | Floating QA screen drawer (`__DEV__` gated) | Category 2 | Keep strictly gated behind `__DEV__`; update styling & link to `__DEV__` Icon Catalogue. |
