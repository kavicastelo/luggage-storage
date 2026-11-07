# Phase 1A-RC3-C3 Database Runtime Least-Privilege Verification

- **Project:** Global Luggage Storage Marketplace
- **Document ID:** ENG-DB-1A-RC3-C3-001
- **Phase:** Phase 1A-RC3-C3 — Evidence Reconciliation
- **Date:** 2026-11-07
- **Classification:** Engineering & Security Deliverable
- **Status:** VERIFIED & HARDENED

---

## 1. Executive Summary

This deliverable records the comprehensive security review, architectural hardening, and empirical verification of the database runtime privilege model for the Global Luggage Storage Marketplace.

In Phase 1A-RC3-C2, superuser privileges were stripped from the application user `luggage_user`. In Phase 1A-RC3-C3, an in-depth least-privilege audit was conducted on schema-level permissions. Specifically, the previously granted `CREATE ON SCHEMA public` was audited against actual backend runtime requirements.

**Key Outcome:**
The audit confirmed that the backend runtime (`apps/api`) performs strictly data-level queries (DML: `SELECT`, `INSERT`, `UPDATE`, `DELETE`), sequence operations, and PostGIS function evaluations. **The runtime application never executes DDL** (`CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`). Consequently, `CREATE ON SCHEMA public` was formally **revoked** from `luggage_user`, closing an unnecessary attack surface and establishing a true least-privilege runtime security boundary.

---

## 2. 3-Tier Database Responsibility & Role Model

```
+----------------------------------------------------------------------------------------------------+
|                                    DATABASE ROLE ARCHITECTURE                                      |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  [ TIER 1: Database Administrator (Role: postgres) ]                                               |
|    - rolsuper: TRUE                                                                                |
|    - Responsibilities: Database provisioning, extension maintenance (PostGIS), container init     |
|    - Isolation: Strictly isolated from application processes and external networks                |
|                                                                                                    |
|  [ TIER 2: Schema Migration / Deployment Role (Role: luggage_migrator / CI Deployer) ]             |
|    - rolsuper: FALSE  |  rolcreaterole: FALSE  |  rolcreatedb: FALSE                               |
|    - Privileges: USAGE, CREATE ON SCHEMA public; Table/Sequence Ownership                         |
|    - Responsibilities: Execution of Drizzle ORM schema migrations and DDL alterations              |
|    - Execution Mode: Ephemeral execution during automated deployment pipelines                     |
|                                                                                                    |
|  [ TIER 3: Application Runtime Role (Role: luggage_user) ]                                         |
|    - rolsuper: FALSE  |  rolcreaterole: FALSE  |  rolcreatedb: FALSE                               |
|    - Privileges: CONNECT ON DATABASE luggage_storage_dev                                           |
|                  USAGE ON SCHEMA public (CREATE REVOKED)                                           |
|                  SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public                     |
|                  USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public                           |
|                  EXECUTE ON ALL FUNCTIONS IN SCHEMA public (PostGIS spatial queries)               |
|    - Responsibilities: Backend API runtime traffic, readiness probes, domain data persistence       |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

---

## 3. Evaluation of Schema `CREATE` Permission

### 3.1 Code Inspection of Runtime Requirements
Inspection of the backend codebase (`apps/api/src/infrastructure/database/connection.ts` and `drizzle.ts`) revealed:
1. `checkDatabaseConnection()` executes `SELECT 1 AS connected` and `SELECT PostGIS_Version() AS version`.
2. Drizzle client `db = drizzle(dbPool)` is used solely for entity CRUD operations.
3. Zero application code paths issue DDL commands at runtime.

### 3.2 Risk of Granting Schema `CREATE` to Runtime Applications
Granting `CREATE ON SCHEMA public` to the application runtime role violates least-privilege principles. In the event of an SQL injection vulnerability or runtime exploit, retaining `CREATE` privilege enables an attacker to:
- Create arbitrary malicious tables or shadow tables.
- Replace or overlay database views.
- Create malicious stored procedures or untrusted functions.
- Exhaust database storage by creating unmonitored objects.

By explicitly revoking `CREATE ON SCHEMA public`, the database tier enforces defense-in-depth: even under hypothetical application compromise, the database engine physically rejects any attempt to alter schema structure.

---

## 4. Hardened Initialization Script (`infrastructure/docker/init.sql`)

The initialization script was updated to ensure that fresh container initializations deterministically apply this hardened role model:

```sql
-- Automatic initialization for Global Luggage Storage Marketplace local development
-- Ensures required database roles, permissions, and extensions are configured.
--
-- SECURITY NOTE:
-- The credentials defined below ('luggage_user' / 'luggage_password') are strictly intended
-- for local development and CI testing environments bound to localhost (127.0.0.1).
-- Production deployments must provision credentials dynamically via secrets management
-- (e.g. AWS Secrets Manager, GCP Secret Manager, Vault) and enforce least-privilege RBAC.

-- 1. Enable required extensions (executed as superuser during initialization)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- 2. Create the application runtime user without elevated privileges
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'luggage_user') THEN
    CREATE ROLE luggage_user WITH LOGIN PASSWORD 'luggage_password';
  ELSE
    ALTER ROLE luggage_user WITH LOGIN PASSWORD 'luggage_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

-- 3. Grant connection rights to the target database
GRANT CONNECT ON DATABASE luggage_storage_dev TO luggage_user;

-- 4. Schema privileges: Grant USAGE on schema public, and explicitly REVOKE CREATE
-- Application runtime role has zero DDL privileges (cannot CREATE/ALTER/DROP schema objects)
GRANT USAGE ON SCHEMA public TO luggage_user;
REVOKE CREATE ON SCHEMA public FROM luggage_user;

-- 5. Data privileges: Grant DML (SELECT, INSERT, UPDATE, DELETE) on tables, sequences, functions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO luggage_user;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO luggage_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO luggage_user;

-- 6. Default privileges: Ensure future objects created by administrator/migrator grant DML to runtime role
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO luggage_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO luggage_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO luggage_user;
```

---

## 5. Empirical Verification Evidence

### 5.1 Non-Destructive Testing in Disposable Database (`test_c3_disposable_db`)
To protect the development database from unintended side effects during privilege boundary testing, a dedicated disposable database was provisioned on `luggage_storage_postgres`:

```sql
CREATE DATABASE test_c3_disposable_db;
```

#### Privilege State Verification
```sql
SELECT has_schema_privilege('luggage_user', 'public', 'USAGE') as usage_priv, 
       has_schema_privilege('luggage_user', 'public', 'CREATE') as create_priv;
```
*Result:*
```
 usage_priv | create_priv 
------------+-------------
 t          | f
```

#### DML Operation Verification under `luggage_user`
```sql
INSERT INTO migration_created_table (title) VALUES ('runtime_row');
SELECT * FROM migration_created_table;
UPDATE migration_created_table SET title = 'updated_runtime_row' WHERE id = 1;
DELETE FROM migration_created_table WHERE id = 1;
```
*Result:* All 4 DML operations completed with exit code 0 (`INSERT 0 1`, `UPDATE 1`, `DELETE 1`).

#### DDL Denial Verification under `luggage_user`
1. **Attempted Table Creation:**
   ```sql
   CREATE TABLE runtime_unauthorized_table (id int);
   ```
   *Result:*
   ```
   ERROR:  permission denied for schema public
   LINE 1: CREATE TABLE runtime_unauthorized_table (id int);
   ```
2. **Attempted Table Drop:**
   ```sql
   DROP TABLE migration_created_table;
   ```
   *Result:*
   ```
   ERROR:  must be owner of table migration_created_table
   ```
3. **Attempted Role Creation:**
   ```sql
   CREATE ROLE malicious_user WITH LOGIN;
   ```
   *Result:*
   ```
   ERROR:  permission denied to create role
   DETAIL:  Only roles with the CREATEROLE attribute may create roles.
   ```

*Teardown:* Disposable database cleanly destroyed (`DROP DATABASE test_c3_disposable_db;`).

---

### 5.2 Verification on Development Database (`luggage_storage_dev`)

The least-privilege configuration was applied to `luggage_storage_dev`:

```sql
SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolcanlogin FROM pg_roles WHERE rolname='luggage_user';
SELECT has_schema_privilege('luggage_user', 'public', 'USAGE') as usage_priv, 
       has_schema_privilege('luggage_user', 'public', 'CREATE') as create_priv;
```
*Result:*
```
   rolname    | rolsuper | rolcreaterole | rolcreatedb | rolcanlogin 
--------------+----------+---------------+-------------+-------------
 luggage_user | f        | f             | f           | t

 usage_priv | create_priv 
------------+-------------
 t          | f
```

### 5.3 Fastify API Health & Readiness Integration Verification

Executed automated test suite:
```
$ vitest run apps/api

stdout | tests/live-database.test.ts > Live PostgreSQL and PostGIS Verification
Live DB Status: {
  "ok": true,
  "postgisVersion": "3.5 USE_GEOS=1 USE_PROJ=1 USE_STATS=1"
}

GET /ready response status: 200
GET /ready response body: {
  "success": true,
  "data": {
    "status": "ready",
    "database": {
      "connected": true,
      "postgis": "3.5 USE_GEOS=1 USE_PROJ=1 USE_STATS=1"
    }
  }
}

Test Files  2 passed (2)
     Tests  7 passed (7)
```
The Fastify application starts, verifies database connectivity, verifies PostGIS version, and serves `/ready` probes with HTTP 200 without requiring `CREATE` privilege on schema `public`.

---

## 6. Initialization Lifecycle Distinctions

To ensure clear operational governance, the four database lifecycles are explicitly defined:

1. **First-Time Docker Entrypoint Initialization:**
   Occurs only when a container starts with an empty/uninitialized data directory (`/var/lib/postgresql/data`). PostgreSQL executes all scripts in `/docker-entrypoint-initdb.d/` as the administrative user (`POSTGRES_USER`). `init.sql` enables PostGIS and configures the least-privilege `luggage_user` role.
2. **Manual Application of Changed Initialization Scripts:**
   When `init.sql` is modified in the repository, Docker **does NOT** automatically re-execute entrypoint scripts against an existing persistent volume. The script must be applied manually via `psql -U postgres -f init.sql`.
3. **Persistent-Volume Restart:**
   Occurs during normal container restarts (`docker restart` or `docker compose up`). The existing cluster in the volume is booted directly; `/docker-entrypoint-initdb.d/` scripts are skipped; existing roles, schemas, and data remain preserved.
4. **Database Migration Execution:**
   Executed during deployment or CI processes via Drizzle ORM migrations under a designated migration role or database administrator. Migrations apply versioned schema changes independently of container startup.

---

## 7. Privilege Matrix Summary

| Privilege | Database Admin (`postgres`) | Migration Role (`luggage_migrator`) | Runtime Role (`luggage_user`) |
| :--- | :---: | :---: | :---: |
| `rolsuper` | **TRUE** | FALSE | FALSE |
| `rolcreatedb` | **TRUE** | FALSE | FALSE |
| `rolcreaterole` | **TRUE** | FALSE | FALSE |
| `CONNECT ON DATABASE` | **TRUE** | **TRUE** | **TRUE** |
| `USAGE ON SCHEMA public` | **TRUE** | **TRUE** | **TRUE** |
| `CREATE ON SCHEMA public` | **TRUE** | **TRUE** | **DENIED (REVOKED)** |
| `SELECT, INSERT, UPDATE, DELETE` | **TRUE** | **TRUE** | **TRUE** |
| `USAGE ON SEQUENCES` | **TRUE** | **TRUE** | **TRUE** |
| `EXECUTE ON POSTGIS FUNCTIONS`| **TRUE** | **TRUE** | **TRUE** |
| `CREATE/DROP/ALTER TABLES` | **TRUE** | **TRUE** | **DENIED** |

