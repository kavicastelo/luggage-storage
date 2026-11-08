import { describe, it, expect } from "vitest";
import {
  RegisterRequestSchema,
  RegisterResponseDataSchema,
  LoginRequestSchema,
  LoginResponseDataSchema,
  RefreshRequestSchema,
  RefreshResponseDataSchema,
  LogoutResponseDataSchema,
  UserMeResponseDataSchema,
  SessionListResponseDataSchema,
  ChangePasswordRequestSchema,
  ChangePasswordResponseDataSchema,
  ForgotPasswordRequestSchema,
  ForgotPasswordResponseDataSchema,
  ResetPasswordRequestSchema,
  ResetPasswordResponseDataSchema,
  PasswordChangeRequestSchema,
  PasswordChangeResponseDataSchema,
  PasswordRecoveryRequestSchema,
  PasswordRecoveryResponseDataSchema,
  PasswordResetRequestSchema,
  PasswordResetResponseDataSchema,
  AdminUserQuerySchema,
  AdminSuspendUserRequestSchema,
  AdminReinstateUserRequestSchema,
  AdminDeactivateUserRequestSchema,
  AdminReactivateUserRequestSchema,
  AdminVerifyEmailRequestSchema,
  AssignUserRoleRequestSchema,
  SYSTEM_ROLES,
  SYSTEM_PERMISSIONS,
  normalizeEmail
} from "../src/index.js";

describe("Existing Authentication & RBAC Contract Compatibility", () => {
  const testUuid = "123e4567-e89b-12d3-a456-426614174000";

  it("should preserve RegisterRequest and RegisterResponseData schemas", () => {
    const registerReq = {
      email: "user@example.com",
      password: "StrongPassword123!",
      displayName: "New User"
    };
    expect(RegisterRequestSchema.parse(registerReq)).toEqual(registerReq);

    const registerRes = {
      id: testUuid,
      email: "user@example.com",
      displayName: "New User",
      status: "PENDING_VERIFICATION" as const,
      isEmailVerified: false,
      isPhoneVerified: false,
      roles: ["TRAVELLER"],
      createdAt: "2026-11-08T06:00:00.000Z"
    };
    expect(RegisterResponseDataSchema.parse(registerRes)).toEqual(registerRes);
  });

  it("should preserve LoginRequest and LoginResponseData schemas", () => {
    const loginReq = {
      email: "user@example.com",
      password: "StrongPassword123!",
      clientType: "WEB" as const
    };
    expect(LoginRequestSchema.parse(loginReq)).toEqual(loginReq);

    const loginRes = {
      user: {
        id: testUuid,
        email: "user@example.com",
        displayName: "Logged In User",
        status: "ACTIVE" as const,
        isEmailVerified: true,
        isPhoneVerified: false,
        roles: ["TRAVELLER"],
        lastLoginAt: null
      },
      accessToken: "mock.jwt.token",
      refreshToken: "mock-refresh-token",
      expiresIn: 900,
      tokenType: "Bearer" as const
    };
    expect(LoginResponseDataSchema.parse(loginRes)).toEqual(loginRes);
  });

  it("should preserve Refresh and Session schemas", () => {
    const refreshReq = { refreshToken: "test-token", clientType: "MOBILE" as const };
    expect(RefreshRequestSchema.parse(refreshReq)).toEqual(refreshReq);

    const refreshRes = {
      accessToken: "new.jwt.token",
      refreshToken: "new-refresh-token",
      expiresIn: 900,
      tokenType: "Bearer" as const
    };
    expect(RefreshResponseDataSchema.parse(refreshRes)).toEqual(refreshRes);

    const logoutRes = { message: "Successfully logged out" };
    expect(LogoutResponseDataSchema.parse(logoutRes)).toEqual(logoutRes);

    const userMe = {
      user: {
        id: testUuid,
        email: "user@example.com",
        displayName: "User Me",
        status: "ACTIVE" as const,
        isEmailVerified: true,
        isPhoneVerified: false,
        roles: ["TRAVELLER"],
        lastLoginAt: null
      },
      sessionId: testUuid,
      permissions: ["identity.profile.read"]
    };
    expect(UserMeResponseDataSchema.parse(userMe)).toEqual(userMe);

    const sessions = {
      sessions: [
        {
          id: testUuid,
          clientType: "WEB" as const,
          ipAddress: "127.0.0.1",
          userAgent: "Mozilla/5.0",
          lastActiveAt: "2026-11-08T06:00:00.000Z",
          createdAt: "2026-11-08T05:00:00.000Z",
          isCurrentSession: true
        }
      ]
    };
    expect(SessionListResponseDataSchema.parse(sessions)).toEqual(sessions);
  });

  it("should verify password recovery and alias schemas equivalence", () => {
    const changeReq = {
      currentPassword: "OldPassword123!",
      newPassword: "NewPassword456!",
      confirmPassword: "NewPassword456!"
    };
    expect(ChangePasswordRequestSchema.parse(changeReq)).toEqual(changeReq);
    expect(PasswordChangeRequestSchema.parse(changeReq)).toEqual(changeReq);

    const changeRes = { message: "Password changed successfully" };
    expect(ChangePasswordResponseDataSchema.parse(changeRes)).toEqual(changeRes);
    expect(PasswordChangeResponseDataSchema.parse(changeRes)).toEqual(changeRes);

    const forgotReq = { email: "reset@example.com" };
    expect(ForgotPasswordRequestSchema.parse(forgotReq)).toEqual(forgotReq);
    expect(PasswordRecoveryRequestSchema.parse(forgotReq)).toEqual(forgotReq);

    const forgotRes = { message: "If an account exists, a recovery email has been sent" };
    expect(ForgotPasswordResponseDataSchema.parse(forgotRes)).toEqual(forgotRes);
    expect(PasswordRecoveryResponseDataSchema.parse(forgotRes)).toEqual(forgotRes);

    const resetReq = {
      token: "secret-reset-token",
      newPassword: "NewPassword789!",
      confirmPassword: "NewPassword789!"
    };
    expect(ResetPasswordRequestSchema.parse(resetReq)).toEqual(resetReq);
    expect(PasswordResetRequestSchema.parse(resetReq)).toEqual(resetReq);

    const resetRes = { message: "Password reset successfully" };
    expect(ResetPasswordResponseDataSchema.parse(resetRes)).toEqual(resetRes);
    expect(PasswordResetResponseDataSchema.parse(resetRes)).toEqual(resetRes);
  });

  it("should preserve admin lifecycle schemas", () => {
    const adminQuery = { page: 1, limit: 10, status: "ACTIVE" as const, search: "jane" };
    expect(AdminUserQuerySchema.parse(adminQuery)).toEqual(adminQuery);

    const suspendReq = { reason: "Suspicious activity detected" };
    expect(AdminSuspendUserRequestSchema.parse(suspendReq)).toEqual(suspendReq);

    const reinstateReq = { reason: "Account review resolved" };
    expect(AdminReinstateUserRequestSchema.parse(reinstateReq)).toEqual(reinstateReq);

    const deactivateReq = { reason: "User request" };
    expect(AdminDeactivateUserRequestSchema.parse(deactivateReq)).toEqual(deactivateReq);

    const reactivateReq = { reason: "User request reactivated" };
    expect(AdminReactivateUserRequestSchema.parse(reactivateReq)).toEqual(reactivateReq);

    const verifyEmailReq = { reason: "Manual verification" };
    expect(AdminVerifyEmailRequestSchema.parse(verifyEmailReq)).toEqual(verifyEmailReq);
  });

  it("should preserve RBAC contracts, system roles, and permissions", () => {
    expect(SYSTEM_ROLES).toContain("SUPERADMIN");
    expect(SYSTEM_ROLES).toContain("TRAVELLER");
    expect(SYSTEM_PERMISSIONS.IDENTITY_PROFILE_READ).toBe("identity.profile.read");

    const assignRole = { roleCode: "HOST_OWNER" };
    expect(AssignUserRoleRequestSchema.parse(assignRole)).toEqual(assignRole);
  });

  it("should preserve email normalization behavior", () => {
    expect(normalizeEmail("  Traveller@Example.COM  ")).toBe("traveller@example.com");
  });
});
