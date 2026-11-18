-- 0019_payment_infrastructure_transformation.sql
-- Expands payment_intents_provider_check to support STRIPE, PAYPAL, SANDBOX_GATEWAY, and historical PAYHERE.

DO $$
BEGIN
  -- 1. Drop existing provider check constraint if present
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_intents_provider_check'
      AND conrelid = 'public.payment_intents'::regclass
  ) THEN
    ALTER TABLE "payment_intents" DROP CONSTRAINT "payment_intents_provider_check";
  END IF;

  -- 2. Add updated provider check constraint including STRIPE and PAYPAL
  ALTER TABLE "payment_intents"
    ADD CONSTRAINT "payment_intents_provider_check"
    CHECK ("provider" IN ('SANDBOX_GATEWAY', 'PAYHERE', 'STRIPE', 'PAYPAL'));

  -- 3. Ensure payment_intents_payhere_channel_active_check only applies to PAYHERE
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_intents_payhere_channel_active_check'
      AND conrelid = 'public.payment_intents'::regclass
  ) THEN
    ALTER TABLE "payment_intents" DROP CONSTRAINT "payment_intents_payhere_channel_active_check";
  END IF;

  ALTER TABLE "payment_intents"
    ADD CONSTRAINT "payment_intents_payhere_channel_active_check"
    CHECK (
      "provider" <> 'PAYHERE'
      OR "status" NOT IN ('INITIATED', 'PENDING_GATEWAY')
      OR NOT ("checkout_payload" ? 'mobileHandoffPath')
    );
END $$;--> statement-breakpoint

