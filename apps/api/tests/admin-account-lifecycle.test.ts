import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { rateLimitService } from "../src/modules/auth/rate-limit.service.js";

const { Pool } = pg;

describe("WP-06: Admin Account Lifecycle Management", () => {
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

  // Helper to register and configure a test user with a specific role and status
  async function createTestUser(
    roleCode: "TRAVELLER" | "SUPPORT" | "SUPERADMIN" = "TRAVELLER",
    status: "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED" = "ACTIVE",
    options?: { displayName?: string }
  ) {
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const email = `testuser_${uniqueSuffix}@example.com`;
    const password = "StrongPassword123!";
    const displayName = options?.displayName || `User ${uniqueSuffix}`;

    // Register user via standard registration endpoint
    const regRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email,
        password,
        displayName
      }
    });

    expect(regRes.statusCode).toBe(201);
    const regBody = JSON.parse(regRes.body);
    const userId = regBody.data.id;

    // Assign privileged role if not TRAVELLER (using migratorPool)
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

    // Set desired account status and email verification flag
    const isEmailVerified = status !== "PENDING_VERIFICATION";
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

  // Helper to authenticate user and obtain access credentials
  async function loginUser(email: string, password = "StrongPassword123!") {
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email,
        password,
        clientType: "WEB"
      }
    });

    expect(loginRes.statusCode).toBe(200);
    const body = JSON.parse(loginRes.body);
    return {
      accessToken: body.data.accessToken as string,
      user: body.data.user
    };
  }

  // ==========================================================================
  // 1. Authorization & Role Verification Guards
  // ==========================================================================
  describe("1. Authorization & Access Guards", () => {
    it("should reject unauthenticated requests to admin endpoints with 401 Unauthorized", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/users"
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should reject ordinary TRAVELLER users with 403 Forbidden", async () => {
      const traveller = await createTestUser("TRAVELLER", "ACTIVE");
      const { accessToken } = await loginUser(traveller.email, traveller.password);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/users",
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("FORBIDDEN");
      expect(body.error.message).toMatch(/(Administrative privileges required|Access denied)/i);
    });

    it("should allow SUPERADMIN users to access admin endpoints", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken } = await loginUser(superadmin.email, superadmin.password);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/users",
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("should allow SUPPORT users to access admin endpoints", async () => {
      const support = await createTestUser("SUPPORT", "ACTIVE");
      const { accessToken } = await loginUser(support.email, support.password);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/users",
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
    });

    it("should support both /api/v1/admin and /admin unversioned route aliases", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken } = await loginUser(superadmin.email, superadmin.password);

      const res = await app.inject({
        method: "GET",
        url: "/admin/users",
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
    });
  });

  // ==========================================================================
  // 2. User Listing & Filtering (GET /api/v1/admin/users)
  // ==========================================================================
  describe("2. User Listing & Filtering", () => {
    it("should paginate users with metadata and never expose password hashes", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken } = await loginUser(superadmin.email, superadmin.password);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/users?page=1&limit=5",
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(5);
      expect(body.pagination.total).toBeGreaterThanOrEqual(1);

      // Verify absence of sensitive credentials
      expect(res.body).not.toContain("password_hash");
      expect(res.body).not.toContain("$argon2id$");

      // Verify user structure
      const firstUser = body.data[0];
      expect(firstUser.id).toBeDefined();
      expect(firstUser.email).toBeDefined();
      expect(firstUser.displayName).toBeDefined();
      expect(firstUser.status).toBeDefined();
      expect(Array.isArray(firstUser.roles)).toBe(true);
    });

    it("should filter users by status", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken } = await loginUser(superadmin.email, superadmin.password);

      // Create a suspended test user
      const suspendedUser = await createTestUser("TRAVELLER", "SUSPENDED");

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/users?status=SUSPENDED",
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.every((u: { status: string }) => u.status === "SUSPENDED")).toBe(true);
      expect(body.data.some((u: { id: string }) => u.id === suspendedUser.id)).toBe(true);
    });

    it("should search users by email or display name", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken } = await loginUser(superadmin.email, superadmin.password);

      const uniqueMarker = `searchmark_${Date.now()}`;
      const markedUser = await createTestUser("TRAVELLER", "ACTIVE", {
        displayName: `Special ${uniqueMarker} Name`
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/admin/users?search=${uniqueMarker}`,
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      expect(body.data.some((u: { id: string }) => u.id === markedUser.id)).toBe(true);
    });

    it("should filter users by role code", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken } = await loginUser(superadmin.email, superadmin.password);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/users?role=SUPERADMIN",
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      expect(
        body.data.every((u: { roles: string[] }) => u.roles.includes("SUPERADMIN"))
      ).toBe(true);
    });
  });

  // ==========================================================================
  // 3. User Inspection (GET /api/v1/admin/users/:userId)
  // ==========================================================================
  describe("3. User Inspection", () => {
    it("should retrieve comprehensive user inspection details including active session count", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken } = await loginUser(superadmin.email, superadmin.password);

      // Create target user and generate two active sessions
      const targetUser = await createTestUser("TRAVELLER", "ACTIVE");
      await loginUser(targetUser.email, targetUser.password);
      await loginUser(targetUser.email, targetUser.password);

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/admin/users/${targetUser.id}`,
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(targetUser.id);
      expect(body.data.email).toBe(targetUser.email);
      expect(body.data.normalizedEmail).toBe(targetUser.email.toLowerCase());
      expect(body.data.activeSessionCount).toBe(2);
      expect(Array.isArray(body.data.roles)).toBe(true);
      expect(body.data.roles).toContain("TRAVELLER");

      // Verify zero sensitive data disclosure
      expect(res.body).not.toContain("passwordHash");
      expect(res.body).not.toContain("$argon2id$");
    });

    it("should return 404 Not Found for non-existent user ID", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken } = await loginUser(superadmin.email, superadmin.password);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/users/00000000-0000-0000-0000-000000000000",
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("should return 400 Bad Request for malformed non-UUID user ID", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken } = await loginUser(superadmin.email, superadmin.password);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/users/invalid-uuid-string",
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(["VALIDATION_ERROR", "BAD_REQUEST"]).toContain(body.error.code);
    });
  });

  // ==========================================================================
  // 4. Account Suspension Lifecycle (/api/v1/admin/users/:userId/suspend)
  // ==========================================================================
  describe("4. Account Suspension Lifecycle", () => {
    it("should suspend user, immediately revoke sessions, and block subsequent authentication", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken: adminToken } = await loginUser(superadmin.email, superadmin.password);

      const target = await createTestUser("TRAVELLER", "ACTIVE");

      // Establish an active session for the target user
      const { accessToken: victimToken } = await loginUser(target.email, target.password);

      // Verify the victim session is initially active
      const preCheck = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: {
          authorization: `Bearer ${victimToken}`
        }
      });
      expect(preCheck.statusCode).toBe(200);

      // Suspend target user
      const suspendRes = await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${target.id}/suspend`,
        headers: {
          authorization: `Bearer ${adminToken}`
        },
        payload: {
          reason: "Suspicious fraudulent activity detected"
        }
      });

      expect(suspendRes.statusCode).toBe(200);
      const suspendBody = JSON.parse(suspendRes.body);
      expect(suspendBody.success).toBe(true);
      expect(suspendBody.data.user.status).toBe("SUSPENDED");
      expect(suspendBody.data.sessionsRevoked).toBeGreaterThanOrEqual(1);

      // 1. ZERO RESIDUAL ACCESS: Pre-existing access token must be immediately rejected
      const postCheck = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: {
          authorization: `Bearer ${victimToken}`
        }
      });
      expect(postCheck.statusCode).toBe(401);
      const postBody = JSON.parse(postCheck.body);
      expect(postBody.error.message).toContain("Session has been revoked or expired");

      // 2. Subsequent credential login is blocked
      const loginAttempt = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: target.email,
          password: target.password
        }
      });
      expect(loginAttempt.statusCode).toBe(403);
      const loginBody = JSON.parse(loginAttempt.body);
      expect(loginBody.error.message).toContain("Account is suspended");

      // 3. Verify security audit event is recorded
      const auditRes = await runtimePool.query(
        "SELECT event_type, metadata FROM security_audit_events WHERE user_id = $1 AND event_type = 'AUTH_ACCOUNT_SUSPENDED';",
        [target.id]
      );
      expect(auditRes.rows.length).toBe(1);
      expect(auditRes.rows[0].metadata.reason).toBe("Suspicious fraudulent activity detected");
      expect(auditRes.rows[0].metadata.adminId).toBe(superadmin.id);
    });

    it("should reject suspending an already suspended user", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken: adminToken } = await loginUser(superadmin.email, superadmin.password);

      const target = await createTestUser("TRAVELLER", "SUSPENDED");

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${target.id}/suspend`,
        headers: {
          authorization: `Bearer ${adminToken}`
        },
        payload: {
          reason: "Repeated suspension attempt"
        }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain("already suspended");
    });

    it("should reject suspension without a valid reason", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken: adminToken } = await loginUser(superadmin.email, superadmin.password);

      const target = await createTestUser("TRAVELLER", "ACTIVE");

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${target.id}/suspend`,
        headers: {
          authorization: `Bearer ${adminToken}`
        },
        payload: {
          reason: "ab" // Too short (min 3)
        }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // ==========================================================================
  // 5. Account Reinstatement Lifecycle (/api/v1/admin/users/:userId/reinstate)
  // ==========================================================================
  describe("5. Account Reinstatement Lifecycle", () => {
    it("should reinstate suspended user, leave old sessions revoked, and allow fresh login", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken: adminToken } = await loginUser(superadmin.email, superadmin.password);

      const target = await createTestUser("TRAVELLER", "ACTIVE");

      // Establish session then suspend
      const { accessToken: preSuspensionToken } = await loginUser(target.email, target.password);
      await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${target.id}/suspend`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { reason: "Temporary suspension for review" }
      });

      // Reinstate account
      const reinstateRes = await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${target.id}/reinstate`,
        headers: {
          authorization: `Bearer ${adminToken}`
        },
        payload: {
          reason: "Investigation completed - cleared of wrongdoing"
        }
      });

      expect(reinstateRes.statusCode).toBe(200);
      const body = JSON.parse(reinstateRes.body);
      expect(body.success).toBe(true);
      expect(body.data.user.status).toBe("ACTIVE");

      // Old session remains revoked
      const oldSessionCheck = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: {
          authorization: `Bearer ${preSuspensionToken}`
        }
      });
      expect(oldSessionCheck.statusCode).toBe(401);

      // Fresh login succeeds
      const freshLogin = await loginUser(target.email, target.password);
      expect(freshLogin.accessToken).toBeDefined();

      const newSessionCheck = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: {
          authorization: `Bearer ${freshLogin.accessToken}`
        }
      });
      expect(newSessionCheck.statusCode).toBe(200);

      // Verify audit event
      const auditRes = await runtimePool.query(
        "SELECT event_type, metadata FROM security_audit_events WHERE user_id = $1 AND event_type = 'AUTH_ACCOUNT_REINSTATED';",
        [target.id]
      );
      expect(auditRes.rows.length).toBe(1);
      expect(auditRes.rows[0].metadata.adminId).toBe(superadmin.id);
    });

    it("should reject reinstating an account that is not suspended", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken: adminToken } = await loginUser(superadmin.email, superadmin.password);

      const target = await createTestUser("TRAVELLER", "ACTIVE");

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${target.id}/reinstate`,
        headers: {
          authorization: `Bearer ${adminToken}`
        },
        payload: {
          reason: "Invalid reinstatement attempt"
        }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.message).toContain("Only suspended accounts can be reinstated");
    });
  });

  // ==========================================================================
  // 6. Account Deactivation & Reactivation Lifecycle
  // ==========================================================================
  describe("6. Account Deactivation & Reactivation Lifecycle", () => {
    it("should deactivate user, revoke active sessions, and block login", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken: adminToken } = await loginUser(superadmin.email, superadmin.password);

      const target = await createTestUser("TRAVELLER", "ACTIVE");
      const { accessToken: victimToken } = await loginUser(target.email, target.password);

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${target.id}/deactivate`,
        headers: {
          authorization: `Bearer ${adminToken}`
        },
        payload: {
          reason: "Account closure requested"
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.user.status).toBe("DEACTIVATED");

      // Active session revoked immediately
      const sessionCheck = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: {
          authorization: `Bearer ${victimToken}`
        }
      });
      expect(sessionCheck.statusCode).toBe(401);

      // Login blocked
      const loginAttempt = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: target.email,
          password: target.password
        }
      });
      expect(loginAttempt.statusCode).toBe(403);
      const loginBody = JSON.parse(loginAttempt.body);
      expect(loginBody.error.message).toContain("Account is deactivated");
    });

    it("should reactivate deactivated user back to ACTIVE", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken: adminToken } = await loginUser(superadmin.email, superadmin.password);

      const target = await createTestUser("TRAVELLER", "DEACTIVATED");

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${target.id}/reactivate`,
        headers: {
          authorization: `Bearer ${adminToken}`
        },
        payload: {
          reason: "User requested account re-opening"
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.user.status).toBe("ACTIVE");

      // User can now log in
      const freshLogin = await loginUser(target.email, target.password);
      expect(freshLogin.accessToken).toBeDefined();
    });

    it("should reject deactivating an already deactivated user", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken: adminToken } = await loginUser(superadmin.email, superadmin.password);

      const target = await createTestUser("TRAVELLER", "DEACTIVATED");

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${target.id}/deactivate`,
        headers: {
          authorization: `Bearer ${adminToken}`
        },
        payload: {
          reason: "Duplicate deactivation"
        }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.message).toContain("already deactivated");
    });

    it("should reject reactivating a user that is not deactivated", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken: adminToken } = await loginUser(superadmin.email, superadmin.password);

      const target = await createTestUser("TRAVELLER", "ACTIVE");

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${target.id}/reactivate`,
        headers: {
          authorization: `Bearer ${adminToken}`
        }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.message).toContain("Only deactivated accounts can be reactivated");
    });
  });

  // ==========================================================================
  // 7. Email Verification Override
  // ==========================================================================
  describe("7. Email Verification Override", () => {
    it("should allow admin to verify email and transition user from PENDING_VERIFICATION to ACTIVE", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken: adminToken } = await loginUser(superadmin.email, superadmin.password);

      const target = await createTestUser("TRAVELLER", "PENDING_VERIFICATION");

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${target.id}/verify-email`,
        headers: {
          authorization: `Bearer ${adminToken}`
        },
        payload: {
          reason: "Manual verification confirmed via phone call"
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.user.isEmailVerified).toBe(true);
      expect(body.data.user.status).toBe("ACTIVE");

      // Verify audit event
      const auditRes = await runtimePool.query(
        "SELECT event_type, metadata FROM security_audit_events WHERE user_id = $1 AND event_type = 'AUTH_EMAIL_VERIFIED_BY_ADMIN';",
        [target.id]
      );
      expect(auditRes.rows.length).toBe(1);
      expect(auditRes.rows[0].metadata.adminId).toBe(superadmin.id);
    });

    it("should reject verifying an already verified email", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken: adminToken } = await loginUser(superadmin.email, superadmin.password);

      const target = await createTestUser("TRAVELLER", "ACTIVE"); // isEmailVerified is true

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${target.id}/verify-email`,
        headers: {
          authorization: `Bearer ${adminToken}`
        }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.message).toContain("already verified");
    });
  });

  // ==========================================================================
  // 8. Self-Action Defense & Privilege Boundary Protection
  // ==========================================================================
  describe("8. Self-Action Defense & Privilege Boundary Protection", () => {
    it("should prevent administrators from suspending their own account", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken: adminToken } = await loginUser(superadmin.email, superadmin.password);

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${superadmin.id}/suspend`,
        headers: {
          authorization: `Bearer ${adminToken}`
        },
        payload: {
          reason: "Accidental self-suspension"
        }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.message).toContain("cannot suspend their own account");
    });

    it("should prevent administrators from deactivating their own account", async () => {
      const superadmin = await createTestUser("SUPERADMIN", "ACTIVE");
      const { accessToken: adminToken } = await loginUser(superadmin.email, superadmin.password);

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${superadmin.id}/deactivate`,
        headers: {
          authorization: `Bearer ${adminToken}`
        },
        payload: {
          reason: "Self deactivation attempt"
        }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.message).toContain("cannot deactivate their own account");
    });

    it("should prevent SUPPORT staff from suspending SUPERADMIN accounts", async () => {
      const support = await createTestUser("SUPPORT", "ACTIVE");
      const { accessToken: supportToken } = await loginUser(support.email, support.password);

      const targetSuperadmin = await createTestUser("SUPERADMIN", "ACTIVE");

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${targetSuperadmin.id}/suspend`,
        headers: {
          authorization: `Bearer ${supportToken}`
        },
        payload: {
          reason: "Unauthorized privilege escalation / disruption"
        }
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe("FORBIDDEN");
      expect(body.error.message).toContain("Support personnel cannot suspend Superadmin accounts");
    });

    it("should prevent SUPPORT staff from deactivating SUPERADMIN accounts", async () => {
      const support = await createTestUser("SUPPORT", "ACTIVE");
      const { accessToken: supportToken } = await loginUser(support.email, support.password);

      const targetSuperadmin = await createTestUser("SUPERADMIN", "ACTIVE");

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${targetSuperadmin.id}/deactivate`,
        headers: {
          authorization: `Bearer ${supportToken}`
        },
        payload: {
          reason: "Support attempt to deactivate superadmin"
        }
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe("FORBIDDEN");
      expect(body.error.message).toContain(
        "Support personnel cannot deactivate Superadmin accounts"
      );
    });
  });
});
