-- Initiative 3: Host Staff RBAC permissions & scoped SECURITY DEFINER role sync functions

INSERT INTO "permissions" ("code", "name", "description", "module")
VALUES
  ('hosts.staff.read_own', 'Read Own Host Staff', 'View staff memberships and assigned locations for owned host businesses', 'hosts'),
  ('hosts.staff.manage_own', 'Manage Own Host Staff', 'Invite, update, and remove staff memberships for owned host businesses', 'hosts')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" IN ('HOST_OWNER', 'SUPERADMIN')
  AND p."code" IN ('hosts.staff.read_own', 'hosts.staff.manage_own')
ON CONFLICT DO NOTHING;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'luggage_role_assigner') THEN
    GRANT SELECT ON public.users, public.roles, public.host_businesses, public.host_staff_memberships TO luggage_role_assigner;
  END IF;
END $$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.assign_host_staff_role(
  p_business_id uuid,
  p_target_user_id uuid,
  p_assertion jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_business_owner_id uuid;
  v_is_superadmin boolean := false;
  v_role_id uuid;
  v_inserted boolean := false;
BEGIN
  v_actor_id := public.verify_identity_assertion(
    p_assertion,
    'ASSIGN_HOST_STAFF_ROLE',
    p_target_user_id,
    'HOST_STAFF'
  );

  SELECT "owner_user_id"
  INTO v_business_owner_id
  FROM public.host_businesses
  WHERE "id" = p_business_id;

  IF v_business_owner_id IS NULL THEN
    RAISE EXCEPTION 'Cannot assign host staff role: host business not found';
  END IF;

  IF v_business_owner_id <> v_actor_id THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      INNER JOIN public.roles r ON r."id" = ur."role_id"
      WHERE ur."user_id" = v_actor_id
        AND r."code" = 'SUPERADMIN'
    ) INTO v_is_superadmin;

    IF NOT v_is_superadmin THEN
      RAISE EXCEPTION 'Access denied: actor does not own target host business'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE "id" = p_target_user_id
      AND "status" <> 'DEACTIVATED'
  ) THEN
    RAISE EXCEPTION 'Cannot assign host staff role: target user does not exist or is deactivated';
  END IF;

  SELECT "id" INTO v_role_id
  FROM public.roles
  WHERE "code" = 'HOST_STAFF';

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'HOST_STAFF role does not exist in roles table';
  END IF;

  INSERT INTO public.user_roles ("user_id", "role_id", "assigned_by", "assigned_at")
  VALUES (p_target_user_id, v_role_id, v_actor_id, now())
  ON CONFLICT ("user_id", "role_id") DO NOTHING;

  v_inserted := FOUND;
  RETURN v_inserted;
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.revoke_host_staff_role_if_unassigned(
  p_business_id uuid,
  p_target_user_id uuid,
  p_assertion jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_business_owner_id uuid;
  v_is_superadmin boolean := false;
  v_role_id uuid;
  v_has_other_active_staff boolean := false;
  v_deleted boolean := false;
BEGIN
  v_actor_id := public.verify_identity_assertion(
    p_assertion,
    'REVOKE_HOST_STAFF_ROLE',
    p_target_user_id,
    'HOST_STAFF'
  );

  SELECT "owner_user_id"
  INTO v_business_owner_id
  FROM public.host_businesses
  WHERE "id" = p_business_id;

  IF v_business_owner_id IS NULL THEN
    RAISE EXCEPTION 'Cannot revoke host staff role: host business not found';
  END IF;

  IF v_business_owner_id <> v_actor_id THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      INNER JOIN public.roles r ON r."id" = ur."role_id"
      WHERE ur."user_id" = v_actor_id
        AND r."code" = 'SUPERADMIN'
    ) INTO v_is_superadmin;

    IF NOT v_is_superadmin THEN
      RAISE EXCEPTION 'Access denied: actor does not own target host business'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.host_staff_memberships
    WHERE "user_id" = p_target_user_id
      AND "is_active" = true
  ) INTO v_has_other_active_staff;

  IF v_has_other_active_staff THEN
    RETURN false;
  END IF;

  SELECT "id" INTO v_role_id
  FROM public.roles
  WHERE "code" = 'HOST_STAFF';

  IF v_role_id IS NULL THEN
    RETURN false;
  END IF;

  DELETE FROM public.user_roles
  WHERE "user_id" = p_target_user_id
    AND "role_id" = v_role_id;

  v_deleted := FOUND;
  RETURN v_deleted;
END;
$$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'luggage_role_assigner') THEN
    ALTER FUNCTION public.assign_host_staff_role(uuid, uuid, jsonb) OWNER TO luggage_role_assigner;
    ALTER FUNCTION public.revoke_host_staff_role_if_unassigned(uuid, uuid, jsonb) OWNER TO luggage_role_assigner;
  END IF;
END $$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.assign_host_staff_role(uuid, uuid, jsonb) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.revoke_host_staff_role_if_unassigned(uuid, uuid, jsonb) FROM PUBLIC;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'luggage_user') THEN
    GRANT EXECUTE ON FUNCTION public.assign_host_staff_role(uuid, uuid, jsonb) TO luggage_user;
    GRANT EXECUTE ON FUNCTION public.revoke_host_staff_role_if_unassigned(uuid, uuid, jsonb) TO luggage_user;
  END IF;
END $$;
--> statement-breakpoint
