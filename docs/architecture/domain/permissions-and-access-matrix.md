# Permissions and Access Matrix

**Project:** Global Luggage Storage Marketplace  
**Document Type:** Domain Architecture Specification  
**Status:** Approved Phase 0C Baseline  
**Governing Documents:** FRS (`FR-001`, `FR-002`, `FR-015`, `FR-016`), ADR-001, ADR-003, Business Rules Catalogue (`BR-001`–`BR-006`, `BR-050`–`BR-060`), Assumptions & Open Questions (`OQ-001`, `OQ-011`, `OQ-016`).

---

## 1. Architectural Access Principles & Role Hierarchy

Access control in the Global Luggage Storage Marketplace follows the principle of **Least Privilege (PoLP)** and enforces strict boundary isolation between external consumers, multi-tenant host businesses, operational customer support, and platform superadministrators.

### 1.1 Formal User Roles

| Role Identifier | Description & Persona | Primary Client Surface |
| :--- | :--- | :--- |
| `ANONYMOUS` | Unauthenticated public visitor exploring listings, searching locations, reading help pages. | Public Web, Mobile Apps (Pre-login) |
| `TRAVELLER` | Registered customer searching, booking, paying, managing luggage storage reservations. | Traveller Mobile App, Public Web |
| `HOST_OWNER` | Legal business owner or primary account administrator managing locations, staff, and earnings. | Host Web Dashboard, Host Mobile App |
| `HOST_STAFF` | Designated employee or attendant authorized to perform check-in and check-out operations. | Host Mobile App |
| `SUPPORT` | Customer service agent handling inquiries, ticket triage, and operational escalations. | Superadmin Dashboard (Restricted View) |
| `SUPERADMIN` | Platform executive or senior operations administrator with full platform governance. | Superadmin Web Dashboard |

### 1.2 Multi-Tenant Isolation & Location Scoping
- **Host Business Multi-Tenancy:** Host data is strictly isolated by `business_id`. Host owners can never view bookings, earnings, or customer details belonging to other host businesses (`BR-052`).
- **Staff Location Scoping:** Host staff members are restricted to specific locations configured in their `HostStaffMembership.assigned_location_ids`. Staff cannot perform check-ins or view bookings for unassigned branches (`BR-053`).
- **Separation of Custody & Dispute Resolution:** Host staff can verify bag custody and release luggage, but cannot modify platform financial ledgers or initiate dispute clawbacks.

---

## 2. Platform Support vs. Superadmin Separation (`OQ-011`, `OQ-016`)

In strict compliance with owner decisions `OQ-011` and `OQ-016`, operational customer support agents (`SUPPORT`) are strictly partitioned from platform superadministrators (`SUPERADMIN`).

```
+-----------------------------------------------------------------------------------------+
| ROLE BOUNDARY ENFORCEMENT                                                               |
+-----------------------------------------------------------------------------------------+
| CAPABILITY / ACTION               | SUPPORT AGENT            | SUPERADMIN               |
+-----------------------------------+--------------------------+--------------------------+
| View Ticket Queues & Messages     | ALLOWED (Full Triage)    | ALLOWED                  |
| View Booking & Custody Status     | ALLOWED (Read-Only)      | ALLOWED (Read/Write)     |
| View Masked Traveller / Host Info | ALLOWED (Ticket Context) | ALLOWED (Full Details)   |
| Add Internal Notes to Tickets     | ALLOWED                  | ALLOWED                  |
| Escalate to Superadmin            | ALLOWED                  | N/A                      |
|                                   |                          |                          |
| Approve Host KYC / Onboarding     | STRICTLY PROHIBITED      | ALLOWED                  |
| Authorize / Issue Refunds         | STRICTLY PROHIBITED      | ALLOWED                  |
| Execute Manual Host Payouts       | STRICTLY PROHIBITED      | ALLOWED                  |
| Alter Double-Entry Ledgers        | STRICTLY PROHIBITED      | ALLOWED (Reconciliation) |
| Modify System Tax / Commission    | STRICTLY PROHIBITED      | ALLOWED                  |
| Change User Roles / Admin Accts   | STRICTLY PROHIBITED      | ALLOWED                  |
+-----------------------------------------------------------------------------------------+
```

---

## 3. Comprehensive RBAC Permissions Matrix

The following matrix documents operational permissions across system resources:

| Domain / Resource | Action / Permission | `ANONYMOUS` | `TRAVELLER` | `HOST_OWNER` | `HOST_STAFF` | `SUPPORT` | `SUPERADMIN` | Governance Rules & Invariants |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Locations & Search** | Search & view public listings | `YES` | `YES` | `YES` | `YES` | `YES` | `YES` | Public search results return jittered coordinates (`BR-088`). |
| | View exact address & GPS | `NO` | Owner Only* | Business Only | Assigned Only | `YES` | `YES` | *Exact address only visible to Traveller after confirmed booking. |
| | Create / edit location profile | `NO` | `NO` | Business Only | `NO` | `NO` | `YES` | Requires host verification before going live. |
| | Verify / approve location live | `NO` | `NO` | `NO` | `NO` | `NO` | `YES` | Superadmin quality and safety sign-off. |
| **Capacity & Schedule** | Configure capacity pools & zones | `NO` | `NO` | Business Only | `NO` | `NO` | `YES` | Host owner configures physical storage zones. |
| | Set weekly opening hours | `NO` | `NO` | Business Only | `NO` | `NO` | `YES` | Defines allowable drop-off/pickup intervals. |
| | Add holiday / special closures | `NO` | `NO` | Business Only | `NO` | `NO` | `YES` | Overrides regular operating schedules. |
| **Pricing & Policies** | Configure base storage rates | `NO` | `NO` | Business Only | `NO` | `NO` | `YES` | Defined in integer minor units (LKR). |
| | Set category multipliers | `NO` | `NO` | Business Only | `NO` | `NO` | `YES` | Host can set multipliers for bag sizes. |
| | Create platform promo codes | `NO` | `NO` | `NO` | `NO` | `NO` | `YES` | Superadmin controls platform marketing spend. |
| **Bookings** | Create booking draft & hold | `NO` | `YES` | `NO` | `NO` | `NO` | `YES` | Traveller initiates reservation hold (TTL). |
| | Accept / reject booking request | `NO` | `NO` | Business Only | Assigned Only | `NO` | `YES` | Required for `HOST_APPROVAL` mode. |
| | View booking details | `NO` | Owner Only | Business Only | Assigned Only | `YES` | `YES` | Support sees masked data unless active ticket. |
| | Cancel booking (pre-check-in) | `NO` | Owner Only | Business Only | `NO` | `NO` | `YES` | Triggers refund policy evaluation engine. |
| **Payments** | Initiate gateway checkout | `NO` | Owner Only | `NO` | `NO` | `NO` | `NO` | Traveller pays via pre-signed gateway form. |
| | View payment transaction details | `NO` | Owner Only | `NO` | `NO` | Read Only | `YES` | Gateway logs, status, transaction IDs. |
| | Process / authorize refunds | `NO` | `NO` | `NO` | `NO` | `PROHIBITED` | `YES` | Strict Superadmin financial privilege. |
| **Custody & Handover** | View check-in QR & PIN | `NO` | Owner Only | `NO` | `NO` | `NO` | `YES` | Issued upon booking confirmation. |
| | Scan QR / enter PIN for Check-in | `NO` | `NO` | Business Only | Assigned Only | `NO` | `YES` | Verifies bag count and initiates custody. |
| | Upload check-in photo evidence | `NO` | `NO` | Business Only | Assigned Only | `NO` | `YES` | Documents bag condition at handover. |
| | Scan QR / verify Check-out | `NO` | `NO` | Business Only | Assigned Only | `NO` | `YES` | Completes storage; triggers completion. |
| | Release overdue / disputed bags | `NO` | `NO` | Business Only | Assigned Only | `NO` | `YES` | **Mandatory Release (No Possessory Lien).** |
| **Host Finance & Payouts**| View host earnings & ledger | `NO` | `NO` | Business Only | `NO` | `NO` | `YES` | Staff cannot see financial revenue or bank info. |
| | Update payout bank account | `NO` | `NO` | Business Only | `NO` | `NO` | `YES` | Triggers re-verification and audit alert. |
| | Generate payout batch run | `NO` | `NO` | `NO` | `NO` | `PROHIBITED` | `YES` | Superadmin financial disbursement. |
| | Execute manual bank payout | `NO` | `NO` | `NO` | `NO` | `PROHIBITED` | `YES` | Superadmin records bank transfer reference. |
| **Reviews & Feedback** | Submit review for booking | `NO` | Owner Only | `NO` | `NO` | `NO` | `NO` | Allowed once within 14 days of completion. |
| | Moderate / unpublish reviews | `NO` | `NO` | `NO` | `NO` | Read Only | `YES` | Superadmin removes abusive or spam reviews. |
| **Support & Disputes** | Create support ticket | `NO` | `YES` | `YES` | `NO` | `YES` | `YES` | Inquiries routed by category (`OQ-016`). |
| | Triage, reply, and assign ticket | `NO` | `NO` | `NO` | `NO` | `YES` | `YES` | Customer support operational queue. |
| | Resolve customer ticket | `NO` | `NO` | `NO` | `NO` | `YES` | `YES` | Closes ticket with resolution summary. |
| **Platform Administration**| Manage admin & staff user roles | `NO` | `NO` | `NO` | `NO` | `PROHIBITED` | `YES` | Superadmin user management. |
| | View security & audit logs | `NO` | `NO` | `NO` | `NO` | `NO` | `YES` | Immutable security audit trail. |
| | Configure platform commission | `NO` | `NO` | `NO` | `NO` | `PROHIBITED` | `YES` | Commission rate adjustments (Fixed 15% MVP). |

---

## 4. Sensitive Data Visibility & Masking Standards

To protect personal privacy and comply with data protection legislation (Sri Lanka PDPA, GDPR):

1. **Payment Card Information:** Zero credit card numbers or CVVs ever touch or enter the platform database. Payments are processed via PCI-DSS compliant hosted fields/redirects (`ADR-008`). Only masked last-4 digits and provider tokens are stored.
2. **Exact Storage Addresses:** Unauthenticated visitors and searchers see approximate locations (jittered coordinate offset $\sim 150	ext{m}$–$300	ext{m}$). The exact street address and contact telephone number are revealed **only upon confirmed booking payment** (`BR-088`).
3. **Traveller Identity Masking for Hosts:** Hosts see the traveller's first name, last initial, and verified mobile number for check-in coordination. Full email and payment instruments are never exposed to hosts.
4. **Staff Masking:** Host staff members cannot view host bank details, payout histories, or gross revenue figures.

---

## 5. Security Audit Logging Invariants

Any privileged, financial, or authentication state modification **must emit an immutable audit event** to `audit_logs` (`BR-087`):
- All login successes and authentication failures.
- Host verification status changes (Approval, Rejection, Suspension).
- Bank account details added or modified.
- Manual payout batch generation and completion.
- Discretionary refund authorizations and gateway retries.
- Administrative role assignments and revocations.
