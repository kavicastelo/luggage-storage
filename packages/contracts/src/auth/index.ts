import { z } from "zod";

export const UserStatusSchema = z.enum([
  "PENDING_VERIFICATION",
  "ACTIVE",
  "SUSPENDED",
  "DEACTIVATED"
]);
export type UserStatus = z.infer<typeof UserStatusSchema>;

export const EmailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(255, "Email must not exceed 255 characters")
  .email("Invalid email address format");

export const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password must not exceed 128 characters");

export const DisplayNameSchema = z
  .string()
  .trim()
  .min(1, "Display name is required")
  .max(128, "Display name must not exceed 128 characters");

export const PhoneNumberSchema = z
  .string()
  .trim()
  .max(32, "Phone number must not exceed 32 characters")
  .optional();

export const RegisterRequestSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  displayName: DisplayNameSchema,
  phoneNumber: PhoneNumberSchema,
  role: z.string().optional()
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const RegisterResponseDataSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  displayName: z.string(),
  status: UserStatusSchema,
  isEmailVerified: z.boolean(),
  isPhoneVerified: z.boolean(),
  roles: z.array(z.string()),
  createdAt: z.string()
});
export type RegisterResponseData = z.infer<typeof RegisterResponseDataSchema>;

export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, "Password is required").max(128)
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthenticatedUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  displayName: z.string(),
  status: UserStatusSchema,
  isEmailVerified: z.boolean(),
  isPhoneVerified: z.boolean(),
  roles: z.array(z.string()),
  lastLoginAt: z.string().nullable()
});
export type AuthenticatedUser = z.infer<typeof AuthenticatedUserSchema>;

export const LoginResponseDataSchema = z.object({
  user: AuthenticatedUserSchema
});
export type LoginResponseData = z.infer<typeof LoginResponseDataSchema>;

/**
 * Normalizes an email address according to the database constraint:
 * lower(trim(email))
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
