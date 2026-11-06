# Screen-to-Workflow Traceability Matrix

**Project:** Global Luggage Storage Marketplace  
**Document Type:** UX Architecture & Traceability Specification  
**Status:** Approved Phase 0C Baseline  
**Governing Documents:** Master Screen Registry (`master-screen-registry.md`), Workflow Inventory (`docs/product/workflow-inventory.md`), Functional Requirements (`FR-001`–`FR-057`).

---

## 1. Executive Summary & Purpose

This matrix establishes 100% bidirectional traceability between the 44 normalized workflows (`WF-TRV-001`–`WF-TRV-015`, `WF-HST-001`–`WF-HST-016`, `WF-STF-001`–`WF-STF-003`, `WF-SUP-001`–`WF-SUP-004`, `WF-ADM-001`–`WF-ADM-006`) and the complete inventory of screens across Traveller Mobile (`TM`), Host Mobile (`HM`), Public Web (`PW`), Host Dashboard (`HD`), and Superadmin Dashboard (`AD`).

Every single user action is mapped to an authoritative screen interface, ensuring complete UX coverage and zero orphaned workflows.

---

## 2. Complete Workflow-to-Screen Mapping

| Workflow ID | Workflow Name | Owning Domain | Primary Role | Traveller Mobile Screens (`TM`) | Host Mobile Screens (`HM`) | Public Web Screens (`PW`) | Host Dashboard Screens (`HD`) | Superadmin Dashboard Screens (`AD`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `WF-TRV-001` | Traveller Registration & Authentication | `identity` | Traveller | `TM-001`, `TM-002`, `TM-004`, `TM-005`, `TM-006`, `TM-007`, `TM-008` | — | `PW-001` | — | `AD-017` |
| `WF-TRV-002` | Profile & Contact Management | `travellers` | Traveller | `TM-042`, `TM-043`, `TM-044` | — | `PW-011` | — | `AD-005` |
| `WF-TRV-003` | Location Discovery via GPS & Destination Search | `discovery` | Traveller | `TM-003`, `TM-011`, `TM-012`, `TM-013`, `TM-036` | — | `PW-001`, `PW-002` | — | — |
| `WF-TRV-004` | Filtering & Listing Inspection | `discovery` / `locations` | Traveller | `TM-013`, `TM-014`, `TM-015`, `TM-016`, `TM-036` | — | `PW-002`, `PW-003` | — | — |
| `WF-TRV-005` | Availability Check & Authoritative Price Quote | `capacity` / `pricing` | Traveller | `TM-015`, `TM-017`, `TM-018`, `TM-019` | — | `PW-003`, `PW-004` | — | — |
| `WF-TRV-006` | Instant Booking & Online Payment | `bookings` / `payments` | Traveller | `TM-019`, `TM-020`, `TM-021`, `TM-023`, `TM-024` | — | `PW-004`, `PW-005` | — | `AD-005`, `AD-006` |
| `WF-TRV-007` | Host Approval Booking Workflow | `bookings` / `capacity` | Traveller / Host | `TM-019`, `TM-022`, `TM-020`, `TM-021`, `TM-024` | `HM-018`, `HM-019` | `PW-004`, `PW-005` | `HD-007` | `AD-005` |
| `WF-TRV-008` | Navigation to Host Location | `locations` / `bookings`| Traveller | `TM-024`, `TM-027` | — | `PW-011` | — | — |
| `WF-TRV-009` | Bag Drop-Off & Custody Handoff | `custody` | Traveller / Host | `TM-027`, `TM-028`, `TM-029` | `HM-006`, `HM-021`, `HM-022`, `HM-023` | — | `HD-009` | `AD-005` |
| `WF-TRV-010` | Active Storage Tracking & Alerts | `custody` / `notifications` | Traveller | `TM-027`, `TM-029`, `TM-037` | — | `PW-011` | — | `AD-005` |
| `WF-TRV-011` | Luggage Collection & Handover | `custody` / `bookings` | Traveller / Host | `TM-029`, `TM-030`, `TM-034` | `HM-006`, `HM-024`, `HM-025` | — | `HD-009` | `AD-005`, `AD-010` |
| `WF-TRV-012` | Booking Cancellation & Refund Tracking | `bookings` / `refunds` | Traveller | `TM-027`, `TM-031`, `TM-032`, `TM-033` | `HM-006`, `HM-020` | `PW-011` | `HD-007` | `AD-005`, `AD-007` |
| `WF-TRV-013` | Post-Collection Rating & Feedback | `reviews` | Traveller | `TM-030`, `TM-034` | `HM-035` | `PW-003` | `HD-012` | `AD-014` |
| `WF-TRV-014` | Customer Support Ticket Creation | `support` | Traveller | `TM-039`, `TM-040`, `TM-041` | — | `PW-008`, `PW-009` | — | `AD-011`, `AD-012` |
| `WF-TRV-015` | Booking History Inspection & Invoicing | `bookings` / `finance` | Traveller | `TM-035`, `TM-027` | — | `PW-011` | — | `AD-005` |
| `WF-HST-001` | Host Partner Application | `hosts` / `identity` | Host Owner | — | `HM-001`, `HM-002`, `HM-003` | `PW-006` | `HD-014` | `AD-002`, `AD-003` |
| `WF-HST-002` | KYC & Business Verification Submission | `verification` | Host Owner | — | `HM-003`, `HM-004`, `HM-005` | `PW-006` | `HD-014` | `AD-002` |
| `WF-HST-003` | Storage Location & Facility Setup | `locations` | Host Owner | — | `HM-006`, `HM-009` | — | `HD-002`, `HD-003` | `AD-004` |
| `WF-HST-004` | Operating Hours & Drop-Off Windows Configuration | `locations` | Host Owner | — | `HM-009`, `HM-010`, `HM-011` | — | `HD-004` | `AD-004` |
| `WF-HST-005` | Storage Capacity Pool Configuration | `capacity` | Host Owner | — | `HM-009`, `HM-013` | — | `HD-005` | `AD-004` |
| `WF-HST-006` | Availability Blocks & Emergency Stop-Booking | `capacity` | Host Owner | — | `HM-011`, `HM-013` | — | `HD-004`, `HD-005` | `AD-004` |
| `WF-HST-007` | Storage Pricing Configuration | `pricing` | Host Owner | — | `HM-009`, `HM-014` | — | `HD-006` | `AD-004` |
| `WF-HST-008` | Booking Acceptance / Rejection (Host Approval Mode) | `bookings` | Host Owner / Staff | `TM-022` | `HM-006`, `HM-018`, `HM-019` | — | `HD-007` | `AD-005` |
| `WF-HST-009` | Traveller Check-In & Bag Verification | `custody` | Host Owner / Staff | `TM-028` | `HM-006`, `HM-021`, `HM-022`, `HM-023` | — | `HD-009` | `AD-005` |
| `WF-HST-010` | Operational Booking Dashboard Monitoring | `locations` / `bookings`| Host Owner / Staff | — | `HM-006`, `HM-007`, `HM-020` | — | `HD-001`, `HD-007` | `AD-005` |
| `WF-HST-011` | Luggage Collection Verification & Completion | `custody` | Host Owner / Staff | `TM-030` | `HM-006`, `HM-024`, `HM-025` | — | `HD-009` | `AD-005`, `AD-010` |
| `WF-HST-012` | Overdue Luggage & Late Fee Handling | `custody` / `payments` | Host Owner / Staff | `TM-029`, `TM-037` | `HM-006`, `HM-026`, `HM-027`, `HM-028` | — | `HD-007`, `HD-009` | `AD-005`, `AD-013` |
| `WF-HST-013` | Incident Reporting (Lost / Damaged / Unclaimed) | `support` / `custody` | Host Owner / Staff | — | `HM-036` | — | `HD-011` | `AD-013` |
| `WF-HST-014` | Host-Initiated Cancellation | `bookings` / `refunds` | Host Owner | `TM-032`, `TM-037` | `HM-020` | — | `HD-007` | `AD-005`, `AD-007` |
| `WF-HST-015` | Earnings Review & Payout Account Setup | `revenue` / `payouts` | Host Owner | — | `HM-029`, `HM-030`, `HM-031` | — | `HD-010`, `HD-011` | `AD-008`, `AD-009` |
| `WF-HST-016` | Multi-Location Fleet Management | `locations` / `hosts` | Host Owner | — | `HM-006`, `HM-009` | — | `HD-001`, `HD-002` | `AD-004` |
| `WF-STF-001` | Staff Member Onboarding & Invitation | `staff` | Host Owner / Staff | — | `HM-033`, `HM-034`, `HM-002` | — | `HD-013` | — |
| `WF-STF-002` | Store-Floor Check-In / Check-Out Execution | `custody` | Host Staff | `TM-028`, `TM-030` | `HM-006`, `HM-021`, `HM-022`, `HM-023`, `HM-024`, `HM-025` | — | `HD-009` | `AD-005` |
| `WF-STF-003` | Financial & Bank Settings Restriction Enforcement | `staff` / `finance` | Host Staff | — | `HM-006`, `HM-029` (Restricted)| — | `HD-010` (Restricted)| — |
| `WF-SUP-001` | Host KYC Verification Triage | `verification` | Support Agent | — | — | — | — | `AD-002`, `AD-003` |
| `WF-SUP-002` | Customer & Host Support Ticket Resolution | `support` | Support Agent | `TM-041` | `HM-036` | `PW-009` | — | `AD-011`, `AD-012` |
| `WF-SUP-003` | Luggage Incident Investigation | `support` / `custody` | Support Agent | — | — | — | — | `AD-013`, `AD-005` |
| `WF-SUP-004` | Review Moderation Queue | `reviews` | Support Agent | — | — | — | — | `AD-014` |
| `WF-ADM-001` | Final Host Approval & Suspension Oversight | `hosts` / `admin` | Superadmin | — | `HM-005` | — | — | `AD-002`, `AD-003` |
| `WF-ADM-002` | Platform Commission & Promo Campaign Configuration | `pricing` / `revenue` | Superadmin | `TM-019` | — | `PW-004` | — | `AD-015`, `AD-016` |
| `WF-ADM-003` | Manual Host Payout Execution & Disbursement Logging | `payouts` / `finance` | Superadmin | — | `HM-031` | — | `HD-011` | `AD-008`, `AD-009`, `AD-010`|
| `WF-ADM-004` | Traveller Refund Review & Processing | `refunds` / `finance` | Superadmin | `TM-033` | — | — | — | `AD-007`, `AD-010` |
| `WF-ADM-005` | Platform Audit Log & Security Inspection | `audit` / `admin` | Superadmin | — | — | — | — | `AD-017` |
| `WF-ADM-006` | Global Country & Currency Management | `localization` / `admin` | Superadmin | `TM-004` | — | — | — | `AD-016` |
