import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

export const EnvSchema = z.object({
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
  DATABASE_SSL: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => {
      if (typeof val === "boolean") return val;
      if (typeof val === "string") return val.toLowerCase() === "true" || val === "1";
      return false;
    })
    .default(false),
  CORS_ORIGIN: z.string().default("*"),
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
  COOKIE_SECURE: z.coerce.boolean().optional()
}).superRefine((data, ctx) => {
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
  }
});

export type EnvConfig = z.infer<typeof EnvSchema>;

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
