# Data Integrity and Indexing Strategy

**Project:** Global Luggage Storage Marketplace  
**Document Type:** Data Architecture Specification  
**Status:** Approved Phase 0C Baseline  
**Governing Documents:** ADR-005 (PostgreSQL + PostGIS), Logical ERD (`logical-erd.md`), Global Data Standards (`global-data-standards.md`), Business Rules Catalogue (`BR-085`–`BR-090`).

---

## 1. Executive Summary & Strategy

High-throughput marketplace platforms require ironclad data integrity guarantees combined with low-latency indexing. Because the Global Luggage Storage Marketplace uses a modular monolith architecture with PostgreSQL 16+ and PostGIS (`ADR-001`, `ADR-005`), database constraints and specialized index types are used as the foundational defense against corruption, concurrency race conditions, and spatial query degradation.

---

## 2. Geospatial Indexing (PostGIS GIST Architecture)

Discovery search by location, map viewport, or radius is a critical query path (`FR-003`, `FR-004`).

### 2.1 PostGIS Geography Implementation
- **Column Definition:** `coordinates GEOGRAPHY(Point, 4326) NOT NULL` on `storage_locations`.
- **Index Type:** **GiST (Generalized Search Tree)**.
- **Index Definition:**
  ```sql
  CREATE INDEX idx_storage_locations_geo 
  ON storage_locations USING GIST (coordinates)
  WHERE status = 'ACTIVE';
  ```
- **Query Pattern:** The discovery engine queries nearby active locations within a radius in meters using `ST_DWithin`:
  ```sql
  SELECT id, name, booking_mode, average_rating, review_count,
         ST_Distance(coordinates, ST_MakePoint(:lng, :lat)::geography) AS distance_meters
  FROM storage_locations
  WHERE status = 'ACTIVE'
    AND ST_DWithin(coordinates, ST_MakePoint(:lng, :lat)::geography, :radius_meters)
  ORDER BY distance_meters ASC
  LIMIT 50;
  ```

---

## 3. Partial & High-Performance Indexing

To avoid bloated indexes and optimize high-throughput operational background processes, **Partial Indexes** are deployed on active states and queues:

### 3.1 Transactional Outbox Dispatch Queue
```sql
-- Outbox dispatcher queries exclusively unpublished events
CREATE INDEX idx_outbox_events_unpublished 
ON outbox_events (created_at ASC) 
WHERE published_at IS NULL;
```

### 3.2 Capacity TTL Sweeper Queue
```sql
-- Background worker sweeps for expired temporary holds every 30 seconds
CREATE INDEX idx_capacity_reservations_held_expiry 
ON capacity_reservations (expires_at ASC) 
WHERE status IN ('HELD_FOR_HOST_APPROVAL', 'HELD_FOR_PAYMENT');
```

### 3.3 Active Support Ticket Triage Queue
```sql
-- Support agents filter active operational tickets by priority and category
CREATE INDEX idx_support_tickets_active_triage 
ON support_tickets (priority DESC, created_at ASC) 
WHERE status IN ('OPEN', 'IN_PROGRESS', 'WAITING_ON_USER');
```

### 3.4 Eligible Host Payout Queue
```sql
-- Payout batch generation scans for eligible, unbatched host payables
CREATE INDEX idx_host_payables_eligible_batch 
ON host_payables (business_id, accrued_at ASC) 
WHERE status = 'ELIGIBLE' AND payout_id IS NULL;
```

---

## 4. Master Database Constraints & Check Rules

To guarantee business rule enforcement directly at the database engine tier:

### 4.1 Check Constraints

| Table Name | Constraint Name | SQL Check Expression | Business Invariant & Rule Reference |
| :--- | :--- | :--- | :--- |
| `pricing_policies` | `chk_base_rate_positive` | `CHECK (base_rate_minor > 0)` | Base storage rate must be strictly positive (`BR-019`). |
| `pricing_policies` | `chk_currency_length` | `CHECK (length(currency) = 3)` | Must adhere to ISO 4217 standard (`BR-089`). |
| `storage_capacity_pools`| `chk_capacity_positive` | `CHECK (total_units > 0)` | Capacity pool must define positive units (`BR-009`). |
| `opening_hours_slots` | `chk_hours_order` | `CHECK (open_time < close_time)` | Opening time must precede closing time (`BR-011`). |
| `opening_hours_slots` | `chk_day_of_week_range` | `CHECK (day_of_week BETWEEN 1 AND 7)`| 1 = Monday ... 7 = Sunday ISO standard. |
| `bookings` | `chk_booking_window_order`| `CHECK (drop_off_window_start < collection_window_end)` | Drop-off must precede collection (`BR-004`). |
| `booking_items` | `chk_item_quantity_positive`| `CHECK (quantity >= 1)` | Bag line items must be at least 1 bag (`BR-007`). |
| `reviews` | `chk_rating_range` | `CHECK (rating BETWEEN 1 AND 5)` | Star rating must be an integer between 1 and 5. |
| `booking_pricing_snapshots`| `chk_commission_bps`| `CHECK (commission_rate_bps = 1500)`| Fixed 15% platform commission policy (`BR-021`). |
| `finance_ledger_entries`| `chk_amount_positive`| `CHECK (amount_minor > 0)` | Ledger entry amounts must be strictly positive. |

### 4.2 Unique Constraints & Deduplication Keys

| Table Name | Constraint Name | Column(s) | Architectural Purpose |
| :--- | :--- | :--- | :--- |
| `users` | `uk_users_email` | `LOWER(email)` | Prevents duplicate user accounts; case-insensitive. |
| `traveller_profiles` | `uk_traveller_user_id` | `user_id` | Strict 1:1 user to traveller relationship. |
| `bookings` | `uk_bookings_reference_code` | `reference_code` | Guarantees uniqueness of human-readable booking IDs (`LS-XXXX-LK`). |
| `booking_pricing_snapshots`| `uk_snapshot_booking_id`| `booking_id` | Exactly one permanent pricing snapshot per booking. |
| `payments` | `uk_payments_gateway_tx_id` | `gateway_transaction_id` | **Payment Webhook Idempotency:** Prevents duplicate capture processing (`BR-017`). |
| `reviews` | `uk_reviews_booking_id` | `booking_id` | Exactly one review permitted per completed booking. |
| `custody_records` | `uk_custody_booking_id` | `booking_id` | Exactly one custody lifecycle per booking. |

---

## 5. Financial Immutability & Ledger Protection

Financial records must be tamper-proof against unauthorized updates, programming bugs, and malicious administrative operations:

```sql
-- Immutability Trigger Pattern for Finance Ledger and Snapshots
CREATE OR REPLACE FUNCTION prevent_modification_of_immutable_records()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'FATAL: Table % is strictly append-only. UPDATE and DELETE operations are prohibited.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- Apply to Financial Ledger
CREATE TRIGGER trg_immutable_finance_ledger
BEFORE UPDATE OR DELETE ON finance_ledger_entries
FOR EACH ROW EXECUTE FUNCTION prevent_modification_of_immutable_records();

-- Apply to Booking Pricing Snapshots
CREATE TRIGGER trg_immutable_booking_snapshots
BEFORE UPDATE OR DELETE ON booking_pricing_snapshots
FOR EACH ROW EXECUTE FUNCTION prevent_modification_of_immutable_records();

-- Apply to Security Audit Logs
CREATE TRIGGER trg_immutable_audit_logs
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_modification_of_immutable_records();
```
