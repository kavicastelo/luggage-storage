import Stripe from "stripe";
import { AppError } from "../../../common/errors/app-error.js";
import {
  CreateGatewayCheckoutParams,
  CreateProviderRefundParams,
  NormalizedGatewayNotification,
  NormalizedNotificationStatus,
  NotificationIdentifiers,
  PaymentGatewayPort,
  PaymentProviderCapabilities,
  ProviderRefundResult,
  RawWebhookNotificationInput,
  readSingleHeader
} from "../payment-gateway.port.js";

export class StripeGatewayAdapter implements PaymentGatewayPort {
  readonly providerName = "STRIPE" as const;
  private readonly stripeInstance?: Stripe;

  constructor(
    private readonly secretKey?: string,
    private readonly publishableKey?: string,
    private readonly webhookSecret?: string
  ) {
    if (this.secretKey) {
      this.stripeInstance = new Stripe(this.secretKey, {
        apiVersion: "2025-02-24.acacia" as any
      });
    }
  }

  get stripe(): Stripe {
    if (!this.stripeInstance) {
      throw AppError.internal("Stripe secret key (STRIPE_SECRET_KEY) is not configured");
    }
    return this.stripeInstance;
  }

  getCapabilities(): PaymentProviderCapabilities {
    return {
      supportsAutomaticCapture: true,
      supportsPartialRefunds: true,
      supportsDisputes: true,
      supportsWebhooks: true,
      supportedCurrencies: ["USD", "EUR", "GBP", "LKR", "AUD", "CAD", "SGD", "JPY"],
      supportedPaymentMethods: ["card", "link", "apple_pay", "google_pay"]
    };
  }

  async buildCheckoutPayload(
    params: CreateGatewayCheckoutParams
  ): Promise<Record<string, unknown>> {
    if (!this.publishableKey) {
      throw AppError.internal("Stripe publishable key (STRIPE_PUBLISHABLE_KEY) is not configured");
    }

    const paymentIntent = await this.stripe.paymentIntents.create(
      {
        amount: params.amountMinor,
        currency: params.currency.toLowerCase(),
        description: `Luggage Storage - ${params.referenceCode}`,
        metadata: {
          intentId: params.intentId,
          bookingId: params.bookingId,
          referenceCode: params.referenceCode,
          providerOrderId: params.providerOrderId,
          customerEmail: params.customerEmail
        },
        automatic_payment_methods: {
          enabled: true
        }
      },
      {
        idempotencyKey: `pi_${params.intentId}`
      }
    );

    return {
      mode: "STRIPE_ELEMENTS",
      provider: "STRIPE",
      clientSecret: paymentIntent.client_secret,
      publishableKey: this.publishableKey,
      paymentIntentId: paymentIntent.id
    };
  }

  verifyNotificationSignature(input: RawWebhookNotificationInput): Stripe.Event {
    if (!this.webhookSecret) {
      throw AppError.internal("Stripe webhook signing secret (STRIPE_WEBHOOK_SECRET) is not configured");
    }

    const signature = readSingleHeader(input.headers, "stripe-signature");
    if (!signature) {
      throw AppError.unauthorized("Missing stripe-signature header");
    }

    try {
      return this.stripe.webhooks.constructEvent(input.rawBody, signature, this.webhookSecret);
    } catch (err: any) {
      throw AppError.unauthorized(`Invalid Stripe webhook cryptographic signature: ${err.message}`);
    }
  }

  normalizeVerifiedNotification(
    input: RawWebhookNotificationInput
  ): NormalizedGatewayNotification {
    const event = this.verifyNotificationSignature(input);
    return this.normalizeEvent(event);
  }

  verifyAndNormalizeNotification(
    input: RawWebhookNotificationInput
  ): NormalizedGatewayNotification {
    return this.normalizeVerifiedNotification(input);
  }

  normalizeEvent(event: Stripe.Event): NormalizedGatewayNotification {
    const eventObj = event.data.object as unknown as Record<string, unknown>;
    const metadata = (eventObj.metadata ?? {}) as Record<string, string>;
    const paymentIntentId = metadata.intentId;
    const providerOrderId = metadata.providerOrderId || (eventObj.id as string);

    let status: NormalizedNotificationStatus = "PENDING";
    let failureReason: string | undefined;
    let providerTransactionId: string | undefined;

    switch (event.type) {
      case "payment_intent.succeeded": {
        status = "SUCCEEDED";
        const pi = eventObj as unknown as Stripe.PaymentIntent;
        providerTransactionId =
          typeof pi.latest_charge === "string"
            ? pi.latest_charge
            : ((pi.latest_charge as any)?.id ?? pi.id);
        break;
      }
      case "payment_intent.payment_failed": {
        status = "FAILED";
        const pi = eventObj as unknown as Stripe.PaymentIntent;
        failureReason = pi.last_payment_error?.message ?? "Payment failed";
        break;
      }
      case "payment_intent.canceled": {
        status = "CANCELLED";
        failureReason = "Payment was cancelled";
        break;
      }
      case "charge.dispute.created": {
        status = "CHARGEDBACK";
        failureReason = "Charge disputed by cardholder";
        break;
      }
      default:
        break;
    }

    const amountMinor = typeof eventObj.amount === "number" ? eventObj.amount : 0;
    const currency =
      typeof eventObj.currency === "string" ? eventObj.currency.toUpperCase() : "USD";

    return {
      provider: "STRIPE",
      providerEventId: event.id,
      eventIdDerived: false,
      providerOrderId,
      paymentIntentId,
      status,
      rawStatusCode: event.type,
      amountMinor,
      currency,
      providerTransactionId,
      providerTimestamp: new Date(event.created * 1000).toISOString(),
      failureReason,
      metadata: {
        stripeEventType: event.type,
        stripeLivemode: event.livemode
      }
    };
  }

  extractNotificationIdentifiers(
    input: RawWebhookNotificationInput
  ): NotificationIdentifiers {
    try {
      const obj = JSON.parse(input.rawBody);
      const dataObj = obj?.data?.object;
      const metadata = dataObj?.metadata;
      return {
        providerEventId: typeof obj?.id === "string" ? obj.id.slice(0, 128) : undefined,
        providerOrderId:
          typeof metadata?.providerOrderId === "string"
            ? metadata.providerOrderId.slice(0, 128)
            : typeof dataObj?.id === "string"
            ? dataObj.id.slice(0, 128)
            : undefined,
        paymentIntentId: typeof metadata?.intentId === "string" ? metadata.intentId : undefined
      };
    } catch {
      return {};
    }
  }

  async createRefund(params: CreateProviderRefundParams): Promise<ProviderRefundResult> {
    const isCharge =
      params.providerTransactionId.startsWith("ch_") ||
      params.providerTransactionId.startsWith("py_");

    const refund = await this.stripe.refunds.create(
      {
        charge: isCharge ? params.providerTransactionId : undefined,
        payment_intent:
          !isCharge && params.providerTransactionId.startsWith("pi_")
            ? params.providerTransactionId
            : undefined,
        amount: params.amountMinor,
        reason: "requested_by_customer"
      },
      {
        idempotencyKey: `ref_${params.refundId}`
      }
    );

    return {
      providerRefundId: refund.id,
      status:
        refund.status === "succeeded"
          ? "SUCCEEDED"
          : refund.status === "pending"
          ? "PENDING"
          : "FAILED",
      amountMinor: refund.amount,
      currency: refund.currency.toUpperCase(),
      rawResponse: refund as unknown as Record<string, unknown>
    };
  }
}
