import React, { useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  SYSTEM_PERMISSIONS,
  SYSTEM_ROLES,
  type UserStatus
} from "@luggage-storage/contracts";
import {
  CheckCircle2,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  UserMinus,
  UserPlus,
  X
} from "lucide-react";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { Modal, SlideOverDrawer } from "@/components/ui";
import { isDemoPreviewActive } from "@/config/demo-preview";
import {
  useAdminPermissionsQuery,
  useAdminRolesQuery,
  useAdminUserDetailQuery,
  useAdminUserPermissionsQuery,
  useAdminUsersQuery,
  useAssignAdminUserRoleMutation,
  useAssignRolePermissionMutation,
  useDeactivateAdminUserMutation,
  useReactivateAdminUserMutation,
  useReinstateAdminUserMutation,
  useResetRolePermissionsMutation,
  useRevokeAdminUserRoleMutation,
  useRevokeRolePermissionMutation,
  useSuspendAdminUserMutation,
  useVerifyAdminUserEmailMutation
} from "@/hooks/queries/use-admin-portal";
import { formatDateTimeDisplay } from "@/lib/formatters";
import { useAuthStore } from "@/store/useAuthStore";
import {
  AdminCardListSkeleton,
  AdminEmptyStateCard,
  AdminPageHeader,
  AdminPaginationBar,
  AdminQueryErrorAlert,
  AdminTableSkeleton,
  isUuid,
  statusBadgeToneClasses
} from "./admin-helpers";

const USER_STATUS_OPTIONS: Array<{ value: UserStatus | ""; label: string }> = [
  { value: "", label: "All Statuses" },
  { value: "ACTIVE", label: "ACTIVE" },
  { value: "PENDING_VERIFICATION", label: "PENDING_VERIFICATION" },
  { value: "SUSPENDED", label: "SUSPENDED" },
  { value: "DEACTIVATED", label: "DEACTIVATED" }
];

type ActiveWorkspaceTab = "users" | "matrix";

const PROTECTED_SUPERADMIN_PERMISSIONS = new Set([
  "admin.platform.manage",
  "admin.role.assign",
  "admin.role.revoke",
  "admin.role.read",
  "admin.permission.read"
]);

export function AdminUsersRbacPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuthStore();

  const showDemoPreview =
    !isAuthenticated &&
    isDemoPreviewActive({
      allowDemoPreview: true,
      search: location.search,
      isAuthenticated
    });

  const isRbacPath = location.pathname.includes("/rbac") || location.pathname.includes("/roles");
  const tabParam = searchParams.get("tab");
  const initialTab: ActiveWorkspaceTab = tabParam === "matrix" || isRbacPath ? "matrix" : "users";
  const [activeTab, setActiveTab] = useState<ActiveWorkspaceTab>(initialTab);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "">("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const inspectParam = searchParams.get("inspect");
  const [localInspectId, setLocalInspectId] = useState<string | null>(null);
  const inspectedUserId =
    (isUuid(inspectParam) ? inspectParam : null) ??
    (isUuid(localInspectId) ? localInspectId : null);

  const [lifecycleAction, setLifecycleAction] = useState<
    "SUSPEND" | "REINSTATE" | "DEACTIVATE" | "REACTIVATE" | "VERIFY_EMAIL" | null
  >(null);
  const [reasonInput, setReasonInput] = useState("");
  const [roleToAssign, setRoleToAssign] = useState<string>(SYSTEM_ROLES[0]);
  const [pendingRevokeRole, setPendingRevokeRole] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const usersQuery = useAdminUsersQuery(
    {
      page,
      limit,
      status: statusFilter || undefined,
      role: roleFilter || undefined,
      search: appliedSearch || undefined
    },
    { enabled: isAuthenticated && !showDemoPreview }
  );

  const rolesQuery = useAdminRolesQuery({
    enabled: isAuthenticated && !showDemoPreview
  });
  const permissionsQuery = useAdminPermissionsQuery({
    enabled: isAuthenticated && !showDemoPreview
  });

  const userDetailQuery = useAdminUserDetailQuery(inspectedUserId ?? undefined, {
    enabled: isAuthenticated && !showDemoPreview && Boolean(inspectedUserId)
  });
  const userPermissionsQuery = useAdminUserPermissionsQuery(inspectedUserId ?? undefined, {
    enabled: isAuthenticated && !showDemoPreview && Boolean(inspectedUserId)
  });

  const suspendMutation = useSuspendAdminUserMutation();
  const reinstateMutation = useReinstateAdminUserMutation();
  const deactivateMutation = useDeactivateAdminUserMutation();
  const reactivateMutation = useReactivateAdminUserMutation();
  const verifyEmailMutation = useVerifyAdminUserEmailMutation();
  const assignRoleMutation = useAssignAdminUserRoleMutation();
  const revokeRoleMutation = useRevokeAdminUserRoleMutation();
  const assignRolePermMutation = useAssignRolePermissionMutation();
  const revokeRolePermMutation = useRevokeRolePermissionMutation();
  const resetRolePermsMutation = useResetRolePermissionsMutation();

  const [selectedPermByRole, setSelectedPermByRole] = useState<Record<string, string>>({});
  const [showResetDefaultsModal, setShowResetDefaultsModal] = useState(false);
  const [matrixFeedback, setMatrixFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleAssignRolePermission = async (roleCode: string) => {
    setMatrixFeedback(null);
    const assignedPerms = roles.find((r) => r.code === roleCode)?.permissions ?? [];
    const available = permissions.filter((p) => !assignedPerms.includes(p.code));
    const permToAssign = selectedPermByRole[roleCode] || available[0]?.code;
    if (!permToAssign) return;

    try {
      const res = await assignRolePermMutation.mutateAsync({
        roleCode,
        permissionCode: permToAssign
      });
      setMatrixFeedback({
        type: "success",
        message: res.message || `Permission ${permToAssign} granted to ${roleCode}`
      });
      const remaining = available.filter((p) => p.code !== permToAssign);
      if (remaining.length > 0) {
        setSelectedPermByRole((prev) => ({ ...prev, [roleCode]: remaining[0].code }));
      }
    } catch (err) {
      setMatrixFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to assign permission"
      });
    }
  };

  const handleRevokeRolePermission = async (roleCode: string, permissionCode: string) => {
    setMatrixFeedback(null);
    try {
      const res = await revokeRolePermMutation.mutateAsync({
        roleCode,
        permissionCode
      });
      setMatrixFeedback({
        type: "success",
        message: res.message || `Permission ${permissionCode} revoked from ${roleCode}`
      });
    } catch (err) {
      setMatrixFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to revoke permission"
      });
    }
  };

  const handleResetDefaults = async () => {
    setMatrixFeedback(null);
    try {
      const res = await resetRolePermsMutation.mutateAsync();
      setShowResetDefaultsModal(false);
      setMatrixFeedback({
        type: "success",
        message: res.message || "All role permissions reset to standard defaults"
      });
    } catch (err) {
      setShowResetDefaultsModal(false);
      setMatrixFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to reset permissions"
      });
    }
  };

  const users = usersQuery.data?.users ?? [];
  const pagination = usersQuery.data?.pagination;
  const roles = rolesQuery.data ?? [];
  const permissions = permissionsQuery.data ?? [];

  const openInspector = (userId: string) => {
    setActionError(null);
    setActionSuccess(null);
    setLifecycleAction(null);
    setPendingRevokeRole(null);
    setReasonInput("");
    setLocalInspectId(userId);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("inspect", userId);
    setSearchParams(nextParams);
  };

  const closeInspector = () => {
    setLocalInspectId(null);
    setLifecycleAction(null);
    setPendingRevokeRole(null);
    setReasonInput("");
    setActionError(null);
    if (searchParams.has("inspect")) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("inspect");
      setSearchParams(nextParams);
    }
  };

  const handleLifecycleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectedUserId || !lifecycleAction) return;
    setActionError(null);
    setActionSuccess(null);

    const trimmedReason = reasonInput.trim();
    if (
      (lifecycleAction === "SUSPEND" || lifecycleAction === "DEACTIVATE") &&
      trimmedReason.length < 3
    ) {
      setActionError("A governance reason of at least 3 characters is required.");
      return;
    }
    if (trimmedReason.length > 0 && trimmedReason.length < 3) {
      setActionError("Optional reason must be at least 3 characters when entered.");
      return;
    }

    try {
      let res;
      if (lifecycleAction === "SUSPEND") {
        res = await suspendMutation.mutateAsync({
          userId: inspectedUserId,
          data: { reason: trimmedReason }
        });
      } else if (lifecycleAction === "REINSTATE") {
        res = await reinstateMutation.mutateAsync({
          userId: inspectedUserId,
          data: trimmedReason.length >= 3 ? { reason: trimmedReason } : {}
        });
      } else if (lifecycleAction === "DEACTIVATE") {
        res = await deactivateMutation.mutateAsync({
          userId: inspectedUserId,
          data: { reason: trimmedReason }
        });
      } else if (lifecycleAction === "REACTIVATE") {
        res = await reactivateMutation.mutateAsync({
          userId: inspectedUserId,
          data: trimmedReason.length >= 3 ? { reason: trimmedReason } : {}
        });
      } else {
        res = await verifyEmailMutation.mutateAsync({
          userId: inspectedUserId,
          data: trimmedReason.length >= 3 ? { reason: trimmedReason } : {}
        });
      }
      setActionSuccess(res.message);
      setLifecycleAction(null);
      setReasonInput("");
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Unable to update account lifecycle status."
      );
    }
  };

  const handleAssignRole = async () => {
    if (!inspectedUserId || !roleToAssign) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await assignRoleMutation.mutateAsync({
        userId: inspectedUserId,
        data: { roleCode: roleToAssign }
      });
      setActionSuccess(res.message);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to assign user role.");
    }
  };

  const handleConfirmRevokeRole = async () => {
    if (!inspectedUserId || !pendingRevokeRole) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await revokeRoleMutation.mutateAsync({
        userId: inspectedUserId,
        roleCode: pendingRevokeRole
      });
      setActionSuccess(res.message);
      setPendingRevokeRole(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to revoke user role.");
      setPendingRevokeRole(null);
    }
  };

  const availableRoleCodes = roles.length > 0 ? roles.map((r) => r.code) : [...SYSTEM_ROLES];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Platform Users, Account Lifecycle & RBAC"
        subtitle="Manage traveller, host, support, and superadmin account statuses, active sessions, verified email states, and system RBAC role assignments."
        badge={showDemoPreview ? "Demo Preview" : "Identity RBAC"}
      />

      {usersQuery.isError && (
        <AdminQueryErrorAlert
          message={
            usersQuery.error instanceof Error
              ? usersQuery.error.message
              : "Unable to load platform users directory."
          }
          onRetry={() => void usersQuery.refetch()}
        />
      )}

      {actionError && (
        <AdminQueryErrorAlert
          message={actionError}
          onRetry={() => {
            if (inspectedUserId) {
              void userDetailQuery.refetch();
              void userPermissionsQuery.refetch();
            }
          }}
        />
      )}

      {actionSuccess && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900"
        >
          {actionSuccess}
        </div>
      )}

      {/* Workspace Tabs */}
      {!showDemoPreview && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "users"
                ? "bg-navy-900 text-white shadow-sm"
                : "bg-white border border-sand-200 text-navy-900 hover:bg-sand-100"
            }`}
          >
            Users Directory & Lifecycle
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("matrix")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "matrix"
                ? "bg-navy-900 text-white shadow-sm"
                : "bg-white border border-sand-200 text-navy-900 hover:bg-sand-100"
            }`}
          >
            Roles & Permissions Matrix ({roles.length})
          </button>
        </div>
      )}

      {showDemoPreview ? (
        <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-3 text-xs shadow-sm">
          <p className="font-bold text-navy-950">Role-Based Access Control (Demo Preview)</p>
          <p className="text-sand-700">
            System RBAC matrix covers SUPERADMIN, SUPPORT, HOST_OWNER, HOST_STAFF, and TRAVELLER.
          </p>
        </div>
      ) : activeTab === "matrix" ? (
        <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-5 text-xs shadow-sm">
          {rolesQuery.isError && (
            <AdminQueryErrorAlert
              message={
                rolesQuery.error instanceof Error
                  ? rolesQuery.error.message
                  : "Unable to load RBAC roles."
              }
              onRetry={() => void rolesQuery.refetch()}
            />
          )}
          {rolesQuery.isLoading ? (
            <AdminCardListSkeleton count={3} />
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-extrabold text-navy-950">System Roles Breakdown</h2>
                    <p className="text-sand-600 text-[11px]">
                      Configure granular permission entitlements for each marketplace role.
                    </p>
                  </div>
                  <PermissionGate permission={SYSTEM_PERMISSIONS.ADMIN_PLATFORM_MANAGE}>
                    <button
                      type="button"
                      onClick={() => setShowResetDefaultsModal(true)}
                      disabled={resetRolePermsMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-sand-300 bg-white hover:bg-sand-100 font-bold text-navy-950 transition text-xs shadow-sm"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-terracotta-600" />
                      Reset to Platform Defaults
                    </button>
                  </PermissionGate>
                </div>

                {matrixFeedback && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                      matrixFeedback.type === "success"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                        : "bg-rose-50 border-rose-200 text-rose-900"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {matrixFeedback.type === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span>{matrixFeedback.message}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMatrixFeedback(null)}
                      className="text-sand-500 hover:text-navy-900 ml-2"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {roles.map((r) => {
                    const unassignedPerms = permissions.filter(
                      (p) => !r.permissions.includes(p.code)
                    );
                    const selectedPerm =
                      selectedPermByRole[r.code] || (unassignedPerms[0]?.code ?? "");

                    return (
                      <div
                        key={r.id}
                        className="p-4 rounded-xl border border-sand-200 bg-sand-50/70 space-y-3 flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-navy-950 text-sm">
                              {r.code}
                            </span>
                            <span className="text-[11px] font-semibold text-sand-700 tabular-nums">
                              {r.permissions.length} permission(s)
                            </span>
                          </div>
                          <p className="text-navy-900 text-[11px]">{r.description || r.name}</p>

                          {/* Permission Pills */}
                          <div className="flex flex-wrap gap-1 pt-1">
                            {r.permissions.length === 0 ? (
                              <p className="text-[11px] text-amber-700 italic">
                                No permissions assigned. Users with this role cannot perform authorized actions.
                              </p>
                            ) : (
                              r.permissions.map((perm) => {
                                const isSuperadminProtected =
                                  r.code === "SUPERADMIN" &&
                                  PROTECTED_SUPERADMIN_PERMISSIONS.has(perm);

                                return (
                                  <span
                                    key={perm}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-sand-200 font-mono text-[10px] text-navy-900"
                                  >
                                    <span>{perm}</span>
                                    {!isSuperadminProtected && (
                                      <PermissionGate
                                        permission={SYSTEM_PERMISSIONS.ADMIN_ROLE_REVOKE}
                                      >
                                        <button
                                          type="button"
                                          disabled={revokeRolePermMutation.isPending}
                                          onClick={() =>
                                            void handleRevokeRolePermission(r.code, perm)
                                          }
                                          className="text-sand-400 hover:text-rose-600 transition p-0.5 ml-0.5"
                                          title={`Revoke ${perm} from ${r.code}`}
                                        >
                                          <X className="w-2.5 h-2.5" />
                                        </button>
                                      </PermissionGate>
                                    )}
                                  </span>
                                );
                              })
                            )}
                          </div>
                        </div>

                        {/* Add Permission Dropdown & Button */}
                        <PermissionGate permission={SYSTEM_PERMISSIONS.ADMIN_ROLE_ASSIGN}>
                          {unassignedPerms.length > 0 ? (
                            <div className="pt-2 border-t border-sand-200 flex items-center gap-2">
                              <select
                                value={selectedPerm}
                                onChange={(e) =>
                                  setSelectedPermByRole((prev) => ({
                                    ...prev,
                                    [r.code]: e.target.value
                                  }))
                                }
                                className="flex-1 px-2.5 py-1.5 rounded-lg border border-sand-200 bg-white font-mono text-[11px] text-navy-950 w-[200px]"
                              >
                                {unassignedPerms.map((p) => (
                                  <option key={p.id} value={p.code}>
                                    {p.code} — {p.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={assignRolePermMutation.isPending}
                                onClick={() => void handleAssignRolePermission(r.code)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white font-bold text-[11px] transition disabled:opacity-50 shrink-0"
                              >
                                <Plus className="w-3 h-3" /> Add
                              </button>
                            </div>
                          ) : (
                            <p className="text-[10px] text-sand-500 italic pt-2 border-t border-sand-200">
                              All catalog permissions are granted to this role.
                            </p>
                          )}
                        </PermissionGate>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 border-t border-sand-200 pt-4">
                <h3 className="text-sm font-extrabold text-navy-950">
                  Permission Catalog ({permissions.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {permissions.map((perm) => (
                    <div
                      key={perm.id}
                      className="p-2.5 rounded-xl border border-sand-200 bg-white space-y-0.5"
                    >
                      <p className="font-mono font-bold text-navy-950 text-[11px]">{perm.code}</p>
                      <p className="text-[11px] text-sand-700">{perm.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Filter Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setAppliedSearch(searchInput.trim());
              setPage(1);
            }}
            className="bg-white rounded-2xl border border-sand-200 p-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs shadow-sm"
          >
            <div className="md:col-span-2 relative">
              <Search className="w-4 h-4 text-sand-700 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by user email or display name..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-sand-200 text-navy-950"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as UserStatus | "");
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-sand-200 bg-white text-navy-950"
            >
              {USER_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                className="flex-1 px-3 py-2 rounded-xl border border-sand-200 bg-white text-navy-950"
              >
                <option value="">All Roles</option>
                {SYSTEM_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-bold transition"
              >
                Search
              </button>
            </div>
          </form>

          {/* Users Table */}
          <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
            {usersQuery.isLoading ? (
              <AdminTableSkeleton rows={6} columns={5} />
            ) : users.length === 0 ? (
              <AdminEmptyStateCard
                title="No users match these filters"
                description="Adjust search terms, status, or role filter to inspect platform user accounts."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-sand-200 text-sand-700">
                      <th className="pb-2.5 pr-4 font-bold">Account</th>
                      <th className="pb-2.5 pr-4 font-bold">Roles</th>
                      <th className="pb-2.5 pr-4 font-bold">Email Verified</th>
                      <th className="pb-2.5 pr-4 font-bold">Status</th>
                      <th className="pb-2.5 font-bold text-right">Governance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sand-100">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-sand-50/70 transition-colors">
                        <td className="py-3 pr-4">
                          <p className="font-bold text-navy-950">{u.displayName}</p>
                          <p className="text-[11px] text-sand-700">{u.email}</p>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap gap-1">
                            {u.roles.map((r) => (
                              <span
                                key={r}
                                className="px-2 py-0.5 rounded-full bg-terracotta-50 text-terracotta-800 border border-terracotta-200 text-[10px] font-bold"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-[11px] text-navy-900">
                          {u.isEmailVerified ? "Verified" : "Unverified"}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeToneClasses(u.status)}`}
                          >
                            {u.status}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openInspector(u.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white font-bold transition"
                          >
                            <UserCog className="w-3.5 h-3.5" /> Manage User
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {users.length > 0 && pagination && (
              <AdminPaginationBar
                page={pagination.page}
                totalPages={Math.max(1, pagination.totalPages)}
                total={pagination.total}
                onPageChange={setPage}
              />
            )}
          </div>
        </>
      )}

      {/* User Governance & RBAC Slide-Over Drawer */}
      <SlideOverDrawer
        open={Boolean(inspectedUserId && !showDemoPreview)}
        onClose={closeInspector}
        ariaLabel="User Governance Drawer"
        closeLabel="Close user governance drawer"
        size="xl"
        title={
          userDetailQuery.data?.displayName ??
          (inspectedUserId ? `User ${inspectedUserId.slice(0, 8)}` : "Account & RBAC Governance")
        }
        subtitle={userDetailQuery.data?.email}
        badge={
          userDetailQuery.data && (
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeToneClasses(
                userDetailQuery.data.status
              )}`}
            >
              {userDetailQuery.data.status}
            </span>
          )
        }
      >
        <div className="space-y-5 text-xs">
          {userDetailQuery.isError ? (
            <AdminQueryErrorAlert
              message={
                userDetailQuery.error instanceof Error
                  ? userDetailQuery.error.message
                  : "Unable to load user profile detail."
              }
              onRetry={() => void userDetailQuery.refetch()}
            />
          ) : userDetailQuery.isLoading || !userDetailQuery.data ? (
            <AdminCardListSkeleton count={3} />
          ) : (
            <div className="space-y-5">
              {/* Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-sand-50 border border-sand-200">
                <div>
                  <span className="text-[11px] font-bold text-sand-700 uppercase">
                    Email & Verification
                  </span>
                  <p className="font-bold text-navy-950 mt-0.5 break-all">
                    {userDetailQuery.data.email}
                  </p>
                  <p className="text-[11px] text-sand-700 tabular-nums">
                    {userDetailQuery.data.isEmailVerified ? "Email Verified" : "Email Unverified"} •{" "}
                    Active Sessions: {userDetailQuery.data.activeSessionCount}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-sand-700 uppercase">
                    Account Status
                  </span>
                  <p className="mt-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeToneClasses(userDetailQuery.data.status)}`}
                    >
                      {userDetailQuery.data.status}
                    </span>
                  </p>
                  <p className="text-[11px] text-sand-700 mt-1 tabular-nums">
                    Last Login:{" "}
                    {userDetailQuery.data.lastLoginAt
                      ? formatDateTimeDisplay(userDetailQuery.data.lastLoginAt)
                      : "Never"}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-sand-700 uppercase">
                    Linked Domain Profiles
                  </span>
                  <p className="text-navy-900 mt-0.5">
                    Traveller Profile:{" "}
                    {userDetailQuery.data.travellerProfile ? "Active" : "None"}
                  </p>
                  <p className="text-navy-900">
                    Host Profile:{" "}
                    {userDetailQuery.data.hostProfile
                      ? `${userDetailQuery.data.hostProfile.displayName} (${userDetailQuery.data.hostProfile.status})`
                      : "None"}
                  </p>
                </div>
              </div>

              {/* Account Lifecycle Actions */}
              <div className="space-y-3 border-t border-sand-200 pt-4">
                <h3 className="font-extrabold uppercase tracking-wide text-navy-900">
                  Account Lifecycle Controls
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(userDetailQuery.data.status === "ACTIVE" ||
                    userDetailQuery.data.status === "PENDING_VERIFICATION") && (
                    <PermissionGate permission={SYSTEM_PERMISSIONS.ADMIN_USER_SUSPEND}>
                      <button
                        type="button"
                        onClick={() => {
                          setLifecycleAction("SUSPEND");
                          setReasonInput("");
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" /> Suspend User
                      </button>
                    </PermissionGate>
                  )}

                  {userDetailQuery.data.status === "SUSPENDED" && (
                    <PermissionGate permission={SYSTEM_PERMISSIONS.ADMIN_USER_REINSTATE}>
                      <button
                        type="button"
                        onClick={() => {
                          setLifecycleAction("REINSTATE");
                          setReasonInput("");
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" /> Reinstate User
                      </button>
                    </PermissionGate>
                  )}

                  {userDetailQuery.data.status !== "DEACTIVATED" && (
                    <PermissionGate permission={SYSTEM_PERMISSIONS.ADMIN_USER_DEACTIVATE}>
                      <button
                        type="button"
                        onClick={() => {
                          setLifecycleAction("DEACTIVATE");
                          setReasonInput("");
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition"
                      >
                        <UserMinus className="w-3.5 h-3.5" /> Deactivate User
                      </button>
                    </PermissionGate>
                  )}

                  {userDetailQuery.data.status === "DEACTIVATED" && (
                    <PermissionGate permission={SYSTEM_PERMISSIONS.ADMIN_USER_REACTIVATE}>
                      <button
                        type="button"
                        onClick={() => {
                          setLifecycleAction("REACTIVATE");
                          setReasonInput("");
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Reactivate User
                      </button>
                    </PermissionGate>
                  )}

                  {!userDetailQuery.data.isEmailVerified && (
                    <PermissionGate permission={SYSTEM_PERMISSIONS.ADMIN_USER_VERIFY_EMAIL}>
                      <button
                        type="button"
                        onClick={() => {
                          setLifecycleAction("VERIFY_EMAIL");
                          setReasonInput("");
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-bold transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Verify Email
                      </button>
                    </PermissionGate>
                  )}
                </div>

                {lifecycleAction && (
                  <form
                    onSubmit={handleLifecycleSubmit}
                    className="p-4 rounded-xl bg-sand-50 border border-sand-200 space-y-3"
                  >
                    <p className="font-bold text-navy-950">
                      Confirm Account Action: {lifecycleAction}
                    </p>
                    <textarea
                      rows={2}
                      value={reasonInput}
                      onChange={(e) => setReasonInput(e.target.value)}
                      placeholder={
                        lifecycleAction === "SUSPEND" || lifecycleAction === "DEACTIVATE"
                          ? "Required governance reason (min 3 chars)..."
                          : "Optional governance note (min 3 chars if entered)..."
                      }
                      className="w-full px-3 py-2 rounded-xl border border-sand-200 bg-white text-navy-950"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={
                          suspendMutation.isPending ||
                          reinstateMutation.isPending ||
                          deactivateMutation.isPending ||
                          reactivateMutation.isPending ||
                          verifyEmailMutation.isPending
                        }
                        className="px-4 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-bold transition"
                      >
                        Confirm {lifecycleAction}
                      </button>
                      <button
                        type="button"
                        onClick={() => setLifecycleAction(null)}
                        className="px-4 py-2 rounded-xl border border-sand-200 font-bold text-navy-900 bg-white hover:bg-sand-100 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Assigned Roles & Assignment/Revocation Controls */}
              <div className="space-y-3 border-t border-sand-200 pt-4">
                <h3 className="font-extrabold uppercase tracking-wide text-navy-900">
                  Assigned System Roles
                </h3>
                <div className="flex flex-wrap gap-2">
                  {userDetailQuery.data.roles.map((r) => (
                    <div
                      key={r}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-terracotta-50 border border-terracotta-200 text-terracotta-900 font-bold"
                    >
                      <span>{r}</span>
                      <PermissionGate permission={SYSTEM_PERMISSIONS.ADMIN_ROLE_REVOKE}>
                        <button
                          type="button"
                          onClick={() => setPendingRevokeRole(r)}
                          disabled={revokeRoleMutation.isPending}
                          className="text-rose-700 hover:text-rose-900 underline text-[11px]"
                        >
                          Revoke
                        </button>
                      </PermissionGate>
                    </div>
                  ))}
                </div>

                <PermissionGate
                  permission={SYSTEM_PERMISSIONS.ADMIN_ROLE_ASSIGN}
                  fallback={
                    <p className="text-sand-700 italic">
                      Role assignment and revocation are restricted to Superadmin.
                    </p>
                  }
                >
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <select
                      value={roleToAssign}
                      onChange={(e) => setRoleToAssign(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-sand-200 bg-white font-semibold text-navy-950"
                    >
                      {availableRoleCodes.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void handleAssignRole()}
                      disabled={assignRoleMutation.isPending}
                      className="px-4 py-2 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white font-bold transition"
                    >
                      {assignRoleMutation.isPending ? "Assigning..." : "Assign Role"}
                    </button>
                  </div>
                </PermissionGate>
              </div>

              {/* Effective Permissions */}
              <div className="space-y-2 border-t border-sand-200 pt-4">
                <h3 className="font-extrabold uppercase tracking-wide text-navy-900">
                  Effective Permissions ({userPermissionsQuery.data?.permissions.length ?? 0})
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {(userPermissionsQuery.data?.permissions ?? []).map((perm) => (
                    <span
                      key={perm}
                      className="px-2 py-0.5 rounded-md bg-sand-100 border border-sand-200 font-mono text-[10px] text-navy-900"
                    >
                      {perm}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </SlideOverDrawer>

      {/* 2-Step Confirmation Modal before Revoking Role */}
      <Modal
        open={Boolean(pendingRevokeRole)}
        onClose={() => setPendingRevokeRole(null)}
        size="sm"
        title="Confirm Role Revocation"
        subtitle={
          userDetailQuery.data
            ? `Revoke ${pendingRevokeRole} from ${userDetailQuery.data.email}`
            : undefined
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setPendingRevokeRole(null)}
              className="px-4 py-2 rounded-xl border border-sand-200 bg-white text-xs font-bold text-navy-900 hover:bg-sand-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={revokeRoleMutation.isPending}
              onClick={() => void handleConfirmRevokeRole()}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50 transition"
            >
              {revokeRoleMutation.isPending ? "Revoking..." : "Confirm Revoke Role"}
            </button>
          </>
        }
      >
        <p className="text-xs text-navy-900 leading-relaxed">
          Revoking <strong className="font-mono">{pendingRevokeRole}</strong> immediately removes all
          permissions granted by this role from the user&apos;s active sessions.
        </p>
      </Modal>

      {/* Reset Defaults Confirmation Modal */}
      <Modal
        open={showResetDefaultsModal}
        onClose={() => setShowResetDefaultsModal(false)}
        size="md"
        title="Reset Role Permissions to Defaults"
        subtitle="Restore standard marketplace entitlements across all system roles"
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowResetDefaultsModal(false)}
              className="px-4 py-2 rounded-xl border border-sand-200 bg-white text-xs font-bold text-navy-900 hover:bg-sand-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={resetRolePermsMutation.isPending}
              onClick={() => void handleResetDefaults()}
              className="px-4 py-2 rounded-xl bg-terracotta-600 hover:bg-terracotta-700 text-white text-xs font-bold disabled:opacity-50 transition"
            >
              {resetRolePermsMutation.isPending ? "Resetting..." : "Confirm Reset to Defaults"}
            </button>
          </>
        }
      >
        <div className="space-y-2 text-xs text-navy-900 leading-relaxed">
          <p>
            This operation resets permissions for all system roles (
            <strong className="font-mono">SUPERADMIN</strong>,{" "}
            <strong className="font-mono">SUPPORT</strong>,{" "}
            <strong className="font-mono">HOST_OWNER</strong>,{" "}
            <strong className="font-mono">HOST_STAFF</strong>, and{" "}
            <strong className="font-mono">TRAVELLER</strong>) back to official platform standards.
          </p>
          <p className="text-sand-700">
            Standard traveller booking creation, host storage custody, and support privileges will be
            re-established immediately without affecting existing user accounts or active sessions.
          </p>
        </div>
      </Modal>
    </div>
  );
}

export const AdminStaffRbacManagementPage = AdminUsersRbacPage;
