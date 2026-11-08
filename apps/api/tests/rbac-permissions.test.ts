import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { rbacService } from "../src/modules/auth/rbac.service.js";
import { rateLimitService } from "../src/modules/auth/rate-limit.service.js";

const { Pool } = pg;

describe("WP-07: RBAC and Permission Architecture", () => {
  let app: FastifyInstance;
  let migratorPool: pg.Pool;
  let runtimePool: pg.Pool;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    migratorPool = new Pool({
      connectionString: env.MIGRATION_DATABASE_URL,
      max: 2
    });
    runtimePool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 2
    });
  });

  beforeEach(async () => {
    await rateLimitService.clearAll();
  });

  afterAll(async () => {
    await app.close();
    await migratorPool.end();
    await runtimePool.end();
  });

  async function createTestUser(
    roleCode: "TRAVELLER" | "SUPPORT" | "SUPERADMIN" | "HOST_OWNER" | "HOST_STAFF" = "TRAVELLER",
    status: "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED" = "ACTIVE",
    options?: { displayName?: string }
  ) {
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const email = `rbac_${uniqueSuffix}@example.com`;
    const password = "StrongPassword123!";
    const displayName = options?.displayName || `RBAC User ${uniqueSuffix}`;

    const regRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: { email, password, displayName }
    });

    expect(regRes.statusCode).toBe(201);
    const regBody = JSON.parse(regRes.body);
    const userId = regBody.data.id;

    if (roleCode !== "TRAVELLER") {
      const roleRes = await migratorPool.query(
        "SELECT id FROM roles WHERE code = $1 LIMIT 1;",
        [roleCode]
      );
      expect(roleRes.rows.length).toBe(1);
      const roleId = roleRes.rows[0].id;

      await migratorPool.query(
        "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;",
        [userId, roleId]
      );
    }

    const isEmailVerified = status === "ACTIVE";
    await migratorPool.query(
      "UPDATE users SET status = $1, is_email_verified = $2, updated_at = NOW() WHERE id = $3;",
      [status, isEmailVerified, userId]
    );

    return {
      id: userId,
      email,
      password,
      displayName
    };
  }

  async function loginUser(email: string, password = "StrongPassword123!") {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password, clientType: "WEB" }
    });

    expect(loginRes.statusCode).toBe(200);
    const body = JSON.parse(loginRes.body);
    return {
      accessToken: body.data.accessToken as string,
      user: body.data.user
    };
  }

  // ==========================================================================
  // 1. Permission Resolution & Aggregation Engine
  // ==========================================================================
  describe("1. Permission Resolution & Aggregation Engine", () => {
    it("should resolve identity permissions for standard TRAVELLER role", async () => {
      const traveller = await createTestUser("TRAVELLER", "ACTIVE");
      const permissions = await rbacService.getEffectivePermissions(traveller.id);

      expect(permissions).toContain("identity.profile.read");
      expect(permissions).toContain("identity.profile.update");
      expect(permissions).toContain("identity.session.read_own");
      expect(permissions).toContain("identity.session.revoke_own");
      expect(permissions).toContain("identity.password.change");

      // Verify no administrative capabilities are present
      expect(permissions.some((p) => p.startsWith("admin."))).toBe(false);
      expect(permissions.some((p) => p.startsWith("support."))).toBe(false);
    });

    it("should resolve all permissions for SUPERADMIN role", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const permissions = await rbacService.getEffectivePermissions(superadmin.id);

      expect(permissions).toContain("admin.user.read");
      expect(permissions).toContain("admin.user.suspend");
      expect(permissions).toContain("admin.user.reinstate");
      expect(permissions).toContain("admin.user.deactivate");
      expect(permissions).toContain("admin.role.assign");
      expect(permissions).toContain("admin.role.revoke");
      expect(permissions).toContain("admin.platform.manage");
      expect(permissions).toContain("admin.financial.manage");
      expect(permissions).toContain("admin.kyc.manage");
    });

    it("should resolve operational permissions for SUPPORT role and exclude restricted capabilities", async () => {
      const support = await createTestUser("SUPPORT", "ACTIVE");
      const permissions = await rbacService.getEffectivePermissions(support.id);

      // Permitted support capabilities
      expect(permissions).toContain("admin.user.read");
      expect(permissions).toContain("admin.user.suspend");
      expect(permissions).toContain("admin.user.reinstate");
      expect(permissions).toContain("admin.user.verify_email");
      expect(permissions).toContain("support.ticket.read");
      expect(permissions).toContain("support.ticket.update");

      // Strictly prohibited capabilities (Section 11.5)
      expect(permissions).not.toContain("admin.role.assign");
      expect(permissions).not.toContain("admin.role.revoke");
      expect(permissions).not.toContain("admin.platform.manage");
      expect(permissions).not.toContain("admin.financial.manage");
      expect(permissions).not.toContain("admin.kyc.manage");
      expect(permissions).not.toContain("admin.audit.read");
    });

    it("should aggregate permissions deduplicating across multiple assigned roles", async () => {
      const multiRoleUser = await createTestUser("TRAVELLER", "ACTIVE");

      // Add HOST_OWNER and SUPPORT roles to user
      const hostOwnerRes = await migratorPool.query(
        "SELECT id FROM roles WHERE code = 'HOST_OWNER';"
      );
      const supportRes = await migratorPool.query(
        "SELECT id FROM roles WHERE code = 'SUPPORT';"
      );

      await migratorPool.query(
        "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2), ($1, $3) ON CONFLICT DO NOTHING;",
        [multiRoleUser.id, hostOwnerRes.rows[0].id, supportRes.rows[0].id]
      );

      const permissions = await rbacService.getEffectivePermissions(multiRoleUser.id);

      // Verify presence of union of permissions
      expect(permissions).toContain("identity.profile.read");
      expect(permissions).toContain("admin.user.read");
      expect(permissions).toContain("support.ticket.read");

      // Verify no duplicates
      const uniqueCount = new Set(permissions).size;
      expect(permissions.length).toBe(uniqueCount);
    });

    it("should return empty permissions for SUSPENDED or DEACTIVATED accounts", async () => {
      const suspended = await createTestUser("SUPERADMIN", "SUSPENDED");
      const suspendedPerms = await rbacService.getEffectivePermissions(suspended.id);
      expect(suspendedPerms).toEqual([]);

      const deactivated = await createTestUser("SUPERADMIN", "DEACTIVATED");
      const deactivatedPerms = await rbacService.getEffectivePermissions(deactivated.id);
      expect(deactivatedPerms).toEqual([]);
    });

    it("should correctly evaluate hasPermission, hasAnyPermission, and hasAllPermissions", async () => {
      const support = await createTestUser("SUPPORT", "ACTIVE");

      expect(await rbacService.hasPermission(support.id, "admin.user.read")).toBe(true);
      expect(await rbacService.hasPermission(support.id, "admin.platform.manage")).toBe(false);

      expect(
        await rbacService.hasAnyPermission(support.id, [
          "admin.platform.manage",
          "admin.user.read"
        ])
      ).toBe(true);
      expect(
        await rbacService.hasAnyPermission(support.id, [
          "admin.platform.manage",
          "admin.financial.manage"
        ])
      ).toBe(false);

      expect(
        await rbacService.hasAllPermissions(support.id, [
          "admin.user.read",
          "support.ticket.read"
        ])
      ).toBe(true);
      expect(
        await rbacService.hasAllPermissions(support.id, [
          "admin.user.read",
          "admin.platform.manage"
        ])
      ).toBe(false);
    });
  });

  // ==========================================================================
  // 2. Authorization Enforcement & Route Guards
  // ==========================================================================
  describe("2. Authorization Enforcement & Route Guards", () => {
    it("should allow access when user possesses required permission", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken } = await loginUser(superadmin.email, superadmin.password);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/roles",
        headers: { authorization: `Bearer ${accessToken}` }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("should reject with 403 Forbidden when user lacks required permission", async () => {
      const support = await createTestUser("SUPPORT", "ACTIVE");
      const { accessToken } = await loginUser(support.email, support.password);

      // Support lacks admin.role.assign
      const target = await createTestUser("TRAVELLER", "ACTIVE");
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${target.id}/roles`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { roleCode: "HOST_OWNER" }
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("FORBIDDEN");
      expect(body.error.message).toContain("admin.role.assign");
    });

    it("should reject unauthenticated request with 401 Unauthorized", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/permissions"
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should ignore client-supplied role or permission header tampering", async () => {
      const traveller = await createTestUser("TRAVELLER", "ACTIVE");
      const { accessToken } = await loginUser(traveller.email, traveller.password);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/roles",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "x-custom-role": "SUPERADMIN",
          "x-permission-override": "admin.role.read"
        }
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("should inspect user permissions via GET /users/:userId/permissions", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken } = await loginUser(superadmin.email, superadmin.password);

      const target = await createTestUser("SUPPORT", "ACTIVE");

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/admin/users/${target.id}/permissions`,
        headers: { authorization: `Bearer ${accessToken}` }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.userId).toBe(target.id);
      expect(body.data.roles).toContain("SUPPORT");
      expect(body.data.permissions).toContain("admin.user.read");
      expect(body.data.permissions).toContain("support.ticket.read");
    });
  });

  // ==========================================================================
  // 3. Role Management Operations
  // ==========================================================================
  describe("3. Role Management Operations", () => {
    it("should allow Superadmin to assign a new role to a user", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken: adminToken } = await loginUser(superadmin.email, superadmin.password);

      const target = await createTestUser("TRAVELLER", "ACTIVE");

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${target.id}/roles`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { roleCode: "HOST_OWNER" }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.roles).toContain("HOST_OWNER");
      expect(body.data.roles).toContain("TRAVELLER");

      // Verify audit event
      const auditRes = await runtimePool.query(
        "SELECT event_type, metadata FROM security_audit_events WHERE user_id = $1 AND event_type = 'AUTH_ROLE_ASSIGNED';",
        [target.id]
      );
      expect(auditRes.rows.length).toBe(1);
      expect(auditRes.rows[0].metadata.roleCode).toBe("HOST_OWNER");
      expect(auditRes.rows[0].metadata.adminId).toBe(superadmin.id);
    });

    it("should prevent administrators from assigning roles to themselves", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken: adminToken } = await loginUser(superadmin.email, superadmin.password);

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${superadmin.id}/roles`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { roleCode: "HOST_OWNER" }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.message).toContain("cannot modify roles on their own account");
    });

    it("should allow Superadmin to revoke an assigned role from a user", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken: adminToken } = await loginUser(superadmin.email, superadmin.password);

      const target = await createTestUser("TRAVELLER", "ACTIVE");

      // Assign HOST_OWNER first
      await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${target.id}/roles`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { roleCode: "HOST_OWNER" }
      });

      // Revoke HOST_OWNER
      const revokeRes = await app.inject({
        method: "DELETE",
        url: `/api/v1/admin/users/${target.id}/roles/HOST_OWNER`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(revokeRes.statusCode).toBe(200);
      const body = JSON.parse(revokeRes.body);
      expect(body.success).toBe(true);
      expect(body.data.roles).not.toContain("HOST_OWNER");
      expect(body.data.roles).toContain("TRAVELLER");

      // Verify audit event
      const auditRes = await runtimePool.query(
        "SELECT event_type, metadata FROM security_audit_events WHERE user_id = $1 AND event_type = 'AUTH_ROLE_REVOKED';",
        [target.id]
      );
      expect(auditRes.rows.length).toBe(1);
      expect(auditRes.rows[0].metadata.roleCode).toBe("HOST_OWNER");
    });

    it("should reject revoking the only remaining role from a user", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken: adminToken } = await loginUser(superadmin.email, superadmin.password);

      const target = await createTestUser("TRAVELLER", "ACTIVE");

      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/admin/users/${target.id}/roles/TRAVELLER`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.message).toContain("Cannot revoke the user's only remaining role");
    });

    it("should prevent administrators from revoking roles from themselves", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken: adminToken } = await loginUser(superadmin.email, superadmin.password);

      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/admin/users/${superadmin.id}/roles/SUPERADMIN`,
        headers: { authorization: `Bearer ${adminToken}` }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.message).toContain("cannot modify roles on their own account");
    });

    it("should reject role assignment for non-existent role code", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken: adminToken } = await loginUser(superadmin.email, superadmin.password);

      const target = await createTestUser("TRAVELLER", "ACTIVE");

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${target.id}/roles`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { roleCode: "NON_EXISTENT_ROLE_123" }
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error.message).toContain("Role not found");
    });
  });

  // ==========================================================================
  // 4. Support / Superadmin Separation & Boundary Defense
  // ==========================================================================
  describe("4. Support / Superadmin Separation & Boundary Defense", () => {
    it("should prevent Support staff from assigning SUPERADMIN role", async () => {
      const support = await createTestUser("SUPPORT", "ACTIVE");
      const { accessToken: supportToken } = await loginUser(support.email, support.password);

      const target = await createTestUser("TRAVELLER", "ACTIVE");

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${target.id}/roles`,
        headers: { authorization: `Bearer ${supportToken}` },
        payload: { roleCode: "SUPERADMIN" }
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("should verify Support cannot suspend Superadmin accounts", async () => {
      const support = await createTestUser("SUPPORT", "ACTIVE");
      const { accessToken: supportToken } = await loginUser(support.email, support.password);

      const targetSuperadmin = await createTestUser("SUPERADMIN", "ACTIVE");

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${targetSuperadmin.id}/suspend`,
        headers: { authorization: `Bearer ${supportToken}` },
        payload: { reason: "Unauthorized attempt" }
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe("FORBIDDEN");
      expect(body.error.message).toContain("Support personnel cannot suspend Superadmin accounts");
    });

    it("should verify Support cannot deactivate Superadmin accounts", async () => {
      const support = await createTestUser("SUPPORT", "ACTIVE");
      const { accessToken: supportToken } = await loginUser(support.email, support.password);

      const targetSuperadmin = await createTestUser("SUPERADMIN", "ACTIVE");

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${targetSuperadmin.id}/deactivate`,
        headers: { authorization: `Bearer ${supportToken}` },
        payload: { reason: "Unauthorized attempt" }
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe("FORBIDDEN");
      expect(body.error.message).toContain("Support personnel cannot deactivate Superadmin accounts");
    });

    it("should verify runtime user cannot perform direct DML on user_roles (SEC-05 defense)", async () => {
      // Direct raw insert by runtimePool should fail due to REVOKE INSERT on user_roles
      await expect(
        runtimePool.query(
          "INSERT INTO user_roles (user_id, role_id) VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000');"
        )
      ).rejects.toThrowError(/permission denied for table user_roles/i);
    });
  });
});

