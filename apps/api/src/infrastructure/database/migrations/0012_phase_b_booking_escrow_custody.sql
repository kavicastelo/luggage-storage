-- Migration: 0012_phase_b_booking_escrow_custody.sql
-- Description:
--   Phase B — Booking, Settlement Ledger & Custody Engine (Forward-Only Migration)
--   1. Creates bookings, booking_items, booking_status_history, capacity_reservations, booking_pricing_snapshots.
--   2. Creates payment_intents, payment_transactions, payment_webhook_events, refund_records.
--   3. Creates financial_ledger_entries, host_payables (non-escrow double-entry settlement ledger).
--   4. Creates custody_records, custody_tokens, bag_custody_items, custody_events.
--   5. Enforces append-only immutability triggers & least-privilege grants on historical/audit/ledger tables.
--   6. Seeds Phase B RBAC permissions and maps role boundaries (OQ-011 & OQ-017).

-- 1. Bookings Table
CREATE TABLE IF NOT EXISTS "bookings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reference_code" varchar(32) NOT NULL,
  "idempotency_key" varchar(128),
  "traveller_user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE restrict,
  "business_id" uuid NOT NULL REFERENCES "public"."host_businesses"("id") ON DELETE restrict,
  "location_id" uuid NOT NULL REFERENCES "public"."storage_locations"("id") ON DELETE restrict,
  "booking_mode" varchar(32) NOT NULL,
  "status" varchar(32) NOT NULL,
  "drop_off_at" timestamptz NOT NULL,
  "collection_at" timestamptz NOT NULL,
  "total_bags" integer NOT NULL,
  "total_capacity_units" integer NOT NULL,
  "currency" varchar(3) DEFAULT 'LKR' NOT NULL,
  "total_amount_minor" integer NOT NULL,
  "hold_expires_at" timestamptz,
  "host_approved_at" timestamptz,
  "host_approved_by" uuid REFERENCES "public"."users"("id") ON DELETE set null,
  "host_rejected_at" timestamptz,
  "host_rejection_reason" text,
  "confirmed_at" timestamptz,
  "checked_in_at" timestamptz,
  "completed_at" timestamptz,
  "cancelled_at" timestamptz,
  "cancelled_by_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null,
  "cancellation_reason" text,
  "exception_reason" text,
  "traveller_notes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "bookings_mode_check" CHECK ("booking_mode" IN ('INSTANT', 'HOST_APPROVAL')),
  CONSTRAINT "bookings_status_check" CHECK ("status" IN (
    'PENDING_HOST_APPROVAL',
    'PENDING_PAYMENT',
    'CONFIRMED',
    'IN_STORAGE',
    'COMPLETED',
    'CANCELLED_BY_TRAVELLER',
    'CANCELLED_BY_HOST',
    'CANCELLED_BY_PLATFORM',
    'REJECTED',
    'EXPIRED',
    'DISPUTED'
  )),
  CONSTRAINT "bookings_window_check" CHECK ("collection_at" > "drop_off_at"),
  CONSTRAINT "bookings_total_bags_check" CHECK ("total_bags" > 0),
  CONSTRAINT "bookings_total_units_check" CHECK ("total_capacity_units" > 0),
  CONSTRAINT "bookings_total_amount_check" CHECK ("total_amount_minor" >= 0)
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "bookings_reference_code_unique" ON "bookings" ("reference_code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bookings_traveller_idempotency_unique" ON "bookings" ("traveller_user_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_traveller_user_id_idx" ON "bookings" ("traveller_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_business_id_idx" ON "bookings" ("business_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_location_window_idx" ON "bookings" ("location_id", "drop_off_at", "collection_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_status_hold_expires_idx" ON "bookings" ("status", "hold_expires_at");--> statement-breakpoint

-- 2. Booking Items Table
CREATE TABLE IF NOT EXISTS "booking_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "booking_id" uuid NOT NULL REFERENCES "public"."bookings"("id") ON DELETE restrict,
  "bag_category" varchar(32) NOT NULL,
  "quantity" integer NOT NULL,
  "capacity_units" integer NOT NULL,
  "unit_rate_minor" integer NOT NULL,
  "line_total_minor" integer NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "booking_items_category_check" CHECK ("bag_category" IN ('BAG_SMALL', 'BAG_MEDIUM', 'BAG_LARGE', 'BAG_OVERSIZED')),
  CONSTRAINT "booking_items_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "booking_items_units_check" CHECK ("capacity_units" > 0),
  CONSTRAINT "booking_items_unit_rate_check" CHECK ("unit_rate_minor" >= 0),
  CONSTRAINT "booking_items_line_total_check" CHECK ("line_total_minor" >= 0)
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "booking_items_booking_id_idx" ON "booking_items" ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "booking_items_booking_category_unique" ON "booking_items" ("booking_id", "bag_category");--> statement-breakpoint

-- 3. Booking Status History Table (Append-Only)
CREATE TABLE IF NOT EXISTS "booking_status_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "booking_id" uuid NOT NULL REFERENCES "public"."bookings"("id") ON DELETE restrict,
  "previous_status" varchar(32),
  "new_status" varchar(32) NOT NULL,
  "actor_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null,
  "actor_role" varchar(32) NOT NULL,
  "reason" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "booking_status_history_booking_id_idx" ON "booking_status_history" ("booking_id", "created_at");--> statement-breakpoint

-- 4. Capacity Reservations Table
CREATE TABLE IF NOT EXISTS "capacity_reservations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "booking_id" uuid NOT NULL REFERENCES "public"."bookings"("id") ON DELETE restrict,
  "location_id" uuid NOT NULL REFERENCES "public"."storage_locations"("id") ON DELETE restrict,
  "pool_id" uuid NOT NULL REFERENCES "public"."storage_capacity_pools"("id") ON DELETE restrict,
  "bag_category" varchar(32),
  "units_reserved" integer NOT NULL,
  "status" varchar(32) NOT NULL,
  "expires_at" timestamptz,
  "released_at" timestamptz,
  "release_reason" varchar(64),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "capacity_reservations_units_check" CHECK ("units_reserved" > 0),
  CONSTRAINT "capacity_reservations_status_check" CHECK ("status" IN (
    'HELD_FOR_HOST_APPROVAL',
    'HELD_FOR_PAYMENT',
    'CONFIRMED',
    'RELEASED'
  ))
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "capacity_reservations_booking_id_idx" ON "capacity_reservations" ("booking_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacity_reservations_pool_status_idx" ON "capacity_reservations" ("pool_id", "status", "expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "capacity_reservations_location_status_idx" ON "capacity_reservations" ("location_id", "status");--> statement-breakpoint

-- 5. Booking Pricing Snapshots Table (Immutable)
CREATE TABLE IF NOT EXISTS "booking_pricing_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "booking_id" uuid NOT NULL REFERENCES "public"."bookings"("id") ON DELETE restrict,
  "policy_id" uuid REFERENCES "public"."pricing_policies"("id") ON DELETE set null,
  "currency" varchar(3) DEFAULT 'LKR' NOT NULL,
  "currency_exponent" integer DEFAULT 2 NOT NULL,
  "pricing_unit" varchar(32) NOT NULL,
  "base_rate_minor" integer NOT NULL,
  "duration_units" integer NOT NULL,
  "items_breakdown" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "gross_storage_minor" integer NOT NULL,
  "discount_minor" integer DEFAULT 0 NOT NULL,
  "storage_subtotal_minor" integer NOT NULL,
  "commission_rate_bps" integer DEFAULT 1500 NOT NULL,
  "platform_commission_minor" integer NOT NULL,
  "host_payable_minor" integer NOT NULL,
  "tax_rate_bps" integer DEFAULT 0 NOT NULL,
  "tax_amount_minor" integer DEFAULT 0 NOT NULL,
  "total_amount_minor" integer NOT NULL,
  "cancellation_policy_code" varchar(64) DEFAULT 'STANDARD_FLEX_2H' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "booking_pricing_snapshots_unit_check" CHECK ("pricing_unit" IN ('CALENDAR_DAY', '24_HOUR_BLOCK')),
  CONSTRAINT "booking_pricing_snapshots_duration_check" CHECK ("duration_units" > 0),
  CONSTRAINT "booking_pricing_snapshots_split_check" CHECK ("platform_commission_minor" + "host_payable_minor" = "storage_subtotal_minor"),
  CONSTRAINT "booking_pricing_snapshots_total_check" CHECK ("storage_subtotal_minor" + "tax_amount_minor" = "total_amount_minor")
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "booking_pricing_snapshots_booking_id_unique" ON "booking_pricing_snapshots" ("booking_id");--> statement-breakpoint

-- 6. Payment Intents Table
CREATE TABLE IF NOT EXISTS "payment_intents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "booking_id" uuid NOT NULL REFERENCES "public"."bookings"("id") ON DELETE restrict,
  "traveller_user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE restrict,
  "provider" varchar(32) NOT NULL,
  "idempotency_key" varchar(128),
  "provider_order_id" varchar(128) NOT NULL,
  "amount_minor" integer NOT NULL,
  "currency" varchar(3) DEFAULT 'LKR' NOT NULL,
  "status" varchar(32) DEFAULT 'INITIATED' NOT NULL,
  "checkout_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "verified_at" timestamptz,
  "failure_reason" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "payment_intents_provider_check" CHECK ("provider" IN ('SANDBOX_GATEWAY', 'PAYHERE')),
  CONSTRAINT "payment_intents_status_check" CHECK ("status" IN (
    'INITIATED',
    'PENDING_GATEWAY',
    'SUCCEEDED',
    'FAILED',
    'EXPIRED',
    'ORPHANED_SUCCEEDED'
  )),
  CONSTRAINT "payment_intents_amount_check" CHECK ("amount_minor" > 0)
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "payment_intents_provider_order_unique" ON "payment_intents" ("provider_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_intents_booking_idempotency_unique" ON "payment_intents" ("booking_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_intents_booking_id_idx" ON "payment_intents" ("booking_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_intents_traveller_id_idx" ON "payment_intents" ("traveller_user_id");--> statement-breakpoint

-- 7. Payment Transactions Table
CREATE TABLE IF NOT EXISTS "payment_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "payment_intent_id" uuid NOT NULL REFERENCES "public"."payment_intents"("id") ON DELETE restrict,
  "booking_id" uuid NOT NULL REFERENCES "public"."bookings"("id") ON DELETE restrict,
  "provider" varchar(32) NOT NULL,
  "provider_transaction_id" varchar(128) NOT NULL,
  "transaction_type" varchar(32) DEFAULT 'CHARGE' NOT NULL,
  "status" varchar(32) NOT NULL,
  "amount_minor" integer NOT NULL,
  "currency" varchar(3) DEFAULT 'LKR' NOT NULL,
  "raw_status_code" varchar(32),
  "signature_verified" boolean DEFAULT false NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "payment_transactions_type_check" CHECK ("transaction_type" IN ('CHARGE', 'REFUND')),
  CONSTRAINT "payment_transactions_status_check" CHECK ("status" IN ('SUCCEEDED', 'FAILED', 'PENDING')),
  CONSTRAINT "payment_transactions_amount_check" CHECK ("amount_minor" > 0)
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "payment_transactions_provider_tx_unique" ON "payment_transactions" ("provider", "provider_transaction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_transactions_booking_id_idx" ON "payment_transactions" ("booking_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_transactions_intent_id_idx" ON "payment_transactions" ("payment_intent_id");--> statement-breakpoint

-- 8. Payment Webhook Events Table
CREATE TABLE IF NOT EXISTS "payment_webhook_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" varchar(32) NOT NULL,
  "event_id" varchar(128) NOT NULL,
  "payload_hash" varchar(64) NOT NULL,
  "payment_intent_id" uuid REFERENCES "public"."payment_intents"("id") ON DELETE set null,
  "processing_outcome" varchar(64) NOT NULL,
  "received_at" timestamptz DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "payment_webhook_events_provider_event_unique" ON "payment_webhook_events" ("provider", "event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_webhook_events_intent_id_idx" ON "payment_webhook_events" ("payment_intent_id");--> statement-breakpoint

-- 9. Refund Records Table (OQ-013 7-Stage Lifecycle)
CREATE TABLE IF NOT EXISTS "refund_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "booking_id" uuid NOT NULL REFERENCES "public"."bookings"("id") ON DELETE restrict,
  "payment_intent_id" uuid REFERENCES "public"."payment_intents"("id") ON DELETE restrict,
  "amount_minor" integer NOT NULL,
  "currency" varchar(3) DEFAULT 'LKR' NOT NULL,
  "refund_percentage" integer NOT NULL,
  "reason_category" varchar(64) NOT NULL,
  "status" varchar(32) DEFAULT 'REQUESTED' NOT NULL,
  "provider_refund_id" varchar(128),
  "requested_by_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null,
  "authorized_by_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null,
  "notes" text,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "refund_records_amount_check" CHECK ("amount_minor" >= 0),
  CONSTRAINT "refund_records_pct_check" CHECK ("refund_percentage" >= 0 AND "refund_percentage" <= 100),
  CONSTRAINT "refund_records_reason_check" CHECK ("reason_category" IN (
    'TRAVELLER_CANCELLATION',
    'HOST_CANCELLATION',
    'PLATFORM_CANCELLATION',
    'LATE_WEBHOOK_EXPIRED_HOLD',
    'DISPUTE_RESOLUTION'
  )),
  CONSTRAINT "refund_records_status_check" CHECK ("status" IN (
    'REQUESTED',
    'AUTHORIZED',
    'INITIATED',
    'PROCESSING',
    'SUCCEEDED',
    'FAILED',
    'MANUAL_REVIEW_REQUIRED'
  ))
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "refund_records_booking_id_idx" ON "refund_records" ("booking_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refund_records_status_idx" ON "refund_records" ("status");--> statement-breakpoint

-- 10. Financial Ledger Entries Table (Append-Only Double-Entry Journal)
CREATE TABLE IF NOT EXISTS "financial_ledger_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "transaction_group_id" uuid NOT NULL,
  "entry_type" varchar(16) NOT NULL,
  "account_code" varchar(32) NOT NULL,
  "account_name" varchar(128) NOT NULL,
  "amount_minor" integer NOT NULL,
  "currency" varchar(3) DEFAULT 'LKR' NOT NULL,
  "reference_type" varchar(32) NOT NULL,
  "reference_id" uuid NOT NULL,
  "booking_id" uuid NOT NULL REFERENCES "public"."bookings"("id") ON DELETE restrict,
  "business_id" uuid REFERENCES "public"."host_businesses"("id") ON DELETE restrict,
  "description" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "posted_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "financial_ledger_entries_type_check" CHECK ("entry_type" IN ('DEBIT', 'CREDIT')),
  CONSTRAINT "financial_ledger_entries_amount_check" CHECK ("amount_minor" > 0),
  CONSTRAINT "financial_ledger_entries_ref_type_check" CHECK ("reference_type" IN ('BOOKING', 'PAYMENT', 'REFUND', 'HOST_PAYABLE'))
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "financial_ledger_entries_group_id_idx" ON "financial_ledger_entries" ("transaction_group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_ledger_entries_booking_id_idx" ON "financial_ledger_entries" ("booking_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_ledger_entries_business_id_idx" ON "financial_ledger_entries" ("business_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_ledger_entries_account_code_idx" ON "financial_ledger_entries" ("account_code");--> statement-breakpoint

-- 11. Host Payables Table
CREATE TABLE IF NOT EXISTS "host_payables" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL REFERENCES "public"."host_businesses"("id") ON DELETE restrict,
  "booking_id" uuid NOT NULL REFERENCES "public"."bookings"("id") ON DELETE restrict,
  "gross_subtotal_minor" integer NOT NULL,
  "commission_minor" integer NOT NULL,
  "net_payable_minor" integer NOT NULL,
  "currency" varchar(3) DEFAULT 'LKR' NOT NULL,
  "status" varchar(32) DEFAULT 'ACCRUED' NOT NULL,
  "accrued_at" timestamptz DEFAULT now() NOT NULL,
  "eligible_at" timestamptz,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "host_payables_gross_check" CHECK ("gross_subtotal_minor" >= 0),
  CONSTRAINT "host_payables_commission_check" CHECK ("commission_minor" >= 0),
  CONSTRAINT "host_payables_net_check" CHECK ("net_payable_minor" >= 0),
  CONSTRAINT "host_payables_split_check" CHECK ("commission_minor" + "net_payable_minor" = "gross_subtotal_minor"),
  CONSTRAINT "host_payables_status_check" CHECK ("status" IN ('ACCRUED', 'ON_HOLD', 'ELIGIBLE', 'PAID', 'CANCELLED_CLAWBACK'))
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "host_payables_booking_id_unique" ON "host_payables" ("booking_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "host_payables_business_status_idx" ON "host_payables" ("business_id", "status");--> statement-breakpoint

-- 12. Custody Records Table
CREATE TABLE IF NOT EXISTS "custody_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "booking_id" uuid NOT NULL REFERENCES "public"."bookings"("id") ON DELETE restrict,
  "location_id" uuid NOT NULL REFERENCES "public"."storage_locations"("id") ON DELETE restrict,
  "business_id" uuid NOT NULL REFERENCES "public"."host_businesses"("id") ON DELETE restrict,
  "status" varchar(32) DEFAULT 'EXPECTED' NOT NULL,
  "checkin_pin_hash" varchar(64),
  "collection_pin_hash" varchar(64),
  "expected_bag_count" integer NOT NULL,
  "checked_in_bag_count" integer,
  "released_bag_count" integer,
  "zone_id" uuid REFERENCES "public"."storage_zones"("id") ON DELETE set null,
  "check_in_at" timestamptz,
  "check_in_staff_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null,
  "check_out_at" timestamptz,
  "check_out_staff_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null,
  "handover_condition" varchar(32) DEFAULT 'NORMAL' NOT NULL,
  "overdue_minutes" integer DEFAULT 0 NOT NULL,
  "overdue_fee_minor" integer DEFAULT 0 NOT NULL,
  "exception_notes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "custody_records_expected_bags_check" CHECK ("expected_bag_count" > 0),
  CONSTRAINT "custody_records_status_check" CHECK ("status" IN (
    'EXPECTED',
    'CHECKED_IN',
    'IN_STORAGE',
    'OVERDUE',
    'RELEASED_TO_TRAVELLER',
    'DISPUTED_RELEASE',
    'ABANDONED'
  )),
  CONSTRAINT "custody_records_condition_check" CHECK ("handover_condition" IN ('NORMAL', 'UNPAID_FEES_PENDING', 'EXCEPTION_RECORDED')),
  CONSTRAINT "custody_records_overdue_minutes_check" CHECK ("overdue_minutes" >= 0),
  CONSTRAINT "custody_records_overdue_fee_check" CHECK ("overdue_fee_minor" >= 0)
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "custody_records_booking_id_unique" ON "custody_records" ("booking_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "custody_records_location_status_idx" ON "custody_records" ("location_id", "status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "custody_records_business_status_idx" ON "custody_records" ("business_id", "status");--> statement-breakpoint

-- 13. Custody Tokens Table (Hashed CSPRNG Tokens & PINs)
CREATE TABLE IF NOT EXISTS "custody_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "custody_record_id" uuid NOT NULL REFERENCES "public"."custody_records"("id") ON DELETE restrict,
  "booking_id" uuid NOT NULL REFERENCES "public"."bookings"("id") ON DELETE restrict,
  "operation" varchar(32) NOT NULL,
  "token_hash" varchar(64) NOT NULL,
  "pin_hash" varchar(64) NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "consumed_at" timestamptz,
  "consumed_by_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null,
  "revoked_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "custody_tokens_operation_check" CHECK ("operation" IN ('CHECK_IN', 'COLLECTION'))
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "custody_tokens_token_hash_unique" ON "custody_tokens" ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "custody_tokens_booking_op_idx" ON "custody_tokens" ("booking_id", "operation");--> statement-breakpoint

-- 14. Bag Custody Items Table
CREATE TABLE IF NOT EXISTS "bag_custody_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "custody_record_id" uuid NOT NULL REFERENCES "public"."custody_records"("id") ON DELETE restrict,
  "bag_tag_code" varchar(64) NOT NULL,
  "bag_category" varchar(32) NOT NULL,
  "security_seal_number" varchar(64),
  "zone_id" uuid REFERENCES "public"."storage_zones"("id") ON DELETE set null,
  "photo_file_key" varchar(512),
  "condition_notes" text,
  "checked_in_at" timestamptz DEFAULT now() NOT NULL,
  "released_at" timestamptz,
  CONSTRAINT "bag_custody_items_category_check" CHECK ("bag_category" IN ('BAG_SMALL', 'BAG_MEDIUM', 'BAG_LARGE', 'BAG_OVERSIZED'))
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "bag_custody_items_record_tag_unique" ON "bag_custody_items" ("custody_record_id", "bag_tag_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bag_custody_items_custody_id_idx" ON "bag_custody_items" ("custody_record_id");--> statement-breakpoint

-- 15. Custody Events Table (Append-Only)
CREATE TABLE IF NOT EXISTS "custody_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "custody_record_id" uuid NOT NULL REFERENCES "public"."custody_records"("id") ON DELETE restrict,
  "booking_id" uuid NOT NULL REFERENCES "public"."bookings"("id") ON DELETE restrict,
  "event_type" varchar(64) NOT NULL,
  "previous_status" varchar(32),
  "new_status" varchar(32) NOT NULL,
  "actor_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null,
  "actor_role" varchar(32) NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "custody_events_custody_record_idx" ON "custody_events" ("custody_record_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "custody_events_booking_id_idx" ON "custody_events" ("booking_id");--> statement-breakpoint

-- 16. Append-Only Immutability Enforcement Triggers & Privilege Hardening
CREATE OR REPLACE FUNCTION public.prevent_phase_b_immutable_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Table %.% is append-only immutable: % is prohibited', TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP;
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.prevent_phase_b_immutable_mutation() FROM PUBLIC;--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'luggage_user') THEN
    GRANT EXECUTE ON FUNCTION public.prevent_phase_b_immutable_mutation() TO luggage_user;
    REVOKE UPDATE, DELETE, TRUNCATE ON TABLE
      public.booking_status_history,
      public.booking_pricing_snapshots,
      public.financial_ledger_entries,
      public.custody_events
    FROM luggage_user;
    GRANT SELECT, INSERT ON TABLE
      public.booking_status_history,
      public.booking_pricing_snapshots,
      public.financial_ledger_entries,
      public.custody_events
    TO luggage_user;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'luggage_migrator') THEN
    GRANT EXECUTE ON FUNCTION public.prevent_phase_b_immutable_mutation() TO luggage_migrator;
  END IF;
END $$;--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_immutable_booking_status_history ON public.booking_status_history;--> statement-breakpoint
CREATE TRIGGER trg_immutable_booking_status_history
BEFORE UPDATE OR DELETE ON public.booking_status_history
FOR EACH ROW EXECUTE FUNCTION public.prevent_phase_b_immutable_mutation();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_immutable_booking_pricing_snapshots ON public.booking_pricing_snapshots;--> statement-breakpoint
CREATE TRIGGER trg_immutable_booking_pricing_snapshots
BEFORE UPDATE OR DELETE ON public.booking_pricing_snapshots
FOR EACH ROW EXECUTE FUNCTION public.prevent_phase_b_immutable_mutation();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_immutable_financial_ledger_entries ON public.financial_ledger_entries;--> statement-breakpoint
CREATE TRIGGER trg_immutable_financial_ledger_entries
BEFORE UPDATE OR DELETE ON public.financial_ledger_entries
FOR EACH ROW EXECUTE FUNCTION public.prevent_phase_b_immutable_mutation();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_immutable_custody_events ON public.custody_events;--> statement-breakpoint
CREATE TRIGGER trg_immutable_custody_events
BEFORE UPDATE OR DELETE ON public.custody_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_phase_b_immutable_mutation();--> statement-breakpoint

-- 17. Seed Phase B RBAC Permissions & Role Boundaries (OQ-011 & OQ-017)
INSERT INTO "permissions" (code, name, description, module)
VALUES
  ('bookings.create', 'Create Booking', 'Create storage reservations and request payment intents', 'bookings'),
  ('bookings.read_own', 'Read Own Bookings', 'View own traveller bookings, receipts, and custody passes', 'bookings'),
  ('bookings.cancel_own', 'Cancel Own Booking', 'Cancel own booking and request eligible policy refund', 'bookings'),
  ('hosts.bookings.read_own', 'Read Location Bookings', 'View bookings for owned or assigned storage locations', 'bookings'),
  ('hosts.bookings.manage_own', 'Manage Location Bookings', 'Accept, reject, or cancel bookings for owned or assigned storage locations', 'bookings'),
  ('hosts.custody.operate', 'Operate Luggage Custody', 'Verify QR/PIN custody passes and execute bag check-in and collection release', 'custody'),
  ('hosts.finance.read_own', 'Read Host Payables', 'View host settlement payables and commission statements', 'finance'),
  ('admin.booking.read', 'Read All Bookings', 'Inspect global marketplace bookings, history, and custody timeline', 'admin'),
  ('admin.booking.manage', 'Manage Platform Bookings', 'Execute platform-level booking cancellations and dispute overrides', 'admin'),
  ('admin.payment.read', 'Read Payment Transactions', 'Inspect payment intents, gateway transactions, and webhook logs', 'admin'),
  ('admin.refund.read', 'Read Refund Queue', 'View customer refund records and lifecycle status', 'admin'),
  ('admin.refund.manage', 'Authorize & Transition Refunds', 'Authorize, initiate, complete, or flag customer refunds', 'admin')
ON CONFLICT (code) DO NOTHING;--> statement-breakpoint

DO $$
DECLARE
  v_superadmin_id uuid;
  v_support_id uuid;
  v_host_owner_id uuid;
  v_host_staff_id uuid;
  v_traveller_id uuid;
BEGIN
  -- SUPERADMIN receives ALL permissions
  SELECT id INTO v_superadmin_id FROM public.roles WHERE code = 'SUPERADMIN';
  IF v_superadmin_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_superadmin_id, p.id FROM public.permissions p
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- SUPPORT receives read-only booking/payment/refund visibility, NEVER refund/financial mutation (OQ-011)
  SELECT id INTO v_support_id FROM public.roles WHERE code = 'SUPPORT';
  IF v_support_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_support_id, p.id FROM public.permissions p
    WHERE p.code IN (
      'bookings.read_own',
      'admin.booking.read',
      'admin.payment.read',
      'admin.refund.read'
    )
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- HOST_OWNER receives full host booking, custody, finance, and traveller booking capabilities
  SELECT id INTO v_host_owner_id FROM public.roles WHERE code = 'HOST_OWNER';
  IF v_host_owner_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_host_owner_id, p.id FROM public.permissions p
    WHERE p.code IN (
      'bookings.create',
      'bookings.read_own',
      'bookings.cancel_own',
      'hosts.bookings.read_own',
      'hosts.bookings.manage_own',
      'hosts.custody.operate',
      'hosts.finance.read_own'
    )
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- HOST_STAFF receives operational booking & custody permissions ONLY, NEVER hosts.finance.read_own (OQ-017)
  SELECT id INTO v_host_staff_id FROM public.roles WHERE code = 'HOST_STAFF';
  IF v_host_staff_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_host_staff_id, p.id FROM public.permissions p
    WHERE p.code IN (
      'bookings.create',
      'bookings.read_own',
      'bookings.cancel_own',
      'hosts.bookings.read_own',
      'hosts.bookings.manage_own',
      'hosts.custody.operate'
    )
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- TRAVELLER receives booking creation, own read, and own cancellation
  SELECT id INTO v_traveller_id FROM public.roles WHERE code = 'TRAVELLER';
  IF v_traveller_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_traveller_id, p.id FROM public.permissions p
    WHERE p.code IN (
      'bookings.create',
      'bookings.read_own',
      'bookings.cancel_own'
    )
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;
END $$;

