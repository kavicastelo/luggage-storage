# Product Scope and Application Boundaries

**Document Status:** Baseline Architecture — Phase 0A
**Source Reference:** [luggage-storage-frs.pdf](source/luggage-storage-frs.pdf)
**Related Documents:**
- [Product Overview](product-overview.md)
- [User Roles and Actor Model](user-roles-and-actors.md)
- [Application Architecture Boundaries](../architecture/application-boundaries.md)
- [Backend Domain Architecture Overview](../architecture/backend-domain-overview.md)
- [Assumptions and Open Questions](assumptions-and-open-questions.md)

---

## 1. Purpose

This document defines the functional scope and responsibility boundaries across every client application, backend service, and external third-party integration in the **Global Luggage Storage Marketplace**. It establishes what belongs in each experience, how the two-dimensional completion model (`Functional` vs. `UI-Complete`) applies across surfaces, and what is intentionally out of scope.

---

## 2. Experience Overview & Channel Matrix

The platform comprises **five distinct user-facing experiences** delivered through **two frontend codebases** (`apps/mobile` and `apps/web`) communicating exclusively with **one modular monolithic backend** (`apps/api`).

| Experience Surface | Codebase | Target Actors | Primary Purpose |
| :--- | :--- | :--- | :--- |
| **1. Traveller Mobile App** | `apps/mobile` (Traveller build) | Traveller | On-the-go discovery, booking, payment, directions, QR/PIN custody handoff, reviews, support |
| **2. Host Mobile App** | `apps/mobile` (Host build) | Host, Host Staff (`Later`) | Store-floor operations, QR/PIN scanning, photo check-in evidence, booking acceptance, quick management |
| **3. Public Traveller Website** | `apps/web` (Public routes) | Unauthenticated Visitor, Traveller | SEO landing pages, browser-based search, map discovery, and full web booking/checkout |
| **4. Host Web Dashboard** | `apps/web` (Host routes) | Host, Host Staff (`Later`) | Desktop/tablet-optimized multi-location setup, capacity/pricing rules, financial statements, analytics |
| **5. Superadmin Web Dashboard** | `apps/web` (Admin routes) | Superadmin, Platform Support/Ops Staff | Host verification approval, manual payouts, refund processing, booking/incident investigation, system config |

---

## 3. Traveller Mobile Application Scope

### 3.1 In-Scope Functional Capabilities (Core MVP)
- **Authentication & Onboarding (`FR -1`):** Email/password registration and login, social sign-in (Google, Apple), password reset, OTP verification, location/notification permission prompts.
- **Traveller Profile & Settings (`FR-2`):** Personal details, emergency/contact information (`E.164` phone), account security, notification preferences, privacy controls.
- **Location Search & Map Discovery (`FR -2`, `FR-3`, `FR-4`):**
  - Search by city, landmark, address, or current device GPS location (`expo-location`).
  - Interactive map view (`MapLibre React Native`) showing nearby host pins/clusters.
  - List view of available storage locations with sorting and multi-criteria filtering (distance, price, opening hours, rating, availability, facilities).
- **Host Listing Details (`FR -4`, `FR -11`):** Host business summary, approximate/exact address (per disclosure policy), photo gallery, operating/drop-off/collection hours, facilities, prohibited item restrictions, and verified traveller reviews.
- **Availability, Pricing & Promo Codes (`FR-5`, `FR -13`):**
  - Selection of drop-off date/time, collection date/time, and bag count/categories.
  - Real-time availability validation and transparent, server-calculated price breakdown.
  - Promo code entry and discount validation.
- **Booking & Online Payment (`FR-6`):**
  - Temporary capacity reservation during checkout.
  - Secure online payment via PayHere checkout integration.
- **Booking Confirmation & Directions (`FR-7`):**
  - Issuance of unique booking reference, dynamic/non-sensitive QR code, and backup PIN.
  - Turn-by-turn navigation handoff (`FR -7 Directions`) to native maps or in-app routing once booking is confirmed.
- **Check-In, Active Booking & Check-Out (`FR-8`, `FR-9`):**
  - Presentation of QR code/PIN to Host at bag drop-off (`FR-8 Check-in / Bag Drop`).
  - Real-time active booking tracker showing storage status, checked-in bag count, and collection deadline countdown (`FR-9 Active Booking`).
  - Secure collection verification (`FR -8 Check-out / Collection`) and settlement of any overdue charges.
- **Booking History & Cancellation (`FR -9`, `FR-10`):**
  - Categorized views for upcoming, active, completed, and cancelled bookings.
  - Policy-driven booking cancellation (`FR-10 Cancellation`).
- **Refund Status (`FR -10` — Marked `Later/MVP` in FRS):**
  - Dedicated UI screens displaying whether a refund is pending, approved, or completed (backend depth subject to `OQ-013`).
- **Notifications (`FR-11`):** Push (`expo-notifications`) and in-app notification centre for booking confirmation, drop-off reminders, collection deadline warnings, and status updates.
- **Reviews & Customer Support (`FR-12`, `FR -12`):**
  - Post-collection rating and review submission for both the Host and the platform app (`FR-12 Leave Review`).
  - Separated customer support flows (`FR -12 Customer Support`): booking-specific issue reporting vs. general platform support inquiries.

### 3.2 In-Scope UI-Complete / Deferred Backend Capabilities (`Later`)
- **Favourite Hosts (`FR-13` — `Later`):** Saved/bookmarked hosts and locations screen present and navigable in initial UI.
- **Multiple Languages (`FR-14` — `Later`):** Language selector UI present in Settings; i18n architecture active with English (`en`) in MVP and additional locales ready for activation.
- **Multiple Currencies (`FR -14` — `Later`):** Currency selector UI present in Settings; currency-aware display architecture active with `LKR` in MVP.

---

## 4. Host Mobile Application Scope

### 4.1 In-Scope Functional Capabilities (Core MVP)
- **Host Registration & Onboarding (`FR-15`):** Application workflow to register as an individual or business storage provider.
- **Identity & Business Verification (`FR-16`):** Submission of KYC identity documents and business registration certificates using camera/file upload (`expo-camera` / media picker) to Cloudflare R2.
- **Host Approval Status (`FR-17`):** Application tracking screen showing pending review, approval confirmation, or rejection feedback with re-submission guidance.
- **Host Profile & Multi-Location Management (`FR-18`, `FR-19`, `FR-44`):**
  - Business profile and contact management.
  - Creation and management of one or multiple storage locations (`FR-44`, e.g., multi-branch chains).
  - Location setup with address, map pin placement, photo uploads, description, facilities, and storage restrictions.
- **Operational Configuration (`FR-20`, `FR-21`, `FR-22`, `FR-23`):**
  - Opening hours, drop-off windows, and collection hours configuration (`FR-20`).
  - Storage capacity setup supporting simple count, bag categories, or zones (`FR-21`).
  - Availability management to block dates/times or temporarily pause bookings (`FR-22`).
  - Pricing configuration aligned with the host's business model (`FR-23`).
- **Booking Dashboard & Acceptance (`FR-24`, `FR-25`, `FR-26`):**
  - Operational dashboard showing today's arrivals, currently stored bags, upcoming collections, and overdue bags (`FR-24`).
  - Detailed booking view showing traveller details, bag count/types, and schedule (`FR-25`).
  - Booking acceptance/rejection workflow for hosts not using instant booking (`FR-26` — `Depends`).
- **Luggage Check-In & Custody Evidence (`FR-27`, `FR-28`, `FR-29`):**
  - Traveller booking verification via built-in QR code scanner (`expo-camera`) or PIN entry (`FR-27`).
  - Verification of physical bag count and categories received (`FR-28`).
  - Capture of check-in evidence including luggage photos, physical tag numbers, and QR/PIN confirmation (`FR-29` — `Recommended`).
- **Check-Out, Completion & Late Collection (`FR-30`, `FR-31`, `FR-32`):**
  - Traveller verification before releasing luggage (`FR-30`).
  - Flagging overdue luggage and calculating/recording late collection charges (`FR-32`).
  - Marking booking complete upon confirmed handoff (`FR-31`).
- **History, Cancellations & Notifications (`FR-33`, `FR-34`, `FR-35`):**
  - Historical log of completed, cancelled, and rejected bookings (`FR-33`).
  - Host-initiated cancellation handling under platform rules (`FR-34`).
  - Push and in-app notifications for new bookings, upcoming arrivals, collections, and overdue alerts (`FR-35`).
- **Earnings, Payouts & Transactions (`FR-36`, `FR-37`, `FR-38`):**
  - Earnings dashboard displaying gross booking revenue and net host earnings (`FR-36`).
  - Bank/payout beneficiary account configuration and payout status tracking (`FR-37`).
  - Itemized transaction history showing customer payments, platform commissions, and manual payouts (`FR-38`).
- **Reviews, Support & Incident Reporting (`FR-39`, `FR-40`, `FR-41`):**
  - Viewing traveller ratings and reviews received (`FR-39`).
  - Host support ticket creation for traveller, booking, or luggage issues (`FR-40`).
  - Formal incident reporting workflow for lost, damaged, or unclaimed luggage (`FR-41`).

### 4.2 In-Scope UI-Complete / Deferred Backend Capabilities (`Later`)
- **Staff Accounts (`FR-42` — `Later`):** Staff list, employee invitation, and check-in/out permission screens present in UI; backend activation scheduled for Phase 11.
- **Host Analytics (`FR-43` — `Later`):** Occupancy, booking trends, revenue charts, and busiest period screens present in UI; backend aggregation scheduled for Phase 11.

---

## 5. Public Website Scope (`apps/web` — Public Zone)

The public website serves both as the platform's marketing/SEO acquisition engine and as a complete browser-based booking channel for travellers:
- **Marketing & Information Pages:** Home page, How It Works, Become a Host landing page, About Us, Contact Us, Help Centre / FAQs, Terms & Conditions, Privacy Policy, Cancellation & Refund Policy.
- **SEO Discovery Pages:** Country, city, transit hub, and landmark landing pages for organic search discovery.
- **Web Search & Discovery (`FR -2`, `FR-3`, `FR-4`):** Full desktop and mobile-web interactive map (`MapLibre GL JS`) and filterable location listings.
- **Web Booking & Checkout (`FR-5`, `FR-6`, `FR-7`):** Complete traveller authentication, availability check, price calculation, promo code application, PayHere web checkout, and web booking confirmation/QR/PIN view.
- **Traveller Web Account Portal (`FR-2`, `FR-9`, `FR-10`, `FR-12`):** Browser access to active bookings, booking history, cancellations, refund status, reviews, favourites (`Later` UI), and customer support.

---

## 6. Host Web Dashboard Scope (`apps/web` — Host Zone)

The Host Web Dashboard mirrors the functional domain of the Host Mobile App while optimizing for desktop and tablet administration, particularly for multi-location chains (`FR-44`) and complex configurations:
- **Onboarding, KYC Upload & Approval Tracking (`FR-15`–`FR-18`).**
- **Multi-Location Portfolio Management (`FR-19`, `FR-44`):** Tabular and detail views across multiple branches.
- **Advanced Configuration Interfaces (`FR-20`–`FR-23`):** Matrix editors for weekly schedules, holiday exceptions, multi-pool capacity rules, storage zones, and tiered pricing policies.
- **Web Check-In / Check-Out Console (`FR-24`–`FR-32`):** Front-desk browser interface for PIN verification, QR webcam scanning, bag verification, and overdue handling.
- **Financial & Reporting Center (`FR-36`–`FR-38`):** Detailed earnings statements, downloadable transaction history, commission breakdowns, and bank payout settings.
- **Operations & Governance (`FR-39`–`FR-43`):** Reviews monitor, support center, incident reporting, staff management UI (`FR-42` `Later`), and analytics dashboards (`FR-43` `Later`).

---

## 7. Superadmin Web Dashboard Scope (`apps/web` — Admin Zone)

The Superadmin Web Dashboard is the platform's internal control plane. Although the FRS lists features primarily from the Traveller and Host perspectives, several FRS requirements explicitly mandate platform-side administrative workflows:
- **Host Verification & Approval Queue (`FR-16`, `FR-17`):** Inspecting uploaded KYC/business documents, approving or rejecting host applications, and suspending non-compliant hosts or locations.
- **Manual Payout Management (`FR-37`):** Reviewing host payable balances, verifying host bank account details, executing manual payouts outside/via bank rails, recording payout transaction references/receipts, and updating payout statuses.
- **Booking & Custody Oversight (`FR-6`, `FR-8`, `FR-24`–`FR-34`):** Viewing all platform bookings, investigating stuck or disputed bookings, auditing check-in/out custody evidence (`FR-29`), and overriding states under documented administrative protocols.
- **Payment & Refund Administration (`FR-6`, `FR-10`):** Monitoring PayHere webhook reconciliations, investigating failed payments, and managing the refund queue (`FR -10 Refund Status`).
- **Commission & Financial Ledger Management (`FR-36`, `FR-38`):** Configuring platform commission rates, viewing immutable ledger entries, and reconciling platform revenue against host liabilities.
- **Customer & Host Support Desk (`FR -12`, `FR-40`):** Managing separated traveller and host support ticket queues.
- **Incident Investigation Center (`FR-41`):** Investigating and resolving lost, damaged, or unclaimed luggage reports with full custody audit trails.
- **Review Moderation (`FR -11`, `FR-12`, `FR-39`):** Moderating flagged or abusive reviews.
- **Platform Configuration (`FR-13`, `FR-14`):** Managing promo codes/discounts (`FR -13`), active countries, currencies, languages, and platform staff permissions.

---

## 8. Backend & External Service Responsibilities

### 8.1 Backend API & Worker Responsibilities (`apps/api`)
- **Authoritative Business Logic:** All pricing calculations (`FR -5`), capacity reservations (`FR-6`), booking state transitions, cancellation eligibility (`FR-10`, `FR-34`), late collection fees (`FR-32`), and commission splits (`FR-38`) execute exclusively on the backend.
- **Security & Access Control:** Enforcing authentication, RBAC, and strict resource-ownership isolation (a Host can never query or mutate another Host's locations, bookings, or finances).
- **Webhook & Asynchronous Processing:** Verifying cryptographic checksums from PayHere webhooks, expiring unpaid temporary capacity reservations, dispatching booking/collection reminders (`FR-11`, `FR-35`), and maintaining audit logs.

### 8.2 External Service Responsibilities

| External Service | Responsibility Boundary | What Remains Inside Platform Backend |
| :--- | :--- | :--- |
| **PayHere** | Processing traveller card/mobile wallet/bank payments (`FR-6`), emitting asynchronous payment status notifications | Price calculation, order creation, signature verification, payment reconciliation, booking confirmation, commission ledgering, manual payout tracking (`FR-37`) |
| **Cloudflare R2** | Durable object storage for host location photos (`FR-19`), KYC/business verification documents (`FR-16`), and luggage check-in evidence (`FR-29`) | Pre-signed URL generation, access authorization, file metadata ownership, document retention rules |
| **MapLibre + Commercial Map/Geocoding Provider** | Rendering vector map tiles (`FR-3`), forward/reverse geocoding (`FR -2`), and route/direction calculation (`FR -7`) | PostGIS geospatial indexing, radius/bounding-box location queries, availability filtering, address privacy masking |
| **Expo EAS & Push Notification Services (FCM / APNs)** | Cloud compilation of Android/iOS builds; last-mile delivery of push notifications to mobile devices (`FR-11`, `FR-35`) | Notification trigger logic, in-app notification persistence, user preference filtering, reminder scheduling |
| **Email / SMS Provider *(Pending Approval)*** | Delivering transactional emails (verification, booking receipts, password resets) and OTP SMS messages | Template rendering, token generation, rate limiting, delivery audit logging |

---

## 9. Explicit Scope Exclusions (Out of Scope)

To protect startup velocity and architectural focus, the following are **explicitly outside the current product scope**:

1. **Automated Marketplace Split Settlement / Escrow via PayHere:** Per `FR-37`, host payouts are processed manually through the Superadmin dashboard for security and operational control. Automated real-time payout APIs are excluded from the initial launch.
2. **Peer-to-Peer Courier / Luggage Delivery Logistics:** The platform covers stationary luggage storage at verified host premises (`drop-off` and `collection` by the traveller). On-demand luggage pickup/delivery transport fleets are out of scope.
3. **In-App Real-Time Chat Between Traveller and Host:** The FRS specifies notifications (`FR-11`, `FR-35`), directions (`FR -7`), and separated customer/host support (`FR -12`, `FR-40`), not unconstrained peer-to-peer messaging (which introduces off-platform booking leakage risk).
4. **IoT Smart Locker Hardware Integration:** While hosts operating locker facilities can use the platform via zone/category capacity models, direct hardware API integration with electronic locker locks is outside initial scope.
5. **Microservices, Kubernetes & Multi-Cluster Infrastructure:** Explicitly prohibited by architectural constraints to maintain startup cost efficiency.

---

## 10. Future Expansion Boundaries

The architecture reserves clean extension boundaries for future roadmap phases without requiring structural rewrites:
- **Phase 11 Activation of `Later` FRS Features:** Activating backend logic for `FR-13 Favourite Hosts`, `FR-14 Multiple Languages`, `FR -14 Multiple Currencies`, `FR-42 Staff Accounts`, and `FR-43 Analytics` behind the already-built UI screens.
- **Additional Payment Providers:** Plugging Stripe, Adyen, or country-specific gateways into the `PaymentProvider` interface alongside PayHere when expanding beyond Sri Lanka.
- **Automated Payout Rails:** Extending the `Finance` and `Payouts` module from manual Superadmin disbursement (`FR-37`) to automated batch bank transfers or Stripe Connect payouts per country.
- **Insurance / Guarantee Tiers:** Attaching optional per-bag protection plans to the `Pricing` and `Custody` domains.

