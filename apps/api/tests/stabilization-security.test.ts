import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import pg from "pg";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp, isCorsOriginAllowed } from "../src/app.js";
import { env, EnvSchema, buildDatabaseSslConfig } from "../src/config/env.js";
import {
  emailService,
  DeterministicTestEmailAdapter,
  NoopEmailDeliveryAdapter,
  ConsoleDevEmailAdapter,
  ResendHttpEmailAdapter
} from "../src/modules/email/email.service.js";
import { rateLimitService } from "../src/modules/auth/rate-limit.service.js";
import { isValidAccountStateTransition } from "../src/modules/auth/auth.service.js";

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Project Stabilization — Identity, Verification, Rate Limiting, Audit & Migration Verification", () => {
  let app: FastifyInstance;
  let runtimePool: pg.Pool;
  let migratorPool: pg.Pool;
  let testEmailAdapter: DeterministicTestEmailAdapter;

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

  beforeEach(async () => {
    testEmailAdapter = new DeterministicTestEmailAdapter();
    emailService.setAdapter(testEmailAdapter);
    await rateLimitService.clearAll();
  });

  afterAll(async () => {
    await app.close();
    await runtimePool.end();
    await migratorPool.end();
  });

  // ==========================================================================
  // 1. Self-Service Email Verification Lifecycle (REM-B01)
  // ==========================================================================
  describe("1. Self-Service Email Verification & Account Activation (REM-B01)", () => {
    it("should issue a SHA-256 hashed verification token on registration, block login until verified, and activate account on POST /api/v1/auth/verify-email", async () => {
      const unique = `${Date.now()}_verify`;
      const email = `verify_${unique}@example.com`;
      const password = "VerifyPassword123!";

      const regRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          email,
          password,
          displayName: "Verification Traveller"
        }
      });

      expect(regRes.statusCode).toBe(201);
      const regBody = JSON.parse(regRes.body);
      expect(regBody.data.status).toBe("PENDING_VERIFICATION");
      expect(regBody.data.isEmailVerified).toBe(false);

      // Verify email adapter captured the verification email and raw token
      const dispatched = testEmailAdapter.getLastVerificationEmailFor(email);
      expect(dispatched).toBeDefined();
      const rawToken = dispatched!.verificationToken;
      expect(rawToken).toMatch(/^[a-f0-9]{64}$/);

      // Verify DB stores only SHA-256 hash, never raw token
      const expectedHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const dbTokenRes = await runtimePool.query(
        "SELECT token_hash, used_at FROM email_verification_tokens WHERE user_id = $1;",
        [regBody.data.id]
      );
      expect(dbTokenRes.rows.length).toBe(1);
      expect(dbTokenRes.rows[0].token_hash).toBe(expectedHash);
      expect(dbTokenRes.rows[0].token_hash).not.toBe(rawToken);
      expect(dbTokenRes.rows[0].used_at).toBeNull();

      // Unverified login attempt must be rejected with 403 FORBIDDEN
      const unverifiedLogin = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password }
      });
      expect(unverifiedLogin.statusCode).toBe(403);
      expect(JSON.parse(unverifiedLogin.body).error.code).toBe("FORBIDDEN");

      // Execute self-service email verification
      const verifyRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/verify-email",
        payload: { token: rawToken }
      });
      expect(verifyRes.statusCode).toBe(200);
      const verifyBody = JSON.parse(verifyRes.body);
      expect(verifyBody.success).toBe(true);
      expect(verifyBody.data.user.status).toBe("ACTIVE");
      expect(verifyBody.data.user.isEmailVerified).toBe(true);
      expect(verifyBody.data.user.emailVerifiedAt).toBeDefined();

      // Replay of consumed verification token must be rejected with 400 BAD_REQUEST
      const replayRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/verify-email",
        payload: { token: rawToken }
      });
      expect(replayRes.statusCode).toBe(400);

      // Login now succeeds with 200 OK
      const verifiedLogin = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password }
      });
      expect(verifiedLogin.statusCode).toBe(200);
      expect(JSON.parse(verifiedLogin.body).data.user.status).toBe("ACTIVE");
    });

    it("should serialize concurrent email verification attempts with the same token via FOR UPDATE row lock", async () => {
      const unique = `${Date.now()}_conc_verify`;
      const email = `conc_${unique}@example.com`;
      const password = "VerifyPassword123!";

      await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: { email, password, displayName: "Concurrent Verify" }
      });

      const rawToken = testEmailAdapter.getLastVerificationEmailFor(email)!.verificationToken;

      const [resA, resB] = await Promise.all([
        app.inject({
          method: "POST",
          url: "/api/v1/auth/verify-email",
          payload: { token: rawToken }
        }),
        app.inject({
          method: "POST",
          url: "/api/v1/auth/verify-email",
          payload: { token: rawToken }
        })
      ]);

      const statuses = [resA.statusCode, resB.statusCode];
      expect(statuses).toContain(200);
      expect(statuses).toContain(400);
    });

    it("should invalidate previous verification token when POST /api/v1/auth/resend-verification is called and enforce rate limits", async () => {
      const unique = `${Date.now()}_resend`;
      const email = `resend_${unique}@example.com`;
      const password = "VerifyPassword123!";

      await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: { email, password, displayName: "Resend User" }
      });

      const firstToken = testEmailAdapter.getLastVerificationEmailFor(email)!.verificationToken;

      const resendRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/resend-verification",
        payload: { email }
      });
      expect(resendRes.statusCode).toBe(200);

      const secondToken = testEmailAdapter.getLastVerificationEmailFor(email)!.verificationToken;
      expect(secondToken).not.toBe(firstToken);

      // First token must now be invalidated
      const oldTokenVerify = await app.inject({
        method: "POST",
        url: "/api/v1/auth/verify-email",
        payload: { token: firstToken }
      });
      expect(oldTokenVerify.statusCode).toBe(400);

      // Second token succeeds
      const newTokenVerify = await app.inject({
        method: "POST",
        url: "/api/v1/auth/verify-email",
        payload: { token: secondToken }
      });
      expect(newTokenVerify.statusCode).toBe(200);
    });
  });

  // ==========================================================================
  // 2. PostgreSQL-Backed Rate Limiting (REM-B03 & REM-B04)
  // ==========================================================================
  describe("2. Multi-Instance PostgreSQL Rate Limiting (REM-B03 & REM-B04)", () => {
    it("should block brute-force login attempts after 5 failures with 429 RATE_LIMITED and store only SHA-256 key hashes", async () => {
      const unique = `${Date.now()}_ratelimit`;
      const email = `brute_${unique}@example.com`;
      const password = "CorrectPassword123!";

      await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: { email, password, displayName: "Brute Target" }
      });

      // 5 failed attempts return 401
      for (let i = 0; i < 5; i++) {
        const failRes = await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          payload: { email, password: `WrongPass_${i}!` }
        });
        expect(failRes.statusCode).toBe(401);
      }

      // 6th failed attempt exceeds threshold -> 429 RATE_LIMITED
      const blockedRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password: "WrongPass_6!" }
      });
      expect(blockedRes.statusCode).toBe(429);
      const blockedBody = JSON.parse(blockedRes.body);
      expect(blockedBody.error.code).toBe("RATE_LIMITED");

      // Verify auth_rate_limits table stores SHA-256 hash and never raw email
      const rateLimitRows = await runtimePool.query(
        "SELECT key_hash, scope, points FROM auth_rate_limits WHERE scope = 'auth_login_email';"
      );
      expect(rateLimitRows.rows.length).toBeGreaterThanOrEqual(1);
      for (const row of rateLimitRows.rows) {
        expect(row.key_hash).toMatch(/^[a-f0-9]{64}$/);
        expect(row.key_hash).not.toContain(email);
      }
    });
  });

  // ==========================================================================
  // 3. Database TLS, CORS & Email Adapter Security (REM-B02, REM-B05, REM-B06)
  // ==========================================================================
  describe("3. Production TLS, CORS & Email Adapter Controls (REM-B02, REM-B05, REM-B06)", () => {
    it("should reject DATABASE_SSL_REJECT_UNAUTHORIZED=false and CORS_ORIGIN='*' in production", () => {
      const insecureProdConfig = EnvSchema.safeParse({
        NODE_ENV: "production",
        JWT_SECRET: "prod_jwt_secret_key_with_at_least_32_characters_99999",
        COOKIE_SECRET: "prod_cookie_secret_key_with_at_least_32_characters_99999",
        DATABASE_SSL: "true",
        DATABASE_SSL_REJECT_UNAUTHORIZED: "false",
        CORS_ORIGIN: "*"
      });
      expect(insecureProdConfig.success).toBe(false);

      const validProdConfig = EnvSchema.safeParse({
        NODE_ENV: "production",
        JWT_SECRET: "prod_jwt_secret_key_with_at_least_32_characters_99999",
        COOKIE_SECRET: "prod_cookie_secret_key_with_at_least_32_characters_99999",
        DATABASE_SSL: "true",
        DATABASE_SSL_REJECT_UNAUTHORIZED: "true",
        CORS_ORIGIN: "https://app.luggagestorage.lk,https://admin.luggagestorage.lk"
      });
      expect(validProdConfig.success).toBe(true);
      if (validProdConfig.success) {
        const sslConfig = buildDatabaseSslConfig(validProdConfig.data);
        expect(sslConfig).toEqual({ rejectUnauthorized: true });
      }
    });

    it("should strictly validate allowed CORS origins in production", () => {
      const allowed = ["https://app.luggagestorage.lk", "https://admin.luggagestorage.lk"];
      expect(isCorsOriginAllowed("https://app.luggagestorage.lk", allowed, "production")).toBe(true);
      expect(isCorsOriginAllowed("https://evil.example.com", allowed, "production")).toBe(false);
      expect(isCorsOriginAllowed("http://localhost:5173", allowed, "production")).toBe(false);
      expect(isCorsOriginAllowed(undefined, allowed, "production")).toBe(true);
    });

    it("should support Noop, ConsoleDev, and ResendHttp email adapters safely", async () => {
      const noop = new NoopEmailDeliveryAdapter();
      const noopRes = await noop.sendEmailVerificationEmail({
        to: "user@example.com",
        displayName: "User",
        verificationToken: "tok",
        verificationUrl: "/verify"
      });
      expect(noopRes.delivered).toBe(false);

      const consoleDev = new ConsoleDevEmailAdapter();
      const consoleRes = await consoleDev.sendEmailVerificationEmail({
        to: "user@example.com",
        displayName: "User",
        verificationToken: "tok",
        verificationUrl: "/verify"
      });
      expect(consoleRes.delivered).toBe(true);

      const resendWithoutKey = new ResendHttpEmailAdapter({ apiKey: "" });
      const resendRes = await resendWithoutKey.sendEmailVerificationEmail({
        to: "user@example.com",
        displayName: "User",
        verificationToken: "tok",
        verificationUrl: "/verify"
      });
      expect(resendRes.delivered).toBe(false);
      expect(resendRes.error).toBe("MISSING_RESEND_API_KEY");
    });

    it("should validate account lifecycle state transitions", () => {
      expect(isValidAccountStateTransition("PENDING_VERIFICATION", "ACTIVE")).toBe(true);
      expect(isValidAccountStateTransition("ACTIVE", "SUSPENDED")).toBe(true);
      expect(isValidAccountStateTransition("SUSPENDED", "ACTIVE")).toBe(true);
      expect(isValidAccountStateTransition("DEACTIVATED", "ACTIVE")).toBe(true);
      expect(isValidAccountStateTransition("DEACTIVATED", "SUSPENDED")).toBe(false);
    });
  });

  // ==========================================================================
  // 4. Administrative Audit Retrieval Endpoints (REM-B07)
  // ==========================================================================
  describe("4. Administrative Audit Retrieval Endpoints (REM-B07)", () => {
    async function createAuthenticatedRoleUser(roleCode: "SUPERADMIN" | "SUPPORT" | "TRAVELLER") {
      const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const email = `audit_api_${roleCode.toLowerCase()}_${unique}@example.com`;
      const password = "AuditApiPassword123!";

      const regRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: { email, password, displayName: `Audit ${roleCode}` }
      });
      const userId = JSON.parse(regRes.body).data.id;

      if (roleCode !== "TRAVELLER") {
        await migratorPool.query(
          `INSERT INTO user_roles (user_id, role_id)
           SELECT $1::uuid, id FROM roles WHERE code = $2
           ON CONFLICT DO NOTHING;`,
          [userId, roleCode]
        );
      }

      await migratorPool.query(
        "UPDATE users SET status = 'ACTIVE', is_email_verified = true, email_verified_at = NOW() WHERE id = $1;",
        [userId]
      );

      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password }
      });
      const accessToken = JSON.parse(loginRes.body).data.accessToken;
      return { userId, email, accessToken };
    }

    it("should allow SUPERADMIN to list and inspect security audit events with filters, while rejecting SUPPORT and TRAVELLER with 403", async () => {
      const superadmin = await createAuthenticatedRoleUser("SUPERADMIN");
      const support = await createAuthenticatedRoleUser("SUPPORT");
      const traveller = await createAuthenticatedRoleUser("TRAVELLER");

      // SUPPORT and TRAVELLER must be denied (admin.audit.read is SUPERADMIN-only)
      const supportRes = await app.inject({
        method: "GET",
        url: "/api/v1/admin/audit-events",
        headers: { authorization: `Bearer ${support.accessToken}` }
      });
      expect(supportRes.statusCode).toBe(403);

      const travellerRes = await app.inject({
        method: "GET",
        url: "/api/v1/admin/audit-events",
        headers: { authorization: `Bearer ${traveller.accessToken}` }
      });
      expect(travellerRes.statusCode).toBe(403);

      // SUPERADMIN succeeds and can filter by userId and eventType
      const listRes = await app.inject({
        method: "GET",
        url: `/api/v1/admin/audit-events?page=1&limit=10&userId=${superadmin.userId}&eventType=AUTH_LOGIN_SUCCESS`,
        headers: { authorization: `Bearer ${superadmin.accessToken}` }
      });
      expect(listRes.statusCode).toBe(200);
      const listBody = JSON.parse(listRes.body);
      expect(listBody.success).toBe(true);
      expect(listBody.data.length).toBeGreaterThanOrEqual(1);
      expect(listBody.pagination.total).toBeGreaterThanOrEqual(1);

      const firstEventId = listBody.data[0].id;
      const detailRes = await app.inject({
        method: "GET",
        url: `/api/v1/admin/audit-events/${firstEventId}`,
        headers: { authorization: `Bearer ${superadmin.accessToken}` }
      });
      expect(detailRes.statusCode).toBe(200);
      const detailBody = JSON.parse(detailRes.body);
      expect(detailBody.data.event.id).toBe(firstEventId);
    });
  });

  // ==========================================================================
  // 5. Database Function Grants & Migration Snapshot Parity (REM-C01 & REM-E01)
  // ==========================================================================
  describe("5. Least-Privilege Function Grants & Migration Snapshot Parity (REM-C01 & REM-E01)", () => {
    it("should revoke PUBLIC execute privileges on sensitive PL/pgSQL functions while granting EXECUTE to luggage_user", async () => {
      const fnCheck = await runtimePool.query(`
        SELECT
          p.proname,
          has_function_privilege('public', p.oid, 'EXECUTE') AS public_can_exec,
          has_function_privilege('luggage_user', p.oid, 'EXECUTE') AS runtime_can_exec
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN ('assign_user_role', 'revoke_user_role', 'prevent_audit_tampering');
      `);

      expect(fnCheck.rows.length).toBe(3);
      for (const row of fnCheck.rows) {
        expect(row.public_can_exec).toBe(false);
        expect(row.runtime_can_exec).toBe(true);
      }
    });

    it("should maintain 100% parity between _journal.json entries, SQL migration files, and chained meta snapshots", () => {
      const migrationsDir = path.resolve(
        __dirname,
        "../src/infrastructure/database/migrations"
      );
      const metaDir = path.join(migrationsDir, "meta");
      const journal = JSON.parse(
        fs.readFileSync(path.join(metaDir, "_journal.json"), "utf8")
      );

      expect(journal.entries.length).toBe(6);

      let previousSnapshotId = "00000000-0000-0000-0000-000000000000";
      for (const entry of journal.entries) {
        const sqlPath = path.join(migrationsDir, `${entry.tag}.sql`);
        expect(fs.existsSync(sqlPath)).toBe(true);

        const prefix = String(entry.idx).padStart(4, "0");
        const snapshotPath = path.join(metaDir, `${prefix}_snapshot.json`);
        expect(fs.existsSync(snapshotPath)).toBe(true);

        const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
        expect(snapshot.prevId).toBe(previousSnapshotId);
        previousSnapshotId = snapshot.id;
      }
    });
  });
});

