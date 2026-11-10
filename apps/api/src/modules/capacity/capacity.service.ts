import { eq } from "drizzle-orm";
import {
  CreateCapacityPoolRequest,
  UpdateCapacityPoolRequest,
  StorageCapacityPool,
  SecurityEventType
} from "@luggage-storage/contracts";
import { db, schema } from "../../infrastructure/database/drizzle.js";
import { AppError } from "../../common/errors/app-error.js";
import { auditService } from "../audit/audit.service.js";

export interface CapacityContext {
  userId: string;
  roles: string[];
  clientInfo?: {
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  };
}

export class CapacityService {
  /**
   * Retrieves all capacity pools configured for a location.
   */
  async getCapacityPools(
    locationId: string,
    context: CapacityContext
  ): Promise<StorageCapacityPool[]> {
    await this.verifyLocationAccess(locationId, context);

    const pools = await db
      .select()
      .from(schema.storageCapacityPools)
      .where(eq(schema.storageCapacityPools.locationId, locationId));

    return pools.map((p) => ({
      id: p.id,
      locationId: p.locationId,
      zoneId: p.zoneId,
      poolType: p.poolType as any,
      dedicatedBagCategory: p.dedicatedBagCategory as any,
      totalUnits: p.totalUnits,
      isActive: p.isActive,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString()
    }));
  }

  /**
   * Adds a new capacity pool to a location.
   */
  async createCapacityPool(
    locationId: string,
    request: CreateCapacityPoolRequest,
    context: CapacityContext
  ): Promise<StorageCapacityPool> {
    await this.verifyLocationAccess(locationId, context);

    const [pool] = await db
      .insert(schema.storageCapacityPools)
      .values({
        locationId,
        zoneId: request.zoneId || null,
        poolType: request.poolType,
        dedicatedBagCategory: request.dedicatedBagCategory || null,
        totalUnits: request.totalUnits,
        isActive: request.isActive ?? true
      })
      .returning();

    await auditService.recordEvent({
      eventType: SecurityEventType.STORAGE_LOCATION_CONFIG_UPDATED,
      userId: context.userId,
      clientInfo: context.clientInfo,
      metadata: {
        locationId,
        configType: "CAPACITY_POOL_CREATED",
        poolId: pool.id,
        totalUnits: pool.totalUnits
      }
    });

    return {
      id: pool.id,
      locationId: pool.locationId,
      zoneId: pool.zoneId,
      poolType: pool.poolType as any,
      dedicatedBagCategory: pool.dedicatedBagCategory as any,
      totalUnits: pool.totalUnits,
      isActive: pool.isActive,
      createdAt: pool.createdAt.toISOString(),
      updatedAt: pool.updatedAt.toISOString()
    };
  }

  /**
   * Updates an existing capacity pool.
   */
  async updateCapacityPool(
    poolId: string,
    request: UpdateCapacityPoolRequest,
    context: CapacityContext
  ): Promise<StorageCapacityPool> {
    const [existing] = await db
      .select({
        pool: schema.storageCapacityPools,
        ownerUserId: schema.hostBusinesses.ownerUserId
      })
      .from(schema.storageCapacityPools)
      .innerJoin(
        schema.storageLocations,
        eq(schema.storageCapacityPools.locationId, schema.storageLocations.id)
      )
      .innerJoin(
        schema.hostBusinesses,
        eq(schema.storageLocations.businessId, schema.hostBusinesses.id)
      )
      .where(eq(schema.storageCapacityPools.id, poolId))
      .limit(1);

    if (!existing) {
      throw AppError.notFound("Capacity pool not found");
    }

    const isSuperadmin = context.roles.includes("SUPERADMIN");
    if (existing.ownerUserId !== context.userId && !isSuperadmin) {
      throw AppError.forbidden("Access denied: You do not own this capacity pool");
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (request.zoneId !== undefined) updateData.zoneId = request.zoneId;
    if (request.poolType !== undefined) updateData.poolType = request.poolType;
    if (request.dedicatedBagCategory !== undefined)
      updateData.dedicatedBagCategory = request.dedicatedBagCategory;
    if (request.totalUnits !== undefined) updateData.totalUnits = request.totalUnits;
    if (request.isActive !== undefined) updateData.isActive = request.isActive;

    const [updated] = await db
      .update(schema.storageCapacityPools)
      .set(updateData)
      .where(eq(schema.storageCapacityPools.id, poolId))
      .returning();

    await auditService.recordEvent({
      eventType: SecurityEventType.STORAGE_LOCATION_CONFIG_UPDATED,
      userId: context.userId,
      clientInfo: context.clientInfo,
      metadata: {
        poolId,
        configType: "CAPACITY_POOL_UPDATED",
        updatedFields: Object.keys(updateData)
      }
    });

    return {
      id: updated.id,
      locationId: updated.locationId,
      zoneId: updated.zoneId,
      poolType: updated.poolType as any,
      dedicatedBagCategory: updated.dedicatedBagCategory as any,
      totalUnits: updated.totalUnits,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString()
    };
  }

  private async verifyLocationAccess(locationId: string, context: CapacityContext): Promise<void> {
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
      throw AppError.forbidden("Access denied: You do not have permission to manage this location");
    }
  }
}

export const capacityService = new CapacityService();

