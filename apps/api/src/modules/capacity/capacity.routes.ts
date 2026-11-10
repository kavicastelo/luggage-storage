import { FastifyInstance } from "fastify";
import {
  CreateCapacityPoolRequestSchema,
  UpdateCapacityPoolRequestSchema,
  createSuccessResponse
} from "@luggage-storage/contracts";
import { capacityService } from "./capacity.service.js";

export async function capacityRoutes(app: FastifyInstance): Promise<void> {
  // 1. Get capacity pools for a location
  app.get<{ Params: { locationId: string } }>(
    "/locations/:locationId/capacity-pools",
    {
      preHandler: [app.authenticate],
      schema: {
        description: "Retrieve all capacity pools configured for a storage location",
        tags: ["Capacity"],
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
      const pools = await capacityService.getCapacityPools(locationId, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse({ pools }, request.id));
    }
  );

  // 2. Add capacity pool
  app.post<{ Params: { locationId: string } }>(
    "/locations/:locationId/capacity-pools",
    {
      preHandler: [app.authenticate],
      schema: {
        description: "Create a new capacity pool for a storage location",
        tags: ["Capacity"],
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
      const body = CreateCapacityPoolRequestSchema.parse(request.body);
      const pool = await capacityService.createCapacityPool(locationId, body, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(201).send(createSuccessResponse(pool, request.id));
    }
  );

  // 3. Update capacity pool
  app.patch<{ Params: { poolId: string } }>(
    "/capacity-pools/:poolId",
    {
      preHandler: [app.authenticate],
      schema: {
        description: "Update quota units or settings of a capacity pool",
        tags: ["Capacity"],
        params: {
          type: "object",
          required: ["poolId"],
          properties: {
            poolId: { type: "string", format: "uuid" }
          }
        }
      }
    },
    async (request, reply) => {
      const { poolId } = request.params;
      const body = UpdateCapacityPoolRequestSchema.parse(request.body);
      const pool = await capacityService.updateCapacityPool(poolId, body, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse(pool, request.id));
    }
  );
}
