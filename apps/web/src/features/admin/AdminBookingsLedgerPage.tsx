import React, { useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import {
  BOOKING_STATUSES,
  SYSTEM_PERMISSIONS,
  type BookingStatus
} from "@luggage-storage/contracts";
import { Ban, Download, Eye, PackageCheck, Search, X } from "lucide-react";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { MascotIllustration } from "@/components/ui";
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
  AdminEmptyStateCard,
  AdminPageHeader,
  AdminPaginationBar,
  AdminQueryErrorAlert,
  formatAdminBookingStatus,
  formatAdminRefundStatus,
  isUuid,
  statusBadgeToneClasses
} from "./admin-helpers";
import { useAdminRole } from "./AdminDashboardLayout";

type BookingFilterStatus = BookingStatus | "ALL";

const CANCELLABLE_ADMIN_STATUSES = new Set<string>([
  "PENDING_HOST_APPROVAL",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "DISPUTED"
]);

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
  const inspectedBookingId =
    (isUuid(params.id) ? params.id : null) ??
    (isUuid(inspectQueryParam) ? inspectQueryParam : null) ??
    (isUuid(localInspectId) ? localInspectId : null);

  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const bookingsQuery = useAdminBookingsQuery(
    {
      page,
      limit,
      status: statusFilter === "ALL" ? undefined : statusFilter,
      search: appliedSearch || undefined
    },
    { enabled: isAuthenticated && !showDemoPreview }
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

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Global Platform Bookings & Custody Oversight"
        subtitle="Inspect platform-wide bookings, pricing splits, cancellation windows, and tamper-evident custody chain of custody photos."
        rightSlot={
          <div className="flex items-center gap-3">
            {!showDemoPreview && bookings.length > 0 && (
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            )}
            <MascotIllustration mascot="phone" size="sm" caption="Booking Control" />
          </div>
        }
      />

      {effectiveAdminRole === "SUPPORT" && (
        <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold">
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
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setAppliedSearch(searchInput.trim());
              setPage(1);
            }}
            className="flex flex-wrap gap-2"
          >
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by booking reference (LS-...)..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
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
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
              >
                Clear
              </button>
            )}
          </form>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                setStatusFilter("ALL");
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                statusFilter === "ALL"
                  ? "bg-purple-700 text-white"
                  : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              All Statuses
            </button>
            {BOOKING_STATUSES.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                  statusFilter === st
                    ? "bg-purple-700 text-white"
                    : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {st.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bookings Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        {showDemoPreview ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <p className="font-bold text-slate-900">
                Sample Reference • Colombo Fort Storage Hub
              </p>
              <p className="text-slate-600 mt-0.5">
                {formatLkr(2400)} • 2 bags • Status: CONFIRMED (Demo Preview)
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
              CONFIRMED
            </span>
          </div>
        ) : bookingsQuery.isLoading ? (
          <p className="text-xs text-slate-500 py-4 text-center">Loading platform bookings...</p>
        ) : bookings.length === 0 ? (
          <AdminEmptyStateCard
            title="No bookings match this filter"
            description="Adjust the status filter or booking reference query to inspect marketplace bookings."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-2.5 pr-4 font-bold">Reference</th>
                  <th className="pb-2.5 pr-4 font-bold">Hub & Host</th>
                  <th className="pb-2.5 pr-4 font-bold">Schedule</th>
                  <th className="pb-2.5 pr-4 font-bold">Total</th>
                  <th className="pb-2.5 pr-4 font-bold">Status</th>
                  <th className="pb-2.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((b) => {
                  const statusMeta = formatAdminBookingStatus(b.status, b.collectionAt);
                  return (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="py-3 pr-4">
                        <p className="font-mono font-bold text-slate-900">{b.referenceCode}</p>
                        <p className="text-[11px] text-slate-500">
                          {b.totalBags} bag(s) • {b.bookingMode}
                        </p>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-slate-800">{b.location.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {b.businessName ?? b.businessId.slice(0, 8)} •{" "}
                          {b.travellerDisplayName ?? b.travellerEmailMasked ?? b.travellerUserId.slice(0, 8)}
                        </p>
                      </td>
                      <td className="py-3 pr-4 text-[11px] text-slate-700">
                        <div>Drop: {formatDateTimeDisplay(b.dropOffAt)}</div>
                        <div>Collect: {formatDateTimeDisplay(b.collectionAt)}</div>
                      </td>
                      <td className="py-3 pr-4 font-bold text-slate-900">
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
                        <button
                          type="button"
                          onClick={() => openInspector(b.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold"
                        >
                          <Eye className="w-3.5 h-3.5" /> Inspect & Custody
                        </button>
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

      {/* Booking & Custody Inspection Drawer */}
      {inspectedBookingId && !showDemoPreview && (
        <section
          aria-label="Booking and Custody Inspection Drawer"
          className="bg-white rounded-2xl border-2 border-purple-300 p-6 shadow-lg space-y-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
                Booking & Custody Inspector
              </span>
              <h2 className="text-lg font-extrabold text-slate-950 mt-0.5 flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-purple-700" />
                {detailQuery.data?.referenceCode ?? `Booking ${inspectedBookingId.slice(0, 8)}`}
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
                  : "Unable to load booking detail."
              }
              onRetry={() => void detailQuery.refetch()}
            />
          ) : detailQuery.isLoading || !detailQuery.data ? (
            <p className="text-xs text-slate-500 py-4">Loading booking and custody detail...</p>
          ) : (
            <div className="space-y-5 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                    Booking Status
                  </span>
                  <p className="mt-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeToneClasses(detailQuery.data.status)}`}
                    >
                      {
                        formatAdminBookingStatus(
                          detailQuery.data.status,
                          detailQuery.data.collectionAt
                        ).label
                      }
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Mode: {detailQuery.data.bookingMode}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                    Traveller & Host Partner
                  </span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {detailQuery.data.travellerDisplayName ?? detailQuery.data.travellerUserId}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    {detailQuery.data.travellerEmailMasked ?? "Masked"} • Hub:{" "}
                    {detailQuery.data.location.name}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                    Schedule Window
                  </span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    Drop-off: {formatDateTimeDisplay(detailQuery.data.dropOffAt)}
                  </p>
                  <p className="text-slate-600">
                    Collection: {formatDateTimeDisplay(detailQuery.data.collectionAt)}
                  </p>
                </div>
              </div>

              {/* Line Items & Pricing Split */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <h3 className="font-extrabold uppercase tracking-wide text-slate-700">
                    Reserved Baggage Items
                  </h3>
                  <ul className="space-y-1">
                    {detailQuery.data.items.map((item) => (
                      <li key={item.id} className="flex justify-between text-slate-800">
                        <span>
                          {item.quantity}x {formatBagCategoryLabel(item.bagCategory)} (
                          {item.capacityUnits} units)
                        </span>
                        <span className="font-bold">
                          {formatLkrMinor(item.lineTotalMinor, detailQuery.data?.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 space-y-1.5">
                  <h3 className="font-extrabold uppercase tracking-wide text-slate-700">
                    Non-Escrow Settlement Breakdown
                  </h3>
                  <div className="flex justify-between">
                    <span>Gross Charged</span>
                    <strong>
                      {formatLkrMinor(
                        detailQuery.data.totalAmountMinor,
                        detailQuery.data.currency
                      )}
                    </strong>
                  </div>
                  {detailQuery.data.pricingSnapshot?.platformCommissionMinor !== undefined && (
                    <div className="flex justify-between text-purple-800">
                      <span>Platform Commission</span>
                      <strong>
                        {formatLkrMinor(
                          detailQuery.data.pricingSnapshot.platformCommissionMinor,
                          detailQuery.data.currency
                        )}
                      </strong>
                    </div>
                  )}
                  {detailQuery.data.pricingSnapshot?.hostPayableMinor !== undefined && (
                    <div className="flex justify-between text-emerald-800">
                      <span>Net Host Payable</span>
                      <strong>
                        {formatLkrMinor(
                          detailQuery.data.pricingSnapshot.hostPayableMinor,
                          detailQuery.data.currency
                        )}
                      </strong>
                    </div>
                  )}
                  {detailQuery.data.refundSummary && (
                    <div className="flex justify-between text-rose-800 pt-1 border-t border-slate-200">
                      <span>
                        Refund ({detailQuery.data.refundSummary.refundPercentage}% •{" "}
                        {formatAdminRefundStatus(detailQuery.data.refundSummary.status).label})
                      </span>
                      <strong>
                        {formatLkrMinor(
                          detailQuery.data.refundSummary.amountMinor,
                          detailQuery.data.currency
                        )}
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Chain of Custody Record */}
              <div className="p-4 rounded-xl border border-slate-200 space-y-3">
                <h3 className="font-extrabold uppercase tracking-wide text-slate-700">
                  Physical Chain of Custody & Bag Evidence
                </h3>
                {custodyQuery.isError ? (
                  <AdminQueryErrorAlert
                    message={
                      custodyQuery.error instanceof Error
                        ? custodyQuery.error.message
                        : "Unable to load custody record."
                    }
                    onRetry={() => void custodyQuery.refetch()}
                  />
                ) : custodyQuery.isLoading ? (
                  <p className="text-slate-500">Loading custody record...</p>
                ) : !custodyQuery.data ? (
                  <p className="text-slate-500 italic">
                    No custody record initiated for this booking yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeToneClasses(custodyQuery.data.status)}`}
                      >
                        {custodyQuery.data.status}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 font-semibold">
                        Handover: {custodyQuery.data.handoverCondition}
                      </span>
                      <span className="text-slate-700">
                        Expected {custodyQuery.data.expectedBagCount} • Checked-In{" "}
                        {custodyQuery.data.checkedInBagCount ?? 0} • Released{" "}
                        {custodyQuery.data.releasedBagCount ?? 0}
                      </span>
                      {custodyQuery.data.overdueMinutes > 0 && (
                        <span className="text-rose-700 font-bold">
                          Overdue: {custodyQuery.data.overdueMinutes} min (
                          {formatLkrMinor(
                            custodyQuery.data.overdueFeeMinor,
                            detailQuery.data.currency
                          )}
                          )
                        </span>
                      )}
                    </div>

                    {custodyQuery.data.bags.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {custodyQuery.data.bags.map((bag) => (
                          <div
                            key={bag.id}
                            className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono font-bold text-slate-900">
                                {bag.bagTagCode}
                              </span>
                              <span className="text-[11px] font-semibold text-slate-600">
                                {formatBagCategoryLabel(bag.bagCategory)}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600">
                              Seal: {bag.securitySealNumber || "None recorded"}
                            </p>
                            {bag.conditionNotes && (
                              <p className="text-[11px] text-slate-700">{bag.conditionNotes}</p>
                            )}
                            {bag.photoDownloadUrl && (
                              <a
                                href={bag.photoDownloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block text-[11px] font-bold text-purple-700 underline mt-1"
                              >
                                View Evidence Photo
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Admin Cancel Booking (STRICT SUPERADMIN ONLY) */}
              {CANCELLABLE_ADMIN_STATUSES.has(detailQuery.data.status) && (
                <PermissionGate
                  permission={SYSTEM_PERMISSIONS.ADMIN_BOOKING_MANAGE}
                  fallback={
                    <p className="text-slate-500 italic border-t border-slate-200 pt-3">
                      Platform-initiated cancellation requires Superadmin booking management
                      permission.
                    </p>
                  }
                >
                  <div className="border-t border-slate-200 pt-4 space-y-3">
                    {!showCancelForm ? (
                      <button
                        type="button"
                        onClick={() => setShowCancelForm(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
                      >
                        <Ban className="w-3.5 h-3.5" /> Admin Cancel Booking
                      </button>
                    ) : (
                      <form
                        onSubmit={handleCancelSubmit}
                        className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-3"
                      >
                        <p className="font-bold text-rose-950">
                          Confirm Platform Cancellation (releases capacity hold & triggers refund
                          workflow if paid)
                        </p>
                        <textarea
                          rows={2}
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          placeholder="Reason for platform cancellation (min 3 chars)..."
                          className="w-full px-3 py-2 rounded-xl border border-rose-300 bg-white text-xs"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="submit"
                            disabled={cancelMutation.isPending}
                            className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold disabled:opacity-50"
                          >
                            {cancelMutation.isPending
                              ? "Cancelling..."
                              : "Execute Platform Cancellation"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowCancelForm(false)}
                            className="px-4 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-700"
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
          )}
        </section>
      )}
    </div>
  );
}

export const AdminGlobalBookingsLedgerPage = AdminBookingsLedgerPage;
