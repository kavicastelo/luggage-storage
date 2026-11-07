# Phase 1B — WP-02 Database Security Corrections & Verification Report

**Project:** Global Luggage Storage Marketplace  
**Repository:** `d:\luggage-storage\luggage-storage`  
**Branch:** [`feat/phase-1b-identity`](https://github.com/kavicastelo/luggage-storage/tree/feat/phase-1b-identity)  
**Date:** 2026-11-08  
**Role:** Principal PostgreSQL Security Engineer, Database Privilege Architect, Independent QA Auditor  
**Status:** **`WP-02 SECURITY CORRECTIONS PASSED — WP-03 AUTHORIZED`**

---

## 1. Original Findings & Root Causes

During the independent security closure review of WP-02, two confirmed defects were identified:

### 1.1 SEC-04: Audit Immutability Bypass via Trigger Exception
- **Root Cause:** To support `ON DELETE SET NULL` upon user deletion, trigger function `prevent_audit_tampering()` whitelisted transitions from a non-null `user_id` to `NULL`. Because PostgreSQL row-level triggers cannot distinguish an internal referential action from a direct SQL command, executing `UPDATE security_audit_events SET user_id = NULL WHERE ...` directly as table owner `luggage_migrator` succeeded (`UPDATE 1`). Furthermore, setting `user_id = NULL` upon user deletion permanently erased historical actor attribution from the audit trail.
- **Severity:** HIGH / CRITICAL.

### 1.2 SEC-05: Runtime RBAC Privilege Escalation Paths
- **Root Cause:** Due to default schema privileges in `init.sql` (`ALTER DEFAULT PRIVILEGES FOR ROLE luggage_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO luggage_user;`), runtime account `luggage_user` held:
  - `INSERT` on `roles` and `permissions` catalog tables.
  - `INSERT, UPDATE, DELETE` on `role_permissions` join table.
  - `INSERT, UPDATE, DELETE` on `user_roles` join table.
  This allowed runtime SQL commands to assign `SUPERADMIN` to arbitrary users and modify role-to-permission mappings directly, violating `OQ-011` / `OQ-016` separation of duties and Prohibited Shortcut #7.
- **Severity:** HIGH / CRITICAL.

---

## 2. Corrective Migrations & Commit References

1. **Schema Correction:** [`apps/api/src/infrastructure/database/schema/identity.ts`](file:///d:/luggage-storage/luggage-storage/apps/api/src/infrastructure/database/schema/identity.ts)
   - Decoupled `security_audit_events.user_id` from the foreign key constraint (`userId: uuid("user_id")`).
2. **Forward-Only SQL Migration:** [`apps/api/src/infrastructure/database/migrations/0002_marvelous_hercules.sql`](file:///d:/luggage-storage/luggage-storage/apps/api/src/infrastructure/database/migrations/0002_marvelous_hercules.sql)
   - Dropped foreign key constraint `security_audit_events_user_id_users_id_fk`.
   - Updated trigger function `prevent_audit_tampering()` to unconditionally reject ALL `UPDATE` and ALL `DELETE` operations with zero exceptions.
   - Revoked `INSERT, UPDATE, DELETE, TRUNCATE` on `roles`, `permissions`, `role_permissions`, and `user_roles` from `luggage_user`.
   - Granted read-only `SELECT` on all 4 RBAC tables to `luggage_user`.
   - Created `SECURITY DEFINER` function `public.assign_default_traveller_role(p_user_id uuid)` owned by dedicated non-login role `luggage_role_assigner`.
   - Revoked execution from `PUBLIC` and granted execution strictly to `luggage_user`.
3. **Database Bootstrap Initialization:** [`infrastructure/docker/init.sql`](file:///d:/luggage-storage/luggage-storage/infrastructure/docker/init.sql)
   - Provisioned dedicated non-login role `luggage_role_assigner`.

---

## 3. Before-and-After Database Privilege Matrix

### Runtime Role (`luggage_user`) Privileges:

| Table / Object | Operation | Before Correction | After Correction | Security Impact |
| :--- | :---: | :---: | :---: | :--- |
| `security_audit_events` | `SELECT` | GRANTED | GRANTED | Legitimate audit inspection |
| `security_audit_events` | `INSERT` | GRANTED | GRANTED | Legitimate audit event logging |
| `security_audit_events` | `UPDATE` | REVOKED | **REVOKED + TRIGGER REJECTS** | Zero field updates, direct `user_id = NULL` blocked |
| `security_audit_events` | `DELETE` | REVOKED | **REVOKED + TRIGGER REJECTS** | Append-only guaranteed |
| `security_audit_events` | `TRUNCATE` | REVOKED | REVOKED | Table wiping prohibited |
| `roles` | `SELECT` | GRANTED | GRANTED | Read catalog definitions |
| `roles` | `INSERT/UPDATE/DELETE/TRUNCATE` | INSERT allowed | **ALL REVOKED** | Cannot alter or add roles |
| `permissions` | `SELECT` | GRANTED | GRANTED | Read permission scopes |
| `permissions` | `INSERT/UPDATE/DELETE/TRUNCATE` | INSERT allowed | **ALL REVOKED** | Cannot alter or add permissions |
| `role_permissions` | `SELECT` | GRANTED | GRANTED | Read role-permission matrix |
| `role_permissions` | `INSERT/UPDATE/DELETE/TRUNCATE` | FULL DML allowed | **ALL REVOKED** | Cannot modify permission grants |
| `user_roles` | `SELECT` | GRANTED | GRANTED | Read user role assignments |
| `user_roles` | `INSERT/UPDATE/DELETE/TRUNCATE` | FULL DML allowed | **ALL REVOKED** | Cannot directly assign roles |
| `assign_default_traveller_role(uuid)` | `EXECUTE` | N/A | **GRANTED** | Safe single-purpose registration role assignment |

---

## 4. Final Audit Trigger & Actor-Reference Behavior

### 4.1 Trigger Function Definition
```sql
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
```

### 4.2 Actor Reference Decoupling
- Column `security_audit_events.user_id` is an **immutable historical actor identifier** (UUID).
- By removing the cascading foreign key constraint, deleting an account in `users` (`DELETE FROM users WHERE id = ...`) produces **zero cascading effect** on `security_audit_events`.
- Historical actor UUIDs remain permanently intact in the audit trail (not overwritten with `NULL`), preserving full forensic accountability without requiring table mutability.

---

## 5. Default-Role Function Design & Execution Privileges

```sql
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
```

### Privilege Boundary:
- **Dedicated Owner:** `luggage_role_assigner` (`NOLOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`).
- **Owner Grants:** Only `SELECT ON public.users`, `SELECT ON public.roles`, `SELECT, INSERT ON public.user_roles`.
- **Public Revocation:** `REVOKE ALL ON FUNCTION public.assign_default_traveller_role(uuid) FROM PUBLIC;`.
- **Runtime Access:** `GRANT EXECUTE ON FUNCTION public.assign_default_traveller_role(uuid) TO luggage_user;`.
- **Security:** Accepts only a user UUID. Hardcodes `TRAVELLER` role internally. Cannot be repurposed by the caller to assign `SUPERADMIN`, `SUPPORT`, or `HOST` roles.

---

## 6. Live SQL Reproduction & Verification Evidence

### 6.1 Audit Immutability Tests

```sql
-- 1. Insert audit event as luggage_user -> SUCCESS
INSERT INTO security_audit_events (id, user_id, event_type, metadata)
VALUES ('ff111111-1111-1111-1111-111111111111', 'cc111111-1111-1111-1111-111111111111', 'LOGIN_SUCCESS', '{}')
RETURNING id, user_id;
-- Output: INSERT 0 1

-- 2. Direct update user_id as luggage_user -> REJECTED
UPDATE security_audit_events SET user_id = NULL WHERE id = 'ff111111-1111-1111-1111-111111111111';
-- Output: ERROR: permission denied for table security_audit_events

-- 3. Direct update user_id as luggage_migrator (table owner) -> REJECTED
UPDATE security_audit_events SET user_id = NULL WHERE id = 'ff111111-1111-1111-1111-111111111111';
-- Output: ERROR: security_audit_events records are immutable: UPDATE is prohibited

-- 4. Direct update event_type as luggage_migrator -> REJECTED
UPDATE security_audit_events SET event_type = 'TAMPERED' WHERE id = 'ff111111-1111-1111-1111-111111111111';
-- Output: ERROR: security_audit_events records are immutable: UPDATE is prohibited

-- 5. Delete audit event as luggage_migrator -> REJECTED
DELETE FROM security_audit_events WHERE id = 'ff111111-1111-1111-1111-111111111111';
-- Output: ERROR: security_audit_events records are immutable: DELETE is prohibited

-- 6. Delete user account and verify audit trail preservation
DELETE FROM users WHERE id = 'cc111111-1111-1111-1111-111111111111';
-- Output: DELETE 1

SELECT id, user_id, event_type FROM security_audit_events WHERE id = 'ff111111-1111-1111-1111-111111111111';
-- Output: id: ff111111-... | user_id: cc111111-1111-1111-1111-111111111111 | event_type: LOGIN_SUCCESS
-- Historical actor UUID is strictly preserved!
```

### 6.2 RBAC Direct DML Denial & Function Execution Tests

```sql
-- 1. Direct INSERT into user_roles as luggage_user -> REJECTED
INSERT INTO user_roles (user_id, role_id)
SELECT '00000000-0000-0000-0000-000000000000', id FROM roles WHERE code = 'SUPERADMIN';
-- Output: ERROR: permission denied for table user_roles

-- 2. Direct INSERT into role_permissions as luggage_user -> REJECTED
INSERT INTO role_permissions (role_id, permission_id) VALUES ('...', '...');
-- Output: ERROR: permission denied for table role_permissions

-- 3. Direct INSERT into roles / permissions as luggage_user -> REJECTED
INSERT INTO roles (code, name) VALUES ('HACK', 'Hack');
-- Output: ERROR: permission denied for table roles

-- 4. Authorized default role function execution as luggage_user -> SUCCESS
SELECT public.assign_default_traveller_role('bb111111-1111-1111-1111-111111111111');
-- Output: assign_default_traveller_role (1 row)

-- 5. Idempotent re-invocation -> SUCCESS (1 role remains assigned)
SELECT COUNT(*) FROM user_roles WHERE user_id = 'bb111111-1111-1111-1111-111111111111';
-- Output: count: 1

-- 6. Execution with non-existent user -> REJECTED
SELECT public.assign_default_traveller_role('00000000-0000-0000-0000-000000000000');
-- Output: ERROR: Cannot assign role: user 00000000-0000-0000-0000-000000000000 does not exist
```

---

## 7. Automated Test Suite Results

File: [`apps/api/tests/identity-database.test.ts`](file:///d:/luggage-storage/luggage-storage/apps/api/tests/identity-database.test.ts)  
Results: **31/31 tests pass (100%)**

```
 ✓ tests/identity-database.test.ts (31 tests) 540ms
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 1. Schema & Migration Idempotency > should report 0 applied migrations on repeated execution
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 1. Schema & Migration Idempotency > should verify all 10 identity tables exist in schema public
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 2. User Identity Integrity & Normalized Email Uniqueness > should reject duplicate normalized_email values
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 2. User Identity Integrity & Normalized Email Uniqueness > should enforce check constraint on users.status
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 2. User Identity Integrity & Normalized Email Uniqueness > should enforce check constraint when normalized_email disagrees with lower(trim(email))
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 2. User Identity Integrity & Normalized Email Uniqueness > should accept email with casing and whitespace when normalized_email matches lower(trim(email))
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 3. Profile Context Separation & Referential Cascade > should create TravellerProfile and HostProfile linked to a single User
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 3. Profile Context Separation & Referential Cascade > should cascade profile deletion upon user deletion
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 4. Centralized RBAC Integrity & Role-Permission Constraints > should support multiple role assignments and reject duplicates
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 4. Centralized RBAC Integrity & Role-Permission Constraints > should reject duplicate role-permission assignments
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 5. Authentication Session Persistence & Rotation Guardrails > should persist auth_sessions and enforce unique refresh_token_hash
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 5. Authentication Session Persistence & Rotation Guardrails > should verify index exists on previous_token_hash for reuse detection
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 6. Security Audit Trail & Truly Append-Only Immutability > should allow luggage_user to insert an audit event
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 6. Security Audit Trail & Truly Append-Only Immutability > should preserve audit record and original historical actor UUID unchanged when associated user is deleted
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 6. Security Audit Trail & Truly Append-Only Immutability > should deny luggage_user UPDATE privileges on security_audit_events
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 6. Security Audit Trail & Truly Append-Only Immutability > should deny luggage_user DELETE privileges on security_audit_events
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 6. Security Audit Trail & Truly Append-Only Immutability > should unconditionally block UPDATE and DELETE via trigger even under table owner migrator
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 7. Three-Tier Database Role Privilege Enforcement > should verify luggage_user cannot create tables (DDL denied)
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 7. Three-Tier Database Role Privilege Enforcement > should verify luggage_user can execute DML (SELECT, INSERT, UPDATE, DELETE)
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 7. Three-Tier Database Role Privilege Enforcement > should verify both roles are non-superusers
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 7. Three-Tier Database Role Privilege Enforcement > should verify luggage_user can read role and permission catalogs
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 7. Three-Tier Database Role Privilege Enforcement > should verify luggage_user cannot INSERT, UPDATE, or DELETE roles
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 7. Three-Tier Database Role Privilege Enforcement > should verify luggage_user cannot INSERT, UPDATE, or DELETE permissions
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 7. Three-Tier Database Role Privilege Enforcement > should verify luggage_user cannot INSERT, UPDATE, or DELETE role_permissions
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 7. Three-Tier Database Role Privilege Enforcement > should verify luggage_user cannot directly INSERT, UPDATE, or DELETE user_roles
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 7. Three-Tier Database Role Privilege Enforcement > should verify luggage_user cannot assign SUPERADMIN or arbitrary roles using direct SQL
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 7. Three-Tier Database Role Privilege Enforcement > should verify assign_default_traveller_role function can assign TRAVELLER role
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 7. Three-Tier Database Role Privilege Enforcement > should verify repeated assign_default_traveller_role invocation is idempotent
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 7. Three-Tier Database Role Privilege Enforcement > should verify assign_default_traveller_role rejects non-existent users
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 7. Three-Tier Database Role Privilege Enforcement > should verify PUBLIC cannot execute assign_default_traveller_role, but luggage_user can
   ✓ WP-02: Identity Database Architecture & Integrity Tests > 7. Three-Tier Database Role Privilege Enforcement > should serialize migrations via PostgreSQL advisory lock
```

---

## 8. Full Monorepo Uncached Verification Results

Executed `turbo run lint typecheck test build --force`:

```
 Tasks:    16 successful, 16 total
Cached:    0 cached, 16 total
  Time:    26.009s

Package Test Results:
  • @luggage-storage/contracts:  8 passed
  • @luggage-storage/web:        3 passed
  • @luggage-storage/mobile:     2 passed
  • @luggage-storage/api:       38 passed (31 identity database + 7 health/live database)
Total Monorepo Tests: 51/51 passed (100%)
```

---

## 9. Remaining Security Limitations & Explicit Threat Boundaries

1. **Database Superuser Boundary:** The trigger and privilege revocations enforce immutability and role isolation against application runtime (`luggage_user`) and table owner (`luggage_migrator`). A PostgreSQL superuser (`postgres`) retains the technical ability to drop or disable triggers. Production database administration must strictly limit superuser credential access to emergency break-glass procedures.
2. **Future Privileged Role Assignment (WP-07):** Runtime operations can currently assign ONLY the default `TRAVELLER` role via `assign_default_traveller_role()`. In WP-07, privileged role assignment (e.g. assigning `HOST_OWNER`, `SUPPORT`, or `SUPERADMIN`) must use a dedicated `SECURITY DEFINER` procedure protected by caller authentication and permission checks, rather than restoring unrestricted DML to `luggage_user`.

---

## 10. Final Decision & Status

Both confirmed defects (SEC-04 and SEC-05) have been completely resolved, verified under live PostgreSQL 16 / PostGIS 3.5, covered by 31 automated integration tests, and validated across the full monorepo quality gate.

Updated [`docs/engineering/phase-1b-execution-tracker.md`](file:///d:/luggage-storage/luggage-storage/docs/engineering/phase-1b-execution-tracker.md).

**Final Determination:**
### **`WP-02 SECURITY CORRECTIONS PASSED — WP-03 AUTHORIZED`**
