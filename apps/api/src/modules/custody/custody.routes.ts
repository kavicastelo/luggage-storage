import { FastifyInstance, FastifyRequest } from "fastify";
import {
  CompleteCheckInRequestSchema,
  CompleteCollectionRequestSchema,
  VerifyCustodyPassRequestSchema,
  createSuccessResponse
} from "@luggage-storage/contracts";
import { AppError } from "../../common/errors/app-error.js";
import { custodyService } from "./custody.service.js";

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
 * Host & staff counter custody operations mounted under /hosts (and /api/v1/hosts).
 */
export async function hostCustodyRoutes(app: FastifyInstance): Promise<void> {
  // 1. Pre-verify traveller QR token or 6-digit PIN at counter without consuming yet
  app.post(
    "/custody/verify",
    {
      preHandler: [app.authenticate, app.requirePermission("hosts.custody.operate")],
      schema: {
        tags: ["Custody"],
        summary: "Pre-verify a traveller's QR token or 6-digit PIN for CHECK_IN or COLLECTION",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const body = VerifyCustodyPassRequestSchema.parse(request.body);
      const result = await custodyService.verifyCustodyPassForHost(
        request.user.sub,
        request.user.roles,
        body,
        getClientInfo(request)
      );
      return reply.status(200).send(createSuccessResponse(result, request.id));
    }
  );

  // 2. Get custody record, tagged bags, and chain-of-custody event history
  app.get<{ Params: { bookingId: string } }>(
    "/custody/:bookingId",
    {
      preHandler: [app.authenticate, app.requirePermission("hosts.custody.operate")],
      schema: {
        tags: ["Custody"],
        summary: "Retrieve custody record, bag tags, and chain-of-custody audit log",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const bookingId = validateUuid(request.params.bookingId, "booking ID");
      const detail = await custodyService.getCustodyDetail(
        bookingId,
        request.user.sub,
        request.user.roles
      );
      return reply.status(200).send(createSuccessResponse(detail, request.id));
    }
  );

  // 3. Complete physical check-in (consumes CHECK_IN pass, records bag tags/seals/zones -> IN_STORAGE)
  app.post<{ Params: { bookingId: string } }>(
    "/custody/:bookingId/check-in",
    {
      preHandler: [app.authenticate, app.requirePermission("hosts.custody.operate")],
      schema: {
        tags: ["Custody"],
        summary: "Verify and consume CHECK_IN pass, tag physical luggage, and transition booking to IN_STORAGE",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const bookingId = validateUuid(request.params.bookingId, "booking ID");
      const body = CompleteCheckInRequestSchema.parse(request.body);
      const detail = await custodyService.completeCheckIn(
        bookingId,
        request.user.sub,
        request.user.roles,
        body,
        getClientInfo(request)
      );
      return reply.status(200).send(createSuccessResponse(detail, request.id));
    }
  );

  // 4. Complete physical collection release (OQ-015 Zero Possessory Lien + accrues host payable)
  app.post<{ Params: { bookingId: string } }>(
    "/custody/:bookingId/check-out",
    {
      preHandler: [app.authenticate, app.requirePermission("hosts.custody.operate")],
      schema: {
        tags: ["Custody"],
        summary: "Verify and consume COLLECTION pass, release physical luggage (enforcing OQ-015 Zero Possessory Lien), and accrue host payable",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const bookingId = validateUuid(request.params.bookingId, "booking ID");
      const body = CompleteCollectionRequestSchema.parse(request.body);
      const detail = await custodyService.completeCollection(
        bookingId,
        request.user.sub,
        request.user.roles,
        body,
        getClientInfo(request)
      );
      return reply.status(200).send(createSuccessResponse(detail, request.id));
    }
  );
}

