# Domain Event Catalogue

**Project:** Global Luggage Storage Marketplace  
**Document Type:** Domain Architecture Specification  
**Status:** Approved Phase 0C Baseline  
**Governing Documents:** ADR-001 (Modular Monolith), ADR-005 (PostgreSQL), Domain Boundaries (`domain-boundaries.md`), Business Rules Catalogue (`BR-001`–`BR-100`).

---

## 1. Architectural Strategy: Transactional Outbox Pattern

In accordance with our Modular Monolithic architecture (ADR-001), inter-module communication is asynchronous and decoupled via domain events. To guarantee reliability, prevent split-brain states, and ensure zero message loss during database crashes or network failures, all domain events are persisted using the **Transactional Outbox Pattern** (`BR-085`).

### 1.1 Outbox Schema & Delivery Guarantees
- **Atomicity:** When an aggregate root mutates state inside a PostgreSQL transaction, one or more domain event records are written to the `outbox_events` table within the **same** database transaction.
- **Delivery Guarantee:** **At-least-once delivery**. Consuming event handlers must implement idempotent consumption using the `event_id` and domain entity identifiers.
- **Dispatcher Process:** An asynchronous background worker polls the `outbox_events` table, dispatches events to registered in-process Fastify module listeners (or a message broker in multi-node deployments), and marks the event as `PUBLISHED`.

```sql
-- Outbox Event Table Schema Pattern
CREATE TABLE outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(128) NOT NULL,
    source_domain VARCHAR(64) NOT NULL,
    correlation_id UUID NOT NULL,
    causation_id UUID NULL,
    payload JSONB NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ NULL,
    retry_count INT NOT NULL DEFAULT 0,
    last_error TEXT NULL
);

CREATE INDEX idx_outbox_unpublished ON outbox_events (created_at) WHERE published_at IS NULL;
```

---

## 2. Standard Event Envelope Specification

Every domain event emitted across the platform adheres to a standardized JSON schema envelope:

```json
{
  "event_id": "018f4a3e-7b1c-7f52-89cd-4e9c1d6b0001",
  "event_type": "booking.confirmed",
  "source_domain": "bookings",
  "aggregate_type": "Booking",
  "aggregate_id": "018f4a3e-62d1-7a1a-a1b2-c3d4e5f60002",
  "correlation_id": "018f4a3e-51c0-7e11-9988-112233445566",
  "causation_id": "018f4a3e-5f99-7d23-bbcc-998877665544",
  "timestamp": "2026-11-07T03:54:00.000Z",
  "schema_version": 1,
  "payload": {},
  "metadata": {
    "actor_user_id": "018f4a3e-1111-7222-3333-444455556666",
    "actor_role": "TRAVELLER",
    "client_ip": "203.115.24.12",
    "user_agent": "LuggageStorageExpo/1.0.0"
  }
}
```

---

## 3. Comprehensive Domain Event Registry

The table below documents the complete catalogue of domain events across all 22 bounded domains:

| Event Type (`event_type`) | Source Domain | Producing Aggregate | Key Payload Attributes | Primary Consumers | Business Impact & Side Effects |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `identity.user.registered` | `identity` | `User` | `user_id`, `email`, `role`, `verification_token` | `notifications`, `audit` | Dispatches email verification link; logs user registration audit record. |
| `identity.user.authenticated` | `identity` | `Session` | `session_id`, `user_id`, `auth_method`, `ip_address` | `audit`, `security` | Records session activity; updates last login timestamp. |
| `identity.password.reset_requested` | `identity` | `User` | `user_id`, `email`, `reset_token`, `expires_at` | `notifications`, `audit` | Dispatches password reset email. |
| `traveller.profile.updated` | `travellers` | `TravellerProfile` | `traveller_id`, `user_id`, `phone_number`, `emergency_contact` | `audit` | Updates traveller metadata. |
| `host.application.submitted` | `hosts` | `HostBusiness` | `business_id`, `owner_user_id`, `business_name`, `entity_type` | `support`, `verification`, `notifications` | Places host into Superadmin review queue; sends submission acknowledgement. |
| `host.application.approved` | `hosts` | `HostBusiness` | `business_id`, `owner_user_id`, `approved_by_user_id` | `notifications`, `identity`, `audit` | Grants host owner privileges; sends onboarding approval email. |
| `host.application.rejected` | `hosts` | `HostBusiness` | `business_id`, `rejection_reason_code`, `notes` | `notifications`, `audit` | Notifies applicant of rejection with remedial instructions. |
| `staff.invitation.sent` | `staff` | `HostStaffMembership` | `invitation_id`, `business_id`, `email`, `role_scope` | `notifications`, `audit` | Sends staff invitation email with joining link. |
| `staff.invitation.accepted` | `staff` | `HostStaffMembership` | `membership_id`, `business_id`, `user_id`, `location_ids` | `audit`, `hosts` | Activates staff access to host mobile app and dashboard. |
| `location.created` | `locations` | `StorageLocation` | `location_id`, `business_id`, `name`, `latitude`, `longitude` | `discovery`, `audit` | Initializes location metadata; pending admin verification. |
| `location.verified` | `locations` | `StorageLocation` | `location_id`, `verified_by_user_id`, `status` | `discovery`, `notifications` | Indexes location in PostGIS spatial search; makes location live. |
| `location.deactivated` | `locations` | `StorageLocation` | `location_id`, `deactivation_reason` | `discovery`, `capacity`, `bookings` | Hides location from discovery search results; prevents new bookings. |
| `capacity.reservation.held` | `capacity` | `CapacityReservation` | `reservation_id`, `booking_id`, `location_id`, `units`, `expires_at` | `bookings` | Locks temporary capacity slots for 10/15 minutes. |
| `capacity.reservation.committed`| `capacity`| `CapacityReservation` | `reservation_id`, `booking_id`, `units` | `capacity` | Converts temporary hold into confirmed allocation upon payment. |
| `capacity.reservation.released` | `capacity` | `CapacityReservation` | `reservation_id`, `booking_id`, `units`, `reason` | `capacity`, `bookings` | Increments available capacity slots in bucket. |
| `pricing.rules.updated` | `pricing` | `PricingPolicy` | `location_id`, `base_rate_minor`, `category_multipliers` | `audit`, `discovery` | Invalidates search pricing caches. |
| `booking.created` | `bookings` | `Booking` | `booking_id`, `location_id`, `booking_mode`, `items`, `total_minor` | `capacity`, `notifications` | Triggers capacity hold; notifies host if `HOST_APPROVAL`. |
| `booking.host_accepted` | `bookings` | `Booking` | `booking_id`, `accepted_by_user_id`, `payment_deadline` | `payments`, `notifications` | Initializes payment checkout timer; alerts traveller to pay. |
| `booking.host_rejected` | `bookings` | `Booking` | `booking_id`, `rejected_by_user_id`, `reason_code` | `capacity`, `notifications` | Releases capacity hold; notifies traveller of rejection. |
| `booking.confirmed` | `bookings` | `Booking` | `booking_id`, `qr_payload`, `pin_code`, `drop_off_window` | `custody`, `capacity`, `notifications` | Generates custody record; creates permanent capacity; sends QR voucher. |
| `booking.cancelled` | `bookings` | `Booking` | `booking_id`, `cancelled_by_role`, `cancellation_reason` | `capacity`, `refunds`, `notifications` | Releases capacity; invokes refund policy evaluation engine. |
| `booking.expired` | `bookings` | `Booking` | `booking_id`, `expiration_reason` | `capacity`, `notifications` | Releases held capacity; notifies traveller and host. |
| `booking.completed` | `bookings` | `Booking` | `booking_id`, `actual_duration_hours`, `completed_at` | `revenue`, `reviews`, `notifications` | Triggers 85% host payable ledger entry; opens review window. |
| `payment.initiated` | `payments` | `Payment` | `payment_id`, `booking_id`, `amount_minor`, `currency` | `audit` | Logs outbound gateway checkout session. |
| `payment.verified` | `payments` | `Payment` | `payment_id`, `booking_id`, `gateway_tx_id`, `amount_minor` | `bookings`, `finance`, `audit` | Triggers booking confirmation; posts clearing deposit in ledger. |
| `payment.failed` | `payments` | `Payment` | `payment_id`, `booking_id`, `error_code`, `error_message` | `notifications`, `audit` | Alerts traveller to retry payment or use another card. |
| `refund.requested` | `refunds` | `Refund` | `refund_id`, `booking_id`, `requested_amount_minor`, `reason` | `audit`, `support` | Creates pending refund evaluation record. |
| `refund.authorized` | `refunds` | `Refund` | `refund_id`, `booking_id`, `authorized_by_user_id` | `refunds`, `finance` | Dispatches outbound refund request to payment provider API. |
| `refund.succeeded` | `refunds` | `Refund` | `refund_id`, `booking_id`, `gateway_refund_id`, `amount_minor` | `finance`, `notifications`, `audit` | Posts reversal entries in double-entry ledger; emails traveller. |
| `refund.failed` | `refunds` | `Refund` | `refund_id`, `error_code`, `requires_manual_review` | `support`, `admin`, `audit` | Flags refund for Superadmin manual bank transfer triage. |
| `revenue.commission.accrued` | `revenue` | `CommissionRecord` | `booking_id`, `commission_amount_minor`, `host_amount_minor` | `finance`, `hosts` | Updates host payable balance; records platform commission revenue. |
| `payout.batch.created` | `payouts` | `PayoutBatch` | `batch_id`, `host_count`, `total_payout_minor`, `created_by` | `admin`, `audit` | Prepares bank export file for Superadmin disbursement. |
| `payout.completed` | `payouts` | `PayoutBatch` | `batch_id`, `bank_reference_number`, `disbursed_at` | `finance`, `notifications`, `hosts` | Debits host payable account; issues payout receipts to hosts. |
| `custody.checked_in` | `custody` | `CustodyRecord` | `custody_id`, `booking_id`, `bag_count`, `photo_urls` | `bookings`, `notifications`, `audit` | Transfers physical custody; notifies traveller luggage is safe. |
| `custody.checked_out` | `custody` | `CustodyRecord` | `custody_id`, `booking_id`, `verified_by_user_id` | `bookings`, `capacity`, `notifications` | Completes storage; triggers final booking completion workflow. |
| `custody.overdue_flagged` | `custody` | `CustodyRecord` | `custody_id`, `booking_id`, `minutes_overdue`, `fee_minor` | `payments`, `notifications` | Dispatches overdue alert and payment link to traveller. |
| `custody.disputed_release` | `custody` | `CustodyRecord` | `custody_id`, `booking_id`, `unpaid_amount_minor`, `notes` | `support`, `audit`, `finance` | Luggage released without payment; flags account for debt review. |
| `review.submitted` | `reviews` | `Review` | `review_id`, `booking_id`, `location_id`, `rating`, `comment` | `locations`, `notifications`, `audit` | Re-calculates location average rating; pending moderation. |
| `review.moderated` | `reviews` | `Review` | `review_id`, `status` (`APPROVED` / `REJECTED`), `moderator_id` | `locations`, `audit` | Publishes approved review on public location listing. |
| `support.ticket.created` | `support` | `SupportTicket` | `ticket_id`, `user_id`, `booking_id`, `category`, `priority` | `notifications`, `support` | Routes ticket to support triage queue (`OQ-016`). |
| `support.ticket.resolved` | `support` | `SupportTicket` | `ticket_id`, `resolved_by_user_id`, `resolution_summary` | `notifications`, `audit` | Closes ticket; requests customer satisfaction feedback. |
| `verification.decision.recorded`| `verification`| `HostVerification`| `business_id`, `decision` (`VERIFIED`/`REJECTED`), `admin_id`| `hosts`, `notifications`, `audit` | Updates host KYC compliance status. |
| `finance.ledger_entry.posted` | `finance` | `LedgerEntry` | `entry_id`, `debit_account`, `credit_account`, `amount_minor` | `audit` | Enforces double-entry balance check; immutable log. |
| `audit.security_event.recorded`| `audit` | `AuditLog` | `log_id`, `event_type`, `severity`, `user_id`, `ip_address` | `admin` | Alerts security monitors of high-severity actions or failures. |

---

## 4. Idempotency & Delivery Guarantees

1. **Consumer Idempotency:** Every consumer maintains a local or shared `processed_events` table recording `(consumer_name, event_id, processed_at)`. If `event_id` exists, the handler acknowledges the event immediately without re-executing logic.
2. **Transactional Event Creation:** Events are written in the same database transaction as the aggregate state change. If the database rolls back, the event is never persisted or published.
3. **Dead-Letter Handling:** Events that fail processing after 5 retries are marked `FAILED` in `outbox_events` and trigger an alert to the Superadmin technical operations team.
