# Initiative 4 — Host Counter Check-In/Out Integrity, Bookings Desk & Owner Finance: Traceability & Remediation Summary

**Branch:** `feature/initiative-4-host-operations-finance`  
**Base Commit:** `37fd981` (`docs(initiative-3): add traceability summary and verification handover report`)  
**Implementation Commits:** `0f50c3e`, `12687c4`, `71f5b9f`, `cad3ce3`

---

## 1. Executive Summary

Initiative 4 connected all remaining Host Portal operational and owner-only financial screens (`HD-001` overview, `HD-007`/`HD-008` bookings hub and custody inspection dossier, `HD-009` check-in/out desk, `HD-010` revenue and commission ledger, `HD-011` payout accounts and settlement history, and `HD-012` review management) to live PostgreSQL-backed Fastify APIs while preserving strict `HOST_STAFF` vs `HOST_OWNER` financial isolation (`OQ-017`) and physical handover integrity (`OQ-015` Zero Possessory Lien). Across `packages/contracts`, `apps/api`, and `apps/web`, custody bag-photo uploads (`CUSTODY_EVIDENCE`), duplicate tag guards, clean vs disputed release transitions, double-entry ledger reconciliation, and CWE-1236 formula-safe CSV exports were implemented and verified end-to-end.

---

## 2. Tracking ID Traceability Matrix

| Tracking ID | Scope & Confirmed Behavior | Primary Contracts & Backend Implementation | Primary Web Implementation | Verification Coverage |
|---|---|---|---|---|
| **GAP-022 / HD-001** | Live Host Overview KPIs (bags in vault, zero-capacity `0%` guard avoiding `NaN%`, upcoming arrivals, active & released count, overdue Zero Possessory Lien alert banner, movement queue), with `"Net Cleared Earnings"` suppressed for `HOST_STAFF`. | `GET /api/v1/hosts/bookings`, `GET /api/v1/hosts/finance/summary` (`ledger.service.ts`, `bookings.routes.ts`) | `apps/web/src/features/host/HostOverviewPage.tsx`, `apps/web/src/features/host/HostDashboardLayout.tsx` | API Tests #1, #4; Web Test #3 |
| **GAP-023 / HD-007 / HD-008** | Live Bookings Hub and Custody Evidence inspection routed via both `/host/bookings/:id` and `/host/bookings?inspect=:id`; status filtering across all booking statuses (no false `"Confirmed"` label on `PENDING_PAYMENT`), structured modals for `accept`, `reject`, host `cancel` (100% refund), and `exceptions`, plus signed custody evidence photo links. | `bookings.routes.ts` (`/hosts/bookings`, `/accept`, `/reject`, `/cancel`, `/bookings/:id/exceptions`), `custody.service.ts` (`getCustodyDetail`) | `apps/web/src/features/host/HostBookingsPage.tsx`, `apps/web/src/app/App.tsx`, `apps/web/src/hooks/queries/use-host-portal.ts` | API Tests #1, #2, #3; Web Test #3 |
| **GAP-024 / HD-009 / AC-15** | Live Counter Check-In & Collection workstation: human booking reference (`LSB-...`) or UUID lookup, non-consuming `POST /api/v1/hosts/custody/verify`, live storage zone dropdown (no hardcoded `RACK-A`), unique bag-tag enforcement (`400` on duplicates preserving unconsumed pass & upload intent), bag count discrepancy validation, and `CUSTODY_EVIDENCE` per-bag R2 photo upload. | `0017_initiative_4_custody_evidence_uploads.sql`, `uploads.routes.ts`, `uploads.service.ts`, `custody.service.ts`, `packages/contracts/src/uploads/index.ts`, `packages/contracts/src/custody/index.ts` | `apps/web/src/features/host/HostOperationsDeskPage.tsx`, `apps/web/src/lib/counter-custody.ts`, `apps/web/src/lib/r2-uploader.ts` | API Tests #2, #3; Web Test #2 |
| **GAP-025 / HD-010** | Live Host Financial Revenue & Commission Ledger displaying gross subtotal, platform commission, and net host payable across `ELIGIBLE`, `ACCRUED`, `ON_HOLD`, and `PAID` buckets with clean `LKR 0` empty state and RFC-4180 formula-safe CSV export (`CWE-1236`). | `GET /api/v1/hosts/finance/summary?businessId=...` (`ledger.service.ts`, `bookings.routes.ts`) | `apps/web/src/features/host/HostFinancePage.tsx`, `apps/web/src/lib/csv-export.ts` | API Tests #3, #4; Web Tests #1, #4 |
| **GAP-026 / HD-011** | Live Payout Accounts & Settlement History: encrypted payout beneficiary retrieval & corporate bank account update (`PATCH /api/v1/hosts/businesses/:id` without downgrading `ACTIVE` business status) alongside live settlement payable rows and CSV export (no fabricated `BATCH-2026-W44` rows or dead PDF buttons). | `hosts.routes.ts` (`PATCH /businesses/:id`, `GET /businesses/:id/payout-details`), `ledger.service.ts` | `apps/web/src/features/host/HostPayoutsPage.tsx`, `apps/web/src/services/marketplace-api.ts` | API Test #4; Web Test #4 |
| **HD-012** | Live Host Review Management page gated cleanly behind a post-MVP status notice when authenticated so zero mock reviewer names or ratings leak into production accounts. | — *(Post-MVP feature gate)* | `apps/web/src/features/host/HostReviewsPage.tsx` | Web Test #4 |
| **OQ-015** | Zero Possessory Lien on overdue collections: overdue pickups (`collection_at` past +30m grace period) show mandatory release guidance in `HostOperationsDeskPage` and always complete collection (`RELEASED_TO_TRAVELLER` / `COMPLETED`) upon valid QR/PIN verification, while normalizing whitespace-only `exceptionNotes` to clean release. | `custody.service.ts` (`completeCollection`), `packages/contracts/src/custody/index.ts` | `apps/web/src/features/host/HostOperationsDeskPage.tsx`, `apps/web/src/features/host/HostOverviewPage.tsx`, `apps/web/src/lib/counter-custody.ts` | API Test #3; Web Test #2 |
| **OQ-017** | Strict `HOST_STAFF` financial privacy: `/hosts/finance/summary` and `/businesses/:id/payout-details` return `403` for `HOST_STAFF`; `getBookingDetail` omits `commissionRateBps`, `platformCommissionMinor`, and `hostPayableMinor`; Web UI hides `"Net Cleared Earnings"`, `"Host Net"`, and `"Payable"` from `HOST_STAFF`, while permitting `HOST_STAFF` `CUSTODY_EVIDENCE` uploads only for assigned locations. | `bookings.service.ts`, `ledger.service.ts`, `uploads.service.ts`, `0017_initiative_4_custody_evidence_uploads.sql` | `HostDashboardLayout.tsx`, `HostOverviewPage.tsx`, `HostBookingsPage.tsx` | API Tests #1, #2, #4; Web Test #3 |
| **DI-01 / DI-03 / AC-16 / VRF-10** | Single balanced 85% / 15% non-escrow ledger journal posting upon collection (`ELIGIBLE` on clean release, `ON_HOLD` when exception or `DISPUTED`), double-entry balance check via `/api/v1/admin/finance/ledger`, signed download URLs (`?token=mock-read-token` vs `403` unsigned on `custody/`), and one-time upload intent consumption. | `ledger.service.ts`, `custody.service.ts`, `uploads.service.ts`, `uploads.routes.ts` | `apps/web/src/features/host/HostBookingsPage.tsx` (`View Evidence Photo`), `HostOperationsDeskPage.tsx` | API Tests #2, #3; Web Test #3 |
| **WF-HST-05 / WF-HST-10 – WF-HST-15** | Full counter handover workflow, host booking lifecycle management (`accept`, `reject`, `cancel`, `exceptions`), finance ledger & CSV download, and payout beneficiary update. | `bookings`, `custody`, `uploads`, `hosts`, `finance` API modules | `apps/web/src/features/host/*`, `HostDashboardPages.tsx` barrel | API Tests #1–#4; Web Tests #1–#4 |

---

## 3. Key Architecture & Implementation Highlights

### 3.1 Custody Evidence Uploads & Signed Read URLs (`0017_initiative_4_custody_evidence_uploads.sql`)
- Added PostgreSQL migration `0017_initiative_4_custody_evidence_uploads.sql` and `apps/api/src/infrastructure/database/schema/uploads.ts` updates supporting `BOOKING` upload resources for `CUSTODY_EVIDENCE`, permitting assigned `HOST_STAFF` and `HOST_OWNER` accounts to upload bag evidence while denying `HOST_VERIFICATION` and `LOCATION_IMAGE` uploads (`403`) for `HOST_STAFF` and denying unassigned location access (`403`).
- `uploads.routes.ts` enforces token protection (`?token=mock-read-token`, returning `403` on unsigned `GET /mock-storage/custody/...`), while `custody.service.ts` validates unique bag tags (case-insensitive), consumes confirmed `CUSTODY_EVIDENCE` upload intents once inside transactions, and populates `photoDownloadUrl` in `getCustodyDetail`.

### 3.2 Modular Web Host Pages, Context Sync & Export Safety
- Extracted `HostOverviewPage.tsx`, `HostBookingsPage.tsx`, `HostOperationsDeskPage.tsx`, `HostFinancePage.tsx`, `HostPayoutsPage.tsx`, and `HostReviewsPage.tsx` under `apps/web/src/features/host/`, re-exported cleanly from `apps/web/src/features/host/index.ts` and `apps/web/src/pages/HostDashboardPages.tsx`, with `/host/bookings/:id` added to `apps/web/src/app/App.tsx`.
- `HostDashboardLayout.tsx` exposes `selectedBusinessId` and derives `effectiveHostRole` and `canActAsHostOwner` even in contextless standalone SSR renders.
- `apps/web/src/lib/csv-export.ts` neutralizes CWE-1236 spreadsheet formula prefixes (`=`, `+`, `@`, `\t`, `\r`, and non-numeric `-` strings) while keeping signed decimals such as `"-225.50"` unmangled, enforces RFC-4180 quoting with `\r\n` newlines, and safely no-ops (`false`) under Node SSR.

---

## 4. Intentional Scope Boundaries

- **`apps/mobile`**: Completely untouched (`git diff --name-only main -- apps/mobile` returned empty).
- **`AdminDashboardPages.tsx`, `vitest.config.ts`, `mock-marketplace.ts`**: Untouched; `WEB_HOST_SCREENS` (`14`), total screen catalog (`43`), and `ownerOnlyHostIds` remain intact for all Phase 2 tests.
- **Deferred Beyond Initiative 4**: Platform weekly `payout_batches` execution, downloadable remittance PDFs, and Admin/Superadmin operations screens (`AD-001`–`AD-012`) remain scoped for Superadmin / Platform Finance Batch Settlement initiatives.
