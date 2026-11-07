# Phase 1A-RC3-C4 PostgreSQL Role & Privilege Verification

- **Project:** Global Luggage Storage Marketplace
- **Document ID:** ENG-DB-1A-RC3-C4-001
- **Phase:** Phase 1A-RC3-C4 — Final Security & Database Evidence Validation
- **Date:** 2026-11-07
- **Classification:** Database Security & Architecture Deliverable
- **Status:** VERIFIED & HARDENED

---

## 1. Executive Summary

This deliverable verifies the implementation and empirical enforcement of the **3-tier PostgreSQL role architecture** for the Global Luggage Storage Marketplace.

Previous phases removed superuser privileges from the application user and audited schema-level access. In Phase 1A-RC3-C4, the complete three-tier model was formalized in `infrastructure/docker/init.sql` and independently verified on PostgreSQL 16.15 and PostGIS 3.5.7:
1. **Administrative Tier (`postgres`):** Reserved exclusively for container initialization and extension provisioning.
2. **Schema Migration Tier (`luggage_migrator`):** A dedicated non-superuser role authorized to execute schema DDL migrations (`CREATE ON SCHEMA public`) and own database objects.
3. **Application Runtime Tier (`luggage_user`):** A strictly unprivileged non-superuser role restricted to schema `USAGE` and data DML (`SELECT`, `INSERT`, `UPDATE`, `DELETE`), with schema `CREATE` explicitly revoked and all DDL operations physically denied.

---

## 2. 3-Tier Role Architecture Specification

```
+----------------------------------------------------------------------------------------------------+
|                                    3-TIER POSTGRESQL ROLE MODEL                                    |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  [ TIER 1: Database Administrator (Role: postgres) ]                                               |
|    - rolsuper: TRUE  |  rolcreatedb: TRUE  |  rolcreaterole: TRUE                                  |
|    - Responsibilities: Database cluster initialization, PostGIS extension management               |
|    - Boundary: Never utilized by application runtimes or migration pipelines                       |
|                                                                                                    |
|  [ TIER 2: Schema Migration Role (Role: luggage_migrator) ]                                        |
|    - rolsuper: FALSE  |  rolcreatedb: FALSE  |  rolcreaterole: FALSE                               |
|    - Privileges: CONNECT ON DATABASE luggage_storage_dev                                           |
|                  USAGE, CREATE ON SCHEMA public                                                    |
|                  Object Ownership on migration-created tables and sequences                        |
|                  Default Privileges granting DML to luggage_user                                    |
|    - Boundary: Used exclusively by automated CI/CD migration runners (e.g. Drizzle Kit)            |
|                                                                                                    |
|  [ TIER 3: Application Runtime Role (Role: luggage_user) ]                                         |
|    - rolsuper: FALSE  |  rolcreatedb: FALSE  |  rolcreaterole: FALSE                               |
|    - Privileges: CONNECT ON DATABASE luggage_storage_dev                                           |
|                  USAGE ON SCHEMA public (CREATE REVOKED)                                           |
|                  SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public                     |
|                  USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public                           |
|                  EXECUTE ON ALL FUNCTIONS IN SCHEMA public (PostGIS spatial queries)               |
|    - Boundary: Utilized by Fastify API runtime connection pool (zero DDL capability)               |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

---

## 3. Empirical Privilege Audit & Catalog Evidence

The following queries were executed against live container `luggage_storage_postgres` (and replicated on disposable test container `test_c4_fresh_pg`):

### 3.1 Role Attribute Audit
```sql
SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin 
FROM pg_roles 
WHERE rolname IN ('postgres', 'luggage_migrator', 'luggage_user');
```

*Empirical Output:*
```
     rolname      | rolsuper | rolinherit | rolcreaterole | rolcreatedb | rolcanlogin 
------------------+----------+------------+---------------+-------------+-------------
 postgres         | t        | t          | t             | t           | t
 luggage_migrator | f        | t          | f             | f           | t
 luggage_user     | f        | t          | f             | f           | t
```
**Conclusion:** Neither `luggage_migrator` nor `luggage_user` possesses elevated administrative attributes (`rolsuper = f`, `rolcreaterole = f`, `rolcreatedb = f`).

---

### 3.2 Schema Privilege Audit
```sql
SELECT nspname, 
  has_schema_privilege('luggage_migrator', nspname, 'USAGE') as migrator_usage,
  has_schema_privilege('luggage_migrator', nspname, 'CREATE') as migrator_create,
  has_schema_privilege('luggage_user', nspname, 'USAGE') as user_usage,
  has_schema_privilege('luggage_user', nspname, 'CREATE') as user_create
FROM pg_namespace WHERE nspname = 'public';
```

*Empirical Output:*
```
 nspname | migrator_usage | migrator_create | user_usage | user_create 
---------+----------------+-----------------+------------+-------------
 public  | t              | t               | t          | f
```
**Conclusion:**
- `luggage_migrator` holds `USAGE` and `CREATE` on schema `public` (authorized to perform DDL).
- `luggage_user` holds `USAGE` only; `CREATE` is verified **false (`f`)**.

---

### 3.3 Role Membership & Inheritance Audit
```sql
SELECT r.rolname AS member, m.rolname AS role_inherited
FROM pg_auth_members a
JOIN pg_roles r ON a.member = r.oid
JOIN pg_roles m ON a.roleid = m.oid
WHERE r.rolname IN ('luggage_user', 'luggage_migrator');
```

*Empirical Output:*
```
 member | role_inherited 
--------+----------------
(0 rows)
```
**Conclusion:** Neither role belongs to any administrative or elevated group role. Privilege escalation through inherited group membership is physically prevented.

---

### 3.4 Database-Level Privileges Audit
```sql
SELECT datname,
  has_database_privilege('luggage_user', datname, 'CONNECT') as user_connect,
  has_database_privilege('luggage_user', datname, 'CREATE') as user_db_create,
  has_database_privilege('luggage_user', datname, 'TEMPORARY') as user_temp,
  has_database_privilege('luggage_migrator', datname, 'CONNECT') as migrator_connect,
  has_database_privilege('luggage_migrator', datname, 'CREATE') as migrator_db_create
FROM pg_database WHERE datname = 'luggage_storage_dev';
```

*Empirical Output:*
```
       datname       | user_connect | user_db_create | user_temp | migrator_connect | migrator_db_create 
---------------------+--------------+----------------+-----------+------------------+--------------------
 luggage_storage_dev | t            | f              | t         | t                | f
```
**Conclusion:** Neither role can create schemas or alter parameters at the database level (`user_db_create = f`, `migrator_db_create = f`).

---

## 4. Migration & Runtime Workflow Verification

To verify the intended cross-role workflow without inventing uncommitted application code, an isolated verification procedure was executed:

### Step 1: DDL Execution as Migration Role (`luggage_migrator`)
Connecting with `luggage_migrator`:
```sql
CREATE TABLE migration_test (id serial primary key, name text);
INSERT INTO migration_test (name) VALUES ('migrator_row');
```
*Result:* Table created successfully; initial record inserted. Table owner verified as `luggage_migrator`.

---

### Step 2: DML Execution as Runtime Role (`luggage_user`)
Connecting with `luggage_user`:
```sql
SELECT * FROM migration_test;
-- Output: 1 | migrator_row (READ successful)

INSERT INTO migration_test (name) VALUES ('user_row');
-- Output: INSERT 0 1 (WRITE successful)

UPDATE migration_test SET name = 'updated_user_row' WHERE id = 2;
-- Output: UPDATE 1 (UPDATE successful)

DELETE FROM migration_test WHERE id = 2;
-- Output: DELETE 1 (DELETE successful)
```
*Result:* All four CRUD operations succeeded under `luggage_user` via default privileges configured in `init.sql`.

---

### Step 3: DDL Denial as Runtime Role (`luggage_user`)
Connecting with `luggage_user`:

1. **Attempted Table Creation:**
   ```sql
   CREATE TABLE runtime_unauth (id int);
   ```
   *Result:*
   ```
   ERROR:  permission denied for schema public
   LINE 1: CREATE TABLE runtime_unauth (id int);
   ```

2. **Attempted Table Alteration:**
   ```sql
   ALTER TABLE migration_test ADD COLUMN evil int;
   ```
   *Result:*
   ```
   ERROR:  must be owner of table migration_test
   ```

3. **Attempted Table Drop:**
   ```sql
   DROP TABLE migration_test;
   ```
   *Result:*
   ```
   ERROR:  must be owner of table migration_test
   ```

4. **Attempted Role Creation:**
   ```sql
   CREATE ROLE malicious_user WITH LOGIN;
   ```
   *Result:*
   ```
   ERROR:  permission denied to create role
   DETAIL:  Only roles with the CREATEROLE attribute may create roles.
   ```

---

### Step 4: Schema Object Teardown as Migration Role (`luggage_migrator`)
Connecting with `luggage_migrator`:
```sql
DROP TABLE migration_test;
```
*Result:* `DROP TABLE` succeeded cleanly (migrator is table owner).

---

## 5. Fastify API Integration Verification

Automated test execution connecting to `luggage_storage_postgres` under `luggage_user`:
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
The application connects, evaluates readiness, and executes PostGIS spatial queries under the unprivileged `luggage_user` role.

---

## 6. Password & Credential Security Guidance

- **Local Development / CI:** Default passwords (`luggage_password`, `migrator_password`) are provided in `init.sql` strictly for local isolated Docker environments bound to `127.0.0.1`.
- **Production Deployments:** Credentials must be injected via environment variables sourced from a secrets management system (e.g. AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault). Plaintext passwords must never be committed to repository files.

