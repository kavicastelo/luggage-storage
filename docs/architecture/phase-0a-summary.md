# Phase 0A Architecture Summary — Product Architecture & System Foundation

**Document Status:** Phase 0A Complete — Awaiting Product Owner Review
**Date:** 2026-11-07
**Source Reference:** [luggage-storage-frs.pdf](../product/source/luggage-storage-frs.pdf)

---

## 1. Completed Phase 0A Deliverables

All ten mandatory Phase 0A documentation deliverables (plus ten individual Architecture Decision Records) have been authored, cross-referenced, and validated against the original FRS:

| Deliverable ID | Document Title | Repository Path | Status |
| :--- | :--- | :--- | :---: |
| **Deliverable A** | Product Overview | [docs/product/product-overview.md](../product/product-overview.md) | **COMPLETE** |
| **Deliverable B** | Product Scope and Application Boundaries | [docs/product/product-scope-and-boundaries.md](../product/product-scope-and-boundaries.md) | **COMPLETE** |
| **Deliverable C** | User Roles and Actor Model | [docs/product/user-roles-and-actors.md](../product/user-roles-and-actors.md) | **COMPLETE** |
| **Deliverable D** | System Architecture Overview | [docs/architecture/system-architecture.md](system-architecture.md) | **COMPLETE** |
| **Deliverable E** | Application Architecture Boundaries | [docs/architecture/application-boundaries.md](application-boundaries.md) | **COMPLETE** |
| **Deliverable F** | Backend Domain Architecture Overview | [docs/architecture/backend-domain-overview.md](backend-domain-overview.md) | **COMPLETE** |
| **Deliverable G** | Technology Decisions Register | [docs/architecture/technology-decisions.md](technology-decisions.md) | **COMPLETE** |
| **Deliverable H** | Architecture Decision Records (`ADR-001`–`ADR-010`) | [docs/architecture/decisions/](decisions/) | **COMPLETE** |
| **Deliverable I** | Assumptions and Open Questions Register | [docs/product/assumptions-and-open-questions.md](../product/assumptions-and-open-questions.md) | **COMPLETE** |
| **Deliverable J** | Phase 0A Architecture Summary | [docs/architecture/phase-0a-summary.md](phase-0a-summary.md) | **COMPLETE** |

### Individual Architecture Decision Records (`Deliverable H`)
- [ADR-001: Modular Monolithic Backend with Fastify and TypeScript](decisions/ADR-001-modular-monolithic-backend.md)
- [ADR-002: React Native + Expo with EAS Cloud Builds for Mobile Applications](decisions/ADR-002-react-native-expo.md)
- [ADR-003: Shared Mobile Codebase with Separate Traveller and Host App Identities](decisions/ADR-003-shared-mobile-codebase-separate-identities.md)
- [ADR-004: Unified React + Vite Web Application Serving Public, Host, and Superadmin Experiences](decisions/ADR-004-react-vite-web-application.md)
- [ADR-005: PostgreSQL with PostGIS on Neon as Primary Database](decisions/ADR-005-postgresql-postgis.md)
- [ADR-006: Drizzle ORM for Database Access and Schema Management](decisions/ADR-006-drizzle-orm.md)
- [ADR-007: Monorepo Architecture with pnpm Workspaces and Turborepo](decisions/ADR-007-pnpm-turborepo.md)
- [ADR-008: PayHere as Initial Payment Provider with Provider-Agnostic Payment Abstraction and Manual Superadmin Payouts](decisions/ADR-008-payhere-initial-payment-provider.md)
- [ADR-009: Cloudflare R2 for Media, KYC Verification Documents, and Custody Evidence Storage](decisions/ADR-009-cloudflare-r2.md)
- [ADR-010: Global-Ready Data and Domain Architecture from Initial Release](decisions/ADR-010-global-ready-data-architecture.md)

---

## 2. Architecture Overview

The **Global Luggage Storage Marketplace** is architected as a **TypeScript Monorepo (`pnpm` + `Turborepo`)** delivering five distinct user experiences through two frontend codebases (`apps/mobile` and `apps/web`) connected to a single **Modular Monolithic Backend (`apps/api`)**:

1. **Client Experiences:**
   - **Traveller Mobile Application (`apps/mobile` — Traveller identity):** Discovery, map search, availability/price preview, booking, PayHere checkout, directions, QR/PIN custody verification, reviews, favourites (`Later` UI), and customer support.
   - **Host Mobile Application (`apps/mobile` — Host identity):** Host onboarding, KYC verification, single/multi-location setup (`FR-44`), hours/capacity/pricing, booking dashboard & acceptance (`FR-26`), QR/PIN scanning, bag check-in and photo evidence (`FR-29`), check-out & late collection handling (`FR-32`), earnings/payouts/transactions (`FR-36`–`FR-38`), incidents (`FR-41`), staff accounts (`Later` UI), and analytics (`Later` UI).
   - **Unified Web Application (`apps/web` — React + Vite):** Isolated into (1) **Public Traveller Website**, (2) **Host Management Dashboard** (`/host/*`), and (3) **Superadmin & Operations Dashboard** (`/admin/*`).
2. **Backend Modular Monolith (`apps/api`):**
   - Built with **Node.js, Fastify, TypeScript, OpenAPI, and Zod**.
   - Partitioned into **23 encapsulated domains** with strict ownership boundaries and zero cross-module table mutations.
   - Enforces a clear separation between **Booking** (what is reserved), **Payment/Finance** (what is paid, commissioned, and disbursed), and **Custody** (physical possession and verification of bags).
3. **Data & Infrastructure Layer:**
   - **Neon PostgreSQL + PostGIS** with **Drizzle ORM** for ACID transactions, spatial discovery queries, and immutable financial/custody audit logs.
   - **Cloudflare R2** for zero-egress public location media (`FR-19`) and private signed-URL access to KYC documents (`FR-16`) and check-in evidence (`FR-29`).
   - **PayHere** integrated behind a provider-agnostic `PaymentGatewayPort` for initial Sri Lanka launch, paired with **manual Superadmin host payouts (`FR-37`)**.

---

## 3. Confirmed Decisions

1. **Monorepo & Tooling:** `pnpm` workspaces + `Turborepo` + shared TypeScript/Zod packages (`ADR-007`).
2. **Mobile Stack:** React Native + Expo + TypeScript + Expo Router + TanStack Query + Zustand + React Hook Form + Zod + Expo Camera/Location/Notifications, using **Expo Development Builds** and **EAS Cloud Builds** from Windows (`ADR-002`).
3. **Dual Mobile Identities:** Single shared `apps/mobile` codebase producing separate Traveller and Host application binaries (`ADR-003`).
4. **Web Stack:** Single React + Vite + TypeScript + Tailwind CSS + shadcn/ui + React Router application in `apps/web` serving Public Website, Host Dashboard, and Superadmin Dashboard (`ADR-004`).
5. **Backend Stack:** Node.js + TypeScript + Fastify Modular Monolith exposing OpenAPI-documented REST APIs (`ADR-001`).
6. **Database Stack:** PostgreSQL + PostGIS (hosted initially on Neon) accessed via Drizzle ORM (`ADR-005`, `ADR-006`).
7. **Media Storage & Edge:** Cloudflare R2 for object storage and Cloudflare for DNS, CDN, and security (`ADR-009`).
8. **Initial Payment Gateway & Payout Model:** PayHere for customer payments (`FR-6`) and manual payouts executed via the Superadmin Dashboard (`FR-37`, `ADR-008`).
9. **Global-Ready Foundation:** `ISO 3166-1` country codes, `ISO 4217` currency codes, `BCP 47` locales, `IANA` timezones, `UTC` timestamps, and `E.164` phone numbers across all schemas from day one (`ADR-010`).
10. **Two-Dimensional Release Completeness:** 100% of FRS screens (`MVP`, `Later`, `Later/MVP`, `Recommended`, `Depends`) must exist and be navigable in the initial UI release, while backend implementation follows the FRS classification.

---

## 4. Proposed Decisions (Awaiting Owner Confirmation)

1. **Unified User Identity with Multi-Role Contexts (`OQ-007`):** A single `User` account can hold both `Traveller` and `Host` contexts across mobile and web without requiring separate email registrations.
2. **Five Authenticated Role Contexts (`User Roles and Actor Model`):** `Traveller`, `Host Owner`, `Host Staff` (`Later` — `FR-42`), `Platform Support/Operations Staff`, and `Platform Superadmin` (with manual payouts under `FR-37` restricted exclusively to `Superadmin`).
3. **Normalized Internal Requirement IDs (`OQ-022`):** Preserving original FRS numbers (`FR-1`..`FR-44`) while pairing them with unique internal keys (`REQ-TRV-001`..`027` and `REQ-HST-001`..`030`) to resolve the duplicate numbering of `FR-2` through `FR-14` in the original PDF.
4. **Recommended Providers for Open Technical Slots:**
   - **Authentication (`OQ-001`):** Self-managed PostgreSQL-backed auth in Fastify (Better Auth or custom JWT/refresh token + Arctic for Google/Apple OAuth).
   - **Maps/Geocoding (`OQ-018`):** MapTiler (or Stadia/AWS Location) for MapLibre vector tiles + native Google/Apple Maps deep-link handoff for `FR-7 Directions`.
   - **Email (`OQ-019`):** Resend or Amazon SES behind `EmailProviderPort`.
   - **SMS (`OQ-020`):** Country-routed `SmsProviderPort` (Sri Lankan local SMS gateway for `+94` + Twilio/SNS fallback for international), with email/OAuth as primary MVP auth.
   - **Redis (`OQ-021`):** Defer live Redis/Upstash provisioning until multi-instance API scaling requires it.

---

## 5. Unresolved Business & Technical Decisions

Twenty-two open questions are cataloged in [docs/product/assumptions-and-open-questions.md](../product/assumptions-and-open-questions.md). The top architecture-shaping decisions requiring product owner input are:
- **`OQ-001`:** Authentication provider selection.
- **`OQ-002`:** Sri Lankan Host KYC & business verification document requirements (`FR-16`).
- **`OQ-003`:** Commercial/regulatory confirmation with PayHere for marketplace collection + manual host payouts (`FR-6`, `FR-37`).
- **`OQ-004`:** Instant booking vs. host-approval booking workflow and payment timing (`FR-26`).
- **`OQ-005` & `OQ-006`:** Host pricing model boundaries (`FR-23`), commission structure (`FR-38`), promo code funding (`FR-13`), and standard bag categories (`FR-21`).
- **`OQ-009`, `OQ-013`, `OQ-015`:** Cancellation/refund policies (`FR-10`, `FR-34`), `FR-10 Refund Status` (`Later/MVP`) scope, and late collection fee payment workflow (`FR-32`).
- **`OQ-012`:** Whether exact host address/name is masked before booking confirmation (`FR-4` vs. `FR-7`).

---

## 6. Key Architectural Risks & Mitigations

| Risk ID | Risk Description | Severity | Mitigation Strategy |
| :--- | :--- | :---: | :--- |
| `RSK-01` | **PayHere Marketplace Settlement Constraints:** Standard merchant accounts do not provide built-in marketplace escrow/split settlement. | **High** | Isolate PayHere behind `PaymentGatewayPort`, maintain an authoritative internal ledger in `finance`, execute payouts manually via Superadmin (`FR-37`), and validate commercial terms with PayHere early (`OQ-003`). |
| `RSK-02` | **Concurrent Overbooking of Limited Storage Capacity:** Multiple travellers booking the last bag slots simultaneously. | **High** | Use short-lived, atomic PostgreSQL transactions (`SELECT ... FOR UPDATE`) on `capacity_pools` with expiring `capacity_reservations` before payment initiation. |
| `RSK-03` | **Custody Disputes Over Lost or Damaged Bags:** Disagreements between Traveller and Host regarding bag condition or handoff time. | **High** | Enforce cryptographic QR/PIN verification (`FR-8`, `FR-27`, `FR-30`), check-in bag verification (`FR-28`), timestamped photo/tag evidence in private R2 (`FR-29`), and legal-hold incident logs (`FR-41`). |
| `RSK-04` | **Client-Side Price or Status Manipulation:** Malicious clients tampering with prices, promo codes, or payment redirect parameters. | **High** | Enforce server-authoritative pricing snapshots (`FR-5`) and confirm bookings exclusively via cryptographically verified PayHere server webhooks (`FR-6`). |
| `RSK-05` | **Cross-Timezone Scheduling Bugs:** Travellers in foreign timezones booking drop-off/collection outside a host's local operating hours. | **Medium** | Store all instants in `UTC` (`TIMESTAMPTZ`) and evaluate all `FR-20` operating schedules explicitly against the `StorageLocation`'s `IANA` timezone (`ADR-010`). |
| `RSK-06` | **FRS Duplicate Numbering Ambiguity (`FR-2`–`FR-14`):** Requirements being skipped if tracked only by raw `FR-x` string. | **Medium** | Maintain 1:1 traceability across all 57 source FRS rows using normalized internal IDs (`REQ-TRV-001`..`027`, `REQ-HST-001`..`030`) paired with original `FR-x` labels (`OQ-022`). |

---

## 7. Explicit Scope Exclusions in Phase 0A

In strict compliance with Phase 0A execution rules:
- **Zero application code (`apps/mobile`, `apps/web`, `apps/api`, `packages/*`) was created or modified.**
- **Zero dependencies were installed (`package.json`, `pnpm-lock.yaml`).**
- **Zero database schemas or migrations were generated.**
- **Zero unapproved business policies or third-party integrations were fabricated or marked as tested.**

---

## 8. Dependencies & Recommendation for Phase 0B

### Recommended Next Phase: **Phase 0B — Detailed Requirements Normalization, Domain Engine Specifications, Database ERD & Complete Screen Registry**

Once the product owner reviews Phase 0A and provides guidance on the critical open questions in [assumptions-and-open-questions.md](../product/assumptions-and-open-questions.md), **Phase 0B** should proceed to produce:
1. **Normalized Functional Requirements Specification & Traceability Matrix (`docs/product/functional-requirements.md`):** Mapping all 57 FRS rows (`REQ-TRV-001`..`027`, `REQ-HST-001`..`030`) plus implicit Superadmin/Web requirements to exact acceptance criteria, screens, and APIs.
2. **Core Engine Specifications (`docs/domains/*`):** Detailed state machines, algorithms, and policy rules for the **Configurable Capacity Engine**, **Availability Engine**, **Pricing Engine**, **Booking Engine**, **Payment & Ledger Engine**, and **Luggage Custody Engine**.
3. **Complete Database ERD & Data Dictionary (`docs/database/erd.md`, `docs/database/data-dictionary.md`):** Table-by-table column definitions, constraints, PostGIS indexes, and foreign-key ownership rules across all 23 domains.
4. **Master Screen Registry (`docs/product/screen-inventory.md`):** Exhaustive route-by-route inventory across Traveller Mobile, Host Mobile, Public Web, Host Web Dashboard, and Superadmin Web Dashboard, classifying each screen's `functionalStatus` (`functional` vs. `ui-only`) and `uiStatus` (`complete`).

