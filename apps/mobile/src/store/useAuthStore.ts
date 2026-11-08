import { create } from "zustand";
import {
  AuthenticatedUser,
  LoginRequest,
  RegisterRequest,
  RegisterResponseData
} from "@luggage-storage/contracts";
import { authApi } from "../services/auth-api";
import { secureStorage } from "../services/secure-storage.service";
import {
  setAccessToken,
  clearAccessToken,
  setAuthFailureHandler
} from "../services/api-client";

export interface MobileAuthState {
  user: AuthenticatedUser | null;
  sessionId: string | null;
  permissions: string[];
  isAuthenticated: boolean;
  isInitializing: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  initAuth: () => Promise<void>;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<RegisterResponseData>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearAuth: () => Promise<void>;
  setError: (error: string | null) => void;

  // Permission helpers
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
}

export const useAuthStore = create<MobileAuthState>((set, get) => {
  // Wire auth failure callback to reset local credentials
  setAuthFailureHandler(() => {
    set({
      user: null,
      sessionId: null,
      permissions: [],
      isAuthenticated: false,
      isInitializing: false,
      isLoading: false
    });
  });

  return {
    user: null,
    sessionId: null,
    permissions: [],
    isAuthenticated: false,
    isInitializing: true,
    isLoading: false,
    error: null,

    setError: (error: string | null) => set({ error }),

    clearAuth: async () => {
      await secureStorage.deleteRefreshToken();
      clearAccessToken();
      set({
        user: null,
        sessionId: null,
        permissions: [],
        isAuthenticated: false,
        isInitializing: false,
        isLoading: false,
        error: null
      });
    },

    /**
     * Session Restoration on Mobile Application Startup.
     * 1. Read stored refresh token from SecureStore.
     * 2. Call backend /auth/refresh with clientType: "MOBILE".
     * 3. Update SecureStore with new rotated refresh token.
     * 4. Update in-memory access token.
     * 5. Fetch profile & permissions via /auth/me.
     */
    initAuth: async () => {
      set({ isInitializing: true, error: null });
      try {
        const storedRefreshToken = await secureStorage.getRefreshToken();
        if (storedRefreshToken) {
          const refreshRes = await authApi.refresh(storedRefreshToken);

          // Update SecureStore with newly rotated refresh token
          if (refreshRes.refreshToken) {
            await secureStorage.setRefreshToken(refreshRes.refreshToken);
          }
          setAccessToken(refreshRes.accessToken);

          // Fetch authenticated user profile & permissions
          const meData = await authApi.getMe();
          set({
            user: meData.user,
            sessionId: meData.sessionId,
            permissions: meData.permissions || meData.user.permissions || [],
            isAuthenticated: true,
            isInitializing: false
          });
          return;
        }
      } catch {
        // Stale, revoked, reused, or expired token
      }

      await secureStorage.deleteRefreshToken();
      clearAccessToken();
      set({
        user: null,
        sessionId: null,
        permissions: [],
        isAuthenticated: false,
        isInitializing: false
      });
    },

    /**
     * Mobile Login with credentials.
     * Requires SecureStore persistence before establishing authenticated state.
     */
    login: async (credentials: LoginRequest) => {
      set({ isLoading: true, error: null });
      try {
        const loginData = await authApi.login(credentials);

        if (!loginData.refreshToken) {
          throw new Error("Mobile login did not return a refresh token from server");
        }

        // Persist rotated refresh token in SecureStore
        await secureStorage.setRefreshToken(loginData.refreshToken);
        setAccessToken(loginData.accessToken);

        // Fetch complete profile with effective permissions
        const meData = await authApi.getMe();
        set({
          user: meData.user,
          sessionId: meData.sessionId,
          permissions: meData.permissions || meData.user.permissions || [],
          isAuthenticated: true,
          isLoading: false,
          error: null
        });
      } catch (err) {
        await secureStorage.deleteRefreshToken();
        clearAccessToken();
        set({
          user: null,
          sessionId: null,
          permissions: [],
          isAuthenticated: false,
          isLoading: false,
          error: err instanceof Error ? err.message : "Authentication failed"
        });
        throw err;
      }
    },

    /**
     * User registration with default Traveller role assignment.
     */
    register: async (data: RegisterRequest) => {
      set({ isLoading: true, error: null });
      try {
        const registerData = await authApi.register(data);
        set({ isLoading: false, error: null });
        return registerData;
      } catch (err) {
        set({
          isLoading: false,
          error: err instanceof Error ? err.message : "Registration failed"
        });
        throw err;
      }
    },

    /**
     * Local logout with resilience against offline or network failures.
     */
    logout: async () => {
      set({ isLoading: true });
      try {
        const refreshToken = await secureStorage.getRefreshToken();
        if (refreshToken) {
          await authApi.logout(refreshToken);
        }
      } catch {
        // Do not retain local credentials merely because backend logout failed
      } finally {
        await get().clearAuth();
      }
    },

    /**
     * Logout across all devices.
     */
    logoutAll: async () => {
      set({ isLoading: true });
      try {
        await authApi.logoutAll();
      } catch {
        // Offline resilience
      } finally {
        await get().clearAuth();
      }
    },

    /**
     * Re-fetch profile and permissions.
     */
    refreshUser: async () => {
      try {
        const meData = await authApi.getMe();
        set({
          user: meData.user,
          sessionId: meData.sessionId,
          permissions: meData.permissions || meData.user.permissions || [],
          isAuthenticated: true
        });
      } catch {
        await get().clearAuth();
      }
    },

    /**
     * Permission evaluation helpers
     */
    hasPermission: (permission: string) => {
      const { permissions } = get();
      return permissions.includes(permission);
    },

    hasAnyPermission: (requiredPermissions: string[]) => {
      const { permissions } = get();
      return requiredPermissions.some((p) => permissions.includes(p));
    },

    hasAllPermissions: (requiredPermissions: string[]) => {
      const { permissions } = get();
      return requiredPermissions.every((p) => permissions.includes(p));
    }
  };
});

