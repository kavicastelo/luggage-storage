# 06 — Superadmin & Support Workspace Transformation (`WS-UX-06`)

**Scope:** `apps/web/src/features/admin/*`  
**Design System:** Ceylon Warmth & Coastal Precision (CWCP — Coastal Navy `#070E1A`/`#0A192F`, Warm Sand `#FAF8F5`/`#E5DFD7`, Ceylon Terracotta `#C55013`, `tabular-nums` financial metrics)

---

## 1. Navigation & Layout Architecture (`AdminDashboardLayout.tsx`, `admin-helpers.tsx`)

- **Grouped Governance Navigation:** Organized the 17 admin navigation links into 5 governance sections (`Overview`, `Supply & Moderation`, `Operations & Support`, `Finance & Payouts`, `Governance & System`) while preserving exact nav labels, feature-flag hiding (`isFeatureReviewsEnabled()`, `isFeaturePromotionsEnabled()`), `lucide-lock` badges on restricted SUPPORT items, `"Authenticated Role: SUPERADMIN (Full Governance)"` / `"Authenticated Role: SUPPORT (Read-Only Oversight)"` banners, and the `/admin` → `/admin/bookings` redirect for SUPPORT users.
- **Responsive Mobile Drawer & Sticky Desktop Sidebar:** Added a collapsible mobile navigation drawer (`<lg`) with `aria-expanded` and `aria-controls="admin-mobile-nav-drawer"`, while keeping the desktop navigation sidebar sticky (`lg:sticky lg:top-20`).
- **CWCP Helpers & Mascot Restraint:** Updated `AdminPageHeader`, `AdminPaginationBar`, and `AdminEmptyStateCard` to CWCP warm sand/navy/terracotta contrast, added an `IN_STORAGE` sky badge tone in `statusBadgeToneClasses`, and added shared `AdminTableSkeleton`, `AdminCardListSkeleton`, `CopyTextButton`, `truncateUuid`, and `AdminImageLightboxModal` helpers. Removed `MascotIllustration` from operational table page headers, retaining Kiri (`mascot="salute"`) exclusively in the `AdminDashboardLayout` RBAC guard.

---

## 2. Slide-Over Inspector Drawers & Focused Modals

Replaced inline bottom-of-page `<section>` drawers with `SlideOverDrawer` (preserving `aria-label` attributes and `?inspect=` / `?batch=` URL sync) and `Modal` workflows:

| Surface | Component | Upgrade |
|---|---|---|
| Host KYC Queue | `AdminHostVerificationPage.tsx` | `SlideOverDrawer` (`aria-label="KYC Verification Inspection Drawer"`) + loading skeleton |
| Host Directory | `AdminHostDirectoryPage.tsx` | `SlideOverDrawer` (`aria-label="Host Business Inspection Drawer"`) + loading skeleton |
| Location Moderation | `AdminLocationModerationPage.tsx` | `SlideOverDrawer` (`aria-label="Location Inspection Drawer"`) + media thumbnails & map link |
| Global Bookings (List) | `AdminBookingsLedgerPage.tsx` | `SlideOverDrawer` (`aria-label="Booking and Custody Inspection Drawer"`) + full-page link |
| Manual Disbursement | `AdminPayoutsPages.tsx` | `SlideOverDrawer` (`aria-label="Payout Batch Disbursement Drawer"`) + `detailQuery` loading/error states |
| Security Audit Log | `AdminAuditLogPage.tsx` | `SlideOverDrawer` (`aria-label="Audit Event Detail Drawer"`) + copy buttons for Event ID & JSON |
| Users & RBAC | `AdminUsersRbacPage.tsx` | `SlideOverDrawer` (`aria-label="User Governance Drawer"`) + 2-step confirmation `Modal` before revoking a role |
| Refund Queue | `AdminPaymentsAndRefundsPages.tsx` | Focused `Modal` for the Refund Transition Form + separated recovery vs `FAILED` / `MANUAL_REVIEW_REQUIRED` action groups |

---

## 3. Dedicated `/admin/bookings/:id` Detail View & Photo Evidence Lightbox

- **Dedicated Route Isolation (`AdminBookingsLedgerPage.tsx`):** When `/admin/bookings/:id` is active, renders a dedicated full-page booking & custody dossier with a `"← Back to Global Bookings"` breadcrumb and disables the 20-row ledger list query instead of stacking the table above the detail view.
- **Streamlined Status Filtering:** Replaced the 12-pill status wall on the list view with 6 primary status tabs (`All Statuses`, `Confirmed`, `In Storage`, `Completed`, `Disputed`, `Cancelled`) paired with a compact `<Select>` synced to `?status=`.
- **Facility & Custody Photo Previews:**
  - `AdminLocationModerationPage.tsx`: Replaced raw URL text links inside `"Uploaded Facility Media"` with real `<img>` thumbnails, click-to-zoom `AdminImageLightboxModal`, fallback `"Open Full Photo"` links, and a `"View on Map"` link beside the 6-decimal GPS coordinates.
  - `AdminBookingsLedgerPage.tsx` & `AdminIncidentsDisputesPage.tsx`: Added inline `<img>` custody bag thumbnails with click-to-zoom lightbox previews alongside `"View Evidence Photo"` links.

---

## 4. Loading Skeletons, Error States & Operational Clarity

- **`AdminCommandDashboardPage.tsx`:** Replaced `0` metric flashes with `LoadingSkeleton` placeholders during `metricsQuery.isLoading`, highlighted non-zero action queues (`Pending Host KYC`, `Pending Storage Hubs`, `Disputed Bookings`, `Open Refunds`), and deep-linked `Disputed Bookings` to `/admin/incidents`.
- **`AdminPaymentsAndRefundsPages.tsx` (`AdminPaymentTransactionsLogPage`):** Added `AdminTableSkeleton`, clickable booking links to `/admin/bookings/:bookingId`, and replaced raw `evidence=... • sigVerified=...` debug strings with evidence-source and verification badges (`Signature Verified` / `Unverified`).
- **`AdminPayoutsPages.tsx` (`AdminHostPayoutBatchGenerationPage`):** Added KPI & card skeletons to prevent empty-state flashes, collapsible eligible booking previews per host card, and per-business pending button state (`pendingBusinessId`).
- **`AdminFinancialLedgerPage.tsx`:** Added `AdminTableSkeleton` and linked journal booking references to `/admin/bookings/:bookingId`.
- **`AdminIncidentsDisputesPage.tsx`:** Balanced 5/7 split layout, added loading skeletons and `AdminQueryErrorAlert` handling for `bookingDetailQuery` and `custodyQuery`.
- **`AdminAuditLogPage.tsx`:** Added `AdminTableSkeleton`, truncated actor UUIDs with `CopyTextButton`, and organized filters into a 2-row toolbar.
- **`AdminDeferredPages.tsx`:** Restyled to CWCP tokens while keeping `AdminPlatformSystemConfigurationPage` strictly read-only (zero `<input>`, `<select>`, or `<textarea>` elements) and preserving all policy & chart-of-accounts constants.

---

## 5. Support Triage & Case Resolution (`AdminSupportPages.tsx`)

- **Triage Queue:** Added `AdminTableSkeleton` to eliminate empty-state flashes, added an `Assignee` column, quick status filter tabs, and a `"Reset Filters"` action.
- **Resolution View Loading/404 Fix:** Separated `ticketQuery.isLoading` (`AdminCardListSkeleton`) from `!ticket && !ticketQuery.isLoading` (`"Support Case Not Found"` card) so `"Loading Support Case..."` never renders on error or 404.
- **High-Contrast Two-Tab Composer:** Replaced the subtle `"Internal Support Note"` checkbox with a two-tab switcher (`Public Reply to Customer` active by default vs `Internal Agent Note (Private)` with amber styling), preserving the E2E placeholder `"Write clear troubleshooting guidance or resolution update for the requester..."` and `"Send Public Reply"` / `"Save Internal Note"` buttons.
- **Assignee Surface & Assignment:** Displayed the current assignee in the ticket summary header and wired an `"Assign to Me"` action via `useUpdateAdminSupportTicketMutation` (`assignedToUserId`).
