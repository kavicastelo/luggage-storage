# Marketplace Payments and Host Payouts

**Project:** Luggage Storage Marketplace (`kavicastelo/luggage-storage`)  
**Document:** `docs/payment-transformation/05-marketplace-payments-and-payouts.md`  
**Initiative:** Payment Infrastructure Transformation  
**Status:** Approved Technical Evaluation  

---

## 1. Marketplace Money Flow & Legal Structure

The Luggage Storage Marketplace operates as a two-sided platform connecting travellers with storage hosts (hotels, shops, cafes, transport hubs):

```text
[ Traveller ]
     │ Pays 100% of Booking Total (e.g. $20.00 USD)
     ▼
[ Platform Account (Merchant of Record) ]
     │
     ├─► Processing Fee (Stripe/PayPal ~3%) ──► Retained by Gateway
     ├─► Platform Commission (15% = $3.00) ──► Retained in Platform Revenue
     └─► Net Host Share (85% = $17.00)     ──► Accrued in Host Settlement Payable (2020)
                                                 │
                                                 ▼
                                        [ Host Payout Settlement ]
```

### Key Business & Financial Invariants:
1. **Merchant of Record:** The Platform legal entity (US Delaware LLC/C-Corp or UK Ltd) is the Merchant of Record for all customer transactions.
2. **Customer Charge:** The platform charges the full booking amount. Hosts do not bill travellers directly.
3. **Escrow / Custody Release:** Funds are unearned until the traveller's luggage is checked out (booking completed).
4. **Commission Deduction:** Platform commission (default 1500 bps / 15.00%) is automatically calculated and deducted before host payable accrual.
5. **Chargeback / Dispute Liability:** As Merchant of Record, the platform bears primary dispute liability with card networks and Stripe/PayPal, but can claw back host payables if a booking is disputed before payout.

---

## 2. Stripe Connect Evaluation

| Model | Mechanics | Suitability for Marketplace |
|---|---|---|
| **Direct Charges** | Customer transacts directly with Host; platform takes application fee. | **Unsuitable.** Requires every host to operate their own Stripe merchant account in a Stripe-supported country. Fails for international hosts in developing markets. |
| **Destination Charges** | Customer pays platform; funds automatically split and transferred to host at capture. | **Unsuitable.** Inflexible for multi-day custody, cancellations, and cross-border host locations. |
| **Separate Charges and Transfers** | Platform collects 100% of funds; transfers net host earnings post-custody completion. | **Recommended Architecture.** Decouples collection from payout; allows platform to hold funds in clearing liability (2010) until booking check-out is finalized. |

### Cross-Border & Multi-Country Realities:
- **US, UK, EU, Canada, Australia Hosts:** Can be onboarded to Stripe Connect Express / Custom for automated direct bank transfers.
- **Sri Lanka Hosts (and countries without native Stripe Connect):**
  - Stripe does **not** currently support domestic bank payouts to Sri Lankan bank accounts.
  - Therefore, the system maintains a **hybrid settlement model**:
    1. Automated Stripe Connect transfers where the host's business country is Stripe-supported.
    2. Batch bank wire / offline local transfer (existing `payout_batches` system with masked account numbers) for Sri Lankan hosts and non-Stripe countries.
  - This avoids promising automated Stripe payouts to hosts in regions where Stripe cannot legally or technically disburse funds.

---

## 3. PayPal Marketplace & Payouts Evaluation

- **Customer Checkout:** Standard PayPal Checkout is universally supported for collecting customer payments into the platform's PayPal Business account.
- **Host Payouts via PayPal:**
  - PayPal offers the **PayPal Payouts API** (sending funds to any PayPal email or phone number in 140+ countries).
  - However, activating PayPal Payouts requires separate business underwriting and credit approval from PayPal.
  - Until PayPal Payouts is commercially approved, host payables for PayPal-paying customers are settled through the existing admin payout batch process.

---

## 4. Ledger & Accounting Integration

When a booking completes:
```text
DEBIT  2010 (Traveller Unearned Booking Liability) : Gross $20.00
CREDIT 2020 (Host Settlement Payable Liability)    : Net   $17.00
CREDIT 4010 (Platform Marketplace Commission)      : Fee   $3.00
```
When the host is paid (via Stripe Connect Transfer or Payout Batch):
```text
DEBIT  2020 (Host Settlement Payable Liability)    : Net   $17.00
CREDIT 1020 (Bank Funds / Gateway Clearing)        : Cash  $17.00
```
This guarantees strict accounting reconciliation regardless of which payment provider processed the traveller's initial charge.

