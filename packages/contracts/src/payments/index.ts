import { z } from "zod";

// ============================================================================
// Enums & Constants
// ============================================================================

export const PAYMENT_PROVIDERS = ["SANDBOX_GATEWAY", "PAYHERE"] as const;
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

// ============================================================================
// Payment Intent & Webhook Schemas
// ============================================================================

export const CreatePaymentIntentRequestSchema = z.object({
  bookingId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(8).max(128).optional()
});
export type CreatePaymentIntentRequest = z.infer<typeof CreatePaymentIntentRequestSchema>;

export const PaymentIntentSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  travellerUserId: z.string().uuid(),
  provider: PaymentProviderSchema,
  providerOrderId: z.string(),
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3),
  status: PaymentIntentStatusSchema,
  checkoutPayload: z.record(z.string(), z.unknown()),
  expiresAt: z.string(),
  verifiedAt: z.string().nullable(),
  failureReason: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type PaymentIntent = z.infer<typeof PaymentIntentSchema>;

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
  providerRefundId: z.string().nullable(),
  requestedByUserId: z.string().uuid().nullable(),
  authorizedByUserId: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type RefundRecord = z.infer<typeof RefundRecordSchema>;

export const AdminTransitionRefundRequestSchema = z.object({
  targetStatus: z.enum([
    "AUTHORIZED",
    "INITIATED",
    "PROCESSING",
    "SUCCEEDED",
    "FAILED",
    "MANUAL_REVIEW_REQUIRED"
  ]),
  notes: z.string().trim().min(3, "Audit notes must be at least 3 characters").max(500),
  providerRefundId: z.string().trim().max(128).optional()
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
  provider: PaymentProviderSchema,
  providerTransactionId: z.string(),
  transactionType: z.enum(["CHARGE", "REFUND"]),
  status: z.enum(["SUCCEEDED", "FAILED", "PENDING"]),
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3),
  signatureVerified: z.boolean(),
  createdAt: z.string()
});
export type PaymentTransactionRecord = z.infer<typeof PaymentTransactionRecordSchema>;

