import { eq, desc, sql, count } from "drizzle-orm";
import {
  ReviewHostVerificationRequest,
  HostVerification,
  HostVerificationQueueItem,
  SecurityEventType
} from "@luggage-storage/contracts";
import { db, schema } from "../../infrastructure/database/drizzle.js";
import { AppError } from "../../common/errors/app-error.js";
import { auditService } from "../audit/audit.service.js";

export interface AdminVerificationContext {
  adminId: string;
  adminRoles: string[];
  clientInfo?: {
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  };
}

export class HostVerificationService {
  /**
   * Retrieves the moderation queue of pending host verifications.
   */
  async getPendingVerifications(limit = 20, offset = 0): Promise<{
    queue: HostVerificationQueueItem[];
    total: number;
  }> {
    const rows = await db
      .select({
        verificationId: schema.hostVerifications.id,
        businessId: schema.hostVerifications.businessId,
        legalBusinessName: schema.hostBusinesses.legalBusinessName,
        tradeName: schema.hostBusinesses.tradeName,
        entityType: schema.hostBusinesses.entityType,
        ownerEmail: schema.users.email,
        ownerDisplayName: schema.users.displayName,
        status: schema.hostVerifications.status,
        submittedAt: schema.hostVerifications.submittedAt
      })
      .from(schema.hostVerifications)
      .innerJoin(
        schema.hostBusinesses,
        eq(schema.hostVerifications.businessId, schema.hostBusinesses.id)
      )
      .innerJoin(
        schema.users,
        eq(schema.hostBusinesses.ownerUserId, schema.users.id)
      )
      .where(eq(schema.hostVerifications.status, "PENDING_REVIEW"))
      .orderBy(desc(schema.hostVerifications.submittedAt))
      .limit(limit)
      .offset(offset);

    const [totalRes] = await db
      .select({ val: count() })
      .from(schema.hostVerifications)
      .where(eq(schema.hostVerifications.status, "PENDING_REVIEW"));

    // Enrich with document counts
    const queue: HostVerificationQueueItem[] = [];
    for (const r of rows) {
      const [docCountRes] = await db
        .select({ val: count() })
        .from(schema.hostVerificationDocuments)
        .where(eq(schema.hostVerificationDocuments.verificationId, r.verificationId));

      queue.push({
        verificationId: r.verificationId,
        businessId: r.businessId,
        legalBusinessName: r.legalBusinessName,
        tradeName: r.tradeName,
        entityType: r.entityType as any,
        ownerEmail: r.ownerEmail,
        ownerDisplayName: r.ownerDisplayName,
        status: r.status as any,
        documentCount: docCountRes?.val ?? 0,
        submittedAt: r.submittedAt.toISOString()
      });
    }

    return {
      queue,
      total: totalRes?.val ?? 0
    };
  }

  /**
   * Retrieves complete verification details with attached documents.
   */
  async getVerificationDetails(
    verificationId: string,
    _context: AdminVerificationContext
  ): Promise<HostVerification> {
    const [verif] = await db
      .select()
      .from(schema.hostVerifications)
      .where(eq(schema.hostVerifications.id, verificationId))
      .limit(1);

    if (!verif) {
      throw AppError.notFound("Host verification submission not found");
    }

    const docs = await db
      .select()
      .from(schema.hostVerificationDocuments)
      .where(eq(schema.hostVerificationDocuments.verificationId, verif.id));

    return {
      id: verif.id,
      businessId: verif.businessId,
      submittedBy: verif.submittedBy,
      status: verif.status as any,
      reviewerUserId: verif.reviewerUserId,
      reviewedAt: verif.reviewedAt ? verif.reviewedAt.toISOString() : null,
      rejectionReason: verif.rejectionReason,
      adminNotes: verif.adminNotes,
      submittedAt: verif.submittedAt.toISOString(),
      createdAt: verif.createdAt.toISOString(),
      updatedAt: verif.updatedAt.toISOString(),
      documents: docs.map((d) => ({
        id: d.id,
        verificationId: d.verificationId,
        documentType: d.documentType as any,
        fileKey: d.fileKey,
        fileName: d.fileName,
        fileSize: d.fileSize,
        mimeType: d.mimeType,
        status: d.status as any,
        rejectionReason: d.rejectionReason,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString()
      }))
    };
  }

  /**
   * Performs Superadmin moderation of a Host verification application.
   * Invariant: A host owner CANNOT review or approve their own verification application.
   */
  async reviewVerification(
    verificationId: string,
    review: ReviewHostVerificationRequest,
    context: AdminVerificationContext
  ): Promise<HostVerification> {
    const [verif] = await db
      .select({
        id: schema.hostVerifications.id,
        businessId: schema.hostVerifications.businessId,
        submittedBy: schema.hostVerifications.submittedBy,
        status: schema.hostVerifications.status,
        ownerUserId: schema.hostBusinesses.ownerUserId
      })
      .from(schema.hostVerifications)
      .innerJoin(
        schema.hostBusinesses,
        eq(schema.hostVerifications.businessId, schema.hostBusinesses.id)
      )
      .where(eq(schema.hostVerifications.id, verificationId))
      .limit(1);

    if (!verif) {
      throw AppError.notFound("Host verification submission not found");
    }

    // Security Invariant: Host cannot review own business
    if (verif.ownerUserId === context.adminId) {
      await auditService.recordEvent({
        eventType: SecurityEventType.AUTH_ACCESS_DENIED,
        userId: context.adminId,
        clientInfo: context.clientInfo,
        metadata: {
          action: "SELF_VERIFICATION_ATTEMPT",
          verificationId,
          businessId: verif.businessId
        }
      });
      throw AppError.forbidden("Security violation: Host owners cannot review their own verification");
    }

    let nextVerifStatus: "APPROVED" | "REJECTED" | "INFORMATION_REQUESTED";
    let nextBusinessStatus: "ACTIVE" | "REJECTED" | "PENDING_VERIFICATION";
    let auditEventType: string;

    if (review.decision === "APPROVE") {
      nextVerifStatus = "APPROVED";
      nextBusinessStatus = "ACTIVE";
      auditEventType = SecurityEventType.HOST_VERIFICATION_APPROVED;
    } else if (review.decision === "REJECT") {
      nextVerifStatus = "REJECTED";
      nextBusinessStatus = "REJECTED";
      auditEventType = SecurityEventType.HOST_VERIFICATION_REJECTED;
    } else {
      nextVerifStatus = "INFORMATION_REQUESTED";
      nextBusinessStatus = "PENDING_VERIFICATION";
      auditEventType = SecurityEventType.HOST_VERIFICATION_INFO_REQUESTED;
    }

    const reviewed = await db.transaction(async (tx) => {
      // 1. Update verification record
      const [updatedVerif] = await tx
        .update(schema.hostVerifications)
        .set({
          status: nextVerifStatus,
          reviewerUserId: context.adminId,
          reviewedAt: new Date(),
          rejectionReason: review.rejectionReason || null,
          adminNotes: review.adminNotes || null,
          updatedAt: new Date()
        })
        .where(eq(schema.hostVerifications.id, verificationId))
        .returning();

      // 2. Update business status
      await tx
        .update(schema.hostBusinesses)
        .set({
          status: nextBusinessStatus,
          updatedAt: new Date()
        })
        .where(eq(schema.hostBusinesses.id, verif.businessId));

      // 3. If approved, update documents status to VERIFIED
      if (review.decision === "APPROVE") {
        await tx
          .update(schema.hostVerificationDocuments)
          .set({ status: "VERIFIED", updatedAt: new Date() })
          .where(eq(schema.hostVerificationDocuments.verificationId, verificationId));
      }

      // 4. Audit logging
      await auditService.recordEvent({
        eventType: auditEventType,
        userId: context.adminId,
        clientInfo: context.clientInfo,
        tx,
        metadata: {
          verificationId,
          businessId: verif.businessId,
          decision: review.decision,
          rejectionReason: review.rejectionReason || null
        }
      });

      return updatedVerif;
    });

    const docs = await db
      .select()
      .from(schema.hostVerificationDocuments)
      .where(eq(schema.hostVerificationDocuments.verificationId, reviewed.id));

    return {
      id: reviewed.id,
      businessId: reviewed.businessId,
      submittedBy: reviewed.submittedBy,
      status: reviewed.status as any,
      reviewerUserId: reviewed.reviewerUserId,
      reviewedAt: reviewed.reviewedAt ? reviewed.reviewedAt.toISOString() : null,
      rejectionReason: reviewed.rejectionReason,
      adminNotes: reviewed.adminNotes,
      submittedAt: reviewed.submittedAt.toISOString(),
      createdAt: reviewed.createdAt.toISOString(),
      updatedAt: reviewed.updatedAt.toISOString(),
      documents: docs.map((d) => ({
        id: d.id,
        verificationId: d.verificationId,
        documentType: d.documentType as any,
        fileKey: d.fileKey,
        fileName: d.fileName,
        fileSize: d.fileSize,
        mimeType: d.mimeType,
        status: d.status as any,
        rejectionReason: d.rejectionReason,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString()
      }))
    };
  }
}

export const hostVerificationService = new HostVerificationService();

