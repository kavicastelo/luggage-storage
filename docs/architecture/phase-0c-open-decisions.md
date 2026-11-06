# Phase 0C Architecture Decisions & Open Technical Questions

**Project:** Global Luggage Storage Marketplace  
**Document Type:** Architectural Governance & Decision Record  
**Status:** Approved Phase 0C Baseline (Reconciled & Corrected)  
**Governing Documents:** Phase 0A ADRs (ADR-001 to ADR-010), Assumptions & Open Questions Register (`docs/product/assumptions-and-open-questions.md`, `OQ-001` to `OQ-022`).

---

## 1. Executive Summary & Governance Policy

In accordance with strict architectural governance rules, Phase 0C does **not silently resolve commercial, external provider, or legal questions**. 

Any architectural selection that requires a contract, legal counsel sign-off, external vendor approval, or commercial pricing negotiation is formally classified as an **Open Technical Decision / Launch Gate** with explicit ownership, options, consequences, and blocking thresholds.

All references in this document are strictly reconciled against the authoritative Phase 0B-D Open Questions Register (`OQ-001` through `OQ-022`).

---

## 2. Open Technical Decisions & Vendor Selection Register

### OTD-001: Transactional & Marketing Email Provider (`OQ-019`)
- **Context & Impact:** The platform dispatches account verification links, password reset tokens, booking confirmation vouchers with QR codes, host acceptance alerts, and refund receipts.
- **Why It Matters:** Deliverability to international travellers (Gmail, iCloud, Outlook) and local Sri Lankan hosts is essential for operational SLA compliance.
- **Evaluated Options:**
  1. *AWS SES (Simple Email Service):* Extremely low cost ($0.10 per 1,000 emails), highly reliable, but requires domain warmup and AWS account configuration.
  2. *Resend:* Developer-friendly modern API, excellent React-email integration, built-in deliverability tracking, higher tier cost.
  3. *SendGrid / Mailgun:* Enterprise standard, higher cost base.
- **Architectural Abstraction:** Fastify backend defines a generic `EmailService` interface (`sendEmail(to, template, context)`). The concrete provider adapter is decoupled via configuration.
- **Authoritative Register Reference:** `OQ-019` (Transactional Email Provider Selection).
- **Owner:** Lead Backend Architect & DevOps Lead.
- **Blocking Phase:** Implementation Phase 1 (requires sandbox credentials for dev). Launch blocker for production.
- **Status:** **PENDING SELECTION — DECISION REQUIRED PRIOR TO PHASE 1 AUTH COMPLETION**.

---

### OTD-002: Transactional SMS & WhatsApp Notification Gateway (`OQ-020`)
- **Context & Impact:** Immediate mobile alerts are critical for host approval SLAs (15-minute response window) and urgent collection/overdue reminders.
- **Why It Matters:** Global aggregators (e.g., Twilio) incur high international termination rates when sending SMS to Sri Lankan telecom operators (Dialog, Mobitel, SLT, Airtel).
- **Evaluated Options:**
  1. *Twilio / MessageBird:* Global reliability, unified API, higher per-SMS cost in Sri Lanka (~$0.04–$0.06 per SMS).
  2. *Local Sri Lankan SMS Aggregator (e.g., Dialog Enterprise, Mobitel mSpace, ShoutOUT):* Highly cost-effective for domestic hosts (~LKR 0.50–1.00 per SMS), but requires local enterprise registration.
  3. *Hybrid Model:* Local aggregator for `+94` destinations; Twilio for international roaming numbers.
- **Architectural Abstraction:** Fastify backend defines an abstracted `SmsService` provider port.
- **Authoritative Register Reference:** `OQ-020` (SMS / Phone OTP Provider & Verification Policy).
- **Owner:** Product Owner & Lead Backend Architect.
- **Blocking Phase:** Phase 1 Sprint 2 (Host Operations).
- **Status:** **PENDING SELECTION & LOCAL AGGREGATOR COMMERCIAL TERMS**.

---

### OTD-003: MapLibre Map Tile & Geocoding Provider (`OQ-018`)
- **Context & Impact:** In accordance with ADR-004 and the Technical Blueprint, MapLibre GL is the confirmed client-side vector mapping engine. However, the vector tile backend, raster tiles, and forward/reverse geocoding service must be provisioned.
- **Why It Matters:** Map display, geolocation pinning, address autofill, and distance calculations depend on this service.
- **Evaluated Options:**
  1. *MapTiler Cloud:* Commercial SaaS, native MapLibre support, high-resolution tiles, includes geocoding API, generous free tier.
  2. *Protomaps (Self-Hosted via Cloudflare R2 / Workers):* Zero recurring tile server cost, complete data ownership, requires pre-rendered PMTiles archive of Sri Lanka / global regions.
  3. *OpenStreetMap / Nominatim (SaaS e.g. Stadia Maps / Geoapify):* Open standards, transparent pricing.
- **Architectural Abstraction:** Client MapLibre components consume configurable TileJSON style URLs (`MAP_TILE_STYLE_URL`) and geocoding endpoint abstraction.
- **Authoritative Register Reference:** `OQ-018` (Production Map Tile, Geocoding & Routing Provider).
- **Owner:** Frontend Lead & DevOps Lead.
- **Blocking Phase:** Phase 1 Sprint 1 (Discovery & Map UI).
- **Status:** **PENDING SELECTION — EVALUATING MAPTILER VS PROTOMAPS ON R2**.

---

### OTD-004: Redis Cache & Job Queue Infrastructure (`OQ-021`)
- **Context & Impact:** High-frequency tasks (capacity TTL sweeper, outbox event dispatching, session rate limiting) benefit from an in-memory datastore.
- **Why It Matters:** Must balance simplicity and low hosting cost during launch against clustering requirements at scale.
- **Evaluated Options:**
  1. *PostgreSQL-Only Engine (No Redis for MVP):* Use PostgreSQL `SKIP LOCKED` and row-level locks on parent pool rows for all queues and sweepers. Eliminates external infrastructure dependencies for MVP.
  2. *Managed Redis (Upstash Serverless Redis):* Pay-per-request, zero server maintenance, excellent for low-volume launch.
  3. *Containerized Redis / Valkey on Monolith Host:* Minimal cost, requires operational management.
- **Architectural Invariant:** In Phase 0C, the capacity engine and outbox pattern are designed to function **entirely on PostgreSQL 16+ without requiring Redis** (`ADR-005`). Redis activation is deferred to high-traffic scaling.
- **Authoritative Register Reference:** `OQ-021` (Redis / Upstash Activation Timing).
- **Owner:** Principal Software Architect.
- **Blocking Phase:** Post-Launch Scaling.
- **Status:** **DEFERRED TO SCALING PHASE — POSTGRESQL ROW LOCKING BASELINE CONFIRMED FOR MVP**.

---

### OTD-005: PayHere Marketplace Written Approval (`OQ-003`)
- **Context & Impact:** Platform uses PayHere as the initial Sri Lankan payment aggregator (`ADR-008`).
- **Why It Matters:** Aggregator terms of service often distinguish between direct merchant sales and two-sided multi-vendor marketplace platforms.
- **Launch Gate Mandate:** Formal written confirmation from PayHere compliance authorizing the marketplace payment flow and settlement model is a **mandatory launch gate blocker** prior to processing real transactions (`OQ-003`).
- **Authoritative Register Reference:** `OQ-003` (PayHere Marketplace Payment Model).
- **Owner:** Product Owner & Legal Counsel.
- **Blocking Phase:** Pre-Launch Production Gate.
- **Status:** **PENDING VENDOR WRITTEN CONFIRMATION — LAUNCH GATE ACTIVE**.

---

### OTD-006: Host KYC & Identity Verification Provider (`OQ-002`)
- **Context & Impact:** Host partner identity documents (National ID, Passport, Business Registration, Utility Bills) must be verified before locations are activated (`FR-045`).
- **Why It Matters:** Automated KYC vendors (e.g., Sumsub, Veriff, Jumio) introduce high SaaS per-verification costs that are uneconomical during early launch volumes.
- **Baseline Strategy:** The initial MVP utilizes **Cloudflare R2 secure document storage with manual Superadmin dashboard review (`AD-002`)**. Automated biometric KYC integrations are deferred to international expansion.
- **Authoritative Register Reference:** `OQ-002` (Host Identity & Business Verification Requirements).
- **Owner:** Product Owner & Operations Lead.
- **Blocking Phase:** Not blocking for MVP (Manual workflow supported).
- **Status:** **APPROVED MVP MANUAL WORKFLOW — AUTOMATED VENDOR DEFERRED TO PHASE 2**.

---

### OTD-007: Legal & Tax Characterization Sign-Off (`OQ-010`)
- **Context & Impact:** Tax calculations (VAT @ 18%, Social Security Contribution Levy @ 2.5%, or Exempt status) depend on the corporate legal classification of the marketplace.
- **Why It Matters:** Determining whether the platform is an undisclosed agent/intermediary or a principal service vendor affects tax invoice formatting, gross vs. net reporting, and host tax withholding.
- **Baseline Strategy:** The data model supports Layer A/B multi-rate calculation. The initial configuration is set to 0% exempt until local tax counsel provides formal written instructions (`BR-029`, `BR-096`).
- **Authoritative Register Reference:** `OQ-010` (Tax, Invoicing Architecture & Sri Lankan Compliance).
- **Owner:** Product Owner & Sri Lankan Tax Counsel.
- **Blocking Phase:** Commercial Launch Gate.
- **Status:** **PENDING FORMAL TAX COUNSEL OPINION**.

---

### OTD-008: Payment-Provider Automated Refund API & Fee Settlement (`OQ-013`)
- **Context & Impact:** Cancellation workflows require refunding settled funds to travellers.
- **Why It Matters:** Payment aggregators differ widely in refund API availability, fees charged for refunds, and whether gateway processing fees are returned.
- **Baseline Strategy:** The platform defines a 7-stage refund lifecycle with an automated gateway instruction path (Stage 3/4/5) and a manual Superadmin bank transfer fallback (Stage 7: `MANUAL_REVIEW_REQUIRED`).
- **Authoritative Register Reference:** `OQ-013` (Payment-Provider Refund Capabilities, Execution Method & Fee Settlement).
- **Owner:** Lead Backend Architect & Product Owner.
- **Blocking Phase:** Phase 1 Sprint 3 (Refunds).
- **Status:** **PENDING GATEWAY CAPABILITY CONFIRMATION**.
