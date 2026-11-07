# Engineering Governance — Testing Strategy & Quality Assurance

**Document ID:** ENG-DOC-004  
**Version:** 1.0.0  
**Phase:** Phase 1A — Engineering Foundation  
**Status:** Approved Engineering Baseline  
**Applicability:** All test suites across the monorepo  

---

## 1. Testing Philosophy & Pyramid

The Global Luggage Storage Marketplace enforces a strict, multi-tiered testing strategy designed to catch defects at the lowest possible layer before promoting code to production.

```
       / \
      / E2E \         - High confidence, slower execution (Playwright, Maestro)
     /-------\
    /  Integ  \       - Fastify inject(), Real DB/PostGIS queries, Port Adapters
   /-----------\
  /    Unit     \     - Pure functions, Ledger math, Capacity algorithms, Zod schemas
 /---------------\
```

---

## 2. Test Classification & Scope

### Tier 1: Unit Tests
- **Target:** Pure domain functions, financial arithmetic, ledger double-entry validations, time calculations, Zod validation schemas, and contract serializations.
- **Execution:** In-memory, sub-second execution, zero network or database I/O.
- **Tooling:** Vitest.
- **Coverage Target:** 100% on financial calculations and capacity reservation rules; `>= 85%` on domain entities.

### Tier 2: Integration Tests
- **Target:** Fastify route controllers, middleware pipelines, Drizzle ORM queries against PostgreSQL/PostGIS, and repository persistence.
- **Execution:** Utilizes Fastify's native `app.inject()` mechanism to simulate HTTP requests without binding to network ports.
- **Database Policy:** Integration tests execute against the local Dockerized PostgreSQL 16 + PostGIS instance. Tests run inside isolated database transactions or perform deterministic cleanup.
- **Mocking Policy:** Third-party external services (such as PayHere payment gateway or SMS delivery networks) must be mocked using their respective `Port` interfaces. The database itself must **not** be mocked for PostGIS spatial queries.

### Tier 3: Contract Verification Tests
- **Target:** Verification that API route output structures adhere exactly to `@luggage-storage/contracts` response envelopes (`ApiResponse<T>` and `ApiErrorResponse`).
- **Execution:** Automated schema assertions running alongside integration suites.

### Tier 4: End-to-End (E2E) & UI Component Tests (Phases 1B+)
- **Target:** Web portal user workflows (Playwright) and mobile user flows (Maestro / Detox).
- **Execution:** Automated browser and mobile emulator pipelines against staging environments.

---

## 3. Tooling & Test Execution Commands

| Workspace | Test Runner | Command | Description |
| :--- | :--- | :--- | :--- |
| **Root (Monorepo)** | Turborepo + Vitest 2 | `pnpm test` | Executes all test suites across all workspaces |
| **Contracts** | Vitest 2 | `pnpm --filter @luggage-storage/contracts test` | Schema, pagination, currency, and date validity tests (8 tests) |
| **API Backend** | Vitest 2 | `pnpm --filter @luggage-storage/api test` | Unit and integration tests for API & readiness (5 tests) |
| **Web Portal** | Vitest 2 | `pnpm --filter @luggage-storage/web test` | Component, theme, and Zustand store tests (3 tests) |
| **Mobile App** | Vitest 2 | `pnpm --filter @luggage-storage/mobile test` | Dual-role navigation and Zustand store tests (2 tests) |
| **Full Quality Gate** | Turborepo | `pnpm verify` | Runs lint, typecheck, test, and build end-to-end |

---

## 4. Test Isolation & Determinism Rules

1. **Zero Cross-Test State Leakage:** Tests must never depend on the execution order of other tests. Each test suite must setup and teardown its own data.
2. **Deterministic Time:** Tests involving timestamps, reservation expiry, or capacity hold TTLs must use Vitest's fake timers (`vi.useFakeTimers()`) to prevent flaky assertions.
3. **No Hardcoded Test Secrets:** Integration tests must use test-only environment variables loaded from `.env.test` or default test configurations.
4. **CI Enforcement:** The Continuous Integration workflow (`.github/workflows/ci.yml`) runs the full test suite on every pull request. No PR may merge with failing tests.

