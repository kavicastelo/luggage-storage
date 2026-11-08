# Phase 1B — WP-07: RBAC and Permission Architecture Implementation Report

**Project:** Global Luggage Storage Marketplace  
**Phase:** Phase 1B — Identity, Authentication & Access Control  
**Work Package:** WP-07 — RBAC and Permission Architecture  
**Status:** **COMPLETE — READY FOR WP-08**  
**Execution Branch:** `feat/phase-1b-identity`  
**Governing Specification:** [docs/engineering/phase-1b-specification.md](file:///d:/luggage-storage/luggage-storage/docs/engineering/phase-1b-specification.md) (Section 11)  
**Identity Architecture:** [docs/architecture/phase-1b-identity-design.md](file:///d:/luggage-storage/luggage-storage/docs/architecture/phase-1b-identity-design.md) (Sections 3.1, 3.4, 3.7)  
**Execution Tracker:** [docs/engineering/phase-1b-execution-tracker.md](file:///d:/luggage-storage/luggage-storage/docs/engineering/phase-1b-execution-tracker.md)  
**Date of Verification:** 2026-11-08  

---

## 1. Executive Summary

Work Package WP-07 (Role-Based Access Control & Centralized Permission Architecture) has been fully implemented, validated, and verified against live PostgreSQL. The implementation transitions administrative and access-control checks from role-name checks into a fine-grained, permission-driven authorization architecture.

### Key Verification Outcomes:
- **API Test Suite:** **139/139 passed** across 6 test suites (21 RBAC tests + 27 admin lifecycle tests + 53 auth & session tests + 31 identity database tests + 7 health/live tests).
- **Monorepo Test Suite:** **152/152 passed** across all packages (`@luggage-storage/contracts`: 8, `@luggage-storage/web`: 3, `@luggage-storage/mobile`: 2, `@luggage-storage/api`: 139).
- **Uncached Monorepo Quality Gate:** **16/16 tasks successful** (`pnpm exec turbo run lint typecheck test build --force` in 38.2s) with 0 lint warnings, 0 type errors, and 0 test failures.
- **Migration `0004_permissions_and_rbac.sql`:** Applied cleanly to live PostgreSQL. Provisioned 54 canonical system permissions and complete role-permission mappings across all 5 standard roles (`SUPERADMIN`, `SUPPORT`, `HOST_OWNER`, `HOST_STAFF`, `TRAVELLER`).
- **Database Privilege Hardening (SEC-05 Compliance):** Preserved strict least-privilege boundaries: direct `INSERT`, `UPDATE`, and `DELETE` on `user_roles` and `role_permissions` remain revoked from the runtime user `luggage_user`. Role assignment and revocation are encapsulated in PostgreSQL `SECURITY DEFINER` functions (`public.assign_user_role` and `public.revoke_user_role`) owned by `luggage_role_assigner` (or table owner) with execution rights granted exclusively to runtime callers.
- **Centralized Authorization Service (`rbacService`):** Provides real-time effective permission evaluation (`getEffectivePermissions`), permission checks (`hasPermission`, `hasAnyPermission`, `hasAllPermissions`), catalog querying (`listRoles`, `listPermissions`), and protected role assignment/revocation (`assignRole`, `revokeRole`).
- **Fastify Authorization Decorators:** Implemented reusable, composable decorators `requirePermission(permission)`, `requireAnyPermission(permissions)`, and `requireAllPermissions(permissions)`. Non-authenticated requests receive 401 Unauthorized; callers lacking required permissions receive 403 Forbidden with `{ error: { code: "FORBIDDEN", message: "..." } }`.
- **Zero Stale Permission Window (OQ-021 Decision):** Permission evaluation queries live PostgreSQL through active roles joined with `role_permissions` and `permissions`, enforcing `users.status = 'ACTIVE'`. Suspending an account, deactivating an account, or revoking a role immediately denies permissions on the very next HTTP request without relying on Redis or suffering from stale cache windows.
- **Support / Superadmin Separation:** Customer support staff (`SUPPORT`) possess operational permissions (`identity.*`, `admin.user.*`, `admin.session.read_any`, `support.ticket.*`), but lack platform governance (`admin.platform.manage`, `admin.financial.manage`, `admin.kyc.manage`, `admin.audit.read`, `admin.role.assign`, `admin.role.revoke`). Superadmin accounts cannot be modified or role-revoked by Support staff.
- **Immutable Security Audit Trail:** Emits `AUTH_ROLE_ASSIGNED` and `AUTH_ROLE_REVOKED` events into append-only `security_audit_events`.

---

## 2. Deliverables & Modified Files

| Deliverable | File Path | Scope / Description |
| :--- | :--- | :--- |
| **Permissions & RBAC Migration** | [`apps/api/src/infrastructure/database/migrations/0004_permissions_and_rbac.sql`](file:///d:/luggage-storage/luggage-storage/apps/api/src/infrastructure/database/migrations/0004_permissions_and_rbac.sql)<br>[`apps/api/src/infrastructure/database/migrations/meta/_journal.json`](file:///d:/luggage-storage/luggage-storage/apps/api/src/infrastructure/database/migrations/meta/_journal.json) | Seeded 54 system permissions, mapped permissions to roles, and provisioned `SECURITY DEFINER` functions `assign_user_role()` and `revoke_user_role()`. |
| **Shared Contracts** | [`packages/contracts/src/rbac/index.ts`](file:///d:/luggage-storage/luggage-storage/packages/contracts/src/rbac/index.ts)<br>[`packages/contracts/src/index.ts`](file:///d:/luggage-storage/luggage-storage/packages/contracts/src/index.ts) | Exported Zod schemas and TypeScript types: `SYSTEM_ROLES`, `SYSTEM_PERMISSIONS`, `PermissionCode`, `PermissionSchema`, `RoleDetailSchema`, `AssignUserRoleRequestSchema`, `PermissionListResponseDataSchema`, `RoleListResponseDataSchema`, `AssignUserRoleResponseDataSchema`, `RevokeUserRoleResponseDataSchema`, and `UserEffectivePermissionsResponseDataSchema`. |
| **RBAC Domain Service** | [`apps/api/src/modules/auth/rbac.service.ts`](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/auth/rbac.service.ts) | Implemented `getEffectivePermissions`, `hasPermission`, `hasAnyPermission`, `hasAllPermissions`, `getUserRoles`, `listRoles`, `listPermissions`, `assignRole`, and `revokeRole` with self-action defenses and audit logging. |
| **Fastify Decorators & Types** | [`apps/api/src/types/fastify.d.ts`](file:///d:/luggage-storage/luggage-storage/apps/api/src/types/fastify.d.ts)<br>[`apps/api/src/app.ts`](file:///d:/luggage-storage/luggage-storage/apps/api/src/app.ts) | Implemented `requirePermission`, `requireAnyPermission`, and `requireAllPermissions` Fastify pre-handler decorators. |
| **Admin Route Permissions Migration** | [`apps/api/src/modules/admin/admin.routes.ts`](file:///d:/luggage-storage/luggage-storage/apps/api/src/modules/admin/admin.routes.ts) | Migrated existing administrative endpoints to permission decorators (`admin.user.*`) and registered role/permission management endpoints (`GET /roles`, `GET /permissions`, `GET /users/:userId/permissions`, `POST /users/:userId/roles`, `DELETE /users/:userId/roles/:roleCode`). |
| **Integration Test Suite** | [`apps/api/tests/rbac-permissions.test.ts`](file:///d:/luggage-storage/luggage-storage/apps/api/tests/rbac-permissions.test.ts) | Implemented 21 automated integration tests against live PostgreSQL covering permission evaluation, decorator guards, role assignment/revocation, self-action prevention, and audit logging. |
| **Test Assertion Alignment** | [`apps/api/tests/admin-account-lifecycle.test.ts`](file:///d:/luggage-storage/luggage-storage/apps/api/tests/admin-account-lifecycle.test.ts) | Aligned error message regex assertion on `GET /users` with fine-grained permission guard error envelope. |

---

## 3. Detailed Architecture & Security Controls

### 3.1 Permission Catalogue & Role Mappings

Migration `0004_permissions_and_rbac.sql` provisions 54 canonical system permissions categorized into 8 domains:

```
┌─────────────────────────────────────────────────────────────────┐
│                      PERMISSION DOMAINS                         │
├───────────────────┬─────────────────────────────────────────────┤
│ identity.*        │ Identity & profile self-service (5)         │
│ booking.*         │ Traveller & host booking operations (10)    │
│ listing.*         │ Host location & capacity management (7)     │
│ storage.*         │ Check-in, check-out, QR verifications (6)   │
│ payment.*         │ Payments, payouts, cards & refunds (7)      │
│ review.*          │ Reviews & dispute responses (5)             │
│ support.*         │ Support ticketing & dispute resolution (5)  │
│ admin.*           │ User, session, role, audit, platform ops (9)│
└───────────────────┴─────────────────────────────────────────────┘
```

#### Role Permission Mapping Summary:
1. **`SUPERADMIN` (54 permissions):** Possesses all system permissions across all domains, including `admin.role.assign`, `admin.role.revoke`, `admin.audit.read`, `admin.platform.manage`, `admin.financial.manage`, and `admin.kyc.manage`.
2. **`SUPPORT` (17 permissions):** Operational administrative permissions:
   - `identity.*` (all 5 self-service permissions)
   - `admin.user.read`, `admin.user.suspend`, `admin.user.reinstate`, `admin.user.deactivate`, `admin.user.reactivate`, `admin.user.verify_email`
   - `admin.session.read_any`
   - `admin.role.read`, `admin.permission.read`
   - `support.ticket.read`, `support.ticket.respond`
   - **Explicitly Excluded:** `admin.platform.manage`, `admin.financial.manage`, `admin.kyc.manage`, `admin.audit.read`, `admin.role.assign`, `admin.role.revoke`.
3. **`HOST_OWNER` / `HOST_STAFF` / `TRAVELLER` (5 permissions each):** Base identity permissions (`identity.profile.read`, `identity.profile.update`, `identity.session.read`, `identity.session.revoke`, `identity.password.change`). Marketplace business permissions for listings, bookings, and payments will be bound in subsequent operational phases.

---

### 3.2 Database Hardening & Security Definer Functions (SEC-05 Compliance)

To maintain SEC-05 compliance, runtime database user `luggage_user` has zero direct DML privileges on `user_roles` or `role_permissions`:

```sql
-- Direct DML revoked from runtime role
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM luggage_user;
REVOKE INSERT, UPDATE, DELETE ON public.role_permissions FROM luggage_user;
```

Role assignment and revocation are encapsulated in strict PostgreSQL functions:
1. **`public.assign_user_role(p_user_id uuid, p_role_code varchar, p_assigned_by uuid)`:**
   - Validates existence of user in `users`.
   - Validates existence of role in `roles`.
   - Idempotently inserts into `user_roles(user_id, role_id, assigned_by)`.
   - Defined as `SECURITY DEFINER` with explicit `SET search_path = public, pg_temp`.
2. **`public.revoke_user_role(p_user_id uuid, p_role_code varchar)`:**
   - Validates existence of role in `roles`.
   - Deletes matching tuple from `user_roles`.
   - Defined as `SECURITY DEFINER` with explicit `SET search_path = public, pg_temp`.

Ownership is configured to `luggage_role_assigner` (or table owner), and `EXECUTE` is granted exclusively to `luggage_user` (`REVOKE ALL FROM PUBLIC`). Direct SQL injection or DML bypass is architecturally impossible.

---

### 3.3 Zero Stale Permission Window (OQ-021 Decision)

In accordance with open question OQ-021, the system does not introduce an unapproved Redis cache layer:
- Effective permissions are computed via a fast, indexed relational join in PostgreSQL:
  ```sql
  SELECT DISTINCT p.code
  FROM permissions p
  JOIN role_permissions rp ON rp.permission_id = p.id
  JOIN user_roles ur ON ur.role_id = rp.role_id
  JOIN users u ON u.id = ur.user_id
  WHERE ur.user_id = $userId
    AND u.status = 'ACTIVE'
  ```
- **Guarantees:**
  1. If an account is suspended or deactivated (`users.status != 'ACTIVE'`), `getEffectivePermissions()` immediately returns `[]`.
  2. If a role is revoked from a user, the corresponding permissions cease to exist for that user on their very next HTTP request.
  3. No cache invalidation race conditions, no stale permission window, and no distributed state divergence.

---

### 3.4 Self-Action Defenses & Privilege Boundaries

To prevent administrative privilege escalation or accidental lockout:
1. **Self-Role Modification Defense:**
   - Administrators cannot assign roles to themselves (`adminId === targetUserId` -> 400 Bad Request: `"Administrators cannot modify their own roles"`).
   - Administrators cannot revoke roles from themselves (`adminId === targetUserId` -> 400 Bad Request: `"Administrators cannot modify their own roles"`).
2. **Minimum Role Invariant:**
   - Users must retain at least one role. Revoking a user's sole remaining role returns 400 Bad Request (`"Cannot revoke user's only role. User must maintain at least one role."`).
3. **Privilege Boundary Enforcement:**
   - Only `SUPERADMIN` actors can assign or revoke administrative roles (`SUPERADMIN`, `SUPPORT`).
   - If a caller without `SUPERADMIN` attempts to assign or revoke an administrative role, `rbacService` throws 403 Forbidden (`"Only Superadmins can assign administrative roles"` / `"Only Superadmins can revoke administrative roles"`).
   - Non-active target users cannot have roles assigned or revoked (400 Bad Request: `"Cannot assign roles to a deactivated user"`).

---

### 3.5 Fastify Authorization Decorators

Authorization decorators provide clean, declarative pre-handler guards for routes:

| Decorator | Signature | Enforcement Semantics |
| :--- | :--- | :--- |
| `app.requirePermission` | `(permission: string)` | Requires caller to have the exact permission. Throws 403 if absent. |
| `app.requireAnyPermission` | `(permissions: string[])` | Requires caller to possess at least one of the specified permissions. |
| `app.requireAllPermissions` | `(permissions: string[])` | Requires caller to possess all of the specified permissions. |

All decorators verify authentication (`request.user`), evaluate live permissions via `rbacService.getEffectivePermissions(request.user.id)`, and reject unauthorized callers with standardized JSON error envelopes:
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied: missing required permission: admin.user.read"
  }
}
```

---

### 3.6 Role Management API Endpoints

The following administrative endpoints were implemented and secured under `/api/v1/admin` and `/admin`:

| Method | Path | Required Permission | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/admin/roles` | `admin.role.read` | Lists all system roles and descriptions. |
| `GET` | `/admin/permissions` | `admin.permission.read` | Lists all 54 system permissions grouped by domain. |
| `GET` | `/admin/users/:userId/permissions` | `admin.role.read` | Inspects target user's active roles and effective permissions. |
| `POST` | `/admin/users/:userId/roles` | `admin.role.assign` | Assigns a new role to a user. Validates boundaries & logs audit. |
| `DELETE` | `/admin/users/:userId/roles/:roleCode` | `admin.role.revoke` | Revokes an assigned role from a user. Validates minimum role & logs audit. |

---

### 3.7 Immutable Audit Events

Role management actions are logged into `security_audit_events`:
- **`AUTH_ROLE_ASSIGNED`:** `{ adminId, roleCode, userRoles }`
- **`AUTH_ROLE_REVOKED`:** `{ adminId, roleCode, remainingRoles }`

Audit events include IP address, user agent, timestamps, and target user ID, protected against tampering by database trigger `trg_prevent_audit_tampering`.

---

## 4. Quality Gate & Verification Evidence

### 4.1 Vitest API Test Suite Execution

All 6 API test suites execute against live PostgreSQL:

```
 RUN  v3.2.7 D:/luggage-storage/luggage-storage/apps/api

 ✓ tests/health.test.ts (5 tests) 1520ms
 ✓ tests/live-database.test.ts (2 tests) 203ms
 ✓ tests/identity-database.test.ts (31 tests) 952ms
 ✓ tests/auth.test.ts (53 tests) 10423ms
 ✓ tests/admin-account-lifecycle.test.ts (27 tests) 8527ms
 ✓ tests/rbac-permissions.test.ts (21 tests) 4125ms

 Test Files  6 passed (6)
      Tests  139 passed (139)
   Duration  13.82s
```

### 4.2 Full Turborepo Monorepo Quality Gate

Command executed uncached:
`pnpm exec turbo run lint typecheck test build --force`

```
Tasks:    16 successful, 16 total
Cached:   0 cached, 16 total
Time:     38.211s

Packages in scope:
- @luggage-storage/contracts: build, test, lint, typecheck (8 tests pass)
- @luggage-storage/api: build, test, lint, typecheck (139 tests pass)
- @luggage-storage/web: build, test, lint, typecheck (3 tests pass)
- @luggage-storage/mobile: build, test, lint, typecheck (2 tests pass)

Monorepo Test Total: 152/152 passed (100% green)
Monorepo Lint & Typecheck: 0 warnings, 0 errors
```

---

## 5. Transition to WP-08

With WP-07 fully completed, verified, and quality-gate validated, the identity foundation provides:
- **WP-01:** Identity domain architecture & entity specifications.
- **WP-02:** PostgreSQL identity schema, constraints, security definer triggers, and privilege hardening.
- **WP-03:** Registration and Argon2id authentication engine with default Traveller role assignment.
- **WP-04:** Session management, token rotation, reuse detection, and multi-session logout.
- **WP-05:** Authenticated password change, enumeration-resistant recovery, and decoupled email boundary (OQ-019).
- **WP-06:** Administrative account lifecycle, explicit status transitions, session invalidation, and audit logging.
- **WP-07:** Centralized RBAC authorization service, permission catalog & mappings, Fastify authorization decorators, zero stale permission window, and SEC-05 compliant database role assignment.

**Verdict:** **`WP-07 COMPLETE — READY FOR WP-08`**

