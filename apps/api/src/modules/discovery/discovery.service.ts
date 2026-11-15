import { eq, and, sql, asc, gte } from "drizzle-orm";
import {
  BAG_CATEGORIES,
  BagCategory,
  BookingMode,
  DEFAULT_CATEGORY_MULTIPLIERS_BPS,
  OpeningHoursExceptionType,
  PricingUnit,
  PublicLocationCapacitySummary,
  PublicLocationPricingPolicy,
  PublicStorageLocation,
  PublicStorageLocationDetail,
  SearchLocationsQueryInput,
  SearchLocationsQuerySchema,
  SearchLocationsResponse
} from "@luggage-storage/contracts";
import { db, schema } from "../../infrastructure/database/drizzle.js";
import { AppError } from "../../common/errors/app-error.js";
import { storageService } from "../uploads/storage.service.js";

function getCurrentDateInTimezone(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "Asia/Colombo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Colombo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  }
}

export class DiscoveryService {
  private async resolvePublicImageUrl(
    fileKey: string | null | undefined,
    storedUrl: string
  ): Promise<string> {
    if (storageService.isLiveR2 && fileKey && !storageService.getPublicUrl?.(fileKey)) {
      return storageService.generatePresignedDownloadUrl({
        fileKey,
        expiresInSeconds: 3600
      });
    }
    return storedUrl;
  }

  /**
   * Performs public location discovery with PostGIS spatial indexing.
   * Strictly enforces OQ-012 location privacy: exact address, building number, and exact
   * coordinates are NEVER exposed in public discovery responses.
   */
  async searchLocations(rawQuery: SearchLocationsQueryInput): Promise<SearchLocationsResponse> {
    const query = SearchLocationsQuerySchema.parse(rawQuery);
    const page = query.page;
    const limit = query.limit;
    const offset = (page - 1) * limit;

    const hasGeo = query.latitude !== undefined && query.longitude !== undefined;
    const radiusMeters = query.radiusMeters || 15000;

    // Build raw SQL PostGIS conditions to leverage GiST index efficiently
    const conditions: Array<ReturnType<typeof sql>> = [
      sql`sl.status = 'ACTIVE'`,
      sql`hb.status = 'ACTIVE'`
    ];

    if (hasGeo) {
      conditions.push(
        sql`ST_DWithin(
          sl.coarse_coordinates,
          ST_SetSRID(ST_MakePoint(${query.longitude}, ${query.latitude}), 4326)::geography,
          ${radiusMeters}
        )`
      );
    }

    if (query.city) {
      conditions.push(sql`sl.city ILIKE ${`%${query.city}%`}`);
    }

    if (query.searchTerm) {
      const term = `%${query.searchTerm}%`;
      conditions.push(sql`(sl.name ILIKE ${term} OR sl.city ILIKE ${term} OR sl.description ILIKE ${term})`);
    }

    if (query.acceptsOversized !== undefined) {
      conditions.push(sql`sl.accepts_oversized = ${query.acceptsOversized}`);
    }

    if (query.amenities && query.amenities.length > 0) {
      for (const amenity of query.amenities) {
        conditions.push(sql`sl.amenities @> ${JSON.stringify([amenity])}::jsonb`);
      }
    }

    const whereClause = sql.join(conditions, sql` AND `);

    // Order by explicit sortBy option, preserving coarse-distance tie-breaking by default
    let orderByClause: ReturnType<typeof sql>;
    if (query.sortBy === "price_asc") {
      orderByClause = sql`pp.base_rate_minor ASC NULLS LAST, sl.created_at DESC`;
    } else if (query.sortBy === "price_desc") {
      orderByClause = sql`pp.base_rate_minor DESC NULLS LAST, sl.created_at DESC`;
    } else if (query.sortBy === "newest") {
      orderByClause = sql`sl.created_at DESC`;
    } else {
      orderByClause = hasGeo
        ? sql`ST_Distance(sl.coarse_coordinates, ST_SetSRID(ST_MakePoint(${query.longitude}, ${query.latitude}), 4326)::geography) ASC, sl.created_at DESC`
        : sql`sl.created_at DESC`;
    }

    const distanceSelect = hasGeo
      ? sql`, (ROUND(ST_Distance(sl.coarse_coordinates, ST_SetSRID(ST_MakePoint(${query.longitude}, ${query.latitude}), 4326)::geography) / 100.0) * 100)::integer AS distance_meters`
      : sql`, NULL::integer AS distance_meters`;

    // Query matching locations - uses privacy-preserving coarse coordinates ONLY
    const rowsQuery = sql`
      SELECT
        sl.id,
        sl.name,
        sl.description,
        sl.city,
        sl.country_code,
        ST_Y(sl.coarse_coordinates::geometry) AS approximate_latitude,
        ST_X(sl.coarse_coordinates::geometry) AS approximate_longitude,
        sl.timezone,
        sl.booking_mode,
        sl.accepts_oversized,
        sl.amenities,
        pp.base_rate_minor,
        pp.currency
        ${distanceSelect}
      FROM storage_locations sl
      INNER JOIN host_businesses hb ON sl.business_id = hb.id
      LEFT JOIN pricing_policies pp ON sl.id = pp.location_id AND pp.status = 'ACTIVE'
      WHERE ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT ${limit} OFFSET ${offset};
    `;

    const countQuery = sql`
      SELECT COUNT(*)::integer AS total
      FROM storage_locations sl
      INNER JOIN host_businesses hb ON sl.business_id = hb.id
      WHERE ${whereClause};
    `;

    const [rowsResult, countResult] = await Promise.all([
      db.execute<{
        id: string;
        name: string;
        description: string | null;
        city: string;
        country_code: string;
        approximate_latitude: number;
        approximate_longitude: number;
        timezone: string;
        booking_mode: string;
        accepts_oversized: boolean;
        amenities: string[];
        base_rate_minor: number | null;
        currency: string | null;
        distance_meters: number | null;
      }>(rowsQuery),
      db.execute<{ total: number }>(countQuery)
    ]);

    const total = countResult.rows[0]?.total ?? 0;
    const totalPages = Math.ceil(total / limit);

    // Fetch images and operating hours for matching locations
    const locationIds = rowsResult.rows.map((r) => r.id);
    const mediaMap = new Map<
      string,
      Array<{ id: string; url: string; caption: string | null; isPrimary: boolean; sortOrder: number }>
    >();
    const hoursMap = new Map<string, Array<typeof schema.openingHours.$inferSelect>>();

    if (locationIds.length > 0) {
      const [mediaRows, hoursRows] = await Promise.all([
        db
          .select()
          .from(schema.locationMedia)
          .where(sql`${schema.locationMedia.locationId} IN ${locationIds}`)
          .orderBy(schema.locationMedia.sortOrder),
        db
          .select()
          .from(schema.openingHours)
          .where(sql`${schema.openingHours.locationId} IN ${locationIds}`)
          .orderBy(schema.openingHours.dayOfWeek)
      ]);

      const resolvedMedia = await Promise.all(
        mediaRows.map(async (m) => ({
          locationId: m.locationId,
          item: {
            id: m.id,
            url: await this.resolvePublicImageUrl(m.fileKey, m.url),
            caption: m.caption,
            isPrimary: m.isPrimary,
            sortOrder: m.sortOrder
          }
        }))
      );

      for (const entry of resolvedMedia) {
        const list = mediaMap.get(entry.locationId) || [];
        list.push(entry.item);
        mediaMap.set(entry.locationId, list);
      }

      for (const h of hoursRows) {
        const list = hoursMap.get(h.locationId) || [];
        list.push(h);
        hoursMap.set(h.locationId, list);
      }
    }

    const locations: PublicStorageLocation[] = rowsResult.rows.map((r) => {
      const images = mediaMap.get(r.id) || [];
      const primaryImage = images.find((i) => i.isPrimary) || images[0];
      const hours = hoursMap.get(r.id) || [];

      const is24Hours =
        hours.length > 0 &&
        hours.every(
          (h) =>
            !h.isClosed &&
            h.openTime === "00:00:00" &&
            (h.closeTime === "23:59:59" || h.closeTime === "24:00:00")
        );
      const firstOpen = hours.find((h) => !h.isClosed);
      const operatingHoursSummary = is24Hours
        ? "24/7 Open"
        : firstOpen
        ? `${firstOpen.openTime.slice(0, 5)} - ${firstOpen.closeTime.slice(0, 5)}`
        : hours.length > 0
        ? "Closed"
        : "08:00 - 20:00";

      // OQ-012: Privacy-preserving coarse coordinates from DB (exact coordinates are never queried)
      const approximateLatitude = Number(Number(r.approximate_latitude).toFixed(2));
      const approximateLongitude = Number(Number(r.approximate_longitude).toFixed(2));
      const approximateArea = `${r.city} Transit Area`;

      // OQ-012 Security Invariant: Distance is computed directly from coarse_coordinates
      // in rounded 100m bands by PostGIS, preventing trilateration side-channel leakage.
      const distanceMeters = r.distance_meters !== null ? Number(r.distance_meters) : undefined;

      return {
        id: r.id,
        name: r.name,
        description: r.description,
        city: r.city,
        countryCode: r.country_code,
        approximateArea,
        approximateLatitude,
        approximateLongitude,
        distanceMeters,
        timezone: r.timezone,
        bookingMode: r.booking_mode as BookingMode,
        acceptsOversized: r.accepts_oversized,
        amenities: r.amenities || [],
        status: "ACTIVE",
        primaryImageUrl: primaryImage?.url || null,
        images,
        baseRateMinor: r.base_rate_minor ?? undefined,
        currency: r.currency || "LKR",
        averageRating: null,
        reviewCount: 0,
        is24Hours,
        operatingHoursSummary
      };
    });

    return {
      locations,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    };
  }

  /**
   * Retrieves single public storage location details including weekly hours,
   * upcoming schedule exceptions, active bag pricing tiers, and coarse capacity.
   * Strictly enforces OQ-012 privacy: exact address and entrance coordinates are omitted.
   */
  async getPublicLocationDetails(locationId: string): Promise<PublicStorageLocationDetail> {
    const [row] = await db
      .select({
        id: schema.storageLocations.id,
        name: schema.storageLocations.name,
        description: schema.storageLocations.description,
        city: schema.storageLocations.city,
        countryCode: schema.storageLocations.countryCode,
        approximateLatitude: sql<number>`ST_Y(${schema.storageLocations.coarseCoordinates}::geometry)`,
        approximateLongitude: sql<number>`ST_X(${schema.storageLocations.coarseCoordinates}::geometry)`,
        timezone: schema.storageLocations.timezone,
        bookingMode: schema.storageLocations.bookingMode,
        acceptsOversized: schema.storageLocations.acceptsOversized,
        amenities: schema.storageLocations.amenities,
        locationStatus: schema.storageLocations.status,
        businessStatus: schema.hostBusinesses.status,
        policyId: schema.pricingPolicies.id,
        pricingUnit: schema.pricingPolicies.pricingUnit,
        baseRateMinor: schema.pricingPolicies.baseRateMinor,
        currency: schema.pricingPolicies.currency
      })
      .from(schema.storageLocations)
      .innerJoin(
        schema.hostBusinesses,
        eq(schema.storageLocations.businessId, schema.hostBusinesses.id)
      )
      .leftJoin(
        schema.pricingPolicies,
        and(
          eq(schema.storageLocations.id, schema.pricingPolicies.locationId),
          eq(schema.pricingPolicies.status, "ACTIVE")
        )
      )
      .where(eq(schema.storageLocations.id, locationId))
      .limit(1);

    if (!row || row.locationStatus !== "ACTIVE" || row.businessStatus !== "ACTIVE") {
      throw AppError.notFound("Storage location not found or is currently not active");
    }

    const todayDateStr = getCurrentDateInTimezone(row.timezone);

    const [images, hours, upcomingExceptionRows, tierRateRows, activePools] = await Promise.all([
      db
        .select()
        .from(schema.locationMedia)
        .where(eq(schema.locationMedia.locationId, locationId))
        .orderBy(schema.locationMedia.sortOrder),
      db
        .select()
        .from(schema.openingHours)
        .where(eq(schema.openingHours.locationId, locationId))
        .orderBy(schema.openingHours.dayOfWeek),
      db
        .select()
        .from(schema.openingHoursExceptions)
        .where(
          and(
            eq(schema.openingHoursExceptions.locationId, locationId),
            gte(schema.openingHoursExceptions.exceptionDate, todayDateStr)
          )
        )
        .orderBy(asc(schema.openingHoursExceptions.exceptionDate))
        .limit(30),
      row.policyId
        ? db
            .select()
            .from(schema.pricingTierRates)
            .where(eq(schema.pricingTierRates.policyId, row.policyId))
        : Promise.resolve([]),
      db
        .select({
          poolType: schema.storageCapacityPools.poolType,
          dedicatedBagCategory: schema.storageCapacityPools.dedicatedBagCategory,
          totalUnits: schema.storageCapacityPools.totalUnits
        })
        .from(schema.storageCapacityPools)
        .where(
          and(
            eq(schema.storageCapacityPools.locationId, locationId),
            eq(schema.storageCapacityPools.isActive, true)
          )
        )
    ]);

    const formattedImages = await Promise.all(
      images.map(async (i) => ({
        id: i.id,
        url: await this.resolvePublicImageUrl(i.fileKey, i.url),
        caption: i.caption,
        isPrimary: i.isPrimary,
        sortOrder: i.sortOrder
      }))
    );
    const primaryImage = formattedImages.find((i) => i.isPrimary) || formattedImages[0];

    const is24Hours =
      hours.length > 0 &&
      hours.every(
        (h) =>
          !h.isClosed &&
          h.openTime === "00:00:00" &&
          (h.closeTime === "23:59:59" || h.closeTime === "24:00:00")
      );
    const firstOpen = hours.find((h) => !h.isClosed);
    const operatingHoursSummary = is24Hours
      ? "24/7 Open"
      : firstOpen
      ? `${firstOpen.openTime.slice(0, 5)} - ${firstOpen.closeTime.slice(0, 5)}`
      : hours.length > 0
      ? "Closed"
      : "08:00 - 20:00";

    const openingHours = hours.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      openTime: h.openTime,
      closeTime: h.closeTime,
      allowsDropoff: h.allowsDropoff,
      allowsCollection: h.allowsCollection,
      isClosed: h.isClosed
    }));

    const upcomingExceptions = upcomingExceptionRows.map((e) => ({
      exceptionDate: e.exceptionDate,
      exceptionType: e.exceptionType as OpeningHoursExceptionType,
      openTime: e.openTime,
      closeTime: e.closeTime,
      reason: e.reason
    }));

    let pricingPolicy: PublicLocationPricingPolicy | null = null;
    if (row.policyId && row.baseRateMinor) {
      const tierByCat = new Map(tierRateRows.map((t) => [t.bagCategory, t]));
      const visibleCategories = row.acceptsOversized
        ? BAG_CATEGORIES
        : BAG_CATEGORIES.filter((cat) => cat !== "BAG_OVERSIZED");
      const tierRates = visibleCategories.map((bagCategory) => {
        const existing = tierByCat.get(bagCategory);
        const categoryMultiplierBps =
          existing?.categoryMultiplierBps ?? DEFAULT_CATEGORY_MULTIPLIERS_BPS[bagCategory];
        const rateMinor =
          existing?.rateMinor ?? Math.round((row.baseRateMinor! * categoryMultiplierBps) / 10000);
        return {
          bagCategory,
          rateMinor,
          categoryMultiplierBps
        };
      });

      pricingPolicy = {
        currency: row.currency || "LKR",
        pricingUnit: (row.pricingUnit as PricingUnit) || "CALENDAR_DAY",
        baseRateMinor: row.baseRateMinor,
        tierRates
      };
    }

    const supportedSet = new Set<BagCategory>();
    for (const pool of activePools) {
      if (pool.poolType === "SHARED") {
        supportedSet.add("BAG_SMALL");
        supportedSet.add("BAG_MEDIUM");
        supportedSet.add("BAG_LARGE");
        if (row.acceptsOversized) {
          supportedSet.add("BAG_OVERSIZED");
        }
      } else if (pool.poolType === "DEDICATED" && pool.dedicatedBagCategory) {
        const cat = pool.dedicatedBagCategory as BagCategory;
        if (cat !== "BAG_OVERSIZED" || row.acceptsOversized) {
          supportedSet.add(cat);
        }
      }
    }

    const capacitySummary: PublicLocationCapacitySummary = {
      activePoolCount: activePools.length,
      totalMaxCapacityUnits: activePools.reduce((sum, pool) => sum + pool.totalUnits, 0),
      supportedBagCategories: BAG_CATEGORIES.filter((cat) => supportedSet.has(cat))
    };

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      city: row.city,
      countryCode: row.countryCode,
      approximateArea: `${row.city} District`,
      approximateLatitude: Number(Number(row.approximateLatitude).toFixed(2)),
      approximateLongitude: Number(Number(row.approximateLongitude).toFixed(2)),
      timezone: row.timezone,
      bookingMode: row.bookingMode as BookingMode,
      acceptsOversized: row.acceptsOversized,
      amenities: (row.amenities as string[]) || [],
      status: "ACTIVE",
      primaryImageUrl: primaryImage?.url || null,
      images: formattedImages,
      baseRateMinor: row.baseRateMinor ?? undefined,
      currency: row.currency || "LKR",
      averageRating: null,
      reviewCount: 0,
      is24Hours,
      operatingHoursSummary,
      openingHours,
      upcomingExceptions,
      pricingPolicy,
      capacitySummary
    };
  }
}

export const discoveryService = new DiscoveryService();
