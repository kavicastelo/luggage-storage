# Phase 2C.5 — Host Mobile Application Preflight & Specification
## Document 37: Workstream 5 (`WS-5-HOST-MOB`) Preflight Analysis & Technical Architecture Specification

**Project:** Global Luggage Storage Marketplace (`https://github.com/kavicastelo/luggage-storage`)  
**Document ID:** `DOC-UX-P2C-037`  
**Phase:** Phase 2C.5 — Host Mobile Application (`WS-5-HOST-MOB`)  
**Feature Branch:** `feat/phase-2c-host-mobile`  
**Verified Starting Commit:** `1eaa289e1bd1fc1b1b76779e93a40192f087af01` (Handover from Phase 2C.4.1 Host Web Independent Verification)  
**Parent Delivery:** Phase 2C.4.1 — Host Web Independent Verification  
**Canonical Backlog:** `TSK-2C-021` through `TSK-2C-025`  
**Target Application:** `apps/mobile` (`apps/mobile/app/(host)/`)  
**Design System:** Ceylon Warmth & Coastal Precision (CWCP)  
**Governing Documents:**  
- `02-canonical-screen-inventory.md`  
- `15-evidence-and-verification-register.md` (`DOC-UX-P2C-015`)  
- `16-product-decisions-required.md` (`DOC-UX-P2C-016`)  
- `18-phase-2c-implementation-backlog.md` (`DOC-UX-P2C-018`)  
- `19-phase-2c-qa-and-release-gates.md` (`DOC-UX-P2C-019`)  
- `22-phase-2c-workstream-execution-plan.md` (`DOC-UX-P2C-022`)  
- `35-phase-2c-host-web-independent-audit.md` (`DOC-UX-P2C-035`)  
- `36-phase-2c-host-web-remediation-register.md` (`DOC-UX-P2C-036`)

---

## 1. Executive Mission & Preflight Verification

### 1.1 Mission
Implement Workstream 5 (`WS-5-HOST-MOB`) as a coherent, mobile-first operational application for luggage storage partner business owners and counter staff.

The existing Host Mobile implementation is a developer-oriented screen switcher (`app/(host)/index.tsx`) containing approximately 31 active screen experiences mapped directly to internal tracking codes (`HM-001` through `HM-031`). This workstream replaces that developer hub with a clean, five-tab navigation architecture:
1. **Live Desk:** Real-time operational overview, expected arrivals, expected pickups, overdue baggage alerts, and quick actions for scanning and counter intake.
2. **Requests:** Practical queue of customer booking and service requests with search, status filters (`CONFIRMED`, `CHECKED_IN`, `OVERDUE`, `COMPLETED`), bag counts, and customer summary.
3. **Vault:** Active stored-luggage backroom inventory sorted by collection time, overdue alert indicators with elapsed time, and simulated pickup release workflows.
4. **Earnings:** Mobile financial overview with clear gross vs. net host earnings separation, platform commission calculations, and collapsible transaction history.
5. **Settings:** Host partner profile, active location hub, operating hours, staff directory, and transparent prototype compliance disclaimers.

### 1.2 Repository & Ancestry Preflight
- **Current Branch:** `feat/phase-2c-host-mobile`
- **Lineage Base:** Commit `1eaa289e1bd1fc1b1b76779e93a40192f087af01` on branch `audit/phase-2c-host-web-verification`.
- **Preflight Verification Checklist:**
  - [x] Branch `feat/phase-2c-host-mobile` created directly from verified commit `1eaa289`.
  - [x] Working tree clean; zero uncommitted modifications.
  - [x] Parent history intact; no history rewrites or force pushes performed.
  - [x] Will never merge directly into `main`.

### 1.3 Baseline Codebase & Quality Health
Prior to writing implementation code, the baseline test suites, compiler, and linters were executed:
- **Monorepo Tests:** 448 tests passing across contracts, web, mobile, and API.
- **Mobile Test Suite:** 10 test files passed, 64/64 tests passed (`pnpm --filter @luggage-storage/mobile test`).
- **Mobile TypeScript:** Clean compilation, 0 errors (`pnpm --filter @luggage-storage/mobile typecheck`).
- **Mobile ESLint:** Clean static analysis, 0 errors, 0 warnings (`pnpm --filter @luggage-storage/mobile lint`).
- **Installed Stack Compatibility:**
  - Expo SDK: `~58.0.23`
  - React: `19.3.0`
  - React Native: `0.88.1`
  - Expo Router: `~58.0.30`
  - `expo-camera`: `~58.0.14` (installed and verified compatible with Expo SDK 58).

---

## 2. Workstream Architecture & Navigation Specification

### 2.1 File & Route Structure
The Host Mobile experience is implemented cleanly in `apps/mobile/app/(host)/`:

```text
apps/mobile/app/(host)/
├── _layout.tsx         # Host shell with bottom tab bar, RBAC guard, demo banner
├── index.tsx           # Tab 1: Live Desk (Counter kiosk landing)
├── requests.tsx        # Tab 2: Requests (Booking requests list & filters)
├── vault.tsx           # Tab 3: Vault (Active stored bags & release modal)
├── earnings.tsx        # Tab 4: Earnings (Gross/net breakdown & history)
├── settings.tsx        # Tab 5: Settings (Host profile, hubs, team, KYC)
├── scanner.tsx         # Modal/Stack: Camera barcode scanner & PIN fallback
└── intake.tsx          # Modal/Stack: 3-stage guided intake wizard
```

### 2.2 Shell & Bottom Tab Navigation (`_layout.tsx`)
- Uses Expo Router `<Tabs>` component matching the CWCP design system established in Traveller Mobile:
  - `backgroundColor: mobileColors.navy[900]` (`#0F172A`)
  - `borderTopColor: mobileColors.navy[800]` (`#1E293B`)
  - `tabBarActiveTintColor: mobileColors.terracotta[500]` (`#D95A2B`)
  - `tabBarInactiveTintColor: mobileColors.sand[600]` (`#8C827A`)
- Bottom tab bar renders 5 persistent tabs with accessible labels and icons:
  - Tab 1: `index` (Live Desk) — Icon: `clock`
  - Tab 2: `requests` (Requests) — Icon: `bell`
  - Tab 3: `vault` (Vault) — Icon: `lock`
  - Tab 4: `earnings` (Earnings) — Icon: `award`
  - Tab 5: `settings` (Settings) — Icon: `user`
- Workflow sub-routes (`scanner` and `intake`) are registered with `options={{ href: null }}` so they open as focused full-screen operational workflows with explicit back navigation without breaking the persistent tab bar.

### 2.3 Authentication & RBAC Boundaries
- **Role Verification:** `_layout.tsx` checks `useAuthStore`:
  ```ts
  const isHostAuthorized =
    user?.roles?.includes("HOST_OWNER") ||
    user?.roles?.includes("HOST_STAFF") ||
    user?.roles?.includes("SUPERADMIN");
  ```
- **Access Guard:** If authenticated but not authorized (e.g. `TRAVELLER`), access is blocked with a 403 Forbidden message and a button to return to Traveller Mode.
- **Unauthenticated Demo Mode:** If `!isAuthenticated`, a top banner clearly discloses:
  `"Demo Preview Mode: Unauthenticated Host Mobile simulation."` with an instant link to Sign In.

---

## 3. Detailed Backlog Task Specifications

### 3.1 `TSK-2C-021`: Host Mobile Navigation Shell & 5-Tab Router
- **Priority:** `P0`
- **Scope:** Replace developer switcher with 5-tab application.
- **Tab 1: Live Desk (`index.tsx`):**
  - Host identity header: Active venue name, operating role (`Host Owner` vs `Host Staff`), active storage capacity metrics (e.g. 28/45 bags in vault).
  - Quick Action Buttons: "Scan Luggage Pass" (`/scanner`) and "Manual Intake Wizard" (`/intake`).
  - Movement KPIs: Today's expected arrivals, today's pickups, overdue bag notices.
  - Active Movement Queue: List of today's customer handovers with rapid action buttons.
- **Tab 2: Requests Hub (`requests.tsx`):**
  - Search bar filtering by customer name or booking reference.
  - Status filter pills: `ALL`, `CONFIRMED`, `IN_STORAGE`, `OVERDUE`, `COMPLETED`.
  - Item cards displaying customer name, booking reference, bag breakdown, arrival window, and SLA review action.
- **Tab 3: Vault Monitor (`vault.tsx`):**
  - Vault inventory list sorted by expected pickup time.
  - Storage zone code pill (e.g. `Zone RACK-A`), tamper seal numbers, and photo evidence indicator.
  - Overdue badge with elapsed time calculation.
  - "Release Baggage" button triggering pickup confirmation modal.
- **Tab 4: Earnings & Ledger (`earnings.tsx`):**
  - Financial KPI metrics: Today's Revenue, This Week's Revenue, Pending Settlement.
  - Revenue Split Card: Gross Booking Volume, Platform Fee (15%), Net Host Payout (85%).
  - Collapsible transaction history with itemized booking references and cleared status.
- **Tab 5: Settings & Hubs (`settings.tsx`):**
  - Storage location profile summary (Colombo Fort Vault).
  - Operating hours & holiday schedule.
  - Team directory view (Roshan Fernando - Counter Supervisor).
  - Honest KYC & Legal Profile Preview (clearly marked as demonstration fixtures).

---

### 3.2 `TSK-2C-022`: Camera Scanner & PIN Fallback (`scanner.tsx`)
- **Priority:** `P0`
- **Implementation Structure:**
  - **Camera Permission Handling:** Checks `useCameraPermissions()`. If denied or undetermined, renders clear permission explanation with request button.
  - **Live Camera Viewfinder:** Uses `CameraView` with `facing="back"`, `barcodeScannerSettings={{ barcodeTypes: ["qr"] }}`, and `onBarcodeScanned`.
  - **Animated Laser Reticle & Torch Toggle:** Viewfinder displays laser targeting line and flashlight toggle button (`enableTorch`).
  - **Web/Simulator Fallback:** In web/headless environments where native camera hardware is unavailable, renders a simulated scan trigger panel allowing instant selection of valid test luggage passes.
  - **Instant PIN Fallback Tab:** Two-segment tab switcher (`Camera Scan` vs `Enter 6-Digit PIN`). PIN mode provides 6 numeric input boxes, numeric keypad support, clear button, and rate-limited lookup feedback.
  - **Demo Lookup Mapping:** Matches scanned payload or PIN against `DEMO_HOST_BOOKINGS` and navigates directly to `intake.tsx?ref={bookingRef}` upon successful match.
  - **Security & Transparency:** Explicitly avoids claiming cryptographic validation or offline HMAC verification (`DEC-005` pending). Labeled as "Demo Session Lookup".

---

### 3.3 `TSK-2C-023`: Guided Counter Intake & Seal Tagging Wizard (`intake.tsx`)
- **Priority:** `P0`
- **Workflow Sequence:**
  - **Stage 1 — Booking & Bag Reconciliation:**
    - Displays booking reference, customer name, and customer-declared bag tier breakdown.
    - Counter staff bag counter input (reconciled physical count).
    - If reconciled count differs from declared count, displays non-blocking discrepancy advisory.
  - **Stage 2 — Security Seal Tagging:**
    - Requires entry of tamper-evident security seal serial (e.g. `SEAL-LK-90211`).
    - Input validation checks format (`SEAL-LK-XXXXX`).
    - Explicit prototype disclaimer: *"Tamper seal serials are logged to local workstation session state for demonstration (DEC-007 pending marketplace hardware approval)."*
  - **Stage 3 — Photo Evidence & Optional Bypass:**
    - Photo capture interface with sample photo preview.
    - One-tap bypass button: *"Skip Photo Evidence (DEC-001 Prototype Option — No Visible Pre-existing Damage)"*.
    - Re-take and remove actions.
  - **Confirmation & Custody Activation:**
    - Summary of bag count, seal serial, zone placement (`RACK-A`), and photo status.
    - "Activate Custody Storage" action updates local Zustand state (`useHostStore`) to `IN_STORAGE`.
    - Confirmation notice states: *"Local Prototype Simulation: Custody updated in session state (requires backend API in Phase 3+)."*

---

### 3.4 `TSK-2C-024`: Active Vault Monitor & Overdue Alerts (`vault.tsx`)
- **Priority:** `P1`
- **Inventory Sorting & Determinism:**
  - Bags currently in vault (`IN_STORAGE` or `OVERDUE`) are sorted chronologically by expected pickup timestamp.
- **Overdue Calculation:**
  - Uses timestamp comparison against simulated reference clock (`19:00 IST`).
  - Overdue items display a prominent terracotta/red badge: `OVERDUE (30m grace elapsed)`.
  - Discloses proposed late extension surcharge as an illustrative calculation (`DEC-002 Pending PO Sign-Off`).
- **Pickup Release Dialog:**
  - Tapping "Release Baggage" opens modal showing booking summary, reconciled bag count, and seal serial.
  - Action updates local record to `COMPLETED` and decrements active vault counter.
  - Discloses: *"In accordance with platform policy, baggage release is never withheld for overdue fee collection."*

---

### 3.5 `TSK-2C-025`: Earnings & Payout Ledger (`earnings.tsx`)
- **Priority:** `P2`
- **Revenue Calculations:**
  - For every booking and total:
    $$\text{Net Host Earnings} = \text{Gross Booking Volume} - \text{Platform Fee (15\%)}$$
  - Clearly disclosed as sample 85/15 calculation (`DEC-006 Pending PO Sign-Off`).
- **Collapsible Transaction History:**
  - Expandable/collapsible transaction list showing booking reference, date, customer name, gross amount, platform deduction, and net host earnings.
  - Formatted consistently in Sri Lankan Rupees (`LKR`).

---

## 4. State Management & Data Isolation

### 4.1 Dedicated Host Data Layer (`apps/mobile/src/data/mock-host-data.ts`)
All fixtures and simulation data are isolated in a single dedicated module:
- `DEMO_HOST_HUB`: Colombo Fort Station Heritage Vault (`loc-cmb-fort-01`).
- `DEMO_HOST_BOOKINGS`: Canonical array of 6 distinct booking records spanning all operational states (`CONFIRMED`, `IN_STORAGE`, `OVERDUE`, `COMPLETED`, `CANCELLED`).
- `DEMO_HOST_TRANSACTIONS`: Itemized financial records for weekly settlement.
- `DEMO_PIN_LOOKUPS`: Key-value lookup dictionary mapping PINs (`482910`, `739204`, `661928`, `194820`) to booking records.

### 4.2 Zustand Host Store (`apps/mobile/src/store/useHostStore.ts`)
Manages live client state across tab navigations:
- `bookings`: Active booking list initialized from `DEMO_HOST_BOOKINGS`.
- `activeLocationId`: Selected storage hub.
- `intakeSession`: In-progress intake form state (booking, reconciled count, seal serial, photo status).
- `actions`:
  - `lookupByPin(pin: string)`
  - `lookupByQr(payload: string)`
  - `startIntake(booking: DemoHostBooking)`
  - `completeIntake(intakeData: ...)`
  - `releaseLuggage(bookingId: string)`
  - `resetToDefaults()`

---

## 5. Governance & Pending Product Decision Alignment

| Decision ID | Canonical Topic | Host Mobile Implementation Boundary |
|---|---|---|
| `DEC-001` | Intake Photo Evidence | Labeled as proposed prototype option. 1-tap bypass provided. Mandatory enforcement avoided. |
| `DEC-002` | Overdue Fee Policy | Bags released on demand without withholding physical custody. Surcharges labeled as illustrative estimates. |
| `DEC-005` | Offline Cryptographic QR | QR and PIN lookups clearly labeled as local demo session lookups, not cryptographic verification. |
| `DEC-006` | Payout Cadence & Split | 85/15 revenue split and weekly batch settlement labeled as illustrative figures pending PO sign-off. |
| `DEC-007` | Security Seal Sourcing | Seal entry is functional prototype input; explicitly disclosed as not backed by inventory hardware. |
| `DEC-010` | Partner Trust Taxonomy | "Verified Commercial Partner" and "Approved KYC" claims strictly omitted. Labeled as demo simulation. |

---

## 6. Test & Quality Gate Plan

- **Automated Interaction Tests:** Authored in `apps/mobile/tests/host-mobile-journeys.test.ts`:
  1. Five-tab navigation and screen rendering tests (`Live Desk`, `Requests`, `Vault`, `Earnings`, `Settings`).
  2. Scanner camera permission states and PIN lookup matching.
  3. 3-stage guided intake wizard validation (bag reconciliation, seal validation, photo bypass, state update).
  4. Vault inventory sorting, overdue calculation, and release dialog interaction.
  5. Earnings gross vs. net calculations mathematical verification.
  6. Strict suppression of developer codes (`HM-001`, `HM-021`, etc.) from all screens.
  7. Role-based access control and demo preview mode verification.
- **Monorepo Quality Gates:**
  - `pnpm --filter @luggage-storage/mobile test` must achieve 100% pass.
  - `pnpm --filter @luggage-storage/mobile typecheck` must pass with 0 errors.
  - `pnpm --filter @luggage-storage/mobile lint` must pass with 0 errors, 0 warnings.
  - Monorepo `pnpm test` must maintain 100% pass rate.
