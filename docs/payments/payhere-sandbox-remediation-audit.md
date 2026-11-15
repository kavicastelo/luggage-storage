# PayHere Sandbox Remediation — Mandatory Initial Repository & Configuration Audit

**Repository:** `kavicastelo/luggage-storage`  
**Branch:** `dev` (aligned fast-forward to `main` @ `f54ec50`)  
**Market & Currency:** Sri Lanka (`LKR`)  
**Android Package / URL Scheme:** `com.luggagestorage.app` / `luggagestorage`  
**Scope:** Pre-modification source, contract, schema, environment, SDK, and live-readiness audit (`apps/api`, `packages/contracts`, `apps/web`, `apps/mobile`)

> **Secret-Hygiene Notice:** No real `PAYHERE_*_SECRET`, `JWT_SECRET`, `DB_IDENTITY_SECRET`, `CUSTODY_TOKEN_HMAC_SECRET`, or private credentials appear in this document. Environment inspection below records only structural presence/redacted metadata.

---

## 1. Executive Summary of Audit Findings

Live PayHere sandbox checkout failed across both web (`apps/web`, `apps/mobile` web) and native Android (`apps/mobile` on Android) because of ten compounding defects spanning credential isolation, referrer propagation, checkout handoff architecture, channel tracking, and native SDK wiring:

1. **Single shared Merchant Secret (`apps/api/src/config/env.ts`):** Only one `PAYHERE_MERCHANT_SECRET` exists (`L150-153`, `L448-454`), ignoring PayHere's requirement to register **Domains** (Web) and **Apps** (`com.luggagestorage.app`) separately in Merchant Portal -> *Settings > Domains and Credentials*, each receiving its own distinct secret.
2. **Webhook verifies signature before resolving intent channel (`payments.service.ts`):** `processPayHereWebhook` resolves `resolvePayHereGatewayAdapter()` (`L773`) before loading `payment_intents` (`L855`), making per-channel secret selection impossible.
3. **API HTML handoff page sends `Referrer-Policy: no-referrer` (`payments.routes.ts`):** `GET /payments/handoff/:handoffToken` (`L55-78`) emits `Referrer-Policy: no-referrer` (`L75`), stripping `Referer` on POST to `sandbox.payhere.lk/pay/checkout` and breaking PayHere's domain authorization check.
4. **Web & Expo Web lack channel isolation and explicit referrer guarantees (`PublicMarketplacePages.tsx`, `apps/web/src/lib/payment-handoff.ts`):** Client calls omit `channel`, lack wrong-channel reuse guards (`L1831-1837`), and do not guard against restrictive `meta[name="referrer"]` or form `referrerpolicy`.
5. **Expo Mobile Web uses the broken API HTML bridge instead of Web Checkout (`apps/mobile/app/(traveller)/checkout.tsx`, `apps/mobile/src/lib/payment-handoff.ts`):** `Platform.OS === "web"` executes `resolveMobileHandoffUrl` + `Linking.openURL` to `EXPO_PUBLIC_API_URL/payments/handoff/...` (`L293-387`) instead of direct browser POST from the registered web origin (`channel: "WEB"`), and lacks a `/booking/confirm` Expo route.
6. **Native Android lacks the official PayHere React Native SDK (`apps/mobile/package.json`):** `@payhere/payhere-mobilesdk-reactnative` and `expo-dev-client` are absent; Android currently shells out to an external browser (`Linking.openURL`) pointed at the private LAN API bridge (`http://192.168.8.181:3000`).
7. **Missing Expo Android config plugin for JitPack & Manifest merger (`apps/mobile/app.json`):** No config plugin exists to declare JitPack in Android Gradle repositories or `xmlns:tools` + `tools:replace="android:allowBackup"` in `AndroidManifest.xml`.
8. **PayHere SDK `4.1.0` requires an AGP 9.2 compatibility patch:** While `4.0.14` still calls removed `jcenter()`, `4.1.0` uses `com.github.PayHereDevs:payhere-android-sdk:v3.0.18` without `jcenter()`, but retains legacy AGP constructs (`package="lk.payhere"` in manifest, missing `namespace`, duplicate `apply plugin`, deprecated `androidJavadoc`/`jar` tasks) incompatible with `@react-native/gradle-plugin` / React Native `0.88.1` unless patched via `pnpm`.
9. **Database & shared contracts lack `checkoutChannel` (`packages/contracts`, `schema/payments.ts`):** `payment_intents` and `PaymentIntentSchema` do not persist whether an intent was issued for `"WEB"` (`POST_FORM`) or `"MOBILE_APP"` (`NATIVE_SDK`).
10. **Local environment & external live-testing blockers:** Root `.env` has a single `PAYHERE_MERCHANT_SECRET`, `PAYHERE_NOTIFY_URL=http://localhost:3000/api/v1/payments/webhooks/payhere` (unreachable from `sandbox.payhere.lk`), and the local Windows host lacks `ANDROID_HOME` and `JAVA_HOME` / Android Studio JBR.

---

## 2. Official PayHere Documentation & SDK Contract Verification

Verified against official PayHere documentation (`support.payhere.lk`) and direct inspection of the official `@payhere/payhere-mobilesdk-reactnative` npm package (`4.0.14` and `4.1.0`):

### 2.1 PayHere Checkout API (Web & Mobile Web)
- **Endpoints:** Sandbox: `https://sandbox.payhere.lk/pay/checkout`; Live: `https://www.payhere.lk/pay/checkout`.
- **Checkout Request Authorization:** Requests originate from an authorized **Domain** registered in PayHere Portal -> *Domains and Credentials*, with HTTP `Referer` intact and server-generated `hash`:
  $$\text{hash} = \text{UPPER}(\text{MD5}(\text{merchant\_id} + \text{order\_id} + \text{amount} + \text{currency} + \text{UPPER}(\text{MD5}(\text{web\_merchant\_secret}))))$$
- **Amount format:** Exact two-decimal string (`^\d+\.\d{2}$`).
- **`notify_url` Webhook (`application/x-www-form-urlencoded`):** Delivered asynchronously server-to-server from PayHere. Verified via:
  $$\text{md5sig} = \text{UPPER}(\text{MD5}(\text{merchant\_id} + \text{order\_id} + \text{payhere\_amount} + \text{payhere\_currency} + \text{status\_code} + \text{UPPER}(\text{MD5}(\text{channel\_merchant\_secret}))))$$
- **Security rule:** `merchant_secret` and `hash` generation remain strictly server-side; return/cancel redirects are navigation hints only (`GET /api/v1/payments/checkout-status` after verified webhook settlement confirms bookings and unlocks custody passes).

### 2.2 PayHere React Native SDK (`@payhere/payhere-mobilesdk-reactnative`)
Inspected official package tarballs:
- **Version selection (`4.1.0` over `4.0.14`):**
  - `4.0.14` `android/build.gradle` references `jcenter()`, which fails modern Gradle/AGP builds.
  - `4.1.0` removes `jcenter()`, depends on `com.github.PayHereDevs:payhere-android-sdk:v3.0.18` via JitPack (`https://jitpack.io`), and invokes native `PayhereOfficialModule.java` + `PayhereOfficialPackage.java`.
- **Native SDK Bridge API (`index.js` & `PayhereOfficialModule.java`):**
  ```js
  PayHere.startPayment(paymentObject, onCompleted, onError, onDismissed)
  ```
  Keys read natively by Android & iOS modules:
  `sandbox` (boolean), `merchant_id`, `notify_url`, `order_id`, `items`, `amount` (parsed via `Double.valueOf(String.valueOf(...))` on Android -> pass `"1500.00"`), `currency`, `first_name`, `last_name`, `email`, `phone`, `address`, `city`, `country`, `custom_1`, `custom_2`.
  **Crucial difference from Checkout API:** Native Mobile SDK **does not accept** `hash`, `merchant_secret`, `return_url`, or `cancel_url` from the client app; the Android SDK authenticates using the registered Android package (`com.luggagestorage.app`), sends the server-supplied `notify_url`, and PayHere signs the resulting server webhook with the **App's** Merchant Secret (`PAYHERE_MOBILE_MERCHANT_SECRET`).
- **Untrusted SDK callbacks:** `onCompleted(paymentId)`, `onError(errorData)`, and `onDismissed()` must never confirm bookings or unlock custody passes client-side; they trigger an authoritative `GET /api/v1/payments/checkout-status` refresh loop.
- **Compatibility with Expo SDK 58 / React Native `0.88.1` / AGP `9.2`:**
  - Verified React Native `0.88.1` still retains `ActivityEventListener`, `ReactContext`, `ReactPackage`, and `-Xjvm-default=all` in `ReactAndroid/build.gradle.kts`, keeping `PayhereOfficialModule.java` source-compatible.
  - Verified SDK `4.1.0` `android/build.gradle` + `android/src/main/AndroidManifest.xml` need a `pnpm` patch for AGP 9: declare `namespace "lk.payhere"`, remove deprecated `package="lk.payhere"` attribute in SDK manifest, remove duplicate `apply plugin: 'com.android.library'`, and remove deprecated `androidJavadoc` / `androidJavadocsJar` / `androidSourcesJar` / `afterEvaluate` Maven publishing tasks.

---

## 3. Codebase & Configuration Findings (Exact Locations)

### 3.1 `apps/api/src/modules/payments/payment-gateway.port.ts`
- `CreateGatewayCheckoutParams` and `PaymentGatewayPort.buildCheckoutPayload` (`L65-72`) have no `channel` parameter.
- `PayHereGatewayAdapter` (`L264-274`, `L303-350`) stores one `merchantSecret` and one checkout builder that always emits `PayHereCheckoutFormFieldsSchema` (`POST_FORM`).
- `resolvePayHereGatewayAdapter()` (`L615-635`) validates `env.PAYHERE_MERCHANT_SECRET` globally and constructs only a single secret adapter.

### 3.2 `apps/api/src/modules/payments/payments.service.ts`
- `createPaymentIntent` (`L235`, `L374-502`): creates `PAYHERE` intents without `checkoutChannel`. Existing `idempotencyKey` and `activeReusable` checks (`L374-415`) do not distinguish `WEB` vs `MOBILE_APP` channels or legacy pre-channel intents.
- `serializeIntent` (`L155-188`): unconditionally constructs `PayHereCheckoutHandoff` with `method: "POST_FORM"` and `mobileHandoffPath`, requiring `extractPayHereFormFields(payload)` even if an intent originated on another channel or expired before upgrade.
- `processPayHereWebhook` (`L773`, `L831`, `L855`): resolves `resolvePayHereGatewayAdapter()` (`L773`) **before** calling `processGatewayWebhookInternal`, meaning `verifyAndNormalizeNotification` (`L831`) runs with a single global secret before `payment_intents` (`L855`) is queried for the booking/intent's channel.

### 3.3 `apps/api/src/modules/payments/payments.routes.ts`
- `POST /intents` (`L33-52`): parses `CreatePaymentIntentRequestSchema` without `channel`.
- `GET /handoff/:handoffToken` (`L55-78`): returns an auto-submitting HTML form hosted on the API origin **with `Referrer-Policy: no-referrer` (`L75`)**. This breaks PayHere domain verification for mobile web and exposes a deprecated private-LAN HTML bridge instead of native SDK checkout for Android.

### 3.4 `apps/api/src/config/env.ts` & `.env` / `.envs/*.example`
- `env.ts` (`L146-166`, `L440-483`): declares single `PAYHERE_MERCHANT_SECRET` alongside `PAYHERE_MERCHANT_ID`, `PAYHERE_SANDBOX_MODE`, `PAYHERE_NOTIFY_URL`, `PAYHERE_RETURN_URL`, `PAYHERE_CANCEL_URL`. No `PAYHERE_WEB_MERCHANT_SECRET`, `PAYHERE_MOBILE_MERCHANT_SECRET`, or `PAYHERE_ANDROID_PACKAGE_NAME`.
- Active local files observed (values redacted):
  - Root `.env`: `PAYMENT_PROVIDER=payhere`, `PAYHERE_MERCHANT_ID=1239296`, `PAYHERE_MERCHANT_SECRET=<SET, len=56>`, `PAYHERE_SANDBOX_MODE=true`, `PAYHERE_NOTIFY_URL=http://localhost:3000/api/v1/payments/webhooks/payhere`, `PAYHERE_RETURN_URL=http://localhost:5173/booking/confirm`, `PAYHERE_CANCEL_URL=http://localhost:5173/booking/confirm?cancelled=1`.
  - `apps/mobile/.env`: `EXPO_PUBLIC_API_URL=http://192.168.8.181:3000/api/v1`.

### 3.5 `packages/contracts/src/payments/index.ts`
- `PAYMENT_NEXT_ACTIONS` (`L44-47`): `["SANDBOX_SIMULATION", "REDIRECT_TO_PROVIDER"]` — lacks `"LAUNCH_NATIVE_SDK"`.
- `CreatePaymentIntentRequestSchema` (`L94-100`): lacks `channel`.
- `PayHereCheckoutHandoffSchema` (`L129-146`) and `PaymentCheckoutHandoffSchema` (`L148-151`): discriminated on `"method"` (`"SIMULATED" | "POST_FORM"`) with mandatory `mobileHandoffPath`; cannot represent `"NATIVE_SDK"` (`sdkPayload`) or retired legacy expired intents cleanly.
- `PaymentIntentSchema` (`L153-175`): lacks `checkoutChannel`.

### 3.6 `apps/api/src/infrastructure/database/schema/payments.ts` & Migrations
- `paymentIntents` table (`schema/payments.ts` `L30-50`): lacks `checkout_channel` column and DB check constraints enforcing channel validity (`"WEB"` / `"MOBILE_APP"` for active `PAYHERE` intents).
- `migrations/meta/_journal.json`: latest applied baseline migration is `idx: 14` (`0014_phase_b_refund_evidence_integrity`, `when: 1794500000000`). Forward-only migration `0015` must follow `0014`.

### 3.7 `apps/web/index.html`, `apps/web/src/lib/payment-handoff.ts`, `apps/web/src/pages/PublicMarketplacePages.tsx`
- `index.html` (`L1-13`): has no referrer-policy guard; form builder (`payment-handoff.ts` `L106-140`) creates a hidden `<form method="POST">` without explicitly setting `referrerPolicy = "strict-origin-when-cross-origin"`.
- `PublicMarketplacePages.tsx` (`L1324`, `L1785`, `L1859`): omits `channel: "WEB"` when calling `marketplaceApi.createPaymentIntent`; `isReusablePendingIntent` (`L1831-1837`) does not reject wrong-channel intents.

### 3.8 `apps/mobile/app/(traveller)/checkout.tsx`, `apps/mobile/src/lib/payment-handoff.ts`, `apps/mobile/app.json`, `apps/mobile/package.json`
- `checkout.tsx` (`L293-387`, `L561-593`): both web and native Android call `resolveMobileHandoffUrl` + `Linking.openURL`, sending users away to the deprecated API HTML handoff endpoint.
- No `app/booking/confirm.tsx` route exists in `apps/mobile/app/` for Expo Web return/cancel redirect handling.
- `package.json` lacks `@payhere/payhere-mobilesdk-reactnative` and `expo-dev-client`.
- `app.json` (`android.package: "com.luggagestorage.app"`, `L22`) lacks `expo-dev-client` plugin and an Android config plugin for JitPack + `tools:replace="android:allowBackup"`.

### 3.9 Local Tooling & Infrastructure Blockers for Live End-to-End Execution
- **Public HTTPS `notify_url`:** Currently `http://localhost:3000/api/v1/payments/webhooks/payhere`. PayHere's sandbox cloud servers cannot reach `localhost` or LAN IPs; live webhook verification requires HTTPS ingress (tunnel or deployed API).
- **Registered Domain & Package Secrets:** Owner must whitelist the exact public web origin (`Domain`) and `com.luggagestorage.app` (`App`) in PayHere Portal -> *Domains and Credentials* and provision distinct `PAYHERE_WEB_MERCHANT_SECRET` and `PAYHERE_MOBILE_MERCHANT_SECRET`.
- **Android Build SDK / JVM on Local Windows Machine:** Inspection verified `ANDROID_HOME` is unset (`%LOCALAPPDATA%\Android\Sdk` absent) and `JAVA_HOME` is unset (no Android Studio JBR at `C:\Program Files\Android\Android Studio\jbr`). Expo native project generation (`expo prebuild --platform android`) can be verified locally, while APK compilation requires Android SDK/JDK (or EAS Build) plus a physical device or emulator for live PayHere native SDK testing.

---

## 4. Target Remediation Design

1. **Contracts & DB Schema (`0015`):** Add `checkoutChannel` (`"WEB" | "MOBILE_APP"`), `LAUNCH_NATIVE_SDK` action, discriminated handoffs (`POST_FORM` for `WEB`, `NATIVE_SDK` for `MOBILE_APP`, `EXPIRED_LEGACY` for legacy active rows retired during migration `0015`), and forward-only schema migration.
2. **Channel-Isolated Env Validation:** Require `PAYHERE_WEB_MERCHANT_SECRET`, `PAYHERE_MOBILE_MERCHANT_SECRET`, and `PAYHERE_ANDROID_PACKAGE_NAME` when `PAYMENT_PROVIDER=payhere`; fail closed if deprecated `PAYHERE_MERCHANT_SECRET` is still set or if web & mobile secrets are identical.
3. **Safe Webhook Resolution:** Parse untrusted webhook notification safely within 64KB, extract `order_id` / `custom_1`, load `payment_intents` to resolve persisted `checkoutChannel`, select the matching Web or Mobile secret, verify `md5sig` / `merchant_id` / `amountMinor` / `currency`, and execute existing lock-ordered idempotent settlement.
4. **Public Website & Expo Web (`channel: "WEB"`):** Retire `/payments/handoff/:handoffToken` (`410 Gone`), enforce `strict-origin-when-cross-origin` referrer policy on web checkout POST forms, reuse the direct browser POST checkout pattern across both `apps/web` and `apps/mobile` when `Platform.OS === "web"`, and add `app/booking/confirm.tsx` in Expo.
5. **Native Android (`channel: "MOBILE_APP"`):** Install `@payhere/payhere-mobilesdk-reactnative@4.1.0` + `expo-dev-client` + `patches/@payhere__payhere-mobilesdk-reactnative@4.1.0.patch` + `apps/mobile/plugins/withPayHereSdk.js`. Invoke `PayHere.startPayment(sdkPayload, ...)` with server-supplied `sdkPayload` (zero client secrets/hashes) and treat callbacks strictly as triggers to poll `GET /api/v1/payments/checkout-status`.
6. **Honest Reporting:** Report live external gateway acceptance checks as `BLOCKED` until the owner provides public HTTPS ingress, portal-whitelisted domains/package secrets, and an Android device/SDK build environment.

---

## 5. Mandatory 10-Point Audit Matrix

| # | Audit Question | Finding in Baseline `HEAD` (`f54ec50`) |
|---|---|---|
| 1 | Which Merchant Secret creates checkout hashes? | Single global `PAYHERE_MERCHANT_SECRET` (`env.ts`, `resolvePayHereGatewayAdapter()`). |
| 2 | Website domain or mobile app package integration? | Untyped/ambiguous: the single `.env` `PAYHERE_MERCHANT_SECRET` is untagged in repo configuration (cannot distinguish domain vs app package) and was shared across both web and mobile checkouts. |
| 3 | Does initiating browser send `Referer`? | Suppressed on the API HTML bridge: `GET /payments/handoff/:handoffToken` sent `Referrer-Policy: no-referrer` (`payments.routes.ts`); `apps/web` lacked an explicit `<meta name="referrer">` / form `referrerpolicy` guard. |
| 4 | Which origin does web checkout form use? | Registered `apps/web` browser origin (`POST_FORM`), though `createPaymentIntent` omitted `channel: "WEB"` and lacked wrong-channel intent reuse guards. |
| 5 | Which origin does Android external-browser handoff use? | API server origin via `Linking.openURL` to `EXPO_PUBLIC_API_URL/payments/handoff/:handoffToken` (`apps/mobile/app/(traveller)/checkout.tsx`), which in local dev resolved to `http://192.168.8.181:3000/api/v1/...`. |
| 6 | Can Android API base URL resolve to private LAN IP? | Yes — `apps/mobile/.env` sets `EXPO_PUBLIC_API_URL=http://192.168.8.181:3000/api/v1`. Using a LAN API bridge as browser checkout origin is incompatible with PayHere domain authorization. |
| 7 | Is PayHere React Native SDK installed? | Absent in baseline `apps/mobile/package.json`. Official `@payhere/payhere-mobilesdk-reactnative@4.1.0` removes `jcenter()` (still present in `4.0.14`), requires JitPack (`https://www.jitpack.io`), `tools:replace="android:allowBackup"`, and an AGP 9.2 pnpm patch; `payhere-mobilesdk-reactnative.podspec` declares `payHereSDK = 3.1.1` for iOS CocoaPods autolinking. |
| 8 | Can webhook `md5sig` verification distinguish web vs mobile? | No — `processPayHereWebhook` resolved a single global adapter before querying `payment_intents`. |
| 9 | Do retry, return, resume, or confirmation flows bypass channel-specific checkout? | Partially: `createPaymentIntent` could reuse an active intent regardless of channel; Expo web `Platform.OS === "web"` routed through the broken API LAN HTML bridge and lacked `/booking/confirm`. Return URLs and `checkout-status` polling did keep settlement server-authoritative. |
| 10 | Do persisted payment intents contain stale checkout payloads? | Yes — legacy pre-`0015` `PAYHERE` intents lack `checkout_channel` and store `mobileHandoffPath` inside `checkout_payload`. Migration `0015` expires active legacy rows explicitly. |
