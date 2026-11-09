# Phase 2C.0 — Product Experience Re-Architecture Handover
## Document 17: Canonical Handover Specification

**Project:** Global Luggage Storage Marketplace (`https://github.com/kavicastelo/luggage-storage`)  
**Document ID:** `DOC-UX-P2C-017`  
**Phase:** Phase 2C.0 — Baseline Reconciliation  
**Current HEAD Commit:** `17d5afa` / `57b1c39`  
**Source Code Baseline:** `cca134f4a0f909a907f6395f9647a025ac39d71a`  
**Target Delivery:** Complete UI/UX Redesign, Navigation Restructuring, Design System Tokenization, and Production Component Integration  
**Date:** November 9, 2026  
**Auditor / Author:** Principal Product Architect & Senior UX Lead  

---

### 1. Executive Handover Summary & Objectives

The purpose of **Phase 2C** is to transform the Global Luggage Storage Marketplace from its current prototype state (composed primarily of card-grid screen switchers, developer diagnostic labels, and simulated views) into a cohesive, high-trust, production-ready product experience across all web and mobile surfaces.

Phase 2C executes strictly on the frontend and design presentation layers. It bridges the gap between the authenticated Phase 1B identity backend and the forthcoming Phase 3+ marketplace transaction engines.

#### 1.1 Core Strategic Objectives
1. **Eliminate All Internal Jargon & Tracking Identifiers:** Completely strip screen IDs (`PW-001`, `HD-008`, `AD-013`), workflow tags (`WF-001`), phase labels, and simulation banners from all user-facing interfaces.
2. **Restructure Mobile Architecture from Hub to Real Navigation:** Replace the monolithic card-grid switchers (`apps/mobile/app/(traveller)/index.tsx` and `(host)/index.tsx`) with standard mobile navigation primitives: tab bars, header stacks, and modal bottom sheets.
3. **Establish Unified "Ceylon Warmth & Coastal Precision" Design System:** Implement standardized color tokens, typography scales, spacing units, and accessible form controls across both React Web and React Native.
4. **Deploy Real Interactive Discovery Maps:** Replace static dark text boxes on `PW-002` and `TM-012` with genuine MapLibre GL maps rendering interactive partner pins, pricing pills, and clustering.
5. **Implement Hardware-Integrated Mobile Scanner:** Replace simulated PIN input on `HM-021` with a functional `expo-camera` barcode/QR scanner featuring smooth viewfinder animations and haptic feedback.
6. **Harmonize Mascot Integration:** Deploy "Kiri the Palm Squirrel" contextually across marketing and empty states while strictly removing mascot illustrations from serious dispute, payment error, and admin governance views.
7. **Asset Optimization:** Implement an automated derivative asset generation pipeline to produce lightweight WebP versions of Kiri's 20 mascot poses, reducing asset payload from 29.54 MB to $<2.5$ MB while preserving 100% of original PNG source files.

---

### 2. Scope Boundaries: In-Scope vs Explicit Exclusions

```
┌───────────────────────────────────────────────────┬───────────────────────────────────────────────────┐
│              IN-SCOPE (Phase 2C)                  │             EXPLICIT EXCLUSIONS (Phase 3+)        │
├───────────────────────────────────────────────────┼───────────────────────────────────────────────────┤
│ • Complete redesign of all 113 marketplace screens│ • Backend database schema migrations for bookings │
│ • Implementation of shared design tokens (`/ui`)  │ • Live Stripe / PayHere real credit card charging │
│ • Real MapLibre map integration on web and mobile │ • Real SMS gateway provisioning (Twilio API keys) │
│ • Native `expo-camera` QR scanner with PIN fallback│ • Production thermal bag tag printer hardware APIs│
│ • Tab bar and stack navigation in mobile apps     │ • Apple Wallet / Google Wallet passbook signing   │
│ • Responsive web layouts (375px to 1440px)        │ • In-app live video/voice call streaming          │
│ • WCAG 2.2 Level AA accessibility compliance      │ • Real-time GPS IoT bag tracker telemetry         │
│ • Mascot derivative WebP asset optimization       │ • Modifying or deleting original mascot PNG files │
│ • Elimination of internal developer badges from UI│ • Arbitrary changes to backend Fastify routes     │
└───────────────────────────────────────────────────┴───────────────────────────────────────────────────┘
```

#### 2.1 Three Implementation Levels Defined
Every backlog item in Phase 2C must declare which levels of implementation it includes:

1. **Level 1 — Experience Redesign:**
   - Visual hierarchy, typography, spatial rhythm, and CWCP token conformance.
   - Screen layouts, responsive viewports (375px–1440px), and mobile touch targets ($\ge 44\times 44$px).
   - Component composition (eliminating "card soup" in favor of tables, lists, and drawers).
   - Form field layouts, micro-copy, empty states, and loading skeletons.
   - WCAG 2.2 Level AA accessibility compliance.

2. **Level 2 — Functional Frontend:**
   - Real client-side form validation using Zod.
   - Standard route navigation (React Router on web, Expo Router tabs/stacks on mobile).
   - Local state management, optimistic updates, and cache invalidation.
   - API-connected actions where Fastify endpoints already exist (Identity, Sessions, Audit).
   - Clean development simulation harnesses for deferred endpoints, encapsulated in hidden debug drawers.

3. **Level 3 — Operational Integration:**
   - Live backend API workflows against PostgreSQL tables.
   - Real database transactions (booking creation, capacity reservation, escrow locking).
   - Stripe / PayHere payment intent webhooks.
   - Hardware sensor execution on physical devices (camera scanner, biometric unlock).
   - End-to-end multi-role journeys verified against production databases.

---

### 3. Design System & Experience Principles

All user interfaces constructed in Phase 2C must adhere to the **CWCP Design System** tokens and ergonomic rules:

#### 3.1 Color Tokens & Accessible Contrast
- **Primary Navy (`#0A192F`):** Used for navigation bars, primary headings, high-trust badges, and elevated containers. Contrast ratio against Sand is **$16.5:1$** (WCAG AAA).
- **Accessible Terracotta (`#C85316`):** Re-tuned from `#E86F2C` per `DEC-009` to achieve a contrast ratio of **$4.62:1$** against white text, guaranteeing 100% WCAG 2.2 Level AA compliance on all primary buttons (`Book Now`, `Confirm & Pay`, `Release Bags`, `Search`).
- **Warm Sand (`#FAF8F5`):** Standard page background canvas across all web and mobile screens, replacing cold slate gray-50.
- **Semantic Colors:** Emerald (`#059669`) for active custody, Amber (`#D97706`) for timers/warnings, Rose (`#E11D48`) for cancellations/overdue bags.
- **Elevation over Borders:** Eliminate nested 1px borders. Container panels must be separated by surface contrast (`bg-white` on `bg-sand-50`) and soft ambient shadows (`box-shadow: 0 4px 20px -2px rgba(10, 25, 47, 0.06)`).

#### 3.2 Typography & Monospace Accents
- **Primary Typeface:** `Plus Jakarta Sans` or `Inter` across all headings and body copy.
- **Monospace Font:** `JetBrains Mono` or `Roboto Mono` strictly reserved for human-audited identifiers: booking references (e.g. `#LS-2026-8841`), custody PINs (`482 910`), and tamper seal numbers (`#SL-88410`).

#### 3.3 Customer-Facing Cleanliness & No Fabricated Claims
- **Zero Internal Codes:** No internal identifiers (`PW-001`, `HD-008`, `AD-013`, `WF-xxx`, `PHASE_2`, `SIMULATION_MODE`) may be rendered in the DOM of any customer-facing view.
- **Prohibition on Fabricated Copy:** The interface must never display unsupported marketing statements such as *"Over 50,000 bags stored safely"*, *"100% verified partners"*, *"Fully insured luggage"*, or *"Guaranteed secure storage"*. Only factual, policy-backed micro-copy is permitted.

---

### 4. Seven Surface Re-Architecture Workstreams

Phase 2C execution is organized into seven specialized workstreams:

#### Workstream 1: Shared Design Foundation (`WS-1-FOUNDATION`)
- Implementation of shared CWCP design tokens in `packages/contracts/src/tokens.ts` (or `@luggage-storage/ui`).
- Automated mascot WebP derivative generation script preserving all 20 original PNGs byte-for-byte.
- Global customer-facing tracking code suppression filter and hidden developer debug drawer.

#### Workstream 2: Public Traveller Web (`WS-2-PUBLIC-WEB` — 11 Screens in `apps/web`)
- **Landing Page (`PW-001`):** Travel-centric hospitality layout with date/time/bag search widget, factual trust indicators, and welcoming Kiri illustration.
- **Search & Discovery (`PW-002`):** Split-screen layout with interactive MapLibre map on right and listing cards on left. Cards feature $16:9$ storefront photos, verified partner badges, station proximity callouts, star ratings, and clear daily pricing.
- **Location Details (`PW-003`):** Photo gallery, operating hours table, storage security checklist (CCTV, dedicated vault), verified reviews, and sticky booking sidebar.
- **Checkout & Confirmation (`PW-004`, `PW-005`):** Transparent price breakdown (storage fee + guarantee fee + taxes = total); clear cancellation policy summary; clean digital custody pass with printable receipt and QR code.
- **Traveller Portal (`PW-011`):** Tabbed management interface (`Active Bookings`, `Past Trips`, `Cancellations`); self-service extension button; 1-tap support modal.

#### Workstream 3: Traveller Mobile Application (`WS-3-TRAVELLER-MOB` — 39 Screens in `apps/mobile`)
- **Navigation Shell:** Replace screen switcher with Expo Router bottom tab bar (`Explore`, `My Storage`, `Saved`, `Help`, `Profile`) and native header navigation stack.
- **Home & Search (`TM-011`, `TM-012`):** Native map view with smooth pinch-to-zoom and bottom sheet sliding drawer listing nearby verified luggage hubs.
- **Digital Custody Pass (`TM-024`):** High-contrast pass view with maximum screen contrast, offline cached QR code, large monospace PIN (`482 910`), partner telephone hotline, and walking directions button.
- **Active Storage Timer (`TM-030`):** Live countdown timer displaying remaining booked storage time with visual color shifts (Green $\to$ Amber at 30 min $\to$ Red when overdue) and 1-tap "Extend Storage" action.

#### Workstream 4: Host Web Dashboard (`WS-4-HOST-WEB` — 14 Screens in `apps/web`)
- **Navigation Architecture:** Implement a persistent, collapsable navy sidebar with human-readable labels (`Overview`, `Live Counter`, `Listings`, `Bookings`, `Operating Hours`, `Earnings`, `Reviews`, `Profile`). Remove all `HD-xxx` prefixes.
- **Live Counter Desk (`HD-009`):** Full-screen operational kiosk mode optimized for counter staff. Large-font bag intake/release search, 1-click photo capture, tamper seal logging, and live overdue bag alerts.
- **Listings & Space Manager (`HD-002`, `HD-003`, `HD-004`):** Visual space capacity progress bars (`Bags in Storage: 14 / 25 Capacity`); operating hours scheduler with holiday closure toggles.
- **Finance & Payouts (`HD-010`, `HD-011`):** Clear revenue breakdown cards (Gross Bookings, Platform Commission 15%, Net Payouts); upcoming payout date display; downloadable CSV statement export.

#### Workstream 5: Host Mobile Application (`WS-5-HOST-MOB` — 31 Screens in `apps/mobile`)
- **Navigation Shell:** Bottom tab bar (`Live Desk`, `Requests`, `Vault`, `Earnings`, `Settings`).
- **Hardware Camera Scanner (`HM-021`):** Integrate `expo-camera` with animated target viewfinder, torch/flashlight toggle, and instant vibration on barcode/QR capture. Maintain clean numeric keypad PIN fallback.
- **Counter Intake Wizard (`HM-013`, `HM-014`, `HM-022`):** Step-by-step intake wizard: (1) Verify bag count $\to$ (2) Attach numbered security seal $\to$ (3) Optional photo capture $\to$ (4) Instant confirmation and custody token activation.

#### Workstream 6: Superadmin Web Dashboard (`WS-6-SUPERADMIN` — 18 Screens in `apps/web`)
- **Command Center (`AD-001`):** Replace card grid with real operational metrics dashboard (Active Bags in Custody, Total GMV, Disputed Orders, Overdue Alerts).
- **KYC Partner Onboarding (`AD-002`, `AD-003`):** Document verification inspection drawer for business registration, front desk photos, and government ID review. Quick approve/reject actions with canned feedback reasons.
- **Disputes & Incidents Hub (`AD-013`):** Transform empty placeholder card into a fully functional dispute resolution workbench. Split-pane layout displaying customer claim, host rebuttal, uploaded damage photos, custody timestamp audit trail, and refund authorization controls. **Strictly exclude mascot Kiri from this view.**
- **Financial Escrow & Audit (`AD-006`, `AD-008`, `AD-017`):** Live ledger tables with sticky headers, pagination, advanced filtering, and real-time security event feed.

#### Workstream 7: Cross-Platform Integration & QA (`WS-7-INTEG-QA`)
- Cross-platform responsive layout audit across 5 standard viewports (375px to 1440px).
- Manual and automated WCAG 2.2 Level AA accessibility verification.
- Automated visual regression testing harness and CI release gating.

---

### 5. Definition of Done (DoD) & Release Readiness Checklist

A task or screen in Phase 2C is deemed **Complete** only when all of the following criteria are independently verified:

1. **Zero Tracking Code Leakage:** No screen IDs (`PW-xxx`, `HD-xxx`), workflow labels (`WF-xxx`), or simulation banners appear in user-facing views.
2. **Navigation Standard Compliant:** Mobile screens navigate via standard tab bar, header back button, or modal dismiss; web screens navigate via semantic routes.
3. **Design System Token Conformance:** Colors, fonts, spacing, and border radii strictly derive from CWCP design tokens; zero inline hardcoded hex colors.
4. **Touch & Ergonomic Verification:** All interactive controls pass the $44\times 44$px touch target standard.
5. **Accessibility Standard:** WCAG 2.2 Level AA compliance verified via automated scan and manual keyboard navigation; zero critical axe-core violations.
6. **Responsive Layouts:** Visually audited across mobile ($375\times 667$, $390\times 844$), tablet ($768\times 1024$), and desktop ($1280\times 900$, $1440\times 900$).
7. **Hardware Graceful Fallback:** Camera and map features gracefully display clean fallbacks when hardware or WebGL is unavailable.
8. **Automated Test Coverage:** Existing Vitest test suites across `@luggage-storage/web`, `@luggage-storage/mobile`, and `@luggage-storage/contracts` pass 100% with no regressions.
9. **Mascot Compliance:** Mascot illustrations strictly adhere to brand voice boundaries (no mascots in disputes, admin consoles, or checkout error states).
10. **Evidence Documentation:** Fresh screenshot evidence captured and logged with exact matching filenames in the evidence directory.