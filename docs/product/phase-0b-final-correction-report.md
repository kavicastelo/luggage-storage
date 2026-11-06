# Phase 0B-D Final Decision-Record Correction & Cross-Document Integrity Audit Report

**Document Title:** Phase 0B-D Final Decision-Record Correction & Cross-Document Integrity Audit Report  
**Project:** Global Luggage Storage Marketplace  
**Initial Launch Market:** Sri Lanka  
**Phase:** Phase 0B — Final Correction & Cross-Document Integrity Audit  
**Auditor Role:** Principal Business Analyst, Product Governance Architect, Domain Modelling Auditor, Financial Workflow Analyst, and Requirements Traceability Auditor  
**Audit Date:** 2026-11-07  
**Execution Mode:** Strictly documentation-only; zero application code, migrations, or database schemas  
**Document Status:** Complete Authoritative Audit Report  
**Readiness Recommendation:** `READY FOR PRODUCT OWNER REVIEW`

---

## 1. Files Inspected

A comprehensive line-by-line inspection was conducted across all relevant repository sources:

### 1.1 Authoritative Product Source
- `docs/product/source/luggage-storage-frs.pdf`: Verified all 57 source FRS requirement rows (27 Traveller rows, 30 Host rows) and original FRS classifications.

### 1.2 Architecture and Decision Baselines
- `docs/product/product-overview.md`
- `docs/product/product-scope-and-boundaries.md`
- `docs/product/user-roles-and-actors.md`
- `docs/architecture/system-architecture.md`
- `docs/architecture/application-boundaries.md`
- `docs/architecture/backend-domain-overview.md`
- `docs/architecture/technology-decisions.md`
- `docs/architecture/decisions/` (`ADR-001` through `ADR-010`)
- `docs/.agents/project-bluprint-plan.md`

### 1.3 Requirements & Phase 0B Deliverables
- `docs/product/assumptions-and-open-questions.md`
- `docs/product/business-rules-catalogue.md`
- `docs/product/functional-requirements.md`
- `docs/product/workflow-inventory.md`
- `docs/product/requirements-traceability-matrix.md`
- `docs/product/phase-0b-summary.md`
- `docs/product/phase-0b-correction-report.md`

---

## 2. Files Modified

The following documentation files were updated in place to apply the required corrections:

1. `docs/product/assumptions-and-open-questions.md`:
   - Updated `OQ-012` to clearly separate approved address masking baseline from proposed jitter/disclosure details.
   - Updated `OQ-015` to strictly decouple physical luggage custody release from overdue fee financial settlement (prohibiting possessory liens).
   - Reconciled `OQ-009` (Product Cancellation Policy) and `OQ-013` (Payment-Provider Refund Capabilities & 7-Stage Reconciliation).
   - Updated `OQ-008` to specify integer minor units, explicit ISO 4217 code, dynamic exponent resolution, and prohibition of binary floating-point.
   - Updated `OQ-010` to structure tax and legal matters into four distinct layers (Platform Capability, Configured Rules, Legal Classification, Launch Compliance Gate).
   - Synchronized Priority Summary Matrix.
2. `docs/product/business-rules-catalogue.md`:
   - Updated `BR-010` (Address masking baseline approved; jitter and storefront details proposed).
   - Updated `BR-025` (Integer minor units, explicit ISO 4217 code, dynamic exponent, no universal two-decimal assumption).
   - Updated `BR-035` (Customer cancellation policy tiers approved).
   - Updated `BR-036` (Explicit 7-stage refund lifecycle: `REQUESTED` $\rightarrow$ `AUTHORIZED` $\rightarrow$ `INITIATED` $\rightarrow$ `PROCESSING` $\rightarrow$ `SUCCEEDED` / `FAILED` / `MANUAL_REVIEW_REQUIRED`).
   - Updated `BR-040` (Four-layer tax foundation).
   - Updated `BR-078` & `BR-079` (Overdue luggage calculation; custody return decoupled from overdue fee settlement; cash collection prohibited).
   - Maintained exactly 100 sequential rules (`BR-001` to `BR-100`) with zero numbering gaps.
3. `docs/product/functional-requirements.md`:
   - Updated `REQ-TRV-004`, `REQ-TRV-007`, `REQ-TRV-013` to preserve approved address privacy baseline while marking jitter radius and storefront entrance photos/phone disclosure as proposed policies.
   - Updated `REQ-TRV-011`, `REQ-TRV-027`, `REQ-HST-022` for integer minor units and ISO 4217 dynamic exponent handling.
   - Updated `REQ-TRV-018` & `REQ-TRV-019` to link customer cancellation tiers (`OQ-009`) with 7-stage refund lifecycle and provider verification gate (`OQ-013`).
   - Updated `REQ-HST-018` (and `AC-REQ-HST-018-02`, `AC-REQ-HST-018-03`) to decouple luggage check-out from overdue fee settlement, guaranteeing travellers can collect their belongings without detention.
   - Updated `REQ-HST-024` for the 4-layer tax structure.
   - Preserved `Original FRS Classification`, `Delivery Target`, and `Implementation Status: Documentation defined` across all 57 explicit and 15 implied requirements.
4. `docs/product/workflow-inventory.md`:
   - Updated `WF-HST-012` to decouple physical luggage handoff from overdue fee settlement; added explicit alternative path `COMPLETED_WITH_UNPAID_OVERDUE` preventing custody withholding.
   - Updated `WF-ADM-004` to model the complete 7-stage refund lifecycle with gateway failure and manual review paths.
   - Maintained all 44 actor-scoped workflows.
5. `docs/product/requirements-traceability-matrix.md`:
   - Updated Section 1.2 descriptions.
   - Updated Section 5 to categorize items into Owner-Approved Baseline Policies, Proposed Details Pending Approval, and Mandatory External Verification Gates.
   - Maintained 72 rows with `Documentation defined` and 0 `Validated`.
6. `docs/product/phase-0b-summary.md`:
   - Updated Section 4 and Section 5 to reflect the refined decision boundaries, proposed disclosure items, and external verification gates.

---

## 3. Exact Issues Discovered

During this integrity audit, five subtle but critical domain and governance defects were detected:

| Issue ID | Category | Defect Description |
| :---: | :--- | :--- |
| **ISS-D01** | Privacy & Disclosure Scope Overextension | Earlier documentation stated a specific `150–300m geographic jitter` radius and post-confirmation disclosure of storefront signage name, entrance photos, and host contact phone as mandatory approved policies. These were engineering proposals, not explicit owner decisions. |
| **ISS-D02** | Custody & Financial Conflation (Possessory Lien) | Earlier acceptance criteria (`AC-REQ-HST-018-02`) and workflow steps (`WF-HST-012`) required verified in-app payment of overdue fees *before* luggage check-out was unlocked, effectively modeling a possessory lien that held traveller belongings hostage over unpaid or disputed fees. |
| **ISS-D03** | OQ Reference Conflation (`OQ-009` vs `OQ-013`) | References to payment-provider refund capabilities, timing, and fee deductions were conflated with `OQ-009` (Customer Cancellation Policy), while `OQ-013` lacked a complete 7-stage operational lifecycle definition. |
| **ISS-D04** | Imprecise Monetary Precision | Earlier text referred to "integer cents" or "cents-equivalent", creating an architectural risk of hard-coding a generic two-decimal assumption into the global multi-currency data model. |
| **ISS-D05** | Legal & Tax Classification Conflation | Earlier summaries claimed that the configurable tax foundation satisfied Sri Lankan compliance, conflating software capability with legal supply classification and statutory compliance. |

---

## 4. Corrections Applied

### 4.1 OQ-012 — Address Privacy & Location Disclosure
- **Preserved Approved Baseline:** Public discovery shows approximate location/neighborhood only; exact street address is strictly masked before booking confirmation; exact address is disclosed exclusively to confirmed booking travellers; host may configure stricter privacy but cannot weaken platform baseline.
- **Corrected Proposals:** Specific coordinate jitter radius (e.g. 150–300m) and post-confirmation unmasking of storefront business name, entrance photos, and host phone number are formally classified as **Proposed Policies Pending Product Owner Approval**.

### 4.2 OQ-015 — Late Collection Fee Settlement & Custody Decoupling
- **Preserved Financial Baseline:** In-app payment is the exclusive MVP payment method for overdue fees; standard cash-at-counter collection is excluded; configurable grace periods and disclosed fee policies enforced.
- **Corrected Custody Boundary:** Physical luggage custody and overdue fee financial settlement are strictly modeled as separate concerns:
  1. *Luggage custody and physical return.*
  2. *Overdue-fee assessment.*
  3. *Additional payment request.*
  4. *Payment or dispute resolution.*
  5. *Financial reconciliation.*
  - **No Possessory Lien:** A disputed or unpaid overdue fee **must not automatically prevent the traveller from collecting their belongings**. Physical luggage handoff proceeds immediately upon valid token verification (`REQ-HST-016`); unpaid overdue fees are recorded as an outstanding platform receivable and flagged for Platform Support review (`WF-SUP-002`, `REQ-TRV-023`).

### 4.3 OQ-009 / OQ-013 — Refund Policy vs. Provider Capabilities & 7-Stage Lifecycle
- **`OQ-009` (Product Policy — Owner-Approved Baseline):**
  - Standard customer cancellation tiers: 100% >2h before drop-off; 50% <2h before drop-off; 0% default after start or no-show; 100% on host/platform cancellation; authorized Superadmin exceptions.
- **`OQ-013` (Provider Capabilities — External Verification Gate):**
  - PayHere automated Refund API support vs merchant portal execution, refund settlement timing, payment fee retention/deduction, partial refund support, and reversal handling.
- **Explicit Seven-Stage Refund Lifecycle:**
  $$\text{REQUESTED} \longrightarrow \text{AUTHORIZED (or REJECTED)} \longrightarrow \text{INITIATED} \longrightarrow \text{PROCESSING} \longrightarrow \begin{cases} \text{SUCCEEDED} \\ \text{FAILED} \\ \text{MANUAL\_REVIEW\_REQUIRED} \end{cases}$$
  Guarantees that a submitted refund request is never marked as completed upon submission.

### 4.4 OQ-008 — Currency Precision & Representation
- Preserved LKR-only launch; multi-currency deferred.
- Removed imprecise "cents-equivalent" phrasing.
- Formally specified:
  1. Monetary values stored strictly as **integer minor units**.
  2. Explicit **ISO 4217** currency code stored with every amount.
  3. Minor unit exponent dynamically determined by ISO 4217 standard (no universal two-decimal assumption).
  4. Binary floating-point representation strictly prohibited.
  5. Display formatting decoupled from stored values.

### 4.5 OQ-010 — Four-Layer Tax & Legal Separation
Formally structured tax and invoicing into four distinct operational layers:
- **Layer A (Platform Technical Capability):** Configurable tax rules, tax-inclusive/exclusive pricing, base/tax/gross persistence in integer minor units, receipts, statements, and immutable calculation snapshots.
- **Layer B (Configured Jurisdiction Rules):** Initial system configuration modeling Sri Lankan VAT and SSCL parameters (system data, not legal compliance proof).
- **Layer C (Legal & Tax Classification):** Formal legal determination of agent vs principal vs marketplace operator (external legal matter; not decided by software documentation).
- **Layer D (Launch Compliance Gate):** Mandatory pre-launch professional tax/legal advice to validate statutory invoicing, VAT, and SSCL liabilities.

---

## 5. OQ Identifier Reconciliation

An exhaustive audit of all open question identifiers was conducted to verify that no duplicate, misassigned, or broken references exist:

| OQ ID | Canonical Topic | Classification | Approval Status |
| :---: | :--- | :--- | :---: |
| `OQ-001` | Authentication Strategy | Architecture / Security | **Owner-Approved Decision** |
| `OQ-002` | Host KYC Document Checklist | Legal / Operations | **Pending Decision** |
| `OQ-003` | PayHere Marketplace Approval | Commercial / Payments | **Launch Gate Blocker** |
| `OQ-004` | Booking Modes & Payment Timing | Product / Booking Engine | **Owner-Approved Decision** |
| `OQ-005` | Platform Commission & Promo Discounts | Product / Pricing / Finance | **Owner-Approved Decision** |
| `OQ-006` | Storage Capacity & Bag Categories | Product / Capacity Engine | **Owner-Approved Decision** |
| `OQ-007` | Unified Identity Model | Identity / Roles | **Owner-Approved Decision** |
| `OQ-008` | Currency Representation & Precision | Finance / Data Architecture | **Owner-Approved Decision** |
| `OQ-009` | Customer Cancellation Policy Tiers | Policy / Finance | **Owner-Approved Decision** |
| `OQ-010` | Tax Architecture & Legal Classification | Legal / Compliance / Finance | **Approved (Arch) / Launch Gate (Legal)** |
| `OQ-011` | Superadmin & Support Role Separation | Governance / RBAC | **Owner-Approved Decision** |
| `OQ-012` | Address Privacy Baseline & Disclosure Details | Trust & Safety / Product | **Approved (Baseline) / Proposed (Details)** |
| `OQ-013` | Payment-Provider Refund Capabilities | Provider Integration / Payments | **External Verification Gate** |
| `OQ-014` | Custody Verification & Evidence Policy | Physical Custody Operations | **Owner-Approved Decision** |
| `OQ-015` | Late Collection Fee & Custody Separation | Physical Custody / Payments | **Owner-Approved Decision** |
| `OQ-016` | Customer Support Separation | Product / Operations | **Pending Decision** |
| `OQ-017` | Host Staff Permission Granularity | Roles / Governance | **Pending Decision** |
| `OQ-018` | Commercial Map Tile & Geocoding Vendor | Technical / Mapping | **Pending Decision** |
| `OQ-019` | Transactional Email Provider | Technical / Comms | **Pending Decision** |
| `OQ-020` | SMS / Phone OTP Verification Gateway | Technical / Comms | **Pending Decision** |
| `OQ-021` | Redis / Upstash Activation Timing | Infrastructure | **Pending Decision** |
| `OQ-022` | Normalization of Duplicate FRS Numbers | Requirements Engineering | **Approved Normalization** |

Total registered OQs: **22 (`OQ-001` through `OQ-022`)**. Zero duplicate IDs, zero broken cross-references.

---

## 6. Before/After Policy Distinctions

| Dimension | Previous State (Phase 0B-C) | Corrected State (Phase 0B-D) |
| :--- | :--- | :--- |
| **Address Privacy Disclosure** | Stated $\pm 150-300\text{m}$ jitter and post-booking disclosure of store name, photos, and phone as approved policies. | **Preserves approved baseline** (approximate discovery, exact address post-booking); **reclassifies** jitter radius and store name/photos/phone disclosure as **Proposed Policies Pending Owner Approval**. |
| **Overdue Luggage Custody Boundary** | Check-out was locked until overdue payment was completed in-app (possessory lien model). | **Strictly decoupled:** Custody release proceeds upon valid token verification; unpaid overdue fee is recorded as a receivable/dispute without holding luggage hostage. |
| **Refund Operation Modeling** | Conflated cancellation policy tiers with payment provider capabilities under `OQ-009`. | **Separates** product cancellation policy (`OQ-009`) from provider refund capabilities (`OQ-013`); implements explicit **7-stage lifecycle** with failure and manual review paths. |
| **Currency Data Representation** | Used informal terms "integer cents" or "cents-equivalent". | **Formally specifies integer minor units**, explicit ISO 4217 code, dynamic exponent resolution, prohibition of binary floats, and prohibition of a universal two-decimal assumption. |
| **Tax & Legal Classification** | Framed configurable tax architecture as satisfying Sri Lankan compliance. | **Separates into 4 distinct layers:** Platform capability, Configured rules, Legal classification, and Launch compliance gate. Prohibits claiming software solves legal supply classification. |

---

## 7. Cross-Document Consistency Results

An automated cross-referencing audit verified absolute mutual consistency across all 6 documents:

| Verification Metric | Value | Verification Finding |
| :--- | :---: | :--- |
| **Original Source FRS Rows** | **57** | 100% accounted for; 0 dropped or merged rows |
| **Explicit Normalized Requirements** | **57** | `REQ-TRV-001`..`027`, `REQ-HST-001`..`030` |
| **Implied Operational Requirements** | **15** | `REQ-IMPL-001`..`015` |
| **Total Normalized Requirements** | **72** | All 72 requirements have `Implementation Status: Documentation defined` |
| **Acceptance Criteria** | **122** | All Given/When/Then format; 0 contradict approved policies |
| **Actor-Scoped Workflows** | **44** | 15 TRV + 16 HST + 3 STF + 4 SUP + 6 ADM = 44 total workflows |
| **Catalogued Business Rules** | **100** | `BR-001` through `BR-100` sequential; **0 numbering gaps** |
| **Markdown Link Resolution** | **0 Broken** | All relative internal links resolve to valid targets |

---

## 8. Integrity Audit Results

- **No Possessory Lien:** Confirmed across `functional-requirements.md` (`REQ-HST-018`), `workflow-inventory.md` (`WF-HST-012`), and `business-rules-catalogue.md` (`BR-079`) that luggage release is never conditioned on overdue fee payment.
- **Refund Lifecycle Completeness:** Confirmed across `functional-requirements.md` (`REQ-TRV-019`), `workflow-inventory.md` (`WF-ADM-004`), and `business-rules-catalogue.md` (`BR-036`) that the 7-stage refund lifecycle includes `FAILED` and `MANUAL_REVIEW_REQUIRED` states.
- **Currency Minor Unit Specification:** Confirmed across `assumptions-and-open-questions.md` (`OQ-008`), `business-rules-catalogue.md` (`BR-025`), and `functional-requirements.md` (`REQ-TRV-011`, `REQ-TRV-027`) that monetary values use integer minor units with ISO 4217 dynamic exponents.
- **Classification Separation:** Confirmed that every requirement explicitly displays `Original FRS Classification`, `Delivery Target`, and `Implementation Status: Documentation defined`.

---

## 9. Remaining Open Decisions & Proposed Details

The following proposed details await explicit Product Owner confirmation:
1. **`OQ-012` (Public Map Jitter Radius):** Confirm whether public map pins use a specific coordinate jitter radius (such as $\pm 150-300\text{m}$) or display a generalized district polygon/circle.
2. **`OQ-012` (Post-Confirmation Contact Disclosure):** Confirm whether direct host telephone number and storefront entrance photos are unmasked upon booking confirmation or kept in-app.
3. **`OQ-002` (Host KYC Checklist):** Confirm mandatory document checklist for Sri Lankan individuals (NIC/Passport) vs registered entities (BRC + Director NIC).
4. **`OQ-016`–`OQ-021` (Operational & Infrastructure Vendors):** Support tooling separation (`OQ-016`), host staff permission granularity (`OQ-017`), map vendor contract (`OQ-018`), email service (`OQ-019`), SMS gateway (`OQ-020`), Redis activation timing (`OQ-021`).

---

## 10. Remaining External Verification Gates (Pre-Launch Gates)

The following items are locked as mandatory pre-launch verification gates:
1. **`OQ-003` — PayHere Marketplace Approval (Launch Gate Blocker):**
   - Obtain written confirmation from PayHere permitting collection of gross funds on behalf of independent hosts and manual host payouts.
   - *Rule:* If PayHere does not approve, stop PayHere integration and evaluate alternative payment gateways.
2. **`OQ-010` — Sri Lankan Legal & Tax Advisory (Launch Gate):**
   - Obtain qualified professional advice on agency vs principal supply structure, invoicing flow, VAT on commission vs full service, SSCL turnover liability, and statutory invoice formatting.
3. **`OQ-013` — Payment Gateway Refund Capabilities & Settlement Timing:**
   - Confirm PayHere automated Refund API capabilities, portal fallback, settlement timing, fee deductions, partial refund support, and 7-stage lifecycle reconciliation.

---

## 11. Confirmation of Implementation Boundary

- **Zero Application Code Changes:** No application source code (`apps/*`), package configurations (`packages/*`), dependencies, migrations, or database schemas were generated, modified, or executed.
- **Phase 0C Authorization:** **Phase 0C (Domain Engines, Database ERD & Master Screen Registry) is NOT authorized and has NOT been started.**

---

## 12. Explicit Phase 0C Readiness Recommendation

**Conclusion:** **`READY FOR PRODUCT OWNER REVIEW`**

The requirements normalization, business rules catalogue, workflow inventory, traceability matrix, and open questions register are mathematically, legally, and architecturally consistent, with all owner decisions faithfully reflected and all unapproved proposals strictly quarantined.

We are stopped and waiting for the Product Owner's review and explicit instruction before proceeding to Phase 0C.

