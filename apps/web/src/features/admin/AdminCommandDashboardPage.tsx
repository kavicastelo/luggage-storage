import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Building2, MapPin, RotateCcw, ShieldAlert } from "lucide-react";
import { LoadingSkeleton } from "@/components/ui";
import { isDemoPreviewActive } from "@/config/demo-preview";
import { formatLkr } from "@/data/mock-marketplace";
import { useAdminMetricsSummaryQuery } from "@/hooks/queries/use-admin-portal";
import { formatLkrMinor } from "@/lib/formatters";
import { useAuthStore } from "@/store/useAuthStore";
import { AdminPageHeader, AdminQueryErrorAlert } from "./admin-helpers";
import { useAdminRole } from "./AdminDashboardLayout";

export function AdminCommandDashboardPage() {
  const location = useLocation();
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

  const metricsQuery = useAdminMetricsSummaryQuery({
    enabled: isAuthenticated && !showDemoPreview
  });
  const metrics = metricsQuery.data;
  const isLoadingLive = !showDemoPreview && metricsQuery.isLoading;

  const canSeeFinancialMetrics =
    effectiveAdminRole === "SUPERADMIN" &&
    (showDemoPreview ||
      isLoadingLive ||
      (metrics !== undefined && metrics.grossCapturedVolumeMinor !== null));

  const pendingKycCount = showDemoPreview ? 3 : (metrics?.pendingVerificationsCount ?? 0);
  const pendingLocationsCount = showDemoPreview ? 2 : (metrics?.pendingLocationsCount ?? 0);
  const disputedBookingsCount = showDemoPreview ? 1 : (metrics?.disputedBookingsCount ?? 0);
  const openRefundsCount = showDemoPreview ? 2 : (metrics?.openRefundsCount ?? 0);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Platform Command Dashboard"
        subtitle={
          showDemoPreview
            ? "Executive preview of marketplace metrics, moderation queues, and non-escrow ledger clearing balances."
            : "Live marketplace governance telemetry, supply moderation queues, and non-escrow financial ledger indicators."
        }
        badge={showDemoPreview ? "Demo Preview" : "Live Operations Telemetry"}
      />

      {metricsQuery.isError && (
        <AdminQueryErrorAlert
          message={
            metricsQuery.error instanceof Error
              ? metricsQuery.error.message
              : "Unable to load live platform command metrics."
          }
          onRetry={() => void metricsQuery.refetch()}
        />
      )}

      {/* Financial KPIs (Superadmin / Financial Permission only) */}
      {canSeeFinancialMetrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-sand-200 p-4 shadow-sm space-y-1.5">
            <p className="text-[11px] font-bold text-sand-700 uppercase tracking-wide">
              Gross Captured Volume
            </p>
            {isLoadingLive ? (
              <LoadingSkeleton variant="text" className="h-7 w-28" />
            ) : (
              <p className="text-xl font-extrabold text-navy-950 tabular-nums">
                {showDemoPreview
                  ? formatLkr(4280000)
                  : formatLkrMinor(metrics?.grossCapturedVolumeMinor ?? 0, metrics?.currency)}
              </p>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-sand-200 p-4 shadow-sm space-y-1.5">
            <p className="text-[11px] font-bold text-sand-700 uppercase tracking-wide">
              Platform Commission Revenue
            </p>
            {isLoadingLive ? (
              <LoadingSkeleton variant="text" className="h-7 w-28" />
            ) : (
              <p className="text-xl font-extrabold text-terracotta-600 tabular-nums">
                {showDemoPreview
                  ? formatLkr(642000)
                  : formatLkrMinor(metrics?.platformCommissionMinor ?? 0, metrics?.currency)}
              </p>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-sand-200 p-4 shadow-sm space-y-1.5">
            <p className="text-[11px] font-bold text-sand-700 uppercase tracking-wide">
              Unearned Booking Liability
            </p>
            {isLoadingLive ? (
              <LoadingSkeleton variant="text" className="h-7 w-28" />
            ) : (
              <p className="text-xl font-extrabold text-navy-950 tabular-nums">
                {showDemoPreview
                  ? formatLkr(912400)
                  : formatLkrMinor(metrics?.unearnedBookingLiabilityMinor ?? 0, metrics?.currency)}
              </p>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-sand-200 p-4 shadow-sm space-y-1.5">
            <p className="text-[11px] font-bold text-sand-700 uppercase tracking-wide">
              Eligible Host Payables
            </p>
            {isLoadingLive ? (
              <LoadingSkeleton variant="text" className="h-7 w-28" />
            ) : (
              <p className="text-xl font-extrabold text-emerald-700 tabular-nums">
                {showDemoPreview
                  ? formatLkr(540000)
                  : formatLkrMinor(metrics?.eligibleHostPayablesMinor ?? 0, metrics?.currency)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Operational Queue & Supply Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          className={`rounded-2xl border p-4 shadow-sm space-y-2 transition ${
            !isLoadingLive && pendingKycCount > 0
              ? "bg-amber-50/40 border-amber-300"
              : "bg-white border-sand-200"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-sand-700 font-bold">
            <span>Pending Host KYC</span>
            <Building2 className="h-4 w-4 text-terracotta-600" />
          </div>
          {isLoadingLive ? (
            <LoadingSkeleton variant="text" className="h-8 w-14" />
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-2xl font-extrabold text-navy-950 tabular-nums">
                {pendingKycCount}
              </p>
              {pendingKycCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                  Action Needed
                </span>
              )}
            </div>
          )}
          <Link
            to={`/admin/hosts/review${querySuffix}`}
            className="inline-flex items-center gap-1 text-xs font-bold text-terracotta-600 hover:text-terracotta-700 hover:underline"
          >
            <span>Inspect KYC Queue</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div
          className={`rounded-2xl border p-4 shadow-sm space-y-2 transition ${
            !isLoadingLive && pendingLocationsCount > 0
              ? "bg-amber-50/40 border-amber-300"
              : "bg-white border-sand-200"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-sand-700 font-bold">
            <span>Pending Storage Hubs</span>
            <MapPin className="h-4 w-4 text-terracotta-600" />
          </div>
          {isLoadingLive ? (
            <LoadingSkeleton variant="text" className="h-8 w-14" />
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-2xl font-extrabold text-navy-950 tabular-nums">
                {pendingLocationsCount}
              </p>
              {pendingLocationsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                  Action Needed
                </span>
              )}
            </div>
          )}
          <Link
            to={`/admin/locations${querySuffix}`}
            className="inline-flex items-center gap-1 text-xs font-bold text-terracotta-600 hover:text-terracotta-700 hover:underline"
          >
            <span>Review Locations</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div
          className={`rounded-2xl border p-4 shadow-sm space-y-2 transition ${
            !isLoadingLive && disputedBookingsCount > 0
              ? "bg-rose-50/50 border-rose-300"
              : "bg-white border-sand-200"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-sand-700 font-bold">
            <span>Disputed Bookings</span>
            <ShieldAlert className="h-4 w-4 text-amber-600" />
          </div>
          {isLoadingLive ? (
            <LoadingSkeleton variant="text" className="h-8 w-14" />
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-2xl font-extrabold text-navy-950 tabular-nums">
                {disputedBookingsCount}
              </p>
              {disputedBookingsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 text-[10px] font-bold">
                  Urgent
                </span>
              )}
            </div>
          )}
          <Link
            to={`/admin/incidents${querySuffix}`}
            className="inline-flex items-center gap-1 text-xs font-bold text-terracotta-600 hover:text-terracotta-700 hover:underline"
          >
            <span>Investigate Disputes</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div
          className={`rounded-2xl border p-4 shadow-sm space-y-2 transition ${
            !isLoadingLive && openRefundsCount > 0
              ? "bg-rose-50/50 border-rose-300"
              : "bg-white border-sand-200"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-sand-700 font-bold">
            <span>Open Refunds</span>
            <RotateCcw className="h-4 w-4 text-rose-600" />
          </div>
          {isLoadingLive ? (
            <LoadingSkeleton variant="text" className="h-8 w-14" />
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-2xl font-extrabold text-navy-950 tabular-nums">
                {openRefundsCount}
              </p>
              {openRefundsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 text-[10px] font-bold">
                  Queue Open
                </span>
              )}
            </div>
          )}
          <Link
            to={`/admin/refunds${querySuffix}`}
            className="inline-flex items-center gap-1 text-xs font-bold text-terracotta-600 hover:text-terracotta-700 hover:underline"
          >
            <span>Open Refund Queue</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Directory & Activity Snapshot */}
      <div className="bg-white rounded-2xl border border-sand-200 p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs shadow-sm">
        <div>
          <span className="text-sand-700 font-semibold">Active Platform Users</span>
          {isLoadingLive ? (
            <LoadingSkeleton variant="text" className="h-6 w-16 mt-1" />
          ) : (
            <p className="text-lg font-extrabold text-navy-950 mt-0.5 tabular-nums">
              {showDemoPreview ? "148" : (metrics?.activeUsersCount ?? 0)}
            </p>
          )}
        </div>
        <div>
          <span className="text-sand-700 font-semibold">Active Host Businesses</span>
          {isLoadingLive ? (
            <LoadingSkeleton variant="text" className="h-6 w-16 mt-1" />
          ) : (
            <p className="text-lg font-extrabold text-navy-950 mt-0.5 tabular-nums">
              {showDemoPreview ? "12" : (metrics?.activeBusinessesCount ?? 0)}
            </p>
          )}
        </div>
        <div>
          <span className="text-sand-700 font-semibold">Suspended Host Businesses</span>
          {isLoadingLive ? (
            <LoadingSkeleton variant="text" className="h-6 w-16 mt-1" />
          ) : (
            <p className="text-lg font-extrabold text-rose-700 mt-0.5 tabular-nums">
              {showDemoPreview ? "0" : (metrics?.suspendedBusinessesCount ?? 0)}
            </p>
          )}
        </div>
        <div>
          <span className="text-sand-700 font-semibold">
            Active Storage Hubs / Active Bookings
          </span>
          {isLoadingLive ? (
            <LoadingSkeleton variant="text" className="h-6 w-20 mt-1" />
          ) : (
            <p className="text-lg font-extrabold text-navy-950 mt-0.5 tabular-nums">
              {showDemoPreview
                ? "18 / 24"
                : `${metrics?.activeLocationsCount ?? 0} / ${metrics?.activeBookingsCount ?? 0}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
