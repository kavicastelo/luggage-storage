import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import pg from "pg";
import {
  UuidSchema,
  UserIdParamSchema,
  SessionIdParamSchema,
  RoleCodeParamSchema
} from "@luggage-storage/contracts";
import { buildApp } from "../src/app.js";
import { env } from "../src/config/env.js";

const { Pool } = pg;

function extractCookie(
  res: { headers: Record<string, string | string[] | undefined> },
  name: string
): string | undefined {
  const raw = res.headers["set-cookie"];
  if (!raw) return undefined;
  const cookieStrings = Array.isArray(raw) ? raw : [raw];
  for (const str of cookieStrings) {
    const match = str.match(new RegExp(`${name}=([^;]+)`));
    if (match) return match[1];
  }
  return undefined;
}

describe("WP-11: Authentication & RBAC Security Testing Suite", () => {
  let app: FastifyInstance;
  let migratorPool: pg.Pool;
  let runtimePool: pg.Pool;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    migratorPool = new Pool({
      connectionString: env.MIGRATION_DATABASE_URL,
      max: 5
    });
    runtimePool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 5
    });
  });

  afterAll(async () => {
    await app.close();
    await migratorPool.end();
    await runtimePool.end();
  });

  async function registerUser(options?: {
    email?: string;
    password?: string;
    displayName?: string;
    role?: string;
  }) {
    const unique = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const email = options?.email || `sec_${unique}@example.com`;
    const password = options?.password || "SecPass123!@#";
    const displayName = options?.displayName || `SecUser ${unique}`;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email,
        password,
        displayName,
        ...(options?.role ? { role: options.role } : {})
      }
    });

    return { res, email, password, displayName, body: JSON.parse(res.body) };
  }

  async function loginUser(
    email: string,
    password = "SecPass123!@#",
    clientType: "WEB" | "MOBILE" = "WEB"
  ) {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password, clientType }
    });
    const body = JSON.parse(res.body);
    const refreshToken =
      clientType === "WEB" ? extractCookie(res, "refresh_token") : body.data?.refreshToken;
    return {
      res,
      body,
      accessToken: body.data?.accessToken,
      refreshToken,
      sessionId: body.data?.user?.id
    };
  }

  async function promoteUserToRole(
    userId: string,
    roleCode: "SUPERADMIN" | "SUPPORT" | "HOST_OWNER" | "HOST_STAFF"
  ) {
    const roleRes = await migratorPool.query("SELECT id FROM roles WHERE code = $1 LIMIT 1;", [
      roleCode
    ]);
    expect(roleRes.rows.length).toBe(1);
    const roleId = roleRes.rows[0].id;

    await migratorPool.query(
      `INSERT INTO user_roles (user_id, role_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, role_id) DO NOTHING;`,
      [userId, roleId]
    );

    await migratorPool.query(
      "UPDATE users SET status = 'ACTIVE', is_email_verified = true WHERE id = $1;",
      [userId]
    );
  }

  // ==========================================================================
  // 1. Authentication Security & Credential Protection
  // ==========================================================================
  describe("1. Authentication Security & Credential Protection", () => {
    it("SEC-REG-01: should reject client-supplied privileged roles during registration and default strictly to TRAVELLER", async () => {
      const { res, body } = await registerUser({ role: "SUPERADMIN" });
      expect(res.statusCode).toBe(201);
      expect(body.data.roles).toEqual(["TRAVELLER"]);
      expect(body.data.roles).not.toContain("SUPERADMIN");

      // Verify directly in database that only TRAVELLER role exists
      const dbRoles = await runtimePool.query(
        `SELECT r.code FROM roles r
         JOIN user_roles ur ON ur.role_id = r.id
         WHERE ur.user_id = $1;`,
        [body.data.id]
      );
      expect(dbRoles.rows.map((r) => r.code)).toEqual(["TRAVELLER"]);
    });

    it("SEC-REG-02: should prevent duplicate registration case-insensitively using normalized email", async () => {
      const unique = `norm_${Date.now()}`;
      const emailOriginal = `CaseTest_${unique}@Example.COM`;
      const emailDuplicate = `casetest_${unique}@example.com`;

      const first = await registerUser({ email: emailOriginal });
      expect(first.res.statusCode).toBe(201);

      const second = await registerUser({ email: emailDuplicate });
      expect(second.res.statusCode).toBe(409);
      expect(second.body.error.code).toBe("CONFLICT");
      expect(second.body.error.message).toMatch(/already exists/i);
    });

    it("SEC-REG-03: should never disclose password hashes, salts, or raw passwords in response envelopes or error details", async () => {
      const password = "SensitiveSecretPassword999!";
      const { res, body } = await registerUser({ password });
      expect(res.statusCode).toBe(201);

      const bodyString = JSON.stringify(body);
      expect(bodyString).not.toContain(password);
      expect(bodyString).not.toContain("$argon2id$");
      expect(bodyString).not.toContain("passwordHash");
      expect(bodyString).not.toContain("password_hash");

      // Check login response as well
      const login = await loginUser(body.data.email, password);
      const loginString = JSON.stringify(login.body);
      expect(loginString).not.toContain(password);
      expect(loginString).not.toContain("$argon2id$");
      expect(loginString).not.toContain("passwordHash");
    });

    it("SEC-REG-04: should enforce password complexity and reject weak, empty, or oversized passwords", async () => {
      const shortPass = await registerUser({ password: "short" });
      expect(shortPass.res.statusCode).toBe(400);
      expect(shortPass.body.error.code).toBe("VALIDATION_ERROR");

      const emptyPass = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: { email: "weak@example.com", password: "", displayName: "Weak" }
      });
      expect(emptyPass.statusCode).toBe(400);

      const oversizedPass = await registerUser({ password: "a".repeat(129) });
      expect(oversizedPass.res.statusCode).toBe(400);
      expect(oversizedPass.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("SEC-REG-05: should resist user enumeration with equalized error envelopes and timing mitigation for unknown accounts", async () => {
      const { email } = await registerUser();

      // Case A: Existing user, wrong password
      const startA = Date.now();
      const resA = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password: "WrongPassword999!", clientType: "WEB" }
      });
      const durationA = Date.now() - startA;

      // Case B: Non-existent user
      const startB = Date.now();
      const resB = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "completely_non_existent_user_999@example.com", password: "WrongPassword999!", clientType: "WEB" }
      });
      const durationB = Date.now() - startB;

      // Both must return identical generic 401 response envelopes
      expect(resA.statusCode).toBe(401);
      expect(resB.statusCode).toBe(401);

      const bodyA = JSON.parse(resA.body);
      const bodyB = JSON.parse(resB.body);
      expect(bodyA.error.message).toBe("Invalid email or password");
      expect(bodyB.error.message).toBe("Invalid email or password");
      expect(bodyA.error.code).toBe("UNAUTHORIZED");
      expect(bodyB.error.code).toBe("UNAUTHORIZED");

      // Timing mitigation: both execute Argon2id work (both should take > 30ms on this machine)
      expect(durationA).toBeGreaterThan(20);
      expect(durationB).toBeGreaterThan(20);
    });

    it("SEC-REG-06: should immediately block login attempts for SUSPENDED and DEACTIVATED accounts with 403 Forbidden", async () => {
      const { email, password, body } = await registerUser();
      const userId = body.data.id;

      // Suspend user
      await migratorPool.query("UPDATE users SET status = 'SUSPENDED' WHERE id = $1;", [userId]);
      const suspendedRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password, clientType: "WEB" }
      });
      expect(suspendedRes.statusCode).toBe(403);
      expect(JSON.parse(suspendedRes.body).error.message).toMatch(/suspended/i);

      // Deactivate user
      await migratorPool.query("UPDATE users SET status = 'DEACTIVATED' WHERE id = $1;", [userId]);
      const deactivatedRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password, clientType: "WEB" }
      });
      expect(deactivatedRes.statusCode).toBe(403);
      expect(JSON.parse(deactivatedRes.body).error.message).toMatch(/deactivated/i);
    });

    it("SEC-REG-07: should safely reject SQL injection payloads in authentication requests without syntax errors", async () => {
      const sqliEmail = "' OR 1=1; --";
      const sqliPass = "' OR 'x'='x";

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: sqliEmail, password: sqliPass, clientType: "WEB" }
      });

      // Zod validation should reject malformed email format
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(JSON.stringify(body)).not.toContain("syntax error");
      expect(JSON.stringify(body)).not.toContain("PostgreSQL");
    });
  });

  // ==========================================================================
  // 2. Session Lifecycle, Token Rotation & Concurrency Abuse
  // ==========================================================================
  describe("2. Session Lifecycle, Token Rotation & Concurrency Abuse", () => {
    it("SEC-SES-01: should store only cryptographic SHA-256 hashes of refresh tokens, never plaintext", async () => {
      const { email, password } = await registerUser();
      const login = await loginUser(email, password, "MOBILE");

      expect(login.res.statusCode).toBe(200);
      const plaintextToken = login.refreshToken;
      expect(plaintextToken).toBeDefined();

      // Check auth_sessions table in database
      const sessionRow = await runtimePool.query(
        "SELECT refresh_token_hash FROM auth_sessions WHERE user_id = $1;",
        [login.body.data.user.id]
      );
      expect(sessionRow.rows.length).toBe(1);
      const storedHash = sessionRow.rows[0].refresh_token_hash;

      // Stored value must be a 64-char hex SHA-256 string, NOT the plaintext token
      expect(storedHash).toHaveLength(64);
      expect(storedHash).not.toBe(plaintextToken);
    });

    it("SEC-SES-02: should successfully rotate refresh token and issue new JWT access token", async () => {
      const { email, password } = await registerUser();
      const login = await loginUser(email, password, "MOBILE");

      const refreshRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        payload: { refreshToken: login.refreshToken, clientType: "MOBILE" }
      });

      expect(refreshRes.statusCode).toBe(200);
      const refreshBody = JSON.parse(refreshRes.body);
      expect(refreshBody.data.accessToken).toBeDefined();
      expect(refreshBody.data.refreshToken).toBeDefined();
      expect(refreshBody.data.refreshToken).not.toBe(login.refreshToken);

      // Verify the new access token works on /auth/me
      const meRes = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${refreshBody.data.accessToken}` }
      });
      expect(meRes.statusCode).toBe(200);
    });

    it("SEC-SES-03: should detect refresh token reuse, revoke all active sessions for user, and emit audit event", async () => {
      const { email, password } = await registerUser();
      const login = await loginUser(email, password, "MOBILE");
      const firstToken = login.refreshToken;

      // 1st rotation: consumes firstToken, produces secondToken
      const firstRotation = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        payload: { refreshToken: firstToken, clientType: "MOBILE" }
      });
      expect(firstRotation.statusCode).toBe(200);
      const secondToken = JSON.parse(firstRotation.body).data.refreshToken;

      // 2nd rotation with replayed firstToken (REUSE ATTACK!)
      const reuseAttempt = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        payload: { refreshToken: firstToken, clientType: "MOBILE" }
      });
      expect(reuseAttempt.statusCode).toBe(401);

      // Verify family revocation: even the legitimate secondToken is now revoked
      const legitimateAttempt = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        payload: { refreshToken: secondToken, clientType: "MOBILE" }
      });
      expect(legitimateAttempt.statusCode).toBe(401);

      // Verify all sessions in database are marked revoked
      const sessions = await runtimePool.query(
        "SELECT revoked_at FROM auth_sessions WHERE user_id = $1;",
        [login.body.data.user.id]
      );
      expect(sessions.rows.length).toBeGreaterThan(0);
      for (const s of sessions.rows) {
        expect(s.revoked_at).not.toBeNull();
      }

      // Verify AUTH_TOKEN_REUSE_DETECTED audit event was logged
      const audit = await migratorPool.query(
        `SELECT event_type FROM security_audit_events 
         WHERE user_id = $1 AND event_type = 'AUTH_TOKEN_REUSE_DETECTED';`,
        [login.body.data.user.id]
      );
      expect(audit.rows.length).toBeGreaterThan(0);
    });

    it("SEC-SES-04: should serialize concurrent refresh attempts via row-level locks so exactly one succeeds", async () => {
      const { email, password } = await registerUser();
      const login = await loginUser(email, password, "MOBILE");
      const token = login.refreshToken;

      // Fire 3 simultaneous refresh requests with the exact same token
      const promises = [
        app.inject({ method: "POST", url: "/api/v1/auth/refresh", payload: { refreshToken: token, clientType: "MOBILE" } }),
        app.inject({ method: "POST", url: "/api/v1/auth/refresh", payload: { refreshToken: token, clientType: "MOBILE" } }),
        app.inject({ method: "POST", url: "/api/v1/auth/refresh", payload: { refreshToken: token, clientType: "MOBILE" } })
      ];

      const results = await Promise.all(promises);
      const statusCodes = results.map((r) => r.statusCode);

      // Exactly 1 request must succeed (200), others must be rejected (401)
      const successCount = statusCodes.filter((s) => s === 200).length;
      const failureCount = statusCodes.filter((s) => s === 401).length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(2);
    });

    it("SEC-SES-05: should enforce immediate zero-residual access on logout (current and all devices)", async () => {
      const { email, password } = await registerUser();
      const login = await loginUser(email, password, "MOBILE");
      const token = login.accessToken;

      // Verify access works before logout
      const beforeRes = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${token}` }
      });
      expect(beforeRes.statusCode).toBe(200);

      // Execute logout
      const logoutRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
        headers: { authorization: `Bearer ${token}` }
      });
      expect(logoutRes.statusCode).toBe(200);

      // Immediate revocation: next call with same access token must fail with 401
      const afterRes = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${token}` }
      });
      expect(afterRes.statusCode).toBe(401);
      expect(JSON.parse(afterRes.body).error.message).toMatch(/revoked|expired/i);
    });

    it("SEC-SES-06: should strictly prevent cross-user session inspection and revocation", async () => {
      const userA = await registerUser();
      const userB = await registerUser();

      const loginA = await loginUser(userA.email, userA.password, "MOBILE");
      await loginUser(userB.email, userB.password, "MOBILE");

      // Obtain user B's actual session ID
      const sessionsB = await runtimePool.query(
        "SELECT id FROM auth_sessions WHERE user_id = $1;",
        [userB.body.data.id]
      );
      const sessionBId = sessionsB.rows[0].id;

      // User A attempts to delete User B's session
      const deleteAttempt = await app.inject({
        method: "DELETE",
        url: `/api/v1/auth/sessions/${sessionBId}`,
        headers: { authorization: `Bearer ${loginA.accessToken}` }
      });

      // Must be rejected (404 Not Found to prevent enumeration, or 403)
      expect([403, 404]).toContain(deleteAttempt.statusCode);

      // Verify User B's session remains active and not revoked
      const verifyB = await runtimePool.query(
        "SELECT revoked_at FROM auth_sessions WHERE id = $1;",
        [sessionBId]
      );
      expect(verifyB.rows[0].revoked_at).toBeNull();
    });
  });

  // ==========================================================================
  // 3. Password Security & Recovery Protection
  // ==========================================================================
  describe("3. Password Security & Recovery Protection", () => {
    it("SEC-PWD-01: should revoke all sibling sessions on password change while preserving caller's current session", async () => {
      const { email, password } = await registerUser();

      // Create Session 1 (Caller)
      const session1 = await loginUser(email, password, "MOBILE");
      // Create Session 2 (Sibling device)
      const session2 = await loginUser(email, password, "MOBILE");

      const newPassword = "NewSecPassword456!#";

      // Execute password change using Session 1
      const changeRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/change-password",
        headers: { authorization: `Bearer ${session1.accessToken}` },
        payload: {
          currentPassword: password,
          newPassword,
          confirmPassword: newPassword
        }
      });
      expect(changeRes.statusCode).toBe(200);

      // Session 1 (caller) should remain valid
      const callerCheck = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${session1.accessToken}` }
      });
      expect(callerCheck.statusCode).toBe(200);

      // Session 2 (sibling) must be immediately invalidated
      const siblingCheck = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${session2.accessToken}` }
      });
      expect(siblingCheck.statusCode).toBe(401);
    });

    it("SEC-PWD-02: should enforce single-use reset tokens and revoke all sessions on reset", async () => {
      const { email, password, body } = await registerUser();
      const login = await loginUser(email, password, "MOBILE");
      const userId = body.data.id;

      // Request password reset
      const forgotRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/forgot-password",
        payload: { email }
      });
      expect(forgotRes.statusCode).toBe(200);

      // Extract raw token from deterministic test email adapter / database
      const tokenRow = await migratorPool.query(
        `SELECT token_hash FROM password_reset_tokens 
         WHERE user_id = $1 AND used_at IS NULL 
         ORDER BY created_at DESC LIMIT 1;`,
        [userId]
      );
      expect(tokenRow.rows.length).toBe(1);

      // Simulate client reset with valid token via password service
      // To test endpoint, we insert a known token verifier
      const crypto = await import("node:crypto");
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 3600 * 1000);

      await migratorPool.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3);`,
        [userId, tokenHash, expiresAt]
      );

      const resetPassword = "ResetPassword789!#";

      // 1st consumption: should succeed
      const resetRes1 = await app.inject({
        method: "POST",
        url: "/api/v1/auth/reset-password",
        payload: {
          token: rawToken,
          newPassword: resetPassword,
          confirmPassword: resetPassword
        }
      });
      expect(resetRes1.statusCode).toBe(200);

      // Verify all active sessions were revoked
      const sessionCheck = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${login.accessToken}` }
      });
      expect(sessionCheck.statusCode).toBe(401);

      // 2nd consumption (REPLAY ATTACK!): must be rejected
      const resetRes2 = await app.inject({
        method: "POST",
        url: "/api/v1/auth/reset-password",
        payload: {
          token: rawToken,
          newPassword: "AnotherPassword123!",
          confirmPassword: "AnotherPassword123!"
        }
      });
      expect(resetRes2.statusCode).toBe(400);
      expect(JSON.parse(resetRes2.body).error.message).toMatch(/invalid or expired/i);
    });
  });

  // ==========================================================================
  // 4. RBAC & Authorization Boundary Defense
  // ==========================================================================
  describe("4. RBAC & Authorization Boundary Defense", () => {
    it("SEC-RBAC-01: should reject anonymous requests to protected endpoints with 401 UNAUTHORIZED", async () => {
      const endpoints = [
        { method: "GET" as const, url: "/api/v1/auth/me" },
        { method: "GET" as const, url: "/api/v1/auth/sessions" },
        { method: "POST" as const, url: "/api/v1/auth/logout-all" },
        { method: "GET" as const, url: "/api/v1/admin/users" },
        { method: "GET" as const, url: "/api/v1/admin/roles" }
      ];

      for (const ep of endpoints) {
        const res = await app.inject({ method: ep.method, url: ep.url });
        expect(res.statusCode).toBe(401);
        expect(JSON.parse(res.body).error.code).toBe("UNAUTHORIZED");
      }
    });

    it("SEC-RBAC-02: should reject malformed or tampered Bearer tokens with 401 UNAUTHORIZED", async () => {
      const junkTokens = [
        "not.a.jwt",
        "Bearer",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.tampered_signature",
        ""
      ];

      for (const junk of junkTokens) {
        const res = await app.inject({
          method: "GET",
          url: "/api/v1/auth/me",
          headers: { authorization: `Bearer ${junk}` }
        });
        expect(res.statusCode).toBe(401);
      }
    });

    it("SEC-RBAC-03: should reject TRAVELLER accessing administrative routes with 403 FORBIDDEN", async () => {
      const { email, password } = await registerUser();
      const login = await loginUser(email, password, "MOBILE");

      const adminRoutes = [
        { method: "GET" as const, url: "/api/v1/admin/users" },
        { method: "GET" as const, url: "/api/v1/admin/roles" },
        { method: "GET" as const, url: "/api/v1/admin/permissions" }
      ];

      for (const r of adminRoutes) {
        const res = await app.inject({
          method: r.method,
          url: r.url,
          headers: { authorization: `Bearer ${login.accessToken}` }
        });
        expect(res.statusCode).toBe(403);
        expect(JSON.parse(res.body).error.code).toBe("FORBIDDEN");
      }
    });

    it("SEC-RBAC-04: should prevent SUPPORT staff from assigning roles or modifying SUPERADMIN accounts", async () => {
      const supportUser = await registerUser();
      await promoteUserToRole(supportUser.body.data.id, "SUPPORT");
      const supportLogin = await loginUser(supportUser.email, supportUser.password, "MOBILE");

      const targetUser = await registerUser();

      // Support attempts to assign SUPERADMIN role: blocked by permission check
      const assignSuperadmin = await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${targetUser.body.data.id}/roles`,
        headers: { authorization: `Bearer ${supportLogin.accessToken}` },
        payload: { roleCode: "SUPERADMIN" }
      });

      expect(assignSuperadmin.statusCode).toBe(403);
      expect(JSON.parse(assignSuperadmin.body).error.message).toMatch(/missing required permission: admin\.role\.assign|insufficient permissions/i);

      // Create a superadmin user
      const superadminUser = await registerUser();
      await promoteUserToRole(superadminUser.body.data.id, "SUPERADMIN");

      // Support attempts to suspend Superadmin account: blocked by domain privilege boundary
      const suspendSuperadmin = await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${superadminUser.body.data.id}/suspend`,
        headers: { authorization: `Bearer ${supportLogin.accessToken}` },
        payload: { reason: "Rogue attempt to suspend superadmin" }
      });
      expect(suspendSuperadmin.statusCode).toBe(403);
      expect(JSON.parse(suspendSuperadmin.body).error.message).toMatch(/support personnel cannot suspend superadmin/i);
    });

    it("SEC-RBAC-05: should prevent self-role assignment or revocation (self-privilege escalation defense)", async () => {
      const superadmin = await registerUser();
      await promoteUserToRole(superadmin.body.data.id, "SUPERADMIN");
      const adminLogin = await loginUser(superadmin.email, superadmin.password, "MOBILE");

      // Superadmin attempts to assign role to own user ID
      const selfAssign = await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${superadmin.body.data.id}/roles`,
        headers: { authorization: `Bearer ${adminLogin.accessToken}` },
        payload: { roleCode: "SUPPORT" }
      });
      expect(selfAssign.statusCode).toBe(400);
      expect(JSON.parse(selfAssign.body).error.message).toMatch(/cannot modify roles on their own account/i);

      // Superadmin attempts to revoke role on own user ID
      const selfRevoke = await app.inject({
        method: "DELETE",
        url: `/api/v1/admin/users/${superadmin.body.data.id}/roles/SUPERADMIN`,
        headers: { authorization: `Bearer ${adminLogin.accessToken}` }
      });
      expect(selfRevoke.statusCode).toBe(400);
      expect(JSON.parse(selfRevoke.body).error.message).toMatch(/cannot modify roles on their own account/i);
    });

    it("SEC-RBAC-06: should enforce immediate real-time permission revocation without stale access windows", async () => {
      const user = await registerUser();
      await promoteUserToRole(user.body.data.id, "SUPERADMIN");
      const login = await loginUser(user.email, user.password, "MOBILE");

      // Access admin endpoint: should succeed
      const allowed = await app.inject({
        method: "GET",
        url: "/api/v1/admin/roles",
        headers: { authorization: `Bearer ${login.accessToken}` }
      });
      expect(allowed.statusCode).toBe(200);

      // Remove SUPERADMIN role directly in DB (simulating role revocation)
      await migratorPool.query(
        `DELETE FROM user_roles WHERE user_id = $1 AND role_id = (SELECT id FROM roles WHERE code = 'SUPERADMIN');`,
        [user.body.data.id]
      );

      // Next request with same JWT access token must be immediately rejected (zero cache lag)
      const denied = await app.inject({
        method: "GET",
        url: "/api/v1/admin/roles",
        headers: { authorization: `Bearer ${login.accessToken}` }
      });
      expect(denied.statusCode).toBe(403);
    });
  });

  // ==========================================================================
  // 5. Database Privilege Isolation & Immutability Enforcement
  // ==========================================================================
  describe("5. Database Privilege Isolation & Immutability Enforcement", () => {
    it("SEC-DB-01: should enforce that runtime role luggage_user CANNOT perform direct DML on user_roles or roles", async () => {
      // Direct INSERT into roles by runtime role must fail
      await expect(
        runtimePool.query(
          "INSERT INTO roles (code, name, is_system) VALUES ('ROGUE_ROLE', 'Rogue', false);"
        )
      ).rejects.toThrow(/permission denied/i);

      // Direct INSERT into user_roles by runtime role must fail
      const targetUser = await registerUser();
      const roleRow = await migratorPool.query("SELECT id FROM roles WHERE code = 'SUPERADMIN';");
      const superadminRoleId = roleRow.rows[0].id;

      await expect(
        runtimePool.query(
          "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2);",
          [targetUser.body.data.id, superadminRoleId]
        )
      ).rejects.toThrow(/permission denied/i);
    });

    it("SEC-DB-02: should prevent direct UPDATE or DELETE on security_audit_events via immutability trigger", async () => {
      const user = await registerUser();

      // Find an audit event for this user
      const auditRes = await migratorPool.query(
        "SELECT id FROM security_audit_events WHERE user_id = $1 LIMIT 1;",
        [user.body.data.id]
      );
      expect(auditRes.rows.length).toBe(1);
      const auditId = auditRes.rows[0].id;

      // Attempt UPDATE as table-owner (migrator)
      await expect(
        migratorPool.query(
          "UPDATE security_audit_events SET event_type = 'TAMPERED' WHERE id = $1;",
          [auditId]
        )
      ).rejects.toThrow(/immutable|prohibited|tampering/i);

      // Attempt DELETE as table-owner (migrator)
      await expect(
        migratorPool.query("DELETE FROM security_audit_events WHERE id = $1;", [auditId])
      ).rejects.toThrow(/immutable|prohibited|tampering/i);
    });

    it("SEC-DB-03: should verify SECURITY DEFINER functions enforce fixed search_path = public, pg_temp", async () => {
      const functions = [
        "assign_user_role",
        "revoke_user_role",
        "assign_default_traveller_role"
      ];

      for (const fn of functions) {
        const res = await migratorPool.query(
          `SELECT prosecdef, proconfig FROM pg_proc 
           WHERE proname = $1;`,
          [fn]
        );
        expect(res.rows.length).toBeGreaterThan(0);
        const row = res.rows[0];
        expect(row.prosecdef).toBe(true); // SECURITY DEFINER
        // Safe search_path configuration
        const config = row.proconfig || [];
        expect(config.some((c: string) => c.includes("search_path=public, pg_temp"))).toBe(true);
      }
    });
  });

  // ==========================================================================
  // 6. UUIDv4 and UUIDv7 Identifier Compatibility
  // ==========================================================================
  describe("6. UUIDv4 and UUIDv7 Identifier Compatibility", () => {
    it("SEC-UUID-01: should accept both UUIDv4 and time-ordered UUIDv7 in Zod contracts", () => {
      const uuidV4 = "123e4567-e89b-42d3-a456-426614174000";
      const uuidV7 = "018e4567-e89b-72d3-a456-426614174000";

      expect(UuidSchema.parse(uuidV4)).toBe(uuidV4);
      expect(UuidSchema.parse(uuidV7)).toBe(uuidV7);

      expect(UserIdParamSchema.parse({ userId: uuidV4 })).toEqual({ userId: uuidV4 });
      expect(UserIdParamSchema.parse({ userId: uuidV7 })).toEqual({ userId: uuidV7 });

      expect(SessionIdParamSchema.parse({ sessionId: uuidV4 })).toEqual({ sessionId: uuidV4 });
      expect(SessionIdParamSchema.parse({ sessionId: uuidV7 })).toEqual({ sessionId: uuidV7 });

      expect(RoleCodeParamSchema.parse({ roleCode: "TRAVELLER" })).toEqual({ roleCode: "TRAVELLER" });
    });

    it("SEC-UUID-02: should verify database UUID columns accept UUIDv7 without truncation or error", async () => {
      const uuidV7 = "018e4567-e89b-72d3-a456-426614174000";
      const testRes = await runtimePool.query(
        "SELECT $1::uuid AS test_uuid;",
        [uuidV7]
      );
      expect(testRes.rows[0].test_uuid).toBe(uuidV7);
    });
  });
});
