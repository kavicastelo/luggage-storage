# Project Stabilization — Product & Technical Decision Resolution (`OQ-001`..`OQ-022`, `OTD-001`..`OTD-008`)

**Project:** Global Luggage Storage Marketplace  
**Document ID:** `DOC-STAB-03`  
**Phase:** Project Stabilization & Previous Phase Completion  
**Authoritative References:** `docs/product/assumptions-and-open-questions.md` (`DOC-PROD-005`), `docs/architecture/phase-0c-open-decisions.md` (`DOC-ARCH-006`)  
**Status:** `COMPLETE — ALL OQ & OTD ITEMS CLASSIFIED, RESOLVED OR ESCALATED`

---

## 1. Executive Summary

This document reviews and resolves every Open Question (`OQ-001` through `OQ-022`) and Open Technical Decision (`OTD-001` through `OTD-008`) across the Global Luggage Storage Marketplace documentation and codebase. Each item is assigned an authoritative disposition:

- **`RESOLVED_INTERNAL`** — Resolved through architecture, product governance, and code implementation within the repository.
- **`BLOCKED_EXTERNAL`** — Requires external legal counsel or payment-gateway vendor confirmation; documented here with exact decision packages, architectural fallbacks, and questionnaires so no ambiguity remains for engineering.
- **`DEFERRED_POST_MVP`** — Explicitly scoped out of the MVP baseline with an approved architectural boundary so MVP code does not depend on unbuilt external infrastructure.

---

## 2. Master Disposition Matrix (`OQ-001` – `OQ-022` & `OTD-001` – `OTD-008`)

### 2.1 Product Open Questions (`OQ-001` – `OQ-022`)

| ID | Topic | Previous Status | Stabilization Status | Phase Impact | Code / Doc Enforcement |
|:---|:---|:---|:---|:---|:---|
| `OQ-001` | Bag Size & Weight Tiers (`Small`, `Medium`, `Large`, `Extra Large / Odd-Size`) | `Approved Decision` | **`RESOLVED_INTERNAL`** | Phase 2 UX / Phase 3 Domain | Enforced in UI (`TM-018`, `PW-004`, `HD-005`) |
| `OQ-002` | Host Verification Document Checklist (Sri Lanka MVP) | `Pending Legal & Operations Sign-off` | **`RESOLVED_INTERNAL`** | Phase 2 UX / Phase 3 Host Onboarding | Standardized tiered checklist (`NIC/Passport`, `BR/ Registration`, `Address Proof`, `Premises Photos`) |
| `OQ-003` | PayHere Marketplace Model (`Standard Merchant` vs `Automated Split`) | `Pending PayHere Commercial & Technical Confirmation` | **`BLOCKED_EXTERNAL`** | Phase 4 Payments & Ledger | Platform Merchant-of-Record + Ledger-Driven Host Payout Batch default (`WF-034`/`WF-035`) + Vendor Questionnaire |
| `OQ-004` | Booking Confirmation Model (`Instant` vs `Request-to-Book`) | `Approved Decision` | **`RESOLVED_INTERNAL`** | Phase 2 UX / Phase 3 Bookings | Hybrid Location-Level Configurable (`INSTANT_BOOK` default, `REQUEST_TO_BOOK` optional) |
| `OQ-005` | Overdue Bag Abandonment Escalation Protocol | `Approved Decision` | **`RESOLVED_INTERNAL`** | Phase 2 UX / Phase 3 Custody | 4-stage escalation (`0h`, `+2h`, `+24h`, `+72h`) with mandatory Superadmin approval (`AD-013`) |
| `OQ-006` | Traveller Display Currency vs Settlement Currency | `Approved Decision` | **`RESOLVED_INTERNAL`** | Phase 2 UX / Phase 4 Payments | Multi-currency display (`LKR`, `USD`, `EUR`, `GBP`, `AUD`) + explicit `LKR` settlement disclosure |
| `OQ-007` | Prohibited Items Policy & Check-in Declaration | `Approved Decision` | **`RESOLVED_INTERNAL`** | Phase 2 UX / Phase 3 Bookings | Mandatory pre-payment Prohibited Items checkbox (`PW-004`, `TM-019`) + Host right of refusal (`HM-022`) |
| `OQ-008` | Review Eligibility & Double-Blind Window | `Approved Decision` | **`RESOLVED_INTERNAL`** | Phase 2 UX / Phase 5 Reviews | Verified `CHECKED_OUT` bookings only, 14-day window, publish-on-submit + Host response (`TM-034`, `HD-012`) |
| `OQ-009` | Minimum Booking Duration & Billing Granularity | `Approved Decision` | **`RESOLVED_INTERNAL`** | Phase 2 UX / Phase 3 Pricing | Hybrid per-24h / per-hour location pricing with 1-unit minimum charge (`HD-006`, `HM-014`) |
| `OQ-010` | Sri Lanka Legal & Tax Compliance (`VAT`, `SSCL`, `WHT`, CBSL Escrow) | `Pending Legal & Tax Counsel Review` | **`BLOCKED_EXTERNAL`** | Phase 4 Financial Ledger | 4-Layer Configurable Tax/Commission Engine (`AD-010`, `AD-016`) + Legal/Tax Counsel Checklist |
| `OQ-011` | Traveller Cancellation Tiers (`Flexible`, `Moderate`, `Strict`) | `Approved Decision` | **`RESOLVED_INTERNAL`** | Phase 2 UX / Phase 4 Refunds | Standardized 3-tier system (`Flexible` default) + 15-minute post-payment grace period (`TM-031`, `AD-007`) |
| `OQ-012` | Host Commission Structure & Platform Service Fee | `Approved Decision` | **`RESOLVED_INTERNAL`** | Phase 2 UX / Phase 4 Ledger | Configurable dual-fee structure (Host commission + Traveller service fee) on `AD-016` |
| `OQ-013` | Refund Execution Capabilities (PayHere API vs Manual Assisted) | `Approved Decision (Requires Technical Verification)` | **`RESOLVED_INTERNAL`** | Phase 2 UX / Phase 4 Refunds | 7-stage refund state machine supporting both API-automated and Superadmin-assisted execution (`AD-007`, `TM-033`) |
| `OQ-014` | Custody Verification Security (QR Primary + PIN Fallback) | `Approved Decision` | **`RESOLVED_INTERNAL`** | Phase 2 UX / Phase 3 Custody | Cryptographic QR primary + rate-limited 6-digit PIN fallback + mandatory bag-count check (`HM-021`..`025`, `HD-009`) |
| `OQ-015` | Late Collection Fee & Decoupled Custody Return | `Approved Decision` | **`RESOLVED_INTERNAL`** | Phase 2 UX / Phase 3 Custody | Configurable grace period & late fee; unpaid fee never blocks physical bag return (`HM-028`, `AD-013`) |
| `OQ-016` | Operational Support Workflow & Ticket Queue Separation | `Pending Decision` | **`RESOLVED_INTERNAL`** | Phase 1B RBAC / Phase 2 UX | Dual specialized queues: `AD-011`/`AD-012` (`SUPPORT` + `SUPERADMIN`) vs `AD-013` Incidents/Disputes (`SUPERADMIN` escalation) |
| `OQ-017` | Host Staff Invitation & Operational Role Boundaries | `Approved Decision` | **`RESOLVED_INTERNAL`** | Phase 1B RBAC / Phase 2 UX | `HOST_STAFF` strictly restricted to operational check-in/out & booking view; zero access to finance/payouts/staff/location deletion |
| `OQ-018` | Geospatial Map Provider Selection (Sri Lanka & Global) | `Open Technical Decision` | **`RESOLVED_INTERNAL`** | Phase 2 UX / Phase 3 Discovery | MapLibre GL / MapTiler Vector Tiles (OpenStreetMap data) selected for MVP with Google Maps adapter interface |
| `OQ-019` | Transactional Email Provider & Adapter Architecture | `Open Technical Decision` | **`RESOLVED_INTERNAL`** | Phase 1B Auth & Email | `EmailDeliveryAdapter` implemented with `ResendHttpEmailAdapter` (production), `ConsoleDevEmailAdapter` (dev), `DeterministicTestEmailAdapter` (test) |
| `OQ-020` | SMS / WhatsApp OTP Verification Scope | `Open Technical Decision` | **`DEFERRED_POST_MVP`** | Phase 1B Auth | Email token verification is authoritative for MVP (`POST /auth/verify-email`); SMS/WhatsApp OTP deferred to Post-MVP |
| `OQ-021` | Rate Limiting & Distributed Locking Infrastructure (PostgreSQL vs Redis) | `Open Technical Decision` | **`RESOLVED_INTERNAL`** | Phase 1B Security | PostgreSQL-backed `auth_rate_limits` & row-level locking (`SELECT ... FOR UPDATE`) for MVP; Redis deferred until multi-region scale |
| `OQ-022` | Object Storage & KYC Document Isolation | `Open Technical Decision` | **`RESOLVED_INTERNAL`** | Phase 3 Host Onboarding | S3-compatible private bucket (`Cloudflare R2` / `AWS S3`) with short-lived pre-signed URLs for KYC & custody photos |

### 2.2 Phase 0C Open Technical Decisions (`OTD-001` – `OTD-008` Cross-Reference)

| OTD ID | Corresponding OQ | Resolution Summary |
|:---|:---|:---|
| `OTD-001` | `OQ-003`, `OQ-013` | PayHere Standard Merchant Checkout + Ledger-Driven Payout Batching selected as default MVP architecture; 7-stage refund state machine handles both API and manual settlement. |
| `OTD-002` | `OQ-018` | MapLibre GL JS / React Native MapLibre with MapTiler (OSM) vector tiles selected for cost-predictable Sri Lanka & global coverage; provider-agnostic coordinate schema (`lat`/`lng` + PostGIS `GEOGRAPHY(POINT, 4326)`). |
| `OTD-003` | `OQ-019` | `EmailDeliveryAdapter` implemented in `apps/api/src/modules/email/` supporting `resend` (HTTPS API), `console` (local dev), `test` (deterministic capture), and `noop` (explicitly logged). |
| `OTD-004` | `OQ-020` | Self-service Email Verification (`email_verification_tokens`) is mandatory and authoritative for MVP account activation; SMS/WhatsApp notifications deferred to Post-MVP. |
| `OTD-005` | `OQ-021` | PostgreSQL atomic upsert (`auth_rate_limits`) and transactional row locks (`FOR UPDATE`) used for MVP without requiring a Redis cluster. |
| `OTD-006` | `OQ-002` | Tiered Sri Lanka Host KYC checklist approved (Individual/Sole Proprietor vs Registered Company/Hotel) with Superadmin verification queue (`AD-002`). |
| `OTD-007` | `OQ-010` | 4-layer configurable fee/tax/withholding ledger schema (`AD-010`, `AD-016`) ready for Sri Lanka tax parameters upon external counsel sign-off. |
| `OTD-008` | `OQ-006` | Pricing stored in integer minor units (`cents`/`paisa`) with ISO-4217 currency code; display conversion decoupled from `LKR` settlement currency. |

---

## 3. Detailed Decisions & Engineering Specifications

### 3.1 `OQ-002` / `OTD-006` — Sri Lanka Host Verification MVP Policy (`RESOLVED_INTERNAL`)

**Decision:**  
To support both established hospitality businesses (hotels, hostels, travel agencies) and vetted local retail shops near Sri Lanka transit hubs (Colombo Fort, Pettah, Kandy, Ella, Galle, Negombo), the platform enforces a **Two-Tier Host KYC Verification Policy**:

1. **Tier 1 — Registered Commercial Entity (Hotels, Hostels, Corporate Retailers):**
   - Government-issued ID (`Sri Lanka NIC` or `Passport`) of the authorized representative (`HOST_OWNER`).
   - Business Registration Certificate (`BR`) or Certificate of Incorporation (`PV` number) or Sri Lanka Tourism Development Authority (`SLTDA`) license.
   - Proof of commercial premises address (utility bill, lease agreement, or municipal tax receipt dated within 90 days).
   - Minimum 3 clear photographs of the storage area (exterior storefront entrance, reception/handover counter, and secured/locked luggage storage room or zone).
2. **Tier 2 — Sole Proprietor / Micro-Merchant Partner:**
   - Government-issued ID (`Sri Lanka NIC` front & back or `Passport`) of the shop owner (`HOST_OWNER`).
   - Divisional Secretariat Trade License, Grama Niladhari business attestation, or commercial lease/utility bill in the proprietor's name.
   - Minimum 3 clear photographs of the storefront and dedicated lockable luggage storage zone.
   - Mandatory initial capacity cap (e.g., max 15 bags/day) until 20 completed custody handovers with zero incidents, or physical/video spot-check by platform operations.

**Operational Enforcement:**
- Reflected in `HM-003` (Business Profile Setup), `HM-004` (KYC Document Upload), `HM-005` (Host Application Status), and `AD-002` (Superadmin Host Verification Queue).
- No Host location can transition to `PUBLISHED` until a `SUPERADMIN` explicitly approves the KYC package.

---

### 3.2 `OQ-003` / `OTD-001` — PayHere Marketplace Model (`BLOCKED_EXTERNAL` with Default Architecture)

**Status:** `BLOCKED_EXTERNAL` (Awaiting PayHere Commercial Account Underwriting Confirmation)

**Approved Default Engineering Architecture (No Blocker to Internal Development):**  
The platform is architected around **Model A — Platform Merchant-of-Record Checkout + Double-Entry Ledger + Scheduled Host Payout Batches (`WF-034` / `WF-035`)**:
1. Traveller checkout (`PW-005`, `TM-020`) processes the full booking payment into the Platform's primary PayHere Merchant account.
2. Upon server-to-server webhook signature verification (`md5sig`), the platform records the gross payment, platform service fee, host commission, and net host payable in the internal Double-Entry Financial Ledger (`AD-010`).
3. Host earnings remain in `PENDING_CUSTODY` status until booking check-out (`CHECKED_OUT`) is verified (`OQ-014`).
4. Once `CHECKED_OUT` (plus configurable dispute buffer), net host earnings move to `AVAILABLE_FOR_PAYOUT` (`HM-029`, `HD-010`).
5. Platform finance generates periodic Payout Batches (`AD-008`) and disburses funds to verified Sri Lankan Host bank accounts (`CEFT` / `SLIPS`) with disbursement audit references (`AD-009`, `HM-031`, `HD-011`).

**External Vendor Questionnaire for PayHere Account Manager:**
1. Does PayHere Sri Lanka offer a native multi-party split-settlement API for marketplaces, or must all checkout funds settle into the primary Merchant account first?
2. What is the standard settlement cycle (`T+1`, `T+2`, `T+3`) for foreign-issued Visa/Mastercard cards settling in `LKR`?
3. Are programmatic partial and full refunds supported via the PayHere REST API for all payment methods (`Visa`, `Mastercard`, `LankaQR`, `eZ Cash`, `Genie`), and what is the API endpoint rate limit and fee retention policy on refunded transactions?
4. What webhook retry schedule does PayHere use when `notify_url` returns a non-`200` status?

---

### 3.3 `OQ-010` / `OTD-007` — Sri Lanka Legal & Tax Compliance (`BLOCKED_EXTERNAL` with 4-Layer Configurable Architecture)

**Status:** `BLOCKED_EXTERNAL` (Awaiting Sri Lanka Corporate & Tax Counsel Sign-off)

**Approved 4-Layer Configurable Financial Architecture:**  
To ensure zero code rewrites regardless of final tax counsel determination, the financial calculation engine (`AD-010`, `AD-016`, `HD-010`) separates every booking into four configurable layers:
1. **Layer 1 — Base Storage Charge & Traveller Service Fee:** Stored in minor units (`LKR` cents), supporting configurable platform commission % and traveller service fee %.
2. **Layer 2 — Indirect Tax Rule Engine (`VAT` / `SSCL`):** Configurable rates (`0%` if below threshold or exempt, or statutory `18% VAT` / `2.5% SSCL`) applied either exclusively to the Platform Commission/Fee (Agency Model) or gross transaction, controlled via `AD-016` (`Platform System Configuration`).
3. **Layer 3 — Host Tax Identification & Withholding (`TIN` / `VAT` / `WHT`):** Host business profiles (`HD-014`, `HM-037`) capture optional `TIN` and `VAT Registration Number` and support configurable Withholding Tax (`WHT`) deduction prior to payout batch generation.
4. **Layer 4 — Custody Liability Limit & Contractual Terms (`PW-010`):** Standard platform Terms of Service define the platform as a booking technology intermediary and specify a configurable per-bag contractual protection cap, paired with mandatory Prohibited Items declaration (`OQ-007`).

**External Legal & Tax Counsel Checklist:**
1. Confirm whether the platform qualifies as a *Commercial Agent / Marketplace Intermediary* under Inland Revenue Department (IRD) rules such that `VAT` (`18%`) and `SSCL` (`2.5%`) apply only to the platform's commission and service fee rather than the Host's storage share.
2. Confirm whether holding Traveller booking funds between checkout and bag check-out (`T+1` to `T+14` days) is classified as standard commercial prepayment for services or triggers any Central Bank of Sri Lanka (CBSL) escrow/payment-service-provider licensing requirements.
3. Confirm whether platform payouts to local Hosts require Withholding Tax (`WHT`) deduction under the Inland Revenue Act.

---

### 3.4 `OQ-013` — Refund Execution Capabilities & 7-Stage State Machine (`RESOLVED_INTERNAL`)

**Decision:**  
Refund processing uses a deterministic **7-Stage Refund Lifecycle State Machine** that seamlessly supports both automated gateway API refunds and Superadmin-assisted manual refunds:
1. `REFUND_REQUESTED` — Triggered automatically by Traveller cancellation (`WF-028`), Host rejection/timeout (`WF-022`), or Superadmin dispute resolution (`WF-031`).
2. `POLICY_EVALUATED` — System calculates exact refundable amount based on `OQ-011` (`Flexible`, `Moderate`, `Strict`, or `15-Minute Grace Period`).
3. `PENDING_APPROVAL` — Used when a manual exception/dispute refund requires `SUPERADMIN` sign-off (`AD-007`); bypassed for automated policy refunds.
4. `GATEWAY_SUBMITTED` — Dispatched to payment gateway refund API (or queued in `AD-007` if gateway requires merchant portal execution).
5. `MANUAL_INTERVENTION_REQUIRED` — Triggered if the gateway API rejects or times out on an automated refund; surfaces in `AD-007` (`Refund Management Queue`) for `SUPERADMIN` resolution.
6. `REFUND_COMPLETED` — Confirmed via gateway webhook/API response or recorded `SUPERADMIN` settlement reference; ledger reversal entries posted in `AD-010`.
7. `REFUND_REJECTED` — Terminal state when an out-of-policy manual refund request is declined with an audited reason (`AD-017`).

---

### 3.5 `OQ-016` — Operational Support Workflow & Ticket Queue Separation (`RESOLVED_INTERNAL`)

**Decision:**  
The platform enforces **strict queue separation** between general customer support inquiries and high-risk custody/financial disputes:

1. **General Support Queue (`AD-011` Support Ticket Triage Queue & `AD-012` Support Ticket Resolution View):**
   - **Accessible Roles:** `SUPPORT` (`support.tickets.manage`, `users.read`, `bookings.read.all`) and `SUPERADMIN`.
   - **Scope:** General booking questions, date-change inquiries, location directions, and account assistance (`WF-039`, `WF-040`).
   - **Restrictions:** `SUPPORT` agents **cannot** approve Host KYC (`AD-002`), execute refunds (`AD-007`), disburse payouts (`AD-008`/`AD-009`), modify system settings (`AD-016`), view security audit logs (`AD-017`), or manage RBAC (`AD-018`).
2. **Incident & Dispute Investigation Queue (`AD-013` Incident & Dispute Investigation):**
   - **Accessible Roles:** `SUPERADMIN` (`admin.system.configure`, `refunds.manage`, `payments.manage`) — `SUPPORT` agents can escalate a ticket from `AD-012` into `AD-013`, or view read-only status when permitted, but **only `SUPERADMIN`** can adjudicate custody damage/tampering claims, abandoned luggage escalations (`OQ-005`), overdue fee disputes (`OQ-015`), or override refunds (`WF-027`, `WF-031`, `WF-041`, `WF-042`).

---

### 3.6 `OQ-017` — Host Staff Invitation & Operational Role Boundaries (`RESOLVED_INTERNAL`)

**Decision:**  
The `HOST_STAFF` role is strictly an **operational counter role** (`WF-006`) and is enforced across database RBAC permissions, backend route guards, and Web/Mobile UI boundaries:

- **Granted to `HOST_STAFF` (`5` permissions):**
  - `users.read.self`
  - `Users.update.self`
  - `locations.read.own`
  - `bookings.read.location`
  - `bookings.checkin.checkout` (QR scan, PIN fallback, bag count verification, photo upload, overdue alert logging)
- **Strictly Forbidden to `HOST_STAFF` (`HOST_OWNER` only):**
  - Creating, editing, or deleting storage locations, capacity pools, schedules, or pricing rules (`locations.create`, `locations.update.own`, `HD-002`..`HD-006`, `HM-003`..`HM-005`, `HM-009`..`HM-014`, `HM-037`).
  - Viewing financial ledgers, revenue balances, bank account details, or payout receipts (`payouts.read.own`, `HD-010`, `HD-011`, `HM-029`..`HM-031`).
  - Inviting, suspending, or revoking other staff members (`host.staff.manage`, `HD-013`, `HM-033`, `HM-034`).
- **UI Enforcement:** Neither Web (`HostDashboardPages.tsx`) nor Mobile (`apps/mobile/app/(host)/index.tsx`) permits an authenticated `HOST_STAFF` user to switch into `HOST_OWNER` mode via client-side state.

---

### 3.7 `OQ-018` / `OTD-002` — Geospatial Map Provider Selection (`RESOLVED_INTERNAL`)

| Criterion | Option A: MapLibre GL + MapTiler (OpenStreetMap) | Option B: Google Maps Platform | Option C: Mapbox GL |
|:---|:---|:---|:---|
| **Sri Lanka Transit & Street Coverage** | High (actively maintained OSM data across Colombo, Kandy, Ella, Galle, Negombo) | Very High (richest POI database) | High (OSM-derived) |
| **Cost Predictability at MVP Scale** | **Excellent** (generous free tier, low flat/tiered vector tile pricing, zero per-keystroke autocomplete shock) | Expensive ($7/1k map loads, $17/1k Places sessions) | Moderate ($5/1k map loads after free tier) |
| **React Web + Expo Mobile Support** | `@vis.gl/react-maplibre` (Web) + `@maplibre/maplibre-react-native` (Expo) | `@vis.gl/react-google-maps` + `react-native-maps` | `react-map-gl` + `@rnmapbox/maps` |
| **Vendor Lock-in** | **Zero** (open-source renderer, swappable tile URL) | High (proprietary SDK & terms) | Moderate |

**Decision:**  
Select **MapLibre GL with MapTiler Vector Tiles (OpenStreetMap)** as the primary MVP map rendering engine (`PW-002`, `TM-012`), backed by a provider-agnostic backend geospatial contract (`latitude`, `longitude`, `radiusMeters`, PostGIS `GEOGRAPHY(POINT, 4326)`). If commercial POI autocomplete density requires Google Places in a future phase, the tile/geocoding adapter can be swapped via environment configuration without changing frontend components or database schemas.

---

### 3.8 `OQ-019` / `OTD-003` — Transactional Email Provider & Adapter Architecture (`RESOLVED_INTERNAL`)

| Criterion | Option A: Resend (HTTPS API) | Option B: AWS SES | Option C: Postmark |
|:---|:---|:---|:---|
| **Integration Simplicity** | **Zero external SDK bloat** (single standard `fetch` POST to `https://api.resend.com/emails`) | Requires `@aws-sdk/client-ses` or SMTP signing | Simple REST API |
| **Deliverability & DKIM/SPF** | Fast domain verification, dedicated transactional routing | High (requires AWS sandbox exit request) | Very High |
| **Local Dev & Automated Test Safety** | Cleanly abstracted behind `EmailDeliveryAdapter` | Cleanly abstracted behind `EmailDeliveryAdapter` | Cleanly abstracted behind `EmailDeliveryAdapter` |

**Decision & Implementation (`apps/api/src/modules/email/`):**  
We have standardized on the pluggable `EmailDeliveryAdapter` interface supporting both **Account Email Verification** (`sendEmailVerificationEmail`) and **Password Reset** (`sendPasswordResetEmail`) with four concrete runtime strategies controlled via `EMAIL_PROVIDER`:
1. `resend` (`ResendHttpEmailAdapter`) — Production HTTPS adapter using native `fetch` with timeout and structured error handling; requires `RESEND_API_KEY` and `EMAIL_FROM_ADDRESS`.
2. `console` (`ConsoleDevEmailAdapter`) — Default in local `development`; logs structured metadata and verification/reset links to the local developer console without claiming external delivery.
3. `test` (`DeterministicTestEmailAdapter`) — Default in automated `test` environment; captures sent messages in memory so Vitest suites can deterministically inspect verification and reset tokens.
4. `noop` (`NoopEmailDeliveryAdapter`) — Safe fallback when no external provider key is configured; logs an explicit warning (`deliveryStatus: "skipped_noop"`) and **never falsely claims** an external email was delivered.

---

### 3.9 `OQ-020` / `OTD-004` — SMS / WhatsApp OTP Verification Scope (`DEFERRED_POST_MVP`)

**Decision:**  
- **Email Token Verification is Authoritative for MVP (`WF-001`):** Every self-registered account starts in `PENDING_VERIFICATION` (`is_email_verified = false`), receives a 256-bit single-use token (stored as a SHA-256 hash in `email_verification_tokens` with a 24-hour TTL), and **cannot sign in or obtain tokens** until verified via `POST /api/v1/auth/verify-email` (with rate-limited `POST /api/v1/auth/resend-verification` support).
- **SMS / WhatsApp OTP Deferred to Post-MVP:** Sri Lanka local SMS gateways (`Dialog`, `Mobitel`, `Notify.lk`) and WhatsApp Business templates require telecom sender-ID registration. Therefore, phone numbers are stored in E.164 format (`users.phone`) for booking contact purposes, while live SMS OTP dispatch is explicitly deferred to Post-MVP. Screen `TM-008` in the mobile app is wired directly to the live **Email Verification & Resend API** (`POST /api/v1/auth/verify-email` and `POST /api/v1/auth/resend-verification`) and clearly labels SMS OTP as a Post-MVP enhancement.

---

### 3.10 `OQ-021` / `OTD-005` — Rate Limiting & Concurrency Infrastructure (`RESOLVED_INTERNAL`)

**Decision:**  
- **PostgreSQL-Backed Rate Limiting & Locking for MVP (`auth_rate_limits`):** Rather than introducing an extra Redis cluster for MVP, rate limiting across authentication endpoints (`/auth/register`, `/auth/login`, `/auth/forgot-password`, `/auth/resend-verification`) is implemented using an atomic PostgreSQL sliding/fixed window upsert table (`auth_rate_limits`) keyed by privacy-preserving SHA-256 hashes of `(scope, identifier)`.
- **Multi-Instance Safe:** Because state lives in PostgreSQL with atomic `INSERT ... ON CONFLICT (key_hash) DO UPDATE` statements and row-level `SELECT ... FOR UPDATE` locks on token rotation (`refresh_tokens`, `password_reset_tokens`, `email_verification_tokens`), horizontal scaling of Fastify API containers is safe without Redis.
- **Future Evolution:** When booking concurrency and high-frequency geospatial caching scale beyond single-region PostgreSQL throughput, Redis can be introduced behind `RateLimitService` without changing route contracts.

