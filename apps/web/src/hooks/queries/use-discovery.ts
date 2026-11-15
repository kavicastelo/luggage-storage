import { useQuery, useMutation } from "@tanstack/react-query";
import type {
  AvailabilitySearchQuery,
  BookingQuoteRequest,
  SearchLocationsQueryInput
} from "@luggage-storage/contracts";
import { marketplaceApi } from "@/services/marketplace-api";
import { travellerQueryKeys, useResolvedQueryClient } from "./query-keys";

export function useDiscoveryLocations(
  params: SearchLocationsQueryInput,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  return useQuery(
    {
      queryKey: travellerQueryKeys.discoveryList(params),
      queryFn: () => marketplaceApi.searchLocations(params),
      enabled: options.enabled ?? true
    },
    qc
  );
}

export function usePublicLocationDetail(
  locationId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  return useQuery(
    {
      queryKey: travellerQueryKeys.locationDetail(locationId ?? ""),
      queryFn: () => marketplaceApi.getPublicLocationDetails(locationId!),
      enabled: Boolean(locationId) && (options.enabled ?? true)
    },
    qc
  );
}

export function useAvailabilitySearch(
  params: (Partial<AvailabilitySearchQuery> & { dropOffAt: string; collectionAt: string }) | null,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  return useQuery(
    {
      queryKey: travellerQueryKeys.availability(
        params ?? { dropOffAt: "", collectionAt: "" }
      ),
      queryFn: () => marketplaceApi.searchAvailability(params!),
      enabled: Boolean(params?.dropOffAt && params?.collectionAt) && (options.enabled ?? true)
    },
    qc
  );
}

export function useBookingQuoteMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (payload: BookingQuoteRequest) => marketplaceApi.quoteBooking(payload)
    },
    qc
  );
}
