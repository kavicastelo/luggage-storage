import { z } from "zod";
import { BAG_CATEGORIES } from "../capacity/index.js";
import { BOOKING_MODES } from "../locations/index.js";
import { PRICING_UNITS } from "../pricing/index.js";

// ============================================================================
// Enums & Constants
// ============================================================================

export const BOOKING_STATUSES = [
  "PENDING_HOST_APPROVAL",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "IN_STORAGE",
  "COMPLETED",
  "CANCELLED_BY_TRAVELLER",
  "CANCELLED_BY_HOST",
  "CANCELLED_BY_PLATFORM",
  "REJECTED",
  "EXPIRED",
  "DISPUTED"
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export const BookingStatusSchema = z.enum(BOOKING_STATUSES);

export const CAPACITY_RESERVATION_STATUSES = [
  "HELD_FOR_HOST_APPROVAL",
  "HELD_FOR_PAYMENT",
  "CONFIRMED",
  "RELEASED"
] as const;
export type CapacityReservationStatus = (typeof CAPACITY_RESERVATION_STATUSES)[number];
export const CapacityReservationStatusSchema = z.enum(CAPACITY_RESERVATION_STATUSES);

export const CANCELLATION_POLICY_CODES = ["STANDARD_FLEX_2H"] as const;
export type CancellationPolicyCode = (typeof CANCELLATION_POLICY_CODES)[number];

export const DEFAULT_HOST_APPROVAL_HOLD_MINUTES = 15;
export const DEFAULT_PAYMENT_HOLD_MINUTES = 10;
export const DEFAULT_COMMISSION_RATE_BPS = 1500; // 15.00%

// ============================================================================
// Bag Selection & Quotation Schemas
// ============================================================================

export const BookingBagItemInputSchema = z.object({
  bagCategory: z.enum(BAG_CATEGORIES),
  quantity: z.number().int().positive().max(50)
});
export type BookingBagItemInput = z.infer<typeof BookingBagItemInputSchema>;

export const BookingQuoteRequestSchema = z
  .object({
    locationId: z.string().uuid(),
    dropOffAt: z.string().datetime({ offset: true }),
    collectionAt: z.string().datetime({ offset: true }),
    items: z.array(BookingBagItemInputSchema).min(1, "Select at least one bag")
  })
  .refine(
    (data) => new Date(data.collectionAt).getTime() > new Date(data.dropOffAt).getTime(),
    {
      message: "Collection time must be strictly after drop-off time",
      path: ["collectionAt"]
    }
  );
export type BookingQuoteRequest = z.infer<typeof BookingQuoteRequestSchema>;

export const QuotedLineItemSchema = z.object({
  bagCategory: z.enum(BAG_CATEGORIES),
  quantity: z.number().int().positive(),
  capacityUnits: z.number().int().positive(),
  unitRateMinor: z.number().int().nonnegative(),
  durationUnits: z.number().int().positive(),
  lineTotalMinor: z.number().int().nonnegative()
});
export type QuotedLineItem = z.infer<typeof QuotedLineItemSchema>;

export const BookingQuoteResponseSchema = z.object({
  locationId: z.string().uuid(),
  locationName: z.string(),
  bookingMode: z.enum(BOOKING_MODES),
  timezone: z.string(),
  available: z.boolean(),
  unavailabilityReason: z.string().nullable(),
  remainingCapacityUnits: z.number().int().nonnegative(),
  requestedCapacityUnits: z.number().int().positive(),
  totalBags: z.number().int().positive(),
  currency: z.string().length(3),
  currencyExponent: z.number().int().nonnegative(),
  pricingUnit: z.enum(PRICING_UNITS),
  durationUnits: z.number().int().positive(),
  baseRateMinor: z.number().int().positive(),
  items: z.array(QuotedLineItemSchema),
  grossStorageMinor: z.number().int().nonnegative(),
  discountMinor: z.number().int().nonnegative(),
  storageSubtotalMinor: z.number().int().nonnegative(),
  commissionRateBps: z.number().int().nonnegative(),
  platformCommissionMinor: z.number().int().nonnegative(),
  hostPayableMinor: z.number().int().nonnegative(),
  taxRateBps: z.number().int().nonnegative(),
  taxAmountMinor: z.number().int().nonnegative(),
  totalAmountMinor: z.number().int().nonnegative(),
  cancellationPolicyCode: z.enum(CANCELLATION_POLICY_CODES),
  cancellationPolicySummary: z.string()
});
export type BookingQuoteResponse = z.infer<typeof BookingQuoteResponseSchema>;

export const AvailabilitySearchQuerySchema = z.object({
  locationId: z.string().uuid().optional(),
  city: z.string().trim().max(100).optional(),
  dropOffAt: z.string().datetime({ offset: true }),
  collectionAt: z.string().datetime({ offset: true }),
  smallBags: z.coerce.number().int().nonnegative().default(0),
  mediumBags: z.coerce.number().int().nonnegative().default(0),
  largeBags: z.coerce.number().int().nonnegative().default(0),
  oversizedBags: z.coerce.number().int().nonnegative().default(0)
});
export type AvailabilitySearchQuery = z.infer<typeof AvailabilitySearchQuerySchema>;

// ============================================================================
// Booking Creation, Lifecycle & Response Models
// ============================================================================

export const CreateBookingRequestSchema = z
  .object({
    locationId: z.string().uuid(),
    dropOffAt: z.string().datetime({ offset: true }),
    collectionAt: z.string().datetime({ offset: true }),
    items: z.array(BookingBagItemInputSchema).min(1, "Select at least one bag"),
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
    travellerNotes: z.string().trim().max(500).optional()
  })
  .refine(
    (data) => new Date(data.collectionAt).getTime() > new Date(data.dropOffAt).getTime(),
    {
      message: "Collection time must be strictly after drop-off time",
      path: ["collectionAt"]
    }
  );
export type CreateBookingRequest = z.infer<typeof CreateBookingRequestSchema>;

export const CancelBookingRequestSchema = z.object({
  reason: z.string().trim().min(3, "Reason must be at least 3 characters").max(500)
});
export type CancelBookingRequest = z.infer<typeof CancelBookingRequestSchema>;

export const HostDecisionBookingRequestSchema = z.object({
  reason: z.string().trim().min(3).max(500).optional()
});
export type HostDecisionBookingRequest = z.infer<typeof HostDecisionBookingRequestSchema>;

export const HostRejectBookingRequestSchema = z.object({
  reason: z.string().trim().min(3, "Rejection reason is required").max(500)
});
export type HostRejectBookingRequest = z.infer<typeof HostRejectBookingRequestSchema>;

export const RecordBookingExceptionRequestSchema = z.object({
  reason: z.string().trim().min(5, "Exception details must be at least 5 characters").max(1000),
  category: z
    .enum(["DAMAGE_REPORTED", "MISSING_ITEM", "OVERDUE_DISPUTE", "HOST_NO_SHOW", "SAFETY_CONCERN", "OTHER"])
    .default("OTHER")
});
export type RecordBookingExceptionRequest = z.infer<typeof RecordBookingExceptionRequestSchema>;

export const BookingPricingSnapshotSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  policyId: z.string().uuid().nullable(),
  currency: z.string().length(3),
  currencyExponent: z.number().int().nonnegative(),
  pricingUnit: z.enum(PRICING_UNITS),
  baseRateMinor: z.number().int().nonnegative(),
  durationUnits: z.number().int().positive(),
  itemsBreakdown: z.array(QuotedLineItemSchema),
  grossStorageMinor: z.number().int().nonnegative(),
  discountMinor: z.number().int().nonnegative(),
  storageSubtotalMinor: z.number().int().nonnegative(),
  commissionRateBps: z.number().int().nonnegative(),
  platformCommissionMinor: z.number().int().nonnegative(),
  hostPayableMinor: z.number().int().nonnegative(),
  taxRateBps: z.number().int().nonnegative(),
  taxAmountMinor: z.number().int().nonnegative(),
  totalAmountMinor: z.number().int().nonnegative(),
  cancellationPolicyCode: z.string(),
  createdAt: z.string()
});
export type BookingPricingSnapshot = z.infer<typeof BookingPricingSnapshotSchema>;

export const BookingItemSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  bagCategory: z.enum(BAG_CATEGORIES),
  quantity: z.number().int().positive(),
  capacityUnits: z.number().int().positive(),
  unitRateMinor: z.number().int().nonnegative(),
  lineTotalMinor: z.number().int().nonnegative()
});
export type BookingItem = z.infer<typeof BookingItemSchema>;

export const BookingStatusHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  previousStatus: BookingStatusSchema.nullable(),
  newStatus: BookingStatusSchema,
  actorUserId: z.string().uuid().nullable(),
  actorRole: z.string(),
  reason: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string()
});
export type BookingStatusHistoryEntry = z.infer<typeof BookingStatusHistoryEntrySchema>;

/**
 * Location disclosure embedded in booking responses.
 * Strictly enforces OQ-012: exact address and precise coordinates are NULL unless
 * booking is CONFIRMED/IN_STORAGE/COMPLETED (or caller is authorized host/admin).
 */
export const BookingLocationDisclosureSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  city: z.string(),
  countryCode: z.string().length(2),
  timezone: z.string(),
  approximateArea: z.string(),
  approximateLatitude: z.number(),
  approximateLongitude: z.number(),
  addressDisclosed: z.boolean(),
  addressLine1: z.string().nullable(),
  addressLine2: z.string().nullable(),
  postalCode: z.string().nullable(),
  directionsNotes: z.string().nullable(),
  exactLatitude: z.number().nullable(),
  exactLongitude: z.number().nullable()
});
export type BookingLocationDisclosure = z.infer<typeof BookingLocationDisclosureSchema>;

export const BookingDetailSchema = z.object({
  id: z.string().uuid(),
  referenceCode: z.string(),
  travellerUserId: z.string().uuid(),
  travellerDisplayName: z.string().optional(),
  travellerEmailMasked: z.string().optional(),
  businessId: z.string().uuid(),
  businessName: z.string().optional(),
  locationId: z.string().uuid(),
  bookingMode: z.enum(BOOKING_MODES),
  status: BookingStatusSchema,
  dropOffAt: z.string(),
  collectionAt: z.string(),
  totalBags: z.number().int().positive(),
  totalCapacityUnits: z.number().int().positive(),
  currency: z.string().length(3),
  totalAmountMinor: z.number().int().nonnegative(),
  holdExpiresAt: z.string().nullable(),
  confirmedAt: z.string().nullable(),
  checkedInAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  cancellationReason: z.string().nullable(),
  hostRejectionReason: z.string().nullable(),
  exceptionReason: z.string().nullable(),
  travellerNotes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  location: BookingLocationDisclosureSchema,
  items: z.array(BookingItemSchema),
  pricingSnapshot: BookingPricingSnapshotSchema.nullable(),
  paymentSummary: z
    .object({
      intentId: z.string().uuid().nullable(),
      provider: z.string().nullable(),
      status: z.string(),
      amountMinor: z.number().int().nonnegative(),
      verifiedAt: z.string().nullable()
    })
    .nullable(),
  refundSummary: z
    .object({
      refundId: z.string().uuid(),
      amountMinor: z.number().int().nonnegative(),
      refundPercentage: z.number().int().min(0).max(100),
      status: z.string(),
      reasonCategory: z.string()
    })
    .nullable(),
  custodySummary: z
    .object({
      custodyRecordId: z.string().uuid(),
      status: z.string(),
      expectedBagCount: z.number().int().positive(),
      checkedInBagCount: z.number().int().nullable(),
      releasedBagCount: z.number().int().nullable(),
      checkInAt: z.string().nullable(),
      checkOutAt: z.string().nullable(),
      handoverCondition: z.string(),
      overdueMinutes: z.number().int().nonnegative(),
      overdueFeeMinor: z.number().int().nonnegative()
    })
    .nullable(),
  statusHistory: z.array(BookingStatusHistoryEntrySchema).default([])
});
export type BookingDetail = z.infer<typeof BookingDetailSchema>;

export const BookingListQuerySchema = z.object({
  status: BookingStatusSchema.optional(),
  locationId: z.string().uuid().optional(),
  businessId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});
export type BookingListQuery = z.infer<typeof BookingListQuerySchema>;

