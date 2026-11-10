import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  check,
  customType
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { users } from "./identity.js";
import { hostBusinesses } from "./hosts.js";

// ============================================================================
// PostGIS Geography Point custom type
// ============================================================================
export const postgisPoint = customType<{
  data: string; // EWKT e.g. "SRID=4326;POINT(lng lat)"
  driverData: string;
}>({
  dataType() {
    return "geography(Point, 4326)";
  }
});

// ============================================================================
// 1. Storage Locations
// ============================================================================
export const storageLocations = pgTable(
  "storage_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => hostBusinesses.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    addressLine1: varchar("address_line1", { length: 255 }).notNull(),
    addressLine2: varchar("address_line2", { length: 255 }),
    city: varchar("city", { length: 100 }).notNull(),
    postalCode: varchar("postal_code", { length: 20 }),
    countryCode: varchar("country_code", { length: 2 }).notNull().default("LK"),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    coordinates: postgisPoint("coordinates").notNull(),
    timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Colombo"),
    bookingMode: varchar("booking_mode", { length: 32 }).notNull().default("INSTANT"),
    acceptsOversized: boolean("accepts_oversized").notNull().default(false),
    amenities: jsonb("amenities").notNull().default(sql`'[]'::jsonb`),
    status: varchar("status", { length: 32 }).notNull().default("DRAFT"),
    rejectionReason: text("rejection_reason"),
    adminNotes: text("admin_notes"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("storage_locations_business_id_idx").on(table.businessId),
    index("storage_locations_status_idx").on(table.status),
    index("storage_locations_city_idx").on(table.city),
    index("storage_locations_coordinates_gist_idx").using("gist", table.coordinates),
    check(
      "storage_locations_status_check",
      sql`${table.status} IN ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'DISABLED', 'REJECTED')`
    ),
    check(
      "storage_locations_booking_mode_check",
      sql`${table.bookingMode} IN ('INSTANT', 'HOST_APPROVAL')`
    )
  ]
);

// ============================================================================
// 2. Location Media
// ============================================================================
export const locationMedia = pgTable(
  "location_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => storageLocations.id, { onDelete: "cascade" }),
    fileKey: varchar("file_key", { length: 512 }).notNull(),
    url: varchar("url", { length: 1024 }).notNull(),
    mediaType: varchar("media_type", { length: 32 }).notNull().default("IMAGE"),
    caption: varchar("caption", { length: 255 }),
    isPrimary: boolean("is_primary").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("location_media_location_id_idx").on(table.locationId)
  ]
);

// ============================================================================
// 3. Storage Zones
// ============================================================================
export const storageZones = pgTable(
  "storage_zones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => storageLocations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    zoneType: varchar("zone_type", { length: 32 }).notNull().default("BACKROOM"),
    securityTier: varchar("security_tier", { length: 32 }).notNull().default("STANDARD"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("storage_zones_location_id_idx").on(table.locationId),
    check(
      "storage_zones_zone_type_check",
      sql`${table.zoneType} IN ('LOCKER', 'BACKROOM', 'FRONT_DESK', 'BASEMENT', 'RACK', 'OTHER')`
    ),
    check(
      "storage_zones_security_tier_check",
      sql`${table.securityTier} IN ('STANDARD', 'HIGH_SECURITY')`
    )
  ]
);

// ============================================================================
// 4. Opening Hours (Weekly Recurring)
// ============================================================================
export const openingHours = pgTable(
  "opening_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => storageLocations.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(),
    openTime: varchar("open_time", { length: 8 }).notNull(),
    closeTime: varchar("close_time", { length: 8 }).notNull(),
    allowsDropoff: boolean("allows_dropoff").notNull().default(true),
    allowsCollection: boolean("allows_collection").notNull().default(true),
    isClosed: boolean("is_closed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("opening_hours_location_id_idx").on(table.locationId),
    uniqueIndex("opening_hours_loc_day_unique").on(table.locationId, table.dayOfWeek),
    check("opening_hours_day_check", sql`${table.dayOfWeek} BETWEEN 1 AND 7`)
  ]
);

// ============================================================================
// 5. Opening Hours Exceptions (Holidays / Date-Specific Closures)
// ============================================================================
export const openingHoursExceptions = pgTable(
  "opening_hours_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => storageLocations.id, { onDelete: "cascade" }),
    exceptionDate: varchar("exception_date", { length: 10 }).notNull(), // YYYY-MM-DD
    exceptionType: varchar("exception_type", { length: 32 }).notNull().default("CLOSURE"),
    openTime: varchar("open_time", { length: 8 }),
    closeTime: varchar("close_time", { length: 8 }),
    reason: varchar("reason", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("opening_hours_exceptions_location_id_idx").on(table.locationId),
    uniqueIndex("opening_hours_exceptions_loc_date_unique").on(table.locationId, table.exceptionDate),
    check(
      "opening_hours_exceptions_type_check",
      sql`${table.exceptionType} IN ('CLOSURE', 'SPECIAL_HOURS')`
    )
  ]
);

// ============================================================================
// Drizzle Relations
// ============================================================================
export const storageLocationsRelations = relations(storageLocations, ({ one, many }) => ({
  business: one(hostBusinesses, {
    fields: [storageLocations.businessId],
    references: [hostBusinesses.id]
  }),
  reviewer: one(users, {
    fields: [storageLocations.reviewedBy],
    references: [users.id]
  }),
  images: many(locationMedia),
  zones: many(storageZones),
  openingHours: many(openingHours),
  exceptions: many(openingHoursExceptions)
}));

export const locationMediaRelations = relations(locationMedia, ({ one }) => ({
  location: one(storageLocations, {
    fields: [locationMedia.locationId],
    references: [storageLocations.id]
  })
}));

export const storageZonesRelations = relations(storageZones, ({ one }) => ({
  location: one(storageLocations, {
    fields: [storageZones.locationId],
    references: [storageLocations.id]
  })
}));

export const openingHoursRelations = relations(openingHours, ({ one }) => ({
  location: one(storageLocations, {
    fields: [openingHours.locationId],
    references: [storageLocations.id]
  })
}));

export const openingHoursExceptionsRelations = relations(openingHoursExceptions, ({ one }) => ({
  location: one(storageLocations, {
    fields: [openingHoursExceptions.locationId],
    references: [storageLocations.id]
  })
}));

// ============================================================================
// Inferred TypeScript Types
// ============================================================================
export type StorageLocationEntity = typeof storageLocations.$inferSelect;
export type NewStorageLocationEntity = typeof storageLocations.$inferInsert;

export type LocationMediaEntity = typeof locationMedia.$inferSelect;
export type NewLocationMediaEntity = typeof locationMedia.$inferInsert;

export type StorageZoneEntity = typeof storageZones.$inferSelect;
export type NewStorageZoneEntity = typeof storageZones.$inferInsert;

export type OpeningHoursEntity = typeof openingHours.$inferSelect;
export type NewOpeningHoursEntity = typeof openingHours.$inferInsert;

export type OpeningHoursExceptionEntity = typeof openingHoursExceptions.$inferSelect;
export type NewOpeningHoursExceptionEntity = typeof openingHoursExceptions.$inferInsert;

