import React, { useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import {
  BOOKING_STATUSES,
  SYSTEM_PERMISSIONS,
  type BookingDetail,
  type BookingStatus,
  type CustodyRecordDetail
} from "@luggage-storage/contracts";
import { ArrowLeft, Ban, Download, Eye, ExternalLink, PackageCheck, Search, ZoomIn } from "lucide-react";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { Select, SlideOverDrawer } from "@/components/ui";
import { isDemoPreviewActive } from "@/config/demo-preview";
import { formatLkr } from "@/data/mock-marketplace";
import {
  useAdminBookingDetailQuery,
  useAdminBookingsQuery,
  useAdminCancelBookingMutation,
  useAdminCustodyDetailQuery
} from "@/hooks/queries/use-admin-portal";
import { downloadCsvFile, serializeCsv } from "@/lib/csv-export";
import { formatBagCategoryLabel, formatDateTimeDisplay, formatLkrMinor } from "@/lib/formatters";
import { useAuthStore } from "@/store/useAuthStore";
import {
  AdminCardListSkeleton,
  AdminEmptyStateCard,
  AdminImageLightboxModal,
  AdminPageHeader,
  AdminPaginationBar,
  AdminQueryErrorAlert,
  AdminTableSkeleton,
  formatAdminBookingStatus,
  formatAdminRefundStatus,
  isUuid,
  statusBadgeToneClasses
} from "./admin-helpers";
import { useAdminRole } from "./AdminDashboardLayout";

type BookingFilterStatus = BookingStatus | "ALL";

const PRIMARY_STATUS_TABS: Array<{ value: BookingFilterStatus; label: string }> = [
  { value: "ALL", label: "All Statuses" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "IN_STORAGE", label: "In Storage" },
  { value: "COMPLETED", label: "Completed" },
  { value: "DISPUTED", label: "Disputed" },
  { value: "CANCELLED_BY_TRAVELLER", label: "Cancelled" }
];

const CANCELLABLE_ADMIN_STATUSES = new Set<string>([
  "PENDING_HOST_APPROVAL",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "DISPUTED"
]);

function BookingDetailInspectorContent({
  detail,
  detailLoading,
  detailError,
  detailErrorObj,
  onRetryDetail,
  custody,
  custodyLoading,
  custodyError,
  custodyErrorObj,
  onRetryCustody,
  showCancelForm,
  setShowCancelForm,
  cancelReason,
  setCancelReason,
  cancelPending,
  onCancelSubmit,
  onPreviewPhoto
}: {
  detail: BookingDetail | undefined;
  detailLoading: boolean;
  detailError: boolean;
  detailErrorObj: unknown;
  onRetryDetail: () => void;
  custody: CustodyRecordDetail | null | undefined;
  custodyLoading: boolean;
  custodyError: boolean;
  custodyErrorObj: unknown;
  onRetryCustody: () => void;
  showCancelForm: boolean;
  setShowCancelForm: (open: boolean) => void;
  cancelReason: string;
  setCancelReason: (val: string) => void;
  cancelPending: boolean;
  onCancelSubmit: (e: React.FormEvent) => void;
  onPreviewPhoto: (img: { url: string; title?: string; caption?: string | null }) => void;
}) {
  if (detailError) {
    return (
      <AdminQueryErrorAlert
        message={
          detailErrorObj instanceof Error ? detailErrorObj.message : "Unable to load booking detail."
        }
        onRetry={onRetryDetail}
      />
    );
  }

  if (detailLoading || !detail) {
    return <AdminCardListSkeleton count={3} />;
  }

  return (
    <div className="space-y-5 text-xs">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 rounded-xl bg-sand-50 border border-sand-200">
        <div>
          <span className="text-[11px] font-bold text-sand-700 uppercase">Booking Status</span>
          <p className="mt-1">
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeToneClasses(detail.status)}`}
            >
              {formatAdminBookingStatus(detail.status, detail.collectionAt).label}
            </span>
          </p>
          <p className="text-[11px] text-sand-700 mt-1">Mode: {detail.bookingMode}</p>
        </div>
        <div>
          <span className="text-[11px] font-bold text-sand-700 uppercase">
            Traveller & Host Partner
          </span>
          <p className="font-bold text-navy-950 mt-0.5">
            {detail.travellerDisplayName ?? detail.travellerUserId}
          </p>
          <p className="text-[11px] text-sand-700">
            {detail.travellerEmailMasked ?? "Masked"} • Hub: {detail.location.name}
          </p>
        </div>
        <div>
          <span className="text-[11px] font-bold text-sand-700 uppercase">Schedule Window</span>
          <p className="font-semibold text-navy-900 mt-0.5 tabular-nums">
            Drop-off: {formatDateTimeDisplay(detail.dropOffAt)}
          </p>
          <p className="text-sand-700 tabular-nums">
            Collection: {formatDateTimeDisplay(detail.collectionAt)}
          </p>
        </div>
      </div>

      {/* Line Items & Pricing Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-sand-200 bg-white space-y-2">
          <h3 className="font-extrabold uppercase tracking-wide text-navy-900">
            Reserved Baggage Items
          </h3>
          <ul className="space-y-1">
            {detail.items.map((item) => (
              <li key={item.id} className="flex justify-between text-navy-900 tabular-nums">
                <span>
                  {item.quantity}x {formatBagCategoryLabel(item.bagCategory)} ({item.capacityUnits}{" "}
                  units)
                </span>
                <span className="font-bold">
                  {formatLkrMinor(item.lineTotalMinor, detail.currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-4 rounded-xl border border-sand-200 bg-white space-y-1.5 tabular-nums">
          <h3 className="font-extrabold uppercase tracking-wide text-navy-900">
            Non-Escrow Settlement Breakdown
          </h3>
          <div className="flex justify-between text-navy-950">
            <span>Gross Charged</span>
            <strong>{formatLkrMinor(detail.totalAmountMinor, detail.currency)}</strong>
          </div>
          {detail.pricingSnapshot?.platformCommissionMinor !== undefined && (
            <div className="flex justify-between text-terracotta-700">
              <span>Platform Commission</span>
              <strong>
                {formatLkrMinor(detail.pricingSnapshot.platformCommissionMinor, detail.currency)}
              </strong>
            </div>
          )}
          {detail.pricingSnapshot?.hostPayableMinor !== undefined && (
            <div className="flex justify-between text-emerald-800">
              <span>Net Host Payable</span>
              <strong>
                {formatLkrMinor(detail.pricingSnapshot.hostPayableMinor, detail.currency)}
              </strong>
            </div>
          )}
          {detail.refundSummary && (
            <div className="flex justify-between text-rose-800 pt-1 border-t border-sand-200">
              <span>
                Refund ({detail.refundSummary.refundPercentage}% •{" "}
                {formatAdminRefundStatus(detail.refundSummary.status).label})
              </span>
              <strong>{formatLkrMinor(detail.refundSummary.amountMinor, detail.currency)}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Chain of Custody Record */}
      <div className="p-4 rounded-xl border border-sand-200 bg-white space-y-3">
        <h3 className="font-extrabold uppercase tracking-wide text-navy-900">
          Physical Chain of Custody & Bag Evidence
        </h3>
        {custodyError ? (
          <AdminQueryErrorAlert
            message={
              custodyErrorObj instanceof Error
                ? custodyErrorObj.message
                : "Unable to load custody record."
            }
            onRetry={onRetryCustody}
          />
        ) : custodyLoading ? (
          <AdminCardListSkeleton count={1} />
        ) : !custody ? (
          <p className="text-sand-700 italic">
            No custody record initiated for this booking yet.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeToneClasses(custody.status)}`}
              >
                {custody.status}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-sand-100 border border-sand-200 text-navy-900 font-semibold">
                Handover: {custody.handoverCondition}
              </span>
              <span className="text-navy-900 tabular-nums">
                Expected {custody.expectedBagCount} • Checked-In{" "}
                {custody.checkedInBagCount ?? 0} • Released {custody.releasedBagCount ?? 0}
              </span>
              {custody.overdueMinutes > 0 && (
                <span className="text-rose-700 font-bold tabular-nums">
                  Overdue: {custody.overdueMinutes} min (
                  {formatLkrMinor(custody.overdueFeeMinor, detail.currency)})
                </span>
              )}
            </div>

            {custody.bags.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {custody.bags.map((bag) => (
                  <div
                    key={bag.id}
                    className="p-3 rounded-xl bg-sand-50 border border-sand-200 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-navy-950">{bag.bagTagCode}</span>
                      <span className="text-[11px] font-semibold text-sand-700">
                        {formatBagCategoryLabel(bag.bagCategory)}
                      </span>
                    </div>
                    <p className="text-[11px] text-sand-700">
                      Seal: {bag.securitySealNumber || "None recorded"}
                    </p>
                    {bag.conditionNotes && (
                      <p className="text-[11px] text-navy-900">{bag.conditionNotes}</p>
                    )}
                    {bag.photoDownloadUrl && (
                      <div className="pt-1 space-y-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onPreviewPhoto({
                              url: bag.photoDownloadUrl!,
                              title: `Custody Bag ${bag.bagTagCode}`,
                              caption: bag.securitySealNumber
                                ? `Seal ${bag.securitySealNumber}`
                                : bag.conditionNotes
                            })
                          }
                          className="group relative block w-full h-32 rounded-lg overflow-hidden border border-sand-200 bg-sand-100"
                          aria-label={`Zoom evidence photo for ${bag.bagTagCode}`}
                        >
                          <img
                            src={bag.photoDownloadUrl}
                            alt={`Custody evidence for bag ${bag.bagTagCode}`}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-navy-950/75 text-white text-[10px] font-bold">
                            <ZoomIn className="h-3 w-3" /> Zoom
                          </span>
                        </button>
                        <a
                          href={bag.photoDownloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-terracotta-600 hover:underline"
                        >
                          <span>View Evidence Photo</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Admin Cancel Booking (STRICT SUPERADMIN ONLY) */}
      {CANCELLABLE_ADMIN_STATUSES.has(detail.status) && (
        <PermissionGate
          permission={SYSTEM_PERMISSIONS.ADMIN_BOOKING_MANAGE}
          fallback={
            <p className="text-sand-700 italic border-t border-sand-200 pt-3">
              Platform-initiated cancellation requires Superadmin booking management permission.
            </p>
          }
        >
          <div className="border-t border-sand-200 pt-4 space-y-3">
            {!showCancelForm ? (
              <button
                type="button"
                onClick={() => setShowCancelForm(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition"
              >
                <Ban className="w-3.5 h-3.5" /> Admin Cancel Booking
              </button>
            ) : (
              <form
                onSubmit={onCancelSubmit}
                className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-3"
              >
                <p className="font-bold text-rose-950">
                  Confirm Platform Cancellation (releases capacity hold & triggers refund workflow
                  if paid)
                </p>
                <textarea
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Reason for platform cancellation (min 3 chars)..."
                  className="w-full px-3 py-2 rounded-xl border border-rose-300 bg-white text-xs text-navy-950"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={cancelPending}
                    className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold disabled:opacity-50 transition"
                  >
                    {cancelPending ? "Cancelling..." : "Execute Platform Cancellation"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCancelForm(false)}
                    className="px-4 py-2 rounded-xl border border-sand-200 bg-white font-bold text-navy-900 hover:bg-sand-100 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </PermissionGate>
      )}
    </div>
  );
}

export function AdminBookingsLedgerPage() {
  const location = useLocation();
  const params = useParams<{ id?: string }>();
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

  const isDedicatedDetailRoute = Boolean(params.id);

  const initialStatusParam = searchParams.get("status") as BookingStatus | null;
  const [statusFilter, setStatusFilter] = useState<BookingFilterStatus>(
    initialStatusParam && BOOKING_STATUSES.includes(initialStatusParam)
      ? initialStatusParam
      : "ALL"
  );
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const inspectQueryParam = searchParams.get("inspect");
  const [localInspectId, setLocalInspectId] = useState<string | null>(null);
  const inspectedBookingId = isDedicatedDetailRoute
    ? isUuid(params.id)
      ? params.id
      : null
    : (isUuid(inspectQueryParam) ? inspectQueryParam : null) ??
      (isUuid(localInspectId) ? localInspectId : null);

  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    title?: string;
    caption?: string | null;
  } | null>(null);

  const bookingsQuery = useAdminBookingsQuery(
    {
      page,
      limit,
      status: statusFilter === "ALL" ? undefined : statusFilter,
      search: appliedSearch || undefined
    },
    { enabled: isAuthenticated && !showDemoPreview && !isDedicatedDetailRoute }
  );

  const detailQuery = useAdminBookingDetailQuery(inspectedBookingId ?? undefined, {
    enabled: isAuthenticated && !showDemoPreview && Boolean(inspectedBookingId)
  });

  const custodyQuery = useAdminCustodyDetailQuery(inspectedBookingId ?? undefined, {
    enabled: isAuthenticated && !showDemoPreview && Boolean(inspectedBookingId)
  });

  const cancelMutation = useAdminCancelBookingMutation();

  const bookings = bookingsQuery.data?.bookings ?? [];
  const total = bookingsQuery.data?.total ?? 0;

  const updateStatusFilter = (nextStatus: BookingFilterStatus) => {
    setStatusFilter(nextStatus);
    setPage(1);
    const nextParams = new URLSearchParams(searchParams);
    if (nextStatus === "ALL") {
      nextParams.delete("status");
    } else {
      nextParams.set("status", nextStatus);
    }
    setSearchParams(nextParams);
  };

  const openInspector = (bookingId: string) => {
    setActionError(null);
    setShowCancelForm(false);
    setCancelReason("");
    setLocalInspectId(bookingId);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("inspect", bookingId);
    setSearchParams(nextParams);
  };

  const closeInspector = () => {
    setLocalInspectId(null);
    setShowCancelForm(false);
    setCancelReason("");
    if (searchParams.has("inspect")) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("inspect");
      setSearchParams(nextParams);
    }
  };

  const handleExportCsv = () => {
    const csv = serializeCsv(
      [
        "Booking Reference",
        "Status",
        "Location",
        "Host Business",
        "Traveller",
        "Bags",
        "Total Minor",
        "Currency",
        "Drop-off At",
        "Collection At"
      ],
      bookings.map((b) => [
        b.referenceCode,
        b.status,
        b.location.name,
        b.businessName ?? b.businessId,
        b.travellerDisplayName ?? b.travellerUserId,
        b.totalBags,
        b.totalAmountMinor,
        b.currency,
        b.dropOffAt,
        b.collectionAt
      ])
    );
    downloadCsvFile(`admin-bookings-page-${page}.csv`, csv);
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectedBookingId) return;
    setActionError(null);
    setActionSuccess(null);

    if (cancelReason.trim().length < 3) {
      setActionError("Platform cancellation reason must be at least 3 characters.");
      return;
    }

    try {
      const updated = await cancelMutation.mutateAsync({
        bookingId: inspectedBookingId,
        data: { reason: cancelReason.trim() }
      });
      setActionSuccess(
        `Booking ${updated.referenceCode} cancelled by platform (status: ${updated.status}).`
      );
      setShowCancelForm(false);
      setCancelReason("");
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Unable to cancel booking by platform."
      );
    }
  };

  if (isDedicatedDetailRoute) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            to={`/admin/bookings${querySuffix}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-navy-900 hover:text-terracotta-600 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>← Back to Global Bookings</span>
          </Link>
        </div>

        <AdminPageHeader
          title={
            detailQuery.data?.referenceCode
              ? `Booking & Custody Dossier: ${detailQuery.data.referenceCode}`
              : "Booking & Custody Dossier"
          }
          subtitle="Full-page reservation audit, non-escrow settlement split, and tamper-evident custody chain inspection."
          badge={detailQuery.data?.status ?? "Booking Oversight"}
          rightSlot={
            <Link
              to={`/admin/bookings${querySuffix}`}
              className="px-3.5 py-2 rounded-xl border border-sand-200 bg-white hover:bg-sand-100 text-xs font-bold text-navy-900 transition"
            >
              All Bookings
            </Link>
          }
        />

        {effectiveAdminRole === "SUPPORT" && (
          <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-sand-100 border border-sand-200 text-navy-900 text-xs font-bold">
            Read-Only Support View (Platform Force-Cancel Restricted to Superadmin)
          </div>
        )}

        {actionError && (
          <AdminQueryErrorAlert
            message={actionError}
            onRetry={() => {
              if (inspectedBookingId) void detailQuery.refetch();
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

        <div className="bg-white rounded-2xl border border-sand-200 p-6 shadow-sm">
          {!isUuid(params.id) ? (
            <AdminEmptyStateCard
              title="Invalid Booking Identifier"
              description="The requested booking ID is not a valid UUID."
              actionTo={`/admin/bookings${querySuffix}`}
              actionLabel="← Back to Global Bookings"
            />
          ) : (
            <BookingDetailInspectorContent
              detail={detailQuery.data}
              detailLoading={detailQuery.isLoading}
              detailError={detailQuery.isError}
              detailErrorObj={detailQuery.error}
              onRetryDetail={() => void detailQuery.refetch()}
              custody={custodyQuery.data}
              custodyLoading={custodyQuery.isLoading}
              custodyError={custodyQuery.isError}
              custodyErrorObj={custodyQuery.error}
              onRetryCustody={() => void custodyQuery.refetch()}
              showCancelForm={showCancelForm}
              setShowCancelForm={setShowCancelForm}
              cancelReason={cancelReason}
              setCancelReason={setCancelReason}
              cancelPending={cancelMutation.isPending}
              onCancelSubmit={handleCancelSubmit}
              onPreviewPhoto={setLightboxImage}
            />
          )}
        </div>

        <AdminImageLightboxModal
          image={lightboxImage}
          onClose={() => setLightboxImage(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Global Platform Bookings & Custody Oversight"
        subtitle="Inspect platform-wide bookings, pricing splits, cancellation windows, and tamper-evident chain of custody photos."
        badge={showDemoPreview ? "Demo Preview" : "Booking Control"}
        rightSlot={
          !showDemoPreview && bookings.length > 0 ? (
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-sand-200 bg-white hover:bg-sand-100 text-xs font-bold text-navy-900 transition"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          ) : undefined
        }
      />

      {effectiveAdminRole === "SUPPORT" && (
        <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-sand-100 border border-sand-200 text-navy-900 text-xs font-bold">
          Read-Only Support View (Platform Force-Cancel Restricted to Superadmin)
        </div>
      )}

      {bookingsQuery.isError && (
        <AdminQueryErrorAlert
          message={
            bookingsQuery.error instanceof Error
              ? bookingsQuery.error.message
              : "Unable to load global platform bookings."
          }
          onRetry={() => void bookingsQuery.refetch()}
        />
      )}

      {actionError && (
        <AdminQueryErrorAlert
          message={actionError}
          onRetry={() => {
            if (inspectedBookingId) void detailQuery.refetch();
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setAppliedSearch(searchInput.trim());
              setPage(1);
            }}
            className="flex flex-wrap gap-2"
          >
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-sand-700 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by booking reference (LS-...)..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-sand-200 text-xs text-navy-950"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold transition"
            >
              Search Bookings
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

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap gap-1.5">
              {PRIMARY_STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => updateStatusFilter(tab.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    statusFilter === tab.value
                      ? "bg-navy-900 text-white shadow-sm"
                      : "bg-sand-50 border border-sand-200 text-navy-900 hover:bg-sand-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="w-full lg:w-64">
              <Select
                aria-label="All booking statuses"
                value={statusFilter}
                onChange={(e) => updateStatusFilter(e.target.value as BookingFilterStatus)}
                className="!h-9 !min-h-[36px] text-xs font-semibold"
              >
                <option value="ALL">All Booking Statuses</option>
                {BOOKING_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Bookings Table */}
      <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
        {showDemoPreview ? (
          <div className="p-4 rounded-xl bg-sand-50 border border-sand-200 flex items-center justify-between text-xs">
            <div>
              <p className="font-bold text-navy-950">
                Sample Reference • Colombo Fort Storage Hub
              </p>
              <p className="text-sand-700 mt-0.5">
                {formatLkr(2400)} • 2 bags • Status: CONFIRMED (Demo Preview)
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
              CONFIRMED
            </span>
          </div>
        ) : bookingsQuery.isLoading ? (
          <AdminTableSkeleton rows={6} columns={6} />
        ) : bookings.length === 0 ? (
          <AdminEmptyStateCard
            title="No bookings match this filter"
            description="Adjust the status filter or booking reference query to inspect marketplace bookings."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-sand-200 text-sand-700">
                  <th className="pb-2.5 pr-4 font-bold">Reference</th>
                  <th className="pb-2.5 pr-4 font-bold">Hub & Host</th>
                  <th className="pb-2.5 pr-4 font-bold">Schedule</th>
                  <th className="pb-2.5 pr-4 font-bold">Total</th>
                  <th className="pb-2.5 pr-4 font-bold">Status</th>
                  <th className="pb-2.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {bookings.map((b) => {
                  const statusMeta = formatAdminBookingStatus(b.status, b.collectionAt);
                  return (
                    <tr key={b.id} className="hover:bg-sand-50/70 transition-colors">
                      <td className="py-3 pr-4">
                        <Link
                          to={`/admin/bookings/${b.id}${querySuffix}`}
                          className="font-mono font-bold text-terracotta-600 hover:underline"
                        >
                          {b.referenceCode}
                        </Link>
                        <p className="text-[11px] text-sand-700">
                          {b.totalBags} bag(s) • {b.bookingMode}
                        </p>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-navy-950">{b.location.name}</p>
                        <p className="text-[11px] text-sand-700">
                          {b.businessName ?? b.businessId.slice(0, 8)} •{" "}
                          {b.travellerDisplayName ??
                            b.travellerEmailMasked ??
                            b.travellerUserId.slice(0, 8)}
                        </p>
                      </td>
                      <td className="py-3 pr-4 text-[11px] text-navy-900 tabular-nums">
                        <div>Drop: {formatDateTimeDisplay(b.dropOffAt)}</div>
                        <div>Collect: {formatDateTimeDisplay(b.collectionAt)}</div>
                      </td>
                      <td className="py-3 pr-4 font-bold text-navy-950 tabular-nums">
                        {formatLkrMinor(b.totalAmountMinor, b.currency)}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeToneClasses(b.status)}`}
                        >
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openInspector(b.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white font-bold transition"
                          >
                            <Eye className="w-3.5 h-3.5" /> Inspect & Custody
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!showDemoPreview && bookings.length > 0 && (
          <AdminPaginationBar
            page={page}
            totalPages={Math.max(1, bookingsQuery.data?.pagination?.totalPages ?? Math.ceil(total / limit))}
            total={total}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Booking & Custody Slide-Over Drawer (list view ?inspect=<uuid>) */}
      <SlideOverDrawer
        open={Boolean(inspectedBookingId && !showDemoPreview)}
        onClose={closeInspector}
        ariaLabel="Booking and Custody Inspection Drawer"
        closeLabel="Close booking inspector"
        size="xl"
        title={
          detailQuery.data?.referenceCode ??
          (inspectedBookingId ? `Booking ${inspectedBookingId.slice(0, 8)}` : "Booking Inspector")
        }
        subtitle={
          detailQuery.data
            ? `${detailQuery.data.location.name} • ${detailQuery.data.businessName ?? ""}`
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
        footer={
          inspectedBookingId ? (
            <Link
              to={`/admin/bookings/${inspectedBookingId}${querySuffix}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold transition"
            >
              <PackageCheck className="h-3.5 w-3.5" />
              <span>Open Full Booking Page</span>
            </Link>
          ) : undefined
        }
      >
        <BookingDetailInspectorContent
          detail={detailQuery.data}
          detailLoading={detailQuery.isLoading}
          detailError={detailQuery.isError}
          detailErrorObj={detailQuery.error}
          onRetryDetail={() => void detailQuery.refetch()}
          custody={custodyQuery.data}
          custodyLoading={custodyQuery.isLoading}
          custodyError={custodyQuery.isError}
          custodyErrorObj={custodyQuery.error}
          onRetryCustody={() => void custodyQuery.refetch()}
          showCancelForm={showCancelForm}
          setShowCancelForm={setShowCancelForm}
          cancelReason={cancelReason}
          setCancelReason={setCancelReason}
          cancelPending={cancelMutation.isPending}
          onCancelSubmit={handleCancelSubmit}
          onPreviewPhoto={setLightboxImage}
        />
      </SlideOverDrawer>

      <AdminImageLightboxModal
        image={lightboxImage}
        onClose={() => setLightboxImage(null)}
      />
    </div>
  );
}

export const AdminGlobalBookingsLedgerPage = AdminBookingsLedgerPage;
