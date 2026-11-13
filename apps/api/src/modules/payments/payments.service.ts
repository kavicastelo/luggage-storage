import crypto from "node:crypto";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
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
import { withSerializableOrDeadlockRetry } from "../../infrastructure/database/tx-retry.js";
import { env } from "../../config/env.js";
import { AppError } from "../../common/errors/app-error.js";
import { auditService, SecurityEventType, AuditClientInfo } from "../audit/audit.service.js";
import { rateLimitService } from "../auth/rate-limit.service.js";
import { quotationService } from "../bookings/quotation-availability.service.js";
import { ledgerService } from "../finance/ledger.service.js";
import {
  NormalizedGatewayNotification,
  PaymentGatewayPort,
  RawWebhookNotificationInput,
  resolvePayHereGatewayAdapter,
  resolvePaymentGatewayAdapter,
  resolveSandboxGatewayAdapter
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
   * Acquires bookings FOR UPDATE first, uses PostgreSQL NOW() for hold expiry, validates pricing snapshots,
   * locks payment_intents ORDER BY id ASC FOR UPDATE, and preserves a single active intent per booking.
   */
  async createPaymentIntent(
    travellerUserId: string,
    rawInput: CreatePaymentIntentRequest,
    clientInfo?: AuditClientInfo
  ): Promise<PaymentIntent> {
    const input = CreatePaymentIntentRequestSchema.parse(rawInput);
    await quotationService.sweepExpiredHolds();

    const gateway = resolvePaymentGatewayAdapter();

    type CreateIntentTxResult =
      | { kind: "EXPIRED_HOLD" }
      | { kind: "INTENT"; intent: typeof schema.paymentIntents.$inferSelect };

    const result = await withSerializableOrDeadlockRetry(() =>
      db.transaction(async (tx): Promise<CreateIntentTxResult> => {
        // Tier 2 Lock: bookings FIRST, using DB NOW() as authoritative clock
        const bookingRes = await tx.execute(sql`
          SELECT
            b.id,
            b.reference_code,
            b.traveller_user_id,
            b.status,
            b.total_amount_minor,
            b.currency,
            b.hold_expires_at,
            u.email AS traveller_email,
            u.display_name AS traveller_display_name,
            NOW() AS db_now
          FROM bookings b
          INNER JOIN users u ON u.id = b.traveller_user_id
          WHERE b.id = ${input.bookingId}
          FOR UPDATE OF b;
        `);
        const bookingRow = bookingRes.rows[0] as
          | {
              id: string;
              reference_code: string;
              traveller_user_id: string;
              status: string;
              total_amount_minor: number;
              currency: string;
              hold_expires_at: Date | string | null;
              traveller_email: string;
              traveller_display_name: string;
              db_now: Date | string;
            }
          | undefined;

        if (!bookingRow) {
          throw AppError.notFound("Booking not found");
        }
        if (bookingRow.traveller_user_id !== travellerUserId) {
          throw AppError.forbidden("You can only pay for your own booking");
        }

        const dbNow = new Date(bookingRow.db_now);

        if (
          bookingRow.status === "PENDING_PAYMENT" &&
          bookingRow.hold_expires_at !== null &&
          new Date(bookingRow.hold_expires_at).getTime() <= dbNow.getTime()
        ) {
          await quotationService.expireSingleBookingHoldInTx(tx, bookingRow.id, "PENDING_PAYMENT");
          return { kind: "EXPIRED_HOLD" };
        }

        if (bookingRow.status !== "PENDING_PAYMENT") {
          throw AppError.conflict(
            `Booking is in status ${bookingRow.status} and cannot accept payment`
          );
        }

        const [snap] = await tx
          .select({
            totalAmountMinor: schema.bookingPricingSnapshots.totalAmountMinor,
            currency: schema.bookingPricingSnapshots.currency
          })
          .from(schema.bookingPricingSnapshots)
          .where(eq(schema.bookingPricingSnapshots.bookingId, bookingRow.id))
          .limit(1);

        if (
          !snap ||
          snap.totalAmountMinor !== Number(bookingRow.total_amount_minor) ||
          snap.currency !== bookingRow.currency
        ) {
          throw AppError.internal("Booking pricing snapshot integrity mismatch");
        }

        // Tier 3 Lock: lock all payment_intents for this booking ORDER BY id ASC
        const lockedIdsRes = await tx.execute(sql`
          SELECT id
          FROM payment_intents
          WHERE booking_id = ${bookingRow.id}
          ORDER BY id ASC
          FOR UPDATE;
        `);

        const intentRows =
          lockedIdsRes.rows.length > 0
            ? await tx
                .select()
                .from(schema.paymentIntents)
                .where(eq(schema.paymentIntents.bookingId, bookingRow.id))
            : [];

        if (
          intentRows.some(
            (i) => i.status === "SUCCEEDED" || i.status === "ORPHANED_SUCCEEDED"
          )
        ) {
          throw AppError.conflict("Booking already has a settled payment intent");
        }

        const elapsedIntentIds = intentRows
          .filter(
            (i) =>
              (i.status === "INITIATED" || i.status === "PENDING_GATEWAY") &&
              i.expiresAt.getTime() <= dbNow.getTime()
          )
          .map((i) => i.id);

        if (elapsedIntentIds.length > 0) {
          await tx
            .update(schema.paymentIntents)
            .set({
              status: "EXPIRED",
              failureReason: "Payment intent window elapsed",
              updatedAt: dbNow
            })
            .where(inArray(schema.paymentIntents.id, elapsedIntentIds));

          for (const intent of intentRows) {
            if (elapsedIntentIds.includes(intent.id)) {
              intent.status = "EXPIRED";
            }
          }
        }

        if (input.idempotencyKey) {
          const keyMatch = intentRows.find((i) => i.idempotencyKey === input.idempotencyKey);
          if (keyMatch) {
            if (keyMatch.provider !== gateway.providerName) {
              throw AppError.conflict("Idempotency key is bound to a different payment provider");
            }
            if (
              keyMatch.status === "PENDING_GATEWAY" &&
              keyMatch.expiresAt.getTime() > dbNow.getTime()
            ) {
              return { kind: "INTENT", intent: keyMatch };
            }
            throw AppError.conflict(
              `Payment intent for this idempotencyKey is in closed status ${keyMatch.status}`
            );
          }

          const openIdsToSupersede = intentRows
            .filter((i) => i.status === "INITIATED" || i.status === "PENDING_GATEWAY")
            .map((i) => i.id);

          if (openIdsToSupersede.length > 0) {
            await tx
              .update(schema.paymentIntents)
              .set({
                status: "EXPIRED",
                failureReason: "Superseded by newer payment intent request",
                updatedAt: dbNow
              })
              .where(inArray(schema.paymentIntents.id, openIdsToSupersede));
          }
        } else {
          const activeReusable = intentRows.find(
            (i) =>
              i.status === "PENDING_GATEWAY" &&
              i.provider === gateway.providerName &&
              i.expiresAt.getTime() > dbNow.getTime()
          );
          if (activeReusable) {
            return { kind: "INTENT", intent: activeReusable };
          }

          const openIdsToSupersede = intentRows
            .filter((i) => i.status === "INITIATED" || i.status === "PENDING_GATEWAY")
            .map((i) => i.id);

          if (openIdsToSupersede.length > 0) {
            await tx
              .update(schema.paymentIntents)
              .set({
                status: "EXPIRED",
                failureReason: "Superseded by newer payment provider intent",
                updatedAt: dbNow
              })
              .where(inArray(schema.paymentIntents.id, openIdsToSupersede));
          }
        }

        const intentId = crypto.randomUUID();
        const providerOrderId = `ORD-${bookingRow.reference_code}-${crypto
          .randomBytes(3)
          .toString("hex")
          .toUpperCase()}`;
        const expiresAt = bookingRow.hold_expires_at
          ? new Date(bookingRow.hold_expires_at)
          : new Date(dbNow.getTime() + 10 * 60_000);

        const checkoutPayload = gateway.buildCheckoutPayload({
          intentId,
          bookingId: bookingRow.id,
          referenceCode: bookingRow.reference_code,
          providerOrderId,
          amountMinor: Number(bookingRow.total_amount_minor),
          currency: bookingRow.currency,
          customerEmail: bookingRow.traveller_email,
          customerName: bookingRow.traveller_display_name
        });

        const [inserted] = await tx
          .insert(schema.paymentIntents)
          .values({
            id: intentId,
            bookingId: bookingRow.id,
            travellerUserId,
            provider: gateway.providerName,
            idempotencyKey: input.idempotencyKey ?? null,
            providerOrderId,
            amountMinor: Number(bookingRow.total_amount_minor),
            currency: bookingRow.currency,
            status: "PENDING_GATEWAY",
            checkoutPayload,
            expiresAt,
            createdAt: dbNow,
            updatedAt: dbNow
          })
          .returning();

        await auditService.recordEvent({
          eventType: SecurityEventType.PAYMENT_INTENT_CREATED,
          userId: travellerUserId,
          clientInfo,
          metadata: {
            bookingId: bookingRow.id,
            referenceCode: bookingRow.reference_code,
            paymentIntentId: inserted.id,
            provider: gateway.providerName,
            providerOrderId,
            amountMinor: inserted.amountMinor,
            currency: inserted.currency
          },
          tx
        });

        return { kind: "INTENT", intent: inserted };
      })
    );

    if (result.kind === "EXPIRED_HOLD") {
      throw AppError.conflict("Booking payment hold has expired");
    }

    return serializeIntent(result.intent);
  }

  /**
   * Verifies and processes an HMAC-SHA256 signed sandbox payment gateway webhook.
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
    return this.processGatewayWebhook(
      resolveSandboxGatewayAdapter(),
      {
        rawBody: rawPayload,
        headers: signatureHeader ? { "x-sandbox-signature": signatureHeader } : {},
        contentType: "application/json"
      },
      clientInfo
    );
  }

  /**
   * Verifies and processes an official PayHere notify_url notification (form-urlencoded or JSON)
   * using isolated md5sig verification inside PayHereGatewayAdapter.
   */
  async processPayHereWebhook(
    rawPayload: string,
    headers: Record<string, string | string[] | undefined>,
    contentType: string | undefined,
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

    let adapter: PaymentGatewayPort;
    try {
      adapter = resolvePayHereGatewayAdapter();
    } catch (err) {
      await auditService.recordEvent({
        eventType: SecurityEventType.PAYMENT_WEBHOOK_REJECTED,
        userId: null,
        clientInfo,
        metadata: {
          provider: "PAYHERE",
          reason: err instanceof Error ? err.message : "PayHere gateway is not configured"
        }
      });
      throw err;
    }

    return this.processGatewayWebhookInternal(
      adapter,
      { rawBody: rawPayload, headers, contentType },
      clientInfo
    );
  }

  private async processGatewayWebhook(
    adapter: PaymentGatewayPort,
    rawInput: RawWebhookNotificationInput,
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

    return this.processGatewayWebhookInternal(adapter, rawInput, clientInfo);
  }

  private async processGatewayWebhookInternal(
    adapter: PaymentGatewayPort,
    rawInput: RawWebhookNotificationInput,
    clientInfo?: AuditClientInfo
  ): Promise<{
    duplicate: boolean;
    outcome: string;
    bookingId?: string;
    bookingStatus?: string;
  }> {
    let notification: NormalizedGatewayNotification;
    try {
      notification = adapter.verifyAndNormalizeNotification(rawInput);
    } catch (err) {
      const ids = adapter.extractNotificationIdentifiers(rawInput);
      await auditService.recordEvent({
        eventType: SecurityEventType.PAYMENT_WEBHOOK_REJECTED,
        userId: null,
        clientInfo,
        metadata: {
          provider: adapter.providerName,
          providerOrderId: ids.providerOrderId,
          paymentIntentId: ids.paymentIntentId,
          eventId: ids.providerEventId,
          reason: err instanceof Error ? err.message : "Webhook verification failed"
        }
      });
      throw err;
    }

    const payloadHash = crypto
      .createHash("sha256")
      .update(rawInput.rawBody, "utf8")
      .digest("hex");

    // Non-locking intent pre-lookup to establish canonical Tier 2 (bookings) -> Tier 3 (payment_intents) order
    const [intentLookup] = await db
      .select({
        id: schema.paymentIntents.id,
        bookingId: schema.paymentIntents.bookingId,
        travellerUserId: schema.paymentIntents.travellerUserId,
        provider: schema.paymentIntents.provider
      })
      .from(schema.paymentIntents)
      .where(eq(schema.paymentIntents.providerOrderId, notification.providerOrderId))
      .limit(1);

    if (!intentLookup) {
      await auditService.recordEvent({
        eventType: SecurityEventType.PAYMENT_WEBHOOK_REJECTED,
        userId: null,
        clientInfo,
        metadata: {
          provider: notification.provider,
          providerOrderId: notification.providerOrderId,
          eventId: notification.providerEventId,
          reason: "Payment intent for providerOrderId not found"
        }
      });
      throw AppError.notFound("Payment intent for providerOrderId not found");
    }

    if (intentLookup.provider !== notification.provider) {
      await auditService.recordEvent({
        eventType: SecurityEventType.PAYMENT_WEBHOOK_REJECTED,
        userId: intentLookup.travellerUserId,
        clientInfo,
        metadata: {
          bookingId: intentLookup.bookingId,
          paymentIntentId: intentLookup.id,
          provider: notification.provider,
          providerOrderId: notification.providerOrderId,
          reason: `Cross-provider webhook rejected: intent provider is ${intentLookup.provider}, webhook provider is ${notification.provider}`
        }
      });
      throw AppError.conflict(
        `Webhook provider ${notification.provider} does not match intent provider ${intentLookup.provider}`
      );
    }

    if (notification.paymentIntentId && notification.paymentIntentId !== intentLookup.id) {
      await auditService.recordEvent({
        eventType: SecurityEventType.PAYMENT_WEBHOOK_REJECTED,
        userId: intentLookup.travellerUserId,
        clientInfo,
        metadata: {
          bookingId: intentLookup.bookingId,
          paymentIntentId: intentLookup.id,
          provider: notification.provider,
          providerOrderId: notification.providerOrderId,
          reason: "Webhook paymentIntentId does not match providerOrderId"
        }
      });
      throw AppError.conflict("Webhook paymentIntentId does not match providerOrderId");
    }

    try {
      return await withSerializableOrDeadlockRetry(() =>
        db.transaction(async (tx) => {
          // Tier 2 Lock: bookings FIRST
          const bookingRes = await tx.execute(sql`
            SELECT
              id,
              traveller_user_id,
              business_id,
              location_id,
              status,
              total_bags,
              total_amount_minor,
              currency,
              hold_expires_at,
              reference_code,
              NOW() AS db_now
            FROM bookings
            WHERE id = ${intentLookup.bookingId}
            FOR UPDATE;
          `);
          const bookingRow = bookingRes.rows[0] as
            | {
                id: string;
                traveller_user_id: string;
                business_id: string;
                location_id: string;
                status: string;
                total_bags: number;
                total_amount_minor: number;
                currency: string;
                hold_expires_at: Date | string | null;
                reference_code: string;
                db_now: Date | string;
              }
            | undefined;

          if (!bookingRow) {
            throw AppError.notFound("Associated booking not found");
          }

          // Tier 3 Lock: payment_intents ORDER BY id ASC
          const lockedIntentIdsRes = await tx.execute(sql`
            SELECT id
            FROM payment_intents
            WHERE booking_id = ${bookingRow.id}
            ORDER BY id ASC
            FOR UPDATE;
          `);
          const lockedIntents =
            lockedIntentIdsRes.rows.length > 0
              ? await tx
                  .select()
                  .from(schema.paymentIntents)
                  .where(eq(schema.paymentIntents.bookingId, bookingRow.id))
              : [];

          const intentRow = lockedIntents.find((i) => i.id === intentLookup.id);
          if (!intentRow) {
            throw AppError.notFound("Payment intent for providerOrderId not found");
          }
          if (intentRow.provider !== notification.provider) {
            throw AppError.conflict(
              `Webhook provider ${notification.provider} does not match intent provider ${intentRow.provider}`
            );
          }

          // Tier 4 Lock: refund_records ORDER BY id ASC
          const lockedRefundsRes = await tx.execute(sql`
            SELECT id, payment_intent_id
            FROM refund_records
            WHERE booking_id = ${bookingRow.id}
            ORDER BY id ASC
            FOR UPDATE;
          `);
          const existingRefunds = lockedRefundsRes.rows as Array<{
            id: string;
            payment_intent_id: string | null;
          }>;

          // 1. Idempotent event deduplication check
          const [existingEvent] = await tx
            .select()
            .from(schema.paymentWebhookEvents)
            .where(
              and(
                eq(schema.paymentWebhookEvents.provider, notification.provider),
                eq(schema.paymentWebhookEvents.eventId, notification.providerEventId)
              )
            )
            .limit(1);

          if (existingEvent) {
            return {
              duplicate: true,
              outcome: existingEvent.processingOutcome,
              bookingId: bookingRow.id,
              bookingStatus: bookingRow.status
            };
          }

          // 2. Pricing snapshot & intent amount/currency integrity verification
          const [snap] = await tx
            .select({
              totalAmountMinor: schema.bookingPricingSnapshots.totalAmountMinor,
              currency: schema.bookingPricingSnapshots.currency,
              commissionRateBps: schema.bookingPricingSnapshots.commissionRateBps
            })
            .from(schema.bookingPricingSnapshots)
            .where(eq(schema.bookingPricingSnapshots.bookingId, bookingRow.id))
            .limit(1);

          const amountMismatch =
            intentRow.amountMinor !== notification.amountMinor ||
            intentRow.currency !== notification.currency ||
            (snap !== undefined &&
              (snap.totalAmountMinor !== notification.amountMinor ||
                snap.currency !== notification.currency));

          if (amountMismatch) {
            throw AppError.badRequest(
              "Webhook amount or currency does not match payment intent or booking pricing snapshot"
            );
          }

          // 3. Provider transaction deduplication check
          const txProviderTransactionId =
            notification.providerTransactionId ?? notification.providerEventId;

          const [existingTx] = await tx
            .select({
              id: schema.paymentTransactions.id,
              paymentIntentId: schema.paymentTransactions.paymentIntentId,
              status: schema.paymentTransactions.status
            })
            .from(schema.paymentTransactions)
            .where(
              and(
                eq(schema.paymentTransactions.provider, notification.provider),
                eq(schema.paymentTransactions.providerTransactionId, txProviderTransactionId)
              )
            )
            .limit(1);

          if (existingTx) {
            if (existingTx.paymentIntentId !== intentRow.id) {
              throw AppError.conflict(
                "Duplicate provider transaction ID is already associated with another payment intent"
              );
            }
            if (existingTx.status === "SUCCEEDED" && notification.status === "SUCCEEDED") {
              await tx.insert(schema.paymentWebhookEvents).values({
                provider: notification.provider,
                eventId: notification.providerEventId,
                payloadHash,
                paymentIntentId: intentRow.id,
                processingOutcome: "ALREADY_SETTLED_NOOP"
              });
              return {
                duplicate: true,
                outcome: "ALREADY_SETTLED_NOOP",
                bookingId: bookingRow.id,
                bookingStatus: bookingRow.status
              };
            }
          }

          const now = new Date(bookingRow.db_now);
          const dbTransactionStatus: "SUCCEEDED" | "FAILED" | "PENDING" =
            notification.status === "SUCCEEDED"
              ? "SUCCEEDED"
              : notification.status === "PENDING"
              ? "PENDING"
              : "FAILED";

          if (!existingTx) {
            await tx
              .insert(schema.paymentTransactions)
              .values({
                paymentIntentId: intentRow.id,
                bookingId: bookingRow.id,
                provider: notification.provider,
                providerTransactionId: txProviderTransactionId,
                transactionType: "CHARGE",
                status: dbTransactionStatus,
                amountMinor: notification.amountMinor,
                currency: notification.currency,
                rawStatusCode: notification.rawStatusCode,
                signatureVerified: true,
                metadata: {
                  eventId: notification.providerEventId,
                  eventIdDerived: notification.eventIdDerived,
                  normalizedStatus: notification.status,
                  ...(notification.metadata ?? {})
                }
              })
              .onConflictDoNothing();
          }

          // 4. Protect already-settled intents against replays or out-of-order lower-precedence events
          if (intentRow.status === "SUCCEEDED" || intentRow.status === "ORPHANED_SUCCEEDED") {
            if (notification.status === "CHARGEDBACK") {
              let nextBookingStatus = bookingRow.status;
              const reason =
                notification.failureReason ?? "Chargeback / dispute received from payment gateway";

              if (bookingRow.status === "CONFIRMED" || bookingRow.status === "IN_STORAGE") {
                nextBookingStatus = "DISPUTED";
                await tx
                  .update(schema.bookings)
                  .set({
                    status: "DISPUTED",
                    exceptionReason: reason,
                    updatedAt: now
                  })
                  .where(eq(schema.bookings.id, bookingRow.id));

                await tx.insert(schema.bookingStatusHistory).values({
                  bookingId: bookingRow.id,
                  previousStatus: bookingRow.status,
                  newStatus: "DISPUTED",
                  actorUserId: null,
                  actorRole: "PAYMENT_GATEWAY",
                  reason,
                  metadata: {
                    paymentIntentId: intentRow.id,
                    provider: notification.provider,
                    providerTransactionId: txProviderTransactionId
                  }
                });
              }

              await tx
                .update(schema.hostPayables)
                .set({
                  status: "ON_HOLD",
                  updatedAt: now
                })
                .where(
                  and(
                    eq(schema.hostPayables.bookingId, bookingRow.id),
                    inArray(schema.hostPayables.status, ["ACCRUED", "ELIGIBLE"])
                  )
                );

              await tx.insert(schema.paymentWebhookEvents).values({
                provider: notification.provider,
                eventId: notification.providerEventId,
                payloadHash,
                paymentIntentId: intentRow.id,
                processingOutcome: "CHARGEBACK_FLAGGED_FOR_REVIEW"
              });

              await auditService.recordEvent({
                eventType: SecurityEventType.PAYMENT_WEBHOOK_VERIFIED,
                userId: bookingRow.traveller_user_id,
                clientInfo,
                metadata: {
                  bookingId: bookingRow.id,
                  referenceCode: bookingRow.reference_code,
                  paymentIntentId: intentRow.id,
                  provider: notification.provider,
                  providerTransactionId: txProviderTransactionId,
                  outcome: "CHARGEBACK_FLAGGED_FOR_REVIEW"
                },
                tx
              });

              return {
                duplicate: false,
                outcome: "CHARGEBACK_FLAGGED_FOR_REVIEW",
                bookingId: bookingRow.id,
                bookingStatus: nextBookingStatus
              };
            }

            await tx.insert(schema.paymentWebhookEvents).values({
              provider: notification.provider,
              eventId: notification.providerEventId,
              payloadHash,
              paymentIntentId: intentRow.id,
              processingOutcome: "ALREADY_SETTLED_NOOP"
            });

            return {
              duplicate: true,
              outcome: "ALREADY_SETTLED_NOOP",
              bookingId: bookingRow.id,
              bookingStatus: bookingRow.status
            };
          }

          // 5. Handle PENDING notification
          if (notification.status === "PENDING") {
            if (intentRow.status === "INITIATED") {
              await tx
                .update(schema.paymentIntents)
                .set({
                  status: "PENDING_GATEWAY",
                  updatedAt: now
                })
                .where(eq(schema.paymentIntents.id, intentRow.id));
            }

            await tx.insert(schema.paymentWebhookEvents).values({
              provider: notification.provider,
              eventId: notification.providerEventId,
              payloadHash,
              paymentIntentId: intentRow.id,
              processingOutcome: "PAYMENT_PENDING"
            });

            await auditService.recordEvent({
              eventType: SecurityEventType.PAYMENT_WEBHOOK_VERIFIED,
              userId: bookingRow.traveller_user_id,
              clientInfo,
              metadata: {
                bookingId: bookingRow.id,
                referenceCode: bookingRow.reference_code,
                paymentIntentId: intentRow.id,
                provider: notification.provider,
                providerTransactionId: txProviderTransactionId,
                outcome: "PAYMENT_PENDING"
              },
              tx
            });

            return {
              duplicate: false,
              outcome: "PAYMENT_PENDING",
              bookingId: bookingRow.id,
              bookingStatus: bookingRow.status
            };
          }

          // 6. Handle FAILED / CANCELLED / CHARGEDBACK on unsettled intent
          if (notification.status !== "SUCCEEDED") {
            const outcome =
              notification.status === "CANCELLED"
                ? "PAYMENT_CANCELLED"
                : notification.status === "CHARGEDBACK"
                ? "CHARGEBACK_FLAGGED_FOR_REVIEW"
                : "PAYMENT_FAILED";

            await tx
              .update(schema.paymentIntents)
              .set({
                status: "FAILED",
                failureReason:
                  notification.failureReason ?? `Gateway returned status ${notification.rawStatusCode}`,
                updatedAt: now
              })
              .where(eq(schema.paymentIntents.id, intentRow.id));

            await tx.insert(schema.paymentWebhookEvents).values({
              provider: notification.provider,
              eventId: notification.providerEventId,
              payloadHash,
              paymentIntentId: intentRow.id,
              processingOutcome: outcome
            });

            await auditService.recordEvent({
              eventType: SecurityEventType.PAYMENT_WEBHOOK_VERIFIED,
              userId: bookingRow.traveller_user_id,
              clientInfo,
              metadata: {
                bookingId: bookingRow.id,
                referenceCode: bookingRow.reference_code,
                paymentIntentId: intentRow.id,
                provider: notification.provider,
                providerTransactionId: txProviderTransactionId,
                outcome
              },
              tx
            });

            return {
              duplicate: false,
              outcome,
              bookingId: bookingRow.id,
              bookingStatus: bookingRow.status
            };
          }

          // 7. Handle SUCCEEDED notification: verify hold & booking eligibility
          const holdElapsed =
            bookingRow.hold_expires_at !== null &&
            new Date(bookingRow.hold_expires_at).getTime() <= now.getTime();
          const anotherSettledIntent = lockedIntents.some(
            (i) =>
              i.id !== intentRow.id &&
              (i.status === "SUCCEEDED" || i.status === "ORPHANED_SUCCEEDED")
          );
          const eligibleToConfirm =
            bookingRow.status === "PENDING_PAYMENT" && !holdElapsed && !anotherSettledIntent;

          if (!eligibleToConfirm) {
            if (bookingRow.status === "PENDING_PAYMENT" && holdElapsed) {
              await quotationService.expireSingleBookingHoldInTx(
                tx,
                bookingRow.id,
                "PENDING_PAYMENT"
              );
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
              amountMinor: notification.amountMinor,
              currency: notification.currency,
              referenceCode: bookingRow.reference_code
            });

            let existingRefund = existingRefunds.find((r) => r.payment_intent_id === intentRow.id);
            if (!existingRefund) {
              const [autoRefund] = await tx
                .insert(schema.refundRecords)
                .values({
                  bookingId: bookingRow.id,
                  paymentIntentId: intentRow.id,
                  amountMinor: notification.amountMinor,
                  currency: notification.currency,
                  refundPercentage: 100,
                  reasonCategory: "LATE_WEBHOOK_EXPIRED_HOLD",
                  status: "AUTHORIZED",
                  notes:
                    "Automatic 100% refund authorized for late gateway capture after hold expiry/cancellation",
                  createdAt: now,
                  updatedAt: now
                })
                .returning({ id: schema.refundRecords.id });

              existingRefund = { id: autoRefund.id, payment_intent_id: intentRow.id };

              await ledgerService.recordCancellationSettlement(tx, {
                bookingId: bookingRow.id,
                businessId: bookingRow.business_id,
                refundId: autoRefund.id,
                paidAmountMinor: notification.amountMinor,
                refundAmountMinor: notification.amountMinor,
                commissionRateBps: snap?.commissionRateBps ?? 1500,
                currency: notification.currency,
                referenceCode: bookingRow.reference_code
              });
            }

            await tx.insert(schema.paymentWebhookEvents).values({
              provider: notification.provider,
              eventId: notification.providerEventId,
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
                provider: notification.provider,
                refundId: existingRefund.id,
                outcome: "LATE_CAPTURE_AUTO_REFUND_QUEUED"
              },
              tx
            });

            return {
              duplicate: false,
              outcome: "LATE_CAPTURE_AUTO_REFUND_QUEUED",
              bookingId: bookingRow.id,
              bookingStatus:
                bookingRow.status === "PENDING_PAYMENT" && holdElapsed
                  ? "EXPIRED"
                  : bookingRow.status
            };
          }

          // 8. Normal verified payment confirmation path
          const confirmedReservations = await tx
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
            )
            .returning({ id: schema.capacityReservations.id });

          if (Number(bookingRow.total_bags) > 0 && confirmedReservations.length === 0) {
            throw AppError.internal(
              "Missing held capacity reservations required to confirm booking"
            );
          }

          const otherOpenIds = lockedIntents
            .filter(
              (i) =>
                i.id !== intentRow.id &&
                (i.status === "INITIATED" || i.status === "PENDING_GATEWAY")
            )
            .map((i) => i.id);

          if (otherOpenIds.length > 0) {
            await tx
              .update(schema.paymentIntents)
              .set({
                status: "EXPIRED",
                failureReason: "Superseded by confirmed payment on another intent",
                updatedAt: now
              })
              .where(inArray(schema.paymentIntents.id, otherOpenIds));
          }

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

          const [custody] = await tx
            .insert(schema.custodyRecords)
            .values({
              bookingId: bookingRow.id,
              locationId: bookingRow.location_id,
              businessId: bookingRow.business_id,
              status: "EXPECTED",
              expectedBagCount: Number(bookingRow.total_bags),
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
              metadata: { expectedBagCount: Number(bookingRow.total_bags) }
            });
          }

          const txGroupId = await ledgerService.recordPaymentCaptured(tx, {
            bookingId: bookingRow.id,
            businessId: bookingRow.business_id,
            paymentIntentId: intentRow.id,
            amountMinor: notification.amountMinor,
            currency: notification.currency,
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
              provider: notification.provider,
              providerTransactionId: txProviderTransactionId,
              transactionGroupId: txGroupId
            }
          });

          await tx.insert(schema.paymentWebhookEvents).values({
            provider: notification.provider,
            eventId: notification.providerEventId,
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
              provider: notification.provider,
              providerTransactionId: txProviderTransactionId,
              transactionGroupId: txGroupId,
              amountMinor: notification.amountMinor,
              currency: notification.currency
            },
            tx
          });

          return {
            duplicate: false,
            outcome: "BOOKING_CONFIRMED",
            bookingId: bookingRow.id,
            bookingStatus: "CONFIRMED"
          };
        })
      );
    } catch (err) {
      await auditService.recordEvent({
        eventType: SecurityEventType.PAYMENT_WEBHOOK_REJECTED,
        userId: intentLookup.travellerUserId,
        clientInfo,
        metadata: {
          bookingId: intentLookup.bookingId,
          paymentIntentId: intentLookup.id,
          provider: notification.provider,
          providerOrderId: notification.providerOrderId,
          reason: err instanceof Error ? err.message : "Webhook processing rejected"
        }
      });
      throw err;
    }
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
    const adapter = resolveSandboxGatewayAdapter();
    const signature = adapter.signWebhookPayload(rawBody);

    return this.processSandboxWebhook(rawBody, signature, clientInfo);
  }

  /**
   * Superadmin refund lifecycle transition (OQ-013 7-stage state machine).
   * Enforces canonical Tier 2 (bookings) -> Tier 3 (payment_intents) -> Tier 4 (refund_records) lock order,
   * idempotent targetStatus retries, and actual gateway provider attribution on payment_transactions.
   */
  async adminTransitionRefund(
    refundId: string,
    adminUserId: string,
    rawInput: AdminTransitionRefundRequest,
    clientInfo?: AuditClientInfo
  ): Promise<RefundRecord> {
    const input = AdminTransitionRefundRequestSchema.parse(rawInput);

    const [refundLookup] = await db
      .select({
        id: schema.refundRecords.id,
        bookingId: schema.refundRecords.bookingId
      })
      .from(schema.refundRecords)
      .where(eq(schema.refundRecords.id, refundId))
      .limit(1);

    if (!refundLookup) {
      throw AppError.notFound("Refund record not found");
    }

    return withSerializableOrDeadlockRetry(() =>
      db.transaction(async (tx) => {
        // Tier 2 Lock: bookings FIRST
        const bookingRes = await tx.execute(sql`
          SELECT id, business_id, reference_code, NOW() AS db_now
          FROM bookings
          WHERE id = ${refundLookup.bookingId}
          FOR UPDATE;
        `);
        const bookingRow = bookingRes.rows[0] as
          | {
              id: string;
              business_id: string;
              reference_code: string;
              db_now: Date | string;
            }
          | undefined;

        if (!bookingRow) {
          throw AppError.notFound("Associated booking not found");
        }

        // Tier 3 Lock: payment_intents ORDER BY id ASC
        const intentsRes = await tx.execute(sql`
          SELECT id, provider
          FROM payment_intents
          WHERE booking_id = ${bookingRow.id}
          ORDER BY id ASC
          FOR UPDATE;
        `);
        const lockedIntents = intentsRes.rows as Array<{
          id: string;
          provider: "SANDBOX_GATEWAY" | "PAYHERE";
        }>;

        // Tier 4 Lock: refund_records FOR UPDATE
        const refundRes = await tx.execute(sql`
          SELECT *
          FROM refund_records
          WHERE id = ${refundId}
          FOR UPDATE;
        `);
        const row = refundRes.rows[0] as
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
              updated_at: Date;
            }
          | undefined;

        if (!row) {
          throw AppError.notFound("Refund record not found");
        }

        // Idempotent retry when already in targetStatus (no duplicate ledger/transaction posting)
        if (row.status === input.targetStatus) {
          return {
            id: row.id,
            bookingId: row.booking_id,
            referenceCode: bookingRow.reference_code,
            paymentIntentId: row.payment_intent_id,
            amountMinor: Number(row.amount_minor),
            currency: row.currency,
            refundPercentage: Number(row.refund_percentage),
            reasonCategory: row.reason_category as RefundRecord["reasonCategory"],
            status: row.status,
            providerRefundId: row.provider_refund_id,
            requestedByUserId: row.requested_by_user_id,
            authorizedByUserId: row.authorized_by_user_id,
            notes: row.notes,
            completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
            createdAt: new Date(row.created_at).toISOString(),
            updatedAt: new Date(row.updated_at).toISOString()
          };
        }

        const allowed = VALID_REFUND_TRANSITIONS[row.status] ?? [];
        if (!allowed.includes(input.targetStatus)) {
          throw AppError.conflict(
            `Invalid refund lifecycle transition from ${row.status} to ${input.targetStatus}`
          );
        }

        let resolvedProvider: "SANDBOX_GATEWAY" | "PAYHERE" | null = null;
        if (row.payment_intent_id) {
          const matchingIntent = lockedIntents.find((i) => i.id === row.payment_intent_id);
          if (!matchingIntent) {
            throw AppError.internal("Associated payment intent not found for refund record");
          }
          resolvedProvider = matchingIntent.provider;
        }

        const now = new Date(bookingRow.db_now);
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

        if (input.targetStatus === "SUCCEEDED" && Number(row.amount_minor) > 0) {
          if (row.payment_intent_id && providerRefundId && resolvedProvider) {
            await tx
              .insert(schema.paymentTransactions)
              .values({
                paymentIntentId: row.payment_intent_id,
                bookingId: row.booking_id,
                provider: resolvedProvider,
                providerTransactionId: providerRefundId,
                transactionType: "REFUND",
                status: "SUCCEEDED",
                amountMinor: Number(row.amount_minor),
                currency: row.currency,
                rawStatusCode: "REFUNDED",
                signatureVerified: true,
                metadata: { refundId, provider: resolvedProvider }
              })
              .onConflictDoNothing();
          }

          await ledgerService.recordRefundDisbursed(tx, {
            bookingId: row.booking_id,
            businessId: bookingRow.business_id,
            refundId: row.id,
            amountMinor: Number(row.amount_minor),
            currency: row.currency,
            referenceCode: bookingRow.reference_code
          });
        }

        await auditService.recordEvent({
          eventType: SecurityEventType.REFUND_STATUS_CHANGED,
          userId: adminUserId,
          clientInfo,
          metadata: {
            refundId: row.id,
            bookingId: row.booking_id,
            referenceCode: bookingRow.reference_code,
            provider: resolvedProvider ?? undefined,
            previousStatus: row.status,
            newStatus: input.targetStatus,
            amountMinor: Number(row.amount_minor),
            currency: row.currency,
            adminNotes: input.notes
          },
          tx
        });

        return {
          id: updated.id,
          bookingId: updated.bookingId,
          referenceCode: bookingRow.reference_code,
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
      })
    );
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

