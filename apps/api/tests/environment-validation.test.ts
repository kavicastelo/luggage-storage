import { describe, it, expect } from "vitest";
import { EnvSchema, loadConfig } from "../src/config/env.js";

describe("Workstream 1 — Environment Model & Configuration Validation", () => {
  const validDevEnv: Record<string, string> = {
    NODE_ENV: "development",
    APP_ENV: "development",
    PORT: "3000",
    DATABASE_URL: "postgresql://luggage_user:luggage_password@localhost:5432/luggage_storage_dev",
    MIGRATION_DATABASE_URL: "postgresql://luggage_migrator:migrator_password@localhost:5432/luggage_storage_dev",
    JWT_SECRET: "dev_jwt_secret_key_minimum_32_characters_long_for_security_12345",
    COOKIE_SECRET: "dev_cookie_secret_key_minimum_32_characters_long_12345",
    PAYOUT_ENCRYPTION_KEY: "dev_payout_master_encryption_key_32_characters_long_12345",
    RATE_LIMIT_HASH_SECRET: "dev_rate_limit_hmac_secret_key_minimum_32_characters_long_12345",
    DB_IDENTITY_SECRET: "dev_db_identity_secret_minimum_32_characters_long_12345",
    CUSTODY_TOKEN_HMAC_SECRET: "dev_custody_token_hmac_secret_32_chars_minimum_12345",
    PAYMENT_WEBHOOK_SECRET: "dev_payment_webhook_hmac_secret_32_chars_minimum_12345"
  };

  const validDemoEnv: Record<string, string> = {
    NODE_ENV: "production",
    APP_ENV: "demo",
    PORT: "3000",
    DATABASE_URL: "postgresql://postgres.proj:pass@aws-0.pooler.supabase.com:5432/postgres",
    MIGRATION_DATABASE_URL: "postgresql://postgres.proj:pass@aws-0.pooler.supabase.com:5432/postgres",
    DATABASE_SSL: "true",
    DATABASE_SSL_REJECT_UNAUTHORIZED: "false",
    CORS_ORIGIN: "https://demo-web.netlify.app,https://demo-mobile.netlify.app",
    APP_PUBLIC_URL: "https://demo-web.netlify.app",
    JWT_SECRET: "demo_jwt_auth_signing_secret_key_minimum_32_chars_12345",
    COOKIE_SECRET: "demo_fastify_cookie_session_secret_32_characters_12345",
    PAYOUT_ENCRYPTION_KEY: "demo_payout_master_encryption_key_32_characters_12345",
    RATE_LIMIT_HASH_SECRET: "demo_rate_limit_hash_secret_key_32_characters_long_12345",
    DB_IDENTITY_SECRET: "demo_db_identity_secret_minimum_32_characters_long_12345",
    CUSTODY_TOKEN_HMAC_SECRET: "demo_custody_token_hmac_secret_32_chars_minimum_12345",
    PAYMENT_WEBHOOK_SECRET: "demo_payment_webhook_hmac_secret_32_chars_minimum_12345",
    PAYMENT_PROVIDER: "sandbox",
    STORAGE_PROVIDER: "memory",
    EMAIL_PROVIDER: "console",
    MAPS_PROVIDER: "sandbox"
  };

  const validProdEnv: Record<string, string> = {
    NODE_ENV: "production",
    APP_ENV: "production",
    PORT: "3000",
    HOST: "0.0.0.0",
    DATABASE_URL: "postgresql://app_user:strong_prod_pass@db.production.luggagestorage.lk:5432/luggage_storage_prod",
    MIGRATION_DATABASE_URL: "postgresql://migrator_user:strong_prod_pass@db.production.luggagestorage.lk:5432/luggage_storage_prod",
    DATABASE_SSL: "true",
    DATABASE_SSL_REJECT_UNAUTHORIZED: "true",
    CORS_ORIGIN: "https://app.luggagestorage.lk,https://admin.luggagestorage.lk",
    APP_PUBLIC_URL: "https://app.luggagestorage.lk",
    JWT_SECRET: "prod_jwt_secret_distinct_entropy_at_least_32_chars_a1",
    COOKIE_SECRET: "prod_cookie_secret_distinct_entropy_at_least_32_chars_b2",
    PAYOUT_ENCRYPTION_KEY: "prod_payout_encryption_key_distinct_entropy_32_chars_c3",
    RATE_LIMIT_HASH_SECRET: "prod_ratelimit_secret_distinct_entropy_32_chars_d4",
    DB_IDENTITY_SECRET: "prod_db_identity_secret_distinct_entropy_32_chars_e5",
    CUSTODY_TOKEN_HMAC_SECRET: "prod_custody_token_distinct_entropy_secret_32_chars_f6",
    PAYMENT_WEBHOOK_SECRET: "prod_payment_webhook_distinct_entropy_secret_32_chars_g7",
    STORAGE_PROVIDER: "r2",
    R2_ACCOUNT_ID: "prod_r2_account_id_valid_12345",
    R2_ACCESS_KEY_ID: "prod_r2_access_key_valid_12345",
    R2_SECRET_ACCESS_KEY: "prod_r2_secret_key_valid_12345",
    R2_BUCKET_NAME: "luggage-storage-prod-media",
    EMAIL_PROVIDER: "zoho",
    ZOHO_SMTP_HOST: "smtp.zoho.com",
    ZOHO_SMTP_PORT: "465",
    ZOHO_SMTP_SECURE: "true",
    ZOHO_SMTP_USER: "no-reply@luggagestorage.lk",
    ZOHO_SMTP_PASSWORD: "zoho_prod_app_specific_password_123",
    PAYMENT_PROVIDER: "stripe",
    STRIPE_SECRET_KEY: "sk_live_valid_stripe_production_key_12345",
    STRIPE_PUBLISHABLE_KEY: "pk_live_valid_stripe_production_key_12345",
    STRIPE_WEBHOOK_SECRET: "whsec_valid_stripe_production_webhook_secret_12345",
    MAPS_PROVIDER: "maptiler",
    MAPTILER_API_KEY: "maptiler_live_production_key_valid_12345"
  };

  it("1. validates local development configuration with default dev secrets", () => {
    const parsed = EnvSchema.safeParse(validDevEnv);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.NODE_ENV).toBe("development");
      expect(parsed.data.APP_ENV).toBe("development");
      expect(parsed.data.PAYMENT_PROVIDER).toBe("sandbox");
    }
  });

  it("2. validates test environment configuration", () => {
    const parsed = EnvSchema.safeParse({
      ...validDevEnv,
      NODE_ENV: "test",
      APP_ENV: "test"
    });
    expect(parsed.success).toBe(true);
  });

  it("3. validates cost-optimized demo configuration with NODE_ENV=production and APP_ENV=demo", () => {
    const parsed = EnvSchema.safeParse(validDemoEnv);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.NODE_ENV).toBe("production");
      expect(parsed.data.APP_ENV).toBe("demo");
      expect(parsed.data.STORAGE_PROVIDER).toBe("memory");
      expect(parsed.data.PAYMENT_PROVIDER).toBe("sandbox");
      expect(parsed.data.EMAIL_PROVIDER).toBe("console");
    }
  });

  it("4. validates production configuration strictly", () => {
    const parsed = EnvSchema.safeParse(validProdEnv);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.STORAGE_PROVIDER).toBe("r2");
      expect(parsed.data.EMAIL_PROVIDER).toBe("zoho");
      expect(parsed.data.PAYMENT_PROVIDER).toBe("stripe");
    }
  });

  it("5. strictly rejects PAYMENT_PROVIDER=sandbox in production mode", () => {
    const parsed = EnvSchema.safeParse({
      ...validProdEnv,
      PAYMENT_PROVIDER: "sandbox"
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const msgs = parsed.error.issues.map((i) => i.message);
      expect(msgs.some((m) => m.includes("PAYMENT_PROVIDER cannot be 'sandbox' in production"))).toBe(true);
    }
  });

  it("6. rejects missing DATABASE_URL in demo and production", () => {
    const parsed = EnvSchema.safeParse({
      ...validDemoEnv,
      DATABASE_URL: "invalid-url"
    });
    expect(parsed.success).toBe(false);
  });

  it("7. rejects DATABASE_SSL=false in production", () => {
    const parsed = EnvSchema.safeParse({
      ...validProdEnv,
      DATABASE_SSL: "false"
    });
    expect(parsed.success).toBe(false);
  });

  it("8. rejects dev_ default secrets in demo environment", () => {
    const parsed = EnvSchema.safeParse({
      ...validDemoEnv,
      JWT_SECRET: "dev_jwt_secret_key_minimum_32_characters_long_for_security_12345"
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const msgs = parsed.error.issues.map((i) => i.message);
      expect(msgs.some((m) => m.includes("JWT_SECRET cannot use default dev secret in demo"))).toBe(true);
    }
  });

  it("9. rejects CORS_ORIGIN='*' in demo and production", () => {
    const demoParsed = EnvSchema.safeParse({
      ...validDemoEnv,
      CORS_ORIGIN: "*"
    });
    expect(demoParsed.success).toBe(false);

    const prodParsed = EnvSchema.safeParse({
      ...validProdEnv,
      CORS_ORIGIN: "*"
    });
    expect(prodParsed.success).toBe(false);
  });

  it("10. requires live R2 credentials when STORAGE_PROVIDER=r2 in production", () => {
    const parsed = EnvSchema.safeParse({
      ...validProdEnv,
      R2_ACCOUNT_ID: ""
    });
    expect(parsed.success).toBe(false);
  });
});
