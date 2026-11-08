import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAuthStore } from "../src/store/useAuthStore";
import { authApi } from "../src/services/auth-api";
import { getAccessToken, setAccessToken, clearAccessToken } from "../src/lib/api-client";
import { AuthenticatedUser } from "@luggage-storage/contracts";

describe("useAuthStore (Zustand Auth State)", () => {
  const mockUser: AuthenticatedUser = {
    id: "a0000000-0000-0000-0000-000000000001",
    email: "traveller@example.com",
    displayName: "Test Traveller",
    status: "ACTIVE",
    isEmailVerified: true,
    isPhoneVerified: false,
    roles: ["TRAVELLER"],
    lastLoginAt: new Date().toISOString()
  };

  const mockPermissions = [
    "identity.profile.read",
    "identity.profile.update",
    "identity.session.read_own",
    "identity.session.revoke_own"
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    clearAccessToken();
    useAuthStore.getState().clearAuth();
  });

  it("should initialize with default unauthenticated state", () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.sessionId).toBeNull();
    expect(state.permissions).toEqual([]);
    expect(state.isAuthenticated).toBe(false);
    expect(state.isInitializing).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("should successfully initialize authenticated session when refresh token is valid", async () => {
    // Mock global fetch for refresh endpoint
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/auth/refresh")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { accessToken: "fresh-access-token", expiresIn: 900, tokenType: "Bearer" }
          })
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            user: mockUser,
            sessionId: "s0000000-0000-0000-0000-000000000001",
            permissions: mockPermissions
          }
        })
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    await useAuthStore.getState().initAuth();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.isInitializing).toBe(false);
    expect(state.user?.email).toBe("traveller@example.com");
    expect(state.sessionId).toBe("s0000000-0000-0000-0000-000000000001");
    expect(state.permissions).toEqual(mockPermissions);
    expect(getAccessToken()).toBe("fresh-access-token");
  });

  it("should gracefully handle unauthenticated session on initAuth when refresh fails", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/auth/refresh")) {
        return {
          ok: false,
          status: 401,
          json: async () => ({
            success: false,
            error: { code: "UNAUTHORIZED", message: "Refresh token is required" }
          })
        };
      }
      return { ok: false, status: 401 };
    });
    vi.stubGlobal("fetch", fetchMock);

    await useAuthStore.getState().initAuth();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isInitializing).toBe(false);
    expect(state.user).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it("should authenticate and store credentials in memory on successful login", async () => {
    vi.spyOn(authApi, "login").mockResolvedValue({
      user: mockUser,
      accessToken: "mock-jwt-token-login",
      expiresIn: 900,
      tokenType: "Bearer"
    });

    vi.spyOn(authApi, "getMe").mockResolvedValue({
      user: mockUser,
      sessionId: "s0000000-0000-0000-0000-000000000002",
      permissions: mockPermissions
    });

    await useAuthStore.getState().login({
      email: "traveller@example.com",
      password: "ValidPassword123!"
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.displayName).toBe("Test Traveller");
    expect(state.sessionId).toBe("s0000000-0000-0000-0000-000000000002");
    expect(getAccessToken()).toBe("mock-jwt-token-login");
  });

  it("should clear credentials and state on logout", async () => {
    setAccessToken("test-active-token");
    useAuthStore.setState({
      user: mockUser,
      sessionId: "s0000000-0000-0000-0000-000000000003",
      permissions: mockPermissions,
      isAuthenticated: true
    });

    vi.spyOn(authApi, "logout").mockResolvedValue({
      message: "Logged out successfully"
    });

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.sessionId).toBeNull();
    expect(state.permissions).toEqual([]);
    expect(getAccessToken()).toBeNull();
  });

  it("should clear state and all credentials on logoutAll", async () => {
    setAccessToken("test-active-token-2");
    useAuthStore.setState({
      user: mockUser,
      sessionId: "s0000000-0000-0000-0000-000000000004",
      permissions: mockPermissions,
      isAuthenticated: true
    });

    vi.spyOn(authApi, "logoutAll").mockResolvedValue({
      message: "Successfully logged out from all sessions (3 session(s) revoked)"
    });

    await useAuthStore.getState().logoutAll();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it("should correctly evaluate permission checks", () => {
    useAuthStore.setState({
      permissions: [
        "identity.profile.read",
        "identity.profile.update",
        "admin.user.read"
      ]
    });

    const store = useAuthStore.getState();

    // hasPermission
    expect(store.hasPermission("identity.profile.read")).toBe(true);
    expect(store.hasPermission("admin.user.read")).toBe(true);
    expect(store.hasPermission("admin.role.assign")).toBe(false);

    // hasAnyPermission
    expect(store.hasAnyPermission(["admin.role.assign", "admin.user.read"])).toBe(true);
    expect(store.hasAnyPermission(["booking.create", "storage.claim"])).toBe(false);

    // hasAllPermissions
    expect(
      store.hasAllPermissions(["identity.profile.read", "identity.profile.update"])
    ).toBe(true);
    expect(
      store.hasAllPermissions(["identity.profile.read", "admin.role.assign"])
    ).toBe(false);
  });

  it("should NEVER persist access token or credentials in localStorage or sessionStorage", () => {
    // Ensure no browser storage leakage
    expect(typeof window !== "undefined" ? window.localStorage.getItem("token") : null).toBeNull();
    expect(typeof window !== "undefined" ? window.localStorage.getItem("accessToken") : null).toBeNull();
    expect(typeof window !== "undefined" ? window.localStorage.getItem("refreshToken") : null).toBeNull();
    expect(typeof window !== "undefined" ? window.sessionStorage.getItem("token") : null).toBeNull();
  });
});

