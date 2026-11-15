# Initiative 2 — Verification & Handover Report

> **Branch:** `feature/initiative-2-traveller-marketplace`  
> **Branched From:** `main`  
> **Merge Guardrail:** Branch has **not** been merged into `main` or `dev`, and has **not** been pushed to remote.  
> **Mobile Boundary Guardrail:** `git diff --name-only main -- apps/mobile` returned empty (`apps/mobile` untouched).

---

## 1. Commit Ledger on `feature/initiative-2-traveller-marketplace`

1. `ec23ba5` — `feat(discovery): enrich public location details and search sorting`
2. `0fe36d6` — `feat(web-custody): add scannable qrcode custody pass and traveller query hooks`
3. `c2fb7e4` — `feat(web-traveller): modularize discovery, checkout, qr pass, and bookings portal`
4. `6bcb351` — `test(traveller): add initiative 2 discovery, qr pass, and portal regression tests`
5. *(Following commit)* — `docs(platform): document initiative 2 traveller completion`

---

## 2. Full Monorepo Verification Evidence

All commands below were executed on `feature/initiative-2-traveller-marketplace` after all code and test edits were committed at `6bcb351`:

| Verification Check | Command | Outcome | Observed Metrics / Details |
| :--- | :--- | :--- | :--- |
| Contracts Build | `pnpm --filter @luggage-storage/contracts build` | **PASSED** (`exit 0`) | `tsc` compiled `@luggage-storage/contracts` cleanly. |
| API Full Test Suite | `pnpm --filter @luggage-storage/api test` | **PASSED** (`exit 0`) | `18` test files passed (`350` tests passed, `0` skipped, `0` failed; duration `119.21s`), including 4 live PostgreSQL + PostGIS + Fastify tests in [initiative-2-traveller-discovery.test.ts](file:///d:/luggage-storage/luggage-storage/apps/api/tests/initiative-2-traveller-discovery.test.ts). |
| Web Full Test Suite | `pnpm --filter @luggage-storage/web test` | **PASSED** (`exit 0`) | `13` test files passed (`144` tests passed, `0` skipped, `0` failed; duration `3.26s`), including 6 SSR & utility regression tests in [initiative-2-traveller-marketplace.test.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/tests/initiative-2-traveller-marketplace.test.tsx). |
| Mobile Full Test Suite | `pnpm --filter @luggage-storage/mobile test` | **PASSED** (`exit 0`) | `18` test files passed (`121` tests passed, `0` skipped, `0` failed; duration `3.59s`). |
| Monorepo Lint | `pnpm lint` | **PASSED** (`exit 0`) | `5` tasks successful (`5` total); `0` errors across all packages (`0` warnings in newly added `apps/web/src/features/traveller/`, `CustodyQrPassCard.tsx`, hooks, and Initiative 2 tests; pre-existing warnings remain only in `AdminDashboardPages.tsx`, `HostDashboardPages.tsx`, and existing API files). |
| Monorepo Typecheck | `pnpm typecheck` | **PASSED** (`exit 0`) | `5` tasks successful (`5` total; `tsc --noEmit` across `@luggage-storage/contracts`, `@luggage-storage/api`, `@luggage-storage/web`, and `@luggage-storage/mobile`). |
| Monorepo Build | `pnpm build` | **PASSED** (`exit 0`) | `4` tasks successful (`4` total; built `@luggage-storage/contracts`, `@luggage-storage/api`, `@luggage-storage/web` Vite bundle `dist/assets/index-C47DjD75.js` at `842.51 kB`, and `@luggage-storage/mobile` Expo export). |

---

## 3. Technical Handover Notes for Initiative 3 (Host Web Dashboard & Counter Operations)

- **QR Token & PIN Compatibility (`DI-04` -> `HD-009`):** [CustodyQrPassCard.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/components/custody/CustodyQrPassCard.tsx) encodes the exact raw 64-character `issuedPass.qrToken` string directly into the QR SVG matrix via `QRCode.create(qrToken, { errorCorrectionLevel: "M" })` alongside the 6-digit `verificationPin` backup. Host counter verification (`POST /api/v1/hosts/custody/verify`) accepts that exact `qrToken` payload directly without custom wrapper parsing, and regenerating a pass revokes the previous token immediately in `custody_tokens` (verified in [initiative-2-traveller-discovery.test.ts](file:///d:/luggage-storage/luggage-storage/apps/api/tests/initiative-2-traveller-discovery.test.ts)).
- **Shared Hooks & Query Keys Ready for Reuse:** Host modules in `Initiative 3` should follow the SSR-safe `useResolvedQueryClient()` pattern in [use-discovery.ts](file:///d:/luggage-storage/luggage-storage/apps/web/src/hooks/queries/use-discovery.ts) and extend [query-keys.ts](file:///d:/luggage-storage/luggage-storage/apps/web/src/hooks/queries/query-keys.ts) so Vitest Node SSR tests (`apps/web/vitest.config.ts`) continue to render components without requiring `jsdom`.
- **Route Preservation:** [PublicMarketplacePages.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/pages/PublicMarketplacePages.tsx) remains a thin barrel file re-exporting [apps/web/src/features/traveller/](file:///d:/luggage-storage/luggage-storage/apps/web/src/features/traveller/traveller-utils.ts). Future `HostDashboardPages.tsx` decomposition in Initiative 3 can adopt the same `features/host/*` + thin barrel approach cleanly.
- **External Environment Gates Remaining Unchanged:** `VITE_MAPTILER_KEY` (`OQ-018`) for high-res MapTiler backdrop tiles on `/search`, Cloudflare R2 CORS (`SEC-10`, queued for Initiative 3 KYC/location media upload work), and `OQ-010` formal tax/VAT invoicing approval.
