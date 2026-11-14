-- Phase B Final Payment Acceptance Remediation Migration
-- B9: Refund Transaction Evidence Integrity & Manual/Provider Attribution Distinction

-- 1. Extend public.refund_records with explicit settlement attribution columns
ALTER TABLE "public"."refund_records"
  ADD COLUMN IF NOT EXISTS "settlement_mode" varchar(32),
  ADD COLUMN IF NOT EXISTS "manual_reference" varchar(128),
  ADD COLUMN IF NOT EXISTS "settled_by_user_id" uuid;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'refund_records_settled_by_user_id_users_id_fk'
      AND conrelid = 'public.refund_records'::regclass
  ) THEN
    ALTER TABLE "public"."refund_records"
      ADD CONSTRAINT "refund_records_settled_by_user_id_users_id_fk"
      FOREIGN KEY ("settled_by_user_id")
      REFERENCES "public"."users"("id")
      ON DELETE SET NULL;
  END IF;
END $$;--> statement-breakpoint

-- Reconcile pre-0014 succeeded refund records safely without fabricating synthetic provider IDs
UPDATE "public"."refund_records"
SET
  "settlement_mode" = CASE
    WHEN "provider_refund_id" IS NOT NULL AND "provider_refund_id" LIKE 'rfnd_%' THEN 'MANUAL_OFFLINE'
    WHEN "provider_refund_id" IS NOT NULL THEN 'PROVIDER_CONFIRMED'
    WHEN "amount_minor" = 0 THEN 'MANUAL_OFFLINE'
    ELSE "settlement_mode"
  END,
  "manual_reference" = CASE
    WHEN "provider_refund_id" IS NOT NULL AND "provider_refund_id" LIKE 'rfnd_%'
      THEN COALESCE("manual_reference", "provider_refund_id")
    WHEN "provider_refund_id" IS NULL AND "amount_minor" = 0
      THEN COALESCE("manual_reference", 'ZERO_REFUND_LEGACY')
    ELSE "manual_reference"
  END,
  "provider_refund_id" = CASE
    WHEN "provider_refund_id" IS NOT NULL AND "provider_refund_id" LIKE 'rfnd_%' THEN NULL
    ELSE "provider_refund_id"
  END,
  "settled_by_user_id" = COALESCE("settled_by_user_id", "authorized_by_user_id")
WHERE "status" = 'SUCCEEDED'
  AND "settlement_mode" IS NULL;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "refund_records_provider_refund_unique_idx"
  ON "public"."refund_records" ("provider_refund_id")
  WHERE "provider_refund_id" IS NOT NULL;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'refund_records_settlement_mode_check'
      AND conrelid = 'public.refund_records'::regclass
  ) THEN
    ALTER TABLE "public"."refund_records"
      ADD CONSTRAINT "refund_records_settlement_mode_check"
      CHECK (
        "settlement_mode" IS NULL OR
        "settlement_mode" IN ('PROVIDER_CONFIRMED', 'MANUAL_OFFLINE')
      );
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'refund_records_succeeded_evidence_check'
      AND conrelid = 'public.refund_records'::regclass
  ) THEN
    ALTER TABLE "public"."refund_records"
      ADD CONSTRAINT "refund_records_succeeded_evidence_check"
      CHECK (
        "status" <> 'SUCCEEDED' OR (
          (
            "settlement_mode" = 'PROVIDER_CONFIRMED'
            AND "provider_refund_id" IS NOT NULL
            AND length(btrim("provider_refund_id")) >= 3
            AND "manual_reference" IS NULL
          )
          OR
          (
            "settlement_mode" = 'MANUAL_OFFLINE'
            AND "manual_reference" IS NOT NULL
            AND length(btrim("manual_reference")) >= 3
            AND "provider_refund_id" IS NULL
          )
        )
      );
  END IF;
END $$;--> statement-breakpoint

-- 2. Extend public.payment_transactions with strict evidence attribution & nullable provider_transaction_id
ALTER TABLE "public"."payment_transactions"
  ALTER COLUMN "provider_transaction_id" DROP NOT NULL;--> statement-breakpoint

ALTER TABLE "public"."payment_transactions"
  ADD COLUMN IF NOT EXISTS "refund_id" uuid,
  ADD COLUMN IF NOT EXISTS "evidence_source" varchar(32),
  ADD COLUMN IF NOT EXISTS "manual_reference" varchar(128),
  ADD COLUMN IF NOT EXISTS "settled_by_user_id" uuid;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_transactions_refund_id_refund_records_id_fk'
      AND conrelid = 'public.payment_transactions'::regclass
  ) THEN
    ALTER TABLE "public"."payment_transactions"
      ADD CONSTRAINT "payment_transactions_refund_id_refund_records_id_fk"
      FOREIGN KEY ("refund_id")
      REFERENCES "public"."refund_records"("id")
      ON DELETE RESTRICT;
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_transactions_settled_by_user_id_users_id_fk'
      AND conrelid = 'public.payment_transactions'::regclass
  ) THEN
    ALTER TABLE "public"."payment_transactions"
      ADD CONSTRAINT "payment_transactions_settled_by_user_id_users_id_fk"
      FOREIGN KEY ("settled_by_user_id")
      REFERENCES "public"."users"("id")
      ON DELETE SET NULL;
  END IF;
END $$;--> statement-breakpoint

-- Backfill historical rows so signature_verified = true applies strictly to verified provider webhooks
UPDATE "public"."payment_transactions"
SET
  "evidence_source" = CASE
    WHEN "transaction_type" = 'REFUND' AND ("provider_transaction_id" IS NULL OR "provider_transaction_id" LIKE 'rfnd_%')
      THEN 'ADMIN_MANUAL_OFFLINE'
    WHEN "transaction_type" = 'REFUND'
      THEN 'ADMIN_PROVIDER_ATTESTED'
    WHEN "signature_verified" = true
      THEN 'PROVIDER_WEBHOOK'
    ELSE 'SANDBOX_SIMULATOR'
  END,
  "manual_reference" = CASE
    WHEN "transaction_type" = 'REFUND' AND "provider_transaction_id" LIKE 'rfnd_%'
      THEN COALESCE("manual_reference", "provider_transaction_id")
    ELSE "manual_reference"
  END,
  "provider_transaction_id" = CASE
    WHEN "transaction_type" = 'REFUND' AND "provider_transaction_id" LIKE 'rfnd_%'
      THEN NULL
    ELSE "provider_transaction_id"
  END,
  "signature_verified" = CASE
    WHEN "transaction_type" = 'REFUND' THEN false
    ELSE "signature_verified"
  END,
  "refund_id" = COALESCE(
    "refund_id",
    CASE
      WHEN ("metadata"->>'refundId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN ("metadata"->>'refundId')::uuid
      ELSE NULL
    END
  )
WHERE "evidence_source" IS NULL;--> statement-breakpoint

ALTER TABLE "public"."payment_transactions"
  ALTER COLUMN "evidence_source" SET NOT NULL;--> statement-breakpoint

DROP INDEX IF EXISTS "public"."payment_transactions_provider_tx_unique";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_transactions_provider_tx_unique"
  ON "public"."payment_transactions" ("provider", "provider_transaction_id")
  WHERE "provider_transaction_id" IS NOT NULL;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "payment_transactions_refund_unique_idx"
  ON "public"."payment_transactions" ("refund_id")
  WHERE "refund_id" IS NOT NULL AND "transaction_type" = 'REFUND' AND "status" = 'SUCCEEDED';--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "payment_transactions_refund_id_idx"
  ON "public"."payment_transactions" ("refund_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "payment_transactions_evidence_source_idx"
  ON "public"."payment_transactions" ("evidence_source");--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_transactions_evidence_source_check'
      AND conrelid = 'public.payment_transactions'::regclass
  ) THEN
    ALTER TABLE "public"."payment_transactions"
      ADD CONSTRAINT "payment_transactions_evidence_source_check"
      CHECK ("evidence_source" IN (
        'PROVIDER_WEBHOOK',
        'SANDBOX_SIMULATOR',
        'ADMIN_PROVIDER_ATTESTED',
        'ADMIN_MANUAL_OFFLINE'
      ));
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_transactions_sig_evidence_check'
      AND conrelid = 'public.payment_transactions'::regclass
  ) THEN
    ALTER TABLE "public"."payment_transactions"
      ADD CONSTRAINT "payment_transactions_sig_evidence_check"
      CHECK ((NOT "signature_verified") OR ("evidence_source" = 'PROVIDER_WEBHOOK'));
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_transactions_provider_tx_presence_check'
      AND conrelid = 'public.payment_transactions'::regclass
  ) THEN
    ALTER TABLE "public"."payment_transactions"
      ADD CONSTRAINT "payment_transactions_provider_tx_presence_check"
      CHECK (
        (
          "evidence_source" = 'ADMIN_MANUAL_OFFLINE'
          AND "transaction_type" = 'REFUND'
          AND "provider_transaction_id" IS NULL
          AND "manual_reference" IS NOT NULL
          AND length(btrim("manual_reference")) >= 3
        )
        OR
        (
          "evidence_source" <> 'ADMIN_MANUAL_OFFLINE'
          AND "provider_transaction_id" IS NOT NULL
          AND length(btrim("provider_transaction_id")) >= 3
        )
      );
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_transactions_admin_refund_only_check'
      AND conrelid = 'public.payment_transactions'::regclass
  ) THEN
    ALTER TABLE "public"."payment_transactions"
      ADD CONSTRAINT "payment_transactions_admin_refund_only_check"
      CHECK (
        "evidence_source" NOT IN ('ADMIN_PROVIDER_ATTESTED', 'ADMIN_MANUAL_OFFLINE')
        OR "transaction_type" = 'REFUND'
      );
  END IF;
END $$;--> statement-breakpoint

