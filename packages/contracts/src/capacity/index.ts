import { z } from "zod";

// ============================================================================
// Enums & Constants
// ============================================================================

export const BAG_CATEGORIES = [
  "BAG_SMALL",
  "BAG_MEDIUM",
  "BAG_LARGE",
  "BAG_OVERSIZED"
] as const;
export type BagCategory = (typeof BAG_CATEGORIES)[number];

export const CAPACITY_POOL_TYPES = ["SHARED", "DEDICATED"] as const;
export type CapacityPoolType = (typeof CAPACITY_POOL_TYPES)[number];

export const STANDARD_BAG_UNIT_CONSUMPTION: Record<BagCategory, number> = {
  BAG_SMALL: 1,
  BAG_MEDIUM: 1,
  BAG_LARGE: 2,
  BAG_OVERSIZED: 4
};

// ============================================================================
// Entities & Models
// ============================================================================

export const StorageCapacityPoolSchema = z.object({
  id: z.string().uuid(),
  locationId: z.string().uuid(),
  zoneId: z.string().uuid().nullable().optional(),
  poolType: z.enum(CAPACITY_POOL_TYPES),
  dedicatedBagCategory: z.enum(BAG_CATEGORIES).nullable().optional(),
  totalUnits: z.number().int().positive(),
  isActive: z.boolean().default(true),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type StorageCapacityPool = z.infer<typeof StorageCapacityPoolSchema>;

// ============================================================================
// Request Schemas
// ============================================================================

export const BaseCapacityPoolInputSchema = z.object({
  zoneId: z.string().uuid().optional().nullable(),
  poolType: z.enum(CAPACITY_POOL_TYPES).default("SHARED"),
  dedicatedBagCategory: z.enum(BAG_CATEGORIES).optional().nullable(),
  totalUnits: z.number().int().positive("Total units must be at least 1"),
  isActive: z.boolean().default(true)
});

export const CreateCapacityPoolRequestSchema = BaseCapacityPoolInputSchema.refine(
  (data) => {
    if (data.poolType === "DEDICATED") {
      return Boolean(data.dedicatedBagCategory);
    }
    return true;
  },
  {
    message: "dedicatedBagCategory is required when poolType is DEDICATED",
    path: ["dedicatedBagCategory"]
  }
);
export type CreateCapacityPoolRequest = z.infer<typeof CreateCapacityPoolRequestSchema>;

export const UpdateCapacityPoolRequestSchema = BaseCapacityPoolInputSchema.partial();
export type UpdateCapacityPoolRequest = z.infer<typeof UpdateCapacityPoolRequestSchema>;

export const CapacityPoolListResponseSchema = z.object({
  pools: z.array(StorageCapacityPoolSchema)
});
export type CapacityPoolListResponse = z.infer<typeof CapacityPoolListResponseSchema>;
