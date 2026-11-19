# Security and Compliance Specification

**Project:** Luggage Storage Marketplace (`kavicastelo/luggage-storage`)  
**Document:** `docs/payment-transformation/12-security-and-compliance.md`  
**Initiative:** Payment Infrastructure Transformation  
**Status:** Approved Security Specification  

---

## 1. PCI-DSS Compliance (SAQ A Eligibility)

The marketplace infrastructure is strictly architected to maintain **PCI-DSS Self-Assessment Questionnaire A (SAQ A)** eligibility:

1. **Zero Cardholder Data on Platform Servers:**
   - Raw Primary Account Numbers (PAN), Card Verification Values (CVV/CVC), and expiration dates never touch, transmit through, or store on our Fastify backend, PostgreSQL database, or client storage.
   - All card data is tokenized directly on Stripe's PCI Level 1 certified infrastructure via Stripe Elements or Stripe Checkout.
   - PayPal wallet credentials and card processing are handled entirely within PayPal's secure iFrame/hosted interface.
2. **TLS 1.3 Transport Security:**
   - All client-to-API, API-to-provider, and webhook communications enforce TLS 1.3 with strict modern cipher suites.
3. **Content Security Policy (CSP):**
   - Web application CSP permits scripts and frames exclusively from `https://js.stripe.com`, `https://hooks.stripe.com`, and `https://www.paypal.com`.

---

## 2. Webhook & Endpoint Cryptographic Hardening

1. **Body Size Limits:** Fastify enforces a strict 64KB (`65,536` bytes) payload limit on all webhook endpoints to prevent denial-of-service via large body buffering.
2. **Signature Verification:**
   - Stripe signatures (`stripe-signature`) are validated with constant-time HMAC-SHA256 checks.
   - PayPal signatures are verified via PayPal's Webhook Signature API with transmission ID tracking.
3. **Replay Protection:** Unique database constraints on `(provider, event_id)` reject duplicated notifications idempotently without re-triggering business logic.

---

## 3. Database Concurrency & Financial Locks

1. **Lock Ordering:**
   - Always lock `bookings` first, then `payment_intents` using `SELECT ... FOR UPDATE`.
   - Prevents deadlocks during concurrent webhook deliveries and traveller retries.
2. **Append-Only Immutability:**
   - PostgreSQL triggers prevent `UPDATE` or `DELETE` on `security_audit_events` and `financial_ledger_entries`.
   - Double-entry ledger postings must satisfy `SUM(DEBIT) === SUM(CREDIT)` strictly.

