import crypto from "node:crypto";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  CreatePaymentIntentRequest,
  CreatePaymentIntentRequestSchema,
  PaymentIntent,
  SandboxSimulatePaymentRequest,
  SandboxSimulatePaymentRequestSchema,
  SandboxWebhookPayload,
  RefundRecord,
  RefundStatus,
  AdminTransitionRefundRequest,
  AdminTransitionRefundRequestSchema,
  AdminRefundListQuery,
  AdminRefundListQuerySchema,
  PaymentTransactionRecord
} from "@luggage-storage/contracts";
import { db, schema } from "../../infrastructure/database/drizzle.js";
import { env } from "../../config/env.js";
import { AppError } from "../../common/errors/app-error.js";
import { auditService, SecurityEventType, AuditClientInfo } from "../audit/audit.service.js";
import { rateLimitService } from "../auth/rate-limit.service.js";
import { quotationService } from "../bookings/quotation-availability.service.js";
import { ledgerService } from "../finance/ledger.service.js";
import {
  resolvePaymentGatewayAdapter,
  SandboxSignedGatewayAdapter
} from "./payment-gateway.port.js";

const VALID_REFUND_TRANSITIONS: Record<RefundStatus, RefundStatus[]> = {
  REQUESTED: ["AUTHORIZED", "MANUAL_REVIEW_REQUIRED"],
  AUTHORIZED: ["INITIATED", "SUCCEEDED", "FAILED", "MANUAL_REVIEW_REQUIRED"],
  INITIATED: ["PROCESSING", "SUCCEEDED", "FAILED", "MANUAL_REVIEW_REQUIRED"],
  PROCESSING: ["SUCCEEDED", "FAILED", "MANUAL_REVIEW_REQUIRED"],
  MANUAL_REVIEW_REQUIRED: ["AUTHORIZED", "INITIATED", "SUCCEEDED", "FAILED"],
  SUCCEEDED: [],
  FAILED: ["MANUAL_REVIEW_REQUIRED", "AUTHORIZED"]
};

function serializeIntent(row: typeof schema.paymentIntents.$inferSelect): PaymentIntent {
  return {
    id: row.id,
    bookingId: row.bookingId,
    travellerUserId: row.travellerUserId,
    provider: row.provider as PaymentIntent["provider"],
    providerOrderId: row.providerOrderId,
    amountMinor: row.amountMinor,
    currency: row.currency,
    status: row.status as PaymentIntent["status"],
    checkoutPayload: (row.checkoutPayload as Record<string, unknown>) ?? {},
    expiresAt: row.expiresAt.toISOString(),
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
    failureReason: row.failureReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export class PaymentsService {
  /**
   * Creates or returns an idempotent payment intent for a booking in PENDING_PAYMENT state.
   */
  async createPaymentIntent(
    travellerUserId: string,
    rawInput: CreatePaymentIntentRequest,
    clientInfo?: AuditClientInfo
  ): Promise<PaymentIntent> {
    const input = CreatePaymentIntentRequestSchema.parse(rawInput);
    await quotationService.sweepExpiredHolds();

    if (input.idempotencyKey) {
      const [existing] = await db
        .select()
        .from(schema.paymentIntents)
        .where(
          and(
            eq(schema.paymentIntents.bookingId, input.bookingId),
            eq(schema.paymentIntents.idempotencyKey, input.idempotencyKey)
          )
        )
        .limit(1);

      if (existing) {
        if (existing.travellerUserId !== travellerUserId) {
          throw AppError.forbidden("You do not own this payment intent");
        }
        return serializeIntent(existing);
      }
    }

    const gateway = resolvePaymentGatewayAdapter();

    const created = await db.transaction(async (tx) => {
      const [bookingRow] = await tx
        .select({
          booking: schema.bookings,
          email: schema.users.email,
          displayName: schema.users.displayName
        })
        .from(schema.bookings)
        .innerJoin(schema.users, eq(schema.bookings.travellerUserId, schema.users.id))
        .where(eq(schema.bookings.id, input.bookingId))
        .limit(1);

      if (!bookingRow) {
        throw AppError.notFound("Booking not found");
      }
      if (bookingRow.booking.travellerUserId !== travellerUserId) {
        throw AppError.forbidden("You can only pay for your own booking");
      }

      if (
        bookingRow.booking.holdExpiresAt &&
        bookingRow.booking.holdExpiresAt.getTime() <= Date.now()
      ) {
        await quotationService.sweepExpiredHolds(tx);
        throw AppError.conflict("Booking payment hold has expired");
      }

      if (bookingRow.booking.status !== "PENDING_PAYMENT") {
        throw AppError.conflict(
          `Booking is in status ${bookingRow.booking.status} and cannot accept payment`
        );
      }

      // Reuse an existing active PENDING_GATEWAY intent if no explicit new idempotencyKey was supplied
      if (!input.idempotencyKey) {
        const [activeExisting] = await tx
          .select()
          .from(schema.paymentIntents)
          .where(
            and(
              eq(schema.paymentIntents.bookingId, input.bookingId),
              eq(schema.paymentIntents.status, "PENDING_GATEWAY")
            )
          )
          .orderBy(desc(schema.paymentIntents.createdAt))
          .limit(1);

        if (activeExisting && activeExisting.expiresAt.getTime() > Date.now()) {
          return activeExisting;
        }
      }

      const intentId = crypto.randomUUID();
      const providerOrderId = `ORD-${bookingRow.booking.referenceCode}-${crypto
        .randomBytes(3)
        .toString("hex")
        .toUpperCase()}`;
      const expiresAt =
        bookingRow.booking.holdExpiresAt ?? new Date(Date.now() + 10 * 60_000);

      const checkoutPayload = gateway.buildCheckoutPayload({
        intentId,
        bookingId: bookingRow.booking.id,
        referenceCode: bookingRow.booking.referenceCode,
        providerOrderId,
        amountMinor: bookingRow.booking.totalAmountMinor,
        currency: bookingRow.booking.currency,
        customerEmail: bookingRow.email,
        customerName: bookingRow.displayName
      });

      const [inserted] = await tx
        .insert(schema.paymentIntents)
        .values({
          id: intentId,
          bookingId: bookingRow.booking.id,
          travellerUserId,
          provider: gateway.providerName,
          idempotencyKey: input.idempotencyKey ?? null,
          providerOrderId,
          amountMinor: bookingRow.booking.totalAmountMinor,
          currency: bookingRow.booking.currency,
          status: "PENDING_GATEWAY",
          checkoutPayload,
          expiresAt
        })
        .returning();

      await auditService.recordEvent({
        eventType: SecurityEventType.PAYMENT_INTENT_CREATED,
        userId: travellerUserId,
        clientInfo,
        metadata: {
          bookingId: bookingRow.booking.id,
          referenceCode: bookingRow.booking.referenceCode,
          paymentIntentId: inserted.id,
          providerOrderId,
          amountMinor: inserted.amountMinor,
          currency: inserted.currency
        },
        tx
      });

      return inserted;
    });

    return serializeIntent(created);
  }

  /**
   * Verifies HMAC-SHA256 webhook authenticity, deduplicates event replays, confirms booking
   * (or safely handles late webhooks on expired/cancelled bookings), initializes custody,
   * and posts balanced double-entry ledger entries.
   */
  async processSandboxWebhook(
    rawPayload: string,
    signatureHeader: string | undefined,
    clientInfo?: AuditClientInfo
  ): Promise<{
    duplicate: boolean;
    outcome: string;
    bookingId?: string;
    bookingStatus?: string;
  }> {
    await rateLimitService.enforce({
      scope: "payment_webhook_ip",
      identifier: clientInfo?.ip || "unknown_ip",
      clientInfo: {
        ip: clientInfo?.ip ?? undefined,
        userAgent: clientInfo?.userAgent ?? undefined,
        correlationId: clientInfo?.correlationId ?? undefined
      }
    });

    const sandboxGateway = new SandboxSignedGatewayAdapter(env.PAYMENT_WEBHOOK_SECRET);

    let payload: SandboxWebhookPayload;
    try {
      payload = sandboxGateway.verifyAndParseWebhook(rawPayload, signatureHeader);
    } catch (err) {
      await auditService.recordEvent({
        eventType: SecurityEventType.PAYMENT_WEBHOOK_REJECTED,
        userId: null,
        clientInfo,
        metadata: {
          reason: err instanceof Error ? err.message : "Webhook verification failed"
        }
      });
      throw err;
    }

    const payloadHash = crypto.createHash("sha256").update(rawPayload, "utf8").digest("hex");

    return db.transaction(async (tx) => {
      // 1. Idempotent event deduplication check
      const [existingEvent] = await tx
        .select()
        .from(schema.paymentWebhookEvents)
        .where(
          and(
            eq(schema.paymentWebhookEvents.provider, "SANDBOX_GATEWAY"),
            eq(schema.paymentWebhookEvents.eventId, payload.eventId)
          )
        )
        .limit(1);

      if (existingEvent) {
        return {
          duplicate: true,
          outcome: existingEvent.processingOutcome
        };
      }

      // 2. Lock payment intent FOR UPDATE
      const intentRes = await tx.execute(sql`
        SELECT *
        FROM payment_intents
        WHERE provider_order_id = ${payload.providerOrderId}
        FOR UPDATE;
      `);
      const intentRow = intentRes.rows[0] as
        | {
            id: string;
            booking_id: string;
            traveller_user_id: string;
            amount_minor: number;
            currency: string;
            status: string;
          }
        | undefined;

      if (!intentRow) {
        throw AppError.notFound("Payment intent for providerOrderId not found");
      }

      if (
        Number(intentRow.amount_minor) !== payload.amountMinor ||
        intentRow.currency !== payload.currency
      ) {
        await auditService.recordEvent({
          eventType: SecurityEventType.PAYMENT_WEBHOOK_REJECTED,
          userId: intentRow.traveller_user_id,
          clientInfo,
          metadata: {
            bookingId: intentRow.booking_id,
            paymentIntentId: intentRow.id,
            reason: "Webhook amount or currency mismatch"
          },
          tx
        });
        throw AppError.badRequest("Webhook amount or currency does not match payment intent");
      }

      // If intent already settled from an earlier distinct event, record duplicate-intent no-op
      if (intentRow.status === "SUCCEEDED" || intentRow.status === "ORPHANED_SUCCEEDED") {
        await tx.insert(schema.paymentWebhookEvents).values({
          provider: "SANDBOX_GATEWAY",
          eventId: payload.eventId,
          payloadHash,
          paymentIntentId: intentRow.id,
          processingOutcome: "ALREADY_SETTLED_NOOP"
        });
        return {
          duplicate: true,
          outcome: "ALREADY_SETTLED_NOOP",
          bookingId: intentRow.booking_id
        };
      }

      // 3. Lock booking FOR UPDATE
      const bookingRes = await tx.execute(sql`
        SELECT id, traveller_user_id, business_id, location_id, status, total_bags, hold_expires_at, reference_code
        FROM bookings
        WHERE id = ${intentRow.booking_id}
        FOR UPDATE;
      `);
      const bookingRow = bookingRes.rows[0] as {
        id: string;
        traveller_user_id: string;
        business_id: string;
        location_id: string;
        status: string;
        total_bags: number;
        hold_expires_at: Date | string | null;
        reference_code: string;
      };

      const now = new Date();

      await tx
        .insert(schema.paymentTransactions)
        .values({
          paymentIntentId: intentRow.id,
          bookingId: bookingRow.id,
          provider: "SANDBOX_GATEWAY",
          providerTransactionId: payload.providerTransactionId,
          transactionType: "CHARGE",
          status: payload.status,
          amountMinor: payload.amountMinor,
          currency: payload.currency,
          rawStatusCode: payload.status,
          signatureVerified: true,
          metadata: { eventId: payload.eventId }
        })
        .onConflictDoNothing();

      if (payload.status === "FAILED") {
        await tx
          .update(schema.paymentIntents)
          .set({
            status: "FAILED",
            failureReason: payload.failureReason ?? "Payment declined by gateway",
            updatedAt: now
          })
          .where(eq(schema.paymentIntents.id, intentRow.id));

        await tx.insert(schema.paymentWebhookEvents).values({
          provider: "SANDBOX_GATEWAY",
          eventId: payload.eventId,
          payloadHash,
          paymentIntentId: intentRow.id,
          processingOutcome: "PAYMENT_FAILED"
        });

        await auditService.recordEvent({
          eventType: SecurityEventType.PAYMENT_WEBHOOK_VERIFIED,
          userId: bookingRow.traveller_user_id,
          clientInfo,
          metadata: {
            bookingId: bookingRow.id,
            referenceCode: bookingRow.reference_code,
            paymentIntentId: intentRow.id,
            providerTransactionId: payload.providerTransactionId,
            outcome: "PAYMENT_FAILED"
          },
          tx
        });

        return {
          duplicate: false,
          outcome: "PAYMENT_FAILED",
          bookingId: bookingRow.id,
          bookingStatus: bookingRow.status
        };
      }

      // Check whether booking hold is still valid or already expired/cancelled
      const holdElapsed =
        bookingRow.hold_expires_at !== null &&
        new Date(bookingRow.hold_expires_at).getTime() <= now.getTime();

      if (bookingRow.status !== "PENDING_PAYMENT" || holdElapsed) {
        // Late webhook after hold expiry or cancellation: NEVER overbook; record orphaned capture & auto-authorize 100% refund
        if (bookingRow.status === "PENDING_PAYMENT" && holdElapsed) {
          await quotationService.sweepExpiredHolds(tx);
        }

        await tx
          .update(schema.paymentIntents)
          .set({
            status: "ORPHANED_SUCCEEDED",
            verifiedAt: now,
            updatedAt: now
          })
          .where(eq(schema.paymentIntents.id, intentRow.id));

        await ledgerService.recordPaymentCaptured(tx, {
          bookingId: bookingRow.id,
          businessId: bookingRow.business_id,
          paymentIntentId: intentRow.id,
          amountMinor: payload.amountMinor,
          currency: payload.currency,
          referenceCode: bookingRow.reference_code
        });

        const [autoRefund] = await tx
          .insert(schema.refundRecords)
          .values({
            bookingId: bookingRow.id,
            paymentIntentId: intentRow.id,
            amountMinor: payload.amountMinor,
            currency: payload.currency,
            refundPercentage: 100,
            reasonCategory: "LATE_WEBHOOK_EXPIRED_HOLD",
            status: "AUTHORIZED",
            notes: "Automatic 100% refund authorized for late gateway capture after hold expiry/cancellation",
            createdAt: now,
            updatedAt: now
          })
          .returning({ id: schema.refundRecords.id });

        await ledgerService.recordCancellationSettlement(tx, {
          bookingId: bookingRow.id,
          businessId: bookingRow.business_id,
          refundId: autoRefund.id,
          paidAmountMinor: payload.amountMinor,
          refundAmountMinor: payload.amountMinor,
          commissionRateBps: 1500,
          currency: payload.currency,
          referenceCode: bookingRow.reference_code
        });

        await tx.insert(schema.paymentWebhookEvents).values({
          provider: "SANDBOX_GATEWAY",
          eventId: payload.eventId,
          payloadHash,
          paymentIntentId: intentRow.id,
          processingOutcome: "LATE_CAPTURE_AUTO_REFUND_QUEUED"
        });

        await auditService.recordEvent({
          eventType: SecurityEventType.PAYMENT_WEBHOOK_VERIFIED,
          userId: bookingRow.traveller_user_id,
          clientInfo,
          metadata: {
            bookingId: bookingRow.id,
            referenceCode: bookingRow.reference_code,
            paymentIntentId: intentRow.id,
            refundId: autoRefund.id,
            outcome: "LATE_CAPTURE_AUTO_REFUND_QUEUED"
          },
          tx
        });

        return {
          duplicate: false,
          outcome: "LATE_CAPTURE_AUTO_REFUND_QUEUED",
          bookingId: bookingRow.id,
          bookingStatus: holdElapsed ? "EXPIRED" : bookingRow.status
        };
      }

      // Normal verified payment confirmation path
      await tx
        .update(schema.paymentIntents)
        .set({
          status: "SUCCEEDED",
          verifiedAt: now,
          updatedAt: now
        })
        .where(eq(schema.paymentIntents.id, intentRow.id));

      await tx
        .update(schema.bookings)
        .set({
          status: "CONFIRMED",
          confirmedAt: now,
          holdExpiresAt: null,
          updatedAt: now
        })
        .where(eq(schema.bookings.id, bookingRow.id));

      await tx
        .update(schema.capacityReservations)
        .set({
          status: "CONFIRMED",
          expiresAt: null,
          updatedAt: now
        })
        .where(
          and(
            eq(schema.capacityReservations.bookingId, bookingRow.id),
            eq(schema.capacityReservations.status, "HELD_FOR_PAYMENT")
          )
        );

      const [custody] = await tx
        .insert(schema.custodyRecords)
        .values({
          bookingId: bookingRow.id,
          locationId: bookingRow.location_id,
          businessId: bookingRow.business_id,
          status: "EXPECTED",
          expectedBagCount: bookingRow.total_bags,
          handoverCondition: "NORMAL"
        })
        .onConflictDoNothing()
        .returning();

      if (custody) {
        await tx.insert(schema.custodyEvents).values({
          custodyRecordId: custody.id,
          bookingId: bookingRow.id,
          eventType: "CUSTODY_EXPECTED_INITIALIZED",
          previousStatus: null,
          newStatus: "EXPECTED",
          actorUserId: null,
          actorRole: "SYSTEM",
          metadata: { expectedBagCount: bookingRow.total_bags }
        });
      }

      const txGroupId = await ledgerService.recordPaymentCaptured(tx, {
        bookingId: bookingRow.id,
        businessId: bookingRow.business_id,
        paymentIntentId: intentRow.id,
        amountMinor: payload.amountMinor,
        currency: payload.currency,
        referenceCode: bookingRow.reference_code
      });

      await tx.insert(schema.bookingStatusHistory).values({
        bookingId: bookingRow.id,
        previousStatus: "PENDING_PAYMENT",
        newStatus: "CONFIRMED",
        actorUserId: null,
        actorRole: "PAYMENT_GATEWAY",
        reason: "Verified payment webhook confirmed booking",
        metadata: {
          paymentIntentId: intentRow.id,
          providerTransactionId: payload.providerTransactionId,
          transactionGroupId: txGroupId
        }
      });

      await tx.insert(schema.paymentWebhookEvents).values({
        provider: "SANDBOX_GATEWAY",
        eventId: payload.eventId,
        payloadHash,
        paymentIntentId: intentRow.id,
        processingOutcome: "BOOKING_CONFIRMED"
      });

      await auditService.recordEvent({
        eventType: SecurityEventType.BOOKING_CONFIRMED,
        userId: bookingRow.traveller_user_id,
        clientInfo,
        metadata: {
          bookingId: bookingRow.id,
          referenceCode: bookingRow.reference_code,
          paymentIntentId: intentRow.id,
          providerTransactionId: payload.providerTransactionId,
          transactionGroupId: txGroupId,
          amountMinor: payload.amountMinor,
          currency: payload.currency
        },
        tx
      });

      return {
        duplicate: false,
        outcome: "BOOKING_CONFIRMED",
        bookingId: bookingRow.id,
        bookingStatus: "CONFIRMED"
      };
    });
  }

  /**
   * Explicitly labeled development/sandbox checkout simulator.
   * Forbidden in production; dispatches a genuinely HMAC-signed webhook payload through processSandboxWebhook.
   */
  async simulateSandboxPayment(
    intentId: string,
    travellerUserId: string,
    rawInput: SandboxSimulatePaymentRequest,
    clientInfo?: AuditClientInfo
  ) {
    if (env.NODE_ENV === "production" || env.PAYMENT_PROVIDER !== "sandbox") {
      throw AppError.forbidden("Sandbox payment simulation is disabled in production");
    }

    const input = SandboxSimulatePaymentRequestSchema.parse(rawInput);

    const [intent] = await db
      .select()
      .from(schema.paymentIntents)
      .where(eq(schema.paymentIntents.id, intentId))
      .limit(1);

    if (!intent) {
      throw AppError.notFound("Payment intent not found");
    }
    if (intent.travellerUserId !== travellerUserId) {
      throw AppError.forbidden("You can only complete checkout for your own payment intent");
    }

    const webhookPayload: SandboxWebhookPayload = {
      eventId: `evt_sbx_${crypto.randomUUID()}`,
      providerOrderId: intent.providerOrderId,
      providerTransactionId: `tx_sbx_${crypto.randomBytes(8).toString("hex")}`,
      status: input.outcome,
      amountMinor: intent.amountMinor,
      currency: intent.currency,
      timestamp: Math.floor(Date.now() / 1000),
      ...(input.failureReason ? { failureReason: input.failureReason } : {})
    };

    const rawBody = JSON.stringify(webhookPayload);
    const adapter = new SandboxSignedGatewayAdapter(env.PAYMENT_WEBHOOK_SECRET);
    const signature = adapter.signWebhookPayload(rawBody);

    return this.processSandboxWebhook(rawBody, signature, clientInfo);
  }

  /**
   * Superadmin refund lifecycle transition (OQ-013 7-stage state machine).
   */
  async adminTransitionRefund(
    refundId: string,
    adminUserId: string,
    rawInput: AdminTransitionRefundRequest,
    clientInfo?: AuditClientInfo
  ): Promise<RefundRecord> {
    const input = AdminTransitionRefundRequestSchema.parse(rawInput);

    return db.transaction(async (tx) => {
      const lockedRes = await tx.execute(sql`
        SELECT r.*, b.business_id, b.reference_code
        FROM refund_records r
        INNER JOIN bookings b ON b.id = r.booking_id
        WHERE r.id = ${refundId}
        FOR UPDATE;
      `);

      const row = lockedRes.rows[0] as
        | {
            id: string;
            booking_id: string;
            payment_intent_id: string | null;
            amount_minor: number;
            currency: string;
            refund_percentage: number;
            reason_category: string;
            status: RefundStatus;
            provider_refund_id: string | null;
            requested_by_user_id: string | null;
            authorized_by_user_id: string | null;
            notes: string | null;
            completed_at: Date | null;
            created_at: Date;
            business_id: string;
            reference_code: string;
          }
        | undefined;

      if (!row) {
        throw AppError.notFound("Refund record not found");
      }

      const allowed = VALID_REFUND_TRANSITIONS[row.status] ?? [];
      if (!allowed.includes(input.targetStatus)) {
        throw AppError.conflict(
          `Invalid refund lifecycle transition from ${row.status} to ${input.targetStatus}`
        );
      }

      const now = new Date();
      const providerRefundId =
        input.providerRefundId ??
        row.provider_refund_id ??
        (input.targetStatus === "SUCCEEDED"
          ? `rfnd_${crypto.randomBytes(6).toString("hex")}`
          : null);

      const [updated] = await tx
        .update(schema.refundRecords)
        .set({
          status: input.targetStatus,
          providerRefundId,
          authorizedByUserId:
            input.targetStatus === "AUTHORIZED" || !row.authorized_by_user_id
              ? adminUserId
              : row.authorized_by_user_id,
          notes: input.notes,
          completedAt: input.targetStatus === "SUCCEEDED" ? now : row.completed_at,
          updatedAt: now
        })
        .where(eq(schema.refundRecords.id, refundId))
        .returning();

      if (input.targetStatus === "SUCCEEDED" && row.amount_minor > 0) {
        if (row.payment_intent_id && providerRefundId) {
          await tx
            .insert(schema.paymentTransactions)
            .values({
              paymentIntentId: row.payment_intent_id,
              bookingId: row.booking_id,
              provider: "SANDBOX_GATEWAY",
              providerTransactionId: providerRefundId,
              transactionType: "REFUND",
              status: "SUCCEEDED",
              amountMinor: row.amount_minor,
              currency: row.currency,
              rawStatusCode: "REFUNDED",
              signatureVerified: true,
              metadata: { refundId }
            })
            .onConflictDoNothing();
        }

        await ledgerService.recordRefundDisbursed(tx, {
          bookingId: row.booking_id,
          businessId: row.business_id,
          refundId: row.id,
          amountMinor: row.amount_minor,
          currency: row.currency,
          referenceCode: row.reference_code
        });
      }

      await auditService.recordEvent({
        eventType: SecurityEventType.REFUND_STATUS_CHANGED,
        userId: adminUserId,
        clientInfo,
        metadata: {
          refundId: row.id,
          bookingId: row.booking_id,
          referenceCode: row.reference_code,
          previousStatus: row.status,
          newStatus: input.targetStatus,
          amountMinor: row.amount_minor,
          currency: row.currency,
          adminNotes: input.notes
        },
        tx
      });

      return {
        id: updated.id,
        bookingId: updated.bookingId,
        referenceCode: row.reference_code,
        paymentIntentId: updated.paymentIntentId,
        amountMinor: updated.amountMinor,
        currency: updated.currency,
        refundPercentage: updated.refundPercentage,
        reasonCategory: updated.reasonCategory as RefundRecord["reasonCategory"],
        status: updated.status as RefundRecord["status"],
        providerRefundId: updated.providerRefundId,
        requestedByUserId: updated.requestedByUserId,
        authorizedByUserId: updated.authorizedByUserId,
        notes: updated.notes,
        completedAt: updated.completedAt ? updated.completedAt.toISOString() : null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString()
      };
    });
  }

  /**
   * Lists refund records for Superadmin / Support inspection.
   */
  async listAdminRefunds(
    rawQuery: Partial<AdminRefundListQuery>
  ): Promise<{ refunds: RefundRecord[]; total: number; page: number; limit: number }> {
    const query = AdminRefundListQuerySchema.parse(rawQuery);
    const offset = (query.page - 1) * query.limit;

    const conditions = [];
    if (query.status) conditions.push(eq(schema.refundRecords.status, query.status));
    if (query.bookingId) conditions.push(eq(schema.refundRecords.bookingId, query.bookingId));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.refundRecords)
      .where(whereClause);

    const rows = await db
      .select({
        refund: schema.refundRecords,
        referenceCode: schema.bookings.referenceCode
      })
      .from(schema.refundRecords)
      .innerJoin(schema.bookings, eq(schema.refundRecords.bookingId, schema.bookings.id))
      .where(whereClause)
      .orderBy(desc(schema.refundRecords.createdAt))
      .limit(query.limit)
      .offset(offset);

    const refunds: RefundRecord[] = rows.map(({ refund, referenceCode }) => ({
      id: refund.id,
      bookingId: refund.bookingId,
      referenceCode,
      paymentIntentId: refund.paymentIntentId,
      amountMinor: refund.amountMinor,
      currency: refund.currency,
      refundPercentage: refund.refundPercentage,
      reasonCategory: refund.reasonCategory as RefundRecord["reasonCategory"],
      status: refund.status as RefundRecord["status"],
      providerRefundId: refund.providerRefundId,
      requestedByUserId: refund.requestedByUserId,
      authorizedByUserId: refund.authorizedByUserId,
      notes: refund.notes,
      completedAt: refund.completedAt ? refund.completedAt.toISOString() : null,
      createdAt: refund.createdAt.toISOString(),
      updatedAt: refund.updatedAt.toISOString()
    }));

    return {
      refunds,
      total: countRes?.count ?? 0,
      page: query.page,
      limit: query.limit
    };
  }

  /**
   * Lists gateway payment transactions for Superadmin / Support inspection.
   */
  async listAdminPaymentTransactions(
    page = 1,
    limit = 20,
    bookingId?: string
  ): Promise<{ transactions: PaymentTransactionRecord[]; total: number }> {
    const offset = (page - 1) * limit;
    const whereClause = bookingId
      ? eq(schema.paymentTransactions.bookingId, bookingId)
      : undefined;

    const [countRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.paymentTransactions)
      .where(whereClause);

    const rows = await db
      .select({
        tx: schema.paymentTransactions,
        referenceCode: schema.bookings.referenceCode
      })
      .from(schema.paymentTransactions)
      .innerJoin(schema.bookings, eq(schema.paymentTransactions.bookingId, schema.bookings.id))
      .where(whereClause)
      .orderBy(desc(schema.paymentTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    const transactions: PaymentTransactionRecord[] = rows.map(({ tx, referenceCode }) => ({
      id: tx.id,
      paymentIntentId: tx.paymentIntentId,
      bookingId: tx.bookingId,
      referenceCode,
      provider: tx.provider as PaymentTransactionRecord["provider"],
      providerTransactionId: tx.providerTransactionId,
      transactionType: tx.transactionType as PaymentTransactionRecord["transactionType"],
      status: tx.status as PaymentTransactionRecord["status"],
      amountMinor: tx.amountMinor,
      currency: tx.currency,
      signatureVerified: tx.signatureVerified,
      createdAt: tx.createdAt.toISOString()
    }));

    return { transactions, total: countRes?.count ?? 0 };
  }
}

export const paymentsService = new PaymentsService();

