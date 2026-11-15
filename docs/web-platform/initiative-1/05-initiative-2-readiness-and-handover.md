# Initiative 1 — Readiness & Handover to Initiative 2+

> **Branch:** `feature/initiative-1-foundation-hardening`  
> **Branched From:** `dev` (`ce0afbd1a3a660fa8cb916608e133663fef3f0cf`)  
> **Merge Guardrail:** Branch has **not** been merged into `dev`, leaving `dev` clean for review/PR gating.  
> **Mobile Boundary Guardrail:** `git diff dev -- apps/mobile` is **empty**; `apps/mobile` remains completely untouched and all 18 mobile test files (121 tests) pass.

---

## 1. Commit Ledger on `feature/initiative-1-foundation-hardening`

1. `7eca2e3` — `fix(auth): harden session and API request handling` *(Workstream A)*
2. `9d4269e` — `fix(security): enforce RBAC and resource ownership` *(Workstream B / Web Route Gating)*
3. `7d08418` — `fix(data): prevent financial and demo data leakage` *(Workstreams C, D, F)*
4. `36a920c` — `fix(custody): correct normal collection state transitions` *(Workstream E)*
5. `5acccd9` — `test(platform): add foundation security regression coverage` *(Workstream G — Test Suite & `counter-custody.ts`)*
6. *(Follow-up commit)* `docs(platform): document initiative 1 remediation` *(Initiative 1 documentation suite under `docs/web-platform/initiative-1/`)*

---

## 2. Explicit Scope Boundaries & Deferred Items for Initiatives 2–6

Initiative 1 focused strictly on foundational transport, session revocation, API/UI RBAC boundaries, commission/financial privacy, booking-status truth, normal counter collection state transitions, demo-fixture quarantine, and regression coverage. The following roadmap items remain intentionally deferred to their designated feature initiatives:

| Deferred Item | Target Initiative | Notes |
| --- | --- | --- |
| Public Traveller discovery enrichment (`openingHours[]`, `upcomingExceptions[]`, bag tiers in `GET /locations/:id`), MapTiler map integration, real `qrcode` SVG rendering of `issuedPass.qrToken` (`DI-04`), Booking Receipt view (`OQ-010`), and decomposing `PublicMarketplacePages.tsx` | **Initiative 2** | Unblocked once `feature/initiative-1-foundation-hardening` merges. |
| Production Cloudflare R2 bucket CORS `PUT` verification (`SEC-10`), `r2-uploader.ts` helper + media/zone/exception `DELETE` endpoints, Host onboarding verification status vocabulary alignment (`PENDING_REVIEW` vs `PENDING_VERIFICATION`), and `HostDashboardPages.tsx` modularization | **Initiative 3** | Blocked externally only on live R2 environment CORS configuration (`SEC-10`). |
| Human-readable `LS-*` booking reference resolution at Host Counter Check-In/Out desk (`executeCounterCustodyHandover` currently requires booking UUID in live mode and rejects `LS-*` cleanly with a validation error instead of simulating a 700ms fake success) and Host Finance CSV/ledger workflows | **Initiative 4** | Cleanly separated from `DI-01` collection-state corruption fix. |
| Full Admin governance wrappers (`admin.routes.ts` user/role actions for `AD-018`) in `auth-api.ts`, expanded audit event filters, refund filter extensions (`MANUAL_REVIEW_REQUIRED`, `FAILED`), and `AdminDashboardPages.tsx` modularization | **Initiative 5** | Backend RBAC + `SUPPORT` read-only API/UI gates already established in Initiative 1. |
| Editable `/profile` (`GET/PATCH /api/v1/identity/profile`), payout batch generation, dispute adjudication, persisted `/support/tickets`, and optional browser DOM (`jsdom` / Playwright) E2E harness expansion | **Initiatives 6 / Cross-Cutting** | Keep `apps/web/vitest.config.ts` dependency choice aligned with team CI preference. |

---

## 3. Handover Checklist for Next Implementation Wave

- [x] `api-client.ts` omits `Content-Type` on bodyless requests and clears multipart headers on `FormData`.
- [x] Server empty-JSON-body parser & `clearRefreshCookies` ensure logout revokes sessions cleanly without PayHere webhook side effects.
- [x] `app.ts` `authenticate` hydrates live database roles so newly acquired `HOST_OWNER` claims work immediately.
- [x] All Host location/capacity/pricing/upload endpoints enforce `requirePermission` / `requireAnyPermission` and reject `SUPPORT` write mutations (`403`).
- [x] Commission take-rate and host-payable fields are stripped from public quotes and omitted from `getBookingDetail` for `TRAVELLER` and `HOST_STAFF`; `Host Net` is hidden from `HOST_STAFF` in Web UI.
- [x] `PENDING_PAYMENT` and other lifecycle statuses map truthfully via `getBookingStatusDisplay`; live surfaces isolate `DEMO_*` behind unauthenticated non-prod `?preview=demo` opt-in.
- [x] Counter `CHECK_OUT` omits `exceptionNotes` during normal releases and preserves `COMPLETED` / `RELEASED_TO_TRAVELLER` / `ELIGIBLE`.
- [x] All 17 API test files (346 tests), 12 Web test files (138 tests), 18 Mobile test files (121 tests), `pnpm lint`, `pnpm typecheck`, and `pnpm build` pass with `0` failures.
