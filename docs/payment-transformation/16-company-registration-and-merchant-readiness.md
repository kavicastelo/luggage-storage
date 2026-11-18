# Company Registration and Merchant Readiness

**Project:** Luggage Storage Marketplace (`kavicastelo/luggage-storage`)  
**Document:** `docs/payment-transformation/16-company-registration-and-merchant-readiness.md`  
**Initiative:** Payment Infrastructure Transformation  
**Status:** Approved Technical Readiness Guide  

---

## 1. Executive Context

The business intends to operate internationally. Primary corporate formation is planned in either the **United States (Delaware LLC / C-Corp)** or the **United Kingdom (Private Limited Company)**, with potential subsidiary registration in Sri Lanka for local operations.

This document outlines the merchant account prerequisites, corporate documentation requirements, banking structure, and cross-border considerations necessary before switching from Stripe/PayPal test modes to live payment processing.

---

## 2. US vs UK Legal Entity Evaluation

| Dimension | United States (e.g. Delaware LLC) | United Kingdom (Private Limited Company) |
|---|---|---|
| **Stripe Eligibility** | Full native support (Stripe US). Access to all global payment methods, Apple Pay, Google Pay, Affirm, Klarna. | Full native support (Stripe UK). Access to UK Bacs, SEPA, Cards, Apple Pay, Google Pay. |
| **PayPal Eligibility** | Full PayPal Business US support. Access to PayPal Complete Payments. | Full PayPal Business UK support. |
| **Corporate Requirements** | Certificate of Formation, EIN (Employer Identification Number), Registered Agent in Delaware, Operating Agreement. | Certificate of Incorporation (Companies House), UTR (Unique Taxpayer Reference), UK Registered Office, Articles of Association. |
| **Banking Setup** | US Business Bank Account (e.g. Mercury, Brex, Relay, or traditional bank). | UK Business Bank Account (e.g. Wise Business, Airwallex, Revolut Business, or Barclays/HSBC). |
| **Beneficial Ownership** | Passport & address verification for all individuals owning $\ge 25\%$ of equity. | Verification of Persons with Significant Control (PSC) on Companies House. |
| **Tax / Marketplace Laws** | US State Sales Tax Marketplace Facilitator laws apply based on economic nexus. | UK VAT registration required once taxable turnover exceeds £90,000 threshold (or voluntary). |

---

## 3. Merchant Onboarding Checklist

### 3.1 Stripe Account Setup:
- [ ] Legal Business Name matching corporate formation documents.
- [ ] Registered Tax ID (EIN in US / Company Number & UTR in UK).
- [ ] Operating Website URL showing active service, terms of service, cancellation/refund policy, and customer support contact.
- [ ] Business Bank Account in corporate name for settlement payouts.
- [ ] Identity verification (Passport / Government ID) for company directors.
- [ ] Two-Factor Authentication (2FA) enforced on all administrative Stripe users.

### 3.2 PayPal Business Setup:
- [ ] PayPal Business Account opened under exact corporate name.
- [ ] Corporate resolution / proof of operating address uploaded.
- [ ] Business bank account linked and verified via micro-deposits.
- [ ] Webhook URL registered in PayPal Developer Portal for production events.

---

## 4. Multi-Currency & Cross-Border Payout Strategy

### Customer Collection:
- Platform charges travellers in their preferred currency (`USD`, `EUR`, `GBP`, `LKR`, `AUD`, `CAD`, `SGD`, `JPY`).
- Stripe automatically converts non-settlement currencies to the platform's primary settlement currency (e.g. USD) at competitive mid-market rates.

### Host Disbursements:
- **Eligible Stripe Connect Countries:** Direct bank transfers via Stripe Connect Express.
- **Sri Lanka & Non-Stripe Markets:** Payouts proceed via established local bank wire batches (`payout_batches`) until local Stripe Connect or PayPal Payouts approval is secured.

---

## 5. Live Activation Status Matrix

| Component | Status | Readiness Note |
|---|---|---|
| **Stripe Payment Engine** | **Implemented & Tested** | Fully operational in test mode with mock and live-ready endpoints. |
| **PayPal Payment Engine** | **Implemented & Tested** | Fully operational in sandbox mode with Orders v2. |
| **Company Incorporation** | **Pending Owner Action** | Delaware LLC or UK Ltd incorporation in progress. |
| **Business Bank Account** | **Pending Owner Action** | Required for connecting live Stripe/PayPal bank feeds. |
| **Live API Key Activation** | **Locked (Safe)** | System fails closed until valid `sk_live_...` and live webhook secrets are provisioned. |

