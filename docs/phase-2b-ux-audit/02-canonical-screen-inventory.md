# Phase 2B — Product UI/UX Audit & Redesign Planning
## Document 02: Canonical Screen Inventory & Surface Reconciliation

**Project:** Global Luggage Storage Marketplace (`https://github.com/kavicastelo/luggage-storage`)  
**Audit Document:** `DOC-UX-P2B-002`  
**Governing Baseline:** `master-screen-registry.md`, `phase-2-screen-implementation-tracker.md`, `mock-marketplace.ts`, `App.tsx`  
**Date:** November 9, 2026

---

### 1. Canonical Surface Breakdown & Totals

This inventory establishes the single authoritative registry of all application screens across the monorepo, reconciling documentation anomalies and classifying their true implementation state.

```
Total Registered Screen Identifiers: 124 Span
├── Active Catalogued Marketplace Screens: 113 Screens
│   ├── Traveller Mobile Application (TM): 39 Screens
│   ├── Host Mobile Application (HM):      31 Screens
│   ├── Public Traveller Website (PW):     11 Screens
│   ├── Host Web Dashboard (HD):           14 Screens
│   └── Superadmin Web Dashboard (AD):     18 Screens
├── Intentionally Reserved Gap Identifiers: 11 IDs (5 TM + 6 HM)
└── Live Phase 1B Web Identity Screens:     11 Screens (Uncatalogued in Phase 2 PW Span)
```

---

### 2. Comprehensive Canonical Screen Register

#### 2.1 Public Traveller Website (`PW` — 11 Active Screens in `apps/web`)

| Screen ID | Screen Name | Route / Path | Role | Primary Purpose & Actions | Workflows & Reqs | Backend Dependency | Existing Tracker | Actual Audit Status |
|:---:|:---|:---|:---:|:---|:---:|:---:|:---:|:---:|
| `PW-001` | Public Landing Page | `/` | Anonymous | High-converting homepage; search city & bag count; discover transit hubs | `WF-030` / `FR-003` | `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Card-heavy; PW-001 badge leaked) |
| `PW-002` | Web Search & Discovery | `/search` | Anonymous / Trav | Dual-pane search; list view; simulated transit map; filter by amenities | `WF-003` / `FR-003,004` | `UI_SIMULATION` | `QA_VERIFIED` | **UI_SIMULATION** (Map is simulated text block; buttons labeled PW-003/004) |
| `PW-003` | Location Profile Detail | `/locations/:slug` | Anonymous / Trav | View partner photos, amenities, hours, reviews, photo policy disclosure | `WF-004` / `FR-004,050` | `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Static demo location data; booking CTA leads to PW-004) |
| `PW-004` | Web Checkout & Schedule | `/checkout/:locId` | Traveller | Select drop-off/pick-up, bag counts; view LKR price; OQ-015 late policy notice | `WF-005,006` / `FR-005-014`| `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Interactive state machine; no atomic capacity lock) |
| `PW-005` | Web Payment & Confirmation | `/booking/confirm` | Traveller | State switcher (Gateway, Polling, Confirmed); QR payload; 6-digit PIN display | `WF-007,009` / `FR-015-018`| `UI_SIMULATION` | `QA_VERIFIED` | **UI_SIMULATION** (Debug state buttons in UI; no real gateway integration) |
| `PW-006` | Become a Host Landing | `/become-a-host` | Anonymous / Host | Host value proposition; earnings calculator; link to registration | `WF-017` / `FR-045` | `LIVE_PHASE_1B` (Auth) | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Interactive earnings slider; links to live register) |
| `PW-007` | How It Works | `/how-it-works` | Anonymous | 3-step visual guide (Book, Drop off, Explore); seal & security explainer | `WF-030` / `FR-003` | `N/A (Client/Static)` | `QA_VERIFIED` | **IMPLEMENTED** (Informational static content; clean layout) |
| `PW-008` | Help Centre & FAQs | `/help` | Anonymous / Trav | Searchable FAQ knowledge base; safety guarantees; dispute guidelines | `WF-037` / `FR-051` | `N/A (Client/Static)` | `QA_VERIFIED` | **IMPLEMENTED** (Interactive accordion search; static FAQ database) |
| `PW-009` | Contact Us & Inquiries | `/contact` | Anonymous / Trav | Inquiry submission form; Colombo office details; emergency contact lines | `WF-037` / `FR-051` | `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Client form submission toast; no ticket backend) |
| `PW-010` | Terms, Privacy & Legal | `/terms` | Anonymous | Terms of Service, Privacy Policy, Luggage Protection Guarantee | `WF-030` / `FR-054` | `N/A (Client/Static)` | `QA_VERIFIED` | **IMPLEMENTED** (Static legal text tabs) |
| `PW-011` | Traveller Web Portal | `/portal/bookings` | Traveller | View active bookings; QR pass; 7-stage refund progress; cancel booking | `WF-010,014` / `FR-019,023`| `UI_SIMULATION` | `QA_VERIFIED` | **UI_SIMULATION** (Operates against mock bookings; interactive cancellation toggle) |

---

#### 2.2 Host Web Dashboard (`HD` — 14 Active Screens in `apps/web`)

| Screen ID | Screen Name | Route / Path | Role | Primary Purpose & Actions | Workflows & Reqs | Backend Dependency | Existing Tracker | Actual Audit Status |
|:---:|:---|:---|:---:|:---|:---:|:---:|:---:|:---:|
| `HD-001` | Host Overview Dashboard | `/host/dashboard` | Host Owner / Staff | Real-time SLA queue, active custody occupancy, 85% net earnings summary | `WF-019` / `FR-046` | `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Screen index cards dominate body; KPI cards static) |
| `HD-002` | Location Management | `/host/locations` | Host Owner | List branches; status toggle (Active/Paused); branch capacity summary | `WF-020` / `FR-047` | `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Mock location listing; links to sub-editors) |
| `HD-003` | Location Profile Editor | `/host/locations/:id` | Host Owner | Edit description, amenities, address, photo evidence policy selector | `WF-020` / `FR-047` | `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Form controls work locally; no persistent mutation) |
| `HD-004` | Schedule & Calendar Editor | `/host/locations/:id/schedule` | Host Owner | Configure weekly operating hours; add holiday closure exception | `WF-021` / `FR-010` | `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Interactive day toggles; no DB persistence) |
| `HD-005` | Capacity Pools & Zones | `/host/locations/:id/capacity` | Host Owner | Zone spatial config (Rack A, Trunk B); bag category quotas | `WF-022` / `FR-009` | `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Interactive bag quota counters; mock save) |
| `HD-006` | Pricing Rules & Multipliers | `/host/locations/:id/pricing` | Host Owner | Set base rate (LKR); multipliers; grace period selector (30/45/60m) | `WF-023` / `FR-013,014`| `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Grace period & late fee selectors interactive) |
| `HD-007` | Booking Management Hub | `/host/bookings` | Host Owner / Staff | Filter bookings by status; review incoming requests; inspect evidence | `WF-024` / `FR-046` | `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Table of mock bookings; row buttons labeled HD-008) |
| `HD-008` | Booking Investigation Modal | `/host/bookings?inspect=:id` | Host Owner / Staff | Deep dive into custody timestamps, staff ID, tag/seal number, photo evidence | `WF-024` / `FR-019,034`| `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Modal overlay renders mock custody trail) |
| `HD-009` | Web Check-in/Out Operations | `/host/operations` | Host Owner / Staff | Manual 6-digit PIN entry; bag count reconciliation; custody release | `WF-011,013` / `FR-030-035`| `UI_SIMULATION` | `QA_VERIFIED` | **UI_SIMULATION** (No camera QR scanner on desktop; PIN simulation only) |
| `HD-010` | Financial Revenue & Ledger | `/host/finance` | Host Owner | Gross booking revenue, 15% platform fee deduction, net payable balance | `WF-027` / `FR-040,041`| `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Mathematical balance accurate; mock ledger rows) |
| `HD-011` | Payout Accounts & History | `/host/payouts` | Host Owner | View Sri Lankan bank accounts (Commercial Bank, HNB); payout history | `WF-028` / `FR-042,043`| `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Bank details form; payout table static) |
| `HD-012` | Review Management | `/host/reviews` | Host Owner / Staff | View customer star ratings; submit official host public response | `WF-036` / `FR-050` | `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Host response text field with local submit toast) |
| `HD-013` | Staff Management & RBAC | `/host/staff` | Host Owner | List branch staff; invite attendant email/phone; revoke permissions | `WF-029` / `FR-044` | `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Role permissions documented; staff list static) |
| `HD-014` | Business Profile & Legal | `/host/settings` | Host Owner | Business Registration (BR) number, tax ID, legal owner verification status | `WF-018` / `FR-045` | `LIVE_PHASE_1B` (Profile)| `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Shows live user profile; business fields simulated) |

---

#### 2.3 Superadmin Web Dashboard (`AD` — 18 Active Screens in `apps/web`)

| Screen ID | Screen Name | Route / Path | Role | Primary Purpose & Actions | Workflows & Reqs | Backend Dependency | Existing Tracker | Actual Audit Status |
|:---:|:---|:---|:---:|:---|:---:|:---:|:---:|:---:|
| `AD-001` | Platform Command Dashboard | `/admin` | Superadmin | Global GMV, active bags in storage, security audit telemetry, incident count | `WF-031` / `FR-055` | `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Dominated by 18 screen index cards; static KPIs) |
| `AD-002` | Host Verification Queue | `/admin/hosts/review` | Superadmin | Review host applications; inspect KYC identity and premises documents | `WF-032` / `FR-045` | `LIVE_PHASE_1B` (Partial)| `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Approve/Reject buttons toggle local preview state) |
| `AD-003` | Host Directory & Management | `/admin/hosts` | Superadmin / Supp | Directory of all host accounts; filter by ACTIVE / SUSPENDED; view locations | `WF-032` / `FR-045` | `LIVE_PHASE_1B` (Users) | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Hybrid view: can list live DB users or mock hosts) |
| `AD-004` | Storage Location Moderation | `/admin/locations` | Superadmin | Moderate partner storage spots; inspect photo evidence policy; approve live | `WF-033` / `FR-047` | `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Location status toggle buttons in table) |
| `AD-005` | Global Bookings Ledger | `/admin/bookings` | Superadmin / Supp | Cross-location table of all bookings; search by ref; inspect custody lifecycle | `WF-034` / `FR-019` | `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Search filter works over mock booking list) |
| `AD-006` | Payment Transactions Log | `/admin/payments` | Superadmin | Payment logs; gateway transaction IDs; webhook signature status | `WF-007` / `FR-016,017`| `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Mock payment logs table with signature badges) |
| `AD-007` | Refund Management Queue | `/admin/refunds` | Superadmin | Adjudicate 7-stage refund requests; approve merchant reverse / bank transfer | `WF-015` / `FR-027,028`| `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Refund approval modal updates local state) |
| `AD-008` | Host Payout Batch Generation | `/admin/payouts/batches` | Superadmin | Aggregate eligible host balances ($>5000$ LKR); generate payout batch | `WF-035` / `FR-042,043`| `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Batch generation calculation works over mock data) |
| `AD-009` | Manual Payout Disbursement | `/admin/payouts/disburse` | Superadmin | Record bank reference numbers (SLIPS/CEFT) for disbursed host payouts | `WF-035` / `FR-043` | `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Disbursement reference input form; mock confirmation) |
| `AD-010` | Double-Entry Financial Ledger | `/admin/finance/ledger` | Superadmin | Balanced ledger accounts (Escrow, Commission Revenue, Payouts Payable) | `WF-027` / `FR-041` | `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Debits/Credits mathematically balanced in mock data) |
| `AD-011` | Support Ticket Triage Queue | `/admin/support` | Support / Admin | Customer support inbox; ticket priority; agent assignment | `WF-037` / `FR-051,052`| `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Ticket list with filter tabs; links to AD-012) |
| `AD-012` | Support Ticket Resolution View | `/admin/support/:id` | Support / Admin | Ticket thread; customer messages; internal notes; resolve ticket action | `WF-037` / `FR-052` | `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Chat thread UI with mock internal note toggle) |
| `AD-013` | Incident & Dispute Investigation | `/admin/incidents` | Superadmin | Investigate baggage loss, damage, seal breach, decoupled overdue release | `WF-037` / `FR-053` | `UI_SIMULATION` | `QA_VERIFIED` | **PLACEHOLDER** (Static text card reciting OQ-015/BR-035; no investigation tools) |
| `AD-014` | Review Moderation Queue | `/admin/reviews` | Superadmin | Moderate flagged customer reviews; delete defamatory or abusive text | `WF-036` / `FR-050` | `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Review moderation list with Approve/Hide buttons) |
| `AD-015` | Promotion & Marketing Engine | `/admin/promotions` | Superadmin | Create promo codes (e.g. SLWELCOME10), percentage discounts, usage limits | `WF-006` / `FR-012` | `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Create promo form with active discount list) |
| `AD-016` | Platform System Configuration | `/admin/settings` | Superadmin | Default commission % (15%), currency rules, OQ-014 photo policy, late fees | `WF-039` / `FR-056,057`| `UI_SIMULATION` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Form toggles work locally; no persistent backend) |
| `AD-017` | Security & Compliance Audit Log | `/admin/audit` | Superadmin | Query immutable security audit log (`security_audit_events`); filter actions | `WF-040` / `FR-055` | `LIVE_PHASE_1B` | `QA_VERIFIED` | **VERIFIED** (Fully connected to live Fastify `/api/v1/admin/audit-events`) |
| `AD-018` | Administrative Staff & RBAC | `/admin/staff` | Superadmin | User roles assignment, lifecycle status management, role permissions | `WF-041` / `FR-001` | `LIVE_PHASE_1B` | `QA_VERIFIED` | **VERIFIED** (Fully connected to live RBAC database & auth services) |

---

#### 2.4 Traveller Mobile Application (`TM` — 39 Active Screens in `apps/mobile`)

| Screen ID | Screen Name | Navigation Route | Role | Primary Purpose & Actions | Workflows & Reqs | Existing Tracker | Actual Audit Status |
|:---:|:---|:---|:---:|:---|:---:|:---:|:---:|
| `TM-001` | Splash Screen | `/(traveller)?screen=TM-001` | Anonymous | App launch brand greeting; SecureStore session restoration | `WF-001` / `FR-001` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Embedded in index switcher; session check in layout) |
| `TM-002` | Onboarding Welcome | `/(traveller)?screen=TM-002` | Anonymous | 3-slide value proposition carousel introducing Kiri & verified custody | `WF-001` / `FR-001` | `QA_VERIFIED` | **UI_SIMULATION** (Static preview text card; no real native swipe carousel) |
| `TM-003` | Permissions Request | `/(traveller)?screen=TM-003` | Anonymous | Prompt for GPS location & push notification permissions | `WF-001` / `FR-003,048`| `QA_VERIFIED` | **UI_SIMULATION** (Mock permission toggles; no expo-location bridge) |
| `TM-004` | Language & Currency Selector | `/(traveller)?screen=TM-004` | Anonymous | Select English, Sinhala (SI), or Tamil (TA); default currency LKR | `WF-001` / `FR-056,057`| `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Interactive pills update local React state) |
| `TM-005` | Login Screen | `/(auth)/login` | Anonymous | Email/password login; remember me; link to forgot password | `WF-002` / `FR-001` | `QA_VERIFIED` | **VERIFIED** (Live Phase 1B auth; calls Fastify `/api/v1/auth/login`) |
| `TM-006` | Registration Screen | `/(auth)/register` | Anonymous | Create account with email, password, full name; trigger verification | `WF-002` / `FR-001` | `QA_VERIFIED` | **VERIFIED** (Live Phase 1B auth; calls Fastify `/api/v1/auth/register`) |
| `TM-007` | Forgot Password | `/(auth)/forgot-password` | Anonymous | Request password reset token via Zoho Mail delivery | `WF-002` / `FR-001` | `QA_VERIFIED` | **VERIFIED** (Live Phase 1B auth; calls `/api/v1/auth/request-password-reset`) |
| `TM-008` | Email / Phone OTP Verification | `/(traveller)?screen=TM-008` | Anonymous | Input verification token; verify account; trigger resend token | `WF-002` / `FR-001` | `QA_VERIFIED` | **VERIFIED** (Connected to live Fastify `/api/v1/auth/verify-email`) |
| `TM-011` | Home & Destination Search | `/(traveller)?screen=TM-011` | Traveller | Search bar, nearby Sri Lanka transit hubs, active booking banner | `WF-003` / `FR-003` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Default view of hub switcher; labels leaked) |
| `TM-012` | Geospatial Map Discovery | `/(traveller)/explore` | Traveller | MapLibre pin explorer; transit station quick filters; location cards | `WF-003` / `FR-003,004`| `QA_VERIFIED` | **UI_SIMULATION** (No native map rendered; text card list with TM-015 buttons) |
| `TM-013` | Discovery List & Filters | `/(traveller)?screen=TM-013` | Traveller | Scrollable listing cards with distance, rating, price per hour/day | `WF-003` / `FR-003,004`| `QA_VERIFIED` | **UI_SIMULATION** (Simulated card inside hub viewport) |
| `TM-014` | Filter Modal | `/(traveller)?screen=TM-014` | Traveller | Filter by bag size, 24/7 access, CCTV, climate-controlled vault | `WF-003` / `FR-004` | `QA_VERIFIED` | **UI_SIMULATION** (Checkboxes update local state; no real modal overlay) |
| `TM-015` | Storage Location Details | `/(traveller)?screen=TM-015` | Traveller | Photos, operating hours, amenities, reviews, host verification badge | `WF-004` / `FR-004,050`| `QA_VERIFIED` | **UI_SIMULATION** (Static preview card; booking CTA sets screen to TM-017) |
| `TM-016` | Location Reviews & Ratings | `/(traveller)?screen=TM-016` | Traveller | Verified reviews and host responses | `WF-036` / `FR-050` | `QA_VERIFIED` | **UI_SIMULATION** (Static mock review text) |
| `TM-017` | Booking Date & Time Picker | `/(traveller)?screen=TM-017` | Traveller | Drop-off & collection date/time inputs; operating hours guard | `WF-005` / `FR-005,006`| `QA_VERIFIED` | **UI_SIMULATION** (Static text inputs; next button sets screen to TM-018) |
| `TM-018` | Bag Selection & Category Counter | `/(traveller)?screen=TM-018` | Traveller | Small, Medium, Large, Oversized counters; dynamic LKR calculation | `WF-005` / `FR-007,008`| `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Interactive +/- bag counters calculate total LKR) |
| `TM-019` | Price Breakdown & Checkout | `/(traveller)?screen=TM-019` | Traveller | Itemized calculation, promo code input, OQ-015 late policy notice | `WF-006` / `FR-011,012`| `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Displays calculated price & OQ-015 notice) |
| `TM-020` | Payment Gateway Webview | `/(traveller)?screen=TM-020` | Traveller | Simulated PayHere hosted checkout webview | `WF-007` / `FR-015,016`| `QA_VERIFIED` | **UI_SIMULATION** (Mock button to simulate payment success/failure) |
| `TM-021` | Payment Status Polling | `/(traveller)?screen=TM-021` | Traveller | Polling spinner simulating webhook verification | `WF-007` / `FR-016` | `QA_VERIFIED` | **UI_SIMULATION** (Static timer simulation card) |
| `TM-022` | Host Approval Pending Screen | `/(traveller)?screen=TM-022` | Traveller | 15-minute countdown SLA waiting for host approval | `WF-008` / `FR-006` | `QA_VERIFIED` | **UI_SIMULATION** (Static SLA countdown display) |
| `TM-023` | Payment Failed Screen | `/(traveller)?screen=TM-023` | Traveller | Payment failure notice with retry button leading back to TM-019 | `WF-007` / `FR-017` | `QA_VERIFIED` | **UI_SIMULATION** (Static error card) |
| `TM-024` | Booking Confirmation Screen | `/(traveller)?screen=TM-024` | Traveller | Digital pass voucher with QR code and 6-digit PIN fallback | `WF-009` / `FR-018` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Displays mock QR payload and PIN 482910) |
| `TM-027` | Active Booking Details | `/(traveller)?screen=TM-027` | Traveller | Unlocked exact address, host contact phone, directions, pass link | `WF-010` / `FR-019` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Displays booking details & emergency phone) |
| `TM-028` | Check-in Handover Pass | `/(traveller)?screen=TM-028` | Traveller | Full-screen QR code pass and rate-limited 6-digit PIN fallback | `WF-011` / `FR-030,031`| `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Interactive display of QR payload & PIN) |
| `TM-029` | In-Storage Live Status | `/(traveller)?screen=TM-029` | Traveller | Active storage timer, bag custody confirmation, verified photo link | `WF-012` / `FR-034` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Timer display and custody confirmation banner) |
| `TM-030` | Check-out Collection Pass | `/(traveller)?screen=TM-030` | Traveller | Collection QR code and 6-digit PIN fallback for luggage retrieval | `WF-013` / `FR-035` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Displays collection pass & PIN) |
| `TM-031` | Booking Cancellation Flow | `/(traveller)?screen=TM-031` | Traveller | Select cancellation reason; tiered refund estimate calculation | `WF-014` / `FR-023,024`| `QA_VERIFIED` | **UI_SIMULATION** (Radio options for cancellation reasons) |
| `TM-032` | Cancellation Result & Refund Status | `/(traveller)?screen=TM-032` | Traveller | Cancellation voucher and refund tracking link | `WF-014` / `FR-025,026`| `QA_VERIFIED` | **UI_SIMULATION** (Static cancellation receipt) |
| `TM-033` | Refund Detail Tracking | `/(traveller)?screen=TM-033` | Traveller | 7-stage refund timeline display (Requested $\rightarrow$ Settled) | `WF-015` / `FR-027,028`| `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Step progress indicator for 7 refund stages) |
| `TM-034` | Submit Review & Rating | `/(traveller)?screen=TM-034` | Traveller | Star rating selector (1-5 stars); cleanliness, security, text review | `WF-036` / `FR-049` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Interactive star rating buttons; mock submit) |
| `TM-035` | Booking History List | `/(traveller)?screen=TM-035` | Traveller | Filter tabs for Upcoming, Active, Completed, Cancelled bookings | `WF-016` / `FR-020` | `QA_VERIFIED` | **UI_SIMULATION** (Simulated list of bookings inside hub card) |
| `TM-036` | Saved Favourites | `/(traveller)?screen=TM-036` | Traveller | Saved bookmarked storage locations | `WF-004` / `FR-003` | `QA_VERIFIED` | **UI_SIMULATION** (Empty state preview with mascot Kiri peeking) |
| `TM-037` | Notification Centre | `/(traveller)?screen=TM-037` | Traveller | In-app notification cards (reminders, booking approvals) | `WF-038` / `FR-048` | `QA_VERIFIED` | **UI_SIMULATION** (Mock notification list) |
| `TM-039` | Help & Support Centre | `/(traveller)?screen=TM-039` | Traveller | Knowledge base FAQ search; contact support action | `WF-037` / `FR-051` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (FAQ list with link to ticket creation) |
| `TM-040` | Create Support Ticket | `/(traveller)?screen=TM-040` | Traveller | Support ticket form; booking picker; issue description text input | `WF-037` / `FR-051` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Interactive draft text input; mock submission toast) |
| `TM-041` | Ticket Conversation Thread | `/(traveller)?screen=TM-041` | Traveller | In-app messaging thread with platform support agent | `WF-037` / `FR-052` | `QA_VERIFIED` | **UI_SIMULATION** (Simulated message bubbles) |
| `TM-042` | Traveller Profile & Account | `/(account)/profile` | Traveller | View user profile details, email verification status, roles | `WF-002` / `FR-002` | `QA_VERIFIED` | **VERIFIED** (Live Phase 1B profile view; reads user store) |
| `TM-043` | Security & Password Update | `/(account)/security` | Traveller | Password change form; active session list; session revocation | `WF-002` / `FR-001` | `QA_VERIFIED` | **VERIFIED** (Live Phase 1B security; updates password via API) |
| `TM-044` | App Settings | `/(traveller)?screen=TM-044` | Traveller | Notification toggles, theme, language/currency selector link, legal | `WF-001` / `FR-056,057`| `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Settings toggles update local state) |

*Reserved Traveller Mobile IDs (Excluded from Active Inventory):* `TM-009` (Social OAuth), `TM-010` (Biometrics), `TM-025` (Alternative Payments), `TM-026` (Offline PDF Voucher), `TM-038` (In-App Host Chat).

---

#### 2.5 Host Mobile Application (`HM` — 31 Active Screens in `apps/mobile`)

| Screen ID | Screen Name | Navigation Route | Role | Primary Purpose & Actions | Workflows & Reqs | Existing Tracker | Actual Audit Status |
|:---:|:---|:---|:---:|:---|:---:|:---:|:---:|
| `HM-001` | Host Splash & Welcome | `/(host)?screen=HM-001` | Host / Staff | Host portal gateway; role verification guard | `WF-017` / `FR-001` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Role switch buttons inside hub header) |
| `HM-002` | Host Registration & Login | `/(auth)/login` | Host / Staff | Authenticate host owner or attendant; RBAC role guard | `WF-017` / `FR-001` | `QA_VERIFIED` | **VERIFIED** (Live Phase 1B auth; enforces HOST_OWNER/HOST_STAFF) |
| `HM-003` | Business Profile Setup | `/(host)?screen=HM-003` | Host Owner | Legal name, entity type, business reg number, bank payout details | `WF-018` / `FR-045` | `QA_VERIFIED` | **UI_SIMULATION** (Form inputs operate in preview mode) |
| `HM-004` | KYC Document Upload | `/(host)?screen=HM-004` | Host Owner | National Identity Card (NIC)/Passport, BR certificate, premises photos | `WF-018` / `FR-045` | `QA_VERIFIED` | **UI_SIMULATION** (Mock upload document buttons) |
| `HM-005` | Host Application Status | `/(host)?screen=HM-005` | Host Owner | Application status tracker (Pending Review, Approved, Needs Remediation) | `WF-018` / `FR-045` | `QA_VERIFIED` | **UI_SIMULATION** (Displays status banner) |
| `HM-006` | Host Operations Dashboard | `/(host)?screen=HM-006` | Host / Staff | Daily arrivals, active bags in custody, 15m SLA queue, quick scanner CTA | `WF-019` / `FR-046` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Default view of host hub switcher; card leaked) |
| `HM-007` | Today's Expected Schedule | `/(host)?screen=HM-007` | Host / Staff | Chronological timeline of drop-offs and collections for today | `WF-019` / `FR-046` | `QA_VERIFIED` | **UI_SIMULATION** (Timeline of mock bookings) |
| `HM-009` | Storage Location Profile | `/(host)?screen=HM-009` | Host Owner | Edit location description, amenities, address, photo evidence policy | `WF-020` / `FR-047` | `QA_VERIFIED` | **UI_SIMULATION** (Mock location profile editor) |
| `HM-010` | Operating Hours Editor | `/(host)?screen=HM-010` | Host Owner | Configure weekly opening, drop-off, and collection hours | `WF-021` / `FR-010` | `QA_VERIFIED` | **UI_SIMULATION** (Day of week hour toggles) |
| `HM-011` | Schedule Exception Calendar | `/(host)?screen=HM-011` | Host Owner | Add holiday closure exceptions or special event operating hours | `WF-021` / `FR-010` | `QA_VERIFIED` | **UI_SIMULATION** (Exception date picker preview) |
| `HM-013` | Capacity & Zones Config | `/(host)?screen=HM-013` | Host Owner | Setup storage zones (Rack A, Floor B), bag category limits | `WF-022` / `FR-009` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Interactive zone selector buttons) |
| `HM-014` | Pricing Rules Editor | `/(host)?screen=HM-014` | Host Owner | Base daily rates (LKR), bag multipliers, grace period selector | `WF-023` / `FR-013,014`| `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Interactive grace period selector pills) |
| `HM-018` | Booking Requests Queue | `/(host)?screen=HM-018` | Host / Staff | Review incoming HOST_APPROVAL requests with 15-minute countdown | `WF-008` / `FR-006` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Displays 15m SLA countdown timer) |
| `HM-019` | Request Review & Decision | `/(host)?screen=HM-019` | Host / Staff | Accept or reject booking request with optional rejection reason | `WF-008` / `FR-006` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Accept and Decline buttons update local SLA state) |
| `HM-020` | Active Bookings List | `/(host)?screen=HM-020` | Host / Staff | Filter by Confirmed, In Storage, Overdue | `WF-024` / `FR-046` | `QA_VERIFIED` | **UI_SIMULATION** (Mock active booking cards) |
| `HM-021` | Check-in Scanner & PIN Entry | `/(host)/scanner` | Host / Staff | Camera QR scanner with manual 6-digit PIN fallback | `WF-011` / `FR-030,031`| `QA_VERIFIED` | **UI_SIMULATION** (No camera scanner; pre-filled PIN input with mock verify) |
| `HM-022` | Bag Inspection & Tagging | `/(host)?screen=HM-022` | Host / Staff | Mandatory bag count & category verification; enter seal numbers | `WF-011` / `FR-032,033`| `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Interactive seal number input; bag count check) |
| `HM-023` | Check-in Evidence Camera | `/(host)?screen=HM-023` | Host / Staff | Capture photo evidence (configurable mandatory / optional) | `WF-011` / `FR-033` | `QA_VERIFIED` | **UI_SIMULATION** (Mock camera shutter button; no expo-camera link) |
| `HM-024` | Check-out Verification Scanner | `/(host)/scanner` | Host / Staff | Scan collection QR or enter 6-digit PIN fallback for release | `WF-013` / `FR-035` | `QA_VERIFIED` | **UI_SIMULATION** (Same scanner component as HM-021 in check-out mode) |
| `HM-025` | Handover Release Confirmation | `/(host)?screen=HM-025` | Host / Staff | Reconcile bag count; confirm custody termination | `WF-013` / `FR-035` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Confirm release button updates local booking state) |
| `HM-026` | Overdue Bags Alert View | `/(host)?screen=HM-026` | Host / Staff | List overdue luggage past grace period; view hours overdue | `WF-025` / `FR-036` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Overdue booking alert with hours overdue badge) |
| `HM-027` | Request Overdue Payment | `/(host)?screen=HM-027` | Host / Staff | Trigger in-app overdue charge request (no silent charges) | `WF-025` / `FR-036` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Send payment request button with local feedback) |
| `HM-028` | Disputed Release Handover | `/(host)?screen=HM-028` | Host / Staff | Decoupled mandatory release under BR-035 (bags released despite fee dispute)| `WF-026` / `FR-035,BR-035`| `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Release bags button sets dispute flag without blocking) |
| `HM-029` | Host Earnings & Balance | `/(host)?screen=HM-029` | Host Owner | Gross revenue, 15% commission deducted, net payout balance | `WF-027` / `FR-040,041`| `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Earnings summary card; buttons to HM-030/031) |
| `HM-030` | Payout Bank Account Details | `/(host)?screen=HM-030` | Host Owner | View/edit bank name, branch code, account number | `WF-028` / `FR-042` | `QA_VERIFIED` | **UI_SIMULATION** (Bank details form operating on preview state) |
| `HM-031` | Payout History & Receipts | `/(host)?screen=HM-031` | Host Owner | Completed manual payouts with bank reference numbers (SLIPS/CEFT) | `WF-028` / `FR-043` | `QA_VERIFIED` | **UI_SIMULATION** (Payout receipts list) |
| `HM-033` | Staff Management List | `/(host)?screen=HM-033` | Host Owner | List host attendants and assigned branches | `WF-029` / `FR-044` | `QA_VERIFIED` | **UI_SIMULATION** (Staff list with role tags) |
| `HM-034` | Invite Staff Member | `/(host)?screen=HM-034` | Host Owner | Enter employee email/phone, select branch access | `WF-029` / `FR-044` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Staff invite form with mock submission toast) |
| `HM-035` | Host Customer Reviews | `/(host)?screen=HM-035` | Host / Staff | View traveller ratings and submit host public response | `WF-036` / `FR-050` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Response text input with mock submit) |
| `HM-036` | Incident & Dispute Report | `/(host)?screen=HM-036` | Host / Staff | Report lost/damaged/unclaimed luggage to platform support | `WF-037` / `FR-053` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Incident report form with mock ticket generation) |
| `HM-037` | Host Business Settings | `/(host)?screen=HM-037` | Host Owner | Business settings, notification preferences, language | `WF-017` / `FR-002` | `QA_VERIFIED` | **PARTIALLY_IMPLEMENTED** (Settings toggles update local state) |

*Reserved Host Mobile IDs (Excluded from Active Inventory):* `HM-008` (Monthly Calendar), `HM-012` (Bulk Holiday Importer), `HM-015` (Custom Surcharges), `HM-016` (Weekend Multipliers), `HM-017` (Multi-Day Volume Discounts), `HM-032` (PDF Tax Invoices).

---

### 3. Inventory Discrepancy Findings & Structural Anomalies

1. **Monolithic Component Collapsing (Screen Multiplication Defect):**
   - In `apps/mobile`, **36 of the 39 Traveller Mobile screens** are rendered inside a single component (`apps/mobile/app/(traveller)/index.tsx`).
   - Similarly, **29 of the 31 Host Mobile screens** are rendered inside `apps/mobile/app/(host)/index.tsx`.
   - In `apps/web`, all 11 Public Website screens are defined in a single file (`PublicMarketplacePages.tsx`, 1,579 lines); all 14 Host screens in `HostDashboardPages.tsx` (1,234 lines); and all 18 Admin screens in `AdminDashboardPages.tsx` (1,682 lines).
2. **Missing Authentic Mobile Screens:**
   - Although 39 and 31 screens are catalogued, they do not exist as independent, route-addressable mobile screens with native navigation stacks, gestures, or view lifecycles.
3. **Dead-End & Circular Navigation Destinations:**
   - On `PW-005` (Payment Confirmation), clicking `Open Traveller Web Portal (PW-011)` navigates to `/portal/bookings`, but from `/portal/bookings`, the user has no direct navigation path back into an active booking's live custody view without clicking generic footer links.
   - On `HD-001` (Host Overview), clicking any of the 14 screen cards routes directly to that screen, but secondary sub-editors (`HD-003`, `HD-004`, `HD-005`, `HD-006`) lack back buttons, forcing the user to rely on browser history or sidebar navigation.
4. **Placeholder Screens:**
   - `AD-013` (Incident Investigation) is completely non-functional. It displays a static text card explaining business rules `OQ-015` and `BR-035` without providing any dispute adjudication tools, photo inspection panels, or financial reversal controls.
   - `HM-021` / `HM-024` (Mobile Scanner) lacks camera integration (`expo-camera` is not installed or configured). It renders a simulated text input box containing the pre-filled string `482910`.
