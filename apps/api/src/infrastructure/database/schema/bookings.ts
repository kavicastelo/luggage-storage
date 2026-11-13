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
import { hostBusinesses } from "./hosts.js";
import { storageLocations } from "./locations.js";
import { storageCapacityPools } from "./capacity.js";
import { pricingPolicies } from "./pricing.js";

// ============================================================================
// 1. Bookings
// ============================================================================
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referenceCode: varchar("reference_code", { length: 32 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }),
    travellerUserId: uuid("traveller_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => hostBusinesses.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => storageLocations.id, { onDelete: "restrict" }),
    bookingMode: varchar("booking_mode", { length: 32 }).notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    dropOffAt: timestamp("drop_off_at", { withTimezone: true }).notNull(),
    collectionAt: timestamp("collection_at", { withTimezone: true }).notNull(),
    totalBags: integer("total_bags").notNull(),
    totalCapacityUnits: integer("total_capacity_units").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("LKR"),
    totalAmountMinor: integer("total_amount_minor").notNull(),
    holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }),
    hostApprovedAt: timestamp("host_approved_at", { withTimezone: true }),
    hostApprovedBy: uuid("host_approved_by").references(() => users.id, { onDelete: "set null" }),
    hostRejectedAt: timestamp("host_rejected_at", { withTimezone: true }),
    hostRejectionReason: text("host_rejection_reason"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledByUserId: uuid("cancelled_by_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    cancellationReason: text("cancellation_reason"),
    exceptionReason: text("exception_reason"),
    travellerNotes: text("traveller_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("bookings_reference_code_unique").on(table.referenceCode),
    uniqueIndex("bookings_traveller_idempotency_unique")
      .on(table.travellerUserId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} IS NOT NULL`),
    index("bookings_traveller_user_id_idx").on(table.travellerUserId),
    index("bookings_business_id_idx").on(table.businessId),
    index("bookings_location_window_idx").on(table.locationId, table.dropOffAt, table.collectionAt),
    index("bookings_status_hold_expires_idx").on(table.status, table.holdExpiresAt),
    check("bookings_mode_check", sql`${table.bookingMode} IN ('INSTANT', 'HOST_APPROVAL')`),
    check(
      "bookings_status_check",
      sql`${table.status} IN (
        'PENDING_HOST_APPROVAL',
        'PENDING_PAYMENT',
        'CONFIRMED',
        'IN_STORAGE',
        'COMPLETED',
        'CANCELLED_BY_TRAVELLER',
        'CANCELLED_BY_HOST',
        'CANCELLED_BY_PLATFORM',
        'REJECTED',
        'EXPIRED',
        'DISPUTED'
      )`
    ),
    check("bookings_window_check", sql`${table.collectionAt} > ${table.dropOffAt}`),
    check("bookings_total_bags_check", sql`${table.totalBags} > 0`),
    check("bookings_total_units_check", sql`${table.totalCapacityUnits} > 0`),
    check("bookings_total_amount_check", sql`${table.totalAmountMinor} >= 0`)
  ]
);

// ============================================================================
// 2. Booking Items
// ============================================================================
export const bookingItems = pgTable(
  "booking_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    bagCategory: varchar("bag_category", { length: 32 }).notNull(),
    quantity: integer("quantity").notNull(),
    capacityUnits: integer("capacity_units").notNull(),
    unitRateMinor: integer("unit_rate_minor").notNull(),
    lineTotalMinor: integer("line_total_minor").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("booking_items_booking_id_idx").on(table.bookingId),
    uniqueIndex("booking_items_booking_category_unique").on(table.bookingId, table.bagCategory),
    check(
      "booking_items_category_check",
      sql`${table.bagCategory} IN ('BAG_SMALL', 'BAG_MEDIUM', 'BAG_LARGE', 'BAG_OVERSIZED')`
    ),
    check("booking_items_quantity_check", sql`${table.quantity} > 0`),
    check("booking_items_units_check", sql`${table.capacityUnits} > 0`),
    check("booking_items_unit_rate_check", sql`${table.unitRateMinor} >= 0`),
    check("booking_items_line_total_check", sql`${table.lineTotalMinor} >= 0`)
  ]
);

// ============================================================================
// 3. Booking Status History (Append-Only Immutable Audit Trail)
// ============================================================================
export const bookingStatusHistory = pgTable(
  "booking_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    previousStatus: varchar("previous_status", { length: 32 }),
    newStatus: varchar("new_status", { length: 32 }).notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorRole: varchar("actor_role", { length: 32 }).notNull(),
    reason: text("reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("booking_status_history_booking_id_idx").on(table.bookingId, table.createdAt)
  ]
);

// ============================================================================
// 4. Capacity Reservations (Concurrency-Controlled Pool Allocations)
// ============================================================================
export const capacityReservations = pgTable(
  "capacity_reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => storageLocations.id, { onDelete: "restrict" }),
    poolId: uuid("pool_id")
      .notNull()
      .references(() => storageCapacityPools.id, { onDelete: "restrict" }),
    bagCategory: varchar("bag_category", { length: 32 }),
    unitsReserved: integer("units_reserved").notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    releaseReason: varchar("release_reason", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("capacity_reservations_booking_id_idx").on(table.bookingId),
    index("capacity_reservations_pool_status_idx").on(table.poolId, table.status, table.expiresAt),
    index("capacity_reservations_location_status_idx").on(table.locationId, table.status),
    check("capacity_reservations_units_check", sql`${table.unitsReserved} > 0`),
    check(
      "capacity_reservations_status_check",
      sql`${table.status} IN (
        'HELD_FOR_HOST_APPROVAL',
        'HELD_FOR_PAYMENT',
        'CONFIRMED',
        'RELEASED'
      )`
    )
  ]
);

// ============================================================================
// 5. Booking Pricing Snapshots (Immutable Historical Commercial Terms)
// ============================================================================
export const bookingPricingSnapshots = pgTable(
  "booking_pricing_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    policyId: uuid("policy_id").references(() => pricingPolicies.id, { onDelete: "set null" }),
    currency: varchar("currency", { length: 3 }).notNull().default("LKR"),
    currencyExponent: integer("currency_exponent").notNull().default(2),
    pricingUnit: varchar("pricing_unit", { length: 32 }).notNull(),
    baseRateMinor: integer("base_rate_minor").notNull(),
    durationUnits: integer("duration_units").notNull(),
    itemsBreakdown: jsonb("items_breakdown").$type<unknown[]>().notNull().default([]),
    grossStorageMinor: integer("gross_storage_minor").notNull(),
    discountMinor: integer("discount_minor").notNull().default(0),
    storageSubtotalMinor: integer("storage_subtotal_minor").notNull(),
    commissionRateBps: integer("commission_rate_bps").notNull().default(1500),
    platformCommissionMinor: integer("platform_commission_minor").notNull(),
    hostPayableMinor: integer("host_payable_minor").notNull(),
    taxRateBps: integer("tax_rate_bps").notNull().default(0),
    taxAmountMinor: integer("tax_amount_minor").notNull().default(0),
    totalAmountMinor: integer("total_amount_minor").notNull(),
    cancellationPolicyCode: varchar("cancellation_policy_code", { length: 64 })
      .notNull()
      .default("STANDARD_FLEX_2H"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("booking_pricing_snapshots_booking_id_unique").on(table.bookingId),
    check(
      "booking_pricing_snapshots_unit_check",
      sql`${table.pricingUnit} IN ('CALENDAR_DAY', '24_HOUR_BLOCK')`
    ),
    check("booking_pricing_snapshots_duration_check", sql`${table.durationUnits} > 0`),
    check(
      "booking_pricing_snapshots_split_check",
      sql`${table.platformCommissionMinor} + ${table.hostPayableMinor} = ${table.storageSubtotalMinor}`
    ),
    check(
      "booking_pricing_snapshots_total_check",
      sql`${table.storageSubtotalMinor} + ${table.taxAmountMinor} = ${table.totalAmountMinor}`
    )
  ]
);

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  traveller: one(users, {
    fields: [bookings.travellerUserId],
    references: [users.id]
  }),
  business: one(hostBusinesses, {
    fields: [bookings.businessId],
    references: [hostBusinesses.id]
  }),
  location: one(storageLocations, {
    fields: [bookings.locationId],
    references: [storageLocations.id]
  }),
  items: many(bookingItems),
  statusHistory: many(bookingStatusHistory),
  capacityReservations: many(capacityReservations),
  pricingSnapshot: one(bookingPricingSnapshots, {
    fields: [bookings.id],
    references: [bookingPricingSnapshots.bookingId]
  })
}));

export type BookingEntity = typeof bookings.$inferSelect;
export type NewBookingEntity = typeof bookings.$inferInsert;
export type BookingItemEntity = typeof bookingItems.$inferSelect;
export type BookingPricingSnapshotEntity = typeof bookingPricingSnapshots.$inferSelect;
export type CapacityReservationEntity = typeof capacityReservations.$inferSelect;

