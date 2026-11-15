import React, { useMemo, useState } from "react";
import { HOST_STAFF_ROLES, SYSTEM_PERMISSIONS, type HostStaffRole } from "@luggage-storage/contracts";
import { Info, ShieldCheck, Trash2, Users, X } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { useAuthStore } from "@/store/useAuthStore";
import { useHostContextStore } from "@/store/useHostContextStore";
import {
  useAddHostStaffMutation,
  useHostLocationsQuery,
  useHostStaffQuery,
  useOwnedBusinessesQuery,
  useRemoveHostStaffMutation,
  useUpdateHostStaffMutation
} from "@/hooks/queries/use-host-portal";
import { HostQueryErrorAlert } from "./host-helpers";

interface DemoStaffMember {
  id: string;
  name: string;
  email: string;
  role: "HOST_OWNER" | "HOST_STAFF";
  assignedHubs: string;
  status: string;
}

const DEMO_STAFF_LIST: DemoStaffMember[] = [
  {
    id: "stf-1",
    name: "Roshan Fernando",
    email: "roshan.owner@ceylonstorage.lk",
    role: "HOST_OWNER",
    assignedHubs: "All Hubs (3)",
    status: "Active Owner"
  },
  {
    id: "stf-2",
    name: "Nadeesha Perera",
    email: "nadeesha.colombo@ceylonstorage.lk",
    role: "HOST_STAFF",
    assignedHubs: "Colombo Fort Station Vault",
    status: "Active Counter Desk"
  },
  {
    id: "stf-3",
    name: "Kasun Jayawardena",
    email: "kasun.ella@ceylonstorage.lk",
    role: "HOST_STAFF",
    assignedHubs: "Ella Railway & Nine Arch Hub",
    status: "Active Counter Desk"
  },
  {
    id: "stf-4",
    name: "Priyantha Wickramasinghe",
    email: "priyantha.kandy@ceylonstorage.lk",
    role: "HOST_STAFF",
    assignedHubs: "Kandy Lake & Temple Quarter",
    status: "Active Counter Desk"
  }
];

export function HostStaffManagementRbacPage() {
  const { isAuthenticated, user, hasPermission } = useAuthStore();
  const storedBusinessId = useHostContextStore((state) => state.selectedBusinessId);
  const setStoredBusinessId = useHostContextStore((state) => state.setSelectedBusinessId);

  const businessesQuery = useOwnedBusinessesQuery({ enabled: isAuthenticated });
  const locationsQuery = useHostLocationsQuery({ enabled: isAuthenticated });
  const businesses = businessesQuery.data ?? [];

  const activeBusinessId = useMemo(() => {
    if (businesses.some((b) => b.id === storedBusinessId)) {
      return storedBusinessId;
    }
    return businesses[0]?.id ?? undefined;
  }, [businesses, storedBusinessId]);

  const staffQuery = useHostStaffQuery(activeBusinessId, { enabled: isAuthenticated });
  const addStaffMutation = useAddHostStaffMutation();
  const updateStaffMutation = useUpdateHostStaffMutation();
  const removeStaffMutation = useRemoveHostStaffMutation();

  const canManageStaff =
    !isAuthenticated ||
    Boolean(user?.roles?.includes("HOST_OWNER")) ||
    Boolean(user?.roles?.includes("SUPERADMIN")) ||
    hasPermission(SYSTEM_PERMISSIONS.HOSTS_STAFF_MANAGE_OWN);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<HostStaffRole>("ATTENDANT");
  const [inviteLocationIds, setInviteLocationIds] = useState<string[]>([]);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const locations = locationsQuery.data ?? [];
  const liveStaff = staffQuery.data ?? [];

  const toggleInviteLocation = (locationId: string) => {
    setInviteLocationIds((prev) =>
      prev.includes(locationId) ? prev.filter((id) => id !== locationId) : [...prev, locationId]
    );
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setShowInviteModal(false);
      return;
    }
    if (!activeBusinessId) {
      setErrorMsg("Select or create a Host Business before assigning staff.");
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await addStaffMutation.mutateAsync({
        businessId: activeBusinessId,
        data: {
          email: inviteEmail.trim(),
          staffRole: inviteRole,
          assignedLocationIds: inviteLocationIds
        }
      });
      setInviteEmail("");
      setInviteLocationIds([]);
      setShowInviteModal(false);
      setSuccessMsg("Staff member assigned to business operations.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to invite staff member.");
    }
  };

  const handleRoleChange = async (membershipId: string, staffRole: HostStaffRole) => {
    if (!activeBusinessId) return;
    setErrorMsg(null);
    try {
      await updateStaffMutation.mutateAsync({
        businessId: activeBusinessId,
        membershipId,
        data: { staffRole }
      });
      setSuccessMsg("Staff role permissions updated.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to update staff role.");
    }
  };

  const handleToggleActive = async (membershipId: string, currentActive: boolean) => {
    if (!activeBusinessId) return;
    setErrorMsg(null);
    try {
      await updateStaffMutation.mutateAsync({
        businessId: activeBusinessId,
        membershipId,
        data: { isActive: !currentActive }
      });
      setSuccessMsg(
        currentActive ? "Staff access paused." : "Staff access restored."
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to update staff status.");
    }
  };

  const handleRemoveStaff = async (membershipId: string) => {
    if (!activeBusinessId) return;
    setErrorMsg(null);
    try {
      await removeStaffMutation.mutateAsync({
        businessId: activeBusinessId,
        membershipId
      });
      setConfirmRemoveId(null);
      setSuccessMsg("Staff membership revoked.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to revoke staff membership.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              Staff Management &amp; Operational Access
            </h1>
            <p className="text-xs text-navy-600 mt-0.5">
              Assign counter attendants and location managers strictly scoped to operational luggage custody.
            </p>
          </div>
          {canManageStaff && (
            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold shadow-sm transition"
            >
              <Users className="h-4 w-4" />
              <span>Invite Staff Member</span>
            </button>
          )}
        </div>

        {isAuthenticated && businesses.length > 1 && (
          <div className="mt-4 pt-4 border-t border-sand-100 flex items-center gap-3 text-xs">
            <label className="font-bold text-navy-800">Business Entity:</label>
            <select
              aria-label="Select Business Entity"
              value={activeBusinessId ?? ""}
              onChange={(e) => setStoredBusinessId(e.target.value)}
              className="rounded-xl border border-sand-300 px-3 py-1.5 font-semibold"
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.legalBusinessName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Demo Banner ONLY in unauthenticated preview */}
      {!isAuthenticated && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 flex items-start gap-3">
          <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold">Team Management (Demo State):</strong> Displaying sample team directory for Sri Lanka counter preview.
          </div>
        </div>
      )}

      {errorMsg && (
        <Alert variant="danger" title="Staff Management Error">
          {errorMsg}
        </Alert>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl">
          {successMsg}
        </div>
      )}

      {isAuthenticated && staffQuery.isError && (
        <HostQueryErrorAlert
          message={
            staffQuery.error instanceof Error
              ? staffQuery.error.message
              : "Failed to load team directory."
          }
          onRetry={() => void staffQuery.refetch()}
        />
      )}

      {/* Role Scope Guide */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="bg-white rounded-2xl border border-sand-200 p-4 space-y-1.5 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-navy-950">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Host Owner Scope</span>
          </div>
          <p className="text-navy-600 leading-relaxed">
            Full access to corporate KYC, payout banking details, commission ledgers, pricing updates, and team role assignments.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-sand-200 p-4 space-y-1.5 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-navy-950">
            <Users className="h-4 w-4 text-terracotta-600" />
            <span>Host Staff Scope</span>
          </div>
          <p className="text-navy-600 leading-relaxed">
            Restricted strictly to counter operations: Drop-off Check-In, Pick-Up PIN verification, and custody incident reporting. Financial ledgers hidden.
          </p>
        </div>
      </div>

      {/* Staff Directory */}
      <div className="bg-white rounded-2xl border border-sand-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-sand-100">
          <h2 className="text-sm font-bold text-navy-950">Active Team Directory</h2>
        </div>

        {isAuthenticated ? (
          staffQuery.isLoading ? (
            <div className="p-8 text-center text-xs text-navy-500">Loading staff directory...</div>
          ) : liveStaff.length === 0 ? (
            <div className="p-8 text-center text-xs text-navy-600">
              No counter attendants or location managers assigned yet. Invite a registered team user above.
            </div>
          ) : (
            <div className="divide-y divide-sand-100">
              {liveStaff.map((member) => {
                const hubNames =
                  member.assignedLocationIds && member.assignedLocationIds.length > 0
                    ? member.assignedLocationIds
                        .map((lid) => locations.find((l) => l.id === lid)?.name || lid)
                        .join(", ")
                    : "All Business Hubs";
                return (
                  <div
                    key={member.id}
                    className="p-4 sm:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-navy-950">{member.displayName}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            member.staffRole === "MANAGER"
                              ? "bg-navy-100 text-navy-900 border-navy-200"
                              : "bg-terracotta-50 text-terracotta-800 border-terracotta-200"
                          }`}
                        >
                          {member.staffRole}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            member.isActive
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-sand-200 text-navy-700"
                          }`}
                        >
                          {member.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="text-navy-500 mt-0.5">{member.email}</p>
                      <p className="text-navy-600 mt-1">
                        Assigned Hubs: <strong className="text-navy-900">{hubNames}</strong>
                      </p>
                    </div>

                    {canManageStaff && (
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          aria-label={`Staff role for ${member.email}`}
                          value={member.staffRole}
                          disabled={updateStaffMutation.isPending}
                          onChange={(e) =>
                            void handleRoleChange(member.id, e.target.value as HostStaffRole)
                          }
                          className="rounded-lg border border-sand-300 px-2.5 py-1.5 text-xs font-semibold"
                        >
                          {HOST_STAFF_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={updateStaffMutation.isPending}
                          onClick={() => void handleToggleActive(member.id, member.isActive)}
                          className="px-3 py-1.5 rounded-lg border border-sand-300 font-bold text-navy-800 hover:bg-sand-50"
                        >
                          {member.isActive ? "Disable" : "Enable"}
                        </button>
                        {confirmRemoveId === member.id ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={removeStaffMutation.isPending}
                              onClick={() => void handleRemoveStaff(member.id)}
                              className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold"
                            >
                              Confirm Revoke
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRemoveId(null)}
                              className="px-2 py-1.5 rounded-lg border border-sand-300 text-navy-700"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveId(member.id)}
                            aria-label={`Revoke ${member.email}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 font-bold"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Revoke</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="divide-y divide-sand-100">
            {DEMO_STAFF_LIST.map((staff) => (
              <div
                key={staff.id}
                className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-navy-950">{staff.name}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        staff.role === "HOST_OWNER"
                          ? "bg-navy-100 text-navy-900 border-navy-200"
                          : "bg-terracotta-50 text-terracotta-800 border-terracotta-200"
                      }`}
                    >
                      {staff.role}
                    </span>
                  </div>
                  <p className="text-navy-500 mt-0.5">{staff.email}</p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-left sm:text-right">
                    <p className="text-navy-700 font-medium">{staff.assignedHubs}</p>
                    <p className="text-[11px] text-emerald-700 font-semibold">{staff.status}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={(e) => void handleInviteSubmit(e)}
            className="bg-white rounded-2xl border border-sand-200 max-w-md w-full p-6 space-y-4 shadow-xl text-xs"
          >
            <div className="flex items-center justify-between border-b border-sand-100 pb-3">
              <h3 className="text-base font-bold text-navy-950">Invite Team Member</h3>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="p-1 rounded-lg hover:bg-sand-100 text-navy-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block font-bold text-navy-900 mb-1">Registered User Email</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="attendant@example.com"
                  className="w-full rounded-xl border border-sand-300 px-3 py-2"
                />
                {isAuthenticated && (
                  <p className="text-[10px] text-navy-500 mt-1">
                    User must have an existing platform account before assignment.
                  </p>
                )}
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">Staff Role</label>
                <select
                  aria-label="Role Permission"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as HostStaffRole)}
                  className="w-full rounded-xl border border-sand-300 px-3 py-2"
                >
                  <option value="ATTENDANT">Attendant (Counter Check-In / Release Desk)</option>
                  <option value="MANAGER">Manager (Multi-Hub Operations Scope)</option>
                </select>
              </div>
              {isAuthenticated && locations.length > 0 && (
                <div>
                  <label className="block font-bold text-navy-900 mb-1">
                    Assigned Storage Hubs (Leave empty for all hubs)
                  </label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto p-2 rounded-xl border border-sand-200 bg-sand-50">
                    {locations.map((loc) => (
                      <label key={loc.id} className="flex items-center gap-2 text-navy-800">
                        <input
                          type="checkbox"
                          checked={inviteLocationIds.includes(loc.id)}
                          onChange={() => toggleInviteLocation(loc.id)}
                          className="rounded text-terracotta-500"
                        />
                        <span>{loc.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 rounded-xl border border-sand-300 font-bold text-navy-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addStaffMutation.isPending}
                className="px-4 py-2 rounded-xl bg-terracotta-500 text-white font-bold disabled:opacity-50"
              >
                {addStaffMutation.isPending ? "Assigning..." : "Send Invitation"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
