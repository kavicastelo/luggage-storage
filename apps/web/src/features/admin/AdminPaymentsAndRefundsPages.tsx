import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import {
  REFUND_STATUSES,
  SYSTEM_PERMISSIONS,
  type AdminTransitionRefundRequest,
  type RefundRecord,
  type RefundSettlementMode,
  type RefundStatus
} from "@luggage-storage/contracts";
import { Download } from "lucide-react";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { MascotIllustration } from "@/components/ui";
import { isDemoPreviewActive } from "@/config/demo-preview";
import { formatLkr } from "@/data/mock-marketplace";
import {
  useAdminPaymentTransactionsQuery,
  useAdminRefundsQuery,
  useAdminTransitionRefundMutation
} from "@/hooks/queries/use-admin-portal";
import { downloadCsvFile, serializeCsv } from "@/lib/csv-export";
import { formatDateTimeDisplay, formatLkrMinor } from "@/lib/formatters";
import { useAuthStore } from "@/store/useAuthStore";
import {
  AdminEmptyStateCard,
  AdminPageHeader,
  AdminPaginationBar,
  AdminQueryErrorAlert,
  formatAdminRefundStatus,
  isUuid,
  statusBadgeToneClasses
} from "./admin-helpers";
import { useAdminRole } from "./AdminDashboardLayout";

type TransitionTargetStatus = AdminTransitionRefundRequest["targetStatus"];

const VALID_REFUND_TRANSITIONS: Record<RefundStatus, TransitionTargetStatus[]> = {
  REQUESTED: ["AUTHORIZED", "MANUAL_REVIEW_REQUIRED"],
  AUTHORIZED: ["INITIATED", "SUCCEEDED", "FAILED", "MANUAL_REVIEW_REQUIRED"],
  INITIATED: ["PROCESSING", "SUCCEEDED", "FAILED", "MANUAL_REVIEW_REQUIRED"],
  PROCESSING: ["SUCCEEDED", "FAILED", "MANUAL_REVIEW_REQUIRED"],
  MANUAL_REVIEW_REQUIRED: ["AUTHORIZED", "INITIATED", "SUCCEEDED", "FAILED"],
  FAILED: ["AUTHORIZED", "MANUAL_REVIEW_REQUIRED"],
  SUCCEEDED: []
};

export function AdminPaymentTransactionsLogPage() {
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();

  const showDemoPreview =
    !isAuthenticated &&
    isDemoPreviewActive({
      allowDemoPreview: true,
      search: location.search,
      isAuthenticated
    });

  const [bookingIdInput, setBookingIdInput] = useState("");
  const [appliedBookingId, setAppliedBookingId] = useState<string | undefined>(undefined);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 20;

  const txQuery = useAdminPaymentTransactionsQuery(
    { page, limit, bookingId: appliedBookingId },
    { enabled: isAuthenticated && !showDemoPreview }
  );

  const transactions = txQuery.data?.transactions ?? [];
  const total = txQuery.data?.total ?? 0;

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = bookingIdInput.trim();
    if (!trimmed) {
      setFilterError(null);
      setAppliedBookingId(undefined);
      setPage(1);
      return;
    }
    if (!isUuid(trimmed)) {
      setFilterError("Enter a valid Booking UUID to filter payment transactions.");
      return;
    }
    setFilterError(null);
    setAppliedBookingId(trimmed);
    setPage(1);
  };

  const handleExportCsv = () => {
    const csv = serializeCsv(
      [
        "Transaction ID",
        "Booking Reference",
        "Booking ID",
        "Type",
        "Provider",
        "Provider Reference",
        "Evidence Source",
        "Manual Reference",
        "Signature Verified",
        "Amount Minor",
        "Currency",
        "Status",
        "Created At"
      ],
      transactions.map((tx) => [
        tx.id,
        tx.referenceCode ?? "",
        tx.bookingId,
        tx.transactionType,
        tx.provider,
        tx.providerTransactionId ?? "",
        tx.evidenceSource,
        tx.manualReference ?? "",
        tx.signatureVerified,
        tx.amountMinor,
        tx.currency,
        tx.status,
        tx.createdAt
      ])
    );
    downloadCsvFile(`admin-payment-transactions-page-${page}.csv`, csv);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Payment Gateway Transactions & Evidence Log"
        subtitle="Audit live gateway charges, signed IPN verifications, sandbox simulations, and manual offline refund references."
        rightSlot={
          <div className="flex items-center gap-3">
            {!showDemoPreview && transactions.length > 0 && (
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            )}
            <MascotIllustration mascot="key" size="sm" caption="Evidence Audit" />
          </div>
        }
      />

      {txQuery.isError && (
        <AdminQueryErrorAlert
          message={
            txQuery.error instanceof Error
              ? txQuery.error.message
              : "Unable to load payment transactions."
          }
          onRetry={() => void txQuery.refetch()}
        />
      )}

      {filterError && <AdminQueryErrorAlert message={filterError} />}

      {!showDemoPreview && (
        <form
          onSubmit={handleFilterSubmit}
          className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-2 items-center"
        >
          <input
            type="text"
            value={bookingIdInput}
            onChange={(e) => setBookingIdInput(e.target.value)}
            placeholder="Filter by Booking UUID..."
            className="flex-1 min-w-[240px] px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
          >
            Apply Booking Filter
          </button>
          {appliedBookingId && (
            <button
              type="button"
              onClick={() => {
                setBookingIdInput("");
                setAppliedBookingId(undefined);
                setFilterError(null);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
            >
              Reset
            </button>
          )}
        </form>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        {showDemoPreview ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <p className="font-bold text-slate-900">
                PAYHERE CHARGE • Sample Gateway Settled (Demo Preview)
              </p>
              <p className="text-slate-600 mt-0.5">
                evidence=PROVIDER_WEBHOOK • sigVerified=true
              </p>
            </div>
            <span className="font-extrabold text-emerald-700">{formatLkr(2400)}</span>
          </div>
        ) : txQuery.isLoading ? (
          <p className="text-xs text-slate-500 py-4 text-center">Loading transactions...</p>
        ) : transactions.length === 0 ? (
          <AdminEmptyStateCard
            title="No payment transactions recorded"
            description="Verified gateway charges and settlement refund entries appear here as bookings settle."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-2.5 pr-4 font-bold">Booking / Type</th>
                  <th className="pb-2.5 pr-4 font-bold">Provider & Reference</th>
                  <th className="pb-2.5 pr-4 font-bold">Evidence Attribution</th>
                  <th className="pb-2.5 pr-4 font-bold">Amount</th>
                  <th className="pb-2.5 pr-4 font-bold">Status</th>
                  <th className="pb-2.5 font-bold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="py-3 pr-4">
                      <p className="font-mono font-bold text-slate-900">
                        {tx.referenceCode || tx.bookingId.slice(0, 8)}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-600">
                        {tx.transactionType}
                      </p>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="font-bold text-slate-900">{tx.provider}</p>
                      <p className="text-[11px] font-mono text-slate-600">
                        {tx.providerTransactionId || tx.manualReference || "No provider reference"}
                      </p>
                    </td>
                    <td className="py-3 pr-4 text-[11px] text-slate-700">
                      <p>
                        evidence={tx.evidenceSource} • sigVerified={String(tx.signatureVerified)}
                      </p>
                      {tx.manualReference && (
                        <p className="font-mono text-amber-800 mt-0.5">
                          Manual Ref: {tx.manualReference}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-4 font-bold text-slate-900">
                      {formatLkrMinor(tx.amountMinor, tx.currency)}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeToneClasses(tx.status)}`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-3 text-[11px] text-slate-600">
                      {formatDateTimeDisplay(tx.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!showDemoPreview && transactions.length > 0 && (
          <AdminPaginationBar
            page={page}
            totalPages={Math.max(1, txQuery.data?.pagination?.totalPages ?? Math.ceil(total / limit))}
            total={total}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}

export function AdminRefundManagementQueuePage() {
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

  const [statusFilter, setStatusFilter] = useState<RefundStatus | "ALL">("ALL");
  const [bookingIdInput, setBookingIdInput] = useState("");
  const [appliedBookingId, setAppliedBookingId] = useState<string | undefined>(undefined);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [activeTransition, setActiveTransition] = useState<{
    refund: RefundRecord;
    targetStatus: TransitionTargetStatus;
  } | null>(null);
  const [settlementMode, setSettlementMode] =
    useState<RefundSettlementMode>("PROVIDER_CONFIRMED");
  const [providerRefundIdInput, setProviderRefundIdInput] = useState("");
  const [manualReferenceInput, setManualReferenceInput] = useState("");
  const [auditNotesInput, setAuditNotesInput] = useState("");
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundNotice, setRefundNotice] = useState<string | null>(null);

  const refundsQuery = useAdminRefundsQuery(
    {
      page,
      limit,
      status: statusFilter === "ALL" ? undefined : statusFilter,
      bookingId: appliedBookingId
    },
    { enabled: isAuthenticated && !showDemoPreview }
  );

  const transitionMutation = useAdminTransitionRefundMutation();
  const refunds = refundsQuery.data?.refunds ?? [];
  const total = refundsQuery.data?.total ?? 0;

  const openTransitionPanel = (refund: RefundRecord, targetStatus: TransitionTargetStatus) => {
    setRefundNotice(null);
    setRefundError(null);
    setActiveTransition({ refund, targetStatus });
    setSettlementMode(refund.settlementMode ?? "PROVIDER_CONFIRMED");
    setProviderRefundIdInput(refund.providerRefundId ?? "");
    setManualReferenceInput(refund.manualReference ?? "");
    setAuditNotesInput("");
  };

  const handleSubmitTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTransition || transitionMutation.isPending) return;

    const { refund, targetStatus } = activeTransition;
    const trimmedNotes = auditNotesInput.trim();
    if (trimmedNotes.length < 3) {
      setRefundError("Audit notes must be at least 3 characters.");
      return;
    }

    const payload: AdminTransitionRefundRequest = {
      targetStatus,
      notes: trimmedNotes
    };

    if (targetStatus === "SUCCEEDED") {
      payload.settlementMode = settlementMode;
      if (settlementMode === "PROVIDER_CONFIRMED") {
        const trimmedProviderId = providerRefundIdInput.trim();
        if (trimmedProviderId.length < 3) {
          setRefundError("Provider refund reference (min 3 chars) is required.");
          return;
        }
        payload.providerRefundId = trimmedProviderId;
      } else {
        const trimmedManual = manualReferenceInput.trim();
        if (trimmedManual.length < 3) {
          setRefundError("Manual offline settlement reference (min 3 chars) is required.");
          return;
        }
        payload.manualReference = trimmedManual;
      }
    }

    setRefundError(null);
    setRefundNotice(null);
    try {
      const updated = await transitionMutation.mutateAsync({
        refundId: refund.id,
        data: payload
      });
      setRefundNotice(
        `Refund ${updated.referenceCode || updated.bookingId.slice(0, 8)} transitioned to ${updated.status}.`
      );
      setActiveTransition(null);
    } catch (err) {
      setRefundError(err instanceof Error ? err.message : "Refund state transition failed.");
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Refund Management & 7-Stage Recovery Queue"
        subtitle="Execute full 7-stage refund transitions including non-linear recovery from FAILED or MANUAL_REVIEW_REQUIRED back to settlement."
        rightSlot={
          <MascotIllustration mascot="sitting-suitcase" size="sm" caption="7-Stage Recovery" />
        }
      />

      {effectiveAdminRole === "SUPPORT" && (
        <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold">
          Read-Only Support View (Refund State Transitions Restricted to Superadmin)
        </div>
      )}

      {refundsQuery.isError && (
        <AdminQueryErrorAlert
          message={
            refundsQuery.error instanceof Error
              ? refundsQuery.error.message
              : "Unable to load refund queue."
          }
          onRetry={() => void refundsQuery.refetch()}
        />
      )}

      {filterError && <AdminQueryErrorAlert message={filterError} />}

      {refundError && (
        <AdminQueryErrorAlert
          message={refundError}
          onRetry={() => void refundsQuery.refetch()}
        />
      )}

      {refundNotice && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900"
        >
          {refundNotice}
        </div>
      )}

      {/* Filters */}
      {!showDemoPreview && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = bookingIdInput.trim();
              if (!trimmed) {
                setFilterError(null);
                setAppliedBookingId(undefined);
                setPage(1);
                return;
              }
              if (!isUuid(trimmed)) {
                setFilterError("Enter a valid Booking UUID.");
                return;
              }
              setFilterError(null);
              setAppliedBookingId(trimmed);
              setPage(1);
            }}
            className="flex flex-wrap gap-2"
          >
            <input
              type="text"
              value={bookingIdInput}
              onChange={(e) => setBookingIdInput(e.target.value)}
              placeholder="Filter refunds by Booking UUID..."
              className="flex-1 min-w-[240px] px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
            >
              Filter by Booking
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                setStatusFilter("ALL");
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                statusFilter === "ALL"
                  ? "bg-purple-700 text-white"
                  : "bg-slate-50 border border-slate-200 text-slate-700"
              }`}
            >
              All Refunds
            </button>
            {REFUND_STATUSES.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                  statusFilter === st
                    ? "bg-purple-700 text-white"
                    : "bg-slate-50 border border-slate-200 text-slate-700"
                }`}
              >
                {st.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Refund Rows */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        {showDemoPreview ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <p className="font-bold text-slate-900">Sample Cancellation Refund (Demo Preview)</p>
              <p className="text-slate-600 mt-0.5">
                {formatLkr(2400)} • 100% policy refund • Requires audit notes before settlement
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 font-bold">
              MANUAL_REVIEW_REQUIRED
            </span>
          </div>
        ) : refundsQuery.isLoading ? (
          <p className="text-xs text-slate-500 py-4 text-center">Loading refund queue...</p>
        ) : refunds.length === 0 ? (
          <AdminEmptyStateCard
            title="No refunds match this filter"
            description="No cancellation or exception refunds match the selected status."
          />
        ) : (
          <div className="space-y-3 text-xs">
            {refunds.map((item) => {
              const allowedNext = VALID_REFUND_TRANSITIONS[item.status] ?? [];
              const statusMeta = formatAdminRefundStatus(item.status);
              return (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-slate-950">
                          {item.referenceCode || item.bookingId.slice(0, 8)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeToneClasses(item.status)}`}
                        >
                          {statusMeta.label} ({item.status})
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[11px] font-semibold">
                          {item.refundPercentage}% • {item.reasonCategory}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Amount: <strong>{formatLkrMinor(item.amountMinor, item.currency)}</strong> •
                        Created {formatDateTimeDisplay(item.createdAt)}
                        {item.settlementMode ? ` • Mode: ${item.settlementMode}` : ""}
                        {item.providerRefundId ? ` • Provider Ref: ${item.providerRefundId}` : ""}
                        {item.manualReference ? ` • Manual Ref: ${item.manualReference}` : ""}
                      </p>
                      {item.notes && (
                        <p className="text-[11px] text-slate-500">Last note: {item.notes}</p>
                      )}
                    </div>
                  </div>

                  {allowedNext.length > 0 && (
                    <PermissionGate permission={SYSTEM_PERMISSIONS.ADMIN_REFUND_MANAGE}>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {allowedNext.map((target) => (
                          <button
                            key={target}
                            type="button"
                            onClick={() => openTransitionPanel(item, target)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
                              target === "SUCCEEDED"
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                : target === "FAILED"
                                  ? "bg-rose-600 hover:bg-rose-700 text-white"
                                  : target === "AUTHORIZED" && item.status === "FAILED"
                                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                                    : "bg-slate-900 hover:bg-slate-800 text-white"
                            }`}
                          >
                            {item.status === "FAILED" && target === "AUTHORIZED"
                              ? "Recover to AUTHORIZED"
                              : `Transition to ${target}`}
                          </button>
                        ))}
                      </div>
                    </PermissionGate>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!showDemoPreview && refunds.length > 0 && (
          <AdminPaginationBar
            page={page}
            totalPages={Math.max(
              1,
              refundsQuery.data?.pagination?.totalPages ?? Math.ceil(total / limit)
            )}
            total={total}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Refund Transition Form Panel */}
      {activeTransition && (
        <PermissionGate permission={SYSTEM_PERMISSIONS.ADMIN_REFUND_MANAGE}>
          <form
            onSubmit={handleSubmitTransition}
            className="bg-white rounded-2xl border-2 border-purple-300 p-6 shadow-lg space-y-4 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-extrabold text-slate-950">
                Transition Refund{" "}
                {activeTransition.refund.referenceCode ||
                  activeTransition.refund.bookingId.slice(0, 8)}{" "}
                from {activeTransition.refund.status} to {activeTransition.targetStatus}
              </h2>
              <button
                type="button"
                onClick={() => setActiveTransition(null)}
                className="px-3 py-1 rounded-lg border border-slate-300 font-bold text-slate-700"
              >
                Close
              </button>
            </div>

            {activeTransition.targetStatus === "SUCCEEDED" && (
              <div className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="font-bold text-slate-900">Settlement Attribution Mode</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSettlementMode("PROVIDER_CONFIRMED")}
                    className={`px-3 py-1.5 rounded-xl font-bold ${
                      settlementMode === "PROVIDER_CONFIRMED"
                        ? "bg-purple-700 text-white"
                        : "bg-white border border-slate-300 text-slate-700"
                    }`}
                  >
                    PROVIDER_CONFIRMED
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettlementMode("MANUAL_OFFLINE")}
                    className={`px-3 py-1.5 rounded-xl font-bold ${
                      settlementMode === "MANUAL_OFFLINE"
                        ? "bg-purple-700 text-white"
                        : "bg-white border border-slate-300 text-slate-700"
                    }`}
                  >
                    MANUAL_OFFLINE
                  </button>
                </div>

                {settlementMode === "PROVIDER_CONFIRMED" ? (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Gateway Provider Refund Reference
                    </label>
                    <input
                      type="text"
                      value={providerRefundIdInput}
                      onChange={(e) => setProviderRefundIdInput(e.target.value)}
                      placeholder="e.g. PH-REV-2026111601"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Manual Bank / Offline Settlement Reference
                    </label>
                    <input
                      type="text"
                      value={manualReferenceInput}
                      onChange={(e) => setManualReferenceInput(e.target.value)}
                      placeholder="e.g. BANK-REV-2026-0091"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono"
                    />
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Audit Notes (required, min 3 chars)
              </label>
              <textarea
                rows={2}
                value={auditNotesInput}
                onChange={(e) => setAuditNotesInput(e.target.value)}
                placeholder="Record gateway ticket reference, supervisor sign-off, or offline bank confirmation..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={transitionMutation.isPending}
                className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold disabled:opacity-50"
              >
                {transitionMutation.isPending ? "Submitting..." : "Confirm Refund Transition"}
              </button>
              <button
                type="button"
                onClick={() => setActiveTransition(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-700"
              >
                Cancel
              </button>
            </div>
          </form>
        </PermissionGate>
      )}
    </div>
  );
}
