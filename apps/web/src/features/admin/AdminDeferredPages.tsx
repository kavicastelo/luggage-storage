import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  CANCELLATION_POLICY_CODES,
  DEFAULT_COMMISSION_RATE_BPS,
  DEFAULT_CUSTODY_PASS_TTL_MINUTES,
  DEFAULT_HOST_APPROVAL_HOLD_MINUTES,
  DEFAULT_OVERDUE_GRACE_MINUTES,
  DEFAULT_PAYMENT_HOLD_MINUTES,
  LEDGER_ACCOUNTS
} from "@luggage-storage/contracts";
import { ShieldCheck } from "lucide-react";
import { isDemoPreviewActive } from "@/config/demo-preview";
import { isFeaturePromotionsEnabled, isFeatureReviewsEnabled } from "@/config/feature-flags";
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

export function AdminReviewModerationQueuePage() {
  const { showDemoPreview, querySuffix } = useDeferredDemoMode();
  const reviewsEnabled = isFeatureReviewsEnabled();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Review Moderation Queue"
        subtitle="Moderate flagged post-collection traveller reviews for policy compliance."
        badge={showDemoPreview ? "Demo Preview" : reviewsEnabled ? "Enabled" : "Post-MVP Module"}
      />
      {showDemoPreview ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-xs">
          <p className="font-bold text-slate-900">Flagged Review Preview (Demo)</p>
          <p className="text-slate-600 mt-0.5">Awaiting moderator visibility decision.</p>
        </div>
      ) : (
        <AdminEmptyStateCard
          title="Review Moderation Disabled by Feature Configuration"
          description="Traveller ratings and review moderation workflows remain gated behind VITE_FEATURE_REVIEWS until post-MVP public ratings launch."
          actionTo={`/admin/locations${querySuffix}`}
          actionLabel="Return to Location Moderation"
        />
      )}
    </div>
  );
}

export function AdminPromotionMarketingEnginePage() {
  const { showDemoPreview, querySuffix } = useDeferredDemoMode();
  const promotionsEnabled = isFeaturePromotionsEnabled();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Promotions & Voucher Campaign Engine"
        subtitle="Configure promotional discount codes, partner campaigns, and budget caps."
        badge={
          showDemoPreview ? "Demo Preview" : promotionsEnabled ? "Enabled" : "Post-MVP Module"
        }
      />
      {showDemoPreview ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-xs">
          <p className="font-bold text-slate-900">Promotional Voucher Campaign (Demo Preview)</p>
          <p className="text-slate-600 mt-0.5">Server-authoritative pricing discount rules.</p>
        </div>
      ) : (
        <AdminEmptyStateCard
          title="Promotions Engine Disabled by Feature Configuration"
          description="Voucher campaigns and promotional rule builders remain gated behind VITE_FEATURE_PROMOTIONS until post-MVP marketing launches."
          actionTo={`/admin${querySuffix}`}
          actionLabel="Back to Command Dashboard"
        />
      )}
    </div>
  );
}

export function AdminPlatformSystemConfigurationPage() {
  const { showDemoPreview, querySuffix } = useDeferredDemoMode();

  const commissionPercent = (DEFAULT_COMMISSION_RATE_BPS / 100).toFixed(0);
  const hostSharePercent = (100 - DEFAULT_COMMISSION_RATE_BPS / 100).toFixed(0);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Platform Fee & System Configuration"
        subtitle="Authoritative read-only runtime settlement, cancellation, custody, and ledger parameters enforced server-side."
        badge={showDemoPreview ? "Demo Preview" : "Authoritative Read-Only Policies"}
        rightSlot={
          !showDemoPreview ? (
            <Link
              to={`/admin/staff${querySuffix}`}
              className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 hover:bg-slate-50"
            >
              Manage Users &amp; RBAC
            </Link>
          ) : undefined
        }
      />
      {showDemoPreview ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-xs">
          <p className="font-bold text-slate-900">15% Standard Marketplace Commission (Demo)</p>
          <p className="text-slate-600 mt-0.5">2-hour full refund boundary active.</p>
        </div>
      ) : (
        <div className="space-y-5 text-xs">
          <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-purple-300 flex-shrink-0" />
            <p className="leading-relaxed">
              These commercial and custody rules are compiled and enforced server-side across
              quotation snapshots, payment verification, and double-entry ledger settlement to
              guarantee mathematical auditability.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2 shadow-sm">
              <span className="text-[11px] font-bold uppercase text-slate-500">
                Commercial Fee Split
              </span>
              <p className="text-lg font-extrabold text-slate-950">
                {commissionPercent}% Commission / {hostSharePercent}% Host Share
              </p>
              <p className="text-slate-600">
                Standard platform fee rate: <strong>{DEFAULT_COMMISSION_RATE_BPS} bps</strong>{" "}
                applied to storage subtotal in integer minor units (LKR).
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2 shadow-sm">
              <span className="text-[11px] font-bold uppercase text-slate-500">
                Cancellation Policy Engine
              </span>
              <p className="text-lg font-extrabold text-slate-950 font-mono">
                {CANCELLATION_POLICY_CODES[0]}
              </p>
              <p className="text-slate-600">
                &gt; 2 hours before drop-off: <strong>100% refund</strong> • &le; 2 hours before
                drop-off: <strong>50% refund</strong> • Host/Platform cancel: <strong>100%</strong>.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2 shadow-sm">
              <span className="text-[11px] font-bold uppercase text-slate-500">
                Hold &amp; Token Expiration Windows
              </span>
              <p className="text-sm font-extrabold text-slate-950">
                Host Approval: {DEFAULT_HOST_APPROVAL_HOLD_MINUTES}m • Payment Hold:{" "}
                {DEFAULT_PAYMENT_HOLD_MINUTES}m
              </p>
              <p className="text-slate-600">
                Single-use QR/PIN Custody Pass TTL:{" "}
                <strong>{DEFAULT_CUSTODY_PASS_TTL_MINUTES} minutes</strong> (rate-limited).
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2 shadow-sm">
              <span className="text-[11px] font-bold uppercase text-slate-500">
                Custody Release &amp; Grace Policy
              </span>
              <p className="text-sm font-extrabold text-slate-950">
                {DEFAULT_OVERDUE_GRACE_MINUTES}-Minute Grace • Zero Possessory Lien
              </p>
              <p className="text-slate-600">
                Valid COLLECTION credentials always release stored luggage; overdue durations past
                grace are recorded without holding belongings hostage.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-sm">
            <h2 className="text-sm font-bold text-slate-950">
              Non-Escrow Double-Entry Chart of Accounts
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.values(LEDGER_ACCOUNTS).map((account) => (
                <div
                  key={account.code}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200"
                >
                  <p className="font-mono font-bold text-purple-800">{account.code}</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{account.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
