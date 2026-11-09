# Phase 2C.0 — Quality Assurance & Release Gates
## Document 19: Canonical QA Verification & Twelve Release Readiness Gates

**Project:** Global Luggage Storage Marketplace (`https://github.com/kavicastelo/luggage-storage`)  
**Document ID:** `DOC-UX-P2C-019`  
**Phase:** Phase 2C.0 — Baseline Reconciliation  
**Current HEAD Commit:** `17d5afa` / `57b1c39`  
**Source Code Baseline:** `cca134f`  
**Date:** November 9, 2026  
**Auditor / Author:** Principal QA Lead & Senior Release Engineer  

---

### 1. Executive Summary & Quality Policy

To prevent the recurrence of premature completion claims (such as historically labeling simulated screens "QA_VERIFIED" based solely on mock data tests), Phase 2C institutes **twelve mandatory, measurable Release Quality Gates**.

Arbitrary metrics (such as claiming "$>250$ tests" without behavioral assertions, relying on automated Lighthouse scores in lieu of manual assistive technology verification, or treating screenshot counts as proof of visual quality) are explicitly prohibited.

Every gate below defines:
1. **What is tested** (scope and subject).
2. **How it is tested** (exact command, tool, or methodology).
3. **What constitutes failure** (objective, non-ambiguous failure criteria).

---

### 2. The Twelve Phase 2C Release Gates

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          TWELVE MEASURABLE RELEASE GATES                               │
├─────────┬─────────────────────────────────────┬────────────────────────┬───────────────┤
│ Gate ID │ Quality Gate Name                   │ Target Scope           │ Enforcement   │
├─────────┼─────────────────────────────────────┼────────────────────────┼───────────────┤
│ GATE-01 │ Build, Lint & Type Safety           │ Monorepo Codebase      │ CI Automated  │
│ GATE-02 │ Unit & Component Behavioral Tests   │ User Interactions      │ CI Vitest     │
│ GATE-03 │ API Integration & Contract Safety   │ Fastify & Client SDK   │ Contract Test │
│ GATE-04 │ End-to-End Workflow Verification    │ Critical User Journeys │ Integration   │
│ GATE-05 │ Visual Regression & Jargon Check    │ Pixel Diff & DOM Scan  │ Visual CI     │
│ GATE-06 │ Responsive Layouts (5 Viewports)    │ 375px to 1440px        │ Viewport Scan │
│ GATE-07 │ Accessibility (WCAG 2.2 Level AA)   │ Keyboard & ScreenRead  │ Manual + Axe  │
│ GATE-08 │ Authentication & RBAC Boundaries    │ Route Guards & APIs    │ Security Test │
│ GATE-09 │ Booking, Payment & Custody Safety   │ State Transitions      │ Logic Suite   │
│ GATE-10 │ Physical Mobile Device Verification │ iOS / Android Hardware │ Device Matrix │
│ GATE-11 │ Evidence & Documentation Integrity  │ Evidence Registry & Docs Checksum Audit│
│ GATE-12 │ Release Rollback Readiness          │ Reversion Protocol     │ Deploy Drill  │
└─────────┴─────────────────────────────────────┴────────────────────────┴───────────────┘
```

---

#### Gate 1: Build, Lint & Type Safety (`GATE-01`)
- **What is Tested:** Strict TypeScript compilation, syntactic formatting, and lint rules across all workspace packages (`@luggage-storage/contracts`, `apps/api`, `apps/web`, `apps/mobile`).
- **How it is Tested:**
  ```powershell
  pnpm lint
  pnpm typecheck
  pnpm prettier --check .
  ```
- **What Constitutes Failure:**
  - Any TypeScript compiler error (`tsc --noEmit` exit code $\ne 0$).
  - Any ESLint error or warning.
  - Any file violating Prettier formatting conventions.

---

#### Gate 2: Unit & Component Behavioral Tests (`GATE-02`)
- **What is Tested:** Interactive component behavior (form input validation, button event handlers, state transitions, modal dismissals, accordion toggles) rather than static fixture rendering.
- **How it is Tested:**
  ```powershell
  pnpm test
  ```
- **What Constitutes Failure:**
  - Any failing test assertion or unhandled promise rejection in Vitest output.
  - Tests that only assert component mounting without simulating user events or verifying DOM mutations.
  - Any skipped (`test.skip`) or disabled test without a documented, approved waiver.

---

#### Gate 3: API Integration & Contract Safety (`GATE-03`)
- **What is Tested:** Data contract synchronization between Fastify backend route schemas and frontend API clients in `apps/web` and `apps/mobile`.
- **How it is Tested:**
  ```powershell
  pnpm --filter @luggage-storage/contracts test
  ```
- **What Constitutes Failure:**
  - Any breaking schema modification in `@luggage-storage/contracts` that violates Fastify API request/response contracts.
  - Any undocumented or invented API endpoint invoked by frontend code that lacks a corresponding Fastify route handler.

---

#### Gate 4: End-to-End Workflow Verification (`GATE-04`)
- **What is Tested:** Multi-step journey completion:
  - Traveller: Landing $\to$ Search $\to$ Location $\to$ Checkout $\to$ Pass Generation.
  - Host: Counter Desk $\to$ QR Scan/PIN $\to$ Tag Entry $\to$ Custody Confirmation $\to$ Release.
  - Superadmin: Host Application $\to$ Document Inspection $\to$ Approval / Rejection.
- **How it is Tested:** End-to-end integration tests simulating multi-role user flows against local running server instances.
- **What Constitutes Failure:**
  - Inability to advance through a primary flow without manual browser console intervention.
  - Loss of form state or user session during multi-step checkout.

---

#### Gate 5: Visual Regression & Jargon Suppression (`GATE-05`)
- **What is Tested:** Elimination of internal tracking IDs (`PW-xxx`, `HD-xxx`, `AD-xxx`, `TM-xxx`, `HM-xxx`, `WF-xxx`) from all customer views, and automated pixel-diff comparison against approved baseline screenshots.
- **How it is Tested:**
  ```powershell
  node scripts/verify-no-internal-codes.mjs
  pnpm run test:visual
  ```
- **What Constitutes Failure:**
  - A single match for regex `\b(PW|HD|AD|TM|HM)-\d{3}\b|\bWF-\d{3}\b|UI_SIMULATION` in rendered customer DOM text nodes.
  - Visual pixel difference $>1.0\%$ against baseline screenshots (ignoring dynamic timestamp and animated SVG regions).

---

#### Gate 6: Responsive Layouts Across 5 Viewports (`GATE-06`)
- **What is Tested:** Viewport adaptation across 5 standard viewport resolutions:
  - Mobile Small: $375\times 667$ (iPhone SE)
  - Mobile Standard: $390\times 844$ (iPhone 14/15/16)
  - Tablet Portrait: $768\times 1024$ (iPad Mini)
  - Desktop Standard: $1280\times 900$ (Standard Laptop)
  - Desktop Wide: $1440\times 900$ (Wide Monitor)
- **How it is Tested:** Automated headless Chrome compositor captures and visual inspection scripts verifying container bounding boxes.
- **What Constitutes Failure:**
  - Horizontal scrolling / overflow on mobile or tablet viewports.
  - Clipped or overlapping primary action buttons (`Book Now`, `Confirm & Pay`).
  - Text truncation on location card titles or pricing breakdown lines.

---

#### Gate 7: Accessibility & WCAG 2.2 Level AA Compliance (`GATE-07`)
- **What is Tested:** Accessibility compliance for assistive technologies and keyboard-only navigation.
- **How it is Tested:**
  1. Automated `axe-core` CLI scan across all routes.
  2. Manual keyboard navigation audit (Tab, Shift+Tab, Enter, Space, Escape) through all forms and dialogs.
  3. Color contrast ratio audit against WCAG 2.2 AA standards ($\ge 4.5:1$ normal text, $\ge 3.0:1$ large text/UI components).
- **What Constitutes Failure:**
  - Any critical or serious `axe-core` accessibility violation.
  - Any interactive element lacking a visible focus indicator (`focus-visible:ring-2 focus-visible:ring-terracotta-500`).
  - Any touch target on mobile measuring $<44\times 44$ CSS pixels.
  - Primary button label text failing the $4.5:1$ contrast ratio against button background.

---

#### Gate 8: Authentication & Real RBAC Boundaries (`GATE-08`)
- **What is Tested:** Real server-side and client-side authorization boundaries, verifying that unauthorized users cannot access restricted data or execute privileged mutations.
- **How it is Tested:**
  - Automated security tests attempting unauthenticated and cross-role requests to `/api/v1/users/me`, `/portal/*`, `/host/*`, and `/admin/*`.
- **What Constitutes Failure:**
  - Unauthenticated access to protected routes returning anything other than `401 Unauthorized` or redirecting to `/login`.
  - Authenticated `TRAVELLER` accessing host operations or admin consoles without receiving `403 Forbidden`.
  - Sensitive custody tokens or user PII exposed in unencrypted browser storage or console logs.

---

#### Gate 9: Booking, Payment & Custody Safety (`GATE-09`)
- **What is Tested:** State machine integrity for bag custody tokens:
  - `CREATED` $\to$ `CONFIRMED` $\to$ `ACTIVE_STORAGE` $\to$ `RELEASED` $\to$ `COMPLETED`
  - Rejection of invalid state transitions (e.g. attempting to release an already released bag).
  - Accurate overdue penalty calculation and escrow balance tracking.
- **How it is Tested:** State machine unit tests in `@luggage-storage/contracts` and API integration tests.
- **What Constitutes Failure:**
  - Any race condition allowing double-check-in or double-release of the same luggage item.
  - Mathematical discrepancy between itemized fees and total charged amount.

---

#### Gate 10: Physical Mobile Device Verification (`GATE-10`)
- **What is Tested:** Native iOS and Android runtime execution on physical hardware:
  - Real camera QR scanning (`HM-021`) via `expo-camera`.
  - Native gesture fluidity on MapLibre mobile map (`TM-012`).
  - Offline pass caching (`TM-024`) with device in Airplane Mode.
  - Native haptic feedback on successful scan.
- **How it is Tested:** Manual verification protocol executed on:
  - 1 Physical iOS Device (iPhone running iOS 16+)
  - 1 Physical Android Device (Pixel / Samsung running Android 13+)
- **What Constitutes Failure:**
  - App crash or white screen on mobile cold launch.
  - Camera viewfinder freeze or failure to scan valid QR within 2.0 seconds.
  - Inability to render digital custody pass and PIN while in Airplane Mode.

---

#### Gate 11: Evidence & Documentation Integrity (`GATE-11`)
- **What is Tested:** Traceability and authenticity of all audit and implementation records.
- **How it is Tested:**
  - Checksum audit verifying that all 20 original mascot PNG files in `Assets/` and `apps/web/public/assets/mascot/` are 100% byte-identical to baseline.
  - Verification that every screenshot referenced in documentation exists on disk with exact matching filenames.
- **What Constitutes Failure:**
  - Any modification, deletion, or renaming of original mascot PNG files.
  - Broken file links or mismatched screenshot filenames in documentation.
  - Inclusion of unverified claims in documentation without explicit disclaimers.

---

#### Gate 12: Release Rollback Readiness (`GATE-12`)
- **What is Tested:** The operational ability to revert a defective deployment cleanly without database corruption or permanent user lockout.
- **How it is Tested:** Staging deployment dry run executing fast-forward revert to previous stable tag.
- **What Constitutes Failure:**
  - A release candidate that introduces non-backward-compatible database schema changes or corrupts cached client sessions upon rollback.
  - Absence of a documented, verified one-line rollback command.

---

### 3. Release Sign-Off Matrix

Every release candidate must receive signed digital certification from all designated leads across all twelve gates:

| Gate ID | Quality Gate Name | Responsible Lead | Verification Artifact | Sign-Off Status |
|---|---|---|---|:---:|
| `GATE-01` | Build & Types | Frontend Tech Lead | CI Build Log | PENDING |
| `GATE-02` | Unit / Component Tests | QA Automation Lead | Vitest Report | PENDING |
| `GATE-03` | API Contracts | System Architect | Contract Test Log | PENDING |
| `GATE-04` | E2E Workflows | Lead QA Engineer | E2E Run Report | PENDING |
| `GATE-05` | Visual / Jargon | Senior UX Auditor | Pixel Diff & Regex Report | PENDING |
| `GATE-06` | Responsive Viewports | UI Engineer | Viewport Screenshot Log | PENDING |
| `GATE-07` | Accessibility | A11y Specialist | Axe Report + Keyboard Log | PENDING |
| `GATE-08` | Security & RBAC | Lead Security Architect | RBAC Audit Run | PENDING |
| `GATE-09` | Custody / Payment | Financial / Custody Lead | State Machine Test Run | PENDING |
| `GATE-10` | Physical Mobile Device | Mobile Device QA Lead | Hardware Device Test Matrix | PENDING |
| `GATE-11` | Evidence & Mascot | Product Owner / Brand | Asset Checksum + Link Audit | PENDING |
| `GATE-12` | Rollback Readiness | Release / DevOps Lead | Staging Rollback Drill Log | PENDING |