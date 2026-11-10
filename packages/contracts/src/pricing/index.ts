import { z } from "zod";
import { BAG_CATEGORIES, BagCategory } from "../capacity/index.js";

// ============================================================================
// Enums & Constants
// ============================================================================

export const PRICING_UNITS = ["CALENDAR_DAY", "24_HOUR_BLOCK"] as const;
export type PricingUnit = (typeof PRICING_UNITS)[number];

export const PRICING_POLICY_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type PricingPolicyStatus = (typeof PRICING_POLICY_STATUSES)[number];

export const DEFAULT_CATEGORY_MULTIPLIERS_BPS: Record<BagCategory, number> = {
  BAG_SMALL: 8000,    // 0.80x
  BAG_MEDIUM: 10000,  // 1.00x (Baseline)
  BAG_LARGE: 12000,   // 1.20x
  BAG_OVERSIZED: 15000 // 1.50x
};

// ============================================================================
// Entities & Models
// ============================================================================

export const PricingTierRateSchema = z.object({
  id: z.string().uuid(),
  policyId: z.string().uuid(),
  bagCategory: z.enum(BAG_CATEGORIES),
  rateMinor: z.number().int().nonnegative(),
  categoryMultiplierBps: z.number().int().positive().default(10000),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type PricingTierRate = z.infer<typeof PricingTierRateSchema>;

export const PricingPolicySchema = z.object({
  id: z.string().uuid(),
  locationId: z.string().uuid(),
  currency: z.string().length(3).default("LKR"),
  pricingUnit: z.enum(PRICING_UNITS).default("CALENDAR_DAY"),
  baseRateMinor: z.number().int().positive("Base rate in integer minor units must be positive"),
  status: z.enum(PRICING_POLICY_STATUSES).default("ACTIVE"),
  createdAt: z.string(),
  updatedAt: z.string(),
  tierRates: z.array(PricingTierRateSchema).default([])
});
export type PricingPolicy = z.infer<typeof PricingPolicySchema>;

// ============================================================================
// Request Schemas
// ============================================================================

export const TierRateInputSchema = z.object({
  bagCategory: z.enum(BAG_CATEGORIES),
  rateMinor: z.number().int().nonnegative("Rate must be non-negative integer minor units"),
  categoryMultiplierBps: z.number().int().positive("Multiplier must be positive basis points")
});
export type TierRateInput = z.infer<typeof TierRateInputSchema>;

export const ConfigurePricingPolicyRequestSchema = z.object({
  currency: z.string().trim().length(3).default("LKR"),
  pricingUnit: z.enum(PRICING_UNITS).default("CALENDAR_DAY"),
  baseRateMinor: z.number().int().positive("Base rate must be positive minor units (cents)"),
  tierRates: z.array(TierRateInputSchema).optional()
});
export type ConfigurePricingPolicyRequest = z.infer<typeof ConfigurePricingPolicyRequestSchema>;

