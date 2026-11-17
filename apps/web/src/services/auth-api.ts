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
  SecurityAuditEvent,
  AdminUserQuery,
  AdminUserSummary,
  AdminUserDetail,
  AdminSuspendUserRequest,
  AdminReinstateUserRequest,
  AdminDeactivateUserRequest,
  AdminReactivateUserRequest,
  AdminVerifyEmailRequest,
  AdminLifecycleActionResponseData,
  AdminAuditEventQuery,
  Permission,
  RoleDetail,
  AssignUserRoleRequest,
  AssignUserRoleResponseData,
  RevokeUserRoleResponseData,
  UserProfileResponseData,
  UpdateProfileRequest,
  UpdateProfileResponseData,
  UserEffectivePermissionsResponseData,
  PaginatedApiResponse,
  PaginationMeta
} from "@luggage-storage/contracts";
import { fetchApi } from "../lib/api-client";

function buildDefaultPagination(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
}

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
  },

  /**
   * Retrieve paginated & filterable security audit events with full pagination metadata.
   */
  async listAdminAuditEventsPaginated(
    params: Partial<AdminAuditEventQuery> = {}
  ): Promise<{ items: SecurityAuditEvent[]; pagination: PaginationMeta }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 25;
    const search = new URLSearchParams();
    search.set("page", String(page));
    search.set("limit", String(limit));
    if (params.eventType) search.set("eventType", params.eventType);
    if (params.userId) search.set("userId", params.userId);
    if (params.from) search.set("from", params.from);
    if (params.to) search.set("to", params.to);
    const res = (await fetchApi<SecurityAuditEvent[]>(
      `/admin/audit-events?${search.toString()}`
    )) as unknown as PaginatedApiResponse<SecurityAuditEvent>;
    const items = Array.isArray(res.data) ? res.data : [];
    const pagination = res.pagination ?? buildDefaultPagination(page, limit, items.length);
    return { items, pagination };
  },

  async getAdminAuditEventById(eventId: string): Promise<SecurityAuditEvent> {
    const res = await fetchApi<{ event: SecurityAuditEvent }>(
      `/admin/audit-events/${eventId}`
    );
    return res.data.event;
  },

  // ==========================================================================
  // Administrative User Lifecycle & RBAC Governance (AD-018)
  // ==========================================================================

  async listAdminUsers(
    params: Partial<AdminUserQuery> = {}
  ): Promise<{ users: AdminUserSummary[]; pagination: PaginationMeta }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const search = new URLSearchParams();
    search.set("page", String(page));
    search.set("limit", String(limit));
    if (params.status) search.set("status", params.status);
    if (params.search) search.set("search", params.search);
    if (params.role) search.set("role", params.role);
    const res = (await fetchApi<AdminUserSummary[]>(
      `/admin/users?${search.toString()}`
    )) as unknown as PaginatedApiResponse<AdminUserSummary>;
    const users = Array.isArray(res.data) ? res.data : [];
    const pagination = res.pagination ?? buildDefaultPagination(page, limit, users.length);
    return { users, pagination };
  },

  async getAdminUserById(userId: string): Promise<AdminUserDetail> {
    const res = await fetchApi<AdminUserDetail>(`/admin/users/${userId}`);
    return res.data;
  },

  async suspendAdminUser(
    userId: string,
    data: AdminSuspendUserRequest
  ): Promise<AdminLifecycleActionResponseData> {
    const res = await fetchApi<AdminLifecycleActionResponseData>(
      `/admin/users/${userId}/suspend`,
      { method: "POST", body: JSON.stringify(data) }
    );
    return res.data;
  },

  async reinstateAdminUser(
    userId: string,
    data: AdminReinstateUserRequest = {}
  ): Promise<AdminLifecycleActionResponseData> {
    const res = await fetchApi<AdminLifecycleActionResponseData>(
      `/admin/users/${userId}/reinstate`,
      { method: "POST", body: JSON.stringify(data) }
    );
    return res.data;
  },

  async deactivateAdminUser(
    userId: string,
    data: AdminDeactivateUserRequest
  ): Promise<AdminLifecycleActionResponseData> {
    const res = await fetchApi<AdminLifecycleActionResponseData>(
      `/admin/users/${userId}/deactivate`,
      { method: "POST", body: JSON.stringify(data) }
    );
    return res.data;
  },

  async reactivateAdminUser(
    userId: string,
    data: AdminReactivateUserRequest = {}
  ): Promise<AdminLifecycleActionResponseData> {
    const res = await fetchApi<AdminLifecycleActionResponseData>(
      `/admin/users/${userId}/reactivate`,
      { method: "POST", body: JSON.stringify(data) }
    );
    return res.data;
  },

  async verifyAdminUserEmail(
    userId: string,
    data: AdminVerifyEmailRequest = {}
  ): Promise<AdminLifecycleActionResponseData> {
    const res = await fetchApi<AdminLifecycleActionResponseData>(
      `/admin/users/${userId}/verify-email`,
      { method: "POST", body: JSON.stringify(data) }
    );
    return res.data;
  },

  async listAdminRoles(): Promise<RoleDetail[]> {
    const res = await fetchApi<RoleDetail[] | { roles: RoleDetail[] }>("/admin/roles");
    return Array.isArray(res.data) ? res.data : (res.data?.roles ?? []);
  },

  async listAdminPermissions(): Promise<Permission[]> {
    const res = await fetchApi<Permission[] | { permissions: Permission[] }>(
      "/admin/permissions"
    );
    return Array.isArray(res.data) ? res.data : (res.data?.permissions ?? []);
  },

  async getAdminUserPermissions(userId: string): Promise<UserEffectivePermissionsResponseData> {
    const res = await fetchApi<UserEffectivePermissionsResponseData>(
      `/admin/users/${userId}/permissions`
    );
    return res.data;
  },

  async assignAdminUserRole(
    userId: string,
    data: AssignUserRoleRequest
  ): Promise<AssignUserRoleResponseData> {
    const res = await fetchApi<AssignUserRoleResponseData>(`/admin/users/${userId}/roles`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async revokeAdminUserRole(
    userId: string,
    roleCode: string
  ): Promise<RevokeUserRoleResponseData> {
    const res = await fetchApi<RevokeUserRoleResponseData>(
      `/admin/users/${userId}/roles/${encodeURIComponent(roleCode)}`,
      { method: "DELETE" }
    );
    return res.data;
  },

  /**
   * Retrieve the authenticated user's full self-service profile.
   */
  async getIdentityProfile(): Promise<UserProfileResponseData> {
    const res = await fetchApi<UserProfileResponseData>("/identity/profile");
    return res.data;
  },

  /**
   * Update explicitly permitted self-service profile fields.
   */
  async updateIdentityProfile(
    data: UpdateProfileRequest
  ): Promise<UpdateProfileResponseData> {
    const res = await fetchApi<UpdateProfileResponseData>("/identity/profile", {
      method: "PATCH",
      body: JSON.stringify(data)
    });
    return res.data;
  }
};

