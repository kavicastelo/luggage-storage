import React, { useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  securityEventTypeValues,
  type SecurityEventType
} from "@luggage-storage/contracts";
import { Download, Eye } from "lucide-react";
import { SlideOverDrawer } from "@/components/ui";
import { isDemoPreviewActive } from "@/config/demo-preview";
import {
  useAdminAuditEventDetailQuery,
  useAdminAuditEventsQuery
} from "@/hooks/queries/use-admin-portal";
import { downloadCsvFile, serializeCsv } from "@/lib/csv-export";
import { formatDateTimeDisplay, toIsoOffsetFromLocalInput } from "@/lib/formatters";
import { useAuthStore } from "@/store/useAuthStore";
import {
  AdminCardListSkeleton,
  AdminEmptyStateCard,
  AdminPageHeader,
  AdminPaginationBar,
  AdminQueryErrorAlert,
  AdminTableSkeleton,
  CopyTextButton,
  isUuid,
  truncateUuid
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
        badge={showDemoPreview ? "Demo Preview" : "Immutable Audit Trail"}
        rightSlot={
          !showDemoPreview && events.length > 0 ? (
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

      {/* 2-Row Filter Toolbar */}
      {!showDemoPreview && (
        <form
          onSubmit={handleApplyFilters}
          className="bg-white rounded-2xl border border-sand-200 p-4 space-y-3 text-xs shadow-sm"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-navy-900 mb-1">Event Type</label>
              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-sand-200 bg-white font-mono text-navy-950"
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
              <label className="block font-bold text-navy-900 mb-1">Actor User UUID</label>
              <input
                type="text"
                value={userIdInput}
                onChange={(e) => setUserIdInput(e.target.value)}
                placeholder="Optional actor UUID..."
                className="w-full px-3 py-2 rounded-xl border border-sand-200 font-mono text-navy-950"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block font-bold text-navy-900 mb-1">From Date/Time</label>
              <input
                type="datetime-local"
                value={fromInput}
                onChange={(e) => setFromInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-sand-200 text-navy-950"
              />
            </div>
            <div>
              <label className="block font-bold text-navy-900 mb-1">To Date/Time</label>
              <input
                type="datetime-local"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-sand-200 text-navy-950"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
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
                className="px-3.5 py-2 rounded-xl border border-sand-200 font-bold text-navy-900 hover:bg-sand-100 transition"
              >
                Reset
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-bold transition"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Event List */}
      <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
        {showDemoPreview ? (
          <div className="p-4 rounded-xl bg-sand-50 border border-sand-200 text-xs flex items-center justify-between">
            <div>
              <p className="font-mono font-bold text-navy-950">
                Sample Governance Telemetry Event (Demo Preview)
              </p>
              <p className="text-sand-700 mt-0.5">
                Sign in with Superadmin credentials to query live immutable audit trails.
              </p>
            </div>
          </div>
        ) : auditQuery.isLoading ? (
          <AdminTableSkeleton rows={6} columns={5} />
        ) : events.length === 0 ? (
          <AdminEmptyStateCard
            title="No security audit events match these filters"
            description="Broaden the event type, actor UUID, or timestamp window to inspect platform compliance events."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-sand-200 text-sand-700">
                  <th className="pb-2.5 pr-4 font-bold">Timestamp</th>
                  <th className="pb-2.5 pr-4 font-bold">Event Type</th>
                  <th className="pb-2.5 pr-4 font-bold">Actor User</th>
                  <th className="pb-2.5 pr-4 font-bold">IP Address</th>
                  <th className="pb-2.5 font-bold text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-sand-50/70 transition-colors">
                    <td className="py-2.5 pr-4 text-[11px] text-sand-700 tabular-nums">
                      {formatDateTimeDisplay(ev.createdAt)}
                    </td>
                    <td className="py-2.5 pr-4 font-mono font-bold text-navy-950">
                      {ev.eventType}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-[11px] text-navy-900">
                      {ev.userId ? (
                        <CopyTextButton
                          value={ev.userId}
                          displayText={truncateUuid(ev.userId)}
                          label="Actor User ID"
                        />
                      ) : (
                        <span className="text-sand-700">System / Anonymous</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-[11px] text-sand-700">
                      {ev.ipAddress || "—"}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => openInspector(ev.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white font-bold transition"
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

      {/* Audit Event Detail Slide-Over Drawer */}
      <SlideOverDrawer
        open={Boolean(inspectedEventId && !showDemoPreview)}
        onClose={closeInspector}
        ariaLabel="Audit Event Detail Drawer"
        closeLabel="Close audit event drawer"
        size="xl"
        title={
          eventDetailQuery.data?.eventType ??
          (inspectedEventId ? `Event ${inspectedEventId.slice(0, 8)}` : "Audit Event Inspector")
        }
        subtitle={
          eventDetailQuery.data
            ? formatDateTimeDisplay(eventDetailQuery.data.createdAt)
            : undefined
        }
      >
        <div className="space-y-4 text-xs">
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
            <AdminCardListSkeleton count={3} />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-xl bg-sand-50 border border-sand-200">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-sand-700 uppercase block">
                    Event ID
                  </span>
                  <CopyTextButton value={eventDetailQuery.data.id} label="Event ID" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-sand-700 uppercase">Timestamp</span>
                  <p className="font-semibold text-navy-950 mt-1 tabular-nums">
                    {formatDateTimeDisplay(eventDetailQuery.data.createdAt)}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-sand-700 uppercase block">
                    Actor User ID
                  </span>
                  {eventDetailQuery.data.userId ? (
                    <CopyTextButton
                      value={eventDetailQuery.data.userId}
                      label="Actor User ID"
                    />
                  ) : (
                    <p className="font-mono text-navy-900">System / Anonymous</p>
                  )}
                </div>
                <div>
                  <span className="text-[11px] font-bold text-sand-700 uppercase">
                    Network / Client
                  </span>
                  <p className="font-mono text-navy-900 mt-1 break-all">
                    {eventDetailQuery.data.ipAddress || "Unknown IP"}
                    {eventDetailQuery.data.userAgent ? ` • ${eventDetailQuery.data.userAgent}` : ""}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-navy-950">JSON Metadata Payload</span>
                  <CopyTextButton
                    value={JSON.stringify(eventDetailQuery.data.metadata, null, 2)}
                    displayText="Copy JSON"
                    label="JSON Metadata Payload"
                  />
                </div>
                <pre className="p-4 rounded-xl bg-navy-950 text-sand-100 font-mono text-[11px] overflow-x-auto">
                  {JSON.stringify(eventDetailQuery.data.metadata, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </SlideOverDrawer>
    </div>
  );
}

export const AdminSecurityComplianceAuditLogPage = AdminAuditLogPage;
