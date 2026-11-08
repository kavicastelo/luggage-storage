-- 1. Insert Permission Catalogue
INSERT INTO "permissions" (code, name, description, module)
VALUES
  -- Identity module
  ('identity.profile.read', 'Read Own Profile', 'View own user profile and persona contexts', 'identity'),
  ('identity.profile.update', 'Update Own Profile', 'Update own user profile details and preferences', 'identity'),
  ('identity.session.read_own', 'Read Own Sessions', 'View own active authentication sessions and devices', 'identity'),
  ('identity.session.revoke_own', 'Revoke Own Session', 'Revoke own active authentication sessions', 'identity'),
  ('identity.password.change', 'Change Own Password', 'Change own account password while preserving session', 'identity'),

  -- Admin user management
  ('admin.user.read', 'Read Users', 'View and search user accounts, profiles, and active session counts', 'admin'),
  ('admin.user.suspend', 'Suspend User', 'Suspend user accounts and immediately revoke active sessions', 'admin'),
  ('admin.user.reinstate', 'Reinstate User', 'Reinstate suspended user accounts to active status', 'admin'),
  ('admin.user.deactivate', 'Deactivate User', 'Deactivate user accounts and revoke active sessions', 'admin'),
  ('admin.user.reactivate', 'Reactivate User', 'Reactivate deactivated user accounts to active status', 'admin'),
  ('admin.user.verify_email', 'Verify User Email', 'Administratively override and confirm user email verification', 'admin'),

  -- Admin session management
  ('admin.session.read_any', 'Read Any Session', 'Inspect active authentication sessions of any user', 'admin'),
  ('admin.session.revoke_any', 'Revoke Any Session', 'Administratively terminate active sessions of any user', 'admin'),

  -- Admin role & permission management
  ('admin.role.read', 'Read Roles', 'View system roles, assigned permissions, and user role assignments', 'admin'),
  ('admin.role.assign', 'Assign Roles', 'Assign system roles to user accounts', 'admin'),
  ('admin.role.revoke', 'Revoke Roles', 'Revoke assigned system roles from user accounts', 'admin'),
  ('admin.permission.read', 'Read Permissions', 'View the system permission catalogue and role mappings', 'admin'),

  -- Admin audit & platform governance
  ('admin.audit.read', 'Read Audit Logs', 'Inspect immutable security audit event logs', 'admin'),
  ('admin.platform.manage', 'Platform Governance', 'Full platform governance, security settings, and global policies', 'admin'),
  ('admin.kyc.manage', 'KYC Management', 'Review, approve, or reject Host business verification and KYC documents', 'admin'),
  ('admin.financial.manage', 'Financial Management', 'Manage platform commissions, payouts, refunds, and financial ledgers', 'admin'),

  -- Support operations
  ('support.ticket.read', 'Read Support Tickets', 'View customer support tickets, inquiries, and customer context', 'support'),
  ('support.ticket.update', 'Update Support Tickets', 'Respond to and update status of customer support tickets', 'support')
ON CONFLICT (code) DO NOTHING;
--> statement-breakpoint

-- 2. Map Permissions to System Roles
DO $$
DECLARE
  v_role_id uuid;
BEGIN
  -- SUPERADMIN: Receives ALL permissions
  SELECT id INTO v_role_id FROM public.roles WHERE code = 'SUPERADMIN';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM public.permissions p
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- SUPPORT: Receives operational support permissions ONLY
  SELECT id INTO v_role_id FROM public.roles WHERE code = 'SUPPORT';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM public.permissions p
    WHERE p.code IN (
      'identity.profile.read',
      'identity.profile.update',
      'identity.session.read_own',
      'identity.session.revoke_own',
      'identity.password.change',
      'admin.user.read',
      'admin.user.suspend',
      'admin.user.reinstate',
      'admin.user.deactivate',
      'admin.user.reactivate',
      'admin.user.verify_email',
      'admin.session.read_any',
      'admin.session.revoke_any',
      'admin.role.read',
      'admin.permission.read',
      'support.ticket.read',
      'support.ticket.update'
    )
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- HOST_OWNER: Identity permissions only
  SELECT id INTO v_role_id FROM public.roles WHERE code = 'HOST_OWNER';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM public.permissions p
    WHERE p.code LIKE 'identity.%'
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- HOST_STAFF: Identity permissions only
  SELECT id INTO v_role_id FROM public.roles WHERE code = 'HOST_STAFF';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM public.permissions p
    WHERE p.code LIKE 'identity.%'
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- TRAVELLER: Identity permissions only
  SELECT id INTO v_role_id FROM public.roles WHERE code = 'TRAVELLER';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM public.permissions p
    WHERE p.code LIKE 'identity.%'
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;
END $$;
--> statement-breakpoint

-- 3. Controlled Role Assignment & Revocation Functions (SECURITY DEFINER)
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
BEGIN
  -- Verify user exists
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Cannot assign role: user % does not exist', p_user_id;
  END IF;

  -- Resolve role
  SELECT id INTO v_role_id FROM public.roles WHERE code = p_role_code;
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Cannot assign role: role % does not exist', p_role_code;
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
BEGIN
  -- Resolve role
  SELECT id INTO v_role_id FROM public.roles WHERE code = p_role_code;
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Cannot revoke role: role % does not exist', p_role_code;
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

-- 4. Set ownership and grant execution privileges
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'luggage_role_assigner') THEN
    ALTER FUNCTION public.assign_user_role(uuid, varchar, uuid) OWNER TO luggage_role_assigner;
    ALTER FUNCTION public.revoke_user_role(uuid, varchar) OWNER TO luggage_role_assigner;
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
