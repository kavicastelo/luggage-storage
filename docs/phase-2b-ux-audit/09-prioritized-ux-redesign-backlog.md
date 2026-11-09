# Phase 2B — Product UI/UX Audit & Redesign Planning
## Document 09: Prioritized UX Redesign Backlog

**Project:** Global Luggage Storage Marketplace (`https://github.com/kavicastelo/luggage-storage`)  
**Audit Document:** `DOC-UX-P2B-009`  
**Priority Schema:**
- **`P0`** — Critical usability, trust, security, or journey-blocking issue.
- **`P1`** — Major usability or visual-quality issue affecting primary conversion/operational flows.
- **`P2`** — Meaningful improvement to consistency, spacing, typography, or interaction polish.
- **`P3`** — Minor refinement, micro-copy adjustment, or subtle aesthetic enhancement.
**Date:** November 9, 2026

---

### 1. Backlog Summary Statistics

```
Total Actionable Findings Identified: 48
├── Priority P0 (Critical Blockers / Trust Violations):  7 Findings
├── Priority P1 (Major Usability & Design Quality):    14 Findings
├── Priority P2 (Consistency & Spacing Polish):        18 Findings
└── Priority P3 (Refinement & Micro-copy Polish):       9 Findings
```

---

### 2. Detailed Prioritized Finding Register

#### 2.1 Priority P0 — Critical Usability, Trust & Journey Blockers

| Finding ID | Affected Screens | Surface | Problem Description | Evidence & Traceability | User & Business Impact | Recommended Solution | Work Type & Dependencies |
|:---:|:---:|:---:|---|---|---|---|:---:|
| **`UX-P0-01`** | All 113 Screens (`PW`, `HD`, `AD`, `TM`, `HM`) | All Surfaces | **Engineering tracking codes and sprint terminology leak across user interfaces.** | `ScreenHeaderBadge`, buttons labeled `Details (PW-003)`, `Book Now (PW-004)`, `Investigate (HD-008)`, navbar `Find Storage (PW-002)`. | Catastrophic loss of brand trust. Customers and hosts perceive the site as an internal prototype. | Eliminate all screen tracking IDs, workflow badges (`WF-xxx`), and phase labels from production UI. Move developer diagnostics into a hidden development drawer. | **UX-Only** |
| **`UX-P0-02`** | `TM-001`..`TM-044`, `HM-001`..`HM-037` | Mobile (`TM`, `HM`) | **Mobile application built as developer screen switcher rather than navigable app.** | `apps/mobile/app/(traveller)/index.tsx` & `app/(host)/index.tsx` render bottom card grids to swap preview cards. | Mobile app is completely non-functional for real travellers and hosts. Cannot execute end-to-end booking or custody check-in. | Deconstruct monolithic switcher into standard Expo Router stack/tab navigation (`/explore`, `/bookings`, `/scan`, `/profile`). | **UX & Frontend Architecture** |
| **`UX-P0-03`** | `HM-021`, `HM-024`, `HD-009` | Host Surfaces | **Absence of native camera QR scanner for luggage check-in and check-out.** | `apps/mobile/app/(host)/scanner.tsx` displays a static text box with pre-filled PIN `482910`; no `expo-camera` integration. | Host attendants cannot quickly scan customer luggage passes at physical counters, causing long queues and manual errors. | Integrate native mobile camera QR code scanner with automated barcode detection and rate-limited PIN fallback. | **Functional / Mobile Native** (Needs camera permissions) |
| **`UX-P0-04`** | `PW-002`, `TM-012` | Public & Traveller | **Absence of interactive geospatial map on discovery surfaces.** | `PW-002` displays a dark text card labeled `POSTGIS + MAPLIBRE PREVIEW`; `TM-012` displays a static listing card. | Travellers cannot visually locate luggage storage spots relative to railway stations, airports, or tourist attractions. | Implement interactive MapLibre GL map with custom pins, clustering, and radius filtering on Web and Mobile. | **Functional / Frontend** (MapLibre tiles) |
| **`UX-P0-05`** | `AD-013` | Superadmin | **Custody Incident & Dispute Investigation screen is an empty placeholder card.** | `apps/web/src/pages/AdminDashboardPages.tsx` renders a static text card reciting rule `OQ-015` without any controls. | Platform administrators cannot adjudicate lost, damaged, or stolen baggage disputes or issue compensatory refunds. | Design a complete incident management UI with luggage photo viewers, seal integrity logs, customer messaging, and claim payout controls. | **Functional & UX** (Needs dispute API) |
| **`UX-P0-06`** | `PW-005` | Public Web | **Simulated payment confirmation exposes client debug state buttons.** | `pw-005-confirm-desktop.png` top-right buttons: `State: GATEWAY`, `State: POLLING`, `State: CONFIRMED`. | Customers entering payment confirmation see test harness controls, suspecting financial fraud or insecure billing. | Remove debug state switcher from consumer view; implement real polling status listener with animated confirmation transition. | **UX-Only** |
| **`UX-P0-07`** | `PW-004`, `TM-017`..`TM-019` | Public & Traveller | **Multi-step checkout loses user input on back navigation.** | Navigating back from `/checkout` to `/search` clears selected dates, hours, and bag quantities from memory. | Travellers abandon checkout due to frustration of re-entering trip dates and bag counts. Severe conversion drop. | Persist checkout reservation state in local browser/session storage (`useBookingDraftStore`). | **Frontend State** |

---

#### 2.2 Priority P1 — Major Usability & Visual Design Quality Issues

| Finding ID | Affected Screens | Surface | Problem Description | Evidence & Traceability | User & Business Impact | Recommended Solution | Work Type & Dependencies |
|:---:|:---:|:---:|---|---|---|---|:---:|
| **`UX-P1-01`** | All Screens | All Surfaces | **Generic, outdated corporate color scheme lacks travel warmth and brand identity.** | Monotonous `slate-900` and `blue-600` palette across all screens. | Brand looks like a generic SaaS dashboard rather than a welcoming global travel hospitality marketplace. | Implement "Ceylon Warmth & Coastal Precision" design token system (Midnight Navy, Terracotta, Sunlit Sand). | **Design System** |
| **`UX-P1-02`** | All 20 Mascot Assets | All Surfaces | **29.5MB uncompressed PNG mascot assets cause severe network payload bloat.** | 20 PNGs @ 1.5MB each loaded directly in `<img>` tags over cellular networks. | Slow mobile loading times, high data roaming costs for tourists, high bounce rate. | Generate optimized WebP derivative assets (@1x and @2x), reducing payload to $<850$ KB without altering original PNGs. | **Asset Optimization** |
| **`UX-P1-03`** | `HD-001`, `AD-001` | Host & Superadmin | **Dashboard homepages overwhelmed by sitemap navigation card grids.** | Over 60% of `HD-001` and `AD-001` viewport space is filled with 14 and 18 screen navigation cards. | Operators cannot easily view daily tasks, pending alerts, or operational KPIs. | Re-architect overview pages around actionable task queues, live timelines, and prominent metric charts. | **UX Redesign** |
| **`UX-P1-04`** | `AD-013`, `TM-023` | Admin & Mobile | **Mascot character placed in inappropriate serious dispute and error contexts.** | Kiri shown shrugging playfully in `AD-013` (stolen luggage disputes) and `TM-023` (payment failed). | Trivializes customer financial loss and baggage emergencies; damages corporate trust. | Enforce strict brand guardrails prohibiting mascot usage in dispute adjudication, fraud logs, and payment errors. | **UX & Brand Strategy** |
| **`UX-P1-05`** | `PW-001`..`PW-011` | Public Web | **Consumer website footer functions as internal developer screen sitemap.** | Footer displays `PUBLIC WEBSITE (PW-001..011)`, `HOST DASHBOARD (HD-001..014)`, `SUPERADMIN (AD-001..018)`. | Exposes internal surface divisions to public search engine crawlers and users; looks unprofessional. | Replace with standard consumer footer: "Cities & Locations", "How It Works", "Host With Us", "Help & FAQs", "Terms & Privacy". | **UX-Only** |
| **`UX-P1-06`** | Global Web Navbar | Public Web | **Navbar cluttered with diagnostic links and developer screen count pills.** | Displays `Health`, `Traveller Web (11)`, `Host Hub (14)`, `Admin Hub (18)` in consumer navigation. | Distracts travellers from primary booking journey; invites unauthorized clicking on admin surfaces. | Streamline navbar to: Logo, "Find Storage", "How It Works", "Become a Host", "Help", and Auth buttons. | **UX-Only** |
| **`UX-P1-07`** | `PW-002`, `TM-013` | Public & Traveller | **Location listing cards lack clear visual hierarchy and primary action guidance.** | Equal visual weight for `Details (PW-003)` and `Book Now (PW-004)` buttons; cramped pricing presentation. | Analysis paralysis; users hesitate between viewing details and entering booking. | Restructure location card: make entire card clickable to open details, with a single prominent "Book from LKR XXX" button. | **UX Redesign** |
| **`UX-P1-08`** | `PW-004`, `TM-019` | Public & Traveller | **Overly aggressive late collection warnings create unnecessary checkout anxiety.** | Pre-checkout banner highlights late penalties and hourly surcharges before booking confirmation. | Cart abandonment; users fear punitive charges for minor transit delays. | Rephrase late collection policy with reassuring language ("Flexible Grace Period Included") with subtle expandable details. | **UX & Micro-copy** |
| **`UX-P1-09`** | `HD-002`..`HD-006` | Host Web | **Lack of nested sub-tab navigation in Host Location Management.** | Editing a location forces users to return to main sidebar to reach Schedule, Capacity, or Pricing sub-pages. | Frustrating, disjointed editing experience for host business owners managing multiple locations. | Implement a unified Location Profile workspace with horizontal sub-tabs (Details, Hours, Zones, Pricing). | **UX Redesign** |
| **`UX-P1-10`** | `TM-001`..`TM-044` | Traveller Mobile | **Lack of persistent bottom tab navigation bar on mobile.** | Mobile interface lacks standard bottom tabs (`Explore`, `Bookings`, `Saved`, `Profile`), relying on hub switcher. | Disorients mobile travellers accustomed to standard iOS and Android navigation paradigms. | Implement native Expo Router bottom tab bar with tactile haptic feedback. | **Mobile UX Architecture** |
| **`UX-P1-11`** | `PW-003`, `HD-008` | Public & Host | **Photo evidence policy presentation lacks clarity regarding baggage safety.** | Policy displays technical code `OPTIONAL_BY_DEFAULT` or `CONFIGURED_MANDATORY`. | Travellers do not understand what photo evidence means or how their property is documented. | Present policy with clear human iconography: "Host takes verified bag photos at check-in" with sample tamper seal badge. | **UX & Micro-copy** |
| **`UX-P1-12`** | `AD-002` | Superadmin | **Host KYC verification queue lacks high-resolution document zoom & review tools.** | Small document thumbnail cards with basic Approve/Reject buttons; no side-by-side verification view. | Operational bottlenecks and risk of approving fraudulent host registrations. | Build split-pane review screen with full-screen pan/zoom document viewer and structured rejection reason checklist. | **UX Redesign** |
| **`UX-P1-13`** | `PW-004`, `TM-017` | Public & Traveller | **Unfriendly date and time selection controls.** | Uses standard browser datetime input; does not show host opening/closing hours directly on the time picker. | Users select times when the storage location is closed, receiving an error only upon submission. | Implement custom date-range and time-slot selector that grays out closed operating hours in real time. | **Frontend Component** |
| **`UX-P1-14`** | `TM-035`, `PW-011` | Traveller Surfaces | **Empty booking states lack actionable next steps or location search entry points.** | Displays empty box with mascot peeking and text "No active bookings found". | Dead end; misses prime opportunity to guide traveller to book storage. | Add prominent "Find Storage Near You" CTA button and popular city shortcuts inside empty state. | **UX-Only** |

---

#### 2.3 Priority P2 — Spacing, Consistency & Usability Polish (18 Findings Summary)

- **`UX-P2-01`**: Replace excessive nested borders (`border-slate-200`) with subtle tonal surface elevation and soft shadows.
- **`UX-P2-02`**: Unify font weights and scale down oversized headings from `text-5xl` to balanced `text-3xl`.
- **`UX-P2-03`**: Enforce WCAG 2.2 AA compliant contrast on all metadata chips ($>4.5:1$ ratio).
- **`UX-P2-04`**: Introduce explicit `:focus-visible` styling with brand-colored outlines across all interactive web controls.
- **`UX-P2-05`**: Expand mobile touch targets to minimum $44\times 44$ pixels on all filters, counters, and navigation pills.
- **`UX-P2-06`**: Add accessible `alt` text to web images and `accessibilityLabel` attributes to React Native mascot elements.
- **`UX-P2-07`**: Implement semantic HTML5 landmark tags (`<main>`, `<nav>`, `<aside>`, `<header>`) across web templates.
- **`UX-P2-08`**: Add "Skip to Main Content" accessibility link at the top of the web application.
- **`UX-P2-09`**: Add modal confirmation dialogues before triggering destructive actions (Suspend Host, Revoke Access).
- **`UX-P2-10`**: Replace 3-second disappearing toasts with persistent dismissible alerts on form completions.
- **`UX-P2-11`**: Introduce sticky table headers and responsive horizontal scrollbars on financial ledgers (`AD-010`, `HD-010`).
- **`UX-P2-12`**: Add sorting indicators on all table columns (Date, Status, Reference, Amount LKR).
- **`UX-P2-13`**: Reconcile iconography across web and mobile using unified icon design tokens.
- **`UX-P2-14`**: Provide bag size visual dimension reference cards (Small: Daypack $<5$kg, Medium: Cabin $<15$kg, Large: Checked $<25$kg).
- **`UX-P2-15`**: Implement smooth skeleton loading animations to eliminate cumulative layout shift (CLS).
- **`UX-P2-16`**: Add "Copy to Clipboard" one-click action next to booking references and PIN codes.
- **`UX-P2-17`**: Display currency code `LKR` with consistent formatting (e.g. `LKR 1,450.00`).
- **`UX-P2-18`**: Display timezone indicators (`IST — Sri Lanka Standard Time`) on all drop-off and pick-up timestamps.

---

#### 2.4 Priority P3 — Polish & Micro-Copy Refinements (9 Findings Summary)

- **`UX-P3-01`**: Add subtle hover elevation animations (`translate-y-[-2px]`) on location cards.
- **`UX-P3-02`**: Incorporate warm Sri Lankan greeting copy ("Ayubowan / Vanakkam / Welcome").
- **`UX-P3-03`**: Add subtle celebratory confetti micro-animation upon booking confirmation (`PW-005`, `TM-024`).
- **`UX-P3-04`**: Include estimated travel distance and walking time from transit station entrances (e.g. "3 mins walk from Colombo Fort Platform 1").
- **`UX-P3-05`**: Add a "Save to Calendar" (.ics) export action on booking confirmation.
- **`UX-P3-06`**: Add printable luggage tag receipt view for host attendants.
- **`UX-P3-07`**: Include weather alert badge on regional Sri Lanka discovery cards (e.g. "Monsoon Season in Ella — Indoor Vaults Recommended").
- **`UX-P3-08`**: Refine avatar fallbacks with host initials when partner storefront images are loading.
- **`UX-P3-09`**: Add keyboard shortcut tooltips (`?` for help, `/` to focus search) on administrative dashboard surfaces.
