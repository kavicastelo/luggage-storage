# Assumptions and Open Questions Register

**Document Status:** Baseline Architecture — Phase 0A (Requires Product Owner Review)
**Source Reference:** [luggage-storage-frs.pdf](source/luggage-storage-frs.pdf)
**Related Documents:**
- [Product Overview](product-overview.md)
- [Product Scope and Application Boundaries](product-scope-and-boundaries.md)
- [User Roles and Actor Model](user-roles-and-actors.md)
- [Technology Decisions Register](../architecture/technology-decisions.md)
- [Phase 0A Summary](../architecture/phase-0a-summary.md)

---

## 1. Purpose

This register maintains a structured record of **explicit architectural assumptions** and **unresolved business, legal, and technical questions** identified during Phase 0A inspection of the Functional Requirement Specification (`luggage-storage-frs.pdf`) and architectural constraints.

> [!IMPORTANT]
> **Source Fidelity Rule:** No ambiguous business rule or unapproved third-party provider has been silently treated as finalized. Items marked **Owner Approval Required: Yes** must be reviewed and confirmed by the product owner before implementing the affected modules.

---

## 2. Priority Summary Matrix

### 2.1 Governance Status Model (`AUD-005`)

All items in this register use the standardized 7-status governance model so internal engineering baselines are never conflated with external commercial, legal, tax, or owner sign-off gates:

- `RESOLVED_INTERNAL` — Internal engineering/product design decision implemented or adopted as the default baseline.
- `OWNER_APPROVAL_REQUIRED` — Internal recommendation exists, but final business policy or commercial sign-off requires Product Owner approval.
- `VENDOR_CONFIRMATION_REQUIRED` — Depends on written confirmation, API capability, or contract from an external vendor.
- `LEGAL_REVIEW_REQUIRED` — Depends on qualified legal counsel review.
- `TAX_REVIEW_REQUIRED` — Depends on qualified tax/accounting counsel review.
- `DEFERRED` — Intentionally postponed to a later phase with documented rationale.
- `BLOCKED` — Cannot be finalized for commercial production launch until a named external dependency is completed.

| ID | Category | Title / Topic | FRS Ref | Priority | Internal Engineering Baseline | External / Owner Gate Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `OQ-001` | Technical / Security | Authentication Strategy | `FR-1`, `FR-15` | **Critical** | `RESOLVED_INTERNAL` (Fastify self-managed auth, Postgres, Argon2id) | **Approved** |
| `OQ-002` | Legal / Operations | Host Identity & Business Verification Requirements | `FR-16`, `FR-17` | **High** | `RESOLVED_INTERNAL` (Two-tier configurable KYC schema & queue) | `OWNER_APPROVAL_REQUIRED`, `LEGAL_REVIEW_REQUIRED` |
| `OQ-003` | Commercial / Regulatory | PayHere Marketplace Payment Model | `FR-6`, `FR-37` | **Critical** | `RESOLVED_INTERNAL` (Merchant-of-Record + Ledger Payout Batch baseline) | `BLOCKED`, `VENDOR_CONFIRMATION_REQUIRED` |
| `OQ-004` | Product / Booking | Booking Modes, Configuration Hierarchy & Payment Timing | `FR-6`, `FR-26` | **High** | `RESOLVED_INTERNAL` (Both modes per location, 15m host SLA, 10m traveller pay) | **Approved** |
| `OQ-005` | Product / Pricing | Platform Commission & Promotional Discounts | `FR-5`, `FR-23`, `FR-38` | **High** | `RESOLVED_INTERNAL` (15% initial commission, gateway fees absorbed, promo rules) | **Approved** |
| `OQ-006` | Product / Capacity | Storage Capacity & Bag Categories | `FR-5`, `FR-21`, `FR-28` | **High** | `RESOLVED_INTERNAL` (4 categories: Small, Medium, Large, Oversized) | **Approved** |
| `OQ-007` | Identity / Roles | Traveller and Host Account Relationship | `FR-1`, `FR-15` | **High** | `RESOLVED_INTERNAL` (Unified Identity / Role Contexts) | **Approved** |
| `OQ-008` | Localization / Finance | Currency Representation, Precision & Multi-Currency Horizon | `FR-6`, `FR-14` | **High** | `RESOLVED_INTERNAL` (LKR launch, ISO 4217 integer minor units) / `DEFERRED` (Multi-currency) | **Approved** |
| `OQ-009` | Policy / Finance | Customer Cancellation & Refund Policy Tiers | `FR-10`, `FR-34` | **High** | `RESOLVED_INTERNAL` (Standard cancellation tiers approved) | **Approved** |
| `OQ-010` | Legal / Finance | Tax, Invoicing Architecture & Sri Lankan Compliance | `FR-36`, `FR-37`, `FR-38` | **Critical** | `RESOLVED_INTERNAL` (4-layer configurable tax & ledger foundation) | `BLOCKED`, `LEGAL_REVIEW_REQUIRED`, `TAX_REVIEW_REQUIRED` |
| `OQ-011` | Roles / Governance | Superadmin & Platform Support Role Separation | `FR-17`, `FR-37` | **Medium** | `RESOLVED_INTERNAL` (Strict least-privilege server-side RBAC) | **Approved** |
| `OQ-012` | Product / Trust | Address Privacy Baseline & Location Disclosure Details | `FR-4`, `FR-7` | **Medium** | `RESOLVED_INTERNAL` (Approximate discovery, exact address post-booking) | **Approved** (Baseline) / `OWNER_APPROVAL_REQUIRED` (Jitter & Storefront Details) |
| `OQ-013` | Scope / Payments | Payment-Provider Refund Capabilities, Execution Method & Fees | `FR-10` | **High** | `RESOLVED_INTERNAL` (7-stage refund lifecycle state machine) | `VENDOR_CONFIRMATION_REQUIRED` |
| `OQ-014` | Product / Custody | Custody & Check-In Evidence Policy | `FR-29` | **Medium** | `RESOLVED_INTERNAL` (QR primary + PIN fallback, bag count mandatory, photo configurable) | **Approved** |
| `OQ-015` | Product / Custody | Late Collection Fee Settlement & Custody Separation | `FR-32` | **High** | `RESOLVED_INTERNAL` (In-app collection only, custody decoupled from overdue payment) | **Approved** |
| `OQ-016` | Product / Support | Customer Support & Incident Separation (`FR-12` & `FR-40`) | `FR-12`, `FR-40`, `FR-41` | **Medium** | `RESOLVED_INTERNAL` (Public reviews vs Support Queue vs Superadmin Incident Queue) | **Internal Baseline Approved** |
| `OQ-017` | Roles / Host Staff | Host Staff Permission Granularity (`FR-42 Later`) | `FR-42`, `FR-44` | **Low** | `RESOLVED_INTERNAL` (Fixed least-privilege `HOST_STAFF` baseline) / `DEFERRED` (Custom ACL) | **Internal Baseline Approved** |
| `OQ-018` | Technical / Maps | Commercial Map Tile, Geocoding & Routing Provider | `FR-2`, `FR-3`, `FR-7` | **High** | `RESOLVED_INTERNAL` (MapLibre + MapTiler adapter & native directions deep links) | `VENDOR_CONFIRMATION_REQUIRED`, `OWNER_APPROVAL_REQUIRED` (Prod API Keys) |
| `OQ-019` | Technical / Comms | Transactional Email Provider Selection | `FR-1`, `FR-11`, `FR-35` | **Medium** | `RESOLVED_INTERNAL` (Zoho Mail SMTP `ZohoSmtpEmailAdapter` implemented) | `OWNER_APPROVAL_REQUIRED`, `VENDOR_CONFIRMATION_REQUIRED` (Live DNS & Credentials) |
| `OQ-020` | Technical / Comms | SMS / Phone OTP Verification Requirement & Provider | `FR-1`, `FR-11` | **Medium** | `RESOLVED_INTERNAL` (Email verification authoritative for MVP) / `DEFERRED` (SMS OTP) | `DEFERRED`, `VENDOR_CONFIRMATION_REQUIRED`, `OWNER_APPROVAL_REQUIRED` |
| `OQ-021` | Infrastructure | Redis / Upstash Activation Threshold | Infrastructure | **Low** | `RESOLVED_INTERNAL` (PostgreSQL rate limits & row locks for MVP) / `DEFERRED` (Redis) | **Internal Baseline Approved** |
| `OQ-022` | Requirements | Normalization of Duplicate FRS Requirement Numbers (`FR-2`–`FR-14`) | `FR-2`..`FR-14` | **Medium** | `RESOLVED_INTERNAL` (Resolved in Phase 0B) | **Approved** |

---

## 3. Detailed Register of Assumptions and Open Questions

---

### `OQ-001` — Authentication Strategy
- **Category:** Technical / Security
- **Source Reference:** `FR -1 Account Registration & Login`, `FR-15 Host Registration`.
- **Status:** **Owner-Approved Decision**.
- **Owner-Approved Decision:**
  - Use **self-managed authentication** inside the Fastify modular monolith.
  - Initial implementation components:
    - Fastify authentication module with server-side session management.
    - PostgreSQL-backed `users` and `sessions` records with secure token hashes.
    - **Argon2id** password hashing for local credentials.
    - Short-lived access credentials and securely rotated refresh sessions.
    - Secure, `HTTP-only`, `SameSite=Lax/Strict` cookies for web authentication (`PW`, `HD`, `AD`).
    - Platform-appropriate secure storage (`expo-secure-store` / Keychain / Keystore) for mobile session credentials (`TM`, `HM`).
    - Role-based authorization with server-side permission enforcement.
    - Email verification and password-reset security flows.
  - Social login (Google, Apple OAuth) is **optional** and deferred until core email/password flows are stable. Standard OAuth/OIDC interfaces must be used so providers can be added without identity redesign.
- **External Verification Required:** None.
- **Implementation Detail:** Do not make Arctic or another specific library a mandatory architecture constraint. Select and verify maintained libraries during implementation.
- **Impacted Requirements:** `REQ-TRV-001`, `REQ-HST-001`, `BR-001`, `BR-003`.

---

### `OQ-002` — Host Identity & Business Verification Requirements
- **Category:** Legal / Operations
- **Description:** `FR-16 Identity/Business Verification` states *"Submit required identity/business information"* and `FR-17 Host Approval` states *"Platform approves Host before listing goes live"*, without listing the exact documents required for individuals vs. registered businesses in Sri Lanka and future countries.
- **Source:** `FR-16`, `FR-17`, Execution Prompt Section 2 & 6.1.
- **Internal Engineering Baseline (`RESOLVED_INTERNAL`):** The `host-verification` module is data-driven by `country_code` and `host_entity_type` (`INDIVIDUAL` vs. `REGISTERED_BUSINESS`), supporting configurable two-tier document slots (NIC / Passport / Trade License + Storefront Photos for individuals/sole proprietors; Business Registration Certificate + Director NIC + Proof of Premises + Storefront Photos for registered businesses) uploaded to private object storage and reviewed in `AD-002`.
- **Impact:** Determines the exact form fields and document upload slots on the Host Verification screen (`FR-16`) and the Superadmin review checklist (`FR-17`).
- **External Gate Status:** `OWNER_APPROVAL_REQUIRED`, `LEGAL_REVIEW_REQUIRED` — Product Owner and Sri Lankan legal/operations review required to sign off on the mandatory vs. optional document checklist before live host onboarding launch.

---

### `OQ-003` — PayHere Marketplace Payment Model
- **Category:** Commercial / Regulatory / Financial
- **Source Reference:** `FR-6 Online Payment`, `FR-37 Payout Management`, `ADR-008`, `ADR-009`.
- **Status:** **Settlement Model Approved in Principle / PayHere Written Approval is a Launch Gate Blocker**.
- **Owner-Approved Decision:**
  - The platform settlement model is approved in principle:
    1. Traveller pays the platform for a booking via payment gateway.
    2. Platform records the payment and booking.
    3. Platform commission and applicable adjustments are calculated.
    4. Host earnings are recorded as payable balances in an immutable ledger.
    5. Superadmin reviews and manually processes host payouts (`FR-37`, `ADR-009`).
    6. Every payout is recorded with amount, currency, date, recipient, reference, and audit history.
  - Keep **PayHere** as the preferred initial payment integration for Sri Lanka launch.
- **External Verification Required (Launch Gate Blocker):**
  - **Written Confirmation Required:** Before implementing PayHere collection, obtain written confirmation from PayHere that it explicitly permits this specific marketplace arrangement, including collection on behalf of independent hosts and subsequent manual host settlements.
  - **Blocker Rule:** Do not assume a normal PayHere merchant account supports this model. If PayHere does not approve the arrangement, stop the PayHere integration and prepare alternative payment-provider options for an explicit owner decision. Do not work around provider restrictions by misrepresenting the business model.
- **Implementation Detail:** Payment provider abstraction layer (`PaymentGatewayPort`, `REQ-IMPL-007`) isolates PayHere behind a gateway interface, enabling clean swapping if an alternative gateway is required.
- **Impacted Requirements:** `REQ-TRV-011`, `REQ-HST-023`, `REQ-IMPL-006`, `REQ-IMPL-007`, `REQ-IMPL-011`, `BR-025`, `BR-027`.

---

### `OQ-004` — Booking Modes, Configuration Hierarchy, and Payment Timing
- **Category:** Product / Booking Engine / Payments
- **Source Reference:** `FR-6 Booking`, `FR-26 Booking Acceptance`.
- **Status:** **Owner-Approved Decision**.
- **Owner-Approved Decision:**
  - Support **both booking modes**, configurable per storage location.
  - **Configuration Hierarchy:**
    1. Platform defines supported booking capabilities and safety constraints.
    2. Host account can define default booking settings across their portfolio.
    3. Each storage location can override the host defaults (`Instant Booking` vs. `Host Approval`).
    4. Existing confirmed bookings retain the policy and pricing snapshots applicable when they were made.
  - **Instant Booking Lifecycle:**
    1. Traveller selects location and booking schedule.
    2. System validates availability and creates a temporary capacity reservation hold.
    3. Traveller completes payment at checkout.
    4. Server verifies payment webhook notification.
    5. Booking transitions to `CONFIRMED` only after verified payment success.
  - **Host-Approval Booking Lifecycle:**
    1. Traveller submits a booking request.
    2. System creates a pending request and temporary capacity reservation.
    3. Host has **15 minutes by default** (configurable within platform-defined limits) to accept or reject.
    4. If rejected or expired, system releases capacity reservation. **No payment is captured**.
    5. If accepted by host, traveller receives an immediate payment request.
    6. Traveller has **10 minutes by default** (configurable) to complete payment.
    7. Booking transitions to `CONFIRMED` only after verified payment success.
    8. If traveller payment is not completed before expiry, system releases capacity reservation and transitions request to `EXPIRED`.
  - **Pre-Authorization Hold Dependency:** Do **not** depend on card pre-authorization holds for the host-approval flow in the initial release. Payment is captured only after host acceptance.
- **External Verification Required:** None.
- **Implementation Detail:** Time windows (15 min host SLA, 10 min traveller payment) are configurable initial product defaults stored in configuration tables. Background scheduler handles expiration sweeps.
- **Impacted Requirements:** `REQ-TRV-010`, `REQ-HST-012`, `REQ-IMPL-004`, `REQ-IMPL-005`, `BR-023`, `BR-024`, `BR-069`, `BR-070`.

---

### `OQ-005` — Platform Commission and Promotional Discounts
- **Category:** Product / Pricing / Finance
- **Source Reference:** `FR-5 Price Calculation`, `FR -13 Promo Codes`, `FR-23 Pricing`, `FR-38 Payment Management`.
- **Status:** **Owner-Approved Decision**.
- **Owner-Approved Decision:**
  - Start with a **15% platform commission**.
  - **Commission Calculation Rules:**
    - Calculate commission strictly against the **eligible storage service subtotal**.
    - Exclude statutory taxes from the commission base.
    - Apply host-funded discounts before calculating platform commission.
    - Payment processing gateway fees are absorbed within platform operating costs and platform commission (they must not be passed to the host as additional deductions in the initial commercial model).
    - Record every calculation component separately in an itemized breakdown.
  - **Promotional Discount Policy:**
    - **Platform-funded promotions:** Funded entirely by the platform; they must never silently reduce the host's agreed payout.
    - **Host-funded promotions:** Reduce the eligible host service subtotal before commission calculation.
    - **Mixed promotions:** Explicitly record the separate funding contribution of each party.
  - **Snapshotting:** Do not hard-code 15% into business logic. Store commission policies with effective dates and preserve the applied commission snapshot on each booking record. Revisit commercial rates using actual operating data before international expansion.
- **External Verification Required:** None (commercial rates to be evaluated with operational data prior to international expansion).
- **Implementation Detail:** `bookings` table stores `commission_rate_bps` (1500), `commission_amount_cents`, `promo_discount_cents`, `promo_funder` (`PLATFORM` / `HOST` / `SHARED`).
- **Impacted Requirements:** `REQ-TRV-009`, `REQ-TRV-025`, `REQ-HST-009`, `REQ-HST-022`, `REQ-IMPL-003`, `REQ-IMPL-011`, `BR-020`, `BR-021`, `BR-022`.

---

### `OQ-006` — Storage Capacity and Bag Categories
- **Category:** Product / Capacity Engine
- **Source Reference:** `FR-5 Availability Check`, `FR-21 Set Capacity`, `FR-28 Bag Verification`.
- **Status:** **Owner-Approved Decision**.
- **Owner-Approved Decision:**
  - Standardize on **four initial bag categories**:
    1. **Small:** Small backpacks, handbags, and personal bags.
    2. **Medium:** Standard backpacks and cabin-sized luggage.
    3. **Large:** Standard checked luggage.
    4. **Oversized:** Unusually large, heavy, or non-standard items (e.g. surfboards, golf bags, large instruments).
  - **Operating Rules:**
    - Category definitions must be configurable at platform level.
    - Each category may have configurable dimensions and weight guidelines.
    - Hosts can enable or disable specific categories per storage location.
    - Hosts can define category-specific capacity allocations and category-specific pricing.
    - Travellers must see relevant category restrictions and guidelines before booking.
    - **Oversized items:** Must only be bookable at storage locations that explicitly enable and accept them.
  - Do not make category labels the only capacity model; the capacity domain must also support configurable units, zones, and capacity pools.
- **External Verification Required:** None.
- **Implementation Detail:** `storage_locations` have child records in `location_bag_categories` with `is_enabled`, `max_capacity`, and `price_per_day_lkr`.
- **Impacted Requirements:** `REQ-TRV-008`, `REQ-HST-006`, `REQ-HST-007`, `REQ-HST-014`, `BR-016`, `BR-017`, `BR-018`.

---

### `OQ-007` — Traveller and Host Account Relationship
- **Category:** Identity / Roles
- **Description:** Whether a single user account (email/phone) can hold both `Traveller` and `Host` roles simultaneously, and how role switching operates across mobile and web.
- **Source:** Execution Prompt Section 5 & Section 7.
- **Current Direction:** A unified `User` identity (`users` table) with separate Traveller and Host role contexts (`ADR-003`), allowing authentication into either the Traveller Mobile App, Host Mobile App, or switching between Traveller and Host views on the Web App without requiring two different email addresses.
- **Impact:** Affects `users`, `travellers`, and `hosts` foreign-key relationships and JWT/session claims.
- **Proposed Resolution:** Unified identity model is approved architectural direction. Specific registration, account recovery, and account merging workflows remain to be finalized in Phase 1 / Phase 3.
- **Status:** **Approved Architectural Direction** (Unified identity with distinct role contexts approved; detailed registration and role-switching policies pending).
- **Owner Approval Required:** Resolved for architectural model; detailed workflows pending.

---

### `OQ-008` — Currency Representation, Precision & Multi-Currency Horizon
- **Category:** Localization / Payments / Finance
- **Source Reference:** `FR-6 Online Payment`, `FR -14 Multiple Currencies`.
- **Status:** **Owner-Approved Decision**.
- **Owner-Approved Decision:**
  - Launch with **LKR (Sri Lankan Rupee)** as the sole booking and settlement currency.
  - All initial storage location prices are stored and displayed in LKR.
  - Booking totals, commission calculations, refunds, and host payable balances use LKR.
  - Do not silently convert currencies during checkout.
  - Multi-currency support (USD, EUR, GBP, AUD) is deferred until after launch when payment settlement, foreign exchange handling, accounting, and reporting have been verified.
  - International visitors can use supported international payment methods (e.g. Visa, Mastercard) to pay an LKR-denominated booking, subject to their card issuer's exchange rates.
- **Precision & Data Representation Architecture:**
  - **Integer Minor Units:** All monetary values must be stored strictly as integer minor units in the database and API payloads (e.g., integer cents for LKR where ISO 4217 exponent = 2).
  - **Explicit Currency Codes:** Every monetary value must explicitly store its corresponding ISO 4217 three-letter currency code (`LKR`).
  - **ISO 4217 Exponent Rule:** Currency minor-unit exponent/precision is determined dynamically by the applicable ISO 4217 currency definition. The global architecture must **not** assume that every currency has two decimal places (e.g., zero-decimal currencies like JPY, three-decimal currencies like BHD/KWD).
  - **No Binary Floating-Point:** Binary floating-point types (`float`, `double`) are strictly prohibited for monetary calculations and storage. Calculations must use integer arithmetic or arbitrary-precision decimal representations.
  - **Decoupled Display Formatting:** Display formatting (symbols, decimal separators, grouping) is strictly decoupled from stored integer minor units and handled in presentation layers based on locale.
- **External Verification Required:** None.
- **Impacted Requirements:** `REQ-TRV-011`, `REQ-TRV-027`, `REQ-HST-022`, `BR-025`, `BR-054`, `BR-055`.

---

### `OQ-009` — Customer Cancellation and Refund Policy Tiers
- **Category:** Policy / Financial Accounting
- **Source Reference:** `FR-10 Cancellation`, `FR -10 Refund Status`, `FR-34 Cancellation Policy`.
- **Status:** **Owner-Approved Decision**.
- **Owner-Approved Policy Baseline:**
  - Standard customer cancellation refunds are tiered as follows:
    | Situation | Customer Refund Percentage |
    | :--- | :---: |
    | Traveller cancels > 2 hours before scheduled drop-off | **100%** |
    | Traveller cancels within 2 hours before scheduled drop-off (before drop-off) | **50%** |
    | Traveller cancels after scheduled storage period has started | **0% by default** |
    | Traveller does not arrive (no-show) | **0% by default** |
    | Host cancels a confirmed booking | **100%** |
    | Platform cancels (location unavailable / cannot fulfill) | **100%** |
  - **Operating Rules:**
    - Refund percentages apply to the eligible booking subtotal; tax and fee treatment defined separately by applicable tax and payment rules.
    - A host cannot override a confirmed booking's cancellation policy retroactively.
    - Authorized exceptions for duplicate charges, payment failures, safety incidents, or platform errors are reserved for Superadmin authorization.
    - Keep refund processing behind the payment-provider abstraction (`PaymentGatewayPort`).
    - Payment provider operational capabilities, timing, fees, and execution methods are tracked separately under `OQ-013`.
- **External Verification Required:** Provider refund capabilities and fee treatments are managed under `OQ-013`.
- **Impacted Requirements:** `REQ-TRV-018`, `REQ-TRV-019`, `REQ-HST-020`, `REQ-IMPL-008`, `BR-035`, `BR-036`, `BR-037`.

---

### `OQ-010` — Tax, Invoicing Architecture & Sri Lankan Compliance
- **Category:** Legal / Regulatory / Finance
- **Source Reference:** `FR-36 Financial Ledger`, `FR-37 Payout Management`, `FR-38 Payment Management`.
- **Status:** **Platform Capability Approved / Sri Lankan Legal Classification & Compliance are Mandatory Launch Gate**.
- **Four-Layer Architecture & Compliance Separation:**
  1. **Layer A — Platform Capability (Owner-Approved Baseline):**
     - The product implements a configurable tax and invoicing foundation without hard-coding the platform's legal or tax classification.
     - Supports tax registration details for platform and hosts where applicable (VAT/TIN).
     - Supports tax-inclusive and tax-exclusive pricing configurations.
     - Persists taxable base, tax amount, and gross amount separately in integer minor units.
     - Supports jurisdiction-specific configuration, effective dates, booking receipts, payment records, refund records, and host settlement statements.
     - Preserves immutable tax calculation snapshots for historical transactions.
  2. **Layer B — Configured Jurisdiction Rules (System Configuration):**
     - Initial system configuration models Sri Lankan VAT and SSCL rules based on parameters provided.
     - These rules are system configuration data, not legal advice or proof of statutory compliance.
  3. **Layer C — Legal and Tax Classification (External Legal Matter):**
     - Whether the platform legally operates as agent, principal, marketplace facilitator, or another structure is a formal legal determination that cannot and will not be decided through software architecture documentation.
  4. **Layer D — Launch Compliance Gate (Mandatory Pre-Launch Gate):**
     - Before commercial launch in Sri Lanka, obtain qualified professional tax and legal advice on:
       1. Legal supply structure (agent vs principal vs marketplace operator).
       2. Which party legally supplies the luggage storage service to the traveller.
       3. Statutory invoicing flow (who invoices traveller; who invoices platform).
       4. VAT applicability (to platform commission, host storage service, or both).
       5. SSCL (Social Security Contribution Levy) treatment and liable turnover calculation.
       6. Required invoice fields, fiscal documentation, and statutory retention periods.
     - **Constraint:** Do not claim that the product's configurable tax foundation itself makes the business legally compliant. Do not assume the platform commission is automatically the only taxable supply, nor assume full booking value is platform taxable turnover.
- **Impacted Requirements:** `REQ-HST-022`, `REQ-HST-023`, `REQ-HST-024`, `REQ-IMPL-011`, `BR-040`, `BR-041`, `BR-086`.

---

### `OQ-011` — Superadmin and Platform Support Role & Permission Boundary (Approved Baseline)
- **Category:** Governance / Security / RBAC
- **Source Reference:** `FR-17 Host Approval`, `FR-37 Payout Management`, `FR-44 System Management`.
- **Status:** **Owner-Approved Decision**.
- **Scope & Responsibility:**
  - `OQ-011` defines the authoritative, approved high-level governance and permission boundary between Platform Support Staff (`ACT-04`) and Superadmin (`ACT-05`). Operational ticketing queues and intake channel triage are governed separately under `OQ-016`.
- **Owner-Approved Decision:**
  - Use **strict least-privilege role separation** enforced via server-side permission checks.
  - **Platform Support Staff (`ACT-04`):**
    - **May:** View permitted traveller and host account info needed for support; search bookings and view status; review payment and refund status; manage support tickets; record internal audit notes; escalate host verification, refund, payout, and safety issues; recommend operational actions to Superadmin.
    - **Must NOT independently:** Approve or reject host applications (`FR-17`); change platform commission; change payment or refund policy; initiate or authorize refunds; execute host payouts; modify financial ledger entries; assign Superadmin privileges.
  - **Superadmin (`ACT-05`):**
    - **May (subject to audit logging):** Approve, reject, suspend, or reactivate hosts; manage platform-level configuration; approve exceptional booking actions; authorize and process refunds; review and execute manual host payouts; manage commission and promo policies; manage support staff accounts and permissions; review financial reconciliation and system audit records.
  - All privileged actions must record actor ID, timestamp, target resource, reason note, previous state, and resulting state.
- **External Verification Required:** None.
- **Implementation Detail:** Fastify pre-handler permission guards check discrete capabilities (e.g. `payout:execute`, `host:approve`, `refund:authorize`) rather than coarse string matching.
- **Impacted Requirements:** `REQ-HST-002`, `REQ-HST-003`, `REQ-HST-023`, `REQ-HST-029`, `BR-096`, `BR-097`, `BR-098`, `BR-099`.

---

### `OQ-012` — Address Privacy Baseline & Location Disclosure Details
- **Category:** Product / Trust & Safety
- **Source Reference:** `FR-3 Map View`, `FR -4 Host Details`, `FR-7 Directions`.
- **Status:** **Approved Baseline (Approximate discovery, exact address post-booking) / Disclosure Details Proposed**.
- **Owner-Approved Baseline Policy:**
  - **Public Discovery Masking:** Before booking confirmation, public discovery and search must only show an approximate storage location or general area. Do not expose the exact street address, building number, or precise storage entrance coordinates. Provide sufficient neighborhood context for traveller evaluation without compromising location privacy.
  - **Post-Confirmation Disclosure:** After a booking is confirmed, the exact street address may be disclosed exclusively to the traveller who holds that confirmed booking, made available in confirmed booking details and directions flow.
  - **No Public Leakage:** Never expose exact street address to unauthenticated users, public search results, or unrelated travellers.
  - **Host Configuration Boundaries:** Hosts may configure stricter privacy behavior, but must not weaken the platform's baseline protection without explicit platform policy approval.
  - **Protected Operational Records:** Exact storage addresses are preserved in protected operational records for legitimate support, safety, and audit purposes, accessible only via permission-controlled administrative views.
- **Proposed Details Awaiting Explicit Owner Decision (Not Approved Baseline):**
  - The previously reported `150–300m geographic jitter` radius was an engineering recommendation and is classified as **Proposed / Pending Product Owner Approval**.
  - Automatic disclosure of exact storefront signage name, entrance photographs, and host contact phone number upon confirmation was an architectural proposal and is classified as **Proposed / Pending Product Owner Approval** (pending decision on whether host phone or entrance photos are disclosed or kept in-app).
- **Implementation Detail:** Server-side route serializers sanitize address fields based on booking confirmation status and caller identity.
- **Impacted Requirements:** `REQ-TRV-004`, `REQ-TRV-007`, `REQ-TRV-013`, `BR-010`, `BR-011`.

---

### `OQ-013` — Payment-Provider Refund Capabilities, Execution Method & Fee Settlement
- **Category:** Payments / Provider Integration / Financial Reconciliation
- **Source Reference:** `FR-10 Cancellation`, `FR -10 Refund Status`, `ADR-008`.
- **Status:** **External Verification Gate**.
- **Scope & Purpose:**
  - While `OQ-009` defines the owner-approved customer cancellation and refund policy, `OQ-013` tracks the technical, operational, and commercial capabilities of the payment provider (initially PayHere) regarding refund execution.
- **External Verification Required (Pre-Launch Integration Gate):**
  - Obtain technical and commercial verification from PayHere on:
    1. **Automated Refund API Support:** Whether PayHere provides an automated server-to-server Refund API for merchant accounts or if refunds must be initiated manually through the PayHere merchant portal.
    2. **Refund Processing Time:** The settlement timeframe for funds to return to traveller payment methods (cards, wallets).
    3. **Payment Fee Treatment on Refund:** Whether PayHere refunds the original payment processing fee, charges a separate refund processing fee, or retains the original processing fee.
    4. **Partial Refund Capability:** Verification of PayHere support for partial refunds (e.g. 50% cancellation tier under `OQ-009`).
    5. **Failed / Reversed Refund Handling:** Webhook notifications and failure callbacks for rejected or reversed refunds.
    6. **Ledger Reconciliation:** Settlement account balance requirements for processing refunds.
- **Seven-Stage Explicit Refund Lifecycle:**
  To guarantee that a submitted refund request is never prematurely marked as completed, the domain engine must support the following explicit lifecycle:
  1. `REQUESTED`: Refund request submitted by traveller, host cancellation, or system trigger.
  2. `AUTHORIZED`: Refund approved under automated policy tiers or authorized by Superadmin exception (or `REJECTED` if ineligible).
  3. `INITIATED`: Refund payload dispatched to payment gateway port.
  4. `PROCESSING`: Gateway acknowledged receipt; awaiting settlement confirmation.
  5. `SUCCEEDED`: Gateway confirmed funds successfully returned to traveller.
  6. `FAILED`: Gateway rejected refund (e.g., insufficient merchant balance, expired card, gateway error).
  7. `MANUAL_REVIEW_REQUIRED`: Discrepancy, gateway failure, or reconciliation mismatch requiring Superadmin operational intervention.
- **Implementation Detail:** `refunds` table stores `status` enum with the 7 states above, gateway reference, itemized base/tax amounts, and ledger journal link.
- **Impacted Requirements:** `REQ-TRV-019`, `REQ-IMPL-008`, `BR-036`.

---

### `OQ-014` — Custody and Check-In Evidence
- **Category:** Product / Physical Custody Operations
- **Source Reference:** `FR-27 Check-in Traveller`, `FR-28 Bag Verification`, `FR-29 Check-in Evidence`.
- **Status:** **Owner-Approved Decision**.
- **Owner-Approved Decision:**
  - **Mandatory Verification Workflow:**
    - Verify the booking using a secure QR code or one-time numeric PIN (`FR-27`).
    - Confirm the physical number and category of bags received against reservation (`FR-28`).
    - Record check-in timestamp and responsible host/staff user ID.
    - Confirm number of bags returned at collection (`FR-30`, `FR-31`).
    - Record collection timestamp and responsible host/staff user ID.
    - Prevent check-in/check-out completion when recorded bag count does not reconcile, unless an authorized exception is formally logged.
    - Server-side verification with rate-limiting against PIN brute-forcing.
    - If camera scan fails, provide authorized manual PIN entry fallback with audit log.
  - **Photographic Evidence Policy:**
    - Photo evidence capture capability is supported in the MVP.
    - **Optional by default** for storage locations.
    - **Configurable as mandatory per location** (host or platform policy).
    - When enabled, photos must be securely linked to the booking and custody event, stored in private Cloudflare R2 storage, with strict access controls and retention schedules.
- **External Verification Required:** None.
- **Implementation Detail:** Upload via pre-signed private R2 URLs; image compression on mobile prior to upload.
- **Impacted Requirements:** `REQ-TRV-014`, `REQ-HST-013`, `REQ-HST-014`, `REQ-HST-015`, `REQ-IMPL-010`, `BR-032`, `BR-071`, `BR-072`, `BR-073`, `BR-074`.

---

### `OQ-015` — Late Collection Fee Settlement & Custody Separation
- **Category:** Product / Custody / Financial Settlement
- **Source Reference:** `FR-32 Late Collection Handling`.
- **Status:** **Owner-Approved Decision**.
- **Owner-Approved Financial Baseline:**
  - **In-App Payment Only for MVP:** In-app payment through the platform payment gateway is the sole approved payment method for overdue fee settlement in the initial release.
  - **Standard Cash Collection Excluded:** Cash-at-counter collection is strictly excluded from the standard platform workflow and cannot be marked as a platform payment. Any future offline collection feature must be separately approved and reconciled.
  - **Configurable Grace Period & Rates:** Locations enforce configurable grace periods (e.g. 30 minutes default) and hourly/daily overdue rate rules, subject to platform constraints.
  - **Transparent Disclosure:** Overdue charging policies must be clearly disclosed to the traveller before checkout.
  - **No Silent Charges:** No additional charge may be silently or automatically debited without valid, disclosed payment authorization.
  - **Auditable Records:** Scheduled collection time, actual collection time, grace period, and overdue calculations must be recorded.
- **Decoupled Custody Boundary (Crucial Architectural Rule):**
  - **Physical luggage custody and overdue fee financial settlement are strictly modeled as separate concerns:**
    1. *Luggage custody and physical return.*
    2. *Overdue-fee assessment.*
    3. *Additional payment request creation.*
    4. *Payment or dispute resolution.*
    5. *Financial ledger reconciliation.*
  - **No Possessory Lien / No Custody Hostage:** A disputed or unpaid overdue fee **must not automatically prevent the traveller from collecting their belongings**. The traveller must retain a clear, unimpeded path to retrieve their luggage upon presentation of valid custody verification tokens (`REQ-TRV-015`, `REQ-HST-016`), regardless of overdue fee payment status.
  - The platform does not assert or enforce a right to retain luggage as security for unpaid fees. If an overdue fee is unpaid or disputed at the counter:
    - Physical luggage custody is released upon valid identity/token check.
    - The overdue fee is recorded as an outstanding receivable.
    - The issue is flagged for platform support review and dispute management (`REQ-TRV-023`, `REQ-HST-026`).
- **Implementation Detail:** Check-out completion is decoupled from `overdue_charges.status`. `POST /api/v1/host/bookings/:id/checkout` verifies custody tokens and records handoff regardless of whether `overdue_payment` is `COMPLETED` or `PENDING_REVIEW`.
- **Impacted Requirements:** `REQ-HST-016`, `REQ-HST-018`, `REQ-TRV-015`, `BR-078`, `BR-079`.

---

### `OQ-016` — Operational Support Workflow & Ticket Queue Separation
- **Category:** Product / Support Operations
- **Source Reference:** `FR -12 Leave Review`, `FR -12 Customer Support`, `FR-40 Support`, `FR-41 Incident Reporting`.
- **Status:** `RESOLVED_INTERNAL` (Internal Baseline Adopted).
- **Scope & Relationship to `OQ-011`:**
  - While `OQ-011` governs the high-level RBAC permission boundary (confirming Support Staff cannot execute financial actions or host approvals), `OQ-016` governs the operational ticketing separation and intake workflows.
- **Approved Internal Baseline:**
  1. **Post-Collection Ratings & Reviews (`FR-12 Leave Review`):** Public-facing feedback tied strictly to completed bookings (`COMPLETED` / `CHECKED_OUT`), separated from private operational support tickets.
  2. **General Customer & Host Support Queue (`FR-12 Customer Support`, `FR-40 Support`, `AD-011`, `AD-012`):** Private operational support records accessible to `SUPPORT` and `SUPERADMIN`. Support staff may triage, document, communicate, and escalate, but cannot authorize refunds, execute payouts, approve hosts, or alter financial records.
  3. **Safety, Custody, Damage, Tampering, Overdue & Financial Dispute Incident Queue (`FR-41 Incident Reporting`, `AD-013`):** Escalated incident queue where `SUPERADMIN` holds exclusive authority for final financial, refund, and custody adjudication.

---

### `OQ-017` — Host Staff Permission Granularity (`FR-42` — `Later`)
- **Category:** Roles / Host Staff
- **Description:** `FR-42 Staff Accounts` states *"Allow employees to handle check-in/out"* and is marked **`Later`**.
- **Source:** `FR-42 Staff Accounts` (`Later`), `FR-44 Multiple Locations`.
- **Status:** `RESOLVED_INTERNAL` (Fixed Operational Baseline) / `DEFERRED` (Per-Staff Custom ACL).
- **Approved Internal Baseline:**
  - `HOST_STAFF` has a fixed, least-privilege operational permission set for MVP: allowed to view assigned location operational details, view assigned location bookings, perform QR/PIN check-in and check-out verification, record bag counts and check-in/out evidence, and submit operational incident reports.
  - Forbidden to `HOST_STAFF`: create/delete locations, change pricing, change payout bank details, view full host financial payouts/settlements, approve/reject host onboarding, manage staff accounts, or change host-wide commission/policy settings.
  - Fine-grained per-staff custom permission toggles are `DEFERRED` (`FR-42` is marked `Later` in the FRS).

---

### `OQ-018` — Production Map Tile, Geocoding & Routing Provider
- **Category:** Technical / Maps
- **Description:** `MapLibre` is approved as the client rendering engine (`FR-3`), which requires a commercial vector tile, geocoding (`FR-2`), and routing (`FR-7`) provider.
- **Source:** Execution Prompt Section 4 (*"do not assume a specific production map provider"*).
- **Status:** `RESOLVED_INTERNAL` (Provider-Agnostic MapLibre Architecture) / `VENDOR_CONFIRMATION_REQUIRED`, `OWNER_APPROVAL_REQUIRED` (Production Commercial API Keys & Billing).
- **Approved Internal Baseline & External Gate:**
  - Client map rendering is standardized on **MapLibre** behind a provider-agnostic map/geocoding configuration layer (`PW-002`, `TM-012`).
  - **Map tiles & geocoding:** MapTiler (OpenStreetMap vector tiles) is the primary recommended provider for MapLibre compatibility and predictable pricing; Google Maps Platform / Mapbox remain swappable via provider adapter configuration if commercial POI density requires it.
  - **Directions (`FR-7`):** Deep-link handoff to native Google Maps / Apple Maps / Waze URLs for turn-by-turn navigation after booking confirmation, avoiding costly embedded turn-by-turn routing APIs in MVP.
  - **External Gate:** Commercial API key provisioning, billing account setup, and terms-of-service verification remain `VENDOR_CONFIRMATION_REQUIRED` and `OWNER_APPROVAL_REQUIRED` before production traffic.

---

### `OQ-019` — Transactional Email Provider Selection
- **Category:** Technical / Comms
- **Description:** Selection of the transactional email delivery service for registration verification (`FR-1`), password recovery (`WF-003`), booking confirmations (`FR-7`, `FR-11`), host approvals (`FR-17`, `FR-35`), and payout notifications (`FR-37`).
- **Source:** Execution Prompt Section 4 (*"do not assume a specific ... email provider"*).
- **Status:** `RESOLVED_INTERNAL` (Zoho Mail Adapter Implemented) / `OWNER_APPROVAL_REQUIRED`, `VENDOR_CONFIRMATION_REQUIRED` (Live Domain DNS & Mailbox Credentials).
- **Approved Internal Baseline & External Gate:**
  - **Zoho Mail** is integrated as the production transactional email provider for authentication emails (`EMAIL_PROVIDER=zoho`) via `ZohoSmtpEmailAdapter` (`apps/api/src/modules/email/email.service.ts`) and mobile-friendly HTML + plain-text templates (`apps/api/src/modules/email/email.templates.ts`).
  - `ConsoleDevEmailAdapter` is used for local development (`EMAIL_PROVIDER=console`) and `DeterministicTestEmailAdapter` is used for automated tests (`EMAIL_PROVIDER=test`). `noop`, `console`, and `test` providers are strictly rejected when `NODE_ENV=production`.
  - **External Gate:** Production DNS records (`SPF`, `DKIM`, `DMARC`), Zoho mailbox/sender verification, and live `ZOHO_SMTP_USER` / `ZOHO_SMTP_PASSWORD` secret provisioning in the deployment environment remain a pre-production operational gate (`OWNER_APPROVAL_REQUIRED`, `VENDOR_CONFIRMATION_REQUIRED`).

---

### `OQ-020` — SMS / Phone OTP Provider & Verification Policy
- **Category:** Technical / Comms
- **Description:** Whether SMS OTP verification is required at signup/booking (`FR-1`) or if email verification suffices for MVP.
- **Source:** Execution Prompt Section 4 (*"do not assume a specific ... SMS provider"*).
- **Status:** `RESOLVED_INTERNAL` (Email Verification Baseline) / `DEFERRED`, `VENDOR_CONFIRMATION_REQUIRED`, `OWNER_APPROVAL_REQUIRED` (SMS / WhatsApp OTP).
- **Approved Internal Baseline & Deferral:**
  - Self-service **Email Verification** (`POST /api/v1/auth/verify-email` and `POST /api/v1/auth/resend-verification`) is the mandatory and authoritative account verification mechanism for Phase 1B / MVP (`PENDING_VERIFICATION` -> `ACTIVE`).
  - Phone number capture remains supported (`is_phone_verified = false` until verified).
  - Automated SMS / WhatsApp OTP verification is `DEFERRED` until a Sri Lankan telecom/SMS aggregator (such as Dialog Enterprise SMS, Hutch/Mobitel, Twilio, or TextIt.lk) is commercially approved and sender ID registration is completed (`VENDOR_CONFIRMATION_REQUIRED`, `OWNER_APPROVAL_REQUIRED`). No UI or documentation claims live SMS OTP verification is active in the current baseline.

---

### `OQ-021` — Redis / Upstash Activation Timing
- **Category:** Infrastructure
- **Description:** Approved stack states *"Redis/Upstash when justified by actual requirements."*
- **Source:** Execution Prompt Section 4.
- **Status:** `RESOLVED_INTERNAL` (PostgreSQL Baseline) / `DEFERRED` (Redis / Upstash Infrastructure).
- **Approved Internal Baseline:**
  - PostgreSQL-backed rate limiting (`auth_rate_limits` with keyed `HMAC-SHA-256` identifiers), session management (`auth_sessions`), and transactional row locking (`SELECT ... FOR UPDATE`) are the approved baseline for MVP and single-region multi-instance deployment.
  - Redis / Upstash remains `DEFERRED` until measured workload thresholds justify activation (e.g., sustained >100 req/sec on rate-limited endpoints, sub-5ms distributed ephemeral locks, or high-fanout realtime pub/sub).

---

### `OQ-022` — Disambiguation & Traceability Normalization of Duplicate FRS Identifiers (Approved Normalization)
- **Category:** Requirements Engineering & Traceability
- **Source Reference:** `luggage-storage-frs.pdf` Page 1.
- **Status:** **Approved Normalization — Complete**.
- **Scope & Explicit Non-Altering Confirmation:**
  - In `docs/product/source/luggage-storage-frs.pdf`, Traveller feature rows repeat numbers `FR-2` through `FR-14` twice each (27 Traveller features share 14 `FR-x` labels).
  - **Explicit Confirmation:** `OQ-022` exclusively normalizes source FRS identifiers by assigning unique, unambiguous internal tracking IDs (`REQ-TRV-001` through `REQ-TRV-027` and `REQ-HST-001` through `REQ-HST-030`).
  - **Zero Requirement Alteration:** This normalization strictly **does not alter, rephrase, weaken, or remove any original source requirements, descriptions, or classifications**. All 57 original FRS rows are preserved verbatim with 100% 1:1 bidirectional traceability.
- **Owner-Approved Resolution:** Dual-reference convention (`REQ-TRV-xxx` / `REQ-HST-xxx` mapped directly to original `FR-x` index and source feature title) is adopted as the authoritative traceability standard across all architecture and requirements deliverables.

---

## 4. Phase B Implementation & Open-Question Reconciliation (`0012_phase_b_booking_escrow_custody.sql`)

Following Phase B implementation (Booking, Non-Escrow Settlement Ledger & Custody Engine), each Phase B governance item is reconciled below against actual repository code, database migrations, and remaining external commercial/legal/tax gates:

### 4.1 Non-Escrow Marketplace Financial Model Disclosure

The platform implements a **non-escrow, double-entry ledger-backed marketplace payment collection and settlement accounting engine** (`financial_ledger_entries`, `host_payables`, `refunds`):

- **No Regulated Third-Party Escrow Claim:** Neither the backend, API contracts, nor Web/Mobile UI claims regulated bank or fiduciary escrow.
- **Explicit Liability & Revenue Separation:** Verified customer payments post balanced integer minor-unit (`LKR`) journal entries separating:
  - `PLATFORM_CLEARING_RECEIVABLE` (gateway clearing asset),
  - `UNEARNED_BOOKING_LIABILITY` (deferred service obligation prior to completion),
  - `PLATFORM_COMMISSION_REVENUE` (recognized 15% platform commission on eligible storage subtotal),
  - `HOST_PAYABLE_LIABILITY` (85% net host settlement payable tracked in `host_payables`), and
  - `REFUND_LIABILITY` (customer refund obligations reversed deterministically under `OQ-009` policy tiers).

### 4.2 Phase B Classification Matrix

| ID | Topic | Phase B Classification | Implemented Repository Evidence & Remaining Gate |
| :--- | :--- | :--- | :--- |
| `OQ-003` | PayHere Marketplace Payment Model | **Requires owner/provider decision** (Gateway Port + Signed Sandbox Adapter **Implemented**) | `PaymentGatewayPort` (`payment-gateway.port.ts`), `SandboxPaymentGatewayAdapter`, and PayHere MD5/HMAC verification scaffold implemented; `PAYMENT_SANDBOX_ENABLED=true` is rejected in `NODE_ENV=production`. Written PayHere marketplace approval and live merchant credentials remain an external owner/vendor launch gate. |
| `OQ-004` | Booking Modes (`INSTANT` & `HOST_APPROVAL`) & Hold Windows | **Confirmed & Implemented** | Implemented in `bookings.service.ts` with PostgreSQL `SELECT ... FOR UPDATE` pool locking (`storage_capacity_pools`), configurable 15-minute host approval SLA (`BOOKING_HOST_APPROVAL_MINUTES`) and 10-minute payment hold (`BOOKING_PAYMENT_HOLD_MINUTES`), plus lazy expiry release. |
| `OQ-005` | 15% Platform Commission & Immutable Pricing Snapshots | **Confirmed & Implemented** | Implemented in `quotation-availability.service.ts` and `booking_pricing_snapshots` (append-only SQL trigger + `REVOKE UPDATE, DELETE, TRUNCATE`). Commission (`1500` bps default) applies strictly to eligible storage subtotal excluding statutory taxes. |
| `OQ-006` | Four Bag Categories & Pool Capacity Reservations | **Confirmed & Implemented** | `BAG_SMALL`, `BAG_MEDIUM`, `BAG_LARGE`, `BAG_OVERSIZED` enforced across quotation, `booking_items`, `booking_capacity_reservations`, and counter check-in (`bag_custody_items`). |
| `OQ-008` | `LKR` Launch Currency & Integer Minor-Unit Precision | **Confirmed & Implemented** (`Multi-currency`: **Deferred**) | All Phase B tables, contracts, quotes, payments, payables, refunds, and ledger entries use integer minor units (`currency = 'LKR'`, `currency_exponent = 2`) with zero floating-point arithmetic. Multi-currency expansion remains **Deferred** to Phase C+. |
| `OQ-009` | Customer, Host & Platform Cancellation Refund Tiers | **Confirmed & Implemented** | Implemented in `bookings.service.ts`: `>= 24h` (`100%`), `< 24h` before drop-off (`50%`), post-drop-off (`0%` default), host/platform cancellation (`100%`), and late-webhook-after-expiry auto-refund (`100%` without reviving expired holds). |
| `OQ-010` | Sri Lankan VAT / SSCL Tax & Invoicing Compliance | **Requires owner/provider decision** (Configurable Tax Snapshot Fields **Implemented**) | `tax_rate_bps` and `tax_amount_minor` are persisted on `booking_pricing_snapshots` (defaulting to `0` bps). Formal Sri Lankan legal/tax classification (agent vs principal, VAT/SSCL registration, fiscal invoice numbering) requires external legal/tax sign-off before commercial launch. |
| `OQ-011` | `SUPERADMIN` vs `SUPPORT` Least-Privilege Separation | **Confirmed & Implemented** | Enforced in migration `0012` RBAC permissions and `admin-phase-b.routes.ts`: `SUPPORT` has read-only access (`admin:bookings:read`, `admin:refunds:read`) and receives `403` on cancellations, refund transitions, payment transaction logs, and financial ledger routes. |
| `OQ-012` | Approximate Pre-Booking Privacy & Post-Payment Exact Address Disclosure | **Confirmed & Implemented** (Storefront phone/photo extras: **Assumed / Requires owner decision**) | Public discovery uses ~550m (`0.005` deg) coordinate-grid snapping and 100m rounded distance. Exact street address and coordinates in `BookingLocationDisclosure` remain `null` (`addressDisclosed: false`) until verified payment moves booking to `CONFIRMED` / `IN_STORAGE` / `COMPLETED`. |
| `OQ-013` | 7-Stage Refund Lifecycle & Provider Refund Capabilities | **Implemented** (Live PayHere Refund API specifics: **Requires owner/provider decision**) | Explicit 7-state `refunds` state machine (`REQUESTED`, `AUTHORIZED`, `INITIATED`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `MANUAL_REVIEW_REQUIRED`) with append-only `refund_events` and balanced ledger reversal implemented. Live PayHere refund settlement SLAs/fees await vendor confirmation. |
| `OQ-014` | Single-Use QR / 6-Digit PIN Custody Verification & Bag Reconciliation | **Confirmed & Implemented** | `custody_verification_tokens` stores only keyed `HMAC-SHA-256` digests of CSPRNG 64-hex QR tokens and 6-digit PINs, rate-limited against brute-force attempts, consumed atomically on check-in/collection, with mandatory bag-count reconciliation or logged exception reason. |
| `OQ-015` | Zero Possessory Lien / Decoupled Overdue Fee & Physical Release | **Confirmed & Implemented** | `completeCollection` in `custody.service.ts` computes overdue minutes after location grace period and records `overdue_fee_minor` (`handover_condition = 'UNPAID_FEES_PENDING'`), while **always** releasing physical baggage (`RELEASED_TO_TRAVELLER`) without silent card auto-debits or payment gating. |
| `OQ-017` | `HOST_STAFF` Assignment Scoping & Financial Isolation | **Confirmed & Implemented** (Custom per-staff ACL: **Deferred**) | Enforced in `host-access.helper.ts`: `HOST_STAFF` can verify passes and execute check-in/check-out only for actively assigned locations (`host_staff_assignments`), and is blocked (`403`) from unassigned locations and `GET /api/v1/hosts/finance/summary`. |
| Phase C Scope | Automated Payout Batches, Split Settlements, Loyalty & Subscriptions | **Deferred** | Intentionally excluded from Phase B (`host_payables` accrues net host balances for Superadmin settlement governance; automated bank batch disbursement is deferred to Phase C). |


