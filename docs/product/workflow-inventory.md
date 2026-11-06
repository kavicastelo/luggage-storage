# Workflow and Use-Case Inventory

**Document Title:** Workflow and Use-Case Inventory  
**Project:** Global Luggage Storage Marketplace  
**Phase:** Phase 0B — Requirements Normalization & Traceability  
**Document Status:** Complete Authoritative Baseline  
**Source Document:** `docs/product/source/luggage-storage-frs.pdf`  
**Related Documents:**
- [Normalized Functional Requirements Specification](functional-requirements.md)
- [Requirements Traceability Matrix](requirements-traceability-matrix.md)
- [Business Rules and Validation Catalogue](business-rules-catalogue.md)
- [Assumptions and Open Questions Register](assumptions-and-open-questions.md)
- [User Roles and Actor Model](user-roles-and-actors.md)

---

## 1. Inventory Overview & Journey Architecture

This document catalogs the complete inventory of user journeys, operational workflows, and administrative procedures across all five identified actor classifications:

1. **Traveller (`ACT-01`):** Consumer discovery, booking, payment, check-in, collection, review, and support workflows (`WF-TRV-001` to `WF-TRV-015`).
2. **Host Owner (`ACT-02`):** Supply onboarding, KYC verification, location configuration, booking acceptance, luggage custody verification, and financial management (`WF-HST-001` to `WF-HST-016`).
3. **Host Staff (`ACT-03` — `FR-42 Later`):** Store-floor operational execution (check-in, bag verification, check-out) scoped to assigned locations (`WF-STF-001` to `WF-STF-003`).
4. **Platform Support Staff (`ACT-04`):** Verification review, support ticket triage, incident investigation, review moderation (`WF-SUP-001` to `WF-SUP-004`).
5. **Platform Superadmin (`ACT-05`):** Platform governance, manual payout execution (`FR-37`), refund approvals, commission settings, system configuration (`WF-ADM-001` to `WF-ADM-006`).

---

## 2. End-to-End Marketplace Flow Diagram

```mermaid
sequenceDiagram
    autonumber
    actor T as Traveller (ACT-01)
    participant Client as TM / PW Client
    participant API as Backend Modular Monolith
    actor H as Host Partner (ACT-02)
    participant PG as PostgreSQL / Ledger
    participant PH as PayHere Gateway
    actor Admin as Superadmin (ACT-05)

    Note over H,Admin: Phase 1: Host Onboarding & Verification (WF-HST-001..003)
    H->>API: 1. Register Host Profile & Locations (FR-15, FR-18..20)
    H->>API: 2. Upload KYC / Business Documents (FR-16)
    Admin->>API: 3. Review & Approve Host (FR-17 / WF-ADM-001)
    H->>API: 4. Configure Capacity & Pricing Rules (FR-21, FR-23)

    Note over T,PH: Phase 2: Search, Reservation & Payment (WF-TRV-003..007)
    T->>Client: 5. Search Nearby / Destination (FR-2, FR-3)
    Client->>API: 6. Request Location Quote & Availability (FR-4..5)
    API-->>Client: 7. Return Masked Details & Server Price (OQ-012)
    T->>Client: 8. Select Bags, Dates & Click Book (FR-6)
    Client->>API: 9. Initiate Booking & Atomic Capacity Hold (REQ-IMPL-004)
    Client->>PH: 10. Execute PayHere Online Checkout (FR-6)
    PH-->>API: 11. Asynchronous Payment Webhook (notify_url)
    API->>API: 12. Verify MD5 Signature & Reconcile Payment
    API->>PG: 13. Confirm Booking & Append Ledger Credit Entry
    API-->>Client: 14. Unmask Address, Issue QR, PIN & Directions (FR-7)

    Note over T,H: Phase 3: Physical Luggage Custody (WF-TRV-010 / WF-HST-008)
    T->>H: 15. Arrive at Host Storefront via Directions (FR-7)
    T->>H: 16. Present Dynamic QR / PIN Code (FR-8)
    H->>API: 17. Scan QR / Input PIN (FR-27)
    H->>API: 18. Verify Physical Bag Count & Type (FR-28)
    H->>API: 19. Capture Check-in Photo Evidence (FR-29 / OQ-014)
    API->>PG: 20. Transition Booking -> CHECKED_IN
    
    Note over T,H: Phase 4: Retrieval & Completion (WF-TRV-012 / WF-HST-011)
    T->>H: 21. Present Collection Token at Deadline (FR-8)
    H->>API: 22. Verify Collection Token (FR-30)
    H->>API: 23. Confirm Bag Release (FR-31)
    API->>PG: 24. Transition Booking -> COMPLETED; Unlock Net Host Balance

    Note over H,Admin: Phase 5: Post-Storage Settlement (WF-HST-015 / WF-ADM-003)
    Admin->>API: 25. Inspect Host Payable Balances in Superadmin (FR-37)
    Admin->>Admin: 26. Execute Manual Bank Transfer Payout (FR-37)
    Admin->>API: 27. Record External Bank Reference & Mark COMPLETED
    API->>PG: 28. Debit Host Payable Balance & Append Payout Ledger
```

---

## 3. Traveller Workflows (`WF-TRV-001` to `WF-TRV-015`)

---

### `WF-TRV-001` — Traveller Registration & Authentication
- **Workflow ID:** `WF-TRV-001`
- **Name:** Traveller Account Registration & Social Authentication
- **Primary Actor:** Guest Visitor / Traveller (`ACT-01`)
- **Supporting Actors:** Google / Apple OAuth Provider
- **Trigger:** User opens app and taps "Sign In" or "Create Account".
- **Preconditions:** Network connectivity available.
- **Main Success Path:**
  1. User selects sign-in method: Email/Password, Continue with Google, or Continue with Apple.
  2. For email registration: User inputs first name, last name, valid email, and password.
  3. Client validates format via `@luggage/validation` (Zod) and submits to `/api/v1/auth/register`.
  4. Backend hashes password using Argon2id, generates email verification token, and creates user entity.
  5. Backend returns initial JWT access token + secure refresh token.
  6. Application routes user to home discovery view.
- **Alternative Paths:**
  - *OAuth:* User selects Google/Apple; OAuth native sheet returns authorization code; backend exchanges code via Arctic, links OAuth provider to unified `User`, and issues session tokens.
- **Failure Paths:**
  - *Email already registered:* Backend returns 409 Conflict; client offers password reset or login shortcut.
  - *OAuth cancellation:* User cancels native sheet; app returns to auth screen with no changes.
- **Resulting State:** Authenticated `User` record created with active session tokens.
- **Related Requirements:** `REQ-TRV-001`, `REQ-TRV-002`.
- **Classification:** `EXPLICIT` (FRS `FR -1`).

---

### `WF-TRV-002` — Profile & Contact Management
- **Workflow ID:** `WF-TRV-002`
- **Name:** Traveller Profile Details & Preference Management
- **Primary Actor:** Traveller (`ACT-01`)
- **Supporting Actors:** None
- **Trigger:** Traveller navigates to "Profile" tab.
- **Preconditions:** Traveller is authenticated (`WF-TRV-001`).
- **Main Success Path:**
  1. Traveller edits contact telephone number or emergency travel contact.
  2. System validates phone number format according to international E.164 standards.
  3. Traveller selects display currency (LKR) and notification preferences.
  4. Client updates `/api/v1/traveller/profile` and receives confirmation.
- **Alternative Paths:** Traveller changes password; backend verifies old password hash before updating.
- **Failure Paths:** Invalid E.164 phone format; client displays validation error.
- **Resulting State:** Profile updated in PostgreSQL `traveller_profiles`.
- **Related Requirements:** `REQ-TRV-002`, `REQ-TRV-026`, `REQ-TRV-027`.
- **Classification:** `EXPLICIT` (FRS `FR-2`).

---

### `WF-TRV-003` — Location Discovery via GPS & Destination Search
- **Workflow ID:** `WF-TRV-003`
- **Name:** Discover Nearby Storage Locations
- **Primary Actor:** Guest Visitor / Traveller (`ACT-01`)
- **Supporting Actors:** Expo Location / Device GPS, Geocoding Provider
- **Trigger:** User opens app home screen or inputs destination query.
- **Preconditions:** App has map permissions or search bar text is entered.
- **Main Success Path:**
  1. App queries current GPS coordinates via `expo-location` (e.g., Colombo Fort, LK).
  2. Client submits coordinates to `/api/v1/public/locations/search?lat=...&lng=...&radius=5000`.
  3. Backend queries PostGIS database using spatial index (`ST_DWithin`).
  4. Backend filters for `APPROVED` hosts and `ACTIVE` storage locations.
  5. Results returned sorted by distance ascending with approximate coordinates (`OQ-012`).
  6. UI renders Map View (`MapLibre`) pins and synchronizes scrollable bottom list sheet.
- **Alternative Paths:** User types destination text (e.g., "Galle Fort"); geocoding resolves coordinates and triggers spatial search.
- **Failure Paths:** GPS permissions denied; app prompts user to enter city or landmark manually.
- **Resulting State:** Search results rendered on Map and List views.
- **Related Requirements:** `REQ-TRV-003`, `REQ-TRV-004`, `REQ-TRV-005`.
- **Classification:** `EXPLICIT` (FRS `FR -2`, `FR-3`, `FR -3`).

---

### `WF-TRV-004` — Filtering & Listing Inspection
- **Workflow ID:** `WF-TRV-004`
- **Name:** Multi-Criteria Filtering & Viewing Host Details
- **Primary Actor:** Guest Visitor / Traveller (`ACT-01`)
- **Supporting Actors:** None
- **Trigger:** Traveller applies search filters or taps a listing card.
- **Preconditions:** Search results displayed (`WF-TRV-003`).
- **Main Success Path:**
  1. Traveller selects filters: "Open Now", "Rating 4.5+", "CCTV Monitored".
  2. Client sends query params to API; matching listings returned.
  3. Traveller taps a listing to open Host Details page.
  4. Page displays photo gallery, approximate neighborhood map circle, opening hours, facilities, storage restrictions, and verified reviews.
  5. Exact street address and storefront name remain masked until booking confirmation (`OQ-012`).
- **Alternative Paths:** Traveller taps bookmark icon to save location to Favourites (`REQ-TRV-024`).
- **Failure Paths:** Listing is temporarily deactivated by host or admin; API returns 404/410 with redirection to search.
- **Resulting State:** Traveller viewing detailed listing information.
- **Related Requirements:** `REQ-TRV-006`, `REQ-TRV-007`, `REQ-TRV-021`, `REQ-TRV-024`.
- **Classification:** `EXPLICIT` (FRS `FR-4`, `FR -4`, `FR -11`, `FR-13`).

---

### `WF-TRV-005` — Availability Check & Authoritative Price Quote
- **Workflow ID:** `WF-TRV-005`
- **Name:** Checking Schedule Availability & Price Breakdown
- **Primary Actor:** Traveller (`ACT-01`)
- **Supporting Actors:** None
- **Trigger:** Traveller selects drop-off time, collection time, and bag counts on listing.
- **Preconditions:** Traveller viewing an active listing (`WF-TRV-004`).
- **Main Success Path:**
  1. Traveller selects drop-off: Today 10:00 AM; collection: Today 18:00 PM; bags: 2 Medium.
  2. Client requests quote from `/api/v1/public/locations/:id/quote`.
  3. Availability engine verifies location is open at 10:00 and 18:00 in location local timezone (`Asia/Colombo`).
  4. Capacity engine verifies unreserved capacity pool >= 2 medium bags across the full window.
  5. Pricing engine computes authoritative price breakdown: 2 bags × LKR 500 = LKR 1,000 + LKR 100 platform fee = LKR 1,100.
  6. API returns signed quote token and itemized breakdown.
- **Alternative Paths:** Traveller enters valid promo code (`REQ-TRV-025`); discount line applied.
- **Failure Paths:**
  - *Location Closed:* Host closes at 17:00; API returns error: "Collection time is outside host operating hours".
  - *Capacity Full:* Host has only 1 slot remaining; API returns error: "Insufficient capacity for 2 bags".
- **Resulting State:** Valid quote generated, enabling booking checkout.
- **Related Requirements:** `REQ-TRV-008`, `REQ-TRV-009`, `REQ-TRV-025`.
- **Classification:** `EXPLICIT` (FRS `FR-5`, `FR -5`, `FR -13`).

---

### `WF-TRV-006` — Instant Booking & Online Payment
- **Workflow ID:** `WF-TRV-006`
- **Name:** Instant Booking Reservation & PayHere Checkout
- **Primary Actor:** Traveller (`ACT-01`)
- **Supporting Actors:** PayHere Payment Gateway
- **Trigger:** Traveller taps "Book Now & Pay" on quote screen.
- **Preconditions:** Traveller authenticated; valid quote token; location in Instant Booking mode.
- **Main Success Path:**
  1. Client calls `POST /api/v1/traveller/bookings` with quote token.
  2. Backend atomically reserves capacity hold (15-minute TTL) and creates booking record in `PAYMENT_PENDING` status.
  3. Backend generates PayHere checkout payload with MD5 cryptographic hash and returns checkout parameters.
  4. Client launches PayHere checkout interface; traveller enters payment details.
  5. PayHere processes payment and dispatches asynchronous server-to-server webhook notification (`notify_url`).
  6. Backend verifies webhook checksum, transitions payment to `SUCCEEDED`, and transitions booking to `CONFIRMED`.
  7. Backend records financial ledger credit, generates dynamic QR/PIN custody tokens, and unmasks exact location address.
  8. Client displays Booking Confirmation screen (`REQ-TRV-012`).
- **Alternative Paths:** Web checkout on Public Web (`PW`) follows identical server webhook reconciliation.
- **Failure Paths:**
  - *Payment Cancelled/Failed:* PayHere returns failure status; capacity reservation released; booking marked `PAYMENT_FAILED`.
  - *Timeout:* Traveller abandons checkout; background worker (`REQ-IMPL-004`) expires hold after 15 minutes.
- **Resulting State:** Booking confirmed, payment reconciled, capacity locked.
- **Related Requirements:** `REQ-TRV-010`, `REQ-TRV-011`, `REQ-TRV-012`, `REQ-IMPL-004`, `REQ-IMPL-006`.
- **Classification:** `EXPLICIT` (FRS `FR-6`, `FR -6`, `FR-7`).

---

### `WF-TRV-007` — Host Approval Booking Workflow
- **Workflow ID:** `WF-TRV-007`
- **Name:** Booking Request Under Host Approval Mode
- **Primary Actor:** Traveller (`ACT-01`)
- **Supporting Actors:** Host Owner (`ACT-02`), PayHere Payment Gateway
- **Trigger:** Traveller books at a location configured for `HOST_APPROVAL` (`REQ-HST-012`, `OQ-004`).
- **Preconditions:** Location `booking_mode` = `HOST_APPROVAL`; availability quote valid.
- **Main Success Path:**
  1. Traveller submits booking request without upfront payment; system creates request in `AWAITING_HOST_APPROVAL` state and reserves temporary capacity hold (`OQ-004`).
  2. System dispatches urgent push and SMS notifications to Host (`REQ-HST-021`).
  3. Host opens dashboard and accepts the booking within the **15-minute default SLA** (`REQ-HST-012`, `BR-069`, `OQ-004`).
  4. Request transitions to `AWAITING_TRAVELLER_PAYMENT`; traveller receives immediate payment notification with a **10-minute payment countdown** (`BR-070`, `OQ-004`).
  5. Traveller opens payment screen, completes checkout via PayHere, and backend verifies payment webhook (`REQ-TRV-011`).
  6. Booking transitions to `CONFIRMED`; secure dynamic QR/PIN custody tokens and unmasked storefront address/directions are issued to traveller (`REQ-TRV-012`, `REQ-TRV-013`, `OQ-012`).
- **Alternative Paths (Host Rejection or Host SLA Expiration):**
  - Host taps "Decline" or 15-minute host SLA timer expires without response.
  - Booking request transitions to `REJECTED` or `EXPIRED`.
  - Temporary capacity hold is immediately released.
  - Traveller is notified of rejection/expiration. **No payment was captured**, so no refund transaction is required (`OQ-004`).
- **Alternative Paths (Traveller Payment Timeout):**
  - Host accepted, but traveller fails to complete payment within the 10-minute payment window.
  - Booking transitions to `PAYMENT_EXPIRED`; capacity reservation is released.
- **Resulting State:** Booking confirmed (upon verified payment) OR request rejected/expired with zero funds captured.
- **Related Requirements:** `REQ-TRV-010`, `REQ-TRV-011`, `REQ-HST-012`, `BR-023`, `BR-069`, `BR-070`, `OQ-004`.
- **Classification:** `EXPLICIT` (`FR-26 Depends`); approved owner decision (`OQ-004`).

### `WF-TRV-008` — Navigation to Host Location
- **Workflow ID:** `WF-TRV-008`
- **Name:** Turn-by-Turn Navigation to Storage Storefront
- **Primary Actor:** Traveller (`ACT-01`)
- **Supporting Actors:** Native Navigation App (Google Maps, Apple Maps)
- **Trigger:** Traveller prepares to drop off bags and taps "Get Directions".
- **Preconditions:** Booking status is `CONFIRMED`.
- **Main Success Path:**
  1. Traveller opens active booking on TM.
  2. Booking view displays exact store name, street address, entrance photos, and host contact phone.
  3. Traveller taps "Get Directions" button (`FR -7 Directions`).
  4. App launches native Google Maps or Apple Maps app with exact verified GPS coordinates.
  5. Traveller navigates to host storefront.
- **Alternative Paths:** Traveller calls host using in-app phone link if storefront is difficult to locate.
- **Failure Paths:** External navigation app not installed; app falls back to in-app MapLibre routing view.
- **Resulting State:** Traveller arrives at physical host location.
- **Related Requirements:** `REQ-TRV-012`, `REQ-TRV-013`.
- **Classification:** `EXPLICIT` (FRS `FR -7`).

---

### `WF-TRV-009` — Bag Drop-Off & Custody Handoff
- **Workflow ID:** `WF-TRV-009`
- **Name:** Luggage Drop-Off and Check-In Verification
- **Primary Actor:** Traveller (`ACT-01`)
- **Supporting Actors:** Host Partner / Staff (`ACT-02` / `ACT-03`)
- **Trigger:** Traveller arrives at host location during drop-off window.
- **Preconditions:** Booking status is `CONFIRMED`.
- **Main Success Path:**
  1. Traveller presents TM screen displaying dynamic booking QR code and numerical PIN (`REQ-TRV-014`).
  2. Host scans QR or inputs PIN on Host Mobile App (`REQ-HST-013`).
  3. Host counts and verifies bags (`REQ-HST-014`).
  4. Host photographs bags and tags (`REQ-HST-015`).
  5. Host confirms check-in on HM; backend updates booking to `CHECKED_IN`.
  6. Traveller's TM app updates to active storage countdown mode within 5 seconds.
- **Alternative Paths:** Traveller's phone battery is depleted; traveller provides booking reference and PIN orally; host manually inputs PIN on HM.
- **Failure Paths:** Wrong host location; scan fails with "Invalid Booking for this Location".
- **Resulting State:** Physical custody transferred; booking status = `CHECKED_IN`.
- **Related Requirements:** `REQ-TRV-014`, `REQ-HST-013`, `REQ-HST-014`, `REQ-HST-015`.
- **Classification:** `EXPLICIT` (FRS `FR-8`, `FR-27`–`FR-29`).

---

### `WF-TRV-010` — Active Storage Tracking & Alerts
- **Workflow ID:** `WF-TRV-010`
- **Name:** Monitoring Storage Duration and Reminders
- **Primary Actor:** Traveller (`ACT-01`)
- **Supporting Actors:** Background Reminder Worker
- **Trigger:** Bags are in storage (`CHECKED_IN`).
- **Preconditions:** Booking status is `CHECKED_IN`.
- **Main Success Path:**
  1. Traveller views TM home tab, rendering persistent Active Booking tracker card (`REQ-TRV-016`).
  2. Tracker shows real-time countdown timer to host's collection deadline.
  3. 60 minutes before deadline, system sends push notification reminder to collect luggage (`REQ-TRV-020`).
- **Alternative Paths:** Traveller needs assistance; taps "Help / Support" from active booking card.
- **Failure Paths:** Traveller misses deadline; booking transitions to `OVERDUE` state with late fee warning.
- **Resulting State:** Traveller informed of remaining storage time.
- **Related Requirements:** `REQ-TRV-016`, `REQ-TRV-020`, `REQ-HST-018`.
- **Classification:** `EXPLICIT` (FRS `FR-9`, `FR-11`, `FR-32`).

---

### `WF-TRV-011` — Luggage Collection & Handover
- **Workflow ID:** `WF-TRV-011`
- **Name:** Secure Luggage Retrieval and Check-Out
- **Primary Actor:** Traveller (`ACT-01`)
- **Supporting Actors:** Host Partner / Staff (`ACT-02` / `ACT-03`)
- **Trigger:** Traveller returns to host storefront before collection deadline.
- **Preconditions:** Booking status is `CHECKED_IN`.
- **Main Success Path:**
  1. Traveller opens TM and displays Collection QR / PIN token (`REQ-TRV-015`).
  2. Host verifies token on HM (`REQ-HST-016`).
  3. Host inspects stored luggage against registered bag tags and photo evidence.
  4. Host returns luggage to traveller and confirms release on HM (`REQ-HST-017`).
  5. Booking transitions to `COMPLETED`; custody terminates.
  6. Traveller app displays completion celebration screen and prompts for review.
- **Alternative Paths (Late Collection):**
  - Collection occurs after deadline + grace period.
  - Host HM displays overdue fee calculated by pricing engine (`REQ-HST-018`).
  - Overdue fee is resolved before release; host confirms check-out.
- **Failure Paths:** Unauthorized person attempts pickup with invalid token; host rejects release.
- **Resulting State:** Booking `COMPLETED`; custody released.
- **Related Requirements:** `REQ-TRV-015`, `REQ-HST-016`, `REQ-HST-017`, `REQ-HST-018`.
- **Classification:** `EXPLICIT` (FRS `FR -8`, `FR-30`, `FR-31`, `FR-32`).

---

### `WF-TRV-012` — Booking Cancellation & Refund Tracking
- **Workflow ID:** `WF-TRV-012`
- **Name:** Traveller Cancellation and Refund Lifecycle
- **Primary Actor:** Traveller (`ACT-01`)
- **Supporting Actors:** Superadmin / Payment Gateway
- **Trigger:** Traveller taps "Cancel Booking" on upcoming reservation.
- **Preconditions:** Booking status is `CONFIRMED` or `AWAITING_HOST_APPROVAL` (prior to drop-off).
- **Main Success Path:**
  1. Traveller selects cancellation reason and confirms request (`REQ-TRV-018`).
  2. System verifies cancellation is within policy cutoff window.
  3. Booking transitions to `CANCELLED`; reserved capacity immediately released to pool.
  4. System generates refund record in `PENDING` status.
  5. Traveller tracks refund progress on Refund Status screen (`REQ-TRV-019`).
  6. Superadmin / Payment gateway processes refund; status transitions to `COMPLETED`.
- **Alternative Paths:** Cancellation submitted outside free refund window; system calculates partial refund or forfeiture per policy.
- **Failure Paths:** Check-in has already occurred; cancellation button is disabled.
- **Resulting State:** Booking cancelled; refund tracked and completed.
- **Related Requirements:** `REQ-TRV-018`, `REQ-TRV-019`, `REQ-IMPL-008`.
- **Classification:** `EXPLICIT` (FRS `FR-10`, `FR -10`).

---

### `WF-TRV-013` — Post-Collection Rating & Feedback
- **Workflow ID:** `WF-TRV-013`
- **Name:** Submitting Host Review and App Feedback
- **Primary Actor:** Traveller (`ACT-01`)
- **Supporting Actors:** None
- **Trigger:** Booking reaches `COMPLETED` status.
- **Preconditions:** Traveller completed a verified booking; no prior review submitted.
- **Main Success Path:**
  1. Traveller receives post-collection review prompt.
  2. Traveller selects star rating (1 to 5) and writes feedback for the Host (`REQ-TRV-022`).
  3. Traveller optionally submits a separate rating and comments for the platform mobile app.
  4. System saves host review linked to booking ID, updates host aggregate rating, and routes review to moderation.
- **Alternative Paths:** Traveller skips app feedback; only host review is submitted.
- **Failure Paths:** Booking is not completed; review endpoint rejects submission.
- **Resulting State:** Review published or queued for moderation.
- **Related Requirements:** `REQ-TRV-021`, `REQ-TRV-022`, `REQ-HST-025`, `REQ-IMPL-009`.
- **Classification:** `EXPLICIT` (FRS `FR-12`).

---

### `WF-TRV-014` — Customer Support Ticket Creation
- **Workflow ID:** `WF-TRV-014`
- **Name:** Reporting Customer Issues & Inquiries
- **Primary Actor:** Traveller (`ACT-01`)
- **Supporting Actors:** Platform Support Staff (`ACT-04`)
- **Trigger:** Traveller encounters an issue or requires help.
- **Preconditions:** Traveller has client open.
- **Main Success Path:**
  1. Traveller navigates to Support Centre (`REQ-TRV-023`).
  2. Traveller selects ticket category: Booking Dispute, Host Not Available, Payment Issue, or General Inquiry.
  3. Traveller attaches booking ID, enters issue description, and submits ticket.
  4. System assigns tracking number and routes ticket to Superadmin/Support dashboard (`AD`).
  5. Support staff responds; traveller receives in-app alert.
- **Alternative Paths:** Emergency issue; traveller accesses helpline or urgent ticket queue.
- **Failure Paths:** Blank description; client form validation blocks submission.
- **Resulting State:** Support ticket opened and tracked.
- **Related Requirements:** `REQ-TRV-023`, `REQ-HST-026`.
- **Classification:** `EXPLICIT` (FRS `FR -12`).

---

### `WF-TRV-015` — Booking History Inspection & Invoicing
- **Workflow ID:** `WF-TRV-015`
- **Name:** Reviewing Past Bookings and Receipts
- **Primary Actor:** Traveller (`ACT-01`)
- **Supporting Actors:** None
- **Trigger:** Traveller opens "Bookings" tab.
- **Preconditions:** Traveller is authenticated.
- **Main Success Path:**
  1. Traveller views list categorized into Upcoming, Active, Completed, Cancelled (`REQ-TRV-017`).
  2. Traveller selects a past completed booking.
  3. Detailed summary displays host name, address, check-in/out timestamps, bag count, itemized price breakdown snapshot, and payment receipt download.
- **Alternative Paths:** Traveller re-books the same host location via quick "Book Again" shortcut.
- **Failure Paths:** Network offline; cached records displayed with offline indicator.
- **Resulting State:** Historical booking records inspected.
- **Related Requirements:** `REQ-TRV-017`, `REQ-IMPL-003`.
- **Classification:** `EXPLICIT` (FRS `FR -9`).

---

## 4. Host Workflows (`WF-HST-001` to `WF-HST-016`)

---

### `WF-HST-001` — Host Partner Application
- **Workflow ID:** `WF-HST-001`
- **Name:** Applying to Become a Storage Host
- **Primary Actor:** Host Applicant (`ACT-02`)
- **Supporting Actors:** None
- **Trigger:** Business owner opens Host Mobile App (`HM`) or taps "Become a Host" on Public Web (`PW`).
- **Preconditions:** User is authenticated or registers a new partner account.
- **Main Success Path:**
  1. Applicant enters business legal name, operating city, contact person, phone number, and host business archetype (Retail, Hotel, Cafe, Dedicated Storage).
  2. Client submits to `/api/v1/host/register`.
  3. Backend creates `Host` organization linked to user as `OWNER` with status `APPLICANT` (`REQ-HST-001`).
  4. System routes applicant immediately to KYC Document Upload wizard (`REQ-HST-002`).
- **Alternative Paths:** Existing traveller applies to become a host; unified identity attaches `Host` entity to existing user account (`OQ-007`).
- **Failure Paths:** Missing required business contact fields; validation rejects submission.
- **Resulting State:** Host organization registered in `APPLICANT` state.
- **Related Requirements:** `REQ-HST-001`, `REQ-HST-004`.
- **Classification:** `EXPLICIT` (FRS `FR-15`, `FR-18`).

---

### `WF-HST-002` — KYC & Business Verification Submission
- **Workflow ID:** `WF-HST-002`
- **Name:** Submitting Verification Documents for Host Approval
- **Primary Actor:** Host Owner (`ACT-02`)
- **Supporting Actors:** Cloudflare R2
- **Trigger:** Host completes registration (`WF-HST-001`).
- **Preconditions:** Host status is `APPLICANT` or `REJECTED`.
- **Main Success Path:**
  1. Host selects entity type: Individual Host or Registered Business (`OQ-002`).
  2. Host uploads required verification files: National Identity Card / Passport photo, Business Registration Certificate, and Proof of Premises (utility bill / lease).
  3. Files are uploaded directly to private Cloudflare R2 bucket via backend pre-signed URLs (`REQ-HST-002`).
  4. Host submits verification bundle; status transitions to `PENDING_APPROVAL`.
  5. Submission enters the Superadmin verification review queue (`WF-ADM-001`).
- **Alternative Paths:** Host re-submits corrected documents following administrative feedback.
- **Failure Paths:** File size exceeds 10 MB or unsupported file type; client rejects upload.
- **Resulting State:** Documents securely stored in R2; verification pending review.
- **Related Requirements:** `REQ-HST-002`, `REQ-HST-003`, `ADR-009`.
- **Classification:** `EXPLICIT` (FRS `FR-16`).

---

### `WF-HST-003` — Storage Location & Facility Setup
- **Workflow ID:** `WF-HST-003`
- **Name:** Creating and Configuring a Physical Storage Location
- **Primary Actor:** Host Owner (`ACT-02`)
- **Supporting Actors:** Cloudflare R2
- **Trigger:** Host creates a new storage location on HM or Host Dashboard (`HD`).
- **Preconditions:** Host account exists (locations can be prepared before approval, but go live only after approval).
- **Main Success Path:**
  1. Host inputs location address: street, city, postal code, and places map pin on interactive map (`REQ-HST-005`).
  2. Host uploads storefront and storage area photos to R2.
  3. Host selects available security facilities (CCTV, locked storage room, 24/7 staff, elevator access).
  4. Host sets storage restrictions (e.g., maximum bag weight 30 kg, no perishables).
  5. System validates coordinates and saves location record in PostGIS format.
- **Alternative Paths:** Multi-location chain host (`REQ-HST-030`) creates multiple branch locations under one organization.
- **Failure Paths:** Coordinates outside active country boundary (`LK`); system alerts host.
- **Resulting State:** Storage location created and associated with host organization.
- **Related Requirements:** `REQ-HST-005`, `REQ-HST-030`.
- **Classification:** `EXPLICIT` (FRS `FR-19`, `FR-44`).

---

### `WF-HST-004` — Operating Hours & Drop-Off Windows Configuration
- **Workflow ID:** `WF-HST-004`
- **Name:** Configuring Weekly Operating Schedules
- **Primary Actor:** Host Owner (`ACT-02`)
- **Supporting Actors:** None
- **Trigger:** Host configures location hours.
- **Preconditions:** Location created (`WF-HST-003`).
- **Main Success Path:**
  1. Host selects days of the week and specifies opening and closing times (e.g., Mon–Sat 08:00 to 20:00).
  2. Host optionally defines distinct drop-off windows (e.g., 08:00 to 18:00) and collection windows (e.g., 08:00 to 20:00).
  3. System validates that closing time is after opening time and saves weekly schedule in the location's local timezone (`REQ-HST-006`).
- **Alternative Paths:** Host configures 24/7 opening hours with a single toggle.
- **Failure Paths:** Overlapping shift intervals; client displays validation error.
- **Resulting State:** Operating schedule active in `availability` domain.
- **Related Requirements:** `REQ-HST-006`, `BR-016`.
- **Classification:** `EXPLICIT` (FRS `FR-20`).

---

### `WF-HST-005` — Storage Capacity Pool Configuration
- **Workflow ID:** `WF-HST-005`
- **Name:** Setting Storage Capacity Limits & Models
- **Primary Actor:** Host Owner (`ACT-02`)
- **Supporting Actors:** None
- **Trigger:** Host configures storage capacity.
- **Preconditions:** Location created (`WF-HST-003`).
- **Main Success Path:**
  1. Host selects capacity model: Simple Total Count or Category Limits (`REQ-HST-007`).
  2. For simple count: Host enters total concurrent bag limit (e.g., 25 bags).
  3. For category limits: Host enters limits per bag tier (e.g., 10 Small, 10 Medium, 5 Large).
  4. System establishes capacity pool in `capacity` domain with concurrent reservation tracking.
- **Alternative Paths:** Multi-zone storage business configures distinct physical zones (e.g., Zone A, Locker Zone).
- **Failure Paths:** Total capacity set to 0; validation requires minimum capacity of 1 bag.
- **Resulting State:** Capacity pool active and referenced during booking availability checks.
- **Related Requirements:** `REQ-HST-007`, `REQ-TRV-008`, `BR-017`.
- **Classification:** `EXPLICIT` (FRS `FR-21`).

---

### `WF-HST-006` — Availability Blocks & Emergency Stop-Booking
- **Workflow ID:** `WF-HST-006`
- **Name:** Managing Blackout Dates and Emergency Booking Halts
- **Primary Actor:** Host Owner / Host Staff (`ACT-02` / `ACT-03`)
- **Supporting Actors:** None
- **Trigger:** Host needs to block holiday dates or halt bookings due to full store.
- **Preconditions:** Location active.
- **Main Success Path:**
  1. Host opens availability calendar on HM or HD (`REQ-HST-008`).
  2. Host selects a date range (e.g., National holiday weekend) and marks as "Blocked".
  3. Calendar records blackout exception; marketplace search excludes location for those dates.
  4. Alternatively, host toggles "Stop Bookings" emergency switch to pause bookings immediately.
- **Alternative Paths:** Host unblocks previously blacked-out dates.
- **Failure Paths:** Host attempts to block dates that already have confirmed bookings; system alerts host that existing confirmed bookings must still be honored.
- **Resulting State:** Availability exceptions recorded.
- **Related Requirements:** `REQ-HST-008`, `BR-064`, `BR-065`.
- **Classification:** `EXPLICIT` (FRS `FR-22`).

---

### `WF-HST-007` — Storage Pricing Configuration
- **Workflow ID:** `WF-HST-007`
- **Name:** Configuring Storage Rates and Surcharges
- **Primary Actor:** Host Owner (`ACT-02`)
- **Supporting Actors:** None
- **Trigger:** Host sets or modifies pricing rules.
- **Preconditions:** Location created (`WF-HST-003`).
- **Main Success Path:**
  1. Host selects pricing model: Daily Flat Rate, Hourly Rate, or Category Tiered Pricing (`REQ-HST-009`).
  2. Host inputs rates (e.g., LKR 600 per bag per day).
  3. Host optionally specifies minimum duration or multi-day duration discount tiers.
  4. System validates rates against platform minimum floor and saves versioned `PricingPolicy`.
- **Alternative Paths:** Host configures special rates for oversized items (e.g., surfboards).
- **Failure Paths:** Pricing below platform minimum threshold; system rejects rate.
- **Resulting State:** Versioned pricing policy active for future bookings.
- **Related Requirements:** `REQ-HST-009`, `REQ-TRV-009`, `BR-020`.
- **Classification:** `EXPLICIT` (FRS `FR-23`).

---

### `WF-HST-008` — Booking Acceptance / Rejection (Host Approval Mode)
- **Workflow ID:** `WF-HST-008`
- **Name:** Reviewing and Deciding Booking Requests
- **Primary Actor:** Host Owner / Host Staff (`ACT-02` / `ACT-03`)
- **Supporting Actors:** Traveller, Payment Gateway
- **Trigger:** Push notification arrives for a pending booking request (`REQ-HST-021`).
- **Preconditions:** Location operates in `HOST_APPROVAL` mode (`REQ-HST-012`); request is pending with temporary capacity hold; no payment has been captured (`OQ-004`).
- **Main Success Path:**
  1. Host opens booking request on HM or HD (`REQ-HST-011`).
  2. Host reviews traveller profile, bag count, and scheduled drop-off/collection times.
  3. Host taps "Accept Booking" within the **15-minute default SLA window** (`BR-069`, `OQ-004`).
  4. Request transitions to `AWAITING_TRAVELLER_PAYMENT`; traveller receives payment request with a 10-minute payment SLA (`BR-070`, `OQ-004`).
  5. Upon verified traveller payment, booking transitions to `CONFIRMED`; host operational calendar is updated.
- **Alternative Paths (Rejection):**
  - Host taps "Decline Booking" and selects a reason (e.g. store temporarily full, unexpected closure).
  - Booking request transitions to `REJECTED`; capacity hold is immediately released.
  - Traveller is notified of rejection. Zero payment was captured, so no refund is needed (`OQ-004`).
- **Failure Paths (Timeout):** Host fails to respond before the 15-minute SLA timer expires; system automatically voids request (`EXPIRED`) and releases capacity hold.
- **Resulting State:** Request accepted (awaiting payment) OR rejected/expired with capacity released.
- **Related Requirements:** `REQ-HST-012`, `REQ-TRV-010`, `BR-023`, `BR-069`, `BR-070`, `OQ-004`.
- **Classification:** `EXPLICIT` (FRS `FR-26 Depends`); approved owner decision (`OQ-004`).

### `WF-HST-009` — Traveller Check-In & Bag Verification
- **Workflow ID:** `WF-HST-009`
- **Name:** Executing Luggage Check-In Verification at Drop-Off
- **Primary Actor:** Host Owner / Host Staff (`ACT-02` / `ACT-03`)
- **Supporting Actors:** Traveller (`ACT-01`), Cloudflare R2
- **Trigger:** Traveller arrives at location and presents booking QR/PIN.
- **Preconditions:** Booking status is `CONFIRMED`.
- **Main Success Path:**
  1. Host opens HM check-in scanner and scans traveller's QR code (`REQ-HST-013`, `BR-071`, `OQ-014`).
  2. System verifies token validity server-side, validates location match, and returns traveller details.
  3. Host physically inspects bags and confirms exact bag count and category match (`REQ-HST-014`, `BR-072`, `OQ-014`).
  4. If location has photo evidence configured as mandatory (`BR-074`, `OQ-014`) or host opts to capture, host captures luggage photos and attaches physical tag numbers (`REQ-HST-015`).
  5. Captured photos are uploaded to private Cloudflare R2 storage via signed URLs.
  6. Host taps "Confirm Check-In"; booking transitions to `CHECKED_IN` with UTC timestamp and actor log.
- **Alternative Paths (Manual PIN Fallback):** Camera cannot scan QR; host switches to manual PIN entry with server-side rate limiting and audit logging (`BR-032`, `BR-071`, `OQ-014`).
- **Alternative Paths (Optional Photo Skip):** Location operates under default settings (optional photo evidence per `OQ-014`); host confirms verified bag count and proceeds without photo upload.
- **Failure Paths (Count Mismatch):** Physical bag count differs from reservation. The system strictly blocks check-in completion until discrepancy is resolved via additional bag in-app booking/payment or authorized exception (`BR-072`, `BR-073`, `OQ-014`).
- **Resulting State:** Booking in `CHECKED_IN` state; custody audit record sealed.
- **Related Requirements:** `REQ-HST-013`, `REQ-HST-014`, `REQ-HST-015`, `REQ-TRV-014`, `BR-071`, `BR-072`, `BR-074`, `OQ-014`.
- **Classification:** `EXPLICIT` (`FR-27`, `FR-28`, `FR-29`); approved owner decision (`OQ-014`).

### `WF-HST-010` — Operational Booking Dashboard Monitoring
- **Workflow ID:** `WF-HST-010`
- **Name:** Daily Store-Floor Operations Monitoring
- **Primary Actor:** Host Owner / Host Staff (`ACT-02` / `ACT-03`)
- **Supporting Actors:** None
- **Trigger:** Host opens HM or HD dashboard at start of day or shift.
- **Preconditions:** Host is authenticated.
- **Main Success Path:**
  1. Dashboard renders daily operational metrics: Expected Arrivals, Stored Bags, Collections Due, and Overdue Bags (`REQ-HST-010`).
  2. Host taps on any metric to view filtered booking lists.
  3. Host inspects upcoming arrivals to ensure storage area has prepared space.
- **Alternative Paths:** Multi-location host switches between different branch locations via location switcher.
- **Failure Paths:** Network failure; cached dashboard displayed with refresh prompt.
- **Resulting State:** Host has complete visibility over daily luggage operations.
- **Related Requirements:** `REQ-HST-010`, `REQ-HST-011`, `REQ-HST-030`.
- **Classification:** `EXPLICIT` (FRS `FR-24`, `FR-25`, `FR-44`).

---

### `WF-HST-011` — Luggage Collection Verification & Completion
- **Workflow ID:** `WF-HST-011`
- **Name:** Verifying Luggage Release and Completing Booking
- **Primary Actor:** Host Owner / Host Staff (`ACT-02` / `ACT-03`)
- **Supporting Actors:** Traveller (`ACT-01`)
- **Trigger:** Traveller arrives to retrieve stored luggage.
- **Preconditions:** Booking status is `CHECKED_IN`.
- **Main Success Path:**
  1. Host asks traveller for collection verification QR/PIN (`REQ-HST-016`).
  2. Host scans QR or inputs PIN on HM.
  3. System validates token and displays registered bag photos and tag numbers for visual match.
  4. Host locates bags, matches tags, and returns luggage to traveller.
  5. Host taps "Confirm Handover & Complete" (`REQ-HST-017`).
  6. Booking transitions to `COMPLETED`; custody terminates.
  7. Net host earnings move from pending to payable balance.
- **Alternative Paths:** Collection overdue; system triggers Late Collection Handling (`WF-HST-012`).
- **Failure Paths:** Incorrect token presented; app warns "Invalid Collection Token — Do Not Release Luggage".
- **Resulting State:** Luggage released; booking `COMPLETED`; host balance credited.
- **Related Requirements:** `REQ-HST-016`, `REQ-HST-017`, `REQ-TRV-015`.
- **Classification:** `EXPLICIT` (FRS `FR-30`, `FR-31`).

---

### `WF-HST-012` — Overdue Luggage & Late Fee Handling
- **Workflow ID:** `WF-HST-012`
- **Name:** Handling Luggage Not Collected by Scheduled Collection Time
- **Primary Actor:** Host Owner / Host Staff (`ACT-02` / `ACT-03`)
- **Supporting Actors:** Traveller (`ACT-01`), System Worker, PayHere
- **Trigger:** Current time passes collection deadline + configured grace period (default 30 mins).
- **Preconditions:** Booking is in `CHECKED_IN` state.
- **Main Success Path:**
  1. Background worker detects that current time > collection time + grace period (`REQ-HST-018`, `BR-078`).
  2. Booking status automatically transitions to `OVERDUE`.
  3. System dispatches urgent notification alerts to traveller and host.
  4. System computes overdue storage fee based on disclosed location rates (`BR-078`, `OQ-015`).
  5. Traveller arrives late to collect luggage.
  6. Host scans custody QR code or inputs PIN (`REQ-HST-016`); system verifies token and confirms physical bag count.
  7. **Custody Return:** Host releases luggage to traveller upon valid token verification (`WF-HST-011`, `BR-079`).
  8. **Fee Settlement:** Host initiates overdue payment request on HM; traveller reviews itemized overdue charge and completes payment **exclusively via in-app payment** (`BR-079`, `OQ-015`). Cash collection at counter is strictly prohibited.
  9. Server verifies payment webhook; overdue charge is settled in ledger; booking transitions to `COMPLETED`.
- **Alternative Paths (Unpaid or Disputed Overdue Fee at Retrieval):**
  - Traveller disputes the overdue charge calculation or is unable to pay immediately at the counter.
  - **No Possessory Lien:** The host completes physical luggage handoff upon valid token verification (`REQ-HST-016`, `BR-079`). Belongings are **not** held hostage.
  - The unpaid overdue charge is recorded as an outstanding receivable on the traveller's account.
  - Booking transitions to `COMPLETED_WITH_UNPAID_OVERDUE` and is flagged for Platform Support dispute review (`WF-SUP-002`, `REQ-TRV-023`, `OQ-015`).
- **Failure Paths (Abandoned Luggage):** Luggage remains uncollected past 24 hours without contact; host escalates to Abandoned Luggage Incident Report (`WF-HST-013`).
- **Resulting State:** Luggage safely returned to traveller; overdue fee settled via in-app payment OR flagged for platform support receivable recovery.
- **Related Requirements:** `REQ-HST-016`, `REQ-HST-018`, `REQ-TRV-015`, `BR-078`, `BR-079`, `OQ-015`.
- **Classification:** `EXPLICIT` (`FR-32 Late Collection Handling`); approved owner decision (`OQ-015`).

---

### `WF-HST-013` — Incident Reporting (Lost / Damaged / Unclaimed)
- **Workflow ID:** `WF-HST-013`
- **Name:** Filing a Formal Luggage Incident Report
- **Primary Actor:** Host Owner / Host Staff (`ACT-02` / `ACT-03`)
- **Supporting Actors:** Superadmin / Platform Investigators (`ACT-05`)
- **Trigger:** Luggage is damaged, tampered with, reported lost, or unclaimed past maximum holding limit.
- **Preconditions:** Incident involves a specific storage booking.
- **Main Success Path:**
  1. Host navigates to "Incident Reporting" on HM or HD (`REQ-HST-027`).
  2. Host selects incident category: `DAMAGED_LUGGAGE`, `LOST_LUGGAGE`, `UNCLAIMED_OVERDUE`, or `SECURITY_CONCERN`.
  3. Host attaches photos of damage or unclaimed luggage, enters detailed notes, and submits report.
  4. System creates formal `Incident` entity and locks all associated check-in evidence photos under legal hold (`REQ-IMPL-010`).
  5. High-priority alert routed to Superadmin incident investigation desk (`AD`).
- **Alternative Paths:** Support investigator contacts host and traveller to resolve dispute.
- **Failure Paths:** Submission without required evidence photos; form prompts for at least one photo.
- **Resulting State:** Incident logged under legal hold; investigation active.
- **Related Requirements:** `REQ-HST-027`, `REQ-IMPL-010`.
- **Classification:** `EXPLICIT` (FRS `FR-41`).

---

### `WF-HST-014` — Host-Initiated Cancellation
- **Workflow ID:** `WF-HST-014`
- **Name:** Host Cancellation Under Platform Rules
- **Primary Actor:** Host Owner (`ACT-02`)
- **Supporting Actors:** Traveller, Superadmin
- **Trigger:** Host cannot fulfill an upcoming confirmed booking due to emergency.
- **Preconditions:** Booking is `CONFIRMED` prior to drop-off.
- **Main Success Path:**
  1. Host selects booking and taps "Cancel Booking" (`REQ-HST-020`).
  2. Host is presented with platform cancellation warning and penalty rules.
  3. Host enters mandatory cancellation reason and confirms cancellation.
  4. Booking transitions to `CANCELLED_BY_HOST`; capacity released.
  5. System triggers automatic 100% full refund to traveller and sends urgent notification.
  6. Incident is logged in host performance audit log in Superadmin (`AD`).
- **Alternative Paths:** Superadmin contacts nearby host to re-accommodate traveller.
- **Failure Paths:** Host attempts cancellation after check-in; action blocked.
- **Resulting State:** Booking cancelled; traveller fully refunded; host penalty logged.
- **Related Requirements:** `REQ-HST-020`, `REQ-TRV-018`, `REQ-IMPL-008`.
- **Classification:** `EXPLICIT` (FRS `FR-34`).

---

### `WF-HST-015` — Earnings Review & Payout Account Setup
- **Workflow ID:** `WF-HST-015`
- **Name:** Monitoring Earnings and Managing Payout Bank Details
- **Primary Actor:** Host Owner (`ACT-02`)
- **Supporting Actors:** Superadmin (`ACT-05`)
- **Trigger:** Host reviews monthly earnings or enters bank account for payouts.
- **Preconditions:** Host is authenticated as Owner.
- **Main Success Path:**
  1. Host navigates to Earnings Dashboard on HM or HD (`REQ-HST-022`).
  2. Dashboard displays total booking revenue, platform commission deducted, net host earnings, and current payable balance.
  3. Host navigates to "Payout Settings" and enters bank details (bank name, branch code, account number, beneficiary name) (`REQ-HST-023`).
  4. System validates account number format and securely stores beneficiary details.
  5. Host views Payout History tracking manual payout disbursements executed by Superadmin (`REQ-HST-023`, `REQ-HST-024`).
- **Alternative Paths:** Host downloads transaction history as CSV statement (`REQ-HST-024`).
- **Failure Paths:** Host Staff attempts to access earnings; system denies access with 403 Forbidden (`BR-084`).
- **Resulting State:** Payout account configured; earnings auditable.
- **Related Requirements:** `REQ-HST-022`, `REQ-HST-023`, `REQ-HST-024`, `ADR-008`.
- **Classification:** `EXPLICIT` (FRS `FR-36`, `FR-37`, `FR-38`).

---

### `WF-HST-016` — Multi-Location Fleet Management
- **Workflow ID:** `WF-HST-016`
- **Name:** Managing Multiple Storage Locations Under One Host Brand
- **Primary Actor:** Host Owner (`ACT-02`)
- **Supporting Actors:** None
- **Trigger:** Multi-location partner (e.g., Barista chain) manages storage across branches.
- **Preconditions:** Host is approved and operates multiple locations (`REQ-HST-030`).
- **Main Success Path:**
  1. Host logs into Host Web Dashboard (`HD`).
  2. Location Switcher in navigation header displays all branch locations.
  3. Host selects "Colombo Fort Branch" to inspect its bookings, capacity, and hours.
  4. Host switches to "Kandy City Center Branch" to adjust opening hours.
  5. Consolidated earnings view displays total revenue across all branches with per-branch drill-down.
- **Alternative Paths:** Host adds a new branch location; location enters setup and verification flow.
- **Failure Paths:** Unauthorized branch access; system enforces strict tenant isolation.
- **Resulting State:** Multi-location portfolio administered centrally.
- **Related Requirements:** `REQ-HST-030`, `REQ-HST-005`, `REQ-HST-022`.
- **Classification:** `EXPLICIT` (FRS `FR-44`).

---

## 5. Host Staff Workflows (`WF-STF-001` to `WF-STF-003`)

*Note: Classified as `Later` in FRS (`FR-42`). Workflows represent normalized operational scope for initial UI preview and Phase 11 backend activation.*

---

### `WF-STF-001` — Staff Member Onboarding & Invitation
- **Workflow ID:** `WF-STF-001`
- **Name:** Staff Invitation and Location Assignment
- **Primary Actor:** Host Owner (`ACT-02`)
- **Supporting Actors:** Host Staff (`ACT-03`)
- **Trigger:** Host owner invites store employees.
- **Preconditions:** Host organization active.
- **Main Success Path:**
  1. Host owner navigates to "Staff Management" on HD or HM (`REQ-HST-028`).
  2. Owner inputs employee name, email, and assigns them to one or more specific `StorageLocations`.
  3. System sends email invitation with registration link.
  4. Employee accepts invite, creates password, and logs into Host Mobile App.
  5. Employee's view is scoped exclusively to assigned branch locations.
- **Alternative Paths:** Owner revokes staff access; session immediately terminated.
- **Failure Paths:** Email already associated with another host staff account; system alerts owner.
- **Resulting State:** Host staff account active with scoped location permissions.
- **Related Requirements:** `REQ-HST-028`.
- **Classification:** `EXPLICIT` / `Later` (FRS `FR-42`).

---

### `WF-STF-002` — Store-Floor Check-In / Check-Out Execution
- **Workflow ID:** `WF-STF-002`
- **Name:** Staff-Executed Drop-Off and Collection
- **Primary Actor:** Host Staff (`ACT-03`)
- **Supporting Actors:** Traveller (`ACT-01`)
- **Trigger:** Traveller arrives at assigned branch location.
- **Preconditions:** Staff logged into HM; scoped to current location.
- **Main Success Path:**
  1. Staff views today's booking dashboard for their assigned location.
  2. Staff scans traveller drop-off QR code (`REQ-HST-013`).
  3. Staff verifies bag count and captures check-in photo evidence (`REQ-HST-014`, `REQ-HST-015`).
  4. Audit record logs `acted_by_user_id` as the staff member's ID.
  5. At collection, staff scans collection QR and completes booking (`REQ-HST-016`, `REQ-HST-017`).
- **Alternative Paths:** Staff handles overdue collection under standard late fee rules (`REQ-HST-018`).
- **Failure Paths:** Staff attempts to scan booking belonging to a different branch; system denies action.
- **Resulting State:** Custody operation executed by verified staff attendant.
- **Related Requirements:** `REQ-HST-028`, `REQ-HST-013`–`REQ-HST-017`.
- **Classification:** `EXPLICIT` / `Later` (FRS `FR-42`).

---

### `WF-STF-003` — Financial & Bank Settings Restriction Enforcement
- **Workflow ID:** `WF-STF-003`
- **Name:** Restricting Staff from Host Financial Controls
- **Primary Actor:** Host Staff (`ACT-03`)
- **Supporting Actors:** None
- **Trigger:** Staff navigates HM or HD menu.
- **Preconditions:** User is authenticated with `HOST_STAFF` role.
- **Main Success Path:**
  1. Staff interface hides Earnings Dashboard (`REQ-HST-022`), Payout Management (`REQ-HST-023`), and Bank Details.
  2. Direct API requests to `/api/v1/host/finance/*` or `/api/v1/host/payouts/*` return 403 Forbidden.
  3. Staff can only access operational tabs: Dashboard, Bookings, Check-in/out Scanner, and Support.
- **Alternative Paths:** None.
- **Failure Paths:** Attempted privilege escalation; security alert logged.
- **Resulting State:** Host financial privacy and bank accounts protected.
- **Related Requirements:** `REQ-HST-028`, `REQ-HST-022`, `REQ-HST-023`, `BR-084`.
- **Classification:** `IMPLIED` (Required to enforce `FR-42` boundary).

---

## 6. Platform Support Staff Workflows (`WF-SUP-001` to `WF-SUP-004`)

---

### `WF-SUP-001` — Host KYC Verification Triage
- **Workflow ID:** `WF-SUP-001`
- **Name:** Reviewing Host Application Documents
- **Primary Actor:** Platform Support Staff (`ACT-04`)
- **Supporting Actors:** Superadmin (`ACT-05`), Host Owner (`ACT-02`)
- **Trigger:** Host completes KYC submission (`WF-HST-002`).
- **Preconditions:** Host application status is `SUBMITTED`.
- **Main Success Path:**
  1. Support staff opens pending verification queue on Admin Dashboard.
  2. Staff inspects national identity document / business registration certificate.
  3. Staff verifies document clarity, name match, and validity.
  4. Staff logs internal verification notes and **recommends approval to Superadmin** (`OQ-011`). Support staff does not have independent approval authority (`BR-096`).
  5. Superadmin reviews recommendation and executes formal approval (`WF-ADM-001`, `BR-097`).
- **Alternative Paths:** Documents are blurry or incomplete; staff requests re-upload with specific guidance.
- **Failure Paths:** Fraudulent documents detected; staff flags account and escalates to Superadmin for blacklisting.
- **Resulting State:** Host application verified and recommended to Superadmin for final approval.
- **Related Requirements:** `REQ-HST-002`, `REQ-HST-003`, `BR-096`, `BR-097`, `OQ-002`, `OQ-011`.
- **Classification:** `EXPLICIT` (`FR-16`, `FR-17`); approved owner decision (`OQ-011`).

### `WF-SUP-002` — Customer & Host Support Ticket Resolution
- **Workflow ID:** `WF-SUP-002`
- **Name:** Handling Support Enquiries & Refund Requests
- **Primary Actor:** Platform Support Staff (`ACT-04`)
- **Supporting Actors:** Traveller, Host Owner, Superadmin (`ACT-05`)
- **Trigger:** User submits a support ticket (`WF-TRV-014`).
- **Preconditions:** Ticket status is `OPEN`.
- **Main Success Path:**
  1. Support staff assigns ticket to themselves on Admin Dashboard.
  2. Staff reviews booking history, payment status, and user correspondence.
  3. Staff sends helpful response to user.
  4. For refund requests, staff investigates facts, logs case notes, and **escalates to Superadmin for refund authorization** (`BR-096`, `OQ-011`). Support staff cannot independently authorize or execute refunds.
  5. Staff marks ticket `RESOLVED` once actioned.
- **Alternative Paths:** Issue involves safety/theft incident; escalated immediately to Superadmin and legal queue.
- **Resulting State:** Ticket resolved; customer notified; financial actions routed to Superadmin.
- **Related Requirements:** `REQ-TRV-023`, `REQ-HST-026`, `REQ-HST-027`, `BR-096`, `BR-097`, `OQ-011`.
- **Classification:** `EXPLICIT` (`FR-12`, `FR-40`); approved owner decision (`OQ-011`).

### `WF-SUP-003` — Luggage Incident Investigation
- **Workflow ID:** `WF-SUP-003`
- **Name:** Investigating Lost, Damaged, or Unclaimed Luggage
- **Primary Actor:** Platform Support / Investigation Staff (`ACT-04`)
- **Supporting Actors:** Host (`ACT-02`), Traveller (`ACT-01`), Superadmin (`ACT-05`)
- **Trigger:** Host or traveller files an Incident Report (`REQ-HST-027`).
- **Preconditions:** Booking placed under legal hold (`REQ-IMPL-010`).
- **Main Success Path:**
  1. Investigator opens Incident Investigation Console on `AD`.
  2. Console displays full immutable timeline: booking snapshot, check-in timestamp, check-in photo evidence (`REQ-HST-015`), bag tag IDs, and check-out records.
  3. Investigator compares check-in photos against reported damage photos.
  4. Investigator interviews host and traveller via secure ticket thread.
  5. Investigator determines liability and submits formal resolution proposal to Superadmin.
- **Alternative Paths:** Unclaimed bag investigation; investigator coordinates return to traveller or disposal after statutory holding window.
- **Failure Paths:** Evidence tampered; system logs detect any discrepancy in cryptographic hashes.
- **Resulting State:** Incident investigated with sealed evidence record.
- **Related Requirements:** `REQ-HST-027`, `REQ-IMPL-010`.
- **Classification:** `EXPLICIT` (FRS `FR-41`).

---

### `WF-SUP-004` — Review Moderation Queue
- **Workflow ID:** `WF-SUP-004`
- **Name:** Moderating Flagged Traveller Reviews
- **Primary Actor:** Platform Support Staff (`ACT-04`)
- **Supporting Actors:** None
- **Trigger:** Host reports a review as abusive, or automated sentiment filter flags content.
- **Preconditions:** Review reported (`REQ-HST-025`).
- **Main Success Path:**
  1. Staff opens Review Moderation queue on `AD` (`REQ-IMPL-009`).
  2. Staff inspects review text, associated booking record, and host report reason.
  3. If review violates community guidelines (hate speech, spam, extortion): staff taps "Remove Review".
  4. System hides review from public listing and recalculates host aggregate rating.
- **Alternative Paths:** Review is a legitimate negative experience; staff taps "Uphold Review"; review remains visible.
- **Failure Paths:** None.
- **Resulting State:** Moderation action logged with reviewer audit trail.
- **Related Requirements:** `REQ-HST-025`, `REQ-TRV-021`, `REQ-IMPL-009`.
- **Classification:** `IMPLIED` (Required by `FR-12`, `FR-39`).

---

## 7. Superadmin Workflows (`WF-ADM-001` to `WF-ADM-006`)

---

### `WF-ADM-001` — Final Host Approval & Suspension Oversight
- **Workflow ID:** `WF-ADM-001`
- **Name:** Host Onboarding Governance & Account Suspension
- **Primary Actor:** Superadmin (`ACT-05`)
- **Supporting Actors:** Host Owner (`ACT-02`)
- **Trigger:** Host KYC reviewed (`WF-SUP-001`) or compliance audit triggered.
- **Preconditions:** Superadmin authenticated with MFA.
- **Main Success Path:**
  1. Superadmin reviews pending host applications on `AD` (`REQ-HST-003`).
  2. Superadmin confirms host meets regulatory and safety criteria and approves host.
  3. Host transitions to `APPROVED`; all valid locations become publicly bookable.
  4. For non-compliant hosts: Superadmin suspends host account, cancelling upcoming bookings with full refunds and removing listings from search.
- **Alternative Paths:** Superadmin approves individual locations while keeping other locations under review.
- **Failure Paths:** Superadmin session expired; MFA challenge required.
- **Resulting State:** Host approval status updated; audit record logged.
- **Related Requirements:** `REQ-HST-003`, `REQ-IMPL-002`, `REQ-IMPL-014`.
- **Classification:** `EXPLICIT` (FRS `FR-17`).

---

### `WF-ADM-002` — Platform Commission & Promo Campaign Configuration
- **Workflow ID:** `WF-ADM-002`
- **Name:** Managing Platform Commission Rates and Promotional Offers
- **Primary Actor:** Superadmin (`ACT-05`)
- **Supporting Actors:** None
- **Trigger:** Platform updates business model or launches a marketing campaign.
- **Preconditions:** Superadmin authenticated.
- **Main Success Path:**
  1. Superadmin navigates to "Financial Settings" on `AD` (`REQ-IMPL-013`).
  2. Superadmin configures platform commission model (e.g., 15% host commission deduction + 5% traveller service fee).
  3. Superadmin navigates to "Promotions" and creates a promo code: `COLOMBO20` (20% off, max 500 uses, valid till end of month) (`REQ-TRV-025`).
  4. System saves versioned rules; new quotes calculate according to updated parameters.
- **Alternative Paths:** Superadmin sets custom commission negotiated with a large franchise partner (e.g., Barista multi-location host).
- **Failure Paths:** Negative commission rate entered; validation rejects value.
- **Resulting State:** Commission policies and promo campaigns active.
- **Related Requirements:** `REQ-TRV-025`, `REQ-HST-022`, `REQ-IMPL-013`.
- **Classification:** `EXPLICIT` / `IMPLIED` (FRS `FR -13`, `FR-36`, `FR-38`).

---

### `WF-ADM-003` — Manual Host Payout Execution & Disbursement Logging
- **Workflow ID:** `WF-ADM-003`
- **Name:** Superadmin Manual Host Payout Workflow (`FR-37`)
- **Primary Actor:** Superadmin (`ACT-05`)
- **Supporting Actors:** Bank Transfer Rails
- **Trigger:** Scheduled weekly/bi-weekly payout cycle or host payout request.
- **Preconditions:** Host has accumulated available payable balance > payout threshold; verified bank details on file.
- **Main Success Path:**
  1. Superadmin opens "Payout Management" console on `AD` (`REQ-HST-023`, `REQ-IMPL-012`).
  2. Console displays table of eligible hosts with verified bank accounts, payable balances, and completed booking references.
  3. Superadmin generates payout batch file or executes manual bank transfers via platform corporate online banking.
  4. Upon bank transfer execution, Superadmin inputs the bank reference number (e.g., `BOC-TRF-90284`) and marks payout `COMPLETED`.
  5. System appends immutable ledger debit entry (`REQ-IMPL-011`), decrements host payable balance, and dispatches payout advice notification to host.
- **Alternative Paths:** Superadmin places a host payout on hold due to an open luggage incident investigation (`WF-SUP-003`).
- **Failure Paths:** Host bank account flagged invalid; payout blocked until host updates details.
- **Resulting State:** Host payout completed, ledger balanced, external reference logged.
- **Related Requirements:** `REQ-HST-023`, `REQ-HST-024`, `REQ-IMPL-011`, `REQ-IMPL-012`, `ADR-008`.
- **Classification:** `EXPLICIT` (FRS `FR-37`).

---

### `WF-ADM-004` — Traveller Refund Review & Processing
- **Workflow ID:** `WF-ADM-004`
- **Name:** Approving and Dispatching Manual or Exceptional Refunds
- **Primary Actor:** Platform Superadmin (`ACT-05`)
- **Supporting Actors:** Traveller, Payment Gateway (`PaymentGatewayPort`)
- **Trigger:** Refund request escalated from Support (`WF-SUP-002`) or triggered by cancellation policy (`OQ-009`).
- **Preconditions:** Booking is eligible for refund under approved policy tiers (`OQ-009`) or exceptional Superadmin override.
- **Main Success Path (7-Stage Refund Lifecycle):**
  1. System creates refund record in `REQUESTED` state upon cancellation or dispute intake (`BR-036`).
  2. Superadmin opens refund queue on Admin Dashboard (`BR-097`, `OQ-011`) and reviews timeline against policy tiers (>2h = 100%, <2h = 50%, no-show = 0%).
  3. Superadmin authorizes refund; record transitions to `AUTHORIZED` (or `REJECTED` if ineligible).
  4. Superadmin dispatches refund command; record transitions to `INITIATED` and payload is delivered to payment gateway adapter.
  5. Payment gateway acknowledges command; record transitions to `PROCESSING` pending settlement.
  6. Upon gateway webhook verification of fund return, record transitions to `SUCCEEDED`.
  7. System inserts double-entry refund journal entry in financial ledger (`REQ-IMPL-011`) and notifies traveller with reference number.
- **Alternative Paths (Gateway Failure & Manual Reconciliation):**
  - Gateway rejects refund (e.g. expired card, insufficient merchant balance); record transitions to `FAILED`.
  - System automatically escalates failed refund to `MANUAL_REVIEW_REQUIRED` (`BR-036`, `OQ-013`).
  - Superadmin reviews failure code, coordinates with payment provider, and either re-initiates or executes offline settlement.
- **Resulting State:** Refund authorized, executed, and confirmed via 7-stage lifecycle; double-entry ledger reconciled.
- **Related Requirements:** `REQ-TRV-018`, `REQ-TRV-019`, `REQ-HST-020`, `REQ-IMPL-008`, `REQ-IMPL-011`, `BR-035`, `BR-036`, `BR-097`, `OQ-009`, `OQ-011`, `OQ-013`.
- **Classification:** `EXPLICIT` (`FR-10 Refund Status`, `FR-34 Cancellation Policy`); approved owner decision (`OQ-009`, `OQ-011`, `OQ-013`).

---

### `WF-ADM-005` — Platform Audit Log & Security Inspection
- **Workflow ID:** `WF-ADM-005`
- **Name:** Inspecting Administrative Audit Trails and Security Logs
- **Primary Actor:** Superadmin (`ACT-05`)
- **Supporting Actors:** None
- **Trigger:** Periodic security review or incident forensic analysis.
- **Preconditions:** Superadmin authenticated.
- **Main Success Path:**
  1. Superadmin navigates to "Audit & Security Logs" on `AD` (`REQ-IMPL-014`).
  2. Console displays immutable log of all administrative actions: host approvals, manual payouts, refund executions, role changes, and policy updates.
  3. Superadmin filters logs by acting user, IP address, resource type, or date range.
  4. Superadmin exports audit trail for regulatory compliance.
- **Alternative Paths:** None.
- **Failure Paths:** Audit log tampering impossible; database rules enforce append-only `INSERT`.
- **Resulting State:** Audit compliance verified.
- **Related Requirements:** `REQ-IMPL-014`, `BR-100`.
- **Classification:** `IMPLIED` (Required by `ADR-001`, `ADR-005`).

---

### `WF-ADM-006` — Global Country & Currency Management
- **Workflow ID:** `WF-ADM-006`
- **Name:** Activating International Expansion Parameters
- **Primary Actor:** Superadmin (`ACT-05`)
- **Supporting Actors:** None
- **Trigger:** Platform prepares to expand into a new country (e.g., Thailand, UAE).
- **Preconditions:** Superadmin authenticated.
- **Main Success Path:**
  1. Superadmin navigates to "Global Settings" on `AD` (`REQ-IMPL-015`).
  2. Superadmin activates a new country code (ISO 3166-1) and currency code (ISO 4217).
  3. Superadmin configures country-specific address templates, default timezones, tax rates, and verification document checklists.
  4. Platform immediately supports location registrations and searches in the newly activated country without schema changes (`ADR-010`).
- **Alternative Paths:** Superadmin updates reference exchange rates for preview display.
- **Failure Paths:** Missing mandatory country tax configuration; system blocks activation.
- **Resulting State:** New market activated on global-ready foundation.
- **Related Requirements:** `REQ-TRV-026`, `REQ-TRV-027`, `REQ-IMPL-015`, `ADR-010`.
- **Classification:** `IMPLIED` (Required by Global Architecture Mandate & `FR-14`).

