import React from "react";
import { Link } from "react-router-dom";
import type { BookingStatus, RefundStatus } from "@luggage-storage/contracts";
import { getBookingStatusDisplay } from "@/lib/booking-status";
import { formatRefundStatusDisplay } from "@/lib/formatters";

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_REGEX.test(value.trim()));
}

export function AdminQueryErrorAlert({
  message,
  onRetry
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-950 flex flex-wrap items-center justify-between gap-3"
    >
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-3 py-1 rounded-lg bg-white border border-rose-300 text-rose-900 font-bold hover:bg-rose-100 transition"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function AdminPageHeader({
  title,
  subtitle,
  badge,
  rightSlot
}: {
  title: string;
  subtitle: string;
  badge?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        {badge && (
          <span className="inline-block mb-1.5 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 text-[11px] font-bold">
            {badge}
          </span>
        )}
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-950 tracking-tight">
          {title}
        </h1>
        <p className="text-xs text-slate-600 mt-1">{subtitle}</p>
      </div>
      {rightSlot && <div className="flex flex-wrap items-center gap-2 flex-shrink-0">{rightSlot}</div>}
    </div>
  );
}

export function AdminPaginationBar({
  page,
  totalPages,
  total,
  onPageChange
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (nextPage: number) => void;
}) {
  const safeTotalPages = Math.max(1, totalPages);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 text-xs text-slate-600">
      <span>
        Page <strong className="text-slate-900">{page}</strong> of{" "}
        <strong className="text-slate-900">{safeTotalPages}</strong> •{" "}
        <strong className="text-slate-900">{total}</strong> total record(s)
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="px-3 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= safeTotalPages}
          onClick={() => onPageChange(Math.min(safeTotalPages, page + 1))}
          className="px-3 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function AdminEmptyStateCard({
  title,
  description,
  actionTo,
  actionLabel
}: {
  title: string;
  description: string;
  actionTo?: string;
  actionLabel?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2.5 text-xs">
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <p className="text-slate-600 max-w-lg mx-auto">{description}</p>
      {actionTo && actionLabel && (
        <Link
          to={actionTo}
          className="inline-flex items-center px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold transition"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function statusBadgeToneClasses(status: string): string {
  switch (status) {
    case "ACTIVE":
    case "APPROVED":
    case "SUCCEEDED":
    case "COMPLETED":
    case "ELIGIBLE":
    case "PAID":
    case "RELEASED_TO_TRAVELLER":
      return "bg-emerald-50 text-emerald-800 border border-emerald-200";
    case "PENDING_REVIEW":
    case "PENDING_VERIFICATION":
    case "PENDING_PAYMENT":
    case "PENDING_HOST_APPROVAL":
    case "INFORMATION_REQUESTED":
    case "MANUAL_REVIEW_REQUIRED":
    case "ON_HOLD":
    case "PROCESSING":
      return "bg-amber-50 text-amber-900 border border-amber-200";
    case "REJECTED":
    case "SUSPENDED":
    case "DEACTIVATED":
    case "FAILED":
    case "DISPUTED":
    case "DISPUTED_RELEASE":
    case "CANCELLED_BY_PLATFORM":
    case "CANCELLED_BY_HOST":
      return "bg-rose-50 text-rose-800 border border-rose-200";
    default:
      return "bg-slate-100 text-slate-700 border border-slate-200";
  }
}

export function formatAdminBookingStatus(status: BookingStatus | string, collectionAt?: string) {
  return getBookingStatusDisplay(status, { collectionAt });
}

export function formatAdminRefundStatus(status: RefundStatus | string) {
  return formatRefundStatusDisplay(status);
}
