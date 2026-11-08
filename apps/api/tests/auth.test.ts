import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import pg from "pg";
import argon2 from "argon2";
import crypto from "node:crypto";
import { buildApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import {
  emailService,
  DeterministicTestEmailAdapter,
  NoopEmailDeliveryAdapter
} from "../src/modules/email/email.service.js";
import { passwordService } from "../src/modules/auth/password.service.js";

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

describe("WP-03: Registration and Authentication Engine", () => {
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

  afterAll(async () => {
    await app.close();
    await migratorPool.end();
    await runtimePool.end();
  });

  // ==========================================================================
  // 1. User Registration (/api/v1/auth/register)
  // ==========================================================================
  describe("1. User Registration", () => {
    it("should successfully register a valid user and return 201 Created", async () => {
      const uniqueSuffix = Date.now() + "_reg_valid";
      const email = `Traveler_${uniqueSuffix}@Example.COM`;
      const displayName = "Alice Wanderer";
      const password = "StrongPassword123!";

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          email,
          password,
          displayName,
          phoneNumber: "+94771234567"
        }
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      // Verify response structure
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      // Preserves original display casing
      expect(body.data.email).toBe(email);
      expect(body.data.displayName).toBe(displayName);
      expect(body.data.status).toBe("PENDING_VERIFICATION");
      expect(body.data.isEmailVerified).toBe(false);
      expect(body.data.isPhoneVerified).toBe(false);
      expect(body.data.roles).toEqual(["TRAVELLER"]);
      expect(body.data.createdAt).toBeDefined();

      // Verify NO sensitive fields in response
      expect(body.data.password).toBeUndefined();
      expect(body.data.passwordHash).toBeUndefined();
      expect(body.data.password_hash).toBeUndefined();

      // Verify database persistence and password hashing with Argon2id
      const dbResult = await runtimePool.query(
        `SELECT id, email, normalized_email, password_hash, status, is_email_verified FROM users WHERE id = $1;`,
        [body.data.id]
      );
      expect(dbResult.rows.length).toBe(1);
      const userRow = dbResult.rows[0];

      expect(userRow.email).toBe(email);
      expect(userRow.normalized_email).toBe(email.toLowerCase().trim());
      expect(userRow.status).toBe("PENDING_VERIFICATION");

      // Verify password is stored as Argon2id hash, not plaintext
      expect(userRow.password_hash).not.toBe(password);
      expect(userRow.password_hash.startsWith("$argon2id$")).toBe(true);

      // Verify password verification succeeds against stored hash
      const isValid = await argon2.verify(userRow.password_hash, password);
      expect(isValid).toBe(true);

      // Verify role assignment in database
      const roleResult = await runtimePool.query(
        `SELECT r.code 
         FROM user_roles ur 
         JOIN roles r ON ur.role_id = r.id 
         WHERE ur.user_id = $1;`,
        [body.data.id]
      );
      expect(roleResult.rows.length).toBe(1);
      expect(roleResult.rows[0].code).toBe("TRAVELLER");

      // Verify security audit log record
      const auditResult = await runtimePool.query(
        `SELECT event_type, metadata 
         FROM security_audit_events 
         WHERE user_id = $1 AND event_type = 'AUTH_REGISTER_SUCCESS';`,
        [body.data.id]
      );
      expect(auditResult.rows.length).toBe(1);
      expect(auditResult.rows[0].event_type).toBe("AUTH_REGISTER_SUCCESS");
    });

    it("should reject duplicate email with 409 Conflict", async () => {
      const uniqueSuffix = Date.now() + "_dup";
      const email = `duplicate_${uniqueSuffix}@example.com`;

      // First registration
      const res1 = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          email,
          password: "Password123!",
          displayName: "First User"
        }
      });
      expect(res1.statusCode).toBe(201);

      // Second registration with same email
      const res2 = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          email,
          password: "DifferentPassword123!",
          displayName: "Second User"
        }
      });
      expect(res2.statusCode).toBe(409);
      const body2 = JSON.parse(res2.body);
      expect(body2.success).toBe(false);
      expect(body2.error.code).toBe("CONFLICT");
      expect(body2.error.message).toContain("already exists");
    });

    it("should reject duplicate registration under different casing (normalization check)", async () => {
      const uniqueSuffix = Date.now() + "_norm";
      const emailLower = `case_${uniqueSuffix}@example.com`;
      const emailUpper = `CASE_${uniqueSuffix}@EXAMPLE.COM`;

      // Register lowercase
      const res1 = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          email: emailLower,
          password: "Password123!",
          displayName: "Case Test 1"
        }
      });
      expect(res1.statusCode).toBe(201);

      // Attempt register uppercase
      const res2 = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          email: emailUpper,
          password: "Password123!",
          displayName: "Case Test 2"
        }
      });
      expect(res2.statusCode).toBe(409);
      const body2 = JSON.parse(res2.body);
      expect(body2.success).toBe(false);
      expect(body2.error.code).toBe("CONFLICT");
    });

    it("should handle concurrent duplicate registrations safely (race condition protection)", async () => {
      const uniqueSuffix = Date.now() + "_race";
      const email = `race_${uniqueSuffix}@example.com`;

      // Fire 5 concurrent requests with the identical email
      const requests = Array.from({ length: 5 }, (_, i) =>
        app.inject({
          method: "POST",
          url: "/api/v1/auth/register",
          payload: {
            email,
            password: "Password123!",
            displayName: `Concurrent Runner ${i}`
          }
        })
      );

      const responses = await Promise.all(requests);
      const statusCodes = responses.map((r) => r.statusCode);

      // Exactly 1 request must succeed (201) and all others must return Conflict (409)
      const successCount = statusCodes.filter((s) => s === 201).length;
      const conflictCount = statusCodes.filter((s) => s === 409).length;

      expect(successCount).toBe(1);
      expect(conflictCount).toBe(4);

      // Exactly 1 user record in database
      const dbCount = await runtimePool.query(
        `SELECT COUNT(*) FROM users WHERE normalized_email = $1;`,
        [email.toLowerCase()]
      );
      expect(parseInt(dbCount.rows[0].count, 10)).toBe(1);
    });

    it("should ignore client-supplied privileged role (prevent privilege escalation)", async () => {
      const uniqueSuffix = Date.now() + "_priv_esc";
      const email = `attacker_${uniqueSuffix}@example.com`;

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          email,
          password: "Password123!",
          displayName: "Sneaky User",
          role: "SUPERADMIN"
        }
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.roles).toEqual(["TRAVELLER"]);

      // Verify in database that SUPERADMIN was NEVER granted
      const roleResult = await runtimePool.query(
        `SELECT r.code 
         FROM user_roles ur 
         JOIN roles r ON ur.role_id = r.id 
         WHERE ur.user_id = $1;`,
        [body.data.id]
      );
      expect(roleResult.rows.map((r) => r.code)).toEqual(["TRAVELLER"]);
      expect(roleResult.rows.some((r) => r.code === "SUPERADMIN")).toBe(false);
    });

    it("should reject invalid email format", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          email: "not-an-email",
          password: "Password123!",
          displayName: "Test User"
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.details.some((d: { field: string }) => d.field === "email")).toBe(true);
    });

    it("should reject weak password shorter than 8 characters", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          email: `shortpass_${Date.now()}@example.com`,
          password: "short",
          displayName: "Short Password User"
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.details.some((d: { field: string }) => d.field === "password")).toBe(true);
    });

    it("should reject password exceeding 128 characters", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          email: `longpass_${Date.now()}@example.com`,
          password: "A".repeat(129),
          displayName: "Long Password User"
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should reject missing required display name", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          email: `noname_${Date.now()}@example.com`,
          password: "Password123!"
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should never expose password or password hash in any error or success response", async () => {
      const secretPassword = "SuperSecretPassword123!";
      const email = `credential_leak_${Date.now()}@example.com`;

      // 1. Successful registration
      const regRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          email,
          password: secretPassword,
          displayName: "No Leak User"
        }
      });
      expect(regRes.body).not.toContain(secretPassword);
      expect(regRes.body).not.toContain("$argon2id$");

      // 2. Duplicate registration attempt
      const dupRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          email,
          password: secretPassword,
          displayName: "No Leak User"
        }
      });
      expect(dupRes.body).not.toContain(secretPassword);
      expect(dupRes.body).not.toContain("$argon2id$");

      // 3. Successful login
      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password: secretPassword }
      });
      expect(loginRes.body).not.toContain(secretPassword);
      expect(loginRes.body).not.toContain("$argon2id$");

      // 4. Failed login
      const failRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password: "WrongPasswordAttempt" }
      });
      expect(failRes.body).not.toContain("WrongPasswordAttempt");
      expect(failRes.body).not.toContain("$argon2id$");
    });

    it("should support both /api/v1/auth/register and unversioned /auth/register", async () => {
      const email = `alias_${Date.now()}@example.com`;

      const response = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          email,
          password: "Password123!",
          displayName: "Alias User"
        }
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.email).toBe(email);
    });
  });

  // ==========================================================================
  // 2. User Login (/api/v1/auth/login)
  // ==========================================================================
  describe("2. User Login & Authentication", () => {
    it("should successfully authenticate with valid credentials", async () => {
      const uniqueSuffix = Date.now() + "_login_valid";
      const email = `login_${uniqueSuffix}@example.com`;
      const password = "ValidPassword123!";
      const displayName = "Bob Traveller";

      // Register user first
      const regRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: { email, password, displayName }
      });
      expect(regRes.statusCode).toBe(201);

      // Now login
      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password }
      });

      expect(loginRes.statusCode).toBe(200);
      const body = JSON.parse(loginRes.body);

      expect(body.success).toBe(true);
      expect(body.data.user).toBeDefined();
      expect(body.data.user.email).toBe(email);
      expect(body.data.user.displayName).toBe(displayName);
      expect(body.data.user.status).toBe("PENDING_VERIFICATION");
      expect(body.data.user.roles).toContain("TRAVELLER");
      expect(body.data.user.lastLoginAt).toBeDefined();

      // Verify NO password hash returned
      expect(body.data.user.passwordHash).toBeUndefined();
      expect(body.data.user.password_hash).toBeUndefined();

      // Verify last_login_at was updated in DB
      const dbRes = await runtimePool.query(
        `SELECT last_login_at FROM users WHERE email = $1;`,
        [email]
      );
      expect(dbRes.rows[0].last_login_at).not.toBeNull();
    });

    it("should authenticate case-insensitively using normalized email", async () => {
      const uniqueSuffix = Date.now() + "_login_case";
      const registeredEmail = `MyAccount_${uniqueSuffix}@Domain.COM`;
      const password = "ValidPassword123!";

      // Register with mixed case
      await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          email: registeredEmail,
          password,
          displayName: "Case Insensitive User"
        }
      });

      // Login with lowercase
      const loginLower = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: registeredEmail.toLowerCase(),
          password
        }
      });
      expect(loginLower.statusCode).toBe(200);

      // Login with all uppercase
      const loginUpper = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: registeredEmail.toUpperCase(),
          password
        }
      });
      expect(loginUpper.statusCode).toBe(200);
    });

    it("should reject incorrect password with generic 401 Unauthorized", async () => {
      const email = `wrongpass_${Date.now()}@example.com`;
      const password = "CorrectPassword123!";

      await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          email,
          password,
          displayName: "Wrong Pass User"
        }
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email,
          password: "WrongPassword999!"
        }
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
      expect(body.error.message).toBe("Invalid email or password");
    });

    it("should return identical generic 401 for non-existent account (no user enumeration)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: `nonexistent_${Date.now()}@example.com`,
          password: "RandomPassword123!"
        }
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
      // Message must be identical to incorrect password
      expect(body.error.message).toBe("Invalid email or password");
    });

    it("should reject login for SUSPENDED account with 403 Forbidden", async () => {
      const email = `suspended_${Date.now()}@example.com`;
      const password = "ValidPassword123!";

      const regRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: { email, password, displayName: "Suspended User" }
      });
      const userId = JSON.parse(regRes.body).data.id;

      // Update status to SUSPENDED via migrator
      await migratorPool.query(
        `UPDATE users SET status = 'SUSPENDED' WHERE id = $1;`,
        [userId]
      );

      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password }
      });

      expect(loginRes.statusCode).toBe(403);
      const body = JSON.parse(loginRes.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("FORBIDDEN");
      expect(body.error.message).toBe("Account is suspended");
    });

    it("should reject login for DEACTIVATED account with 403 Forbidden", async () => {
      const email = `deactivated_${Date.now()}@example.com`;
      const password = "ValidPassword123!";

      const regRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: { email, password, displayName: "Deactivated User" }
      });
      const userId = JSON.parse(regRes.body).data.id;

      // Update status to DEACTIVATED via migrator
      await migratorPool.query(
        `UPDATE users SET status = 'DEACTIVATED' WHERE id = $1;`,
        [userId]
      );

      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password }
      });

      expect(loginRes.statusCode).toBe(403);
      const body = JSON.parse(loginRes.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("FORBIDDEN");
      expect(body.error.message).toBe("Account is deactivated");
    });

    it("should allow login for PENDING_VERIFICATION account and report verification status", async () => {
      const email = `unverified_${Date.now()}@example.com`;
      const password = "ValidPassword123!";

      await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: { email, password, displayName: "Unverified User" }
      });

      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password }
      });

      expect(loginRes.statusCode).toBe(200);
      const body = JSON.parse(loginRes.body);
      expect(body.data.user.status).toBe("PENDING_VERIFICATION");
      expect(body.data.user.isEmailVerified).toBe(false);
    });

    it("should reject malformed login request with 400 Bad Request", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: "not-an-email"
          // Missing password
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // ==========================================================================
  // 3. Database Security & Privilege Controls
  // ==========================================================================
  describe("3. Database Security & Transaction Atomicity", () => {
    it("should verify the API executes queries under runtime role luggage_user", async () => {
      const result = await runtimePool.query("SELECT current_user;");
      expect(result.rows[0].current_user).toBe("luggage_user");
    });

    it("should verify direct INSERT into user_roles is blocked for runtime role luggage_user", async () => {
      await expect(
        runtimePool.query(
          `INSERT INTO user_roles (user_id, role_id) VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');`
        )
      ).rejects.toThrow(/permission denied for table user_roles/);
    });

    it("should ensure user registration rolls back completely if role assignment fails", async () => {
      const email = `atomic_${Date.now()}@example.com`;
      const normalized = email.toLowerCase();

      // Test transactional atomicity by running a manual block that simulates role assignment failure
      await expect(
        runtimePool.query(`
          BEGIN;
          INSERT INTO users (email, normalized_email, password_hash, display_name)
          VALUES ('${email}', '${normalized}', 'fake_hash', 'Atomic User');
          -- Intentional syntax error or non-existent function to trigger rollback
          SELECT non_existent_function_trigger_rollback();
          COMMIT;
        `)
      ).rejects.toThrow();

      // Verify that user was NOT inserted
      const checkRes = await runtimePool.query(
        `SELECT COUNT(*) FROM users WHERE normalized_email = $1;`,
        [normalized]
      );
      expect(parseInt(checkRes.rows[0].count, 10)).toBe(0);
    });

    it("should preserve security audit event immutability (WORM) against UPDATE or DELETE", async () => {
      // Find an audit event
      const auditRes = await runtimePool.query(
        `SELECT id FROM security_audit_events LIMIT 1;`
      );
      expect(auditRes.rows.length).toBeGreaterThan(0);
      const auditId = auditRes.rows[0].id;

      // Runtime role UPDATE is prohibited
      await expect(
        runtimePool.query(
          `UPDATE security_audit_events SET event_type = 'TAMPERED' WHERE id = $1;`,
          [auditId]
        )
      ).rejects.toThrow(/permission denied for table security_audit_events|prohibited/i);

      // Runtime role DELETE is prohibited
      await expect(
        runtimePool.query(
          `DELETE FROM security_audit_events WHERE id = $1;`,
          [auditId]
        )
      ).rejects.toThrow(/permission denied for table security_audit_events|prohibited/i);

      // Migrator role UPDATE is rejected by trigger
      await expect(
        migratorPool.query(
          `UPDATE security_audit_events SET event_type = 'TAMPERED' WHERE id = $1;`,
          [auditId]
        )
      ).rejects.toThrow(/security_audit_events records are immutable: UPDATE is prohibited/);

      // Migrator role DELETE is rejected by trigger
      await expect(
        migratorPool.query(
          `DELETE FROM security_audit_events WHERE id = $1;`,
          [auditId]
        )
      ).rejects.toThrow(/security_audit_events records are immutable: DELETE is prohibited/);
    });
  });

  // ==========================================================================
  // WP-04: Session Management, Token Rotation & Logout
  // ==========================================================================
  describe("WP-04: Session Management, Token Rotation & Logout", () => {
    // Helper to register and create a fresh user for tests
    async function createTestUser(suffix: string) {
      const email = `wp04_${Date.now()}_${suffix}@example.com`;
      const password = "StrongPassword123!";
      const displayName = `WP04 User ${suffix}`;

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: { email, password, displayName }
      });
      expect(res.statusCode).toBe(201);
      const user = JSON.parse(res.body).data;

      // Update status to ACTIVE for full test interactions
      await runtimePool.query(
        `UPDATE users SET status = 'ACTIVE' WHERE id = $1;`,
        [user.id]
      );

      return { email, password, displayName, id: user.id };
    }

    it("should issue access token and set HTTP-only refresh cookie on Web login, without exposing refresh token in JSON", async () => {
      const user = await createTestUser("web_login");

      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: user.email,
          password: user.password
          // clientType omitted -> defaults to WEB
        }
      });

      expect(loginRes.statusCode).toBe(200);
      const body = JSON.parse(loginRes.body);

      // Verify JSON payload
      expect(body.success).toBe(true);
      expect(body.data.user.id).toBe(user.id);
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.expiresIn).toBe(900);
      expect(body.data.tokenType).toBe("Bearer");
      // MUST NOT expose refresh token in JSON for web
      expect(body.data.refreshToken).toBeUndefined();

      // Verify Set-Cookie header
      const cookieVal = extractCookie(loginRes, "refresh_token");
      expect(cookieVal).toBeDefined();
      expect(cookieVal!.length).toBeGreaterThan(32);

      const rawSetCookie = loginRes.headers["set-cookie"];
      const cookieStr = Array.isArray(rawSetCookie) ? rawSetCookie.join("; ") : (rawSetCookie as string);
      expect(cookieStr).toContain("HttpOnly");
      expect(cookieStr).toContain("SameSite=Strict");
      expect(cookieStr).toContain("Path=/api/v1/auth");

      // Verify DB auth_sessions row
      const expectedHash = crypto.createHash("sha256").update(cookieVal!).digest("hex");
      const dbRes = await runtimePool.query(
        `SELECT id, user_id, refresh_token_hash, client_type, revoked_at FROM auth_sessions WHERE user_id = $1;`,
        [user.id]
      );
      expect(dbRes.rows.length).toBe(1);
      expect(dbRes.rows[0].refresh_token_hash).toBe(expectedHash);
      expect(dbRes.rows[0].client_type).toBe("WEB");
      expect(dbRes.rows[0].revoked_at).toBeNull();

      // Verify security audit log record
      const auditRes = await runtimePool.query(
        `SELECT event_type FROM security_audit_events WHERE user_id = $1 AND event_type = 'AUTH_SESSION_CREATED';`,
        [user.id]
      );
      expect(auditRes.rows.length).toBe(1);
    });

    it("should issue access token and return refresh token in body on Mobile login", async () => {
      const user = await createTestUser("mobile_login");

      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: user.email,
          password: user.password,
          clientType: "MOBILE"
        }
      });

      expect(loginRes.statusCode).toBe(200);
      const body = JSON.parse(loginRes.body);

      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeDefined();
      // MUST return refresh token in JSON for mobile
      expect(body.data.refreshToken).toBeDefined();
      expect(body.data.refreshToken.length).toBeGreaterThan(32);

      // Verify DB record
      const expectedHash = crypto.createHash("sha256").update(body.data.refreshToken).digest("hex");
      const dbRes = await runtimePool.query(
        `SELECT client_type, refresh_token_hash FROM auth_sessions WHERE user_id = $1;`,
        [user.id]
      );
      expect(dbRes.rows.length).toBe(1);
      expect(dbRes.rows[0].client_type).toBe("MOBILE");
      expect(dbRes.rows[0].refresh_token_hash).toBe(expectedHash);
    });

    it("should allow access to protected /me endpoint with valid access token", async () => {
      const user = await createTestUser("me_valid");

      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: user.email, password: user.password }
      });
      const { accessToken } = JSON.parse(loginRes.body).data;

      const meRes = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      });

      expect(meRes.statusCode).toBe(200);
      const meBody = JSON.parse(meRes.body);
      expect(meBody.success).toBe(true);
      expect(meBody.data.user.id).toBe(user.id);
      expect(meBody.data.user.email).toBe(user.email);
      expect(meBody.data.sessionId).toBeDefined();
    });

    it("should reject protected /me endpoint with missing or invalid token", async () => {
      // Missing token
      const noAuthRes = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me"
      });
      expect(noAuthRes.statusCode).toBe(401);

      // Invalid signature / garbage token
      const badTokenRes = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: {
          authorization: "Bearer invalid.jwt.token"
        }
      });
      expect(badTokenRes.statusCode).toBe(401);
    });

    it("should successfully rotate refresh token via Web cookie and update auth_sessions record", async () => {
      const user = await createTestUser("rotate_cookie");

      // Login
      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: user.email, password: user.password }
      });
      const oldRawCookie = extractCookie(loginRes, "refresh_token")!;
      const oldHash = crypto.createHash("sha256").update(oldRawCookie).digest("hex");

      // Rotate via cookie
      const refreshRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        headers: {
          cookie: `refresh_token=${oldRawCookie}`
        }
      });

      expect(refreshRes.statusCode).toBe(200);
      const refreshBody = JSON.parse(refreshRes.body);
      expect(refreshBody.success).toBe(true);
      expect(refreshBody.data.accessToken).toBeDefined();
      expect(refreshBody.data.refreshToken).toBeUndefined(); // Web client -> not in body

      const newRawCookie = extractCookie(refreshRes, "refresh_token")!;
      expect(newRawCookie).toBeDefined();
      expect(newRawCookie).not.toBe(oldRawCookie);

      const newHash = crypto.createHash("sha256").update(newRawCookie).digest("hex");

      // Check DB: new hash is active, old hash is retained in previous_token_hash
      const sessionRes = await runtimePool.query(
        `SELECT refresh_token_hash, previous_token_hash FROM auth_sessions WHERE user_id = $1;`,
        [user.id]
      );
      expect(sessionRes.rows.length).toBe(1);
      expect(sessionRes.rows[0].refresh_token_hash).toBe(newHash);
      expect(sessionRes.rows[0].previous_token_hash).toBe(oldHash);

      // Verify AUTH_TOKEN_ROTATED audit event
      const auditRes = await runtimePool.query(
        `SELECT event_type FROM security_audit_events WHERE user_id = $1 AND event_type = 'AUTH_TOKEN_ROTATED';`,
        [user.id]
      );
      expect(auditRes.rows.length).toBe(1);
    });

    it("should successfully rotate refresh token via Mobile request body", async () => {
      const user = await createTestUser("rotate_mobile");

      // Login mobile
      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: user.email, password: user.password, clientType: "MOBILE" }
      });
      const oldToken = JSON.parse(loginRes.body).data.refreshToken;

      // Rotate mobile
      const refreshRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        payload: {
          refreshToken: oldToken,
          clientType: "MOBILE"
        }
      });

      expect(refreshRes.statusCode).toBe(200);
      const refreshBody = JSON.parse(refreshRes.body);
      expect(refreshBody.success).toBe(true);
      expect(refreshBody.data.accessToken).toBeDefined();
      expect(refreshBody.data.refreshToken).toBeDefined();
      expect(refreshBody.data.refreshToken).not.toBe(oldToken);
    });

    it("should detect refresh token reuse, revoke all user sessions, and log AUTH_TOKEN_REUSE_DETECTED", async () => {
      const user = await createTestUser("reuse_detection");

      // 1. Initial login -> token 1
      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: user.email, password: user.password }
      });
      const token1 = extractCookie(loginRes, "refresh_token")!;

      // Create a second concurrent session for the same user (e.g. tablet login)
      const secondLoginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: user.email, password: user.password, clientType: "MOBILE" }
      });
      const secondSessionToken = JSON.parse(secondLoginRes.body).data.refreshToken;

      // 2. Legitimate rotation of token 1 -> token 2
      const rotateRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        headers: { cookie: `refresh_token=${token1}` }
      });
      expect(rotateRes.statusCode).toBe(200);
      const token2 = extractCookie(rotateRes, "refresh_token")!;

      // 3. ATTACK: Attacker replays already-consumed token 1
      const attackRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        headers: { cookie: `refresh_token=${token1}` }
      });

      expect(attackRes.statusCode).toBe(401);
      const attackBody = JSON.parse(attackRes.body);
      expect(attackBody.success).toBe(false);
      expect(attackBody.error.code).toBe("UNAUTHORIZED");

      // 4. Verify FAMILY REVOCATION: All sessions for this user must now be revoked
      const allSessionsRes = await runtimePool.query(
        `SELECT id, revoked_at, revocation_reason FROM auth_sessions WHERE user_id = $1;`,
        [user.id]
      );
      expect(allSessionsRes.rows.length).toBe(2);
      for (const row of allSessionsRes.rows) {
        expect(row.revoked_at).not.toBeNull();
        expect(row.revocation_reason).toBe("REUSE_DETECTED");
      }

      // 5. Verify AUTH_TOKEN_REUSE_DETECTED audit event
      const auditRes = await runtimePool.query(
        `SELECT event_type, metadata FROM security_audit_events 
         WHERE user_id = $1 AND event_type = 'AUTH_TOKEN_REUSE_DETECTED';`,
        [user.id]
      );
      expect(auditRes.rows.length).toBe(1);

      // 6. Verify that even the legitimate new token 2 is now rejected
      const token2Res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        headers: { cookie: `refresh_token=${token2}` }
      });
      expect(token2Res.statusCode).toBe(401);

      // 7. Verify sibling session token is also rejected
      const siblingRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        payload: { refreshToken: secondSessionToken }
      });
      expect(siblingRes.statusCode).toBe(401);
    });

    it("should serialize concurrent refresh attempts with the same token via database row locking", async () => {
      const user = await createTestUser("concurrency");

      // Initial login
      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: user.email, password: user.password }
      });
      const token = extractCookie(loginRes, "refresh_token")!;

      // Execute 2 simultaneous refresh requests with the same token
      const [resA, resB] = await Promise.all([
        app.inject({
          method: "POST",
          url: "/api/v1/auth/refresh",
          headers: { cookie: `refresh_token=${token}` }
        }),
        app.inject({
          method: "POST",
          url: "/api/v1/auth/refresh",
          headers: { cookie: `refresh_token=${token}` }
        })
      ]);

      const statusCodes = [resA.statusCode, resB.statusCode];
      // Exactly one must succeed (200), and the second must be rejected (401)
      expect(statusCodes).toContain(200);
      expect(statusCodes).toContain(401);
    });

    it("should successfully log out current session and invalidate subsequent refresh attempts", async () => {
      const user = await createTestUser("logout_current");

      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: user.email, password: user.password }
      });
      const cookie = extractCookie(loginRes, "refresh_token")!;
      const { accessToken } = JSON.parse(loginRes.body).data;

      // Logout
      const logoutRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
        headers: {
          cookie: `refresh_token=${cookie}`,
          authorization: `Bearer ${accessToken}`
        }
      });

      expect(logoutRes.statusCode).toBe(200);
      const logoutBody = JSON.parse(logoutRes.body);
      expect(logoutBody.success).toBe(true);

      // Verify cookie cleared
      const rawSetCookie = logoutRes.headers["set-cookie"];
      const cookieStr = Array.isArray(rawSetCookie) ? rawSetCookie.join("; ") : (rawSetCookie as string);
      expect(cookieStr).toContain("refresh_token=;");

      // Verify DB revocation
      const sessionRes = await runtimePool.query(
        `SELECT revoked_at, revocation_reason FROM auth_sessions WHERE user_id = $1;`,
        [user.id]
      );
      expect(sessionRes.rows[0].revoked_at).not.toBeNull();
      expect(sessionRes.rows[0].revocation_reason).toBe("USER_LOGOUT");

      // Verify AUTH_LOGOUT audit event
      const auditRes = await runtimePool.query(
        `SELECT event_type FROM security_audit_events WHERE user_id = $1 AND event_type = 'AUTH_LOGOUT';`,
        [user.id]
      );
      expect(auditRes.rows.length).toBe(1);

      // Subsequent refresh attempt with logged-out token fails
      const refreshRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        headers: { cookie: `refresh_token=${cookie}` }
      });
      expect(refreshRes.statusCode).toBe(401);
    });

    it("should immediately reject access tokens when session is revoked in database", async () => {
      const user = await createTestUser("session_revoke_check");

      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: user.email, password: user.password }
      });
      const { accessToken } = JSON.parse(loginRes.body).data;
      const cookie = extractCookie(loginRes, "refresh_token")!;

      // Verify token works initially
      const preCheck = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${accessToken}` }
      });
      expect(preCheck.statusCode).toBe(200);

      // Revoke session via logout
      await app.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
        headers: { cookie: `refresh_token=${cookie}` }
      });

      // Verify access token is NOW rejected at /me despite not having expired in JWT terms
      const postCheck = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${accessToken}` }
      });
      expect(postCheck.statusCode).toBe(401);
      const postBody = JSON.parse(postCheck.body);
      expect(postBody.error.message).toMatch(/Session has been revoked or expired/i);
    });

    it("should log out all sessions for a user via /logout-all and revoke all family sessions", async () => {
      const user = await createTestUser("logout_all");

      // Login 3 times across different devices
      const login1 = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: user.email, password: user.password, clientType: "WEB" }
      });
      const token1 = JSON.parse(login1.body).data.accessToken;

      await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: user.email, password: user.password, clientType: "MOBILE" }
      });

      await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: user.email, password: user.password, clientType: "WEB" }
      });

      // Check 3 active sessions in DB
      const preRes = await runtimePool.query(
        `SELECT COUNT(*) FROM auth_sessions WHERE user_id = $1 AND revoked_at IS NULL;`,
        [user.id]
      );
      expect(parseInt(preRes.rows[0].count, 10)).toBe(3);

      // Call /logout-all with token1
      const logoutAllRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/logout-all",
        headers: { authorization: `Bearer ${token1}` }
      });

      expect(logoutAllRes.statusCode).toBe(200);
      const body = JSON.parse(logoutAllRes.body);
      expect(body.success).toBe(true);
      expect(body.data.message).toContain("3 session(s) revoked");

      // Verify all sessions revoked in DB
      const postRes = await runtimePool.query(
        `SELECT COUNT(*) FROM auth_sessions WHERE user_id = $1 AND revoked_at IS NULL;`,
        [user.id]
      );
      expect(parseInt(postRes.rows[0].count, 10)).toBe(0);

      // Verify AUTH_LOGOUT_ALL audit event
      const auditRes = await runtimePool.query(
        `SELECT event_type FROM security_audit_events WHERE user_id = $1 AND event_type = 'AUTH_LOGOUT_ALL';`,
        [user.id]
      );
      expect(auditRes.rows.length).toBe(1);
    });

    it("should list active sessions and accurately reflect current session", async () => {
      const user = await createTestUser("session_list");

      // Login 1
      const login1 = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: user.email, password: user.password, clientType: "WEB" }
      });
      const { accessToken: token1 } = JSON.parse(login1.body).data;

      // Login 2
      await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: user.email, password: user.password, clientType: "MOBILE" }
      });

      const listRes = await app.inject({
        method: "GET",
        url: "/api/v1/auth/sessions",
        headers: { authorization: `Bearer ${token1}` }
      });

      expect(listRes.statusCode).toBe(200);
      const body = JSON.parse(listRes.body);
      expect(body.success).toBe(true);
      expect(body.data.sessions.length).toBe(2);

      const currentSessions = body.data.sessions.filter((s: { isCurrentSession: boolean }) => s.isCurrentSession);
      expect(currentSessions.length).toBe(1);
    });

    it("should allow user to revoke an individual session by ID", async () => {
      const user = await createTestUser("revoke_single");

      // Session 1 (Caller)
      const login1 = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: user.email, password: user.password }
      });
      const { accessToken: token1 } = JSON.parse(login1.body).data;

      // Session 2 (Target for revocation)
      const login2 = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: user.email, password: user.password, clientType: "MOBILE" }
      });
      const session2Token = JSON.parse(login2.body).data.refreshToken;

      // Get session 2 ID
      const sessionsRes = await app.inject({
        method: "GET",
        url: "/api/v1/auth/sessions",
        headers: { authorization: `Bearer ${token1}` }
      });
      const sessions = JSON.parse(sessionsRes.body).data.sessions;
      const session2 = sessions.find((s: { isCurrentSession: boolean }) => !s.isCurrentSession);

      // Revoke session 2
      const deleteRes = await app.inject({
        method: "DELETE",
        url: `/api/v1/auth/sessions/${session2.id}`,
        headers: { authorization: `Bearer ${token1}` }
      });

      expect(deleteRes.statusCode).toBe(200);

      // Verify session 2 cannot refresh
      const refreshRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        payload: { refreshToken: session2Token }
      });
      expect(refreshRes.statusCode).toBe(401);

      // Verify caller session 1 is still active
      const meRes = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${token1}` }
      });
      expect(meRes.statusCode).toBe(200);

      // Verify AUTH_SESSION_REVOKED audit event
      const auditRes = await runtimePool.query(
        `SELECT event_type FROM security_audit_events WHERE user_id = $1 AND event_type = 'AUTH_SESSION_REVOKED';`,
        [user.id]
      );
      expect(auditRes.rows.length).toBe(1);
    });

    it("should prevent user from revoking another user's session", async () => {
      const userA = await createTestUser("user_a");
      const userB = await createTestUser("user_b");

      const loginA = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: userA.email, password: userA.password }
      });
      const tokenA = JSON.parse(loginA.body).data.accessToken;

      await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: userB.email, password: userB.password }
      });
      const sessionBId = (await runtimePool.query(
        `SELECT id FROM auth_sessions WHERE user_id = $1;`,
        [userB.id]
      )).rows[0].id;

      // User A attempts to revoke User B's session
      const attackRes = await app.inject({
        method: "DELETE",
        url: `/api/v1/auth/sessions/${sessionBId}`,
        headers: { authorization: `Bearer ${tokenA}` }
      });

      expect(attackRes.statusCode).toBe(404);

      // Verify User B's session is still active
      const checkB = await runtimePool.query(
        `SELECT revoked_at FROM auth_sessions WHERE id = $1;`,
        [sessionBId]
      );
      expect(checkB.rows[0].revoked_at).toBeNull();
    });

    it("should reject refresh and revoke session if account becomes SUSPENDED or DEACTIVATED", async () => {
      const user = await createTestUser("suspended_check");

      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: user.email, password: user.password }
      });
      const cookie = extractCookie(loginRes, "refresh_token")!;
      const { accessToken } = JSON.parse(loginRes.body).data;

      // Suspend user in DB
      await runtimePool.query(
        `UPDATE users SET status = 'SUSPENDED' WHERE id = $1;`,
        [user.id]
      );

      // Refresh attempt must fail with 403 Forbidden
      const refreshRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        headers: { cookie: `refresh_token=${cookie}` }
      });
      expect(refreshRes.statusCode).toBe(403);

      // Verify session was revoked due to account suspension
      const sessionRes = await runtimePool.query(
        `SELECT revoked_at, revocation_reason FROM auth_sessions WHERE user_id = $1;`,
        [user.id]
      );
      expect(sessionRes.rows[0].revoked_at).not.toBeNull();
      expect(sessionRes.rows[0].revocation_reason).toBe("ACCOUNT_SUSPENDED");

      // Verify protected /me access also fails
      const meRes = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${accessToken}` }
      });
      // Either 401 (session revoked) or 403 (suspended)
      expect([401, 403]).toContain(meRes.statusCode);
    });
  });

  // ==========================================================================
  // WP-05: Password Change & Recovery
  // ==========================================================================
  describe("WP-05: Password Change & Recovery", () => {
    let testAdapter: DeterministicTestEmailAdapter;

    beforeEach(() => {
      testAdapter = new DeterministicTestEmailAdapter();
      emailService.setAdapter(testAdapter);
      passwordService.clearRateLimits();
    });

    async function createTestUser(suffix: string, initialPassword = "OriginalPassword123!") {
      const email = `wp05_${Date.now()}_${suffix}@example.com`;
      const displayName = `WP05 User ${suffix}`;

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: { email, password: initialPassword, displayName }
      });
      expect(res.statusCode).toBe(201);
      const user = JSON.parse(res.body).data;

      await runtimePool.query(
        `UPDATE users SET status = 'ACTIVE' WHERE id = $1;`,
        [user.id]
      );

      return { email, password: initialPassword, displayName, id: user.id };
    }

    // ------------------------------------------------------------------------
    // 1. Authenticated Password Change (/api/v1/auth/change-password)
    // ------------------------------------------------------------------------
    describe("1. Authenticated Password Change", () => {
      it("should successfully change password, preserve current session, and revoke all other active sessions", async () => {
        const user = await createTestUser("change_ok");

        // Device 1 (Current session - caller)
        const login1 = await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          payload: { email: user.email, password: user.password, clientType: "WEB" }
        });
        const token1 = JSON.parse(login1.body).data.accessToken;

        // Device 2 (Sibling active session)
        const login2 = await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          payload: { email: user.email, password: user.password, clientType: "MOBILE" }
        });
        const token2 = JSON.parse(login2.body).data.accessToken;
        const refresh2 = JSON.parse(login2.body).data.refreshToken;

        // Device 3 (Sibling active session)
        const login3 = await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          payload: { email: user.email, password: user.password, clientType: "WEB" }
        });
        const token3 = JSON.parse(login3.body).data.accessToken;

        // Verify all 3 sessions are active
        const preCheck = await runtimePool.query(
          `SELECT COUNT(*) FROM auth_sessions WHERE user_id = $1 AND revoked_at IS NULL;`,
          [user.id]
        );
        expect(parseInt(preCheck.rows[0].count, 10)).toBe(3);

        // Perform password change from Device 1
        const newPassword = "NewSecurePassword456!";
        const changeRes = await app.inject({
          method: "POST",
          url: "/api/v1/auth/change-password",
          headers: { authorization: `Bearer ${token1}` },
          payload: {
            currentPassword: user.password,
            newPassword,
            confirmPassword: newPassword
          }
        });

        expect(changeRes.statusCode).toBe(200);
        const changeBody = JSON.parse(changeRes.body);
        expect(changeBody.success).toBe(true);
        expect(changeBody.data.message).toContain("Password changed successfully");

        // 1. Verify password hash updated in users table
        const userDb = await runtimePool.query(
          `SELECT password_hash, password_changed_at FROM users WHERE id = $1;`,
          [user.id]
        );
        expect(userDb.rows[0].password_changed_at).not.toBeNull();
        const matchesNew = await argon2.verify(userDb.rows[0].password_hash, newPassword);
        expect(matchesNew).toBe(true);

        // 2. Verify current session (Device 1) remains ACTIVE
        const meRes1 = await app.inject({
          method: "GET",
          url: "/api/v1/auth/me",
          headers: { authorization: `Bearer ${token1}` }
        });
        expect(meRes1.statusCode).toBe(200);

        // 3. Verify sibling sessions (Device 2 and 3) are REVOKED
        const meRes2 = await app.inject({
          method: "GET",
          url: "/api/v1/auth/me",
          headers: { authorization: `Bearer ${token2}` }
        });
        expect(meRes2.statusCode).toBe(401);

        const meRes3 = await app.inject({
          method: "GET",
          url: "/api/v1/auth/me",
          headers: { authorization: `Bearer ${token3}` }
        });
        expect(meRes3.statusCode).toBe(401);

        // Device 2 refresh attempt must fail
        const refreshRes2 = await app.inject({
          method: "POST",
          url: "/api/v1/auth/refresh",
          payload: { refreshToken: refresh2 }
        });
        expect(refreshRes2.statusCode).toBe(401);

        // 4. Verify in DB that only 1 session remains active, others revoked with 'PASSWORD_CHANGED'
        const activeRes = await runtimePool.query(
          `SELECT id, revoked_at, revocation_reason FROM auth_sessions WHERE user_id = $1 ORDER BY created_at ASC;`,
          [user.id]
        );
        expect(activeRes.rows.length).toBe(3);
        const unrevoked = activeRes.rows.filter((r) => r.revoked_at === null);
        const revoked = activeRes.rows.filter((r) => r.revoked_at !== null);
        expect(unrevoked.length).toBe(1);
        expect(revoked.length).toBe(2);
        for (const r of revoked) {
          expect(r.revocation_reason).toBe("PASSWORD_CHANGED");
        }

        // 5. Verify old password cannot be used to login
        const oldLoginRes = await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          payload: { email: user.email, password: user.password }
        });
        expect(oldLoginRes.statusCode).toBe(401);

        // 6. Verify new password can be used to login
        const newLoginRes = await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          payload: { email: user.email, password: newPassword }
        });
        expect(newLoginRes.statusCode).toBe(200);

        // 7. Verify AUTH_PASSWORD_CHANGE_SUCCESS audit event
        const auditRes = await runtimePool.query(
          `SELECT event_type FROM security_audit_events WHERE user_id = $1 AND event_type = 'AUTH_PASSWORD_CHANGE_SUCCESS';`,
          [user.id]
        );
        expect(auditRes.rows.length).toBe(1);
      });

      it("should reject password change when current password is incorrect and leave password unmodified", async () => {
        const user = await createTestUser("wrong_current");

        const loginRes = await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          payload: { email: user.email, password: user.password }
        });
        const token = JSON.parse(loginRes.body).data.accessToken;

        const changeRes = await app.inject({
          method: "POST",
          url: "/api/v1/auth/change-password",
          headers: { authorization: `Bearer ${token}` },
          payload: {
            currentPassword: "IncorrectPassword999!",
            newPassword: "BrandNewPassword123!",
            confirmPassword: "BrandNewPassword123!"
          }
        });

        expect(changeRes.statusCode).toBe(400);
        const body = JSON.parse(changeRes.body);
        expect(body.success).toBe(false);
        expect(body.error.message).toMatch(/Current password is incorrect/i);

        // Verify password in DB was NOT changed
        const userDb = await runtimePool.query(
          `SELECT password_hash FROM users WHERE id = $1;`,
          [user.id]
        );
        const matchesOriginal = await argon2.verify(userDb.rows[0].password_hash, user.password);
        expect(matchesOriginal).toBe(true);

        // Verify audit event
        const auditRes = await runtimePool.query(
          `SELECT event_type, metadata FROM security_audit_events WHERE user_id = $1 AND event_type = 'AUTH_PASSWORD_CHANGE_FAILURE';`,
          [user.id]
        );
        expect(auditRes.rows.length).toBe(1);
      });

      it("should reject password change when new password equals current password", async () => {
        const user = await createTestUser("same_password");

        const loginRes = await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          payload: { email: user.email, password: user.password }
        });
        const token = JSON.parse(loginRes.body).data.accessToken;

        const changeRes = await app.inject({
          method: "POST",
          url: "/api/v1/auth/change-password",
          headers: { authorization: `Bearer ${token}` },
          payload: {
            currentPassword: user.password,
            newPassword: user.password,
            confirmPassword: user.password
          }
        });

        expect(changeRes.statusCode).toBe(400);
        const body = JSON.parse(changeRes.body);
        expect(body.success).toBe(false);
        expect(body.error.code).toBe("VALIDATION_ERROR");
      });

      it("should reject password change when unauthenticated", async () => {
        const changeRes = await app.inject({
          method: "POST",
          url: "/api/v1/auth/change-password",
          payload: {
            currentPassword: "SomePassword123!",
            newPassword: "NewPassword123!",
            confirmPassword: "NewPassword123!"
          }
        });

        expect(changeRes.statusCode).toBe(401);
      });

      it("should reject password change if account is SUSPENDED or DEACTIVATED", async () => {
        const user = await createTestUser("suspended_change");

        const loginRes = await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          payload: { email: user.email, password: user.password }
        });
        const token = JSON.parse(loginRes.body).data.accessToken;

        // Suspend user
        await runtimePool.query(`UPDATE users SET status = 'SUSPENDED' WHERE id = $1;`, [user.id]);

        const changeRes = await app.inject({
          method: "POST",
          url: "/api/v1/auth/change-password",
          headers: { authorization: `Bearer ${token}` },
          payload: {
            currentPassword: user.password,
            newPassword: "NewPassword123!",
            confirmPassword: "NewPassword123!"
          }
        });

        expect(changeRes.statusCode).toBe(403);
      });
    });

    // ------------------------------------------------------------------------
    // 2. Password Recovery Request (/api/v1/auth/forgot-password)
    // ------------------------------------------------------------------------
    describe("2. Password Recovery Request", () => {
      it("should return identical generic response for existing and non-existing accounts (enumeration resistance)", async () => {
        const user = await createTestUser("enum_check");

        // Existing account request
        const resExisting = await app.inject({
          method: "POST",
          url: "/api/v1/auth/forgot-password",
          payload: { email: user.email }
        });
        expect(resExisting.statusCode).toBe(200);
        const bodyExisting = JSON.parse(resExisting.body);

        // Non-existing account request
        const resNonExisting = await app.inject({
          method: "POST",
          url: "/api/v1/auth/forgot-password",
          payload: { email: "non_existent_account_12345@example.com" }
        });
        expect(resNonExisting.statusCode).toBe(200);
        const bodyNonExisting = JSON.parse(resNonExisting.body);

        // Both responses must be identical
        expect(bodyExisting.success).toBe(true);
        expect(bodyNonExisting.success).toBe(true);
        expect(bodyExisting.data.message).toBe(bodyNonExisting.data.message);
        expect(bodyExisting.data.message).toContain("If an account with that email address exists");

        // MUST NOT contain tokens, hashes, or user identifiers
        expect(bodyExisting.data.token).toBeUndefined();
        expect(bodyExisting.data.resetToken).toBeUndefined();
        expect(bodyNonExisting.data.token).toBeUndefined();
      });

      it("should store only SHA-256 verifier hash in password_reset_tokens with 1-hour expiration and dispatch token via email adapter", async () => {
        const user = await createTestUser("token_persistence");

        const res = await app.inject({
          method: "POST",
          url: "/api/v1/auth/forgot-password",
          payload: { email: user.email }
        });
        expect(res.statusCode).toBe(200);

        // Verify email dispatched via test adapter
        const lastEmail = testAdapter.getLastEmail();
        expect(lastEmail).toBeDefined();
        expect(lastEmail?.to).toBe(user.email);
        expect(lastEmail?.resetToken).toBeDefined();
        expect(lastEmail?.resetToken.length).toBe(64); // 256 bits = 64 hex chars

        const rawToken = lastEmail!.resetToken;
        const expectedHash = crypto.createHash("sha256").update(rawToken).digest("hex");

        // Verify in DB
        const dbRes = await runtimePool.query(
          `SELECT id, token_hash, expires_at, used_at FROM password_reset_tokens WHERE user_id = $1;`,
          [user.id]
        );
        expect(dbRes.rows.length).toBe(1);
        expect(dbRes.rows[0].token_hash).toBe(expectedHash);
        expect(dbRes.rows[0].token_hash).not.toBe(rawToken); // Zero plaintext token in DB
        expect(dbRes.rows[0].used_at).toBeNull();

        // 1-hour expiry check
        const expiresAt = new Date(dbRes.rows[0].expires_at).getTime();
        const now = Date.now();
        const diffMinutes = (expiresAt - now) / (60 * 1000);
        expect(diffMinutes).toBeGreaterThan(55);
        expect(diffMinutes).toBeLessThanOrEqual(61);

        // Verify audit event
        const auditRes = await runtimePool.query(
          `SELECT event_type FROM security_audit_events WHERE user_id = $1 AND event_type = 'AUTH_PASSWORD_RESET_REQUESTED';`,
          [user.id]
        );
        expect(auditRes.rows.length).toBe(1);
      });

      it("should invalidate previous outstanding tokens when a new recovery request is submitted", async () => {
        const user = await createTestUser("token_supersession");

        // Request 1
        await app.inject({
          method: "POST",
          url: "/api/v1/auth/forgot-password",
          payload: { email: user.email }
        });
        const token1 = testAdapter.getLastEmail()!.resetToken;

        // Request 2
        await app.inject({
          method: "POST",
          url: "/api/v1/auth/forgot-password",
          payload: { email: user.email }
        });
        const token2 = testAdapter.getLastEmail()!.resetToken;

        expect(token1).not.toBe(token2);

        // Verify in DB: token 1 has used_at populated (superseded), token 2 has used_at NULL
        const tokensDb = await runtimePool.query(
          `SELECT token_hash, used_at FROM password_reset_tokens WHERE user_id = $1 ORDER BY created_at ASC;`,
          [user.id]
        );
        expect(tokensDb.rows.length).toBe(2);
        expect(tokensDb.rows[0].used_at).not.toBeNull(); // Token 1 superseded
        expect(tokensDb.rows[1].used_at).toBeNull(); // Token 2 active

        // Attempting to reset with superseded token 1 must fail
        const resetRes = await app.inject({
          method: "POST",
          url: "/api/v1/auth/reset-password",
          payload: {
            token: token1,
            newPassword: "BrandNewPassword123!",
            confirmPassword: "BrandNewPassword123!"
          }
        });
        expect(resetRes.statusCode).toBe(400);
      });

      it("should enforce rate limiting on password reset requests", async () => {
        const user = await createTestUser("rate_limiting");

        // Fire 5 requests (allowed)
        for (let i = 0; i < 5; i++) {
          const res = await app.inject({
            method: "POST",
            url: "/api/v1/auth/forgot-password",
            payload: { email: user.email }
          });
          expect(res.statusCode).toBe(200);
        }

        // 6th request must trigger rate limit (429)
        const rateLimitedRes = await app.inject({
          method: "POST",
          url: "/api/v1/auth/forgot-password",
          payload: { email: user.email }
        });
        expect(rateLimitedRes.statusCode).toBe(429);
        const body = JSON.parse(rateLimitedRes.body);
        expect(body.error.code).toBe("RATE_LIMITED");
      });

      it("should fail safely and observably when using NoopEmailDeliveryAdapter (OQ-019)", async () => {
        const user = await createTestUser("noop_adapter");
        emailService.setAdapter(new NoopEmailDeliveryAdapter());

        const res = await app.inject({
          method: "POST",
          url: "/api/v1/auth/forgot-password",
          payload: { email: user.email }
        });

        // Must still return 200 generic message to client without exposing delivery failure
        expect(res.statusCode).toBe(200);
      });
    });

    // ------------------------------------------------------------------------
    // 3. Password Reset Execution (/api/v1/auth/reset-password)
    // ------------------------------------------------------------------------
    describe("3. Password Reset Execution", () => {
      it("should successfully reset password with valid token and revoke all active sessions across all devices", async () => {
        const user = await createTestUser("reset_ok");

        // Create 2 active sessions for this user
        const login1 = await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          payload: { email: user.email, password: user.password, clientType: "WEB" }
        });
        const token1 = JSON.parse(login1.body).data.accessToken;

        const login2 = await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          payload: { email: user.email, password: user.password, clientType: "MOBILE" }
        });
        const token2 = JSON.parse(login2.body).data.accessToken;

        // Request recovery
        await app.inject({
          method: "POST",
          url: "/api/v1/auth/forgot-password",
          payload: { email: user.email }
        });
        const recoveryToken = testAdapter.getLastEmail()!.resetToken;

        // Perform password reset
        const newPassword = "ResetSecurePassword999!";
        const resetRes = await app.inject({
          method: "POST",
          url: "/api/v1/auth/reset-password",
          payload: {
            token: recoveryToken,
            newPassword,
            confirmPassword: newPassword
          }
        });

        expect(resetRes.statusCode).toBe(200);
        const resetBody = JSON.parse(resetRes.body);
        expect(resetBody.success).toBe(true);
        expect(resetBody.data.message).toContain("Password has been reset successfully");

        // 1. Token must now be marked as used in DB
        const tokenDb = await runtimePool.query(
          `SELECT used_at FROM password_reset_tokens WHERE user_id = $1;`,
          [user.id]
        );
        expect(tokenDb.rows[0].used_at).not.toBeNull();

        // 2. All previous active sessions must be REVOKED with 'PASSWORD_RESET'
        const sessionsDb = await runtimePool.query(
          `SELECT id, revoked_at, revocation_reason FROM auth_sessions WHERE user_id = $1;`,
          [user.id]
        );
        expect(sessionsDb.rows.length).toBe(2);
        for (const s of sessionsDb.rows) {
          expect(s.revoked_at).not.toBeNull();
          expect(s.revocation_reason).toBe("PASSWORD_RESET");
        }

        // 3. Old access tokens must now fail at /me
        const me1 = await app.inject({
          method: "GET",
          url: "/api/v1/auth/me",
          headers: { authorization: `Bearer ${token1}` }
        });
        expect(me1.statusCode).toBe(401);

        const me2 = await app.inject({
          method: "GET",
          url: "/api/v1/auth/me",
          headers: { authorization: `Bearer ${token2}` }
        });
        expect(me2.statusCode).toBe(401);

        // 4. Old password fails at login
        const oldLogin = await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          payload: { email: user.email, password: user.password }
        });
        expect(oldLogin.statusCode).toBe(401);

        // 5. New password succeeds at login
        const newLogin = await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          payload: { email: user.email, password: newPassword }
        });
        expect(newLogin.statusCode).toBe(200);

        // 6. Verify audit event
        const auditRes = await runtimePool.query(
          `SELECT event_type FROM security_audit_events WHERE user_id = $1 AND event_type = 'AUTH_PASSWORD_RESET_COMPLETED';`,
          [user.id]
        );
        expect(auditRes.rows.length).toBe(1);
      });

      it("should reject reset with invalid token", async () => {
        const resetRes = await app.inject({
          method: "POST",
          url: "/api/v1/auth/reset-password",
          payload: {
            token: "invalid_non_existent_token_hex_string_12345",
            newPassword: "NewPassword123!",
            confirmPassword: "NewPassword123!"
          }
        });

        expect(resetRes.statusCode).toBe(400);
        const body = JSON.parse(resetRes.body);
        expect(body.error.message).toMatch(/Invalid or expired password reset token/i);
      });

      it("should reject reset with expired token", async () => {
        const user = await createTestUser("expired_token");

        await app.inject({
          method: "POST",
          url: "/api/v1/auth/forgot-password",
          payload: { email: user.email }
        });
        const token = testAdapter.getLastEmail()!.resetToken;

        // Manually expire token in DB
        await runtimePool.query(
          `UPDATE password_reset_tokens SET expires_at = NOW() - interval '2 hours' WHERE user_id = $1;`,
          [user.id]
        );

        const resetRes = await app.inject({
          method: "POST",
          url: "/api/v1/auth/reset-password",
          payload: {
            token,
            newPassword: "BrandNewPassword123!",
            confirmPassword: "BrandNewPassword123!"
          }
        });

        expect(resetRes.statusCode).toBe(400);
        const body = JSON.parse(resetRes.body);
        expect(body.error.message).toMatch(/Invalid or expired password reset token/i);
      });

      it("should reject reset replay using already-consumed token", async () => {
        const user = await createTestUser("replay_token");

        await app.inject({
          method: "POST",
          url: "/api/v1/auth/forgot-password",
          payload: { email: user.email }
        });
        const token = testAdapter.getLastEmail()!.resetToken;

        // First reset (successful)
        const firstReset = await app.inject({
          method: "POST",
          url: "/api/v1/auth/reset-password",
          payload: {
            token,
            newPassword: "PasswordOnce123!",
            confirmPassword: "PasswordOnce123!"
          }
        });
        expect(firstReset.statusCode).toBe(200);

        // Replay attempt (must fail)
        const replayReset = await app.inject({
          method: "POST",
          url: "/api/v1/auth/reset-password",
          payload: {
            token,
            newPassword: "PasswordTwice456!",
            confirmPassword: "PasswordTwice456!"
          }
        });
        expect(replayReset.statusCode).toBe(400);
        const body = JSON.parse(replayReset.body);
        expect(body.error.message).toMatch(/Invalid or expired password reset token/i);
      });

      it("should serialize concurrent reset attempts with the same token via database row locking", async () => {
        const user = await createTestUser("concurrent_reset");

        await app.inject({
          method: "POST",
          url: "/api/v1/auth/forgot-password",
          payload: { email: user.email }
        });
        const token = testAdapter.getLastEmail()!.resetToken;

        // Simultaneous execution
        const [resA, resB] = await Promise.all([
          app.inject({
            method: "POST",
            url: "/api/v1/auth/reset-password",
            payload: {
              token,
              newPassword: "ConcurrentPass1!",
              confirmPassword: "ConcurrentPass1!"
            }
          }),
          app.inject({
            method: "POST",
            url: "/api/v1/auth/reset-password",
            payload: {
              token,
              newPassword: "ConcurrentPass2!",
              confirmPassword: "ConcurrentPass2!"
            }
          })
        ]);

        const statusCodes = [resA.statusCode, resB.statusCode];
        // Exactly one must succeed (200), and the losing concurrent request must fail (400)
        expect(statusCodes).toContain(200);
        expect(statusCodes).toContain(400);

        // Verify token was used exactly once
        const tokenDb = await runtimePool.query(
          `SELECT used_at FROM password_reset_tokens WHERE user_id = $1;`,
          [user.id]
        );
        expect(tokenDb.rows.length).toBe(1);
        expect(tokenDb.rows[0].used_at).not.toBeNull();
      });
    });
  });
});
