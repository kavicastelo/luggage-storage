# Engineering Governance — Environment Management & Configuration

**Document ID:** ENG-DOC-005  
**Version:** 1.0.0  
**Phase:** Phase 1A — Engineering Foundation  
**Status:** Approved Engineering Baseline  
**Applicability:** All workspaces and deployment environments  

---

## 1. Principles of Environment Configuration

The Global Luggage Storage Marketplace adheres strictly to **Twelve-Factor App** principles for environment management:
1. **Strict Separation of Config from Code:** Configuration that varies between environments (credentials, hostnames, ports, logging levels) is injected exclusively via environment variables.
2. **Fail-Fast Validation:** Applications must validate all required environment variables at process boot time using strongly typed **Zod schemas**. If a required variable is missing or invalid, the process aborts immediately with a clear error report.
3. **No Checked-In Secrets:** Real credentials, private keys, database passwords, and third-party API tokens must **never** be committed to Git.

---

## 2. Environment Tiers

| Tier | Purpose | Database Target | External Integrations | Logging Level |
| :--- | :--- | :--- | :--- | :--- |
| **development** | Local developer workstations | Local Docker PostGIS (`localhost:5432`) | Mocked or Sandbox APIs | `debug` |
| **test** | Automated unit & CI runs | Local / CI Docker PostGIS | 100% Mocked Ports | `warn` / `silent` |
| **staging** | Pre-production validation | Managed Cloud PostgreSQL (isolated) | Provider Sandbox APIs | `info` |
| **production** | Live marketplace traffic | Managed Cloud PostgreSQL (HA + replicas) | Live Provider APIs | `info` / `error` |

---

## 3. Environment File Structure & Lifecycle

```
apps/api/
├── .env.example       # Committed canonical template documenting all keys & defaults
├── .env               # Local development overrides (GIT-IGNORED)
└── src/config/env.ts  # Runtime Zod validation and typed export

apps/web/
├── .env.example       # Committed template for frontend variables
├── .env               # Local frontend overrides (GIT-IGNORED)
└── src/vite-env.d.ts  # Typed Vite environment definitions
```

---

## 4. Frontend & Mobile Exposure Rules

### Web Client (`apps/web`)
- Vite exposes only environment variables prefixed with `VITE_` to client-side bundles (e.g. `VITE_API_URL`).
- **CRITICAL SECURITY RULE:** Never prefix sensitive keys (database passwords, encryption keys, admin tokens) with `VITE_`. Everything prefixed with `VITE_` is compiled directly into publicly downloadable JavaScript bundles.

### Mobile Client (`apps/mobile`)
- Expo exposes only variables prefixed with `EXPO_PUBLIC_` to the mobile bundle (e.g. `EXPO_PUBLIC_API_URL`).
- **CRITICAL SECURITY RULE:** Mobile clients are distributed to untrusted devices. Secrets must never be stored in mobile bundles.

---

## 5. Production Secret Injection Architecture

For staging and production deployments:
1. Secrets are stored in a dedicated cloud key vault (e.g., Google Secret Manager or AWS Secrets Manager).
2. The runtime environment (e.g., Cloud Run or ECS task definition) maps vault secrets directly into container environment variables at launch.
3. Applications read standard `process.env` keys without needing vendor-specific secret SDKs in the core runtime path.

