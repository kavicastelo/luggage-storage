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

#### 1.2 Canonical Definition of What Constitutes a Screen

To prevent inconsistent counting across documentation, a "Screen" within this project is strictly defined as follows:

1. **Inclusion Criteria (What Counts as a Screen):**
   - **Distinct User Viewport & Intent:** A dedicated visual destination rendered to serve a primary user objective within a documented user journey.
   - **Discrete State & Navigation Target:** An independent route destination on web (e.g. `/search`, `/locations/:slug`, `/checkout/:id`, `/portal/bookings`) or an independent navigation stack/tab target in mobile.
   - **Dedicated Workflow Modal:** A modal dialog that completely captures user interaction for a separate sub-workflow and has an assigned registry ID (e.g. `TM-014` Filter Modal, `HD-008` Booking Details Modal).

2. **Exclusion Criteria (What Does NOT Count as a Separate Screen):**
   - **UI Sub-components:** Reusable buttons, cards, list items, headers, footers, or bottom sheets that exist only as parts of a parent screen.
   - **Transient Micro-Feedback:** Notification toasts, validation tooltips, or loading spinners.
   - **Developer Switcher Cards:** The individual cards rendered inside the developer testing hubs (`app/(traveller)/index.tsx` and `app/(host)/index.tsx`) do NOT count as separate screens; they are merely launcher controls that preview the registered screens.

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

### 3. Canonical Eight-Dimensional Status Model

To restore absolute integrity across all engineering and product documentation, the monolithic `QA_VERIFIED` label is replaced with the **authoritative Eight-Dimensional Status Model**. Every dimension operates independently:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        EIGHT INDEPENDENT STATUS DIMENSIONS                             │
├───────────────┬────────────────────────────────────────────────────────────────────────┤
│ Dimension     │ Permitted Enumeration Values                                           │
├───────────────┼────────────────────────────────────────────────────────────────────────┤
│ Specification │ SPEC_NOT_FOUND | SPEC_PARTIAL | SPEC_DEFINED | SPEC_APPROVED            │
│ UI Status     │ NOT_IMPLEMENTED | STRUCTURE_ONLY | UI_SIMULATION | FUNCTIONAL_UI |     │
│               │ VERIFIED_UI                                                            │
│ Interaction   │ NOT_IMPLEMENTED | STATIC | LOCAL_STATE_ONLY | FUNCTIONAL_INTERACTION |  │
│               │ VERIFIED_INTERACTION                                                   │
│ API Integ     │ NOT_AVAILABLE | NOT_CONNECTED | PARTIALLY_CONNECTED | CONNECTED |       │
│               │ VERIFIED_INTEGRATION                                                   │
│ Backend Logic │ NOT_IMPLEMENTED | PARTIALLY_IMPLEMENTED | IMPLEMENTED |                │
│               │ VERIFIED_BACKEND                                                       │
│ Database      │ NOT_REQUIRED | NOT_IMPLEMENTED | PARTIALLY_IMPLEMENTED | IMPLEMENTED |   │
│               │ VERIFIED_PERSISTENCE                                                   │
│ End-to-End    │ NOT_TESTED | BLOCKED | FAILED | PARTIALLY_VERIFIED | VERIFIED          │
│ Evidence      │ NONE | SOURCE_ONLY | SCREENSHOT_CAPTURED | AUTOMATED_TESTED |          │
│               │ DEVICE_VERIFIED                                                        │
└───────────────┴────────────────────────────────────────────────────────────────────────┘
```

#### 3.1 Dimension Definitions & Exact Current Baseline Counts (All 113 Marketplace Screens)

| Dimension | Permitted Status Values & Definitions | Baseline Count (113 Active Screens) |
|---|---|---|
| **1. Specification (`Spec`)** | • `SPEC_NOT_FOUND`: No requirement exists.<br>• `SPEC_PARTIAL`: Incomplete user stories.<br>• `SPEC_DEFINED`: Documented in UX Registry & Workflow matrices.<br>• `SPEC_APPROVED`: Formally signed off by Product Owner. | • `SPEC_DEFINED`: **113 (100%)**<br>• `SPEC_APPROVED`: **0 (0%)** (Pending `16-product-decisions-required.md` sign-off) |
| **2. Visual/UI Status (`UI`)** | • `NOT_IMPLEMENTED`: No UI code exists.<br>• `STRUCTURE_ONLY`: Empty container/card.<br>• `UI_SIMULATION`: Prototype card/table with mock data & leaked tags.<br>• `FUNCTIONAL_UI`: Clean production-styled view without dev tags.<br>• `VERIFIED_UI`: Visually audited on all target viewports. | • `FUNCTIONAL_UI`: **3 (2.7%)** (`PW-007, 008, 010`)<br>• `UI_SIMULATION`: **109 (96.5%)**<br>• `STRUCTURE_ONLY`: **1 (0.9%)** (`AD-013`) |
| **3. Interaction (`Interaction`)** | • `NOT_IMPLEMENTED`: No event handlers.<br>• `STATIC`: Read-only text.<br>• `LOCAL_STATE_ONLY`: React `useState` only, resets on reload.<br>• `FUNCTIONAL_INTERACTION`: Full optimistic state & navigation.<br>• `VERIFIED_INTERACTION`: End-to-end verified on device. | • `FUNCTIONAL_INTERACTION`: **3 (2.7%)** (`PW-006, 008`, `AD-017`)<br>• `LOCAL_STATE_ONLY`: **103 (91.2%)**<br>• `STATIC`: **6 (5.3%)**<br>• `NOT_IMPLEMENTED`: **1 (0.9%)** (`AD-013`) |
| **4. API Integration (`API`)** | • `NOT_AVAILABLE`: No backend API exists or is needed.<br>• `NOT_CONNECTED`: API exists but screen uses local mock data.<br>• `PARTIALLY_CONNECTED`: Live session auth; domain data mocked.<br>• `CONNECTED`: Live HTTP/WS to all required endpoints.<br>• `VERIFIED_INTEGRATION`: Contract-tested with error handling. | • `CONNECTED`: **2 (1.8%)** (`AD-017`, `PW-006`)<br>• `PARTIALLY_CONNECTED`: **10 (8.8%)**<br>• `NOT_CONNECTED`: **98 (86.7%)**<br>• `NOT_AVAILABLE`: **3 (2.7%)** (Static) |
| **5. Backend Logic (`Backend`)** | • `NOT_IMPLEMENTED`: No controller or service in `apps/api`.<br>• `PARTIALLY_IMPLEMENTED`: Stubs or unverified logic.<br>• `IMPLEMENTED`: Full Fastify service and business logic.<br>• `VERIFIED_BACKEND`: Unit & integration tested with DB rollback. | • `IMPLEMENTED`: **12 (10.6%)** (Identity, RBAC, Sessions, Security Audit)<br>• `NOT_IMPLEMENTED`: **98 (86.7%)** (Booking/custody domain)<br>• `NOT_REQUIRED`: **3 (2.7%)** (Static) |
| **6. Database Persistence (`DB`)** | • `NOT_REQUIRED`: Static content, no DB needed.<br>• `NOT_IMPLEMENTED`: Target database tables do not exist.<br>• `PARTIALLY_IMPLEMENTED`: Tables exist without relational integrity.<br>• `IMPLEMENTED`: Production Drizzle schema with audit triggers.<br>• `VERIFIED_PERSISTENCE`: Transaction rollback tested. | • `IMPLEMENTED`: **12 (10.6%)** (PostgreSQL migrations `0000`–`0005`)<br>• `NOT_IMPLEMENTED`: **98 (86.7%)** (No booking/vault tables)<br>• `NOT_REQUIRED`: **3 (2.7%)** (Static) |
| **7. End-to-End Status (`E2E`)** | • `NOT_TESTED`: No automated or manual verification.<br>• `BLOCKED`: Missing dependency blocks test execution.<br>• `FAILED`: Automated or manual test failed.<br>• `PARTIALLY_VERIFIED`: Partial journey verified (mock tests pass).<br>• `VERIFIED`: Complete user journey verified against live DB. | • `PARTIALLY_VERIFIED`: **109 (96.5%)**<br>• `VERIFIED`: **3 (2.7%)** (`PW-007, 008, 010`)<br>• `BLOCKED`: **1 (0.9%)** (`AD-013`) |
| **8. Evidence Level (`Evidence`)** | • `NONE`: No evidence available.<br>• `SOURCE_ONLY`: Source code verified on disk.<br>• `SCREENSHOT_CAPTURED`: Genuine PNG captured on running server.<br>• `AUTOMATED_TESTED`: Vitest test passing in CI.<br>• `DEVICE_VERIFIED`: Physically verified on real iOS/Android. | • `SCREENSHOT_CAPTURED`: **113 (100%)**<br>• `AUTOMATED_TESTED`: **113 (100%)**<br>• `DEVICE_VERIFIED`: **0 (0%)** (Physical mobile unverified) |
