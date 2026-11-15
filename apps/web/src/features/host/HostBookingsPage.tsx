import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  BOOKING_STATUSES,
  type BookingDetail,
  type BookingStatus,
  type RecordBookingExceptionRequest
} from "@luggage-storage/contracts";
import { AlertTriangle, CheckCircle2, ExternalLink, Search, ShieldCheck, X } from "lucide-react";
import { isDemoPreviewActive } from "@/config/demo-preview";
import { DEMO_BOOKINGS, DemoBookingRecord, formatLkr } from "@/data/mock-marketplace";
import {
  useAcceptHostBookingMutation,
  useCancelHostBookingMutation,
  useHostBookingDetailQuery,
  useHostBookingsQuery,
  useHostCustodyDetailQuery,
  useRejectHostBookingMutation,
  useReportHostBookingExceptionMutation
} from "@/hooks/queries/use-host-portal";
import { getBookingStatusDisplay } from "@/lib/booking-status";
import {
  formatBagCategoryLabel,
  formatDateTimeDisplay,
  formatLkrMinor,
  formatRefundStatusDisplay
} from "@/lib/formatters";
import { useAuthStore } from "@/store/useAuthStore";
import { useHostVenue } from "./HostDashboardLayout";
import { HostQueryErrorAlert, isUuid } from "./host-helpers";

const EXCEPTION_CATEGORIES: Array<{
  value: RecordBookingExceptionRequest["category"];
  label: string;
}> = [
  { value: "OVERDUE_DISPUTE", label: "Overdue / Collection Dispute" },
  { value: "DAMAGE_REPORTED", label: "Damaged Bag or Seal Reported" },
  { value: "MISSING_ITEM", label: "Missing Item / Bag Discrepancy" },
  { value: "SAFETY_CONCERN", label: "Prohibited / Safety Concern" },
  { value: "HOST_NO_SHOW", label: "Counter Availability Incident" },
  { value: "OTHER", label: "Other Operational Exception" }
];

const LIVE_STATUS_PILLS: Array<{ value: "ALL" | BookingStatus; label: string }> = [
  { value: "ALL", label: "All Bookings" },
  { value: "PENDING_HOST_APPROVAL", label: "Pending Approval" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "IN_STORAGE", label: "In Storage" },
  { value: "COMPLETED", label: "Completed" },
  { value: "DISPUTED", label: "Disputed" },
  { value: "PENDING_PAYMENT", label: "Pending Payment" },
  { value: "CANCELLED_BY_TRAVELLER", label: "Cancelled (Guest)" },
  { value: "CANCELLED_BY_HOST", label: "Cancelled (Host)" },
  { value: "CANCELLED_BY_PLATFORM", label: "Cancelled (Platform)" },
  { value: "REJECTED", label: "Declined" },
  { value: "EXPIRED", label: "Expired" }
];

const DEMO_STATUS_PILLS = [
  "ALL",
  "PENDING_HOST_APPROVAL",
  "CHECKED_IN",
  "CONFIRMED",
  "OVERDUE",
  "COMPLETED"
] as const;

type PendingModalAction =
  | { kind: "ACCEPT"; booking: BookingDetail }
  | { kind: "REJECT"; booking: BookingDetail }
  | { kind: "CANCEL"; booking: BookingDetail }
  | { kind: "EXCEPTION"; booking: BookingDetail }
  | null;

function statusBadgeToneClass(tone: "brand" | "success" | "warning" | "danger" | "neutral"): string {
  switch (tone) {
    case "success":
      return "bg-blue-50 text-blue-800 border border-blue-200";
    case "danger":
      return "bg-rose-50 text-rose-800 border border-rose-200";
    case "warning":
    case "brand":
      return "bg-amber-50 text-amber-800 border border-amber-200";
    default:
      return "bg-sand-100 text-navy-700 border border-sand-300";
  }
}

export function HostBookingManagementHubPage() {
  const { id: routeBookingId } = useParams<{ id?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isDemoActive, effectiveHostRole, selectedLocationId } = useHostVenue();
  const { isAuthenticated, user } = useAuthStore();

  const showDemoBookings =
    !isAuthenticated &&
    (isDemoActive ||
      isDemoPreviewActive({
        allowDemoPreview: true,
        search: location.search,
        isAuthenticated
      }));

  const inspectedId = routeBookingId || searchParams.get("inspect") || null;
  const liveInspectedUuid =
    isAuthenticated && !showDemoBookings && isUuid(inspectedId) ? inspectedId : undefined;
  const liveLocationId =
    isAuthenticated && !showDemoBookings && isUuid(selectedLocationId)
      ? selectedLocationId
      : undefined;

  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [hubNotice, setHubNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Live structured action modal state
  const [pendingAction, setPendingAction] = useState<PendingModalAction>(null);
  const [actionReason, setActionReason] = useState("");
  const [exceptionCategory, setExceptionCategory] =
    useState<RecordBookingExceptionRequest["category"]>("OVERDUE_DISPUTE");

  // Demo state (quarantined to showDemoBookings)
  const [demoBookings, setDemoBookings] = useState<DemoBookingRecord[]>(DEMO_BOOKINGS);
  const [demoInspectedFallback, setDemoInspectedFallback] = useState<DemoBookingRecord | null>(
    null
  );

  const liveQueryParams = useMemo(() => {
    const validStatus = BOOKING_STATUSES.includes(statusFilter as BookingStatus)
      ? (statusFilter as BookingStatus)
      : undefined;
    const trimmedSearch = searchInput.trim();
    return {
      ...(liveLocationId ? { locationId: liveLocationId } : {}),
      ...(validStatus ? { status: validStatus } : {}),
      ...(trimmedSearch ? { search: trimmedSearch } : {}),
      limit: 50
    };
  }, [liveLocationId, statusFilter, searchInput]);

  const bookingsQuery = useHostBookingsQuery(liveQueryParams, {
    enabled: isAuthenticated && !showDemoBookings
  });

  const liveBookingDetailQuery = useHostBookingDetailQuery(liveInspectedUuid, {
    enabled: Boolean(liveInspectedUuid)
  });
  const liveCustodyDetailQuery = useHostCustodyDetailQuery(liveInspectedUuid, {
    enabled: Boolean(liveInspectedUuid)
  });

  const acceptMutation = useAcceptHostBookingMutation();
  const rejectMutation = useRejectHostBookingMutation();
  const cancelMutation = useCancelHostBookingMutation();
  const exceptionMutation = useReportHostBookingExceptionMutation();

  const liveBookings = bookingsQuery.data?.bookings ?? [];

  const inspectedLiveBooking: BookingDetail | null = useMemo(() => {
    if (!liveInspectedUuid) return null;
    return (
      liveBookingDetailQuery.data ??
      liveBookings.find((b) => b.id === liveInspectedUuid) ??
      null
    );
  }, [liveInspectedUuid, liveBookingDetailQuery.data, liveBookings]);

  const inspectedDemoBooking: DemoBookingRecord | null = useMemo(() => {
    if (!showDemoBookings) return null;
    if (inspectedId) {
      return demoBookings.find((b) => b.id === inspectedId) || demoBookings[0] || null;
    }
    return demoInspectedFallback;
  }, [showDemoBookings, inspectedId, demoBookings, demoInspectedFallback]);

  const filteredDemoBookings = useMemo(() => {
    if (!showDemoBookings) return [];
    const needle = searchInput.trim().toLowerCase();
    return demoBookings.filter((b) => {
      const matchesSearch =
        !needle ||
        b.reference.toLowerCase().includes(needle) ||
        b.travellerName.toLowerCase().includes(needle);
      const matchesStatus = statusFilter === "ALL" || b.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [showDemoBookings, demoBookings, searchInput, statusFilter]);

  const openDemoInspect = (booking: DemoBookingRecord) => {
    setDemoInspectedFallback(booking);
    setSearchParams({ inspect: booking.id, preview: "demo" });
  };

  const openLiveInspect = (booking: BookingDetail) => {
    setActionError(null);
    navigate(`/host/bookings/${booking.id}`);
  };

  const closeInvestigationModal = () => {
    if (showDemoBookings) {
      setDemoInspectedFallback(null);
      setSearchParams({ preview: "demo" });
      return;
    }
    if (routeBookingId) {
      navigate("/host/bookings");
    } else {
      setSearchParams({});
    }
  };

  const handleDemoDecision = (bookingId: string, decision: "ACCEPT" | "REJECT") => {
    setHubNotice(null);
    setDemoBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              status: decision === "ACCEPT" ? "CONFIRMED" : "CANCELLED_REFUNDED",
              rawStatus: decision === "ACCEPT" ? "CONFIRMED" : "CANCELLED_BY_HOST"
            }
          : b
      )
    );
    setHubNotice(`Updated booking ${bookingId} (${decision}) in local preview session.`);
  };

  const openLiveActionModal = (
    kind: NonNullable<PendingModalAction>["kind"],
    booking: BookingDetail
  ) => {
    setActionError(null);
    setPendingAction({ kind, booking });
    setExceptionCategory("OVERDUE_DISPUTE");
    if (kind === "ACCEPT") {
      setActionReason("Approved at host counter desk");
    } else {
      setActionReason("");
    }
  };

  const handleConfirmLiveAction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pendingAction) return;
    setActionError(null);
    setHubNotice(null);

    const trimmedReason = actionReason.trim();
    const { kind, booking } = pendingAction;

    try {
      if (kind === "ACCEPT") {
        if (trimmedReason && trimmedReason.length < 3) {
          setActionError("Approval note must be at least 3 characters if provided.");
          return;
        }
        const updated = await acceptMutation.mutateAsync({
          bookingId: booking.id,
          data: trimmedReason ? { reason: trimmedReason } : {}
        });
        setHubNotice(`Booking ${updated.referenceCode} accepted and confirmed.`);
      } else if (kind === "REJECT") {
        if (trimmedReason.length < 3) {
          setActionError("Please enter a decline reason (at least 3 characters).");
          return;
        }
        const updated = await rejectMutation.mutateAsync({
          bookingId: booking.id,
          data: { reason: trimmedReason }
        });
        setHubNotice(
          `Booking ${updated.referenceCode} declined and automatic 100% traveller refund initiated.`
        );
      } else if (kind === "CANCEL") {
        if (trimmedReason.length < 3) {
          setActionError("Please enter a cancellation reason (at least 3 characters).");
          return;
        }
        const updated = await cancelMutation.mutateAsync({
          bookingId: booking.id,
          data: { reason: trimmedReason }
        });
        setHubNotice(
          `Booking ${updated.referenceCode} cancelled by host (100% traveller refund recorded).`
        );
      } else if (kind === "EXCEPTION") {
        if (trimmedReason.length < 5) {
          setActionError("Exception details must be at least 5 characters.");
          return;
        }
        const updated = await exceptionMutation.mutateAsync({
          bookingId: booking.id,
          data: { category: exceptionCategory, reason: trimmedReason }
        });
        setHubNotice(
          `Exception recorded on ${updated.referenceCode}. Settlement payable has been placed on hold for review.`
        );
      }
      setPendingAction(null);
      setActionReason("");
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Booking update failed.");
    }
  };

  const isMutationBusy =
    acceptMutation.isPending ||
    rejectMutation.isPending ||
    cancelMutation.isPending ||
    exceptionMutation.isPending;

  const statusPills = showDemoBookings
    ? DEMO_STATUS_PILLS.map((st) => ({
        value: st,
        label:
          st === "ALL"
            ? "All Bookings"
            : st === "PENDING_HOST_APPROVAL"
              ? "Pending Approval"
              : st.replace("_", " ")
      }))
    : LIVE_STATUS_PILLS;

  return (
    <div className="space-y-6">
      {bookingsQuery.isError && (
        <HostQueryErrorAlert
          message={
            bookingsQuery.error instanceof Error
              ? bookingsQuery.error.message
              : "Unable to load host bookings."
          }
          onRetry={() => void bookingsQuery.refetch()}
        />
      )}

      {hubNotice && (
        <div
          role="status"
          className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-950"
        >
          {hubNotice}
        </div>
      )}

      {/* Header & Filter Bar */}
      <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              Booking Management Hub
            </h1>
            <p className="text-xs text-navy-600 mt-0.5">
              Review host approval requests, active check-ins, overdue storage windows, and full
              custody audit trails.
            </p>
          </div>
          <button
            type="button"
            disabled={showDemoBookings ? demoBookings.length === 0 : liveBookings.length === 0}
            onClick={() => {
              if (showDemoBookings && demoBookings[0]) {
                openDemoInspect(demoBookings[0]);
              } else if (!showDemoBookings && liveBookings[0]) {
                openLiveInspect(liveBookings[0]);
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-sm transition"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Inspect Custody Evidence</span>
          </button>
        </div>

        {/* Search & Status Filter Pills */}
        <div className="mt-5 space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-navy-400" />
            <input
              type="text"
              aria-label="Search bookings"
              placeholder={
                showDemoBookings
                  ? "Search by reference (e.g. LS-2026-8841) or traveller name..."
                  : "Search by booking reference (e.g. LSB-...) or traveller..."
              }
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-xl border border-sand-300 pl-10 pr-4 py-2.5 text-xs text-navy-900 placeholder:text-navy-400 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {statusPills.map((pill) => (
              <button
                key={pill.value}
                type="button"
                onClick={() => setStatusFilter(pill.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  statusFilter === pill.value
                    ? "bg-navy-900 text-white"
                    : "bg-sand-100 text-navy-700 hover:bg-sand-200"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-2xl border border-sand-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-sand-50 border-b border-sand-200 text-navy-500 uppercase font-bold text-[10px] tracking-wider">
                <th className="p-3.5">Reference</th>
                <th className="p-3.5">Traveller &amp; Window</th>
                <th className="p-3.5">Bags &amp; Hub</th>
                <th className="p-3.5">Custody Status</th>
                {effectiveHostRole !== "HOST_STAFF" && (
                  <th className="p-3.5">
                    {showDemoBookings ? "Host Net (85%)" : "Host Net"}
                  </th>
                )}
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {showDemoBookings ? (
                filteredDemoBookings.length === 0 ? (
                  <tr>
                    <td
                      colSpan={effectiveHostRole === "HOST_STAFF" ? 5 : 6}
                      className="p-6 text-center text-navy-500"
                    >
                      No bookings match the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredDemoBookings.map((b) => {
                    const statusDisplay = getBookingStatusDisplay(b.rawStatus ?? b.status, {
                      hasRefund: b.hasRefund
                    });
                    return (
                      <tr key={b.id} className="hover:bg-sand-50/70 transition">
                        <td className="p-3.5 font-mono font-bold text-navy-900">{b.reference}</td>
                        <td className="p-3.5">
                          <p className="font-semibold text-navy-950">{b.travellerName}</p>
                          <p className="text-[10px] text-navy-500">{b.travellerPhone}</p>
                        </td>
                        <td className="p-3.5 text-navy-700">
                          <span className="font-semibold">{b.totalBags} Bags</span> •{" "}
                          <span className="font-mono text-[11px] px-1 py-0.5 rounded bg-sand-100">
                            {b.zoneCode}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${statusBadgeToneClass(
                              statusDisplay.tone
                            )}`}
                          >
                            {statusDisplay.label}
                          </span>
                        </td>
                        {effectiveHostRole !== "HOST_STAFF" && (
                          <td className="p-3.5 font-bold text-emerald-700">
                            {formatLkr(b.hostNetPayoutLkr)}
                          </td>
                        )}
                        <td className="p-3.5 text-right">
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            {b.status === "PENDING_HOST_APPROVAL" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleDemoDecision(b.id, "ACCEPT")}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition"
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDemoDecision(b.id, "REJECT")}
                                  className="px-2.5 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 font-bold text-xs transition"
                                >
                                  Decline
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => openDemoInspect(b)}
                              className="px-3 py-1.5 rounded-lg bg-navy-100 hover:bg-navy-200 text-navy-900 font-bold text-xs transition"
                            >
                              Investigate Custody
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )
              ) : liveBookings.length === 0 ? (
                <tr>
                  <td
                    colSpan={effectiveHostRole === "HOST_STAFF" ? 5 : 6}
                    className="p-6 text-center text-navy-500"
                  >
                    {bookingsQuery.isLoading
                      ? "Loading live host bookings..."
                      : "No host bookings match the selected criteria."}
                  </td>
                </tr>
              ) : (
                liveBookings.map((b) => {
                  const statusDisplay = getBookingStatusDisplay(b.status, {
                    collectionAt: b.collectionAt,
                    hasRefund: Boolean(b.refundSummary)
                  });
                  const hostNetMinor = b.pricingSnapshot?.hostPayableMinor ?? null;

                  return (
                    <tr key={b.id} className="hover:bg-sand-50/70 transition">
                      <td className="p-3.5 font-mono font-bold text-navy-900">{b.referenceCode}</td>
                      <td className="p-3.5">
                        <p className="font-semibold text-navy-950">
                          {b.travellerDisplayName || `Guest (${b.travellerUserId.slice(0, 8)})`}
                        </p>
                        <p className="text-[10px] text-navy-500">
                          {formatDateTimeDisplay(b.dropOffAt)} →{" "}
                          {formatDateTimeDisplay(b.collectionAt)}
                        </p>
                      </td>
                      <td className="p-3.5 text-navy-700">
                        <span className="font-semibold">{b.totalBags} Bags</span>
                        <span className="text-[10px] text-navy-500 block">
                          {b.location.name} ({b.location.city})
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${statusBadgeToneClass(
                            statusDisplay.tone
                          )}`}
                        >
                          {statusDisplay.label}
                        </span>
                      </td>
                      {effectiveHostRole !== "HOST_STAFF" && (
                        <td className="p-3.5 font-bold text-emerald-700">
                          {hostNetMinor !== null ? formatLkrMinor(hostNetMinor, b.currency) : "—"}
                        </td>
                      )}
                      <td className="p-3.5 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          {b.status === "PENDING_HOST_APPROVAL" && (
                            <>
                              <button
                                type="button"
                                onClick={() => openLiveActionModal("ACCEPT", b)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition"
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => openLiveActionModal("REJECT", b)}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 font-bold text-xs transition"
                              >
                                Decline
                              </button>
                            </>
                          )}
                          {b.status === "CONFIRMED" && (
                            <>
                              <Link
                                to={`/host/operations?ref=${encodeURIComponent(b.referenceCode)}&mode=checkin`}
                                className="px-2.5 py-1.5 rounded-lg bg-terracotta-500 hover:bg-terracotta-600 text-white font-bold text-xs transition"
                              >
                                Check-In Desk
                              </Link>
                              <button
                                type="button"
                                onClick={() => openLiveActionModal("CANCEL", b)}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs transition"
                              >
                                Host Cancel
                              </button>
                            </>
                          )}
                          {b.status === "IN_STORAGE" && (
                            <Link
                              to={`/host/operations?ref=${encodeURIComponent(b.referenceCode)}&mode=checkout`}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition"
                            >
                              Check-Out Desk
                            </Link>
                          )}
                          {(b.status === "CONFIRMED" || b.status === "IN_STORAGE") && (
                            <button
                              type="button"
                              onClick={() => openLiveActionModal("EXCEPTION", b)}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-xs transition"
                            >
                              Report Exception
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openLiveInspect(b)}
                            className="px-3 py-1.5 rounded-lg bg-navy-100 hover:bg-navy-200 text-navy-900 font-bold text-xs transition"
                          >
                            Investigate Custody
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Action Modal */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={(e) => void handleConfirmLiveAction(e)}
            className="bg-white rounded-2xl border border-sand-200 max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-sand-100 pb-3">
              <h3 className="text-base font-bold text-navy-950">
                {pendingAction.kind === "ACCEPT"
                  ? "Approve Booking Request"
                  : pendingAction.kind === "REJECT"
                    ? "Decline Booking Request"
                    : pendingAction.kind === "CANCEL"
                      ? "Cancel Confirmed Booking"
                      : "Report Custody / Booking Exception"}
              </h3>
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="p-1.5 rounded-lg hover:bg-sand-100 text-navy-500"
                aria-label="Close action modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-navy-700">
              Booking{" "}
              <span className="font-mono font-bold text-navy-950">
                {pendingAction.booking.referenceCode}
              </span>
            </p>

            {(pendingAction.kind === "CANCEL" || pendingAction.kind === "REJECT") && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 font-medium">
                {pendingAction.kind === "CANCEL"
                  ? "Host-initiated cancellation automatically records a 100% refund for the traveller."
                  : "Declining this request automatically records a 100% refund for any authorized payment."}
              </div>
            )}

            {pendingAction.kind === "EXCEPTION" && (
              <>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 font-medium">
                  Recording an operational exception transitions the booking to{" "}
                  <strong>Custody Exception / Disputed</strong> and places settlement payouts on
                  hold pending platform review.
                </div>
                <div className="space-y-1 text-xs">
                  <label className="block font-bold text-navy-900">Exception Category</label>
                  <select
                    value={exceptionCategory}
                    onChange={(e) =>
                      setExceptionCategory(
                        e.target.value as RecordBookingExceptionRequest["category"]
                      )
                    }
                    className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs font-semibold text-navy-900"
                  >
                    {EXCEPTION_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="space-y-1 text-xs">
              <label className="block font-bold text-navy-900">
                {pendingAction.kind === "ACCEPT"
                  ? "Approval Note (Optional)"
                  : pendingAction.kind === "EXCEPTION"
                    ? "Detailed Exception Notes (min 5 characters)"
                    : "Reason (min 3 characters)"}
              </label>
              <textarea
                rows={3}
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder={
                  pendingAction.kind === "ACCEPT"
                    ? "Optional counter note..."
                    : "Enter specific operational reason..."
                }
                className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs text-navy-900"
              />
            </div>

            {actionError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-900"
              >
                {actionError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="px-4 py-2 rounded-xl border border-sand-300 text-xs font-bold text-navy-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isMutationBusy}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold ${
                  pendingAction.kind === "ACCEPT"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : pendingAction.kind === "EXCEPTION"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {isMutationBusy ? "Submitting..." : "Confirm"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* HD-008: Demo Custody Investigation Dossier */}
      {showDemoBookings && inspectedDemoBooking && (
        <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-sand-200 max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-sand-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-navy-900 text-white font-mono text-xs font-bold">
                  Custody Audit
                </span>
                <h3 className="text-base font-bold text-navy-950">
                  Custody Evidence — {inspectedDemoBooking.reference}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeInvestigationModal}
                className="p-1.5 rounded-lg hover:bg-sand-100 text-navy-500"
                aria-label="Close investigation modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="font-bold text-navy-900 uppercase text-[10px] tracking-wider">
                Custody Lifecycle Events
              </p>
              <div className="p-3.5 rounded-xl bg-sand-50 border border-sand-200 space-y-2 text-navy-800">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-navy-950">1. Reservation Confirmed</strong>
                    <p className="text-[11px] text-navy-500">
                      Gross {formatLkr(inspectedDemoBooking.totalAmountLkr)}
                      {effectiveHostRole !== "HOST_STAFF" &&
                      inspectedDemoBooking.hasFinancialBreakdown !== false
                        ? ` • Host Payable ${formatLkr(inspectedDemoBooking.hostNetPayoutLkr)}`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-navy-950">2. Physical Intake Handover</strong>
                    <p className="text-[11px] text-navy-500">
                      Prototype Intake: Handover recorded against demo session fixture • Backup PIN:{" "}
                      <span className="font-mono">{inspectedDemoBooking.pinCode}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-navy-950">
                      3. Tamper-Evident Security Seals Applied
                    </strong>
                    <p className="text-[11px] text-navy-500">
                      {inspectedDemoBooking.sealIds.length > 0
                        ? inspectedDemoBooking.sealIds.join(", ")
                        : "Pending seal application"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-navy-950">4. Vault Compartment Assigned</strong>
                    <p className="text-[11px] text-navy-500">
                      Placed in Zone {inspectedDemoBooking.zoneCode} • Attributed to Staff{" "}
                      <span className="font-mono">staff-usr-204</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-sand-50 border border-sand-200 space-y-1.5">
                <p className="font-bold text-navy-950">Traveller Information</p>
                <p className="text-navy-700">
                  Name:{" "}
                  <strong className="text-navy-900">{inspectedDemoBooking.travellerName}</strong>
                </p>
                <p className="text-navy-700">Email: {inspectedDemoBooking.travellerEmail}</p>
                <p className="text-navy-700">
                  Phone:{" "}
                  <a
                    href={`tel:${inspectedDemoBooking.travellerPhone}`}
                    className="font-bold text-terracotta-600 hover:underline"
                  >
                    {inspectedDemoBooking.travellerPhone}
                  </a>
                </p>
              </div>
              <div className="p-4 rounded-xl bg-sand-50 border border-sand-200 space-y-1.5">
                <p className="font-bold text-navy-950">Custody Audit Details</p>
                <p className="text-navy-700">
                  Reconciled Bags:{" "}
                  <strong className="text-navy-900">{inspectedDemoBooking.totalBags} Bags</strong>
                </p>
                <p className="text-navy-700">
                  Photo Evidence: {inspectedDemoBooking.evidencePhotosCount} photos captured
                </p>
                <p className="text-navy-700">
                  Responsible Counter Staff:{" "}
                  <span className="font-mono text-navy-900 font-bold">Roshan Fernando</span>
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-sand-100">
              <span className="text-[11px] text-navy-500">
                Timestamped intake &amp; seal evidence verified
              </span>
              <button
                type="button"
                onClick={closeInvestigationModal}
                className="px-4 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold transition"
              >
                Close Audit Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HD-008: Live Booking & Custody Investigation Dossier */}
      {!showDemoBookings && liveInspectedUuid && (
        <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-sand-200 max-w-3xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-sand-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-navy-900 text-white font-mono text-xs font-bold">
                  Custody Audit
                </span>
                <h3 className="text-base font-bold text-navy-950">
                  Custody Evidence —{" "}
                  {inspectedLiveBooking?.referenceCode || liveInspectedUuid.slice(0, 8)}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeInvestigationModal}
                className="p-1.5 rounded-lg hover:bg-sand-100 text-navy-500"
                aria-label="Close investigation modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {(liveBookingDetailQuery.isError || liveCustodyDetailQuery.isError) && (
              <HostQueryErrorAlert
                message={
                  (liveBookingDetailQuery.error instanceof Error &&
                    liveBookingDetailQuery.error.message) ||
                  (liveCustodyDetailQuery.error instanceof Error &&
                    liveCustodyDetailQuery.error.message) ||
                  "Unable to load booking custody dossier."
                }
                onRetry={() => {
                  void liveBookingDetailQuery.refetch();
                  void liveCustodyDetailQuery.refetch();
                }}
              />
            )}

            {inspectedLiveBooking && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-sand-50 border border-sand-200 space-y-1.5">
                    <p className="font-bold text-navy-950">Traveller Information</p>
                    <p className="text-navy-700">
                      Name:{" "}
                      <strong className="text-navy-900">
                        {inspectedLiveBooking.travellerDisplayName ||
                          `Guest (${inspectedLiveBooking.travellerUserId.slice(0, 8)})`}
                      </strong>
                    </p>
                    <p className="text-navy-700">
                      Email: {inspectedLiveBooking.travellerEmailMasked || "Verified Platform Account"}
                    </p>
                    <p className="text-navy-700">
                      Schedule: {formatDateTimeDisplay(inspectedLiveBooking.dropOffAt)} →{" "}
                      {formatDateTimeDisplay(inspectedLiveBooking.collectionAt)}
                    </p>
                    <p className="text-navy-700">
                      Hub: {inspectedLiveBooking.location.name} ({inspectedLiveBooking.location.city})
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-sand-50 border border-sand-200 space-y-1.5">
                    <p className="font-bold text-navy-950">Booking &amp; Custody Summary</p>
                    <p className="text-navy-700">
                      Booked Bags:{" "}
                      <strong className="text-navy-900">
                        {inspectedLiveBooking.totalBags} Bags
                      </strong>{" "}
                      (
                      {inspectedLiveBooking.items
                        .map(
                          (item) => `${item.quantity}× ${formatBagCategoryLabel(item.bagCategory)}`
                        )
                        .join(", ")}
                      )
                    </p>
                    {effectiveHostRole !== "HOST_STAFF" &&
                      inspectedLiveBooking.pricingSnapshot && (
                        <p className="text-navy-700">
                          Gross{" "}
                          {formatLkrMinor(
                            inspectedLiveBooking.totalAmountMinor,
                            inspectedLiveBooking.currency
                          )}{" "}
                          •{" "}
                          {inspectedLiveBooking.pricingSnapshot.hostPayableMinor !== undefined
                            ? `Payable ${formatLkrMinor(
                                inspectedLiveBooking.pricingSnapshot.hostPayableMinor,
                                inspectedLiveBooking.currency
                              )}`
                            : "Breakdown pending"}
                        </p>
                      )}
                    {inspectedLiveBooking.refundSummary && (
                      <p className="text-navy-700">
                        Refund:{" "}
                        {formatRefundStatusDisplay(inspectedLiveBooking.refundSummary.status).label}{" "}
                        (
                        {formatLkrMinor(
                          inspectedLiveBooking.refundSummary.amountMinor,
                          inspectedLiveBooking.currency
                        )}
                        )
                      </p>
                    )}
                    <p className="text-navy-700">
                      Operator:{" "}
                      <span className="font-mono text-navy-900 font-bold">
                        {user?.displayName || user?.email || "Authenticated Host Operator"}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Custody Tags, Seals & Evidence Photos */}
                <div className="space-y-2 text-xs">
                  <p className="font-bold text-navy-900 uppercase text-[10px] tracking-wider">
                    Custody Lifecycle Events &amp; Tagged Luggage
                  </p>
                  {liveCustodyDetailQuery.data ? (
                    <div className="p-4 rounded-xl bg-sand-50 border border-sand-200 space-y-3 text-navy-800">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand-200 pb-2">
                        <span>
                          Custody Status:{" "}
                          <strong className="text-navy-950">
                            {liveCustodyDetailQuery.data.status.replace(/_/g, " ")}
                          </strong>
                        </span>
                        <span>
                          Checked In:{" "}
                          <strong>{liveCustodyDetailQuery.data.checkedInBagCount ?? 0}</strong> /{" "}
                          Expected{" "}
                          <strong>{liveCustodyDetailQuery.data.expectedBagCount}</strong>
                          {liveCustodyDetailQuery.data.releasedBagCount !== null
                            ? ` • Released: ${liveCustodyDetailQuery.data.releasedBagCount}`
                            : ""}
                        </span>
                      </div>

                      {liveCustodyDetailQuery.data.exceptionNotes && (
                        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" />
                          <span>Exception: {liveCustodyDetailQuery.data.exceptionNotes}</span>
                        </div>
                      )}

                      {liveCustodyDetailQuery.data.bags.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="font-bold text-navy-950">Tagged Storage Items</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {liveCustodyDetailQuery.data.bags.map((bag) => (
                              <div
                                key={bag.id}
                                className="p-2.5 rounded-lg bg-white border border-sand-200 space-y-1"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-mono font-bold text-navy-950">
                                    {bag.bagTagCode}
                                  </span>
                                  <span className="text-[11px] text-navy-600">
                                    {formatBagCategoryLabel(bag.bagCategory)}
                                  </span>
                                </div>
                                {bag.securitySealNumber && (
                                  <p className="text-[11px] text-navy-600">
                                    Seal: <span className="font-mono">{bag.securitySealNumber}</span>
                                  </p>
                                )}
                                {bag.conditionNotes && (
                                  <p className="text-[11px] text-navy-600">
                                    Notes: {bag.conditionNotes}
                                  </p>
                                )}
                                {bag.photoDownloadUrl && (
                                  <a
                                    href={bag.photoDownloadUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-terracotta-600 hover:underline"
                                  >
                                    <span>View Evidence Photo</span>
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2 pt-1">
                        {liveCustodyDetailQuery.data.events.map((evt) => (
                          <div key={evt.id} className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <strong className="text-navy-950">{evt.eventType}</strong>
                              <p className="text-[11px] text-navy-500">
                                {formatDateTimeDisplay(evt.createdAt)} • Actor {evt.actorRole} •{" "}
                                {evt.previousStatus ? `${evt.previousStatus} → ` : ""}
                                {evt.newStatus}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-sand-50 border border-sand-200 text-navy-700 space-y-2">
                      <p className="font-semibold text-navy-900">
                        Awaiting Physical Intake Handover
                      </p>
                      <p className="text-[11px] text-navy-600">
                        Custody bag tags and counter inspection events will appear here once physical
                        intake is completed at the counter desk.
                      </p>
                    </div>
                  )}
                </div>

                {/* Booking Status Transition History */}
                {inspectedLiveBooking.statusHistory.length > 0 && (
                  <div className="space-y-2 text-xs">
                    <p className="font-bold text-navy-900 uppercase text-[10px] tracking-wider">
                      Booking Status History
                    </p>
                    <div className="p-3.5 rounded-xl bg-sand-50 border border-sand-200 space-y-1.5">
                      {inspectedLiveBooking.statusHistory.map((hist) => (
                        <div
                          key={hist.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-[11px]"
                        >
                          <span className="font-semibold text-navy-900">
                            {hist.previousStatus ? `${hist.previousStatus} → ` : ""}
                            {hist.newStatus}
                            {hist.reason ? ` — ${hist.reason}` : ""}
                          </span>
                          <span className="text-navy-500">
                            {formatDateTimeDisplay(hist.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-sand-100">
              <span className="text-[11px] text-navy-500">
                Server custody &amp; status ledger synchronized
              </span>
              <button
                type="button"
                onClick={closeInvestigationModal}
                className="px-4 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold transition"
              >
                Close Audit Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
