import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import {
  InitiateUploadRequest,
  InitiateUploadResponse,
  ConfirmUploadRequest,
  ConfirmUploadResponse,
  SecurityEventType
} from "@luggage-storage/contracts";
import { db, schema } from "../../infrastructure/database/drizzle.js";
import { AppError } from "../../common/errors/app-error.js";
import { storageService, StoragePort } from "./storage.service.js";
import { auditService } from "../audit/audit.service.js";

export interface UploadContext {
  userId: string;
  roles: string[];
  clientInfo?: {
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  };
}

export class UploadsService {
  constructor(private readonly storage: StoragePort = storageService) {}

  /**
   * Generates a pre-signed upload URL for authorized clients.
   * Validates MIME type, file size limit, and assigns a randomized object key.
   */
  async initiateUpload(
    request: InitiateUploadRequest,
    context: UploadContext
  ): Promise<InitiateUploadResponse> {
    const sanitizedFileName = request.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueId = randomUUID();

    let fileKey: string;
    if (request.purpose === "HOST_VERIFICATION") {
      const scopeId = request.referenceId || context.userId;
      fileKey = `verifications/${scopeId}/${uniqueId}-${sanitizedFileName}`;
    } else {
      const scopeId = request.referenceId || "unassigned";
      fileKey = `locations/${scopeId}/${uniqueId}-${sanitizedFileName}`;
    }

    const { uploadUrl, expiresInSeconds } = await this.storage.generatePresignedUploadUrl({
      fileKey,
      mimeType: request.mimeType,
      fileSize: request.fileSize
    });

    const publicUrl =
      request.purpose === "LOCATION_IMAGE" && this.storage.getPublicUrl
        ? this.storage.getPublicUrl(fileKey)
        : undefined;

    await auditService.recordEvent({
      eventType: SecurityEventType.UPLOAD_URL_GENERATED,
      userId: context.userId,
      clientInfo: context.clientInfo,
      metadata: {
        purpose: request.purpose,
        fileKey,
        mimeType: request.mimeType,
        fileSize: request.fileSize,
        referenceId: request.referenceId || null
      }
    });

    return {
      uploadUrl,
      fileKey,
      expiresInSeconds,
      ...(publicUrl ? { publicUrl } : {})
    };
  }

  /**
   * Confirms an upload and associates the media with its resource.
   */
  async confirmUpload(
    request: ConfirmUploadRequest,
    context: UploadContext
  ): Promise<ConfirmUploadResponse> {
    if (request.purpose === "LOCATION_IMAGE") {
      // 1. Verify location exists and caller is authorized owner or superadmin
      const [location] = await db
        .select({
          id: schema.storageLocations.id,
          businessId: schema.storageLocations.businessId,
          ownerUserId: schema.hostBusinesses.ownerUserId
        })
        .from(schema.storageLocations)
        .innerJoin(
          schema.hostBusinesses,
          eq(schema.storageLocations.businessId, schema.hostBusinesses.id)
        )
        .where(eq(schema.storageLocations.id, request.referenceId))
        .limit(1);

      if (!location) {
        throw AppError.notFound("Storage location not found");
      }

      const isSuperadmin = context.roles.includes("SUPERADMIN");
      if (location.ownerUserId !== context.userId && !isSuperadmin) {
        throw AppError.forbidden("Access denied: You do not own this storage location");
      }

      const publicUrl =
        this.storage.getPublicUrl?.(request.fileKey) ||
        `https://storage.luggagestorage.lk/${request.fileKey}`;

      // 2. Insert into location_media
      const [media] = await db
        .insert(schema.locationMedia)
        .values({
          locationId: location.id,
          fileKey: request.fileKey,
          url: publicUrl,
          mediaType: "IMAGE",
          caption: request.caption || null,
          isPrimary: request.isPrimary ?? false
        })
        .returning();

      await auditService.recordEvent({
        eventType: SecurityEventType.UPLOAD_MEDIA_CONFIRMED,
        userId: context.userId,
        clientInfo: context.clientInfo,
        metadata: {
          locationId: location.id,
          fileKey: request.fileKey,
          mediaId: media.id
        }
      });

      return {
        success: true,
        id: media.id,
        fileKey: media.fileKey,
        url: media.url,
        message: "Location image confirmed and linked successfully"
      };
    }

    if (request.purpose === "HOST_VERIFICATION") {
      // Handled directly or verified during verification submission
      return {
        success: true,
        id: randomUUID(),
        fileKey: request.fileKey,
        message: "Verification document upload confirmed"
      };
    }

    throw AppError.badRequest("Unsupported upload purpose");
  }

  /**
   * Generates a secure, temporary pre-signed URL to view a verification document.
   * Access is strictly restricted to the document's host owner or authorized Superadmin/Support.
   */
  async getAuthorizedDocumentDownloadUrl(
    documentId: string,
    context: UploadContext
  ): Promise<{ downloadUrl: string; fileName: string; mimeType: string }> {
    const [doc] = await db
      .select({
        id: schema.hostVerificationDocuments.id,
        fileKey: schema.hostVerificationDocuments.fileKey,
        fileName: schema.hostVerificationDocuments.fileName,
        mimeType: schema.hostVerificationDocuments.mimeType,
        businessId: schema.hostVerifications.businessId,
        ownerUserId: schema.hostBusinesses.ownerUserId
      })
      .from(schema.hostVerificationDocuments)
      .innerJoin(
        schema.hostVerifications,
        eq(schema.hostVerificationDocuments.verificationId, schema.hostVerifications.id)
      )
      .innerJoin(
        schema.hostBusinesses,
        eq(schema.hostVerifications.businessId, schema.hostBusinesses.id)
      )
      .where(eq(schema.hostVerificationDocuments.id, documentId))
      .limit(1);

    if (!doc) {
      throw AppError.notFound("Verification document not found");
    }

    const isAdmin = context.roles.some((r) => ["SUPERADMIN", "SUPPORT"].includes(r));
    if (doc.ownerUserId !== context.userId && !isAdmin) {
      throw AppError.forbidden("Access denied: You do not have permission to access this document");
    }

    const downloadUrl = await this.storage.generatePresignedDownloadUrl({
      fileKey: doc.fileKey,
      expiresInSeconds: 900 // 15 minutes
    });

    await auditService.recordEvent({
      eventType: SecurityEventType.DOCUMENT_ACCESSED,
      userId: context.userId,
      clientInfo: context.clientInfo,
      metadata: {
        documentId: doc.id,
        fileKey: doc.fileKey,
        businessId: doc.businessId
      }
    });

    return {
      downloadUrl,
      fileName: doc.fileName,
      mimeType: doc.mimeType
    };
  }
}

export const uploadsService = new UploadsService();

