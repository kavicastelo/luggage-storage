import { z } from "zod";
import { UserStatusSchema } from "../auth/index.js";
import { PaginationQuerySchema } from "../api/pagination.js";

// ============================================================================
// Query Parameters
// ============================================================================
export const AdminUserQuerySchema = PaginationQuerySchema.extend({
  status: UserStatusSchema.optional(),
  search: z.string().trim().max(100).optional(),
  role: z.string().trim().max(32).optional()
});
export type AdminUserQuery = z.infer<typeof AdminUserQuerySchema>;

// ============================================================================
// Request Payloads
// ============================================================================
export const AdminSuspendUserRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Reason must be at least 3 characters")
    .max(255, "Reason must not exceed 255 characters")
});
export type AdminSuspendUserRequest = z.infer<typeof AdminSuspendUserRequestSchema>;

export const AdminReinstateUserRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Reason must be at least 3 characters")
    .max(255, "Reason must not exceed 255 characters")
    .optional()
});
export type AdminReinstateUserRequest = z.infer<typeof AdminReinstateUserRequestSchema>;

export const AdminDeactivateUserRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Reason must be at least 3 characters")
    .max(255, "Reason must not exceed 255 characters")
});
export type AdminDeactivateUserRequest = z.infer<typeof AdminDeactivateUserRequestSchema>;

export const AdminReactivateUserRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Reason must be at least 3 characters")
    .max(255, "Reason must not exceed 255 characters")
    .optional()
});
export type AdminReactivateUserRequest = z.infer<typeof AdminReactivateUserRequestSchema>;

export const AdminVerifyEmailRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Reason must be at least 3 characters")
    .max(255, "Reason must not exceed 255 characters")
    .optional()
});
export type AdminVerifyEmailRequest = z.infer<typeof AdminVerifyEmailRequestSchema>;

// ============================================================================
// Response Models
// ============================================================================
export const AdminUserSummarySchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  displayName: z.string(),
  phoneNumber: z.string().nullable(),
  status: UserStatusSchema,
  isEmailVerified: z.boolean(),
  isPhoneVerified: z.boolean(),
  roles: z.array(z.string()),
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type AdminUserSummary = z.infer<typeof AdminUserSummarySchema>;

export const AdminTravellerProfileSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  preferredLanguage: z.string(),
  preferredCurrency: z.string(),
  emergencyContactName: z.string().nullable(),
  emergencyContactPhone: z.string().nullable()
});
export type AdminTravellerProfile = z.infer<typeof AdminTravellerProfileSchema>;

export const AdminHostProfileSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  contactEmail: z.string().nullable(),
  contactPhone: z.string().nullable(),
  hostType: z.string(),
  status: z.string()
});
export type AdminHostProfile = z.infer<typeof AdminHostProfileSchema>;

export const AdminUserDetailSchema = AdminUserSummarySchema.extend({
  normalizedEmail: z.string(),
  passwordChangedAt: z.string().nullable(),
  activeSessionCount: z.number().int().min(0),
  travellerProfile: AdminTravellerProfileSchema.nullable(),
  hostProfile: AdminHostProfileSchema.nullable()
});
export type AdminUserDetail = z.infer<typeof AdminUserDetailSchema>;

export const AdminLifecycleActionResponseDataSchema = z.object({
  user: AdminUserSummarySchema,
  message: z.string(),
  sessionsRevoked: z.number().int().optional()
});
export type AdminLifecycleActionResponseData = z.infer<typeof AdminLifecycleActionResponseDataSchema>;

