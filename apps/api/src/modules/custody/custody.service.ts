import crypto from "node:crypto";
import { eq, and, asc, desc, sql, inArray } from "drizzle-orm";
import {
  CustodyOperation,
  CustodyPassResponse,
  CustodyRecordDetail,
  IssueCustodyPassRequest,
  IssueCustodyPassRequestSchema,
  VerifyCustodyPassRequest,
  VerifyCustodyPassRequestSchema,
  CompleteCheckInRequest,
  CompleteCheckInRequestSchema,
  CompleteCollectionRequest,
  CompleteCollectionRequestSchema
} from "@luggage-storage/contracts";
import { db, schema } from "../../infrastructure/database/drizzle.js";
import {
  isRetryablePgError,
  withSerializableOrDeadlockRetry
} from "../../infrastructure/database/tx-retry.js";
import { AppError } from "../../common/errors/app-error.js";
import {
  CUSTODY_HASH_VERSION,
  computeCustodyCredentialHmac,
  verifyCustodyCredentialHmac
} from "../../common/crypto/custody-hmac.js";
import { auditService, SecurityEventType, AuditClientInfo } from "../audit/audit.service.js";
import { rateLimitService } from "../auth/rate-limit.service.js";
import { assertHostLocationAccess } from "../bookings/host-access.helper.js";
import { ledgerService } from "../finance/ledger.service.js";

const CUSTODY_PASS_TTL_MINUTES = 15;
const OVERDUE_GRACE_MINUTES = 30;

export class CustodyService {
  /**
   * Issues a short-lived CSPRNG QR token and 6-digit numeric fallback PIN bound to
   * (bookingId, operation). Stores ONLY keyed domain-separated HMAC-SHA256 digests (`hmac-sha256-v2`);
   * revokes unconsumed prior tokens inside the booking -> custody lock order.
   */
  async issueCustodyPass(
    bookingId: string,
    callerUserId: string,
    rawInput: IssueCustodyPassRequest,
    clientInfo?: AuditClientInfo
  ): Promise<CustodyPassResponse> {
    const input = IssueCustodyPassRequestSchema.parse(rawInput);

    return withSerializableOrDeadlockRetry(() =>
      db.transaction(async (tx) => {
        // Global Lock Order: 2. bookings -> 4. custody_records -> custody_tokens
        const bookingLockedRes = await tx.execute(sql`
          SELECT id, reference_code, traveller_user_id, status
          FROM bookings
          WHERE id = ${bookingId}
          FOR UPDATE;
        `);
        const bookingRow = bookingLockedRes.rows[0] as
          | {
              id: string;
              reference_code: string;
              traveller_user_id: string;
              status: string;
            }
          | undefined;

        if (!bookingRow) {
          throw AppError.notFound("Booking not found");
        }

        if (bookingRow.traveller_user_id !== callerUserId) {
          throw AppError.forbidden("Only the booking traveller can request a custody handover pass");
        }

        const custodyLockedRes = await tx.execute(sql`
          SELECT id, status
          FROM custody_records
          WHERE booking_id = ${bookingId}
          FOR UPDATE;
        `);
        const custody = custodyLockedRes.rows[0] as
          | {
              id: string;
              status: string;
            }
          | undefined;

        if (!custody) {
          throw AppError.conflict(
            "Custody pass is unavailable until booking payment is confirmed"
          );
        }

        if (input.operation === "CHECK_IN") {
          if (bookingRow.status !== "CONFIRMED" || custody.status !== "EXPECTED") {
            throw AppError.conflict(
              `Check-in pass can only be issued for a CONFIRMED booking awaiting drop-off (current status: ${bookingRow.status})`
            );
          }
        } else {
          const eligibleBooking =
            bookingRow.status === "IN_STORAGE" || bookingRow.status === "DISPUTED";
          const eligibleCustody =
            custody.status === "CHECKED_IN" ||
            custody.status === "IN_STORAGE" ||
            custody.status === "OVERDUE";

          if (!eligibleBooking || !eligibleCustody) {
            throw AppError.conflict(
              `Collection pass can only be issued while luggage is actively in storage (current custody status: ${custody.status})`
            );
          }
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + CUSTODY_PASS_TTL_MINUTES * 60_000);

        // Revoke any previous unconsumed passes for this (bookingId, operation)
        await tx
          .update(schema.custodyTokens)
          .set({ revokedAt: now })
          .where(
            and(
              eq(schema.custodyTokens.bookingId, bookingId),
              eq(schema.custodyTokens.operation, input.operation),
              sql`${schema.custodyTokens.consumedAt} IS NULL AND ${schema.custodyTokens.revokedAt} IS NULL`
            )
          );

        const qrToken = crypto.randomBytes(32).toString("hex");
        const verificationPin = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
        const tokenHash = computeCustodyCredentialHmac({
          purpose: "CUSTODY_QR",
          bookingId,
          operation: input.operation,
          credential: qrToken
        });
        const pinHash = computeCustodyCredentialHmac({
          purpose: "CUSTODY_PIN",
          bookingId,
          operation: input.operation,
          credential: verificationPin
        });

        const [insertedToken] = await tx
          .insert(schema.custodyTokens)
          .values({
            custodyRecordId: custody.id,
            bookingId,
            operation: input.operation,
            hashVersion: CUSTODY_HASH_VERSION,
            tokenHash,
            pinHash,
            expiresAt
          })
          .returning({ id: schema.custodyTokens.id });

        await tx
          .update(schema.custodyRecords)
          .set({
            ...(input.operation === "CHECK_IN"
              ? { checkinPinHash: pinHash }
              : { collectionPinHash: pinHash }),
            updatedAt: now
          })
          .where(eq(schema.custodyRecords.id, custody.id));

        await auditService.recordEvent({
          eventType: SecurityEventType.CUSTODY_PASS_ISSUED,
          userId: callerUserId,
          clientInfo,
          metadata: {
            bookingId,
            referenceCode: bookingRow.reference_code,
            custodyRecordId: custody.id,
            custodyTokenId: insertedToken.id,
            operation: input.operation,
            expiresAt: expiresAt.toISOString()
          },
          tx
        });

        return {
          bookingId,
          referenceCode: bookingRow.reference_code,
          operation: input.operation,
          qrToken,
          verificationPin,
          expiresAt: expiresAt.toISOString()
        };
      })
    );
  }

  /**
   * Constant-time keyed HMAC-SHA256 verifier for QR token or 6-digit PIN
   * strictly bound to (purpose, bookingId, operation) and hash_version = 'hmac-sha256-v2'.
   */
  private async verifyCredentialInternal(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    params: {
      bookingId: string;
      operation: CustodyOperation;
      qrToken?: string;
      verificationPin?: string;
      actorUserId: string;
      consume: boolean;
    }
  ): Promise<string> {
    const activeTokens = await tx
      .select()
      .from(schema.custodyTokens)
      .where(
        and(
          eq(schema.custodyTokens.bookingId, params.bookingId),
          eq(schema.custodyTokens.operation, params.operation),
          eq(schema.custodyTokens.hashVersion, CUSTODY_HASH_VERSION),
          sql`${schema.custodyTokens.consumedAt} IS NULL`,
          sql`${schema.custodyTokens.revokedAt} IS NULL`,
          sql`${schema.custodyTokens.expiresAt} > NOW()`
        )
      )
      .orderBy(desc(schema.custodyTokens.createdAt), asc(schema.custodyTokens.id));

    if (activeTokens.length === 0) {
      throw AppError.unauthorized(
        "No valid active custody pass found for this booking and operation (expired, consumed, or wrong operation)"
      );
    }

    let matchedTokenId: string | null = null;
    for (const candidate of activeTokens) {
      if (params.qrToken !== undefined) {
        if (
          verifyCustodyCredentialHmac({
            purpose: "CUSTODY_QR",
            bookingId: params.bookingId,
            operation: params.operation,
            candidateCredential: params.qrToken,
            storedDigestHex: candidate.tokenHash
          })
        ) {
          matchedTokenId = candidate.id;
          break;
        }
      } else if (params.verificationPin !== undefined) {
        if (
          verifyCustodyCredentialHmac({
            purpose: "CUSTODY_PIN",
            bookingId: params.bookingId,
            operation: params.operation,
            candidateCredential: params.verificationPin,
            storedDigestHex: candidate.pinHash
          })
        ) {
          matchedTokenId = candidate.id;
          break;
        }
      }
    }

    if (!matchedTokenId) {
      throw AppError.unauthorized("Invalid custody QR token or verification PIN");
    }

    if (params.consume) {
      const consumeRes = await tx.execute(sql`
        UPDATE custody_tokens
        SET consumed_at = NOW(),
            consumed_by_user_id = ${params.actorUserId}
        WHERE id = ${matchedTokenId}
          AND hash_version = ${CUSTODY_HASH_VERSION}
          AND consumed_at IS NULL
          AND revoked_at IS NULL
          AND expires_at > NOW()
        RETURNING id;
      `);

      if (consumeRes.rows.length === 0) {
        throw AppError.conflict("Custody pass was already consumed by a concurrent operation");
      }
    }

    return matchedTokenId;
  }

  private async enforceVerificationRateLimits(
    actorUserId: string,
    bookingId: string,
    clientInfo?: AuditClientInfo
  ): Promise<void> {
    const ci = {
      ip: clientInfo?.ip ?? undefined,
      userAgent: clientInfo?.userAgent ?? undefined,
      correlationId: clientInfo?.correlationId ?? undefined
    };
    await rateLimitService.enforce({
      scope: "custody_verify_actor",
      identifier: actorUserId,
      message: "Too many custody verification attempts. Please wait before trying again.",
      clientInfo: ci
    });
    await rateLimitService.enforce({
      scope: "custody_verify_booking",
      identifier: bookingId,
      message: "Too many verification attempts for this booking. Ask traveller to refresh pass.",
      clientInfo: ci
    });
  }

  /**
   * Counter pre-verification of a traveller's QR token or 6-digit PIN without consuming it yet.
   */
  async verifyCustodyPassForHost(
    actorUserId: string,
    actorRoles: string[],
    rawInput: VerifyCustodyPassRequest,
    clientInfo?: AuditClientInfo
  ): Promise<{
    verified: boolean;
    bookingId: string;
    referenceCode: string;
    operation: CustodyOperation;
    expectedBagCount: number;
    checkedInBagCount: number | null;
    custodyStatus: string;
  }> {
    const input = VerifyCustodyPassRequestSchema.parse(rawInput);
    await this.enforceVerificationRateLimits(actorUserId, input.bookingId, clientInfo);

    const [bookingRow] = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, input.bookingId))
      .limit(1);

    if (!bookingRow) {
      throw AppError.notFound("Booking not found");
    }

    await assertHostLocationAccess(db, actorUserId, actorRoles, bookingRow.locationId);

    const [custody] = await db
      .select()
      .from(schema.custodyRecords)
      .where(eq(schema.custodyRecords.bookingId, input.bookingId))
      .limit(1);

    if (!custody) {
      throw AppError.conflict("Booking does not have an active custody record");
    }

    try {
      await this.verifyCredentialInternal(db, {
        bookingId: input.bookingId,
        operation: input.operation,
        qrToken: input.qrToken,
        verificationPin: input.verificationPin,
        actorUserId,
        consume: false
      });
    } catch (err) {
      await auditService.recordEvent({
        eventType: SecurityEventType.CUSTODY_VERIFICATION_FAILED,
        userId: actorUserId,
        clientInfo,
        metadata: {
          bookingId: input.bookingId,
          referenceCode: bookingRow.referenceCode,
          locationId: bookingRow.locationId,
          operation: input.operation,
          reason: err instanceof Error ? err.message : "Invalid custody credential"
        }
      });
      throw err;
    }

    return {
      verified: true,
      bookingId: bookingRow.id,
      referenceCode: bookingRow.referenceCode,
      operation: input.operation,
      expectedBagCount: custody.expectedBagCount,
      checkedInBagCount: custody.checkedInBagCount,
      custodyStatus: custody.status
    };
  }

  /**
   * Executes physical luggage check-in, consumes CHECK_IN token/PIN, records bag tags/seals/zones,
   * and transitions booking + custody to IN_STORAGE.
   */
  async completeCheckIn(
    bookingId: string,
    actorUserId: string,
    actorRoles: string[],
    rawInput: CompleteCheckInRequest,
    clientInfo?: AuditClientInfo
  ): Promise<CustodyRecordDetail> {
    const input = CompleteCheckInRequestSchema.parse(rawInput);
    await this.enforceVerificationRateLimits(actorUserId, bookingId, clientInfo);

    await withSerializableOrDeadlockRetry(() =>
      db.transaction(async (tx) => {
        const bookingRes = await tx.execute(sql`
        SELECT id, location_id, business_id, status, total_bags, reference_code
        FROM bookings
        WHERE id = ${bookingId}
        FOR UPDATE;
      `);
      const bookingRow = bookingRes.rows[0] as
        | {
            id: string;
            location_id: string;
            business_id: string;
            status: string;
            total_bags: number;
            reference_code: string;
          }
        | undefined;

      if (!bookingRow) {
        throw AppError.notFound("Booking not found");
      }

      const access = await assertHostLocationAccess(
        tx,
        actorUserId,
        actorRoles,
        bookingRow.location_id
      );

      if (bookingRow.status !== "CONFIRMED") {
        throw AppError.conflict(
          `Cannot check in luggage for booking in status ${bookingRow.status}`
        );
      }

      const custodyRes = await tx.execute(sql`
        SELECT *
        FROM custody_records
        WHERE booking_id = ${bookingId}
        FOR UPDATE;
      `);
      const custodyRow = custodyRes.rows[0] as
        | {
            id: string;
            status: string;
            expected_bag_count: number;
          }
        | undefined;

      if (!custodyRow || custodyRow.status !== "EXPECTED") {
        throw AppError.conflict("Custody record is not in EXPECTED check-in state");
      }

      // OQ-014 Bag Count Reconciliation Rule
      if (
        input.bags.length !== Number(custodyRow.expected_bag_count) &&
        !input.bagCountExceptionReason
      ) {
        throw AppError.badRequest(
          `Bag count mismatch: expected ${custodyRow.expected_bag_count} bag(s), received ${input.bags.length}. Provide bagCountExceptionReason to log an exception.`
        );
      }

      // Verify zone ownership if zoneId is specified
      const zoneIdsToCheck = new Set<string>();
      if (input.zoneId) zoneIdsToCheck.add(input.zoneId);
      for (const bag of input.bags) {
        if (bag.zoneId) zoneIdsToCheck.add(bag.zoneId);
      }
      if (zoneIdsToCheck.size > 0) {
        const zones = await tx
          .select({ id: schema.storageZones.id })
          .from(schema.storageZones)
          .where(
            and(
              eq(schema.storageZones.locationId, bookingRow.location_id),
              inArray(schema.storageZones.id, Array.from(zoneIdsToCheck))
            )
          );
        if (zones.length !== zoneIdsToCheck.size) {
          throw AppError.badRequest("Selected storage zone does not belong to this location");
        }
      }

      // Verify & consume single-use CHECK_IN pass
      let consumedTokenId: string;
      try {
        consumedTokenId = await this.verifyCredentialInternal(tx, {
          bookingId,
          operation: "CHECK_IN",
          qrToken: input.qrToken,
          verificationPin: input.verificationPin,
          actorUserId,
          consume: true
        });
      } catch (err) {
        if (isRetryablePgError(err)) {
          throw err;
        }
        await auditService.recordEvent({
          eventType: SecurityEventType.CUSTODY_VERIFICATION_FAILED,
          userId: actorUserId,
          clientInfo,
          metadata: {
            bookingId,
            referenceCode: bookingRow.reference_code,
            locationId: bookingRow.location_id,
            operation: "CHECK_IN",
            reason: err instanceof Error ? err.message : "Check-in credential verification failed"
          }
        });
        throw err;
      }

      const now = new Date();
      const handoverCondition = input.bagCountExceptionReason ? "EXCEPTION_RECORDED" : "NORMAL";

      await tx.insert(schema.bagCustodyItems).values(
        input.bags.map((bag) => ({
          custodyRecordId: custodyRow.id,
          bagTagCode: bag.bagTagCode,
          bagCategory: bag.bagCategory,
          securitySealNumber: bag.securitySealNumber ?? null,
          zoneId: bag.zoneId ?? input.zoneId ?? null,
          photoFileKey: bag.photoFileKey ?? null,
          conditionNotes: bag.conditionNotes ?? null,
          checkedInAt: now
        }))
      );

      await tx
        .update(schema.custodyRecords)
        .set({
          status: "IN_STORAGE",
          checkedInBagCount: input.bags.length,
          zoneId: input.zoneId ?? null,
          checkInAt: now,
          checkInStaffUserId: actorUserId,
          handoverCondition,
          exceptionNotes: input.bagCountExceptionReason ?? null,
          updatedAt: now
        })
        .where(eq(schema.custodyRecords.id, custodyRow.id));

      await tx
        .update(schema.bookings)
        .set({
          status: "IN_STORAGE",
          checkedInAt: now,
          updatedAt: now
        })
        .where(eq(schema.bookings.id, bookingId));

      await tx.insert(schema.custodyEvents).values({
        custodyRecordId: custodyRow.id,
        bookingId,
        eventType: "BAGS_CHECKED_IN_AND_TAGGED",
        previousStatus: "EXPECTED",
        newStatus: "IN_STORAGE",
        actorUserId,
        actorRole: access.actorRole,
        metadata: {
          checkedInBagCount: input.bags.length,
          bagTags: input.bags.map((b) => b.bagTagCode),
          handoverCondition
        }
      });

      await tx.insert(schema.bookingStatusHistory).values({
        bookingId,
        previousStatus: "CONFIRMED",
        newStatus: "IN_STORAGE",
        actorUserId,
        actorRole: access.actorRole,
        reason: "Traveller luggage verified, tagged, and checked into storage",
        metadata: { checkedInBagCount: input.bags.length }
      });

      await auditService.recordEvent({
        eventType: SecurityEventType.CUSTODY_CHECKED_IN,
        userId: actorUserId,
        clientInfo,
        metadata: {
          bookingId,
          referenceCode: bookingRow.reference_code,
          locationId: bookingRow.location_id,
          businessId: bookingRow.business_id,
          custodyRecordId: custodyRow.id,
          custodyTokenId: consumedTokenId,
          handoverCondition
        },
        tx
      });
      })
    );

    return this.getCustodyDetail(bookingId, actorUserId, actorRoles);
  }

  /**
   * Executes physical luggage collection release, enforces OQ-015 Zero Possessory Lien
   * (never blocking overdue return upon valid COLLECTION credential), releases capacity,
   * and accrues host payable + balanced ledger settlement.
   */
  async completeCollection(
    bookingId: string,
    actorUserId: string,
    actorRoles: string[],
    rawInput: CompleteCollectionRequest,
    clientInfo?: AuditClientInfo
  ): Promise<CustodyRecordDetail> {
    const input = CompleteCollectionRequestSchema.parse(rawInput);
    await this.enforceVerificationRateLimits(actorUserId, bookingId, clientInfo);

    await withSerializableOrDeadlockRetry(() =>
      db.transaction(async (tx) => {
        const bookingRes = await tx.execute(sql`
        SELECT id, location_id, business_id, status, collection_at, currency, reference_code
        FROM bookings
        WHERE id = ${bookingId}
        FOR UPDATE;
      `);
      const bookingRow = bookingRes.rows[0] as
        | {
            id: string;
            location_id: string;
            business_id: string;
            status: string;
            collection_at: Date | string;
            currency: string;
            reference_code: string;
          }
        | undefined;

      if (!bookingRow) {
        throw AppError.notFound("Booking not found");
      }

      const access = await assertHostLocationAccess(
        tx,
        actorUserId,
        actorRoles,
        bookingRow.location_id
      );

      const custodyRes = await tx.execute(sql`
        SELECT *
        FROM custody_records
        WHERE booking_id = ${bookingId}
        FOR UPDATE;
      `);
      const custodyRow = custodyRes.rows[0] as
        | {
            id: string;
            status: string;
            checked_in_bag_count: number | null;
            expected_bag_count: number;
            handover_condition: string;
            exception_notes: string | null;
          }
        | undefined;

      if (!custodyRow) {
        throw AppError.notFound("Custody record not found");
      }

      if (
        custodyRow.status === "RELEASED_TO_TRAVELLER" ||
        custodyRow.status === "DISPUTED_RELEASE" ||
        bookingRow.status === "COMPLETED"
      ) {
        throw AppError.conflict("Luggage has already been collected and released");
      }

      if (bookingRow.status !== "IN_STORAGE" && bookingRow.status !== "DISPUTED") {
        throw AppError.conflict(
          `Cannot release luggage for booking in status ${bookingRow.status}`
        );
      }

      const expectedReleaseCount = Number(
        custodyRow.checked_in_bag_count ?? custodyRow.expected_bag_count
      );
      if (input.releasedBagCount !== expectedReleaseCount && !input.exceptionNotes) {
        throw AppError.badRequest(
          `Released bag count (${input.releasedBagCount}) does not match checked-in count (${expectedReleaseCount}). Provide exceptionNotes to record a disputed handover.`
        );
      }

      // Verify & consume single-use COLLECTION pass
      let consumedTokenId: string;
      try {
        consumedTokenId = await this.verifyCredentialInternal(tx, {
          bookingId,
          operation: "COLLECTION",
          qrToken: input.qrToken,
          verificationPin: input.verificationPin,
          actorUserId,
          consume: true
        });
      } catch (err) {
        if (isRetryablePgError(err)) {
          throw err;
        }
        await auditService.recordEvent({
          eventType: SecurityEventType.CUSTODY_VERIFICATION_FAILED,
          userId: actorUserId,
          clientInfo,
          metadata: {
            bookingId,
            referenceCode: bookingRow.reference_code,
            locationId: bookingRow.location_id,
            operation: "COLLECTION",
            reason: err instanceof Error ? err.message : "Collection credential verification failed"
          }
        });
        throw err;
      }

      const now = new Date();
      const [snap] = await tx
        .select()
        .from(schema.bookingPricingSnapshots)
        .where(eq(schema.bookingPricingSnapshots.bookingId, bookingId))
        .limit(1);

      // OQ-015 Overdue Assessment & Zero Possessory Lien:
      // Assess overdue minutes/fees beyond 30-minute grace period, but ALWAYS release physical luggage!
      const scheduledCollectionMs = new Date(bookingRow.collection_at).getTime();
      const graceDeadlineMs = scheduledCollectionMs + OVERDUE_GRACE_MINUTES * 60_000;
      let overdueMinutes = 0;
      let overdueFeeMinor = 0;

      if (now.getTime() > graceDeadlineMs) {
        overdueMinutes = Math.ceil((now.getTime() - scheduledCollectionMs) / 60_000);
        const overdueDays = Math.max(1, Math.ceil(overdueMinutes / 1440));
        const dailyRate = snap
          ? Math.max(1, Math.floor(snap.storageSubtotalMinor / snap.durationUnits))
          : 100000;
        overdueFeeMinor = dailyRate * overdueDays;
      }

      const hasDisputeException =
        Boolean(input.exceptionNotes) || bookingRow.status === "DISPUTED";
      const nextCustodyStatus = hasDisputeException
        ? "DISPUTED_RELEASE"
        : "RELEASED_TO_TRAVELLER";
      const nextBookingStatus = hasDisputeException ? "DISPUTED" : "COMPLETED";
      const handoverCondition = hasDisputeException
        ? "EXCEPTION_RECORDED"
        : overdueMinutes > 0
        ? "UNPAID_FEES_PENDING"
        : (custodyRow.handover_condition as "NORMAL" | "EXCEPTION_RECORDED");

      await tx
        .update(schema.bagCustodyItems)
        .set({ releasedAt: now })
        .where(eq(schema.bagCustodyItems.custodyRecordId, custodyRow.id));

      await tx
        .update(schema.custodyRecords)
        .set({
          status: nextCustodyStatus,
          releasedBagCount: input.releasedBagCount,
          checkOutAt: now,
          checkOutStaffUserId: actorUserId,
          handoverCondition,
          overdueMinutes,
          overdueFeeMinor,
          exceptionNotes: input.exceptionNotes ?? custodyRow.exception_notes,
          updatedAt: now
        })
        .where(eq(schema.custodyRecords.id, custodyRow.id));

      await tx
        .update(schema.bookings)
        .set({
          status: nextBookingStatus,
          completedAt: now,
          ...(input.exceptionNotes ? { exceptionReason: input.exceptionNotes } : {}),
          updatedAt: now
        })
        .where(eq(schema.bookings.id, bookingId));

      await tx
        .update(schema.capacityReservations)
        .set({
          status: "RELEASED",
          releasedAt: now,
          releaseReason: "COLLECTION_COMPLETED",
          updatedAt: now
        })
        .where(
          and(
            eq(schema.capacityReservations.bookingId, bookingId),
            eq(schema.capacityReservations.status, "CONFIRMED")
          )
        );

      let payableId: string | null = null;
      let txGroupId: string | null = null;
      if (snap && snap.storageSubtotalMinor > 0) {
        const settled = await ledgerService.recordBookingCompletedSettlement(tx, {
          bookingId,
          businessId: bookingRow.business_id,
          storageSubtotalMinor: snap.storageSubtotalMinor,
          commissionMinor: snap.platformCommissionMinor,
          hostPayableMinor: snap.hostPayableMinor,
          currency: snap.currency,
          referenceCode: bookingRow.reference_code,
          holdPayable: hasDisputeException
        });
        payableId = settled.payableId;
        txGroupId = settled.transactionGroupId;
      }

      await tx.insert(schema.custodyEvents).values({
        custodyRecordId: custodyRow.id,
        bookingId,
        eventType: "BAGS_RELEASED_TO_TRAVELLER",
        previousStatus: custodyRow.status,
        newStatus: nextCustodyStatus,
        actorUserId,
        actorRole: access.actorRole,
        metadata: {
          releasedBagCount: input.releasedBagCount,
          overdueMinutes,
          overdueFeeMinor,
          handoverCondition,
          zeroPossessoryLienEnforced: overdueMinutes > 0
        }
      });

      await tx.insert(schema.bookingStatusHistory).values({
        bookingId,
        previousStatus: bookingRow.status,
        newStatus: nextBookingStatus,
        actorUserId,
        actorRole: access.actorRole,
        reason:
          overdueMinutes > 0
            ? `Luggage released to traveller (overdue ${overdueMinutes}m recorded without possessory lien)`
            : "Luggage released to traveller upon verified collection pass",
        metadata: {
          releasedBagCount: input.releasedBagCount,
          overdueMinutes,
          overdueFeeMinor
        }
      });

      await auditService.recordEvent({
        eventType: SecurityEventType.CUSTODY_RELEASED,
        userId: actorUserId,
        clientInfo,
        metadata: {
          bookingId,
          referenceCode: bookingRow.reference_code,
          locationId: bookingRow.location_id,
          businessId: bookingRow.business_id,
          custodyRecordId: custodyRow.id,
          custodyTokenId: consumedTokenId,
          payableId,
          transactionGroupId: txGroupId,
          handoverCondition
        },
        tx
      });

      if (payableId) {
        await auditService.recordEvent({
          eventType: SecurityEventType.HOST_PAYABLE_ACCRUED,
          userId: actorUserId,
          clientInfo,
          metadata: {
            bookingId,
            referenceCode: bookingRow.reference_code,
            businessId: bookingRow.business_id,
            payableId,
            transactionGroupId: txGroupId,
            amountMinor: snap?.hostPayableMinor ?? 0,
            currency: bookingRow.currency
          },
          tx
        });
      }
      })
    );

    return this.getCustodyDetail(bookingId, actorUserId, actorRoles);
  }

  /**
   * Retrieves complete custody record, bag tags, and immutable chain-of-custody event history.
   */
  async getCustodyDetail(
    bookingId: string,
    callerUserId: string,
    callerRoles: string[]
  ): Promise<CustodyRecordDetail> {
    const [row] = await db
      .select({
        custody: schema.custodyRecords,
        travellerUserId: schema.bookings.travellerUserId,
        referenceCode: schema.bookings.referenceCode
      })
      .from(schema.custodyRecords)
      .innerJoin(schema.bookings, eq(schema.custodyRecords.bookingId, schema.bookings.id))
      .where(eq(schema.custodyRecords.bookingId, bookingId))
      .limit(1);

    if (!row) {
      throw AppError.notFound("Custody record not found for this booking");
    }

    const isAdminOrSupport =
      callerRoles.includes("SUPERADMIN") || callerRoles.includes("SUPPORT");
    const isTravellerOwner = row.travellerUserId === callerUserId;

    if (!isAdminOrSupport && !isTravellerOwner) {
      await assertHostLocationAccess(db, callerUserId, callerRoles, row.custody.locationId);
    }

    const [bags, events] = await Promise.all([
      db
        .select()
        .from(schema.bagCustodyItems)
        .where(eq(schema.bagCustodyItems.custodyRecordId, row.custody.id)),
      db
        .select()
        .from(schema.custodyEvents)
        .where(eq(schema.custodyEvents.custodyRecordId, row.custody.id))
        .orderBy(schema.custodyEvents.createdAt)
    ]);

    return {
      id: row.custody.id,
      bookingId: row.custody.bookingId,
      referenceCode: row.referenceCode,
      locationId: row.custody.locationId,
      businessId: row.custody.businessId,
      status: row.custody.status as CustodyRecordDetail["status"],
      expectedBagCount: row.custody.expectedBagCount,
      checkedInBagCount: row.custody.checkedInBagCount,
      releasedBagCount: row.custody.releasedBagCount,
      zoneId: row.custody.zoneId,
      checkInAt: row.custody.checkInAt ? row.custody.checkInAt.toISOString() : null,
      checkInStaffUserId: row.custody.checkInStaffUserId,
      checkOutAt: row.custody.checkOutAt ? row.custody.checkOutAt.toISOString() : null,
      checkOutStaffUserId: row.custody.checkOutStaffUserId,
      handoverCondition: row.custody.handoverCondition as CustodyRecordDetail["handoverCondition"],
      overdueMinutes: row.custody.overdueMinutes,
      overdueFeeMinor: row.custody.overdueFeeMinor,
      exceptionNotes: row.custody.exceptionNotes,
      createdAt: row.custody.createdAt.toISOString(),
      updatedAt: row.custody.updatedAt.toISOString(),
      bags: bags.map((b) => ({
        id: b.id,
        custodyRecordId: b.custodyRecordId,
        bagTagCode: b.bagTagCode,
        bagCategory: b.bagCategory as CustodyRecordDetail["bags"][number]["bagCategory"],
        securitySealNumber: b.securitySealNumber,
        zoneId: b.zoneId,
        photoFileKey: b.photoFileKey,
        conditionNotes: b.conditionNotes,
        checkedInAt: b.checkedInAt.toISOString(),
        releasedAt: b.releasedAt ? b.releasedAt.toISOString() : null
      })),
      events: events.map((e) => ({
        id: e.id,
        custodyRecordId: e.custodyRecordId,
        bookingId: e.bookingId,
        eventType: e.eventType,
        previousStatus: e.previousStatus,
        newStatus: e.newStatus,
        actorUserId: e.actorUserId,
        actorRole: e.actorRole,
        metadata: (e.metadata as Record<string, unknown>) ?? {},
        createdAt: e.createdAt.toISOString()
      }))
    };
  }
}

export const custodyService = new CustodyService();

