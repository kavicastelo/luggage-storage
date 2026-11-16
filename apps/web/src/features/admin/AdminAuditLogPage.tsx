import React, { useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  securityEventTypeValues,
  type SecurityEventType
} from "@luggage-storage/contracts";
import { Download, Eye, FileSearch, X } from "lucide-react";
import { MascotIllustration } from "@/components/ui";
import { isDemoPreviewActive } from "@/config/demo-preview";
import {
  useAdminAuditEventDetailQuery,
  useAdminAuditEventsQuery
} from "@/hooks/queries/use-admin-portal";
import { downloadCsvFile, serializeCsv } from "@/lib/csv-export";
import { formatDateTimeDisplay, toIsoOffsetFromLocalInput } from "@/lib/formatters";
import { useAuthStore } from "@/store/useAuthStore";
import {
  AdminEmptyStateCard,
  AdminPageHeader,
  AdminPaginationBar,
  AdminQueryErrorAlert,
  isUuid
} from "./admin-helpers";

export function AdminAuditLogPage() {
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

  const [eventTypeFilter, setEventTypeFilter] = useState<string>("");
  const [userIdInput, setUserIdInput] = useState("");
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<{
    eventType?: SecurityEventType;
    userId?: string;
    from?: string;
    to?: string;
  }>({});
  const [filterError, setFilterError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 25;

  const inspectParam = searchParams.get("inspect");
  const [localInspectId, setLocalInspectId] = useState<string | null>(null);
  const inspectedEventId =
    (isUuid(inspectParam) ? inspectParam : null) ??
    (isUuid(localInspectId) ? localInspectId : null);

  const auditQuery = useAdminAuditEventsQuery(
    {
      page,
      limit,
      ...appliedFilters
    },
    { enabled: isAuthenticated && !showDemoPreview }
  );

  const eventDetailQuery = useAdminAuditEventDetailQuery(inspectedEventId ?? undefined, {
    enabled: isAuthenticated && !showDemoPreview && Boolean(inspectedEventId)
  });

  const events = auditQuery.data?.items ?? [];
  const pagination = auditQuery.data?.pagination;

  const openInspector = (eventId: string) => {
    setLocalInspectId(eventId);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("inspect", eventId);
    setSearchParams(nextParams);
  };

  const closeInspector = () => {
    setLocalInspectId(null);
    if (searchParams.has("inspect")) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("inspect");
      setSearchParams(nextParams);
    }
  };

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUserId = userIdInput.trim();
    if (trimmedUserId && !isUuid(trimmedUserId)) {
      setFilterError("Actor / User ID filter must be a valid UUID.");
      return;
    }

    const fromIso = fromInput ? toIsoOffsetFromLocalInput(fromInput) : undefined;
    const toIso = toInput ? toIsoOffsetFromLocalInput(toInput) : undefined;
    if (fromInput && !fromIso) {
      setFilterError("Invalid From date/time.");
      return;
    }
    if (toInput && !toIso) {
      setFilterError("Invalid To date/time.");
      return;
    }

    setFilterError(null);
    setAppliedFilters({
      eventType: (eventTypeFilter || undefined) as SecurityEventType | undefined,
      userId: trimmedUserId || undefined,
      from: fromIso,
      to: toIso
    });
    setPage(1);
  };

  const handleExportCsv = () => {
    const csv = serializeCsv(
      ["Event ID", "Event Type", "User ID", "IP Address", "User Agent", "Metadata", "Created At"],
      events.map((ev) => [
        ev.id,
        ev.eventType,
        ev.userId ?? "",
        ev.ipAddress ?? "",
        ev.userAgent ?? "",
        JSON.stringify(ev.metadata ?? {}),
        ev.createdAt
      ])
    );
    downloadCsvFile(`admin-security-audit-page-${page}.csv`, csv);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Security & Compliance Audit Log"
        subtitle="Filter immutable platform security, moderation, payment IPN, and RBAC events by event type, actor UUID, and timestamp window."
        rightSlot={
          <div className="flex items-center gap-3">
            {!showDemoPreview && events.length > 0 && (
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            )}
            <MascotIllustration mascot="thinking" size="sm" caption="Immutable Audit Trail" />
          </div>
        }
      />

      {auditQuery.isError && (
        <AdminQueryErrorAlert
          message={
            auditQuery.error instanceof Error
              ? auditQuery.error.message
              : "Unable to load security audit events."
          }
          onRetry={() => void auditQuery.refetch()}
        />
      )}

      {filterError && <AdminQueryErrorAlert message={filterError} />}

      {/* Filter Form */}
      {!showDemoPreview && (
        <form
          onSubmit={handleApplyFilters}
          className="bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 text-xs"
        >
          <div>
            <label className="block font-bold text-slate-700 mb-1">Event Type</label>
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono"
            >
              <option value="">All Security Events</option>
              {securityEventTypeValues.map((evt) => (
                <option key={evt} value={evt}>
                  {evt}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">User UUID</label>
            <input
              type="text"
              value={userIdInput}
              onChange={(e) => setUserIdInput(e.target.value)}
              placeholder="Optional actor UUID..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">From Date/Time</label>
            <input
              type="datetime-local"
              value={fromInput}
              onChange={(e) => setFromInput(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">To Date/Time</label>
            <input
              type="datetime-local"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold"
            >
              Apply Filters
            </button>
            <button
              type="button"
              onClick={() => {
                setEventTypeFilter("");
                setUserIdInput("");
                setFromInput("");
                setToInput("");
                setAppliedFilters({});
                setFilterError(null);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-700"
            >
              Reset
            </button>
          </div>
        </form>
      )}

      {/* Event List */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        {showDemoPreview ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
            <div>
              <p className="font-mono font-bold text-slate-900">
                Sample Governance Telemetry Event (Demo Preview)
              </p>
              <p className="text-slate-600 mt-0.5">
                Sign in with Superadmin credentials to query live immutable audit trails.
              </p>
            </div>
          </div>
        ) : auditQuery.isLoading ? (
          <p className="text-xs text-slate-500 py-4 text-center">Loading audit trail...</p>
        ) : events.length === 0 ? (
          <AdminEmptyStateCard
            title="No security audit events match these filters"
            description="Broaden the event type, actor UUID, or timestamp window to inspect platform compliance events."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-2.5 pr-4 font-bold">Timestamp</th>
                  <th className="pb-2.5 pr-4 font-bold">Event Type</th>
                  <th className="pb-2.5 pr-4 font-bold">Actor User</th>
                  <th className="pb-2.5 pr-4 font-bold">IP Address</th>
                  <th className="pb-2.5 font-bold text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-4 text-[11px] text-slate-600">
                      {formatDateTimeDisplay(ev.createdAt)}
                    </td>
                    <td className="py-2.5 pr-4 font-mono font-bold text-purple-900">
                      {ev.eventType}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-[11px] text-slate-700">
                      {ev.userId || "System / Anonymous"}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-[11px] text-slate-600">
                      {ev.ipAddress || "—"}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => openInspector(ev.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold"
                      >
                        <Eye className="w-3.5 h-3.5" /> Inspect Event
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!showDemoPreview && events.length > 0 && pagination && (
          <AdminPaginationBar
            page={pagination.page}
            totalPages={Math.max(1, pagination.totalPages)}
            total={pagination.total}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Audit Event Detail Drawer */}
      {inspectedEventId && !showDemoPreview && (
        <section
          aria-label="Audit Event Detail Drawer"
          className="bg-white rounded-2xl border-2 border-purple-300 p-6 shadow-lg space-y-4 text-xs"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
                Audit Event Inspector
              </span>
              <h2 className="text-base font-extrabold text-slate-950 mt-0.5 flex items-center gap-2 font-mono">
                <FileSearch className="w-4 h-4 text-purple-700" />
                {eventDetailQuery.data?.eventType ?? `Event ${inspectedEventId.slice(0, 8)}`}
              </h2>
            </div>
            <button
              type="button"
              onClick={closeInspector}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-700"
            >
              <X className="w-3.5 h-3.5" /> Close
            </button>
          </div>

          {eventDetailQuery.isError ? (
            <AdminQueryErrorAlert
              message={
                eventDetailQuery.error instanceof Error
                  ? eventDetailQuery.error.message
                  : "Unable to load audit event detail."
              }
              onRetry={() => void eventDetailQuery.refetch()}
            />
          ) : eventDetailQuery.isLoading || !eventDetailQuery.data ? (
            <p className="text-slate-500">Loading audit event payload...</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Event ID</span>
                  <p className="font-mono font-bold text-slate-900">{eventDetailQuery.data.id}</p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Timestamp</span>
                  <p className="font-semibold text-slate-800">
                    {formatDateTimeDisplay(eventDetailQuery.data.createdAt)}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Actor User ID</span>
                  <p className="font-mono text-slate-800">
                    {eventDetailQuery.data.userId || "System / Anonymous"}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                    Network / Client
                  </span>
                  <p className="font-mono text-slate-800">
                    {eventDetailQuery.data.ipAddress || "Unknown IP"}
                    {eventDetailQuery.data.userAgent ? ` • ${eventDetailQuery.data.userAgent}` : ""}
                  </p>
                </div>
              </div>
              <div>
                <span className="block font-bold text-slate-700 mb-1">JSON Metadata Payload</span>
                <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto">
                  {JSON.stringify(eventDetailQuery.data.metadata, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export const AdminSecurityComplianceAuditLogPage = AdminAuditLogPage;
