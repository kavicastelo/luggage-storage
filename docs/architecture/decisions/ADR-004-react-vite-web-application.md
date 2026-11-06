# ADR-004: Unified React + Vite Web Application Serving Public, Host, and Superadmin Experiences

- **Status:** Accepted
- **Date:** 2026-11-07
- **Phase:** Phase 0A — Product Architecture & System Foundation
- **Related Documents:** [Application Architecture Boundaries](../application-boundaries.md), [Product Scope and Application Boundaries](../../product/product-scope-and-boundaries.md), [User Roles and Actor Model](../../product/user-roles-and-actors.md)

---

## 1. Context

The web channel must support three distinct user experiences:
1. **Public Traveller Website:** Location discovery, SEO landing pages, map search, and browser-based booking/checkout (`FR-1`–`FR-14`).
2. **Host Management Dashboard:** Desktop/tablet-optimized portal for single and multi-location hosts (`FR-15`–`FR-44`), complex pricing/capacity matrices, check-in/out operations, and earnings/payout tracking.
3. **Superadmin Dashboard:** Platform-level control plane for host verification approval (`FR-17`), manual host payout execution (`FR-37`), refund management (`FR-10`), incident investigation (`FR-41`), support queues (`FR-12`, `FR-40`), and system settings.

---

## 2. Decision

We will build a single **React + Vite + TypeScript** web application in `apps/web`, styled with **Tailwind CSS** and **shadcn/ui**, using **React Router**, **TanStack Query**, **Zustand**, **React Hook Form**, and **Zod**.

Within `apps/web`, the three experiences are strictly segregated into isolated route trees, layouts, navigation structures, and authorization guards:
- `/*` — Public & Traveller Web Experience
- `/host/*` — Host Management Dashboard (`HOST` / `HOST_STAFF` roles)
- `/admin/*` — Superadmin & Platform Operations Dashboard (`SUPERADMIN` / `PLATFORM_SUPPORT` roles)

Route-level code splitting (`React.lazy`) ensures each experience only loads its required JavaScript chunks.

---

## 3. Alternatives Considered

1. **Three Separate Web Applications (`apps/web-public`, `apps/web-host`, `apps/web-admin`):**
   - *Rejected:* Triples Vite build pipelines, Tailwind/shadcn setup, deployment targets, and shared component maintenance without necessity at initial scale.
2. **Server-Rendered Framework (Next.js):**
   - *Rejected:* Approved technology stack specifies **React + Vite + React Router**, which avoids Vercel/SSR hosting lock-in and deploys cleanly as static assets behind Cloudflare CDN talking to the Fastify REST API.

---

## 4. Consequences

### Positive
- **Single Design System & Component Library:** `shadcn/ui` primitives, data tables, form controls, and MapLibre GL JS components are shared seamlessly across all three web zones.
- **Zero SSR Hosting Cost:** The built web bundle can be served globally via Cloudflare Pages/CDN at near-zero cost.
- **Seamless Role Switching:** Users who are both Travellers and Hosts can transition between `/*` and `/host/*` smoothly.

### Negative / Trade-offs
- Client-side SPA routing requires proper meta-tag management (or pre-rendering/edge metadata injection) for SEO-critical public location landing pages.
- Strict client route guards and server-side RBAC are mandatory so `/admin/*` routes and data are never accessible to non-admin users.

---

## 5. Risks & Mitigations

- **Risk:** Admin UI routes or internal nomenclature being exposed in public web bundles.
  - **Mitigation:** Enforce dynamic `import()` route splitting per zone and ensure all sensitive data, configuration values, and actions require server-validated `SUPERADMIN` / `PLATFORM_SUPPORT` credentials on `/api/v1/admin/*`.

