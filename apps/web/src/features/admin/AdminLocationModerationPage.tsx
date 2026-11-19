import React, { useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  LOCATION_STATUSES,
  SYSTEM_PERMISSIONS,
  type LocationModerationQueueQuery,
  type ReviewLocationRequest
} from "@luggage-storage/contracts";
import { CheckCircle2, ExternalLink, Eye, MapPin, XCircle, ZoomIn } from "lucide-react";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { SlideOverDrawer } from "@/components/ui";
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
  AdminCardListSkeleton,
  AdminEmptyStateCard,
  AdminImageLightboxModal,
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
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    caption?: string | null;
    title?: string;
  } | null>(null);

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
        badge={showDemoPreview ? "Demo Preview" : "Supply Quality Gate"}
      />

      {effectiveAdminRole === "SUPPORT" && (
        <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-sand-100 border border-sand-200 text-navy-900 text-xs font-bold">
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
                  ? "bg-navy-900 text-white shadow-sm"
                  : "bg-white border border-sand-200 text-navy-900 hover:bg-sand-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Moderation Queue List */}
      <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
        {showDemoPreview ? (
          <div className="p-4 rounded-xl bg-sand-50 border border-sand-200 flex items-center justify-between text-xs">
            <div>
              <p className="font-bold text-navy-950">Galle Bastion Vault (Demo Preview)</p>
              <p className="text-sand-700 mt-0.5">
                Galle • 4 photos uploaded • Submitted for moderation
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 font-bold">
              PENDING_REVIEW
            </span>
          </div>
        ) : queueQuery.isLoading ? (
          <AdminCardListSkeleton count={4} />
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
                className="p-4 rounded-xl border border-sand-200 bg-sand-50/70 hover:border-sand-300 transition flex flex-wrap items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-navy-950 text-sm">{item.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeToneClasses(item.status)}`}
                    >
                      {item.status}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-sand-100 border border-sand-200 text-navy-900 text-[11px] font-semibold">
                      {item.imageCount} image(s)
                    </span>
                  </div>
                  <p className="text-navy-900">
                    {item.addressLine1}, {item.city} • Host:{" "}
                    <strong>{item.legalBusinessName ?? item.businessName}</strong>
                    {item.businessStatus ? ` (${item.businessStatus})` : ""}
                  </p>
                  <p className="text-[11px] text-sand-700 tabular-nums">
                    {item.ownerDisplayName ? `Owner: ${item.ownerDisplayName}` : "Host partner"}
                    {item.ownerEmail ? ` (${item.ownerEmail})` : ""} • Submitted{" "}
                    {formatDateTimeDisplay(item.submittedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openInspector(item.locationId)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-bold transition"
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

      {/* Location Inspection & Moderation Slide-Over Drawer */}
      <SlideOverDrawer
        open={Boolean(inspectedLocationId && !showDemoPreview)}
        onClose={closeInspector}
        ariaLabel="Location Inspection Drawer"
        closeLabel="Close location inspector"
        size="xl"
        title={
          detailQuery.data?.name ??
          (inspectedLocationId ? `Location ${inspectedLocationId.slice(0, 8)}` : "Location Inspector")
        }
        subtitle={
          detailQuery.data
            ? `${detailQuery.data.addressLine1}, ${detailQuery.data.city}`
            : undefined
        }
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
                  : "Unable to load full location details."
              }
              onRetry={() => void detailQuery.refetch()}
            />
          ) : detailQuery.isLoading || !detailQuery.data ? (
            <AdminCardListSkeleton count={4} />
          ) : (
            <div className="space-y-5">
              {/* Exact Private Address & Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-sand-50 border border-sand-200">
                <div>
                  <span className="text-[11px] font-bold text-sand-700 uppercase">
                    Private Street Address
                  </span>
                  <p className="font-bold text-navy-950 mt-0.5">
                    {detailQuery.data.addressLine1}
                    {detailQuery.data.addressLine2 ? `, ${detailQuery.data.addressLine2}` : ""}
                  </p>
                  <p className="text-sand-700">
                    {detailQuery.data.city}
                    {detailQuery.data.postalCode ? ` ${detailQuery.data.postalCode}` : ""} (
                    {detailQuery.data.countryCode})
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-sand-700 uppercase">
                    Exact GPS Coordinates
                  </span>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <p className="font-mono font-bold text-navy-950 tabular-nums">
                      {detailQuery.data.latitude.toFixed(6)}, {detailQuery.data.longitude.toFixed(6)}
                    </p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${detailQuery.data.latitude.toFixed(
                        6
                      )},${detailQuery.data.longitude.toFixed(6)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-sand-200 text-terracotta-600 hover:text-terracotta-700 font-bold text-[11px]"
                    >
                      <MapPin className="h-3 w-3" />
                      <span>View on Map</span>
                    </a>
                  </div>
                  <p className="text-sand-700 mt-0.5">Timezone: {detailQuery.data.timezone}</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-[11px] font-bold text-sand-700 uppercase">
                    Booking & Moderation Standing
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeToneClasses(detailQuery.data.status)}`}
                    >
                      {detailQuery.data.status}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-sand-200 text-navy-950 text-[11px] font-bold">
                      {detailQuery.data.bookingMode}
                    </span>
                    {detailQuery.data.acceptsOversized && (
                      <span className="px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-900 text-[11px] font-bold">
                        Oversized Ready
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {detailQuery.data.description && (
                <div className="p-3.5 rounded-xl border border-sand-200 bg-white">
                  <span className="text-[11px] font-bold text-sand-700 uppercase">
                    Location Description
                  </span>
                  <p className="text-navy-900 mt-1 leading-relaxed">{detailQuery.data.description}</p>
                </div>
              )}

              {/* Amenities */}
              {detailQuery.data.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {detailQuery.data.amenities.map((amenity) => (
                    <span
                      key={amenity}
                      className="px-2.5 py-1 rounded-full bg-sand-100 border border-sand-200 text-[11px] font-semibold text-navy-900"
                    >
                      {amenity.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}

              {/* Media Gallery with Real Photo Thumbnails + Lightbox */}
              <div className="space-y-2.5">
                <h3 className="font-extrabold uppercase tracking-wide text-navy-900">
                  Uploaded Facility Media ({detailQuery.data.images.length})
                </h3>
                {detailQuery.data.images.length === 0 ? (
                  <p className="text-sand-700 italic">No facility photos uploaded.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {detailQuery.data.images.map((img) => {
                      const label =
                        img.caption || (img.isPrimary ? "Primary Facility Photo" : "Facility Photo");
                      return (
                        <div
                          key={img.id}
                          className="rounded-xl border border-sand-200 bg-sand-50 overflow-hidden flex flex-col"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setLightboxImage({
                                url: img.url,
                                title: detailQuery.data?.name || "Facility Photo",
                                caption: label
                              })
                            }
                            className="group relative aspect-[4/3] w-full bg-sand-100 overflow-hidden focus:outline-none"
                            aria-label={`Zoom ${label}`}
                          >
                            <img
                              src={img.url}
                              alt={label}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-navy-950/75 text-white text-[10px] font-bold">
                              <ZoomIn className="h-3 w-3" /> Zoom
                            </span>
                            {img.isPrimary && (
                              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-terracotta-500 text-white text-[10px] font-bold shadow">
                                Primary
                              </span>
                            )}
                          </button>
                          <div className="p-2.5 flex items-center justify-between gap-2 bg-white border-t border-sand-200">
                            <p className="font-bold text-navy-950 truncate">{label}</p>
                            <a
                              href={img.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-terracotta-600 hover:underline flex-shrink-0"
                            >
                              <span>Open Full Photo</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Opening Hours & Exceptions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-sand-200 space-y-2">
                  <h3 className="font-extrabold uppercase tracking-wide text-navy-900">
                    Weekly Opening Hours
                  </h3>
                  {detailQuery.data.openingHours.length === 0 ? (
                    <p className="text-sand-700 italic">No operating hours configured.</p>
                  ) : (
                    <ul className="space-y-1">
                      {detailQuery.data.openingHours.map((slot) => (
                        <li
                          key={slot.id}
                          className="flex items-center justify-between text-navy-900 tabular-nums"
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

                <div className="p-4 rounded-xl border border-sand-200 space-y-2">
                  <h3 className="font-extrabold uppercase tracking-wide text-navy-900">
                    Schedule Exceptions ({detailQuery.data.exceptions.length})
                  </h3>
                  {detailQuery.data.exceptions.length === 0 ? (
                    <p className="text-sand-700 italic">No special hours or closures logged.</p>
                  ) : (
                    <ul className="space-y-1">
                      {detailQuery.data.exceptions.map((ex) => (
                        <li key={ex.id} className="text-navy-900">
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
                <div className="p-4 rounded-xl border border-sand-200 space-y-2">
                  <h3 className="font-extrabold uppercase tracking-wide text-navy-900">
                    Storage Zones ({detailQuery.data.zones.length}) & Capacity Pools (
                    {poolsQuery.data?.length ?? 0})
                  </h3>
                  {detailQuery.data.zones.length === 0 && (poolsQuery.data?.length ?? 0) === 0 ? (
                    <p className="text-sand-700 italic">No zones or capacity pools configured.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {detailQuery.data.zones.map((z) => (
                        <p key={z.id} className="text-navy-900">
                          Zone <strong>{z.name}</strong> ({z.zoneType} • {z.securityTier})
                        </p>
                      ))}
                      {(poolsQuery.data ?? []).map((p) => (
                        <p key={p.id} className="text-navy-900">
                          Pool <strong>{p.poolType}</strong>
                          {p.dedicatedBagCategory
                            ? ` (${formatBagCategoryLabel(p.dedicatedBagCategory)})`
                            : ""}
                          : <strong className="tabular-nums">{p.totalUnits}</strong> capacity units
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl border border-sand-200 space-y-2">
                  <h3 className="font-extrabold uppercase tracking-wide text-navy-900">
                    Pricing Policy & Tiers
                  </h3>
                  {pricingQuery.isLoading ? (
                    <p className="text-sand-700">Loading pricing...</p>
                  ) : !pricingQuery.data ? (
                    <p className="text-sand-700 italic">No pricing policy configured.</p>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="font-bold text-navy-950 tabular-nums">
                        Base Rate:{" "}
                        {formatLkrMinor(
                          pricingQuery.data.baseRateMinor,
                          pricingQuery.data.currency
                        )}{" "}
                        {formatPricingUnitLabel(pricingQuery.data.pricingUnit)}
                      </p>
                      {pricingQuery.data.tierRates.map((tier) => (
                        <p key={tier.id} className="text-navy-900 tabular-nums">
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
                  <p className="text-sand-700 italic border-t border-sand-200 pt-3">
                    Location moderation decisions require Superadmin moderation permission.
                  </p>
                }
              >
                <div className="border-t border-sand-200 pt-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDecisionMode("APPROVE");
                        setActionError(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve Location
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDecisionMode("REJECT");
                        setActionError(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject Location
                    </button>
                  </div>

                  {decisionMode && (
                    <form
                      onSubmit={handleReviewSubmit}
                      className="p-4 rounded-xl bg-sand-50 border border-sand-200 space-y-3"
                    >
                      <p className="font-bold text-navy-950">Decision: {decisionMode}</p>
                      {decisionMode === "REJECT" && (
                        <div>
                          <label className="block font-bold text-navy-900 mb-1">
                            Rejection Reason (shown to Host Owner)
                          </label>
                          <textarea
                            rows={2}
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Explain missing safety photos, inaccurate pin, or hours mismatch..."
                            className="w-full px-3 py-2 rounded-xl border border-sand-200 bg-white text-xs text-navy-950"
                          />
                        </div>
                      )}
                      <div>
                        <label className="block font-bold text-navy-900 mb-1">
                          Internal Moderation Notes (optional)
                        </label>
                        <textarea
                          rows={2}
                          value={adminNotes}
                          onChange={(e) => setAdminNotes(e.target.value)}
                          placeholder="Internal reviewer compliance observations..."
                          className="w-full px-3 py-2 rounded-xl border border-sand-200 bg-white text-xs text-navy-950"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          disabled={reviewMutation.isPending}
                          className="px-4 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-bold disabled:opacity-50 transition"
                        >
                          {reviewMutation.isPending ? "Submitting..." : "Confirm Decision"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDecisionMode(null)}
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

      <AdminImageLightboxModal
        image={lightboxImage}
        onClose={() => setLightboxImage(null)}
      />
    </div>
  );
}

export const AdminStorageLocationModerationPage = AdminLocationModerationPage;
