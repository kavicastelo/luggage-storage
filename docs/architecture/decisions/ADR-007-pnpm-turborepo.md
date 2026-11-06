# ADR-007: Monorepo Architecture with pnpm Workspaces and Turborepo

- **Status:** Accepted
- **Date:** 2026-11-07
- **Phase:** Phase 0A — Product Architecture & System Foundation
- **Related Documents:** [Application Architecture Boundaries](../application-boundaries.md), [Technology Decisions Register](../technology-decisions.md)

---

## 1. Context

The platform consists of three deployable application targets that share identical domain concepts, validation rules, localization dictionaries, and API contracts:
1. `apps/mobile` (React Native + Expo — Traveller and Host app variants)
2. `apps/web` (React + Vite — Public Website, Host Dashboard, Superadmin Dashboard)
3. `apps/api` (Node.js + Fastify — Modular Monolith Backend)

Maintaining separate repositories or copy-pasting TypeScript interfaces and Zod validation schemas across applications would inevitably lead to contract drift, duplicated bug fixes, and broken client-server integrations.

---

## 2. Decision

We will organize the entire repository as a single **TypeScript Monorepo** managed with **pnpm Workspaces** and **Turborepo**.

Key workspace principles:
- **Apps (`apps/*`):** Independently buildable and deployable applications (`mobile`, `web`, `api`).
- **Shared Packages (`packages/*`):**
  - `@luggage/shared-types`: Domain DTOs, enums, booking/payment/custody states, role constants, and screen registry definitions.
  - `@luggage/validation`: Shared **Zod** validation schemas used on both client forms (`React Hook Form`) and backend API routes (`Fastify`).
  - `@luggage/api-client`: Typed HTTP client and TanStack Query factories.
  - `@luggage/i18n`: Shared translation keys (`BCP 47`), currency (`ISO 4217`), and timezone (`IANA`) formatters.
  - `@luggage/config`: Shared `tsconfig`, ESLint, and Prettier configurations.
- **Independent Deployment:** Sharing a repository does not couple deployments—`apps/web`, `apps/api`, and `apps/mobile` (via EAS) remain independently deployable.

---

## 3. Alternatives Considered

1. **Multi-Repo (Separate Git repositories for Mobile, Web, and Backend):**
   - *Rejected:* Requires publishing private npm packages or manual copy-pasting to share Zod schemas and TypeScript types; makes atomic cross-stack feature development and traceability audits much harder.
2. **npm or Yarn Classic instead of pnpm:**
   - *Rejected:* Approved stack specifies `pnpm` + `Turborepo`. `pnpm` provides stricter phantom-dependency prevention and significantly faster, disk-efficient installs.
3. **Nx instead of Turborepo:**
   - *Rejected:* Approved stack locks `Turborepo`, which offers simpler configuration (`turbo.json`) and minimal intrusion into standard Vite, Expo, and Fastify tooling.

---

## 4. Consequences

### Positive
- **Single Source of Truth for Contracts:** Updating a booking request schema in `@luggage/validation` immediately type-checks across `apps/api`, `apps/web`, and `apps/mobile`.
- **Fast Incremental CI/CD:** Turborepo caches `build`, `lint`, `typecheck`, and `test` outputs so unchanged packages are not rebuilt.
- **Full Requirement Traceability:** Product documentation (`docs/`), shared screen registries, backend modules, and UI screens coexist in one versioned repository.

### Negative / Trade-offs
- Expo Metro bundler in `apps/mobile` must be configured cleanly to resolve workspace symlinks from `packages/*`.

---

## 5. Risks & Mitigations

- **Risk:** Accidental import of server-only Node.js/Drizzle code into `apps/mobile` or `apps/web` via shared packages.
  - **Mitigation:** Enforce strict package boundaries: `@luggage/shared-types` and `@luggage/validation` must remain pure TypeScript/Zod with zero runtime dependencies on Fastify, Drizzle, or Node built-ins.

