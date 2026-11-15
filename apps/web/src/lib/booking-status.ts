import { BookingStatus } from "@luggage-storage/contracts";

export type BookingStatusBadgeTone = "brand" | "success" | "warning" | "danger" | "neutral";

export interface BookingStatusDisplay {
  label: string;
  tone: BookingStatusBadgeTone;
  isOverdue: boolean;
}

export function getBookingStatusDisplay(
  status: BookingStatus | string,
  options?: {
    collectionAt?: string | Date | null;
    nowMs?: number;
    hasRefund?: boolean;
  }
): BookingStatusDisplay {
  const now = options?.nowMs ?? Date.now();
  const collectionMs = options?.collectionAt ? new Date(options.collectionAt).getTime() : NaN;
  const isOverdue =
    (status === "IN_STORAGE" || status === "CHECKED_IN") &&
    Number.isFinite(collectionMs) &&
    collectionMs < now;

  if (isOverdue || status === "OVERDUE" || status === "DISPUTED_OVERDUE") {
    return {
      label: "Overdue Custody",
      tone: "danger",
      isOverdue: true
    };
  }

  switch (status) {
    case "PENDING_HOST_APPROVAL":
      return { label: "Pending Host Approval", tone: "warning", isOverdue: false };
    case "PENDING_PAYMENT":
      return { label: "Pending Payment", tone: "warning", isOverdue: false };
    case "CONFIRMED":
      return { label: "Confirmed & Reserved", tone: "brand", isOverdue: false };
    case "IN_STORAGE":
    case "CHECKED_IN":
      return { label: "In Active Custody", tone: "success", isOverdue: false };
    case "COMPLETED":
      return { label: "Completed", tone: "neutral", isOverdue: false };
    case "CANCELLED_BY_TRAVELLER":
      return {
        label: options?.hasRefund ? "Cancelled (Refund Recorded)" : "Cancelled by Traveller",
        tone: "neutral",
        isOverdue: false
      };
    case "CANCELLED_BY_HOST":
      return {
        label: options?.hasRefund ? "Cancelled by Host (Refund Recorded)" : "Cancelled by Host",
        tone: "warning",
        isOverdue: false
      };
    case "CANCELLED_BY_PLATFORM":
      return {
        label: options?.hasRefund ? "Cancelled by Platform (Refund Recorded)" : "Cancelled by Platform",
        tone: "warning",
        isOverdue: false
      };
    case "CANCELLED_REFUNDED":
      return {
        label: "Cancelled (Refund Recorded)",
        tone: "neutral",
        isOverdue: false
      };
    case "REJECTED":
      return { label: "Declined by Host", tone: "danger", isOverdue: false };
    case "EXPIRED":
      return { label: "Hold Expired", tone: "neutral", isOverdue: false };
    case "DISPUTED":
      return { label: "Custody Exception / Disputed", tone: "danger", isOverdue: false };
    default:
      return {
        label: String(status).replace(/_/g, " "),
        tone: "neutral",
        isOverdue: false
      };
  }
}

