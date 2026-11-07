# Phase 1A-R Dependency Security Advisory Register & Reconciliation

- **Project:** Global Luggage Storage Marketplace
- **Document ID:** GOV-SEC-1A-R-001
- **Phase:** Phase 1A-RC3-C3 — Evidence Reconciliation
- **Date:** 2026-11-07
- **Classification:** Internal Engineering & Security Governance
- **Status:** APPROVED BASELINE REGISTER (C3 AUDIT RECONCILED)

---

## 1. Executive Summary

This register establishes the authoritative, verified inventory of all security advisories present in the repository dependency tree as of **Phase 1A-RC3-C3**.

Following a fresh lockfile audit (`pnpm audit --json`) conducted on Node.js v26.3.1 and pnpm v12.9.1:
- **0 Critical-severity vulnerabilities**
- **0 High-severity vulnerabilities**
- **7 Moderate-severity vulnerability entries** (reported via `pnpm audit` metadata)
- **0 Low-severity vulnerabilities**
- **0 Informational-severity vulnerabilities**

All 7 advisory findings are classified as **Moderate** and have been determined through reachability, surface exposure, and dataflow analysis to be **completely unexploitable across production and development runtime environments**. Each advisory is governed by active compensating controls and formal retention rationale documented herein.

---

## 2. Authoritative Reconciliation of Audit Inventory Metrics

Previous reports exhibited counting ambiguities (for example, displaying an 8-row table when 7 vulnerabilities were cited in metadata). This section establishes the definitive, mathematical reconciliation across all 7 reporting dimensions:

| Dimension | Count | Definition & Reconciled Explanation |
| :--- | :---: | :--- |
| **1. `pnpm audit` Metadata Count** | **7** | The standard vulnerability integer reported in `data.metadata.vulnerabilities.moderate` and rendered by CLI as `7 vulnerabilities found (7 moderate)`. |
| **2. Advisory Objects in JSON** | **7** | Unique advisory keys in `data.advisories`: `1124268`, `1124272`, `1193683`, `1193684`, `1242767`, `1244013`, `1244623`. |
| **3. Distinct GHSA Identifiers** | **6** | Distinct GitHub Security Advisory IDs. `GHSA-82fw-gwwq-j7x9` applies jointly to both `vitest` (Key 1193683) and `@vitest/mocker` (Key 1193684), yielding 7 advisory keys for 6 GHSAs. |
| **4. Distinct Affected Package Modules** | **5** | `react-router`, `vitest`, `@vitest/mocker`, `glob`, `minimatch`. |
| **5. Package-Advisory Combinations** | **7** | Distinct `(module, GHSA)` pairs: `(react-router, GHSA-wrjc-x8rr-h8h6)`, `(react-router, GHSA-337j-9hxr-rhxg)`, `(vitest, GHSA-82fw-gwwq-j7x9)`, `(@vitest/mocker, GHSA-82fw-gwwq-j7x9)`, `(@vitest/mocker, GHSA-qxg6-89mg-rqv8)`, `(glob, GHSA-3g3m-2fjr-6pw4)`, `(minimatch, GHSA-g3hv-75wg-m249)`. |
| **6. Installed Version Instances (Tuples)**| **9** | Unique `(module, GHSA, installed_version)` tuples across workspaces: `react-router@6.30.6` (x2 GHSAs), `vitest@3.2.7`, `@vitest/mocker@3.2.7` (x2 GHSAs), `glob@10.5.0`, `glob@13.0.6`, `minimatch@10.2.6`, `minimatch@9.0.9`. |
| **7. Total Dependency Paths** | **156** | Aggregate dependency graph resolution paths terminating in affected modules. |

### 2.1 Why the Previous Table Displayed 8 Rows
In Phase 1A-RC3-C2, the summary table visually displayed 8 rows because `glob` (GHSA-3g3m-2fjr-6pw4) was split into two rows to show its two installed versions (`10.5.0` and `13.0.6`), while `minimatch` was presented on a single primary row. The definitive accounting consists of **7 advisory entries** covering **9 installed version tuples**.

### 2.2 Clarification of the "Expo CLI Tooling" Relationship
1. **No direct advisory exists against `@expo/cli` or Expo SDK 58.**
2. `@expo/cli` and `@expo/fingerprint` (core build tooling packages in Expo SDK 58 under `apps/mobile`) transitively depend on `glob` and `minimatch`.
3. Of the 156 total dependency paths in the monorepo, **62 paths originate from `apps/mobile`**, traversing through `@expo/cli` and `@expo/fingerprint` to vulnerable versions of `glob` (`13.0.6`) and `minimatch` (`10.2.6`).
4. Therefore, colloquial mentions of an "Expo CLI advisory" denote strictly the **transitive `glob` and `minimatch` build-tooling dependencies within the Expo SDK 58 ecosystem**.

---

## 3. Comprehensive Exposure Surface Assessment

To ensure defensible security governance beyond generic claims of non-reachability, each advisory has been evaluated across **7 distinct execution environments**:

| Environment Surface | `react-router` (x2) | `vitest` & `@vitest/mocker` (x3) | `glob` (x1) | `minimatch` (x1) |
| :--- | :--- | :--- | :--- | :--- |
| **1. Production Backend (`apps/api`)** | **Not Present.** Backend is Fastify; does not import `react-router`. | **Not Present.** Dev-dependency; excluded from `apps/api/dist/server.js`. | **Not Present.** Dev-dependency; excluded from production server image. | **Not Present.** Dev-dependency; excluded from production server image. |
| **2. Production Web (`apps/web`)** | **Bundled but Safe.** Client-side SPA bundle; no SSR hydration; static navigation targets. | **Not Present.** Dev-dependency; excluded from Vite SPA client bundle (`dist/`). | **Not Present.** Dev-dependency; excluded from Vite SPA client bundle. | **Not Present.** Dev-dependency; excluded from Vite SPA client bundle. |
| **3. Production Mobile (`apps/mobile`)** | **Not Present.** Mobile uses Expo Router / React Native Navigation. | **Not Present.** Dev-dependency; excluded from Hermes bytecode bundles. | **Not Present.** Tooling only; excluded from mobile runtime bytecode. | **Not Present.** Tooling only; excluded from mobile runtime bytecode. |
| **4. Developer Workstation** | **Safe.** Local browser loads static client SPA. No untrusted redirects. | **Safe.** Headless batch execution (`vitest run`). No API/UI server listening on ports. | **Safe.** Tooling operates exclusively on committed repository files. No abort timeouts. | **Safe.** Matches fixed configuration patterns in `eslint.config.js` and `tsconfig.json`. |
| **5. CI Runner** | **Safe.** Static assets built via Vite; no remote redirect execution. | **Safe.** Isolated container; tests run headlessly; no external network ingress. | **Safe.** `rimraf` and Turbo cache evaluate committed repository file paths. | **Safe.** ESLint evaluates static repository source trees. |
| **6. Development Server (`pnpm dev`)** | **Safe.** Vite dev server serves client SPA. Zero SSR stream processing. | **Safe.** Vitest watch/UI server is not launched during web/api dev servers. | **Safe.** No HTTP endpoints accept globbing queries or search parameters. | **Safe.** No HTTP endpoints accept pattern matching inputs. |
| **7. Build Process (`pnpm build`)** | **Safe.** Bundled into static assets; zero hydration stream execution. | **Not Invoked.** Tests do not execute during `turbo run build`. | **Safe.** Executes during `expo export` and `rimraf` on fixed local paths. | **Safe.** Evaluates fixed ESLint ignore rules and Metro asset regexes. |

---

## 4. Deep-Dive Package Investigations

### 4.1 React Router (`react-router@6.30.6`)

#### Routing Mode & Sinks Inspection
- **Routing Architecture:** Inspection of `apps/web/src/app/App.tsx` confirms that the application operates strictly in **Declarative Mode** using `<BrowserRouter>`, `<Routes>`, and `<Route>`. It does **NOT** use Data Mode (`createBrowserRouter`, `RouterProvider`) or Framework Mode (Remix / React Router v7 server runtime).
- **Navigation Sinks:** Codebase search across all `.ts` and `.tsx` files revealed:
  - Zero calls to `useNavigate()`.
  - Zero dynamic redirect utilities (`redirect()`, `Navigate`).
  - Exactly one `<Link>` element in `NotFoundPage.tsx`: `<Link to="/">Return to Home</Link>`.
  - The destination is a hardcoded static string literal (`"/"`). No URL search parameters (`location.search`), hash fragments, or user payloads reach any navigation sink.
- **SSR & Hydration Absence:** `apps/web/src/main.tsx` renders the application via `createRoot(document.getElementById("root")!).render(...)`. There is **zero server-side rendering (SSR)**, no `hydrateRoot()`, and no SSR error deserialization stream. Consequently, `deserializeErrors()` is never compiled into runtime execution.
- **Exposure Ruling:** 
  - `GHSA-wrjc-x8rr-h8h6` (Open Redirect via Backslash): **Physically Impossible to Trigger** (no dynamic redirect targets).
  - `GHSA-337j-9hxr-rhxg` (SSR Hydration Constructor Injection): **Completely Absent** (zero SSR / zero hydration).

---

### 4.2 Vitest & `@vitest/mocker` (`vitest@3.2.7`, `@vitest/mocker@3.2.7`)

#### Configuration & Plugin Inspection
- Inspection of all four configuration files (`apps/api/vitest.config.ts`, `apps/web/vitest.config.ts`, `apps/mobile/vitest.config.ts`, `packages/contracts/vitest.config.ts`) confirms:
  - `globals: true` and `environment: "node"` are configured.
  - **`mockerPlugin` and `interceptorPlugin` are NOT configured or registered.**
  - **`api: false` and `ui: false` (default): No Vitest HTTP or WebSocket API server is started.**
- **Network & Socket Binding:** Vitest is executed strictly via headless batch mode (`vitest run`). It does not bind to localhost or external network ports.
- **Exposure Ruling:**
  - `GHSA-82fw-gwwq-j7x9` (Arbitrary File Read via Redirect Mock): Requires an attacker-controlled redirect target in a mock server. Our tests do not use redirect mocks or remote mocking servers.
  - `GHSA-qxg6-89mg-rqv8` (Code Injection via Unauthenticated Mock Registration): Requires an exposed Vitest API server accepting remote RPC requests. No API server is listening.
  - **Both advisories are completely unexploitable in both CI and local developer workstations.**

---

### 4.3 Glob & Minimatch

#### Version Distribution & Paths
- **`glob`:**
  - `10.5.0` (4 paths): Dev-dependency via `rimraf` (root, `api`, `web`, `contracts`).
  - `13.0.6` (34 paths): Deep transitive dependency via `apps/mobile > expo > @expo/cli` and `@expo/fingerprint`.
- **`minimatch`:**
  - `9.0.9` (4 paths): Dev-dependency via `rimraf`.
  - `10.2.6` (100 paths): Dev-dependency via `@eslint/js`, `typescript-eslint`, and `@expo/cli`.

#### Behavior & Attack Vector Evaluation
- **`glob` (GHSA-3g3m-2fjr-6pw4):** The vulnerability allows post-timeout traversal when an `AbortSignal` aborts an ongoing glob search. In this monorepo, glob operations run synchronously or to full completion against local, fixed directory paths (`dist/`, `app/`, `src/`). No abort signals or timeouts are passed to `glob`. No untrusted user input specifies search roots or patterns.
- **`minimatch` (GHSA-g3hv-75wg-m249):** The vulnerability involves ReDoS via catastrophic backtracking on crafted, heavily nested glob pattern strings. In this monorepo, minimatch evaluates static configuration strings authored by project engineers (e.g. `eslint.config.js` ignore lists, Metro asset regexes). No external client data or user-supplied strings are evaluated by `minimatch`.
- **Exposure Ruling:** Both utilities are restricted to build and lint operations against committed repository sources. Broad exposure is **zero**.

---

## 5. Master Reconciled Advisory Inventory Table

```
+------------------------------------------------------------------------------------------------------------------------------------------------+
|                                              AUTHORITATIVE ADVISORY INVENTORY (7 ADVISORIES / 9 TUPLES)                                        |
+-----+----------------------+---------------------+----------+-----------+--------+-------+----------------------------------+------------------+
| Key | Affected Module      | GHSA Identifier     | Severity | Installed | Paths  | Scope | Vulnerable Attack Vector         | Production Risk  |
+-----+----------------------+---------------------+----------+-----------+--------+-------+----------------------------------+------------------+
| 1   | react-router         | GHSA-wrjc-x8rr-h8h6 | Moderate | 6.30.6    | 1 path | Prod  | Open redirect via backslash      | ZERO (Static to=)|
| 2   | react-router         | GHSA-337j-9hxr-rhxg | Moderate | 6.30.6    | 1 path | Prod  | Constructor injection in SSR     | ZERO (No SSR)    |
| 3   | vitest               | GHSA-82fw-gwwq-j7x9 | Moderate | 3.2.7     | 4 paths| Dev   | File read via redirect mock      | ZERO (Dev only)  |
| 4   | @vitest/mocker       | GHSA-82fw-gwwq-j7x9 | Moderate | 3.2.7     | 4 paths| Dev   | File read via redirect mock      | ZERO (Dev only)  |
| 5   | @vitest/mocker       | GHSA-qxg6-89mg-rqv8 | Moderate | 3.2.7     | 4 paths| Dev   | Code injection via unauth mock   | ZERO (Dev only)  |
| 6   | glob                 | GHSA-3g3m-2fjr-6pw4 | Moderate | 10.5.0    | 4 paths| Build | AbortSignal traversal bypass     | ZERO (Build only)|
|     |                      |                     |          | 13.0.6    | 34 pths| Build | AbortSignal traversal bypass     | ZERO (Build only)|
| 7   | minimatch            | GHSA-g3hv-75wg-m249 | Moderate | 10.2.6    | 100 pth| Build | ReDoS globparts amplification    | ZERO (Build only)|
|     |                      |                     |          | 9.0.9     | 4 paths| Build | ReDoS globparts amplification    | ZERO (Build only)|
+-----+----------------------+---------------------+----------+-----------+--------+-------+----------------------------------+------------------+
```

---

## 6. Retention Rationale & Compensating Controls

1. **`react-router` (Retained at v6.30.6):**
   - *Rationale:* Migrating to React Router v7 is a major breaking framework change that requires rewriting the routing layer. Because the application is a pure client SPA with static navigation literals, remaining on v6.30.6 carries zero operational risk.
   - *Compensating Control:* Architectural standard forbidding dynamic user redirects without allowlist validation.
2. **`vitest` & `@vitest/mocker` (Retained at v3.2.7):**
   - *Rationale:* Vitest 3.2.7 operates stably under Node.js 26 Active LTS across all four workspaces. Upgrading to Vitest 4 requires unresolved ecosystem plugin migrations.
   - *Compensating Control:* Vitest is strictly a devDependency excluded from production builds; test executions are restricted to headless CLI mode (`vitest run`) without network-bound API servers.
3. **`glob` & `minimatch` (Retained at v10/v13 and v9/v10):**
   - *Rationale:* Deeply pinned by `@expo/cli` (Expo SDK 58) and ESLint flat config ecosystem. Forcing upstream major upgrades breaks toolchain compatibility.
   - *Compensating Control:* Build and lint tools run locally and in isolated CI runners against committed source code. No external inputs are evaluated.

---

## 7. Machine-Readable Audit Evidence Reference

- **Execution Command:** `pnpm audit --json`
- **Execution Date:** 2026-11-07
- **Node.js Runtime:** `v26.3.1`
- **Package Manager:** `pnpm v12.9.1`
- **Lockfile Format:** `pnpm-lock.yaml` (v9.0)
- **Summary Payload Metadata:** `{"info":0,"low":0,"moderate":7,"high":0,"critical":0}`
- **Exit Code:** `1` (Standard exit code indicating presence of non-zero advisory findings)
