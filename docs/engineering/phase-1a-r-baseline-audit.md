# Engineering Foundation Baseline Audit (Phase 1A-R)

**Document ID:** ENG-AUD-001  
**Project:** Global Luggage Storage Marketplace  
**Phase:** Phase 1A-R — Foundation Stabilization & Independent Verification  
**Author:** Independent QA Auditor & Principal Software Architect  
**Date of Audit:** 2026-11-07  
**Status:** BASELINE ESTABLISHED  

---

## 1. Executive Summary

An independent baseline audit was conducted on the initial engineering foundation committed during Phase 1A. The audit inspected the repository structure, package manifests, lockfiles, workspace configurations, build pipelines, dependency security vulnerabilities, and local container infrastructure.

### Key Audit Findings:
1. **Repository Topology:** The monorepo has 6 package/application workspaces plus root, managed via `pnpm-workspace.yaml` and `turbo.json`. All internal workspace references resolve via `workspace:*`.
2. **Framework Version Deficiencies:**
   - `apps/mobile` runs **Expo SDK 51** (`expo@~51.0.0`, `react-native@0.74.1`, `expo-router@~3.5.11`), which is outdated and carries deprecated Babel sub-dependencies.
   - `apps/web` runs **Vite 5.2.10** (`vite@^5.2.10`), which is behind modern Vite releases (Vite 6).
   - Test suites utilize **Vitest 1.6.1** (`vitest@^1.5.0`), which contains known critical security advisories (GHSA-37r6-xcm7-5r59).
3. **Security Vulnerabilities:** Initial `pnpm audit` reported **70 vulnerabilities** (4 critical, 37 high, 25 moderate, 4 low), largely rooted in outdated Expo 51 CLI dependencies (`tar`), old Vite sub-dependencies, and Vitest 1.6.1.
4. **Task Count Discrepancies in Phase 1A Report:**
   - *Typecheck:* Reported 5 successful tasks (`contracts:typecheck`, `contracts:build`, `web:typecheck`, `mobile:typecheck`, `api:typecheck`). The extra task occurred because `contracts:typecheck` declares `"dependsOn": ["^build"]` in `turbo.json`.
   - *Test:* Reported 3 successful tasks (`contracts:build`, `contracts:test`, `api:test`). `contracts:build` executed upstream because `contracts:test` depends on `^build`. `apps/web` and `apps/mobile` lacked `test` scripts, so Turborepo executed 0 tasks for them.
   - *Build:* Reported 3 successful tasks (`contracts:build`, `api:build`, `web:build`). `apps/mobile` had no `build` script in `package.json`, only `start`, `android`, `ios`, `web`.
5. **Local Infrastructure Status:** Docker CLI version 29.6.2 is installed, but the Docker Desktop daemon is not running on the Windows host (`open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`). Database connectivity tests require documented manual/automated repro procedures.

---

## 2. Monorepo Structure & Workspace Inventory

### Root & Workspaces
```
luggage-storage/
├── .github/workflows/ci.yml
├── .agents/engineering-agent-guidance.md
├── apps/
│   ├── api/                   (@luggage-storage/api)
│   ├── web/                   (@luggage-storage/web)
│   └── mobile/                (@luggage-storage/mobile)
├── packages/
│   ├── contracts/             (@luggage-storage/contracts)
│   ├── typescript-config/     (@luggage-storage/typescript-config)
│   └── eslint-config/         (@luggage-storage/eslint-config)
├── infrastructure/docker/docker-compose.yml
├── docs/                      (Architecture, Governance, Product, Engineering)
├── package.json               (luggage-storage root)
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.json
```

### Actual Workspace Inventory & Manifest Specifications

| Workspace | Package Name | Version | Dependencies Count (Prod/Dev) | Entrypoint |
| :--- | :--- | :--- | :--- | :--- |
| `root` | `luggage-storage` | 0.1.0 | 0 / 2 | N/A |
| `packages/contracts` | `@luggage-storage/contracts` | 0.1.0 | 1 / 4 | `dist/index.js` |
| `packages/typescript-config` | `@luggage-storage/typescript-config`| 0.1.0 | 0 / 0 | `base.json`, `node.json`, `react.json` |
| `packages/eslint-config` | `@luggage-storage/eslint-config` | 0.1.0 | 0 / 0 | `index.js` |
| `apps/api` | `@luggage-storage/api` | 0.1.0 | 11 / 7 | `dist/server.js` |
| `apps/web` | `@luggage-storage/web` | 0.1.0 | 10 / 8 | Vite bundle |
| `apps/mobile` | `@luggage-storage/mobile` | 0.1.0 | 12 / 5 | `expo-router/entry` |

---

## 3. Dependency Inventory & Version Baseline

### Core Frameworks & Tooling
- **Node.js:** v26.3.1 (host machine)
- **pnpm:** 12.9.1
- **Turborepo:** 2.11.10
- **TypeScript:** 5.4.5 (packages) / 5.9.3 (root dev)
- **Fastify:** 4.27.0
- **Drizzle ORM:** 0.30.10
- **React (Web):** 18.3.1
- **React (Mobile):** 18.2.0 (mismatched with web)
- **Vite:** 5.2.10
- **Expo SDK:** 51.0.0 (`react-native@0.74.1`, `expo-router@~3.5.11`)
- **Tailwind CSS:** 3.4.3
- **Zod:** 3.23.8
- **Vitest:** 1.5.0 / 1.6.1

---

## 4. Script Matrix & Task Execution Analysis

### Current Workspace Scripts

| Workspace | `build` | `typecheck` | `test` | `lint` | `dev` | `clean` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `root` | `turbo build` | `turbo typecheck` | `turbo test` | `turbo lint` | `turbo dev` | `turbo clean` |
| `contracts` | `tsc` | `tsc --noEmit` | `vitest run` | ❌ | ❌ | `rimraf dist` |
| `typescript-config` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `eslint-config` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `api` | `tsc` | `tsc --noEmit` | `vitest run` | ❌ | `tsx watch ...`| `rimraf dist` |
| `web` | `tsc && vite build`| `tsc --noEmit` | ❌ | ❌ | `vite` | `rimraf dist` |
| `mobile` | ❌ | `tsc --noEmit` | ❌ | ❌ | `expo start` | `rimraf .expo` |

### Reconciliation of Turborepo Task Counts
- In Turborepo, when a pipeline task declares `"dependsOn": ["^build"]`:
  - `pnpm typecheck` executed 5 tasks:
    1. `@luggage-storage/contracts:build` (dependency of downstream typechecks)
    2. `@luggage-storage/contracts:typecheck`
    3. `@luggage-storage/api:typecheck`
    4. `@luggage-storage/web:typecheck`
    5. `@luggage-storage/mobile:typecheck`
  - `pnpm test` executed 3 tasks:
    1. `@luggage-storage/contracts:build` (dependency of test)
    2. `@luggage-storage/contracts:test`
    3. `@luggage-storage/api:test`
    *(No test script in `apps/web` or `apps/mobile`)*
  - `pnpm build` executed 3 tasks:
    1. `@luggage-storage/contracts:build`
    2. `@luggage-storage/api:build`
    3. `@luggage-storage/web:build`
    *(No build script in `apps/mobile`)*

---

## 5. Security & Vulnerability Baseline (`pnpm audit`)

Baseline scan executed on 2026-11-07:
```
Total Vulnerabilities: 70
Low: 4 | Moderate: 25 | High: 37 | Critical: 4
```
### Critical & High Advisories Breakdown:
1. **GHSA-23hp-3jrh-7fpw (`tar` <=7.5.18):** Decompression/parse DoS via unlimited input. Present in Expo 51 CLI.
2. **GHSA-37r6-xcm7-5r59 (`vitest` <3.2.6):** Arbitrary file execution vulnerability when UI server is listening. Present in Vitest 1.5.0/1.6.1.
3. **GHSA-m6fv-jmc7-4pcq (`nanoid` <3.3.8):** Predictable token generation. Present in transitive dependencies.
4. **GHSA-gcqx-w48m-w2h4 (`deepmerge` >=4.2.0 <=4.3.1):** Prototype pollution via react-native-community/cli.

---

## 6. Infrastructure Baseline

- Docker Engine: 29.6.2 (client installed).
- Docker Engine Server: Daemon stopped / pipe unavailable.
- Container Spec: `infrastructure/docker/docker-compose.yml` (`postgis/postgis:16-3.4-alpine`, port 5432).
- Healthcheck: Configured via `pg_isready`.
- Required action for WP-05: Document Docker startup prerequisites, verify `/ready` error handling (503 Service Unavailable when DB is unreachable), and provide reproducible PostGIS SQL verification scripts.

---

## 7. Required Corrective Actions (WP-02 through WP-11)

1. **WP-02:** Upgrade Expo SDK 51 → Expo SDK 52 (compatible React Native 0.76+, Expo Router 4+, React 18.3.1).
2. **WP-02:** Upgrade Vite 5 → Vite 6 (or latest stable Vite release) with `@vitejs/plugin-react` and Vitest 2/3.
3. **WP-02:** Upgrade Vitest to remediate critical security vulnerabilities.
4. **WP-03:** Add missing scripts (`test` in `apps/web`, `export`/`build` in `apps/mobile`, `lint` in apps and packages).
5. **WP-03:** Create root `pnpm verify` script coordinating `lint`, `typecheck`, `test`, and `build`.
6. **WP-04:** Expand backend tests to verify `/health` (liveness), `/ready` (dependency readiness and failure modes), invalid Zod payloads, and correlation IDs.
7. **WP-05:** Document PostGIS verification procedure and verify `/ready` fails safely when database is offline.
8. **WP-06:** Add comprehensive contract validation tests in `packages/contracts`.
9. **WP-07:** Add UI and store unit tests in `apps/web`.
10. **WP-08:** Run Expo diagnostics (`npx expo-doctor`, bundle export verification).
11. **WP-09:** Update `.github/workflows/ci.yml` with strict frozen-lockfile validation.
12. **WP-10:** Re-run `pnpm audit` and document residual security status.
13. **WP-11:** Produce comprehensive completion report `phase-1a-r-completion-report.md`.
