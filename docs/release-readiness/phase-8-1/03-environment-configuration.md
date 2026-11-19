# Phase 8.1 — Workstream 1: Environment Model Remediation & Validation Runbook

**Document:** `docs/release-readiness/phase-8-1/03-environment-configuration.md`  
**Repository:** `https://github.com/kavicastelo/luggage-storage`  
**Phase:** 8.1 — Checkpoint 1  
**Date:** November 19, 2026  
**Auditor:** Independent Release Readiness Lead  

---

## 1. Executive Summary

This document resolves **Finding F-01** (Incompatible demo environment variables and production environment validation). Prior to Phase 8.1, setting `NODE_ENV=production` in the demo container caused Fastify to crash on startup because Zod schema refinements eagerly rejected sandbox payment providers, memory storage, non-Zoho emails, and unencrypted transport.

The solution introduces an explicit, deliberate four-tier environment model via `APP_ENV` while preserving `NODE_ENV` for Node.js runtime and V8 compiler optimizations.

---

## 2. Four-Tier Environment Model

| Environment (`APP_ENV`) | `NODE_ENV` | Target Use Case | Validation Profile |
|---|---|---|---|
| **`development`** | `development` | Local workstation development | Default dev secrets allowed; sandbox payments; memory storage; console email. |
| **`test`** | `test` | Automated CI test suites (`vitest`) | Ephemeral test databases; fast hashing; deterministic test adapters. |
| **`demo`** | `production` | Public & stakeholder demonstrations | Non-default 32-char secrets; sandbox Stripe/PayPal allowed; Supabase TLS; memory or demo R2 storage; Netlify CORS. |
| **`production`** | `production` | Live customer operations | Strict zero-trust validation; R2 mandatory; Zoho SMTP mandatory; live Stripe/PayPal mandatory; strict TLS with CA. |

---

## 3. Implementation Details

In `apps/api/src/config/env.ts`:
```typescript
APP_ENV: z.preprocess(
  (val) => (val === "" || val === undefined ? undefined : typeof val === "string" ? val.trim().toLowerCase() : val),
  z.enum(["development", "test", "demo", "production"]).optional()
)
```

In `EnvSchema.superRefine()`:
```typescript
const effectiveAppEnv =
  data.APP_ENV ?? (data.NODE_ENV === "production" ? "production" : (data.NODE_ENV as "development" | "test" | "production"));
```

- **When `effectiveAppEnv === "production"`:**
  - `STORAGE_PROVIDER` must be `'r2'` with full credentials.
  - `EMAIL_PROVIDER` must be `'zoho'` with non-empty SMTP credentials.
  - `PAYMENT_PROVIDER` cannot be `'sandbox'`.
  - Secrets cannot start with `'dev_'`, `'test_'`, or placeholder tokens.
  - `DATABASE_SSL` and `DATABASE_SSL_REJECT_UNAUTHORIZED` must both be `true`.
  - `CORS_ORIGIN` cannot be `'*'` or empty.
- **When `effectiveAppEnv === "demo"`:**
  - `STORAGE_PROVIDER` can be `'memory'` or `'r2'`.
  - `PAYMENT_PROVIDER` can be `'sandbox'`, `'stripe'`, or `'paypal'`.
  - Secrets cannot start with `'dev_'`.
  - `DATABASE_SSL` is supported with `rejectUnauthorized: false` for Supabase compatibility.
  - `CORS_ORIGIN` cannot be `'*'`; must explicitly whitelist Netlify and client demo domains.

---

## 4. Verification Evidence

Automated test suite `apps/api/tests/environment-validation.test.ts` executes 10 test scenarios covering:
1. Local development configuration parsing.
2. Test environment validation.
3. Cost-optimized demo configuration (`NODE_ENV=production`, `APP_ENV=demo`).
4. Full production configuration validation.
5. Strict rejection of sandbox payments in production.
6. Validation of database URLs.
7. Rejection of unencrypted database transport in production.
8. Rejection of dev default secrets in demo.
9. Rejection of wildcard CORS in demo and production.
10. Enforcement of R2 credentials when R2 storage is selected.

Result: **10/10 tests passed.**
