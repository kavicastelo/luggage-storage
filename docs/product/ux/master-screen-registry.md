# Master Screen Registry

**Project:** Global Luggage Storage Marketplace  
**Document Type:** UX Architecture & Screen Specification  
**Status:** Approved Phase 0C Baseline  
**Governing Documents:** FRS, Phase 0A Architecture, Technical Blueprint Section 6, Functional Requirements (`FR-001`–`FR-057`, `IR-001`–`IR-015`), Workflow Inventory (`WF-001`–`WF-044`).

---

## 1. Executive Summary & Registry Architecture

The Master Screen Registry is the central repository of every screen, view, modal, and interface across all 5 client surfaces of the Global Luggage Storage Marketplace:
1. **`TM` — Traveller Mobile Application** (React Native + Expo)
2. **`HM` — Host Mobile Application** (React Native + Expo)
3. **`PW` — Public Web Application** (React + Vite)
4. **`HD` — Host Web Dashboard** (React + Vite)
5. **`AD` — Superadmin Web Dashboard** (React + Vite)

### Screen-Completion & Honest Release Governance (`Section 12 & 6.6 Blueprint`):
- **UI Availability in Initial Release:** Every screen is classified honestly as either `UI-Complete` (rendered with genuine production UI/preview states) or `Coming Soon / Deferred`.
- **Backend Availability in Initial Release:** Distinct from UI status. Classified as `Backend-Complete` (fully wired to Fastify endpoints and PostgreSQL), `Read-Only Preview`, or `Phase 2 Deferred`.
- **Zero Hidden Features:** No non-functional feature is ever presented to travellers or hosts without clear visual indicators.

---

## 2. Traveller Mobile Application (`TM`)

| Screen ID | Screen Name | Role | Primary Purpose | Entry Point(s) | Exit / Destination(s) | Related Workflows | Related Reqs | UI Status | Backend Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `TM-001` | Splash Screen | Anonymous | Brand greeting & initial environment bootstrapping | App launch | `TM-002` or `TM-011` | `WF-001` | `FR-001` | `UI-Complete` | `Backend-Complete` |
| `TM-002` | Onboarding Welcome | Anonymous | Value proposition overview & carousel | `TM-001` | `TM-003`, `TM-005` | `WF-001` | `FR-001` | `UI-Complete` | `Backend-Complete` |
| `TM-003` | Permissions Request | Anonymous | Request GPS Location & Push Notification permissions | `TM-002` | `TM-011` | `WF-001` | `FR-003`, `FR-048` | `UI-Complete` | `Backend-Complete` |
| `TM-004` | Language & Currency Selector | Anonymous | Initial locale preference setup (English/Sinhala/Tamil, LKR) | `TM-002`, `TM-044` | `TM-011` | `WF-001` | `FR-056`, `FR-057` | `UI-Complete` | `Backend-Complete` |
| `TM-005` | Login Screen | Anonymous | Email/password login with social OAuth entry points | `TM-002`, `TM-011` | `TM-011`, `TM-006`, `TM-007` | `WF-002` | `FR-001` | `UI-Complete` | `Backend-Complete` |
| `TM-006` | Registration Screen | Anonymous | Create new traveller account with validation | `TM-005` | `TM-008` (OTP Verification) | `WF-002` | `FR-001` | `UI-Complete` | `Backend-Complete` |
| `TM-007` | Forgot Password | Anonymous | Trigger password reset email link | `TM-005` | `TM-005` | `WF-002` | `FR-001` | `UI-Complete` | `Backend-Complete` |
| `TM-008` | Email / Phone OTP Verification | Anonymous | Verify account security token | `TM-006` | `TM-011` | `WF-002` | `FR-001` | `UI-Complete` | `Backend-Complete` |
| `TM-011` | Home & Destination Search | Traveller | Search bar, nearby location quick links, active booking banner | `TM-001`, Navigation Tab | `TM-012`, `TM-013`, `TM-027` | `WF-003` | `FR-003` | `UI-Complete` | `Backend-Complete` |
| `TM-012` | Geospatial Map Discovery | Traveller | Interactive MapLibre map with price markers & clustering | `TM-011` | `TM-013`, `TM-014` | `WF-003` | `FR-003`, `FR-004` | `UI-Complete` | `Backend-Complete` |
| `TM-013` | Discovery List & Filters | Traveller | Scrollable listing cards with distance, rating, price, filters | `TM-011`, `TM-012` | `TM-014`, `TM-015` | `WF-003` | `FR-003`, `FR-004` | `UI-Complete` | `Backend-Complete` |
| `TM-014` | Filter Modal | Traveller | Filter by bag size, 24/7 hours, CCTV, instant booking | `TM-012`, `TM-013` | `TM-013` | `WF-003` | `FR-004` | `UI-Complete` | `Backend-Complete` |
| `TM-015` | Storage Location Details | Traveller | Photos, operating hours, amenities, reviews, host info | `TM-013` | `TM-016`, `TM-017` | `WF-004` | `FR-004`, `FR-050` | `UI-Complete` | `Backend-Complete` |
| `TM-016` | Location Reviews & Ratings | Traveller | List of verified traveller reviews and host responses | `TM-015` | `TM-015` | `WF-036` | `FR-050` | `UI-Complete` | `Backend-Complete` |
| `TM-017` | Booking Date & Time Picker | Traveller | Drop-off & collection calendar, operating hour checks | `TM-015` | `TM-018` | `WF-005` | `FR-005`, `FR-006` | `UI-Complete` | `Backend-Complete` |
| `TM-018` | Bag Selection & Category Counter | Traveller | Select counts for Small, Medium, Large, Oversized bags | `TM-017` | `TM-019` | `WF-005` | `FR-007`, `FR-008` | `UI-Complete` | `Backend-Complete` |
| `TM-019` | Price Breakdown & Checkout | Traveller | Itemized calculation, host discounts, taxes, promo entry | `TM-018` | `TM-020` (Pay), `TM-022` (Req) | `WF-006` | `FR-011`, `FR-012` | `UI-Complete` | `Backend-Complete` |
| `TM-020` | Payment Gateway Webview | Traveller | Hosted PayHere payment gateway checkout form | `TM-019` | `TM-021`, `TM-023` | `WF-007` | `FR-015`, `FR-016` | `UI-Complete` | `Backend-Complete` |
| `TM-021` | Payment Status Polling | Traveller | Polling screen waiting for verified webhook confirmation | `TM-020` | `TM-024` (Success), `TM-023` (Fail)| `WF-007` | `FR-016` | `UI-Complete` | `Backend-Complete` |
| `TM-022` | Host Approval Pending Screen | Traveller | Status screen for `HOST_APPROVAL` mode with 15m timer | `TM-019` | `TM-019` (Accepted), `TM-011` | `WF-008` | `FR-006` | `UI-Complete` | `Backend-Complete` |
| `TM-023` | Payment Failed Screen | Traveller | Failure explanation with retry payment action | `TM-020`, `TM-021` | `TM-019` (Retry), `TM-011` | `WF-007` | `FR-017` | `UI-Complete` | `Backend-Complete` |
| `TM-024` | Booking Confirmation Screen | Traveller | Confirmation voucher displaying QR code & 6-digit PIN | `TM-021` | `TM-027`, `TM-011` | `WF-009` | `FR-018` | `UI-Complete` | `Backend-Complete` |
| `TM-027` | Active Booking Details | Traveller | Directions, countdown to check-in, host call button, QR code | Navigation Tab, `TM-024` | `TM-028`, `TM-031`, `TM-039` | `WF-010` | `FR-019` | `UI-Complete` | `Backend-Complete` |
| `TM-028` | Check-in Handover Pass | Traveller | High-brightness QR display & PIN for host scanning | `TM-027` | `TM-027` | `WF-011` | `FR-030`, `FR-031` | `UI-Complete` | `Backend-Complete` |
| `TM-029` | In-Storage Live Status | Traveller | Luggage custody status, photo evidence preview, timer | Navigation Tab, `TM-027` | `TM-030`, `TM-039` | `WF-012` | `FR-034` | `UI-Complete` | `Backend-Complete` |
| `TM-030` | Check-out Collection Pass | Traveller | Collection QR code and PIN for baggage return | `TM-029` | `TM-034` (Review), `TM-011` | `WF-013` | `FR-035` | `UI-Complete` | `Backend-Complete` |
| `TM-031` | Booking Cancellation Flow | Traveller | Cancellation reason selection & refund estimate | `TM-027` | `TM-032` | `WF-014` | `FR-023`, `FR-024` | `UI-Complete` | `Backend-Complete` |
| `TM-032` | Cancellation Result & Refund Status | Traveller | Shows cancellation receipt & refund tracking status | `TM-031` | `TM-011`, `TM-033` | `WF-014` | `FR-025`, `FR-026` | `UI-Complete` | `Backend-Complete` |
| `TM-033` | Refund Detail Tracking | Traveller | Explicit multi-stage progress (7 stages) | `TM-032`, `TM-037` | `TM-011` | `WF-015` | `FR-027`, `FR-028` | `UI-Complete` | `Backend-Complete` |
| `TM-034` | Submit Review & Rating | Traveller | 5-star rating, cleanliness, security, text feedback | `TM-030`, Push Notif | `TM-011` | `WF-036` | `FR-049` | `UI-Complete` | `Backend-Complete` |
| `TM-035` | Booking History List | Traveller | Upcoming, Active, Completed, and Cancelled tabs | Navigation Tab | `TM-027`, `TM-033` | `WF-016` | `FR-020` | `UI-Complete` | `Backend-Complete` |
| `TM-036` | Saved Favourites | Traveller | Bookmarked storage locations for quick access | Navigation Tab | `TM-015` | `WF-004` | `FR-003` | `UI-Complete` | `Backend-Complete` |
| `TM-037` | Notification Centre | Traveller | In-app push notifications (reminders, approvals, receipts) | Navigation Header | `TM-027`, `TM-033` | `WF-038` | `FR-048` | `UI-Complete` | `Backend-Complete` |
| `TM-039` | Help & Support Centre | Traveller | FAQ search, contact support, open dispute | Profile Tab | `TM-040`, `TM-041` | `WF-037` | `FR-051` | `UI-Complete` | `Backend-Complete` |
| `TM-040` | Create Support Ticket | Traveller | Form with category dropdown, booking picker, image upload | `TM-039` | `TM-041` | `WF-037` | `FR-051` | `UI-Complete` | `Backend-Complete` |
| `TM-041` | Ticket Conversation Thread | Traveller | Messaging thread with platform support agent | `TM-039`, `TM-040` | `TM-039` | `WF-037` | `FR-052` | `UI-Complete` | `Backend-Complete` |
| `TM-042` | Traveller Profile & Account | Traveller | Name, phone, email, emergency contact details | Navigation Tab | `TM-043`, `TM-044` | `WF-002` | `FR-002` | `UI-Complete` | `Backend-Complete` |
| `TM-043` | Security & Password Update | Traveller | Change password, active session list, revoke sessions | `TM-042` | `TM-042`, `TM-005` | `WF-002` | `FR-001` | `UI-Complete` | `Backend-Complete` |
| `TM-044` | App Settings | Traveller | Theme, notification toggles, language, currency, legal | `TM-042` | `TM-004` | `WF-001` | `FR-056`, `FR-057` | `UI-Complete` | `Backend-Complete` |

---

## 3. Host Mobile Application (`HM`)

| Screen ID | Screen Name | Role | Primary Purpose | Entry Point(s) | Exit / Destination(s) | Related Workflows | Related Reqs | UI Status | Backend Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `HM-001` | Host Splash & Welcome | Host / Staff | Host portal gateway & role switch | App launch | `HM-002`, `HM-006` | `WF-017` | `FR-001` | `UI-Complete` | `Backend-Complete` |
| `HM-002` | Host Registration & Login | Host / Staff | Authenticate host owner or staff member | `HM-001` | `HM-003`, `HM-006` | `WF-017` | `FR-001` | `UI-Complete` | `Backend-Complete` |
| `HM-003` | Business Profile Setup | Host Owner | Legal name, entity type, business reg number, bank info | `HM-002` | `HM-004` | `WF-018` | `FR-045` | `UI-Complete` | `Backend-Complete` |
| `HM-004` | KYC Document Upload | Host Owner | National ID / Passport, Business Reg, Utility Bill upload | `HM-003` | `HM-005` | `WF-018` | `FR-045` | `UI-Complete` | `Backend-Complete` |
| `HM-005` | Host Application Status | Host Owner | Application under review banner / rejection remediation | `HM-004`, `HM-002` | `HM-006` (once approved) | `WF-018` | `FR-045` | `UI-Complete` | `Backend-Complete` |
| `HM-006` | Host Operations Dashboard | Host / Staff | Today's arrivals, active bags, pending approvals, quick scan | Main Tab | `HM-007`, `HM-018`, `HM-021` | `WF-019` | `FR-046` | `UI-Complete` | `Backend-Complete` |
| `HM-007` | Today's Expected Schedule | Host / Staff | Chronological list of drop-offs and collections for today | `HM-006` | `HM-021`, `HM-024` | `WF-019` | `FR-046` | `UI-Complete` | `Backend-Complete` |
| `HM-009` | Storage Location Profile | Host Owner | Edit location details, description, photos, facilities | Location Tab | `HM-010`, `HM-013` | `WF-020` | `FR-047` | `UI-Complete` | `Backend-Complete` |
| `HM-010` | Operating Hours Editor | Host Owner | Configure weekly opening, drop-off, collection hours | `HM-009` | `HM-009`, `HM-011` | `WF-021` | `FR-010` | `UI-Complete` | `Backend-Complete` |
| `HM-011` | Schedule Exception Calendar | Host Owner | Add holiday closures or special operating hours | `HM-010` | `HM-009` | `WF-021` | `FR-010` | `UI-Complete` | `Backend-Complete` |
| `HM-013` | Capacity & Zones Config | Host Owner | Setup storage zones, bag limits, oversized opt-in | Location Tab | `HM-014` | `WF-022` | `FR-009` | `UI-Complete` | `Backend-Complete` |
| `HM-014` | Pricing Rules Editor | Host Owner | Set base rate per day (LKR), bag category multipliers | Location Tab | `HM-009` | `WF-023` | `FR-013`, `FR-014` | `UI-Complete` | `Backend-Complete` |
| `HM-018` | Booking Requests Queue | Host / Staff | Review incoming `HOST_APPROVAL` requests with 15m SLA | `HM-006`, Alert | `HM-019` | `WF-008` | `FR-006` | `UI-Complete` | `Backend-Complete` |
| `HM-019` | Request Review & Decision | Host / Staff | Accept or reject booking with optional rejection reason | `HM-018` | `HM-006` | `WF-008` | `FR-006` | `UI-Complete` | `Backend-Complete` |
| `HM-020` | Active Bookings List | Host / Staff | Filter by Confirmed, In Storage, Overdue | Main Tab | `HM-021`, `HM-024` | `WF-024` | `FR-046` | `UI-Complete` | `Backend-Complete` |
| `HM-021` | Check-in Scanner & PIN Entry | Host / Staff | Camera QR scanner with manual 6-character PIN fallback | `HM-006`, `HM-020` | `HM-022` | `WF-011` | `FR-030`, `FR-031` | `UI-Complete` | `Backend-Complete` |
| `HM-022` | Bag Inspection & Tagging | Host / Staff | Verify bag count, attach physical tags, enter seal numbers | `HM-021` | `HM-023` | `WF-011` | `FR-032`, `FR-033` | `UI-Complete` | `Backend-Complete` |
| `HM-023` | Check-in Evidence Camera | Host / Staff | Capture photo of stored bags in storage zone | `HM-022` | `HM-006` (Complete) | `WF-011` | `FR-033` | `UI-Complete` | `Backend-Complete` |
| `HM-024` | Check-out Verification Scanner| Host / Staff | Scan collection QR or enter PIN presented by traveller | `HM-006`, `HM-020` | `HM-025` | `WF-013` | `FR-035` | `UI-Complete` | `Backend-Complete` |
| `HM-025` | Handover Release Confirmation | Host / Staff | Confirm bag return; release luggage to traveller | `HM-024` | `HM-006` | `WF-013` | `FR-035` | `UI-Complete` | `Backend-Complete` |
| `HM-026` | Overdue Bags Alert View | Host / Staff | List overdue luggage (> 30m past collection window) | `HM-006`, Alert | `HM-027`, `HM-028` | `WF-025` | `FR-036` | `UI-Complete` | `Backend-Complete` |
| `HM-027` | Request Overdue Payment | Host / Staff | Trigger system overdue charge calculation and payment link | `HM-026` | `HM-006` | `WF-025` | `FR-036` | `UI-Complete` | `Backend-Complete` |
| `HM-028` | Disputed Release Handover | Host / Staff | Release bags when fees disputed (**Mandatory Release**) | `HM-026` | `HM-006` | `WF-026` | `FR-035`, `BR-035` | `UI-Complete` | `Backend-Complete` |
| `HM-029` | Host Earnings & Balance | Host Owner | Gross revenue, 15% commission deducted, net balance | Finance Tab | `HM-030`, `HM-031` | `WF-027` | `FR-040`, `FR-041` | `UI-Complete` | `Backend-Complete` |
| `HM-030` | Payout Bank Account Details | Host Owner | View/edit bank name, branch code, account number | `HM-029` | `HM-029` | `WF-028` | `FR-042` | `UI-Complete` | `Backend-Complete` |
| `HM-031` | Payout History & Receipts | Host Owner | List completed manual payouts with bank ref numbers | `HM-029` | `HM-029` | `WF-028` | `FR-043` | `UI-Complete` | `Backend-Complete` |
| `HM-033` | Staff Management List | Host Owner | List staff members, active statuses, assigned branches | Settings Tab | `HM-034` | `WF-029` | `FR-044` | `UI-Complete` | `Backend-Complete` |
| `HM-034` | Invite Staff Member | Host Owner | Enter employee email/phone, select assigned locations | `HM-033` | `HM-033` | `WF-029` | `FR-044` | `UI-Complete` | `Backend-Complete` |
| `HM-035` | Host Customer Reviews | Host / Staff | View traveller ratings and submit host responses | Main Tab | `HM-035` | `WF-036` | `FR-050` | `UI-Complete` | `Backend-Complete` |
| `HM-036` | Incident & Dispute Report | Host / Staff | Report lost/damaged/unclaimed luggage to support | Settings Tab | `HM-006` | `WF-037` | `FR-053` | `UI-Complete` | `Backend-Complete` |
| `HM-037` | Host Business Settings | Host Owner | Notification toggles, language, business details | Settings Tab | `HM-001` | `WF-017` | `FR-002` | `UI-Complete` | `Backend-Complete` |

---

## 4. Public Web Application (`PW`)

| Screen ID | Screen Name | Role | Primary Purpose | Route | Related Workflows | Related Reqs | UI Status | Backend Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `PW-001` | Public Landing Page | Anonymous | High-converting homepage, search bar, city links | `/` | `WF-030` | `FR-003` | `UI-Complete` | `Backend-Complete` |
| `PW-002` | Web Search & Discovery | Anonymous / Trav| Dual pane: MapLibre interactive map & listing cards | `/search` | `WF-003` | `FR-003`, `FR-004` | `UI-Complete` | `Backend-Complete` |
| `PW-003` | Location Profile Detail | Anonymous / Trav| Full photo gallery, amenities, opening hours, reviews | `/locations/:slug` | `WF-004` | `FR-004`, `FR-050` | `UI-Complete` | `Backend-Complete` |
| `PW-004` | Web Checkout & Schedule | Traveller | Date/time selection, bag counts, pricing summary | `/checkout/:locId` | `WF-005`, `WF-006`| `FR-005`–`FR-014` | `UI-Complete` | `Backend-Complete` |
| `PW-005` | Web Payment & Confirmation | Traveller | PayHere payment redirect and confirmation voucher | `/booking/confirm` | `WF-007`, `WF-009`| `FR-015`–`FR-018` | `UI-Complete` | `Backend-Complete` |
| `PW-006` | Become a Host Landing | Anonymous / Host| Value proposition, earnings calculator, host registration | `/become-a-host` | `WF-017` | `FR-045` | `UI-Complete` | `Backend-Complete` |
| `PW-007` | How It Works | Anonymous | 3-step visual guide (Book, Drop off, Explore) | `/how-it-works` | `WF-030` | `FR-003` | `UI-Complete` | `Backend-Complete` |
| `PW-008` | Help Centre & FAQs | Anonymous / Trav| Searchable knowledge base, FAQs, luggage safety info | `/help` | `WF-037` | `FR-051` | `UI-Complete` | `Backend-Complete` |
| `PW-009` | Contact Us & Inquiries | Anonymous / Trav| Contact form, emergency phone numbers, office address| `/contact` | `WF-037` | `FR-051` | `UI-Complete` | `Backend-Complete` |
| `PW-010` | Terms, Privacy & Legal | Anonymous | Terms of Service, Privacy Policy, Luggage Guarantee | `/terms` | `WF-030` | `FR-054` | `UI-Complete` | `Backend-Complete` |
| `PW-011` | Traveller Web Portal | Traveller | View active bookings, download PDF vouchers, cancel | `/portal/bookings` | `WF-010`, `WF-014`| `FR-019`, `FR-023` | `UI-Complete` | `Backend-Complete` |

---

## 5. Host Web Dashboard (`HD`)

| Screen ID | Screen Name | Role | Primary Purpose | Route | Related Workflows | Related Reqs | UI Status | Backend Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `HD-001` | Host Overview Dashboard | Host Owner | Multi-location KPIs, occupancy rates, today's schedule | `/host/dashboard` | `WF-019` | `FR-046` | `UI-Complete` | `Backend-Complete` |
| `HD-002` | Location Management | Host Owner | List all business branches, add new location | `/host/locations` | `WF-020` | `FR-047` | `UI-Complete` | `Backend-Complete` |
| `HD-003` | Location Profile Editor | Host Owner | Manage photos, GPS pin, address, amenities, rules | `/host/locations/:id` | `WF-020` | `FR-047` | `UI-Complete` | `Backend-Complete` |
| `HD-004` | Schedule & Calendar Editor | Host Owner | Weekly operating hours & holiday closure exceptions | `/host/locations/:id/schedule`| `WF-021` | `FR-010` | `UI-Complete` | `Backend-Complete` |
| `HD-005` | Capacity Pools & Zones | Host Owner | Multi-zone spatial config, category quotas | `/host/locations/:id/capacity`| `WF-022` | `FR-009` | `UI-Complete` | `Backend-Complete` |
| `HD-006` | Pricing Rules & Multipliers | Host Owner | Base daily rates (LKR), bag multipliers, discounts | `/host/locations/:id/pricing` | `WF-023` | `FR-013`, `FR-014` | `UI-Complete` | `Backend-Complete` |
| `HD-007` | Booking Management Hub | Host Owner/Staff | Comprehensive table of bookings with status filters | `/host/bookings` | `WF-024` | `FR-046` | `UI-Complete` | `Backend-Complete` |
| `HD-008` | Booking Investigation Modal | Host Owner/Staff | Deep dive into items, custody logs, photo evidence | Modal on `HD-007` | `WF-024` | `FR-019`, `FR-034` | `UI-Complete` | `Backend-Complete` |
| `HD-009` | Web Check-in/Out Operations | Host Staff | Desktop barcode/QR scanning & manual PIN verification | `/host/operations` | `WF-011`, `WF-013`| `FR-030`–`FR-035` | `UI-Complete` | `Backend-Complete` |
| `HD-010` | Financial Revenue & Ledger | Host Owner | Gross revenue, platform commission, net payable balance | `/host/finance` | `WF-027` | `FR-040`, `FR-041` | `UI-Complete` | `Backend-Complete` |
| `HD-011` | Payout Accounts & History | Host Owner | Manage bank details, view payout receipts & CSV export | `/host/payouts` | `WF-028` | `FR-042`, `FR-043` | `UI-Complete` | `Backend-Complete` |
| `HD-012` | Review Management | Host Owner | Read customer reviews, submit official public responses | `/host/reviews` | `WF-036` | `FR-050` | `UI-Complete` | `Backend-Complete` |
| `HD-013` | Staff Management & RBAC | Host Owner | Invite attendants, assign branches, revoke access | `/host/staff` | `WF-029` | `FR-044` | `UI-Complete` | `Backend-Complete` |
| `HD-014` | Business Profile & Legal | Host Owner | Business registration, tax certificates, owner details | `/host/settings` | `WF-018` | `FR-045` | `UI-Complete` | `Backend-Complete` |

---

## 6. Superadmin Web Dashboard (`AD`)

| Screen ID | Screen Name | Role | Primary Purpose | Route | Related Workflows | Related Reqs | UI Status | Backend Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `AD-001` | Platform Command Dashboard | Superadmin | Global GMV, active bags in storage, incident alerts | `/admin` | `WF-031` | `FR-055` | `UI-Complete` | `Backend-Complete` |
| `AD-002` | Host Verification Queue | Superadmin | Review host applications, inspect business documents | `/admin/hosts/review` | `WF-032` | `FR-045` | `UI-Complete` | `Backend-Complete` |
| `AD-003` | Host Directory & Management | Superadmin / Supp | Search all host businesses, inspect performance, suspend | `/admin/hosts` | `WF-032` | `FR-045` | `UI-Complete` | `Backend-Complete` |
| `AD-004` | Storage Location Moderation | Superadmin | Approve locations to go live, inspect photos and GPS | `/admin/locations` | `WF-033` | `FR-047` | `UI-Complete` | `Backend-Complete` |
| `AD-005` | Global Bookings Ledger | Superadmin / Supp | Search any booking by ref, inspect customer, timeline | `/admin/bookings` | `WF-034` | `FR-019` | `UI-Complete` | `Backend-Complete` |
| `AD-006` | Payment Transactions Log | Superadmin | Gateway orders, raw webhooks, signature verification log | `/admin/payments` | `WF-007` | `FR-016`, `FR-017` | `UI-Complete` | `Backend-Complete` |
| `AD-007` | Refund Management Queue | Superadmin | Review refund requests, dispatch gateway refunds | `/admin/refunds` | `WF-015` | `FR-027`, `FR-028` | `UI-Complete` | `Backend-Complete` |
| `AD-008` | Host Payout Batch Generation | Superadmin | Generate payout batch for eligible host balances | `/admin/payouts/batches`| `WF-035` | `FR-042`, `FR-043` | `UI-Complete` | `Backend-Complete` |
| `AD-009` | Manual Payout Disbursement | Superadmin | Record bank reference numbers for completed transfers | `/admin/payouts/disburse`| `WF-035` | `FR-043` | `UI-Complete` | `Backend-Complete` |
| `AD-010` | Double-Entry Financial Ledger| Superadmin | Inspect general ledger accounts, debits, credits | `/admin/finance/ledger`| `WF-027` | `FR-041` | `UI-Complete` | `Backend-Complete` |
| `AD-011` | Support Ticket Triage Queue | Support / Admin | Ticket inbox, category filtering, agent assignment | `/admin/support` | `WF-037` | `FR-051`, `FR-052` | `UI-Complete` | `Backend-Complete` |
| `AD-012` | Support Ticket Resolution View| Support / Admin | Customer messaging, internal notes, resolution codes | `/admin/support/:id` | `WF-037` | `FR-052` | `UI-Complete` | `Backend-Complete` |
| `AD-013` | Incident & Dispute Investigation| Superadmin | Investigate lost, damaged, or abandoned baggage | `/admin/incidents` | `WF-037` | `FR-053` | `UI-Complete` | `Backend-Complete` |
| `AD-014` | Review Moderation Queue | Superadmin | Moderate flagged customer reviews, delete abusive content| `/admin/reviews` | `WF-036` | `FR-050` | `UI-Complete` | `Backend-Complete` |
| `AD-015` | Promotion & Marketing Engine | Superadmin | Create promo codes, discounts, campaign budgets | `/admin/promotions` | `WF-006` | `FR-012` | `UI-Complete` | `Backend-Complete` |
| `AD-016` | Platform System Configuration | Superadmin | Commission %, countries, currencies, tax tables | `/admin/settings` | `WF-039` | `FR-056`, `FR-057` | `UI-Complete` | `Backend-Complete` |
| `AD-017` | Security & Compliance Audit Log| Superadmin | Immutable audit log of administrative actions and logins | `/admin/audit` | `WF-040` | `FR-055` | `UI-Complete` | `Backend-Complete` |
| `AD-018` | Administrative Staff & RBAC | Superadmin | Manage superadmin and customer support user accounts | `/admin/staff` | `WF-041` | `FR-001`, `OQ-011` | `UI-Complete` | `Backend-Complete` |

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

In strict accordance with Phase 0C governance, identifiers were **not arbitrarily omitted**. The table below documents the architectural rationale for every reserved identifier in the range:

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

### 7.3 Integrity & Traceability Verification
- **No Duplicated IDs:** Every screen identifier (`TM-001`..`AD-018`) is globally unique across the workspace.
- **No Unintentionally Omitted Screens:** Every single screen, modal, and interface referenced in the source FRS (`luggage-storage-frs.pdf`) and Technical Blueprint Section 6 is fully mapped.
- **Valid Role and Surface Allocation:** Every screen specifies a concrete client surface (`apps/mobile` or `apps/web`) and user role (`ANONYMOUS`, `TRAVELLER`, `HOST_OWNER`, `HOST_STAFF`, `SUPPORT`, `SUPERADMIN`).
- **Honest Release Tracking:** UI availability and Backend availability are tracked independently with zero hidden or falsely claimed implementations.
