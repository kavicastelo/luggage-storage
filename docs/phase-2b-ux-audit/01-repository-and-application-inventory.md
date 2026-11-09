# Phase 2B — Product UI/UX Audit & Redesign Planning
## Document 01: Repository, Architecture & Application Inventory

**Project:** Global Luggage Storage Marketplace (`https://github.com/kavicastelo/luggage-storage`)  
**Audit Document:** `DOC-UX-P2B-001`  
**Working Branch:** `feat/phase-1b-identity` (Commit `ae3515f`)  
**Environment:** Windows 11 x64, Node v26.3.1, pnpm 12.9.1, PostgreSQL 16 + PostGIS 3.5 (Docker)  
**Date:** November 9, 2026

---

### 1. Monorepo Architecture & Package Structure

The repository is structured as a Turborepo + pnpm monorepo consisting of three applications and three shared internal packages:

```
luggage-storage/
├── apps/
│   ├── api/             # Fastify 5 + Drizzle ORM + PostgreSQL 16/PostGIS backend service
│   ├── mobile/          # Expo 58 + React Native 0.88 + React Native Web client application
│   └── web/             # React 18 + Vite 6 + Tailwind CSS 3 web application
├── packages/
│   ├── contracts/       # Shared Zod validation schemas, TypeScript interfaces & error contracts
│   ├── eslint-config/   # Shared ESLint configuration rules
│   └── typescript-config/# Shared TSConfig baselines (base, node, react)
├── infrastructure/
│   └── docker/          # Docker Compose configurations (PostGIS 16)
└── docs/                # Architectural, product, and engineering documentation
```

#### 1.1 Applications Overview & Execution Topology

| Surface Code | Application Directory | Technology Stack | Primary Port | Rendering Target | Target Audiences |
|:---:|:---|:---|:---:|:---|:---|
| **API** | `apps/api` | Fastify 5.2, Drizzle ORM, PostgreSQL 16 + PostGIS, Argon2id, JWT, Nodemailer | `3000` | Node.js REST API | Internal Services, Web, Mobile |
| **PW** | `apps/web` | React 18.3, Vite 6.2, Tailwind CSS 3.4, React Router 6.23, TanStack Query 5 | `5173` | Desktop & Mobile Web Browsers | Public Visitors, Travellers |
| **HD** | `apps/web` | React 18.3, Vite 6.2, Tailwind CSS 3.4, Lucide React, Zustand 4.5 | `5173` | Desktop & Tablet Web Browsers | Storage Host Owners, Host Staff |
| **AD** | `apps/web` | React 18.3, Vite 6.2, Tailwind CSS 3.4, Lucide React, Zustand 4.5 | `5173` | Desktop Web Browsers | Superadmin, Support Agents |
| **TM** | `apps/mobile` | React Native 0.88, React 19.3, Expo 58, Expo Router, React Native Web 0.21 | `8081` | iOS, Android, Web Fallback | Travellers on Mobile Devices |
| **HM** | `apps/mobile` | React Native 0.88, React 19.3, Expo 58, Expo Router, React Native Web 0.21 | `8081` | iOS, Android, Web Fallback | Host Operators & Attendants |

---

### 2. Live Runtime Verification & Environment Execution

During this audit, all backend and frontend services were actively executed and probed:

1. **PostgreSQL 16 + PostGIS 3.5 Database:**
   - Container ID: `41c5b6950389` (`postgis/postgis:16-3.5-alpine`)
   - Status: Healthy, listening on `127.0.0.1:5432`.
   - Schemas: 12 core tables migrated (`users`, `traveller_profiles`, `host_profiles`, `roles`, `permissions`, `user_roles`, `role_permissions`, `auth_sessions`, `password_reset_tokens`, `security_audit_events`, `email_verification_tokens`, `auth_rate_limits`).
2. **Fastify Backend API (`apps/api`):**
   - Execution command: `pnpm --filter @luggage-storage/api dev`
   - Probed via: `curl.exe -I http://localhost:3000/health` $\rightarrow$ `HTTP/1.1 200 OK` (JSON health response).
   - Live endpoints: `/api/v1/auth/*` (register, login, refresh, logout, verify-email, resend-verification, request-password-reset, reset-password), `/api/v1/admin/audit-events`.
3. **React + Vite Web Application (`apps/web`):**
   - Execution command: `pnpm --filter @luggage-storage/web dev`
   - Probed via: `curl.exe -I http://localhost:5173/` $\rightarrow$ `HTTP/1.1 200 OK`.
   - Title: `Luggage Storage Marketplace`.
4. **React Native + Expo Mobile Application (`apps/mobile`):**
   - Execution command: `pnpm --filter @luggage-storage/mobile web`
   - Probed via: `curl.exe -I http://localhost:8081/` $\rightarrow$ `HTTP/1.1 200 OK`.
   - Title: `LuggageStorage`.

---

### 3. Web Application Route Inventory (`apps/web/src/app/App.tsx`)

The web application bundles three distinct surfaces (`PW`, `HD`, `AD`) plus auth into a single client routing tree:

#### 3.1 Public Traveller Website (`PW` — 11 Active Screens)
- `/` $\rightarrow$ `PublicLandingPage` (`PW-001`)
- `/search` $\rightarrow$ `WebSearchDiscoveryPage` (`PW-002`)
- `/locations/:slug` $\rightarrow$ `LocationProfileDetailPage` (`PW-003`)
- `/checkout/:locId` $\rightarrow$ `WebCheckoutSchedulePage` (`PW-004`)
- `/booking/confirm` $\rightarrow$ `WebPaymentConfirmationPage` (`PW-005`)
- `/become-a-host` $\rightarrow$ `BecomeAHostLandingPage` (`PW-006`)
- `/how-it-works` $\rightarrow$ `HowItWorksPage` (`PW-007`)
- `/help` $\rightarrow$ `HelpCentreFaqPage` (`PW-008`)
- `/contact` $\rightarrow$ `ContactUsPage` (`PW-009`)
- `/terms` $\rightarrow$ `TermsPrivacyLegalPage` (`PW-010`)
- `/portal/bookings` $\rightarrow$ `TravellerWebPortalPage` (`PW-011`)

#### 3.2 Host Web Dashboard (`HD` — 14 Active Screens)
Protected by `ProtectedRoute` (`requiredRoles: ["HOST_OWNER", "HOST_STAFF", "SUPERADMIN"]`, `allowDemoPreview: true`):
- `/host` & `/host/dashboard` $\rightarrow$ `HostOverviewDashboardPage` (`HD-001`)
- `/host/locations` $\rightarrow$ `HostLocationManagementPage` (`HD-002`)
- `/host/locations/:id` $\rightarrow$ `HostLocationProfileEditorPage` (`HD-003`)
- `/host/locations/:id/schedule` $\rightarrow$ `HostScheduleCalendarEditorPage` (`HD-004`)
- `/host/locations/:id/capacity` $\rightarrow$ `HostCapacityPoolsZonesPage` (`HD-005`)
- `/host/locations/:id/pricing` $\rightarrow$ `HostPricingRulesMultipliersPage` (`HD-006`)
- `/host/bookings` $\rightarrow$ `HostBookingManagementHubPage` (`HD-007`)
- `/host/bookings?inspect=:bookingId` $\rightarrow$ `BookingInvestigationModal` (`HD-008`)
- `/host/operations` $\rightarrow$ `HostWebCheckInOutOperationsPage` (`HD-009`)
- `/host/finance` $\rightarrow$ `HostFinancialRevenueLedgerPage` (`HD-010`)
- `/host/payouts` $\rightarrow$ `HostPayoutAccountsHistoryPage` (`HD-011`)
- `/host/reviews` $\rightarrow$ `HostReviewManagementPage` (`HD-012`)
- `/host/staff` $\rightarrow$ `HostStaffManagementRbacPage` (`HD-013`)
- `/host/settings` $\rightarrow$ `HostBusinessProfileLegalPage` (`HD-014`)

#### 3.3 Superadmin Web Dashboard (`AD` — 18 Active Screens)
Protected by `ProtectedRoute` (`requiredRoles: ["SUPERADMIN", "SUPPORT"]`, `allowDemoPreview: true`):
- `/admin` $\rightarrow$ `AdminCommandDashboardPage` (`AD-001`)
- `/admin/hosts/review` $\rightarrow$ `AdminHostVerificationQueuePage` (`AD-002`)
- `/admin/hosts` $\rightarrow$ `AdminHostDirectoryManagementPage` (`AD-003`)
- `/admin/locations` $\rightarrow$ `AdminStorageLocationModerationPage` (`AD-004`)
- `/admin/bookings` $\rightarrow$ `AdminGlobalBookingsLedgerPage` (`AD-005`)
- `/admin/payments` $\rightarrow$ `AdminPaymentTransactionsLogPage` (`AD-006`)
- `/admin/refunds` $\rightarrow$ `AdminRefundManagementQueuePage` (`AD-007`)
- `/admin/payouts/batches` $\rightarrow$ `AdminHostPayoutBatchGenerationPage` (`AD-008`)
- `/admin/payouts/disburse` $\rightarrow$ `AdminManualPayoutDisbursementPage` (`AD-009`)
- `/admin/finance/ledger` $\rightarrow$ `AdminDoubleEntryFinancialLedgerPage` (`AD-010`)
- `/admin/support` $\rightarrow$ `AdminSupportTicketTriageQueuePage` (`AD-011`)
- `/admin/support/:id` $\rightarrow$ `AdminSupportTicketResolutionViewPage` (`AD-012`)
- `/admin/incidents` $\rightarrow$ `AdminIncidentDisputeInvestigationPage` (`AD-013`)
- `/admin/reviews` $\rightarrow$ `AdminReviewModerationQueuePage` (`AD-014`)
- `/admin/promotions` $\rightarrow$ `AdminPromotionMarketingEnginePage` (`AD-015`)
- `/admin/settings` $\rightarrow$ `AdminPlatformSystemConfigurationPage` (`AD-016`)
- `/admin/audit` $\rightarrow$ `AdminSecurityComplianceAuditLogPage` (`AD-017`)
- `/admin/staff` $\rightarrow$ `AdminStaffRbacManagementPage` (`AD-018`)

#### 3.4 Phase 1B Web Identity & System Routes (11 Screens)
- `/login` $\rightarrow$ `LoginPage`
- `/register` $\rightarrow$ `RegisterPage`
- `/forgot-password` $\rightarrow$ `ForgotPasswordPage`
- `/reset-password` $\rightarrow$ `ResetPasswordPage`
- `/verify-email` $\rightarrow$ `VerifyEmailPage`
- `/profile` $\rightarrow$ `ProfilePage`
- `/settings/security` $\rightarrow$ `SecurityPage`
- `/settings/sessions` $\rightarrow$ `SessionsPage`
- `/health` $\rightarrow$ `HealthPage`
- `/forbidden` $\rightarrow$ `ForbiddenPage`
- `/*` $\rightarrow$ `NotFoundPage`

---

### 4. Mobile Application Structure & Route Analysis (`apps/mobile`)

The mobile application utilizes Expo Router with file-system-based routing:

```
apps/mobile/app/
├── (account)/           # Profile, Security, Sessions
│   ├── _layout.tsx
│   ├── profile.tsx      # TM-042 Traveller Profile & Account
│   ├── security.tsx     # TM-043 Security & Password Update
│   └── sessions.tsx     # Active session revocation
├── (auth)/              # Mobile Authentication
│   ├── _layout.tsx
│   ├── forgot-password.tsx # TM-007 Forgot Password
│   ├── login.tsx        # TM-005 / HM-002 Login Screen
│   ├── register.tsx     # TM-006 Registration Screen
│   └── reset-password.tsx
├── (host)/              # Host Operations
│   ├── _layout.tsx
│   ├── index.tsx        # Host Mobile Hub Screen (HM-001..HM-037 switcher)
│   └── scanner.tsx      # HM-021 / HM-024 QR & PIN Entry View
├── (traveller)/         # Traveller Journey
│   ├── _layout.tsx
│   ├── index.tsx        # Traveller Mobile Hub Screen (TM-001..TM-044 switcher)
│   └── explore.tsx      # TM-012 Map Discovery
├── _layout.tsx          # Root Stack & Auth Provider
└── index.tsx            # Role Entry Gateway (Traveller vs Host Switcher)
```

#### 4.1 Structural Architectural Problem in Mobile
As demonstrated by visual and source inspection, `apps/mobile/app/(traveller)/index.tsx` (694 lines) and `apps/mobile/app/(host)/index.tsx` (528 lines) do **not** represent authentic mobile screens. Instead, each file contains:
1. A hardcoded array of screen specifications imported from `mock-marketplace.ts`.
2. A state variable `activeScreenId` toggled via a category filter and scrollable card grid.
3. An active viewport card rendering the mascot, internal screen ID, workflows, and a tiny mock control block.
4. **Architectural Consequence:** The mobile app cannot be navigated like a real app. A traveller cannot start on a search page, click a location, choose dates, checkout, and receive a voucher through normal stack pushes. Instead, they must scroll down to a developer card grid labeled "Browse All 39 Registered Traveller Mobile Screens" and tap a card to swap the viewport.

---

### 5. Shared Design Tokens & Component Libraries

1. **Web Component Infrastructure:**
   - Styling: Tailwind CSS 3.4.3 with custom color variables (`brand`, `accent`, `slate`).
   - Icons: `lucide-react` (50+ icons utilized across navigation and status cards).
   - Component Primitives: No headless component library (e.g. Radix UI, Headless UI) is installed. Modals, dropdowns, and tabs are hand-rolled using basic `div`, `button`, and CSS classes.
2. **Mobile Component Infrastructure:**
   - React Native core primitives (`View`, `Text`, `TouchableOpacity`, `TextInput`, `ScrollView`, `StyleSheet`).
   - Styling: Hardcoded inline StyleSheet objects with hex colors (`#0F172A`, `#2563EB`, `#E2E8F0`, `#F8FAFC`). No shared token library exists between Web and Mobile.
3. **Mascot Illustration Components:**
   - Web: `apps/web/src/components/ui/MascotIllustration.tsx`
   - Mobile: `apps/mobile/src/components/MascotIllustration.tsx`
   - Shared Metadata: `mascots.ts` in web and mobile, defining filenames, alt text, and assigned primary screen IDs for all 20 assets.
