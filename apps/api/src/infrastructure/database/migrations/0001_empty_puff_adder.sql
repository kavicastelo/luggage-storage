CREATE INDEX "auth_sessions_previous_token_hash_idx" ON "auth_sessions" USING btree ("previous_token_hash");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_normalized_email_match_check" CHECK ("users"."normalized_email" = lower(trim("users"."email")));--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON "security_audit_events" FROM luggage_user;--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON "roles" FROM luggage_user;--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON "permissions" FROM luggage_user;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.prevent_audit_tampering()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'security_audit_events records are immutable: DELETE is prohibited';
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.user_id IS NOT NULL AND NEW.user_id IS NULL)
       AND NEW.id = OLD.id
       AND NEW.event_type = OLD.event_type
       AND NEW.created_at = OLD.created_at
       AND (NEW.ip_address IS NOT DISTINCT FROM OLD.ip_address)
       AND (NEW.user_agent IS NOT DISTINCT FROM OLD.user_agent)
       AND (NEW.metadata IS NOT DISTINCT FROM OLD.metadata) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'security_audit_events records are immutable: UPDATE is prohibited';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER trg_prevent_audit_tampering
BEFORE UPDATE OR DELETE ON "security_audit_events"
FOR EACH ROW
EXECUTE FUNCTION public.prevent_audit_tampering();
