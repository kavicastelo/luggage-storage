# Phase 8 — Maps, Routing & Navigation Remediation Report

**Document:** `docs/release-readiness/03-maps-and-navigation-remediation.md`  
**Repository:** `https://github.com/kavicastelo/luggage-storage`  
**Phase:** 8 — Workstream 1: Maps, Routing & Navigation Remediation  
**Status:** COMPLETED & VERIFIED  
**Date:** November 19, 2026  
**Auditor:** Independent Release Readiness Auditor  

---

## 1. Executive Summary

In Phase 7, the platform introduced an in-app mapping, routing, and navigation system covering both Web (`LocationDiscoveryMap.tsx`) and Mobile (`InteractiveMobileMap.tsx`, `app/(traveller)/navigation.tsx`). 

During the Phase 8 baseline audit, two critical release candidate vulnerabilities were identified in the mapping domain:
1. **Silent Synthetic Fallback in Production:** In `apps/api/src/config/env.ts`, `MAPS_PROVIDER=sandbox` was permitted in production, and `MapTilerRoutingAdapter` caught network and parsing errors, falling back silently to simulated straight-line coordinates. In production, this would allow users to be guided on synthetic routes rather than real street networks without administrative awareness.
2. **Silent Geolocation Substitution:** On both Web and Mobile, when browser or device geolocation permission was denied or timed out, the system silently substituted Colombo Fort station coordinates (`6.9344, 79.8519`) without notifying the user that their current location was not being tracked.

Workstream 1 has resolved both issues with verified production guards, strict environment validation, and explicit user-facing consent/notice states.

---

## 2. Technical Remediation Details

### 2.1 Enforcing Production-Only Street Maps (`env.ts`)

In `apps/api/src/config/env.ts`, a strict production rule was added to `superRefine`:
- `MAPS_PROVIDER` cannot be `"sandbox"` in production (`NODE_ENV === "production"`).
- `MAPTILER_API_KEY` is strictly required when `MAPS_PROVIDER === "maptiler"` and cannot start with `dev_`, `test_`, `example`, or contain `REPLACE_WITH`.

```typescript
if (data.MAPS_PROVIDER === "sandbox") {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: "MAPS_PROVIDER cannot be 'sandbox' in production; synthetic sandbox routing is prohibited",
    path: ["MAPS_PROVIDER"]
  });
}
if (data.MAPS_PROVIDER === "maptiler") {
  if (!data.MAPTILER_API_KEY || data.MAPTILER_API_KEY.startsWith("dev_") || data.MAPTILER_API_KEY.includes("REPLACE_WITH")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "MAPTILER_API_KEY is required in production when MAPS_PROVIDER is 'maptiler'",
      path: ["MAPTILER_API_KEY"]
    });
  }
}
```

### 2.2 Prohibiting Silent Synthetic Fallback in Routing Adapters

In `apps/api/src/modules/maps/maptiler-routing.adapter.ts` and `maps.service.ts`:
- If running in production mode (`isProductionMode()`), any upstream failure from MapTiler (such as non-200 HTTP responses, missing API key, network timeout, or unresolvable coordinates) **fails closed** by throwing an `AppError.serviceUnavailable` (HTTP 503) with a machine-readable code (`EXTERNAL_ROUTING_UNAVAILABLE`, `EXTERNAL_ROUTING_SERVICE_FAILED`, `EXTERNAL_GEOCODING_FAILED`).
- Silent fallback to `SandboxRoutingAdapter` is exclusively restricted to non-production environments (`development`, `test`) to allow local monorepo development without third-party network egress.

### 2.3 Transparent Geolocation UX on Web (`LocationDiscoveryMap.tsx`)

In `apps/web/src/features/traveller/LocationDiscoveryMap.tsx`:
- When `navigator.geolocation` permission is denied (`err.code === 1`) or lookup times out, the component **does not silently overwrite** `userLocation`.
- Instead, an accessible warning banner (`role="alert"`) informs the user:
  > *"Location permission was denied. Tap 'Use Colombo Hub' to simulate a starting location, or allow access in your browser settings."*
- An explicit action button `"Use Colombo Hub"` allows travellers to deliberately choose the central transit hub as a demo starting location if desired.

### 2.4 Transparent Navigation Notice on Mobile (`navigation.tsx`)

In `apps/mobile/app/(traveller)/navigation.tsx`:
- When device GPS resolution fails via `getCurrentDeviceLocation()`, the screen sets a clear `locationNotice`:
  > *"Location permission was denied. Navigation is active using Colombo Central as a demo origin."*
- A dedicated banner (`testID="navigation-location-notice"`) is rendered prominently below the Maneuver HUD.
- The user is fully aware of their origin state and can retry device GPS at any point without unexpected coordinate jumping.

---

## 3. Verification & Evidence

Automated tests in `apps/api/tests/maps-routing.test.ts`, `apps/web/tests/interactive-maps-and-routing.test.tsx`, and `apps/mobile/tests/in-app-navigation.test.ts` verify the remediation:

1. **Environment Rejection Test:**
   ```typescript
   it("strictly rejects MAPS_PROVIDER=sandbox in production", () => {
     expect(() => {
       loadConfig({ ...validProdEnv, MAPS_PROVIDER: "sandbox" });
     }).toThrow(/MAPS_PROVIDER cannot be 'sandbox' in production/);
   });
   ```
   *Result:* **PASSED**.

2. **API Key Requirement Test:**
   ```typescript
   it("requires MAPTILER_API_KEY when MAPS_PROVIDER=maptiler in production", () => {
     expect(() => {
       loadConfig({ ...validProdEnv, MAPS_PROVIDER: "maptiler", MAPTILER_API_KEY: "" });
     }).toThrow(/MAPTILER_API_KEY is required in production/);
   });
   ```
   *Result:* **PASSED**.

3. **Fail-Closed Adapter Test:**
   ```typescript
   it("fails closed without returning synthetic route if MapTiler key is missing in production", async () => { ... });
   ```
   *Result:* **PASSED**.

4. **Component State Tests:**
   All 12 backend routing tests, 3 web routing tests, and 5 mobile navigation tests pass with 100% green status.

