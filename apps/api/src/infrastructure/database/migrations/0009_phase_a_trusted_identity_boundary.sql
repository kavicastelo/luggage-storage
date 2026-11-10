-- Migration: 0009_phase_a_trusted_identity_boundary.sql
-- Description:
--   Establishes a cryptographically trustworthy database identity boundary for privileged operations.
--   1. Ensures pgcrypto extension is installed in public schema.
--   2. Creates trusted_auth_secrets table (accessible ONLY to luggage_role_assigner, inaccessible to luggage_user).
--   3. Creates consumed_auth_assertions table for nonce-based replay prevention.
--   4. Drops obsolete insecure function signatures.
--   5. Creates verify_identity_assertion routine to verify HMAC-SHA256 signatures, expiration, and nonces.
--   6. Hardens assign_user_role, revoke_user_role, and self_assign_host_owner_role to require verified assertions.
--   7. Configures least-privilege ownership and execute grants.

-- 1. Ensure pgcrypto extension is enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
--> statement-breakpoint

-- 2. Create trusted_auth_secrets table for storing server-side identity verification secret
CREATE TABLE IF NOT EXISTS public.trusted_auth_secrets (
  key_id text PRIMARY KEY,
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

REVOKE ALL ON public.trusted_auth_secrets FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON public.trusted_auth_secrets FROM luggage_user;
--> statement-breakpoint

-- 3. Create consumed_auth_assertions table for replay prevention
CREATE TABLE IF NOT EXISTS public.consumed_auth_assertions (
  nonce text PRIMARY KEY,
  consumed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS consumed_auth_assertions_expires_at_idx
ON public.consumed_auth_assertions (expires_at);
--> statement-breakpoint

REVOKE ALL ON public.consumed_auth_assertions FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON public.consumed_auth_assertions FROM luggage_user;
--> statement-breakpoint

-- 4. Drop obsolete function signatures to prevent legacy or bypass invocation
DROP FUNCTION IF EXISTS public.assign_user_role(uuid, varchar, uuid);
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.assign_user_role(uuid, varchar);
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.revoke_user_role(uuid, varchar);
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.self_assign_host_owner_role(uuid);
--> statement-breakpoint

-- 5. Create core identity assertion verification routine (SECURITY DEFINER)
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
  v_actor_id uuid;
  v_action text;
  v_target_id uuid;
  v_role_code text;
  v_expires_at bigint;
  v_nonce text;
  v_sig text;
  v_secret text;
  v_payload text;
  v_computed_sig text;
  v_now bigint;
BEGIN
  IF p_assertion IS NULL THEN
    RAISE EXCEPTION 'Access denied: missing trusted identity assertion';
  END IF;

  v_actor_id := nullif(p_assertion->>'actorId', '')::uuid;
  v_action := nullif(p_assertion->>'action', '');
  v_target_id := nullif(p_assertion->>'targetId', '')::uuid;
  v_role_code := nullif(p_assertion->>'roleCode', '');
  v_expires_at := (p_assertion->>'expiresAt')::bigint;
  v_nonce := nullif(p_assertion->>'nonce', '');
  v_sig := nullif(p_assertion->>'signature', '');

  IF v_actor_id IS NULL OR v_action IS NULL OR v_target_id IS NULL OR v_expires_at IS NULL OR v_nonce IS NULL OR v_sig IS NULL THEN
    RAISE EXCEPTION 'Access denied: malformed identity assertion';
  END IF;

  -- Verify action alignment
  IF v_action <> p_expected_action THEN
    RAISE EXCEPTION 'Access denied: identity assertion action mismatch';
  END IF;

  -- Verify target alignment
  IF v_target_id <> p_expected_target THEN
    RAISE EXCEPTION 'Access denied: identity assertion target mismatch';
  END IF;

  -- Verify role code alignment if expected
  IF p_expected_role IS NOT NULL AND (v_role_code IS NULL OR v_role_code <> p_expected_role) THEN
    RAISE EXCEPTION 'Access denied: identity assertion role code mismatch';
  END IF;

  -- Verify timestamp expiration (with 5-second clock skew tolerance)
  v_now := EXTRACT(EPOCH FROM now())::bigint;
  IF v_now > (v_expires_at + 5) THEN
    RAISE EXCEPTION 'Access denied: identity assertion has expired';
  END IF;

  -- Retrieve secret from trusted_auth_secrets
  SELECT secret INTO v_secret FROM public.trusted_auth_secrets WHERE key_id = 'active';
  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'Security error: trusted authentication secret is not provisioned';
  END IF;

  -- Canonical payload: actorId:action:targetId:roleCode:expiresAt:nonce
  v_payload := v_actor_id::text || ':' || v_action || ':' || v_target_id::text || ':' || COALESCE(v_role_code, '') || ':' || v_expires_at::text || ':' || v_nonce;
  v_computed_sig := encode(public.hmac(v_payload::bytea, v_secret::bytea, 'sha256'), 'hex');

  IF lower(v_computed_sig) <> lower(v_sig) THEN
    RAISE EXCEPTION 'Access denied: invalid or forged identity assertion signature';
  END IF;

  -- Nonce replay defense: insert into consumed_auth_assertions
  BEGIN
    INSERT INTO public.consumed_auth_assertions (nonce, expires_at)
    VALUES (v_nonce, to_timestamp(v_expires_at));
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Access denied: identity assertion has already been consumed (replay detected)';
  END;

  -- Cleanup old nonces periodically
  DELETE FROM public.consumed_auth_assertions WHERE expires_at < now() - interval '1 hour';

  -- Session context verification: If session setting app.current_user_id is set, ensure it matches assertion actor
  IF nullif(current_setting('app.current_user_id', true), '') IS NOT NULL THEN
    IF (current_setting('app.current_user_id', true))::uuid <> v_actor_id THEN
      RAISE EXCEPTION 'Security violation: session context does not match verified assertion actor';
    END IF;
  END IF;

  RETURN v_actor_id;
END;
$$;
--> statement-breakpoint

-- 6. Hardened public.assign_user_role requiring verified identity assertion
CREATE OR REPLACE FUNCTION public.assign_user_role(
  p_user_id uuid,
  p_role_code varchar,
  p_assertion jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role_id uuid;
  v_inserted boolean := false;
  v_actor_id uuid;
  v_is_superadmin boolean := false;
  v_session_user text;
BEGIN
  v_session_user := session_user;

  -- Establish actor from trusted database identity assertion
  IF v_session_user IN ('luggage_migrator', 'postgres') AND p_assertion IS NULL THEN
    v_actor_id := COALESCE(
      nullif(current_setting('app.current_user_id', true), '')::uuid,
      p_user_id
    );
  ELSE
    IF p_assertion IS NULL THEN
      RAISE EXCEPTION 'Access denied: missing trusted identity assertion';
    END IF;
    v_actor_id := public.verify_identity_assertion(
      p_assertion,
      'ASSIGN_ROLE',
      p_user_id,
      p_role_code
    );
  END IF;

  -- Verify target user exists and is not deactivated
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND status <> 'DEACTIVATED') THEN
    RAISE EXCEPTION 'Cannot assign role: target user does not exist or is deactivated';
  END IF;

  -- Validate authorized role codes
  IF p_role_code NOT IN ('TRAVELLER', 'HOST_OWNER', 'HOST_STAFF', 'SUPPORT', 'SUPERADMIN') THEN
    RAISE EXCEPTION 'Cannot assign role: unauthorized or unknown role code %', p_role_code;
  END IF;

  -- Resolve target role
  SELECT id INTO v_role_id FROM public.roles WHERE code = p_role_code;
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Cannot assign role: role % does not exist', p_role_code;
  END IF;

  -- Actor authority check: Actor must possess SUPERADMIN role
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = v_actor_id AND r.code = 'SUPERADMIN'
  ) INTO v_is_superadmin;

  IF NOT v_is_superadmin THEN
    RAISE EXCEPTION 'Access denied: assigning role % requires SUPERADMIN authority', p_role_code;
  END IF;

  -- Insert assignment idempotently with trusted actor ID
  INSERT INTO public.user_roles (user_id, role_id, assigned_by, assigned_at)
  VALUES (p_user_id, v_role_id, v_actor_id, NOW())
  ON CONFLICT (user_id, role_id) DO NOTHING;

  IF FOUND THEN
    v_inserted := true;
  END IF;

  RETURN v_inserted;
END;
$$;
--> statement-breakpoint

-- 7. Hardened public.revoke_user_role requiring verified identity assertion
CREATE OR REPLACE FUNCTION public.revoke_user_role(
  p_user_id uuid,
  p_role_code varchar,
  p_assertion jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role_id uuid;
  v_deleted boolean := false;
  v_actor_id uuid;
  v_is_superadmin boolean := false;
  v_remaining_roles int;
  v_session_user text;
BEGIN
  v_session_user := session_user;

  -- Establish actor from trusted database identity assertion
  IF v_session_user IN ('luggage_migrator', 'postgres') AND p_assertion IS NULL THEN
    v_actor_id := COALESCE(
      nullif(current_setting('app.current_user_id', true), '')::uuid,
      p_user_id
    );
  ELSE
    IF p_assertion IS NULL THEN
      RAISE EXCEPTION 'Access denied: missing trusted identity assertion';
    END IF;
    v_actor_id := public.verify_identity_assertion(
      p_assertion,
      'REVOKE_ROLE',
      p_user_id,
      p_role_code
    );
  END IF;

  -- Actor authority check: Actor must possess SUPERADMIN role
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = v_actor_id AND r.code = 'SUPERADMIN'
  ) INTO v_is_superadmin;

  IF NOT v_is_superadmin THEN
    RAISE EXCEPTION 'Access denied: revoking role % requires SUPERADMIN authority', p_role_code;
  END IF;

  -- Self-action defense: Cannot revoke roles on self via administrative function
  IF p_user_id = v_actor_id THEN
    RAISE EXCEPTION 'Administrators cannot modify roles on their own account';
  END IF;

  -- Resolve role
  SELECT id INTO v_role_id FROM public.roles WHERE code = p_role_code;
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Cannot revoke role: role % does not exist', p_role_code;
  END IF;

  -- Invariant check: User must retain at least one role
  SELECT count(*) INTO v_remaining_roles
  FROM public.user_roles
  WHERE user_id = p_user_id AND role_id <> v_role_id;

  IF v_remaining_roles < 1 THEN
    RAISE EXCEPTION 'Cannot revoke role: user must retain at least one role';
  END IF;

  -- Delete assignment
  DELETE FROM public.user_roles
  WHERE user_id = p_user_id AND role_id = v_role_id;

  IF FOUND THEN
    v_deleted := true;
  END IF;

  RETURN v_deleted;
END;
$$;
--> statement-breakpoint

-- 8. Hardened public.self_assign_host_owner_role requiring verified identity assertion
CREATE OR REPLACE FUNCTION public.self_assign_host_owner_role(
  p_user_id uuid,
  p_assertion jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role_id uuid;
  v_inserted boolean := false;
  v_owns_business boolean := false;
  v_actor_id uuid;
  v_session_user text;
BEGIN
  v_session_user := session_user;

  -- Establish actor from trusted database identity assertion
  IF v_session_user IN ('luggage_migrator', 'postgres') AND p_assertion IS NULL THEN
    v_actor_id := COALESCE(
      nullif(current_setting('app.current_user_id', true), '')::uuid,
      p_user_id
    );
  ELSE
    IF p_assertion IS NULL THEN
      RAISE EXCEPTION 'Access denied: missing trusted identity assertion';
    END IF;
    v_actor_id := public.verify_identity_assertion(
      p_assertion,
      'SELF_ASSIGN_HOST_OWNER',
      p_user_id,
      'HOST_OWNER'
    );
  END IF;

  -- Self-assignment must be for the acting user
  IF v_actor_id <> p_user_id THEN
    RAISE EXCEPTION 'Security violation: self-assignment actor does not match target user';
  END IF;

  -- Verify target user exists and is not deactivated
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND status <> 'DEACTIVATED') THEN
    RAISE EXCEPTION 'Cannot assign role: user does not exist or is deactivated';
  END IF;

  -- Invariant: User must own at least one registered, non-suspended host business
  SELECT EXISTS (
    SELECT 1 FROM public.host_businesses
    WHERE owner_user_id = p_user_id AND status <> 'SUSPENDED'
  ) INTO v_owns_business;

  IF NOT v_owns_business THEN
    RAISE EXCEPTION 'Access denied: user % does not own an active or eligible host business', p_user_id;
  END IF;

  -- Resolve HOST_OWNER role
  SELECT id INTO v_role_id FROM public.roles WHERE code = 'HOST_OWNER';
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'HOST_OWNER role does not exist';
  END IF;

  -- Idempotently insert role
  INSERT INTO public.user_roles (user_id, role_id, assigned_by, assigned_at)
  VALUES (p_user_id, v_role_id, p_user_id, NOW())
  ON CONFLICT (user_id, role_id) DO NOTHING;

  IF FOUND THEN
    v_inserted := true;
  END IF;

  RETURN v_inserted;
END;
$$;
--> statement-breakpoint

-- 9. Function Ownership and Execution Grants
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'luggage_role_assigner') THEN
    ALTER FUNCTION public.verify_identity_assertion(jsonb, text, uuid, text) OWNER TO luggage_role_assigner;
    ALTER FUNCTION public.assign_user_role(uuid, varchar, jsonb) OWNER TO luggage_role_assigner;
    ALTER FUNCTION public.revoke_user_role(uuid, varchar, jsonb) OWNER TO luggage_role_assigner;
    ALTER FUNCTION public.self_assign_host_owner_role(uuid, jsonb) OWNER TO luggage_role_assigner;
    GRANT SELECT ON public.trusted_auth_secrets TO luggage_role_assigner;
    GRANT SELECT, INSERT, DELETE ON public.consumed_auth_assertions TO luggage_role_assigner;
    GRANT SELECT, INSERT, DELETE ON public.user_roles TO luggage_role_assigner;
  END IF;
END $$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.verify_identity_assertion(jsonb, text, uuid, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.verify_identity_assertion(jsonb, text, uuid, text) TO luggage_user;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.assign_user_role(uuid, varchar, jsonb) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid, varchar, jsonb) TO luggage_user;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.revoke_user_role(uuid, varchar, jsonb) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.revoke_user_role(uuid, varchar, jsonb) TO luggage_user;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.self_assign_host_owner_role(uuid, jsonb) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.self_assign_host_owner_role(uuid, jsonb) TO luggage_user;

