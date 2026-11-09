# Phase 2C.3.1 — Product Decisions & Requirements Governance Reconciliation
## Document 31: Product Decisions Alignment for Traveller Mobile (`WS-3-TRAVELLER-MOB`)

**Project:** Global Luggage Storage Marketplace (`https://github.com/kavicastelo/luggage-storage`)  
**Document ID:** `DOC-UX-P2C-031`  
**Phase:** Phase 2C.3.1 — Product Decision Reconciliation  
**Audit Date:** November 9–10, 2026  
**Auditor / Quality Lead:** Principal Product Architect & Technical Program Manager  
**Authoritative Reference:** `16-product-decisions-required.md` (`DOC-UX-P2C-016`)  
**Target Branch:** `audit/phase-2c-traveller-mobile-verification`  

---

### 1. Executive Summary & Governance Authority

During the implementation of Phase 2C.3 (`WS-3-TRAVELLER-MOB`), five critical product decisions defined in Document 16 were referenced in engineering reports and customer-facing interfaces:
- **`DEC-001`**: Photo Evidence Protocol
- **`DEC-002`**: Overdue Fee Channels
- **`DEC-005`**: Offline Custody Token and PIN
- **`DEC-007`**: Tamper-Evident Security Seals
- **`DEC-010`**: Partner Trust Metadata

The previous delivery reports (`DOC-UX-P2C-028` and `DOC-UX-P2C-029`) characterized these decisions as "Architectural Decisions Honored". However, Document 16 establishes that these five decisions are **`PENDING_PRODUCT_OWNER_SIGN_OFF`**.

> [!CRITICAL]
> **Strict Governance Principle:**  
> An unapproved product proposal must **never** be presented to users, partners, or auditors as finalized production policy. The mobile application operates as a **Level 2 Functional Frontend Prototype** demonstrating the proposed user experience, but must remain bounded by honest disclosures without asserting uncontracted legal commitments or unverified backend security capabilities.

---

### 2. Comprehensive Decision-by-Decision Reconciliation

---

#### Decision `DEC-001`: Mandatory vs. Optional Drop-Off Photo Evidence Protocol
- **Topic:** Photographic inspection policy at bag check-in (`HM-014`, `TM-029`).
- **Approval Status:** **`PENDING_PRODUCT_OWNER_SIGN_OFF`**
- **Decision Owner:** Product Owner & Head of Field Operations.
- **Approval Date:** None (Pending Formal PO Sign-off).
- **Authoritative Specification:** `docs/phase-2b-ux-audit/16-product-decisions-required.md` (lines 62–75).
- **Proposed Business Rules:** Option B (Host is prompted to photograph existing damage/high-value tags, but can bypass with 1-tap: *"No visible damage / Host verified"*).
- **Implementation References in Code:**
  - `apps/mobile/src/data/mock-marketplace.ts`: `StorageLocationItem.photoEvidencePolicy` ("CONFIGURED_MANDATORY" vs "OPTIONAL_BY_DEFAULT").
  - `apps/mobile/app/(traveller)/bookings.tsx`: Check-in banner displays `booking.photoLogged ? "Photo evidence logged at check-in" : "Standard verification"`.
- **Backend Dependencies in `apps/api`:**
  - Cloud object storage bucket (e.g. S3 / GCS / R2) for image ingestion.
  - Fastify route `POST /api/v1/custody/bookings/:id/evidence`.
  - Offline image queueing in SQLite with background upload retry worker.
  - *Current Status:* **NOT IMPLEMENTED** in `apps/api`.
- **Test Evidence:**
  - `apps/mobile/tests/traveller-mobile-journeys.test.ts`: Asserts boolean property on mock object in memory. Does not test camera hardware or image transmission.
- **Outstanding Risks:**
  - If mandatory photos are enforced in production before offline image queues exist, lobby lines will stall under poor network connectivity.
  - Conversely, optional photos without clear partner guidelines risk liability during baggage damage disputes.
- **Audit Verdict:** **PROTOTYPE UX ONLY (UNAPPROVED AS FINAL POLICY)**

---

#### Decision `DEC-002`: Overdue / Late Storage Fee Payment Collection Channels
- **Topic:** Late collection fee calculation and collection mechanism (`HM-023`, `TM-030`, `checkout.tsx`, `bookings.tsx`).
- **Approval Status:** **`PENDING_PRODUCT_OWNER_SIGN_OFF`**
- **Decision Owner:** Product Owner & Financial Operations Lead.
- **Approval Date:** None (Pending Formal PO Sign-off).
- **Authoritative Specification:** `docs/phase-2b-ux-audit/16-product-decisions-required.md` (lines 78–92).
- **Proposed Business Rules:** Option A (In-App Auto-Charge saved card on file) with Option C fallback (QR pass invalidates until traveller settles overdue fee in-app). Rule `PR-014` specifies 150% hourly rate; 30-minute train delay grace period.
- **Implementation References in Code:**
  - `apps/mobile/app/(traveller)/checkout.tsx`: Late fee policy notice rendered in step 3 review.
  - `apps/mobile/app/(traveller)/bookings.tsx`: Live timer transitions to Rose (`#BE123C`) when overdue; extension modal calculates $+1$h, $+2$h, $+4$h in LKR; disclosures clarify train grace period.
- **Backend Dependencies in `apps/api`:**
  - Stripe / PayHere customer card vaulting for off-session charging.
  - Scheduled background worker to calculate overdue increments and trigger payment intents.
  - *Current Status:* **NOT IMPLEMENTED** in `apps/api`.
- **Test Evidence:**
  - `apps/mobile/tests/traveller-mobile-journeys.test.ts`: Verifies extension math and static string disclosure in rendered JSX.
- **Outstanding Risks:**
  - Automatically charging saved cards without explicit checkout disclosure creates merchant chargeback disputes.
  - Without automated collection, partner venues bear the burden of holding baggage without receiving compensation for excess storage hours.
- **Audit Verdict:** **PROTOTYPE UX ONLY (UNAPPROVED AS FINAL POLICY)**

---

#### Decision `DEC-005`: Offline Digital Pass Cryptographic Security & PIN Fallback
- **Topic:** Offline verification security, HMAC payload construction, and QR code replay protection (`TM-024`, `HM-021`).
- **Approval Status:** **`PENDING_PRODUCT_OWNER_SIGN_OFF`**
- **Decision Owner:** Security Architect & Product Owner.
- **Approval Date:** None (Pending Formal PO Sign-off).
- **Authoritative Specification:** `docs/phase-2b-ux-audit/16-product-decisions-required.md` (lines 126–140).
- **Proposed Business Rules:** Option A (Tamper-proof HMAC-signed JWT payload verified by host app offline via daily partner key; 6-digit numeric PIN fallback for human verification).
- **Implementation References in Code:**
  - `apps/mobile/app/(traveller)/pass.tsx`: Renders ticket with booking reference `#LS-2026-8841`, static SVG QR icon, monospace PIN `482 910`, and serialized seals.
- **Backend Dependencies in `apps/api`:**
  - Asymmetric/symmetric HMAC ticket signing service in `packages/contracts` and `apps/api`.
  - Daily partner key distribution endpoint and offline validation library.
  - Rate-limited manual PIN entry verification endpoint.
  - *Current Status:* **NOT IMPLEMENTED** in `apps/api`.
- **Test Evidence:**
  - `apps/mobile/tests/traveller-mobile-journeys.test.ts`: Asserts string formatting of reference and PIN.
  - `apps/mobile/tests/traveller-mobile-audit-verification.test.ts`: Asserts that UI copy has been neutralized to avoid claiming server-verified cryptography.
- **Outstanding Risks:**
  - Static or unverified QR passes can be screenshotted and shared, presenting a risk of unauthorized luggage collection.
- **Audit Verdict:** **PROTOTYPE UX ONLY (CRYPTOGRAPHY DEFERRED TO PHASE 3)**

---

#### Decision `DEC-007`: Tamper-Evident Physical Security Seal Sourcing & Workflow
- **Topic:** Physical zip-seals, serialized barcodes, and tagging workflow (`TM-028`, `HM-022`).
- **Approval Status:** **`PENDING_PRODUCT_OWNER_SIGN_OFF`**
- **Decision Owner:** Head of Physical Operations & Logistics.
- **Approval Date:** None (Pending Formal PO Sign-off).
- **Authoritative Specification:** `docs/phase-2b-ux-audit/16-product-decisions-required.md` (lines 158–172).
- **Proposed Business Rules:** Option A (Platform ships onboarding starter pack of 200 branded numbered zip-seals to approved hosts upon KYC completion; seal barcode scanning mandatory) with Option C fallback.
- **Implementation References in Code:**
  - `apps/mobile/app/(traveller)/pass.tsx`: Displays `booking.seals` (e.g. `SEAL-LK-90211, SEAL-LK-90212`).
  - `apps/mobile/app/(traveller)/bookings.tsx`: Displays seal tag numbers on active custody monitor.
- **Backend Dependencies in `apps/api`:**
  - Partner seal inventory tracking table (`partner_seal_batches`).
  - Host camera scanner seal ingestion and association with booking records.
  - *Current Status:* **NOT IMPLEMENTED** in `apps/api`.
- **Test Evidence:**
  - `apps/mobile/tests/traveller-mobile-journeys.test.ts`: Asserts seal string formatting on mock booking object.
- **Outstanding Risks:**
  - If seal supply chains fail or hosts exhaust their physical zip-seals, luggage check-in is blocked unless an approved fallback protocol is enacted.
- **Audit Verdict:** **PROTOTYPE UX ONLY (UNAPPROVED AS FINAL POLICY)**

---

#### Decision `DEC-010`: Partner Trust Badge Taxonomy & Verification Criteria
- **Topic:** Verification criteria for location trust badges (`PW-002`, `TM-015`).
- **Approval Status:** **`PENDING_PRODUCT_OWNER_SIGN_OFF`**
- **Decision Owner:** Head of Trust & Safety / Product Owner.
- **Approval Date:** None (Pending Formal PO Sign-off).
- **Authoritative Specification:** `docs/phase-2b-ux-audit/16-product-decisions-required.md` (lines 213–227).
- **Proposed Business Rules:** 3-tier taxonomy (`Verified Hotel Vault`, `Verified Retail Partner`, `Verified Transit Hub`) restricted to hosts who have completed KYC document verification in `AD-002`. Prohibit generic claims like "100% verified partners".
- **Implementation References in Code:**
  - `apps/mobile/src/data/mock-marketplace.ts`: `verifiedHost` string field in `DEMO_LOCATIONS`.
  - `apps/mobile/app/(traveller)/location.tsx` & `index.tsx`: Badges rendered as `VERIFIED PARTNER` or `Ceylon Transit Hospitality (Pvt) Ltd`.
- **Backend Dependencies in `apps/api`:**
  - `storage_facility_type` enum in database schema.
  - Integration between KYC verification status and partner badge visibility.
  - *Current Status:* **PARTIALLY IMPLEMENTED** in Phase 1B (users have roles and KYC review status in `AD-002`, but facility type enum is not yet fully modeled).
- **Test Evidence:**
  - `apps/mobile/tests/traveller-mobile-journeys.test.ts`: Asserts string existence in `DEMO_LOCATIONS`.
- **Outstanding Risks:**
  - Displaying partner trust badges without actual KYC verification creates platform liability if an unverified venue experiences luggage theft.
- **Audit Verdict:** **PROTOTYPE UX ONLY (UNAPPROVED AS FINAL POLICY)**

---

### 3. Summary Governance Sign-Off Register

| Decision ID | Summary Topic | Proposed Option | Approval Status in Doc 16 | Audited Reality in Mobile Code | Governance Classification |
|---|---|---|:---:|---|---|
| `DEC-001` | Photo Evidence Protocol | Option B (Host override) | `PENDING` | Mock boolean flag on fixture | Level 2 Prototype Simulation |
| `DEC-002` | Overdue Fee Channels | Option A (Auto-charge) | `PENDING` | Client UI calculation & disclosure | Level 2 Prototype Simulation |
| `DEC-003` | Refund Gateway Fees | Option A ($>24$h full) | `PENDING` | 7-stage client UI stepper | Level 2 Prototype Simulation |
| `DEC-004` | Apple/Google Wallet | Option B (Defer to Phase 3) | `CONFIRMED` | Native wallet buttons omitted | Approved Future Scope |
| `DEC-005` | Offline Pass Security | Option A (Signed JWT + PIN) | `PENDING` | Static SVG QR icon + PIN fixture | Level 2 Prototype Simulation |
| `DEC-006` | Payout Cadence | Option A (Weekly batch) | `PENDING` | Deferred to Host Web / Superadmin | Pending Business Rule |
| `DEC-007` | Security Seals | Option A (Platform ships seals) | `PENDING` | Serialized string labels on pass | Level 2 Prototype Simulation |
| `DEC-008` | Mascot Tone Boundary | Strict prohibition in disputes | `PENDING` | Bounded to onboarding/empty states | Approved Design Rule |
| `DEC-009` | CWCP Color Re-tune | Option A (`#C55013` WCAG AA) | `PENDING` | Implemented in contracts & theme | Approved Design Token |
| `DEC-010` | Trust Badge Taxonomy | 3-tier taxonomy from KYC | `PENDING` | Storefront labels from demo array | Level 2 Prototype Simulation |

---

### 4. Implementation Guidelines for Host Web (`WS-4-HOST-WEB`)

To maintain architectural integrity when implementing Host Web (`WS-4-HOST-WEB`):
1. **Never assert that pending decisions are final legal policy.** Display operational rules with clear contextual labeling (e.g. *"Illustrative Location Policy: 30m grace period"*).
2. **Never claim live payment execution or automated banking transfers** where Fastify/PostgreSQL endpoints do not exist.
3. **Keep developer diagnostic tools sequestered** behind `import.meta.env.DEV` or `__DEV__`.
4. **Maintain complete traceability** back to Document 16 so that future engineering sprints understand exactly what remains to be built at the database and backend layer.
