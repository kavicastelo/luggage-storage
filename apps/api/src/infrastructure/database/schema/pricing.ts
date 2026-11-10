import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  index,
  uniqueIndex,
  check
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { storageLocations } from "./locations.js";

// ============================================================================
// 1. Pricing Policies
// ============================================================================
export const pricingPolicies = pgTable(
  "pricing_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => storageLocations.id, { onDelete: "cascade" }),
    currency: varchar("currency", { length: 3 }).notNull().default("LKR"),
    pricingUnit: varchar("pricing_unit", { length: 32 }).notNull().default("CALENDAR_DAY"),
    baseRateMinor: integer("base_rate_minor").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("pricing_policies_location_id_idx").on(table.locationId),
    index("pricing_policies_status_idx").on(table.status),
    uniqueIndex("pricing_policies_location_active_unique")
      .on(table.locationId)
      .where(sql`${table.status} = 'ACTIVE'`),
    check(
      "pricing_policies_pricing_unit_check",
      sql`${table.pricingUnit} IN ('CALENDAR_DAY', '24_HOUR_BLOCK')`
    ),
    check(
      "pricing_policies_status_check",
      sql`${table.status} IN ('DRAFT', 'ACTIVE', 'ARCHIVED')`
    ),
    check("pricing_policies_base_rate_check", sql`${table.baseRateMinor} > 0`)
  ]
);

// ============================================================================
// 2. Pricing Tier Rates (Per-Bag Category Pricing & Multipliers)
// ============================================================================
export const pricingTierRates = pgTable(
  "pricing_tier_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => pricingPolicies.id, { onDelete: "cascade" }),
    bagCategory: varchar("bag_category", { length: 32 }).notNull(),
    rateMinor: integer("rate_minor").notNull(),
    categoryMultiplierBps: integer("category_multiplier_bps").notNull().default(10000),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("pricing_tier_rates_policy_id_idx").on(table.policyId),
    uniqueIndex("pricing_tier_rates_policy_cat_unique").on(table.policyId, table.bagCategory),
    check(
      "pricing_tier_rates_category_check",
      sql`${table.bagCategory} IN ('BAG_SMALL', 'BAG_MEDIUM', 'BAG_LARGE', 'BAG_OVERSIZED')`
    ),
    check("pricing_tier_rates_rate_check", sql`${table.rateMinor} >= 0`),
    check("pricing_tier_rates_multiplier_check", sql`${table.categoryMultiplierBps} > 0`)
  ]
);

// ============================================================================
// Drizzle Relations
// ============================================================================
export const pricingPoliciesRelations = relations(pricingPolicies, ({ one, many }) => ({
  location: one(storageLocations, {
    fields: [pricingPolicies.locationId],
    references: [storageLocations.id]
  }),
  tierRates: many(pricingTierRates)
}));

export const pricingTierRatesRelations = relations(pricingTierRates, ({ one }) => ({
  policy: one(pricingPolicies, {
    fields: [pricingTierRates.policyId],
    references: [pricingPolicies.id]
  })
}));

// ============================================================================
// Inferred TypeScript Types
// ============================================================================
export type PricingPolicyEntity = typeof pricingPolicies.$inferSelect;
export type NewPricingPolicyEntity = typeof pricingPolicies.$inferInsert;

export type PricingTierRateEntity = typeof pricingTierRates.$inferSelect;
export type NewPricingTierRateEntity = typeof pricingTierRates.$inferInsert;

