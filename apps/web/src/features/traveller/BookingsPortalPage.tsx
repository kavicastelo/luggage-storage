import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type {
  BookingDetail,
  BookingStatus,
  CustodyPassResponse,
  RecordBookingExceptionRequest
} from "@luggage-storage/contracts";
import {
  CalendarClock,
  FileText,
  MapPin,
  Printer,
  QrCode,
  Search,
  ShieldAlert,
  XCircle
} from "lucide-react";
import {
  DEMO_BOOKINGS,
  REFUND_SEVEN_STAGES,
  formatLkr
} from "@/data/mock-marketplace";
import { isDemoPreviewActive } from "@/config/demo-preview";
import { useAuthStore } from "@/store/useAuthStore";
import {
  useCancelBookingMutation,
  useIssueCustodyPassMutation,
  useReportBookingExceptionMutation,
  useTravellerBookings
} from "@/hooks/queries/use-traveller-bookings";
import { getBookingStatusDisplay } from "@/lib/booking-status";
import {
  formatBagCategoryLabel,
  formatDateTimeDisplay,
  formatLkrMinor,
  formatRefundStatusDisplay
} from "@/lib/formatters";
import { CustodyQrPassCard } from "@/components/custody/CustodyQrPassCard";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { Modal } from "@/components/ui/Modal";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import {
  classifyTravellerPortalTab,
  evaluateTravellerCancellationPreview,
  hasBookingRefundRecord
} from "./traveller-utils";

type PortalTabKey = "active" | "past" | "refunds";

const EXCEPTION_CATEGORIES: Array<{
  value: RecordBookingExceptionRequest["category"];
  label: string;
}> = [
  { value: "DAMAGE_REPORTED", label: "Luggage Damage Reported" },
  { value: "MISSING_ITEM", label: "Missing Item or Bag" },
  { value: "OVERDUE_DISPUTE", label: "Overdue Fee or Return Dispute" },
  { value: "HOST_NO_SHOW", label: "Host Counter Unattended / Closed" },
  { value: "SAFETY_CONCERN", label: "Facility Safety or Seal Concern" },
  { value: "OTHER", label: "Other Custody Incident" }
];

export function TravellerWebPortalPage() {
  const routeLocation = useLocation();
  const { user, isAuthenticated } = useAuthStore();

  const isDemoMode = isDemoPreviewActive({
    allowDemoPreview: true,
    search: routeLocation.search,
    isAuthenticated
  });

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "Traveller Account Portal — LuggageStorage";
    }
  }, []);

  const [activeTab, setActiveTab] = useState<PortalTabKey>("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);

  // Active modals in live mode
  const [activePassModal, setActivePassModal] = useState<{
    booking: BookingDetail;
    pass: CustodyPassResponse;
  } | null>(null);
  const [receiptBooking, setReceiptBooking] = useState<BookingDetail | null>(null);
  const [cancelTarget, setCancelTarget] = useState<BookingDetail | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [exceptionTarget, setExceptionTarget] = useState<BookingDetail | null>(null);
  const [exceptionCategory, setExceptionCategory] =
    useState<RecordBookingExceptionRequest["category"]>("DAMAGE_REPORTED");
  const [exceptionReason, setExceptionReason] = useState("");
  const [portalFeedback, setPortalFeedback] = useState<{
    variant: "success" | "danger";
    message: string;
  } | null>(null);

  const bookingsQuery = useTravellerBookings(
    {
      page,
      limit: 10,
      ...(selectedStatusFilter !== "ALL"
        ? { status: selectedStatusFilter as BookingStatus }
        : {}),
      ...(searchTerm.trim() ? { search: searchTerm.trim() } : {})
    },
    { enabled: !isDemoMode && isAuthenticated }
  );

  const issuePassMutation = useIssueCustodyPassMutation();
  const cancelMutation = useCancelBookingMutation();
  const reportExceptionMutation = useReportBookingExceptionMutation();

  const liveBookings = bookingsQuery.data?.bookings ?? [];

  const filteredLiveBookings = useMemo(() => {
    return liveBookings.filter((booking) => {
      if (selectedStatusFilter !== "ALL" && booking.status !== selectedStatusFilter) {
        return false;
      }
      if (searchTerm.trim()) {
        const needle = searchTerm.trim().toLowerCase();
        const hay = `${booking.referenceCode} ${booking.location.name} ${booking.location.city}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [liveBookings, selectedStatusFilter, searchTerm]);

  const tabBookings = useMemo(() => {
    if (activeTab === "refunds") {
      return filteredLiveBookings.filter(hasBookingRefundRecord);
    }
    return filteredLiveBookings.filter((b) => classifyTravellerPortalTab(b) === activeTab);
  }, [filteredLiveBookings, activeTab]);

  const handleOpenLivePass = async (booking: BookingDetail) => {
    setPortalFeedback(null);
    const operation: "CHECK_IN" | "COLLECTION" =
      booking.status === "IN_STORAGE" ? "COLLECTION" : "CHECK_IN";
    try {
      const pass = await issuePassMutation.mutateAsync({
        bookingId: booking.id,
        operation
      });
      setActivePassModal({ booking, pass });
    } catch (err) {
      setPortalFeedback({
        variant: "danger",
        message:
          err instanceof Error
            ? err.message
            : "Could not issue single-use Digital Custody Pass."
      });
    }
  };

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget) return;
    setPortalFeedback(null);
    try {
      await cancelMutation.mutateAsync({
        bookingId: cancelTarget.id,
        data: { reason: cancelReason.trim() }
      });
      setPortalFeedback({
        variant: "success",
        message: `Booking #${cancelTarget.referenceCode} has been cancelled and capacity released.`
      });
      setCancelTarget(null);
      setCancelReason("");
    } catch (err) {
      setPortalFeedback({
        variant: "danger",
        message:
          err instanceof Error ? err.message : "Failed to cancel reservation."
      });
    }
  };

  const handleSubmitException = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exceptionTarget) return;
    setPortalFeedback(null);
    try {
      await reportExceptionMutation.mutateAsync({
        bookingId: exceptionTarget.id,
        data: {
          category: exceptionCategory,
          reason: exceptionReason.trim()
        }
      });
      setPortalFeedback({
        variant: "success",
        message: `Exception logged for booking #${exceptionTarget.referenceCode}. Support and host operations have been notified.`
      });
      setExceptionTarget(null);
      setExceptionReason("");
    } catch (err) {
      setPortalFeedback({
        variant: "danger",
        message:
          err instanceof Error ? err.message : "Failed to submit custody exception report."
      });
    }
  };

  // Strict Demo Preview Rendering (only on unauthenticated ?preview=demo)
  if (isDemoMode) {
    const demoActive = DEMO_BOOKINGS.filter(
      (b) => b.status === "CONFIRMED" || b.status === "CHECKED_IN"
    );
    const demoPast = DEMO_BOOKINGS.filter((b) => b.status === "COMPLETED");
    const demoRefunds = DEMO_BOOKINGS.filter((b) => b.status === "CANCELLED_REFUNDED");

    const demoVisible =
      activeTab === "active"
        ? demoActive
        : activeTab === "past"
        ? demoPast
        : demoRefunds;

    return (
      <div className="space-y-6 pb-12 max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-navy-950">Traveller Account Portal</h1>
            <p className="text-sm text-sand-700 mt-1">
              Previewing custody passes, booking lifecycle tabs, and refund timelines.
            </p>
          </div>
          <Badge variant="neutral" size="md">
            Demo Preview
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-sand-200 pb-3" role="tablist">
          {(
            [
              { key: "active", label: "Active & Upcoming" },
              { key: "past", label: "Past Trips" },
              { key: "refunds", label: "Refunds & Settlements" }
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                activeTab === tab.key
                  ? "bg-navy-900 text-white"
                  : "bg-white border border-sand-300 text-navy-900 hover:bg-sand-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {demoVisible.map((booking) => (
            <Card key={booking.id} className="p-6 bg-white space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="font-mono text-xs font-bold text-terracotta-700">
                    {`#${booking.reference}`}
                  </span>
                  <h2 className="text-lg font-extrabold text-navy-950">{booking.locationName}</h2>
                  <p className="text-xs text-sand-700">{booking.city}</p>
                </div>
                <div className="text-right">
                  <Badge variant="brand">{booking.status.replace(/_/g, " ")}</Badge>
                  <p className="text-sm font-black text-navy-950 mt-1 tabular-nums">
                    {formatLkr(booking.totalAmountLkr)}
                  </p>
                </div>
              </div>

              {(booking.status === "CONFIRMED" || booking.status === "CHECKED_IN") && (
                <div className="pt-3 border-t border-sand-200 flex flex-wrap justify-between items-center gap-3">
                  <Link
                    to={`/booking/confirm?loc=${encodeURIComponent(booking.locationId)}&preview=demo`}
                    className="min-h-[44px] inline-flex items-center px-4 py-2 rounded-xl bg-navy-900 text-white text-xs font-bold hover:bg-navy-800 transition-colors"
                  >
                    View Digital Custody Pass
                  </Link>
                </div>
              )}

              {activeTab === "refunds" && (
                <div className="pt-3 border-t border-sand-200 space-y-2">
                  {REFUND_SEVEN_STAGES.map((stage) => (
                    <div key={stage.code} className="flex justify-between text-xs">
                      <span className={stage.completed ? "font-bold text-navy-950" : "text-sand-600"}>
                        {stage.stage}. {stage.label}
                      </span>
                      <span className="font-mono text-sand-700">{stage.timestamp}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const cancelPreview = cancelTarget
    ? evaluateTravellerCancellationPreview({
        status: cancelTarget.status,
        dropOffAt: cancelTarget.dropOffAt,
        totalAmountMinor: cancelTarget.totalAmountMinor,
        paymentSucceeded: cancelTarget.paymentSummary?.status === "SUCCEEDED"
      })
    : null;

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-navy-950">Traveller Account Portal</h1>
          <p className="text-sm text-sand-700 mt-1">
            {user ? `Signed in as ${user.displayName} (${user.email})` : "Manage bookings and custody credentials"}
          </p>
        </div>
        <Link
          to="/search"
          className="min-h-[44px] inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-terracotta-500 text-white text-xs font-bold hover:bg-terracotta-600 transition-colors"
        >
          Find Storage
        </Link>
      </div>

      {portalFeedback && (
        <Alert variant={portalFeedback.variant}>{portalFeedback.message}</Alert>
      )}

      {/* Tabs + Search / Filter Controls */}
      <Card className="p-4 bg-white space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="tablist">
            {(
              [
                {
                  key: "active",
                  label: "Active & Upcoming",
                  count: filteredLiveBookings.filter(
                    (b) => classifyTravellerPortalTab(b) === "active"
                  ).length
                },
                {
                  key: "past",
                  label: "Past Trips",
                  count: filteredLiveBookings.filter(
                    (b) => classifyTravellerPortalTab(b) === "past"
                  ).length
                },
                {
                  key: "refunds",
                  label: "Refunds & Settlements",
                  count: filteredLiveBookings.filter(hasBookingRefundRecord).length
                }
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setPage(1);
                }}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  activeTab === tab.key
                    ? "bg-navy-900 text-white"
                    : "bg-sand-50 border border-sand-300 text-navy-900 hover:bg-sand-100"
                }`}
              >
                <span>{tab.label}</span>
                <span className="font-mono text-[11px] opacity-80 tabular-nums">({tab.count})</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <label htmlFor="portal-search-input" className="sr-only">
                Search bookings by reference or hub
              </label>
              <Search className="h-3.5 w-3.5 text-sand-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="portal-search-input"
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                placeholder="Search reference or hub..."
                className="min-h-[44px] pl-8 pr-3 py-1.5 rounded-xl border border-sand-300 text-xs focus:outline-none focus:ring-2 focus:ring-terracotta-500"
              />
            </div>

            <label htmlFor="portal-status-filter" className="sr-only">
              Filter booking status
            </label>
            <select
              id="portal-status-filter"
              aria-label="Filter booking status"
              value={selectedStatusFilter}
              onChange={(e) => {
                setSelectedStatusFilter(e.target.value);
                setPage(1);
              }}
              className="min-h-[44px] px-3 py-1.5 rounded-xl border border-sand-300 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING_HOST_APPROVAL">Awaiting Host</option>
              <option value="PENDING_PAYMENT">Awaiting Payment</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="IN_STORAGE">Checked In</option>
              <option value="COMPLETED">Completed</option>
              <option value="DISPUTED">Disputed / Exception</option>
              <option value="EXPIRED">Expired</option>
              <option value="REJECTED">Declined</option>
              <option value="CANCELLED_BY_TRAVELLER">Cancelled by Traveller</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Live Bookings List */}
      {bookingsQuery.isLoading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <Card key={i} className="p-6 space-y-3">
              <LoadingSkeleton variant="text" className="w-1/4" />
              <LoadingSkeleton variant="text" className="w-1/2" />
              <LoadingSkeleton className="h-16 w-full" />
            </Card>
          ))}
        </div>
      ) : bookingsQuery.isError ? (
        <Alert variant="danger" title="Unable to Load Your Reservations">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {bookingsQuery.error instanceof Error
                ? bookingsQuery.error.message
                : "Network error contacting booking ledger."}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void bookingsQuery.refetch()}
            >
              Retry
            </Button>
          </div>
        </Alert>
      ) : tabBookings.length === 0 ? (
        <EmptyState
          mascot={activeTab === "refunds" ? "sleeping" : "suitcase-peek"}
          title="No bookings in this view yet"
          description={
            activeTab === "refunds"
              ? "Refund settlements appear here when a paid booking is cancelled under policy tiers."
              : "Explore verified Sri Lankan storage corridors to schedule your next hands-free stop."
          }
          action={
            <Link
              to="/search"
              className="min-h-[44px] inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-navy-900 text-white text-xs font-bold hover:bg-navy-800 transition-colors"
            >
              Find Storage
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {tabBookings.map((booking) => {
            const statusDisplay = getBookingStatusDisplay(booking.status, {
              collectionAt: booking.collectionAt,
              hasRefund: Boolean(booking.refundSummary)
            });
            const paymentSucceeded = booking.paymentSummary?.status === "SUCCEEDED";
            const bookingCancelPreview = evaluateTravellerCancellationPreview({
              status: booking.status,
              dropOffAt: booking.dropOffAt,
              totalAmountMinor: booking.totalAmountMinor,
              paymentSucceeded
            });
            const canIssuePass =
              booking.status === "CONFIRMED" || booking.status === "IN_STORAGE";
            const canReportException =
              booking.status === "CONFIRMED" ||
              booking.status === "IN_STORAGE" ||
              booking.status === "COMPLETED";

            return (
              <Card key={booking.id} className="p-6 bg-white space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-terracotta-700">
                        {`#${booking.referenceCode}`}
                      </span>
                      <Badge variant={statusDisplay.tone} size="sm">
                        {statusDisplay.label}
                      </Badge>
                    </div>
                    <h2 className="text-lg font-extrabold text-navy-950">
                      {booking.location.name}
                    </h2>
                    <p className="text-xs text-sand-700 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-terracotta-500 shrink-0" />
                      {booking.location.addressDisclosed && booking.location.addressLine1
                        ? `${booking.location.addressLine1}, ${booking.location.city}`
                        : `${booking.location.approximateArea}, ${booking.location.city}`}
                    </p>
                    <p className="text-xs text-sand-600 flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5 text-navy-700 shrink-0" />
                      {formatDateTimeDisplay(booking.dropOffAt)} →{" "}
                      {formatDateTimeDisplay(booking.collectionAt)} ({booking.totalBags}{" "}
                      {booking.totalBags === 1 ? "bag" : "bags"})
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-sand-600">Booking Total</p>
                    <p className="text-xl font-black text-navy-950 font-mono tabular-nums">
                      {formatLkrMinor(booking.totalAmountMinor, booking.currency)}
                    </p>
                    {booking.status === "PENDING_PAYMENT" && booking.holdExpiresAt && (
                      <p className="text-[11px] font-semibold text-amber-700 mt-1">
                        Hold until {formatDateTimeDisplay(booking.holdExpiresAt)}
                      </p>
                    )}
                  </div>
                </div>

                {booking.location.addressDisclosed && booking.location.directionsNotes && (
                  <p className="text-xs text-sand-700 bg-sand-50 border border-sand-200 rounded-xl px-3.5 py-2">
                    <span className="font-bold text-navy-900">Directions: </span>
                    {booking.location.directionsNotes}
                  </p>
                )}

                {booking.custodySummary && booking.custodySummary.overdueFeeMinor > 0 && (
                  <Alert variant="warning" title="Overdue Storage Duration Recorded">
                    Overdue duration: {booking.custodySummary.overdueMinutes} min (
                    {formatLkrMinor(booking.custodySummary.overdueFeeMinor, booking.currency)}).
                  </Alert>
                )}

                {booking.refundSummary && (
                  <div className="rounded-xl border border-sand-200 bg-sand-50 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <p className="font-bold text-navy-950">
                        Authoritative Refund Record ({booking.refundSummary.refundPercentage}% tier)
                      </p>
                      <p className="text-sand-700">
                        Reason: {booking.refundSummary.reasonCategory.replace(/_/g, " ")}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="font-mono font-extrabold text-navy-950 tabular-nums">
                        {formatLkrMinor(booking.refundSummary.amountMinor, booking.currency)}
                      </p>
                      <Badge
                        variant={formatRefundStatusDisplay(booking.refundSummary.status).tone}
                        size="sm"
                      >
                        {formatRefundStatusDisplay(booking.refundSummary.status).label}
                      </Badge>
                    </div>
                  </div>
                )}

                {/* Action Strip */}
                <div className="pt-3 border-t border-sand-200 flex flex-wrap items-center gap-2 justify-between">
                  <div className="flex flex-wrap gap-2">
                    {booking.status === "PENDING_PAYMENT" && (
                      <Link
                        to={`/booking/confirm?bookingId=${encodeURIComponent(booking.id)}`}
                        className="min-h-[44px] inline-flex items-center justify-center px-4 py-2 rounded-xl bg-terracotta-500 text-white text-xs font-bold hover:bg-terracotta-600 transition-colors"
                      >
                        Complete Payment
                      </Link>
                    )}

                    {canIssuePass && (
                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        isLoading={issuePassMutation.isPending}
                        onClick={() => void handleOpenLivePass(booking)}
                      >
                        <QrCode className="h-4 w-4" />
                        View Digital Custody Pass
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      onClick={() => setReceiptBooking(booking)}
                    >
                      <FileText className="h-4 w-4" />
                      Booking Summary Receipt
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {bookingCancelPreview.cancellable && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="md"
                        onClick={() => {
                          setCancelTarget(booking);
                          setCancelReason("");
                        }}
                      >
                        <XCircle className="h-4 w-4" />
                        Cancel Booking
                      </Button>
                    )}

                    {canReportException && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="md"
                        onClick={() => {
                          setExceptionTarget(booking);
                          setExceptionReason("");
                        }}
                      >
                        <ShieldAlert className="h-4 w-4" />
                        Report Problem
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {!isDemoMode &&
        bookingsQuery.data?.pagination &&
        bookingsQuery.data.pagination.totalPages > 1 && (
          <PaginationBar
            page={bookingsQuery.data.pagination.page}
            totalPages={bookingsQuery.data.pagination.totalPages}
            total={bookingsQuery.data.pagination.total}
            limit={bookingsQuery.data.pagination.limit}
            itemLabel="reservations"
            onPageChange={(nextPage) => {
              setPage(nextPage);
              if (typeof window !== "undefined") {
                window.scrollTo({ top: 100, behavior: "smooth" });
              }
            }}
          />
        )}

      {/* Digital Custody Pass Modal */}
      <Modal
        open={Boolean(activePassModal)}
        onClose={() => setActivePassModal(null)}
        title="Digital Custody Pass"
        subtitle={
          activePassModal
            ? `Booking #${activePassModal.pass.referenceCode} • ${activePassModal.booking.location.name}`
            : undefined
        }
        size="lg"
        footer={
          <Button
            type="button"
            variant="secondary"
            onClick={() => setActivePassModal(null)}
          >
            Close Pass
          </Button>
        }
      >
        {activePassModal && (
          <CustodyQrPassCard
            referenceCode={activePassModal.pass.referenceCode}
            operation={activePassModal.pass.operation}
            qrPayload={activePassModal.pass.qrToken}
            verificationPin={activePassModal.pass.verificationPin}
            expiresAt={activePassModal.pass.expiresAt}
            locationName={activePassModal.booking.location.name}
            isRegenerating={issuePassMutation.isPending}
            onRegenerate={() => void handleOpenLivePass(activePassModal.booking)}
          />
        )}
      </Modal>

      {/* Printable Non-Tax Booking Summary Receipt Modal (OQ-010) */}
      <Modal
        open={Boolean(receiptBooking)}
        onClose={() => setReceiptBooking(null)}
        title="Booking Summary Receipt"
        subtitle={
          receiptBooking
            ? `Booking Summary Receipt — Not a Tax/VAT Invoice (#${receiptBooking.referenceCode})`
            : undefined
        }
        size="lg"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (typeof window !== "undefined" && typeof window.print === "function") {
                  window.print();
                }
              }}
            >
              <Printer className="h-4 w-4" />
              Print Summary
            </Button>
            <Button type="button" variant="secondary" onClick={() => setReceiptBooking(null)}>
              Close
            </Button>
          </>
        }
      >
        {receiptBooking && (
          <div className="space-y-4">
            <div className="space-y-2 text-xs text-sand-800">
              <p>
                <span className="font-bold text-navy-950">Storage Hub: </span>
                {receiptBooking.location.name} ({receiptBooking.location.city})
              </p>
              <p>
                <span className="font-bold text-navy-950">Schedule: </span>
                {formatDateTimeDisplay(receiptBooking.dropOffAt)} →{" "}
                {formatDateTimeDisplay(receiptBooking.collectionAt)}
              </p>
              <div className="pt-2 border-t border-sand-200 space-y-1.5">
                {receiptBooking.items.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <span>
                      {formatBagCategoryLabel(item.bagCategory)} × {item.quantity}
                    </span>
                    <span className="font-mono font-semibold tabular-nums">
                      {formatLkrMinor(item.lineTotalMinor, receiptBooking.currency)}
                    </span>
                  </div>
                ))}
                {receiptBooking.pricingSnapshot && (
                  <>
                    <div className="flex justify-between pt-2 border-t border-sand-100">
                      <span>Storage Subtotal</span>
                      <span className="font-mono tabular-nums">
                        {formatLkrMinor(
                          receiptBooking.pricingSnapshot.storageSubtotalMinor,
                          receiptBooking.currency
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax</span>
                      <span className="font-mono tabular-nums">
                        {formatLkrMinor(
                          receiptBooking.pricingSnapshot.taxAmountMinor,
                          receiptBooking.currency
                        )}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between pt-2 border-t border-sand-300 text-sm font-extrabold text-navy-950">
                  <span>Total Payable</span>
                  <span className="font-mono tabular-nums">
                    {formatLkrMinor(receiptBooking.totalAmountMinor, receiptBooking.currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancellation Modal (OQ-009 Tiered Refund Preview) */}
      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title={cancelTarget ? `Cancel Booking #${cancelTarget.referenceCode}` : "Cancel Booking"}
        subtitle={cancelPreview?.tierLabel}
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelTarget(null)}
            >
              Keep Booking
            </Button>
            <Button
              type="submit"
              form="cancel-booking-form"
              variant="danger"
              isLoading={cancelMutation.isPending}
            >
              Confirm Cancellation
            </Button>
          </>
        }
      >
        {cancelTarget && cancelPreview && (
          <form id="cancel-booking-form" onSubmit={handleConfirmCancel} className="space-y-4">
            {cancelPreview.requiresRefund && (
              <div className="rounded-xl bg-sand-50 border border-sand-200 p-3.5 text-xs flex justify-between items-center">
                <span className="font-semibold text-navy-950">
                  Estimated Refund ({cancelPreview.refundPercentage}%)
                </span>
                <span className="font-mono font-extrabold text-navy-950 tabular-nums">
                  {formatLkrMinor(cancelPreview.estimatedRefundMinor, cancelTarget.currency)}
                </span>
              </div>
            )}

            <Textarea
              id="cancel-booking-reason"
              label="Cancellation Reason (3–500 characters)"
              rows={3}
              required
              minLength={3}
              maxLength={500}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Change in travel itinerary, train delay..."
            />
          </form>
        )}
      </Modal>

      {/* Report Custody Exception Modal */}
      <Modal
        open={Boolean(exceptionTarget)}
        onClose={() => setExceptionTarget(null)}
        title={
          exceptionTarget
            ? `Report Problem — #${exceptionTarget.referenceCode}`
            : "Report Problem"
        }
        subtitle="Creates a formal dispute / exception record linked directly to this booking."
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setExceptionTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="report-exception-form"
              variant="danger"
              isLoading={reportExceptionMutation.isPending}
            >
              Submit Problem Report
            </Button>
          </>
        }
      >
        {exceptionTarget && (
          <form id="report-exception-form" onSubmit={handleSubmitException} className="space-y-4">
            <Select
              id="exception-category-select"
              label="Issue Category"
              value={exceptionCategory}
              onChange={(e) =>
                setExceptionCategory(
                  e.target.value as RecordBookingExceptionRequest["category"]
                )
              }
            >
              {EXCEPTION_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </Select>

            <Textarea
              id="exception-reason-textarea"
              label="Detailed Description (5–1000 characters)"
              rows={4}
              required
              minLength={5}
              maxLength={1000}
              value={exceptionReason}
              onChange={(e) => setExceptionReason(e.target.value)}
              placeholder="Describe missing bag, seal discrepancy, or access issue..."
            />
          </form>
        )}
      </Modal>
    </div>
  );
}
