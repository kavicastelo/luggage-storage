# Phase 8.1 — Workstream 0: Baseline & Previous Findings Revalidation

**Document:** `docs/release-readiness/phase-8-1/01-baseline-and-findings.md`  
**Repository:** `https://github.com/kavicastelo/luggage-storage`  
**Phase:** 8.1 — Checkpoint 1 Baseline  
**Date:** November 19, 2026  
**Auditor:** Independent Release Readiness Lead  

---

## 1. Executive Summary

This document establishes the official starting baseline for Phase 8.1 by revalidating the repository state against all previous findings from the Phase 8 independent review. Every reported finding has been independently tested, verified, and cataloged in the Defect Register below.

---

## 2. Git & Monorepo Baseline

- **Repository HEAD:** Commit `0bcb745` (`feat(phase-8): independent release candidate audit, demo environment and production readiness remediation`)
- **Integration Branch:** `dev` (`81963d5` incorporating `main` `7987bae`)
- **Phase 8.1 Working Branch:** `release/phase-8-1-demo-readiness`
- **Monorepo Structure:**
  - `packages/contracts`: Core domain contracts, Zod schemas, error models, and financial precision types.
  - `apps/api`: Fastify 5 REST API, Drizzle ORM, PostGIS 3.5, Stripe & PayPal integrations, RBAC, and migration engine.
  - `apps/web`: React 18, Vite 6, Tailwind CSS, Lucide icons, React Router DOM (development port 5173).
  - `apps/mobile`: Expo SDK 58, React Native 0.88, Expo Router 58, React Native Web (development port 8081).
- **TypeScript Typecheck:** 0 errors across all 4 monorepo packages.
- **Test Suite Status:** 80 test files passing (795 tests) in isolated local environments.

---

## 3. Comprehensive Defect Register & Findings Revalidation

### Finding F-01: Incompatible Demo Environment Variables & Production Validation
- **Severity:** P0 (Demo Blocker)
- **Status:** CONFIRMED UNRESOLVED
- **Relevant Files:** `apps/api/src/config/env.ts`, `infrastructure/docker/docker-compose.demo.yml`, `.envs/production.example`
- **Reproduction Steps:**
  1. Inspect `infrastructure/docker/docker-compose.demo.yml`. The API container is configured with `NODE_ENV: production`, `STORAGE_PROVIDER: memory`, `EMAIL_PROVIDER: ethereal`, `PAYMENT_PROVIDER: sandbox`, `DATABASE_SSL: "false"`.
  2. Start the API container or invoke `loadConfig()` with these environment variables.
  3. `EnvSchema.superRefine()` detects `NODE_ENV === "production"` and fails closed:
     - Rejects `STORAGE_PROVIDER: "memory"` (requires `r2`).
     - Rejects `PAYMENT_PROVIDER: "sandbox"` (simulated payments prohibited in production).
     - Rejects `DATABASE_SSL: "false"` (requires SSL in production).
     - Rejects `EMAIL_PROVIDER: "ethereal"` (requires `zoho` in production).
- **Impact:** Fastify crashes immediately on startup when attempting to run in demo mode under `NODE_ENV=production`.
- **Required Action:** Decouple runtime framework performance (`NODE_ENV=production`) from deployment environment validation via `APP_ENV: z.enum(["development", "test", "demo", "production"])`. Define strict `demo` environment rules permitting sandbox providers while enforcing non-default secrets, and preserve 100% of production hardening when `APP_ENV === "production"`.

---

### Finding F-02: Incomplete Interactive Map Implementation (SVG Canvas Reliance)
- **Severity:** P1 for initial demo; P0 for real navigation promise
- **Status:** CONFIRMED UNRESOLVED
- **Relevant Files:** `apps/web/src/features/traveller/LocationDiscoveryMap.tsx`, `apps/mobile/src/components/maps/InteractiveMobileMap.tsx`
- **Reproduction Steps:**
  1. Inspect `LocationDiscoveryMap.tsx` lines 300–338. The component renders an SVG `<svg viewBox="0 0 100 100">` with projected grid lines and SVG `<path>` polylines rather than rendering real MapLibre GL / MapTiler vector tiles.
  2. Inspect `InteractiveMobileMap.tsx` lines 113–145. The mobile map similarly renders `<Svg viewBox="0 0 100 100">` with mathematical coordinate projection.
- **Impact:** Visual appearance differs from a modern interactive map with street-level tiles, dynamic vector labeling, and standard pan/zoom gestures.
- **Required Action:**
  - For Web: Integrate an actual tile-based interactive map renderer (MapLibre GL JS with MapTiler or OSM raster/vector tiles) while preserving fallback capability when offline or when no API key is provided.
  - For Mobile: Provide a native-compatible map experience (WebView Leaflet/MapLibre or react-native-maps) that maintains clean Expo SDK 58 standalone EAS compilation.

---

### Finding F-03: Placeholder Expo/EAS Project Configuration
- **Severity:** P0 (Mobile Distribution Blocker)
- **Status:** CONFIRMED UNRESOLVED
- **Relevant Files:** `apps/mobile/app.json`, `apps/mobile/eas.json`
- **Reproduction Steps:**
  1. Inspect `apps/mobile/app.json` line 47: `"projectId": "local-phase-1a-placeholder"`.
  2. Inspect `apps/mobile/eas.json`. It lacks per-profile environment variable bindings (such as `EXPO_PUBLIC_API_URL` pointing to the AWS EC2 API endpoint).
- **Impact:** Running `eas build` will fail or produce an APK pointing to localhost.
- **Required Action:** Configure `eas.json` build profiles (`development`, `preview`, `production`) with explicit environment variables, deep linking, permissions, and document the exact linkage procedure to replace the placeholder ID upon user EAS authentication.

---

### Finding F-04: Missing Executable Backup & Recovery Scripts
- **Severity:** P1 (Demo), P0 (Production)
- **Status:** CONFIRMED UNRESOLVED
- **Relevant Files:** `scripts/backup-db.sh`, `scripts/restore-db.sh`, `docs/release-readiness/13-backup-and-recovery.md`
- **Reproduction Steps:**
  1. `docs/release-readiness/13-backup-and-recovery.md` references `scripts/backup-db.sh`.
  2. Inspect `scripts/` directory: only asset and capture scripts exist. Neither `backup-db.sh` nor `restore-db.sh` exists in the filesystem.
- **Impact:** Operational backup procedures cannot be executed or automated.
- **Required Action:** Implement fully functional, secure `scripts/backup-db.sh` and `scripts/restore-db.sh` supporting PostgreSQL 16 + PostGIS, SSL connections, GPG/OpenSSL encryption, and verify restoration against an isolated database.

---

### Finding F-05: Missing Migration Files in Compiled API Distribution
- **Severity:** P0 (EC2 API Deployment Blocker)
- **Status:** CONFIRMED UNRESOLVED (New Defect Discovered in Phase 8.1 Audit)
- **Relevant Files:** `apps/api/package.json`, `apps/api/src/infrastructure/database/migrate.ts`
- **Reproduction Steps:**
  1. Run `pnpm --filter @luggage-storage/api build`.
  2. `tsc` compiles TypeScript files to `apps/api/dist/`.
  3. Inspect `apps/api/dist/infrastructure/database/migrations`: the directory does NOT exist because TypeScript compiler does not copy `.sql` files.
  4. Running `node dist/server.js` or `migrate.js` from `dist` fails when loading migrations from `path.resolve(__dirname, "migrations")`.
- **Impact:** Direct compiled distribution on AWS EC2 fails during database migration checks.
- **Required Action:** Update `apps/api/package.json` build script to copy migration SQL files to `dist/infrastructure/database/migrations` and enhance `migrate.ts` to locate migrations robustly in both source and distribution trees.

---

### Finding F-06: No Independently Verified Staging/Demo Deployment
- **Severity:** P0 (Demo Release Blocker)
- **Status:** CONFIRMED UNRESOLVED
- **Relevant Files:** `infrastructure/docker/docker-compose.demo.yml`
- **Reproduction Steps:**
  1. No live AWS EC2 instance, Netlify sites, or Supabase database have been provisioned or verified.
- **Impact:** Platform cannot be demonstrated to stakeholders over the public internet.
- **Required Action:** Deploy API to AWS EC2 without Docker, deploy Web Application A (`apps/web`) and Web Application B (`apps/mobile` web) to Netlify, connect to Supabase PostgreSQL, and verify public HTTPS communication.

---

### Finding F-07: Documentation Inconsistencies & Local Path Links
- **Severity:** P2 (Maintainability)
- **Status:** CONFIRMED UNRESOLVED
- **Relevant Files:** `docs/release-readiness/*.md`
- **Reproduction Steps:**
  1. Previous documents contained absolute `file:///d:/luggage-storage/...` links that break when viewed outside the local development workstation.
  2. Documentation claimed verified backups when scripts were missing.
- **Impact:** Impairs portability and credibility of audit deliverables.
- **Required Action:** Use repository-relative links and ensure documentation precisely mirrors code reality under `docs/release-readiness/phase-8-1/`.

---

## 4. Defect Register Summary Table

| Finding ID | Title | Severity | Status | Workstream |
|---|---|---|---|---|
| **F-01** | Incompatible Demo Environment Validation | **P0** | Confirmed Unresolved | Workstream 1 |
| **F-02** | Incomplete Interactive Street-Map Implementation | **P1** | Confirmed Unresolved | Workstream 5 |
| **F-03** | Placeholder EAS Project Configuration | **P0** | Confirmed Unresolved | Workstream 6 |
| **F-04** | Missing Executable Backup & Restore Scripts | **P1** | Confirmed Unresolved | Workstream 8 |
| **F-05** | Missing Migration SQL Files in Compiled API Dist | **P0** | Confirmed Unresolved | Workstream 3 |
| **F-06** | Unverified Live Demo Deployment | **P0** | Confirmed Unresolved | Workstreams 2, 3, 4 |
| **F-07** | Documentation Inconsistencies & Absolute Links | **P2** | Confirmed Unresolved | Workstream 11 |

---

## 5. Baseline Approval

The baseline is verified and approved for remediation in Phase 8.1 without altering existing database schemas or core business logic.
