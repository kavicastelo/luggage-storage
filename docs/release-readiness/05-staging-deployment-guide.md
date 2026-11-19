# Phase 8 — Staging Deployment Guide

**Document:** `docs/release-readiness/05-staging-deployment-guide.md`  
**Repository:** `https://github.com/kavicastelo/luggage-storage`  
**Phase:** 8 — Workstream 2: Demo Infrastructure & Staging Deployment  
**Status:** COMPLETED & VERIFIED  
**Date:** November 19, 2026  
**Auditor:** Independent Release Readiness Auditor  

---

## 1. Overview & Purpose

This guide outlines step-by-step procedures for provisioning, deploying, and operating the Luggage Storage marketplace on a controlled staging server or cloud VM (e.g. AWS EC2, DigitalOcean Droplet, or Google Cloud Compute Engine).

Staging acts as the formal pre-production verification environment where:
- All database migrations are applied and tested against realistic data.
- Dual payment gateways (Stripe sandbox & PayPal sandbox) receive live webhook deliveries.
- In-app street routing and MapTiler tiles are verified under real network latency.
- Internal mobile APK builds connect to a publicly reachable SSL API.

---

## 2. Infrastructure Prerequisites

| Component | Minimum Specification | Recommended Specification |
|---|---|---|
| Host OS | Ubuntu 22.04 LTS or 24.04 LTS | Ubuntu 24.04 LTS x86_64 |
| Compute | 2 vCPU, 4 GB RAM | 4 vCPU, 8 GB RAM |
| Storage | 20 GB SSD | 40 GB NVMe SSD |
| Networking | Static public IPv4, DNS records pointing to host | Cloudflare-proxied SSL |
| Installed Packages | `docker` (v25+), `docker compose` (v2.20+), `git` | Standard Docker Engine |

---

## 3. Deployment Step-by-Step

### Step 1: Clone Repository & Select Release Candidate Branch
```bash
git clone https://github.com/kavicastelo/luggage-storage.git /opt/luggage-storage
cd /opt/luggage-storage
git checkout audit/phase-8-release-readiness
```

### Step 2: Configure Staging Environment Secrets
Copy the staging environment templates into `.envs/`:
```bash
cp .envs/.env.api.template .envs/.env.staging.api
cp .envs/.env.web.template .envs/.env.staging.web
```

Ensure the following variables are configured in `.envs/.env.staging.api`:
```ini
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info
DATABASE_URL=postgresql://luggage_user:SECURE_STAGING_PASSWORD@postgres:5432/luggage_staging
MIGRATION_DATABASE_URL=postgresql://luggage_migrator:SECURE_MIGRATOR_PASSWORD@postgres:5432/luggage_staging
DATABASE_SSL=false
CORS_ORIGIN=https://staging.luggagevault.lk
APP_PUBLIC_URL=https://staging.luggagevault.lk

# Distinct Cryptographic Secrets (minimum 32 characters each)
JWT_SECRET=staging_jwt_secret_distinct_at_least_32_characters_abc1
COOKIE_SECRET=staging_cookie_secret_distinct_at_least_32_characters_def2
RATE_LIMIT_HASH_SECRET=staging_ratelimit_secret_distinct_32_characters_ghi3
DB_IDENTITY_KEY_ID=staging-key-2026-v1
DB_IDENTITY_SECRET=staging_db_identity_secret_distinct_32_characters_jkl4
PAYOUT_ENCRYPTION_KEY=staging_payout_encryption_key_distinct_32_chars_mno5
CUSTODY_TOKEN_HMAC_SECRET=staging_custody_token_hmac_secret_distinct_32_pqr6

# Payment Providers (Stripe Sandbox & PayPal Sandbox)
PAYMENT_PROVIDER=stripe
PAYMENT_DEFAULT_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_SANDBOX_MODE=true

# MapTiler Routing (Real street network required in staging)
MAPS_PROVIDER=maptiler
MAPTILER_API_KEY=YOUR_STAGING_MAPTILER_KEY

# Cloudflare R2 or Ephemeral
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=luggage-storage-staging
```

### Step 3: Launch Containers via Docker Compose
```bash
docker compose -f infrastructure/docker/docker-compose.demo.yml up -d --build
```

### Step 4: Run Automated Database Migrations
```bash
docker compose -f infrastructure/docker/docker-compose.demo.yml exec api \
  pnpm --filter @luggage-storage/api db:migrate
```

### Step 5: Seed Staging Demo Data
```bash
docker compose -f infrastructure/docker/docker-compose.demo.yml exec api \
  pnpm --filter @luggage-storage/api db:seed
```

### Step 6: Verify Health Probes
```bash
curl -f http://127.0.0.1:3000/health
# Returns: {"success":true,"data":{"status":"ok","uptime":...}}

curl -f http://127.0.0.1:3000/ready
# Returns: {"success":true,"data":{"status":"ready","database":{"connected":true,"postgis":"3.5..."}}}

curl -f http://127.0.0.1:8080/health
# Returns: healthy
```

---

## 4. Staging Rollback Procedure

If a staging deployment encounters regressions:
1. Revert container image to previous tag:
   ```bash
   docker compose -f infrastructure/docker/docker-compose.demo.yml down
   git checkout HEAD~1
   docker compose -f infrastructure/docker/docker-compose.demo.yml up -d --build
   ```
2. In the event of schema corruptions, execute the clean database reset:
   ```bash
   docker compose -f infrastructure/docker/docker-compose.demo.yml exec api \
     pnpm --filter @luggage-storage/api db:reset
   ```

