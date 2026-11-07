# Engineering Governance — Repository Architecture

**Document ID:** ENG-DOC-001  
**Version:** 1.0.0  
**Phase:** Phase 1A — Engineering Foundation  
**Status:** Approved Engineering Baseline  
**Applicability:** Monorepo root and all member workspaces  

---

## 1. Overview & Monorepo Strategy

The Global Luggage Storage Marketplace is architected as a high-velocity, single-repository monorepo managed via **pnpm workspaces** and coordinated by **Turborepo**.

### Architectural Rationale
1. **End-to-End Type Safety:** Data transfer contracts, error shapes, currency formatting, and pagination interfaces are centralized in `@luggage-storage/contracts` and consumed synchronously by the backend (`apps/api`), web portal (`apps/web`), and mobile client (`apps/mobile`).
2. **Atomic Upgrades & Refactoring:** Interface adjustments across API producers and web/mobile consumers occur atomically in single pull requests, preventing cross-repository version drift.
3. **Optimized Build & Cache Pipelines:** Turborepo constructs a direct acyclic graph (DAG) of workspace dependencies, caching build artifacts, test runs, and type-checks for near-instant developer feedback loops.
4. **Lean Resource Footprint:** Single content-addressable dependency store on disk, preventing node_modules duplication across applications.

---

## 2. Directory Layout & Workspace Topology

```
luggage-storage/
├── .github/
│   └── workflows/
│       └── ci.yml                     # Continuous integration workflow
├── .agents/
│   └── engineering-agent-guidance.md  # Agentic execution rules and constraints
├── apps/
│   ├── api/                           # Backend Modular Monolith (Fastify, Drizzle, PostgreSQL 16)
│   ├── web/                           # Web Portal (React 18, Vite, TailwindCSS, TanStack Query)
│   └── mobile/                        # Universal Mobile App (Expo SDK 51, React Native, Expo Router)
├── packages/
│   ├── contracts/                     # Shared TypeScript contracts & standard schemas
│   ├── typescript-config/             # Base and domain-specific tsconfig definitions
│   └── eslint-config/                 # Centralized ESLint governance rules
├── infrastructure/
│   └── docker/
│       └── docker-compose.yml         # Local PostGIS 3 / PostgreSQL 16 service
├── docs/                              # Comprehensive architectural and governance records
│   ├── architecture/                  # Phase 0A/0C-D domain, data, and system models
│   ├── engineering/                   # Phase 1A engineering standards and execution plans
│   ├── governance/                    # Acceptance records and sign-offs
│   ├── product/                       # FRS, user workflows, screen registries
│   └── decisions/                     # Decision registers and open questions
├── package.json                       # Monorepo root configuration & scripts
├── pnpm-workspace.yaml                # pnpm workspace definition
├── turbo.json                         # Turborepo task pipeline definition
├── tsconfig.json                      # Solution-level TypeScript project references
└── .gitignore                         # Comprehensive ignore rules
```

---

## 3. Package Boundaries & Dependency Graph

### Workspace Dependency Matrix

| Workspace | Workspace Name | Direct Dependencies Allowed | Direct Dependencies Prohibited |
| :--- | :--- | :--- | :--- |
| `packages/typescript-config` | `@luggage-storage/typescript-config` | None | Any |
| `packages/eslint-config` | `@luggage-storage/eslint-config` | ESLint plugins/parsers | Workspace applications |
| `packages/contracts` | `@luggage-storage/contracts` | Zero runtime dependencies | Backend/Web/Mobile frameworks |
| `apps/api` | `@luggage-storage/api` | `contracts`, `typescript-config`, `eslint-config` | `apps/web`, `apps/mobile` |
| `apps/web` | `@luggage-storage/web` | `contracts`, `typescript-config`, `eslint-config` | `apps/api`, `apps/mobile` |
| `apps/mobile` | `@luggage-storage/mobile` | `contracts`, `typescript-config`, `eslint-config` | `apps/api`, `apps/web` |

### Architectural Boundary Rules

1. **Zero Transitive Coupling Between Apps:** `apps/api`, `apps/web`, and `apps/mobile` MUST NEVER import from one another. Communication between frontend applications and the backend API occurs strictly over HTTP/JSON using standardized contracts.
2. **Pure Contracts Package:** `packages/contracts` contains zero runtime dependencies, zero database dependencies, zero HTTP server dependencies, and zero UI dependencies. It consists entirely of pure TypeScript types, runtime-safe enum mappings, and mathematical constants (such as ISO currency definitions).
3. **No Circular References:** Circular dependencies between workspaces or internal modules are strictly banned and enforced via automated ESLint dependency rules.

---

## 4. Turborepo Task Pipeline Architecture

Turborepo configures the dependency graph and caching rules in `turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "build/**", "dist/assets/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "verify": {
      "dependsOn": ["lint", "typecheck", "test", "build"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "clean": {
      "cache": false
    }
  }
}
```

### Pipeline Execution Behaviors
- **`^build` Topo-Sorting:** The `^build` directive guarantees that any upstream dependency (e.g. `@luggage-storage/contracts`) is fully compiled before downstream consumers (`apps/api`, `apps/web`) execute their build or test tasks.
- **Cache Inputs & Outputs:** Outputs (`dist/**`) are fingerprint-hashed alongside input source files. When source files have not changed, Turborepo replays cached outputs in milliseconds.
- **Ephemeral Tasks:** `dev` tasks are flagged as `cache: false` and `persistent: true` to support hot module replacement (HMR) without process termination.

---

## 5. Artifact & Cache Governance

The following directories are ephemeral and must never be tracked in git:
- `node_modules/`: Local package installations.
- `.turbo/`: Local Turborepo task run cache.
- `dist/`, `build/`: Transpiled JavaScript outputs.
- `.expo/`, `.vite/`: Bundler metadata and compilation caches.
- `coverage/`: Test coverage reports.

All artifact paths are governed by the root `.gitignore` file.

