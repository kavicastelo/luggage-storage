import { z } from "zod";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load workspace .env first, then fallback to monorepo root .env
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const booleanFlagSchema = (defaultValue: boolean) =>
  z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => {
      if (typeof val === "boolean") return val;
      if (typeof val === "string") {
        const lower = val.trim().toLowerCase();
        if (lower === "true" || lower === "1") return true;
        if (lower === "false" || lower === "0") return false;
      }
      return defaultValue;
    })
    .default(defaultValue);

export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    HOST: z.string().default("0.0.0.0"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    DATABASE_URL: z
      .string()
      .url()
      .default("postgresql://luggage_user:luggage_password@localhost:5432/luggage_storage_dev"),
    MIGRATION_DATABASE_URL: z
      .string()
      .url()
      .default("postgresql://luggage_migrator:migrator_password@localhost:5432/luggage_storage_dev"),
    DATABASE_MAX_CONNECTIONS: z.coerce.number().int().positive().default(10),
    DATABASE_SSL: booleanFlagSchema(false),
    DATABASE_SSL_REJECT_UNAUTHORIZED: booleanFlagSchema(true),
    DATABASE_SSL_CA: z.string().optional(),
    CORS_ORIGIN: z.string().default("http://localhost:5173,http://localhost:3000"),
    APP_PUBLIC_URL: z.string().url().default("http://localhost:5173"),
    API_PREFIX: z.string().default("/api/v1"),
    ARGON2_MEMORY_COST: z.coerce.number().int().positive().default(65536),
    ARGON2_TIME_COST: z.coerce.number().int().positive().default(3),
    ARGON2_PARALLELISM: z.coerce.number().int().positive().default(4),
    JWT_SECRET: z
      .string()
      .min(32, "JWT secret must be at least 32 characters long")
      .default("dev_jwt_secret_key_minimum_32_characters_long_for_security_12345"),
    JWT_ACCESS_EXPIRATION: z.string().default("15m"),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
    COOKIE_SECRET: z
      .string()
      .min(32, "Cookie secret must be at least 32 characters long")
      .default("dev_cookie_secret_key_minimum_32_characters_long_12345"),
    COOKIE_SECURE: z.coerce.boolean().optional(),
    EMAIL_PROVIDER: z.enum(["zoho", "resend", "console", "noop", "test"]).optional(),
    ZOHO_SMTP_HOST: z.string().optional(),
    ZOHO_SMTP_PORT: z.coerce.number().int().positive().max(65535).default(587),
    ZOHO_SMTP_SECURE: booleanFlagSchema(false),
    ZOHO_SMTP_REQUIRE_TLS: booleanFlagSchema(true),
    ZOHO_SMTP_USER: z.string().optional(),
    ZOHO_SMTP_PASSWORD: z.string().optional(),
    ZOHO_SMTP_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
    EMAIL_FROM_ADDRESS: z.string().email().default("no-reply@luggagestorage.lk"),
    EMAIL_FROM_NAME: z.string().min(1).default("Luggage Storage Marketplace"),
    RESEND_API_KEY: z.string().optional(),
    RATE_LIMIT_HASH_SECRET: z
      .string()
      .min(32, "RATE_LIMIT_HASH_SECRET must be at least 32 characters long")
      .default("dev_rate_limit_hmac_secret_key_minimum_32_characters_long_12345"),
    RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(900),
    RATE_LIMIT_REGISTER_EMAIL_WINDOW_SECONDS: z.coerce.number().int().positive().default(3600),
    RATE_LIMIT_LOGIN_IP_MAX: z.coerce.number().int().positive().default(20),
    RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(5),
    RATE_LIMIT_REGISTER_IP_MAX: z.coerce.number().int().positive().default(10),
    RATE_LIMIT_REGISTER_MAX: z.coerce.number().int().positive().default(5),
    RATE_LIMIT_VERIFY_RESEND_IP_MAX: z.coerce.number().int().positive().default(10),
    RATE_LIMIT_VERIFICATION_RESEND_MAX: z.coerce.number().int().positive().default(3),
    RATE_LIMIT_RECOVERY_IP_MAX: z.coerce.number().int().positive().default(10),
    RATE_LIMIT_RECOVERY_MAX: z.coerce.number().int().positive().default(3),
    STORAGE_PROVIDER: z.preprocess(
      (val) => (val === "" || val === undefined ? undefined : val),
      z.enum(["r2", "memory", "test"]).optional()
    ),
    R2_ACCOUNT_ID: z.preprocess((val) => (val === "" || val === undefined ? undefined : val), z.string().optional()),
    R2_ACCESS_KEY_ID: z.preprocess((val) => (val === "" || val === undefined ? undefined : val), z.string().optional()),
    R2_SECRET_ACCESS_KEY: z.preprocess((val) => (val === "" || val === undefined ? undefined : val), z.string().optional()),
    R2_BUCKET_NAME: z.preprocess((val) => (val === "" || val === undefined ? undefined : val), z.string().default("luggage-storage-dev")),
    R2_PUBLIC_URL: z.preprocess((val) => (val === "" || val === undefined ? undefined : val), z.string().optional()),
    R2_PRESIGNED_TTL_SECONDS: z.preprocess(
      (val) => (val === "" || val === undefined ? undefined : val),
      z.coerce.number().int().positive().default(900)
    ),
    PAYOUT_ENCRYPTION_KEY: z.preprocess(
      (val) => (typeof val === "string" ? val.trim() : val),
      z.string().min(32, "PAYOUT_ENCRYPTION_KEY must be at least 32 characters")
    ),
    PAYOUT_ENCRYPTION_KEY_PREVIOUS: z.preprocess(
      (val) => (val === "" || val === undefined ? undefined : typeof val === "string" ? val.trim() : val),
      z.string().min(32, "PAYOUT_ENCRYPTION_KEY_PREVIOUS must be at least 32 characters").optional()
    ),
    DB_IDENTITY_KEY_ID: z.preprocess(
      (val) => (val === "" || val === undefined ? undefined : typeof val === "string" ? val.trim() : val),
      z
        .string()
        .regex(/^[a-zA-Z0-9_-]{1,64}$/, "DB_IDENTITY_KEY_ID must match ^[a-zA-Z0-9_-]{1,64}$")
        .default("active")
    ),
    DB_IDENTITY_SECRET: z.preprocess(
      (val) => (typeof val === "string" ? val.trim() : val),
      z.string().min(32, "DB_IDENTITY_SECRET must be at least 32 characters")
    ),
    DB_IDENTITY_RETIRING_KEY_ID: z.preprocess(
      (val) => (val === "" || val === undefined ? undefined : typeof val === "string" ? val.trim() : val),
      z
        .string()
        .regex(/^[a-zA-Z0-9_-]{1,64}$/, "DB_IDENTITY_RETIRING_KEY_ID must match ^[a-zA-Z0-9_-]{1,64}$")
        .optional()
    ),
    DB_IDENTITY_RETIRING_SECRET: z.preprocess(
      (val) => (val === "" || val === undefined ? undefined : typeof val === "string" ? val.trim() : val),
      z.string().min(32, "DB_IDENTITY_RETIRING_SECRET must be at least 32 characters").optional()
    ),
    DB_IDENTITY_RETIRING_WINDOW_SECONDS: z.preprocess(
      (val) => (val === "" || val === undefined ? undefined : val),
      z.coerce.number().int().min(30).max(3600).default(300)
    ),
    PAYMENT_PROVIDER: z.preprocess(
      (val) => (val === "" || val === undefined ? undefined : val),
      z.enum(["sandbox", "payhere"]).default("sandbox")
    ),
    PAYMENT_WEBHOOK_SECRET: z.preprocess(
      (val) => (val === "" || val === undefined ? undefined : typeof val === "string" ? val.trim() : val),
      z
        .string()
        .min(32, "PAYMENT_WEBHOOK_SECRET must be at least 32 characters")
        .default("dev_payment_webhook_hmac_secret_minimum_32_characters_12345")
    ),
    PAYHERE_MERCHANT_ID: z.preprocess(
      (val) => (val === "" || val === undefined ? undefined : typeof val === "string" ? val.trim() : val),
      z.string().optional()
    ),
    PAYHERE_MERCHANT_SECRET: z.preprocess(
      (val) => (val === "" || val === undefined ? undefined : typeof val === "string" ? val.trim() : val),
      z.string().min(16, "PAYHERE_MERCHANT_SECRET must be at least 16 characters").optional()
    ),
    PAYHERE_SANDBOX_MODE: booleanFlagSchema(true),
    PAYHERE_NOTIFY_URL: z.preprocess(
      (val) => (val === "" || val === undefined ? undefined : typeof val === "string" ? val.trim() : val),
      z.string().optional()
    ),
    PAYHERE_RETURN_URL: z.preprocess(
      (val) => (val === "" || val === undefined ? undefined : typeof val === "string" ? val.trim() : val),
      z.string().optional()
    ),
    PAYHERE_CANCEL_URL: z.preprocess(
      (val) => (val === "" || val === undefined ? undefined : typeof val === "string" ? val.trim() : val),
      z.string().optional()
    ),
    CUSTODY_TOKEN_HMAC_SECRET: z.preprocess(
      (val) => (typeof val === "string" ? val.trim() : val),
      z.string().min(32, "CUSTODY_TOKEN_HMAC_SECRET must be at least 32 characters")
    )
  })
  .superRefine((data, ctx) => {
    // Universal security checks (all environments)
    if (
      data.CUSTODY_TOKEN_HMAC_SECRET === data.DB_IDENTITY_SECRET ||
      data.CUSTODY_TOKEN_HMAC_SECRET === data.DB_IDENTITY_RETIRING_SECRET ||
      data.CUSTODY_TOKEN_HMAC_SECRET === data.PAYMENT_WEBHOOK_SECRET ||
      data.CUSTODY_TOKEN_HMAC_SECRET === data.RATE_LIMIT_HASH_SECRET
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "CUSTODY_TOKEN_HMAC_SECRET must be cryptographically distinct from DB_IDENTITY_SECRET, PAYMENT_WEBHOOK_SECRET, and RATE_LIMIT_HASH_SECRET",
        path: ["CUSTODY_TOKEN_HMAC_SECRET"]
      });
    }
    if (data.DB_IDENTITY_SECRET === "dev_db_identity_secret_key_minimum_32_characters_12345") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DB_IDENTITY_SECRET matches a known compromised secret and is prohibited",
        path: ["DB_IDENTITY_SECRET"]
      });
    }
    if (data.DB_IDENTITY_RETIRING_SECRET === "dev_db_identity_secret_key_minimum_32_characters_12345") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DB_IDENTITY_RETIRING_SECRET matches a known compromised secret and is prohibited",
        path: ["DB_IDENTITY_RETIRING_SECRET"]
      });
    }
    if (Boolean(data.DB_IDENTITY_RETIRING_KEY_ID) !== Boolean(data.DB_IDENTITY_RETIRING_SECRET)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DB_IDENTITY_RETIRING_KEY_ID and DB_IDENTITY_RETIRING_SECRET must both be set when rotating keys",
        path: ["DB_IDENTITY_RETIRING_KEY_ID"]
      });
    }
    if (data.DB_IDENTITY_RETIRING_KEY_ID && data.DB_IDENTITY_RETIRING_KEY_ID === data.DB_IDENTITY_KEY_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DB_IDENTITY_RETIRING_KEY_ID must differ from active DB_IDENTITY_KEY_ID",
        path: ["DB_IDENTITY_RETIRING_KEY_ID"]
      });
    }

    if (data.NODE_ENV === "production") {
      if (data.STORAGE_PROVIDER !== "r2") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "STORAGE_PROVIDER must be 'r2' in production; ephemeral storage is prohibited",
          path: ["STORAGE_PROVIDER"]
        });
      }
      if (!data.R2_ACCOUNT_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "R2_ACCOUNT_ID is required in production",
          path: ["R2_ACCOUNT_ID"]
        });
      }
      if (!data.R2_ACCESS_KEY_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "R2_ACCESS_KEY_ID is required in production",
          path: ["R2_ACCESS_KEY_ID"]
        });
      }
      if (!data.R2_SECRET_ACCESS_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "R2_SECRET_ACCESS_KEY is required in production",
          path: ["R2_SECRET_ACCESS_KEY"]
        });
      }
      if (!data.R2_BUCKET_NAME) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "R2_BUCKET_NAME is required in production",
          path: ["R2_BUCKET_NAME"]
        });
      }
      if (data.PAYOUT_ENCRYPTION_KEY.startsWith("dev_")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "PAYOUT_ENCRYPTION_KEY cannot use default dev secret in production",
          path: ["PAYOUT_ENCRYPTION_KEY"]
        });
      }
      if (data.JWT_SECRET.startsWith("dev_")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "JWT_SECRET cannot use default dev secret in production",
          path: ["JWT_SECRET"]
        });
      }
      if (data.COOKIE_SECRET.startsWith("dev_")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "COOKIE_SECRET cannot use default dev secret in production",
          path: ["COOKIE_SECRET"]
        });
      }
      if (data.RATE_LIMIT_HASH_SECRET.startsWith("dev_")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "RATE_LIMIT_HASH_SECRET cannot use default dev secret in production",
          path: ["RATE_LIMIT_HASH_SECRET"]
        });
      }
      if (data.DB_IDENTITY_SECRET.startsWith("dev_")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "DB_IDENTITY_SECRET cannot use default dev secret in production",
          path: ["DB_IDENTITY_SECRET"]
        });
      }
      if (data.DB_IDENTITY_RETIRING_SECRET?.startsWith("dev_")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "DB_IDENTITY_RETIRING_SECRET cannot use default dev secret in production",
          path: ["DB_IDENTITY_RETIRING_SECRET"]
        });
      }
      if (data.PAYMENT_PROVIDER === "sandbox") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "PAYMENT_PROVIDER cannot be 'sandbox' in production; simulated payments are prohibited",
          path: ["PAYMENT_PROVIDER"]
        });
      }
      if (data.PAYMENT_WEBHOOK_SECRET.startsWith("dev_")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "PAYMENT_WEBHOOK_SECRET cannot use default dev secret in production",
          path: ["PAYMENT_WEBHOOK_SECRET"]
        });
      }
      if (
        /^(dev_|test_|ci_test_|example|placeholder|replace_|changeme)/i.test(
          data.CUSTODY_TOKEN_HMAC_SECRET
        ) ||
        /(placeholder|replace_with|changeme|example_secret|minimum_32_characters)/i.test(
          data.CUSTODY_TOKEN_HMAC_SECRET
        )
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "CUSTODY_TOKEN_HMAC_SECRET cannot use a development, test, example, or placeholder value in production",
          path: ["CUSTODY_TOKEN_HMAC_SECRET"]
        });
      }
      if (!data.DATABASE_SSL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "DATABASE_SSL must be true in production; unencrypted database transport is prohibited",
          path: ["DATABASE_SSL"]
        });
      }
      if (!data.DATABASE_SSL_REJECT_UNAUTHORIZED) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "DATABASE_SSL_REJECT_UNAUTHORIZED cannot be false in production; trusted TLS certificate verification is mandatory",
          path: ["DATABASE_SSL_REJECT_UNAUTHORIZED"]
        });
      }
      if (data.EMAIL_PROVIDER !== "zoho") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "EMAIL_PROVIDER must be set to 'zoho' in production; noop, console, and test adapters are prohibited",
          path: ["EMAIL_PROVIDER"]
        });
      }

      const rawOrigins = data.CORS_ORIGIN.split(",")
        .map((o) => o.trim())
        .filter(Boolean);
      if (rawOrigins.length === 0 || rawOrigins.includes("*")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "CORS_ORIGIN cannot be '*' or empty in production; explicit trusted origin URLs are required",
          path: ["CORS_ORIGIN"]
        });
      } else {
        for (const origin of rawOrigins) {
          try {
            const parsed = new URL(origin);
            if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Invalid CORS origin protocol for '${origin}'`,
                path: ["CORS_ORIGIN"]
              });
            }
          } catch {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Invalid CORS origin URL '${origin}'`,
              path: ["CORS_ORIGIN"]
            });
          }
        }
      }
    }

    if (data.EMAIL_PROVIDER === "zoho") {
      const host = data.ZOHO_SMTP_HOST?.trim() ?? "";
      if (!host || /^https?:\/\//i.test(host) || /\s/.test(host)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "ZOHO_SMTP_HOST must be a valid non-empty SMTP hostname when EMAIL_PROVIDER is 'zoho'",
          path: ["ZOHO_SMTP_HOST"]
        });
      }
      if (!data.ZOHO_SMTP_USER || data.ZOHO_SMTP_USER.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ZOHO_SMTP_USER is required when EMAIL_PROVIDER is 'zoho'",
          path: ["ZOHO_SMTP_USER"]
        });
      }
      if (!data.ZOHO_SMTP_PASSWORD || data.ZOHO_SMTP_PASSWORD.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ZOHO_SMTP_PASSWORD is required when EMAIL_PROVIDER is 'zoho'",
          path: ["ZOHO_SMTP_PASSWORD"]
        });
      }
      if (data.ZOHO_SMTP_PORT === 465 && !data.ZOHO_SMTP_SECURE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ZOHO_SMTP_SECURE must be true when using implicit TLS port 465",
          path: ["ZOHO_SMTP_SECURE"]
        });
      }
      if (data.ZOHO_SMTP_PORT === 587 && data.ZOHO_SMTP_SECURE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "ZOHO_SMTP_SECURE must be false on STARTTLS port 587 (with ZOHO_SMTP_REQUIRE_TLS=true)",
          path: ["ZOHO_SMTP_SECURE"]
        });
      }
      if (!data.ZOHO_SMTP_SECURE && !data.ZOHO_SMTP_REQUIRE_TLS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Insecure SMTP transport configuration: either ZOHO_SMTP_SECURE=true or ZOHO_SMTP_REQUIRE_TLS=true is required",
          path: ["ZOHO_SMTP_REQUIRE_TLS"]
        });
      }
    }

    if (
      data.EMAIL_PROVIDER === "resend" &&
      (!data.RESEND_API_KEY || data.RESEND_API_KEY.trim().length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "RESEND_API_KEY is required when EMAIL_PROVIDER is set to 'resend'",
        path: ["RESEND_API_KEY"]
      });
    }

    if (data.PAYMENT_PROVIDER === "payhere") {
      if (!data.PAYHERE_MERCHANT_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "PAYHERE_MERCHANT_ID is required when PAYMENT_PROVIDER is 'payhere'",
          path: ["PAYHERE_MERCHANT_ID"]
        });
      }
      if (!data.PAYHERE_MERCHANT_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "PAYHERE_MERCHANT_SECRET is required when PAYMENT_PROVIDER is 'payhere'",
          path: ["PAYHERE_MERCHANT_SECRET"]
        });
      }
      if (data.NODE_ENV === "production" && data.PAYHERE_SANDBOX_MODE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "PAYHERE_SANDBOX_MODE must be false in production",
          path: ["PAYHERE_SANDBOX_MODE"]
        });
      }
      if (!data.PAYHERE_NOTIFY_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "PAYHERE_NOTIFY_URL is required when PAYMENT_PROVIDER is 'payhere'",
          path: ["PAYHERE_NOTIFY_URL"]
        });
      }
      if (!data.PAYHERE_RETURN_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "PAYHERE_RETURN_URL is required when PAYMENT_PROVIDER is 'payhere'",
          path: ["PAYHERE_RETURN_URL"]
        });
      }
      if (!data.PAYHERE_CANCEL_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "PAYHERE_CANCEL_URL is required when PAYMENT_PROVIDER is 'payhere'",
          path: ["PAYHERE_CANCEL_URL"]
        });
      }
    }

    const payHereUrlEntries: Array<[key: "PAYHERE_NOTIFY_URL" | "PAYHERE_RETURN_URL" | "PAYHERE_CANCEL_URL", value: string | undefined]> = [
      ["PAYHERE_NOTIFY_URL", data.PAYHERE_NOTIFY_URL],
      ["PAYHERE_RETURN_URL", data.PAYHERE_RETURN_URL],
      ["PAYHERE_CANCEL_URL", data.PAYHERE_CANCEL_URL]
    ];
    for (const [key, rawUrl] of payHereUrlEntries) {
      if (!rawUrl) continue;
      if (rawUrl.includes("REPLACE_WITH")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${key} cannot use a placeholder template value`,
          path: [key]
        });
        continue;
      }
      let parsed: URL;
      try {
        parsed = new URL(rawUrl);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${key} must be a valid absolute URL`,
          path: [key]
        });
        continue;
      }
      if (parsed.username || parsed.password) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${key} must not contain embedded credentials`,
          path: [key]
        });
      }
      if (data.NODE_ENV === "production") {
        if (parsed.protocol !== "https:") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${key} must use https:// in production`,
            path: [key]
          });
        }
        const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
        const isPrivateOrLocal =
          host === "localhost" ||
          host.endsWith(".localhost") ||
          host.endsWith(".local") ||
          host.endsWith(".internal") ||
          host.endsWith(".test") ||
          host === "example.com" ||
          host.endsWith(".example.com") ||
          host === "example.org" ||
          host.endsWith(".example.org") ||
          host === "example.net" ||
          host.endsWith(".example.net") ||
          host === "0.0.0.0" ||
          host === "::" ||
          host === "::1" ||
          host.startsWith("fe80:") ||
          host.startsWith("fc") ||
          host.startsWith("fd") ||
          /^127\./.test(host) ||
          /^10\./.test(host) ||
          /^192\.168\./.test(host) ||
          /^169\.254\./.test(host) ||
          /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
          /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./.test(host) ||
          !host.includes(".");
        if (isPrivateOrLocal) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${key} must point to a public non-placeholder hostname in production`,
            path: [key]
          });
        }
      } else if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${key} must use https:// or http:// protocol`,
          path: [key]
        });
      }
    }
  });

export type EnvConfig = z.infer<typeof EnvSchema>;

export function buildDatabaseSslConfig(
  config: Pick<EnvConfig, "DATABASE_SSL" | "DATABASE_SSL_REJECT_UNAUTHORIZED" | "DATABASE_SSL_CA">
): false | { rejectUnauthorized: boolean; ca?: string } {
  if (!config.DATABASE_SSL) {
    return false;
  }
  return {
    rejectUnauthorized: config.DATABASE_SSL_REJECT_UNAUTHORIZED,
    ...(config.DATABASE_SSL_CA ? { ca: config.DATABASE_SSL_CA.replace(/\\n/g, "\n") } : {})
  };
}

export function parseAllowedCorsOrigins(corsOrigin: string): string[] {
  return corsOrigin
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

export function loadConfig(customEnv: Record<string, string | undefined> = process.env): EnvConfig {
  const result = EnvSchema.safeParse(customEnv);
  if (!result.success) {
    const formatted = result.error.format();
    throw new Error(`Invalid environment configuration: ${JSON.stringify(formatted)}`);
  }
  return result.data;
}

export const env = loadConfig();
