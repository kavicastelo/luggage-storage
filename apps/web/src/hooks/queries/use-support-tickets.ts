import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  CreateSupportTicketRequest,
  CustomerSupportTicketReplyRequest
} from "@luggage-storage/contracts";
import { marketplaceApi } from "@/services/marketplace-api";
import { useAuthStore } from "@/store/useAuthStore";
import { travellerQueryKeys, useResolvedQueryClient } from "./query-keys";

export function useCreateSupportTicketMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: (data: CreateSupportTicketRequest) => marketplaceApi.createSupportTicket(data),
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: travellerQueryKeys.supportTickets() });
      }
    },
    qc
  );
}

export function useMySupportTicketsQuery(options: { enabled?: boolean } = {}) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery(
    {
      queryKey: travellerQueryKeys.supportTickets(),
      queryFn: () => marketplaceApi.getMySupportTickets(),
      enabled: isAuthenticated && (options.enabled ?? true)
    },
    qc
  );
}

export function useMySupportTicketDetailQuery(
  ticketId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const qc = useResolvedQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery(
    {
      queryKey: travellerQueryKeys.supportTicketDetail(ticketId ?? ""),
      queryFn: () => marketplaceApi.getMySupportTicketDetail(ticketId!),
      enabled: isAuthenticated && Boolean(ticketId) && (options.enabled ?? true)
    },
    qc
  );
}

export function useReplyMySupportTicketMutation() {
  const qc = useResolvedQueryClient();
  return useMutation(
    {
      mutationFn: ({
        ticketId,
        data
      }: {
        ticketId: string;
        data: CustomerSupportTicketReplyRequest;
      }) => marketplaceApi.replyMySupportTicket(ticketId, data),
      onSuccess: (_data, variables) => {
        void qc.invalidateQueries({ queryKey: travellerQueryKeys.supportTickets() });
        void qc.invalidateQueries({
          queryKey: travellerQueryKeys.supportTicketDetail(variables.ticketId)
        });
      }
    },
    qc
  );
}
