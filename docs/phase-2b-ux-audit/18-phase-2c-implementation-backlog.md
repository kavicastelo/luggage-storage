# Phase 2C — Implementation Backlog & Engineering Task Catalog
## Document 18: Implementation Backlog with Acceptance Criteria

**Project:** Global Luggage Storage Marketplace (`https://github.com/kavicastelo/luggage-storage`)  
**Document ID:** `DOC-UX-P2C-018`  
**Phase:** Phase 2C — Product Experience Re-Architecture  
**Baseline Git Commit:** `cca134f4a0f909a907f6395f9647a025ac39d71a`  
**Date:** November 9, 2026  
**Auditor / Author:** Principal Product Architect & Lead Technical Program Manager  

---

### 1. Backlog Phasing & Sprint Architecture

Phase 2C is organized into five structured two-week engineering sprints to ensure a seamless, non-breaking progression from shared tokens to production surface overhauls:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PHASE 2C FIVE-SPRINT EXECUTION ROADMAP                          │
├──────────┬─────────────────────────────────────────────────────────────┬───────────────┤
│ Sprint   │ Focus Area & Deliverables                                   │ Core Tasks    │
├──────────┼─────────────────────────────────────────────────────────────┼───────────────┤
│ Sprint 1 │ Shared CWCP Tokens, Mascot WebP Pipeline, Code Suppression  │ TSK-001 - 003 │
│ Sprint 2 │ Public Web Discovery, Interactive MapLibre & Checkout Flow │ TSK-004 - 007 │
│ Sprint 3 │ Mobile Architecture Restructure (Tabs & Navigation Stacks)  │ TSK-008 - 010 │
│ Sprint 4 │ Host Web Counter Desk & Mobile Hardware Scanner Integration │ TSK-011 - 014 │
│ Sprint 5 │ Superadmin Disputes Hub, Verification Queue, QA Gates       │ TSK-015 - 020 │
└──────────┴─────────────────────────────────────────────────────────────┴───────────────┘
```

---

### 2. Prioritized Task Catalog & Acceptance Criteria

---

#### Task `TSK-2C-001`: Shared CWCP Design Tokens & Tailwind Configuration
- **Priority:** **P0** (Sprint 1 Block)
- **Target Surfaces:** Cross-Platform (`packages/ui` / `packages/contracts`, `apps/web`, `apps/mobile`)
- **Current Behavior:** Colors are scattered across components with hardcoded Tailwind slate/indigo/purple classes. No unified brand color definition exists.
- **Expected Behavior:** Shared design tokens package exports authoritative CWCP tokens: Primary Navy (`#0A192F`), Brand Terracotta (`#E86F2C`), Warm Sand (`#FAF8F5`), and semantic status colors. Consumed by `tailwind.config.js` in `apps/web` and Nativewind in `apps/mobile`.
- **Dependencies:** None.
- **Acceptance Criteria:**
  1. `packages/contracts/src/tokens.ts` (or `@luggage-storage/ui`) defines typed token constants for colors, font families, font sizes, line heights, border radii, and spatial units.
  2. `apps/web/tailwind.config.js` extends theme using the shared tokens.
  3. `apps/mobile/tailwind.config.js` (or Nativewind theme) imports identical color definitions.
  4. Zero hardcoded arbitrary hex codes (e.g. `#1e293b`) remain in shared layout components.
- **Test Requirements:** Automated unit test in `packages/contracts/test/tokens.test.ts` verifying all token values and contrast ratios $\ge 4.5:1$.

---

#### Task `TSK-2C-002`: Automated Mascot WebP Derivative Pipeline
- **Priority:** **P1** (Sprint 1)
- **Target Surfaces:** Asset Infrastructure (`apps/web/public/assets/mascot/`, `Assets/`)
- **Current Behavior:** 20 original uncompressed PNG files consume 29.54 MB (~1.5 MB each), causing severe mobile page load latency and high bandwidth consumption.
- **Expected Behavior:** Automated build script reads original PNGs and outputs high-quality compressed WebP derivatives into `apps/web/public/assets/mascot/webp/` at $80\%$ quality. Original PNGs remain 100% preserved and untouched.
- **Dependencies:** None.
- **Acceptance Criteria:**
  1. Build script `scripts/optimize-mascot-assets.mjs` executes cleanly via `pnpm run assets:optimize`.
  2. All 20 original PNG files in `Assets/` and `apps/web/public/assets/mascot/` retain their exact original filenames, timestamps, and bytes.
  3. Total WebP asset payload is $\le 2.5$ MB (a $>90\%$ payload reduction).
  4. `MascotIllustration` component renders responsive `<picture>` tags with `<source type="image/webp">` and PNG fallback.
- **Test Requirements:** CI test verifying that WebP derivative files exist for all 20 mascot variants and that original PNG checksums are unmodified.

---

#### Task `TSK-2C-003`: Universal Customer-Facing Tracking Code Suppression & Developer Drawer
- **Priority:** **P0** (Sprint 1 Block)
- **Target Surfaces:** All Surfaces (`apps/web`, `apps/mobile`)
- **Current Behavior:** End-user screens prominently render developer badges (`PW-001`, `HD-008`, `AD-013`, `WF-xxx`), simulation banners, and mock status controls.
- **Expected Behavior:** Zero internal tracking codes or workflow IDs are visible in normal UI. All diagnostic controls are encapsulated in a hidden Developer Drawer accessible only via `Ctrl+Shift+D` or `?debug=true` in non-production builds.
- **Dependencies:** `TSK-2C-001`.
- **Acceptance Criteria:**
  1. No occurrence of `PW-xxx`, `HD-xxx`, `AD-xxx`, `TM-xxx`, `HM-xxx`, or `WF-xxx` appears in rendered DOM text nodes or visible labels during standard browsing.
  2. Developer Drawer component created and conditionally mounted only when `import.meta.env.DEV === true`.
  3. Navbar links to internal `/health` or debug pages removed from consumer navigation headers.
  4. Footer sitemap list removed from public consumer pages (`PW-001` through `PW-005`).
- **Test Requirements:** Automated DOM regression test searching for regex `/\b(PW|HD|AD|TM|HM)-\d{3}\b/` in production render output, asserting 0 matches.

---

#### Task `TSK-2C-004`: Public Web Landing & Search Hub Overhaul (`PW-001`, `PW-002`)
- **Priority:** **P0** (Sprint 2)
- **Target Surfaces:** Public Web (`apps/web/src/pages/LandingPage.tsx`, `SearchPage.tsx`)
- **Current Behavior:** Landing hero is basic with dark gradient card and `PW-001` badge. Search page displays cards with internal journey tags and a dark text box simulating a map.
- **Expected Behavior:** Inviting, travel-centric landing page with destination imagery, date/time/bag search bar, social proof, verified partner badges, and contextual welcome from Kiri.
- **Dependencies:** `TSK-2C-001`, `TSK-2C-003`.
- **Acceptance Criteria:**
  1. Clean, responsive hero section with clear value proposition and primary CTA button (`Find Storage Now`).
  2. Search bar accepts destination city, drop-off date/time, collection date/time, and bag count.
  3. Trust metrics section displaying verified luggage stats (e.g. "Over 50,000 bags stored safely").
  4. Fully responsive on mobile ($390\text{px}$) and desktop ($1280\text{px}$).
- **Test Requirements:** Vitest component test in `PublicWebScreens.test.tsx` verifying search parameter propagation to `/search`.

---

#### Task `TSK-2C-005`: Interactive MapLibre GL Integration on Web Search (`PW-002`)
- **Priority:** **P0** (Sprint 2)
- **Target Surfaces:** Public Web (`apps/web/src/components/map/LocationMap.tsx`)
- **Current Behavior:** Search page renders a non-interactive dark div containing static text: `"Interactive MapLibre Map (Lat: 6.9344, Lng: 79.8512)"`.
- **Expected Behavior:** High-performance, interactive MapLibre GL map rendering OpenStreetMap tiles, customizable partner marker pins with price pills (e.g. `LKR 250`), clustering, and synchronized hover highlighting between listing card and map pin.
- **Dependencies:** `TSK-2C-004`.
- **Acceptance Criteria:**
  1. MapLibre GL map mounts successfully without WebGL errors.
  2. Partner pins render at correct geographic coordinates.
  3. Clicking a pin opens an interactive popup showing partner photo, rating, and "Book" button.
  4. Clean fallback message displayed if WebGL is disabled or unsupported.
- **Test Requirements:** Unit test verifying map container initialization and marker array data binding.

---

#### Task `TSK-2C-006`: Location Details, Transparent Pricing & Checkout Redesign (`PW-003`–`PW-005`)
- **Priority:** **P0** (Sprint 2)
- **Target Surfaces:** Public Web (`LocationDetailsPage.tsx`, `BookingCheckoutPage.tsx`, `BookingConfirmationPage.tsx`)
- **Current Behavior:** Dense policy text paragraphs, simulation warning notices, and buttons labeled `Proceed to Payment (PW-005)`.
- **Expected Behavior:** Streamlined, high-trust booking flow: photo gallery, amenity badges (CCTV, 24/7), clear price itemization, instant form validation, and clean printable confirmation pass with SVG QR code.
- **Dependencies:** `TSK-2C-001`, `TSK-2C-003`.
- **Acceptance Criteria:**
  1. Location details page features photo gallery and structured operating hours table.
  2. Checkout displays transparent fee breakdown: Storage Fee + Luggage Guarantee + Taxes = Total.
  3. Confirmation screen displays booking reference in monospace font, QR code, partner address, and counter arrival instructions.
  4. Zero developer status tags or phase numbers rendered.
- **Test Requirements:** Vitest user journey test executing full booking checkout and asserting correct price calculations.

---

#### Task `TSK-2C-007`: Traveller Portal & Self-Service Booking Hub (`PW-011`)
- **Priority:** **P1** (Sprint 2)
- **Target Surfaces:** Public Web (`apps/web/src/pages/TravellerPortalPage.tsx`)
- **Current Behavior:** Basic table displaying mock bookings with raw status strings and an unstyled refund stepper.
- **Expected Behavior:** User-friendly self-service hub with status tabs (`Active`, `Upcoming`, `Completed`, `Cancelled`), 1-tap view pass button, directions link, extension request modal, and transparent cancellation flow.
- **Dependencies:** `TSK-2C-006`.
- **Acceptance Criteria:**
  1. Active bookings show live custody status with countdown timer.
  2. 1-tap button to display full-screen custody pass with QR code.
  3. Cancellation modal provides clear explanation of refund policy and estimated refund amount.
- **Test Requirements:** Component test verifying tab switching and cancellation modal triggers.

---

#### Task `TSK-2C-008`: Mobile Navigation Restructuring (Tabs & Navigation Stacks)
- **Priority:** **P0** (Sprint 3 Block)
- **Target Surfaces:** Mobile Applications (`apps/mobile/app/(traveller)/`, `app/(host)/`)
- **Current Behavior:** Entire application operates as a monolithic developer screen-switcher hub rendering 39 traveller cards and 31 host cards.
- **Expected Behavior:** Standard mobile application architecture using Expo Router:
  - Traveller Mobile: Bottom tab bar (`Explore`, `My Storage`, `Saved`, `Help`, `Profile`) + native stack navigation.
  - Host Mobile: Bottom tab bar (`Live Desk`, `Requests`, `Vault`, `Earnings`, `Settings`) + modal stacks.
- **Dependencies:** `TSK-2C-001`.
- **Acceptance Criteria:**
  1. Bottom tab bar renders smoothly on iOS and Android viewports with active icons.
  2. Tapping tabs navigates between primary views without page reloads.
  3. Header stack provides native back buttons and titles on nested screens.
  4. Monolithic card switcher removed from standard user entry path.
- **Test Requirements:** Automated navigation test in `apps/mobile/test/Navigation.test.tsx` verifying tab route switching.

---

#### Task `TSK-2C-009`: Native Mobile Map & Discovery Experience (`TM-011`, `TM-012`)
- **Priority:** **P0** (Sprint 3)
- **Target Surfaces:** Traveller Mobile (`apps/mobile/app/(traveller)/explore.tsx`)
- **Current Behavior:** Exploration screen renders a basic text list with developer action buttons.
- **Expected Behavior:** Interactive map with fluid pan/zoom, GPS "near me" location button, custom partner map pins, and an interactive draggable bottom sheet listing partner details.
- **Dependencies:** `TSK-2C-008`.
- **Acceptance Criteria:**
  1. Map renders with custom style matching CWCP palette.
  2. Bottom sheet smoothly slides up/down between collapsed, half, and expanded states.
  3. Tapping a location card highlights the corresponding pin on the map.
- **Test Requirements:** Component test verifying map gesture handlers and bottom sheet snap states.

---

#### Task `TSK-2C-010`: Mobile Digital Custody Pass & Active Storage Timer (`TM-024`, `TM-030`)
- **Priority:** **P0** (Sprint 3)
- **Target Surfaces:** Traveller Mobile (`apps/mobile/app/(traveller)/pass.tsx`)
- **Current Behavior:** Card with static QR placeholder and simulated debug buttons.
- **Expected Behavior:** High-contrast ticket-style digital pass: high-density QR code, 6-digit monospace PIN (`482 910`), partner hotline dial button, walking directions link, and live active countdown timer with color progression.
- **Dependencies:** `TSK-2C-008`.
- **Acceptance Criteria:**
  1. Pass card styled with perforated ticket edges and high-contrast typography.
  2. Timer updates every second; transitions from Green to Amber ($<30$ min) to Red (overdue).
  3. QR code and PIN remain visible when device network connectivity is toggled off (offline caching).
- **Test Requirements:** Timer test verifying correct remaining time formatting and state transitions.

---

#### Task `TSK-2C-011`: Host Mobile Camera Scanner & Quick Intake Wizard (`HM-021`, `HM-013`, `HM-022`)
- **Priority:** **P0** (Sprint 4)
- **Target Surfaces:** Host Mobile (`apps/mobile/app/(host)/scanner.tsx`)
- **Current Behavior:** Screen simulates camera scanning by pre-filling the string `482910` into a text box.
- **Expected Behavior:** Functional `expo-camera` scanner with animated laser line viewfinder, torch toggle, and immediate haptic vibration on QR/barcode read. Numeric keypad PIN entry provided as instant secondary tab.
- **Dependencies:** `TSK-2C-008`.
- **Acceptance Criteria:**
  1. Camera permissions cleanly requested with descriptive explanation.
  2. Viewfinder displays targeting reticle; torch toggle button functions.
  3. Successful scan triggers haptic feedback and navigates to Intake Wizard (`HM-013`).
  4. PIN tab allows quick manual 6-digit PIN entry when camera is unavailable.
- **Test Requirements:** Component test verifying barcode scan callback handler and manual PIN fallback form.

---

#### Task `TSK-2C-012`: Host Web Dashboard Navigation & Overview Refactor (`HD-001`–`HD-006`)
- **Priority:** **P1** (Sprint 4)
- **Target Surfaces:** Host Web (`apps/web/src/pages/host/`)
- **Current Behavior:** Hardcoded `HD-xxx` prefixes on all sidebar links; body displays a 14-card sitemap grid.
- **Expected Behavior:** Clean collapsible navy sidebar with standard business labels; overview dashboard displaying operational KPIs (Current Bags, Available Capacity, Today's Check-ins, Pending Earnings).
- **Dependencies:** `TSK-2C-001`, `TSK-2C-003`.
- **Acceptance Criteria:**
  1. Sidebar navigation contains zero developer screen IDs.
  2. Overview dashboard displays real-time capacity progress bar.
  3. Space manager allows 1-click toggling of storage space availability.
- **Test Requirements:** Vitest component test in `HostDashboardScreens.test.tsx` verifying KPI card rendering.

---

#### Task `TSK-2C-013`: Host Live Counter Desk & Booking Ledger (`HD-007`–`HD-009`)
- **Priority:** **P0** (Sprint 4)
- **Target Surfaces:** Host Web (`HostOperationsDeskPage.tsx`, `HostBookingsLedgerPage.tsx`)
- **Current Behavior:** Table row buttons labeled `Investigate (HD-008)`; simulated counter desk.
- **Expected Behavior:** High-velocity counter kiosk mode: instant customer search by booking reference, name, or PIN; 1-click check-in; bag seal number logging; live overdue alert banners.
- **Dependencies:** `TSK-2C-012`.
- **Acceptance Criteria:**
  1. Counter search returns matching booking in $<100$ms.
  2. Check-in flow records intake timestamp and seal numbers.
  3. Overdue bags highlighted with prominent red badges and action buttons.
- **Test Requirements:** Component test verifying customer search filtering and check-in event triggering.

---

#### Task `TSK-2C-014`: Host Finance, Revenue Split & Payouts Center (`HD-010`, `HD-011`)
- **Priority:** **P1** (Sprint 4)
- **Target Surfaces:** Host Web (`HostFinancePage.tsx`, `HostPayoutSettingsPage.tsx`)
- **Current Behavior:** Hardcoded simulation cards and static revenue split numbers.
- **Expected Behavior:** Financial ledger displaying gross booking revenue, 15% platform commission deduction, net payout balance, payout history with bank reference, and downloadable CSV statement.
- **Dependencies:** `TSK-2C-012`.
- **Acceptance Criteria:**
  1. Clear 85/15 revenue split calculation visualized via breakdown bar.
  2. Payout settings form with bank account verification and IFSC/SWIFT validation.
  3. CSV export generates valid downloadable spreadsheet file.
- **Test Requirements:** Unit test verifying financial split mathematical accuracy and CSV format generation.

---

#### Task `TSK-2C-015`: Superadmin Disputes & Incidents Workbench (`AD-013`)
- **Priority:** **P0** (Sprint 5)
- **Target Surfaces:** Superadmin Web (`apps/web/src/pages/admin/AdminIncidentsPage.tsx`)
- **Current Behavior:** Static placeholder card displaying rule `OQ-015` with mascot Kiri shrugging. Zero functional dispute tools.
- **Expected Behavior:** Production dispute adjudication workbench: split-pane layout showing customer claim, host response, bag condition photos, custody timeline, liability determination tools, and refund authorization controls. **Zero mascot images.**
- **Dependencies:** `TSK-2C-001`, `TSK-2C-003`.
- **Acceptance Criteria:**
  1. Mascot Kiri completely removed from this screen.
  2. Split-pane interface displaying claim details, baggage photos, and custody audit log.
  3. Superadmin can approve partial/full refund or reject claim with mandatory written rationale.
- **Test Requirements:** Vitest test in `SuperadminScreens.test.tsx` verifying dispute workflow actions and absence of mascot elements.

---

#### Task `TSK-2C-016`: Superadmin KYC Host Onboarding & Verification Queue (`AD-002`, `AD-003`)
- **Priority:** **P1** (Sprint 5)
- **Target Surfaces:** Superadmin Web (`AdminHostReviewPage.tsx`, `AdminHostDirectoryPage.tsx`)
- **Current Behavior:** Static cards listing mock hosts with basic approve/reject buttons.
- **Expected Behavior:** Document inspection drawer for reviewing business licenses, front desk photographs, and identity documents. Approve/reject actions with canned compliance rejection reasons.
- **Dependencies:** `TSK-2C-001`.
- **Acceptance Criteria:**
  1. Document drawer provides full-resolution image zoom and inspection.
  2. Rejecting an application requires selecting at least one compliance reason code.
  3. Approved hosts automatically receive "Verified Partner" status.
- **Test Requirements:** Component test verifying document inspection drawer triggers and approval flow.

---

#### Task `TSK-2C-017`: Superadmin Financial Escrow, Refunds & System Settings (`AD-006`–`AD-008`, `AD-018`)
- **Priority:** **P1** (Sprint 5)
- **Target Surfaces:** Superadmin Web (`AdminEscrowPage.tsx`, `AdminRefundsPage.tsx`, `AdminPayoutsPage.tsx`)
- **Current Behavior:** Simulated tables with hardcoded values and static progress bars.
- **Expected Behavior:** Live ledger tables with sticky headers, pagination, transaction filtering, batch refund processing, and platform fee configuration controls.
- **Dependencies:** `TSK-2C-001`.
- **Acceptance Criteria:**
  1. Escrow ledger displays total locked funds across active bookings.
  2. Batch refund processing modal with confirmation summary.
  3. System fee configuration form with audit log tracking.
- **Test Requirements:** Component test verifying table filtering and batch refund state updates.

---

#### Task `TSK-2C-018`: Accessibility (WCAG 2.2 AA) & Responsive Touch Target Remediation
- **Priority:** **P0** (Sprint 5)
- **Target Surfaces:** All Surfaces (`apps/web`, `apps/mobile`)
- **Current Behavior:** Sub-44px touch targets on mobile filter chips; low-contrast text on dark cards ($<3:1$).
- **Expected Behavior:** 100% compliance with WCAG 2.2 Level AA: minimum $44\times 44$px touch bounding boxes, contrast ratio $\ge 4.5:1$ for normal text, and complete keyboard focus indicators.
- **Dependencies:** All previous tasks.
- **Acceptance Criteria:**
  1. Zero axe-core critical or serious accessibility violations across all 113 screens.
  2. All mobile buttons, chips, and links measure $\ge 44\times 44$px.
  3. Keyboard tab navigation functions with high-contrast terracotta focus rings.
- **Test Requirements:** Automated axe-core accessibility audit script running against all routes.

---

#### Task `TSK-2C-019`: End-to-End Vitest Component & Contract Test Expansion
- **Priority:** **P0** (Sprint 5)
- **Target Surfaces:** Automated Testing (`test/` directories across `web`, `mobile`, `contracts`)
- **Current Behavior:** 185 tests verify static data schemas and basic render output.
- **Expected Behavior:** Expanded test suite verifying interactive form submissions, modal dialogs, tab switching, and error boundary handling.
- **Dependencies:** All previous tasks.
- **Acceptance Criteria:**
  1. Total automated test count exceeds 250 tests.
  2. 100% test pass rate across all workspace packages.
  3. Zero deprecation warnings or unhandled promise rejections in test output.
- **Test Requirements:** Execute `pnpm test` across all packages in CI.

---

#### Task `TSK-2C-020`: Automated Visual Regression & Screenshot Capture Harness
- **Priority:** **P1** (Sprint 5 Release Gate)
- **Target Surfaces:** QA Tooling (`scripts/capture-all-screens.mjs`)
- **Current Behavior:** Ad-hoc PowerShell Chrome headless commands used to capture evidence.
- **Expected Behavior:** Standardized automated screenshot capture harness that spins up local servers, renders every registered screen at desktop and mobile viewports, and saves timestamped PNGs for release gating.
- **Dependencies:** All previous tasks.
- **Acceptance Criteria:**
  1. Single command `pnpm run test:visual` captures all 113 marketplace screens automatically.
  2. Compares rendered output against baseline screenshots with visual diff threshold $<0.5\%$.
  3. Generates an HTML visual audit report with side-by-side comparisons.
- **Test Requirements:** Script execution verified on local CI runner.

---

### 3. Task Dependency Graph & Traceability Matrix

```
[TSK-2C-001: Tokens] ────────┬───────────────┬────────────────────────┐
                             │               │                        │
                             ▼               ▼                        ▼
[TSK-2C-002: WebP Assets] [TSK-2C-003: Code Suppress] [TSK-2C-008: Mobile Navigation]
                             │               │                        │
                             ▼               ▼                        ▼
                      [PW: 004 - 007]  [HD: 012 - 014]         [TM/HM: 009 - 011]
                             │               │                        │
                             └───────────────┼────────────────────────┘
                                             │
                                             ▼
                                     [AD: 015 - 017]
                                             │
                                             ▼
                             [TSK-2C-018: A11y & Touch Standards]
                                             │
                                             ▼
                             [TSK-2C-019 / 020: QA Release Gates]
```

| Task ID | Surface | Priority | Primary File Impact | Est. Effort | Target Sprint |
|---|---|:---:|---|:---:|:---:|
| `TSK-2C-001` | Cross-Platform | **P0** | `packages/contracts/src/tokens.ts`, `tailwind.config.js` | 16 hrs | Sprint 1 |
| `TSK-2C-002` | Assets | **P1** | `scripts/optimize-mascot-assets.mjs`, `MascotIllustration.tsx` | 8 hrs | Sprint 1 |
| `TSK-2C-003` | Cross-Platform | **P0** | All page layouts, `apps/web/src/components/dev/` | 24 hrs | Sprint 1 |
| `TSK-2C-004` | Public Web | **P0** | `LandingPage.tsx`, `SearchPage.tsx` | 20 hrs | Sprint 2 |
| `TSK-2C-005` | Public Web | **P0** | `apps/web/src/components/map/LocationMap.tsx` | 24 hrs | Sprint 2 |
| `TSK-2C-006` | Public Web | **P0** | `LocationDetailsPage.tsx`, `BookingCheckoutPage.tsx` | 24 hrs | Sprint 2 |
| `TSK-2C-007` | Public Web | **P1** | `TravellerPortalPage.tsx` | 16 hrs | Sprint 2 |
| `TSK-2C-008` | Mobile | **P0** | `apps/mobile/app/(traveller)/`, `app/(host)/` | 32 hrs | Sprint 3 |
| `TSK-2C-009` | Mobile | **P0** | `apps/mobile/app/(traveller)/explore.tsx` | 24 hrs | Sprint 3 |
| `TSK-2C-010` | Mobile | **P0** | `apps/mobile/app/(traveller)/pass.tsx` | 20 hrs | Sprint 3 |
| `TSK-2C-011` | Mobile | **P0** | `apps/mobile/app/(host)/scanner.tsx` | 24 hrs | Sprint 4 |
| `TSK-2C-012` | Host Web | **P1** | `HostOverviewPage.tsx`, `HostLayout.tsx` | 20 hrs | Sprint 4 |
| `TSK-2C-013` | Host Web | **P0** | `HostOperationsDeskPage.tsx`, `HostBookingsLedgerPage.tsx` | 24 hrs | Sprint 4 |
| `TSK-2C-014` | Host Web | **P1** | `HostFinancePage.tsx`, `HostPayoutSettingsPage.tsx` | 16 hrs | Sprint 4 |
| `TSK-2C-015` | Superadmin | **P0** | `AdminIncidentsPage.tsx` | 24 hrs | Sprint 5 |
| `TSK-2C-016` | Superadmin | **P1** | `AdminHostReviewPage.tsx`, `AdminHostDirectoryPage.tsx` | 20 hrs | Sprint 5 |
| `TSK-2C-017` | Superadmin | **P1** | `AdminEscrowPage.tsx`, `AdminRefundsPage.tsx` | 20 hrs | Sprint 5 |
| `TSK-2C-018` | Cross-Platform | **P0** | Global CSS, mobile touch targets | 16 hrs | Sprint 5 |
| `TSK-2C-019` | QA & Tests | **P0** | `apps/web/test/`, `apps/mobile/test/` | 24 hrs | Sprint 5 |
| `TSK-2C-020` | QA Tooling | **P1** | `scripts/capture-all-screens.mjs` | 16 hrs | Sprint 5 |
| **TOTAL** | **Phase 2C Scope** | — | **20 Implementation Tasks** | **392 hrs** | **10 Weeks** |