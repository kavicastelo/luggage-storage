# Stage C0 — Independent Mobile Application Audit

**Project:** Global Luggage Storage Marketplace (`kavicastelo/luggage-storage`)  
**Target Market:** Sri Lanka (`LKR`)  
**Stage:** C0 — Repository & Mobile Application Audit (Pre-Implementation Baseline)  
**Baseline Commit:** `1b1065d543efcc10c9d6b1e6559aa40979dbd216` (branch `dev`)  
**Runtime Stack:** Expo SDK `~58.0.23`, Expo Router `~58.0.30`, React Native `0.88.1`, React `19.3.0`, React Native Web `~0.21.4`, TypeScript `~6.0.3`, Zustand `^4.5.2`, TanStack Query `^5.32.0`, Zod `^4.6.7`.

---

## 1. Executive Summary

Independent source inspection of `apps/mobile`, `apps/api`, `packages/contracts`, and `docs/product/ux/master-screen-registry.md` confirms that Phase A and Phase B backend capabilities (authentication, RBAC, sessions, email verification, host business onboarding, R2 presigned uploads, location configuration, capacity pools, pricing policies, geospatial privacy-safe discovery, server-authoritative quotations, transactional booking holds, PayHere checkout handoff + webhook verification, HMAC custody passes, counter check-in/out custody, and host finance payables) are implemented and verified in `apps/api`.

However, `apps/mobile` currently operates as a **mixed prototype**: while `auth-api.ts`, `useAuthStore.ts`, `secure-storage.service.ts`, and parts of `checkout.tsx`, `pass.tsx`, `bookings.tsx`, `requests.tsx`, `intake.tsx`, `vault.tsx`, and `earnings.tsx` invoke backend endpoints, critical consumer and host screens still rely on hardcoded demo fixtures (`DEMO_LOCATIONS`, `DEMO_BOOKINGS`, `DEMO_HOST_BOOKINGS`, `DEMO_HOST_TRANSACTIONS`, `DEMO_SCANNER_FIXTURES`), suffer from broken native icons, lack safe-area handling, and bypass TanStack Query caching.

Baseline verification prior to Phase C edits:
- `pnpm --filter @luggage-storage/mobile test`: **13 files passed, 101 tests passed**.
- Local Android SDK check (`$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe`): `NO_ANDROID_SDK_ADB` (physical Android device / emulator not available on this Windows host at audit time).

---

## 2. Critical Defect Categories Verified in Source

### 2.1 Defective Native Icon System (High Severity)
- `apps/mobile/src/components/MobileIcon.tsx:251-308`:
  - Line `257`: `const paths = ICON_PATHS[name] || ICON_PATHS.info;` silently substitutes the `info` icon for unrecognized names instead of failing loudly or typing strictly.
  - Lines `260-298`: On Web (`Platform.OS === "web"`), renders browser `<svg>` tags directly.
  - Lines `300-307`: On Native iOS/Android (`Platform.OS !== "web"`), renders a `<Text>` fallback: `{name === "search" ? "🔍" : name === "star" ? "★" : "•"}`. **41 of 43 icons render as a `"•"` bullet on Android and iOS**, and `search`/`star` render platform emojis.
- `react-native-svg` is NOT installed in `apps/mobile/package.json` (`bundledNativeModules.json` specifies `15.16.0` for Expo SDK 58), nor is `lucide-react-native` installed.
- `apps/mobile/app/(traveller)/pass.tsx:187` renders `<MobileIcon name="qr-code" size={160} />` (a fixed decorative icon) rather than encoding `issuedPass.qrToken` into a scannable ISO/IEC 18004 QR matrix.
- Raw Unicode/emoji glyphs (`📱`, `💻`, `✓`, `←`, `✕`, `•`) appear directly in `(account)/sessions.tsx:130`, `(auth)/register.tsx:85`, `(auth)/reset-password.tsx:70,95`, `components/MobileDevDrawer.tsx:44`, and elsewhere.

### 2.2 Design System & Layout Consistency Defects
- **Zero Safe-Area Integration:** `react-native-safe-area-context` (`~5.11.1`) is declared in `apps/mobile/package.json:36`, yet has **0 imports** across the entire `app/` and `src/` trees. Custom headers collide with device status bars/notches, and bottom tab bars (`(traveller)/_layout.tsx:16`, `(host)/_layout.tsx:108`) hardcode `height: 62, paddingBottom: 8` without bottom inset padding.
- **Split Design Personality:** While CWCP tokens exist in `@luggage-storage/contracts` (`src/tokens.ts`) and `apps/mobile/src/lib/theme.ts`, legacy slate-blue (`#2563eb` / `#f8fafc`) remains hardcoded across:
  - `app.json:17,31` (Android adaptive icon & splash background `#2563eb`)
  - `app/_layout.tsx:27,58`
  - `app/index.tsx`
  - `app/(auth)/login.tsx`, `register.tsx`, `forgot-password.tsx`, `reset-password.tsx`
  - `app/(account)/_layout.tsx`, `profile.tsx`, `security.tsx`, `sessions.tsx`
  - `app/(host)/_layout.tsx`, `earnings.tsx`, `index.tsx`, `settings.tsx`
- **Touch Target & Accessibility Gaps:**
  - `src/components/Button.tsx:160-163` sets `sizeSm` `minHeight: 40` (below 44pt/48dp accessibility touch-target standards).
  - No standardized `ScreenContainer`, `SafeHeader`, `BottomNavigation`, `IconButton`, `TextInput`, `SearchInput`, `DateTimeSelector`, `SelectionCard`, `LocationCard`, `PriceSummary`, `StatusBadge`, `EmptyState`, `LoadingSkeleton`, `ErrorState`, `ConfirmDialog`, `BottomSheet`, `FormSection`, `ImageGallery`, `BookingSummary`, or `PaymentStatusPanel` component suite exists.
  - `app/(account)/sessions.tsx:61` uses `Alert.alert(...)` (non-functional on web and lacks keyboard/modal consistency).

### 2.3 Traveller Workflow Gaps & Production Mock Contamination
- **Environment Misconfiguration (`apps/mobile/.env`):** Currently `EXPO_PUBLIC_API_URL=http://192.168.8.181:3000` (missing `/api/v1` prefix, causing 404 errors unless normalized).
- **Missing Email Verification Route:** `(auth)/login.tsx:81` and `(auth)/register.tsx:102` route to `/(traveller)?screen=TM-008`, which `app/(traveller)/index.tsx` ignores — no `verify-email` screen exists on mobile even though `authApi.verifyEmail` and `authApi.resendVerification` exist. `(auth)/reset-password.tsx` does not read `?token=` query params from deep links.
- **Home (`app/(traveller)/index.tsx`):** Zero API calls; renders `DEMO_BOOKINGS` (banner `#LS-2026-8841` even when signed out!) and `DEMO_LOCATIONS`.
- **Explore (`app/(traveller)/explore.tsx`):** Falls back to `DEMO_LOCATIONS` and fabricates `rating: 4.8`, `reviewCount: 24`, `insuranceLimitLkr: 250000`, `totalCapacity: 50`.
- **Location Details (`app/(traveller)/location.tsx`):** 100% `DEMO_LOCATIONS` lookup (`getPublicLocationDetails` is never called — passing any real API location UUID silently renders `DEMO_LOCATIONS[0]`).
- **Checkout (`app/(traveller)/checkout.tsx`):**
  - Looks up location exclusively in `DEMO_LOCATIONS`.
  - Renders static non-interactive `"Today • Nov 09"` schedule pills while API payloads hardcode `Date.now() + 24h` to `+33h`.
  - Runs fake `setTimeout(..., 800)` navigation to `/(traveller)/pass` when unauthenticated or when location ID is not a UUID.
  - Contains dangerous fail-open fallback: if PayHere action is not matched, falls through to calling `marketplaceApi.simulateSandboxPayment(...)` regardless of server `nextAction`.
- **Bookings (`app/(traveller)/bookings.tsx`):**
  - Displays 4 mock `DEMO_BOOKINGS` whenever the authenticated user has 0 bookings.
  - Maps `PENDING_PAYMENT` and `PENDING_HOST_APPROVAL` to `"CONFIRMED"`, masking payment/approval requirements.
  - Active tab's custody pass button omits `?bookingId=...`.
  - Cancel handler swallows errors (`catch {}`) and applies optimistic local state mutation; includes fake `setTimeout` extend modal and fake review modal.
- **Custody Pass (`app/(traveller)/pass.tsx`):** Spreads `...demoBooking` (`SEAL-LK-90211`, `+94 11 234 5678`) underneath live server bookings and renders a static QR icon instead of a scannable QR code for `issuedPass.qrToken`.

### 2.4 Host Workflow Gaps & Security/RBAC Issues
- **Unauthenticated Host Demo Access (`app/(host)/_layout.tsx`):** Permits unauthenticated users into full interactive Host tabs backed by `useHostStore`.
- **Host Onboarding & Location Setup Missing:** Zero mobile UI for business registration (`POST /hosts/businesses`), KYC presigned document upload (`POST /uploads/presigned-url` -> `PUT` -> `confirm`), verification submission (`POST /hosts/businesses/:id/verification`), location create/edit/submit/disable, weekly opening hours, schedule exceptions, storage zones, capacity pools, or pricing policy configuration.
- **Role Token Staleness Hazard:** After `POST /hosts/businesses`, PostgreSQL assigns `HOST_OWNER`, but the existing mobile access JWT retains stale claims until `POST /auth/refresh` + `GET /auth/me` is executed.
- **Live Desk (`app/(host)/index.tsx`) & Vault (`app/(host)/vault.tsx`):** 100% bound to mock `useHostStore` (`DEMO_HOST_BOOKINGS` & hardcoded zones `Rack Zone A` / `Locker Zone B` / `Floor Zone C`).
- **Requests (`app/(host)/requests.tsx`):** Falls back to `DEMO_HOST_BOOKINGS` and maps `PENDING_HOST_APPROVAL` -> `"CONFIRMED"`, hiding Approve/Reject actions.
- **Scanner & Intake (`app/(host)/scanner.tsx`, `intake.tsx`):** Scanner bypasses `verifyCustodyPass` when opened from Live Desk without `bookingId`, exposes `DEMO_SCANNER_FIXTURES`, and intake discards captured photos without uploading while hardcoding `BAG_MEDIUM`.
- **Finance (`app/(host)/earnings.tsx`):** Falls back to fake `LKR 24,004` when payables are empty and always renders `DEMO_HOST_TRANSACTIONS` instead of `liveFinance.payables`.

### 2.5 API Client & State Management Defects
- **TanStack Query Unused:** `QueryClientProvider` wraps the root app (`app/_layout.tsx:46`), but **0** `useQuery` and **0** `useMutation` hooks exist anywhere in `apps/mobile`.
- **Cross-Account Cache Leak Risk:** `useAuthStore.logout()`, `logoutAll()`, and `clearAuth()` never call `queryClient.clear()` or reset role stores.
- **Destructive Offline Handling:** `api-client.ts:122-128` (`refreshAccessToken`) and `useAuthStore.ts:111-116` (`initAuth`) delete persisted `SecureStore` refresh tokens on any transient network/timeout error rather than only on auth rejection (`401`/`403`).
- **Missing API Helpers & Dead Helper:** `marketplace-api.ts` lacks `searchAvailability`, `reportBookingException`, `hostCancelBooking`, `getHostBookingDetail`, `getBusinessPayoutDetails`, `getVerificationDocumentDownloadUrl`, and presigned `PUT` upload execution.
