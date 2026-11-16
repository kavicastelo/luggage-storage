import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { HostPayableRecord, HostPayableStatus } from "@luggage-storage/contracts";
import { HOST_PAYABLE_STATUSES } from "@luggage-storage/contracts";
import { Download, Info } from "lucide-react";
import { isDemoPreviewActive } from "@/config/demo-preview";
import { DEMO_BOOKINGS, formatLkr } from "@/data/mock-marketplace";
import { useHostFinanceSummaryQuery } from "@/hooks/queries/use-host-portal";
import { downloadCsvFile, serializeCsv } from "@/lib/csv-export";
import { formatDateTimeDisplay, formatLkrMinor } from "@/lib/formatters";
import { useAuthStore } from "@/store/useAuthStore";
import { useHostVenue } from "./HostDashboardLayout";
import { HostQueryErrorAlert, isUuid } from "./host-helpers";

function formatPayableStatusLabel(status: HostPayableStatus): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case "ELIGIBLE":
      return {
        label: "Eligible for Payout",
        badgeClass: "bg-emerald-50 text-emerald-800 border border-emerald-200"
      };
    case "ACCRUED":
      return {
        label: "Accrued (Pending Collection)",
        badgeClass: "bg-blue-50 text-blue-800 border border-blue-200"
      };
    case "ON_HOLD":
      return {
        label: "On Hold (Dispute Review)",
        badgeClass: "bg-amber-50 text-amber-950 border border-amber-300"
      };
    case "PAID":
      return {
        label: "Paid",
        badgeClass: "bg-sand-100 text-navy-800 border border-sand-300"
      };
    case "CANCELLED_CLAWBACK":
      return {
        label: "Cancelled / Clawback",
        badgeClass: "bg-rose-50 text-rose-800 border border-rose-200"
      };
  }
}

export function HostFinancialRevenueLedgerPage() {
  const location = useLocation();
  const { isDemoActive, selectedBusinessId, canActAsHostOwner } = useHostVenue();
  const { isAuthenticated } = useAuthStore();

  const showDemoFinance =
    !isAuthenticated &&
    (isDemoActive ||
      isDemoPreviewActive({
        allowDemoPreview: true,
        search: location.search,
        isAuthenticated
      }));

  const liveBusinessId =
    isAuthenticated && !showDemoFinance && isUuid(selectedBusinessId)
      ? selectedBusinessId
      : undefined;

  const financeQuery = useHostFinanceSummaryQuery(liveBusinessId, {
    enabled: isAuthenticated && !showDemoFinance && canActAsHostOwner
  });

  const [statusFilter, setStatusFilter] = useState<"ALL" | HostPayableStatus>("ALL");
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);

  const liveFinance = financeQuery.data ?? null;
  const currency = liveFinance?.currency ?? "LKR";
  const allPayables: HostPayableRecord[] = liveFinance?.payables ?? [];

  const filteredPayables = useMemo(() => {
    if (statusFilter === "ALL") return allPayables;
    return allPayables.filter((p) => p.status === statusFilter);
  }, [allPayables, statusFilter]);

  const grossMinorTotal = useMemo(
    () => allPayables.reduce((sum, p) => sum + p.grossSubtotalMinor, 0),
    [allPayables]
  );
  const commissionMinorTotal = useMemo(
    () => allPayables.reduce((sum, p) => sum + p.commissionMinor, 0),
    [allPayables]
  );
  const netPayableTotalMinor = liveFinance
    ? liveFinance.totalAccruedMinor +
      liveFinance.totalEligibleMinor +
      liveFinance.totalOnHoldMinor +
      liveFinance.totalPaidMinor
    : 0;

  const handleExportCsv = () => {
    if (showDemoFinance) {
      const headers = [
        "Booking Reference",
        "Traveller",
        "Gross (LKR)",
        "Platform Fee (LKR)",
        "Host Net (LKR)",
        "Status"
      ];
      const rows = DEMO_BOOKINGS.map((b) => [
        b.reference,
        b.travellerName,
        b.totalAmountLkr.toFixed(2),
        b.platformCommissionLkr.toFixed(2),
        b.hostNetPayoutLkr.toFixed(2),
        "Cleared"
      ]);
      const csv = serializeCsv(headers, rows);
      downloadCsvFile("host-finance-ledger-demo.csv", csv);
      setDownloadMessage("Demo financial ledger exported (CSV).");
      return;
    }

    const headers = [
      "Booking Reference",
      "Business",
      "Status",
      `Gross (${currency})`,
      `Commission (${currency})`,
      `Net Payable (${currency})`,
      "Currency",
      "Accrued At",
      "Eligible At"
    ];
    const rows = filteredPayables.map((p) => [
      p.referenceCode || p.bookingId,
      p.businessName || p.businessId,
      p.status,
      (p.grossSubtotalMinor / 100).toFixed(2),
      (p.commissionMinor / 100).toFixed(2),
      (p.netPayableMinor / 100).toFixed(2),
      p.currency,
      p.accruedAt,
      p.eligibleAt ?? ""
    ]);
    const csv = serializeCsv(headers, rows);
    const saved = downloadCsvFile("host-finance-ledger.csv", csv);
    setDownloadMessage(
      saved
        ? `Exported ${filteredPayables.length} settlement record(s) to CSV.`
        : "Prepared CSV export for host settlement ledger."
    );
  };

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
                : "Itemized gross booking volume, platform commission deductions, and server-verified host settlement payables."}
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-sand-300 hover:bg-sand-50 text-navy-900 text-xs font-bold shadow-xs transition"
          >
            <Download className="h-4 w-4 text-terracotta-600" />
            <span>Export CSV Ledger</span>
          </button>
        </div>
      </div>

      {/* Mode Notice */}
      {showDemoFinance ? (
        <div className="rounded-xl bg-sand-100/90 border border-sand-300 p-4 text-xs text-navy-800 flex items-start gap-3">
          <Info className="h-4 w-4 text-terracotta-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-navy-950">Financial Ledger (Demo Figures):</strong> Financial
            volumes, deductions, and batch settlement dates are calculated from local mock bookings
            for Fort Hub demonstration. Export actions generate simulated client exports.
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-sand-100/90 border border-sand-300 p-4 text-xs text-navy-800 flex items-start gap-3">
          <Info className="h-4 w-4 text-terracotta-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-navy-950">Live Non-Escrow Settlement Ledger:</strong>{" "}
            Displaying server-authoritative host payables categorized by settlement readiness
            (Accrued, Eligible, On Hold, and Paid). Automated CEFT disbursement batching activates
            under Platform Finance Batch Settlement.
          </div>
        </div>
      )}

      {financeQuery.isError && (
        <HostQueryErrorAlert
          message={
            financeQuery.error instanceof Error
              ? financeQuery.error.message
              : "Unable to load host financial ledger."
          }
          onRetry={() => void financeQuery.refetch()}
        />
      )}

      {downloadMessage && (
        <div
          role="status"
          className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold flex items-center gap-2"
        >
          <Info className="h-4 w-4 text-blue-600" />
          <span>{downloadMessage}</span>
        </div>
      )}

      {/* Primary Revenue & Commission KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-1">
          <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">
            Gross Booking Volume
          </span>
          <p className="text-2xl font-extrabold text-navy-950">
            {showDemoFinance
              ? formatLkr(217058)
              : formatLkrMinor(grossMinorTotal, currency)}
          </p>
          <span className="text-[11px] text-navy-500">Total customer checkout value</span>
        </div>

        <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-1">
          <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">
            {showDemoFinance ? "Platform Fee (15%)" : "Platform Commission"}
          </span>
          <p className="text-2xl font-extrabold text-navy-600">
            -
            {showDemoFinance
              ? formatLkr(32558)
              : formatLkrMinor(commissionMinorTotal, currency)}
          </p>
          <span className="text-[11px] text-navy-500">
            Payment processing &amp; platform commission
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-1">
          <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">
            {showDemoFinance ? "Net Host Payout (85%)" : "Net Host Payable"}
          </span>
          <p className="text-2xl font-extrabold text-emerald-700">
            {showDemoFinance
              ? formatLkr(184500)
              : formatLkrMinor(netPayableTotalMinor, currency)}
          </p>
          <span className="text-[11px] text-emerald-800 font-semibold">
            {showDemoFinance
              ? "Illustrative Friday batch estimate (DEC-006)"
              : `Eligible now: ${formatLkrMinor(liveFinance?.totalEligibleMinor ?? 0, currency)}`}
          </span>
        </div>
      </div>

      {/* Live 4 Payable State Breakdown */}
      {!showDemoFinance && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-emerald-200 p-4 shadow-sm space-y-1">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Eligible for Payout
            </span>
            <p className="text-xl font-extrabold text-emerald-700">
              {formatLkrMinor(liveFinance?.totalEligibleMinor ?? 0, currency)}
            </p>
            <p className="text-[11px] text-navy-500">Ready for weekly settlement batch</p>
          </div>

          <div className="bg-white rounded-2xl border border-blue-200 p-4 shadow-sm space-y-1">
            <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">
              Accrued (Pending Collection)
            </span>
            <p className="text-xl font-extrabold text-blue-700">
              {formatLkrMinor(liveFinance?.totalAccruedMinor ?? 0, currency)}
            </p>
            <p className="text-[11px] text-navy-500">Releases to Eligible on bag check-out</p>
          </div>

          <div className="bg-white rounded-2xl border border-amber-300 p-4 shadow-sm space-y-1">
            <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
              On Hold (Disputed)
            </span>
            <p className="text-xl font-extrabold text-amber-800">
              {formatLkrMinor(liveFinance?.totalOnHoldMinor ?? 0, currency)}
            </p>
            <p className="text-[11px] text-navy-500">Held pending exception resolution</p>
          </div>

          <div className="bg-white rounded-2xl border border-sand-200 p-4 shadow-sm space-y-1">
            <span className="text-[11px] font-bold text-navy-600 uppercase tracking-wider">
              Paid to Date
            </span>
            <p className="text-xl font-extrabold text-navy-950">
              {formatLkrMinor(liveFinance?.totalPaidMinor ?? 0, currency)}
            </p>
            <p className="text-[11px] text-navy-500">Completed bank disbursements</p>
          </div>
        </div>
      )}

      {/* Itemized Payables Table */}
      <div className="bg-white rounded-2xl border border-sand-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-sand-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-navy-950">
              Recent Completed &amp; Cleared Bookings
            </h2>
            <span className="text-xs text-navy-500">
              {showDemoFinance
                ? "Settled to Commercial Bank of Ceylon PLC"
                : "Settled per verified payout account"}
            </span>
          </div>
          {!showDemoFinance && (
            <div className="flex flex-wrap gap-1.5">
              {(["ALL", ...HOST_PAYABLE_STATUSES] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                    statusFilter === status
                      ? "bg-navy-900 text-white"
                      : "bg-sand-100 text-navy-700 hover:bg-sand-200"
                  }`}
                >
                  {status === "ALL" ? "All Statuses" : status.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-sand-50 border-b border-sand-200 text-navy-500 uppercase font-bold text-[10px] tracking-wider">
                <th className="p-3.5">Booking Ref</th>
                <th className="p-3.5">{showDemoFinance ? "Traveller" : "Business / Accrued"}</th>
                <th className="p-3.5">Gross ({currency})</th>
                <th className="p-3.5">
                  {showDemoFinance ? "Platform Fee (15%)" : "Platform Commission"}
                </th>
                <th className="p-3.5">{showDemoFinance ? "Host Net (85%)" : "Host Net"}</th>
                <th className="p-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {showDemoFinance ? (
                DEMO_BOOKINGS.map((b) => (
                  <tr key={b.id} className="hover:bg-sand-50/70 transition">
                    <td className="p-3.5 font-mono font-bold text-navy-900">{b.reference}</td>
                    <td className="p-3.5 font-semibold text-navy-950">{b.travellerName}</td>
                    <td className="p-3.5 text-navy-800">{formatLkr(b.totalAmountLkr)}</td>
                    <td className="p-3.5 text-navy-500">-{formatLkr(b.platformCommissionLkr)}</td>
                    <td className="p-3.5 font-bold text-emerald-700">
                      {formatLkr(b.hostNetPayoutLkr)}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Cleared
                      </span>
                    </td>
                  </tr>
                ))
              ) : filteredPayables.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-navy-500">
                    {financeQuery.isLoading
                      ? "Loading host settlement ledger..."
                      : "No host settlement payables recorded yet."}
                  </td>
                </tr>
              ) : (
                filteredPayables.map((p) => {
                  const statusMeta = formatPayableStatusLabel(p.status);
                  return (
                    <tr key={p.id} className="hover:bg-sand-50/70 transition">
                      <td className="p-3.5 font-mono font-bold text-navy-900">
                        {p.referenceCode || p.bookingId.slice(0, 8)}
                      </td>
                      <td className="p-3.5">
                        <p className="font-semibold text-navy-950">
                          {p.businessName || "Verified Host Business"}
                        </p>
                        <p className="text-[10px] text-navy-500">
                          Accrued {formatDateTimeDisplay(p.accruedAt)}
                        </p>
                      </td>
                      <td className="p-3.5 text-navy-800">
                        {formatLkrMinor(p.grossSubtotalMinor, p.currency)}
                      </td>
                      <td className="p-3.5 text-navy-500">
                        -{formatLkrMinor(p.commissionMinor, p.currency)}
                      </td>
                      <td className="p-3.5 font-bold text-emerald-700">
                        {formatLkrMinor(p.netPayableMinor, p.currency)}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusMeta.badgeClass}`}
                        >
                          {statusMeta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
