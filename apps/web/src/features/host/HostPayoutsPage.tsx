import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Building2, CheckCircle2, Download, Info, X } from "lucide-react";
import { isDemoPreviewActive } from "@/config/demo-preview";
import { formatLkr } from "@/data/mock-marketplace";
import {
  useHostFinanceSummaryQuery,
  useHostPayoutBatchesQuery,
  useHostPayoutDetailsQuery,
  useOwnedBusinessesQuery,
  useUpdateBusinessMutation
} from "@/hooks/queries/use-host-portal";
import { downloadCsvFile, serializeCsv } from "@/lib/csv-export";
import { formatDateTimeDisplay, formatLkrMinor } from "@/lib/formatters";
import { useAuthStore } from "@/store/useAuthStore";
import { useHostVenue } from "./HostDashboardLayout";
import { HostQueryErrorAlert, isUuid } from "./host-helpers";

export function HostPayoutAccountsHistoryPage() {
  const location = useLocation();
  const { isDemoActive, selectedBusinessId, canActAsHostOwner } = useHostVenue();
  const { isAuthenticated } = useAuthStore();

  const showDemo =
    !isAuthenticated &&
    (isDemoActive ||
      isDemoPreviewActive({
        allowDemoPreview: true,
        search: location.search,
        isAuthenticated
      }));

  const businessesQuery = useOwnedBusinessesQuery({
    enabled: isAuthenticated && !showDemo && canActAsHostOwner
  });
  const businesses = businessesQuery.data ?? [];

  const activeBusiness = useMemo(() => {
    if (isUuid(selectedBusinessId)) {
      const hit = businesses.find((b) => b.id === selectedBusinessId);
      if (hit) return hit;
    }
    return businesses[0] ?? null;
  }, [businesses, selectedBusinessId]);

  const payoutQuery = useHostPayoutDetailsQuery(activeBusiness?.id, {
    enabled: isAuthenticated && !showDemo && Boolean(activeBusiness?.id) && canActAsHostOwner
  });
  const financeQuery = useHostFinanceSummaryQuery(activeBusiness?.id, {
    enabled: isAuthenticated && !showDemo && Boolean(activeBusiness?.id) && canActAsHostOwner
  });
  const payoutBatchesQuery = useHostPayoutBatchesQuery(activeBusiness?.id, {
    enabled: isAuthenticated && !showDemo && Boolean(activeBusiness?.id) && canActAsHostOwner
  });
  const updateBusinessMutation = useUpdateBusinessMutation();

  const [showEditBankModal, setShowEditBankModal] = useState(false);
  const [bankNameInput, setBankNameInput] = useState("");
  const [branchCodeInput, setBranchCodeInput] = useState("");
  const [accountNameInput, setAccountNameInput] = useState("");
  const [accountNumberInput, setAccountNumberInput] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const livePayout = payoutQuery.data ?? null;
  const liveBankName = livePayout?.payoutBankName ?? activeBusiness?.payoutBankName ?? null;
  const liveBranchCode = livePayout?.payoutBranchCode ?? activeBusiness?.payoutBranchCode ?? null;
  const liveAccountName = livePayout?.payoutAccountName ?? activeBusiness?.payoutAccountName ?? null;
  const liveAccountMasked =
    livePayout?.payoutAccountNumberMasked ?? activeBusiness?.payoutAccountNumberMasked ?? null;
  const livePayables = financeQuery.data?.payables ?? [];
  const liveBatches = payoutBatchesQuery.data ?? [];

  const demoBatches = showDemo
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

  const openEditModal = () => {
    setModalError(null);
    if (!showDemo) {
      setBankNameInput(liveBankName ?? "");
      setBranchCodeInput(liveBranchCode ?? "");
      setAccountNameInput(liveAccountName ?? activeBusiness?.legalBusinessName ?? "");
      setAccountNumberInput(livePayout?.payoutAccountNumber ?? "");
    }
    setShowEditBankModal(true);
  };

  const handleSaveBankDetails = async (event: React.FormEvent) => {
    event.preventDefault();
    setModalError(null);

    if (showDemo) {
      setShowEditBankModal(false);
      setStatusMessage("Bank beneficiary update previewed in local demo session.");
      return;
    }

    if (!activeBusiness) {
      setModalError("Create or select an active host business before saving bank details.");
      return;
    }

    const bankName = bankNameInput.trim();
    const accountName = accountNameInput.trim();
    const accountNumber = accountNumberInput.trim();
    const branchCode = branchCodeInput.trim();

    if (bankName.length < 2) {
      setModalError("Enter a valid bank name.");
      return;
    }
    if (accountName.length < 2) {
      setModalError("Enter the beneficiary account holder name.");
      return;
    }
    if (accountNumber.length < 6) {
      setModalError("Enter a valid bank account number (minimum 6 characters).");
      return;
    }

    try {
      await updateBusinessMutation.mutateAsync({
        businessId: activeBusiness.id,
        data: {
          payoutBankName: bankName,
          payoutAccountName: accountName,
          payoutAccountNumber: accountNumber,
          payoutBranchCode: branchCode || null
        }
      });
      setShowEditBankModal(false);
      setStatusMessage(
        "Settlement bank beneficiary updated. Changes apply to upcoming settlement batches."
      );
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Unable to update payout bank details.");
    }
  };

  const handleExportPayoutCsv = () => {
    const currency = financeQuery.data?.currency ?? "LKR";
    const csv = serializeCsv(
      ["Booking Ref", "Status", "Gross", "Commission", "Net Payable", "Currency", "Eligible At"],
      livePayables.map((p) => [
        p.referenceCode || p.bookingId,
        p.status,
        (p.grossSubtotalMinor / 100).toFixed(2),
        (p.commissionMinor / 100).toFixed(2),
        (p.netPayableMinor / 100).toFixed(2),
        p.currency || currency,
        p.eligibleAt ?? ""
      ])
    );
    const saved = downloadCsvFile("host-settlement-payables.csv", csv);
    setStatusMessage(
      saved
        ? `Exported ${livePayables.length} settlement payable row(s) to CSV.`
        : "Prepared settlement CSV report."
    );
  };

  const combinedError =
    (businessesQuery.isError &&
      (businessesQuery.error instanceof Error
        ? businessesQuery.error.message
        : "Unable to load host businesses.")) ||
    (payoutQuery.isError &&
      (payoutQuery.error instanceof Error
        ? payoutQuery.error.message
        : "Unable to load payout account details.")) ||
    (financeQuery.isError &&
      (financeQuery.error instanceof Error
        ? financeQuery.error.message
        : "Unable to load settlement history.")) ||
    (payoutBatchesQuery.isError &&
      (payoutBatchesQuery.error instanceof Error
        ? payoutBatchesQuery.error.message
        : "Unable to load payout batch statements.")) ||
    null;

  const handleExportBatchCsv = () => {
    const csv = serializeCsv(
      [
        "Batch Code",
        "Bookings",
        "Gross Minor",
        "Commission Minor",
        "Net Payable Minor",
        "Currency",
        "Method",
        "Bank Reference",
        "Status",
        "Disbursed At"
      ],
      liveBatches.map((b) => [
        b.batchCode,
        b.itemCount,
        b.totalGrossMinor,
        b.totalCommissionMinor,
        b.totalNetPayableMinor,
        b.currency,
        b.payoutMethod,
        b.payoutReference ?? "",
        b.status,
        b.disbursedAt ?? ""
      ])
    );
    const saved = downloadCsvFile("host-payout-batches.csv", csv);
    setStatusMessage(
      saved
        ? `Exported ${liveBatches.length} payout batch statement(s) to CSV.`
        : "Prepared payout batch statement CSV."
    );
  };

  return (
    <div className="space-y-6">
      {combinedError && (
        <HostQueryErrorAlert
          message={combinedError}
          onRetry={() => {
            void businessesQuery.refetch();
            void payoutQuery.refetch();
            void financeQuery.refetch();
            void payoutBatchesQuery.refetch();
          }}
        />
      )}

      {statusMessage && (
        <div
          role="status"
          className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-950 flex items-center gap-2"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

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
                : "Manage corporate settlement bank beneficiary details (CEFT / SLIPS) and review eligible host settlement payables."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!showDemo && (
              <button
                type="button"
                onClick={handleExportPayoutCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-sand-300 hover:bg-sand-50 text-navy-900 text-xs font-bold transition"
              >
                <Download className="h-4 w-4 text-terracotta-600" />
                <span>Export CSV</span>
              </button>
            )}
            <button
              type="button"
              disabled={!showDemo && !activeBusiness}
              onClick={openEditModal}
              className="px-4 py-2.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition"
            >
              Update Bank Details
            </button>
          </div>
        </div>
      </div>

      {/* Mode & Governance Notice */}
      {showDemo ? (
        <div className="rounded-xl bg-sand-100/90 border border-sand-300 p-4 text-xs text-navy-800 flex items-start gap-3">
          <Info className="h-4 w-4 text-terracotta-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-navy-950">Payout Accounts (Demo Record):</strong> Bank
            beneficiary details and batch settlement records are illustrative fixtures for demo
            preview.
          </div>
        </div>
      ) : (
          <div className="rounded-xl bg-sand-100/90 border border-sand-300 p-4 text-xs text-navy-800 flex items-start gap-3">
          <Info className="h-4 w-4 text-terracotta-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-navy-950">Beneficiary &amp; Settlement Notice:</strong> Bank
            details saved below are encrypted and used for{" "}
            {activeBusiness?.tradeName || "your host organization"} payout batches and remittance
            statements.
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
      ) : liveBankName && liveAccountMasked ? (
        <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-navy-900 text-white flex items-center justify-center font-bold">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-navy-950">{liveBankName}</h2>
                <p className="text-xs text-navy-600">
                  {liveBranchCode ? `Branch Code ${liveBranchCode}` : "Sri Lanka CEFT / SLIPS"}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              Beneficiary On File
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
            <div>
              <span className="text-navy-500">Account Beneficiary:</span>
              <p className="font-bold text-navy-900">
                {liveAccountName || activeBusiness?.legalBusinessName || "—"}
              </p>
            </div>
            <div>
              <span className="text-navy-500">Masked Account Number:</span>
              <p className="font-mono font-bold text-navy-900">{liveAccountMasked}</p>
            </div>
            <div>
              <span className="text-navy-500">Clearing Method:</span>
              <p className="font-bold text-navy-900">CEFT / SLIPS (Same-Day Clearing)</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-sand-200 p-6 text-xs text-navy-600 shadow-sm">
          <p className="font-bold text-navy-950 mb-1">No Settlement Bank Account Configured</p>
          <p>
            Submit corporate bank beneficiary details via Update Bank Details so payouts can be
            routed cleanly when batch disbursement runs.
          </p>
        </div>
      )}

      {/* Live Settlement Payout Batches */}
      {!showDemo && (
        <div className="bg-white rounded-2xl border border-sand-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-sand-200 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-navy-950">Settlement Payout Batches</h3>
              <p className="text-[11px] text-navy-600">
                Disbursed and pending bank settlement runs with CEFT / SLIPS transfer references.
              </p>
            </div>
            {liveBatches.length > 0 && (
              <button
                type="button"
                onClick={handleExportBatchCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-sand-300 hover:bg-sand-50 text-navy-900 text-xs font-bold transition"
              >
                <Download className="h-3.5 w-3.5 text-terracotta-600" />
                <span>Export Remittance CSV</span>
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-sand-50 border-b border-sand-200 text-navy-500 uppercase font-bold text-[10px] tracking-wider">
                  <th className="p-3.5">Batch Code</th>
                  <th className="p-3.5">Bookings</th>
                  <th className="p-3.5">Net Settlement</th>
                  <th className="p-3.5">Method &amp; Reference</th>
                  <th className="p-3.5">Disbursed Date</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {liveBatches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-navy-500">
                      No settlement payout batches generated for this organization yet.
                    </td>
                  </tr>
                ) : (
                  liveBatches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-sand-50/70 transition">
                      <td className="p-3.5 font-mono font-bold text-navy-900">{batch.batchCode}</td>
                      <td className="p-3.5 text-navy-700">{batch.itemCount}</td>
                      <td className="p-3.5 font-bold text-emerald-700">
                        {formatLkrMinor(batch.totalNetPayableMinor, batch.currency)}
                      </td>
                      <td className="p-3.5 font-mono text-navy-700">
                        {batch.payoutMethod}
                        {batch.payoutReference ? ` • ${batch.payoutReference}` : ""}
                      </td>
                      <td className="p-3.5 text-navy-600">
                        {batch.disbursedAt
                          ? formatDateTimeDisplay(batch.disbursedAt)
                          : "Scheduled Transfer"}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            batch.status === "DISBURSED"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-amber-50 text-amber-950 border-amber-300"
                          }`}
                        >
                          {batch.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Batch / Settlement Payable History */}
      <div className="bg-white rounded-2xl border border-sand-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-sand-200">
          <h3 className="text-sm font-bold text-navy-950">
            {showDemo ? "Recent Weekly Batch Transfers" : "Host Settlement Payables Overview"}
          </h3>
        </div>
        <div className="overflow-x-auto">
          {showDemo ? (
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
                {demoBatches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-sand-50/70 transition">
                    <td className="p-3.5 font-mono font-bold text-navy-900">{batch.id}</td>
                    <td className="p-3.5 text-navy-700">{batch.date}</td>
                    <td className="p-3.5 font-bold text-emerald-700">
                      {formatLkr(batch.amountLkr)}
                    </td>
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
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-sand-50 border-b border-sand-200 text-navy-500 uppercase font-bold text-[10px] tracking-wider">
                  <th className="p-3.5">Booking Reference</th>
                  <th className="p-3.5">Accrued Date</th>
                  <th className="p-3.5">Net Payable</th>
                  <th className="p-3.5">Eligible Date</th>
                  <th className="p-3.5">Settlement Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {livePayables.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-navy-500">
                      No host settlement payables or payout batches recorded yet.
                    </td>
                  </tr>
                ) : (
                  livePayables.map((p) => (
                    <tr key={p.id} className="hover:bg-sand-50/70 transition">
                      <td className="p-3.5 font-mono font-bold text-navy-900">
                        {p.referenceCode || p.bookingId.slice(0, 8)}
                      </td>
                      <td className="p-3.5 text-navy-700">{formatDateTimeDisplay(p.accruedAt)}</td>
                      <td className="p-3.5 font-bold text-emerald-700">
                        {formatLkrMinor(p.netPayableMinor, p.currency)}
                      </td>
                      <td className="p-3.5 text-navy-600">
                        {p.eligibleAt ? formatDateTimeDisplay(p.eligibleAt) : "Awaiting Check-Out"}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            p.status === "ELIGIBLE"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : p.status === "ON_HOLD"
                                ? "bg-amber-50 text-amber-950 border-amber-300"
                                : "bg-sand-100 text-navy-700 border-sand-300"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Update Bank Beneficiary Modal */}
      {showEditBankModal && (
        <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={(e) => void handleSaveBankDetails(e)}
            className="bg-white rounded-2xl border border-sand-200 max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-sand-100 pb-3">
              <h3 className="text-base font-bold text-navy-950">Update Settlement Bank Details</h3>
              <button
                type="button"
                onClick={() => setShowEditBankModal(false)}
                className="p-1 rounded-lg hover:bg-sand-100 text-navy-500"
                aria-label="Close bank details modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-navy-600">
              Updates apply to upcoming settlement batches without altering your organization&apos;s
              verified operating status.
            </p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-navy-900 mb-1">Bank Name</label>
                <input
                  type="text"
                  value={showDemo ? "Commercial Bank of Ceylon PLC" : bankNameInput}
                  onChange={(e) => setBankNameInput(e.target.value)}
                  placeholder="Enter bank name"
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">Branch Code</label>
                <input
                  type="text"
                  value={branchCodeInput}
                  onChange={(e) => setBranchCodeInput(e.target.value)}
                  placeholder="e.g. 001 or CMB-FORT"
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">
                  Account Holder / Beneficiary Name
                </label>
                <input
                  type="text"
                  value={accountNameInput}
                  onChange={(e) => setAccountNameInput(e.target.value)}
                  placeholder="Corporate or proprietor beneficiary name"
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">Account Number</label>
                <input
                  type="text"
                  value={accountNumberInput}
                  onChange={(e) => setAccountNumberInput(e.target.value)}
                  placeholder="Enter 10-12 digit account number"
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>

            {modalError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-900"
              >
                {modalError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEditBankModal(false)}
                className="px-4 py-2 rounded-xl border border-sand-300 text-xs font-bold text-navy-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateBusinessMutation.isPending}
                className="px-4 py-2 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold"
              >
                {updateBusinessMutation.isPending ? "Saving..." : "Save Bank Details"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
