# Phase 2B — Product UI/UX Audit & Redesign Planning
## Document 12: Screen Status Reconciliation & Discrepancy Analysis

**Project:** Global Luggage Storage Marketplace (`https://github.com/kavicastelo/luggage-storage`)  
**Audit Document:** `DOC-UX-P2B-012`  
**Governing Documents Evaluated:**  
- `docs/product/ux/master-screen-registry.md` (`DOC-UX-001`)  
- `docs/engineering/phase-2-screen-implementation-tracker.md` (`DOC-ENG-P2-TRACKER`)  
- `docs/project-stabilization/08-final-stabilization-report.md`  
**Date:** November 9, 2026

---

### 1. The 113 vs. 123 Screen Discrepancy Resolution

A central mandate of this audit is resolving the conflicting screen counts in existing project documentation, specifically the references to "123 active screens" versus "113 active screens".

#### 1.1 Mathematical & Historical Root Cause Analysis

1. **The Numbering Span:**
   - Traveller Mobile IDs span `TM-001` through `TM-044` (44 total ID slots).
   - Host Mobile IDs span `HM-001` through `HM-037` (37 total ID slots).
   - Public Website IDs span `PW-001` through `PW-011` (11 total ID slots).
   - Host Dashboard IDs span `HD-001` through `HD-014` (14 total ID slots).
   - Superadmin Dashboard IDs span `AD-001` through `AD-018` (18 total ID slots).
   $$\text{Total ID Span} = 44 + 37 + 11 + 14 + 18 = \mathbf{124\text{ Identifiers}}$$

2. **The Intentionally Reserved Gaps:**
   By explicit architectural specification in Phase 0C (`master-screen-registry.md` Section 7.2), **11 IDs were intentionally reserved** for future capabilities and never implemented:
   - 5 Traveller Mobile IDs: `TM-009` (Social OAuth), `TM-010` (Biometrics), `TM-025` (Alternative Payments), `TM-026` (Offline PDF), `TM-038` (In-App Chat).
   - 6 Host Mobile IDs: `HM-008` (Monthly Calendar), `HM-012` (Bulk Holiday Importer), `HM-015` (Custom Surcharges), `HM-016` (Dynamic Pricing), `HM-017` (Multi-Day Discounts), `HM-032` (PDF Tax Statements).
   $$\text{Active Catalogued Marketplace Screens} = 124 - 11 = \mathbf{113\text{ Active Screens}}$$

3. **Origin of the False "123" Figure:**
   In `docs/project-stabilization/08-final-stabilization-report.md` (Line 20) and `docs/project-stabilization-2/00-current-state-and-implementation-plan.md` (Line 16), an author recorded:
   > *"Added all 7 required implementation specification dimensions across all 123 active screens (134 registered minus 11 reserved)..."*
   
   This calculation was a mathematical clerical error. The author mistakenly assumed a registered span of 134 IDs (`134 - 11 = 123`). However, summing the actual ranges (`44 + 37 + 11 + 14 + 18`) yields exactly **124**, not 134. Subtracting 11 yields **113**.
   
   The code verifies this beyond doubt: `apps/web/src/data/mock-marketplace.ts` registers exactly 43 Web screens (`11 PW + 14 HD + 18 AD = 43`) and 70 Mobile screens (`39 TM + 31 HM = 70`).
   $$43 + 70 = \mathbf{113\text{ Active Screens}}$$

4. **The Uncatalogued 11 Live Web Auth Screens:**
   Compounding the confusion, the web application (`apps/web`) contains 11 active identity and utility screens implemented in Phase 1B:
   - `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/profile`, `/settings/security`, `/settings/sessions`, `/health`, `/forbidden`, `/404`.
   These screens are fully functional against Fastify and PostgreSQL, but were never assigned `PW-xxx` identifiers or counted in the Phase 2 113-screen catalog.

---

### 2. Reconciliation of the "100% QA_VERIFIED" Status

`phase-2-screen-implementation-tracker.md` historically claimed:
> `Status: COMPLETE — 113 / 113 ACTIVE SCREENS QA_VERIFIED`

This audit demonstrates that this status was deeply misleading. The tracker conflated **automated unit test execution of mock data** with **genuine end-to-end product completeness**.

#### 2.1 What Was Actually Verified:
- Vitest automated tests (`apps/web/tests/phase-2-screens-and-mascots.test.ts`) verified that all 113 screen data objects exist in `mock-marketplace.ts`, that role scopes match expected strings, and that all 20 mascot PNG files exist on disk.
- Phase 1B identity endpoints (`/api/v1/auth/*`) were genuinely tested against live PostgreSQL tables.

#### 2.2 What Was NOT Verified (And Remained Simulated):
- 98 of the 113 screens have **zero connection** to backend services or database persistence.
- Mobile screens were not verified as native touch experiences; they were verified as query-parameter switches inside a monolithic web-preview container.
- MapLibre geospatial rendering and camera QR scanning were completely unverified and remain non-functional placeholders.
- Visual design quality, layout hierarchy, and user terminology were completely unvetted, allowing internal tracking badges (`PW-002`, `HD-007`) to pass into "verified" code.

---

### 3. Corrected Canonical Status Model

To restore absolute integrity to the engineering and product registries, the monolithic `QA_VERIFIED` label must be replaced with the seven independent dimensional statuses:

| Implementation Dimension | Corrected Canonical Status | Justification & Verification Evidence |
|---|:---:|---|
| **Design Specification (`Spec`)** | **`APPROVED` (113/113)** | Product requirements, user roles, and workflows are fully documented. |
| **UI Presentation (`UI`)** | **`UI_SIMULATION` (110/113)**<br>**`IMPLEMENTED` (3/113)** | Screens are visually rendered but require complete redesign to remove developer badges, nested cards, and outdated palettes. |
| **Frontend Interaction (`Interaction`)** | **`PARTIALLY_IMPLEMENTED` (101/113)**<br>**`VERIFIED` (12/113)** | Identity and RBAC screens operate live. Marketplace screens operate on local React state. Map and camera controls are placeholders. |
| **API Integration (`API`)** | **`LIVE_PHASE_1B` (12/113)**<br>**`DEFERRED_PHASE_3` (98/113)**<br>**`N/A` (3/113)** | Fastify endpoints exist strictly for Identity, Sessions, RBAC, and Security Audit. Marketplace domain endpoints are deferred. |
| **Backend Business Logic (`Backend`)** | **`LIVE_PHASE_1B` (12/113)**<br>**`DEFERRED_PHASE_3` (98/113)**<br>**`N/A` (3/113)** | Booking state machine, PayHere gateway, capacity locking, and payout batching engines are not implemented in `apps/api`. |
| **Database Persistence (`DB`)** | **`LIVE_PHASE_1B` (12/113)**<br>**`DEFERRED_PHASE_3` (98/113)**<br>**`N/A` (3/113)** | Identity and audit tables exist (`0000`–`0005`). No marketplace tables (`bookings`, `storage_locations`, `luggage_items`) exist. |
| **Quality Assurance (`QA`)** | **`TEST_VERIFIED_SIMULATION`** | Automated unit tests pass against preview state; end-to-end UX is unverified. |
