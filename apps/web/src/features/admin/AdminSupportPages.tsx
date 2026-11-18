import React, { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  SUPPORT_TICKET_CATEGORIES,
  SUPPORT_TICKET_PRIORITIES,
  SUPPORT_TICKET_STATUSES,
  type SupportTicketCategory,
  type SupportTicketPriority,
  type SupportTicketStatus
} from "@luggage-storage/contracts";
import {
  ArrowLeft,
  LifeBuoy,
  Lock,
  MessageSquare,
  RotateCcw,
  Search,
  Send,
  UserCheck
} from "lucide-react";
import { isDemoPreviewActive } from "@/config/demo-preview";
import {
  useAdminSupportTicketDetailQuery,
  useAdminSupportTicketsQuery,
  useReplyAdminSupportTicketMutation,
  useUpdateAdminSupportTicketMutation
} from "@/hooks/queries/use-admin-portal";
import { formatDateTimeDisplay, formatLkrMinor } from "@/lib/formatters";
import { useAuthStore } from "@/store/useAuthStore";
import {
  AdminCardListSkeleton,
  AdminEmptyStateCard,
  AdminPageHeader,
  AdminPaginationBar,
  AdminQueryErrorAlert,
  AdminTableSkeleton,
  statusBadgeToneClasses
} from "./admin-helpers";

function ticketStatusTone(status: SupportTicketStatus | string): string {
  switch (status) {
    case "RESOLVED":
    case "CLOSED":
      return "bg-emerald-50 text-emerald-800 border border-emerald-200";
    case "AWAITING_CUSTOMER":
    case "IN_PROGRESS":
      return "bg-amber-50 text-amber-900 border border-amber-200";
    case "OPEN":
      return "bg-rose-50 text-rose-800 border border-rose-200";
    default:
      return statusBadgeToneClasses(status);
  }
}

export function AdminSupportTicketTriageQueuePage() {
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

  const [statusFilter, setStatusFilter] = useState<SupportTicketStatus | "ALL">("ALL");
  const [priorityFilter, setPriorityFilter] = useState<SupportTicketPriority | "ALL">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<SupportTicketCategory | "ALL">("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const ticketsQuery = useAdminSupportTicketsQuery(
    {
      page,
      limit,
      status: statusFilter === "ALL" ? undefined : statusFilter,
      priority: priorityFilter === "ALL" ? undefined : priorityFilter,
      category: categoryFilter === "ALL" ? undefined : categoryFilter,
      search: appliedSearch || undefined
    },
    { enabled: isAuthenticated && !showDemoPreview }
  );

  const tickets = ticketsQuery.data?.tickets ?? [];
  const total = ticketsQuery.data?.total ?? 0;
  const totalPages = ticketsQuery.data?.pagination?.totalPages ?? 1;

  const hasActiveFilters =
    statusFilter !== "ALL" ||
    priorityFilter !== "ALL" ||
    categoryFilter !== "ALL" ||
    Boolean(appliedSearch);

  const handleResetFilters = () => {
    setStatusFilter("ALL");
    setPriorityFilter("ALL");
    setCategoryFilter("ALL");
    setSearchInput("");
    setAppliedSearch("");
    setPage(1);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(searchInput.trim());
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Support Ticket Triage Queue"
        subtitle="Customer and host helpdesk triage queue for damaged baggage, late pickup, and refund escalations."
        badge={showDemoPreview ? "Demo Preview" : "Live Support Desk"}
      />

      {showDemoPreview ? (
        <div className="bg-white rounded-2xl border border-sand-200 p-5 flex items-center justify-between text-xs shadow-sm">
          <div>
            <p className="font-bold text-navy-950">
              #TKT-9042 • Overdue Fee Dispute at Colombo Fort Hub
            </p>
            <p className="text-sand-700 mt-0.5">Priority: High • Linked Sample Booking</p>
          </div>
          <Link
            to={`/admin/support/TKT-9042${querySuffix}`}
            className="px-3 py-1.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white font-bold transition"
          >
            Inspect Ticket
          </Link>
        </div>
      ) : (
        <>
          {ticketsQuery.isError && (
            <AdminQueryErrorAlert
              message={
                ticketsQuery.error instanceof Error
                  ? ticketsQuery.error.message
                  : "Unable to load support ticket triage queue."
              }
              onRetry={() => void ticketsQuery.refetch()}
            />
          )}

          {/* Quick Status Tabs + Filters */}
          <div className="bg-white rounded-2xl border border-sand-200 p-4 space-y-3 shadow-sm text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-sand-100">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("ALL");
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl font-bold transition ${
                    statusFilter === "ALL"
                      ? "bg-navy-900 text-white shadow-sm"
                      : "bg-sand-50 border border-sand-200 text-navy-900 hover:bg-sand-100"
                  }`}
                >
                  All Tickets
                </button>
                {SUPPORT_TICKET_STATUSES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      setStatusFilter(st);
                      setPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-xl font-bold transition ${
                      statusFilter === st
                        ? "bg-navy-900 text-white shadow-sm"
                        : "bg-sand-50 border border-sand-200 text-navy-900 hover:bg-sand-100"
                    }`}
                  >
                    {st.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-sand-200 text-navy-900 font-bold hover:bg-sand-100 transition"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>

            <form
              onSubmit={handleSearchSubmit}
              className="grid grid-cols-1 md:grid-cols-5 gap-3"
            >
              <div className="md:col-span-2">
                <label className="block font-bold text-navy-900 mb-1">Search Tickets</label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="SUP-... ref, requester email, subject..."
                    className="w-full rounded-xl border border-sand-200 pl-9 pr-3 py-2 text-navy-950"
                  />
                  <Search className="h-4 w-4 text-sand-700 absolute left-3 top-2.5" />
                </div>
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">Priority</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => {
                    setPriorityFilter(e.target.value as SupportTicketPriority | "ALL");
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 font-semibold text-navy-950"
                >
                  <option value="ALL">All Priorities</option>
                  {SUPPORT_TICKET_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value as SupportTicketCategory | "ALL");
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-sand-200 bg-white px-2.5 py-2 font-semibold text-navy-950"
                >
                  <option value="ALL">All Categories</option>
                  {SUPPORT_TICKET_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full px-3.5 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-bold transition"
                >
                  Search
                </button>
              </div>
            </form>
          </div>

          {ticketsQuery.isLoading ? (
            <div className="bg-white rounded-2xl border border-sand-200 p-6 shadow-sm">
              <AdminTableSkeleton rows={6} columns={7} />
            </div>
          ) : tickets.length === 0 ? (
            <AdminEmptyStateCard
              title="Support Triage Queue Is Clear"
              description="No customer or host support tickets match the selected filters right now."
              actionTo="/admin/bookings"
              actionLabel="Review Global Bookings"
            />
          ) : (
            <div className="bg-white rounded-2xl border border-sand-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-sand-50 border-b border-sand-200 text-sand-700 uppercase font-bold text-[10px]">
                      <th className="p-3.5">Ticket Ref</th>
                      <th className="p-3.5">Subject &amp; Category</th>
                      <th className="p-3.5">Requester</th>
                      <th className="p-3.5">Assignee</th>
                      <th className="p-3.5">Priority</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Last Activity</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sand-100">
                    {tickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-sand-50/70 transition">
                        <td className="p-3.5 font-mono font-bold text-navy-950">
                          {ticket.referenceCode}
                        </td>
                        <td className="p-3.5">
                          <p className="font-bold text-navy-950">{ticket.subject}</p>
                          <p className="text-[11px] text-sand-700">
                            {ticket.category}
                            {ticket.bookingReferenceInput
                              ? ` • Ref: ${ticket.bookingReferenceInput}`
                              : ""}
                          </p>
                        </td>
                        <td className="p-3.5 text-navy-900">
                          <p className="font-semibold">{ticket.requesterName}</p>
                          <p className="text-[11px] text-sand-700">{ticket.requesterEmail}</p>
                        </td>
                        <td className="p-3.5">
                          {ticket.assignedToDisplayName ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sand-100 border border-sand-200 text-[11px] font-semibold text-navy-900">
                              <UserCheck className="h-3 w-3 text-emerald-700" />
                              {ticket.assignedToDisplayName}
                            </span>
                          ) : (
                            <span className="text-[11px] text-sand-500 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ticket.priority === "URGENT" || ticket.priority === "HIGH"
                                ? "bg-rose-50 text-rose-800 border border-rose-200"
                                : "bg-sand-100 text-navy-900 border border-sand-200"
                            }`}
                          >
                            {ticket.priority}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ticketStatusTone(
                              ticket.status
                            )}`}
                          >
                            {ticket.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-sand-700 tabular-nums">
                          {formatDateTimeDisplay(ticket.lastMessageAt)}
                        </td>
                        <td className="p-3.5 text-right">
                          <Link
                            to={`/admin/support/${ticket.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-terracotta-500 hover:bg-terracotta-600 text-white font-bold transition"
                          >
                            <LifeBuoy className="h-3.5 w-3.5" />
                            <span>Open Case</span>
                          </Link>
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
        </>
      )}
    </div>
  );
}

export function AdminSupportTicketResolutionViewPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();

  const showDemoPreview =
    !isAuthenticated &&
    isDemoPreviewActive({
      allowDemoPreview: true,
      search: location.search,
      isAuthenticated
    });

  const ticketQuery = useAdminSupportTicketDetailQuery(id, {
    enabled: isAuthenticated && !showDemoPreview && Boolean(id)
  });
  const replyMutation = useReplyAdminSupportTicketMutation();
  const updateMutation = useUpdateAdminSupportTicketMutation();

  const ticket = ticketQuery.data ?? null;

  const [replyMessage, setReplyMessage] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [nextStatus, setNextStatus] = useState<SupportTicketStatus | "">("");
  const [nextPriority, setNextPriority] = useState<SupportTicketPriority | "">("");
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const handleAssignToMe = async () => {
    if (!ticket || !user?.id || updateMutation.isPending) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      await updateMutation.mutateAsync({
        ticketId: ticket.id,
        data: { assignedToUserId: user.id }
      });
      setActionSuccess(`Ticket assigned to ${user.displayName}.`);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Unable to assign support ticket.");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket) return;
    setActionError(null);
    setActionSuccess(null);

    if (replyMessage.trim().length < 2) {
      setActionError("Enter at least 2 characters for the message.");
      return;
    }

    try {
      await replyMutation.mutateAsync({
        ticketId: ticket.id,
        data: {
          message: replyMessage.trim(),
          isInternalNote
        }
      });
      setReplyMessage("");
      setActionSuccess(
        isInternalNote
          ? "Internal support note appended to case timeline."
          : "Customer reply recorded on support ticket."
      );
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Unable to send reply.");
    }
  };

  const handleUpdateMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket) return;
    setActionError(null);
    setActionSuccess(null);

    const payload: {
      status?: SupportTicketStatus;
      priority?: SupportTicketPriority;
      resolutionSummary?: string | null;
    } = {};
    if (nextStatus && nextStatus !== ticket.status) payload.status = nextStatus;
    if (nextPriority && nextPriority !== ticket.priority) payload.priority = nextPriority;
    if (resolutionSummary.trim()) payload.resolutionSummary = resolutionSummary.trim();

    if (Object.keys(payload).length === 0) {
      setActionError("Select a new status, priority, or enter a resolution summary to update.");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        ticketId: ticket.id,
        data: payload
      });
      setActionSuccess("Support ticket status and triage metadata updated.");
      setNextStatus("");
      setNextPriority("");
      setResolutionSummary("");
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Unable to update support ticket.");
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={`Support Case Overview${
          ticket ? `: ${ticket.referenceCode}` : id ? `: ${id}` : ""
        }`}
        subtitle="Cross-surface investigation combining customer conversation history, internal notes, and linked bookings."
        badge={showDemoPreview ? "Demo Preview" : "Live Support Case"}
        rightSlot={
          !showDemoPreview ? (
            <Link
              to="/admin/support"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-sand-200 bg-white text-xs font-bold text-navy-900 hover:bg-sand-100 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Triage Queue</span>
            </Link>
          ) : undefined
        }
      />

      {showDemoPreview ? (
        <div className="bg-white rounded-2xl border border-sand-200 p-6 text-xs space-y-2 shadow-sm">
          <p className="font-bold text-navy-950">Case {id ?? "#TKT-9042"} (Demo Preview)</p>
          <p className="text-sand-700">Preview conversation thread and timeline snapshot.</p>
        </div>
      ) : (
        <>
          {ticketQuery.isError && (
            <AdminQueryErrorAlert
              message={
                ticketQuery.error instanceof Error
                  ? ticketQuery.error.message
                  : "Unable to load support ticket details."
              }
              onRetry={() => void ticketQuery.refetch()}
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
              className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-950"
            >
              {actionSuccess}
            </div>
          )}

          {ticketQuery.isLoading ? (
            <div className="bg-white rounded-2xl border border-sand-200 p-6 shadow-sm">
              <AdminCardListSkeleton count={4} />
            </div>
          ) : !ticket ? (
            <AdminEmptyStateCard
              title="Support Case Not Found"
              description="This support ticket reference could not be found or you do not have access. Return to the triage queue."
              actionTo="/admin/support"
              actionLabel="Open Support Queue"
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
              <div className="lg:col-span-8 space-y-5">
                {/* Summary Card */}
                <div className="bg-white rounded-2xl border border-sand-200 p-5 space-y-3 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-navy-950">
                        {ticket.referenceCode}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ticketStatusTone(
                          ticket.status
                        )}`}
                      >
                        {ticket.status}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sand-100 border border-sand-200 text-navy-900">
                        {ticket.priority}
                      </span>
                    </div>
                    <span className="text-sand-700 tabular-nums">
                      Opened {formatDateTimeDisplay(ticket.createdAt)}
                    </span>
                  </div>
                  <h2 className="text-base font-extrabold text-navy-950">{ticket.subject}</h2>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sand-700">
                    <p>
                      Requester: <strong className="text-navy-950">{ticket.requesterName}</strong> (
                      {ticket.requesterEmail}) • Category:{" "}
                      <strong className="text-navy-950">{ticket.category}</strong>
                    </p>
                    <div className="flex items-center gap-2">
                      <span>
                        Assignee:{" "}
                        <strong className="text-navy-950">
                          {ticket.assignedToDisplayName || "Unassigned"}
                        </strong>
                      </span>
                      {user?.id && ticket.assignedToUserId !== user.id && (
                        <button
                          type="button"
                          disabled={updateMutation.isPending}
                          onClick={() => void handleAssignToMe()}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-sand-200 bg-sand-50 hover:bg-sand-100 text-navy-900 font-bold transition disabled:opacity-50"
                        >
                          <UserCheck className="h-3 w-3 text-terracotta-600" />
                          <span>Assign to Me</span>
                        </button>
                      )}
                    </div>
                  </div>
                  {ticket.resolutionSummary && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                      <span className="font-bold">Resolution Summary: </span>
                      {ticket.resolutionSummary}
                    </div>
                  )}
                </div>

                {/* Conversation Thread */}
                <div className="bg-white rounded-2xl border border-sand-200 p-5 space-y-4 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-sand-100 pb-3">
                    <MessageSquare className="h-4 w-4 text-terracotta-600" />
                    <h3 className="font-bold text-navy-950">Case Message Timeline</h3>
                  </div>

                  <div className="space-y-3">
                    {ticket.messages.map((msg) => {
                      const isAgent = msg.senderRole === "SUPPORT" || msg.senderRole === "SUPERADMIN";
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isAgent && !msg.isInternalNote ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`w-full max-w-2xl p-3.5 rounded-xl border ${
                              msg.isInternalNote
                                ? "bg-amber-50/90 border-amber-300 text-amber-950"
                                : isAgent
                                  ? "bg-navy-900/5 border-navy-200 text-navy-950"
                                  : "bg-sand-50 border-sand-200 text-navy-950"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-navy-950">
                                  {msg.senderDisplayName}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-white border border-sand-200 text-[10px] font-mono text-navy-900">
                                  {msg.senderRole}
                                </span>
                                {msg.isInternalNote && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-200/80 text-amber-950 text-[10px] font-bold">
                                    <Lock className="h-2.5 w-2.5" />
                                    Internal Support Note
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-sand-700 tabular-nums">
                                {formatDateTimeDisplay(msg.createdAt)}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Two-Tab Reply / Note Composer */}
                  <form
                    onSubmit={(e) => void handleSendMessage(e)}
                    className={`pt-4 border-t border-sand-200 space-y-3 rounded-xl p-4 transition-colors ${
                      isInternalNote
                        ? "bg-amber-50/70 border border-amber-300"
                        : "bg-sand-50/50 border border-sand-200"
                    }`}
                  >
                    <div
                      role="tablist"
                      aria-label="Composer mode"
                      className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-white p-1 rounded-xl border border-sand-200"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={!isInternalNote}
                        onClick={() => setIsInternalNote(false)}
                        className={`py-2 px-3 rounded-lg text-xs font-bold transition ${
                          !isInternalNote
                            ? "bg-navy-900 text-white shadow-sm"
                            : "text-navy-900 hover:bg-sand-100"
                        }`}
                      >
                        Public Reply to Customer
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={isInternalNote}
                        onClick={() => setIsInternalNote(true)}
                        className={`inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition ${
                          isInternalNote
                            ? "bg-amber-600 text-white shadow-sm"
                            : "text-amber-900 hover:bg-amber-50"
                        }`}
                      >
                        <Lock className="h-3 w-3" />
                        <span>Internal Agent Note (Private)</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <label htmlFor="support-reply-composer" className="font-bold text-navy-950">
                        {isInternalNote
                          ? "Internal Support Note (Hidden from Customer)"
                          : "Send Reply to Customer"}
                      </label>
                      {isInternalNote && (
                        <span className="px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-950 text-[10px] font-bold">
                          Private Agent Visibility Only
                        </span>
                      )}
                    </div>

                    <textarea
                      id="support-reply-composer"
                      rows={3}
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder={
                        isInternalNote
                          ? "Document investigation findings or refund coordination details..."
                          : "Write clear troubleshooting guidance or resolution update for the requester..."
                      }
                      className={`w-full rounded-xl border p-3 text-xs bg-white text-navy-950 ${
                        isInternalNote ? "border-amber-300" : "border-sand-200"
                      }`}
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={replyMutation.isPending}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl disabled:opacity-50 text-white font-bold transition ${
                          isInternalNote
                            ? "bg-amber-700 hover:bg-amber-800"
                            : "bg-terracotta-500 hover:bg-terracotta-600"
                        }`}
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>
                          {replyMutation.isPending
                            ? "Posting..."
                            : isInternalNote
                              ? "Save Internal Note"
                              : "Send Public Reply"}
                        </span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              <div className="lg:col-span-4 space-y-5">
                {/* Linked Booking Card */}
                {ticket.linkedBooking ? (
                  <div className="bg-white rounded-2xl border border-sand-200 p-5 space-y-2.5 shadow-sm">
                    <h3 className="font-bold text-navy-950">Linked Reservation Context</h3>
                    <p className="font-mono font-bold text-terracotta-600">
                      {ticket.linkedBooking.referenceCode}
                    </p>
                    <p className="text-navy-900">
                      {ticket.linkedBooking.locationName} ({ticket.linkedBooking.businessName})
                    </p>
                    <p className="text-navy-900 tabular-nums">
                      Status: <strong>{ticket.linkedBooking.status}</strong> •{" "}
                      {formatLkrMinor(
                        ticket.linkedBooking.totalAmountMinor,
                        ticket.linkedBooking.currency
                      )}
                    </p>
                    <Link
                      to={`/admin/bookings/${ticket.linkedBooking.id}`}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white font-bold transition"
                    >
                      Inspect Booking &amp; Custody
                    </Link>
                  </div>
                ) : ticket.bookingReferenceInput ? (
                  <div className="bg-white rounded-2xl border border-sand-200 p-5 space-y-1.5 shadow-sm">
                    <h3 className="font-bold text-navy-950">Submitted Reference</h3>
                    <p className="font-mono text-navy-900">{ticket.bookingReferenceInput}</p>
                    <p className="text-sand-700">No matching reservation linked automatically.</p>
                  </div>
                ) : null}

                {/* Triage & Resolution Controls */}
                <form
                  onSubmit={(e) => void handleUpdateMeta(e)}
                  className="bg-white rounded-2xl border border-sand-200 p-5 space-y-3 shadow-sm"
                >
                  <h3 className="font-bold text-navy-950">Update Case Triage</h3>
                  <div>
                    <label className="block font-bold text-navy-900 mb-1">Status</label>
                    <select
                      value={nextStatus || ticket.status}
                      onChange={(e) => setNextStatus(e.target.value as SupportTicketStatus)}
                      className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 font-semibold text-navy-950"
                    >
                      {SUPPORT_TICKET_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-navy-900 mb-1">Priority</label>
                    <select
                      value={nextPriority || ticket.priority}
                      onChange={(e) => setNextPriority(e.target.value as SupportTicketPriority)}
                      className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 font-semibold text-navy-950"
                    >
                      {SUPPORT_TICKET_PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-navy-900 mb-1">
                      Resolution Summary
                    </label>
                    <textarea
                      rows={3}
                      value={resolutionSummary}
                      onChange={(e) => setResolutionSummary(e.target.value)}
                      placeholder="Final resolution notes before closing case..."
                      className="w-full rounded-xl border border-sand-200 bg-white p-2.5 text-navy-950"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="w-full py-2 rounded-xl bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white font-bold transition"
                  >
                    {updateMutation.isPending ? "Saving..." : "Save Ticket Updates"}
                  </button>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
