import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, Download } from "lucide-react";
import { isDemoPreviewActive } from "@/config/demo-preview";
import { formatLkr } from "@/data/mock-marketplace";
import { useAdminLedgerQuery } from "@/hooks/queries/use-admin-portal";
import { downloadCsvFile, serializeCsv } from "@/lib/csv-export";
import { formatDateTimeDisplay, formatLkrMinor } from "@/lib/formatters";
import { useAuthStore } from "@/store/useAuthStore";
import {
  AdminEmptyStateCard,
  AdminPageHeader,
  AdminPaginationBar,
  AdminQueryErrorAlert,
  AdminTableSkeleton,
  isUuid
} from "./admin-helpers";

const LEDGER_ACCOUNTS = [
  "1100_PLATFORM_CLEARING_RECEIVABLE",
  "2100_UNEARNED_BOOKING_LIABILITY",
  "2200_HOST_PAYABLE_LIABILITY",
  "2300_REFUND_PAYABLE_LIABILITY",
  "4100_PLATFORM_COMMISSION_REVENUE"
] as const;

export function AdminFinancialLedgerPage() {
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();

  const showDemoPreview =
    !isAuthenticated &&
    isDemoPreviewActive({
      allowDemoPreview: true,
      search: location.search,
      isAuthenticated
    });
  const querySuffix = showDemoPreview ? "?preview=demo" : "";

  const [accountCodeFilter, setAccountCodeFilter] = useState<string>("");
  const [bookingIdInput, setBookingIdInput] = useState("");
  const [businessIdInput, setBusinessIdInput] = useState("");
  const [appliedBookingId, setAppliedBookingId] = useState<string | undefined>(undefined);
  const [appliedBusinessId, setAppliedBusinessId] = useState<string | undefined>(undefined);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 25;

  const ledgerQuery = useAdminLedgerQuery(
    {
      page,
      limit,
      accountCode: accountCodeFilter || undefined,
      bookingId: appliedBookingId,
      businessId: appliedBusinessId
    },
    { enabled: isAuthenticated && !showDemoPreview }
  );

  const entries = ledgerQuery.data?.entries ?? [];
  const totals = ledgerQuery.data?.totals;
  const pagination = ledgerQuery.data?.pagination;

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedBooking = bookingIdInput.trim();
    const trimmedBusiness = businessIdInput.trim();
    if (trimmedBooking && !isUuid(trimmedBooking)) {
      setFilterError("Booking ID filter must be a valid UUID.");
      return;
    }
    if (trimmedBusiness && !isUuid(trimmedBusiness)) {
      setFilterError("Business ID filter must be a valid UUID.");
      return;
    }
    setFilterError(null);
    setAppliedBookingId(trimmedBooking || undefined);
    setAppliedBusinessId(trimmedBusiness || undefined);
    setPage(1);
  };

  const handleExportCsv = () => {
    const csv = serializeCsv(
      [
        "Entry ID",
        "Transaction Group ID",
        "Type",
        "Account Code",
        "Account Name",
        "Amount Minor",
        "Currency",
        "Booking Reference",
        "Booking ID",
        "Business ID",
        "Description",
        "Posted At"
      ],
      entries.map((entry) => [
        entry.id,
        entry.transactionGroupId,
        entry.entryType,
        entry.accountCode,
        entry.accountName,
        entry.amountMinor,
        entry.currency,
        entry.referenceCode ?? "",
        entry.bookingId,
        entry.businessId ?? "",
        entry.description,
        entry.postedAt
      ])
    );
    downloadCsvFile(`admin-financial-ledger-page-${page}.csv`, csv);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Double-Entry Financial & Non-Escrow Ledger"
        subtitle="Immutable double-entry accounting across PLATFORM_CLEARING_RECEIVABLE, Unearned Liability, Host Payable, Refund Liability, and Platform Commission."
        badge={showDemoPreview ? "Demo Preview" : "Trial Balance"}
        rightSlot={
          !showDemoPreview && entries.length > 0 ? (
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-sand-200 bg-white hover:bg-sand-100 text-xs font-bold text-navy-900 transition"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          ) : undefined
        }
      />

      {/* Accounting Classification Notice (Required non-escrow terminology) */}
      <div className="bg-navy-900 border border-navy-800 rounded-2xl p-4 text-xs text-sand-100 flex items-start gap-3 shadow-sm">
        <BookOpen className="w-4 h-4 text-terracotta-400 mt-0.5 flex-shrink-0" />
        <p className="leading-relaxed">
          <strong className="text-white">Accounting Classification:</strong> Platform settlement
          operates as a{" "}
          <strong className="text-white">non-escrow marketplace settlement ledger</strong> anchored at{" "}
          <span className="font-mono font-bold text-terracotta-400">
            1100_PLATFORM_CLEARING_RECEIVABLE
          </span>{" "}
          rather than a regulated third-party escrow custody account.
        </p>
      </div>

      {ledgerQuery.isError && (
        <AdminQueryErrorAlert
          message={
            ledgerQuery.error instanceof Error
              ? ledgerQuery.error.message
              : "Unable to load double-entry ledger journals."
          }
          onRetry={() => void ledgerQuery.refetch()}
        />
      )}

      {filterError && <AdminQueryErrorAlert message={filterError} />}

      {/* Trial Balance Totals */}
      {!showDemoPreview && totals && (
        <div
          className={`rounded-2xl border p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs shadow-sm ${
            totals.isBalanced
              ? "bg-emerald-50 border-emerald-200 text-emerald-950"
              : "bg-rose-50 border-rose-200 text-rose-950"
          }`}
        >
          <div>
            <span className="text-[11px] font-bold uppercase opacity-75">Total Debits</span>
            <p className="text-base font-extrabold tabular-nums">
              {formatLkrMinor(totals.totalDebitsMinor, totals.currency)}
            </p>
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase opacity-75">Total Credits</span>
            <p className="text-base font-extrabold tabular-nums">
              {formatLkrMinor(totals.totalCreditsMinor, totals.currency)}
            </p>
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase opacity-75">Trial Balance Check</span>
            <p className="text-base font-extrabold">
              {totals.isBalanced ? "Balanced Double-Entry (Dr = Cr)" : "Ledger Imbalance Detected"}
            </p>
          </div>
        </div>
      )}

      {/* Filter Form */}
      {!showDemoPreview && (
        <form
          onSubmit={handleFilterSubmit}
          className="bg-white rounded-2xl border border-sand-200 p-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs shadow-sm"
        >
          <div>
            <label className="block font-bold text-navy-900 mb-1">Account Code</label>
            <select
              value={accountCodeFilter}
              onChange={(e) => {
                setAccountCodeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-sand-200 bg-white font-mono text-navy-950"
            >
              <option value="">All Ledger Accounts</option>
              {LEDGER_ACCOUNTS.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-bold text-navy-900 mb-1">Booking UUID</label>
            <input
              type="text"
              value={bookingIdInput}
              onChange={(e) => setBookingIdInput(e.target.value)}
              placeholder="Optional booking UUID..."
              className="w-full px-3 py-2 rounded-xl border border-sand-200 font-mono text-navy-950"
            />
          </div>
          <div>
            <label className="block font-bold text-navy-900 mb-1">Host Business UUID</label>
            <input
              type="text"
              value={businessIdInput}
              onChange={(e) => setBusinessIdInput(e.target.value)}
              placeholder="Optional business UUID..."
              className="w-full px-3 py-2 rounded-xl border border-sand-200 font-mono text-navy-950"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-bold transition"
            >
              Apply Filters
            </button>
            <button
              type="button"
              onClick={() => {
                setAccountCodeFilter("");
                setBookingIdInput("");
                setBusinessIdInput("");
                setAppliedBookingId(undefined);
                setAppliedBusinessId(undefined);
                setFilterError(null);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-sand-200 font-bold text-navy-900 hover:bg-sand-100 transition"
            >
              Reset
            </button>
          </div>
        </form>
      )}

      {/* Journal Table */}
      <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
        {showDemoPreview ? (
          <div className="p-4 rounded-xl bg-sand-50 border border-sand-200 text-xs flex justify-between items-center">
            <div>
              <p className="font-mono font-bold text-navy-950">
                DEBIT • 1100_PLATFORM_CLEARING_RECEIVABLE
              </p>
              <p className="text-sand-700 mt-0.5">
                Demo preview journal showing balanced booking settlement recognition.
              </p>
            </div>
            <span className="font-extrabold text-navy-950 tabular-nums">{formatLkr(2400)}</span>
          </div>
        ) : ledgerQuery.isLoading ? (
          <AdminTableSkeleton rows={6} columns={6} />
        ) : entries.length === 0 ? (
          <AdminEmptyStateCard
            title="No ledger journal entries recorded"
            description="Double-entry settlement lines for 1100_PLATFORM_CLEARING_RECEIVABLE, liabilities, and commissions appear here as bookings settle."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-sand-200 text-sand-700">
                  <th className="pb-2.5 pr-4 font-bold">Posted At</th>
                  <th className="pb-2.5 pr-4 font-bold">Dr / Cr</th>
                  <th className="pb-2.5 pr-4 font-bold">Account</th>
                  <th className="pb-2.5 pr-4 font-bold">Amount</th>
                  <th className="pb-2.5 pr-4 font-bold">Reference</th>
                  <th className="pb-2.5 font-bold">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-sand-50/70 transition-colors">
                    <td className="py-2.5 pr-4 text-[11px] text-sand-700 tabular-nums">
                      {formatDateTimeDisplay(entry.postedAt)}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          entry.entryType === "DEBIT"
                            ? "bg-sky-50 text-sky-900 border border-sky-200"
                            : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        }`}
                      >
                        {entry.entryType}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <p className="font-mono font-bold text-navy-950">{entry.accountCode}</p>
                      <p className="text-[11px] text-sand-700">{entry.accountName}</p>
                    </td>
                    <td className="py-2.5 pr-4 font-bold text-navy-950 tabular-nums">
                      {formatLkrMinor(entry.amountMinor, entry.currency)}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-[11px]">
                      <Link
                        to={`/admin/bookings/${entry.bookingId}${querySuffix}`}
                        className="font-bold text-terracotta-600 hover:underline"
                      >
                        {entry.referenceCode || entry.bookingId.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-2.5 text-[11px] text-navy-900">{entry.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!showDemoPreview && entries.length > 0 && pagination && (
          <AdminPaginationBar
            page={pagination.page}
            totalPages={Math.max(1, pagination.totalPages)}
            total={pagination.total}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}

export const AdminDoubleEntryFinancialLedgerPage = AdminFinancialLedgerPage;
