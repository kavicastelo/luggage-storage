# Domain Entity Catalogue

**Project:** Global Luggage Storage Marketplace  
**Document Type:** Domain Architecture Specification  
**Status:** Approved Phase 0C Baseline  
**Governing Documents:** FRS, Phase 0A Architecture, Phase 0B-D Functional Requirements (`FR-001`–`FR-057`, `IR-001`–`IR-015`), Business Rules Catalogue (`BR-001`–`BR-100`).

---

## 1. Architectural Standards for Domain Entities

All domain entities across the Global Luggage Storage Marketplace conform to the following enterprise architecture standards:
1. **Identifier Strategy:** Primary keys use **UUIDv7** (time-ordered, collision-resistant 128-bit identifiers). This guarantees optimal B-Tree index locality in PostgreSQL, chronological sortability, and decentralized generation without distributed sequence coordination (`ADR-005`, `BR-086`).
2. **Explicit Domain Ownership:** Every entity has exactly **one authoritative owning domain**. Other domains reference entities strictly by immutable identifier (UUID) or consume serialized domain event payloads.
3. **Data Sensitivity Classifications:**
   - `PUBLIC`: Publicly accessible metadata (e.g., location names, general amenities, published reviews).
   - `INTERNAL`: Operational metadata restricted to platform services and authenticated hosts.
   - `PII`: Personally Identifiable Information governed by privacy regulations (GDPR, Sri Lanka PDPA No. 9 of 2022). Subject to field-level encryption, masking, and strict access controls.
   - `FINANCIAL`: Highly sensitive ledger, transaction, and banking data requiring append-only auditability and tamper protection.
4. **Historical Snapshots:** Transient terms (pricing rules, tax rates, cancellation terms, location policies) are permanently snapshotted into immutable structures upon booking confirmation (`BR-020`).

---

## 2. Core Entities Catalogue

Below is the definitive catalogue of all core entities across the 22 bounded domains:

### 2.1 Identity and Access Management Domain

#### `User`
- **Business Meaning:** Represents any registered natural person interacting with the marketplace (traveller, host owner, host staff, platform support, superadmin).
- **Owning Domain:** `identity`
- **Identifier Strategy:** UUIDv7 (`user_id`)
- **Key Attributes:** `email`, `password_hash` (Argon2id), `phone_number` (E.164), `is_email_verified`, `is_phone_verified`, `primary_role` (`TRAVELLER`, `HOST`, `SUPPORT`, `SUPERADMIN`), `status` (`ACTIVE`, `SUSPENDED`, `DELETED`), `created_at`, `updated_at`.
- **Relationships:** 1:1 with `TravellerProfile`; 1:1 with `HostProfile`; 1:N with `Session`; 1:N with `AuditLog`.
- **Invariants:** Email must be unique, normalized to lowercase; password hash must never be logged or exposed via API.
- **Sensitivity:** `PII`
- **Retention / Audit:** Retained for account lifetime + 7 years for tax/financial audit trail.

#### `Session`
- **Business Meaning:** An active authenticated session for a web or mobile client.
- **Owning Domain:** `identity`
- **Identifier Strategy:** UUIDv7 (`session_id`)
- **Key Attributes:** `user_id`, `refresh_token_hash`, `device_fingerprint`, `ip_address`, `user_agent`, `expires_at`, `revoked_at`, `last_active_at`.
- **Relationships:** N:1 with `User`.
- **Invariants:** Revoked sessions are immediately rejected; rotating refresh tokens invalidates prior tokens.
- **Sensitivity:** `INTERNAL` / Security Sensitive.
- **Retention:** Auto-purged 30 days after expiration.

---

### 2.2 Traveller Profiles Domain

#### `TravellerProfile`
- **Business Meaning:** Specific preferences, personal details, and travel context for luggage storage customers.
- **Owning Domain:** `travellers`
- **Identifier Strategy:** UUIDv7 (`traveller_id`)
- **Key Attributes:** `user_id`, `first_name`, `last_name`, `preferred_language` (BCP 47), `preferred_currency` (ISO 4217), `emergency_contact_name`, `emergency_contact_phone`, `notes`.
- **Relationships:** 1:1 with `User`; 1:N with `Booking`.
- **Invariants:** `user_id` is globally unique.
- **Sensitivity:** `PII`
- **Retention:** Retained until user initiates account deletion, subject to active booking retention gates.

---

### 2.3 Host and Business Management Domain

#### `HostBusiness`
- **Business Meaning:** The legal business entity or sole proprietorship operating one or more storage locations.
- **Owning Domain:** `hosts`
- **Identifier Strategy:** UUIDv7 (`business_id`)
- **Key Attributes:** `owner_user_id`, `legal_business_name`, `trade_name`, `business_registration_number`, `entity_type` (`SOLE_PROPRIETORSHIP`, `PRIVATE_LIMITED`, `HOTEL`, `RETAIL_SHOP`), `tax_identifier`, `payout_bank_name`, `payout_account_number`, `payout_account_name`, `payout_branch_code`, `status` (`DRAFT`, `PENDING_VERIFICATION`, `ACTIVE`, `SUSPENDED`).
- **Relationships:** N:1 with `User` (Owner); 1:N with `StorageLocation`; 1:N with `HostStaffMembership`; 1:N with `HostVerification`.
- **Invariants:** Must have a verified owner and approved business registration before activating any location.
- **Sensitivity:** `PII` / `FINANCIAL`
- **Retention:** Permanent financial/legal retention (minimum 7 years).

#### `HostProfile`
- **Business Meaning:** Contact, biography, and communication preferences for the host business manager.
- **Owning Domain:** `hosts`
- **Identifier Strategy:** UUIDv7 (`host_profile_id`)
- **Key Attributes:** `user_id`, `business_id`, `display_name`, `avatar_url`, `notification_preferences`.
- **Relationships:** 1:1 with `User`; N:1 with `HostBusiness`.
- **Sensitivity:** `PII`

---

### 2.4 Host Staff and Permissions Domain

#### `HostStaffMembership`
- **Business Meaning:** Represents an authorized employee or staff member linked to a host business and authorized for check-in/out at specific locations.
- **Owning Domain:** `staff`
- **Identifier Strategy:** UUIDv7 (`membership_id`)
- **Key Attributes:** `business_id`, `user_id`, `staff_role` (`MANAGER`, `ATTENDANT`), `assigned_location_ids` (UUID array), `is_active`, `invited_at`, `accepted_at`.
- **Relationships:** N:1 with `HostBusiness`; N:1 with `User`; M:N with `StorageLocation`.
- **Invariants:** Staff cannot approve business-level payouts or bank detail modifications; staff check-in operations are restricted to `assigned_location_ids`.
- **Sensitivity:** `INTERNAL`

---

### 2.5 Storage Locations & Discovery Domains

#### `StorageLocation`
- **Business Meaning:** A physical address where luggage is dropped off, stored, and collected.
- **Owning Domain:** `locations`
- **Identifier Strategy:** UUIDv7 (`location_id`)
- **Key Attributes:** `business_id`, `name`, `description`, `address_line1`, `address_line2`, `city`, `postal_code`, `country_code` (ISO 3166-1 alpha-2, default `'LK'`), `coordinates` (`GEOGRAPHY(Point, 4326)`), `booking_mode` (`INSTANT`, `HOST_APPROVAL`), `accepts_oversized` (Boolean), `amenities` (Array: CCTV, WiFi, AirCon, GroundFloor), `status` (`DRAFT`, `PENDING_REVIEW`, `ACTIVE`, `DISABLED`), `average_rating`, `review_count`.
- **Relationships:** N:1 with `HostBusiness`; 1:N with `StorageZone`; 1:N with `OpeningHours`; 1:N with `OpeningHoursException`; 1:1 with `PricingPolicy`; 1:N with `Booking`.
- **Invariants:** Must have valid PostGIS coordinates; coordinates are jittered (approximate) on public search until booking confirmation (`BR-088`).
- **Sensitivity:** Address & exact coordinates are `INTERNAL` until booking confirmed, then visible to booking traveller.

#### `StorageZone`
- **Business Meaning:** A physical partition or room within a storage location (e.g., front desk closet, secure room, locker bank).
- **Owning Domain:** `locations`
- **Identifier Strategy:** UUIDv7 (`zone_id`)
- **Key Attributes:** `location_id`, `name`, `zone_type` (`LOCKER`, `BACKROOM`, `FRONT_DESK`, `BASEMENT`), `security_tier` (`STANDARD`, `HIGH_SECURITY`), `is_active`.
- **Relationships:** N:1 with `StorageLocation`; 1:N with `StorageCapacityPool`.
- **Invariants:** Zone must belong to an active location.
- **Sensitivity:** `INTERNAL`

#### `OpeningHours`
- **Business Meaning:** Recurring weekly schedule of open and close times for luggage intake and pickup.
- **Owning Domain:** `locations`
- **Identifier Strategy:** UUIDv7 (`opening_hours_id`)
- **Key Attributes:** `location_id`, `day_of_week` (1=Monday ... 7=Sunday), `open_time` (Time), `close_time` (Time), `allows_dropoff` (Boolean), `allows_collection` (Boolean).
- **Relationships:** N:1 with `StorageLocation`.
- **Invariants:** `open_time < close_time`; no overlapping ranges for the same day.
- **Sensitivity:** `PUBLIC`

#### `OpeningHoursException`
- **Business Meaning:** Date-specific overrides to recurring opening hours (e.g., public holidays, emergency closures).
- **Owning Domain:** `locations`
- **Identifier Strategy:** UUIDv7 (`exception_id`)
- **Key Attributes:** `location_id`, `exception_date` (Date), `exception_type` (`CLOSURE`, `SPECIAL_HOURS`), `open_time`, `close_time`, `reason`.
- **Relationships:** N:1 with `StorageLocation`.
- **Sensitivity:** `PUBLIC`

---

### 2.6 Capacity and Availability Domain

#### `StorageCapacityPool`
- **Business Meaning:** A managed capacity quota for a zone or location defining available storage units.
- **Owning Domain:** `capacity`
- **Identifier Strategy:** UUIDv7 (`pool_id`)
- **Key Attributes:** `location_id`, `zone_id`, `pool_type` (`SHARED`, `DEDICATED`), `total_units`, `is_active`.
- **Relationships:** N:1 with `StorageLocation`; N:1 with `StorageZone`; 1:N with `CapacityReservation`.
- **Invariants:** `total_units > 0`.
- **Sensitivity:** `INTERNAL`

#### `CapacityReservation`
- **Business Meaning:** An atomic hold or confirmed allocation of units against a capacity pool for a specific time window.
- **Owning Domain:** `capacity`
- **Identifier Strategy:** UUIDv7 (`reservation_id`)
- **Key Attributes:** `booking_id`, `pool_id`, `units_allocated`, `status` (`HELD`, `CONFIRMED`, `RELEASED`), `expires_at`, `created_at`.
- **Relationships:** N:1 with `StorageCapacityPool`; 1:1 with `Booking`.
- **Invariants:** `HELD` status requires `expires_at` in the future; release must be idempotent.
- **Sensitivity:** `INTERNAL`

---

### 2.7 Pricing and Promotions Domain

#### `PricingPolicy`
- **Business Meaning:** Location-specific rate structure defining base prices, duration units, and category multipliers.
- **Owning Domain:** `pricing`
- **Identifier Strategy:** UUIDv7 (`policy_id`)
- **Key Attributes:** `location_id`, `currency` (ISO 4217, default `'LKR'`), `base_rate_minor` (Integer), `pricing_unit` (`CALENDAR_DAY`, `24_HOUR_BLOCK`), `category_multipliers` (JSONB: Small, Medium, Large, Oversized in basis points).
- **Relationships:** 1:1 with `StorageLocation`.
- **Invariants:** Base rate must be positive integer minor units; multipliers cannot be negative.
- **Sensitivity:** `PUBLIC`

#### `Promotion`
- **Business Meaning:** Marketing discount rules funded by the platform or concessions funded by hosts.
- **Owning Domain:** `pricing`
- **Identifier Strategy:** UUIDv7 (`promotion_id`)
- **Key Attributes:** `promo_code`, `funding_source` (`PLATFORM`, `HOST`), `discount_type` (`PERCENTAGE_BPS`, `FIXED_MINOR`), `discount_value`, `min_booking_minor`, `starts_at`, `ends_at`, `max_redemptions`, `redemption_count`, `is_active`.
- **Invariants:** Host-funded promotions apply only to participating host locations; platform promotions do not reduce host payable.
- **Sensitivity:** `INTERNAL`

---

### 2.8 Booking Management Domain

#### `Booking`
- **Business Meaning:** The central commercial transaction aggregate representing a luggage storage reservation.
- **Owning Domain:** `bookings`
- **Identifier Strategy:** UUIDv7 (`booking_id`)
- **Key Attributes:** `reference_code` (Human-readable, e.g., `LS-8492-LK`), `traveller_id`, `location_id`, `booking_mode` (`INSTANT`, `HOST_APPROVAL`), `status` (`DRAFT`, `PENDING_HOST_APPROVAL`, `PENDING_PAYMENT`, `CONFIRMED`, `IN_STORAGE`, `COMPLETED`, `CANCELLED_BY_TRAVELLER`, `CANCELLED_BY_HOST`, `REJECTED`, `EXPIRED`), `drop_off_window_start`, `drop_off_window_end`, `collection_window_start`, `collection_window_end`, `cancellation_reason`, `created_at`, `updated_at`.
- **Relationships:** N:1 with `TravellerProfile`; N:1 with `StorageLocation`; 1:N with `BookingItem`; 1:1 with `BookingPricingSnapshot`; 1:1 with `CapacityReservation`; 1:N with `Payment`; 1:1 with `CustodyRecord`.
- **Invariants:** Collection time must be after drop-off time; status transitions must follow the strict lifecycle model (`BR-001`–`BR-006`).
- **Sensitivity:** `INTERNAL` / `PII`
- **Retention:** Permanent retention (7 years financial audit).

#### `BookingItem`
- **Business Meaning:** An individual luggage item or category line included in the booking.
- **Owning Domain:** `bookings`
- **Identifier Strategy:** UUIDv7 (`item_id`)
- **Key Attributes:** `booking_id`, `bag_category` (`BAG_SMALL`, `BAG_MEDIUM`, `BAG_LARGE`, `BAG_OVERSIZED`), `quantity`, `special_instructions`.
- **Relationships:** N:1 with `Booking`.
- **Invariants:** Quantity must be >= 1.
- **Sensitivity:** `INTERNAL`

#### `BookingPricingSnapshot`
- **Business Meaning:** Permanent, immutable record of all financial figures, tax rates, commission rates, and policies applied at confirmation time.
- **Owning Domain:** `bookings`
- **Identifier Strategy:** UUIDv7 (`snapshot_id`)
- **Key Attributes:** `booking_id`, `currency`, `currency_exponent`, `base_rate_minor`, `duration_units`, `gross_storage_minor`, `host_discount_minor`, `storage_subtotal_minor`, `commission_rate_bps`, `platform_commission_minor`, `host_payable_minor`, `platform_discount_minor`, `tax_rate_bps`, `tax_amount_minor`, `total_amount_minor`, `cancellation_policy_tier`, `snapshotted_at`.
- **Relationships:** 1:1 with `Booking`.
- **Invariants:** Immutable once written. Cannot be updated or deleted.
- **Sensitivity:** `FINANCIAL`

---

### 2.9 Payment and Refund Domains

#### `Payment`
- **Business Meaning:** A financial transaction attempt to settle charges for a booking.
- **Owning Domain:** `payments`
- **Identifier Strategy:** UUIDv7 (`payment_id`)
- **Key Attributes:** `booking_id`, `payment_provider` (`PAYHERE`, `MANUAL_OVERRIDE`), `gateway_order_id`, `gateway_transaction_id`, `amount_minor`, `currency`, `status` (`INITIATED`, `PENDING_GATEWAY`, `SUCCESS`, `FAILED`, `EXPIRED`), `payment_method` (`VISA`, `MASTERCARD`, `GENIE`, `FRIMI`), `raw_webhook_payload` (JSONB), `verified_at`, `created_at`.
- **Relationships:** N:1 with `Booking`; 1:N with `Refund`.
- **Invariants:** Status can transition to `SUCCESS` only upon cryptographically verified gateway webhook.
- **Sensitivity:** `FINANCIAL`

#### `Refund`
- **Business Meaning:** Return of settled funds to a traveller due to cancellation, adjustment, or dispute.
- **Owning Domain:** `refunds`
- **Identifier Strategy:** UUIDv7 (`refund_id`)
- **Key Attributes:** `payment_id`, `booking_id`, `amount_minor`, `currency`, `reason_category` (`TRAVELLER_CANCELLATION`, `HOST_CANCELLATION`, `DISPUTE_RESOLUTION`, `SYSTEM_FAILURE`), `status` (`REQUESTED`, `AUTHORIZED`, `INITIATED`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `MANUAL_REVIEW_REQUIRED`), `gateway_refund_id`, `authorized_by_user_id`, `created_at`, `completed_at`.
- **Relationships:** N:1 with `Payment`; N:1 with `Booking`.
- **Invariants:** Refund amount cannot exceed original payment capture amount.
- **Sensitivity:** `FINANCIAL`

---

### 2.10 Custody and Handover Domain

#### `CustodyRecord`
- **Business Meaning:** Tracks physical possession, security verification, and check-in/out handover of luggage.
- **Owning Domain:** `custody`
- **Identifier Strategy:** UUIDv7 (`custody_id`)
- **Key Attributes:** `booking_id`, `location_id`, `qr_secret_hash`, `pin_code` (6 alphanumeric characters), `status` (`EXPECTED`, `CHECKED_IN`, `IN_STORAGE`, `OVERDUE`, `CHECKED_OUT`, `DISPUTED_RELEASE`, `ABANDONED`), `check_in_at`, `check_in_staff_user_id`, `check_in_bag_count`, `check_in_photos` (Array of URLs), `check_out_at`, `check_out_staff_user_id`, `check_out_notes`.
- **Relationships:** 1:1 with `Booking`; N:1 with `StorageLocation`; 1:N with `BagCustodyItem`.
- **Invariants:** Overdue fee disputes do NOT prevent luggage handover; status `DISPUTED_RELEASE` is used when bags are released with pending fees (`BR-035`, `BR-061`).
- **Sensitivity:** `INTERNAL`

#### `BagCustodyItem`
- **Business Meaning:** Individual bag tracking record within a custody handover.
- **Owning Domain:** `custody`
- **Identifier Strategy:** UUIDv7 (`bag_custody_id`)
- **Key Attributes:** `custody_id`, `bag_tag_code` (Physical tag ID), `bag_category`, `security_seal_number`, `photo_evidence_url`, `condition_notes`.
- **Relationships:** N:1 with `CustodyRecord`.
- **Sensitivity:** `INTERNAL`

---

### 2.11 Finance, Ledger, and Payout Domains

#### `LedgerEntry`
- **Business Meaning:** Immutable double-entry general ledger journal entry recording financial debits and credits.
- **Owning Domain:** `finance`
- **Identifier Strategy:** UUIDv7 (`entry_id`)
- **Key Attributes:** `transaction_id`, `account_code`, `account_name`, `entry_type` (`DEBIT`, `CREDIT`), `amount_minor`, `currency`, `reference_entity_type` (`BOOKING`, `PAYMENT`, `PAYOUT`, `REFUND`), `reference_entity_id`, `posted_at`.
- **Invariants:** Append-only. Sum of debits must equal sum of credits for every transaction group.
- **Sensitivity:** `FINANCIAL`

#### `HostPayable`
- **Business Meaning:** Net accrued storage earnings owed by the marketplace to a host business.
- **Owning Domain:** `revenue` / `payouts`
- **Identifier Strategy:** UUIDv7 (`payable_id`)
- **Key Attributes:** `business_id`, `booking_id`, `amount_minor`, `currency`, `status` (`ACCRUED`, `ON_HOLD`, `ELIGIBLE`, `PAID`, `CANCELLED_CLAWBACK`), `accrued_at`, `payout_id`.
- **Relationships:** N:1 with `HostBusiness`; 1:1 with `Booking`; N:1 with `Payout`.
- **Sensitivity:** `FINANCIAL`

#### `Payout`
- **Business Meaning:** A batch or individual bank disbursement executed by Superadmin to settle eligible host balances.
- **Owning Domain:** `payouts`
- **Identifier Strategy:** UUIDv7 (`payout_id`)
- **Key Attributes:** `business_id`, `payout_batch_id`, `amount_minor`, `currency`, `bank_account_snapshot` (JSONB: bank, account, name), `bank_reference_number`, `status` (`DRAFT`, `SUBMITTED`, `COMPLETED`, `FAILED`), `disbursed_by_user_id`, `disbursed_at`.
- **Relationships:** N:1 with `HostBusiness`; 1:N with `HostPayable`.
- **Invariants:** Manual disbursement in MVP; bank reference number required to mark `COMPLETED`.
- **Sensitivity:** `FINANCIAL`

---

### 2.12 Support, Reviews, and Audit Domains

#### `Review`
- **Business Meaning:** Feedback and numerical rating submitted by a traveller following a completed storage booking.
- **Owning Domain:** `reviews`
- **Identifier Strategy:** UUIDv7 (`review_id`)
- **Key Attributes:** `booking_id`, `location_id`, `traveller_id`, `rating` (1–5 integer), `cleanliness_rating`, `security_rating`, `location_rating`, `comment`, `host_reply`, `status` (`SUBMITTED`, `PUBLISHED`, `FLAGGED`, `REMOVED`), `moderated_by_user_id`.
- **Relationships:** 1:1 with `Booking`; N:1 with `StorageLocation`.
- **Invariants:** Can only be submitted once per completed booking within 14 days of checkout.
- **Sensitivity:** `PUBLIC` (Once published).

#### `SupportTicket`
- **Business Meaning:** Operational customer inquiry or dispute submitted by a traveller or host.
- **Owning Domain:** `support`
- **Identifier Strategy:** UUIDv7 (`ticket_id`)
- **Key Attributes:** `ticket_number` (e.g., `TKT-10492`), `user_id`, `booking_id`, `category` (`BOOKING_ISSUE`, `GENERAL_INQUIRY`, `HOST_INCIDENT`, `APP_FEEDBACK`), `priority` (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), `status` (`OPEN`, `IN_PROGRESS`, `WAITING_ON_USER`, `RESOLVED`, `CLOSED`), `assigned_support_user_id`.
- **Relationships:** N:1 with `User`; Optional N:1 with `Booking`.
- **Sensitivity:** `INTERNAL` / `PII`

#### `AuditLog`
- **Business Meaning:** Immutable record of security, authentication, and privileged administrative actions.
- **Owning Domain:** `audit`
- **Identifier Strategy:** UUIDv7 (`audit_id`)
- **Key Attributes:** `actor_user_id`, `actor_role`, `action_type`, `target_resource_type`, `target_resource_id`, `changes_payload` (JSONB before/after), `ip_address`, `user_agent`, `created_at`.
- **Invariants:** Strictly append-only. Zero UPDATE or DELETE permissions even for Superadmin.
- **Sensitivity:** `INTERNAL`
