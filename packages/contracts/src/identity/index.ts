import { z } from "zod";
import { UserStatusSchema, DisplayNameSchema, PhoneNumberSchema } from "../auth/index.js";
import { CurrencyCodeSchema } from "../common/currency.js";
import { Bcp47LanguageTagSchema, E164PhoneNumberSchema } from "../common/identifiers.js";

// ============================================================================
// Domain Profile Schemas
// ============================================================================

export const TravellerProfileSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  firstName: z.string().max(64).nullable(),
  lastName: z.string().max(64).nullable(),
  preferredLanguage: z.string().max(10).default("en"),
  preferredCurrency: CurrencyCodeSchema.default("LKR"),
  emergencyContactName: z.string().max(128).nullable(),
  emergencyContactPhone: z.string().max(32).nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type TravellerProfile = z.infer<typeof TravellerProfileSchema>;

export const HostProfileTypeSchema = z.enum(["INDIVIDUAL", "BUSINESS"]);
export type HostProfileType = z.infer<typeof HostProfileTypeSchema>;

export const HostProfileStatusSchema = z.enum([
  "PENDING_ONBOARDING",
  "ACTIVE",
  "SUSPENDED",
  "DEACTIVATED"
]);
export type HostProfileStatus = z.infer<typeof HostProfileStatusSchema>;

export const HostProfileSummarySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  displayName: z.string().max(128),
  contactEmail: z.string().max(255).nullable(),
  contactPhone: z.string().max(32).nullable(),
  hostType: HostProfileTypeSchema,
  status: HostProfileStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string()
});
export type HostProfileSummary = z.infer<typeof HostProfileSummarySchema>;

// ============================================================================
// Endpoint Request & Response Schemas
// ============================================================================

/**
 * Full User Profile Response (GET /api/v1/identity/profile)
 */
export const UserProfileDataSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  displayName: z.string(),
  phoneNumber: z.string().nullable(),
  status: UserStatusSchema,
  isEmailVerified: z.boolean(),
  isPhoneVerified: z.boolean(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()).optional(),
  lastLoginAt: z.string().nullable(),
  passwordChangedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  travellerProfile: TravellerProfileSchema.nullable(),
  hostProfile: HostProfileSummarySchema.nullable()
});
export type UserProfileData = z.infer<typeof UserProfileDataSchema>;

export const UserProfileResponseDataSchema = z.object({
  profile: UserProfileDataSchema
});
export type UserProfileResponseData = z.infer<typeof UserProfileResponseDataSchema>;

/**
 * Traveller Profile Partial Update payload
 */
export const UpdateTravellerProfileSchema = z.object({
  firstName: z.string().trim().max(64, "First name cannot exceed 64 characters").nullable().optional(),
  lastName: z.string().trim().max(64, "Last name cannot exceed 64 characters").nullable().optional(),
  preferredLanguage: Bcp47LanguageTagSchema.optional(),
  preferredCurrency: CurrencyCodeSchema.optional(),
  emergencyContactName: z.string().trim().max(128, "Emergency contact name cannot exceed 128 characters").nullable().optional(),
  emergencyContactPhone: E164PhoneNumberSchema.nullable().optional()
});
export type UpdateTravellerProfile = z.infer<typeof UpdateTravellerProfileSchema>;

/**
 * Profile Update Request (PATCH /api/v1/identity/profile)
 */
export const UpdateProfileRequestSchema = z.object({
  displayName: DisplayNameSchema.optional(),
  phoneNumber: PhoneNumberSchema.optional(),
  traveller: UpdateTravellerProfileSchema.optional()
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

export const UpdateProfileResponseDataSchema = z.object({
  profile: UserProfileDataSchema,
  message: z.string()
});
export type UpdateProfileResponseData = z.infer<typeof UpdateProfileResponseDataSchema>;
