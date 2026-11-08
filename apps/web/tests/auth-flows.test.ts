import { describe, it, expect, beforeEach, vi } from "vitest";
import { authApi } from "../src/services/auth-api";
import { clearAccessToken } from "../src/lib/api-client";

describe("Web Auth API Flows & Endpoint Integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearAccessToken();
  });

  it("should format register request and return RegisterResponseData", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        data: {
          id: "u-123",
          email: "newuser@example.com",
          displayName: "New User",
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
      displayName: "New User",
      email: "newuser@example.com",
      password: "Password123!"
    });

    expect(result.id).toBe("u-123");
    expect(result.status).toBe("PENDING_VERIFICATION");
    expect(result.roles).toContain("TRAVELLER");
  });

  it("should ensure clientType 'WEB' is always passed on login", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          user: {
            id: "u-123",
            email: "user@example.com",
            displayName: "User",
            status: "ACTIVE",
            isEmailVerified: true,
            isPhoneVerified: false,
            roles: ["TRAVELLER"],
            lastLoginAt: null
          },
          accessToken: "web-jwt-token",
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
          clientType: "WEB"
        })
      })
    );
    expect(result.accessToken).toBe("web-jwt-token");
  });

  it("should fetch sessions list via GET /auth/sessions", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          sessions: [
            {
              id: "sess-1",
              clientType: "WEB",
              ipAddress: "127.0.0.1",
              userAgent: "Mozilla/5.0",
              lastActiveAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              isCurrentSession: true
            }
          ]
        }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await authApi.getSessions();
    expect(result.sessions.length).toBe(1);
    expect(result.sessions[0].isCurrentSession).toBe(true);
    expect(result.sessions[0].clientType).toBe("WEB");
  });

  it("should revoke session via DELETE /auth/sessions/:sessionId", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { message: "Session revoked successfully" }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await authApi.revokeSession("sess-target-id");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/sessions/sess-target-id"),
      expect.objectContaining({ method: "DELETE" })
    );
    expect(result.message).toBe("Session revoked successfully");
  });

  it("should perform password change and password reset calls correctly", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { message: "Operation completed successfully" }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    // change password
    const changeRes = await authApi.changePassword({
      currentPassword: "OldPassword1!",
      newPassword: "NewPassword2!",
      confirmPassword: "NewPassword2!"
    });
    expect(changeRes.message).toBe("Operation completed successfully");

    // forgot password
    const forgotRes = await authApi.forgotPassword({ email: "user@example.com" });
    expect(forgotRes.message).toBe("Operation completed successfully");

    // reset password
    const resetRes = await authApi.resetPassword({
      token: "valid-tok-123",
      newPassword: "NewPassword2!",
      confirmPassword: "NewPassword2!"
    });
    expect(resetRes.message).toBe("Operation completed successfully");
  });

  it("should execute email verification and resend verification calls", async () => {
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
                id: "u-123",
                email: "unverified@example.com",
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
      token: "a".repeat(64)
    });
    expect(verifyRes.user?.status).toBe("ACTIVE");
    expect(verifyRes.user?.isEmailVerified).toBe(true);

    const resendRes = await authApi.resendVerification({
      email: "unverified@example.com"
    });
    expect(resendRes.message).toContain("verification email");
  });

  it("should fetch admin audit events via GET /admin/audit-events", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          events: [
            {
              id: "evt-1",
              eventType: "AUTH_LOGIN_SUCCESS",
              actorUserId: "u-1",
              targetUserId: "u-1",
              ipAddress: "127.0.0.1",
              userAgent: "Mozilla/5.0",
              metadata: { clientType: "WEB" },
              createdAt: new Date().toISOString()
            }
          ],
          total: 1,
          page: 1,
          limit: 20
        }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await authApi.listAdminAuditEvents({
      eventType: "AUTH_LOGIN_SUCCESS",
      page: 1,
      limit: 20
    });
    expect(res.total).toBe(1);
    expect(res.events[0].eventType).toBe("AUTH_LOGIN_SUCCESS");
  });
});

