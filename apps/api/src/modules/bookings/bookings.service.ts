import crypto from "node:crypto";
import { eq, and, desc, sql, inArray, or, ilike } from "drizzle-orm";
import {
  BookingStatus,
  BookingDetail,
  BookingListQuery,
  BookingListQuerySchema,
  CreateBookingRequest,
  CreateBookingRequestSchema,
  CancelBookingRequest,
  CancelBookingRequestSchema,
  HostDecisionBookingRequest,
  HostRejectBookingRequest,
  HostRejectBookingRequestSchema,
  RecordBookingExceptionRequest,
  RecordBookingExceptionRequestSchema,
  DEFAULT_HOST_APPROVAL_HOLD_MINUTES,
  DEFAULT_PAYMENT_HOLD_MINUTES,
  QuotedLineItem
} from "@luggage-storage/contracts";
import { db, schema } from "../../infrastructure/database/drizzle.js";
import { withSerializableOrDeadlockRetry } from "../../infrastructure/database/tx-retry.js";
import { AppError } from "../../common/errors/app-error.js";
import { auditService, SecurityEventType, AuditClientInfo } from "../audit/audit.service.js";
import { rateLimitService } from "../auth/rate-limit.service.js";
import { quotationService } from "./quotation-availability.service.js";
import { assertHostLocationAccess, getAccessibleHostLocationIds } from "./host-access.helper.js";
import { ledgerService } from "../finance/ledger.service.js";

const VALID_BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING_HOST_APPROVAL: [
    "PENDING_PAYMENT",
    "REJECTED",
    "CANCELLED_BY_TRAVELLER",
    "CANCELLED_BY_HOST",
    "CANCELLED_BY_PLATFORM",
    "EXPIRED"
  ],
  PENDING_PAYMENT: [
    "CONFIRMED",
    "CANCELLED_BY_TRAVELLER",
    "CANCELLED_BY_HOST",
    "CANCELLED_BY_PLATFORM",
    "EXPIRED"
  ],
  CONFIRMED: [
    "IN_STORAGE",
    "CANCELLED_BY_TRAVELLER",
    "CANCELLED_BY_HOST",
    "CANCELLED_BY_PLATFORM",
    "DISPUTED"
  ],
  IN_STORAGE: ["COMPLETED", "DISPUTED"],
  COMPLETED: ["DISPUTED"],
  DISPUTED: ["COMPLETED", "CANCELLED_BY_PLATFORM"],
  CANCELLED_BY_TRAVELLER: [],
  CANCELLED_BY_HOST: [],
  CANCELLED_BY_PLATFORM: [],
  REJECTED: [],
  EXPIRED: []
};

export function assertValidBookingTransition(from: BookingStatus, to: BookingStatus): void {
  const allowed = VALID_BOOKING_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw AppError.conflict(`Invalid booking state transition from ${from} to ${to}`);
  }
}

function generateBookingReferenceCode(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return `LSB-${y}${m}${d}-${suffix}`;
}

function maskEmailAddress(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const prefix = local.slice(0, Math.min(2, local.length));
  return `${prefix}***@${domain}`;
}

/**
 * Evaluates OQ-009 customer cancellation refund percentage.
 */
export function evaluateCancellationRefundPercentage(params: {
  actorKind: "TRAVELLER" | "HOST" | "PLATFORM";
  dropOffAt: Date;
  now?: Date;
}): number {
  if (params.actorKind === "HOST" || params.actorKind === "PLATFORM") {
    return 100;
  }
  const nowMs = (params.now ?? new Date()).getTime();
  const msUntilDropOff = params.dropOffAt.getTime() - nowMs;
  const twoHoursMs = 2 * 60 * 60 * 1000;

  if (msUntilDropOff > twoHoursMs) {
    return 100;
  }
  if (msUntilDropOff > 0) {
    return 50;
  }
  return 0;
}

export class BookingsService {
  /**
   * Creates a capacity-locked booking hold and immutable pricing snapshot.
   */
  async createBooking(
    travellerUserId: string,
    rawInput: CreateBookingRequest,
    clientInfo?: AuditClientInfo
  ): Promise<BookingDetail> {
    const input = CreateBookingRequestSchema.parse(rawInput);

    await rateLimitService.enforce({
      scope: "booking_create_user",
      identifier: travellerUserId,
      message: "Too many booking attempts. Please wait a moment before trying again.",
      clientInfo: {
        ip: clientInfo?.ip ?? undefined,
        userAgent: clientInfo?.userAgent ?? undefined,
        correlationId: clientInfo?.correlationId ?? undefined
      }
    });

    await quotationService.sweepExpiredHolds();

    // Fast-path idempotency check prior to acquiring row locks
    if (input.idempotencyKey) {
      const [existing] = await db
        .select({ id: schema.bookings.id })
        .from(schema.bookings)
        .where(
          and(
            eq(schema.bookings.travellerUserId, travellerUserId),
            eq(schema.bookings.idempotencyKey, input.idempotencyKey)
          )
        )
        .limit(1);

      if (existing) {
        return this.getBookingDetail(existing.id, travellerUserId, ["TRAVELLER"]);
      }
    }

    // Sweep expired holds BEFORE acquiring Tier-1 storage_capacity_pools locks inside the tx
    await quotationService.sweepExpiredHolds();

    const bookingId = await withSerializableOrDeadlockRetry(() =>
      db.transaction(async (tx) => {
        if (input.idempotencyKey) {
        const [existingInTx] = await tx
          .select({ id: schema.bookings.id })
          .from(schema.bookings)
          .where(
            and(
              eq(schema.bookings.travellerUserId, travellerUserId),
              eq(schema.bookings.idempotencyKey, input.idempotencyKey)
            )
          )
          .limit(1);

        if (existingInTx) {
          return existingInTx.id;
        }
      }

      const quote = await quotationService.calculateQuote(
        {
          locationId: input.locationId,
          dropOffAt: input.dropOffAt,
          collectionAt: input.collectionAt,
          items: input.items
        },
        { tx, lockPoolsForUpdate: true }
      );

      if (!quote.available) {
        throw AppError.conflict(
          quote.unavailabilityReason || "Storage capacity is unavailable for the selected schedule"
        );
      }

      const now = new Date();
      const isInstant = quote.bookingMode === "INSTANT";
      const initialStatus: BookingStatus = isInstant
        ? "PENDING_PAYMENT"
        : "PENDING_HOST_APPROVAL";
      const holdMinutes = isInstant
        ? DEFAULT_PAYMENT_HOLD_MINUTES
        : DEFAULT_HOST_APPROVAL_HOLD_MINUTES;
      const holdExpiresAt = new Date(now.getTime() + holdMinutes * 60_000);
      const reservationStatus = isInstant ? "HELD_FOR_PAYMENT" : "HELD_FOR_HOST_APPROVAL";
      const referenceCode = generateBookingReferenceCode(now);

      const [created] = await tx
        .insert(schema.bookings)
        .values({
          referenceCode,
          idempotencyKey: input.idempotencyKey ?? null,
          travellerUserId,
          businessId: quote.businessId,
          locationId: quote.locationId,
          bookingMode: quote.bookingMode,
          status: initialStatus,
          dropOffAt: new Date(input.dropOffAt),
          collectionAt: new Date(input.collectionAt),
          totalBags: quote.totalBags,
          totalCapacityUnits: quote.requestedCapacityUnits,
          currency: quote.currency,
          totalAmountMinor: quote.totalAmountMinor,
          holdExpiresAt,
          travellerNotes: input.travellerNotes ?? null,
          createdAt: now,
          updatedAt: now
        })
        .returning({ id: schema.bookings.id });

      await tx.insert(schema.bookingItems).values(
        quote.items.map((item) => ({
          bookingId: created.id,
          bagCategory: item.bagCategory,
          quantity: item.quantity,
          capacityUnits: item.capacityUnits,
          unitRateMinor: item.unitRateMinor,
          lineTotalMinor: item.lineTotalMinor
        }))
      );

      await tx.insert(schema.bookingPricingSnapshots).values({
        bookingId: created.id,
        policyId: quote.policyId,
        currency: quote.currency,
        currencyExponent: quote.currencyExponent,
        pricingUnit: quote.pricingUnit,
        baseRateMinor: quote.baseRateMinor,
        durationUnits: quote.durationUnits,
        itemsBreakdown: quote.items,
        grossStorageMinor: quote.grossStorageMinor,
        discountMinor: quote.discountMinor,
        storageSubtotalMinor: quote.storageSubtotalMinor,
        commissionRateBps: quote.commissionRateBps,
        platformCommissionMinor: quote.platformCommissionMinor,
        hostPayableMinor: quote.hostPayableMinor,
        taxRateBps: quote.taxRateBps,
        taxAmountMinor: quote.taxAmountMinor,
        totalAmountMinor: quote.totalAmountMinor,
        cancellationPolicyCode: quote.cancellationPolicyCode
      });

      await tx.insert(schema.capacityReservations).values(
        quote.allocations.map((alloc) => ({
          bookingId: created.id,
          locationId: quote.locationId,
          poolId: alloc.poolId,
          bagCategory: alloc.bagCategory,
          unitsReserved: alloc.unitsReserved,
          status: reservationStatus,
          expiresAt: holdExpiresAt
        }))
      );

      await tx.insert(schema.bookingStatusHistory).values({
        bookingId: created.id,
        previousStatus: null,
        newStatus: initialStatus,
        actorUserId: travellerUserId,
        actorRole: "TRAVELLER",
        reason: isInstant
          ? "Instant booking hold created awaiting payment"
          : "Host-approval booking request submitted",
        metadata: {
          holdExpiresAt: holdExpiresAt.toISOString(),
          totalAmountMinor: quote.totalAmountMinor
        }
      });

      await auditService.recordEvent({
        eventType: SecurityEventType.BOOKING_CREATED,
        userId: travellerUserId,
        clientInfo,
        metadata: {
          bookingId: created.id,
          referenceCode,
          locationId: quote.locationId,
          businessId: quote.businessId,
          newStatus: initialStatus,
          amountMinor: quote.totalAmountMinor,
          currency: quote.currency
        },
        tx
      });

      return created.id;
      })
    );

    return this.getBookingDetail(bookingId, travellerUserId, ["TRAVELLER"]);
  }

  /**
   * Retrieves a single booking with OQ-012 post-confirmation address privacy enforcement.
   */
  async getBookingDetail(
    bookingId: string,
    callerUserId: string,
    callerRoles: string[]
  ): Promise<BookingDetail> {
    await quotationService.sweepExpiredHolds();

    const [row] = await db
      .select({
        booking: schema.bookings,
        travellerDisplayName: schema.users.displayName,
        travellerEmail: schema.users.email,
        businessName: schema.hostBusinesses.tradeName,
        locId: schema.storageLocations.id,
        locName: schema.storageLocations.name,
        locCity: schema.storageLocations.city,
        locCountry: schema.storageLocations.countryCode,
        locTimezone: schema.storageLocations.timezone,
        locAddress1: schema.storageLocations.addressLine1,
        locAddress2: schema.storageLocations.addressLine2,
        locPostal: schema.storageLocations.postalCode,
        locDirections: schema.storageLocations.description,
        approxLat: sql<number>`ST_Y(${schema.storageLocations.coarseCoordinates}::geometry)`,
        approxLng: sql<number>`ST_X(${schema.storageLocations.coarseCoordinates}::geometry)`,
        exactLat: schema.storageLocations.latitude,
        exactLng: schema.storageLocations.longitude
      })
      .from(schema.bookings)
      .innerJoin(schema.users, eq(schema.bookings.travellerUserId, schema.users.id))
      .innerJoin(schema.hostBusinesses, eq(schema.bookings.businessId, schema.hostBusinesses.id))
      .innerJoin(schema.storageLocations, eq(schema.bookings.locationId, schema.storageLocations.id))
      .where(eq(schema.bookings.id, bookingId))
      .limit(1);

    if (!row) {
      throw AppError.notFound("Booking not found");
    }

    const isAdminOrSupport =
      callerRoles.includes("SUPERADMIN") || callerRoles.includes("SUPPORT");
    const isTravellerOwner = row.booking.travellerUserId === callerUserId;

    let isAuthorizedHost = false;
    if (!isAdminOrSupport && !isTravellerOwner) {
      await assertHostLocationAccess(db, callerUserId, callerRoles, row.booking.locationId);
      isAuthorizedHost = true;
    }

    const [items, snapshotRows, historyRows, paymentRows, refundRows, custodyRows] =
      await Promise.all([
        db
          .select()
          .from(schema.bookingItems)
          .where(eq(schema.bookingItems.bookingId, bookingId)),
        db
          .select()
          .from(schema.bookingPricingSnapshots)
          .where(eq(schema.bookingPricingSnapshots.bookingId, bookingId))
          .limit(1),
        db
          .select()
          .from(schema.bookingStatusHistory)
          .where(eq(schema.bookingStatusHistory.bookingId, bookingId))
          .orderBy(schema.bookingStatusHistory.createdAt),
        db
          .select()
          .from(schema.paymentIntents)
          .where(eq(schema.paymentIntents.bookingId, bookingId))
          .orderBy(desc(schema.paymentIntents.createdAt))
          .limit(1),
        db
          .select()
          .from(schema.refundRecords)
          .where(eq(schema.refundRecords.bookingId, bookingId))
          .orderBy(desc(schema.refundRecords.createdAt))
          .limit(1),
        db
          .select()
          .from(schema.custodyRecords)
          .where(eq(schema.custodyRecords.bookingId, bookingId))
          .limit(1)
      ]);

    const status = row.booking.status as BookingStatus;

    // OQ-012 Post-Confirmation Address Disclosure Rule:
    // Travellers ONLY receive exact street address and coordinates after verified payment confirmation.
    const confirmedPostPayment =
      status === "CONFIRMED" ||
      status === "IN_STORAGE" ||
      status === "COMPLETED" ||
      (status === "DISPUTED" && row.booking.confirmedAt !== null);

    const addressDisclosed = isAdminOrSupport || isAuthorizedHost || (isTravellerOwner && confirmedPostPayment);

    const snap = snapshotRows[0] ?? null;
    const latestIntent = paymentRows[0] ?? null;
    const latestRefund = refundRows[0] ?? null;
    const custody = custodyRows[0] ?? null;

    return {
      id: row.booking.id,
      referenceCode: row.booking.referenceCode,
      travellerUserId: row.booking.travellerUserId,
      travellerDisplayName: row.travellerDisplayName,
      travellerEmailMasked: maskEmailAddress(row.travellerEmail),
      businessId: row.booking.businessId,
      businessName: row.businessName,
      locationId: row.booking.locationId,
      bookingMode: row.booking.bookingMode as "INSTANT" | "HOST_APPROVAL",
      status,
      dropOffAt: row.booking.dropOffAt.toISOString(),
      collectionAt: row.booking.collectionAt.toISOString(),
      totalBags: row.booking.totalBags,
      totalCapacityUnits: row.booking.totalCapacityUnits,
      currency: row.booking.currency,
      totalAmountMinor: row.booking.totalAmountMinor,
      holdExpiresAt: row.booking.holdExpiresAt ? row.booking.holdExpiresAt.toISOString() : null,
      confirmedAt: row.booking.confirmedAt ? row.booking.confirmedAt.toISOString() : null,
      checkedInAt: row.booking.checkedInAt ? row.booking.checkedInAt.toISOString() : null,
      completedAt: row.booking.completedAt ? row.booking.completedAt.toISOString() : null,
      cancelledAt: row.booking.cancelledAt ? row.booking.cancelledAt.toISOString() : null,
      cancellationReason: row.booking.cancellationReason,
      hostRejectionReason: row.booking.hostRejectionReason,
      exceptionReason: row.booking.exceptionReason,
      travellerNotes: row.booking.travellerNotes,
      createdAt: row.booking.createdAt.toISOString(),
      updatedAt: row.booking.updatedAt.toISOString(),
      location: {
        id: row.locId,
        name: row.locName,
        city: row.locCity,
        countryCode: row.locCountry,
        timezone: row.locTimezone,
        approximateArea: `${row.locCity} District`,
        approximateLatitude: Number(Number(row.approxLat).toFixed(2)),
        approximateLongitude: Number(Number(row.approxLng).toFixed(2)),
        addressDisclosed,
        addressLine1: addressDisclosed ? row.locAddress1 : null,
        addressLine2: addressDisclosed ? row.locAddress2 : null,
        postalCode: addressDisclosed ? row.locPostal : null,
        directionsNotes: addressDisclosed ? row.locDirections : null,
        exactLatitude: addressDisclosed ? Number(row.exactLat) : null,
        exactLongitude: addressDisclosed ? Number(row.exactLng) : null
      },
      items: items.map((i) => ({
        id: i.id,
        bookingId: i.bookingId,
        bagCategory: i.bagCategory as BookingDetail["items"][number]["bagCategory"],
        quantity: i.quantity,
        capacityUnits: i.capacityUnits,
        unitRateMinor: i.unitRateMinor,
        lineTotalMinor: i.lineTotalMinor
      })),
      pricingSnapshot: snap
        ? {
            id: snap.id,
            bookingId: snap.bookingId,
            policyId: snap.policyId,
            currency: snap.currency,
            currencyExponent: snap.currencyExponent,
            pricingUnit: snap.pricingUnit as "CALENDAR_DAY" | "24_HOUR_BLOCK",
            baseRateMinor: snap.baseRateMinor,
            durationUnits: snap.durationUnits,
            itemsBreakdown: (snap.itemsBreakdown as QuotedLineItem[]) ?? [],
            grossStorageMinor: snap.grossStorageMinor,
            discountMinor: snap.discountMinor,
            storageSubtotalMinor: snap.storageSubtotalMinor,
            commissionRateBps: snap.commissionRateBps,
            platformCommissionMinor: snap.platformCommissionMinor,
            hostPayableMinor: snap.hostPayableMinor,
            taxRateBps: snap.taxRateBps,
            taxAmountMinor: snap.taxAmountMinor,
            totalAmountMinor: snap.totalAmountMinor,
            cancellationPolicyCode: snap.cancellationPolicyCode,
            createdAt: snap.createdAt.toISOString()
          }
        : null,
      paymentSummary: latestIntent
        ? {
            intentId: latestIntent.id,
            provider: latestIntent.provider,
            status: latestIntent.status,
            amountMinor: latestIntent.amountMinor,
            verifiedAt: latestIntent.verifiedAt ? latestIntent.verifiedAt.toISOString() : null
          }
        : null,
      refundSummary: latestRefund
        ? {
            refundId: latestRefund.id,
            amountMinor: latestRefund.amountMinor,
            refundPercentage: latestRefund.refundPercentage,
            status: latestRefund.status,
            reasonCategory: latestRefund.reasonCategory
          }
        : null,
      custodySummary: custody
        ? {
            custodyRecordId: custody.id,
            status: custody.status,
            expectedBagCount: custody.expectedBagCount,
            checkedInBagCount: custody.checkedInBagCount,
            releasedBagCount: custody.releasedBagCount,
            checkInAt: custody.checkInAt ? custody.checkInAt.toISOString() : null,
            checkOutAt: custody.checkOutAt ? custody.checkOutAt.toISOString() : null,
            handoverCondition: custody.handoverCondition,
            overdueMinutes: custody.overdueMinutes,
            overdueFeeMinor: custody.overdueFeeMinor
          }
        : null,
      statusHistory: historyRows.map((h) => ({
        id: h.id,
        bookingId: h.bookingId,
        previousStatus: (h.previousStatus as BookingStatus | null) ?? null,
        newStatus: h.newStatus as BookingStatus,
        actorUserId: h.actorUserId,
        actorRole: h.actorRole,
        reason: h.reason,
        metadata: (h.metadata as Record<string, unknown>) ?? {},
        createdAt: h.createdAt.toISOString()
      }))
    };
  }

  /**
   * Lists bookings owned by an authenticated traveller.
   */
  async listTravellerBookings(
    travellerUserId: string,
    rawQuery: Partial<BookingListQuery>
  ): Promise<{ bookings: BookingDetail[]; total: number; page: number; limit: number }> {
    await quotationService.sweepExpiredHolds();
    const query = BookingListQuerySchema.parse(rawQuery);
    const offset = (query.page - 1) * query.limit;

    const conditions = [eq(schema.bookings.travellerUserId, travellerUserId)];
    if (query.status) {
      conditions.push(eq(schema.bookings.status, query.status));
    }

    const whereClause = and(...conditions);

    const [countRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.bookings)
      .where(whereClause);

    const total = countRes?.count ?? 0;
    const rows = await db
      .select({ id: schema.bookings.id })
      .from(schema.bookings)
      .where(whereClause)
      .orderBy(desc(schema.bookings.createdAt))
      .limit(query.limit)
      .offset(offset);

    const bookings = await Promise.all(
      rows.map((r) => this.getBookingDetail(r.id, travellerUserId, ["TRAVELLER"]))
    );

    return { bookings, total, page: query.page, limit: query.limit };
  }

  /**
   * Lists bookings strictly scoped to host's owned or staff-assigned storage locations.
   */
  async listHostBookings(
    userId: string,
    userRoles: string[],
    rawQuery: Partial<BookingListQuery>
  ): Promise<{ bookings: BookingDetail[]; total: number; page: number; limit: number }> {
    await quotationService.sweepExpiredHolds();
    const query = BookingListQuerySchema.parse(rawQuery);
    const accessibleLocIds = await getAccessibleHostLocationIds(
      userId,
      userRoles,
      query.businessId
    );

    if (query.locationId && !accessibleLocIds.includes(query.locationId)) {
      throw AppError.forbidden("You do not have access to bookings for this storage location");
    }

    if (accessibleLocIds.length === 0) {
      return { bookings: [], total: 0, page: query.page, limit: query.limit };
    }

    const conditions = [
      query.locationId
        ? eq(schema.bookings.locationId, query.locationId)
        : inArray(schema.bookings.locationId, accessibleLocIds)
    ];

    if (query.status) {
      conditions.push(eq(schema.bookings.status, query.status));
    }
    if (query.search) {
      conditions.push(ilike(schema.bookings.referenceCode, `%${query.search}%`));
    }

    const whereClause = and(...conditions);
    const offset = (query.page - 1) * query.limit;

    const [countRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.bookings)
      .where(whereClause);

    const total = countRes?.count ?? 0;
    const rows = await db
      .select({ id: schema.bookings.id })
      .from(schema.bookings)
      .where(whereClause)
      .orderBy(desc(schema.bookings.createdAt))
      .limit(query.limit)
      .offset(offset);

    const bookings = await Promise.all(
      rows.map((r) => this.getBookingDetail(r.id, userId, userRoles))
    );

    return { bookings, total, page: query.page, limit: query.limit };
  }

  /**
   * Lists bookings globally for Superadmin and Support operational visibility.
   */
  async listAdminBookings(
    callerUserId: string,
    callerRoles: string[],
    rawQuery: Partial<BookingListQuery>
  ): Promise<{ bookings: BookingDetail[]; total: number; page: number; limit: number }> {
    await quotationService.sweepExpiredHolds();
    const query = BookingListQuerySchema.parse(rawQuery);
    const offset = (query.page - 1) * query.limit;

    const conditions = [];
    if (query.status) conditions.push(eq(schema.bookings.status, query.status));
    if (query.locationId) conditions.push(eq(schema.bookings.locationId, query.locationId));
    if (query.businessId) conditions.push(eq(schema.bookings.businessId, query.businessId));
    if (query.search) {
      const pattern = `%${query.search}%`;
      conditions.push(or(ilike(schema.bookings.referenceCode, pattern))!);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.bookings)
      .where(whereClause);

    const total = countRes?.count ?? 0;
    const rows = await db
      .select({ id: schema.bookings.id })
      .from(schema.bookings)
      .where(whereClause)
      .orderBy(desc(schema.bookings.createdAt))
      .limit(query.limit)
      .offset(offset);

    const bookings = await Promise.all(
      rows.map((r) => this.getBookingDetail(r.id, callerUserId, callerRoles))
    );

    return { bookings, total, page: query.page, limit: query.limit };
  }

  /**
   * Host accepts a PENDING_HOST_APPROVAL request, transitioning it to PENDING_PAYMENT (+10m hold).
   */
  async hostAcceptBooking(
    bookingId: string,
    hostUserId: string,
    hostRoles: string[],
    input: HostDecisionBookingRequest,
    clientInfo?: AuditClientInfo
  ): Promise<BookingDetail> {
    await quotationService.sweepExpiredHolds();

    const expiredHold = await withSerializableOrDeadlockRetry(() =>
      db.transaction(async (tx) => {
        const lockedRes = await tx.execute(sql`
        SELECT id, location_id, status, hold_expires_at, reference_code, NOW() AS db_now
        FROM bookings
        WHERE id = ${bookingId}
        FOR UPDATE;
      `);
        const bookingRow = lockedRes.rows[0] as
          | {
              id: string;
              location_id: string;
              status: BookingStatus;
              hold_expires_at: Date | string | null;
              reference_code: string;
              db_now: Date | string;
            }
          | undefined;

        if (!bookingRow) {
          throw AppError.notFound("Booking not found");
        }

        const access = await assertHostLocationAccess(
          tx,
          hostUserId,
          hostRoles,
          bookingRow.location_id
        );

        const dbNow = new Date(bookingRow.db_now);
        if (
          bookingRow.status === "PENDING_HOST_APPROVAL" &&
          bookingRow.hold_expires_at &&
          new Date(bookingRow.hold_expires_at).getTime() <= dbNow.getTime()
        ) {
          await quotationService.expireSingleBookingHoldInTx(tx, bookingId, bookingRow.status);
          return true as const;
        }

        assertValidBookingTransition(bookingRow.status, "PENDING_PAYMENT");

        const now = dbNow;
        const paymentHoldExpiresAt = new Date(
          now.getTime() + DEFAULT_PAYMENT_HOLD_MINUTES * 60_000
        );

        await tx
          .update(schema.bookings)
          .set({
            status: "PENDING_PAYMENT",
            hostApprovedAt: now,
            hostApprovedBy: hostUserId,
            holdExpiresAt: paymentHoldExpiresAt,
            updatedAt: now
          })
          .where(eq(schema.bookings.id, bookingId));

        await tx
          .update(schema.capacityReservations)
          .set({
            status: "HELD_FOR_PAYMENT",
            expiresAt: paymentHoldExpiresAt,
            updatedAt: now
          })
          .where(
            and(
              eq(schema.capacityReservations.bookingId, bookingId),
              eq(schema.capacityReservations.status, "HELD_FOR_HOST_APPROVAL")
            )
          );

        await tx.insert(schema.bookingStatusHistory).values({
          bookingId,
          previousStatus: bookingRow.status,
          newStatus: "PENDING_PAYMENT",
          actorUserId: hostUserId,
          actorRole: access.actorRole,
          reason: input.reason ?? "Host approved booking request",
          metadata: {
            paymentHoldExpiresAt: paymentHoldExpiresAt.toISOString()
          }
        });

        await auditService.recordEvent({
          eventType: SecurityEventType.BOOKING_HOST_APPROVED,
          userId: hostUserId,
          clientInfo,
          metadata: {
            bookingId,
            referenceCode: bookingRow.reference_code,
            locationId: bookingRow.location_id,
            businessId: access.businessId,
            previousStatus: bookingRow.status,
            newStatus: "PENDING_PAYMENT"
          },
          tx
        });

        return false as const;
      })
    );

    if (expiredHold) {
      throw AppError.conflict("Booking request hold has already expired");
    }

    return this.getBookingDetail(bookingId, hostUserId, hostRoles);
  }

  /**
   * Host rejects a PENDING_HOST_APPROVAL request, releasing held capacity immediately.
   */
  async hostRejectBooking(
    bookingId: string,
    hostUserId: string,
    hostRoles: string[],
    rawInput: HostRejectBookingRequest,
    clientInfo?: AuditClientInfo
  ): Promise<BookingDetail> {
    const input = HostRejectBookingRequestSchema.parse(rawInput);

    await withSerializableOrDeadlockRetry(() =>
      db.transaction(async (tx) => {
        const lockedRes = await tx.execute(sql`
        SELECT id, location_id, status, reference_code
        FROM bookings
        WHERE id = ${bookingId}
        FOR UPDATE;
      `);
        const bookingRow = lockedRes.rows[0] as
          | {
              id: string;
              location_id: string;
              status: BookingStatus;
              reference_code: string;
            }
          | undefined;

        if (!bookingRow) {
          throw AppError.notFound("Booking not found");
        }

        const access = await assertHostLocationAccess(
          tx,
          hostUserId,
          hostRoles,
          bookingRow.location_id
        );

        assertValidBookingTransition(bookingRow.status, "REJECTED");

        const openIntentsRes = await tx.execute(sql`
        SELECT id
        FROM payment_intents
        WHERE booking_id = ${bookingId}
          AND status IN ('INITIATED', 'PENDING_GATEWAY')
        ORDER BY id ASC
        FOR UPDATE;
      `);
        const openIntentIds = (openIntentsRes.rows as Array<{ id: string }>).map((r) => r.id);

        const now = new Date();
        await tx
          .update(schema.bookings)
          .set({
            status: "REJECTED",
            hostRejectedAt: now,
            hostRejectionReason: input.reason,
            holdExpiresAt: null,
            updatedAt: now
          })
          .where(eq(schema.bookings.id, bookingId));

        if (openIntentIds.length > 0) {
          await tx
            .update(schema.paymentIntents)
            .set({
              status: "EXPIRED",
              failureReason: "Host rejected booking",
              updatedAt: now
            })
            .where(inArray(schema.paymentIntents.id, openIntentIds));
        }

        await tx
          .update(schema.capacityReservations)
          .set({
            status: "RELEASED",
            releasedAt: now,
            releaseReason: "HOST_REJECTED",
            updatedAt: now
          })
          .where(eq(schema.capacityReservations.bookingId, bookingId));

        await tx.insert(schema.bookingStatusHistory).values({
          bookingId,
          previousStatus: bookingRow.status,
          newStatus: "REJECTED",
          actorUserId: hostUserId,
          actorRole: access.actorRole,
          reason: input.reason,
          metadata: {}
        });

        await auditService.recordEvent({
          eventType: SecurityEventType.BOOKING_HOST_REJECTED,
          userId: hostUserId,
          clientInfo,
          metadata: {
            bookingId,
            referenceCode: bookingRow.reference_code,
            locationId: bookingRow.location_id,
            businessId: access.businessId,
            reason: input.reason
          },
          tx
        });
      })
    );

    return this.getBookingDetail(bookingId, hostUserId, hostRoles);
  }

  /**
   * Cancels a booking (by TRAVELLER, HOST, or PLATFORM), releases capacity,
   * evaluates OQ-009 refund policy tiers, and reconciles the financial ledger.
   */
  async cancelBooking(
    bookingId: string,
    actorUserId: string,
    actorRoles: string[],
    actorKind: "TRAVELLER" | "HOST" | "PLATFORM",
    rawInput: CancelBookingRequest,
    clientInfo?: AuditClientInfo
  ): Promise<BookingDetail> {
    const input = CancelBookingRequestSchema.parse(rawInput);

    await withSerializableOrDeadlockRetry(() =>
      db.transaction(async (tx) => {
        // Tier 2 Lock: bookings
        const lockedRes = await tx.execute(sql`
        SELECT id, traveller_user_id, business_id, location_id, status, drop_off_at, currency, reference_code, NOW() AS db_now
        FROM bookings
        WHERE id = ${bookingId}
        FOR UPDATE;
      `);
        const bookingRow = lockedRes.rows[0] as
          | {
              id: string;
              traveller_user_id: string;
              business_id: string;
              location_id: string;
              status: BookingStatus;
              drop_off_at: Date | string;
              currency: string;
              reference_code: string;
              db_now: Date | string;
            }
          | undefined;

        if (!bookingRow) {
          throw AppError.notFound("Booking not found");
        }

        let resolvedActorRole = "TRAVELLER";
        if (actorKind === "TRAVELLER") {
          if (bookingRow.traveller_user_id !== actorUserId) {
            throw AppError.forbidden("You can only cancel your own bookings");
          }
        } else if (actorKind === "HOST") {
          const access = await assertHostLocationAccess(
            tx,
            actorUserId,
            actorRoles,
            bookingRow.location_id
          );
          resolvedActorRole = access.actorRole;
        } else {
          if (!actorRoles.includes("SUPERADMIN")) {
            throw AppError.forbidden("Platform booking cancellation requires SUPERADMIN authority");
          }
          resolvedActorRole = "SUPERADMIN";
        }

        const targetStatus: BookingStatus =
          actorKind === "TRAVELLER"
            ? "CANCELLED_BY_TRAVELLER"
            : actorKind === "HOST"
            ? "CANCELLED_BY_HOST"
            : "CANCELLED_BY_PLATFORM";

        assertValidBookingTransition(bookingRow.status, targetStatus);

        // Tier 3 Lock: payment_intents ORDER BY id ASC
        const lockedIntentsRes = await tx.execute(sql`
        SELECT id, status, amount_minor, currency
        FROM payment_intents
        WHERE booking_id = ${bookingId}
        ORDER BY id ASC
        FOR UPDATE;
      `);
        const lockedIntents = lockedIntentsRes.rows as Array<{
          id: string;
          status: string;
          amount_minor: number;
          currency: string;
        }>;

        // Tier 4 Lock: refund_records & open custody_tokens ORDER BY id ASC
        const lockedRefundsRes = await tx.execute(sql`
        SELECT id, payment_intent_id
        FROM refund_records
        WHERE booking_id = ${bookingId}
        ORDER BY id ASC
        FOR UPDATE;
      `);
        const existingRefunds = lockedRefundsRes.rows as Array<{
          id: string;
          payment_intent_id: string | null;
        }>;

        const lockedTokensRes = await tx.execute(sql`
        SELECT id
        FROM custody_tokens
        WHERE booking_id = ${bookingId}
          AND consumed_at IS NULL
          AND revoked_at IS NULL
        ORDER BY id ASC
        FOR UPDATE;
      `);
        const openTokenIds = (lockedTokensRes.rows as Array<{ id: string }>).map((r) => r.id);

        const now = new Date(bookingRow.db_now);
        await tx
          .update(schema.bookings)
          .set({
            status: targetStatus,
            cancelledAt: now,
            cancelledByUserId: actorUserId,
            cancellationReason: input.reason,
            holdExpiresAt: null,
            updatedAt: now
          })
          .where(eq(schema.bookings.id, bookingId));

        await tx
          .update(schema.capacityReservations)
          .set({
            status: "RELEASED",
            releasedAt: now,
            releaseReason: targetStatus,
            updatedAt: now
          })
          .where(
            and(
              eq(schema.capacityReservations.bookingId, bookingId),
              inArray(schema.capacityReservations.status, [
                "HELD_FOR_HOST_APPROVAL",
                "HELD_FOR_PAYMENT",
                "CONFIRMED"
              ])
            )
          );

        if (openTokenIds.length > 0) {
          await tx
            .update(schema.custodyTokens)
            .set({ revokedAt: now })
            .where(inArray(schema.custodyTokens.id, openTokenIds));
        }

        const openIntentIds = lockedIntents
          .filter((i) => i.status === "INITIATED" || i.status === "PENDING_GATEWAY")
          .map((i) => i.id);
        if (openIntentIds.length > 0) {
          await tx
            .update(schema.paymentIntents)
            .set({
              status: "EXPIRED",
              failureReason: `Superseded by booking cancellation (${targetStatus})`,
              updatedAt: now
            })
            .where(inArray(schema.paymentIntents.id, openIntentIds));
        }

        const paidIntent = lockedIntents.find((i) => i.status === "SUCCEEDED");
        let refundPercentage = 0;
        let refundAmountMinor = 0;
        let createdRefundId: string | null = null;

        if (paidIntent) {
          const alreadyRefundedForIntent = existingRefunds.find(
            (r) => r.payment_intent_id === paidIntent.id
          );
          if (!alreadyRefundedForIntent) {
            const [snap] = await tx
              .select()
              .from(schema.bookingPricingSnapshots)
              .where(eq(schema.bookingPricingSnapshots.bookingId, bookingId))
              .limit(1);

            refundPercentage = evaluateCancellationRefundPercentage({
              actorKind,
              dropOffAt: new Date(bookingRow.drop_off_at),
              now
            });

            const paidAmountMinor = Number(paidIntent.amount_minor);
            refundAmountMinor = Math.floor((paidAmountMinor * refundPercentage) / 100);
            const reasonCategory =
              actorKind === "TRAVELLER"
                ? "TRAVELLER_CANCELLATION"
                : actorKind === "HOST"
                ? "HOST_CANCELLATION"
                : "PLATFORM_CANCELLATION";

            const [refundRow] = await tx
              .insert(schema.refundRecords)
              .values({
                bookingId,
                paymentIntentId: paidIntent.id,
                amountMinor: refundAmountMinor,
                currency: paidIntent.currency,
                refundPercentage,
                reasonCategory,
                status: refundAmountMinor > 0 ? "AUTHORIZED" : "SUCCEEDED",
                requestedByUserId: actorUserId,
                authorizedByUserId: actorKind === "PLATFORM" ? actorUserId : null,
                notes: input.reason,
                completedAt: refundAmountMinor === 0 ? now : null,
                createdAt: now,
                updatedAt: now
              })
              .returning({ id: schema.refundRecords.id });

            createdRefundId = refundRow.id;

            await ledgerService.recordCancellationSettlement(tx, {
              bookingId,
              businessId: bookingRow.business_id,
              refundId: refundAmountMinor > 0 ? refundRow.id : null,
              paidAmountMinor,
              refundAmountMinor,
              commissionRateBps: snap?.commissionRateBps ?? 1500,
              currency: paidIntent.currency,
              referenceCode: bookingRow.reference_code
            });
          } else {
            createdRefundId = alreadyRefundedForIntent.id;
          }
        }

        await tx.insert(schema.bookingStatusHistory).values({
          bookingId,
          previousStatus: bookingRow.status,
          newStatus: targetStatus,
          actorUserId,
          actorRole: resolvedActorRole,
          reason: input.reason,
          metadata: {
            refundPercentage,
            refundAmountMinor,
            refundId: createdRefundId
          }
        });

        await auditService.recordEvent({
          eventType: SecurityEventType.BOOKING_CANCELLED,
          userId: actorUserId,
          clientInfo,
          metadata: {
            bookingId,
            referenceCode: bookingRow.reference_code,
            locationId: bookingRow.location_id,
            businessId: bookingRow.business_id,
            previousStatus: bookingRow.status,
            newStatus: targetStatus,
            refundId: createdRefundId,
            refundPercentage,
            amountMinor: refundAmountMinor,
            currency: bookingRow.currency
          },
          tx
        });
      })
    );

    return this.getBookingDetail(bookingId, actorUserId, actorRoles);
  }

  /**
   * Records an operational booking exception / incident, placing settlement on hold.
   */
  async recordBookingException(
    bookingId: string,
    actorUserId: string,
    actorRoles: string[],
    rawInput: RecordBookingExceptionRequest,
    clientInfo?: AuditClientInfo
  ): Promise<BookingDetail> {
    const input = RecordBookingExceptionRequestSchema.parse(rawInput);

    await db.transaction(async (tx) => {
      const lockedRes = await tx.execute(sql`
        SELECT id, traveller_user_id, business_id, location_id, status, reference_code
        FROM bookings
        WHERE id = ${bookingId}
        FOR UPDATE;
      `);
      const bookingRow = lockedRes.rows[0] as
        | {
            id: string;
            traveller_user_id: string;
            business_id: string;
            location_id: string;
            status: BookingStatus;
            reference_code: string;
          }
        | undefined;

      if (!bookingRow) {
        throw AppError.notFound("Booking not found");
      }

      let actorRoleLabel: string;
      if (actorRoles.includes("SUPERADMIN")) {
        actorRoleLabel = "SUPERADMIN";
      } else if (actorRoles.includes("SUPPORT")) {
        actorRoleLabel = "SUPPORT";
      } else if (bookingRow.traveller_user_id === actorUserId) {
        actorRoleLabel = "TRAVELLER";
      } else {
        const access = await assertHostLocationAccess(
          tx,
          actorUserId,
          actorRoles,
          bookingRow.location_id
        );
        actorRoleLabel = access.actorRole;
      }

      assertValidBookingTransition(bookingRow.status, "DISPUTED");

      const now = new Date();
      const formattedException = `[${input.category}] ${input.reason}`;

      await tx
        .update(schema.bookings)
        .set({
          status: "DISPUTED",
          exceptionReason: formattedException,
          updatedAt: now
        })
        .where(eq(schema.bookings.id, bookingId));

      await tx
        .update(schema.hostPayables)
        .set({
          status: "ON_HOLD",
          eligibleAt: null,
          updatedAt: now
        })
        .where(
          and(
            eq(schema.hostPayables.bookingId, bookingId),
            inArray(schema.hostPayables.status, ["ACCRUED", "ELIGIBLE"])
          )
        );

      await tx.insert(schema.bookingStatusHistory).values({
        bookingId,
        previousStatus: bookingRow.status,
        newStatus: "DISPUTED",
        actorUserId,
        actorRole: actorRoleLabel,
        reason: formattedException,
        metadata: { category: input.category }
      });

      await auditService.recordEvent({
        eventType: SecurityEventType.BOOKING_EXCEPTION_RECORDED,
        userId: actorUserId,
        clientInfo,
        metadata: {
          bookingId,
          referenceCode: bookingRow.reference_code,
          locationId: bookingRow.location_id,
          businessId: bookingRow.business_id,
          previousStatus: bookingRow.status,
          newStatus: "DISPUTED",
          reason: formattedException
        },
        tx
      });
    });

    return this.getBookingDetail(bookingId, actorUserId, actorRoles);
  }
}

export const bookingsService = new BookingsService();
