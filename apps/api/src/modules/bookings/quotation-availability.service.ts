import { eq, and, sql, inArray } from "drizzle-orm";
import {
  BagCategory,
  STANDARD_BAG_UNIT_CONSUMPTION,
  DEFAULT_CATEGORY_MULTIPLIERS_BPS,
  DEFAULT_COMMISSION_RATE_BPS,
  BookingBagItemInput,
  BookingQuoteRequest,
  BookingQuoteRequestSchema,
  BookingQuoteResponse,
  QuotedLineItem,
  AvailabilitySearchQuery,
  AvailabilitySearchQuerySchema
} from "@luggage-storage/contracts";
import { db, schema } from "../../infrastructure/database/drizzle.js";
import { AppError } from "../../common/errors/app-error.js";

const DAY_MS = 86_400_000;

interface LocalDateTimeParts {
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:MM:SS
  isoDayOfWeek: number; // 1=Mon .. 7=Sun
}

/**
 * Converts a UTC Date into location-local calendar date, 24h time string, and ISO day of week (1=Mon..7=Sun).
 */
export function getLocalDateTimeParts(date: Date, timeZone: string): LocalDateTimeParts {
  const safeTz = timeZone || "Asia/Colombo";
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hour12: false
  });

  const parts = dtf.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const rawHour = get("hour");
  const hour = rawHour === "24" ? "00" : rawHour;
  const minute = get("minute");
  const second = get("second");
  const weekday = get("weekday");

  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7
  };

  return {
    dateStr: `${year}-${month}-${day}`,
    timeStr: `${hour}:${minute}:${second}`,
    isoDayOfWeek: weekdayMap[weekday] ?? 1
  };
}

function isTimeWithinSchedule(timeStr: string, openTime: string, closeTime: string): boolean {
  const normalizedClose = closeTime === "24:00:00" || closeTime === "23:59:00" ? "23:59:59" : closeTime;
  return timeStr >= openTime && timeStr <= normalizedClose;
}

/**
 * Normalizes duplicate bag category entries in a request by summing quantities.
 */
export function consolidateBagItems(items: BookingBagItemInput[]): BookingBagItemInput[] {
  const map = new Map<BagCategory, number>();
  for (const item of items) {
    map.set(item.bagCategory, (map.get(item.bagCategory) ?? 0) + item.quantity);
  }
  return Array.from(map.entries()).map(([bagCategory, quantity]) => ({ bagCategory, quantity }));
}

export interface PoolAllocationPlan {
  poolId: string;
  bagCategory: BagCategory;
  unitsReserved: number;
}

export class QuotationAndAvailabilityService {
  private async expireLockedBookingsInTx(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    expiredRows: Array<{ id: string; status: string }>
  ): Promise<number> {
    if (expiredRows.length === 0) {
      return 0;
    }

    const expiredIds = expiredRows.map((r) => r.id);
    const idSqlList = sql.join(
      expiredIds.map((id) => sql`${id}::uuid`),
      sql`, `
    );
    const now = new Date();

    // Tier 3 lock after Tier 2 bookings lock: lock open payment intents in deterministic id order
    const openIntentsRes = await tx.execute(sql`
      SELECT id
      FROM payment_intents
      WHERE booking_id IN (${idSqlList})
        AND status IN ('INITIATED', 'PENDING_GATEWAY')
      ORDER BY id ASC
      FOR UPDATE;
    `);
    const openIntentIds = (openIntentsRes.rows as Array<{ id: string }>).map((r) => r.id);
    if (openIntentIds.length > 0) {
      await tx
        .update(schema.paymentIntents)
        .set({
          status: "EXPIRED",
          failureReason: sql`COALESCE(failure_reason, 'Booking payment hold expired')`,
          updatedAt: now
        })
        .where(inArray(schema.paymentIntents.id, openIntentIds));
    }

    await tx
      .update(schema.bookings)
      .set({
        status: "EXPIRED",
        holdExpiresAt: null,
        updatedAt: now
      })
      .where(inArray(schema.bookings.id, expiredIds));

    await tx
      .update(schema.capacityReservations)
      .set({
        status: "RELEASED",
        releasedAt: now,
        releaseReason: "HOLD_EXPIRED",
        updatedAt: now
      })
      .where(
        and(
          inArray(schema.capacityReservations.bookingId, expiredIds),
          inArray(schema.capacityReservations.status, [
            "HELD_FOR_HOST_APPROVAL",
            "HELD_FOR_PAYMENT"
          ])
        )
      );

    await tx.insert(schema.bookingStatusHistory).values(
      expiredRows.map((row) => ({
        bookingId: row.id,
        previousStatus: row.status,
        newStatus: "EXPIRED",
        actorUserId: null,
        actorRole: "SYSTEM",
        reason: "Temporary booking hold expired before completion",
        metadata: {}
      }))
    );

    return expiredIds.length;
  }

  /**
   * Expires a single booking whose bookings row is ALREADY locked FOR UPDATE in the current transaction.
   * Respects canonical Tier 2 (bookings) -> Tier 3 (payment_intents ORDER BY id ASC) lock hierarchy.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async expireSingleBookingHoldInTx(tx: any, bookingId: string, previousStatus: string): Promise<void> {
    await this.expireLockedBookingsInTx(tx, [{ id: bookingId, status: previousStatus }]);
  }

  /**
   * Sweeps expired booking holds atomically using ORDER BY id ASC FOR UPDATE SKIP LOCKED
   * so concurrent workers/checkouts never deadlock and capacity + open intents expire together.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async sweepExpiredHolds(txOrDb: any = db): Promise<number> {
    const runSweep = async (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tx: any
    ): Promise<number> => {
      const expiredBookingsRes = await tx.execute(sql`
        SELECT id, status
        FROM bookings
        WHERE status IN ('PENDING_HOST_APPROVAL', 'PENDING_PAYMENT')
          AND hold_expires_at IS NOT NULL
          AND hold_expires_at <= NOW()
        ORDER BY id ASC
        FOR UPDATE SKIP LOCKED;
      `);

      const expiredRows = expiredBookingsRes.rows as Array<{ id: string; status: string }>;
      return this.expireLockedBookingsInTx(tx, expiredRows);
    };

    if (txOrDb === db) {
      return db.transaction(runSweep);
    }
    return runSweep(txOrDb);
  }

  /**
   * Validates drop-off and collection timestamps against location weekly hours & holiday/special exceptions.
   */
  async validateOperatingWindow(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    txOrDb: any,
    locationId: string,
    timezone: string,
    dropOffAt: Date,
    collectionAt: Date
  ): Promise<{ valid: boolean; reason: string | null }> {
    const dropParts = getLocalDateTimeParts(dropOffAt, timezone);
    const collectParts = getLocalDateTimeParts(collectionAt, timezone);

    const [weeklyHours, exceptions] = await Promise.all([
      txOrDb
        .select()
        .from(schema.openingHours)
        .where(eq(schema.openingHours.locationId, locationId)),
      txOrDb
        .select()
        .from(schema.openingHoursExceptions)
        .where(
          and(
            eq(schema.openingHoursExceptions.locationId, locationId),
            inArray(schema.openingHoursExceptions.exceptionDate, [
              dropParts.dateStr,
              collectParts.dateStr
            ])
          )
        )
    ]);

    const checkMoment = (
      parts: LocalDateTimeParts,
      kind: "DROP_OFF" | "COLLECTION"
    ): string | null => {
      const label = kind === "DROP_OFF" ? "Drop-off" : "Collection";
      const ex = exceptions.find(
        (e: typeof schema.openingHoursExceptions.$inferSelect) => e.exceptionDate === parts.dateStr
      );

      if (ex) {
        if (ex.exceptionType === "CLOSURE") {
          return `${label} date (${parts.dateStr}) falls on a scheduled venue closure${
            ex.reason ? `: ${ex.reason}` : ""
          }`;
        }
        if (ex.openTime && ex.closeTime) {
          if (!isTimeWithinSchedule(parts.timeStr, ex.openTime, ex.closeTime)) {
            return `${label} time (${parts.timeStr.slice(0, 5)}) is outside special operating hours (${ex.openTime.slice(0, 5)}–${ex.closeTime.slice(0, 5)})`;
          }
          return null;
        }
      }

      if (weeklyHours.length === 0) {
        // No weekly restrictions configured yet -> treat as 24/7 unless exception closed
        return null;
      }

      const daySchedule = weeklyHours.find(
        (h: typeof schema.openingHours.$inferSelect) => h.dayOfWeek === parts.isoDayOfWeek
      );
      if (!daySchedule || daySchedule.isClosed) {
        return `${label} falls on a closed day of the week for this storage location`;
      }
      if (kind === "DROP_OFF" && !daySchedule.allowsDropoff) {
        return "Drop-off is not permitted on the selected day at this location";
      }
      if (kind === "COLLECTION" && !daySchedule.allowsCollection) {
        return "Collection is not permitted on the selected day at this location";
      }
      if (!isTimeWithinSchedule(parts.timeStr, daySchedule.openTime, daySchedule.closeTime)) {
        return `${label} time (${parts.timeStr.slice(0, 5)}) is outside operating hours (${daySchedule.openTime.slice(0, 5)}–${daySchedule.closeTime.slice(0, 5)})`;
      }
      return null;
    };

    const dropErr = checkMoment(dropParts, "DROP_OFF");
    if (dropErr) return { valid: false, reason: dropErr };

    const collectErr = checkMoment(collectParts, "COLLECTION");
    if (collectErr) return { valid: false, reason: collectErr };

    return { valid: true, reason: null };
  }

  /**
   * Computes pool capacity availability (optionally acquiring FOR UPDATE row locks inside a booking transaction).
   */
  async evaluateAndPlanCapacity(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    txOrDb: any,
    params: {
      locationId: string;
      dropOffAt: Date;
      collectionAt: Date;
      items: BookingBagItemInput[];
      lockPoolsForUpdate: boolean;
    }
  ): Promise<{
    canFulfill: boolean;
    remainingUnitsAfter: number;
    totalRemainingBefore: number;
    allocations: PoolAllocationPlan[];
    reason: string | null;
  }> {
    const poolsResult = params.lockPoolsForUpdate
      ? await txOrDb.execute(sql`
          SELECT id, pool_type, dedicated_bag_category, total_units
          FROM storage_capacity_pools
          WHERE location_id = ${params.locationId}
            AND is_active = true
          ORDER BY id ASC
          FOR UPDATE;
        `)
      : await txOrDb.execute(sql`
          SELECT id, pool_type, dedicated_bag_category, total_units
          FROM storage_capacity_pools
          WHERE location_id = ${params.locationId}
            AND is_active = true
          ORDER BY id ASC;
        `);

    const pools = poolsResult.rows as Array<{
      id: string;
      pool_type: "SHARED" | "DEDICATED";
      dedicated_bag_category: BagCategory | null;
      total_units: number;
    }>;

    if (pools.length === 0) {
      return {
        canFulfill: false,
        remainingUnitsAfter: 0,
        totalRemainingBefore: 0,
        allocations: [],
        reason: "Storage location has no active capacity pools configured"
      };
    }

    const overlapRes = await txOrDb.execute(sql`
      SELECT cr.pool_id, COALESCE(SUM(cr.units_reserved), 0)::int AS reserved_units
      FROM capacity_reservations cr
      INNER JOIN bookings b ON b.id = cr.booking_id
      WHERE cr.location_id = ${params.locationId}
        AND cr.status IN ('CONFIRMED', 'HELD_FOR_HOST_APPROVAL', 'HELD_FOR_PAYMENT')
        AND (cr.status = 'CONFIRMED' OR cr.expires_at > NOW())
        AND b.status IN ('PENDING_HOST_APPROVAL', 'PENDING_PAYMENT', 'CONFIRMED', 'IN_STORAGE', 'DISPUTED')
        AND b.drop_off_at < ${params.collectionAt.toISOString()}::timestamptz
        AND b.collection_at > ${params.dropOffAt.toISOString()}::timestamptz
      GROUP BY cr.pool_id;
    `);

    const reservedByPool = new Map<string, number>();
    for (const row of overlapRes.rows as Array<{ pool_id: string; reserved_units: number }>) {
      reservedByPool.set(row.pool_id, Number(row.reserved_units));
    }

    const availableByPool = new Map<string, number>();
    let totalRemainingBefore = 0;
    for (const pool of pools) {
      const rem = Math.max(0, Number(pool.total_units) - (reservedByPool.get(pool.id) ?? 0));
      availableByPool.set(pool.id, rem);
      totalRemainingBefore += rem;
    }

    const allocations: PoolAllocationPlan[] = [];
    const consolidated = consolidateBagItems(params.items);

    for (const item of consolidated) {
      let unitsNeeded = item.quantity * STANDARD_BAG_UNIT_CONSUMPTION[item.bagCategory];

      // 1. Prefer DEDICATED pools for this category
      for (const pool of pools) {
        if (unitsNeeded <= 0) break;
        if (pool.pool_type === "DEDICATED" && pool.dedicated_bag_category === item.bagCategory) {
          const avail = availableByPool.get(pool.id) ?? 0;
          if (avail > 0) {
            const take = Math.min(avail, unitsNeeded);
            allocations.push({
              poolId: pool.id,
              bagCategory: item.bagCategory,
              unitsReserved: take
            });
            availableByPool.set(pool.id, avail - take);
            unitsNeeded -= take;
          }
        }
      }

      // 2. Overflow into SHARED pools
      for (const pool of pools) {
        if (unitsNeeded <= 0) break;
        if (pool.pool_type === "SHARED") {
          const avail = availableByPool.get(pool.id) ?? 0;
          if (avail > 0) {
            const take = Math.min(avail, unitsNeeded);
            allocations.push({
              poolId: pool.id,
              bagCategory: item.bagCategory,
              unitsReserved: take
            });
            availableByPool.set(pool.id, avail - take);
            unitsNeeded -= take;
          }
        }
      }

      if (unitsNeeded > 0) {
        return {
          canFulfill: false,
          remainingUnitsAfter: 0,
          totalRemainingBefore,
          allocations: [],
          reason: `Insufficient storage capacity for ${item.bagCategory} during requested time window`
        };
      }
    }

    let remainingUnitsAfter = 0;
    for (const rem of availableByPool.values()) {
      remainingUnitsAfter += rem;
    }

    return {
      canFulfill: true,
      remainingUnitsAfter,
      totalRemainingBefore,
      allocations,
      reason: null
    };
  }

  /**
   * Computes duration units in integer calendar days or 24-hour blocks.
   */
  computeDurationUnits(
    pricingUnit: "CALENDAR_DAY" | "24_HOUR_BLOCK",
    dropOffAt: Date,
    collectionAt: Date,
    timezone: string
  ): number {
    const diffMs = collectionAt.getTime() - dropOffAt.getTime();
    if (diffMs <= 0) {
      throw AppError.badRequest("Collection time must be after drop-off time");
    }

    if (pricingUnit === "24_HOUR_BLOCK") {
      return Math.max(1, Math.ceil(diffMs / DAY_MS));
    }

    const startDateStr = getLocalDateTimeParts(dropOffAt, timezone).dateStr;
    const endDateStr = getLocalDateTimeParts(collectionAt, timezone).dateStr;
    const startUtc = Date.parse(`${startDateStr}T00:00:00Z`);
    const endUtc = Date.parse(`${endDateStr}T00:00:00Z`);
    const days = Math.floor((endUtc - startUtc) / DAY_MS) + 1;
    return Math.max(1, days);
  }

  /**
   * Generates a complete server-side availability & integer minor-unit pricing quotation.
   */
  async calculateQuote(
    rawInput: BookingQuoteRequest,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options?: { tx?: any; lockPoolsForUpdate?: boolean }
  ): Promise<
    BookingQuoteResponse & {
      businessId: string;
      policyId: string;
      allocations: PoolAllocationPlan[];
    }
  > {
    const input = BookingQuoteRequestSchema.parse(rawInput);
    const txOrDb = options?.tx ?? db;

    if (!options?.tx) {
      await this.sweepExpiredHolds();
    }

    const dropOffAt = new Date(input.dropOffAt);
    const collectionAt = new Date(input.collectionAt);
    const items = consolidateBagItems(input.items);

    const [locRow] = await txOrDb
      .select({
        id: schema.storageLocations.id,
        businessId: schema.storageLocations.businessId,
        name: schema.storageLocations.name,
        timezone: schema.storageLocations.timezone,
        bookingMode: schema.storageLocations.bookingMode,
        acceptsOversized: schema.storageLocations.acceptsOversized,
        locationStatus: schema.storageLocations.status,
        businessStatus: schema.hostBusinesses.status
      })
      .from(schema.storageLocations)
      .innerJoin(
        schema.hostBusinesses,
        eq(schema.storageLocations.businessId, schema.hostBusinesses.id)
      )
      .where(eq(schema.storageLocations.id, input.locationId))
      .limit(1);

    if (!locRow || locRow.locationStatus !== "ACTIVE" || locRow.businessStatus !== "ACTIVE") {
      throw AppError.notFound("Storage location is not active or does not exist");
    }

    const [policy] = await txOrDb
      .select()
      .from(schema.pricingPolicies)
      .where(
        and(
          eq(schema.pricingPolicies.locationId, input.locationId),
          eq(schema.pricingPolicies.status, "ACTIVE")
        )
      )
      .limit(1);

    if (!policy) {
      throw AppError.badRequest("Storage location does not have an active pricing policy");
    }

    const tierRates = await txOrDb
      .select()
      .from(schema.pricingTierRates)
      .where(eq(schema.pricingTierRates.policyId, policy.id));

    const tierMap = new Map<string, number>();
    for (const tr of tierRates) {
      tierMap.set(tr.bagCategory, tr.rateMinor);
    }

    const hasOversized = items.some((i) => i.bagCategory === "BAG_OVERSIZED" && i.quantity > 0);
    let unavailabilityReason: string | null = null;

    if (hasOversized && !locRow.acceptsOversized) {
      unavailabilityReason = "This storage location does not accept oversized items";
    }

    if (!unavailabilityReason) {
      const hoursCheck = await this.validateOperatingWindow(
        txOrDb,
        locRow.id,
        locRow.timezone,
        dropOffAt,
        collectionAt
      );
      if (!hoursCheck.valid) {
        unavailabilityReason = hoursCheck.reason;
      }
    }

    const capacityPlan = await this.evaluateAndPlanCapacity(txOrDb, {
      locationId: locRow.id,
      dropOffAt,
      collectionAt,
      items,
      lockPoolsForUpdate: Boolean(options?.lockPoolsForUpdate)
    });

    if (!unavailabilityReason && !capacityPlan.canFulfill) {
      unavailabilityReason = capacityPlan.reason;
    }

    const pricingUnit = policy.pricingUnit as "CALENDAR_DAY" | "24_HOUR_BLOCK";
    const durationUnits = this.computeDurationUnits(
      pricingUnit,
      dropOffAt,
      collectionAt,
      locRow.timezone
    );

    let totalBags = 0;
    let requestedCapacityUnits = 0;
    let grossStorageMinor = 0;

    const quotedItems: QuotedLineItem[] = items.map((item) => {
      const unitRateMinor =
        tierMap.get(item.bagCategory) ??
        Math.round(
          (policy.baseRateMinor * DEFAULT_CATEGORY_MULTIPLIERS_BPS[item.bagCategory]) / 10000
        );
      const capacityUnits = item.quantity * STANDARD_BAG_UNIT_CONSUMPTION[item.bagCategory];
      const lineTotalMinor = unitRateMinor * item.quantity * durationUnits;

      totalBags += item.quantity;
      requestedCapacityUnits += capacityUnits;
      grossStorageMinor += lineTotalMinor;

      return {
        bagCategory: item.bagCategory,
        quantity: item.quantity,
        capacityUnits,
        unitRateMinor,
        durationUnits,
        lineTotalMinor
      };
    });

    const discountMinor = 0;
    const storageSubtotalMinor = grossStorageMinor - discountMinor;
    const commissionRateBps = DEFAULT_COMMISSION_RATE_BPS;
    const platformCommissionMinor = Math.floor(
      (storageSubtotalMinor * commissionRateBps) / 10000
    );
    const hostPayableMinor = storageSubtotalMinor - platformCommissionMinor;
    const taxRateBps = 0;
    const taxAmountMinor = 0;
    const totalAmountMinor = storageSubtotalMinor + taxAmountMinor;

    return {
      locationId: locRow.id,
      businessId: locRow.businessId,
      policyId: policy.id,
      allocations: capacityPlan.allocations,
      locationName: locRow.name,
      bookingMode: locRow.bookingMode as "INSTANT" | "HOST_APPROVAL",
      timezone: locRow.timezone,
      available: unavailabilityReason === null,
      unavailabilityReason,
      remainingCapacityUnits: capacityPlan.totalRemainingBefore,
      requestedCapacityUnits,
      totalBags,
      currency: policy.currency || "LKR",
      currencyExponent: 2,
      pricingUnit,
      durationUnits,
      baseRateMinor: policy.baseRateMinor,
      items: quotedItems,
      grossStorageMinor,
      discountMinor,
      storageSubtotalMinor,
      commissionRateBps,
      platformCommissionMinor,
      hostPayableMinor,
      taxRateBps,
      taxAmountMinor,
      totalAmountMinor,
      cancellationPolicyCode: "STANDARD_FLEX_2H",
      cancellationPolicySummary:
        "100% refund >2 hours before drop-off, 50% within 2 hours of drop-off, 0% after drop-off starts."
    };
  }

  /**
   * Availability search across active locations for a specific schedule and bag selection.
   */
  async searchAvailability(rawQuery: AvailabilitySearchQuery) {
    const query = AvailabilitySearchQuerySchema.parse(rawQuery);
    await this.sweepExpiredHolds();

    const items: BookingBagItemInput[] = [];
    if (query.smallBags > 0) items.push({ bagCategory: "BAG_SMALL", quantity: query.smallBags });
    if (query.mediumBags > 0) items.push({ bagCategory: "BAG_MEDIUM", quantity: query.mediumBags });
    if (query.largeBags > 0) items.push({ bagCategory: "BAG_LARGE", quantity: query.largeBags });
    if (query.oversizedBags > 0) {
      items.push({ bagCategory: "BAG_OVERSIZED", quantity: query.oversizedBags });
    }
    if (items.length === 0) {
      items.push({ bagCategory: "BAG_MEDIUM", quantity: 1 });
    }

    const locConditions = [
      eq(schema.storageLocations.status, "ACTIVE"),
      eq(schema.hostBusinesses.status, "ACTIVE")
    ];
    if (query.locationId) {
      locConditions.push(eq(schema.storageLocations.id, query.locationId));
    }
    if (query.city) {
      locConditions.push(sql`${schema.storageLocations.city} ILIKE ${`%${query.city}%`}`);
    }

    const activeLocs = await db
      .select({ id: schema.storageLocations.id })
      .from(schema.storageLocations)
      .innerJoin(
        schema.hostBusinesses,
        eq(schema.storageLocations.businessId, schema.hostBusinesses.id)
      )
      .where(and(...locConditions))
      .limit(30);

    const quotes: BookingQuoteResponse[] = [];
    for (const loc of activeLocs) {
      try {
        const fullQuote = await this.calculateQuote({
          locationId: loc.id,
          dropOffAt: query.dropOffAt,
          collectionAt: query.collectionAt,
          items
        });
        const { businessId: _b, policyId: _p, allocations: _a, ...publicQuote } = fullQuote;
        quotes.push(publicQuote);
      } catch {
        // Skip locations without active pricing policy
      }
    }

    return { quotes };
  }
}

export const quotationService = new QuotationAndAvailabilityService();

