import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  check
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { users } from "./identity.js";

// ============================================================================
// 1. Upload Intents
// Durable database-backed upload intents binding upload authorization,
// expected resource, server-generated key, MIME/size limits, and lifecycle state.
// ============================================================================
export const uploadIntents = pgTable(
  "upload_intents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: varchar("purpose", { length: 64 }).notNull(),
    resourceType: varchar("resource_type", { length: 64 }).notNull(),
    resourceId: uuid("resource_id"),
    fileKey: text("file_key").notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    maxFileSize: integer("max_file_size").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("PENDING"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("upload_intents_user_id_idx").on(table.userId),
    index("upload_intents_status_idx").on(table.status),
    index("upload_intents_resource_idx").on(table.resourceType, table.resourceId),
    uniqueIndex("upload_intents_file_key_unique").on(table.fileKey),
    check(
      "upload_intents_purpose_check",
      sql`${table.purpose} IN ('HOST_VERIFICATION', 'LOCATION_IMAGE')`
    ),
    check(
      "upload_intents_status_check",
      sql`${table.status} IN ('PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED')`
    ),
    check("upload_intents_max_size_check", sql`${table.maxFileSize} > 0`)
  ]
);

// ============================================================================
// Drizzle Relations
// ============================================================================
export const uploadIntentsRelations = relations(uploadIntents, ({ one }) => ({
  user: one(users, {
    fields: [uploadIntents.userId],
    references: [users.id]
  })
}));

// ============================================================================
// Inferred TypeScript Types
// ============================================================================
export type UploadIntentEntity = typeof uploadIntents.$inferSelect;
export type NewUploadIntentEntity = typeof uploadIntents.$inferInsert;

