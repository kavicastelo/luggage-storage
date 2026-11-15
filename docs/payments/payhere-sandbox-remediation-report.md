# PayHere Sandbox Remediation Report — Web Checkout, Expo Web & Android Native SDK

**Project:** Global Luggage Storage Marketplace (`kavicastelo/luggage-storage`)  
**Market & Currency:** Sri Lanka (`LKR`)  
**Branch:** `dev` (rebased onto `main` @ `f54ec50667faa98990c42a795f32c2e185039a87`)  
**Implementation Commit SHA:** `91144cd370c09823c78aaf466414da4d653435c7`  
**CI / Verification Run:** Local uncached full monorepo gate `pnpm turbo run lint typecheck test build --force` passed (`16/16` tasks, `56` test files / `665` tests passed, `0` failed, `0` skipped); remote GitHub CI run is pending push (not pushed in this workspace per repository workflow rules).

---

## 1. Root Causes Found

The pre-modification repository audit documented in [payhere-sandbox-remediation-audit.md](file:///d:/luggage-storage/luggage-storage/docs/payments/payhere-sandbox-remediation-audit.md) identified ten root causes spanning backend credentials, browser referrer policy, mobile architecture, schema/contract modeling, and local environment prerequisites:

1. **Single Global Merchant Secret (`apps/api/src/config/env.ts`, `payment-gateway.port.ts`):** `PAYHERE_MERCHANT_SECRET` was shared globally across both web domain checkouts and native app checkouts, violating PayHere's requirement that registered Website Domains and Android Apps (`com.luggagestorage.app`) use distinct integration credentials.
2. **Webhook Verification Before Intent Channel Resolution (`apps/api/src/modules/payments/payments.service.ts`):** `processPayHereWebhook()` resolved a single global PayHere adapter before loading `payment_intents`, making per-channel `md5sig` secret verification impossible.
3. **API HTML Handoff Bridge Stripped `Referer` (`apps/api/src/modules/payments/payments.routes.ts`):** `GET /api/v1/payments/handoff/:handoffToken` served an auto-submitting HTML page with `Referrer-Policy: no-referrer`, suppressing the HTTP `Referer` header required by PayHere Checkout API domain authorization.
4. **Web & Expo Web Channel Ambiguity and Missing Referrer Guards (`apps/web/src/pages/PublicMarketplacePages.tsx`, `apps/web/index.html`, `apps/web/src/lib/payment-handoff.ts`):** Checkout initiation omitted `channel: "WEB"`, reused active intents without checking channel parity, and lacked fail-closed protection against restrictive document `<meta name="referrer">` policies (`no-referrer` / `same-origin`) or form-level `referrerpolicy`.
5. **Expo Mobile Web Used the Broken API HTML Bridge (`apps/mobile/app/(traveller)/checkout.tsx`, `apps/mobile/src/lib/payment-handoff.ts`):** When running under `Platform.OS === "web"`, Expo mobile called `Linking.openURL` toward `EXPO_PUBLIC_API_URL/payments/handoff/...` (a private LAN/localhost API URL) rather than direct browser `POST_FORM` submission from the web origin, and lacked an Expo `/booking/confirm` return route.
6. **Official PayHere React Native SDK Was Absent (`apps/mobile/package.json`):** `@payhere/payhere-mobilesdk-reactnative` and `expo-dev-client` were not installed; Android defaulted to external browser launch via `Linking.openURL`.
7. **Missing Android Config Plugin (`apps/mobile/app.json`):** No Expo config plugin injected JitPack (`https://www.jitpack.io`), `xmlns:tools`, and `tools:replace="android:allowBackup"` during `expo prebuild --platform android`.
8. **PayHere SDK AGP 9.2 Compatibility Gap:** SDK `4.0.14` still declared deprecated `jcenter()`, while SDK `4.1.0` (`com.github.PayHereDevs:payhere-android-sdk:v3.0.18`) lacked `namespace "lk.payhere"`, retained deprecated `package="lk.payhere"` in its library manifest, duplicated `apply plugin`, and retained removed Android Gradle publishing tasks incompatible with React Native `0.88.1` / AGP 9.2 without a `pnpm` patch.
9. **Contracts & Database Schema Lacked `checkoutChannel` (`packages/contracts/src/payments/index.ts`, `schema/payments.ts`):** `payment_intents` did not persist `"WEB"` vs `"MOBILE_APP"`, could not discriminate `"POST_FORM"` vs `"NATIVE_SDK"` (`LAUNCH_NATIVE_SDK`), and left legacy pre-channel active PayHere intents reusable.
10. **Local External Gateway & Device Toolchain Constraints:** Active local `.env` points `PAYHERE_NOTIFY_URL` to `http://localhost:3000/...` (unreachable from `sandbox.payhere.lk`), distinct Portal Web Domain vs Android App secrets were not provisioned locally, and this Windows workstation lacks `ANDROID_HOME` and Android Studio JBR (`JAVA_HOME`) for local APK compilation/device execution.

---

## 2. Files Changed

All 52 files committed in implementation commit `91144cd370c09823c78aaf466414da4d653435c7`, plus this report:

| Status | File Path |
|---|---|
| `M` | `.env.example` |
| `M` | `.envs/README.md` |
| `M` | `.envs/api.example` |
| `M` | `.envs/development.example` |
| `M` | `.envs/mobile.example` |
| `M` | `.envs/production.example` |
| `M` | `.envs/root.example` |
| `M` | `.envs/test.example` |
| `M` | `.envs/web.example` |
| `M` | `.gitignore` |
| `M` | `apps/api/.env.example` |
| `M` | `apps/api/src/config/env.ts` |
| `A` | `apps/api/src/infrastructure/database/migrations/0015_payhere_channel_aware_intents.sql` |
| `A` | `apps/api/src/infrastructure/database/migrations/meta/0015_snapshot.json` |
| `M` | `apps/api/src/infrastructure/database/migrations/meta/_journal.json` |
| `M` | `apps/api/src/infrastructure/database/schema/payments.ts` |
| `M` | `apps/api/src/modules/payments/payment-gateway.port.ts` |
| `M` | `apps/api/src/modules/payments/payments.routes.ts` |
| `M` | `apps/api/src/modules/payments/payments.service.ts` |
| `A` | `apps/api/tests/payhere-sandbox-remediation.test.ts` |
| `M` | `apps/api/tests/phase-b-booking-escrow-custody.test.ts` |
| `M` | `apps/api/tests/phase-b-payhere-checkout.test.ts` |
| `M` | `apps/api/tests/phase-b-refund-evidence.test.ts` |
| `M` | `apps/api/tests/phase-b-security-remediation.test.ts` |
| `M` | `apps/api/tests/setup/global-setup.ts` |
| `M` | `apps/api/tests/stabilization-security.test.ts` |
| `M` | `apps/api/vitest.config.ts` |
| `M` | `apps/mobile/.env.example` |
| `M` | `apps/mobile/app.json` |
| `M` | `apps/mobile/app/(traveller)/checkout.tsx` |
| `M` | `apps/mobile/app/_layout.tsx` |
| `A` | `apps/mobile/app/booking/confirm.tsx` |
| `M` | `apps/mobile/package.json` |
| `A` | `apps/mobile/plugins/withPayHereSdk.js` |
| `A` | `apps/mobile/src/lib/payhere-native.ts` |
| `M` | `apps/mobile/src/lib/payment-handoff.ts` |
| `A` | `apps/mobile/src/types/payhere-mobilesdk-reactnative.d.ts` |
| `A` | `apps/mobile/tests/payhere-sandbox-remediation.test.ts` |
| `M` | `apps/mobile/tests/phase-b-checkout-handoff.test.ts` |
| `M` | `apps/mobile/tests/phase-c-payment-security.test.ts` |
| `M` | `apps/mobile/tests/phase-c-traveller-e2e.test.ts` |
| `M` | `apps/web/.env.example` |
| `M` | `apps/web/index.html` |
| `M` | `apps/web/src/lib/payment-handoff.ts` |
| `M` | `apps/web/src/pages/PublicMarketplacePages.tsx` |
| `M` | `apps/web/tests/phase-b-checkout-handoff.test.tsx` |
| `A` | `docs/payments/payhere-sandbox-remediation-audit.md` |
| `A` | `docs/payments/payhere-staging-and-deployment-guide.md` |
| `A` | `docs/payments/payhere-sandbox-remediation-report.md` *(documentation commit)* |
| `M` | `packages/contracts/src/payments/index.ts` |
| `A` | `patches/@payhere__payhere-mobilesdk-reactnative@4.1.0.patch` |
| `M` | `pnpm-lock.yaml` |
| `M` | `pnpm-workspace.yaml` |

---

## 3. New or Changed Environment Variables

Configured and validated server-side in `apps/api/src/config/env.ts` and documented across `.env.example`, `.envs/README.md`, `.envs/api.example`, `.envs/development.example`, `.envs/mobile.example`, `.envs/production.example`, `.envs/root.example`, `.envs/test.example`, `.envs/web.example`, `apps/api/.env.example`, `apps/mobile/.env.example`, `apps/web/.env.example`, and [payhere-staging-and-deployment-guide.md](file:///d:/luggage-storage/luggage-storage/docs/payments/payhere-staging-and-deployment-guide.md):

| Variable | Side | Purpose & Validation Rule |
|---|---|---|
| `PAYHERE_MERCHANT_ID` | API server only | Account-wide PayHere Merchant ID required when `PAYMENT_PROVIDER=payhere`. |
| `PAYHERE_WEB_MERCHANT_SECRET` | API server only | Website Domain secret from PayHere Portal; required when `PAYMENT_PROVIDER=payhere`, distinct from `PAYHERE_MOBILE_MERCHANT_SECRET`, never exposed to client bundles or responses. |
| `PAYHERE_MOBILE_MERCHANT_SECRET` | API server only | Android App (`com.luggagestorage.app`) secret from PayHere Portal used exclusively server-side for `MOBILE_APP` `md5sig` webhook verification; required when `PAYMENT_PROVIDER=payhere` and must differ from `PAYHERE_WEB_MERCHANT_SECRET`. |
| `PAYHERE_ANDROID_PACKAGE_NAME` | API server only | Defaults to `com.luggagestorage.app`; validated when `PAYMENT_PROVIDER=payhere` to keep server and native Android application identity aligned. |
| `PAYHERE_MERCHANT_SECRET` | Removed / Fail-Closed | Deprecated single shared secret. `loadConfig()` fails closed if non-empty to prevent silent cross-channel credential sharing. |
| `PAYHERE_SANDBOX_MODE` | API server only | Boolean (`true` -> `https://sandbox.payhere.lk/pay/checkout`; `false` -> `https://www.payhere.lk/pay/checkout`). |
| `PAYHERE_NOTIFY_URL` | API server only | Public HTTPS callback endpoint (`.../api/v1/payments/webhooks/payhere`) reachable by PayHere servers in real sandbox/live tests. |
| `PAYHERE_RETURN_URL` | API server only | Registered website domain return URL (`.../booking/confirm`). |
| `PAYHERE_CANCEL_URL` | API server only | Registered website domain cancel URL (`.../booking/confirm?cancelled=1`). |

---

## 4. Database Migration Details

Added forward-only Drizzle SQL migration `0015` without modifying prior migration history:

- **SQL Migration:** [0015_payhere_channel_aware_intents.sql](file:///d:/luggage-storage/luggage-storage/apps/api/src/infrastructure/database/migrations/0015_payhere_channel_aware_intents.sql)
- **Snapshot & Journal:** `apps/api/src/infrastructure/database/migrations/meta/0015_snapshot.json` chained from `0014_phase_b_refund_evidence_integrity` (`_journal.json` index `15`, validated by `tests/stabilization-security.test.ts` snapshot parity suite) and aligned with `apps/api/src/infrastructure/database/schema/payments.ts`.
- **Changes applied by `0015`:**
  1. Adds `checkout_channel varchar(16)` to `payment_intents` (backfills `NULL` to `'WEB'`, sets `DEFAULT 'WEB'`, `NOT NULL`).
  2. Transitions any legacy `PAYHERE` rows in `('INITIATED', 'PENDING_GATEWAY')` with `checkout_channel IS NULL` to `'EXPIRED'` with explanatory `failure_reason` (`Expired legacy PayHere intent prior to channel-aware checkout migration (0015)`).
  3. Adds `payment_intents_checkout_channel_check` (`CHECK ("checkout_channel" IN ('WEB', 'MOBILE_APP'))`).
  4. Adds `payment_intents_payhere_channel_active_check` forbidding active (`INITIATED` / `PENDING_GATEWAY`) `PAYHERE` intents from carrying legacy `mobileHandoffPath` payloads.

---

## 5. Web Integration Implementation

Implemented in `apps/web/index.html`, `apps/web/src/lib/payment-handoff.ts`, and `apps/web/src/pages/PublicMarketplacePages.tsx`:

1. **Channel-Scoped Intent Request:** `marketplaceApi.createPaymentIntent()` sends explicit `channel: "WEB"` with booking ID, customer billing details, and idempotency key.
2. **Server-Side Checkout Form Construction:** The API selects `PAYHERE_WEB_MERCHANT_SECRET`, formats minor units deterministically to two decimal places via integer arithmetic (`formatMinorAmountTwoDecimals`), computes `UPPERCASE(MD5(merchant_id + order_id + amount + currency + UPPERCASE(MD5(web_secret))))`, and returns `POST_FORM` payload targeting `https://sandbox.payhere.lk/pay/checkout` (or live equivalent when `PAYHERE_SANDBOX_MODE=false`).
3. **Referrer Header Preservation:** `apps/web/index.html` declares `<meta name="referrer" content="strict-origin-when-cross-origin" />`. `submitPayHereCheckoutForm()` calls `assertSafeDocumentReferrerPolicy()` (failing closed if document referrer metadata is `no-referrer` or `same-origin`) and sets `form.referrerPolicy = "strict-origin-when-cross-origin"` so browsers transmit the website origin `Referer` directly to PayHere without traversing any API HTML bridge.
4. **Channel-Safe Retry & Authoritative Confirmation:** `loadPendingCheckoutContext()` retains `channel`; reuse checks reject wrong-channel or non-`POST_FORM` handoffs. On return/cancel navigation, query-string parameters are ignored as payment proof and confirmation relies solely on `GET /api/v1/payments/checkout-status`.

---

## 6. Expo Web Integration Implementation

Implemented in `apps/mobile/src/lib/payment-handoff.ts`, `apps/mobile/app/(traveller)/checkout.tsx`, `apps/mobile/app/_layout.tsx`, and [confirm.tsx](file:///d:/luggage-storage/luggage-storage/apps/mobile/app/booking/confirm.tsx):

1. **Web Channel Selection:** When `Platform.OS === "web"`, Expo selects `resolvePaymentChannel()` -> `"WEB"`, creates/resumes a `WEB` payment intent, never touches the Android native SDK, never performs silent simulated payment success in `payhere` mode, and never routes through the deprecated private-LAN API `/payments/handoff/...` HTML bridge.
2. **Browser Form Submission & Referrer Safety:** Submits the server-signed `POST_FORM` payload directly from the browser origin with `referrerPolicy = "strict-origin-when-cross-origin"` and `assertSafeDocumentReferrerPolicy()` guarding against `no-referrer` / `same-origin`.
3. **Return / Cancel Landing Route:** Added Expo Router screen `apps/mobile/app/booking/confirm.tsx` (registered in `app/_layout.tsx`) using `SafeHeader`, `PaymentStatusPanel`, `EmptyState` (`/(traveller)/(tabs)/bookings`), and server-authoritative polling via `GET /api/v1/payments/checkout-status` so `return_url` query params never unlock custody (`statusData.custodyReady` remains false until webhook settlement).
4. **Origin Constraint Documented:** Localhost origins (`http://localhost:8081`) cannot pass PayHere's registered Domain whitelist in live sandbox testing; staging/production testing requires serving Expo Web from the registered HTTPS domain configured in PayHere Portal and API `PAYHERE_RETURN_URL` / `PAYHERE_CANCEL_URL` / `CORS_ORIGIN`.

---

## 7. Android Native SDK Integration Implementation

Implemented in `apps/mobile/package.json`, `pnpm-workspace.yaml`, `patches/@payhere__payhere-mobilesdk-reactnative@4.1.0.patch`, `apps/mobile/app.json`, `apps/mobile/plugins/withPayHereSdk.js`, `apps/mobile/src/types/payhere-mobilesdk-reactnative.d.ts`, `apps/mobile/src/lib/payhere-native.ts`, `apps/mobile/src/lib/payment-handoff.ts`, and `apps/mobile/app/(traveller)/checkout.tsx`:

1. **Official Native SDK + Dev Client Dependencies:** Installed `@payhere/payhere-mobilesdk-reactnative@4.1.0` and `expo-dev-client@~58.0.20` (native compilation requires a custom development client rather than Expo Go).
2. **AGP 9.2 / RN 0.88.1 Compatibility Patch:** Applied `patches/@payhere__payhere-mobilesdk-reactnative@4.1.0.patch` via `pnpm.patchedDependencies` to set `namespace "lk.payhere"`, remove deprecated manifest `package="lk.payhere"`, remove duplicate `apply plugin: 'com.android.library'`, and remove deprecated Javadoc/Maven publishing tasks from the SDK's `android/build.gradle`.
3. **Reproducible Expo Config Plugin (`plugins/withPayHereSdk.js`):** Injects `maven { url 'https://www.jitpack.io' }` into root `android/build.gradle` `allprojects.repositories`, ensures `xmlns:tools="http://schemas.android.com/tools"` on `<manifest>`, and adds `tools:replace="android:allowBackup"` on `<application>` in `android/app/src/main/AndroidManifest.xml`, preserving `android.package = "com.luggagestorage.app"`.
4. **Native SDK Flow (`channel: "MOBILE_APP"`):** On native Android/iOS builds, `checkout.tsx` requests a `MOBILE_APP` intent and receives `nextAction: "LAUNCH_NATIVE_SDK"` with `method: "NATIVE_SDK"` (`sdkPayload` containing `sandbox`, `merchant_id`, `notify_url`, `order_id`, `items`, exact decimal `amount`, `currency`, customer billing fields, `custom_1`, `custom_2` — zero Merchant Secrets and zero client-generated hashes). `launchPayHereNativeCheckout()` invokes `PayHere.startPayment(...)` and treats `onCompleted`, `onError`, and `onDismissed` strictly as triggers to refresh `GET /api/v1/payments/checkout-status`.
5. **External-Browser Handoff Retired:** Native Android checkout no longer launches external browsers to `/payments/handoff/...`, and `GET /api/v1/payments/handoff/:handoffToken` returns HTTP `410` (`HANDOFF_ENDPOINT_RETIRED` JSON).

---

## 8. Integration Credential Selection & Notification Verification Design

Implemented in `packages/contracts/src/payments/index.ts`, `apps/api/src/modules/payments/payment-gateway.port.ts`, `apps/api/src/modules/payments/payments.service.ts`, and `apps/api/src/modules/payments/payments.routes.ts`:

1. **Intent Creation (`WEB` vs `MOBILE_APP`):**
   - `CreatePaymentIntentRequestSchema` accepts validated `channel` (`"WEB" | "MOBILE_APP"`, defaulting to `"WEB"`).
   - `payments.service.ts` persists `checkout_channel` on `payment_intents`.
   - `resolvePayHereGatewayAdapter(channel)` selects `PAYHERE_WEB_MERCHANT_SECRET` for `"WEB"` and `PAYHERE_MOBILE_MERCHANT_SECRET` for `"MOBILE_APP"`.
   - `"WEB"` returns `nextAction: "REDIRECT_TO_PROVIDER"` with `method: "POST_FORM"` (`checkoutHash` computed server-side). `"MOBILE_APP"` returns `nextAction: "LAUNCH_NATIVE_SDK"` with `method: "NATIVE_SDK"` (`sdkPayload` without hash/secret).
   - Same-channel concurrent retries share the single active intent cleanly (`idempotencyKey`); channel switches (`WEB` <-> `MOBILE_APP`) supersede the previous active intent first so two payable intents can never coexist for the same booking; legacy active `PAYHERE` intents lacking valid channel payloads fail explicitly as `LEGACY_EXPIRED` / `EXPIRED`.
2. **Untrusted Notification Parsing & Channel-Isolated `md5sig` Verification:**
   - `processPayHereWebhook()` parses bounded `application/x-www-form-urlencoded` fields (`extractUntrustedWebhookLookup`) to inspect `order_id` and `custom_1` strictly as **untrusted lookup keys** to query `payment_intents`.
   - Reads persisted `intent.checkoutChannel` from PostgreSQL and resolves only that channel's secret (`PAYHERE_WEB_MERCHANT_SECRET` or `PAYHERE_MOBILE_MERCHANT_SECRET`) — signing with the Web secret fails verification on a Mobile intent and vice versa.
   - Verifies uppercase MD5 `md5sig` via constant-time `crypto.timingSafeEqual`, checks `merchant_id`, `order_id`, exact decimal-to-minor amount parity (`parsePayHereDecimalAmountToMinor`), and currency match before entering the lock-ordered idempotent settlement transaction (`payment_transactions`, `booking_status_history`, `bookings.status = 'CONFIRMED'`, `financial_ledger_entries`, `host_payables`).
   - Rejects unknown order IDs, mismatched amounts/currencies, wrong secrets, tampered `md5sig`, and cross-provider replay safely; custody QR/PIN issuance (`POST /api/v1/bookings/:bookingId/custody-pass`) remains locked (`409 Conflict`) until server booking confirmation.

---

## 9. Automated Test Results

Ran the uncached full monorepo gate **after the final code and test edit**:

```powershell
pnpm turbo run lint typecheck test build --force
```

**Monorepo Gate Result:** `Command exited with code 0` — **16/16 Turbo tasks succeeded** (`Cached: 0 cached, 16 total`, `Time: 2m16.877s`).

| Workspace | Lint (`eslint`) | Typecheck (`tsc --noEmit`) | Build | Test Files | Tests Passed | Failures / Skips |
|---|---|---|---|---|---|---|
| `@luggage-storage/contracts` | Pass (`0` errors) | Pass | Pass (`tsc`) | `11 passed (11)` | `81 passed (81)` | `0` failed, `0` skipped |
| `@luggage-storage/api` | Pass (`0` errors) | Pass | Pass (`tsc`) | `16 passed (16)` | `342 passed (342)` | `0` failed, `0` skipped |
| `@luggage-storage/web` | Pass (`0` errors) | Pass | Pass (`tsc && vite build`, `8.98s`) | `11 passed (11)` | `121 passed (121)` | `0` failed, `0` skipped |
| `@luggage-storage/mobile` | Pass (`0` errors) | Pass | Pass (`expo export --no-bytecode`) | `18 passed (18)` | `121 passed (121)` | `0` failed, `0` skipped |
| **Total** | **All Pass** | **All Pass** | **All Pass** | **`56 passed (56)`** | **`665 passed (665)`** | **`0` failed, `0` skipped** |

*(API repeat-run verification note: standalone `pnpm --filter @luggage-storage/api test` passed `16/16` files / `342/342` tests immediately prior to the uncached Turbo run above, which re-passed `16/16` files / `342/342` tests against persistent PostgreSQL `luggage_storage_dev`.)*

### Client Bundle Secret & Retired Handoff Scan

Scanned all built web and Expo web output files produced by the final `turbo` build using PowerShell `Select-String`:
- `apps/web/dist`: **`43` files** (`index.html`, compiled JS/CSS bundles) -> **`0` matches**
- `apps/mobile/dist`: **`137` files** (exported web JS/assets) -> **`0` matches**
- Patterns scanned: `PAYHERE_WEB_MERCHANT_SECRET`, `PAYHERE_MOBILE_MERCHANT_SECRET`, `PAYHERE_MERCHANT_SECRET`, `/payments/handoff`, `payhere_test_web_secret`, `payhere_test_mob_secret` -> **Total matches: `0`** (`secret_matches=0`).

---

## 10. Android Build Evidence

1. **Native Project Prebuild Verification (Reproducible Config Plugin & AGP 9.2 Patch):**
   - `pnpm --filter @luggage-storage/mobile exec expo prebuild --platform android --clean` -> exited `0`.
   - Repeat idempotency run `pnpm --filter @luggage-storage/mobile exec expo prebuild --platform android` -> exited `0` (zero extra changes after `--clean`).
   - Direct inspection of generated Android files confirmed:
     - `android/build.gradle` (L20): `maven { url 'https://www.jitpack.io' }` present.
     - `android/app/build.gradle` (L90–92): `namespace 'com.luggagestorage.app'` and `applicationId 'com.luggagestorage.app'`.
     - `android/app/src/main/AndroidManifest.xml` (L1, L16): `xmlns:tools="http://schemas.android.com/tools"` and `tools:replace="android:allowBackup"`.
     - `android/settings.gradle`: `expoAutolinking` configured.
     - Patched `node_modules/@payhere/payhere-mobilesdk-reactnative/android/build.gradle` (L46): `namespace "lk.payhere"`, zero `jcenter()` references.
   - Temporary `apps/mobile/android` and `apps/mobile/.expo` directories were removed afterward (`android_dir=False`, `expo_dir=False`, excluded via `.gitignore`).
2. **Local APK / Device Compilation Check:**
   - Inspected Windows host environment: `ANDROID_HOME` is empty, `ANDROID_SDK_ROOT` is empty, `JAVA_HOME` is empty, `%LOCALAPPDATA%\Android\Sdk` = `False`, and `C:\Program Files\Android\Android Studio\jbr` = `False` (`C:\Program Files\Java\jdk-26.0.1` is installed without Android SDK/NDK/build-tools).
   - Therefore, Gradle APK compilation (`expo run:android` / `./gradlew assembleDebug`) and device installation could **not** execute locally and require either EAS Build (`eas build --profile development --platform android`) or an Android Studio SDK workstation.

---

## 11. Actual PayHere Sandbox Test Evidence

| Platform / Channel | Execution Status | Recorded Details & Honest Verification State |
|---|---|---|
| Public Website (`apps/web`, `channel: "WEB"`) | **BLOCKED** | Not executed against live `https://sandbox.payhere.lk/pay/checkout`. Local environment lacks: (1) a registered public website domain in PayHere Sandbox Portal matching `PAYHERE_RETURN_URL`/`PAYHERE_CANCEL_URL`, (2) the Web-domain-specific `PAYHERE_WEB_MERCHANT_SECRET`, and (3) a public HTTPS tunnel/host for `PAYHERE_NOTIFY_URL` (local `.env` uses `http://localhost:3000/...`). No fake sandbox payment evidence is claimed. |
| Expo Mobile Web (`apps/mobile` on web, `channel: "WEB"`) | **BLOCKED** | Same live PayHere domain/origin and HTTPS `notify_url` blockers (`http://localhost:8081` is not an authorized public domain in PayHere Portal). Automated Vitest/Vite/Expo Web export verified code paths, referrer headers, and polling logic; live PayHere sandbox checkout remains **BLOCKED**. |
| Android Native SDK (`apps/mobile` Android, `channel: "MOBILE_APP"`) | **BLOCKED** | Not executed on an Android device/emulator. Blocked on: (1) Android Studio SDK (`ANDROID_HOME`) or EAS development build to compile the APK with `@payhere/payhere-mobilesdk-reactnative@4.1.0`, (2) distinct Portal-registered App secret `PAYHERE_MOBILE_MERCHANT_SECRET` for `com.luggagestorage.app`, and (3) public HTTPS `PAYHERE_NOTIFY_URL` reachable by PayHere sandbox servers. |

---

## 12. Remaining Blockers & Owner Actions

Follow the detailed runbook in [payhere-staging-and-deployment-guide.md](file:///d:/luggage-storage/luggage-storage/docs/payments/payhere-staging-and-deployment-guide.md) to unblock live end-to-end sandbox acceptance:

1. **PayHere Sandbox Portal Registrations & Secret Rotation:**
   - Sign in to PayHere Sandbox Portal -> **Settings > Domains and Credentials** (or **Integrations > Add Domain/App**).
   - Register the staging/sandbox **Domain** for Web (`apps/web` / Expo Web) and obtain `PAYHERE_WEB_MERCHANT_SECRET`.
   - Register the **App** entry with package name `com.luggagestorage.app` and obtain `PAYHERE_MOBILE_MERCHANT_SECRET`.
   - Ensure the two secrets are distinct and remove deprecated `PAYHERE_MERCHANT_SECRET` from all API runtime environments.
2. **Expose Public HTTPS `PAYHERE_NOTIFY_URL` & Web Staging Origin:**
   - Configure `PAYHERE_NOTIFY_URL=https://<public-api-host>/api/v1/payments/webhooks/payhere`, matching registered `PAYHERE_RETURN_URL` / `PAYHERE_CANCEL_URL` on HTTPS, and include the web origin in `CORS_ORIGIN`.
   - Point `apps/mobile/.env` `EXPO_PUBLIC_API_URL` and `apps/web/.env` `VITE_API_URL` to the HTTPS API endpoint (no private LAN IP for external PayHere testing).
3. **Build Custom Android Development Client (`expo-dev-client`):**
   - Run `eas build --profile development --platform android` (or `pnpm --filter @luggage-storage/mobile exec expo run:android` on a machine with Android Studio SDK + `ANDROID_HOME` + JDK 17+).
4. **Execute Live Sandbox Test Card Payments & Record Evidence:**
   - Run real sandbox card payments on both the registered Website Domain and the Android `com.luggagestorage.app` dev client using official PayHere sandbox test cards, then populate the 13 evidence fields (Booking ID, Payment Intent ID, Provider Order ID, Channel, Sandbox Checkout URL, Sanitized Payload, Hash Verification Result, Gateway/SDK Result, Webhook Receipt, `md5sig` Result, Final Intent State, Final Booking State, Custody Pass Access Result).

---

## 13. Final Acceptance Matrix

| Requirement | Status | Verification Evidence |
|---|---|---|
| **Web checkout** — Actual PayHere sandbox gateway opens from registered web origin | **BLOCKED** | Local client form (`channel: "WEB"`, `https://sandbox.payhere.lk/pay/checkout`, `strict-origin-when-cross-origin`) verified in tests & Vite bundle (`apps/web/dist`); live registered domain + Portal web secret not provisioned locally. |
| **Web payment** — Sandbox test payment is processed successfully | **BLOCKED** | Blocked pending registered public Web Domain, `PAYHERE_WEB_MERCHANT_SECRET`, and public HTTPS `PAYHERE_NOTIFY_URL`. |
| **Android checkout** — Official native PayHere SDK opens in the Android app | **BLOCKED** | `@payhere/payhere-mobilesdk-reactnative@4.1.0` + `expo-dev-client` + `withPayHereSdk.js` + AGP 9.2 patch verified via `expo prebuild --platform android`; APK compilation & device run blocked locally by missing `ANDROID_HOME` / Android Studio JBR / EAS build. |
| **Android payment** — Sandbox test payment is processed successfully | **BLOCKED** | Blocked pending Android dev build, registered `com.luggagestorage.app` `PAYHERE_MOBILE_MERCHANT_SECRET`, and public HTTPS `PAYHERE_NOTIFY_URL`. |
| **Credential isolation** — Correct integration credentials used for each channel | **PASS** | `loadConfig()` fails closed on legacy `PAYHERE_MERCHANT_SECRET`, requires distinct `PAYHERE_WEB_MERCHANT_SECRET` & `PAYHERE_MOBILE_MERCHANT_SECRET`, and `resolvePayHereGatewayAdapter(channel)` selects channel-specific credentials (`payhere-sandbox-remediation.test.ts`). |
| **Notification** — Correct channel-specific signature verification | **PASS** | Webhook handler extracts untrusted lookup keys (`order_id`/`custom_1`), resolves `checkout_channel` from `payment_intents`, selects only the matching channel secret, verifies constant-time `md5sig`, merchant ID, amount, and currency (`api` tests `342/342` passed). |
| **Booking** — Server confirms only after verified notification | **PASS** | Return query params, web form post, and native SDK callbacks (`onCompleted`/`onError`/`onDismissed`) never settle bookings; settlement occurs strictly inside `processPayHereWebhook()` (`CHECKOUT_STATUS` confirmed post-webhook). |
| **Custody** — QR/PIN stays locked until server confirmation | **PASS** | `POST /api/v1/bookings/:bookingId/custody-pass` rejects with `409 Conflict` prior to verified webhook settlement and issues QR/PIN (`200 OK`) only after server confirmation. |
| **Retry** — No duplicate active payment intent or charge | **PASS** | Single-active-intent uniqueness preserved on same-channel retry (`idempotencyKey`), channel switches supersede prior active intent cleanly, duplicate/replayed notifications stay idempotent, and legacy v1 active intents are expired (`0015`). |
| **Security** — No client-side Merchant Secret or trusted callback status | **PASS** | Bundle scan found `0` secret matches across `43` `apps/web/dist` and `137` `apps/mobile/dist` files; `MOBILE_APP` `sdkPayload` contains zero hashes/secrets; `/payments/handoff/:handoffToken` returns `410`; `no-referrer` blocked on web checkout. |
| **Expo** — Reproducible Android development build | **PARTIAL** | Reproducible `expo prebuild --platform android --clean` and repeat `expo prebuild` succeeded (`exit 0`, verified JitPack, `com.luggagestorage.app`, `tools:replace="android:allowBackup"`, AGP 9.2 SDK patch); final APK build requires Android SDK / EAS Build environment. |
| **Regression** — Existing API, web, mobile and monorepo checks pass | **PASS** | `pnpm turbo run lint typecheck test build --force` passed all `16/16` tasks (`contracts` `11/81`, `api` `16/342`, `web` `11/121`, `mobile` `18/121`; `665` tests passed, `0` failed, `0` skipped) on commit `91144cd370c09823c78aaf466414da4d653435c7` (remote CI pending push). |
