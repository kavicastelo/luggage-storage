import { useContext } from "react";
import { QueryClientContext } from "@tanstack/react-query";
import type {
  AdminAuditEventQuery,
  AdminHostListQuery,
  AdminLedgerQuery,
  AdminRefundListQuery,
  AdminUserQuery,
  AvailabilitySearchQuery,
  BookingListQuery,
  CheckoutStatusQuery,
  HostVerificationQueueQuery,
  LocationModerationQueueQuery,
  SearchLocationsQueryInput
} from "@luggage-storage/contracts";
import { queryClient as defaultQueryClient } from "@/lib/query-client";

export function useResolvedQueryClient() {
  return useContext(QueryClientContext) ?? defaultQueryClient;
}

export const travellerQueryKeys = {
  all: ["traveller"] as const,
  discoveryList: (params: SearchLocationsQueryInput) =>
    ["traveller", "discovery", "list", params] as const,
  locationDetail: (locationId: string) =>
    ["traveller", "discovery", "detail", locationId] as const,
  availability: (
    params: Partial<AvailabilitySearchQuery> & { dropOffAt: string; collectionAt: string }
  ) => ["traveller", "availability", params] as const,
  bookings: (params: Partial<BookingListQuery>) =>
    ["traveller", "bookings", "list", params] as const,
  bookingDetail: (bookingId: string) =>
    ["traveller", "bookings", "detail", bookingId] as const,
  checkoutStatus: (query: CheckoutStatusQuery) =>
    ["traveller", "payments", "checkout-status", query] as const
};

export const hostQueryKeys = {
  all: ["host"] as const,
  businesses: () => ["host", "businesses"] as const,
  businessDetail: (businessId: string) => ["host", "businesses", "detail", businessId] as const,
  verification: (businessId: string) => ["host", "businesses", "verification", businessId] as const,
  payoutDetails: (businessId: string) => ["host", "businesses", "payout", businessId] as const,
  staff: (businessId: string) => ["host", "businesses", "staff", businessId] as const,
  locations: () => ["host", "locations"] as const,
  locationDetail: (locationId: string) => ["host", "locations", "detail", locationId] as const,
  openingHours: (locationId: string) => ["host", "locations", "opening-hours", locationId] as const,
  exceptions: (locationId: string) => ["host", "locations", "exceptions", locationId] as const,
  zones: (locationId: string) => ["host", "locations", "zones", locationId] as const,
  media: (locationId: string) => ["host", "locations", "media", locationId] as const,
  capacityPools: (locationId: string) => ["host", "locations", "capacity-pools", locationId] as const,
  pricingPolicy: (locationId: string) => ["host", "locations", "pricing", locationId] as const,
  bookings: (params: Partial<BookingListQuery> = {}) => ["host", "bookings", "list", params] as const,
  bookingDetail: (bookingId: string) => ["host", "bookings", "detail", bookingId] as const,
  custodyDetail: (bookingId: string) => ["host", "custody", "detail", bookingId] as const,
  financeSummary: (businessId?: string) =>
    ["host", "finance", "summary", businessId ?? "all"] as const
};

export const adminQueryKeys = {
  all: ["admin"] as const,
  metricsSummary: () => ["admin", "metrics", "summary"] as const,
  verifications: (params: Partial<HostVerificationQueueQuery> = {}) =>
    ["admin", "verifications", "list", params] as const,
  verificationDetail: (verificationId: string) =>
    ["admin", "verifications", "detail", verificationId] as const,
  hosts: (params: Partial<AdminHostListQuery> = {}) => ["admin", "hosts", "list", params] as const,
  hostDetail: (businessId: string) => ["admin", "hosts", "detail", businessId] as const,
  locationModeration: (params: Partial<LocationModerationQueueQuery> = {}) =>
    ["admin", "locations", "moderation", params] as const,
  locationDetail: (locationId: string) => ["admin", "locations", "detail", locationId] as const,
  locationPools: (locationId: string) => ["admin", "locations", "pools", locationId] as const,
  locationPricing: (locationId: string) => ["admin", "locations", "pricing", locationId] as const,
  bookings: (params: Partial<BookingListQuery> = {}) =>
    ["admin", "bookings", "list", params] as const,
  bookingDetail: (bookingId: string) => ["admin", "bookings", "detail", bookingId] as const,
  custodyDetail: (bookingId: string) => ["admin", "custody", "detail", bookingId] as const,
  payments: (params: { page?: number; limit?: number; bookingId?: string } = {}) =>
    ["admin", "payments", "list", params] as const,
  refunds: (params: Partial<AdminRefundListQuery> = {}) =>
    ["admin", "refunds", "list", params] as const,
  ledger: (params: Partial<AdminLedgerQuery> = {}) =>
    ["admin", "finance", "ledger", params] as const,
  auditEvents: (params: Partial<AdminAuditEventQuery> = {}) =>
    ["admin", "audit-events", "list", params] as const,
  auditEventDetail: (eventId: string) => ["admin", "audit-events", "detail", eventId] as const,
  users: (params: Partial<AdminUserQuery> = {}) => ["admin", "users", "list", params] as const,
  userDetail: (userId: string) => ["admin", "users", "detail", userId] as const,
  userPermissions: (userId: string) => ["admin", "users", "permissions", userId] as const,
  roles: () => ["admin", "roles"] as const,
  permissions: () => ["admin", "permissions"] as const
};
