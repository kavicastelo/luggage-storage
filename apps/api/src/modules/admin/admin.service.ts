import { eq, sql, and, or, ilike, desc, inArray } from "drizzle-orm";
import {
  AdminUserQuery,
  AdminUserSummary,
  AdminUserDetail,
  AdminSuspendUserRequest,
  AdminReinstateUserRequest,
  AdminDeactivateUserRequest,
  AdminReactivateUserRequest,
  AdminVerifyEmailRequest,
  AdminLifecycleActionResponseData,
  UserStatus
} from "@luggage-storage/contracts";
import { db, schema } from "../../infrastructure/database/drizzle.js";
import { AppError } from "../../common/errors/app-error.js";
import { auditService, SecurityEventType } from "../audit/audit.service.js";

export interface AdminActionContext {
  adminId: string;
  adminRoles: string[];
  targetUserId: string;
  clientInfo?: {
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  };
}

export class AdminService {
  /**
   * Retrieves a paginated list of users with optional filtering by status, role, or search text.
   */
  async listUsers(
    query: AdminUserQuery
  ): Promise<{ users: AdminUserSummary[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (query.status) {
      conditions.push(eq(schema.users.status, query.status));
    }

    if (query.search) {
      const searchPattern = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.users.email, searchPattern),
          ilike(schema.users.displayName, searchPattern)
        )
      );
    }

    if (query.role) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM user_roles ur
          INNER JOIN roles r ON ur.role_id = r.id
          WHERE ur.user_id = ${schema.users.id} AND r.code = ${query.role.trim()}
        )`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count matching users
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.users)
      .where(whereClause);

    const total = countResult?.count ?? 0;

    if (total === 0) {
      return { users: [], total: 0 };
    }

    // Fetch paginated user records
    const userRows = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        displayName: schema.users.displayName,
        phoneNumber: schema.users.phoneNumber,
        status: schema.users.status,
        isEmailVerified: schema.users.isEmailVerified,
        isPhoneVerified: schema.users.isPhoneVerified,
        lastLoginAt: schema.users.lastLoginAt,
        createdAt: schema.users.createdAt,
        updatedAt: schema.users.updatedAt
      })
      .from(schema.users)
      .where(whereClause)
      .orderBy(desc(schema.users.createdAt))
      .limit(limit)
      .offset(offset);

    const userIds = userRows.map((u) => u.id);

    // Fetch roles for all fetched users in a single query
    const userRoleAssignments = await db
      .select({
        userId: schema.userRoles.userId,
        roleCode: schema.roles.code
      })
      .from(schema.userRoles)
      .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
      .where(inArray(schema.userRoles.userId, userIds));

    const roleMap = new Map<string, string[]>();
    for (const assignment of userRoleAssignments) {
      const existing = roleMap.get(assignment.userId) || [];
      existing.push(assignment.roleCode);
      roleMap.set(assignment.userId, existing);
    }

    const users: AdminUserSummary[] = userRows.map((u) => ({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      phoneNumber: u.phoneNumber,
      status: u.status as UserStatus,
      isEmailVerified: u.isEmailVerified,
      isPhoneVerified: u.isPhoneVerified,
      roles: roleMap.get(u.id) || [],
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString()
    }));

    return { users, total };
  }

  /**
   * Retrieves comprehensive inspection details for a specific user,
   * including profiles and active session counts. Never discloses password hashes.
   */
  async getUserById(userId: string): Promise<AdminUserDetail> {
    const [user] = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        normalizedEmail: schema.users.normalizedEmail,
        displayName: schema.users.displayName,
        phoneNumber: schema.users.phoneNumber,
        status: schema.users.status,
        isEmailVerified: schema.users.isEmailVerified,
        isPhoneVerified: schema.users.isPhoneVerified,
        lastLoginAt: schema.users.lastLoginAt,
        passwordChangedAt: schema.users.passwordChangedAt,
        createdAt: schema.users.createdAt,
        updatedAt: schema.users.updatedAt
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw AppError.notFound("User not found");
    }

    // Fetch user roles
    const userRoleAssignments = await db
      .select({
        roleCode: schema.roles.code
      })
      .from(schema.userRoles)
      .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
      .where(eq(schema.userRoles.userId, userId));

    const roles = userRoleAssignments.map((r) => r.roleCode);

    // Fetch active session count
    const [sessionCountRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.authSessions)
      .where(
        sql`user_id = ${userId} AND revoked_at IS NULL AND expires_at > NOW()`
      );
    const activeSessionCount = sessionCountRes?.count ?? 0;

    // Fetch traveller profile
    const [travellerProfileRow] = await db
      .select({
        id: schema.travellerProfiles.id,
        firstName: schema.travellerProfiles.firstName,
        lastName: schema.travellerProfiles.lastName,
        preferredLanguage: schema.travellerProfiles.preferredLanguage,
        preferredCurrency: schema.travellerProfiles.preferredCurrency,
        emergencyContactName: schema.travellerProfiles.emergencyContactName,
        emergencyContactPhone: schema.travellerProfiles.emergencyContactPhone
      })
      .from(schema.travellerProfiles)
      .where(eq(schema.travellerProfiles.userId, userId))
      .limit(1);

    // Fetch host profile
    const [hostProfileRow] = await db
      .select({
        id: schema.hostProfiles.id,
        displayName: schema.hostProfiles.displayName,
        contactEmail: schema.hostProfiles.contactEmail,
        contactPhone: schema.hostProfiles.contactPhone,
        hostType: schema.hostProfiles.hostType,
        status: schema.hostProfiles.status
      })
      .from(schema.hostProfiles)
      .where(eq(schema.hostProfiles.userId, userId))
      .limit(1);

    return {
      id: user.id,
      email: user.email,
      normalizedEmail: user.normalizedEmail,
      displayName: user.displayName,
      phoneNumber: user.phoneNumber,
      status: user.status as UserStatus,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      roles,
      activeSessionCount,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      passwordChangedAt: user.passwordChangedAt ? user.passwordChangedAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      travellerProfile: travellerProfileRow || null,
      hostProfile: hostProfileRow || null
    };
  }

  /**
   * Suspends a user account.
   *
   * Security & Integrity guarantees:
   * 1. Self-action defense: Administrators cannot suspend their own account.
   * 2. Privilege boundary: Support staff cannot suspend Superadmin accounts.
   * 3. State transition: Only ACTIVE or PENDING_VERIFICATION accounts can be suspended.
   * 4. Session invalidation: Atomically revokes all active authentication sessions.
   * 5. Immutability: Emits append-only AUTH_ACCOUNT_SUSPENDED audit event.
   */
  async suspendUser(
    context: AdminActionContext,
    input: AdminSuspendUserRequest
  ): Promise<AdminLifecycleActionResponseData> {
    if (context.adminId === context.targetUserId) {
      throw AppError.badRequest("Administrators cannot suspend their own account");
    }

    const targetUser = await this.getTargetUserWithRoles(context.targetUserId);

    if (
      targetUser.roles.includes("SUPERADMIN") &&
      !context.adminRoles.includes("SUPERADMIN")
    ) {
      throw AppError.forbidden("Support personnel cannot suspend Superadmin accounts");
    }

    if (targetUser.status === "SUSPENDED") {
      throw AppError.badRequest("User account is already suspended");
    }

    if (targetUser.status === "DEACTIVATED") {
      throw AppError.badRequest(
        "Cannot suspend a deactivated account. Reactivate the account first"
      );
    }

    const { updatedUser, revokedCount } = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(schema.users)
        .set({
          status: "SUSPENDED",
          updatedAt: new Date()
        })
        .where(eq(schema.users.id, context.targetUserId))
        .returning();

      // Revoke all active sessions immediately
      const revokedResult = await tx.execute(
        sql`UPDATE auth_sessions 
            SET revoked_at = NOW(), 
                revocation_reason = 'ADMIN_SUSPENSION', 
                updated_at = NOW() 
            WHERE user_id = ${context.targetUserId} AND revoked_at IS NULL 
            RETURNING id;`
      );

      const revokedSessions = revokedResult.rows.length;

      // Append immutable audit event
      await auditService.recordEvent({
        eventType: SecurityEventType.AUTH_ACCOUNT_SUSPENDED,
        userId: context.targetUserId,
        clientInfo: context.clientInfo,
        metadata: {
          adminId: context.adminId,
          reason: input.reason,
          previousStatus: targetUser.status,
          sessionsRevoked: revokedSessions
        },
        tx
      });

      return { updatedUser: updated, revokedCount: revokedSessions };
    });

    return {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        displayName: updatedUser.displayName,
        phoneNumber: updatedUser.phoneNumber,
        status: updatedUser.status as UserStatus,
        isEmailVerified: updatedUser.isEmailVerified,
        isPhoneVerified: updatedUser.isPhoneVerified,
        roles: targetUser.roles,
        lastLoginAt: updatedUser.lastLoginAt ? updatedUser.lastLoginAt.toISOString() : null,
        createdAt: updatedUser.createdAt.toISOString(),
        updatedAt: updatedUser.updatedAt.toISOString()
      },
      message: "User account suspended successfully",
      sessionsRevoked: revokedCount
    };
  }

  /**
   * Reinstates a suspended user account back to ACTIVE.
   *
   * Security & Integrity guarantees:
   * 1. Self-action defense: Administrators cannot perform lifecycle operations on their own account.
   * 2. State transition: Only accounts in SUSPENDED state can be reinstated.
   * 3. Session security: Previously revoked sessions remain revoked; user must re-authenticate.
   * 4. Immutability: Emits append-only AUTH_ACCOUNT_REINSTATED audit event.
   */
  async reinstateUser(
    context: AdminActionContext,
    input: AdminReinstateUserRequest
  ): Promise<AdminLifecycleActionResponseData> {
    if (context.adminId === context.targetUserId) {
      throw AppError.badRequest(
        "Administrators cannot perform lifecycle operations on their own account"
      );
    }

    const targetUser = await this.getTargetUserWithRoles(context.targetUserId);

    if (targetUser.status !== "SUSPENDED") {
      throw AppError.badRequest("Only suspended accounts can be reinstated");
    }

    const updatedUser = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(schema.users)
        .set({
          status: "ACTIVE",
          updatedAt: new Date()
        })
        .where(eq(schema.users.id, context.targetUserId))
        .returning();

      await auditService.recordEvent({
        eventType: SecurityEventType.AUTH_ACCOUNT_REINSTATED,
        userId: context.targetUserId,
        clientInfo: context.clientInfo,
        metadata: {
          adminId: context.adminId,
          reason: input.reason || null,
          previousStatus: "SUSPENDED"
        },
        tx
      });

      return updated;
    });

    return {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        displayName: updatedUser.displayName,
        phoneNumber: updatedUser.phoneNumber,
        status: updatedUser.status as UserStatus,
        isEmailVerified: updatedUser.isEmailVerified,
        isPhoneVerified: updatedUser.isPhoneVerified,
        roles: targetUser.roles,
        lastLoginAt: updatedUser.lastLoginAt ? updatedUser.lastLoginAt.toISOString() : null,
        createdAt: updatedUser.createdAt.toISOString(),
        updatedAt: updatedUser.updatedAt.toISOString()
      },
      message: "User account reinstated successfully"
    };
  }

  /**
   * Deactivates a user account.
   *
   * Security & Integrity guarantees:
   * 1. Self-action defense: Administrators cannot deactivate their own account.
   * 2. Privilege boundary: Support staff cannot deactivate Superadmin accounts.
   * 3. State transition: Only accounts that are not already DEACTIVATED can be deactivated.
   * 4. Session invalidation: Atomically revokes all active sessions.
   * 5. Immutability: Emits append-only AUTH_ACCOUNT_DEACTIVATED audit event.
   */
  async deactivateUser(
    context: AdminActionContext,
    input: AdminDeactivateUserRequest
  ): Promise<AdminLifecycleActionResponseData> {
    if (context.adminId === context.targetUserId) {
      throw AppError.badRequest("Administrators cannot deactivate their own account");
    }

    const targetUser = await this.getTargetUserWithRoles(context.targetUserId);

    if (
      targetUser.roles.includes("SUPERADMIN") &&
      !context.adminRoles.includes("SUPERADMIN")
    ) {
      throw AppError.forbidden("Support personnel cannot deactivate Superadmin accounts");
    }

    if (targetUser.status === "DEACTIVATED") {
      throw AppError.badRequest("User account is already deactivated");
    }

    const { updatedUser, revokedCount } = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(schema.users)
        .set({
          status: "DEACTIVATED",
          updatedAt: new Date()
        })
        .where(eq(schema.users.id, context.targetUserId))
        .returning();

      const revokedResult = await tx.execute(
        sql`UPDATE auth_sessions 
            SET revoked_at = NOW(), 
                revocation_reason = 'ADMIN_DEACTIVATION', 
                updated_at = NOW() 
            WHERE user_id = ${context.targetUserId} AND revoked_at IS NULL 
            RETURNING id;`
      );

      const revokedSessions = revokedResult.rows.length;

      await auditService.recordEvent({
        eventType: SecurityEventType.AUTH_ACCOUNT_DEACTIVATED,
        userId: context.targetUserId,
        clientInfo: context.clientInfo,
        metadata: {
          adminId: context.adminId,
          reason: input.reason,
          previousStatus: targetUser.status,
          sessionsRevoked: revokedSessions
        },
        tx
      });

      return { updatedUser: updated, revokedCount: revokedSessions };
    });

    return {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        displayName: updatedUser.displayName,
        phoneNumber: updatedUser.phoneNumber,
        status: updatedUser.status as UserStatus,
        isEmailVerified: updatedUser.isEmailVerified,
        isPhoneVerified: updatedUser.isPhoneVerified,
        roles: targetUser.roles,
        lastLoginAt: updatedUser.lastLoginAt ? updatedUser.lastLoginAt.toISOString() : null,
        createdAt: updatedUser.createdAt.toISOString(),
        updatedAt: updatedUser.updatedAt.toISOString()
      },
      message: "User account deactivated successfully",
      sessionsRevoked: revokedCount
    };
  }

  /**
   * Reactivates a deactivated user account back to ACTIVE.
   *
   * Security & Integrity guarantees:
   * 1. Self-action defense: Administrators cannot perform lifecycle operations on their own account.
   * 2. State transition: Only accounts in DEACTIVATED state can be reactivated.
   * 3. Session security: Previously revoked sessions remain revoked; user must re-authenticate.
   * 4. Immutability: Emits append-only AUTH_ACCOUNT_REACTIVATED audit event.
   */
  async reactivateUser(
    context: AdminActionContext,
    input: AdminReactivateUserRequest
  ): Promise<AdminLifecycleActionResponseData> {
    if (context.adminId === context.targetUserId) {
      throw AppError.badRequest(
        "Administrators cannot perform lifecycle operations on their own account"
      );
    }

    const targetUser = await this.getTargetUserWithRoles(context.targetUserId);

    if (targetUser.status !== "DEACTIVATED") {
      throw AppError.badRequest("Only deactivated accounts can be reactivated");
    }

    const updatedUser = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(schema.users)
        .set({
          status: "ACTIVE",
          updatedAt: new Date()
        })
        .where(eq(schema.users.id, context.targetUserId))
        .returning();

      await auditService.recordEvent({
        eventType: SecurityEventType.AUTH_ACCOUNT_REACTIVATED,
        userId: context.targetUserId,
        clientInfo: context.clientInfo,
        metadata: {
          adminId: context.adminId,
          reason: input.reason || null,
          previousStatus: "DEACTIVATED"
        },
        tx
      });

      return updated;
    });

    return {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        displayName: updatedUser.displayName,
        phoneNumber: updatedUser.phoneNumber,
        status: updatedUser.status as UserStatus,
        isEmailVerified: updatedUser.isEmailVerified,
        isPhoneVerified: updatedUser.isPhoneVerified,
        roles: targetUser.roles,
        lastLoginAt: updatedUser.lastLoginAt ? updatedUser.lastLoginAt.toISOString() : null,
        createdAt: updatedUser.createdAt.toISOString(),
        updatedAt: updatedUser.updatedAt.toISOString()
      },
      message: "User account reactivated successfully"
    };
  }

  /**
   * Overrides and verifies a user's email address by administrative action.
   * Automatically transitions PENDING_VERIFICATION accounts to ACTIVE.
   */
  async verifyUserEmail(
    context: AdminActionContext,
    input: AdminVerifyEmailRequest
  ): Promise<AdminLifecycleActionResponseData> {
    const targetUser = await this.getTargetUserWithRoles(context.targetUserId);

    if (targetUser.isEmailVerified) {
      throw AppError.badRequest("User email is already verified");
    }

    if (targetUser.status === "SUSPENDED" || targetUser.status === "DEACTIVATED") {
      throw AppError.badRequest(
        "Cannot verify email for a suspended or deactivated account"
      );
    }

    const newStatus =
      targetUser.status === "PENDING_VERIFICATION" ? "ACTIVE" : targetUser.status;
    const now = new Date();

    const updatedUser = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(schema.users)
        .set({
          isEmailVerified: true,
          emailVerifiedAt: now,
          status: newStatus,
          updatedAt: now
        })
        .where(eq(schema.users.id, context.targetUserId))
        .returning();

      await tx.execute(
        sql`UPDATE email_verification_tokens
            SET used_at = NOW()
            WHERE user_id = ${context.targetUserId} AND used_at IS NULL;`
      );

      await auditService.recordEvent({
        eventType: SecurityEventType.AUTH_EMAIL_VERIFIED_BY_ADMIN,
        userId: context.targetUserId,
        clientInfo: context.clientInfo,
        metadata: {
          adminId: context.adminId,
          reason: input.reason || null,
          previousStatus: targetUser.status,
          newStatus
        },
        tx
      });

      return updated;
    });

    return {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        displayName: updatedUser.displayName,
        phoneNumber: updatedUser.phoneNumber,
        status: updatedUser.status as UserStatus,
        isEmailVerified: updatedUser.isEmailVerified,
        isPhoneVerified: updatedUser.isPhoneVerified,
        roles: targetUser.roles,
        lastLoginAt: updatedUser.lastLoginAt ? updatedUser.lastLoginAt.toISOString() : null,
        createdAt: updatedUser.createdAt.toISOString(),
        updatedAt: updatedUser.updatedAt.toISOString()
      },
      message: "User email verified successfully by administrator"
    };
  }

  /**
   * Helper to retrieve target user record and active roles.
   */
  private async getTargetUserWithRoles(userId: string): Promise<{
    id: string;
    email: string;
    status: string;
    isEmailVerified: boolean;
    roles: string[];
  }> {
    const [user] = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        status: schema.users.status,
        isEmailVerified: schema.users.isEmailVerified
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw AppError.notFound("User not found");
    }

    const userRoleAssignments = await db
      .select({
        roleCode: schema.roles.code
      })
      .from(schema.userRoles)
      .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
      .where(eq(schema.userRoles.userId, userId));

    const roles = userRoleAssignments.map((r) => r.roleCode);

    return {
      id: user.id,
      email: user.email,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      roles
    };
  }
}

export const adminService = new AdminService();

