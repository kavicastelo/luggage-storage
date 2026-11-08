-- Phase Stabilization: Self-Service Email Verification Tokens, Multi-Instance Rate Limits, and Function Privilege Hardening

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp with time zone;--> statement-breakpoint

UPDATE "users"
SET "email_verified_at" = "updated_at"
WHERE "is_email_verified" = true AND "email_verified_at" IS NULL;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "email_verification_tokens_token_hash_unique" ON "email_verification_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_verification_tokens_user_expires_idx" ON "email_verification_tokens" USING btree ("user_id","expires_at");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "auth_rate_limits" (
	"key_hash" varchar(64) PRIMARY KEY NOT NULL,
	"scope" varchar(32) NOT NULL,
	"points" integer DEFAULT 1 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "auth_rate_limits_expires_at_idx" ON "auth_rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_rate_limits_scope_idx" ON "auth_rate_limits" USING btree ("scope");--> statement-breakpoint

-- Least-privilege table & function execution grants
REVOKE ALL ON FUNCTION public.prevent_audit_tampering() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.assign_user_role(UUID, VARCHAR, UUID) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.revoke_user_role(UUID, VARCHAR) FROM PUBLIC;--> statement-breakpoint

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'luggage_user') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.email_verification_tokens TO luggage_user;
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.auth_rate_limits TO luggage_user;
        GRANT EXECUTE ON FUNCTION public.prevent_audit_tampering() TO luggage_user;
        GRANT EXECUTE ON FUNCTION public.assign_user_role(UUID, VARCHAR, UUID) TO luggage_user;
        GRANT EXECUTE ON FUNCTION public.revoke_user_role(UUID, VARCHAR) TO luggage_user;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'luggage_migrator') THEN
        GRANT EXECUTE ON FUNCTION public.prevent_audit_tampering() TO luggage_migrator;
        GRANT EXECUTE ON FUNCTION public.assign_user_role(UUID, VARCHAR, UUID) TO luggage_migrator;
        GRANT EXECUTE ON FUNCTION public.revoke_user_role(UUID, VARCHAR) TO luggage_migrator;
    END IF;
END
$$;
