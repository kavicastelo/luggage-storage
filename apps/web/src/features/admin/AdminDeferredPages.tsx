import React from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { isDemoPreviewActive } from "@/config/demo-preview";
import { formatLkr } from "@/data/mock-marketplace";
import { useAuthStore } from "@/store/useAuthStore";
import { AdminEmptyStateCard, AdminPageHeader } from "./admin-helpers";

function useDeferredDemoMode(): { showDemoPreview: boolean; querySuffix: string } {
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const showDemoPreview =
    !isAuthenticated &&
    isDemoPreviewActive({
      allowDemoPreview: true,
      search: location.search,
      isAuthenticated
    });
  return {
    showDemoPreview,
    querySuffix: showDemoPreview ? "?preview=demo" : ""
  };
}

export function AdminHostPayoutBatchGenerationPage() {
  const { showDemoPreview, querySuffix } = useDeferredDemoMode();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Host Payout Batch Generation"
        subtitle="Weekly automated batch scheduling of eligible host payables for corporate bank disbursement."
        badge={showDemoPreview ? "Demo Preview" : "Scheduled Phase Extension"}
      />
      {showDemoPreview ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center justify-between text-xs">
          <div>
            <p className="font-bold text-slate-900">Sample Payout Cycle Preview</p>
            <p className="text-slate-600 mt-0.5">Eligible partner settlements ready for batching.</p>
          </div>
          <span className="font-extrabold text-emerald-700">{formatLkr(1245000)}</span>
        </div>
      ) : (
        <AdminEmptyStateCard
          title="Automated Payout Batch Disbursement Scheduled Next"
          description="Live host payable accruals and double-entry liabilities are already live in the Financial Ledger. Automated bank batch generation lands in the next settlement milestone."
          actionTo={`/admin/finance/ledger${querySuffix}`}
          actionLabel="Inspect Financial Ledger"
        />
      )}
    </div>
  );
}

export function AdminManualPayoutDisbursementPage() {
  const { showDemoPreview, querySuffix } = useDeferredDemoMode();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Manual Payout Disbursement & Proof Entry"
        subtitle="Record bank wire confirmation references and clear settled host payable liabilities."
        badge={showDemoPreview ? "Demo Preview" : "Scheduled Phase Extension"}
      />
      {showDemoPreview ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-xs space-y-2">
          <p className="font-bold text-slate-900">Manual Wire Proof Entry (Demo Preview)</p>
          <p className="text-slate-600">Commercial Bank SLFT settlement proof preview.</p>
        </div>
      ) : (
        <AdminEmptyStateCard
          title="Manual Bank Disbursement Console Scheduled Next"
          description="Live host payable accruals remain auditable in the Non-Escrow Financial Ledger until host disbursement endpoints are introduced."
          actionTo={`/admin/finance/ledger${querySuffix}`}
          actionLabel="Open Financial Ledger"
        />
      )}
    </div>
  );
}

export function AdminSupportTicketTriageQueuePage() {
  const { showDemoPreview, querySuffix } = useDeferredDemoMode();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Support Ticket Triage Queue"
        subtitle="Customer and host helpdesk triage queue for damaged baggage, late pickup, and refund escalations."
        badge={showDemoPreview ? "Demo Preview" : "Bookings & Refund Cross-Link"}
      />
      {showDemoPreview ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between text-xs">
          <div>
            <p className="font-bold text-slate-900">
              #TKT-9042 • Overdue Fee Dispute at Colombo Fort Hub
            </p>
            <p className="text-slate-600 mt-0.5">Priority: High • Linked Sample Booking</p>
          </div>
          <Link
            to={`/admin/support/TKT-9042${querySuffix}`}
            className="px-3 py-1.5 rounded-xl bg-purple-700 text-white font-bold"
          >
            Inspect Ticket
          </Link>
        </div>
      ) : (
        <AdminEmptyStateCard
          title="Helpdesk Ticketing Service Not Yet Enabled"
          description="Support agents should triage live traveller/host escalations using Global Bookings, Custody Evidence, and the Refund Queue."
          actionTo={`/admin/bookings${querySuffix}`}
          actionLabel="Open Global Bookings"
        />
      )}
    </div>
  );
}

export function AdminSupportTicketResolutionViewPage() {
  const { id } = useParams<{ id: string }>();
  const { showDemoPreview, querySuffix } = useDeferredDemoMode();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={`Support Case Overview${id ? `: ${id}` : ""}`}
        subtitle="Cross-surface investigation combining traveller booking history, custody evidence, and refund records."
        badge={showDemoPreview ? "Demo Preview" : "Bookings & Refund Cross-Link"}
      />
      {showDemoPreview ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-xs space-y-2">
          <p className="font-bold text-slate-900">Case {id ?? "#TKT-9042"} (Demo Preview)</p>
          <p className="text-slate-600">Preview conversation thread and timeline snapshot.</p>
        </div>
      ) : (
        <AdminEmptyStateCard
          title="Ticket Thread API Not Yet Active"
          description="Use Global Bookings Inspection and Refund Management to inspect custody photos and resolve payment inquiries directly."
          actionTo={`/admin/refunds${querySuffix}`}
          actionLabel="Open Refund Queue"
        />
      )}
    </div>
  );
}

export function AdminIncidentDisputeInvestigationPage() {
  const { showDemoPreview, querySuffix } = useDeferredDemoMode();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Custody Incidents & Booking Disputes"
        subtitle="Investigate flagged DISPUTED bookings, missing seal exceptions, and overdue custody holds."
        badge={showDemoPreview ? "Demo Preview" : "Live Disputed Filter"}
      />
      {showDemoPreview ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-xs">
          <p className="font-bold text-slate-900">Sample Custody Exception Dossier (Demo Preview)</p>
          <p className="text-slate-600 mt-0.5">
            Inspect tamper-evident photo seals and overstay ledger adjustments.
          </p>
        </div>
      ) : (
        <AdminEmptyStateCard
          title="Inspect Live Disputed Bookings & Custody Evidence"
          description="Review active bookings flagged as DISPUTED along with check-in bag tags, security seals, and signed R2 evidence photo links."
          actionTo={`/admin/bookings?status=DISPUTED${querySuffix ? "&preview=demo" : ""}`}
          actionLabel="Filter Disputed Bookings"
        />
      )}
    </div>
  );
}

export function AdminReviewModerationQueuePage() {
  const { showDemoPreview, querySuffix } = useDeferredDemoMode();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Review Moderation Queue"
        subtitle="Moderate flagged post-collection traveller reviews for policy compliance."
        badge={showDemoPreview ? "Demo Preview" : "Scheduled Phase Extension"}
      />
      {showDemoPreview ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-xs">
          <p className="font-bold text-slate-900">Flagged Review Preview (Demo)</p>
          <p className="text-slate-600 mt-0.5">Awaiting moderator visibility decision.</p>
        </div>
      ) : (
        <AdminEmptyStateCard
          title="No Flagged Reviews Queue Active"
          description="Dedicated review moderation endpoints are scheduled for the next platform governance milestone."
          actionTo={`/admin/locations${querySuffix}`}
          actionLabel="Return to Location Moderation"
        />
      )}
    </div>
  );
}

export function AdminPromotionMarketingEnginePage() {
  const { showDemoPreview, querySuffix } = useDeferredDemoMode();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Promotions & Voucher Campaign Engine"
        subtitle="Configure promotional discount codes, partner campaigns, and budget caps."
        badge={showDemoPreview ? "Demo Preview" : "Scheduled Phase Extension"}
      />
      {showDemoPreview ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-xs">
          <p className="font-bold text-slate-900">Promotional Voucher Campaign (Demo Preview)</p>
          <p className="text-slate-600 mt-0.5">Server-authoritative pricing discount rules.</p>
        </div>
      ) : (
        <AdminEmptyStateCard
          title="Promotion Rules Engine Scheduled Next"
          description="Campaign voucher management endpoints will land in the next platform configuration release."
          actionTo={`/admin${querySuffix}`}
          actionLabel="Back to Command Dashboard"
        />
      )}
    </div>
  );
}

export function AdminPlatformSystemConfigurationPage() {
  const { showDemoPreview, querySuffix } = useDeferredDemoMode();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Platform Fee & System Configuration"
        subtitle="Commission basis points, cancellation refund policy windows, and hold timeout parameters."
        badge={showDemoPreview ? "Demo Preview" : "Scheduled Phase Extension"}
      />
      {showDemoPreview ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-xs">
          <p className="font-bold text-slate-900">15% Standard Marketplace Commission (Demo)</p>
          <p className="text-slate-600 mt-0.5">2-hour full refund boundary active.</p>
        </div>
      ) : (
        <AdminEmptyStateCard
          title="Runtime Policy Defaults Enforced Server-Side"
          description="Platform commission rates (15% / 1500 bps) and STANDARD_FLEX_2H cancellation rules are currently enforced authoritatively in backend contracts; editable platform config APIs launch in the next release."
          actionTo={`/admin/staff${querySuffix}`}
          actionLabel="Manage Users & RBAC"
        />
      )}
    </div>
  );
}
