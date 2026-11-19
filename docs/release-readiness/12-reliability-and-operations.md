# Phase 8 — Reliability & Operational Readiness

**Document:** `docs/release-readiness/12-reliability-and-operations.md`  
**Repository:** `https://github.com/kavicastelo/luggage-storage`  
**Phase:** 8 — Workstream 6: Security, Reliability & Operational Readiness  
**Status:** COMPLETED & VERIFIED  
**Date:** November 19, 2026  
**Auditor:** Independent Release Readiness Auditor  

---

## 1. Executive Summary

This document specifies the operational runtime architecture, fault-tolerance mechanisms, monitoring strategies, and process lifecycles governing the Luggage Storage platform in staging and production environments.

---

## 2. Health & Readiness Probes

The Fastify server exposes standardized probes mounted at root and under `${API_PREFIX}`:

| Endpoint | Probe Type | Validation Mechanics | Response Code |
|---|---|---|:---:|
| `GET /health` | Liveness | Verifies event loop is unblocked; returns uptime and timestamp | 200 OK |
| `GET /live` | Liveness | Container orchestrator alias for liveness | 200 OK |
| `GET /ready` | Readiness | Executes `SELECT PostGIS_Full_Version()`; validates pool connection and spatial engine | 200 OK / 503 Unavailable |

Sample `/ready` JSON response:
```json
{
  "success": true,
  "data": {
    "status": "ready",
    "database": {
      "connected": true,
      "postgis": "3.5 USE_GEOS=1 USE_PROJ=1 USE_STATS=1"
    }
  },
  "meta": {
    "timestamp": "2026-11-19T02:31:05.181Z",
    "correlationId": "75da026a-ee9a-43d0-b554-1c27f7840c6d"
  }
}
```

---

## 3. Concurrency & Deadlock Resilience

To safely process high-volume reservations and financial state mutations without serialization failures:
- In `apps/api/src/infrastructure/database/tx-retry.ts`, operations that acquire pessimistic locks (`FOR UPDATE`) are wrapped in `withSerializableOrDeadlockRetry`.
- If PostgreSQL encounters serialization failure (`40001`) or deadlock detected (`40P01`), the transaction automatically performs exponential backoff jitter and retries up to 3 times before failing closed.

---

## 4. Process Lifecycle & Graceful Shutdown

In `apps/api/src/server.ts`:
- Traps `SIGTERM` and `SIGINT` signals emitted by Docker or Kubernetes during container scaling or rolling deployments.
- Rejects new incoming HTTP connections while allowing existing in-flight requests a 10-second grace window to complete.
- Explicitly drains and closes the PostgreSQL client connection pool (`dbPool.end()`).

---

## 5. Structured Logging & Telemetry

- **Engine:** Pino logger formatted as single-line structured JSON in production for ingestion by Datadog, Grafana Loki, or CloudWatch.
- **Correlation IDs:** Every incoming HTTP request is assigned a UUID v4 correlation ID (`x-correlation-id` header or auto-generated `request.id`), propagated through all downstream log lines, database queries, and error responses.
- **Redaction:** Automatic redaction filters prevent accidental logging of passwords, tokens, API keys, and payment credentials.

---

## 6. Recommended Production Alerting Thresholds

| Metric | Warning Threshold | Critical Threshold | Action Required |
|---|---|---|---|
| `/ready` HTTP Failure | 1 failure | 3 consecutive failures | Investigate PostgreSQL connectivity or PostGIS extension |
| DB Connection Pool Utilization | > 75% for 2 mins | > 90% for 1 min | Scale connection pool limits or evaluate slow queries |
| Webhook 5xx Rate | > 2% over 5 mins | > 5% over 5 mins | Inspect Stripe/PayPal webhook verification errors |
| API Request Latency (p99) | > 800ms | > 2,000ms | Inspect spatial GIS indexing or external MapTiler latency |

