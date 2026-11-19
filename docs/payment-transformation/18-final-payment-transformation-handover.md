# Payment Infrastructure Transformation — Final Handover & Operator Runbook

**Project:** Global Luggage Storage Marketplace  
**Initiative:** Payment Infrastructure Transformation  
**Target Environments:** Staging & Production  
**Document Version:** 1.0.0  
**Sign-Off Date:** 2026-11-19

---

## 1. Handover Certificate & Acceptance Criteria Verification

| Criteria | Required Standard | Status | Evidence |
|---|---|---|---|
| **PayHere Removal** | Zero active PayHere calls in Web & Mobile checkout; SDK, patch, & plugin removed | VERIFIED | `apps/mobile/app.json`, `apps/mobile/package.json`, `apps/mobile/app/(traveller)/checkout.tsx` |
| **Stripe Primary Integration** | Full PaymentIntent lifecycle, Elements handoff, raw webhook verification, refunds | VERIFIED | `apps/api/src/modules/payments/adapters/stripe.adapter.ts`, `apps/api/tests/stripe-payment.test.ts` (5 tests PASS) |
| **PayPal Alternative** | Orders v2 flow, OAuth token caching, HATEOAS approval link, webhook signature verification | VERIFIED | `apps/api/src/modules/payments/adapters/paypal.adapter.ts`, `apps/api/tests/paypal-payment.test.ts` (5 tests PASS) |
| **Ledger Integrity** | Double-entry balanced accounting groups, integer minor units, zero float math | VERIFIED | `apps/api/src/modules/ledger/`, `tests/phase-b-security-remediation.test.ts` (19 tests PASS) |
| **Historical Data Parity** | 100% historical PayHere intents and transactions preserved as read-only | VERIFIED | `apps/api/src/infrastructure/database/migrations/0019_payment_infrastructure_transformation.sql` |
| **Typecheck & Lint** | Clean compilation across all 4 packages | VERIFIED | `pnpm -r run typecheck`, `pnpm -r run lint` (0 errors) |
| **Monorepo Tests** | 100% green test suite | VERIFIED | **75 test files, 756 tests passed, 0 failed** |

---

## 2. Production Operator Runbook

### 2.1 Setting Up Stripe in Production

1. **Create Stripe Account:**
   - Register the legal entity (US Delaware LLC, UK Ltd, or Sri Lankan company) at [dashboard.stripe.com](https://dashboard.stripe.com).
   - Complete identity and business bank account verification.
2. **Retrieve API Keys:**
   - Navigate to **Developers -> API keys**.
   - Copy `Publishable key` (`pk_live_...`) to `STRIPE_PUBLISHABLE_KEY`.
   - Reveal `Secret key` (`sk_live_...`) and provision it into your production Secret Manager (`STRIPE_SECRET_KEY`).
3. **Configure Webhook Endpoint:**
   - In Stripe Dashboard, navigate to **Developers -> Webhooks -> Add endpoint**.
   - Set **Endpoint URL** to: `https://api.luggagestorage.lk/api/v1/payments/webhooks/stripe`
   - Select the following events:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `charge.dispute.created`
     - `charge.refunded`
   - Copy the Signing Secret (`whsec_...`) and store in `STRIPE_WEBHOOK_SECRET`.

---

### 2.2 Setting Up PayPal in Production

1. **Create PayPal Developer App:**
   - Log into [developer.paypal.com](https://developer.paypal.com) using your PayPal Business account credentials.
   - Go to **Dashboard -> Apps & Credentials -> Live**.
   - Create an app (e.g. `LuggageStorageMarketplaceProd`).
   - Copy `Client ID` to `PAYPAL_CLIENT_ID`.
   - Copy `Secret` to `PAYPAL_CLIENT_SECRET`.
2. **Configure PayPal Webhook:**
   - Under the app settings, click **Add Webhook**.
   - Set **Webhook URL** to: `https://api.luggagestorage.lk/api/v1/payments/webhooks/paypal`
   - Select event types:
     - `Payment capture completed` (`PAYMENT.CAPTURE.COMPLETED`)
     - `Payment capture denied` (`PAYMENT.CAPTURE.DENIED`)
     - `Customer dispute created` (`CUSTOMER.DISPUTE.CREATED`)
   - Copy the generated Webhook ID to `PAYPAL_WEBHOOK_ID`.
   - Set `PAYPAL_SANDBOX_MODE=false`.

---

### 2.3 Environment Configuration Matrix

| Variable | Dev / Test | Staging | Production | Description |
|---|---|---|---|---|
| `PAYMENT_PROVIDER` | `sandbox` | `stripe` | `stripe` | Active primary provider mode |
| `PAYMENT_DEFAULT_PROVIDER` | `stripe` | `stripe` | `stripe` | Default provider for new checkouts |
| `STRIPE_SECRET_KEY` | `sk_test_...` | `sk_test_...` | `sk_live_...` | Stripe secret API key (Secret Manager) |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_...` | `pk_test_...` | `pk_live_...` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | `whsec_...` | `whsec_...` | Stripe webhook signing secret |
| `PAYPAL_CLIENT_ID` | Mock / Test ID | Sandbox Client ID | Live Client ID | PayPal REST application client ID |
| `PAYPAL_CLIENT_SECRET` | Mock / Test Secret | Sandbox Secret | Live Secret | PayPal REST secret (Secret Manager) |
| `PAYPAL_WEBHOOK_ID` | Mock Webhook ID | Sandbox Webhook ID | Live Webhook ID | PayPal registered webhook ID |
| `PAYPAL_SANDBOX_MODE` | `true` | `true` | `false` | Disables sandbox endpoints when false |

---

## 3. Financial Reconciliation & Auditing

1. **Daily Ledger Reconciliation:**
   - Execute internal audit script or query:
     ```sql
     SELECT group_id, SUM(CASE WHEN direction = 'DEBIT' THEN amount_minor ELSE -amount_minor END) AS balance
     FROM financial_ledger_entries
     GROUP BY group_id
     HAVING SUM(CASE WHEN direction = 'DEBIT' THEN amount_minor ELSE -amount_minor END) <> 0;
     ```
   - Any non-zero rows indicate an unbalanced ledger group and will trigger automated PagerDuty alerts.
2. **Provider Settlement Reconciliation:**
   - Compare Stripe payout balance with `PLATFORM_FEE` and `HOST_PAYABLE` ledger postings.
   - Reconcile PayPal batch settlements against internal transactions table (`provider = 'PAYPAL' AND status = 'SUCCEEDED'`).
3. **Disputes & Chargebacks:**
   - Ingested automatically via webhooks.
   - Handled according to `docs/payment-transformation/10-dispute-and-chargeback-handling.md`.
