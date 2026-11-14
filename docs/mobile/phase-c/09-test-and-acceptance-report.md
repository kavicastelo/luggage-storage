# Stage C7 & C9 — Mobile Test & Monorepo Acceptance Report

**Repository:** `kavicastelo/luggage-storage` (`dev` branch)  
**Final Implementation Commit:** `04eba4a600a2e409d5067b8862ab2e69a1751ea8`  
**Currency / Launch Market:** Sri Lanka (`LKR`)  

---

## 1. Summary of Automated Quality Gates

All TypeScript, ESLint, unit, integration, simulated E2E workflow, bundle export, PostgreSQL/PostGIS API integration, and uncached monorepo verification checks passed with **0 failures** and **0 skipped tests** after the final code edit.

| Gate Command | Scope | Outcome | Key Metrics |
| :--- | :--- | :---: | :--- |
| `pnpm --filter @luggage-storage/api test` | `@luggage-storage/api` uncached | **PASS** | `15/15` test files passed, `337/337` tests passed (`94.19s`) |
| `pnpm --filter @luggage-storage/mobile export` | Expo SDK 58 Metro multi-platform export | **PASS** | `iOS`: `3513` modules, `Android`: `3666` modules, `Web`: `3217` modules |
| `pnpm verify` | `turbo run lint typecheck test build` | **PASS** | `16/16` tasks passed (`8` cached, `8` fresh; `api:test` fresh `337/337`) |
| `pnpm turbo run lint typecheck test build --force` | Full uncached monorepo gate (`0` cache) | **PASS** | `16/16` tasks passed (`1m53.088s`), `54/54` test files, `655/655` tests passed |

---

## 2. Uncached Monorepo Breakdown (`pnpm turbo run lint typecheck test build --force`)

Executed with `--force` (`0 cached, 16 total`) across all workspace packages:

| Package | Lint (`eslint`) | Typecheck (`tsc --noEmit`) | Tests (`vitest run`) | Build |
| :--- | :--- | :--- | :--- | :--- |
| `@luggage-storage/contracts` | **0 errors, 0 warnings** | **PASS** | **11/11 files, 81/81 passed** (`1.85s`) | **PASS** (`tsc`) |
| `@luggage-storage/mobile` | **0 errors, 0 warnings** | **PASS** | **17/17 files, 116/116 passed** (`7.72s`) | **PASS** (`expo export --no-bytecode`: Android `3666`, iOS `3639`, Web `3217` modules) |
| `@luggage-storage/web` | **0 errors, 12 pre-existing warnings** | **PASS** | **11/11 files, 121/121 passed** (`9.33s`) | **PASS** (`tsc && vite build`, `1705` modules transformed) |
| `@luggage-storage/api` | **0 errors, 54 pre-existing warnings** | **PASS** | **15/15 files, 337/337 passed** (`98.86s`) | **PASS** (`tsc`) |
| **Monorepo Total** | **0 errors** | **4/4 PASS** | **54/54 files, 655/655 passed** | **4/4 PASS** |

> Pre-existing warnings exist only in `@luggage-storage/web` (`AdminDashboardPages.tsx`, `HostDashboardPages.tsx`) and `@luggage-storage/api` (`error-handler.ts`, `capacity.service.ts`, test suites). `@luggage-storage/mobile` and `@luggage-storage/contracts` completed with **0 errors and 0 warnings**.

---

## 3. Mobile Test Suite Inventory (`17/17` Files, `116/116` Tests)

### 3.1 Preserved Pre-Existing Test Suites (`13` files, `101` tests)
None of the existing test suites were deleted or disabled; all were reconciled with Stage C1–C5 architecture:

| Test File | Tests | Focus |
| :--- | :---: | :--- |
| `tests/validation.test.ts` | 5 | Zod contract wrapper validation |
| `tests/auth-flows.test.ts` | 6 | Login, register, verify-email, reset-password API helpers |
| `tests/phase-b-mobile-flows.test.ts` | 3 | Phase B mobile contract compatibility |
| `tests/api-client.test.ts` | 4 | `/api/v1` normalization, bearer injection, token refresh mutex |
| `tests/secure-storage.test.ts` | 4 | `expo-secure-store` token persistence |
| `tests/phase-b-checkout-handoff.test.ts` | 3 | PayHere checkout payload validation & browser return guards |
| `tests/auth-store.test.ts` | 7 | Auth initialization, role helpers, logout cleanup |
| `tests/store.test.ts` | 2 | Role/selection client store |
| `tests/phase-2-screens-and-mascots.test.ts` | 5 | Mascot asset mapping & screen metadata registry |
| `tests/traveller-mobile-audit-verification.test.ts` | 8 | Traveller discovery/booking contract guarantees |
| `tests/host-mobile-journeys.test.ts` | 31 | Host store, custody intake/vault state checks |
| `tests/theme.test.ts` | 6 | CWCP colour palette & semantic tokens |
| `tests/traveller-mobile-journeys.test.ts` | 17 | Traveller marketplace journeys & fixture checks |

### 3.2 New Phase C Test Suites (`4` files, `15` tests)

| Test File | Tests | Coverage |
| :--- | :---: | :--- |
| `tests/phase-c-design-and-icons.test.ts` | 4 | Verifies all `>= 70` (actual `72`) registered `MobileIcon` names resolve to concrete Lucide components with zero `"\u2022"` bullet fallbacks; validates `MobileIconSizeToken` pixel mapping; asserts deterministic `>= 21x21` ISO QR matrix generation in `QrCodeMatrix.tsx` (and empty-input rejection); scans every `.ts`/`.tsx` under `app/` and `src/` to confirm `#FAF8F5`/`#0A192F`/`#C55013` tokens and zero `#2563eb` hex literals. |
| `tests/phase-c-payment-security.test.ts` | 9 | Verifies PayHere external browser routing (`resolveMobileHandoffUrl` + `openExternalPayHereHandoff`) and confirms zero `react-native-webview` / `<WebView>` usage; tests rejection of unapproved/cross-origin handoff paths; scans `app/` and `src/` for forbidden server secrets; confirms fail-closed `PENDING_PAYMENT` behavior prior to server settlement; asserts `409 PAYMENT_REQUIRED` gating on `issueCustodyPass`; asserts `409 PASS_ALREADY_CONSUMED` replay protection; validates `429 Retry-After` parsing; proves offline `SecureStore` refresh-token preservation vs `401` revocation deletion; proves `logout()` wipes `accessToken`, `SecureStore`, `mobileQueryClient`, and `useMobileStore`. |
| `tests/phase-c-traveller-e2e.test.ts` | 1 | Exercises the end-to-end Colombo `LKR` Traveller journey across mocked fetch boundaries: `login` -> `searchLocations` -> `getPublicLocationDetails` -> `useSavedLocationsStore.toggleSaved` -> `quoteBooking` -> `createBooking` with idempotency key -> `createPaymentIntent` (`POST_FORM`) + `resolveMobileHandoffUrl` -> `getCheckoutStatus` polling (`PENDING_PAYMENT` -> `CONFIRMED`) -> `issueCustodyPass` + `buildQrMatrixPath` (`>= 21x21`) -> lifecycle polling (`IN_STORAGE` -> `COMPLETED`) -> `cancelBooking`. |
| `tests/phase-c-host-e2e.test.ts` | 1 | Exercises the end-to-end Colombo Host Partner journey across mocked fetch boundaries: `createBusiness` + `refreshSessionAndUser` role promotion to `HOST_OWNER` -> 3-step R2 KYC upload (`initiateUpload` -> `PUT` -> `confirmUpload`) -> `submitVerification` -> `createLocation` -> `setOpeningHours` -> `addOpeningHoursException` -> `createStorageZone` -> `createCapacityPool` -> `configurePricingPolicy` (`LKR`) -> `submitLocationForReview` -> `acceptHostBooking` / `rejectHostBooking` -> `verifyCustodyPass` -> `completeCheckIn` -> `getCustodyDetail` -> `completeCollection` (`RELEASED_TO_TRAVELLER`) -> `getHostFinanceSummary` (`totalEligibleMinor: 204000` `LKR`) -> `reportBookingException`. |

---

## 4. API Test Isolation Finding & Resolution

During initial Stage C9 execution, running `pnpm --filter @luggage-storage/api test` uncached hit `14` failures across `4` Phase B suites (`tests/phase-b-booking-escrow-custody.test.ts`, `tests/phase-b-payhere-checkout.test.ts`, `tests/phase-b-refund-evidence.test.ts`, and `tests/phase-b-security-remediation.test.ts`).

- **Root Cause:** `apps/api/src/config/env.ts:10-11` runs `dotenv.config()` (loading `apps/api/.env`, which omits `PAYMENT_*` keys) and then falls back to monorepo root `.env` (`../../../../.env`). When the developer root `.env` sets `PAYMENT_PROVIDER=payhere` (for local mobile/web PayHere testing), Vitest worker processes inherit `PAYMENT_PROVIDER="payhere"` instead of the `"sandbox"` baseline assumed by `.env.example:52`, `.github/workflows/ci.yml`, and the Phase B test fixtures.
- **Minimal Test-Harness Resolution (`apps/api/vitest.config.ts:9-11`):** Added `env: { PAYMENT_PROVIDER: "sandbox" }` inside Vitest `test` configuration. Because `dotenv@16.4.5` uses `override: false`, API runtime files (`apps/api/src/**`), production config rules, and `.env` files remain untouched, while `loadConfig(customEnv)` and `withPayHereEnv(...)` tests continue verifying PayHere behavior explicitly. After this change, both `pnpm --filter @luggage-storage/api test` and `pnpm turbo run lint typecheck test build --force` passed `15/15` files and `337/337` tests.
