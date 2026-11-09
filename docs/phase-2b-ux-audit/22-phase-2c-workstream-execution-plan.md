# Phase 2C.0 — Workstream Execution Plan
## Document 22: Seven Workstreams Execution Plan

**Project:** Global Luggage Storage Marketplace (`https://github.com/kavicastelo/luggage-storage`)  
**Document ID:** `DOC-UX-P2C-022`  
**Phase:** Phase 2C.0 — Baseline Reconciliation  
**Target Delivery:** Phased Engineering Execution Plan  
**Date:** November 9, 2026  
**Auditor / Author:** Principal Product Architect & Lead Technical Program Manager  

---

### 1. Executive Summary & Phasing Strategy

Phase 2C executes across **seven independently deliverable workstreams** organized to prevent merge conflicts, isolate frontend presentation from backend dependencies, and establish continuous quality gating:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PHASE 2C SEVEN WORKSTREAM EXECUTION ARCHITECTURE                │
├───────────────┬────────────────────────────────────────┬─────────────┬─────────────────┤
│ Workstream ID │ Workstream Name                        │ Target Apps │ Sprint Schedule │
├───────────────┼────────────────────────────────────────┼─────────────┼─────────────────┤
│ WS-1          │ Shared Design Foundation               │ All Packages│ Sprint 1        │
│ WS-2          │ Public Traveller Web                   │ apps/web    │ Sprint 2        │
│ WS-3          │ Traveller Mobile Application           │ apps/mobile │ Sprint 3        │
│ WS-4          │ Host Web Dashboard                     │ apps/web    │ Sprint 4        │
│ WS-5          │ Host Mobile Application                │ apps/mobile │ Sprint 4        │
│ WS-6          │ Superadmin Web Dashboard               │ apps/web    │ Sprint 5        │
│ WS-7          │ Cross-Platform Integration & QA        │ Cross-Apps  │ Sprint 5        │
└───────────────┴────────────────────────────────────────┴─────────────┴─────────────────┘
```

---

### 2. Workstream Execution Plans

---

#### Workstream 1: Shared Design Foundation (`WS-1-FOUNDATION`)
- **Objective:** Establish shared CWCP design tokens, accessible color palette, automated WebP mascot derivative assets, and universal developer code suppression.
- **Included Applications:** `packages/contracts`, `apps/web`, `apps/mobile`, `scripts/`.
- **Scope:** Define tokens in `packages/contracts/src/tokens.ts` (or `@luggage-storage/contracts` / shared token exports); configure Tailwind presets; write `scripts/optimize-mascot-assets.mjs`; implement dev-only developer drawer with strict `import.meta.env.DEV` / `__DEV__` exclusion.
- **Preflight Resolutions:** Unblocked by adoption of `DEC-008` (Mascot boundary & asset preservation) and `DEC-009` (Accessible Terracotta `#C85316` $\ge 4.5:1$). Reconciles baseline: 107 genuine PNGs on disk covering 74 unique catalogued screens; 185 Vitest monorepo tests covering contracts, auth, schemas, and catalog registry.
- **Dependencies:** None.
- **Backlog References:** `TSK-2C-001`, `TSK-2C-002`, `TSK-2C-003`.
- **Deliverables:** Shared token exports, build script for WebP derivatives, dev-only Developer Drawer, shared UI primitives.
- **Acceptance Criteria:**
  1. Contrast ratio between primary button text (`#FFFFFF`) and Terracotta (`#C85316`) is $\ge 4.5:1$.
  2. All 20 original mascot PNG files remain 100% byte-identical.
  3. Zero developer tracking codes (`PW-xxx`, `HD-xxx`, `WF-xxx`) appear in customer-facing DOM.
- **Required Evidence:** Checksum verification log of original PNGs; token contrast test report; foundation preview captures.
- **Exit Criteria:** Green CI pipeline for contracts and linting; signed off by Design Systems Architect.

---

#### Workstream 2: Public Traveller Web (`WS-2-PUBLIC-WEB`) [COMPLETED]
- **Status:** **COMPLETED** (Verified in `DOC-UX-P2C-026` & `DOC-UX-P2C-027`, Branch `feat/phase-2c-public-web`)
- **Objective:** Overhaul the consumer discovery and booking experience across all 11 public web screens.
- **Included Applications:** `apps/web` (`apps/web/src/pages/`).
- **Scope:** Redesign `PW-001` through `PW-011`: hospitality landing hero, split-screen MapLibre search, location profile details, transparent checkout, confirmation pass, and self-service portal.
- **Dependencies:** `WS-1-FOUNDATION`.
- **Backlog References:** `TSK-2C-004` through `TSK-2C-010`.
- **Deliverables:** Redesigned React components in `apps/web/src/pages/`, MapLibre integration component.
- **Acceptance Criteria:**
  1. Interactive MapLibre GL map renders pins with pricing pills.
  2. Multi-step checkout itemizes fees (Storage + Guarantee + Tax = Total).
  3. Zero developer state buttons or phase numbers rendered in user views.
- **Required Evidence:** Desktop ($1280\times 900$) and mobile ($390\times 844$) screenshots of all 11 screens.
- **Exit Criteria:** `GATE-01`, `GATE-02`, `GATE-05`, `GATE-06`, `GATE-07` passed for public web.

---

#### Workstream 3: Traveller Mobile Application (`WS-3-TRAVELLER-MOB`) [COMPLETED]
- **Status:** **COMPLETED** (Verified in `DOC-UX-P2C-028` & `DOC-UX-P2C-029`, Branch `feat/phase-2c-traveller-mobile`)
- **Objective:** Restructure traveller mobile app from screen-switcher hub into a standard 5-tab mobile application with native map, pass, and active timer.
- **Included Applications:** `apps/mobile` (`apps/mobile/app/(traveller)/`, `apps/mobile/src/components/`).
- **Scope:** 5-tab router shell (`Explore`, `My Storage`, `Saved`, `Support`, `Account`); interactive map discovery with quick destination chips (`explore.tsx`); location dossier (`location.tsx`); 3-step checkout wizard (`checkout.tsx`); high-contrast digital custody ticket (`pass.tsx`); active storage countdown timer with progressive color shift (`bookings.tsx`).
- **Dependencies:** `WS-1-FOUNDATION`.
- **Backlog References:** `TSK-2C-011` through `TSK-2C-015`.
- **Deliverables:** Expo Router tab layout (`_layout.tsx`), reusable mobile UI primitives (`Button`, `Card`, `Badge`, `MobileIcon`, `MobileDevDrawer`), pass view with offline caching, journey test suite.
- **Acceptance Criteria:**
  1. Bottom tab bar navigates smoothly between primary views.
  2. Custody pass renders full QR code and PIN even when browser offline mode is toggled.
  3. Active storage timer updates every second and shifts color progressively.
- **Required Evidence:** Mobile screenshots ($390\times 844$), small mobile ($375\times 812$), and tablet ($768\times 1024$) of tab layout, map, dossier, checkout, pass, and active storage.
- **Exit Criteria:** Mobile navigation tests passing 100% (56/56); signed off by Mobile Lead.

---

#### Workstream 4: Host Web Dashboard (`WS-4-HOST-WEB`)
- **Status:** **ACCEPTED WITH CONDITIONS** (Sprint 4 / Phase 2C.4 Delivery & Independent Audit — Verified under `DOC-UX-P2C-033`, `DOC-UX-P2C-034`, `DOC-UX-P2C-035`, and `DOC-UX-P2C-036`)
- **Objective:** Modernize the host operations experience, replacing developer card grids with high-density operational desks and business tools across 14 screens.
- **Included Applications:** `apps/web` (`apps/web/src/pages/host/`).
- **Scope:** Collapsible navy sidebar (zero `HD-xxx` codes); high-velocity live counter desk kiosk mode; space capacity utilization bars; bookings ledger with slide-over drawer; 85/15 revenue split center.
- **Dependencies:** `WS-1-FOUNDATION`.
- **Backlog References:** `TSK-2C-016` through `TSK-2C-020`.
- **Deliverables:** Refactored `HostLayout.tsx`, high-density operational tables, counter kiosk view.
- **Acceptance Criteria:**
  1. Sidebar contains 0 developer screen IDs.
  2. Counter desk search returns matching bookings in $<100$ms.
  3. Action buttons labeled `View Details` instead of `Investigate (HD-008)`.
- **Required Evidence:** Desktop screenshots ($1280\times 900$) of all 14 host dashboard screens.
- **Exit Criteria:** Host dashboard tests passing; signed off by QA Lead.

---

#### Workstream 5: Host Mobile Application (`WS-5-HOST-MOB`)
- **Objective:** Restructure host mobile app into a 5-tab operational utility with hardware camera scanner and guided intake wizard.
- **Included Applications:** `apps/mobile` (`apps/mobile/app/(host)/`).
- **Scope:** 5-tab router shell (`Live Desk`, `Requests`, `Vault`, `Earnings`, `Settings`); `expo-camera` barcode scanner with numeric PIN fallback; 3-step intake wizard; visual vault monitor.
- **Dependencies:** `WS-1-FOUNDATION`.
- **Backlog References:** `TSK-2C-021` through `TSK-2C-025`.
- **Deliverables:** Host tab layout, camera scanner component with haptic feedback, intake wizard.
- **Acceptance Criteria:**
  1. Scanner reticle renders smoothly with torch toggle.
  2. Manual PIN tab allows instant 6-digit verification when camera is unavailable.
  3. Step 2 of intake wizard requires security seal number input.
- **Required Evidence:** Mobile screenshots ($390\times 844$) of scanner, intake wizard, and vault monitor.
- **Exit Criteria:** Camera scan simulation passing; signed off by Mobile Lead.

---

#### Workstream 6: Superadmin Web Dashboard (`WS-6-SUPERADMIN`)
- **Objective:** Transform superadmin console from sitemap cards into an executive command center and dispute adjudication workbench across 18 screens.
- **Included Applications:** `apps/web` (`apps/web/src/pages/admin/`).
- **Scope:** Executive KPI grid (`AD-001`); KYC document review drawer (`AD-002`); dispute adjudication workbench (`AD-013` — **zero mascot**); financial escrow ledger; live security audit feed (`AD-017`).
- **Dependencies:** `WS-1-FOUNDATION`.
- **Backlog References:** `TSK-2C-026` through `TSK-2C-030`.
- **Deliverables:** Executive overview layout, document inspection drawer, dispute resolution workbench.
- **Acceptance Criteria:**
  1. Mascot Kiri completely removed from `AD-013`.
  2. KYC review drawer supports high-resolution document zoom.
  3. Live Fastify audit log feed continues querying PostgreSQL without regression.
- **Required Evidence:** Desktop screenshots ($1280\times 900$) of all 18 superadmin screens.
- **Exit Criteria:** Admin component tests green; signed off by Security Architect.

---

#### Workstream 7: Cross-Platform Integration & QA (`WS-7-INTEG-QA`)
- **Objective:** Enforce cross-platform consistency, WCAG 2.2 AA accessibility, responsive layout conformance, and automated visual regression gating.
- **Included Applications:** Cross-Platform (`apps/web`, `apps/mobile`, `scripts/`).
- **Scope:** Automated `axe-core` accessibility audit; responsive layout verification across 5 viewports; automated visual screenshot capture script (`scripts/capture-all-screens.mjs`); interactive component test suite expansion.
- **Dependencies:** `WS-1` through `WS-6`.
- **Backlog References:** `TSK-2C-031` through `TSK-2C-034`.
- **Deliverables:** Automated visual regression script, comprehensive test report, accessibility compliance log.
- **Acceptance Criteria:**
  1. Zero critical `axe-core` violations across all 113 screens.
  2. Zero horizontal overflow scrolling across 5 tested viewports.
  3. All 12 release quality gates passed.
- **Required Evidence:** Comprehensive visual regression report and device test matrix logs.
- **Exit Criteria:** Formal release sign-off by all designated leads.