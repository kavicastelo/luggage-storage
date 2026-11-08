import { describe, it, expect, beforeEach, vi } from "vitest";
import { authApi } from "../src/services/auth-api";
import { clearAccessToken } from "../src/services/api-client";
import { secureStorage } from "../src/services/secure-storage.service";

describe("Mobile Auth API Flows & Endpoint Integration", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    clearAccessToken();
    await secureStorage.deleteRefreshToken();
  });

  it("should register a user with default TRAVELLER role assignment", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        data: {
          id: "m-user-1",
          email: "mobile@example.com",
          displayName: "Mobile Registrant",
          status: "PENDING_VERIFICATION",
          isEmailVerified: false,
          isPhoneVerified: false,
          roles: ["TRAVELLER"],
          createdAt: new Date().toISOString()
        }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await authApi.register({
      displayName: "Mobile Registrant",
      email: "mobile@example.com",
      password: "Password123!"
    });

    expect(result.id).toBe("m-user-1");
    expect(result.roles).toContain("TRAVELLER");
    expect(result.status).toBe("PENDING_VERIFICATION");
  });

  it("should pass clientType 'MOBILE' and parse tokens from body on login", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          user: {
            id: "m-user-2",
            email: "user@example.com",
            displayName: "User",
            status: "ACTIVE",
            isEmailVerified: true,
            isPhoneVerified: false,
            roles: ["TRAVELLER"],
            lastLoginAt: null
          },
          accessToken: "mobile-jwt-access-token",
          refreshToken: "mobile-raw-refresh-token",
          expiresIn: 900,
          tokenType: "Bearer"
        }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await authApi.login({
      email: "user@example.com",
      password: "Password123!"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login"),
      expect.objectContaining({
        body: JSON.stringify({
          email: "user@example.com",
          password: "Password123!",
          clientType: "MOBILE"
        })
      })
    );
    expect(result.accessToken).toBe("mobile-jwt-access-token");
    expect(result.refreshToken).toBe("mobile-raw-refresh-token");
  });

  it("should pass mobile refresh token in request body to /auth/refresh", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          accessToken: "rotated-jwt",
          refreshToken: "rotated-refresh",
          expiresIn: 900,
          tokenType: "Bearer"
        }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await authApi.refresh("my-stored-token");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/refresh"),
      expect.objectContaining({
        body: JSON.stringify({
          refreshToken: "my-stored-token",
          clientType: "MOBILE"
        })
      })
    );
    expect(result.accessToken).toBe("rotated-jwt");
    expect(result.refreshToken).toBe("rotated-refresh");
  });

  it("should fetch sessions and revoke individual session", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      if (opts?.method === "DELETE") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { message: "Session revoked successfully" }
          })
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            sessions: [
              {
                id: "sess-m-1",
                clientType: "MOBILE",
                ipAddress: "192.168.1.5",
                userAgent: "Expo/LuggageStorage",
                lastActiveAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                isCurrentSession: true
              }
            ]
          }
        })
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const listRes = await authApi.getSessions();
    expect(listRes.sessions.length).toBe(1);
    expect(listRes.sessions[0].clientType).toBe("MOBILE");

    const revokeRes = await authApi.revokeSession("sess-m-1");
    expect(revokeRes.message).toBe("Session revoked successfully");
  });

  it("should execute change password, forgot password, and reset password", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { message: "Success" }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const change = await authApi.changePassword({
      currentPassword: "OldPassword1!",
      newPassword: "NewPassword2!",
      confirmPassword: "NewPassword2!"
    });
    expect(change.message).toBe("Success");

    const forgot = await authApi.forgotPassword({ email: "test@example.com" });
    expect(forgot.message).toBe("Success");

    const reset = await authApi.resetPassword({
      token: "tok-123",
      newPassword: "NewPassword2!",
      confirmPassword: "NewPassword2!"
    });
    expect(reset.message).toBe("Success");
  });

  it("should execute email verification and resend verification on mobile", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/auth/verify-email")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              message: "Your email address has been verified and your account is now active.",
              user: {
                id: "m-user-1",
                email: "mobile-user@example.com",
                status: "ACTIVE",
                isEmailVerified: true
              }
            }
          })
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            message:
              "If an unverified account exists with that email address, a verification email has been sent."
          }
        })
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const verifyRes = await authApi.verifyEmail({
      token: "b".repeat(64)
    });
    expect(verifyRes.user?.status).toBe("ACTIVE");
    expect(verifyRes.user?.isEmailVerified).toBe(true);

    const resendRes = await authApi.resendVerification({
      email: "mobile-user@example.com"
    });
    expect(resendRes.message).toContain("verification email");
  });
});

