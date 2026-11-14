# Backend Domain Architecture Overview

**Document Status:** Baseline Architecture — Phase 0A
**Source Reference:** [luggage-storage-frs.pdf](../product/source/luggage-storage-frs.pdf)
**Related Documents:**
- [System Architecture Overview](system-architecture.md)
- [Application Architecture Boundaries](application-boundaries.md)
- [Product Scope and Application Boundaries](../product/product-scope-and-boundaries.md)
- [User Roles and Actor Model](../product/user-roles-and-actors.md)
- [Assumptions and Open Questions](../product/assumptions-and-open-questions.md)

---

## 1. Purpose & Modular Monolith Design Rules

The backend (`apps/api`) is structured as a **Modular Monolith** built on **Node.js, TypeScript, Fastify, Drizzle ORM, and PostgreSQL + PostGIS**.

To prevent the monolith from degenerating into tightly coupled spaghetti code, all **23 business domains** adhere to five architectural rules:
1. **Explicit Module Boundary:** Each domain owns its tables, domain entities, services, and REST routes inside `apps/api/src/modules/<domain>/`.
2. **No Cross-Module Table Mutations:** A module may never directly `INSERT`, `UPDATE`, or `DELETE` records in another module's database tables. Cross-domain mutations occur strictly via exported domain service interfaces or internal domain events.
3. **Separation of Booking, Payment, and Custody:** What a traveller reserves (`Booking`), what the traveller pays (`Payment` / `Finance`), and what bags the host physically holds (`Custody`) are distinct domains with independent state machines.
4. **Configuration-Driven Engines:** `Capacity`, `Availability`, `Pricing`, and `Booking` domains operate on versioned host configurations rather than hardcoded constants.
5. **Global-Ready Primitives:** Every domain uses `ISO 3166-1` country codes, `ISO 4217` currency codes, `BCP 47` locales, `IANA` timezones, `UTC` timestamps, and `E.164` phone numbers.

---

## 2. Backend Domain Dependency Diagram

```mermaid
flowchart TB
    subgraph Foundation["Foundation & Cross-Cutting Domains"]
        Id["1. Identity & Auth"]
        Usr["2. User Management"]
        Locz["23. Localization"]
        Notif["17. Notifications"]
        Admin["22. Administration"]
    end

    subgraph Actors["Actor & Supply Onboarding Domains"]
        Trv["3. Traveller Management"]
        Hst["4. Host Management"]
        HVer["5. Host Verification"]
        Stf["20. Host Staff (Later)"]
    end

    subgraph Supply["Location & Configurable Inventory Domains"]
        SLoc["6. Storage Locations"]
        Geo["8. Geospatial Search"]
        Cap["9. Capacity Management"]
        Avl["10. Availability Management"]
        Prc["11. Pricing"]
        Mkt["7. Marketplace Discovery"]
    end

    subgraph Transaction["Core Transaction, Financial & Custody Domains"]
        Bk["12. Booking Management"]
        Pay["13. Payments"]
        Fin["14. Financial Management"]
        Cust["15. Luggage Custody"]
    end

    subgraph PostBooking["Trust, Support & Intelligence Domains"]
        Rev["16. Reviews & Ratings"]
        Sup["18. Support"]
        Inc["19. Incident Management"]
        Anl["21. Analytics (Later)"]
    end

    Usr --> Id
    Trv --> Usr
    Hst --> Usr
    HVer --> Hst
    Stf --> Hst & SLoc

    SLoc --> Hst & Geo & Locz
    Cap --> SLoc
    Avl --> SLoc
    Prc --> SLoc & Locz
    Mkt --> SLoc & Geo & Cap & Avl & Prc & Rev

    Bk --> Trv & SLoc & Cap & Avl & Prc
    Pay --> Bk & Locz
    Fin --> Bk & Pay & Hst
    Cust --> Bk & SLoc & Stf

    Rev --> Bk & Trv & Hst
    Sup --> Usr & Bk & Hst
    Inc --> Cust & Bk & Hst
    Anl --> Bk & Fin & Cap & SLoc
    Admin --> HVer & Fin & Pay & Bk & Sup & Inc & Locz
```

---

## 3. Detailed Domain Specifications (All 23 Domains)

---

### 3.1 Identity and Authentication (`identity`)
- **FRS Traceability:** `FR -1 Account Registration & Login`, `FR-15 Host Registration`, `FR-42 Staff Accounts`.
- **Primary Responsibility:** Authenticating users across email/password and OAuth providers (Google, Apple), issuing/verifying sessions or tokens, managing password resets/OTPs, and enforcing role/permission checks.
- **What It Owns:** Auth credentials, OAuth provider links, active sessions/refresh tokens, OTP/verification challenges, security audit events.
- **What It Does Not Own:** Traveller personal preferences (`travellers`), Host business profiles (`hosts`), or KYC identity documents (`host-verification`).
- **Depends On:** `notifications` (for verification emails/OTPs).
- **Consumed By:** Traveller Mobile, Host Mobile, Public Web, Host Web Dashboard, Superadmin Web Dashboard.
- **Important Architectural Considerations:**
  - The specific authentication provider/strategy is pending owner approval (`OQ-001`).
  - Must support linking Google and Apple OAuth accounts to the same underlying user identity (`FR -1`).
  - Must support MFA enforcement for Superadmin and Platform Staff accounts.

---

### 3.2 User Management (`users`)
- **FRS Traceability:** `FR -1`, `FR-2`, `FR-14`, `FR-15`, `FR-42`.
- **Primary Responsibility:** Managing the core, role-agnostic `User` identity, contact details (`E.164` phone, email), account status, and role assignments (`TRAVELLER`, `HOST`, `HOST_STAFF`, `PLATFORM_SUPPORT`, `SUPERADMIN`).
- **What It Owns:** `users` records, global user preferences (preferred language/currency codes), role bindings, and account activation/suspension flags.
- **What It Does Not Own:** Password verification (`identity`), booking history (`bookings`), or host business entities (`hosts`).
- **Depends On:** `identity`, `localization`.
- **Consumed By:** All client applications.
- **Important Architectural Considerations:**
  - Designed so a single human user can hold both `TRAVELLER` and `HOST` contexts without registering duplicate accounts (subject to `OQ-007` owner confirmation).

---

### 3.3 Traveller Management (`travellers`)
- **FRS Traceability:** `FR-2 Traveller Profile`, `FR-13 Favourite Hosts` (`Later`).
- **Primary Responsibility:** Managing traveller-specific profile attributes, emergency/travel contact details, and saved favourite hosts/locations.
- **What It Owns:** `traveller_profiles`, `favourite_hosts` / `favourite_locations` (`Later` backend, UI-complete initial release).
- **What It Does Not Own:** Core authentication (`identity`), bookings (`bookings`), or reviews (`reviews`).
- **Depends On:** `users`, `locations` (for favourites reference).
- **Consumed By:** Traveller Mobile, Public Web, Superadmin Dashboard.
- **Important Architectural Considerations:**
  - `FR-13 Favourite Hosts` is marked `Later` in the FRS; the UI screens must exist in the initial release while full backend persistence/sync can be activated in Phase 11 (or provided as a lightweight table early).

---

### 3.4 Host Management (`hosts`)
- **FRS Traceability:** `FR-15 Host Registration`, `FR-17 Host Approval`, `FR-18 Host Profile`, `FR-44 Multiple Locations`.
- **Primary Responsibility:** Managing the Host partner organization/business entity, host onboarding lifecycle (`APPLICANT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `SUSPENDED`), and business-level profile information.
- **What It Owns:** `hosts` (business name, host archetype, legal entity type, primary business contact, approval status), and the 1-to-many ownership relationship to `StorageLocations` (`FR-44`).
- **What It Does Not Own:** KYC document inspection workflows (`host-verification`), individual physical location configurations (`locations`), or payout ledgers (`finance`).
- **Depends On:** `users`, `localization`.
- **Consumed By:** Host Mobile, Host Web Dashboard, Superadmin Web Dashboard, Public Web / Traveller Mobile (public host summary).
- **Important Architectural Considerations:**
  - Must support diverse host types (small retail shop, hotel, restaurant, travel agency, dedicated storage business, and multi-branch chains like Barista under `FR-44`).
  - A Host cannot publish bookable locations until `FR-17 Host Approval` transitions the host to `APPROVED`.

---

### 3.5 Host Verification (`host-verification`)
- **FRS Traceability:** `FR-16 Identity/Business Verification`, `FR-17 Host Approval`.
- **Primary Responsibility:** Managing the submission, secure storage reference, review queue, and approval/rejection audit trail for host identity (KYC) and business registration documents.
- **What It Owns:** `host_verification_submissions`, `verification_documents` (metadata & Cloudflare R2 object keys), reviewer notes, approval/rejection timestamps, and country-specific verification checklists.
- **What It Does Not Own:** The Host profile itself (`hosts`) or raw object storage infrastructure (`Cloudflare R2` integration adapter).
- **Depends On:** `hosts`, `users` (admin reviewer), `notifications`, `Cloudflare R2`.
- **Consumed By:** Host Mobile, Host Web Dashboard, Superadmin Web Dashboard.
- **Important Architectural Considerations:**
  - Verification requirements vary by country and host type (individual vs. registered company — `OQ-002`).
  - Uploaded KYC documents in Cloudflare R2 must never be publicly accessible; access is strictly via short-lived pre-signed URLs issued only to the owning Host or authorized Platform Admin/Support reviewers.

---

### 3.6 Storage Locations (`locations`)
- **FRS Traceability:** `FR-4 Host Details`, `FR-7 Directions`, `FR-19 Storage Location Setup`, `FR-44 Multiple Locations`.
- **Primary Responsibility:** Managing physical storage location entities belonging to a Host, including address, coordinates, description, photos, available facilities, storage restrictions, and location publication status.
- **What It Owns:** `storage_locations`, `location_addresses` (country-aware), `location_media` (R2 photo references), `location_facilities`, `location_restrictions`, and location-level `IANA` timezone.
- **What It Does Not Own:** Dynamic capacity pools (`capacity`), operating schedules (`availability`), or pricing rules (`pricing`).
- **Depends On:** `hosts`, `geospatial`, `localization`, `Cloudflare R2`.
- **Consumed By:** All client applications.
- **Important Architectural Considerations:**
  - A single Host may own one or many `StorageLocations` (`FR-44`).
  - Supports approximate vs. exact address disclosure rules (`FR -4 Host Details` notes *"Address/approximate location"*, while `FR -7 Directions` navigates to the Host location — see `OQ-012`).

---

### 3.7 Marketplace Discovery (`marketplace`)
- **FRS Traceability:** `FR -2 Location Search`, `FR-3 Map View`, `FR -3 Host Listings`, `FR-4 Filters`, `FR -4 Host Details`.
- **Primary Responsibility:** Orchestrating traveller-facing search, filtering, sorting, map pin aggregation, and listing detail read models across active, approved storage locations.
- **What It Owns:** Read-optimized search query pipelines, filter/sort composition (by distance, price, opening hours, rating, availability, facilities), and public listing projection DTOs.
- **What It Does Not Own:** The underlying source tables for locations (`locations`), capacity (`capacity`), hours (`availability`), pricing (`pricing`), or reviews (`reviews`).
- **Depends On:** `locations`, `geospatial`, `capacity`, `availability`, `pricing`, `reviews`, `localization`.
- **Consumed By:** Traveller Mobile, Public Website.
- **Important Architectural Considerations:**
  - Only returns locations where both the parent `Host` is `APPROVED` (`FR-17`) and the `StorageLocation` is `ACTIVE`.
  - Combines spatial filtering (`geospatial`) with real-time schedule (`availability`) and inventory (`capacity`) checks when a traveller filters by specific drop-off/collection times (`FR-5`).

---

### 3.8 Geospatial Search (`geospatial`)
- **FRS Traceability:** `FR -2 Location Search`, `FR-3 Map View`, `FR-4 Filters` (distance), `FR -7 Directions`.
- **Primary Responsibility:** Providing PostGIS spatial indexing, radius/bounding-box queries, distance calculation, geocoding abstraction, and navigation link generation.
- **What It Owns:** PostGIS spatial query helpers (`ST_DWithin`, `ST_Distance`, bounding-box queries) and the external geocoding/routing provider adapter.
- **What It Does Not Own:** Host business metadata (`locations`) or UI map rendering (`MapLibre` on clients).
- **Depends On:** PostgreSQL + PostGIS, External Map/Geocoding Provider (`OQ-018`).
- **Consumed By:** `locations`, `marketplace`, Traveller Mobile, Public Website, Host Mobile/Web (pin placement).
- **Important Architectural Considerations:**
  - Uses `GEOGRAPHY(Point, 4326)` with `GiST` spatial indexes for accurate meter/kilometer distance queries across any country globally.

---

### 3.9 Capacity Management (`capacity`)
- **FRS Traceability:** `FR-5 Availability Check`, `FR-21 Storage Capacity`, `FR-28 Bag Verification`.
- **Primary Responsibility:** Managing configurable storage inventory models for each location and executing atomic capacity reservations and releases.
- **What It Owns:** `capacity_pools`, `bag_categories` (e.g., small, medium, large, special/oversized), `storage_zones` (e.g., Zone A, Zone B), `capacity_rules` (count-based, category-based, unit-based, zone-based), `capacity_reservations`, and `capacity_adjustments`.
- **What It Does Not Own:** Operating hours (`availability`), pricing (`pricing`), or the booking record itself (`bookings`).
- **Depends On:** `locations`.
- **Consumed By:** `marketplace`, `bookings`, Host Mobile, Host Web Dashboard, Superadmin Dashboard.
- **Important Architectural Considerations:**
  - Must support simple total-bag counts for small shops as well as multi-category and multi-zone pools for larger storage operators without separate code paths (detailed specification in Phase 0B).
  - Temporary capacity reservations created during checkout (`FR-6`) must be atomic, concurrency-safe, and automatically expired by background workers if payment is not completed within the hold window.

---

### 3.10 Availability Management (`availability`)
- **FRS Traceability:** `FR-5 Availability Check`, `FR-20 Opening Hours`, `FR-22 Availability Management`.
- **Primary Responsibility:** Managing location operating schedules and evaluating whether a location can accept a drop-off, store luggage across a period, and release luggage at a requested collection time.
- **What It Owns:** `operating_schedules` (weekly recurring schedules, split shifts), `availability_exceptions` (blocked dates/times, holiday hours, temporary closures, emergency stop-bookings under `FR-22`), and schedule evaluation logic.
- **What It Does Not Own:** Physical bag capacity counts (`capacity`) or pricing (`pricing`).
- **Depends On:** `locations` (specifically the location's `IANA` timezone).
- **Consumed By:** `marketplace`, `bookings`, Host Mobile, Host Web Dashboard.
- **Important Architectural Considerations:**
  - Explicitly distinguishes between (1) general business opening hours, (2) permitted luggage drop-off hours, (3) permitted luggage collection hours, and (4) temporary booking blocks (`FR-20`, `FR-22`).
  - All schedule evaluations are performed in the storage location's local `IANA` timezone while persisting absolute instants in `UTC`.

---

### 3.11 Pricing (`pricing`)
- **FRS Traceability:** `FR -5 Price Calculation`, `FR -13 Promo Codes`, `FR-23 Pricing`, `FR-32 Late Collection Handling`.
- **Primary Responsibility:** Managing host pricing configurations, promotional discount rules, late collection fee formulas, and executing authoritative server-side price calculations.
- **What It Owns:** `pricing_policies` (versioned), pricing rate tables (per bag, hourly, daily, per bag category, duration tiers), `promo_codes` / `campaigns` (`FR -13`), and immutable `price_snapshots`.
- **What It Does Not Own:** Payment processing (`payments`) or commission ledger balances (`finance`).
- **Depends On:** `locations`, `capacity` (bag categories), `localization` (currency).
- **Consumed By:** `marketplace`, `bookings`, `custody` (late fees), Traveller Mobile, Host Mobile, Public Web, Host Web, Superadmin Web.
- **Important Architectural Considerations:**
  - **Server-Authoritative Rule:** Clients never calculate authoritative prices. The `pricing` domain computes the itemized breakdown and persists an immutable `PriceSnapshot` tied to the booking so subsequent host price edits never alter existing bookings.
  - All monetary values are stored in integer minor units (e.g., cents/sata) or fixed-precision decimal alongside an `ISO 4217` currency code (`LKR` initially).

---

### 3.12 Booking Management (`bookings`)
- **FRS Traceability:** `FR-6 Booking`, `FR-7 Booking Confirmation`, `FR-9 Active Booking`, `FR -9 Booking History`, `FR-10 Cancellation`, `FR-24 Booking Dashboard`, `FR-25 Booking Details`, `FR-26 Booking Acceptance` (`Depends`), `FR-31 Mark Booking Complete`, `FR-33 Booking History`, `FR-34 Cancellation Handling`.
- **Primary Responsibility:** Orchestrating the end-to-end reservation lifecycle, state machine transitions, booking policies (instant booking vs. host approval), booking references, and traveller/host cancellation rules.
- **What It Owns:** `booking_policies` (versioned per location), `bookings`, `booking_items` (selected bag counts/categories), `booking_events` (immutable state transition log), and booking reference codes.
- **What It Does Not Own:** Payment gateway communication (`payments`), physical luggage check-in/out records (`custody`), or host balance ledgers (`finance`).
- **Depends On:** `travellers`, `locations`, `capacity`, `availability`, `pricing`, `notifications`.
- **Consumed By:** Traveller Mobile, Host Mobile, Public Web, Host Web Dashboard, Superadmin Web Dashboard.
- **Important Architectural Considerations:**
  - Supports both **Instant Booking** and **Host Approval (`FR-26` — `Depends`)** modes via location-level `BookingPolicy` configuration (subject to `OQ-004`).
  - Enforces a strict state machine (`DRAFT/RESERVED` → `PAYMENT_PENDING` → `AWAITING_HOST_APPROVAL` / `CONFIRMED` → `CHECKED_IN` → `COMPLETED`, plus `CANCELLED`, `REJECTED`, `EXPIRED`, `OVERDUE`, `DISPUTED`).

---

### 3.13 Payments (`payments`)
- **FRS Traceability:** `FR -6 Online Payment`, `FR -10 Refund Status` (`Later/MVP`), `FR-32 Late Collection Handling` (additional charge collection).
- **Primary Responsibility:** Abstracting external payment gateway integrations (initially **PayHere**), initiating checkout sessions, verifying webhook notifications/checksums, handling payment idempotency, and tracking payment and refund execution states.
- **What It Owns:** `payments`, `payment_attempts`, `payment_webhook_events` (raw payload + signature verification log), `refund_requests`, and the `PaymentGatewayPort` interface + `PayHereAdapter`.
- **What It Does Not Own:** Booking state rules (`bookings`) or host commission/payout ledger balances (`finance`).
- **Depends On:** `bookings`, `localization`, External Payment Provider (`PayHere`).
- **Consumed By:** Traveller Mobile, Public Web, Superadmin Web Dashboard, `finance`.
- **Important Architectural Considerations:**
  - PayHere merchant secrets and checksum generation/verification reside strictly on the backend.
  - A booking is never transitioned to paid/confirmed based solely on a client browser/app redirect; server-verified PayHere webhook notification (`notify_url`) is mandatory.
  - Designed with a clean provider interface so future gateways (Stripe, Adyen, etc.) plug in per country without touching `bookings`.

---

### 3.14 Financial Management (`finance`)
- **FRS Traceability:** `FR -10 Refund Status`, `FR-36 Earnings Dashboard`, `FR-37 Payout Management` (manual payout via Superadmin dashboard), `FR-38 Transaction History`.
- **Primary Responsibility:** Managing the platform's internal financial ledger, calculating platform commissions vs. net host earnings, tracking host payable balances, storing host bank/payout beneficiary details, and recording Superadmin manual payouts.
- **What It Owns:** `commission_policies`, `ledger_entries` (immutable append-only financial journal), `host_balances` (pending, available/payable, paid out), `host_payout_accounts` (bank/payment details), and `payouts` (manual payout records, status, external bank reference, admin approver).
- **What It Does Not Own:** External card checkout capture (`payments`) or physical bag custody (`custody`).
- **Depends On:** `bookings`, `payments`, `hosts`, `users` (Superadmin), `notifications`.
- **Consumed By:** Host Mobile, Host Web Dashboard, Superadmin Web Dashboard.
- **Important Architectural Considerations:**
  - Directly implements `FR-37`: *"Bank/payment account and payout status - Will do a manual payout through a superadmin dashboard because of security reasons."*
  - Commercial/regulatory validation of collecting gross funds via PayHere and disbursing net host payouts manually is tracked as critical open item `OQ-003`.

---

### 3.15 Luggage Custody (`custody`)
- **FRS Traceability:** `FR-7 Booking Confirmation` (QR/PIN), `FR-8 Check-in / Bag Drop`, `FR -8 Check-out / Collection`, `FR-27 Check-in Traveller`, `FR-28 Bag Verification`, `FR-29 Check-in Evidence` (`Recommended`), `FR-30 Check-out Verification`, `FR-31 Mark Booking Complete`, `FR-32 Late Collection Handling`.
- **Primary Responsibility:** Managing the physical chain of custody for luggage from drop-off to collection, including cryptographic QR/PIN token verification, physical bag verification, check-in photo/tag evidence capture, overdue detection, and release verification.
- **What It Owns:** `custody_tokens` (hashed PINs and non-sensitive opaque QR identifiers), `luggage_items` / `bag_tags`, `check_in_records`, `custody_evidence` (R2 media references for photos/tags under `FR-29`), `check_out_records`, and `overdue_records` (`FR-32`).
- **What It Does Not Own:** Reservation scheduling (`bookings`) or payment gateway execution (`payments`).
- **Depends On:** `bookings`, `locations`, `pricing` (for overdue fee calculation under `FR-32`), `staff` (when a staff member performs check-in/out), `Cloudflare R2`.
- **Consumed By:** Traveller Mobile, Host Mobile, Public Web, Host Web Dashboard, Superadmin Web Dashboard.
- **Important Architectural Considerations:**
  - **Security:** QR codes contain only opaque random tokens (never PII or raw sequential IDs). PIN verification is server-side and rate-limited against brute-force guessing.
  - **Evidentiary Integrity:** Every check-in (`FR-27`–`FR-29`) and check-out (`FR-30`–`FR-31`) records the exact UTC timestamp, acting user (`Host` or `HostStaff`), verified method (`QR` or `PIN`), and attached photo/tag evidence.

---

### 3.16 Reviews and Ratings (`reviews`)
- **FRS Traceability:** `FR -11 Host Reviews & Ratings`, `FR-12 Leave Review` (*"Rate Host after collection and for app"*), `FR-39 Reviews & Ratings`.
- **Primary Responsibility:** Managing verified post-collection traveller reviews and star ratings for Hosts/StorageLocations, as well as traveller feedback/ratings for the platform application itself.
- **What It Owns:** `location_reviews` (rating, comment, booking reference, moderation status), `app_feedback` (per `FR-12` *"and for app"*), and aggregated location rating summaries.
- **What It Does Not Own:** Customer support dispute resolution (`support`).
- **Depends On:** `bookings` (verifies booking reached `COMPLETED` state before allowing a host review), `travellers`, `hosts`, `locations`.
- **Consumed By:** Traveller Mobile, Host Mobile, Public Web, Host Web Dashboard, Superadmin Web Dashboard.
- **Important Architectural Considerations:**
  - Only travellers who have completed a real booking (`COMPLETED`) at a location can publish a host review (`FR-12`).
  - Separates public Host/Location reviews (`FR -11`, `FR-39`) from internal App Feedback (`FR-12`).

---

### 3.17 Notifications (`notifications`)
- **FRS Traceability:** `FR-11 Notifications` (Traveller), `FR-35 Notifications` (Host).
- **Primary Responsibility:** Managing multi-channel notification dispatch (Push via Expo/FCM/APNs, Email, SMS, and In-App notification centre) and scheduled booking reminders.
- **What It Owns:** `notifications` (in-app inbox records and read status), `push_device_tokens`, `notification_preferences`, `notification_templates` (localized), and delivery logs.
- **What It Does Not Own:** Domain business triggers (emitted by `bookings`, `payments`, `custody`, `host-verification`, etc.).
- **Depends On:** `users`, `localization`, Expo Push API, External Email/SMS Provider (`OQ-019`).
- **Consumed By:** All client applications.
- **Important Architectural Considerations:**
  - Covers Traveller lifecycle alerts (`FR-11`: booking confirmation, drop-off reminder, collection reminder, overdue warning) and Host operational alerts (`FR-35`: new booking request, upcoming arrival, collection due, payout status).

---

### 3.18 Support (`support`)
- **FRS Traceability:** `FR -12 Customer Support` (*"Report issues or contact platform support. Should be seperated"*), `FR-40 Support` (*"Report traveller/booking/luggage issues"*).
- **Primary Responsibility:** Managing structured customer and host support tickets, preserving the FRS requirement that issue reporting and general platform support be cleanly separated.
- **What It Owns:** `support_tickets`, `support_messages`, ticket categories (`BOOKING_ISSUE`, `HOST_LUGGAGE_ISSUE`, `GENERAL_PLATFORM_SUPPORT`, `BILLING_INQUIRY`), and ticket assignment/resolution states.
- **What It Does Not Own:** Formal custody incident investigations (`incidents`) or public host reviews (`reviews`).
- **Depends On:** `users`, `bookings`, `hosts`, `locations`, `notifications`.
- **Consumed By:** Traveller Mobile, Host Mobile, Public Web, Host Web Dashboard, Superadmin Web Dashboard.
- **Important Architectural Considerations:**
  - Explicitly implements the `FR -12` mandate (*"Report issues or contact platform support. Should be seperated"*) and separates Traveller support queues (`FR -12`) from Host issue reporting (`FR-40`).

---

### 3.19 Incident Management (`incidents`)
- **FRS Traceability:** `FR-41 Incident Reporting` (*"Report lost/damaged/unclaimed luggage"*).
- **Primary Responsibility:** Managing high-priority operational and legal incident workflows when luggage is reported lost, damaged, tampered with, or unclaimed past maximum holding thresholds.
- **What It Owns:** `incidents` (severity, category: `LOST`, `DAMAGED`, `UNCLAIMED`, `SECURITY_BREACH`), `incident_evidence` (R2 links), investigation timeline logs, and resolution outcomes.
- **What It Does Not Own:** Standard check-in/out operations (`custody`) or routine support inquiries (`support`).
- **Depends On:** `custody` (locks and links check-in/out evidence from `FR-29`), `bookings`, `hosts`, `locations`, `users` (platform investigators), `Cloudflare R2`.
- **Consumed By:** Host Mobile, Host Web Dashboard, Superadmin Web Dashboard (and Traveller Mobile/Web if linked to a traveller claim).
- **Important Architectural Considerations:**
  - When an incident is opened on a booking, all associated `custody_evidence` (`FR-29`) and `booking_events` are preserved under legal hold (cannot be deleted or overwritten).

---

### 3.20 Host Staff (`staff`)
- **FRS Traceability:** `FR-42 Staff Accounts` (*"Allow employees to handle check-in/out — Later"*).
- **Primary Responsibility:** Managing employee memberships under a Host organization, assigning staff to specific `StorageLocations` (`FR-44`), and scoping their operational permissions (e.g., check-in/out execution).
- **What It Owns:** `host_staff_memberships`, `staff_invitations`, `staff_location_assignments`, and staff role scopes.
- **What It Does Not Own:** Internal platform administrator accounts (`administration`) or core authentication (`identity`).
- **Depends On:** `hosts`, `locations`, `users`, `identity`.
- **Consumed By:** Host Mobile, Host Web Dashboard, Superadmin Web Dashboard.
- **Important Architectural Considerations:**
  - Classified as **`Later`** in the FRS (`FR-42`).
  - In the initial release, all Staff Management UI screens exist in the Host Mobile and Host Web applications (per the UI-complete principle), and the `custody` schema includes an `acted_by_user_id` field so activating `FR-42` in Phase 11 requires zero breaking changes to check-in/out tables.

---

### 3.21 Analytics (`analytics`)
- **FRS Traceability:** `FR-43 Analytics` (*"Occupancy, bookings, revenue, busiest periods etc. — Later"*).
- **Primary Responsibility:** Aggregating and serving time-series and summary metrics for Host dashboards (occupancy rates, booking volume, gross/net revenue, peak hours/days) and Superadmin platform KPIs.
- **What It Owns:** Read-optimized analytical queries, materialized views / daily rollups (when activated).
- **What It Does Not Own:** Transactional booking records (`bookings`) or financial ledger entries (`finance`).
- **Depends On:** `bookings`, `finance`, `capacity`, `locations`.
- **Consumed By:** Host Mobile, Host Web Dashboard, Superadmin Web Dashboard.
- **Important Architectural Considerations:**
  - Host Analytics (`FR-43`) is classified as **`Later`** in the FRS. Initial release includes complete Host Analytics UI screens with clearly labeled preview states, while Superadmin operational KPIs for MVP oversight are served from live transactional aggregates.

---

### 3.22 Administration (`administration`)
- **FRS Traceability:** Cross-cutting platform governance (`FR-10`, `FR-12`, `FR-17`, `FR-37`, `FR-40`, `FR-41`).
- **Primary Responsibility:** Managing platform-level operational controls, internal admin/support staff permissions, system-wide policies, manual overrides, and comprehensive security/admin audit trails.
- **What It Owns:** `platform_staff_roles`, `system_settings`, `admin_audit_logs` (immutable record of every administrative action, approval, payout, refund, or override).
- **What It Does Not Own:** Domain-specific tables owned by `hosts`, `bookings`, or `finance` (it invokes their domain services under admin authorization).
- **Depends On:** `identity`, `users`, `host-verification`, `bookings`, `payments`, `finance`, `support`, `incidents`, `reviews`, `localization`.
- **Consumed By:** Superadmin Web Dashboard (`/admin/*`).
- **Important Architectural Considerations:**
  - Enforces role separation between **Platform Support/Ops Staff** and **Superadmin** (specifically restricting `FR-37` manual payout execution and global commission/system configuration to Superadmin, pending `OQ-011`).

---

### 3.23 Localization (`localization`)
- **FRS Traceability:** `FR-14 Multiple Languages` (`Later`), `FR -14 Multiple Currencies` (`Later`), Global-Ready Architecture Mandate.
- **Primary Responsibility:** Managing supported countries (`ISO 3166-1`), currencies (`ISO 4217`), languages/locales (`BCP 47`), timezones (`IANA`), exchange rate reference tables (for `Later` multi-currency display), and country-specific operational rules.
- **What It Owns:** `supported_countries`, `supported_currencies`, `supported_locales`, `exchange_rates` (`Later`), and country-level legal/tax/verification metadata.
- **What It Does Not Own:** User profile preferences (`users`) or location pricing rules (`pricing`).
- **Depends On:** None (foundational reference domain).
- **Consumed By:** All backend domains and all client applications.
- **Important Architectural Considerations:**
  - While `FR-14 Multiple Languages` and `FR -14 Multiple Currencies` are classified as `Later` in the FRS (initial Sri Lanka launch operates with English `en` and `LKR`), the `localization` domain is established in Phase 0/Phase 1 so no domain hardcodes `LK`, `LKR`, or `Asia/Colombo`.

---

## 4. Implemented Phase A Security Closure & Phase B Transactional Architecture (`0011`–`0014`)

This section records the authoritative as-built implementation across migrations `0011_phase_a_final_security_corrections.sql`, `0012_phase_b_booking_escrow_custody.sql`, `0013_phase_b_custody_hmac_and_payment_integrity.sql`, and `0014_phase_b_refund_evidence_integrity.sql`.

### 4.1 Phase A Final Security Closure (`0011_phase_a_final_security_corrections.sql`)

1. **Identity Assertion Signature Comparison Guarantees & Limitations:**
   - `public.verify_identity_assertion` enforces explicit `keyId` validation and canonical HMAC-SHA256 payload binding (`keyId:actorId:action:targetId:roleCode:expiresAt:nonce`), strict 32-byte (64-hex-character) signature length decoding, and fixed-iteration (32-step) bitwise XOR/OR comparison across decoded `bytea` bytes so SQL execution avoids PostgreSQL `bytea` `<>` (`memcmp`) early-exit short-circuiting.
   - **Honest Cryptographic Scope:** Because PostgreSQL executes PL/pgSQL inside an interpreted SQL runtime with heap allocations, this function **reduces naive string/bytea early-exit leakage** rather than claiming hardware- or C-compiler-level constant-time execution guarantees. Primary defense-in-depth relies on short-lived assertions, per-statement nonce + timestamp freshness bounds (`<= 60s`), fail-closed rejection when no valid `ACTIVE` key is provisioned, and `luggage_role_assigner`-isolated ownership of `public.trusted_auth_secrets` (no direct table access from `PUBLIC` or `luggage_user`).
2. **Multi-Key Identity Secret Provisioning & Zero-Downtime Key Rotation Procedure:**
   - `public.trusted_auth_secrets` tracks explicit key lifecycle states (`ACTIVE`, `RETIRING` with bounded `retires_at`, and `REVOKED`) with a partial unique index enforcing at most one `ACTIVE` key at any instant.
   - Canonical assertion signatures are generated in `apps/api/src/common/crypto/database-identity.ts` and secrets are synchronized at migration time by `syncTrustedAuthSecret` (`apps/api/src/infrastructure/database/migrate.ts`).
   - **Zero-Downtime Rotation Runbook:**
     1. Set `DB_IDENTITY_KEY_ID` + `DB_IDENTITY_SECRET` to the new >=32-character secret and configure `DB_IDENTITY_RETIRING_KEY_ID` + `DB_IDENTITY_RETIRING_SECRET` to the outgoing key, then run `pnpm db:migrate`.
     2. Roll API instances onto the new `DB_IDENTITY_KEY_ID` / `DB_IDENTITY_SECRET` so in-flight assertions signed by the `RETIRING` key continue verifying until `retires_at`.
     3. Clear `DB_IDENTITY_RETIRING_KEY_ID` / `DB_IDENTITY_RETIRING_SECRET` or revoke the retired key once all older workers drain.

### 4.2 Phase B Domain Entities & Forward-Only Migrations (`0012`–`0014`)

Migration `0012` added **15 tables** (bringing `REQUIRED_PUBLIC_TABLES` from `28` to **`43`** entries: **`42`** domain/security tables plus `__drizzle_migrations`, and **`44`** total tables in PostgreSQL `public` schema including PostGIS `spatial_ref_sys`), migration `0013` adds keyed custody hash versioning and the single-active-intent uniqueness invariant, and migration `0014` enforces database-level refund settlement evidence, provenance, and uniqueness invariants:

- **Bookings & Capacity Holds:** `bookings`, `booking_items`, `booking_pricing_snapshots` *(immutable)*, `capacity_reservations`, `booking_status_history` *(immutable)*.
- **Payments, Webhooks & Refunds:** `payment_intents` *(enforcing partial unique index `payment_intents_single_active_per_booking_idx` over `'INITIATED'`, `'PENDING_GATEWAY'`)*, `payment_transactions` *(enforcing `evidence_source`, `manual_reference`, `settled_by_user_id`, unique `payment_transactions_refund_unique_idx`, `payment_transactions_sig_evidence_check`, and `payment_transactions_admin_refund_only_check`)*, `payment_webhook_events`, `refund_records` *(enforcing `settlement_mode`, `manual_reference`, `settled_by_user_id`, unique `refund_records_provider_refund_unique_idx`, and `refund_records_succeeded_evidence_check`)*. *(Refund transitions are recorded via `refund_records` and immutable `security_audit_events`; there is no separate `refund_events` table.)*
- **Non-Escrow Double-Entry Ledger & Host Payables:** `financial_ledger_entries` *(immutable)*, `host_payables`.
- **Physical Counter Custody:** `custody_records`, `custody_tokens` *(versioned via `hash_version` IN `'sha256-legacy-v1' | 'hmac-sha256-v2'`)*, `bag_custody_items`, `custody_events` *(immutable)*.
- **Append-Only SQL Immutability:** `prevent_phase_b_immutable_mutation()` (`BEFORE UPDATE OR DELETE` trigger) and `REVOKE UPDATE, DELETE, TRUNCATE` enforce append-only integrity on `booking_status_history`, `booking_pricing_snapshots`, `financial_ledger_entries`, and `custody_events`.

### 4.3 Booking Lifecycle, Capacity Concurrency & Pricing Snapshots

- **Canonical Global Lock Order & Safe Deadlock/Serialization Retry (`tx-retry.ts`):** All multi-table Phase B transactions acquire row locks strictly in the global hierarchy `storage_capacity_pools (ORDER BY id ASC FOR UPDATE)` -> `bookings (FOR UPDATE)` -> `payment_intents (ORDER BY id ASC FOR UPDATE)` -> `refund_records / custody_records / custody_tokens (ORDER BY id ASC FOR UPDATE)` -> `host_payables / append-only inserts`, wrapped with bounded SQLSTATE `40P01`/`40001` retry ONLY for pure database transactions.
- **State Machine:**
  - `INSTANT` mode: `PENDING_PAYMENT` (10m hold default) -> verified webhook -> `CONFIRMED` -> counter check-in -> `IN_STORAGE` -> counter collection -> `COMPLETED`.
  - `HOST_APPROVAL` mode (`OQ-004`): `PENDING_HOST_APPROVAL` (15m SLA default, no payment captured upfront) -> host accept -> `PENDING_PAYMENT` (10m hold) -> verified webhook -> `CONFIRMED` (or `REJECTED` / `EXPIRED` with immediate capacity release).
  - Cancellation & Exception states: `CANCELLED_BY_TRAVELLER`, `CANCELLED_BY_HOST`, `CANCELLED_BY_PLATFORM`, `EXPIRED`, `DISPUTED`.
- **Cancellation Policy (`OQ-009`):** Customer cancellations evaluate against drop-off time inside `cancelBooking`: `> 2 hours` before scheduled drop-off receives **`100%`**, `<= 2 hours` before scheduled drop-off receives **`50%`**, post-drop-off defaults to **`0%`**, and host/platform cancellations receive **`100%`**.
- **Immutable Pricing Snapshots (`OQ-005`, `OQ-008`, `OQ-010`):** Authoritative quotes and snapshots (`quotation-availability.service.ts`) use `LKR` integer minor units (`currency_exponent = 2`), snapshotting `gross_storage_minor`, `discount_minor`, `storage_subtotal_minor`, `commission_rate_bps` (`1500` default), `platform_commission_minor`, `host_payable_minor`, `tax_rate_bps` (`0` default pending external Sri Lankan tax sign-off), and `total_amount_minor`. Subsequent host rate edits never mutate existing booking snapshots.
- **Privacy Disclosure (`OQ-012`):** `BookingLocationDisclosure` withholds `addressLine1`, `postalCode`, `directionsNotes`, and exact coordinates (`null`, `addressDisclosed: false`) until verified payment moves the booking to `CONFIRMED`, `IN_STORAGE`, `COMPLETED`, or `DISPUTED` (or caller is the owning host/staff/admin).

### 4.4 Payment Provider Boundary, PayHere Integration, Non-Escrow Financial Ledger & Refunds

- **Provider Adapter Port (`payment-gateway.port.ts`):** `PaymentGatewayPort` decouples payment orchestration from gateway wire formats:
  - `SandboxSignedGatewayAdapter` signs/verifies JSON webhooks using `PAYMENT_WEBHOOK_SECRET` (HMAC-SHA256) on `POST /api/v1/payments/webhooks/sandbox` and fails closed when `NODE_ENV=production` or `PAYMENT_PROVIDER=sandbox` is used in production.
  - `PayHereGatewayAdapter` isolates legacy PayHere MD5 checkout `hash` and `notify_url` `md5sig` verification strictly inside private `payHereMd5Upper` methods, emits the complete PayHere checkout form payload (`merchant_id`, `return_url`, `cancel_url`, `notify_url`, `order_id`, `items`, `currency`, `amount`, `first_name`, `last_name`, `email`, `phone`, `address`, `city`, `country`, `hash`, `custom_1`, `custom_2`) using fail-closed validated `PAYHERE_NOTIFY_URL`/`PAYHERE_RETURN_URL`/`PAYHERE_CANCEL_URL` and server-resolved customer billing details, exposes signed server-rendered POST handoff (`GET /api/v1/payments/handoff/:handoffToken` with Fastify `routerOptions.maxParamLength: 512`) plus authoritative status polling (`GET /api/v1/payments/checkout-status`), parses `application/x-www-form-urlencoded` (rejecting duplicate form parameters) and strict flat JSON on `POST /api/v1/payments/webhooks/payhere`, converts decimal amounts without floating point, rejects cross-provider Sandbox <-> PayHere settlement (`409` / `403` on `/sandbox-simulate`), and derives deterministic `payhere_evt_*` replay keys. Commercial live PayHere launch remains gated on external written marketplace settlement approval (`OQ-003`).
- **Payment Intent Race Protection & Idempotency:** `createPaymentIntent` locks `bookings FOR UPDATE` first, evaluates hold expiry against PostgreSQL `NOW()` (committing expired holds before returning `409`), validates `booking_pricing_snapshots`, locks `payment_intents`, enforces the idempotency matrix, and upholds `payment_intents_single_active_per_booking_idx`.
- **Webhook Idempotency & Late-Payment Protection (`payments.service.ts`):** Both adapters converge onto one shared `processGatewayWebhookInternal` pipeline: signatures verify before locking, `(provider, event_id)` deduplicates replays, `(provider, provider_transaction_id)` prevents cross-intent reuse, and late valid `SUCCEEDED` webhooks after hold expiry or cancellation record `ORPHANED_SUCCEEDED` + balanced capture + `100%` `LATE_WEBHOOK_EXPIRED_HOLD` refund + `recordCancellationSettlement` using the booking's snapshotted `commission_rate_bps` without reviving capacity.
- **Honest Non-Escrow Ledger & Refund Evidence Model (`ledger.service.ts`):** The system **does not claim regulated third-party escrow**. It posts bounded 32-bit integer double-entry journal groups (`SUM(DEBIT) = SUM(CREDIT)`) across Gateway Clearing (`1010`), Traveller Booking Liability (`2010`), Host Payable Liability (`2020`), Traveller Refund Liability (`2030`), and Platform Commission Revenue (`4010`). `adminTransitionRefund` never fabricates synthetic `rfnd_*` / `RFD-GW-*` references; transitioning a refund to `SUCCEEDED` requires explicit `settlementMode` (`PROVIDER_CONFIRMED` with gateway `providerRefundId` -> `evidenceSource = 'ADMIN_PROVIDER_ATTESTED'`, or `MANUAL_OFFLINE` with `manualReference` -> `evidenceSource = 'ADMIN_MANUAL_OFFLINE'`), sets `signatureVerified = false` (enforced by PostgreSQL `CHECK` constraints reserving `signatureVerified = true` strictly for `PROVIDER_WEBHOOK`), blocks duplicate provider refund references and over-refunds beyond captured charges (`409`), serializes concurrent transitions under canonical row locking, and supports idempotent status retries.

### 4.5 Custody Credential Security, Staff Scoping & Zero Possessory Lien

- **Keyed Domain-Separated Custody HMACs (`OQ-014`):** `custody-hmac.ts` (`CUSTODY_TOKEN_HMAC_SECRET`, fail-closed startup, distinct from `DB_IDENTITY_SECRET`, `DB_IDENTITY_RETIRING_SECRET`, `PAYMENT_WEBHOOK_SECRET`, and `RATE_LIMIT_HASH_SECRET`) signs 64-hex CSPRNG `qrToken` values and leading-zero-preserving 6-digit `verificationPin` values (`000000`–`999999`) under version `hmac-sha256-v2` bound to `JSON.stringify([version, purpose, bookingId, operation, credential])`, verified via 32-byte `crypto.timingSafeEqual`. Migration `0013` revokes all unconsumed legacy `sha256-legacy-v1` tokens in `custody_tokens` while preserving completed custody history (`custody_records`, `bag_custody_items`, `custody_events`, consumed tokens).
- **Uniform Brute-Force Rate Limiting & Bag Reconciliation:** `POST /api/v1/hosts/custody/verify`, `/custody/:bookingId/check-in`, and `/custody/:bookingId/check-out` enforce identical actor and booking rate limits (`custody_verify_actor`, `custody_verify_booking`) prior to verification, atomically consume single-use tokens in `custody_tokens` under canonical lock order, and require physical bag count to match `expected_bag_count` unless `bagCountExceptionReason` is explicitly recorded.
- **Host Staff Assignment Scoping (`OQ-017`):** `HOST_STAFF` may access bookings and execute counter custody operations strictly for locations with an active `host_staff_assignments` row, and receives `403` on unassigned locations and host financial summary endpoints.
- **Zero Possessory Lien (`OQ-015`):** When collection occurs past `collection_at + 30m` grace period, `completeCollection` records `overdue_minutes` and `overdue_fee_minor` (`handover_condition = 'UNPAID_FEES_PENDING'`) while **unconditionally completing physical baggage release** (`RELEASED_TO_TRAVELLER` / booking `COMPLETED`) with zero silent card charges and zero payment gating.

### 4.6 API Endpoints, Contracts & Verification Commands

- **Shared Contracts (`packages/contracts`):** `src/bookings/index.ts`, `src/payments/index.ts`, `src/custody/index.ts`, `src/finance/index.ts`, and Phase B audit constants in `src/audit/index.ts`.
- **Fastify Routes (`/api/v1`):**
  - Public/Traveller: `GET /availability/search`, `POST /bookings/quote`, `POST /bookings`, `GET /bookings`, `GET /bookings/:bookingId`, `POST /bookings/:bookingId/cancel`, `POST /bookings/:bookingId/exceptions`, `POST /bookings/:bookingId/custody-pass`, `POST /payments/intents`, `GET /payments/handoff/:handoffToken`, `GET /payments/checkout-status`, `POST /payments/intents/:intentId/sandbox-simulate`, `POST /payments/webhooks/sandbox`, `POST /payments/webhooks/payhere`.
  - Host: `GET /hosts/bookings`, `POST /hosts/bookings/:bookingId/{accept,reject,cancel}`, `POST /hosts/custody/verify`, `GET /hosts/custody/:bookingId`, `POST /hosts/custody/:bookingId/{check-in,check-out}`, `GET /hosts/finance/summary`.
  - Admin/Support (`OQ-011`): `GET /admin/bookings`, `POST /admin/bookings/:bookingId/cancel`, `GET /admin/bookings/:bookingId/custody`, `GET /admin/payments/transactions`, `GET /admin/refunds`, `POST /admin/refunds/:refundId/transition`, `GET /admin/finance/ledger`.
- **Verification Commands:**
  - Apply & verify migrations (`43` entries in `REQUIRED_PUBLIC_TABLES`: `42` domain/security tables + `__drizzle_migrations`; `44` total `public` tables including PostGIS `spatial_ref_sys`): `pnpm db:migrate`
  - Full monorepo lint, typecheck, PostgreSQL integration & unit tests, and production builds: `pnpm verify`


