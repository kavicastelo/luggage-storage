import { FastifyInstance } from "fastify";
import {
  CreateHostBusinessRequestSchema,
  UpdateHostBusinessRequestSchema,
  SubmitHostVerificationRequestSchema,
  createSuccessResponse
} from "@luggage-storage/contracts";
import { hostsService } from "./hosts.service.js";

export async function hostRoutes(app: FastifyInstance): Promise<void> {
  // 1. Create Host Business
  app.post(
    "/businesses",
    {
      preHandler: [app.authenticate],
      schema: {
        description: "Register a new host business owned by the authenticated user",
        tags: ["Hosts"]
      }
    },
    async (request, reply) => {
      const body = CreateHostBusinessRequestSchema.parse(request.body);
      const business = await hostsService.createBusiness(body, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(201).send(createSuccessResponse(business, request.id));
    }
  );

  // 2. List owned Host Businesses
  app.get(
    "/businesses",
    {
      preHandler: [app.authenticate],
      schema: {
        description: "List all host businesses owned by the authenticated user",
        tags: ["Hosts"]
      }
    },
    async (request, reply) => {
      const businesses = await hostsService.getOwnedBusinesses({
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse({ businesses }, request.id));
    }
  );

  // 3. Get single Host Business details
  app.get<{ Params: { businessId: string } }>(
    "/businesses/:businessId",
    {
      preHandler: [app.authenticate],
      schema: {
        description: "Retrieve details of a specific host business",
        tags: ["Hosts"],
        params: {
          type: "object",
          required: ["businessId"],
          properties: {
            businessId: { type: "string", format: "uuid" }
          }
        }
      }
    },
    async (request, reply) => {
      const { businessId } = request.params;
      const business = await hostsService.getBusinessById(businessId, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse(business, request.id));
    }
  );

  // 4. Update Host Business
  app.patch<{ Params: { businessId: string } }>(
    "/businesses/:businessId",
    {
      preHandler: [app.authenticate],
      schema: {
        description: "Update details of an owned host business",
        tags: ["Hosts"],
        params: {
          type: "object",
          required: ["businessId"],
          properties: {
            businessId: { type: "string", format: "uuid" }
          }
        }
      }
    },
    async (request, reply) => {
      const { businessId } = request.params;
      const body = UpdateHostBusinessRequestSchema.parse(request.body);
      const business = await hostsService.updateBusiness(businessId, body, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse(business, request.id));
    }
  );

  // 5. Submit Host Verification
  app.post<{ Params: { businessId: string } }>(
    "/businesses/:businessId/verification",
    {
      preHandler: [app.authenticate],
      schema: {
        description: "Submit KYC and business registration documents for verification",
        tags: ["Hosts"],
        params: {
          type: "object",
          required: ["businessId"],
          properties: {
            businessId: { type: "string", format: "uuid" }
          }
        }
      }
    },
    async (request, reply) => {
      const { businessId } = request.params;
      const body = SubmitHostVerificationRequestSchema.parse(request.body);
      const verification = await hostsService.submitVerification(businessId, body, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(201).send(createSuccessResponse(verification, request.id));
    }
  );

  // 6. Get Host Verification status
  app.get<{ Params: { businessId: string } }>(
    "/businesses/:businessId/verification",
    {
      preHandler: [app.authenticate],
      schema: {
        description: "Retrieve verification progress and review feedback for a host business",
        tags: ["Hosts"],
        params: {
          type: "object",
          required: ["businessId"],
          properties: {
            businessId: { type: "string", format: "uuid" }
          }
        }
      }
    },
    async (request, reply) => {
      const { businessId } = request.params;
      const business = await hostsService.getBusinessById(businessId, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse(business.verification || null, request.id));
    }
  );
}
