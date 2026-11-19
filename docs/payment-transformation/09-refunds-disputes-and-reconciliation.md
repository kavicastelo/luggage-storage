# Refunds, Disputes and Financial Reconciliation

**Project:** Luggage Storage Marketplace (`kavicastelo/luggage-storage`)  
**Document:** `docs/payment-transformation/09-refunds-disputes-and-reconciliation.md`  
**Initiative:** Payment Infrastructure Transformation  
**Status:** Approved Operational Specification  

---

## 1. Automated Refund Processing

Unlike the legacy PayHere workflow (which required manual portal execution and administrative attestation), the Stripe and PayPal integrations provide **automated, programmatic refund execution**:

```text
Cancellation Triggered (Traveller / Host / Admin)
                      │
                      ▼
            Calculate Refund Policy
                      │
      ┌───────────────┴───────────────┐
      ▼                               ▼
Standard Policy Refund          Exceptional / Admin Review
(Automated Dispatch)            (MANUAL_REVIEW_REQUIRED)
      │                               │
      ▼                               ▼
Call provider.createRefund()    Admin Review via Portal
      │
      ├─► Stripe: stripe.refunds.create()
      └─► PayPal: payments/captures/{id}/refund
      │
      ▼
Update refund_records: status = 'SUCCEEDED', settlement_mode = 'PROVIDER_CONFIRMED'
Update payment_transactions: insert transaction_type = 'REFUND'
Update ledger: recordRefundDisbursed (DR 2010 / 2030, CR 1010)
```

### Cancellation Refund Policy Matrix:
| Trigger | Timing | Refund % | Execution Mode |
|---|---|---|---|
| **Traveller Cancellation** | $\ge 2$ hours before drop-off | 100% | Fully Automated (Stripe/PayPal API) |
| **Traveller Cancellation** | $< 2$ hours before drop-off | 50% or 0% | Automated per location policy |
| **Host Cancellation** | Any time prior to check-in | 100% | Fully Automated + Host Penalty Flag |
| **Orphaned Succeeded** | Webhook settled after hold expired & no capacity | 100% | Fully Automated |
| **Dispute Resolution** | Post-storage claim | Variable | Admin Authorized |

---

## 2. Dispute and Chargeback Management

When a customer files a dispute with their bank or card issuer:
1. **Webhook Notification:**
   - Stripe emits `charge.dispute.created`.
   - PayPal emits `CUSTOMER.DISPUTE.CREATED`.
2. **System Response:**
   - Booking status is updated to `DISPUTED`.
   - Any associated unbatched host earnings in `host_payables` are immediately updated to `ON_HOLD`.
   - A security audit event `PAYMENT_DISPUTE_FLAGGED` is recorded.
   - Admin alert is surfaced on the Super Admin Payment & Finance dashboard.
3. **Dispute Resolution:**
   - If won: host payable is restored to `ELIGIBLE`, booking status to `COMPLETED`.
   - If lost: double-entry clawback entry is posted to the ledger, and host payable is marked `CANCELLED_CLAWBACK`.

---

## 3. Financial Reconciliation & Audit Logging

- **Daily Transaction Reconciliation:**
  - Automated reconciliation query compares internal `payment_transactions` against settled `financial_ledger_entries`.
  - Invariant checked:
    $$\sum \text{Charges} - \sum \text{Refunds} = \text{Balance of Account 1010 (Gateway Clearing Receivable)}$$
- **Provider Reference Traceability:**
  - Every transaction records `providerTransactionId` (Stripe `ch_...` / `pi_...`, PayPal `capture_id`).
  - No synthetic or fabricated references are ever accepted for `PROVIDER_CONFIRMED` settlements.

