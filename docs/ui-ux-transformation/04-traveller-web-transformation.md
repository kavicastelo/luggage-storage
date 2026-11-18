# Workstream WS-UX-04: Traveller Web, Auth, Account, System & AppShell UI/UX Transformation

## Overview

This document summarizes the UI/UX transformation executed for Workstream **WS-UX-04** under the **Ceylon Warmth & Coastal Precision (CWCP)** design system across the customer-facing web shell, custody pass card, traveller marketplace journeys, static informational pages, authentication/account settings, and system/error routes.

All business logic, API hooks, mutations, RBAC guards, PayHere checkout handoff behavior, financial calculations, and E2E/Vitest-asserted copy and selectors were preserved verbatim. Zero internal tracking codes or fabricated data were introduced.

---

## Summary of Changes by Area

### 1. Application Shell (`apps/web/src/components/layout/AppShell.tsx`)
- Added a responsive mobile/tablet navigation drawer (`<lg`) toggled via an accessible menu button (`aria-expanded`, `aria-controls="mobile-navigation-drawer"`, `aria-label="Open navigation menu"`, `min-h-[44px] min-w-[44px]`).
- Drawer closes cleanly on Escape key press, backdrop click, or route navigation, and includes `Find Storage`, `How It Works`, `Become a Host`, `My Bookings`, `Help`, role-aware `Host Portal` / `Admin` links, and account auth controls.
- Added `aria-current="page"` on active navigation links in both desktop and mobile menus.
- Upgraded `Sign In`, `Register`, profile, and logout controls to ergonomic `min-h-[44px]` touch targets with `whitespace-nowrap`.
- Updated footer copyright copy to `© 2026 LuggageStorage Sri Lanka. All rights reserved.`.

### 2. Digital Custody Pass (`apps/web/src/components/custody/CustodyQrPassCard.tsx`)
- Refactored layout into a boarding-pass / luggage-claim ticket with a `bg-navy-950` header, perforated dashed divider stub, and tabular-numeral 6-digit PIN display (`data-pin-value`).
- Preserved `data-qr-payload={qrPayload}` around the synchronous SVG QR matrix (`<svg`) and formatted 6-digit PIN display.
- Tucked the raw 64-character `qrPayload` into a collapsible `"Manual Token"` disclosure paired with an accessible `min-h-[44px] min-w-[44px]` `"Copy"` button and `aria-live="polite"` `"Copied"` status feedback.
- Added a concise 2-step counter handover checklist tailored to `Check-In Drop-Off` vs `Collection Release`.
- Applied `print:hidden` to interactive pass controls (`Manual Token`, `Copy`, `Regenerate Pass`, `Print / Save Pass`).

### 3. Traveller Marketplace Journeys (`apps/web/src/features/traveller/*`)
- **`LandingPage.tsx`**:
  - Replaced the boxed hero mascot card with `<MascotIllustration mascot="wave" size="2xl" variant="spotlight" badgeText="Verified Custody" />` paired with subtle `QR + 6-Digit PIN` and `Tamper-Evident Seals` trust pills.
  - Wired `htmlFor` attributes to hero form inputs (`hero-city-input`, `hero-bags-select`) and added quick duration presets (`2h Quick Drop`, `Full Day`, `Multi-Day`) that compute schedule intervals dynamically.
  - Softened ledger jargon in the custody pillars copy while preserving `"Explore Sri Lanka Hands-Free"`, `"Verified Custody"`, `"Colombo Fort & Pettah"`, `"Find Storage"`, `"Serialized Tamper-Evident Seals"`, and `"How Verified Luggage Custody Works"`.
  - Unified Featured Hub card image and placeholder heights (`h-44`), added `king-coconut` mascot to the launching-soon empty state, and added a subtle `sun-hat` accent in the Featured Hubs header.
- **`SearchDiscoveryPage.tsx` & `LocationDiscoveryMap.tsx`**:
  - Enlarged `-`/`+` bag stepper buttons to accessible touch targets (`min-h-[40px] min-w-[40px]`) and wired `htmlFor` on all filter labels.
  - Added a mobile `"Filters"` accordion toggle (`<md`) and a `"List / Map"` view switcher (`<lg`) so the transit corridor map is accessible on mobile/tablet without scrolling past 24 cards.
  - Replaced raw zero-result cards with `<EmptyState mascot="map" />` preserving `"Reset Filters"`.
  - Kept hub `<h2>` headings clickable/navigable via `<Link>` while preserving `"Find Luggage Storage in Sri Lanka"`, `"All Sri Lanka"`, `"Colombo"`, `"Sri Lanka Transit Corridor Map"`, `"Near Me"`, `"Accepts Oversized Gear"`, `"Book Now"`, `"Details"`, and `"Retry"`.
  - In `LocationDiscoveryMap.tsx`, added deterministic spread offsets for overlapping pins in the same city/corridor and replaced raw `Approx. corridor: lat, lng` coordinate text with `Transit precinct: {approximateArea}`.
- **`LocationDetailPage.tsx`**:
  - Safely null-guarded `detail.capacitySummary` (`detail.capacitySummary?.activePoolCount` and related fields) so locations with `capacitySummary: null` render gracefully.
  - Humanized storage zone/slot phrasing while preserving `"Dedicated Storage Compartments"` and all policy/hours copy without any fabricated `08:00 - 20:00` hours.
  - Added a sticky mobile bottom bar (`lg:hidden`) showing rate summary and `"Book This Hub"` CTA.
  - Integrated `suitcase-hug` mascot in the custody reassurance callout and `shrug` mascot in the invalid/not-found location state.
- **`CheckoutSchedulePage.tsx` & `PaymentConfirmationPage.tsx`**:
  - Moved `"Server-Authoritative Checkout"` from a loud top alert banner to a compact pill trust note while preserving the exact string.
  - Added `aria-label` and `min-h-[44px] min-w-[44px]` touch targets to `-`/`+` bag steppers, `htmlFor` + `<Textarea>` for Handover Notes, and `blank-tag` mascot guidance near bag sizing.
  - Made Traveller Billing Details collapsible when `bookingMode === "HOST_APPROVAL"` while keeping all 7 billing fields expanded by default for `INSTANT` / SSR checkout.
  - Added a sticky mobile summary bar (`lg:hidden`) wired to `#live-checkout-form`.
  - In `PaymentConfirmationPage.tsx`, added an empty-context fallback (`EmptyState` with `suitcase-peek` mascot + links to `/portal/bookings` and `/search`) when no booking/order reference or gateway hint is present, and integrated `sitting-suitcase` on pending/verifying states and `jump` on confirmed `custodyReady` banners.
- **`BookingsPortalPage.tsx`**:
  - Replaced all four raw `fixed inset-0` modals (`activePassModal`, `receiptBooking`, `cancelTarget`, `exceptionTarget`) with the shared `<Modal>` primitive (Escape key, backdrop click, `max-h-[90vh] overflow-y-auto`, `aria-labelledby`).
  - Upgraded action links to `min-h-[44px]` and replaced empty-tab cards with `<EmptyState mascot="suitcase-peek" />` (active/past) and `<EmptyState mascot="sleeping" />` (refunds).
  - Preserved all E2E/unit-tested labels (`Booking Summary Receipt`, `Active & Upcoming`, `Past Trips`, `Refunds & Settlements`, `View Digital Custody Pass`, `addressLine1`, `referenceCode`).
- **`StaticInfoPages.tsx`**:
  - `BecomeAHostLandingPage`: Wired `htmlFor`/`id`/`aria-label` on partner earnings sliders and added `high-five` mascot.
  - `HowItWorksPage`: Added `suitcase-walk` mascot, numbered step badges, and bottom `"Find Storage"` CTA.
  - `HelpCentreFaqPage`: Converted FAQ entries into accessible expandable accordions (`aria-expanded`, `aria-controls`) and added `<EmptyState mascot="thinking" />` with `"Clear Search"` for zero search matches.
  - `ContactUsPage`: Mapped `SUPPORT_TICKET_CATEGORIES` to human-readable `<option>` labels while preserving `value={cat}`, used `<Select>` and `<Textarea>` with `htmlFor`, added `LoadingSkeleton` and retry alerts for `myTicketsQuery` and `myTicketDetailQuery`, and added `phone` mascot.
  - `TermsPrivacyLegalPage`: Added quick anchor navigation (`#terms`, `#privacy`, `#custody`) and bottom support links.

### 4. Auth, Account & System Pages (`apps/web/src/pages/*.tsx`)
Migrated all 11 pages from legacy `slate-*` / `blue-600` classes to CWCP tokens (`navy-950`, `terracotta-500`, `sand-*`, `Card`, `Alert`, `Button`, `Badge`, `LoadingSkeleton`, `Modal`, `MascotIllustration`):
- **`LoginPage.tsx`**: Preserved `"Email address"`, `"Password"`, `"Sign In"`, `aria-invalid`, `aria-describedby`, `role="alert"`, `min-h-[44px]` password toggle, and compact `wave` mascot.
- **`RegisterPage.tsx`**: Localized phone placeholder to `+94 77 123 4567`, formatted `PENDING_VERIFICATION` as `"Pending Email Verification"`, and added `wave` / `jump` mascots.
- **`ForgotPasswordPage.tsx`**, **`ResetPasswordPage.tsx`**, **`VerifyEmailPage.tsx`**: Migrated to CWCP, added `key` / `phone` / `jump` mascots, added `"Recovery token detected from link"` badge on `ResetPasswordPage`, and fixed the missing `<label htmlFor="resend-email">` on `VerifyEmailPage`.
- **`ProfilePage.tsx`**: Restyled to CWCP, preserved all E2E profile labels and zero-leak guarantees (`sessionId` and raw permissions remain absent), added `<LoadingSkeleton>` during profile fetch, added a `"Verify Email Now"` shortcut inside the unverified warning, and added a quick `"My Bookings"` link.
- **`SecurityPage.tsx` & `SessionsPage.tsx`**: Migrated to CWCP; replaced `window.confirm` in `SessionsPage` with shared `<Modal>`, added parsed browser/OS session labels (`Chrome on Windows`, etc.), and integrated `key` / `sleeping` mascots.
- **`ForbiddenPage.tsx`, `NotFoundPage.tsx`, `HealthPage.tsx`**: Replaced `"403 — Access Denied"` with `"Access Restricted"` + `shrug` mascot and DEV-gated technical permission details behind a collapsible `<details>` block; updated `NotFoundPage` buttons to CWCP terracotta/sand tokens with an `<h1>`; added `<h1>`, `Retry` button, and DEV-gating for localhost/stack strings on `HealthPage`.

---

## Verification Results

### 1. TypeScript Typecheck (`pnpm --filter @luggage-storage/web typecheck`)
- Zero TypeScript errors in any WS-UX-04 owned file (`AppShell.tsx`, `CustodyQrPassCard.tsx`, `features/traveller/*`, `pages/{LoginPage,RegisterPage,ForgotPasswordPage,ResetPasswordPage,VerifyEmailPage,ProfilePage,SecurityPage,SessionsPage,ForbiddenPage,NotFoundPage,HealthPage}.tsx`).
- Note: `tsc --noEmit` currently reports 2 pre-existing errors in an unowned Host workstream file (`src/features/host/HostOnboardingPage.tsx` lines 276 and 278), which was left untouched per workstream ownership boundaries.

### 2. Vitest Verification Suites
- `pnpm --filter @luggage-storage/web exec vitest run tests/foundation-and-boundary.test.tsx tests/public-web-journeys.test.tsx tests/initiative-1-foundation-hardening.test.tsx tests/initiative-2-traveller-marketplace.test.tsx tests/initiative-7-profile-and-integrity.test.tsx tests/phase-b-checkout-handoff.test.tsx tests/phase-b-marketplace-flows.test.tsx`:
  - **7 test files passed (65 / 65 tests passed)**
- `pnpm --filter @luggage-storage/web exec vitest run tests/phase-2-screens-and-mascots.test.ts tests/initiative-6-mvp-extensions-e2e.test.tsx`:
  - **2 test files passed (8 / 8 tests passed)**
