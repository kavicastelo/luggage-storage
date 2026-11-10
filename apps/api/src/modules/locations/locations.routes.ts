import { FastifyInstance } from "fastify";
import {
  CreateLocationRequestSchema,
  UpdateLocationRequestSchema,
  SetOpeningHoursRequestSchema,
  CreateOpeningHoursExceptionRequestSchema,
  CreateStorageZoneRequestSchema,
  AddLocationMediaRequestSchema,
  createSuccessResponse
} from "@luggage-storage/contracts";
import { locationsService } from "./locations.service.js";

export async function locationRoutes(app: FastifyInstance): Promise<void> {
  // 1. Create Storage Location
  app.post(
    "/locations",
    {
      preHandler: [app.authenticate],
      schema: {
        description: "Create a new storage location draft under an owned host business",
        tags: ["Storage Locations"]
      }
    },
    async (request, reply) => {
      const body = CreateLocationRequestSchema.parse(request.body);
      const location = await locationsService.createLocation(body, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(201).send(createSuccessResponse(location, request.id));
    }
  );

  // 2. List owned locations
  app.get(
    "/locations",
    {
      preHandler: [app.authenticate],
      schema: {
        description: "List all storage locations owned by businesses of the authenticated user",
        tags: ["Storage Locations"]
      }
    },
    async (request, reply) => {
      const locations = await locationsService.getOwnedLocations({
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse({ locations }, request.id));
    }
  );

  // 3. Get single location details (Host/Admin view with exact address)
  app.get<{ Params: { locationId: string } }>(
    "/locations/:locationId",
    {
      preHandler: [app.authenticate],
      schema: {
        description: "Retrieve comprehensive details of a storage location",
        tags: ["Storage Locations"],
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
      const location = await locationsService.getLocationById(locationId, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse(location, request.id));
    }
  );

  // 4. Update location
  app.patch<{ Params: { locationId: string } }>(
    "/locations/:locationId",
    {
      preHandler: [app.authenticate],
      schema: {
        description: "Update details or coordinates of an owned storage location",
        tags: ["Storage Locations"],
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
      const body = UpdateLocationRequestSchema.parse(request.body);
      const location = await locationsService.updateLocation(locationId, body, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse(location, request.id));
    }
  );

  // 5. Submit location for Superadmin review
  app.post<{ Params: { locationId: string } }>(
    "/locations/:locationId/submit",
    {
      preHandler: [app.authenticate],
      schema: {
        description: "Submit a storage location draft for Superadmin moderation approval",
        tags: ["Storage Locations"],
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
      const location = await locationsService.submitLocationForReview(locationId, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse(location, request.id));
    }
  );

  // 6. Disable location
  app.post<{ Params: { locationId: string } }>(
    "/locations/:locationId/disable",
    {
      preHandler: [app.authenticate],
      schema: {
        description: "Disable an active or pending storage location",
        tags: ["Storage Locations"],
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
      const location = await locationsService.disableLocation(locationId, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse(location, request.id));
    }
  );

  // 7. Manage Opening Hours
  app.put<{ Params: { locationId: string } }>(
    "/locations/:locationId/opening-hours",
    {
      preHandler: [app.authenticate],
      schema: {
        description: "Configure weekly recurring opening and intake hours",
        tags: ["Storage Locations"],
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
      const body = SetOpeningHoursRequestSchema.parse(request.body);
      await locationsService.setOpeningHours(locationId, body.schedules, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse({ success: true }, request.id));
    }
  );

  // 8. Add Opening Hours Exception
  app.post<{ Params: { locationId: string } }>(
    "/locations/:locationId/exceptions",
    {
      preHandler: [app.authenticate],
      schema: {
        description: "Add a date-specific opening hours exception or full-day closure",
        tags: ["Storage Locations"],
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
      const body = CreateOpeningHoursExceptionRequestSchema.parse(request.body);
      await locationsService.addOpeningHoursException(locationId, body, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(201).send(createSuccessResponse({ success: true }, request.id));
    }
  );

  // 9. Add Storage Zone
  app.post<{ Params: { locationId: string } }>(
    "/locations/:locationId/zones",
    {
      preHandler: [app.authenticate],
      schema: {
        description: "Create a storage zone / room partition within a location",
        tags: ["Storage Locations"],
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
      const body = CreateStorageZoneRequestSchema.parse(request.body);
      const zone = await locationsService.createStorageZone(locationId, body, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(201).send(createSuccessResponse(zone, request.id));
    }
  );

  // 10. Add Location Media
  app.post<{ Params: { locationId: string } }>(
    "/locations/:locationId/media",
    {
      preHandler: [app.authenticate],
      schema: {
        description: "Link uploaded photo to a storage location",
        tags: ["Storage Locations"],
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
      const body = AddLocationMediaRequestSchema.parse(request.body);
      const media = await locationsService.addLocationMedia(locationId, body, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(201).send(createSuccessResponse(media, request.id));
    }
  );
}
