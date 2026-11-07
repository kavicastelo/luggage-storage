# Engineering Governance — Dependency Compatibility Matrix

**Document ID:** ENG-DEP-001  
**Project:** Global Luggage Storage Marketplace  
**Phase:** Phase 1A-RC2 — Acceptance Evidence Closure & Final Foundation Verification  
**Author:** DevOps Engineer & Senior TypeScript Engineer  
**Date:** 2026-11-07  
**Status:** APPROVED BASELINE (PHASE 1A-RC2 RECONCILED)

---

## 1. Executive Summary

This matrix establishes the verified, mutually compatible dependency baseline for the Global Luggage Storage Marketplace monorepo. During Phase 1A-R, 1A-RC, and 1A-RC2, framework updates were performed to eliminate deprecated sub-dependencies, remediate high-severity security vulnerabilities, unify React versions across web and mobile surfaces, and define an intentional Node.js baseline for CI and development.

---

## 2. Framework & Ecosystem Matrix

| Technology | Baseline Version (1A) | Upgraded Version (1A-RC2) | Compatibility Scope | Migration Rationale | Breaking Changes & Mitigations |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Node.js** | `>= 20.0.0` | **`20.x` (CI/Prod LTS)** / **`>= 20.0.0` (Dev)** | Monorepo root & all workspaces | Intentional LTS baseline | Host runs `v26.3.1`; CI runs `20.x`. NodeNext module resolution preserved across ESM/CJS boundaries. |
| **pnpm** | `12.9.1` | `12.9.1` | Root & pnpm-workspace | High-efficiency package manager | Pinned `packageManager: pnpm@12.9.1` in root `package.json`. |
| **Turborepo** | `^2.0.0` | `2.11.10` | Task orchestrator | High-velocity DAG build runner | Configured `turbo.json` with `lint`, `typecheck`, `test`, `build`, `verify`. Supports uncached execution via `--force`. |
| **TypeScript** | `^5.4.5` | `5.4.5` (Workspaces) / `5.9.3` (Root) | Shared via `@luggage-storage/typescript-config` | Strict type compiler | Strict mode enabled across all packages (`strict: true`, `noUncheckedIndexedAccess: true`). |
| **React** | `18.3.1` (Web) / `18.2.0` (Mobile) | **`18.3.1` (Strictly Unified)** | `apps/web` & `apps/mobile` | Eliminates version fragmentation | Expo 52 natively supports React 18.3.1. Unified types. |
| **React Native**| `0.74.1` | **`0.76.9`** | `apps/mobile` | Expo 52 official native runtime | Upgraded with Expo SDK 52. New Architecture ready. |
| **Expo SDK** | `~51.0.0` | **`~52.0.49`** | `apps/mobile` | Resolves CLI vulnerabilities (`tar`) | Upgraded Expo CLI and core plugins (`constants@17`, `linking@7`). |
| **Expo Router** | `~3.5.11` | **`~4.0.22`** | `apps/mobile` | File-based navigation | Preserved single-codebase Traveller/Host layout structure. |
| **Vite** | `^5.2.10` | **`^6.2.0`** | `apps/web` | Modern build bundler | Upgraded `@vitejs/plugin-react` to `^4.3.4`. NodeNext/ESM compatible. |
| **Vitest** | `^1.5.0` | **`^3.2.7`** | `contracts`, `api`, `web`, `mobile` | Test runner standardization | Fast native ESM test runner; 18 tests passing across 4 workspaces. |
| **Tailwind CSS**| `^3.4.3` | `^3.4.3` | `apps/web` | Utility styling | PostCSS overridden to `^8.5.3` (CVE-2023-44270 remediated). |
| **Fastify** | `^4.27.0` | `^4.27.0` (resolves `4.29.1`) | `apps/api` | Modular monolith HTTP engine | Stable LTS; Helmet, CORS, Swagger UI, Sensible integrated. |
| **Drizzle ORM** | `^0.30.10` | **`^0.45.4`** | `apps/api` | PostgreSQL / PostGIS ORM | Remediates High-severity SQL injection advisory GHSA-rc2w-mgp9-5cxq. |
| **Zod** | `^3.23.8` | `^3.23.8` | `contracts`, `api`, `web`, `mobile` | Schema validation | Runtime validation at all application boundaries. Fastify body limit (1MB) compensates DoS advisory. |

---

## 3. Dependency Overrides Baseline (`pnpm-workspace.yaml`)

```yaml
packages:
  - "apps/*"
  - "packages/*"
allowBuilds:
  esbuild: true
overrides:
  tar: ^7.5.22
  tinypool: ^2.2.0
  "@xmldom/xmldom": ^0.8.15
  postcss: ^8.5.3
  image-size: ^1.2.1
  decode-uri-component: ^0.5.1
```

---

## 4. Verification Checklist

- [x] `pnpm install` succeeds cleanly with zero peer dependency conflicts.
- [x] `pnpm lint` passes across all 4 workspaces (`contracts`, `api`, `web`, `mobile`).
- [x] `pnpm typecheck` passes across all 4 workspaces with strict TypeScript rules.
- [x] `pnpm test` executes and passes 18/18 tests across all 4 workspaces.
- [x] `pnpm build` executes and passes in all workspaces.
- [x] `pnpm verify` executes full quality gate pipeline without errors.
- [x] Uncached execution verified via `pnpm exec turbo run lint typecheck test build --force`.
