# ADR-008: PayHere as Initial Payment Provider with Provider-Agnostic Payment Abstraction and Manual Superadmin Payouts

- **Status:** Accepted *(with Commercial/Regulatory Validation Tracked in `OQ-003`)*
- **Date:** 2026-11-07
- **Phase:** Phase 0A — Product Architecture & System Foundation
- **Related Documents:** [System Architecture Overview](../system-architecture.md), [Backend Domain Architecture Overview](../backend-domain-overview.md), [Assumptions and Open Questions](../../product/assumptions-and-open-questions.md)

---

## 1. Context

The platform launches initially in **Sri Lanka** and requires secure online payment collection from travellers (`FR -6 Online Payment`), refund support (`FR-10 Cancellation`, `FR -10 Refund Status`), commission deduction (`FR-36`, `FR-38`), and host payout management (`FR-37 Payout Management`).

Importantly:
1. **Approved Initial Gateway:** **PayHere** is the approved payment gateway for the Sri Lankan launch.
2. **Manual Payout Requirement (`FR-37`):** The FRS explicitly specifies under `FR-37 Payout Management`: *"Bank/payment account and payout status - Will do a manual payout through a superadmin dashboard because of security reasons."*
3. **Global Expansion Objective:** The platform will later expand into additional countries that require other payment gateways (e.g., Stripe, Adyen, Razorpay) and potentially automated settlement rails.

---

## 2. Decision

1. **PayHere as Initial Gateway:** We will integrate **PayHere** for initial online payment collection (`FR-6`) across mobile and web.
2. **Provider-Agnostic Payment Port:** All payment gateway operations in the `payments` domain will be isolated behind a strict `PaymentGatewayPort` interface. `PayHereAdapter` will be the first concrete implementation, ensuring `bookings` and `finance` domains have zero direct dependency on PayHere-specific data structures.
3. **Server-Authoritative Webhook Verification:** Bookings will transition to confirmed/paid **only** after the backend verifies the cryptographic MD5/checksum signature of PayHere's server-to-server payment notification (`notify_url`)—never based solely on a client browser/app return redirect.
4. **Internal Financial Ledger & Superadmin Manual Payouts (`FR-37`):**
   - Gross traveller payments are recorded in the platform's internal immutable ledger (`finance` domain).
   - Platform commission and net host earnings are calculated and tracked against the host's balance (`FR-36`, `FR-38`).
   - Host payouts are executed and recorded manually by a **Superadmin** through the Superadmin Web Dashboard (`FR-37`).

---

## 3. Alternatives Considered

1. **Hardcoding PayHere Directly Inside Booking Services:**
   - *Rejected:* Would require rewriting the booking engine when adding Stripe or regional gateways for international expansion.
2. **Automated Real-Time Split Payouts in MVP:**
   - *Rejected:* Directly contradicts `FR-37` (*"Will do a manual payout through a superadmin dashboard because of security reasons"*) and assumes capabilities that standard PayHere merchant accounts do not provide out-of-the-box.

---

## 4. Consequences

### Positive
- **Local Market Fit:** Supports cards (Visa/Mastercard/Amex) and Sri Lankan digital payment methods familiar to local and visiting users.
- **High Financial Security:** Manual Superadmin payout review (`FR-37`) prevents automated payout fraud or premature fund release before luggage check-out (`FR-31`) is verified.
- **Future Multi-Provider Readiness:** Adding a second payment gateway in Phase 11+ requires only implementing a new adapter for `PaymentGatewayPort`.

### Negative / Trade-offs
- Manual payouts create an operational workflow responsibility for the Superadmin team as booking volume grows.

---

## 5. Risks & Mandatory Pre-Launch Validations

- **Commercial & Regulatory Feasibility (`OQ-003` — High Priority):** Standard payment gateway merchant agreements often distinguish between direct merchants and multi-vendor marketplaces holding/settling funds to third-party hosts. Before processing live production funds, the product owner must validate with PayHere (and legal counsel regarding Sri Lankan CBSL payment aggregation rules) that collecting full booking amounts into the platform's PayHere merchant account and disbursing net host earnings manually via bank transfer is commercially and legally approved.
- **Currency & Refund API Constraints (`OQ-008`, `OQ-013`):** Confirm enabled currencies (`LKR`, `USD`, etc.) on the PayHere merchant account and whether refunds (`FR-10`) will use PayHere's Refund API or manual merchant portal execution.

