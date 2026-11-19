import crypto from "node:crypto";
import { SandboxWebhookPayload, SandboxWebhookPayloadSchema } from "@luggage-storage/contracts";
import { AppError } from "../../../common/errors/app-error.js";
import {
  assertWebhookBodySize,
  CreateGatewayCheckoutParams,
  CreateProviderRefundParams,
  normalizeIsoCurrency,
  NormalizedGatewayNotification,
  NotificationIdentifiers,
  PaymentGatewayPort,
  PaymentProviderCapabilities,
  ProviderRefundResult,
  RawWebhookNotificationInput,
  readSingleHeader
} from "../payment-gateway.port.js";

const PG_INT_MAX = 2_147_483_647;

export class SandboxSignedGatewayAdapter implements PaymentGatewayPort {
  readonly providerName = "SANDBOX_GATEWAY" as const;

  constructor(
    private readonly webhookSecret: string,
    private readonly nodeEnv: string
  ) {}

  getCapabilities(): PaymentProviderCapabilities {
    return {
      supportsAutomaticCapture: true,
      supportsPartialRefunds: true,
      supportsDisputes: true,
      supportsWebhooks: true,
      supportedCurrencies: ["LKR", "USD", "EUR", "GBP", "AUD", "CAD", "SGD", "JPY"],
      supportedPaymentMethods: ["sandbox_simulated"]
    };
  }

  buildCheckoutPayload(params: CreateGatewayCheckoutParams): Record<string, unknown> {
    return {
      mode: "SANDBOX_SIGNED_CHECKOUT",
      intentId: params.intentId,
      providerOrderId: params.providerOrderId,
      bookingReference: params.referenceCode,
      amountMinor: params.amountMinor,
      currency: params.currency,
      disclosure:
        "Sandbox payment gateway active. Booking confirms strictly after server-side HMAC webhook verification."
    };
  }

  signWebhookPayload(rawPayload: string): string {
    return crypto
      .createHmac("sha256", this.webhookSecret)
      .update(rawPayload, "utf8")
      .digest("hex");
  }

  verifyAndParseWebhook(rawPayload: string, providedSignature?: string): SandboxWebhookPayload {
    if (this.nodeEnv === "production") {
      throw AppError.forbidden("Sandbox payment gateway webhooks are disabled in production");
    }
    assertWebhookBodySize(rawPayload);

    if (!providedSignature || !/^[0-9a-f]{64}$/i.test(providedSignature.trim())) {
      throw AppError.unauthorized("Missing or malformed payment webhook HMAC signature");
    }

    const expectedHex = this.signWebhookPayload(rawPayload);
    const expectedBuf = Buffer.from(expectedHex, "hex");
    const providedBuf = Buffer.from(providedSignature.trim().toLowerCase(), "hex");

    if (
      expectedBuf.length !== providedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, providedBuf)
    ) {
      throw AppError.unauthorized("Invalid payment webhook cryptographic signature");
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawPayload);
    } catch {
      throw AppError.badRequest("Malformed JSON in payment webhook payload");
    }

    const parsed = SandboxWebhookPayloadSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw AppError.badRequest("Invalid payment webhook payload schema");
    }
    if (parsed.data.amountMinor > PG_INT_MAX) {
      throw AppError.badRequest("Webhook payment amount exceeds supported integer bounds");
    }

    return parsed.data;
  }

  verifyNotificationSignature(input: RawWebhookNotificationInput): void {
    const signature = readSingleHeader(input.headers, "x-sandbox-signature");
    this.verifyAndParseWebhook(input.rawBody, signature);
  }

  normalizeVerifiedNotification(
    input: RawWebhookNotificationInput
  ): NormalizedGatewayNotification {
    const signature = readSingleHeader(input.headers, "x-sandbox-signature");
    const verified = this.verifyAndParseWebhook(input.rawBody, signature);

    return {
      provider: "SANDBOX_GATEWAY",
      providerEventId: verified.eventId,
      eventIdDerived: false,
      providerOrderId: verified.providerOrderId,
      status: verified.status,
      rawStatusCode: verified.status,
      amountMinor: verified.amountMinor,
      currency: normalizeIsoCurrency(verified.currency),
      providerTransactionId: verified.providerTransactionId,
      providerTimestamp: new Date(verified.timestamp * 1000).toISOString(),
      failureReason: verified.failureReason,
      metadata: {
        sandboxVerified: true
      }
    };
  }

  verifyAndNormalizeNotification(
    input: RawWebhookNotificationInput
  ): NormalizedGatewayNotification {
    return this.normalizeVerifiedNotification(input);
  }

  extractNotificationIdentifiers(
    input: RawWebhookNotificationInput
  ): NotificationIdentifiers {
    try {
      const obj = JSON.parse(input.rawBody) as Record<string, unknown> | null;
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
        return {};
      }
      return {
        providerEventId:
          typeof obj.eventId === "string" ? obj.eventId.slice(0, 128) : undefined,
        providerOrderId:
          typeof obj.providerOrderId === "string" ? obj.providerOrderId.slice(0, 128) : undefined
      };
    } catch {
      return {};
    }
  }

  async createRefund(params: CreateProviderRefundParams): Promise<ProviderRefundResult> {
    const providerRefundId = `sbox_ref_${crypto.randomBytes(8).toString("hex")}`;
    return {
      providerRefundId,
      status: "SUCCEEDED",
      amountMinor: params.amountMinor,
      currency: params.currency,
      rawResponse: {
        simulated: true,
        refundId: providerRefundId,
        timestamp: new Date().toISOString()
      }
    };
  }
}

