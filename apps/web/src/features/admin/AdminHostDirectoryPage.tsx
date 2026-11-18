import React, { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  HOST_BUSINESS_STATUSES,
  SYSTEM_PERMISSIONS,
  type HostBusinessStatus
} from "@luggage-storage/contracts";
import { Eye, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { SlideOverDrawer } from "@/components/ui";
import { isDemoPreviewActive } from "@/config/demo-preview";
import {
  useAdminHostDetailQuery,
  useAdminHostsQuery,
  useReinstateAdminHostMutation,
  useSuspendAdminHostMutation
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
import { useAdminRole } from "./AdminDashboardLayout";

type HostStatusFilter = HostBusinessStatus | "ALL";

const STATUS_FILTER_OPTIONS: Array<{ value: HostStatusFilter; label: string }> = [
  { value: "ALL", label: "All Hosts" },
  ...HOST_BUSINESS_STATUSES.map((s) => ({
    value: s,
    label: s.replace(/_/g, " ")
  }))
];

export function AdminHostDirectoryPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuthStore();
  const effectiveAdminRole = useAdminRole();

  const showDemoPreview =
    !isAuthenticated &&
    isDemoPreviewActive({
      allowDemoPreview: true,
      search: location.search,
      isAuthenticated
    });
  const querySuffix = showDemoPreview ? "?preview=demo" : "";

  const [statusFilter, setStatusFilter] = useState<HostStatusFilter>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const inspectParam = searchParams.get("inspect");
  const [localInspectId, setLocalInspectId] = useState<string | null>(null);
  const inspectedBusinessId =
    (isUuid(inspectParam) ? inspectParam : null) ??
    (isUuid(localInspectId) ? localInspectId : null);

  const [actionMode, setActionMode] = useState<"SUSPEND" | "REINSTATE" | null>(null);
  const [reasonInput, setReasonInput] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const hostsQuery = useAdminHostsQuery(
    {
      page,
      limit,
      status: statusFilter === "ALL" ? undefined : statusFilter,
      search: appliedSearch || undefined
    },
    { enabled: isAuthenticated && !showDemoPreview }
  );

  const detailQuery = useAdminHostDetailQuery(inspectedBusinessId ?? undefined, {
    enabled: isAuthenticated && !showDemoPreview && Boolean(inspectedBusinessId)
  });

  const suspendMutation = useSuspendAdminHostMutation();
  const reinstateMutation = useReinstateAdminHostMutation();

  const hosts = hostsQuery.data?.hosts ?? [];
  const total = hostsQuery.data?.pagination.total ?? 0;
  const totalPages = Math.max(1, hostsQuery.data?.pagination.totalPages ?? Math.ceil(total / limit));

  const openInspector = (businessId: string) => {
    setActionMode(null);
    setReasonInput("");
    setActionError(null);
    setLocalInspectId(businessId);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("inspect", businessId);
    setSearchParams(nextParams);
  };

  const closeInspector = () => {
    setLocalInspectId(null);
    setActionMode(null);
    setReasonInput("");
    setActionError(null);
    if (searchParams.has("inspect")) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("inspect");
      setSearchParams(nextParams);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(searchInput.trim());
    setPage(1);
  };

  const handleLifecycleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectedBusinessId || !actionMode) return;
    setActionError(null);
    setActionSuccess(null);

    const trimmed = reasonInput.trim();
    if (actionMode === "SUSPEND" && trimmed.length < 3) {
      setActionError("A suspension reason of at least 3 characters is required.");
      return;
    }
    if (actionMode === "REINSTATE" && trimmed.length > 0 && trimmed.length < 3) {
      setActionError("Optional reinstatement reason must be at least 3 characters if provided.");
      return;
    }

    try {
      if (actionMode === "SUSPEND") {
        const updated = await suspendMutation.mutateAsync({
          businessId: inspectedBusinessId,
          data: { reason: trimmed }
        });
        setActionSuccess(`Host business "${updated.tradeName}" suspended.`);
      } else {
        const updated = await reinstateMutation.mutateAsync({
          businessId: inspectedBusinessId,
          data: trimmed.length >= 3 ? { reason: trimmed } : {}
        });
        setActionSuccess(
          `Host business "${updated.tradeName}" reinstated to status ${updated.status}.`
        );
      }
      setActionMode(null);
      setReasonInput("");
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Unable to update host business lifecycle status."
      );
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Partner Host Business Directory"
        subtitle="Inspect onboarded storage operator entities, linked locations, KYC standing, and execute Superadmin suspend or reinstate governance."
        badge={showDemoPreview ? "Demo Preview" : "Partner Governance"}
        rightSlot={
          <Link
            to={`/admin/hosts/review${querySuffix}`}
            className="px-3.5 py-2 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold transition shadow-sm"
          >
            Open KYC Review Queue
          </Link>
        }
      />

      {effectiveAdminRole === "SUPPORT" && (
        <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-sand-100 border border-sand-200 text-navy-900 text-xs font-bold">
          Read-Only Support View (Host Suspension & Reinstatement Restricted to Superadmin)
        </div>
      )}

      {hostsQuery.isError && (
        <AdminQueryErrorAlert
          message={
            hostsQuery.error instanceof Error
              ? hostsQuery.error.message
              : "Unable to load host business directory."
          }
          onRetry={() => void hostsQuery.refetch()}
        />
      )}

      {actionError && (
        <AdminQueryErrorAlert
          message={actionError}
          onRetry={() => {
            if (inspectedBusinessId) void detailQuery.refetch();
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

      {/* Search & Status Filters */}
      {!showDemoPreview && (
        <div className="bg-white rounded-2xl border border-sand-200 p-4 space-y-3 shadow-sm">
          <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-sand-700 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by trade name, legal name, BRN, city, or owner email..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-sand-200 text-xs text-navy-950"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold transition"
            >
              Search Hosts
            </button>
            {appliedSearch && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setAppliedSearch("");
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl border border-sand-200 text-xs font-bold text-navy-900 hover:bg-sand-100 transition"
              >
                Clear
              </button>
            )}
          </form>

          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setStatusFilter(opt.value);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  statusFilter === opt.value
                    ? "bg-navy-900 text-white shadow-sm"
                    : "bg-sand-50 border border-sand-200 text-navy-900 hover:bg-sand-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Directory List */}
      <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
        {showDemoPreview ? (
          <div className="p-4 rounded-xl bg-sand-50 border border-sand-200 flex items-center justify-between text-xs">
            <div>
              <p className="font-bold text-navy-950">Lanka Harbor Left-Luggage (Demo Preview)</p>
              <p className="text-sand-700 mt-0.5">
                Colombo • 2 active locations • KYC: APPROVED
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
              ACTIVE
            </span>
          </div>
        ) : hostsQuery.isLoading ? (
          <AdminTableSkeleton rows={5} columns={6} />
        ) : hosts.length === 0 ? (
          <AdminEmptyStateCard
            title="No host businesses match this filter"
            description="Adjust the status filter or search query to inspect onboarded host operators."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-sand-200 text-sand-700">
                  <th className="pb-2.5 pr-4 font-bold">Business</th>
                  <th className="pb-2.5 pr-4 font-bold">Owner & Contact</th>
                  <th className="pb-2.5 pr-4 font-bold">KYC</th>
                  <th className="pb-2.5 pr-4 font-bold">Locations</th>
                  <th className="pb-2.5 pr-4 font-bold">Status</th>
                  <th className="pb-2.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {hosts.map((host) => (
                  <tr key={host.id} className="hover:bg-sand-50/70 transition-colors">
                    <td className="py-3 pr-4">
                      <p className="font-bold text-navy-950">{host.tradeName}</p>
                      <p className="text-[11px] text-sand-700">
                        {host.legalBusinessName}
                        {host.businessRegistrationNumber ? ` • BRN ${host.businessRegistrationNumber}` : ""}
                      </p>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-navy-900">{host.ownerDisplayName}</p>
                      <p className="text-[11px] text-sand-700">{host.ownerEmail}</p>
                    </td>
                    <td className="py-3 pr-4">
                      {host.verificationStatus ? (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeToneClasses(host.verificationStatus)}`}
                        >
                          {host.verificationStatus}
                        </span>
                      ) : (
                        <span className="text-sand-500">Not submitted</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-navy-900 tabular-nums">
                      {host.activeLocationCount} active / {host.locationCount} total
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeToneClasses(host.status)}`}
                      >
                        {host.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openInspector(host.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white font-bold transition"
                      >
                        <Eye className="w-3.5 h-3.5" /> Inspect Business
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!showDemoPreview && hosts.length > 0 && (
          <AdminPaginationBar
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Host Detail & Lifecycle Slide-Over Drawer */}
      <SlideOverDrawer
        open={Boolean(inspectedBusinessId && !showDemoPreview)}
        onClose={closeInspector}
        ariaLabel="Host Business Inspection Drawer"
        closeLabel="Close host inspector"
        size="xl"
        title={
          detailQuery.data?.tradeName ??
          (inspectedBusinessId ? `Business ${inspectedBusinessId.slice(0, 8)}` : "Host Inspector")
        }
        subtitle={detailQuery.data?.legalBusinessName}
        badge={
          detailQuery.data && (
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeToneClasses(
                detailQuery.data.status
              )}`}
            >
              {detailQuery.data.status}
            </span>
          )
        }
      >
        <div className="space-y-5 text-xs">
          {detailQuery.isError ? (
            <AdminQueryErrorAlert
              message={
                detailQuery.error instanceof Error
                  ? detailQuery.error.message
                  : "Unable to load host business detail."
              }
              onRetry={() => void detailQuery.refetch()}
            />
          ) : detailQuery.isLoading || !detailQuery.data ? (
            <AdminCardListSkeleton count={3} />
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-sand-50 border border-sand-200">
                <div>
                  <span className="text-[11px] font-bold text-sand-700 uppercase">
                    Legal Business Name
                  </span>
                  <p className="font-bold text-navy-950 mt-0.5">
                    {detailQuery.data.legalBusinessName}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-sand-700 uppercase">
                    BRN & Entity Type
                  </span>
                  <p className="font-semibold text-navy-900 mt-0.5">
                    {detailQuery.data.businessRegistrationNumber || "Not recorded"} •{" "}
                    {detailQuery.data.entityType}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-sand-700 uppercase">
                    Tax Identifier & Country
                  </span>
                  <p className="font-semibold text-navy-900 mt-0.5">
                    {detailQuery.data.taxIdentifier || "None"} ({detailQuery.data.countryCode})
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-sand-700 uppercase">
                    Owner Account
                  </span>
                  <p className="font-semibold text-navy-900 mt-0.5">
                    {detailQuery.data.ownerDisplayName} ({detailQuery.data.ownerEmail})
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-sand-700 uppercase">
                    Registered Address
                  </span>
                  <p className="font-semibold text-navy-900 mt-0.5">
                    {[
                      detailQuery.data.addressLine1,
                      detailQuery.data.addressLine2,
                      detailQuery.data.city,
                      detailQuery.data.postalCode
                    ]
                      .filter(Boolean)
                      .join(", ") || "Not provided"}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-sand-700 uppercase">
                    Business Status & KYC
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeToneClasses(detailQuery.data.status)}`}
                    >
                      {detailQuery.data.status}
                    </span>
                    {detailQuery.data.latestVerification && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeToneClasses(detailQuery.data.latestVerification.status)}`}
                      >
                        KYC: {detailQuery.data.latestVerification.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Linked Storage Locations */}
              <div className="space-y-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-navy-900">
                  Linked Storage Locations ({detailQuery.data.locations.length})
                </h3>
                {detailQuery.data.locations.length === 0 ? (
                  <p className="text-sand-700 italic">No storage locations registered yet.</p>
                ) : (
                  <div className="space-y-2">
                    {detailQuery.data.locations.map((loc) => (
                      <div
                        key={loc.id}
                        className="p-3 rounded-xl border border-sand-200 flex flex-wrap items-center justify-between gap-2 bg-white"
                      >
                        <div>
                          <p className="font-bold text-navy-950">{loc.name}</p>
                          <p className="text-[11px] text-sand-700 tabular-nums">
                            {loc.city} • {loc.bookingMode} • Updated{" "}
                            {formatDateTimeDisplay(loc.updatedAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeToneClasses(loc.status)}`}
                          >
                            {loc.status}
                          </span>
                          <Link
                            to={`/admin/locations?inspect=${loc.id}`}
                            className="px-2.5 py-1 rounded-lg border border-sand-200 font-bold text-navy-900 hover:bg-sand-100 transition"
                          >
                            Inspect Location
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Superadmin Lifecycle Controls */}
              <PermissionGate
                permission={SYSTEM_PERMISSIONS.ADMIN_HOST_VERIFY}
                fallback={
                  <p className="text-xs text-sand-700 italic border-t border-sand-200 pt-3">
                    Host suspension and reinstatement actions require Superadmin KYC/Host
                    management permission.
                  </p>
                }
              >
                <div className="border-t border-sand-200 pt-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {detailQuery.data.status !== "SUSPENDED" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setActionMode("SUSPEND");
                          setReasonInput("");
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" /> Suspend Host Business
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setActionMode("REINSTATE");
                          setReasonInput("");
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" /> Reinstate Host Business
                      </button>
                    )}
                  </div>

                  {actionMode && (
                    <form
                      onSubmit={handleLifecycleSubmit}
                      className="p-4 rounded-xl bg-sand-50 border border-sand-200 space-y-3"
                    >
                      <p className="font-bold text-navy-950">
                        {actionMode === "SUSPEND"
                          ? "Confirm Host Business Suspension (hides locations from public discovery & blocks host edits)"
                          : "Confirm Host Business Reinstatement (restores ACTIVE status only if KYC is APPROVED)"}
                      </p>
                      <textarea
                        rows={2}
                        value={reasonInput}
                        onChange={(e) => setReasonInput(e.target.value)}
                        placeholder={
                          actionMode === "SUSPEND"
                            ? "Required suspension reason (min 3 chars)..."
                            : "Optional reinstatement note..."
                        }
                        className="w-full px-3 py-2 rounded-xl border border-sand-200 bg-white text-xs text-navy-950"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          disabled={suspendMutation.isPending || reinstateMutation.isPending}
                          className="px-4 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-bold disabled:opacity-50 transition"
                        >
                          {suspendMutation.isPending || reinstateMutation.isPending
                            ? "Applying..."
                            : actionMode === "SUSPEND"
                              ? "Execute Suspend"
                              : "Execute Reinstate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActionMode(null)}
                          className="px-4 py-2 rounded-xl border border-sand-200 bg-white font-bold text-navy-900 hover:bg-sand-100 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </PermissionGate>
            </div>
          )}
        </div>
      </SlideOverDrawer>
    </div>
  );
}

export const AdminHostDirectoryManagementPage = AdminHostDirectoryPage;
