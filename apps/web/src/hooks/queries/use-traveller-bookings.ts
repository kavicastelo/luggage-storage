import { useQuery, useMutation } from "@tanstack/react-query";
import type {
  BookingListQuery,
  CancelBookingRequest,
  CheckoutStatusQuery,
  CreateBookingRequest,
  CreatePaymentIntentRequest,
  IssueCustodyPassRequest,
  RecordBookingExceptionRequest,
  SandboxSimulatePaymentRequest
} from "@luggage-storage/contracts";
import { marketplaceApi } from "@/services/marketplace-api";
import { travellerQueryKeys, useResolvedQueryClient } from "./query-keys";

export function useTravellerBookings(
  params: Partial<BookingListQuery> = {},
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  return useQuery(
    {
      queryKey: travellerQueryKeys.bookings(params),
      queryFn: () => marketplaceApi.getMyBookings(params),
      enabled: options.enabled ?? true
    },
    qc
  );
}

export function useBookingDetailQuery(
  bookingId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  return useQuery(
    {
      queryKey: travellerQueryKeys.bookingDetail(bookingId ?? ""),
      queryFn: () => marketplaceApi.getBookingDetail(bookingId!),
      enabled: Boolean(bookingId) && (options.enabled ?? true)
    },
    qc
  );
}

export function useCheckoutStatusQuery(
  query: CheckoutStatusQuery | null,
  options: { enabled?: boolean; refetchInterval?: number | false } = {}
) {
  const qc = useResolvedQueryClient();
  return useQuery(
    {
      queryKey: travellerQueryKeys.checkoutStatus(query ?? {}),
      queryFn: () => marketplaceApi.getCheckoutStatus(query!),
      enabled: Boolean(query?.bookingId || query?.orderId) && (options.enabled ?? true),
      refetchInterval: options.refetchInterval ?? false
    },
    qc
  );
}

export function useCreateBookingMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (payload: CreateBookingRequest) => marketplaceApi.createBooking(payload),
      onSuccess: (booking) => {
        qc.setQueryData(travellerQueryKeys.bookingDetail(booking.id), booking);
        qc.invalidateQueries({ queryKey: ["traveller", "bookings", "list"] });
      }
    },
    qc
  );
}

export function useCreatePaymentIntentMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (payload: CreatePaymentIntentRequest) => marketplaceApi.createPaymentIntent(payload)
    },
    qc
  );
}

export function useSimulatePaymentMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (args: { intentId: string; data?: SandboxSimulatePaymentRequest }) =>
        marketplaceApi.simulateSandboxPayment(args.intentId, args.data),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["traveller", "bookings"] });
        qc.invalidateQueries({ queryKey: ["traveller", "payments", "checkout-status"] });
      }
    },
    qc
  );
}

export function useIssueCustodyPassMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (args: { bookingId: string; operation: IssueCustodyPassRequest["operation"] }) =>
        marketplaceApi.issueCustodyPass(args.bookingId, { operation: args.operation })
    },
    qc
  );
}

export function useCancelBookingMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (args: { bookingId: string; data: CancelBookingRequest }) =>
        marketplaceApi.cancelBooking(args.bookingId, args.data),
      onSuccess: (booking) => {
        qc.setQueryData(travellerQueryKeys.bookingDetail(booking.id), booking);
        qc.invalidateQueries({ queryKey: ["traveller", "bookings", "list"] });
      }
    },
    qc
  );
}

export function useReportBookingExceptionMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (args: { bookingId: string; data: RecordBookingExceptionRequest }) =>
        marketplaceApi.reportBookingException(args.bookingId, args.data),
      onSuccess: (booking) => {
        qc.setQueryData(travellerQueryKeys.bookingDetail(booking.id), booking);
        qc.invalidateQueries({ queryKey: ["traveller", "bookings", "list"] });
      }
    },
    qc
  );
}
