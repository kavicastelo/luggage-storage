# Initiative 7 — WS-7.3 Mobile Integration & Parity Report

---

## 1. Summary of Mobile Changes (`apps/mobile`)
1. **Self-Service Profile (`app/(account)/profile.tsx`, `src/services/auth-api.ts`):**
   - Integrated `GET /identity/profile` and `PATCH /identity/profile`, added interactive edit mode (`displayName`, `phoneNumber`, `firstName`, `lastName`, `preferredLanguage`, `preferredCurrency`, `emergencyContactName`, `emergencyContactPhone`), and removed exposed `sessionId` and raw `permissions` chips.
2. **Persisted Support Tickets (`app/(traveller)/(tabs)/support.tsx`, `src/services/marketplace-api.ts`, `src/hooks/useBookingQueries.ts`):**
   - Integrated `POST /support/tickets`, `GET /support/tickets/me`, `GET /support/tickets/me/:ticketId`, and `POST /support/tickets/me/:ticketId/messages` alongside existing FAQs and booking exceptions.
3. **Host Staff Management (`app/(host)/settings.tsx`, `src/services/marketplace-api.ts`, `src/hooks/useHostQueries.ts`):**
   - Replaced stale `"Dedicated self-service staff invitation links are not currently exposed in the API contract"` notice with live `GET/POST/PATCH/DELETE /hosts/businesses/:businessId/staff` staff listing, role/hub assignment, activation toggle, and removal controls (enforcing `isOwner` RBAC guard).
4. **Host Payout Batches (`app/(host)/earnings.tsx`, `src/hooks/useHostQueries.ts`):**
   - Integrated `GET /hosts/finance/payout-batches` (`Settlement Payout Batches`) displaying batch code, status, net payout, method, and bank wire reference.
5. **Schedule Exception Removal (`app/(host)/location-editor.tsx`):**
   - Replaced stale `"Existing exceptions are read-only on mobile."` notice with `DELETE /hosts/locations/:locationId/exceptions/:exceptionId` removal buttons.
6. **Operating-Hours Integrity (`LocationCard.tsx`, `location.tsx`, `checkout.tsx`):**
   - Removed `"08:00 - 20:00"` fallback and rendered explicit `"Hours not configured"` / `"Operating hours not configured"` when `operatingHoursSummary` is `null`.

---

## 2. Updated Coverage Matrix & Remaining Parity-Gap Register
- Updated `docs/mobile/phase-c/02-api-coverage-matrix.md` to reflect Initiative 3–7 backend and mobile parity.
- **Remaining Parity Gaps (Explicitly Documented, No Fake UI):**
  1. **Custody Evidence Photo Upload (`app/(host)/intake.tsx`):** `localPhotoUri` is captured on-device; `CUSTODY_EVIDENCE` presigned R2 upload + `photoFileKey` submission remains a deferred mobile enhancement.
  2. **Zone/Media Edit & Delete on Mobile (`app/(host)/location-editor.tsx`):** Backend supports `PATCH/DELETE` for zones and media; currently exception deletion is wired on mobile while zone/media deletion remains available on Web (`HD-004`, `HD-005`).
  3. **Physical Device / Simulator Verification:** Verified via TypeScript (`tsc --noEmit`), ESLint, Expo bundle export (`expo export --no-bytecode`), and 19 Vitest suites (`124` tests); iOS/Android physical-device runtime execution was not performed in this environment.

