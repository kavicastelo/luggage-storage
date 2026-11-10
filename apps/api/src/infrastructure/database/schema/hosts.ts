import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  check
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { users } from "./identity.js";

// ============================================================================
// 1. Host Businesses
// ============================================================================
export const hostBusinesses = pgTable(
  "host_businesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    legalBusinessName: varchar("legal_business_name", { length: 255 }).notNull(),
    tradeName: varchar("trade_name", { length: 255 }).notNull(),
    businessRegistrationNumber: varchar("business_registration_number", { length: 100 }),
    entityType: varchar("entity_type", { length: 64 })
      .notNull()
      .default("SOLE_PROPRIETORSHIP"),
    taxIdentifier: varchar("tax_identifier", { length: 100 }),
    contactEmail: varchar("contact_email", { length: 255 }).notNull(),
    contactPhone: varchar("contact_phone", { length: 32 }).notNull(),
    addressLine1: varchar("address_line1", { length: 255 }),
    addressLine2: varchar("address_line2", { length: 255 }),
    city: varchar("city", { length: 100 }),
    postalCode: varchar("postal_code", { length: 20 }),
    countryCode: varchar("country_code", { length: 2 }).notNull().default("LK"),
    payoutBankName: varchar("payout_bank_name", { length: 128 }),
    payoutAccountNumber: varchar("payout_account_number", { length: 255 }),
    payoutAccountName: varchar("payout_account_name", { length: 128 }),
    payoutBranchCode: varchar("payout_branch_code", { length: 32 }),
    status: varchar("status", { length: 32 }).notNull().default("DRAFT"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("host_businesses_owner_user_id_idx").on(table.ownerUserId),
    index("host_businesses_status_idx").on(table.status),
    check(
      "host_businesses_status_check",
      sql`${table.status} IN ('DRAFT', 'PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'REJECTED')`
    ),
    check(
      "host_businesses_entity_type_check",
      sql`${table.entityType} IN ('SOLE_PROPRIETORSHIP', 'PRIVATE_LIMITED', 'HOTEL', 'RETAIL_SHOP', 'PARTNERSHIP', 'OTHER')`
    ),
    check(
      "host_businesses_payout_encrypted_check",
      sql`${table.payoutAccountNumber} IS NULL OR ${table.payoutAccountNumber} LIKE 'enc:v1:%'`
    )
  ]
);

// ============================================================================
// 2. Host Verifications
// ============================================================================
export const hostVerifications = pgTable(
  "host_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => hostBusinesses.id, { onDelete: "cascade" }),
    submittedBy: uuid("submitted_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 32 }).notNull().default("PENDING_REVIEW"),
    reviewerUserId: uuid("reviewer_user_id").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    adminNotes: text("admin_notes"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("host_verifications_business_id_idx").on(table.businessId),
    index("host_verifications_status_idx").on(table.status),
    check(
      "host_verifications_status_check",
      sql`${table.status} IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'INFORMATION_REQUESTED')`
    )
  ]
);

// ============================================================================
// 3. Host Verification Documents
// ============================================================================
export const hostVerificationDocuments = pgTable(
  "host_verification_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    verificationId: uuid("verification_id")
      .notNull()
      .references(() => hostVerifications.id, { onDelete: "cascade" }),
    documentType: varchar("document_type", { length: 64 }).notNull(),
    fileKey: varchar("file_key", { length: 512 }).notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileSize: integer("file_size").notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("PENDING"),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("host_verification_docs_verification_id_idx").on(table.verificationId),
    check(
      "host_verification_docs_status_check",
      sql`${table.status} IN ('PENDING', 'VERIFIED', 'REJECTED')`
    )
  ]
);

// ============================================================================
// 4. Host Staff Foundation
// ============================================================================
export const hostStaffMemberships = pgTable(
  "host_staff_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => hostBusinesses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    staffRole: varchar("staff_role", { length: 32 }).notNull().default("ATTENDANT"),
    assignedLocationIds: jsonb("assigned_location_ids").notNull().default(sql`'[]'::jsonb`),
    isActive: boolean("is_active").notNull().default(true),
    invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("host_staff_business_user_unique").on(table.businessId, table.userId),
    index("host_staff_user_id_idx").on(table.userId),
    check("host_staff_role_check", sql`${table.staffRole} IN ('MANAGER', 'ATTENDANT')`)
  ]
);

// ============================================================================
// Drizzle Relations
// ============================================================================
export const hostBusinessesRelations = relations(hostBusinesses, ({ one, many }) => ({
  ownerUser: one(users, {
    fields: [hostBusinesses.ownerUserId],
    references: [users.id]
  }),
  verifications: many(hostVerifications),
  staffMemberships: many(hostStaffMemberships)
}));

export const hostVerificationsRelations = relations(hostVerifications, ({ one, many }) => ({
  business: one(hostBusinesses, {
    fields: [hostVerifications.businessId],
    references: [hostBusinesses.id]
  }),
  submittedByUser: one(users, {
    fields: [hostVerifications.submittedBy],
    references: [users.id]
  }),
  reviewerUser: one(users, {
    fields: [hostVerifications.reviewerUserId],
    references: [users.id]
  }),
  documents: many(hostVerificationDocuments)
}));

export const hostVerificationDocumentsRelations = relations(hostVerificationDocuments, ({ one }) => ({
  verification: one(hostVerifications, {
    fields: [hostVerificationDocuments.verificationId],
    references: [hostVerifications.id]
  })
}));

export const hostStaffMembershipsRelations = relations(hostStaffMemberships, ({ one }) => ({
  business: one(hostBusinesses, {
    fields: [hostStaffMemberships.businessId],
    references: [hostBusinesses.id]
  }),
  user: one(users, {
    fields: [hostStaffMemberships.userId],
    references: [users.id]
  })
}));

// ============================================================================
// Inferred TypeScript Types
// ============================================================================
export type HostBusinessEntity = typeof hostBusinesses.$inferSelect;
export type NewHostBusinessEntity = typeof hostBusinesses.$inferInsert;

export type HostVerificationEntity = typeof hostVerifications.$inferSelect;
export type NewHostVerificationEntity = typeof hostVerifications.$inferInsert;

export type HostVerificationDocumentEntity = typeof hostVerificationDocuments.$inferSelect;
export type NewHostVerificationDocumentEntity = typeof hostVerificationDocuments.$inferInsert;

export type HostStaffMembershipEntity = typeof hostStaffMemberships.$inferSelect;
export type NewHostStaffMembershipEntity = typeof hostStaffMemberships.$inferInsert;

