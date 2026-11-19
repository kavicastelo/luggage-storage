import crypto from "node:crypto";
import {
  PaymentCheckoutChannel,
  PayHereCheckoutCustomerResolved,
  PayHereCheckoutCustomerResolvedSchema,
  PayHereCheckoutFormFieldsSchema,
  PayHereNativeSdkPayloadSchema
} from "@luggage-storage/contracts";
import { AppError } from "../../../common/errors/app-error.js";
import {
  assertWebhookBodySize,
  CreateGatewayCheckoutParams,
  formatMinorAmountTwoDecimals,
  normalizeIsoCurrency,
  NormalizedGatewayNotification,
  NormalizedNotificationStatus,
  NotificationIdentifiers,
  parsePayHereDecimalAmountToMinor,
  PaymentGatewayPort,
  PaymentProviderCapabilities,
  RawWebhookNotificationInput
} from "../payment-gateway.port.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FORBIDDEN_OBJECT_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function parsePayHereNotificationFields(
  input: RawWebhookNotificationInput
): Record<string, string> {
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

/**
 * PayHere Gateway Adapter (Historical / Legacy).
 * PayHere is permanently retired as an active checkout gateway.
 * Kept for historical verification and backward-compatibility with existing unit tests.
 */
export class PayHereGatewayAdapter implements PaymentGatewayPort {
  readonly providerName = "PAYHERE" as const;

  constructor(
    private readonly merchantId: string,
    private readonly merchantSecret: string,
    private readonly sandboxMode: boolean,
    private readonly channel: PaymentCheckoutChannel = "WEB",
    private readonly notifyUrl?: string,
    private readonly returnUrl?: string,
    private readonly cancelUrl?: string,
    private readonly androidPackageName?: string
  ) {}

  getCapabilities(): PaymentProviderCapabilities {
    return {
      supportsAutomaticCapture: false,
      supportsPartialRefunds: false,
      supportsDisputes: false,
      supportsWebhooks: true,
      supportedCurrencies: ["LKR"],
      supportedPaymentMethods: ["payhere_legacy"]
    };
  }

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

  static extractUntrustedWebhookLookup(input: RawWebhookNotificationInput): NotificationIdentifiers {
    const fields = parsePayHereNotificationFields(input);
    const rawOrderId = typeof fields.order_id === "string" ? fields.order_id.trim() : "";
    const providerOrderId =
      rawOrderId.length > 0 && rawOrderId.length <= 128 ? rawOrderId : undefined;
    const custom1 = typeof fields.custom_1 === "string" ? fields.custom_1.trim() : "";
    const paymentIntentId = UUID_REGEX.test(custom1) ? custom1 : undefined;
    return {
      providerOrderId,
      paymentIntentId
    };
  }

  buildCheckoutPayload(params: CreateGatewayCheckoutParams): Record<string, unknown> {
    const effectiveChannel = params.channel ?? this.channel;
    if (effectiveChannel !== this.channel) {
      throw AppError.internal(
        `PayHere gateway adapter channel mismatch: expected ${this.channel}, got ${effectiveChannel}`
      );
    }

    if (!this.notifyUrl) {
      throw AppError.internal("PayHere notification URL (PAYHERE_NOTIFY_URL) is not configured");
    }

    const formattedAmount = formatMinorAmountTwoDecimals(params.amountMinor);
    const normalizedCurrency = normalizeIsoCurrency(params.currency);

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

    if (this.channel === "MOBILE_APP") {
      if (!this.androidPackageName) {
        throw AppError.internal(
          "PayHere Android application package (PAYHERE_ANDROID_PACKAGE_NAME) is not configured"
        );
      }

      const sdkPayload = PayHereNativeSdkPayloadSchema.parse({
        sandbox: this.sandboxMode,
        merchant_id: this.merchantId,
        notify_url: this.notifyUrl,
        order_id: params.providerOrderId,
        items: `Luggage Storage Booking ${params.referenceCode}`,
        amount: formattedAmount,
        currency: normalizedCurrency,
        first_name: parsedCustomer.data.firstName,
        last_name: parsedCustomer.data.lastName,
        email: parsedCustomer.data.email,
        phone: parsedCustomer.data.phone,
        address: parsedCustomer.data.address,
        city: parsedCustomer.data.city,
        country: parsedCustomer.data.country,
        custom_1: params.intentId,
        custom_2: params.referenceCode
      });

      return {
        mode: this.sandboxMode ? "PAYHERE_NATIVE_SANDBOX" : "PAYHERE_NATIVE_LIVE",
        channel: "MOBILE_APP",
        androidPackageName: this.androidPackageName,
        sdkPayload
      };
    }

    if (!this.returnUrl || !this.cancelUrl) {
      throw AppError.internal(
        "PayHere callback URLs (PAYHERE_NOTIFY_URL, PAYHERE_RETURN_URL, PAYHERE_CANCEL_URL) are not configured"
      );
    }

    const hashedSecret = this.payHereMd5Upper(this.merchantSecret);
    const checkoutHash = this.payHereMd5Upper(
      `${this.merchantId}${params.providerOrderId}${formattedAmount}${normalizedCurrency}${hashedSecret}`
    );

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
      channel: "WEB",
      actionUrl,
      ...fields
    };
  }

  private parseNotificationFields(input: RawWebhookNotificationInput): Record<string, string> {
    return parsePayHereNotificationFields(input);
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

  normalizeVerifiedNotification(
    input: RawWebhookNotificationInput
  ): NormalizedGatewayNotification {
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

  verifyAndNormalizeNotification(
    input: RawWebhookNotificationInput
  ): NormalizedGatewayNotification {
    return this.normalizeVerifiedNotification(input);
  }

  extractNotificationIdentifiers(
    input: RawWebhookNotificationInput
  ): NotificationIdentifiers {
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

