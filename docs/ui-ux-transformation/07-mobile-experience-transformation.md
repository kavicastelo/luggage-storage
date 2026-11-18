# 07 — Expo Mobile Experience Transformation (WS-UX-07)

**Date**: 2026-11-18  
**Scope**: `apps/mobile/app/**/*`, `apps/mobile/src/components/DiscoveryView.tsx`  
**Design System**: Coastal Warmth & Colonial Precision (CWCP)

---

## 1. Brand Identity & Typography Unification
- Unified all remaining `"BagBox"` / `"BagBox Sri Lanka"` customer-facing copy to `"LuggageStorage"` / `"LuggageStorage Sri Lanka"` across:
  - `apps/mobile/src/components/DiscoveryView.tsx`
  - `apps/mobile/app/(traveller)/(tabs)/index.tsx`
  - `apps/mobile/app/(traveller)/(tabs)/profile.tsx`
  - `apps/mobile/app/(traveller)/onboarding.tsx`
  - `apps/mobile/app/index.tsx` (navy CWCP hero card with `"LuggageStorage Sri Lanka"` and `"How LuggageStorage Works"` link to `/(traveller)/onboarding`).
- Applied `fontFamily: "monospace"` and `fontVariant: ["tabular-nums"]` on `pinValue`, `ticketRef`, and enlarged QR modal headers in `apps/mobile/app/(traveller)/pass.tsx`, as well as booking reference codes in `apps/mobile/app/(traveller)/(tabs)/bookings.tsx`.

---

## 2. P0 Safe-Area, Navigation & Duplicate UI Fixes
- **`apps/mobile/src/components/DiscoveryView.tsx` & `apps/mobile/app/(traveller)/explore.tsx`**:
  - Added `useSafeAreaInsets()` so `heroHeader` applies `paddingTop: Math.max(insets.top + mobileSpacing[3], mobileSpacing[5])` to avoid status bar/notch collisions.
  - Added 250ms search query debouncing (`debouncedSearchTerm`).
  - Moved the inline `Dates & Bags` form into a `BottomSheet` (`filterSheetVisible`) paired with a compact active filter summary chip + Clear button above the results list.
  - Replaced raw status enum text in `activeBannerBooking` with `<StatusBadge status={activeBannerBooking.status} size="sm" />`.
  - Added `showBackButton` support for `/(traveller)/explore`.
- **`apps/mobile/app/booking/confirm.tsx`**:
  - Moved `<SafeHeader>` into `ScreenContainer`'s `header` prop instead of inside the scrollable body.
  - Removed duplicate action buttons below `PaymentStatusPanel`, passing `onOpenPass` directly to `PaymentStatusPanel` when `statusData.custodyReady` is true.
- **`apps/mobile/app/(host)/_layout.tsx`**:
  - Added `useSafeAreaInsets()` so `tabBarStyle` uses `height: 62 + insets.bottom` and `paddingBottom: Math.max(insets.bottom, 8)`, while preserving all 5 operational tabs, hidden `href: null` routes, `useAuthStore`, and `"RBAC Guard • 403 Forbidden"`.
- **`apps/mobile/app/(traveller)/checkout.tsx` & `apps/mobile/app/(auth)/login.tsx`**:
  - Passed `redirectTo` (including `locId` or `bookingId`) when navigating from checkout to `/(auth)/login`, and normalized `redirectTo` in `login.tsx` after sign-in.
  - Removed duplicate `handoffButtons` below `PaymentStatusPanel` in the `awaitingCheckout` state.
  - Removed redundant `<Card><FormSection>` double card wrappers.
  - Made `stepPill`s tappable (`TouchableOpacity`) to navigate back to earlier completed steps (or jump forward when valid).
  - Made PayHere billing details collapsible (`billingExpanded`) with a compact pre-filled summary and hidden for `HOST_APPROVAL` requests.
  - Added a sticky bottom summary + primary CTA footer via `ScreenContainer`'s `footer` prop while preserving `width: 48` / `height: 48` touch targets and the `"Decoupled Custody Policy Disclosure"`.

---

## 3. One-Handed Host Counter Ergonomics
- **`apps/mobile/app/(host)/scanner.tsx`**:
  - Replaced the stacked reservation list with a compact active reservation pill + `BottomSheet` selector (`bookingSheetOpen`).
  - Placed a segmented toggle (`"Camera Scanner"` | `"6-Digit PIN Fallback"`) at the top so counter staff can scan or enter a PIN with one thumb.
  - Added a framing reticle overlay inside `cameraBox`, `"Scan Next"` reset control, and removed `<Card><FormSection>` double wrapping.
- **`apps/mobile/app/(host)/intake.tsx`**:
  - Replaced stacked `SelectionCard` lists for `BAG_CATEGORIES` and storage zones with compact horizontal scrollable pill chips (`minHeight: 44`).
  - Removed `<Card><FormSection>` double wrapping and pinned `"Confirm Check-In into Vault"` in a sticky `footer`.
- **`apps/mobile/app/(host)/index.tsx`**:
  - Fixed `scopedBookings` to filter strictly to `activeLocation.id` so an empty hub shows an honest empty queue rather than silently falling back to other hubs' bookings.
  - Styled the `salute` `MascotIllustration` with `variant="hero"` inside the dark navy card.
  - Moved multi-hub switching into a compact trigger pill + `BottomSheet` (`host-hub-switcher-sheet`).
- **`apps/mobile/app/(host)/requests.tsx`**:
  - Added a live pending count badge on the `Pending` tab.
  - Tracked `pendingAcceptId` per booking so approving one request only shows loading state on that booking's button.
  - Surfaced `modalError` inside open `BottomSheet` and `ConfirmDialog` modals and replaced `<Badge>` action banners with clean inline status boxes.
- **`apps/mobile/app/(host)/vault.tsx`**:
  - Sorted overdue bookings to the top of `Active Vault` and added a 30-second interval timer to refresh `nowMs`.
  - Assigned `mascot="alarm-clock"` on the Overdue empty state and `mascot="suitcase-hug"` on Active/Released empty states.

---

## 4. De-cluttering Monolithic Forms
- **`apps/mobile/app/(traveller)/(tabs)/support.tsx`**:
  - Replaced the single-scroll stack with segmented mode tabs (`My Tickets` | `Report Issue` | `FAQs`), compact category chips, `MascotIllustration` (`thinking` / `phone`), and removed `<Card><FormSection>` double wrapping.
- **`apps/mobile/app/(host)/location-editor.tsx`**:
  - Split the editor into 5 horizontal segmented tabs (`Profile` | `Photos` | `Hours` | `Zones & Pools` | `Pricing & Publish`), removed `<Card><FormSection>` double wrapping, and converted amenities, exception types, zone types, pool types, and pricing units into compact pill chips.
- **`apps/mobile/app/(host)/onboarding.tsx`**:
  - Refactored into a 3-step wizard (`1. Business` -> `2. Payout Bank` -> `3. KYC Docs`), removed `<Card><FormSection>` double wrapping, converted entity/document types to pill chips, and added `<MascotIllustration mascot="selfie" />` on step 3.
- **`apps/mobile/app/(host)/settings.tsx`**:
  - Moved counter staff invitation into a `BottomSheet` with pill-chip role/hub selectors, added a `ConfirmDialog` before removing staff members, tracked `pendingStaffId` per row, and removed the bottom border on the last `SettingsMenuRow`.
- **`apps/mobile/app/(host)/earnings.tsx`**:
  - Replaced the narrow 3-column KPI row with a 2-up row (`Accrued` + `On Hold`) paired with a full-width `Settled Paid` summary card, and added segmented tabs (`Transactions` | `Payout Batches`).

---

## 5. Auth, Account, Pass, Bookings & Onboarding Polish
- **`apps/mobile/app/(auth)/*`** (`login.tsx`, `register.tsx`, `forgot-password.tsx`, `reset-password.tsx`, `verify-email.tsx`):
  - Added `MascotIllustration` (`key`, `jump`, `phone`), `returnKeyType="next"` focus chaining via `TextInput` refs, and clean inline status boxes instead of multi-sentence `<Badge>` pills.
- **`apps/mobile/app/(account)/*`** (`_layout.tsx`, `profile.tsx`, `security.tsx`, `sessions.tsx`):
  - Aligned `(account)/_layout.tsx` bottom tab bar to CWCP `navy[900]` + `terracotta[500]` with safe-area insets.
  - Enabled `keyboardAvoiding` on `profile.tsx` and replaced `SelectionCard` currency wall with compact chips.
  - Replaced long `<Badge>` in `security.tsx` with an inline success box + focus chaining, and guarded `"Sign Out From All Devices"` in `sessions.tsx` when `sessions.length === 0`.
- **`apps/mobile/app/(traveller)/*`**:
  - `pass.tsx`: Added tap-to-enlarge QR `Modal` and Share/Copy Ref & PIN helper.
  - `onboarding.tsx`: Converted slides into a horizontal swipeable `ScrollView` with `pagingEnabled` and tappable pagination dots.
  - `bookings.tsx`: Added `sleeping` mascot on empty Past tabs and inline success banner for `actionBanner`.
  - `profile.tsx`: Mapped raw role codes (`TRAVELLER`, `HOST_OWNER`, etc.) to human-readable labels and removed the bottom divider on the final `MenuRow`.

---

## 6. Verification
- `pnpm --filter @luggage-storage/mobile typecheck` — **Passed** (`0` TypeScript errors)
- `pnpm --filter @luggage-storage/mobile test` — **Passed** (`19` test files, `124` tests passing)
