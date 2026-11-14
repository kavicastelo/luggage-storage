# Phase B Security, Payment Integrity & Final Acceptance Remediation Report

**Project:** Global Luggage Storage Marketplace  
**Target Branch:** `dev`  
**Stage:** Phase B Security, Payment Integrity & Final Acceptance Remediation  
**Database Engine:** PostgreSQL 16 + PostGIS 3.5  
**Launch Market / Currency:** Sri Lanka (`LKR`, ISO 4217 exponent `2`)

---

## 1. Baseline Commit and Final Remediation Commit SHA

- **Initial Phase B Baseline Merge Commit:** `a9a6dafca9a894115c540dbdad7bced4e5f72173`
- **Phase A Security Closure Commit (Preserved in Ancestry):** `015b9d18a5cae68611aefb9134ad5a8e6b05d735` (`git merge-base --is-ancestor` verified exit code `0`)
- **Initial Remediation Implementation Commit SHA (`dev`):** `b92afb9315e14e13704328651a4ecb00758229d2` (`015b9d18`..`b92afb93`, migration `0013`; verified green by GitHub Actions `CI Pipeline` run `43511968537`)
- **Final Payment Acceptance Audit Baseline (`dev`):** `05530809cb3f0681451979675969e2233268db26` (`git merge-base --is-ancestor` verified exit code `0`)
- **Final Payment Acceptance Implementation Commit SHA (`dev`):** `933ecc4d629511d3b86d382311afaa13411140c5` *(contains all `39` code, forward-only migration `0014`, PayHere checkout & handoff endpoints, Web/Mobile checkout handoff & custody gate, refund evidence integrity, environment template, turbo, and test updates; verified green by GitHub Actions `CI Pipeline` run `43532278588`, `conclusion: success`)*
- **Final Documentation Update:** Documentation-only commit on `dev` (`docs/architecture/phase-b-security-payment-integrity-remediation-report.md`, `docs/architecture/backend-domain-overview.md`, `docs/product/assumptions-and-open-questions.md`) recording the verified CI run `43532278588` (`conclusion: success`) from commit `933ecc4d629511d3b86d382311afaa13411140c5`.

---

## 2. Findings and Resolutions (B1–B9)

| ID | Priority | Original Audit Finding | Resolution Implemented | Status |
| :--- | :--- | :--- | :--- | :--- |
| **B1** | Critical | Custody helper used unkeyed `SHA-256`, allowing database-only offline guessing of 6-digit PINs; documentation inaccurately claimed keyed HMAC-SHA256. | Introduced `CUSTODY_TOKEN_HMAC_SECRET` (>= 32 chars, fail-closed startup, production placeholder rejection, separation from `DB_IDENTITY_SECRET`, `DB_IDENTITY_RETIRING_SECRET`, `PAYMENT_WEBHOOK_SECRET`, `RATE_LIMIT_HASH_SECRET`); implemented domain-separated keyed HMAC-SHA256 (`hmac-sha256-v2`) with 32-byte `crypto.timingSafeEqual`, leading-zero 6-digit PINs, uniform actor/booking rate limiting across `/verify`, `/check-in`, and `/check-out`, and forward-only migration `0013` revoking unconsumed legacy `sha256-legacy-v1` tokens while preserving completed history. | `PASS` |
| **B2** | Critical | `PaymentGatewayPort` lacked provider-neutral webhook verification/normalization; webhook handling only served `/webhooks/sandbox`, leaving PayHere notification processing and provider isolation unimplemented. | Extended `PaymentGatewayPort` with `verifyNotificationSignature`, `normalizeVerifiedNotification`, `verifyAndNormalizeNotification`, and `extractNotificationIdentifiers`; implemented `PayHereGatewayAdapter` (`POST /api/v1/payments/webhooks/payhere`, 64 KB body limit returning `413`, duplicate form-key HPP rejection, isolated MD5 `hash`/`md5sig`, integer minor-unit decimal parsing, deterministic `payhere_evt_*` IDs); enforced cross-provider isolation (`409`), production block on `SandboxSignedGatewayAdapter` (`403`), and shared settlement via `processGatewayWebhookInternal`. Commercial live PayHere launch remains gated on external approval & credentials (`OQ-003`). | `PARTIAL` *(Code & tests `PASS`; live PayHere credentials & written approval remain external owner-managed dependencies)* |
| **B3** | High | Webhook path locked `payment_intents` before `bookings` while cancellation locked `bookings` first, creating PostgreSQL deadlock exposure. | Standardized one global 5-tier lock order (`storage_capacity_pools` -> `bookings` -> `payment_intents` -> `refund_records`/`custody_records`/`custody_tokens` -> `host_payables`/append-only inserts) across all Phase B mutations; added bounded `withSerializableOrDeadlockRetry` (`40P01`/`40001`, up to 2 retries / 3 total attempts) strictly around pure DB transactions; verified with real PostgreSQL concurrency races in 3 consecutive runs. | `PASS` |
| **B4** | High | `createPaymentIntent()` read `bookings` without `FOR UPDATE`, allowing a concurrent cancellation to commit while a new pending payment intent still committed. | `createPaymentIntent()` now locks `bookings FOR UPDATE` first, evaluates hold expiry against PostgreSQL `NOW()` (committing `EXPIRED_HOLD` before throwing `409`), validates ownership, status, and `booking_pricing_snapshots`, locks `payment_intents ORDER BY id ASC FOR UPDATE`, enforces the full idempotency matrix, and backs uniqueness in PostgreSQL via partial unique index `payment_intents_single_active_per_booking_idx`. | `PASS` |
| **B5** | High | Refund `payment_transactions` hardcoded provider attribution, refund state transitions needed idempotency hardening, and cancellation settlements hardcoded commission bps. | `adminTransitionRefund` now resolves the booking payment intent's actual `provider` (`SANDBOX_GATEWAY` or `PAYHERE`), supports idempotent retries on matching target state, uses snapshotted `commissionRateBps` (`booking_pricing_snapshots.commission_rate_bps`) during cancellation settlements, enforces `PG_INT_MAX` (`2_147_483_647`) and `0 <= refundAmountMinor <= paidAmountMinor` guards, and maintains global `SUM(DEBIT) === SUM(CREDIT)` without escrow claims. | `PASS` |
| **B6** | Medium | Documentation contained stale schema/policy descriptions (`db_identity_secrets`, `is_active`/`activated_at`/`retired_at`, `refund_events`, 24h cancellation window, SHA-256 custody claim, table-count confusion, CI claims). | Reconciled `docs/architecture/backend-domain-overview.md`, `docs/product/assumptions-and-open-questions.md`, UI/mock copy, `.env*.example` & `.envs/*.example` templates, and `turbo.json` (`globalPassThroughEnv`); updated this report to distinguish local runs, PostgreSQL integration tests, GitHub Actions CI runs (`43511968537` & `43532278588` `success`), and owner launch gates. | `PASS` |
| **B7** | Critical | PayHere checkout payload lacked required `return_url`, `cancel_url`, `notify_url`, and customer billing fields (`first_name`, `last_name`, `email`, `phone`, `address`, `city`, `country`, plus `items`, `custom_1`, `custom_2`); env validation lacked PayHere callback URL checks; no signed server POST handoff or authoritative checkout-status polling endpoint existed. | Updated `PayHereGatewayAdapter` to emit the full 18-key checkout form payload (16 core PayHere fields + `custom_1`/`custom_2`), added `PAYHERE_NOTIFY_URL`/`PAYHERE_RETURN_URL`/`PAYHERE_CANCEL_URL` fail-closed env validation (production HTTPS & non-private-IP checks), implemented fail-closed customer billing resolution from persisted profile + optional partial `customerDetails` (`400`), added CSP-hardened `GET /api/v1/payments/handoff/:handoffToken` (`routerOptions: { maxParamLength: 512 }` in `apps/api/src/app.ts`) and `GET /api/v1/payments/checkout-status`, and restricted `POST /api/v1/payments/intents/:intentId/sandbox-simulate` (`403` when `NODE_ENV=production`, `PAYMENT_PROVIDER!==sandbox`, or intent provider `!== SANDBOX_GATEWAY`). Commercial live PayHere launch remains gated on external approval & credentials (`OQ-003`). | `PARTIAL` *(Code & tests `PASS`; live PayHere credentials & written approval remain owner-managed external dependencies)* |
| **B8** | High | Traveller web and mobile checkout flows did not execute a real provider-aware PayHere handoff, relying on sandbox simulation, and needed hardened return/resume verification before unlocking custody passes. | Implemented `apps/web/src/lib/payment-handoff.ts` (`submitPayHerePostForm` strictly targeting `https://sandbox.payhere.lk/pay/checkout` or `https://www.payhere.lk/pay/checkout`, `parseCheckoutReturnQuery` ignoring forged query params like `?status=paid`/`?status_code=2`/`?md5sig=...`, `sessionStorage` pending context) and `apps/mobile/src/lib/payment-handoff.ts` (`resolveMobileHandoffUrl` + `openExternalPayHereHandoff` with `AppState` foreground resume polling + duplicate-submit locks), wired `GET /api/v1/payments/checkout-status` polling, and enforced strict `CONFIRMED`/`IN_STORAGE` server custody pass gating on both web and mobile. | `PASS` |
| **B9** | Critical | `adminTransitionRefund(..., "SUCCEEDED")` fabricated synthetic `rfnd_*`/`RFD-GW-*` provider references and falsely persisted `signatureVerified: true` on `payment_transactions` without cryptographic webhook verification, duplicate guards, or captured-charge refund caps. | Removed all synthetic `rfnd_*`/`RFD-GW-*` ID generation and false `signatureVerified: true`; enforced explicit `settlementMode` (`PROVIDER_CONFIRMED` with `providerRefundId` -> `evidenceSource = 'ADMIN_PROVIDER_ATTESTED'`, or `MANUAL_OFFLINE` with `manualReference` -> `evidenceSource = 'ADMIN_MANUAL_OFFLINE'`, always `signatureVerified = false`); added forward-only migration `0014_phase_b_refund_evidence_integrity.sql` with PostgreSQL `CHECK` constraints, partial unique indexes, and legacy backfill; enforced `409` duplicate reference & captured-charge ceiling guards, 5x concurrency serialization, and stale webhook replay immunity. | `PASS` |

---

## 3. Files Changed and Migration Numbers

### 3.1 Forward-Only Migrations Preserved and Added

- **Preserved Untouched:** Migrations `0000` through `0013` remain completely unmodified (`git diff` across `0000`–`0013` empty).
- **Added Migration (`0014`, following `0013`):**
  - `apps/api/src/infrastructure/database/migrations/0014_phase_b_refund_evidence_integrity.sql`
  - `apps/api/src/infrastructure/database/migrations/meta/0014_snapshot.json`
  - `apps/api/src/infrastructure/database/migrations/meta/_journal.json` (`15` total entries: indices `0`..`14`)

### 3.2 Modified Files in Initial Remediation (`b92afb93`)

- **Backend Security, Config, Crypto & Database:**
  - `apps/api/src/config/env.ts`
  - `apps/api/src/common/crypto/custody-hmac.ts` *(new)*
  - `apps/api/src/common/middleware/error-handler.ts`
  - `apps/api/src/infrastructure/database/tx-retry.ts` *(new)*
  - `apps/api/src/infrastructure/database/schema/custody.ts`
  - `apps/api/src/infrastructure/database/schema/payments.ts`
  - `apps/api/src/infrastructure/database/migrations/0013_phase_b_custody_hmac_and_payment_integrity.sql` *(new)*
  - `apps/api/src/infrastructure/database/migrations/meta/0013_snapshot.json` *(new)*
  - `apps/api/src/infrastructure/database/migrations/meta/_journal.json`
- **Backend Domain Modules:**
  - `apps/api/src/modules/bookings/bookings.service.ts`
  - `apps/api/src/modules/bookings/quotation-availability.service.ts`
  - `apps/api/src/modules/custody/custody.service.ts`
  - `apps/api/src/modules/finance/ledger.service.ts`
  - `apps/api/src/modules/payments/payment-gateway.port.ts`
  - `apps/api/src/modules/payments/payments.routes.ts`
  - `apps/api/src/modules/payments/payments.service.ts`
- **Backend Automated Tests:**
  - `apps/api/tests/phase-a-security-remediation.test.ts`
  - `apps/api/tests/stabilization-security.test.ts`
  - `apps/api/tests/phase-b-booking-escrow-custody.test.ts`
  - `apps/api/tests/phase-b-security-remediation.test.ts` *(new)*
- **Web & Mobile Copy Reconciliation and Tests:**
  - `apps/web/src/data/mock-marketplace.ts`
  - `apps/web/src/pages/AdminDashboardPages.tsx`
  - `apps/web/src/pages/PublicMarketplacePages.tsx`
  - `apps/web/tests/phase-b-marketplace-flows.test.tsx`
  - `apps/mobile/src/data/mock-marketplace.ts`
  - `apps/mobile/tests/phase-b-mobile-flows.test.ts`
- **Environment Templates, CI & Build Config:**
  - `.env.example`, `apps/api/.env.example`, `.envs/README.md`, `.envs/root.example`, `.envs/api.example`, `.envs/development.example`, `.envs/test.example`, `.envs/production.example`, `.github/workflows/ci.yml`, `turbo.json`

### 3.3 Modified Files in Final Payment Acceptance (`933ecc4d`, `39` Files + Docs)

- **Shared Contracts:**
  - `packages/contracts/src/bookings/index.ts`
  - `packages/contracts/src/payments/index.ts`
- **Backend API, Database Schema & Migration `0014`:**
  - `apps/api/src/app.ts` *(Fastify v5 `routerOptions: { maxParamLength: 512 }`)*
  - `apps/api/src/config/env.ts`
  - `apps/api/src/infrastructure/database/schema/payments.ts`
  - `apps/api/src/infrastructure/database/migrations/0014_phase_b_refund_evidence_integrity.sql` *(new)*
  - `apps/api/src/infrastructure/database/migrations/meta/0014_snapshot.json` *(new)*
  - `apps/api/src/infrastructure/database/migrations/meta/_journal.json`
  - `apps/api/src/modules/bookings/bookings.service.ts`
  - `apps/api/src/modules/payments/payment-gateway.port.ts`
  - `apps/api/src/modules/payments/payments.routes.ts`
  - `apps/api/src/modules/payments/payments.service.ts`
- **Web & Mobile Checkout Handoff, Admin UI & Services:**
  - `apps/web/src/lib/payment-handoff.ts` *(new)*
  - `apps/web/src/pages/AdminDashboardPages.tsx`
  - `apps/web/src/pages/PublicMarketplacePages.tsx`
  - `apps/web/src/services/marketplace-api.ts`
  - `apps/mobile/src/lib/payment-handoff.ts` *(new)*
  - `apps/mobile/src/services/api-client.ts`
  - `apps/mobile/src/services/marketplace-api.ts`
  - `apps/mobile/app/(traveller)/checkout.tsx`
  - `apps/mobile/app/(traveller)/pass.tsx`
- **Automated Tests (`API`, `Web`, `Mobile`):**
  - `apps/api/tests/phase-b-payhere-checkout.test.ts` *(new)*
  - `apps/api/tests/phase-b-refund-evidence.test.ts` *(new)*
  - `apps/api/tests/phase-b-booking-escrow-custody.test.ts`
  - `apps/api/tests/phase-b-security-remediation.test.ts`
  - `apps/api/tests/stabilization-security.test.ts`
  - `apps/web/tests/phase-b-checkout-handoff.test.tsx` *(new)*
  - `apps/web/tests/phase-b-marketplace-flows.test.tsx`
  - `apps/web/tests/public-web-journeys.test.tsx`
  - `apps/mobile/tests/phase-b-checkout-handoff.test.ts` *(new)*
- **Environment Templates & Turbo Config:**
  - `.env.example`, `apps/api/.env.example`, `.envs/README.md`, `.envs/root.example`, `.envs/api.example`, `.envs/development.example`, `.envs/test.example`, `.envs/production.example`, `turbo.json`
- **Architecture & Product Documentation:**
  - `docs/architecture/backend-domain-overview.md`
  - `docs/product/assumptions-and-open-questions.md`
  - `docs/architecture/phase-b-security-payment-integrity-remediation-report.md` *(this report)*

*(Security hygiene check: `git check-ignore -v .env apps/api/.env` confirmed `.env` and `apps/api/.env` are excluded by `.gitignore` rule line 13 and are not tracked.)*

---

## 4. Custody HMAC Design and Legacy Token Migration Behavior (B1)

1. **Dedicated Secret & Key Separation (`apps/api/src/config/env.ts`):**
   - `CUSTODY_TOKEN_HMAC_SECRET` is required (`>= 32` characters trimmed) with no insecure fallback or PostgreSQL storage.
   - `EnvSchema.superRefine` rejects exact secret reuse against `DB_IDENTITY_SECRET`, `DB_IDENTITY_RETIRING_SECRET`, `PAYMENT_WEBHOOK_SECRET`, and `RATE_LIMIT_HASH_SECRET`.
   - In `NODE_ENV === "production"`, `EnvSchema` rejects placeholder/development/test/example values via `isProductionPlaceholderSecret`.
   - Environment templates (`.env.example`, `apps/api/.env.example`, `.envs/{root,api,development,test,production}.example`, `.envs/README.md`) and `.github/workflows/ci.yml` declare `CUSTODY_TOKEN_HMAC_SECRET`.

2. **Keyed Domain-Separated HMAC-SHA256 (`apps/api/src/common/crypto/custody-hmac.ts`):**
   - `computeCustodyCredentialHmac` uses `crypto.createHmac("sha256", Buffer.from(secret, "utf8"))`.
   - Canonical input uses unambiguous length-delimited serialization:
     `JSON.stringify(["hmac-sha256-v2", purpose, normalizedBookingId, operation, normalizedCredential])`,
     where `purpose` is `"CUSTODY_QR"` or `"CUSTODY_PIN"`, `normalizedBookingId` is validated/lowercased UUID, `operation` is `"CHECK_IN"` or `"COLLECTION"`, and `normalizedCredential` is validated 64-hex (`CUSTODY_QR`) or exact 6 ASCII digits `/^\d{6}$/` preserving leading zeros `"000000".."999999"` (`CUSTODY_PIN`).
   - `verifyCustodyCredentialHmac` validates 64-hex digest format before decoding both expected and stored digests to fixed 32-byte buffers (`Buffer.from(..., "hex")`) and comparing with `crypto.timingSafeEqual`.
   - Source grep across `apps/api/src/modules/custody/*.ts` confirmed zero remaining unkeyed `createHash('sha256')` calls and zero raw `qrToken`, `verificationPin`, or `CUSTODY_TOKEN_HMAC_SECRET` logging in logger/audit metadata.

3. **Uniform Rate Limiting, Single-Use Consumption & Operation Binding (`apps/api/src/modules/custody/custody.service.ts`):**
   - `verifyCustodyPassForHost` (`/hosts/custody/verify`), `completeCheckIn` (`/check-in`), and `completeCollection` (`/check-out`) enforce identical actor and booking rate limits (`custody_verify_actor`, `custody_verify_booking`) before digest verification, preventing rate-limit evasion by switching endpoints or callers.
   - Tokens filter strictly for `hash_version = 'hmac-sha256-v2'`, `consumed_at IS NULL`, `revoked_at IS NULL`, `expires_at > NOW()`, `booking_id`, and `operation` (`CHECK_IN` vs `COLLECTION` cannot cross-authorize).
   - Successful `completeCheckIn` / `completeCollection` atomically sets `consumed_at = NOW()` and updates `custody_records` inside the transaction.

4. **Migration `0013` & Secret Rotation Policy:**
   - Migration `0013` adds `custody_tokens.hash_version varchar(32)` with check constraint `custody_tokens_hash_version_check` (`IN ('sha256-legacy-v1', 'hmac-sha256-v2')`), labels pre-`0013` rows `'sha256-legacy-v1'`, sets default `'hmac-sha256-v2'` for new rows, revokes all unconsumed legacy tokens (`revoked_at = NOW()` where `consumed_at IS NULL`), clears unverified `checkin_pin_hash` / `collection_pin_hash` summaries on active non-terminal `custody_records` tied to those revoked tokens, and leaves completed consumed tokens, `bag_custody_items`, and `custody_events` untouched.
   - **Maintenance-Window Rotation Procedure:** Multi-secret overlap is intentionally omitted to avoid widening offline brute-force windows across keys. Rotating `CUSTODY_TOKEN_HMAC_SECRET` requires a scheduled maintenance window: revoke unconsumed active `custody_tokens`, deploy the new >= 32-character secret, and instruct travellers with active `CONFIRMED`/`IN_STORAGE` bookings to re-issue fresh custody passes via `POST /api/v1/bookings/:bookingId/custody-pass`.

---

## 5. PayHere Checkout, Client Handoff & Notification Verification Design (B2, B7, B8)

1. **`PaymentGatewayPort` & Complete PayHere Checkout Contract (`packages/contracts/src/payments/index.ts`, `payment-gateway.port.ts`):**
   - Exposes `buildCheckoutPayload`, `verifyNotificationSignature`, `normalizeVerifiedNotification`, `verifyAndNormalizeNotification`, and `extractNotificationIdentifiers`.
   - `PayHereGatewayAdapter.buildCheckoutPayload` constructs the complete `PayHereCheckoutFormFieldsSchema` payload (16 core PayHere fields: `merchant_id`, `return_url`, `cancel_url`, `notify_url`, `order_id`, `items`, `currency`, `amount`, `first_name`, `last_name`, `email`, `phone`, `address`, `city`, `country`, `hash`, plus server-assigned correlation fields `custom_1` = `paymentIntentId` and `custom_2` = `bookingId`) and returns a discriminated `PayHereCheckoutHandoff` (`method: "POST_FORM"`, `actionUrl` restricted to `https://sandbox.payhere.lk/pay/checkout` or `https://www.payhere.lk/pay/checkout`, and `mobileHandoffPath`).
   - Callback URL configuration (`PAYHERE_NOTIFY_URL`, `PAYHERE_RETURN_URL`, `PAYHERE_CANCEL_URL`) is validated fail-closed in `apps/api/src/config/env.ts` (required when `PAYMENT_PROVIDER=payhere`; rejects placeholder `REPLACE_WITH` strings, invalid URLs, embedded credentials, and in `NODE_ENV=production` rejects non-HTTPS, `localhost`, and private/loopback IP URLs).
   - Customer billing details resolve strictly on the server in `payments.service.ts` from persisted traveller profile records merged with optional `customerDetails`, failing closed (`400`) when required billing fields are absent and rejecting client-supplied `merchant_id`, callback URL, `amount`, `currency`, or `hash` overrides.
   - `GET /api/v1/payments/handoff/:handoffToken` serves a CSP-hardened auto-submitting POST form (`no-store`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`) with Fastify v5 `routerOptions: { maxParamLength: 512 }` in `apps/api/src/app.ts` so ~128-char signed tokens do not hit Fastify's `100`-char `414` limit; `GET /api/v1/payments/checkout-status` provides authenticated authoritative polling (`bookingStatus`, `custodyReady`, `pollRecommended`, `canRetryPayment`).

2. **Traveller Web & Mobile Provider-Aware Handoff (B8):**
   - **Web (`apps/web/src/lib/payment-handoff.ts`, `PublicMarketplacePages.tsx`):** Inspects `intent.nextAction` (`REDIRECT_TO_PROVIDER`) and `checkoutHandoff` (`method === "POST_FORM"`), validates `actionUrl` against `ALLOWED_PAYHERE_CHECKOUT_URLS`, persists pending checkout context in `sessionStorage`, submits a hidden HTML `POST` form directly to PayHere, ignores spoofed URL query claims (`parseCheckoutReturnQuery` flags `?status=`, `?status_code=`, `?payment_id=`, `?md5sig=`, `?paid=`), and polls `/payments/checkout-status` until webhook confirmation unlocks `CONFIRMED` custody views.
   - **Mobile (`apps/mobile/src/lib/payment-handoff.ts`, `checkout.tsx`, `pass.tsx`):** Validates `mobileHandoffPath` (`/^\/payments\/handoff\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/`) via `resolveMobileHandoffUrl`, launches an external browser session via `openExternalPayHereHandoff` (zero secrets or MD5 logic in client bundles), enforces duplicate-submit locks, polls `/payments/checkout-status` automatically on `AppState` `"active"` resume, and unlocks custody QR/PIN only once booking status is `CONFIRMED` or `IN_STORAGE`.
   - Sandbox simulation (`POST /api/v1/payments/intents/:intentId/sandbox-simulate`) returns `403` whenever `NODE_ENV === "production"`, `PAYMENT_PROVIDER !== "sandbox"`, or the intent's `provider !== "SANDBOX_GATEWAY"`.

3. **`PayHereGatewayAdapter` & Route Hardening (`POST /api/v1/payments/webhooks/payhere`):**
   - Route `apps/api/src/modules/payments/payments.routes.ts` sets `bodyLimit: 65_536` (64 KB; `apps/api/src/common/middleware/error-handler.ts` preserves Fastify 4xx `413` responses as `BAD_REQUEST` instead of `500`), accepts `application/x-www-form-urlencoded` (custom raw duplicate-parameter scanner rejects HTTP Parameter Pollution duplicate keys before decoding) and strict flat `application/json`.
   - Isolates official PayHere protocol MD5 computation inside private `payHereMd5Upper` (`crypto.createHash("md5")`) methods — source sweep across `apps/*/src` and `packages/*/src` confirms `md5` appears **only** in `payment-gateway.port.ts`.
   - Verifies checkout `hash = MD5(merchant_id + order_id + amount + currency + MD5(merchant_secret).toUpperCase()).toUpperCase()` and webhook `md5sig = MD5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + MD5(merchant_secret).toUpperCase()).toUpperCase()` using fixed 32-hex validation and `crypto.timingSafeEqual`.
   - Verifies configured `merchant_id`, parses decimal amounts using pure integer string arithmetic (`parsePayHereDecimalAmountToMinor`, rejecting scientific notation, overflow, malformed decimals, or exponent mismatches), and maps `status_code`: `2 -> SUCCEEDED`, `0 -> PENDING`, `-1 -> CANCELLED`, `-2 -> FAILED`, `-3 -> CHARGEDBACK`.
   - Derives deterministic deduplication key `payhere_evt_<sha256[0:48]>` from canonical `[merchant_id, order_id, payment_id, status_code, payhere_amount, currency, md5sigLower]`.
   - **Documented Limitation of Derived Event ID:** Because PayHere `notify_url` payloads do not include a separate opaque gateway webhook event UUID, identical re-deliveries compute the same `payhere_evt_*` ID (replayed safely as `duplicate: true`), while distinct state transitions (`0` -> `2` -> `-3`) carry distinct `status_code` values and produce distinct `payhere_evt_*` IDs handled idempotently by the state machine.

4. **Sandbox Isolation & Shared Settlement Pipeline (`payments.service.ts`):**
   - `SandboxSignedGatewayAdapter` throws `403` when `nodeEnv === "production"` across `verifyNotificationSignature`, `normalizeVerifiedNotification`, `verifyAndNormalizeNotification`, and `EnvSchema` blocks `PAYMENT_PROVIDER=sandbox` in `production`.
   - `simulateSandboxPayment` returns `403` (`AppError.forbidden`) when `NODE_ENV === "production"`, `PAYMENT_PROVIDER !== "sandbox"`, or the target intent is not `SANDBOX_GATEWAY`.
   - Both `/webhooks/sandbox` and `/webhooks/payhere` execute signature/field verification **before** entering the transaction and locking rows, then delegate to the single shared `processGatewayWebhookInternal` pipeline, which enforces matching `provider` (`409` on cross-provider attempt), matching `paymentIntentId` (`custom_1` `409`), immutable pricing snapshot amount/currency matching (`400`), `(provider, provider_transaction_id)` cross-intent uniqueness (`409`), late capture handling (`ORPHANED_SUCCEEDED` + balanced capture + 100% `LATE_WEBHOOK_EXPIRED_HOLD` refund without capacity revival), chargeback review flagging (`DISPUTED` + `host_payables` `ON_HOLD`), and out-of-order lower-precedence protection (`ALREADY_SETTLED_NOOP`).

5. **Distinction From Unmet External Dependencies (`OQ-003`):**
   - Protocol-accurate PayHere adapter code, signed checkout handoff endpoints, Web/Mobile flows, and fixture tests do **not** constitute live provider certification. Commercial PayHere activation still requires written PayHere marketplace settlement approval, live merchant credentials (`PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET`, `PAYHERE_SANDBOX_MODE=false`), live `https://` callback URLs (`PAYHERE_NOTIFY_URL`, `PAYHERE_RETURN_URL`, `PAYHERE_CANCEL_URL`), and live sandbox/production webhook & refund certification.

---

## 6. Global Database Lock Order and Bounded Retry Discipline (B3/B4)

1. **Canonical Global Lock Order (`apps/api/src/infrastructure/database/tx-retry.ts`):**
   1. `storage_capacity_pools` (`ORDER BY id ASC FOR UPDATE`) — when allocating capacity holds
   2. `bookings` (`FOR UPDATE`) — single row (`id = bookingId`)
   3. `payment_intents` (`ORDER BY id ASC FOR UPDATE`) — all intents for the booking
   4. `refund_records` / `custody_records` / `custody_tokens` (`ORDER BY id ASC FOR UPDATE`)
   5. `host_payables` updates / append-only inserts (`payment_transactions`, `payment_webhook_events`, `booking_status_history`, `financial_ledger_entries`, `custody_events`, `security_audit_events`)

2. **Applied Across All Phase B Entry Points:**
   - Pre-transaction lookups (`resolve bookingId`) occur read-only *outside* the locked transaction; all mutating paths (`createBooking`, `acceptHostBooking`, `rejectHostBooking`, `cancelBooking`, `createPaymentIntent`, `processGatewayWebhookInternal`, `adminTransitionRefund`, `issueCustodyPass`, `verifyCustodyPassForHost`, `completeCheckIn`, `completeCollection`, `sweepExpiredHolds`) acquire locks in strict non-decreasing hierarchy order.
   - `withSerializableOrDeadlockRetry` retries **only** PostgreSQL SQLSTATE `40P01` (deadlock detected) and `40001` (serialization failure) up to `maxRetries = 2` (3 attempts max) with jittered backoff (`15 * attempt + jitterMs`) on pure database transactions; external network/provider side effects are excluded from automatic retry loops.

---

## 7. Concurrency Test Design and Observed Results (Real PostgreSQL 16 + PostGIS 3.5)

Implemented in `apps/api/tests/phase-b-security-remediation.test.ts` against live PostgreSQL 16 + PostGIS 3.5 using `Promise.all` concurrent HTTP injections and DB transactions:

1. **B3 Concurrency Scenarios:**
   - Traveller cancellation racing `SUCCEEDED` PayHere webhook (verifies zero persistent `40P01` failures, mutually consistent terminal outcome: either `CANCELLED_BY_TRAVELLER` + late auto-refund or `CONFIRMED` + valid refund if cancellation serialized second, balanced ledger, single charge transaction).
   - Traveller cancellation racing `FAILED` PayHere webhook and host cancellation racing `SUCCEEDED` PayHere webhook.
   - 5x concurrent identical `SUCCEEDED` PayHere webhooks (`1` non-duplicate `BOOKING_CONFIRMED`, `4` deduplicated `duplicate: true`, `1` `payment_transactions` row, `1` capture ledger group).
   - Late `SUCCEEDED` PayHere webhook racing `quotationService.sweepExpiredHolds()` against an expired hold (no capacity resurrection; `ORPHANED_SUCCEEDED` + 100% auto-refund).
   - 4x concurrent `POST /api/v1/admin/refunds/:refundId/transition` (`SUCCEEDED`) + concurrent chargeback (`status_code=-3`) (`4/4` idempotent `200`, strictly `1` `REFUND` `payment_transactions` row, strictly `2` `REFUND` ledger groups: cancellation reclassification + single disbursement clearing `account_code = '1010'`).
   - 5x concurrent `POST /api/v1/bookings` against a `sharedPoolUnits: 2` pool requesting `BAG_LARGE` (`2` capacity units each): strictly `1` returns `201`, `4` return `409 Conflict`.
   - 4x concurrent `POST /api/v1/hosts/custody/:bookingId/check-in` with the same single-use 6-digit PIN: strictly `1` succeeds (`200`), `3` rejected (`401`/`409`), strictly `1` `bag_custody_items` row created.

2. **B4 `createPaymentIntent` Race & Idempotency Matrix Scenarios:**
   - Commits expired holds (`EXPIRED` + `RELEASED` capacity) against PostgreSQL `NOW()` *before* throwing `409` on expired bookings; rejects `REJECTED` / `CANCELLED` / `COMPLETED` / `CONFIRMED` states; validates idempotency key scoping (same user + same key returns identical intent, same user + different key reuses open active intent unless key conflict rules apply, different user + same key isolated).
   - Concurrent `POST /api/v1/payments/intents` racing traveller cancellation, host cancellation, 4x simultaneous requests with the same idempotency key (`4x 201` returning the same `intent.id`), 4x simultaneous requests with different keys, and intent creation racing a settled webhook (`CONFIRMED`).

3. **3x Consecutive Execution Stability Proof (Verified on Final Code Commit `933ecc4d`):**
   - Run 1 (`pnpm --filter @luggage-storage/api exec vitest run tests/phase-b-security-remediation.test.ts`): `1` file, `17/17` tests passed, duration `15.73s` (`tests 13.02s`), exit `0`.
   - Run 2 (same command immediately after): `1` file, `17/17` tests passed, duration `13.77s` (`tests 11.24s`), exit `0`.
   - Run 3 (same command immediately after): `1` file, `17/17` tests passed, duration `13.56s` (`tests 11.02s`), exit `0`.
   - Additional B9 refund concurrency race (`apps/api/tests/phase-b-refund-evidence.test.ts`): 5x concurrent `POST /api/v1/admin/refunds/:refundId/transition` (`SUCCEEDED`) executes atomically with strictly `1` `REFUND` `payment_transactions` row and `2` balanced `REFUND` ledger groups (`Group 1` cancellation reclassification + `Group 2` disbursement clearing), plus stale webhook replay and delayed `FAILED` (`-2`) immunity.

---

## 8. Payment, Refund Evidence, and Ledger Integrity Results (B5, B9)

- **Provider Attribution & No Synthetic Refund IDs (`B5`, `B9`):** `adminTransitionRefund(..., "SUCCEEDED")` resolves the booking's payment intent provider (`SANDBOX_GATEWAY` or `PAYHERE`) onto `payment_transactions` and never generates synthetic `rfnd_*` or `RFD-GW-*` identifiers.
- **Explicit Settlement Mode & Cryptographic Provenance (`B9`):**
  - `PROVIDER_CONFIRMED` requires a real gateway `providerRefundId` (`>= 3` chars, rejecting `manualReference`), sets `refund_records.settlement_mode = 'PROVIDER_CONFIRMED'`, sets `payment_transactions.evidence_source = 'ADMIN_PROVIDER_ATTESTED'`, and persists `signature_verified = false`.
  - `MANUAL_OFFLINE` requires a `manualReference` (`>= 3` chars, rejecting `providerRefundId`), sets `refund_records.settlement_mode = 'MANUAL_OFFLINE'`, sets `payment_transactions.evidence_source = 'ADMIN_MANUAL_OFFLINE'`, leaves `provider_transaction_id` `NULL`, and persists `signature_verified = false`.
  - Only cryptographically verified provider notifications persist `evidence_source = 'PROVIDER_WEBHOOK'` with `signature_verified = true` (sandbox simulator webhook sets `SANDBOX_SIMULATOR`).
- **Database Constraint, Uniqueness & Charge-Bound Enforcement (Migration `0014`):**
  - `refund_records` enforces `refund_records_settlement_mode_check`, `refund_records_succeeded_evidence_check`, and partial unique index `refund_records_provider_refund_unique_idx`.
  - `payment_transactions` enforces `payment_transactions_evidence_source_check`, `payment_transactions_sig_evidence_check`, `payment_transactions_provider_tx_presence_check`, `payment_transactions_admin_refund_only_check`, and `payment_transactions_refund_unique_idx`.
  - Application & DB reject duplicate `providerRefundId` across existing refunds or charges (`409 Conflict`), reject settling refunds beyond total captured `CHARGE` transactions (`409 Conflict`), and preserve idempotent retries (`200`) while rejecting conflicting `settlementMode`/`providerRefundId`/`manualReference` (`409`).
- **Failed Refund Recovery & Snapshotted Commission Rate (`B5`):** Verified `FAILED -> MANUAL_REVIEW_REQUIRED -> AUTHORIZED -> SUCCEEDED` plus idempotent retry on `SUCCEEDED` produces strictly `1` `REFUND` `payment_transactions` row. `cancelBooking` passes immutable `booking_pricing_snapshots.commissionRateBps` into `ledgerService.recordCancellationSettlement`; test `5.3` directly proves `commissionRateBps: 2000` on `retainedMinor = 50_000` computes `commissionMinor: 10_000` (`20%`) and `netPayableMinor: 40_000` with balanced debits/credits (`100_000 === 100_000`).
- **Monetary Bounds & Non-Escrow Accounting:** `ledgerService.postJournalGroup` rejects amounts `> PG_INT_MAX` (`2_147_483_648`), non-positive/unbalanced groups, and `recordCancellationSettlement` rejects `refundAmountMinor > paidAmountMinor` or negative amounts. Post-suite SQL query confirms `0` unbalanced transaction groups across all `financial_ledger_entries` rows (`SUM(DEBIT) = SUM(CREDIT) > 0`). All UI/code/doc copy uses honest non-escrow payment-clearing/payable liability terminology.

---

## 9. Clean-Install and Upgrade Migration Results & Schema Reconciliation

- **Clean Install (`0000` -> `0014` on Ephemeral PostgreSQL DB):** Executed in `apps/api/tests/phase-b-refund-evidence.test.ts` (`15` journal entries `0000`..`0014` applied cleanly on fresh DB with `43` `REQUIRED_PUBLIC_TABLES`) and `apps/api/tests/phase-b-booking-escrow-custody.test.ts` (`appliedClean >= 14`).
- **Upgrade `0011` -> `0014` & `0000 -> 0013 -> 0014` (Pre-Seeded Legacy State):** Executed in `apps/api/tests/phase-b-booking-escrow-custody.test.ts`, `apps/api/tests/phase-b-security-remediation.test.ts`, and `apps/api/tests/phase-b-refund-evidence.test.ts`, proving:
  - Completed `RELEASED_TO_TRAVELLER` `custody_records`, `bag_custody_items`, `custody_events`, and consumed `sha256-legacy-v1` tokens remain intact (`revoked_at IS NULL`).
  - Unconsumed `sha256-legacy-v1` tokens receive `revoked_at IS NOT NULL` and active non-terminal `custody_records` clear `checkin_pin_hash` / `collection_pin_hash`.
  - Duplicate active `payment_intents` supersede older rows (`EXPIRED`) and `payment_intents_single_active_per_booking_idx` enforces SQLSTATE `23505` on duplicate active inserts.
  - Upgrade `0013 -> 0014` preserves verified `CHARGE` rows as `evidence_source = 'PROVIDER_WEBHOOK'` (`signature_verified = true`) while converting legacy synthetic `rfnd_*`/`RFD-GW-*` refund rows to `settlement_mode = 'MANUAL_OFFLINE'`, `evidence_source = 'ADMIN_MANUAL_OFFLINE'`, and `signature_verified = false`.
- **Dev Database Verification (`pnpm db:migrate` / `pnpm --filter @luggage-storage/api db:migrate`):** Exit code `0`, `verifiedTables: 43` (`count: 0`, up to date).
- **Reconciled Database & Policy Inventory:**
  - `REQUIRED_PUBLIC_TABLES` (`apps/api/src/infrastructure/database/migrate.ts`) contains **`43` entries** (`42` domain/security tables + `__drizzle_migrations`), and PostgreSQL `public` schema totals **`44` tables** including PostGIS `spatial_ref_sys`.
  - Phase A database identity secrets live in `public.trusted_auth_secrets` with lifecycle columns `status` (`ACTIVE`/`RETIRING`/`REVOKED`), `retires_at`, and `updated_at` (not `db_identity_secrets` or `is_active`/`activated_at`/`retired_at`).
  - Migration `0012` adds `15` Phase B tables (`refund_records` is used alongside `security_audit_events`; there is no `refund_events` table).
  - Authoritative cancellation policy (`OQ-009`): `> 2 hours` before drop-off = `100%`, `<= 2 hours` = `50%`, post-drop-off = `0%`, host/platform cancellation = `100%`.

---

## 10. Exact Verification Commands and Exit Codes

All commands below were executed after the final code/migration/test edit on commit `933ecc4d629511d3b86d382311afaa13411140c5`:

| Command | Mode / Notes | Outcome | Exit Code |
| :--- | :--- | :--- | :--- |
| `pnpm install --frozen-lockfile` | All `7` workspace projects | Lockfile up to date | `0` |
| `pnpm --filter @luggage-storage/contracts build` | `$ tsc` | Clean | `0` |
| `pnpm --filter @luggage-storage/api db:migrate` | `luggage_migrator` on PostgreSQL 16 | `verifiedTables: 43` (`count: 0`, up to date) | `0` |
| `pnpm --filter @luggage-storage/api lint` | ESLint (`src` + `tests`) | `0` errors (`54` pre-existing warnings; `0` in B7/B8/B9 files) | `0` |
| `pnpm --filter @luggage-storage/api typecheck` | `tsc --noEmit` | Clean | `0` |
| `pnpm --filter @luggage-storage/web lint` | ESLint | `0` errors (`12` pre-existing warnings) | `0` |
| `pnpm --filter @luggage-storage/web typecheck` | `tsc --noEmit` | Clean | `0` |
| `pnpm --filter @luggage-storage/mobile lint` | `eslint app src tests` | `0` errors (`0` warnings) | `0` |
| `pnpm --filter @luggage-storage/mobile typecheck` | `tsc --noEmit` | Clean | `0` |
| `pnpm --filter @luggage-storage/api exec vitest run tests/phase-b-payhere-checkout.test.ts tests/phase-b-refund-evidence.test.ts` | Local PostgreSQL 16 + PostGIS 3.5 | `2` files, `9 passed (9)`, `14.93s` | `0` |
| `pnpm --filter @luggage-storage/api exec vitest run tests/phase-b-security-remediation.test.ts` *(Run 1)* | Local PostgreSQL 16 + PostGIS 3.5 | `17 passed (17)`, `15.73s` (`tests 13.02s`) | `0` |
| `pnpm --filter @luggage-storage/api exec vitest run tests/phase-b-security-remediation.test.ts` *(Run 2)* | Local PostgreSQL 16 + PostGIS 3.5 | `17 passed (17)`, `13.77s` (`tests 11.24s`) | `0` |
| `pnpm --filter @luggage-storage/api exec vitest run tests/phase-b-security-remediation.test.ts` *(Run 3)* | Local PostgreSQL 16 + PostGIS 3.5 | `17 passed (17)`, `13.56s` (`tests 11.02s`) | `0` |
| `pnpm verify` | `turbo run lint typecheck test build` | `16 successful, 16 total` (`1m53.428s`; API `15` files / `337` tests, `111.89s`) | `0` |
| `pnpm turbo run lint typecheck test build --force` | Uncached full monorepo gate | `16 successful, 16 total` (`0` cached, `1m59.328s`) | `0` |

---

## 11. Actual Test File Counts and Test Totals

From the latest uncached `pnpm turbo run lint typecheck test build --force` execution (`1m59.328s`, exit `0`):

| Workspace Package | Tasks Verified | Test Files | Tests Passed | Duration | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `@luggage-storage/contracts` | `lint`, `typecheck`, `test`, `build` | `11 passed (11)` | `81 passed (81)` | `1.92s` | `PASS` |
| `@luggage-storage/api` | `lint`, `typecheck`, `test`, `build` | `15 passed (15)` | `337 passed (337)` | `114.66s` | `PASS` |
| `@luggage-storage/web` | `lint`, `typecheck`, `test`, `build` | `11 passed (11)` | `121 passed (121)` | `7.77s` | `PASS` |
| `@luggage-storage/mobile` | `lint`, `typecheck`, `test`, `build` | `13 passed (13)` | `101 passed (101)` | `6.63s` | `PASS` |
| **Monorepo Total** | **`16 successful, 16 total`** | **`50 passed (50)`** | **`640 passed (640)`** | **`1m59.328s`** | **`PASS`** |

*(Test environment split: `@luggage-storage/api` executes real PostgreSQL 16 + PostGIS 3.5 HTTP & SQL integration/concurrency tests with `InMemoryStorageAdapter`; `@luggage-storage/contracts`, `@luggage-storage/web`, and `@luggage-storage/mobile` execute Vitest unit/UI tests.)*

---

## 12. GitHub Actions Workflow Evidence

- **Baseline Root-Cause Investigation:** Inspected baseline `CI Pipeline` run `43493038029` (on `main` commit `a9a6dafca9a894115c540dbdad7bced4e5f72173`): Steps `1`–`8` (`Install pnpm`, `Setup Node.js 26`, `pnpm install --frozen-lockfile`, `Build shared contracts`, `pnpm db:migrate`) succeeded, while Step `9` (`Execute Full Quality Gate (pnpm verify)`) failed because Turborepo `2.11.10` strict env filtering stripped workflow `DB_IDENTITY_SECRET`, `PAYOUT_ENCRYPTION_KEY`, etc. (`turbo.json` lacked `globalPassThroughEnv`).
- **CI Fixes Applied:** Added `CUSTODY_TOKEN_HMAC_SECRET` to `.github/workflows/ci.yml` and configured explicit `globalPassThroughEnv` (including PayHere checkout/callback keys) in `turbo.json` so `pnpm verify` forwards test/migration environment variables cleanly inside GitHub Actions runners.
- **Initial Remediation Push CI Run (`b92afb9315e14e13704328651a4ecb00758229d2`):**
  - **Run ID / URL:** `43511968537` — https://github.com/kavicastelo/luggage-storage/actions/runs/43511968537 (`status: completed`, `conclusion: success`)
- **Final Payment Acceptance Push CI Run (`933ecc4d629511d3b86d382311afaa13411140c5`):**
  - **Workflow / Job:** `CI Pipeline` (`.github/workflows/ci.yml`) — `Lint, Typecheck, Test & Build (Full Quality Gate)` (Job ID `132252669083`)
  - **Run ID:** `43532278588`
  - **Run URL:** https://github.com/kavicastelo/luggage-storage/actions/runs/43532278588
  - **Branch / Commit SHA:** `dev` / `933ecc4d629511d3b86d382311afaa13411140c5`
  - **Status / Conclusion:** `completed` / `success`
  - **Observed Job Steps (`1`–`21`):** `Set up job` (`success`), `Checkout repository` (`success`), `Start PostgreSQL/PostGIS database` (`success`), `Install pnpm` (`success`), `Setup Node.js` (`success`), `Install dependencies (frozen lockfile)` (`success`), `Build shared contracts` (`success`), `Apply PostgreSQL database migrations and verify schema` (`success`), `Execute Full Quality Gate (pnpm verify)` (`success`), `Stop PostgreSQL/PostGIS database` (`success`), and `Complete job` (`success`).

---

## 13. Remaining Owner-Managed Launch Requirements

The following operational, legal, and commercial steps are explicitly owned outside repository source code:

1. **Production Secret Provisioning:** Generate and inject unique, high-entropy (`>= 32` chars) KMS/vault secrets into production API/migrator environments — specifically `CUSTODY_TOKEN_HMAC_SECRET`, `DB_IDENTITY_SECRET`, `PAYOUT_ENCRYPTION_KEY`, `PAYMENT_WEBHOOK_SECRET`, `RATE_LIMIT_HASH_SECRET`, `JWT_SECRET`, and `COOKIE_SECRET`. Never reuse secrets across purposes or copy example values.
2. **PayHere Written Approval & Live Credentials (`OQ-003`):** Obtain formal PayHere marketplace/multi-party settlement approval, provision live merchant credentials (`PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET`, `PAYMENT_PROVIDER=payhere`, `PAYHERE_SANDBOX_MODE=false`) and production `https://` callback URLs (`PAYHERE_NOTIFY_URL`, `PAYHERE_RETURN_URL`, `PAYHERE_CANCEL_URL`), and perform live provider sandbox/production webhook & refund certification.
3. **Sri Lankan Tax & Regulatory Sign-Off (`OQ-010`):** Confirm VAT/SSCL applicability and invoicing compliance; pricing engine currently defaults `tax_rate_bps` to `0` pending sign-off.
4. **External Infrastructure Providers (`OQ-018`–`OQ-021`):** Provision managed R2 credentials, production SMTP/email (`Resend`/`Zoho`), SMS OTP delivery, and Redis/map credentials as required prior to production cutover.

---

## 14. Unresolved Issues Classified by Severity

| Severity | Category | Issue / Limitation | Status |
| :--- | :--- | :--- | :--- |
| **None (0)** | Code / Security / Concurrency | Unresolved source-code, migration, lock-order, or automated test defects in Phase B remediation or final payment acceptance scope. | Resolved (`0` open) |
| **High *(External Blocker)*** | Commercial / Provider (`OQ-003`) | Live PayHere merchant account credentials, written marketplace approval, and live end-to-end provider webhook/refund certification cannot be executed without owner credentials. | `PARTIAL` (External launch gate) |
| **Medium *(External Blocker)*** | Operations / Security | Production `CUSTODY_TOKEN_HMAC_SECRET` and sibling production secrets must be provisioned in deployment vaults prior to production boot. | Owner action required pre-launch |
| **Low *(Protocol Property)*** | PayHere Notification IDs | PayHere `notify_url` payloads lack a standalone provider event UUID, so `payhere_evt_*` is deterministically derived from verified canonical fields (`merchant_id`, `order_id`, `payment_id`, `status_code`, `payhere_amount`, `currency`, `md5sig`). | Documented protocol property |

---

## 15. Final Acceptance Assessment

| Acceptance Domain | Verdict | Basis |
| :--- | :--- | :--- |
| **B1: Custody HMAC & Migration `0013`** | **`PASS`** | Keyed domain-separated HMAC-SHA256 (`hmac-sha256-v2`), 32-byte `timingSafeEqual`, leading-zero PINs, uniform cross-endpoint rate limiting, fail-closed secret checks, safe `0012 -> 0013` revocation verified. |
| **B2: `PaymentGatewayPort` & PayHere Webhook Adapter** | **`PARTIAL`** | Code, isolated MD5 `hash`/`md5sig`, `/webhooks/payhere`, shared pipeline, Sandbox isolation, and protocol/attack scenarios `PASS`; live PayHere credentials, approval (`OQ-003`), and live certification remain owner-managed external dependencies. |
| **B3/B4: Global Lock Order & PG Concurrency** | **`PASS`** | Canonical 5-tier lock hierarchy, bounded `40P01`/`40001` retry, `createPaymentIntent` `FOR UPDATE` + DB `NOW()` hold expiry + `payment_intents_single_active_per_booking_idx` verified in 3/3 consecutive real PostgreSQL runs (`17/17` each). |
| **B5: Payment / Refund / Ledger Integrity** | **`PASS`** | Actual `SANDBOX_GATEWAY`/`PAYHERE` refund attribution, idempotent transitions, snapshotted `commissionRateBps`, `PG_INT_MAX` & `retainedMinor >= 0` guards, global `SUM(DEBIT) === SUM(CREDIT)`, non-escrow accounting verified. |
| **B6: Documentation & Verification Evidence** | **`PASS`** | Schema (`43` `REQUIRED_PUBLIC_TABLES` / `44` `public` tables, `public.trusted_auth_secrets`, migrations `0000`–`0014`), `OQ-009` 2h policy, and PayHere/CI evidence reconciled. Monorepo `--force` gate passed `16/16` tasks, `50` test files, `640` tests (`0` failed), and GitHub Actions `CI Pipeline` run `43532278588` (`933ecc4d629511d3b86d382311afaa13411140c5`) completed with `conclusion: success`. |
| **B7: Complete PayHere Checkout Payload & Server Handoff** | **`PARTIAL`** | 16+2 PayHere checkout form fields, fail-closed `PAYHERE_NOTIFY_URL`/`RETURN_URL`/`CANCEL_URL` validation, billing resolution, `/payments/handoff/:handoffToken` (`routerOptions.maxParamLength: 512`), `/payments/checkout-status`, and `403` sandbox simulation guard `PASS`; live PayHere credentials & written approval (`OQ-003`) remain external launch gates. |
| **B8: Web & Mobile Real Provider-Aware Handoff & Custody Gate** | **`PASS`** | Web hidden POST form to verified PayHere origin, forged URL query claim immunity, Mobile external browser bridge + `AppState` resume polling + duplicate-submit lock, and strict `CONFIRMED`/`IN_STORAGE` custody gating verified across Web (`11` files / `121` tests) and Mobile (`13` files / `101` tests). |
| **B9: Refund Evidence Integrity & Migration `0014`** | **`PASS`** | Removal of synthetic `rfnd_*`/`RFD-GW-*` IDs, explicit `PROVIDER_CONFIRMED` vs `MANUAL_OFFLINE` evidence (`signature_verified = false`), migration `0014` `CHECK` constraints & partial unique indexes, `409` duplicate reference & charge-bound guards, 5x concurrency race, stale webhook immunity, and clean/upgrade `0014` migrations verified (`tests/phase-b-refund-evidence.test.ts`). |
| **Commercial Production Launch Readiness** | **`PARTIAL`** | Repository software passes technical Phase B acceptance; live launch remains gated on external PayHere approval/credentials (`OQ-003`), owner secret provisioning, and tax sign-off (`OQ-010`). |

