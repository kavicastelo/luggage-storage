# Admin Payment Configuration

**Project:** Luggage Storage Marketplace (`kavicastelo/luggage-storage`)  
**Document:** `docs/payment-transformation/11-admin-payment-configuration.md`  
**Initiative:** Payment Infrastructure Transformation  
**Status:** Approved Technical Specification  

---

## 1. Overview & RBAC Controls

The Super Admin portal provides governance and monitoring over payment provider statuses without requiring code deployments for operational toggles:

- **Required RBAC Permissions:** `SYSTEM_PERMISSIONS.SETTINGS_MANAGE` and `SYSTEM_PERMISSIONS.FINANCE_MANAGE`.
- **Zero-Secret Exposure:** Secret keys (`STRIPE_SECRET_KEY`, `PAYPAL_CLIENT_SECRET`, `STRIPE_WEBHOOK_SECRET`) are **never** returned in API responses, rendered in HTML, or logged.

---

## 2. Admin Provider Overview Model

```text
Payment Providers Configuration & Status

[ Stripe Primary ]
  Status: Active (Test Mode)
  Supported Currencies: USD, EUR, GBP, LKR, AUD, CAD, SGD, JPY
  Webhook Endpoint: https://api.domain/api/v1/payments/webhooks/stripe
  Webhook Status: Verified (Last received: 2m ago)
  Publishable Key: pk_test_***4A8b
  Capabilities: Card, Apple Pay, Google Pay, Automated Refunds

[ PayPal Alternative ]
  Status: Active (Sandbox Mode)
  Supported Currencies: USD, EUR, GBP, AUD, CAD
  Webhook Endpoint: https://api.domain/api/v1/payments/webhooks/paypal
  Webhook Status: Verified (Last received: 15m ago)
  Client ID: Ac_***98xZ
  Capabilities: PayPal Wallet, Credit, Automated Refunds

[ Legacy Archive: PayHere ]
  Status: Retired (Read-Only)
  Active Intents: 0
  Historical Records: Preserved in Ledger & Audit Log
```

---

## 3. Audit Logging
Every administrative query or configuration update triggers a secure audit record in `security_audit_events`:
- Event Types: `PAYMENT_CONFIG_VIEWED`, `PAYMENT_CONFIG_UPDATED`.
- Actor: Admin user ID, IP address, user agent, correlation ID.
- Invariant: Non-superadmin users are denied access with HTTP 403 Forbidden.

