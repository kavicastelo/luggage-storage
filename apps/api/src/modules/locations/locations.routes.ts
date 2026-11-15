import { FastifyInstance } from "fastify";
import {
  CreateLocationRequestSchema,
  UpdateLocationRequestSchema,
  SetOpeningHoursRequestSchema,
  CreateOpeningHoursExceptionRequestSchema,
  CreateStorageZoneRequestSchema,
  UpdateStorageZoneRequestSchema,
  AddLocationMediaRequestSchema,
  UpdateLocationMediaRequestSchema,
  createSuccessResponse,
  SYSTEM_PERMISSIONS
} from "@luggage-storage/contracts";
import { locationsService } from "./locations.service.js";

export async function locationRoutes(app: FastifyInstance): Promise<void> {
  // 1. Create Storage Location
  app.post(
    "/locations",
    {
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.HOSTS_LOCATION_CREATE)
      ],
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
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.HOSTS_LOCATION_READ_OWN)
      ],
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
      preHandler: [
        app.authenticate,
        app.requireAnyPermission([
          SYSTEM_PERMISSIONS.HOSTS_LOCATION_READ_OWN,
          SYSTEM_PERMISSIONS.ADMIN_LOCATION_READ
        ])
      ],
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
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.HOSTS_LOCATION_UPDATE_OWN)
      ],
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
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.HOSTS_LOCATION_SUBMIT)
      ],
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
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.HOSTS_LOCATION_DISABLE)
      ],
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

  // 7. Get Weekly Opening Hours
  app.get<{ Params: { locationId: string } }>(
    "/locations/:locationId/opening-hours",
    {
      preHandler: [
        app.authenticate,
        app.requireAnyPermission([
          SYSTEM_PERMISSIONS.HOSTS_LOCATION_READ_OWN,
          SYSTEM_PERMISSIONS.ADMIN_LOCATION_READ
        ])
      ],
      schema: {
        description: "Retrieve weekly recurring opening hours for a storage location",
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
      const schedules = await locationsService.getOpeningHours(locationId, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse({ schedules }, request.id));
    }
  );

  // 7b. Manage Opening Hours
  app.put<{ Params: { locationId: string } }>(
    "/locations/:locationId/opening-hours",
    {
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.HOSTS_LOCATION_CONFIGURE)
      ],
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

  // 8. List Opening Hours Exceptions
  app.get<{ Params: { locationId: string } }>(
    "/locations/:locationId/exceptions",
    {
      preHandler: [
        app.authenticate,
        app.requireAnyPermission([
          SYSTEM_PERMISSIONS.HOSTS_LOCATION_READ_OWN,
          SYSTEM_PERMISSIONS.ADMIN_LOCATION_READ
        ])
      ],
      schema: {
        description: "List date-specific opening hours exceptions for a storage location",
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
      const exceptions = await locationsService.getOpeningHoursExceptions(locationId, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse({ exceptions }, request.id));
    }
  );

  // 8b. Add Opening Hours Exception
  app.post<{ Params: { locationId: string } }>(
    "/locations/:locationId/exceptions",
    {
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.HOSTS_LOCATION_CONFIGURE)
      ],
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
      const exception = await locationsService.addOpeningHoursException(locationId, body, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(201).send(createSuccessResponse({ success: true, exception }, request.id));
    }
  );

  // 8c. Delete Opening Hours Exception
  app.delete<{ Params: { locationId: string; exceptionId: string } }>(
    "/locations/:locationId/exceptions/:exceptionId",
    {
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.HOSTS_LOCATION_CONFIGURE)
      ],
      schema: {
        description: "Delete a date-specific opening hours exception",
        tags: ["Storage Locations"],
        params: {
          type: "object",
          required: ["locationId", "exceptionId"],
          properties: {
            locationId: { type: "string", format: "uuid" },
            exceptionId: { type: "string", format: "uuid" }
          }
        }
      }
    },
    async (request, reply) => {
      const { locationId, exceptionId } = request.params;
      await locationsService.deleteOpeningHoursException(locationId, exceptionId, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(
        createSuccessResponse({ removed: true, exceptionId }, request.id)
      );
    }
  );

  // 9. List Storage Zones
  app.get<{ Params: { locationId: string } }>(
    "/locations/:locationId/zones",
    {
      preHandler: [
        app.authenticate,
        app.requireAnyPermission([
          SYSTEM_PERMISSIONS.HOSTS_LOCATION_READ_OWN,
          SYSTEM_PERMISSIONS.ADMIN_LOCATION_READ
        ])
      ],
      schema: {
        description: "List storage zones configured for a storage location",
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
      const zones = await locationsService.getStorageZones(locationId, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse({ zones }, request.id));
    }
  );

  // 9b. Add Storage Zone
  app.post<{ Params: { locationId: string } }>(
    "/locations/:locationId/zones",
    {
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.HOSTS_LOCATION_CONFIGURE)
      ],
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

  // 9c. Update Storage Zone
  app.patch<{ Params: { locationId: string; zoneId: string } }>(
    "/locations/:locationId/zones/:zoneId",
    {
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.HOSTS_LOCATION_CONFIGURE)
      ],
      schema: {
        description: "Update a storage zone name, type, security tier, or active state",
        tags: ["Storage Locations"],
        params: {
          type: "object",
          required: ["locationId", "zoneId"],
          properties: {
            locationId: { type: "string", format: "uuid" },
            zoneId: { type: "string", format: "uuid" }
          }
        }
      }
    },
    async (request, reply) => {
      const { locationId, zoneId } = request.params;
      const body = UpdateStorageZoneRequestSchema.parse(request.body);
      const zone = await locationsService.updateStorageZone(locationId, zoneId, body, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse(zone, request.id));
    }
  );

  // 9d. Delete Storage Zone
  app.delete<{ Params: { locationId: string; zoneId: string } }>(
    "/locations/:locationId/zones/:zoneId",
    {
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.HOSTS_LOCATION_CONFIGURE)
      ],
      schema: {
        description: "Delete a storage zone if no checked-in bags are assigned to it",
        tags: ["Storage Locations"],
        params: {
          type: "object",
          required: ["locationId", "zoneId"],
          properties: {
            locationId: { type: "string", format: "uuid" },
            zoneId: { type: "string", format: "uuid" }
          }
        }
      }
    },
    async (request, reply) => {
      const { locationId, zoneId } = request.params;
      await locationsService.deleteStorageZone(locationId, zoneId, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse({ removed: true, zoneId }, request.id));
    }
  );

  // 10. List Location Media
  app.get<{ Params: { locationId: string } }>(
    "/locations/:locationId/media",
    {
      preHandler: [
        app.authenticate,
        app.requireAnyPermission([
          SYSTEM_PERMISSIONS.HOSTS_LOCATION_READ_OWN,
          SYSTEM_PERMISSIONS.ADMIN_LOCATION_READ
        ])
      ],
      schema: {
        description: "List uploaded media items for a storage location",
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
      const media = await locationsService.getLocationMedia(locationId, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse({ media }, request.id));
    }
  );

  // 10b. Add Location Media
  app.post<{ Params: { locationId: string } }>(
    "/locations/:locationId/media",
    {
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.HOSTS_LOCATION_CONFIGURE)
      ],
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

  // 10c. Update Location Media
  app.patch<{ Params: { locationId: string; mediaId: string } }>(
    "/locations/:locationId/media/:mediaId",
    {
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.HOSTS_LOCATION_CONFIGURE)
      ],
      schema: {
        description: "Update caption, sort order, or primary photo status for location media",
        tags: ["Storage Locations"],
        params: {
          type: "object",
          required: ["locationId", "mediaId"],
          properties: {
            locationId: { type: "string", format: "uuid" },
            mediaId: { type: "string", format: "uuid" }
          }
        }
      }
    },
    async (request, reply) => {
      const { locationId, mediaId } = request.params;
      const body = UpdateLocationMediaRequestSchema.parse(request.body);
      const media = await locationsService.updateLocationMedia(locationId, mediaId, body, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse(media, request.id));
    }
  );

  // 10d. Delete Location Media
  app.delete<{ Params: { locationId: string; mediaId: string } }>(
    "/locations/:locationId/media/:mediaId",
    {
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.HOSTS_LOCATION_CONFIGURE)
      ],
      schema: {
        description: "Delete a media photo from a storage location",
        tags: ["Storage Locations"],
        params: {
          type: "object",
          required: ["locationId", "mediaId"],
          properties: {
            locationId: { type: "string", format: "uuid" },
            mediaId: { type: "string", format: "uuid" }
          }
        }
      }
    },
    async (request, reply) => {
      const { locationId, mediaId } = request.params;
      await locationsService.deleteLocationMedia(locationId, mediaId, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse({ removed: true, mediaId }, request.id));
    }
  );
}
