import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type {
  BookingDetail,
  CustodyPassResponse,
  RecordBookingExceptionRequest
} from "@luggage-storage/contracts";
import {
  AlertTriangle,
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
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
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

  // Active modals/drawers in live mode
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
    { limit: 50 },
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

        <div className="flex flex-wrap gap-2 border-b border-sand-200 pb-3">
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
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
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
                  <p className="text-sm font-black text-navy-950 mt-1">
                    {formatLkr(booking.totalAmountLkr)}
                  </p>
                </div>
              </div>

              {(booking.status === "CONFIRMED" || booking.status === "CHECKED_IN") && (
                <div className="pt-3 border-t border-sand-200 flex flex-wrap justify-between items-center gap-3">
                  <Link
                    to={`/booking/confirm?loc=${encodeURIComponent(booking.locationId)}&preview=demo`}
                    className="px-4 py-2 rounded-xl bg-navy-900 text-white text-xs font-bold"
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
          className="px-4 py-2.5 rounded-xl bg-terracotta-500 text-white text-xs font-bold hover:bg-terracotta-600"
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
          <div className="flex flex-wrap gap-2">
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
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  activeTab === tab.key
                    ? "bg-navy-900 text-white"
                    : "bg-sand-50 border border-sand-300 text-navy-900 hover:bg-sand-100"
                }`}
              >
                <span>{tab.label}</span>
                <span className="font-mono text-[11px] opacity-80">({tab.count})</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-sand-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search reference or hub..."
                className="pl-8 pr-3 py-1.5 rounded-xl border border-sand-300 text-xs"
              />
            </div>

            <select
              aria-label="Filter booking status"
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-sand-300 text-xs font-semibold bg-white"
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
        <Card className="p-8 text-center bg-white space-y-3">
          <p className="text-base font-extrabold text-navy-950">
            No bookings in this view yet
          </p>
          <p className="text-sm text-sand-700">
            {activeTab === "refunds"
              ? "Refund settlements appear here when a paid booking is cancelled under policy tiers."
              : "Explore verified Sri Lankan storage corridors to schedule your next hands-free stop."}
          </p>
          <Link
            to="/search"
            className="inline-block px-4 py-2 rounded-xl bg-navy-900 text-white text-xs font-bold"
          >
            Find Storage
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {tabBookings.map((booking) => {
            const statusDisplay = getBookingStatusDisplay(booking.status, {
              collectionAt: booking.collectionAt,
              hasRefund: Boolean(booking.refundSummary)
            });
            const paymentSucceeded = booking.paymentSummary?.status === "SUCCEEDED";
            const cancelPreview = evaluateTravellerCancellationPreview({
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
                    <p className="text-xl font-black text-navy-950 font-mono">
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
                      <p className="font-mono font-extrabold text-navy-950">
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
                        className="px-4 py-2 rounded-xl bg-terracotta-500 text-white text-xs font-bold hover:bg-terracotta-600"
                      >
                        Complete Payment
                      </Link>
                    )}

                    {canIssuePass && (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
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
                      size="sm"
                      onClick={() => setReceiptBooking(booking)}
                    >
                      <FileText className="h-4 w-4" />
                      Booking Summary Receipt
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {cancelPreview.cancellable && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
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
                        size="sm"
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

      {/* Digital Custody Pass Modal */}
      {activePassModal && (
        <div
          className="fixed inset-0 z-50 bg-navy-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-2xl w-full space-y-3">
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
            <div className="flex justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setActivePassModal(null)}
              >
                Close Pass
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Non-Tax Booking Summary Receipt Modal (OQ-010) */}
      {receiptBooking && (
        <div
          className="fixed inset-0 z-50 bg-navy-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <Card className="max-w-xl w-full p-6 bg-white space-y-4">
            <div className="flex items-start justify-between gap-4 border-b border-sand-200 pb-3">
              <div>
                <h3 className="text-xl font-extrabold text-navy-950">Booking Summary Receipt</h3>
                <p className="text-xs text-sand-700 mt-0.5">
                  Booking Summary Receipt — Not a Tax/VAT Invoice
                </p>
              </div>
              <span className="font-mono text-xs font-bold text-navy-900">
                {`#${receiptBooking.referenceCode}`}
              </span>
            </div>

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
              <div className="pt-2 border-t border-sand-200 space-y-1">
                {receiptBooking.items.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <span>
                      {formatBagCategoryLabel(item.bagCategory)} × {item.quantity}
                    </span>
                    <span className="font-mono font-semibold">
                      {formatLkrMinor(item.lineTotalMinor, receiptBooking.currency)}
                    </span>
                  </div>
                ))}
                {receiptBooking.pricingSnapshot && (
                  <>
                    <div className="flex justify-between pt-2 border-t border-sand-100">
                      <span>Storage Subtotal</span>
                      <span className="font-mono">
                        {formatLkrMinor(
                          receiptBooking.pricingSnapshot.storageSubtotalMinor,
                          receiptBooking.currency
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax</span>
                      <span className="font-mono">
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
                  <span className="font-mono">
                    {formatLkrMinor(receiptBooking.totalAmountMinor, receiptBooking.currency)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-sand-200">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (typeof window !== "undefined" && typeof window.print === "function") {
                    window.print();
                  }
                }}
              >
                <Printer className="h-4 w-4" />
                Print Summary
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setReceiptBooking(null)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Cancellation Modal (OQ-009 Tiered Refund Preview) */}
      {cancelTarget && (
        <div
          className="fixed inset-0 z-50 bg-navy-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <Card className="max-w-lg w-full p-6 bg-white space-y-4">
            {(() => {
              const preview = evaluateTravellerCancellationPreview({
                status: cancelTarget.status,
                dropOffAt: cancelTarget.dropOffAt,
                totalAmountMinor: cancelTarget.totalAmountMinor,
                paymentSucceeded: cancelTarget.paymentSummary?.status === "SUCCEEDED"
              });
              return (
                <form onSubmit={handleConfirmCancel} className="space-y-4">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-lg font-extrabold text-navy-950">
                        Cancel Booking #{cancelTarget.referenceCode}
                      </h3>
                      <p className="text-xs text-sand-700 mt-0.5">{preview.tierLabel}</p>
                    </div>
                  </div>

                  {preview.requiresRefund && (
                    <div className="rounded-xl bg-sand-50 border border-sand-200 p-3.5 text-xs flex justify-between items-center">
                      <span className="font-semibold text-navy-950">
                        Estimated Refund ({preview.refundPercentage}%)
                      </span>
                      <span className="font-mono font-extrabold text-navy-950">
                        {formatLkrMinor(preview.estimatedRefundMinor, cancelTarget.currency)}
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-navy-900 mb-1">
                      Cancellation Reason (3–500 characters)
                    </label>
                    <textarea
                      rows={3}
                      required
                      minLength={3}
                      maxLength={500}
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Change in travel itinerary, train delay..."
                      className="w-full rounded-xl border border-sand-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCancelTarget(null)}
                    >
                      Keep Booking
                    </Button>
                    <Button
                      type="submit"
                      variant="danger"
                      isLoading={cancelMutation.isPending}
                    >
                      Confirm Cancellation
                    </Button>
                  </div>
                </form>
              );
            })()}
          </Card>
        </div>
      )}

      {/* Report Custody Exception Modal */}
      {exceptionTarget && (
        <div
          className="fixed inset-0 z-50 bg-navy-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <Card className="max-w-lg w-full p-6 bg-white">
            <form onSubmit={handleSubmitException} className="space-y-4">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-extrabold text-navy-950">
                    Report Problem — #{exceptionTarget.referenceCode}
                  </h3>
                  <p className="text-xs text-sand-700 mt-0.5">
                    Creates a formal dispute / exception record linked directly to this booking.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-navy-900 mb-1">
                  Issue Category
                </label>
                <select
                  value={exceptionCategory}
                  onChange={(e) =>
                    setExceptionCategory(
                      e.target.value as RecordBookingExceptionRequest["category"]
                    )
                  }
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 text-sm bg-white"
                >
                  {EXCEPTION_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-navy-900 mb-1">
                  Detailed Description (5–1000 characters)
                </label>
                <textarea
                  rows={4}
                  required
                  minLength={5}
                  maxLength={1000}
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                  placeholder="Describe missing bag, seal discrepancy, or access issue..."
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setExceptionTarget(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  isLoading={reportExceptionMutation.isPending}
                >
                  Submit Problem Report
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
