import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import pg from "pg";
import { buildApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import {
  auditService,
  sanitizeAuditMetadata,
  SecurityEventType
} from "../src/modules/audit/audit.service.js";
import { db } from "../src/infrastructure/database/drizzle.js";

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

describe("WP-12: Auditability & Operational Security Test Suite", () => {
  let app: FastifyInstance;
  let runtimePool: pg.Pool;
  let migratorPool: pg.Pool;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    runtimePool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 5
    });

    migratorPool = new Pool({
      connectionString: env.MIGRATION_DATABASE_URL,
      max: 5
    });
  });

  afterAll(async () => {
    await app.close();
    await runtimePool.end();
    await migratorPool.end();
  });

  async function createTestUser(role = "TRAVELLER") {
    const unique = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const email = `audit_user_${unique}@example.com`;
    const password = "SecurePassword123!";

    const regRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email,
        password,
        displayName: `Audit User ${unique}`
      }
    });

    const regData = JSON.parse(regRes.payload);
    const userId = regData.data.id;

    if (role !== "TRAVELLER") {
      await migratorPool.query(
        `INSERT INTO user_roles (user_id, role_id)
         SELECT $1::uuid, id FROM roles WHERE code = $2
         ON CONFLICT DO NOTHING;`,
        [userId, role]
      );
    }

    // Activate account for testing authenticated and RBAC workflows
    await migratorPool.query(
      `UPDATE users SET status = 'ACTIVE', is_email_verified = true, updated_at = NOW() WHERE id = $1;`,
      [userId]
    );

    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password }
    });

    const loginData = JSON.parse(loginRes.payload);
    const accessToken = loginData.data.accessToken;
    const refreshToken = extractCookie(loginRes, "refresh_token");
    const sessionId = loginData.data.sessionId;

    return {
      userId,
      email,
      password,
      accessToken,
      refreshToken,
      sessionId
    };
  }

  // ==========================================================================
  // 1. Audit Service & Metadata Sanitization
  // ==========================================================================
  describe("Audit Service & Metadata Sanitization", () => {
    it("should sanitize passwords, hashes, JWTs, and secrets from audit metadata", () => {
      const rawMetadata = {
        password: "MySuperSecretPassword123!",
        currentPassword: "OldPassword123!",
        newPassword: "NewPassword123!",
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$somehashvalue",
        secretKey: "super-confidential-api-key",
        bearerToken: "Bearer some_raw_token",
        jwtValue: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.do_not_log",
        rawHexSecret: "super-confidential-api-key",
        hexPayload: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        // Legitimate reference fields that must NOT be redacted:
        sessionId: "123e4567-e89b-12d3-a456-426614174000",
        resetTokenId: "223e4567-e89b-12d3-a456-426614174000",
        roleCode: "SUPERADMIN",
        email: "safe_user@example.com",
        correlationId: "req-abc-123",
        reason: "INVALID_CREDENTIALS"
      };

      const sanitized = sanitizeAuditMetadata(rawMetadata);

      // Sensitive fields must be redacted
      expect(sanitized.password).toBe("[REDACTED]");
      expect(sanitized.currentPassword).toBe("[REDACTED]");
      expect(sanitized.newPassword).toBe("[REDACTED]");
      expect(sanitized.passwordHash).toBe("[REDACTED]");
      expect(sanitized.secretKey).toBe("[REDACTED]");
      expect(sanitized.bearerToken).toBe("[REDACTED]");
      expect(sanitized.jwtValue).toBe("[REDACTED_JWT]");
      expect(sanitized.rawHexSecret).toBe("[REDACTED]");
      expect(sanitized.hexPayload).toBe("[REDACTED_SECRET]");

      // Legitimate reference fields must be preserved
      expect(sanitized.sessionId).toBe("123e4567-e89b-12d3-a456-426614174000");
      expect(sanitized.resetTokenId).toBe("223e4567-e89b-12d3-a456-426614174000");
      expect(sanitized.roleCode).toBe("SUPERADMIN");
      expect(sanitized.email).toBe("safe_user@example.com");
      expect(sanitized.correlationId).toBe("req-abc-123");
      expect(sanitized.reason).toBe("INVALID_CREDENTIALS");
    });

    it("should recursively sanitize nested objects in metadata", () => {
      const nested = {
        outer: "safe",
        securityContext: {
          clientPassword: "password123",
          nestedSession: {
            sessionId: "safe-session-id",
            nestedToken: "secret_token_val"
          }
        }
      };

      const sanitized = sanitizeAuditMetadata(nested);
      expect(sanitized.outer).toBe("safe");
      const ctx = sanitized.securityContext as Record<string, unknown>;
      expect(ctx.clientPassword).toBe("[REDACTED]");
      const nestedSession = ctx.nestedSession as Record<string, unknown>;
      expect(nestedSession.sessionId).toBe("safe-session-id");
      expect(nestedSession.nestedToken).toBe("[REDACTED]");
    });

    it("should record structured event into database and retrieve it", async () => {
      const unique = `corr_${Date.now()}`;
      const inserted = await auditService.recordEvent({
        eventType: SecurityEventType.AUTH_LOGIN_SUCCESS,
        userId: null,
        clientInfo: {
          ip: "127.0.0.1",
          userAgent: "Vitest-Test-Agent",
          correlationId: unique
        },
        metadata: {
          email: "audit_test@example.com",
          action: "TEST_EVENT"
        }
      });

      expect(inserted).not.toBeNull();
      expect(inserted!.id).toBeDefined();
      expect(inserted!.eventType).toBe("AUTH_LOGIN_SUCCESS");
      expect(inserted!.ipAddress).toBe("127.0.0.1");
      expect(inserted!.userAgent).toBe("Vitest-Test-Agent");
      expect(inserted!.metadata).toMatchObject({
        email: "audit_test@example.com",
        correlationId: unique,
        action: "TEST_EVENT"
      });

      // Retrieve via auditService.getEventById
      const retrieved = await auditService.getEventById(inserted!.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(inserted!.id);
    });

    it("should support transactional execution and rollback", async () => {
      const unique = `tx_test_${Date.now()}`;

      // Expect rollback when transaction throws
      await expect(
        db.transaction(async (tx) => {
          await auditService.recordEvent({
            eventType: SecurityEventType.AUTH_SESSION_CREATED,
            metadata: { testKey: unique },
            tx
          });
          throw new Error("Simulated rollback error");
        })
      ).rejects.toThrow("Simulated rollback error");

      // Verify event was NOT persisted
      const result = await runtimePool.query(
        `SELECT id FROM security_audit_events WHERE metadata->>'testKey' = $1;`,
        [unique]
      );
      expect(result.rows.length).toBe(0);
    });
  });

  // ==========================================================================
  // 2. Authentication & Session Security Audit Emission
  // ==========================================================================
  describe("Authentication & Session Audit Events", () => {
    it("should record AUTH_REGISTER_SUCCESS on successful registration", async () => {
      const user = await createTestUser();

      const result = await runtimePool.query(
        `SELECT event_type, metadata FROM security_audit_events 
         WHERE user_id = $1 AND event_type = 'AUTH_REGISTER_SUCCESS';`,
        [user.userId]
      );
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].metadata.email).toBe(user.email.toLowerCase());
      expect(result.rows[0].metadata.role).toBe("TRAVELLER");
    });

    it("should record AUTH_REGISTER_FAILURE on duplicate registration conflict", async () => {
      const user = await createTestUser();

      const dupRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          email: user.email,
          password: "AnotherPassword123!",
          displayName: "Duplicate Attempt"
        }
      });
      expect(dupRes.statusCode).toBe(409);

      const result = await runtimePool.query(
        `SELECT event_type, metadata FROM security_audit_events 
         WHERE event_type = 'AUTH_REGISTER_FAILURE' AND metadata->>'email' = $1;`,
        [user.email.toLowerCase()]
      );
      expect(result.rows.length).toBeGreaterThanOrEqual(1);
      expect(result.rows[0].metadata.reason).toBe("DUPLICATE_EMAIL");
    });

    it("should record AUTH_LOGIN_SUCCESS and AUTH_SESSION_CREATED on login", async () => {
      const user = await createTestUser();

      const loginEvents = await runtimePool.query(
        `SELECT event_type, metadata FROM security_audit_events 
         WHERE user_id = $1 AND event_type = 'AUTH_LOGIN_SUCCESS';`,
        [user.userId]
      );
      expect(loginEvents.rows.length).toBeGreaterThanOrEqual(1);

      const sessionEvents = await runtimePool.query(
        `SELECT event_type, metadata FROM security_audit_events 
         WHERE user_id = $1 AND event_type = 'AUTH_SESSION_CREATED';`,
        [user.userId]
      );
      expect(sessionEvents.rows.length).toBeGreaterThanOrEqual(1);
      expect(sessionEvents.rows[0].metadata.sessionId).toBeDefined();
    });

    it("should record AUTH_LOGIN_FAILURE on invalid credentials and user not found", async () => {
      const user = await createTestUser();

      // Wrong password
      const badPassRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: user.email,
          password: "WrongPassword999!"
        }
      });
      expect(badPassRes.statusCode).toBe(401);

      const passFailEvents = await runtimePool.query(
        `SELECT event_type, metadata FROM security_audit_events 
         WHERE user_id = $1 AND event_type = 'AUTH_LOGIN_FAILURE' AND metadata->>'reason' = 'INVALID_PASSWORD';`,
        [user.userId]
      );
      expect(passFailEvents.rows.length).toBeGreaterThanOrEqual(1);

      // Non-existent user
      const unknownEmail = `nonexistent_${Date.now()}@example.com`;
      const notFoundRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: unknownEmail,
          password: "AnyPassword123!"
        }
      });
      expect(notFoundRes.statusCode).toBe(401);

      const notFoundEvents = await runtimePool.query(
        `SELECT event_type, metadata FROM security_audit_events 
         WHERE event_type = 'AUTH_LOGIN_FAILURE' AND metadata->>'email' = $1;`,
        [unknownEmail]
      );
      expect(notFoundEvents.rows.length).toBeGreaterThanOrEqual(1);
      expect(notFoundEvents.rows[0].metadata.reason).toBe("USER_NOT_FOUND");
    });

    it("should record AUTH_TOKEN_ROTATED on refresh and AUTH_LOGOUT on logout", async () => {
      const user = await createTestUser();

      // Refresh token
      const refreshRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        headers: {
          cookie: `refresh_token=${user.refreshToken}`
        }
      });
      expect(refreshRes.statusCode).toBe(200);

      const rotatedEvents = await runtimePool.query(
        `SELECT event_type FROM security_audit_events 
         WHERE user_id = $1 AND event_type = 'AUTH_TOKEN_ROTATED';`,
        [user.userId]
      );
      expect(rotatedEvents.rows.length).toBeGreaterThanOrEqual(1);

      // Logout
      const newRefreshToken = extractCookie(refreshRes, "refresh_token");
      const logoutRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
        headers: {
          cookie: `refresh_token=${newRefreshToken}`
        }
      });
      expect(logoutRes.statusCode).toBe(200);

      const logoutEvents = await runtimePool.query(
        `SELECT event_type FROM security_audit_events 
         WHERE user_id = $1 AND event_type = 'AUTH_LOGOUT';`,
        [user.userId]
      );
      expect(logoutEvents.rows.length).toBeGreaterThanOrEqual(1);
    });

    it("should record AUTH_TOKEN_REUSE_DETECTED on replay attack", async () => {
      const user = await createTestUser();

      // Rotate token once
      const firstRefresh = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        headers: { cookie: `refresh_token=${user.refreshToken}` }
      });
      expect(firstRefresh.statusCode).toBe(200);

      // Replay the old token
      const replayRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        headers: { cookie: `refresh_token=${user.refreshToken}` }
      });
      expect(replayRes.statusCode).toBe(401);

      const reuseEvents = await runtimePool.query(
        `SELECT event_type, metadata FROM security_audit_events 
         WHERE user_id = $1 AND event_type = 'AUTH_TOKEN_REUSE_DETECTED';`,
        [user.userId]
      );
      expect(reuseEvents.rows.length).toBeGreaterThanOrEqual(1);
      expect(reuseEvents.rows[0].metadata.reason).toBe("REFRESH_TOKEN_REUSE");
    });
  });

  // ==========================================================================
  // 3. RBAC & Access Denial Audit Emission
  // ==========================================================================
  describe("RBAC & Access Denial Audit Events", () => {
    it("should record AUTH_ACCESS_DENIED when an unprivileged user accesses admin endpoints", async () => {
      const traveller = await createTestUser("TRAVELLER");

      // Traveller attempts to access admin endpoint
      const deniedRes = await app.inject({
        method: "GET",
        url: "/api/v1/admin/users",
        headers: {
          authorization: `Bearer ${traveller.accessToken}`
        }
      });
      expect(deniedRes.statusCode).toBe(403);

      const accessDeniedEvents = await runtimePool.query(
        `SELECT event_type, metadata FROM security_audit_events 
         WHERE user_id = $1 AND event_type = 'AUTH_ACCESS_DENIED';`,
        [traveller.userId]
      );
      expect(accessDeniedEvents.rows.length).toBeGreaterThanOrEqual(1);
      expect(accessDeniedEvents.rows[0].metadata.reason).toBe("MISSING_PERMISSION");
      expect(accessDeniedEvents.rows[0].metadata.requiredPermission).toBe("admin.user.read");
      expect(accessDeniedEvents.rows[0].metadata.path).toBe("/api/v1/admin/users");
    });

    it("should record AUTH_ROLE_ASSIGNED and AUTH_ROLE_REVOKED on role lifecycle", async () => {
      const superadmin = await createTestUser("SUPERADMIN");
      const targetUser = await createTestUser("TRAVELLER");

      // Superadmin assigns HOST_OWNER role
      const assignRes = await app.inject({
        method: "POST",
        url: `/api/v1/admin/users/${targetUser.userId}/roles`,
        headers: {
          authorization: `Bearer ${superadmin.accessToken}`
        },
        payload: { roleCode: "HOST_OWNER" }
      });
      expect(assignRes.statusCode).toBe(200);

      const assignEvents = await runtimePool.query(
        `SELECT event_type, metadata FROM security_audit_events 
         WHERE user_id = $1 AND event_type = 'AUTH_ROLE_ASSIGNED';`,
        [targetUser.userId]
      );
      expect(assignEvents.rows.length).toBe(1);
      expect(assignEvents.rows[0].metadata.roleCode).toBe("HOST_OWNER");
      expect(assignEvents.rows[0].metadata.adminId).toBe(superadmin.userId);

      // Superadmin revokes HOST_OWNER role
      const revokeRes = await app.inject({
        method: "DELETE",
        url: `/api/v1/admin/users/${targetUser.userId}/roles/HOST_OWNER`,
        headers: {
          authorization: `Bearer ${superadmin.accessToken}`
        }
      });
      expect(revokeRes.statusCode).toBe(200);

      const revokeEvents = await runtimePool.query(
        `SELECT event_type, metadata FROM security_audit_events 
         WHERE user_id = $1 AND event_type = 'AUTH_ROLE_REVOKED';`,
        [targetUser.userId]
      );
      expect(revokeEvents.rows.length).toBe(1);
      expect(revokeEvents.rows[0].metadata.roleCode).toBe("HOST_OWNER");
      expect(revokeEvents.rows[0].metadata.adminId).toBe(superadmin.userId);
    });
  });

  // ==========================================================================
  // 4. Immutability & Least Privilege Verification
  // ==========================================================================
  describe("Database Immutability & Least Privilege", () => {
    it("should unconditionally reject UPDATE and DELETE on security_audit_events via trigger", async () => {
      // Insert a dedicated test event
      const inserted = await auditService.recordEvent({
        eventType: SecurityEventType.AUTH_LOGIN_SUCCESS,
        metadata: { immutableCheck: true }
      });
      expect(inserted).not.toBeNull();
      const eventId = inserted!.id;

      // Attempt UPDATE via table owner (migratorPool)
      await expect(
        migratorPool.query(
          `UPDATE security_audit_events SET event_type = 'TAMPERED' WHERE id = $1;`,
          [eventId]
        )
      ).rejects.toThrow(/security_audit_events records are immutable: UPDATE is prohibited/i);

      // Attempt DELETE via table owner (migratorPool)
      await expect(
        migratorPool.query(
          `DELETE FROM security_audit_events WHERE id = $1;`,
          [eventId]
        )
      ).rejects.toThrow(/security_audit_events records are immutable: DELETE is prohibited/i);

      // Verify row is unchanged
      const checkRes = await runtimePool.query(
        `SELECT event_type FROM security_audit_events WHERE id = $1;`,
        [eventId]
      );
      expect(checkRes.rows[0].event_type).toBe("AUTH_LOGIN_SUCCESS");
    });

    it("should deny UPDATE and DELETE privileges on security_audit_events for luggage_user", async () => {
      // Check PostgreSQL grant catalog
      const privRes = await runtimePool.query(`
        SELECT has_table_privilege('luggage_user', 'security_audit_events', 'UPDATE') as can_update,
               has_table_privilege('luggage_user', 'security_audit_events', 'DELETE') as can_delete,
               has_table_privilege('luggage_user', 'security_audit_events', 'INSERT') as can_insert,
               has_table_privilege('luggage_user', 'security_audit_events', 'SELECT') as can_select;
      `);

      expect(privRes.rows[0].can_update).toBe(false);
      expect(privRes.rows[0].can_delete).toBe(false);
      expect(privRes.rows[0].can_insert).toBe(true);
      expect(privRes.rows[0].can_select).toBe(true);
    });

    it("should verify ZERO passwords, hashes, or bearer tokens exist in the audit log table", async () => {
      // Query all recent audit event metadata
      const res = await runtimePool.query(`
        SELECT metadata::text FROM security_audit_events
        ORDER BY created_at DESC
        LIMIT 100;
      `);

      for (const row of res.rows) {
        const metadataStr = row.metadata;
        // Verify no raw passwords or hashes in serialized JSONB
        expect(metadataStr).not.toMatch(/"password"\s*:\s*"(?!\[REDACTED\])[^"]+"/i);
        expect(metadataStr).not.toMatch(/"passwordHash"\s*:\s*"(?!\[REDACTED\])[^"]+"/i);
        expect(metadataStr).not.toMatch(/\$argon2id\$/i);
        // Verify no JWT tokens
        expect(metadataStr).not.toMatch(/eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\./);
      }
    });
  });
});
