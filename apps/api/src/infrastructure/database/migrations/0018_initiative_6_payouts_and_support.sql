-- Initiative 6: Host Payout Batches & Customer/Host Support Tickets

-- 1. Payout Batches Table
CREATE TABLE IF NOT EXISTS "payout_batches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "batch_code" varchar(32) NOT NULL,
  "business_id" uuid NOT NULL REFERENCES "public"."host_businesses"("id") ON DELETE restrict,
  "currency" varchar(3) DEFAULT 'LKR' NOT NULL,
  "item_count" integer NOT NULL,
  "total_gross_minor" integer NOT NULL,
  "total_commission_minor" integer NOT NULL,
  "total_net_payable_minor" integer NOT NULL,
  "status" varchar(32) DEFAULT 'GENERATED' NOT NULL,
  "payout_bank_name" varchar(128),
  "payout_branch_code" varchar(32),
  "payout_account_name" varchar(128),
  "payout_account_masked" varchar(64),
  "payout_method" varchar(32) DEFAULT 'CEFT_SLIPS' NOT NULL,
  "payout_reference" varchar(128),
  "notes" text,
  "ledger_transaction_group_id" uuid,
  "generated_by_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null,
  "disbursed_by_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null,
  "disbursed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "payout_batches_item_count_check" CHECK ("item_count" > 0),
  CONSTRAINT "payout_batches_gross_check" CHECK ("total_gross_minor" >= 0),
  CONSTRAINT "payout_batches_commission_check" CHECK ("total_commission_minor" >= 0),
  CONSTRAINT "payout_batches_net_check" CHECK ("total_net_payable_minor" > 0),
  CONSTRAINT "payout_batches_split_check" CHECK ("total_commission_minor" + "total_net_payable_minor" = "total_gross_minor"),
  CONSTRAINT "payout_batches_status_check" CHECK ("status" IN ('GENERATED', 'DISBURSED')),
  CONSTRAINT "payout_batches_method_check" CHECK ("payout_method" IN ('CEFT_SLIPS', 'BANK_WIRE', 'MANUAL_OFFLINE'))
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "payout_batches_code_unique" ON "payout_batches" ("batch_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payout_batches_business_status_idx" ON "payout_batches" ("business_id", "status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payout_batches_status_created_idx" ON "payout_batches" ("status", "created_at");--> statement-breakpoint

-- 2. Payout Batch Items Table (1:1 Lock Preventing Double-Batching of Payables)
CREATE TABLE IF NOT EXISTS "payout_batch_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "batch_id" uuid NOT NULL REFERENCES "public"."payout_batches"("id") ON DELETE restrict,
  "payable_id" uuid NOT NULL REFERENCES "public"."host_payables"("id") ON DELETE restrict,
  "booking_id" uuid NOT NULL REFERENCES "public"."bookings"("id") ON DELETE restrict,
  "gross_subtotal_minor" integer NOT NULL,
  "commission_minor" integer NOT NULL,
  "net_payable_minor" integer NOT NULL,
  "currency" varchar(3) DEFAULT 'LKR' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "payout_batch_items_payable_unique" ON "payout_batch_items" ("payable_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payout_batch_items_batch_id_idx" ON "payout_batch_items" ("batch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payout_batch_items_booking_id_idx" ON "payout_batch_items" ("booking_id");--> statement-breakpoint

-- 3. Support Tickets Table
CREATE TABLE IF NOT EXISTS "support_tickets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reference_code" varchar(32) NOT NULL,
  "requester_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null,
  "requester_name" varchar(120) NOT NULL,
  "requester_email" varchar(254) NOT NULL,
  "category" varchar(32) DEFAULT 'GENERAL_INQUIRY' NOT NULL,
  "priority" varchar(16) DEFAULT 'MEDIUM' NOT NULL,
  "status" varchar(32) DEFAULT 'OPEN' NOT NULL,
  "subject" varchar(200) NOT NULL,
  "booking_reference_input" varchar(64),
  "booking_id" uuid REFERENCES "public"."bookings"("id") ON DELETE set null,
  "assigned_to_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null,
  "resolution_summary" text,
  "resolved_at" timestamptz,
  "last_message_at" timestamptz DEFAULT now() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "support_tickets_category_check" CHECK ("category" IN (
    'BOOKING_ISSUE',
    'CUSTODY_INCIDENT',
    'PAYMENT_REFUND',
    'HOST_ONBOARDING',
    'ACCOUNT_ACCESS',
    'GENERAL_INQUIRY'
  )),
  CONSTRAINT "support_tickets_priority_check" CHECK ("priority" IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  CONSTRAINT "support_tickets_status_check" CHECK ("status" IN ('OPEN', 'IN_PROGRESS', 'AWAITING_CUSTOMER', 'RESOLVED', 'CLOSED'))
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "support_tickets_reference_code_unique" ON "support_tickets" ("reference_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_tickets_status_priority_idx" ON "support_tickets" ("status", "priority", "last_message_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_tickets_requester_user_idx" ON "support_tickets" ("requester_user_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_tickets_booking_id_idx" ON "support_tickets" ("booking_id");--> statement-breakpoint

-- 4. Support Ticket Messages Table
CREATE TABLE IF NOT EXISTS "support_ticket_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL REFERENCES "public"."support_tickets"("id") ON DELETE restrict,
  "sender_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null,
  "sender_role" varchar(32) NOT NULL,
  "sender_display_name" varchar(120) NOT NULL,
  "body" text NOT NULL,
  "is_internal_note" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "support_ticket_messages_sender_role_check" CHECK ("sender_role" IN ('GUEST', 'TRAVELLER', 'HOST', 'SUPPORT', 'SUPERADMIN'))
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "support_ticket_messages_ticket_created_idx" ON "support_ticket_messages" ("ticket_id", "created_at");--> statement-breakpoint

-- 5. Least-Privilege Runtime Role Grants & RBAC Permission Alignment
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'luggage_user') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE public.payout_batches, public.support_tickets TO luggage_user;
    GRANT SELECT, INSERT ON TABLE public.payout_batch_items, public.support_ticket_messages TO luggage_user;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'luggage_runtime') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE public.payout_batches, public.support_tickets TO luggage_runtime;
    GRANT SELECT, INSERT ON TABLE public.payout_batch_items, public.support_ticket_messages TO luggage_runtime;
  END IF;
END $$;--> statement-breakpoint

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" IN ('SUPPORT', 'SUPERADMIN')
  AND p."code" IN ('support.ticket.read', 'support.ticket.update')
ON CONFLICT DO NOTHING;--> statement-breakpoint
