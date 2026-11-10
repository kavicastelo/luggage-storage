import { z } from "zod";
import { PublicStorageLocationSchema } from "../locations/index.js";

// ============================================================================
// Request Schemas
// ============================================================================

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
