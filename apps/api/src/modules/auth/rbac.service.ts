import { eq, sql, asc, and } from "drizzle-orm";
import {
  DEFAULT_ROLE_PERMISSIONS,
  Permission,
  RoleDetail,
  SYSTEM_PERMISSIONS
} from "@luggage-storage/contracts";
import { db, schema } from "../../infrastructure/database/drizzle.js";
import { AppError } from "../../common/errors/app-error.js";
import { auditService, SecurityEventType } from "../audit/audit.service.js";
import { createDatabaseIdentityAssertion } from "../../common/crypto/database-identity.js";

export interface RoleManagementContext {
  adminId: string;
  adminRoles: string[];
  targetUserId: string;
  roleCode: string;
  clientInfo?: {
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  };
}

/**
 * Concurrency-safe database check ensuring removing or disabling `excludedUserId`
 * will not leave zero ACTIVE SUPERADMIN accounts on the platform.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function assertAnotherActiveSuperadminRemains(
  tx: any,
  excludedUserId: string
): Promise<string[]> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(9051001);`);
  const activeAdmins = await tx.execute(sql`
    SELECT u.id
    FROM users u
    INNER JOIN user_roles ur ON ur.user_id = u.id
    INNER JOIN roles r ON r.id = ur.role_id
    WHERE r.code = 'SUPERADMIN'
      AND u.status = 'ACTIVE'
    ORDER BY u.id ASC
    FOR UPDATE OF u;
  `);
  const activeIds = (activeAdmins.rows as Array<{ id: string }>).map((row) => row.id);
  const remaining = activeIds.filter((id) => id !== excludedUserId);
  if (remaining.length === 0) {
    throw AppError.conflict("Cannot remove or disable the last active Superadmin account");
  }
  return activeIds;
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

    // Generate cryptographically signed database identity assertion
    const assertion = createDatabaseIdentityAssertion({
      actorId: context.adminId,
      action: "ASSIGN_ROLE",
      targetId: context.targetUserId,
      roleCode: normalizedRoleCode
    });

    // Execute role assignment via SECURITY DEFINER function inside transaction setting session actor
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT set_config('app.current_user_id', ${context.adminId}, true);`
      );
      await tx.execute(
        sql`SELECT public.assign_user_role(
              ${context.targetUserId}::uuid,
              ${normalizedRoleCode}::varchar,
              ${JSON.stringify(assertion)}::jsonb
            );`
      );
    });

    // Record immutable security audit event
    await auditService.recordEvent({
      eventType: SecurityEventType.AUTH_ROLE_ASSIGNED,
      userId: context.targetUserId,
      clientInfo: context.clientInfo,
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

    // Generate cryptographically signed database identity assertion
    const assertion = createDatabaseIdentityAssertion({
      actorId: context.adminId,
      action: "REVOKE_ROLE",
      targetId: context.targetUserId,
      roleCode: normalizedRoleCode
    });

    // Execute role revocation via SECURITY DEFINER function inside transaction setting session actor
    await db.transaction(async (tx) => {
      if (normalizedRoleCode === "SUPERADMIN") {
        const activeIds = await assertAnotherActiveSuperadminRemains(tx, context.targetUserId);
        if (!activeIds.includes(context.adminId)) {
          throw AppError.forbidden("Only Superadministrators can revoke Superadmin privileges");
        }
      }
      await tx.execute(
        sql`SELECT set_config('app.current_user_id', ${context.adminId}, true);`
      );
      await tx.execute(
        sql`SELECT public.revoke_user_role(
              ${context.targetUserId}::uuid,
              ${normalizedRoleCode}::varchar,
              ${JSON.stringify(assertion)}::jsonb
            );`
      );
    });

    // Record immutable security audit event
    await auditService.recordEvent({
      eventType: SecurityEventType.AUTH_ROLE_REVOKED,
      userId: context.targetUserId,
      clientInfo: context.clientInfo,
      metadata: {
        adminId: context.adminId,
        roleCode: normalizedRoleCode
      }
    });

    return this.getUserRoles(context.targetUserId);
  }

  /**
   * Idempotently seeds and self-heals all catalogue permissions and default role-permission mappings.
   * Can be safely executed on server boot, seeding, or migration recovery.
   */
  async ensureDefaultRolePermissions(targetDb?: any): Promise<{ permissionsCount: number; mappingsCount: number }> {
    const dbClient = targetDb ?? db;
    const PERMISSION_METADATA: Record<string, { name: string; description: string; module: string }> = {
      "identity.profile.read": { name: "Read Own Profile", description: "View own profile and account details", module: "identity" },
      "identity.profile.update": { name: "Update Own Profile", description: "Update own profile and display name", module: "identity" },
      "identity.session.read_own": { name: "Read Own Sessions", description: "View own active sessions and devices", module: "identity" },
      "identity.session.revoke_own": { name: "Revoke Own Session", description: "Revoke own active authentication sessions", module: "identity" },
      "identity.password.change": { name: "Change Own Password", description: "Change own account password", module: "identity" },

      "admin.user.read": { name: "Read Users", description: "View and search user accounts and profiles", module: "admin" },
      "admin.user.suspend": { name: "Suspend User", description: "Suspend user accounts and revoke sessions", module: "admin" },
      "admin.user.reinstate": { name: "Reinstate User", description: "Reinstate suspended user accounts", module: "admin" },
      "admin.user.deactivate": { name: "Deactivate User", description: "Deactivate user accounts and revoke sessions", module: "admin" },
      "admin.user.reactivate": { name: "Reactivate User", description: "Reactivate deactivated user accounts", module: "admin" },
      "admin.user.verify_email": { name: "Verify User Email", description: "Administratively verify user email", module: "admin" },

      "admin.session.read_any": { name: "Read Any Session", description: "Inspect active sessions of any user", module: "admin" },
      "admin.session.revoke_any": { name: "Revoke Any Session", description: "Administratively terminate sessions of any user", module: "admin" },

      "admin.role.read": { name: "Read Roles", description: "View system roles and permission mappings", module: "admin" },
      "admin.role.assign": { name: "Assign Roles", description: "Assign system roles to user accounts", module: "admin" },
      "admin.role.revoke": { name: "Revoke Roles", description: "Revoke assigned system roles from user accounts", module: "admin" },
      "admin.permission.read": { name: "Read Permissions", description: "View permission catalogue and role mappings", module: "admin" },

      "admin.audit.read": { name: "Read Audit Logs", description: "Inspect immutable security audit event logs", module: "admin" },
      "admin.platform.manage": { name: "Platform Governance", description: "Full platform governance and security policies", module: "admin" },
      "admin.kyc.manage": { name: "KYC Management", description: "Review and approve host business verifications", module: "admin" },
      "admin.financial.manage": { name: "Financial Management", description: "Manage commissions, payouts, and financial ledgers", module: "admin" },

      "support.ticket.read": { name: "Read Support Tickets", description: "View customer support tickets and inquiries", module: "support" },
      "support.ticket.update": { name: "Update Support Tickets", description: "Respond to and update support tickets", module: "support" },

      "hosts.business.create": { name: "Create Host Business", description: "Register new host business entities", module: "hosts" },
      "hosts.business.read_own": { name: "Read Own Host Business", description: "View own host business profiles and verifications", module: "hosts" },
      "hosts.business.update_own": { name: "Update Own Host Business", description: "Update own host business profile and bank details", module: "hosts" },
      "hosts.staff.read_own": { name: "Read Own Staff", description: "View staff team members across owned hubs", module: "hosts" },
      "hosts.staff.manage_own": { name: "Manage Own Staff", description: "Invite, update, and remove staff memberships", module: "hosts" },
      "hosts.verification.submit": { name: "Submit Verification", description: "Submit business KYC documents for moderation", module: "hosts" },
      "hosts.verification.read_own": { name: "Read Own Verification", description: "View status of KYC business verifications", module: "hosts" },
      "hosts.location.create": { name: "Create Location", description: "Create new storage hub locations", module: "hosts" },
      "hosts.location.read_own": { name: "Read Own Locations", description: "View own storage hub locations and zones", module: "hosts" },
      "hosts.location.update_own": { name: "Update Own Location", description: "Update storage hub profile and attributes", module: "hosts" },
      "hosts.location.submit": { name: "Submit Location", description: "Submit storage hub for public listing moderation", module: "hosts" },
      "hosts.location.disable": { name: "Disable Location", description: "Disable storage hub from public search", module: "hosts" },
      "hosts.location.configure": { name: "Configure Location", description: "Configure hub schedules, capacity pools, and pricing", module: "hosts" },

      "admin.host.read": { name: "Read Host Directory", description: "Inspect all host partner businesses", module: "admin" },
      "admin.host.verify": { name: "Verify Host Businesses", description: "Approve or reject host verification KYC submissions", module: "admin" },
      "admin.location.read": { name: "Read All Locations", description: "Inspect all storage hub locations across the platform", module: "admin" },
      "admin.location.moderate": { name: "Moderate Locations", description: "Approve, reject, or suspend storage hub listings", module: "admin" },

      "upload.initiate": { name: "Initiate Upload", description: "Request signed pre-authenticated image upload URLs", module: "uploads" },

      "bookings.create": { name: "Create Booking", description: "Reserve luggage storage and request payment intents", module: "bookings" },
      "bookings.read_own": { name: "Read Own Bookings", description: "View own traveller bookings and custody passes", module: "bookings" },
      "bookings.cancel_own": { name: "Cancel Own Booking", description: "Cancel own booking and request eligible refund", module: "bookings" },

      "hosts.bookings.read_own": { name: "Read Host Bookings", description: "View reservations and queue for owned locations", module: "hosts" },
      "hosts.bookings.manage_own": { name: "Manage Host Bookings", description: "Accept, reject, or cancel incoming reservations", module: "hosts" },
      "hosts.custody.operate": { name: "Operate Custody", description: "Verify custody passes, check in bags, and release luggage", module: "custody" },
      "hosts.finance.read_own": { name: "Read Host Finance", description: "View earnings, payouts, and settlement summaries", module: "hosts" },

      "admin.booking.read": { name: "Read All Bookings", description: "Inspect all global platform bookings", module: "admin" },
      "admin.booking.manage": { name: "Manage Platform Bookings", description: "Override or administratively cancel any booking", module: "admin" },
      "admin.payment.read": { name: "Read Payments", description: "Inspect transactions, intents, and webhook logs", module: "admin" },
      "admin.refund.read": { name: "Read Refunds", description: "View customer refund requests and processing status", module: "admin" },
      "admin.refund.manage": { name: "Manage Refunds", description: "Authorize and process customer payment refunds", module: "admin" }
    };

    // 1. Ensure all system permissions exist in the permissions table
    for (const [code, meta] of Object.entries(PERMISSION_METADATA)) {
      await dbClient.execute(sql`
        INSERT INTO permissions (code, name, description, module)
        VALUES (${code}, ${meta.name}, ${meta.description}, ${meta.module})
        ON CONFLICT (code) DO UPDATE
        SET name = EXCLUDED.name,
            description = EXCLUDED.description,
            module = EXCLUDED.module;
      `);
    }

    // 2. Fetch all permissions and roles
    const allPerms = await dbClient.select({ id: schema.permissions.id, code: schema.permissions.code }).from(schema.permissions);
    const permMap = new Map<string, string>();
    for (const p of allPerms) {
      permMap.set(p.code, p.id);
    }

    const allRoles = await dbClient.select({ id: schema.roles.id, code: schema.roles.code }).from(schema.roles);
    const roleMap = new Map<string, string>();
    for (const r of allRoles) {
      roleMap.set(r.code, r.id);
    }

    let mappingsCount = 0;

    // 3. Ensure role-permission mappings for each system role
    for (const [roleCode, permCodes] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      const roleId = roleMap.get(roleCode);
      if (!roleId) continue;

      for (const pCode of permCodes) {
        const permId = permMap.get(pCode);
        if (!permId) continue;

        const inserted = await dbClient.execute(sql`
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES (${roleId}::uuid, ${permId}::uuid)
          ON CONFLICT (role_id, permission_id) DO NOTHING;
        `);
        if ((inserted as { rowCount?: number }).rowCount) {
          mappingsCount += (inserted as { rowCount?: number }).rowCount ?? 0;
        }
      }
    }

    return {
      permissionsCount: allPerms.length,
      mappingsCount
    };
  }

  /**
   * Assigns a specific permission code to a system role.
   */
  async assignPermissionToRole(
    adminId: string,
    roleCode: string,
    permissionCode: string,
    clientInfo?: { ip?: string; userAgent?: string; correlationId?: string }
  ): Promise<string[]> {
    const normalizedRole = roleCode.trim().toUpperCase();
    const normalizedPerm = permissionCode.trim().toLowerCase();

    const [role] = await db
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(eq(schema.roles.code, normalizedRole))
      .limit(1);

    if (!role) {
      throw AppError.notFound(`Role not found: ${normalizedRole}`);
    }

    const [perm] = await db
      .select({ id: schema.permissions.id })
      .from(schema.permissions)
      .where(eq(schema.permissions.code, normalizedPerm))
      .limit(1);

    if (!perm) {
      throw AppError.notFound(`Permission not found: ${normalizedPerm}`);
    }

    await db.execute(sql`
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (${role.id}::uuid, ${perm.id}::uuid)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    `);

    await auditService.recordEvent({
      eventType: SecurityEventType.AUTH_ROLE_ASSIGNED,
      userId: adminId,
      clientInfo,
      metadata: {
        action: "ASSIGN_ROLE_PERMISSION",
        roleCode: normalizedRole,
        permissionCode: normalizedPerm
      }
    });

    const updatedRoles = await this.listRoles();
    const target = updatedRoles.find((r) => r.code === normalizedRole);
    return target?.permissions ?? [];
  }

  /**
   * Revokes a specific permission code from a system role.
   */
  async revokePermissionFromRole(
    adminId: string,
    roleCode: string,
    permissionCode: string,
    clientInfo?: { ip?: string; userAgent?: string; correlationId?: string }
  ): Promise<string[]> {
    const normalizedRole = roleCode.trim().toUpperCase();
    const normalizedPerm = permissionCode.trim().toLowerCase();

    // Guard against stripping Superadmin of governance rights
    const PROTECTED_SUPERADMIN_PERMISSIONS = new Set([
      "admin.platform.manage",
      "admin.role.read",
      "admin.role.assign",
      "admin.role.revoke",
      "admin.permission.read"
    ]);

    if (normalizedRole === "SUPERADMIN" && PROTECTED_SUPERADMIN_PERMISSIONS.has(normalizedPerm)) {
      throw AppError.forbidden("Cannot revoke essential platform governance permissions from the Superadmin role.");
    }

    const [role] = await db
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(eq(schema.roles.code, normalizedRole))
      .limit(1);

    if (!role) {
      throw AppError.notFound(`Role not found: ${normalizedRole}`);
    }

    const [perm] = await db
      .select({ id: schema.permissions.id })
      .from(schema.permissions)
      .where(eq(schema.permissions.code, normalizedPerm))
      .limit(1);

    if (!perm) {
      throw AppError.notFound(`Permission not found: ${normalizedPerm}`);
    }

    await db.execute(sql`
      DELETE FROM role_permissions
      WHERE role_id = ${role.id}::uuid AND permission_id = ${perm.id}::uuid;
    `);

    await auditService.recordEvent({
      eventType: SecurityEventType.AUTH_ROLE_REVOKED,
      userId: adminId,
      clientInfo,
      metadata: {
        action: "REVOKE_ROLE_PERMISSION",
        roleCode: normalizedRole,
        permissionCode: normalizedPerm
      }
    });

    const updatedRoles = await this.listRoles();
    const target = updatedRoles.find((r) => r.code === normalizedRole);
    return target?.permissions ?? [];
  }

  /**
   * Resets all system roles to the standard recommended permission matrix.
   */
  async resetRolePermissionsToDefault(
    adminId: string,
    clientInfo?: { ip?: string; userAgent?: string; correlationId?: string }
  ): Promise<RoleDetail[]> {
    await this.ensureDefaultRolePermissions();

    await auditService.recordEvent({
      eventType: SecurityEventType.AUTH_ROLE_ASSIGNED,
      userId: adminId,
      clientInfo,
      metadata: {
        action: "RESET_DEFAULT_ROLE_PERMISSIONS"
      }
    });

    return this.listRoles();
  }
}

export const rbacService = new RbacService();

