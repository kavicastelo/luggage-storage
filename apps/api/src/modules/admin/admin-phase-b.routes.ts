import { FastifyInstance, FastifyRequest } from "fastify";
import {
  AdminLedgerQuerySchema,
  AdminRefundListQuerySchema,
  AdminTransitionRefundRequestSchema,
  BookingListQuerySchema,
  CancelBookingRequestSchema,
  createPaginatedResponse,
  createSuccessResponse
} from "@luggage-storage/contracts";
import { AppError } from "../../common/errors/app-error.js";
import { bookingsService } from "../bookings/bookings.service.js";
import { paymentsService } from "../payments/payments.service.js";
import { custodyService } from "../custody/custody.service.js";
import { ledgerService } from "../finance/ledger.service.js";

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
}

