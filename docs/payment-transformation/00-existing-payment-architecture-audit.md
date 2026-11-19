# Existing Payment Architecture Audit

**Project:** Luggage Storage Marketplace (`kavicastelo/luggage-storage`)  
**Document:** `docs/payment-transformation/00-existing-payment-architecture-audit.md`  
**Initiative:** Payment Infrastructure Transformation (PayHere Removal, Stripe Primary & PayPal Alternative)  
**Date:** 2026-11-19  
**Status:** Baseline Completed — Pre-Modification State Captured  

---

## 1. Executive Summary

This audit establishes the comprehensive technical baseline of the payment infrastructure within the repository prior to the payment transformation.

The marketplace currently implements a payment subsystem designed around **PayHere** (Sri Lanka domestic gateway) alongside a local development **Sandbox Gateway Simulator**. The existing payment domain is partially provider-abstracted through `PaymentGatewayPort`, but is tightly bound to PayHere-specific structures:
- PayHere-specific MD5 hash signatures (`merchant_id + order_id + amount + currency + md5(secret)`).
- Web checkout via direct browser HTML form submission to PayHere endpoints.
- Mobile checkout via `@payhere/payhere-mobilesdk-reactnative` native SDK.
- Single-currency focus (`LKR`) with 3-character ISO strings.
- PayHere webhook notification parsing (`application/x-www-form-urlencoded`).
- Database check constraints restricting `provider` strictly to `'SANDBOX_GATEWAY'` and `'PAYHERE'`.

The database, ledger, booking state machine, and custody security controls are robust and strictly disciplined:
- Append-only double-entry financial ledger (`financial_ledger_entries`) with zero-sum debits/credits enforcement.
- Row-level lock ordering on bookings and payment intents (`SELECT ... FOR UPDATE`).
- Gated custody release: custody tokens and QR codes are cryptographically inaccessible until server-confirmed payment webhook settlement.
- Comprehensive 7-stage refund lifecycle (`refund_records`).

This audit details all 14 mandated aspects of the existing payment architecture to ensure zero regressions, data preservation, and a clean transformation to Stripe and PayPal.

---

## 2. Existing Payment Architecture

The payment architecture spans five layers across the monorepo:

```text
┌────────────────────────────────────────────────────────┐
│                   Client Applications                  │
│   Web (React/Vite)              Mobile (Expo / React Native)
│   apps/web/src/features/        apps/mobile/app/(traveller)/
│   traveller/CheckoutSchedule    checkout.tsx
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP REST
┌──────────────────────────▼─────────────────────────────┐
│                 Fastify Payment Routes                 │
│         apps/api/src/modules/payments/payments.routes.ts
│   POST /intents                                        │
│   GET  /checkout-status                                │
│   POST /webhooks/payhere                               │
│   POST /webhooks/sandbox                               │
│   GET  /handoff/:handoffToken (410 Retired)            │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│                Payments Service Layer                  │
│       apps/api/src/modules/payments/payments.service.ts │
│   - createPaymentIntent()                              │
│   - getCheckoutStatus()                                │
│   - processPayHereWebhook()                            │
│   - processSandboxWebhook()                            │
│   - processGatewayWebhookInternal()                    │
│   - adminTransitionRefund()                            │
└─────────────┬───────────────────────────┬──────────────┘
              │                           │
┌─────────────▼───────────────┐ ┌─────────▼──────────────┐
│     Payment Gateway Port    │ │   Financial Ledger     │
│ payment-gateway.port.ts     │ │ ledger.service.ts      │
│ - PaymentGatewayPort        │ │ - recordPaymentCaptured│
│ - PayHereGatewayAdapter     │ │ - recordBookingCompleted│
│ - SandboxSignedAdapter      │ │ - recordRefundDisbursed│
└─────────────┬───────────────┘ └─────────┬──────────────┘
              │                           │
┌─────────────▼───────────────────────────▼──────────────┐
│            PostgreSQL 16 + PostGIS Database            │
│   schema/payments.ts: payment_intents,                 │
│                       payment_transactions,            │
│                       payment_webhook_events,          │
│                       refund_records                   │
│   schema/finance.ts:  financial_ledger_entries,        │
│                       host_payables                    │
└────────────────────────────────────────────────────────┘
```

### Core Architecture Components:
1. **Contract Definitions (`packages/contracts/src/payments/index.ts`):**
   - `PAYMENT_PROVIDERS`: `["SANDBOX_GATEWAY", "PAYHERE"]`
   - `PAYMENT_INTENT_STATUSES`: `["INITIATED", "PENDING_GATEWAY", "SUCCEEDED", "FAILED", "EXPIRED", "ORPHANED_SUCCEEDED"]`
   - `PAYMENT_CHECKOUT_CHANNELS`: `["WEB", "MOBILE_APP"]`
   - `PAYMENT_NEXT_ACTIONS`: `["SANDBOX_SIMULATION", "REDIRECT_TO_PROVIDER", "LAUNCH_NATIVE_SDK"]`
   - `PaymentCheckoutHandoffSchema`: Discriminated union on `method` (`"SIMULATED_API"`, `"POST_FORM"`, `"NATIVE_SDK"`, `"EXPIRED"`).

2. **Gateway Port (`apps/api/src/modules/payments/payment-gateway.port.ts`):**
   - `PaymentGatewayPort`: Interface providing:
     - `buildCheckoutPayload(params: CreateGatewayCheckoutParams): Record<string, unknown>`
     - `verifyNotificationSignature(input: RawWebhookNotificationInput): void`
     - `normalizeVerifiedNotification(input: RawWebhookNotificationInput): NormalizedGatewayNotification`
     - `verifyAndNormalizeNotification(input: RawWebhookNotificationInput): NormalizedGatewayNotification`
     - `extractNotificationIdentifiers(input: RawWebhookNotificationInput): NotificationIdentifiers`
   - `PayHereGatewayAdapter`: Implements PayHere Checkout API MD5 calculation, payload generation, notification verification, and status mapping.
   - `SandboxSignedGatewayAdapter`: HMAC-SHA256 development mock gateway.

3. **Service Layer (`apps/api/src/modules/payments/payments.service.ts`):**
   - Manages intent creation, channel resolution (`WEB` vs `MOBILE_APP`), database transactions, webhook verification, idempotent settlement, and refund transitions.

---

## 3. Existing Payment Lifecycle

```text
[Traveller]
     │
     │ 1. POST /api/v1/bookings (Create booking in PENDING_PAYMENT)
     │ 2. Capacity reserved (HELD_FOR_PAYMENT, 15 min TTL)
     ▼
[Booking Service]
     │
     │ 3. POST /api/v1/payments/intents (bookingId, channel, customerDetails)
     ▼
[Payments Service]
     │
     ├─► Validates booking ownership, state == PENDING_PAYMENT
     ├─► Checks existing active intent for booking (idempotency)
     ├─► Calls resolvePaymentGatewayAdapter(channel)
     ├─► Adapter builds provider payload + hash (PayHere MD5 or Native SDK payload)
     ├─► Persists payment_intents record (status: INITIATED)
     ▼
[Client Application]
     │
     ├─► Web: Submits hidden HTML form POST to https://sandbox.payhere.lk/pay/checkout
     ├─► Mobile: Invokes PayHere.startPayment(sdkPayload)
     ▼
[PayHere Payment Processing]
     │
     ├─► Customer pays on gateway
     ├─► Browser / App redirects to return_url (navigation hint only)
     ▼
[PayHere Server] ──(Asynchronous HTTP POST)──► [API Server /webhooks/payhere]
                                                      │
     ┌────────────────────────────────────────────────┘
     │
     ▼
[Webhook Handler: processPayHereWebhook]
     │
     ├─► Raw body parsed as string (preserves exact byte representation)
     ├─► Minimum untrusted lookup identifiers extracted (order_id, custom_1)
     ├─► Stored intent loaded from DB to resolve checkoutChannel (WEB vs MOBILE_APP)
     ├─► Matching channel secret selected (PAYHERE_WEB_MERCHANT_SECRET or PAYHERE_MOBILE_MERCHANT_SECRET)
     ├─► Adapter verifies md5sig using crypto.timingSafeEqual
     ├─► Begins Serializable/Deadlock-retry DB transaction:
     │     ├─► SELECT ... FOR UPDATE on bookings and payment_intents
     │     ├─► Verifies currency, amountMinor, and merchantId match DB intent
     │     ├─► Idempotency check on payment_webhook_events (eventId)
     │     ├─► Idempotency check on payment_transactions (providerTransactionId)
     │     ├─► Capacity reservations updated: HELD_FOR_PAYMENT -> CONFIRMED
     │     ├─► Supersedes any open alternative intents on booking -> EXPIRED
     │     ├─► payment_intents.status -> SUCCEEDED, verified_at = NOW()
     │     ├─► bookings.status -> CONFIRMED, confirmed_at = NOW()
     │     ├─► custody_records initialized (status: EXPECTED)
     │     ├─► ledgerService.recordPaymentCaptured (DR 1010, CR 2010)
     │     ├─► booking_status_history inserted (PENDING_PAYMENT -> CONFIRMED)
     │     ├─► payment_webhook_events inserted (BOOKING_CONFIRMED)
     │     └─► security_audit_events recorded
     ▼
[Client Polling]
     │
     ├─► GET /api/v1/payments/checkout-status?bookingId=...
     └─► Receives bookingStatus: "CONFIRMED", custodyReady: true
          └─► Unlocks Custody Pass (QR Code & PIN)
```

---

## 4. PayHere Integration Locations Across the Monorepo

| Subsystem | File Path | Symbols / References |
|---|---|---|
| **Contracts** | `packages/contracts/src/payments/index.ts` | `PAYMENT_PROVIDERS` (`PAYHERE`), `PayHereCheckoutCustomerResolvedSchema`, `PayHereCheckoutFormFieldsSchema`, `PayHereWebCheckoutHandoffSchema`, `PayHereNativeSdkPayloadSchema`, `PayHereNativeCheckoutHandoffSchema` |
| **API Config** | `apps/api/src/config/env.ts` | `PAYHERE_MERCHANT_ID`, `PAYHERE_WEB_MERCHANT_SECRET`, `PAYHERE_MOBILE_MERCHANT_SECRET`, `PAYHERE_ANDROID_PACKAGE_NAME`, `PAYHERE_SANDBOX_MODE`, `PAYHERE_NOTIFY_URL`, `PAYHERE_RETURN_URL`, `PAYHERE_CANCEL_URL`, fail-closed check on `PAYHERE_MERCHANT_SECRET` |
| **API DB Schema** | `apps/api/src/infrastructure/database/schema/payments.ts` | `payment_intents_provider_check` (`'SANDBOX_GATEWAY', 'PAYHERE'`), `payment_intents_payhere_channel_active_check` |
| **API Gateway Port** | `apps/api/src/modules/payments/payment-gateway.port.ts` | `PayHereGatewayAdapter`, `resolvePayHereGatewayAdapter`, `formatMinorAmountTwoDecimals`, `parsePayHereDecimalAmountToMinor` |
| **API Service** | `apps/api/src/modules/payments/payments.service.ts` | `processPayHereWebhook`, PayHere status parsing, `extractUntrustedWebhookLookup` |
| **API Routes** | `apps/api/src/modules/payments/payments.routes.ts` | `POST /webhooks/payhere`, retired `GET /handoff/:handoffToken` |
| **Web Lib** | `apps/web/src/lib/payment-handoff.ts` | `ALLOWED_PAYHERE_CHECKOUT_URLS`, `buildPayHereCheckoutForm`, `submitPayHereCheckoutForm`, `isPayHerePostHandoff` |
| **Web Checkout** | `apps/web/src/features/traveller/CheckoutSchedulePage.tsx` | `isPayHerePostHandoff`, `submitPayHereCheckoutForm` |
| **Web Return** | `apps/web/src/features/traveller/PaymentConfirmationPage.tsx` | PayHere return query parameter checks, auto-post form retry |
| **Mobile Lib** | `apps/mobile/src/lib/payhere-native.ts` | `launchPayHereNativeCheckout`, `PayHereNativeOutcome`, dynamic import of `@payhere/payhere-mobilesdk-reactnative` |
| **Mobile Handoff** | `apps/mobile/src/lib/payment-handoff.ts` | `submitPayHereWebCheckoutForm`, `isPayHereWebPostHandoff`, `isPayHereNativeSdkHandoff` |
| **Mobile Screen** | `apps/mobile/app/(traveller)/checkout.tsx` | Web form submission vs Android native SDK invocation |
| **Mobile Screen** | `apps/mobile/app/booking/confirm.tsx` | PayHere checkout status polling screen |
| **Mobile Native Config** | `apps/mobile/app.json` | Plugin `"./plugins/withPayHereSdk"` |
| **Mobile Plugin** | `apps/mobile/plugins/withPayHereSdk.js` | Android config plugin injecting JitPack repository and manifest allowBackup replacement |
| **Mobile Manifest** | `apps/mobile/package.json` | `@payhere/payhere-mobilesdk-reactnative: 4.1.0` |
| **Workspace Patches** | `patches/@payhere__payhere-mobilesdk-reactnative@4.1.0.patch`, `pnpm-workspace.yaml` | AGP 9.2 namespace and deprecated manifest patch |
| **Environment Files** | `.env.example`, `apps/*/.env.example`, `.envs/*.example` | `PAYHERE_*` variables across dev, test, and production templates |

---

## 5. Database Dependencies

### Entities in `apps/api/src/infrastructure/database/schema/payments.ts`:
1. **`payment_intents`:**
   - Columns: `id`, `booking_id`, `traveller_user_id`, `provider`, `checkout_channel`, `idempotency_key`, `provider_order_id`, `amount_minor`, `currency`, `status`, `checkout_payload`, `expires_at`, `verified_at`, `failure_reason`, `created_at`, `updated_at`.
   - Constraints:
     - `payment_intents_provider_check`: `provider IN ('SANDBOX_GATEWAY', 'PAYHERE')` (CRITICAL: must be expanded to include `'STRIPE'` and `'PAYPAL'` while keeping `'PAYHERE'` for historical records).
     - `payment_intents_checkout_channel_check`: `checkout_channel IN ('WEB', 'MOBILE_APP')`.
     - `payment_intents_single_active_per_booking_idx`: Unique partial index on `(booking_id)` where `status IN ('INITIATED', 'PENDING_GATEWAY')`.
     - `payment_intents_booking_idempotency_unique`: Unique index on `(booking_id, idempotency_key)`.
     - `payment_intents_provider_order_unique`: Unique index on `provider_order_id`.

2. **`payment_transactions`:**
   - Columns: `id`, `payment_intent_id`, `booking_id`, `refund_id`, `provider`, `provider_transaction_id`, `transaction_type`, `status`, `amount_minor`, `currency`, `raw_status_code`, `evidence_source`, `manual_reference`, `settled_by_user_id`, `signature_verified`, `metadata`, `created_at`.
   - Constraints:
     - `payment_transactions_provider_tx_unique`: Unique index on `(provider, provider_transaction_id)`.
     - `payment_transactions_type_check`: `transaction_type IN ('CHARGE', 'REFUND')`.
     - `payment_transactions_status_check`: `status IN ('SUCCEEDED', 'FAILED', 'PENDING')`.
     - `payment_transactions_evidence_source_check`: `evidence_source IN ('PROVIDER_WEBHOOK', 'SANDBOX_SIMULATOR', 'ADMIN_PROVIDER_ATTESTED', 'ADMIN_MANUAL_OFFLINE')`.

3. **`payment_webhook_events`:**
   - Columns: `id`, `provider`, `event_id`, `payload_hash`, `payment_intent_id`, `processing_outcome`, `received_at`.
   - Constraints:
     - `payment_webhook_events_provider_event_unique`: Unique index on `(provider, event_id)`.

4. **`refund_records`:**
   - Columns: `id`, `booking_id`, `payment_intent_id`, `amount_minor`, `currency`, `refund_percentage`, `reason_category`, `status`, `settlement_mode`, `provider_refund_id`, `manual_reference`, `requested_by_user_id`, `authorized_by_user_id`, `settled_by_user_id`, `notes`, `completed_at`, `created_at`, `updated_at`.
   - Constraints:
     - 7 statuses: `REQUESTED`, `AUTHORIZED`, `INITIATED`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `MANUAL_REVIEW_REQUIRED`.
     - Modes: `PROVIDER_CONFIRMED`, `MANUAL_OFFLINE`.

---

## 6. Booking-to-Payment Relationships

1. **Foreign Keys:**
   - `payment_intents.booking_id -> bookings.id` (`onDelete: "restrict"`).
   - `payment_transactions.booking_id -> bookings.id` (`onDelete: "restrict"`).
   - `refund_records.booking_id -> bookings.id` (`onDelete: "restrict"`).
2. **State Gating:**
   - `bookings.status` starts at `PENDING_PAYMENT`.
   - Only a verified payment notification transitions `bookings.status` to `CONFIRMED`.
   - `hold_expires_at` (15-minute booking hold) is cleared upon confirmation.
   - If payment webhook arrives after hold expiration, capacity re-verification occurs; if capacity is lost, intent is marked `ORPHANED_SUCCEEDED` and flagged for automated refund.
3. **Custody Lock:**
   - Custody QR code token generation (`POST /api/v1/bookings/:bookingId/custody-pass`) rejects with `409 Conflict` until booking status is `CONFIRMED` or `IN_STORAGE`.

---

## 7. Payment-to-Finance Relationships

The marketplace enforces double-entry bookkeeping via `apps/api/src/modules/finance/ledger.service.ts`:

### Standard Double-Entry Accounts (`LEDGER_ACCOUNTS`):
- `1010` Gateway Clearing Receivable (Asset)
- `1020` Traveller Overdue Fee Receivable (Asset)
- `2010` Traveller Unearned Booking Liability (Liability - Escrow)
- `2020` Host Settlement Payable Liability (Liability)
- `2030` Traveller Refund Payable Liability (Liability)
- `4010` Platform Marketplace Commission Revenue (Revenue)

### Journal Group Transitions:
1. **On Payment Capture (`recordPaymentCaptured`):**
   - **DEBIT** Account `1010` (Gateway Clearing Receivable) for `amountMinor`
   - **CREDIT** Account `2010` (Traveller Unearned Booking Liability) for `amountMinor`
2. **On Booking Completed Check-out (`recordBookingCompletedSettlement`):**
   - **DEBIT** Account `2010` (Traveller Liability) for `grossSubtotalMinor`
   - **CREDIT** Account `2020` (Host Settlement Payable) for `netPayableMinor`
   - **CREDIT** Account `4010` (Platform Commission Revenue) for `commissionMinor`
3. **On Cancellation Refund (`recordCancellationSettlement`):**
   - **DEBIT** Account `2010` (Traveller Liability) for refund amount
   - **CREDIT** Account `2030` (Traveller Refund Payable Liability) for refund amount

All postings enforce `SUM(DEBIT) === SUM(CREDIT)` and positive 32-bit integer minor amounts.

---

## 8. Platform Commission Calculations

Platform commission is calculated in minor units:
- Base commission percentage is defined in `pricing_policies` and snapshotted per booking in `booking_pricing_snapshots`.
- Default marketplace rate is `1500` basis points (15.00%).
- Calculation formula:
  $$\text{commissionMinor} = \left\lfloor \frac{\text{grossSubtotalMinor} \times \text{commissionRateBps}}{10000} \right\rfloor$$
  $$\text{netPayableMinor} = \text{grossSubtotalMinor} - \text{commissionMinor}$$
- Strict invariant enforced in `host_payables`: `commission_minor + net_payable_minor === gross_subtotal_minor`.

---

## 9. Host Settlement and Payout Functionality

- **Accrual:** When a booking completes check-out, `host_payables` is marked `ELIGIBLE`.
- **Payout Batches (`schema/finance.ts`, `apps/api/src/modules/finance/payouts.service.ts`):**
  - Grouped by `business_id` for approved host businesses.
  - Admin creates a payout batch (`payout_batches` + `payout_batch_items`).
  - Batch moves from `DRAFT` to `PROCESSING` to `DISBURSED`.
  - Disbursal currently relies on manual bank transfer / wire export with masked account details (`maskPayoutAccountNumber`).
  - **Gap:** No automated provider payouts (e.g. Stripe Transfers / Connect Payouts) currently exist.

---

## 10. Existing Refund and Cancellation Functionality

- **Refund Lifecycle (`refund_records`):**
  - `REQUESTED` -> `AUTHORIZED` -> `INITIATED` -> `PROCESSING` -> `SUCCEEDED` / `FAILED` / `MANUAL_REVIEW_REQUIRED`.
- **Settlement Modes:**
  - `PROVIDER_CONFIRMED`: Attested with gateway refund transaction reference (`provider_refund_id`).
  - `MANUAL_OFFLINE`: Attested with offline wire/cash proof reference (`manual_reference`).
- **PayHere Limitation:** PayHere Checkout API does not support automated API-driven refunds for standard merchant accounts; refunds previously had to be processed through PayHere Merchant Portal manually, and then attested into the system by an administrator.
- **Stripe & PayPal Opportunity:** Both Stripe and PayPal provide native, automated API-driven refund execution.

---

## 11. Frontend and Mobile Dependencies

### Web (`apps/web`):
- `apps/web/src/lib/payment-handoff.ts`: Utilities for building hidden HTML forms, validating `ALLOWED_PAYHERE_CHECKOUT_URLS`, checking referrer policies, and managing session storage context.
- `apps/web/src/features/traveller/CheckoutSchedulePage.tsx`:
  - Renders order summary and button "Continue to payment".
  - Calls `marketplaceApi.createPaymentIntent({ bookingId, channel: "WEB", ... })`.
  - If returned handoff is `POST_FORM`, calls `submitPayHereCheckoutForm(handoff)`.
- `apps/web/src/features/traveller/PaymentConfirmationPage.tsx`:
  - Handles return redirect landing.
  - Validates `order_id` / `bookingId`.
  - Polls `GET /api/v1/payments/checkout-status`.
- `apps/web/src/features/admin/AdminPaymentsAndRefundsPages.tsx`:
  - Displays transaction logs and refund management table. Already renders `tx.provider` and generic references cleanly.

### Mobile (`apps/mobile`):
- `apps/mobile/app/(traveller)/checkout.tsx`:
  - If `Platform.OS === 'web'`, submits browser form.
  - If native Android/iOS, calls `launchPayHereNativeCheckout(handoff.sdkPayload)` from `src/lib/payhere-native.ts`.
- `apps/mobile/src/lib/payhere-native.ts`:
  - Dynamic require of `@payhere/payhere-mobilesdk-reactnative`.
  - Wraps native module `PayhereOfficial.startPayment`.
- `apps/mobile/app/booking/confirm.tsx`:
  - Dedicated return/cancel landing screen with polling for booking confirmation.

---

## 12. Existing Payment-Related Security Controls

1. **Webhook Signature Verification:**
   - Raw HTTP request body string preserved via custom Fastify content-type parsers (`application/json` and `application/x-www-form-urlencoded`).
   - Constant-time signature comparison (`crypto.timingSafeEqual`).
2. **Channel-Isolated Credentials:**
   - Server-side selection of `PAYHERE_WEB_MERCHANT_SECRET` vs `PAYHERE_MOBILE_MERCHANT_SECRET` based on DB intent lookup, preventing mobile app compromise from impersonating web checkout.
3. **Idempotency & Replay Protection:**
   - `payment_webhook_events` enforces uniqueness on `(provider, event_id)`.
   - `payment_transactions` enforces uniqueness on `(provider, provider_transaction_id)`.
   - Webhook processing checks `payloadHash` (SHA-256).
4. **Row-Level Locking:**
   - `withSerializableOrDeadlockRetry` with `SELECT ... FOR UPDATE` prevents race conditions on concurrent webhook deliveries or customer retries.
5. **Zero Client Secrets:**
   - Neither web bundles nor native mobile applications contain merchant secrets or calculate signature hashes. All hashes are server-generated.
6. **No Floating Point for Money:**
   - Integer minor units (`amountMinor: integer`) used across database, contracts, ledger, and services. Formatting converts strictly to string without floating point arithmetic (`formatMinorAmountTwoDecimals`).

---

## 13. Tests That Need Replacement

| Test File | Workspace | Lines | Focus & Replacement Need |
|---|---|---|---|
| `apps/api/tests/payhere-sandbox-remediation.test.ts` | API | 838 | PayHere MD5 hash vectors, channel isolation, and notify webhook verification. Needs replacement with Stripe & PayPal provider test suite. |
| `apps/api/tests/phase-b-payhere-checkout.test.ts` | API | 677 | PayHere form generation, retired handoff endpoints, and secret separation. Needs replacement with Stripe/PayPal checkout test suite. |
| `apps/web/tests/phase-b-checkout-handoff.test.tsx` | Web | 359 | PayHere hidden form submission, referrer policy enforcement. Needs replacement with multi-provider checkout selector & Stripe/PayPal handoff tests. |
| `apps/mobile/tests/payhere-sandbox-remediation.test.ts` | Mobile | 280 | PayHere native SDK parameter contract & mock bridge. Needs replacement with mobile Stripe/PayPal integration tests. |
| `apps/mobile/tests/phase-b-checkout-handoff.test.ts` | Mobile | 275 | PayHere mobile handoff routing. Needs update for new provider options. |
| `apps/mobile/tests/phase-c-payment-security.test.ts` | Mobile | 380 | Verifies no PayHere secrets in client bundles. Needs update to verify no Stripe/PayPal secret keys in bundles while allowing publishable/client IDs. |

---

## 14. Potential Data Migration Risks

1. **Preservation of Historical PayHere Data:**
   - The database contains historical PayHere payment intents, transactions, and ledger entries.
   - **Rule:** Do NOT delete or mutate historical PayHere records. Historical rows must remain readable with `provider = 'PAYHERE'`.
2. **Database Constraints:**
   - `payment_intents_provider_check` currently enforces `sql`${table.provider} IN ('SANDBOX_GATEWAY', 'PAYHERE')``.
   - Modifying this requires a forward-only migration (`0019`) to alter the check constraint:
     `CHECK (provider IN ('SANDBOX_GATEWAY', 'PAYHERE', 'STRIPE', 'PAYPAL'))`.
   - `payment_intents_payhere_channel_active_check` must remain valid for legacy PayHere records while not impeding Stripe or PayPal.
3. **Multi-Currency Constraints:**
   - Current database columns have `varchar("currency", { length: 3 }).notNull().default("LKR")`.
   - While `varchar(3)` fits ISO 4217 currency codes (`USD`, `EUR`, `GBP`, `LKR`), application logic must be validated to ensure exchange rate handling, ledger group consistency (single currency per journal group), and pricing snapshots operate correctly across international currencies.
4. **JSONB Checkout Payloads:**
   - `payment_intents.checkout_payload` stores provider-specific payloads.
   - The Drizzle schema uses `jsonb("checkout_payload")`. We must define a provider-agnostic discriminated schema in `@luggage-storage/contracts` that cleanly differentiates Stripe (`clientSecret`, `paymentIntentId`, `publishableKey`, `ephemeralKey`), PayPal (`orderId`, `approveUrl`), Sandbox (`simulated`), and legacy PayHere (`fields`, `sdkPayload`).

---

## 15. Known Limitations & Implementation Gaps in Current System

1. **Single Domestic Provider:** PayHere was restricted to Sri Lanka (`LKR`) and domestic payment schemes. International cards frequently failed or faced 3DS/regulatory barriers.
2. **No Automated Refunds:** PayHere required manual admin portal logins to initiate refunds. The API only allowed manual recording of refund references.
3. **No Direct Customer Payment Method Selection:** The checkout flow defaulted directly to PayHere or Sandbox simulation; there was no UI to choose between Credit/Debit Card, PayPal, Apple Pay, Google Pay, etc.
4. **No Automated Host Payouts:** All host payouts are currently handled via manual bank wire batching (`payout_batches`), without Stripe Connect / PayPal Payouts integration.
5. **No Multi-Currency Rate Conversion:** Quotations and bookings assumed a single market currency. For a global marketplace, traveller pricing, platform commission, and host payouts must support multi-currency operation.

---

## 16. Audit Conclusion & Next Phase Readiness

The repository is in a clean, stable state with 100% passing tests (71 test files, 736 tests passing). The core business domain (bookings, capacity reservations, custody verification, and double-entry ledger) is completely decoupled from payment processing, providing an ideal foundation for the **Payment Infrastructure Transformation**.

We are now ready to proceed to **Phase 1: Target Payment Architecture & Provider Abstraction Design**.

