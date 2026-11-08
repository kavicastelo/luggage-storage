# Master Screen Registry

**Project:** Global Luggage Storage Marketplace  
**Document Type:** UX Architecture & Multi-Dimensional Screen Implementation Registry  
**Status:** Reconciled Stabilization Baseline (`DOC-UX-001`)  
**Governing Documents:** FRS, Phase 0A Architecture, Technical Blueprint Section 6, Functional Requirements (`FR-001`–`FR-057`, `IR-001`–`IR-015`), Workflow Inventory (`WF-001`–`WF-044`), Project Stabilization Assessment (`DOC-STAB-00`).

---

## 1. Executive Summary & Multi-Dimensional Registry Governance

The Master Screen Registry is the central authoritative inventory of every screen, view, modal, and interface across all 5 client surfaces of the Global Luggage Storage Marketplace:
1. **`TM` — Traveller Mobile Application** (React Native + Expo — 39 Active Screens)
2. **`HM` — Host Mobile Application** (React Native + Expo — 31 Active Screens)
3. **`PW` — Public Web Application** (React + Vite — 11 Active Screens)
4. **`HD` — Host Web Dashboard** (React + Vite — 14 Active Screens)
5. **`AD` — Superadmin Web Dashboard** (React + Vite — 18 Active Screens)

### 1.1 Honest Multi-Dimensional Implementation Classification (`REM-A01`)
To prevent mock or preview interactions from being misclassified as completed backend capabilities, every screen is tracked across **seven distinct implementation dimensions**:

1. **Spec Status (`Spec`):** `Approved` (Phase 0C UX specification complete).
2. **UI Status (`UI`):** `UI-Complete` (React / React Native view rendered with design tokens and mascot integration).
3. **Frontend Interaction (`Interaction`):**
   - `Live Auth/RBAC`: Wired to live client state, validation, and server endpoints.
   - `Interactive Preview`: Client-side interactive state machine using clearly isolated demo data.
   - `Static Content`: Informational / legal / marketing content view.
4. **API Integration (`API`):**
   - `Live (Phase 1B)`: Connected to Fastify `/api/v1/auth` or `/api/v1/admin` endpoints.
   - `Deferred (Phase 3+)`: Uses isolated client preview state; marketplace REST integration scheduled for Phases 3–12.
   - `N/A (Client/Static)`: No backend API required.
5. **Backend Status (`Backend`):**
   - `Complete (Phase 1B)`: Fastify routes, services, rate-limiting, RBAC, and audit logging implemented.
   - `Deferred (Phase 3+)`: Marketplace domain module not yet implemented in `apps/api`.
   - `N/A (Client/Static)`: Purely client-side or static view.
6. **Database Status (`DB`):**
   - `Complete (Phase 1B)`: Backed by live PostgreSQL identity/session/RBAC/audit tables (`0000`–`0005`).
   - `Deferred (Phase 3+)`: Marketplace domain tables not yet created in PostgreSQL.
   - `N/A (Client/Static)`: No database persistence required.
7. **Automated Verification (`QA`):**
   - `Verified (Vitest)`: Covered by automated unit, component, contract, or integration tests.

---

## 2. Traveller Mobile Application (`TM` — 39 Active Screens)

| Screen ID | Screen Name | Role | Primary Purpose | Entry / Exit | Workflows & Reqs | Spec | UI | Interaction | API | Backend | DB | QA |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `TM-001` | Splash Screen | Anonymous | Brand greeting & initial session bootstrapping | Launch -> `TM-002`/`TM-011` | `WF-001` / `FR-001` | `Approved` | `UI-Complete` | `Live Auth/RBAC` | `Live (Phase 1B)` | `Complete (Phase 1B)` | `Complete (Phase 1B)` | `Verified (Vitest)` |
| `TM-002` | Onboarding Welcome | Anonymous | Value proposition overview & carousel | `TM-001` -> `TM-003`,`TM-005` | `WF-001` / `FR-001` | `Approved` | `UI-Complete` | `Static Content` | `N/A (Client/Static)` | `N/A (Client/Static)` | `N/A (Client/Static)` | `Verified (Vitest)` |
| `TM-003` | Permissions Request | Anonymous | Request GPS Location & Push Notification permissions | `TM-002` -> `TM-011` | `WF-001` / `FR-003`,`FR-048` | `Approved` | `UI-Complete` | `Interactive Preview` | `N/A (Client/Static)` | `N/A (Client/Static)` | `N/A (Client/Static)` | `Verified (Vitest)` |
| `TM-004` | Language & Currency Selector | Anonymous | Initial locale preference setup (EN/SI/TA, LKR) | `TM-002` -> `TM-011` | `WF-001` / `FR-056`,`FR-057` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Complete (Phase 1B)` | `Verified (Vitest)` |
| `TM-005` | Login Screen | Anonymous | Email/password login with pending-verification guard | `TM-002` -> `TM-011`,`TM-006`,`TM-007` | `WF-002` / `FR-001` | `Approved` | `UI-Complete` | `Live Auth/RBAC` | `Live (Phase 1B)` | `Complete (Phase 1B)` | `Complete (Phase 1B)` | `Verified (Vitest)` |
| `TM-006` | Registration Screen | Anonymous | Create new traveller account (`PENDING_VERIFICATION`) | `TM-005` -> `TM-008` | `WF-002` / `FR-001` | `Approved` | `UI-Complete` | `Live Auth/RBAC` | `Live (Phase 1B)` | `Complete (Phase 1B)` | `Complete (Phase 1B)` | `Verified (Vitest)` |
| `TM-007` | Forgot Password | Anonymous | Trigger password reset email token | `TM-005` -> `TM-005` | `WF-002` / `FR-001` | `Approved` | `UI-Complete` | `Live Auth/RBAC` | `Live (Phase 1B)` | `Complete (Phase 1B)` | `Complete (Phase 1B)` | `Verified (Vitest)` |
| `TM-008` | Email / Phone OTP Verification | Anonymous | Verify account email verification token & resend | `TM-006` -> `TM-005`,`TM-011` | `WF-002` / `FR-001` | `Approved` | `UI-Complete` | `Live Auth/RBAC` | `Live (Phase 1B)` | `Complete (Phase 1B)` | `Complete (Phase 1B)` | `Verified (Vitest)` |
| `TM-011` | Home & Destination Search | Traveller | Search bar, nearby location quick links, active banner | `TM-001` -> `TM-012`,`TM-013` | `WF-003` / `FR-003` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-012` | Geospatial Map Discovery | Traveller | Interactive map discovery with approximate pins (`OQ-012`) | `TM-011` -> `TM-013`,`TM-014` | `WF-003` / `FR-003`,`FR-004` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-013` | Discovery List & Filters | Traveller | Scrollable listing cards with distance, rating, price | `TM-011` -> `TM-014`,`TM-015` | `WF-003` / `FR-003`,`FR-004` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-014` | Filter Modal | Traveller | Filter by bag size, 24/7 hours, CCTV, instant booking | `TM-012` -> `TM-013` | `WF-003` / `FR-004` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-015` | Storage Location Details | Traveller | Photos, operating hours, amenities, reviews, host info | `TM-013` -> `TM-016`,`TM-017` | `WF-004` / `FR-004`,`FR-050` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-016` | Location Reviews & Ratings | Traveller | List of verified traveller reviews and host responses | `TM-015` -> `TM-015` | `WF-036` / `FR-050` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-017` | Booking Date & Time Picker | Traveller | Drop-off & collection calendar, operating hour checks | `TM-015` -> `TM-018` | `WF-005` / `FR-005`,`FR-006` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-018` | Bag Selection & Category Counter | Traveller | Select counts for Small, Medium, Large, Oversized bags | `TM-017` -> `TM-019` | `WF-005` / `FR-007`,`FR-008` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-019` | Price Breakdown & Checkout | Traveller | Itemized calculation, `OQ-015` policy disclosure, promo | `TM-018` -> `TM-020`,`TM-022` | `WF-006` / `FR-011`,`FR-012` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-020` | Payment Gateway Webview | Traveller | Simulated PayHere checkout preview (`OQ-003` gated) | `TM-019` -> `TM-021`,`TM-023` | `WF-007` / `FR-015`,`FR-016` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-021` | Payment Status Polling | Traveller | Simulated webhook confirmation polling state | `TM-020` -> `TM-024`,`TM-023` | `WF-007` / `FR-016` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-022` | Host Approval Pending Screen | Traveller | Status screen for `HOST_APPROVAL` mode with 15m timer | `TM-019` -> `TM-019`,`TM-011` | `WF-008` / `FR-006` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-023` | Payment Failed Screen | Traveller | Failure explanation with retry payment action | `TM-020` -> `TM-019`,`TM-011` | `WF-007` / `FR-017` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-024` | Booking Confirmation Screen | Traveller | Confirmation voucher displaying QR code & 6-digit PIN fallback | `TM-021` -> `TM-027`,`TM-011` | `WF-009` / `FR-018` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-027` | Active Booking Details | Traveller | Exact post-booking address (`OQ-012`), directions, QR pass | `TM-024` -> `TM-028`,`TM-031` | `WF-010` / `FR-019` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-028` | Check-in Handover Pass | Traveller | High-brightness QR display & 6-digit PIN fallback (`OQ-014`) | `TM-027` -> `TM-027` | `WF-011` / `FR-030`,`FR-031` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-029` | In-Storage Live Status | Traveller | Luggage custody status, photo evidence preview, timer | `TM-027` -> `TM-030`,`TM-039` | `WF-012` / `FR-034` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-030` | Check-out Collection Pass | Traveller | Collection QR code and 6-digit PIN fallback (`OQ-014`) | `TM-029` -> `TM-034`,`TM-011` | `WF-013` / `FR-035` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-031` | Booking Cancellation Flow | Traveller | Cancellation reason selection & tiered refund estimate (`OQ-009`) | `TM-027` -> `TM-032` | `WF-014` / `FR-023`,`FR-024` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-032` | Cancellation Result & Refund Status | Traveller | Shows cancellation receipt & refund tracking status | `TM-031` -> `TM-011`,`TM-033` | `WF-014` / `FR-025`,`FR-026` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-033` | Refund Detail Tracking | Traveller | Explicit 7-stage refund progress (`OQ-013`) | `TM-032` -> `TM-011` | `WF-015` / `FR-027`,`FR-028` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-034` | Submit Review & Rating | Traveller | 5-star rating, cleanliness, security, text feedback | `TM-030` -> `TM-011` | `WF-036` / `FR-049` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-035` | Booking History List | Traveller | Upcoming, Active, Completed, and Cancelled tabs | Tab -> `TM-027`,`TM-033` | `WF-016` / `FR-020` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-036` | Saved Favourites | Traveller | Bookmarked storage locations for quick access | Tab -> `TM-015` | `WF-004` / `FR-003` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-037` | Notification Centre | Traveller | In-app notifications (reminders, approvals, receipts) | Header -> `TM-027`,`TM-033` | `WF-038` / `FR-048` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-039` | Help & Support Centre | Traveller | FAQ search, contact support, open dispute | Tab -> `TM-040`,`TM-041` | `WF-037` / `FR-051` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-040` | Create Support Ticket | Traveller | Form with category dropdown, booking picker, evidence | `TM-039` -> `TM-041` | `WF-037` / `FR-051` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-041` | Ticket Conversation Thread | Traveller | Messaging thread with platform support agent | `TM-039` -> `TM-039` | `WF-037` / `FR-052` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `TM-042` | Traveller Profile & Account | Traveller | Authenticated user details, roles, session link | Tab -> `TM-043`,`TM-044` | `WF-002` / `FR-002` | `Approved` | `UI-Complete` | `Live Auth/RBAC` | `Live (Phase 1B)` | `Complete (Phase 1B)` | `Complete (Phase 1B)` | `Verified (Vitest)` |
| `TM-043` | Security & Password Update | Traveller | Live password change, active session list & revocation | `TM-042` -> `TM-042`,`TM-005` | `WF-002` / `FR-001` | `Approved` | `UI-Complete` | `Live Auth/RBAC` | `Live (Phase 1B)` | `Complete (Phase 1B)` | `Complete (Phase 1B)` | `Verified (Vitest)` |
| `TM-044` | App Settings | Traveller | Theme, notification toggles, language, currency, legal | `TM-042` -> `TM-004` | `WF-001` / `FR-056`,`FR-057` | `Approved` | `UI-Complete` | `Interactive Preview` | `N/A (Client/Static)` | `N/A (Client/Static)` | `N/A (Client/Static)` | `Verified (Vitest)` |

---

## 3. Host Mobile Application (`HM` — 31 Active Screens)

| Screen ID | Screen Name | Role | Primary Purpose | Entry / Exit | Workflows & Reqs | Spec | UI | Interaction | API | Backend | DB | QA |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `HM-001` | Host Splash & Welcome | Host / Staff | Host portal gateway & authenticated role guard | Launch -> `HM-002`,`HM-006` | `WF-017` / `FR-001` | `Approved` | `UI-Complete` | `Live Auth/RBAC` | `Live (Phase 1B)` | `Complete (Phase 1B)` | `Complete (Phase 1B)` | `Verified (Vitest)` |
| `HM-002` | Host Registration & Login | Host / Staff | Authenticate host owner or staff member | `HM-001` -> `HM-003`,`HM-006` | `WF-017` / `FR-001` | `Approved` | `UI-Complete` | `Live Auth/RBAC` | `Live (Phase 1B)` | `Complete (Phase 1B)` | `Complete (Phase 1B)` | `Verified (Vitest)` |
| `HM-003` | Business Profile Setup | Host Owner | Legal name, entity type, business reg number, bank info | `HM-002` -> `HM-004` | `WF-018` / `FR-045` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Complete (Phase 1B)` | `Verified (Vitest)` |
| `HM-004` | KYC Document Upload | Host Owner | NIC/Passport, BR Certificate, Proof of Premises (`OQ-002`) | `HM-003` -> `HM-005` | `WF-018` / `FR-045` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HM-005` | Host Application Status | Host Owner | Application under review banner / rejection remediation | `HM-004` -> `HM-006` | `WF-018` / `FR-045` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Complete (Phase 1B)` | `Verified (Vitest)` |
| `HM-006` | Host Operations Dashboard | Host / Staff | Today's arrivals, active bags, pending approvals, quick scan | Tab -> `HM-007`,`HM-018`,`HM-021` | `WF-019` / `FR-046` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HM-007` | Today's Expected Schedule | Host / Staff | Chronological list of drop-offs and collections for today | `HM-006` -> `HM-021`,`HM-024` | `WF-019` / `FR-046` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HM-009` | Storage Location Profile | Host Owner | Edit location details, description, photos, facilities | Tab -> `HM-010`,`HM-013` | `WF-020` / `FR-047` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HM-010` | Operating Hours Editor | Host Owner | Configure weekly opening, drop-off, collection hours | `HM-009` -> `HM-011` | `WF-021` / `FR-010` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HM-011` | Schedule Exception Calendar | Host Owner | Add holiday closures or special operating hours | `HM-010` -> `HM-009` | `WF-021` / `FR-010` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HM-013` | Capacity & Zones Config | Host Owner | Setup storage zones, bag limits, oversized opt-in (`OQ-006`) | Tab -> `HM-014` | `WF-022` / `FR-009` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HM-014` | Pricing Rules Editor | Host Owner | Set base rate (LKR), bag multipliers, grace/late policy (`OQ-015`) | Tab -> `HM-009` | `WF-023` / `FR-013`,`FR-014` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HM-018` | Booking Requests Queue | Host / Staff | Review incoming `HOST_APPROVAL` requests with 15m SLA | `HM-006` -> `HM-019` | `WF-008` / `FR-006` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HM-019` | Request Review & Decision | Host / Staff | Accept or reject booking with optional rejection reason | `HM-018` -> `HM-006` | `WF-008` / `FR-006` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HM-020` | Active Bookings List | Host / Staff | Filter by Confirmed, In Storage, Overdue | Tab -> `HM-021`,`HM-024` | `WF-024` / `FR-046` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HM-021` | Check-in Scanner & PIN Entry | Host / Staff | Camera QR scanner with manual 6-digit PIN fallback (`OQ-014`) | `HM-006` -> `HM-022` | `WF-011` / `FR-030`,`FR-031` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HM-022` | Bag Inspection & Tagging | Host / Staff | Mandatory bag count & category verification, tag/seal entry (`OQ-014`) | `HM-021` -> `HM-023` | `WF-011` / `FR-032`,`FR-033` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HM-023` | Check-in Evidence Camera | Host / Staff | Capture photo evidence (optional by default; configurable mandatory `OQ-014`) | `HM-022` -> `HM-006` | `WF-011` / `FR-033` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HM-024` | Check-out Verification Scanner | Host / Staff | Scan collection QR or enter 6-digit PIN fallback (`OQ-014`) | `HM-006` -> `HM-025` | `WF-013` / `FR-035` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HM-025` | Handover Release Confirmation | Host / Staff | Reconcile bag count & confirm luggage release (`OQ-014`) | `HM-024` -> `HM-006` | `WF-013` / `FR-035` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HM-026` | Overdue Bags Alert View | Host / Staff | List overdue luggage past configurable grace period (`OQ-015`) | `HM-006` -> `HM-027`,`HM-028` | `WF-025` / `FR-036` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HM-027` | Request Overdue Payment | Host / Staff | Trigger configurable overdue charge & in-app payment request (`OQ-015`) | `HM-026` -> `HM-006` | `WF-025` / `FR-036` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HM-028` | Disputed Release Handover | Host / Staff | Release bags when fees disputed (**Mandatory Release** / `OQ-015` / `BR-035`) | `HM-026` -> `HM-006` | `WF-026` / `FR-035`,`BR-035` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HM-029` | Host Earnings & Balance | Host Owner | Gross revenue, 15% commission deducted, net balance | Tab -> `HM-030`,`HM-031` | `WF-027` / `FR-040`,`FR-041` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HM-030` | Payout Bank Account Details | Host Owner | View/edit bank name, branch code, account number | `HM-029` -> `HM-029` | `WF-028` / `FR-042` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HM-031` | Payout History & Receipts | Host Owner | List completed manual payouts with bank ref numbers | `HM-029` -> `HM-029` | `WF-028` / `FR-043` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HM-033` | Staff Management List | Host Owner | List staff members, active statuses, assigned branches (`OQ-017`) | Tab -> `HM-034` | `WF-029` / `FR-044` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HM-034` | Invite Staff Member | Host Owner | Enter employee email/phone, select assigned locations (`OQ-017`) | `HM-033` -> `HM-033` | `WF-029` / `FR-044` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HM-035` | Host Customer Reviews | Host / Staff | View traveller ratings and submit host responses | Tab -> `HM-035` | `WF-036` / `FR-050` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HM-036` | Incident & Dispute Report | Host / Staff | Report lost/damaged/unclaimed luggage to support | Tab -> `HM-006` | `WF-037` / `FR-053` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HM-037` | Host Business Settings | Host Owner | Notification toggles, language, business details | Tab -> `HM-001` | `WF-017` / `FR-002` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Complete (Phase 1B)` | `Verified (Vitest)` |

---

## 4. Public Web Application (`PW` — 11 Active Screens)

| Screen ID | Screen Name | Role | Primary Purpose | Route | Workflows & Reqs | Spec | UI | Interaction | API | Backend | DB | QA |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `PW-001` | Public Landing Page | Anonymous | High-converting homepage, search bar, city links | `/` | `WF-030` / `FR-003` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `PW-002` | Web Search & Discovery | Anonymous / Trav | Dual pane: interactive map & listing cards (`OQ-012`) | `/search` | `WF-003` / `FR-003`,`FR-004` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `PW-003` | Location Profile Detail | Anonymous / Trav | Photo gallery, amenities, hours, reviews, `OQ-014` policy | `/locations/:slug` | `WF-004` / `FR-004`,`FR-050` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `PW-004` | Web Checkout & Schedule | Traveller | Date/time, bag counts, pricing, `OQ-015` disclosure | `/checkout/:locId` | `WF-005`,`WF-006` / `FR-005`–`FR-014` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `PW-005` | Web Payment & Confirmation | Traveller | Simulated payment & voucher preview (`OQ-003` gated) | `/booking/confirm` | `WF-007`,`WF-009` / `FR-015`–`FR-018` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `PW-006` | Become a Host Landing | Anonymous / Host | Value proposition, earnings calculator, host registration | `/become-a-host` | `WF-017` / `FR-045` | `Approved` | `UI-Complete` | `Interactive Preview` | `Live (Phase 1B)` | `Complete (Phase 1B)` | `Complete (Phase 1B)` | `Verified (Vitest)` |
| `PW-007` | How It Works | Anonymous | 3-step visual guide (Book, Drop off, Explore) | `/how-it-works` | `WF-030` / `FR-003` | `Approved` | `UI-Complete` | `Static Content` | `N/A (Client/Static)` | `N/A (Client/Static)` | `N/A (Client/Static)` | `Verified (Vitest)` |
| `PW-008` | Help Centre & FAQs | Anonymous / Trav | Searchable knowledge base, FAQs, luggage safety info | `/help` | `WF-037` / `FR-051` | `Approved` | `UI-Complete` | `Interactive Preview` | `N/A (Client/Static)` | `N/A (Client/Static)` | `N/A (Client/Static)` | `Verified (Vitest)` |
| `PW-009` | Contact Us & Inquiries | Anonymous / Trav | Contact form, emergency phone numbers, office address | `/contact` | `WF-037` / `FR-051` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `PW-010` | Terms, Privacy & Legal | Anonymous | Terms of Service, Privacy Policy, Luggage Guarantee | `/terms` | `WF-030` / `FR-054` | `Approved` | `UI-Complete` | `Static Content` | `N/A (Client/Static)` | `N/A (Client/Static)` | `N/A (Client/Static)` | `Verified (Vitest)` |
| `PW-011` | Traveller Web Portal | Traveller | View active bookings, vouchers, cancel, 7-stage refund | `/portal/bookings` | `WF-010`,`WF-014` / `FR-019`,`FR-023` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |

---

## 5. Host Web Dashboard (`HD` — 14 Active Screens)

| Screen ID | Screen Name | Role | Primary Purpose | Route | Workflows & Reqs | Spec | UI | Interaction | API | Backend | DB | QA |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `HD-001` | Host Overview Dashboard | Host Owner / Staff | Multi-location KPIs, occupancy rates, today's schedule | `/host/dashboard` | `WF-019` / `FR-046` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HD-002` | Location Management | Host Owner | List all business branches, add new location | `/host/locations` | `WF-020` / `FR-047` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HD-003` | Location Profile Editor | Host Owner | Manage photos, GPS pin, address, amenities, rules | `/host/locations/:id` | `WF-020` / `FR-047` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HD-004` | Schedule & Calendar Editor | Host Owner | Weekly operating hours & holiday closure exceptions | `/host/locations/:id/schedule` | `WF-021` / `FR-010` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HD-005` | Capacity Pools & Zones | Host Owner | Multi-zone spatial config, category quotas (`OQ-006`) | `/host/locations/:id/capacity` | `WF-022` / `FR-009` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HD-006` | Pricing Rules & Multipliers | Host Owner | Base daily rates (LKR), multipliers, `OQ-015` grace/late policy | `/host/locations/:id/pricing` | `WF-023` / `FR-013`,`FR-014` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HD-007` | Booking Management Hub | Host Owner / Staff | Comprehensive table of bookings with status filters | `/host/bookings` | `WF-024` / `FR-046` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HD-008` | Booking Investigation Modal | Host Owner / Staff | Deep dive into items, custody logs, photo evidence (`OQ-014`) | `/host/bookings?inspect=:id` | `WF-024` / `FR-019`,`FR-034` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HD-009` | Web Check-in/Out Operations | Host Owner / Staff | Desktop QR scanning & manual 6-digit PIN fallback (`OQ-014`) | `/host/operations` | `WF-011`,`WF-013` / `FR-030`–`FR-035` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HD-010` | Financial Revenue & Ledger | Host Owner | Gross revenue, platform commission, net payable balance | `/host/finance` | `WF-027` / `FR-040`,`FR-041` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HD-011` | Payout Accounts & History | Host Owner | Manage bank details, view payout receipts & CSV export | `/host/payouts` | `WF-028` / `FR-042`,`FR-043` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HD-012` | Review Management | Host Owner / Staff | Read customer reviews, submit official public responses | `/host/reviews` | `WF-036` / `FR-050` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HD-013` | Staff Management & RBAC | Host Owner | Invite attendants, assign branches, revoke access (`OQ-017`) | `/host/staff` | `WF-029` / `FR-044` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `HD-014` | Business Profile & Legal | Host Owner | Business registration, tax certificates, owner details (`OQ-002`) | `/host/settings` | `WF-018` / `FR-045` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Complete (Phase 1B)` | `Verified (Vitest)` |

---

## 6. Superadmin Web Dashboard (`AD` — 18 Active Screens)

| Screen ID | Screen Name | Role | Primary Purpose | Route | Workflows & Reqs | Spec | UI | Interaction | API | Backend | DB | QA |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `AD-001` | Platform Command Dashboard | Superadmin | Global GMV, active bags in storage, incident alerts | `/admin` | `WF-031` / `FR-055` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `AD-002` | Host Verification Queue | Superadmin | Review host applications, inspect KYC documents (`OQ-002`) | `/admin/hosts/review` | `WF-032` / `FR-045` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Complete (Phase 1B)` | `Verified (Vitest)` |
| `AD-003` | Host Directory & Management | Superadmin / Supp | Search host accounts, inspect status, suspend/reinstate | `/admin/hosts` | `WF-032` / `FR-045` | `Approved` | `UI-Complete` | `Live Auth/RBAC` | `Live (Phase 1B)` | `Complete (Phase 1B)` | `Complete (Phase 1B)` | `Verified (Vitest)` |
| `AD-004` | Storage Location Moderation | Superadmin | Approve locations to go live, inspect photos and GPS | `/admin/locations` | `WF-033` / `FR-047` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `AD-005` | Global Bookings Ledger | Superadmin / Supp | Search any booking by ref, inspect customer, timeline | `/admin/bookings` | `WF-034` / `FR-019` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `AD-006` | Payment Transactions Log | Superadmin | Gateway orders, raw webhooks, signature verification log | `/admin/payments` | `WF-007` / `FR-016`,`FR-017` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `AD-007` | Refund Management Queue | Superadmin | Review 7-stage refund requests (`OQ-013`) | `/admin/refunds` | `WF-015` / `FR-027`,`FR-028` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `AD-008` | Host Payout Batch Generation | Superadmin | Generate payout batch for eligible host balances | `/admin/payouts/batches` | `WF-035` / `FR-042`,`FR-043` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `AD-009` | Manual Payout Disbursement | Superadmin | Record bank reference numbers for completed transfers | `/admin/payouts/disburse` | `WF-035` / `FR-043` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `AD-010` | Double-Entry Financial Ledger | Superadmin | Inspect general ledger accounts, debits, credits | `/admin/finance/ledger` | `WF-027` / `FR-041` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `AD-011` | Support Ticket Triage Queue | Support / Admin | Ticket inbox, category filtering, agent assignment (`OQ-016`) | `/admin/support` | `WF-037` / `FR-051`,`FR-052` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `AD-012` | Support Ticket Resolution View | Support / Admin | Customer messaging, internal notes, resolution (`OQ-016`) | `/admin/support/:id` | `WF-037` / `FR-052` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `AD-013` | Incident & Dispute Investigation | Superadmin | Investigate lost, damaged, or disputed baggage (`OQ-015`) | `/admin/incidents` | `WF-037` / `FR-053` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `AD-014` | Review Moderation Queue | Superadmin | Moderate flagged customer reviews, delete abusive content | `/admin/reviews` | `WF-036` / `FR-050` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `AD-015` | Promotion & Marketing Engine | Superadmin | Create promo codes, discounts, campaign budgets (`OQ-005`) | `/admin/promotions` | `WF-006` / `FR-012` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `AD-016` | Platform System Configuration | Superadmin | Commission %, currencies, `OQ-014` photo & `OQ-015` late policy | `/admin/settings` | `WF-039` / `FR-056`,`FR-057` | `Approved` | `UI-Complete` | `Interactive Preview` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Deferred (Phase 3+)` | `Verified (Vitest)` |
| `AD-017` | Security & Compliance Audit Log | Superadmin | Immutable `security_audit_events` log query & filter | `/admin/audit` | `WF-040` / `FR-055` | `Approved` | `UI-Complete` | `Live Auth/RBAC` | `Live (Phase 1B)` | `Complete (Phase 1B)` | `Complete (Phase 1B)` | `Verified (Vitest)` |
| `AD-018` | Administrative Staff & RBAC | Superadmin | Manage user roles, permissions & account lifecycle (`OQ-011`) | `/admin/staff` | `WF-041` / `FR-001`,`OQ-011` | `Approved` | `UI-Complete` | `Live Auth/RBAC` | `Live (Phase 1B)` | `Complete (Phase 1B)` | `Complete (Phase 1B)` | `Verified (Vitest)` |

---

## 7. Master Screen Inventory Reconciliation & Reserved Identifier Register

### 7.1 Screen Inventory Count Audit

| Application Surface | Screen Prefix | Range | Active Catalogued Screens | Reserved / Gap Identifiers | Total Numbering Span |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **Traveller Mobile Application (Expo)** | `TM-xxx` | `TM-001` to `TM-044` | **39** | 5 (`TM-009`, `TM-010`, `TM-025`, `TM-026`, `TM-038`) | 44 |
| **Host Mobile Application (Expo)** | `HM-xxx` | `HM-001` to `HM-037` | **31** | 6 (`HM-008`, `HM-012`, `HM-015`, `HM-016`, `HM-017`, `HM-032`) | 37 |
| **Public Web Application (Vite)** | `PW-xxx` | `PW-001` to `PW-011` | **11** | 0 (None) | 11 |
| **Host Web Dashboard (Vite)** | `HD-xxx` | `HD-001` to `HD-014` | **14** | 0 (None) | 14 |
| **Superadmin Web Dashboard (Vite)** | `AD-xxx` | `AD-001` to `AD-018` | **18** | 0 (None) | 18 |
| **GRAND TOTALS** | | | **113 Active Screens** | **11 Reserved Identifiers** | **124** |

### 7.2 Detailed Audit of Reserved / Skipped Identifiers

| Reserved ID | Application | Functional Domain | Rationale & Reserve Allocation | Impact on Source FRS Completeness |
| :--- | :--- | :--- | :--- | :--- |
| `TM-009` | Traveller Mobile | Authentication / SSO | **Reserved for Social OAuth / OIDC Redirection Callback View** (e.g., Apple / Google login webview handler). Not required for core self-managed email/password login. | Zero omission. `FR-1` fulfilled by `TM-005`–`TM-008`. |
| `TM-010` | Traveller Mobile | Authentication / Biometrics | **Reserved for Biometric Authentication Setup** (FaceID / TouchID lock). Deferred to Phase 2 mobile security hardening. | Zero omission. Core authentication covered. |
| `TM-025` | Traveller Mobile | Payment / Alternative Gateways | **Reserved for Secondary Local Payment Aggregator Modal** (e.g., direct bank app deep-linking or cash vouchers). | Zero omission. PayHere gateway covered by `TM-020`. |
| `TM-026` | Traveller Mobile | Confirmation / Offline Storage | **Reserved for Offline PDF Voucher Export View**. Native screenshot & in-app pass covered by `TM-024`. | Zero omission. `FR-11` fulfilled by `TM-024`. |
| `TM-038` | Traveller Mobile | Notifications / Messaging | **Reserved for In-App Direct Host-Traveller Chat**. Initial launch relies on direct telephone calls (`TM-027`) and SMS notifications (`TM-037`). | Zero omission. In-app chat not part of MVP FRS. |
| `HM-008` | Host Mobile | Operational Schedule | **Reserved for Calendar Month Multi-Day View**. Daily list view fully provided by `HM-007`. | Zero omission. `FR-24` fulfilled by `HM-006` and `HM-007`. |
| `HM-012` | Host Mobile | Schedule / Overrides | **Reserved for Bulk Recurring Holiday Importer**. Manual exception dates provided by `HM-011`. | Zero omission. `FR-20` fulfilled by `HM-010` and `HM-011`. |
| `HM-015` | Host Mobile | Pricing / Surcharges | **Reserved for Custom Surcharge Configuration Modal** (e.g., after-hours fee). | Zero omission. `FR-23` fulfilled by `HM-014`. |
| `HM-016` | Host Mobile | Pricing / Dynamic Rates | **Reserved for Weekend / Seasonal Pricing Multipliers**. | Zero omission. Core daily rate covered by `HM-014`. |
| `HM-017` | Host Mobile | Pricing / Discounts | **Reserved for Host Multi-Day Volume Discount Rule Editor**. Embedded in `HM-014` for MVP. | Zero omission. Multi-day discounts handled in `HM-014`. |
| `HM-032` | Host Mobile | Finance / Statements | **Reserved for Monthly Tax Invoice & PDF Earnings Statement Download**. Summary covered by `HM-029` and `HM-031`. | Zero omission. `FR-36`–`FR-38` covered. |
