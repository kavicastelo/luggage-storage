# Business Rules and Validation Catalogue

**Document Title:** Business Rules and Validation Catalogue  
**Project:** Global Luggage Storage Marketplace  
**Phase:** Phase 0B — Requirements Normalization & Traceability  
**Document Status:** Complete Authoritative Baseline  
**Source Document:** `docs/product/source/luggage-storage-frs.pdf`  
**Related Documents:**
- [Normalized Functional Requirements Specification](functional-requirements.md)
- [Requirements Traceability Matrix](requirements-traceability-matrix.md)
- [Workflow and Use-Case Inventory](workflow-inventory.md)
- [Assumptions and Open Questions Register](assumptions-and-open-questions.md)

---

## 1. Catalogue Overview & Structure

This catalogue defines the authoritative business rules, domain invariants, data validation constraints, and operational policies governing the **Global Luggage Storage Marketplace**.

### 1.1 Category Structure
The rules are organized across 16 domain capability groups:

1. Identity & Authorization (`BR-001`–`BR-006`)
2. Listings & Locations (`BR-007`–`BR-015`)
3. Availability & Schedules (`BR-016`, `BR-062`, `BR-064`, `BR-065`)
4. Capacity & Bag Inventory (`BR-017`, `BR-018`, `BR-063`)
5. Pricing & Promotions (`BR-020`, `BR-021`, `BR-050`, `BR-051`, `BR-066`)
6. Booking Engine & Lifecycle (`BR-023`, `BR-024`, `BR-036`, `BR-037`, `BR-067`–`BR-070`)
7. Payments & Webhooks (`BR-025`–`BR-028`)
8. Custody Verification & Evidence (`BR-029`, `BR-030`, `BR-032`–`BR-035`, `BR-071`–`BR-077`)
9. Late Collection & Overdue Operations (`BR-078`, `BR-079`)
10. Cancellations & Refunds (`BR-038`–`BR-041`, `BR-081`, `BR-082`)
11. Reviews & Ratings (`BR-044`–`BR-046`, `BR-090`)
12. Customer Support & Incidents (`BR-047`, `BR-048`, `BR-091`–`BR-093`)
13. Host Verification & Onboarding (`BR-054`–`BR-060`)
14. Host Staff Operations (`BR-094`, `BR-095`)
15. Multi-Location Fleets & Host Archetypes (`BR-097`, `BR-098`)
16. Financial Operations, Administration & Auditability (`BR-042`, `BR-052`, `BR-053`, `BR-083`–`BR-089`, `BR-096`, `BR-099`, `BR-100`)

---

## 2. Business Rules Register

---

### Category 1: Identity & Authorization

#### `BR-001` — Registration Identity Verification
- **Category:** User & Identity Rules
- **Rule Statement:** Users must register with a valid email address and secure password. The system uses self-managed authentication in the Fastify modular monolith with PostgreSQL user records (`OQ-001`). Email verification links must be fulfilled before accessing sensitive account actions.
- **Enforcement Level:** Mandatory (Server-side validation)
- **Error Condition / Message:** `INVALID_EMAIL_FORMAT`, `EMAIL_ALREADY_REGISTERED`, `EMAIL_UNVERIFIED`.
- **Related Requirements:** `REQ-TRV-001`, `REQ-HST-001`, `OQ-001`.

### `BR-002` — Unified Identity with Distinct Role Contexts
- **Description:** A single email or OAuth identity corresponds to exactly one `User` record in PostgreSQL. The user may hold attached `TravellerProfile`, `HostMembership`, or `AdminRole` records without creating duplicate accounts.
- **Origin:** `IMPLIED` (Approved architectural direction in `OQ-007`).
- **Related Requirements:** `REQ-TRV-001`, `REQ-TRV-002`, `REQ-HST-001`, `REQ-HST-004`.
- **Applicable Actors:** Traveller, Host Owner.
- **Surfaces:** All surfaces.
- **Validation Behavior:** Unique constraint on `users.email`; role contexts checked dynamically via JWT claims.
- **Severity / Impact:** **High** (Data Architecture & Account Hygiene).
- **Unresolved Decisions:** Specific registration, account recovery, and role-merging workflows remain to be finalized.

#### `BR-003` — Authentication Session Lifecycle & Security
- **Category:** User & Identity Rules
- **Rule Statement:** The system enforces self-managed session security (`OQ-001`). Web clients use secure `HTTP-only`, `SameSite=Lax/Strict` cookies; mobile clients store session credentials in platform-appropriate secure storage (`expo-secure-store`). Password credentials are hashed using Argon2id. Sessions issue short-lived access credentials and securely rotated refresh tokens. Social login is optional and deferred until core authentication flows are stable, utilizing standard OAuth/OIDC interfaces.
- **Enforcement Level:** Mandatory (Cryptographic enforcement & middleware guards)
- **Error Condition / Message:** `SESSION_EXPIRED`, `INVALID_TOKEN_SIGNATURE`, `REFRESH_REUSE_DETECTED`.
- **Related Requirements:** `REQ-TRV-001`, `REQ-HST-001`, `OQ-001`.

### `BR-004` — Multi-Factor Authentication for Administrative Personnel
- **Description:** Internal Platform Superadministrator (`ACT-05`) and Platform Support Staff (`ACT-04`) accounts must enforce time-based one-time password (TOTP) multi-factor authentication before accessing `/admin/*` routes or executing administrative mutations.
- **Origin:** `IMPLIED` (Required by `FR-17`, `FR-37`, `ADR-001`).
- **Related Requirements:** `REQ-HST-003`, `REQ-HST-023`, `REQ-IMPL-014`.
- **Applicable Actors:** Platform Support Staff, Superadmin.
- **Surfaces:** `AD`, `API`.
- **Validation Behavior:** Requests to `/api/v1/admin/*` require an `mfa_verified: true` JWT claim.
- **Severity / Impact:** **Critical** (Platform Governance & Financial Safety).
- **Unresolved Decisions:** None.

#### `BR-005` — International E.164 Phone Normalization
- **Description:** All customer and partner contact phone numbers must be validated and stored in international E.164 format (e.g., `+94771234567` for Sri Lanka).
- **Origin:** `IMPLIED` (Approved in `ADR-010` & `FR-2`, `FR-18`).
- **Related Requirements:** `REQ-TRV-002`, `REQ-HST-004`.
- **Applicable Actors:** Traveller, Host.
- **Surfaces:** All surfaces.
- **Validation Behavior:** Phone input formatted using libphonenumber-js in `@luggage/validation`; invalid country prefixes rejected.
- **Severity / Impact:** **Medium** (Notification Delivery & Global Readiness).
- **Unresolved Decisions:** SMS verification requirement pending (`OQ-020`).

#### `BR-006` — Strict Tenant Isolation by Resource Ownership
- **Description:** A Host can only view, configure, or mutate resources explicitly belonging to their `host_id`. Manipulating IDs in API requests to view another host's bookings, earnings, or locations is strictly forbidden.
- **Origin:** `IMPLIED` (Required by Multi-Tenant Architecture).
- **Related Requirements:** All Host Requirements (`REQ-HST-001`–`030`).
- **Applicable Actors:** Host Owner, Host Staff.
- **Surfaces:** `HM`, `HD`, `API`.
- **Validation Behavior:** All database queries append `WHERE host_id = :authenticatedHostId`; mismatches return 404/403.
- **Severity / Impact:** **Critical** (Data Privacy & Security).
- **Unresolved Decisions:** None.

---

### Category 2: Listings, Locations & Discovery

#### `BR-007` — Host Approval Requirement for Public Visibility
- **Description:** A storage location shall not appear in public marketplace search, map views, or listing directories unless its parent Host organization is in `APPROVED` status and the location status is `ACTIVE`.
- **Origin:** `EXPLICIT` (Directly stated in FRS `FR-17 Host Approval`).
- **Related Requirements:** `REQ-TRV-003`, `REQ-TRV-005`, `REQ-HST-003`.
- **Applicable Actors:** Guest Visitor, Traveller, Host.
- **Surfaces:** `TM`, `PW`, `API`.
- **Validation Behavior:** Public search queries enforce `hosts.status = 'APPROVED' AND storage_locations.status = 'ACTIVE'`.
- **Severity / Impact:** **Critical** (Supply Curation & Trust).
- **Unresolved Decisions:** None.

#### `BR-008` — Spherical Geospatial Search Distance
- **Description:** Geographic proximity searches must calculate true great-circle distance on the WGS 84 ellipsoid using PostGIS `ST_Distance(geography, geography)` and filter using `ST_DWithin`. Planar Euclidean approximations are prohibited.
- **Origin:** `IMPLIED` (Required by `FR -2 Location Search` & `ADR-005`).
- **Related Requirements:** `REQ-TRV-003`, `REQ-TRV-006`.
- **Applicable Actors:** Guest Visitor, Traveller.
- **Surfaces:** `API`.
- **Validation Behavior:** Distance queries return exact meters converted to kilometers/miles based on locale.
- **Severity / Impact:** **High** (Search Accuracy).
- **Unresolved Decisions:** None.

#### `BR-009` — Geospatial Bounding Box Limits
- **Description:** Map viewport queries must restrict the search bounding box to a maximum geographic span (e.g., maximum diagonal of 50 km) to prevent performance degradation from global unconstrained viewport requests.
- **Origin:** `IMPLIED` (Required for Map Performance).
- **Related Requirements:** `REQ-TRV-004`.
- **Applicable Actors:** Guest Visitor, Traveller.
- **Surfaces:** `TM`, `PW`, `API`.
- **Validation Behavior:** Viewports exceeding the maximum threshold trigger automated clustering or zoom-in prompts.
- **Severity / Impact:** **Medium** (API Performance & DDoS protection).
- **Unresolved Decisions:** None.

#### `BR-010` — Storage Address Privacy Masking & Location Disclosure
- **Category:** Search & Discovery Rules
- **Rule Statement:** Storage location addresses must be masked during public search and listing discovery (`OQ-012`). Public maps and discovery views display only an approximate area or generalized neighborhood context. The exact street address is disclosed exclusively to the traveller who holds a `CONFIRMED` booking. Hosts may configure stricter privacy behavior, but cannot weaken the platform baseline without explicit approval.
- **Pending Decision Details:** The specific geographic jitter radius and the post-confirmation disclosure of exact storefront business name, entrance photos, and host contact phone number are classified as **Proposed Policies Pending Product Owner Approval** (`OQ-012`).
- **Enforcement Level:** Mandatory (Server-side serializer masking)
- **Error Condition / Message:** `UNAUTHORIZED_ADDRESS_DISCLOSURE_PREVENTED`.
- **Related Requirements:** `REQ-TRV-004`, `REQ-TRV-007`, `REQ-TRV-013`, `OQ-012`.

### `BR-011` — Address Unmasking upon Confirmed Booking (Proposed Default)
- **Description:** The exact storefront business name, complete street address, verified GPS coordinates, host contact phone number, and entrance photos shall be revealed to the traveller if and only if the booking status is `CONFIRMED` or subsequent active states, under the proposed default address privacy policy.
- **Origin:** `EXPLICIT` (FRS `FR -4 Host Details` vs `FR -7 Directions`; proposed policy under `OQ-012`).
- **Related Requirements:** `REQ-TRV-007`, `REQ-TRV-012`, `REQ-TRV-013`.
- **Applicable Actors:** Traveller.
- **Surfaces:** `TM`, `PW`, `API`.
- **Validation Behavior:** Booking details API endpoint verifies `booking.status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED')` before returning unmasked address attributes.
- **Severity / Impact:** **High** (Commercial & Operational Rule).
- **Unresolved Decisions:** Pending owner decision on whether exact address is masked until booking confirmation (`OQ-012`).

#### `BR-031` — External Navigation Handoff & Storefront Guidance
- **Description:** When an authenticated traveller with a confirmed booking requests navigation directions, the platform dispatches verified latitude/longitude coordinates to external native navigation applications (Google Maps, Apple Maps, Waze) and renders host storefront entrance photos to guide arrival.
- **Origin:** `EXPLICIT` (FRS `FR -7 Directions`).
- **Related Requirements:** `REQ-TRV-013`.
- **Applicable Actors:** Traveller.
- **Surfaces:** `TM`, `PW`, `API`.
- **Validation Behavior:** Deep-link intent contains exact coordinates; unmasked entrance photos are served via signed or CDN URLs.
- **Severity / Impact:** **Medium** (Traveller Wayfinding).
- **Unresolved Decisions:** None.

#### `BR-049` — Favourite Host Scope & Availability Reflection
- **Description:** Storage locations bookmarked as favourites by a traveller are scoped to the traveller's user identity, synchronized across devices, and dynamically display live availability and active listing status.
- **Origin:** `EXPLICIT` (FRS `FR-13 Favourite Hosts`).
- **Related Requirements:** `REQ-TRV-024`.
- **Applicable Actors:** Traveller.
- **Surfaces:** `TM`, `PW`, `API`.
- **Validation Behavior:** Favourites query joins active storage location records; inactive or deleted locations are filtered or flagged.
- **Severity / Impact:** **Low** (Personalization UX).
- **Unresolved Decisions:** Backend sync deferred to Phase 11 (`FR-13 Later`).

#### `BR-061` — Storage Location Geocoding & Boundary Validation
- **Description:** When creating or editing a storage location, the physical coordinates must be verified to fall within an active, supported country boundary (initially Sri Lanka) and must include street address, city, administrative area, postal code, and an authoritative IANA timezone.
- **Origin:** `EXPLICIT` (FRS `FR-19 Storage Location Setup` & `ADR-010`).
- **Related Requirements:** `REQ-HST-005`.
- **Applicable Actors:** Host Owner.
- **Surfaces:** `HM`, `HD`, `API`.
- **Validation Behavior:** Coordinates checked against PostGIS country boundary polygon; missing timezone or invalid postal code rejected.
- **Severity / Impact:** **High** (Location Data Integrity).
- **Unresolved Decisions:** None.

#### `BR-012` — Multi-Criteria Filter Conjunction (AND Logic)
- **Description:** When a user applies multiple marketplace filters (e.g., Distance <= 3 km, Rating >= 4.0, Open Now, CCTV), a storage location must satisfy all selected criteria simultaneously to be returned in search results.
- **Origin:** `IMPLIED` (Standard marketplace filter semantics for `FR-4 Filters`).
- **Related Requirements:** `REQ-TRV-006`.
- **Applicable Actors:** Guest Visitor, Traveller.
- **Surfaces:** `TM`, `PW`, `API`.
- **Validation Behavior:** SQL `WHERE` clauses combine filter conditions with `AND`.
- **Severity / Impact:** **Medium** (Search Precision).
- **Unresolved Decisions:** None.

#### `BR-013` — Rating Filter Boundary
- **Description:** Storage locations without any verified reviews (new listings) shall not be excluded when a traveller applies a rating filter unless the traveller explicitly selects "Rated Listings Only". New listings display a "New Host" badge.
- **Origin:** `IMPLIED` (Cold-start marketplace protection for `FR-4`, `FR -11`).
- **Related Requirements:** `REQ-TRV-006`, `REQ-TRV-021`.
- **Applicable Actors:** Guest Visitor, Traveller, Host.
- **Surfaces:** `TM`, `PW`, `API`.
- **Validation Behavior:** Filter treats `review_count = 0` as neutral or eligible depending on explicit user filter toggle.
- **Severity / Impact:** **Low** (Partner Onboarding).
- **Unresolved Decisions:** None.

#### `BR-014` — Minimum Location Photo Requirements
- **Description:** A storage location must have at least two approved photographs (one exterior storefront photo to aid traveller navigation and one clean interior storage area photo) before it can be submitted for review or activated.
- **Origin:** `IMPLIED` (Required by `FR-4 Host Details` & `FR-19 Storage Location Setup`).
- **Related Requirements:** `REQ-TRV-007`, `REQ-HST-005`.
- **Applicable Actors:** Host Owner, Superadmin.
- **Surfaces:** `HM`, `HD`, `AD`, `API`.
- **Validation Behavior:** Location activation endpoint validates `COUNT(location_media) >= 2`.
- **Severity / Impact:** **Medium** (Listing Quality).
- **Unresolved Decisions:** None.

#### `BR-015` — Mandatory Security & Facility Declarations
- **Description:** Every storage location must explicitly declare whether it provides CCTV surveillance, dedicated locked storage rooms, staff presence, and elevator accessibility. Leaving security declarations undefined is prohibited.
- **Origin:** `EXPLICIT` (FRS `FR -4 Host Details`, `FR-19 Storage Location Setup`).
- **Related Requirements:** `REQ-TRV-007`, `REQ-HST-005`.
- **Applicable Actors:** Host Owner.
- **Surfaces:** `HM`, `HD`, `API`.
- **Validation Behavior:** Zod schema enforces non-nullable boolean flags for required facility categories.
- **Severity / Impact:** **Medium** (Customer Safety & Trust).
- **Unresolved Decisions:** None.

---

### Category 3: Availability & Schedules

#### `BR-016` — Standardized Bag Categories & Constraints
- **Category:** Availability & Scheduling Rules
- **Rule Statement:** The platform standardizes on four initial bag categories (`OQ-006`): (1) `SMALL` (handbags, small backpacks, personal bags); (2) `MEDIUM` (standard backpacks, cabin-sized luggage); (3) `LARGE` (standard checked luggage); and (4) `OVERSIZED` (unusually large, heavy, or non-standard items such as surfboards, golf bags, and instruments). Category definitions and guidelines are configurable at platform level. Hosts may enable or disable specific categories per storage location.
- **Enforcement Level:** Mandatory (Server-side validation)
- **Error Condition / Message:** `INVALID_BAG_CATEGORY`, `BAG_CATEGORY_DISABLED_FOR_LOCATION`.
- **Related Requirements:** `REQ-TRV-008`, `REQ-HST-007`, `OQ-006`.

### `BR-062` — Shift Chronology & Non-Overlapping Intervals
- **Description:** Operating hours intervals for any given day must satisfy `open_time < close_time`. Multiple shifts on the same day (e.g., morning and evening split shifts) must not overlap.
- **Origin:** `IMPLIED` (Required by `FR-20 Opening Hours`).
- **Related Requirements:** `REQ-HST-006`.
- **Applicable Actors:** Host Owner.
- **Surfaces:** `HM`, `HD`, `API`.
- **Validation Behavior:** Schema validation rejects interval if `open_time >= close_time` or if shift interval A intersects shift interval B.
- **Severity / Impact:** **Medium** (Schedule Integrity).
- **Unresolved Decisions:** None.

#### `BR-064` — Precedence of Blackout Exceptions over Weekly Schedules
- **Description:** Specific availability exceptions (date blocks, holiday closures) override standard weekly recurring operating hours for the specified location and date range.
- **Origin:** `EXPLICIT` (FRS `FR-22 Availability Management`).
- **Related Requirements:** `REQ-HST-008`, `REQ-TRV-008`.
- **Applicable Actors:** Host Owner, Traveller.
- **Surfaces:** All surfaces.
- **Validation Behavior:** Availability engine checks `availability_exceptions` table before checking recurring weekly schedules.
- **Severity / Impact:** **High** (Prevents bookings on closed dates).
- **Unresolved Decisions:** None.

#### `BR-065` — Immediate Effect of Emergency Stop-Bookings
- **Description:** When a host activates "Stop Bookings" on a location, the location must immediately cease to appear as bookable for new checkouts. Existing confirmed bookings remain active and must be honored by the host.
- **Origin:** `EXPLICIT` (FRS `FR-22 Availability Management`).
- **Related Requirements:** `REQ-HST-008`, `REQ-TRV-010`.
- **Applicable Actors:** Host Owner, Traveller.
- **Surfaces:** `HM`, `HD`, `API`.
- **Validation Behavior:** Location record updates `is_booking_paused = TRUE`; booking creation endpoint rejects requests with 409 Conflict.
- **Severity / Impact:** **High** (Host Store Capacity Management).
- **Unresolved Decisions:** None.

---

### Category 4: Capacity & Bag Inventory

#### `BR-017` — Capacity Pool Conservation Invariant
- **Description:** For any storage location and point in time $t$, the sum of unreserved capacity, active temporary holds, and checked-in bags shall never exceed total configured capacity:
  $$\text{Capacity}_{\text{unreserved}}(t) + \text{Capacity}_{\text{holds}}(t) + \text{Capacity}_{\text{checked\_in}}(t) = \text{Capacity}_{\text{total}}$$
- **Origin:** `IMPLIED` (Required by `FR-5 Availability Check` & `FR-21 Storage Capacity`).
- **Related Requirements:** `REQ-TRV-008`, `REQ-HST-007`.
- **Applicable Actors:** Traveller, Host.
- **Surfaces:** `API`.
- **Validation Behavior:** Database check constraints and atomic transaction logic enforce that unreserved capacity can never drop below zero.
- **Severity / Impact:** **Critical** (Prevents physical space overbooking).
- **Unresolved Decisions:** Standardized bag category definitions pending (`OQ-006`).

#### `BR-018` — Oversized Luggage Restriction Enforcement
- **Category:** Availability & Scheduling Rules
- **Rule Statement:** Items classified as `OVERSIZED` must only be bookable at storage locations that have explicitly opted in and enabled oversized item handling (`OQ-006`). Locations without oversized capacity enabled must be excluded from search results when oversized bags are selected.
- **Enforcement Level:** Mandatory (Search query filter & checkout validation)
- **Error Condition / Message:** `OVERSIZED_ITEMS_NOT_ACCEPTED_AT_LOCATION`.
- **Related Requirements:** `REQ-TRV-008`, `REQ-HST-007`, `OQ-006`.

### `BR-019` — Minimum & Maximum Storage Duration Constraints
- **Description:** Bookings must satisfy the host's configured minimum duration (e.g., minimum 1 hour or 1 day) and maximum allowable duration (e.g., maximum 30 days). Availability check must reject schedules violating these bounds.
- **Origin:** `IMPLIED` (Required by `FR-5 Availability Check`).
- **Related Requirements:** `REQ-TRV-008`.
- **Applicable Actors:** Traveller, Host.
- **Surfaces:** `TM`, `PW`, `API`.
- **Validation Behavior:** Calculated duration checked against `booking_policies.min_duration` and `max_duration`.
- **Severity / Impact:** **Medium** (Operational Feasibility).
- **Unresolved Decisions:** Standard platform default min/max duration bounds configuration.

#### `BR-063` — Capacity Model Integrity
- **Description:** A storage location must implement exactly one active capacity measurement model: either (A) Simple Total Count, (B) Bag Category Limits, or (C) Storage Zone Units. Switching models requires that no conflicting active reservations exist.
- **Origin:** `IMPLIED` (Required by `FR-21 Storage Capacity`).
- **Related Requirements:** `REQ-HST-007`.
- **Applicable Actors:** Host Owner.
- **Surfaces:** `HM`, `HD`, `API`.
- **Validation Behavior:** Model switch endpoint validates that all current bookings can be mapped cleanly to the new model.
- **Severity / Impact:** **Medium** (Inventory Configuration).
- **Unresolved Decisions:** Exact bag categories pending (`OQ-006`).

---

### Category 5: Pricing, Promotions & Monetary Precision

#### `BR-020` — Platform Commission Calculation
- **Category:** Pricing, Discounts & Promotions Rules
- **Rule Statement:** Platform commission starts at a baseline of **15%** (`OQ-005`). Commission is calculated strictly against the eligible storage service subtotal, excluding statutory taxes. Host-funded discounts are applied before commission calculation. Payment processing fees are absorbed within platform operating costs and platform commission (not deducted from host payouts in the initial commercial model). Commission policies are stored with effective dates and snapshotted per booking.
- **Enforcement Level:** Mandatory (Ledger calculation invariant)
- **Error Condition / Message:** `COMMISSION_CALCULATION_MISMATCH`.
- **Related Requirements:** `REQ-TRV-009`, `REQ-HST-009`, `REQ-HST-022`, `OQ-005`.

### `BR-021` — Promotional Discount Funding Separation
- **Category:** Pricing, Discounts & Promotions Rules
- **Rule Statement:** Promotional discounts must have explicitly recorded funding ownership (`OQ-005`): (1) Platform-funded promotions are absorbed entirely by the platform and must never reduce the host's agreed payout; (2) Host-funded promotions reduce the eligible host service subtotal before commission calculation; (3) Mixed promotions must explicitly record the separate funding contribution of each party.
- **Enforcement Level:** Mandatory (Pricing engine calculation)
- **Error Condition / Message:** `INVALID_PROMO_FUNDING_MODEL`.
- **Related Requirements:** `REQ-TRV-025`, `REQ-HST-009`, `REQ-IMPL-003`, `OQ-005`.

### `BR-022` — Transparent Line Item Disclosure & Price Breakdown Snapshot
- **Description:** The system must display a fully itemized price breakdown (base storage charge, duration tier, bag count multiplier, platform service fees, taxes, and promotional discounts) prior to payment initiation, and persist this breakdown in the booking price snapshot.
- **Origin:** `EXPLICIT` (FRS `FR -5 Price Calculation`).
- **Related Requirements:** `REQ-TRV-009`, `REQ-IMPL-003`.
- **Applicable Actors:** Traveller.
- **Surfaces:** `TM`, `PW`, `API`.
- **Validation Behavior:** Price quote returns structured itemized lines; zero hidden charges.
- **Severity / Impact:** **High** (Consumer Transparency).
- **Unresolved Decisions:** None.

#### `BR-050` — Promo Code Server Validation & Usage Caps
- **Description:** Promo codes must be validated on the backend against active dates, usage count caps, minimum booking values, and single-use per traveller rules. Expired or exhausted codes must be rejected.
- **Origin:** `EXPLICIT` (FRS `FR -13 Promo Codes`).
- **Related Requirements:** `REQ-TRV-025`.
- **Applicable Actors:** Traveller.
- **Surfaces:** `TM`, `PW`, `API`.
- **Validation Behavior:** Booking creation checks `promo_codes.current_uses < promo_codes.max_uses`; increments atomically upon confirmed payment.
- **Severity / Impact:** **Medium** (Marketing Spend Control).
- **Unresolved Decisions:** Promo code funding (platform vs host) pending (`OQ-005`).

#### `BR-051` — Non-Negative Booking Total Invariant
- **Description:** Promotional discounts, vouchers, or credits shall never reduce a booking total below zero. If discount exceeds gross price, total payable is clamped to zero (or platform minimum checkout floor).
- **Origin:** `IMPLIED` (Accounting Invariant).
- **Related Requirements:** `REQ-TRV-009`, `REQ-TRV-025`.
- **Applicable Actors:** Traveller.
- **Surfaces:** `API`.
- **Validation Behavior:** `final_amount = MAX(0, calculated_subtotal - discount_amount + platform_fee)`.
- **Severity / Impact:** **High** (Financial Integrity).
- **Unresolved Decisions:** None.

#### `BR-066` — Immutable Price Snapshot on Booking Confirmation
- **Description:** When a booking is confirmed, the calculated pricing breakdown must be frozen into an immutable `PriceSnapshot` record. Subsequent changes to host daily rates or platform fee percentages shall never alter existing bookings.
- **Origin:** `IMPLIED` (Required by `REQ-IMPL-003`).
- **Related Requirements:** `REQ-TRV-009`, `REQ-HST-009`, `REQ-IMPL-003`.
- **Applicable Actors:** Traveller, Host.
- **Surfaces:** `API`.
- **Validation Behavior:** `price_snapshots` table records exact line items; foreign-keyed to booking with no `UPDATE` allowed.
- **Severity / Impact:** **High** (Contractual Certainty).
- **Unresolved Decisions:** None.

---

### Category 6: Booking Engine & Lifecycle

#### `BR-023` — Booking Mode Configuration Hierarchy
- **Category:** Pricing, Discounts & Promotions Rules
- **Rule Statement:** The platform supports both `INSTANT` and `HOST_APPROVAL` booking modes, configurable per storage location (`OQ-004`). Hierarchy: Platform defines capabilities -> Host account defines default setting -> Storage location may override default -> Existing confirmed bookings retain their original policy snapshot.
- **Enforcement Level:** Mandatory (Runtime configuration hierarchy)
- **Error Condition / Message:** `UNSUPPORTED_BOOKING_MODE`.
- **Related Requirements:** `REQ-TRV-010`, `REQ-HST-012`, `OQ-004`.

### `BR-024` — Temporary Capacity Hold Duration
- **Description:** When a traveller initiates checkout, the capacity reservation hold is valid for exactly 15 minutes. If payment confirmation webhook is not received within 15 minutes, the hold is marked `EXPIRED` and released.
- **Origin:** `IMPLIED` (Required by `REQ-IMPL-004`).
- **Related Requirements:** `REQ-TRV-010`, `REQ-IMPL-004`.
- **Applicable Actors:** Traveller, Background Worker.
- **Surfaces:** `API`.
- **Validation Behavior:** Background worker checks `expires_at < NOW() AND status = 'HOLD'`.
- **Severity / Impact:** **High** (Prevents inventory lockup).
- **Unresolved Decisions:** None.

#### `BR-036` — Seven-Stage Refund Lifecycle & Provider Execution
- **Category:** Cancellation & Refund Rules
- **Rule Statement:** Refund initiation and completion are strictly modeled as separate operational states (`OQ-009`, `OQ-013`). A refund is never marked completed upon request submission. The domain engine enforces a **7-stage explicit lifecycle**:
  1. `REQUESTED`: Refund request created by cancellation, dispute, or system trigger.
  2. `AUTHORIZED`: Refund approved under policy tiers or Superadmin override (or `REJECTED`).
  3. `INITIATED`: Refund payload dispatched to payment gateway port.
  4. `PROCESSING`: Gateway acknowledged receipt; awaiting settlement confirmation.
  5. `SUCCEEDED`: Gateway confirmed funds successfully returned to traveller.
  6. `FAILED`: Gateway rejected refund (e.g. gateway error, card expired).
  7. `MANUAL_REVIEW_REQUIRED`: Discrepancy, gateway rejection, or reconciliation mismatch requiring Superadmin operational intervention.
  Processing occurs behind the payment-provider abstraction (`PaymentGatewayPort`). Technical provider capabilities and fee treatments remain an external verification gate (`OQ-013`).
- **Enforcement Level:** Mandatory (State machine transition guard)
- **Error Condition / Message:** `PREMATURE_REFUND_COMPLETION_REJECTED`, `INVALID_REFUND_TRANSITION`.
- **Related Requirements:** `REQ-TRV-019`, `REQ-IMPL-008`, `OQ-009`, `OQ-013`.

### `BR-037` — Historical Booking Immutability
- **Description:** Bookings in terminal states (`COMPLETED`, `CANCELLED`, `REJECTED`, `EXPIRED`) are permanently immutable. No operational check-in, check-out, or schedule modification may be performed on terminal bookings.
- **Origin:** `IMPLIED` (Audit & Consistency Rule).
- **Related Requirements:** `REQ-TRV-017`, `REQ-HST-019`.
- **Applicable Actors:** All Actors.
- **Surfaces:** `API`.
- **Validation Behavior:** State machine blocks transitions out of terminal states.
- **Severity / Impact:** **High** (Audit Trail Integrity).
- **Unresolved Decisions:** None.

#### `BR-067` — Operational Dashboard Scoping
- **Description:** Host operational dashboards must strictly scope metrics to the current business day (00:00 to 23:59:59 in the location's local timezone), clearly differentiating today's expected drop-offs from future reservations.
- **Origin:** `EXPLICIT` (FRS `FR-24 Booking Dashboard`).
- **Related Requirements:** `REQ-HST-010`.
- **Applicable Actors:** Host Owner, Host Staff.
- **Surfaces:** `HM`, `HD`, `API`.
- **Validation Behavior:** Dashboard query groups bookings by local date calculation.
- **Severity / Impact:** **Medium** (Operational Clarity).
- **Unresolved Decisions:** None.

#### `BR-068` — Traveller Contact Information Disclosure Rules
- **Description:** The host shall have access to the traveller's name and contact phone number only for confirmed or checked-in bookings, strictly for operational handoff and emergency collection communication.
- **Origin:** `EXPLICIT` (FRS `FR-25 Booking Details`).
- **Related Requirements:** `REQ-HST-011`.
- **Applicable Actors:** Host Owner, Host Staff.
- **Surfaces:** `HM`, `HD`, `API`.
- **Validation Behavior:** Phone numbers masked on unconfirmed or completed booking views where communication is no longer required.
- **Severity / Impact:** **High** (Traveller Privacy).
- **Unresolved Decisions:** None.

#### `BR-069` — Host Approval SLA Timeout
- **Category:** Host Booking Acceptance Rules
- **Rule Statement:** Locations operating under `HOST_APPROVAL` enforce an initial default host response SLA of **15 minutes** (`OQ-004`). If the host fails to accept or reject within this window, the request expires automatically and the capacity reservation hold is released. No payment is captured during the request phase.
- **Enforcement Level:** Mandatory (Background timer worker)
- **Error Condition / Message:** `HOST_APPROVAL_SLA_EXPIRED`.
- **Related Requirements:** `REQ-HST-012`, `REQ-IMPL-004`, `OQ-004`.

### `BR-070` — Traveller Post-Approval Payment SLA
- **Category:** Host Booking Acceptance Rules
- **Rule Statement:** Upon host acceptance of a booking request, the traveller is issued a payment request with a default payment window of **10 minutes** (`OQ-004`). The booking transitions to `CONFIRMED` only upon verified payment success. If the traveller fails to pay within 10 minutes, the capacity reservation is released and the booking expires.
- **Enforcement Level:** Mandatory (Background timer worker)
- **Error Condition / Message:** `TRAVELLER_PAYMENT_WINDOW_EXPIRED`.
- **Related Requirements:** `REQ-TRV-010`, `REQ-HST-012`, `OQ-004`.

### `BR-080` — Historical Booking Retention & Audit Preservation
- **Description:** Completed and cancelled bookings must be preserved in historical databases for accounting and regulatory audit compliance. Host views can filter across all past bookings, while customer PII is retained in accordance with privacy data retention policies.
- **Origin:** `EXPLICIT` (FRS `FR-33 Booking History`).
- **Related Requirements:** `REQ-HST-019`, `REQ-TRV-017`.
- **Applicable Actors:** Host Owner, Host Staff, Superadmin.
- **Surfaces:** `HM`, `HD`, `AD`, `API`.
- **Validation Behavior:** Queries support date-range filtering, pagination, and location-level aggregation.
- **Severity / Impact:** **Medium** (Historical Reporting).
- **Unresolved Decisions:** None.
- **Origin:** `EXPLICIT` (FRS `FR -6 Online Payment` & Marketplace Model).
- **Related Requirements:** `REQ-TRV-011`, `REQ-HST-013`.
- **Applicable Actors:** Traveller, Host.
- **Surfaces:** All surfaces.
- **Validation Behavior:** Check-in requires a valid online payment record linked to the booking.
- **Severity / Impact:** **Critical** (Platform Revenue & Disintermediation Prevention).
- **Unresolved Decisions:** None.

---

### Category 7: Payments & Webhook Reconciliation

#### `BR-025` — Initial Launch Currency & Monetary Precision
- **Category:** Booking & Payment Execution Rules
- **Rule Statement:** The platform launches with **LKR (Sri Lankan Rupee)** as the sole booking and settlement currency (`OQ-008`). All location prices, checkout totals, commission calculations, refunds, and host payable balances are denominated in LKR. No silent currency conversion occurs at checkout. PayHere is the preferred gateway integration, subject to written marketplace approval as a launch gate (`OQ-003`).
- **Monetary Precision Rules:**
  1. Monetary values must be stored strictly as **integer minor units** (e.g. integer cents for LKR where exponent = 2).
  2. Every monetary value must explicitly store its corresponding **ISO 4217** currency code (`LKR`).
  3. Currency minor-unit exponent/precision is determined dynamically by the ISO 4217 standard. The platform architecture must **not** assume that every currency has two decimal places.
  4. Binary floating-point representation (`float`, `double`) is strictly prohibited for monetary calculations.
  5. Display formatting is decoupled from stored values and handled in presentation layers based on locale.
- **Enforcement Level:** Mandatory (Schema constraint & payment validation)
- **Error Condition / Message:** `UNSUPPORTED_CURRENCY_CODE`, `INVALID_MONETARY_REPRESENTATION`.
- **Related Requirements:** `REQ-TRV-011`, `REQ-TRV-027`, `REQ-HST-022`, `OQ-003`, `OQ-008`.

### `BR-026` — Prohibition of Client-Side Payment Confirmation
- **Description:** A booking must never transition to confirmed/paid based solely on a client application redirect or browser return URL. Confirmation requires server-verified webhook processing or verified server-to-server status inquiry.
- **Origin:** `IMPLIED` (Security Architecture Baseline).
- **Related Requirements:** `REQ-TRV-011`, `REQ-TRV-012`.
- **Applicable Actors:** Traveller, Client Applications.
- **Surfaces:** `TM`, `PW`, `API`.
- **Validation Behavior:** Client return handler polls `/api/v1/traveller/bookings/:id/status` until webhook reconciles.
- **Severity / Impact:** **Critical** (Prevents fake payment spoofing).
- **Unresolved Decisions:** None.

#### `BR-027` — Payment Webhook Idempotency
- **Description:** Receiving duplicate payment webhook notifications from PayHere for the same transaction must be handled idempotently: the transaction is recorded once, the booking confirms once, and host earnings are credited exactly once.
- **Origin:** `IMPLIED` (Required by `REQ-IMPL-006`).
- **Related Requirements:** `REQ-TRV-011`, `REQ-IMPL-006`.
- **Applicable Actors:** Backend API.
- **Surfaces:** `API`.
- **Validation Behavior:** Unique constraint on `payments.external_payment_reference`; duplicate webhooks return 200 OK without re-processing.
- **Severity / Impact:** **High** (Financial Ledger Integrity).
- **Unresolved Decisions:** None.

#### `BR-028` — Payment Amount Matching Invariant
- **Description:** The payment amount reported by PayHere webhook must exactly match the calculated total in the booking's `PriceSnapshot`. Any discrepancy in amount or currency code must flag the payment as `AMOUNT_MISMATCH` and suspend confirmation.
- **Origin:** `IMPLIED` (Financial Invariant).
- **Related Requirements:** `REQ-TRV-011`, `REQ-IMPL-006`.
- **Applicable Actors:** Backend API.
- **Surfaces:** `API`.
- **Validation Behavior:** `assert(webhook.payhere_amount == price_snapshot.total_amount)`.
- **Severity / Impact:** **Critical** (Price Tampering Prevention).
- **Unresolved Decisions:** None.

---

### Category 8: Custody Verification & Evidence

#### `BR-029` — Opaque Non-Sensitive QR Custody Token
- **Description:** The QR code presented by travellers at drop-off and collection must encode only an opaque, cryptographically random, non-sensitive token (UUIDv4). It must not contain booking IDs, traveller names, phone numbers, or credit card details.
- **Origin:** `IMPLIED` (Security Architecture Baseline).
- **Related Requirements:** `REQ-TRV-012`, `REQ-HST-013`.
- **Applicable Actors:** Traveller, Host.
- **Surfaces:** `TM`, `HM`, `PW`, `HD`, `API`.
- **Validation Behavior:** Token resolved to booking on backend; scanning QR with generic camera displays no personal information.
- **Severity / Impact:** **High** (Data Privacy & QR Tampering).
- **Unresolved Decisions:** None.

#### `BR-030` — Server-Side PIN Brute-Force Rate Limiting
- **Description:** Verification using the numerical backup PIN must be rate-limited on the server to a maximum of 5 consecutive failed attempts per booking reference before locking the PIN for 15 minutes.
- **Origin:** `IMPLIED` (Security Architecture Baseline).
- **Related Requirements:** `REQ-TRV-012`, `REQ-HST-013`.
- **Applicable Actors:** Host Owner, Host Staff.
- **Surfaces:** `API`.
- **Validation Behavior:** Redis/Database attempt counter increments on failure; triggers 429 Too Many Requests upon 5th failure.
- **Severity / Impact:** **High** (Prevents PIN guessing).
- **Unresolved Decisions:** None.

#### `BR-032` — Physical Custody Check-In Prerequisites
- **Description:** A host can execute check-in for a booking if and only if: (1) booking is in `CONFIRMED` status, (2) current time is within the location's drop-off window, and (3) QR code or PIN is successfully verified.
- **Origin:** `EXPLICIT` (FRS `FR-8 Check-in / Bag Drop`, `FR-27 Check-in Traveller`).
- **Related Requirements:** `REQ-TRV-014`, `REQ-HST-013`.
- **Applicable Actors:** Host Owner, Host Staff.
- **Surfaces:** `HM`, `HD`, `API`.
- **Validation Behavior:** Check-in API endpoint validates booking state and schedule window.
- **Severity / Impact:** **Critical** (Physical Custody Chain).
- **Unresolved Decisions:** None.

#### `BR-033` — Mandatory Custody Transition Logging
- **Description:** Every check-in and check-out event must append an immutable custody record capturing the exact UTC timestamp, actor ID (`Host` or `HostStaff`), verified method (`QR` or `PIN`), and location coordinates.
- **Origin:** `IMPLIED` (Auditability Baseline).
- **Related Requirements:** `REQ-TRV-014`, `REQ-HST-013`, `REQ-HST-017`.
- **Applicable Actors:** Backend API.
- **Surfaces:** `API`.
- **Validation Behavior:** Custody table constraints require timestamp, actor, and verification method.
- **Severity / Impact:** **High** (Evidentiary Auditability).
- **Unresolved Decisions:** None.

#### `BR-034` — Pre-Release Collection Verification
- **Description:** A host must never release luggage to any individual without scanning the collection QR code or verifying the collection PIN. Physical possession of bags without verified collection is an operational breach.
- **Origin:** `EXPLICIT` (FRS `FR -8 Check-out / Collection`, `FR-30 Check-out Verification`).
- **Related Requirements:** `REQ-TRV-015`, `REQ-HST-016`.
- **Applicable Actors:** Host Owner, Host Staff.
- **Surfaces:** `HM`, `HD`, `API`.
- **Validation Behavior:** UI check-out workflow blocks "Confirm Handover" button until token scan succeeds.
- **Severity / Impact:** **Critical** (Luggage Theft Prevention).
- **Unresolved Decisions:** None.

#### `BR-035` — Customer Cancellation Policy Tiers
- **Category:** Cancellation & Refund Rules
- **Rule Statement:** Standard customer cancellation refunds are tiered as follows (`OQ-009`):
  1. Traveller cancels > 2 hours before scheduled drop-off: **100% refund** of eligible booking subtotal.
  2. Traveller cancels within 2 hours before scheduled drop-off (prior to drop-off): **50% refund**.
  3. Traveller cancels after scheduled storage start time: **0% refund by default**.
  4. Traveller no-show: **0% refund by default**.
  5. Host cancels a confirmed booking: **100% refund**.
  6. Platform cancels due to location unavailability: **100% refund**.
  A host cannot retroactively override a confirmed booking's cancellation policy. Authorized exceptions for duplicate charges, payment failures, safety incidents, or platform errors are reserved for Superadmin authorization. Provider-specific capabilities and timing are tracked separately under `OQ-013`.
- **Enforcement Level:** Mandatory (Automated refund engine)
- **Error Condition / Message:** `CANCELLATION_WINDOW_EXPIRED`, `INVALID_CANCELLATION_STATE`.
- **Related Requirements:** `REQ-TRV-018`, `REQ-HST-020`, `OQ-009`.

### `BR-071` — Mandatory QR/PIN Custody Token Verification
- **Category:** Custody & Overdue Luggage Rules
- **Rule Statement:** Physical luggage custody transfer at check-in and check-out requires mandatory verification via secure dynamic QR code or one-time numeric PIN (`OQ-014`). Verification occurs server-side with rate-limiting against brute force. If camera scanning fails, authorized manual PIN entry is provided with an audit log record.
- **Enforcement Level:** Mandatory (Server-side token verification)
- **Error Condition / Message:** `INVALID_CUSTODY_TOKEN`, `TOKEN_ALREADY_REDEEMED`.
- **Related Requirements:** `REQ-TRV-014`, `REQ-HST-013`, `REQ-HST-016`, `OQ-014`.

### `BR-072` — Physical Bag Count Reconciliation
- **Category:** Custody & Overdue Luggage Rules
- **Rule Statement:** Host and staff must physically verify and confirm the exact number and category of bags received at check-in and returned at check-out (`OQ-014`). The system strictly prevents completing check-in or check-out when the physical bag count does not reconcile with the reservation, unless an authorized operational exception is formally recorded.
- **Enforcement Level:** Mandatory (UI wizard barrier & backend validation)
- **Error Condition / Message:** `BAG_COUNT_MISMATCH_BLOCKED`.
- **Related Requirements:** `REQ-HST-014`, `REQ-HST-016`, `OQ-014`.

### `BR-073` — Prohibited Items Verification
- **Description:** Host verification requires ensuring bags do not contain prohibited items (flammable liquids, explosives, firearms, perishable food, illegal drugs). If a bag is suspected of containing prohibited items, the host must refuse check-in.
- **Origin:** `IMPLIED` (Safety & Legal Compliance for `FR-28`).
- **Related Requirements:** `REQ-HST-014`, `REQ-TRV-007`.
- **Applicable Actors:** Host Owner, Host Staff.
- **Surfaces:** `HM`, `HD`.
- **Validation Behavior:** Check-in screen requires host acknowledgement: "Bags confirmed free of prohibited items".
- **Severity / Impact:** **Critical** (Public Safety & Liability).
- **Unresolved Decisions:** None.

#### `BR-074` — Custody Photographic Evidence Policy
- **Category:** Custody & Overdue Luggage Rules
- **Rule Statement:** Photographic evidence capture is fully supported in the MVP (`OQ-014`). It is **optional by default** for storage locations, but **configurable as mandatory per location** (by host setting or platform safety policy). When enabled, check-in photos are uploaded to private Cloudflare R2 storage, linked to the booking custody event, and governed by strict access controls and retention policies.
- **Enforcement Level:** Configurable per location (Runtime policy check)
- **Error Condition / Message:** `CHECKIN_PHOTO_EVIDENCE_REQUIRED`.
- **Related Requirements:** `REQ-HST-015`, `OQ-014`.

### `BR-075` — Private Cloudflare R2 Evidence Storage
- **Description:** Luggage check-in photographs, tag images, and damage reports must be stored in private Cloudflare R2 storage and served strictly via time-limited signed URLs (maximum 15-minute TTL). Public CDN URLs are prohibited for custody evidence.
- **Origin:** `IMPLIED` (Approved in `ADR-009`).
- **Related Requirements:** `REQ-HST-015`, `REQ-HST-027`.
- **Applicable Actors:** Backend API, Cloudflare R2.
- **Surfaces:** `API`.
- **Validation Behavior:** Object keys stored in `custody_evidence`; signed URL generated upon authenticated request.
- **Severity / Impact:** **High** (Privacy Protection).
- **Unresolved Decisions:** None.

#### `BR-076` — Bag Tag Number Attachment
- **Description:** If physical luggage tags or numbered claim tickets are used by a host business, the unique tag numbers must be entered into the check-in record and confirmed during check-out retrieval.
- **Origin:** `EXPLICIT` (FRS `FR-29 Check-in Evidence`).
- **Related Requirements:** `REQ-HST-015`, `REQ-HST-016`.
- **Applicable Actors:** Host Owner, Host Staff.
- **Surfaces:** `HM`, `HD`, `API`.
- **Validation Behavior:** Optional/required tag string field validated and persisted per bag item.
- **Severity / Impact:** **Medium** (Physical Identification).
- **Unresolved Decisions:** None.

#### `BR-077` — Mandatory Custody Handover Sign-Off
- **Description:** Marking a booking `COMPLETED` requires an explicit, authenticated confirmation action by the host in the application interface, verifying that all bags were physically returned to the traveller.
- **Origin:** `EXPLICIT` (FRS `FR-31 Mark Booking Complete`).
- **Related Requirements:** `REQ-HST-017`.
- **Applicable Actors:** Host Owner, Host Staff.
- **Surfaces:** `HM`, `HD`, `API`.
- **Validation Behavior:** `POST /api/v1/host/bookings/:id/complete` transitions booking and terminates active custody.
- **Severity / Impact:** **Critical** (Custody Termination).
- **Unresolved Decisions:** None.

---

### Category 9: Late Collection & Overdue Operations

#### `BR-078` — Overdue Luggage Assessment & Calculation
- **Category:** Custody & Overdue Luggage Rules
- **Rule Statement:** Storage locations enforce a configurable collection grace period (default 30 minutes). When collection exceeds scheduled collection time plus grace period, the booking is automatically flagged `OVERDUE` and additional charges are computed based on location pricing rules (`OQ-015`). The overdue fee policy must be disclosed to the traveller prior to checkout. Assessment of an overdue fee is modeled as an independent financial record and does not alter the physical custody obligation.
- **Enforcement Level:** Mandatory (Automated background worker)
- **Error Condition / Message:** `BOOKING_FLAGGED_OVERDUE`.
- **Related Requirements:** `REQ-HST-018`, `OQ-015`.

### `BR-079` — Overdue Fee Settlement via In-App Payment & Custody Separation
- **Category:** Custody & Overdue Luggage Rules
- **Rule Statement:** Overdue storage charge settlement in the initial release is conducted **exclusively via in-app payment** through the platform payment gateway (`OQ-015`). Cash collection at the counter is strictly excluded from standard platform workflows and cannot be marked as a platform payment.
- **Custody Decoupling Rule (No Possessory Lien):**
  **Physical luggage custody and overdue fee financial settlement are strictly modeled as separate concerns.** A disputed or unpaid overdue fee **must not automatically prevent the traveller from collecting their belongings**. The platform does not assert or enforce a right to retain luggage as security for unpaid fees. If an overdue fee is unpaid or disputed at collection:
  1. The host must verify custody tokens (`REQ-HST-016`) and release the traveller's luggage upon identity confirmation.
  2. The overdue fee is recorded as an outstanding receivable.
  3. The fee dispute or unpaid balance is flagged for platform support review and debt tracking (`REQ-TRV-023`, `REQ-HST-026`).
- **Enforcement Level:** Mandatory (Decoupled state machine & payment invariant)
- **Error Condition / Message:** `OFFLINE_CASH_COLLECTION_PROHIBITED`, `CUSTODY_WITHHOLDING_PROHIBITED`.
- **Related Requirements:** `REQ-HST-016`, `REQ-HST-018`, `REQ-TRV-015`, `OQ-015`.

### `BR-038` — Traveller Cancellation Cutoff Policy
- **Description:** A traveller may cancel a confirmed booking prior to drop-off. If cancelled before the policy cutoff window (e.g., up to 2 hours before scheduled drop-off), the traveller is eligible for a full refund. Cancellations after the cutoff are subject to policy deduction.
- **Origin:** `EXPLICIT` (FRS `FR-10 Cancellation`).
- **Related Requirements:** `REQ-TRV-018`.
- **Applicable Actors:** Traveller.
- **Surfaces:** `TM`, `PW`, `API`.
- **Validation Behavior:** System checks `drop_off_time - cancellation_time >= cutoff_hours`.
- **Severity / Impact:** **High** (Cancellation Terms).
- **Unresolved Decisions:** Standardized cutoff window setting (`OQ-009`).

#### `BR-039` — Immediate Capacity Release upon Cancellation
- **Description:** Whenever a booking is cancelled by a traveller or host prior to check-in, the reserved capacity must be immediately returned to the host's unreserved capacity pool.
- **Origin:** `IMPLIED` (Capacity Conservation).
- **Related Requirements:** `REQ-TRV-018`, `REQ-HST-020`.
- **Applicable Actors:** Backend API.
- **Surfaces:** `API`.
- **Validation Behavior:** Cancellation transaction executes `capacity_reservations.status = 'RELEASED'`.
- **Severity / Impact:** **High** (Inventory Availability).
- **Unresolved Decisions:** None.

#### `BR-040` — Configurable Tax & Invoicing Foundation (Four-Layer Separation)
- **Category:** Tax & Invoicing Rules
- **Rule Statement:** The platform implements a configurable tax and invoicing foundation structured into four distinct layers (`OQ-010`):
  1. **Layer A (Platform Technical Capability):** Support configurable tax rules, tax-inclusive and tax-exclusive pricing, separate persistence of taxable base, tax amount, and gross amount in integer minor units, jurisdiction configuration, effective dates, booking receipts, payment records, refund records, and immutable calculation snapshots.
  2. **Layer B (Configured Jurisdiction Rules):** Initial system configurations model Sri Lankan VAT and SSCL rules. These rules are system configuration data, not legal advice or proof of compliance.
  3. **Layer C (Legal and Tax Classification):** Formal legal determination of whether the platform operates as agent, principal, or marketplace facilitator is an external legal matter that cannot be decided through software documentation.
  4. **Layer D (Launch Compliance Gate):** Formal legal/tax advisory must be completed prior to commercial launch in Sri Lanka to validate statutory invoicing, VAT, and SSCL liabilities.
  Software capabilities do not constitute legal advice or guarantee legal compliance.
- **Enforcement Level:** Mandatory (Tax calculation snapshotting & compliance gate)
- **Error Condition / Message:** `TAX_CALCULATION_INVALID`, `UNVERIFIED_TAX_STRUCTURE_BLOCKED`.
- **Related Requirements:** `REQ-HST-024`, `REQ-IMPL-011`, `OQ-010`.

### `BR-041` — Statutory Tax & Invoicing Compliance Verification
- **Category:** Tax & Invoicing Rules
- **Rule Statement:** Invoicing models, VAT applicability (on commission vs full service), SSCL liability turnover calculation, and invoice identity are treated as an external verification gate requiring formal Sri Lankan legal and tax advisory prior to production launch (`OQ-010`).
- **Enforcement Level:** Compliance Gate (Pre-launch sign-off requirement)
- **Error Condition / Message:** `UNVERIFIED_TAX_STRUCTURE_BLOCKED`.
- **Related Requirements:** `REQ-HST-024`, `OQ-010`.

### `BR-081` — 100% Refund on Host-Initiated Cancellation
- **Description:** If a host cancels a confirmed booking under platform rules (`FR-34`), the traveller must immediately receive a 100% full refund regardless of timing, and the cancellation reason must be recorded in the host's audit log.
- **Origin:** `EXPLICIT` (FRS `FR-34 Cancellation Handling`).
- **Related Requirements:** `REQ-HST-020`, `REQ-TRV-018`.
- **Applicable Actors:** Host Owner, Traveller.
- **Surfaces:** `HM`, `HD`, `API`.
- **Validation Behavior:** Host cancellation triggers 100% refund transaction without service fee deductions.
- **Severity / Impact:** **Critical** (Customer Protection).
- **Unresolved Decisions:** Host penalty policy details pending (`OQ-009`).

#### `BR-082` — Mandatory Stated Reason for Host Cancellation
- **Description:** A host cannot cancel a confirmed booking without providing an explicit, categorized reason (e.g., Emergency Closure, Full Store, Structural Issue).
- **Origin:** `EXPLICIT` (FRS `FR-34 Cancellation Handling`).
- **Related Requirements:** `REQ-HST-020`.
- **Applicable Actors:** Host Owner.
- **Surfaces:** `HM`, `HD`, `API`.
- **Validation Behavior:** Zod schema enforces non-empty cancellation reason.
- **Severity / Impact:** **Medium** (Partner Accountability).
- **Unresolved Decisions:** None.

---

### Category 11: Reviews & Ratings

#### `BR-044` — Verified Booking Review Prerequisite
- **Description:** A traveller can submit a review and star rating for a host if and only if the traveller has completed a verified booking (`COMPLETED`) at that storage location. Unbooked visitors cannot leave reviews.
- **Origin:** `EXPLICIT` (FRS `FR-12 Leave Review`, `FR-39 Reviews & Ratings`).
- **Related Requirements:** `REQ-TRV-022`, `REQ-HST-025`.
- **Applicable Actors:** Traveller.
- **Surfaces:** `TM`, `PW`, `API`.
- **Validation Behavior:** Review endpoint verifies `booking.user_id = :authUserId AND booking.status = 'COMPLETED'`.
- **Severity / Impact:** **High** (Review Authenticity & Anti-Spam).
- **Unresolved Decisions:** None.

#### `BR-045` — Single Review per Booking
- **Description:** Exactly one host review may be submitted per completed booking ID. Travellers may edit their submitted review within 30 days of completion, but cannot submit duplicate reviews for the same transaction.
- **Origin:** `IMPLIED` (Review Integrity).
- **Related Requirements:** `REQ-TRV-022`.
- **Applicable Actors:** Traveller.
- **Surfaces:** `TM`, `PW`, `API`.
- **Validation Behavior:** Unique constraint on `location_reviews.booking_id`.
- **Severity / Impact:** **Medium** (Rating Metric Integrity).
- **Unresolved Decisions:** None.

#### `BR-046` — Separation of Host Reviews from App Feedback
- **Description:** Host reviews (star rating and comments on the physical storage service) must be stored and displayed separately from platform mobile application feedback (UX, bug reports, feature suggestions).
- **Origin:** `EXPLICIT` (FRS `FR-12 Leave Review`: *"Rate Host after collection and for app"*).
- **Related Requirements:** `REQ-TRV-022`.
- **Applicable Actors:** Traveller.
- **Surfaces:** `TM`, `PW`, `API`.
- **Validation Behavior:** Host reviews write to `location_reviews`; app feedback writes to `app_feedback` table.
- **Severity / Impact:** **Medium** (Review Separation).
- **Unresolved Decisions:** None (Confirmed in `OQ-016`).

#### `BR-090` — Review Moderation & Removal Threshold
- **Description:** Reported reviews remain visible until reviewed by Superadmin or Support Staff unless flagged for hate speech, profanity, or extortion, in which case automated sentiment filters place the review in a pending-moderation hidden state.
- **Origin:** `IMPLIED` (Required by `REQ-IMPL-009`).
- **Related Requirements:** `REQ-HST-025`, `REQ-IMPL-009`.
- **Applicable Actors:** Host Owner, Superadmin.
- **Surfaces:** `AD`, `API`.
- **Validation Behavior:** Review record status field (`PUBLISHED`, `REPORTED`, `HIDDEN`).
- **Severity / Impact:** **Medium** (Community Standards).
- **Unresolved Decisions:** None.

---

### Category 12: Customer Support & Incidents

#### `BR-047` — Customer Support Separation from Incident Workflows
- **Description:** General customer support tickets (booking questions, app inquiries) must be maintained in separate queues from formal luggage incident investigations (lost, damaged, or unclaimed bags).
- **Origin:** `EXPLICIT` (FRS `FR -12 Customer Support`: *"Should be seperated"*).
- **Related Requirements:** `REQ-TRV-023`, `REQ-HST-027`.
- **Applicable Actors:** Traveller, Platform Support Staff.
- **Surfaces:** `TM`, `PW`, `AD`, `API`.
- **Validation Behavior:** Database table separation: `support_tickets` vs `incidents`.
- **Severity / Impact:** **High** (Operational Clarity).
- **Unresolved Decisions:** None (Confirmed in `OQ-016`).

#### `BR-048` — SLA Tracking on Operational Support
- **Description:** Support tickets submitted by travellers or hosts must automatically track response SLA timestamps, escalating unassigned tickets after a defined threshold (e.g., 4 hours).
- **Origin:** `IMPLIED` (Operational Quality).
- **Related Requirements:** `REQ-TRV-023`, `REQ-HST-026`.
- **Applicable Actors:** Platform Support Staff, Superadmin.
- **Surfaces:** `AD`, `API`.
- **Validation Behavior:** Dashboard highlights breached SLA tickets with visual warnings.
- **Severity / Impact:** **Medium** (Support Service Level).
- **Unresolved Decisions:** None.

#### `BR-091` — Host Support Ticket Segregation
- **Description:** Host operational issue reports (`FR-40`) must route to a partner operations queue distinct from consumer traveller inquiries (`FR -12`), enabling dedicated B2B partner support.
- **Origin:** `EXPLICIT` (FRS `FR-40 Support`).
- **Related Requirements:** `REQ-HST-026`.
- **Applicable Actors:** Host Owner, Host Staff, Platform Support.
- **Surfaces:** `HM`, `HD`, `AD`, `API`.
- **Validation Behavior:** Ticket queue filters by `submitter_role = 'HOST'`.
- **Severity / Impact:** **Medium** (Partner Relations).
- **Unresolved Decisions:** None.

#### `BR-092` — Legal Hold on Luggage Incidents
- **Description:** When an incident report (`FR-41`) is filed for a booking, all associated check-in evidence photos, tag numbers, and booking events are immediately locked under legal-hold status. Deletion, alteration, or overwriting is prohibited.
- **Origin:** `IMPLIED` (Required by `REQ-IMPL-010`).
- **Related Requirements:** `REQ-HST-027`, `REQ-IMPL-010`.
- **Applicable Actors:** Backend API.
- **Surfaces:** `API`.
- **Validation Behavior:** Database triggers reject any `DELETE` or `UPDATE` on evidence records associated with an open incident.
- **Severity / Impact:** **Critical** (Legal Evidence Preservation).
- **Unresolved Decisions:** None.

#### `BR-093` — Unclaimed Luggage Statutory Threshold
- **Description:** Overdue luggage that remains uncollected past a defined threshold (e.g., 48 hours past collection deadline) must be escalated to an official `UNCLAIMED_LUGGAGE` incident, triggering formal customer notification and custody preservation procedures.
- **Origin:** `EXPLICIT` (FRS `FR-41 Incident Reporting`).
- **Related Requirements:** `REQ-HST-027`.
- **Applicable Actors:** Host Owner, Superadmin.
- **Surfaces:** `HM`, `HD`, `AD`, `API`.
- **Validation Behavior:** Background worker alerts host and admin when overdue hours exceed threshold.
- **Severity / Impact:** **High** (Abandoned Property Legal Compliance).
- **Unresolved Decisions:** Statutory retention threshold setting.

---

### Category 13: Host Verification & Onboarding

#### `BR-054` — Host Applicant Role Progression
- **Description:** A host account progresses through a strict lifecycle: `APPLICANT` $\to$ `PENDING_APPROVAL` $\to$ `APPROVED` (or `REJECTED` / `SUSPENDED`). Storage locations cannot accept public bookings until the host reaches `APPROVED` state.
- **Origin:** `EXPLICIT` (FRS `FR-15`, `FR-16`, `FR-17`).
- **Related Requirements:** `REQ-HST-001`, `REQ-HST-003`.
- **Applicable Actors:** Host Applicant, Superadmin.
- **Surfaces:** All surfaces.
- **Validation Behavior:** State machine validates transitions; rejects premature activation.
- **Severity / Impact:** **Critical** (Supply Quality & Compliance).
- **Unresolved Decisions:** None.

#### `BR-055` — Host Business Entity Type Differentiation
- **Description:** Host registration must distinguish between Individual Operators (sole proprietorships / residential hosts) and Registered Commercial Businesses (shops, hotels, chains).
- **Origin:** `IMPLIED` (Approved in `OQ-002`).
- **Related Requirements:** `REQ-HST-001`, `REQ-HST-002`.
- **Applicable Actors:** Host Owner.
- **Surfaces:** `HM`, `HD`, `API`.
- **Validation Behavior:** Entity type selects the applicable KYC document requirements checklist.
- **Severity / Impact:** **High** (Regulatory KYC Compliance).
- **Unresolved Decisions:** Mandatory document checklist pending (`OQ-002`).

#### `BR-056` — Mandatory KYC Document Upload
- **Description:** An applicant host must submit required identity documents (government NIC/Passport for individuals; Business Registration Certificate + Director ID for registered businesses) before their application can enter the approval review queue.
- **Origin:** `EXPLICIT` (FRS `FR-16 Identity/Business Verification`).
- **Related Requirements:** `REQ-HST-002`.
- **Applicable Actors:** Host Owner.
- **Surfaces:** `HM`, `HD`, `API`.
- **Validation Behavior:** Submit button disabled until all mandatory document slots are fulfilled.
- **Severity / Impact:** **High** (KYC Compliance).
- **Unresolved Decisions:** Exact Sri Lankan document checklist pending (`OQ-002`).

#### `BR-057` — Document Upload Security Constraints
- **Description:** Uploaded verification documents must be validated for allowed MIME types (PDF, JPEG, PNG), maximum file size of 10 MB per file, and must be stored in private Cloudflare R2 buckets with unguessable UUID keys.
- **Origin:** `IMPLIED` (Approved in `ADR-009`).
- **Related Requirements:** `REQ-HST-002`, `ADR-009`.
- **Applicable Actors:** Host Owner, Backend API.
- **Surfaces:** `HM`, `HD`, `API`.
- **Validation Behavior:** Pre-signed URL generator validates file metadata before issuing upload tokens.
- **Severity / Impact:** **High** (Object Storage Security).
- **Unresolved Decisions:** None.

#### `BR-058` — Exclusive Superadmin Authority over Host Approval
- **Description:** Approving a host application and activating their storage listings for public marketplace discovery requires an explicit administrative action by authorized platform personnel.
- **Origin:** `EXPLICIT` (FRS `FR-17 Host Approval`).
- **Related Requirements:** `REQ-HST-003`, `REQ-IMPL-014`.
- **Applicable Actors:** Superadmin, Platform Support Staff.
- **Surfaces:** `AD`, `API`.
- **Validation Behavior:** `POST /api/v1/admin/hosts/:id/approve` requires administrative credentials.
- **Severity / Impact:** **Critical** (Platform Safety Gate).
- **Unresolved Decisions:** Support staff vs Superadmin approval rights pending (`OQ-011`).

#### `BR-059` — Host Rejection with Feedback
- **Description:** When an administrator rejects a host application, explicit feedback reasons (e.g., "Business registration document expired") must be recorded and displayed to the host on HM and HD with options to re-upload.
- **Origin:** `IMPLIED` (Partner Experience for `FR-17`).
- **Related Requirements:** `REQ-HST-003`.
- **Applicable Actors:** Superadmin, Host Owner.
- **Surfaces:** `AD`, `HM`, `HD`, `API`.
- **Validation Behavior:** Rejection endpoint requires a non-empty `rejection_reason` string.
- **Severity / Impact:** **Medium** (Partner Onboarding).
- **Unresolved Decisions:** None.

#### `BR-060` — Host Profile Re-Verification on Legal Entity Mutation
- **Description:** If an approved host modifies their legal business name, tax registration number, or primary owner identity, their approval status must automatically transition to `PENDING_RE_VERIFICATION`, requiring administrative review before updates take effect.
- **Origin:** `IMPLIED` (Required by `REQ-IMPL-001`).
- **Related Requirements:** `REQ-HST-004`, `REQ-IMPL-001`.
- **Applicable Actors:** Host Owner, Superadmin.
- **Surfaces:** `HD`, `AD`, `API`.
- **Validation Behavior:** Mutation triggers approval status change and notifies compliance queue.
- **Severity / Impact:** **High** (Fraud Prevention).
- **Unresolved Decisions:** None.

---

### Category 14: Host Staff Operations

#### `BR-094` — Host Staff Location Scoping
- **Description:** A host employee (`HOST_STAFF`) must be scoped strictly to assigned `StorageLocations` under their employer's organization. Staff cannot view bookings, check-in luggage, or access data for unassigned locations.
- **Origin:** `EXPLICIT` (FRS `FR-42 Staff Accounts`, classified `Later`).
- **Related Requirements:** `REQ-HST-028`, `WF-STF-001`.
- **Applicable Actors:** Host Owner, Host Staff.
- **Surfaces:** `HM`, `HD`, `API`.
- **Validation Behavior:** API requests verify `staff_location_assignments` for the target `location_id`.
- **Severity / Impact:** **High** (Internal Partner Data Scoping).
- **Unresolved Decisions:** None.

#### `BR-095` — Prohibition of Staff Access to Financial Data
- **Description:** Host Staff accounts (`ACT-03`) are strictly prohibited from viewing Earnings Dashboards (`FR-36`), Transaction Ledgers (`FR-38`), Payout Management (`FR-37`), or bank account details.
- **Origin:** `IMPLIED` (Required to enforce `FR-42` boundary).
- **Related Requirements:** `REQ-HST-028`, `REQ-HST-022`, `REQ-HST-023`, `REQ-HST-024`.
- **Applicable Actors:** Host Staff.
- **Surfaces:** `HM`, `HD`, `API`.
- **Validation Behavior:** Role-based route guard blocks staff from financial API endpoints (403 Forbidden).
- **Severity / Impact:** **Critical** (Partner Financial Privacy).
- **Unresolved Decisions:** None.

---

### Category 15: Multi-Location Fleets & Host Archetypes

#### `BR-097` — Superadmin Financial & Governance Privilege Reservation
- **Category:** Administration, Staff & Governance Rules
- **Rule Statement:** Critical financial and platform governance capabilities are reserved exclusively for authorized Superadmin personnel (`ACT-05`) with comprehensive audit logging (`OQ-011`). These include: host approvals/suspensions (`FR-17`), platform-level configuration, exceptional booking interventions, refund authorizations, manual host payout execution (`FR-37`), and commission policy updates.
- **Enforcement Level:** Mandatory (Role check & multi-factor verification)
- **Error Condition / Message:** `SUPERADMIN_AUTHORIZATION_REQUIRED`.
- **Related Requirements:** `REQ-HST-003`, `REQ-HST-023`, `REQ-HST-029`, `REQ-IMPL-011`, `OQ-011`.

### `BR-098` — Consolidated & Per-Location Financial Visibility
- **Description:** For multi-location hosts (`FR-44`), the Earnings Dashboard and Transaction Ledger must support viewing financial metrics consolidated across all branches or filtered by individual storage location.
- **Origin:** `IMPLIED` (Required by `FR-36`, `FR-44`).
- **Related Requirements:** `REQ-HST-022`, `REQ-HST-030`.
- **Applicable Actors:** Host Owner.
- **Surfaces:** `HM`, `HD`, `API`.
- **Validation Behavior:** Earnings query accepts optional `location_id` filter parameter.
- **Severity / Impact:** **Medium** (Reporting Usability).
- **Unresolved Decisions:** None.

---

### Category 16: Financial Operations, Administration & Auditability

#### `BR-042` — Multi-Channel Notification Dispatch
- **Description:** Notification events must be dispatched across push notifications (`expo-notifications`), transactional emails, and in-app notification centres, respecting the user's configured communication preferences.
- **Origin:** `EXPLICIT` (FRS `FR-11`, `FR-35`).
- **Related Requirements:** `REQ-TRV-020`, `REQ-HST-021`.
- **Applicable Actors:** All Actors.
- **Surfaces:** All surfaces.
- **Validation Behavior:** Notification dispatcher checks `notification_preferences` before sending push/email.
- **Severity / Impact:** **Medium** (User Engagement).
- **Unresolved Decisions:** Email/SMS vendor selection pending (`OQ-019`, `OQ-020`).

#### `BR-043` — Scheduled Operational Reminder Triggers
- **Description:** Pre-arrival reminders (e.g., 2 hours prior to scheduled drop-off) and collection deadline reminders (e.g., 1 hour prior to deadline) must be scheduled based on the storage location's local operating hours and dispatched via enabled notification channels.
- **Origin:** `EXPLICIT` (FRS `FR-11 Notifications`).
- **Related Requirements:** `REQ-TRV-020`.
- **Applicable Actors:** Traveller, Background Worker.
- **Surfaces:** `API`.
- **Validation Behavior:** Scheduler calculates trigger timestamps in UTC based on location timezone; ignores past instants.
- **Severity / Impact:** **Medium** (Timely Luggage Operations).
- **Unresolved Decisions:** None.

#### `BR-052` — Zero Hardcoded User-Facing Strings
- **Description:** No user-facing text, error message, or label may be hardcoded in application logic. All strings must reference localization keys via `@luggage/i18n` dictionaries supporting BCP 47 locale codes.
- **Origin:** `IMPLIED` (Approved in `ADR-010` & `FR-14`).
- **Related Requirements:** `REQ-TRV-026`.
- **Applicable Actors:** All Actors.
- **Surfaces:** All surfaces.
- **Validation Behavior:** Code reviews and lint rules enforce localization key references.
- **Severity / Impact:** **Medium** (International Expansion Readiness).
- **Unresolved Decisions:** None.

#### `BR-053` — Currency-Aware Monetary Fields
- **Description:** Every database table, API DTO, and client presentation model handling monetary values must explicitly include the ISO 4217 currency code alongside the numeric amount.
- **Origin:** `IMPLIED` (Approved in `ADR-010` & `FR -14`).
- **Related Requirements:** `REQ-TRV-027`, `REQ-HST-024`.
- **Applicable Actors:** All Actors.
- **Surfaces:** All surfaces.
- **Validation Behavior:** Zod schemas require `{ amount: number, currency: string }`.
- **Severity / Impact:** **High** (Global Financial Accuracy).
- **Unresolved Decisions:** PayHere initial currency choice (`OQ-008`).

#### `BR-083` — Real-Time Operational Push Delivery SLA
- **Description:** Operational push alerts for new booking requests (`FR-26`), booking confirmations (`FR-7`), and arrival alerts (`FR-35`) must be dispatched to notification queues within 5 seconds of the triggering database event.
- **Origin:** `IMPLIED` (Operational Reliability).
- **Related Requirements:** `REQ-HST-021`, `REQ-TRV-020`.
- **Applicable Actors:** Traveller, Host.
- **Surfaces:** `API`.
- **Validation Behavior:** Asynchronous worker queue processes high-priority notification jobs immediately.
- **Severity / Impact:** **High** (Store-Floor Responsiveness).
- **Unresolved Decisions:** None.

#### `BR-084` — Exclusive Host Owner Payout Administration
- **Description:** Only the registered Host Owner (`ACT-02`) has permission to view earnings, register or modify bank payout details, or initiate payout requests. Host Staff accounts are strictly locked out of this capability.
- **Origin:** `EXPLICIT` (FRS `FR-36`, `FR-37`, `FR-42`).
- **Related Requirements:** `REQ-HST-022`, `REQ-HST-023`, `REQ-HST-028`.
- **Applicable Actors:** Host Owner, Host Staff.
- **Surfaces:** `HM`, `HD`, `API`.
- **Validation Behavior:** Payout API validates `user_membership.role == 'OWNER'`.
- **Severity / Impact:** **Critical** (Financial Security).
- **Unresolved Decisions:** None.

#### `BR-085` — Immutable Double-Entry Financial Journal
- **Description:** The platform's internal financial ledger must operate as an append-only journal (`INSERT` only). Every customer payment credit, platform commission deduction, refund debit, and payout disbursement must be balanced and mathematically auditable.
- **Origin:** `IMPLIED` (Required by `REQ-IMPL-011` & `ADR-008`).
- **Related Requirements:** `REQ-HST-022`, `REQ-HST-024`, `REQ-IMPL-011`.
- **Applicable Actors:** Backend API.
- **Surfaces:** `API`, PostgreSQL.
- **Validation Behavior:** Database user lacks `UPDATE` and `DELETE` privileges on `ledger_entries` table.
- **Severity / Impact:** **Critical** (Financial Auditability).
- **Unresolved Decisions:** None.

#### `BR-086` — Host Bank Account Verification Prerequisite
- **Description:** A host cannot receive manual payout disbursements until their registered bank account details (bank name, branch code, account number, beneficiary name) have been validated against format rules and approved for disbursements.
- **Origin:** `EXPLICIT` (FRS `FR-37 Payout Management`).
- **Related Requirements:** `REQ-HST-023`.
- **Applicable Actors:** Host Owner, Superadmin.
- **Surfaces:** `HM`, `HD`, `AD`, `API`.
- **Validation Behavior:** Payout execution verifies `host_payout_accounts.is_verified = TRUE`.
- **Severity / Impact:** **High** (Payout Routing Safety).
- **Unresolved Decisions:** None.

#### `BR-087` — Superadmin Exclusive Payout Execution Authority
- **Description:** Executing manual host payouts and debiting host payable balances is restricted exclusively to the Platform Superadministrator (`ACT-05`). Support Staff (`ACT-04`) cannot trigger or complete payouts.
- **Origin:** `EXPLICIT` (FRS `FR-37 Payout Management` & Prompt Section 3.9).
- **Related Requirements:** `REQ-HST-023`, `REQ-IMPL-012`, `REQ-IMPL-014`.
- **Applicable Actors:** Superadmin.
- **Surfaces:** `AD`, `API`.
- **Validation Behavior:** `POST /api/v1/admin/payouts/:id/complete` enforces `SUPERADMIN` role.
- **Severity / Impact:** **Critical** (Financial Governance).
- **Unresolved Decisions:** None.

#### `BR-088` — External Bank Reference Requirement on Manual Payout
- **Description:** Marking a manual payout as `COMPLETED` in the Superadmin Dashboard requires the administrator to input an external bank transfer reference number and optional transaction receipt upload.
- **Origin:** `EXPLICIT` (FRS `FR-37 Payout Management`, `ADR-008`).
- **Related Requirements:** `REQ-HST-023`, `REQ-IMPL-012`.
- **Applicable Actors:** Superadmin.
- **Surfaces:** `AD`, `API`.
- **Validation Behavior:** Form validation rejects completion if bank reference is blank.
- **Severity / Impact:** **High** (Reconciliation Traceability).
- **Unresolved Decisions:** None.

#### `BR-089` — Downloadable Statement Generation
- **Description:** Hosts and administrators must be able to export itemized financial statements and transaction history to CSV format for external accounting and tax reconciliation.
- **Origin:** `IMPLIED` (Required by `FR-38 Transaction History`).
- **Related Requirements:** `REQ-HST-024`.
- **Applicable Actors:** Host Owner, Superadmin.
- **Surfaces:** `HD`, `AD`, `API`.
- **Validation Behavior:** Export endpoint streams standard RFC 4180 CSV data.
- **Severity / Impact:** **Medium** (Accounting Ergonomics).
- **Unresolved Decisions:** None.

#### `BR-096` — Strict Least-Privilege Support Staff Boundaries
- **Category:** Administration, Staff & Governance Rules
- **Rule Statement:** Platform Support Staff (`ACT-04`) operate under strict least-privilege permissions (`OQ-011`). Support staff may view permitted traveller/host info, search bookings, review payment/refund status, manage support cases, and record audit notes. Support staff must NOT independently approve/reject host applications (`FR-17`), change commission, change payment/refund policy, initiate or authorize refunds, execute host payouts, or alter financial ledger entries.
- **Enforcement Level:** Mandatory (Server-side RBAC permission guards)
- **Error Condition / Message:** `SUPPORT_ROLE_PRIVILEGE_VIOLATION`.
- **Related Requirements:** `REQ-HST-002`, `REQ-HST-003`, `REQ-HST-029`, `OQ-011`.

### `BR-099` — Platform Commission Versioning
- **Description:** Platform commission percentages and service fee models are versioned. Updating the platform commission structure affects only future bookings created after the update timestamp.
- **Origin:** `IMPLIED` (Required by `REQ-IMPL-013`).
- **Related Requirements:** `REQ-HST-022`, `REQ-IMPL-013`.
- **Applicable Actors:** Superadmin.
- **Surfaces:** `AD`, `API`.
- **Validation Behavior:** New `commission_policies` record inserted; active policy resolved by timestamp.
- **Severity / Impact:** **High** (Contractual Stability).
- **Unresolved Decisions:** Exact commission percentage pending (`OQ-005`).

#### `BR-100` — Administrative Action Immutable Audit Logging
- **Description:** Every administrative action performed in the Superadmin Dashboard (host approval, host suspension, manual payout, refund approval, commission change, review moderation) must be recorded in an immutable audit log capturing admin user ID, timestamp, action type, IP address, and JSON diff of modified state.
- **Origin:** `IMPLIED` (Required by `REQ-IMPL-014`).
- **Related Requirements:** `REQ-IMPL-014`.
- **Applicable Actors:** Superadmin, Platform Support Staff.
- **Surfaces:** `AD`, `API`, PostgreSQL.
- **Validation Behavior:** Fastify administrative route hook writes to `admin_audit_logs` table on every state-mutating request.
- **Severity / Impact:** **Critical** (Enterprise Security & Compliance).
- **Unresolved Decisions:** None.

