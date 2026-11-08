import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAuthStore } from "../src/store/useAuthStore";
import { authApi } from "../src/services/auth-api";
import { secureStorage } from "../src/services/secure-storage.service";
import { getAccessToken, clearAccessToken } from "../src/services/api-client";
import { AuthenticatedUser } from "@luggage-storage/contracts";

describe("Mobile useAuthStore (Session Lifecycle & SecureStore)", () => {
  const mockUser: AuthenticatedUser = {
    id: "m0000000-0000-0000-0000-000000000001",
    email: "mobile.traveller@example.com",
    displayName: "Mobile User",
    status: "ACTIVE",
    isEmailVerified: true,
    isPhoneVerified: true,
    roles: ["TRAVELLER"],
    lastLoginAt: new Date().toISOString()
  };

  const mockPermissions = [
    "identity.profile.read",
    "identity.profile.update",
    "identity.session.read_own",
    "identity.session.revoke_own"
  ];

  beforeEach(async () => {
    vi.restoreAllMocks();
    clearAccessToken();
    await secureStorage.deleteRefreshToken();
    await useAuthStore.getState().clearAuth();
  });

  it("should initialize with default unauthenticated state", () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.sessionId).toBeNull();
    expect(state.permissions).toEqual([]);
    expect(state.isAuthenticated).toBe(false);
    expect(state.isInitializing).toBe(false);
  });

  it("should restore session on initAuth when SecureStore has valid refresh token", async () => {
    await secureStorage.setRefreshToken("persisted-refresh-token");

    vi.spyOn(authApi, "refresh").mockResolvedValue({
      accessToken: "fresh-jwt-token",
      refreshToken: "rotated-refresh-token",
      expiresIn: 900,
      tokenType: "Bearer"
    });

    vi.spyOn(authApi, "getMe").mockResolvedValue({
      user: mockUser,
      sessionId: "s-mobile-1",
      permissions: mockPermissions
    });

    await useAuthStore.getState().initAuth();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.isInitializing).toBe(false);
    expect(state.user?.email).toBe("mobile.traveller@example.com");
    expect(getAccessToken()).toBe("fresh-jwt-token");
    expect(await secureStorage.getRefreshToken()).toBe("rotated-refresh-token");
  });

  it("should clear SecureStore and local state on initAuth when refresh fails", async () => {
    await secureStorage.setRefreshToken("stale-expired-token");

    vi.spyOn(authApi, "refresh").mockRejectedValue(new Error("Token expired or revoked"));

    await useAuthStore.getState().initAuth();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isInitializing).toBe(false);
    expect(state.user).toBeNull();
    expect(await secureStorage.getRefreshToken()).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it("should authenticate and persist refresh token in SecureStore on login", async () => {
    vi.spyOn(authApi, "login").mockResolvedValue({
      user: mockUser,
      accessToken: "login-jwt-access-token",
      refreshToken: "login-raw-refresh-token",
      expiresIn: 900,
      tokenType: "Bearer"
    });

    vi.spyOn(authApi, "getMe").mockResolvedValue({
      user: mockUser,
      sessionId: "s-mobile-login",
      permissions: mockPermissions
    });

    await useAuthStore.getState().login({
      email: "mobile.traveller@example.com",
      password: "ValidPassword123!"
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(getAccessToken()).toBe("login-jwt-access-token");
    expect(await secureStorage.getRefreshToken()).toBe("login-raw-refresh-token");
  });

  it("should fail login and not establish session if SecureStore fails", async () => {
    vi.spyOn(authApi, "login").mockResolvedValue({
      user: mockUser,
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 900,
      tokenType: "Bearer"
    });

    // Simulate SecureStore hardware write failure
    vi.spyOn(secureStorage, "setRefreshToken").mockRejectedValue(
      new Error("Hardware Keystore write error")
    );

    await expect(
      useAuthStore.getState().login({
        email: "test@example.com",
        password: "ValidPassword123!"
      })
    ).rejects.toThrow(/Hardware Keystore write error/);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it("should clear local credentials on logout even if backend request fails (offline resilience)", async () => {
    await secureStorage.setRefreshToken("active-token");
    useAuthStore.setState({
      user: mockUser,
      isAuthenticated: true
    });

    vi.spyOn(authApi, "logout").mockRejectedValue(new Error("Network connection lost"));

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(await secureStorage.getRefreshToken()).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it("should evaluate permissions correctly", () => {
    useAuthStore.setState({
      permissions: [
        "identity.profile.read",
        "identity.profile.update",
        "storage.scanner.verify"
      ]
    });

    const store = useAuthStore.getState();
    expect(store.hasPermission("identity.profile.read")).toBe(true);
    expect(store.hasPermission("storage.scanner.verify")).toBe(true);
    expect(store.hasPermission("admin.user.suspend")).toBe(false);

    expect(store.hasAnyPermission(["admin.user.suspend", "identity.profile.read"])).toBe(true);
    expect(store.hasAllPermissions(["identity.profile.read", "identity.profile.update"])).toBe(true);
    expect(store.hasAllPermissions(["identity.profile.read", "admin.user.suspend"])).toBe(false);
  });
});

