# Initiative 7 — Current State & Gap Validation

**Reference Baseline:** `main` at `8613dac335acf0820a229ae183ac5488c3453fbd`  
**`dev` Branch State:** `ce0afbd1a3a660fa8cb916608e133663fef3f0cf` (`39` commits behind `main`)

---

## 1. Revalidation Matrix

| Finding / Gap | Validation Result | Evidence & Root Cause on `8613dac` | Disposition |
|---|---|---|---|
| **Operating-hours `"08:00 - 20:00"` fallback** | **Confirmed** | `PublicStorageLocationSchema` (`packages/contracts/src/locations/index.ts:170`) defaulted `operatingHoursSummary` to `"08:00 - 20:00"`. `discovery.service.ts` (`L245`, `L409`) emitted `"08:00 - 20:00"` when `hours.length === 0`, while `quotation-availability.service.ts` (`L268-271`) treated `weeklyHours.length === 0` as 24/7. | **Fixed** (`319f257`, `7f1b2f1`, `65ce943`) |
| **Support ticket assignee role/status check** | **Confirmed** | `support.service.ts` (`L524-533`) only checked `users.id` existence; suspended, traveller, or host accounts could be assigned. | **Fixed** (`319f257`) |
| **Host card `"LKR 250k Protection"` & `"08:00 - 20:00 IST"`** | **Confirmed** | `apps/web/src/features/host/host-helpers.tsx` (`L27-32`) synthesized `hasInsurance: true`, `insuranceLimitLkr: 250000`, `openHours: "08:00 - 20:00 IST"`; `HostLocationsPage.tsx` (`L392-398`) rendered `"LKR 250k Protection"`. | **Fixed** (`7f1b2f1`) |
| **`GET/PATCH /api/v1/identity/profile` missing** | **Confirmed** | Contracts existed in `packages/contracts/src/identity/index.ts`, but `apps/api/src/modules/identity/` did not exist and `app.ts` registered no `/identity` routes. | **Fixed** (`319f257`) |
| **Web `ProfilePage` read-only & exposes internals** | **Confirmed** | `apps/web/src/pages/ProfilePage.tsx` had no edit form and rendered `user.id`, `sessionId`, and raw `permissions` matrix. | **Fixed** (`7f1b2f1`) |
| **Mobile `profile.tsx` read-only & exposes internals** | **Confirmed** | `apps/mobile/app/(account)/profile.tsx` (`L92-130`) stated editing was unsupported and rendered `user.id`, `sessionId`, and raw `permissions`. | **Fixed** (`65ce943`) |
| **Mobile Host Staff stale copy & missing API integration** | **Confirmed** | `apps/mobile/app/(host)/settings.tsx` (`L165-172`) claimed staff invitations were not in API despite Initiative 3 `hosts/businesses/:id/staff` endpoints. | **Fixed** (`65ce943`) |
| **Mobile Support Tickets missing** | **Confirmed** | `apps/mobile/app/(traveller)/(tabs)/support.tsx` only supported FAQs and booking exceptions, not `/support/tickets`. | **Fixed** (`65ce943`) |
| **Mobile Host Payout Batches & Exception Delete missing** | **Confirmed** | `earnings.tsx` lacked `/hosts/finance/payout-batches`; `location-editor.tsx` (`L757-758`) claimed exceptions were read-only despite `DELETE /hosts/locations/:id/exceptions/:exceptionId`. | **Fixed** (`65ce943`) |
| **Mobile `CUSTODY_EVIDENCE` photo upload (`intake.tsx`)** | **Confirmed** | `apps/mobile/app/(host)/intake.tsx` stores `localPhotoUri` on-device without uploading via `CUSTODY_EVIDENCE` presigned URLs. | **Deferred** (documented in Mobile Parity Gap Register) |
| **Mobile rich public location hours/tiers display (`location.tsx`)** | **Confirmed** | `apps/mobile/app/(traveller)/location.tsx` displays summary hours (`is24Hours`/`operatingHoursSummary`) cleanly without full 7-day table; pricing tiers show on checkout. | **Accepted Limitation / Deferred** |
| **No real browser E2E automation** | **Confirmed** | `apps/web` used Vitest (`environment: "node"`) with `renderToString`; no `@playwright/test` installed. | **Fixed** (`0bc6b66`, `ef010be`) |
| **CI missing `feature/**`, E2E, & vulnerability scan** | **Confirmed** | `.github/workflows/ci.yml` lacked `'feature/**'` trigger, Playwright E2E job, and `pnpm audit` / Dependabot. | **Fixed** (`29d9b3b`) |
| **Branch protection disabled / `gh` CLI absent locally** | **Confirmed (External)** | `gh` CLI not installed in local shell; GitHub repository branch protection settings live in GitHub Admin UI. | **Blocked by External Permission** (actionable checklist in `06-*`) |

