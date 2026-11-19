# Payment Demo Verification

**Document ID:** `docs/release-readiness/phase-8-1/10-payment-demo-verification.md`  
**Phase:** 8.1 Demo Readiness  
**Target:** Payment Providers & Booking Lifecycle  
**Status:** Verified & Documented

---

## 1. Executive Summary

This document verifies the payment architecture and lifecycle execution for the demo environment across Stripe test cards, PayPal sandbox accounts, and local simulated sandbox workflows.

It confirms that payment confirmation gates the release of traveler custody passes and triggers double-entry host payout ledger accruals.

---

## 2. Supported Demo Payment Channels

The demo environment supports two payment configurations:

1. **Provider Sandbox Mode (`STRIPE` / `PAYPAL` with `APP_ENV=demo`):**
   - Uses real Stripe test API keys (`pk_test_...`, `sk_test_...`) and PayPal sandbox client IDs.
   - Interacts with provider testing sandboxes.
2. **Internal Simulated Sandbox Mode (`PAYMENT_PROVIDER=sandbox` with `APP_ENV=demo`):**
   - Available when live sandbox credentials are being provisioned.
   - Allows end-to-end booking verification, webhook simulation, QR custody generation, and ledger updates without external network dependencies.
   - Strictly prohibited when `APP_ENV=production` via Zod schema enforcement.

---

## 3. Stripe Sandbox Verification

### 3.1 Test Scenarios & Card Matrix

| Scenario | Test Card Number | CVC | Exp Date | Expected Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Successful Payment** | `4242 4242 4242 4242` | Any 3 digits | Future date | Booking status transitions to `CONFIRMED`; QR custody pass issued. |
| **Card Declined** | `4000 0000 0000 0002` | Any 3 digits | Future date | Payment intent fails; booking remains `PENDING_PAYMENT`. |
| **3D Secure Authentication** | `4000 0000 0000 0306` | Any 3 digits | Future date | Triggers Stripe 3DS challenge popup; confirms upon authorization. |
| **Insufficient Funds** | `4000 0000 0000 9995` | Any 3 digits | Future date | Rejection with user-friendly error message. |

### 3.2 Automated Test Coverage

Verified via `apps/api/tests/stripe-payment.test.ts`:
- Payment intent creation for booking.
- Webhook signature verification (`stripe-signature` header).
- Handling of `payment_intent.succeeded` and `payment_intent.payment_failed` events.
- All 5 automated tests passing cleanly.

---

## 4. PayPal Sandbox Verification

### 4.1 Test Scenarios & Flow

1. **Order Creation:** Client sends booking payment request to `/api/v1/payments/create-intent` with `provider: "PAYPAL"`.
2. **Handoff:** Client receives PayPal checkout approval URL.
3. **Capture / Webhook:** Upon buyer authorization, the `CHECKOUT.ORDER.APPROVED` webhook or direct capture endpoint validates payment and transitions booking to `CONFIRMED`.

### 4.2 Automated Test Coverage

Verified via `apps/api/tests/paypal-payment.test.ts`:
- Order creation and intent capture.
- Webhook HMAC verification.
- Duplicate event idempotency.
- All 5 automated tests passing cleanly.

---

## 5. Security & Custody Pass Gate Verification

1. **QR Custody Pass Gating:**
   - The booking pass endpoint `/api/v1/bookings/:id/pass` enforces `booking.status === "CONFIRMED"`.
   - In `PENDING_PAYMENT` or `CANCELLED` states, the custody pass returns HTTP 403 / 400 with `PASS_LOCKED`.
2. **Double-Entry Ledger Accrual:**
   - Upon successful payment verification, the financial ledger records:
     - `DEBIT`: Platform Cash / Merchant Account.
     - `CREDIT`: Host Payable Account (host earnings).
     - `CREDIT`: Platform Revenue Account (marketplace fee).
3. **Zero-Trust Production Gate:**
   - If `effectiveAppEnv === "production"`, `PAYMENT_PROVIDER=sandbox` is rejected at process startup by `EnvSchema.superRefine()`.
