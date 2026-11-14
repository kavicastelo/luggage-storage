import crypto from "node:crypto";
import {
  PayHereCheckoutCustomerResolved,
  PayHereCheckoutCustomerResolvedSchema,
  PayHereCheckoutFormFieldsSchema,
  SandboxWebhookPayload,
  SandboxWebhookPayloadSchema
} from "@luggage-storage/contracts";
import { env } from "../../config/env.js";
import { AppError } from "../../common/errors/app-error.js";

const MAX_WEBHOOK_BODY_BYTES = 65_536;
const PG_INT_MAX = 2_147_483_647;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FORBIDDEN_OBJECT_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export interface CreateGatewayCheckoutParams {
  intentId: string;
  bookingId: string;
  referenceCode: string;
  providerOrderId: string;
  amountMinor: number;
  currency: string;
  customerEmail: string;
  customerName: string;
  customerDetails?: Partial<PayHereCheckoutCustomerResolved>;
}

export interface RawWebhookNotificationInput {
  rawBody: string;
  headers: Record<string, string | string[] | undefined>;
  contentType?: string;
}

export type NormalizedNotificationStatus =
  | "SUCCEEDED"
  | "FAILED"
  | "PENDING"
  | "CANCELLED"
  | "CHARGEDBACK";

export interface NormalizedGatewayNotification {
  provider: "SANDBOX_GATEWAY" | "PAYHERE";
  providerEventId: string;
  eventIdDerived: boolean;
  providerOrderId: string;
  merchantId?: string;
  paymentIntentId?: string;
  status: NormalizedNotificationStatus;
  rawStatusCode: string;
  amountMinor: number;
  currency: string;
  providerTransactionId?: string;
  providerTimestamp?: string;
  failureReason?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationIdentifiers {
  providerEventId?: string;
  providerOrderId?: string;
  paymentIntentId?: string;
}

export interface PaymentGatewayPort {
  readonly providerName: "SANDBOX_GATEWAY" | "PAYHERE";
  buildCheckoutPayload(params: CreateGatewayCheckoutParams): Record<string, unknown>;
  verifyNotificationSignature(input: RawWebhookNotificationInput): void;
  normalizeVerifiedNotification(input: RawWebhookNotificationInput): NormalizedGatewayNotification;
  verifyAndNormalizeNotification(input: RawWebhookNotificationInput): NormalizedGatewayNotification;
  extractNotificationIdentifiers(input: RawWebhookNotificationInput): NotificationIdentifiers;
}

/**
 * Formats an integer minor-unit amount as a two-decimal string using pure integer arithmetic
 * (avoids IEEE-754 floating-point rounding bugs).
 */
export function formatMinorAmountTwoDecimals(amountMinor: number): string {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > PG_INT_MAX) {
    throw AppError.badRequest("Payment minor-unit amount must be a positive 32-bit integer");
  }
  const whole = Math.floor(amountMinor / 100);
  const cents = amountMinor % 100;
  return `${whole}.${String(cents).padStart(2, "0")}`;
}

/**
 * Parses PayHere `^\d+\.\d{2}$` decimal strings into bounded integer minor units without parseFloat.
 */
export function parsePayHereDecimalAmountToMinor(rawAmount: string): number {
  const trimmed = rawAmount.trim();
  const match = /^(\d+)\.(\d{2})$/.exec(trimmed);
  if (!match) {
    throw AppError.badRequest(
      "Invalid PayHere amount format: expected exact decimal string with two fractional digits"
    );
  }
  const wholeBig = BigInt(match[1]);
  const fracBig = BigInt(match[2]);
  const minorBig = wholeBig * 100n + fracBig;
  if (minorBig <= 0n || minorBig > BigInt(PG_INT_MAX)) {
    throw AppError.badRequest("PayHere payment amount is outside supported integer minor-unit bounds");
  }
  return Number(minorBig);
}

function normalizeIsoCurrency(rawCurrency: string): string {
  const currency = rawCurrency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw AppError.badRequest("Invalid 3-letter ISO currency code in payment notification");
  }
  return currency;
}

function readSingleHeader(
  headers: Record<string, string | string[] | undefined>,
  targetName: string
): string | undefined {
  const lowerTarget = targetName.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerTarget) {
      if (Array.isArray(value)) {
        return value[0];
      }
      return value;
    }
  }
  return undefined;
}

function assertWebhookBodySize(rawBody: string): void {
  const byteLen = Buffer.byteLength(rawBody, "utf8");
  if (byteLen === 0) {
    throw AppError.badRequest("Empty payment webhook payload");
  }
  if (byteLen > MAX_WEBHOOK_BODY_BYTES) {
    throw AppError.badRequest("Payment webhook payload exceeds 64KB limit");
  }
}

/**
 * Signed Sandbox Gateway Adapter for local development and automated integration verification.
 * Uses HMAC-SHA256 signatures over canonical webhook payloads; disabled in production.
 */
export class SandboxSignedGatewayAdapter implements PaymentGatewayPort {
  readonly providerName = "SANDBOX_GATEWAY" as const;

  constructor(
    private readonly webhookSecret: string = env.PAYMENT_WEBHOOK_SECRET,
    private readonly nodeEnv: string = env.NODE_ENV
  ) {}

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

  normalizeVerifiedNotification(input: RawWebhookNotificationInput): NormalizedGatewayNotification {
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

  verifyAndNormalizeNotification(input: RawWebhookNotificationInput): NormalizedGatewayNotification {
    return this.normalizeVerifiedNotification(input);
  }

  extractNotificationIdentifiers(input: RawWebhookNotificationInput): NotificationIdentifiers {
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
}

/**
 * PayHere Gateway Adapter (ADR-008 / OQ-003).
 * Isolates all legacy MD5 computations strictly inside private helper methods (`payHereMd5Upper`)
 * per official PayHere checkout `hash` and `notify_url` `md5sig` specifications.
 * Commercial live usage remains gated pending written PayHere marketplace settlement confirmation (OQ-003).
 */
export class PayHereGatewayAdapter implements PaymentGatewayPort {
  readonly providerName = "PAYHERE" as const;

  constructor(
    private readonly merchantId: string,
    private readonly merchantSecret: string,
    private readonly sandboxMode: boolean,
    private readonly notifyUrl?: string,
    private readonly returnUrl?: string,
    private readonly cancelUrl?: string
  ) {}

  private payHereMd5Upper(value: string): string {
    return crypto.createHash("md5").update(value, "utf8").digest("hex").toUpperCase();
  }

  static computeNotifyMd5Sig(params: {
    merchantId: string;
    orderId: string;
    payhereAmount: string;
    payhereCurrency: string;
    statusCode: string;
    merchantSecret: string;
  }): string {
    const hashedSecret = crypto
      .createHash("md5")
      .update(params.merchantSecret, "utf8")
      .digest("hex")
      .toUpperCase();
    return crypto
      .createHash("md5")
      .update(
        `${params.merchantId}${params.orderId}${params.payhereAmount}${params.payhereCurrency}${params.statusCode}${hashedSecret}`,
        "utf8"
      )
      .digest("hex")
      .toUpperCase();
  }

  buildCheckoutPayload(params: CreateGatewayCheckoutParams): Record<string, unknown> {
    if (!this.notifyUrl || !this.returnUrl || !this.cancelUrl) {
      throw AppError.internal(
        "PayHere callback URLs (PAYHERE_NOTIFY_URL, PAYHERE_RETURN_URL, PAYHERE_CANCEL_URL) are not configured"
      );
    }

    const formattedAmount = formatMinorAmountTwoDecimals(params.amountMinor);
    const normalizedCurrency = normalizeIsoCurrency(params.currency);
    const hashedSecret = this.payHereMd5Upper(this.merchantSecret);
    const checkoutHash = this.payHereMd5Upper(
      `${this.merchantId}${params.providerOrderId}${formattedAmount}${normalizedCurrency}${hashedSecret}`
    );

    const nameParts = params.customerName.trim().split(/\s+/).filter(Boolean);
    const mergedFirstName = params.customerDetails?.firstName?.trim() || nameParts[0] || "";
    const mergedLastName =
      params.customerDetails?.lastName?.trim() ||
      (nameParts.length > 1 ? nameParts.slice(1).join(" ") : "");
    const mergedEmail = params.customerDetails?.email?.trim() || params.customerEmail.trim();
    const mergedPhone = params.customerDetails?.phone?.trim() || "";
    const mergedAddress = params.customerDetails?.address?.trim() || "";
    const mergedCity = params.customerDetails?.city?.trim() || "";
    const mergedCountry = params.customerDetails?.country?.trim() || "";

    const parsedCustomer = PayHereCheckoutCustomerResolvedSchema.safeParse({
      firstName: mergedFirstName,
      lastName: mergedLastName,
      email: mergedEmail,
      phone: mergedPhone,
      address: mergedAddress,
      city: mergedCity,
      country: mergedCountry
    });

    if (!parsedCustomer.success) {
      throw AppError.badRequest(
        "Complete customer billing details (firstName, lastName, email, phone, address, city, country) are required for PayHere checkout"
      );
    }

    const actionUrl = this.sandboxMode
      ? ("https://sandbox.payhere.lk/pay/checkout" as const)
      : ("https://www.payhere.lk/pay/checkout" as const);

    const fields = PayHereCheckoutFormFieldsSchema.parse({
      merchant_id: this.merchantId,
      return_url: this.returnUrl,
      cancel_url: this.cancelUrl,
      notify_url: this.notifyUrl,
      order_id: params.providerOrderId,
      items: `Luggage Storage Booking ${params.referenceCode}`,
      currency: normalizedCurrency,
      amount: formattedAmount,
      first_name: parsedCustomer.data.firstName,
      last_name: parsedCustomer.data.lastName,
      email: parsedCustomer.data.email,
      phone: parsedCustomer.data.phone,
      address: parsedCustomer.data.address,
      city: parsedCustomer.data.city,
      country: parsedCustomer.data.country,
      hash: checkoutHash,
      custom_1: params.intentId,
      custom_2: params.bookingId
    });

    return {
      mode: this.sandboxMode ? "PAYHERE_SANDBOX_REDIRECT" : "PAYHERE_LIVE_REDIRECT",
      actionUrl,
      ...fields
    };
  }

  private parseNotificationFields(input: RawWebhookNotificationInput): Record<string, string> {
    assertWebhookBodySize(input.rawBody);

    const mediaType = (input.contentType ?? "application/x-www-form-urlencoded")
      .split(";")[0]
      .trim()
      .toLowerCase();

    const fields: Record<string, string> = Object.create(null);

    if (mediaType === "application/json") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(input.rawBody);
      } catch {
        throw AppError.badRequest("Malformed JSON in PayHere webhook payload");
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw AppError.badRequest("PayHere JSON notification must be a flat key-value object");
      }
      for (const [key, val] of Object.entries(parsed)) {
        if (FORBIDDEN_OBJECT_KEYS.has(key)) {
          throw AppError.badRequest("Forbidden key in PayHere notification payload");
        }
        if (typeof val === "string") {
          fields[key] = val;
        } else if (typeof val === "number" && Number.isSafeInteger(val) && key === "status_code") {
          fields[key] = String(val);
        } else {
          throw AppError.badRequest(`Unsupported non-string field type for PayHere field "${key}"`);
        }
      }
      return fields;
    }

    if (mediaType !== "application/x-www-form-urlencoded") {
      throw AppError.badRequest("Unsupported PayHere webhook Content-Type");
    }

    const pairs = input.rawBody.split("&");
    for (const pair of pairs) {
      if (pair.length === 0) {
        continue;
      }
      const eqIdx = pair.indexOf("=");
      const rawKey = eqIdx >= 0 ? pair.slice(0, eqIdx) : pair;
      const rawValue = eqIdx >= 0 ? pair.slice(eqIdx + 1) : "";
      let decodedKey: string;
      let decodedValue: string;
      try {
        decodedKey = decodeURIComponent(rawKey.replace(/\+/g, " "));
        decodedValue = decodeURIComponent(rawValue.replace(/\+/g, " "));
      } catch {
        throw AppError.badRequest("Malformed URL-encoded sequence in PayHere webhook payload");
      }

      if (!decodedKey || FORBIDDEN_OBJECT_KEYS.has(decodedKey)) {
        throw AppError.badRequest("Invalid or forbidden form key in PayHere webhook payload");
      }
      if (Object.prototype.hasOwnProperty.call(fields, decodedKey)) {
        throw AppError.badRequest(`Duplicate parameter "${decodedKey}" rejected in PayHere webhook`);
      }
      fields[decodedKey] = decodedValue;
    }

    return fields;
  }

  private verifyFieldsAndComputeStatus(fields: Record<string, string>): {
    status: NormalizedNotificationStatus;
    amountMinor: number;
    currency: string;
    md5sigLower: string;
  } {
    const merchantId = fields.merchant_id;
    const orderId = fields.order_id;
    const payhereAmount = fields.payhere_amount;
    const payhereCurrency = fields.payhere_currency;
    const statusCode = fields.status_code;
    const md5sig = fields.md5sig;

    if (
      merchantId === undefined ||
      merchantId === "" ||
      orderId === undefined ||
      orderId === "" ||
      payhereAmount === undefined ||
      payhereAmount === "" ||
      payhereCurrency === undefined ||
      payhereCurrency === "" ||
      statusCode === undefined ||
      statusCode === "" ||
      md5sig === undefined ||
      md5sig === ""
    ) {
      throw AppError.unauthorized("Missing required PayHere notification signature fields");
    }

    if (merchantId.trim() !== this.merchantId) {
      throw AppError.unauthorized("PayHere merchant_id does not match configured merchant");
    }

    const md5sigTrimmed = md5sig.trim();
    if (!/^[0-9a-f]{32}$/i.test(md5sigTrimmed)) {
      throw AppError.unauthorized("Malformed PayHere md5sig signature format");
    }

    const hashedSecret = this.payHereMd5Upper(this.merchantSecret);
    const expectedLower = this.payHereMd5Upper(
      `${merchantId}${orderId}${payhereAmount}${payhereCurrency}${statusCode}${hashedSecret}`
    ).toLowerCase();
    const providedLower = md5sigTrimmed.toLowerCase();

    const expectedBuf = Buffer.from(expectedLower, "hex");
    const providedBuf = Buffer.from(providedLower, "hex");
    if (
      expectedBuf.length !== providedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, providedBuf)
    ) {
      throw AppError.unauthorized("Invalid PayHere md5sig cryptographic signature");
    }

    let status: NormalizedNotificationStatus;
    switch (statusCode.trim()) {
      case "2":
        status = "SUCCEEDED";
        break;
      case "0":
        status = "PENDING";
        break;
      case "-1":
        status = "CANCELLED";
        break;
      case "-2":
        status = "FAILED";
        break;
      case "-3":
        status = "CHARGEDBACK";
        break;
      default:
        throw AppError.badRequest(`Unsupported PayHere status_code "${statusCode}"`);
    }

    const amountMinor = parsePayHereDecimalAmountToMinor(payhereAmount);
    const currency = normalizeIsoCurrency(payhereCurrency);

    return {
      status,
      amountMinor,
      currency,
      md5sigLower: providedLower
    };
  }

  verifyNotificationSignature(input: RawWebhookNotificationInput): void {
    const fields = this.parseNotificationFields(input);
    this.verifyFieldsAndComputeStatus(fields);
  }

  normalizeVerifiedNotification(input: RawWebhookNotificationInput): NormalizedGatewayNotification {
    const fields = this.parseNotificationFields(input);
    const verified = this.verifyFieldsAndComputeStatus(fields);

    const providerOrderId = fields.order_id.trim();
    if (!providerOrderId || providerOrderId.length > 128) {
      throw AppError.badRequest("Invalid PayHere order_id length");
    }

    const providerTransactionId =
      fields.payment_id && fields.payment_id.trim().length > 0
        ? fields.payment_id.trim().slice(0, 128)
        : undefined;

    const rawCustom1 = fields.custom_1?.trim();
    const paymentIntentId = rawCustom1 && UUID_REGEX.test(rawCustom1) ? rawCustom1 : undefined;

    const canonicalEventKey = JSON.stringify([
      fields.merchant_id,
      providerOrderId,
      providerTransactionId ?? "",
      fields.status_code.trim(),
      fields.payhere_amount.trim(),
      verified.currency,
      verified.md5sigLower
    ]);
    const digest = crypto.createHash("sha256").update(canonicalEventKey, "utf8").digest("hex");
    const providerEventId = `payhere_evt_${digest.slice(0, 48)}`;

    const rawMessage = fields.status_message?.trim();

    return {
      provider: "PAYHERE",
      providerEventId,
      eventIdDerived: true,
      providerOrderId,
      merchantId: fields.merchant_id.trim(),
      paymentIntentId,
      status: verified.status,
      rawStatusCode: fields.status_code.trim(),
      amountMinor: verified.amountMinor,
      currency: verified.currency,
      providerTransactionId,
      failureReason:
        verified.status === "FAILED" ||
        verified.status === "CANCELLED" ||
        verified.status === "CHARGEDBACK"
          ? rawMessage || `PayHere status_code=${fields.status_code.trim()}`
          : undefined,
      metadata: {
        method: fields.method?.trim(),
        statusMessage: rawMessage,
        recurring: fields.recurring?.trim(),
        eventIdDerived: true
      }
    };
  }

  verifyAndNormalizeNotification(input: RawWebhookNotificationInput): NormalizedGatewayNotification {
    return this.normalizeVerifiedNotification(input);
  }

  extractNotificationIdentifiers(input: RawWebhookNotificationInput): NotificationIdentifiers {
    try {
      const fields = this.parseNotificationFields(input);
      const custom1 = fields.custom_1?.trim();
      return {
        providerOrderId: fields.order_id ? fields.order_id.trim().slice(0, 128) : undefined,
        paymentIntentId: custom1 && UUID_REGEX.test(custom1) ? custom1 : undefined
      };
    } catch {
      return {};
    }
  }
}

export function resolveSandboxGatewayAdapter(): SandboxSignedGatewayAdapter {
  return new SandboxSignedGatewayAdapter(env.PAYMENT_WEBHOOK_SECRET, env.NODE_ENV);
}

export function resolvePayHereGatewayAdapter(): PayHereGatewayAdapter {
  if (
    !env.PAYHERE_MERCHANT_ID ||
    !env.PAYHERE_MERCHANT_SECRET ||
    !env.PAYHERE_NOTIFY_URL ||
    !env.PAYHERE_RETURN_URL ||
    !env.PAYHERE_CANCEL_URL
  ) {
    throw AppError.internal(
      "PayHere gateway credentials or callback URLs (PAYHERE_NOTIFY_URL, PAYHERE_RETURN_URL, PAYHERE_CANCEL_URL) are not configured"
    );
  }
  return new PayHereGatewayAdapter(
    env.PAYHERE_MERCHANT_ID,
    env.PAYHERE_MERCHANT_SECRET,
    env.PAYHERE_SANDBOX_MODE,
    env.PAYHERE_NOTIFY_URL,
    env.PAYHERE_RETURN_URL,
    env.PAYHERE_CANCEL_URL
  );
}

export function resolvePaymentGatewayAdapter(): PaymentGatewayPort {
  if (env.PAYMENT_PROVIDER === "payhere") {
    return resolvePayHereGatewayAdapter();
  }
  return resolveSandboxGatewayAdapter();
}

