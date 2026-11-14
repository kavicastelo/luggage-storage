# Phase C3 & C5 — Traveller Workflows, API Hardening & Query Layer

## 1. API Client & Auth Hardening (C5)

- **Environment & URL Normalization (`apps/mobile/src/services/api-client.ts`)**:
  - Added `normalizeApiBaseUrl(rawUrl?)` so host-only `EXPO_PUBLIC_API_URL` values (e.g., `http://192.168.8.181:3000`) automatically normalize to `<host>/api/v1` while defaulting to `http://localhost:3000/api/v1`.
  - Updated `getApiBaseUrl()` to evaluate dynamically via `normalizeApiBaseUrl(process.env.EXPO_PUBLIC_API_URL)`.
  - Added `fetchWithTimeout` (15s `AbortController`) and `parseJsonSafe` for both initial requests and post-refresh retries.
  - Added `Retry-After` parsing (`ApiClientError.retryAfterSeconds`) and `normalizeApiError(error)` classification (`isNetworkError`, `isRateLimited`, `isAuthError`).
  - Expanded `isAuthEndpoint` to skip automatic 401 refresh loops on `/auth/change-password`, `/auth/verify-email`, `/auth/resend-verification`, `/auth/forgot-password`, and `/auth/reset-password`.
  - Updated `refreshAccessToken()` to delete the SecureStore refresh token ONLY on `401` / `403` (or empty token payloads), preserving credentials across transient network/offline errors.
- **Session Isolation (`apps/mobile/src/store/useAuthStore.ts`, `useMobileStore.ts`)**:
  - `clearAuth()`, `setAuthFailureHandler`, and account switches inside `login()` now invoke `mobileQueryClient.clear()` and `useMobileStore.getState().resetTransientState()`.
  - Added `refreshSessionAndUser()` so newly granted permissions (such as `HOST_OWNER` after host onboarding) sync immediately.
  - `initAuth()` preserves SecureStore refresh tokens when offline (`statusCode === 0`, `TypeError`, or `AbortError`) while continuing to clear invalid/revoked tokens.
- **Typed Query Hooks (`apps/mobile/src/hooks/*`) & Local Saved Hubs (`useSavedLocationsStore.ts`)**:
  - Added `useDiscoveryQueries.ts`, `useBookingQueries.ts`, and `useHostQueries.ts` bound to `mobileQueryKeys`.
  - Added `useSavedLocationsStore` backed by `@react-native-async-storage/async-storage` (`bagbox_saved_location_ids_v1`) explicitly labeled `"Saved on this device"` in the UI.

## 2. Rebuilt Traveller Screens (`apps/mobile/app/(traveller)/*`)

- **`_layout.tsx`**: CWCP Navy (`#0A192F`) / Terracotta (`#EA580C`) tab navigation across the 5 primary routes (`Explore`, `My Storage`, `Saved`, `Support`, `Account`) with `useSafeAreaInsets()`.
- **`index.tsx` & `explore.tsx` via `src/components/DiscoveryView.tsx`**:
  - Live `GET /discovery/locations` search + Sri Lanka city chips (`All`, `Colombo`, `Kandy`, `Galle`, `Ella`, `Negombo`) + keyword filter.
  - `expo-location` `"Near Me"` radius toggle with graceful permission-denied fallback.
  - Collapsible live capacity/quote availability filter via `GET /availability/search` (`DateTimeSelector` + bag counters).
  - Authenticated active-booking banner linking directly to Checkout or Digital Custody Pass.
  - Zero `DEMO_LOCATIONS` imports.
- **`location.tsx`**: Live `GET /discovery/locations/:locationId` + preview `POST /bookings/quote`, `ImageGallery`, `OQ-012` approximate coordinate disclosure, operating hours, amenities, custody protection overview, and honest `"No verified reviews yet"` notice (no fabricated ratings).
- **`checkout.tsx`**:
  - 3-step live wizard (`Schedule` -> `Bags` -> `Review & Pay`) plus `?bookingId=` resumption for `PENDING_PAYMENT` bookings.
  - Live server quotations rendered via `<PriceSummary />`; blocks advance when unavailable or invalid schedule.
  - Enforces strict fail-closed payment handling: external PayHere checkout (`REDIRECT_TO_PROVIDER` + `isPayHerePostHandoff` validation + `resolveMobileHandoffUrl` + `openExternalPayHereHandoff` + `AppState` / bounded `getCheckoutStatus` polling) or sandbox simulation ONLY when both `nextAction === "SANDBOX_SIMULATION"` and `checkoutHandoff.mode === "SANDBOX_SIMULATION"`, verifying `getCheckoutStatus` before navigating to `/pass`. Unknown actions or missing handoff payloads fail closed.
- **`pass.tsx`**:
  - Unlocks strictly for `CONFIRMED` or `IN_STORAGE` via `getBookingDetail` + `issueCustodyPass`.
  - Renders scannable SVG `<QrCodeMatrix />`, formatted 6-digit PIN fallback, regeneration control, unlocked exact address + Google Maps directions, and non-sensitive local offline pass caching (`AsyncStorage`) honored only prior to `expiresAt`.
- **`bookings.tsx`, `saved.tsx`, `support.tsx`, `profile.tsx`, `onboarding.tsx`**:
  - Live bookings tabs (`Active`, `Completed`, `Cancelled`), `STANDARD_FLEX_2H` cancellation dialog, `BottomSheet` exception reporting (`POST /bookings/:id/exceptions`), local saved locations hydration (`AsyncStorage` + `getPublicLocationDetails`), honest FAQ/incident submission, account profile/security/sessions routing, host workspace entry, and `__DEV__`-only Icon Catalogue link.
