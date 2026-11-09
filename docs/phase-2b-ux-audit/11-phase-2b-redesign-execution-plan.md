# Phase 2B — Product UI/UX Audit & Redesign Planning
## Document 11: Phase 2C/3 UI/UX Redesign Execution Plan

**Project:** Global Luggage Storage Marketplace (`https://github.com/kavicastelo/luggage-storage`)  
**Audit Document:** `DOC-UX-P2B-011`  
**Execution Phase Target:** Phase 2C (Design System & UI Re-architecture) & Phase 3 (Marketplace Integration)  
**Mandate Compliance:** Planning and specification only. No production implementation code is committed in Phase 2B.  
**Date:** November 9, 2026

---

### 1. Execution Strategy & Architectural Workstreams

The redesign must not be attempted as an ad-hoc screen-by-screen restyling. It must be executed systematically across four disciplined workstreams:

```
┌──────────────────────────────────────────────────────────────────┐
│ WORKSTREAM 1: Design Tokens, Primitives & Asset Optimization     │
│ (CWCP Tokens, WebP Sprites, Shared Headless Components)          │
└────────────────┬─────────────────────────────────────────────────┘
                 │
        ┌────────┴────────────────────────┐
        ▼                                 ▼
┌───────────────────────────────┐ ┌────────────────────────────────┐
│ WORKSTREAM 2: Public Website  │ │ WORKSTREAM 3: Mobile Native    │
│ & Traveller Booking Journey   │ │ Navigation & Counter Scanner   │
│ (PW-001..PW-011 + Web Auth)   │ │ (TM-001..TM-044, HM-001..037)  │
└───────────────┬───────────────┘ └────────────────┬───────────────┘
                │                                  │
                └───────────────┬──────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│ WORKSTREAM 4: Host & Superadmin Enterprise Operations Portals   │
│ (HD-001..HD-014, AD-001..AD-018, Incident Adjudication Suite)   │
└──────────────────────────────────────────────────────────────────┘
```

---

### 2. Workstream Breakdown & Sprint Deliverables

#### 2.1 Workstream 1: Foundation, Tokens & Mascot Asset Optimization
- **Sprint Goal:** Establish the shared design system infrastructure and eliminate the 29.5MB mascot payload bottleneck.
- **Key Tasks:**
  1. *Token Implementation:* Configure Tailwind CSS theme in `apps/web/tailwind.config.js` and React Native tokens in `packages/ui-tokens` with the CWCP palette (Midnight Navy `#0A192F`, Terracotta `#E86F2C`, Sand `#FAF8F5`).
  2. *Non-Destructive Mascot WebP Optimization:* Run automated WebP compilation generating lightweight `@1x` and `@2x` WebP assets into `apps/web/public/assets/mascots/optimized/` and `apps/mobile/assets/mascots/optimized/`. Preserve original `Assets/` PNGs untouched.
  3. *Core Component Library:* Build accessible, headless UI primitives: `Button`, `Input`, `Select`, `Card`, `Badge`, `Modal`, `Drawer`, `Tabs`, `Table`, and `MascotBubble`.
  4. *Terminology Scrubber:* Remove `ScreenHeaderBadge` from user-facing views; create an opt-in developer diagnostics overlay toggled via hidden hotkey (`Ctrl + Shift + D`).
- **Dependencies:** None.

#### 2.2 Workstream 2: Public Website & Traveller Discovery Re-architecture
- **Sprint Goal:** Transform the public website into an immersive, high-converting travel utility.
- **Key Tasks:**
  1. *Landing Page Overhaul (`PW-001`):* Clean hero section with authentic Sri Lankan transit photography, prominent search bar with destination autocomplete, and Kiri waving companion badge.
  2. *Interactive Map Discovery (`PW-002`):* Replace simulated text block with real MapLibre GL map container featuring custom location pins, interactive popup drawers, and radius filters.
  3. *Location Detail & Social Proof (`PW-003`):* Rich photo carousel, verified host badge, operating hours schedule, security amenities, and customer reviews.
  4. *Frictionless Checkout (`PW-004`, `PW-005`):* Implement persistent checkout store (`useBookingDraftStore`); clear date-range picker with closed-hours disabling; transparent LKR pricing; and clean QR confirmation pass without debug switcher buttons.
  5. *Public Footer & Navigation:* Clean consumer footer; remove developer screen counts and diagnostic links from global header.
- **Dependencies:** Workstream 1.

#### 2.3 Workstream 3: Mobile Native Navigation & Host Scanner Re-architecture
- **Sprint Goal:** Deconstruct the monolithic screen-picker hub into a true mobile experience with camera barcode scanning.
- **Key Tasks:**
  1. *Expo Router Navigation Re-architecture:*
     - Replace `app/(traveller)/index.tsx` with standard bottom tabs: `Explore` (Map & Search), `My Bookings` (Active Passes & History), `Saved` (Favourites), `Profile` (Settings & Auth).
     - Replace `app/(host)/index.tsx` with host tabs: `Counter Desk` (Scanner & Arrivals), `Bookings` (Active Bags & SLA Queue), `Locations` (Branch Config), `Earnings` (Payouts).
  2. *Native Mobile Camera Scanner:* Install and configure `expo-camera` in `apps/mobile/app/(host)/scanner.tsx` with automatic QR detection, audible scan beep, and rate-limited 6-digit PIN fallback.
  3. *Mobile Pass Voucher:* High-contrast digital ticket with screen brightness boost, large QR, PIN fallback, offline caching, and 1-tap host calling.
  4. *Touch Target & Ergonomic Audit:* Expand all interactive targets to minimum $44\times 44$ pixels.
- **Dependencies:** Workstream 1.

#### 2.4 Workstream 4: Host Web & Superadmin Dashboards Overhaul
- **Sprint Goal:** Deliver high-density operational portals for partner hosts and platform operators.
- **Key Tasks:**
  1. *Host Overview Dashboard (`HD-001`):* Replace the 14-card screen sitemap grid with real operational widgets: Today's Arrivals/Collections Timeline, Capacity Occupancy Bar, 15m SLA Queue, and Net Revenue Card.
  2. *Location Workspace (`HD-002`..`HD-006`):* Consolidate fragmented editors into a unified Location Workspace with horizontal sub-tabs: Overview, Operating Hours, Capacity Zones, and Pricing Rules.
  3. *Superadmin Command Center (`AD-001`):* Replace 18-card sitemap grid with platform GMV telemetry, pending KYC queue preview, active bag capacity counts, and security audit activity feeds.
  4. *Functional Dispute Adjudication Suite (`AD-013`):* Replace placeholder text card with complete dispute workflow: photo comparison viewer, seal integrity history, host vs traveller testimony, and claim payout authorization.
- **Dependencies:** Workstreams 1, 2, 3.

---

### 3. Acceptance Criteria & Quality Gates

For any screen to be marked `UI_COMPLETE` or `UX_VERIFIED` in future phases, it must satisfy all of the following criteria:

1. **Zero Terminology Leakage:** The screen contains zero instances of internal screen codes (`PW-xxx`, `TM-xxx`, `HD-xxx`), workflow IDs (`WF-xxx`), sprint task labels, database invariant keys (`BR-xxx`, `OQ-xxx`), or phase numbers.
2. **Task Ergonomics:** The screen possesses a single primary action button with unambiguous copy (e.g. "Find Storage", "Confirm Booking", "Release Luggage").
3. **Responsive Verification:** Tested and visually verified across Desktop ($1280\times 900$), Tablet ($768\times 1024$), and Mobile ($390\times 844$) viewports with zero horizontal overflow or overlapping text.
4. **Accessibility Compliance:** Achieves WCAG 2.2 Level AA compliance with minimum $4.5:1$ text contrast, visible focus rings, semantic landmark markup, and screen reader labels.
5. **Asset Efficiency:** Loads optimized WebP assets ($<50$ KB per image) with zero cumulative layout shift (CLS $<0.1$).
6. **Mascot Appropriateness:** Mascot appears only in authorized, supportive brand contexts and is completely excluded from payment processing, dispute adjudication, and security audit logs.
