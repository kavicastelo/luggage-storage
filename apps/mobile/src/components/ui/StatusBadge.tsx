import React from "react";
import { Badge, type BadgeVariant } from "../Badge";
import type { MobileIconName } from "../MobileIcon";

export interface StatusDescriptor {
  label: string;
  variant: BadgeVariant;
  icon: MobileIconName;
}

const STATUS_MAP: Record<string, StatusDescriptor> = {
  // Bookings
  PENDING_HOST_APPROVAL: {
    label: "Awaiting Host Approval",
    variant: "warning",
    icon: "clock"
  },
  PENDING_PAYMENT: {
    label: "Payment Required",
    variant: "warning",
    icon: "credit-card"
  },
  CONFIRMED: {
    label: "Confirmed",
    variant: "success",
    icon: "check-circle"
  },
  IN_STORAGE: {
    label: "In Storage",
    variant: "info",
    icon: "shield-check"
  },
  COMPLETED: {
    label: "Completed",
    variant: "navy",
    icon: "package-check"
  },
  CANCELLED_BY_TRAVELLER: {
    label: "Cancelled by You",
    variant: "neutral",
    icon: "x"
  },
  CANCELLED_BY_HOST: {
    label: "Cancelled by Host",
    variant: "danger",
    icon: "ban"
  },
  CANCELLED_BY_PLATFORM: {
    label: "Cancelled by Platform",
    variant: "danger",
    icon: "ban"
  },
  REJECTED: {
    label: "Rejected",
    variant: "danger",
    icon: "x"
  },
  EXPIRED: {
    label: "Hold Expired",
    variant: "neutral",
    icon: "clock-alert"
  },
  DISPUTED: {
    label: "Incident / Disputed",
    variant: "danger",
    icon: "alert-triangle"
  },
  // Payments
  INITIATED: {
    label: "Checkout Initiated",
    variant: "info",
    icon: "credit-card"
  },
  PENDING_GATEWAY: {
    label: "Awaiting Gateway",
    variant: "warning",
    icon: "clock"
  },
  SUCCEEDED: {
    label: "Payment Confirmed",
    variant: "success",
    icon: "check-circle"
  },
  FAILED: {
    label: "Payment Failed",
    variant: "danger",
    icon: "alert-circle"
  },
  ORPHANED_SUCCEEDED: {
    label: "Paid After Hold Expiry",
    variant: "warning",
    icon: "alert-triangle"
  },
  // Custody
  EXPECTED: {
    label: "Awaiting Drop-off",
    variant: "info",
    icon: "clock"
  },
  CHECKED_IN: {
    label: "Checked In",
    variant: "success",
    icon: "check-circle"
  },
  OVERDUE: {
    label: "Overdue Pickup",
    variant: "warning",
    icon: "clock-alert"
  },
  RELEASED_TO_TRAVELLER: {
    label: "Released",
    variant: "navy",
    icon: "package-check"
  },
  DISPUTED_RELEASE: {
    label: "Disputed Release",
    variant: "danger",
    icon: "alert-triangle"
  },
  ABANDONED: {
    label: "Uncollected",
    variant: "danger",
    icon: "alert-circle"
  },
  // Host Business / Verification / Locations / Payables
  DRAFT: {
    label: "Draft",
    variant: "neutral",
    icon: "edit"
  },
  PENDING_VERIFICATION: {
    label: "Pending Verification",
    variant: "warning",
    icon: "clock"
  },
  PENDING_REVIEW: {
    label: "Pending Review",
    variant: "warning",
    icon: "clock"
  },
  INFORMATION_REQUESTED: {
    label: "Info Requested",
    variant: "warning",
    icon: "alert-circle"
  },
  ACTIVE: {
    label: "Active",
    variant: "success",
    icon: "check-circle"
  },
  APPROVED: {
    label: "Approved",
    variant: "success",
    icon: "check-circle"
  },
  VERIFIED: {
    label: "Verified",
    variant: "success",
    icon: "shield-check"
  },
  DISABLED: {
    label: "Disabled",
    variant: "neutral",
    icon: "ban"
  },
  SUSPENDED: {
    label: "Suspended",
    variant: "danger",
    icon: "ban"
  },
  ACCRUED: {
    label: "Accrued",
    variant: "info",
    icon: "wallet"
  },
  ELIGIBLE: {
    label: "Eligible for Payout",
    variant: "success",
    icon: "check-circle"
  },
  ON_HOLD: {
    label: "On Hold",
    variant: "warning",
    icon: "alert-triangle"
  },
  PAID: {
    label: "Paid",
    variant: "navy",
    icon: "check-circle"
  },
  REVERSED: {
    label: "Reversed",
    variant: "danger",
    icon: "x"
  },
  CANCELLED_CLAWBACK: {
    label: "Clawback Cancelled",
    variant: "danger",
    icon: "ban"
  },
  // Booking Modes
  INSTANT: {
    label: "Instant Confirm",
    variant: "info",
    icon: "check-circle"
  },
  HOST_APPROVAL: {
    label: "Host Approval",
    variant: "warning",
    icon: "clock"
  }
};

export function resolveStatusDescriptor(status: string): StatusDescriptor {
  const mapped = STATUS_MAP[status];
  if (mapped) {
    return mapped;
  }
  return {
    label: status.replace(/_/g, " "),
    variant: "neutral",
    icon: "circle-dot"
  };
}

export interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
  testID?: string;
}

export function StatusBadge({ status, size = "md", testID }: StatusBadgeProps) {
  const descriptor = resolveStatusDescriptor(status);
  return (
    <Badge
      testID={testID ?? `status-badge-${status}`}
      label={descriptor.label}
      variant={descriptor.variant}
      icon={descriptor.icon}
      size={size}
    />
  );
}
