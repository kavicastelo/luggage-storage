# Entity Relationship Catalogue

**Project:** Global Luggage Storage Marketplace  
**Document Type:** Data Architecture Specification  
**Status:** Approved Phase 0C Baseline  
**Governing Documents:** FRS, Phase 0A Architecture, ADR-005 (PostgreSQL), Domain Entity Catalogue (`domain-entity-catalogue.md`), Logical ERD (`logical-erd.md`).

---

## 1. Architectural Strategy & Integrity Principles

This catalogue defines the physical database relationships, foreign key actions, nullability, cardinalities, and deletion strategies across the system.

### Integrity Rules:
1. **Financial & Custody Immutability:** Financial ledgers (`finance_ledger_entries`), confirmed snapshots (`booking_pricing_snapshots`), custody logs (`custody_records`), and payment records (`payments`) strictly use **`ON DELETE RESTRICT`** across all foreign keys. No administrative user or cascade action can physically delete or corrupt active or historical financial records.
2. **Dependent Child Cascades:** Transient, strictly owned sub-items (e.g., `booking_items` belonging to a draft booking, `opening_hours_slots` of a deleted draft location) use **`ON DELETE CASCADE`** only where the parent entity is safely deletable.
3. **Soft Deletion Strategy:** Core customer and business entities (`users`, `host_businesses`, `storage_locations`) utilize soft deletion (`deleted_at TIMESTAMPTZ NULL`) to preserve historical audit trails and relational integrity.

---

## 2. Master Relational Catalogue

| Table Name | Owning Domain | Primary Key | Foreign Key Columns | Target Parent Table | Cardinality & Optionality | Foreign Key Delete Action | Lifecycle & Deletion Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `users` | `identity` | `id (UUID)` | None | None | N/A | N/A | Soft Delete (`deleted_at`). |
| `sessions` | `identity` | `id (UUID)` | `user_id` | `users(id)` | N:1 Mandatory | `ON DELETE CASCADE` | Hard delete on logout or TTL purge. |
| `traveller_profiles` | `travellers` | `id (UUID)` | `user_id` | `users(id)` | 1:1 Mandatory | `ON DELETE RESTRICT` | Soft Delete aligned with user account. |
| `host_businesses` | `hosts` | `id (UUID)` | `owner_user_id` | `users(id)` | N:1 Mandatory | `ON DELETE RESTRICT` | Soft Delete (`status = 'SUSPENDED'`). |
| `host_staff_memberships`| `staff` | `id (UUID)` | `business_id`<br>`user_id` | `host_businesses(id)`<br>`users(id)` | N:1 Mandatory<br>N:1 Mandatory | `ON DELETE RESTRICT`<br>`ON DELETE RESTRICT` | Soft Deactivation (`is_active = FALSE`). |
| `storage_locations` | `locations` | `id (UUID)` | `business_id` | `host_businesses(id)` | N:1 Mandatory | `ON DELETE RESTRICT` | Soft Deactivation (`status = 'DISABLED'`). |
| `storage_zones` | `locations` | `id (UUID)` | `location_id` | `storage_locations(id)` | N:1 Mandatory | `ON DELETE RESTRICT` | Soft Deactivation (`is_active = FALSE`). |
| `opening_hours_slots` | `locations` | `id (UUID)` | `location_id` | `storage_locations(id)` | N:1 Mandatory | `ON DELETE CASCADE` | Physical overwrite on schedule update. |
| `opening_hours_exceptions`| `locations` | `id (UUID)` | `location_id` | `storage_locations(id)` | N:1 Mandatory | `ON DELETE CASCADE` | Hard delete allowed for future dates. |
| `storage_capacity_pools`| `capacity` | `id (UUID)` | `location_id`<br>`zone_id` | `storage_locations(id)`<br>`storage_zones(id)` | N:1 Mandatory<br>N:1 Optional | `ON DELETE RESTRICT`<br>`ON DELETE RESTRICT` | Soft Deactivation (`is_active = FALSE`). |
| `capacity_reservations` | `capacity` | `id (UUID)` | `booking_id`<br>`pool_id` | `bookings(id)`<br>`storage_capacity_pools(id)` | 1:1 Mandatory<br>N:1 Mandatory | `ON DELETE RESTRICT`<br>`ON DELETE RESTRICT` | State mutation (`HELD_FOR_HOST_APPROVAL` / `HELD_FOR_PAYMENT` -> `CONFIRMED` / `RELEASED`). |
| `pricing_policies` | `pricing` | `id (UUID)` | `location_id` | `storage_locations(id)` | 1:1 Mandatory | `ON DELETE RESTRICT` | Historical versions retained; in-place update. |
| `bookings` | `bookings` | `id (UUID)` | `traveller_id`<br>`location_id` | `traveller_profiles(id)`<br>`storage_locations(id)` | N:1 Mandatory<br>N:1 Mandatory | `ON DELETE RESTRICT`<br>`ON DELETE RESTRICT` | State mutation. Hard delete strictly forbidden. |
| `booking_items` | `bookings` | `id (UUID)` | `booking_id` | `bookings(id)` | N:1 Mandatory | `ON DELETE CASCADE` | Pure dependent line items. |
| `booking_pricing_snapshots`| `bookings`| `id (UUID)` | `booking_id` | `bookings(id)` | 1:1 Mandatory | `ON DELETE RESTRICT` | **Strictly Immutable**. Never updated or deleted. |
| `payments` | `payments` | `id (UUID)` | `booking_id` | `bookings(id)` | N:1 Mandatory | `ON DELETE RESTRICT` | Immutable audit log of transaction attempts. |
| `refunds` | `refunds` | `id (UUID)` | `payment_id`<br>`booking_id`<br>`authorized_by_user_id` | `payments(id)`<br>`bookings(id)`<br>`users(id)` | N:1 Mandatory<br>N:1 Mandatory<br>N:1 Optional | `ON DELETE RESTRICT`<br>`ON DELETE RESTRICT`<br>`ON DELETE RESTRICT` | Explicit 7-stage state machine. |
| `custody_records` | `custody` | `id (UUID)` | `booking_id`<br>`location_id`<br>`check_in_staff_user_id`<br>`check_out_staff_user_id` | `bookings(id)`<br>`storage_locations(id)`<br>`users(id)`<br>`users(id)` | 1:1 Mandatory<br>N:1 Mandatory<br>N:1 Optional<br>N:1 Optional | `ON DELETE RESTRICT`<br>`ON DELETE RESTRICT`<br>`ON DELETE RESTRICT`<br>`ON DELETE RESTRICT` | Immutable handover event log. |
| `bag_custody_items` | `custody` | `id (UUID)` | `custody_id` | `custody_records(id)` | N:1 Mandatory | `ON DELETE RESTRICT` | Tag and photographic evidence records. |
| `host_payables` | `revenue` | `id (UUID)` | `business_id`<br>`booking_id`<br>`payout_id` | `host_businesses(id)`<br>`bookings(id)`<br>`payouts(id)` | N:1 Mandatory<br>1:1 Mandatory<br>N:1 Optional | `ON DELETE RESTRICT`<br>`ON DELETE RESTRICT`<br>`ON DELETE RESTRICT` | Financial liability tracking; state mutated. |
| `payouts` | `payouts` | `id (UUID)` | `business_id`<br>`disbursed_by_user_id` | `host_businesses(id)`<br>`users(id)` | N:1 Mandatory<br>N:1 Optional | `ON DELETE RESTRICT`<br>`ON DELETE RESTRICT` | Manual Superadmin batch disbursement records. |
| `finance_ledger_entries`| `finance` | `id (UUID)` | `reference_entity_id` | Varies (`bookings`, `payments`, `payouts`) | N:1 Mandatory | `ON DELETE RESTRICT` | **Append-Only Double-Entry General Ledger**. |
| `reviews` | `reviews` | `id (UUID)` | `booking_id`<br>`location_id`<br>`traveller_id`<br>`moderated_by_user_id` | `bookings(id)`<br>`storage_locations(id)`<br>`traveller_profiles(id)`<br>`users(id)` | 1:1 Mandatory<br>N:1 Mandatory<br>N:1 Mandatory<br>N:1 Optional | `ON DELETE RESTRICT`<br>`ON DELETE RESTRICT`<br>`ON DELETE RESTRICT`<br>`ON DELETE RESTRICT` | Moderation state mutation (`SUBMITTED` -> `PUBLISHED`). |
| `support_tickets` | `support` | `id (UUID)` | `user_id`<br>`booking_id`<br>`assigned_support_user_id` | `users(id)`<br>`bookings(id)`<br>`users(id)` | N:1 Mandatory<br>N:1 Optional<br>N:1 Optional | `ON DELETE RESTRICT`<br>`ON DELETE RESTRICT`<br>`ON DELETE RESTRICT` | Operational workflow ticket lifecycle. |
| `audit_logs` | `audit` | `id (UUID)` | `actor_user_id` | `users(id)` | N:1 Optional | `ON DELETE RESTRICT` | **Strictly Append-Only**. Zero UPDATE/DELETE. |
| `outbox_events` | `system` | `id (UUID)` | None | None | N/A | N/A | Transactional outbox event store. |
