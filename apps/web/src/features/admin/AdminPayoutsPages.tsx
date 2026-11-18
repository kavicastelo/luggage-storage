import React, { useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { PAYOUT_METHODS, type PayoutMethod } from "@luggage-storage/contracts";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  Layers,
  Send
} from "lucide-react";
import { LoadingSkeleton, SlideOverDrawer } from "@/components/ui";
import { isDemoPreviewActive } from "@/config/demo-preview";
import { formatLkr } from "@/data/mock-marketplace";
import {
  useAdminEligiblePayablesQuery,
  useAdminPayoutBatchDetailQuery,
  useAdminPayoutBatchesQuery,
  useCreateAdminPayoutBatchMutation,
  useDisburseAdminPayoutBatchMutation
} from "@/hooks/queries/use-admin-portal";
import { downloadCsvFile, serializeCsv } from "@/lib/csv-export";
import { formatDateTimeDisplay, formatLkrMinor } from "@/lib/formatters";
import { useAuthStore } from "@/store/useAuthStore";
import {
  AdminCardListSkeleton,
  AdminEmptyStateCard,
  AdminPageHeader,
  AdminPaginationBar,
  AdminQueryErrorAlert,
  AdminTableSkeleton,
  isUuid,
  statusBadgeToneClasses
} from "./admin-helpers";

export function AdminHostPayoutBatchGenerationPage() {
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

  const [selectedMethods, setSelectedMethods] = useState<Record<string, PayoutMethod>>({});
  const [notesByBusiness, setNotesByBusiness] = useState<Record<string, string>>({});
  const [expandedBookings, setExpandedBookings] = useState<Record<string, boolean>>({});
  const [pendingBusinessId, setPendingBusinessId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [createdBatchCode, setCreatedBatchCode] = useState<string | null>(null);

  const eligibleQuery = useAdminEligiblePayablesQuery(undefined, {
    enabled: isAuthenticated && !showDemoPreview
  });
  const batchesQuery = useAdminPayoutBatchesQuery(
    { page: 1, limit: 10 },
    { enabled: isAuthenticated && !showDemoPreview }
  );
  const createBatchMutation = useCreateAdminPayoutBatchMutation();

  const groups = eligibleQuery.data ?? [];
  const recentBatches = batchesQuery.data?.batches ?? [];

  const totals = useMemo(() => {
    return groups.reduce(
      (acc, g) => ({
        count: acc.count + g.eligibleCount,
        gross: acc.gross + g.totalGrossMinor,
        commission: acc.commission + g.totalCommissionMinor,
        net: acc.net + g.totalNetPayableMinor
      }),
      { count: 0, gross: 0, commission: 0, net: 0 }
    );
  }, [groups]);

  const handleGenerateBatch = async (businessId: string, payableIds: string[]) => {
    setActionError(null);
    setCreatedBatchCode(null);
    setPendingBusinessId(businessId);
    try {
      const batch = await createBatchMutation.mutateAsync({
        businessId,
        payableIds,
        payoutMethod: selectedMethods[businessId] ?? "CEFT_SLIPS",
        notes: notesByBusiness[businessId]?.trim() || undefined
      });
      setCreatedBatchCode(batch.batchCode);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to generate payout batch.");
    } finally {
      setPendingBusinessId(null);
    }
  };

  const handleExportEligibleCsv = () => {
    const csv = serializeCsv(
      [
        "Business Name",
        "Legal Business Name",
        "Bank",
        "Account Beneficiary",
        "Masked Account",
        "Eligible Bookings",
        "Gross Minor",
        "Commission Minor",
        "Net Payable Minor",
        "Currency"
      ],
      groups.map((g) => [
        g.tradeName,
        g.legalBusinessName,
        g.payoutBankName ?? "",
        g.payoutAccountName ?? "",
        g.payoutAccountMasked ?? "",
        g.eligibleCount,
        g.totalGrossMinor,
        g.totalCommissionMinor,
        g.totalNetPayableMinor,
        g.currency
      ])
    );
    downloadCsvFile("eligible-host-payables-summary.csv", csv);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Host Payout Batch Generation"
        subtitle="Group eligible completed host payables by verified organization and lock settlement batches for bank transfer."
        badge={showDemoPreview ? "Demo Preview" : "Live Non-Escrow Settlement"}
        rightSlot={
          !showDemoPreview ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportEligibleCsv}
                disabled={groups.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-sand-200 bg-white text-xs font-bold text-navy-900 hover:bg-sand-100 disabled:opacity-40 transition"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export CSV</span>
              </button>
              <Link
                to="/admin/payouts/disburse"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold transition shadow-sm"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Disbursement Console</span>
              </Link>
            </div>
          ) : undefined
        }
      />

      {showDemoPreview ? (
        <div className="bg-white rounded-2xl border border-sand-200 p-6 flex items-center justify-between text-xs shadow-sm">
          <div>
            <p className="font-bold text-navy-950">Sample Payout Cycle Preview</p>
            <p className="text-sand-700 mt-0.5">Eligible partner settlements ready for batching.</p>
          </div>
          <span className="font-extrabold text-emerald-700 tabular-nums">{formatLkr(1245000)}</span>
        </div>
      ) : (
        <>
          {eligibleQuery.isError && (
            <AdminQueryErrorAlert
              message={
                eligibleQuery.error instanceof Error
                  ? eligibleQuery.error.message
                  : "Unable to load eligible host payables."
              }
              onRetry={() => void eligibleQuery.refetch()}
            />
          )}

          {actionError && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-900"
            >
              {actionError}
            </div>
          )}

          {createdBatchCode && (
            <div
              role="status"
              className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-950 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>
                  Locked payout batch <span className="font-mono">{createdBatchCode}</span> in
                  GENERATED state. Proceed to record bank wire proof upon transfer.
                </span>
              </div>
              <Link
                to={`/admin/payouts/disburse${querySuffix}`}
                className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition"
              >
                Record Wire Proof
              </Link>
            </div>
          )}

          {/* Aggregate Totals */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="bg-white rounded-2xl border border-sand-200 p-4 shadow-sm">
              <span className="text-[11px] font-bold uppercase text-sand-700">
                Eligible Payables Queue
              </span>
              {eligibleQuery.isLoading ? (
                <LoadingSkeleton variant="text" className="h-6 w-32 mt-2" />
              ) : (
                <p className="text-lg font-extrabold text-navy-950 mt-1 tabular-nums">
                  {totals.count} booking payable(s)
                </p>
              )}
            </div>
            <div className="bg-white rounded-2xl border border-sand-200 p-4 shadow-sm">
              <span className="text-[11px] font-bold uppercase text-sand-700">
                Gross Storage / Commission (15%)
              </span>
              {eligibleQuery.isLoading ? (
                <LoadingSkeleton variant="text" className="h-6 w-40 mt-2" />
              ) : (
                <p className="text-sm font-bold text-navy-900 mt-1 tabular-nums">
                  {formatLkrMinor(totals.gross, "LKR")} gross • {formatLkrMinor(totals.commission, "LKR")} fee
                </p>
              )}
            </div>
            <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 shadow-sm">
              <span className="text-[11px] font-bold uppercase text-emerald-800">
                Ready for Host Settlement (85%)
              </span>
              {eligibleQuery.isLoading ? (
                <LoadingSkeleton variant="text" className="h-6 w-32 mt-2" />
              ) : (
                <p className="text-lg font-extrabold text-emerald-950 mt-1 tabular-nums">
                  {formatLkrMinor(totals.net, "LKR")}
                </p>
              )}
            </div>
          </div>

          {eligibleQuery.isLoading ? (
            <div className="bg-white rounded-2xl border border-sand-200 p-6 shadow-sm">
              <AdminCardListSkeleton count={3} />
            </div>
          ) : groups.length === 0 ? (
            <AdminEmptyStateCard
              title="No Unbatched Eligible Payables Pending"
              description="Completed bookings whose luggage has been released cleanly without active disputes automatically accrue ELIGIBLE host payables here for weekly or manual batch generation."
              actionTo="/admin/payouts/disburse"
              actionLabel="Review Existing Payout Batches"
            />
          ) : (
            <div className="space-y-4">
              {groups.map((group) => {
                const method = selectedMethods[group.businessId] ?? "CEFT_SLIPS";
                const bankConfigured = Boolean(group.payoutBankName && group.payoutAccountMasked);
                const isExpanded = Boolean(expandedBookings[group.businessId]);
                const isThisBusinessPending = pendingBusinessId === group.businessId;
                return (
                  <div
                    key={group.businessId}
                    className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-4 text-xs"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-terracotta-600" />
                          <h2 className="text-sm font-extrabold text-navy-950">
                            {group.tradeName}
                          </h2>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10px] tabular-nums">
                            {group.eligibleCount} Eligible Booking(s)
                          </span>
                        </div>
                        <p className="text-sand-700">
                          {group.legalBusinessName} •{" "}
                          {bankConfigured
                            ? `${group.payoutBankName} (${group.payoutAccountMasked})`
                            : "Beneficiary bank account not yet configured"}
                        </p>
                      </div>
                      <div className="text-left md:text-right">
                        <span className="text-[11px] font-bold text-sand-700 uppercase">
                          Net Payout Batch Amount
                        </span>
                        <p className="text-lg font-extrabold text-emerald-700 tabular-nums">
                          {formatLkrMinor(group.totalNetPayableMinor, group.currency)}
                        </p>
                      </div>
                    </div>

                    {!bankConfigured && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 flex items-center gap-2 font-semibold">
                        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                        <span>
                          Beneficiary bank details are incomplete on this host account. Verify wire
                          instructions offline before marking the batch disbursed.
                        </span>
                      </div>
                    )}

                    {/* Collapsible Eligible Bookings Preview */}
                    <div className="border border-sand-200 rounded-xl overflow-hidden bg-sand-50/50">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() =>
                          setExpandedBookings((prev) => ({
                            ...prev,
                            [group.businessId]: !prev[group.businessId]
                          }))
                        }
                        className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-navy-900 hover:bg-sand-100/70 transition"
                      >
                        <span>
                          Preview Eligible Booking Payables ({group.payables.length})
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-sand-700" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-sand-700" />
                        )}
                      </button>
                      {isExpanded && (
                        <div className="border-t border-sand-200 bg-white overflow-x-auto">
                          <table className="w-full text-left border-collapse text-[11px]">
                            <thead>
                              <tr className="bg-sand-50 border-b border-sand-200 text-sand-700 uppercase font-bold text-[10px]">
                                <th className="p-2.5">Booking Ref</th>
                                <th className="p-2.5">Gross</th>
                                <th className="p-2.5">Commission (15%)</th>
                                <th className="p-2.5">Net Payable</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-sand-100 tabular-nums">
                              {group.payables.map((p) => (
                                <tr key={p.id}>
                                  <td className="p-2.5 font-mono font-bold">
                                    <Link
                                      to={`/admin/bookings/${p.bookingId}${querySuffix}`}
                                      className="text-terracotta-600 hover:underline"
                                    >
                                      {p.referenceCode || p.bookingId.slice(0, 8)}
                                    </Link>
                                  </td>
                                  <td className="p-2.5 text-navy-900">
                                    {formatLkrMinor(p.grossSubtotalMinor, p.currency)}
                                  </td>
                                  <td className="p-2.5 text-sand-700">
                                    {formatLkrMinor(p.commissionMinor, p.currency)}
                                  </td>
                                  <td className="p-2.5 font-bold text-emerald-700">
                                    {formatLkrMinor(p.netPayableMinor, p.currency)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                      <div>
                        <label className="block font-bold text-navy-900 mb-1">
                          Settlement Rail
                        </label>
                        <select
                          value={method}
                          onChange={(e) =>
                            setSelectedMethods((prev) => ({
                              ...prev,
                              [group.businessId]: e.target.value as PayoutMethod
                            }))
                          }
                          className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-xs font-semibold text-navy-950"
                        >
                          {PAYOUT_METHODS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold text-navy-900 mb-1">
                          Batch Note (Optional)
                        </label>
                        <input
                          type="text"
                          value={notesByBusiness[group.businessId] ?? ""}
                          onChange={(e) =>
                            setNotesByBusiness((prev) => ({
                              ...prev,
                              [group.businessId]: e.target.value
                            }))
                          }
                          placeholder="e.g. Weekly Colombo Friday CEFT Run"
                          className="w-full rounded-xl border border-sand-200 px-3 py-2 text-xs text-navy-950"
                        />
                      </div>
                      <div className="flex sm:justify-end">
                        <button
                          type="button"
                          disabled={createBatchMutation.isPending}
                          onClick={() =>
                            void handleGenerateBatch(
                              group.businessId,
                              group.payables.map((p) => p.id)
                            )
                          }
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 disabled:opacity-50 text-white font-bold transition shadow-sm"
                        >
                          <Layers className="h-3.5 w-3.5" />
                          <span>
                            {isThisBusinessPending ? "Locking Batch..." : "Generate Payout Batch"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {recentBatches.length > 0 && (
            <div className="bg-white rounded-2xl border border-sand-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-sand-200 flex items-center justify-between">
                <h3 className="text-sm font-bold text-navy-950">Recent Payout Batches</h3>
                <Link
                  to="/admin/payouts/disburse"
                  className="text-xs font-bold text-terracotta-600 hover:text-terracotta-700"
                >
                  Open Disbursement Queue
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-sand-50 border-b border-sand-200 text-sand-700 uppercase font-bold text-[10px]">
                      <th className="p-3.5">Batch Code</th>
                      <th className="p-3.5">Host Organization</th>
                      <th className="p-3.5">Items</th>
                      <th className="p-3.5">Net Payable</th>
                      <th className="p-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sand-100 tabular-nums">
                    {recentBatches.map((batch) => (
                      <tr key={batch.id} className="hover:bg-sand-50/70">
                        <td className="p-3.5 font-mono font-bold text-navy-950">
                          <Link
                            to={`/admin/payouts/disburse?batch=${batch.id}`}
                            className="text-terracotta-600 hover:underline"
                          >
                            {batch.batchCode}
                          </Link>
                        </td>
                        <td className="p-3.5 text-navy-900">{batch.businessName}</td>
                        <td className="p-3.5 text-navy-900">{batch.itemCount}</td>
                        <td className="p-3.5 font-bold text-emerald-700">
                          {formatLkrMinor(batch.totalNetPayableMinor, batch.currency)}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeToneClasses(
                              batch.status === "DISBURSED" ? "PAID" : "PENDING_PAYMENT"
                            )}`}
                          >
                            {batch.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function AdminManualPayoutDisbursementPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuthStore();

  const showDemoPreview =
    !isAuthenticated &&
    isDemoPreviewActive({
      allowDemoPreview: true,
      search: location.search,
      isAuthenticated
    });

  const [statusFilter, setStatusFilter] = useState<"ALL" | "GENERATED" | "DISBURSED">("ALL");
  const [page, setPage] = useState(1);
  const limit = 20;

  const inspectedBatchParam = searchParams.get("batch");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(
    isUuid(inspectedBatchParam) ? inspectedBatchParam : null
  );
  const effectiveBatchId =
    selectedBatchId ?? (isUuid(inspectedBatchParam) ? inspectedBatchParam : null);

  const [payoutReference, setPayoutReference] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("CEFT_SLIPS");
  const [disburseNotes, setDisburseNotes] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const batchesQuery = useAdminPayoutBatchesQuery(
    {
      page,
      limit,
      status: statusFilter === "ALL" ? undefined : statusFilter
    },
    { enabled: isAuthenticated && !showDemoPreview }
  );

  const detailQuery = useAdminPayoutBatchDetailQuery(effectiveBatchId ?? undefined, {
    enabled: isAuthenticated && !showDemoPreview && Boolean(effectiveBatchId)
  });

  const disburseMutation = useDisburseAdminPayoutBatchMutation();

  const batches = batchesQuery.data?.batches ?? [];
  const total = batchesQuery.data?.total ?? 0;
  const totalPages = batchesQuery.data?.pagination?.totalPages ?? 1;
  const inspectedBatch = detailQuery.data ?? null;

  const openBatch = (batchId: string) => {
    setActionError(null);
    setActionSuccess(null);
    setPayoutReference("");
    setDisburseNotes("");
    setSelectedBatchId(batchId);
    const next = new URLSearchParams(searchParams);
    next.set("batch", batchId);
    setSearchParams(next);
  };

  const closeBatch = () => {
    setSelectedBatchId(null);
    setActionError(null);
    if (searchParams.has("batch")) {
      const next = new URLSearchParams(searchParams);
      next.delete("batch");
      setSearchParams(next);
    }
  };

  const handleDisburseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveBatchId) return;
    setActionError(null);
    setActionSuccess(null);

    if (payoutReference.trim().length < 3) {
      setActionError("Enter the bank wire or CEFT reference number (minimum 3 characters).");
      return;
    }

    try {
      const updated = await disburseMutation.mutateAsync({
        batchId: effectiveBatchId,
        data: {
          payoutReference: payoutReference.trim(),
          payoutMethod,
          notes: disburseNotes.trim() || undefined
        }
      });
      setActionSuccess(
        `Batch ${updated.batchCode} marked DISBURSED (${updated.payoutReference}). Balanced double-entry ledger group posted.`
      );
      setPayoutReference("");
      setDisburseNotes("");
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to disburse payout batch.");
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Manual Payout Disbursement & Proof Entry"
        subtitle="Record bank wire confirmation references and clear settled host payable liabilities in the double-entry ledger."
        badge={showDemoPreview ? "Demo Preview" : "Live Wire Attestation"}
        rightSlot={
          !showDemoPreview ? (
            <Link
              to="/admin/payouts/batches"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-sand-200 bg-white text-xs font-bold text-navy-900 hover:bg-sand-100 transition"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Generate New Batch</span>
            </Link>
          ) : undefined
        }
      />

      {showDemoPreview ? (
        <div className="bg-white rounded-2xl border border-sand-200 p-6 text-xs space-y-2 shadow-sm">
          <p className="font-bold text-navy-950">Manual Wire Proof Entry (Demo Preview)</p>
          <p className="text-sand-700">Commercial Bank SLFT settlement proof preview.</p>
        </div>
      ) : (
        <>
          {batchesQuery.isError && (
            <AdminQueryErrorAlert
              message={
                batchesQuery.error instanceof Error
                  ? batchesQuery.error.message
                  : "Unable to load payout batches."
              }
              onRetry={() => void batchesQuery.refetch()}
            />
          )}

          {actionError && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-900"
            >
              {actionError}
            </div>
          )}

          {actionSuccess && (
            <div
              role="status"
              className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-950 flex flex-wrap items-center justify-between gap-2"
            >
              <span>{actionSuccess}</span>
              <Link
                to="/admin/finance/ledger"
                className="px-3 py-1 rounded-lg bg-emerald-700 text-white font-bold"
              >
                Inspect Financial Ledger
              </Link>
            </div>
          )}

          {/* Status Filter Bar */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {(["ALL", "GENERATED", "DISBURSED"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setStatusFilter(status);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-full font-bold transition ${
                  statusFilter === status
                    ? "bg-navy-900 text-white shadow-sm"
                    : "bg-white border border-sand-200 text-navy-900 hover:bg-sand-100"
                }`}
              >
                {status === "ALL" ? "All Batches" : status}
              </button>
            ))}
          </div>

          {batchesQuery.isLoading ? (
            <div className="bg-white rounded-2xl border border-sand-200 p-6 shadow-sm">
              <AdminTableSkeleton rows={5} columns={7} />
            </div>
          ) : batches.length === 0 ? (
            <AdminEmptyStateCard
              title="No Payout Batches Found"
              description="Generate a payout batch from eligible host payables first, then return here to record CEFT / SLIPS wire proof."
              actionTo="/admin/payouts/batches"
              actionLabel="Go to Payout Batch Generation"
            />
          ) : (
            <div className="bg-white rounded-2xl border border-sand-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-sand-50 border-b border-sand-200 text-sand-700 uppercase font-bold text-[10px]">
                      <th className="p-3.5">Batch Code</th>
                      <th className="p-3.5">Host Organization</th>
                      <th className="p-3.5">Beneficiary Bank</th>
                      <th className="p-3.5">Bookings</th>
                      <th className="p-3.5">Net Amount</th>
                      <th className="p-3.5">Wire Ref</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sand-100 tabular-nums">
                    {batches.map((batch) => (
                      <tr key={batch.id} className="hover:bg-sand-50/70 transition">
                        <td className="p-3.5 font-mono font-bold text-navy-950">
                          {batch.batchCode}
                        </td>
                        <td className="p-3.5 font-semibold text-navy-900">{batch.businessName}</td>
                        <td className="p-3.5 text-sand-700">
                          {batch.payoutBankName
                            ? `${batch.payoutBankName} (${batch.payoutAccountMasked ?? "****"})`
                            : "Not Configured"}
                        </td>
                        <td className="p-3.5 text-navy-900">{batch.itemCount}</td>
                        <td className="p-3.5 font-bold text-emerald-700">
                          {formatLkrMinor(batch.totalNetPayableMinor, batch.currency)}
                        </td>
                        <td className="p-3.5 font-mono text-sand-700">
                          {batch.payoutReference || "—"}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeToneClasses(
                              batch.status === "DISBURSED" ? "PAID" : "PENDING_PAYMENT"
                            )}`}
                          >
                            {batch.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => openBatch(batch.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white font-bold transition"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>{batch.status === "GENERATED" ? "Disburse" : "Inspect"}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4">
                <AdminPaginationBar
                  page={page}
                  totalPages={totalPages}
                  total={total}
                  onPageChange={setPage}
                />
              </div>
            </div>
          )}

          {/* Batch Detail & Disbursement Slide-Over Drawer */}
          <SlideOverDrawer
            open={!showDemoPreview && Boolean(effectiveBatchId)}
            onClose={closeBatch}
            ariaLabel="Payout Batch Disbursement Drawer"
            closeLabel="Close payout batch drawer"
            size="xl"
            title={
              inspectedBatch?.batchCode ??
              (effectiveBatchId ? `Batch ${effectiveBatchId.slice(0, 8)}` : "Payout Batch")
            }
            subtitle={
              inspectedBatch
                ? `${inspectedBatch.legalBusinessName} • ${inspectedBatch.itemCount} booking payable(s) • Net ${formatLkrMinor(
                    inspectedBatch.totalNetPayableMinor,
                    inspectedBatch.currency
                  )}`
                : undefined
            }
            badge={
              inspectedBatch && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeToneClasses(
                    inspectedBatch.status === "DISBURSED" ? "PAID" : "PENDING_PAYMENT"
                  )}`}
                >
                  {inspectedBatch.status}
                </span>
              )
            }
          >
            <div className="space-y-5 text-xs">
              {detailQuery.isError ? (
                <AdminQueryErrorAlert
                  message={
                    detailQuery.error instanceof Error
                      ? detailQuery.error.message
                      : "Unable to load payout batch detail."
                  }
                  onRetry={() => void detailQuery.refetch()}
                />
              ) : detailQuery.isLoading || !inspectedBatch ? (
                <AdminCardListSkeleton count={3} />
              ) : (
                <>
                  {inspectedBatch.ledgerTransactionGroupId && (
                    <div className="flex justify-end">
                      <Link
                        to="/admin/finance/ledger"
                        className="px-3 py-1.5 rounded-lg border border-terracotta-200 bg-terracotta-50 text-terracotta-800 font-bold hover:bg-terracotta-100 transition"
                      >
                        Ledger Tx: {inspectedBatch.ledgerTransactionGroupId.slice(0, 8)}...
                      </Link>
                    </div>
                  )}

                  {inspectedBatch.status === "GENERATED" ? (
                    <form
                      onSubmit={(e) => void handleDisburseSubmit(e)}
                      className="rounded-xl bg-sand-50 border border-sand-200 p-4 space-y-3"
                    >
                      <h3 className="font-bold text-navy-950">
                        Record Manual Bank Wire / CEFT Proof &amp; Settle Host Payables
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block font-bold text-navy-900 mb-1">
                            Bank Transfer Reference
                          </label>
                          <input
                            type="text"
                            required
                            value={payoutReference}
                            onChange={(e) => setPayoutReference(e.target.value)}
                            placeholder="e.g. CEFT-20261116-90412"
                            className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 font-mono text-navy-950"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-navy-900 mb-1">
                            Payout Method
                          </label>
                          <select
                            value={payoutMethod}
                            onChange={(e) => setPayoutMethod(e.target.value as PayoutMethod)}
                            className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 font-semibold text-navy-950"
                          >
                            {PAYOUT_METHODS.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-bold text-navy-900 mb-1">
                            Attestation Notes (Optional)
                          </label>
                          <input
                            type="text"
                            value={disburseNotes}
                            onChange={(e) => setDisburseNotes(e.target.value)}
                            placeholder="Verified Commercial Bank SLIPS receipt"
                            className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-navy-950"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={disburseMutation.isPending}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold transition"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>
                            {disburseMutation.isPending
                              ? "Posting Ledger Settlement..."
                              : "Confirm Wire Proof & Mark Disbursed"}
                          </span>
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-950 space-y-1">
                      <p className="font-bold">
                        Disbursed via {inspectedBatch.payoutMethod} • Ref{" "}
                        <span className="font-mono">{inspectedBatch.payoutReference}</span>
                      </p>
                      {inspectedBatch.disbursedAt && (
                        <p className="tabular-nums">
                          Disbursed At: {formatDateTimeDisplay(inspectedBatch.disbursedAt)}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <h3 className="font-bold text-navy-950 mb-2">Included Booking Payables</h3>
                    <div className="overflow-x-auto border border-sand-200 rounded-xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-sand-50 border-b border-sand-200 text-sand-700 uppercase font-bold text-[10px]">
                            <th className="p-3">Booking Ref</th>
                            <th className="p-3">Gross</th>
                            <th className="p-3">Commission (15%)</th>
                            <th className="p-3">Net Payable</th>
                            <th className="p-3">Payable Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-sand-100 tabular-nums">
                          {inspectedBatch.items.map((item) => (
                            <tr key={item.id}>
                              <td className="p-3 font-mono font-bold text-navy-950">
                                <Link
                                  to={`/admin/bookings/${item.bookingId}`}
                                  className="text-terracotta-600 hover:underline"
                                >
                                  {item.referenceCode || item.bookingId.slice(0, 8)}
                                </Link>
                              </td>
                              <td className="p-3 text-navy-900">
                                {formatLkrMinor(item.grossSubtotalMinor, item.currency)}
                              </td>
                              <td className="p-3 text-sand-700">
                                {formatLkrMinor(item.commissionMinor, item.currency)}
                              </td>
                              <td className="p-3 font-bold text-emerald-700">
                                {formatLkrMinor(item.netPayableMinor, item.currency)}
                              </td>
                              <td className="p-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeToneClasses(
                                    item.payableStatus
                                  )}`}
                                >
                                  {item.payableStatus}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </SlideOverDrawer>
        </>
      )}
    </div>
  );
}
