# ADR-005: PostgreSQL with PostGIS on Neon as Primary Database

- **Status:** Accepted
- **Date:** 2026-11-07
- **Phase:** Phase 0A — Product Architecture & System Foundation
- **Related Documents:** [System Architecture Overview](../system-architecture.md), [Backend Domain Architecture Overview](../backend-domain-overview.md), [ADR-006](ADR-006-drizzle-orm.md)

---

## 1. Context

The marketplace requires a primary database that simultaneously excels at:
1. **Geospatial Discovery (`FR-2`, `FR-3`, `FR-4`):** Finding nearby luggage storage hosts within a radius or map bounding box, sorting by accurate geographic distance, and filtering by location attributes across any country.
2. **High-Integrity ACID Transactions (`FR-5`, `FR-6`):** Preventing double-booking when multiple travellers attempt to reserve the last available bag slots in a host's capacity pool at the same time.
3. **Immutable Financial & Custody Ledgers (`FR-8`, `FR-27`–`FR-31`, `FR-36`–`FR-38`):** Enforcing relational referential integrity, exact decimal/integer monetary storage, and append-only audit trails for payments, commissions, manual payouts, and luggage check-in/out records.

---

## 2. Decision

We will use **PostgreSQL** with the **PostGIS** extension as the platform's single authoritative relational and geospatial database, using **Neon PostgreSQL** as the initial managed cloud database provider.

Key design rules:
- All storage location coordinates are stored using PostGIS `GEOGRAPHY(Point, 4326)` columns indexed with `GiST` spatial indexes.
- All primary keys use `UUID`.
- All timestamps use `TIMESTAMPTZ` (stored in `UTC`) paired with explicit `IANA` timezone identifiers on locations.
- All monetary columns use exact integer minor units (`BIGINT` / `INTEGER`) or fixed-precision `NUMERIC` paired with `ISO 4217` currency codes—never `FLOAT`/`REAL`.

---

## 3. Alternatives Considered

1. **NoSQL Document Database (MongoDB / Firestore):**
   - *Rejected:* Weak relational constraints and awkward multi-entity transactional semantics make financial ledgers, multi-pool capacity reservations, and complex relational reporting fragile.
2. **MySQL / MariaDB:**
   - *Rejected:* PostGIS on PostgreSQL is the industry gold standard for geospatial indexing and spherical distance queries (`GEOGRAPHY` type).
3. **Separate Dedicated Geo/Search Engine (Elasticsearch / Algolia) from Day One:**
   - *Rejected:* Adds unnecessary monthly cost and data-sync lag when PostgreSQL + PostGIS easily handles hundreds of thousands of locations and bookings in a single ACID store.

---

## 4. Consequences

### Positive
- **Unified Transactional & Spatial Queries:** A single SQL query can filter storage locations within 2 km (`ST_DWithin`), join active pricing policies, and verify open operating hours without cross-database synchronization.
- **Strong Financial Safety:** Native ACID transactions, row-level locking (`SELECT ... FOR UPDATE`), and `CHECK` constraints prevent negative capacity pools and un-balanced ledger entries.
- **Cost-Effective Managed Hosting:** Neon PostgreSQL provides native PostGIS support, automated backups, and scale-to-zero/autoscaling economics ideal for startup launch.

### Negative / Trade-offs
- Requires careful connection pooling configuration when connecting from Fastify and background workers to serverless/managed Postgres.

---

## 5. Risks & Mitigations

- **Risk:** Cold-start latency on serverless Postgres tiers if compute scales to zero during idle periods.
  - **Mitigation:** Configure minimum active compute or keep-alive health checks on production environments while leveraging scale-to-zero on dev/preview branches.

