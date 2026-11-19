import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AddHostStaffRequest,
  BookingListQuery,
  CancelBookingRequest,
  CompleteCheckInRequest,
  CompleteCollectionRequest,
  ConfigurePricingPolicyRequest,
  CreateCapacityPoolRequest,
  CreateHostBusinessRequest,
  CreateLocationRequest,
  CreateOpeningHoursExceptionRequest,
  CreateStorageZoneRequest,
  HostDecisionBookingRequest,
  HostRejectBookingRequest,
  OpeningHourItemInput,
  SubmitHostVerificationRequest,
  UpdateCapacityPoolRequest,
  UpdateHostBusinessRequest,
  UpdateHostStaffRequest,
  UpdateLocationRequest,
  VerifyCustodyPassRequest
} from "@luggage-storage/contracts";
import { mobileQueryKeys } from "../lib/query-keys";
import { ApiClientError } from "../services/api-client";
import { marketplaceApi } from "../services/marketplace-api";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useOwnedBusinessesQuery(enabled: boolean = true) {
  return useQuery({
    queryKey: mobileQueryKeys.host.businesses,
    queryFn: () => marketplaceApi.getOwnedBusinesses(),
    enabled
  });
}

export function useBusinessVerificationQuery(businessId?: string, enabled: boolean = true) {
  const isValid = Boolean(businessId && UUID_REGEX.test(businessId));
  return useQuery({
    queryKey: mobileQueryKeys.host.verification(businessId ?? "invalid"),
    queryFn: () => marketplaceApi.getVerification(businessId as string),
    enabled: enabled && isValid
  });
}

export function useBusinessPayoutDetailsQuery(businessId?: string, enabled: boolean = true) {
  const isValid = Boolean(businessId && UUID_REGEX.test(businessId));
  return useQuery({
    queryKey: mobileQueryKeys.host.payoutDetails(businessId ?? "invalid"),
    queryFn: () => marketplaceApi.getBusinessPayoutDetails(businessId as string),
    enabled: enabled && isValid
  });
}

export function useOwnedLocationsQuery(enabled: boolean = true) {
  return useQuery({
    queryKey: mobileQueryKeys.host.locations,
    queryFn: () => marketplaceApi.getOwnedLocations(),
    enabled
  });
}

export function useHostLocationDetailQuery(locationId?: string, enabled: boolean = true) {
  const isValid = Boolean(locationId && UUID_REGEX.test(locationId));
  return useQuery({
    queryKey: mobileQueryKeys.host.location(locationId ?? "invalid"),
    queryFn: () => marketplaceApi.getLocationById(locationId as string),
    enabled: enabled && isValid
  });
}

export function useCapacityPoolsQuery(locationId?: string, enabled: boolean = true) {
  const isValid = Boolean(locationId && UUID_REGEX.test(locationId));
  return useQuery({
    queryKey: mobileQueryKeys.host.capacityPools(locationId ?? "invalid"),
    queryFn: () => marketplaceApi.getCapacityPools(locationId as string),
    enabled: enabled && isValid
  });
}

export function usePricingPolicyQuery(locationId?: string, enabled: boolean = true) {
  const isValid = Boolean(locationId && UUID_REGEX.test(locationId));
  return useQuery({
    queryKey: mobileQueryKeys.host.pricing(locationId ?? "invalid"),
    queryFn: async () => {
      try {
        return await marketplaceApi.getPricingPolicy(locationId as string);
      } catch (err) {
        if (err instanceof ApiClientError && err.statusCode === 404) {
          return null;
        }
        throw err;
      }
    },
    enabled: enabled && isValid
  });
}

export function useHostBookingsQuery(
  params?: Partial<BookingListQuery>,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: mobileQueryKeys.host.bookings(params),
    queryFn: () => marketplaceApi.getHostBookings(params),
    enabled
  });
}

export function useInfiniteHostBookingsQuery(
  params?: Omit<Partial<BookingListQuery>, "page">,
  enabled: boolean = true
) {
  return useInfiniteQuery({
    queryKey: [...mobileQueryKeys.host.bookings(params), "infinite"] as const,
    queryFn: ({ pageParam = 1 }) =>
      marketplaceApi.getHostBookings({ ...params, page: pageParam as number }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage.pagination) return undefined;
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    enabled
  });
}

export function useHostBookingDetailQuery(bookingId?: string, enabled: boolean = true) {
  const isValid = Boolean(bookingId && UUID_REGEX.test(bookingId));
  return useQuery({
    queryKey: mobileQueryKeys.host.bookingDetail(bookingId ?? "invalid"),
    queryFn: () => marketplaceApi.getHostBookingDetail(bookingId as string),
    enabled: enabled && isValid
  });
}

export function useCustodyDetailQuery(bookingId?: string, enabled: boolean = true) {
  const isValid = Boolean(bookingId && UUID_REGEX.test(bookingId));
  return useQuery({
    queryKey: mobileQueryKeys.host.custodyDetail(bookingId ?? "invalid"),
    queryFn: () => marketplaceApi.getCustodyDetail(bookingId as string),
    enabled: enabled && isValid
  });
}

export function useHostFinanceSummaryQuery(businessId?: string, enabled: boolean = true) {
  return useQuery({
    queryKey: [...mobileQueryKeys.host.financeSummary, businessId ?? "all"] as const,
    queryFn: () => marketplaceApi.getHostFinanceSummary(businessId),
    enabled
  });
}

export function useCreateBusinessMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateHostBusinessRequest) => marketplaceApi.createBusiness(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: mobileQueryKeys.host.businesses });
    }
  });
}

export function useUpdateBusinessMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { businessId: string; data: UpdateHostBusinessRequest }) =>
      marketplaceApi.updateBusiness(params.businessId, params.data),
    onSuccess: async (_res, vars) => {
      await queryClient.invalidateQueries({ queryKey: mobileQueryKeys.host.businesses });
      await queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.host.payoutDetails(vars.businessId)
      });
    }
  });
}

export function useSubmitVerificationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { businessId: string; data: SubmitHostVerificationRequest }) =>
      marketplaceApi.submitVerification(params.businessId, params.data),
    onSuccess: async (_res, vars) => {
      await queryClient.invalidateQueries({ queryKey: mobileQueryKeys.host.businesses });
      await queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.host.verification(vars.businessId)
      });
    }
  });
}

export function useCreateLocationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLocationRequest) => marketplaceApi.createLocation(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: mobileQueryKeys.host.locations });
    }
  });
}

export function useUpdateLocationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { locationId: string; data: UpdateLocationRequest }) =>
      marketplaceApi.updateLocation(params.locationId, params.data),
    onSuccess: async (updated) => {
      queryClient.setQueryData(mobileQueryKeys.host.location(updated.id), updated);
      await queryClient.invalidateQueries({ queryKey: mobileQueryKeys.host.locations });
    }
  });
}

export function useSubmitLocationForReviewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (locationId: string) => marketplaceApi.submitLocationForReview(locationId),
    onSuccess: async (updated) => {
      queryClient.setQueryData(mobileQueryKeys.host.location(updated.id), updated);
      await queryClient.invalidateQueries({ queryKey: mobileQueryKeys.host.locations });
    }
  });
}

export function useDisableLocationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (locationId: string) => marketplaceApi.disableLocation(locationId),
    onSuccess: async (updated) => {
      queryClient.setQueryData(mobileQueryKeys.host.location(updated.id), updated);
      await queryClient.invalidateQueries({ queryKey: mobileQueryKeys.host.locations });
    }
  });
}

export function useSetOpeningHoursMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { locationId: string; schedules: OpeningHourItemInput[] }) =>
      marketplaceApi.setOpeningHours(params.locationId, params.schedules),
    onSuccess: async (_res, vars) => {
      await queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.host.location(vars.locationId)
      });
    }
  });
}

export function useAddOpeningHoursExceptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { locationId: string; data: CreateOpeningHoursExceptionRequest }) =>
      marketplaceApi.addOpeningHoursException(params.locationId, params.data),
    onSuccess: async (_res, vars) => {
      await queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.host.location(vars.locationId)
      });
    }
  });
}

export function useCreateStorageZoneMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { locationId: string; data: CreateStorageZoneRequest }) =>
      marketplaceApi.createStorageZone(params.locationId, params.data),
    onSuccess: async (_res, vars) => {
      await queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.host.location(vars.locationId)
      });
    }
  });
}

export function useCreateCapacityPoolMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { locationId: string; data: CreateCapacityPoolRequest }) =>
      marketplaceApi.createCapacityPool(params.locationId, params.data),
    onSuccess: async (_res, vars) => {
      await queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.host.capacityPools(vars.locationId)
      });
    }
  });
}

export function useUpdateCapacityPoolMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      poolId: string;
      locationId: string;
      data: UpdateCapacityPoolRequest;
    }) => marketplaceApi.updateCapacityPool(params.poolId, params.data),
    onSuccess: async (_res, vars) => {
      await queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.host.capacityPools(vars.locationId)
      });
    }
  });
}

export function useConfigurePricingPolicyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { locationId: string; data: ConfigurePricingPolicyRequest }) =>
      marketplaceApi.configurePricingPolicy(params.locationId, params.data),
    onSuccess: async (updated, vars) => {
      queryClient.setQueryData(mobileQueryKeys.host.pricing(vars.locationId), updated);
      await queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.host.location(vars.locationId)
      });
    }
  });
}

export function useAcceptHostBookingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { bookingId: string; data?: HostDecisionBookingRequest }) =>
      marketplaceApi.acceptHostBooking(params.bookingId, params.data ?? {}),
    onSuccess: async (updated) => {
      queryClient.setQueryData(mobileQueryKeys.host.bookingDetail(updated.id), updated);
      await queryClient.invalidateQueries({ queryKey: mobileQueryKeys.host.all });
    }
  });
}

export function useRejectHostBookingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { bookingId: string; data: HostRejectBookingRequest }) =>
      marketplaceApi.rejectHostBooking(params.bookingId, params.data),
    onSuccess: async (updated) => {
      queryClient.setQueryData(mobileQueryKeys.host.bookingDetail(updated.id), updated);
      await queryClient.invalidateQueries({ queryKey: mobileQueryKeys.host.all });
    }
  });
}

export function useHostCancelBookingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { bookingId: string; data: CancelBookingRequest }) =>
      marketplaceApi.hostCancelBooking(params.bookingId, params.data),
    onSuccess: async (updated) => {
      queryClient.setQueryData(mobileQueryKeys.host.bookingDetail(updated.id), updated);
      await queryClient.invalidateQueries({ queryKey: mobileQueryKeys.host.all });
    }
  });
}

export function useVerifyCustodyPassMutation() {
  return useMutation({
    mutationFn: (data: VerifyCustodyPassRequest) => marketplaceApi.verifyCustodyPass(data)
  });
}

export function useCompleteCheckInMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { bookingId: string; data: CompleteCheckInRequest }) =>
      marketplaceApi.completeCheckIn(params.bookingId, params.data),
    onSuccess: async (_custody, vars) => {
      await queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.host.custodyDetail(vars.bookingId)
      });
      await queryClient.invalidateQueries({ queryKey: mobileQueryKeys.host.all });
    }
  });
}

export function useCompleteCollectionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { bookingId: string; data: CompleteCollectionRequest }) =>
      marketplaceApi.completeCollection(params.bookingId, params.data),
    onSuccess: async (_custody, vars) => {
      await queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.host.custodyDetail(vars.bookingId)
      });
      await queryClient.invalidateQueries({ queryKey: mobileQueryKeys.host.all });
    }
  });
}

export function useHostPayoutBatchesQuery(businessId?: string, enabled: boolean = true) {
  return useQuery({
    queryKey: mobileQueryKeys.host.payoutBatches(businessId),
    queryFn: () => marketplaceApi.getHostPayoutBatches(businessId),
    enabled
  });
}

export function useBusinessStaffQuery(businessId?: string, enabled: boolean = true) {
  const isValid = Boolean(businessId && UUID_REGEX.test(businessId));
  return useQuery({
    queryKey: mobileQueryKeys.host.staff(businessId ?? "invalid"),
    queryFn: () => marketplaceApi.getBusinessStaff(businessId as string),
    enabled: enabled && isValid
  });
}

export function useInviteBusinessStaffMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { businessId: string; data: AddHostStaffRequest }) =>
      marketplaceApi.inviteBusinessStaff(params.businessId, params.data),
    onSuccess: async (_res, vars) => {
      await queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.host.staff(vars.businessId)
      });
    }
  });
}

export function useUpdateBusinessStaffMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      businessId: string;
      membershipId: string;
      data: UpdateHostStaffRequest;
    }) => marketplaceApi.updateBusinessStaff(params.businessId, params.membershipId, params.data),
    onSuccess: async (_res, vars) => {
      await queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.host.staff(vars.businessId)
      });
    }
  });
}

export function useRemoveBusinessStaffMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { businessId: string; membershipId: string }) =>
      marketplaceApi.removeBusinessStaff(params.businessId, params.membershipId),
    onSuccess: async (_res, vars) => {
      await queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.host.staff(vars.businessId)
      });
    }
  });
}

export function useDeleteOpeningHoursExceptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { locationId: string; exceptionId: string }) =>
      marketplaceApi.deleteOpeningHoursException(params.locationId, params.exceptionId),
    onSuccess: async (_res, vars) => {
      await queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.host.location(vars.locationId)
      });
    }
  });
}
