import { eq, desc } from "drizzle-orm";
import {
  ConfigurePricingPolicyRequest,
  PricingPolicy,
  SecurityEventType,
  BAG_CATEGORIES,
  DEFAULT_CATEGORY_MULTIPLIERS_BPS
} from "@luggage-storage/contracts";
import { db, schema } from "../../infrastructure/database/drizzle.js";
import { AppError } from "../../common/errors/app-error.js";
import { auditService } from "../audit/audit.service.js";

export interface PricingContext {
  userId: string;
  roles: string[];
  clientInfo?: {
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  };
}

export class PricingService {
  /**
   * Retrieves the current active pricing policy for a storage location.
   */
  async getPricingPolicy(
    locationId: string,
    context: PricingContext
  ): Promise<PricingPolicy> {
    await this.verifyLocationAccess(locationId, context);

    const [policy] = await db
      .select()
      .from(schema.pricingPolicies)
      .where(
        eq(schema.pricingPolicies.locationId, locationId)
      )
      .orderBy(desc(schema.pricingPolicies.createdAt))
      .limit(1);

    if (!policy) {
      throw AppError.notFound("Pricing policy not found for this location");
    }

    const tiers = await db
      .select()
      .from(schema.pricingTierRates)
      .where(eq(schema.pricingTierRates.policyId, policy.id));

    return {
      id: policy.id,
      locationId: policy.locationId,
      currency: policy.currency,
      pricingUnit: policy.pricingUnit as any,
      baseRateMinor: policy.baseRateMinor,
      status: policy.status as any,
      createdAt: policy.createdAt.toISOString(),
      updatedAt: policy.updatedAt.toISOString(),
      tierRates: tiers.map((t) => ({
        id: t.id,
        policyId: t.policyId,
        bagCategory: t.bagCategory as any,
        rateMinor: t.rateMinor,
        categoryMultiplierBps: t.categoryMultiplierBps,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString()
      }))
    };
  }

  /**
   * Configures or updates the pricing policy and category multipliers for a location.
   * Enforces integer minor units arithmetic.
   */
  async configurePricingPolicy(
    locationId: string,
    request: ConfigurePricingPolicyRequest,
    context: PricingContext
  ): Promise<PricingPolicy> {
    await this.verifyLocationAccess(locationId, context);

    const result = await db.transaction(async (tx) => {
      // Find or create policy
      const [existing] = await tx
        .select()
        .from(schema.pricingPolicies)
        .where(eq(schema.pricingPolicies.locationId, locationId))
        .limit(1);

      let policyId: string;
      let policyRecord: typeof schema.pricingPolicies.$inferSelect;

      if (existing) {
        const [updated] = await tx
          .update(schema.pricingPolicies)
          .set({
            currency: request.currency || "LKR",
            pricingUnit: request.pricingUnit || "CALENDAR_DAY",
            baseRateMinor: request.baseRateMinor,
            status: "ACTIVE",
            updatedAt: new Date()
          })
          .where(eq(schema.pricingPolicies.id, existing.id))
          .returning();
        policyId = updated.id;
        policyRecord = updated;
      } else {
        const [created] = await tx
          .insert(schema.pricingPolicies)
          .values({
            locationId,
            currency: request.currency || "LKR",
            pricingUnit: request.pricingUnit || "CALENDAR_DAY",
            baseRateMinor: request.baseRateMinor,
            status: "ACTIVE"
          })
          .returning();
        policyId = created.id;
        policyRecord = created;
      }

      // Re-create or upsert tier rates
      await tx
        .delete(schema.pricingTierRates)
        .where(eq(schema.pricingTierRates.policyId, policyId));

      const tiersToInsert = BAG_CATEGORIES.map((cat) => {
        const customTier = request.tierRates?.find((t) => t.bagCategory === cat);
        const bps =
          customTier?.categoryMultiplierBps ||
          DEFAULT_CATEGORY_MULTIPLIERS_BPS[cat] ||
          10000;
        const rateMinor =
          customTier?.rateMinor !== undefined
            ? customTier.rateMinor
            : Math.round((request.baseRateMinor * bps) / 10000);

        return {
          policyId,
          bagCategory: cat,
          rateMinor,
          categoryMultiplierBps: bps
        };
      });

      const insertedTiers = await tx
        .insert(schema.pricingTierRates)
        .values(tiersToInsert)
        .returning();

      await auditService.recordEvent({
        eventType: SecurityEventType.STORAGE_LOCATION_CONFIG_UPDATED,
        userId: context.userId,
        clientInfo: context.clientInfo,
        tx,
        metadata: {
          locationId,
          configType: "PRICING_POLICY_CONFIGURED",
          policyId,
          baseRateMinor: request.baseRateMinor
        }
      });

      return {
        policy: policyRecord,
        tierRates: insertedTiers
      };
    });

    return {
      id: result.policy.id,
      locationId: result.policy.locationId,
      currency: result.policy.currency,
      pricingUnit: result.policy.pricingUnit as any,
      baseRateMinor: result.policy.baseRateMinor,
      status: result.policy.status as any,
      createdAt: result.policy.createdAt.toISOString(),
      updatedAt: result.policy.updatedAt.toISOString(),
      tierRates: result.tierRates.map((t) => ({
        id: t.id,
        policyId: t.policyId,
        bagCategory: t.bagCategory as any,
        rateMinor: t.rateMinor,
        categoryMultiplierBps: t.categoryMultiplierBps,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString()
      }))
    };
  }

  private async verifyLocationAccess(locationId: string, context: PricingContext): Promise<void> {
    const [loc] = await db
      .select({
        id: schema.storageLocations.id,
        ownerUserId: schema.hostBusinesses.ownerUserId
      })
      .from(schema.storageLocations)
      .innerJoin(
        schema.hostBusinesses,
        eq(schema.storageLocations.businessId, schema.hostBusinesses.id)
      )
      .where(eq(schema.storageLocations.id, locationId))
      .limit(1);

    if (!loc) {
      throw AppError.notFound("Storage location not found");
    }

    const isSuperadmin = context.roles.includes("SUPERADMIN");
    if (loc.ownerUserId !== context.userId && !isSuperadmin) {
      throw AppError.forbidden("Access denied: You do not have permission to manage pricing for this location");
    }
  }
}

export const pricingService = new PricingService();

