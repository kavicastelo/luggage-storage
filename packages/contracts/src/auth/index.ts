import { z } from "zod";

export const UserStatusSchema = z.enum([
  "PENDING_VERIFICATION",
  "ACTIVE",
  "SUSPENDED",
  "DEACTIVATED"
]);
export type UserStatus = z.infer<typeof UserStatusSchema>;

export const ClientTypeSchema = z.enum(["WEB", "MOBILE", "UNKNOWN"]);
export type ClientType = z.infer<typeof ClientTypeSchema>;

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
  .max(128, "Display name cannot exceed 128 characters");

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
  password: z.string().min(1, "Password is required").max(128),
  clientType: ClientTypeSchema.optional()
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
  permissions: z.array(z.string()).optional(),
  lastLoginAt: z.string().nullable()
});
export type AuthenticatedUser = z.infer<typeof AuthenticatedUserSchema>;

export const LoginResponseDataSchema = z.object({
  user: AuthenticatedUserSchema,
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresIn: z.number().default(900),
  tokenType: z.literal("Bearer").default("Bearer")
});
export type LoginResponseData = z.infer<typeof LoginResponseDataSchema>;

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1).max(256).optional(),
  clientType: ClientTypeSchema.optional()
});
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;

export const RefreshResponseDataSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresIn: z.number().default(900),
  tokenType: z.literal("Bearer").default("Bearer")
});
export type RefreshResponseData = z.infer<typeof RefreshResponseDataSchema>;

export const LogoutResponseDataSchema = z.object({
  message: z.string()
});
export type LogoutResponseData = z.infer<typeof LogoutResponseDataSchema>;

export const UserMeResponseDataSchema = z.object({
  user: AuthenticatedUserSchema,
  sessionId: z.string().uuid(),
  permissions: z.array(z.string()).optional()
});
export type UserMeResponseData = z.infer<typeof UserMeResponseDataSchema>;

export const SessionInfoSchema = z.object({
  id: z.string().uuid(),
  clientType: ClientTypeSchema,
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  lastActiveAt: z.string(),
  createdAt: z.string(),
  isCurrentSession: z.boolean().default(false)
});
export type SessionInfo = z.infer<typeof SessionInfoSchema>;

export const SessionListResponseDataSchema = z.object({
  sessions: z.array(SessionInfoSchema)
});
export type SessionListResponseData = z.infer<typeof SessionListResponseDataSchema>;

export const JwtPayloadSchema = z.object({
  sub: z.string().uuid(),
  sessionId: z.string().uuid(),
  email: z.string(),
  roles: z.array(z.string()),
  jti: z.string(),
  iat: z.number().optional(),
  exp: z.number().optional()
});
export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

export const ChangePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: PasswordSchema,
    confirmPassword: z.string().min(1, "Confirm password is required")
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirmation do not match",
    path: ["confirmPassword"]
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password cannot be the same as current password",
    path: ["newPassword"]
  });
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

export const ChangePasswordResponseDataSchema = z.object({
  message: z.string()
});
export type ChangePasswordResponseData = z.infer<typeof ChangePasswordResponseDataSchema>;

export const ForgotPasswordRequestSchema = z.object({
  email: EmailSchema
});
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

export const ForgotPasswordResponseDataSchema = z.object({
  message: z.string()
});
export type ForgotPasswordResponseData = z.infer<typeof ForgotPasswordResponseDataSchema>;

export const ResetPasswordRequestSchema = z
  .object({
    token: z.string().min(1, "Reset token is required").max(256),
    newPassword: PasswordSchema,
    confirmPassword: z.string().min(1, "Confirm password is required")
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirmation do not match",
    path: ["confirmPassword"]
  });
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

export const ResetPasswordResponseDataSchema = z.object({
  message: z.string()
});
export type ResetPasswordResponseData = z.infer<typeof ResetPasswordResponseDataSchema>;

// ============================================================================
// Section 14 Endpoint Name Compatibility Aliases
// ============================================================================
export const PasswordChangeRequestSchema = ChangePasswordRequestSchema;
export type PasswordChangeRequest = ChangePasswordRequest;

export const PasswordChangeResponseDataSchema = ChangePasswordResponseDataSchema;
export type PasswordChangeResponseData = ChangePasswordResponseData;

export const PasswordRecoveryRequestSchema = ForgotPasswordRequestSchema;
export type PasswordRecoveryRequest = ForgotPasswordRequest;

export const PasswordRecoveryResponseDataSchema = ForgotPasswordResponseDataSchema;
export type PasswordRecoveryResponseData = ForgotPasswordResponseData;

export const PasswordResetRequestSchema = ResetPasswordRequestSchema;
export type PasswordResetRequest = ResetPasswordRequest;

export const PasswordResetResponseDataSchema = ResetPasswordResponseDataSchema;
export type PasswordResetResponseData = ResetPasswordResponseData;

/**
 * Normalizes an email address according to the database constraint:
 * lower(trim(email))
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
