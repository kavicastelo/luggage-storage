# Global Luggage Storage Marketplace

A global luggage storage marketplace connecting travellers with verified local businesses and storage locations for secure, temporary luggage drop-off. Initial launch market: Sri Lanka, with multi-currency and global expansion architecture.

---

## 1. Architecture & Technology Stack

The platform is structured as a modular monorepo powered by **pnpm workspaces** and **Turborepo**:

- **Backend API (`apps/api`):** Fastify 5.12.8 LTS, Node.js 26.3.1, TypeScript, Drizzle ORM.
- **Web Frontend (`apps/web`):** React 18.3.1, Vite 6, Tailwind CSS, TypeScript (SPA).
- **Mobile Application (`apps/mobile`):** React Native 0.88.1, Expo SDK 58.0.23, Expo Router, Zustand (Traveller & Host apps).
- **Shared Contracts (`packages/contracts`):** Common Zod schemas, API types, error formats, currency/date utilities.
- **Database (`infrastructure/docker`):** PostgreSQL 16.15 with PostGIS 3.5.7 extension, 3-tier role architecture (`postgres`, `luggage_migrator`, `luggage_user`).

---

## 2. Getting Started

### Prerequisites
- **Node.js:** v26.3.1 (see `.node-version` / `.nvmrc`)
- **Package Manager:** pnpm 12.9.1 (`npm install -g pnpm@12.9.1`)
- **Docker & Docker Compose:** For running PostgreSQL + PostGIS locally.

### Local Development Setup
```bash
# 1. Install dependencies
pnpm install

# 2. Start PostgreSQL/PostGIS database container
docker compose -f infrastructure/docker/docker-compose.yml up -d

# 3. Run verification quality gate (lint, typecheck, test, build)
pnpm verify

# 4. Start all applications in development mode
pnpm dev
```

---

## 3. Documentation

Comprehensive documentation is organized under the [`docs/`](file:///d:/luggage-storage/luggage-storage/docs/README.md) directory:

- **[Documentation Index & Navigation Guide](file:///d:/luggage-storage/luggage-storage/docs/README.md)** — Master map of all project documentation.
- **[Repository Architecture](file:///d:/luggage-storage/luggage-storage/docs/engineering/repository-architecture.md)** — Monorepo structure and build pipeline.
- **[Development Setup Guide](file:///d:/luggage-storage/luggage-storage/docs/engineering/development-setup.md)** — Step-by-step developer onboarding.
- **[Coding Standards](file:///d:/luggage-storage/luggage-storage/docs/engineering/coding-standards.md)** — TypeScript, formatting, and linting rules.
- **[Database Development](file:///d:/luggage-storage/luggage-storage/docs/engineering/database-development.md)** — Drizzle ORM and PostgreSQL 3-tier security.
- **[Active Phase Specification: Phase 1B](file:///d:/luggage-storage/luggage-storage/docs/engineering/phase-1b-specification.md)** — Identity, Authentication & Access Control.

---

## 4. Current Status

- **Phase 0A, 0B, 0C (Architecture & Requirements):** Formally Accepted.
- **Phase 1A-R (Foundation Stabilization):** Formally Accepted (19/19 Criteria PASS, PR #2 Merged).
- **Phase 1B (Identity, Authentication & Access Control):** Entry Gate Passed & Commenced.
