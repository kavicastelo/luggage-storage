# Phase 2C.0 — Agent Execution Governance
## Document 23: Agent Execution Rules & Governance Protocols

**Project:** Global Luggage Storage Marketplace (`https://github.com/kavicastelo/luggage-storage`)  
**Document ID:** `DOC-UX-P2C-023`  
**Phase:** Phase 2C.0 — Baseline Reconciliation  
**Target Audience:** All Autonomous & Human Coding Agents Executing Phase 2C  
**Date:** November 9, 2026  
**Auditor / Architect:** Principal Product Architect & Systems Safety Lead  

---

### 1. Executive Summary & Purpose

To ensure that separate coding agents can execute Phase 2C implementation workstreams independently without breaking existing functionality, inventing product scope, or degrading repository safety, this document establishes **fourteen mandatory execution protocols**.

Every agent assigned to a Phase 2C task must read, acknowledge, and strictly adhere to these protocols.

---

### 2. The Fourteen Agent Execution Protocols

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        FOURTEEN AGENT EXECUTION PROTOCOLS                              │
├─────────┬─────────────────────────────────────┬────────────────────────────────────────┤
│ Rule ID │ Protocol Name                       │ Core Mandate                           │
├─────────┼─────────────────────────────────────┼───────────────────────────────-────────┤
│ RULE-01 │ Read Specifications First           │ Read governing docs before writing code│
│ RULE-02 │ Inspect Existing Code First         │ Never blind-replace components         │
│ RULE-03 │ No Invented Product Functionality   │ Stick to documented PRD requirements   │
│ RULE-04 │ Strict Backend & Contract Integrity │ Do not invent APIs; use documented sim │
│ RULE-05 │ Preserve Identity & Security        │ Protect Phase 1B auth, RBAC & sessions │
│ RULE-06 │ Mascot Asset Protection Guarantee   │ Original 20 PNGs are immutable         │
│ RULE-07 │ Work Strictly Within Assigned Scope │ Do not cross assigned workstream bounds│
│ RULE-08 │ Run All Relevant Tests              │ Verify monorepo tests pass 100%        │
│ RULE-09 │ Capture Real Screenshots            │ No fabricated or placeholder evidence  │
│ RULE-10 │ Explicitly Document Limitations     │ State unverified areas honestly        │
│ RULE-11 │ Rigorous Git Diff Inspection        │ Inspect every line before staging      │
│ RULE-12 │ Clean Atomic Commits                │ Meaningful Conventional Commit format  │
│ RULE-13 │ Report Exact HEAD Commit SHA        │ Provide complete traceability          │
│ RULE-14 │ Never Merge to Main Unauthorized    │ Branch isolation strictly enforced     │
└─────────┴─────────────────────────────────────┴────────────────────────────────────────┘
```

---

#### Protocol 1: Read Specifications Before Implementation (`RULE-01`)
- **Mandate:** Before editing or creating a single source file, the agent must read the relevant sections in `master-screen-registry.md`, `navigation-and-journey-maps.md`, and the specific task specification in `DOC-UX-P2C-018`.
- **Violation:** Implementing a feature based solely on assumptions or prompt summaries without reviewing documented specifications.

---

#### Protocol 2: Inspect Existing Code Before Replacing (`RULE-02`)
- **Mandate:** The agent must inspect the active component, its imports, local state hooks, and test fixtures before refactoring.
- **Violation:** Blindly overwriting an existing component file with a generic template that strips previously verified behaviors or integration hooks.

---

#### Protocol 3: Do Not Invent Product Functionality (`RULE-03`)
- **Mandate:** The agent must strictly implement the scope defined in the task backlog.
- **Violation:** Adding unapproved third-party integrations (e.g. social chat widgets, crypto payments, biometric checks) not authorized in the backlog.

---

#### Protocol 4: Strict Backend & Contract Integrity (`RULE-04`)
- **Mandate:** The agent must verify whether underlying Fastify endpoints exist before coding. Where the backend is deferred to Phase 3+, the frontend task must be implemented as a **documented simulation harness** with clear developer boundaries.
- **Violation:** Inventing mock API routes or phantom schemas that conflict with `@luggage-storage/contracts`.

---

#### Protocol 5: Preserve Identity & Security Infrastructure (`RULE-05`)
- **Mandate:** The agent must never weaken, bypass, or alter Phase 1B identity, session cookies, CSRF tokens, or RBAC route guards.
- **Violation:** Disabling auth guards or removing user role verification to make a test pass.

---

#### Protocol 6: Mascot Asset Protection Guarantee (`RULE-06`)
- **Mandate:** All 20 original mascot PNG files located in `Assets/` and `apps/web/public/assets/mascot/` must remain completely untouched, byte-for-byte.
- **Violation:** Renaming, compressing, modifying, moving, or deleting any original mascot PNG asset.

---

#### Protocol 7: Work Strictly Within Assigned Scope (`RULE-07`)
- **Mandate:** The agent must only modify files directly relevant to its assigned task and workstream.
- **Violation:** Modifying host dashboard code during a public web task, or modifying backend API routes during a frontend styling task.

---

#### Protocol 8: Run All Relevant Tests (`RULE-08`)
- **Mandate:** Before declaring a task complete, the agent must run linting, typechecks, and Vitest test suites across affected packages:
  ```powershell
  pnpm lint
  pnpm typecheck
  pnpm test
  ```
- **Violation:** Committing code that breaks existing tests or introduces new TypeScript compile errors.

---

#### Protocol 9: Capture Real Visual Evidence (`RULE-09`)
- **Mandate:** All visual evidence must be genuinely rendered by executing local running application instances and capturing PNG screenshots with standard viewports.
- **Violation:** Fabricating screenshots, using placeholder mockups, or claiming visual inspection without rendering.

---

#### Protocol 10: Explicitly Document Limitations (`RULE-10`)
- **Mandate:** If a capability cannot be verified (e.g. native camera hardware, physical GPS, push notifications), the agent must explicitly record it as **`UNVERIFIED`** in documentation.
- **Violation:** Marking a feature "fully verified" when only simulated in a desktop browser.

---

#### Protocol 11: Rigorous Git Diff Inspection (`RULE-11`)
- **Mandate:** Before staging files, the agent must run `git diff --stat` and `git diff` to inspect every modified line, ensuring zero unintended edits or whitespace noise.
- **Violation:** Staging stray build artifacts, temporary logs, or unformatted files.

---

#### Protocol 12: Clean Atomic Commits (`RULE-12`)
- **Mandate:** Stage only relevant files and commit using Conventional Commits format (e.g. `feat(web): overhaul public landing hero and search widget`).
- **Violation:** Grouping multiple unrelated workstreams into a single massive commit.

---

#### Protocol 13: Report Exact HEAD Commit SHA (`RULE-13`)
- **Mandate:** In the final turn report, the agent must report the exact Git branch and 7-character/40-character HEAD commit SHA.
- **Violation:** Reporting vague completion messages without commit traceability.

---

#### Protocol 14: Never Merge to Main Unauthorized (`RULE-14`)
- **Mandate:** All work must remain on the designated feature branch (`feat/phase-2c-...` or `feat/phase-1b-identity`). Merging into `main` requires explicit Product Owner authorization.
- **Violation:** Executing `git merge main` or pushing directly to `origin/main`.