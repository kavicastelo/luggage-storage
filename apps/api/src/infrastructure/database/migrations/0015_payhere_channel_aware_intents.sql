-- 0015_payhere_channel_aware_intents.sql
-- Adds persisted checkout_channel ('WEB' | 'MOBILE_APP') to payment_intents so PayHere
-- notify_url webhook signature verification deterministically selects the channel-specific
-- Merchant Secret (web domain secret vs Android/mobile app package secret), and expires
-- legacy pre-channel active PayHere intents that lacked channel isolation.

ALTER TABLE "payment_intents" ADD COLUMN IF NOT EXISTS "checkout_channel" varchar(16);--> statement-breakpoint

UPDATE "payment_intents"
SET
  "status" = 'EXPIRED',
  "failure_reason" = COALESCE(
    "failure_reason",
    'Expired legacy PayHere intent prior to channel-aware checkout migration (0015)'
  ),
  "updated_at" = NOW()
WHERE "provider" = 'PAYHERE'
  AND "checkout_channel" IS NULL
  AND "status" IN ('INITIATED', 'PENDING_GATEWAY');--> statement-breakpoint

UPDATE "payment_intents"
SET "checkout_channel" = 'WEB'
WHERE "checkout_channel" IS NULL;--> statement-breakpoint

ALTER TABLE "payment_intents" ALTER COLUMN "checkout_channel" SET DEFAULT 'WEB';--> statement-breakpoint
ALTER TABLE "payment_intents" ALTER COLUMN "checkout_channel" SET NOT NULL;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_intents_checkout_channel_check'
      AND conrelid = 'public.payment_intents'::regclass
  ) THEN
    ALTER TABLE "payment_intents"
      ADD CONSTRAINT "payment_intents_checkout_channel_check"
      CHECK ("checkout_channel" IN ('WEB', 'MOBILE_APP'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_intents_payhere_channel_active_check'
      AND conrelid = 'public.payment_intents'::regclass
  ) THEN
    ALTER TABLE "payment_intents"
      ADD CONSTRAINT "payment_intents_payhere_channel_active_check"
      CHECK (
        "provider" <> 'PAYHERE'
        OR "status" NOT IN ('INITIATED', 'PENDING_GATEWAY')
        OR NOT ("checkout_payload" ? 'mobileHandoffPath')
      );
  END IF;
END $$;--> statement-breakpoint

