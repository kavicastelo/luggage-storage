import crypto from "node:crypto";
import { SandboxWebhookPayload, SandboxWebhookPayloadSchema } from "@luggage-storage/contracts";
import { env } from "../../config/env.js";
import { AppError } from "../../common/errors/app-error.js";

export interface CreateGatewayCheckoutParams {
  intentId: string;
  bookingId: string;
  referenceCode: string;
  providerOrderId: string;
  amountMinor: number;
  currency: string;
  customerEmail: string;
  customerName: string;
}

export interface PaymentGatewayPort {
  readonly providerName: "SANDBOX_GATEWAY" | "PAYHERE";
  buildCheckoutPayload(params: CreateGatewayCheckoutParams): Record<string, unknown>;
}

/**
 * Signed Sandbox Gateway Adapter for local development and automated integration verification.
 * Uses HMAC-SHA256 signatures over canonical webhook payloads; never accepts unsigned client claims.
 */
export class SandboxSignedGatewayAdapter implements PaymentGatewayPort {
  readonly providerName = "SANDBOX_GATEWAY" as const;

  constructor(private readonly webhookSecret: string = env.PAYMENT_WEBHOOK_SECRET) {}

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
    return crypto.createHmac("sha256", this.webhookSecret).update(rawPayload, "utf8").digest("hex");
  }

  verifyAndParseWebhook(rawPayload: string, providedSignature?: string): SandboxWebhookPayload {
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

    return parsed.data;
  }
}

/**
 * Config-Gated PayHere Gateway Adapter (ADR-008 / OQ-003).
 * Isolates PayHere checkout form parameters and md5sig notification verification behind PaymentGatewayPort.
 * Commercial live usage remains gated pending written PayHere marketplace settlement confirmation (OQ-003).
 */
export class PayHereGatewayAdapter implements PaymentGatewayPort {
  readonly providerName = "PAYHERE" as const;

  constructor(
    private readonly merchantId: string,
    private readonly merchantSecret: string,
    private readonly sandboxMode: boolean
  ) {}

  buildCheckoutPayload(params: CreateGatewayCheckoutParams): Record<string, unknown> {
    const formattedAmount = (params.amountMinor / 100).toFixed(2);
    const hashedSecret = crypto
      .createHash("md5")
      .update(this.merchantSecret)
      .digest("hex")
      .toUpperCase();
    const checkoutHash = crypto
      .createHash("md5")
      .update(
        `${this.merchantId}${params.providerOrderId}${formattedAmount}${params.currency}${hashedSecret}`
      )
      .digest("hex")
      .toUpperCase();

    return {
      mode: this.sandboxMode ? "PAYHERE_SANDBOX_REDIRECT" : "PAYHERE_LIVE_REDIRECT",
      actionUrl: this.sandboxMode
        ? "https://sandbox.payhere.lk/pay/checkout"
        : "https://www.payhere.lk/pay/checkout",
      merchant_id: this.merchantId,
      order_id: params.providerOrderId,
      items: `Luggage Storage Booking ${params.referenceCode}`,
      currency: params.currency,
      amount: formattedAmount,
      hash: checkoutHash
    };
  }
}

export function resolvePaymentGatewayAdapter(): PaymentGatewayPort {
  if (env.PAYMENT_PROVIDER === "payhere") {
    if (!env.PAYHERE_MERCHANT_ID || !env.PAYHERE_MERCHANT_SECRET) {
      throw AppError.internal("PayHere gateway credentials are not configured");
    }
    return new PayHereGatewayAdapter(
      env.PAYHERE_MERCHANT_ID,
      env.PAYHERE_MERCHANT_SECRET,
      env.PAYHERE_SANDBOX_MODE
    );
  }
  return new SandboxSignedGatewayAdapter(env.PAYMENT_WEBHOOK_SECRET);
}

