import { FastifyInstance } from "fastify";
import {
  LocationModerationQueueQuerySchema,
  ReviewLocationRequestSchema,
  createSuccessResponse,
  SYSTEM_PERMISSIONS
} from "@luggage-storage/contracts";
import { locationsService } from "./locations.service.js";

export async function locationModerationRoutes(app: FastifyInstance): Promise<void> {
  // 1. Locations moderation queue
  app.get<{ Querystring: { page?: number; limit?: number; status?: string } }>(
    "/locations/moderation-queue",
    {
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.ADMIN_LOCATION_READ)
      ],
      schema: {
        description: "Retrieve storage location listings for Superadmin & Support moderation",
        tags: ["Admin Location Moderation"],
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", default: 1 },
            limit: { type: "integer", default: 20 },
            status: { type: "string" }
          }
        }
      }
    },
    async (request, reply) => {
      const parsed = LocationModerationQueueQuerySchema.parse(request.query ?? {});
      const offset = (parsed.page - 1) * parsed.limit;

      const result = await locationsService.getPendingLocationsQueue(
        parsed.limit,
        offset,
        parsed.status
      );
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
