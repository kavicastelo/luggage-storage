import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Building2, MapPin, RotateCcw, ShieldAlert } from "lucide-react";
import { MascotIllustration } from "@/components/ui";
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

  const canSeeFinancialMetrics =
    effectiveAdminRole === "SUPERADMIN" &&
    (showDemoPreview ||
      (metrics !== undefined && metrics.grossCapturedVolumeMinor !== null));

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
        rightSlot={
          <MascotIllustration mascot="pointing" size="sm" caption="Live Governance" />
        }
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
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-1">
            <p className="text-[11px] font-bold text-slate-500 uppercase">
              Gross Captured Volume
            </p>
            <p className="text-xl font-extrabold text-slate-950">
              {showDemoPreview
                ? formatLkr(4280000)
                : formatLkrMinor(metrics?.grossCapturedVolumeMinor ?? 0, metrics?.currency)}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-1">
            <p className="text-[11px] font-bold text-slate-500 uppercase">
              Platform Commission Revenue
            </p>
            <p className="text-xl font-extrabold text-purple-700">
              {showDemoPreview
                ? formatLkr(642000)
                : formatLkrMinor(metrics?.platformCommissionMinor ?? 0, metrics?.currency)}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-1">
            <p className="text-[11px] font-bold text-slate-500 uppercase">
              Unearned Booking Liability
            </p>
            <p className="text-xl font-extrabold text-slate-950">
              {showDemoPreview
                ? formatLkr(912400)
                : formatLkrMinor(metrics?.unearnedBookingLiabilityMinor ?? 0, metrics?.currency)}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-1">
            <p className="text-[11px] font-bold text-slate-500 uppercase">
              Eligible Host Payables
            </p>
            <p className="text-xl font-extrabold text-emerald-700">
              {showDemoPreview
                ? formatLkr(540000)
                : formatLkrMinor(metrics?.eligibleHostPayablesMinor ?? 0, metrics?.currency)}
            </p>
          </div>
        </div>
      )}

      {/* Operational Queue & Supply Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
            <span>Pending Host KYC</span>
            <Building2 className="h-4 w-4 text-purple-600" />
          </div>
          <p className="text-2xl font-extrabold text-slate-950">
            {showDemoPreview ? "3" : (metrics?.pendingVerificationsCount ?? 0)}
          </p>
          <Link
            to={`/admin/hosts/review${querySuffix}`}
            className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 hover:underline"
          >
            <span>Inspect KYC Queue</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
            <span>Pending Storage Hubs</span>
            <MapPin className="h-4 w-4 text-purple-600" />
          </div>
          <p className="text-2xl font-extrabold text-slate-950">
            {showDemoPreview ? "2" : (metrics?.pendingLocationsCount ?? 0)}
          </p>
          <Link
            to={`/admin/locations${querySuffix}`}
            className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 hover:underline"
          >
            <span>Review Locations</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
            <span>Disputed Bookings</span>
            <ShieldAlert className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-2xl font-extrabold text-slate-950">
            {showDemoPreview ? "1" : (metrics?.disputedBookingsCount ?? 0)}
          </p>
          <Link
            to={`/admin/bookings${querySuffix}`}
            className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 hover:underline"
          >
            <span>Inspect Global Bookings</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
            <span>Open Refunds</span>
            <RotateCcw className="h-4 w-4 text-rose-600" />
          </div>
          <p className="text-2xl font-extrabold text-slate-950">
            {showDemoPreview ? "2" : (metrics?.openRefundsCount ?? 0)}
          </p>
          <Link
            to={`/admin/refunds${querySuffix}`}
            className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 hover:underline"
          >
            <span>Open Refund Queue</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Directory & Activity Snapshot */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div>
          <span className="text-slate-500 font-semibold">Active Platform Users</span>
          <p className="text-lg font-extrabold text-slate-950 mt-0.5">
            {showDemoPreview ? "148" : (metrics?.activeUsersCount ?? 0)}
          </p>
        </div>
        <div>
          <span className="text-slate-500 font-semibold">Active Host Businesses</span>
          <p className="text-lg font-extrabold text-slate-950 mt-0.5">
            {showDemoPreview ? "12" : (metrics?.activeBusinessesCount ?? 0)}
          </p>
        </div>
        <div>
          <span className="text-slate-500 font-semibold">Suspended Host Businesses</span>
          <p className="text-lg font-extrabold text-rose-700 mt-0.5">
            {showDemoPreview ? "0" : (metrics?.suspendedBusinessesCount ?? 0)}
          </p>
        </div>
        <div>
          <span className="text-slate-500 font-semibold">
            Active Storage Hubs / Active Bookings
          </span>
          <p className="text-lg font-extrabold text-slate-950 mt-0.5">
            {showDemoPreview
              ? "18 / 24"
              : `${metrics?.activeLocationsCount ?? 0} / ${metrics?.activeBookingsCount ?? 0}`}
          </p>
        </div>
      </div>
    </div>
  );
}
