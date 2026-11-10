import { eq, and, desc, sql, count } from "drizzle-orm";
import {
  CreateLocationRequest,
  UpdateLocationRequest,
  StorageLocation,
  OpeningHourItemInput,
  CreateOpeningHoursExceptionRequest,
  CreateStorageZoneRequest,
  AddLocationMediaRequest,
  ReviewLocationRequest,
  LocationModerationQueueItem,
  SecurityEventType,
  DEFAULT_CATEGORY_MULTIPLIERS_BPS,
  BAG_CATEGORIES
} from "@luggage-storage/contracts";
import { db, schema } from "../../infrastructure/database/drizzle.js";
import { AppError } from "../../common/errors/app-error.js";
import { auditService } from "../audit/audit.service.js";

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
   * Retrieves all storage locations owned by businesses belonging to the caller.
   */
  async getOwnedLocations(context: LocationCallerContext): Promise<StorageLocation[]> {
    const rows = await db
      .select({ id: schema.storageLocations.id })
      .from(schema.storageLocations)
      .innerJoin(
        schema.hostBusinesses,
        eq(schema.storageLocations.businessId, schema.hostBusinesses.id)
      )
      .where(eq(schema.hostBusinesses.ownerUserId, context.userId))
      .orderBy(desc(schema.storageLocations.createdAt));

    const locations: StorageLocation[] = [];
    for (const r of rows) {
      const loc = await this.getLocationById(r.id, context);
      locations.push(loc);
    }
    return locations;
  }

  /**
   * Retrieves full location details with sub-entities, enforcing ownership or admin privileges.
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

    const isAdmin = context.roles.some((r) => ["SUPERADMIN", "SUPPORT"].includes(r));
    if (loc.ownerUserId !== context.userId && !isAdmin) {
      throw AppError.forbidden("Access denied: You do not have permission to view this location");
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
    await this.getLocationById(locationId, context); // ownership check

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
  ): Promise<void> {
    await this.getLocationById(locationId, context);

    await db
      .insert(schema.openingHoursExceptions)
      .values({
        locationId,
        exceptionDate: request.exceptionDate,
        exceptionType: request.exceptionType || "CLOSURE",
        openTime: request.openTime || null,
        closeTime: request.closeTime || null,
        reason: request.reason || null
      })
      .onConflictDoUpdate({
        target: [schema.openingHoursExceptions.locationId, schema.openingHoursExceptions.exceptionDate],
        set: {
          exceptionType: request.exceptionType || "CLOSURE",
          openTime: request.openTime || null,
          closeTime: request.closeTime || null,
          reason: request.reason || null,
          updatedAt: new Date()
        }
      });

    await auditService.recordEvent({
      eventType: SecurityEventType.STORAGE_LOCATION_CONFIG_UPDATED,
      userId: context.userId,
      clientInfo: context.clientInfo,
      metadata: { locationId, configType: "EXCEPTION", date: request.exceptionDate }
    });
  }

  /**
   * Adds a storage zone to a location.
   */
  async createStorageZone(
    locationId: string,
    request: CreateStorageZoneRequest,
    context: LocationCallerContext
  ): Promise<typeof schema.storageZones.$inferSelect> {
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

