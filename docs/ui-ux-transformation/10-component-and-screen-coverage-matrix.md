# 10 — Component & Screen Coverage Matrix

**Legend:** `Yes` = Audited, Redesigned/Upgraded, and Verified via automated tests (`Vitest`, `Playwright E2E`, and/or `tsc`/`eslint`/`expo export`).

---

## 1. Shared Design System & Primitives

| Surface | Component / Module | Audited | Redesigned | Functional / Unit Test | Visual / A11y QA |
|---|---|---|---|---|---|
| Shared Web | `index.html` & `index.css` (CWCP fonts, motion, print, reduced-motion) | Yes | Yes | `vite build` | Yes |
| Shared Web | `Button.tsx`, `MascotIllustration.tsx`, `Input.tsx` | Yes | Yes | `foundation-and-boundary.test.tsx` | Yes |
| Shared Web | `Modal.tsx`, `SlideOverDrawer.tsx`, `EmptyState.tsx`, `Select.tsx`, `Textarea.tsx`, `PageHeader.tsx` | Yes | Yes | `tsc` + consumers | Yes |
| Shared Web | `AppShell.tsx` (Mobile drawer, `44px` targets, `aria-current`) | Yes | Yes | `foundation-and-boundary.test.tsx` | Yes |
| Shared Web | `CustodyQrPassCard.tsx` (Ticket layout, collapsible token, `print:hidden`) | Yes | Yes | `initiative-2-traveller-marketplace.test.tsx` | Yes |
| Shared Mobile | `ScreenContainer.tsx`, `BottomSheet.tsx`, `ConfirmDialog.tsx`, `DateTimeSelector.tsx`, `TextInput.tsx` | Yes | Yes | `phase-c-*`, `traveller-mobile-*` | Yes |
| Shared Mobile | `MascotIllustration.tsx`, `EmptyState.tsx`, `ErrorState.tsx`, `StatusBadge.tsx`, `LoadingSkeleton.tsx` | Yes | Yes | `phase-c-design-and-icons.test.ts` | Yes |

---

## 2. Traveller Web, Auth, Account & System Screens (`apps/web`)

| Surface | Screen / Route | Audited | Redesigned | Functional / Unit Test | Visual QA |
|---|---|---|---|---|---|
| Traveller Web | Landing (`/`) | Yes | Yes | `public-web-journeys.test.tsx` | Yes (`desktop` + `mobile` + `320px`) |
| Traveller Web | Search & Discovery (`/search`) + Map | Yes | Yes | `e2e/01`, `initiative-2`, `public-web-journeys` | Yes (`desktop` + `mobile`) |
| Traveller Web | Location Details (`/locations/:slug`) | Yes | Yes | `e2e/01`, `initiative-7`, `public-web-journeys` | Yes (`desktop` + `mobile`) |
| Traveller Web | Checkout & Schedule (`/checkout/:locId`) | Yes | Yes | `phase-b-checkout-handoff`, `public-web-journeys` | Yes (`desktop` + `mobile`) |
| Traveller Web | Payment Confirmation (`/booking/confirm`) | Yes | Yes | `initiative-2`, `phase-b-checkout-handoff` | Yes |
| Traveller Web | Bookings Portal (`/portal`, `/portal/bookings`) | Yes | Yes | `e2e/01`, `initiative-2`, `public-web-journeys` | Yes |
| Traveller Web | Become a Host (`/become-a-host`) | Yes | Yes | `public-web-journeys.test.tsx` | Yes |
| Traveller Web | How It Works (`/how-it-works`) | Yes | Yes | `public-web-journeys.test.tsx` | Yes |
| Traveller Web | Help Centre & FAQ (`/help`) | Yes | Yes | `public-web-journeys.test.tsx` | Yes |
| Traveller Web | Contact & Support (`/contact`) | Yes | Yes | `e2e/05`, `initiative-2`, `public-web-journeys` | Yes |
| Traveller Web | Terms & Privacy (`/terms`) | Yes | Yes | `public-web-journeys.test.tsx` | Yes |
| Auth Web | Login (`/login`) | Yes | Yes | `e2e/01–06` (`loginViaUi`) | Yes |
| Auth Web | Register (`/register`) | Yes | Yes | `tsc` + `a11y` audit | Yes |
| Auth Web | Forgot / Reset Password, Verify Email (`/forgot-password`, `/reset-password`, `/verify-email`) | Yes | Yes | `tsc` + `vite build` | Yes |
| Account Web | Profile (`/profile`) | Yes | Yes | `e2e/06`, `initiative-7-profile-and-integrity` | Yes |
| Account Web | Security & Active Sessions (`/settings/security`, `/settings/sessions`) | Yes | Yes | `tsc` + `vite build` | Yes |
| System Web | Forbidden, Not Found, Health (`/forbidden`, `*`, `/health`) | Yes | Yes | `tsc` + `a11y` audit | Yes |

---

## 3. Host Workspace Web (`apps/web`)

| Surface | Screen / Route | Audited | Redesigned | Functional / Unit Test | Visual QA |
|---|---|---|---|---|---|
| Host Web | Shell & Layout (`/host/*`) | Yes | Yes | `host-dashboard-journeys`, `initiative-3`, `e2e/03` | Yes |
| Host Web | Host Overview (`/host`, `/host/dashboard`) | Yes | Yes | `host-dashboard-journeys`, `initiative-4` | Yes (`desktop` + `mobile`) |
| Host Web | Host Onboarding (`/host/onboarding`) | Yes | Yes | `e2e/02`, `initiative-3` | Yes |
| Host Web | Storage Hubs Directory (`/host/locations`) | Yes | Yes | `e2e/02`, `initiative-3`, `initiative-7` | Yes |
| Host Web | Location Profile Editor (`/host/locations/:id`) | Yes | Yes | `host-dashboard-journeys`, `initiative-3` | Yes |
| Host Web | Hours & Calendar (`/host/locations/:id/schedule`) | Yes | Yes | `host-dashboard-journeys`, `initiative-3` | Yes |
| Host Web | Capacity & Zones (`/host/locations/:id/capacity`) | Yes | Yes | `host-dashboard-journeys`, `initiative-3` | Yes |
| Host Web | Pricing Rules (`/host/locations/:id/pricing`) | Yes | Yes | `host-dashboard-journeys`, `initiative-3` | Yes |
| Host Web | Bookings Management Hub (`/host/bookings`, `:id`) | Yes | Yes | `host-dashboard-journeys`, `initiative-4` | Yes (Modal QA) |
| Host Web | Check-In & Check-Out Desk (`/host/operations`) | Yes | Yes | `e2e/03`, `host-dashboard-journeys`, `initiative-4` | Yes |
| Host Web | Financial Revenue Ledger (`/host/finance`) | Yes | Yes | `e2e/03` RBAC, `initiative-4` | Yes |
| Host Web | Payout Accounts & History (`/host/payouts`) | Yes | Yes | `initiative-4`, `initiative-6` | Yes |
| Host Web | Customer Reviews (`/host/reviews`) | Yes | Yes | `host-dashboard-journeys`, `initiative-4`, `initiative-6` | Yes |
| Host Web | Staff & RBAC (`/host/staff`) | Yes | Yes | `host-dashboard-journeys`, `initiative-3` | Yes |
| Host Web | Business Profile & Legal (`/host/settings`) | Yes | Yes | `host-dashboard-journeys`, `initiative-3` | Yes |

---

## 4. Superadmin & Support Workspace Web (`apps/web`)

| Surface | Screen / Route | Audited | Redesigned | Functional / Unit Test | Visual QA |
|---|---|---|---|---|---|
| Admin Web | Layout & Navigation (`/admin/*`) | Yes | Yes | `initiative-5`, `initiative-6` | Yes |
| Admin Web | Command Dashboard (`/admin`) | Yes | Yes | `initiative-5`, `initiative-6` | Yes |
| Admin Web | Host KYC Queue (`/admin/hosts/review`) | Yes | Yes | `initiative-5` | Yes |
| Admin Web | Host Directory (`/admin/hosts`) | Yes | Yes | `initiative-5` | Yes |
| Admin Web | Location Moderation (`/admin/locations`) | Yes | Yes | `e2e/04`, `initiative-5` | Yes (`mobile` 0px overflow) |
| Admin Web | Global Bookings Ledger (`/admin/bookings`, `:id`) | Yes | Yes | `initiative-5` | Yes |
| Admin Web | Payment Transactions (`/admin/payments`) | Yes | Yes | `initiative-5` | Yes |
| Admin Web | Refund Queue (`/admin/refunds`) | Yes | Yes | `initiative-5` | Yes |
| Admin Web | Payout Batches (`/admin/payouts/batches`) | Yes | Yes | `initiative-6` | Yes |
| Admin Web | Manual Disbursement (`/admin/payouts/disburse`) | Yes | Yes | `initiative-6` | Yes |
| Admin Web | Double-Entry Ledger (`/admin/finance/ledger`) | Yes | Yes | `initiative-5` | Yes |
| Support Web | Support Triage Queue (`/admin/support`) | Yes | Yes | `e2e/05`, `initiative-5`, `initiative-6` | Yes |
| Support Web | Support Resolution View (`/admin/support/:id`) | Yes | Yes | `e2e/05`, `initiative-6` | Yes |
| Admin Web | Incidents & Disputes (`/admin/incidents`) | Yes | Yes | `e2e/04`, `initiative-6` | Yes |
| Admin Web | Reviews, Promotions & System Config (`/admin/reviews`, `/promotions`, `/settings`) | Yes | Yes | `initiative-6` | Yes |
| Admin Web | Security Audit Log (`/admin/audit`) | Yes | Yes | `initiative-5` | Yes |
| Admin Web | Users & RBAC (`/admin/staff`) | Yes | Yes | `initiative-5` | Yes |

---

## 5. Expo Mobile (`apps/mobile`)

| Surface | Screen / Route | Audited | Redesigned | Functional / Unit Test | Build / Bundle QA |
|---|---|---|---|---|---|
| Mobile Entry | Root Gateway & Layout (`_layout.tsx`, `index.tsx`) | Yes | Yes | `phase-2-screens-and-mascots` | Expo export |
| Mobile Auth | Login, Register, Forgot/Reset Password, Verify Email (`(auth)/*`) | Yes | Yes | `auth-flows.test.ts` | Expo export |
| Mobile Account | Layout, Profile, Security, Sessions (`(account)/*`) | Yes | Yes | `initiative-7-mobile-parity` | Expo export |
| Mobile Traveller | Tabs Layout, Home (`index`), Explore (`DiscoveryView`) | Yes | Yes | `traveller-mobile-journeys`, `phase-c-traveller-e2e` | Expo export |
| Mobile Traveller | Location Detail (`location.tsx`, `locations/[id].tsx`) | Yes | Yes | `traveller-mobile-audit-verification` | Expo export |
| Mobile Traveller | Checkout & Payment Confirm (`checkout.tsx`, `booking/confirm.tsx`) | Yes | Yes | `phase-b-checkout-handoff`, `initiative-7` | Expo export |
| Mobile Traveller | Bookings, Saved, Support, Profile, Pass, Onboarding | Yes | Yes | `traveller-mobile-*`, `initiative-7` | Expo export |
| Mobile Host | Host Layout, Live Desk (`index`), Requests, Vault | Yes | Yes | `host-mobile-journeys`, `phase-c-host-e2e` | Expo export |
| Mobile Host | QR Scanner (`scanner.tsx`), Check-In Intake (`intake.tsx`) | Yes | Yes | `host-mobile-journeys` | Expo export |
| Mobile Host | Earnings, Locations, Location Editor, Onboarding, Settings | Yes | Yes | `host-mobile-journeys`, `initiative-7` | Expo export |
| Mobile Dev | Dev Icon Gallery (`(dev)/icons.tsx`) | Yes | Preserved | `phase-c-design-and-icons` | Expo export |
