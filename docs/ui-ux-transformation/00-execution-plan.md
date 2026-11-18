# 00 — UI/UX Excellence & Product Experience Transformation: Execution Plan

**Branch:** `feature/ui-ux-excellence-transformation` (branched from synchronized `main` @ `db4551d` / `dev` @ `b95814c`)  
**Principal Design Architect:** Coordinating Workstreams `WS-UX-01` through `WS-UX-09`  
**Objective:** Elevate LuggageStorage from a functional MVP into a cohesive, modern, accessible, responsive travel-tech marketplace and operations suite across Web and Mobile—preserving 100% of existing API contracts, RBAC guards, custody state machines, financial ledger math, and Playwright/Vitest test contracts.

---

## 1. Workstream Allocation

| Workstream | Scope | Key Deliverables |
|---|---|---|
| **WS-UX-01** | Product-Wide UX Audit & Experience Architecture | `01-product-wide-ux-audit.md`, `10-component-and-screen-coverage-matrix.md` |
| **WS-UX-02** | Brand Identity, Design System & Visual Language | CWCP Web/Mobile foundation polish, Google Fonts (`Plus Jakarta Sans`, `JetBrains Mono`), shared `Modal`, `SlideOverDrawer`, `EmptyState`, `Select`, `Textarea`, `PageHeader`; `02-brand-and-design-system.md` |
| **WS-UX-03** | Mascot & Illustration Experience Transformation | 20-asset inventory & utilization across Web & Mobile, transparent composition variants (`bare`/`spotlight`/`hero`/`empty`), `03-mascot-and-illustration-strategy.md` |
| **WS-UX-04** | Traveller Web Experience Transformation | `AppShell` mobile nav drawer, `LandingPage`, `SearchDiscoveryPage`, `LocationDiscoveryMap`, `LocationDetailPage`, `CheckoutSchedulePage`, `PaymentConfirmationPage`, `BookingsPortalPage`, `CustodyQrPassCard`, `StaticInfoPages`, Auth/Account/Error CWCP unification; `04-traveller-web-transformation.md` |
| **WS-UX-05** | Host Workspace Experience Transformation | `HostDashboardLayout` (mobile drawer + hub-sync), `HostOverviewPage`, `HostOnboardingPage`, `HostLocationsPage` (readiness chips + disable confirm), shared 4-tab Setup nav (`LocationEditor`/`Schedule`/`CapacityZones`/`Pricing`), `HostBookingsPage`, `HostOperationsDeskPage` (Live Counter Queue + 3-step desk), `HostFinancePage`, `HostPayoutsPage`, `HostReviewsPage`, `HostStaffPage`, `HostBusinessSettingsPage`; `05-host-workspace-transformation.md` |
| **WS-UX-06** | Superadmin & Support Experience Transformation | `AdminDashboardLayout` (grouped nav + mobile drawer), `AdminInspectorDrawer` replacing 7 inline bottom drawers, dedicated `/admin/bookings/:id` view, real photo thumbnails for location media & custody evidence, Support two-tab Reply/Note switcher + `Assign to Me`, loading skeleton fixes; `06-admin-and-support-transformation.md` |
| **WS-UX-07** | Mobile Experience Transformation | Unified brand (`LuggageStorage`), safe-area fixes (`DiscoveryView` top inset, `(host)/_layout` bottom inset, `confirm.tsx` header), `BottomSheet` backdrop/keyboard, `DateTimeSelector` iOS picker, `checkout` auth redirect & deduplication, `scanner`/`intake` one-handed optimization, segmented `location-editor`/`onboarding`/`support`, unused Kiri mascots; `07-mobile-experience-transformation.md` |
| **WS-UX-08** | Interaction, Animation & Micro-interaction Engineering | Reduced-motion CSS/RN tokens, subtle state transitions, skeleton loading, honest confirmation flows, copy/focus micro-interactions; `08-interaction-and-motion-guidelines.md` |
| **WS-UX-09** | Accessibility, Responsive QA & Visual Regression | TypeScript, ESLint, Vitest (Contracts/Web/Mobile), Expo export, Vite production build, Playwright E2E + before/after screenshot audit across viewports; `09-visual-and-accessibility-qa-report.md`, `11-final-transformation-handover.md` |

---

## 2. Execution Phases & Gates

1. **Phase 0 — Baseline & Discovery (Complete / In Progress):**
   - Verified `main` (`db4551d`) and `dev` (`b95814c`) tree parity; created `feature/ui-ux-excellence-transformation`.
   - Verified baseline checks: Contracts (`81/81` tests), Web (`18` files / `162` tests + `vite build`), Mobile (`19` files / `124` tests).
   - Audited all Web (`43` mapped + Auth/Account/Error) and Mobile (`50+` routes/layouts) screens via 4 specialist audit workstreams.
   - Visually inspected all 20 Kiri mascot PNG/WebP assets and captured baseline "before" screenshots.
2. **Phase 1 — Design & Motion Foundation:**
   - Unify Web `index.html` & `index.css` with CWCP typography & `prefers-reduced-motion` tokens.
   - Build shared Web primitives (`Modal`, `SlideOverDrawer`, `EmptyState`, `Select`, `Textarea`, `PageHeader`) and upgrade `MascotIllustration` on Web & Mobile.
   - Fix foundational Mobile components (`ScreenContainer`, `BottomSheet`, `ConfirmDialog`, `DateTimeSelector`, `TextInput`, `StatusBadge`, `LoadingSkeleton`, `EmptyState`).
3. **Phase 2–5 — Surface Transformations (Parallelizable across disjoint feature directories):**
   - Traveller Web + Auth/Account/Error (`WS-UX-04`)
   - Host Workspace (`WS-UX-05`)
   - Superadmin & Support (`WS-UX-06`)
   - Mobile Traveller & Host (`WS-UX-07`)
4. **Phase 6–8 — Verification, Visual QA & Handover:**
   - Full `typecheck`, `lint`, `test`, `build`, Expo export, Playwright E2E (if DB/API available) + after screenshots, and final documentation + PR targeting `main`.

---

## 3. Non-Negotiable Constraints

- Zero backend business logic rewrites or ledger/custody rule changes.
- Zero fabricated ratings, user counts, insurance guarantees, or fallback opening hours (`"08:00 - 20:00"`).
- Zero internal tracking codes (`PW-001`, `HD-001`, `AD-001`, `TM-001`, `HM-001`, `WF-001`, `OQ-001`) or `data-screen-id` attributes in production DOM.
- Strict preservation of existing E2E selectors (`loginViaUi`, `bookings`, `operations`, `incidents`, `locations`, `support`, `profile`).

