# Phase 0C-D Product Owner Formal Acceptance Record

**Project:** Global Luggage Storage Marketplace  
**Phase:** Phase 0C-D Formal Acceptance  
**Governance Authority:** Product Owner & Technical Project Board  
**Document Status:** **OFFICIALLY ACCEPTED**  
**Decision Code:** **PHASE 0C-D: ACCEPTED**  
**Authorized Next Phase:** **Phase 1A — Engineering Foundation & Repository Architecture ONLY**

---

## 1. Formal Product Owner Acceptance Decision

Following an independent, evidence-based repository audit of the Phase 0C-D deliverables against the source Functional Requirement Specification (`luggage-storage-frs.pdf`), the approved Phase 0B-D requirements baseline, and all confirmed architectural decision records (ADR-001 through ADR-010):

> ### **FORMAL DETERMINATION:**
> **PHASE 0C-D: ACCEPTED**
>
> The Phase 0C-D Domain Architecture, Data Architecture, and Master Screen Registry baseline is formally approved as the authoritative architectural foundation for the Global Luggage Storage Marketplace.

---

## 2. Accepted Architecture Scope & Baseline Documents

The accepted architecture baseline consists of the following 20 authoritative documents:

### 2.1 Domain Architecture (`docs/architecture/domain/`)
1. [`domain-boundaries.md`](../architecture/domain/domain-boundaries.md): Boundaries, responsibilities, commands, events, and invariants for all 22 candidate domains.
2. [`domain-lifecycle-models.md`](../architecture/domain/domain-lifecycle-models.md): State machines for Booking, Capacity, Payment, Refund, Custody, and Host Payable.
3. [`capacity-and-availability-model.md`](../architecture/domain/capacity-and-availability-model.md): Multi-zone spatial config, bag categories, shared/dedicated pools, operating hours, and parent-pool locking.
4. [`pricing-and-financial-domain-model.md`](../architecture/domain/pricing-and-financial-domain-model.md): Base rates, 15% platform commission base, integer minor units, and balanced double-entry ledger.
5. [`domain-event-catalogue.md`](../architecture/domain/domain-event-catalogue.md): Transactional outbox pattern specification (`outbox_events`) and standardized JSON event schemas.
6. [`domain-entity-catalogue.md`](../architecture/domain/domain-entity-catalogue.md): Full entity catalogue, UUIDv7 primary keys, attributes, sensitivity classifications, and retention policies.
7. [`permissions-and-access-matrix.md`](../architecture/domain/permissions-and-access-matrix.md): RBAC matrix across 6 roles, enforcing least privilege and strict Support/Superadmin separation.

### 2.2 Data Architecture (`docs/architecture/data/`)
8. [`global-data-standards.md`](../architecture/data/global-data-standards.md): Standards for ISO 3166, dynamic ISO 4217 minor-unit exponents, BCP 47, IANA timezones, E.164, and 4-layer tax architecture.
9. [`conceptual-erd.md`](../architecture/data/conceptual-erd.md): Conceptual entity relationship diagram mapping business entities and associations.
10. [`logical-erd.md`](../architecture/data/logical-erd.md): Logical Mermaid ERD partitioned into 5 domain clusters with foreign keys, cardinalities, and constraints.
11. [`entity-relationship-catalogue.md`](../architecture/data/entity-relationship-catalogue.md): Master relational table catalog, primary keys, cascading actions (`ON DELETE RESTRICT` for financials), and soft deletion.
12. [`data-integrity-and-indexing.md`](../architecture/data/data-integrity-and-indexing.md): Check constraints, deduplication keys, PostGIS GiST spatial indexing, partial sweeper indexes, and immutability triggers.

### 2.3 UX Architecture & Traceability (`docs/product/ux/`)
13. [`master-screen-registry.md`](../product/ux/master-screen-registry.md): Authoritative catalog of **113 active unique application screens** plus **11 reserved identifiers** across TM, HM, PW, HD, and AD.
14. [`screen-to-workflow-matrix.md`](../product/ux/screen-to-workflow-matrix.md): 100% bidirectional traceability mapping all 44 workflows to specific screens.
15. [`screen-to-requirement-traceability.md`](../product/ux/screen-to-requirement-traceability.md): 100% bidirectional traceability mapping all 72 requirements (57 Source + 15 Implied) to screens.
16. [`navigation-and-journey-maps.md`](../product/ux/navigation-and-journey-maps.md): Mermaid journey maps for Traveller, Host, Staff, Support, and Admin journeys with exception branches.

### 2.4 Governance, Decisions & Reports (`docs/architecture/`)
17. [`phase-0c-open-decisions.md`](../architecture/phase-0c-open-decisions.md): Open technical decisions and launch gates (`OTD-001`–`OTD-008`) mapped to authoritative `OQ-001`–`OQ-022`.
18. [`phase-0c-validation-report.md`](../architecture/phase-0c-validation-report.md): Independent audit report verifying all 17 mandatory checks against FRS with automated proof.
19. [`phase-0c-summary.md`](../architecture/phase-0c-summary.md): Executive summary and completion sign-off for Phase 0C.
20. [`phase-0c-final-correction-report.md`](../architecture/phase-0c-final-correction-report.md): Authoritative integrity audit and reconciliation report for Phase 0C-D.

---

## 3. Mandatory Architectural Integrity Verifications

The Product Owner has independently reviewed and verified the following critical architectural mechanisms:

### A. Capacity Concurrency & Concurrency Safety
- **Parent Pool Serialization:** Every capacity-changing transaction locks the parent `storage_capacity_pools` row via `SELECT ... FOR UPDATE` under `READ COMMITTED` isolation. This serializes concurrent booking requests for that physical space, preventing deadlocks across overlapping multi-day date ranges.
- **Capacity Checks After Lock Acquisition:** Available capacity is calculated within the transaction boundary *after* acquiring the row lock.
- **Deterministic Multi-Stage Holds:**
  - `HELD_FOR_HOST_APPROVAL`: 15-minute host response SLA (`BR-005`).
  - `HELD_FOR_PAYMENT`: 10-minute traveller payment SLA (`BR-006`), initiated on instant checkout or extended upon host acceptance.
- **Synchronous Expiration Validation:** Any action on an expired reservation is rejected synchronously by evaluating `expires_at < NOW()`, regardless of whether the background sweeper has executed.
- **Sweeper Role:** The 30-second sweeper (`FOR UPDATE SKIP LOCKED`) is asynchronous cleanup infrastructure, not the source of booking correctness.
- **Idempotency & Race Handling:** Host acceptance cannot extend an already-expired hold. Payment confirmation arriving concurrently with expiry resolution uses row-level locking to determine whether confirmation or orphaned-refund processing applies.

### B. Financial Ledger Integrity
- **Double-Entry Mathematical Balance:** All 6 transaction archetypes balance exactly ($\sum 	ext{Debits} = \sum 	ext{Credits}$) in integer minor units (LKR cents).
- **Approved Commission Base:** Platform commission is fixed at 15% of the eligible storage subtotal (gross storage after host discounts, excluding taxes and platform promo subsidies).
- **Gateway Fee Absorption:** In the initial Sri Lanka launch, gateway processing fees (e.g., PayHere MDR) are absorbed by the platform from commission revenue and are never deducted from host earnings (`BR-042`).
- **Promotion Funding Attribution:** Host-funded discounts reduce the storage subtotal and commissionable base; platform-funded promotions are absorbed entirely by the platform, ensuring the host receives their full 85% share of the gross storage subtotal.
- **Immutability:** Financial ledger entries and confirmed booking pricing snapshots are strictly append-only, protected by database trigger guards against `UPDATE` and `DELETE`.

### C. Payment Provider Independence
- **Port/Adapter Abstraction:** Core payment domain logic is 100% gateway-agnostic, interacting exclusively through the `PaymentGatewayPort` interface.
- **Provider Adapters:** Signature verification (`md5sig`, `sha256sig`) and provider-specific payload mapping are encapsulated in isolated gateway adapters (`PayHereAdapter`).
- **Client Redirects Untrusted:** A frontend return URL is never accepted as payment confirmation. Confirmation requires an authenticated, cryptographically verified server-to-server webhook with idempotent deduplication.
- **External Launch Gates Preserved:** Written marketplace approval from PayHere (`OQ-003`) and refund API automation (`OQ-013`) remain mandatory launch gate blockers.

### D. Custody & Dispute Decoupling: Zero Possessory Lien
- **Independent Physical State:** Terminal physical custody is `RELEASED_TO_TRAVELLER`.
- **Zero Possessory Lien Invariant:** Unpaid or disputed overdue fees never prevent or delay the physical return of luggage to a verified traveller (`BR-035`, `BR-061`).
- **Operational Condition Tracking:** Bags are handed over, and unpaid charges emit `custody.released_with_unpaid_fees` to the Billing and Support domains for administrative collection without detaining personal belongings.

### E. Global Data Standards & Legal Boundaries
- **Dynamic Minor Units:** Currency architecture supports 0, 2, and 3-decimal currencies dynamically via metadata exponents (`BR-089`).
- **Tax Model:** 4-layer taxonomy (Capability -> Jurisdiction Rules -> Legal Classification -> Compliance Gate). Configured default is 0% exempt pending formal written tax counsel opinion (`OQ-010`).
- **Data Retention:** Documented retention schedules are recognized as engineering proposals, subject to formal legal adoption prior to production launch (`OQ-020`).

---

## 4. Remaining External Launch Gates & Dependencies

Product Owner acceptance of Phase 0C-D does **not** assume resolution of the following external commercial, provider, or legal gates:

| Gate ID | Area | External Dependency & Condition | Blocking Phase |
| :--- | :--- | :--- | :--- |
| `OQ-003` | Payments | Formal written confirmation from PayHere compliance approving marketplace settlement model. | Pre-Launch Production Gate |
| `OQ-010` | Tax & Legal | Formal Sri Lankan tax counsel opinion regarding marketplace corporate characterization and invoicing. | Commercial Launch Gate |
| `OQ-013` | Refunds | Payment provider confirmation of automated API refund execution and fee return policies. | Phase 1 Sprint 3 |
| `OQ-018` | Mapping | Commercial contract execution for MapTiler Cloud vs. self-hosted Protomaps on Cloudflare R2. | Phase 1 Sprint 1 |
| `OQ-019` | Email | Transactional email provider selection (AWS SES vs. Resend). | Phase 1 Sprint 1 |
| `OQ-020` | SMS / OTP | Commercial registration with domestic Sri Lankan SMS aggregator (Dialog / Mobitel). | Phase 1 Sprint 2 |
| `OQ-021` | Caching | Redis / Upstash activation timing. PostgreSQL row locking confirmed for MVP launch. | Scaling Gate |

---

## 5. Scope of Authorization for Phase 1A

1. **Authorization Granted:**
   - **Phase 1A — Engineering Foundation & Repository Architecture** is formally **AUTHORIZED TO COMMENCE**.
   - Scope is restricted to establishing the repository architecture, monorepo workspaces, build tooling, shared contracts, Fastify backend foundation, minimal web foundation, minimal Expo mobile foundation, testing harness, and engineering documentation.
2. **Strict Implementation Restrictions:**
   - **Phase 1B, Phase 2, and all complete marketplace business logic remain STRICTLY UNAUTHORIZED.**
   - No marketplace tables (bookings, payments, capacity pools, locations) may be created as production migrations in Phase 1A.
   - No authentication flows, KYC workflows, checkout flows, or external integrations may be implemented in Phase 1A.
   - Acceptance of Phase 0C-D does **not** constitute production deployment approval, legal compliance certification, or authorization of external paid services.

---

## 6. Official Sign-Off

- **Decision:** **PHASE 0C-D: ACCEPTED**
- **Effective Timestamp:** 2026-11-07T04:20:00+05:30
- **Governing Repository:** `d:\luggage-storage\luggage-storage`
- **Authorized Execution:** Phase 1A Engineering Foundation
