import { eq, and, desc, sql } from "drizzle-orm";
import {
  CreateHostBusinessRequest,
  UpdateHostBusinessRequest,
  SubmitHostVerificationRequest,
  HostBusiness,
  HostVerification,
  SecurityEventType
} from "@luggage-storage/contracts";
import { db, schema } from "../../infrastructure/database/drizzle.js";
import { AppError } from "../../common/errors/app-error.js";
import { auditService } from "../audit/audit.service.js";
import {
  encryptPayoutAccountNumber,
  decryptPayoutAccountNumber,
  maskPayoutAccountNumber
} from "../../common/crypto/payout-encryption.js";

export interface HostContext {
  userId: string;
  roles: string[];
  clientInfo?: {
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  };
}

export class HostsService {
  /**
   * Registers a new Host Business owned by the authenticated user.
   * Auto-assigns the HOST_OWNER role to the user via database-verified self-assignment.
   * Encrypts sensitive payout banking details at rest.
   */
  async createBusiness(
    request: CreateHostBusinessRequest,
    context: HostContext
  ): Promise<HostBusiness> {
    const encryptedAccount = encryptPayoutAccountNumber(request.payoutAccountNumber);

    const result = await db.transaction(async (tx) => {
      // 1. Insert Host Business
      const [business] = await tx
        .insert(schema.hostBusinesses)
        .values({
          ownerUserId: context.userId,
          legalBusinessName: request.legalBusinessName,
          tradeName: request.tradeName,
          businessRegistrationNumber: request.businessRegistrationNumber || null,
          entityType: request.entityType || "SOLE_PROPRIETORSHIP",
          taxIdentifier: request.taxIdentifier || null,
          contactEmail: request.contactEmail,
          contactPhone: request.contactPhone,
          addressLine1: request.addressLine1 || null,
          addressLine2: request.addressLine2 || null,
          city: request.city || null,
          postalCode: request.postalCode || null,
          countryCode: request.countryCode || "LK",
          payoutBankName: request.payoutBankName || null,
          payoutAccountNumber: encryptedAccount,
          payoutAccountName: request.payoutAccountName || null,
          payoutBranchCode: request.payoutBranchCode || null,
          status: "DRAFT"
        })
        .returning();

      // 2. Assign HOST_OWNER role using safe, self-service function (verified by business ownership)
      await tx.execute(
        sql`SELECT public.self_assign_host_owner_role(${context.userId}::uuid);`
      );

      // 3. Ensure host_profiles entry exists
      await tx
        .insert(schema.hostProfiles)
        .values({
          userId: context.userId,
          displayName: request.tradeName,
          contactEmail: request.contactEmail,
          contactPhone: request.contactPhone,
          hostType: request.entityType === "SOLE_PROPRIETORSHIP" ? "INDIVIDUAL" : "BUSINESS",
          status: "PENDING_ONBOARDING"
        })
        .onConflictDoNothing();

      // 4. Record audit event (banking details masked)
      await auditService.recordEvent({
        eventType: SecurityEventType.HOST_BUSINESS_CREATED,
        userId: context.userId,
        clientInfo: context.clientInfo,
        tx,
        metadata: {
          businessId: business.id,
          legalBusinessName: business.legalBusinessName,
          tradeName: business.tradeName,
          entityType: business.entityType,
          hasPayoutConfigured: Boolean(encryptedAccount)
        }
      });

      return business;
    });

    return this.mapBusinessEntity(result);
  }

  /**
   * Retrieves all businesses owned by the current authenticated user.
   */
  async getOwnedBusinesses(context: HostContext): Promise<HostBusiness[]> {
    const rows = await db
      .select()
      .from(schema.hostBusinesses)
      .where(eq(schema.hostBusinesses.ownerUserId, context.userId))
      .orderBy(desc(schema.hostBusinesses.createdAt));

    const results: HostBusiness[] = [];
    for (const b of rows) {
      const verification = await this.getLatestVerification(b.id);
      results.push(this.mapBusinessEntity(b, verification));
    }
    return results;
  }

  /**
   * Retrieves a single Host Business by ID, enforcing ownership or administrative privilege.
   */
  async getBusinessById(businessId: string, context: HostContext): Promise<HostBusiness> {
    const [business] = await db
      .select()
      .from(schema.hostBusinesses)
      .where(eq(schema.hostBusinesses.id, businessId))
      .limit(1);

    if (!business) {
      throw AppError.notFound("Host business not found");
    }

    const isSuperadmin = context.roles.includes("SUPERADMIN");
    if (business.ownerUserId !== context.userId && !isSuperadmin) {
      throw AppError.forbidden("Access denied: You do not have permission to view this business");
    }

    const verification = await this.getLatestVerification(business.id);
    return this.mapBusinessEntity(business, verification);
  }

  /**
   * Updates host business information.
   * If sensitive business identity fields are changed on an already-ACTIVE business,
   * transitions the business back to PENDING_VERIFICATION to require re-approval.
   */
  async updateBusiness(
    businessId: string,
    request: UpdateHostBusinessRequest,
    context: HostContext
  ): Promise<HostBusiness> {
    const [existing] = await db
      .select()
      .from(schema.hostBusinesses)
      .where(eq(schema.hostBusinesses.id, businessId))
      .limit(1);

    if (!existing) {
      throw AppError.notFound("Host business not found");
    }

    const isSuperadmin = context.roles.includes("SUPERADMIN");
    if (existing.ownerUserId !== context.userId && !isSuperadmin) {
      throw AppError.forbidden("Access denied: You do not own this host business");
    }

    // Check if sensitive legal identity fields are changing on an active business
    const legalNameChanged =
      request.legalBusinessName !== undefined &&
      request.legalBusinessName !== existing.legalBusinessName;
    const brnChanged =
      request.businessRegistrationNumber !== undefined &&
      request.businessRegistrationNumber !== existing.businessRegistrationNumber;

    const requiresReverification =
      existing.status === "ACTIVE" && (legalNameChanged || brnChanged);

    let encryptedAccount: string | null | undefined = undefined;
    if (request.payoutAccountNumber !== undefined) {
      encryptedAccount = encryptPayoutAccountNumber(request.payoutAccountNumber);
    }

    const [updated] = await db
      .update(schema.hostBusinesses)
      .set({
        ...(request.legalBusinessName ? { legalBusinessName: request.legalBusinessName } : {}),
        ...(request.tradeName ? { tradeName: request.tradeName } : {}),
        ...(request.businessRegistrationNumber !== undefined
          ? { businessRegistrationNumber: request.businessRegistrationNumber }
          : {}),
        ...(request.entityType ? { entityType: request.entityType } : {}),
        ...(request.taxIdentifier !== undefined ? { taxIdentifier: request.taxIdentifier } : {}),
        ...(request.contactEmail ? { contactEmail: request.contactEmail } : {}),
        ...(request.contactPhone ? { contactPhone: request.contactPhone } : {}),
        ...(request.addressLine1 !== undefined ? { addressLine1: request.addressLine1 } : {}),
        ...(request.addressLine2 !== undefined ? { addressLine2: request.addressLine2 } : {}),
        ...(request.city !== undefined ? { city: request.city } : {}),
        ...(request.postalCode !== undefined ? { postalCode: request.postalCode } : {}),
        ...(request.countryCode ? { countryCode: request.countryCode } : {}),
        ...(request.payoutBankName !== undefined ? { payoutBankName: request.payoutBankName } : {}),
        ...(encryptedAccount !== undefined ? { payoutAccountNumber: encryptedAccount } : {}),
        ...(request.payoutAccountName !== undefined
          ? { payoutAccountName: request.payoutAccountName }
          : {}),
        ...(request.payoutBranchCode !== undefined
          ? { payoutBranchCode: request.payoutBranchCode }
          : {}),
        ...(requiresReverification ? { status: "PENDING_VERIFICATION" } : {}),
        updatedAt: new Date()
      })
      .where(eq(schema.hostBusinesses.id, businessId))
      .returning();

    await auditService.recordEvent({
      eventType: SecurityEventType.HOST_BUSINESS_UPDATED,
      userId: context.userId,
      clientInfo: context.clientInfo,
      metadata: {
        businessId: updated.id,
        tradeName: updated.tradeName,
        reverificationTriggered: requiresReverification
      }
    });

    const verification = await this.getLatestVerification(updated.id);
    return this.mapBusinessEntity(updated, verification);
  }

  /**
   * Submits business verification information and attached documents.
   * Strictly verifies that each document references an authentic, confirmed upload intent
   * created by the caller for this business.
   */
  async submitVerification(
    businessId: string,
    request: SubmitHostVerificationRequest,
    context: HostContext
  ): Promise<HostVerification> {
    const [business] = await db
      .select()
      .from(schema.hostBusinesses)
      .where(eq(schema.hostBusinesses.id, businessId))
      .limit(1);

    if (!business) {
      throw AppError.notFound("Host business not found");
    }

    if (business.ownerUserId !== context.userId) {
      throw AppError.forbidden("Access denied: You do not own this host business");
    }

    if (business.status === "ACTIVE") {
      throw AppError.badRequest("This host business is already verified and active");
    }

    if (business.status === "SUSPENDED" || business.status === "REJECTED") {
      throw AppError.badRequest(`Cannot submit verification for a ${business.status.toLowerCase()} business`);
    }

    const verification = await db.transaction(async (tx) => {
      // 1. Create verification submission record
      const [verif] = await tx
        .insert(schema.hostVerifications)
        .values({
          businessId,
          submittedBy: context.userId,
          status: "PENDING_REVIEW"
        })
        .returning();

      // 2. Validate each document against durable, confirmed upload intents
      const validatedDocs = [];
      for (const doc of request.documents) {
        const condition = doc.intentId
          ? eq(schema.uploadIntents.id, doc.intentId)
          : eq(schema.uploadIntents.fileKey, doc.fileKey!);

        const [intent] = await tx
          .select()
          .from(schema.uploadIntents)
          .where(condition)
          .limit(1);

        if (!intent) {
          throw AppError.badRequest(
            `Invalid verification document: No matching upload intent found for document ${doc.fileKey || doc.intentId}`
          );
        }

        if (intent.userId !== context.userId) {
          throw AppError.forbidden(
            "Access denied: Upload intent belongs to another user"
          );
        }

        if (intent.purpose !== "HOST_VERIFICATION") {
          throw AppError.badRequest(
            `Invalid upload intent purpose: expected HOST_VERIFICATION, got ${intent.purpose}`
          );
        }

        if (intent.resourceId && intent.resourceId !== businessId) {
          throw AppError.forbidden(
            "Access denied: Upload intent was created for a different business"
          );
        }

        if (intent.status !== "CONFIRMED") {
          throw AppError.badRequest(
            `Upload intent is not confirmed. Current status: ${intent.status}`
          );
        }

        // Prevent reusing the same upload key across multiple verifications
        const [alreadyAssociated] = await tx
          .select({ id: schema.hostVerificationDocuments.id })
          .from(schema.hostVerificationDocuments)
          .where(eq(schema.hostVerificationDocuments.fileKey, intent.fileKey))
          .limit(1);

        if (alreadyAssociated) {
          throw AppError.conflict(
            `Document with fileKey ${intent.fileKey} is already attached to a verification application`
          );
        }

        validatedDocs.push({
          verificationId: verif.id,
          documentType: doc.documentType,
          fileKey: intent.fileKey,
          fileName: intent.fileName || doc.fileName || "verification-document",
          fileSize: intent.maxFileSize,
          mimeType: intent.mimeType,
          status: "PENDING" as const
        });
      }

      const insertedDocs = await tx
        .insert(schema.hostVerificationDocuments)
        .values(validatedDocs)
        .returning();

      // 3. Transition business status to PENDING_VERIFICATION
      await tx
        .update(schema.hostBusinesses)
        .set({
          status: "PENDING_VERIFICATION",
          updatedAt: new Date()
        })
        .where(eq(schema.hostBusinesses.id, businessId));

      // 4. Audit logging
      await auditService.recordEvent({
        eventType: SecurityEventType.HOST_VERIFICATION_SUBMITTED,
        userId: context.userId,
        clientInfo: context.clientInfo,
        tx,
        metadata: {
          verificationId: verif.id,
          businessId,
          documentCount: insertedDocs.length
        }
      });

      return {
        ...verif,
        documents: insertedDocs
      };
    });

    return this.mapVerificationEntity(verification);
  }

  /**
   * Retrieves full decrypted banking details for authorized business owner or financial administrator.
   */
  async getPayoutDetails(
    businessId: string,
    context: HostContext
  ): Promise<{
    payoutBankName: string | null;
    payoutAccountNumber: string | null;
    payoutAccountNumberMasked: string | null;
    payoutAccountName: string | null;
    payoutBranchCode: string | null;
  }> {
    const [business] = await db
      .select()
      .from(schema.hostBusinesses)
      .where(eq(schema.hostBusinesses.id, businessId))
      .limit(1);

    if (!business) {
      throw AppError.notFound("Host business not found");
    }

    const isFinancialAdmin = context.roles.includes("SUPERADMIN") || context.roles.includes("ADMIN_FINANCIAL");
    if (business.ownerUserId !== context.userId && !isFinancialAdmin) {
      throw AppError.forbidden("Access denied: You do not have permission to view sensitive banking details");
    }

    const decrypted = decryptPayoutAccountNumber(business.payoutAccountNumber);
    const masked = maskPayoutAccountNumber(business.payoutAccountNumber);

    return {
      payoutBankName: business.payoutBankName,
      payoutAccountNumber: decrypted,
      payoutAccountNumberMasked: masked,
      payoutAccountName: business.payoutAccountName,
      payoutBranchCode: business.payoutBranchCode
    };
  }

  /**
   * Retrieves the current verification submission for a business.
   */
  async getLatestVerification(businessId: string): Promise<HostVerification | null> {
    const [verif] = await db
      .select()
      .from(schema.hostVerifications)
      .where(eq(schema.hostVerifications.businessId, businessId))
      .orderBy(desc(schema.hostVerifications.createdAt))
      .limit(1);

    if (!verif) return null;

    const docs = await db
      .select()
      .from(schema.hostVerificationDocuments)
      .where(eq(schema.hostVerificationDocuments.verificationId, verif.id));

    return this.mapVerificationEntity({ ...verif, documents: docs });
  }

  /**
   * Maps database entity to contract model.
   * Strictly masks bank account numbers to prevent financial data leakage.
   */
  private mapBusinessEntity(
    entity: typeof schema.hostBusinesses.$inferSelect,
    verification?: HostVerification | null
  ): HostBusiness {
    const maskedAccount = maskPayoutAccountNumber(entity.payoutAccountNumber);

    return {
      id: entity.id,
      ownerUserId: entity.ownerUserId,
      legalBusinessName: entity.legalBusinessName,
      tradeName: entity.tradeName,
      businessRegistrationNumber: entity.businessRegistrationNumber,
      entityType: entity.entityType as HostBusiness["entityType"],
      taxIdentifier: entity.taxIdentifier,
      contactEmail: entity.contactEmail,
      contactPhone: entity.contactPhone,
      addressLine1: entity.addressLine1,
      addressLine2: entity.addressLine2,
      city: entity.city,
      postalCode: entity.postalCode,
      countryCode: entity.countryCode,
      payoutBankName: entity.payoutBankName,
      payoutAccountNumber: maskedAccount,
      payoutAccountNumberMasked: maskedAccount,
      payoutAccountName: entity.payoutAccountName,
      payoutBranchCode: entity.payoutBranchCode,
      status: entity.status as HostBusiness["status"],
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      verification: verification || undefined
    };
  }

  private mapVerificationEntity(verif: {
    id: string;
    businessId: string;
    submittedBy: string;
    status: string;
    reviewerUserId: string | null;
    reviewedAt: Date | null;
    rejectionReason: string | null;
    adminNotes: string | null;
    submittedAt: Date;
    createdAt: Date;
    updatedAt: Date;
    documents: Array<typeof schema.hostVerificationDocuments.$inferSelect>;
  }): HostVerification {
    return {
      id: verif.id,
      businessId: verif.businessId,
      submittedBy: verif.submittedBy,
      status: verif.status as HostVerification["status"],
      reviewerUserId: verif.reviewerUserId,
      reviewedAt: verif.reviewedAt ? verif.reviewedAt.toISOString() : null,
      rejectionReason: verif.rejectionReason,
      adminNotes: verif.adminNotes,
      submittedAt: verif.submittedAt.toISOString(),
      createdAt: verif.createdAt.toISOString(),
      updatedAt: verif.updatedAt.toISOString(),
      documents: verif.documents.map((d) => ({
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

export const hostsService = new HostsService();
