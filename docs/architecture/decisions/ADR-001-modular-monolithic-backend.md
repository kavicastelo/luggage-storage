# ADR-001: Modular Monolithic Backend with Fastify and TypeScript

- **Status:** Accepted
- **Date:** 2026-11-07
- **Phase:** Phase 0A — Product Architecture & System Foundation
- **Related Documents:** [System Architecture Overview](../system-architecture.md), [Backend Domain Architecture Overview](../backend-domain-overview.md), [Technology Decisions Register](../technology-decisions.md)

---

## 1. Context

The Global Luggage Storage Marketplace requires a backend capable of supporting 23 distinct functional domains—including geospatial discovery (`FR-2`–`FR-4`), configurable capacity/availability/pricing engines (`FR-5`, `FR-20`–`FR-23`), atomic booking reservations (`FR-6`), payment gateway webhook reconciliation (`FR-6`), immutable financial ledgers and manual payouts (`FR-36`–`FR-38`), physical luggage custody verification (`FR-8`, `FR-27`–`FR-32`), and multi-role administration (`FR-17`, `FR-40`–`FR-44`).

At the same time, the platform is launching as a startup in Sri Lanka with international expansion goals and strict cost-efficiency constraints. The architecture must maintain strong transactional guarantees (especially between capacity reservations, bookings, and financial ledgers) while avoiding expensive, operationally complex distributed infrastructure.

---

## 2. Decision

We will build the backend (`apps/api`) as a **Modular Monolith** using **Node.js, TypeScript, and Fastify**, exposing versioned **REST APIs** documented via **OpenAPI (Swagger)** and validated with **Zod**.

Key structural rules of this decision:
1. **Single Deployable Process:** All 23 backend domains run within one Fastify application service (with structured background worker routines), deployed on a cost-effective AWS EC2 instance or VPS.
2. **Strict Module Boundaries:** Each business domain resides in its own directory (`apps/api/src/modules/<domain>/`) owning its routes, services, domain logic, and repository queries.
3. **No Cross-Module Database Coupling:** Modules communicate through defined application service interfaces and internal domain events rather than importing another module's internal database repository logic.

---

## 3. Alternatives Considered

1. **Microservices Architecture (Docker/Kubernetes + Service Mesh + Per-Service Databases):**
   - *Rejected:* Introduces distributed transaction complexity (2PC/Sagas) across bookings, capacity pools, and financial ledgers; multiplies cloud hosting, CI/CD, and observability costs; slows early engineering velocity with zero initial benefit.
2. **Unstructured Monolith (Layered MVC without Domain Boundaries):**
   - *Rejected:* Quickly degrades into an unmaintainable "Big Ball of Mud" where booking, payment, and custody logic become tightly entangled.
3. **Express.js or NestJS instead of Fastify:**
   - *Rejected:* Approved stack locks Fastify. Fastify provides superior request throughput, built-in JSON schema/OpenAPI integration, lower memory overhead, and cleaner TypeScript plugin encapsulation than Express, without the heavy decorator/reflection complexity of NestJS.

---

## 4. Consequences

### Positive
- **ACID Transactional Simplicity:** Capacity reservations, booking state transitions, and ledger entries can execute inside single PostgreSQL ACID transactions without distributed Saga failures.
- **Minimal Infrastructure Overhead:** Can be hosted, monitored, and scaled vertically or horizontally on a single EC2/VPS tier behind Cloudflare.
- **Future Extraction Path:** Because domain boundaries are enforced in code, high-load modules (e.g., `marketplace` search or `notifications` workers) can be extracted into separate services later if global scale demands it.

### Negative / Trade-offs
- Requires disciplined code reviews and lint/import boundary rules so developers do not bypass module facades.

---

## 5. Risks & Mitigations

- **Risk:** Background tasks (booking expiration, notification dispatch) could compete with HTTP request CPU under heavy load.
  - **Mitigation:** Background workers are isolated in `apps/api/src/workers/` so the same codebase can be started either in combined mode (`API + Worker`) initially or as a separate worker process (`NODE_ROLE=worker`) as traffic grows.
- **Risk:** Unhandled runtime exceptions in one module could affect the process.
  - **Mitigation:** Fastify centralized error handling, strict Zod input validation, process supervision, and health-check probes isolate request-level failures.

