-- 1. Remove cascading actor foreign key constraint from security_audit_events
ALTER TABLE "security_audit_events" DROP CONSTRAINT IF EXISTS "security_audit_events_user_id_users_id_fk";
--> statement-breakpoint

-- 2. Update audit immutability trigger function to unconditionally reject ALL UPDATE and DELETE
CREATE OR REPLACE FUNCTION public.prevent_audit_tampering()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'security_audit_events records are immutable: DELETE is prohibited';
  ELSIF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'security_audit_events records are immutable: UPDATE is prohibited';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- 3. Ensure trigger is attached
DROP TRIGGER IF EXISTS trg_prevent_audit_tampering ON "security_audit_events";
--> statement-breakpoint
CREATE TRIGGER trg_prevent_audit_tampering
BEFORE UPDATE OR DELETE ON "security_audit_events"
FOR EACH ROW
EXECUTE FUNCTION public.prevent_audit_tampering();
--> statement-breakpoint

-- 4. Correct luggage_user privileges on catalog and join tables
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "roles" FROM luggage_user;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "permissions" FROM luggage_user;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "role_permissions" FROM luggage_user;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "user_roles" FROM luggage_user;
--> statement-breakpoint
GRANT SELECT ON "roles", "permissions", "role_permissions", "user_roles" TO luggage_user;
--> statement-breakpoint

-- 5. Create default registration role assignment function
CREATE OR REPLACE FUNCTION public.assign_default_traveller_role(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role_id uuid;
BEGIN
  -- Verify user exists in users table
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Cannot assign role: user % does not exist', p_user_id;
  END IF;

  -- Resolve the TRAVELLER role ID internally
  SELECT id INTO v_role_id FROM public.roles WHERE code = 'TRAVELLER';
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'System role TRAVELLER not found';
  END IF;

  -- Insert assignment idempotently
  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (p_user_id, v_role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;
END;
$$;
--> statement-breakpoint

-- 6. Set function ownership to dedicated role assigner if provisioned
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'luggage_role_assigner') THEN
    ALTER FUNCTION public.assign_default_traveller_role(uuid) OWNER TO luggage_role_assigner;
    GRANT SELECT ON public.users TO luggage_role_assigner;
    GRANT SELECT ON public.roles TO luggage_role_assigner;
    GRANT SELECT, INSERT ON public.user_roles TO luggage_role_assigner;
  END IF;
END $$;
--> statement-breakpoint

-- 7. Grant execution only to runtime role
REVOKE ALL ON FUNCTION public.assign_default_traveller_role(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.assign_default_traveller_role(uuid) TO luggage_user;
--> statement-breakpoint

-- 8. Ensure default system role TRAVELLER exists
INSERT INTO "roles" (code, name, description, is_system)
VALUES ('TRAVELLER', 'Traveller', 'Default consumer traveller role', true)
ON CONFLICT (code) DO NOTHING;
