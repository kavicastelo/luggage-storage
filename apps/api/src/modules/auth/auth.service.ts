import { eq, sql } from "drizzle-orm";
import {
  RegisterRequest,
  RegisterResponseData,
  LoginRequest,
  AuthenticatedUser,
  UserStatus,
  normalizeEmail
} from "@luggage-storage/contracts";
import { db, schema } from "../../infrastructure/database/drizzle.js";
import { AppError } from "../../common/errors/app-error.js";
import { argon2Service } from "./argon2.service.js";
import { sessionService } from "./session.service.js";

export interface ClientConnectionInfo {
  ip?: string;
  userAgent?: string;
}

export interface LoginServiceResult {
  user: AuthenticatedUser;
  session: typeof schema.authSessions.$inferSelect;
  rawRefreshToken: string;
}

export class AuthService {
  /**
   * Registers a new user account with default TRAVELLER role assignment.
   *
   * Security guarantees:
   * 1. Validates inputs and normalizes email (lower(trim(email))).
   * 2. Hashes password using Argon2id with OWASP parameters (never stores plaintext).
   * 3. Atomically inserts user and assigns TRAVELLER role via SECURITY DEFINER function
   *    in a single database transaction. Rolls back completely on any error.
   * 4. Ignores any client-supplied role assignment (e.g. SUPERADMIN).
   * 5. Safely catches unique constraint violations (23505) and returns generic conflict.
   * 6. Emits an immutable security audit event.
   * 7. Returns only public user fields; never exposes password hashes.
   */
  async register(
    input: RegisterRequest,
    clientInfo?: ClientConnectionInfo
  ): Promise<RegisterResponseData> {
    const rawEmail = input.email.trim();
    const normalized = normalizeEmail(rawEmail);

    // Hash password with Argon2id before entering the transaction
    const passwordHash = await argon2Service.hashPassword(input.password);

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

        // Record security audit event
        await tx.insert(schema.securityAuditEvents).values({
          userId: newUser.id,
          eventType: "AUTH_REGISTER_SUCCESS",
          ipAddress: clientInfo?.ip || null,
          userAgent: clientInfo?.userAgent || null,
          metadata: {
            email: normalized,
            role: "TRAVELLER"
          }
        });

        return newUser;
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
        throw AppError.conflict("An account with this email address already exists");
      }
      throw err;
    }
  }

  /**
   * Authenticates a user with email and password.
   *
   * Security guarantees:
   * 1. Normalizes email identically to registration.
   * 2. Retrieves account safely using runtime role privileges.
   * 3. Mitigates user enumeration timing attacks by executing a dummy Argon2id
   *    verification when an account does not exist.
   * 4. Returns identical generic 401 UNAUTHORIZED responses for non-existent users
   *    and invalid passwords.
   * 5. Enforces account status restrictions: blocks SUSPENDED and DEACTIVATED accounts.
   * 6. Records immutable security audit events for both successes and failures.
   * 7. Updates last_login_at timestamp on successful authentication.
   * 8. Returns authenticated user summary with active roles. Never returns password hashes.
   */
  async login(
    input: LoginRequest,
    clientInfo?: ClientConnectionInfo
  ): Promise<LoginServiceResult> {
    const normalized = normalizeEmail(input.email);

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

      // Record audit failure event
      try {
        await db.insert(schema.securityAuditEvents).values({
          userId: null,
          eventType: "AUTH_LOGIN_FAILURE",
          ipAddress: clientInfo?.ip || null,
          userAgent: clientInfo?.userAgent || null,
          metadata: {
            email: normalized,
            reason: "USER_NOT_FOUND"
          }
        });
      } catch {
        // Audit write failure must not disrupt generic auth error response
      }

      throw AppError.unauthorized("Invalid email or password");
    }

    // Verify password against stored Argon2id hash
    const isPasswordValid = await argon2Service.verifyPassword(
      user.passwordHash,
      input.password
    );

    if (!isPasswordValid) {
      try {
        await db.insert(schema.securityAuditEvents).values({
          userId: user.id,
          eventType: "AUTH_LOGIN_FAILURE",
          ipAddress: clientInfo?.ip || null,
          userAgent: clientInfo?.userAgent || null,
          metadata: {
            email: normalized,
            reason: "INVALID_PASSWORD"
          }
        });
      } catch {
        // Audit write failure must not disrupt generic auth error response
      }

      throw AppError.unauthorized("Invalid email or password");
    }

    // Check account status
    if (user.status === "SUSPENDED") {
      try {
        await db.insert(schema.securityAuditEvents).values({
          userId: user.id,
          eventType: "AUTH_LOGIN_FAILURE",
          ipAddress: clientInfo?.ip || null,
          userAgent: clientInfo?.userAgent || null,
          metadata: {
            email: normalized,
            reason: "ACCOUNT_SUSPENDED"
          }
        });
      } catch {
        // Continue
      }
      throw AppError.forbidden("Account is suspended");
    }

    if (user.status === "DEACTIVATED") {
      try {
        await db.insert(schema.securityAuditEvents).values({
          userId: user.id,
          eventType: "AUTH_LOGIN_FAILURE",
          ipAddress: clientInfo?.ip || null,
          userAgent: clientInfo?.userAgent || null,
          metadata: {
            email: normalized,
            reason: "ACCOUNT_DEACTIVATED"
          }
        });
      } catch {
        // Continue
      }
      throw AppError.forbidden("Account is deactivated");
    }

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
    try {
      await db.insert(schema.securityAuditEvents).values({
        userId: user.id,
        eventType: "AUTH_LOGIN_SUCCESS",
        ipAddress: clientInfo?.ip || null,
        userAgent: clientInfo?.userAgent || null,
        metadata: {
          email: normalized
        }
      });
    } catch {
      // Continue
    }

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
   * Retrieves current authenticated user details with active roles.
   * Ensures account is still active and valid.
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
