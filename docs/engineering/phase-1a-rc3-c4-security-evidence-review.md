# Phase 1A-RC3-C4 Security Evidence & Advisory Review

- **Project:** Global Luggage Storage Marketplace
- **Document ID:** ENG-SEC-1A-RC3-C4-001
- **Phase:** Phase 1A-RC3-C4 — Final Security & Database Evidence Validation
- **Date:** 2026-11-07
- **Classification:** Engineering & Security Audit Report
- **Status:** COMPLETED & EVIDENCE-QUALIFIED

---

## 1. Executive Summary

This deliverable provides an independent, evidence-qualified audit of all security advisories present in the Global Luggage Storage Marketplace dependency tree as reported by `pnpm audit --json`.

In strict adherence to governance standards, this review avoids blanket or ungrounded assertions of absolute safety. Conclusions distinguish production runtime exposure from developer workstation and CI build exposure, evaluating attack conditions against empirical repository evidence.

The lockfile audit demonstrates:
- **0 Critical-severity vulnerabilities**
- **0 High-severity vulnerabilities**
- **7 Moderate-severity package-manager advisory entries**
- **0 Low-severity vulnerabilities**
- **0 Informational-severity vulnerabilities**

---

## 2. Definitive Inventory & Counting Reconciliation

Direct inspection of the machine-readable payload from `pnpm audit --json` confirms the following reconciled metrics:

| Dimension | Count | Definition & Machine Evidence Reference |
| :--- | :---: | :--- |
| **`pnpm audit` Metadata Count** | **7** | `data.metadata.vulnerabilities.moderate = 7` |
| **Advisory Objects in JSON** | **7** | Unique keys in `data.advisories`: `1124268`, `1124272`, `1193683`, `1193684`, `1242767`, `1244013`, `1244623` |
| **Distinct GHSA Identifiers** | **6** | `GHSA-wrjc-x8rr-h8h6`, `GHSA-337j-9hxr-rhxg`, `GHSA-82fw-gwwq-j7x9`, `GHSA-qxg6-89mg-rqv8`, `GHSA-3g3m-2fjr-6pw4`, `GHSA-g3hv-75wg-m249` |
| **Distinct Affected Packages** | **5** | `react-router`, `vitest`, `@vitest/mocker`, `glob`, `minimatch` |
| **Package-Advisory Combinations** | **7** | Unique `(package, GHSA)` pairs across the repository |
| **Installed Version Tuples** | **9** | Unique `(package, GHSA, version)` instances installed in `node_modules` |
| **Total Dependency Paths** | **158** | Exact sum of all finding dependency paths: `1 + 1 + 4 + 4 + 4 + 4 + 34 + 102 + 4 = 158` |

### Dependency Classification Breakdown
- **Production Dependencies (Client Bundle):** `react-router@6.30.6` (transitive under `react-router-dom` in `apps/web`).
- **Direct Development Dependencies:** `vitest@3.2.7` (declared in 4 workspaces).
- **Transitive Development Dependencies:** `@vitest/mocker@3.2.7` (via `vitest`), `glob@10.5.0` (via `rimraf`), `minimatch@9.0.9` (via `rimraf`).
- **Transitive Build-Time / Tooling Dependencies:** `glob@13.0.6` (34 paths via `@expo/cli` / `@expo/fingerprint`), `minimatch@10.2.6` (102 paths via `@expo/cli`, `@eslint/js`, `typescript-eslint`).

---

## 3. Advisory-by-Advisory Evidence & Reachability Assessment

### Advisory 1: `react-router` — Open Redirect via Backslash (`GHSA-wrjc-x8rr-h8h6`)
1. **GHSA Identifier:** `GHSA-wrjc-x8rr-h8h6` (Advisory Key: 1124268)
2. **Affected Package:** `react-router`
3. **Installed Vulnerable Version:** `6.30.6`
4. **Officially Fixed Version:** `>=7.18.0`
5. **Actual Dependency Paths (1 path):** `apps__web > react-router-dom@6.30.6 > react-router@6.30.6`
6. **Classification:** Transitive production dependency (client SPA bundle).
7. **Runtime / Build / Dev Exposure:** Bundled into `apps/web` client SPA distribution (`dist/`). Not present in backend or mobile runtime.
8. **Required Attack Conditions:** An attacker must supply an untrusted URL containing backslashes (e.g. `\\attacker.com`) to an unvalidated navigation sink such as dynamic `<Link to={untrusted}>` or `useNavigate(untrustedRedirectParam)`.
9. **Repository-Specific Evidence:**
   - Inspection of `apps/web/src/app/App.tsx` confirms declarative routing (`<BrowserRouter>`, `<Routes>`, `<Route>`).
   - Repository-wide code inspection confirms zero invocations of `useNavigate()` or dynamic redirect functions.
   - Exactly one `<Link>` element exists in `apps/web/src/pages/NotFoundPage.tsx`: `<Link to="/">Return to Home</Link>`, which points to a hardcoded string literal.
   - No URL search parameters (`location.search`), form inputs, or external payloads flow into any navigation or redirect sink.
10. **Residual Risk:** Residual risk is minimal in the current codebase. If future development introduces dynamic query-based redirects without destination validation, exposure could emerge.
11. **Recommended Action:** Retain temporarily; enforce destination allowlisting for future routes.
12. **Reason for Decision:** Upgrading to React Router v7 represents a major breaking framework migration. Given that no navigation sink accepts dynamic input in the current codebase, remaining on v6.30.6 is safe.

---

### Advisory 2: `react-router` — Arbitrary Constructor Injection via `deserializeErrors()` (`GHSA-337j-9hxr-rhxg`)
1. **GHSA Identifier:** `GHSA-337j-9hxr-rhxg` (Advisory Key: 1124272)
2. **Affected Package:** `react-router`
3. **Installed Vulnerable Version:** `6.30.6`
4. **Officially Fixed Version:** `>=7.18.0`
5. **Actual Dependency Paths (1 path):** `apps__web > react-router-dom@6.30.6 > react-router@6.30.6`
6. **Classification:** Transitive production dependency (client SPA bundle).
7. **Runtime / Build / Dev Exposure:** Bundled into client SPA assets; zero server-side rendering execution.
8. **Required Attack Conditions:** Requires Server-Side Rendering (SSR) hydration where a crafted serialized error payload is sent from the server and deserialized via `deserializeErrors()` during client hydration.
9. **Repository-Specific Evidence:**
   - `apps/web/src/main.tsx` mounts the application via standard client-side DOM rendering: `createRoot(document.getElementById("root")!).render(...)`.
   - The repository contains zero SSR servers, zero Remix framework adapters, and zero hydration streaming protocols (`hydrateRoot` is not invoked).
   - `deserializeErrors()` is never executed.
10. **Residual Risk:** Zero in the current architecture. Would only become relevant if the web application were re-architected to an SSR framework.
11. **Recommended Action:** Retain temporarily.
12. **Reason for Decision:** The reviewed production build does not implement SSR or client hydration error streams.

---

### Advisory 3: `vitest` — Path Traversal / Arbitrary File Read (`GHSA-82fw-gwwq-j7x9`)
1. **GHSA Identifier:** `GHSA-82fw-gwwq-j7x9` (Advisory Key: 1193683)
2. **Affected Package:** `vitest`
3. **Installed Vulnerable Version:** `3.2.7`
4. **Officially Fixed Version:** `>=4.1.11`
5. **Actual Dependency Paths (4 paths):** `packages__contracts > vitest`, `apps__api > vitest`, `apps__web > vitest`, `apps__mobile > vitest`.
6. **Classification:** Direct development dependency.
7. **Runtime / Build / Dev Exposure:** Excluded from production builds (`apps/api/dist/server.js`, `apps/web/dist/`, mobile bundles). Executes exclusively in local developer and CI test runners.
8. **Required Attack Conditions:** Requires an attacker-controlled mock redirect configuration in `@vitest/mocker` to traverse the local filesystem.
9. **Repository-Specific Evidence:**
   - Inspection of all four configuration files (`vitest.config.ts`) confirms standard configuration (`globals: true`, `environment: "node"`).
   - Neither `mockerPlugin` nor custom redirect mocks are configured or invoked.
   - Tests execute in headless batch CLI mode (`vitest run`).
10. **Residual Risk:** Residual development/build-environment risk remains if an adversarial test script or untrusted pull request introduces malicious redirect mocks.
11. **Recommended Action:** Retain v3.2.7; isolate CI test execution.
12. **Reason for Decision:** The reviewed production builds do not include Vitest. Vitest 3.2.7 is required for Node.js 26 compatibility across monorepo workspaces until upstream plugins support Vitest 4.

---

### Advisory 4: `@vitest/mocker` — Path Traversal / Arbitrary File Read (`GHSA-82fw-gwwq-j7x9`)
1. **GHSA Identifier:** `GHSA-82fw-gwwq-j7x9` (Advisory Key: 1193684)
2. **Affected Package:** `@vitest/mocker`
3. **Installed Vulnerable Version:** `3.2.7`
4. **Officially Fixed Version:** `>=4.1.11`
5. **Actual Dependency Paths (4 paths):** Transitive via `vitest@3.2.7` across 4 workspaces.
6. **Classification:** Transitive development dependency.
7. **Runtime / Build / Dev Exposure:** Development and CI environments only.
8. **Required Attack Conditions:** Same as Advisory 3.
9. **Repository-Specific Evidence:** Same as Advisory 3; `@vitest/mocker` is an internal dependency of Vitest and is not directly imported or exposed to untrusted clients.
10. **Residual Risk:** Confined to local developer and CI test runner environments.
11. **Recommended Action:** Retain v3.2.7.
12. **Reason for Decision:** Excluded from production distributions; governed by CI isolation.

---

### Advisory 5: `@vitest/mocker` — Code Injection via Unauthenticated Mock Registration (`GHSA-qxg6-89mg-rqv8`)
1. **GHSA Identifier:** `GHSA-qxg6-89mg-rqv8` (Advisory Key: 1242767)
2. **Affected Package:** `@vitest/mocker`
3. **Installed Vulnerable Version:** `3.2.7`
4. **Officially Fixed Version:** `>=4.1.12`
5. **Actual Dependency Paths (4 paths):** Transitive via `vitest@3.2.7` across 4 workspaces.
6. **Classification:** Transitive development dependency.
7. **Runtime / Build / Dev Exposure:** Development and CI environments only.
8. **Required Attack Conditions:** Requires an exposed Vitest API server or WebSocket endpoint listening on an accessible network interface where an untrusted client can send unauthenticated mock registration RPCs.
9. **Repository-Specific Evidence:**
   - All workspace test tasks run via `vitest run` (batch execution).
   - In all four `vitest.config.ts` files, `api: false` and `ui: false` (default). No HTTP or WebSocket API server is started.
   - No exposed development server was identified in the tested execution configuration.
10. **Residual Risk:** Low. If a developer explicitly runs `vitest --api` or `vitest --ui` on a public or shared network, exposure could exist on that workstation.
11. **Recommended Action:** Retain v3.2.7; document compensating control prohibiting `--api` on shared networks.
12. **Reason for Decision:** No API server is listening in standard repository scripts or CI workflows.

---

### Advisory 6: `glob` — `AbortSignal` Traversal Bypass (`GHSA-3g3m-2fjr-6pw4`)
1. **GHSA Identifier:** `GHSA-3g3m-2fjr-6pw4` (Advisory Key: 1244013)
2. **Affected Package:** `glob`
3. **Installed Vulnerable Versions:** `10.5.0` (4 paths via `rimraf`), `13.0.6` (34 paths via `@expo/cli` / `@expo/fingerprint`).
4. **Officially Fixed Version:** `>=14.0.2`
5. **Actual Dependency Paths (38 paths total):**
   - 4 paths: `packages__contracts > rimraf > glob`, `apps__web > rimraf > glob`, `apps__api > rimraf > glob`, root `rimraf > glob`.
   - 34 paths: `apps__mobile > expo > @expo/cli > glob`, `apps__mobile > expo > @expo/fingerprint > glob`, etc.
6. **Classification:** Transitive development and build-time dependency.
7. **Runtime / Build / Dev Exposure:** Executes during build, clean, and export scripts. Excluded from production server images and mobile runtime binaries.
8. **Required Attack Conditions:** Requires an asynchronous file search configured with an `AbortSignal` where an attacker causes a cancellation timeout and relies on file traversal terminating immediately.
9. **Repository-Specific Evidence:**
   - In `rimraf`, globbing executes synchronously or to completion against fixed local `dist/` directories.
   - In `@expo/cli`, globbing discovers source and native asset files within the committed repository.
   - No glob search roots or search patterns are sourced from untrusted external user input.
   - No `AbortSignal` cancellation timeouts are passed to `glob` in repository tooling.
10. **Residual Risk:** Confined to developer workstation and CI build processes.
11. **Recommended Action:** Retain current versions.
12. **Reason for Decision:** `glob@13.0.6` is deeply pinned by `@expo/cli` in Expo SDK 58. Forcing v14 breaks Expo build tool compatibility. Production exposure is absent.

---

### Advisory 7: `minimatch` — ReDoS via Globparts Amplification (`GHSA-g3hv-75wg-m249`)
1. **GHSA Identifier:** `GHSA-g3hv-75wg-m249` (Advisory Key: 1244623)
2. **Affected Package:** `minimatch`
3. **Installed Vulnerable Versions:** `9.0.9` (4 paths via `rimraf > glob`), `10.2.6` (102 paths via `@eslint/js`, `typescript-eslint`, `@expo/cli`).
4. **Officially Fixed Version:** `>=11.0.1`
5. **Actual Dependency Paths (106 paths total):**
   - 4 paths via `rimraf > glob > minimatch`.
   - 102 paths via ESLint flat configuration ecosystem and `@expo/cli`.
6. **Classification:** Transitive development and build-time dependency.
7. **Runtime / Build / Dev Exposure:** Executes during linting (`eslint`) and asset bundling. Excluded from production server images and mobile runtime binaries.
8. **Required Attack Conditions:** Requires an attacker to provide crafted, heavily nested glob pattern strings that cause catastrophic exponential backtracking in `minimatch()`.
9. **Repository-Specific Evidence:**
   - All glob patterns evaluated by `minimatch` in this repository are hardcoded static configuration literals in `eslint.config.js` and `tsconfig.json`.
   - No runtime HTTP endpoints or mobile interfaces accept or evaluate glob patterns.
10. **Residual Risk:** Residual risk is limited to potential ReDoS if an adversarial contributor commits a crafted glob pattern to repository configuration.
11. **Recommended Action:** Retain current versions.
12. **Reason for Decision:** `minimatch@10.2.6` is pinned across the ESLint 10 and Expo SDK 58 ecosystems. Overriding to v11 breaks peer dependencies.

---

## 4. Multi-Environment Exposure Matrix

| Environment Surface | `react-router` | `vitest` & `@vitest/mocker` | `glob` | `minimatch` |
| :--- | :--- | :--- | :--- | :--- |
| **Production Backend (`apps/api`)** | Not present | Not present in build | Not present in build | Not present in build |
| **Production Web (`apps/web`)** | Present in client SPA; no dynamic sinks or SSR | Not present in build | Not present in build | Not present in build |
| **Production Mobile (`apps/mobile`)** | Not present | Not present in build | Not present in runtime bundle | Not present in runtime bundle |
| **Developer Workstation** | Client SPA only; no untrusted redirects | Headless CLI batch mode; no API server listening | Fixed repository source files; no abort timeouts | Fixed config pattern strings in ESLint/Metro |
| **CI Runner** | Client SPA only; isolated runner | Headless batch execution; isolated runner | Clean and export tasks evaluate local checkout | Evaluates committed static source files |
| **Development Server (`pnpm dev`)** | Vite SPA dev server; zero SSR streams | Vitest UI/API server not launched | No search endpoints accept glob queries | No endpoints accept pattern inputs |
| **Build Process (`pnpm build`)** | Vite bundles static assets; zero hydration streams | Tests not invoked during `turbo build` | Executes during `expo export` on local files | Evaluates static ESLint and Metro regexes |

---

## 5. Formal Conclusion & Residual Risk Statement

Based upon empirical repository inspection:
1. **Production Exposure:** Only `react-router` is present in production distributions (specifically, the client-side SPA bundle of `apps/web`). Because `apps/web` uses Declarative Mode with a single static link and zero SSR hydration, the vulnerable code paths are not reachable by external actors.
2. **Development & CI Exposure:** `vitest`, `@vitest/mocker`, `glob`, and `minimatch` are confined to developer workstations and CI runners. In tested execution configurations, no network-bound API servers or unauthenticated mock registration endpoints are exposed.
3. **Residual Risk:** Residual development/build-environment risk remains bounded to the hypothetical introduction of adversarial test mocks or malicious configuration patterns via untrusted pull requests.
4. **Governing Recommendation:** Retain the current dependency baseline for Phase 1A-R acceptance; review upstream patches during scheduled maintenance cycles.

