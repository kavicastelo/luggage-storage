import { z } from "zod";

/**
 * Standard UUID v4 validation schema
 */
export const UuidSchema = z
  .string()
  .uuid({ message: "Must be a valid UUID" });

export type Uuid = z.infer<typeof UuidSchema>;

/**
 * Common path parameter schemas
 */
export const UserIdParamSchema = z.object({
  userId: UuidSchema
});
export type UserIdParam = z.infer<typeof UserIdParamSchema>;

export const SessionIdParamSchema = z.object({
  sessionId: UuidSchema
});
export type SessionIdParam = z.infer<typeof SessionIdParamSchema>;

export const RoleIdParamSchema = z.object({
  roleId: UuidSchema
});
export type RoleIdParam = z.infer<typeof RoleIdParamSchema>;

export const RoleCodeParamSchema = z.object({
  roleCode: z
    .string()
    .trim()
    .min(1, "Role code is required")
    .max(32, "Role code must not exceed 32 characters")
});
export type RoleCodeParam = z.infer<typeof RoleCodeParamSchema>;

export const UserRoleParamSchema = z.object({
  userId: UuidSchema,
  roleCode: z
    .string()
    .trim()
    .min(1, "Role code is required")
    .max(32, "Role code must not exceed 32 characters")
});
export type UserRoleParam = z.infer<typeof UserRoleParamSchema>;

/**
 * International E.164 phone number schema:
 * Standard ITU-T format: +[country code][subscriber number], up to 15 digits total.
 * E.g. +94771234567, +14155552671, +442071838750
 */
export const E164PhoneNumberSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{1,14}$/, {
    message: "Phone number must follow international E.164 format (e.g. +94771234567, +14155552671)"
  });
export type E164PhoneNumber = z.infer<typeof E164PhoneNumberSchema>;

/**
 * ISO 3166-1 alpha-2 country code schema:
 * Exactly 2 uppercase letters (e.g. LK, US, GB, JP, FR, DE, SG, TH, AE, IN).
 */
export const CountryCodeSchema = z
  .string()
  .trim()
  .length(2, "Country code must be exactly 2 letters (ISO 3166-1 alpha-2)")
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "Country code must consist of 2 uppercase ASCII letters");
export type CountryCode = z.infer<typeof CountryCodeSchema>;

/**
 * Standard IANA Timezone schema:
 * E.g. "Asia/Colombo", "UTC", "America/New_York", "Europe/London".
 */
export const IanaTimezoneSchema = z
  .string()
  .trim()
  .min(1, "Timezone is required")
  .max(64, "Timezone must not exceed 64 characters")
  .regex(/^[A-Za-z0-9_+-]+(\/[A-Za-z0-9_+-]+)*$/, {
    message: "Must be a valid IANA timezone identifier (e.g. Asia/Colombo, UTC, Europe/London)"
  });
export type IanaTimezone = z.infer<typeof IanaTimezoneSchema>;

/**
 * BCP 47 language tag schema:
 * E.g. "en", "en-US", "si", "ta", "fr-FR", "de".
 */
export const Bcp47LanguageTagSchema = z
  .string()
  .trim()
  .min(2, "Language tag must be at least 2 characters")
  .max(16, "Language tag must not exceed 16 characters")
  .regex(/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/, {
    message: "Must be a valid BCP 47 language tag (e.g. en, en-US, si, ta)"
  });
export type Bcp47LanguageTag = z.infer<typeof Bcp47LanguageTagSchema>;

/**
 * Sort order schema
 */
export const SortOrderSchema = z.enum(["asc", "desc"]).default("asc");
export type SortOrder = z.infer<typeof SortOrderSchema>;

/**
 * Reusable search query string
 */
export const SearchQuerySchema = z
  .string()
  .trim()
  .max(100, "Search query must not exceed 100 characters")
  .optional();
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

// ============================================================================
// Runtime Validation Helpers
// ============================================================================

export function isValidUuid(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return UuidSchema.safeParse(value).success;
}

export function isValidE164Phone(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return E164PhoneNumberSchema.safeParse(value).success;
}

export function isValidCountryCode(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return CountryCodeSchema.safeParse(value).success;
}

export function isValidIanaTimezone(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return IanaTimezoneSchema.safeParse(value).success;
}

export function isValidBcp47Language(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return Bcp47LanguageTagSchema.safeParse(value).success;
}

