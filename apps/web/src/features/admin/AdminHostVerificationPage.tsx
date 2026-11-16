import React, { useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  HOST_VERIFICATION_STATUSES,
  SYSTEM_PERMISSIONS,
  type HostVerificationQueueQuery,
  type ReviewHostVerificationRequest
} from "@luggage-storage/contracts";
import { ExternalLink, Eye, X } from "lucide-react";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { MascotIllustration } from "@/components/ui";
import { isDemoPreviewActive } from "@/config/demo-preview";
import {
  useAdminHostDetailQuery,
  useAdminVerificationDetailQuery,
  useAdminVerificationsQuery,
  useReviewVerificationMutation
} from "@/hooks/queries/use-admin-portal";
import { formatDateTimeDisplay } from "@/lib/formatters";
import { marketplaceApi } from "@/services/marketplace-api";
import { useAuthStore } from "@/store/useAuthStore";
import {
  AdminEmptyStateCard,
  AdminPageHeader,
  AdminPaginationBar,
  AdminQueryErrorAlert,
  isUuid,
  statusBadgeToneClasses
} from "./admin-helpers";
import { useAdminRole } from "./AdminDashboardLayout";

type QueueStatusFilter = NonNullable<HostVerificationQueueQuery["status"]>;

const STATUS_FILTER_OPTIONS: Array<{ value: QueueStatusFilter; label: string }> = [
  { value: "PENDING_REVIEW", label: "Pending Review" },
  { value: "INFORMATION_REQUESTED", label: "Info Requested" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All Applications" }
];

export function AdminHostVerificationPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuthStore();
  const effectiveAdminRole = useAdminRole();

  const showDemoPreview =
    !isAuthenticated &&
    isDemoPreviewActive({
      allowDemoPreview: true,
      search: location.search,
      isAuthenticated
    });

  const [statusFilter, setStatusFilter] = useState<QueueStatusFilter>("PENDING_REVIEW");
  const [page, setPage] = useState(1);
  const limit = 20;

  const inspectParam = searchParams.get("inspect");
  const [localInspectId, setLocalInspectId] = useState<string | null>(null);
  const inspectedVerificationId =
    (isUuid(inspectParam) ? inspectParam : null) ??
    (isUuid(localInspectId) ? localInspectId : null);

  const [decisionMode, setDecisionMode] = useState<ReviewHostVerificationRequest["decision"] | null>(
    null
  );
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [documentDownloadBusyId, setDocumentDownloadBusyId] = useState<string | null>(null);

  const queueQuery = useAdminVerificationsQuery(
    { page, limit, status: statusFilter },
    { enabled: isAuthenticated && !showDemoPreview }
  );
  const detailQuery = useAdminVerificationDetailQuery(inspectedVerificationId ?? undefined, {
    enabled: isAuthenticated && !showDemoPreview && Boolean(inspectedVerificationId)
  });
  const businessIdForDrawer = detailQuery.data?.businessId;
  const hostDetailQuery = useAdminHostDetailQuery(businessIdForDrawer, {
    enabled: isAuthenticated && !showDemoPreview && Boolean(businessIdForDrawer)
  });
  const reviewMutation = useReviewVerificationMutation();

  const liveQueue = queueQuery.data?.queue ?? [];
  const total = queueQuery.data?.total ?? 0;

  const openInspector = (verificationId: string) => {
    setActionError(null);
    setDecisionMode(null);
    setRejectionReason("");
    setAdminNotes("");
    setLocalInspectId(verificationId);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("inspect", verificationId);
    setSearchParams(nextParams);
  };

  const closeInspector = () => {
    setLocalInspectId(null);
    setDecisionMode(null);
    setActionError(null);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("inspect");
    setSearchParams(nextParams);
  };

  const handleOpenDocument = async (documentId: string) => {
    setActionError(null);
    setDocumentDownloadBusyId(documentId);
    try {
      const res = await marketplaceApi.getDocumentDownloadUrl(documentId);
      if (typeof window !== "undefined") {
        window.open(res.downloadUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Unable to generate protected document link."
      );
    } finally {
      setDocumentDownloadBusyId(null);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectedVerificationId || !decisionMode) return;
    setActionError(null);
    setActionSuccess(null);

    if (
      (decisionMode === "REJECT" || decisionMode === "REQUEST_INFO") &&
      rejectionReason.trim().length < 3
    ) {
      setActionError("Enter a clear reason or document request (at least 3 characters).");
      return;
    }

    try {
      const updated = await reviewMutation.mutateAsync({
        verificationId: inspectedVerificationId,
        data: {
          decision: decisionMode,
          ...(rejectionReason.trim() ? { rejectionReason: rejectionReason.trim() } : {}),
          ...(adminNotes.trim() ? { adminNotes: adminNotes.trim() } : {})
        }
      });
      setActionSuccess(
        `KYC verification ${updated.id.slice(0, 8)} updated to status ${updated.status}.`
      );
      setDecisionMode(null);
      setRejectionReason("");
      setAdminNotes("");
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Unable to submit KYC moderation decision."
      );
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Host Business KYC & Verification Queue"
        subtitle="Inspect submitted BRN, TIN, ID proofs, and corporate ownership metadata via signed download links before approving partner accounts."
        rightSlot={
          <MascotIllustration mascot="salute" size="sm" caption="KYC Compliance Gate" />
        }
      />

      {effectiveAdminRole === "SUPPORT" && (
        <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold">
          Read-Only Support View (Moderation Decisions Restricted to Superadmin)
        </div>
      )}

      {queueQuery.isError && (
        <AdminQueryErrorAlert
          message={
            queueQuery.error instanceof Error
              ? queueQuery.error.message
              : "Unable to load host KYC verification queue."
          }
          onRetry={() => void queueQuery.refetch()}
        />
      )}

      {actionError && (
        <AdminQueryErrorAlert
          message={actionError}
          onRetry={() => void queueQuery.refetch()}
        />
      )}

      {actionSuccess && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900"
        >
          {actionSuccess}
        </div>
      )}

      {/* Status Filter Pills */}
      {!showDemoPreview && (
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setStatusFilter(opt.value);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                statusFilter === opt.value
                  ? "bg-purple-700 text-white"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Queue List */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        {showDemoPreview ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <p className="font-bold text-slate-900">Kandy Hills Hospitality Group (Demo)</p>
              <p className="text-slate-600 mt-0.5">BRN: PV-2026-88412 • Status: PENDING_REVIEW</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 font-bold">
              Demo Preview Item
            </span>
          </div>
        ) : liveQueue.length === 0 ? (
          <AdminEmptyStateCard
            title="No KYC verification applications match this filter"
            description="No partner KYC applications currently match the selected verification status."
          />
        ) : (
          <div className="space-y-3 text-xs">
            {liveQueue.map((item) => (
              <div
                key={item.verificationId}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-950 text-sm">{item.legalBusinessName}</span>
                    <span className="text-slate-600">({item.tradeName})</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeToneClasses(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="text-slate-600">
                    Owner: <strong className="text-slate-800">{item.ownerDisplayName}</strong> (
                    {item.ownerEmail}) • BRN: {item.businessRegistrationNumber || "Not provided"} •{" "}
                    {item.documentCount} Document(s)
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Submitted: {formatDateTimeDisplay(item.submittedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openInspector(item.verificationId)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex-shrink-0"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Inspect KYC Dossier</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {!showDemoPreview && (
          <AdminPaginationBar
            page={page}
            total={total}
            totalPages={Math.ceil(total / limit)}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Inspection Drawer */}
      {!showDemoPreview && inspectedVerificationId && (
        <section
          aria-label="KYC Verification Inspection Drawer"
          className="bg-white rounded-2xl border-2 border-purple-300 p-6 space-y-5 shadow-lg text-xs"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-950">
                KYC Verification Inspection Drawer
              </h2>
              <p className="text-slate-500">
                Verification ID: <span className="font-mono">{inspectedVerificationId}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={closeInspector}
              aria-label="Close KYC drawer"
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {detailQuery.isError && (
            <AdminQueryErrorAlert
              message={
                detailQuery.error instanceof Error
                  ? detailQuery.error.message
                  : "Unable to load KYC verification detail."
              }
              onRetry={() => void detailQuery.refetch()}
            />
          )}

          {detailQuery.data && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <p className="font-bold text-slate-900">Business &amp; Registration Metadata</p>
                  <p className="text-slate-700">
                    Legal Name:{" "}
                    <strong>{hostDetailQuery.data?.legalBusinessName || "Loading..."}</strong>
                  </p>
                  <p className="text-slate-700">
                    Trade Name: <strong>{hostDetailQuery.data?.tradeName || "—"}</strong>
                  </p>
                  <p className="text-slate-700">
                    BRN: {hostDetailQuery.data?.businessRegistrationNumber || "Not provided"} • TIN:{" "}
                    {hostDetailQuery.data?.taxIdentifier || "Not provided"}
                  </p>
                  <p className="text-slate-700">
                    Contact: {hostDetailQuery.data?.contactEmail || "—"} •{" "}
                    {hostDetailQuery.data?.contactPhone || "—"}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <p className="font-bold text-slate-900">Review State</p>
                  <p className="text-slate-700">
                    Current Status:{" "}
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold ${statusBadgeToneClasses(
                        detailQuery.data.status
                      )}`}
                    >
                      {detailQuery.data.status}
                    </span>
                  </p>
                  <p className="text-slate-700">
                    Submitted: {formatDateTimeDisplay(detailQuery.data.submittedAt)}
                  </p>
                  {detailQuery.data.rejectionReason && (
                    <p className="text-rose-700 font-semibold">
                      Rejection / Request Reason: {detailQuery.data.rejectionReason}
                    </p>
                  )}
                  {detailQuery.data.adminNotes && (
                    <p className="text-slate-600">Operator Notes: {detailQuery.data.adminNotes}</p>
                  )}
                </div>
              </div>

              {/* Uploaded KYC Documents */}
              <div className="space-y-2">
                <p className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
                  Submitted Verification Documents ({detailQuery.data.documents.length})
                </p>
                {detailQuery.data.documents.length === 0 ? (
                  <p className="text-slate-500">No verification documents attached.</p>
                ) : (
                  <div className="space-y-2">
                    {detailQuery.data.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200"
                      >
                        <div>
                          <p className="font-bold text-slate-900">
                            {doc.documentType} — {doc.fileName}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {doc.mimeType} • {Math.round(doc.fileSize / 1024)} KB • Status:{" "}
                            {doc.status}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={documentDownloadBusyId === doc.id}
                          onClick={() => void handleOpenDocument(doc.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold text-xs"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>
                            {documentDownloadBusyId === doc.id
                              ? "Generating Link..."
                              : "Open Protected Document"}
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Superadmin-Gated Review Actions */}
              {HOST_VERIFICATION_STATUSES.includes(detailQuery.data.status) && (
                <PermissionGate
                  permission={SYSTEM_PERMISSIONS.ADMIN_HOST_VERIFY}
                  fallback={
                    <p className="text-slate-500 italic">
                      Support oversight accounts cannot execute verification decisions.
                    </p>
                  }
                >
                  <div className="pt-3 border-t border-slate-200 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setDecisionMode("APPROVE")}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                      >
                        Approve Partner KYC
                      </button>
                      <button
                        type="button"
                        onClick={() => setDecisionMode("REQUEST_INFO")}
                        className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold"
                      >
                        Request More Info
                      </button>
                      <button
                        type="button"
                        onClick={() => setDecisionMode("REJECT")}
                        className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
                      >
                        Reject Application
                      </button>
                    </div>

                    {decisionMode && (
                      <form
                        onSubmit={(e) => void handleSubmitReview(e)}
                        className="p-4 rounded-xl bg-slate-50 border border-slate-300 space-y-3"
                      >
                        <p className="font-bold text-slate-900">
                          Confirm KYC Decision: {decisionMode}
                        </p>
                        {(decisionMode === "REJECT" || decisionMode === "REQUEST_INFO") && (
                          <div>
                            <label className="block font-bold text-slate-800 mb-1">
                              Rejection / Information Request Reason (Required)
                            </label>
                            <textarea
                              rows={2}
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              placeholder="Specify exact missing or illegible document details..."
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                            />
                          </div>
                        )}
                        <div>
                          <label className="block font-bold text-slate-800 mb-1">
                            Internal Moderator Notes (Optional)
                          </label>
                          <input
                            type="text"
                            value={adminNotes}
                            onChange={(e) => setAdminNotes(e.target.value)}
                            placeholder="Compliance review notes..."
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={reviewMutation.isPending}
                            className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold"
                          >
                            {reviewMutation.isPending ? "Submitting..." : `Submit ${decisionMode}`}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDecisionMode(null)}
                            className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </PermissionGate>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export { AdminHostVerificationPage as AdminHostVerificationQueuePage };
