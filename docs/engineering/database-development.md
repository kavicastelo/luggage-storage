# Engineering Governance — Database Development & Data Integrity

**Document ID:** ENG-DOC-006  
**Version:** 1.0.0  
**Phase:** Phase 1A — Engineering Foundation  
**Status:** Approved Engineering Baseline  
**Applicability:** Backend database schema, queries, migrations, and concurrency controls  

---

## 1. Engine & Extension Standards

The Global Luggage Storage Marketplace relies on **PostgreSQL 16** with the **PostGIS 3** spatial extension:
- **Spatial Geometry Standard:** All geographic coordinates (storage locations, user search centers, driver tracking) utilize `geography(Point, 4326)` (WGS 84 coordinate reference system).
- **Spatial Indexing:** Every column containing geographic coordinates must have a **GiST (Generalized Search Tree)** index to support sub-millisecond radius and polygon bounding queries (`ST_DWithin`, `ST_Distance`).
- **Connection Management:** Backend processes access PostgreSQL via a persistent connection pool (`pg.Pool`), configured with fail-safe idle timeouts and maximum client limits.

---

## 2. Object Relational Mapping (ORM) — Drizzle ORM

We standardize on **Drizzle ORM** for all relational interactions:
1. **Type-Inference First:** TypeScript interfaces for selects and inserts are derived directly from table schemas:
   ```typescript
   export type StorageLocation = typeof storageLocations.$inferSelect;
   export type NewStorageLocation = typeof storageLocations.$inferInsert;
   ```
2. **Naming Conventions:**
   - Database tables, columns, indexes, and constraints use `snake_case` (e.g. `storage_location_id`, `created_at`).
   - TypeScript property projections and variables use `camelCase` (e.g. `storageLocationId`, `createdAt`).
3. **No Hidden Lazy Loading:** Drizzle generates explicit, performant SQL without hidden N+1 query loops.

---

## 3. Migration Architecture & Governance

1. **Migration Tooling:** Migrations are authored and managed using `drizzle-kit`.
2. **Forward-Only Migrations:** Production database migrations are strictly append-only. Modifying existing applied migration files is forbidden.
3. **Automated Verification:** Migrations must execute cleanly against a fresh PostGIS container in CI before merging.
4. **Zero Downtime Deployments:** Schema adjustments must support backward compatibility:
   - Add column as nullable or with a default value.
   - Deploy code reading and writing the new column.
   - Backfill legacy records if necessary.
   - Enforce `NOT NULL` constraint in a subsequent migration.

---

## 4. Concurrency Safety & Serialization Guardrails

Based on the approved Phase 0C-D architectural baseline:
1. **Capacity Allocation Serialization:** To prevent double-booking under high concurrent load, capacity slot reservation must acquire an exclusive row-level lock on the parent capacity pool record:
   ```sql
   SELECT * FROM storage_capacity_pools 
   WHERE pool_id = $1 
   FOR UPDATE;
   ```
2. **Transaction Scoping:** All operations spanning multiple table mutations (such as creating a reservation, creating a ledger hold, and updating capacity counts) must execute within an explicit database transaction block (`db.transaction(...)`).

---

## 5. Financial Ledger Immutability & Audit Principles

1. **Strictly Insert-Only:** Financial tables (`general_ledger_entries`, `payment_transactions`, `payout_records`) are immutable append-only ledgers. `UPDATE` and `DELETE` operations are strictly banned on ledger tables.
2. **Zero Possessory Lien Decoupling:** Database foreign keys and status flags must never block luggage custody release (`RELEASED_TO_TRAVELLER`) due to payment or settlement disputes. Physical custody and financial ledgers reside in decoupled domain schemas.

---

## 6. Phase 1A Implementation Scope Boundary

> [!NOTE]
> Phase 1A establishes the database connection pool, PostGIS verification test, and Drizzle configuration harness.
> Per architectural governance rules, **zero business domain tables** (e.g., users, bookings, luggage items, ledger entries) are created in Phase 1A. All domain schemas will be introduced incrementally starting in Phase 1B.

