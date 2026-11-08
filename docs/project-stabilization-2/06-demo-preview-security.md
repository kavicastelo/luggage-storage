# Phase 2 Stabilization Remediation — Demo Preview Boundaries & Protected Route Hardening (`AUD-007`)

**Date:** 2026-04-06  
**Finding Addressed:** `AUD-007` — Demo Preview Still Bypasses Protected Web Routes via Query Parameter  
**Status:** **RESOLVED & VERIFIED**

---

## 1. Finding Summary

During the independent audit (`AUD-007`), the web application (`apps/web`) allowed unauthenticated visitors or users lacking required roles (`HOST`, `SUPERADMIN`) to bypass `ProtectedRoute` checks simply by appending `?preview=demo` to URLs in any environment, including production builds.

While a UI preview mode is helpful during local Phase 2 design reviews, leaving an unguarded URL query parameter bypass active in production creates a confusing and unsafe boundary around protected routes (`/account/*`, `/host/*`, `/admin/*`).

---

## 2. Implemented Controls

### 2.1 Explicit Environment Gate (`apps/web/src/config/demo-preview.ts`)

We created a centralized configuration and route-authorization module in `apps/web/src/config/demo-preview.ts`:

1. **`isDemoPreviewConfigEnabled(env)`:**
   - Returns `false` in production builds (`PROD === true` or `MODE === 'production'`) **unless** `VITE_ENABLE_DEMO_PREVIEW === 'true'` is explicitly set at build/runtime.
   - Allows explicit opt-out in development/test when `VITE_ENABLE_DEMO_PREVIEW === 'false'`.
2. **`isDemoPreviewActive(search, env)`:**
   - Requires **both** `isDemoPreviewConfigEnabled(env) === true` **and** `?preview=demo` in the URL query string.
   - If `isDemoPreviewConfigEnabled(env)` is `false` (the default in production), `?preview=demo` is completely ignored.
3. **`evaluateRouteAuthorization(input)`:**
   - Pure, unit-testable function used by `ProtectedRoute`:
     - When `isLoading` is true, returns `{ status: 'loading' }`.
     - When authenticated with all required roles, returns `{ status: 'authorized' }`.
     - When authenticated but missing a required role (`HOST` or `SUPERADMIN`), returns `{ status: 'unauthorized_role' }` unless demo preview is explicitly enabled and active (`{ status: 'demo_preview' }`).
     - When unauthenticated, returns `{ status: 'unauthenticated' }` unless demo preview is explicitly enabled and active (`{ status: 'demo_preview' }`).

### 2.2 Component Updates

1. **`apps/web/src/components/auth/ProtectedRoute.tsx`:**
   - Replaced inline `searchParams.get('preview') === 'demo'` checks with `evaluateRouteAuthorization(...)`.
   - When `status === 'unauthenticated'` (including in production when `?preview=demo` is passed without `VITE_ENABLE_DEMO_PREVIEW=true`), redirects immediately to `/auth/login?redirect=...`.
   - When `status === 'unauthorized_role'`, renders the strict Access Restricted view with no demo bypass.
   - When `status === 'demo_preview'` (development or explicit preview deployment), renders a prominent `role="status"` banner (`UI Demo Preview Mode Active — Displaying synthetic UI preview placeholders only; no protected API data is loaded`).
2. **`apps/web/src/components/common/DeferredBackendNotice.tsx`:**
   - Only displays or preserves `?preview=demo` links when `isDemoPreviewConfigEnabled()` is `true`.
3. **`apps/web/src/pages/host/HostDashboardPages.tsx` & `apps/web/src/pages/admin/AdminDashboardPages.tsx`:**
   - Replaced raw `useSearchParams` checks (`searchParams.get('preview') === 'demo'`) with `isDemoPreviewActive(location.search)` so synthetic preview state is never activated in production unless `VITE_ENABLE_DEMO_PREVIEW=true`.

### 2.3 Environment Documentation

- Updated `apps/web/.env.example` to document `VITE_ENABLE_DEMO_PREVIEW=false` as the safe production default.

---

## 3. Automated Test Coverage

In `apps/web/tests/auth-flows.test.ts`, we added comprehensive unit tests covering:
- Production default (`PROD: true`, `MODE: 'production'`): `?preview=demo` is rejected; unauthenticated users receive `status: 'unauthenticated'` and unauthorized roles receive `status: 'unauthorized_role'`.
- Explicit preview override (`PROD: true`, `VITE_ENABLE_DEMO_PREVIEW: 'true'`): `?preview=demo` activates `status: 'demo_preview'`, while requests without `?preview=demo` remain blocked.
- Authenticated users with matching roles always receive `status: 'authorized'` regardless of preview settings.
