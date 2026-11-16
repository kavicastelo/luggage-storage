import { FastifyInstance } from "fastify";
import {
  HostVerificationQueueQuerySchema,
  ReviewHostVerificationRequestSchema,
  createSuccessResponse,
  SYSTEM_PERMISSIONS
} from "@luggage-storage/contracts";
import { hostVerificationService } from "./host-verification.service.js";

export async function hostVerificationRoutes(app: FastifyInstance): Promise<void> {
  // 1. Host verifications moderation queue
  app.get<{ Querystring: { page?: number; limit?: number; status?: string } }>(
    "/verifications",
    {
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.ADMIN_HOST_READ)
      ],
      schema: {
        description: "Retrieve host verification applications for Superadmin & Support moderation",
        tags: ["Admin Host Verification"],
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
      const parsed = HostVerificationQueueQuerySchema.parse(request.query ?? {});
      const offset = (parsed.page - 1) * parsed.limit;

      const result = await hostVerificationService.getPendingVerifications(
        parsed.limit,
        offset,
        parsed.status
      );
      return reply.status(200).send(createSuccessResponse(result, request.id));
    }
  );

  // 2. Full verification application details
  app.get<{ Params: { verificationId: string } }>(
    "/verifications/:verificationId",
    {
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.ADMIN_HOST_READ)
      ],
      schema: {
        description: "Retrieve comprehensive host verification details and document metadata",
        tags: ["Admin Host Verification"],
        params: {
          type: "object",
          required: ["verificationId"],
          properties: {
            verificationId: { type: "string", format: "uuid" }
          }
        }
      }
    },
    async (request, reply) => {
      const { verificationId } = request.params;
      const result = await hostVerificationService.getVerificationDetails(verificationId, {
        adminId: request.user!.sub,
        adminRoles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse(result, request.id));
    }
  );

  // 3. Moderate verification application (Approve / Reject / Request Info)
  app.post<{ Params: { verificationId: string } }>(
    "/verifications/:verificationId/review",
    {
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.ADMIN_HOST_VERIFY)
      ],
      schema: {
        description: "Approve, reject, or request further information on a host verification application",
        tags: ["Admin Host Verification"],
        params: {
          type: "object",
          required: ["verificationId"],
          properties: {
            verificationId: { type: "string", format: "uuid" }
          }
        }
      }
    },
    async (request, reply) => {
      const { verificationId } = request.params;
      const body = ReviewHostVerificationRequestSchema.parse(request.body);
      const result = await hostVerificationService.reviewVerification(verificationId, body, {
        adminId: request.user!.sub,
        adminRoles: request.user!.roles,
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
