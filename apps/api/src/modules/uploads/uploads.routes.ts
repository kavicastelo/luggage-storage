import { FastifyInstance } from "fastify";
import {
  InitiateUploadRequestSchema,
  ConfirmUploadRequestSchema,
  createSuccessResponse,
  SYSTEM_PERMISSIONS
} from "@luggage-storage/contracts";
import { uploadsService } from "./uploads.service.js";

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  // 1. Initiate upload (obtain pre-signed upload URL)
  app.post(
    "/presigned-url",
    {
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.UPLOAD_INITIATE)
      ],
      schema: {
        description: "Initiate a secure file upload by requesting a pre-signed URL",
        tags: ["Uploads"]
      }
    },
    async (request, reply) => {
      const body = InitiateUploadRequestSchema.parse(request.body);
      const result = await uploadsService.initiateUpload(body, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse(result, request.id));
    }
  );

  // 2. Confirm upload and attach to resource
  app.post(
    "/confirm",
    {
      preHandler: [app.authenticate],
      schema: {
        description: "Confirm upload completion and associate media with storage resource",
        tags: ["Uploads"]
      }
    },
    async (request, reply) => {
      const body = ConfirmUploadRequestSchema.parse(request.body);
      const result = await uploadsService.confirmUpload(body, {
        userId: request.user!.sub,
        roles: request.user!.roles,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        }
      });

      return reply.status(200).send(createSuccessResponse(result, request.id));
    }
  );

  // 3. Authorized verification document download
  app.get<{ Params: { documentId: string } }>(
    "/documents/:documentId/download",
    {
      preHandler: [app.authenticate],
      schema: {
        description: "Generate an authorized temporary pre-signed URL to inspect a verification document",
        tags: ["Uploads"],
        params: {
          type: "object",
          required: ["documentId"],
          properties: {
            documentId: { type: "string", format: "uuid" }
          }
        }
      }
    },
    async (request, reply) => {
      const { documentId } = request.params;
      const result = await uploadsService.getAuthorizedDocumentDownloadUrl(documentId, {
        userId: request.user!.sub,
        roles: request.user!.roles,
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
