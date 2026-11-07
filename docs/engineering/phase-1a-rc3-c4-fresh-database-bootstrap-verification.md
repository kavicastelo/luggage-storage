# Phase 1A-RC3-C4 Fresh Database Bootstrap & Lifecycle Verification

- **Project:** Global Luggage Storage Marketplace
- **Document ID:** ENG-DB-1A-RC3-C4-002
- **Phase:** Phase 1A-RC3-C4 — Final Security & Database Evidence Validation
- **Date:** 2026-11-07
- **Classification:** Database Reliability & Lifecycle Deliverable
- **Status:** VERIFIED & REPEATABLE

---

## 1. Executive Summary

This deliverable records the empirical verification of a clean, first-time database initialization from an empty data directory (zero state), completely isolated from the persistent development database.

The verification confirmed that `infrastructure/docker/init.sql` and `infrastructure/docker/verify-postgis.sql` deterministically execute upon container entrypoint bootstrap, installing PostGIS extensions, provisioning the 3-tier role architecture (`postgres`, `luggage_migrator`, `luggage_user`), configuring default privilege delegations, and enforcing runtime least-privilege boundaries. The procedure was repeated across two independent disposable volumes, confirming 100% repeatability.

The persistent development container (`luggage_storage_postgres`) and volume (`docker_postgres_data`) were completely preserved and remained untouched throughout testing.

---

## 2. Test Environment & Execution Commands

- **Base Image:** `postgis/postgis:16-3.5-alpine@sha256:47e961a569fd52ff31f0fe205ed91eeab17d9f5fff6722e6d7ea6b588748b293`
- **PostgreSQL Version:** `16.15 (Alpine musl)`
- **PostGIS Version:** `3.5.7`
- **Disposable Containers:** `test_c4_fresh_pg`, `test_c4_repeat_pg`
- **Port Mapping:** `127.0.0.1:5434:5432` (isolated from port 5432)
- **Disposable Volumes:** `test_c4_fresh_vol`, `test_c4_repeat_vol`

### Execution Command:
```powershell
docker volume create test_c4_fresh_vol
docker run -d --name test_c4_fresh_pg `
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=luggage_storage_dev `
  -p 127.0.0.1:5434:5432 `
  -v test_c4_fresh_vol:/var/lib/postgresql/data `
  -v D:/luggage-storage/luggage-storage/infrastructure/docker/init.sql:/docker-entrypoint-initdb.d/01-init.sql:ro `
  -v D:/luggage-storage/luggage-storage/infrastructure/docker/verify-postgis.sql:/docker-entrypoint-initdb.d/02-verify-postgis.sql:ro `
  postgis/postgis:16-3.5-alpine@sha256:47e961a569fd52ff31f0fe205ed91eeab17d9f5fff6722e6d7ea6b588748b293
```

---

## 3. Initialization Log Evidence

Inspection of container logs (`docker logs test_c4_fresh_pg`) confirms the deterministic entrypoint execution flow:

```
fixing permissions on existing directory /var/lib/postgresql/data ... ok
creating subdirectories ... ok
running bootstrap script ... ok
performing post-bootstrap initialization ... ok
syncing data to disk ... ok
server started
CREATE DATABASE

/usr/local/bin/docker-entrypoint.sh: running /docker-entrypoint-initdb.d/01-init.sql
CREATE EXTENSION
CREATE EXTENSION
DO
DO
GRANT
GRANT
GRANT
GRANT
GRANT
GRANT
ALTER DEFAULT PRIVILEGES
ALTER DEFAULT PRIVILEGES
ALTER DEFAULT PRIVILEGES
GRANT
REVOKE
GRANT
GRANT
GRANT
ALTER DEFAULT PRIVILEGES
ALTER DEFAULT PRIVILEGES
ALTER DEFAULT PRIVILEGES
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

PostgreSQL init process complete; ready for start up.
starting PostgreSQL 16.15 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit
database system is ready to accept connections
```

---

## 4. Verification of 12 Required Bootstrap Criteria

| # | Bootstrap Verification Item | Result | Empirical Evidence / Output |
| :--- | :--- | :---: | :--- |
| **1** | Completely empty data directory initializes | **PASS** | Bootstrapped from newly created volume `test_c4_fresh_vol`. |
| **2** | PostgreSQL starts with expected version | **PASS** | `PostgreSQL 16.15 on x86_64-pc-linux-musl`. |
| **3** | PostGIS is installed and operational | **PASS** | `POSTGIS="3.5.7 0"`, spatial geography point created. |
| **4** | Required roles are created | **PASS** | `postgres`, `luggage_migrator`, and `luggage_user` present in `pg_roles`. |
| **5** | Passwords not hardcoded in production | **PASS** | `init.sql` includes explicit security disclaimer for secrets management. |
| **6** | Runtime privileges correctly restricted | **PASS** | `luggage_user`: `rolsuper = f`, `create_priv = f`. |
| **7** | Migration role privileges established | **PASS** | `luggage_migrator`: `rolsuper = f`, `create_priv = t`. |
| **8** | Schema ownership & default privileges correct | **PASS** | Objects created by migrator grant DML to runtime user via default privileges. |
| **9** | Fastify application connectivity verified | **PASS** | Direct pool connection to port 5434: `Connected: true`. |
| **10** | Spatial query succeeds | **PASS** | Geodetic distance query returned `1445.97666723` meters. |
| **11** | Runtime DDL is denied | **PASS** | `CREATE TABLE` returned `ERROR: permission denied for schema public`. |
| **12** | Repeatable on new disposable volume | **PASS** | Bootstrapped `test_c4_repeat_vol` on `test_c4_repeat_pg` with identical success. |

---

## 5. Docker Entrypoint & Database Lifecycle Analysis

### 5.1 Initialization Execution Boundaries
- **First-Time Bootstrap Only:** PostgreSQL Docker images execute `/docker-entrypoint-initdb.d/*.sql` **exclusively** when `/var/lib/postgresql/data` is empty. Once the cluster is initialized, entrypoint scripts are permanently bypassed.
- **Normal Container Restarts:** Container restarts (`docker restart` or `docker compose up`) start the existing cluster directly. They do not re-execute `init.sql`.

### 5.2 Schema Migration & Versioning Strategy
- Database migrations must **never** be managed by Docker entrypoint scripts in persistent environments.
- In subsequent phases, schema migrations will be authored as versioned SQL or TypeScript migration files (e.g. via Drizzle Kit) executed by `luggage_migrator` during CI/CD deployment pipelines.
- Modifying `init.sql` in source control updates fresh developer/CI bootstrapper environments; existing development databases receive migration scripts applied through the migration role.

---

## 6. Teardown & Environment Cleanup

Following full empirical verification, both disposable containers and volumes were cleanly destroyed:
```powershell
docker rm -f test_c4_fresh_pg test_c4_repeat_pg
docker volume rm test_c4_fresh_vol test_c4_repeat_vol
```
*Verification:* `docker volume ls` and `docker ps` confirm only the permanent development container `luggage_storage_postgres` and volume `docker_postgres_data` remain active on port 5432.

