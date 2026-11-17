# Initiative 7 — WS-7.4 Browser E2E Testing Report

---

## 1. Playwright Infrastructure
- **Framework:** `@playwright/test` (`1.65.1`) installed in `apps/web` with Chromium (`chromium-1255`).
- **Configuration (`apps/web/playwright.config.ts`):**
  - Orchestrates Fastify API (`http://127.0.0.1:3000/api/v1/ready`, `PAYMENT_PROVIDER=sandbox`, `RATE_LIMIT_LOGIN_IP_MAX=1000`) and Vite Web (`http://127.0.0.1:5173`, `VITE_ENABLE_DEMO_PREVIEW=false`, `VITE_FEATURE_REVIEWS=false`, `VITE_FEATURE_PROMOTIONS=false`).
  - Captures screenshots (`only-on-failure`), Playwright traces (`retain-on-failure`), videos (`retain-on-failure`), and HTML report (`apps/web/playwright-report`).
  - Registered `test:e2e` in `apps/web/package.json` and `turbo.json`, and restricted `apps/web/vitest.config.ts` to `tests/**/*.test.{ts,tsx}` so Vitest and Playwright execute cleanly without colliding.
- **Deterministic Fixtures (`apps/web/e2e/fixtures.ts`, `apps/api/scripts/e2e-db-helper.ts`):**
  - Provisions isolated per-test users, businesses, and locations in PostgreSQL/PostGIS and disables test locations in `finally` cleanup blocks.

---

## 2. Implemented Browser Journeys (`apps/web/e2e/`)

| Spec File | Journey | Observed Outcome |
|---|---|---|
| `01-traveller-booking.spec.ts` | Traveller auth -> `/search?city=Colombo` -> `/locations/:id` -> booking & sandbox payment -> `/portal` exact address unlock & QR/PIN custody pass | **PASS (`7.7s`)** |
| `02-host-onboarding.spec.ts` | Host user auth -> `/host/onboarding` -> business creation -> KYC upload (`HOST_VERIFICATION` presign/PUT/confirm) -> elevated `/host/locations` view | **PASS (`5.2s`)** |
| `03-host-custody.spec.ts` | Host owner `/host/operations` Check-In (`CHECK_IN` QR) -> `Release Pick-Up` Check-Out (`COLLECTION` QR) -> `COMPLETED` with zero dispute -> `HOST_STAFF` blocked on `/host/finance` | **PASS (`8.3s`)** |
| `04-superadmin-governance.spec.ts` | Superadmin `/admin/locations` -> `/admin/incidents` dispute adjudication (`UPHOLD_HOST`) -> ordinary `TRAVELLER` blocked from `/admin` | **PASS (`8.1s`)** |
| `05-support-tickets.spec.ts` | Traveller `/contact` ticket submit & reload persistence -> `SUPPORT` agent `/admin/support/:id` assign & public reply -> Traveller sees reply -> unrelated user denied | **PASS (`6.1s`)** |
| `06-profile-management.spec.ts` | Authenticated `/profile` edit (`displayName`, `phoneNumber`, `travellerProfile`), browser reload persistence, `sessionId`/`permissions` absent, API `400` on mass assignment | **PASS (`2.7s`)** |

**Latest Full Suite Execution:** `6 passed (43.5s)` (`pnpm --filter @luggage-storage/web test:e2e`).

