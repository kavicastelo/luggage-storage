# 05 — Host Workspace Web UI/UX Transformation (`WS-UX-05`)

**Scope:** `apps/web/src/features/host/*`  
**Design System:** Ceylon Warmth & Coastal Precision (CWCP — Coastal Navy `#070E1A`/`#0A192F`, Warm Sand `#FAF8F5`/`#E5DFD7`, Ceylon Terracotta `#C55013`, shared `@/components/ui` primitives)

---

## 1. Shell, Navigation & Shared Helpers (`HostDashboardLayout.tsx`, `host-helpers.tsx`)

- **Hub Switcher Sub-Route Sync:** Changing `Active Storage Hub` (`select[aria-label="Active Storage Hub"]`) while viewing any `/host/locations/:id*` setup route (`/host/locations/:id`, `/schedule`, `/capacity`, `/pricing`) now navigates directly to the newly selected hub's matching sub-route while preserving query parameters. Visiting a `/host/locations/:id*` URL also synchronizes the active hub context store.
- **Empty-Hub Location Setup Guidance:** When `allLocations.length === 0`, the `Location Setup` sidebar links (`Location Profile`, `Hours & Calendar`, `Capacity & Zones`, `Pricing Rules`) guide hosts cleanly to `/host/locations` with muted styling and a `"Select hub"` hint instead of generating broken `/host/locations/select/*` URLs.
- **Dismissible Mobile Navigation Drawer:** Replaced the inline mobile accordion toggle with a dismissible slide-over drawer (`<aside id="host-portal-sidebar">`) backed by `aria-expanded` and `aria-controls` on the `"Toggle Host Menu"` button, backdrop click-to-close, close button, and Escape key handling so mobile navigation no longer pushes workstation content down.
- **Shared Setup Tabs & Presets (`host-helpers.tsx`):** Added `HostLocationSetupTabs` (`Profile` | `Hours & Calendar` | `Capacity & Zones` | `Pricing Rules`), `SRI_LANKA_HUB_PRESETS` (Colombo, Kandy, Galle, Ella), and upgraded `NoLocationSelectedCard` and `HostQueryErrorAlert` to shared `EmptyState`, `Alert`, and `Button` primitives.

---

## 2. Counter Workstation & Booking Management (`HostOperationsDeskPage.tsx`, `HostBookingsPage.tsx`)

- **`HostOperationsDeskPage.tsx` (P0 Counter Workstation):**
  - Added a **Live Counter Queue** strip powered by `useHostBookingsQuery` showing `CONFIRMED` arrivals in `Intake Handover` mode and `IN_STORAGE` active vaults in `Release Pick-Up` mode (with `LoadingSkeleton` placeholders and overdue `Badge` indicators) for 1-tap traveller selection.
  - Wrapped booking reference lookup in a `<form>` so pressing `Enter` triggers lookup.
  - Structured the workstation into 3 numbered sections: `1. Select or Lookup Booking` → `2. Verify QR / 6-Digit PIN` → `3. Reconcile Bags, Seals & Vault Compartment`.
  - Added clean form state reset (`resetHandoverFormForBooking`) when switching bookings, an `"Apply to All Bags"` seal action in `CHECK_IN` mode, and `whitespace-nowrap` on the `Intake Handover` / `Release Pick-Up` toggle buttons.
- **`HostBookingsPage.tsx` (P0 Booking Hub & Dossier):**
  - Fixed `statusBadgeToneClass` so `"brand"` maps to emerald (`bg-emerald-50 text-emerald-800 border border-emerald-200`) instead of amber.
  - Replaced the 12-pill status wall with 6 primary operational tabs (`All Bookings`, `Pending Approval` with urgent count badge, `Confirmed`, `In Storage`, `Completed`, `Disputed`) plus a compact `"Other booking statuses"` `<select>` for `Pending Payment`, cancelled, declined, and expired statuses.
  - Decluttered table rows to primary actions + `"Investigate Custody"`, moving secondary actions (`Host Cancel`, `Report Exception`) into the live Custody Audit Dossier footer.
  - Migrated action, demo dossier, and live dossier modals to `<Modal>` (`role="dialog"`, Escape close) and added `<LoadingSkeleton>` rows and `<EmptyState mascot="suitcase-peek" />`.

---

## 3. Overview, Onboarding & Storage Hub Directory (`HostOverviewPage.tsx`, `HostOnboardingPage.tsx`, `HostLocationsPage.tsx`)

- **`HostOverviewPage.tsx`:**
  - Added `<LoadingSkeleton>` metric and queue placeholders while live queries load.
  - Separated active `IN_STORAGE` pickups (`Active Vault Pickups`) from historical `COMPLETED` bookings in the KPI sub-metric.
  - Added `+N more` count badge and `MascotIllustration` (`alarm-clock`) accent to the `Overdue Custody Notice` banner.
  - Fixed live `Physical Zone Capacity` meters to report each zone's configured dedicated/shared capacity allocation share instead of dividing hub-wide bags into every zone, preserving `"0% configured"` with zero `NaN%`.
  - Preserved `HOST_STAFF` financial privacy (`Net Cleared Earnings` hidden).
- **`HostOnboardingPage.tsx`:**
  - Added `<LoadingSkeleton>` while `businessesQuery.isLoading` to prevent Step 1 → Step 2 flashes.
  - Added a clear KYC verification summary card with `Continue to Hub Setup` CTA when KYC is already submitted (`PENDING_REVIEW`, `APPROVED`, or non-rejected states), preserving `"Verification Status: "` badge copy.
  - Added Sri Lanka city coordinate quick-fill buttons (`Colombo`, `Kandy`, `Galle`, `Ella`), `MascotIllustration` (`selfie` / `pointing`) accents, and a post-creation 4-step go-live checklist linking directly to the new hub's setup tabs.
- **`HostLocationsPage.tsx`:**
  - Added a confirmation `<Modal>` before disabling an active hub (`Disable`).
  - Added inline setup-readiness indicators (`Photos`, `Hours`, `Capacity`, `Pricing`) on `DRAFT` and `REJECTED` hubs.
  - Migrated the Add Hub dialog to `<Modal>` with Sri Lanka city presets and added `<EmptyState mascot="suitcase-peek" />` and `<LoadingSkeleton>`.

---

## 4. Location Setup Tabs (`HostLocationEditorPage.tsx`, `HostSchedulePage.tsx`, `HostCapacityZonesPage.tsx`, `HostPricingPage.tsx`)

- Added `HostLocationSetupTabs` across all 4 `/host/locations/:id*` pages for seamless tab switching without leaving `:id`.
- **`HostLocationEditorPage.tsx`:** Added dirty-state tracking with a sticky bottom save bar, `<LoadingSkeleton>` loading state, and `MascotIllustration` (`selfie`, `variant="empty"`) in the empty photo gallery.
- **`HostSchedulePage.tsx`:** Upgraded schedule and special-hours time inputs to `type="time"`, added `"Copy Monday to Weekdays"` and `"Copy Monday to All Days"` quick actions, added a bottom `"Save Schedule"` button, and added `<LoadingSkeleton>`.
- **`HostCapacityZonesPage.tsx`:** Added an informational `<Alert>` clarifying Physical Zones vs Bookable Capacity Pools, added confirmation `<Modal>` dialogs before deleting zones or pools, migrated Add Zone / Add Pool / Edit Pool dialogs to `<Modal>`, and added `<EmptyState mascot="suitcase-peek" />` and `<LoadingSkeleton>`.
- **`HostPricingPage.tsx`:** Linked `<label htmlFor>` to all live and demo inputs, added `"Calculate from Baseline"` tier calculation, added a **Sample Quote Preview** card (traveller total + estimated 85% host share), and added a `MascotIllustration` (`blank-tag`) pricing tip.

---

## 5. Finance, Payouts, Reviews, Staff & Business Settings

- **`HostFinancePage.tsx`:** Consolidated the 7 KPI boxes into a 3-column primary earnings grid plus a unified 4-item settlement status strip, added booking-reference search alongside status pills, and added `<LoadingSkeleton>` and `<EmptyState mascot="blank-tag" />`.
- **`HostPayoutsPage.tsx`:** Added a live section view switcher (`All Settlement Views` [default] | `Payout Batches` | `Settlement Payables`) keeping both `Settlement Payout Batches` and `Host Settlement Payables Overview` accessible, migrated bank beneficiary editing to `<Modal>` with editable demo inputs, and added `<LoadingSkeleton>` and `<EmptyState mascot="key" />`.
- **`HostReviewsPage.tsx`:** Scoped demo reply draft inputs and simulated replies per review ID (`replyDrafts[r.id]`) and added `MascotIllustration` (`high-five`) to the live `"Verified Traveller Reviews Coming Post-MVP"` state.
- **`HostStaffPage.tsx`:** Strictly gated demo state behind `isDemoActive`, moved invite errors inside the Invite `<Modal>`, added a Revoke confirmation `<Modal>`, and added `<EmptyState mascot="wave" />` and `<LoadingSkeleton>`.
- **`HostBusinessSettingsPage.tsx`:** Hid the conflicting `"No Host Business Registered Yet"` card when `showDemo` is active, reset `editingProfile` when switching businesses, migrated business creation to `<Modal>` with inline error rendering, and added `<LoadingSkeleton>`.

---

## 6. Verification

- `pnpm --filter @luggage-storage/web typecheck`: Passed (0 errors).
- `pnpm --filter @luggage-storage/web exec vitest run tests/host-dashboard-journeys.test.tsx tests/initiative-3-host-onboarding-locations.test.tsx tests/initiative-4-host-operations-finance.test.tsx tests/initiative-6-mvp-extensions-e2e.test.tsx tests/initiative-7-profile-and-integrity.test.tsx`: 5 test files passed, 47 tests passed.
