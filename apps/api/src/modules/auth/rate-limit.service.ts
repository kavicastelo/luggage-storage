import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../../infrastructure/database/drizzle.js";
import { authRateLimits } from "../../infrastructure/database/schema/identity.js";
import { AppError } from "../../common/errors/app-error.js";
import { auditService, SecurityEventType } from "../audit/audit.service.js";
import { env } from "../../config/env.js";

export type RateLimitScope =
  | "auth_login_email"
  | "auth_login_ip"
  | "auth_register_email"
  | "auth_register_ip"
  | "auth_recovery_email"
  | "auth_recovery_ip"
  | "auth_verify_resend_email"
  | "auth_verify_resend_ip";

export interface RateLimitConsumeParams {
  scope: RateLimitScope;
  identifier: string;
  maxPoints?: number;
  windowSeconds?: number;
  message?: string;
  clientInfo?: {
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  };
}

export interface RateLimitConsumeResult {
  allowed: boolean;
  points: number;
  remaining: number;
  retryAfterSeconds: number;
}

export class RateLimitService {
  /**
   * Computes a privacy-preserving SHA-256 hash of (scope + normalized identifier)
   * so raw emails and IP addresses are never stored in the rate limit table.
   */
  hashKey(scope: RateLimitScope, identifier: string): string {
    const normalized = identifier.trim().toLowerCase();
    return createHash("sha256").update(`${scope}:${normalized}`).digest("hex");
  }

  private getDefaultMaxPoints(scope: RateLimitScope): number {
    switch (scope) {
      case "auth_login_email":
        return env.RATE_LIMIT_LOGIN_MAX;
      case "auth_register_email":
        return env.RATE_LIMIT_REGISTER_MAX;
      case "auth_recovery_email":
        return env.RATE_LIMIT_RECOVERY_MAX;
      case "auth_verify_resend_email":
        return env.RATE_LIMIT_VERIFICATION_RESEND_MAX;
      case "auth_login_ip":
      case "auth_register_ip":
      case "auth_recovery_ip":
      case "auth_verify_resend_ip":
        return env.RATE_LIMIT_IP_MAX;
    }
  }

  /**
   * Atomically increments the rate-limit counter in PostgreSQL and returns whether the request is allowed.
   */
  async consume(params: RateLimitConsumeParams): Promise<RateLimitConsumeResult> {
    const maxPoints = params.maxPoints ?? this.getDefaultMaxPoints(params.scope);
    const windowSeconds = params.windowSeconds ?? env.RATE_LIMIT_WINDOW_SECONDS;
    const keyHash = this.hashKey(params.scope, params.identifier);

    const res = await db.execute(sql`
      INSERT INTO auth_rate_limits (key_hash, scope, points, window_start, expires_at, updated_at)
      VALUES (
        ${keyHash},
        ${params.scope},
        1,
        NOW(),
        NOW() + (${windowSeconds} * INTERVAL '1 second'),
        NOW()
      )
      ON CONFLICT (key_hash) DO UPDATE
      SET
        points = CASE
          WHEN auth_rate_limits.expires_at <= NOW() THEN 1
          ELSE auth_rate_limits.points + 1
        END,
        window_start = CASE
          WHEN auth_rate_limits.expires_at <= NOW() THEN NOW()
          ELSE auth_rate_limits.window_start
        END,
        expires_at = CASE
          WHEN auth_rate_limits.expires_at <= NOW() THEN NOW() + (${windowSeconds} * INTERVAL '1 second')
          ELSE auth_rate_limits.expires_at
        END,
        updated_at = NOW()
      RETURNING
        points,
        GREATEST(1, CEIL(EXTRACT(EPOCH FROM (expires_at - NOW()))))::int AS retry_after_seconds;
    `);

    const row = res.rows[0] as { points: number; retry_after_seconds: number } | undefined;
    const points = Number(row?.points ?? 1);
    const retryAfterSeconds = Number(row?.retry_after_seconds ?? windowSeconds);
    const allowed = points <= maxPoints;

    if (!allowed) {
      await auditService.recordEvent({
        eventType: SecurityEventType.AUTH_RATE_LIMIT_EXCEEDED,
        userId: null,
        clientInfo: params.clientInfo,
        metadata: {
          scope: params.scope,
          keyHashPrefix: keyHash.slice(0, 12),
          points,
          maxPoints,
          retryAfterSeconds
        }
      });
    }

    return {
      allowed,
      points,
      remaining: Math.max(0, maxPoints - points),
      retryAfterSeconds
    };
  }

  /**
   * Consumes a point and throws 429 RATE_LIMITED if the threshold is exceeded.
   */
  async enforce(params: RateLimitConsumeParams): Promise<RateLimitConsumeResult> {
    const result = await this.consume(params);
    if (!result.allowed) {
      throw AppError.rateLimited(
        params.message ?? "Too many requests. Please wait before trying again."
      );
    }
    return result;
  }

  /**
   * Resets a specific rate-limit bucket (e.g. clearing failed login counter upon successful login).
   */
  async resetKey(scope: RateLimitScope, identifier: string): Promise<void> {
    const keyHash = this.hashKey(scope, identifier);
    await db.execute(sql`DELETE FROM auth_rate_limits WHERE key_hash = ${keyHash}`);
  }

  /**
   * Clears all rate limit buckets (used for deterministic test isolation).
   */
  async clearAll(): Promise<void> {
    await db.delete(authRateLimits);
  }
}

export const rateLimitService = new RateLimitService();
