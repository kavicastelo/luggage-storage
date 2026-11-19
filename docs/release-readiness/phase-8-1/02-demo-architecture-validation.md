# Phase 8.1 — Workstream 0: Demo Architecture Validation & Production Isolation

**Document:** `docs/release-readiness/phase-8-1/02-demo-architecture-validation.md`  
**Repository:** `https://github.com/kavicastelo/luggage-storage`  
**Phase:** 8.1 — Checkpoint 1  
**Date:** November 19, 2026  
**Auditor:** Independent Release Readiness Lead  

---

## 1. Executive Summary

This document formally validates the architectural divergence between the **Demo Deployment Architecture** (cost-optimized, ephemeral, and publicly demonstratable) and the **Production Deployment Architecture** (hardened, multi-region resilient, least-privilege). The two deployment targets must remain strictly independent and mutually isolated.

---

## 2. Two Distinct Deployment Architectures

```
                    DEMO ENVIRONMENT (Phase 8.1)

        ┌───────────────────────────────────┐
        │            NETLIFY                │
        │                                   │
        │  Web Application A (apps/web)     │
        │  Port: 5173 -> Static dist        │
        │                                   │
        │  Web Application B (apps/mobile)  │
        │  Port: 8081 -> Static web export  │
        └─────────────────┬─────────────────┘
                          │
                          │ HTTPS API requests
                          ▼
        ┌───────────────────────────────────┐
        │             AWS EC2               │
        │                                   │
        │  Node.js 22 LTS / Fastify API     │
        │  Compiled production distribution │
        │  NO DOCKER DEPLOYMENT             │
        │  Nginx Reverse Proxy + TLS        │
        │  PM2 / systemd process management │
        └─────────────────┬─────────────────┘
                          │
                          │ Secure TLS PostgreSQL Connection (Port 5432)
                          ▼
        ┌───────────────────────────────────┐
        │            SUPABASE               │
        │                                   │
        │  Managed PostgreSQL 16            │
        │  PostGIS Extension                │
        │  Drizzle ORM                      │
        │  Clean Schema + Demo Seed         │
        └───────────────────────────────────┘

        ┌───────────────────────────────────┐
        │             EAS                   │
        │                                   │
        │  Android Demo APK (Internal)      │
        │  iOS Demo Build (Ad Hoc / TestFl) │
        │  API Target: AWS EC2 HTTPS URL    │
        └───────────────────────────────────┘
```

---

## 3. Demo Architecture Validation Criteria

### 3.1 Web Hosting on Netlify
- **Application A (`apps/web`):**
  - Framework: React 18 + Vite 6
  - Development Port: 5173
  - Build Command: `pnpm --filter @luggage-storage/web build`
  - Output Directory: `apps/web/dist`
  - Serving Model: Static SPA with `_redirects` (`/*  /index.html  200`)
- **Application B (`apps/mobile` web export):**
  - Framework: Expo SDK 58 + React Native Web + Expo Router
  - Development Port: 8081
  - Build Command: `pnpm --filter @luggage-storage/mobile export` (or `npx expo export --platform web`)
  - Output Directory: `apps/mobile/dist`
  - Serving Model: Static SPA with `_redirects` (`/*  /index.html  200`)

### 3.2 API Hosting on AWS EC2 (No Docker)
- **Runtime Environment:** Ubuntu 24.04 LTS on AWS EC2 (t3.micro or t3.small, free-tier eligible).
- **Process Manager:** `systemd` or `pm2` managing compiled Node.js distribution (`node dist/server.js`).
- **Reverse Proxy:** Nginx handling TLS termination (Let's Encrypt / Certbot), proxy headers (`X-Forwarded-For`, `X-Forwarded-Proto`), and routing port 443 to `127.0.0.1:3000`.
- **Constraint Enforcement:** **No Docker is permitted on the EC2 demo instance.** The application runs as a native Node.js process using the compiled distribution artifact (`apps/api/dist`).

### 3.3 Managed Database on Supabase
- **Database Engine:** PostgreSQL 16 with PostGIS extension.
- **Connection Strategy:** Direct connection over Port 5432 (`db.<project-ref>.supabase.co:5432`) with `ssl: { rejectUnauthorized: false }` or Supabase CA certificate.
- **Constraint Enforcement:** Port 5432 is mandatory because `migrate.ts` executes `SELECT pg_advisory_lock(...)` which requires session-level state not supported by transaction-mode PgBouncer (Port 6543).

### 3.4 Mobile Distribution via EAS
- **Profile:** `preview` in `apps/mobile/eas.json` producing standalone `.apk` for Android and internal distribution build for iOS.
- **API Target:** Set to the verified public HTTPS URL of the AWS EC2 Nginx reverse proxy.
- **Dependency Guard:** Mobile builds must NEVER be generated with `localhost` or temporary IP addresses.

---

## 4. Strict Environment Isolation Matrix

| Dimension | Demo Environment | Production Environment |
|---|---|---|
| **`APP_ENV`** | `demo` | `production` |
| **`NODE_ENV`** | `production` (for V8 optimizations) | `production` |
| **Database Host** | Supabase (`db.*.supabase.co`) | AWS RDS / Dedicated Managed HA PostgreSQL |
| **Database SSL** | Required (Supabase TLS) | Required (`rejectUnauthorized: true`, strict CA) |
| **API Deployment** | AWS EC2 (Native Node.js compiled dist) | Containerized ECS / EKS / Cloud Run with auto-scaling |
| **Payment Provider** | `stripe` (sandbox / test keys) or `paypal` (sandbox) | `stripe` (live merchant keys with strict TLS webhook verification) |
| **File Storage** | Ephemeral / Memory or demo R2 bucket | Cloudflare R2 / AWS S3 with encrypted buckets & strict presigned TTL |
| **Email Delivery** | Console / Test / Resend demo credentials | Zoho Mail authenticated SMTP with enforced TLS |
| **Map Routing** | MapTiler or explicitly labeled simulated routing | MapTiler live production routing with fail-closed 503 |
| **CORS Origins** | Netlify demo domains (`*.netlify.app`) | Registered production domains (`*.luggagevault.lk`) |
| **App Secrets** | Demo-specific 32-char distinct secrets | KMS / Secrets Manager provisioned production secrets |

---

## 5. Feasibility Verdict

1. **Feasibility:** The proposed demo architecture is 100% technically feasible and aligns directly with the existing codebase structure.
2. **Cost Optimization:** Netlify free tier (for both web apps), AWS EC2 t3.micro (AWS Free Tier), and Supabase Free Tier deliver a near-zero or minimal monthly operational cost for demonstration purposes.
3. **Production Non-Regression:** No production infrastructure, database schemas, or deployment pipelines are altered or weakened to support the demo architecture.
