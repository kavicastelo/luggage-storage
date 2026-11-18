# 03 — Mascot & Illustration Experience Strategy (`WS-UX-03`)

**Mascot Character:** **Kiri** — Sri Lankan palm squirrel wearing a Coastal Navy `LS` satchel strap, drawn in warm terracotta (`#E06D32`) with deep maroon (`#5C0620`) outlines.

---

## 1. Complete Asset Inventory (20 Transparent Assets)

All 20 illustrations exist in `apps/web/public/assets/mascots/` (`.png` + `.webp`, `~92.9%` WebP compression savings) and `apps/mobile/assets/mascots/` (`.png` + `.webp`). Every asset was verified via `sharp` and visual inspection to possess a crisp transparent alpha channel (`hasAlpha: true`).

| ID | Key | Filename | Dimensions (px) | PNG / WebP | Visual Pose & Emotional Tone |
|---|---|---|---|---|---|
| MASCOT-01 | `wave` | `LS-mascot_01_wave` | 1642 × 1939 | 1.56 MB / 109 KB | Standing, waving paw warmly; welcoming, friendly |
| MASCOT-02 | `suitcase-walk` | `LS-mascot_02_suitcase-walk` | 1537 × 1858 | 1.58 MB / 116 KB | Walking briskly pulling navy suitcase; active travel |
| MASCOT-03 | `suitcase-peek` | `LS-mascot_03_suitcase-peek` | 1553 × 1527 | 1.33 MB / 90 KB | Peeking from open terracotta suitcase; curious discovery |
| MASCOT-04 | `blank-tag` | `LS-mascot_04_blank-tag` | 1464 × 2014 | 1.48 MB / 107 KB | Holding blank white luggage tag; bag sizing, pricing |
| MASCOT-05 | `pointing` | `LS-mascot_05_pointing` | 1678 × 1754 | 1.46 MB / 102 KB | Pointing left helpfully; step-by-step guidance & tips |
| MASCOT-06 | `thinking` | `LS-mascot_06_thinking` | 1355 × 1845 | 1.29 MB / 93 KB | Paw on chin thoughtfully; FAQ inquiry, filter tips |
| MASCOT-07 | `sleeping` | `LS-mascot_07_sleeping` | 1325 × 1867 | 1.33 MB / 91 KB | Curled asleep on stacked suitcases; all-clear, quiet state |
| MASCOT-08 | `phone` | `LS-mascot_08_phone` | 1383 × 1899 | 1.37 MB / 99 KB | Holding navy smartphone; verification, OTP, live contact |
| MASCOT-09 | `jump` | `LS-mascot_09_jump` | 1506 × 1851 | 1.42 MB / 97 KB | Jumping with eyes closed joyfully; booking/account success |
| MASCOT-10 | `map` | `LS-mascot_10_map` | 1379 × 1802 | 1.35 MB / 100 KB | Studying unfolded route map; search & hub discovery |
| MASCOT-11 | `sun-hat` | `LS-mascot_11_sun-hat` | 1483 × 1906 | 1.55 MB / 115 KB | Tipping woven straw sun hat; Sri Lanka destination holiday |
| MASCOT-12 | `high-five` | `LS-mascot_12_high-five` | 1632 × 1807 | 1.50 MB / 105 KB | Winking high-five; partner hospitality & review thanks |
| MASCOT-13 | `alarm-clock` | `LS-mascot_13_alarm-clock` | 1495 × 1865 | 1.46 MB / 106 KB | Holding ringing navy alarm clock; SLA timer & overdue alert |
| MASCOT-14 | `key` | `LS-mascot_14_key` | 1480 × 2125 | 1.63 MB / 121 KB | Raising large golden key overhead; security, auth, RBAC |
| MASCOT-15 | `suitcase-hug` | `LS-mascot_15_suitcase-hug` | 1445 × 1809 | 1.38 MB / 94 KB | Hugging navy suitcase happily; safe custody care |
| MASCOT-16 | `selfie` | `LS-mascot_16_selfie` | 1713 × 1854 | 1.59 MB / 110 KB | Taking photo with peace sign; facility media & KYC photos |
| MASCOT-17 | `king-coconut` | `LS-mascot_17_king-coconut` | 1374 × 1854 | 1.35 MB / 103 KB | Sipping orange Thambili coconut; hands-free island leisure |
| MASCOT-18 | `salute` | `LS-mascot_18_salute` | 1523 × 1725 | 1.37 MB / 95 KB | Crisp salute beside terracotta suitcase; host counter duty |
| MASCOT-19 | `shrug` | `LS-mascot_19_shrug` | 1476 × 1846 | 1.40 MB / 99 KB | Empathetic shrug; 404, 403, error recovery, empty match |
| MASCOT-20 | `sitting-suitcase` | `LS-mascot_20_sitting-suitcase` | 1365 × 1926 | 1.40 MB / 96 KB | Sitting on navy suitcase with peace sign; patient waiting |

---

## 2. Baseline Deficit & Integration Rules

**Baseline Audit Finding:**
- Web previously rendered only `wave` (Landing), `shrug` (404), `key` (Host Staff block) plus **10 boxed mascots inside dense Admin operational table headers**—leaving Traveller Search empty states, Checkout, Payment Confirmation, Bookings Portal, Auth, Account, Support, and Host empty states completely unillustrated.
- `MascotIllustration` wrapped transparent assets inside heavy bordered cards (`bg-sand-100/90 border`, or Mobile `amber[100]` border boxes), hiding the transparency benefit and creating double-card nesting.

**Design & Restraint Rules:**
1. **Let transparency breathe:** Default `bare` / `spotlight` / `hero` / `empty` variants render Kiri directly on the page canvas or subtle radial glow—never inside a rigid inner box when already inside a card.
2. **Directional awareness:** `LS-mascot_05_pointing` points left—always place it to the right of tips/checklists or in a right-aligned column so it points *toward* the content.
3. **No mascots in dense operational tables:** Remove Kiri from Admin operational page headers (`AD-001` through `AD-018` headers); retain Kiri in Admin only for the RBAC guard (`salute`/`key`) and empty states if appropriate.
4. **Honest & accessible:** Every decorative/contextual use sets proper `alt` text (or `aria-hidden="true"` when purely redundant next to identical heading text) and respects `prefers-reduced-motion`.

---

## 3. Target Cross-Platform Usage Map (All 20 Assets)

| Mascot Key | Web Placements (Target) | Mobile Placements (Target) |
|---|---|---|
| `01_wave` | `LandingPage` hero, `LoginPage` welcome accent | `index.tsx` / `(traveller)/(tabs)/profile.tsx` guest welcome |
| `02_suitcase-walk` | `HowItWorksPage` hero, `TravellerWebPortal` active empty state | `app/index.tsx` gateway, `(traveller)/(tabs)/bookings.tsx` empty |
| `03_suitcase-peek` | `HostLocationsPage` empty hubs, `HostOnboardingPage` step 3 | `(traveller)/location.tsx` missing, `(host)/intake.tsx` empty |
| `04_blank-tag` | `CheckoutSchedulePage` bag sizing note, `HostPricingPage` guide | `(traveller)/checkout.tsx` bag guide |
| `05_pointing` | `HostOnboardingPage` / Go-Live checklist tip | `(traveller)/onboarding.tsx` step guidance |
| `06_thinking` | `HelpCentreFaqPage` header & empty search, `Support` empty | `(traveller)/(tabs)/support.tsx` empty tickets |
| `07_sleeping` | `TravellerWebPortal` past trips empty, `SessionsPage` empty | `(traveller)/(tabs)/bookings.tsx` past trips empty |
| `08_phone` | `ContactUsPage` hero, `VerifyEmailPage` inbox prompt | `(auth)/verify-email.tsx` verification prompt |
| `09_jump` | `PaymentConfirmationPage` confirmed pass, `RegisterPage` success | `(traveller)/pass.tsx` active pass, `(traveller)/onboarding.tsx` final slide |
| `10_map` | `SearchDiscoveryPage` empty search results | `(traveller)/(tabs)/saved.tsx` empty, `(host)/index.tsx` no hub, `(traveller)/onboarding.tsx` slide 1 |
| `11_sun-hat` | `LandingPage` Sri Lanka corridors / destination highlight | `(traveller)/onboarding.tsx` Sri Lanka explore slide |
| `12_high-five` | `BecomeAHostLandingPage` hero, `HostReviewsPage` empty | `(host)/locations.tsx` empty / partner welcome |
| `13_alarm-clock` | `HostOverviewPage` overdue alert accent | `(host)/vault.tsx` Overdue empty / SLA alert |
| `14_key` | `ForgotPasswordPage`, `ResetPasswordPage`, `SecurityPage`, `HostDashboardLayout` staff block | `(auth)/login.tsx` / `forgot-password.tsx` / `(account)/security.tsx` |
| `15_suitcase-hug` | `LocationDetailPage` custody trust reassurance | `(host)/vault.tsx` Active Vault empty state |
| `16_selfie` | `HostLocationEditorPage` empty photo gallery, `HostOnboardingPage` KYC upload | `(host)/onboarding.tsx` KYC document capture |
| `17_king-coconut` | `LandingPage` empty live hubs / leisure CTA banner | `(traveller)/onboarding.tsx` slide 2 |
| `18_salute` | `HostDashboardLayout` / `HostOverviewPage` counter readiness, `AdminDashboardLayout` RBAC guard | `(host)/_layout.tsx` RBAC guard, `(host)/index.tsx` desk hero |
| `19_shrug` | `NotFoundPage`, `ForbiddenPage`, `LocationDetailPage` invalid UUID | `ErrorState.tsx`, `(traveller)/location.tsx` load error |
| `20_sitting-suitcase` | `PaymentConfirmationPage` pending approval / polling state | `(traveller)/checkout.tsx` pending host approval |

## 4. Final Asset Utilization Report (Verified Post-Implementation)

- **Total relevant mascot assets discovered:** **20** (`LS-mascot_01_wave` through `LS-mascot_20_sitting-suitcase`, each in `.png` + `.webp` with verified `hasAlpha: true` in `apps/web/public/assets/mascots/` and `apps/mobile/assets/mascots/`).
- **Previously used in product screens (Baseline):**
  - Web: 2 customer/error screens (`LandingPage` `wave`, `NotFoundPage` `shrug`), 1 Host guard (`HostDashboardLayout` `key`), plus 10 cluttered Admin data-table headers.
  - Mobile: ~9 assets used directly (`wave`, `suitcase-walk`, `suitcase-peek`, `thinking`, `map`, `king-coconut`, `jump`, `salute`, `suitcase-hug`), wrapped in bordered boxes.
- **Newly integrated & refactored placements (Post-Transformation):**
  - **20 / 20** Kiri assets are now used meaningfully across Web (`LandingPage`, `SearchDiscoveryPage`, `LocationDetailPage`, `CheckoutSchedulePage`, `PaymentConfirmationPage`, `BookingsPortalPage`, `StaticInfoPages`, `LoginPage`, `RegisterPage`, `ForgotPasswordPage`, `ResetPasswordPage`, `VerifyEmailPage`, `SecurityPage`, `SessionsPage`, `ForbiddenPage`, `NotFoundPage`, `HostOverviewPage`, `HostOnboardingPage`, `HostLocationsPage`, `HostLocationEditorPage`, `HostCapacityZonesPage`, `HostPricingPage`, `HostBookingsPage`, `HostFinancePage`, `HostPayoutsPage`, `HostReviewsPage`, `HostStaffPage`, `HostBusinessSettingsPage`, `AdminDashboardLayout` RBAC guard).
  - **16 / 20** Kiri assets are actively integrated across Mobile (`index.tsx`, `(auth)/*`, `(account)/sessions`, `(traveller)/*`, `(host)/*`, `DiscoveryView`, `EmptyState`, `ErrorState`), with transparent `variant="bare"` / `variant="hero"` rendering (no double-card borders).
  - **0** forced placements in dense operational Admin tables (removed boxed mascots from all 10 Admin table/KPI page headers).
- **Intentionally unused assets:** **0** on Web (all 20 fit distinct travel, security, custody, empty, and alert moments); on Mobile 4 variants (`blank-tag`, `pointing`, `sun-hat`, `high-five`) are reserved for future promotional/review expansions rather than forced into dense counter workflows.

