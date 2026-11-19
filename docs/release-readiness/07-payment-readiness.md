# Phase 8 — Payment Infrastructure Readiness Report

**Document:** `docs/release-readiness/07-payment-readiness.md`  
**Repository:** `https://github.com/kavicastelo/luggage-storage`  
**Phase:** 8 — Workstream 3: Payments & Financial Readiness  
**Status:** COMPLETED & VERIFIED  
**Date:** November 19, 2026  
**Auditor:** Independent Release Readiness Auditor  

---

## 1. Executive Summary

In Phase 6, the platform underwent a payment infrastructure transformation, decommissioning the single-vendor PayHere gateway and establishing a dual-provider architecture:
- **Primary Provider:** Stripe (Stripe Elements, Payment Intents API, Webhook signature verification).
- **Alternative Provider:** PayPal (REST Orders API v2, PayPal Checkout Buttons, Webhook notification verification).

This audit confirms that the payment infrastructure is robust, idempotent, and financially auditable. PayHere has been permanently decommissioned as an active gateway while strictly preserving all historical database tables, transaction records, and ledger balances.

---

## 2. Multi-Provider Architecture & Flow

```
                      ┌────────────────────────────────────────┐
                      │    Traveller Checkout / Hold State     │
                      │       (Booking: PENDING_PAYMENT)       │
                      └───────────────────┬────────────────────┘
                                          │
                        POST /api/v1/payments/intents
                                          │
                         ┌────────────────┴────────────────┐
                         ▼                                 ▼
               ┌───────────────────┐             ┌───────────────────┐
               │  STRIPE (Primary) │             │ PAYPAL (Alternate)│
               │  - PaymentIntent  │             │ - Orders API v2   │
               │  - Client Secret  │             │ - Approval Link   │
               └─────────┬─────────┘             └─────────┬─────────┘
                         │                                 │
                         ▼                                 ▼
               ┌───────────────────┐             ┌───────────────────┐
               │ Webhook: /stripe  │             │ Webhook: /paypal  │
               │ Sig: stripe-sig   │             │ Sig: TRANSMISSION │
               └─────────┬─────────┘             └─────────┬─────────┘
                         │                                 │
                         └────────────────┬────────────────┘
                                          │
                                          ▼
                      ┌────────────────────────────────────────┐
                      │    IDEMPOTENT TRANSACTION DISPATCH     │
                      │  - Table: payment_webhook_events       │
                      │  - Lock: bookings FOR UPDATE           │
                      │  - Status -> SUCCEEDED                 │
                      │  - Escrow Locked -> PASS UNLOCKED      │
                      └────────────────────────────────────────┘
```

---

## 3. Webhook Signature Verification & Idempotency

### 3.1 Stripe Webhook Security
- Raw body parser is registered in `payments.routes.ts` preserving the byte-for-byte UTF-8 payload.
- Signature verification utilizes the official Stripe SDK `stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET)`.
- Replay attacks are rejected based on Stripe timestamp tolerance (300 seconds).

### 3.2 PayPal Webhook Security
- Verifies transmission headers: `PAYPAL-AUTH-ALGO`, `PAYPAL-CERT-URL`, `PAYPAL-TRANSMISSION-ID`, `PAYPAL-TRANSMISSION-SIG`, `PAYPAL-TRANSMISSION-TIME`.
- Verifies webhook event against PayPal's verification endpoint using `PAYPAL_WEBHOOK_ID`.

### 3.3 Double-Processing & Idempotency Protection
- Every webhook event is registered in `payment_webhook_events` with unique constraint on `(provider, event_id)`.
- If an identical webhook event is redelivered, the database duplicate key constraint is caught, returning HTTP 200 immediately without executing duplicate state mutations or ledger postings.

---

## 4. PayHere Decommissioning & Historical Ledger Preservation

### 4.1 Active Path Prohibition
- In `apps/api/src/config/env.ts`, `PAYMENT_PROVIDER=payhere` is explicitly prohibited in production (`NODE_ENV === "production"`).
- In `apps/api/src/modules/payments/payments.service.ts`, `createPaymentIntent` rejects any request where `provider === "PAYHERE"` with `AppError.badRequest("PAYHERE_PROVIDER_RETIRED")`.
- The retired HTML handoff bridge endpoint `GET /api/v1/payments/handoff/:token` permanently returns HTTP 410 Gone (`HANDOFF_ENDPOINT_RETIRED`).

### 4.2 Historical Ledger Integrity
- Database schema migration `0019_payment_infrastructure_transformation.sql` preserved all columns and rows in `payments`, `payment_intents`, and `ledger_entries` where `provider = 'PAYHERE'`.
- All historical transactions remain immutable and queryable for financial reconciliation and tax audits.

---

## 5. Verification Results

Automated test suites in `apps/api/tests/`:
- `tests/stripe-payment.test.ts` (5 tests): **100% Passed**.
- `tests/paypal-payment.test.ts` (5 tests): **100% Passed**.
- `tests/payhere-sandbox-remediation.test.ts` (4 tests): **100% Passed**.

**Gate Determinations:**
- **Gate A (Demo Ready):** PASS. Sandbox provider simulation operates with full HMAC webhook pipeline.
- **Gate B (Production Ready):** CONDITIONAL. Requires live Stripe production credentials (`sk_live_...`) and PayPal production credentials before live merchant launch.

