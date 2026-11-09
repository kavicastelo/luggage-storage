# Phase 2B.1 — Product Decisions Required & Open Architectural Questions
## Document 16: Product Decisions Required

**Project:** Global Luggage Storage Marketplace (`https://github.com/kavicastelo/luggage-storage`)  
**Document ID:** `DOC-UX-P2B-016`  
**Audit Phase:** Phase 2B.1 — Handover Package  
**Current HEAD:** `cca134f4a0f909a907f6395f9647a025ac39d71a`  
**Date:** November 9, 2026  
**Auditor:** Principal Product Architect & Senior UX Auditor  
**Target Audience:** Product Owner, Executive Stakeholders, Lead System Architect  

---

### 1. Executive Summary & Purpose

During the Phase 2B audit and codebase reconciliation, ten fundamental product, business, and legal assumptions were identified within the simulated prototypes and proposed design system. These assumptions directly impact user flows, liability, database schemas, and engineering scope for **Phase 2C — Product Experience Re-Architecture**.

This document isolates each open decision, evaluates trade-offs, provides the audit team's professional recommendation, and establishes a formal sign-off register.

---

### 2. Comprehensive Product Decisions Register

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                           TEN CRITICAL PRODUCT DECISIONS                                  │
├───────────────┬──────────────────────────────────────────┬──────────────┬────────────────┤
│ Decision ID   │ Core Subject                             │ Impact Area  │ Priority       │
├───────────────┼──────────────────────────────────────────┼──────────────┼────────────────┤
│ DEC-001       │ Mandatory vs Optional Photo Evidence     │ Custody / UX │ Block P0 Flow  │
│ DEC-002       │ Overdue Fee Payment Collection Channel   │ Payments     │ Block P0 Flow  │
│ DEC-003       │ Cancellation Gateway Fee Absorption      │ Finance      │ Block P1 Flow  │
│ DEC-004       │ Apple / Google Wallet MVP Scope          │ Mobile UX    │ Scoping P1     │
│ DEC-005       │ Offline Digital Pass Cryptographic TTL   │ Security     │ Security P0    │
│ DEC-006       │ Host Payout Schedule & Minimum Threshold │ Operations   │ Finance P1     │
│ DEC-007       │ Tamper-Evident Physical Seal Sourcing    │ Logistics    │ Custody P1     │
│ DEC-008       │ Mascot Tone & Dispute Boundary Policy    │ Brand / Legal│ Brand P1       │
│ DEC-009       │ "Ceylon Warmth" Palette Formal Adoption  │ Design Sys   │ Design P0      │
│ DEC-010       │ Partner Trust Badge & Amenity Taxonomy   │ Compliance   │ Marketing P1   │
└───────────────┴──────────────────────────────────────────┴──────────────┴────────────────┘
```

---

#### Decision `DEC-001`: Drop-off Photo Evidence Enforcement

- **Context & Current Prototype:** Screen `HM-014` and `TM-029` simulate taking photos of luggage tags and bags at check-in. Current micro-copy states "Photo evidence is mandatory before check-in can be confirmed."
- **Problem:** In busy hotel lobbies or transit shops with poor lighting or legacy host devices, requiring 3–4 high-resolution photo uploads per booking causes severe check-in queue delays and failures under spotty cellular connectivity.
- **Options:**
  - **Option A (Strict Mandatory):** Both host and traveller must capture and upload photo evidence before custody token changes from `CONFIRMED` to `ACTIVE_STORAGE`. Check-in is blocked without photos.
  - **Option B (Recommended Default with Host Override):** Host is strongly prompted to photograph bags with pre-existing damage, but can bypass with a 1-tap toggle: *"No visible damage / Host verified"*.
  - **Option C (Traveller-Only Optional):** Traveller can upload photos in their portal (`PW-011`/`TM-029`) at leisure for insurance documentation; host counter flow is unaffected.
- **UX Audit Recommendation:** **Option B.** Protects queue velocity at busy partner desks while capturing photo evidence for high-value or damaged items.
- **Engineering Impact:** Option B requires offline queueing in IndexedDB / SQLite with background image compression and upload retry workers.
- **Owner & Status:** Product Owner • **PENDING SIGN-OFF**

---

#### Decision `DEC-002`: Overdue / Late Storage Fee Payment Collection

- **Context & Current Prototype:** Screen `HM-023` and `TM-030` simulate luggage remaining past the booked collection window, accumulating overdue fees ($150\%$ hourly penalty rate per rule `PR-014`).
- **Problem:** How and where does the marketplace actually collect these accrued fees?
- **Options:**
  - **Option A (In-App Auto-Capture):** Host clicks "Release", API calculates total overdue fee and automatically charges the traveller's saved credit card on file via Stripe/PayHere off-session payment intent.
  - **Option B (Cash at Counter):** Host collects overdue cash fee directly from the traveller; host marks "Cash Collected" in `HM-024`; platform deducts its $15\%$ platform commission from the host's next payout.
  - **Option C (Pre-Payment Gate):** Traveller mobile pass displays a red alert *"Storage Expired — Tap to Settle Balance"*. Pass QR code is locked/invalid until traveller completes in-app payment.
- **UX Audit Recommendation:** **Option A with Option C fallback.** Option B introduces cash leakage and counter disputes. Auto-charging saved cards is standard for ride-sharing and micro-mobility.
- **Engineering Impact:** Requires Stripe Customer ID persistence, off-session payment authorization agreements during initial checkout (`PW-004`), and webhook listeners for charge settlement.
- **Owner & Status:** Product Owner & Payments Lead • **PENDING SIGN-OFF**

---

#### Decision `DEC-003`: Cancellation Refund Gateway Fee Absorption

- **Context & Current Prototype:** Screen `PW-011` and `AD-007` simulate a 7-stage refund stepper. Rule `PR-016` specifies full refund if cancelled $>2$ hours prior to booking start time.
- **Problem:** Payment gateways (Stripe, PayHere) do not refund the initial transaction processing fee (approx. $2.9\% + \$0.30$) upon issuing a customer refund.
- **Options:**
  - **Option A (Platform Absorbs):** Customer receives $100\%$ of their booking payment back. Marketplace absorbs payment gateway processing loss as customer acquisition cost.
  - **Option B (Net Refund):** Customer receives refund minus gateway processing fee ($100\% - 3.5\%$). Disclosed in checkout terms.
  - **Option C (Platform Credit):** Offer $100\%$ refund as non-expiring Luggage Storage Platform Credit, or $95\%$ if refunded to original payment method.
- **UX Audit Recommendation:** **Option A for cancellations $>24$h; Option B or C for $<24$h.** Reduces customer support disputes and chargebacks.
- **Engineering Impact:** Financial ledger (`AD-006`, `HD-010`) must record gateway fee expense lines separately from platform gross revenue.
- **Owner & Status:** Product Owner & Finance Director • **PENDING SIGN-OFF**

---

#### Decision `DEC-004`: Digital Pass Apple Wallet & Google Wallet Integration Scope

- **Context & Current Prototype:** Design System Document `DOC-UX-P2B-010` proposes *"Add to Apple Wallet"* and *"Save to Google Wallet"* CTA buttons on `PW-005` and `TM-024`.
- **Problem:** Native passbook provisioning requires Apple Developer Pass Type IDs, cryptographic pass signing keys (.pkpass certificates), and Google Wallet REST API service accounts.
- **Options:**
  - **Option A (Full Native Pass Provisioning in Phase 2C):** Implement backend PKPass generation and Google Wallet JWT passes.
  - **Option B (Deferred to Phase 3+):** Keep custody pass within the web portal (`PW-005`/`PW-011`) and mobile apps (`TM-024`); omit native wallet CTA buttons from Phase 2C UI.
  - **Option C (Client-Side PWA Pass):** Provide an offline-cached PWA pass card with "Save Image / Screenshot" or PDF download.
- **UX Audit Recommendation:** **Option B.** Native wallet passes are a valuable convenience but premature for Phase 2C MVP experience re-architecture. Remove wallet CTA buttons from Phase 2C mockups to prevent false expectations.
- **Engineering Impact:** Saves approximately 80 engineering hours in backend certificate management and mobile PassKit bridge plugins.
- **Owner & Status:** Lead System Architect & Product Owner • **PENDING SIGN-OFF**

---

#### Decision `DEC-005`: Offline Digital Pass Cryptographic Security & QR TTL

- **Context & Current Prototype:** Screen `TM-024` renders a static simulated QR payload and PIN `482910`. The audit requires resilient offline display for travellers without international mobile roaming.
- **Problem:** If a QR pass is cached offline on the traveller's device, how does the system prevent replay attacks or fraudulent screenshots while allowing offline verification by the host?
- **Options:**
  - **Option A (Static Signed JWT with PIN):** QR contains a tamper-proof HMAC-signed payload containing `bookingId`, `bagCount`, `dropoffDate`, and `secretHash`. Host app verifies signature either online via API or offline via daily partner public key. Monospace 6-digit PIN acts as secondary verification.
  - **Option B (Rotating TOTP QR Code):** QR code changes every 60 seconds (like Google Authenticator). Requires clock sync between devices; completely blocks offline screenshot fraud.
  - **Option C (Simple Reference String):** QR code is merely a URL link to `https://luggage.app/v/:bookingId`. Host scanner opens web page. Fails completely if host is offline.
- **UX Audit Recommendation:** **Option A.** Best balance of offline reliability, cryptographic security, and human-readable counter fallback.
- **Engineering Impact:** Defined in contracts package; host scanner parses and verifies HMAC payload offline.
- **Owner & Status:** Security Architect • **PENDING SIGN-OFF**

---

#### Decision `DEC-006`: Host Payout Schedule Automation & Thresholds

- **Context & Current Prototype:** Screen `HD-010`, `HD-011`, and `AD-008` simulate finance ledgers and batch payout distributions.
- **Problem:** Automated micro-payouts for single bookings incur high banking fees. A clear payout cadence and minimum payout threshold must be established.
- **Options:**
  - **Option A (Weekly Scheduled Batch):** All cleared earnings from Monday through Sunday are batched and disbursed every Tuesday at 00:00 UTC. Minimum threshold: \$50 / LKR 15,000.
  - **Option B (On-Demand Host Withdrawal):** Host can request payout at any time once balance exceeds \$25, subject to a 24-hour security hold and a nominal withdrawal fee.
  - **Option C (Manual Superadmin Approval):** Superadmin manually reviews and approves each payout in `AD-008`.
- **UX Audit Recommendation:** **Option A.** Standard for two-sided marketplaces (Airbnb, Uber); predictable cash flow forecasting and minimal bank transaction fees.
- **Engineering Impact:** Automated scheduled worker in `apps/api` using Node cron / BullMQ queue.
- **Owner & Status:** Finance Director & Product Owner • **PENDING SIGN-OFF**

---

#### Decision `DEC-007`: Tamper-Evident Physical Security Seal Sourcing & Workflow

- **Context & Current Prototype:** Screens `TM-028`, `HM-022`, and rule `PR-012` reference entering a "Tamper-Evident Security Seal Tag Number" (e.g. `#SL-88410`) at bag intake.
- **Problem:** Who supplies these physical numbered plastic zip-seals, and is seal entry mandatory for every single bag?
- **Options:**
  - **Option A (Platform Supplies Branded Seals):** Marketplace ships an onboard pack of 200 branded numbered zip-seals to newly approved hosts during KYC onboarding (`AD-002`). Seal tag barcode scanning is mandatory.
  - **Option B (Host-Provided Commercial Seals):** Hosts purchase standard commercial numbered luggage seals; input tag serial number into `HM-022`.
  - **Option C (Digital Photo Seal Fallback):** Physical seals are optional; host takes a close-up photo of the bag's zipper closure with a printed paper baggage tag if plastic seals are unavailable.
- **UX Audit Recommendation:** **Option A for certified partners; Option C fallback.** The physical seal is the single greatest psychological differentiator for traveller trust.
- **Engineering Impact:** Host onboarding flow (`HD-002`, `AD-002`) must capture physical mailing address for starter kit fulfillment.
- **Owner & Status:** Head of Operations • **PENDING SIGN-OFF**

---

#### Decision `DEC-008`: Mascot Brand Voice Boundary Policy (Kiri the Palm Squirrel)

- **Context & Current Prototype:** Screen `AD-013` currently renders mascot Kiri shrugging in the middle of a serious customer dispute adjudication dashboard. Mascot images appear indiscriminately across internal and public screens.
- **Problem:** Using a cute cartoon mascot in legal, financial loss, dispute, or security contexts undermines institutional trust and inflames frustrated users.
- **Policy Definition (Proposed):**
  - **Approved Mascot Surfaces:**
    - Marketing & Public Web Landing (`PW-001`, `PW-006`, `PW-010`).
    - Onboarding & Success Empty States (`TM-002`, `HM-001`, `PW-005`).
    - Customer Celebration Moments (Booking complete, Bags safely returned, Review submitted).
    - Helpful educational tooltips (e.g. explaining bag size categories).
  - **Strictly Prohibited Mascot Surfaces:**
    - Payment failure, card decline, or banking gateway errors (`PW-004`, `TM-020`).
    - Customer disputes, stolen/damaged luggage claims, and incident filings (`AD-013`, `TM-035`, `HM-037`).
    - Security settings, password resets, and 2FA authentication screens (`VerifyEmailPage`, `SecuritySettingsPage`).
    - Superadmin operational, compliance, and audit log consoles (`AD-001` through `AD-018`).
- **UX Audit Recommendation:** **Adopt the proposed policy immediately as an immutable design rule for Phase 2C.**
- **Engineering Impact:** Update `MascotIllustration` component with variant linting and surface restriction props.
- **Owner & Status:** Product Owner & Brand Lead • **PENDING SIGN-OFF**

---

#### Decision `DEC-009`: Formal Approval of "Ceylon Warmth & Coastal Precision" Palette

- **Context & Current Prototype:** Proposed in `DOC-UX-P2B-010` featuring Coastal Navy (`#0A192F`), Ceylon Terracotta (`#E86F2C`), and Sunlit Sand (`#FAF8F5`).
- **Problem:** Current screens mix cold slate grays (`#0F172A`), harsh purple gradients, and high-saturation blues without a cohesive design token system.
- **Options:**
  - **Option A (Approve Proposed CWCP Palette):** Adopt `#0A192F` and `#E86F2C` as official brand tokens; build shared Tailwind token package in `packages/ui`.
  - **Option B (Standard Tech Palette):** Retain neutral Tailwind Slate/Indigo palette (similar to standard SaaS templates).
  - **Option C (Commission External Brand Agency):** Defer color token standardization until an external agency delivers complete corporate identity guidelines.
- **UX Audit Recommendation:** **Option A.** The CWCP palette directly harmonizes with the pre-existing Kiri mascot asset hues (Kiri's fur is terracotta, Kiri's satchel is navy). Delaying tokens blocks Phase 2C component creation.
- **Engineering Impact:** Establishes Tailwind theme configuration and CSS custom properties across `apps/web` and `apps/mobile`.
- **Owner & Status:** Product Owner • **PENDING SIGN-OFF**

---

#### Decision `DEC-010`: Partner Trust Badge Taxonomy & Verification Criteria

- **Context & Current Prototype:** Location cards in `PW-002` and `TM-015` display a pill badge labeled "Verified Hotel Vault".
- **Problem:** What physical storage types exist in the marketplace, and what verification steps grant each badge?
- **Proposed Taxonomy:**
  1. `Verified Hotel Vault` (24/7 front desk, dedicated locked luggage room, physical security guard).
  2. `Verified Retail Partner` (Commercial retail store, monitored storage area behind counter).
  3. `Verified Transit Hub` (Dedicated luggage storage facility adjacent to train station or airport).
- **UX Audit Recommendation:** Adopt the three-tier taxonomy. Restrict badge rendering to hosts who have completed KYC document verification in `AD-002`.
- **Engineering Impact:** Add `storage_facility_type` enum to database schema and listing editor (`HD-003`).
- **Owner & Status:** Head of Operations & Product Owner • **PENDING SIGN-OFF**

---

### 3. Summary Sign-Off Register

| Decision ID | Summary Topic | Audit Recommendation | Stakeholder Assigned | Status |
|---|---|---|---|:---:|
| `DEC-001` | Photo Evidence Policy | Option B (Host override on undamaged bags) | Product Owner | PENDING |
| `DEC-002` | Overdue Fee Channel | Option A (Auto-charge saved payment card) | Payments Lead | PENDING |
| `DEC-003` | Refund Gateway Fees | Option A ($>24$h full refund; $<24$h net) | Finance Director | PENDING |
| `DEC-004` | Apple/Google Wallet | Option B (Deferred to Phase 3+; remove UI) | System Architect | PENDING |
| `DEC-005` | Offline Pass Security | Option A (Signed JWT + Monospace PIN) | Security Architect | PENDING |
| `DEC-006` | Payout Cadence | Option A (Weekly Tuesday batch; \$50 min) | Finance Director | PENDING |
| `DEC-007` | Security Seals | Option A (Platform ships 200 seals on KYC) | Operations Head | PENDING |
| `DEC-008` | Mascot Tone Boundary | Strict prohibition in disputes/errors/admin | Brand Lead | PENDING |
| `DEC-009` | CWCP Color Tokens | Option A (Adopt CWCP tokens immediately) | Product Owner | PENDING |
| `DEC-010` | Trust Badge Taxonomy | 3-tier taxonomy linked to KYC approval | Operations Head | PENDING |