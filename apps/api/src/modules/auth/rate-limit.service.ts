import { createHmac } from "node:crypto";
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
  | "auth_verify_resend_ip"
  | "custody_verify_actor"
  | "custody_verify_booking"
  | "booking_create_user"
  | "payment_webhook_ip";

export interface RateLimitPolicy {
  maxPoints: number;
  windowSeconds: number;
}

/**
 * Single authoritative configuration for rate-limit policies (AUD-004):
 * - Login by IP: 20 per 15 minutes (900s)
 * - Login by normalized email: 5 per 15 minutes (900s)
 * - Registration by IP: 10 per 15 minutes (900s)
 * - Registration by normalized email: 5 per 1 hour (3600s)
 * - Verification resend by IP: 10 per 15 minutes (900s)
 * - Verification resend by email: 3 per 15 minutes (900s)
 * - Password recovery by IP: 10 per 15 minutes (900s)
 * - Password recovery by email: 3 per 15 minutes (900s)
 */
export const RATE_LIMIT_POLICIES: Record<RateLimitScope, RateLimitPolicy> = {
  auth_login_ip: {
    maxPoints: env.RATE_LIMIT_LOGIN_IP_MAX,
    windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS
  },
  auth_login_email: {
    maxPoints: env.RATE_LIMIT_LOGIN_MAX,
    windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS
  },
  auth_register_ip: {
    maxPoints: env.RATE_LIMIT_REGISTER_IP_MAX,
    windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS
  },
  auth_register_email: {
    maxPoints: env.RATE_LIMIT_REGISTER_MAX,
    windowSeconds: env.RATE_LIMIT_REGISTER_EMAIL_WINDOW_SECONDS
  },
  auth_verify_resend_ip: {
    maxPoints: env.RATE_LIMIT_VERIFY_RESEND_IP_MAX,
    windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS
  },
  auth_verify_resend_email: {
    maxPoints: env.RATE_LIMIT_VERIFICATION_RESEND_MAX,
    windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS
  },
  auth_recovery_ip: {
    maxPoints: env.RATE_LIMIT_RECOVERY_IP_MAX,
    windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS
  },
  auth_recovery_email: {
    maxPoints: env.RATE_LIMIT_RECOVERY_MAX,
    windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS
  },
  custody_verify_actor: {
    maxPoints: 20,
    windowSeconds: 300
  },
  custody_verify_booking: {
    maxPoints: 8,
    windowSeconds: 300
  },
  booking_create_user: {
    maxPoints: 30,
    windowSeconds: 300
  },
  payment_webhook_ip: {
    maxPoints: 120,
    windowSeconds: 60
  }
};

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
   * Computes a keyed HMAC-SHA-256 digest of (version + scope + normalized identifier)
   * using RATE_LIMIT_HASH_SECRET so raw emails and IP addresses are never stored
   * in the rate limit table and are protected against offline dictionary rainbow tables (AUD-004).
   */
  hashKey(scope: RateLimitScope, identifier: string, secretOverride?: string): string {
    const normalized = identifier.trim().toLowerCase();
    const secret = secretOverride ?? env.RATE_LIMIT_HASH_SECRET;
    return createHmac("sha256", secret).update(`v1:${scope}:${normalized}`).digest("hex");
  }

  getPolicy(scope: RateLimitScope): RateLimitPolicy {
    return RATE_LIMIT_POLICIES[scope];
  }

  /**
   * Atomically increments the rate-limit counter in PostgreSQL and returns whether the request is allowed.
   */
  async consume(params: RateLimitConsumeParams): Promise<RateLimitConsumeResult> {
    const defaultPolicy = this.getPolicy(params.scope);
    const maxPoints = params.maxPoints ?? defaultPolicy.maxPoints;
    const windowSeconds = params.windowSeconds ?? defaultPolicy.windowSeconds;
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
   * Consumes a point and throws 429 RATE_LIMITED (with Retry-After seconds) if the threshold is exceeded.
   */
  async enforce(params: RateLimitConsumeParams): Promise<RateLimitConsumeResult> {
    const result = await this.consume(params);
    if (!result.allowed) {
      throw AppError.rateLimited(
        params.message ?? "Too many requests. Please wait before trying again.",
        result.retryAfterSeconds
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
