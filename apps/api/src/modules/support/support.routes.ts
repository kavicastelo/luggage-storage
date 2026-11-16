import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  AdminSupportTicketQuerySchema,
  AdminUpdateSupportTicketRequestSchema,
  CreateSupportTicketRequestSchema,
  CustomerSupportTicketReplyRequestSchema,
  SupportTicketReplyRequestSchema,
  SYSTEM_PERMISSIONS,
  createPaginatedResponse,
  createSuccessResponse
} from "@luggage-storage/contracts";
import { AppError } from "../../common/errors/app-error.js";
import { supportService } from "./support.service.js";

function getClientInfo(request: FastifyRequest) {
  return {
    ip: request.ip,
    userAgent: request.headers["user-agent"] as string | undefined,
    correlationId: (request.headers["x-correlation-id"] as string) || request.id
  };
}

/**
 * Public / Customer support ticket routes mounted at /support (and /api/v1/support).
 */
export async function supportRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/tickets",
    {
      schema: {
        tags: ["Support"],
        summary: "Submit a customer or host support inquiry ticket"
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      let caller: { userId?: string; roles?: string[] } | null = null;
      if (request.headers.authorization) {
        await app.authenticate(request, reply);
        if (request.user?.sub) {
          caller = { userId: request.user.sub, roles: request.user.roles };
        }
      }
      const body = CreateSupportTicketRequestSchema.parse(request.body);
      const created = await supportService.createTicket(body, caller, getClientInfo(request));
      return reply.status(201).send(createSuccessResponse(created, request.id));
    }
  );

  app.get(
    "/tickets/me",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["Support"],
        summary: "List support tickets created by the authenticated user",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const tickets = await supportService.listMyTickets(request.user.sub);
      return reply.status(200).send(createSuccessResponse({ tickets }, request.id));
    }
  );

  app.get<{ Params: { ticketId: string } }>(
    "/tickets/me/:ticketId",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["Support"],
        summary: "View customer-visible message thread for one of your support tickets",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const ticket = await supportService.getMyTicketDetail(
        request.params.ticketId,
        request.user.sub
      );
      return reply.status(200).send(createSuccessResponse(ticket, request.id));
    }
  );

  app.post<{ Params: { ticketId: string } }>(
    "/tickets/me/:ticketId/messages",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["Support"],
        summary: "Reply to one of your support tickets",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const body = CustomerSupportTicketReplyRequestSchema.parse(request.body);
      const ticket = await supportService.replyMyTicket(
        request.params.ticketId,
        request.user.sub,
        request.user.roles,
        body,
        getClientInfo(request)
      );
      return reply.status(200).send(createSuccessResponse(ticket, request.id));
    }
  );
}

/**
 * Support & Superadmin ticket triage routes mounted at /admin (and /api/v1/admin).
 */
export async function adminSupportRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/support/tickets",
    {
      preHandler: [app.authenticate, app.requirePermission(SYSTEM_PERMISSIONS.SUPPORT_TICKET_READ)],
      schema: {
        tags: ["Admin Support"],
        summary: "List customer and host support tickets with triage filters",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request) => {
      const query = AdminSupportTicketQuerySchema.parse(request.query ?? {});
      const { tickets, total, pagination } = await supportService.listAdminTickets(query);
      return createPaginatedResponse(
        tickets,
        pagination.page,
        pagination.limit,
        total,
        request.id
      );
    }
  );

  app.get<{ Params: { ticketId: string } }>(
    "/support/tickets/:ticketId",
    {
      preHandler: [app.authenticate, app.requirePermission(SYSTEM_PERMISSIONS.SUPPORT_TICKET_READ)],
      schema: {
        tags: ["Admin Support"],
        summary: "Inspect support ticket details, message thread, internal notes, and linked booking",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      if (!request.params.ticketId.trim()) {
        throw AppError.badRequest("Ticket ID is required");
      }
      const ticket = await supportService.getAdminTicketDetail(request.params.ticketId);
      return reply.status(200).send(createSuccessResponse(ticket, request.id));
    }
  );

  app.post<{ Params: { ticketId: string } }>(
    "/support/tickets/:ticketId/messages",
    {
      preHandler: [app.authenticate, app.requirePermission(SYSTEM_PERMISSIONS.SUPPORT_TICKET_UPDATE)],
      schema: {
        tags: ["Admin Support"],
        summary: "Post a customer reply or internal support note on a support ticket",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const body = SupportTicketReplyRequestSchema.parse(request.body);
      const updated = await supportService.replyAdminTicket(
        request.params.ticketId,
        request.user.sub,
        request.user.roles,
        body,
        getClientInfo(request)
      );
      return reply.status(200).send(createSuccessResponse(updated, request.id));
    }
  );

  app.patch<{ Params: { ticketId: string } }>(
    "/support/tickets/:ticketId",
    {
      preHandler: [app.authenticate, app.requirePermission(SYSTEM_PERMISSIONS.SUPPORT_TICKET_UPDATE)],
      schema: {
        tags: ["Admin Support"],
        summary: "Update support ticket status, priority, assignee, or resolution summary",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const body = AdminUpdateSupportTicketRequestSchema.parse(request.body);
      const updated = await supportService.updateAdminTicket(
        request.params.ticketId,
        request.user.sub,
        body,
        getClientInfo(request)
      );
      return reply.status(200).send(createSuccessResponse(updated, request.id));
    }
  );
}
