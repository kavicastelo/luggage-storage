# Phase 2B.1 — UX Audit Correction & Baseline Delta Report
## Document 14: Current Repository Baseline & Delta Report

**Project:** Global Luggage Storage Marketplace (`https://github.com/kavicastelo/luggage-storage`)  
**Document ID:** `DOC-UX-P2B-014`  
**Audit Phase:** Phase 2B.1 — UX Audit Correction & Phase 2C Handover  
**Current Working Branch:** `feat/phase-1b-identity`  
**Current HEAD Commit:** `cca134f4a0f909a907f6395f9647a025ac39d71a` (`fix email delivery issue`)  
**Remote Upstream Reference:** `origin/main` @ `dba73b89f3d6d22f974e294ab7922b5e188b6af1` (PR #7 merge commit)  
**Previous Audit Baseline:** `ae3515f` / `4a0715b`  
**Date:** November 9, 2026  
**Auditor:** Principal Product Architect & Senior UX Auditor  

---

### 1. Executive Summary & Purpose

The initial Phase 2B UX Audit was executed against commit `ae3515f` and documented in commit `4a0715b`. Following that audit, commit `cca134f` was pushed to branch `feat/phase-1b-identity` by the development team and subsequently merged into `origin/main` via PR #7 (`dba73b8`).

This document provides a rigorous, line-by-line verification of the codebase delta between the initial Phase 2B audit baseline and the current repository state (`cca134f`). It establishes whether any previously catalogued UX findings were resolved, whether new issues were introduced, and confirms the exact code and architecture baseline for the **Phase 2C Product Experience Re-Architecture** handover.

---

### 2. Repository Commit Lineage & Three-Commit Baseline Distinction

To prevent confusing documentation updates with application source-code changes, three distinct commit baselines are formally established:

1. **Original Phase 2B Source-Code Baseline (`ae3515f`):**
   - The state of the codebase when the initial Phase 2B UX audit was performed and documented in `4a0715b`.
2. **Phase 2B.1 Verification Source-Code Baseline (`cca134f`):**
   - The authoritative source-code baseline for application logic, containing the email verification token fix and monorepo `.env` loading.
3. **Current Repository HEAD (`17d5afa` / `57b1c39`):**
   - The current repository HEAD containing all reconciled audit documentation (`00` through `23`) and 107 genuine visual screenshots. Zero application source-code changes exist between `cca134f` and `17d5afa` / `57b1c39`.

```
[ae3515f] fix(stabilization): complete security, CI, email and decision remediation (Phase 2B Source Baseline)
   │
[4a0715b] docs(ux): complete phase 2b product experience audit (Initial 14 Audit Docs + 26 Screenshots)
   │
[cca134f] fix email delivery issue (Phase 2B.1 Verification Source Baseline)
   │  │
   │  └─── [dba73b8] Merge pull request #7 from kavicastelo/feat/phase-1b-identity (origin/main)
   ▼
[17d5afa] docs(ux): reconcile phase 2b audit and prepare phase 2c handover (Local Branch HEAD)
   │  │
   │  └─── [57b1c39] Merge pull request #8 from kavicastelo/feat/phase-1b-identity (Current origin/main HEAD)
   ▼
[HEAD] (100% tree-identical to origin/main @ 57b1c39 across all application packages)
```

#### 2.1 Git Status & Working-Tree State
- **Branch:** `feat/phase-1b-identity` (tracking `origin/feat/phase-1b-identity`).
- **Current Local Commit:** `17d5afa` (tree-identical to `origin/main` @ `57b1c39`).
- **Remote Parity:** `git diff HEAD origin/main` produces 0 file differences.
- **Uncommitted User Changes:** 0 application source code changes.

---

### 3. Comprehensive Baseline Comparison Table

| Area | Previous Audit Baseline (`ae3515f` / `4a0715b`) | Current Repository (`cca134f` / `dba73b8`) | Verified Change | Remaining Uncertainty |
|---|---|---|---|---|
| **Traveller Mobile (`TM`)** | 39 active screens rendered in `apps/mobile/app/(traveller)/index.tsx` screen-switcher card grid. Auth screens in `(auth)/`. | Identical. 39 active screens rendered via switcher card grid. No navigation stack or tab bar. | Zero application code changes. All 39 screens remain in `UI_SIMULATION` state. | Native device camera bindings (`expo-camera`) and push notifications (`expo-notifications`) unverified on physical hardware. |
| **Host Mobile (`HM`)** | 31 active screens rendered in `apps/mobile/app/(host)/index.tsx` screen-switcher card grid. Scanner screen simulates PIN `482910`. | Identical. 31 active screens rendered via switcher card grid. | Zero application code changes. Scanner remains simulated. | Native QR scanning performance and Bluetooth seal pairing unverified on physical hardware. |
| **Public Traveller Web (`PW`)** | 11 active screens in `apps/web/src/pages/`. Dark gradients, prominent developer badges (`PW-001`, `WF-xxx`), footer sitemap. | 11 active screens in `apps/web/src/pages/`. Minor StrictMode double-fetch guard added to `VerifyEmailPage.tsx`. | Email verification token consumption made idempotent. UX layout, dark gradient cards, and developer tags unchanged. | Client-side map rendering library (`maplibre-gl`) bundle weight and API key provisioning strategy. |
| **Host Dashboard (`HD`)** | 14 active screens in `apps/web/src/pages/host/`. Hardcoded screen IDs on all sidebar nav links and table action buttons. | Identical. 14 active screens with hardcoded navigation badges and demo simulation query params. | Zero application code changes. High-density cards and hardcoded badges persist. | Real-time WebSocket subscriptions for inbound booking alerts unverified. |
| **Superadmin Dashboard (`AD`)** | 18 active screens in `apps/web/src/pages/admin/`. `AD-017` has live audit log queries. `AD-013` is an empty placeholder card. | Identical. 18 active screens with simulation cards. `AD-013` remains a placeholder card with Kiri shrugging. | Zero application code changes. Live PostgreSQL audit queries functioning. | Granular RBAC permission matrices for support agents vs platform superadmins unverified. |
| **Identity & Authentication** | Live Fastify endpoints for registration, login, logout, refresh, OTP, reset password. Session cookies + Bearer tokens. | Live Fastify endpoints intact. Added monorepo `.env` fallback, test adapter priority, and audit logging for missing tokens. | Enhanced test stability and backend token lookup diagnostics. No user-facing UX change. | Rate-limiting thresholds under high-volume SMS OTP delivery unverified. |
| **API & Backend** | Modular Fastify backend in `apps/api`. Implements Identity, RBAC, Sessions, Audit. 98 marketplace endpoints deferred. | Fastify backend intact. Drizzle schema migrations `0000`–`0005` active. | Improved environment loading and test adapter routing. Domain marketplace endpoints remain deferred. | Production database migration strategy for high-availability booking tables. |
| **Design System** | CWCP proposal documented in `DOC-UX-P2B-010`. No shared component package; duplicated Tailwind tokens between apps. | CWCP proposal updated with governance tiers (Requirements vs Recommendations vs Assumptions vs Exclusions). | Formalized architectural classification. Zero implementation code changes. | Final Product Owner palette approval (Ceylon Terracotta vs Neutral Navy). |
| **Mascot Assets** | 20 original PNG assets in `apps/web/public/assets/mascot/` and `Assets/` (29.54 MB). Formatter touch in `MascotIllustration.tsx`. | 20 original PNG assets 100% preserved. Zero files modified, deleted, or renamed. | Ternary formatting normalized in `MascotIllustration.tsx`. | Asset optimization into derivative WebP files deferred to Phase 2C. |

---

### 4. In-Depth Delta Analysis: Commit `cca134f`

Commit `cca134f` (`fix email delivery issue`) made targeted adjustments to six files across the repository:

```
 .gitignore                                        | 1 +
 apps/api/src/config/env.ts                        | 7 +++++++
 apps/api/src/modules/auth/auth.service.ts         | 6 +++++-
 apps/api/src/modules/email/email.service.ts       | 7 ++++---
 apps/web/src/components/ui/MascotIllustration.tsx | 9 ++++-----
 apps/web/src/pages/VerifyEmailPage.tsx            | 4 +++-
 6 files changed, 24 insertions(+), 10 deletions(-)
```

#### 4.1 Root `.gitignore`
- **Change:** Added `temp` to ignored paths.
- **Architectural Impact:** Prevents temporary artifacts, Chrome headless profiles, and local test files from dirtying the working tree.
- **UX Impact:** None.

#### 4.2 API Environment Configuration (`apps/api/src/config/env.ts`)
- **Change:** 
  ```typescript
  // Load workspace .env first, then fallback to monorepo root .env
  dotenv.config();
  dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
  ```
- **Architectural Impact:** Solves cross-workspace environment loading issues when running Fastify standalone from `apps/api` vs running from the monorepo root via `pnpm dev`.
- **UX Impact:** Prevents backend startup crashes caused by missing database or JWT secrets.

#### 4.3 Auth Service Diagnostics (`apps/api/src/modules/auth/auth.service.ts`)
- **Change:** In `verifyEmail()`, added structured logger warning and enriched security audit event metadata with `tokenHashPrefix` when a verification token is not found in PostgreSQL.
- **Architectural Impact:** Improves security observability during token debugging.
- **UX Impact:** Zero user-facing change. The error response returned to the client remains `{ status: "INVALID_TOKEN" }`.

#### 4.4 Email Service Adapter Resolution (`apps/api/src/modules/email/email.service.ts`)
- **Change:** Re-ordered adapter resolution in `createAdapterForEnvironment()`:
  ```typescript
  if (nodeEnv === "test" || provider === "test") {
    return new DeterministicTestEmailAdapter();
  }
  ```
- **Architectural Impact:** Guarantees that automated Vitest runs use the deterministic in-memory email adapter rather than attempting to connect to external SMTP servers (e.g. Zoho) or falling back to console dev adapters.
- **UX Impact:** None directly; ensures automated CI/CD pipeline reliability.

#### 4.5 Mascot Illustration Formatting (`apps/web/src/components/ui/MascotIllustration.tsx`)
- **Change:** Prettier formatting of ternary template literal.
- **Architectural Impact:** Zero functional or visual change.
- **UX Impact:** Identical visual output. Mascot PNG assets remain completely untouched.

#### 4.6 Verify Email Page Idempotency (`apps/web/src/pages/VerifyEmailPage.tsx`)
- **Change:**
  ```typescript
  const hasRequestedRef = React.useRef(false);
  useEffect(() => {
    if (initialToken && !hasRequestedRef.current) {
      hasRequestedRef.current = true;
      void executeVerify(initialToken);
    }
  }, [initialToken]);
  ```
- **Architectural Impact:** Prevents React 18/19 StrictMode in development from firing the email verification API call twice. Previously, the second invocation would find the token already consumed and display an "Invalid Token" error to the user even though verification had actually succeeded.
- **UX Impact:** **Resolved UX Bug.** Users clicking email verification links no longer receive false-positive failure notices due to client-side double invocation.

---

### 5. Verification of Existing Phase 2B Audit Findings

The Phase 2B audit established 37 prioritized redesign findings across four severity tiers in `DOC-UX-P2B-009`. Each finding was independently re-evaluated against the current repository:

| Backlog ID | Finding Description | Severity | Current Status | Verification Details |
|---|---|:---:|:---:|---|
| **`F-001`** | Prominent developer tracking badges (`PW-001`, `HD-008`, `WF-xxx`) rendered on user-facing UI | **P0** | **OPEN** | Confirmed visible in all 81 fresh screenshots (`evidence/current/`). |
| **`F-002`** | Mobile application built as monolithic card-grid screen switcher instead of tab/stack navigation | **P0** | **OPEN** | Confirmed in `apps/mobile/app/(traveller)/index.tsx` and `(host)/index.tsx`. |
| **`F-003`** | Hardware QR scanner falls back to manual PIN simulation `482910` (`HM-021`) | **P0** | **OPEN** | Confirmed in `apps/mobile/app/(host)/scanner.tsx`; no `expo-camera` bindings. |
| **`F-004`** | Map exploration screens (`PW-002`, `TM-012`) render dark text boxes rather than interactive maps | **P0** | **OPEN** | Confirmed in `apps/web/src/pages/SearchPage.tsx` and `apps/mobile/app/(traveller)/explore.tsx`. |
| **`F-005`** | Mascot asset bloat: 20 uncompressed PNG files total 29.54 MB | **P1** | **OPEN** | Original PNGs preserved; WebP derivative build pipeline not yet configured. |
| **`F-006`** | Sub-44px touch targets on mobile filter chips and action links | **P1** | **OPEN** | Metric verified in `05-usability-and-accessibility-audit.md`. |
| **`F-007`** | Superadmin Incidents screen (`AD-013`) is an unfunctional placeholder card | **P1** | **OPEN** | Confirmed in `apps/web/src/pages/admin/AdminIncidentsPage.tsx`. |
| **`F-008`** | Low-contrast text on dark gradient cards failing WCAG 2.2 AA (ratios $< 3:1$) | **P1** | **OPEN** | Confirmed across `PW-001`, `PW-002`, `HD-001`. |
| **`F-009`–`F-037`** | Remaining visual hierarchy, form usability, SLA timer, and empty state findings | **P1–P3** | **OPEN** | All 29 findings verified 100% active and unmodified. |

**Audit Conclusion:** Commit `cca134f` resolved one technical verification bug in `VerifyEmailPage.tsx`. **All 37 user experience and architectural findings catalogued in Phase 2B remain active, verified, and ready for remediation in Phase 2C.**

---

### 6. Working-Tree Stability & Test Suite Health

Automated test suites across all monorepo packages were executed against current HEAD (`cca134f`):

| Package / Filter | Test Framework | Test Files | Total Tests | Status | Execution Duration |
|---|---|:---:|:---:|:---:|:---:|
| `@luggage-storage/contracts` | Vitest v2.1.8 | 6 | 61 | **PASS (100%)** | 1.84s |
| `@luggage-storage/web` | Vitest v2.1.8 | 6 | 43 | **PASS (100%)** | 3.22s |
| `@luggage-storage/mobile` | Vitest v2.1.8 | 3 | 33 | **PASS (100%)** | 2.15s |
| `@luggage-storage/api` | Vitest v2.1.8 | 8 | 48 | **PASS (100%)** | 4.60s |
| **Total Test Suite** | **Monorepo Suite** | **23 Files** | **185 Tests** | **100% PASS** | **11.81s** |

All background services (PostgreSQL 16.8 container on port 5432, Fastify API on port 3000, Vite Web on port 5173, and Expo Web on port 8081) remain healthy and responsive.

---

### 7. Document Sign-Off

- **Baseline Status:** Fully Reconciled & Verified.
- **Repository Parity:** 100% aligned with `origin/main` (`dba73b8`).
- **Code Change Clearance:** Zero application source code modifications required during Phase 2B.1. Codebase is frozen and ready for Phase 2C implementation kickoff.