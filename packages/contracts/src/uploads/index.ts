import { z } from "zod";
import { HOST_DOCUMENT_TYPES } from "../hosts/index.js";

// ============================================================================
// Enums & Constants
// ============================================================================

export const UPLOAD_PURPOSES = ["HOST_VERIFICATION", "LOCATION_IMAGE"] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

export const UPLOAD_RESOURCE_TYPES = ["HOST_BUSINESS", "STORAGE_LOCATION"] as const;
export type UploadResourceType = (typeof UPLOAD_RESOURCE_TYPES)[number];

export const UPLOAD_INTENT_STATUSES = ["PENDING", "CONFIRMED", "EXPIRED", "CANCELLED"] as const;
export type UploadIntentStatus = (typeof UPLOAD_INTENT_STATUSES)[number];

export const ALLOWED_MIME_TYPES = {
  HOST_VERIFICATION: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf"
  ],
  LOCATION_IMAGE: [
    "image/jpeg",
    "image/png",
    "image/webp"
  ]
} as const;

export const MAX_FILE_SIZE_BYTES = {
  HOST_VERIFICATION: 15 * 1024 * 1024, // 15 MB
  LOCATION_IMAGE: 10 * 1024 * 1024     // 10 MB
} as const;

// ============================================================================
// Request Schemas
// ============================================================================

export const InitiateUploadRequestSchema = z
  .object({
    purpose: z.enum(UPLOAD_PURPOSES),
    resourceType: z.enum(UPLOAD_RESOURCE_TYPES).optional(),
    resourceId: z.string().uuid().optional(),
    referenceId: z.string().uuid().optional(),
    fileName: z.string().trim().min(1, "File name is required").max(255),
    fileSize: z.number().int().positive("File size must be positive"),
    mimeType: z.string().trim().min(1, "MIME type is required")
  })
  .refine(
    (data) => {
      const allowed = ALLOWED_MIME_TYPES[data.purpose];
      return (allowed as readonly string[]).includes(data.mimeType);
    },
    {
      message: "MIME type is not allowed for the selected upload purpose",
      path: ["mimeType"]
    }
  )
  .refine(
    (data) => {
      const max = MAX_FILE_SIZE_BYTES[data.purpose];
      return data.fileSize <= max;
    },
    {
      message: "File size exceeds the maximum limit for this upload purpose",
      path: ["fileSize"]
    }
  )
  .refine(
    (data) => Boolean(data.resourceId || data.referenceId),
    {
      message: "Target resource ID is required for upload authorization",
      path: ["resourceId"]
    }
  );
export type InitiateUploadRequest = z.infer<typeof InitiateUploadRequestSchema>;

export const ConfirmUploadRequestSchema = z.object({
  intentId: z.string().uuid().optional(),
  fileKey: z.string().trim().min(1, "File key is required"),
  purpose: z.enum(UPLOAD_PURPOSES).optional(),
  referenceId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
  documentType: z.enum(HOST_DOCUMENT_TYPES).optional().nullable(),
  caption: z.string().trim().max(255).optional().nullable(),
  isPrimary: z.boolean().default(false)
});
export type ConfirmUploadRequest = z.infer<typeof ConfirmUploadRequestSchema>;

// ============================================================================
// Response Schemas
// ============================================================================

export const InitiateUploadResponseSchema = z.object({
  intentId: z.string().uuid(),
  uploadUrl: z.string().url(),
  fileKey: z.string(),
  expiresInSeconds: z.number().int().positive(),
  publicUrl: z.string().url().optional()
});
export type InitiateUploadResponse = z.infer<typeof InitiateUploadResponseSchema>;

export const ConfirmUploadResponseSchema = z.object({
  success: z.literal(true),
  intentId: z.string().uuid(),
  fileKey: z.string(),
  id: z.string().uuid().optional(),
  url: z.string().url().optional(),
  message: z.string()
});
export type ConfirmUploadResponse = z.infer<typeof ConfirmUploadResponseSchema>;

export const UploadIntentSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  purpose: z.enum(UPLOAD_PURPOSES),
  resourceType: z.string(),
  resourceId: z.string().uuid().nullable().optional(),
  fileKey: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  maxFileSize: z.number().int().positive(),
  status: z.enum(UPLOAD_INTENT_STATUSES),
  expiresAt: z.string(),
  confirmedAt: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type UploadIntent = z.infer<typeof UploadIntentSchema>;
