import React, { useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  LOCATION_STATUSES,
  SYSTEM_PERMISSIONS,
  type LocationModerationQueueQuery,
  type ReviewLocationRequest
} from "@luggage-storage/contracts";
import { CheckCircle2, Eye, MapPin, X, XCircle } from "lucide-react";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { MascotIllustration } from "@/components/ui";
import { isDemoPreviewActive } from "@/config/demo-preview";
import {
  useAdminLocationDetailQuery,
  useAdminLocationModerationQuery,
  useAdminLocationPoolsQuery,
  useAdminLocationPricingQuery,
  useReviewAdminLocationMutation
} from "@/hooks/queries/use-admin-portal";
import {
  formatBagCategoryLabel,
  formatDateTimeDisplay,
  formatDayOfWeek,
  formatLkrMinor,
  formatPricingUnitLabel
} from "@/lib/formatters";
import { useAuthStore } from "@/store/useAuthStore";
import {
  AdminEmptyStateCard,
  AdminPageHeader,
  AdminPaginationBar,
  AdminQueryErrorAlert,
  isUuid,
  statusBadgeToneClasses
} from "./admin-helpers";
import { useAdminRole } from "./AdminDashboardLayout";

type LocationQueueStatusFilter = NonNullable<LocationModerationQueueQuery["status"]>;

const STATUS_FILTER_OPTIONS: Array<{ value: LocationQueueStatusFilter; label: string }> = [
  { value: "PENDING_REVIEW", label: "Pending Review" },
  ...LOCATION_STATUSES.filter((s) => s !== "PENDING_REVIEW").map((s) => ({
    value: s,
    label: s.replace(/_/g, " ")
  })),
  { value: "ALL", label: "All Locations" }
];

export function AdminLocationModerationPage() {
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

  const [statusFilter, setStatusFilter] = useState<LocationQueueStatusFilter>("PENDING_REVIEW");
  const [page, setPage] = useState(1);
  const limit = 20;

  const inspectParam = searchParams.get("inspect");
  const [localInspectId, setLocalInspectId] = useState<string | null>(null);
  const inspectedLocationId =
    (isUuid(inspectParam) ? inspectParam : null) ??
    (isUuid(localInspectId) ? localInspectId : null);

  const [decisionMode, setDecisionMode] = useState<ReviewLocationRequest["decision"] | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const queueQuery = useAdminLocationModerationQuery(
    { page, limit, status: statusFilter },
    { enabled: isAuthenticated && !showDemoPreview }
  );

  const detailQuery = useAdminLocationDetailQuery(inspectedLocationId ?? undefined, {
    enabled: isAuthenticated && !showDemoPreview && Boolean(inspectedLocationId)
  });
  const poolsQuery = useAdminLocationPoolsQuery(inspectedLocationId ?? undefined, {
    enabled: isAuthenticated && !showDemoPreview && Boolean(inspectedLocationId)
  });
  const pricingQuery = useAdminLocationPricingQuery(inspectedLocationId ?? undefined, {
    enabled: isAuthenticated && !showDemoPreview && Boolean(inspectedLocationId)
  });
  const reviewMutation = useReviewAdminLocationMutation();

  const liveQueue = queueQuery.data?.queue ?? [];
  const total = queueQuery.data?.total ?? 0;

  const openInspector = (locationId: string) => {
    setActionError(null);
    setDecisionMode(null);
    setRejectionReason("");
    setAdminNotes("");
    setLocalInspectId(locationId);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("inspect", locationId);
    setSearchParams(nextParams);
  };

  const closeInspector = () => {
    setLocalInspectId(null);
    setDecisionMode(null);
    if (searchParams.has("inspect")) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("inspect");
      setSearchParams(nextParams);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectedLocationId || !decisionMode) return;
    setActionError(null);
    setActionSuccess(null);

    if (decisionMode === "REJECT" && rejectionReason.trim().length < 3) {
      setActionError("A rejection reason of at least 3 characters is required.");
      return;
    }

    try {
      const updated = await reviewMutation.mutateAsync({
        locationId: inspectedLocationId,
        data: {
          decision: decisionMode,
          ...(decisionMode === "REJECT" ? { rejectionReason: rejectionReason.trim() } : {}),
          ...(adminNotes.trim() ? { adminNotes: adminNotes.trim() } : {})
        }
      });
      setActionSuccess(
        `Storage location "${updated.name}" updated to moderation status ${updated.status}.`
      );
      setDecisionMode(null);
      setRejectionReason("");
      setAdminNotes("");
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Unable to submit location moderation decision."
      );
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Storage Location Moderation & Quality Audit"
        subtitle="Inspect exact coordinates, private address, uploaded photos, opening hours, storage zones, capacity pools, and pricing tiers before approving listings."
        rightSlot={
          <MascotIllustration mascot="map" size="sm" caption="Supply Quality Gate" />
        }
      />

      {effectiveAdminRole === "SUPPORT" && (
        <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold">
          Read-Only Support View (Location Approval & Rejection Restricted to Superadmin)
        </div>
      )}

      {queueQuery.isError && (
        <AdminQueryErrorAlert
          message={
            queueQuery.error instanceof Error
              ? queueQuery.error.message
              : "Unable to load storage location moderation queue."
          }
          onRetry={() => void queueQuery.refetch()}
        />
      )}

      {actionError && (
        <AdminQueryErrorAlert
          message={actionError}
          onRetry={() => {
            if (inspectedLocationId) void detailQuery.refetch();
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

      {/* Status Filters */}
      {!showDemoPreview && (
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
                  ? "bg-purple-700 text-white"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Moderation Queue List */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        {showDemoPreview ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <p className="font-bold text-slate-900">Galle Bastion Vault (Demo Preview)</p>
              <p className="text-slate-600 mt-0.5">
                Galle • 4 photos uploaded • Submitted for moderation
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 font-bold">
              PENDING_REVIEW
            </span>
          </div>
        ) : queueQuery.isLoading ? (
          <p className="text-xs text-slate-500 py-4 text-center">Loading moderation queue...</p>
        ) : liveQueue.length === 0 ? (
          <AdminEmptyStateCard
            title="No storage locations match this filter"
            description="No partner storage hubs currently match the selected moderation status."
          />
        ) : (
          <div className="space-y-3 text-xs">
            {liveQueue.map((item) => (
              <div
                key={item.locationId}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-950 text-sm">{item.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeToneClasses(item.status)}`}
                    >
                      {item.status}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
                      {item.imageCount} image(s)
                    </span>
                  </div>
                  <p className="text-slate-700">
                    {item.addressLine1}, {item.city} • Host:{" "}
                    <strong>{item.legalBusinessName ?? item.businessName}</strong>
                    {item.businessStatus ? ` (${item.businessStatus})` : ""}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {item.ownerDisplayName ? `Owner: ${item.ownerDisplayName}` : "Host partner"}
                    {item.ownerEmail ? ` (${item.ownerEmail})` : ""} • Submitted{" "}
                    {formatDateTimeDisplay(item.submittedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openInspector(item.locationId)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold"
                >
                  <Eye className="w-3.5 h-3.5" /> Inspect & Review
                </button>
              </div>
            ))}
          </div>
        )}

        {!showDemoPreview && liveQueue.length > 0 && (
          <AdminPaginationBar
            page={page}
            totalPages={Math.max(1, Math.ceil(total / limit))}
            total={total}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Location Inspection & Moderation Drawer */}
      {inspectedLocationId && !showDemoPreview && (
        <section
          aria-label="Location Inspection Drawer"
          className="bg-white rounded-2xl border-2 border-purple-300 p-6 shadow-lg space-y-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
                Storage Location Moderator
              </span>
              <h2 className="text-lg font-extrabold text-slate-950 mt-0.5 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-purple-700" />
                {detailQuery.data?.name ?? `Location ${inspectedLocationId.slice(0, 8)}`}
              </h2>
            </div>
            <button
              type="button"
              onClick={closeInspector}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <X className="w-3.5 h-3.5" /> Close
            </button>
          </div>

          {detailQuery.isError ? (
            <AdminQueryErrorAlert
              message={
                detailQuery.error instanceof Error
                  ? detailQuery.error.message
                  : "Unable to load full location details."
              }
              onRetry={() => void detailQuery.refetch()}
            />
          ) : detailQuery.isLoading || !detailQuery.data ? (
            <p className="text-xs text-slate-500 py-4">Loading location configuration...</p>
          ) : (
            <div className="space-y-5 text-xs">
              {/* Exact Private Address & Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                    Private Street Address
                  </span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {detailQuery.data.addressLine1}
                    {detailQuery.data.addressLine2 ? `, ${detailQuery.data.addressLine2}` : ""}
                  </p>
                  <p className="text-slate-600">
                    {detailQuery.data.city}
                    {detailQuery.data.postalCode ? ` ${detailQuery.data.postalCode}` : ""} (
                    {detailQuery.data.countryCode})
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                    Exact GPS Coordinates
                  </span>
                  <p className="font-mono font-bold text-slate-800 mt-0.5">
                    {detailQuery.data.latitude.toFixed(6)}, {detailQuery.data.longitude.toFixed(6)}
                  </p>
                  <p className="text-slate-500">Timezone: {detailQuery.data.timezone}</p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                    Booking & Moderation Standing
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeToneClasses(detailQuery.data.status)}`}
                    >
                      {detailQuery.data.status}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[11px] font-bold">
                      {detailQuery.data.bookingMode}
                    </span>
                    {detailQuery.data.acceptsOversized && (
                      <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-bold">
                        Oversized Ready
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {detailQuery.data.description && (
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                    Location Description
                  </span>
                  <p className="text-slate-800 mt-1">{detailQuery.data.description}</p>
                </div>
              )}

              {/* Amenities */}
              {detailQuery.data.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {detailQuery.data.amenities.map((amenity) => (
                    <span
                      key={amenity}
                      className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700"
                    >
                      {amenity.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}

              {/* Media Gallery */}
              <div className="space-y-2">
                <h3 className="font-extrabold uppercase tracking-wide text-slate-700">
                  Uploaded Facility Media ({detailQuery.data.images.length})
                </h3>
                {detailQuery.data.images.length === 0 ? (
                  <p className="text-slate-500 italic">No facility photos uploaded.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {detailQuery.data.images.map((img) => (
                      <a
                        key={img.id}
                        href={img.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 block"
                      >
                        <p className="font-bold text-slate-900 truncate">
                          {img.caption || (img.isPrimary ? "Primary Facility Photo" : "Facility Photo")}
                        </p>
                        <p className="text-[11px] text-purple-700 font-mono truncate mt-0.5">
                          {img.url}
                        </p>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Opening Hours & Exceptions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <h3 className="font-extrabold uppercase tracking-wide text-slate-700">
                    Weekly Opening Hours
                  </h3>
                  {detailQuery.data.openingHours.length === 0 ? (
                    <p className="text-slate-500 italic">No operating hours configured.</p>
                  ) : (
                    <ul className="space-y-1">
                      {detailQuery.data.openingHours.map((slot) => (
                        <li
                          key={slot.id}
                          className="flex items-center justify-between text-slate-700"
                        >
                          <span className="font-semibold">{formatDayOfWeek(slot.dayOfWeek)}</span>
                          <span>
                            {slot.isClosed
                              ? "Closed"
                              : `${slot.openTime.slice(0, 5)} – ${slot.closeTime.slice(0, 5)}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <h3 className="font-extrabold uppercase tracking-wide text-slate-700">
                    Schedule Exceptions ({detailQuery.data.exceptions.length})
                  </h3>
                  {detailQuery.data.exceptions.length === 0 ? (
                    <p className="text-slate-500 italic">No special hours or closures logged.</p>
                  ) : (
                    <ul className="space-y-1">
                      {detailQuery.data.exceptions.map((ex) => (
                        <li key={ex.id} className="text-slate-700">
                          <strong>{ex.exceptionDate}</strong> • {ex.exceptionType}
                          {ex.reason ? ` (${ex.reason})` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Zones, Capacity Pools & Pricing Policy */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <h3 className="font-extrabold uppercase tracking-wide text-slate-700">
                    Storage Zones ({detailQuery.data.zones.length}) & Capacity Pools (
                    {poolsQuery.data?.length ?? 0})
                  </h3>
                  {detailQuery.data.zones.length === 0 && (poolsQuery.data?.length ?? 0) === 0 ? (
                    <p className="text-slate-500 italic">No zones or capacity pools configured.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {detailQuery.data.zones.map((z) => (
                        <p key={z.id} className="text-slate-700">
                          Zone <strong>{z.name}</strong> ({z.zoneType} • {z.securityTier})
                        </p>
                      ))}
                      {(poolsQuery.data ?? []).map((p) => (
                        <p key={p.id} className="text-slate-700">
                          Pool <strong>{p.poolType}</strong>
                          {p.dedicatedBagCategory
                            ? ` (${formatBagCategoryLabel(p.dedicatedBagCategory)})`
                            : ""}
                          : <strong>{p.totalUnits}</strong> capacity units
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <h3 className="font-extrabold uppercase tracking-wide text-slate-700">
                    Pricing Policy & Tiers
                  </h3>
                  {pricingQuery.isLoading ? (
                    <p className="text-slate-500">Loading pricing...</p>
                  ) : !pricingQuery.data ? (
                    <p className="text-slate-500 italic">No pricing policy configured.</p>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="font-bold text-slate-900">
                        Base Rate:{" "}
                        {formatLkrMinor(
                          pricingQuery.data.baseRateMinor,
                          pricingQuery.data.currency
                        )}{" "}
                        {formatPricingUnitLabel(pricingQuery.data.pricingUnit)}
                      </p>
                      {pricingQuery.data.tierRates.map((tier) => (
                        <p key={tier.id} className="text-slate-700">
                          {formatBagCategoryLabel(tier.bagCategory)}:{" "}
                          <strong>
                            {formatLkrMinor(tier.rateMinor, pricingQuery.data?.currency)}
                          </strong>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Moderation Decision Controls */}
              <PermissionGate
                permission={SYSTEM_PERMISSIONS.ADMIN_LOCATION_MODERATE}
                fallback={
                  <p className="text-slate-500 italic border-t border-slate-200 pt-3">
                    Location moderation decisions require Superadmin moderation permission.
                  </p>
                }
              >
                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDecisionMode("APPROVE");
                        setActionError(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve Location
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDecisionMode("REJECT");
                        setActionError(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject Location
                    </button>
                  </div>

                  {decisionMode && (
                    <form
                      onSubmit={handleReviewSubmit}
                      className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                    >
                      <p className="font-bold text-slate-900">Decision: {decisionMode}</p>
                      {decisionMode === "REJECT" && (
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            Rejection Reason (shown to Host Owner)
                          </label>
                          <textarea
                            rows={2}
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Explain missing safety photos, inaccurate pin, or hours mismatch..."
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                          />
                        </div>
                      )}
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Internal Moderation Notes (optional)
                        </label>
                        <textarea
                          rows={2}
                          value={adminNotes}
                          onChange={(e) => setAdminNotes(e.target.value)}
                          placeholder="Internal reviewer compliance observations..."
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          disabled={reviewMutation.isPending}
                          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold disabled:opacity-50"
                        >
                          {reviewMutation.isPending ? "Submitting..." : "Confirm Decision"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDecisionMode(null)}
                          className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-white"
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
        </section>
      )}
    </div>
  );
}

export const AdminStorageLocationModerationPage = AdminLocationModerationPage;
