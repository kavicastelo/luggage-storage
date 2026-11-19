import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  GeocodingQuerySchema,
  ReverseGeocodingQuerySchema,
  RouteRequestSchema,
  createSuccessResponse
} from "@luggage-storage/contracts";
import { mapsService } from "./maps.service.js";

export async function mapsRoutes(app: FastifyInstance): Promise<void> {
  // 1. Calculate route between origin and destination
  app.post(
    "/routes",
    {
      schema: {
        description: "Calculate in-app route, polyline geometry, distance, duration, and maneuver instructions",
        tags: ["Maps"]
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = RouteRequestSchema.parse(request.body);
      const result = await mapsService.calculateRoute(body);

      return reply.status(200).send(createSuccessResponse(result, request.id));
    }
  );

  // 2. Geocoding search (places, addresses, transit hubs)
  app.get(
    "/geocoding",
    {
      schema: {
        description: "Search addresses, places, and transit hubs with Sri Lanka geographic biasing",
        tags: ["Maps"]
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = GeocodingQuerySchema.parse(request.query);
      const result = await mapsService.searchPlaces(query);

      return reply.status(200).send(createSuccessResponse(result, request.id));
    }
  );

  // 3. Reverse geocoding (coordinates to address/city)
  app.get(
    "/reverse-geocoding",
    {
      schema: {
        description: "Convert geographic coordinate to nearest address, landmark, or city",
        tags: ["Maps"]
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = ReverseGeocodingQuerySchema.parse(request.query);
      const result = await mapsService.reverseGeocode(query);

      return reply.status(200).send(createSuccessResponse(result, request.id));
    }
  );
}

