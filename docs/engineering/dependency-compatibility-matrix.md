# Engineering Governance — Dependency Compatibility Matrix

**Document ID:** `ENG-DEP-001`  
**Project:** Global Luggage Storage Marketplace  
**Phase:** Project Stabilization — Reconciled Manifest & Lockfile Baseline  
**Date:** 2026-11-09  
**Status:** `APPROVED & SYNCHRONIZED WITH WORKSPACE MANIFESTS`

---

## 1. Executive Summary

This matrix records the exact, verified dependency baseline across the Global Luggage Storage Marketplace monorepo (`package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, and all workspace manifests under `apps/*` and `packages/*`). It reconciles earlier Phase 1A-RC2 documentation with the actual Phase 1A-RC3 / Phase 1B / Phase 2 installed versions (`REM-A02`).

---

## 2. Synchronized Framework & Ecosystem Matrix

| Technology / Package | Initial Baseline (1A) | Actual Installed Manifest Version | Workspace Scope | Architectural Role & Compatibility Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Node.js Runtime** | `>= 20.0.0` | **`>= 26.0.0`** (`v26.3.1` active) | Monorepo root (`engines.node`) | Active development & verification runtime (`NodeNext` ESM resolution). |
| **pnpm** | `12.9.1` | **`12.9.1`** (`>= 9.0.0` engine) | Root (`packageManager`) | Workspace dependency manager with strict lockfile resolution. |
| **Turborepo** | `^2.0.0` | **`^2.0.0`** (resolves `2.11.10`) | Root (`turbo`) | Monorepo task orchestrator (`lint`, `typecheck`, `test`, `build`, `verify`). |
| **TypeScript** | `^5.4.5` | **`^5.4.5`** (`root`, `api`, `web`, `contracts`) / **`~6.0.3`** (`mobile`) | All workspaces | Strict type checking (`strict: true`, `noUncheckedIndexedAccess: true`). |
| **ESLint** | `^9.x` | **`10.14.0`** (`@eslint/js: ^10.0.1`, `typescript-eslint: ^8.72.1`) | Root & all workspaces | Unified flat config via `@luggage-storage/eslint-config`. |
| **Vitest** | `^1.5.0` | **`^3.2.7`** | `contracts`, `api`, `web`, `mobile` | Standardized ESM test runner across all 4 packages. |
| **Zod** | `^3.23.8` | **`^4.6.7`** | `contracts`, `api`, `web`, `mobile` | Shared runtime validation & schema inference across all boundaries. |
| **Fastify** | `^4.27.0` | **`^5.2.1`** | `apps/api` | Modular monolith HTTP server (`@fastify/cookie@^11.1.5`, `@fastify/cors@^11.0.0`, `@fastify/helmet@^13.0.0`, `@fastify/jwt@^10.2.7`, `@fastify/sensible@^6.0.0`, `@fastify/swagger@^9.4.0`, `@fastify/swagger-ui@^6.1.3`). |
| **Drizzle ORM** | `^0.30.10` | **`^0.45.4`** (`drizzle-kit: ^0.31.11`) | `apps/api` | Type-safe PostgreSQL & PostGIS ORM and migration toolkit. |
| **Argon2** | `^0.40.0` | **`^0.45.2`** | `apps/api` | OWASP-compliant `Argon2id` password hashing. |
| **React (Web)** | `18.3.1` | **`^18.3.1`** (`react-dom: ^18.3.1`) | `apps/web` | Web UI runtime paired with `react-router-dom@^6.23.0`. |
| **Vite** | `^5.2.10` | **`^6.2.0`** (`@vitejs/plugin-react: ^4.3.4`) | `apps/web` | Web bundler and dev server. |
| **Tailwind CSS** | `^3.4.3` | **`^3.4.3`** (`postcss: ^8.5.3`, `autoprefixer: ^10.4.19`) | `apps/web` | Utility-first styling with shadcn/ui component conventions. |
| **Expo SDK** | `~51.0.0` | **`~58.0.23`** (`expo-router: ~58.0.30`, `expo-secure-store: ^58.0.2`) | `apps/mobile` | Shared Traveller & Host mobile runtime and encrypted token storage. |
| **React Native** | `0.74.1` | **`0.88.1`** (`react: 19.3.0`, `react-native-web: ~0.21.4`) | `apps/mobile` | Native iOS/Android & web export runtime for Expo SDK 58. |
| **State & Query** | `^4.5.2` / `^5.32.0` | **`zustand: ^4.5.2`**, **`@tanstack/react-query: ^5.32.0`** | `apps/web` & `apps/mobile` | Client state management and server-state caching. |

---

## 3. Verification Checklist

- [x] Manifest versions in `package.json`, `apps/api/package.json`, `apps/web/package.json`, `apps/mobile/package.json`, and `packages/contracts/package.json` match Section 2 above.
- [x] `pnpm turbo run lint typecheck test build --force` executes cleanly across all 6 workspace packages.
