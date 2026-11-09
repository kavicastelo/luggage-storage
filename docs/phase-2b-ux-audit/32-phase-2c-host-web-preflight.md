# Phase 2C.4 — Host Web Dashboard Implementation Preflight Report
## Document 32: Workstream 4 (`WS-4-HOST-WEB`) Architecture Preflight & Boundary Specification

**Project:** Global Luggage Storage Marketplace (`https://github.com/kavicastelo/luggage-storage`)  
**Document ID:** `DOC-UX-P2C-032`  
**Phase:** Phase 2C.4 — Host Web Dashboard (`WS-4-HOST-WEB`)  
**Preflight Date:** November 10, 2026  
**Auditor / Lead Engineer:** Principal Product Architect & Senior Frontend Systems Lead  
**Target Branch:** `feat/phase-2c-host-web`  
**Base Parent Commit:** `d242f44` (`docs(audit): complete phase 2c.3.1 traveller mobile independent verification`)  
**Governing Documents:**  
- `02-canonical-screen-inventory.md` (`DOC-UX-P2B-002`)
- `10-proposed-design-system.md` (`DOC-UX-P2B-010`)
- `15-evidence-and-verification-register.md` (`DOC-UX-P2C-015`)
- `16-product-decisions-required.md` (`DOC-UX-P2C-016`)
- `18-phase-2c-implementation-backlog.md` (`DOC-UX-P2C-018`)
- `19-phase-2c-qa-and-release-gates.md` (`DOC-UX-P2C-019`)
- `30-phase-2c-traveller-mobile-independent-audit.md` (`DOC-UX-P2C-030`)
- `31-phase-2c-traveller-mobile-product-decision-reconciliation.md` (`DOC-UX-P2C-031`)

---

### 1. Executive Summary & Preflight Mandate

Before modifying source code in `apps/web`, this preflight audit establishes the verified baseline, existing integrations, missing backend capabilities, unresolved product decisions, and exact implementation boundaries for **Workstream 4 (`WS-4-HOST-WEB`)**.

The Host Web surface covers 14 registered canonical screens (`HD-001` through `HD-014`). Its purpose is to deliver a high-velocity, reliable operational workspace for luggage storage business owners (`HOST_OWNER`) and counter staff attendants (`HOST_STAFF`).

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        WS-4 HOST WEB PREFLIGHT ARCHITECTURE AUDIT                      │
├─────────────────────────────────────┬──────────────────┬───────────────────────────────┤
│ Architectural Dimension             │ Existing State   │ Workstream 4 Target           │
├─────────────────────────────────────┼──────────────────┼───────────────────────────────┤
│ Target Screens                      │ 14 Routes Stubbed│ 14 Consumer-Grade Screens     │
│ Design Tokens                       │ Ad-hoc Blue/Slate│ Canonical CWCP (Navy/Terracotta)│
│ Developer Code Suppression (GATE-03)│ Leaked HD-xxx    │ 100% Suppressed in UI DOM     │
│ RBAC Enforcement                    │ Basic Role Switch│ Strict HOST_OWNER vs STAFF    │
│ Desk Operations Kiosk (`HD-009`)    │ Generic Form     │ Rapid Multi-Mode Kiosk        │
│ Investigation View (`HD-008`)       │ Basic Modal      │ Full Custody Audit Timeline   │
│ Monorepo Test Baseline              │ 415 Tests (100%) │ Expanded Interactive Tests    │
│ Product Decisions Boundary          │ 7 Decisions Open │ Strictly Bounded as Prototype │
└─────────────────────────────────────┴──────────────────┴───────────────────────────────┘
```

---

### 2. Verified Monorepo Architecture & Existing Integrations

1. **Authentication & Session State:**
   - `apps/web/src/store/useAuthStore.ts` provides session continuity from Phase 1B (`isAuthenticated`, `user`, `user.roles`).
   - Supported roles: `HOST_OWNER`, `HOST_STAFF`, `SUPERADMIN`, `TRAVELLER`.
   - `ProtectedRoute.tsx` guards `/host/*` requiring `HOST_OWNER`, `HOST_STAFF`, or `SUPERADMIN`.
   - Supports seamless demo preview mode when unauthenticated via `?preview=demo` or toggle in `DeveloperDrawer.tsx`.
2. **Design System & Primitives:**
   - Shared design tokens in `packages/contracts/src/tokens.ts` (Terracotta `#C55013`, Coastal Navy `#0A192F`, Warm Sand `#FAF8F5`).
   - Web UI primitives in `apps/web/src/components/ui/` (`Button`, `Card`, `Badge`, `Alert`, `Input`, `MascotIllustration`).
   - Tailwind preset configured in `apps/web/tailwind.config.js`.
3. **Data Layer & Fixtures:**
   - `apps/web/src/data/mock-marketplace.ts` exports `DEMO_LOCATIONS` (6 Sri Lankan transit hubs) and `DEMO_BOOKINGS` (4 custody state records).

---

### 3. Missing Backend Capabilities & Explicit Boundaries

In strict compliance with **Non-Negotiable Constraint Rule 1.3**, the frontend must not invent undocumented API schemas or pretend that local actions have persisted to PostgreSQL:

| Operational Feature | Screen ID | Backend Reality in `apps/api` | Proposed Frontend Implementation Boundary |
|---|:---:|---|---|
| **Location Profile Update** | `HD-003` | Fastify endpoint does not exist | Level 2 Client React state update with explicit "Preview changes saved locally" toast. |
| **Weekly Schedule Rules** | `HD-004` | No schedule engine in database | Client schedule editor with holiday exceptions; preserves local state. |
| **Capacity Zone Mutation** | `HD-005` | No zone table in Drizzle schema | Visual zone capacity bars with client-side slot configuration. |
| **Pricing Multipliers** | `HD-006` | No dynamic rate engine | Client LKR rate calculator with transparent formula breakdown. |
| **Custody Check-In / Release** | `HD-009` | No custody state machine in API | Kiosk simulator with duplicate submission protection and audited client feedback. |
| **Financial Ledger Entries** | `HD-010` | No host financial ledger table | Mathematical itemization: Gross (100%) - Commission (15%) = Host Net (85%). |
| **Banking Payout Execution** | `HD-011` | No automated CEFT/SLIPS batcher | Masked account card (`**** 8821`) with prototype payout history. |
| **Review Public Response** | `HD-012` | No review response endpoint | Response composer with preview state and local submission acknowledgment. |
| **Staff Member Invitation** | `HD-013` | Live `/auth/register` exists | Scoped staff directory with invitation modal simulating counter assignment. |

---

### 4. Product Decision Alignment (Document 16 Reconciliation)

All seven pending product decisions remain classified as **`PENDING_PRODUCT_OWNER_SIGN_OFF`**:
- `DEC-001` (Photo Evidence Protocol): The host desk will support 1-tap verification ("Standard Verification") without blocking on camera uploads.
- `DEC-002` (Overdue Fee Collection): Discloses overdue policy as illustrative venue terms (30m grace period) without claiming automatic credit card debits.
- `DEC-003` (Cancellation Gateway Fees): Displays 7-stage refund stepper honestly as an illustrative workflow.
- `DEC-005` (Offline Pass Cryptography): Desk supports manual 6-digit PIN entry and QR payload lookup without claiming hardware enclave verification.
- `DEC-006` (Host Payout Cadence): Labeled as illustrative weekly settlement schedule.
- `DEC-007` (Physical Security Seals): Displays serialized tag input fields (`#SEAL-LK-90211`) as manual staff inputs.
- `DEC-010` (Partner Trust Badges): Restricts badges to verified mock venue metadata from `DEMO_LOCATIONS`.

---

### 5. Implementation Roadmap & Quality Gates

The implementation will proceed through the canonical sub-phases:
1. **Host Application Shell & Navigation:** Humanized navy sidebar (zero `HD-xxx` codes), active venue selector, role switcher (`HOST_OWNER` vs `HOST_STAFF`), responsive desktop/tablet layout.
2. **Location Management Suite (`HD-002`–`HD-006`):** Location listing, Profile Editor, Schedule Editor with Poya holidays, Capacity Zones, and Pricing Rules.
3. **Custody & Operations Suite (`HD-007`–`HD-009`):** Bookings Hub with live search/filters, Custody Investigation timeline drawer (`HD-008`), and Rapid Check-in/out Operations Kiosk (`HD-009`).
4. **Business & Financial Suite (`HD-010`–`HD-014`):** Revenue Ledger, Payouts, Customer Reviews, Staff RBAC, and Business Legal Settings.
5. **Quality Verification & Testing:** Interactive component test suite, multi-viewport screenshot captures, and formal release gate audit.
