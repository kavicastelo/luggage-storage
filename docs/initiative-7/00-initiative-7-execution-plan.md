# Initiative 7 — Execution Plan (`feature/initiative-7-cross-platform-closure`)

**Target Branch:** `main` (`8613dac335acf0820a229ae183ac5488c3453fbd`)  
**Implementation Branch:** `feature/initiative-7-cross-platform-closure`  
**Execution Model:** Coordinated multi-agent Phase 0 validation + phased cross-platform implementation and independent verification

---

## 1. Workstream Allocation

| Workstream | Scope & Ownership | Key Target Surfaces | Status |
|---|---|---|---|
| **WS-7.1 Data Integrity** | Eliminate fabricated `"08:00 - 20:00"` operating-hours fallback, align availability with unconfigured schedules, validate support ticket assignee status/roles, remove fabricated host `"LKR 250k Protection"` badge | `packages/contracts/src/locations/index.ts`, `discovery.service.ts`, `quotation-availability.service.ts`, `support.service.ts`, Web Traveller/Host pages, Mobile Traveller screens | Completed |
| **WS-7.2 Identity & Profile** | Implement `GET/PATCH /api/v1/identity/profile`, mass-assignment `.strict()` contracts, audit event `IDENTITY_PROFILE_UPDATED`, Web `ProfilePage` editor, Mobile `(account)/profile` editor, remove `sessionId` & raw `permissions` leaks | `packages/contracts/src/identity/index.ts`, `audit/index.ts`, `apps/api/src/modules/identity/`, `apps/web/src/pages/ProfilePage.tsx`, `apps/mobile/app/(account)/profile.tsx` | Completed |
| **WS-7.3 Mobile Parity** | Integrate Host Staff CRUD, Customer Support Tickets, Host Payout Batches, Schedule Exception deletion, and update `docs/mobile/phase-c/02-api-coverage-matrix.md` | `apps/mobile/src/services/*`, `apps/mobile/src/hooks/*`, `apps/mobile/app/(host)/settings.tsx`, `earnings.tsx`, `location-editor.tsx`, `(traveller)/(tabs)/support.tsx` | Completed |
| **WS-7.4 Browser E2E** | Install Playwright Chromium, configure `apps/web/playwright.config.ts` & `turbo.json` `test:e2e`, implement 6 critical browser E2E journeys with deterministic fixtures | `apps/web/playwright.config.ts`, `apps/web/e2e/*.spec.ts`, `apps/api/scripts/e2e-db-helper.ts` | Completed |
| **WS-7.5 CI/CD Governance** | Add `'feature/**'` trigger, `browser-e2e` job, `security-audit` (`pnpm audit`), and `.github/dependabot.yml`; document branch protection & `dev`/`main` reconciliation | `.github/workflows/ci.yml`, `.github/dependabot.yml` | Completed |
| **WS-7.6 Production Readiness** | Update `apps/web/.env.example` & `vite-env.d.ts`, assess R2, PayHere, MapTiler, Zoho SMTP, Sri Lankan legal/tax readiness, and produce staging smoke checklist | `apps/web/.env.example`, `apps/web/src/vite-env.d.ts`, `docs/initiative-7/07-*`, `09-*` | Completed |

---

## 2. Execution Sequence

1. **Phase 0:** Live repository validation on `main` (`8613dac`), branch creation (`feature/initiative-7-cross-platform-closure`), and 4 parallel research workstreams.
2. **Phase 1:** Shared contracts (`@luggage-storage/contracts`), WS-7.1 backend fixes, and WS-7.2 `identity` module (`319f257`).
3. **Phase 2:** Web profile editing & data-integrity UI (`7f1b2f1`), followed by Mobile API parity integration (`65ce943`).
4. **Phase 3:** Playwright browser E2E suite across 6 critical journeys (`0bc6b66`, `ef010be`).
5. **Phase 4:** CI/CD & Dependabot governance (`29d9b3b`), full monorepo verification, Initiative 7 documentation suite, and Pull Request targeting `main`.

