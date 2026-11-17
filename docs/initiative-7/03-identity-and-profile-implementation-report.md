# Initiative 7 — WS-7.2 Identity & Profile Implementation Report

---

## 1. Shared Contracts (`packages/contracts`)
- Reused `packages/contracts/src/identity/index.ts` (`UserProfileDataSchema`, `UserProfileResponseDataSchema`, `UpdateTravellerProfileSchema`, `UpdateProfileRequestSchema`, `UpdateProfileResponseDataSchema`).
- Hardened `UpdateProfileRequestSchema` and `UpdateTravellerProfileSchema` with `.strict()` so mass-assignment attempts (`roles`, `status`, `isEmailVerified`, `id`, `userId`, `permissions`) fail Zod validation (`400 Bad Request`) immediately, and allowed nullable `phoneNumber` for clearing phone numbers.
- Added `SecurityEventType.IDENTITY_PROFILE_UPDATED` to `packages/contracts/src/audit/index.ts`.

---

## 2. Backend Identity Module (`apps/api/src/modules/identity/`)
- **`identity.service.ts` (`IdentityService`):**
  - `getProfile(userId)`: Queries `users`, `user_roles` + `roles`, `rbacService.getEffectivePermissions(userId)`, `traveller_profiles`, and `host_profiles`.
  - `updateProfile(userId, rawInput, clientInfo)`: Derives target user strictly from authenticated `request.user.sub`, updates only whitelisted `users.displayName` and `users.phoneNumber`, upserts `traveller_profiles` via `onConflictDoUpdate` on `traveller_profiles.userId`, and logs `IDENTITY_PROFILE_UPDATED` to `security_audit_events`.
- **`identity.routes.ts` (`identityRoutes`):**
  - `GET /profile` (`preHandler: [app.authenticate]`)
  - `PATCH /profile` (`preHandler: [app.authenticate]`)
- **`app.ts`:** Registered `identityRoutes` under `${env.API_PREFIX}/identity` and `/identity`.

---

## 3. Web & Mobile Profile Integration
- **Web (`apps/web/src/services/auth-api.ts`, `apps/web/src/pages/ProfilePage.tsx`):**
  - Added `authApi.getIdentityProfile()` and `authApi.updateIdentityProfile(data)`.
  - Replaced the read-only screen with full profile editing (`displayName`, `phoneNumber`, `firstName`, `lastName`, `preferredLanguage`, `preferredCurrency`, `emergencyContactName`, `emergencyContactPhone`), client-side `UpdateProfileRequestSchema.safeParse`, loading/error/success feedback, and `refreshUser()` sync.
  - Removed internal `user.id`, `sessionId`, and raw `permissions` matrix from the user-facing screen.
- **Mobile (`apps/mobile/src/services/auth-api.ts`, `apps/mobile/app/(account)/profile.tsx`):**
  - Added `authApi.getIdentityProfile()` and `authApi.updateIdentityProfile(data)`.
  - Replaced the stale read-only notice and removed `user.id`, `sessionId`, and raw `permissions` chips; implemented mobile edit mode with `CurrencyCodeSchema` selection and `refreshUser()` sync.

---

## 4. Verification
- `apps/api/tests/initiative-7-closure.test.ts` (Test #4): Verified `401` unauthenticated access, `GET`/`PATCH` persistence across `users` and `traveller_profiles`, `400` mass-assignment rejection (`roles`, `status`, `id`), invalid phone rejection, and `IDENTITY_PROFILE_UPDATED` audit logging.
- `apps/web/tests/initiative-7-profile-and-integrity.test.tsx` (Tests #1, #2) & Playwright `e2e/06-profile-management.spec.ts`: Verified Web edit, reload persistence from PostgreSQL, and API mass-assignment rejection.
- `apps/mobile/tests/initiative-7-mobile-parity.test.ts` (Tests #1, #3): Verified Mobile `/identity/profile` client calls and removal of internal fields.

