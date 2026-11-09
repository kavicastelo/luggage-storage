# Phase 2 — Master Screen Implementation & QA Verification Tracker

**Project:** Global Luggage Storage Marketplace  
**Document ID:** `DOC-ENG-P2-TRACKER`  
**Phase:** Phase 2 — Complete Product UI/UX Implementation  
**Authoritative Baseline:** `docs/product/ux/master-screen-registry.md` (`DOC-UX-001`), `docs/product/ux/navigation-and-journey-maps.md` (`DOC-UX-002`), `docs/product/ux/screen-to-workflow-matrix.md` (`DOC-UX-003`), `docs/phase-2b-ux-audit/00-executive-summary.md` (`DOC-UX-P2B-000`)  
**Status:** `RECONCILED PHASE 2B AUDIT BASELINE — 113 ACTIVE SCREENS (TEST_VERIFIED_SIMULATION / PENDING PHASE 2C REDESIGN)`

---

## 1. Executive Summary & Surface Totals

| Surface Code | Target Application | Registered Active Screens | Visual Rendering | Interaction State | API & Backend | QA / Audit Status |
|:---|:---|:---:|:---:|:---:|:---:|:---:|
| **`TM`** (Traveller Mobile) | `apps/mobile` | **39** | 39 / 39 (Simulation) | 39 / 39 (Hybrid) | 6 Live Auth / 33 Deferred | `TEST_VERIFIED_SIMULATION` |
| **`HM`** (Host Mobile) | `apps/mobile` | **31** | 31 / 31 (Simulation) | 31 / 31 (Hybrid) | 2 Live Auth / 29 Deferred | `TEST_VERIFIED_SIMULATION` |
| **`PW`** (Public Website) | `apps/web` | **11** | 11 / 11 (Simulation) | 11 / 11 (Local) | 1 Live Auth / 10 Deferred | `TEST_VERIFIED_SIMULATION` |
| **`HD`** (Host Web Dashboard) | `apps/web` | **14** | 14 / 14 (Simulation) | 14 / 14 (Local) | 1 Live Profile / 13 Deferred | `TEST_VERIFIED_SIMULATION` |
| **`AD`** (Superadmin Dashboard) | `apps/web` | **18** | 18 / 18 (Simulation) | 18 / 18 (Hybrid) | 2 Live Auth/Audit / 16 Deferred | `TEST_VERIFIED_SIMULATION` |
| **TOTAL ACTIVE SCREENS** | **Monorepo (`web` + `mobile`)** | **113** | **113 / 113** | **113 / 113** | **12 Live / 101 Deferred** | **`PHASE 2B AUDITED`** |

### 1.1 Reserved Screen IDs (Excluded by Specification — 11 IDs)
Per `docs/product/ux/master-screen-registry.md`, the following 11 IDs are intentionally reserved and verified **NOT** implemented as active screens:
- **Traveller Mobile Reserved (5):** `TM-009`, `TM-010`, `TM-025`, `TM-026`, `TM-038`
- **Host Mobile Reserved (6):** `HM-008`, `HM-012`, `HM-015`, `HM-016`, `HM-017`, `HM-032`

---

## 2. Traveller Mobile (`TM` — 39 Active Screens in `apps/mobile`)

| Screen ID | Screen Name | Route / Entry | Primary File | Mascot | Workflows | Backend Dependency | Status |
|:---|:---|:---|:---|:---|:---|:---|:---|
| `TM-001` | Splash Screen | `/(traveller)?screen=TM-001` | `apps/mobile/app/(traveller)/index.tsx` | `wave` (`01`) | `WF-001` | `LIVE_PHASE_1B` | `QA_VERIFIED` |
| `TM-002` | Onboarding Welcome | `/(traveller)?screen=TM-002` | `apps/mobile/app/(traveller)/index.tsx` | `wave` (`01`) | `WF-001` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-003` | Permissions Request | `/(traveller)?screen=TM-003` | `apps/mobile/app/(traveller)/index.tsx` | `pointing` (`05`) | `WF-001`, `WF-007` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-004` | Language & Currency Selector | `/(traveller)?screen=TM-004` | `apps/mobile/app/(traveller)/index.tsx` | `pointing` (`05`) | `WF-001` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-005` | Login Screen | `/(auth)/login` | `apps/mobile/app/(auth)/login.tsx` | `key` (`14`) | `WF-002` | `LIVE_PHASE_1B` | `QA_VERIFIED` |
| `TM-006` | Registration Screen | `/(auth)/register` | `apps/mobile/app/(auth)/register.tsx` | `key` (`14`) | `WF-001` | `LIVE_PHASE_1B` | `QA_VERIFIED` |
| `TM-007` | Forgot Password | `/(auth)/forgot-password` | `apps/mobile/app/(auth)/forgot-password.tsx` | `key` (`14`) | `WF-003` | `LIVE_PHASE_1B` | `QA_VERIFIED` |
| `TM-008` | Email / Phone OTP Verification | `/(traveller)?screen=TM-008` | `apps/mobile/app/(traveller)/index.tsx` | `phone` (`08`) | `WF-001` | `LIVE_PHASE_1B` | `QA_VERIFIED` |
| `TM-011` | Home & Destination Search | `/(traveller)?screen=TM-011` | `apps/mobile/app/(traveller)/index.tsx` | `suitcase-walk` (`02`) | `WF-007` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-012` | Geospatial Map Discovery | `/(traveller)/explore` | `apps/mobile/app/(traveller)/explore.tsx` | `map` (`10`) | `WF-007` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-013` | Discovery List & Filters | `/(traveller)?screen=TM-013` | `apps/mobile/app/(traveller)/index.tsx` | `sun-hat` (`11`) | `WF-007`, `WF-008` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-014` | Filter Modal | `/(traveller)?screen=TM-014` | `apps/mobile/app/(traveller)/index.tsx` | `thinking` (`06`) | `WF-008` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-015` | Storage Location Details | `/(traveller)?screen=TM-015` | `apps/mobile/app/(traveller)/index.tsx` | `map` (`10`) | `WF-009` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-016` | Location Reviews & Ratings | `/(traveller)?screen=TM-016` | `apps/mobile/app/(traveller)/index.tsx` | `high-five` (`12`) | `WF-009`, `WF-037` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-017` | Booking Date & Time Picker | `/(traveller)?screen=TM-017` | `apps/mobile/app/(traveller)/index.tsx` | `suitcase-walk` (`02`) | `WF-017` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-018` | Bag Selection & Category Counter | `/(traveller)?screen=TM-018` | `apps/mobile/app/(traveller)/index.tsx` | `blank-tag` (`04`) | `WF-017`, `WF-018` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-019` | Price Breakdown & Checkout | `/(traveller)?screen=TM-019` | `apps/mobile/app/(traveller)/index.tsx` | `blank-tag` (`04`) | `WF-017`, `WF-018` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-020` | Payment Gateway Webview | `/(traveller)?screen=TM-020` | `apps/mobile/app/(traveller)/index.tsx` | `phone` (`08`) | `WF-019` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-021` | Payment Status Polling | `/(traveller)?screen=TM-021` | `apps/mobile/app/(traveller)/index.tsx` | `sitting-suitcase` (`20`) | `WF-020` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-022` | Host Approval Pending Screen | `/(traveller)?screen=TM-022` | `apps/mobile/app/(traveller)/index.tsx` | `sitting-suitcase` (`20`) | `WF-021`, `WF-022` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-023` | Payment Failed Screen | `/(traveller)?screen=TM-023` | `apps/mobile/app/(traveller)/index.tsx` | `shrug` (`19`) | `WF-020`, `WF-023` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-024` | Booking Confirmation Screen | `/(traveller)?screen=TM-024` | `apps/mobile/app/(traveller)/index.tsx` | `jump` (`09`) | `WF-020`, `WF-021` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-027` | Active Booking Details | `/(traveller)?screen=TM-027` | `apps/mobile/app/(traveller)/index.tsx` | `suitcase-hug` (`15`) | `WF-024`, `WF-025` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-028` | Check-in Handover Pass | `/(traveller)?screen=TM-028` | `apps/mobile/app/(traveller)/index.tsx` | `phone` (`08`) | `WF-024` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-029` | In-Storage Live Status | `/(traveller)?screen=TM-029` | `apps/mobile/app/(traveller)/index.tsx` | `suitcase-hug` (`15`) | `WF-024`, `WF-025` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-030` | Check-out Collection Pass | `/(traveller)?screen=TM-030` | `apps/mobile/app/(traveller)/index.tsx` | `alarm-clock` (`13`) | `WF-025` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-031` | Booking Cancellation Flow | `/(traveller)?screen=TM-031` | `apps/mobile/app/(traveller)/index.tsx` | `shrug` (`19`) | `WF-028` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-032` | Cancellation Result & Refund Status | `/(traveller)?screen=TM-032` | `apps/mobile/app/(traveller)/index.tsx` | `shrug` (`19`) | `WF-028`, `WF-030` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-033` | Refund Detail Tracking | `/(traveller)?screen=TM-033` | `apps/mobile/app/(traveller)/index.tsx` | `sitting-suitcase` (`20`) | `WF-030`, `WF-032` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-034` | Submit Review & Rating | `/(traveller)?screen=TM-034` | `apps/mobile/app/(traveller)/index.tsx` | `high-five` (`12`) | `WF-037` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-035` | Booking History List | `/(traveller)?screen=TM-035` | `apps/mobile/app/(traveller)/index.tsx` | `suitcase-peek` (`03`) | `WF-024`, `WF-025`, `WF-030` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-036` | Saved Favourites | `/(traveller)?screen=TM-036` | `apps/mobile/app/(traveller)/index.tsx` | `suitcase-peek` (`03`) | `WF-007` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-037` | Notification Centre | `/(traveller)?screen=TM-037` | `apps/mobile/app/(traveller)/index.tsx` | `sleeping` (`07`) | `WF-021`, `WF-026` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-039` | Help & Support Centre | `/(traveller)?screen=TM-039` | `apps/mobile/app/(traveller)/index.tsx` | `thinking` (`06`) | `WF-039` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-040` | Create Support Ticket | `/(traveller)?screen=TM-040` | `apps/mobile/app/(traveller)/index.tsx` | `thinking` (`06`) | `WF-039` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-041` | Ticket Conversation Thread | `/(traveller)?screen=TM-041` | `apps/mobile/app/(traveller)/index.tsx` | `sitting-suitcase` (`20`) | `WF-039`, `WF-040` | `UI_SIMULATION` | `QA_VERIFIED` |
| `TM-042` | Traveller Profile & Account | `/(account)/profile` | `apps/mobile/app/(account)/profile.tsx` | `selfie` (`16`) | `WF-002` | `LIVE_PHASE_1B` | `QA_VERIFIED` |
| `TM-043` | Security & Password Update | `/(account)/security` | `apps/mobile/app/(account)/security.tsx` | `key` (`14`) | `WF-003` | `LIVE_PHASE_1B` | `QA_VERIFIED` |
| `TM-044` | App Settings | `/(traveller)?screen=TM-044` | `apps/mobile/app/(traveller)/index.tsx` | `king-coconut` (`17`) | `WF-001` | `UI_SIMULATION` | `QA_VERIFIED` |

---

## 3. Host Mobile (`HM` — 31 Active Screens in `apps/mobile`)

| Screen ID | Screen Name | Route / Entry | Primary File | Actor Scope | Mascot | Workflows | Status |
|:---|:---|:---|:---|:---|:---|:---|:---|
| `HM-001` | Host Splash & Welcome | `/(host)?screen=HM-001` | `apps/mobile/app/(host)/index.tsx` | Host / Staff | `wave` (`01`) | `WF-004` | `QA_VERIFIED` |
| `HM-002` | Host Registration & Login | `/(auth)/login` | `apps/mobile/app/(auth)/login.tsx` | Host / Staff | `key` (`14`) | `WF-002`, `WF-004` | `QA_VERIFIED` |
| `HM-003` | Business Profile Setup | `/(host)?screen=HM-003` | `apps/mobile/app/(host)/index.tsx` | Host Owner | `pointing` (`05`) | `WF-004` | `QA_VERIFIED` |
| `HM-004` | KYC Document Upload | `/(host)?screen=HM-004` | `apps/mobile/app/(host)/index.tsx` | Host Owner | `selfie` (`16`) | `WF-004` | `QA_VERIFIED` |
| `HM-005` | Host Application Status | `/(host)?screen=HM-005` | `apps/mobile/app/(host)/index.tsx` | Host Owner | `sitting-suitcase` (`20`) | `WF-004`, `WF-005` | `QA_VERIFIED` |
| `HM-006` | Host Operations Dashboard | `/(host)?screen=HM-006` | `apps/mobile/app/(host)/index.tsx` | Host / Staff | `salute` (`18`) | `WF-021`, `WF-024`, `WF-025` | `QA_VERIFIED` |
| `HM-007` | Today's Expected Schedule | `/(host)?screen=HM-007` | `apps/mobile/app/(host)/index.tsx` | Host / Staff | `alarm-clock` (`13`) | `WF-024`, `WF-025` | `QA_VERIFIED` |
| `HM-009` | Storage Location Profile | `/(host)?screen=HM-009` | `apps/mobile/app/(host)/index.tsx` | Host Owner | `pointing` (`05`) | `WF-010` | `QA_VERIFIED` |
| `HM-010` | Operating Hours Editor | `/(host)?screen=HM-010` | `apps/mobile/app/(host)/index.tsx` | Host Owner | `sleeping` (`07`) | `WF-011` | `QA_VERIFIED` |
| `HM-011` | Schedule Exception Calendar | `/(host)?screen=HM-011` | `apps/mobile/app/(host)/index.tsx` | Host Owner | `sun-hat` (`11`) | `WF-012` | `QA_VERIFIED` |
| `HM-013` | Capacity & Zones Config | `/(host)?screen=HM-013` | `apps/mobile/app/(host)/index.tsx` | Host Owner | `suitcase-hug` (`15`) | `WF-014`, `WF-015` | `QA_VERIFIED` |
| `HM-014` | Pricing Rules Editor | `/(host)?screen=HM-014` | `apps/mobile/app/(host)/index.tsx` | Host Owner | `blank-tag` (`04`) | `WF-016` | `QA_VERIFIED` |
| `HM-018` | Booking Requests Queue | `/(host)?screen=HM-018` | `apps/mobile/app/(host)/index.tsx` | Host / Staff | `alarm-clock` (`13`) | `WF-021`, `WF-022` | `QA_VERIFIED` |
| `HM-019` | Request Review & Decision | `/(host)?screen=HM-019` | `apps/mobile/app/(host)/index.tsx` | Host / Staff | `thinking` (`06`) | `WF-021` | `QA_VERIFIED` |
| `HM-020` | Active Bookings List | `/(host)?screen=HM-020` | `apps/mobile/app/(host)/index.tsx` | Host / Staff | `suitcase-peek` (`03`) | `WF-024`, `WF-025` | `QA_VERIFIED` |
| `HM-021` | Check-in Scanner & PIN Entry | `/(host)/scanner` | `apps/mobile/app/(host)/scanner.tsx` | Host / Staff | `phone` (`08`) | `WF-024` | `QA_VERIFIED` |
| `HM-022` | Bag Inspection & Tagging | `/(host)?screen=HM-022` | `apps/mobile/app/(host)/index.tsx` | Host / Staff | `selfie` (`16`) | `WF-024` | `QA_VERIFIED` |
| `HM-023` | Check-in Evidence Camera | `/(host)?screen=HM-023` | `apps/mobile/app/(host)/index.tsx` | Host / Staff | `selfie` (`16`) | `WF-024` | `QA_VERIFIED` |
| `HM-024` | Check-out Verification Scanner | `/(host)/scanner` | `apps/mobile/app/(host)/scanner.tsx` | Host / Staff | `phone` (`08`) | `WF-025` | `QA_VERIFIED` |
| `HM-025` | Handover Release Confirmation | `/(host)?screen=HM-025` | `apps/mobile/app/(host)/index.tsx` | Host / Staff | `jump` (`09`) | `WF-025` | `QA_VERIFIED` |
| `HM-026` | Overdue Bags Alert View | `/(host)?screen=HM-026` | `apps/mobile/app/(host)/index.tsx` | Host / Staff | `alarm-clock` (`13`) | `WF-026` | `QA_VERIFIED` |
| `HM-027` | Request Overdue Payment | `/(host)?screen=HM-027` | `apps/mobile/app/(host)/index.tsx` | Host / Staff | `alarm-clock` (`13`) | `WF-026`, `WF-027` | `QA_VERIFIED` |
| `HM-028` | Disputed Release Handover | `/(host)?screen=HM-028` | `apps/mobile/app/(host)/index.tsx` | Host / Staff | `shrug` (`19`) | `WF-027` | `QA_VERIFIED` |
| `HM-029` | Host Earnings & Balance | `/(host)?screen=HM-029` | `apps/mobile/app/(host)/index.tsx` | Host Owner | `king-coconut` (`17`) | `WF-033` | `QA_VERIFIED` |
| `HM-030` | Payout Bank Account Details | `/(host)?screen=HM-030` | `apps/mobile/app/(host)/index.tsx` | Host Owner | `key` (`14`) | `WF-034` | `QA_VERIFIED` |
| `HM-031` | Payout History & Receipts | `/(host)?screen=HM-031` | `apps/mobile/app/(host)/index.tsx` | Host Owner | `king-coconut` (`17`) | `WF-034`, `WF-035` | `QA_VERIFIED` |
| `HM-033` | Staff Management List | `/(host)?screen=HM-033` | `apps/mobile/app/(host)/index.tsx` | Host Owner | `high-five` (`12`) | `WF-006` | `QA_VERIFIED` |
| `HM-034` | Invite Staff Member | `/(host)?screen=HM-034` | `apps/mobile/app/(host)/index.tsx` | Host Owner | `high-five` (`12`) | `WF-006` | `QA_VERIFIED` |
| `HM-035` | Host Customer Reviews | `/(host)?screen=HM-035` | `apps/mobile/app/(host)/index.tsx` | Host / Staff | `high-five` (`12`) | `WF-037` | `QA_VERIFIED` |
| `HM-036` | Incident & Dispute Report | `/(host)?screen=HM-036` | `apps/mobile/app/(host)/index.tsx` | Host / Staff | `salute` (`18`) | `WF-041` | `QA_VERIFIED` |
| `HM-037` | Host Business Settings | `/(host)?screen=HM-037` | `apps/mobile/app/(host)/index.tsx` | Host Owner | `salute` (`18`) | `WF-004`, `WF-010` | `QA_VERIFIED` |

---

## 4. Public Traveller Website (`PW` — 11 Active Screens in `apps/web`)

| Screen ID | Screen Name | Web Route | Primary File | Mascot | Workflows | Status |
|:---|:---|:---|:---|:---|:---|:---|
| `PW-001` | Public Landing Page | `/` | `apps/web/src/pages/PublicMarketplacePages.tsx` | `wave` (`01`), `king-coconut` (`17`) | `WF-007` | `QA_VERIFIED` |
| `PW-002` | Web Search & Discovery | `/search` | `apps/web/src/pages/PublicMarketplacePages.tsx` | `map` (`10`) | `WF-007`, `WF-008` | `QA_VERIFIED` |
| `PW-003` | Location Profile Detail | `/locations/:slug` | `apps/web/src/pages/PublicMarketplacePages.tsx` | `suitcase-hug` (`15`) | `WF-009` | `QA_VERIFIED` |
| `PW-004` | Web Checkout & Schedule | `/checkout/:locId` | `apps/web/src/pages/PublicMarketplacePages.tsx` | `blank-tag` (`04`) | `WF-017`, `WF-018` | `QA_VERIFIED` |
| `PW-005` | Web Payment & Confirmation | `/booking/confirm` | `apps/web/src/pages/PublicMarketplacePages.tsx` | `jump` (`09`) | `WF-019`, `WF-020`, `WF-021` | `QA_VERIFIED` |
| `PW-006` | Become a Host Landing | `/become-a-host` | `apps/web/src/pages/PublicMarketplacePages.tsx` | `high-five` (`12`) | `WF-004` | `QA_VERIFIED` |
| `PW-007` | How It Works | `/how-it-works` | `apps/web/src/pages/PublicMarketplacePages.tsx` | `suitcase-walk` (`02`) | `WF-007`, `WF-024`, `WF-025` | `QA_VERIFIED` |
| `PW-008` | Help Centre & FAQs | `/help` | `apps/web/src/pages/PublicMarketplacePages.tsx` | `thinking` (`06`) | `WF-039` | `QA_VERIFIED` |
| `PW-009` | Contact Us & Inquiries | `/contact` | `apps/web/src/pages/PublicMarketplacePages.tsx` | `phone` (`08`) | `WF-039` | `QA_VERIFIED` |
| `PW-010` | Terms, Privacy & Legal | `/terms` | `apps/web/src/pages/PublicMarketplacePages.tsx` | `salute` (`18`) | `WF-001`, `WF-027` | `QA_VERIFIED` |
| `PW-011` | Traveller Web Portal | `/portal/bookings` | `apps/web/src/pages/PublicMarketplacePages.tsx` | `suitcase-walk` (`02`) | `WF-021`, `WF-022`, `WF-030`, `WF-037` | `QA_VERIFIED` |

---

## 5. Host Web Dashboard (`HD` — 14 Active Screens in `apps/web`)

| Screen ID | Screen Name | Web Route | Primary File | Actor Scope | Mascot | Workflows | Status |
|:---|:---|:---|:---|:---|:---|:---|:---|
| `HD-001` | Host Overview Dashboard | `/host/dashboard` | `apps/web/src/pages/HostDashboardPages.tsx` | Host Owner / Staff | `salute` (`18`) | `WF-021`, `WF-024`, `WF-033` | `QA_VERIFIED` |
| `HD-002` | Location Management | `/host/locations` | `apps/web/src/pages/HostDashboardPages.tsx` | Host Owner | `map` (`10`) | `WF-010` | `QA_VERIFIED` |
| `HD-003` | Location Profile Editor | `/host/locations/:id` | `apps/web/src/pages/HostDashboardPages.tsx` | Host Owner | `pointing` (`05`) | `WF-010` | `QA_VERIFIED` |
| `HD-004` | Schedule & Calendar Editor | `/host/locations/:id/schedule` | `apps/web/src/pages/HostDashboardPages.tsx` | Host Owner | `sleeping` (`07`) | `WF-011`, `WF-012` | `QA_VERIFIED` |
| `HD-005` | Capacity Pools & Zones | `/host/locations/:id/capacity` | `apps/web/src/pages/HostDashboardPages.tsx` | Host Owner | `suitcase-hug` (`15`) | `WF-014`, `WF-015` | `QA_VERIFIED` |
| `HD-006` | Pricing Rules & Multipliers | `/host/locations/:id/pricing` | `apps/web/src/pages/HostDashboardPages.tsx` | Host Owner | `blank-tag` (`04`) | `WF-016` | `QA_VERIFIED` |
| `HD-007` | Booking Management Hub | `/host/bookings` | `apps/web/src/pages/HostDashboardPages.tsx` | Host Owner / Staff | `suitcase-peek` (`03`) | `WF-021`, `WF-024`, `WF-025`, `WF-026` | `QA_VERIFIED` |
| `HD-008` | Booking Investigation Modal | `/host/bookings?inspect=:bookingId` | `apps/web/src/pages/HostDashboardPages.tsx` | Host Owner / Staff | `selfie` (`16`) | `WF-024`, `WF-025`, `WF-027`, `WF-041` | `QA_VERIFIED` |
| `HD-009` | Web Check-in/Out Operations | `/host/operations` | `apps/web/src/pages/HostDashboardPages.tsx` | Host Owner / Staff | `phone` (`08`) | `WF-024`, `WF-025` | `QA_VERIFIED` |
| `HD-010` | Financial Revenue & Ledger | `/host/finance` | `apps/web/src/pages/HostDashboardPages.tsx` | Host Owner Only | `king-coconut` (`17`) | `WF-033` | `QA_VERIFIED` |
| `HD-011` | Payout Accounts & History | `/host/payouts` | `apps/web/src/pages/HostDashboardPages.tsx` | Host Owner Only | `key` (`14`) | `WF-034`, `WF-035` | `QA_VERIFIED` |
| `HD-012` | Review Management | `/host/reviews` | `apps/web/src/pages/HostDashboardPages.tsx` | Host Owner / Staff | `high-five` (`12`) | `WF-037` | `QA_VERIFIED` |
| `HD-013` | Staff Management & RBAC | `/host/staff` | `apps/web/src/pages/HostDashboardPages.tsx` | Host Owner Only | `key` (`14`) | `WF-006` | `QA_VERIFIED` |
| `HD-014` | Business Profile & Legal | `/host/settings` | `apps/web/src/pages/HostDashboardPages.tsx` | Host Owner Only | `salute` (`18`) | `WF-004` | `QA_VERIFIED` |

---

## 6. Superadmin Web Dashboard (`AD` — 18 Active Screens in `apps/web`)

| Screen ID | Screen Name | Web Route | Primary File | Actor Scope | Mascot | Workflows | Status |
|:---|:---|:---|:---|:---|:---|:---|:---|
| `AD-001` | Platform Command Dashboard | `/admin` | `apps/web/src/pages/AdminDashboardPages.tsx` | Superadmin | `salute` (`18`) | `WF-005`, `WF-031`, `WF-034`, `WF-041` | `QA_VERIFIED` |
| `AD-002` | Host Verification Queue | `/admin/hosts/review` | `apps/web/src/pages/AdminDashboardPages.tsx` | Superadmin | `selfie` (`16`) | `WF-005` | `QA_VERIFIED` |
| `AD-003` | Host Directory & Management | `/admin/hosts` | `apps/web/src/pages/AdminDashboardPages.tsx` | Superadmin / Support | `high-five` (`12`) | `WF-005`, `WF-013` | `QA_VERIFIED` |
| `AD-004` | Storage Location Moderation | `/admin/locations` | `apps/web/src/pages/AdminDashboardPages.tsx` | Superadmin | `map` (`10`) | `WF-010`, `WF-013` | `QA_VERIFIED` |
| `AD-005` | Global Bookings Ledger | `/admin/bookings` | `apps/web/src/pages/AdminDashboardPages.tsx` | Superadmin / Support | `suitcase-hug` (`15`) | `WF-018`, `WF-028`, `WF-029` | `QA_VERIFIED` |
| `AD-006` | Payment Transactions Log | `/admin/payments` | `apps/web/src/pages/AdminDashboardPages.tsx` | Superadmin | `phone` (`08`) | `WF-019`, `WF-020` | `QA_VERIFIED` |
| `AD-007` | Refund Management Queue | `/admin/refunds` | `apps/web/src/pages/AdminDashboardPages.tsx` | Superadmin | `sitting-suitcase` (`20`) | `WF-030`, `WF-031`, `WF-032` | `QA_VERIFIED` |
| `AD-008` | Host Payout Batch Generation | `/admin/payouts/batches` | `apps/web/src/pages/AdminDashboardPages.tsx` | Superadmin | `alarm-clock` (`13`) | `WF-034` | `QA_VERIFIED` |
| `AD-009` | Manual Payout Disbursement | `/admin/payouts/disburse` | `apps/web/src/pages/AdminDashboardPages.tsx` | Superadmin | `jump` (`09`) | `WF-035` | `QA_VERIFIED` |
| `AD-010` | Double-Entry Financial Ledger | `/admin/finance/ledger` | `apps/web/src/pages/AdminDashboardPages.tsx` | Superadmin | `blank-tag` (`04`) | `WF-036` | `QA_VERIFIED` |
| `AD-011` | Support Ticket Triage Queue | `/admin/support` | `apps/web/src/pages/AdminDashboardPages.tsx` | Support / Superadmin | `thinking` (`06`) | `WF-039`, `WF-040` | `QA_VERIFIED` |
| `AD-012` | Support Ticket Resolution View | `/admin/support/:id` | `apps/web/src/pages/AdminDashboardPages.tsx` | Support / Superadmin | `phone` (`08`) | `WF-040` | `QA_VERIFIED` |
| `AD-013` | Incident & Dispute Investigation | `/admin/incidents` | `apps/web/src/pages/AdminDashboardPages.tsx` | Superadmin | `shrug` (`19`) | `WF-027`, `WF-041`, `WF-042` | `QA_VERIFIED` |
| `AD-014` | Review Moderation Queue | `/admin/reviews` | `apps/web/src/pages/AdminDashboardPages.tsx` | Superadmin | `high-five` (`12`) | `WF-038` | `QA_VERIFIED` |
| `AD-015` | Promotion & Marketing Engine | `/admin/promotions` | `apps/web/src/pages/AdminDashboardPages.tsx` | Superadmin | `blank-tag` (`04`) | `WF-043` | `QA_VERIFIED` |
| `AD-016` | Platform System Configuration | `/admin/settings` | `apps/web/src/pages/AdminDashboardPages.tsx` | Superadmin | `pointing` (`05`) | `WF-044` | `QA_VERIFIED` |
| `AD-017` | Security & Compliance Audit Log | `/admin/audit` | `apps/web/src/pages/AdminDashboardPages.tsx` | Superadmin | `key` (`14`) | `WF-005`, `WF-031`, `WF-035`, `WF-044` | `QA_VERIFIED` |
| `AD-018` | Administrative Staff & RBAC | `/admin/staff` | `apps/web/src/pages/AdminDashboardPages.tsx` | Superadmin | `key` (`14`) | `WF-006`, `WF-044` | `QA_VERIFIED` |

---

## 7. Product Decision Alignment & Final Acceptance Reconciliation (`OQ-014` & `OQ-015`)

Following Product Owner review against `docs/product/assumptions-and-open-questions.md`, all Phase 2 screens, mock datasets, and UX references have been reconciled with the approved decisions for **`OQ-014`** and **`OQ-015`**:

### 7.1 Custody Verification Alignment (`OQ-014`)
- **QR Primary with Rate-Limited 6-Digit PIN Fallback:** Removed all wording implying simultaneous mandatory dual-factor (`QR + PIN`) verification across `PW-001`, `PW-003`, `PW-005`, `PW-007`, `PW-008`, `PW-010`, `PW-011`, `HD-001`, `HD-008`, `HD-009`, `TM-024`, `TM-027`..`TM-030`, `HM-021`, and `HM-024`. All screens now present cryptographic QR scan as the primary mechanism and rate-limited, server-verified, audited 6-digit PIN entry as the fallback when camera QR scanning is unavailable.
- **Mandatory Physical Bag-Count & Category Reconciliation:** Preserved and highlighted on `HM-022`, `HM-025`, `HD-008`, `HD-009`, and `AD-013`, blocking silent mismatches unless an authorized exception is logged.
- **Check-In / Check-Out Timestamps & Responsible Staff IDs:** Recorded and displayed on `HD-008`, `HD-009`, `HM-022`, `HM-025`, and `AD-013`.
- **Configurable Photo Evidence (`OPTIONAL_BY_DEFAULT` | `CONFIGURED_MANDATORY`):** Added `photoEvidencePolicy` per location in `apps/web/src/data/mock-marketplace.ts`, surfaced on `PW-003`, `HM-023`, `HD-008`, and configurable by Superadmin on `AD-016`.

### 7.2 Late Collection Fee & Decoupled Custody Alignment (`OQ-015`)
- **Configurable Grace Periods & Late Fee Policies (No Universal Hardcoded Defaults):** Added per-location `gracePeriodMinutes` (`30m`, `45m`, `60m`) and `lateFeePolicyLabel` in `apps/web/src/data/mock-marketplace.ts`, interactive Host configuration selectors on `HD-006` and `HM-014`, and Superadmin default policy selectors on `AD-016`. All references to `30 minutes` or `1.5x daily rate` are explicitly labeled as illustrative demo values.
- **Pre-Checkout Disclosure (`PW-004`, `TM-018`, `TM-019`):** Added a dedicated **Pre-Checkout Late Collection Policy Disclosure (`OQ-015`)** panel before booking payment.
- **In-App Payment & No Silent Charges (`TM-029`, `HM-026`, `HM-027`, `PW-011`):** Overdue fee requests trigger an in-app payment prompt for traveller review and settlement (no silent charges; cash at counter excluded for MVP).
- **Strict Separation of Physical Custody Return & Financial Disputes (`HM-028`, `HD-009`, `AD-013` / `BR-035`):** Unpaid or disputed late fees never block physical luggage handover once QR/PIN and bag-count reconciliation succeed; financial recovery is routed asynchronously to an audited billing dispute log.

### 7.3 Operational Support Queue Separation (`OQ-016`) & 7-Dimension Status Alignment
- **`OQ-016` — Operational Support Workflow & Ticket Queue Separation (`RESOLVED_INTERNAL` in `docs/project-stabilization/03-product-decision-resolution.md`):**
  - Standard customer service inquiries (`AD-011` / `AD-012`) are accessible to `SUPPORT` and `SUPERADMIN`, whereas high-priority custody/financial disputes (`AD-013`) are escalated to `SUPERADMIN`.
- **7-Dimension Implementation Status (`Spec`, `UI`, `Interaction`, `API`, `Backend`, `DB`, `QA`):**
  - See `docs/product/ux/master-screen-registry.md` for the complete 7-dimension breakdown across all 113 active screens distinguishing live Phase 1B Identity/RBAC/Audit screens (`TM-001`, `TM-005`..`TM-008`, `TM-042`, `TM-043`, `HM-002`, `AD-017`, `AD-018`, plus Web Auth pages) from Phase 3+ deferred marketplace domain backend capabilities.

---

## 8. Phase 2B Independent Product UI/UX Audit Findings & Tracker Reconciliation

Following the independent Phase 2B Product UI/UX Audit (`DOC-UX-P2B-000` through `DOC-UX-P2B-013`), this tracker has been formally reconciled against actual visual and runtime evidence:

### 8.1 Reconciled Screen Inventory (113 Active Screens vs Historical 123 Reference)
- **Active Marketplace Catalog:** Exactly **113 Active Screens** (`39 TM + 31 HM + 11 PW + 14 HD + 18 AD = 113`).
- **Reserved Identifier Gaps:** **11 Reserved IDs** (`TM-009, 010, 025, 026, 038`; `HM-008, 012, 015, 016, 017, 032`).
- **Total ID Span:** `113 active + 11 reserved = 124`.
- **Discrepancy Root Cause:** The historical "123 active screens" in Phase 1B documentation was a mathematical typo (`134 - 11 = 123` instead of `124 - 11 = 113`). No screens were omitted.
- **Uncatalogued Live Auth Screens:** 11 live web identity/utility screens (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/profile`, `/settings/security`, `/settings/sessions`, `/health`, `/forbidden`, `/404`) operate live in `apps/web`.

### 8.2 QA_VERIFIED Scope Correction
The previous designation of `100% QA_VERIFIED` strictly denoted that:
1. Automated Vitest tests in `apps/web/tests/phase-2-screens-and-mascots.test.ts` passed against static mock objects.
2. Fastify Phase 1B identity endpoints operated correctly against PostgreSQL.

The designation did **NOT** denote production UX completeness. The actual audit reveals:
- **Visual Design:** 110 of 113 screens operate as prototype UI simulations burdened by nested cards, generic palettes, and leaked tracking codes.
- **Mobile Navigation:** Both Mobile apps operate as monolithic screen-picker hub switchers rather than native navigable applications.
- **Hardware Integrations:** Camera QR scanning (`HM-021`) and MapLibre geospatial maps (`PW-002`, `TM-012`) are simulated placeholders.
- **Backlog Priority:** 48 actionable UX/UI redesign findings (7 P0, 14 P1, 18 P2, 9 P3) are prioritized in `docs/phase-2b-ux-audit/09-prioritized-ux-redesign-backlog.md`.
- **Redesign Execution:** Scheduled for Phase 2C/3 under the "Ceylon Warmth & Coastal Precision" Design System (`DOC-UX-P2B-010`).



