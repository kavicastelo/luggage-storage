import { describe, it, expect, beforeEach, vi } from "vitest";
import { authApi } from "../src/services/auth-api";
import { clearAccessToken } from "../src/lib/api-client";
import {
  isDemoPreviewConfigEnabled,
  isDemoPreviewActive,
  evaluateRouteAuthorization
} from "../src/config/demo-preview";

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

  describe("Demo Preview Security Boundaries & Role Enforcement (AUD-007)", () => {
    it("should disable demo preview by default in production unless VITE_ENABLE_DEMO_PREVIEW=true", () => {
      expect(isDemoPreviewConfigEnabled({ PROD: true })).toBe(false);
      expect(isDemoPreviewConfigEnabled({ MODE: "production" })).toBe(false);
      expect(
        isDemoPreviewActive({
          allowDemoPreview: true,
          search: "?preview=demo",
          isAuthenticated: false,
          envInput: { PROD: true }
        })
      ).toBe(false);

      // Explicitly enabled in production
      expect(
        isDemoPreviewConfigEnabled({
          PROD: true,
          VITE_ENABLE_DEMO_PREVIEW: "true"
        })
      ).toBe(true);
    });

    it("should support explicit demo preview opt-in in non-production and block when VITE_ENABLE_DEMO_PREVIEW=false", () => {
      expect(
        isDemoPreviewActive({
          allowDemoPreview: true,
          search: "?preview=demo",
          isAuthenticated: false,
          envInput: { PROD: false, VITE_ENABLE_DEMO_PREVIEW: "true" }
        })
      ).toBe(true);

      // Without ?preview=demo query param, demo preview is inactive
      expect(
        isDemoPreviewActive({
          allowDemoPreview: true,
          search: "",
          isAuthenticated: false,
          envInput: { PROD: false, VITE_ENABLE_DEMO_PREVIEW: "true" }
        })
      ).toBe(false);

      // When allowDemoPreview=false on route, demo preview is inactive
      expect(
        isDemoPreviewActive({
          allowDemoPreview: false,
          search: "?preview=demo",
          isAuthenticated: false,
          envInput: { PROD: false, VITE_ENABLE_DEMO_PREVIEW: "true" }
        })
      ).toBe(false);

      // When explicitly disabled via VITE_ENABLE_DEMO_PREVIEW=false
      expect(
        isDemoPreviewActive({
          allowDemoPreview: true,
          search: "?preview=demo",
          isAuthenticated: false,
          envInput: { PROD: false, VITE_ENABLE_DEMO_PREVIEW: "false" }
        })
      ).toBe(false);

      // Authenticated users never use unauthenticated demo preview bypass
      expect(
        isDemoPreviewActive({
          allowDemoPreview: true,
          search: "?preview=demo",
          isAuthenticated: true,
          envInput: { PROD: false, VITE_ENABLE_DEMO_PREVIEW: "true" }
        })
      ).toBe(false);
    });

    it("should strictly enforce authenticated role and permission boundaries across TRAVELLER, HOST_STAFF, HOST_OWNER, SUPPORT, and SUPERADMIN", () => {
      const hostRouteRoles = ["HOST_OWNER", "HOST_STAFF", "SUPERADMIN"];
      const adminRouteRoles = ["SUPERADMIN", "SUPPORT"];

      // TRAVELLER: denied on /host and /admin
      expect(
        evaluateRouteAuthorization({
          isAuthenticated: true,
          userRoles: ["TRAVELLER"],
          requiredRoles: hostRouteRoles
        })
      ).toEqual({ allowed: false, reason: "FORBIDDEN_ROLE" });
      expect(
        evaluateRouteAuthorization({
          isAuthenticated: true,
          userRoles: ["TRAVELLER"],
          requiredRoles: adminRouteRoles
        })
      ).toEqual({ allowed: false, reason: "FORBIDDEN_ROLE" });

      // HOST_STAFF: allowed on /host, denied on /admin
      expect(
        evaluateRouteAuthorization({
          isAuthenticated: true,
          userRoles: ["TRAVELLER", "HOST_STAFF"],
          requiredRoles: hostRouteRoles
        })
      ).toEqual({ allowed: true });
      expect(
        evaluateRouteAuthorization({
          isAuthenticated: true,
          userRoles: ["TRAVELLER", "HOST_STAFF"],
          requiredRoles: adminRouteRoles
        })
      ).toEqual({ allowed: false, reason: "FORBIDDEN_ROLE" });

      // HOST_OWNER: allowed on /host, denied on /admin
      expect(
        evaluateRouteAuthorization({
          isAuthenticated: true,
          userRoles: ["TRAVELLER", "HOST_OWNER"],
          requiredRoles: hostRouteRoles
        })
      ).toEqual({ allowed: true });
      expect(
        evaluateRouteAuthorization({
          isAuthenticated: true,
          userRoles: ["TRAVELLER", "HOST_OWNER"],
          requiredRoles: adminRouteRoles
        })
      ).toEqual({ allowed: false, reason: "FORBIDDEN_ROLE" });

      // SUPPORT: allowed on /admin shell, denied on SUPERADMIN-only admin.audit.read
      expect(
        evaluateRouteAuthorization({
          isAuthenticated: true,
          userRoles: ["TRAVELLER", "SUPPORT"],
          userPermissions: ["admin.user.read", "support.ticket.read"],
          requiredRoles: adminRouteRoles
        })
      ).toEqual({ allowed: true });
      expect(
        evaluateRouteAuthorization({
          isAuthenticated: true,
          userRoles: ["TRAVELLER", "SUPPORT"],
          userPermissions: ["admin.user.read", "support.ticket.read"],
          requiredRoles: adminRouteRoles,
          requiredPermission: "admin.audit.read"
        })
      ).toEqual({ allowed: false, reason: "FORBIDDEN_PERMISSION" });

      // SUPERADMIN: allowed on /host, /admin, and admin.audit.read
      expect(
        evaluateRouteAuthorization({
          isAuthenticated: true,
          userRoles: ["SUPERADMIN"],
          userPermissions: ["admin.user.read", "admin.audit.read", "admin.platform.manage"],
          requiredRoles: adminRouteRoles,
          requiredPermission: "admin.audit.read"
        })
      ).toEqual({ allowed: true });
    });
  });
});

