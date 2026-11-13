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
import { sql } from "drizzle-orm";
import { users } from "./identity.js";
import { hostBusinesses } from "./hosts.js";
import { storageLocations, storageZones } from "./locations.js";
import { bookings } from "./bookings.js";

// ============================================================================
// 1. Custody Records (1:1 Physical Chain-of-Custody per Confirmed Booking)
// ============================================================================
export const custodyRecords = pgTable(
  "custody_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => storageLocations.id, { onDelete: "restrict" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => hostBusinesses.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 32 }).notNull().default("EXPECTED"),
    checkinPinHash: varchar("checkin_pin_hash", { length: 64 }),
    collectionPinHash: varchar("collection_pin_hash", { length: 64 }),
    expectedBagCount: integer("expected_bag_count").notNull(),
    checkedInBagCount: integer("checked_in_bag_count"),
    releasedBagCount: integer("released_bag_count"),
    zoneId: uuid("zone_id").references(() => storageZones.id, { onDelete: "set null" }),
    checkInAt: timestamp("check_in_at", { withTimezone: true }),
    checkInStaffUserId: uuid("check_in_staff_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    checkOutAt: timestamp("check_out_at", { withTimezone: true }),
    checkOutStaffUserId: uuid("check_out_staff_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    handoverCondition: varchar("handover_condition", { length: 32 }).notNull().default("NORMAL"),
    overdueMinutes: integer("overdue_minutes").notNull().default(0),
    overdueFeeMinor: integer("overdue_fee_minor").notNull().default(0),
    exceptionNotes: text("exception_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("custody_records_booking_id_unique").on(table.bookingId),
    index("custody_records_location_status_idx").on(table.locationId, table.status),
    index("custody_records_business_status_idx").on(table.businessId, table.status),
    check("custody_records_expected_bags_check", sql`${table.expectedBagCount} > 0`),
    check(
      "custody_records_status_check",
      sql`${table.status} IN (
        'EXPECTED',
        'CHECKED_IN',
        'IN_STORAGE',
        'OVERDUE',
        'RELEASED_TO_TRAVELLER',
        'DISPUTED_RELEASE',
        'ABANDONED'
      )`
    ),
    check(
      "custody_records_condition_check",
      sql`${table.handoverCondition} IN ('NORMAL', 'UNPAID_FEES_PENDING', 'EXCEPTION_RECORDED')`
    ),
    check("custody_records_overdue_minutes_check", sql`${table.overdueMinutes} >= 0`),
    check("custody_records_overdue_fee_check", sql`${table.overdueFeeMinor} >= 0`)
  ]
);

// ============================================================================
// 2. Custody Tokens (Hashed CSPRNG QR Tokens & PINs Bound to Booking + Operation)
// ============================================================================
export const custodyTokens = pgTable(
  "custody_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    custodyRecordId: uuid("custody_record_id")
      .notNull()
      .references(() => custodyRecords.id, { onDelete: "restrict" }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    operation: varchar("operation", { length: 32 }).notNull(),
    hashVersion: varchar("hash_version", { length: 32 }).notNull().default("hmac-sha256-v2"),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    pinHash: varchar("pin_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    consumedByUserId: uuid("consumed_by_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("custody_tokens_token_hash_unique").on(table.tokenHash),
    index("custody_tokens_booking_op_idx").on(table.bookingId, table.operation),
    check("custody_tokens_operation_check", sql`${table.operation} IN ('CHECK_IN', 'COLLECTION')`),
    check(
      "custody_tokens_hash_version_check",
      sql`${table.hashVersion} IN ('sha256-legacy-v1', 'hmac-sha256-v2')`
    )
  ]
);

// ============================================================================
// 3. Bag Custody Items (Physical Tagging, Seals & Evidence per Bag)
// ============================================================================
export const bagCustodyItems = pgTable(
  "bag_custody_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    custodyRecordId: uuid("custody_record_id")
      .notNull()
      .references(() => custodyRecords.id, { onDelete: "restrict" }),
    bagTagCode: varchar("bag_tag_code", { length: 64 }).notNull(),
    bagCategory: varchar("bag_category", { length: 32 }).notNull(),
    securitySealNumber: varchar("security_seal_number", { length: 64 }),
    zoneId: uuid("zone_id").references(() => storageZones.id, { onDelete: "set null" }),
    photoFileKey: varchar("photo_file_key", { length: 512 }),
    conditionNotes: text("condition_notes"),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }).notNull().defaultNow(),
    releasedAt: timestamp("released_at", { withTimezone: true })
  },
  (table) => [
    uniqueIndex("bag_custody_items_record_tag_unique").on(table.custodyRecordId, table.bagTagCode),
    index("bag_custody_items_custody_id_idx").on(table.custodyRecordId),
    check(
      "bag_custody_items_category_check",
      sql`${table.bagCategory} IN ('BAG_SMALL', 'BAG_MEDIUM', 'BAG_LARGE', 'BAG_OVERSIZED')`
    )
  ]
);

// ============================================================================
// 4. Custody Events (Append-Only Immutable Chain-of-Custody Log)
// ============================================================================
export const custodyEvents = pgTable(
  "custody_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    custodyRecordId: uuid("custody_record_id")
      .notNull()
      .references(() => custodyRecords.id, { onDelete: "restrict" }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    previousStatus: varchar("previous_status", { length: 32 }),
    newStatus: varchar("new_status", { length: 32 }).notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorRole: varchar("actor_role", { length: 32 }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("custody_events_custody_record_idx").on(table.custodyRecordId, table.createdAt),
    index("custody_events_booking_id_idx").on(table.bookingId)
  ]
);

export type CustodyRecordEntity = typeof custodyRecords.$inferSelect;
export type CustodyTokenEntity = typeof custodyTokens.$inferSelect;
export type BagCustodyItemEntity = typeof bagCustodyItems.$inferSelect;
export type CustodyEventEntity = typeof custodyEvents.$inferSelect;

