import { useContext } from "react";
import { QueryClientContext } from "@tanstack/react-query";
import type {
  AvailabilitySearchQuery,
  BookingListQuery,
  CheckoutStatusQuery,
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
