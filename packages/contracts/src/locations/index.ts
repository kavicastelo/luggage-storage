import { z } from "zod";

// ============================================================================
// Enums & Constants
// ============================================================================

export const LOCATION_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "ACTIVE",
  "DISABLED",
  "REJECTED"
] as const;
export type LocationStatus = (typeof LOCATION_STATUSES)[number];

export const BOOKING_MODES = ["INSTANT", "HOST_APPROVAL"] as const;
export type BookingMode = (typeof BOOKING_MODES)[number];

export const LOCATION_AMENITIES = [
  "CCTV",
  "WIFI",
  "AIR_CONDITIONING",
  "GROUND_FLOOR",
  "SECURITY_SEALS",
  "LOCKERS",
  "STAFF_ON_DUTY",
  "WHEELCHAIR_ACCESSIBLE"
] as const;
export type LocationAmenity = (typeof LOCATION_AMENITIES)[number];

export const STORAGE_ZONE_TYPES = [
  "LOCKER",
  "BACKROOM",
  "FRONT_DESK",
  "BASEMENT",
  "RACK",
  "OTHER"
] as const;
export type StorageZoneType = (typeof STORAGE_ZONE_TYPES)[number];

export const STORAGE_SECURITY_TIERS = ["STANDARD", "HIGH_SECURITY"] as const;
export type StorageSecurityTier = (typeof STORAGE_SECURITY_TIERS)[number];

export const OPENING_HOURS_EXCEPTION_TYPES = ["CLOSURE", "SPECIAL_HOURS"] as const;
export type OpeningHoursExceptionType = (typeof OPENING_HOURS_EXCEPTION_TYPES)[number];

// ============================================================================
// Entities & Models
// ============================================================================

export const LocationMediaSchema = z.object({
  id: z.string().uuid(),
  locationId: z.string().uuid(),
  fileKey: z.string(),
  url: z.string().url(),
  mediaType: z.literal("IMAGE").default("IMAGE"),
  caption: z.string().nullable().optional(),
  isPrimary: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type LocationMedia = z.infer<typeof LocationMediaSchema>;

export const StorageZoneSchema = z.object({
  id: z.string().uuid(),
  locationId: z.string().uuid(),
  name: z.string(),
  zoneType: z.enum(STORAGE_ZONE_TYPES),
  securityTier: z.enum(STORAGE_SECURITY_TIERS),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type StorageZone = z.infer<typeof StorageZoneSchema>;

export const OpeningHoursSchema = z.object({
  id: z.string().uuid(),
  locationId: z.string().uuid(),
  dayOfWeek: z.number().int().min(1).max(7), // 1=Mon ... 7=Sun
  openTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Time must be HH:MM or HH:MM:SS"),
  closeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Time must be HH:MM or HH:MM:SS"),
  allowsDropoff: z.boolean().default(true),
  allowsCollection: z.boolean().default(true),
  isClosed: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type OpeningHours = z.infer<typeof OpeningHoursSchema>;

export const OpeningHoursExceptionSchema = z.object({
  id: z.string().uuid(),
  locationId: z.string().uuid(),
  exceptionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  exceptionType: z.enum(OPENING_HOURS_EXCEPTION_TYPES),
  openTime: z.string().nullable().optional(),
  closeTime: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type OpeningHoursException = z.infer<typeof OpeningHoursExceptionSchema>;

/**
 * Full storage location entity for Host Owners and Superadmin views.
 * Contains private exact address and exact coordinates.
 */
export const StorageLocationSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  addressLine1: z.string(),
  addressLine2: z.string().nullable().optional(),
  city: z.string(),
  postalCode: z.string().nullable().optional(),
  countryCode: z.string().length(2).default("LK"),
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string().default("Asia/Colombo"),
  bookingMode: z.enum(BOOKING_MODES),
  acceptsOversized: z.boolean().default(false),
  amenities: z.array(z.string()).default([]),
  status: z.enum(LOCATION_STATUSES),
  rejectionReason: z.string().nullable().optional(),
  adminNotes: z.string().nullable().optional(),
  reviewedBy: z.string().uuid().nullable().optional(),
  reviewedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  images: z.array(LocationMediaSchema).default([]),
  zones: z.array(StorageZoneSchema).default([]),
  openingHours: z.array(OpeningHoursSchema).default([]),
  exceptions: z.array(OpeningHoursExceptionSchema).default([])
});
export type StorageLocation = z.infer<typeof StorageLocationSchema>;

/**
 * Public storage location model strictly protecting address privacy per OQ-012.
 * Never exposes exact street address, building number, or exact coordinates.
 */
export const PublicStorageLocationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  city: z.string(),
  countryCode: z.string().length(2),
  approximateArea: z.string(),
  approximateLatitude: z.number(),
  approximateLongitude: z.number(),
  distanceMeters: z.number().optional(),
  timezone: z.string(),
  bookingMode: z.enum(BOOKING_MODES),
  acceptsOversized: z.boolean(),
  amenities: z.array(z.string()),
  status: z.literal("ACTIVE"),
  primaryImageUrl: z.string().nullable().optional(),
  images: z.array(z.object({
    id: z.string().uuid(),
    url: z.string().url(),
    caption: z.string().nullable().optional(),
    isPrimary: z.boolean()
  })).default([]),
  baseRateMinor: z.number().int().positive().optional(),
  currency: z.string().default("LKR"),
  averageRating: z.number().default(5.0),
  reviewCount: z.number().int().default(0),
  is24Hours: z.boolean().default(false),
  operatingHoursSummary: z.string().default("08:00 - 20:00")
});
export type PublicStorageLocation = z.infer<typeof PublicStorageLocationSchema>;

// ============================================================================
// Request Schemas
// ============================================================================

export const CreateLocationRequestSchema = z.object({
  businessId: z.string().uuid("Valid business ID is required"),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(255),
  description: z.string().trim().max(2000).optional().nullable(),
  addressLine1: z.string().trim().min(3, "Address line 1 is required").max(255),
  addressLine2: z.string().trim().max(255).optional().nullable(),
  city: z.string().trim().min(2, "City is required").max(100),
  postalCode: z.string().trim().max(20).optional().nullable(),
  countryCode: z.string().trim().length(2).default("LK"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().trim().default("Asia/Colombo"),
  bookingMode: z.enum(BOOKING_MODES).default("INSTANT"),
  acceptsOversized: z.boolean().default(false),
  amenities: z.array(z.string()).default([])
});
export type CreateLocationRequest = z.infer<typeof CreateLocationRequestSchema>;

export const UpdateLocationRequestSchema = CreateLocationRequestSchema.partial().omit({ businessId: true });
export type UpdateLocationRequest = z.infer<typeof UpdateLocationRequestSchema>;

export const OpeningHourItemInputSchema = z.object({
  dayOfWeek: z.number().int().min(1).max(7),
  openTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Format HH:MM or HH:MM:SS"),
  closeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Format HH:MM or HH:MM:SS"),
  allowsDropoff: z.boolean().default(true),
  allowsCollection: z.boolean().default(true),
  isClosed: z.boolean().default(false)
});
export type OpeningHourItemInput = z.infer<typeof OpeningHourItemInputSchema>;

export const SetOpeningHoursRequestSchema = z.object({
  schedules: z.array(OpeningHourItemInputSchema).min(1, "At least one schedule day required")
});
export type SetOpeningHoursRequest = z.infer<typeof SetOpeningHoursRequestSchema>;

export const CreateOpeningHoursExceptionRequestSchema = z.object({
  exceptionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD"),
  exceptionType: z.enum(OPENING_HOURS_EXCEPTION_TYPES).default("CLOSURE"),
  openTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).optional().nullable(),
  closeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).optional().nullable(),
  reason: z.string().trim().max(255).optional().nullable()
});
export type CreateOpeningHoursExceptionRequest = z.infer<typeof CreateOpeningHoursExceptionRequestSchema>;

export const CreateStorageZoneRequestSchema = z.object({
  name: z.string().trim().min(2).max(128),
  zoneType: z.enum(STORAGE_ZONE_TYPES).default("BACKROOM"),
  securityTier: z.enum(STORAGE_SECURITY_TIERS).default("STANDARD"),
  isActive: z.boolean().default(true)
});
export type CreateStorageZoneRequest = z.infer<typeof CreateStorageZoneRequestSchema>;

export const AddLocationMediaRequestSchema = z.object({
  fileKey: z.string().min(1),
  url: z.string().url(),
  caption: z.string().trim().max(255).optional().nullable(),
  isPrimary: z.boolean().default(false),
  sortOrder: z.number().int().default(0)
});
export type AddLocationMediaRequest = z.infer<typeof AddLocationMediaRequestSchema>;

export const ReviewLocationRequestSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  rejectionReason: z.string().trim().max(1000).optional().nullable(),
  adminNotes: z.string().trim().max(1000).optional().nullable()
}).refine(
  (data) => {
    if (data.decision === "REJECT") {
      return Boolean(data.rejectionReason && data.rejectionReason.length > 0);
    }
    return true;
  },
  {
    message: "A rejection reason is required when rejecting a location",
    path: ["rejectionReason"]
  }
);
export type ReviewLocationRequest = z.infer<typeof ReviewLocationRequestSchema>;

// ============================================================================
// Response Schemas
// ============================================================================

export const StorageLocationListResponseSchema = z.object({
  locations: z.array(StorageLocationSchema)
});
export type StorageLocationListResponse = z.infer<typeof StorageLocationListResponseSchema>;

export const LocationModerationQueueItemSchema = z.object({
  locationId: z.string().uuid(),
  businessId: z.string().uuid(),
  businessName: z.string(),
  name: z.string(),
  city: z.string(),
  addressLine1: z.string(),
  status: z.enum(LOCATION_STATUSES),
  imageCount: z.number().int(),
  submittedAt: z.string()
});
export type LocationModerationQueueItem = z.infer<typeof LocationModerationQueueItemSchema>;

export const LocationModerationQueueResponseSchema = z.object({
  queue: z.array(LocationModerationQueueItemSchema),
  total: z.number().int()
});
export type LocationModerationQueueResponse = z.infer<typeof LocationModerationQueueResponseSchema>;

