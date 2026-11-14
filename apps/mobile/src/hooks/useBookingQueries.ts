import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BookingListQuery,
  BookingQuoteRequest,
  CancelBookingRequest,
  CreateBookingRequest,
  IssueCustodyPassRequest,
  RecordBookingExceptionRequest
} from "@luggage-storage/contracts";
import { mobileQueryKeys } from "../lib/query-keys";
import { marketplaceApi } from "../services/marketplace-api";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useMyBookingsQuery(
  params?: Partial<BookingListQuery>,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: mobileQueryKeys.bookings.list(params),
    queryFn: () => marketplaceApi.getMyBookings(params),
    enabled
  });
}

export function useBookingDetailQuery(bookingId?: string, enabled: boolean = true) {
  const isValidUuid = Boolean(bookingId && UUID_REGEX.test(bookingId));
  return useQuery({
    queryKey: mobileQueryKeys.bookings.detail(bookingId ?? "invalid"),
    queryFn: () => marketplaceApi.getBookingDetail(bookingId as string),
    enabled: enabled && isValidUuid
  });
}

export function useQuoteBookingQuery(payload: BookingQuoteRequest | null) {
  const isValid = Boolean(
    payload &&
      UUID_REGEX.test(payload.locationId) &&
      payload.items.length > 0 &&
      new Date(payload.collectionAt).getTime() > new Date(payload.dropOffAt).getTime()
  );

  return useQuery({
    queryKey: payload
      ? (["bookings", "quote", payload] as const)
      : (["bookings", "quote", "idle"] as const),
    queryFn: () => marketplaceApi.quoteBooking(payload as BookingQuoteRequest),
    enabled: isValid
  });
}

export function useCheckoutStatusQuery(bookingId?: string, enabled: boolean = true) {
  const isValidUuid = Boolean(bookingId && UUID_REGEX.test(bookingId));
  return useQuery({
    queryKey: mobileQueryKeys.bookings.checkoutStatus(bookingId ?? "invalid"),
    queryFn: () => marketplaceApi.getCheckoutStatus({ bookingId: bookingId as string }),
    enabled: enabled && isValidUuid
  });
}

export function useCreateBookingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBookingRequest) => marketplaceApi.createBooking(payload),
    onSuccess: async (created) => {
      queryClient.setQueryData(mobileQueryKeys.bookings.detail(created.id), created);
      await queryClient.invalidateQueries({ queryKey: mobileQueryKeys.bookings.all });
    }
  });
}

export function useCancelBookingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { bookingId: string; data: CancelBookingRequest }) =>
      marketplaceApi.cancelBooking(params.bookingId, params.data),
    onSuccess: async (updated) => {
      queryClient.setQueryData(mobileQueryKeys.bookings.detail(updated.id), updated);
      await queryClient.invalidateQueries({ queryKey: mobileQueryKeys.bookings.all });
    }
  });
}

export function useReportBookingExceptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { bookingId: string; data: RecordBookingExceptionRequest }) =>
      marketplaceApi.reportBookingException(params.bookingId, params.data),
    onSuccess: async (updated) => {
      queryClient.setQueryData(mobileQueryKeys.bookings.detail(updated.id), updated);
      await queryClient.invalidateQueries({ queryKey: mobileQueryKeys.bookings.all });
      await queryClient.invalidateQueries({ queryKey: mobileQueryKeys.host.all });
    }
  });
}

export function useIssueCustodyPassMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { bookingId: string; data: IssueCustodyPassRequest }) =>
      marketplaceApi.issueCustodyPass(params.bookingId, params.data),
    onSuccess: async (_pass, vars) => {
      await queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.bookings.detail(vars.bookingId)
      });
    }
  });
}
