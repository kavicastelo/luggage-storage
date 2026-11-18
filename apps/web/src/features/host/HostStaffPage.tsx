import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  HOST_STAFF_ROLES,
  SYSTEM_PERMISSIONS,
  type HostStaffMemberDetail,
  type HostStaffRole
} from "@luggage-storage/contracts";
import { ShieldCheck, Trash2, Users } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyState, LoadingSkeleton, Modal } from "@/components/ui";
import { isDemoPreviewActive } from "@/config/demo-preview";
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
import { useHostVenue } from "./HostDashboardLayout";

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
  const location = useLocation();
  const { isDemoActive } = useHostVenue();
  const { isAuthenticated, user, hasPermission } = useAuthStore();
  const storedBusinessId = useHostContextStore((state) => state.selectedBusinessId);
  const setStoredBusinessId = useHostContextStore((state) => state.setSelectedBusinessId);

  const showDemoStaff =
    !isAuthenticated &&
    (isDemoActive ||
      isDemoPreviewActive({
        allowDemoPreview: true,
        search: location.search,
        isAuthenticated
      }));

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
    showDemoStaff ||
    Boolean(user?.roles?.includes("HOST_OWNER")) ||
    Boolean(user?.roles?.includes("SUPERADMIN")) ||
    hasPermission(SYSTEM_PERMISSIONS.HOSTS_STAFF_MANAGE_OWN);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<HostStaffRole>("ATTENDANT");
  const [inviteLocationIds, setInviteLocationIds] = useState<string[]>([]);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [memberToRevoke, setMemberToRevoke] = useState<HostStaffMemberDetail | null>(null);
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
    setInviteError(null);

    if (showDemoStaff) {
      setShowInviteModal(false);
      setSuccessMsg("Demo preview: Staff invitation simulated in local session.");
      return;
    }
    if (!activeBusinessId) {
      setInviteError("Select or create a Host Business before assigning staff.");
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
      setInviteError(err instanceof Error ? err.message : "Failed to invite staff member.");
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
      setSuccessMsg(currentActive ? "Staff access paused." : "Staff access restored.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to update staff status.");
    }
  };

  const handleConfirmRemoveStaff = async () => {
    if (!activeBusinessId || !memberToRevoke) return;
    setErrorMsg(null);
    try {
      await removeStaffMutation.mutateAsync({
        businessId: activeBusinessId,
        membershipId: memberToRevoke.id
      });
      setMemberToRevoke(null);
      setSuccessMsg("Staff membership revoked.");
    } catch (err) {
      setMemberToRevoke(null);
      setErrorMsg(err instanceof Error ? err.message : "Failed to revoke staff membership.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-5 sm:p-6">
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
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setInviteError(null);
                setShowInviteModal(true);
              }}
              leftIcon={<Users className="h-4 w-4" />}
            >
              Invite Staff Member
            </Button>
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
      </Card>

      {/* Demo Banner ONLY in active demo preview */}
      {showDemoStaff && (
        <Alert variant="warning">
          <strong className="font-bold">Team Management (Demo State):</strong> Displaying sample
          team directory for Sri Lanka counter preview.
        </Alert>
      )}

      {errorMsg && (
        <Alert variant="danger" title="Staff Management Error">
          {errorMsg}
        </Alert>
      )}

      {successMsg && (
        <Alert variant="success" onDismiss={() => setSuccessMsg(null)}>
          {successMsg}
        </Alert>
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
        <Card className="p-4 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-navy-950">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Host Owner Scope</span>
          </div>
          <p className="text-navy-600 leading-relaxed">
            Full access to corporate KYC, payout banking details, commission ledgers, pricing updates, and team role assignments.
          </p>
        </Card>

        <Card className="p-4 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-navy-950">
            <Users className="h-4 w-4 text-terracotta-600" />
            <span>Host Staff Scope</span>
          </div>
          <p className="text-navy-600 leading-relaxed">
            Restricted strictly to counter operations: Drop-off Check-In, Pick-Up PIN verification, and custody incident reporting. Financial ledgers hidden.
          </p>
        </Card>
      </div>

      {/* Staff Directory */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-sand-100">
          <h2 className="text-sm font-bold text-navy-950">Active Team Directory</h2>
        </div>

        {isAuthenticated ? (
          staffQuery.isLoading ? (
            <div className="p-5 space-y-3">
              <LoadingSkeleton className="h-14 w-full" />
              <LoadingSkeleton className="h-14 w-full" />
            </div>
          ) : liveStaff.length === 0 ? (
            <div className="p-4">
              <EmptyState
                mascot="wave"
                title="No counter attendants or location managers assigned yet"
                description="Invite a registered team user to grant counter check-in and release access for your storage hubs."
                action={
                  canManageStaff ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setInviteError(null);
                        setShowInviteModal(true);
                      }}
                    >
                      Invite Staff Member
                    </Button>
                  ) : undefined
                }
              />
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
                        <Badge
                          variant={member.staffRole === "MANAGER" ? "navy" : "brand"}
                          size="sm"
                        >
                          {member.staffRole}
                        </Badge>
                        <Badge variant={member.isActive ? "success" : "neutral"} size="sm">
                          {member.isActive ? "Active" : "Inactive"}
                        </Badge>
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
                        <button
                          type="button"
                          onClick={() => setMemberToRevoke(member)}
                          aria-label={`Revoke ${member.email}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 font-bold"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Revoke</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : showDemoStaff ? (
          <div className="divide-y divide-sand-100">
            {DEMO_STAFF_LIST.map((staff) => (
              <div
                key={staff.id}
                className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-navy-950">{staff.name}</span>
                    <Badge
                      variant={staff.role === "HOST_OWNER" ? "navy" : "brand"}
                      size="sm"
                    >
                      {staff.role}
                    </Badge>
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
        ) : (
          <div className="p-4">
            <EmptyState
              mascot="wave"
              title="Sign in to manage team access"
              description="Host Owners can invite counter attendants and manage hub-level permissions."
            />
          </div>
        )}
      </Card>

      {/* Invite Modal */}
      <Modal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        closeLabel="Close invite modal"
        size="sm"
        title="Invite Team Member"
      >
        <form onSubmit={(e) => void handleInviteSubmit(e)} className="space-y-4 text-xs">
          {inviteError && <Alert variant="danger">{inviteError}</Alert>}

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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowInviteModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={addStaffMutation.isPending}>
              {addStaffMutation.isPending ? "Assigning..." : "Send Invitation"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Revoke Staff Modal */}
      <Modal
        open={Boolean(memberToRevoke)}
        onClose={() => setMemberToRevoke(null)}
        closeLabel="Close revoke staff modal"
        size="sm"
        title="Revoke Staff Access?"
        subtitle={memberToRevoke?.email}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMemberToRevoke(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={removeStaffMutation.isPending}
              onClick={() => void handleConfirmRemoveStaff()}
            >
              Confirm Revoke
            </Button>
          </>
        }
      >
        <p className="text-xs text-navy-700 leading-relaxed">
          Revoking <strong>{memberToRevoke?.displayName}</strong> ({memberToRevoke?.email})
          immediately removes their counter check-in, custody release, and hub access permissions.
        </p>
      </Modal>
    </div>
  );
}
