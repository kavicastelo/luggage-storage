import React, { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  SYSTEM_PERMISSIONS,
  type DisputeResolutionOutcome
} from "@luggage-storage/contracts";
import { AlertOctagon, CheckCircle2, Eye, Gavel, PackageCheck } from "lucide-react";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { isDemoPreviewActive } from "@/config/demo-preview";
import {
  useAdminBookingDetailQuery,
  useAdminBookingsQuery,
  useAdminCustodyDetailQuery,
  useAdminResolveDisputeMutation
} from "@/hooks/queries/use-admin-portal";
import { formatBagCategoryLabel, formatDateTimeDisplay, formatLkrMinor } from "@/lib/formatters";
import { useAuthStore } from "@/store/useAuthStore";
import {
  AdminEmptyStateCard,
  AdminPageHeader,
  AdminPaginationBar,
  AdminQueryErrorAlert,
  isUuid,
  statusBadgeToneClasses
} from "./admin-helpers";

export function AdminIncidentDisputeInvestigationPage() {
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

  const [page, setPage] = useState(1);
  const limit = 20;

  const inspectParam = searchParams.get("inspect");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    isUuid(inspectParam) ? inspectParam : null
  );
  const activeBookingId = selectedBookingId ?? (isUuid(inspectParam) ? inspectParam : null);

  const [outcome, setOutcome] = useState<DisputeResolutionOutcome>("UPHOLD_HOST");
  const [refundPercentage, setRefundPercentage] = useState("100");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const disputedQuery = useAdminBookingsQuery(
    { page, limit, status: "DISPUTED" },
    { enabled: isAuthenticated && !showDemoPreview }
  );
  const bookingDetailQuery = useAdminBookingDetailQuery(activeBookingId ?? undefined, {
    enabled: isAuthenticated && !showDemoPreview && Boolean(activeBookingId)
  });
  const custodyQuery = useAdminCustodyDetailQuery(activeBookingId ?? undefined, {
    enabled: isAuthenticated && !showDemoPreview && Boolean(activeBookingId)
  });
  const resolveMutation = useAdminResolveDisputeMutation();

  const disputedBookings = disputedQuery.data?.bookings ?? [];
  const total = disputedQuery.data?.total ?? 0;
  const inspectedBooking = bookingDetailQuery.data ?? null;
  const inspectedCustody = custodyQuery.data ?? null;

  const selectDisputedBooking = (bookingId: string) => {
    setActionError(null);
    setActionSuccess(null);
    setResolutionNotes("");
    setSelectedBookingId(bookingId);
    const next = new URLSearchParams(searchParams);
    next.set("inspect", bookingId);
    setSearchParams(next);
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBookingId) return;
    setActionError(null);
    setActionSuccess(null);

    if (resolutionNotes.trim().length < 5) {
      setActionError("Resolution notes must be at least 5 characters.");
      return;
    }

    const parsedPct = Number(refundPercentage);
    if (
      outcome === "REFUND_TRAVELLER" &&
      (!Number.isInteger(parsedPct) || parsedPct < 1 || parsedPct > 100)
    ) {
      setActionError("Refund percentage must be a whole number between 1 and 100.");
      return;
    }

    try {
      const updated = await resolveMutation.mutateAsync({
        bookingId: activeBookingId,
        data: {
          outcome,
          ...(outcome === "REFUND_TRAVELLER" ? { refundPercentage: parsedPct } : {}),
          notes: resolutionNotes.trim()
        }
      });
      setActionSuccess(
        `Dispute adjudicated for ${updated.referenceCode}: booking is now ${updated.status}.`
      );
      setResolutionNotes("");
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to adjudicate dispute.");
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Custody Incidents & Booking Disputes"
        subtitle="Investigate flagged DISPUTED bookings, missing seal exceptions, and execute authoritative Superadmin dispute adjudication."
        badge={showDemoPreview ? "Demo Preview" : "Live Dispute Resolution"}
        rightSlot={
          !showDemoPreview ? (
            <Link
              to="/admin/bookings?status=DISPUTED"
              className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 hover:bg-slate-50"
            >
              Open Full Bookings Ledger
            </Link>
          ) : undefined
        }
      />

      {showDemoPreview ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-xs">
          <p className="font-bold text-slate-900">Sample Custody Exception Dossier (Demo Preview)</p>
          <p className="text-slate-600 mt-0.5">
            Inspect tamper-evident photo seals and overstay ledger adjustments.
          </p>
        </div>
      ) : (
        <>
          {disputedQuery.isError && (
            <AdminQueryErrorAlert
              message={
                disputedQuery.error instanceof Error
                  ? disputedQuery.error.message
                  : "Unable to load disputed bookings queue."
              }
              onRetry={() => void disputedQuery.refetch()}
            />
          )}

          {actionError && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-900"
            >
              {actionError}
            </div>
          )}

          {actionSuccess && (
            <div
              role="status"
              className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-950 flex items-center gap-2"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {disputedBookings.length === 0 && !inspectedBooking ? (
            <AdminEmptyStateCard
              title="No Active Custody Disputes Pending"
              description="All bookings are operating cleanly without unresolved custody exceptions or holds."
              actionTo="/admin/bookings"
              actionLabel="Browse Global Bookings"
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
              {/* Queue Table */}
              <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-950 flex items-center gap-2">
                    <AlertOctagon className="h-4 w-4 text-rose-600" />
                    <span>Flagged Disputed Bookings ({total})</span>
                  </h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {disputedBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className={`p-4 flex items-center justify-between gap-3 ${
                        activeBookingId === booking.id ? "bg-purple-50/70" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">
                            {booking.referenceCode}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeToneClasses(
                              booking.status
                            )}`}
                          >
                            {booking.status}
                          </span>
                        </div>
                        <p className="text-slate-700 font-semibold truncate">
                          {booking.location.name} • {booking.businessName}
                        </p>
                        <p className="text-rose-800 truncate">
                          {booking.exceptionReason || "Exception flag awaiting review"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => selectDisputedBooking(booking.id)}
                        className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Investigate</span>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="p-4">
                  <AdminPaginationBar
                    page={page}
                    totalPages={Math.max(1, Math.ceil(total / limit))}
                    total={total}
                    onPageChange={setPage}
                  />
                </div>
              </div>

              {/* Dossier & Adjudication Panel */}
              <div className="lg:col-span-6 space-y-5">
                {!inspectedBooking ? (
                  <AdminEmptyStateCard
                    title="Select a Disputed Booking to Investigate"
                    description="Choose any flagged booking on the left to inspect chain-of-custody seals, evidence photos, and issue a binding adjudication."
                  />
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold font-mono text-slate-950">
                            {inspectedBooking.referenceCode}
                          </h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeToneClasses(
                              inspectedBooking.status
                            )}`}
                          >
                            {inspectedBooking.status}
                          </span>
                        </div>
                        <p className="text-slate-600 mt-0.5">
                          {inspectedBooking.location.name} •{" "}
                          {formatLkrMinor(
                            inspectedBooking.totalAmountMinor,
                            inspectedBooking.currency
                          )}
                        </p>
                      </div>
                      <Link
                        to={`/admin/bookings/${inspectedBooking.id}`}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-800 hover:bg-slate-50"
                      >
                        Full Booking View
                      </Link>
                    </div>

                    {inspectedBooking.exceptionReason && (
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950">
                        <span className="font-bold">Recorded Exception Reason: </span>
                        {inspectedBooking.exceptionReason}
                      </div>
                    )}

                    {/* Custody Evidence Dossier */}
                    <div className="space-y-3">
                      <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                        <PackageCheck className="h-4 w-4 text-purple-700" />
                        <span>Chain-of-Custody Evidence &amp; Bag Seals</span>
                      </h4>
                      {inspectedCustody ? (
                        <div className="space-y-2.5">
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap gap-3 justify-between">
                            <span>
                              Custody Status: <strong>{inspectedCustody.status}</strong>
                            </span>
                            <span>
                              Condition: <strong>{inspectedCustody.handoverCondition}</strong>
                            </span>
                            <span>
                              Overdue: <strong>{inspectedCustody.overdueMinutes} min</strong>
                            </span>
                          </div>
                          {inspectedCustody.bags.map((bag) => (
                            <div
                              key={bag.id}
                              className="p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2"
                            >
                              <div>
                                <p className="font-mono font-bold text-slate-900">
                                  Tag {bag.bagTagCode}
                                  {bag.securitySealNumber
                                    ? ` • Seal ${bag.securitySealNumber}`
                                    : ""}
                                </p>
                                <p className="text-slate-600">
                                  {formatBagCategoryLabel(bag.bagCategory)}
                                  {bag.conditionNotes ? ` • ${bag.conditionNotes}` : ""}
                                </p>
                              </div>
                              {bag.photoDownloadUrl && (
                                <a
                                  href={bag.photoDownloadUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 font-bold"
                                >
                                  View Evidence Photo
                                </a>
                              )}
                            </div>
                          ))}
                          {inspectedCustody.events.length > 0 && (
                            <p className="text-[11px] text-slate-500">
                              Latest custody event: {inspectedCustody.events[0].eventType} (
                              {formatDateTimeDisplay(inspectedCustody.events[0].createdAt)})
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-slate-500">
                          No counter check-in custody record created for this reservation yet.
                        </p>
                      )}
                    </div>

                    {/* Adjudication Controls — SUPERADMIN Only */}
                    {inspectedBooking.status === "DISPUTED" && (
                      <PermissionGate
                        permission={SYSTEM_PERMISSIONS.ADMIN_BOOKING_MANAGE}
                        fallback={
                          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 font-semibold">
                            Read-Only Support View: Only a Superadmin can adjudicate disputed
                            bookings or release held host settlements and customer refunds.
                          </div>
                        }
                      >
                        <form
                          onSubmit={(e) => void handleResolveSubmit(e)}
                          className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3"
                        >
                          <div className="flex items-center gap-2 font-bold text-slate-950">
                            <Gavel className="h-4 w-4 text-purple-700" />
                            <span>Adjudicate Booking Dispute</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">
                                Binding Outcome
                              </label>
                              <select
                                value={outcome}
                                onChange={(e) =>
                                  setOutcome(e.target.value as DisputeResolutionOutcome)
                                }
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold"
                              >
                                <option value="UPHOLD_HOST">
                                  Uphold Host &amp; Release Settlement
                                </option>
                                <option value="REFUND_TRAVELLER">
                                  Uphold Traveller &amp; Issue Refund
                                </option>
                              </select>
                            </div>
                            {outcome === "REFUND_TRAVELLER" && (
                              <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                  Refund Percentage (1–100%)
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={100}
                                  value={refundPercentage}
                                  onChange={(e) => setRefundPercentage(e.target.value)}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono"
                                />
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="block font-bold text-slate-700 mb-1">
                              Adjudication Rationale
                            </label>
                            <textarea
                              rows={3}
                              required
                              value={resolutionNotes}
                              onChange={(e) => setResolutionNotes(e.target.value)}
                              placeholder="Document seal evidence review and binding settlement outcome..."
                              className="w-full rounded-xl border border-slate-300 bg-white p-2.5"
                            />
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="submit"
                              disabled={resolveMutation.isPending}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold"
                            >
                              <Gavel className="h-3.5 w-3.5" />
                              <span>
                                {resolveMutation.isPending
                                  ? "Posting Resolution..."
                                  : "Execute Dispute Ruling"}
                              </span>
                            </button>
                          </div>
                        </form>
                      </PermissionGate>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
