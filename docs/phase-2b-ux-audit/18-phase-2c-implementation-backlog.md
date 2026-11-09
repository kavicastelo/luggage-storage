# Phase 2C.0 — Implementation Backlog & Engineering Task Catalog
## Document 18: Canonical Implementation Backlog

**Project:** Global Luggage Storage Marketplace (`https://github.com/kavicastelo/luggage-storage`)  
**Document ID:** `DOC-UX-P2C-018`  
**Phase:** Phase 2C.0 — Baseline Reconciliation  
**Current HEAD Commit:** `17d5afa` / `57b1c39`  
**Source Code Baseline:** `cca134f`  
**Date:** November 9, 2026  
**Auditor / Author:** Principal Product Architect & Lead Technical Program Manager  

---

### 1. Backlog Phasing, Priority Model & Implementation Levels

The Phase 2C implementation backlog decomposes the product re-architecture into **34 independently implementable and testable engineering tasks** organized across seven specialized workstreams.

#### 1.1 Priority Definitions
- **P0 (Critical Blocker):** Blocks core usability, customer/partner trust, physical safety, or an essential user journey.
- **P1 (Primary Journey):** Required to complete a primary user journey end-to-end.
- **P2 (Operational / Usability Improvement):** Significant usability, operational efficiency, or financial transparency enhancement.
- **P3 (Refinement / Polish):** Aesthetic polish, micro-interactions, or secondary configuration.

#### 1.2 Three Implementation Levels Defined
Each task explicitly declares its functional depth:
- **Level 1 (Experience Redesign):** Visual hierarchy, layout, typography, CWCP tokens, responsive behavior, accessibility, forms, empty/error states.
- **Level 2 (Functional Frontend):** Form validation, client routing, state management, cache invalidation, API-connected actions where backend exists, documented simulation harness where backend is deferred.
- **Level 3 (Operational Integration):** Live backend APIs, PostgreSQL persistence, Stripe webhooks, physical hardware sensor execution, end-to-end multi-role journeys.

#### 1.3 Critical Dependency Rule
If a task requires backend functionality that does not exist in the current codebase (e.g. booking persistence, payment charging), the task is **strictly restricted to Level 1 and Level 2 documented simulations**. Coding agents must **never invent undocumented API contracts or schemas**.

---

### 2. Workstream 1: Shared Design Foundation (`WS-1-FOUNDATION`)
*Status: COMPLETED (Phase 2C.1 Delivery — Verified under DOC-UX-P2C-024 and DOC-UX-P2C-025)*

---

#### Task `TSK-2C-001`: Shared CWCP Tokens & Accessible Palette
- **Status:** **COMPLETED** (Sprint 1 / WS-1)
- **Completion Artifacts:** `packages/contracts/src/tokens.ts`, `apps/web/tailwind.config.js`, `apps/web/src/index.css`, `apps/mobile/src/lib/theme.ts`, `packages/contracts/tests/tokens.test.ts`
- **Priority:** **P0** | **Implementation Level:** Level 1 (Experience Redesign)
- **Target Application:** Cross-Platform (`packages/contracts/src/tokens.ts`, `apps/web`, `apps/mobile`)
- **User Persona:** All users (Travellers, Hosts, Superadmins)
- **User Problem:** Inconsistent, low-contrast colors across screens create visual discordance and fail accessibility checks.
- **Business Value:** Establishes unified brand identity, trust, and WCAG 2.2 AA compliance.
- **Current Behavior:** Hardcoded arbitrary Tailwind slate/indigo/purple classes scattered throughout components.
- **Expected Behavior:** Single source of truth exports Navy (`#0A192F`), Accessible Terracotta (`#C85316`), Sand (`#FAF8F5`), and semantic status tokens.
- **Scope:** Define tokens in `packages/contracts/src/tokens.ts`; configure `tailwind.config.js` in `web` and `mobile`.
- **Exclusions:** Redesigning individual screens.
- **Product Requirement References:** `PRD-SYS-001`, `FR-SYS-002`
- **Source-Code References:** `packages/contracts/src/`, `apps/web/tailwind.config.js`
- **API/Backend Dependencies:** None.
- **Required Decisions:** `DEC-009` (Accessible Terracotta re-tune).
- **Acceptance Criteria:**
  1. Contrast ratio between primary button text (`#FFFFFF`) and Terracotta (`#C85316`) is $\ge 4.5:1$ (WCAG AA).
  2. Contrast ratio between Navy text (`#0A192F`) and Sand background (`#FAF8F5`) is $\ge 16:1$ (WCAG AAA).
  3. Tokens imported cleanly by both web and mobile Tailwind configs.
- **Automated Test Requirements:** Unit test in contracts verifying contrast calculations and token exports.
- **Manual QA Requirements:** Verify theme token rendering on desktop and mobile viewports.
- **Screenshot Requirements:** Render token swatches test page.
- **Definition of Done:** Tokens exported, configured in all apps, unit tests passing.

---

#### Task `TSK-2C-002`: Automated Mascot WebP Derivative Pipeline & Picture Components
- **Status:** **COMPLETED** (Sprint 1 / WS-1)
- **Completion Artifacts:** `scripts/optimize-mascot-assets.mjs`, `scripts/mascot-derivative-register.json`, `apps/web/src/components/ui/MascotIllustration.tsx`, WebP derivatives in `apps/web` and `apps/mobile`
- **Priority:** **P1** | **Implementation Level:** Level 1 (Experience Redesign)
- **Target Application:** Asset Infrastructure (`scripts/`, `apps/web/public/assets/mascot/`, `Assets/`)
- **User Persona:** Travellers on mobile data connections
- **User Problem:** 20 uncompressed PNGs consume 29.54 MB, causing severe page load lag and high cellular data costs.
- **Business Value:** Reduces asset payload by $>90\%$, accelerating page loads and conversion rates.
- **Current Behavior:** Full-resolution PNGs (~1.5 MB each) are fetched directly over network.
- **Expected Behavior:** Automated build script reads original PNGs and generates lightweight WebP derivatives ($<2.5$ MB total). Original PNGs remain 100% byte-identical.
- **Scope:** Create `scripts/optimize-mascot-assets.mjs` using `sharp`; update `MascotIllustration` to render `<picture>` with `<source type="image/webp">` and PNG fallback.
- **Exclusions:** Modifying, deleting, or renaming original PNGs in `Assets/`.
- **Product Requirement References:** `NFR-PERF-003`
- **Source-Code References:** `apps/web/src/components/ui/MascotIllustration.tsx`
- **API/Backend Dependencies:** None.
- **Required Decisions:** None.
- **Acceptance Criteria:**
  1. All 20 original PNG files retain exact original checksums and timestamps.
  2. Total size of generated WebP directory is $\le 2.5$ MB (Actual: 2.05 MB, 92.88% savings).
  3. `MascotIllustration` renders WebP in modern browsers and PNG in legacy environments.
- **Automated Test Requirements:** CI test verifying checksum preservation of original PNGs and WebP file existence.
- **Manual QA Requirements:** Inspect Network tab in Chrome DevTools to confirm WebP format transfer.
- **Screenshot Requirements:** None.
- **Definition of Done:** Script executable via `pnpm run assets:optimize`, CI test green.

---

#### Task `TSK-2C-003`: Universal Customer-Facing Tracking Code Suppression & Developer Drawer
- **Status:** **COMPLETED** (Sprint 1 / WS-1)
- **Completion Artifacts:** `apps/web/src/components/layout/DeveloperDrawer.tsx`, `apps/web/src/components/layout/AppShell.tsx`, `apps/web/tests/foundation-and-boundary.test.tsx`
- **Priority:** **P0** | **Implementation Level:** Level 2 (Functional Frontend)
- **Target Application:** Cross-Platform (`apps/web`, `apps/mobile`)
- **User Persona:** Travellers and Hosts
- **User Problem:** Seeing codes like `PW-001`, `HD-008`, `WF-xxx`, and simulation banners confuses users and destroys product credibility.
- **Business Value:** Professional production presentation.
- **Current Behavior:** Internal screen IDs and workflow numbers are hardcoded in rendered headers, badges, and buttons.
- **Expected Behavior:** Zero internal tracking codes visible in customer DOM. Diagnostic controls relocated to a hidden Developer Debug Drawer (`Ctrl+Shift+D` or `?debug=true` in DEV only).
- **Scope:** Clean all template text across 113 screens; implement `DeveloperDrawer` component.
- **Exclusions:** Removing screen IDs from internal documentation or test suites.
- **Product Requirement References:** `PRD-UX-004`
- **Source-Code References:** `apps/web/src/pages/`, `apps/mobile/app/`
- **API/Backend Dependencies:** None.
- **Required Decisions:** None.
- **Acceptance Criteria:**
  1. Regex search for `\b(PW|HD|AD|TM|HM)-\d{3}\b|\bWF-\d{3}\b` in rendered production HTML yields 0 matches.
  2. Developer Drawer accessible only when `import.meta.env.DEV === true`.
  3. Navbar link to internal `/health` removed from consumer navigation headers.
- **Automated Test Requirements:** Automated test scanning all rendered routes for forbidden tokens.
- **Manual QA Requirements:** Verify absence of codes across all 113 screens.
- **Screenshot Requirements:** Capture clean headers across all surfaces.
- **Definition of Done:** Zero code leakage in DOM, drawer functional in DEV.


---

### 3. Workstream 2: Public Traveller Web (`WS-2-PUBLIC-WEB`)

---

#### Task `TSK-2C-004`: Public Web Landing Page Overhaul & Factual Copy (`PW-001`)
- **Status:** **COMPLETED** (Sprint 2 / WS-2 / Phase 2C.2)
- **Completion Artifacts:** `apps/web/src/pages/PublicMarketplacePages.tsx` (`PublicLandingPage`), `apps/web/tests/public-web-journeys.test.tsx`, `docs/phase-2b-ux-audit/evidence/current/public-web/pw-001-landing-*.png`
- **Priority:** **P0** | **Implementation Level:** Level 1 + Level 2
- **Target Application:** Public Web (`apps/web/src/pages/LandingPage.tsx`)
- **User Persona:** Traveller looking for safe bag storage
- **User Problem:** Current landing page feels basic, dark, and lacks an intuitive search widget.
- **Business Value:** Primary conversion funnel entry; drives customer acquisition.
- **Current Behavior:** Card with `PW-001` badge and basic gradient.
- **Expected Behavior:** High-converting hospitality layout with destination search bar (city, dates, bag counter), verified partner highlights, factual trust indicators, and welcoming Kiri mascot illustration.
- **Scope:** Redesign `LandingPage.tsx` using CWCP tokens; connect search widget to `/search` route.
- **Exclusions:** Live backend search API (uses client routing with query parameters).
- **Product Requirement References:** `FR-003`, `WF-030`
- **Source-Code References:** `apps/web/src/pages/LandingPage.tsx`
- **API/Backend Dependencies:** None.
- **Required Decisions:** `DEC-008` (Mascot boundary), `DEC-010` (Trust badge taxonomy).
- **Acceptance Criteria:**
  1. Search widget navigates to `/search?city=colombo&bags=2&...`.
  2. No fabricated claims (e.g. "Over 50,000 bags stored safely" prohibited).
  3. Fully responsive at 390px (mobile) and 1280px (desktop).
- **Automated Test Requirements:** Component test verifying search form submission.
- **Manual QA Requirements:** Test form input validation and responsive stacking.
- **Screenshot Requirements:** Desktop ($1280\times 900$) and mobile ($390\times 844$) captures.
- **Definition of Done:** Redesigned view live on `:5173/`, tests green, screenshots verified.

---

#### Task `TSK-2C-005`: Split-Screen Search & Discovery with Interactive MapLibre (`PW-002`)
- **Status:** **COMPLETED** (Sprint 2 / WS-2 / Phase 2C.2)
- **Completion Artifacts:** `apps/web/src/pages/PublicMarketplacePages.tsx` (`WebSearchDiscoveryPage`), `apps/web/tests/public-web-journeys.test.tsx`, `docs/phase-2b-ux-audit/evidence/current/public-web/pw-002-search-*.png`
- **Priority:** **P0** | **Implementation Level:** Level 1 + Level 2
- **Target Application:** Public Web (`apps/web/src/pages/SearchPage.tsx`, `LocationMap.tsx`)
- **User Persona:** Traveller finding convenient location near transit
- **User Problem:** Search screen renders a dark div with static text simulating a map.
- **Business Value:** Core discovery experience; enables visual location comparison.
- **Current Behavior:** Simulated text box: `"POSTGIS + MAPLIBRE PREVIEW"`.
- **Expected Behavior:** Split-screen layout (desktop) with interactive MapLibre map on right and listing cards on left. Cards show storefront photos, verified partner badges, station distance, and daily pricing pills.
- **Scope:** Integrate `maplibre-gl` with OpenStreetMap raster tiles; render custom marker pins with price pills; synchronize pin click with listing card scroll.
- **Exclusions:** Live PostGIS backend queries (uses mock location array).
- **Product Requirement References:** `FR-004`, `WF-003`
- **Source-Code References:** `apps/web/src/pages/SearchPage.tsx`
- **API/Backend Dependencies:** Documented simulation harness.
- **Required Decisions:** `DEC-010` (Trust badge taxonomy).
- **Acceptance Criteria:**
  1. MapLibre map mounts cleanly without WebGL errors.
  2. Clicking map pin scrolls to and highlights corresponding location card.
  3. Fallback message rendered if WebGL is unsupported.
- **Automated Test Requirements:** Vitest test verifying map component mount.
- **Manual QA Requirements:** Pan/zoom map, click markers, verify mobile view toggle (List vs Map).
- **Screenshot Requirements:** Desktop and mobile captures of search view.
- **Definition of Done:** Interactive map functional on `:5173/search`, screenshots verified.

---

#### Task `TSK-2C-006`: Partner Location Details & Storage Security Gallery (`PW-003`)
- **Status:** **COMPLETED** (Sprint 2 / WS-2 / Phase 2C.2)
- **Completion Artifacts:** `apps/web/src/pages/PublicMarketplacePages.tsx` (`LocationProfileDetailPage`), `apps/web/tests/public-web-journeys.test.tsx`, `docs/phase-2b-ux-audit/evidence/current/public-web/pw-003-location-details-*.png`
- **Priority:** **P0** | **Implementation Level:** Level 1 + Level 2
- **Target Application:** Public Web (`apps/web/src/pages/LocationDetailsPage.tsx`)
- **User Persona:** Traveller evaluating partner security
- **User Problem:** Generic cards with dense text and no structured security checklist.
- **Business Value:** Convinces hesitant travellers their luggage is physically secure.
- **Current Behavior:** Basic card layout with static text.
- **Expected Behavior:** High-trust view: photo gallery, structured operating hours, security checklist (CCTV, dedicated vault, insurance terms), verified reviews, and sticky booking sidebar with live price calculation.
- **Scope:** Layout redesign with CWCP tokens; interactive photo lightbox; sticky sidebar.
- **Exclusions:** Live review submission backend (deferred).
- **Product Requirement References:** `FR-004`, `FR-050`, `WF-004`
- **Source-Code References:** `apps/web/src/pages/LocationDetailsPage.tsx`
- **API/Backend Dependencies:** Documented simulation harness.
- **Required Decisions:** `DEC-010`.
- **Acceptance Criteria:**
  1. Photo gallery supports thumbnail navigation.
  2. Operating hours display open/closed status for today.
  3. Primary CTA button (`Book Now`) routes to `/checkout/:id`.
- **Automated Test Requirements:** Component test verifying price calculation in sticky bar.
- **Manual QA Requirements:** Test responsive layout at 390px and 1280px.
- **Screenshot Requirements:** Desktop capture of location profile.
- **Definition of Done:** Redesigned view live on `:5173/locations/:slug`, screenshots verified.

---

#### Task `TSK-2C-007`: Transparent Pricing & Step-by-Step Checkout Flow (`PW-004`)
- **Status:** **COMPLETED** (Sprint 2 / WS-2 / Phase 2C.2)
- **Completion Artifacts:** `apps/web/src/pages/PublicMarketplacePages.tsx` (`WebCheckoutSchedulePage`), `apps/web/tests/public-web-journeys.test.tsx`, `docs/phase-2b-ux-audit/evidence/current/public-web/pw-004-checkout-*.png`
- **Priority:** **P0** | **Implementation Level:** Level 1 + Level 2
- **Target Application:** Public Web (`apps/web/src/pages/BookingCheckoutPage.tsx`)
- **User Persona:** Traveller completing booking
- **User Problem:** Dense policy paragraphs and unvalidated form fields.
- **Business Value:** Minimizes checkout abandonment; prevents payment surprises.
- **Current Behavior:** Card with simulation warning notice and button labeled `Proceed to Payment (PW-005)`.
- **Expected Behavior:** Clean checkout: bag size selector, drop-off/pick-up time selectors, transparent fee breakdown (Storage + Guarantee + Tax = Total), cancellation terms summary, and form validation.
- **Scope:** Form validation with Zod; price itemization component; clear terms toggle.
- **Exclusions:** Live credit card charging (uses simulated checkout completion).
- **Product Requirement References:** `FR-005`–`FR-014`, `WF-005`, `WF-006`
- **Source-Code References:** `apps/web/src/pages/BookingCheckoutPage.tsx`
- **API/Backend Dependencies:** Documented simulation harness.
- **Required Decisions:** `DEC-002` (Overdue terms disclosure).
- **Acceptance Criteria:**
  1. Form prevents advancing if required dates or bag counts are missing.
  2. Itemized price updates dynamically as bag count changes.
  3. Mascot Kiri strictly excluded from checkout form.
- **Automated Test Requirements:** Form validation and calculation unit tests.
- **Manual QA Requirements:** Test validation error displays and price calculations.
- **Screenshot Requirements:** Desktop and mobile captures.
- **Definition of Done:** Checkout functional on `:5173/checkout/:id`, tests green.

---

#### Task `TSK-2C-008`: Booking Confirmation & Printable Digital Custody Pass (`PW-005`)
- **Status:** **COMPLETED** (Sprint 2 / WS-2 / Phase 2C.2)
- **Completion Artifacts:** `apps/web/src/pages/PublicMarketplacePages.tsx` (`WebPaymentConfirmationPage`), `apps/web/tests/public-web-journeys.test.tsx`, `docs/phase-2b-ux-audit/evidence/current/public-web/pw-005-custody-pass-*.png`
- **Priority:** **P0** | **Implementation Level:** Level 1 + Level 2
- **Target Application:** Public Web (`apps/web/src/pages/BookingConfirmationPage.tsx`)
- **User Persona:** Traveller arriving at storage partner counter
- **User Problem:** Screen exposes developer debug state buttons (`State: GATEWAY`, etc.).
- **Business Value:** Provides unambiguous proof of storage custody.
- **Current Behavior:** State switcher buttons exposed in user interface.
- **Expected Behavior:** High-contrast ticket pass: booking reference in monospace font, high-density SVG QR code, 6-digit PIN (`482 910`), partner arrival instructions, and "Print / Save PDF" action.
- **Scope:** Digital pass ticket styling; print stylesheet (`@media print`); debug state switcher moved to developer drawer.
- **Exclusions:** Apple/Google Wallet buttons (`DEC-004`).
- **Product Requirement References:** `FR-015`–`FR-018`, `WF-007`
- **Source-Code References:** `apps/web/src/pages/BookingConfirmationPage.tsx`
- **API/Backend Dependencies:** Documented simulation harness.
- **Required Decisions:** `DEC-004`, `DEC-005`.
- **Acceptance Criteria:**
  1. Zero developer state buttons rendered in user view.
  2. Booking reference formatted as `#LS-2026-XXXX` in monospace font.
  3. Print stylesheet renders clean pass without web navbar or footer.
- **Automated Test Requirements:** Component test verifying pass rendering.
- **Manual QA Requirements:** Test print preview in browser.
- **Screenshot Requirements:** Desktop capture of confirmation view.
- **Definition of Done:** Pass rendered cleanly on `:5173/booking/confirm`, screenshots verified.

---

#### Task `TSK-2C-009`: Host Acquisition Landing & Real Earnings Estimator (`PW-006`)
- **Status:** **COMPLETED** (Sprint 2 / WS-2 / Phase 2C.2)
- **Completion Artifacts:** `apps/web/src/pages/PublicMarketplacePages.tsx` (`BecomeAHostLandingPage`), `apps/web/tests/public-web-journeys.test.tsx`, `docs/phase-2b-ux-audit/evidence/current/public-web/pw-006-become-a-host-*.png`
- **Priority:** **P1** | **Implementation Level:** Level 1 + Level 2
- **Target Application:** Public Web (`apps/web/src/pages/BecomeAHostLandingPage.tsx`)
- **User Persona:** Prospective storage partner (hotel, cafe, shop owner)
- **User Problem:** Generic layout with static estimates.
- **Business Value:** Drives partner supply acquisition.
- **Current Behavior:** Card with interactive slider and CTA leading to register.
- **Expected Behavior:** Engaging partner landing page with realistic earnings slider (based on square footage and city tier), 3-step partner onboarding overview, security guarantee explanation, and registration CTA.
- **Scope:** CWCP token styling; earnings calculation formula; link to `/register`.
- **Exclusions:** None (Phase 1B `/register` is live).
- **Product Requirement References:** `FR-045`, `WF-017`
- **Source-Code References:** `apps/web/src/pages/BecomeAHostLandingPage.tsx`
- **API/Backend Dependencies:** Phase 1B Auth `/register`.
- **Required Decisions:** None.
- **Acceptance Criteria:**
  1. Slider updates estimated monthly earnings in LKR dynamically.
  2. Clicking "Start Hosting" navigates to live registration page with `role=host`.
- **Automated Test Requirements:** Component test verifying slider calculation.
- **Manual QA Requirements:** Verify responsive layout and slider drag gestures.
- **Screenshot Requirements:** Desktop capture of become-a-host page.
- **Definition of Done:** Page live on `:5173/become-a-host`, screenshots verified.

---

#### Task `TSK-2C-010`: Traveller Self-Service Portal & Active Storage Hub (`PW-011`)
- **Status:** **COMPLETED** (Sprint 2 / WS-2 / Phase 2C.2)
- **Completion Artifacts:** `apps/web/src/pages/PublicMarketplacePages.tsx` (`TravellerWebPortalPage`), `apps/web/tests/public-web-journeys.test.tsx`, `docs/phase-2b-ux-audit/evidence/current/public-web/pw-011-traveller-portal-*.png`
- **Priority:** **P1** | **Implementation Level:** Level 1 + Level 2
- **Target Application:** Public Web (`apps/web/src/pages/TravellerPortalPage.tsx`)
- **User Persona:** Traveller managing existing bookings
- **User Problem:** Prototype renders unstyled mock table and raw refund stepper.
- **Business Value:** Reduces customer support load through self-service management.
- **Current Behavior:** Raw table rows with simulated cancel action.
- **Expected Behavior:** Tabbed booking management hub (`Active`, `Upcoming`, `Completed`, `Cancelled`); live custody countdown timer; 1-tap pass display; cancellation modal explaining refund terms.
- **Scope:** Tab navigation; active countdown timer; cancellation modal.
- **Exclusions:** Live database mutation for cancellation (uses local state simulation).
- **Product Requirement References:** `FR-019`–`FR-023`, `WF-010`, `WF-014`
- **Source-Code References:** `apps/web/src/pages/TravellerPortalPage.tsx`
- **API/Backend Dependencies:** Phase 1B Auth session; domain data simulated.
- **Required Decisions:** `DEC-003` (Refund policy).
- **Acceptance Criteria:**
  1. Active bookings show remaining time countdown.
  2. Cancellation modal calculates estimated refund based on cancellation window.
- **Automated Test Requirements:** Component test verifying tab switching and cancel modal.
- **Manual QA Requirements:** Test cancellation flow and countdown timer.
- **Screenshot Requirements:** Desktop capture of traveller portal.
- **Definition of Done:** Portal live on `:5173/portal/bookings`, screenshots verified.

---

### 4. Workstream 3: Traveller Mobile Application (`WS-3-TRAVELLER-MOB`)
*Status: COMPLETED (Phase 2C.3 Delivery — Verified under DOC-UX-P2C-028 and DOC-UX-P2C-029)*

---

#### Task `TSK-2C-011`: Mobile Navigation Restructure: 5-Tab Shell & Stack Router
- **Status:** **COMPLETED** (Sprint 3 / WS-3 / Phase 2C.3)
- **Completion Artifacts:** `apps/mobile/app/(traveller)/_layout.tsx`, `apps/mobile/src/components/`, `apps/mobile/tests/traveller-mobile-journeys.test.ts`, `docs/phase-2b-ux-audit/evidence/current/traveller-mobile/tm-011-explore-*.png`
- **Priority:** **P0** | **Implementation Level:** Level 2 (Functional Frontend)
- **Target Application:** Traveller Mobile (`apps/mobile/app/(traveller)/`)
- **User Persona:** Mobile traveller
- **User Problem:** App is built as a developer card-grid switcher (`app/(traveller)/index.tsx`) rather than a real mobile app.
- **Business Value:** Foundational mobile usability; aligns with standard iOS/Android ergonomics.
- **Current Behavior:** Monolithic switcher hub rendering 39 cards with query-parameter switching.
- **Expected Behavior:** Expo Router bottom tab bar (`Explore`, `My Storage`, `Saved`, `Help`, `Profile`) with native header navigation stack.
- **Scope:** Implement `_layout.tsx` with bottom tabs; route key screens to tab destinations.
- **Exclusions:** Native device compilation (verified in Expo Web runtime).
- **Product Requirement References:** `PRD-MOB-001`, `WF-001`
- **Source-Code References:** `apps/mobile/app/(traveller)/`
- **API/Backend Dependencies:** None.
- **Required Decisions:** None.
- **Acceptance Criteria:**
  1. Bottom tab bar renders with Lucide icons on mobile viewport.
  2. Tapping tabs navigates between views without full reloads.
  3. Header stack provides native back button on detail views.
- **Automated Test Requirements:** Navigation routing unit tests in `apps/mobile/test/`.
- **Manual QA Requirements:** Test tab switching and back button gestures.
- **Screenshot Requirements:** Mobile capture of tab bar layout.
- **Definition of Done:** Tab bar functional in `apps/mobile`, tests green.

---

#### Task `TSK-2C-012`: Mobile Discovery Hub with Interactive Map & Bottom Sheet (`TM-011`, `TM-012`)
- **Status:** **COMPLETED** (Sprint 3 / WS-3 / Phase 2C.3)
- **Completion Artifacts:** `apps/mobile/app/(traveller)/index.tsx`, `apps/mobile/app/(traveller)/explore.tsx`, `apps/mobile/app/(traveller)/location.tsx`, `apps/mobile/tests/traveller-mobile-journeys.test.ts`, `docs/phase-2b-ux-audit/evidence/current/traveller-mobile/tm-011-*, tm-012-*, tm-015-*.png`
- **Priority:** **P0** | **Implementation Level:** Level 1 + Level 2
- **Target Application:** Traveller Mobile (`apps/mobile/app/(traveller)/explore.tsx`)
- **User Persona:** Mobile traveller seeking nearby storage
- **User Problem:** Exploration screen renders a basic text list with developer action buttons.
- **Business Value:** Core mobile discovery experience.
- **Current Behavior:** Card with buttons labeled `Details (TM-015)` and `Book (TM-017)`.
- **Expected Behavior:** Native map view with pan/zoom gestures, custom partner pins with price callouts, and an interactive draggable bottom sheet listing partner cards.
- **Scope:** Map component integration; bottom sheet component with snap points.
- **Exclusions:** Physical GPS hardware location (uses Colombo mock center).
- **Product Requirement References:** `FR-007`, `WF-007`
- **Source-Code References:** `apps/mobile/app/(traveller)/explore.tsx`
- **API/Backend Dependencies:** Documented simulation harness.
- **Required Decisions:** `DEC-010`.
- **Acceptance Criteria:**
  1. Bottom sheet slides between collapsed, half, and expanded states.
  2. Tapping card highlights pin on map.
  3. Zero developer tracking codes visible.
- **Automated Test Requirements:** Component test verifying bottom sheet state transitions.
- **Manual QA Requirements:** Drag bottom sheet, verify map touch interactions.
- **Screenshot Requirements:** Mobile capture of map and bottom sheet.
- **Definition of Done:** Explore view live on `:8081/(traveller)/explore`, screenshots verified.

---

#### Task `TSK-2C-013`: Mobile Bag Selection, Capacity & Booking Checkout (`TM-017`–`TM-019`)
- **Status:** **COMPLETED** (Sprint 3 / WS-3 / Phase 2C.3)
- **Completion Artifacts:** `apps/mobile/app/(traveller)/checkout.tsx`, `apps/mobile/tests/traveller-mobile-journeys.test.ts`, `docs/phase-2b-ux-audit/evidence/current/traveller-mobile/tm-017-checkout-schedule-mobile.png`
- **Priority:** **P0** | **Implementation Level:** Level 1 + Level 2
- **Target Application:** Traveller Mobile (`apps/mobile/app/(traveller)/checkout.tsx`)
- **User Persona:** Mobile traveller booking storage on the go
- **User Problem:** Fragmented cards with unvalidated inputs.
- **Business Value:** Streamlined mobile conversion funnel.
- **Current Behavior:** Three separate simulated cards in developer switcher.
- **Expected Behavior:** Unified mobile booking flow: step indicator (Dates $\to$ Bags $\to$ Payment), bag category counters with dimensions, transparent price summary, and validated form.
- **Scope:** Multi-step wizard component; bag counter component; checkout summary.
- **Exclusions:** Live Stripe charging (simulated completion).
- **Product Requirement References:** `FR-017`, `FR-018`, `WF-017`, `WF-018`
- **Source-Code References:** `apps/mobile/app/(traveller)/`
- **API/Backend Dependencies:** Documented simulation harness.
- **Required Decisions:** None.
- **Acceptance Criteria:**
  1. Bag count controls ($+ / -$) update totals in real time.
  2. Advancing between steps validates required inputs.
- **Automated Test Requirements:** Unit test for step transitions and totals.
- **Manual QA Requirements:** Step through wizard on mobile viewport.
- **Screenshot Requirements:** Mobile captures of bag counter and checkout summary.
- **Definition of Done:** Checkout flow functional on `:8081`, screenshots verified.

---

#### Task `TSK-2C-014`: Mobile Digital Custody Ticket & Offline Caching (`TM-024`)
- **Status:** **COMPLETED** (Sprint 3 / WS-3 / Phase 2C.3)
- **Completion Artifacts:** `apps/mobile/app/(traveller)/pass.tsx`, `apps/mobile/tests/traveller-mobile-journeys.test.ts`, `docs/phase-2b-ux-audit/evidence/current/traveller-mobile/tm-024-custody-pass-*.png`
- **Priority:** **P0** | **Implementation Level:** Level 1 + Level 2
- **Target Application:** Traveller Mobile (`apps/mobile/app/(traveller)/pass.tsx`)
- **User Persona:** Traveller at storage counter without mobile data
- **User Problem:** Simulated card with static placeholder QR and debug controls.
- **Business Value:** Guaranteed counter check-in even when travelling internationally without roaming.
- **Current Behavior:** Card with placeholder text and debug buttons.
- **Expected Behavior:** High-contrast ticket pass: large SVG QR code, monospace PIN (`482 910`), partner address with walking directions button, 1-tap call host hotline, and offline caching via AsyncStorage.
- **Scope:** Pass layout; QR generation; offline state persistence in AsyncStorage.
- **Exclusions:** Apple/Google Wallet buttons (`DEC-004`).
- **Product Requirement References:** `FR-024`, `WF-009`
- **Source-Code References:** `apps/mobile/app/(traveller)/`
- **API/Backend Dependencies:** Documented simulation harness.
- **Required Decisions:** `DEC-004`, `DEC-005`.
- **Acceptance Criteria:**
  1. Pass renders full QR code and PIN even when browser offline mode is toggled.
  2. Hotline button links to `tel:+94112345678`.
  3. No developer debug state controls visible.
- **Automated Test Requirements:** Component test verifying AsyncStorage hydration.
- **Manual QA Requirements:** Toggle browser offline mode and reload pass.
- **Screenshot Requirements:** Mobile capture of custody ticket.
- **Definition of Done:** Pass view live on `:8081`, offline cached, screenshots verified.

---

#### Task `TSK-2C-015`: Live Active Custody Countdown Timer & Extension Modal (`TM-030`, `TM-031`)
- **Status:** **COMPLETED** (Sprint 3 / WS-3 / Phase 2C.3)
- **Completion Artifacts:** `apps/mobile/app/(traveller)/bookings.tsx`, `apps/mobile/tests/traveller-mobile-journeys.test.ts`, `docs/phase-2b-ux-audit/evidence/current/traveller-mobile/tm-027-active-storage-*.png`
- **Priority:** **P0** | **Implementation Level:** Level 1 + Level 2
- **Target Application:** Traveller Mobile (`apps/mobile/app/(traveller)/active-storage.tsx`)
- **User Persona:** Traveller exploring city while bags are stored
- **User Problem:** Static text saying storage is active with no visual urgency indicators.
- **Business Value:** Prevents unintended late pickups and overdue fee disputes.
- **Current Behavior:** Card with simulated timer text.
- **Expected Behavior:** Prominent countdown circular timer; progressive color shifts (Green $\to$ Amber at 30 min $\to$ Red when overdue); 1-tap "Extend Storage" modal with hourly pricing breakdown.
- **Scope:** Animated countdown timer component; extension modal.
- **Exclusions:** Backend database mutation for extension (simulated state).
- **Product Requirement References:** `FR-030`, `WF-011`
- **Source-Code References:** `apps/mobile/app/(traveller)/`
- **API/Backend Dependencies:** Documented simulation harness.
- **Required Decisions:** `DEC-002` (Overdue rates).
- **Acceptance Criteria:**
  1. Timer decrements accurately by 1 second.
  2. Color shifts to Amber when $<30$ minutes remain.
  3. Extension modal allows selecting $+1$, $+2$, or $+4$ hours.
- **Automated Test Requirements:** Timer logic and color transition unit tests.
- **Manual QA Requirements:** Verify timer countdown and modal triggers.
- **Screenshot Requirements:** Mobile capture of active storage timer.
- **Definition of Done:** Active storage view live on `:8081`, screenshots verified.

---

### 5. Workstream 4: Host Web Dashboard (`WS-4-HOST-WEB`)

---

#### Task `TSK-2C-016`: Host Dashboard Navigation Shell & Human Sidebar
- **Priority:** **P1** | **Implementation Level:** Level 1 + Level 2
- **Target Application:** Host Web Dashboard (`apps/web/src/pages/host/`)
- **User Persona:** Storage partner manager
- **User Problem:** Every menu item displays developer screen IDs (`HD-001`, `HD-002`, etc.).
- **Business Value:** Professional B2B partner experience.
- **Current Behavior:** Sidebar displays `HD-xxx` codes; body is a 14-card sitemap grid.
- **Expected Behavior:** Clean collapsible navy sidebar with business labels (`Overview`, `Live Counter`, `Listings`, `Bookings`, `Operating Hours`, `Earnings`, `Reviews`, `Profile`); overview displays real operational KPIs.
- **Scope:** Refactor `HostLayout.tsx` and `HostOverviewPage.tsx` with CWCP tokens.
- **Exclusions:** None.
- **Product Requirement References:** `PRD-HOST-001`
- **Source-Code References:** `apps/web/src/pages/host/`
- **API/Backend Dependencies:** Phase 1B Auth session.
- **Required Decisions:** None.
- **Acceptance Criteria:**
  1. Zero `HD-xxx` codes in sidebar navigation.
  2. KPI cards display Current Bags in Storage, Today's Check-ins, and Pending Earnings.
- **Automated Test Requirements:** Component test verifying sidebar navigation routes.
- **Manual QA Requirements:** Test sidebar collapse/expand on desktop viewports.
- **Screenshot Requirements:** Desktop capture of host overview dashboard.
- **Definition of Done:** Host dashboard live on `:5173/host/dashboard`, screenshots verified.

---

#### Task `TSK-2C-017`: Host Live Operations Desk & Rapid Intake/Release Kiosk (`HD-009`)
- **Priority:** **P0** | **Implementation Level:** Level 1 + Level 2
- **Target Application:** Host Web Dashboard (`apps/web/src/pages/host/HostOperationsDeskPage.tsx`)
- **User Persona:** Storage partner counter staff
- **User Problem:** Counter desk operates as a static simulation with slow controls.
- **Business Value:** Enables high-velocity luggage intake/release during peak check-in rushes.
- **Current Behavior:** Static cards with simulated PIN input.
- **Expected Behavior:** High-velocity counter kiosk mode: instant search by booking reference, PIN, or customer name; 1-click check-in confirmation; seal tag input; overdue bag alert banners.
- **Scope:** Kiosk mode layout; instant search filter; seal tag logging form.
- **Exclusions:** Hardware barcode scanner integration on web (uses keyboard/numeric input).
- **Product Requirement References:** `FR-009`, `WF-013`
- **Source-Code References:** `apps/web/src/pages/host/HostOperationsDeskPage.tsx`
- **API/Backend Dependencies:** Documented simulation harness.
- **Required Decisions:** `DEC-001`, `DEC-007`.
- **Acceptance Criteria:**
  1. Search filters mock booking list in $<100$ms.
  2. Check-in action logs intake timestamp and advances status to `ACTIVE_STORAGE`.
  3. Overdue bags display prominent red warning banners with late fee calculation.
- **Automated Test Requirements:** Component test verifying search and check-in actions.
- **Manual QA Requirements:** Test counter check-in and release workflows.
- **Screenshot Requirements:** Desktop capture of operations desk.
- **Definition of Done:** Operations desk functional on `:5173/host/operations`, screenshots verified.

---

#### Task `TSK-2C-018`: Storage Capacity Management & Space Editor (`HD-002`–`HD-005`)
- **Priority:** **P1** | **Implementation Level:** Level 1 + Level 2
- **Target Application:** Host Web Dashboard (`HostListingsPage.tsx`, `HostSpaceEditorPage.tsx`, `HostOperatingHoursPage.tsx`)
- **User Persona:** Storage partner manager
- **User Problem:** Basic cards with no visual capacity utilization indicators.
- **Business Value:** Prevents partner overbooking and protects luggage room limits.
- **Current Behavior:** Simulated text fields.
- **Expected Behavior:** Space capacity manager with visual progress bar (`14 / 25 Bags Used`); operating hours weekly scheduler with holiday closure toggles; instant pause/resume listing toggle.
- **Scope:** Capacity progress bar; weekly hours schedule editor; pause listing toggle.
- **Exclusions:** Backend database persistence (uses local state simulation).
- **Product Requirement References:** `FR-046`–`FR-048`, `WF-018`
- **Source-Code References:** `apps/web/src/pages/host/`
- **API/Backend Dependencies:** Documented simulation harness.
- **Required Decisions:** None.
- **Acceptance Criteria:**
  1. Capacity bar color shifts from Green ($<75\%$) to Amber ($75\text{--}90\%$) to Red ($>90\%$).
  2. Toggling "Pause Bookings" immediately updates status pill badge.
- **Automated Test Requirements:** Component test for schedule editor and capacity bar.
- **Manual QA Requirements:** Test weekly hours configuration.
- **Screenshot Requirements:** Desktop capture of capacity and hours editors.
- **Definition of Done:** Views live on `:5173/host/...`, screenshots verified.

---

#### Task `TSK-2C-019`: Host Bookings Ledger & Investigation Modal (`HD-007`, `HD-008`)
- **Priority:** **P1** | **Implementation Level:** Level 1 + Level 2
- **Target Application:** Host Web Dashboard (`HostBookingsLedgerPage.tsx`, `HostBookingDetailsPage.tsx`)
- **User Persona:** Storage partner manager
- **User Problem:** Row action buttons explicitly labeled `Investigate (HD-008)`.
- **Business Value:** Operational ledger auditing and dispute verification.
- **Current Behavior:** Table row buttons display internal screen IDs.
- **Expected Behavior:** High-density operational data table with sticky headers, date range filter, status badges, and clean slide-over drawer showing customer details, baggage count, custody timeline, and contact actions.
- **Scope:** Dense table component with pagination; slide-over drawer component.
- **Exclusions:** None.
- **Product Requirement References:** `FR-022`, `WF-010`
- **Source-Code References:** `apps/web/src/pages/host/`
- **API/Backend Dependencies:** Documented simulation harness.
- **Required Decisions:** None.
- **Acceptance Criteria:**
  1. Buttons labeled `View Details` instead of `Investigate (HD-008)`.
  2. Slide-over drawer opens smoothly without layout shift.
- **Automated Test Requirements:** Component test verifying table filtering and drawer open/close.
- **Manual QA Requirements:** Test table pagination and drawer inspection.
- **Screenshot Requirements:** Desktop capture of bookings ledger and drawer.
- **Definition of Done:** Ledger live on `:5173/host/bookings`, screenshots verified.

---

#### Task `TSK-2C-020`: Host Revenue Breakdown & Payout Settings (`HD-010`, `HD-011`)
- **Priority:** **P1** | **Implementation Level:** Level 1 + Level 2
- **Target Application:** Host Web Dashboard (`HostFinancePage.tsx`, `HostPayoutSettingsPage.tsx`)
- **User Persona:** Storage partner business owner
- **User Problem:** Static cards with hardcoded simulation split numbers.
- **Business Value:** Complete financial transparency builds long-term partner loyalty.
- **Current Behavior:** Basic cards with static numbers.
- **Expected Behavior:** Financial ledger displaying gross booking earnings, 15% platform commission breakdown, net payout balance, next payout date, bank account settings form with IFSC/SWIFT validation, and CSV export.
- **Scope:** Financial breakdown bar component; bank settings form; CSV export helper.
- **Exclusions:** Real bank payout transfers (simulated ledger).
- **Product Requirement References:** `FR-028`, `WF-015`
- **Source-Code References:** `apps/web/src/pages/host/`
- **API/Backend Dependencies:** Documented simulation harness.
- **Required Decisions:** `DEC-006` (Payout schedule).
- **Acceptance Criteria:**
  1. Clear 85/15 revenue split calculation visualized.
  2. CSV export generates valid downloadable file.
- **Automated Test Requirements:** Unit test for revenue split mathematical accuracy.
- **Manual QA Requirements:** Download CSV statement and verify columns.
- **Screenshot Requirements:** Desktop capture of finance dashboard.
- **Definition of Done:** Finance views live on `:5173/host/finance`, screenshots verified.

---

### 6. Workstream 5: Host Mobile Application (`WS-5-HOST-MOB`)

---

#### Task `TSK-2C-021`: Host Mobile Navigation Shell: 5-Tab Router
- **Priority:** **P0** | **Implementation Level:** Level 2 (Functional Frontend)
- **Target Application:** Host Mobile (`apps/mobile/app/(host)/`)
- **User Persona:** Storage partner counter staff
- **User Problem:** Built as a developer card-grid switcher (`app/(host)/index.tsx`).
- **Business Value:** Essential mobile usability for counter staff holding a phone.
- **Current Behavior:** Monolithic switcher hub rendering 31 cards.
- **Expected Behavior:** Expo Router bottom tab bar (`Live Desk`, `Requests`, `Vault`, `Earnings`, `Settings`) with modal navigation stacks.
- **Scope:** Implement `_layout.tsx` for host tabs; route key screens to tab destinations.
- **Exclusions:** Physical device build.
- **Product Requirement References:** `PRD-MOB-002`
- **Source-Code References:** `apps/mobile/app/(host)/`
- **API/Backend Dependencies:** None.
- **Required Decisions:** None.
- **Acceptance Criteria:**
  1. Bottom tab bar renders cleanly on mobile viewport.
  2. Tapping tabs navigates between views without reload.
- **Automated Test Requirements:** Navigation routing unit tests in `apps/mobile/test/`.
- **Manual QA Requirements:** Test tab switching on mobile viewport.
- **Screenshot Requirements:** Mobile capture of host tab bar layout.
- **Definition of Done:** Host tab bar functional in `apps/mobile`, tests green.

---

#### Task `TSK-2C-022`: Hardware Camera Scanner with Haptics & PIN Fallback (`HM-021`)
- **Priority:** **P0** | **Implementation Level:** Level 1 + Level 2
- **Target Application:** Host Mobile (`apps/mobile/app/(host)/scanner.tsx`)
- **User Persona:** Storage counter staff checking in customer
- **User Problem:** Camera screen falls back to pre-filling the string `482910` in a text box.
- **Business Value:** Core operational feature for rapid bag intake and checkout.
- **Current Behavior:** Simulated text box with pre-filled string.
- **Expected Behavior:** `expo-camera` barcode/QR scanner with animated laser reticle, torch toggle, and instant haptic vibration on read. Numeric keypad PIN entry provided as instant secondary tab.
- **Scope:** Integrate `expo-camera`; add permission request modal; implement numeric PIN fallback.
- **Exclusions:** Physical device verification (verified in Expo Web with mock scan simulator).
- **Product Requirement References:** `FR-021`, `WF-012`
- **Source-Code References:** `apps/mobile/app/(host)/scanner.tsx`
- **API/Backend Dependencies:** Documented simulation harness.
- **Required Decisions:** `DEC-005` (HMAC QR validation).
- **Acceptance Criteria:**
  1. Viewfinder renders animated reticle and torch button.
  2. PIN tab allows quick 6-digit numeric input with instant submit.
  3. Successful scan navigates to Intake Wizard (`HM-013`).
- **Automated Test Requirements:** Component test verifying barcode scan callback and PIN form.
- **Manual QA Requirements:** Test PIN fallback and permission prompts.
- **Screenshot Requirements:** Mobile capture of scanner reticle and PIN tab.
- **Definition of Done:** Scanner view live on `:8081/(host)/scanner`, screenshots verified.

---

#### Task `TSK-2C-023`: Step-by-Step Counter Intake & Seal Tagging Wizard (`HM-013`, `HM-014`, `HM-022`)
- **Priority:** **P0** | **Implementation Level:** Level 1 + Level 2
- **Target Application:** Host Mobile (`apps/mobile/app/(host)/intake.tsx`)
- **User Persona:** Counter staff handling customer bags
- **User Problem:** Fragmented simulated cards requiring multiple manual navigations.
- **Business Value:** Enforces physical custody protocols, preventing lost or damaged bag claims.
- **Current Behavior:** Separate simulated cards in developer switcher.
- **Expected Behavior:** Guided 3-step intake wizard: (1) Verify bag count $\to$ (2) Attach and log numbered security seal (`#SL-XXXXX`) $\to$ (3) Optional photo capture $\to$ (4) Custody activation confirmation.
- **Scope:** Intake wizard component; seal number input with barcode trigger; photo upload stub.
- **Exclusions:** Mandatory photo enforcement on undamaged bags (`DEC-001`).
- **Product Requirement References:** `FR-013`, `FR-014`, `FR-022`, `WF-012`
- **Source-Code References:** `apps/mobile/app/(host)/`
- **API/Backend Dependencies:** Documented simulation harness.
- **Required Decisions:** `DEC-001`, `DEC-007`.
- **Acceptance Criteria:**
  1. Step 2 requires valid seal number input before advancing.
  2. Step 3 includes 1-tap bypass: *"No visible damage / Host verified"*.
  3. Confirmation triggers custody state update to `ACTIVE_STORAGE`.
- **Automated Test Requirements:** Unit test verifying intake step progression.
- **Manual QA Requirements:** Step through wizard on mobile viewport.
- **Screenshot Requirements:** Mobile captures of intake wizard steps.
- **Definition of Done:** Intake wizard functional on `:8081`, screenshots verified.

---

#### Task `TSK-2C-024`: Host Active Vault Monitor & Overdue Alerts (`HM-006`, `HM-011`, `HM-026`)
- **Priority:** **P1** | **Implementation Level:** Level 1 + Level 2
- **Target Application:** Host Mobile (`apps/mobile/app/(host)/vault.tsx`)
- **User Persona:** Counter staff managing stored luggage
- **User Problem:** No real-time visibility into bags currently in the backroom vault.
- **Business Value:** Prevents forgotten luggage and identifies overdue items immediately.
- **Current Behavior:** Static simulated cards.
- **Expected Behavior:** Visual vault inventory: list of active bags sorted by collection time, prominent red badge for overdue bags, and 1-tap pickup release button.
- **Scope:** Vault inventory list component; overdue calculation badge; release modal.
- **Exclusions:** Backend database persistence.
- **Product Requirement References:** `FR-011`, `FR-023`, `WF-013`
- **Source-Code References:** `apps/mobile/app/(host)/`
- **API/Backend Dependencies:** Documented simulation harness.
- **Required Decisions:** `DEC-002` (Overdue payment collection).
- **Acceptance Criteria:**
  1. Overdue bags display accrued late fee and red alert pill.
  2. Clicking "Release" opens pickup verification dialog.
- **Automated Test Requirements:** Component test verifying overdue sorting.
- **Manual QA Requirements:** Test release confirmation dialog.
- **Screenshot Requirements:** Mobile capture of vault monitor.
- **Definition of Done:** Vault view live on `:8081`, screenshots verified.

---

#### Task `TSK-2C-025`: Host Mobile Earnings & Payout Ledger (`HM-025`, `HM-026`)
- **Priority:** **P2** | **Implementation Level:** Level 1 + Level 2
- **Target Application:** Host Mobile (`apps/mobile/app/(host)/earnings.tsx`)
- **User Persona:** Storage partner owner checking income on mobile
- **User Problem:** Basic simulation cards with hardcoded numbers.
- **Business Value:** Mobile financial visibility for busy business owners.
- **Current Behavior:** Static simulation cards.
- **Expected Behavior:** Mobile earnings card: Today's Revenue, This Week's Revenue, Pending Payout, and collapsible transaction history list.
- **Scope:** Mobile earnings dashboard layout with CWCP tokens.
- **Exclusions:** Real banking integration.
- **Product Requirement References:** `FR-025`, `FR-026`
- **Source-Code References:** `apps/mobile/app/(host)/`
- **API/Backend Dependencies:** Documented simulation harness.
- **Required Decisions:** `DEC-006`.
- **Acceptance Criteria:**
  1. Clear separation of Gross Revenue vs Net Payout.
  2. Collapsible transaction history showing date, reference, and net earnings.
- **Automated Test Requirements:** Unit test for revenue calculations.
- **Manual QA Requirements:** Verify mobile responsive layout.
- **Screenshot Requirements:** Mobile capture of host earnings view.
- **Definition of Done:** Earnings view live on `:8081`, screenshots verified.

---

### 7. Workstream 6: Superadmin Web Dashboard (`WS-6-SUPERADMIN`)

---

#### Task `TSK-2C-026`: Superadmin Command Overview & Live KPI Grid (`AD-001`)
- **Priority:** **P1** | **Implementation Level:** Level 1 + Level 2
- **Target Application:** Superadmin Web (`apps/web/src/pages/admin/AdminOverviewPage.tsx`)
- **User Persona:** Platform executive / operations director
- **User Problem:** Screen is an 18-card sitemap grid rather than a management command center.
- **Business Value:** Global marketplace health monitoring.
- **Current Behavior:** Card grid displaying screen IDs.
- **Expected Behavior:** Executive operations dashboard: Live Bags in Storage, 24h GMV, Active Host Count, Overdue Alerts, and Disputed Orders requiring action.
- **Scope:** KPI metric card grid; quick action triage drawer; live security audit trigger.
- **Exclusions:** Live backend aggregations (uses mock metrics combined with live audit data).
- **Product Requirement References:** `PRD-ADM-001`, `FR-035`
- **Source-Code References:** `apps/web/src/pages/admin/AdminOverviewPage.tsx`
- **API/Backend Dependencies:** Live Fastify `/security/audit/events`.
- **Required Decisions:** None.
- **Acceptance Criteria:**
  1. Zero developer card grid selectors rendered in main view.
  2. Overdue/Dispute alert banner routes directly to incident workbench.
- **Automated Test Requirements:** Component test verifying KPI card rendering.
- **Manual QA Requirements:** Inspect desktop layout at 1280px.
- **Screenshot Requirements:** Desktop capture of admin command center.
- **Definition of Done:** Command center live on `:5173/admin`, screenshots verified.

---

#### Task `TSK-2C-027`: KYC Host Onboarding & Document Inspection Drawer (`AD-002`, `AD-003`)
- **Priority:** **P1** | **Implementation Level:** Level 1 + Level 2
- **Target Application:** Superadmin Web (`AdminHostReviewPage.tsx`, `AdminHostDirectoryPage.tsx`)
- **User Persona:** Platform compliance officer
- **User Problem:** Static cards with basic approve/reject buttons and no document viewing capability.
- **Business Value:** Protects marketplace safety by vetting physical partner premises.
- **Current Behavior:** Cards listing mock hosts with basic buttons.
- **Expected Behavior:** Verification workbench: inspection drawer for business registration, storefront photo, and government ID; quick approve/reject actions with mandatory rejection reason code.
- **Scope:** Document inspection drawer component with image zoom; rejection modal.
- **Exclusions:** Backend database mutation (simulated review queue).
- **Product Requirement References:** `FR-036`, `FR-045`, `WF-017`
- **Source-Code References:** `apps/web/src/pages/admin/`
- **API/Backend Dependencies:** Documented simulation harness.
- **Required Decisions:** `DEC-010` (Trust badge taxonomy).
- **Acceptance Criteria:**
  1. Clicking applicant opens slide-over drawer with full-resolution photos.
  2. Rejection requires selecting at least one compliance reason code.
  3. Approved host automatically assigned "Verified Partner" badge.
- **Automated Test Requirements:** Component test verifying review actions and validation.
- **Manual QA Requirements:** Test document zoom and rejection modal.
- **Screenshot Requirements:** Desktop capture of KYC review workbench.
- **Definition of Done:** Review queue live on `:5173/admin/hosts/review`, screenshots verified.

---

#### Task `TSK-2C-028`: Disputes & Incident Adjudication Workbench — Zero Mascot (`AD-013`)
- **Priority:** **P0** | **Implementation Level:** Level 1 + Level 2
- **Target Application:** Superadmin Web (`apps/web/src/pages/admin/AdminIncidentsPage.tsx`)
- **User Persona:** Customer support lead / dispute adjudicator
- **User Problem:** Currently an empty placeholder card showing mascot Kiri shrugging with zero dispute tools.
- **Business Value:** Critical trust and legal compliance; resolves customer baggage loss claims.
- **Current Behavior:** Static placeholder card quoting rule `OQ-015`.
- **Expected Behavior:** High-seriousness dispute adjudication workbench: split-pane layout showing customer claim, host statement, uploaded baggage damage photos, custody timestamp audit trail, and refund/settlement authorization controls. **Zero mascot illustrations permitted.**
- **Scope:** Build complete incident adjudication workbench; remove mascot illustration; implement claim settlement actions.
- **Exclusions:** Live Stripe refund issuance (simulated refund execution).
- **Product Requirement References:** `FR-037`, `WF-016`
- **Source-Code References:** `apps/web/src/pages/admin/AdminIncidentsPage.tsx`
- **API/Backend Dependencies:** Documented simulation harness.
- **Required Decisions:** `DEC-008` (Mascot boundary policy).
- **Acceptance Criteria:**
  1. Mascot Kiri is **100% removed** from this screen.
  2. Split-pane layout displays claim evidence, photos, and custody timestamps.
  3. Adjudicator can authorize full refund, partial settlement, or deny claim with written rationale.
- **Automated Test Requirements:** Vitest test verifying dispute actions and asserting 0 mascot DOM nodes.
- **Manual QA Requirements:** Test claim approval and denial flows.
- **Screenshot Requirements:** Desktop capture of incident adjudication workbench.
- **Definition of Done:** Workbench functional on `:5173/admin/incidents`, screenshots verified.

---

#### Task `TSK-2C-029`: Financial Escrow & Batch Refund Authorizations (`AD-006`, `AD-007`)
- **Priority:** **P1** | **Implementation Level:** Level 1 + Level 2
- **Target Application:** Superadmin Web (`AdminEscrowPage.tsx`, `AdminRefundsPage.tsx`)
- **User Persona:** Platform finance director
- **User Problem:** Hardcoded simulation cards with static progress bars.
- **Business Value:** Safeguards platform escrow balances and prevents unauthorized fund leakage.
- **Current Behavior:** Static cards and simulation bars.
- **Expected Behavior:** Live ledger tables: active escrow funds locked in active storage, batch refund approval queue with 1-click authorization, and refund audit log.
- **Scope:** Sticky header table; batch selection checkboxes; refund confirmation modal.
- **Exclusions:** Real banking API execution (simulated batch processing).
- **Product Requirement References:** `FR-038`, `FR-039`
- **Source-Code References:** `apps/web/src/pages/admin/`
- **API/Backend Dependencies:** Documented simulation harness.
- **Required Decisions:** `DEC-003` (Gateway fee policy).
- **Acceptance Criteria:**
  1. Escrow ledger calculates total funds currently in custody.
  2. Batch refund action calculates net refund total and logs approval.
- **Automated Test Requirements:** Component test for batch selection and refund action.
- **Manual QA Requirements:** Test batch selection and modal confirmation.
- **Screenshot Requirements:** Desktop capture of escrow and refunds ledger.
- **Definition of Done:** Escrow views live on `:5173/admin/finance/...`, screenshots verified.

---

#### Task `TSK-2C-030`: System Configuration, Fee Rates & Security Audit Feed (`AD-009`, `AD-017`, `AD-018`)
- **Priority:** **P1** | **Implementation Level:** Level 2 + Level 3
- **Target Application:** Superadmin Web (`AdminFeeConfigPage.tsx`, `AdminAuditLogPage.tsx`, `AdminSystemSettingsPage.tsx`)
- **User Persona:** Platform security administrator
- **User Problem:** Configuration forms operate on local state; audit table needs enhanced filters.
- **Business Value:** Core platform governance and security compliance.
- **Current Behavior:** `AD-017` queries live Fastify audit API; fee config is static.
- **Expected Behavior:** Dynamic platform fee configuration form (platform commission %, guarantee fee, currency exchange markup); live PostgreSQL security audit log table with event type filtering and JSON metadata viewer.
- **Scope:** Enhance `AdminAuditLogPage.tsx` with metadata drawer; fee config form with validation.
- **Exclusions:** None (`AD-017` operates against live Fastify backend).
- **Product Requirement References:** `FR-040`, `FR-041`, `WF-020`
- **Source-Code References:** `apps/web/src/pages/admin/`
- **API/Backend Dependencies:** Live Fastify `/security/audit/events`.
- **Required Decisions:** None.
- **Acceptance Criteria:**
  1. Audit table renders live events from PostgreSQL with pagination.
  2. Clicking event opens JSON metadata inspection drawer.
  3. Fee config form validates numerical percentages ($0\text{--}100\%$).
- **Automated Test Requirements:** Vitest test verifying audit API integration and JSON viewer.
- **Manual QA Requirements:** Trigger audit events and inspect live table update.
- **Screenshot Requirements:** Desktop capture of live audit log view.
- **Definition of Done:** Audit views live on `:5173/admin/audit`, screenshots verified.

---

### 8. Workstream 7: Cross-Platform Integration & QA (`WS-7-INTEG-QA`)

---

#### Task `TSK-2C-031`: Cross-Platform WCAG 2.2 AA Accessibility & Touch Target Audit
- **Priority:** **P0** | **Implementation Level:** Level 1 (Experience Redesign)
- **Target Application:** Cross-Platform (`apps/web`, `apps/mobile`)
- **User Persona:** All users, including assistive device users
- **User Problem:** Small touch targets ($<44$px) on mobile filter chips; low-contrast text on dark cards ($<3:1$).
- **Business Value:** Legal compliance (ADA / European Accessibility Act) and superior ergonomics.
- **Current Behavior:** Multiple contrast and touch target violations across prototype screens.
- **Expected Behavior:** 100% compliance with WCAG 2.2 Level AA: minimum $44\times 44$px touch targets, contrast ratio $\ge 4.5:1$ for normal text, and visible focus rings.
- **Scope:** Audit and adjust all interactive controls across web and mobile.
- **Exclusions:** None.
- **Product Requirement References:** `NFR-A11Y-001`
- **Source-Code References:** Global CSS, component button styles.
- **API/Backend Dependencies:** None.
- **Required Decisions:** `DEC-009`.
- **Acceptance Criteria:**
  1. Zero critical or serious `axe-core` accessibility violations across all routes.
  2. All mobile buttons, chips, and links measure $\ge 44\times 44$px.
  3. Visible 2px Terracotta focus ring on keyboard navigation.
- **Automated Test Requirements:** Automated `axe-core` CLI scan script.
- **Manual QA Requirements:** Keyboard-only tab navigation through checkout flow.
- **Screenshot Requirements:** Focus ring evidence captures.
- **Definition of Done:** Axe scan reports 0 critical violations, keyboard navigable.

---

#### Task `TSK-2C-032`: Responsive Layout Verification Across 5 Standard Viewports
- **Priority:** **P0** | **Implementation Level:** Level 1 (Experience Redesign)
- **Target Application:** Cross-Platform (`apps/web`, `apps/mobile`)
- **User Persona:** Mobile, tablet, and desktop travellers
- **User Problem:** Broken text wrapping and horizontal scrolling on mobile viewports.
- **Business Value:** Flawless cross-device user experience.
- **Current Behavior:** Some desktop layouts overflow horizontally when viewed on mobile screens.
- **Expected Behavior:** Fluid responsive layouts across 5 viewports: $375\times 667$, $390\times 844$, $768\times 1024$, $1280\times 900$, $1440\times 900$.
- **Scope:** Responsive CSS adjustments; flex/grid breakpoint tuning.
- **Exclusions:** None.
- **Product Requirement References:** `NFR-RESP-001`
- **Source-Code References:** Layout components across `apps/web` and `apps/mobile`.
- **API/Backend Dependencies:** None.
- **Required Decisions:** None.
- **Acceptance Criteria:**
  1. Zero horizontal overflow scrolling on small screens ($375$px, $390$px).
  2. Modals and bottom sheets dynamically scale to viewport height.
- **Automated Test Requirements:** Playwright/Puppeteer responsive viewport audit.
- **Manual QA Requirements:** Manual inspection at each breakpoint.
- **Screenshot Requirements:** Side-by-side viewport comparisons.
- **Definition of Done:** Zero layout breaks across 5 viewports, screenshots verified.

---

#### Task `TSK-2C-033`: Automated Visual Regression & Screenshot Capture Pipeline
- **Priority:** **P1** | **Implementation Level:** Level 2 (Functional Frontend)
- **Target Application:** QA Tooling (`scripts/capture-all-screens.mjs`)
- **User Persona:** Engineering team & QA Lead
- **User Problem:** Manual screenshot capture is slow and error-prone.
- **Business Value:** Continuous visual regression prevention in CI.
- **Current Behavior:** Ad-hoc PowerShell Chrome headless commands.
- **Expected Behavior:** Automated Node.js script that spins up local servers, renders all 113 screens across desktop and mobile viewports, captures PNGs, and performs pixel-diff comparison against baseline.
- **Scope:** Create `scripts/capture-all-screens.mjs` using Puppeteer / Chrome Headless.
- **Exclusions:** None.
- **Product Requirement References:** `NFR-QA-002`
- **Source-Code References:** `scripts/`
- **API/Backend Dependencies:** None.
- **Required Decisions:** None.
- **Acceptance Criteria:**
  1. Single command `pnpm run test:visual` captures all 113 screens automatically.
  2. Output files match canonical naming convention (`pw-001-landing-desktop.png`, etc.).
  3. Visual regression report highlights pixel changes $>1.0\%$.
- **Automated Test Requirements:** Script executes cleanly in CI.
- **Manual QA Requirements:** Inspect generated HTML visual report.
- **Screenshot Requirements:** Automatic output generation.
- **Definition of Done:** Script functional, outputting clean screenshots to `evidence/current/`.

---

#### Task `TSK-2C-034`: Contract-Driven Component & End-to-End Test Suite
- **Priority:** **P0** | **Implementation Level:** Level 2 (Functional Frontend)
- **Target Application:** Automated Testing (`apps/web/test/`, `apps/mobile/test/`, `packages/contracts/test/`)
- **User Persona:** Engineering team
- **User Problem:** Existing tests verify static mock object existence rather than component user interactions.
- **Business Value:** Guarantees zero functional regressions during active redesign.
- **Current Behavior:** 185 tests verify static schemas and basic render output.
- **Expected Behavior:** Interactive component test suites testing real user events: form typing, button clicks, modal openings, tab switching, and error handling.
- **Scope:** Author interactive component tests in React Testing Library / Vitest.
- **Exclusions:** Backend end-to-end database tests for deferred marketplace endpoints.
- **Product Requirement References:** `NFR-QA-001`
- **Source-Code References:** `test/` directories across all packages.
- **API/Backend Dependencies:** Vitest test runner.
- **Required Decisions:** None.
- **Acceptance Criteria:**
  1. 100% passing tests across all workspace packages.
  2. Zero unhandled promise rejections or console errors in test output.
  3. Tests cover form validation errors, modal triggers, and tab switches.
- **Automated Test Requirements:** `pnpm test` runs green across monorepo.
- **Manual QA Requirements:** None.
- **Screenshot Requirements:** None.
- **Definition of Done:** Interactive component tests passing, CI green.

---

### 9. Backlog Summary & Task Count Traceability

| Workstream | Workstream Name | Total Tasks | P0 Tasks | P1 Tasks | P2 Tasks | P3 Tasks |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **`WS-1`** | Shared Design Foundation | **3** | 2 | 1 | 0 | 0 |
| **`WS-2`** | Public Traveller Web | **7** | 5 | 2 | 0 | 0 |
| **`WS-3`** | Traveller Mobile Application | **5** | 5 | 0 | 0 | 0 |
| **`WS-4`** | Host Web Dashboard | **5** | 1 | 4 | 0 | 0 |
| **`WS-5`** | Host Mobile Application | **5** | 3 | 1 | 1 | 0 |
| **`WS-6`** | Superadmin Web Dashboard | **5** | 1 | 4 | 0 | 0 |
| **`WS-7`** | Cross-Platform Integration & QA | **4** | 3 | 1 | 0 | 0 |
| **TOTALS** | **Phase 2C Implementation Backlog** | **34 Tasks** | **20 (59%)** | **13 (38%)** | **1 (3%)** | **0 (0%)** |