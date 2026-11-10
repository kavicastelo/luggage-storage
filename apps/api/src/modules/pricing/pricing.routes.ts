import { FastifyInstance } from "fastify";
import {
  ConfigurePricingPolicyRequestSchema,
  createSuccessResponse
} from "@luggage-storage/contracts";
import { pricingService } from "./pricing.service.js";

export async function pricingRoutes(app: FastifyInstance): Promise<void> {
  // 1. Get pricing policy for location
  app.get<{ Params: { locationId: string } }>(
    "/locations/:locationId/pricing",
    {
      preHandler: [app.authenticate],
      schema: {
        description: "Retrieve active pricing policy and bag category rates for a location",
        tags: ["Pricing"],
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
      const policy = await pricingService.getPricingPolicy(locationId, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse(policy, request.id));
    }
  );

  // 2. Configure pricing policy
  app.put<{ Params: { locationId: string } }>(
    "/locations/:locationId/pricing",
    {
      preHandler: [app.authenticate],
      schema: {
        description: "Configure or update pricing policy and category rates for a location",
        tags: ["Pricing"],
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
      const body = ConfigurePricingPolicyRequestSchema.parse(request.body);
      const policy = await pricingService.configurePricingPolicy(locationId, body, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse(policy, request.id));
    }
  );
}
