# 04 — Product Decisions and Open Gates Governance (`AUD-005`)

**Project:** Global Luggage Storage Marketplace  
**Branch:** `feat/phase-1b-identity`  
**Audit Finding Addressed:** `AUD-005` (Medium — Product Decisions & Open Questions Governance)  
**Authoritative Registers Updated:**
- [`docs/product/assumptions-and-open-questions.md`](file:///d:/luggage-storage/luggage-storage/docs/product/assumptions-and-open-questions.md)
- [`docs/project-stabilization/03-product-decision-resolution.md`](file:///d:/luggage-storage/luggage-storage/docs/project-stabilization/03-product-decision-resolution.md)
- [`docs/project-stabilization/08-final-stabilization-report.md`](file:///d:/luggage-storage/luggage-storage/docs/project-stabilization/08-final-stabilization-report.md)  
**Status:** `COMPLETE & VERIFIED`

---

## 1. Seven-Status Governance Model

To ensure engineering baselines are never conflated with external commercial, legal, tax, or Product Owner sign-off gates, all Open Questions (`OQ-001`–`OQ-022`) and Open Technical Decisions (`OTD-001`–`OTD-008`) are classified using the following seven statuses:

| Status Code | Definition |
|:---|:---|
| `RESOLVED_INTERNAL` | Internal engineering/product design decision implemented or adopted as the default baseline. |
| `OWNER_APPROVAL_REQUIRED` | Internal recommendation exists, but final business policy or commercial sign-off requires Product Owner approval. |
| `VENDOR_CONFIRMATION_REQUIRED` | Depends on written confirmation, API capability, or contract from an external vendor. |
| `LEGAL_REVIEW_REQUIRED` | Depends on qualified legal counsel review. |
| `TAX_REVIEW_REQUIRED` | Depends on qualified tax/accounting counsel review. |
| `DEFERRED` | Intentionally postponed to a later phase with documented rationale. |
| `BLOCKED` | Cannot be finalized for commercial production launch until a named external dependency is completed. |

---

## 2. Internal Recommendations & External Gate Classification (`OQ-002`, `OQ-003`, `OQ-010`, `OQ-012`, `OQ-013`, `OQ-016`–`OQ-021`)

| ID | Topic | Internal Engineering Baseline (`RESOLVED_INTERNAL`) | External / Owner Gate Status |
|:---|:---|:---|:---|
| `OQ-002` | Host Identity & Business Verification (`FR-16`, `FR-17`) | Configurable two-tier KYC schema & review queue (`INDIVIDUAL` vs `REGISTERED_BUSINESS`). | `OWNER_APPROVAL_REQUIRED`, `LEGAL_REVIEW_REQUIRED` (Mandatory Sri Lanka document checklist sign-off). |
| `OQ-003` | PayHere Marketplace Settlement Model (`FR-6`, `FR-37`) | Platform Merchant-of-Record checkout + immutable double-entry ledger + manual Superadmin host payout batches (`PaymentGatewayPort`). | `BLOCKED`, `VENDOR_CONFIRMATION_REQUIRED` (Written PayHere confirmation permitting marketplace collection & manual host settlement). |
| `OQ-010` | Sri Lanka Legal & Tax Compliance (`FR-36`–`FR-38`) | 4-layer configurable tax (`VAT`/`SSCL`/`WHT`) and invoicing foundation storing integer minor units and immutable tax snapshots. | `BLOCKED`, `LEGAL_REVIEW_REQUIRED`, `TAX_REVIEW_REQUIRED` (Formal Sri Lankan legal & tax counsel sign-off on principal/agent classification, VAT/SSCL base, and invoicing). |
| `OQ-012` | Address Privacy & Location Disclosure (`FR-4`, `FR-7`) | Approximate public discovery before booking; exact address disclosed only to confirmed booking holder. | **Approved** (Baseline) / `OWNER_APPROVAL_REQUIRED` (150–300m jitter radius & storefront photo/phone disclosure details). |
| `OQ-013` | Payment-Provider Refund Capabilities & Fees (`FR-10`) | 7-stage refund lifecycle state machine supporting both automated API refunds and Superadmin-assisted portal refunds. | `VENDOR_CONFIRMATION_REQUIRED` (PayHere confirmation of automated refund API vs manual portal, settlement timing, fee retention, and partial refunds). |
| `OQ-016` | Customer Support & Incident Queue Separation (`FR-12`, `FR-40`, `FR-41`) | Public post-collection reviews (`FR-12 Leave Review`) separated from private operational tickets. Operational queues split into General Support (`SUPPORT` + `SUPERADMIN`) and Safety/Custody/Financial Incident Queue (`SUPERADMIN` adjudication). | **Internal Baseline Approved** (`RESOLVED_INTERNAL`). |
| `OQ-017` | Host Staff Permission Granularity (`FR-42 Later`) | Fixed least-privilege operational permission set for `HOST_STAFF` (check-in/out QR/PIN verification, bag count, evidence capture, location/booking read, incident submission; zero access to finance/payouts/pricing/location deletion/staff management). | `RESOLVED_INTERNAL` (MVP Baseline) / `DEFERRED` (Per-staff custom ACL toggles). |
| `OQ-018` | Commercial Map Tile, Geocoding & Routing Provider (`FR-2`, `FR-3`, `FR-7`) | MapLibre client rendering with MapTiler (OpenStreetMap vector tiles) recommended primary adapter + native OS map deep links (`Google Maps`/`Apple Maps`/`Waze`) for turn-by-turn directions after booking confirmation. | `VENDOR_CONFIRMATION_REQUIRED`, `OWNER_APPROVAL_REQUIRED` (Production commercial API keys, billing account, and ToS review). |
| `OQ-019` | Transactional Email Provider Selection (`FR-1`, `FR-11`, `FR-35`) | **Zoho Mail** (`ZohoSmtpEmailAdapter`, `EMAIL_PROVIDER=zoho`) integrated for production authentication emails; `ConsoleDevEmailAdapter` for dev; `DeterministicTestEmailAdapter` for tests. | `OWNER_APPROVAL_REQUIRED`, `VENDOR_CONFIRMATION_REQUIRED` (Production domain `SPF`/`DKIM`/`DMARC` DNS verification and live Zoho mailbox credentials). |
| `OQ-020` | SMS / Phone OTP Verification Policy (`FR-1`, `FR-11`) | Self-service Email Verification is the mandatory account activation mechanism for Phase 1B / MVP; phone capture stored with `is_phone_verified = false`. | `DEFERRED`, `VENDOR_CONFIRMATION_REQUIRED`, `OWNER_APPROVAL_REQUIRED` (Automated SMS/WhatsApp OTP deferred until telecom aggregator & sender ID approval). |
| `OQ-021` | Redis / Upstash Activation Threshold | PostgreSQL-backed rate limiting (`auth_rate_limits` with keyed `HMAC-SHA-256`), session management (`auth_sessions`), and row locking (`SELECT ... FOR UPDATE`) for MVP and single-region multi-instance deployment. | `RESOLVED_INTERNAL` (PostgreSQL Baseline) / `DEFERRED` (Redis/Upstash deferred until >100 req/sec rate-limited load or realtime pub/sub). |
