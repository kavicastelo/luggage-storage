-- ============================================================================
-- Migration: 0007_phase_a_security_hardening
-- Description:
--   1. Introduces database-backed upload_intents table to prevent unauthorized uploads.
--   2. Enforces partial unique index on pricing_policies (one ACTIVE policy per location).
--   3. Hardens public.assign_user_role to require SUPERADMIN authority.
--   4. Introduces public.self_assign_host_owner_role for verified self-service host onboarding.
--   5. Revokes upload.initiate permission from TRAVELLER role.
--   6. Grants table and execution permissions to luggage_user.
-- ============================================================================

-- 1. Create upload_intents table
CREATE TABLE IF NOT EXISTS public.upload_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  purpose varchar(64) NOT NULL,
  resource_type varchar(64) NOT NULL,
  resource_id uuid,
  file_key text NOT NULL,
  file_name varchar(255) NOT NULL,
  mime_type varchar(128) NOT NULL,
  max_file_size integer NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'PENDING',
  expires_at timestamp with time zone NOT NULL,
  confirmed_at timestamp with time zone,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT NOW(),
  updated_at timestamp with time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT upload_intents_purpose_check CHECK (purpose IN ('HOST_VERIFICATION', 'LOCATION_IMAGE')),
  CONSTRAINT upload_intents_status_check CHECK (status IN ('PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED')),
  CONSTRAINT upload_intents_max_size_check CHECK (max_file_size > 0),
  CONSTRAINT upload_intents_file_key_unique UNIQUE (file_key)
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS upload_intents_user_id_idx ON public.upload_intents (user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS upload_intents_status_idx ON public.upload_intents (status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS upload_intents_resource_idx ON public.upload_intents (resource_type, resource_id);
--> statement-breakpoint

-- Expand payout_account_number to accommodate AES-256-GCM encrypted strings (enc:v1:...)
ALTER TABLE public.host_businesses ALTER COLUMN payout_account_number TYPE varchar(255);
--> statement-breakpoint

-- 2. Pricing policy active uniqueness constraint
-- Archive any duplicate active policies, retaining the most recently updated
WITH ranked_policies AS (
  SELECT id, ROW_NUMBER() OVER(PARTITION BY location_id ORDER BY updated_at DESC, created_at DESC) as rn
  FROM public.pricing_policies
  WHERE status = 'ACTIVE'
)
UPDATE public.pricing_policies
SET status = 'ARCHIVED', updated_at = NOW()
WHERE id IN (
  SELECT id FROM ranked_policies WHERE rn > 1
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS pricing_policies_location_active_unique
ON public.pricing_policies (location_id)
WHERE status = 'ACTIVE';
--> statement-breakpoint

-- 3. Revoke upload.initiate from TRAVELLER role
DELETE FROM public.role_permissions
WHERE role_id = (SELECT id FROM public.roles WHERE code = 'TRAVELLER')
  AND permission_id = (SELECT id FROM public.permissions WHERE code = 'upload.initiate');
--> statement-breakpoint

-- 4. Harden public.assign_user_role (requires SUPERADMIN actor)
CREATE OR REPLACE FUNCTION public.assign_user_role(
  p_user_id uuid,
  p_role_code varchar,
  p_assigned_by uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role_id uuid;
  v_inserted boolean := false;
  v_is_superadmin boolean := false;
BEGIN
  -- Verify target user exists
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Cannot assign role: user % does not exist', p_user_id;
  END IF;

  -- Resolve target role
  SELECT id INTO v_role_id FROM public.roles WHERE code = p_role_code;
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Cannot assign role: role % does not exist', p_role_code;
  END IF;

  -- Security Boundary: Caller must have SUPERADMIN role
  IF p_assigned_by IS NULL THEN
    RAISE EXCEPTION 'Cannot assign role: assigning actor must be specified';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_assigned_by AND r.code = 'SUPERADMIN'
  ) INTO v_is_superadmin;

  IF NOT v_is_superadmin THEN
    RAISE EXCEPTION 'Access denied: assigning role % requires SUPERADMIN authority', p_role_code;
  END IF;

  -- Insert assignment idempotently
  INSERT INTO public.user_roles (user_id, role_id, assigned_by, assigned_at)
  VALUES (p_user_id, v_role_id, p_assigned_by, NOW())
  ON CONFLICT (user_id, role_id) DO NOTHING;

  IF FOUND THEN
    v_inserted := true;
  END IF;

  RETURN v_inserted;
END;
$$;
--> statement-breakpoint

-- 5. Safe self-service HOST_OWNER assignment function
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
BEGIN
  -- Verify user exists
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Cannot assign host owner: user % does not exist', p_user_id;
  END IF;

  -- Security Invariant: User must own a registered host business
  IF NOT EXISTS (SELECT 1 FROM public.host_businesses WHERE owner_user_id = p_user_id) THEN
    RAISE EXCEPTION 'Cannot self-assign HOST_OWNER: user % does not own a registered host business', p_user_id;
  END IF;

  -- Resolve HOST_OWNER role
  SELECT id INTO v_role_id FROM public.roles WHERE code = 'HOST_OWNER';
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Cannot assign role: HOST_OWNER role does not exist';
  END IF;

  -- Insert assignment idempotently
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

-- 6. Permissions and Ownership
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'luggage_role_assigner') THEN
    GRANT SELECT ON public.host_businesses TO luggage_role_assigner;
    ALTER FUNCTION public.assign_user_role(uuid, varchar, uuid) OWNER TO luggage_role_assigner;
    ALTER FUNCTION public.self_assign_host_owner_role(uuid) OWNER TO luggage_role_assigner;
  END IF;
END $$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.assign_user_role(uuid, varchar, uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid, varchar, uuid) TO luggage_user;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.self_assign_host_owner_role(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.self_assign_host_owner_role(uuid) TO luggage_user;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON public.upload_intents TO luggage_user;
