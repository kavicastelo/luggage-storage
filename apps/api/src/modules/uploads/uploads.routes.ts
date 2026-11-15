import { FastifyInstance } from "fastify";
import {
  InitiateUploadRequestSchema,
  ConfirmUploadRequestSchema,
  MAX_FILE_SIZE_BYTES,
  createSuccessResponse,
  SYSTEM_PERMISSIONS
} from "@luggage-storage/contracts";
import { env } from "../../config/env.js";
import { AppError } from "../../common/errors/app-error.js";
import { uploadsService } from "./uploads.service.js";
import { storageService } from "./storage.service.js";

function normalizeMockFileKey(rawParam: string | undefined): string | null {
  if (!rawParam) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawParam);
  } catch {
    return null;
  }
  const normalized = decoded.replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || normalized.includes("\\")) {
    return null;
  }
  return normalized;
}

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
      preHandler: [
        app.authenticate,
        app.requirePermission(SYSTEM_PERMISSIONS.UPLOAD_INITIATE)
      ],
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
      preHandler: [
        app.authenticate,
        app.requireAnyPermission([
          SYSTEM_PERMISSIONS.HOSTS_VERIFICATION_READ_OWN,
          SYSTEM_PERMISSIONS.ADMIN_HOST_READ
        ])
      ],
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

  // 4. Local/Test HTTP mock storage routes when live R2 is not configured (never active in production)
  if (!storageService.isLiveR2 && env.NODE_ENV !== "production") {
    await app.register(async (mockApp) => {
      mockApp.addContentTypeParser(
        "*",
        { parseAs: "buffer", bodyLimit: Math.max(...Object.values(MAX_FILE_SIZE_BYTES)) },
        (_request, payload, done) => {
          done(null, payload);
        }
      );

      mockApp.put<{ Params: { "*": string }; Querystring: { signature?: string } }>(
        "/mock-storage/*",
        async (request, reply) => {
          const fileKey = normalizeMockFileKey(request.params["*"]);
          if (!fileKey) {
            throw AppError.badRequest("Invalid upload storage key");
          }

          const rawContentType = request.headers["content-type"];
          const mimeType =
            typeof rawContentType === "string"
              ? rawContentType.split(";")[0]!.trim()
              : "application/octet-stream";

          const bodyBuffer = Buffer.isBuffer(request.body)
            ? request.body
            : Buffer.from(typeof request.body === "string" ? request.body : "");

          if (bodyBuffer.byteLength === 0) {
            throw AppError.badRequest("Empty upload payload is not permitted");
          }

          storageService.putObjectBuffer?.(fileKey, {
            buffer: bodyBuffer,
            mimeType
          });

          return reply.status(200).send({
            ok: true,
            fileKey,
            size: bodyBuffer.byteLength,
            mimeType
          });
        }
      );

      mockApp.get<{ Params: { "*": string }; Querystring: { token?: string } }>(
        "/mock-storage/*",
        async (request, reply) => {
          const fileKey = normalizeMockFileKey(request.params["*"]);
          if (!fileKey) {
            throw AppError.badRequest("Invalid storage key");
          }

          if (
            (fileKey.startsWith("verifications/") || fileKey.startsWith("custody/")) &&
            request.query?.token !== "mock-read-token"
          ) {
            throw AppError.forbidden("Valid download token required for protected storage documents");
          }

          const obj = storageService.getObjectBuffer?.(fileKey);
          if (!obj) {
            throw AppError.notFound("Mock storage object not found");
          }

          reply.header("Content-Type", obj.mimeType || "application/octet-stream");
          reply.header("Content-Length", String(obj.size));
          return reply.status(200).send(obj.buffer);
        }
      );

      mockApp.get<{ Params: { "*": string } }>(
        "/public/*",
        async (request, reply) => {
          const fileKey = normalizeMockFileKey(request.params["*"]);
          if (!fileKey) {
            throw AppError.badRequest("Invalid public storage key");
          }

          if (!fileKey.startsWith("locations/")) {
            throw AppError.forbidden("Access to non-public storage path is forbidden");
          }

          const obj = storageService.getObjectBuffer?.(fileKey);
          if (!obj) {
            throw AppError.notFound("Public storage object not found");
          }

          reply.header("Content-Type", obj.mimeType || "application/octet-stream");
          reply.header("Cache-Control", "public, max-age=300");
          return reply.status(200).send(obj.buffer);
        }
      );
    });
  }
}
