# Technology Decisions Register

**Document Status:** Baseline Architecture — Phase 0A
**Source Reference:** [luggage-storage-frs.pdf](../product/source/luggage-storage-frs.pdf)
**Related Documents:**
- [System Architecture Overview](system-architecture.md)
- [Application Architecture Boundaries](application-boundaries.md)
- [Assumptions and Open Questions](../product/assumptions-and-open-questions.md)
- [Architecture Decision Records (`docs/architecture/decisions/`)](decisions/)

---

## 1. Purpose

This register records all **confirmed/approved technology choices** for the Global Luggage Storage Marketplace, their architectural scope, and key integration considerations, alongside **unresolved technology decisions** where options and recommendations are presented for explicit product owner approval.

---

## 2. Approved Technology Stack (Confirmed)

> [!IMPORTANT]
> The technologies below are **Approved** and locked as the baseline stack. They must not be replaced without an explicit, owner-approved Architecture Decision Record (ADR).

### 2.1 Monorepo & Build System

| Technology | Status | Where Used | Why Selected | Integration Considerations |
| :--- | :--- | :--- | :--- | :--- |
| **TypeScript** | **Approved** | `apps/mobile`, `apps/web`, `apps/api`, `packages/*` | End-to-end static type safety across mobile, web, and backend modules | Strict mode enabled across all `tsconfig.json` files (`ADR-007`) |
| **pnpm Workspaces** | **Approved** | Repository root | Fast, disk-efficient package management with strict dependency isolation | On Windows, package installations must account for workspace symlink rules (`ADR-007`) |
| **Turborepo** | **Approved** | Repository root | High-speed task orchestration and local/remote build caching across monorepo packages | Pipeline definitions in `turbo.json` coordinate `build`, `lint`, `typecheck`, and `test` (`ADR-007`) |

### 2.2 Mobile Application Stack (`apps/mobile`)

| Technology | Status | Where Used | Why Selected | Integration Considerations |
| :--- | :--- | :--- | :--- | :--- |
| **React Native + Expo** | **Approved** | `apps/mobile` (Traveller & Host builds) | Shared cross-platform mobile framework with managed native config (`CNG`) and cloud build support (`ADR-002`, `ADR-003`) | Uses **Expo Development Builds** (not Expo Go) because `MapLibre React Native` requires custom native code |
| **Expo EAS (Application Services)** | **Approved** | Mobile CI/CD | Enables iOS (`.ipa`) and Android (`.aab`/`.apk`) compilation in the cloud from a **Windows** development workstation (`ADR-002`) | Separate build profiles in `eas.json` for `traveller` and `host` identities (`ADR-003`) |
| **Expo Router** | **Approved** | `apps/mobile` | File-based, type-safe navigation with deep linking and route groups | Partitioned into `(auth)`, `(traveller)`, and `(host)` route groups |
| **TanStack Query** | **Approved** | `apps/mobile`, `apps/web` | Server-state caching, background refetching, pagination, and mutation invalidation | Shared query-key conventions via `@luggage/api-client` |
| **Zustand** | **Approved** | `apps/mobile`, `apps/web` | Lightweight, predictable client-side UI and session state management | Keep server cache in TanStack Query; use Zustand only for local UI/session state |
| **React Hook Form + Zod** | **Approved** | `apps/mobile`, `apps/web` | Performant form state management paired with shared schema validation | Consumes schemas from `@luggage/validation` |
| **Expo Notifications** | **Approved** | `apps/mobile` | Push notification token registration and local/remote notification handling (`FR-11`, `FR-35`) | Requires FCM credentials (Android) and APNs credentials (iOS via EAS) |
| **Expo Camera** | **Approved** | `apps/mobile` | QR code scanning at check-in/out (`FR-8`, `FR-27`, `FR-30`) and photo capture for KYC (`FR-16`), locations (`FR-19`), and luggage evidence (`FR-29`) | Requires runtime camera permission flows and image compression prior to R2 upload |
| **Expo Location** | **Approved** | `apps/mobile` | Device GPS location acquisition for nearby host search (`FR-2`, `FR-3`) | Graceful fallback to manual destination search when user denies location permission |

### 2.3 Web Application Stack (`apps/web`)

| Technology | Status | Where Used | Why Selected | Integration Considerations |
| :--- | :--- | :--- | :--- | :--- |
| **React + Vite** | **Approved** | `apps/web` | Fast HMR, modern ES module bundling, and lightweight deployment footprint (`ADR-004`) | Serves Public Website, Host Web Dashboard, and Superadmin Dashboard with route-level code splitting |
| **Tailwind CSS + shadcn/ui** | **Approved** | `apps/web` | Accessible, customizable component primitives with utility-first styling | Ensures high UI velocity across consumer pages and data-dense Host/Admin dashboards |
| **React Router** | **Approved** | `apps/web` | Declarative routing, nested layouts, and role-based route guards | Enforces clean layout isolation between `/*`, `/host/*`, and `/admin/*` |
| **TanStack Query, Zustand, React Hook Form, Zod** | **Approved** | `apps/web` | Unified state, data-fetching, and validation architecture matching `apps/mobile` | Shares `@luggage/validation` and `@luggage/api-client` with mobile |

### 2.4 Backend & Database Stack (`apps/api`)

| Technology | Status | Where Used | Why Selected | Integration Considerations |
| :--- | :--- | :--- | :--- | :--- |
| **Node.js + Fastify** | **Approved** | `apps/api` | High-performance, low-overhead HTTP framework with first-class TypeScript and schema plugin support (`ADR-001`) | Structured as a modular monolith with strict domain boundaries |
| **REST APIs + OpenAPI + Zod** | **Approved** | `apps/api` | Standard, debuggable HTTP contracts with automated OpenAPI documentation (`@fastify/swagger`) and runtime Zod validation | Every endpoint validates path, query, body, and response schemas |
| **PostgreSQL + PostGIS** | **Approved** | Primary Database | ACID transactional guarantees for bookings/ledgers combined with industry-standard geospatial indexing (`ADR-005`) | Hosted initially on **Neon PostgreSQL**; PostGIS `GEOGRAPHY(Point, 4326)` used for `FR-2`–`FR-4` |
| **Drizzle ORM** | **Approved** | `apps/api` | Lightweight, SQL-transparent TypeScript ORM with zero heavy runtime overhead and clean SQL migrations (`ADR-006`) | Schema files organized by domain; supports PostGIS custom types and raw spatial expressions |

### 2.5 Infrastructure & Core Integrations

| Technology | Status | Where Used | Why Selected | Integration Considerations |
| :--- | :--- | :--- | :--- | :--- |
| **Cloudflare R2** | **Approved** | Media & Document Storage | S3-compatible object storage with zero egress fees (`ADR-009`) | Separate public/CDN paths for location photos (`FR-19`) vs. private signed-URL access for KYC (`FR-16`) and check-in evidence (`FR-29`) |
| **Cloudflare (DNS, CDN, WAF)** | **Approved** | Edge Layer | Global edge caching, TLS termination, DDoS protection, and WAF security | Fronts `apps/web`, `apps/api`, and public R2 media assets |
| **AWS EC2 / Cost-Effective VPS** | **Approved** | Backend Hosting | Predictable, startup-friendly monthly hosting cost for the Fastify modular monolith | Avoids Kubernetes/ECS overhead initially; runs stateless API + background workers |
| **Neon PostgreSQL** | **Approved** | Managed Database | Managed PostgreSQL with PostGIS support, automated backups, and branching | Connection pooling configured for Fastify + Drizzle |
| **PayHere** | **Approved** | Initial Payment Gateway (`LK`) | Leading Sri Lankan payment gateway supporting local cards, mobile wallets, and bank checkout (`FR-6`, `ADR-008`) | Wrapped behind `PaymentGatewayPort`; requires commercial/regulatory verification for marketplace manual payout flow (`OQ-003`) |
| **MapLibre (React Native & GL JS)** | **Approved** | `apps/mobile`, `apps/web` | Open-source, vendor-neutral vector map rendering engine across mobile and web | Requires an approved commercial tile, geocoding, and routing provider (`OQ-018`) |
| **GitHub Actions** | **Approved** | CI/CD | Automated lint, type-check, test, and deployment workflows integrated with GitHub | Triggers Turborepo checks on PRs and coordinates deployments |

---

## 3. Unresolved Technology Decisions (Pending Owner Approval)

The following technology choices are **intentionally not locked** in Phase 0A. Options and architectural recommendations are documented below and tracked in [Assumptions and Open Questions](../product/assumptions-and-open-questions.md).

---

### 3.1 Authentication Provider / Strategy (`OQ-001`)
- **Status:** **Pending Approval**
- **Requirements Context:** Must support email/password, Google Sign-In, Apple Sign-In (`FR -1`), Host registration (`FR-15`), future Host Staff invitations (`FR-42`), multi-role user contexts (`Traveller` + `Host`), and MFA for Superadmin (`ACT-05`), across both React Native (`Expo`) and Web (`React + Vite`) with a Fastify backend.
- **Options Considered:**
  1. **Option A — Better Auth or Custom Self-Managed Auth in Fastify (PostgreSQL-backed sessions/JWT + Arctic for Google/Apple OAuth):**
     - *Pros:* Zero per-MAU SaaS cost; 100% data ownership inside the existing Neon PostgreSQL database (`users`, `sessions`, `accounts` stay in one DB without webhook sync lag); first-class TypeScript/Fastify/Drizzle integration; full control over multi-role (`Traveller`/`Host`/`Superadmin`) claims.
     - *Cons:* Team owns password hashing (`Argon2id`), token rotation, and OAuth callback configuration.
  2. **Option B — Managed Auth SaaS (Clerk or Supabase Auth / Firebase Auth):**
     - *Pros:* Pre-built OAuth and MFA flows.
     - *Cons:* Introduces external user-table synchronization complexity (keeping external auth IDs in sync with internal `users`, `hosts`, and `bookings` tables), recurring per-MAU costs as international traffic scales, and vendor lock-in.
- **Architectural Recommendation:** **Option A (Self-managed PostgreSQL-backed auth in Fastify using Better Auth or custom JWT/refresh-token + Arctic OAuth)** is recommended for a modular monolith with complex internal relational integrity (`users` ↔ `travellers` ↔ `hosts` ↔ `staff`) and startup cost control. *Awaiting owner approval.*

---

### 3.2 Production Map Tile, Geocoding, and Routing Provider (`OQ-018`)
- **Status:** **Pending Approval**
- **Requirements Context:** MapLibre renders vector maps (`FR-3`), but requires a commercial provider for production vector tiles, place/address autocomplete (`FR -2 Location Search`), reverse geocoding (`FR-19`), and directions (`FR -7 Directions`).
- **Options Considered:**
  1. **Option A — MapTiler / Stadia Maps (Vector Tiles) + Google Places/Directions Deep Links (or Mapbox/AWS Location Service for Geocoding):**
     - *Pros:* Native MapLibre style compatibility, generous startup pricing tiers, high quality in Sri Lanka and globally; using native OS map deep links (`Google Maps` / `Apple Maps`) for `FR -7 Directions` provides superior turn-by-turn navigation at zero routing API cost.
  2. **Option B — AWS Location Service (Esri/Here data) for Tiles + Geocoding:**
     - *Pros:* Consolidated billing if backend runs on AWS EC2; pay-as-you-go pricing.
- **Architectural Recommendation:** Abstract geocoding behind a backend `GeocodingPort` and configure client MapLibre style URLs via environment variables. Recommend **MapTiler (or AWS Location Service)** for vector tiles + **native Google/Apple Maps deep-link handoff** (with optional in-app polyline preview) for `FR -7 Directions`. *Awaiting owner approval.*

---

### 3.3 Transactional Email Provider (`OQ-019`)
- **Status:** **Pending Approval**
- **Requirements Context:** Needed for email verification (`FR -1`), password resets, booking confirmations (`FR-7`, `FR-11`), host approval notifications (`FR-17`, `FR-35`), and payout advices (`FR-37`).
- **Options Considered:**
  1. **Resend** (Developer-friendly REST API, React Email support, generous free/startup tier).
  2. **Amazon SES** (Lowest unit cost at scale, natural fit if hosting on AWS EC2).
  3. **Postmark** (High transactional deliverability).
- **Architectural Recommendation:** Wrap behind an `EmailProviderPort` in `apps/api/src/integrations/email/`. **Resend** (for fast startup setup) or **AWS SES** (for lowest cost) are both fully compatible. *Awaiting owner approval.*

---

### 3.4 SMS / OTP Provider (`OQ-020`)
- **Status:** **Pending Approval**
- **Requirements Context:** Needed if phone number verification (OTP) or SMS booking alerts are enabled in Sri Lanka and internationally.
- **Options Considered:**
  1. **Local Sri Lankan SMS Gateway (e.g., Dialog / Hutch / Notify.lk / TextIt.biz) for `+94` numbers + Twilio / AWS SNS fallback for international numbers.**
  2. **Twilio Verify / AWS SNS globally.**
- **Architectural Recommendation:** Because international SMS providers (like Twilio) have high per-SMS termination rates into Sri Lanka (`+94`) compared to local Sri Lankan gateways, abstract SMS behind a country-routed `SmsProviderPort` that routes `+94` traffic to a Sri Lankan gateway and international `E.164` numbers to Twilio/SNS. Confirm whether SMS OTP is mandatory for MVP (`OQ-020`). *Awaiting owner approval.*

---

### 3.5 Redis / Upstash Deployment Timing (`OQ-021`)
- **Status:** **Pending Approval (Conditional / Deferred by Default)**
- **Requirements Context:** Approved stack specifies *"Redis/Upstash when justified by actual requirements."*
- **Architectural Recommendation:** In the initial launch, use **PostgreSQL** (`SKIP LOCKED` / scheduled cron workers inside Fastify and in-memory Fastify rate limiting) to avoid paying for an extra managed service on day one. Introduce **Upstash Redis / Managed Redis** only when horizontal multi-instance API scaling requires distributed rate limiting or high-frequency BullMQ job queues. *Awaiting owner confirmation.*

