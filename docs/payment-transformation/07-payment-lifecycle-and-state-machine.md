# Payment Lifecycle and State Machine

**Project:** Luggage Storage Marketplace (`kavicastelo/luggage-storage`)  
**Document:** `docs/payment-transformation/07-payment-lifecycle-and-state-machine.md`  
**Initiative:** Payment Infrastructure Transformation  
**Status:** Approved Technical State Machine  

---

## 1. Payment Intent State Machine

```mermaid
stateDiagram-v2
    [*] --> INITIATED : POST /api/v1/payments/intents
    INITIATED --> PENDING_GATEWAY : Customer redirected / Elements loaded
    INITIATED --> EXPIRED : TTL expires (15m) or superseded
    PENDING_GATEWAY --> SUCCEEDED : Verified Webhook (Stripe/PayPal/Sandbox)
    PENDING_GATEWAY --> FAILED : Payment declined or cancelled
    PENDING_GATEWAY --> EXPIRED : Hold expires before payment
    PENDING_GATEWAY --> ORPHANED_SUCCEEDED : Late webhook after capacity release
    SUCCEEDED --> [*]
    FAILED --> INITIATED : Customer retries with new/same intent
    EXPIRED --> [*]
    ORPHANED_SUCCEEDED --> [*] : Auto-flagged for refund
```

### Transition Invariants:
1. **Single Active Intent:** Only one intent in `('INITIATED', 'PENDING_GATEWAY')` can exist per booking at any time. When switching providers (e.g. from Stripe to PayPal), previous active intents are transitioned to `EXPIRED`.
2. **Deterministic Settlement:** Only a cryptographically verified webhook (or authenticated sandbox simulator) can transition an intent to `SUCCEEDED`.
3. **Capacity Check on Settlement:** If a payment succeeds after the 15-minute hold expires, capacity is re-checked. If available, booking confirms; if unavailable, intent moves to `ORPHANED_SUCCEEDED` and automatically schedules a full refund.

---

## 2. Booking State Machine Alignment

```text
[ DRAFT ]
    │
    ▼ Traveller submits booking dates & baggage
[ PENDING_PAYMENT ] ──(Capacity held for 15 minutes)──
    │                                                 │
    ├─► Payment Succeeds (Webhook verified)           ├─► Hold Expires (15m)
    ▼                                                 ▼
[ CONFIRMED ]                                   [ CANCELLED / EXPIRED ]
    │ (Unlocks Custody Pass: QR & PIN)
    ▼ Host scans QR -> Check-in
[ IN_STORAGE ]
    │
    ▼ Host scans QR -> Check-out
[ COMPLETED ]
    │
    ├─► Host Payable marked ELIGIBLE
    └─► Double-entry revenue & payable recorded
```

---

## 3. Refund State Machine (7-Stage OQ-013 Model)

```mermaid
stateDiagram-v2
    [*] --> REQUESTED : Traveller / Host / Admin initiates refund
    REQUESTED --> AUTHORIZED : Admin / Policy validates eligibility
    REQUESTED --> MANUAL_REVIEW_REQUIRED : High-risk or policy exception
    AUTHORIZED --> INITIATED : Dispatched to Stripe / PayPal API
    INITIATED --> PROCESSING : Gateway returns pending status
    INITIATED --> SUCCEEDED : Gateway confirms immediate refund
    PROCESSING --> SUCCEEDED : Webhook confirms refund cleared
    PROCESSING --> FAILED : Gateway reports refund failed
    FAILED --> MANUAL_REVIEW_REQUIRED : Admin intervention
    SUCCEEDED --> [*]
```

### Automated Gateway Dispatch:
- When a refund is `AUTHORIZED`, the service calls `adapter.createRefund()`.
- Stripe and PayPal execute refunds immediately via API.
- Upon receiving a successful gateway response with `providerRefundId`, status transitions directly to `SUCCEEDED` with `settlementMode = 'PROVIDER_CONFIRMED'`.

