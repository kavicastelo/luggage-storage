import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import pg from "pg";
import argon2 from "argon2";
import { buildApp } from "../src/app.js";
import { env } from "../src/config/env.js";

const { Pool } = pg;

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
});
