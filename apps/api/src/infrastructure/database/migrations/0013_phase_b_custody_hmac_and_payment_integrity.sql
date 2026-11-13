-- Phase B Security & Payment Integrity Remediation Migration
-- B1: Custody PIN & QR Token HMAC Versioning + Unconsumed Legacy Token Invalidation
-- B4: Single Active Payable Payment Intent Invariant per Booking

-- 1. Add hash_version column to public.custody_tokens so pre-0013 unkeyed SHA-256 hashes
--    are explicitly distinguished from keyed hmac-sha256-v2 hashes and cannot verify.
ALTER TABLE "public"."custody_tokens"
  ADD COLUMN IF NOT EXISTS "hash_version" varchar(32);--> statement-breakpoint

UPDATE "public"."custody_tokens"
SET "hash_version" = 'sha256-legacy-v1'
WHERE "hash_version" IS NULL;--> statement-breakpoint

ALTER TABLE "public"."custody_tokens"
  ALTER COLUMN "hash_version" SET DEFAULT 'hmac-sha256-v2';--> statement-breakpoint

ALTER TABLE "public"."custody_tokens"
  ALTER COLUMN "hash_version" SET NOT NULL;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'custody_tokens_hash_version_check'
      AND conrelid = 'public.custody_tokens'::regclass
  ) THEN
    ALTER TABLE "public"."custody_tokens"
      ADD CONSTRAINT "custody_tokens_hash_version_check"
      CHECK ("hash_version" IN ('sha256-legacy-v1', 'hmac-sha256-v2'));
  END IF;
END $$;--> statement-breakpoint

-- 2. Immediately revoke all outstanding unconsumed legacy SHA-256 custody tokens so active passes
--    must be re-issued under keyed HMAC-SHA-256 (hmac-sha256-v2), while preserving completed
--    consumed token history, custody_records, bag_custody_items, and custody_events intact.
UPDATE "public"."custody_tokens"
SET "revoked_at" = NOW()
WHERE "hash_version" = 'sha256-legacy-v1'
  AND "consumed_at" IS NULL
  AND "revoked_at" IS NULL;--> statement-breakpoint

-- Clear unverified summary PIN hashes on active non-terminal custody records associated with revoked legacy passes
UPDATE "public"."custody_records"
SET "checkin_pin_hash" = NULL,
    "collection_pin_hash" = NULL,
    "updated_at" = NOW()
WHERE "status" IN ('EXPECTED', 'CHECKED_IN', 'IN_STORAGE', 'OVERDUE')
  AND ("checkin_pin_hash" IS NOT NULL OR "collection_pin_hash" IS NOT NULL)
  AND EXISTS (
    SELECT 1
    FROM "public"."custody_tokens" ct
    WHERE ct."custody_record_id" = "public"."custody_records"."id"
      AND ct."hash_version" = 'sha256-legacy-v1'
      AND ct."consumed_at" IS NULL
  );--> statement-breakpoint

-- 3. B4 Hardening: Deduplicate any historical overlapping active payment intents per booking
--    (retaining only the newest active row) and enforce at most one active payable intent per booking.
WITH ranked_active_intents AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "booking_id" ORDER BY "created_at" DESC, "id" DESC) AS rn
  FROM "public"."payment_intents"
  WHERE "status" IN ('INITIATED', 'PENDING_GATEWAY')
)
UPDATE "public"."payment_intents" pi
SET "status" = 'EXPIRED',
    "failure_reason" = COALESCE(pi."failure_reason", 'Superseded during payment integrity migration 0013'),
    "updated_at" = NOW()
FROM ranked_active_intents r
WHERE pi."id" = r."id"
  AND r.rn > 1;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "payment_intents_single_active_per_booking_idx"
  ON "public"."payment_intents" ("booking_id")
  WHERE "status" IN ('INITIATED', 'PENDING_GATEWAY');--> statement-breakpoint

