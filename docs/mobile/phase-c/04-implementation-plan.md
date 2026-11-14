# Stage C0.4 — Phase C Mobile Production Readiness Implementation Plan

## 1. Execution Sequence & Staged Commits

1. **Stage C0 (Current Commit — Docs Only):** Complete audit matrices (`00`..`04`) in `docs/mobile/phase-c/`. Zero application code changes.
2. **Stage C1 + C2 — Design System & Vector Icon System:**
   - Install Expo SDK 58-compatible native packages (`react-native-svg@15.16.0`, `lucide-react-native`, `@react-native-community/datetimepicker@9.2.1`, `@react-native-async-storage/async-storage@2.2.0`, `expo-document-picker@~58.0.4`, `qrcode`, `@types/qrcode`) while keeping `expo.install.exclude: ["@types/react"]`.
   - Rebuild `src/components/MobileIcon.tsx` with a single consistent `lucide-react-native` vector family, typed `MobileIconName` union, zero bullet fallback, zero silent substitution, semantic color variants, and standard stroke/size tokens.
   - Replace all raw Unicode/emoji symbols across `app/**` and `src/**` and add `src/components/ui/QrCodeMatrix.tsx` (real SVG ISO QR rendering).
   - Build `__DEV__`-only Icon Catalogue (`app/(dev)/icons.tsx`) and 21 reusable CWCP UI components (`src/components/ui/*` exported from `src/components/index.ts`), enforcing `>= 48pt` touch targets, `react-native-safe-area-context`, accessibility labels/states, and unified CWCP styling (`app.json`, `app/_layout.tsx`, `app/index.tsx`, `(auth)/*`, `(account)/*`).
   - Document in `05-design-system.md` & `06-icon-system.md`.
3. **Stage C5 Foundation + Stage C3 — Query Layer, API Hardening & Complete Traveller App:**
   - Fix `api-client.ts` (`/api/v1` normalization, non-destructive network-error refresh handling, `429` retry-after parsing, `normalizeApiError`) and `useAuthStore.ts` (`mobileQueryClient.clear()` + store reset on logout/login switch, `refreshSessionAndUser()` for post-business role promotion).
   - Implement structured `queryKeys` & TanStack Query hooks (`src/hooks/*`) and complete `marketplace-api.ts` endpoint coverage (`searchAvailability`, `reportBookingException`, `hostCancelBooking`, `getHostBookingDetail`, `getBusinessPayoutDetails`, `getVerificationDocumentDownloadUrl`, `uploadFileToPresignedUrl`).
   - Implement `app/(auth)/verify-email.tsx`, deep-link token reading in `reset-password.tsx`, updated `(account)/*`, and complete API-backed Traveller screens (`_layout`, `index`, `explore`, `location`, `checkout`, `pass`, `bookings`, `saved`, `support`, `profile`, `onboarding`) with **strict fail-closed payment handoff** and zero production mock fallbacks.
   - Document in `07-traveller-workflows.md`.
4. **Stage C4 — Complete Host Application:**
   - Enforce auth & RBAC guard in `(host)/_layout.tsx` (Travellers invited to Become a Host via `/(host)/onboarding`; `HOST_STAFF` restricted to operational screens).
   - Build complete Host Onboarding & Verification (`onboarding.tsx` with business create/edit, automatic `refreshSessionAndUser()`, presigned R2 KYC uploads, verification submit & status tracking), real Host Dashboard (`index.tsx`), Location Management (`locations.tsx` + `location-editor.tsx` covering profile, photos, opening hours, exceptions, zones, capacity pools, pricing, submit/disable), Host Bookings (`requests.tsx` accept/reject/cancel), Custody Scanner/Intake/Vault (`scanner.tsx` -> `intake.tsx` -> `vault.tsx`), and Host Finance (`earnings.tsx` summary + payout details + payables list).
   - Document in `08-host-workflows.md`.
5. **Stage C6, C7, C8 & C9 — Verification, Visual Inspection, Security Audit & Final Reports:**
   - Reconcile existing test suites without disabling tests, add new unit/integration/E2E Traveller (12-step) & Host (13-step) and 9-case payment security suites in `apps/mobile/tests/`.
   - Inspect real rendered web export / Android device availability cleanly (honestly marking hardware unavailability as `BLOCKED`/`PARTIAL` if no physical device is connected).
   - Run full quality gates (`lint`, `typecheck`, `test`, `mobile export`, `verify`, `turbo run lint typecheck test build --force`), security bundle check, and complete `09`..`12` reports.
