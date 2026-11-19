# Phase 8 — Repository Baseline & Synchronization Audit

**Document:** `docs/release-readiness/01-repository-baseline.md`  
**Repository:** `https://github.com/kavicastelo/luggage-storage`  
**Phase:** 8 — Independent Release Candidate Audit & Production Readiness  
**Target Branch:** `audit/phase-8-release-readiness`  
**Base Branches:** `dev` (`81963d5`), `main` (`7987bae`)  
**Audit Date:** November 19, 2026  
**Auditor Status:** Independent Release Readiness Auditor  

---

## 1. Executive Summary

This document establishes the authoritative release baseline for Phase 8 of the Luggage Storage marketplace platform. The platform has progressed through seven preceding major initiatives, integrating marketplace reservations, dual payment providers (Stripe and PayPal), custody escrow with cryptographic HMAC verification, role-based access control (RBAC), and interactive in-app street mapping and mobile turn-by-turn navigation.

The goal of this audit is to verify the exact state of the repository, identify remaining release blockers for both a **Demo Release (Gate A)** and a **Production Release Candidate (Gate B)**, and document a verifiable remediation path.

---

## 2. Git State & Branch Synchronization

### 2.1 Branch Graph & Commit Provenance

The repository topology was inspected across `main`, `dev`, and the previous feature branches:

| Branch | Latest Commit Hash | Author / Origin | Subject |
|---|---|---|---|
| `main` | `7987bae` | GitHub PR #45 | `Merge pull request #45 from kavicastelo/feature/in-app-maps-navigation` |
| `dev` | `81963d5` | `kavicastelo` | `Merge branch 'main' of https://github.com/kavicastelo/luggage-storage into dev` (includes `907a063 ui card fix`) |
| `feature/in-app-maps-navigation` | `6eb056d` | `talno` | `feat(maps): deliver in-app maps, routing, geocoding and mobile navigation transformation` |
| `feature/payment-provider-transformation` | `d045b67` | `talno` | `feat(payments): decommission PayHere, integrate Stripe primary and PayPal alternative` |
| **`audit/phase-8-release-readiness`** | **`81963d5`** | **`talno`** | **Working branch for Phase 8 audit and production remediation** |

All upstream changes from `main` and `dev` are fully synchronized into `audit/phase-8-release-readiness`. No untracked files or dirty working tree states exist at baseline creation.

---

## 3. Monorepo Package Inventory & Workspace Structure

The project is structured as a pnpm workspace with Turbo orchestration:

```
luggage-storage/
├── packages/
│   ├── contracts/            # @luggage-storage/contracts (Shared Zod schemas, types, DTOs)
│   ├── eslint-config/        # @luggage-storage/eslint-config (Workspace ESLint configuration)
│   └── typescript-config/    # @luggage-storage/typescript-config (Shared tsconfig definitions)
├── apps/
│   ├── api/                  # @luggage-storage/api (Fastify 5, Drizzle ORM, PostgreSQL 16 + PostGIS)
│   ├── web/                  # @luggage-storage/web (React 18, Vite 5, Tailwind CSS, lucide-react)
│   └── mobile/               # @luggage-storage/mobile (Expo SDK 58, React Native 0.88, Expo Router)
├── infrastructure/           # Docker Compose, PostgreSQL init scripts, PostGIS verification
└── docs/                     # Architectural documentation, phase reports, and runbooks
```

### 3.1 Package Versions & Dependency Matrix

| Workspace Package | Version | Runtime / Framework | Core Dependencies |
|---|---|---|---|
| `@luggage-storage/contracts` | `0.1.0` | Node.js / TypeScript 5.8 | `zod` 3.24.x |
| `@luggage-storage/api` | `0.1.0` | Node.js 20 LTS / Fastify 5.2 | `fastify`, `drizzle-orm`, `pg`, `stripe`, `argon2`, `@fastify/jwt`, `pino` |
| `@luggage-storage/web` | `0.1.0` | Browser / React 18 / Vite 5 | `react`, `react-dom`, `react-router-dom`, `lucide-react`, `tailwindcss` |
| `@luggage-storage/mobile` | `0.1.0` | Mobile / Expo SDK 58 | `expo`, `react-native`, `expo-router`, `react-native-svg` |

---

## 4. Database Schema & Migration Baseline

The database engine is PostgreSQL 16 with the PostGIS 3.5 extension enabled. Drizzle ORM manages relational schema migrations in `apps/api/src/infrastructure/database/migrations`:

| Migration File | Description | Schema Artifacts |
|---|---|---|
| `0000_outgoing_thunderbolt_ross.sql` | Initial schema | Core user accounts, auth tokens, system roles |
| `0001_empty_puff_adder.sql` | Schema adjustment | Identity indices and session keys |
| `0002_marvelous_hercules.sql` | PostGIS setup | Geometry spatial indices for geographic locations |
| `0003_system_roles.sql` | RBAC foundation | `SYSTEM_ROLES` table and default assignments |
| `0004_permissions_and_rbac.sql` | Granular permissions | Permission catalog and role-permission mappings |
| `0005_stabilization_verification.sql` | Rate limits | Distributed rate-limiting table and hash secrets |
| `0006_marketplace_phase_a.sql` | Phase A Marketplace | Locations, operating hours, pricing tiers, luggage items |
| `0007_phase_a_security_hardening.sql` | Hardening | Location verification status, audit logs |
| `0008_phase_a_final_security_gate.sql` | Integrity checks | Foreign key constraints and cascade rules |
| `0009_phase_a_trusted_identity.sql` | Identity boundary | Trusted identity rotation keys and metadata |
| `0010_phase_a_identity_secret.sql` | Secret provisioning | Key IDs, salt provisions, and token constraints |
| `0011_phase_a_final_corrections.sql` | Identity corrections | Identity session cleanup and TTL indices |
| `0012_phase_b_booking_escrow.sql` | Bookings & Escrow | `bookings`, `payment_intents`, `custody_events`, escrow ledger |
| `0013_phase_b_custody_hmac.sql` | Custody HMAC | Tamper-proof custody tokens and cryptographic signatures |
| `0014_phase_b_refund_evidence.sql` | Refunds & Disputes | `refund_requests`, dispute logs, audit evidence |
| `0015_payhere_channel_aware.sql` | Channel intents | Mobile vs Web checkout intent differentiation |
| `0016_initiative_3_host_staff.sql` | Host delegation | Host partner profiles, staff members, permission scopes |
| `0017_initiative_4_custody.sql` | Custody uploads | Luggage intake/release photos, security seals |
| `0018_initiative_6_payouts.sql` | Host Payouts | Bank account vaults, encrypted payout configs, transfer logs |
| `0019_payment_infrastructure.sql` | Multi-Provider | Stripe customer IDs, PayPal order references, ledger sync |

**Verification Status:**
- Total migrations: **20 applied migrations (0000 - 0019)**.
- Total verified schema tables: **47 tables**.
- PostGIS status: `3.5 USE_GEOS=1 USE_PROJ=1 USE_STATS=1` confirmed on port 5433.
- Schema drift: **Zero**. Drizzle ORM report matches live database state.

---

## 5. Automated Test Baseline

Running the monorepo test suite on branch `audit/phase-8-release-readiness` against the live PostgreSQL + PostGIS test container yielded:

```
Scope: 6 of 7 workspace projects
packages/contracts: 12 test files passed,  88 tests passed (100%)
apps/api:           26 test files passed, 387 tests passed (100%)
apps/web:           21 test files passed, 182 tests passed (100%)
apps/mobile:        20 test files passed, 123 tests passed (100%)
-----------------------------------------------------------------
TOTAL:              79 test files passed, 780 tests passed (100%)
```

- **TypeScript Compilation:** All packages compile without errors (`pnpm --filter @luggage-storage/contracts typecheck`, `pnpm --filter @luggage-storage/api typecheck`, `pnpm --filter @luggage-storage/web typecheck`, `pnpm --filter @luggage-storage/mobile typecheck`).
- **Expo Mobile Build:** `expo export --no-bytecode` exports clean JavaScript bundles for Android, iOS, and Web.

---

## 6. Baseline Findings & Workstream Allocation

While the baseline test suite passes, the independent release audit identifies key gaps required for Gate A (Demo Release) and Gate B (Production Release Candidate):

| ID | Domain | Severity | Baseline Observation | Target Workstream |
|---|---|---|---|---|
| **F-01** | Routing / Maps | High | In `apps/api/src/config/env.ts`, `MAPS_PROVIDER=sandbox` is not rejected in production. `MapsService` can fall back silently to synthetic routes. | WS-1 |
| **F-02** | Geolocation UX | Medium | In `apps/web` and `apps/mobile`, denied geolocation silently defaults to Colombo Fort without explicit user feedback or manual origin selector. | WS-1 |
| **F-03** | Containerization | High | No Dockerfile exists for `apps/api` or `apps/web`. `docker-compose.yml` only provisions database. | WS-2 |
| **F-04** | Demo Data & Reset | High | No reproducible demo seed or idempotent database reset script exists for automated demo environments. | WS-2 |
| **F-05** | PayHere Deprecation | Medium | Legacy PayHere code paths, webhooks, and environment keys remain active rather than cleanly retired. | WS-3 |
| **F-06** | Mobile Distribution | Medium | `apps/mobile/eas.json` does not configure an Android APK preview build profile; `app.json` has placeholder EAS project ID. | WS-4 |
| **F-07** | Operational Readiness | Medium | Backup/restore scripts, structured runbooks, and formal disaster recovery documentation are unfinalized. | WS-6 |

---

## 7. Audit Conclusion

The repository baseline is structurally sound, stable, and completely tested. The core foundations (PostgreSQL + PostGIS, Fastify API, React Web, Expo Mobile) are intact. Remediation will proceed systematically through Workstreams 1 through 7 without disrupting existing working contracts.

