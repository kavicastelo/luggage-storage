import { useMemo } from "react";
import { useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query";
import type {
  AvailabilitySearchQuery,
  PublicStorageLocation,
  SearchLocationsQueryInput
} from "@luggage-storage/contracts";
import { mobileQueryKeys } from "../lib/query-keys";
import { ApiClientError } from "../services/api-client";
import { marketplaceApi } from "../services/marketplace-api";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useSearchLocationsQuery(
  params?: Partial<SearchLocationsQueryInput>,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: mobileQueryKeys.discovery.search(params),
    queryFn: () => marketplaceApi.searchLocations(params),
    enabled
  });
}

export function useInfiniteSearchLocationsQuery(
  params?: Omit<Partial<SearchLocationsQueryInput>, "page">,
  enabled: boolean = true
) {
  return useInfiniteQuery({
    queryKey: [...mobileQueryKeys.discovery.search(params), "infinite"] as const,
    queryFn: ({ pageParam = 1 }) =>
      marketplaceApi.searchLocations({ ...params, page: pageParam as number }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    enabled
  });
}

export function usePublicLocationDetailQuery(locationId?: string) {
  const isValidUuid = Boolean(locationId && UUID_REGEX.test(locationId));
  return useQuery({
    queryKey: mobileQueryKeys.discovery.detail(locationId ?? "invalid"),
    queryFn: () => marketplaceApi.getPublicLocationDetails(locationId as string),
    enabled: isValidUuid
  });
}

export function useSearchAvailabilityQuery(params: AvailabilitySearchQuery | null) {
  const isValidWindow = Boolean(
    params &&
      new Date(params.collectionAt).getTime() > new Date(params.dropOffAt).getTime()
  );

  return useQuery({
    queryKey: params
      ? mobileQueryKeys.discovery.availability(params)
      : (["discovery", "availability", "idle"] as const),
    queryFn: () => marketplaceApi.searchAvailability(params as AvailabilitySearchQuery),
    enabled: isValidWindow
  });
}

export function useSavedLocationsDetailsQuery(locationIds: string[]) {
  const validIds = useMemo(
    () => locationIds.filter((id) => UUID_REGEX.test(id)),
    [locationIds]
  );

  const queries = useQueries({
    queries: validIds.map((id) => ({
      queryKey: mobileQueryKeys.discovery.detail(id),
      queryFn: () => marketplaceApi.getPublicLocationDetails(id),
      retry: (failureCount: number, error: unknown) =>
        !(error instanceof ApiClientError && error.statusCode === 404) && failureCount < 1
    }))
  });

  const items: PublicStorageLocation[] = [];
  const failedIds: string[] = [];

  queries.forEach((q, idx) => {
    const id = validIds[idx];
    if (q.data) {
      items.push(q.data);
    } else if (q.isError && id) {
      failedIds.push(id);
    }
  });

  const isLoading = validIds.length > 0 && queries.some((q) => q.isLoading);
  const isFetching = queries.some((q) => q.isFetching);

  const refetchAll = async () => {
    await Promise.all(queries.map((q) => q.refetch()));
  };

  return {
    items,
    failedIds,
    isLoading,
    isFetching,
    refetchAll
  };
}
