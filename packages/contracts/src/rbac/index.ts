import { z } from "zod";

// ============================================================================
// System Role & Permission Constants
// ============================================================================
export const SYSTEM_ROLES = [
  "TRAVELLER",
  "HOST_OWNER",
  "HOST_STAFF",
  "SUPPORT",
  "SUPERADMIN"
] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

export const SYSTEM_PERMISSIONS = {
  // Identity domain
  IDENTITY_PROFILE_READ: "identity.profile.read",
  IDENTITY_PROFILE_UPDATE: "identity.profile.update",
  IDENTITY_SESSION_READ_OWN: "identity.session.read_own",
  IDENTITY_SESSION_REVOKE_OWN: "identity.session.revoke_own",
  IDENTITY_PASSWORD_CHANGE: "identity.password.change",

  // Admin user lifecycle & inspection
  ADMIN_USER_READ: "admin.user.read",
  ADMIN_USER_SUSPEND: "admin.user.suspend",
  ADMIN_USER_REINSTATE: "admin.user.reinstate",
  ADMIN_USER_DEACTIVATE: "admin.user.deactivate",
  ADMIN_USER_REACTIVATE: "admin.user.reactivate",
  ADMIN_USER_VERIFY_EMAIL: "admin.user.verify_email",

  // Admin session management
  ADMIN_SESSION_READ_ANY: "admin.session.read_any",
  ADMIN_SESSION_REVOKE_ANY: "admin.session.revoke_any",

  // Admin role & permission management
  ADMIN_ROLE_READ: "admin.role.read",
  ADMIN_ROLE_ASSIGN: "admin.role.assign",
  ADMIN_ROLE_REVOKE: "admin.role.revoke",
  ADMIN_PERMISSION_READ: "admin.permission.read",

  // Admin audit & platform governance
  ADMIN_AUDIT_READ: "admin.audit.read",
  ADMIN_PLATFORM_MANAGE: "admin.platform.manage",
  ADMIN_KYC_MANAGE: "admin.kyc.manage",
  ADMIN_FINANCIAL_MANAGE: "admin.financial.manage",

  // Support operations
  SUPPORT_TICKET_READ: "support.ticket.read",
  SUPPORT_TICKET_UPDATE: "support.ticket.update"
} as const;

export type PermissionCode =
  (typeof SYSTEM_PERMISSIONS)[keyof typeof SYSTEM_PERMISSIONS];

export const PermissionCodeSchema = z.string().min(1).max(64);

// ============================================================================
// Models
// ============================================================================
export const PermissionSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  module: z.string(),
  createdAt: z.string()
});
export type Permission = z.infer<typeof PermissionSchema>;

export const RoleDetailSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
  permissions: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type RoleDetail = z.infer<typeof RoleDetailSchema>;

// ============================================================================
// Request Schemas
// ============================================================================
export const AssignUserRoleRequestSchema = z.object({
  roleCode: z
    .string()
    .trim()
    .min(1, "Role code is required")
    .max(32, "Role code must not exceed 32 characters")
});
export type AssignUserRoleRequest = z.infer<typeof AssignUserRoleRequestSchema>;

// ============================================================================
// Response Schemas
// ============================================================================
export const PermissionListResponseDataSchema = z.object({
  permissions: z.array(PermissionSchema)
});
export type PermissionListResponseData = z.infer<
  typeof PermissionListResponseDataSchema
>;

export const RoleListResponseDataSchema = z.object({
  roles: z.array(RoleDetailSchema)
});
export type RoleListResponseData = z.infer<typeof RoleListResponseDataSchema>;

export const AssignUserRoleResponseDataSchema = z.object({
  userId: z.string().uuid(),
  roles: z.array(z.string()),
  message: z.string()
});
export type AssignUserRoleResponseData = z.infer<
  typeof AssignUserRoleResponseDataSchema
>;

export const RevokeUserRoleResponseDataSchema = z.object({
  userId: z.string().uuid(),
  roles: z.array(z.string()),
  message: z.string()
});
export type RevokeUserRoleResponseData = z.infer<
  typeof RevokeUserRoleResponseDataSchema
>;

export const UserEffectivePermissionsResponseDataSchema = z.object({
  userId: z.string().uuid(),
  roles: z.array(z.string()),
  permissions: z.array(z.string())
});
export type UserEffectivePermissionsResponseData = z.infer<
  typeof UserEffectivePermissionsResponseDataSchema
>;

