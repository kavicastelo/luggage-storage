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
  ResendVerificationResponseData
} from "@luggage-storage/contracts";
import { fetchApi } from "./api-client";

export const authApi = {
  /**
   * Register a new user account on mobile with default TRAVELLER role assignment.
   */
  async register(data: RegisterRequest): Promise<RegisterResponseData> {
    const res = await fetchApi<RegisterResponseData>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  /**
   * Log in with credentials for mobile. Returns both access token and refresh token in body.
   */
  async login(data: LoginRequest): Promise<LoginResponseData> {
    const res = await fetchApi<LoginResponseData>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ ...data, clientType: "MOBILE" })
    });
    return res.data;
  },

  /**
   * Rotates refresh token explicitly for mobile.
   */
  async refresh(refreshToken: string): Promise<RefreshResponseData> {
    const res = await fetchApi<RefreshResponseData>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken, clientType: "MOBILE" }),
      skipAuthRefresh: true
    });
    return res.data;
  },

  /**
   * Logs out current session, revoking refresh token on server.
   */
  async logout(refreshToken?: string): Promise<LogoutResponseData> {
    const res = await fetchApi<LogoutResponseData>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
      skipAuthRefresh: true
    });
    return res.data;
  },

  /**
   * Revokes all active sessions across all devices for the authenticated user.
   */
  async logoutAll(): Promise<{ message: string }> {
    const res = await fetchApi<{ message: string }>("/auth/logout-all", {
      method: "POST"
    });
    return res.data;
  },

  /**
   * Retrieves profile, role assignments, and effective permissions for current user.
   */
  async getMe(): Promise<UserMeResponseData> {
    const res = await fetchApi<UserMeResponseData>("/auth/me");
    return res.data;
  },

  /**
   * Lists all active sessions for current user.
   */
  async getSessions(): Promise<SessionListResponseData> {
    const res = await fetchApi<SessionListResponseData>("/auth/sessions");
    return res.data;
  },

  /**
   * Revokes a specific session by ID.
   */
  async revokeSession(sessionId: string): Promise<{ message: string }> {
    const res = await fetchApi<{ message: string }>(`/auth/sessions/${sessionId}`, {
      method: "DELETE"
    });
    return res.data;
  },

  /**
   * Changes password and revokes sibling active sessions.
   */
  async changePassword(data: ChangePasswordRequest): Promise<ChangePasswordResponseData> {
    const res = await fetchApi<ChangePasswordResponseData>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  /**
   * Requests enumeration-resistant password reset instructions.
   */
  async forgotPassword(data: ForgotPasswordRequest): Promise<ForgotPasswordResponseData> {
    const res = await fetchApi<ForgotPasswordResponseData>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  /**
   * Completes password reset with single-use recovery token.
   */
  async resetPassword(data: ResetPasswordRequest): Promise<ResetPasswordResponseData> {
    const res = await fetchApi<ResetPasswordResponseData>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  /**
   * Completes self-service email verification with a single-use verification token.
   */
  async verifyEmail(data: VerifyEmailRequest): Promise<VerifyEmailResponseData> {
    const res = await fetchApi<VerifyEmailResponseData>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  /**
   * Requests a rate-limited verification email resend.
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
  }
};

