# Stage C9 — Mobile Security & Regression Audit Report

**Repository:** `kavicastelo/luggage-storage` (`dev` branch)  
**Final Implementation Commit:** `04eba4a600a2e409d5067b8862ab2e69a1751ea8`  
**Audit Scope:** All Phase C mobile changes (`apps/mobile/**`) verified against Phase A and Phase B security boundaries (`apps/api/src/**` and migrations).

---

## 1. Backend & Migration Integrity

- Zero application logic files under `apps/api/src/**` and zero PostgreSQL migrations under `apps/api/src/infrastructure/database/migrations/**` were modified during Phase C.
- All `15/15` PostgreSQL 16 + PostGIS 3.5 test suites (`337/337` tests) passed uncached under `pnpm turbo run lint typecheck test build --force`.
- Only `apps/api/vitest.config.ts:9-11` was updated (`env: { PAYMENT_PROVIDER: "sandbox" }`) so local Vitest runs match `.env.example:52` and CI isolation regardless of developer root `.env`.

---

## 2. Verification of the 10 Mandatory Security Boundaries (Phase C Section 12)

| # | Security Invariant | Implementation & Verification Evidence | Automated Test Coverage | Verdict |
| :-: | :--- | :--- | :--- | :---: |
| 1 | **Client cannot mark payment successful** | `apps/mobile/app/(traveller)/checkout.tsx:245-353` navigates to `/(traveller)/pass` only after `marketplaceApi.getCheckoutStatus({ bookingId })` returns `bookingStatus` of `"CONFIRMED"` or `"IN_STORAGE"`. External browser return only re-triggers API polling (`AppState` listener at `L272-276` and bounded 4s poll at `L278-285`). | `tests/phase-c-payment-security.test.ts` #4, `tests/phase-b-checkout-handoff.test.ts`, `tests/phase-c-traveller-e2e.test.ts` | **PASS** |
| 2 | **Client cannot generate custody credentials** | `apps/mobile/app/(traveller)/pass.tsx:87-100` fetches `qrToken` and 6-digit `verificationPin` exclusively from `POST /bookings/:id/custody-pass` when backend `status` is `CONFIRMED` or `IN_STORAGE`. `PENDING_PAYMENT` bookings render a locked card (`L223-250`). Legacy `demoBooking` spread and fake static icon are removed; `QrCodeMatrix.tsx` strictly encodes server `issuedPass.qrToken`. | `tests/phase-c-payment-security.test.ts` #5, `tests/phase-c-design-and-icons.test.ts` #3 | **PASS** |
| 3 | **Client cannot bypass booking state transitions** | `bookings.tsx:44-50`, `requests.tsx`, `scanner.tsx`, `intake.tsx`, and `vault.tsx` surface exact backend enum states (`PENDING_HOST_APPROVAL`, `PENDING_PAYMENT`, `CONFIRMED`, `IN_STORAGE`, `COMPLETED`, `DISPUTED`, `CANCELLED_*`, `REJECTED`) without optimistic client transitions. Pass issuance returns `409 PAYMENT_REQUIRED` pre-settlement and custody consumption enforces single-use `409 PASS_ALREADY_CONSUMED`. | `tests/phase-c-payment-security.test.ts` #5-#6, `tests/phase-c-host-e2e.test.ts` | **PASS** |
| 4 | **Client cannot access another traveller's bookings** | `GET /bookings`, `GET /bookings/:bookingId`, `POST /bookings/:bookingId/cancel`, and `POST /bookings/:bookingId/custody-pass` enforce JWT bearer ownership on the server (`apps/api` Phase B suite `337/337` passing). On mobile, unauthenticated screens gate requests behind `isAuthenticated`, and logout wipes caches (`useAuthStore.ts:72-86`). | `apps/api/tests/phase-b-booking-escrow-custody.test.ts`, `tests/phase-c-payment-security.test.ts` #9 | **PASS** |
| 5 | **Host cannot access another host's bookings or business data** | `app/(host)/_layout.tsx:28-92` blocks unauthenticated entry and restricts portal access to `HOST_OWNER`, `HOST_STAFF`, or `SUPERADMIN` (`onboarding` excluded cleanly with live JWT role refresh via `refreshSessionAndUser()` at `useAuthStore.ts:271-274`). Both `earnings.tsx:46-66` and `settings.tsx:71-91` enforce direct `HOST_OWNER`/`SUPERADMIN` guards blocking `HOST_STAFF`. | `apps/mobile/tests/host-mobile-journeys.test.ts`, `apps/api/tests/phase-b-security-remediation.test.ts` | **PASS** |
| 6 | **Host cannot verify arbitrary custody credentials** | `app/(host)/scanner.tsx:82-100` removes offline client-side fixture matching and enforces `POST /hosts/custody/verify` with UUID `bookingId`, operation (`CHECK_IN` / `COLLECTION`), and `qrToken` or `verificationPin`. Brute-force `429 Retry-After` headers parse into `ApiClientError.retryAfterSeconds` (`api-client.ts:105-112`) and render cooldown errors cleanly. | `tests/phase-c-payment-security.test.ts` #6-#7, `tests/phase-c-host-e2e.test.ts` | **PASS** |
| 7 | **Client cannot access restricted location coordinates (`OQ-012`)** | Discovery (`DiscoveryView.tsx`) and location details (`location.tsx:86`) render only server-provided `approximateArea`, grid coordinates, and rounded `distanceMeters` (`formatApproximateDistance` at `LocationCard.tsx:29-37`). Exact `addressLine1` and map directions unlock only inside authenticated `pass.tsx:171-175` after booking payment confirmation. | `tests/phase-c-traveller-e2e.test.ts`, `apps/api/tests/phase-b-booking-escrow-custody.test.ts` | **PASS** |
| 8 | **Merchant credentials never enter the mobile bundle** | `apps/mobile/src/lib/payment-handoff.ts:16-33` launches the server-signed `/payments/handoff/<token>` URL via external browser (`Linking.openURL`), never computes PayHere MD5 hashes, and prohibits `<WebView>`. Post-build recursive bundle + source scan confirmed **0 occurrences** of `PAYHERE_MERCHANT_SECRET`, `JWT_SECRET`, `DATABASE_IDENTITY_SECRET`, `COOKIE_SECRET`, or `R2_SECRET_ACCESS_KEY`. | `tests/phase-c-payment-security.test.ts` #1-#3, post-build `Select-String` scan (`SecretScanCount=0`) | **PASS** |
| 9 | **Payment errors cannot trigger simulated payment success** | Removed the legacy fail-open `else` sandbox branch. `checkout.tsx:300-352` and `L369-410` enforce strict branch matching (`nextAction === "REDIRECT_TO_PROVIDER"` validated by `isPayHerePostHandoff` + `ALLOWED_PAYHERE_HANDOFF_PATH_REGEX`, vs explicit dual-checked `nextAction === "SANDBOX_SIMULATION" && checkoutHandoff.mode === "SANDBOX_SIMULATION"`). Unexpected actions, invalid paths, or network failures fail closed with actionable errors. | `tests/phase-c-payment-security.test.ts` #1-#2, #4 | **PASS** |
| 10 | **Logout clears user-specific cached state** | `useAuthStore.ts:48-59`, `L72-86`, and `L219-245` clear `mobileQueryClient.clear()`, `useMobileStore.getState().resetTransientState()`, `clearAccessToken()`, and `secureStorage.deleteRefreshToken()`. Offline transient errors in `refreshAccessToken()` (`api-client.ts:205-208`) and `initAuth()` (`useAuthStore.ts:121-136`) preserve SecureStore refresh tokens without exposing another account's cache. | `tests/phase-c-payment-security.test.ts` #8-#9 | **PASS** |

---

## 3. Post-Build Bundle Secret Scan Evidence

Executed immediately after the uncached `pnpm turbo run lint typecheck test build --force` export (`apps/mobile/dist/`):

```powershell
Get-ChildItem -Path "apps/mobile/dist","apps/mobile/app","apps/mobile/src" -Recurse -File -Include *.js,*.ts,*.tsx |
  Select-String -Pattern "PAYHERE_MERCHANT_SECRET|JWT_SECRET|DATABASE_IDENTITY_SECRET|COOKIE_SECRET|R2_SECRET_ACCESS_KEY"
```

- **Result:** `SecretScanCount=0` (`0` matches across iOS JS bundle, Android JS bundle, all 40 Web JS chunks, and all TS/TSX source files).
