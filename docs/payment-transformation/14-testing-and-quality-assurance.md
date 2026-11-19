# Testing and Quality Assurance Strategy

**Project:** Luggage Storage Marketplace (`kavicastelo/luggage-storage`)  
**Document:** `docs/payment-transformation/14-testing-and-quality-assurance.md`  
**Initiative:** Payment Infrastructure Transformation  
**Status:** Approved QA Strategy  

---

## 1. Testing Pyramid

```text
               ▲
              / \
             /   \     End-to-End Traveller Journeys (Stripe & PayPal)
            / E2E \    - Complete booking -> payment -> custody unlock
           /───────\
          /         \   Integration Tests
         / Integrat. \  - Fastify route injection, PostgreSQL transactions,
        /─────────────\   webhook signature verification, double-entry ledger
       /               \
      /   Unit Tests    \ Provider adapters, contract schemas, currency math,
     /                   \ idempotency hashing, state machine transitions
    ───────────────────────
```

---

## 2. Test Suite Architecture

### 2.1 Unit Tests (`apps/api/tests/payments-domain.test.ts`)
- Provider registry initialization and dynamic capability checks.
- Amount and currency formatting without floating-point math.
- Idempotency key generation and collision detection.
- State machine transition rules.
- Double-entry ledger group balance validation.

### 2.2 Stripe Integration Tests (`apps/api/tests/stripe-payment.test.ts`)
- Stripe PaymentIntent creation with customer metadata.
- Stripe webhook signature verification with simulated valid and invalid signatures.
- Out-of-order and duplicated webhook event handling.
- Automated Stripe refund dispatch and ledger posting.

### 2.3 PayPal Integration Tests (`apps/api/tests/paypal-payment.test.ts`)
- PayPal Orders v2 creation and capture workflow.
- PayPal Webhook verification and event normalization.
- PayPal refund execution and failure handling.

### 2.4 Web & Mobile Checkout Tests
- `apps/web/tests/payment-provider-selection.test.tsx`: Validates multi-provider selector, payment method switching, and return polling.
- `apps/mobile/tests/payment-provider-selection.test.ts`: Validates mobile payment selector, deep link handling, and app state recovery.

### 2.5 Historical Legacy Data Regression Tests
- Validates that historical PayHere rows remain queryable in `AdminPaymentsAndRefundsPages` and host finance views.
- Validates that attempts to create new PayHere intents fail cleanly with `PAYHERE_PROVIDER_RETIRED`.

