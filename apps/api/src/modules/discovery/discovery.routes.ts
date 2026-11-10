import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  SearchLocationsQuerySchema,
  createSuccessResponse
} from "@luggage-storage/contracts";
import { discoveryService } from "./discovery.service.js";

export async function discoveryRoutes(app: FastifyInstance): Promise<void> {
  // 1. Search public storage locations
  app.get(
    "/locations",
    {
      schema: {
        description: "Public location discovery with PostGIS geospatial search, filtering and privacy sanitization",
        tags: ["Discovery"]
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = SearchLocationsQuerySchema.parse(request.query);
      const result = await discoveryService.searchLocations(query);

      return reply.status(200).send(createSuccessResponse(result, request.id));
    }
  );

  // 2. Get public location details
  app.get(
    "/locations/:locationId",
    {
      schema: {
        description: "Retrieve public details of an active storage location with address privacy protection",
        tags: ["Discovery"],
        params: {
          type: "object",
          required: ["locationId"],
          properties: {
            locationId: { type: "string", format: "uuid" }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Params: { locationId: string } }>, reply: FastifyReply) => {
      const { locationId } = request.params;
      const location = await discoveryService.getPublicLocationDetails(locationId);

      return reply.status(200).send(createSuccessResponse(location, request.id));
    }
  );
}
