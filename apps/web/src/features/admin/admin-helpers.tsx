import React, { useState } from "react";
import { Link } from "react-router-dom";
import type { BookingStatus, RefundStatus } from "@luggage-storage/contracts";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button, LoadingSkeleton, Modal } from "@/components/ui";
import { getBookingStatusDisplay } from "@/lib/booking-status";
import { formatRefundStatusDisplay } from "@/lib/formatters";

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_REGEX.test(value.trim()));
}

export function truncateUuid(id: string | null | undefined, head = 8, tail = 4): string {
  if (!id) return "—";
  if (id.length <= head + tail + 3) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

export function CopyTextButton({
  value,
  label = "Copy",
  displayText,
  className = ""
}: {
  value: string;
  label?: string;
  displayText?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      // Clipboard unavailable in restricted context
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      title={`Copy ${value}`}
      aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-sand-200 bg-sand-50 hover:bg-sand-100 px-2 py-1 text-[11px] font-mono text-navy-900 transition-colors ${className}`}
    >
      <span>{displayText ?? value}</span>
      {copied ? (
        <Check className="h-3 w-3 text-emerald-600 flex-shrink-0" />
      ) : (
        <Copy className="h-3 w-3 text-sand-700 flex-shrink-0" />
      )}
    </button>
  );
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
    <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="min-w-0">
        {badge && (
          <span className="inline-block mb-1.5 px-2.5 py-0.5 rounded-full bg-terracotta-100 border border-terracotta-200 text-terracotta-800 text-[11px] font-bold">
            {badge}
          </span>
        )}
        <h1 className="text-xl sm:text-2xl font-extrabold text-navy-950 tracking-tight">
          {title}
        </h1>
        <p className="text-xs sm:text-sm text-sand-700 mt-1 leading-relaxed">{subtitle}</p>
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
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-sand-200 text-xs text-sand-700 tabular-nums">
      <span>
        Page <strong className="text-navy-950">{page}</strong> of{" "}
        <strong className="text-navy-950">{safeTotalPages}</strong> •{" "}
        <strong className="text-navy-950">{total}</strong> total record(s)
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="px-3 py-1.5 rounded-lg border border-sand-200 bg-white font-semibold text-navy-900 hover:bg-sand-100 disabled:opacity-40 transition-colors"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= safeTotalPages}
          onClick={() => onPageChange(Math.min(safeTotalPages, page + 1))}
          className="px-3 py-1.5 rounded-lg border border-sand-200 bg-white font-semibold text-navy-900 hover:bg-sand-100 disabled:opacity-40 transition-colors"
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
    <div className="bg-white rounded-2xl border border-sand-200 p-8 text-center space-y-2.5 text-xs shadow-sm">
      <p className="text-sm font-bold text-navy-950">{title}</p>
      <p className="text-sand-700 max-w-lg mx-auto leading-relaxed">{description}</p>
      {actionTo && actionLabel && (
        <div className="pt-1">
          <Link
            to={actionTo}
            className="inline-flex items-center px-4 py-2 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white font-bold transition shadow-sm"
          >
            {actionLabel}
          </Link>
        </div>
      )}
    </div>
  );
}

export function AdminTableSkeleton({
  rows = 5,
  columns = 5
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading records">
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, idx) => (
          <LoadingSkeleton key={`head-${idx}`} variant="text" className="h-4 w-3/4" />
        ))}
      </div>
      <div className="space-y-2.5 pt-2 border-t border-sand-200">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div
            key={`row-${rIdx}`}
            className="grid gap-3 py-2"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((__, cIdx) => (
              <LoadingSkeleton key={`cell-${rIdx}-${cIdx}`} variant="text" className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminCardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading items">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={`card-skel-${idx}`}
          className="p-4 rounded-xl border border-sand-200 bg-sand-50/60 space-y-2.5"
        >
          <div className="flex items-center justify-between gap-4">
            <LoadingSkeleton variant="text" className="h-4 w-1/3" />
            <LoadingSkeleton variant="rectangular" className="h-7 w-28" />
          </div>
          <LoadingSkeleton variant="text" className="h-3.5 w-2/3" />
          <LoadingSkeleton variant="text" className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function AdminImageLightboxModal({
  image,
  onClose
}: {
  image: { url: string; caption?: string | null; title?: string } | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={Boolean(image)}
      onClose={onClose}
      title={image?.title || image?.caption || "Evidence Photo Preview"}
      subtitle={image?.caption && image?.title ? image.caption : undefined}
      size="xl"
      footer={
        image ? (
          <>
            <a
              href={image.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-sand-200 bg-white hover:bg-sand-100 text-xs font-bold text-navy-900 transition"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Open Original Full Resolution</span>
            </a>
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Close Preview
            </Button>
          </>
        ) : undefined
      }
    >
      {image && (
        <div className="flex items-center justify-center bg-sand-50 rounded-xl border border-sand-200 p-3 min-h-[260px]">
          <img
            src={image.url}
            alt={image.caption || image.title || "Uploaded facility or custody evidence"}
            className="max-h-[65vh] w-auto max-w-full rounded-lg object-contain shadow-sm"
          />
        </div>
      )}
    </Modal>
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
    case "DISBURSED":
    case "CONFIRMED":
    case "RELEASED_TO_TRAVELLER":
      return "bg-emerald-50 text-emerald-800 border border-emerald-200";
    case "IN_STORAGE":
    case "CHECKED_IN":
      return "bg-sky-50 text-sky-900 border border-sky-200";
    case "PENDING_REVIEW":
    case "PENDING_VERIFICATION":
    case "PENDING_PAYMENT":
    case "PENDING_HOST_APPROVAL":
    case "INFORMATION_REQUESTED":
    case "MANUAL_REVIEW_REQUIRED":
    case "ON_HOLD":
    case "PROCESSING":
    case "GENERATED":
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
      return "bg-sand-100 text-navy-900 border border-sand-200";
  }
}

export function formatAdminBookingStatus(status: BookingStatus | string, collectionAt?: string) {
  return getBookingStatusDisplay(status, { collectionAt });
}

export function formatAdminRefundStatus(status: RefundStatus | string) {
  return formatRefundStatusDisplay(status);
}
