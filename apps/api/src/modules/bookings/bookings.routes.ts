import { FastifyInstance, FastifyRequest } from "fastify";
import {
  AvailabilitySearchQuerySchema,
  BookingListQuerySchema,
  BookingQuoteRequestSchema,
  CancelBookingRequestSchema,
  CreateBookingRequestSchema,
  HostDecisionBookingRequestSchema,
  HostRejectBookingRequestSchema,
  IssueCustodyPassRequestSchema,
  RecordBookingExceptionRequestSchema,
  createPaginatedResponse,
  createSuccessResponse
} from "@luggage-storage/contracts";
import { AppError } from "../../common/errors/app-error.js";
import { quotationService } from "./quotation-availability.service.js";
import { bookingsService } from "./bookings.service.js";
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
 * Public availability search routes mounted at /availability (and /api/v1/availability).
 */
export async function availabilityRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/search",
    {
      schema: {
        tags: ["Availability & Bookings"],
        summary: "Search storage availability and integer pricing quotes for a schedule and bag selection"
      }
    },
    async (request, reply) => {
      const query = AvailabilitySearchQuerySchema.parse(request.query);
      const result = await quotationService.searchAvailability(query);
      return reply.status(200).send(createSuccessResponse(result, request.id));
    }
  );
}

/**
 * Traveller booking & quotation routes mounted at /bookings (and /api/v1/bookings).
 */
export async function bookingRoutes(app: FastifyInstance): Promise<void> {
  // 1. Public server-side quotation & availability check
  app.post(
    "/quote",
    {
      schema: {
        tags: ["Availability & Bookings"],
        summary: "Compute authoritative server-side quotation and pool availability for a storage location"
      }
    },
    async (request, reply) => {
      const body = BookingQuoteRequestSchema.parse(request.body);
      const fullQuote = await quotationService.calculateQuote(body);
      const { businessId: _b, policyId: _p, allocations: _a, ...publicQuote } = fullQuote;
      return reply.status(200).send(createSuccessResponse(publicQuote, request.id));
    }
  );

  // 2. Create capacity-locked booking hold + immutable pricing snapshot
  app.post(
    "/",
    {
      preHandler: [app.authenticate, app.requirePermission("bookings.create")],
      schema: {
        tags: ["Availability & Bookings"],
        summary: "Create a capacity-locked booking hold and immutable pricing snapshot",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const body = CreateBookingRequestSchema.parse(request.body);
      const booking = await bookingsService.createBooking(
        request.user.sub,
        body,
        getClientInfo(request)
      );
      return reply.status(201).send(createSuccessResponse(booking, request.id));
    }
  );

  // 3. List authenticated traveller's own bookings
  app.get(
    "/",
    {
      preHandler: [app.authenticate, app.requirePermission("bookings.read_own")],
      schema: {
        tags: ["Availability & Bookings"],
        summary: "List bookings owned by the authenticated traveller",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request) => {
      const query = BookingListQuerySchema.parse(request.query);
      const { bookings, total, page, limit } = await bookingsService.listTravellerBookings(
        request.user.sub,
        query
      );
      return createPaginatedResponse(bookings, page, limit, total, request.id);
    }
  );

  // 4. Get booking detail (enforces owner / host / admin scope & OQ-012 post-payment address disclosure)
  app.get<{ Params: { bookingId: string } }>(
    "/:bookingId",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["Availability & Bookings"],
        summary: "Retrieve booking detail with post-confirmation address disclosure rules",
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

  // 5. Traveller cancels own booking
  app.post<{ Params: { bookingId: string } }>(
    "/:bookingId/cancel",
    {
      preHandler: [app.authenticate, app.requirePermission("bookings.cancel_own")],
      schema: {
        tags: ["Availability & Bookings"],
        summary: "Cancel a traveller's own booking and evaluate OQ-009 refund policy",
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
        "TRAVELLER",
        body,
        getClientInfo(request)
      );
      return reply.status(200).send(createSuccessResponse(booking, request.id));
    }
  );

  // 6. Report an operational booking exception / incident
  app.post<{ Params: { bookingId: string } }>(
    "/:bookingId/exceptions",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["Availability & Bookings"],
        summary: "Record an operational booking exception or dispute and hold host settlement",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const bookingId = validateUuid(request.params.bookingId, "booking ID");
      const body = RecordBookingExceptionRequestSchema.parse(request.body);
      const booking = await bookingsService.recordBookingException(
        bookingId,
        request.user.sub,
        request.user.roles,
        body,
        getClientInfo(request)
      );
      return reply.status(200).send(createSuccessResponse(booking, request.id));
    }
  );

  // 7. Issue single-use custody handover QR token + 6-digit PIN pass (owner traveller only)
  app.post<{ Params: { bookingId: string } }>(
    "/:bookingId/custody-pass",
    {
      preHandler: [app.authenticate, app.requirePermission("bookings.read_own")],
      schema: {
        tags: ["Custody"],
        summary: "Issue a short-lived single-use QR token and 6-digit PIN for CHECK_IN or COLLECTION",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const bookingId = validateUuid(request.params.bookingId, "booking ID");
      const body = IssueCustodyPassRequestSchema.parse(request.body);
      const pass = await custodyService.issueCustodyPass(
        bookingId,
        request.user.sub,
        body,
        getClientInfo(request)
      );
      return reply.status(200).send(createSuccessResponse(pass, request.id));
    }
  );
}

/**
 * Host booking & settlement payable routes mounted under /hosts (and /api/v1/hosts).
 */
export async function hostBookingAndFinanceRoutes(app: FastifyInstance): Promise<void> {
  // 1. List bookings for host's owned or staff-assigned storage locations
  app.get(
    "/bookings",
    {
      preHandler: [app.authenticate, app.requirePermission("hosts.bookings.read_own")],
      schema: {
        tags: ["Host Bookings & Operations"],
        summary: "List bookings scoped to owned or staff-assigned host locations",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request) => {
      const query = BookingListQuerySchema.parse(request.query);
      const { bookings, total, page, limit } = await bookingsService.listHostBookings(
        request.user.sub,
        request.user.roles,
        query
      );
      return createPaginatedResponse(bookings, page, limit, total, request.id);
    }
  );

  // 2. Get single booking detail for host/staff
  app.get<{ Params: { bookingId: string } }>(
    "/bookings/:bookingId",
    {
      preHandler: [app.authenticate, app.requirePermission("hosts.bookings.read_own")],
      schema: {
        tags: ["Host Bookings & Operations"],
        summary: "Get booking detail for an owned or staff-assigned host location",
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

  // 3. Host accepts a PENDING_HOST_APPROVAL booking request
  app.post<{ Params: { bookingId: string } }>(
    "/bookings/:bookingId/accept",
    {
      preHandler: [app.authenticate, app.requirePermission("hosts.bookings.manage_own")],
      schema: {
        tags: ["Host Bookings & Operations"],
        summary: "Accept a pending host-approval booking request and open a 10-minute payment window",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const bookingId = validateUuid(request.params.bookingId, "booking ID");
      const body = HostDecisionBookingRequestSchema.parse(request.body || {});
      const booking = await bookingsService.hostAcceptBooking(
        bookingId,
        request.user.sub,
        request.user.roles,
        body,
        getClientInfo(request)
      );
      return reply.status(200).send(createSuccessResponse(booking, request.id));
    }
  );

  // 4. Host rejects a PENDING_HOST_APPROVAL booking request
  app.post<{ Params: { bookingId: string } }>(
    "/bookings/:bookingId/reject",
    {
      preHandler: [app.authenticate, app.requirePermission("hosts.bookings.manage_own")],
      schema: {
        tags: ["Host Bookings & Operations"],
        summary: "Reject a pending host-approval booking request and release held capacity",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const bookingId = validateUuid(request.params.bookingId, "booking ID");
      const body = HostRejectBookingRequestSchema.parse(request.body);
      const booking = await bookingsService.hostRejectBooking(
        bookingId,
        request.user.sub,
        request.user.roles,
        body,
        getClientInfo(request)
      );
      return reply.status(200).send(createSuccessResponse(booking, request.id));
    }
  );

  // 5. Host cancels an active booking (triggers 100% traveller refund if paid)
  app.post<{ Params: { bookingId: string } }>(
    "/bookings/:bookingId/cancel",
    {
      preHandler: [app.authenticate, app.requirePermission("hosts.bookings.manage_own")],
      schema: {
        tags: ["Host Bookings & Operations"],
        summary: "Cancel a booking as host and authorize 100% traveller refund if payment was captured",
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
        "HOST",
        body,
        getClientInfo(request)
      );
      return reply.status(200).send(createSuccessResponse(booking, request.id));
    }
  );

  // 6. Host owner financial settlement payables summary (OQ-017: excludes HOST_STAFF)
  app.get<{ Querystring: { businessId?: string } }>(
    "/finance/summary",
    {
      preHandler: [app.authenticate, app.requirePermission("hosts.finance.read_own")],
      schema: {
        tags: ["Host Finance"],
        summary: "Retrieve host settlement payables summary (HOST_OWNER only; HOST_STAFF excluded per OQ-017)",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      if (request.query.businessId) {
        validateUuid(request.query.businessId, "business ID");
      }
      const summary = await ledgerService.getHostFinanceSummary(
        request.user.sub,
        request.user.roles,
        request.query.businessId
      );
      return reply.status(200).send(createSuccessResponse(summary, request.id));
    }
  );
}

