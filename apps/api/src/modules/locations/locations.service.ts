import { eq, and, asc, desc, sql, count, inArray } from "drizzle-orm";
import {
  CreateLocationRequest,
  UpdateLocationRequest,
  StorageLocation,
  OpeningHourItemInput,
  OpeningHours,
  CreateOpeningHoursExceptionRequest,
  OpeningHoursException,
  CreateStorageZoneRequest,
  UpdateStorageZoneRequest,
  StorageZone,
  AddLocationMediaRequest,
  UpdateLocationMediaRequest,
  LocationMedia,
  ReviewLocationRequest,
  LocationModerationQueueItem,
  SecurityEventType,
  DEFAULT_CATEGORY_MULTIPLIERS_BPS,
  BAG_CATEGORIES
} from "@luggage-storage/contracts";
import { db, schema } from "../../infrastructure/database/drizzle.js";
import { AppError } from "../../common/errors/app-error.js";
import { auditService } from "../audit/audit.service.js";
import {
  assertHostLocationAccess,
  getAccessibleHostLocationIds
} from "../bookings/host-access.helper.js";

export interface LocationCallerContext {
  userId: string;
  roles: string[];
  clientInfo?: {
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  };
}

export class LocationsService {
  /**
   * Creates a new storage location under an owned Host Business.
   * Auto-provisions default 7-day opening hours, default shared capacity pool, and initial pricing policy.
   */
  async createLocation(
    request: CreateLocationRequest,
    context: LocationCallerContext
  ): Promise<StorageLocation> {
    // 1. Verify business exists and caller is owner or superadmin
    const [business] = await db
      .select({
        id: schema.hostBusinesses.id,
        ownerUserId: schema.hostBusinesses.ownerUserId,
        status: schema.hostBusinesses.status
      })
      .from(schema.hostBusinesses)
      .where(eq(schema.hostBusinesses.id, request.businessId))
      .limit(1);

    if (!business) {
      throw AppError.notFound("Host business not found");
    }

    const isSuperadmin = context.roles.includes("SUPERADMIN");
    if (business.ownerUserId !== context.userId && !isSuperadmin) {
      throw AppError.forbidden("Access denied: You do not own this host business");
    }

    if (business.status === "SUSPENDED" || business.status === "REJECTED") {
      throw AppError.badRequest(`Cannot create storage locations for a ${business.status.toLowerCase()} business`);
    }

    const coordinatesEwkt = `SRID=4326;POINT(${request.longitude} ${request.latitude})`;
    const coarseLon = Number(request.longitude.toFixed(2));
    const coarseLat = Number(request.latitude.toFixed(2));
    const coarseCoordinatesEwkt = `SRID=4326;POINT(${coarseLon} ${coarseLat})`;

    const locationResult = await db.transaction(async (tx) => {
      // 2. Insert storage location
      const [loc] = await tx
        .insert(schema.storageLocations)
        .values({
          businessId: request.businessId,
          name: request.name,
          description: request.description || null,
          addressLine1: request.addressLine1,
          addressLine2: request.addressLine2 || null,
          city: request.city,
          postalCode: request.postalCode || null,
          countryCode: request.countryCode || "LK",
          latitude: request.latitude,
          longitude: request.longitude,
          coordinates: coordinatesEwkt,
          coarseCoordinates: coarseCoordinatesEwkt,
          timezone: request.timezone || "Asia/Colombo",
          bookingMode: request.bookingMode || "INSTANT",
          acceptsOversized: request.acceptsOversized ?? false,
          amenities: request.amenities || [],
          status: "DRAFT"
        })
        .returning();

      // 3. Create default 7-day recurring opening hours (08:00 - 20:00)
      const defaultHours = [1, 2, 3, 4, 5, 6, 7].map((day) => ({
        locationId: loc.id,
        dayOfWeek: day,
        openTime: "08:00:00",
        closeTime: "20:00:00",
        allowsDropoff: true,
        allowsCollection: true,
        isClosed: false
      }));
      await tx.insert(schema.openingHours).values(defaultHours);

      // 4. Create default storage zone
      const [zone] = await tx
        .insert(schema.storageZones)
        .values({
          locationId: loc.id,
          name: "Main Storage Area",
          zoneType: "BACKROOM",
          securityTier: "STANDARD",
          isActive: true
        })
        .returning();

      // 5. Create default shared capacity pool (20 units)
      await tx.insert(schema.storageCapacityPools).values({
        locationId: loc.id,
        zoneId: zone.id,
        poolType: "SHARED",
        totalUnits: 20,
        isActive: true
      });

      // 6. Create default pricing policy (LKR 1,000.00 / day)
      const baseRateMinor = 100000; // LKR 1,000.00
      const [policy] = await tx
        .insert(schema.pricingPolicies)
        .values({
          locationId: loc.id,
          currency: "LKR",
          pricingUnit: "CALENDAR_DAY",
          baseRateMinor,
          status: "ACTIVE"
        })
        .returning();

      const tierRates = BAG_CATEGORIES.map((cat) => {
        const bps = DEFAULT_CATEGORY_MULTIPLIERS_BPS[cat] || 10000;
        const rateMinor = Math.round((baseRateMinor * bps) / 10000);
        return {
          policyId: policy.id,
          bagCategory: cat,
          rateMinor,
          categoryMultiplierBps: bps
        };
      });
      await tx.insert(schema.pricingTierRates).values(tierRates);

      // 7. Audit log
      await auditService.recordEvent({
        eventType: SecurityEventType.STORAGE_LOCATION_CREATED,
        userId: context.userId,
        clientInfo: context.clientInfo,
        tx,
        metadata: {
          locationId: loc.id,
          businessId: loc.businessId,
          name: loc.name
        }
      });

      return loc;
    });

    return this.getLocationById(locationResult.id, context);
  }

  /**
   * Retrieves all storage locations owned by businesses belonging to the caller
   * or assigned to the caller as active host staff.
   */
  async getOwnedLocations(context: LocationCallerContext): Promise<StorageLocation[]> {
    const nonAdminRoles = context.roles.filter((r) => r !== "SUPERADMIN");
    const accessibleIds = await getAccessibleHostLocationIds(context.userId, nonAdminRoles);
    if (accessibleIds.length === 0) {
      return [];
    }

    const rows = await db
      .select({ id: schema.storageLocations.id })
      .from(schema.storageLocations)
      .where(inArray(schema.storageLocations.id, accessibleIds))
      .orderBy(desc(schema.storageLocations.createdAt));

    const locations: StorageLocation[] = [];
    for (const r of rows) {
      const loc = await this.getLocationById(r.id, context);
      locations.push(loc);
    }
    return locations;
  }

  private async assertLocationOwnerOrSuperadmin(
    locationId: string,
    context: LocationCallerContext
  ): Promise<void> {
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
      await auditService.recordEvent({
        eventType: SecurityEventType.AUTH_ACCESS_DENIED,
        userId: context.userId,
        clientInfo: context.clientInfo,
        metadata: {
          locationId,
          action: "LOCATION_WRITE_DENIED",
          roles: context.roles
        }
      });
      throw AppError.forbidden(
        "Access denied: Only the business owner or Superadmin can modify this storage location"
      );
    }
  }

  /**
   * Retrieves full location details with sub-entities, enforcing ownership, staff assignment, or admin read privileges.
   */
  async getLocationById(
    locationId: string,
    context: LocationCallerContext
  ): Promise<StorageLocation> {
    const [loc] = await db
      .select({
        location: schema.storageLocations,
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

    const isAdminOrSupport = context.roles.some((r) => ["SUPERADMIN", "SUPPORT"].includes(r));
    if (loc.ownerUserId !== context.userId && !isAdminOrSupport) {
      try {
        await assertHostLocationAccess(db, context.userId, context.roles, locationId);
      } catch {
        throw AppError.forbidden("Access denied: You do not have permission to view this location");
      }
    }

    const [images, zones, hours, exceptions] = await Promise.all([
      db
        .select()
        .from(schema.locationMedia)
        .where(eq(schema.locationMedia.locationId, locationId))
        .orderBy(schema.locationMedia.sortOrder),
      db
        .select()
        .from(schema.storageZones)
        .where(eq(schema.storageZones.locationId, locationId)),
      db
        .select()
        .from(schema.openingHours)
        .where(eq(schema.openingHours.locationId, locationId))
        .orderBy(schema.openingHours.dayOfWeek),
      db
        .select()
        .from(schema.openingHoursExceptions)
        .where(eq(schema.openingHoursExceptions.locationId, locationId))
        .orderBy(schema.openingHoursExceptions.exceptionDate)
    ]);

    return {
      id: loc.location.id,
      businessId: loc.location.businessId,
      name: loc.location.name,
      description: loc.location.description,
      addressLine1: loc.location.addressLine1,
      addressLine2: loc.location.addressLine2,
      city: loc.location.city,
      postalCode: loc.location.postalCode,
      countryCode: loc.location.countryCode,
      latitude: loc.location.latitude,
      longitude: loc.location.longitude,
      timezone: loc.location.timezone,
      bookingMode: loc.location.bookingMode as any,
      acceptsOversized: loc.location.acceptsOversized,
      amenities: (loc.location.amenities as string[]) || [],
      status: loc.location.status as any,
      rejectionReason: loc.location.rejectionReason,
      adminNotes: loc.location.adminNotes,
      reviewedBy: loc.location.reviewedBy,
      reviewedAt: loc.location.reviewedAt ? loc.location.reviewedAt.toISOString() : null,
      createdAt: loc.location.createdAt.toISOString(),
      updatedAt: loc.location.updatedAt.toISOString(),
      images: images.map((img) => ({
        id: img.id,
        locationId: img.locationId,
        fileKey: img.fileKey,
        url: img.url,
        mediaType: "IMAGE" as const,
        caption: img.caption,
        isPrimary: img.isPrimary,
        sortOrder: img.sortOrder,
        createdAt: img.createdAt.toISOString(),
        updatedAt: img.updatedAt.toISOString()
      })),
      zones: zones.map((z) => ({
        id: z.id,
        locationId: z.locationId,
        name: z.name,
        zoneType: z.zoneType as any,
        securityTier: z.securityTier as any,
        isActive: z.isActive,
        createdAt: z.createdAt.toISOString(),
        updatedAt: z.updatedAt.toISOString()
      })),
      openingHours: hours.map((h) => ({
        id: h.id,
        locationId: h.locationId,
        dayOfWeek: h.dayOfWeek,
        openTime: h.openTime,
        closeTime: h.closeTime,
        allowsDropoff: h.allowsDropoff,
        allowsCollection: h.allowsCollection,
        isClosed: h.isClosed,
        createdAt: h.createdAt.toISOString(),
        updatedAt: h.updatedAt.toISOString()
      })),
      exceptions: exceptions.map((e) => ({
        id: e.id,
        locationId: e.locationId,
        exceptionDate: e.exceptionDate,
        exceptionType: e.exceptionType as any,
        openTime: e.openTime,
        closeTime: e.closeTime,
        reason: e.reason,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString()
      }))
    };
  }

  /**
   * Updates basic details and coordinates of an owned storage location.
   */
  async updateLocation(
    locationId: string,
    request: UpdateLocationRequest,
    context: LocationCallerContext
  ): Promise<StorageLocation> {
    await this.assertLocationOwnerOrSuperadmin(locationId, context);
    const loc = await this.getLocationById(locationId, context);

    const [business] = await db
      .select({ status: schema.hostBusinesses.status })
      .from(schema.hostBusinesses)
      .where(eq(schema.hostBusinesses.id, loc.businessId))
      .limit(1);

    if (business && (business.status === "SUSPENDED" || business.status === "REJECTED")) {
      throw AppError.badRequest(`Cannot update locations for a ${business.status.toLowerCase()} business`);
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (request.name !== undefined) updateData.name = request.name;
    if (request.description !== undefined) updateData.description = request.description;
    if (request.addressLine1 !== undefined) updateData.addressLine1 = request.addressLine1;
    if (request.addressLine2 !== undefined) updateData.addressLine2 = request.addressLine2;
    if (request.city !== undefined) updateData.city = request.city;
    if (request.postalCode !== undefined) updateData.postalCode = request.postalCode;
    if (request.countryCode !== undefined) updateData.countryCode = request.countryCode;
    if (request.timezone !== undefined) updateData.timezone = request.timezone;
    if (request.bookingMode !== undefined) updateData.bookingMode = request.bookingMode;
    if (request.acceptsOversized !== undefined) updateData.acceptsOversized = request.acceptsOversized;
    if (request.amenities !== undefined) updateData.amenities = request.amenities;

    if (request.latitude !== undefined && request.longitude !== undefined) {
      updateData.latitude = request.latitude;
      updateData.longitude = request.longitude;
      updateData.coordinates = `SRID=4326;POINT(${request.longitude} ${request.latitude})`;
      const coarseLon = Number(request.longitude.toFixed(2));
      const coarseLat = Number(request.latitude.toFixed(2));
      updateData.coarseCoordinates = `SRID=4326;POINT(${coarseLon} ${coarseLat})`;
    }

    await db
      .update(schema.storageLocations)
      .set(updateData)
      .where(eq(schema.storageLocations.id, locationId));

    await auditService.recordEvent({
      eventType: SecurityEventType.STORAGE_LOCATION_UPDATED,
      userId: context.userId,
      clientInfo: context.clientInfo,
      metadata: { locationId, updatedFields: Object.keys(updateData) }
    });

    return this.getLocationById(locationId, context);
  }

  /**
   * Submits a storage location for Superadmin moderation.
   * Invariant: The owning Host Business must be in ACTIVE status before submitting locations!
   */
  async submitLocationForReview(
    locationId: string,
    context: LocationCallerContext
  ): Promise<StorageLocation> {
    await this.assertLocationOwnerOrSuperadmin(locationId, context);
    const loc = await this.getLocationById(locationId, context);

    const [business] = await db
      .select({ status: schema.hostBusinesses.status })
      .from(schema.hostBusinesses)
      .where(eq(schema.hostBusinesses.id, loc.businessId))
      .limit(1);

    if (!business || business.status !== "ACTIVE") {
      throw AppError.badRequest(
        "Your host business must be verified and active before submitting locations for review"
      );
    }

    if (loc.status === "ACTIVE") {
      throw AppError.badRequest("This storage location is already approved and active");
    }

    const openHours = await db
      .select({ id: schema.openingHours.id })
      .from(schema.openingHours)
      .where(
        and(
          eq(schema.openingHours.locationId, locationId),
          eq(schema.openingHours.isClosed, false)
        )
      )
      .limit(1);

    if (openHours.length === 0) {
      throw AppError.badRequest(
        "Configure at least one open day in weekly opening hours before submitting for review"
      );
    }

    const activePools = await db
      .select({ id: schema.storageCapacityPools.id })
      .from(schema.storageCapacityPools)
      .where(
        and(
          eq(schema.storageCapacityPools.locationId, locationId),
          eq(schema.storageCapacityPools.isActive, true)
        )
      )
      .limit(1);

    if (activePools.length === 0) {
      throw AppError.badRequest(
        "Configure at least one active capacity pool before submitting for review"
      );
    }

    const activePricing = await db
      .select({ id: schema.pricingPolicies.id })
      .from(schema.pricingPolicies)
      .where(
        and(
          eq(schema.pricingPolicies.locationId, locationId),
          eq(schema.pricingPolicies.status, "ACTIVE")
        )
      )
      .limit(1);

    if (activePricing.length === 0) {
      throw AppError.badRequest(
        "Configure an active pricing policy before submitting for review"
      );
    }

    await db
      .update(schema.storageLocations)
      .set({
        status: "PENDING_REVIEW",
        updatedAt: new Date()
      })
      .where(eq(schema.storageLocations.id, locationId));

    await auditService.recordEvent({
      eventType: SecurityEventType.STORAGE_LOCATION_SUBMITTED,
      userId: context.userId,
      clientInfo: context.clientInfo,
      metadata: { locationId, businessId: loc.businessId }
    });

    return this.getLocationById(locationId, context);
  }

  /**
   * Disables an active or pending location.
   */
  async disableLocation(
    locationId: string,
    context: LocationCallerContext
  ): Promise<StorageLocation> {
    await this.assertLocationOwnerOrSuperadmin(locationId, context);
    const loc = await this.getLocationById(locationId, context);

    await db
      .update(schema.storageLocations)
      .set({
        status: "DISABLED",
        updatedAt: new Date()
      })
      .where(eq(schema.storageLocations.id, locationId));

    await auditService.recordEvent({
      eventType: SecurityEventType.STORAGE_LOCATION_DISABLED,
      userId: context.userId,
      clientInfo: context.clientInfo,
      metadata: { locationId, businessId: loc.businessId }
    });

    return this.getLocationById(locationId, context);
  }

  /**
   * Sets weekly recurring opening hours for a storage location.
   */
  async setOpeningHours(
    locationId: string,
    schedules: OpeningHourItemInput[],
    context: LocationCallerContext
  ): Promise<void> {
    await this.assertLocationOwnerOrSuperadmin(locationId, context);
    await this.getLocationById(locationId, context); // load check

    // Validate schedules: openTime < closeTime when not closed
    for (const s of schedules) {
      if (!s.isClosed && s.openTime >= s.closeTime) {
        throw AppError.badRequest(`Day ${s.dayOfWeek}: openTime must be before closeTime`);
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(schema.openingHours)
        .where(eq(schema.openingHours.locationId, locationId));

      const rows = schedules.map((s) => ({
        locationId,
        dayOfWeek: s.dayOfWeek,
        openTime: s.openTime,
        closeTime: s.closeTime,
        allowsDropoff: s.allowsDropoff,
        allowsCollection: s.allowsCollection,
        isClosed: s.isClosed
      }));

      await tx.insert(schema.openingHours).values(rows);

      await auditService.recordEvent({
        eventType: SecurityEventType.STORAGE_LOCATION_CONFIG_UPDATED,
        userId: context.userId,
        clientInfo: context.clientInfo,
        tx,
        metadata: { locationId, configType: "OPENING_HOURS", scheduleCount: rows.length }
      });
    });
  }

  /**
   * Creates an opening hour exception (holiday closure, special hours).
   */
  async addOpeningHoursException(
    locationId: string,
    request: CreateOpeningHoursExceptionRequest,
    context: LocationCallerContext
  ): Promise<OpeningHoursException> {
    await this.assertLocationOwnerOrSuperadmin(locationId, context);
    await this.getLocationById(locationId, context);

    const [exception] = await db
      .insert(schema.openingHoursExceptions)
      .values({
        locationId,
        exceptionDate: request.exceptionDate,
        exceptionType: request.exceptionType || "CLOSURE",
        openTime: request.exceptionType === "CLOSURE" ? null : request.openTime || null,
        closeTime: request.exceptionType === "CLOSURE" ? null : request.closeTime || null,
        reason: request.reason || null
      })
      .onConflictDoUpdate({
        target: [schema.openingHoursExceptions.locationId, schema.openingHoursExceptions.exceptionDate],
        set: {
          exceptionType: request.exceptionType || "CLOSURE",
          openTime: request.exceptionType === "CLOSURE" ? null : request.openTime || null,
          closeTime: request.exceptionType === "CLOSURE" ? null : request.closeTime || null,
          reason: request.reason || null,
          updatedAt: new Date()
        }
      })
      .returning();

    await auditService.recordEvent({
      eventType: SecurityEventType.STORAGE_LOCATION_CONFIG_UPDATED,
      userId: context.userId,
      clientInfo: context.clientInfo,
      metadata: {
        locationId,
        configType: "EXCEPTION",
        exceptionId: exception.id,
        date: request.exceptionDate
      }
    });

    return {
      id: exception.id,
      locationId: exception.locationId,
      exceptionDate: exception.exceptionDate,
      exceptionType: exception.exceptionType as OpeningHoursException["exceptionType"],
      openTime: exception.openTime,
      closeTime: exception.closeTime,
      reason: exception.reason,
      createdAt: exception.createdAt.toISOString(),
      updatedAt: exception.updatedAt.toISOString()
    };
  }

  /**
   * Retrieves weekly recurring opening hours for a location.
   */
  async getOpeningHours(
    locationId: string,
    context: LocationCallerContext
  ): Promise<OpeningHours[]> {
    await this.assertLocationReadAccess(locationId, context);

    const rows = await db
      .select()
      .from(schema.openingHours)
      .where(eq(schema.openingHours.locationId, locationId))
      .orderBy(asc(schema.openingHours.dayOfWeek));

    return rows.map((row) => ({
      id: row.id,
      locationId: row.locationId,
      dayOfWeek: row.dayOfWeek,
      openTime: row.openTime,
      closeTime: row.closeTime,
      allowsDropoff: row.allowsDropoff,
      allowsCollection: row.allowsCollection,
      isClosed: row.isClosed,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    }));
  }

  /**
   * Retrieves date-specific opening hours exceptions for a location.
   */
  async getOpeningHoursExceptions(
    locationId: string,
    context: LocationCallerContext
  ): Promise<OpeningHoursException[]> {
    await this.assertLocationReadAccess(locationId, context);

    const rows = await db
      .select()
      .from(schema.openingHoursExceptions)
      .where(eq(schema.openingHoursExceptions.locationId, locationId))
      .orderBy(asc(schema.openingHoursExceptions.exceptionDate));

    return rows.map((row) => ({
      id: row.id,
      locationId: row.locationId,
      exceptionDate: row.exceptionDate,
      exceptionType: row.exceptionType as OpeningHoursException["exceptionType"],
      openTime: row.openTime,
      closeTime: row.closeTime,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    }));
  }

  /**
   * Deletes an opening hour exception from a location.
   */
  async deleteOpeningHoursException(
    locationId: string,
    exceptionId: string,
    context: LocationCallerContext
  ): Promise<void> {
    await this.assertLocationOwnerOrSuperadmin(locationId, context);

    const [deleted] = await db
      .delete(schema.openingHoursExceptions)
      .where(
        and(
          eq(schema.openingHoursExceptions.id, exceptionId),
          eq(schema.openingHoursExceptions.locationId, locationId)
        )
      )
      .returning();

    if (!deleted) {
      throw AppError.notFound("Opening hours exception not found");
    }

    await auditService.recordEvent({
      eventType: SecurityEventType.STORAGE_LOCATION_CONFIG_UPDATED,
      userId: context.userId,
      clientInfo: context.clientInfo,
      metadata: {
        locationId,
        exceptionId,
        configType: "EXCEPTION_DELETED"
      }
    });
  }

  /**
   * Retrieves storage zones for a location.
   */
  async getStorageZones(
    locationId: string,
    context: LocationCallerContext
  ): Promise<StorageZone[]> {
    await this.assertLocationReadAccess(locationId, context);

    const rows = await db
      .select()
      .from(schema.storageZones)
      .where(eq(schema.storageZones.locationId, locationId))
      .orderBy(asc(schema.storageZones.createdAt));

    return rows.map((row) => this.formatStorageZone(row));
  }

  /**
   * Adds a storage zone to a location.
   */
  async createStorageZone(
    locationId: string,
    request: CreateStorageZoneRequest,
    context: LocationCallerContext
  ): Promise<typeof schema.storageZones.$inferSelect> {
    await this.assertLocationOwnerOrSuperadmin(locationId, context);
    await this.getLocationById(locationId, context);

    const [zone] = await db
      .insert(schema.storageZones)
      .values({
        locationId,
        name: request.name,
        zoneType: request.zoneType || "BACKROOM",
        securityTier: request.securityTier || "STANDARD",
        isActive: request.isActive ?? true
      })
      .returning();

    await auditService.recordEvent({
      eventType: SecurityEventType.STORAGE_LOCATION_CONFIG_UPDATED,
      userId: context.userId,
      clientInfo: context.clientInfo,
      metadata: { locationId, configType: "ZONE_CREATED", zoneId: zone.id }
    });

    return zone;
  }

  /**
   * Links an uploaded media item to a storage location.
   */
  async addLocationMedia(
    locationId: string,
    request: AddLocationMediaRequest,
    context: LocationCallerContext
  ): Promise<typeof schema.locationMedia.$inferSelect> {
    await this.assertLocationOwnerOrSuperadmin(locationId, context);
    await this.getLocationById(locationId, context);

    return db.transaction(async (tx) => {
      // Check if upload intent exists for this fileKey and enforce lifecycle
      const intentRows = await tx.execute(
        sql`SELECT * FROM upload_intents WHERE file_key = ${request.fileKey} FOR UPDATE;`
      );
      const intent = intentRows.rows[0] as any;

      if (intent) {
        if (intent.status === "CONSUMED") {
          // Check if already attached to this location (idempotent replay)
          const [existing] = await tx
            .select()
            .from(schema.locationMedia)
            .where(eq(schema.locationMedia.fileKey, request.fileKey))
            .limit(1);

          if (existing && existing.locationId === locationId) {
            return existing;
          }
          throw AppError.conflict("Upload intent has already been consumed and cannot be reused");
        }

        if (intent.status !== "CONFIRMED") {
          throw AppError.badRequest(`Upload intent is not confirmed. Current status: ${intent.status}`);
        }

        if (intent.resource_id && intent.resource_id !== locationId) {
          throw AppError.forbidden("Access denied: Upload intent was created for a different location");
        }

        // Atomically transition intent to CONSUMED
        await tx
          .update(schema.uploadIntents)
          .set({ status: "CONSUMED", updatedAt: new Date() })
          .where(eq(schema.uploadIntents.id, intent.id));
      }

      // Check if media already inserted (idempotency)
      const [existingMedia] = await tx
        .select()
        .from(schema.locationMedia)
        .where(eq(schema.locationMedia.fileKey, request.fileKey))
        .limit(1);

      if (existingMedia) {
        return existingMedia;
      }

      if (request.isPrimary) {
        await tx
          .update(schema.locationMedia)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(eq(schema.locationMedia.locationId, locationId));
      }

      const [media] = await tx
        .insert(schema.locationMedia)
        .values({
          locationId,
          fileKey: request.fileKey,
          url: request.url,
          mediaType: "IMAGE",
          caption: request.caption || null,
          isPrimary: request.isPrimary ?? false,
          sortOrder: request.sortOrder ?? 0
        })
        .returning();

      await auditService.recordEvent({
        eventType: SecurityEventType.UPLOAD_MEDIA_CONFIRMED,
        userId: context.userId,
        clientInfo: context.clientInfo,
        tx,
        metadata: { locationId, mediaId: media.id, fileKey: request.fileKey }
      });

      return media;
    });
  }

  /**
   * Updates an existing storage zone (rejects deactivation when active custody exists).
   */
  async updateStorageZone(
    locationId: string,
    zoneId: string,
    request: UpdateStorageZoneRequest,
    context: LocationCallerContext
  ): Promise<StorageZone> {
    await this.assertLocationOwnerOrSuperadmin(locationId, context);

    const [existing] = await db
      .select()
      .from(schema.storageZones)
      .where(
        and(
          eq(schema.storageZones.id, zoneId),
          eq(schema.storageZones.locationId, locationId)
        )
      )
      .limit(1);

    if (!existing) {
      throw AppError.notFound("Storage zone not found");
    }

    if (request.isActive === false) {
      await this.assertActiveCustodyFreeForZone(zoneId);
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (request.name !== undefined) updateData.name = request.name;
    if (request.zoneType !== undefined) updateData.zoneType = request.zoneType;
    if (request.securityTier !== undefined) updateData.securityTier = request.securityTier;
    if (request.isActive !== undefined) updateData.isActive = request.isActive;

    const [updated] = await db
      .update(schema.storageZones)
      .set(updateData)
      .where(
        and(
          eq(schema.storageZones.id, zoneId),
          eq(schema.storageZones.locationId, locationId)
        )
      )
      .returning();

    await auditService.recordEvent({
      eventType: SecurityEventType.STORAGE_LOCATION_CONFIG_UPDATED,
      userId: context.userId,
      clientInfo: context.clientInfo,
      metadata: {
        locationId,
        zoneId,
        configType: "ZONE_UPDATED",
        isActive: updated.isActive
      }
    });

    return this.formatStorageZone(updated);
  }

  /**
   * Deletes a storage zone (rejects when active custody holds bags in the zone).
   */
  async deleteStorageZone(
    locationId: string,
    zoneId: string,
    context: LocationCallerContext
  ): Promise<void> {
    await this.assertLocationOwnerOrSuperadmin(locationId, context);

    const [existing] = await db
      .select()
      .from(schema.storageZones)
      .where(
        and(
          eq(schema.storageZones.id, zoneId),
          eq(schema.storageZones.locationId, locationId)
        )
      )
      .limit(1);

    if (!existing) {
      throw AppError.notFound("Storage zone not found");
    }

    await this.assertActiveCustodyFreeForZone(zoneId);

    await db
      .delete(schema.storageZones)
      .where(
        and(
          eq(schema.storageZones.id, zoneId),
          eq(schema.storageZones.locationId, locationId)
        )
      );

    await auditService.recordEvent({
      eventType: SecurityEventType.STORAGE_LOCATION_CONFIG_UPDATED,
      userId: context.userId,
      clientInfo: context.clientInfo,
      metadata: {
        locationId,
        zoneId,
        configType: "ZONE_DELETED"
      }
    });
  }

  /**
   * Lists media items attached to a storage location.
   */
  async getLocationMedia(
    locationId: string,
    context: LocationCallerContext
  ): Promise<LocationMedia[]> {
    await this.assertLocationReadAccess(locationId, context);

    const rows = await db
      .select()
      .from(schema.locationMedia)
      .where(eq(schema.locationMedia.locationId, locationId))
      .orderBy(
        desc(schema.locationMedia.isPrimary),
        asc(schema.locationMedia.sortOrder),
        asc(schema.locationMedia.createdAt)
      );

    return rows.map((row) => this.formatLocationMedia(row));
  }

  /**
   * Updates media item metadata or atomically sets it as the primary location photo.
   */
  async updateLocationMedia(
    locationId: string,
    mediaId: string,
    request: UpdateLocationMediaRequest,
    context: LocationCallerContext
  ): Promise<LocationMedia> {
    await this.assertLocationOwnerOrSuperadmin(locationId, context);

    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(schema.locationMedia)
        .where(
          and(
            eq(schema.locationMedia.id, mediaId),
            eq(schema.locationMedia.locationId, locationId)
          )
        )
        .limit(1);

      if (!existing) {
        throw AppError.notFound("Location media item not found");
      }

      if (request.isPrimary === true) {
        await tx
          .update(schema.locationMedia)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(eq(schema.locationMedia.locationId, locationId));
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (request.caption !== undefined) updateData.caption = request.caption;
      if (request.isPrimary !== undefined) updateData.isPrimary = request.isPrimary;
      if (request.sortOrder !== undefined) updateData.sortOrder = request.sortOrder;

      const [saved] = await tx
        .update(schema.locationMedia)
        .set(updateData)
        .where(
          and(
            eq(schema.locationMedia.id, mediaId),
            eq(schema.locationMedia.locationId, locationId)
          )
        )
        .returning();

      await auditService.recordEvent({
        eventType: SecurityEventType.STORAGE_LOCATION_CONFIG_UPDATED,
        userId: context.userId,
        clientInfo: context.clientInfo,
        tx,
        metadata: {
          locationId,
          mediaId,
          configType: "MEDIA_UPDATED"
        }
      });

      return saved;
    });

    return this.formatLocationMedia(updated);
  }

  /**
   * Deletes a media item from a location (promoting another image if primary was deleted).
   */
  async deleteLocationMedia(
    locationId: string,
    mediaId: string,
    context: LocationCallerContext
  ): Promise<void> {
    await this.assertLocationOwnerOrSuperadmin(locationId, context);

    await db.transaction(async (tx) => {
      const [deleted] = await tx
        .delete(schema.locationMedia)
        .where(
          and(
            eq(schema.locationMedia.id, mediaId),
            eq(schema.locationMedia.locationId, locationId)
          )
        )
        .returning();

      if (!deleted) {
        throw AppError.notFound("Location media item not found");
      }

      if (deleted.isPrimary) {
        const [nextImage] = await tx
          .select()
          .from(schema.locationMedia)
          .where(eq(schema.locationMedia.locationId, locationId))
          .orderBy(asc(schema.locationMedia.sortOrder), asc(schema.locationMedia.createdAt))
          .limit(1);

        if (nextImage) {
          await tx
            .update(schema.locationMedia)
            .set({ isPrimary: true, updatedAt: new Date() })
            .where(eq(schema.locationMedia.id, nextImage.id));
        }
      }

      await auditService.recordEvent({
        eventType: SecurityEventType.STORAGE_LOCATION_CONFIG_UPDATED,
        userId: context.userId,
        clientInfo: context.clientInfo,
        tx,
        metadata: {
          locationId,
          mediaId,
          configType: "MEDIA_DELETED"
        }
      });
    });
  }

  private async assertLocationReadAccess(
    locationId: string,
    context: LocationCallerContext
  ): Promise<void> {
    const [loc] = await db
      .select({ id: schema.storageLocations.id })
      .from(schema.storageLocations)
      .where(eq(schema.storageLocations.id, locationId))
      .limit(1);

    if (!loc) {
      throw AppError.notFound("Storage location not found");
    }

    if (context.roles.includes("SUPERADMIN") || context.roles.includes("SUPPORT")) {
      return;
    }

    await assertHostLocationAccess(db, context.userId, context.roles, locationId);
  }

  private async assertActiveCustodyFreeForZone(zoneId: string): Promise<void> {
    const activeStatuses = ["CHECKED_IN", "PARTIALLY_CHECKED_IN", "DISPUTED"];

    const [activeRecord] = await db
      .select({ id: schema.custodyRecords.id })
      .from(schema.custodyRecords)
      .where(
        and(
          eq(schema.custodyRecords.zoneId, zoneId),
          inArray(schema.custodyRecords.status, activeStatuses)
        )
      )
      .limit(1);

    if (activeRecord) {
      throw AppError.conflict(
        "Cannot deactivate or delete a storage zone with active checked-in custody records"
      );
    }

    const [activeBagItem] = await db
      .select({ id: schema.bagCustodyItems.id })
      .from(schema.bagCustodyItems)
      .innerJoin(
        schema.custodyRecords,
        eq(schema.bagCustodyItems.custodyRecordId, schema.custodyRecords.id)
      )
      .where(
        and(
          eq(schema.bagCustodyItems.zoneId, zoneId),
          inArray(schema.custodyRecords.status, activeStatuses)
        )
      )
      .limit(1);

    if (activeBagItem) {
      throw AppError.conflict(
        "Cannot deactivate or delete a storage zone with bags currently held in custody"
      );
    }
  }

  private formatStorageZone(zone: typeof schema.storageZones.$inferSelect): StorageZone {
    return {
      id: zone.id,
      locationId: zone.locationId,
      name: zone.name,
      zoneType: zone.zoneType as StorageZone["zoneType"],
      securityTier: zone.securityTier as StorageZone["securityTier"],
      isActive: zone.isActive,
      createdAt: zone.createdAt.toISOString(),
      updatedAt: zone.updatedAt.toISOString()
    };
  }

  private formatLocationMedia(media: typeof schema.locationMedia.$inferSelect): LocationMedia {
    return {
      id: media.id,
      locationId: media.locationId,
      fileKey: media.fileKey,
      url: media.url,
      mediaType: media.mediaType as LocationMedia["mediaType"],
      caption: media.caption,
      isPrimary: media.isPrimary,
      sortOrder: media.sortOrder,
      createdAt: media.createdAt.toISOString(),
      updatedAt: media.updatedAt.toISOString()
    };
  }

  // ============================================================================
  // Superadmin Moderation Methods
  // ============================================================================

  /**
   * Retrieves pending storage locations requiring Superadmin review.
   */
  async getPendingLocationsQueue(limit = 20, offset = 0): Promise<{
    queue: LocationModerationQueueItem[];
    total: number;
  }> {
    const rows = await db
      .select({
        locationId: schema.storageLocations.id,
        businessId: schema.storageLocations.businessId,
        businessName: schema.hostBusinesses.tradeName,
        name: schema.storageLocations.name,
        city: schema.storageLocations.city,
        addressLine1: schema.storageLocations.addressLine1,
        status: schema.storageLocations.status,
        submittedAt: schema.storageLocations.updatedAt
      })
      .from(schema.storageLocations)
      .innerJoin(
        schema.hostBusinesses,
        eq(schema.storageLocations.businessId, schema.hostBusinesses.id)
      )
      .where(eq(schema.storageLocations.status, "PENDING_REVIEW"))
      .orderBy(desc(schema.storageLocations.updatedAt))
      .limit(limit)
      .offset(offset);

    const [totalRes] = await db
      .select({ val: count() })
      .from(schema.storageLocations)
      .where(eq(schema.storageLocations.status, "PENDING_REVIEW"));

    const queue: LocationModerationQueueItem[] = [];
    for (const r of rows) {
      const [imgRes] = await db
        .select({ val: count() })
        .from(schema.locationMedia)
        .where(eq(schema.locationMedia.locationId, r.locationId));

      queue.push({
        locationId: r.locationId,
        businessId: r.businessId,
        businessName: r.businessName,
        name: r.name,
        city: r.city,
        addressLine1: r.addressLine1,
        status: r.status as any,
        imageCount: imgRes?.val ?? 0,
        submittedAt: r.submittedAt.toISOString()
      });
    }

    return {
      queue,
      total: totalRes?.val ?? 0
    };
  }

  /**
   * Superadmin reviews and approves or rejects a storage location listing.
   * Invariant: A host owner cannot approve their own location listing!
   */
  async reviewLocation(
    locationId: string,
    review: ReviewLocationRequest,
    context: LocationCallerContext
  ): Promise<StorageLocation> {
    const [loc] = await db
      .select({
        id: schema.storageLocations.id,
        businessId: schema.storageLocations.businessId,
        status: schema.storageLocations.status,
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

    // Security Invariant: Host cannot approve own location
    if (loc.ownerUserId === context.userId) {
      await auditService.recordEvent({
        eventType: SecurityEventType.AUTH_ACCESS_DENIED,
        userId: context.userId,
        clientInfo: context.clientInfo,
        metadata: {
          action: "SELF_LOCATION_MODERATION_ATTEMPT",
          locationId
        }
      });
      throw AppError.forbidden("Security violation: Host owners cannot approve their own storage locations");
    }

    const nextStatus = review.decision === "APPROVE" ? "ACTIVE" : "REJECTED";
    const auditEventType =
      review.decision === "APPROVE"
        ? SecurityEventType.STORAGE_LOCATION_APPROVED
        : SecurityEventType.STORAGE_LOCATION_REJECTED;

    await db
      .update(schema.storageLocations)
      .set({
        status: nextStatus,
        rejectionReason: review.rejectionReason || null,
        adminNotes: review.adminNotes || null,
        reviewedBy: context.userId,
        reviewedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(schema.storageLocations.id, locationId));

    await auditService.recordEvent({
      eventType: auditEventType,
      userId: context.userId,
      clientInfo: context.clientInfo,
      metadata: {
        locationId,
        decision: review.decision,
        rejectionReason: review.rejectionReason || null
      }
    });

    return this.getLocationById(locationId, context);
  }
}

export const locationsService = new LocationsService();

