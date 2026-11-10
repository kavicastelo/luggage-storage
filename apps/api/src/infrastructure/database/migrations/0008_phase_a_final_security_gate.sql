-- Migration: 0008_phase_a_final_security_gate.sql
-- Description:
--   1. Adds coarse_coordinates to storage_locations for privacy-preserving discovery (removes exact-coord leakage).
--   2. Updates upload_intents status constraint to support 'CONSUMED' lifecycle status.
--   3. Adds check constraint on host_businesses ensuring payout_account_number is encrypted.
--   4. Hardens assign_user_role to derive actor from app.current_user_id and disallow forged p_assigned_by.
--   5. Hardens revoke_user_role to require SUPERADMIN identity from app.current_user_id and enforce invariants.
--   6. Hardens self_assign_host_owner_role with session actor identity validation.

-- 1. Public Discovery Privacy: Add coarse_coordinates and GiST index
ALTER TABLE public.storage_locations ADD COLUMN IF NOT EXISTS coarse_coordinates geography(Point, 4326);
--> statement-breakpoint

UPDATE public.storage_locations
SET coarse_coordinates = ST_SetSRID(ST_MakePoint(ROUND(longitude::numeric, 2), ROUND(latitude::numeric, 2)), 4326)::geography
WHERE coarse_coordinates IS NULL;
--> statement-breakpoint

ALTER TABLE public.storage_locations ALTER COLUMN coarse_coordinates SET NOT NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS storage_locations_coarse_coordinates_gist_idx
ON public.storage_locations USING gist (coarse_coordinates);
--> statement-breakpoint

-- 2. Upload Intent Lifecycle: Allow 'CONSUMED' status for replay prevention
ALTER TABLE public.upload_intents DROP CONSTRAINT IF EXISTS upload_intents_status_check;
--> statement-breakpoint

ALTER TABLE public.upload_intents ADD CONSTRAINT upload_intents_status_check
CHECK (status IN ('PENDING', 'CONFIRMED', 'CONSUMED', 'EXPIRED', 'CANCELLED'));
--> statement-breakpoint

-- 3. Payout Encryption Integrity: Enforce AES-256-GCM encrypted format at rest
ALTER TABLE public.host_businesses DROP CONSTRAINT IF EXISTS host_businesses_payout_encrypted_check;
--> statement-breakpoint

ALTER TABLE public.host_businesses ADD CONSTRAINT host_businesses_payout_encrypted_check
CHECK (payout_account_number IS NULL OR payout_account_number LIKE 'enc:v1:%');
--> statement-breakpoint

-- 4. Harden public.assign_user_role (removes trust in caller-supplied p_assigned_by)
CREATE OR REPLACE FUNCTION public.assign_user_role(
  p_user_id uuid,
  p_role_code varchar,
  p_assigned_by uuid DEFAULT NULL
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

  -- Establish actor from trusted database identity mechanism (app.current_user_id)
  IF v_session_user IN ('luggage_migrator', 'postgres') THEN
    v_actor_id := COALESCE(
      nullif(current_setting('app.current_user_id', true), '')::uuid,
      p_assigned_by,
      p_user_id
    );
  ELSE
    v_actor_id := nullif(current_setting('app.current_user_id', true), '')::uuid;
    IF v_actor_id IS NULL THEN
      RAISE EXCEPTION 'Access denied: database identity context (app.current_user_id) not established';
    END IF;
    -- Disallow forged p_assigned_by: caller cannot claim to act on behalf of another user
    IF p_assigned_by IS NOT NULL AND p_assigned_by <> v_actor_id THEN
      RAISE EXCEPTION 'Security violation: supplied actor does not match database identity context';
    END IF;
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

-- 5. Harden public.revoke_user_role (audited SECURITY DEFINER function)
CREATE OR REPLACE FUNCTION public.revoke_user_role(
  p_user_id uuid,
  p_role_code varchar
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

  -- Establish actor from trusted database identity mechanism (app.current_user_id)
  IF v_session_user IN ('luggage_migrator', 'postgres') THEN
    v_actor_id := COALESCE(
      nullif(current_setting('app.current_user_id', true), '')::uuid,
      p_user_id
    );
  ELSE
    v_actor_id := nullif(current_setting('app.current_user_id', true), '')::uuid;
    IF v_actor_id IS NULL THEN
      RAISE EXCEPTION 'Access denied: database identity context (app.current_user_id) not established';
    END IF;
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

-- 6. Harden public.self_assign_host_owner_role
CREATE OR REPLACE FUNCTION public.self_assign_host_owner_role(
  p_user_id uuid
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

  -- Verify identity context if set
  v_actor_id := nullif(current_setting('app.current_user_id', true), '')::uuid;
  IF v_actor_id IS NOT NULL AND v_actor_id <> p_user_id AND v_session_user NOT IN ('luggage_migrator', 'postgres') THEN
    RAISE EXCEPTION 'Security violation: self-assignment actor does not match database identity context';
  END IF;

  -- Verify target user exists and is active
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND status <> 'DEACTIVATED') THEN
    RAISE EXCEPTION 'Cannot assign role: user does not exist or is deactivated';
  END IF;

  -- Invariant: User must own at least one registered host business
  SELECT EXISTS (
    SELECT 1 FROM public.host_businesses
    WHERE owner_user_id = p_user_id
  ) INTO v_owns_business;

  IF NOT v_owns_business THEN
    RAISE EXCEPTION 'Access denied: user % does not own a registered host business', p_user_id;
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

-- 7. Ensure Function Ownership and Least-Privilege Grants
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'luggage_role_assigner') THEN
    ALTER FUNCTION public.assign_user_role(uuid, varchar, uuid) OWNER TO luggage_role_assigner;
    ALTER FUNCTION public.revoke_user_role(uuid, varchar) OWNER TO luggage_role_assigner;
    ALTER FUNCTION public.self_assign_host_owner_role(uuid) OWNER TO luggage_role_assigner;
    GRANT DELETE ON public.user_roles TO luggage_role_assigner;
  END IF;
END $$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.assign_user_role(uuid, varchar, uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid, varchar, uuid) TO luggage_user;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.revoke_user_role(uuid, varchar) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.revoke_user_role(uuid, varchar) TO luggage_user;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.self_assign_host_owner_role(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.self_assign_host_owner_role(uuid) TO luggage_user;

