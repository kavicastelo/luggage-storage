import { and, eq } from "drizzle-orm";
import {
  CreateCapacityPoolRequest,
  UpdateCapacityPoolRequest,
  StorageCapacityPool,
  SecurityEventType
} from "@luggage-storage/contracts";
import { db, schema } from "../../infrastructure/database/drizzle.js";
import { AppError } from "../../common/errors/app-error.js";
import { auditService } from "../audit/audit.service.js";
import { assertHostLocationAccess } from "../bookings/host-access.helper.js";

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
    await this.verifyLocationReadAccess(locationId, context);

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
    await this.verifyLocationWriteAccess(locationId, context);

    if (request.poolType === "DEDICATED" && !request.dedicatedBagCategory) {
      throw AppError.badRequest("Dedicated capacity pools require a dedicatedBagCategory");
    }

    if (request.poolType === "SHARED" && request.dedicatedBagCategory) {
      throw AppError.badRequest("Shared capacity pools cannot specify a dedicatedBagCategory");
    }

    if (request.zoneId) {
      await this.assertZoneBelongsToLocation(request.zoneId, locationId);
    }

    const [pool] = await db
      .insert(schema.storageCapacityPools)
      .values({
        locationId,
        zoneId: request.zoneId || null,
        poolType: request.poolType,
        dedicatedBagCategory:
          request.poolType === "DEDICATED" ? request.dedicatedBagCategory || null : null,
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

    const nextPoolType = request.poolType ?? existing.pool.poolType;
    const nextCategory =
      request.dedicatedBagCategory !== undefined
        ? request.dedicatedBagCategory
        : existing.pool.dedicatedBagCategory;

    if (nextPoolType === "DEDICATED" && !nextCategory) {
      throw AppError.badRequest("Dedicated capacity pools require a dedicatedBagCategory");
    }

    if (request.zoneId) {
      await this.assertZoneBelongsToLocation(request.zoneId, existing.pool.locationId);
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (request.zoneId !== undefined) updateData.zoneId = request.zoneId;
    if (request.poolType !== undefined) {
      updateData.poolType = request.poolType;
      if (request.poolType === "SHARED") {
        updateData.dedicatedBagCategory = null;
      }
    }
    if (request.dedicatedBagCategory !== undefined && nextPoolType === "DEDICATED") {
      updateData.dedicatedBagCategory = request.dedicatedBagCategory;
    }
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

  /**
   * Deletes an existing capacity pool.
   */
  async deleteCapacityPool(poolId: string, context: CapacityContext): Promise<void> {
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

    await db
      .delete(schema.storageCapacityPools)
      .where(eq(schema.storageCapacityPools.id, poolId));

    await auditService.recordEvent({
      eventType: SecurityEventType.STORAGE_LOCATION_CONFIG_UPDATED,
      userId: context.userId,
      clientInfo: context.clientInfo,
      metadata: {
        locationId: existing.pool.locationId,
        poolId,
        configType: "CAPACITY_POOL_DELETED"
      }
    });
  }

  private async assertZoneBelongsToLocation(zoneId: string, locationId: string): Promise<void> {
    const [zone] = await db
      .select({ id: schema.storageZones.id })
      .from(schema.storageZones)
      .where(
        and(
          eq(schema.storageZones.id, zoneId),
          eq(schema.storageZones.locationId, locationId)
        )
      )
      .limit(1);

    if (!zone) {
      throw AppError.badRequest("Selected storage zone does not belong to this location");
    }
  }

  private async verifyLocationReadAccess(
    locationId: string,
    context: CapacityContext
  ): Promise<void> {
    if (context.roles.includes("SUPERADMIN") || context.roles.includes("SUPPORT")) {
      const [loc] = await db
        .select({ id: schema.storageLocations.id })
        .from(schema.storageLocations)
        .where(eq(schema.storageLocations.id, locationId))
        .limit(1);
      if (!loc) {
        throw AppError.notFound("Storage location not found");
      }
      return;
    }

    await assertHostLocationAccess(db, context.userId, context.roles, locationId);
  }

  private async verifyLocationWriteAccess(
    locationId: string,
    context: CapacityContext
  ): Promise<void> {
    const [loc] = await db
      .select({
        id: schema.storageLocations.id,
        ownerUserId: schema.hostBusinesses.ownerUserId,
        businessStatus: schema.hostBusinesses.status
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

    if (loc.businessStatus === "SUSPENDED" || loc.businessStatus === "REJECTED") {
      throw AppError.badRequest(`Cannot manage capacity for a location belonging to a ${loc.businessStatus.toLowerCase()} business`);
    }
  }
}

export const capacityService = new CapacityService();

