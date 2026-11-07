-- Automatic initialization for Global Luggage Storage Marketplace local development
-- Ensures required database roles, permissions, and extensions are configured.
--
-- SECURITY NOTE:
-- The credentials defined below ('luggage_user' / 'luggage_password', 'luggage_migrator' / 'migrator_password')
-- are strictly intended for local development and CI testing environments bound to localhost (127.0.0.1).
-- Production deployments must provision credentials dynamically via secrets management
-- (e.g. AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault) and enforce least-privilege RBAC.

-- 1. Enable required extensions (executed as superuser during initialization)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- 2. Create the Schema Migration Role (Tier 2: Authorized DDL execution)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'luggage_migrator') THEN
    CREATE ROLE luggage_migrator WITH LOGIN PASSWORD 'migrator_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
  ELSE
    ALTER ROLE luggage_migrator WITH LOGIN PASSWORD 'migrator_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

-- 3. Create the Application Runtime User (Tier 3: Runtime DML execution)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'luggage_user') THEN
    CREATE ROLE luggage_user WITH LOGIN PASSWORD 'luggage_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
  ELSE
    ALTER ROLE luggage_user WITH LOGIN PASSWORD 'luggage_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

-- 4. Database-level Connection Grants
GRANT CONNECT ON DATABASE luggage_storage_dev TO luggage_migrator;
GRANT CONNECT ON DATABASE luggage_storage_dev TO luggage_user;

-- 5. Tier 2 Migration Role Privileges (Requires USAGE and CREATE on schema public for migrations)
GRANT USAGE, CREATE ON SCHEMA public TO luggage_migrator;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO luggage_migrator;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO luggage_migrator;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO luggage_migrator;

-- Ensure objects created by administrator or runtime grant privileges to migrator
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO luggage_migrator;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO luggage_migrator;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO luggage_migrator;

-- 6. Tier 3 Runtime Role Privileges (Restricted to USAGE and DML; zero DDL privileges)
GRANT USAGE ON SCHEMA public TO luggage_user;
REVOKE CREATE ON SCHEMA public FROM luggage_user;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO luggage_user;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO luggage_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO luggage_user;

-- Ensure objects created by migrator or administrator automatically grant DML to runtime role
ALTER DEFAULT PRIVILEGES FOR ROLE luggage_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO luggage_user;
ALTER DEFAULT PRIVILEGES FOR ROLE luggage_migrator IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO luggage_user;
ALTER DEFAULT PRIVILEGES FOR ROLE luggage_migrator IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO luggage_user;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO luggage_user;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO luggage_user;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO luggage_user;
