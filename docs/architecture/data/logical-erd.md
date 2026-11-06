# Logical Entity Relationship Diagram (ERD)

**Project:** Global Luggage Storage Marketplace  
**Document Type:** Data Architecture Specification  
**Status:** Approved Phase 0C Baseline  
**Governing Documents:** FRS, Phase 0A Architecture, ADR-005 (PostgreSQL), Domain Entity Catalogue (`domain-entity-catalogue.md`), Global Data Standards (`global-data-standards.md`).

---

## 1. Executive Summary & Conventions

The Logical ERD models the database structures, foreign key constraints, column types, and cardinalities across the modular monolith.

### Technical Conventions:
- **Primary Keys:** `UUID` (UUIDv7 time-ordered, sortable identifiers).
- **Money Values:** `BIGINT` representing integer minor units (e.g., LKR cents).
- **Timestamps:** `TIMESTAMPTZ` storing UTC instants.
- **Geospatial:** `GEOGRAPHY(Point, 4326)` for WGS 84 coordinates.
- **Enums & States:** `VARCHAR(32)` or `VARCHAR(64)` backed by explicit database check constraints.

---

## 2. Domain Cluster 1: Identity, Accounts & Staff

```mermaid
erDiagram
    users {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar phone_number
        boolean is_email_verified
        boolean is_phone_verified
        varchar primary_role
        varchar status
        timestamptz created_at
        timestamptz updated_at
    }

    sessions {
        uuid id PK
        uuid user_id FK
        varchar refresh_token_hash
        varchar device_fingerprint
        varchar ip_address
        text user_agent
        timestamptz expires_at
        timestamptz revoked_at
        timestamptz last_active_at
    }

    traveller_profiles {
        uuid id PK
        uuid user_id FK,UK
        varchar first_name
        varchar last_name
        varchar preferred_language
        varchar preferred_currency
        varchar emergency_contact_name
        varchar emergency_contact_phone
        timestamptz created_at
    }

    host_businesses {
        uuid id PK
        uuid owner_user_id FK
        varchar legal_business_name
        varchar trade_name
        varchar business_registration_number
        varchar entity_type
        varchar tax_identifier
        varchar payout_bank_name
        varchar payout_account_number
        varchar payout_account_name
        varchar payout_branch_code
        varchar status
        timestamptz verified_at
        timestamptz created_at
    }

    host_staff_memberships {
        uuid id PK
        uuid business_id FK
        uuid user_id FK
        varchar staff_role
        uuid_array assigned_location_ids
        boolean is_active
        timestamptz invited_at
        timestamptz accepted_at
    }

    users ||--o{ sessions : "has"
    users ||--|| traveller_profiles : "owns"
    users ||--o{ host_businesses : "owns"
    host_businesses ||--o{ host_staff_memberships : "employs"
    users ||--o{ host_staff_memberships : "acts as"
```

---

## 3. Domain Cluster 2: Locations, Capacity & Schedules

```mermaid
erDiagram
    storage_locations {
        uuid id PK
        uuid business_id FK
        varchar name
        text description
        varchar address_line1
        varchar city
        varchar postal_code
        char_2 country_code
        varchar timezone
        geography_point coordinates
        varchar booking_mode
        boolean accepts_oversized
        varchar status
        numeric average_rating
        integer review_count
        timestamptz created_at
    }

    storage_zones {
        uuid id PK
        uuid location_id FK
        varchar name
        varchar zone_type
        varchar security_tier
        boolean is_active
        timestamptz created_at
    }

    storage_capacity_pools {
        uuid id PK
        uuid location_id FK
        uuid zone_id FK
        varchar pool_type
        integer total_units
        boolean is_active
    }

    capacity_reservations {
        uuid id PK
        uuid booking_id FK,UK
        uuid pool_id FK
        integer units_allocated
        varchar status
        timestamptz expires_at
        timestamptz created_at
    }

    opening_hours_slots {
        uuid id PK
        uuid location_id FK
        smallint day_of_week
        time open_time
        time close_time
        boolean allows_dropoff
        boolean allows_collection
    }

    opening_hours_exceptions {
        uuid id PK
        uuid location_id FK
        date exception_date
        varchar exception_type
        time open_time
        time close_time
        text reason
    }

    pricing_policies {
        uuid id PK
        uuid location_id FK,UK
        char_3 currency
        bigint base_rate_minor
        varchar pricing_unit
        jsonb category_multipliers
        timestamptz updated_at
    }

    storage_locations ||--|{ storage_zones : "partitions into"
    storage_locations ||--|{ opening_hours_slots : "schedules"
    storage_locations ||--o{ opening_hours_exceptions : "exceptions"
    storage_locations ||--|| pricing_policies : "prices via"
    storage_zones ||--|{ storage_capacity_pools : "houses"
    storage_capacity_pools ||--o{ capacity_reservations : "allocates"
```

---

## 4. Domain Cluster 3: Bookings, Snapshots & Custody

```mermaid
erDiagram
    bookings {
        uuid id PK
        varchar reference_code UK
        uuid traveller_id FK
        uuid location_id FK
        varchar booking_mode
        varchar status
        timestamptz drop_off_window_start
        timestamptz drop_off_window_end
        timestamptz collection_window_start
        timestamptz collection_window_end
        text cancellation_reason
        timestamptz created_at
        timestamptz updated_at
    }

    booking_items {
        uuid id PK
        uuid booking_id FK
        varchar bag_category
        integer quantity
        text special_instructions
    }

    booking_pricing_snapshots {
        uuid id PK
        uuid booking_id FK,UK
        char_3 currency
        smallint currency_exponent
        bigint base_rate_minor
        integer duration_units
        bigint gross_storage_minor
        bigint host_discount_minor
        bigint storage_subtotal_minor
        integer commission_rate_bps
        bigint platform_commission_minor
        bigint host_payable_minor
        bigint platform_discount_minor
        integer tax_rate_bps
        bigint tax_amount_minor
        bigint total_amount_minor
        varchar cancellation_policy_tier
        timestamptz snapshotted_at
    }

    custody_records {
        uuid id PK
        uuid booking_id FK,UK
        uuid location_id FK
        varchar qr_secret_hash
        varchar pin_code
        varchar status
        varchar handover_condition
        timestamptz check_in_at
        uuid check_in_staff_user_id FK
        integer check_in_bag_count
        jsonb check_in_photos
        timestamptz check_out_at
        uuid check_out_staff_user_id FK
        text check_out_notes
    }

    bag_custody_items {
        uuid id PK
        uuid custody_id FK
        varchar bag_tag_code
        varchar bag_category
        varchar security_seal_number
        varchar photo_evidence_url
        text condition_notes
    }

    bookings ||--|{ booking_items : "contains"
    bookings ||--|| booking_pricing_snapshots : "freezes price"
    bookings ||--|| custody_records : "governs custody"
    custody_records ||--|{ bag_custody_items : "tracks individual bags"
```

---

## 5. Domain Cluster 4: Payments, Refunds, Ledger & Payouts

```mermaid
erDiagram
    payments {
        uuid id PK
        uuid booking_id FK
        varchar payment_provider
        varchar gateway_order_id
        varchar gateway_transaction_id UK
        bigint amount_minor
        char_3 currency
        varchar status
        varchar payment_method
        jsonb raw_webhook_payload
        timestamptz verified_at
        timestamptz created_at
    }

    refunds {
        uuid id PK
        uuid payment_id FK
        uuid booking_id FK
        bigint amount_minor
        char_3 currency
        varchar reason_category
        varchar status
        varchar gateway_refund_id
        uuid authorized_by_user_id FK
        timestamptz created_at
        timestamptz completed_at
    }

    host_payables {
        uuid id PK
        uuid business_id FK
        uuid booking_id FK,UK
        bigint amount_minor
        char_3 currency
        varchar status
        timestamptz accrued_at
        uuid payout_id FK
    }

    payouts {
        uuid id PK
        uuid business_id FK
        uuid payout_batch_id
        bigint amount_minor
        char_3 currency
        jsonb bank_account_snapshot
        varchar bank_reference_number
        varchar status
        uuid disbursed_by_user_id FK
        timestamptz disbursed_at
        timestamptz created_at
    }

    finance_ledger_entries {
        uuid id PK
        uuid transaction_id
        varchar account_code
        varchar account_name
        varchar entry_type
        bigint amount_minor
        char_3 currency
        varchar reference_entity_type
        uuid reference_entity_id
        timestamptz posted_at
    }

    bookings ||--|{ payments : "paid via"
    payments ||--o{ refunds : "refunded via"
    bookings ||--|| host_payables : "earns"
    payouts ||--o{ host_payables : "settles"
```

---

## 6. Domain Cluster 5: Support, Reviews & Audit

```mermaid
erDiagram
    reviews {
        uuid id PK
        uuid booking_id FK,UK
        uuid location_id FK
        uuid traveller_id FK
        smallint rating
        smallint cleanliness_rating
        smallint security_rating
        smallint location_rating
        text comment
        text host_reply
        varchar status
        uuid moderated_by_user_id FK
        timestamptz created_at
    }

    support_tickets {
        uuid id PK
        varchar ticket_number UK
        uuid user_id FK
        uuid booking_id FK
        varchar category
        varchar priority
        varchar status
        uuid assigned_support_user_id FK
        timestamptz resolved_at
        timestamptz created_at
    }

    audit_logs {
        uuid id PK
        uuid actor_user_id FK
        varchar actor_role
        varchar action_type
        varchar target_resource_type
        uuid target_resource_id
        jsonb changes_payload
        varchar ip_address
        text user_agent
        timestamptz created_at
    }

    outbox_events {
        uuid id PK
        varchar aggregate_type
        varchar aggregate_id
        varchar event_type
        varchar source_domain
        uuid correlation_id
        uuid causation_id
        jsonb payload
        jsonb metadata
        timestamptz created_at
        timestamptz published_at
        integer retry_count
        text last_error
    }
```
