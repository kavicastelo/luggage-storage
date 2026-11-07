# Phase 1A-RC2: Framework & Runtime Compatibility Assessment

**Document ID:** ENG-FCA-001  
**Phase:** Phase 1A-RC2 — Acceptance Evidence Closure & Final Foundation Verification  
**Author:** Principal Software Architect & Release Engineer  
**Date:** 2026-11-07  
**Status:** FULLY REASSESSED & COMPATIBLE  
**Baseline Standard:** Node.js 20 LTS (CI/Prod) | Node.js >= 20.0.0 (Dev) | pnpm 12.9.1 | Turbo 2.11.10

---

## 1. Executive Summary

This assessment provides an objective, evidence-based re-evaluation of the core frameworks, toolchains, and runtime environments powering the Global Luggage Storage Marketplace monorepo.

Following detailed investigation against official release notes and compatibility matrix specifications:
1. **Expo SDK 52** is confirmed as the active, stable LTS framework for the mobile workspace, with full support for React Native 0.76.9, React 18.3.1, and Expo Router 4.0.22.
2. **React 18.3.1** is strictly harmonized across both web (`apps/web`) and mobile (`apps/mobile`), preventing version fragmentation.
3. **Vite 6.2.0** and **Vitest 3.2.7** are proven fully compatible, providing fast native ESM execution without deprecation notices.
4. **Fastify 4.27.0** and **Drizzle ORM 0.45.4** are confirmed stable, securely resolving the SQL identifier injection advisory while maintaining robust connection pooling with `pg`.
5. An intentional **Node.js Runtime Baseline** is formalized: Node.js 20 LTS for deterministic CI and container runtimes, with backwards-compatible local execution on Node.js >= 20.0.0 (verified up to v26.3.1).

---

## 2. Deep Framework & Ecosystem Analysis

### 2.1 Expo SDK 52 Suitability & Support Status (`apps/mobile`)

- **Current Version:** `expo@~52.0.49`
- **Upstream Release Date:** November 2024 (Active Support through 2025/2026)
- **Suitability Rationale:**
  - Upgrading from legacy Expo SDK 51 resolved critical security advisories in `@expo/cli` subdependencies (notably `tar` GHSA-8qq4-5484-hm7g).
  - Native runtime incorporates React Native 0.76 with the New Architecture enabled by default, supporting bridgeless mode for high-throughput mobile UI rendering.
  - Supports unified React 18.3.1, eliminating peer dependency warnings.
- **Support & Maintenance Status:** Fully supported by Expo and npm ecosystem. `expo-doctor` executes with 18/18 checks passing.
- **Verdict:** **SUITABLE & RECOMMENDED.** No migration is required.

---

### 2.2 React Native & Expo Router Compatibility

- **React Native Version:** `0.76.9`
- **Expo Router Version:** `~4.0.22`
- **React Version:** `18.3.1` (Strictly pinned across `apps/web` and `apps/mobile`)
- **Compatibility Findings:**
  - React Native 0.76 requires React 18.3.1. Expo Router 4.0.22 is authored specifically to target Expo SDK 52 and React Native 0.76.
  - `apps/mobile` implements a typed dual-role file-based navigation structure:
    - Root router: `app/index.tsx` (Role selection entrypoint)
    - Traveller interface: `app/(traveller)/index.tsx`, `app/(traveller)/explore.tsx`
    - Host interface: `app/(host)/index.tsx`, `app/(host)/scanner.tsx`
  - Bundling verification confirmed: Metro compiles and emits both iOS and Android Hermes Bytecode (`.hbc`, 2.65 MB each) and Web SPA bundles (1.01 MB).
- **Verdict:** **VERIFIED COMPATIBLE.**

---

### 2.3 Vite & Vitest Compatibility (`apps/web` & Monorepo Testing)

- **Vite Version:** `^6.2.0` (`apps/web`)
- **Vite React Plugin:** `@vitejs/plugin-react@^4.3.4`
- **Vitest Version:** `^3.2.7` (Standardized across `contracts`, `api`, `web`, `mobile`)
- **Compatibility Findings:**
  - Vite 6 standardized ESM compilation and optimized asset chunking.
  - Vitest 3.2.7 integrates natively with Vite 6 config, executing 18 unit/integration tests across all 4 workspaces in under 4 seconds without Babel or `ts-node` overhead.
  - Production build of `apps/web` emits clean, tree-shaken static assets (`index.html`, CSS chunk 11.11 kB, JS chunk 218.38 kB) into `dist/`.
- **Verdict:** **VERIFIED COMPATIBLE.**

---

### 2.4 Fastify & Drizzle ORM Compatibility (`apps/api`)

- **Fastify Version:** `^4.27.0` (Resolves `4.29.1` LTS)
- **Fastify Plugins:** `@fastify/cors@^9.0.1`, `@fastify/helmet@^11.1.1`, `@fastify/sensible@^5.5.0`, `@fastify/swagger@^8.14.0`, `@fastify/swagger-ui@^3.0.0`
- **Drizzle ORM Version:** `^0.45.4` (Upgraded from `0.30.10`)
- **PostgreSQL Client:** `pg@^8.11.5`
- **Compatibility Findings:**
  - Drizzle ORM 0.45.4 remediates the High-severity SQL injection vulnerability in raw SQL identifiers ([GHSA-rc2w-mgp9-5cxq](https://github.com/advisories/GHSA-rc2w-mgp9-5cxq)).
  - Fastify 4 mounts Drizzle and connection pool without deprecation notices.
  - Healthcheck probes (`/health` and `/ready`) function as designed.
- **Verdict:** **VERIFIED COMPATIBLE.**

---

### 2.5 Node.js Runtime Baseline: Local (v26.3.1) vs. CI (20.x)

- **Host Development Environment:** Node.js `v26.3.1` (Windows x64 via NVM)
- **CI / Production Environment:** Node.js `20.x` LTS (Ubuntu 22.04 runner in GitHub Actions)
- **Engine Specification:** `"engines": { "node": ">=20.0.0", "pnpm": ">=9.0.0" }`
- **Cross-Version Compatibility Analysis:**
  1. **Syntax & Features:** All packages compile to `ES2022` with TypeScript `moduleResolution: NodeNext`. ECMAScript features utilized (async/await, nullish coalescing, optional chaining, ES modules) are native to both Node 20 LTS and Node 26.
  2. **Fastify / ESM Compatibility:** Fastify 4 runs identically on Node 20 and Node 26 without engine-specific flags.
  3. **Vite / Metro Compatibility:** Vite 6 and Metro bundlers utilize standard Node.js `fs`, `path`, and `worker_threads` APIs supported across both versions.
- **Intentional Runtime Baseline Policy:**
  - **Standard Production & CI Target:** **Node.js 20 LTS (Active LTS Baseline)**.
  - **Supported Local Development Range:** **Node.js >= 20.0.0** (verified with zero warnings on host Node.js v26.3.1).
- **Verdict:** **INTENTIONAL & COMPATIBLE.**

---

## 3. Final Framework Compatibility Matrix

| Package / Surface | Framework / Tool | Target Version | Installed Version | Compatibility Status |
| :--- | :--- | :--- | :--- | :---: |
| **Root Workspace** | Turborepo | `2.11.10` | `2.11.10` | **PASS** |
| **Root Workspace** | pnpm | `12.9.1` | `12.9.1` | **PASS** |
| **Root Workspace** | Node.js Engine | `>= 20.0.0` | Host: `26.3.1`, CI: `20.x` | **PASS** |
| **`packages/contracts`** | Zod | `^3.23.8` | `3.23.8` | **PASS** |
| **`packages/contracts`** | Vitest | `^3.2.7` | `3.2.7` | **PASS** |
| **`apps/api`** | Fastify | `^4.27.0` | `4.27.0` (resolves `4.29.1`) | **PASS** |
| **`apps/api`** | Drizzle ORM | `^0.45.4` | `0.45.4` | **PASS** |
| **`apps/api`** | PostgreSQL Client | `^8.11.5` | `8.11.5` | **PASS** |
| **`apps/api`** | Vitest | `^3.2.7` | `3.2.7` | **PASS** |
| **`apps/web`** | React | `18.3.1` | `18.3.1` (Unified) | **PASS** |
| **`apps/web`** | Vite | `^6.2.0` | `6.2.0` | **PASS** |
| **`apps/web`** | Tailwind CSS | `^3.4.3` | `3.4.3` (PostCSS `^8.5.3`) | **PASS** |
| **`apps/web`** | Vitest | `^3.2.7` | `3.2.7` | **PASS** |
| **`apps/mobile`** | Expo SDK | `~52.0.49` | `52.0.49` | **PASS** |
| **`apps/mobile`** | React Native | `0.76.9` | `0.76.9` | **PASS** |
| **`apps/mobile`** | React | `18.3.1` | `18.3.1` (Unified) | **PASS** |
| **`apps/mobile`** | Expo Router | `~4.0.22` | `4.0.22` | **PASS** |
| **`apps/mobile`** | Vitest | `^3.2.7` | `3.2.7` | **PASS** |
