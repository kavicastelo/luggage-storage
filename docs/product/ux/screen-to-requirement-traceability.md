# Screen-to-Requirement Traceability Matrix

**Project:** Global Luggage Storage Marketplace  
**Document Type:** UX Architecture & Traceability Specification  
**Status:** Approved Phase 0C Baseline  
**Governing Documents:** Master Screen Registry (`master-screen-registry.md`), Functional Requirements (`docs/product/functional-requirements.md`), Requirement Traceability Matrix (`docs/product/requirements-traceability-matrix.md`).

---

## 1. Executive Summary & Traceability Mandate

This document establishes 100% bidirectional traceability between all 57 normalized Functional Requirements from the source FRS (`REQ-TRV-001`–`REQ-TRV-027`, `REQ-HST-001`–`REQ-HST-030`), the 15 implied requirements (`REQ-IMPL-001`–`REQ-IMPL-015`), and the authoritative user interface screens across all 5 client surfaces:
- **`TM`:** Traveller Mobile Application
- **`HM`:** Host Mobile Application
- **`PW`:** Public Web Application
- **`HD`:** Host Web Dashboard
- **`AD`:** Superadmin Web Dashboard

---

## 2. Source FRS Requirements to Screen Traceability (57 Requirements)

### 2.1 Traveller Requirements (`REQ-TRV-001` to `REQ-TRV-027`)

| Source ID | Req ID | Requirement Title | Traveller Mobile (`TM`) | Public Web (`PW`) | Superadmin (`AD`) | Delivery Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FR -1` | `REQ-TRV-001` | Account Registration & Login | `TM-001`, `TM-002`, `TM-005`, `TM-006`, `TM-007`, `TM-008` | `PW-001` | `AD-017` | `MVP Functional` |
| `FR -2 (A)`| `REQ-TRV-002` | Traveller Profile | `TM-042`, `TM-043`, `TM-044` | `PW-011` | `AD-005` | `MVP Functional` |
| `FR -2 (B)`| `REQ-TRV-003` | Location Search | `TM-011`, `TM-012`, `TM-013` | `PW-001`, `PW-002` | — | `MVP Functional` |
| `FR -3` | `REQ-TRV-004` | Map View | `TM-012`, `TM-013` | `PW-002` | — | `MVP Functional` |
| `FR -4` | `REQ-TRV-005` | Host Listings | `TM-013` | `PW-002` | — | `MVP Functional` |
| `FR -5` | `REQ-TRV-006` | Filters | `TM-014` | `PW-002` | — | `MVP Functional` |
| `FR -6` | `REQ-TRV-007` | Host Details | `TM-015`, `TM-016` | `PW-003` | — | `MVP Functional` |
| `FR -7` | `REQ-TRV-008` | Availability Check | `TM-015`, `TM-017` | `PW-003`, `PW-004` | — | `MVP Functional` |
| `FR -8` | `REQ-TRV-009` | Price Calculation | `TM-018`, `TM-019` | `PW-004` | — | `MVP Functional` |
| `FR -9` | `REQ-TRV-010` | Booking | `TM-019`, `TM-022`, `TM-024` | `PW-004`, `PW-005` | `AD-005` | `MVP Functional` |
| `FR -10` | `REQ-TRV-011` | Online Payment | `TM-020`, `TM-021`, `TM-023` | `PW-005` | `AD-006` | `MVP Functional` |
| `FR -11` | `REQ-TRV-012` | Booking Confirmation | `TM-024` | `PW-005` | `AD-005` | `MVP Functional` |
| `FR -12` | `REQ-TRV-013` | Directions | `TM-027` | `PW-011` | — | `MVP Functional` |
| `FR -13 (A)`| `REQ-TRV-014`| Check-in / Bag Drop | `TM-027`, `TM-028` | — | `AD-005` | `MVP Functional` |
| `FR -14 (A)`| `REQ-TRV-015`| Check-out / Collection | `TM-029`, `TM-030` | — | `AD-005` | `MVP Functional` |
| `FR -7 (B)` | `REQ-TRV-016`| Active Booking | `TM-027`, `TM-029` | `PW-011` | `AD-005` | `MVP Functional` |
| `FR -8 (B)` | `REQ-TRV-017`| Booking History | `TM-035` | `PW-011` | `AD-005` | `MVP Functional` |
| `FR -9 (B)` | `REQ-TRV-018`| Cancellation | `TM-031`, `TM-032` | `PW-011` | `AD-005`, `AD-007` | `MVP Functional` |
| `FR -10 (B)`| `REQ-TRV-019`| Refund Status | `TM-032`, `TM-033` | `PW-011` | `AD-007` | `MVP Functional` |
| `FR -11 (B)`| `REQ-TRV-020`| Notifications | `TM-037` | — | `AD-017` | `MVP Functional` |
| `FR -12 (B)`| `REQ-TRV-021`| Host Reviews & Ratings | `TM-015`, `TM-016` | `PW-003` | `AD-014` | `MVP Functional` |
| `FR -13 (B)`| `REQ-TRV-022`| Leave Review | `TM-030`, `TM-034` | — | `AD-014` | `MVP Functional` |
| `FR -14 (B)`| `REQ-TRV-023`| Customer Support | `TM-039`, `TM-040`, `TM-041` | `PW-008`, `PW-009` | `AD-011`, `AD-012` | `MVP Functional` |
| `FR -13 (C)`| `REQ-TRV-024`| Favourite Hosts | `TM-036` | — | — | `UI-Complete / Backend-Deferred` |
| `FR -14 (C)`| `REQ-TRV-025`| Promo Codes | `TM-019` | `PW-004` | `AD-015` | `MVP Functional` |
| `FR -14 (D)`| `REQ-TRV-026`| Multiple Languages | `TM-004`, `TM-044` | `PW-001` | `AD-016` | `UI-Complete / Backend-Deferred` |
| `FR -14 (E)`| `REQ-TRV-027`| Multiple Currencies | `TM-004`, `TM-044` | `PW-001` | `AD-016` | `UI-Complete / Backend-Deferred` |

### 2.2 Host Requirements (`REQ-HST-001` to `REQ-HST-030`)

| Source ID | Req ID | Requirement Title | Host Mobile (`HM`) | Host Dashboard (`HD`) | Superadmin (`AD`) | Delivery Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `FR-15` | `REQ-HST-001` | Host Registration | `HM-001`, `HM-002` | `HD-014` | `AD-002` | `MVP Functional` |
| `FR-16` | `REQ-HST-002` | Identity/Business Verification | `HM-003`, `HM-004`, `HM-005` | `HD-014` | `AD-002` | `MVP Functional` |
| `FR-17` | `REQ-HST-003` | Host Approval | `HM-005` | `HD-014` | `AD-002` | `MVP Functional` |
| `FR-18` | `REQ-HST-004` | Host Profile | `HM-009`, `HM-037` | `HD-003`, `HD-014` | `AD-003` | `MVP Functional` |
| `FR-19` | `REQ-HST-005` | Storage Location Setup | `HM-009` | `HD-002`, `HD-003` | `AD-004` | `MVP Functional` |
| `FR-20` | `REQ-HST-006` | Opening Hours | `HM-010`, `HM-011` | `HD-004` | `AD-004` | `MVP Functional` |
| `FR-21` | `REQ-HST-007` | Storage Capacity | `HM-013` | `HD-005` | `AD-004` | `MVP Functional` |
| `FR-22` | `REQ-HST-008` | Availability Management | `HM-011`, `HM-013` | `HD-004`, `HD-005` | `AD-004` | `MVP Functional` |
| `FR-23` | `REQ-HST-009` | Pricing | `HM-014` | `HD-006` | `AD-004` | `MVP Functional` |
| `FR-24` | `REQ-HST-010` | Booking Dashboard | `HM-006`, `HM-007` | `HD-001`, `HD-007` | `AD-005` | `MVP Functional` |
| `FR-25` | `REQ-HST-011` | Booking Details | `HM-020` | `HD-007`, `HD-008` | `AD-005` | `MVP Functional` |
| `FR-26` | `REQ-HST-012` | Booking Acceptance | `HM-018`, `HM-019` | `HD-007` | `AD-005` | `Configurable MVP` |
| `FR-27` | `REQ-HST-013` | Check-in Traveller | `HM-021` | `HD-009` | `AD-005` | `MVP Functional` |
| `FR-28` | `REQ-HST-014` | Bag Verification | `HM-022` | `HD-009` | `AD-005` | `MVP Functional` |
| `FR-29` | `REQ-HST-015` | Check-in Evidence | `HM-023` | `HD-009` | `AD-005` | `Configurable MVP` |
| `FR-30` | `REQ-HST-016` | Check-out Verification | `HM-024` | `HD-009` | `AD-005` | `MVP Functional` |
| `FR-31` | `REQ-HST-017` | Mark Booking Complete | `HM-025` | `HD-009` | `AD-005`, `AD-010` | `MVP Functional` |
| `FR-32` | `REQ-HST-018` | Late Collection Handling | `HM-026`, `HM-027`, `HM-028`| `HD-007`, `HD-009` | `AD-005`, `AD-013` | `MVP Functional` |
| `FR-33` | `REQ-HST-019` | Booking History | `HM-020` | `HD-007` | `AD-005` | `MVP Functional` |
| `FR-34` | `REQ-HST-020` | Cancellation Handling | `HM-020` | `HD-007` | `AD-005`, `AD-007` | `MVP Functional` |
| `FR-35` | `REQ-HST-021` | Notifications | `HM-006` | `HD-001` | `AD-017` | `MVP Functional` |
| `FR-36` | `REQ-HST-022` | Earnings Dashboard | `HM-029` | `HD-010` | `AD-008`, `AD-010` | `MVP Functional` |
| `FR-37` | `REQ-HST-023` | Payout Management | `HM-030`, `HM-031` | `HD-011` | `AD-008`, `AD-009` | `MVP Functional` |
| `FR-38` | `REQ-HST-024` | Transaction History | `HM-029`, `HM-031` | `HD-010`, `HD-011` | `AD-006`, `AD-010` | `MVP Functional` |
| `FR-39` | `REQ-HST-025` | Reviews & Ratings | `HM-035` | `HD-012` | `AD-014` | `MVP Functional` |
| `FR-40` | `REQ-HST-026` | Support | `HM-036` | `HD-011` | `AD-011`, `AD-012` | `MVP Functional` |
| `FR-41` | `REQ-HST-027` | Incident Reporting | `HM-036` | `HD-011` | `AD-013` | `MVP Functional` |
| `FR-42` | `REQ-HST-028` | Staff Accounts | `HM-033`, `HM-034` | `HD-013` | — | `UI-Complete / Backend-Deferred` |
| `FR-43` | `REQ-HST-029` | Analytics | `HM-029` | `HD-001` | `AD-001` | `UI-Complete / Backend-Deferred` |
| `FR-44` | `REQ-HST-030` | Multiple Locations | `HM-006`, `HM-009` | `HD-001`, `HD-002` | `AD-004` | `MVP Functional` |

---

## 3. Implied Requirements to Screen Traceability

| Req ID | Implied Requirement Title | Responsible Screens Across Surfaces | Implementation & Architectural Function |
| :--- | :--- | :--- | :--- |
| `REQ-IMPL-001` | Host Onboarding KYC Document Storage | `HM-004`, `HD-014`, `AD-002` | Secure Cloudflare R2 object upload with signed URLs. |
| `REQ-IMPL-002` | Multi-Zone Physical Storage Partitioning | `HM-013`, `HD-005`, `AD-004` | PostGIS spatial & zone quota management. |
| `REQ-IMPL-003` | Price Breakdown Snapshot Persistence | `TM-019`, `PW-004`, `HD-008`, `AD-005` | Immutable snapshot of rates, taxes, and commission at booking confirmation. |
| `REQ-IMPL-004` | Capacity Reservation Expiration Worker | `TM-021`, `HM-006`, `AD-001` | Asynchronous 30s sweeper releasing unconfirmed capacity holds. |
| `REQ-IMPL-005` | Booking State Machine Guardrails | All Booking Screens (`TM-019`–`TM-027`, `HM-018`–`HM-025`) | Enforces valid status transitions and SLA timeouts. |
| `REQ-IMPL-006` | Payment Webhook Idempotency & Checksum | `TM-021`, `AD-006` | Reconstructs cryptographic signature (`md5sig`/`sha256sig`) to verify gateway posts. |
| `REQ-IMPL-007` | QR Code & PIN Cryptographic Generation | `TM-024`, `TM-028`, `TM-030`, `HM-021`, `HM-024`| Generates tamper-proof QR payloads and collision-resistant PINs. |
| `REQ-IMPL-008` | Photo Evidence Capture & Cloud Storage | `HM-023`, `HD-008`, `AD-005` | Host camera upload to R2 bucket for custody condition records. |
| `REQ-IMPL-009` | Overdue Grace Period & Surcharge Engine | `TM-029`, `HM-026`, `HM-027`, `AD-013` | 30m grace period calculation and automated 1.5x daily surcharge generation. |
| `REQ-IMPL-010` | Decoupled Custody Release Invariant | `HM-028`, `HD-009`, `AD-013` | **Enforces zero possessory lien: luggage released even if fees are disputed.** |
| `REQ-IMPL-011` | Immutable Financial Ledger Journal | `HD-010`, `AD-008`, `AD-010` | Append-only double-entry general ledger for all credits, debits, and commissions. |
| `REQ-IMPL-012` | Manual Payout Authorization & Reference Log | `HM-031`, `HD-011`, `AD-008`, `AD-009` | Superadmin manual bank transfer disbursement logging. |
| `REQ-IMPL-013` | Multi-Stage Refund Execution & Review | `TM-033`, `AD-007` | Explicit 7-stage refund lifecycle with manual fallback review. |
| `REQ-IMPL-014` | Customer Support Ticket Triage Routing | `TM-040`, `HM-036`, `AD-011`, `AD-012` | Automated ticket categorization and SLA assignment (`OQ-016`). |
| `REQ-IMPL-015` | Immutable Security & Administrative Audit Trail| `AD-017` | Append-only audit log of privileged operations and authentication events. |
