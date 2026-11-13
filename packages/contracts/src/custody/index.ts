import { z } from "zod";
import { BAG_CATEGORIES } from "../capacity/index.js";

// ============================================================================
// Enums & Constants
// ============================================================================

export const CUSTODY_STATUSES = [
  "EXPECTED",
  "CHECKED_IN",
  "IN_STORAGE",
  "OVERDUE",
  "RELEASED_TO_TRAVELLER",
  "DISPUTED_RELEASE",
  "ABANDONED"
] as const;
export type CustodyStatus = (typeof CUSTODY_STATUSES)[number];
export const CustodyStatusSchema = z.enum(CUSTODY_STATUSES);

export const CUSTODY_OPERATIONS = ["CHECK_IN", "COLLECTION"] as const;
export type CustodyOperation = (typeof CUSTODY_OPERATIONS)[number];
export const CustodyOperationSchema = z.enum(CUSTODY_OPERATIONS);

export const HANDOVER_CONDITIONS = [
  "NORMAL",
  "UNPAID_FEES_PENDING",
  "EXCEPTION_RECORDED"
] as const;
export type HandoverCondition = (typeof HANDOVER_CONDITIONS)[number];
export const HandoverConditionSchema = z.enum(HANDOVER_CONDITIONS);

// ============================================================================
// Traveller Custody Pass Generation (OQ-014)
// ============================================================================

export const IssueCustodyPassRequestSchema = z.object({
  operation: CustodyOperationSchema
});
export type IssueCustodyPassRequest = z.infer<typeof IssueCustodyPassRequestSchema>;

export const CustodyPassResponseSchema = z.object({
  bookingId: z.string().uuid(),
  referenceCode: z.string(),
  operation: CustodyOperationSchema,
  /** High-entropy CSPRNG hex token encoded into QR payload; never stored in plaintext */
  qrToken: z.string().length(64),
  /** 6-digit numeric fallback PIN; never stored in plaintext */
  verificationPin: z.string().regex(/^\d{6}$/),
  expiresAt: z.string()
});
export type CustodyPassResponse = z.infer<typeof CustodyPassResponseSchema>;

// ============================================================================
// Host / Staff Custody Verification, Check-In & Collection Release
// ============================================================================

export const VerifyCustodyPassRequestSchema = z
  .object({
    bookingId: z.string().uuid(),
    operation: CustodyOperationSchema,
    qrToken: z.string().trim().length(64).optional(),
    verificationPin: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Verification PIN must be a 6-digit number")
      .optional()
  })
  .refine((val) => Boolean(val.qrToken || val.verificationPin), {
    message: "Either QR token or 6-digit verification PIN is required"
  });
export type VerifyCustodyPassRequest = z.infer<typeof VerifyCustodyPassRequestSchema>;

export const BagCustodyItemInputSchema = z.object({
  bagTagCode: z.string().trim().min(2).max(64),
  bagCategory: z.enum(BAG_CATEGORIES),
  securitySealNumber: z.string().trim().max(64).optional().nullable(),
  zoneId: z.string().uuid().optional().nullable(),
  photoFileKey: z.string().trim().max(512).optional().nullable(),
  conditionNotes: z.string().trim().max(500).optional().nullable()
});
export type BagCustodyItemInput = z.infer<typeof BagCustodyItemInputSchema>;

export const CompleteCheckInRequestSchema = z
  .object({
    qrToken: z.string().trim().length(64).optional(),
    verificationPin: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Verification PIN must be a 6-digit number")
      .optional(),
    zoneId: z.string().uuid().optional().nullable(),
    bags: z.array(BagCustodyItemInputSchema).min(1, "At least one bag tag is required"),
    bagCountExceptionReason: z.string().trim().min(5).max(500).optional()
  })
  .refine((val) => Boolean(val.qrToken || val.verificationPin), {
    message: "Either QR token or 6-digit verification PIN is required"
  });
export type CompleteCheckInRequest = z.infer<typeof CompleteCheckInRequestSchema>;

/**
 * OQ-015 Zero Possessory Lien:
 * Overdue bookings MUST still release physical luggage upon valid COLLECTION token/PIN.
 */
export const CompleteCollectionRequestSchema = z
  .object({
    qrToken: z.string().trim().length(64).optional(),
    verificationPin: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Verification PIN must be a 6-digit number")
      .optional(),
    releasedBagCount: z.number().int().positive(),
    exceptionNotes: z.string().trim().max(500).optional()
  })
  .refine((val) => Boolean(val.qrToken || val.verificationPin), {
    message: "Either QR token or 6-digit verification PIN is required"
  });
export type CompleteCollectionRequest = z.infer<typeof CompleteCollectionRequestSchema>;

export const BagCustodyItemSchema = z.object({
  id: z.string().uuid(),
  custodyRecordId: z.string().uuid(),
  bagTagCode: z.string(),
  bagCategory: z.enum(BAG_CATEGORIES),
  securitySealNumber: z.string().nullable(),
  zoneId: z.string().uuid().nullable(),
  photoFileKey: z.string().nullable(),
  conditionNotes: z.string().nullable(),
  checkedInAt: z.string(),
  releasedAt: z.string().nullable()
});
export type BagCustodyItem = z.infer<typeof BagCustodyItemSchema>;

export const CustodyEventSchema = z.object({
  id: z.string().uuid(),
  custodyRecordId: z.string().uuid(),
  bookingId: z.string().uuid(),
  eventType: z.string(),
  previousStatus: z.string().nullable(),
  newStatus: z.string(),
  actorUserId: z.string().uuid().nullable(),
  actorRole: z.string(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string()
});
export type CustodyEvent = z.infer<typeof CustodyEventSchema>;

export const CustodyRecordDetailSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  referenceCode: z.string().optional(),
  locationId: z.string().uuid(),
  businessId: z.string().uuid(),
  status: CustodyStatusSchema,
  expectedBagCount: z.number().int().positive(),
  checkedInBagCount: z.number().int().nullable(),
  releasedBagCount: z.number().int().nullable(),
  zoneId: z.string().uuid().nullable(),
  checkInAt: z.string().nullable(),
  checkInStaffUserId: z.string().uuid().nullable(),
  checkOutAt: z.string().nullable(),
  checkOutStaffUserId: z.string().uuid().nullable(),
  handoverCondition: HandoverConditionSchema,
  overdueMinutes: z.number().int().nonnegative(),
  overdueFeeMinor: z.number().int().nonnegative(),
  exceptionNotes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  bags: z.array(BagCustodyItemSchema).default([]),
  events: z.array(CustodyEventSchema).default([])
});
export type CustodyRecordDetail = z.infer<typeof CustodyRecordDetailSchema>;

