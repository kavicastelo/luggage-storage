# Phase 8 — Existing Findings Verification Report

**Document:** `docs/release-readiness/02-existing-findings-verification.md`  
**Repository:** `https://github.com/kavicastelo/luggage-storage`  
**Phase:** 8 — Independent Release Candidate Audit & Production Readiness  
**Target Branch:** `audit/phase-8-release-readiness`  
**Date:** November 19, 2026  
**Auditor:** Independent Release Readiness Auditor  

---

## 1. Objective & Methodology

Before implementing new release candidate remediations, all findings and historical resolutions from preceding phases (Phase 1 through Phase 7) were independently examined. Rather than relying on previous audit reports, each domain was directly verified by inspecting source code, running live tests, verifying database constraints, and validating runtime configurations.

Findings are categorized into:
- **VERIFIED RESOLVED:** Objectively verified with concrete tests and source evidence.
- **PARTIALLY RESOLVED / DRIFTED:** Resolved in earlier branches but requires production hardening or runtime refinement.
- **SUPERSEDED:** Made obsolete by subsequent architectural transformations.
- **UNRESOLVED / BLOCKER:** Active gaps requiring immediate remediation in Phase 8.

---

## 2. Verification Matrix of Historical Initiatives

### 2.1 Identity, Authentication & Session Security (Phase 1 & Phase 2)

| Previous Finding | Claimed Resolution | Independent Verification Status | Evidence / Notes |
|---|---|---|---|
| Plaintext password storage risk | Argon2id hashing with per-user salt and memory/time parameters | **VERIFIED RESOLVED** | `apps/api/src/modules/auth/argon2-hasher.ts` verifies strict Argon2id parameters. Unit and integration tests confirm zero plaintext passwords. |
| Insecure JWT tokens | Dual token model: short-lived access JWT in Authorization header + HttpOnly secure refresh cookie | **VERIFIED RESOLVED** | `apps/api/src/modules/auth/auth.service.ts` uses separate cryptographic secrets for JWT and cookies. CSRF and SameSite flags verified. |
| Rate-limiting bypass | Distributed sliding-window rate limiter with keyed HMAC IP/session hashing | **VERIFIED RESOLVED** | `apps/api/src/modules/auth/rate-limit.service.ts` verifies client hash keys and blocks brute-force authentication. |

### 2.2 Marketplace Core, Locations & Spatial Queries (Phase 2 & Phase 3)

| Previous Finding | Claimed Resolution | Independent Verification Status | Evidence / Notes |
|---|---|---|---|
| Missing spatial indexing for Sri Lankan cities | PostGIS `geography(Point, 4326)` columns with spatial GiST indexing | **VERIFIED RESOLVED** | Migration `0002_marvelous_hercules.sql` creates GiST index on location points. `ST_DWithin` spatial queries verified in `locations.service.ts`. |
| Host multi-location concurrency conflicts | Row-level locking `FOR UPDATE` on partner slots during inventory reservation | **VERIFIED RESOLVED** | `apps/api/src/modules/bookings/bookings.service.ts` uses pessimistic locking with serializable deadlock retries. |
| Nested HTML `<button>` hydration error in web UI | Clean separation of clickable cards and child badge/button elements | **VERIFIED RESOLVED** | `LocationCard.tsx` and `Card.tsx` refactored with `as="div"` container semantics. Hydration tests pass. |

### 2.3 Custody Escrow & Cryptographic Check-in/Check-out (Phase 4 & Phase 5)

| Previous Finding | Claimed Resolution | Independent Verification Status | Evidence / Notes |
|---|---|---|---|
| QR code custody pass forgery risk | HMAC-SHA256 custody tokens binding `bookingId`, `travellerUserId`, `locationId`, and timestamp | **VERIFIED RESOLVED** | `apps/api/src/modules/custody/custody.service.ts` verifies cryptographic HMAC signature before custody state transitions. |
| Host staff unauthorized luggage release | RBAC check `custody.verify` requiring host ownership or authorized staff delegation | **VERIFIED RESOLVED** | `apps/api/src/modules/custody/custody.routes.ts` enforces `requirePermission("custody.verify")` and verifies host tenant binding. |
| Photo upload custody evidence | S3/R2 presigned upload URLs with MIME type and size enforcement | **VERIFIED RESOLVED** | Migration `0017` and `apps/api/src/modules/storage/` verify presigned URL generation and storage adapter isolation. |

### 2.4 Payment Infrastructure & PayHere Transformation (Phase 6)

| Previous Finding | Claimed Resolution | Independent Verification Status | Evidence / Notes |
|---|---|---|---|
| PayHere single-gateway vulnerability & mobile SDK failures | Decommission PayHere as primary; introduce Stripe (primary) and PayPal (alternative) | **VERIFIED RESOLVED** | Stripe and PayPal adapters implemented in `apps/api/src/modules/payments/adapters/`. Full lifecycle tests pass (`stripe-payment.test.ts`, `paypal-payment.test.ts`). |
| Active PayHere code still present in production routes | Legacy PayHere adapter and routes retained for backwards compatibility | **PARTIALLY RESOLVED / DRIFTED** | `legacy-payhere.adapter.ts` and `/webhooks/payhere` remain active in codebase. Production environment must reject PayHere configuration and route creation. |
| Webhook idempotency | Database table `payment_webhook_events` tracking idempotency keys and processing timestamps | **VERIFIED RESOLVED** | Idempotent duplicate delivery prevention verified in `payments.service.ts`. |

### 2.5 Maps, Routing & Navigation Experience (Phase 7)

| Previous Finding | Claimed Resolution | Independent Verification Status | Evidence / Notes |
|---|---|---|---|
| Reliance on external Google Maps redirects | In-app routing engine with MapTiler integration, GeoJSON step navigation, and SVG vector maps | **VERIFIED RESOLVED** | `@luggage-storage/contracts/src/maps`, `apps/api/src/modules/maps/`, and `LocationDiscoveryMap.tsx` / `InteractiveMobileMap.tsx` pass all tests. |
| Silent fallback to synthetic routes in production | Development sandbox adapter provided synthetic geometric routes | **UNRESOLVED / BLOCKER** | In `apps/api/src/config/env.ts`, `MAPS_PROVIDER=sandbox` is not prohibited in production. `MapsService` must be restricted to verified street-routing in production. |
| Silent location fallback on denied geolocation | Geolocation timeout or denial defaulted coordinates to Colombo Fort station | **UNRESOLVED / BLOCKER** | Denied geolocation did not display an explicit UI banner or manual location selector. |

---

## 3. Summary of Open Items Requiring Phase 8 Action

The audit confirms that the platform's core functional, financial, and security architecture is operating as specified. However, the following specific remediations are required before granting Gate A (Demo Release) and Gate B (Production Release Candidate):

1. **Maps & Routing Production Hardening (WS-1):**
   - Enforce `MAPS_PROVIDER=maptiler` and reject `sandbox` in `NODE_ENV === "production"`.
   - In `apps/web` and `apps/mobile`, replace silent fallback with explicit location permission and manual origin selection UI.

2. **Demo Deployment Infrastructure & Seed Script (WS-2):**
   - Create multi-stage production Dockerfiles for `apps/api` and `apps/web`.
   - Create an automated, idempotent demo seed and database reset script (`db:seed`, `db:reset`).

3. **Payment Gateway Retirement Finalization (WS-3):**
   - Remove active PayHere execution paths while strictly retaining historical transaction and ledger records.

4. **Mobile Build & Distribution Profiles (WS-4):**
   - Configure `eas.json` for Android APK internal preview builds.
   - Document complete sideloading and internal distribution procedures.

5. **Operational Runbooks & Release Governance (WS-6 & WS-7):**
   - Provide disaster recovery runbooks, database backup verification, and release checklists.

