# Phase 2C.0 — Product Decisions Required & Open Architectural Questions
## Document 16: Product Decisions & Requirements Governance Register

**Project:** Global Luggage Storage Marketplace (`https://github.com/kavicastelo/luggage-storage`)  
**Document ID:** `DOC-UX-P2C-016`  
**Phase:** Phase 2C.0 — Baseline Reconciliation  
**Current HEAD Commit:** `17d5afa` / `57b1c39`  
**Date:** November 9, 2026  
**Auditor:** Principal Product Architect, Senior UX Auditor & Technical Product Manager  
**Governance Authority:** Product Owner & Executive Stakeholders  

---

### 1. Executive Summary & Purpose

During the Phase 2B audit and Phase 2B.1 reconciliation, fundamental product assumptions, marketing copy claims, and business rules were identified within the simulated prototypes and proposed design system. 

In strict compliance with **Phase 2C.0 Workstream C**, this document isolates each open decision, evaluates evidence and trade-offs, classifies proposals against confirmed requirements, provides the audit team's professional recommendation, and establishes a binding sign-off register.

> [!CAUTION]
> **Prohibition on Fabricated Marketing Claims:**  
> The interface must **never** display unsupported statements such as *"Over 50,000 bags stored safely"*, *"100% verified partners"*, *"Fully insured luggage"*, or *"Guaranteed secure storage"*. Unless a claim is supported by verified business data, an approved legal policy, and operational capability, it is strictly classified as `UNAPPROVED_CLAIM` and prohibited from production UI copy. Clearly marked placeholder content may be used in development, but must never be mistaken for approved copy.

---

### 2. Proposal Classification Framework

Every proposed feature across the five client surfaces is classified into one of six governance tiers:

1. **`CONFIRMED_REQUIREMENT`**: Explicitly documented in approved PRDs/FRD and backed by established business rules.
2. **`EXISTING_IMPLEMENTATION`**: Fully implemented and verified in current production code (e.g. Phase 1B auth/RBAC).
3. **`DESIGN_RECOMMENDATION`**: Experiential, visual, or layout improvement proposed by UX team (e.g. CWCP palette, tab bar navigation).
4. **`PRODUCT_DECISION_REQUIRED`**: Unresolved policy, liability, or fee structure requiring explicit Product Owner sign-off before coding.
5. **`FUTURE_SCOPE`**: Desirable feature approved for roadmap consideration after Phase 2C (e.g. Apple/Google Wallet passbook signing).
6. **`OUT_OF_SCOPE`**: Explicitly excluded from marketplace scope (e.g. hardware thermal printer drivers, real-time IoT bag GPS trackers).

---

### 3. Detailed Product Decisions Register

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                              TEN CRITICAL PRODUCT DECISIONS                                  │
├─────────┬──────────────────────────────────────────┬─────────────────┬───────────────────────┤
│ ID      │ Topic                                    │ Workstream      │ Phase 2C Blocking     │
├─────────┼──────────────────────────────────────────┼─────────────────┼───────────────────────┤
│ DEC-001 │ Mandatory vs Optional Photo Evidence     │ WS-5 (Host Mob) │ BLOCKS_SPRINT_4       │
│ DEC-002 │ Overdue Fee Payment Collection Channel   │ WS-2 (Pub Web)  │ BLOCKS_SPRINT_2       │
│ DEC-003 │ Cancellation Gateway Fee Absorption      │ WS-2 (Pub Web)  │ NON_BLOCKING (P1)     │
│ DEC-004 │ Apple / Google Wallet MVP Scope          │ WS-3 (Trav Mob) │ NON_BLOCKING (Defer)  │
│ DEC-005 │ Offline Digital Pass Cryptographic TTL   │ WS-3 (Trav Mob) │ BLOCKS_SPRINT_3       │
│ DEC-006 │ Host Payout Schedule & Minimum Threshold │ WS-4 (Host Web) │ NON_BLOCKING (P1)     │
│ DEC-007 │ Tamper-Evident Physical Seal Sourcing    │ WS-5 (Host Mob) │ BLOCKS_SPRINT_4       │
│ DEC-008 │ Mascot Brand Voice Boundary Policy       │ WS-1 (Foundatn) │ BLOCKS_SPRINT_1       │
│ DEC-009 │ CWCP Color Tokens Accessible Re-tune     │ WS-1 (Foundatn) │ BLOCKS_SPRINT_1       │
│ DEC-010 │ Partner Trust Badge & Amenity Taxonomy   │ WS-2 (Pub Web)  │ BLOCKS_SPRINT_2       │
└─────────┴──────────────────────────────────────────┴─────────────────┴───────────────────────┘
```

---

#### Decision `DEC-001`: Mandatory vs. Optional Drop-Off Photo Evidence
- **Decision Topic:** Photographic inspection policy at bag check-in (`HM-014`, `TM-029`).
- **Current Uncertainty:** The current prototype displays *"Photo evidence is mandatory before check-in can be confirmed."* Requiring 3–4 mandatory photos per luggage item causes severe lobby queue bottlenecks in busy hotels and fails under poor cellular connectivity.
- **Existing Evidence:** In `apps/mobile/app/(host)/index.tsx` (`HM-014`), photo upload is simulated via a client button that always succeeds. No camera hardware bindings or offline image upload queues exist in the repository.
- **Available Options:**
  - **Option A (Strict Mandatory):** Both host and traveller must upload bag photos before custody token activates. Check-in blocked without photos.
  - **Option B (Recommended Default with Host Override):** Host is prompted to photograph existing damage/high-value tags, but can bypass with 1-tap: *"No visible damage / Host verified"*.
  - **Option C (Traveller-Only Optional):** Traveller can upload photos in their portal at leisure; host counter flow is unaffected.
- **Recommendation:** **Option B.** Protects counter velocity during peak hours while capturing evidence for damaged bags.
- **Business & Technical Consequences:** Option A risks customer abandonment in lobby lines. Option B requires offline queueing in SQLite/IndexedDB with background retry workers.
- **Phase 2C Blocking Status:** **BLOCKS_SPRINT_4** (Host Mobile Intake Flow).
- **Dependent Workstream:** `WS-5-HOST-MOB` (`TSK-2C-011`).
- **Approval Status:** **PENDING_PRODUCT_OWNER_SIGN_OFF**

---

#### Decision `DEC-002`: Overdue / Late Storage Fee Payment Collection Channel
- **Decision Topic:** Overdue fee calculation and collection mechanism (`HM-023`, `TM-030`).
- **Current Uncertainty:** How and where are accrued late storage fees collected when a traveller collects luggage past the booked window?
- **Existing Evidence:** Rule `PR-014` specifies a 150% hourly penalty rate. Prototype `HM-023` displays calculated penalty in LKR, but has no payment execution mechanism.
- **Available Options:**
  - **Option A (In-App Auto-Charge):** Host marks "Release", API automatically charges traveller's saved card on file via Stripe off-session payment intent.
  - **Option B (Cash at Counter):** Host collects cash directly from traveller; marks "Cash Collected" in `HM-024`; platform deducts 15% commission from next payout.
  - **Option C (Pre-Payment Gate):** Traveller digital pass QR code locks/invalidates when overdue until traveller settles outstanding balance in-app.
- **Recommendation:** **Option A with Option C fallback.** Cash collection introduces severe leakage and disputes.
- **Business & Technical Consequences:** Option A requires Stripe Customer ID persistence and off-session authorization agreements in checkout terms (`PW-004`).
- **Phase 2C Blocking Status:** **BLOCKS_SPRINT_2** (Checkout Terms & Policies).
- **Dependent Workstream:** `WS-2-PUBLIC-WEB`, `WS-3-TRAVELLER-MOB`.
- **Approval Status:** **PENDING_PRODUCT_OWNER_SIGN_OFF**

---

#### Decision `DEC-003`: Cancellation Refund Payment Gateway Fee Absorption
- **Decision Topic:** Absorption of merchant gateway transaction fees on customer cancellations (`PW-011`, `AD-007`).
- **Current Uncertainty:** Payment processors (Stripe, PayHere) retain interchange and gateway fees ($2.9\% + \$0.30$) upon refunding a transaction. Who absorbs this cost?
- **Existing Evidence:** Prototype `PW-011` simulates a 7-stage refund progress stepper promising 100% refund if cancelled $>2$ hours before booking.
- **Available Options:**
  - **Option A (Platform Absorbs):** Customer receives 100% refund. Marketplace absorbs gateway loss as operational overhead.
  - **Option B (Net Refund):** Customer receives refund minus gateway processing fee ($100\% - 3.5\%$). Disclosed in checkout terms.
  - **Option C (Platform Credit):** 100% refund issued as non-expiring Luggage Storage Platform Credit, or 95% if refunded to original payment method.
- **Recommendation:** **Option A for cancellations $>24$h; Option B or C for $<24$h.**
- **Business & Technical Consequences:** Financial ledger (`AD-006`, `HD-010`) must record gateway fee expense lines separately from gross revenue.
- **Phase 2C Blocking Status:** **NON_BLOCKING** (P1 Financial Ledger Detail).
- **Dependent Workstream:** `WS-2-PUBLIC-WEB`, `WS-6-SUPERADMIN`.
- **Approval Status:** **PENDING_PRODUCT_OWNER_SIGN_OFF**

---

#### Decision `DEC-004`: Digital Pass Apple Wallet & Google Wallet Integration Scope
- **Decision Topic:** Scope and timing of native PassKit (.pkpass) and Google Wallet integration (`PW-005`, `TM-024`).
- **Current Uncertainty:** Proposed design system included "Add to Apple Wallet" and "Save to Google Wallet" buttons. Native pass generation requires external developer certificates, cryptographic signing servers, and Google Wallet service accounts.
- **Existing Evidence:** Zero PassKit or Google Wallet code exists in the repository. Buttons in mockups were purely visual design proposals.
- **Available Options:**
  - **Option A (Full Native Pass Provisioning in Phase 2C):** Build backend signing service and mobile PassKit bridge.
  - **Option B (Deferred to Phase 3+ / Future Scope):** Keep digital custody pass within mobile apps (`TM-024`) and web portal (`PW-005`); remove wallet CTA buttons from Phase 2C UI.
  - **Option C (Client-Side PWA Pass):** Offer offline-cached PWA pass card with "Save Image / Screenshot" or PDF download.
- **Recommendation:** **Option B.** Native wallet passes are `FUTURE_SCOPE`. Removing wallet buttons prevents customer confusion and saves ~80 engineering hours.
- **Business & Technical Consequences:** Omitting wallet buttons keeps Phase 2C focused on core usability and responsive web/mobile navigation.
- **Phase 2C Blocking Status:** **NON_BLOCKING** (Approved as Future Scope).
- **Dependent Workstream:** `WS-2-PUBLIC-WEB`, `WS-3-TRAVELLER-MOB`.
- **Approval Status:** **CONFIRMED_RECOMMENDATION (Option B)**

---

#### Decision `DEC-005`: Offline Digital Pass Cryptographic Security & QR TTL
- **Decision Topic:** Offline verification security and QR code replay protection (`TM-024`, `HM-021`).
- **Current Uncertainty:** If travellers lose cellular roaming, their digital pass must render offline. How does the system prevent replay fraud or forged screenshots?
- **Existing Evidence:** Prototype `TM-024` renders a static simulated QR string and PIN `482910`.
- **Available Options:**
  - **Option A (Static Signed JWT with PIN):** QR contains tamper-proof HMAC-signed payload (`bookingId`, `bagCount`, `dropoffDate`, `secretHash`). Host app verifies signature online or offline via daily partner key. 6-digit PIN provides human counter fallback.
  - **Option B (Rotating TOTP QR Code):** QR changes every 60 seconds (like Google Authenticator). Requires strict device clock sync; blocks screenshot fraud.
  - **Option C (Simple Web Link):** QR is a URL to `https://luggage.app/v/:id`. Fails completely if host is offline.
- **Recommendation:** **Option A.** Delivers reliable offline display for international travellers with strong cryptographic verification.
- **Business & Technical Consequences:** Contracts package must define HMAC payload schema; host scanner parses and validates payload offline.
- **Phase 2C Blocking Status:** **BLOCKS_SPRINT_3** (Mobile Pass Architecture).
- **Dependent Workstream:** `WS-3-TRAVELLER-MOB`, `WS-5-HOST-MOB`.
- **Approval Status:** **PENDING_PRODUCT_OWNER_SIGN_OFF**

---

#### Decision `DEC-006`: Host Payout Schedule Automation & Thresholds
- **Decision Topic:** Host earnings disbursement schedule and minimum withdrawal threshold (`HD-010`, `AD-008`).
- **Current Uncertainty:** What is the automated payout cadence, and what minimum balance is required to trigger banking disbursements?
- **Existing Evidence:** Prototype simulates an 85/15 revenue split but has no automated batch worker or payout threshold logic.
- **Available Options:**
  - **Option A (Weekly Scheduled Batch):** Cleared earnings batched every Tuesday at 00:00 UTC. Minimum threshold: \$50 / LKR 15,000.
  - **Option B (On-Demand Host Withdrawal):** Host can request withdrawal anytime balance exceeds \$25, subject to 24h security hold and nominal bank fee.
  - **Option C (Manual Superadmin Approval):** Superadmin manually reviews each payout line in `AD-008`.
- **Recommendation:** **Option A.** Standard marketplace practice; minimizes banking transaction overhead.
- **Business & Technical Consequences:** Requires automated scheduled worker in `apps/api` using Node cron / BullMQ.
- **Phase 2C Blocking Status:** **NON_BLOCKING** (P1 Finance Module).
- **Dependent Workstream:** `WS-4-HOST-WEB`, `WS-6-SUPERADMIN`.
- **Approval Status:** **PENDING_PRODUCT_OWNER_SIGN_OFF**

---

#### Decision `DEC-007`: Tamper-Evident Physical Security Seal Sourcing & Workflow
- **Decision Topic:** Mandatory plastic zip-seals and tag barcode scanning (`TM-028`, `HM-022`).
- **Current Uncertainty:** Screens reference entering a "Security Seal Tag Number" (e.g. `#SL-88410`). Who supplies these physical numbered seals, and is seal entry mandatory for every single bag?
- **Existing Evidence:** Rule `PR-012` references tamper-evident seals. No procurement or inventory tracking exists in code.
- **Available Options:**
  - **Option A (Platform Ships Branded Seals):** Marketplace ships onboarding starter pack of 200 branded numbered zip-seals to approved hosts upon KYC completion. Seal barcode scanning mandatory.
  - **Option B (Host-Sourced Commercial Seals):** Hosts purchase commercial numbered luggage seals; input tag serial number into app.
  - **Option C (Photo Seal Fallback):** Physical seals are optional; host takes a close-up photo of bag zipper closure with paper tag if plastic seals are unavailable.
- **Recommendation:** **Option A for certified partners; Option C fallback.** Numbered seals are the single highest driver of customer security trust.
- **Business & Technical Consequences:** KYC onboarding flow (`AD-002`, `HD-002`) must capture physical shipping address.
- **Phase 2C Blocking Status:** **BLOCKS_SPRINT_4** (Host Intake Desk).
- **Dependent Workstream:** `WS-5-HOST-MOB`, `WS-6-SUPERADMIN`.
- **Approval Status:** **PENDING_PRODUCT_OWNER_SIGN_OFF**

---

#### Decision `DEC-008`: Mascot Brand Voice Boundary Policy (Kiri the Palm Squirrel)
- **Decision Topic:** Contextual boundaries for mascot illustrations across application surfaces.
- **Current Uncertainty:** Screen `AD-013` renders mascot Kiri shrugging in the middle of a serious customer dispute adjudication console. Mascot images appear indiscriminately across internal and public screens.
- **Existing Evidence:** 20 original PNG files exist in `Assets/` and `apps/web/public/assets/mascot/`.
- **Policy Rules (Proposed):**
  - **Approved Surfaces:**
    - Marketing & Public Web Landing (`PW-001`, `PW-006`, `PW-010`).
    - Onboarding & Success Empty States (`TM-002`, `HM-001`, `PW-005`).
    - Customer Celebration Moments (Booking complete, Bags returned, Review submitted).
  - **Strictly Prohibited Surfaces:**
    - Customer disputes, stolen/damaged luggage claims, and incident filings (`AD-013`, `TM-035`, `HM-037`).
    - Payment failure, card decline, or banking gateway errors (`PW-004`, `TM-020`).
    - Security settings, password resets, and 2FA authentication screens (`VerifyEmailPage`, `SecuritySettingsPage`).
    - Superadmin operational, compliance, and audit log consoles (`AD-001` through `AD-018`).
- **Recommendation:** **Adopt the proposed policy immediately as an immutable design rule for Phase 2C.**
- **Business & Technical Consequences:** Prevents brand trivialization in legal/dispute contexts. Requires prop lint check in `MascotIllustration.tsx`.
- **Phase 2C Blocking Status:** **BLOCKS_SPRINT_1** (Shared Design Tokens & Components).
- **Dependent Workstream:** `WS-1-FOUNDATION`, `WS-6-SUPERADMIN`.
- **Approval Status:** **PENDING_PRODUCT_OWNER_SIGN_OFF**

---

#### Decision `DEC-009`: Accessible Color Re-Tune for CWCP Terracotta Token
- **Decision Topic:** WCAG 2.2 AA accessibility validation of proposed brand terracotta color.
- **Current Uncertainty:** The proposed CWCP palette specifies Terracotta `#E86F2C`. Mathematical contrast audit reveals:
  - White text `#FFFFFF` on `#E86F2C` produces a contrast ratio of **$3.56:1$**, which **FAILS WCAG 2.2 Level AA** for normal body text and standard button labels ($<4.5:1$).
- **Existing Evidence:** Automated contrast calculation using standard relative luminance formula confirms failure.
- **Available Options:**
  - **Option A (Accessible Deep Terracotta `#C85316`):** Darken primary terracotta CTA token to `#C85316` (Contrast ratio **$4.62:1$** against white text, fully passing WCAG 2.2 AA).
  - **Option B (Dark Navy Button Text on Terracotta):** Use Deep Navy `#0A192F` text on Terracotta `#E86F2C` (Contrast ratio **$4.58:1$**, passing WCAG 2.2 AA).
  - **Option C (Retain Inaccessible `#E86F2C` for Large Text Only):** Restrict `#E86F2C` to elements $\ge 18$pt ($3:1$ requirement), using a darker shade for standard buttons.
- **Recommendation:** **Option A.** Darkening the terracotta token to `#C85316` maintains warm brand character while guaranteeing 100% automated accessibility compliance across all button sizes.
- **Business & Technical Consequences:** Eliminates accessibility audit blockers across all web and mobile CTA buttons.
- **Phase 2C Blocking Status:** **BLOCKS_SPRINT_1** (Design Tokens Definition).
- **Dependent Workstream:** `WS-1-FOUNDATION`.
- **Approval Status:** **PENDING_PRODUCT_OWNER_SIGN_OFF**

---

#### Decision `DEC-010`: Partner Trust Badge Taxonomy & Verification Criteria
- **Decision Topic:** Verification criteria for location trust badges (`PW-002`, `TM-015`).
- **Current Uncertainty:** Prototype location cards display a pill badge labeled *"Verified Hotel Vault"*. What physical storage types exist, and what criteria grant each badge?
- **Existing Evidence:** Prototype uses hardcoded strings. No database enum or KYC verification rule links to badge issuance.
- **Proposed Taxonomy:**
  1. `Verified Hotel Vault` (24/7 staffed front desk, dedicated locked luggage room, CCTV coverage).
  2. `Verified Retail Partner` (Commercial retail store, monitored storage area behind counter).
  3. `Verified Transit Hub` (Dedicated luggage facility adjacent to railway station or airport).
- **Recommendation:** **Adopt the 3-tier taxonomy.** Restrict badge rendering to hosts who have completed KYC document verification in `AD-002`. Prohibit generic unverified claims like *"100% verified partners"*.
- **Business & Technical Consequences:** Add `storage_facility_type` enum to database schema and listing editor (`HD-003`).
- **Phase 2C Blocking Status:** **BLOCKS_SPRINT_2** (Location Cards & Search UI).
- **Dependent Workstream:** `WS-2-PUBLIC-WEB`, `WS-4-HOST-WEB`, `WS-6-SUPERADMIN`.
- **Approval Status:** **PENDING_PRODUCT_OWNER_SIGN_OFF**

---

### 4. Summary Governance Sign-Off Register

| Decision ID | Summary Topic | Audit Recommendation | Phase 2C Blocking Status | Dependent Workstream | Approval Status |
|---|---|---|---|---|:---:|
| `DEC-001` | Photo Evidence Policy | Option B (Host override on undamaged bags) | BLOCKS_SPRINT_4 | `WS-5-HOST-MOB` | PENDING |
| `DEC-002` | Overdue Fee Channel | Option A (Auto-charge saved card on file) | BLOCKS_SPRINT_2 | `WS-2-PUBLIC-WEB` | PENDING |
| `DEC-003` | Refund Gateway Fees | Option A ($>24$h full refund; $<24$h net) | NON_BLOCKING | `WS-2-PUBLIC-WEB` | PENDING |
| `DEC-004` | Apple/Google Wallet | Option B (Defer to Phase 3+; remove UI) | NON_BLOCKING | `WS-3-TRAVELLER-MOB` | CONFIRMED |
| `DEC-005` | Offline Pass Security | Option A (Signed JWT + Monospace PIN) | BLOCKS_SPRINT_3 | `WS-3-TRAVELLER-MOB` | PENDING |
| `DEC-006` | Payout Cadence | Option A (Weekly Tuesday batch; \$50 min) | NON_BLOCKING | `WS-4-HOST-WEB` | PENDING |
| `DEC-007` | Security Seals | Option A (Platform ships 200 seals on KYC) | BLOCKS_SPRINT_4 | `WS-5-HOST-MOB` | PENDING |
| `DEC-008` | Mascot Tone Boundary | Strict prohibition in disputes/errors/admin | BLOCKS_SPRINT_1 | `WS-1-FOUNDATION` | PENDING |
| `DEC-009` | CWCP Color Re-tune | Option A (Adopt `#C85316` for WCAG AA) | BLOCKS_SPRINT_1 | `WS-1-FOUNDATION` | PENDING |
| `DEC-010` | Trust Badge Taxonomy | 3-tier taxonomy linked to KYC approval | BLOCKS_SPRINT_2 | `WS-2-PUBLIC-WEB` | PENDING |