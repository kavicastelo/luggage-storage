import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  timestamp,
  index,
  check
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { storageLocations, storageZones } from "./locations.js";

// ============================================================================
// 1. Storage Capacity Pools
// ============================================================================
export const storageCapacityPools = pgTable(
  "storage_capacity_pools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => storageLocations.id, { onDelete: "cascade" }),
    zoneId: uuid("zone_id").references(() => storageZones.id, { onDelete: "set null" }),
    poolType: varchar("pool_type", { length: 32 }).notNull().default("SHARED"),
    dedicatedBagCategory: varchar("dedicated_bag_category", { length: 32 }),
    totalUnits: integer("total_units").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("storage_capacity_pools_location_id_idx").on(table.locationId),
    index("storage_capacity_pools_zone_id_idx").on(table.zoneId),
    check(
      "storage_capacity_pools_type_check",
      sql`${table.poolType} IN ('SHARED', 'DEDICATED')`
    ),
    check(
      "storage_capacity_pools_category_check",
      sql`${table.dedicatedBagCategory} IS NULL OR ${table.dedicatedBagCategory} IN ('BAG_SMALL', 'BAG_MEDIUM', 'BAG_LARGE', 'BAG_OVERSIZED')`
    ),
    check("storage_capacity_pools_units_check", sql`${table.totalUnits} > 0`)
  ]
);

// ============================================================================
// Drizzle Relations
// ============================================================================
export const storageCapacityPoolsRelations = relations(storageCapacityPools, ({ one }) => ({
  location: one(storageLocations, {
    fields: [storageCapacityPools.locationId],
    references: [storageLocations.id]
  }),
  zone: one(storageZones, {
    fields: [storageCapacityPools.zoneId],
    references: [storageZones.id]
  })
}));

// ============================================================================
// Inferred TypeScript Types
// ============================================================================
export type StorageCapacityPoolEntity = typeof storageCapacityPools.$inferSelect;
export type NewStorageCapacityPoolEntity = typeof storageCapacityPools.$inferInsert;

