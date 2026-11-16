import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  AdminAuditEventQuery,
  AdminDeactivateUserRequest,
  AdminHostListQuery,
  AdminLedgerQuery,
  AdminReactivateUserRequest,
  AdminRefundListQuery,
  AdminReinstateHostBusinessRequest,
  AdminReinstateUserRequest,
  AdminSuspendHostBusinessRequest,
  AdminSuspendUserRequest,
  AdminTransitionRefundRequest,
  AdminUserQuery,
  AdminVerifyEmailRequest,
  AssignUserRoleRequest,
  BookingListQuery,
  CancelBookingRequest,
  HostVerificationQueueQuery,
  LocationModerationQueueQuery,
  ReviewHostVerificationRequest,
  ReviewLocationRequest
} from "@luggage-storage/contracts";
import { authApi } from "@/services/auth-api";
import { marketplaceApi } from "@/services/marketplace-api";
import { useAuthStore } from "@/store/useAuthStore";
import { adminQueryKeys, hostQueryKeys, useResolvedQueryClient } from "./query-keys";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isAdminResourceUuid(id: string | null | undefined): id is string {
  return Boolean(id && UUID_REGEX.test(id));
}

export function useAdminMetricsSummaryQuery(options: { enabled?: boolean } = {}) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery(
    {
      queryKey: adminQueryKeys.metricsSummary(),
      queryFn: () => marketplaceApi.getAdminMetricsSummary(),
      enabled: isAuthenticated && (options.enabled ?? true)
    },
    qc
  );
}

export function useAdminVerificationsQuery(
  params: Partial<HostVerificationQueueQuery> = {},
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery(
    {
      queryKey: adminQueryKeys.verifications(params),
      queryFn: () => marketplaceApi.getPendingVerifications(params),
      enabled: isAuthenticated && (options.enabled ?? true)
    },
    qc
  );
}

export function useAdminVerificationDetailQuery(
  verificationId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery(
    {
      queryKey: adminQueryKeys.verificationDetail(verificationId ?? ""),
      queryFn: () => marketplaceApi.getVerificationDetails(verificationId!),
      enabled:
        isAuthenticated && isAdminResourceUuid(verificationId) && (options.enabled ?? true)
    },
    qc
  );
}

export function useReviewVerificationMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: ({
        verificationId,
        data
      }: {
        verificationId: string;
        data: ReviewHostVerificationRequest;
      }) => marketplaceApi.reviewVerification(verificationId, data),
      onSuccess: (_data, variables) => {
        void qc.invalidateQueries({ queryKey: ["admin", "verifications"] });
        void qc.invalidateQueries({
          queryKey: adminQueryKeys.verificationDetail(variables.verificationId)
        });
        void qc.invalidateQueries({ queryKey: ["admin", "hosts"] });
        void qc.invalidateQueries({ queryKey: adminQueryKeys.metricsSummary() });
        void qc.invalidateQueries({ queryKey: hostQueryKeys.all });
      }
    },
    qc
  );
}

export function useAdminHostsQuery(
  params: Partial<AdminHostListQuery> = {},
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery(
    {
      queryKey: adminQueryKeys.hosts(params),
      queryFn: () => marketplaceApi.getAdminHosts(params),
      enabled: isAuthenticated && (options.enabled ?? true)
    },
    qc
  );
}

export function useAdminHostDetailQuery(
  businessId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery(
    {
      queryKey: adminQueryKeys.hostDetail(businessId ?? ""),
      queryFn: () => marketplaceApi.getAdminHostDetail(businessId!),
      enabled: isAuthenticated && isAdminResourceUuid(businessId) && (options.enabled ?? true)
    },
    qc
  );
}

export function useSuspendAdminHostMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: ({
        businessId,
        data
      }: {
        businessId: string;
        data: AdminSuspendHostBusinessRequest;
      }) => marketplaceApi.suspendAdminHost(businessId, data),
      onSuccess: (_data, variables) => {
        void qc.invalidateQueries({ queryKey: ["admin", "hosts"] });
        void qc.invalidateQueries({ queryKey: adminQueryKeys.hostDetail(variables.businessId) });
        void qc.invalidateQueries({ queryKey: adminQueryKeys.metricsSummary() });
        void qc.invalidateQueries({ queryKey: ["traveller", "discovery"] });
      }
    },
    qc
  );
}

export function useReinstateAdminHostMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: ({
        businessId,
        data
      }: {
        businessId: string;
        data?: AdminReinstateHostBusinessRequest;
      }) => marketplaceApi.reinstateAdminHost(businessId, data ?? {}),
      onSuccess: (_data, variables) => {
        void qc.invalidateQueries({ queryKey: ["admin", "hosts"] });
        void qc.invalidateQueries({ queryKey: adminQueryKeys.hostDetail(variables.businessId) });
        void qc.invalidateQueries({ queryKey: adminQueryKeys.metricsSummary() });
        void qc.invalidateQueries({ queryKey: ["traveller", "discovery"] });
      }
    },
    qc
  );
}

export function useAdminLocationModerationQuery(
  params: Partial<LocationModerationQueueQuery> = {},
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery(
    {
      queryKey: adminQueryKeys.locationModeration(params),
      queryFn: () => marketplaceApi.getPendingLocationsQueue(params),
      enabled: isAuthenticated && (options.enabled ?? true)
    },
    qc
  );
}

export function useAdminLocationDetailQuery(
  locationId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery(
    {
      queryKey: adminQueryKeys.locationDetail(locationId ?? ""),
      queryFn: () => marketplaceApi.getLocationById(locationId!),
      enabled: isAuthenticated && isAdminResourceUuid(locationId) && (options.enabled ?? true)
    },
    qc
  );
}

export function useAdminLocationPoolsQuery(
  locationId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery(
    {
      queryKey: adminQueryKeys.locationPools(locationId ?? ""),
      queryFn: () => marketplaceApi.getCapacityPools(locationId!),
      enabled: isAuthenticated && isAdminResourceUuid(locationId) && (options.enabled ?? true)
    },
    qc
  );
}

export function useAdminLocationPricingQuery(
  locationId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery(
    {
      queryKey: adminQueryKeys.locationPricing(locationId ?? ""),
      queryFn: () => marketplaceApi.getPricingPolicyOrNull(locationId!),
      enabled: isAuthenticated && isAdminResourceUuid(locationId) && (options.enabled ?? true)
    },
    qc
  );
}

export function useReviewAdminLocationMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: ({
        locationId,
        data
      }: {
        locationId: string;
        data: ReviewLocationRequest;
      }) => marketplaceApi.reviewLocation(locationId, data),
      onSuccess: (_data, variables) => {
        void qc.invalidateQueries({ queryKey: ["admin", "locations"] });
        void qc.invalidateQueries({
          queryKey: adminQueryKeys.locationDetail(variables.locationId)
        });
        void qc.invalidateQueries({ queryKey: ["admin", "hosts"] });
        void qc.invalidateQueries({ queryKey: adminQueryKeys.metricsSummary() });
        void qc.invalidateQueries({ queryKey: ["traveller", "discovery"] });
      }
    },
    qc
  );
}

export function useAdminBookingsQuery(
  params: Partial<BookingListQuery> = {},
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery(
    {
      queryKey: adminQueryKeys.bookings(params),
      queryFn: () => marketplaceApi.getAdminBookings(params),
      enabled: isAuthenticated && (options.enabled ?? true)
    },
    qc
  );
}

export function useAdminBookingDetailQuery(
  bookingId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery(
    {
      queryKey: adminQueryKeys.bookingDetail(bookingId ?? ""),
      queryFn: () => marketplaceApi.getAdminBookingDetail(bookingId!),
      enabled: isAuthenticated && isAdminResourceUuid(bookingId) && (options.enabled ?? true)
    },
    qc
  );
}

export function useAdminCustodyDetailQuery(
  bookingId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery(
    {
      queryKey: adminQueryKeys.custodyDetail(bookingId ?? ""),
      queryFn: () => marketplaceApi.getAdminCustodyDetailOrNull(bookingId!),
      enabled: isAuthenticated && isAdminResourceUuid(bookingId) && (options.enabled ?? true)
    },
    qc
  );
}

export function useAdminCancelBookingMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: ({ bookingId, data }: { bookingId: string; data: CancelBookingRequest }) =>
        marketplaceApi.adminCancelBooking(bookingId, data),
      onSuccess: (_data, variables) => {
        void qc.invalidateQueries({ queryKey: ["admin", "bookings"] });
        void qc.invalidateQueries({ queryKey: adminQueryKeys.bookingDetail(variables.bookingId) });
        void qc.invalidateQueries({ queryKey: ["admin", "refunds"] });
        void qc.invalidateQueries({ queryKey: adminQueryKeys.metricsSummary() });
      }
    },
    qc
  );
}

export function useAdminPaymentTransactionsQuery(
  params: { page?: number; limit?: number; bookingId?: string } = {},
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery(
    {
      queryKey: adminQueryKeys.payments(params),
      queryFn: () =>
        marketplaceApi.getAdminPaymentTransactions(
          params.page ?? 1,
          params.limit ?? 20,
          params.bookingId
        ),
      enabled: isAuthenticated && (options.enabled ?? true)
    },
    qc
  );
}

export function useAdminRefundsQuery(
  params: Partial<AdminRefundListQuery> = {},
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery(
    {
      queryKey: adminQueryKeys.refunds(params),
      queryFn: () => marketplaceApi.getAdminRefunds(params),
      enabled: isAuthenticated && (options.enabled ?? true)
    },
    qc
  );
}

export function useAdminTransitionRefundMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: ({
        refundId,
        data
      }: {
        refundId: string;
        data: AdminTransitionRefundRequest;
      }) => marketplaceApi.adminTransitionRefund(refundId, data),
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: ["admin", "refunds"] });
        void qc.invalidateQueries({ queryKey: ["admin", "payments"] });
        void qc.invalidateQueries({ queryKey: ["admin", "finance"] });
        void qc.invalidateQueries({ queryKey: ["admin", "bookings"] });
        void qc.invalidateQueries({ queryKey: adminQueryKeys.metricsSummary() });
      }
    },
    qc
  );
}

export function useAdminLedgerQuery(
  params: Partial<AdminLedgerQuery> = {},
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery(
    {
      queryKey: adminQueryKeys.ledger(params),
      queryFn: () => marketplaceApi.getAdminLedger(params),
      enabled: isAuthenticated && (options.enabled ?? true)
    },
    qc
  );
}

export function useAdminAuditEventsQuery(
  params: Partial<AdminAuditEventQuery> = {},
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery(
    {
      queryKey: adminQueryKeys.auditEvents(params),
      queryFn: () => authApi.listAdminAuditEventsPaginated(params),
      enabled: isAuthenticated && (options.enabled ?? true)
    },
    qc
  );
}

export function useAdminAuditEventDetailQuery(
  eventId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery(
    {
      queryKey: adminQueryKeys.auditEventDetail(eventId ?? ""),
      queryFn: () => authApi.getAdminAuditEventById(eventId!),
      enabled: isAuthenticated && isAdminResourceUuid(eventId) && (options.enabled ?? true)
    },
    qc
  );
}

export function useAdminUsersQuery(
  params: Partial<AdminUserQuery> = {},
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery(
    {
      queryKey: adminQueryKeys.users(params),
      queryFn: () => authApi.listAdminUsers(params),
      enabled: isAuthenticated && (options.enabled ?? true)
    },
    qc
  );
}

export function useAdminUserDetailQuery(
  userId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery(
    {
      queryKey: adminQueryKeys.userDetail(userId ?? ""),
      queryFn: () => authApi.getAdminUserById(userId!),
      enabled: isAuthenticated && isAdminResourceUuid(userId) && (options.enabled ?? true)
    },
    qc
  );
}

export function useAdminUserPermissionsQuery(
  userId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery(
    {
      queryKey: adminQueryKeys.userPermissions(userId ?? ""),
      queryFn: () => authApi.getAdminUserPermissions(userId!),
      enabled: isAuthenticated && isAdminResourceUuid(userId) && (options.enabled ?? true)
    },
    qc
  );
}

export function useAdminRolesQuery(options: { enabled?: boolean } = {}) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery(
    {
      queryKey: adminQueryKeys.roles(),
      queryFn: () => authApi.listAdminRoles(),
      enabled: isAuthenticated && (options.enabled ?? true)
    },
    qc
  );
}

export function useAdminPermissionsQuery(options: { enabled?: boolean } = {}) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery(
    {
      queryKey: adminQueryKeys.permissions(),
      queryFn: () => authApi.listAdminPermissions(),
      enabled: isAuthenticated && (options.enabled ?? true)
    },
    qc
  );
}

export function useSuspendAdminUserMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: ({ userId, data }: { userId: string; data: AdminSuspendUserRequest }) =>
        authApi.suspendAdminUser(userId, data),
      onSuccess: (_data, variables) => {
        void qc.invalidateQueries({ queryKey: ["admin", "users"] });
        void qc.invalidateQueries({ queryKey: adminQueryKeys.userDetail(variables.userId) });
        void qc.invalidateQueries({ queryKey: adminQueryKeys.userPermissions(variables.userId) });
        void qc.invalidateQueries({ queryKey: adminQueryKeys.metricsSummary() });
      }
    },
    qc
  );
}

export function useReinstateAdminUserMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: ({ userId, data }: { userId: string; data?: AdminReinstateUserRequest }) =>
        authApi.reinstateAdminUser(userId, data),
      onSuccess: (_data, variables) => {
        void qc.invalidateQueries({ queryKey: ["admin", "users"] });
        void qc.invalidateQueries({ queryKey: adminQueryKeys.userDetail(variables.userId) });
        void qc.invalidateQueries({ queryKey: adminQueryKeys.userPermissions(variables.userId) });
        void qc.invalidateQueries({ queryKey: adminQueryKeys.metricsSummary() });
      }
    },
    qc
  );
}

export function useDeactivateAdminUserMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: ({ userId, data }: { userId: string; data: AdminDeactivateUserRequest }) =>
        authApi.deactivateAdminUser(userId, data),
      onSuccess: (_data, variables) => {
        void qc.invalidateQueries({ queryKey: ["admin", "users"] });
        void qc.invalidateQueries({ queryKey: adminQueryKeys.userDetail(variables.userId) });
        void qc.invalidateQueries({ queryKey: adminQueryKeys.userPermissions(variables.userId) });
        void qc.invalidateQueries({ queryKey: adminQueryKeys.metricsSummary() });
      }
    },
    qc
  );
}

export function useReactivateAdminUserMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: ({ userId, data }: { userId: string; data?: AdminReactivateUserRequest }) =>
        authApi.reactivateAdminUser(userId, data),
      onSuccess: (_data, variables) => {
        void qc.invalidateQueries({ queryKey: ["admin", "users"] });
        void qc.invalidateQueries({ queryKey: adminQueryKeys.userDetail(variables.userId) });
        void qc.invalidateQueries({ queryKey: adminQueryKeys.userPermissions(variables.userId) });
        void qc.invalidateQueries({ queryKey: adminQueryKeys.metricsSummary() });
      }
    },
    qc
  );
}

export function useVerifyAdminUserEmailMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: ({ userId, data }: { userId: string; data?: AdminVerifyEmailRequest }) =>
        authApi.verifyAdminUserEmail(userId, data),
      onSuccess: (_data, variables) => {
        void qc.invalidateQueries({ queryKey: ["admin", "users"] });
        void qc.invalidateQueries({ queryKey: adminQueryKeys.userDetail(variables.userId) });
      }
    },
    qc
  );
}

export function useAssignAdminUserRoleMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: ({ userId, data }: { userId: string; data: AssignUserRoleRequest }) =>
        authApi.assignAdminUserRole(userId, data),
      onSuccess: (_data, variables) => {
        void qc.invalidateQueries({ queryKey: ["admin", "users"] });
        void qc.invalidateQueries({ queryKey: adminQueryKeys.userDetail(variables.userId) });
        void qc.invalidateQueries({ queryKey: adminQueryKeys.userPermissions(variables.userId) });
      }
    },
    qc
  );
}

export function useRevokeAdminUserRoleMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: ({ userId, roleCode }: { userId: string; roleCode: string }) =>
        authApi.revokeAdminUserRole(userId, roleCode),
      onSuccess: (_data, variables) => {
        void qc.invalidateQueries({ queryKey: ["admin", "users"] });
        void qc.invalidateQueries({ queryKey: adminQueryKeys.userDetail(variables.userId) });
        void qc.invalidateQueries({ queryKey: adminQueryKeys.userPermissions(variables.userId) });
      }
    },
    qc
  );
}
