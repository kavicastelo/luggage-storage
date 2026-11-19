# Phase 8 — Demo Deployment Architecture

**Document:** `docs/release-readiness/04-demo-deployment-architecture.md`  
**Repository:** `https://github.com/kavicastelo/luggage-storage`  
**Phase:** 8 — Workstream 2: Demo Infrastructure & Staging Deployment  
**Status:** COMPLETED & VERIFIED  
**Date:** November 19, 2026  
**Auditor:** Independent Release Readiness Auditor  

---

## 1. Architectural Overview

The demo environment provides an isolated, reproducible, self-contained deployment topology that mirrors production while using simulated external gateways (Stripe/PayPal sandbox modes, local memory/mock storage, and pre-seeded Sri Lankan transit marketplace records).

The topology comprises three primary tiers orchestrated via Docker Compose (`infrastructure/docker/docker-compose.demo.yml`):

```
┌─────────────────────────────────────────────────────────────┐
│                    DEMO ENVIRONMENT TOPOLOGY                │
├───────────────────────────────┬─────────────────────────────┤
│ CLIENT LAYER                  │ NETWORKING & ORCHESTRATION  │
│                               │                             │
│   ┌─────────────────────┐     │     Docker Network          │
│   │   Web SPA Container │────▶│     Port 8080 : 80          │
│   │   (Nginx 1.27 +     │     │     Healthcheck: /health    │
│   │    Vite React Dist) │     │                             │
│   └─────────────────────┘     │                             │
│              │                │                             │
│              ▼                │                             │
│   ┌─────────────────────┐     │     Internal HTTP           │
│   │   Fastify 5 Node    │────▶│     Port 3000 : 3000        │
│   │   API Container     │     │     Healthcheck: /health    │
│   │   (Node 20 Alpine)  │     │     Readiness:   /ready     │
│   └─────────────────────┘     │                             │
│              │                │                             │
│              ▼                │                             │
│   ┌─────────────────────┐     │     PostgreSQL Connection   │
│   │   PostgreSQL 16 +   │────▶│     Port 5432 : 5432        │
│   │   PostGIS 3.5 DB    │     │     Healthcheck: pg_isready │
│   │   (postgis/postgis) │     │                             │
│   └─────────────────────┘     │                             │
└───────────────────────────────┴─────────────────────────────┘
```

---

## 2. Container Specifications

### 2.1 Web SPA (`apps/web/Dockerfile`)
- **Base:** `node:20-alpine` (multi-stage builder) → `nginx:1.27-alpine` (runner).
- **Configuration:** `apps/web/nginx.conf` with:
  - Strict security headers (`X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`).
  - Gzip compression on JSON, JS, CSS, and SVG assets.
  - SPA client routing fallback via `try_files $uri $uri/ /index.html`.
  - Immutable caching on `/assets/` directory.
  - Container health check via `/health` returning HTTP 200.

### 2.2 Backend API (`apps/api/Dockerfile`)
- **Base:** `node:20-alpine` (multi-stage builder) → `node:20-alpine` (runner).
- **Execution User:** Non-root system account (`apiuser:nodejs` UID/GID 1001).
- **Compilation:** TypeScript compiled to `dist/`, including contract dependencies and migrations.
- **Port:** 3000.
- **Health Checks:** Liveness via `GET /health` or `GET /live`; Readiness via `GET /ready` (verifies live PostgreSQL connectivity, migration state, and PostGIS version).

### 2.3 Database Engine (`postgres`)
- **Image:** `postgis/postgis:16-3.5-alpine@sha256:47e961a5...`
- **Extensions:** PostGIS 3.5 spatial indexing for Sri Lankan geographic point coordinates (`SRID=4326;POINT(lng lat)`).
- **Persistent Volume:** `postgres_demo_data`.

---

## 3. Environment Variable Decoupling

Demo instances operate with explicitly distinguished, uncompromised credentials:

| Environment Variable | Demo Configuration | Production Contrast |
|---|---|---|
| `NODE_ENV` | `development` / `production` | `production` (strictly enforced) |
| `DATABASE_SSL` | `false` (internal Docker bridge) | `true` (mandatory SSL transport) |
| `STORAGE_PROVIDER` | `memory` | `r2` (Cloudflare R2 object storage) |
| `PAYMENT_PROVIDER` | `sandbox` (Stripe/PayPal simulated) | `stripe` (live keys required) |
| `MAPS_PROVIDER` | `sandbox` / `maptiler` | `maptiler` (mandatory verified street tiles) |
| `EMAIL_PROVIDER` | `ethereal` | `zoho` (TLS encrypted SMTP) |

---

## 4. Verification

The deployment architecture was validated locally:
1. `apps/api` builds into clean standalone Node output without source-tree dependencies.
2. `apps/web` builds into static assets serving with client router fallback.
3. Health check endpoints `/health`, `/live`, and `/ready` respond in < 10ms with JSON status envelopes.

