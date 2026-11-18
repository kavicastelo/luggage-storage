# Target Payment Architecture

**Project:** Luggage Storage Marketplace (`kavicastelo/luggage-storage`)  
**Document:** `docs/payment-transformation/01-target-payment-architecture.md`  
**Initiative:** Payment Infrastructure Transformation  
**Status:** Approved Target Architecture  

---

## 1. Vision & Architectural Goals

The Luggage Storage Marketplace is expanding from an initial single-market prototype (Sri Lanka / LKR) into an international marketplace with company formation in the United States or United Kingdom.

The target payment infrastructure provides:
1. **Global Multi-Currency Customer Acceptance:** International travellers can pay with debit/credit cards, Apple Pay, Google Pay, and PayPal across major global currencies (`USD`, `EUR`, `GBP`, `LKR`, `AUD`, `CAD`, `SGD`, `JPY`).
2. **Provider-Agnostic Core Domain:** The application core (Bookings, Capacity, Custody, Ledger, Finance, Admin) has zero direct coupling to Stripe SDKs, PayPal REST APIs, or legacy PayHere parameters.
3. **Stripe as Primary Provider:** High-conversion payment processing, card tokenization, 3D Secure / SCA compliance, automated refunds, dispute handling, and marketplace transfers.
4. **PayPal as Alternative Provider:** Frictionless alternative wallet checkout for customers preferring PayPal or lacking credit cards.
5. **Preserved Historical Integrity:** 100% preservation of all legacy PayHere records in database, ledger, and reporting views.
6. **Strict Cryptographic and Financial Security:** Webhook signature verification, idempotent processing, row-level locking, and double-entry ledger balance guarantees.

---

## 2. High-Level Component Diagram

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Traveller & Admin Frontends                     │
│    Web (React/Vite)                    Mobile (Expo / React Native)    │
│    - Multi-provider selector           - Unified payment selection     │
│    - Stripe Elements / Checkout        - Native Stripe / In-App Sheet  │
│    - PayPal JS SDK / Buttons           - PayPal In-App Checkout        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS REST
┌───────────────────────────────────▼────────────────────────────────────┐
│                    API Gateway & Controllers (Fastify)                 │
│    apps/api/src/modules/payments/payments.routes.ts                    │
│    - POST /api/v1/payments/intents (channel, provider, customerDetails)│
│    - GET  /api/v1/payments/checkout-status?bookingId=...               │
│    - POST /api/v1/payments/webhooks/stripe                             │
│    - POST /api/v1/payments/webhooks/paypal                             │
│    - POST /api/v1/payments/webhooks/sandbox                            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                           Payments Service                             │
│    apps/api/src/modules/payments/payments.service.ts                   │
│    - Booking hold verification & idempotency                           │
│    - Provider registry coordination                                    │
│    - Settlement pipeline & lock ordering                               │
│    - Automated refund execution & admin reconciliation                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                   Provider Registry & Adapters                         │
│    apps/api/src/modules/payments/provider.registry.ts                  │
│    ┌──────────────────────────────┼──────────────────────────────┐     │
│    ▼                              ▼                              ▼     │
│  StripeAdapter              PayPalAdapter              SandboxAdapter  │
│  - Payment Intents          - Orders v2 API            - HMAC Mock     │
│  - Webhook signatures       - Webhook signatures                       │
│  - Automated refunds        - Automated refunds                        │
└───────────────────┬──────────────────────┬──────────────────────┬──────┘
                    │                      │                      │
┌───────────────────▼──────────────────────▼──────────────────────▼──────┐
│                       PostgreSQL 16 Storage Layer                      │
│    - payment_intents (provider: STRIPE | PAYPAL | SANDBOX | PAYHERE)   │
│    - payment_transactions (provider_transaction_id, evidence_source)   │
│    - payment_webhook_events (idempotent replay log)                    │
│    - refund_records (7-stage state machine)                            │
│    - financial_ledger_entries (double-entry append-only journal)       │
│    - host_payables (marketplace settlement balances)                   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Architectural Principles

### 3.1 Provider Decoupling
The core application communicates with payment gateways exclusively through the `PaymentGatewayPort` interface. Neither the booking state machine nor the custody QR service has knowledge of whether an intent was fulfilled by Stripe or PayPal.

### 3.2 Dual-Provider Strategy
- **Primary:** `STRIPE` (Card, Apple Pay, Google Pay, Link, local debit).
- **Alternative:** `PAYPAL` (PayPal Wallet, Pay in 4, alternative card processing).
- **Development/Test:** `SANDBOX_GATEWAY` (deterministic offline simulator).
- **Historical:** `PAYHERE` (immutable archive).

### 3.3 Server-Authoritative Settlement
Frontend redirects, deep links, and client callbacks are strictly treated as **untrusted UI navigation hints**. A booking is confirmed and custody QR tokens are unlocked **strictly and only after** a cryptographic server-to-server webhook has been received, verified, and settled within an ACID database transaction.

### 3.4 Multi-Currency Normalization
- All financial calculations are executed using integer minor units (e.g. cents, pence, minor LKR) to prevent IEEE-754 floating-point inaccuracies.
- Database currency fields (`varchar(3)`) store standard ISO 4217 currency codes (`USD`, `EUR`, `GBP`, `LKR`, `AUD`, `CAD`, `SGD`, `JPY`).
- Multi-currency ledger entries are segregated into single-currency journal transaction groups.

---

## 4. Workstream Mapping & Implementation Plan

| Workstream | Focus Area | Key Deliverables |
|---|---|---|
| **WS1: Architecture & DB** | Core Domain & Contracts | `PaymentProvider` interface, schema migration `0019`, Drizzle update, contracts update |
| **WS2: Stripe Integration** | Stripe SDK & Webhooks | `StripeGatewayAdapter`, PaymentIntent & Checkout session builder, signature verification, refunds |
| **WS3: PayPal Integration** | PayPal REST & Webhooks | `PayPalGatewayAdapter`, Orders v2 creation & capture, webhook validation, refunds |
| **WS4: Web Frontend** | React / Vite UI | Multi-provider selector, Stripe Elements / Hosted checkout, PayPal Buttons, status polling |
| **WS5: Mobile Application** | Expo / React Native | React Native Stripe integration / hosted flow, PayPal mobile approval, return deep links |
| **WS6: Finance & Admin** | Dashboards & Operations | Multi-provider transaction filtering, currency-aware summaries, automated refund trigger |
| **WS7: QA & PayHere Removal**| Elimination & Regression | Clean deletion of obsolete PayHere code/SDK/patches, comprehensive test suite (unit/int/e2e) |

