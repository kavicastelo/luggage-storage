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
import { queryClient } from "../lib/query-client";

export interface AuthState {
  user: AuthenticatedUser | null;
  sessionId: string | null;
  permissions: string[];
  isAuthenticated: boolean;
  isInitializing: boolean;
  isLoading: boolean;
  error: string | null;
  logoutWarning: string | null;

  // Actions
  initAuth: () => Promise<void>;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<RegisterResponseData>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshSessionAndUser: () => Promise<void>;
  clearAuth: () => void;
  setError: (error: string | null) => void;

  // Permission checks
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
}

let logoutInFlight: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => {
  // Wire up the API client failure callback to reset auth store
  setAuthFailureHandler(() => {
    queryClient.clear();
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
    logoutWarning: null,

    setError: (error: string | null) => set({ error }),

    clearAuth: () => {
      clearAccessToken();
      queryClient.clear();
      set({
        user: null,
        sessionId: null,
        permissions: [],
        isAuthenticated: false,
        isInitializing: false,
        isLoading: false,
        error: null,
        logoutWarning: null
      });
    },

    /**
     * Initializes authentication state on application startup or page reload.
     * Attempts to rotate refresh token via HTTP-only cookie.
     */
    initAuth: async () => {
      set({ isInitializing: true, error: null, logoutWarning: null });
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
      set({ isLoading: true, error: null, logoutWarning: null });
      try {
        const loginData = await authApi.login(credentials);
        setAccessToken(loginData.accessToken);

        // Fetch complete profile with effective permissions
        const meData = await authApi.getMe();
        queryClient.clear();
        set({
          user: meData.user,
          sessionId: meData.sessionId,
          permissions: meData.permissions || meData.user.permissions || [],
          isAuthenticated: true,
          isLoading: false,
          error: null,
          logoutWarning: null
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
      if (logoutInFlight) {
        return logoutInFlight;
      }

      logoutInFlight = (async () => {
        set({ isLoading: true, logoutWarning: null });
        let revocationWarning: string | null = null;
        try {
          await authApi.logout();
        } catch {
          // Ensure state is cleared even if server error occurs
          revocationWarning =
            "Signed out locally, but server session revocation could not be confirmed.";
        } finally {
          get().clearAuth();
          if (revocationWarning) {
            set({ logoutWarning: revocationWarning });
          }
          logoutInFlight = null;
        }
      })();

      return logoutInFlight;
    },

    /**
     * Logs out all sessions for the user across all devices.
     */
    logoutAll: async () => {
      set({ isLoading: true, logoutWarning: null });
      let revocationWarning: string | null = null;
      try {
        await authApi.logoutAll();
      } catch {
        // Ignore server error on cleanup while surfacing revocation failure warning
        revocationWarning =
          "Signed out locally, but server session revocation could not be confirmed.";
      } finally {
        get().clearAuth();
        if (revocationWarning) {
          set({ logoutWarning: revocationWarning });
        }
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
     * Rotates the session token to obtain updated JWT role claims and reloads user profile.
     */
    refreshSessionAndUser: async () => {
      const token = await refreshAccessToken();
      if (!token) {
        get().clearAuth();
        return;
      }
      await get().refreshUser();
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

