import crypto from "node:crypto";
import { eq, sql } from "drizzle-orm";
import {
  RegisterRequest,
  RegisterResponseData,
  LoginRequest,
  AuthenticatedUser,
  UserStatus,
  VerifyEmailRequest,
  VerifyEmailResponseData,
  ResendVerificationRequest,
  ResendVerificationResponseData,
  normalizeEmail
} from "@luggage-storage/contracts";
import { db, schema } from "../../infrastructure/database/drizzle.js";
import { AppError } from "../../common/errors/app-error.js";
import { argon2Service } from "./argon2.service.js";
import { sessionService } from "./session.service.js";
import { auditService, SecurityEventType } from "../audit/audit.service.js";
import { emailService } from "../email/email.service.js";
import { rateLimitService } from "./rate-limit.service.js";

export interface ClientConnectionInfo {
  ip?: string;
  userAgent?: string;
  correlationId?: string;
}

export interface LoginServiceResult {
  user: AuthenticatedUser;
  session: typeof schema.authSessions.$inferSelect;
  rawRefreshToken: string;
}

const VALID_ACCOUNT_STATE_TRANSITIONS: Record<UserStatus, readonly UserStatus[]> = {
  PENDING_VERIFICATION: ["ACTIVE", "SUSPENDED", "DEACTIVATED"],
  ACTIVE: ["ACTIVE", "SUSPENDED", "DEACTIVATED"],
  SUSPENDED: ["ACTIVE", "DEACTIVATED"],
  DEACTIVATED: ["ACTIVE"]
};

export function isValidAccountStateTransition(
  fromStatus: UserStatus,
  toStatus: UserStatus
): boolean {
  return VALID_ACCOUNT_STATE_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
}

export class AuthService {
  /**
   * Registers a new user account with default TRAVELLER role assignment and issues
   * a single-use SHA-256 hashed email verification token (24h TTL).
   */
  async register(
    input: RegisterRequest,
    clientInfo?: ClientConnectionInfo
  ): Promise<RegisterResponseData> {
    const rawEmail = input.email.trim();
    const normalized = normalizeEmail(rawEmail);

    if (clientInfo?.ip) {
      await rateLimitService.enforce({
        scope: "auth_register_ip",
        identifier: clientInfo.ip,
        message: "Too many registration attempts. Please try again later.",
        clientInfo
      });
    }
    await rateLimitService.enforce({
      scope: "auth_register_email",
      identifier: normalized,
      message: "Too many registration attempts for this email. Please try again later.",
      clientInfo
    });

    // Hash password with Argon2id before entering the transaction
    const passwordHash = await argon2Service.hashPassword(input.password);
    const rawVerificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenHash = crypto
      .createHash("sha256")
      .update(rawVerificationToken)
      .digest("hex");
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours TTL

    try {
      const createdUser = await db.transaction(async (tx) => {
        // Insert user record
        const [newUser] = await tx
          .insert(schema.users)
          .values({
            email: rawEmail,
            normalizedEmail: normalized,
            passwordHash,
            displayName: input.displayName.trim(),
            phoneNumber: input.phoneNumber ? input.phoneNumber.trim() : null,
            status: "PENDING_VERIFICATION",
            isEmailVerified: false,
            emailVerifiedAt: null,
            isPhoneVerified: false
          })
          .returning({
            id: schema.users.id,
            email: schema.users.email,
            displayName: schema.users.displayName,
            status: schema.users.status,
            isEmailVerified: schema.users.isEmailVerified,
            isPhoneVerified: schema.users.isPhoneVerified,
            createdAt: schema.users.createdAt
          });

        // Assign default TRAVELLER role via restricted database function
        await tx.execute(
          sql`SELECT public.assign_default_traveller_role(${newUser.id}::uuid)`
        );

        // Store SHA-256 hashed email verification token
        await tx.insert(schema.emailVerificationTokens).values({
          userId: newUser.id,
          tokenHash: verificationTokenHash,
          expiresAt: verificationExpiresAt,
          usedAt: null
        });

        // Record security audit event transactionally
        await auditService.recordEvent({
          eventType: SecurityEventType.AUTH_REGISTER_SUCCESS,
          userId: newUser.id,
          clientInfo,
          metadata: {
            email: normalized,
            role: "TRAVELLER"
          },
          tx
        });

        await auditService.recordEvent({
          eventType: SecurityEventType.AUTH_EMAIL_VERIFICATION_SENT,
          userId: newUser.id,
          clientInfo,
          metadata: {
            email: normalized,
            expiresAt: verificationExpiresAt.toISOString()
          },
          tx
        });

        return newUser;
      });

      // Dispatch verification email via EmailService adapter boundary
      await emailService.sendEmailVerificationEmail({
        to: createdUser.email,
        displayName: createdUser.displayName,
        verificationToken: rawVerificationToken,
        verificationUrl: `/verify-email?token=${rawVerificationToken}`
      });

      return {
        id: createdUser.id,
        email: createdUser.email,
        displayName: createdUser.displayName,
        status: createdUser.status as UserStatus,
        isEmailVerified: createdUser.isEmailVerified,
        isPhoneVerified: createdUser.isPhoneVerified,
        roles: ["TRAVELLER"],
        createdAt: createdUser.createdAt.toISOString()
      };
    } catch (err: unknown) {
      // PostgreSQL unique constraint violation (code 23505, wrapped in DrizzleQueryError)
      const isUniqueViolation =
        (err as { code?: string })?.code === "23505" ||
        (err as { cause?: { code?: string } })?.cause?.code === "23505" ||
        (err instanceof Error &&
          (err.message.includes("23505") ||
            err.message.includes("unique constraint") ||
            err.message.includes("users_normalized_email_unique")));

      if (isUniqueViolation) {
        await auditService.recordEvent({
          eventType: SecurityEventType.AUTH_REGISTER_FAILURE,
          clientInfo,
          metadata: {
            email: normalized,
            reason: "DUPLICATE_EMAIL"
          }
        });
        throw AppError.conflict("An account with this email address already exists");
      }
      throw err;
    }
  }

  /**
   * Authenticates a user with email and password.
   * Rejects PENDING_VERIFICATION / unverified accounts, SUSPENDED accounts, and DEACTIVATED accounts.
   */
  async login(
    input: LoginRequest,
    clientInfo?: ClientConnectionInfo
  ): Promise<LoginServiceResult> {
    const normalized = normalizeEmail(input.email);

    if (clientInfo?.ip) {
      await rateLimitService.enforce({
        scope: "auth_login_ip",
        identifier: clientInfo.ip,
        message: "Too many login attempts from this IP. Please try again later.",
        clientInfo
      });
    }

    // Look up user by normalized email
    const [user] = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        displayName: schema.users.displayName,
        passwordHash: schema.users.passwordHash,
        status: schema.users.status,
        isEmailVerified: schema.users.isEmailVerified,
        isPhoneVerified: schema.users.isPhoneVerified
      })
      .from(schema.users)
      .where(eq(schema.users.normalizedEmail, normalized))
      .limit(1);

    if (!user) {
      // Timing attack mitigation: run dummy Argon2id verification
      await argon2Service.verifyDummy(input.password);

      await auditService.recordEvent({
        eventType: SecurityEventType.AUTH_LOGIN_FAILURE,
        userId: null,
        clientInfo,
        metadata: {
          email: normalized,
          reason: "USER_NOT_FOUND"
        }
      });

      await rateLimitService.enforce({
        scope: "auth_login_email",
        identifier: normalized,
        message: "Too many failed login attempts. Please wait before trying again.",
        clientInfo
      });

      throw AppError.unauthorized("Invalid email or password");
    }

    // Verify password against stored Argon2id hash
    const isPasswordValid = await argon2Service.verifyPassword(
      user.passwordHash,
      input.password
    );

    if (!isPasswordValid) {
      await auditService.recordEvent({
        eventType: SecurityEventType.AUTH_LOGIN_FAILURE,
        userId: user.id,
        clientInfo,
        metadata: {
          email: normalized,
          reason: "INVALID_PASSWORD"
        }
      });

      await rateLimitService.enforce({
        scope: "auth_login_email",
        identifier: normalized,
        message: "Too many failed login attempts. Please wait before trying again.",
        clientInfo
      });

      throw AppError.unauthorized("Invalid email or password");
    }

    // Check account status restrictions
    if (user.status === "SUSPENDED") {
      await auditService.recordEvent({
        eventType: SecurityEventType.AUTH_LOGIN_FAILURE,
        userId: user.id,
        clientInfo,
        metadata: {
          email: normalized,
          reason: "ACCOUNT_SUSPENDED"
        }
      });
      throw AppError.forbidden("Account is suspended");
    }

    if (user.status === "DEACTIVATED") {
      await auditService.recordEvent({
        eventType: SecurityEventType.AUTH_LOGIN_FAILURE,
        userId: user.id,
        clientInfo,
        metadata: {
          email: normalized,
          reason: "ACCOUNT_DEACTIVATED"
        }
      });
      throw AppError.forbidden("Account is deactivated");
    }

    if (user.status === "PENDING_VERIFICATION" || !user.isEmailVerified) {
      await auditService.recordEvent({
        eventType: SecurityEventType.AUTH_LOGIN_FAILURE,
        userId: user.id,
        clientInfo,
        metadata: {
          email: normalized,
          reason: "ACCOUNT_PENDING_VERIFICATION"
        }
      });
      throw AppError.forbidden("Account email verification is required before signing in");
    }

    // Reset failed login counter for this email upon valid authentication
    await rateLimitService.resetKey("auth_login_email", normalized);

    // Retrieve active user roles
    const userRolesList = await db
      .select({ code: schema.roles.code })
      .from(schema.userRoles)
      .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
      .where(eq(schema.userRoles.userId, user.id));

    const roleCodes = userRolesList.map((r) => r.code);

    // Update last_login_at timestamp
    const now = new Date();
    await db
      .update(schema.users)
      .set({ lastLoginAt: now, updatedAt: now })
      .where(eq(schema.users.id, user.id));

    // Record login success audit event
    await auditService.recordEvent({
      eventType: SecurityEventType.AUTH_LOGIN_SUCCESS,
      userId: user.id,
      clientInfo,
      metadata: {
        email: normalized
      }
    });

    // Create persistent authentication session
    const { session, rawRefreshToken } = await sessionService.createSession({
      userId: user.id,
      clientType: input.clientType || "WEB",
      ipAddress: clientInfo?.ip,
      userAgent: clientInfo?.userAgent
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        status: user.status as UserStatus,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        roles: roleCodes,
        lastLoginAt: now.toISOString()
      },
      session,
      rawRefreshToken
    };
  }

  /**
   * Verifies a user's email address using a single-use SHA-256 hashed token,
   * transitioning PENDING_VERIFICATION -> ACTIVE atomically under row-level lock.
   */
  async verifyEmail(
    input: VerifyEmailRequest,
    clientInfo?: ClientConnectionInfo
  ): Promise<VerifyEmailResponseData> {
    const tokenHash = crypto
      .createHash("sha256")
      .update(input.token.trim())
      .digest("hex");

    const now = new Date();

    const txResult = await db.transaction(async (tx) => {
      const result = await tx.execute(
        sql`SELECT * FROM email_verification_tokens
            WHERE token_hash = ${tokenHash}
            FOR UPDATE;`
      );

      if (result.rows.length === 0) {
        await auditService.recordEvent({
          eventType: SecurityEventType.AUTH_EMAIL_VERIFICATION_FAILED,
          userId: null,
          clientInfo,
          metadata: { reason: "TOKEN_NOT_FOUND" },
          tx
        });
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
        await auditService.recordEvent({
          eventType: SecurityEventType.AUTH_EMAIL_VERIFICATION_FAILED,
          userId: tokenRow.userId,
          clientInfo,
          metadata: { reason: "TOKEN_ALREADY_USED" },
          tx
        });
        return { status: "TOKEN_ALREADY_USED" as const };
      }

      if (tokenRow.expiresAt < now) {
        await auditService.recordEvent({
          eventType: SecurityEventType.AUTH_EMAIL_VERIFICATION_FAILED,
          userId: tokenRow.userId,
          clientInfo,
          metadata: { reason: "TOKEN_EXPIRED" },
          tx
        });
        return { status: "TOKEN_EXPIRED" as const };
      }

      const userRes = await tx
        .select({
          id: schema.users.id,
          email: schema.users.email,
          status: schema.users.status,
          isEmailVerified: schema.users.isEmailVerified
        })
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

      const nextStatus: UserStatus =
        user.status === "PENDING_VERIFICATION" ? "ACTIVE" : (user.status as UserStatus);

      // 1. Mark token as consumed
      await tx
        .update(schema.emailVerificationTokens)
        .set({ usedAt: now })
        .where(eq(schema.emailVerificationTokens.id, tokenRow.id));

      // 2. Invalidate any other unused verification tokens for this user
      await tx.execute(
        sql`UPDATE email_verification_tokens
            SET used_at = NOW()
            WHERE user_id = ${tokenRow.userId}
              AND id != ${tokenRow.id}
              AND used_at IS NULL;`
      );

      // 3. Activate user and mark email verified
      const [updatedUser] = await tx
        .update(schema.users)
        .set({
          status: nextStatus,
          isEmailVerified: true,
          emailVerifiedAt: now,
          updatedAt: now
        })
        .where(eq(schema.users.id, tokenRow.userId))
        .returning({
          id: schema.users.id,
          email: schema.users.email,
          status: schema.users.status,
          isEmailVerified: schema.users.isEmailVerified,
          emailVerifiedAt: schema.users.emailVerifiedAt
        });

      // 4. Record audit event
      await auditService.recordEvent({
        eventType: SecurityEventType.AUTH_EMAIL_VERIFICATION_COMPLETED,
        userId: tokenRow.userId,
        clientInfo,
        metadata: {
          verificationTokenId: tokenRow.id,
          previousStatus: user.status,
          newStatus: nextStatus
        },
        tx
      });

      return {
        status: "SUCCESS" as const,
        user: updatedUser
      };
    });

    if (
      txResult.status === "INVALID_TOKEN" ||
      txResult.status === "TOKEN_ALREADY_USED" ||
      txResult.status === "TOKEN_EXPIRED" ||
      txResult.status === "USER_NOT_FOUND"
    ) {
      throw AppError.badRequest("Invalid or expired email verification token");
    }
    if (txResult.status === "ACCOUNT_SUSPENDED") {
      throw AppError.forbidden("Account is suspended");
    }
    if (txResult.status === "ACCOUNT_DEACTIVATED") {
      throw AppError.forbidden("Account is deactivated");
    }

    return {
      message: "Email verified successfully. Your account is now active.",
      user: {
        id: txResult.user.id,
        email: txResult.user.email,
        status: txResult.user.status as UserStatus,
        isEmailVerified: txResult.user.isEmailVerified,
        emailVerifiedAt: txResult.user.emailVerifiedAt?.toISOString() ?? now.toISOString()
      }
    };
  }

  /**
   * Resends a verification email for an unverified account (rate-limited and enumeration-safe).
   */
  async resendVerificationEmail(
    input: ResendVerificationRequest,
    clientInfo?: ClientConnectionInfo
  ): Promise<ResendVerificationResponseData> {
    const genericResponse: ResendVerificationResponseData = {
      message:
        "If an unverified account exists with that email address, a new verification link has been sent."
    };

    const normalized = normalizeEmail(input.email);

    if (clientInfo?.ip) {
      await rateLimitService.enforce({
        scope: "auth_verify_resend_ip",
        identifier: clientInfo.ip,
        message: "Too many verification email requests. Please try again later.",
        clientInfo
      });
    }
    await rateLimitService.enforce({
      scope: "auth_verify_resend_email",
      identifier: normalized,
      message: "Too many verification email requests. Please try again later.",
      clientInfo
    });

    const [user] = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        displayName: schema.users.displayName,
        status: schema.users.status,
        isEmailVerified: schema.users.isEmailVerified
      })
      .from(schema.users)
      .where(eq(schema.users.normalizedEmail, normalized))
      .limit(1);

    if (!user) {
      await argon2Service.verifyDummy("dummyPassword123!");
      await auditService.recordEvent({
        eventType: SecurityEventType.AUTH_EMAIL_VERIFICATION_RESENT,
        userId: null,
        clientInfo,
        metadata: {
          email: normalized,
          reason: "ACCOUNT_NOT_FOUND"
        }
      });
      return genericResponse;
    }

    if (
      user.isEmailVerified ||
      user.status === "SUSPENDED" ||
      user.status === "DEACTIVATED"
    ) {
      await auditService.recordEvent({
        eventType: SecurityEventType.AUTH_EMAIL_VERIFICATION_RESENT,
        userId: user.id,
        clientInfo,
        metadata: {
          reason: user.isEmailVerified ? "ALREADY_VERIFIED" : `ACCOUNT_${user.status}`
        }
      });
      return genericResponse;
    }

    const rawVerificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenHash = crypto
      .createHash("sha256")
      .update(rawVerificationToken)
      .digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.transaction(async (tx) => {
      await tx.execute(
        sql`UPDATE email_verification_tokens
            SET used_at = NOW()
            WHERE user_id = ${user.id} AND used_at IS NULL;`
      );

      await tx.insert(schema.emailVerificationTokens).values({
        userId: user.id,
        tokenHash: verificationTokenHash,
        expiresAt,
        usedAt: null
      });

      await auditService.recordEvent({
        eventType: SecurityEventType.AUTH_EMAIL_VERIFICATION_RESENT,
        userId: user.id,
        clientInfo,
        metadata: {
          expiresAt: expiresAt.toISOString()
        },
        tx
      });
    });

    await emailService.sendEmailVerificationEmail({
      to: user.email,
      displayName: user.displayName,
      verificationToken: rawVerificationToken,
      verificationUrl: `/verify-email?token=${rawVerificationToken}`
    });

    return genericResponse;
  }

  /**
   * Retrieves current authenticated user details with active roles.
   * Ensures account is still active and email-verified.
   */
  async getCurrentUser(userId: string): Promise<AuthenticatedUser> {
    const [user] = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        displayName: schema.users.displayName,
        status: schema.users.status,
        isEmailVerified: schema.users.isEmailVerified,
        isPhoneVerified: schema.users.isPhoneVerified,
        lastLoginAt: schema.users.lastLoginAt
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
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

    if (user.status === "PENDING_VERIFICATION" || !user.isEmailVerified) {
      throw AppError.forbidden("Account email verification is required before signing in");
    }

    const userRolesList = await db
      .select({ code: schema.roles.code })
      .from(schema.userRoles)
      .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
      .where(eq(schema.userRoles.userId, user.id));

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      status: user.status as UserStatus,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      roles: userRolesList.map((r) => r.code),
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null
    };
  }
}

export const authService = new AuthService();
