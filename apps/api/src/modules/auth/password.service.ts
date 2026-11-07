import crypto from "node:crypto";
import { eq, sql } from "drizzle-orm";
import {
  ChangePasswordRequest,
  ChangePasswordResponseData,
  ForgotPasswordRequest,
  ForgotPasswordResponseData,
  ResetPasswordRequest,
  ResetPasswordResponseData,
  normalizeEmail
} from "@luggage-storage/contracts";
import { db, schema } from "../../infrastructure/database/drizzle.js";
import { AppError } from "../../common/errors/app-error.js";
import { argon2Service } from "./argon2.service.js";
import { emailService } from "../email/email.service.js";

export interface ClientConnectionInfo {
  ip?: string;
  userAgent?: string;
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export class PasswordService {
  private emailRateLimits = new Map<string, RateLimitRecord>();

  /**
   * Clears in-memory rate limits (useful for test isolation).
   */
  clearRateLimits(): void {
    this.emailRateLimits.clear();
  }

  /**
   * Rate limits password reset requests to prevent flood abuse.
   * Window: 15 minutes, Max: 5 requests per normalized email.
   */
  private checkRateLimit(key: string): void {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const maxAttempts = 5;

    const record = this.emailRateLimits.get(key);
    if (!record || now > record.resetAt) {
      this.emailRateLimits.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    if (record.count >= maxAttempts) {
      throw AppError.rateLimited(
        "Too many password reset requests. Please try again later."
      );
    }

    record.count += 1;
  }

  /**
   * Authenticated password change.
   *
   * Security guarantees:
   * 1. Requires authenticated active user.
   * 2. Verifies current password against stored Argon2id hash.
   * 3. Enforces new password policy and rejects if equal to current password.
   * 4. Hashes new password with Argon2id (OWASP configuration).
   * 5. Atomically updates password and revokes all OTHER active sessions for this user.
   * 6. Preserves the caller's current session.
   * 7. Records immutable security audit events (never logging passwords).
   */
  async changePassword(params: {
    userId: string;
    currentSessionId: string;
    input: ChangePasswordRequest;
    clientInfo?: ClientConnectionInfo;
  }): Promise<ChangePasswordResponseData> {
    const [user] = await db
      .select({
        id: schema.users.id,
        passwordHash: schema.users.passwordHash,
        status: schema.users.status
      })
      .from(schema.users)
      .where(eq(schema.users.id, params.userId))
      .limit(1);

    if (!user) {
      throw AppError.unauthorized("User account not found");
    }

    if (user.status === "SUSPENDED") {
      throw AppError.forbidden("Account is suspended");
    }

    if (user.status === "DEACTIVATED") {
      throw AppError.forbidden("Account is deactivated");
    }

    // Verify current password
    const isCurrentValid = await argon2Service.verifyPassword(
      user.passwordHash,
      params.input.currentPassword
    );

    if (!isCurrentValid) {
      try {
        await db.insert(schema.securityAuditEvents).values({
          userId: user.id,
          eventType: "AUTH_PASSWORD_CHANGE_FAILURE",
          ipAddress: params.clientInfo?.ip || null,
          userAgent: params.clientInfo?.userAgent || null,
          metadata: {
            reason: "INVALID_CURRENT_PASSWORD"
          }
        });
      } catch {
        // Continue
      }
      throw AppError.badRequest("Current password is incorrect");
    }

    // Defense-in-depth: new password must not match current password
    if (params.input.currentPassword === params.input.newPassword) {
      throw AppError.badRequest("New password cannot be the same as current password");
    }

    // Hash new password with Argon2id
    const newHash = await argon2Service.hashPassword(params.input.newPassword);
    const now = new Date();

    // Atomic transaction: update password, revoke all other active sessions, record audit
    await db.transaction(async (tx) => {
      // 1. Update password on users table
      await tx
        .update(schema.users)
        .set({
          passwordHash: newHash,
          passwordChangedAt: now,
          updatedAt: now
        })
        .where(eq(schema.users.id, user.id));

      // 2. Revoke all OTHER active sessions for this user
      await tx.execute(
        sql`UPDATE auth_sessions 
            SET revoked_at = NOW(), 
                revocation_reason = 'PASSWORD_CHANGED', 
                updated_at = NOW() 
            WHERE user_id = ${user.id} 
              AND id != ${params.currentSessionId} 
              AND revoked_at IS NULL;`
      );

      // 3. Record audit event
      try {
        await tx.insert(schema.securityAuditEvents).values({
          userId: user.id,
          eventType: "AUTH_PASSWORD_CHANGE_SUCCESS",
          ipAddress: params.clientInfo?.ip || null,
          userAgent: params.clientInfo?.userAgent || null,
          metadata: {
            sessionId: params.currentSessionId
          }
        });
      } catch {
        // Continue
      }
    });

    return {
      message: "Password changed successfully. All other active sessions have been revoked."
    };
  }

  /**
   * Password recovery request (forgot password).
   *
   * Security guarantees:
   * 1. Strictly enumeration-resistant: returns identical public message whether account exists or not.
   * 2. Runs dummy Argon2id verification for non-existent accounts to equalize response latency.
   * 3. Suspended/deactivated accounts do not receive tokens, but return identical public response.
   * 4. Generates 256-bit cryptographically random token (`crypto.randomBytes(32)`).
   * 5. Stores only SHA-256 verifier hash in `password_reset_tokens`. Never logs raw token.
   * 6. Invalidates all previous unused tokens for the user.
   * 7. Enforces strict 1-hour expiration.
   * 8. Dispatches via provider-independent email boundary respecting OQ-019.
   */
  async requestPasswordReset(params: {
    input: ForgotPasswordRequest;
    clientInfo?: ClientConnectionInfo;
  }): Promise<ForgotPasswordResponseData> {
    const genericResponse: ForgotPasswordResponseData = {
      message: "If an account with that email address exists, a password reset link has been sent."
    };

    const normalized = normalizeEmail(params.input.email);

    // Apply abuse protection rate limiting
    this.checkRateLimit(`reset:${normalized}`);

    // Look up user by normalized email
    const [user] = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        displayName: schema.users.displayName,
        status: schema.users.status
      })
      .from(schema.users)
      .where(eq(schema.users.normalizedEmail, normalized))
      .limit(1);

    if (!user) {
      // Timing attack mitigation: run dummy Argon2id verification
      await argon2Service.verifyDummy("dummyPassword123!");

      try {
        await db.insert(schema.securityAuditEvents).values({
          userId: null,
          eventType: "AUTH_PASSWORD_RESET_REQUESTED",
          ipAddress: params.clientInfo?.ip || null,
          userAgent: params.clientInfo?.userAgent || null,
          metadata: {
            email: normalized,
            reason: "ACCOUNT_NOT_FOUND"
          }
        });
      } catch {
        // Continue
      }

      return genericResponse;
    }

    // Inactive account handling (enumeration resistant)
    if (user.status === "SUSPENDED" || user.status === "DEACTIVATED") {
      try {
        await db.insert(schema.securityAuditEvents).values({
          userId: user.id,
          eventType: "AUTH_PASSWORD_RESET_REQUESTED",
          ipAddress: params.clientInfo?.ip || null,
          userAgent: params.clientInfo?.userAgent || null,
          metadata: {
            reason: `ACCOUNT_${user.status}`
          }
        });
      } catch {
        // Continue
      }
      return genericResponse;
    }

    // Generate 256-bit cryptographically secure raw token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour TTL

    // Invalidate previous outstanding tokens and insert new token transactionally
    await db.transaction(async (tx) => {
      // Invalidate previous tokens
      await tx.execute(
        sql`UPDATE password_reset_tokens 
            SET used_at = NOW() 
            WHERE user_id = ${user.id} AND used_at IS NULL;`
      );

      // Insert new token
      await tx.insert(schema.passwordResetTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt,
        usedAt: null
      });

      // Record audit event (ZERO raw token leakage)
      try {
        await tx.insert(schema.securityAuditEvents).values({
          userId: user.id,
          eventType: "AUTH_PASSWORD_RESET_REQUESTED",
          ipAddress: params.clientInfo?.ip || null,
          userAgent: params.clientInfo?.userAgent || null,
          metadata: {
            expiresAt: expiresAt.toISOString()
          }
        });
      } catch {
        // Continue
      }
    });

    // Deliver via email boundary (respecting OQ-019)
    await emailService.sendPasswordResetEmail({
      to: user.email,
      displayName: user.displayName,
      resetToken: rawToken,
      resetUrl: `/auth/reset-password?token=${rawToken}`
    });

    return genericResponse;
  }

  /**
   * Password reset execution.
   *
   * Security guarantees:
   * 1. Looks up token by SHA-256 hash under row-level lock (FOR UPDATE).
   * 2. Prevents concurrent reuse / race condition double-spends.
   * 3. Strictly verifies token is unconsumed (`used_at IS NULL`) and not expired.
   * 4. Updates password hash with Argon2id.
   * 5. Atomically consumes token (`used_at = NOW()`).
   * 6. Supersedes any other outstanding recovery tokens for this user.
   * 7. Revokes ALL active sessions for this user across all devices.
   * 8. Records immutable audit event.
   */
  async resetPassword(params: {
    input: ResetPasswordRequest;
    clientInfo?: ClientConnectionInfo;
  }): Promise<ResetPasswordResponseData> {
    const tokenHash = crypto
      .createHash("sha256")
      .update(params.input.token)
      .digest("hex");

    const newHash = await argon2Service.hashPassword(params.input.newPassword);
    const now = new Date();

    const txResult = await db.transaction(async (tx) => {
      // Row-level lock on token to serialize concurrent requests
      const result = await tx.execute(
        sql`SELECT * FROM password_reset_tokens 
            WHERE token_hash = ${tokenHash} 
            FOR UPDATE;`
      );

      if (result.rows.length === 0) {
        try {
          await tx.insert(schema.securityAuditEvents).values({
            userId: null,
            eventType: "AUTH_PASSWORD_RESET_FAILURE",
            ipAddress: params.clientInfo?.ip || null,
            userAgent: params.clientInfo?.userAgent || null,
            metadata: { reason: "TOKEN_NOT_FOUND" }
          });
        } catch {
          // Continue
        }
        return { status: "INVALID_TOKEN" as const };
      }

      const rawRow = result.rows[0] as {
        id: string;
        user_id: string;
        token_hash: string;
        expires_at: string | Date;
        used_at: string | Date | null;
      };

      const tokenRow = {
        id: rawRow.id,
        userId: rawRow.user_id,
        expiresAt: new Date(rawRow.expires_at),
        usedAt: rawRow.used_at ? new Date(rawRow.used_at) : null
      };

      if (tokenRow.usedAt !== null) {
        try {
          await tx.insert(schema.securityAuditEvents).values({
            userId: tokenRow.userId,
            eventType: "AUTH_PASSWORD_RESET_FAILURE",
            ipAddress: params.clientInfo?.ip || null,
            userAgent: params.clientInfo?.userAgent || null,
            metadata: { reason: "TOKEN_ALREADY_USED" }
          });
        } catch {
          // Continue
        }
        return { status: "TOKEN_ALREADY_USED" as const };
      }

      if (tokenRow.expiresAt < now) {
        try {
          await tx.insert(schema.securityAuditEvents).values({
            userId: tokenRow.userId,
            eventType: "AUTH_PASSWORD_RESET_FAILURE",
            ipAddress: params.clientInfo?.ip || null,
            userAgent: params.clientInfo?.userAgent || null,
            metadata: { reason: "TOKEN_EXPIRED" }
          });
        } catch {
          // Continue
        }
        return { status: "TOKEN_EXPIRED" as const };
      }

      // Check user account status
      const userRes = await tx
        .select({ id: schema.users.id, status: schema.users.status })
        .from(schema.users)
        .where(eq(schema.users.id, tokenRow.userId))
        .limit(1);

      if (userRes.length === 0) {
        return { status: "USER_NOT_FOUND" as const };
      }

      const user = userRes[0];

      if (user.status === "SUSPENDED") {
        return { status: "ACCOUNT_SUSPENDED" as const };
      }

      if (user.status === "DEACTIVATED") {
        return { status: "ACCOUNT_DEACTIVATED" as const };
      }

      // 1. Mark token as consumed
      await tx
        .update(schema.passwordResetTokens)
        .set({ usedAt: now })
        .where(eq(schema.passwordResetTokens.id, tokenRow.id));

      // 2. Invalidate any other outstanding tokens for this user
      await tx.execute(
        sql`UPDATE password_reset_tokens 
            SET used_at = NOW() 
            WHERE user_id = ${tokenRow.userId} 
              AND id != ${tokenRow.id} 
              AND used_at IS NULL;`
      );

      // 3. Update password on users table
      await tx
        .update(schema.users)
        .set({
          passwordHash: newHash,
          passwordChangedAt: now,
          updatedAt: now
        })
        .where(eq(schema.users.id, tokenRow.userId));

      // 4. Revoke ALL active sessions for this user across all devices
      await tx.execute(
        sql`UPDATE auth_sessions 
            SET revoked_at = NOW(), 
                revocation_reason = 'PASSWORD_RESET', 
                updated_at = NOW() 
            WHERE user_id = ${tokenRow.userId} 
              AND revoked_at IS NULL;`
      );

      // 5. Record audit event
      try {
        await tx.insert(schema.securityAuditEvents).values({
          userId: tokenRow.userId,
          eventType: "AUTH_PASSWORD_RESET_COMPLETED",
          ipAddress: params.clientInfo?.ip || null,
          userAgent: params.clientInfo?.userAgent || null,
          metadata: {
            resetTokenId: tokenRow.id
          }
        });
      } catch {
        // Continue
      }

      return { status: "SUCCESS" as const };
    });

    if (txResult.status === "INVALID_TOKEN") {
      throw AppError.badRequest("Invalid or expired password reset token");
    }
    if (txResult.status === "TOKEN_ALREADY_USED") {
      throw AppError.badRequest("Invalid or expired password reset token");
    }
    if (txResult.status === "TOKEN_EXPIRED") {
      throw AppError.badRequest("Invalid or expired password reset token");
    }
    if (txResult.status === "USER_NOT_FOUND") {
      throw AppError.badRequest("Invalid or expired password reset token");
    }
    if (txResult.status === "ACCOUNT_SUSPENDED") {
      throw AppError.forbidden("Account is suspended");
    }
    if (txResult.status === "ACCOUNT_DEACTIVATED") {
      throw AppError.forbidden("Account is deactivated");
    }

    return {
      message: "Password has been reset successfully. All active sessions have been revoked."
    };
  }
}

export const passwordService = new PasswordService();
