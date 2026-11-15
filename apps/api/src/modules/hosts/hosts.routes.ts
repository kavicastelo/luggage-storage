import { FastifyInstance } from "fastify";
import {
  CreateHostBusinessRequestSchema,
  UpdateHostBusinessRequestSchema,
  SubmitHostVerificationRequestSchema,
  AddHostStaffRequestSchema,
  UpdateHostStaffRequestSchema,
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

  // 8. List Host Business Staff Members
  app.get<{ Params: { businessId: string } }>(
    "/businesses/:businessId/staff",
    {
      preHandler: [
        app.authenticate,
        app.requireAnyPermission([
          SYSTEM_PERMISSIONS.HOSTS_STAFF_READ_OWN,
          SYSTEM_PERMISSIONS.ADMIN_HOST_READ
        ])
      ],
      schema: {
        description: "List staff memberships and assigned storage locations for a host business",
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
      const staff = await hostsService.listBusinessStaff(businessId, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse({ staff }, request.id));
    }
  );

  // 9. Invite / Add Staff Member to Host Business
  app.post<{ Params: { businessId: string } }>(
    "/businesses/:businessId/staff",
    {
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.HOSTS_STAFF_MANAGE_OWN)
      ],
      schema: {
        description: "Assign an existing registered account as host staff for specific storage locations",
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
      const body = AddHostStaffRequestSchema.parse(request.body);
      const staffMember = await hostsService.addBusinessStaff(businessId, body, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(201).send(createSuccessResponse({ staffMember }, request.id));
    }
  );

  // 10. Update Staff Membership Role, Location Scope, or Active Status
  app.patch<{ Params: { businessId: string; membershipId: string } }>(
    "/businesses/:businessId/staff/:membershipId",
    {
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.HOSTS_STAFF_MANAGE_OWN)
      ],
      schema: {
        description: "Update staff role, location assignments, or active status",
        tags: ["Hosts"],
        params: {
          type: "object",
          required: ["businessId", "membershipId"],
          properties: {
            businessId: { type: "string", format: "uuid" },
            membershipId: { type: "string", format: "uuid" }
          }
        }
      }
    },
    async (request, reply) => {
      const { businessId, membershipId } = request.params;
      const body = UpdateHostStaffRequestSchema.parse(request.body);
      const staffMember = await hostsService.updateBusinessStaff(businessId, membershipId, body, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse({ staffMember }, request.id));
    }
  );

  // 11. Remove Staff Membership
  app.delete<{ Params: { businessId: string; membershipId: string } }>(
    "/businesses/:businessId/staff/:membershipId",
    {
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.HOSTS_STAFF_MANAGE_OWN)
      ],
      schema: {
        description: "Remove a staff member from a host business and revoke HOST_STAFF role if no active memberships remain",
        tags: ["Hosts"],
        params: {
          type: "object",
          required: ["businessId", "membershipId"],
          properties: {
            businessId: { type: "string", format: "uuid" },
            membershipId: { type: "string", format: "uuid" }
          }
        }
      }
    },
    async (request, reply) => {
      const { businessId, membershipId } = request.params;
      await hostsService.removeBusinessStaff(businessId, membershipId, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(
        createSuccessResponse({ removed: true, membershipId }, request.id)
      );
    }
  );
}
