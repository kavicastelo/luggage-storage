import { useQuery, useMutation } from "@tanstack/react-query";
import type {
  AddHostStaffRequest,
  BookingListQuery,
  CancelBookingRequest,
  ConfigurePricingPolicyRequest,
  CreateCapacityPoolRequest,
  CreateHostBusinessRequest,
  CreateLocationRequest,
  CreateOpeningHoursExceptionRequest,
  CreateStorageZoneRequest,
  HostDecisionBookingRequest,
  HostRejectBookingRequest,
  OpeningHourItemInput,
  RecordBookingExceptionRequest,
  SubmitHostVerificationRequest,
  UpdateCapacityPoolRequest,
  UpdateHostBusinessRequest,
  UpdateHostStaffRequest,
  UpdateLocationMediaRequest,
  UpdateLocationRequest,
  UpdateStorageZoneRequest
} from "@luggage-storage/contracts";
import { marketplaceApi } from "@/services/marketplace-api";
import { useAuthStore } from "@/store/useAuthStore";
import { hostQueryKeys, useResolvedQueryClient } from "./query-keys";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isHostResourceUuid(id: string | null | undefined): id is string {
  return Boolean(id && UUID_REGEX.test(id));
}

export function useOwnedBusinessesQuery(options: { enabled?: boolean } = {}) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery(
    {
      queryKey: hostQueryKeys.businesses(),
      queryFn: () => marketplaceApi.getOwnedBusinesses(),
      enabled: isAuthenticated && (options.enabled ?? true)
    },
    qc
  );
}

export function useHostVerificationQuery(
  businessId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery(
    {
      queryKey: hostQueryKeys.verification(businessId ?? ""),
      queryFn: () => marketplaceApi.getVerification(businessId!),
      enabled: isAuthenticated && isHostResourceUuid(businessId) && (options.enabled ?? true)
    },
    qc
  );
}

export function useHostPayoutDetailsQuery(
  businessId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery(
    {
      queryKey: hostQueryKeys.payoutDetails(businessId ?? ""),
      queryFn: () => marketplaceApi.getPayoutDetails(businessId!),
      enabled: isAuthenticated && isHostResourceUuid(businessId) && (options.enabled ?? true)
    },
    qc
  );
}

export function useHostStaffQuery(
  businessId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery(
    {
      queryKey: hostQueryKeys.staff(businessId ?? ""),
      queryFn: () => marketplaceApi.getBusinessStaff(businessId!),
      enabled: isAuthenticated && isHostResourceUuid(businessId) && (options.enabled ?? true)
    },
    qc
  );
}

export function useHostLocationsQuery(options: { enabled?: boolean } = {}) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery(
    {
      queryKey: hostQueryKeys.locations(),
      queryFn: () => marketplaceApi.getOwnedLocations(),
      enabled: isAuthenticated && (options.enabled ?? true)
    },
    qc
  );
}

export function useHostLocationDetailQuery(
  locationId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery(
    {
      queryKey: hostQueryKeys.locationDetail(locationId ?? ""),
      queryFn: () => marketplaceApi.getLocationById(locationId!),
      enabled: isAuthenticated && isHostResourceUuid(locationId) && (options.enabled ?? true)
    },
    qc
  );
}

export function useOpeningHoursQuery(
  locationId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery(
    {
      queryKey: hostQueryKeys.openingHours(locationId ?? ""),
      queryFn: () => marketplaceApi.getOpeningHours(locationId!),
      enabled: isAuthenticated && isHostResourceUuid(locationId) && (options.enabled ?? true)
    },
    qc
  );
}

export function useOpeningHoursExceptionsQuery(
  locationId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery(
    {
      queryKey: hostQueryKeys.exceptions(locationId ?? ""),
      queryFn: () => marketplaceApi.getOpeningHoursExceptions(locationId!),
      enabled: isAuthenticated && isHostResourceUuid(locationId) && (options.enabled ?? true)
    },
    qc
  );
}

export function useStorageZonesQuery(
  locationId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery(
    {
      queryKey: hostQueryKeys.zones(locationId ?? ""),
      queryFn: () => marketplaceApi.getStorageZones(locationId!),
      enabled: isAuthenticated && isHostResourceUuid(locationId) && (options.enabled ?? true)
    },
    qc
  );
}

export function useLocationMediaQuery(
  locationId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery(
    {
      queryKey: hostQueryKeys.media(locationId ?? ""),
      queryFn: () => marketplaceApi.getLocationMedia(locationId!),
      enabled: isAuthenticated && isHostResourceUuid(locationId) && (options.enabled ?? true)
    },
    qc
  );
}

export function useCapacityPoolsQuery(
  locationId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery(
    {
      queryKey: hostQueryKeys.capacityPools(locationId ?? ""),
      queryFn: () => marketplaceApi.getCapacityPools(locationId!),
      enabled: isAuthenticated && isHostResourceUuid(locationId) && (options.enabled ?? true)
    },
    qc
  );
}

export function usePricingPolicyQuery(
  locationId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery(
    {
      queryKey: hostQueryKeys.pricingPolicy(locationId ?? ""),
      queryFn: () => marketplaceApi.getPricingPolicyOrNull(locationId!),
      enabled: isAuthenticated && isHostResourceUuid(locationId) && (options.enabled ?? true)
    },
    qc
  );
}

export function useHostBookingsQuery(
  params: Partial<BookingListQuery> = {},
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery(
    {
      queryKey: hostQueryKeys.bookings(params),
      queryFn: () => marketplaceApi.getHostBookings(params),
      enabled: isAuthenticated && (options.enabled ?? true)
    },
    qc
  );
}

export function useHostBookingDetailQuery(
  bookingId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery(
    {
      queryKey: hostQueryKeys.bookingDetail(bookingId ?? ""),
      queryFn: () => marketplaceApi.getHostBookingDetail(bookingId!),
      enabled: isAuthenticated && isHostResourceUuid(bookingId) && (options.enabled ?? true)
    },
    qc
  );
}

export function useHostCustodyDetailQuery(
  bookingId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery(
    {
      queryKey: hostQueryKeys.custodyDetail(bookingId ?? ""),
      queryFn: () => marketplaceApi.getCustodyDetailOrNull(bookingId!),
      enabled: isAuthenticated && isHostResourceUuid(bookingId) && (options.enabled ?? true)
    },
    qc
  );
}

export function useHostFinanceSummaryQuery(
  businessId?: string,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const normalizedBusinessId = isHostResourceUuid(businessId) ? businessId : undefined;
  return useQuery(
    {
      queryKey: hostQueryKeys.financeSummary(normalizedBusinessId),
      queryFn: () => marketplaceApi.getHostFinanceSummary(normalizedBusinessId),
      enabled: isAuthenticated && (options.enabled ?? true)
    },
    qc
  );
}

// ============================================================================
// Mutations
// ============================================================================

export function useCreateBusinessMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (data: CreateHostBusinessRequest) => marketplaceApi.createBusiness(data),
      onSuccess: async () => {
        await useAuthStore.getState().refreshSessionAndUser();
        qc.invalidateQueries({ queryKey: hostQueryKeys.businesses() });
      }
    },
    qc
  );
}

export function useUpdateBusinessMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (args: { businessId: string; data: UpdateHostBusinessRequest }) =>
        marketplaceApi.updateBusiness(args.businessId, args.data),
      onSuccess: (_, args) => {
        qc.invalidateQueries({ queryKey: hostQueryKeys.businesses() });
        qc.invalidateQueries({ queryKey: hostQueryKeys.businessDetail(args.businessId) });
        qc.invalidateQueries({ queryKey: hostQueryKeys.payoutDetails(args.businessId) });
      }
    },
    qc
  );
}

export function useSubmitVerificationMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (args: { businessId: string; data: SubmitHostVerificationRequest }) =>
        marketplaceApi.submitVerification(args.businessId, args.data),
      onSuccess: (_, args) => {
        qc.invalidateQueries({ queryKey: hostQueryKeys.businesses() });
        qc.invalidateQueries({ queryKey: hostQueryKeys.verification(args.businessId) });
      }
    },
    qc
  );
}

export function useAddHostStaffMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (args: { businessId: string; data: AddHostStaffRequest }) =>
        marketplaceApi.addBusinessStaff(args.businessId, args.data),
      onSuccess: (_, args) => {
        qc.invalidateQueries({ queryKey: hostQueryKeys.staff(args.businessId) });
      }
    },
    qc
  );
}

export function useUpdateHostStaffMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (args: {
        businessId: string;
        membershipId: string;
        data: UpdateHostStaffRequest;
      }) => marketplaceApi.updateBusinessStaff(args.businessId, args.membershipId, args.data),
      onSuccess: (_, args) => {
        qc.invalidateQueries({ queryKey: hostQueryKeys.staff(args.businessId) });
      }
    },
    qc
  );
}

export function useRemoveHostStaffMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (args: { businessId: string; membershipId: string }) =>
        marketplaceApi.removeBusinessStaff(args.businessId, args.membershipId),
      onSuccess: (_, args) => {
        qc.invalidateQueries({ queryKey: hostQueryKeys.staff(args.businessId) });
      }
    },
    qc
  );
}

export function useCreateLocationMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (data: CreateLocationRequest) => marketplaceApi.createLocation(data),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: hostQueryKeys.locations() });
      }
    },
    qc
  );
}

export function useUpdateLocationMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (args: { locationId: string; data: UpdateLocationRequest }) =>
        marketplaceApi.updateLocation(args.locationId, args.data),
      onSuccess: (_, args) => {
        qc.invalidateQueries({ queryKey: hostQueryKeys.locations() });
        qc.invalidateQueries({ queryKey: hostQueryKeys.locationDetail(args.locationId) });
      }
    },
    qc
  );
}

export function useSubmitLocationForReviewMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (locationId: string) => marketplaceApi.submitLocationForReview(locationId),
      onSuccess: (_, locationId) => {
        qc.invalidateQueries({ queryKey: hostQueryKeys.locations() });
        qc.invalidateQueries({ queryKey: hostQueryKeys.locationDetail(locationId) });
      }
    },
    qc
  );
}

export function useDisableLocationMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (locationId: string) => marketplaceApi.disableLocation(locationId),
      onSuccess: (_, locationId) => {
        qc.invalidateQueries({ queryKey: hostQueryKeys.locations() });
        qc.invalidateQueries({ queryKey: hostQueryKeys.locationDetail(locationId) });
      }
    },
    qc
  );
}

export function useSetOpeningHoursMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (args: { locationId: string; schedules: OpeningHourItemInput[] }) =>
        marketplaceApi.setOpeningHours(args.locationId, args.schedules),
      onSuccess: (_, args) => {
        qc.invalidateQueries({ queryKey: hostQueryKeys.openingHours(args.locationId) });
      }
    },
    qc
  );
}

export function useAddOpeningHoursExceptionMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (args: { locationId: string; data: CreateOpeningHoursExceptionRequest }) =>
        marketplaceApi.addOpeningHoursException(args.locationId, args.data),
      onSuccess: (_, args) => {
        qc.invalidateQueries({ queryKey: hostQueryKeys.exceptions(args.locationId) });
      }
    },
    qc
  );
}

export function useDeleteOpeningHoursExceptionMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (args: { locationId: string; exceptionId: string }) =>
        marketplaceApi.deleteOpeningHoursException(args.locationId, args.exceptionId),
      onSuccess: (_, args) => {
        qc.invalidateQueries({ queryKey: hostQueryKeys.exceptions(args.locationId) });
      }
    },
    qc
  );
}

export function useCreateStorageZoneMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (args: { locationId: string; data: CreateStorageZoneRequest }) =>
        marketplaceApi.createStorageZone(args.locationId, args.data),
      onSuccess: (_, args) => {
        qc.invalidateQueries({ queryKey: hostQueryKeys.zones(args.locationId) });
      }
    },
    qc
  );
}

export function useUpdateStorageZoneMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (args: { locationId: string; zoneId: string; data: UpdateStorageZoneRequest }) =>
        marketplaceApi.updateStorageZone(args.locationId, args.zoneId, args.data),
      onSuccess: (_, args) => {
        qc.invalidateQueries({ queryKey: hostQueryKeys.zones(args.locationId) });
      }
    },
    qc
  );
}

export function useDeleteStorageZoneMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (args: { locationId: string; zoneId: string }) =>
        marketplaceApi.deleteStorageZone(args.locationId, args.zoneId),
      onSuccess: (_, args) => {
        qc.invalidateQueries({ queryKey: hostQueryKeys.zones(args.locationId) });
        qc.invalidateQueries({ queryKey: hostQueryKeys.capacityPools(args.locationId) });
      }
    },
    qc
  );
}

export function useUpdateLocationMediaMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (args: { locationId: string; mediaId: string; data: UpdateLocationMediaRequest }) =>
        marketplaceApi.updateLocationMedia(args.locationId, args.mediaId, args.data),
      onSuccess: (_, args) => {
        qc.invalidateQueries({ queryKey: hostQueryKeys.media(args.locationId) });
        qc.invalidateQueries({ queryKey: hostQueryKeys.locationDetail(args.locationId) });
      }
    },
    qc
  );
}

export function useDeleteLocationMediaMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (args: { locationId: string; mediaId: string }) =>
        marketplaceApi.deleteLocationMedia(args.locationId, args.mediaId),
      onSuccess: (_, args) => {
        qc.invalidateQueries({ queryKey: hostQueryKeys.media(args.locationId) });
        qc.invalidateQueries({ queryKey: hostQueryKeys.locationDetail(args.locationId) });
      }
    },
    qc
  );
}

export function useCreateCapacityPoolMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (args: { locationId: string; data: CreateCapacityPoolRequest }) =>
        marketplaceApi.createCapacityPool(args.locationId, args.data),
      onSuccess: (_, args) => {
        qc.invalidateQueries({ queryKey: hostQueryKeys.capacityPools(args.locationId) });
      }
    },
    qc
  );
}

export function useUpdateCapacityPoolMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (args: { locationId: string; poolId: string; data: UpdateCapacityPoolRequest }) =>
        marketplaceApi.updateCapacityPool(args.poolId, args.data),
      onSuccess: (_, args) => {
        qc.invalidateQueries({ queryKey: hostQueryKeys.capacityPools(args.locationId) });
      }
    },
    qc
  );
}

export function useDeleteCapacityPoolMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (args: { locationId: string; poolId: string }) =>
        marketplaceApi.deleteCapacityPool(args.poolId),
      onSuccess: (_, args) => {
        qc.invalidateQueries({ queryKey: hostQueryKeys.capacityPools(args.locationId) });
      }
    },
    qc
  );
}

export function useConfigurePricingPolicyMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (args: { locationId: string; data: ConfigurePricingPolicyRequest }) =>
        marketplaceApi.configurePricingPolicy(args.locationId, args.data),
      onSuccess: (_, args) => {
        qc.invalidateQueries({ queryKey: hostQueryKeys.pricingPolicy(args.locationId) });
      }
    },
    qc
  );
}

function invalidateHostOperationalQueries(qc: ReturnType<typeof useResolvedQueryClient>, bookingId?: string) {
  qc.invalidateQueries({ queryKey: ["host", "bookings"] });
  qc.invalidateQueries({ queryKey: ["host", "custody"] });
  qc.invalidateQueries({ queryKey: ["host", "finance"] });
  if (bookingId) {
    qc.invalidateQueries({ queryKey: hostQueryKeys.bookingDetail(bookingId) });
    qc.invalidateQueries({ queryKey: hostQueryKeys.custodyDetail(bookingId) });
  }
}

export function useAcceptHostBookingMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (args: { bookingId: string; data?: HostDecisionBookingRequest }) =>
        marketplaceApi.acceptHostBooking(args.bookingId, args.data),
      onSuccess: (_, args) => {
        invalidateHostOperationalQueries(qc, args.bookingId);
      }
    },
    qc
  );
}

export function useRejectHostBookingMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (args: { bookingId: string; data: HostRejectBookingRequest }) =>
        marketplaceApi.rejectHostBooking(args.bookingId, args.data),
      onSuccess: (_, args) => {
        invalidateHostOperationalQueries(qc, args.bookingId);
      }
    },
    qc
  );
}

export function useCancelHostBookingMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (args: { bookingId: string; data: CancelBookingRequest }) =>
        marketplaceApi.cancelHostBooking(args.bookingId, args.data),
      onSuccess: (_, args) => {
        invalidateHostOperationalQueries(qc, args.bookingId);
      }
    },
    qc
  );
}

export function useReportHostBookingExceptionMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (args: { bookingId: string; data: RecordBookingExceptionRequest }) =>
        marketplaceApi.reportBookingException(args.bookingId, args.data),
      onSuccess: (_, args) => {
        invalidateHostOperationalQueries(qc, args.bookingId);
      }
    },
    qc
  );
}
