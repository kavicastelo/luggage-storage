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

| ID | Category | Title / Topic | FRS Ref | Priority | Status | Owner Approval / Gate Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `OQ-001` | Technical / Security | Authentication Strategy | `FR-1`, `FR-15` | **Critical** | **Owner-Approved Decision** (Fastify self-managed auth, Postgres, Argon2id) | **Approved** |
| `OQ-002` | Legal / Operations | Host Identity & Business Verification Requirements | `FR-16`, `FR-17` | **High** | **Pending Decision** (Mandatory document checklist pending) | **Yes** |
| `OQ-003` | Commercial / Regulatory | PayHere Marketplace Payment Model | `FR-6`, `FR-37` | **Critical** | **Settlement Model Approved in Principle / PayHere Written Approval is Launch Gate Blocker** | **External Verification Gate** |
| `OQ-004` | Product / Booking | Booking Modes, Configuration Hierarchy & Payment Timing | `FR-6`, `FR-26` | **High** | **Owner-Approved Decision** (Both modes configurable per location, 15m host SLA default, 10m traveller pay default, payment after acceptance) | **Approved** |
| `OQ-005` | Product / Pricing | Platform Commission & Promotional Discounts | `FR-5`, `FR-23`, `FR-38` | **High** | **Owner-Approved Decision** (15% initial commission on storage subtotal, gateway fees absorbed by platform, promo funding rules) | **Approved** |
| `OQ-006` | Product / Capacity | Storage Capacity & Bag Categories | `FR-5`, `FR-21`, `FR-28` | **High** | **Owner-Approved Decision** (4 categories: Small, Medium, Large, Oversized; configurable limits & location opt-in) | **Approved** |
| `OQ-007` | Identity / Roles | Traveller and Host Account Relationship | `FR-1`, `FR-15` | **High** | **Owner-Approved Decision** (Unified Identity / Role Contexts) | **Approved** |
| `OQ-008` | Localization / Finance | Currency Representation, Precision & Multi-Currency Horizon | `FR-6`, `FR-14` | **High** | **Owner-Approved Decision** (LKR only launch; ISO 4217 integer minor units; no global two-decimal assumption; multi-currency deferred) | **Approved** |
| `OQ-009` | Policy / Finance | Customer Cancellation & Refund Policy Tiers | `FR-10`, `FR-34` | **High** | **Owner-Approved Decision** (Standard customer cancellation tiers approved; provider capabilities separate under OQ-013) | **Approved** |
| `OQ-010` | Legal / Finance | Tax, Invoicing Architecture & Sri Lankan Compliance | `FR-36`, `FR-37`, `FR-38` | **Critical** | **Platform Capability Approved / Sri Lankan Legal Classification & Compliance are Launch Gate** | **Approved (Arch) / External Verification Gate (Legal/Tax)** |
| `OQ-011` | Roles / Governance | Superadmin & Platform Support Role Separation | `FR-17`, `FR-37` | **Medium** | **Owner-Approved Decision** (Strict least-privilege; Support cannot execute financial/host approvals) | **Approved** |
| `OQ-012` | Product / Trust | Address Privacy Baseline & Location Disclosure Details | `FR-4`, `FR-7` | **Medium** | **Approved Baseline (Approximate discovery, exact address post-booking) / Disclosure Details Proposed** | **Approved (Baseline) / Proposed (Jitter & Store Details)** |
| `OQ-013` | Scope / Payments | Payment-Provider Refund Capabilities, Execution Method & Fees | `FR-10` | **High** | **External Verification Gate** (PayHere automated API vs portal, timing, fee treatment, reconciliation) | **External Verification Gate** |
| `OQ-014` | Product / Custody | Custody & Check-In Evidence Policy | `FR-29` | **Medium** | **Owner-Approved Decision** (QR/PIN & bag count check mandatory; photo evidence optional by default & configurable mandatory per location) | **Approved** |
| `OQ-015` | Product / Custody | Late Collection Fee Settlement & Custody Separation | `FR-32` | **High** | **Owner-Approved Decision** (In-app collection only for MVP; cash excluded; luggage custody decoupled from overdue payment) | **Approved** |
| `OQ-016` | Product / Support | Customer Support Separation (`FR-12` & `FR-40`) | `FR-12`, `FR-40` | **Medium** | **Pending Decision** | **Yes** |
| `OQ-017` | Roles / Host Staff | Host Staff Permission Granularity (`FR-42 Later`) | `FR-42`, `FR-44` | **Low** | **Pending Decision** | **Yes** |
| `OQ-018` | Technical / Maps | Commercial Map Tile, Geocoding & Routing Provider | `FR-2`, `FR-3`, `FR-7` | **High** | **Pending Decision** | **Yes** |
| `OQ-019` | Technical / Comms | Transactional Email Provider Selection | `FR-1`, `FR-11`, `FR-35` | **Medium** | **Pending Decision** | **Yes** |
| `OQ-020` | Technical / Comms | SMS / Phone OTP Verification Requirement & Provider | `FR-1`, `FR-11` | **Medium** | **Pending Decision** | **Yes** |
| `OQ-021` | Infrastructure | Redis / Upstash Activation Threshold | Infrastructure | **Low** | **Pending Decision** (Proposed: Deferred to Phase 1+) | **Yes** |
| `OQ-022` | Requirements | Normalization of Duplicate FRS Requirement Numbers (`FR-2`–`FR-14`) | `FR-2`..`FR-14` | **Medium** | **Approved Normalization** (Resolved in Phase 0B) | **Approved** |

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
- **Current Assumption:** The `host-verification` module will be data-driven by `country_code` and `host_entity_type` (`INDIVIDUAL` vs. `REGISTERED_BUSINESS`), allowing configurable document slots (e.g., NIC / Passport / Driving License for individuals; Business Registration Certificate + Director NIC + Proof of Premises for businesses) uploaded to private Cloudflare R2 storage.
- **Impact:** Determines the exact form fields and document upload slots on the Host Verification screen (`FR-16`) and the Superadmin review checklist (`FR-17`).
- **Proposed Resolution:** Owner to confirm the mandatory vs. optional document checklist for Sri Lanka (`LK`) individual and corporate hosts.
- **Status:** Pending Approval
- **Owner Approval Required:** **Yes**

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

### `OQ-016` — Operational Support Workflow & Ticket Queue Separation (Pending Workflow Decisions)
- **Category:** Product / Support Operations
- **Source Reference:** `FR -12 Leave Review`, `FR -12 Customer Support`, `FR-40 Support`, `FR-41 Incident Reporting`.
- **Status:** **Pending Decision** (Operational Support Channel Architecture).
- **Scope & Relationship to `OQ-011`:**
  - While `OQ-011` governs the high-level RBAC permission boundary (confirming Support Staff cannot execute financial actions or host approvals), `OQ-016` governs the remaining operational ticketing separation and intake workflows. There is zero permission overlap: all workflows in `OQ-016` strictly operate within the non-privileged boundaries established by `OQ-011`.
- **Proposed Operational Separation:**
  1. **Booking / Host Issue Report:** Linked to a specific `booking_id` / `host_id` (e.g., host closed, bag discrepancy, damage report).
  2. **General Platform Support Inquiry:** Account, payment, or general help requests not tied to an active host dispute.
  3. **Host Partner Support (`FR-40`) & Incident Reporting (`FR-41`):** Host-side store operational issues and formal lost/damaged/unclaimed luggage reporting.
  4. **Post-Collection Review vs. App Feedback (`FR-12`):** Public rating/review for the Host storefront vs. private technical rating/feedback for the Mobile/Web application.
- **Impact:** Structures support routing, screen workflows in mobile/web, and queue categorization in the Superadmin support console.
- **Proposed Resolution:** Owner to confirm this four-channel operational separation for implementation in Phase 12.
- **Owner Approval Required:** **Yes**.

---

### `OQ-017` — Host Staff Permission Granularity (`FR-42` — `Later`)
- **Category:** Roles / Host Staff
- **Description:** `FR-42 Staff Accounts` states *"Allow employees to handle check-in/out"* and is marked **`Later`**.
- **Source:** `FR-42 Staff Accounts` (`Later`), `FR-44 Multiple Locations`.
- **Current Assumption:** In the initial release, all Staff Management screens are built as UI-complete previews (`Later`), and the database schema supports scoping a staff member to specific `StorageLocations` (`FR-44`) with check-in/out and booking-view permissions while hiding financial payout/bank settings (`FR-36`–`FR-38`).
- **Impact:** Ensures Phase 2 UI screens and Phase 3/4/9 schemas require no refactoring when `FR-42` backend is activated in Phase 11.
- **Proposed Resolution:** Owner to confirm that scoping Host Staff to assigned location(s) for check-in/out and daily booking operations (without access to host payouts/bank details) is the desired model.
- **Status:** Pending Approval
- **Owner Approval Required:** **Yes**

---

### `OQ-018` — Production Map Tile, Geocoding & Routing Provider
- **Category:** Technical / Maps
- **Description:** `MapLibre` is approved as the client rendering engine (`FR-3`), which requires a commercial vector tile, geocoding (`FR-2`), and routing (`FR-7`) provider.
- **Source:** Execution Prompt Section 4 (*"do not assume a specific production map provider"*).
- **Current Assumption:** Map style URLs and geocoding API credentials are injected via environment configuration behind a provider adapter; `FR -7 Directions` supports launching native Google Maps / Apple Maps / Waze turn-by-turn navigation alongside in-app map pin display.
- **Impact:** Required for live map rendering and address search in Phase 4 and Phase 6.
- **Proposed Resolution:** Recommend **MapTiler** (or **Stadia Maps / AWS Location Service**) for MapLibre vector tiles + geocoding, paired with **native OS map deep links** for turn-by-turn navigation (`FR -7`). Owner to approve preferred vendor.
- **Status:** Pending Approval
- **Owner Approval Required:** **Yes**

---

### `OQ-019` — Transactional Email Provider Selection
- **Category:** Technical / Comms
- **Description:** Selection of the transactional email delivery service for registration verification (`FR-1`), booking confirmations (`FR-7`, `FR-11`), host approvals (`FR-17`, `FR-35`), and payout notifications (`FR-37`).
- **Source:** Execution Prompt Section 4 (*"do not assume a specific ... email provider"*).
- **Current Assumption:** Abstracted behind `EmailProviderPort` in `apps/api/src/integrations/email/` with a console/local-SMTP adapter for local development.
- **Impact:** Required before live email delivery in Phase 3 and Phase 10.
- **Proposed Resolution:** Recommend **Resend** or **Amazon SES**. Owner to approve preferred provider.
- **Status:** Pending Approval
- **Owner Approval Required:** **Yes**

---

### `OQ-020` — SMS / Phone OTP Provider & Verification Policy
- **Category:** Technical / Comms
- **Description:** Whether SMS OTP verification is required at signup/booking (`FR-1`) or if email/OAuth verification suffices for MVP, and which SMS gateway to use for Sri Lankan (`+94`) vs. international numbers.
- **Source:** Execution Prompt Section 4 (*"do not assume a specific ... SMS provider"*).
- **Current Assumption:** Abstracted behind `SmsProviderPort`. Phone numbers are stored in `E.164` format; SMS OTP screens exist in the UI (`FR-1`), while mandatory SMS dispatch can be toggled by configuration.
- **Impact:** Affects per-signup/per-booking telecom cost in Sri Lanka.
- **Proposed Resolution:** Recommend email + Google/Apple OAuth as primary MVP verification (keeping SMS OTP optional or triggered only for high-risk actions via a local Sri Lankan SMS gateway for `+94` + Twilio/SNS for international). Owner to confirm.
- **Status:** Pending Approval
- **Owner Approval Required:** **Yes**

---

### `OQ-021` — Redis / Upstash Activation Timing
- **Category:** Infrastructure
- **Description:** Approved stack states *"Redis/Upstash when justified by actual requirements."*
- **Source:** Execution Prompt Section 4.
- **Current Assumption:** Initial launch runs background tasks (reservation expiration, reminder checks) and rate limiting inside the Fastify + PostgreSQL footprint without requiring a paid Redis instance on day one; Redis/Upstash adapter interfaces are kept ready when multi-node scaling requires it.
- **Impact:** Saves monthly infrastructure cost and operational moving parts during initial launch.
- **Proposed Resolution:** Owner to confirm deferring live Redis/Upstash provisioning until multi-instance horizontal scaling or high-frequency queue volume justifies it.
- **Status:** Proposed (Deferred)
- **Owner Approval Required:** **Yes**

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

