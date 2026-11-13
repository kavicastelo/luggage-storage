-- Migration: 0011_phase_a_final_security_corrections.sql
-- Description:
--   1. Evolves public.trusted_auth_secrets to support explicit key-ID-aware multi-key rotation
--      (ACTIVE, RETIRING with bounded retires_at, and REVOKED states) with a partial unique index
--      guaranteeing at most one ACTIVE key at any instant.
--   2. Replaces public.verify_identity_assertion with:
--      - Explicit keyId validation and canonical HMAC-SHA256 payload binding (keyId:actorId:action:targetId:roleCode:expiresAt:nonce).
--      - Strict hex encoding and 32-byte (64-hex-character) signature length validation prior to decoding.
--      - Fixed-length (32-byte), fixed-iteration (32-step) bitwise XOR/OR byte comparison without early exit,
--        avoiding PostgreSQL bytea `<>` (memcmp) short-circuit behavior while documenting PL/pgSQL runtime characteristics accurately.
--      - Fail-closed checks when no valid ACTIVE key is provisioned or when an assertion references a retired/revoked/unknown key.
--   3. Re-affirms least-privilege ownership under luggage_role_assigner and revokes direct secret/nonce table access from PUBLIC and luggage_user.

-- 1. Ensure pgcrypto extension is present
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
--> statement-breakpoint

-- 2. Purge any instance of the known compromised development secret
DELETE FROM public.trusted_auth_secrets
WHERE secret = 'dev_db_identity_secret_key_minimum_32_characters_12345';
--> statement-breakpoint

-- 3. Add explicit key lifecycle columns idempotently to trusted_auth_secrets
ALTER TABLE public.trusted_auth_secrets
ADD COLUMN IF NOT EXISTS status varchar(16) NOT NULL DEFAULT 'ACTIVE';
--> statement-breakpoint

ALTER TABLE public.trusted_auth_secrets
ADD COLUMN IF NOT EXISTS retires_at timestamptz;
--> statement-breakpoint

ALTER TABLE public.trusted_auth_secrets
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
--> statement-breakpoint

-- 4. Normalize any pre-existing multiple ACTIVE rows on upgrade so at most one ACTIVE key remains
WITH ranked AS (
  SELECT key_id,
         ROW_NUMBER() OVER (
           ORDER BY CASE WHEN key_id = 'active' THEN 0 ELSE 1 END, created_at DESC, key_id ASC
         ) AS rn
  FROM public.trusted_auth_secrets
  WHERE status = 'ACTIVE'
)
UPDATE public.trusted_auth_secrets t
SET status = 'REVOKED',
    retires_at = NULL,
    updated_at = now()
FROM ranked r
WHERE t.key_id = r.key_id
  AND r.rn > 1;
--> statement-breakpoint

-- 5. Enforce key_id format, status lifecycle, retiring window, uncompromised secret, and single-active-key constraints
ALTER TABLE public.trusted_auth_secrets
DROP CONSTRAINT IF EXISTS trusted_auth_secrets_key_id_format_check;
--> statement-breakpoint

ALTER TABLE public.trusted_auth_secrets
ADD CONSTRAINT trusted_auth_secrets_key_id_format_check
CHECK (key_id ~ '^[a-zA-Z0-9_-]{1,64}$');
--> statement-breakpoint

ALTER TABLE public.trusted_auth_secrets
DROP CONSTRAINT IF EXISTS trusted_auth_secrets_status_check;
--> statement-breakpoint

ALTER TABLE public.trusted_auth_secrets
ADD CONSTRAINT trusted_auth_secrets_status_check
CHECK (status IN ('ACTIVE', 'RETIRING', 'REVOKED'));
--> statement-breakpoint

ALTER TABLE public.trusted_auth_secrets
DROP CONSTRAINT IF EXISTS trusted_auth_secrets_retiring_window_check;
--> statement-breakpoint

ALTER TABLE public.trusted_auth_secrets
ADD CONSTRAINT trusted_auth_secrets_retiring_window_check
CHECK (status <> 'RETIRING' OR retires_at IS NOT NULL);
--> statement-breakpoint

ALTER TABLE public.trusted_auth_secrets
DROP CONSTRAINT IF EXISTS trusted_auth_secrets_uncompromised_check;
--> statement-breakpoint

ALTER TABLE public.trusted_auth_secrets
ADD CONSTRAINT trusted_auth_secrets_uncompromised_check
CHECK (
  secret <> 'dev_db_identity_secret_key_minimum_32_characters_12345'
  AND length(secret) >= 32
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS trusted_auth_secrets_single_active_idx
ON public.trusted_auth_secrets ((status))
WHERE status = 'ACTIVE';
--> statement-breakpoint

-- 6. Replace verify_identity_assertion with key-ID-aware lookup and fixed-iteration 32-byte comparison
CREATE OR REPLACE FUNCTION public.verify_identity_assertion(
  p_assertion jsonb,
  p_expected_action text,
  p_expected_target uuid,
  p_expected_role text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key_id text;
  v_actor_id uuid;
  v_action text;
  v_target_id uuid;
  v_role_code text;
  v_expires_at bigint;
  v_nonce text;
  v_sig text;
  v_secret text;
  v_payload text;
  v_computed_mac bytea;
  v_provided_mac bytea;
  v_diff integer := 0;
  v_idx integer;
  v_now bigint;
BEGIN
  IF p_assertion IS NULL OR jsonb_typeof(p_assertion) <> 'object' THEN
    RAISE EXCEPTION 'Access denied: missing trusted identity assertion'
      USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_key_id := nullif(p_assertion->>'keyId', '');
    v_actor_id := nullif(p_assertion->>'actorId', '')::uuid;
    v_action := nullif(p_assertion->>'action', '');
    v_target_id := nullif(p_assertion->>'targetId', '')::uuid;
    v_role_code := nullif(p_assertion->>'roleCode', '');
    v_expires_at := nullif(p_assertion->>'expiresAt', '')::bigint;
    v_nonce := nullif(p_assertion->>'nonce', '');
    v_sig := nullif(p_assertion->>'signature', '');
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'Access denied: malformed identity assertion'
      USING ERRCODE = '42501';
  END;

  IF v_key_id IS NULL OR v_actor_id IS NULL OR v_action IS NULL OR v_target_id IS NULL OR v_expires_at IS NULL OR v_nonce IS NULL OR v_sig IS NULL THEN
    RAISE EXCEPTION 'Access denied: malformed identity assertion'
      USING ERRCODE = '42501';
  END IF;

  IF v_key_id !~ '^[a-zA-Z0-9_-]{1,64}$' THEN
    RAISE EXCEPTION 'Access denied: invalid identity assertion key identifier'
      USING ERRCODE = '42501';
  END IF;

  -- Validate hex encoding and exact 32-byte (64 hex character) HMAC-SHA256 signature length before decoding
  IF v_sig !~ '^[0-9a-fA-F]{64}$' THEN
    RAISE EXCEPTION 'Access denied: invalid identity assertion signature encoding or length'
      USING ERRCODE = '42501';
  END IF;

  -- Verify action alignment
  IF v_action <> p_expected_action THEN
    RAISE EXCEPTION 'Access denied: identity assertion action mismatch'
      USING ERRCODE = '42501';
  END IF;

  -- Verify target alignment
  IF v_target_id <> p_expected_target THEN
    RAISE EXCEPTION 'Access denied: identity assertion target mismatch'
      USING ERRCODE = '42501';
  END IF;

  -- Verify role code alignment
  IF p_expected_role IS NOT NULL AND (v_role_code IS NULL OR v_role_code <> p_expected_role) THEN
    RAISE EXCEPTION 'Access denied: identity assertion role code mismatch'
      USING ERRCODE = '42501';
  END IF;

  IF p_expected_role IS NULL AND v_role_code IS NOT NULL THEN
    RAISE EXCEPTION 'Access denied: identity assertion role code mismatch'
      USING ERRCODE = '42501';
  END IF;

  v_now := EXTRACT(EPOCH FROM now())::bigint;

  -- Verify timestamp expiration (with 5-second clock skew tolerance)
  IF v_now > (v_expires_at + 5) THEN
    RAISE EXCEPTION 'Access denied: identity assertion has expired'
      USING ERRCODE = '42501';
  END IF;

  -- Verify timestamp not excessively in the future (max permitted assertion lifetime is 120s)
  IF v_expires_at > (v_now + 120) THEN
    RAISE EXCEPTION 'Access denied: identity assertion expiration exceeds maximum permitted lifetime'
      USING ERRCODE = '42501';
  END IF;

  -- Fail closed immediately if no valid ACTIVE signing secret is provisioned in the database
  IF NOT EXISTS (
    SELECT 1
    FROM public.trusted_auth_secrets
    WHERE status = 'ACTIVE'
      AND secret <> 'dev_db_identity_secret_key_minimum_32_characters_12345'
      AND length(secret) >= 32
  ) THEN
    RAISE EXCEPTION 'Security error: trusted authentication secret is not provisioned or has been invalidated'
      USING ERRCODE = '42501';
  END IF;

  -- Retrieve secret matching the assertion's declared keyId (must be ACTIVE or within bounded RETIRING overlap window)
  SELECT secret INTO v_secret
  FROM public.trusted_auth_secrets
  WHERE key_id = v_key_id
    AND (
      status = 'ACTIVE'
      OR (status = 'RETIRING' AND retires_at IS NOT NULL AND retires_at > now())
    )
    AND secret <> 'dev_db_identity_secret_key_minimum_32_characters_12345'
    AND length(secret) >= 32;

  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'Access denied: identity assertion key is unknown, retired, or revoked'
      USING ERRCODE = '42501';
  END IF;

  -- Canonical payload binds keyId: keyId:actorId:action:targetId:roleCode:expiresAt:nonce
  v_payload := v_key_id || ':' || v_actor_id::text || ':' || v_action || ':' || v_target_id::text || ':' || COALESCE(v_role_code, '') || ':' || v_expires_at::text || ':' || v_nonce;
  v_computed_mac := public.hmac(convert_to(v_payload, 'UTF8'), convert_to(v_secret, 'UTF8'), 'sha256');
  v_provided_mac := decode(lower(v_sig), 'hex');

  IF octet_length(v_computed_mac) <> 32 OR octet_length(v_provided_mac) <> 32 THEN
    RAISE EXCEPTION 'Access denied: invalid identity assertion signature encoding or length'
      USING ERRCODE = '42501';
  END IF;

  -- Fixed-length (32-byte), fixed-iteration byte comparison without early exit.
  -- Avoids PostgreSQL bytea `<>` (C memcmp short-circuit on first differing byte).
  -- Note: PL/pgSQL is an interpreted database language and does not guarantee formal
  -- hardware/compiler constant-time execution; practical timing exposure is further
  -- bounded by database role isolation, <= 120s assertion TTL, and single-use nonces.
  v_diff := 0;
  FOR v_idx IN 0..31 LOOP
    v_diff := v_diff | (get_byte(v_computed_mac, v_idx) # get_byte(v_provided_mac, v_idx));
  END LOOP;

  IF v_diff <> 0 THEN
    RAISE EXCEPTION 'Access denied: invalid or forged identity assertion signature'
      USING ERRCODE = '42501';
  END IF;

  -- Global nonce replay defense across active and retiring keys
  BEGIN
    INSERT INTO public.consumed_auth_assertions (nonce, expires_at)
    VALUES (v_nonce, to_timestamp(v_expires_at));
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Access denied: identity assertion has already been consumed (replay detected)'
      USING ERRCODE = '42501';
  END;

  -- Periodic cleanup of expired nonces well past replay horizon
  DELETE FROM public.consumed_auth_assertions WHERE expires_at < now() - interval '1 hour';

  -- Session context verification: If session setting app.current_user_id is set, ensure it matches assertion actor
  IF nullif(current_setting('app.current_user_id', true), '') IS NOT NULL THEN
    IF (current_setting('app.current_user_id', true))::uuid <> v_actor_id THEN
      RAISE EXCEPTION 'Security violation: session context does not match verified assertion actor'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN v_actor_id;
END;
$$;
--> statement-breakpoint

-- 7. Re-affirm table isolation, function ownership, and least-privilege grants
REVOKE ALL ON public.trusted_auth_secrets FROM PUBLIC;
--> statement-breakpoint

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'luggage_user') THEN
    REVOKE ALL ON public.trusted_auth_secrets FROM luggage_user;
    REVOKE ALL ON public.consumed_auth_assertions FROM luggage_user;
  END IF;
END $$;
--> statement-breakpoint

REVOKE ALL ON public.consumed_auth_assertions FROM PUBLIC;
--> statement-breakpoint

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'luggage_role_assigner') THEN
    ALTER FUNCTION public.verify_identity_assertion(jsonb, text, uuid, text) OWNER TO luggage_role_assigner;
    GRANT SELECT ON public.trusted_auth_secrets TO luggage_role_assigner;
    GRANT SELECT, INSERT, DELETE ON public.consumed_auth_assertions TO luggage_role_assigner;
  END IF;
END $$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.verify_identity_assertion(jsonb, text, uuid, text) FROM PUBLIC;
--> statement-breakpoint

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'luggage_user') THEN
    GRANT EXECUTE ON FUNCTION public.verify_identity_assertion(jsonb, text, uuid, text) TO luggage_user;
  END IF;
END $$;
