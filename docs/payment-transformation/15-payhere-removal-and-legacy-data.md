# PayHere Removal and Legacy Data Preservation

**Project:** Luggage Storage Marketplace (`kavicastelo/luggage-storage`)  
**Document:** `docs/payment-transformation/15-payhere-removal-and-legacy-data.md`  
**Initiative:** Payment Infrastructure Transformation  
**Status:** Approved Removal & Preservation Policy  

---

## 1. Scope of PayHere Removal

All active PayHere operational code is permanently retired and eliminated from the codebase:

### 1.1 Dependencies & Native Configurations Removed:
- `@payhere/payhere-mobilesdk-reactnative` dependency in `apps/mobile/package.json`.
- `patches/@payhere__payhere-mobilesdk-reactnative@4.1.0.patch` in `patches/` and `pnpm-workspace.yaml`.
- `apps/mobile/plugins/withPayHereSdk.js` Expo config plugin and reference in `app.json`.
- `apps/mobile/src/types/payhere-mobilesdk-reactnative.d.ts`.
- `apps/mobile/src/lib/payhere-native.ts`.

### 1.2 API Implementation Removed:
- `PayHereGatewayAdapter` active checkout logic and MD5 hashing routines in `payment-gateway.port.ts`.
- Active PayHere webhook route `POST /webhooks/payhere` and HTML handoff route `GET /handoff/:handoffToken`.
- PayHere-specific environment variable declarations and validation in `apps/api/src/config/env.ts`.

### 1.3 Client Application Code Removed:
- PayHere form submission utilities (`buildPayHereCheckoutForm`, `submitPayHereCheckoutForm`) in `apps/web/src/lib/payment-handoff.ts` and `apps/mobile/src/lib/payment-handoff.ts`.
- PayHere-specific UI branches in `CheckoutSchedulePage.tsx` and mobile `checkout.tsx`.

---

## 2. Legacy Data Preservation Guarantee

To satisfy commercial, legal, and financial auditing standards:
1. **Zero Row Deletion:** No historical database records in `payment_intents`, `payment_transactions`, `refund_records`, or `financial_ledger_entries` are deleted or mutated.
2. **Provider Label Retained:** Historical rows continue to store `provider = 'PAYHERE'`. They are not converted or renamed to Stripe/PayPal.
3. **Admin Visibility:** The Super Admin Payment Transactions view and Host Finance summaries continue to display historical PayHere records labeled as `PAYHERE (Legacy)`.
4. **Retired Status:** Any attempt by a client or malicious caller to create a new intent with `provider: "PAYHERE"` is rejected immediately with error `PAYHERE_PROVIDER_RETIRED`.

---

## 3. Repository-Wide Classification Audit

A repository-wide post-removal scan classifies every remaining reference to `PayHere`:

| Classification Category | Allowed? | Purpose / Justification |
|---|---|---|
| **1. Historical financial data support** | **YES** | Preserving `PAYHERE` in database schemas, enums, ledger queries, and admin filters to display historical transactions. |
| **2. Migration compatibility** | **YES** | Retaining migration SQL files (`0015_...`) in git history to ensure reproducible fresh database setup. |
| **3. Historical documentation & audit** | **YES** | Pre-modification audit reports (`docs/payments/*`) documenting past architectural states. |
| **4. Unintended active integration** | **NO (0 Allowed)** | Any active route, SDK import, form submission, or secret usage is completely eliminated. |

