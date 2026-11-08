import { eq, sql } from "drizzle-orm";
import { ClientType, SessionInfo } from "@luggage-storage/contracts";
import { db, schema } from "../../infrastructure/database/drizzle.js";
import { AppError } from "../../common/errors/app-error.js";
import { tokenService } from "./token.service.js";
import { auditService, SecurityEventType } from "../audit/audit.service.js";

export interface SessionClientInfo {
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

export class SessionService {
  /**
   * Creates a new persistent authentication session in auth_sessions.
   * Generates a 256-bit cryptographically random refresh token, stores its SHA-256
   * verifier hash, and returns the raw refresh token to be delivered to the client.
   */
  async createSession(params: {
    userId: string;
    clientType?: ClientType;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{
    session: typeof schema.authSessions.$inferSelect;
    rawRefreshToken: string;
  }> {
    const { rawToken, tokenHash } = tokenService.generateRefreshToken();
    const expiresAt = tokenService.calculateRefreshExpiry();
    const clientType = params.clientType || "WEB";

    const [session] = await db
      .insert(schema.authSessions)
      .values({
        userId: params.userId,
        refreshTokenHash: tokenHash,
        previousTokenHash: null,
        clientType,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        expiresAt,
        revokedAt: null,
        revocationReason: null
      })
      .returning();

    // Record session creation security audit event
    await auditService.recordEvent({
      eventType: SecurityEventType.AUTH_SESSION_CREATED,
      userId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: {
        sessionId: session.id,
        clientType
      }
    });

    return { session, rawRefreshToken: rawToken };
  }

  /**
   * Rotates a refresh token in a serialized database transaction with row-level locking.
   *
   * Security guarantees:
   * 1. Atomically locks the target session row (SELECT ... FOR UPDATE).
   * 2. If the current refresh_token_hash matches:
   *    - Verifies session is not revoked and not expired.
   *    - Verifies the user is active (not suspended/deactivated).
   *    - Rotates the token: generates new raw token, stores new hash in refresh_token_hash,
   *      and retains the consumed hash in previous_token_hash.
   *    - Updates last_active_at.
   * 3. If previous_token_hash matches:
   *    - REUSE ATTACK DETECTED!
   *    - Immediately revokes all active sessions for this user family.
   *    - Records an AUTH_TOKEN_REUSE_DETECTED audit event.
   *    - Rejects with generic 401 Unauthorized.
   * 4. Concurrent requests: Only the first request rotates the token; losing concurrent
   *    requests see the token in previous_token_hash and trigger reuse protection.
   */
  async rotateRefreshToken(params: {
    rawRefreshToken: string;
    clientInfo?: SessionClientInfo;
  }): Promise<{
    session: typeof schema.authSessions.$inferSelect;
    newRawRefreshToken: string;
    user: {
      id: string;
      email: string;
      displayName: string;
      status: string;
      isEmailVerified: boolean;
      isPhoneVerified: boolean;
      roles: string[];
    };
  }> {
    const incomingHash = tokenService.hashToken(params.rawRefreshToken);

    const txResult = await db.transaction(async (tx) => {
      // Lock and fetch session by either current or previous token hash
      const result = await tx.execute(
        sql`SELECT * FROM auth_sessions 
            WHERE refresh_token_hash = ${incomingHash} 
               OR previous_token_hash = ${incomingHash} 
            FOR UPDATE;`
      );

      if (result.rows.length === 0) {
        // Unknown token
        await auditService.recordEvent({
          eventType: SecurityEventType.AUTH_REFRESH_FAILURE,
          userId: null,
          clientInfo: params.clientInfo,
          metadata: { reason: "TOKEN_NOT_FOUND" },
          tx
        });
        throw AppError.unauthorized("Invalid or expired refresh token");
      }

      const rawRow = result.rows[0] as {
        id: string;
        user_id: string;
        refresh_token_hash: string;
        previous_token_hash: string | null;
        client_type: string;
        ip_address: string | null;
        user_agent: string | null;
        last_active_at: string | Date;
        expires_at: string | Date;
        revoked_at: string | Date | null;
        revocation_reason: string | null;
      };

      const sessionRow = {
        id: rawRow.id,
        userId: rawRow.user_id,
        refreshTokenHash: rawRow.refresh_token_hash,
        previousTokenHash: rawRow.previous_token_hash,
        clientType: rawRow.client_type,
        ipAddress: rawRow.ip_address,
        userAgent: rawRow.user_agent,
        lastActiveAt: new Date(rawRow.last_active_at),
        expiresAt: new Date(rawRow.expires_at),
        revokedAt: rawRow.revoked_at ? new Date(rawRow.revoked_at) : null,
        revocationReason: rawRow.revocation_reason
      };

      // REUSE DETECTION: presented token matches the previously consumed token
      if (sessionRow.previousTokenHash === incomingHash) {
        // Immediately revoke all sessions for this user family
        await tx.execute(
          sql`UPDATE auth_sessions 
              SET revoked_at = NOW(), 
                  revocation_reason = 'REUSE_DETECTED', 
                  updated_at = NOW() 
              WHERE id = ${sessionRow.id} OR user_id = ${sessionRow.userId};`
        );

        // Record security audit event
        await auditService.recordEvent({
          eventType: SecurityEventType.AUTH_TOKEN_REUSE_DETECTED,
          userId: sessionRow.userId,
          clientInfo: params.clientInfo,
          metadata: {
            sessionId: sessionRow.id,
            userId: sessionRow.userId,
            reason: "REFRESH_TOKEN_REUSE"
          },
          tx
        });

        return { action: "REUSE_DETECTED" as const };
      }

      // Check revocation
      if (sessionRow.revokedAt !== null) {
        return { action: "REVOKED" as const };
      }

      // Check expiry
      if (sessionRow.expiresAt < new Date()) {
        return { action: "EXPIRED" as const };
      }

      // Query user and account status
      const userResult = await tx
        .select({
          id: schema.users.id,
          email: schema.users.email,
          displayName: schema.users.displayName,
          status: schema.users.status,
          isEmailVerified: schema.users.isEmailVerified,
          isPhoneVerified: schema.users.isPhoneVerified
        })
        .from(schema.users)
        .where(eq(schema.users.id, sessionRow.userId))
        .limit(1);

      if (userResult.length === 0) {
        return { action: "USER_NOT_FOUND" as const };
      }

      const user = userResult[0];

      if (user.status === "SUSPENDED") {
        await tx.execute(
          sql`UPDATE auth_sessions 
              SET revoked_at = NOW(), revocation_reason = 'ACCOUNT_SUSPENDED' 
              WHERE id = ${sessionRow.id};`
        );
        return { action: "ACCOUNT_SUSPENDED" as const };
      }

      if (user.status === "DEACTIVATED") {
        await tx.execute(
          sql`UPDATE auth_sessions 
              SET revoked_at = NOW(), revocation_reason = 'ACCOUNT_DEACTIVATED' 
              WHERE id = ${sessionRow.id};`
        );
        return { action: "ACCOUNT_DEACTIVATED" as const };
      }

      if (user.status === "PENDING_VERIFICATION" || !user.isEmailVerified) {
        await tx.execute(
          sql`UPDATE auth_sessions 
              SET revoked_at = NOW(), revocation_reason = 'EMAIL_UNVERIFIED' 
              WHERE id = ${sessionRow.id};`
        );
        return { action: "EMAIL_UNVERIFIED" as const };
      }

      // Generate new refresh token
      const { rawToken: newRaw, tokenHash: newHash } = tokenService.generateRefreshToken();

      // Rotate token: update current hash and save consumed hash in previousTokenHash
      const [updatedSession] = await tx
        .update(schema.authSessions)
        .set({
          refreshTokenHash: newHash,
          previousTokenHash: incomingHash,
          lastActiveAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(schema.authSessions.id, sessionRow.id))
        .returning();

      // Query user roles
      const userRolesList = await tx
        .select({ code: schema.roles.code })
        .from(schema.userRoles)
        .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
        .where(eq(schema.userRoles.userId, user.id));

      const roleCodes = userRolesList.map((r) => r.code);

      // Record audit event
      await auditService.recordEvent({
        eventType: SecurityEventType.AUTH_TOKEN_ROTATED,
        userId: user.id,
        clientInfo: params.clientInfo,
        metadata: {
          sessionId: sessionRow.id
        },
        tx
      });

      return {
        action: "SUCCESS" as const,
        session: updatedSession,
        newRawRefreshToken: newRaw,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          status: user.status,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
          roles: roleCodes
        }
      };
    });

    if (txResult.action === "REUSE_DETECTED") {
      throw AppError.unauthorized("Invalid or expired refresh token");
    }
    if (txResult.action === "REVOKED") {
      throw AppError.unauthorized("Session has been revoked");
    }
    if (txResult.action === "EXPIRED") {
      throw AppError.unauthorized("Session has expired");
    }
    if (txResult.action === "USER_NOT_FOUND") {
      throw AppError.unauthorized("User account not found");
    }
    if (txResult.action === "ACCOUNT_SUSPENDED") {
      throw AppError.forbidden("Account is suspended");
    }
    if (txResult.action === "ACCOUNT_DEACTIVATED") {
      throw AppError.forbidden("Account is deactivated");
    }
    if (txResult.action === "EMAIL_UNVERIFIED") {
      throw AppError.forbidden("Account email verification is required before signing in");
    }

    return {
      session: txResult.session,
      newRawRefreshToken: txResult.newRawRefreshToken,
      user: txResult.user
    };
  }

  /**
   * Logs out the current session by setting revoked_at and revocation_reason = 'USER_LOGOUT'.
   * Handles logout idempotently.
   */
  async logout(params: {
    rawRefreshToken?: string;
    sessionId?: string;
    clientInfo?: SessionClientInfo;
  }): Promise<void> {
    let targetSessionId: string | null = params.sessionId || null;
    let userId: string | null = null;

    if (params.rawRefreshToken) {
      const hash = tokenService.hashToken(params.rawRefreshToken);
      const res = await db
        .select({ id: schema.authSessions.id, userId: schema.authSessions.userId })
        .from(schema.authSessions)
        .where(
          sql`refresh_token_hash = ${hash} OR previous_token_hash = ${hash}`
        )
        .limit(1);

      if (res.length > 0) {
        targetSessionId = res[0].id;
        userId = res[0].userId;
      }
    }

    if (targetSessionId) {
      await db
        .update(schema.authSessions)
        .set({
          revokedAt: new Date(),
          revocationReason: "USER_LOGOUT",
          updatedAt: new Date()
        })
        .where(
          sql`id = ${targetSessionId} AND revoked_at IS NULL`
        );

      await auditService.recordEvent({
        eventType: SecurityEventType.AUTH_LOGOUT,
        userId,
        clientInfo: params.clientInfo,
        metadata: {
          sessionId: targetSessionId
        }
      });
    }
  }

  /**
   * Logs out all sessions for the given user (e.g. "Logout from all devices").
   */
  async logoutAll(
    userId: string,
    clientInfo?: SessionClientInfo
  ): Promise<number> {
    const result = await db
      .update(schema.authSessions)
      .set({
        revokedAt: new Date(),
        revocationReason: "USER_LOGOUT_ALL",
        updatedAt: new Date()
      })
      .where(
        sql`user_id = ${userId} AND revoked_at IS NULL`
      )
      .returning({ id: schema.authSessions.id });

    await auditService.recordEvent({
      eventType: SecurityEventType.AUTH_LOGOUT_ALL,
      userId,
      clientInfo,
      metadata: {
        revokedCount: result.length
      }
    });

    return result.length;
  }

  /**
   * Returns all active, unrevoked, unexpired sessions for a user.
   */
  async getUserSessions(
    userId: string,
    currentSessionId?: string
  ): Promise<SessionInfo[]> {
    const rows = await db
      .select({
        id: schema.authSessions.id,
        clientType: schema.authSessions.clientType,
        ipAddress: schema.authSessions.ipAddress,
        userAgent: schema.authSessions.userAgent,
        lastActiveAt: schema.authSessions.lastActiveAt,
        createdAt: schema.authSessions.createdAt
      })
      .from(schema.authSessions)
      .where(
        sql`user_id = ${userId} AND revoked_at IS NULL AND expires_at > NOW()`
      )
      .orderBy(sql`last_active_at DESC`);

    return rows.map((r) => ({
      id: r.id,
      clientType: (r.clientType as "WEB" | "MOBILE" | "UNKNOWN") || "UNKNOWN",
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      lastActiveAt: r.lastActiveAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      isCurrentSession: r.id === currentSessionId
    }));
  }

  /**
   * Revokes a specific session belonging to the user.
   */
  async revokeUserSession(
    userId: string,
    sessionId: string,
    clientInfo?: SessionClientInfo
  ): Promise<void> {
    const result = await db
      .update(schema.authSessions)
      .set({
        revokedAt: new Date(),
        revocationReason: "USER_REVOKED_SESSION",
        updatedAt: new Date()
      })
      .where(
        sql`id = ${sessionId} AND user_id = ${userId} AND revoked_at IS NULL`
      )
      .returning({ id: schema.authSessions.id });

    if (result.length === 0) {
      throw AppError.notFound("Session not found or already revoked");
    }

    await auditService.recordEvent({
      eventType: SecurityEventType.AUTH_SESSION_REVOKED,
      userId,
      clientInfo,
      metadata: {
        sessionId
      }
    });
  }

  /**
   * Verifies that a session ID is currently active (unrevoked and unexpired).
   */
  async isSessionActive(sessionId: string): Promise<boolean> {
    const result = await db
      .select({ id: schema.authSessions.id })
      .from(schema.authSessions)
      .where(
        sql`id = ${sessionId} AND revoked_at IS NULL AND expires_at > NOW()`
      )
      .limit(1);

    return result.length > 0;
  }
}

export const sessionService = new SessionService();
