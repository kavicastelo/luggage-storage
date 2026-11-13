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
  ResendHttpEmailAdapter,
  ZohoSmtpEmailAdapter,
  createAdapterForEnvironment
} from "../src/modules/email/email.service.js";
import {
  buildVerificationEmailTemplate,
  buildPasswordResetEmailTemplate,
  resolvePublicEmailUrl
} from "../src/modules/email/email.templates.js";
import { rateLimitService, RATE_LIMIT_POLICIES } from "../src/modules/auth/rate-limit.service.js";
import { isValidAccountStateTransition } from "../src/modules/auth/auth.service.js";
import { REQUIRED_PUBLIC_TABLES, verifyMigratedSchema } from "../src/infrastructure/database/migrate.js";

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

      // Verify auth_rate_limits table stores keyed HMAC-SHA-256 hash (64-hex) and never raw email
      const rateLimitRows = await runtimePool.query(
        "SELECT key_hash, scope, points FROM auth_rate_limits WHERE scope = 'auth_login_email';"
      );
      expect(rateLimitRows.rows.length).toBeGreaterThanOrEqual(1);
      const unsaltedHash = crypto
        .createHash("sha256")
        .update(`auth_login_email:${email.toLowerCase()}`)
        .digest("hex");
      for (const row of rateLimitRows.rows) {
        expect(row.key_hash).toMatch(/^[a-f0-9]{64}$/);
        expect(row.key_hash).not.toContain(email);
        expect(row.key_hash).not.toBe(unsaltedHash);
      }
      expect(blockedRes.headers["retry-after"]).toBeDefined();
      expect(Number(blockedRes.headers["retry-after"])).toBeGreaterThan(0);
    });

    it("should enforce authoritative RATE_LIMIT_POLICIES and keyed HMAC-SHA-256 with secret separation (AUD-004)", async () => {
      expect(RATE_LIMIT_POLICIES.auth_login_ip).toEqual({
        maxPoints: 20,
        windowSeconds: 900
      });
      expect(RATE_LIMIT_POLICIES.auth_login_email).toEqual({
        maxPoints: 5,
        windowSeconds: 900
      });
      expect(RATE_LIMIT_POLICIES.auth_register_ip).toEqual({
        maxPoints: 10,
        windowSeconds: 900
      });
      expect(RATE_LIMIT_POLICIES.auth_register_email).toEqual({
        maxPoints: 5,
        windowSeconds: 3600
      });
      expect(RATE_LIMIT_POLICIES.auth_verify_resend_ip).toEqual({
        maxPoints: 10,
        windowSeconds: 900
      });
      expect(RATE_LIMIT_POLICIES.auth_verify_resend_email).toEqual({
        maxPoints: 3,
        windowSeconds: 900
      });
      expect(RATE_LIMIT_POLICIES.auth_recovery_ip).toEqual({
        maxPoints: 10,
        windowSeconds: 900
      });
      expect(RATE_LIMIT_POLICIES.auth_recovery_email).toEqual({
        maxPoints: 3,
        windowSeconds: 900
      });

      const hashA = rateLimitService.hashKey(
        "auth_login_email",
        "Traveller@Example.com",
        "secret_key_alpha_with_at_least_32_characters_0001"
      );
      const hashB = rateLimitService.hashKey(
        "auth_login_email",
        "traveller@example.com",
        "secret_key_beta_with_at_least_32_characters_00002"
      );
      const hashASameNormalized = rateLimitService.hashKey(
        "auth_login_email",
        "  traveller@example.com  ",
        "secret_key_alpha_with_at_least_32_characters_0001"
      );

      expect(hashA).toMatch(/^[a-f0-9]{64}$/);
      expect(hashB).toMatch(/^[a-f0-9]{64}$/);
      expect(hashA).toBe(hashASameNormalized);
      expect(hashA).not.toBe(hashB);
    });

    it("should enforce resend-verification rate limit at 3 requests per 15m per email and include Retry-After header (AUD-004)", async () => {
      const unique = `${Date.now()}_resend_rl`;
      const email = `resend_rl_${unique}@example.com`;

      await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: {
          email,
          password: "VerifyPassword123!",
          displayName: "Resend Rate Limit User"
        }
      });

      for (let i = 0; i < 3; i++) {
        const okRes = await app.inject({
          method: "POST",
          url: "/api/v1/auth/resend-verification",
          payload: { email }
        });
        expect(okRes.statusCode).toBe(200);
      }

      const blockedRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/resend-verification",
        payload: { email }
      });
      expect(blockedRes.statusCode).toBe(429);
      expect(blockedRes.headers["retry-after"]).toBeDefined();
      expect(Number(blockedRes.headers["retry-after"])).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 3. Database TLS, CORS & Zoho Mail Adapter Security (AUD-002, AUD-003)
  // ==========================================================================
  describe("3. Production TLS, CORS & Zoho Mail Adapter Controls (AUD-002, AUD-003)", () => {
    const validProdBase = {
      NODE_ENV: "production",
      JWT_SECRET: "prod_jwt_secret_key_with_at_least_32_characters_99999",
      COOKIE_SECRET: "prod_cookie_secret_key_with_at_least_32_characters_99999",
      RATE_LIMIT_HASH_SECRET: "prod_rate_limit_hmac_secret_with_at_least_32_chars_99",
      STORAGE_PROVIDER: "r2",
      R2_ACCOUNT_ID: "prod_r2_account_id_example",
      R2_ACCESS_KEY_ID: "prod_r2_access_key_id_example",
      R2_SECRET_ACCESS_KEY: "prod_r2_secret_access_key_example",
      R2_BUCKET_NAME: "luggage-storage-production",
      PAYOUT_ENCRYPTION_KEY: "prod_payout_encryption_key_32_chars_minimum!",
      DB_IDENTITY_SECRET: "prod_db_identity_secret_with_at_least_32_chars_999",
      PAYMENT_PROVIDER: "payhere",
      PAYMENT_WEBHOOK_SECRET: "prod_payment_webhook_hmac_secret_32_chars_999!",
      PAYHERE_MERCHANT_ID: "1229999",
      PAYHERE_MERCHANT_SECRET: "prod_payhere_merchant_secret_placeholder_123",
      PAYHERE_SANDBOX_MODE: "false",
      DATABASE_SSL: "true",
      DATABASE_SSL_REJECT_UNAUTHORIZED: "true",
      CORS_ORIGIN: "https://app.luggagestorage.lk,https://admin.luggagestorage.lk",
      EMAIL_PROVIDER: "zoho",
      ZOHO_SMTP_HOST: "smtp.zoho.com",
      ZOHO_SMTP_PORT: "465",
      ZOHO_SMTP_SECURE: "true",
      ZOHO_SMTP_USER: "no-reply@luggagestorage.lk",
      ZOHO_SMTP_PASSWORD: "zoho_app_specific_password_placeholder",
      EMAIL_FROM_ADDRESS: "no-reply@luggagestorage.lk",
      EMAIL_FROM_NAME: "Global Luggage Storage Marketplace"
    };

    it("should reject DATABASE_SSL=false, DATABASE_SSL_REJECT_UNAUTHORIZED=false, and CORS_ORIGIN='*' in production (AUD-003)", () => {
      const noSslProd = EnvSchema.safeParse({
        ...validProdBase,
        DATABASE_SSL: "false"
      });
      expect(noSslProd.success).toBe(false);

      const insecureRejectUnauthorizedProd = EnvSchema.safeParse({
        ...validProdBase,
        DATABASE_SSL_REJECT_UNAUTHORIZED: "false"
      });
      expect(insecureRejectUnauthorizedProd.success).toBe(false);

      const wildcardCorsProd = EnvSchema.safeParse({
        ...validProdBase,
        CORS_ORIGIN: "*"
      });
      expect(wildcardCorsProd.success).toBe(false);

      const validProdConfig = EnvSchema.safeParse(validProdBase);
      expect(validProdConfig.success).toBe(true);
      if (validProdConfig.success) {
        const sslConfig = buildDatabaseSslConfig(validProdConfig.data);
        expect(sslConfig).toEqual({ rejectUnauthorized: true });
      }

      const customCaProdConfig = EnvSchema.safeParse({
        ...validProdBase,
        DATABASE_SSL_CA: "-----BEGIN CERTIFICATE-----\\nMIIB...\\n-----END CERTIFICATE-----"
      });
      expect(customCaProdConfig.success).toBe(true);
      if (customCaProdConfig.success) {
        const sslWithCa = buildDatabaseSslConfig(customCaProdConfig.data);
        expect(sslWithCa).toEqual({
          rejectUnauthorized: true,
          ca: "-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----"
        });
      }
    });

    it("should reject noop, console, or test email providers in production and require Zoho SMTP credentials (AUD-002)", () => {
      for (const forbiddenProvider of ["noop", "console", "test"] as const) {
        const parsed = EnvSchema.safeParse({
          ...validProdBase,
          EMAIL_PROVIDER: forbiddenProvider
        });
        expect(parsed.success).toBe(false);

        expect(() =>
          createAdapterForEnvironment(forbiddenProvider, "production")
        ).toThrow(/Invalid production email provider/);
      }

      const missingZohoSecret = EnvSchema.safeParse({
        ...validProdBase,
        ZOHO_SMTP_PASSWORD: ""
      });
      expect(missingZohoSecret.success).toBe(false);

      const port465Insecure = EnvSchema.safeParse({
        ...validProdBase,
        ZOHO_SMTP_PORT: "465",
        ZOHO_SMTP_SECURE: "false"
      });
      expect(port465Insecure.success).toBe(false);
    });

    it("should deliver verification and password reset emails via ZohoSmtpEmailAdapter and handle SMTP errors without leaking secrets (AUD-002)", async () => {
      const sentMailCalls: Array<Record<string, unknown>> = [];

      const zohoOk = new ZohoSmtpEmailAdapter({
        host: "smtp.zoho.com",
        port: 465,
        secure: true,
        user: "no-reply@luggagestorage.lk",
        password: "super_secret_zoho_app_password_123",
        fromAddress: "no-reply@luggagestorage.lk",
        fromName: "Global Luggage Storage Marketplace",
        publicBaseUrl: "https://app.luggagestorage.lk",
        transporter: {
          sendMail: async (mailOptions) => {
            sentMailCalls.push(mailOptions as unknown as Record<string, unknown>);
            return {
              messageId: "<zoho-msg-001@luggagestorage.lk>",
              accepted: [String(mailOptions.to)],
              rejected: []
            };
          }
        }
      });

      expect(zohoOk.getConfigurationSummary().hasCredentials).toBe(true);

      const verifyRes = await zohoOk.sendEmailVerificationEmail({
        to: "traveller@example.com",
        displayName: "Nimal Perera",
        verificationToken: "a".repeat(64),
        verificationUrl: "/auth/verify-email?token=" + "a".repeat(64)
      });
      expect(verifyRes.delivered).toBe(true);
      expect(verifyRes.provider).toBe("zoho");
      expect(verifyRes.messageId).toBe("<zoho-msg-001@luggagestorage.lk>");
      expect(sentMailCalls.length).toBe(1);
      expect(String(sentMailCalls[0].html)).toContain("https://app.luggagestorage.lk/auth/verify-email?token=");
      expect(String(sentMailCalls[0].text)).toContain("https://app.luggagestorage.lk/auth/verify-email?token=");

      const resetRes = await zohoOk.sendPasswordResetEmail({
        to: "traveller@example.com",
        displayName: "Nimal Perera",
        resetToken: "b".repeat(64),
        resetUrl: "/auth/reset-password?token=" + "b".repeat(64)
      });
      expect(resetRes.delivered).toBe(true);
      expect(resetRes.provider).toBe("zoho");
      expect(sentMailCalls.length).toBe(2);
      expect(String(sentMailCalls[1].html)).toContain("60 minutes");
      expect(String(sentMailCalls[1].text)).toContain("60 minutes");

      // Simulate SMTP authentication failure and ensure password is never leaked
      const secretPass = "ultra_confidential_zoho_smtp_pass_999";
      const zohoAuthFail = new ZohoSmtpEmailAdapter({
        host: "smtp.zoho.com",
        port: 465,
        secure: true,
        user: "no-reply@luggagestorage.lk",
        password: secretPass,
        fromAddress: "no-reply@luggagestorage.lk",
        fromName: "Global Luggage Storage Marketplace",
        transporter: {
          sendMail: async () => {
            const err = new Error(`Invalid login for ${secretPass}`) as Error & { code?: string };
            err.code = "EAUTH";
            throw err;
          }
        }
      });

      const failedSend = await zohoAuthFail.sendEmailVerificationEmail({
        to: "traveller@example.com",
        displayName: "Traveller",
        verificationToken: "c".repeat(64),
        verificationUrl: "/auth/verify-email?token=" + "c".repeat(64)
      });
      expect(failedSend.delivered).toBe(false);
      expect(failedSend.error).toContain("ZOHO_SMTP_AUTH_FAILED");
      expect(failedSend.error).not.toContain(secretPass);

      // Simulate rejected recipient
      const zohoRejected = new ZohoSmtpEmailAdapter({
        host: "smtp.zoho.com",
        port: 465,
        secure: true,
        user: "no-reply@luggagestorage.lk",
        password: "valid_password",
        fromAddress: "no-reply@luggagestorage.lk",
        fromName: "Global Luggage Storage Marketplace",
        transporter: {
          sendMail: async () => ({
            messageId: "<rejected>",
            accepted: [],
            rejected: ["bounce@example.com"]
          })
        }
      });

      const rejectedRes = await zohoRejected.sendPasswordResetEmail({
        to: "bounce@example.com",
        displayName: "Bounce User",
        resetToken: "d".repeat(64),
        resetUrl: "/auth/reset-password?token=" + "d".repeat(64)
      });
      expect(rejectedRes.delivered).toBe(false);
      expect(rejectedRes.error).toContain("ZOHO_SMTP_RECIPIENT_REJECTED");
    });

    it("should preserve existing unused verification and reset tokens when email delivery fails on resend or recovery (AUD-002)", async () => {
      const unique = `${Date.now()}_preserve_tok`;
      const email = `preserve_${unique}@example.com`;
      const password = "PreserveTokenPass123!";

      // 1. Register user (initial verification email succeeds)
      const regRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: { email, password, displayName: "Token Preservation User" }
      });
      expect(regRes.statusCode).toBe(201);
      const originalVerifyToken =
        testEmailAdapter.getLastVerificationEmailFor(email)!.verificationToken;

      // 2. Simulate SMTP failure during resend-verification
      testEmailAdapter.setSimulatedFailure("ZOHO_SMTP_SEND_FAILED:ETIMEDOUT");
      const resendFailRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/resend-verification",
        payload: { email }
      });
      expect(resendFailRes.statusCode).toBe(200);

      // 3. Original verification token must STILL be valid and activate the account!
      testEmailAdapter.setSimulatedFailure(null);
      const verifyWithOriginalRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/verify-email",
        payload: { token: originalVerifyToken }
      });
      expect(verifyWithOriginalRes.statusCode).toBe(200);
      expect(JSON.parse(verifyWithOriginalRes.body).data.user.status).toBe("ACTIVE");

      // 4. Request initial password reset (delivery succeeds)
      const resetReq1 = await app.inject({
        method: "POST",
        url: "/api/v1/auth/forgot-password",
        payload: { email }
      });
      expect(resetReq1.statusCode).toBe(200);
      const originalResetToken = testEmailAdapter.getLastEmail()!.resetToken;

      // 5. Simulate SMTP failure on second forgot-password request
      testEmailAdapter.setSimulatedFailure("ZOHO_SMTP_SEND_FAILED:ETIMEDOUT");
      const resetReq2Fail = await app.inject({
        method: "POST",
        url: "/api/v1/auth/forgot-password",
        payload: { email }
      });
      expect(resetReq2Fail.statusCode).toBe(200);

      // 6. Original reset token must STILL be valid and reset the password!
      testEmailAdapter.setSimulatedFailure(null);
      const newPassword = "RecoveredAfterSmtpOutage999!";
      const executeResetRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/reset-password",
        payload: {
          token: originalResetToken,
          newPassword,
          confirmPassword: newPassword
        }
      });
      expect(executeResetRes.statusCode).toBe(200);
    });

    it("should render mobile-friendly HTML and plain-text email templates with HTML escaping (AUD-002)", () => {
      const verificationTpl = buildVerificationEmailTemplate({
        displayName: '<script>alert("xss")</script>',
        verificationUrl: "/auth/verify-email?token=tok_123",
        publicBaseUrl: "https://app.luggagestorage.lk"
      });
      expect(verificationTpl.html).not.toContain("<script>");
      expect(verificationTpl.html).toContain("&lt;script&gt;");
      expect(verificationTpl.html).toContain("https://app.luggagestorage.lk/auth/verify-email?token=tok_123");
      expect(verificationTpl.text).toContain("https://app.luggagestorage.lk/auth/verify-email?token=tok_123");

      const resetTpl = buildPasswordResetEmailTemplate({
        displayName: "Host Partner",
        resetUrl: "/auth/reset-password?token=rst_456",
        publicBaseUrl: "https://app.luggagestorage.lk"
      });
      expect(resetTpl.html).toContain("https://app.luggagestorage.lk/reset-password?token=rst_456");
      expect(resetTpl.text).toContain("https://app.luggagestorage.lk/reset-password?token=rst_456");
      expect(resolvePublicEmailUrl("https://custom.domain.lk/verify?token=abc", "https://app.luggagestorage.lk")).toBe(
        "https://custom.domain.lk/verify?token=abc"
      );
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

      expect(journal.entries.length).toBe(13);

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

    it("should deterministically verify all required PostgreSQL tables and PostGIS extension (AUD-001)", async () => {
      const client = await migratorPool.connect();
      try {
        await verifyMigratedSchema(client);
        expect(REQUIRED_PUBLIC_TABLES.length).toBe(43);
      } finally {
        client.release();
      }
    });

    it("should maintain 100% column and index parity between live PostgreSQL schema and stabilization reports (AUD-006)", async () => {
      const evtColsRes = await runtimePool.query<{ column_name: string }>(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'email_verification_tokens'
        ORDER BY ordinal_position ASC;
      `);
      const evtCols = evtColsRes.rows.map((r) => r.column_name);
      expect(evtCols).toEqual([
        "id",
        "user_id",
        "token_hash",
        "expires_at",
        "used_at",
        "created_at"
      ]);
      expect(evtCols).not.toContain("requested_ip");
      expect(evtCols).not.toContain("user_agent");

      const rlColsRes = await runtimePool.query<{ column_name: string }>(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'auth_rate_limits'
        ORDER BY ordinal_position ASC;
      `);
      const rlCols = rlColsRes.rows.map((r) => r.column_name);
      expect(rlCols).toEqual([
        "key_hash",
        "scope",
        "points",
        "window_start",
        "expires_at",
        "updated_at"
      ]);
      expect(rlCols).not.toContain("window_started_at");

      const evtIdxRes = await runtimePool.query<{ indexname: string }>(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'email_verification_tokens';
      `);
      const evtIdxs = evtIdxRes.rows.map((r) => r.indexname);
      expect(evtIdxs).toContain("email_verification_tokens_pkey");
      expect(evtIdxs).toContain("email_verification_tokens_token_hash_unique");
      expect(evtIdxs).toContain("email_verification_tokens_user_expires_idx");

      const rlIdxRes = await runtimePool.query<{ indexname: string }>(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'auth_rate_limits';
      `);
      const rlIdxs = rlIdxRes.rows.map((r) => r.indexname);
      expect(rlIdxs).toContain("auth_rate_limits_pkey");
      expect(rlIdxs).toContain("auth_rate_limits_expires_at_idx");
      expect(rlIdxs).toContain("auth_rate_limits_scope_idx");

      const secReportPath = path.resolve(
        __dirname,
        "../../../docs/project-stabilization/04-security-remediation-report.md"
      );
      const dbReportPath = path.resolve(
        __dirname,
        "../../../docs/project-stabilization/05-database-and-migration-report.md"
      );
      const secReport = fs.readFileSync(secReportPath, "utf8");
      const dbReport = fs.readFileSync(dbReportPath, "utf8");

      expect(secReport).not.toContain("requested_ip");
      expect(dbReport).not.toContain("requested_ip");
      expect(dbReport).not.toContain("window_started_at");
      expect(dbReport).toContain("window_start");
      expect(dbReport).toContain("auth_rate_limits_expires_at_idx");
    });
  });
});

