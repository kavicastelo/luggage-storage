# ADR-006: Drizzle ORM for Database Access and Schema Management

- **Status:** Accepted
- **Date:** 2026-11-07
- **Phase:** Phase 0A — Product Architecture & System Foundation
- **Related Documents:** [System Architecture Overview](../system-architecture.md), [ADR-005](ADR-005-postgresql-postgis.md)

---

## 1. Context

The backend modular monolith (`apps/api`) interacts with a complex PostgreSQL + PostGIS schema covering 23 domains—including spatial queries (`ST_DWithin`, `ST_Distance`), atomic row-level capacity locking (`SELECT ... FOR UPDATE`), complex joins across operating schedules and pricing rules, and immutable financial ledger inserts.

We need a TypeScript database layer that provides strong compile-time type inference, clean SQL migration generation (`drizzle-kit`), and zero-friction access to raw SQL / PostGIS functions without heavy runtime overhead.

---

## 2. Decision

We will use **Drizzle ORM** (`drizzle-orm` + `drizzle-kit`) as the database toolkit and query builder across `apps/api`.

Key implementation conventions:
1. **Domain-Scoped Schema Definitions:** Table definitions are organized by domain inside `apps/api/src/database/schema/` and exported through a unified index for relational type inference.
2. **Versioned SQL Migrations:** All database changes are generated and reviewed as explicit SQL migration files via `drizzle-kit`—never applied via unreviewed `push` in production.
3. **First-Class PostGIS & Transaction Support:** Spatial expressions use Drizzle's typed `sql` template tag (`ST_DWithin`, `ST_SetSRID`, `ST_MakePoint`) and booking/ledger operations use `db.transaction()` with explicit lock clauses.

---

## 3. Alternatives Considered

1. **Prisma ORM:**
   - *Rejected:* Historically relies on a separate Rust query engine binary, has higher memory/cold-start overhead, and requires awkward raw-query workarounds for advanced PostGIS spatial operations and complex row-locking queries.
2. **TypeORM / Sequelize:**
   - *Rejected:* Older decorator/ActiveRecord patterns suffer from weak TypeScript inference and hidden lazy-loading pitfalls.
3. **Raw SQL Only (`pg` without ORM):**
   - *Rejected:* Loses automatic TypeScript schema-to-DTO inference and manual migration tracking ergonomics.

---

## 4. Consequences

### Positive
- **SQL Transparency:** Drizzle queries map 1:1 to predictable SQL with no hidden N+1 query generation.
- **Seamless PostGIS Integration:** Typed `sql<number>` expressions combine naturally with standard Drizzle `select().from().where()` builders.
- **High Performance:** Minimal memory footprint and fast startup inside the Fastify server and background workers.

### Negative / Trade-offs
- Developers must understand relational SQL concepts (joins, indexes, transactions) rather than relying on an opaque ORM abstraction.

---

## 5. Risks & Mitigations

- **Risk:** Custom PostGIS types (`GEOGRAPHY(Point, 4326)`) require custom column type wrappers or careful `drizzle-kit` migration inspection.
  - **Mitigation:** Define a standard reusable `geographyPoint` custom type helper in `apps/api/src/database/` and verify all generated `.sql` migrations in CI.

