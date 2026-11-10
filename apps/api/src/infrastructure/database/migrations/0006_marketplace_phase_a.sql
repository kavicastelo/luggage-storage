-- Phase A: Marketplace Foundation, Host Onboarding, Storage Location Management, Capacity & Pricing

-- 1. Host Businesses Table
CREATE TABLE IF NOT EXISTS "host_businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"legal_business_name" varchar(255) NOT NULL,
	"trade_name" varchar(255) NOT NULL,
	"business_registration_number" varchar(100),
	"entity_type" varchar(64) DEFAULT 'SOLE_PROPRIETORSHIP' NOT NULL,
	"tax_identifier" varchar(100),
	"contact_email" varchar(255) NOT NULL,
	"contact_phone" varchar(32) NOT NULL,
	"address_line1" varchar(255),
	"address_line2" varchar(255),
	"city" varchar(100),
	"postal_code" varchar(20),
	"country_code" varchar(2) DEFAULT 'LK' NOT NULL,
	"payout_bank_name" varchar(128),
	"payout_account_number" varchar(64),
	"payout_account_name" varchar(128),
	"payout_branch_code" varchar(32),
	"status" varchar(32) DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "host_businesses_status_check" CHECK ("status" IN ('DRAFT', 'PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'REJECTED')),
	CONSTRAINT "host_businesses_entity_type_check" CHECK ("entity_type" IN ('SOLE_PROPRIETORSHIP', 'PRIVATE_LIMITED', 'HOTEL', 'RETAIL_SHOP', 'PARTNERSHIP', 'OTHER'))
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "host_businesses" ADD CONSTRAINT "host_businesses_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "host_businesses_owner_user_id_idx" ON "host_businesses" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "host_businesses_status_idx" ON "host_businesses" USING btree ("status");--> statement-breakpoint

-- 2. Host Verifications Table
CREATE TABLE IF NOT EXISTS "host_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"submitted_by" uuid NOT NULL,
	"status" varchar(32) DEFAULT 'PENDING_REVIEW' NOT NULL,
	"reviewer_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"admin_notes" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "host_verifications_status_check" CHECK ("status" IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'INFORMATION_REQUESTED'))
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "host_verifications" ADD CONSTRAINT "host_verifications_business_id_host_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."host_businesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "host_verifications" ADD CONSTRAINT "host_verifications_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "host_verifications" ADD CONSTRAINT "host_verifications_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "host_verifications_business_id_idx" ON "host_verifications" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "host_verifications_status_idx" ON "host_verifications" USING btree ("status");--> statement-breakpoint

-- 3. Host Verification Documents Table
CREATE TABLE IF NOT EXISTS "host_verification_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"verification_id" uuid NOT NULL,
	"document_type" varchar(64) NOT NULL,
	"file_key" varchar(512) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"status" varchar(32) DEFAULT 'PENDING' NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "host_verification_docs_status_check" CHECK ("status" IN ('PENDING', 'VERIFIED', 'REJECTED'))
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "host_verification_documents" ADD CONSTRAINT "host_verification_documents_verification_id_fk" FOREIGN KEY ("verification_id") REFERENCES "public"."host_verifications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "host_verification_docs_verification_id_idx" ON "host_verification_documents" USING btree ("verification_id");--> statement-breakpoint

-- 4. Host Staff Memberships Table
CREATE TABLE IF NOT EXISTS "host_staff_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"staff_role" varchar(32) DEFAULT 'ATTENDANT' NOT NULL,
	"assigned_location_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "host_staff_role_check" CHECK ("staff_role" IN ('MANAGER', 'ATTENDANT'))
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "host_staff_memberships" ADD CONSTRAINT "host_staff_memberships_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."host_businesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "host_staff_memberships" ADD CONSTRAINT "host_staff_memberships_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "host_staff_business_user_unique" ON "host_staff_memberships" USING btree ("business_id", "user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "host_staff_user_id_idx" ON "host_staff_memberships" USING btree ("user_id");--> statement-breakpoint

-- 5. Storage Locations Table (with PostGIS Point Geography)
CREATE TABLE IF NOT EXISTS "storage_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"address_line1" varchar(255) NOT NULL,
	"address_line2" varchar(255),
	"city" varchar(100) NOT NULL,
	"postal_code" varchar(20),
	"country_code" varchar(2) DEFAULT 'LK' NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"coordinates" geography(Point, 4326) NOT NULL,
	"timezone" varchar(64) DEFAULT 'Asia/Colombo' NOT NULL,
	"booking_mode" varchar(32) DEFAULT 'INSTANT' NOT NULL,
	"accepts_oversized" boolean DEFAULT false NOT NULL,
	"amenities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(32) DEFAULT 'DRAFT' NOT NULL,
	"rejection_reason" text,
	"admin_notes" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "storage_locations_status_check" CHECK ("status" IN ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'DISABLED', 'REJECTED')),
	CONSTRAINT "storage_locations_booking_mode_check" CHECK ("booking_mode" IN ('INSTANT', 'HOST_APPROVAL'))
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "storage_locations" ADD CONSTRAINT "storage_locations_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."host_businesses"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "storage_locations" ADD CONSTRAINT "storage_locations_reviewed_by_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "storage_locations_business_id_idx" ON "storage_locations" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "storage_locations_status_idx" ON "storage_locations" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "storage_locations_city_idx" ON "storage_locations" USING btree ("city");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "storage_locations_coordinates_gist_idx" ON "storage_locations" USING gist ("coordinates");--> statement-breakpoint

-- 6. Location Media Table
CREATE TABLE IF NOT EXISTS "location_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"file_key" varchar(512) NOT NULL,
	"url" varchar(1024) NOT NULL,
	"media_type" varchar(32) DEFAULT 'IMAGE' NOT NULL,
	"caption" varchar(255),
	"is_primary" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "location_media" ADD CONSTRAINT "location_media_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."storage_locations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "location_media_location_id_idx" ON "location_media" USING btree ("location_id");--> statement-breakpoint

-- 7. Storage Zones Table
CREATE TABLE IF NOT EXISTS "storage_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"zone_type" varchar(32) DEFAULT 'BACKROOM' NOT NULL,
	"security_tier" varchar(32) DEFAULT 'STANDARD' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "storage_zones_zone_type_check" CHECK ("zone_type" IN ('LOCKER', 'BACKROOM', 'FRONT_DESK', 'BASEMENT', 'RACK', 'OTHER')),
	CONSTRAINT "storage_zones_security_tier_check" CHECK ("security_tier" IN ('STANDARD', 'HIGH_SECURITY'))
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "storage_zones" ADD CONSTRAINT "storage_zones_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."storage_locations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "storage_zones_location_id_idx" ON "storage_zones" USING btree ("location_id");--> statement-breakpoint

-- 8. Opening Hours Table (Weekly Recurring)
CREATE TABLE IF NOT EXISTS "opening_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"open_time" varchar(8) NOT NULL,
	"close_time" varchar(8) NOT NULL,
	"allows_dropoff" boolean DEFAULT true NOT NULL,
	"allows_collection" boolean DEFAULT true NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opening_hours_day_check" CHECK ("day_of_week" BETWEEN 1 AND 7)
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "opening_hours" ADD CONSTRAINT "opening_hours_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."storage_locations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "opening_hours_location_id_idx" ON "opening_hours" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "opening_hours_loc_day_unique" ON "opening_hours" USING btree ("location_id", "day_of_week");--> statement-breakpoint

-- 9. Opening Hours Exceptions Table
CREATE TABLE IF NOT EXISTS "opening_hours_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"exception_date" varchar(10) NOT NULL,
	"exception_type" varchar(32) DEFAULT 'CLOSURE' NOT NULL,
	"open_time" varchar(8),
	"close_time" varchar(8),
	"reason" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opening_hours_exceptions_type_check" CHECK ("exception_type" IN ('CLOSURE', 'SPECIAL_HOURS'))
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "opening_hours_exceptions" ADD CONSTRAINT "opening_hours_exceptions_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."storage_locations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "opening_hours_exceptions_location_id_idx" ON "opening_hours_exceptions" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "opening_hours_exceptions_loc_date_unique" ON "opening_hours_exceptions" USING btree ("location_id", "exception_date");--> statement-breakpoint

-- 10. Storage Capacity Pools Table
CREATE TABLE IF NOT EXISTS "storage_capacity_pools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"zone_id" uuid,
	"pool_type" varchar(32) DEFAULT 'SHARED' NOT NULL,
	"dedicated_bag_category" varchar(32),
	"total_units" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "storage_capacity_pools_type_check" CHECK ("pool_type" IN ('SHARED', 'DEDICATED')),
	CONSTRAINT "storage_capacity_pools_category_check" CHECK ("dedicated_bag_category" IS NULL OR "dedicated_bag_category" IN ('BAG_SMALL', 'BAG_MEDIUM', 'BAG_LARGE', 'BAG_OVERSIZED')),
	CONSTRAINT "storage_capacity_pools_units_check" CHECK ("total_units" > 0)
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "storage_capacity_pools" ADD CONSTRAINT "storage_capacity_pools_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."storage_locations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "storage_capacity_pools" ADD CONSTRAINT "storage_capacity_pools_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."storage_zones"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "storage_capacity_pools_location_id_idx" ON "storage_capacity_pools" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "storage_capacity_pools_zone_id_idx" ON "storage_capacity_pools" USING btree ("zone_id");--> statement-breakpoint

-- 11. Pricing Policies Table
CREATE TABLE IF NOT EXISTS "pricing_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"currency" varchar(3) DEFAULT 'LKR' NOT NULL,
	"pricing_unit" varchar(32) DEFAULT 'CALENDAR_DAY' NOT NULL,
	"base_rate_minor" integer NOT NULL,
	"status" varchar(32) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pricing_policies_pricing_unit_check" CHECK ("pricing_unit" IN ('CALENDAR_DAY', '24_HOUR_BLOCK')),
	CONSTRAINT "pricing_policies_status_check" CHECK ("status" IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
	CONSTRAINT "pricing_policies_base_rate_check" CHECK ("base_rate_minor" > 0)
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "pricing_policies" ADD CONSTRAINT "pricing_policies_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."storage_locations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "pricing_policies_location_id_idx" ON "pricing_policies" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pricing_policies_status_idx" ON "pricing_policies" USING btree ("status");--> statement-breakpoint

-- 12. Pricing Tier Rates Table
CREATE TABLE IF NOT EXISTS "pricing_tier_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"bag_category" varchar(32) NOT NULL,
	"rate_minor" integer NOT NULL,
	"category_multiplier_bps" integer DEFAULT 10000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pricing_tier_rates_category_check" CHECK ("bag_category" IN ('BAG_SMALL', 'BAG_MEDIUM', 'BAG_LARGE', 'BAG_OVERSIZED')),
	CONSTRAINT "pricing_tier_rates_rate_check" CHECK ("rate_minor" >= 0),
	CONSTRAINT "pricing_tier_rates_multiplier_check" CHECK ("category_multiplier_bps" > 0)
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "pricing_tier_rates" ADD CONSTRAINT "pricing_tier_rates_policy_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."pricing_policies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "pricing_tier_rates_policy_id_idx" ON "pricing_tier_rates" USING btree ("policy_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pricing_tier_rates_policy_cat_unique" ON "pricing_tier_rates" USING btree ("policy_id", "bag_category");--> statement-breakpoint

-- 13. Marketplace Permissions
INSERT INTO "permissions" (code, name, description, module)
VALUES
  ('hosts.business.create', 'Create Host Business', 'Register a new host business profile', 'hosts'),
  ('hosts.business.read_own', 'Read Own Host Business', 'View owned host businesses and details', 'hosts'),
  ('hosts.business.update_own', 'Update Own Host Business', 'Update owned host business information', 'hosts'),
  ('hosts.verification.submit', 'Submit Host Verification', 'Submit business documents and identity verification', 'hosts'),
  ('hosts.verification.read_own', 'Read Own Verification', 'View verification submission status and review notes', 'hosts'),
  ('hosts.location.create', 'Create Storage Location', 'Create a new storage location under an owned business', 'locations'),
  ('hosts.location.read_own', 'Read Own Locations', 'View locations owned by host business', 'locations'),
  ('hosts.location.update_own', 'Update Own Location', 'Edit storage location details and configuration', 'locations'),
  ('hosts.location.submit', 'Submit Location for Review', 'Submit storage location for Superadmin approval', 'locations'),
  ('hosts.location.disable', 'Disable Storage Location', 'Temporarily or permanently disable a storage location', 'locations'),
  ('hosts.location.configure', 'Configure Location Attributes', 'Manage hours, zones, capacity, and pricing policies', 'locations'),
  ('admin.host.read', 'Read Any Host Business', 'Inspect any host business and verification submissions', 'admin'),
  ('admin.host.verify', 'Verify Host Business', 'Approve, reject, or request information on host verifications', 'admin'),
  ('admin.location.read', 'Read Any Storage Location', 'Inspect any storage location across the marketplace', 'admin'),
  ('admin.location.moderate', 'Moderate Storage Location', 'Approve or reject storage location listings', 'admin'),
  ('upload.initiate', 'Initiate Secure Upload', 'Request pre-signed upload URLs for documents and media', 'uploads')
ON CONFLICT (code) DO NOTHING;--> statement-breakpoint

-- 14. Map Permissions to Roles
DO $$
DECLARE
  v_superadmin_id uuid;
  v_host_owner_id uuid;
  v_host_staff_id uuid;
  v_support_id uuid;
  v_traveller_id uuid;
BEGIN
  -- SUPERADMIN: Receives ALL permissions
  SELECT id INTO v_superadmin_id FROM public.roles WHERE code = 'SUPERADMIN';
  IF v_superadmin_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_superadmin_id, p.id FROM public.permissions p
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- HOST_OWNER: Receives host management and upload permissions
  SELECT id INTO v_host_owner_id FROM public.roles WHERE code = 'HOST_OWNER';
  IF v_host_owner_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_host_owner_id, p.id FROM public.permissions p
    WHERE p.code LIKE 'hosts.%' OR p.code = 'upload.initiate'
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- HOST_STAFF: Receives operational read permissions
  SELECT id INTO v_host_staff_id FROM public.roles WHERE code = 'HOST_STAFF';
  IF v_host_staff_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_host_staff_id, p.id FROM public.permissions p
    WHERE p.code IN ('hosts.business.read_own', 'hosts.location.read_own')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- SUPPORT: Receives read-only inspection permissions
  SELECT id INTO v_support_id FROM public.roles WHERE code = 'SUPPORT';
  IF v_support_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_support_id, p.id FROM public.permissions p
    WHERE p.code IN ('admin.host.read', 'admin.location.read')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- TRAVELLER: Receives upload permission (for support/dispute evidence)
  SELECT id INTO v_traveller_id FROM public.roles WHERE code = 'TRAVELLER';
  IF v_traveller_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_traveller_id, p.id FROM public.permissions p
    WHERE p.code IN ('upload.initiate')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;
END
$$;--> statement-breakpoint

-- 15. Least-Privilege Table Grants for Application User
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'luggage_user') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.host_businesses TO luggage_user;
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.host_verifications TO luggage_user;
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.host_verification_documents TO luggage_user;
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.host_staff_memberships TO luggage_user;
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.storage_locations TO luggage_user;
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.location_media TO luggage_user;
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.storage_zones TO luggage_user;
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.opening_hours TO luggage_user;
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.opening_hours_exceptions TO luggage_user;
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.storage_capacity_pools TO luggage_user;
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pricing_policies TO luggage_user;
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pricing_tier_rates TO luggage_user;
    END IF;
END
$$;

