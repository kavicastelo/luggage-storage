import {
  RegisterRequest,
  RegisterResponseData,
  LoginRequest,
  LoginResponseData,
  RefreshResponseData,
  LogoutResponseData,
  UserMeResponseData,
  SessionListResponseData,
  ChangePasswordRequest,
  ChangePasswordResponseData,
  ForgotPasswordRequest,
  ForgotPasswordResponseData,
  ResetPasswordRequest,
  ResetPasswordResponseData,
  VerifyEmailRequest,
  VerifyEmailResponseData,
  ResendVerificationRequest,
  ResendVerificationResponseData,
  SecurityAuditEvent
} from "@luggage-storage/contracts";
import { fetchApi } from "../lib/api-client";

export const authApi = {
  /**
   * Register a new user account with default TRAVELLER role assignment.
   */
  async register(data: RegisterRequest): Promise<RegisterResponseData> {
    const res = await fetchApi<RegisterResponseData>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  /**
   * Log in using email and password. Sets HTTP-only refresh cookie for Web clients.
   */
  async login(data: LoginRequest): Promise<LoginResponseData> {
    const res = await fetchApi<LoginResponseData>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ ...data, clientType: "WEB" })
    });
    return res.data;
  },

  /**
   * Manually rotate refresh token via HTTP-only cookie.
   */
  async refresh(): Promise<RefreshResponseData> {
    const res = await fetchApi<RefreshResponseData>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ clientType: "WEB" }),
      skipAuthRefresh: true
    });
    return res.data;
  },

  /**
   * Log out the current session and clear refresh cookie.
   */
  async logout(): Promise<LogoutResponseData> {
    const res = await fetchApi<LogoutResponseData>("/auth/logout", {
      method: "POST",
      skipAuthRefresh: true
    });
    return res.data;
  },

  /**
   * Log out all active sessions across all devices for the authenticated user.
   */
  async logoutAll(): Promise<{ message: string }> {
    const res = await fetchApi<{ message: string }>("/auth/logout-all", {
      method: "POST"
    });
    return res.data;
  },

  /**
   * Retrieve the current authenticated user's profile and active session ID.
   */
  async getMe(): Promise<UserMeResponseData> {
    const res = await fetchApi<UserMeResponseData>("/auth/me");
    return res.data;
  },

  /**
   * List all active sessions for the current authenticated user.
   */
  async getSessions(): Promise<SessionListResponseData> {
    const res = await fetchApi<SessionListResponseData>("/auth/sessions");
    return res.data;
  },

  /**
   * Revoke a specific active session belonging to the user.
   */
  async revokeSession(sessionId: string): Promise<{ message: string }> {
    const res = await fetchApi<{ message: string }>(`/auth/sessions/${sessionId}`, {
      method: "DELETE"
    });
    return res.data;
  },

  /**
   * Authenticated password change. Updates password and revokes all other active sessions.
   */
  async changePassword(data: ChangePasswordRequest): Promise<ChangePasswordResponseData> {
    const res = await fetchApi<ChangePasswordResponseData>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  /**
   * Enumeration-resistant password recovery request.
   */
  async forgotPassword(data: ForgotPasswordRequest): Promise<ForgotPasswordResponseData> {
    const res = await fetchApi<ForgotPasswordResponseData>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  /**
   * Execute password reset with single-use token. Revokes all active sessions.
   */
  async resetPassword(data: ResetPasswordRequest): Promise<ResetPasswordResponseData> {
    const res = await fetchApi<ResetPasswordResponseData>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  /**
   * Self-service email verification using single-use token.
   */
  async verifyEmail(data: VerifyEmailRequest): Promise<VerifyEmailResponseData> {
    const res = await fetchApi<VerifyEmailResponseData>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  /**
   * Request a fresh email verification link for an unverified account.
   */
  async resendVerification(
    data: ResendVerificationRequest
  ): Promise<ResendVerificationResponseData> {
    const res = await fetchApi<ResendVerificationResponseData>(
      "/auth/resend-verification",
      {
        method: "POST",
        body: JSON.stringify(data)
      }
    );
    return res.data;
  },

  /**
   * Retrieve paginated security audit events (requires SUPERADMIN / admin.audit.read).
   */
  async listAdminAuditEvents(params?: {
    page?: number;
    limit?: number;
    eventType?: string;
    userId?: string;
  }): Promise<SecurityAuditEvent[]> {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.eventType) search.set("eventType", params.eventType);
    if (params?.userId) search.set("userId", params.userId);
    const queryString = search.toString();
    const res = await fetchApi<SecurityAuditEvent[]>(
      `/admin/audit-events${queryString ? `?${queryString}` : ""}`
    );
    return res.data;
  }
};

