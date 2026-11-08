import { eq, sql, asc } from "drizzle-orm";
import {
  Permission,
  RoleDetail
} from "@luggage-storage/contracts";
import { db, schema } from "../../infrastructure/database/drizzle.js";
import { AppError } from "../../common/errors/app-error.js";

export interface RoleManagementContext {
  adminId: string;
  adminRoles: string[];
  targetUserId: string;
  roleCode: string;
  clientInfo?: {
    ip?: string;
    userAgent?: string;
  };
}

export class RbacService {
  /**
   * Resolves all effective permissions for a user across all assigned roles.
   * Inactive, suspended, or deactivated accounts return an empty permission set.
   * Real-time PostgreSQL evaluation ensures zero stale cache window.
   */
  async getEffectivePermissions(userId: string): Promise<string[]> {
    const result = await db.execute<{ code: string }>(
      sql`SELECT DISTINCT p.code
          FROM permissions p
          INNER JOIN role_permissions rp ON p.id = rp.permission_id
          INNER JOIN user_roles ur ON rp.role_id = ur.role_id
          INNER JOIN users u ON ur.user_id = u.id
          WHERE ur.user_id = ${userId}
            AND u.status = 'ACTIVE'
          ORDER BY p.code ASC;`
    );

    return result.rows.map((r) => r.code);
  }

  /**
   * Evaluates whether a user possesses a specific permission.
   */
  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.getEffectivePermissions(userId);
    return permissions.includes(permission);
  }

  /**
   * Evaluates whether a user possesses at least one of the specified permissions.
   */
  async hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    const effective = await this.getEffectivePermissions(userId);
    return permissions.some((p) => effective.includes(p));
  }

  /**
   * Evaluates whether a user possesses all of the specified permissions.
   */
  async hasAllPermissions(userId: string, permissions: string[]): Promise<boolean> {
    const effective = await this.getEffectivePermissions(userId);
    return permissions.every((p) => effective.includes(p));
  }

  /**
   * Retrieves all assigned role codes for a user.
   */
  async getUserRoles(userId: string): Promise<string[]> {
    const rows = await db
      .select({ code: schema.roles.code })
      .from(schema.userRoles)
      .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
      .where(eq(schema.userRoles.userId, userId));

    return rows.map((r) => r.code);
  }

  /**
   * Lists all available permissions in the permission catalogue.
   */
  async listPermissions(): Promise<Permission[]> {
    const rows = await db
      .select({
        id: schema.permissions.id,
        code: schema.permissions.code,
        name: schema.permissions.name,
        description: schema.permissions.description,
        module: schema.permissions.module,
        createdAt: schema.permissions.createdAt
      })
      .from(schema.permissions)
      .orderBy(asc(schema.permissions.module), asc(schema.permissions.code));

    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      module: r.module,
      createdAt: r.createdAt.toISOString()
    }));
  }

  /**
   * Lists all system roles and their assigned permissions.
   */
  async listRoles(): Promise<RoleDetail[]> {
    const roleRows = await db
      .select({
        id: schema.roles.id,
        code: schema.roles.code,
        name: schema.roles.name,
        description: schema.roles.description,
        isSystem: schema.roles.isSystem,
        createdAt: schema.roles.createdAt,
        updatedAt: schema.roles.updatedAt
      })
      .from(schema.roles)
      .orderBy(asc(schema.roles.code));

    const rolePermRows = await db
      .select({
        roleId: schema.rolePermissions.roleId,
        permissionCode: schema.permissions.code
      })
      .from(schema.rolePermissions)
      .innerJoin(
        schema.permissions,
        eq(schema.rolePermissions.permissionId, schema.permissions.id)
      );

    const permMap = new Map<string, string[]>();
    for (const rp of rolePermRows) {
      const existing = permMap.get(rp.roleId) || [];
      existing.push(rp.permissionCode);
      permMap.set(rp.roleId, existing);
    }

    return roleRows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      permissions: (permMap.get(r.id) || []).sort(),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    }));
  }

  /**
   * Assigns a role to a user account.
   *
   * Security & Integrity guarantees:
   * 1. Self-action defense: Administrators cannot modify their own roles.
   * 2. Privilege boundary: Only Superadmins can assign SUPERADMIN or SUPPORT roles.
   * 3. Target verification: User must exist and cannot be deactivated.
   * 4. Controlled execution: Employs SECURITY DEFINER function assign_user_role().
   * 5. Immutable audit: Emits AUTH_ROLE_ASSIGNED event.
   */
  async assignRole(context: RoleManagementContext): Promise<string[]> {
    const normalizedRoleCode = context.roleCode.trim().toUpperCase();

    if (context.adminId === context.targetUserId) {
      throw AppError.badRequest("Administrators cannot modify roles on their own account");
    }

    // Verify target user exists and status
    const [targetUser] = await db
      .select({ id: schema.users.id, status: schema.users.status })
      .from(schema.users)
      .where(eq(schema.users.id, context.targetUserId))
      .limit(1);

    if (!targetUser) {
      throw AppError.notFound("User not found");
    }

    if (targetUser.status === "DEACTIVATED") {
      throw AppError.badRequest("Cannot assign roles to a deactivated account");
    }

    // Verify role exists
    const [role] = await db
      .select({ id: schema.roles.id, code: schema.roles.code })
      .from(schema.roles)
      .where(eq(schema.roles.code, normalizedRoleCode))
      .limit(1);

    if (!role) {
      throw AppError.notFound(`Role not found: ${normalizedRoleCode}`);
    }

    // Privilege boundary: Only SUPERADMIN can assign SUPERADMIN or SUPPORT
    if (
      ["SUPERADMIN", "SUPPORT"].includes(normalizedRoleCode) &&
      !context.adminRoles.includes("SUPERADMIN")
    ) {
      throw AppError.forbidden("Only Superadministrators can assign administrative roles");
    }

    // Execute role assignment via SECURITY DEFINER function
    await db.execute(
      sql`SELECT public.assign_user_role(
            ${context.targetUserId}::uuid,
            ${normalizedRoleCode}::varchar,
            ${context.adminId}::uuid
          );`
    );

    // Record immutable security audit event
    await db.insert(schema.securityAuditEvents).values({
      userId: context.targetUserId,
      eventType: "AUTH_ROLE_ASSIGNED",
      ipAddress: context.clientInfo?.ip || null,
      userAgent: context.clientInfo?.userAgent || null,
      metadata: {
        adminId: context.adminId,
        roleCode: normalizedRoleCode
      }
    });

    return this.getUserRoles(context.targetUserId);
  }

  /**
   * Revokes an assigned role from a user account.
   *
   * Security & Integrity guarantees:
   * 1. Self-action defense: Administrators cannot revoke roles from their own account.
   * 2. Privilege boundary: Only Superadmins can revoke the SUPERADMIN role.
   * 3. Invariant check: User must retain at least one role.
   * 4. Controlled execution: Employs SECURITY DEFINER function revoke_user_role().
   * 5. Immutable audit: Emits AUTH_ROLE_REVOKED event.
   */
  async revokeRole(context: RoleManagementContext): Promise<string[]> {
    const normalizedRoleCode = context.roleCode.trim().toUpperCase();

    if (context.adminId === context.targetUserId) {
      throw AppError.badRequest("Administrators cannot modify roles on their own account");
    }

    // Verify target user exists
    const [targetUser] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, context.targetUserId))
      .limit(1);

    if (!targetUser) {
      throw AppError.notFound("User not found");
    }

    // Verify current roles
    const currentRoles = await this.getUserRoles(context.targetUserId);
    if (!currentRoles.includes(normalizedRoleCode)) {
      throw AppError.badRequest(`User does not have role: ${normalizedRoleCode}`);
    }

    if (currentRoles.length <= 1) {
      throw AppError.badRequest("Cannot revoke the user's only remaining role");
    }

    // Privilege boundary: Only SUPERADMIN can revoke SUPERADMIN
    if (
      normalizedRoleCode === "SUPERADMIN" &&
      !context.adminRoles.includes("SUPERADMIN")
    ) {
      throw AppError.forbidden("Only Superadministrators can revoke Superadmin privileges");
    }

    // Execute role revocation via SECURITY DEFINER function
    await db.execute(
      sql`SELECT public.revoke_user_role(
            ${context.targetUserId}::uuid,
            ${normalizedRoleCode}::varchar
          );`
    );

    // Record immutable security audit event
    await db.insert(schema.securityAuditEvents).values({
      userId: context.targetUserId,
      eventType: "AUTH_ROLE_REVOKED",
      ipAddress: context.clientInfo?.ip || null,
      userAgent: context.clientInfo?.userAgent || null,
      metadata: {
        adminId: context.adminId,
        roleCode: normalizedRoleCode
      }
    });

    return this.getUserRoles(context.targetUserId);
  }
}

export const rbacService = new RbacService();

