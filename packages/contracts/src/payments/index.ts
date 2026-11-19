import { z } from "zod";

// ============================================================================
// Enums & Constants
// ============================================================================

export const PAYMENT_PROVIDERS = [
  "STRIPE",
  "PAYPAL",
  "SANDBOX_GATEWAY",
  "PAYHERE"
] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];
export const PaymentProviderSchema = z.enum(PAYMENT_PROVIDERS);

export const PAYMENT_INTENT_STATUSES = [
  "INITIATED",
  "PENDING_GATEWAY",
  "SUCCEEDED",
  "FAILED",
  "EXPIRED",
  "ORPHANED_SUCCEEDED"
] as const;
export type PaymentIntentStatus = (typeof PAYMENT_INTENT_STATUSES)[number];
export const PaymentIntentStatusSchema = z.enum(PAYMENT_INTENT_STATUSES);

export const REFUND_STATUSES = [
  "REQUESTED",
  "AUTHORIZED",
  "INITIATED",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "MANUAL_REVIEW_REQUIRED"
] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];
export const RefundStatusSchema = z.enum(REFUND_STATUSES);

export const REFUND_REASON_CATEGORIES = [
  "TRAVELLER_CANCELLATION",
  "HOST_CANCELLATION",
  "PLATFORM_CANCELLATION",
  "LATE_WEBHOOK_EXPIRED_HOLD",
  "DISPUTE_RESOLUTION"
] as const;
export type RefundReasonCategory = (typeof REFUND_REASON_CATEGORIES)[number];
export const RefundReasonCategorySchema = z.enum(REFUND_REASON_CATEGORIES);

export const PAYMENT_CHECKOUT_CHANNELS = ["WEB", "MOBILE_APP"] as const;
export type PaymentCheckoutChannel = (typeof PAYMENT_CHECKOUT_CHANNELS)[number];
export const PaymentCheckoutChannelSchema = z.enum(PAYMENT_CHECKOUT_CHANNELS);

export const PAYMENT_NEXT_ACTIONS = [
  "SANDBOX_SIMULATION",
  "REDIRECT_TO_PROVIDER",
  "LAUNCH_NATIVE_SDK",
  "STRIPE_ELEMENTS_CONFIRM",
  "STRIPE_CHECKOUT_REDIRECT",
  "PAYPAL_CHECKOUT_APPROVE"
] as const;
export type PaymentNextAction = (typeof PAYMENT_NEXT_ACTIONS)[number];
export const PaymentNextActionSchema = z.enum(PAYMENT_NEXT_ACTIONS);

export const REFUND_SETTLEMENT_MODES = ["PROVIDER_CONFIRMED", "MANUAL_OFFLINE"] as const;
export type RefundSettlementMode = (typeof REFUND_SETTLEMENT_MODES)[number];
export const RefundSettlementModeSchema = z.enum(REFUND_SETTLEMENT_MODES);

export const PAYMENT_TRANSACTION_EVIDENCE_SOURCES = [
  "PROVIDER_WEBHOOK",
  "SANDBOX_SIMULATOR",
  "ADMIN_PROVIDER_ATTESTED",
  "ADMIN_MANUAL_OFFLINE"
] as const;
export type PaymentTransactionEvidenceSource =
  (typeof PAYMENT_TRANSACTION_EVIDENCE_SOURCES)[number];
export const PaymentTransactionEvidenceSourceSchema = z.enum(
  PAYMENT_TRANSACTION_EVIDENCE_SOURCES
);

// ============================================================================
// Payment Intent & Webhook Schemas
// ============================================================================

export const CheckoutCustomerDetailsSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    email: z.string().trim().email().max(255).optional(),
    phone: z.string().trim().min(6).max(32).optional(),
    address: z.string().trim().min(3).max(200).optional(),
    city: z.string().trim().min(1).max(80).optional(),
    country: z.string().trim().min(2).max(80).optional()
  })
  .strict();
export type CheckoutCustomerDetails = z.infer<typeof CheckoutCustomerDetailsSchema>;

export const PayHereCheckoutCustomerResolvedSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(6).max(32),
  address: z.string().trim().min(3).max(200),
  city: z.string().trim().min(1).max(80),
  country: z.string().trim().min(2).max(80)
});
export type PayHereCheckoutCustomerResolved = z.infer<
  typeof PayHereCheckoutCustomerResolvedSchema
>;

export const CreatePaymentIntentRequestSchema = z
  .object({
    bookingId: z.string().uuid(),
    channel: PaymentCheckoutChannelSchema.optional(),
    provider: PaymentProviderSchema.optional(),
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
    customerDetails: CheckoutCustomerDetailsSchema.optional()
  })
  .strict();
export type CreatePaymentIntentRequest = z.infer<typeof CreatePaymentIntentRequestSchema>;

export const PayHereCheckoutFormFieldsSchema = z
  .object({
    merchant_id: z.string().trim().min(1),
    return_url: z.string().url(),
    cancel_url: z.string().url(),
    notify_url: z.string().url(),
    order_id: z.string().trim().min(1).max(128),
    items: z.string().trim().min(1).max(255),
    currency: z.string().regex(/^[A-Z]{3}$/),
    amount: z.string().regex(/^\d+\.\d{2}$/),
    first_name: z.string().trim().min(1).max(80),
    last_name: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(255),
    phone: z.string().trim().min(6).max(32),
    address: z.string().trim().min(3).max(200),
    city: z.string().trim().min(1).max(80),
    country: z.string().trim().min(2).max(80),
    hash: z.string().regex(/^[0-9A-F]{32}$/),
    custom_1: z.string().uuid().optional(),
    custom_2: z.string().uuid().optional()
  })
  .strict();
export type PayHereCheckoutFormFields = z.infer<typeof PayHereCheckoutFormFieldsSchema>;

export const SandboxCheckoutHandoffSchema = z.object({
  mode: z.literal("SANDBOX_SIMULATION"),
  provider: z.literal("SANDBOX_GATEWAY"),
  method: z.literal("SIMULATED_API"),
  intentId: z.string().uuid(),
  orderId: z.string().min(1),
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3)
});
export type SandboxCheckoutHandoff = z.infer<typeof SandboxCheckoutHandoffSchema>;

export const PayHereWebCheckoutHandoffSchema = z.object({
  mode: z.enum(["PAYHERE_SANDBOX_REDIRECT", "PAYHERE_LIVE_REDIRECT"]),
  provider: z.literal("PAYHERE"),
  method: z.literal("POST_FORM"),
  actionUrl: z.enum([
    "https://sandbox.payhere.lk/pay/checkout",
    "https://www.payhere.lk/pay/checkout"
  ]),
  fields: PayHereCheckoutFormFieldsSchema
});
export type PayHereWebCheckoutHandoff = z.infer<typeof PayHereWebCheckoutHandoffSchema>;

export const PayHereCheckoutHandoffSchema = PayHereWebCheckoutHandoffSchema;

export const PayHereNativeSdkPayloadSchema = z
  .object({
    sandbox: z.boolean(),
    merchant_id: z.string().min(1),
    notify_url: z.string().url(),
    order_id: z.string().min(1),
    items: z.string().min(1),
    amount: z.string().regex(/^\d+\.\d{2}$/),
    currency: z.string().length(3),
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(3),
    address: z.string().min(1),
    city: z.string().min(1),
    country: z.string().min(1),
    custom_1: z.string().min(1).optional(),
    custom_2: z.string().min(1).optional()
  })
  .strict();
export type PayHereNativeSdkPayload = z.infer<typeof PayHereNativeSdkPayloadSchema>;

export const PayHereNativeCheckoutHandoffSchema = z.object({
  mode: z.enum(["PAYHERE_NATIVE_SANDBOX", "PAYHERE_NATIVE_LIVE"]),
  provider: z.literal("PAYHERE"),
  method: z.literal("NATIVE_SDK"),
  sdkPayload: PayHereNativeSdkPayloadSchema
});
export type PayHereNativeCheckoutHandoff = z.infer<typeof PayHereNativeCheckoutHandoffSchema>;

export const LegacyExpiredCheckoutHandoffSchema = z.object({
  mode: z.literal("LEGACY_EXPIRED"),
  provider: PaymentProviderSchema,
  method: z.literal("EXPIRED"),
  reason: z.string().min(1)
});
export type LegacyExpiredCheckoutHandoff = z.infer<typeof LegacyExpiredCheckoutHandoffSchema>;
export type PayHereCheckoutHandoff = z.infer<typeof PayHereCheckoutHandoffSchema>;

export const StripePaymentIntentHandoffSchema = z.object({
  mode: z.literal("STRIPE_ELEMENTS"),
  provider: z.literal("STRIPE"),
  method: z.literal("STRIPE_ELEMENTS"),
  clientSecret: z.string().min(1),
  publishableKey: z.string().min(1),
  paymentIntentId: z.string().min(1)
});
export type StripePaymentIntentHandoff = z.infer<typeof StripePaymentIntentHandoffSchema>;

export const StripeCheckoutSessionHandoffSchema = z.object({
  mode: z.literal("STRIPE_CHECKOUT"),
  provider: z.literal("STRIPE"),
  method: z.literal("STRIPE_CHECKOUT"),
  checkoutSessionUrl: z.string().url(),
  checkoutSessionId: z.string().min(1)
});
export type StripeCheckoutSessionHandoff = z.infer<typeof StripeCheckoutSessionHandoffSchema>;

export const PayPalCheckoutHandoffSchema = z.object({
  mode: z.literal("PAYPAL_CHECKOUT"),
  provider: z.literal("PAYPAL"),
  method: z.literal("PAYPAL_CHECKOUT"),
  orderId: z.string().min(1),
  approveUrl: z.string().url()
});
export type PayPalCheckoutHandoff = z.infer<typeof PayPalCheckoutHandoffSchema>;

export const PaymentCheckoutHandoffSchema = z.discriminatedUnion("method", [
  SandboxCheckoutHandoffSchema,
  StripePaymentIntentHandoffSchema,
  StripeCheckoutSessionHandoffSchema,
  PayPalCheckoutHandoffSchema,
  PayHereWebCheckoutHandoffSchema,
  PayHereNativeCheckoutHandoffSchema,
  LegacyExpiredCheckoutHandoffSchema
]);
export type PaymentCheckoutHandoff = z.infer<typeof PaymentCheckoutHandoffSchema>;

export const PaymentIntentSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  travellerUserId: z.string().uuid(),
  provider: PaymentProviderSchema,
  checkoutChannel: PaymentCheckoutChannelSchema,
  providerOrderId: z.string(),
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3),
  status: PaymentIntentStatusSchema,
  nextAction: PaymentNextActionSchema,
  checkoutHandoff: PaymentCheckoutHandoffSchema,
  checkoutPayload: z.record(z.string(), z.unknown()),
  expiresAt: z.string(),
  verifiedAt: z.string().nullable(),
  failureReason: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type PaymentIntent = z.infer<typeof PaymentIntentSchema>;

export const CheckoutStatusQuerySchema = z
  .object({
    bookingId: z.string().uuid().optional(),
    orderId: z.string().trim().min(4).max(128).optional()
  })
  .strict()
  .refine((v) => Boolean(v.bookingId || v.orderId), {
    message: "Either bookingId or orderId query parameter is required"
  });
export type CheckoutStatusQuery = z.infer<typeof CheckoutStatusQuerySchema>;

export const CheckoutStatusResponseSchema = z.object({
  bookingId: z.string().uuid(),
  referenceCode: z.string(),
  bookingStatus: z.string(),
  holdExpiresAt: z.string().nullable(),
  confirmedAt: z.string().nullable(),
  canRetryPayment: z.boolean(),
  custodyReady: z.boolean(),
  pollRecommended: z.boolean(),
  paymentIntent: PaymentIntentSchema.nullable()
});
export type CheckoutStatusResponse = z.infer<typeof CheckoutStatusResponseSchema>;

export const SandboxSimulatePaymentRequestSchema = z.object({
  outcome: z.enum(["SUCCEEDED", "FAILED"]).default("SUCCEEDED"),
  failureReason: z.string().trim().max(255).optional()
});
export type SandboxSimulatePaymentRequest = z.infer<typeof SandboxSimulatePaymentRequestSchema>;

export const SandboxWebhookPayloadSchema = z.object({
  eventId: z.string().min(8).max(128),
  providerOrderId: z.string().min(4).max(128),
  providerTransactionId: z.string().min(4).max(128),
  status: z.enum(["SUCCEEDED", "FAILED"]),
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3),
  timestamp: z.number().int().positive(),
  failureReason: z.string().max(255).optional()
});
export type SandboxWebhookPayload = z.infer<typeof SandboxWebhookPayloadSchema>;

// ============================================================================
// Refund Schemas (OQ-009 & OQ-013 7-Stage Lifecycle)
// ============================================================================

export const RefundRecordSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  referenceCode: z.string().optional(),
  paymentIntentId: z.string().uuid().nullable(),
  amountMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  refundPercentage: z.number().int().min(0).max(100),
  reasonCategory: RefundReasonCategorySchema,
  status: RefundStatusSchema,
  settlementMode: RefundSettlementModeSchema.nullable(),
  providerRefundId: z.string().nullable(),
  manualReference: z.string().nullable(),
  requestedByUserId: z.string().uuid().nullable(),
  authorizedByUserId: z.string().uuid().nullable(),
  settledByUserId: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type RefundRecord = z.infer<typeof RefundRecordSchema>;

export const AdminTransitionRefundRequestSchema = z
  .object({
    targetStatus: z.enum([
      "AUTHORIZED",
      "INITIATED",
      "PROCESSING",
      "SUCCEEDED",
      "FAILED",
      "MANUAL_REVIEW_REQUIRED"
    ]),
    notes: z.string().trim().min(3, "Audit notes must be at least 3 characters").max(500),
    settlementMode: RefundSettlementModeSchema.optional(),
    providerRefundId: z.string().trim().min(3).max(128).optional(),
    manualReference: z.string().trim().min(3).max(128).optional()
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.targetStatus === "SUCCEEDED") {
      if (!data.settlementMode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "settlementMode ('PROVIDER_CONFIRMED' or 'MANUAL_OFFLINE') is required when transitioning a refund to SUCCEEDED",
          path: ["settlementMode"]
        });
        return;
      }

      if (data.settlementMode === "PROVIDER_CONFIRMED") {
        if (!data.providerRefundId || data.providerRefundId.trim().length < 3) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "providerRefundId is required when settlementMode is PROVIDER_CONFIRMED",
            path: ["providerRefundId"]
          });
        }
        if (data.manualReference) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "manualReference must not be provided when settlementMode is PROVIDER_CONFIRMED",
            path: ["manualReference"]
          });
        }
      }

      if (data.settlementMode === "MANUAL_OFFLINE") {
        if (!data.manualReference || data.manualReference.trim().length < 3) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "manualReference is required when settlementMode is MANUAL_OFFLINE",
            path: ["manualReference"]
          });
        }
        if (data.providerRefundId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "providerRefundId must not be provided when settlementMode is MANUAL_OFFLINE",
            path: ["providerRefundId"]
          });
        }
      }
    }
  });
export type AdminTransitionRefundRequest = z.infer<typeof AdminTransitionRefundRequestSchema>;

export const AdminRefundListQuerySchema = z.object({
  status: RefundStatusSchema.optional(),
  bookingId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});
export type AdminRefundListQuery = z.infer<typeof AdminRefundListQuerySchema>;

export const PaymentTransactionRecordSchema = z.object({
  id: z.string().uuid(),
  paymentIntentId: z.string().uuid(),
  bookingId: z.string().uuid(),
  referenceCode: z.string().optional(),
  refundId: z.string().uuid().nullable(),
  provider: PaymentProviderSchema,
  providerTransactionId: z.string().nullable(),
  transactionType: z.enum(["CHARGE", "REFUND"]),
  status: z.enum(["SUCCEEDED", "FAILED", "PENDING"]),
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3),
  evidenceSource: PaymentTransactionEvidenceSourceSchema,
  manualReference: z.string().nullable(),
  settledByUserId: z.string().uuid().nullable(),
  signatureVerified: z.boolean(),
  createdAt: z.string()
});
export type PaymentTransactionRecord = z.infer<typeof PaymentTransactionRecordSchema>;

