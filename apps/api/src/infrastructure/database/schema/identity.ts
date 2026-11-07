import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  check
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ============================================================================
// 1. Unified User Identity
// ============================================================================
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    normalizedEmail: varchar("normalized_email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    phoneNumber: varchar("phone_number", { length: 32 }),
    displayName: varchar("display_name", { length: 128 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("PENDING_VERIFICATION"),
    isEmailVerified: boolean("is_email_verified").notNull().default(false),
    isPhoneVerified: boolean("is_phone_verified").notNull().default(false),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("users_normalized_email_unique").on(table.normalizedEmail),
    index("users_status_idx").on(table.status),
    check(
      "users_status_check",
      sql`${table.status} IN ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED')`
    ),
    check(
      "users_normalized_email_match_check",
      sql`${table.normalizedEmail} = lower(trim(${table.email}))`
    )
  ]
);

// ============================================================================
// 2. Traveller Profile Context
// ============================================================================
export const travellerProfiles = pgTable(
  "traveller_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    firstName: varchar("first_name", { length: 64 }),
    lastName: varchar("last_name", { length: 64 }),
    preferredLanguage: varchar("preferred_language", { length: 10 }).notNull().default("en"),
    preferredCurrency: varchar("preferred_currency", { length: 3 }).notNull().default("LKR"),
    emergencyContactName: varchar("emergency_contact_name", { length: 128 }),
    emergencyContactPhone: varchar("emergency_contact_phone", { length: 32 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("traveller_profiles_user_id_unique").on(table.userId)
  ]
);

// ============================================================================
// 3. Host Profile Context
// ============================================================================
export const hostProfiles = pgTable(
  "host_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: varchar("display_name", { length: 128 }).notNull(),
    contactEmail: varchar("contact_email", { length: 255 }),
    contactPhone: varchar("contact_phone", { length: 32 }),
    hostType: varchar("host_type", { length: 32 }).notNull().default("INDIVIDUAL"),
    status: varchar("status", { length: 32 }).notNull().default("PENDING_ONBOARDING"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("host_profiles_user_id_unique").on(table.userId),
    check(
      "host_profiles_host_type_check",
      sql`${table.hostType} IN ('INDIVIDUAL', 'BUSINESS')`
    ),
    check(
      "host_profiles_status_check",
      sql`${table.status} IN ('PENDING_ONBOARDING', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED')`
    )
  ]
);

// ============================================================================
// 4. Roles (Centralized RBAC)
// ============================================================================
export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 64 }).notNull(),
    description: text("description"),
    isSystem: boolean("is_system").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("roles_code_unique").on(table.code)
  ]
);

// ============================================================================
// 5. Permissions (Granular Action Scopes)
// ============================================================================
export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 64 }).notNull(),
    description: text("description"),
    module: varchar("module", { length: 32 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("permissions_code_unique").on(table.code),
    index("permissions_module_idx").on(table.module)
  ]
);

// ============================================================================
// 6. User-Role Assignments (Multi-Role Support)
// ============================================================================
export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    assignedBy: uuid("assigned_by").references(() => users.id, { onDelete: "set null" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("user_roles_user_role_unique").on(table.userId, table.roleId),
    index("user_roles_user_id_idx").on(table.userId),
    index("user_roles_role_id_idx").on(table.roleId)
  ]
);

// ============================================================================
// 7. Role-Permission Assignments
// ============================================================================
export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("role_permissions_role_permission_unique").on(table.roleId, table.permissionId),
    index("role_permissions_role_id_idx").on(table.roleId),
    index("role_permissions_permission_id_idx").on(table.permissionId)
  ]
);

// ============================================================================
// 8. Auth Sessions (Multi-Device Refresh Sessions with Rotation)
// ============================================================================
export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    refreshTokenHash: varchar("refresh_token_hash", { length: 64 }).notNull(),
    previousTokenHash: varchar("previous_token_hash", { length: 64 }),
    clientType: varchar("client_type", { length: 16 }).notNull().default("UNKNOWN"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revocationReason: varchar("revocation_reason", { length: 64 }),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("auth_sessions_refresh_token_hash_unique").on(table.refreshTokenHash),
    index("auth_sessions_previous_token_hash_idx").on(table.previousTokenHash),
    index("auth_sessions_user_id_idx").on(table.userId),
    index("auth_sessions_user_revoked_idx").on(table.userId, table.revokedAt),
    index("auth_sessions_expires_at_idx").on(table.expiresAt),
    check(
      "auth_sessions_client_type_check",
      sql`${table.clientType} IN ('WEB', 'MOBILE', 'UNKNOWN')`
    )
  ]
);

// ============================================================================
// 9. Password Recovery Tokens
// ============================================================================
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("password_reset_tokens_token_hash_unique").on(table.tokenHash),
    index("password_reset_tokens_user_expires_idx").on(table.userId, table.expiresAt)
  ]
);

// ============================================================================
// 10. Immutable Security Audit Events
// ============================================================================
export const securityAuditEvents = pgTable(
  "security_audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("security_audit_events_user_id_idx").on(table.userId),
    index("security_audit_events_event_type_idx").on(table.eventType),
    index("security_audit_events_created_at_idx").on(table.createdAt)
  ]
);

// ============================================================================
// Drizzle Relations
// ============================================================================
export const usersRelations = relations(users, ({ one, many }) => ({
  travellerProfile: one(travellerProfiles, {
    fields: [users.id],
    references: [travellerProfiles.userId]
  }),
  hostProfile: one(hostProfiles, {
    fields: [users.id],
    references: [hostProfiles.userId]
  }),
  userRoles: many(userRoles),
  sessions: many(authSessions),
  passwordResetTokens: many(passwordResetTokens),
  securityAuditEvents: many(securityAuditEvents)
}));

export const travellerProfilesRelations = relations(travellerProfiles, ({ one }) => ({
  user: one(users, {
    fields: [travellerProfiles.userId],
    references: [users.id]
  })
}));

export const hostProfilesRelations = relations(hostProfiles, ({ one }) => ({
  user: one(users, {
    fields: [hostProfiles.userId],
    references: [users.id]
  })
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
  rolePermissions: many(rolePermissions)
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions)
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id]
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id]
  }),
  assignedByUser: one(users, {
    fields: [userRoles.assignedBy],
    references: [users.id]
  })
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id]
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id]
  })
}));

export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(users, {
    fields: [authSessions.userId],
    references: [users.id]
  })
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id]
  })
}));

export const securityAuditEventsRelations = relations(securityAuditEvents, ({ one }) => ({
  user: one(users, {
    fields: [securityAuditEvents.userId],
    references: [users.id]
  })
}));

// ============================================================================
// Inferred TypeScript Types
// ============================================================================
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type TravellerProfile = typeof travellerProfiles.$inferSelect;
export type NewTravellerProfile = typeof travellerProfiles.$inferInsert;

export type HostProfile = typeof hostProfiles.$inferSelect;
export type NewHostProfile = typeof hostProfiles.$inferInsert;

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;

export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;

export type UserRole = typeof userRoles.$inferSelect;
export type NewUserRole = typeof userRoles.$inferInsert;

export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;

export type AuthSession = typeof authSessions.$inferSelect;
export type NewAuthSession = typeof authSessions.$inferInsert;

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;

export type SecurityAuditEvent = typeof securityAuditEvents.$inferSelect;
export type NewSecurityAuditEvent = typeof securityAuditEvents.$inferInsert;

