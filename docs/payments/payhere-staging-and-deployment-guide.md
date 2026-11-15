# PayHere Sandbox & Production Deployment Guide

**Project:** Global Luggage Storage Marketplace (`kavicastelo/luggage-storage`)  
**Market / Currency:** Sri Lanka (`LKR`)  
**Android Package / URL Scheme:** `com.luggagestorage.app` / `luggagestorage`

---

## 1. Why Web and Android Must Use Separate PayHere Credentials

PayHere validates Checkout API form POSTs and Native SDK transactions against separately authorized entries in the Merchant Portal (**Settings > Domains and Credentials** or **Side Menu > Integrations > Add Domain/App**):

- **Domain entry (Web & Expo Mobile Web):** Authorizes your HTTPS web origin (e.g., `https://app.luggagestorage.lk` or staging HTTPS URL) and issues `PAYHERE_WEB_MERCHANT_SECRET`.
- **App entry (Native Android):** Authorizes `com.luggagestorage.app` (`PAYHERE_ANDROID_PACKAGE_NAME`) and issues `PAYHERE_MOBILE_MERCHANT_SECRET`.

Sharing one `PAYHERE_MERCHANT_SECRET` causes signature verification (`md5sig`) or PayHere authorization checks to fail for one of the channels. The API enforces this structurally at startup:
- `PAYHERE_MERCHANT_SECRET` (legacy) is **rejected** (`fail-closed`).
- `PAYHERE_WEB_MERCHANT_SECRET` and `PAYHERE_MOBILE_MERCHANT_SECRET` must both be configured when `PAYMENT_PROVIDER=payhere` and **must be distinct**.

---

## 2. PayHere Merchant Portal Setup (Sandbox vs Live)

1. Sign in to the matching PayHere account (**Sandbox:** `sandbox.payhere.lk` merchant portal; **Live:** `www.payhere.lk` merchant portal).
2. Open **Integrations / Domains and Credentials -> Add Domain/App**:
   - **Web App (`apps/web`):** Add **Domain** with your public HTTPS origin (and ensure `PAYHERE_RETURN_URL` / `PAYHERE_CANCEL_URL` match that domain). Copy the generated secret -> `PAYHERE_WEB_MERCHANT_SECRET`.
   - **Expo Mobile Web (when served on a separate origin):** Either host Expo Web under an authorized domain matching `PAYHERE_RETURN_URL` or register its origin domain in PayHere and align `PAYHERE_RETURN_URL` / `PAYHERE_CANCEL_URL`.
   - **Android Native App (`apps/mobile`):** Add **App** with Package Name `com.luggagestorage.app`. Copy the generated secret -> `PAYHERE_MOBILE_MERCHANT_SECRET`.
3. Note your Merchant ID (`PAYHERE_MERCHANT_ID`). Keep all secrets exclusively in the **API environment** (`apps/api` or root secret manager); never place them in `VITE_*` or `EXPO_PUBLIC_*`.

---

## 3. Webhook Reachability (`PAYHERE_NOTIFY_URL`) & Callback URLs

PayHere servers deliver `POST PAYHERE_NOTIFY_URL` (`application/x-www-form-urlencoded`) asynchronously out-of-band:
- **`localhost` or LAN IPs (`192.168.x.x`, `10.0.2.2`) cannot receive webhooks from `sandbox.payhere.lk`.**
- For local sandbox end-to-end tests:
  1. Expose `apps/api` (port `3000`) through an HTTPS tunnel (e.g., Cloudflare Tunnel `cloudflared tunnel --url http://localhost:3000` or ngrok).
  2. Set `PAYHERE_NOTIFY_URL=https://<tunnel-host>/api/v1/payments/webhooks/payhere`.
  3. Serve web via a registered HTTPS origin matching `PAYHERE_RETURN_URL=https://<web-origin>/booking/confirm` and `PAYHERE_CANCEL_URL=https://<web-origin>/booking/confirm?cancelled=1` (and include that origin in `CORS_ORIGIN`).
  4. In `apps/mobile/.env`, point `EXPO_PUBLIC_API_URL=https://<tunnel-host>/api/v1` (or staging HTTPS API).
- Never rely on browser `return_url` or mobile SDK `onCompleted` callbacks to confirm bookings: `GET /api/v1/payments/checkout-status` unlocks custody passes **strictly after verified server webhook settlement**.

---

## 4. HTTP Referrer Policy Requirements for Web Checkout

- PayHere validates the HTTP `Referer` header sent with `POST https://sandbox.payhere.lk/pay/checkout`.
- `apps/web/src/lib/payment-handoff.ts` and `apps/mobile/src/lib/payment-handoff.ts` explicitly set `referrerpolicy="strict-origin-when-cross-origin"` on the submitted form and fail closed if `<meta name="referrer">` is configured as `"no-referrer"` or `"same-origin"`.
- Do not add `Referrer-Policy: no-referrer` or `COOP`/`CSP` `form-action` blocks that forbid `https://sandbox.payhere.lk` / `https://www.payhere.lk` on frontend hosting headers.

---

## 5. Native Android `expo-dev-client` Build Workflow (`apps/mobile`)

`@payhere/payhere-mobilesdk-reactnative` uses native Java modules (`PayhereOfficialModule`) and JitPack (`com.github.PayHereDevs:payhere-android-sdk:v3.0.18`). It **cannot run in Expo Go**; it requires a custom dev build (`expo-dev-client`):

1. Install dependencies from monorepo root: `pnpm install`
2. Prebuild Android native project:
   ```bash
   pnpm --filter @luggage-storage/mobile exec expo prebuild --platform android --clean
   ```
   Verify `apps/mobile/plugins/withPayHereSdk.js` injected:
   - `maven { url 'https://www.jitpack.io' }` in `android/build.gradle`
   - `xmlns:tools="http://schemas.android.com/tools"` and `tools:replace="android:allowBackup"` in `android/app/src/main/AndroidManifest.xml`
3. Build & run locally (requires `ANDROID_HOME` and JDK 17+ / `JAVA_HOME`):
   ```bash
   pnpm --filter @luggage-storage/mobile exec expo run:android
   ```
   Or via EAS Build (`eas build --profile development --platform android`).
4. Do not commit generated `/apps/mobile/android/` or `/apps/mobile/ios/` directories (ignored in `.gitignore`).

