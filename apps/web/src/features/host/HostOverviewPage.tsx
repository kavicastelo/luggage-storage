import React, { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  Luggage,
  Phone,
  QrCode,
  ShieldCheck,
  Wallet
} from "lucide-react";
import { Badge, Card, LoadingSkeleton, MascotIllustration } from "@/components/ui";
import { isDemoPreviewActive } from "@/config/demo-preview";
import { DEMO_BOOKINGS, DemoBookingRecord, formatLkr } from "@/data/mock-marketplace";
import {
  useCapacityPoolsQuery,
  useHostBookingsQuery,
  useHostFinanceSummaryQuery,
  useStorageZonesQuery
} from "@/hooks/queries/use-host-portal";
import { getBookingStatusDisplay } from "@/lib/booking-status";
import { formatBagCategoryLabel, formatDateTimeDisplay, formatLkrMinor } from "@/lib/formatters";
import { useAuthStore } from "@/store/useAuthStore";
import { useHostVenue } from "./HostDashboardLayout";
import { HostQueryErrorAlert, isUuid } from "./host-helpers";

export function HostOverviewDashboardPage() {
  const location = useLocation();
  const {
    currentLocation,
    selectedBusinessId,
    selectedLocationId,
    effectiveHostRole,
    canActAsHostOwner,
    isDemoActive,
    querySuffix,
    locationsError,
    reloadLocations
  } = useHostVenue();
  const { isAuthenticated, user } = useAuthStore();

  const showDemoOverview =
    !isAuthenticated &&
    (isDemoActive ||
      isDemoPreviewActive({
        allowDemoPreview: true,
        search: location.search,
        isAuthenticated
      }));

  const liveLocationId =
    isAuthenticated && !showDemoOverview && isUuid(selectedLocationId)
      ? selectedLocationId
      : undefined;
  const liveBusinessId =
    isAuthenticated && !showDemoOverview && isUuid(selectedBusinessId)
      ? selectedBusinessId
      : undefined;

  const bookingsQuery = useHostBookingsQuery(
    liveLocationId ? { locationId: liveLocationId, limit: 50 } : { limit: 50 },
    { enabled: isAuthenticated && !showDemoOverview }
  );
  const poolsQuery = useCapacityPoolsQuery(liveLocationId, {
    enabled: isAuthenticated && !showDemoOverview && Boolean(liveLocationId)
  });
  const zonesQuery = useStorageZonesQuery(liveLocationId, {
    enabled: isAuthenticated && !showDemoOverview && Boolean(liveLocationId)
  });
  const financeQuery = useHostFinanceSummaryQuery(liveBusinessId, {
    enabled: isAuthenticated && !showDemoOverview && canActAsHostOwner
  });

  const isOverviewLoading =
    isAuthenticated &&
    !showDemoOverview &&
    (bookingsQuery.isLoading || (Boolean(liveLocationId) && poolsQuery.isLoading));

  const liveBookings = bookingsQuery.data?.bookings ?? [];
  const activePools = useMemo(
    () => (poolsQuery.data ?? []).filter((pool) => pool.isActive),
    [poolsQuery.data]
  );
  const zones = zonesQuery.data ?? [];

  const activeBagsInVault = showDemoOverview
    ? 28
    : liveBookings
        .filter((b) => b.status === "IN_STORAGE")
        .reduce((sum, b) => sum + b.totalBags, 0);

  const totalCapacitySlots = showDemoOverview
    ? currentLocation?.totalCapacity ?? 0
    : activePools.reduce((sum, pool) => sum + pool.totalUnits, 0);

  const occupancyPercentage =
    totalCapacitySlots > 0
      ? Math.min(100, Math.round((activeBagsInVault / totalCapacitySlots) * 100))
      : 0;

  const todaysCheckInsCount = showDemoOverview
    ? 6
    : liveBookings.filter(
        (b) => b.status === "CONFIRMED" || b.status === "PENDING_HOST_APPROVAL"
      ).length;

  const activeInStorageCount = useMemo(
    () => liveBookings.filter((b) => b.status === "IN_STORAGE").length,
    [liveBookings]
  );
  const completedBookingsCount = useMemo(
    () => liveBookings.filter((b) => b.status === "COMPLETED").length,
    [liveBookings]
  );
  const todaysCollectionsCount = showDemoOverview ? 5 : activeInStorageCount;

  const overdueLiveBookings = useMemo(
    () =>
      liveBookings.filter(
        (b) =>
          getBookingStatusDisplay(b.status, {
            collectionAt: b.collectionAt,
            hasRefund: Boolean(b.refundSummary)
          }).isOverdue
      ),
    [liveBookings]
  );

  const overdueDemoBookings: DemoBookingRecord[] = useMemo(
    () => (showDemoOverview ? DEMO_BOOKINGS.filter((b) => b.status === "OVERDUE") : []),
    [showDemoOverview]
  );

  const overdueListLength = showDemoOverview
    ? overdueDemoBookings.length
    : overdueLiveBookings.length;

  const netEarningsFormatted = showDemoOverview
    ? formatLkr(184500)
    : formatLkrMinor(
        financeQuery.data?.totalEligibleMinor ?? 0,
        financeQuery.data?.currency ?? "LKR"
      );

  const combinedError =
    locationsError ||
    (bookingsQuery.isError
      ? bookingsQuery.error instanceof Error
        ? bookingsQuery.error.message
        : "Unable to load host overview bookings."
      : null) ||
    (canActAsHostOwner && financeQuery.isError
      ? financeQuery.error instanceof Error
        ? financeQuery.error.message
        : "Unable to load host finance summary."
      : null);

  return (
    <div className="space-y-6">
      {combinedError && (
        <HostQueryErrorAlert
          message={combinedError}
          onRetry={() => {
            void reloadLocations();
            void bookingsQuery.refetch();
            if (liveLocationId) {
              void poolsQuery.refetch();
              void zonesQuery.refetch();
            }
            if (canActAsHostOwner) {
              void financeQuery.refetch();
            }
          }}
        />
      )}

      {/* Overview Header */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="navy" size="sm">
                Active Storage Hub
              </Badge>
              <span className="text-xs text-navy-600 font-medium">
                {currentLocation?.city || "Host Operations"}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              {currentLocation?.name || "Host Operations Overview"}
            </h1>
            <p className="text-xs text-navy-600">
              Live custody workstation, capacity utilization, and today&apos;s customer handovers.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/host/operations${querySuffix}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold shadow-sm transition"
            >
              <QrCode className="h-4 w-4" />
              <span>Open Check-In Desk</span>
            </Link>
            <Link
              to={`/host/bookings${querySuffix}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-sand-300 text-navy-800 hover:bg-sand-50 text-xs font-bold transition"
            >
              <Briefcase className="h-3.5 w-3.5 text-navy-600" />
              <span>All Bookings</span>
            </Link>
          </div>
        </div>
      </Card>

      {/* 4 Key Operational Metric Cards */}
      {isOverviewLoading ? (
        <div
          aria-label="Loading host operational metrics"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {Array.from({ length: effectiveHostRole !== "HOST_STAFF" ? 4 : 3 }).map((_, idx) => (
            <Card key={idx} className="p-5 space-y-3">
              <LoadingSkeleton variant="text" className="w-28" />
              <LoadingSkeleton className="h-8 w-36" />
              <LoadingSkeleton variant="text" className="w-40" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Bags in Vault */}
          <Card className="p-5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-navy-500">
              <span>Bags in Vault</span>
              <Luggage className="h-4 w-4 text-terracotta-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-extrabold text-navy-950">
                {activeBagsInVault}{" "}
                <span className="text-sm font-semibold text-navy-500">
                  {totalCapacitySlots > 0 ? `/ ${totalCapacitySlots} units` : "bags in storage"}
                </span>
              </p>
              {totalCapacitySlots > 0 ? (
                <span className="text-xs font-bold text-emerald-700">{occupancyPercentage}% full</span>
              ) : (
                <span className="text-xs font-bold text-navy-500">0% configured</span>
              )}
            </div>
            <div className="w-full bg-sand-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-terracotta-500 h-1.5 rounded-full transition-all"
                style={{ width: `${occupancyPercentage}%` }}
              />
            </div>
            <p className="text-[11px] text-navy-600 font-medium">
              Reconciled and sealed with tamper tags
            </p>
          </Card>

          {/* Card 2: Arrivals */}
          <Card className="p-5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-navy-500">
              <span>{showDemoOverview ? "Today's Arrivals" : "Upcoming Arrivals"}</span>
              <ArrowRight className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-extrabold text-navy-950">
              {todaysCheckInsCount} {showDemoOverview ? "Bags" : "Bookings"}
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>
                {showDemoOverview
                  ? "3 checked in • 3 pending arrival"
                  : "Confirmed or awaiting host approval"}
              </span>
            </div>
            <p className="text-[11px] text-navy-500">
              {showDemoOverview ? "Next arrival scheduled at 11:30 IST" : "Synced with host booking ledger"}
            </p>
          </Card>

          {/* Card 3: Active Pickups vs Completed History */}
          <Card className="p-5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-navy-500">
              <span>{showDemoOverview ? "Today's Pickups" : "Active Vault Pickups"}</span>
              <Clock className="h-4 w-4 text-sky-600" />
            </div>
            <p className="text-2xl font-extrabold text-navy-950">
              {todaysCollectionsCount} {showDemoOverview ? "Bags" : "In Storage"}
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-navy-700 font-semibold">
              <span>
                {showDemoOverview
                  ? "4 completed • 1 overdue notice"
                  : `${completedBookingsCount} completed • ${overdueLiveBookings.length} overdue notice(s)`}
              </span>
            </div>
            <p className="text-[11px] text-amber-700 font-semibold">
              {showDemoOverview ? "30m grace window monitored" : "Zero Possessory Lien policy active"}
            </p>
          </Card>

          {/* Card 4: Net Host Earnings (Hidden from HOST_STAFF) */}
          {effectiveHostRole !== "HOST_STAFF" && (
            <Card className="p-5 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-navy-500">
                <span>Net Cleared Earnings</span>
                <Wallet className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-extrabold text-navy-950">{netEarningsFormatted}</p>
              <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                <span>
                  {showDemoOverview
                    ? "85% net host share"
                    : `Eligible now • Accrued ${formatLkrMinor(financeQuery.data?.totalAccruedMinor ?? 0, financeQuery.data?.currency ?? "LKR")}`}
                </span>
              </div>
              <p className="text-[11px] text-navy-500">
                {showDemoOverview
                  ? "Next batch payout: Friday (CEFT)"
                  : "View Revenue & Ledger for settlement breakdown"}
              </p>
            </Card>
          )}
        </div>
      )}

      {/* Overdue Bag Urgent Alert Banner */}
      {overdueListLength > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-300 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 hidden sm:block">
              <MascotIllustration mascot="alarm-clock" size="xs" variant="bare" decorative />
            </div>
            <div className="p-2 rounded-xl bg-amber-200/70 text-amber-900 mt-0.5 sm:hidden">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                  Overdue Custody Notice
                </span>
                <span className="text-xs font-mono font-bold text-navy-900">
                  {showDemoOverview
                    ? overdueDemoBookings[0].reference
                    : overdueLiveBookings[0].referenceCode}
                </span>
                {overdueListLength > 1 && (
                  <Badge variant="warning" size="sm">
                    +{overdueListLength - 1} more
                  </Badge>
                )}
              </div>
              <p className="text-xs text-navy-800 font-medium mt-1">
                Traveller{" "}
                <strong className="font-semibold">
                  {showDemoOverview
                    ? overdueDemoBookings[0].travellerName
                    : overdueLiveBookings[0].travellerDisplayName || "Traveller"}
                </strong>{" "}
                has passed the scheduled collection window. Under the Zero Possessory Lien policy,
                bags must still be released immediately upon valid QR/PIN verification.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {showDemoOverview && overdueDemoBookings[0] ? (
              <>
                <a
                  href={`tel:${overdueDemoBookings[0].travellerPhone}`}
                  className="px-3 py-1.5 rounded-xl border border-amber-400 bg-white text-navy-900 text-xs font-bold hover:bg-amber-100/50 transition flex items-center gap-1.5"
                >
                  <Phone className="h-3.5 w-3.5 text-terracotta-600" />
                  <span>Call Traveller</span>
                </a>
                <Link
                  to={`/host/bookings?inspect=${overdueDemoBookings[0].id}${isDemoActive ? "&preview=demo" : ""}`}
                  className="px-3 py-1.5 rounded-xl bg-navy-900 text-white text-xs font-bold hover:bg-navy-800 transition"
                >
                  Inspect Booking
                </Link>
              </>
            ) : overdueLiveBookings[0] ? (
              <>
                <Link
                  to={`/host/operations?ref=${encodeURIComponent(overdueLiveBookings[0].referenceCode)}&mode=checkout`}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition"
                >
                  Release at Desk
                </Link>
                <Link
                  to={`/host/bookings/${overdueLiveBookings[0].id}`}
                  className="px-3 py-1.5 rounded-xl bg-navy-900 text-white text-xs font-bold hover:bg-navy-800 transition"
                >
                  Inspect Booking
                </Link>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Main Two-Column Operations Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Today's Custody Movement Queue + Zone Capacity */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-navy-950">
                  Today&apos;s Custody Movement Queue
                </h2>
                <p className="text-xs text-navy-600">
                  Upcoming arrivals, active vault storage, and pending handovers
                </p>
              </div>
              <Link
                to={`/host/bookings${querySuffix}`}
                className="text-xs font-bold text-terracotta-600 hover:text-terracotta-700 flex items-center gap-1"
              >
                <span>Full Ledger</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {showDemoOverview ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-sand-200 text-navy-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="pb-2.5">Reference</th>
                      <th className="pb-2.5">Traveller</th>
                      <th className="pb-2.5">Bags &amp; Zone</th>
                      <th className="pb-2.5">Status</th>
                      <th className="pb-2.5 text-right">Counter Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sand-100">
                    {DEMO_BOOKINGS.slice(0, 5).map((booking) => {
                      const statusInfo = getBookingStatusDisplay(
                        booking.rawStatus ?? booking.status,
                        {
                          collectionAt: booking.pickUpIso,
                          hasRefund: booking.hasRefund
                        }
                      );
                      const isCheckedIn = booking.status === "CHECKED_IN";
                      const isConfirmed = booking.status === "CONFIRMED";

                      return (
                        <tr key={booking.id} className="hover:bg-sand-50/60 transition">
                          <td className="py-3 font-mono font-bold text-navy-900">
                            {booking.reference}
                          </td>
                          <td className="py-3">
                            <p className="font-semibold text-navy-900">{booking.travellerName}</p>
                            <p className="text-[10px] text-navy-500">{booking.travellerPhone}</p>
                          </td>
                          <td className="py-3">
                            <span className="font-semibold text-navy-800">
                              {booking.totalBags} Bags
                            </span>
                            <span className="text-[10px] text-navy-500 ml-1.5 px-1.5 py-0.5 rounded bg-sand-100 font-mono">
                              {booking.zoneCode}
                            </span>
                          </td>
                          <td className="py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                statusInfo.tone === "danger"
                                  ? "bg-rose-50 text-rose-800 border-rose-200"
                                  : statusInfo.tone === "success"
                                    ? "bg-blue-50 text-blue-800 border-blue-200"
                                    : statusInfo.tone === "warning"
                                      ? "bg-amber-50 text-amber-800 border-amber-200"
                                      : "bg-emerald-50 text-emerald-800 border-emerald-200"
                              }`}
                            >
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            {isCheckedIn ? (
                              <Link
                                to={`/host/operations?ref=${booking.reference}&mode=checkout${isDemoActive ? "&preview=demo" : ""}`}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition shadow-xs"
                              >
                                Check-Out
                              </Link>
                            ) : isConfirmed ? (
                              <Link
                                to={`/host/operations?ref=${booking.reference}&mode=checkin${isDemoActive ? "&preview=demo" : ""}`}
                                className="px-2.5 py-1 rounded-lg bg-terracotta-500 hover:bg-terracotta-600 text-white font-bold text-[11px] transition shadow-xs"
                              >
                                Check-In
                              </Link>
                            ) : (
                              <Link
                                to={`/host/bookings?inspect=${booking.id}${isDemoActive ? "&preview=demo" : ""}`}
                                className="px-2.5 py-1 rounded-lg bg-sand-100 hover:bg-sand-200 text-navy-800 font-bold text-[11px] transition"
                              >
                                Inspect
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : bookingsQuery.isLoading ? (
              <div className="space-y-2">
                <LoadingSkeleton className="h-10 w-full" />
                <LoadingSkeleton className="h-10 w-full" />
                <LoadingSkeleton className="h-10 w-full" />
              </div>
            ) : liveBookings.length === 0 ? (
              <div className="p-6 rounded-xl bg-sand-50 border border-sand-200 text-center text-xs text-navy-600">
                No host bookings recorded yet for your verified locations.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-sand-200 text-navy-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="pb-2.5">Reference</th>
                      <th className="pb-2.5">Traveller &amp; Window</th>
                      <th className="pb-2.5">Bags</th>
                      <th className="pb-2.5">Status</th>
                      <th className="pb-2.5 text-right">Counter Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sand-100">
                    {liveBookings.slice(0, 5).map((booking) => {
                      const statusInfo = getBookingStatusDisplay(booking.status, {
                        collectionAt: booking.collectionAt,
                        hasRefund: Boolean(booking.refundSummary)
                      });
                      const isInStorage = booking.status === "IN_STORAGE";
                      const isConfirmed = booking.status === "CONFIRMED";

                      return (
                        <tr key={booking.id} className="hover:bg-sand-50/60 transition">
                          <td className="py-3 font-mono font-bold text-navy-900">
                            {booking.referenceCode}
                          </td>
                          <td className="py-3">
                            <p className="font-semibold text-navy-900">
                              {booking.travellerDisplayName ||
                                `Guest (${booking.travellerUserId.slice(0, 8)})`}
                            </p>
                            <p className="text-[10px] text-navy-500">
                              {formatDateTimeDisplay(booking.dropOffAt)} →{" "}
                              {formatDateTimeDisplay(booking.collectionAt)}
                            </p>
                          </td>
                          <td className="py-3">
                            <span className="font-semibold text-navy-800">
                              {booking.totalBags} Bags
                            </span>
                            <span className="text-[10px] text-navy-500 ml-1.5">
                              {booking.items
                                .map(
                                  (item) =>
                                    `${item.quantity}× ${formatBagCategoryLabel(item.bagCategory)}`
                                )
                                .join(", ")}
                            </span>
                          </td>
                          <td className="py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                statusInfo.tone === "danger"
                                  ? "bg-rose-50 text-rose-800 border-rose-200"
                                  : statusInfo.tone === "success"
                                    ? "bg-blue-50 text-blue-800 border-blue-200"
                                    : statusInfo.tone === "warning"
                                      ? "bg-amber-50 text-amber-800 border-amber-200"
                                      : statusInfo.tone === "brand"
                                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                        : "bg-sand-100 text-navy-700 border-sand-300"
                              }`}
                            >
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            {isInStorage ? (
                              <Link
                                to={`/host/operations?ref=${encodeURIComponent(booking.referenceCode)}&mode=checkout`}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition shadow-xs"
                              >
                                Check-Out
                              </Link>
                            ) : isConfirmed ? (
                              <Link
                                to={`/host/operations?ref=${encodeURIComponent(booking.referenceCode)}&mode=checkin`}
                                className="px-2.5 py-1 rounded-lg bg-terracotta-500 hover:bg-terracotta-600 text-white font-bold text-[11px] transition shadow-xs"
                              >
                                Check-In
                              </Link>
                            ) : (
                              <Link
                                to={`/host/bookings/${booking.id}`}
                                className="px-2.5 py-1 rounded-lg bg-sand-100 hover:bg-sand-200 text-navy-800 font-bold text-[11px] transition"
                              >
                                Inspect
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Physical Zone Capacity Meters */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-navy-950">Physical Zone Capacity</h3>
                <p className="text-xs text-navy-600">
                  {showDemoOverview
                    ? "Real-time rack and compartment occupancy"
                    : "Configured storage compartments and allocated capacity units"}
                </p>
              </div>
              {effectiveHostRole !== "HOST_STAFF" && currentLocation && (
                <Link
                  to={`/host/locations/${currentLocation.id}/capacity${querySuffix}`}
                  className="text-xs font-bold text-terracotta-600 hover:text-terracotta-700"
                >
                  Manage Zones →
                </Link>
              )}
            </div>

            {showDemoOverview ? (
              currentLocation && currentLocation.zones.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {currentLocation.zones.map((zone) => {
                    const zonePercent =
                      zone.capacity > 0
                        ? Math.min(100, Math.round((zone.occupied / zone.capacity) * 100))
                        : 0;
                    return (
                      <div
                        key={zone.id}
                        className="p-3.5 rounded-xl bg-sand-50/70 border border-sand-200 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-navy-900">
                            {zone.code}
                          </span>
                          <span className="text-xs font-semibold text-navy-700">{zonePercent}%</span>
                        </div>
                        <p className="text-xs font-medium text-navy-800 truncate">{zone.name}</p>
                        <div className="w-full bg-sand-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              zonePercent > 80 ? "bg-amber-500" : "bg-emerald-500"
                            }`}
                            style={{ width: `${zonePercent}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-navy-500">
                          {zone.occupied} of {zone.capacity} occupied
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : null
            ) : zonesQuery.isLoading || poolsQuery.isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <LoadingSkeleton className="h-24 w-full" />
                <LoadingSkeleton className="h-24 w-full" />
              </div>
            ) : zones.length === 0 && activePools.length === 0 ? (
              <p className="text-xs text-navy-600">
                Zone occupancy breakdown loads when compartment rules or capacity pools are
                configured on this storage hub.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {zones.length > 0
                  ? zones.map((zone) => {
                      const zonePoolUnits = activePools
                        .filter((p) => p.zoneId === zone.id)
                        .reduce((sum, p) => sum + p.totalUnits, 0);
                      const unlinkedSharedUnits = activePools
                        .filter((p) => !p.zoneId)
                        .reduce((sum, p) => sum + p.totalUnits, 0);
                      const allocationSharePercent =
                        totalCapacitySlots > 0
                          ? Math.min(
                              100,
                              Math.round(
                                ((zonePoolUnits > 0 ? zonePoolUnits : unlinkedSharedUnits) /
                                  totalCapacitySlots) *
                                  100
                              )
                            )
                          : 0;
                      return (
                        <div
                          key={zone.id}
                          className="p-3.5 rounded-xl bg-sand-50/70 border border-sand-200 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-navy-900">
                              {zone.zoneType}
                            </span>
                            <span className="text-xs font-semibold text-navy-700">
                              {totalCapacitySlots > 0
                                ? `${allocationSharePercent}% share`
                                : "0% configured"}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-navy-800 truncate">{zone.name}</p>
                          <div className="w-full bg-sand-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-1.5 rounded-full transition-all bg-emerald-500"
                              style={{ width: `${allocationSharePercent}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-navy-500">
                            {zonePoolUnits > 0
                              ? `${zonePoolUnits} dedicated units`
                              : totalCapacitySlots > 0
                                ? `Shared across ${totalCapacitySlots} hub units`
                                : "No active capacity pool units"}{" "}
                            • {zone.isActive ? "Active" : "Inactive"}
                          </p>
                        </div>
                      );
                    })
                  : activePools.map((pool) => {
                      const poolSharePercent =
                        totalCapacitySlots > 0
                          ? Math.min(100, Math.round((pool.totalUnits / totalCapacitySlots) * 100))
                          : 0;
                      return (
                        <div
                          key={pool.id}
                          className="p-3.5 rounded-xl bg-sand-50/70 border border-sand-200 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-navy-900">
                              {pool.poolType}
                            </span>
                            <span className="text-xs font-semibold text-navy-700">
                              {totalCapacitySlots > 0
                                ? `${poolSharePercent}% share`
                                : "0% configured"}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-navy-800 truncate">
                            {pool.dedicatedBagCategory
                              ? `${formatBagCategoryLabel(pool.dedicatedBagCategory)} Pool`
                              : "Shared Capacity Pool"}
                          </p>
                          <div className="w-full bg-sand-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-1.5 rounded-full bg-emerald-500 transition-all"
                              style={{ width: `${poolSharePercent}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-navy-500">
                            {pool.totalUnits} configured units
                          </p>
                        </div>
                      );
                    })}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Staff on Duty & Custody Verification Rules */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-navy-950">Staff on Counter Duty</h3>
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            {showDemoOverview ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-sand-50 border border-sand-200">
                <div className="h-10 w-10 rounded-full bg-navy-900 text-white flex items-center justify-center font-bold text-sm">
                  RF
                </div>
                <div className="truncate">
                  <p className="text-xs font-bold text-navy-900 truncate">Roshan Fernando</p>
                  <p className="text-[11px] text-navy-600">Counter Supervisor • Fort Hub</p>
                  <p className="text-[10px] text-emerald-700 font-semibold">
                    14 handovers completed today
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-sand-50 border border-sand-200 text-xs">
                <p className="font-bold text-navy-900">
                  {user?.displayName || user?.email || "Authenticated Host Operator"}
                </p>
                <p className="text-[11px] text-navy-600 mt-0.5">
                  {effectiveHostRole === "HOST_OWNER"
                    ? "Host Owner Session"
                    : "Host Staff Counter Session"}
                </p>
              </div>
            )}
            <p className="text-[11px] text-navy-600">
              Responsible for physical seal application, camera evidence checks, and rate-limited
              PIN releases.
            </p>
          </Card>

          {showDemoOverview && (
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-navy-950">Recent Guest Review</h3>
                <div className="flex items-center text-amber-500 text-xs">
                  <span>★★★★★</span>
                </div>
              </div>
              <blockquote className="text-xs text-navy-700 italic border-l-2 border-terracotta-500 pl-3">
                &ldquo;Super fast QR check-in right outside Colombo Fort Station! Loved seeing the
                numbered security seal placed on our backpacks.&rdquo;
              </blockquote>
              <div className="flex items-center justify-between text-[11px] text-navy-500 pt-1">
                <span>Amaya Perera (Sri Lanka)</span>
                <span>Yesterday</span>
              </div>
            </Card>
          )}

          {/* Custody Verification Rules Card */}
          <div className="bg-navy-950 text-white rounded-2xl p-5 shadow-sm space-y-3 border border-navy-800">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4" />
              <span>Custody Verification Rules</span>
            </div>
            <ul className="text-xs text-sand-200 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-terracotta-400 font-bold">•</span>
                <span>Tamper-evident seals are mandatory on every zipper before storage.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-terracotta-400 font-bold">•</span>
                <span>Reconcile physical bag count against booking before handing receipt.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-terracotta-400 font-bold">•</span>
                <span>6-digit PIN fallback is logged and rate-limited for security audit.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
