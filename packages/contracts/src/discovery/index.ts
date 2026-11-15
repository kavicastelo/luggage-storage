import { z } from "zod";
import {
  OPENING_HOURS_EXCEPTION_TYPES,
  PublicStorageLocationSchema
} from "../locations/index.js";
import { PRICING_UNITS } from "../pricing/index.js";
import { BAG_CATEGORIES } from "../capacity/index.js";

// ============================================================================
// Request Schemas
// ============================================================================

export const DISCOVERY_SORT_OPTIONS = ["distance", "price_asc", "price_desc", "newest"] as const;
export type DiscoverySortOption = (typeof DISCOVERY_SORT_OPTIONS)[number];

export const SearchLocationsQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radiusMeters: z.coerce.number().int().positive().max(100000).default(15000), // Default 15km
  city: z.string().trim().max(100).optional(),
  searchTerm: z.string().trim().max(100).optional(),
  amenities: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      return val.split(",").map((s) => s.trim()).filter(Boolean);
    }),
  acceptsOversized: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => {
      if (typeof val === "boolean") return val;
      if (typeof val === "string") return val.toLowerCase() === "true" || val === "1";
      return undefined;
    }),
  sortBy: z.enum(DISCOVERY_SORT_OPTIONS).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});
export type SearchLocationsQueryInput = z.input<typeof SearchLocationsQuerySchema>;
export type SearchLocationsQuery = z.infer<typeof SearchLocationsQuerySchema>;
export type SearchLocationsQueryParsed = z.infer<typeof SearchLocationsQuerySchema>;

// ============================================================================
// Response Schemas
// ============================================================================

export const SearchLocationsResponseSchema = z.object({
  locations: z.array(PublicStorageLocationSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative()
  })
});
export type SearchLocationsResponse = z.infer<typeof SearchLocationsResponseSchema>;

export const PublicLocationOpeningHourSchema = z.object({
  dayOfWeek: z.number().int().min(1).max(7),
  openTime: z.string(),
  closeTime: z.string(),
  allowsDropoff: z.boolean(),
  allowsCollection: z.boolean(),
  isClosed: z.boolean()
});
export type PublicLocationOpeningHour = z.infer<typeof PublicLocationOpeningHourSchema>;

export const PublicLocationExceptionSchema = z.object({
  exceptionDate: z.string(),
  exceptionType: z.enum(OPENING_HOURS_EXCEPTION_TYPES),
  openTime: z.string().nullable().optional(),
  closeTime: z.string().nullable().optional(),
  reason: z.string().nullable().optional()
});
export type PublicLocationException = z.infer<typeof PublicLocationExceptionSchema>;

export const PublicLocationPricingTierSchema = z.object({
  bagCategory: z.enum(BAG_CATEGORIES),
  rateMinor: z.number().int().nonnegative(),
  categoryMultiplierBps: z.number().int().positive()
});
export type PublicLocationPricingTier = z.infer<typeof PublicLocationPricingTierSchema>;

export const PublicLocationPricingPolicySchema = z.object({
  currency: z.string(),
  pricingUnit: z.enum(PRICING_UNITS),
  baseRateMinor: z.number().int().positive(),
  tierRates: z.array(PublicLocationPricingTierSchema)
});
export type PublicLocationPricingPolicy = z.infer<typeof PublicLocationPricingPolicySchema>;

export const PublicLocationCapacitySummarySchema = z.object({
  activePoolCount: z.number().int().nonnegative(),
  totalMaxCapacityUnits: z.number().int().nonnegative(),
  supportedBagCategories: z.array(z.enum(BAG_CATEGORIES))
});
export type PublicLocationCapacitySummary = z.infer<typeof PublicLocationCapacitySummarySchema>;

export const PublicStorageLocationDetailSchema = PublicStorageLocationSchema.extend({
  openingHours: z.array(PublicLocationOpeningHourSchema),
  upcomingExceptions: z.array(PublicLocationExceptionSchema),
  pricingPolicy: PublicLocationPricingPolicySchema.nullable(),
  capacitySummary: PublicLocationCapacitySummarySchema
});
export type PublicStorageLocationDetail = z.infer<typeof PublicStorageLocationDetailSchema>;
