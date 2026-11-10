import { z } from "zod";

// ============================================================================
// Enums & Constants
// ============================================================================

export const HOST_BUSINESS_STATUSES = [
  "DRAFT",
  "PENDING_VERIFICATION",
  "ACTIVE",
  "SUSPENDED",
  "REJECTED"
] as const;
export type HostBusinessStatus = (typeof HOST_BUSINESS_STATUSES)[number];

export const HOST_ENTITY_TYPES = [
  "SOLE_PROPRIETORSHIP",
  "PRIVATE_LIMITED",
  "HOTEL",
  "RETAIL_SHOP",
  "PARTNERSHIP",
  "OTHER"
] as const;
export type HostEntityType = (typeof HOST_ENTITY_TYPES)[number];

export const HOST_VERIFICATION_STATUSES = [
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "INFORMATION_REQUESTED"
] as const;
export type HostVerificationStatus = (typeof HOST_VERIFICATION_STATUSES)[number];

export const HOST_DOCUMENT_TYPES = [
  "BUSINESS_REGISTRATION",
  "NATIONAL_ID",
  "PASSPORT",
  "UTILITY_BILL",
  "BANK_STATEMENT",
  "PROOF_OF_ADDRESS",
  "OTHER"
] as const;
export type HostDocumentType = (typeof HOST_DOCUMENT_TYPES)[number];

export const HOST_STAFF_ROLES = ["MANAGER", "ATTENDANT"] as const;
export type HostStaffRole = (typeof HOST_STAFF_ROLES)[number];

// ============================================================================
// Entities & Models
// ============================================================================

export const HostVerificationDocumentSchema = z.object({
  id: z.string().uuid(),
  verificationId: z.string().uuid(),
  documentType: z.enum(HOST_DOCUMENT_TYPES),
  fileKey: z.string(),
  fileName: z.string(),
  fileSize: z.number().int().nonnegative(),
  mimeType: z.string(),
  status: z.enum(["PENDING", "VERIFIED", "REJECTED"]),
  rejectionReason: z.string().nullable().optional(),
  downloadUrl: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type HostVerificationDocument = z.infer<typeof HostVerificationDocumentSchema>;

export const HostVerificationSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  submittedBy: z.string().uuid(),
  status: z.enum(HOST_VERIFICATION_STATUSES),
  reviewerUserId: z.string().uuid().nullable().optional(),
  reviewedAt: z.string().nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
  adminNotes: z.string().nullable().optional(),
  submittedAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  documents: z.array(HostVerificationDocumentSchema).default([])
});
export type HostVerification = z.infer<typeof HostVerificationSchema>;

export const HostBusinessSchema = z.object({
  id: z.string().uuid(),
  ownerUserId: z.string().uuid(),
  legalBusinessName: z.string(),
  tradeName: z.string(),
  businessRegistrationNumber: z.string().nullable().optional(),
  entityType: z.enum(HOST_ENTITY_TYPES),
  taxIdentifier: z.string().nullable().optional(),
  contactEmail: z.string().email(),
  contactPhone: z.string(),
  addressLine1: z.string().nullable().optional(),
  addressLine2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  countryCode: z.string().length(2).default("LK"),
  payoutBankName: z.string().nullable().optional(),
  payoutAccountNumber: z.string().nullable().optional(),
  payoutAccountName: z.string().nullable().optional(),
  payoutBranchCode: z.string().nullable().optional(),
  status: z.enum(HOST_BUSINESS_STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
  verification: HostVerificationSchema.nullable().optional()
});
export type HostBusiness = z.infer<typeof HostBusinessSchema>;

export const HostStaffMembershipSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  userId: z.string().uuid(),
  staffRole: z.enum(HOST_STAFF_ROLES),
  assignedLocationIds: z.array(z.string().uuid()).default([]),
  isActive: z.boolean(),
  invitedAt: z.string(),
  acceptedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type HostStaffMembership = z.infer<typeof HostStaffMembershipSchema>;

// ============================================================================
// Request Schemas
// ============================================================================

export const CreateHostBusinessRequestSchema = z.object({
  legalBusinessName: z.string().trim().min(2, "Legal business name must be at least 2 characters").max(255),
  tradeName: z.string().trim().min(2, "Trade name must be at least 2 characters").max(255),
  businessRegistrationNumber: z.string().trim().max(100).optional().nullable(),
  entityType: z.enum(HOST_ENTITY_TYPES).default("SOLE_PROPRIETORSHIP"),
  taxIdentifier: z.string().trim().max(100).optional().nullable(),
  contactEmail: z.string().trim().email("Valid email required"),
  contactPhone: z.string().trim().min(7, "Valid phone number required").max(32),
  addressLine1: z.string().trim().max(255).optional().nullable(),
  addressLine2: z.string().trim().max(255).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  postalCode: z.string().trim().max(20).optional().nullable(),
  countryCode: z.string().trim().length(2).default("LK"),
  payoutBankName: z.string().trim().max(128).optional().nullable(),
  payoutAccountNumber: z.string().trim().max(64).optional().nullable(),
  payoutAccountName: z.string().trim().max(128).optional().nullable(),
  payoutBranchCode: z.string().trim().max(32).optional().nullable()
});
export type CreateHostBusinessRequest = z.infer<typeof CreateHostBusinessRequestSchema>;

export const UpdateHostBusinessRequestSchema = CreateHostBusinessRequestSchema.partial();
export type UpdateHostBusinessRequest = z.infer<typeof UpdateHostBusinessRequestSchema>;

export const SubmitVerificationDocumentItemSchema = z.object({
  documentType: z.enum(HOST_DOCUMENT_TYPES),
  fileKey: z.string().min(1, "File key is required"),
  fileName: z.string().min(1, "File name is required"),
  fileSize: z.number().int().positive("File size must be positive"),
  mimeType: z.string().min(1, "MIME type is required")
});
export type SubmitVerificationDocumentItem = z.infer<typeof SubmitVerificationDocumentItemSchema>;

export const SubmitHostVerificationRequestSchema = z.object({
  documents: z.array(SubmitVerificationDocumentItemSchema).min(1, "At least one verification document is required")
});
export type SubmitHostVerificationRequest = z.infer<typeof SubmitHostVerificationRequestSchema>;

export const ReviewHostVerificationRequestSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "REQUEST_INFO"]),
  rejectionReason: z.string().trim().max(1000).optional().nullable(),
  adminNotes: z.string().trim().max(1000).optional().nullable()
}).refine(
  (data) => {
    if (data.decision === "REJECT" || data.decision === "REQUEST_INFO") {
      return Boolean(data.rejectionReason && data.rejectionReason.length > 0);
    }
    return true;
  },
  {
    message: "A rejection or request reason must be provided when not approving",
    path: ["rejectionReason"]
  }
);
export type ReviewHostVerificationRequest = z.infer<typeof ReviewHostVerificationRequestSchema>;

// ============================================================================
// Response Schemas
// ============================================================================

export const HostBusinessListResponseSchema = z.object({
  businesses: z.array(HostBusinessSchema)
});
export type HostBusinessListResponse = z.infer<typeof HostBusinessListResponseSchema>;

export const HostVerificationQueueItemSchema = z.object({
  verificationId: z.string().uuid(),
  businessId: z.string().uuid(),
  legalBusinessName: z.string(),
  tradeName: z.string(),
  entityType: z.enum(HOST_ENTITY_TYPES),
  ownerEmail: z.string(),
  ownerDisplayName: z.string(),
  status: z.enum(HOST_VERIFICATION_STATUSES),
  documentCount: z.number().int(),
  submittedAt: z.string()
});
export type HostVerificationQueueItem = z.infer<typeof HostVerificationQueueItemSchema>;

export const HostVerificationQueueResponseSchema = z.object({
  queue: z.array(HostVerificationQueueItemSchema),
  total: z.number().int()
});
export type HostVerificationQueueResponse = z.infer<typeof HostVerificationQueueResponseSchema>;

