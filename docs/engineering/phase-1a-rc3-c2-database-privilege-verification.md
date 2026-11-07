# Phase 1A-RC3-C2 Database Privilege & Initialization Verification

- **Project:** Global Luggage Storage Marketplace
- **Document ID:** ENG-DB-1A-RC3-C2-001
- **Phase:** Phase 1A-RC3-C2 — Foundation Corrections
- **Date:** 2026-11-07
- **Classification:** Engineering & Security Deliverable
- **Status:** VERIFIED & COMPLETE

---

## 1. Executive Summary

This deliverable verifies the remediation of database initialization scripts and the enforcement of the **principle of least privilege** for the Global Luggage Storage Marketplace database tier.

In Phase 1A-RC3-C1, the initialization script (`infrastructure/docker/init.sql`) improperly assigned `SUPERUSER` privileges to the primary application database role (`luggage_user`). In this work package (WP-03), the initialization script has been refactored to enforce strict least-privilege role boundaries, separate administrative privileges from application runtime privileges, and guarantee deterministic initialization and volume persistence across both fresh environments and persistent restarts.

All tests were independently executed against **PostgreSQL 16.15 (Alpine)** and **PostGIS 3.5.7** running in Docker, bound strictly to `127.0.0.1:5432`.

---

## 2. Least-Privilege Architecture & Security Controls

```
+----------------------------------------------------------------------------------------+
|                               DATABASE SECURITY BOUNDARIES                             |
+----------------------------------------------------------------------------------------+
|                                                                                        |
|  [ postgres (Superuser / Admin Role) ]                                                 |
|    - Responsible for database creation, extension installation (PostGIS), container init|
|    - Not used by backend applications or API runtime                                  |
|                                                                                        |
|  [ luggage_user (Application Role - Least Privilege) ]                                 |
|    - rolsuper: FALSE  |  rolcreaterole: FALSE  |  rolcreatedb: FALSE                   |
|    - CONNECT ON DATABASE luggage_storage_dev                                           |
|    - USAGE, CREATE ON SCHEMA public (Drizzle ORM migration execution)                  |
|    - ALL PRIVILEGES ON TABLES, SEQUENCES, FUNCTIONS in public schema                   |
|    - DEFAULT PRIVILEGES for future objects created in public schema                    |
|                                                                                        |
+----------------------------------------------------------------------------------------+
```

### 2.1 Refactored Initialization Script (`infrastructure/docker/init.sql`)

The script is fully idempotent and safely distinguishes administrative setup from application runtime roles:

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

-- 2. Create the application user without SUPERUSER privileges
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

-- 4. Grant schema permissions for table creation and management (Drizzle ORM migrations)
GRANT USAGE, CREATE ON SCHEMA public TO luggage_user;

-- 5. Grant privileges on all existing tables and sequences
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO luggage_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO luggage_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO luggage_user;

-- 6. Set default privileges so future tables and sequences created in schema public are accessible
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO luggage_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO luggage_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO luggage_user;
```

---

## 3. Independent Verification Evidence

### 3.1 Scenario A: Fresh Volume Lifecycle (Disposable Volume & Container)

A clean lifecycle test was conducted using a dedicated disposable Docker volume and container to verify first-boot entrypoint initialization from zero state:

```powershell
docker volume create test_vol_c2_fresh
docker run -d --name test_pg_c2_fresh `
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=luggage_storage_dev `
  -p 127.0.0.1:5433:5432 `
  -v test_vol_c2_fresh:/var/lib/postgresql/data `
  -v D:/luggage-storage/luggage-storage/infrastructure/docker/init.sql:/docker-entrypoint-initdb.d/01-init.sql:ro `
  -v D:/luggage-storage/luggage-storage/infrastructure/docker/verify-postgis.sql:/docker-entrypoint-initdb.d/02-verify-postgis.sql:ro `
  postgis/postgis:16-3.5-alpine@sha256:47e961a569fd52ff31f0fe205ed91eeab17d9f5fff6722e6d7ea6b588748b293
```

#### Initialization Log Verification
```
/usr/local/bin/docker-entrypoint.sh: running /docker-entrypoint-initdb.d/01-init.sql
CREATE EXTENSION
CREATE EXTENSION
DO
GRANT
GRANT
GRANT
GRANT
GRANT
ALTER DEFAULT PRIVILEGES
ALTER DEFAULT PRIVILEGES
ALTER DEFAULT PRIVILEGES

/usr/local/bin/docker-entrypoint.sh: running /docker-entrypoint-initdb.d/02-verify-postgis.sql
Testing PostgreSQL version...
PostgreSQL 16.15 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit
Testing PostGIS extension version...
POSTGIS="3.5.7 0" [EXTENSION] PGSQL="160" GEOS="3.14.1-CAPI-1.20.5" PROJ="9.8.1 ...
Testing WGS84 Spatial Geography creation (Colombo, Sri Lanka)...
POINT(79.861244 6.927079)
Testing Spatial Distance Query (Distance from Colombo Fort to Galle Face in meters)...
distance_meters: 1445.97666723
PostGIS Spatial Engine Verified Successfully
```

#### Role Attribute Verification
```sql
SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin 
FROM pg_roles WHERE rolname IN ('postgres', 'luggage_user');
```
*Result:*
```
   rolname    | rolsuper | rolinherit | rolcreaterole | rolcreatedb | rolcanlogin 
--------------+----------+------------+---------------+-------------+-------------
 postgres     | t        | t          | t             | t           | t
 luggage_user | f        | t          | f             | f           | t
```
`luggage_user` is confirmed **non-superuser** (`rolsuper = f`, `rolcreaterole = f`, `rolcreatedb = f`).

#### DDL & DML Verification under `luggage_user`
```powershell
docker exec -e PGPASSWORD=luggage_password test_pg_c2_fresh psql -U luggage_user -d luggage_storage_dev -c "
  CREATE TABLE test_c2_tbl (id serial primary key, name text);
  INSERT INTO test_c2_tbl (name) VALUES ('privilege_check');
  SELECT * FROM test_c2_tbl;
  DROP TABLE test_c2_tbl;
"
```
*Result:* Table created, record inserted, queried, and dropped without privilege errors.

#### Privilege Denial Verification (Attempted Role Creation)
```powershell
docker exec -e PGPASSWORD=luggage_password test_pg_c2_fresh psql -U luggage_user -d luggage_storage_dev -c "
  CREATE ROLE malicious_user WITH LOGIN;
"
```
*Result:*
```
ERROR:  permission denied to create role
DETAIL:  Only roles with the CREATEROLE attribute may create roles.
```
Privilege enforcement verified: `luggage_user` cannot perform administrative tasks. Clean teardown performed via `docker rm -f test_pg_c2_fresh; docker volume rm test_vol_c2_fresh`.

---

### 3.2 Scenario B: Existing Persistent Volume Restart (`luggage_storage_postgres`)

Verification on the long-running development container `luggage_storage_postgres` with persistent volume `docker_postgres_data`:

1. **Applied updated `init.sql`** to convert existing `luggage_user` from superuser to non-superuser:
   ```sql
   ALTER ROLE luggage_user WITH LOGIN PASSWORD 'luggage_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
   ```
   *Verified:* `rolsuper` updated to `f`.
2. **Persistence Marker Test:**
   ```sql
   CREATE TABLE c2_persistence_marker (id int, note text);
   INSERT INTO c2_persistence_marker VALUES (42, 'c2_persistent_data');
   ```
3. **Container Cycle:**
   ```powershell
   docker stop luggage_storage_postgres
   docker start luggage_storage_postgres
   ```
4. **Data & Privilege Integrity Post-Restart:**
   ```sql
   SELECT * FROM c2_persistence_marker;
   -- Output: 42 | c2_persistent_data (Preserved intact)
   SELECT rolname, rolsuper FROM pg_roles WHERE rolname='luggage_user';
   -- Output: luggage_user | f (Preserved non-superuser status)
   DROP TABLE c2_persistence_marker;
   ```
5. **Spatial Query as Non-Superuser `luggage_user`:**
   Executed `verify-postgis.sql` connecting as `luggage_user`:
   - Verified PostgreSQL: `16.15`
   - Verified PostGIS: `3.5.7`
   - Distance Colombo Fort to Galle Face: `1445.97666723` meters.
   - Result: All PostGIS spatial operations function identically without superuser privileges.

---

### 3.3 Fastify API Integration Verification

Executed automated test suite connecting to the live database using the least-privilege `luggage_user` role:

```
$ vitest run
 RUN  v3.2.7 apps/api

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
  },
  "meta": {
    "timestamp": "2026-11-07T03:38:38.071Z",
    "correlationId": "84c3b318-fa16-4e0c-bb15-c0442d5017b5"
  }
}

Test Files  2 passed (2)
     Tests  7 passed (7)
```

The Fastify application connects, queries PostGIS metadata, and serves readiness traffic (`HTTP 200`) under the least-privilege database role.

---

## 4. Summary Matrix

| Verification Aspect | Status | Evidence Summary |
| :--- | :---: | :--- |
| **Least-Privilege Role Model** | **PASS** | `luggage_user` has `rolsuper=f`, `rolcreatedb=f`, `rolcreaterole=f`. |
| **Privilege Denial** | **PASS** | Administrative operations (`CREATE ROLE`) rejected with permission denied. |
| **Application Capabilities** | **PASS** | Schema migrations, table creation, CRUD, and PostGIS spatial queries succeed. |
| **Scenario A (Fresh Volume)** | **PASS** | Disposable container and volume initialize deterministically via entrypoint. |
| **Scenario B (Volume Restart)** | **PASS** | Data persists across container restarts; role privileges remain strictly enforced. |
| **API Health & Readiness** | **PASS** | `/ready` probe returns HTTP 200 with live PostGIS version under `luggage_user`. |
| **Localhost Port Isolation** | **PASS** | Bound strictly to `127.0.0.1:5432`. |

