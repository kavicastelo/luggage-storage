import { eq, and, sql, ilike } from "drizzle-orm";
import {
  SearchLocationsQueryInput,
  SearchLocationsQuerySchema,
  PublicStorageLocation,
  SearchLocationsResponse
} from "@luggage-storage/contracts";
import { db, schema } from "../../infrastructure/database/drizzle.js";
import { AppError } from "../../common/errors/app-error.js";

export class DiscoveryService {
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

    // Order by distance from query point to coarse_coordinates, broken stably by created_at DESC
    const orderByClause = hasGeo
      ? sql`ST_Distance(sl.coarse_coordinates, ST_SetSRID(ST_MakePoint(${query.longitude}, ${query.latitude}), 4326)::geography) ASC, sl.created_at DESC`
      : sql`sl.created_at DESC`;

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
    const mediaMap = new Map<string, Array<{ id: string; url: string; caption: string | null; isPrimary: boolean }>>();
    const hoursMap = new Map<string, Array<typeof schema.openingHours.$inferSelect>>();

    if (locationIds.length > 0) {
      const mediaRows = await db
        .select()
        .from(schema.locationMedia)
        .where(sql`${schema.locationMedia.locationId} IN ${locationIds}`)
        .orderBy(schema.locationMedia.sortOrder);

      for (const m of mediaRows) {
        const list = mediaMap.get(m.locationId) || [];
        list.push({ id: m.id, url: m.url, caption: m.caption, isPrimary: m.isPrimary });
        mediaMap.set(m.locationId, list);
      }

      const hoursRows = await db
        .select()
        .from(schema.openingHours)
        .where(sql`${schema.openingHours.locationId} IN ${locationIds}`)
        .orderBy(schema.openingHours.dayOfWeek);

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

      // Determine hours summary
      const is24Hours = hours.length > 0 && hours.every((h) => !h.isClosed && h.openTime === "00:00:00" && (h.closeTime === "23:59:59" || h.closeTime === "24:00:00"));
      const firstOpen = hours.find((h) => !h.isClosed);
      const operatingHoursSummary = is24Hours
        ? "24/7 Open"
        : firstOpen
        ? `${firstOpen.openTime.slice(0, 5)} - ${firstOpen.closeTime.slice(0, 5)}`
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
        bookingMode: r.booking_mode as any,
        acceptsOversized: r.accepts_oversized,
        amenities: r.amenities || [],
        status: "ACTIVE",
        primaryImageUrl: primaryImage?.url || null,
        images,
        baseRateMinor: r.base_rate_minor || 100000,
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
   * Retrieves single public storage location details.
   * Strictly enforces OQ-012 privacy: exact address and entrance coordinates are omitted.
   */
  async getPublicLocationDetails(locationId: string): Promise<PublicStorageLocation> {
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

    const [images, hours] = await Promise.all([
      db
        .select()
        .from(schema.locationMedia)
        .where(eq(schema.locationMedia.locationId, locationId))
        .orderBy(schema.locationMedia.sortOrder),
      db
        .select()
        .from(schema.openingHours)
        .where(eq(schema.openingHours.locationId, locationId))
        .orderBy(schema.openingHours.dayOfWeek)
    ]);

    const formattedImages = images.map((i) => ({
      id: i.id,
      url: i.url,
      caption: i.caption,
      isPrimary: i.isPrimary
    }));
    const primaryImage = formattedImages.find((i) => i.isPrimary) || formattedImages[0];

    const is24Hours = hours.length > 0 && hours.every((h) => !h.isClosed && h.openTime === "00:00:00" && (h.closeTime === "23:59:59" || h.closeTime === "24:00:00"));
    const firstOpen = hours.find((h) => !h.isClosed);
    const operatingHoursSummary = is24Hours
      ? "24/7 Open"
      : firstOpen
      ? `${firstOpen.openTime.slice(0, 5)} - ${firstOpen.closeTime.slice(0, 5)}`
      : "08:00 - 20:00";

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
      bookingMode: row.bookingMode as any,
      acceptsOversized: row.acceptsOversized,
      amenities: (row.amenities as string[]) || [],
      status: "ACTIVE",
      primaryImageUrl: primaryImage?.url || null,
      images: formattedImages,
      baseRateMinor: row.baseRateMinor || 100000,
      currency: row.currency || "LKR",
      averageRating: null,
      reviewCount: 0,
      is24Hours,
      operatingHoursSummary
    };
  }
}

export const discoveryService = new DiscoveryService();
