# Global Luggage Storage Marketplace — Documentation Index & Governance Guide

**Repository:** `d:\luggage-storage\luggage-storage`  
**Current Active Phase:** Phase 1B — Identity, Authentication & Access Control  
**Last Updated:** 2026-11-07  

---

## 1. Quick Navigation (Essential Answers)

This guide provides an authoritative roadmap to the project's documentation structure.

| Question | Authoritative Location | Description |
| :--- | :--- | :--- |
| **Where is the authoritative FRS?** | [docs/product/source/luggage-storage-frs.pdf](file:///d:/luggage-storage/luggage-storage/docs/product/source/luggage-storage-frs.pdf)<br>[docs/product/functional-requirements.md](file:///d:/luggage-storage/luggage-storage/docs/product/functional-requirements.md) | Original Functional Requirements Specification PDF and normalized functional requirements catalogue. |
| **Where are approved architecture decisions?** | [docs/architecture/decisions/](file:///d:/luggage-storage/luggage-storage/docs/architecture/decisions/)<br>[docs/architecture/system-architecture.md](file:///d:/luggage-storage/luggage-storage/docs/architecture/system-architecture.md)<br>[docs/architecture/data/](file:///d:/luggage-storage/luggage-storage/docs/architecture/data/) | Accepted ADR-001 through ADR-010, modular monolith architecture, and conceptual/logical ERDs. |
| **Where is the current phase specification?** | [docs/engineering/phase-1b-specification.md](file:///d:/luggage-storage/luggage-storage/docs/engineering/phase-1b-specification.md) | The authoritative execution specification for Phase 1B (Identity, Authentication & Access Control). |
| **Where are acceptance criteria?** | Phase 1A-R: [docs/governance/phase-1a-r-product-owner-acceptance.md](file:///d:/luggage-storage/luggage-storage/docs/governance/phase-1a-r-product-owner-acceptance.md)<br>Phase 1B: [docs/engineering/phase-1b-specification.md](file:///d:/luggage-storage/luggage-storage/docs/engineering/phase-1b-specification.md#12-acceptance-criteria) | Phase 1A-R final signed acceptance register (RC-01 to RC-19) and Phase 1B acceptance criteria (AC-1B-01 to AC-1B-22). |
| **Where is historical evidence?** | [docs/engineering/](file:///d:/luggage-storage/luggage-storage/docs/engineering/)<br>[docs/governance/](file:///d:/luggage-storage/luggage-storage/docs/governance/)<br>[docs/security/](file:///d:/luggage-storage/luggage-storage/docs/security/) | Reports and audit trails for Phase 0A, 0B, 0C, 1A, and 1A-R (including C1–C4 verification logs). |
| **Which documents must an implementation agent read before starting work?** | See [Section 2: Mandatory Agent Reading Order](#2-mandatory-agent-reading-order) below. | Explicit 6-document pre-implementation reading list. |

---

## 2. Mandatory Agent Reading Order

Before writing code in any phase, every engineering agent **must** read the following authoritative baseline documents in sequence:

1. [.agents/engineering-agent-guidance.md](file:///d:/luggage-storage/luggage-storage/.agents/engineering-agent-guidance.md) — Fundamental operating principles, strict scope boundaries, and execution rules.
2. [docs/engineering/repository-architecture.md](file:///d:/luggage-storage/luggage-storage/docs/engineering/repository-architecture.md) — Monorepo structure, workspace dependencies, and Turborepo pipeline.
3. [docs/engineering/coding-standards.md](file:///d:/luggage-storage/luggage-storage/docs/engineering/coding-standards.md) — Code style, TypeScript standards, formatting, and linting rules.
4. [docs/engineering/database-development.md](file:///d:/luggage-storage/luggage-storage/docs/engineering/database-development.md) — PostgreSQL/PostGIS conventions, Drizzle ORM usage, and 3-tier database roles.
5. [docs/engineering/api-conventions.md](file:///d:/luggage-storage/luggage-storage/docs/engineering/api-conventions.md) — Fastify routes, schema validation (Zod), response envelopes, and error handling.
6. [docs/engineering/testing-strategy.md](file:///d:/luggage-storage/luggage-storage/docs/engineering/testing-strategy.md) — Vitest test structure, mock boundaries, and quality gate standards.
7. **Active Phase Specification:** [docs/engineering/phase-1b-specification.md](file:///d:/luggage-storage/luggage-storage/docs/engineering/phase-1b-specification.md) — Current scope, work packages, and acceptance boundaries.

---

## 3. Documentation Authority & Precedence Rules

To prevent conflicting requirements and maintain architectural integrity, the following hierarchy of authority governs this repository:

```
┌────────────────────────────────────────────────────────┐
│ 1. Product Owner Acceptance Records & Gate Audits     │ (docs/governance/)
├────────────────────────────────────────────────────────┤
│ 2. Authoritative FRS & Normalized Product Catalogue    │ (docs/product/)
├────────────────────────────────────────────────────────┤
│ 3. Approved Architecture Decision Records (ADRs)       │ (docs/architecture/decisions/)
├────────────────────────────────────────────────────────┤
│ 4. Active Phase Execution Specifications               │ (docs/engineering/phase-1b-specification.md)
├────────────────────────────────────────────────────────┤
│ 5. Engineering Manuals & Standards                     │ (docs/engineering/)
├────────────────────────────────────────────────────────┤
│ 6. Historical Audit Reports & Verification Evidence    │ (docs/engineering/phase-1a-*, docs/security/)
└────────────────────────────────────────────────────────┘
```

1. **Product Requirements:** The original [FRS PDF](file:///d:/luggage-storage/luggage-storage/docs/product/source/luggage-storage-frs.pdf) and [Functional Requirements](file:///d:/luggage-storage/luggage-storage/docs/product/functional-requirements.md) are strictly authoritative. No agent may alter requirements without Product Owner approval.
2. **Architecture:** Accepted ADRs (ADR-001 through ADR-010) and approved architecture documents are binding. Unresolved questions (OQ-*) must be tracked rather than unilaterally resolved.
3. **Execution Scope:** The current phase specification controls active implementation boundaries. Features belonging to future phases (e.g. bookings, payments, KYC) are strictly prohibited.
4. **Phase Authorization:** Only signed Product Owner acceptance records (`docs/governance/`) and validated entry-gate audits authorize phase commencement.
5. **Historical Traceability:** Historical reports provide audit evidence of past decisions and verifications. They do not authorize new work or override current specifications.
6. **Supersedence:** A newer document supersedes an older one only when that relationship is explicitly stated in the document header.

---

## 4. Documentation Growth Constraints for Future Phases

To maintain high signal-to-noise ratio and prevent uncontrolled documentation sprawl:

- **No Duplication:** Never duplicate existing requirements or architecture content across files; link to the authoritative source.
- **Controlled Reporting:** Do not create separate markdown reports for small implementation tasks. Use one consolidated completion report per phase.
- **Update in Place:** Prefer updating existing living documents (e.g., architecture manuals, schema catalogues) rather than spawning competing revisions.
- **Concise Specifications:** Use one authoritative phase specification broken down into clear, incremental work packages.
- **Preserve History:** Never delete completed phase audits, verification evidence, or governance records.

---

## 5. Comprehensive Document Classification

### 5.1 Authoritative Product Requirements (`docs/product/`)
- [source/luggage-storage-frs.pdf](file:///d:/luggage-storage/luggage-storage/docs/product/source/luggage-storage-frs.pdf) — Original source FRS document.
- [functional-requirements.md](file:///d:/luggage-storage/luggage-storage/docs/product/functional-requirements.md) — Normalized FR catalogue with requirement IDs.
- [business-rules-catalogue.md](file:///d:/luggage-storage/luggage-storage/docs/product/business-rules-catalogue.md) — Core business rules.
- [user-roles-and-actors.md](file:///d:/luggage-storage/luggage-storage/docs/product/user-roles-and-actors.md) — Actor definitions (Traveller, Host, Support, Admin).
- [product-scope-and-boundaries.md](file:///d:/luggage-storage/luggage-storage/docs/product/product-scope-and-boundaries.md) — Scope, MVP definitions, and non-goals.
- [workflow-inventory.md](file:///d:/luggage-storage/luggage-storage/docs/product/workflow-inventory.md) — End-to-end user and operational workflows.
- [requirements-traceability-matrix.md](file:///d:/luggage-storage/luggage-storage/docs/product/requirements-traceability-matrix.md) — Traceability matrix.
- [ux/master-screen-registry.md](file:///d:/luggage-storage/luggage-storage/docs/product/ux/master-screen-registry.md) — UI screen catalogue.

### 5.2 Authoritative Architecture (`docs/architecture/`)
- [system-architecture.md](file:///d:/luggage-storage/luggage-storage/docs/architecture/system-architecture.md) — End-to-end system architecture overview.
- [application-boundaries.md](file:///d:/luggage-storage/luggage-storage/docs/architecture/application-boundaries.md) — API, web, and mobile application boundaries.
- [decisions/ADR-001 through ADR-010](file:///d:/luggage-storage/luggage-storage/docs/architecture/decisions/) — Approved Architecture Decision Records.
- [data/logical-erd.md](file:///d:/luggage-storage/luggage-storage/docs/architecture/data/logical-erd.md) — Logical database entity model.
- [data/data-integrity-and-indexing.md](file:///d:/luggage-storage/luggage-storage/docs/architecture/data/data-integrity-and-indexing.md) — Indexing and foreign key rules.
- [domain/domain-boundaries.md](file:///d:/luggage-storage/luggage-storage/docs/architecture/domain/domain-boundaries.md) — Bounded context definitions.
- [domain/permissions-and-access-matrix.md](file:///d:/luggage-storage/luggage-storage/docs/architecture/domain/permissions-and-access-matrix.md) — Central RBAC permissions matrix.

### 5.3 Active Execution Specifications (`docs/engineering/`)
- [phase-1b-specification.md](file:///d:/luggage-storage/luggage-storage/docs/engineering/phase-1b-specification.md) — Active Phase 1B specification (Identity, Authentication & Access Control).

### 5.4 Governance & Acceptance Records (`docs/governance/`)
- [phase-0c-product-owner-acceptance.md](file:///d:/luggage-storage/luggage-storage/docs/governance/phase-0c-product-owner-acceptance.md) — Phase 0C-D Product Owner acceptance.
- [phase-1a-r-product-owner-acceptance.md](file:///d:/luggage-storage/luggage-storage/docs/governance/phase-1a-r-product-owner-acceptance.md) — **Phase 1A-R Formal Product Owner Acceptance (Accepted 2026-11-07)**.
- [phase-1b-entry-gate-audit.md](file:///d:/luggage-storage/luggage-storage/docs/engineering/phase-1b-entry-gate-audit.md) — **Phase 1B Entry-Gate Audit (Revalidated & Passed 2026-11-07)**.
- [phase-1a-r-security-advisory-register.md](file:///d:/luggage-storage/luggage-storage/docs/governance/phase-1a-r-security-advisory-register.md) — Dependency security risk register.

### 5.5 Engineering Standards & Technical Manuals (`docs/engineering/`)
- [repository-architecture.md](file:///d:/luggage-storage/luggage-storage/docs/engineering/repository-architecture.md) — Monorepo setup.
- [development-setup.md](file:///d:/luggage-storage/luggage-storage/docs/engineering/development-setup.md) — Local developer onboarding guide.
- [coding-standards.md](file:///d:/luggage-storage/luggage-storage/docs/engineering/coding-standards.md) — Coding conventions.
- [testing-strategy.md](file:///d:/luggage-storage/luggage-storage/docs/engineering/testing-strategy.md) — Testing guidelines.
- [database-development.md](file:///d:/luggage-storage/luggage-storage/docs/engineering/database-development.md) — Drizzle ORM and PostgreSQL standards.
- [api-conventions.md](file:///d:/luggage-storage/luggage-storage/docs/engineering/api-conventions.md) — Fastify REST API conventions.
- [environment-management.md](file:///d:/luggage-storage/luggage-storage/docs/engineering/environment-management.md) — Configuration and secrets management.

### 5.6 Historical Evidence & Audits (Preserved)
- **Phase 0A–0C:** `docs/architecture/phase-0a-summary.md`, `phase-0c-summary.md`, `phase-0c-validation-report.md`.
- **Phase 1A & 1A-R:** `docs/engineering/phase-1a-completion-report.md`, `phase-1a-r-completion-report.md`, `phase-1a-r-baseline-audit.md`.
- **Phase 1A-RC through RC3-C4:** All corrective audit files (`phase-1a-rc-*`, `phase-1a-rc3-c1-*`, `phase-1a-rc3-c2-*`, `phase-1a-rc3-c3-*`, `phase-1a-rc3-c4-*`) in `docs/engineering/` and `docs/security/`.
- **Acceptance Closure Audits:** `docs/engineering/phase-1a-r-final-acceptance-change-audit.md`, `docs/engineering/phase-1a-r-final-acceptance-evidence-audit.md`.
