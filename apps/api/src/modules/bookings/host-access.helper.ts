import { eq, and, inArray } from "drizzle-orm";
import { db, schema } from "../../infrastructure/database/drizzle.js";
import { AppError } from "../../common/errors/app-error.js";

export interface ResolvedHostAccess {
  locationId: string;
  businessId: string;
  actorRole: "SUPERADMIN" | "HOST_OWNER" | "HOST_STAFF";
}

/**
 * Verifies that an authenticated user is authorized to manage bookings or custody
 * at a specific storage location (SUPERADMIN, business owner, or active assigned staff).
 */
export async function assertHostLocationAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  txOrDb: any,
  userId: string,
  userRoles: string[],
  locationId: string
): Promise<ResolvedHostAccess> {
  const [row] = await txOrDb
    .select({
      locationId: schema.storageLocations.id,
      businessId: schema.storageLocations.businessId,
      ownerUserId: schema.hostBusinesses.ownerUserId
    })
    .from(schema.storageLocations)
    .innerJoin(
      schema.hostBusinesses,
      eq(schema.storageLocations.businessId, schema.hostBusinesses.id)
    )
    .where(eq(schema.storageLocations.id, locationId))
    .limit(1);

  if (!row) {
    throw AppError.notFound("Storage location not found");
  }

  if (userRoles.includes("SUPERADMIN")) {
    return {
      locationId: row.locationId,
      businessId: row.businessId,
      actorRole: "SUPERADMIN"
    };
  }

  if (row.ownerUserId === userId) {
    return {
      locationId: row.locationId,
      businessId: row.businessId,
      actorRole: "HOST_OWNER"
    };
  }

  const [membership] = await txOrDb
    .select()
    .from(schema.hostStaffMemberships)
    .where(
      and(
        eq(schema.hostStaffMemberships.businessId, row.businessId),
        eq(schema.hostStaffMemberships.userId, userId),
        eq(schema.hostStaffMemberships.isActive, true)
      )
    )
    .limit(1);

  if (!membership) {
    throw AppError.forbidden("You are not authorized to operate this storage location");
  }

  const assignedIds = Array.isArray(membership.assignedLocationIds)
    ? membership.assignedLocationIds
    : [];

  if (membership.staffRole !== "MANAGER" && !assignedIds.includes(locationId)) {
    throw AppError.forbidden("Your staff assignment does not include this storage location");
  }

  return {
    locationId: row.locationId,
    businessId: row.businessId,
    actorRole: "HOST_STAFF"
  };
}

/**
 * Resolves the exact list of storage location IDs accessible to a host owner or staff user.
 */
export async function getAccessibleHostLocationIds(
  userId: string,
  userRoles: string[],
  businessIdFilter?: string
): Promise<string[]> {
  if (userRoles.includes("SUPERADMIN")) {
    const rows = businessIdFilter
      ? await db
          .select({ id: schema.storageLocations.id })
          .from(schema.storageLocations)
          .where(eq(schema.storageLocations.businessId, businessIdFilter))
      : await db.select({ id: schema.storageLocations.id }).from(schema.storageLocations);
    return rows.map((r) => r.id);
  }

  const ownedBusinesses = await db
    .select({ id: schema.hostBusinesses.id })
    .from(schema.hostBusinesses)
    .where(
      businessIdFilter
        ? and(
            eq(schema.hostBusinesses.ownerUserId, userId),
            eq(schema.hostBusinesses.id, businessIdFilter)
          )
        : eq(schema.hostBusinesses.ownerUserId, userId)
    );

  const ownedBusinessIds = ownedBusinesses.map((b) => b.id);
  const locationIdSet = new Set<string>();

  if (ownedBusinessIds.length > 0) {
    const ownedLocs = await db
      .select({ id: schema.storageLocations.id })
      .from(schema.storageLocations)
      .where(inArray(schema.storageLocations.businessId, ownedBusinessIds));
    for (const loc of ownedLocs) {
      locationIdSet.add(loc.id);
    }
  }

  const staffRows = await db
    .select()
    .from(schema.hostStaffMemberships)
    .where(
      businessIdFilter
        ? and(
            eq(schema.hostStaffMemberships.userId, userId),
            eq(schema.hostStaffMemberships.isActive, true),
            eq(schema.hostStaffMemberships.businessId, businessIdFilter)
          )
        : and(
            eq(schema.hostStaffMemberships.userId, userId),
            eq(schema.hostStaffMemberships.isActive, true)
          )
    );

  for (const membership of staffRows) {
    if (membership.staffRole === "MANAGER") {
      const bizLocs = await db
        .select({ id: schema.storageLocations.id })
        .from(schema.storageLocations)
        .where(eq(schema.storageLocations.businessId, membership.businessId));
      for (const loc of bizLocs) {
        locationIdSet.add(loc.id);
      }
    } else if (Array.isArray(membership.assignedLocationIds) && membership.assignedLocationIds.length > 0) {
      const assignedLocs = await db
        .select({ id: schema.storageLocations.id })
        .from(schema.storageLocations)
        .where(
          and(
            eq(schema.storageLocations.businessId, membership.businessId),
            inArray(schema.storageLocations.id, membership.assignedLocationIds)
          )
        );
      for (const loc of assignedLocs) {
        locationIdSet.add(loc.id);
      }
    }
  }

  return Array.from(locationIdSet);
}

