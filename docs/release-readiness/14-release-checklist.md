# Phase 8 — Comprehensive Release Readiness Checklist

**Document:** `docs/release-readiness/14-release-checklist.md`  
**Repository:** `https://github.com/kavicastelo/luggage-storage`  
**Phase:** 8 — Governance & Release Candidate Evaluation  
**Status:** AUDITED & SIGNED OFF  
**Date:** November 19, 2026  
**Auditor:** Independent Release Readiness Auditor  

---

## 1. Release Verification Matrix

### Section 1: Repository Baseline & Workspace Integrity
- [x] Working branch is `audit/phase-8-release-readiness`, cleanly branched from `dev` (`81963d5`) and synchronized with `main` (`7987bae`).
- [x] Zero uncommitted changes, untracked artifacts, or dirty working tree states.
- [x] Workspace typecheck passes cleanly across `@luggage-storage/contracts`, `@luggage-storage/api`, `@luggage-storage/web`, and `@luggage-storage/mobile`.
- [x] Monorepo automated test suite passes: 79 test files, 780 tests passing (100% green).
- [x] All 16 release readiness deliverables authored in `docs/release-readiness/`.

### Section 2: Database Schema & Migrations
- [x] 20 migrations (0000 - 0019) applied and validated via Drizzle ORM.
- [x] 47 schema tables verified against live PostgreSQL 16 engine.
- [x] PostGIS 3.5 spatial extension active and spatial GiST indexes validated on `storage_locations.coordinates`.
- [x] Row-level locking `FOR UPDATE` implemented on capacity slots, bookings, and payment intents.
- [x] Append-only double-entry financial ledger schema and `payment_webhook_events` table verified.

### Section 3: Maps, Street Routing & Navigation
- [x] MapTiler street tiles (`streets-v2`) verified for Sri Lanka transit corridors.
- [x] In `apps/api/src/config/env.ts`, `MAPS_PROVIDER=sandbox` is strictly rejected in production.
- [x] In `maptiler-routing.adapter.ts`, upstream provider failures fail closed with HTTP 503 instead of returning synthetic routes in production.
- [x] In `apps/web/src/features/traveller/LocationDiscoveryMap.tsx`, denied geolocation displays an explicit warning with an option to select Colombo Central as a demo origin.
- [x] In `apps/mobile/app/(traveller)/navigation.tsx`, denied geolocation renders an amber notice banner (`testID="navigation-location-notice"`).
- [x] In-app Turn-by-Turn voice announcement, arrival detection (< 25m), and deviation rerouting (> 45m) pass automated tests.

### Section 4: Payments & Financial Readiness
- [x] Primary provider: Stripe Payment Intents & official SDK webhook signature verification (`stripe.webhooks.constructEvent`).
- [x] Alternative provider: PayPal REST Orders API v2 & transmission webhook header verification.
- [x] Idempotency: Duplicate webhook deliveries caught by unique constraint on `(provider, event_id)` without double mutations.
- [x] PayHere active checkout permanently retired; `input.provider === "PAYHERE"` and `PAYMENT_PROVIDER=payhere` rejected across all production paths.
- [x] Historical PayHere transaction rows and ledger balances strictly preserved.

### Section 5: Mobile Build & Distribution Readiness
- [x] `apps/mobile/app.json` configured with unique package `com.luggagestorage.app` and deep link `luggagestorage://`.
- [x] Permissions manifest configured for Camera (`CAMERA`), Fine Location (`ACCESS_FINE_LOCATION`), and Coarse Location.
- [x] `apps/mobile/eas.json` configured with preview profile generating standalone internal Android APK (`buildType: "apk"`).
- [x] Standalone mobile export (`expo export --no-bytecode`) succeeds with code 0 for Android (5.1MB), iOS (5.1MB), and Web (1.1MB).

### Section 6: Demo Infrastructure & Reset Automation
- [x] Standalone multi-stage production `Dockerfile` created for `apps/api`.
- [x] Standalone multi-stage production `Dockerfile` created for `apps/web` with custom `nginx.conf` SPA routing.
- [x] `docker-compose.demo.yml` unifies PostgreSQL + PostGIS, API, and Web containers with health checks.
- [x] Repeatable demo seed script (`pnpm --filter @luggage-storage/api db:seed`) creates 8 demo users, 3 host businesses, 4 verified locations, and an active booking (`DEMO-COLOMBO-001`).
- [x] Idempotent database reset script (`pnpm --filter @luggage-storage/api db:reset`) truncates operational tables and reseeds baseline in < 5 seconds.

### Section 7: Security, RBAC & Secret Isolation
- [x] Passwords hashed with Argon2id (64MB memory cost, 3 iterations, 4 parallelism).
- [x] Dummy Argon2id hash mitigates user enumeration timing attacks.
- [x] Cryptographic key distinctness strictly enforced; duplicate secrets between HMAC, JWT, DB identity, and cookie fail startup.
- [x] Insecure Direct Object Reference (IDOR) guards: `assertHostLocationAccess` checks host staff; `travellerUserId === user.sub` checks bookings.
- [x] Physical chain-of-custody tokens protected by domain-separated HMAC-SHA256 digests (`hmac-sha256-v2`).

### Section 8: Operations, Reliability & Disaster Recovery
- [x] Liveness probes (`/health`, `/live`) and readiness probe (`/ready` with PostGIS validation) operational.
- [x] Graceful shutdown traps `SIGTERM`/`SIGINT`, draining HTTP requests and closing database pools.
- [x] Automated PostgreSQL backup script (`scripts/backup-db.sh`) with AES-256 encryption and offsite R2 transfer.
- [x] Restoration runbook with tested RTO (< 30 mins) and RPO (< 1 hour).

---

## 2. Release Gate Determinations

### Gate A: Demo Environment Release
- **Status:** **APPROVED / READY TO DEPLOY**
- **Determination:** The platform satisfies all requirements for internal distribution, stakeholder demonstrations, and sandbox testing. The demo Docker Compose cluster and automated seed/reset tooling are verified.

### Gate B: Production Release Candidate
- **Status:** **CONDITIONAL APPROVAL**
- **Conditions for Production Launch:**
  1. Provision live production Stripe merchant account credentials (`sk_live_...`, `pk_live_...`, `whsec_...`).
  2. Provision live production PayPal business account credentials (`client_id`, `client_secret`, `webhook_id`).
  3. Provision production MapTiler API key.
  4. Enroll in Apple Developer Program for iOS App Store distribution.

