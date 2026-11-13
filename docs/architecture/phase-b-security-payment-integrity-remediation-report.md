# Phase B Security, Payment Integrity & Final Acceptance Remediation Report

**Project:** Global Luggage Storage Marketplace  
**Target Branch:** `dev`  
**Stage:** Phase B Security, Payment Integrity & Final Acceptance Remediation  
**Database Engine:** PostgreSQL 16 + PostGIS 3.5  
**Launch Market / Currency:** Sri Lanka (`LKR`, ISO 4217 exponent `2`)

---

## 1. Baseline Commit and Final Remediation Commit SHA

- **Baseline Merge Commit (Starting Point):** `a9a6dafca9a894115c540dbdad7bced4e5f72173`
- **Phase A Security Closure Commit (Preserved in Ancestry):** `015b9d18a5cae68611aefb9134ad5a8e6b05d735` (`git merge-base --is-ancestor` verified exit code `0`)
- **Remediation Implementation Commit SHA:** *Pending commit & push on `dev` — to be recorded with matching CI run ID upon live GitHub Actions completion.*
- **Final Report Update Commit SHA (`HEAD`):** *Pending CI completion.*

---

## 2. Original Findings and Resolutions (B1–B6)

| ID | Priority | Original Audit Finding | Resolution Implemented | Status |
| :--- | :--- | :--- | :--- | :--- |
| **B1** | Critical | Custody helper used unkeyed `SHA-256`, allowing database-only offline guessing of 6-digit PINs; documentation inaccurately claimed keyed HMAC-SHA256. | Introduced `CUSTODY_TOKEN_HMAC_SECRET` (>= 32 chars, fail-closed startup, production placeholder rejection, separation from `DB_IDENTITY_SECRET`, `DB_IDENTITY_RETIRING_SECRET`, `PAYMENT_WEBHOOK_SECRET`, `RATE_LIMIT_HASH_SECRET`); implemented domain-separated keyed HMAC-SHA256 (`hmac-sha256-v2`) with 32-byte `crypto.timingSafeEqual`, leading-zero 6-digit PINs, uniform actor/booking rate limiting across `/verify`, `/check-in`, and `/check-out`, and forward-only migration `0013` revoking unconsumed legacy `sha256-legacy-v1` tokens while preserving completed history. | `PASS` |
| **B2** | Critical | `PaymentGatewayPort` lacked provider-neutral webhook verification/normalization; webhook handling only served `/webhooks/sandbox`, leaving PayHere notification processing and provider isolation unimplemented. | Extended `PaymentGatewayPort` with `verifyNotificationSignature`, `normalizeVerifiedNotification`, `verifyAndNormalizeNotification`, and `extractNotificationIdentifiers`; implemented `PayHereGatewayAdapter` (`POST /api/v1/payments/webhooks/payhere`, 64 KB body limit returning `413`, duplicate form-key HPP rejection, isolated MD5 `hash`/`md5sig`, integer minor-unit decimal parsing, deterministic `payhere_evt_*` IDs); enforced cross-provider isolation (`409`), production block on `SandboxSignedGatewayAdapter` (`403`), and shared settlement via `processGatewayWebhookInternal`. Commercial live PayHere launch remains gated on external approval & credentials (`OQ-003`). | `PARTIAL` *(Code & tests `PASS`; live PayHere credentials & written approval remain external owner-managed dependencies)* |
| **B3** | High | Webhook path locked `payment_intents` before `bookings` while cancellation locked `bookings` first, creating PostgreSQL deadlock exposure. | Standardized one global 5-tier lock order (`storage_capacity_pools` -> `bookings` -> `payment_intents` -> `refund_records`/`custody_records`/`custody_tokens` -> `host_payables`/append-only inserts) across all Phase B mutations; added bounded `withSerializableOrDeadlockRetry` (`40P01`/`40001`, up to 2 retries / 3 total attempts) strictly around pure DB transactions; verified with real PostgreSQL concurrency races in 3 consecutive runs. | `PASS` |
| **B4** | High | `createPaymentIntent()` read `bookings` without `FOR UPDATE`, allowing a concurrent cancellation to commit while a new pending payment intent still committed. | `createPaymentIntent()` now locks `bookings FOR UPDATE` first, evaluates hold expiry against PostgreSQL `NOW()` (committing `EXPIRED_HOLD` before throwing `409`), validates ownership, status, and `booking_pricing_snapshots`, locks `payment_intents ORDER BY id ASC FOR UPDATE`, enforces the full idempotency matrix, and backs uniqueness in PostgreSQL via partial unique index `payment_intents_single_active_per_booking_idx`. | `PASS` |
| **B5** | High | Refund `payment_transactions` hardcoded provider attribution, refund state transitions needed idempotency hardening, and cancellation settlements hardcoded commission bps. | `adminTransitionRefund` now resolves the booking payment intent's actual `provider` (`SANDBOX_GATEWAY` or `PAYHERE`), supports idempotent retries on matching target state, uses snapshotted `commissionRateBps` (`booking_pricing_snapshots.commission_rate_bps`) during cancellation settlements, enforces `PG_INT_MAX` (`2_147_483_647`) and `0 <= refundAmountMinor <= paidAmountMinor` guards, and maintains global `SUM(DEBIT) === SUM(CREDIT)` without escrow claims. | `PASS` |
| **B6** | Medium | Documentation contained stale schema/policy descriptions (`db_identity_secrets`, `is_active`/`activated_at`/`retired_at`, `refund_events`, 24h cancellation window, SHA-256 custody claim, table-count confusion, CI claims). | Reconciled `docs/architecture/backend-domain-overview.md`, `docs/product/assumptions-and-open-questions.md`, UI/mock copy, `.env*.example` & `.envs/*.example` templates, and `turbo.json` (`globalPassThroughEnv`); authored this 15-section evidence report distinguishing local runs, PostgreSQL integration tests, GitHub Actions CI, and owner launch gates. | `PASS` *(Pending post-push live GitHub Actions workflow completion update in Section 12)* |

---

## 3. Files Changed and Migration Numbers

### 3.1 Forward-Only Migrations Preserved and Added

- **Preserved Untouched:** Migrations `0000` through `0012` remain completely unmodified.
- **Added Migration (`0013`):**
  - `apps/api/src/infrastructure/database/migrations/0013_phase_b_custody_hmac_and_payment_integrity.sql`
  - `apps/api/src/infrastructure/database/migrations/meta/0013_snapshot.json`
  - `apps/api/src/infrastructure/database/migrations/meta/_journal.json` (14 total entries: indices `0`..`13`)

### 3.2 Modified Files (`git status` Prior to Commit)

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
  - `.env.example`
  - `apps/api/.env.example`
  - `.envs/README.md`
  - `.envs/root.example`
  - `.envs/api.example`
  - `.envs/development.example`
  - `.envs/test.example`
  - `.envs/production.example`
  - `.github/workflows/ci.yml`
  - `turbo.json`
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

## 5. PayHere Notification Verification Design and External Launch Requirements (B2)

1. **`PaymentGatewayPort` Contract (`apps/api/src/modules/payments/payment-gateway.port.ts`):**
   - Exposes `buildCheckoutPayload`, `verifyNotificationSignature`, `normalizeVerifiedNotification`, `verifyAndNormalizeNotification`, and `extractNotificationIdentifiers`, returning normalized fields: `provider`, `providerEventId`, `eventIdDerived`, `providerOrderId`, `merchantId`, `paymentIntentId`, `status` (`SUCCEEDED | PENDING | FAILED | CANCELLED | CHARGEDBACK`), `rawStatusCode`, `amountMinor`, `currency`, `providerTransactionId`, `failureReason`, and `metadata`.

2. **`PayHereGatewayAdapter` & Route Hardening (`POST /api/v1/payments/webhooks/payhere`):**
   - Route `apps/api/src/modules/payments/payments.routes.ts` sets `bodyLimit: 65_536` (64 KB; `apps/api/src/common/middleware/error-handler.ts` preserves Fastify 4xx `413` responses as `BAD_REQUEST` instead of `500`), accepts `application/x-www-form-urlencoded` (custom raw duplicate-parameter scanner rejects HTTP Parameter Pollution duplicate keys before decoding) and strict flat `application/json`.
   - Isolates official PayHere protocol MD5 computation inside private `payHereMd5Upper` (`crypto.createHash("md5")`) methods — source sweep across `apps/*/src` and `packages/*/src` confirms `md5` appears **only** in `payment-gateway.port.ts`.
   - Verifies checkout `hash = MD5(merchant_id + order_id + amount + currency + MD5(merchant_secret).toUpperCase()).toUpperCase()` and webhook `md5sig = MD5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + MD5(merchant_secret).toUpperCase()).toUpperCase()` using fixed 32-hex validation and `crypto.timingSafeEqual`.
   - Verifies configured `merchant_id`, parses decimal amounts using pure integer string arithmetic (`parsePayHereDecimalAmountToMinor`, rejecting scientific notation, overflow, malformed decimals, or exponent mismatches), and maps `status_code`: `2 -> SUCCEEDED`, `0 -> PENDING`, `-1 -> CANCELLED`, `-2 -> FAILED`, `-3 -> CHARGEDBACK`.
   - Derives deterministic deduplication key `payhere_evt_<sha256[0:48]>` from canonical `[merchant_id, order_id, payment_id, status_code, payhere_amount, currency, md5sigLower]`.
   - **Documented Limitation of Derived Event ID:** Because PayHere `notify_url` payloads do not include a separate opaque gateway webhook event UUID, identical re-deliveries compute the same `payhere_evt_*` ID (replayed safely as `duplicate: true`), while distinct state transitions (`0` -> `2` -> `-3`) carry distinct `status_code` values and produce distinct `payhere_evt_*` IDs handled idempotently by the state machine.

3. **Sandbox Isolation & Shared Settlement Pipeline (`payments.service.ts`):**
   - `SandboxSignedGatewayAdapter` throws `403` when `nodeEnv === "production"` across `verifyNotificationSignature`, `normalizeVerifiedNotification`, `verifyAndNormalizeNotification`, and `EnvSchema` blocks `PAYMENT_PROVIDER=sandbox` in `production`.
   - Both `/webhooks/sandbox` and `/webhooks/payhere` execute signature/field verification **before** entering the transaction and locking rows, then delegate to the single shared `processGatewayWebhookInternal` pipeline, which enforces matching `provider` (`409` on cross-provider attempt), matching `paymentIntentId` (`custom_1` `409`), immutable pricing snapshot amount/currency matching (`400`), `(provider, provider_transaction_id)` cross-intent uniqueness (`409`), late capture handling (`ORPHANED_SUCCEEDED` + balanced capture + 100% `LATE_WEBHOOK_EXPIRED_HOLD` refund without capacity revival), chargeback review flagging (`DISPUTED` + `host_payables` `ON_HOLD`), and out-of-order lower-precedence protection (`ALREADY_SETTLED_NOOP`).

4. **Distinction From Unmet External Dependencies (`OQ-003`):**
   - Protocol-accurate PayHere adapter code and fixture tests do **not** constitute live provider certification. Commercial PayHere activation still requires written PayHere marketplace settlement approval, live merchant credentials (`PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET`, `PAYHERE_SANDBOX_MODE=false`), and live sandbox/production webhook & refund certification.

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

3. **3x Consecutive Execution Stability Proof:**
   - Run 1 (`pnpm --filter @luggage-storage/api exec vitest run tests/phase-b-security-remediation.test.ts`): `1` file, `17/17` tests passed, duration `13.15s`, exit `0`.
   - Run 2 (same command immediately after): `1` file, `17/17` tests passed, duration `13.13s`, exit `0`.
   - Run 3 (same command immediately after): `1` file, `17/17` tests passed, duration `13.09s`, exit `0`.

---

## 8. Payment, Refund, and Ledger Integrity Results (B5)

- **Provider Attribution on Refunds:** `adminTransitionRefund(..., "SUCCEEDED")` resolves the booking's payment intent provider (`SANDBOX_GATEWAY` or `PAYHERE`) onto the recorded `REFUND` `payment_transactions` row (`test 5.1` asserts `provider === "PAYHERE"`).
- **Failed Refund Recovery & Idempotency:** Verified `FAILED -> MANUAL_REVIEW_REQUIRED -> AUTHORIZED -> SUCCEEDED` plus idempotent retry on `SUCCEEDED` produces strictly `1` `REFUND` `payment_transactions` row and `1` disbursement journal group.
- **Snapshotted Commission Rate (`commission_rate_bps`):** `cancelBooking` passes the booking's immutable `booking_pricing_snapshots.commissionRateBps` into `ledgerService.recordCancellationSettlement`; test `5.3` directly proves `commissionRateBps: 2000` on `retainedMinor = 50_000` computes `commissionMinor: 10_000` (`20%`) and `netPayableMinor: 40_000` with balanced debits/credits (`100_000 === 100_000`).
- **Monetary Bounds & Non-Escrow Accounting:** `ledgerService.postJournalGroup` rejects amounts `> PG_INT_MAX` (`2_147_483_648`), non-positive/unbalanced groups, and `recordCancellationSettlement` rejects `refundAmountMinor > paidAmountMinor` or negative amounts. Post-suite SQL query confirms `0` unbalanced transaction groups across all `financial_ledger_entries` rows (`SUM(DEBIT) = SUM(CREDIT) > 0`). All UI/code/doc copy uses honest non-escrow payment-clearing/payable liability terminology.

---

## 9. Clean-Install and Upgrade Migration Results & Schema Reconciliation

- **Clean Install (`0000` -> `0013` on Ephemeral PostgreSQL DB):** Executed in `apps/api/tests/phase-b-booking-escrow-custody.test.ts` (`appliedClean >= 14`, all 14 migrations applied cleanly without error, schema verification passed).
- **Upgrade `0011` -> `0013`:** Executed in `apps/api/tests/phase-b-booking-escrow-custody.test.ts` (`upgradedCount === 2`).
- **Upgrade `0012` -> `0013` (Pre-Seeded Legacy State):** Executed in `apps/api/tests/phase-b-security-remediation.test.ts` (`upgradedCount === 1`), proving:
  - Completed `RELEASED_TO_TRAVELLER` `custody_records`, `bag_custody_items`, `custody_events`, and consumed `sha256-legacy-v1` tokens remain intact (`revoked_at IS NULL`).
  - Unconsumed `sha256-legacy-v1` tokens receive `revoked_at IS NOT NULL` and active non-terminal `custody_records` clear `checkin_pin_hash` / `collection_pin_hash`.
  - Duplicate active `payment_intents` supersede older rows (`EXPIRED`) and `payment_intents_single_active_per_booking_idx` enforces SQLSTATE `23505` on duplicate active inserts.
- **Dev Database Verification (`pnpm db:migrate`):** Exit code `0`, `verifiedTables: 43`.
- **Reconciled Database & Policy Inventory:**
  - `REQUIRED_PUBLIC_TABLES` (`apps/api/src/infrastructure/database/migrate.ts`) contains **`43` entries** (`42` domain/security tables + `__drizzle_migrations`), and PostgreSQL `public` schema totals **`44` tables** including PostGIS `spatial_ref_sys`.
  - Phase A database identity secrets live in `public.trusted_auth_secrets` with lifecycle columns `status` (`ACTIVE`/`RETIRING`/`REVOKED`), `retires_at`, and `updated_at` (not `db_identity_secrets` or `is_active`/`activated_at`/`retired_at`).
  - Migration `0012` adds `15` Phase B tables (`refund_records` is used alongside `security_audit_events`; there is no `refund_events` table).
  - Authoritative cancellation policy (`OQ-009`): `> 2 hours` before drop-off = `100%`, `<= 2 hours` = `50%`, post-drop-off = `0%`, host/platform cancellation = `100%`.

---

## 10. Exact Verification Commands and Exit Codes

All commands below were executed on the final repository source state prior to commit:

| Command | Mode / Notes | Outcome | Exit Code |
| :--- | :--- | :--- | :--- |
| `pnpm --filter @luggage-storage/api exec vitest run tests/phase-b-security-remediation.test.ts` *(Run 1)* | Local PostgreSQL 16 + PostGIS 3.5 | `17 passed (17)`, `13.15s` | `0` |
| `pnpm --filter @luggage-storage/api exec vitest run tests/phase-b-security-remediation.test.ts` *(Run 2)* | Local PostgreSQL 16 + PostGIS 3.5 | `17 passed (17)`, `13.13s` | `0` |
| `pnpm --filter @luggage-storage/api exec vitest run tests/phase-b-security-remediation.test.ts` *(Run 3)* | Local PostgreSQL 16 + PostGIS 3.5 | `17 passed (17)`, `13.09s` | `0` |
| `pnpm --filter @luggage-storage/api lint` | ESLint (`src` + `tests`) | `0` errors (`54` pre-existing warnings; `0` in Phase B files) | `0` |
| `pnpm --filter @luggage-storage/api typecheck` | `tsc --noEmit` | Clean | `0` |
| `pnpm install --frozen-lockfile` | All `7` workspace projects | Lockfile up to date | `0` |
| `pnpm db:migrate` | `luggage_migrator` on PostgreSQL 16 | `verifiedTables: 43` (`count: 0`, up to date) | `0` |
| `pnpm verify` | `turbo run lint typecheck test build` | `16 successful, 16 total` (`1m41.963s`) | `0` |
| `pnpm turbo run lint typecheck test build --force` | Uncached full monorepo gate | `16 successful, 16 total` (`0` cached, `1m47.817s`) | `0` |

---

## 11. Actual Test File Counts and Test Totals

From the latest uncached `pnpm turbo run lint typecheck test build --force` execution:

| Workspace Package | Tasks Verified | Test Files | Tests Passed | Duration | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `@luggage-storage/contracts` | `lint`, `typecheck`, `test`, `build` | `11 passed (11)` | `81 passed (81)` | `1.84s` | `PASS` |
| `@luggage-storage/api` | `lint`, `typecheck`, `test`, `build` | `13 passed (13)` | `328 passed (328)` | `102.93s` | `PASS` |
| `@luggage-storage/web` | `lint`, `typecheck`, `test`, `build` | `10 passed (10)` | `114 passed (114)` | `4.51s` | `PASS` |
| `@luggage-storage/mobile` | `lint`, `typecheck`, `test`, `build` | `12 passed (12)` | `98 passed (98)` | `4.42s` | `PASS` |
| **Monorepo Total** | **`16 successful, 16 total`** | **`46 passed (46)`** | **`621 passed (621)`** | **`1m47.817s`** | **`PASS`** |

*(Test environment split: `@luggage-storage/api` executes real PostgreSQL 16 + PostGIS 3.5 HTTP & SQL integration/concurrency tests with `InMemoryStorageAdapter`; `@luggage-storage/contracts`, `@luggage-storage/web`, and `@luggage-storage/mobile` execute Vitest unit/UI tests.)*

---

## 12. GitHub Actions Workflow Evidence

- **Baseline Root-Cause Investigation:** Inspected baseline `CI Pipeline` run `43493038029` (on `main` commit `a9a6dafca9a894115c540dbdad7bced4e5f72173`): Steps `1`–`8` (`Install pnpm`, `Setup Node.js 26`, `pnpm install --frozen-lockfile`, `Build shared contracts`, `pnpm db:migrate`) succeeded, while Step `9` (`Execute Full Quality Gate (pnpm verify)`) failed because Turborepo `2.11.10` strict env filtering stripped workflow `DB_IDENTITY_SECRET`, `PAYOUT_ENCRYPTION_KEY`, etc. (`turbo.json` lacked `globalPassThroughEnv`).
- **CI Fixes Applied:** Added `CUSTODY_TOKEN_HMAC_SECRET` to `.github/workflows/ci.yml` and configured explicit `globalPassThroughEnv` in `turbo.json` so `pnpm verify` forwards test/migration environment variables cleanly inside GitHub Actions runners.
- **Remediation Push CI Run Status:** *Pending git commit & push to `origin/dev` — workflow run ID, URL, and `conclusion` will be appended immediately after live CI completion.*

---

## 13. Remaining Owner-Managed Launch Requirements

The following operational, legal, and commercial steps are explicitly owned outside repository source code:

1. **Production Secret Provisioning:** Generate and inject unique, high-entropy (`>= 32` chars) KMS/vault secrets into production API/migrator environments — specifically `CUSTODY_TOKEN_HMAC_SECRET`, `DB_IDENTITY_SECRET`, `PAYOUT_ENCRYPTION_KEY`, `PAYMENT_WEBHOOK_SECRET`, `RATE_LIMIT_HASH_SECRET`, `JWT_SECRET`, and `COOKIE_SECRET`. Never reuse secrets across purposes or copy example values.
2. **PayHere Written Approval & Live Credentials (`OQ-003`):** Obtain formal PayHere marketplace/multi-party settlement approval, provision live merchant credentials (`PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET`, `PAYMENT_PROVIDER=payhere`, `PAYHERE_SANDBOX_MODE=false`), and perform live provider sandbox/production webhook & refund certification.
3. **Sri Lankan Tax & Regulatory Sign-Off (`OQ-010`):** Confirm VAT/SSCL applicability and invoicing compliance; pricing engine currently defaults `tax_rate_bps` to `0` pending sign-off.
4. **External Infrastructure Providers (`OQ-018`–`OQ-021`):** Provision managed R2 credentials, production SMTP/email (`Resend`/`Zoho`), SMS OTP delivery, and Redis/map credentials as required prior to production cutover.

---

## 14. Unresolved Issues Classified by Severity

| Severity | Category | Issue / Limitation | Status |
| :--- | :--- | :--- | :--- |
| **None (0)** | Code / Security / Concurrency | Unresolved source-code, migration, lock-order, or automated test defects in Phase B remediation scope. | Resolved (`0` open) |
| **High *(External Blocker)*** | Commercial / Provider (`OQ-003`) | Live PayHere merchant account credentials, written marketplace approval, and live end-to-end provider webhook/refund certification cannot be executed without owner credentials. | `PARTIAL` (External launch gate) |
| **Medium *(External Blocker)*** | Operations / Security | Production `CUSTODY_TOKEN_HMAC_SECRET` and sibling production secrets must be provisioned in deployment vaults prior to production boot. | Owner action required pre-launch |
| **Low *(Protocol Property)*** | PayHere Notification IDs | PayHere `notify_url` payloads lack a standalone provider event UUID, so `payhere_evt_*` is deterministically derived from verified canonical fields (`merchant_id`, `order_id`, `payment_id`, `status_code`, `payhere_amount`, `currency`, `md5sig`). | Documented protocol property |

---

## 15. Final Acceptance Assessment

| Acceptance Domain | Verdict | Basis |
| :--- | :--- | :--- |
| **B1: Custody HMAC & Migration `0013`** | **`PASS`** | Keyed domain-separated HMAC-SHA256 (`hmac-sha256-v2`), 32-byte `timingSafeEqual`, leading-zero PINs, uniform cross-endpoint rate limiting, fail-closed secret checks, safe `0012 -> 0013` revocation verified. |
| **B2: `PaymentGatewayPort` & PayHere Adapter** | **`PARTIAL`** | Code, isolated MD5 `hash`/`md5sig`, `/webhooks/payhere`, shared pipeline, Sandbox isolation, and 16+ protocol/attack scenarios `PASS`; live PayHere credentials, approval (`OQ-003`), and live certification remain owner-managed external dependencies. |
| **B3/B4: Global Lock Order & PG Concurrency** | **`PASS`** | Canonical 5-tier lock hierarchy, bounded `40P01`/`40001` retry, `createPaymentIntent` `FOR UPDATE` + DB `NOW()` hold expiry + `payment_intents_single_active_per_booking_idx` verified in 3/3 consecutive real PostgreSQL runs (`17/17` each). |
| **B5: Payment / Refund / Ledger Integrity** | **`PASS`** | Actual `SANDBOX_GATEWAY`/`PAYHERE` refund attribution, idempotent transitions, snapshotted `commissionRateBps`, `PG_INT_MAX` & `retainedMinor >= 0` guards, global `SUM(DEBIT) === SUM(CREDIT)`, non-escrow accounting verified. |
| **B6: Documentation & Verification Evidence** | **`PASS`** *(CI pending push)* | Schema (`43` `REQUIRED_PUBLIC_TABLES` / `44` `public` tables, `public.trusted_auth_secrets`), `OQ-009` 2h policy, honest PayHere/CI distinctions reconciled. Monorepo `--force` gate passed `16/16` tasks, `46` test files, `621` tests (`0` failed). |
| **Commercial Production Launch Readiness** | **`PARTIAL`** | Repository software passes technical Phase B acceptance; live launch remains gated on external PayHere approval/credentials (`OQ-003`), owner secret provisioning, and tax sign-off (`OQ-010`). |
