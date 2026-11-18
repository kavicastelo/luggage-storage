import crypto from "node:crypto";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  CheckoutStatusQuery,
  CheckoutStatusQuerySchema,
  CheckoutStatusResponse,
  CreatePaymentIntentRequest,
  CreatePaymentIntentRequestSchema,
  PaymentCheckoutChannel,
  PayHereCheckoutFormFieldsSchema,
  PayHereNativeSdkPayloadSchema,
  PaymentCheckoutHandoff,
  PaymentIntent,
  PaymentNextAction,
  PaymentTransactionEvidenceSource,
  SandboxSimulatePaymentRequest,
  SandboxSimulatePaymentRequestSchema,
  SandboxWebhookPayload,
  RefundRecord,
  RefundSettlementMode,
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
  PayHereGatewayAdapter,
  PaymentGatewayPort,
  PaymentProviderName,
  RawWebhookNotificationInput,
  resolvePayHereGatewayAdapter,
  resolvePayPalGatewayAdapter,
  resolvePaymentGatewayAdapter,
  resolveSandboxGatewayAdapter,
  resolveStripeGatewayAdapter
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

const UUID_FORMAT_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function extractPayHereFormFields(payload: Record<string, unknown>) {
  const candidate: Record<string, unknown> = {
    merchant_id: payload.merchant_id,
    return_url: payload.return_url,
    cancel_url: payload.cancel_url,
    notify_url: payload.notify_url,
    order_id: payload.order_id,
    items: payload.items,
    currency: payload.currency,
    amount: payload.amount,
    first_name: payload.first_name,
    last_name: payload.last_name,
    email: payload.email,
    phone: payload.phone,
    address: payload.address,
    city: payload.city,
    country: payload.country,
    hash: payload.hash
  };
  if (payload.custom_1 !== undefined) {
    candidate.custom_1 = payload.custom_1;
  }
  if (payload.custom_2 !== undefined) {
    candidate.custom_2 = payload.custom_2;
  }
  return PayHereCheckoutFormFieldsSchema.safeParse(candidate);
}

function isIntentPayloadValidForChannel(
  row: Pick<typeof schema.paymentIntents.$inferSelect, "provider" | "checkoutPayload">,
  channel: PaymentCheckoutChannel
): boolean {
  const payload = (row.checkoutPayload as Record<string, unknown>) ?? {};
  if (row.provider === "STRIPE") {
    return (
      typeof payload.clientSecret === "string" &&
      typeof payload.publishableKey === "string" &&
      typeof payload.paymentIntentId === "string"
    );
  }
  if (row.provider === "PAYPAL") {
    return (
      typeof payload.orderId === "string" &&
      typeof payload.approveUrl === "string"
    );
  }
  if (row.provider !== "PAYHERE") {
    return true;
  }
  if (channel === "MOBILE_APP") {
    return PayHereNativeSdkPayloadSchema.safeParse(payload.sdkPayload).success;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "mobileHandoffPath")) {
    return false;
  }
  return extractPayHereFormFields(payload).success;
}

function serializeIntent(row: typeof schema.paymentIntents.$inferSelect): PaymentIntent {
  const payload = (row.checkoutPayload as Record<string, unknown>) ?? {};
  const provider = row.provider as PaymentIntent["provider"];
  const checkoutChannel: PaymentCheckoutChannel =
    row.checkoutChannel === "MOBILE_APP" ? "MOBILE_APP" : "WEB";

  let nextAction: PaymentNextAction;
  let checkoutHandoff: PaymentCheckoutHandoff;

  if (provider === "STRIPE") {
    nextAction = "STRIPE_ELEMENTS_CONFIRM";
    checkoutHandoff = {
      mode: "STRIPE_ELEMENTS",
      provider: "STRIPE",
      method: "STRIPE_ELEMENTS",
      clientSecret: String(payload.clientSecret ?? ""),
      publishableKey: String(payload.publishableKey ?? ""),
      paymentIntentId: String(payload.paymentIntentId ?? "")
    };
  } else if (provider === "PAYPAL") {
    nextAction = "PAYPAL_CHECKOUT_APPROVE";
    checkoutHandoff = {
      mode: "PAYPAL_CHECKOUT",
      provider: "PAYPAL",
      method: "PAYPAL_CHECKOUT",
      orderId: String(payload.orderId ?? ""),
      approveUrl: String(payload.approveUrl ?? "")
    };
  } else if (provider === "PAYHERE") {
    if (checkoutChannel === "MOBILE_APP") {
      nextAction = "LAUNCH_NATIVE_SDK";
      const parsedSdk = PayHereNativeSdkPayloadSchema.safeParse(payload.sdkPayload);
      if (parsedSdk.success) {
        checkoutHandoff = {
          mode:
            payload.mode === "PAYHERE_NATIVE_LIVE"
              ? "PAYHERE_NATIVE_LIVE"
              : "PAYHERE_NATIVE_SANDBOX",
          provider: "PAYHERE",
          method: "NATIVE_SDK",
          sdkPayload: parsedSdk.data
        };
      } else {
        checkoutHandoff = {
          mode: "LEGACY_EXPIRED",
          provider: "PAYHERE",
          method: "EXPIRED",
          reason:
            "Legacy mobile payment intent expired or missing native SDK payload; create a fresh checkout intent"
        };
      }
    } else {
      nextAction = "REDIRECT_TO_PROVIDER";
      const hasLegacyBridgeField = Object.prototype.hasOwnProperty.call(
        payload,
        "mobileHandoffPath"
      );
      const parsedFields = extractPayHereFormFields(payload);
      if (!hasLegacyBridgeField && parsedFields.success) {
        const rawActionUrl =
          typeof payload.actionUrl === "string"
            ? payload.actionUrl
            : "https://sandbox.payhere.lk/pay/checkout";
        const actionUrl =
          rawActionUrl === "https://www.payhere.lk/pay/checkout"
            ? "https://www.payhere.lk/pay/checkout"
            : "https://sandbox.payhere.lk/pay/checkout";
        const mode =
          payload.mode === "PAYHERE_LIVE_REDIRECT"
            ? "PAYHERE_LIVE_REDIRECT"
            : "PAYHERE_SANDBOX_REDIRECT";

        checkoutHandoff = {
          mode,
          provider: "PAYHERE",
          method: "POST_FORM",
          actionUrl,
          fields: parsedFields.data
        };
      } else {
        checkoutHandoff = {
          mode: "LEGACY_EXPIRED",
          provider: "PAYHERE",
          method: "EXPIRED",
          reason:
            "Legacy web payment intent expired during PayHere remediation; create a fresh checkout intent"
        };
      }
    }
  } else {
    nextAction = "SANDBOX_SIMULATION";
    checkoutHandoff = {
      mode: "SANDBOX_SIMULATION",
      provider: "SANDBOX_GATEWAY",
      method: "SIMULATED_API",
      intentId: row.id,
      orderId: row.providerOrderId,
      amountMinor: row.amountMinor,
      currency: row.currency
    };
  }

  return {
    id: row.id,
    bookingId: row.bookingId,
    travellerUserId: row.travellerUserId,
    provider,
    checkoutChannel,
    providerOrderId: row.providerOrderId,
    amountMinor: row.amountMinor,
    currency: row.currency,
    status: row.status as PaymentIntent["status"],
    nextAction,
    checkoutHandoff,
    checkoutPayload: payload,
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
    const requestedChannel: PaymentCheckoutChannel = input.channel ?? "WEB";
    await quotationService.sweepExpiredHolds();

    if (
      env.NODE_ENV === "production" &&
      (input.provider === "PAYHERE" || env.PAYMENT_PROVIDER === "payhere")
    ) {
      throw AppError.badRequest(
        "PAYHERE_PROVIDER_RETIRED: PayHere has been permanently retired as an active payment gateway. Please select Stripe or PayPal."
      );
    }

    const defaultProvider = (
      env.PAYMENT_PROVIDER === "sandbox"
        ? "SANDBOX_GATEWAY"
        : env.PAYMENT_PROVIDER.toUpperCase()
    ) as PaymentProviderName;
    const targetProvider = (input.provider ?? defaultProvider) as PaymentProviderName;

    const gateway = resolvePaymentGatewayAdapter(targetProvider, requestedChannel);

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
            u.phone_number AS traveller_phone_number,
            tp.first_name AS traveller_first_name,
            tp.last_name AS traveller_last_name,
            NOW() AS db_now
          FROM bookings b
          INNER JOIN users u ON u.id = b.traveller_user_id
          LEFT JOIN traveller_profiles tp ON tp.user_id = u.id
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
              traveller_phone_number: string | null;
              traveller_first_name: string | null;
              traveller_last_name: string | null;
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
            if (keyMatch.checkoutChannel !== requestedChannel) {
              throw AppError.conflict("Idempotency key is bound to a different checkout channel");
            }
            if (
              keyMatch.status === "PENDING_GATEWAY" &&
              keyMatch.expiresAt.getTime() > dbNow.getTime() &&
              keyMatch.amountMinor === Number(bookingRow.total_amount_minor) &&
              keyMatch.currency === bookingRow.currency &&
              isIntentPayloadValidForChannel(keyMatch, requestedChannel)
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
              i.checkoutChannel === requestedChannel &&
              i.expiresAt.getTime() > dbNow.getTime() &&
              i.amountMinor === Number(bookingRow.total_amount_minor) &&
              i.currency === bookingRow.currency &&
              isIntentPayloadValidForChannel(i, requestedChannel)
          );
          if (activeReusable && !(gateway.providerName === "PAYHERE" && input.customerDetails)) {
            return { kind: "INTENT", intent: activeReusable };
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

        const displayNameParts = String(bookingRow.traveller_display_name ?? "")
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        const resolvedFirstName =
          input.customerDetails?.firstName?.trim() ||
          bookingRow.traveller_first_name?.trim() ||
          displayNameParts[0] ||
          undefined;
        const resolvedLastName =
          input.customerDetails?.lastName?.trim() ||
          bookingRow.traveller_last_name?.trim() ||
          (displayNameParts.length > 1 ? displayNameParts.slice(1).join(" ") : undefined);
        const resolvedEmail =
          input.customerDetails?.email?.trim() ||
          String(bookingRow.traveller_email ?? "").trim() ||
          undefined;
        const resolvedPhone =
          input.customerDetails?.phone?.trim() ||
          bookingRow.traveller_phone_number?.trim() ||
          undefined;

        const checkoutPayload = await gateway.buildCheckoutPayload({
          intentId,
          bookingId: bookingRow.id,
          referenceCode: bookingRow.reference_code,
          providerOrderId,
          amountMinor: Number(bookingRow.total_amount_minor),
          currency: bookingRow.currency,
          channel: requestedChannel,
          customerEmail: bookingRow.traveller_email,
          customerName: bookingRow.traveller_display_name,
          customerDetails: {
            firstName: resolvedFirstName,
            lastName: resolvedLastName,
            email: resolvedEmail,
            phone: resolvedPhone,
            address: input.customerDetails?.address?.trim(),
            city: input.customerDetails?.city?.trim(),
            country: input.customerDetails?.country?.trim()
          }
        });

        if (!input.idempotencyKey) {
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

        const [inserted] = await tx
          .insert(schema.paymentIntents)
          .values({
            id: intentId,
            bookingId: bookingRow.id,
            travellerUserId,
            provider: gateway.providerName,
            checkoutChannel: requestedChannel,
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
            checkoutChannel: requestedChannel,
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
   * Returns authoritative booking & latest payment intent state for checkout return / polling.
   */
  async getCheckoutStatus(
    userId: string,
    userRoles: string[],
    rawQuery: CheckoutStatusQuery
  ): Promise<CheckoutStatusResponse> {
    const query = CheckoutStatusQuerySchema.parse(rawQuery);
    await quotationService.sweepExpiredHolds();

    let resolvedBookingId = query.bookingId;
    let matchedOrderIntent: typeof schema.paymentIntents.$inferSelect | null = null;

    if (query.orderId) {
      const [intentByOrder] = await db
        .select()
        .from(schema.paymentIntents)
        .where(eq(schema.paymentIntents.providerOrderId, query.orderId))
        .limit(1);
      if (!intentByOrder) {
        throw AppError.notFound("Payment order not found");
      }
      if (resolvedBookingId && intentByOrder.bookingId !== resolvedBookingId) {
        throw AppError.notFound("Payment order does not belong to requested booking");
      }
      resolvedBookingId = intentByOrder.bookingId;
      matchedOrderIntent = intentByOrder;
    }

    if (!resolvedBookingId) {
      throw AppError.badRequest("Either bookingId or orderId is required");
    }

    const [booking] = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, resolvedBookingId))
      .limit(1);

    if (!booking) {
      throw AppError.notFound("Booking not found");
    }

    const isAdminOrSupport =
      userRoles.includes("SUPERADMIN") ||
      userRoles.includes("SUPPORT") ||
      userRoles.includes("ADMIN");
    if (booking.travellerUserId !== userId && !isAdminOrSupport) {
      throw AppError.forbidden("You do not have permission to view payment status for this booking");
    }

    const intentRows = await db
      .select()
      .from(schema.paymentIntents)
      .where(eq(schema.paymentIntents.bookingId, booking.id))
      .orderBy(desc(schema.paymentIntents.createdAt));

    const settledIntent = intentRows.find(
      (i) => i.status === "SUCCEEDED" || i.status === "ORPHANED_SUCCEEDED"
    );
    const selectedIntent = settledIntent ?? matchedOrderIntent ?? intentRows[0] ?? null;

    const holdNotExpired =
      !booking.holdExpiresAt || booking.holdExpiresAt.getTime() > Date.now();
    const custodyReady = ["CONFIRMED", "IN_STORAGE"].includes(booking.status);

    return {
      bookingId: booking.id,
      referenceCode: booking.referenceCode,
      bookingStatus: booking.status,
      holdExpiresAt: booking.holdExpiresAt ? booking.holdExpiresAt.toISOString() : null,
      confirmedAt: booking.confirmedAt ? booking.confirmedAt.toISOString() : null,
      canRetryPayment: booking.status === "PENDING_PAYMENT" && holdNotExpired,
      custodyReady,
      pollRecommended: booking.status === "PENDING_PAYMENT" && holdNotExpired,
      paymentIntent: selectedIntent ? serializeIntent(selectedIntent) : null
    };
  }

  /**
   * Verifies and processes an HMAC-SHA256 signed sandbox payment gateway webhook.
   */
  async processSandboxWebhook(
    rawPayload: string,
    signatureHeader: string | undefined,
    clientInfo?: AuditClientInfo,
    options?: { evidenceSource?: "PROVIDER_WEBHOOK" | "SANDBOX_SIMULATOR" }
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
      clientInfo,
      options
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

    const rawInput: RawWebhookNotificationInput = {
      rawBody: rawPayload,
      headers,
      contentType
    };

    let lookup: { providerOrderId?: string; paymentIntentId?: string };
    try {
      lookup = PayHereGatewayAdapter.extractUntrustedWebhookLookup(rawInput);
    } catch (err) {
      await auditService.recordEvent({
        eventType: SecurityEventType.PAYMENT_WEBHOOK_REJECTED,
        userId: null,
        clientInfo,
        metadata: {
          provider: "PAYHERE",
          reason: err instanceof Error ? err.message : "Malformed PayHere webhook payload"
        }
      });
      throw err;
    }

    let matchedChannel: PaymentCheckoutChannel = "WEB";
    if (lookup.providerOrderId || lookup.paymentIntentId) {
      const [intentByOrder] = lookup.providerOrderId
        ? await db
            .select({
              provider: schema.paymentIntents.provider,
              checkoutChannel: schema.paymentIntents.checkoutChannel
            })
            .from(schema.paymentIntents)
            .where(eq(schema.paymentIntents.providerOrderId, lookup.providerOrderId))
            .limit(1)
        : [];

      const matchedIntent =
        intentByOrder ??
        (lookup.paymentIntentId
          ? (
              await db
                .select({
                  provider: schema.paymentIntents.provider,
                  checkoutChannel: schema.paymentIntents.checkoutChannel
                })
                .from(schema.paymentIntents)
                .where(eq(schema.paymentIntents.id, lookup.paymentIntentId))
                .limit(1)
            )[0]
          : undefined);

      if (matchedIntent?.provider === "PAYHERE" && matchedIntent.checkoutChannel === "MOBILE_APP") {
        matchedChannel = "MOBILE_APP";
      }
    }

    let adapter: PaymentGatewayPort;
    try {
      adapter = resolvePayHereGatewayAdapter(matchedChannel);
    } catch (err) {
      await auditService.recordEvent({
        eventType: SecurityEventType.PAYMENT_WEBHOOK_REJECTED,
        userId: null,
        clientInfo,
        metadata: {
          provider: "PAYHERE",
          providerOrderId: lookup.providerOrderId,
          paymentIntentId: lookup.paymentIntentId,
          checkoutChannel: matchedChannel,
          reason: err instanceof Error ? err.message : "PayHere gateway is not configured"
        }
      });
      throw err;
    }

    return this.processGatewayWebhookInternal(adapter, rawInput, clientInfo);
  }

  /**
   * Verifies and processes an official Stripe webhook notification (JSON raw body)
   * using Stripe SDK signature verification.
   */
  async processStripeWebhook(
    rawPayload: string,
    headers: Record<string, string | string[] | undefined>,
    clientInfo?: AuditClientInfo
  ): Promise<{
    duplicate: boolean;
    outcome: string;
    bookingId?: string;
    bookingStatus?: string;
  }> {
    return this.processGatewayWebhook(
      resolveStripeGatewayAdapter(),
      {
        rawBody: rawPayload,
        headers,
        contentType: "application/json"
      },
      clientInfo
    );
  }

  /**
   * Verifies and processes an official PayPal webhook notification (JSON raw body)
   * using PayPal REST API signature verification.
   */
  async processPayPalWebhook(
    rawPayload: string,
    headers: Record<string, string | string[] | undefined>,
    clientInfo?: AuditClientInfo
  ): Promise<{
    duplicate: boolean;
    outcome: string;
    bookingId?: string;
    bookingStatus?: string;
  }> {
    return this.processGatewayWebhook(
      resolvePayPalGatewayAdapter(),
      {
        rawBody: rawPayload,
        headers,
        contentType: "application/json"
      },
      clientInfo
    );
  }

  private async processGatewayWebhook(
    adapter: PaymentGatewayPort,
    rawInput: RawWebhookNotificationInput,
    clientInfo?: AuditClientInfo,
    options?: { evidenceSource?: "PROVIDER_WEBHOOK" | "SANDBOX_SIMULATOR" }
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

    return this.processGatewayWebhookInternal(adapter, rawInput, clientInfo, options);
  }

  private async processGatewayWebhookInternal(
    adapter: PaymentGatewayPort,
    rawInput: RawWebhookNotificationInput,
    clientInfo?: AuditClientInfo,
    options?: { evidenceSource?: "PROVIDER_WEBHOOK" | "SANDBOX_SIMULATOR" }
  ): Promise<{
    duplicate: boolean;
    outcome: string;
    bookingId?: string;
    bookingStatus?: string;
  }> {
    let notification: NormalizedGatewayNotification;
    try {
      notification = await adapter.verifyAndNormalizeNotification(rawInput);
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

          const evidenceSource: PaymentTransactionEvidenceSource =
            options?.evidenceSource ?? "PROVIDER_WEBHOOK";
          const signatureVerified = evidenceSource === "PROVIDER_WEBHOOK";

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
                evidenceSource,
                signatureVerified,
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
    if (intent.provider !== "SANDBOX_GATEWAY") {
      throw AppError.forbidden(
        "Sandbox payment simulation cannot be used for non-sandbox payment intents"
      );
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

    return this.processSandboxWebhook(rawBody, signature, clientInfo, {
      evidenceSource: "SANDBOX_SIMULATOR"
    });
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

    try {
      return await withSerializableOrDeadlockRetry(() =>
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
            SELECT id, provider, status, currency
            FROM payment_intents
            WHERE booking_id = ${bookingRow.id}
            ORDER BY id ASC
            FOR UPDATE;
          `);
          const lockedIntents = intentsRes.rows as Array<{
            id: string;
            provider: "SANDBOX_GATEWAY" | "PAYHERE";
            status: string;
            currency: string;
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
                settlement_mode: RefundSettlementMode | null;
                provider_refund_id: string | null;
                manual_reference: string | null;
                requested_by_user_id: string | null;
                authorized_by_user_id: string | null;
                settled_by_user_id: string | null;
                notes: string | null;
                completed_at: Date | null;
                created_at: Date;
                updated_at: Date;
              }
            | undefined;

          if (!row) {
            throw AppError.notFound("Refund record not found");
          }

          const serializeRefundRow = (r: typeof schema.refundRecords.$inferSelect): RefundRecord => ({
            id: r.id,
            bookingId: r.bookingId,
            referenceCode: bookingRow.reference_code,
            paymentIntentId: r.paymentIntentId,
            amountMinor: r.amountMinor,
            currency: r.currency,
            refundPercentage: r.refundPercentage,
            reasonCategory: r.reasonCategory as RefundRecord["reasonCategory"],
            status: r.status as RefundRecord["status"],
            settlementMode: (r.settlementMode as RefundSettlementMode | null) ?? null,
            providerRefundId: r.providerRefundId,
            manualReference: r.manualReference,
            requestedByUserId: r.requestedByUserId,
            authorizedByUserId: r.authorizedByUserId,
            settledByUserId: r.settledByUserId,
            notes: r.notes,
            completedAt: r.completedAt ? r.completedAt.toISOString() : null,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString()
          });

          // Idempotent retry when already in targetStatus (conflict if settled mode or reference changed)
          if (row.status === input.targetStatus) {
            if (row.status === "SUCCEEDED") {
              if (row.settlement_mode !== input.settlementMode) {
                throw AppError.conflict(
                  "Refund is already settled under a different settlementMode"
                );
              }
              if (
                input.settlementMode === "PROVIDER_CONFIRMED" &&
                row.provider_refund_id !== input.providerRefundId?.trim()
              ) {
                throw AppError.conflict(
                  "Refund is already settled with a different providerRefundId"
                );
              }
              if (
                input.settlementMode === "MANUAL_OFFLINE" &&
                row.manual_reference !== input.manualReference?.trim()
              ) {
                throw AppError.conflict(
                  "Refund is already settled with a different manualReference"
                );
              }
            }

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
              settlementMode: row.settlement_mode ?? null,
              providerRefundId: row.provider_refund_id,
              manualReference: row.manual_reference ?? null,
              requestedByUserId: row.requested_by_user_id,
              authorizedByUserId: row.authorized_by_user_id,
              settledByUserId: row.settled_by_user_id ?? null,
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
          let matchedIntent: (typeof lockedIntents)[number] | undefined;
          if (row.payment_intent_id) {
            matchedIntent = lockedIntents.find((i) => i.id === row.payment_intent_id);
            if (!matchedIntent) {
              throw AppError.internal("Associated payment intent not found for refund record");
            }
            resolvedProvider = matchedIntent.provider;
          }

          const now = new Date(bookingRow.db_now);
          const amountMinor = Number(row.amount_minor);
          let nextSettlementMode: RefundSettlementMode | null = row.settlement_mode ?? null;
          let nextProviderRefundId: string | null =
            input.providerRefundId?.trim() ?? row.provider_refund_id;
          let nextManualReference: string | null = row.manual_reference ?? null;
          let nextSettledByUserId: string | null = row.settled_by_user_id ?? null;

          if (input.targetStatus !== "SUCCEEDED" && input.providerRefundId?.trim()) {
            const candidateRef = input.providerRefundId.trim();
            const dupRefund = await tx.execute(sql`
              SELECT id
              FROM refund_records
              WHERE provider_refund_id = ${candidateRef}
                AND id <> ${row.id}
              LIMIT 1;
            `);
            if (dupRefund.rows.length > 0) {
              throw AppError.conflict(
                "Provider refund ID is already associated with another refund record"
              );
            }
            if (resolvedProvider) {
              const dupTx = await tx.execute(sql`
                SELECT id
                FROM payment_transactions
                WHERE provider = ${resolvedProvider}
                  AND provider_transaction_id = ${candidateRef}
                LIMIT 1;
              `);
              if (dupTx.rows.length > 0) {
                throw AppError.conflict(
                  "Provider refund ID collides with an existing payment transaction reference"
                );
              }
            }
          }

          if (input.targetStatus === "SUCCEEDED") {
            const mode = input.settlementMode!;
            nextSettlementMode = mode;
            nextSettledByUserId = adminUserId;

            if (mode === "PROVIDER_CONFIRMED") {
              nextProviderRefundId = input.providerRefundId!.trim();
              nextManualReference = null;
            } else {
              nextProviderRefundId = null;
              nextManualReference = input.manualReference!.trim();
            }

            if (amountMinor > 0) {
              if (!matchedIntent || !resolvedProvider || !row.payment_intent_id) {
                throw AppError.conflict(
                  "Cannot mark positive refund SUCCEEDED without an associated settled payment intent"
                );
              }
              if (
                matchedIntent.status !== "SUCCEEDED" &&
                matchedIntent.status !== "ORPHANED_SUCCEEDED"
              ) {
                throw AppError.conflict(
                  `Cannot mark refund SUCCEEDED while associated payment intent is ${matchedIntent.status}`
                );
              }
              if (matchedIntent.currency !== row.currency) {
                throw AppError.conflict(
                  "Refund currency does not match associated payment intent currency"
                );
              }

              const bookingTxRes = await tx.execute(sql`
                SELECT
                  id,
                  payment_intent_id,
                  refund_id,
                  provider,
                  provider_transaction_id,
                  transaction_type,
                  status,
                  amount_minor,
                  currency
                FROM payment_transactions
                WHERE booking_id = ${bookingRow.id}
                ORDER BY id ASC
                FOR UPDATE;
              `);
              const bookingTxRows = bookingTxRes.rows as Array<{
                id: string;
                payment_intent_id: string;
                refund_id: string | null;
                provider: string;
                provider_transaction_id: string | null;
                transaction_type: string;
                status: string;
                amount_minor: number;
                currency: string;
              }>;

              const capturedIntentTxs = bookingTxRows.filter(
                (t) =>
                  t.payment_intent_id === row.payment_intent_id &&
                  t.transaction_type === "CHARGE" &&
                  t.status === "SUCCEEDED"
              );
              if (capturedIntentTxs.length === 0) {
                throw AppError.conflict(
                  "Cannot mark refund SUCCEEDED without a captured CHARGE transaction"
                );
              }
              if (
                capturedIntentTxs.some(
                  (t) => t.provider !== resolvedProvider || t.currency !== row.currency
                )
              ) {
                throw AppError.conflict(
                  "Captured charge provider or currency does not match refund record"
                );
              }

              const totalCapturedMinor = bookingTxRows
                .filter(
                  (t) =>
                    t.transaction_type === "CHARGE" &&
                    t.status === "SUCCEEDED" &&
                    t.currency === row.currency
                )
                .reduce((sum, t) => sum + Number(t.amount_minor), 0);

              const totalRefundTxMinor = bookingTxRows
                .filter((t) => t.transaction_type === "REFUND" && t.status === "SUCCEEDED")
                .reduce((sum, t) => sum + Number(t.amount_minor), 0);

              const otherSucceededRefundsRes = await tx.execute(sql`
                SELECT COALESCE(SUM(amount_minor), 0)::bigint AS total_refunded
                FROM refund_records
                WHERE booking_id = ${bookingRow.id}
                  AND status = 'SUCCEEDED'
                  AND id <> ${row.id};
              `);
              const otherRefundsMinor = Number(
                (otherSucceededRefundsRes.rows[0] as { total_refunded?: string | number } | undefined)
                  ?.total_refunded ?? 0
              );

              if (
                totalRefundTxMinor + amountMinor > totalCapturedMinor ||
                otherRefundsMinor + amountMinor > totalCapturedMinor
              ) {
                throw AppError.conflict(
                  "Refund amount exceeds total captured charges for this booking"
                );
              }

              if (
                bookingTxRows.some(
                  (t) =>
                    t.refund_id === row.id &&
                    t.transaction_type === "REFUND" &&
                    t.status === "SUCCEEDED"
                )
              ) {
                throw AppError.conflict(
                  "A succeeded REFUND transaction already exists for this refund record"
                );
              }

              if (mode === "PROVIDER_CONFIRMED" && nextProviderRefundId) {
                const dupProviderTx = await tx.execute(sql`
                  SELECT id, transaction_type
                  FROM payment_transactions
                  WHERE provider = ${resolvedProvider}
                    AND provider_transaction_id = ${nextProviderRefundId}
                  LIMIT 1;
                `);
                if (dupProviderTx.rows.length > 0) {
                  throw AppError.conflict(
                    "Provider refund ID is already recorded on another payment or refund transaction"
                  );
                }

                const dupOtherRefund = await tx.execute(sql`
                  SELECT id
                  FROM refund_records
                  WHERE provider_refund_id = ${nextProviderRefundId}
                    AND id <> ${row.id}
                  LIMIT 1;
                `);
                if (dupOtherRefund.rows.length > 0) {
                  throw AppError.conflict(
                    "Provider refund ID is already assigned to another refund record"
                  );
                }
              }
            }
          }

          const [updated] = await tx
            .update(schema.refundRecords)
            .set({
              status: input.targetStatus,
              settlementMode: nextSettlementMode,
              providerRefundId: nextProviderRefundId,
              manualReference: nextManualReference,
              settledByUserId: nextSettledByUserId,
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

          if (input.targetStatus === "SUCCEEDED" && amountMinor > 0) {
            if (!row.payment_intent_id || !resolvedProvider) {
              throw AppError.conflict(
                "Missing payment intent or provider attribution for settled refund"
              );
            }

            if (nextSettlementMode === "PROVIDER_CONFIRMED") {
              await tx.insert(schema.paymentTransactions).values({
                paymentIntentId: row.payment_intent_id,
                bookingId: row.booking_id,
                refundId: row.id,
                provider: resolvedProvider,
                providerTransactionId: nextProviderRefundId!,
                transactionType: "REFUND",
                status: "SUCCEEDED",
                amountMinor,
                currency: row.currency,
                rawStatusCode: "REFUNDED",
                evidenceSource: "ADMIN_PROVIDER_ATTESTED",
                manualReference: null,
                settledByUserId: adminUserId,
                signatureVerified: false,
                metadata: {
                  refundId: row.id,
                  provider: resolvedProvider,
                  settlementMode: "PROVIDER_CONFIRMED"
                }
              });
            } else {
              await tx.insert(schema.paymentTransactions).values({
                paymentIntentId: row.payment_intent_id,
                bookingId: row.booking_id,
                refundId: row.id,
                provider: resolvedProvider,
                providerTransactionId: null,
                transactionType: "REFUND",
                status: "SUCCEEDED",
                amountMinor,
                currency: row.currency,
                rawStatusCode: "MANUAL_REFUNDED",
                evidenceSource: "ADMIN_MANUAL_OFFLINE",
                manualReference: nextManualReference!,
                settledByUserId: adminUserId,
                signatureVerified: false,
                metadata: {
                  refundId: row.id,
                  provider: resolvedProvider,
                  settlementMode: "MANUAL_OFFLINE",
                  manualReference: nextManualReference
                }
              });
            }

            await ledgerService.recordRefundDisbursed(tx, {
              bookingId: row.booking_id,
              businessId: bookingRow.business_id,
              refundId: row.id,
              amountMinor,
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
              settlementMode: nextSettlementMode ?? undefined,
              evidenceSource:
                input.targetStatus === "SUCCEEDED"
                  ? nextSettlementMode === "MANUAL_OFFLINE"
                    ? "ADMIN_MANUAL_OFFLINE"
                    : "ADMIN_PROVIDER_ATTESTED"
                  : undefined,
              amountMinor,
              currency: row.currency,
              adminNotes: input.notes
            },
            tx
          });

          return serializeRefundRow(updated);
        })
      );
    } catch (err) {
      const pgErr = err as { code?: string };
      if (pgErr?.code === "23505") {
        throw AppError.conflict(
          "Refund settlement conflicts with an existing provider transaction or refund reference"
        );
      }
      throw err;
    }
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
      settlementMode: (refund.settlementMode as RefundSettlementMode | null) ?? null,
      providerRefundId: refund.providerRefundId,
      manualReference: refund.manualReference,
      requestedByUserId: refund.requestedByUserId,
      authorizedByUserId: refund.authorizedByUserId,
      settledByUserId: refund.settledByUserId,
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
      refundId: tx.refundId ?? null,
      provider: tx.provider as PaymentTransactionRecord["provider"],
      providerTransactionId: tx.providerTransactionId ?? null,
      transactionType: tx.transactionType as PaymentTransactionRecord["transactionType"],
      status: tx.status as PaymentTransactionRecord["status"],
      amountMinor: tx.amountMinor,
      currency: tx.currency,
      evidenceSource: tx.evidenceSource as PaymentTransactionEvidenceSource,
      manualReference: tx.manualReference ?? null,
      settledByUserId: tx.settledByUserId ?? null,
      signatureVerified: tx.signatureVerified,
      createdAt: tx.createdAt.toISOString()
    }));

    return { transactions, total: countRes?.count ?? 0 };
  }
}

export const paymentsService = new PaymentsService();

