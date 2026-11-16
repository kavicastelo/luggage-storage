import { FastifyInstance, FastifyRequest } from "fastify";
import {
  AdminHostListQuerySchema,
  AdminLedgerQuerySchema,
  AdminPayoutBatchQuerySchema,
  AdminRefundListQuerySchema,
  AdminReinstateHostBusinessRequestSchema,
  AdminSuspendHostBusinessRequestSchema,
  AdminTransitionRefundRequestSchema,
  BookingListQuerySchema,
  CancelBookingRequestSchema,
  CreatePayoutBatchRequestSchema,
  DisbursePayoutBatchRequestSchema,
  ResolveBookingDisputeRequestSchema,
  SYSTEM_PERMISSIONS,
  createPaginatedResponse,
  createSuccessResponse
} from "@luggage-storage/contracts";
import { AppError } from "../../common/errors/app-error.js";
import { bookingsService } from "../bookings/bookings.service.js";
import { paymentsService } from "../payments/payments.service.js";
import { custodyService } from "../custody/custody.service.js";
import { ledgerService } from "../finance/ledger.service.js";
import { payoutsService } from "../finance/payouts.service.js";
import { hostsService } from "../hosts/hosts.service.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateUuid(value: string, label = "ID"): string {
  if (!UUID_REGEX.test(value)) {
    throw AppError.badRequest(`Invalid ${label} format: must be a valid UUID`);
  }
  return value;
}

function getClientInfo(request: FastifyRequest) {
  return {
    ip: request.ip,
    userAgent: request.headers["user-agent"] as string | undefined,
    correlationId: (request.headers["x-correlation-id"] as string) || request.id
  };
}

/**
 * Superadmin & Support Phase B operational governance routes mounted at /admin (and /api/v1/admin).
 * Per OQ-011: SUPPORT receives read-only visibility; SUPERADMIN holds refund & platform-cancellation authority.
 */
export async function adminPhaseBRoutes(app: FastifyInstance): Promise<void> {
  // 1. Global Bookings Ledger (SUPERADMIN & SUPPORT read)
  app.get(
    "/bookings",
    {
      preHandler: [app.authenticate, app.requirePermission("admin.booking.read")],
      schema: {
        tags: ["Admin Phase B"],
        summary: "List global marketplace bookings with status, location, and reference filters",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request) => {
      const query = BookingListQuerySchema.parse(request.query);
      const { bookings, total, page, limit } = await bookingsService.listAdminBookings(
        request.user.sub,
        request.user.roles,
        query
      );
      return createPaginatedResponse(bookings, page, limit, total, request.id);
    }
  );

  // 2. Inspect single booking detail & status history
  app.get<{ Params: { bookingId: string } }>(
    "/bookings/:bookingId",
    {
      preHandler: [app.authenticate, app.requirePermission("admin.booking.read")],
      schema: {
        tags: ["Admin Phase B"],
        summary: "Inspect global booking detail, pricing snapshot, payment, refund, and state history",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const bookingId = validateUuid(request.params.bookingId, "booking ID");
      const booking = await bookingsService.getBookingDetail(
        bookingId,
        request.user.sub,
        request.user.roles
      );
      return reply.status(200).send(createSuccessResponse(booking, request.id));
    }
  );

  // 3. Platform-authorized booking cancellation (SUPERADMIN only)
  app.post<{ Params: { bookingId: string } }>(
    "/bookings/:bookingId/cancel",
    {
      preHandler: [app.authenticate, app.requirePermission("admin.booking.manage")],
      schema: {
        tags: ["Admin Phase B"],
        summary: "Cancel a booking under platform authority and authorize 100% traveller refund",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const bookingId = validateUuid(request.params.bookingId, "booking ID");
      const body = CancelBookingRequestSchema.parse(request.body);
      const booking = await bookingsService.cancelBooking(
        bookingId,
        request.user.sub,
        request.user.roles,
        "PLATFORM",
        body,
        getClientInfo(request)
      );
      return reply.status(200).send(createSuccessResponse(booking, request.id));
    }
  );

  // 4. Inspect chain-of-custody record & bag tags for a booking
  app.get<{ Params: { bookingId: string } }>(
    "/bookings/:bookingId/custody",
    {
      preHandler: [app.authenticate, app.requirePermission("admin.booking.read")],
      schema: {
        tags: ["Admin Phase B"],
        summary: "Inspect custody record, tagged bags, and chain-of-custody event history",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const bookingId = validateUuid(request.params.bookingId, "booking ID");
      const custody = await custodyService.getCustodyDetail(
        bookingId,
        request.user.sub,
        request.user.roles
      );
      return reply.status(200).send(createSuccessResponse(custody, request.id));
    }
  );

  // 5. Global Payment Transactions Log (SUPERADMIN & SUPPORT read)
  app.get<{ Querystring: { page?: string; limit?: string; bookingId?: string } }>(
    "/payments/transactions",
    {
      preHandler: [app.authenticate, app.requirePermission("admin.payment.read")],
      schema: {
        tags: ["Admin Phase B"],
        summary: "List gateway payment capture and refund transaction records",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request) => {
      const page = Math.max(1, Number(request.query.page || 1));
      const limit = Math.min(100, Math.max(1, Number(request.query.limit || 20)));
      if (request.query.bookingId) {
        validateUuid(request.query.bookingId, "booking ID");
      }
      const { transactions, total } = await paymentsService.listAdminPaymentTransactions(
        page,
        limit,
        request.query.bookingId
      );
      return createPaginatedResponse(transactions, page, limit, total, request.id);
    }
  );

  // 6. Global Refund Management Queue (SUPERADMIN & SUPPORT read)
  app.get(
    "/refunds",
    {
      preHandler: [app.authenticate, app.requirePermission("admin.refund.read")],
      schema: {
        tags: ["Admin Phase B"],
        summary: "List refund lifecycle records across the 7-stage refund queue",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request) => {
      const query = AdminRefundListQuerySchema.parse(request.query);
      const { refunds, total, page, limit } = await paymentsService.listAdminRefunds(query);
      return createPaginatedResponse(refunds, page, limit, total, request.id);
    }
  );

  // 7. Transition Refund Lifecycle Stage (SUPERADMIN only per OQ-011 & OQ-013)
  app.post<{ Params: { refundId: string } }>(
    "/refunds/:refundId/transition",
    {
      preHandler: [app.authenticate, app.requirePermission("admin.refund.manage")],
      schema: {
        tags: ["Admin Phase B"],
        summary: "Transition a refund record across the 7-stage refund state machine (SUPERADMIN only)",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const refundId = validateUuid(request.params.refundId, "refund ID");
      const body = AdminTransitionRefundRequestSchema.parse(request.body);
      const updated = await paymentsService.adminTransitionRefund(
        refundId,
        request.user.sub,
        body,
        getClientInfo(request)
      );
      return reply.status(200).send(createSuccessResponse(updated, request.id));
    }
  );

  // 8. Double-Entry Financial Ledger Inspection (SUPERADMIN only)
  app.get(
    "/finance/ledger",
    {
      preHandler: [app.authenticate, app.requirePermission("admin.financial.manage")],
      schema: {
        tags: ["Admin Phase B"],
        summary: "Inspect append-only double-entry financial ledger and debit/credit balance proof",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const query = AdminLedgerQuerySchema.parse(request.query);
      const ledger = await ledgerService.listAdminLedger(query);
      return reply.status(200).send(createSuccessResponse(ledger, request.id));
    }
  );

  // 9. Role-Scoped Platform Governance Metrics Summary (AD-001)
  app.get(
    "/metrics/summary",
    {
      preHandler: [
        app.authenticate,
        app.requireAnyPermission([
          SYSTEM_PERMISSIONS.ADMIN_BOOKING_READ,
          SYSTEM_PERMISSIONS.ADMIN_FINANCIAL_MANAGE
        ])
      ],
      schema: {
        tags: ["Admin Governance"],
        summary: "Retrieve live operational metrics and role-scoped platform financial summary",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const metrics = await ledgerService.getAdminMetricsSummary(request.user.sub);
      return reply.status(200).send(createSuccessResponse(metrics, request.id));
    }
  );

  // 10. Global Host Businesses Directory (AD-003, SUPERADMIN & SUPPORT read)
  app.get(
    "/hosts",
    {
      preHandler: [app.authenticate, app.requirePermission(SYSTEM_PERMISSIONS.ADMIN_HOST_READ)],
      schema: {
        tags: ["Admin Governance"],
        summary: "List platform host businesses with search and status filtering",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request) => {
      const query = AdminHostListQuerySchema.parse(request.query ?? {});
      const { items, total, page, limit } = await hostsService.listAdminHostBusinesses(query);
      return createPaginatedResponse(items, page, limit, total, request.id);
    }
  );

  // 11. Inspect single Host Business Detail for Admin/Support Directory (AD-003)
  app.get<{ Params: { businessId: string } }>(
    "/hosts/:businessId",
    {
      preHandler: [app.authenticate, app.requirePermission(SYSTEM_PERMISSIONS.ADMIN_HOST_READ)],
      schema: {
        tags: ["Admin Governance"],
        summary: "Inspect host business details, latest KYC verification, and storage locations",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const businessId = validateUuid(request.params.businessId, "business ID");
      const detail = await hostsService.getAdminHostBusinessDetail(businessId);
      return reply.status(200).send(createSuccessResponse(detail, request.id));
    }
  );

  // 12. Suspend Host Business (SUPERADMIN only — admin.host.verify)
  app.post<{ Params: { businessId: string } }>(
    "/hosts/:businessId/suspend",
    {
      preHandler: [app.authenticate, app.requirePermission(SYSTEM_PERMISSIONS.ADMIN_HOST_VERIFY)],
      schema: {
        tags: ["Admin Governance"],
        summary: "Suspend a host business and hide its locations from public discovery and quotes",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const businessId = validateUuid(request.params.businessId, "business ID");
      const body = AdminSuspendHostBusinessRequestSchema.parse(request.body);
      const updated = await hostsService.adminSuspendBusiness(businessId, body.reason, {
        userId: request.user.sub,
        roles: request.user.roles,
        clientInfo: getClientInfo(request)
      });
      return reply.status(200).send(createSuccessResponse(updated, request.id));
    }
  );

  // 13. Reinstate Suspended Host Business (SUPERADMIN only — admin.host.verify)
  app.post<{ Params: { businessId: string } }>(
    "/hosts/:businessId/reinstate",
    {
      preHandler: [app.authenticate, app.requirePermission(SYSTEM_PERMISSIONS.ADMIN_HOST_VERIFY)],
      schema: {
        tags: ["Admin Governance"],
        summary: "Reinstate a suspended host business according to its KYC verification state",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const businessId = validateUuid(request.params.businessId, "business ID");
      const body = AdminReinstateHostBusinessRequestSchema.parse(request.body ?? {});
      const updated = await hostsService.adminReinstateBusiness(businessId, body.reason, {
        userId: request.user.sub,
        roles: request.user.roles,
        clientInfo: getClientInfo(request)
      });
      return reply.status(200).send(createSuccessResponse(updated, request.id));
    }
  );

  // 14. Dispute Adjudication (SUPERADMIN only — admin.booking.manage)
  app.post<{ Params: { bookingId: string } }>(
    "/bookings/:bookingId/resolve-dispute",
    {
      preHandler: [app.authenticate, app.requirePermission(SYSTEM_PERMISSIONS.ADMIN_BOOKING_MANAGE)],
      schema: {
        tags: ["Admin Phase B"],
        summary: "Adjudicate a DISPUTED booking by upholding host settlement or refunding traveller",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const bookingId = validateUuid(request.params.bookingId, "booking ID");
      const body = ResolveBookingDisputeRequestSchema.parse(request.body);
      const updated = await bookingsService.resolveDispute(
        bookingId,
        request.user.sub,
        request.user.roles,
        body,
        getClientInfo(request)
      );
      return reply.status(200).send(createSuccessResponse(updated, request.id));
    }
  );

  // 15. List Eligible Unbatched Host Payables Grouped by Business (SUPERADMIN only)
  app.get<{ Querystring: { businessId?: string } }>(
    "/payouts/eligible-payables",
    {
      preHandler: [app.authenticate, app.requirePermission(SYSTEM_PERMISSIONS.ADMIN_FINANCIAL_MANAGE)],
      schema: {
        tags: ["Admin Payouts"],
        summary: "Group unbatched ELIGIBLE host payables by host business for payout batch generation",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      if (request.query.businessId) {
        validateUuid(request.query.businessId, "business ID");
      }
      const groups = await payoutsService.getEligiblePayablesGrouped(request.query.businessId);
      return reply.status(200).send(createSuccessResponse({ groups }, request.id));
    }
  );

  // 16. List Host Payout Batches (SUPERADMIN only)
  app.get(
    "/payouts/batches",
    {
      preHandler: [app.authenticate, app.requirePermission(SYSTEM_PERMISSIONS.ADMIN_FINANCIAL_MANAGE)],
      schema: {
        tags: ["Admin Payouts"],
        summary: "List generated and disbursed host payout batches",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request) => {
      const query = AdminPayoutBatchQuerySchema.parse(request.query ?? {});
      const { batches, total, pagination } = await payoutsService.listAdminPayoutBatches(query);
      return createPaginatedResponse(
        batches,
        pagination.page,
        pagination.limit,
        total,
        request.id
      );
    }
  );

  // 17. Generate a Host Payout Batch (SUPERADMIN only)
  app.post(
    "/payouts/batches",
    {
      preHandler: [app.authenticate, app.requirePermission(SYSTEM_PERMISSIONS.ADMIN_FINANCIAL_MANAGE)],
      schema: {
        tags: ["Admin Payouts"],
        summary: "Lock unbatched ELIGIBLE host payables into a GENERATED payout batch",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const body = CreatePayoutBatchRequestSchema.parse(request.body);
      const batch = await payoutsService.createPayoutBatch(
        request.user.sub,
        body,
        getClientInfo(request)
      );
      return reply.status(201).send(createSuccessResponse(batch, request.id));
    }
  );

  // 18. Get Single Payout Batch Detail with Itemized Payables (SUPERADMIN only)
  app.get<{ Params: { batchId: string } }>(
    "/payouts/batches/:batchId",
    {
      preHandler: [app.authenticate, app.requirePermission(SYSTEM_PERMISSIONS.ADMIN_FINANCIAL_MANAGE)],
      schema: {
        tags: ["Admin Payouts"],
        summary: "Inspect payout batch details and included booking payables",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const batchId = validateUuid(request.params.batchId, "batch ID");
      const batch = await payoutsService.getAdminPayoutBatchDetail(batchId);
      return reply.status(200).send(createSuccessResponse(batch, request.id));
    }
  );

  // 19. Record Manual Wire / CEFT Reference & Disburse Payout Batch (SUPERADMIN only)
  app.post<{ Params: { batchId: string } }>(
    "/payouts/batches/:batchId/disburse",
    {
      preHandler: [app.authenticate, app.requirePermission(SYSTEM_PERMISSIONS.ADMIN_FINANCIAL_MANAGE)],
      schema: {
        tags: ["Admin Payouts"],
        summary: "Mark payout batch DISBURSED with bank wire reference and post double-entry ledger entries",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const batchId = validateUuid(request.params.batchId, "batch ID");
      const body = DisbursePayoutBatchRequestSchema.parse(request.body);
      const batch = await payoutsService.disbursePayoutBatch(
        batchId,
        request.user.sub,
        body,
        getClientInfo(request)
      );
      return reply.status(200).send(createSuccessResponse(batch, request.id));
    }
  );
}

