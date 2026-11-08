import { create } from "zustand";
import {
  AuthenticatedUser,
  LoginRequest,
  RegisterRequest,
  RegisterResponseData
} from "@luggage-storage/contracts";
import { authApi } from "../services/auth-api";
import {
  setAccessToken,
  clearAccessToken,
  refreshAccessToken,
  setAuthFailureHandler
} from "../lib/api-client";

export interface AuthState {
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
  clearAuth: () => void;
  setError: (error: string | null) => void;

  // Permission checks
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Wire up the API client failure callback to reset auth store
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

    clearAuth: () => {
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
     * Initializes authentication state on application startup or page reload.
     * Attempts to rotate refresh token via HTTP-only cookie.
     */
    initAuth: async () => {
      set({ isInitializing: true, error: null });
      try {
        const token = await refreshAccessToken();
        if (token) {
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
        // Unauthenticated or expired session
      }

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
     * Authenticates user with credentials and updates in-memory token and state.
     */
    login: async (credentials: LoginRequest) => {
      set({ isLoading: true, error: null });
      try {
        const loginData = await authApi.login(credentials);
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
     * Registers a new user account.
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
     * Logs out the current session and clears state.
     */
    logout: async () => {
      set({ isLoading: true });
      try {
        await authApi.logout();
      } catch {
        // Ensure state is cleared even if server error occurs
      } finally {
        get().clearAuth();
      }
    },

    /**
     * Logs out all sessions for the user across all devices.
     */
    logoutAll: async () => {
      set({ isLoading: true });
      try {
        await authApi.logoutAll();
      } catch {
        // Ignore server error on cleanup
      } finally {
        get().clearAuth();
      }
    },

    /**
     * Re-fetches the current authenticated user profile and permissions.
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
        get().clearAuth();
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

