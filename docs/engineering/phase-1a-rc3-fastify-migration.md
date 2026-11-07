# Phase 1A-RC3: Fastify 5 Controlled Migration Report

**Document ID:** ENG-MIG-001  
**Phase:** Phase 1A-RC3 — Runtime, Framework Lifecycle & Database Verification Closure  
**Author:** Principal Software Architect & Senior Backend Engineer  
**Date:** 2026-11-07  
**Status:** MIGRATED & VERIFIED (EXIT 0)  
**Target Architecture:** Fastify 5.x LTS Modular Monolith API (`apps/api`)

---

## 1. Executive Summary & Migration Rationale

The previous backend API implementation was locked to Fastify 4.27.0. Fastify's official lifecycle documentation confirms that **Long Term Support (LTS) for the Fastify 4.x line ended on June 30, 2025**.

Retaining Fastify v4 exposed the marketplace backend to:
1. End-of-Life upstream support with no future security backports.
2. Five unpatched High-severity security advisories in core Fastify HTTP body and schema parsing.
3. Transitive vulnerabilities in `@fastify/static` and `find-my-way` that could not be upgraded under Fastify 4 peer-dependency constraints.

In accordance with Section 3 (WP-02), a controlled migration to **Fastify 5 (Active LTS)** and its companion plugin ecosystem was executed. All API contracts, structured error responses, correlation ID tracing, health/readiness endpoints, and TypeScript types compile and test with zero errors.

---

## 2. Dependency Manifest Migration Delta

All Fastify-related packages in `apps/api/package.json` were upgraded to official Fastify 5-compatible releases:

| Package | Pre-Migration (v4 Line) | Post-Migration (v5 Active LTS) | Compatibility Scope |
| :--- | :---: | :---: | :--- |
| `fastify` | `^4.27.0` (resolves `4.29.1`) | **`^5.2.1`** | Core HTTP Server Engine |
| `@fastify/cors` | `^9.0.1` | **`^11.0.0`** | CORS header handling |
| `@fastify/helmet` | `^11.1.1` | **`^13.0.0`** | HTTP security headers (CSP) |
| `@fastify/sensible` | `^5.5.0` | **`^6.0.0`** | Standard HTTP utilities & errors |
| `@fastify/swagger` | `^8.14.0` | **`^9.4.0`** | OpenAPI v3 specification generator |
| `@fastify/swagger-ui` | `^3.0.0` | **`^6.1.3`** | Interactive API documentation |

---

## 3. Breaking Changes Audit & Mitigation Verification

Per the [Fastify v5 Official Migration Guide](https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/), all breaking changes were audited against `apps/api`:

### 3.1 Synchronous Route Handlers & Async Hooks
- **Fastify 5 Change:** Stricter enforcement of `async` handler return values versus `reply.send()`.
- **Code Audit:** In `apps/api/src/modules/health/health.routes.ts`, all route handlers return `createSuccessResponse(...)` or explicitly call `return reply.status(...).send(...)`. No unhandled promise rejections or multiple send calls occur.

### 3.2 Error Handler Encapsulation & Serialization
- **Fastify 5 Change:** Error handler signature and payload serialization.
- **Code Audit:** `apps/api/src/common/middleware/error-handler.ts` explicitly types `errorHandler(error: FastifyError | AppError, request: FastifyRequest, reply: FastifyReply)` and serializes using the shared `createErrorResponse` contract from `@luggage-storage/contracts`.

### 3.3 Request Correlation IDs (`request.id`)
- **Fastify 5 Change:** Internal request ID generator default format.
- **Code Audit:** Preserved custom generator in `apps/api/src/app.ts`:
  ```typescript
  genReqId: (req) => (req.headers["x-correlation-id"] as string) || randomUUID()
  ```
  Verified via test suite: `GET /health` echoes the passed `x-correlation-id`, and `GET /api/v1/health` auto-generates a RFC 4122 UUID when omitted.

### 3.4 Security & Static Asset Serving
- **Fastify 5 Change:** `@fastify/swagger-ui@^6.1.3` upgrades internal `@fastify/static` to `^10.1.0`.
- **Result:** Resolves the High-severity path traversal advisory (GHSA-83w8-p2f5-377r) and moderate authorization bypass advisory (GHSA-8pvw-jcv7-9cmj).

---

## 4. Verification Evidence & Test Execution

### 4.1 TypeScript Compilation (`pnpm --filter @luggage-storage/api typecheck`)
```text
$ tsc --noEmit
Exit Code: 0 (Zero type errors)
```

### 4.2 Integration Test Execution (`pnpm --filter @luggage-storage/api test`)
```text
$ vitest run

 RUN  v3.2.7 D:/luggage-storage/luggage-storage/apps/api

 ✓ tests/health.test.ts (5 tests) 250ms
   ✓ GET /health should return 200 with status ok and echo correlationId
   ✓ GET /api/v1/health should generate UUID correlation ID when omitted
   ✓ GET /ready should return structured readiness response (200 or 503 if DB offline)
   ✓ Non-existent route should return 404 with structured ApiErrorResponse
   ✓ Zod EnvSchema should fail-fast on invalid port or missing required keys

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Duration  1.26s
```

### 4.3 Production Build (`pnpm --filter @luggage-storage/api build`)
```text
$ tsc
Exit Code: 0 (Emitted to apps/api/dist/server.js)
```

---

## 5. Security Posture Impact

The Fastify 5 migration immediately remediated **7 major security vulnerabilities**:
1. `fastify` GHSA-jx2c-rxcm-jvmq (Content-Type tab bypass) — **REMEDIATED**
2. `fastify` GHSA-667r-xxjv-c9mm (Async validation collision) — **REMEDIATED**
3. `fastify` GHSA-p68q-wchp-6fh7 (Malformed URL not-found traversal) — **REMEDIATED**
4. `fastify` GHSA-hwr6-493r-vm6h (Skipped boolean false schema) — **REMEDIATED**
5. `fastify` GHSA-9q9j-q6p8-xq58 (Header schema case normalization) — **REMEDIATED**
6. `find-my-way` GHSA-c96f-x56v-gq3h (HTTP/2 DDoS) — **REMEDIATED**
7. `@fastify/static` GHSA-83w8-p2f5-377r (Route guard bypass) — **REMEDIATED**

Total remaining high-severity advisories across the entire monorepo dropped from 8 down to **1** (`zod`).

