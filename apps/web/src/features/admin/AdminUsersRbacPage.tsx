import React, { useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  SYSTEM_PERMISSIONS,
  SYSTEM_ROLES,
  type UserStatus
} from "@luggage-storage/contracts";
import {
  CheckCircle2,
  KeyRound,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  UserMinus,
  UserPlus,
  X
} from "lucide-react";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { MascotIllustration } from "@/components/ui";
import { isDemoPreviewActive } from "@/config/demo-preview";
import {
  useAdminPermissionsQuery,
  useAdminRolesQuery,
  useAdminUserDetailQuery,
  useAdminUserPermissionsQuery,
  useAdminUsersQuery,
  useAssignAdminUserRoleMutation,
  useDeactivateAdminUserMutation,
  useReactivateAdminUserMutation,
  useReinstateAdminUserMutation,
  useRevokeAdminUserRoleMutation,
  useSuspendAdminUserMutation,
  useVerifyAdminUserEmailMutation
} from "@/hooks/queries/use-admin-portal";
import { formatDateTimeDisplay } from "@/lib/formatters";
import { useAuthStore } from "@/store/useAuthStore";
import {
  AdminEmptyStateCard,
  AdminPageHeader,
  AdminPaginationBar,
  AdminQueryErrorAlert,
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

  const [activeTab, setActiveTab] = useState<ActiveWorkspaceTab>("users");
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

  const users = usersQuery.data?.users ?? [];
  const pagination = usersQuery.data?.pagination;
  const roles = rolesQuery.data ?? [];
  const permissions = permissionsQuery.data ?? [];

  const openInspector = (userId: string) => {
    setActionError(null);
    setActionSuccess(null);
    setLifecycleAction(null);
    setReasonInput("");
    setLocalInspectId(userId);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("inspect", userId);
    setSearchParams(nextParams);
  };

  const closeInspector = () => {
    setLocalInspectId(null);
    setLifecycleAction(null);
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

  const handleRevokeRole = async (roleCode: string) => {
    if (!inspectedUserId) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await revokeRoleMutation.mutateAsync({
        userId: inspectedUserId,
        roleCode
      });
      setActionSuccess(res.message);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to revoke user role.");
    }
  };

  const availableRoleCodes = roles.length > 0 ? roles.map((r) => r.code) : [...SYSTEM_ROLES];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Platform Users, Account Lifecycle & RBAC"
        subtitle="Manage traveller, host, support, and superadmin account statuses, active sessions, verified email states, and system RBAC role assignments."
        rightSlot={<MascotIllustration mascot="key" size="sm" caption="Identity RBAC" />}
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
                ? "bg-purple-700 text-white"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Users Directory & Lifecycle
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("matrix")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "matrix"
                ? "bg-purple-700 text-white"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Roles & Permissions Matrix ({roles.length})
          </button>
        </div>
      )}

      {showDemoPreview ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3 text-xs">
          <p className="font-bold text-slate-900">Role-Based Access Control (Demo Preview)</p>
          <p className="text-slate-600">
            System RBAC matrix covers SUPERADMIN, SUPPORT, HOST_OWNER, HOST_STAFF, and TRAVELLER.
          </p>
        </div>
      ) : activeTab === "matrix" ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 text-xs">
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
          <div className="space-y-3">
            <h2 className="text-sm font-extrabold text-slate-950">System Roles Breakdown</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {roles.map((r) => (
                <div
                  key={r.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-purple-900 text-sm">{r.code}</span>
                    <span className="text-[11px] font-semibold text-slate-600">
                      {r.permissions.length} permission(s)
                    </span>
                  </div>
                  <p className="text-slate-700">{r.description || r.name}</p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {r.permissions.map((perm) => (
                      <span
                        key={perm}
                        className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-mono text-[10px] text-slate-700"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-extrabold text-slate-950">
              Permission Catalog ({permissions.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {permissions.map((perm) => (
                <div
                  key={perm.id}
                  className="p-2.5 rounded-xl border border-slate-200 bg-white space-y-0.5"
                >
                  <p className="font-mono font-bold text-slate-900 text-[11px]">{perm.code}</p>
                  <p className="text-[11px] text-slate-600">{perm.name}</p>
                </div>
              ))}
            </div>
          </div>
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
            className="bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs"
          >
            <div className="md:col-span-2 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by user email or display name..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as UserStatus | "");
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-300 bg-white"
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
                className="flex-1 px-3 py-2 rounded-xl border border-slate-300 bg-white"
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
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold"
              >
                Search
              </button>
            </div>
          </form>

          {/* Users Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            {usersQuery.isLoading ? (
              <p className="text-xs text-slate-500 py-4 text-center">Loading platform users...</p>
            ) : users.length === 0 ? (
              <AdminEmptyStateCard
                title="No users match these filters"
                description="Adjust search terms, status, or role filter to inspect platform user accounts."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="pb-2.5 pr-4 font-bold">Account</th>
                      <th className="pb-2.5 pr-4 font-bold">Roles</th>
                      <th className="pb-2.5 pr-4 font-bold">Email Verified</th>
                      <th className="pb-2.5 pr-4 font-bold">Status</th>
                      <th className="pb-2.5 font-bold text-right">Governance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="py-3 pr-4">
                          <p className="font-bold text-slate-900">{u.displayName}</p>
                          <p className="text-[11px] text-slate-500">{u.email}</p>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap gap-1">
                            {u.roles.map((r) => (
                              <span
                                key={r}
                                className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-900 border border-purple-200 text-[10px] font-bold"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-[11px]">
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
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold"
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

      {/* User Governance & RBAC Drawer */}
      {inspectedUserId && !showDemoPreview && (
        <section
          aria-label="User Governance Drawer"
          className="bg-white rounded-2xl border-2 border-purple-300 p-6 shadow-lg space-y-5 text-xs"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
                Account & RBAC Governance
              </span>
              <h2 className="text-lg font-extrabold text-slate-950 mt-0.5 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-purple-700" />
                {userDetailQuery.data?.displayName ?? `User ${inspectedUserId.slice(0, 8)}`}
              </h2>
            </div>
            <button
              type="button"
              onClick={closeInspector}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-700 hover:bg-slate-50"
            >
              <X className="w-3.5 h-3.5" /> Close
            </button>
          </div>

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
            <p className="text-slate-500">Loading user profile and effective permissions...</p>
          ) : (
            <div className="space-y-5">
              {/* Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                    Email & Verification
                  </span>
                  <p className="font-bold text-slate-900 mt-0.5">{userDetailQuery.data.email}</p>
                  <p className="text-[11px] text-slate-600">
                    {userDetailQuery.data.isEmailVerified ? "Email Verified" : "Email Unverified"} •{" "}
                    Active Sessions: {userDetailQuery.data.activeSessionCount}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                    Account Status
                  </span>
                  <p className="mt-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeToneClasses(userDetailQuery.data.status)}`}
                    >
                      {userDetailQuery.data.status}
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Last Login:{" "}
                    {userDetailQuery.data.lastLoginAt
                      ? formatDateTimeDisplay(userDetailQuery.data.lastLoginAt)
                      : "Never"}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                    Linked Domain Profiles
                  </span>
                  <p className="text-slate-800 mt-0.5">
                    Traveller Profile:{" "}
                    {userDetailQuery.data.travellerProfile ? "Active" : "None"}
                  </p>
                  <p className="text-slate-800">
                    Host Profile:{" "}
                    {userDetailQuery.data.hostProfile
                      ? `${userDetailQuery.data.hostProfile.displayName} (${userDetailQuery.data.hostProfile.status})`
                      : "None"}
                  </p>
                </div>
              </div>

              {/* Account Lifecycle Actions */}
              <div className="space-y-3 border-t border-slate-200 pt-4">
                <h3 className="font-extrabold uppercase tracking-wide text-slate-700">
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
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold"
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
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
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
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
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
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
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
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Verify Email
                      </button>
                    </PermissionGate>
                  )}
                </div>

                {lifecycleAction && (
                  <form
                    onSubmit={handleLifecycleSubmit}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                  >
                    <p className="font-bold text-slate-900">
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
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
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
                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold"
                      >
                        Confirm {lifecycleAction}
                      </button>
                      <button
                        type="button"
                        onClick={() => setLifecycleAction(null)}
                        className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-700 bg-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Assigned Roles & Assignment/Revocation Controls */}
              <div className="space-y-3 border-t border-slate-200 pt-4">
                <h3 className="font-extrabold uppercase tracking-wide text-slate-700">
                  Assigned System Roles
                </h3>
                <div className="flex flex-wrap gap-2">
                  {userDetailQuery.data.roles.map((r) => (
                    <div
                      key={r}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-950 font-bold"
                    >
                      <span>{r}</span>
                      <PermissionGate permission={SYSTEM_PERMISSIONS.ADMIN_ROLE_REVOKE}>
                        <button
                          type="button"
                          onClick={() => void handleRevokeRole(r)}
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
                    <p className="text-slate-500 italic">
                      Role assignment and revocation are restricted to Superadmin.
                    </p>
                  }
                >
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <select
                      value={roleToAssign}
                      onChange={(e) => setRoleToAssign(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
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
                      className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold"
                    >
                      {assignRoleMutation.isPending ? "Assigning..." : "Assign Role"}
                    </button>
                  </div>
                </PermissionGate>
              </div>

              {/* Effective Permissions */}
              <div className="space-y-2 border-t border-slate-200 pt-4">
                <h3 className="font-extrabold uppercase tracking-wide text-slate-700">
                  Effective Permissions (
                  {userPermissionsQuery.data?.permissions.length ?? 0})
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {(userPermissionsQuery.data?.permissions ?? []).map((perm) => (
                    <span
                      key={perm}
                      className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-mono text-[10px] text-slate-700"
                    >
                      {perm}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export const AdminStaffRbacManagementPage = AdminUsersRbacPage;
