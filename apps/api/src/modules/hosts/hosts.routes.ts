import { FastifyInstance } from "fastify";
import {
  CreateHostBusinessRequestSchema,
  UpdateHostBusinessRequestSchema,
  SubmitHostVerificationRequestSchema,
  createSuccessResponse,
  SYSTEM_PERMISSIONS
} from "@luggage-storage/contracts";
import { hostsService } from "./hosts.service.js";

export async function hostRoutes(app: FastifyInstance): Promise<void> {
  // 1. Create Host Business (self-onboarding allowed for authenticated TRAVELLER accounts)
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
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.HOSTS_BUSINESS_READ_OWN)
      ],
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
      preHandler: [
        app.authenticate,
        app.requireAnyPermission([
          SYSTEM_PERMISSIONS.HOSTS_BUSINESS_READ_OWN,
          SYSTEM_PERMISSIONS.ADMIN_HOST_READ
        ])
      ],
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
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.HOSTS_BUSINESS_UPDATE_OWN)
      ],
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
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.HOSTS_VERIFICATION_SUBMIT)
      ],
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
      preHandler: [
        app.authenticate,
        app.requireAnyPermission([
          SYSTEM_PERMISSIONS.HOSTS_VERIFICATION_READ_OWN,
          SYSTEM_PERMISSIONS.ADMIN_HOST_READ
        ])
      ],
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
      const verification = await hostsService.getVerificationByBusinessId(businessId, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse(verification, request.id));
    }
  );

  // 7. Get sensitive payout details (Authorized Host Owner or Superadmin only)
  app.get<{ Params: { businessId: string } }>(
    "/businesses/:businessId/payout-details",
    {
      preHandler: [
        app.authenticate,
        app.requireAnyPermission([
          SYSTEM_PERMISSIONS.HOSTS_FINANCE_READ_OWN,
          SYSTEM_PERMISSIONS.ADMIN_FINANCIAL_MANAGE
        ])
      ],
      schema: {
        description: "Retrieve sensitive payout details for authorized business owner or financial administrator",
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
      const payoutDetails = await hostsService.getPayoutDetails(businessId, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse(payoutDetails, request.id));
    }
  );
}
