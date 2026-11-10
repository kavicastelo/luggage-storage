import { FastifyInstance } from "fastify";
import {
  ReviewLocationRequestSchema,
  createSuccessResponse,
  SYSTEM_PERMISSIONS
} from "@luggage-storage/contracts";
import { locationsService } from "./locations.service.js";

export async function locationModerationRoutes(app: FastifyInstance): Promise<void> {
  // 1. Pending locations moderation queue
  app.get<{ Querystring: { page?: number; limit?: number } }>(
    "/locations/moderation-queue",
    {
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.ADMIN_LOCATION_READ)
      ],
      schema: {
        description: "Retrieve pending storage location listings awaiting Superadmin moderation",
        tags: ["Admin Location Moderation"],
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", default: 1 },
            limit: { type: "integer", default: 20 }
          }
        }
      }
    },
    async (request, reply) => {
      const page = Math.max(1, request.query?.page || 1);
      const limit = Math.min(100, Math.max(1, request.query?.limit || 20));
      const offset = (page - 1) * limit;

      const result = await locationsService.getPendingLocationsQueue(limit, offset);
      return reply.status(200).send(createSuccessResponse(result, request.id));
    }
  );

  // 2. Review location (Approve or Reject)
  app.post<{ Params: { locationId: string } }>(
    "/locations/:locationId/review",
    {
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.ADMIN_LOCATION_MODERATE)
      ],
      schema: {
        description: "Approve or reject a storage location listing",
        tags: ["Admin Location Moderation"],
        params: {
          type: "object",
          required: ["locationId"],
          properties: {
            locationId: { type: "string", format: "uuid" }
          }
        }
      }
    },
    async (request, reply) => {
      const { locationId } = request.params;
      const body = ReviewLocationRequestSchema.parse(request.body);
      const result = await locationsService.reviewLocation(locationId, body, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse(result, request.id));
    }
  );
}
