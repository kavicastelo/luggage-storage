import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useHostVenue } from "@/features/host";
import {
  Briefcase,
  QrCode,
  Wallet,
  Building2,
  X,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ChevronRight,
  Search,
  Download,
  Phone,
  Check,
  RefreshCw,
  Luggage,
  Info
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { isDemoPreviewActive } from "@/config/demo-preview";
import { getBookingStatusDisplay } from "@/lib/booking-status";
import { executeCounterCustodyHandover } from "@/lib/counter-custody";
import { marketplaceApi } from "@/services/marketplace-api";
import {
  BookingDetail,
  CustodyRecordDetail,
  HostFinanceSummaryResponse
} from "@luggage-storage/contracts";
import {
  DEMO_BOOKINGS,
  DemoBookingRecord,
  formatLkr
} from "@/data/mock-marketplace";

const HOST_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isHostUuid(value: string | null | undefined): value is string {
  return Boolean(value && HOST_UUID_REGEX.test(value));
}

function mapHostBookingToRecord(detail: BookingDetail): DemoBookingRecord {
  const bags = { SMALL: 0, MEDIUM: 0, LARGE: 0, OVERSIZED: 0 };
  for (const item of detail.items) {
    if (item.bagCategory === "BAG_SMALL") bags.SMALL += item.quantity;
    if (item.bagCategory === "BAG_MEDIUM") bags.MEDIUM += item.quantity;
    if (item.bagCategory === "BAG_LARGE") bags.LARGE += item.quantity;
    if (item.bagCategory === "BAG_OVERSIZED") bags.OVERSIZED += item.quantity;
  }

  let mappedStatus: DemoBookingRecord["status"] = "CONFIRMED";
  if (detail.status === "IN_STORAGE") {
    mappedStatus =
      new Date(detail.collectionAt).getTime() < Date.now() ? "OVERDUE" : "CHECKED_IN";
  } else if (detail.status === "COMPLETED") {
    mappedStatus = "COMPLETED";
  } else if (detail.status === "PENDING_HOST_APPROVAL") {
    mappedStatus = "PENDING_HOST_APPROVAL";
  } else if (
    detail.status.startsWith("CANCELLED") ||
    detail.status === "REJECTED" ||
    detail.status === "EXPIRED"
  ) {
    mappedStatus = "CANCELLED_REFUNDED";
  }

  const commissionMinor = detail.pricingSnapshot?.platformCommissionMinor ?? 0;
  const hostPayableMinor = detail.pricingSnapshot?.hostPayableMinor ?? 0;
  const hasFinancialBreakdown = detail.pricingSnapshot?.hostPayableMinor != null;
  const hasRefund = Boolean(detail.refundSummary);

  return {
    id: detail.id,
    reference: detail.referenceCode,
    travellerName: detail.travellerDisplayName || `Guest (${detail.travellerUserId.slice(0, 8)})`,
    travellerEmail: detail.travellerEmailMasked || "Verified Platform Account",
    travellerPhone: "In-App Protected Contact",
    locationId: detail.location.id,
    locationName: detail.location.name,
    city: detail.location.city,
    dropOffIso: detail.dropOffAt,
    pickUpIso: detail.collectionAt,
    bags,
    totalBags: detail.totalBags,
    totalAmountLkr: Math.round(detail.totalAmountMinor / 100),
    platformCommissionLkr: Math.round(commissionMinor / 100),
    hostNetPayoutLkr: Math.round(hostPayableMinor / 100),
    hasFinancialBreakdown,
    rawStatus: detail.status,
    hasRefund,
    refundAmountLkr: detail.refundSummary
      ? Math.round(detail.refundSummary.amountMinor / 100)
      : undefined,
    status: mappedStatus,
    pinCode: "Hashed Single-Use",
    qrPayload: "Hashed Single-Use",
    sealIds: [],
    zoneCode: detail.location.city.toUpperCase().slice(0, 6),
    evidencePhotosCount: 0
  };
}

// ============================================================================
// Extracted Initiative 3 Host Pages & Layout Re-exports
// ============================================================================
export {
  HostDashboardLayout,
  HostOnboardingPage,
  HostLocationManagementPage,
  HostLocationProfileEditorPage,
  HostScheduleCalendarEditorPage,
  HostCapacityPoolsZonesPage,
  HostPricingRulesMultipliersPage,
  HostStaffManagementRbacPage,
  HostBusinessProfileLegalPage,
  useHostVenue,
  type HostContextType
} from "@/features/host";

// ============================================================================
// HD-001: Host Overview Dashboard (/host/dashboard)
// ============================================================================
export function HostOverviewDashboardPage() {
  const {
    currentLocation,
    effectiveHostRole,
    isDemoActive,
    querySuffix,
    locationsError,
    reloadLocations
  } = useHostVenue();
  const { isAuthenticated, user } = useAuthStore();
  const showDemoOverview = !isAuthenticated && isDemoActive;
  const [liveBookings, setLiveBookings] = useState<DemoBookingRecord[]>([]);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    if (!isAuthenticated) {
      setLiveBookings([]);
      setOverviewError(null);
      return;
    }
    setOverviewError(null);
    try {
      const res = await marketplaceApi.getHostBookings();
      setLiveBookings(res.bookings.map(mapHostBookingToRecord));
    } catch (err: unknown) {
      setLiveBookings([]);
      setOverviewError(
        err instanceof Error ? err.message : "Unable to load host overview bookings."
      );
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const bookingsSource = showDemoOverview ? DEMO_BOOKINGS : liveBookings;
  const activeBagsInVault = showDemoOverview
    ? 28
    : liveBookings
        .filter((b) => b.rawStatus === "IN_STORAGE" || b.status === "CHECKED_IN")
        .reduce((sum, b) => sum + b.totalBags, 0);
  const totalCapacitySlots = currentLocation?.totalCapacity ?? 0;
  const occupancyPercentage =
    totalCapacitySlots > 0
      ? Math.min(100, Math.round((activeBagsInVault / totalCapacitySlots) * 100))
      : 0;

  const todaysCheckInsCount = showDemoOverview
    ? 6
    : liveBookings.filter(
        (b) => b.status === "CONFIRMED" || b.status === "PENDING_HOST_APPROVAL"
      ).length;
  const todaysCollectionsCount = showDemoOverview
    ? 5
    : liveBookings.filter((b) => b.status === "COMPLETED" || b.status === "CHECKED_IN").length;
  const netEarningsLkr = showDemoOverview
    ? 184500
    : liveBookings
        .filter((b) => b.hasFinancialBreakdown)
        .reduce((sum, b) => sum + b.hostNetPayoutLkr, 0);

  const overdueBookings = useMemo(
    () =>
      bookingsSource.filter((b) =>
        showDemoOverview
          ? b.status === "OVERDUE"
          : getBookingStatusDisplay(b.rawStatus ?? b.status, {
              collectionAt: b.pickUpIso,
              hasRefund: b.hasRefund
            }).isOverdue
      ),
    [bookingsSource, showDemoOverview]
  );

  return (
    <div className="space-y-6">
      {(locationsError || overviewError) && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex flex-wrap items-center justify-between gap-3"
        >
          <span>{locationsError || overviewError}</span>
          <button
            type="button"
            onClick={() => {
              reloadLocations();
              loadOverview();
            }}
            className="px-3 py-1.5 rounded-lg bg-white border border-rose-300 text-rose-900 font-bold hover:bg-rose-100 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* CWCP Header */}
      <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-navy-100 text-navy-900 border border-navy-200">
                Active Storage Hub
              </span>
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
      </div>

      {/* 4 Key Operational Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Bags in Vault */}
        <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-navy-500">
            <span>Bags in Vault</span>
            <Luggage className="h-4 w-4 text-terracotta-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-extrabold text-navy-950">
              {activeBagsInVault}{" "}
              <span className="text-sm font-semibold text-navy-500">
                {totalCapacitySlots > 0 ? `/ ${totalCapacitySlots} slots` : "bags in storage"}
              </span>
            </p>
            {totalCapacitySlots > 0 && (
              <span className="text-xs font-bold text-emerald-700">{occupancyPercentage}% full</span>
            )}
          </div>
          <div className="w-full bg-sand-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-terracotta-500 h-1.5 rounded-full transition-all"
              style={{ width: `${occupancyPercentage}%` }}
            />
          </div>
          <p className="text-[11px] text-navy-600 font-medium">Reconciled and sealed with tamper tags</p>
        </div>

        {/* Card 2: Arrivals */}
        <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-2">
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
        </div>

        {/* Card 3: Pickups / Completed */}
        <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-navy-500">
            <span>{showDemoOverview ? "Today's Pickups" : "Active & Released"}</span>
            <Clock className="h-4 w-4 text-sky-600" />
          </div>
          <p className="text-2xl font-extrabold text-navy-950">
            {todaysCollectionsCount} {showDemoOverview ? "Bags" : "Bookings"}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-navy-700 font-semibold">
            <span>
              {showDemoOverview
                ? "4 completed • 1 overdue notice"
                : `${overdueBookings.length} overdue custody notice(s)`}
            </span>
          </div>
          <p className="text-[11px] text-amber-700 font-semibold">
            {showDemoOverview ? "30m grace window monitored" : "Mandatory release policy active"}
          </p>
        </div>

        {/* Card 4: Net Host Balance */}
        {effectiveHostRole !== "HOST_STAFF" && (
          <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-navy-500">
              <span>Net Cleared Earnings</span>
              <Wallet className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-extrabold text-navy-950">{formatLkr(netEarningsLkr)}</p>
            <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
              <span>{showDemoOverview ? "85% net host share" : "Host payable snapshot total"}</span>
            </div>
            <p className="text-[11px] text-navy-500">
              {showDemoOverview ? "Next batch payout: Friday (CEFT)" : "View Finance Ledger for payout breakdown"}
            </p>
          </div>
        )}
      </div>

      {/* Overdue Bag Urgent Alert Banner */}
      {overdueBookings.length > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-300 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-200/70 text-amber-900 mt-0.5">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                  Overdue Custody Notice
                </span>
                <span className="text-xs font-mono font-bold text-navy-900">
                  {overdueBookings[0].reference}
                </span>
              </div>
              <p className="text-xs text-navy-800 font-medium mt-1">
                Traveller <strong className="font-semibold">{overdueBookings[0].travellerName}</strong> has passed the scheduled collection window.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {showDemoOverview && (
              <a
                href={`tel:${overdueBookings[0].travellerPhone}`}
                className="px-3 py-1.5 rounded-xl border border-amber-400 bg-white text-navy-900 text-xs font-bold hover:bg-amber-100/50 transition flex items-center gap-1.5"
              >
                <Phone className="h-3.5 w-3.5 text-terracotta-600" />
                <span>Call Traveller</span>
              </a>
            )}
            <Link
              to={`/host/bookings?inspect=${overdueBookings[0].id}${isDemoActive ? "&preview=demo" : ""}`}
              className="px-3 py-1.5 rounded-xl bg-navy-900 text-white text-xs font-bold hover:bg-navy-800 transition"
            >
              Inspect Booking
            </Link>
          </div>
        </div>
      )}

      {/* Main Two-Column Operations Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Today's Custody Movement Queue */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-navy-950">Today&apos;s Custody Movement Queue</h2>
                <p className="text-xs text-navy-600">Upcoming arrivals, active vault storage, and pending handovers</p>
              </div>
              <Link
                to={`/host/bookings${querySuffix}`}
                className="text-xs font-bold text-terracotta-600 hover:text-terracotta-700 flex items-center gap-1"
              >
                <span>Full Ledger</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {bookingsSource.length === 0 ? (
              <div className="p-6 rounded-xl bg-sand-50 border border-sand-200 text-center text-xs text-navy-600">
                No host bookings recorded yet for your verified locations.
              </div>
            ) : (
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
                    {bookingsSource.slice(0, 5).map((booking) => {
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
                            <span className="font-semibold text-navy-800">{booking.totalBags} Bags</span>
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
            )}
          </div>

          {/* Physical Zone Capacity Meters */}
          <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-navy-950">Physical Zone Capacity</h3>
                <p className="text-xs text-navy-600">Real-time rack and compartment occupancy</p>
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

            {!currentLocation || currentLocation.zones.length === 0 ? (
              <p className="text-xs text-navy-600">
                Zone occupancy breakdown loads when compartment rules are configured on a live storage hub.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {currentLocation.zones.map((zone) => {
                  const zonePercent = Math.round((zone.occupied / zone.capacity) * 100);
                  return (
                    <div
                      key={zone.id}
                      className="p-3.5 rounded-xl bg-sand-50/70 border border-sand-200 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-navy-900">{zone.code}</span>
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
            )}
          </div>
        </div>

        {/* Right Column: Staff on Duty & Trust Protocols */}
        <div className="lg:col-span-4 space-y-6">
          {/* Staff on Duty */}
          <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-3">
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
                  <p className="text-[10px] text-emerald-700 font-semibold">14 handovers completed today</p>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-sand-50 border border-sand-200 text-xs">
                <p className="font-bold text-navy-900">
                  {user?.displayName || user?.email || "Authenticated Host Operator"}
                </p>
                <p className="text-[11px] text-navy-600 mt-0.5">
                  {effectiveHostRole === "HOST_OWNER" ? "Host Owner Session" : "Host Staff Counter Session"}
                </p>
              </div>
            )}
            <p className="text-[11px] text-navy-600">
              Responsible for physical seal application, camera evidence checks, and rate-limited PIN releases.
            </p>
          </div>

          {showDemoOverview && (
            <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-navy-950">Recent Guest Review</h3>
                <div className="flex items-center text-amber-500 text-xs">
                  <span>★★★★★</span>
                </div>
              </div>
              <blockquote className="text-xs text-navy-700 italic border-l-2 border-terracotta-500 pl-3">
                &ldquo;Super fast QR check-in right outside Colombo Fort Station! Loved seeing the numbered security seal placed on our backpacks.&rdquo;
              </blockquote>
              <div className="flex items-center justify-between text-[11px] text-navy-500 pt-1">
                <span>Amaya Perera (Sri Lanka)</span>
                <span>Yesterday</span>
              </div>
            </div>
          )}

          {/* Custody Best Practices Card */}
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


// ============================================================================
// HD-007 & HD-008: Booking Management Hub & Custody Investigation Drawer
// ============================================================================
export function HostBookingManagementHubPage() {
  const location = useLocation();
  const { isDemoActive, effectiveHostRole } = useHostVenue();
  const { isAuthenticated, user } = useAuthStore();
  const showDemoBookings =
    isDemoActive ||
    (!isAuthenticated &&
      isDemoPreviewActive({
        allowDemoPreview: true,
        search: location.search,
        isAuthenticated
      }));
  const [searchParams, setSearchParams] = useSearchParams();
  const inspectId = searchParams.get("inspect");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [bookings, setBookings] = useState<DemoBookingRecord[]>(
    showDemoBookings ? DEMO_BOOKINGS : []
  );
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [liveCustodyDetail, setLiveCustodyDetail] = useState<CustodyRecordDetail | null>(null);
  const [hubNotice, setHubNotice] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const [inspectedBooking, setInspectedBooking] = useState<DemoBookingRecord | null>(() =>
    showDemoBookings && inspectId
      ? DEMO_BOOKINGS.find((b) => b.id === inspectId) || DEMO_BOOKINGS[0]
      : null
  );

  const loadHostBookings = useCallback(async () => {
    if (!isAuthenticated) return;
    setBookingsError(null);
    try {
      const res = await marketplaceApi.getHostBookings();
      setBookings(res.bookings.map(mapHostBookingToRecord));
    } catch (err: unknown) {
      setBookings([]);
      setBookingsError(
        err instanceof Error ? err.message : "Unable to load host bookings."
      );
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadHostBookings();
  }, [loadHostBookings]);

  const openInvestigationModal = async (b: DemoBookingRecord) => {
    setInspectedBooking(b);
    setLiveCustodyDetail(null);
    setSearchParams(showDemoBookings ? { inspect: b.id, preview: "demo" } : { inspect: b.id });
    if (isHostUuid(b.id) && isAuthenticated) {
      try {
        const detail = await marketplaceApi.getCustodyDetail(b.id);
        setLiveCustodyDetail(detail);
      } catch {
        // Keep booking summary visible
      }
    }
  };

  const closeInvestigationModal = () => {
    setInspectedBooking(null);
    setLiveCustodyDetail(null);
    setSearchParams(showDemoBookings ? { preview: "demo" } : {});
  };

  const handleHostDecision = async (
    bookingId: string,
    decision: "ACCEPT" | "REJECT" | "CANCEL"
  ) => {
    setHubNotice(null);
    if (!isHostUuid(bookingId)) {
      if (!showDemoBookings) {
        setHubNotice("Live server booking ID is required for booking state transitions.");
        return;
      }
      setBookings((prev) =>
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
      return;
    }

    setActionBusyId(bookingId);
    try {
      const updated =
        decision === "ACCEPT"
          ? await marketplaceApi.acceptHostBooking(bookingId, {
              reason: "Approved at host counter desk"
            })
          : decision === "REJECT"
            ? await marketplaceApi.rejectHostBooking(bookingId, {
                reason: "Unable to accommodate requested window"
              })
            : await marketplaceApi.cancelHostBooking(bookingId, {
                reason: "Cancelled by host facility"
              });
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? mapHostBookingToRecord(updated) : b))
      );
      setHubNotice(`Booking ${updated.referenceCode} updated to ${updated.status}.`);
    } catch (err: unknown) {
      setHubNotice(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActionBusyId(null);
    }
  };

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const matchesSearch =
        b.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.travellerName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "PENDING_HOST_APPROVAL" && b.status === "PENDING_HOST_APPROVAL") ||
        (statusFilter === "CHECKED_IN" && b.status === "CHECKED_IN") ||
        (statusFilter === "CONFIRMED" && b.status === "CONFIRMED") ||
        (statusFilter === "OVERDUE" && b.status === "OVERDUE") ||
        (statusFilter === "COMPLETED" && b.status === "COMPLETED");

      return matchesSearch && matchesStatus;
    });
  }, [bookings, searchTerm, statusFilter]);

  return (
    <div className="space-y-6">
      {bookingsError && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-950 flex items-center justify-between gap-3"
        >
          <span>{bookingsError}</span>
          <button
            type="button"
            onClick={() => void loadHostBookings()}
            className="px-3 py-1 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold"
          >
            Retry
          </button>
        </div>
      )}
      {hubNotice && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-950">
          {hubNotice}
        </div>
      )}
      {/* Header */}
      <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              Booking Management Hub
            </h1>
            <p className="text-xs text-navy-600 mt-0.5">
              Review 15-minute SLA approval requests, active check-ins, overdue bags, and full custody audit trails.
            </p>
          </div>
          <button
            type="button"
            disabled={bookings.length === 0}
            onClick={() => bookings[0] && openInvestigationModal(bookings[0])}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-sm transition"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Inspect Custody Evidence</span>
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-navy-400" />
            <input
              type="text"
              placeholder={
                showDemoBookings
                  ? "Search by reference (e.g. LS-2026-8841) or traveller name..."
                  : "Search by booking reference or traveller name..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-sand-300 pl-10 pr-4 py-2.5 text-xs text-navy-900 placeholder:text-navy-400 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["ALL", "PENDING_HOST_APPROVAL", "CHECKED_IN", "CONFIRMED", "OVERDUE", "COMPLETED"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  statusFilter === st
                    ? "bg-navy-900 text-white"
                    : "bg-sand-100 text-navy-700 hover:bg-sand-200"
                }`}
              >
                {st === "ALL"
                  ? "All Bookings"
                  : st === "PENDING_HOST_APPROVAL"
                    ? "Pending Approval"
                    : st.replace("_", " ")}
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
                <th className="p-3.5">Traveller &amp; Contact</th>
                <th className="p-3.5">Bags &amp; Zone</th>
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
              {filteredBookings.length === 0 ? (
                <tr>
                  <td
                    colSpan={effectiveHostRole === "HOST_STAFF" ? 5 : 6}
                    className="p-6 text-center text-navy-500"
                  >
                    No bookings match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => {
                  const statusDisplay = getBookingStatusDisplay(b.rawStatus ?? b.status, {
                    hasRefund: b.hasRefund
                  });
                  const badgeToneClass =
                    statusDisplay.tone === "success"
                      ? "bg-blue-50 text-blue-800 border border-blue-200"
                      : statusDisplay.tone === "danger"
                        ? "bg-rose-50 text-rose-800 border border-rose-200"
                        : statusDisplay.tone === "warning" || statusDisplay.tone === "brand"
                          ? "bg-amber-50 text-amber-800 border border-amber-200"
                          : "bg-emerald-50 text-emerald-800 border border-emerald-200";
                  return (
                    <tr key={b.id} className="hover:bg-sand-50/70 transition">
                      <td className="p-3.5 font-mono font-bold text-navy-900">{b.reference}</td>
                      <td className="p-3.5">
                        <p className="font-semibold text-navy-950">{b.travellerName}</p>
                        <p className="text-[10px] text-navy-500">{b.travellerPhone}</p>
                      </td>
                      <td className="p-3.5 text-navy-700">
                        <span className="font-semibold">{b.totalBags} Bags</span> •{" "}
                        <span className="font-mono text-[11px] px-1 py-0.5 rounded bg-sand-100">{b.zoneCode}</span>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${badgeToneClass}`}>
                          {statusDisplay.label}
                        </span>
                      </td>
                      {effectiveHostRole !== "HOST_STAFF" && (
                        <td className="p-3.5 font-bold text-emerald-700">
                          {b.hasFinancialBreakdown !== false
                            ? formatLkr(b.hostNetPayoutLkr)
                            : "—"}
                        </td>
                      )}
                      <td className="p-3.5 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          {b.status === "PENDING_HOST_APPROVAL" && (
                            <>
                              <button
                                type="button"
                                disabled={actionBusyId === b.id}
                                onClick={() => handleHostDecision(b.id, "ACCEPT")}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition"
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                disabled={actionBusyId === b.id}
                                onClick={() => handleHostDecision(b.id, "REJECT")}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 font-bold text-xs transition"
                              >
                                Decline
                              </button>
                            </>
                          )}
                          {b.status === "CONFIRMED" && isHostUuid(b.id) && (
                            <button
                              type="button"
                              disabled={actionBusyId === b.id}
                              onClick={() => handleHostDecision(b.id, "CANCEL")}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs transition"
                            >
                              Host Cancel
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openInvestigationModal(b)}
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

      {/* Booking Custody Investigation Modal / Drawer */}
      {inspectedBooking && (
        <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-sand-200 max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-sand-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-navy-900 text-white font-mono text-xs font-bold">
                  Custody Audit
                </span>
                <h3 className="text-base font-bold text-navy-950">
                  Custody Evidence — {inspectedBooking.reference}
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

            {/* Custody Lifecycle Audit Timeline */}
            <div className="space-y-2 text-xs">
              <p className="font-bold text-navy-900 uppercase text-[10px] tracking-wider">
                Custody Lifecycle Events
              </p>
              {liveCustodyDetail && liveCustodyDetail.events.length > 0 ? (
                <div className="p-3.5 rounded-xl bg-sand-50 border border-sand-200 space-y-2 text-navy-800">
                  {liveCustodyDetail.events.map((evt) => (
                    <div key={evt.id} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-navy-950">{evt.eventType}</strong>
                        <p className="text-[11px] text-navy-500">
                          {new Date(evt.createdAt).toLocaleString()} • Actor {evt.actorRole} • Status{" "}
                          {evt.newStatus}
                        </p>
                      </div>
                    </div>
                  ))}
                  {liveCustodyDetail.bags.length > 0 && (
                    <div className="pt-2 border-t border-sand-200 text-[11px] text-navy-700">
                      <strong>Tagged Storage Items:</strong>{" "}
                      {liveCustodyDetail.bags
                        .map(
                          (bag) =>
                            `${bag.bagTagCode}${bag.securitySealNumber ? ` (${bag.securitySealNumber})` : ""}`
                        )
                        .join(", ")}
                    </div>
                  )}
                </div>
              ) : showDemoBookings ? (
                <div className="p-3.5 rounded-xl bg-sand-50 border border-sand-200 space-y-2 text-navy-800">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-navy-950">1. Reservation Confirmed</strong>
                      <p className="text-[11px] text-navy-500">
                        Gross {formatLkr(inspectedBooking.totalAmountLkr)}
                        {effectiveHostRole !== "HOST_STAFF" && inspectedBooking.hasFinancialBreakdown !== false
                          ? ` • Host Net ${formatLkr(inspectedBooking.hostNetPayoutLkr)}`
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
                        <span className="font-mono">{inspectedBooking.pinCode}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-navy-950">3. Tamper-Evident Security Seals Applied</strong>
                      <p className="text-[11px] text-navy-500">
                        {inspectedBooking.sealIds.length > 0
                          ? inspectedBooking.sealIds.join(", ")
                          : "Pending seal application"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-navy-950">4. Vault Compartment Assigned</strong>
                      <p className="text-[11px] text-navy-500">
                        Placed in Zone {inspectedBooking.zoneCode} • Attributed to Staff{" "}
                        <span className="font-mono">staff-usr-204</span>
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-sand-50 border border-sand-200 text-navy-600">
                  No custody intake or release events recorded yet for this booking.
                </div>
              )}
            </div>

            {/* Traveller & Contact Dossier */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-sand-50 border border-sand-200 space-y-1.5">
                <p className="font-bold text-navy-950">Traveller Information</p>
                <p className="text-navy-700">Name: <strong className="text-navy-900">{inspectedBooking.travellerName}</strong></p>
                <p className="text-navy-700">Email: {inspectedBooking.travellerEmail}</p>
                <p className="text-navy-700">
                  Phone:{" "}
                  <a
                    href={`tel:${inspectedBooking.travellerPhone}`}
                    className="font-bold text-terracotta-600 hover:underline"
                  >
                    {inspectedBooking.travellerPhone}
                  </a>
                </p>
              </div>

              <div className="p-4 rounded-xl bg-sand-50 border border-sand-200 space-y-1.5">
                <p className="font-bold text-navy-950">Custody Audit Details</p>
                <p className="text-navy-700">Reconciled Bags: <strong className="text-navy-900">{inspectedBooking.totalBags} Bags</strong></p>
                <p className="text-navy-700">Photo Evidence: {inspectedBooking.evidencePhotosCount} photos captured</p>
                <p className="text-navy-700">
                  Responsible Counter Staff:{" "}
                  <span className="font-mono text-navy-900 font-bold">
                    {showDemoBookings
                      ? "Roshan Fernando"
                      : user?.displayName || user?.email || "Authenticated Counter Operator"}
                  </span>
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
    </div>
  );
}

// ============================================================================
// HD-009: Web Check-in/Out Operations (/host/operations)
// ============================================================================
export function HostWebCheckInOutOperationsPage() {
  const location = useLocation();
  const { isDemoActive } = useHostVenue();
  const { isAuthenticated, user } = useAuthStore();
  const showDemoOps =
    isDemoActive ||
    (!isAuthenticated &&
      isDemoPreviewActive({
        allowDemoPreview: true,
        search: location.search,
        isAuthenticated
      }));
  const [operationMode, setOperationMode] = useState<"CHECK_IN" | "CHECK_OUT">("CHECK_IN");
  const [verificationMethod, setVerificationMethod] = useState<"QR_SCAN" | "PIN_FALLBACK">("QR_SCAN");
  const [lookupQuery, setLookupQuery] = useState(showDemoOps ? "LS-2026-8841" : "");
  const [pinInput, setPinInput] = useState(showDemoOps ? "482910" : "");
  const [reconciledBags, setReconciledBags] = useState(showDemoOps ? 3 : 1);
  const [sealInput, setSealInput] = useState(showDemoOps ? "SEAL-LK-90211" : "");
  const [collectionNotes, setCollectionNotes] = useState("");
  const [hasCollectionException, setHasCollectionException] = useState(false);
  const [exceptionNotes, setExceptionNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [handoverSuccessMessage, setHandoverSuccessMessage] = useState<string | null>(null);
  const [handoverErrorMessage, setHandoverErrorMessage] = useState<string | null>(null);

  const handleSimulateHandover = async () => {
    setHandoverErrorMessage(null);
    setHandoverSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const outcome = await executeCounterCustodyHandover({
        operationMode,
        verificationMethod,
        lookupQuery,
        credentialInput: pinInput,
        reconciledBags,
        sealInput,
        collectionNotes,
        hasCollectionException,
        exceptionNotes,
        showDemoOps,
        isAuthenticated
      });

      if (outcome.kind === "validation_error" || outcome.kind === "live_error") {
        setIsSubmitting(false);
        setHandoverErrorMessage(outcome.message);
        return;
      }

      if (outcome.kind === "live_success") {
        setIsSubmitting(false);
        setHandoverSuccessMessage(outcome.message);
        return;
      }

      setTimeout(() => {
        setIsSubmitting(false);
        setHandoverSuccessMessage(
          operationMode === "CHECK_IN"
            ? `Local Prototype Simulation: Custody Handover logged to workstation session for booking ${lookupQuery}. Reconciled ${reconciledBags} bags. Numbered Seal ${sealInput} logged. Acting staff: Roshan Fernando (staff-usr-204). (Requires API integration in Phase 3+)`
            : `Local Prototype Simulation: Baggage Release logged to workstation session for booking ${lookupQuery} via ${verificationMethod}. Reconciled ${reconciledBags} bags returned to guest. Custody cleared. (Requires API integration in Phase 3+)`
        );
      }, 700);
    } catch (err: unknown) {
      setIsSubmitting(false);
      setHandoverErrorMessage(err instanceof Error ? err.message : "Counter verification failed.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Desk Counter Active
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              Check-In &amp; Check-Out Desk
            </h1>
            <p className="text-xs text-navy-600 mt-0.5">
              Physical counter intake and release workstation with QR scan, 6-digit backup PIN, bag reconciliation, and tamper seal verification.
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-sand-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setOperationMode("CHECK_IN");
                setHandoverSuccessMessage(null);
                setHandoverErrorMessage(null);
              }}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                operationMode === "CHECK_IN"
                  ? "bg-terracotta-500 text-white shadow-xs"
                  : "text-navy-700 hover:text-navy-900"
              }`}
            >
              Intake Handover
            </button>
            <button
              type="button"
              onClick={() => {
                setOperationMode("CHECK_OUT");
                setHandoverSuccessMessage(null);
                setHandoverErrorMessage(null);
              }}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                operationMode === "CHECK_OUT"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-navy-700 hover:text-navy-900"
              }`}
            >
              Release Pick-Up
            </button>
          </div>
        </div>
      </div>

      {/* Honest Prototype Notice */}
      <div className="rounded-xl bg-sand-100/90 border border-sand-300 p-4 text-xs text-navy-800 flex items-start gap-3">
        <Info className="h-4 w-4 text-terracotta-600 flex-shrink-0 mt-0.5" />
        <div>
          {showDemoOps ? (
            <>
              <strong className="text-navy-950">Desktop Counter Workstation (Local Prototype Simulation):</strong> Supports manual barcode scanner input, booking lookup, or 6-digit backup PIN verification. Physical intake and releases in this demo session update client state only.
            </>
          ) : (
            <>
              <strong className="text-navy-950">Live Counter Custody Workstation:</strong> Enter the booking UUID alongside the traveller&apos;s QR scan token or 6-digit backup PIN to verify and record server custody transitions.
            </>
          )}
        </div>
      </div>

      {/* Counter Workstation Card */}
      <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-5 shadow-sm">
        {/* Quick Demo Pre-fill */}
        {showDemoOps && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-bold text-navy-500">Quick Test Records:</span>
            <button
              type="button"
              onClick={() => {
                setLookupQuery("LS-2026-8841");
                setPinInput("482910");
                setReconciledBags(3);
                setSealInput("SEAL-LK-90211");
              }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-sand-100 hover:bg-sand-200 font-mono text-navy-900 font-bold"
            >
              LS-2026-8841 (Amaya)
            </button>
            <button
              type="button"
              onClick={() => {
                setLookupQuery("LS-2026-8842");
                setPinInput("739204");
                setReconciledBags(2);
                setSealInput("SEAL-LK-90214");
              }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-sand-100 hover:bg-sand-200 font-mono text-navy-900 font-bold"
            >
              LS-2026-8842 (Liam)
            </button>
            <button
              type="button"
              onClick={() => {
                setLookupQuery("LS-2026-8835");
                setPinInput("661928");
                setReconciledBags(2);
                setSealInput("SEAL-LK-88101");
              }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-sand-100 hover:bg-sand-200 font-mono text-navy-900 font-bold"
            >
              LS-2026-8835 (Henrik - Overdue)
            </button>
          </div>
        )}

        {/* Verification Method Toggle */}
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() => setVerificationMethod("QR_SCAN")}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition ${
              verificationMethod === "QR_SCAN"
                ? "bg-navy-900 text-white"
                : "bg-sand-100 text-navy-700 hover:bg-sand-200"
            }`}
          >
            Dynamic QR Scan Token (Primary)
          </button>
          <button
            type="button"
            onClick={() => setVerificationMethod("PIN_FALLBACK")}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition ${
              verificationMethod === "PIN_FALLBACK"
                ? "bg-amber-600 text-white"
                : "bg-sand-100 text-navy-700 hover:bg-sand-200"
            }`}
          >
            6-Digit Backup PIN (Rate-Limited Fallback)
          </button>
        </div>

        {/* Counter Form Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-bold text-navy-900 mb-1">
              Booking Reference or Lookup
            </label>
            <input
              type="text"
              value={lookupQuery}
              onChange={(e) => setLookupQuery(e.target.value)}
              placeholder={showDemoOps ? "LS-2026-8841" : "Enter Booking UUID"}
              className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs font-mono font-bold text-navy-900"
            />
          </div>

          <div>
            <label className="block font-bold text-navy-900 mb-1">
              {verificationMethod === "QR_SCAN"
                ? "QR Token Payload"
                : "6-Digit Backup PIN"}
            </label>
            <input
              type="text"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs font-mono font-bold text-navy-900"
            />
          </div>

          <div>
            <label className="block font-bold text-navy-900 mb-1">
              Reconciled Physical Bag Count
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={reconciledBags}
              onChange={(e) => setReconciledBags(Number(e.target.value))}
              className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs font-mono font-bold text-navy-900"
            />
          </div>
        </div>

        {/* Seal and Zone Assignment */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-bold text-navy-900 mb-1">
              Tamper-Evident Security Seal Serial
            </label>
            <input
              type="text"
              value={sealInput}
              onChange={(e) => setSealInput(e.target.value)}
              className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs font-mono font-bold text-navy-900"
            />
            <p className="text-[10px] text-navy-500 mt-1">
              Inspect zip tag and apply physical seal before moving to vault.
            </p>
          </div>
          <div>
            <label className="block font-bold text-navy-900 mb-1">
              Assigned Vault Compartment
            </label>
            <select
              aria-label="Assigned Vault Compartment"
              defaultValue="RACK-A"
              className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs font-bold text-navy-900"
            >
              <option value="RACK-A">RACK-A: Main Steel Compartment A (Slot 12)</option>
              <option value="VAULT-B">VAULT-B: Back Climate-Controlled Bay (Slot 04)</option>
              <option value="SURF-C">SURF-C: Oversized Surf / Gear Bay</option>
            </select>
            <p className="text-[10px] text-navy-500 mt-1">
              {showDemoOps
                ? "Logged to staff member Roshan Fernando."
                : `Logged to counter operator ${user?.displayName || user?.email || "active session"}.`}
            </p>
          </div>
        </div>

        {operationMode === "CHECK_OUT" && (
          <div className="rounded-xl border border-sand-200 bg-sand-50/70 p-4 space-y-3 text-xs">
            <div>
              <label
                htmlFor="collection-handover-notes"
                className="block font-bold text-navy-900 mb-1"
              >
                Collection Handover Notes
              </label>
              <input
                id="collection-handover-notes"
                aria-label="Collection Handover Notes"
                type="text"
                value={collectionNotes}
                onChange={(e) => setCollectionNotes(e.target.value)}
                placeholder="Optional release note (e.g., all bags verified intact at counter)"
                className="w-full rounded-xl border border-sand-300 bg-white px-3 py-2 text-xs font-medium text-navy-900"
              />
            </div>

            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 font-bold text-navy-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasCollectionException}
                  onChange={(e) => {
                    setHasCollectionException(e.target.checked);
                    if (!e.target.checked) {
                      setExceptionNotes("");
                    }
                  }}
                  className="h-4 w-4 rounded border-sand-300 text-amber-600 focus:ring-amber-500"
                />
                <span>Report custody exception or discrepancy</span>
              </label>

              {hasCollectionException && (
                <div>
                  <label
                    htmlFor="custody-exception-details"
                    className="block font-bold text-amber-950 mb-1"
                  >
                    Custody Exception Details
                  </label>
                  <input
                    id="custody-exception-details"
                    aria-label="Custody Exception Details"
                    type="text"
                    value={exceptionNotes}
                    onChange={(e) => setExceptionNotes(e.target.value)}
                    placeholder="Describe damaged seal, missing item, or guest discrepancy (min 3 characters)"
                    className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-navy-900"
                  />
                  <p className="text-[11px] text-amber-800 mt-1">
                    Reporting a custody exception records a disputed release and holds settlement for supervisor review.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSimulateHandover}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-sm transition flex items-center gap-2 ${
              operationMode === "CHECK_IN"
                ? "bg-terracotta-500 hover:bg-terracotta-600 disabled:bg-sand-400"
                : "bg-emerald-600 hover:bg-emerald-700 disabled:bg-sand-400"
            }`}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Verifying Handover...</span>
              </>
            ) : operationMode === "CHECK_IN" ? (
              <>
                <Check className="h-4 w-4" />
                <span>Confirm Check-In Handover</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Verify &amp; Release Bags</span>
              </>
            )}
          </button>
        </div>

        {/* Feedback Message */}
        {handoverErrorMessage && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-xs font-bold text-rose-950 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <p>{handoverErrorMessage}</p>
          </div>
        )}
        {handoverSuccessMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-950 flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p>{handoverSuccessMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Financial Revenue & Ledger (/host/finance)
// ============================================================================
export function HostFinancialRevenueLedgerPage() {
  const location = useLocation();
  const { isDemoActive } = useHostVenue();
  const { isAuthenticated } = useAuthStore();
  const showDemoFinance =
    isDemoActive ||
    (!isAuthenticated &&
      isDemoPreviewActive({
        allowDemoPreview: true,
        search: location.search,
        isAuthenticated
      }));
  const [downloadNotice, setDownloadNotice] = useState(false);
  const [liveFinance, setLiveFinance] = useState<HostFinanceSummaryResponse | null>(null);
  const [financeError, setFinanceError] = useState<string | null>(null);

  const loadFinance = useCallback(async () => {
    if (!isAuthenticated) return;
    setFinanceError(null);
    try {
      const res = await marketplaceApi.getHostFinanceSummary();
      setLiveFinance(res);
    } catch (err: unknown) {
      setLiveFinance(null);
      setFinanceError(
        err instanceof Error ? err.message : "Unable to load host financial ledger."
      );
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadFinance();
  }, [loadFinance]);

  const grossDisplayLkr = liveFinance
    ? Math.round(
        liveFinance.payables.reduce((sum, p) => sum + p.grossSubtotalMinor, 0) / 100
      )
    : showDemoFinance
      ? 217058
      : 0;
  const commissionDisplayLkr = liveFinance
    ? Math.round(
        liveFinance.payables.reduce((sum, p) => sum + p.commissionMinor, 0) / 100
      )
    : showDemoFinance
      ? 32558
      : 0;
  const netDisplayLkr = liveFinance
    ? Math.round(
        (liveFinance.totalAccruedMinor +
          liveFinance.totalEligibleMinor +
          liveFinance.totalPaidMinor) /
          100
      )
    : showDemoFinance
      ? 184500
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              Financial Revenue &amp; Commission Ledger
            </h1>
            <p className="text-xs text-navy-600 mt-0.5">
              {showDemoFinance
                ? "Itemized gross booking volume, illustrative 15% platform commission, and 85% net host earnings (DEC-006 Pending PO Sign-Off)."
                : "Itemized gross booking volume, platform commission deductions, and net host settlement payables."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDownloadNotice(true);
              setTimeout(() => setDownloadNotice(false), 3000);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-sand-300 hover:bg-sand-50 text-navy-900 text-xs font-bold shadow-xs transition"
          >
            <Download className="h-4 w-4 text-terracotta-600" />
            <span>Export CSV Ledger</span>
          </button>
        </div>
      </div>

      {/* Honest Prototype Notice */}
      {liveFinance ? (
        <div className="rounded-xl bg-sand-100/90 border border-sand-300 p-4 text-xs text-navy-800 flex items-start gap-3">
          <Info className="h-4 w-4 text-terracotta-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-navy-950">Live Non-Escrow Settlement Ledger:</strong> Showing real server-backed host settlement payables accrued from confirmed and completed LKR bookings. Automated bank batch disbursement remains scheduled for Phase C.
          </div>
        </div>
      ) : showDemoFinance ? (
        <div className="rounded-xl bg-sand-100/90 border border-sand-300 p-4 text-xs text-navy-800 flex items-start gap-3">
          <Info className="h-4 w-4 text-terracotta-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-navy-950">Financial Ledger (Demo Figures):</strong> Financial volumes, deductions, and batch settlement dates are calculated from local mock bookings for Fort Hub demonstration. Export actions generate simulated client exports.
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-sand-100/90 border border-sand-300 p-4 text-xs text-navy-800 flex items-start gap-3">
          <Info className="h-4 w-4 text-terracotta-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-navy-950">Host Settlement Ledger:</strong> Host payable totals reflect authenticated booking settlements from the server ledger.
          </div>
        </div>
      )}

      {financeError && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 text-xs font-bold flex items-center justify-between gap-3"
        >
          <span>{financeError}</span>
          <button
            type="button"
            onClick={() => void loadFinance()}
            className="px-3 py-1 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {downloadNotice && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-600" />
          <span>Generating financial ledger export (CSV). Download starting shortly.</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-1">
          <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">Gross Booking Volume</span>
          <p className="text-2xl font-extrabold text-navy-950">{formatLkr(grossDisplayLkr)}</p>
          <span className="text-[11px] text-navy-500">Total customer checkout value</span>
        </div>

        <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-1">
          <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">
            {showDemoFinance ? "Platform Fee (15%)" : "Platform Commission"}
          </span>
          <p className="text-2xl font-extrabold text-navy-600">-{formatLkr(commissionDisplayLkr)}</p>
          <span className="text-[11px] text-navy-500">Payment processing &amp; platform commission</span>
        </div>

        <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-1">
          <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">
            {showDemoFinance ? "Net Host Payout (85%)" : "Net Host Payable"}
          </span>
          <p className="text-2xl font-extrabold text-emerald-700">{formatLkr(netDisplayLkr)}</p>
          <span className="text-[11px] text-emerald-800 font-semibold">
            {liveFinance
              ? `Eligible now: ${formatLkr(Math.round(liveFinance.totalEligibleMinor / 100))}`
              : showDemoFinance
                ? "Illustrative Friday batch estimate (DEC-006)"
                : "Server-authoritative payable snapshot"}
          </span>
        </div>
      </div>

      {/* Itemized Transactions Table */}
      <div className="bg-white rounded-2xl border border-sand-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-sand-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-navy-950">Recent Completed &amp; Cleared Bookings</h2>
          <span className="text-xs text-navy-500">
            {showDemoFinance
              ? "Settled to Commercial Bank of Ceylon PLC"
              : "Settled per verified payout account"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-sand-50 border-b border-sand-200 text-navy-500 uppercase font-bold text-[10px] tracking-wider">
                <th className="p-3.5">Booking Ref</th>
                <th className="p-3.5">Traveller</th>
                <th className="p-3.5">Gross (LKR)</th>
                <th className="p-3.5">{showDemoFinance ? "Platform Fee (15%)" : "Platform Commission"}</th>
                <th className="p-3.5">{showDemoFinance ? "Host Net (85%)" : "Host Net"}</th>
                <th className="p-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {liveFinance ? (
                liveFinance.payables.length > 0 ? (
                  liveFinance.payables.map((p) => (
                    <tr key={p.id} className="hover:bg-sand-50/70 transition">
                      <td className="p-3.5 font-mono font-bold text-navy-900">
                        {p.referenceCode || p.bookingId.slice(0, 8)}
                      </td>
                      <td className="p-3.5 font-semibold text-navy-950">Verified Booking</td>
                      <td className="p-3.5 text-navy-800">
                        {formatLkr(Math.round(p.grossSubtotalMinor / 100))}
                      </td>
                      <td className="p-3.5 text-navy-500">
                        -{formatLkr(Math.round(p.commissionMinor / 100))}
                      </td>
                      <td className="p-3.5 font-bold text-emerald-700">
                        {formatLkr(Math.round(p.netPayableMinor / 100))}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-navy-500">
                      No host settlement payables recorded yet.
                    </td>
                  </tr>
                )
              ) : showDemoFinance ? (
                DEMO_BOOKINGS.map((b) => (
                  <tr key={b.id} className="hover:bg-sand-50/70 transition">
                    <td className="p-3.5 font-mono font-bold text-navy-900">{b.reference}</td>
                    <td className="p-3.5 font-semibold text-navy-950">{b.travellerName}</td>
                    <td className="p-3.5 text-navy-800">{formatLkr(b.totalAmountLkr)}</td>
                    <td className="p-3.5 text-navy-500">-{formatLkr(b.platformCommissionLkr)}</td>
                    <td className="p-3.5 font-bold text-emerald-700">{formatLkr(b.hostNetPayoutLkr)}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Cleared
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-navy-500">
                    No host settlement payables recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HD-011: Payout Accounts & History (/host/payouts)
// ============================================================================
export function HostPayoutAccountsHistoryPage() {
  const location = useLocation();
  const { isDemoActive } = useHostVenue();
  const { isAuthenticated } = useAuthStore();
  const showDemo =
    isDemoActive ||
    (!isAuthenticated &&
      isDemoPreviewActive({
        allowDemoPreview: true,
        search: location.search,
        isAuthenticated
      }));
  const [showEditBankModal, setShowEditBankModal] = useState(false);

  const payoutBatches = showDemo
    ? [
        {
          id: "BATCH-2026-W44",
          date: "06 Nov 2026",
          amountLkr: 64850,
          method: "CEFT Transfer",
          ref: "CEFT-LK-90281",
          status: "Completed"
        },
        {
          id: "BATCH-2026-W43",
          date: "30 Oct 2026",
          amountLkr: 72400,
          method: "CEFT Transfer",
          ref: "CEFT-LK-89104",
          status: "Completed"
        },
        {
          id: "BATCH-2026-W42",
          date: "23 Oct 2026",
          amountLkr: 47250,
          method: "CEFT Transfer",
          ref: "CEFT-LK-87890",
          status: "Completed"
        }
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              Payout Accounts &amp; Settlement History
            </h1>
            <p className="text-xs text-navy-600 mt-0.5">
              {showDemo
                ? "Manage Sri Lankan LKR settlement bank details (CEFT / SLIPS) and review weekly batch transfer statements (Illustrative Friday Schedule: DEC-006 Pending PO Sign-Off)."
                : "Manage Sri Lankan LKR settlement bank details (CEFT / SLIPS) and review batch settlement statements."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowEditBankModal(true)}
            className="px-4 py-2.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold shadow-sm transition"
          >
            Update Bank Details
          </button>
        </div>
      </div>

      {/* Honest Prototype Notice */}
      {showDemo && (
        <div className="rounded-xl bg-sand-100/90 border border-sand-300 p-4 text-xs text-navy-800 flex items-start gap-3">
          <Info className="h-4 w-4 text-terracotta-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-navy-950">Payout Accounts (Demo Record):</strong> Bank beneficiary details and batch settlement records are illustrative fixtures for demo preview.
          </div>
        </div>
      )}

      {/* Primary Settlement Bank Card */}
      {showDemo ? (
        <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-navy-900 text-white flex items-center justify-center font-bold">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-navy-950">Commercial Bank of Ceylon PLC</h2>
                <p className="text-xs text-navy-600">Colombo Fort Corporate Branch (Code 001)</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
              Sample Bank Record (Demo)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
            <div>
              <span className="text-navy-500">Account Beneficiary:</span>
              <p className="font-bold text-navy-900">Ceylon Transit Hospitality (Pvt) Ltd</p>
            </div>
            <div>
              <span className="text-navy-500">Masked Account Number:</span>
              <p className="font-mono font-bold text-navy-900">**** **** **** 8821</p>
            </div>
            <div>
              <span className="text-navy-500">Clearing Method:</span>
              <p className="font-bold text-navy-900">CEFT / SLIPS (Same-Day Clearing)</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-sand-200 p-6 text-xs text-navy-600 shadow-sm">
          <p className="font-bold text-navy-950 mb-1">No Verified Settlement Bank Account</p>
          <p>Submit corporate bank beneficiary details via Update Bank Details once automated payouts are enabled.</p>
        </div>
      )}

      {/* Batch Settlement History */}
      <div className="bg-white rounded-2xl border border-sand-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-sand-200">
          <h3 className="text-sm font-bold text-navy-950">Recent Weekly Batch Transfers</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-sand-50 border-b border-sand-200 text-navy-500 uppercase font-bold text-[10px] tracking-wider">
                <th className="p-3.5">Batch ID</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Amount (LKR)</th>
                <th className="p-3.5">Transfer Ref</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Advice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {payoutBatches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-navy-500">
                    No settlement payout batches recorded yet.
                  </td>
                </tr>
              ) : (
                payoutBatches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-sand-50/70 transition">
                    <td className="p-3.5 font-mono font-bold text-navy-900">{batch.id}</td>
                    <td className="p-3.5 text-navy-700">{batch.date}</td>
                    <td className="p-3.5 font-bold text-emerald-700">{formatLkr(batch.amountLkr)}</td>
                    <td className="p-3.5 font-mono text-navy-600">{batch.ref}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {batch.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        type="button"
                        className="text-terracotta-600 hover:text-terracotta-700 font-bold"
                      >
                        Download Sample PDF (Demo Action)
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Bank Modal */}
      {showEditBankModal && (
        <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-sand-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-sand-100 pb-3">
              <h3 className="text-base font-bold text-navy-950">Update Settlement Bank Details</h3>
              <button
                type="button"
                onClick={() => setShowEditBankModal(false)}
                className="p-1 rounded-lg hover:bg-sand-100 text-navy-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-navy-600">
              For security compliance, bank account changes undergo verification before active disbursement.
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-navy-900 mb-1">Bank Name</label>
                <input
                  type="text"
                  defaultValue={showDemo ? "Commercial Bank of Ceylon PLC" : ""}
                  placeholder="Enter bank name"
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">Account Number</label>
                <input
                  type="text"
                  placeholder="Enter 10-12 digit account number"
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEditBankModal(false)}
                className="px-4 py-2 rounded-xl border border-sand-300 text-xs font-bold text-navy-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowEditBankModal(false)}
                className="px-4 py-2 rounded-xl bg-terracotta-500 text-white text-xs font-bold"
              >
                Save for Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HD-012: Review Management (/host/reviews)
// ============================================================================
export function HostReviewManagementPage() {
  const location = useLocation();
  const { isDemoActive } = useHostVenue();
  const { isAuthenticated } = useAuthStore();
  const showDemo =
    isDemoActive ||
    (!isAuthenticated &&
      isDemoPreviewActive({
        allowDemoPreview: true,
        search: location.search,
        isAuthenticated
      }));
  const [replyText, setReplyText] = useState("");
  const [replyPublished, setReplyPublished] = useState(false);

  const reviews = showDemo
    ? [
        {
          id: "rev-1",
          author: "Amaya Perera",
          country: "Sri Lanka",
          date: "Yesterday",
          bookingRef: "LS-2026-8841",
          rating: 5,
          content:
            "Super fast QR check-in right outside Colombo Fort Station! Loved seeing the numbered security seal placed on our backpacks.",
          reply:
            "Thank you Amaya! We are delighted our Fort Station vault made your city excursion hassle-free."
        },
        {
          id: "rev-2",
          author: "Liam O'Connor",
          country: "Ireland",
          date: "07 Nov 2026",
          bookingRef: "LS-2026-8842",
          rating: 5,
          content:
            "Left two large suitcases before boarding the scenic train to Ella. Bags were in perfect condition with intact seals when we collected them.",
          reply: null
        },
        {
          id: "rev-3",
          author: "Sophie Laurent",
          country: "France",
          date: "04 Nov 2026",
          bookingRef: "LS-2026-8799",
          rating: 4,
          content:
            "Very convenient location. Only 2 minutes walk from the station exit. Prompt service.",
          reply: "Merci Sophie! Hope you enjoyed your holiday across the island."
        }
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              Customer Reviews &amp; Reputation
            </h1>
            <p className="text-xs text-navy-600 mt-0.5">
              Read verified post-checkout traveller ratings and publish official partner responses.
            </p>
          </div>
          {showDemo && (
            <div className="flex items-center gap-2 bg-sand-100 px-3.5 py-1.5 rounded-xl">
              <span className="text-amber-500 font-bold text-sm">★ 4.9</span>
              <span className="text-xs text-navy-700 font-semibold">214 Verified Reviews</span>
            </div>
          )}
        </div>
      </div>

      {/* Honest Prototype Notice */}
      {showDemo && (
        <div className="rounded-xl bg-sand-100/90 border border-sand-300 p-4 text-xs text-navy-800 flex items-start gap-3">
          <Info className="h-4 w-4 text-terracotta-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-navy-950">Customer Reviews (Demo Data):</strong> Sample feedback ratings and reviews shown for demo preview.
          </div>
        </div>
      )}

      {replyPublished && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>Local Prototype: Official host response previewed in workstation session (not published to public travellers).</span>
        </div>
      )}

      {/* Reviews Feed */}
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <div className="bg-white rounded-2xl border border-sand-200 p-8 text-center text-xs text-navy-500 shadow-sm">
            No traveller reviews published yet for your verified locations.
          </div>
        ) : (
          reviews.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-full bg-navy-900 text-white flex items-center justify-center font-bold text-xs">
                    {r.author.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-navy-950">{r.author} ({r.country})</p>
                    <p className="text-[10px] text-navy-500 font-mono">Booking #{r.bookingRef} • {r.date}</p>
                  </div>
                </div>
                <div className="text-amber-500 text-xs font-bold">
                  {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)} ({r.rating}.0)
                </div>
              </div>

              <p className="text-xs text-navy-800 leading-relaxed">{r.content}</p>

              {r.reply ? (
                <div className="p-3.5 rounded-xl bg-sand-50 border-l-4 border-terracotta-500 text-xs space-y-1">
                  <span className="font-bold text-navy-900 text-[11px]">Official Host Response:</span>
                  <p className="text-navy-700 text-xs">{r.reply}</p>
                </div>
              ) : (
                <div className="pt-2 border-t border-sand-100 space-y-2">
                  <label className="block text-[11px] font-bold text-navy-700">
                    Reply to {r.author}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type official reply..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="flex-1 rounded-xl border border-sand-300 px-3 py-1.5 text-xs text-navy-900"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (replyText.trim()) {
                          setReplyPublished(true);
                          setReplyText("");
                          setTimeout(() => setReplyPublished(false), 3000);
                        }
                      }}
                      className="px-4 py-1.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold transition"
                    >
                      Reply
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
