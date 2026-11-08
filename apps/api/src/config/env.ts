import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

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
    EMAIL_PROVIDER: z.enum(["noop", "console", "resend", "test"]).optional(),
    EMAIL_FROM_ADDRESS: z.string().email().default("no-reply@luggagestorage.lk"),
    RESEND_API_KEY: z.string().optional(),
    RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(900),
    RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(5),
    RATE_LIMIT_REGISTER_MAX: z.coerce.number().int().positive().default(10),
    RATE_LIMIT_RECOVERY_MAX: z.coerce.number().int().positive().default(5),
    RATE_LIMIT_VERIFICATION_RESEND_MAX: z.coerce.number().int().positive().default(5),
    RATE_LIMIT_IP_MAX: z.coerce.number().int().positive().default(2000)
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production") {
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
      if (data.DATABASE_SSL && !data.DATABASE_SSL_REJECT_UNAUTHORIZED) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "DATABASE_SSL_REJECT_UNAUTHORIZED cannot be false in production; trusted TLS certificate verification is mandatory",
          path: ["DATABASE_SSL_REJECT_UNAUTHORIZED"]
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

    if (data.EMAIL_PROVIDER === "resend" && (!data.RESEND_API_KEY || data.RESEND_API_KEY.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "RESEND_API_KEY is required when EMAIL_PROVIDER is set to 'resend'",
        path: ["RESEND_API_KEY"]
      });
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
    ...(config.DATABASE_SSL_CA ? { ca: config.DATABASE_SSL_CA } : {})
  };
}

export function parseAllowedCorsOrigins(corsOrigin: string): string[] {
  return corsOrigin
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

export function loadConfig(): EnvConfig {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    // Structured error logging before throwing
    const formatted = result.error.format();
    throw new Error(`Invalid environment configuration: ${JSON.stringify(formatted)}`);
  }
  return result.data;
}

export const env = loadConfig();
