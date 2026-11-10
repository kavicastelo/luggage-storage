import { randomUUID } from "node:crypto";
import { eq, and, sql } from "drizzle-orm";
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
   * Generates a pre-signed upload URL bound to a durable database-backed upload intent.
   * Strictly enforces user role, resource ownership, resource lifecycle state,
   * allowed MIME types, and maximum file sizes.
   */
  async initiateUpload(
    request: InitiateUploadRequest,
    context: UploadContext
  ): Promise<InitiateUploadResponse> {
    const isSuperadmin = context.roles.includes("SUPERADMIN");
    const targetResourceId = request.resourceId || request.referenceId;

    if (!targetResourceId) {
      throw AppError.badRequest("Target resourceId is required for upload authorization");
    }

    const sanitizedFileName = request.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const intentId = randomUUID();
    let fileKey: string;
    let resourceType: "HOST_BUSINESS" | "STORAGE_LOCATION";

    if (request.purpose === "HOST_VERIFICATION") {
      // 1. Authorize: Only HOST_OWNER or SUPERADMIN can upload verification documents
      const hasHostPrivilege = context.roles.includes("HOST_OWNER") || isSuperadmin;
      if (!hasHostPrivilege) {
        throw AppError.forbidden("Access denied: Only host owners can initiate host verification uploads");
      }

      // 2. Validate resource ownership and state
      const [business] = await db
        .select()
        .from(schema.hostBusinesses)
        .where(eq(schema.hostBusinesses.id, targetResourceId))
        .limit(1);

      if (!business) {
        throw AppError.notFound("Host business not found");
      }

      if (business.ownerUserId !== context.userId && !isSuperadmin) {
        throw AppError.forbidden("Access denied: You do not own this host business");
      }

      if (business.status === "ACTIVE") {
        throw AppError.badRequest("Host business is already verified and active; new verification uploads are not permitted");
      }

      if (business.status === "SUSPENDED" || business.status === "REJECTED") {
        throw AppError.badRequest(`Cannot submit verification documents for a ${business.status.toLowerCase()} business`);
      }

      resourceType = "HOST_BUSINESS";
      fileKey = `verifications/${business.id}/${intentId}-${sanitizedFileName}`;
    } else if (request.purpose === "LOCATION_IMAGE") {
      // 1. Authorize: Only location owners or SUPERADMIN can upload location media
      const [location] = await db
        .select({
          id: schema.storageLocations.id,
          businessId: schema.storageLocations.businessId,
          status: schema.storageLocations.status,
          ownerUserId: schema.hostBusinesses.ownerUserId,
          businessStatus: schema.hostBusinesses.status
        })
        .from(schema.storageLocations)
        .innerJoin(
          schema.hostBusinesses,
          eq(schema.storageLocations.businessId, schema.hostBusinesses.id)
        )
        .where(eq(schema.storageLocations.id, targetResourceId))
        .limit(1);

      if (!location) {
        throw AppError.notFound("Storage location not found");
      }

      if (location.ownerUserId !== context.userId && !isSuperadmin) {
        throw AppError.forbidden("Access denied: You do not own this storage location");
      }

      if (location.status === "DISABLED" || location.businessStatus === "SUSPENDED") {
        throw AppError.badRequest("Cannot upload images to a disabled location or suspended business");
      }

      resourceType = "STORAGE_LOCATION";
      fileKey = `locations/${location.id}/${intentId}-${sanitizedFileName}`;
    } else {
      throw AppError.badRequest("Unsupported upload purpose");
    }

    const expiresInSeconds = 900; // 15 minutes
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    // 3. Create durable upload intent in database
    const [intent] = await db
      .insert(schema.uploadIntents)
      .values({
        id: intentId,
        userId: context.userId,
        purpose: request.purpose,
        resourceType,
        resourceId: targetResourceId,
        fileKey,
        fileName: sanitizedFileName,
        mimeType: request.mimeType,
        maxFileSize: request.fileSize,
        status: "PENDING",
        expiresAt
      })
      .returning();

    // 4. Generate pre-signed upload URL from storage adapter
    const { uploadUrl } = await this.storage.generatePresignedUploadUrl({
      fileKey,
      mimeType: request.mimeType,
      fileSize: request.fileSize,
      expiresInSeconds
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
        intentId: intent.id,
        purpose: request.purpose,
        fileKey,
        mimeType: request.mimeType,
        fileSize: request.fileSize,
        resourceType,
        resourceId: targetResourceId
      }
    });

    return {
      intentId: intent.id,
      uploadUrl,
      fileKey,
      expiresInSeconds,
      ...(publicUrl ? { publicUrl } : {})
    };
  }

  /**
   * Confirms an upload against a durable database-backed intent.
   * Verifies intent validity, uploader identity, key match, and actual storage object existence.
   */
  async confirmUpload(
    request: ConfirmUploadRequest,
    context: UploadContext
  ): Promise<ConfirmUploadResponse> {
    const isSuperadmin = context.roles.includes("SUPERADMIN");

    // 1. Resolve upload intent from database
    const intentQuery = request.intentId
      ? eq(schema.uploadIntents.id, request.intentId)
      : eq(schema.uploadIntents.fileKey, request.fileKey);

    const [intent] = await db
      .select()
      .from(schema.uploadIntents)
      .where(intentQuery)
      .limit(1);

    if (!intent) {
      throw AppError.notFound("Upload intent not found. Client cannot confirm arbitrary file keys without a valid intent.");
    }

    // 2. Verify ownership
    if (intent.userId !== context.userId && !isSuperadmin) {
      throw AppError.forbidden("Access denied: This upload intent belongs to another user");
    }

    // 3. Verify key and resource alignment
    if (intent.fileKey !== request.fileKey) {
      throw AppError.badRequest("Supplied fileKey does not match the server-generated key for this upload intent");
    }

    const expectedResourceId = request.resourceId || request.referenceId;
    if (expectedResourceId && intent.resourceId && expectedResourceId !== intent.resourceId) {
      throw AppError.badRequest("Target resource does not match the resource registered on this upload intent");
    }

    if (request.purpose && intent.purpose !== request.purpose) {
      throw AppError.badRequest("Upload purpose does not match the purpose registered on this upload intent");
    }

    // 4. Handle idempotency and terminal states before storage checks
    if (intent.status === "CONSUMED") {
      if (intent.purpose === "LOCATION_IMAGE") {
        const [existingMedia] = await db
          .select()
          .from(schema.locationMedia)
          .where(eq(schema.locationMedia.fileKey, intent.fileKey))
          .limit(1);

        if (existingMedia) {
          return {
            success: true,
            intentId: intent.id,
            id: existingMedia.id,
            fileKey: intent.fileKey,
            url: existingMedia.url,
            message: "Upload is already confirmed"
          };
        }
      }
      throw AppError.conflict("Upload intent has already been consumed and cannot be reused");
    }

    if (intent.status === "CONFIRMED") {
      if (intent.purpose === "LOCATION_IMAGE") {
        const [existingMedia] = await db
          .select()
          .from(schema.locationMedia)
          .where(eq(schema.locationMedia.fileKey, intent.fileKey))
          .limit(1);

        if (existingMedia) {
          return {
            success: true,
            intentId: intent.id,
            id: existingMedia.id,
            fileKey: intent.fileKey,
            url: existingMedia.url,
            message: "Upload is already confirmed"
          };
        }
      }
      return {
        success: true,
        intentId: intent.id,
        fileKey: intent.fileKey,
        message: "Upload is already confirmed"
      };
    }

    if (intent.status !== "PENDING") {
      throw AppError.badRequest(`Cannot confirm upload intent with status '${intent.status}'`);
    }

    if (new Date() > intent.expiresAt) {
      await db
        .update(schema.uploadIntents)
        .set({ status: "EXPIRED", updatedAt: new Date() })
        .where(eq(schema.uploadIntents.id, intent.id));

      throw AppError.badRequest("Upload intent has expired. Please initiate a fresh upload request.");
    }

    // 5. Verify object existence and metadata in durable storage (Cloudflare R2 or Storage Adapter)
    const meta = await this.storage.getObjectMetadata(intent.fileKey);
    if (!meta.exists) {
      throw AppError.badRequest(
        "Uploaded object does not exist in object storage. Ensure the file has been uploaded via the pre-signed URL before confirming."
      );
    }

    if (meta.contentLength === undefined || meta.contentLength <= 0) {
      throw AppError.badRequest(
        "Uploaded object is empty (0 bytes). Uploaded files must have positive length."
      );
    }

    if (meta.contentLength > intent.maxFileSize) {
      throw AppError.badRequest(
        `Uploaded object size (${meta.contentLength} bytes) exceeds the authorized maximum file size limit (${intent.maxFileSize} bytes)`
      );
    }

    if (meta.contentType) {
      const actualMime = meta.contentType.split(";")[0].trim().toLowerCase();
      const expectedMime = intent.mimeType.split(";")[0].trim().toLowerCase();
      if (actualMime !== expectedMime) {
        throw AppError.badRequest(
          `Uploaded object content type '${meta.contentType}' does not match the authorized MIME type '${intent.mimeType}' for this upload intent`
        );
      }
    }

    // 6. Execute state transition and resource association atomically under row lock
    return db.transaction(async (tx) => {
      const lockRes = await tx.execute(
        sql`SELECT * FROM upload_intents WHERE id = ${intent.id}::uuid FOR UPDATE;`
      );
      const locked = lockRes.rows[0] as any;

      if (!locked) {
        throw AppError.notFound("Upload intent not found");
      }

      // Replay prevention & safe idempotency under row lock
      if (locked.status === "CONSUMED") {
        if (intent.purpose === "LOCATION_IMAGE") {
          const [existingMedia] = await tx
            .select()
            .from(schema.locationMedia)
            .where(eq(schema.locationMedia.fileKey, intent.fileKey))
            .limit(1);

          if (existingMedia) {
            return {
              success: true,
              intentId: intent.id,
              id: existingMedia.id,
              fileKey: intent.fileKey,
              url: existingMedia.url,
              message: "Upload is already confirmed"
            };
          }
        }
        throw AppError.conflict("Upload intent has already been consumed and cannot be reused");
      }

      if (locked.status === "CONFIRMED") {
        if (intent.purpose === "LOCATION_IMAGE") {
          const [existingMedia] = await tx
            .select()
            .from(schema.locationMedia)
            .where(eq(schema.locationMedia.fileKey, intent.fileKey))
            .limit(1);

          if (existingMedia) {
            return {
              success: true,
              intentId: intent.id,
              id: existingMedia.id,
              fileKey: intent.fileKey,
              url: existingMedia.url,
              message: "Upload is already confirmed"
            };
          }
        }
        return {
          success: true,
          intentId: intent.id,
          fileKey: intent.fileKey,
          message: "Upload is already confirmed"
        };
      }

      if (locked.status !== "PENDING") {
        throw AppError.badRequest(`Cannot confirm upload intent with status '${locked.status}'`);
      }

      if (new Date() > new Date(locked.expires_at)) {
        await tx
          .update(schema.uploadIntents)
          .set({ status: "EXPIRED", updatedAt: new Date() })
          .where(eq(schema.uploadIntents.id, intent.id));

        throw AppError.badRequest("Upload intent has expired. Please initiate a fresh upload request.");
      }

      // 7. Associate with resource and update intent status atomically
      if (intent.purpose === "LOCATION_IMAGE" && intent.resourceId) {
        const publicUrl =
          this.storage.getPublicUrl?.(intent.fileKey) ||
          `https://storage.luggagestorage.lk/${intent.fileKey}`;

        // Idempotently check if media already inserted
        const [existingMedia] = await tx
          .select()
          .from(schema.locationMedia)
          .where(eq(schema.locationMedia.fileKey, intent.fileKey))
          .limit(1);

        let mediaId: string;
        let mediaUrl: string;

        if (existingMedia) {
          mediaId = existingMedia.id;
          mediaUrl = existingMedia.url;
        } else {
          const [inserted] = await tx
            .insert(schema.locationMedia)
            .values({
              locationId: intent.resourceId,
              fileKey: intent.fileKey,
              url: publicUrl,
              mediaType: "IMAGE",
              caption: request.caption || null,
              isPrimary: request.isPrimary ?? false
            })
            .returning();
          mediaId = inserted.id;
          mediaUrl = inserted.url;
        }

        // For location images, associating consumes the intent atomically
        await tx
          .update(schema.uploadIntents)
          .set({
            status: "CONSUMED",
            confirmedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(schema.uploadIntents.id, intent.id));

        await auditService.recordEvent({
          eventType: SecurityEventType.UPLOAD_MEDIA_CONFIRMED,
          userId: context.userId,
          clientInfo: context.clientInfo,
          tx,
          metadata: {
            intentId: intent.id,
            locationId: intent.resourceId,
            fileKey: intent.fileKey,
            mediaId
          }
        });

        return {
          success: true,
          intentId: intent.id,
          id: mediaId,
          fileKey: intent.fileKey,
          url: mediaUrl,
          message: "Location image confirmed and linked successfully"
        };
      }

      // For HOST_VERIFICATION, mark CONFIRMED (consumed during verification submission)
      await tx
        .update(schema.uploadIntents)
        .set({
          status: "CONFIRMED",
          confirmedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(schema.uploadIntents.id, intent.id));

      await auditService.recordEvent({
        eventType: SecurityEventType.UPLOAD_MEDIA_CONFIRMED,
        userId: context.userId,
        clientInfo: context.clientInfo,
        tx,
        metadata: {
          intentId: intent.id,
          purpose: intent.purpose,
          fileKey: intent.fileKey,
          resourceId: intent.resourceId
        }
      });

      return {
        success: true,
        intentId: intent.id,
        fileKey: intent.fileKey,
        message: "Verification document upload confirmed successfully"
      };
    });
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
