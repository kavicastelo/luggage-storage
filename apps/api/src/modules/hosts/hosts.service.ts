import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  CreateHostBusinessRequest,
  UpdateHostBusinessRequest,
  SubmitHostVerificationRequest,
  AddHostStaffRequest,
  UpdateHostStaffRequest,
  HostBusiness,
  HostVerification,
  HostStaffMemberDetail,
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
import { createDatabaseIdentityAssertion } from "../../common/crypto/database-identity.js";

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

      // 2. Assign HOST_OWNER role using safe, cryptographically verified self-service function (verified by business ownership)
      const assertion = createDatabaseIdentityAssertion({
        actorId: context.userId,
        action: "SELF_ASSIGN_HOST_OWNER",
        targetId: context.userId,
        roleCode: "HOST_OWNER"
      });

      await tx.execute(
        sql`SELECT set_config('app.current_user_id', ${context.userId}, true);`
      );
      await tx.execute(
        sql`SELECT public.self_assign_host_owner_role(
              ${context.userId}::uuid,
              ${JSON.stringify(assertion)}::jsonb
            );`
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
   * Retrieves all businesses owned by the current authenticated user,
   * or assigned via active host staff membership (with financial/KYC fields redacted).
   */
  async getOwnedBusinesses(context: HostContext): Promise<HostBusiness[]> {
    const ownedRows = await db
      .select()
      .from(schema.hostBusinesses)
      .where(eq(schema.hostBusinesses.ownerUserId, context.userId))
      .orderBy(desc(schema.hostBusinesses.createdAt));

    const staffMemberships = await db
      .select({ businessId: schema.hostStaffMemberships.businessId })
      .from(schema.hostStaffMemberships)
      .where(
        and(
          eq(schema.hostStaffMemberships.userId, context.userId),
          eq(schema.hostStaffMemberships.isActive, true)
        )
      );

    const ownedIdSet = new Set(ownedRows.map((b) => b.id));
    const staffOnlyBizIds = staffMemberships
      .map((m) => m.businessId)
      .filter((id) => !ownedIdSet.has(id));

    const staffRows =
      staffOnlyBizIds.length > 0
        ? await db
            .select()
            .from(schema.hostBusinesses)
            .where(inArray(schema.hostBusinesses.id, staffOnlyBizIds))
            .orderBy(desc(schema.hostBusinesses.createdAt))
        : [];

    const results: HostBusiness[] = [];
    for (const b of ownedRows) {
      const verification = await this.getLatestVerification(b.id);
      results.push(this.mapBusinessEntity(b, verification));
    }
    for (const b of staffRows) {
      results.push(
        this.mapBusinessEntity(b, undefined, { redactSensitive: true })
      );
    }
    return results;
  }

  /**
   * Retrieves a single Host Business by ID, enforcing ownership, active staff assignment,
   * or administrative read privileges with field-level redaction.
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
    const isOwner = business.ownerUserId === context.userId;
    if (isOwner || isSuperadmin) {
      const verification = await this.getLatestVerification(business.id);
      return this.mapBusinessEntity(business, verification);
    }

    if (context.roles.includes("SUPPORT")) {
      const verification = await this.getLatestVerification(business.id);
      return this.mapBusinessEntity(business, verification, { redactPayoutOnly: true });
    }

    const [staffMembership] = await db
      .select({ id: schema.hostStaffMemberships.id })
      .from(schema.hostStaffMemberships)
      .where(
        and(
          eq(schema.hostStaffMemberships.businessId, businessId),
          eq(schema.hostStaffMemberships.userId, context.userId),
          eq(schema.hostStaffMemberships.isActive, true)
        )
      )
      .limit(1);

    if (!staffMembership) {
      throw AppError.forbidden("Access denied: You do not have permission to view this business");
    }

    return this.mapBusinessEntity(business, undefined, { redactSensitive: true });
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

    if (business.status === "SUSPENDED") {
      throw AppError.badRequest("Cannot submit verification for a suspended business");
    }

    const verification = await db.transaction(async (tx) => {
      // Mark any prior pending/info-requested verification rows superseded (REJECTED) and re-open rejected business
      await tx
        .update(schema.hostVerifications)
        .set({
          status: "REJECTED",
          adminNotes: "Superseded by newer verification submission",
          updatedAt: new Date()
        })
        .where(
          and(
            eq(schema.hostVerifications.businessId, businessId),
            inArray(schema.hostVerifications.status, ["PENDING_REVIEW", "INFORMATION_REQUESTED"])
          )
        );

      if (business.status === "REJECTED") {
        await tx
          .update(schema.hostBusinesses)
          .set({
            status: "PENDING_VERIFICATION",
            updatedAt: new Date()
          })
          .where(eq(schema.hostBusinesses.id, businessId));
      }

      // 1. Create verification submission record
      const [verif] = await tx
        .insert(schema.hostVerifications)
        .values({
          businessId,
          submittedBy: context.userId,
          status: "PENDING_REVIEW"
        })
        .returning();

      // 2. Validate each document against durable, confirmed upload intents under row-level lock
      const validatedDocs = [];
      for (const doc of request.documents) {
        const condition = doc.intentId
          ? sql`id = ${doc.intentId}::uuid`
          : sql`file_key = ${doc.fileKey}`;

        // Lock upload intent row
        const lockRes = await tx.execute(
          sql`SELECT * FROM upload_intents WHERE ${condition} FOR UPDATE;`
        );
        const intent = lockRes.rows[0] as any;

        if (!intent) {
          throw AppError.badRequest(
            `Invalid verification document: No matching upload intent found for document ${doc.fileKey || doc.intentId}`
          );
        }

        if (intent.user_id !== context.userId) {
          throw AppError.forbidden(
            "Access denied: Upload intent belongs to another user"
          );
        }

        if (intent.purpose !== "HOST_VERIFICATION") {
          throw AppError.badRequest(
            `Invalid upload intent purpose: expected HOST_VERIFICATION, got ${intent.purpose}`
          );
        }

        if (intent.resource_id && intent.resource_id !== businessId) {
          throw AppError.forbidden(
            "Access denied: Upload intent was created for a different business"
          );
        }

        if (intent.status === "CONSUMED") {
          throw AppError.conflict(
            `Upload intent ${intent.id} has already been consumed and cannot be reused (replay prevention)`
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
          .where(eq(schema.hostVerificationDocuments.fileKey, intent.file_key))
          .limit(1);

        if (alreadyAssociated) {
          throw AppError.conflict(
            `Document with fileKey ${intent.file_key} is already attached to a verification application`
          );
        }

        // Atomically transition intent to CONSUMED
        await tx
          .update(schema.uploadIntents)
          .set({ status: "CONSUMED", updatedAt: new Date() })
          .where(eq(schema.uploadIntents.id, intent.id));

        validatedDocs.push({
          verificationId: verif.id,
          documentType: doc.documentType,
          fileKey: intent.file_key,
          fileName: intent.file_name || doc.fileName || "verification-document",
          fileSize: intent.max_file_size,
          mimeType: intent.mime_type,
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

    const isFinancialAdmin = context.roles.includes("SUPERADMIN");
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
   * Retrieves verification progress for authorized business owner, Superadmin, or Support (read-only).
   * Host Staff are strictly denied access to KYC verification records.
   */
  async getVerificationByBusinessId(
    businessId: string,
    context: HostContext
  ): Promise<HostVerification | null> {
    const [business] = await db
      .select({ id: schema.hostBusinesses.id, ownerUserId: schema.hostBusinesses.ownerUserId })
      .from(schema.hostBusinesses)
      .where(eq(schema.hostBusinesses.id, businessId))
      .limit(1);

    if (!business) {
      throw AppError.notFound("Host business not found");
    }

    const canViewVerification =
      business.ownerUserId === context.userId ||
      context.roles.includes("SUPERADMIN") ||
      context.roles.includes("SUPPORT");

    if (!canViewVerification) {
      throw AppError.forbidden("Access denied: You do not have permission to view business verification records");
    }

    return this.getLatestVerification(business.id);
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
   * Strictly masks bank account numbers and redacts financial/KYC fields for non-owner callers.
   */
  private mapBusinessEntity(
    entity: typeof schema.hostBusinesses.$inferSelect,
    verification?: HostVerification | null,
    options?: { redactSensitive?: boolean; redactPayoutOnly?: boolean }
  ): HostBusiness {
    const redactAllSensitive = Boolean(options?.redactSensitive);
    const redactPayout = redactAllSensitive || Boolean(options?.redactPayoutOnly);
    const maskedAccount = redactPayout
      ? null
      : maskPayoutAccountNumber(entity.payoutAccountNumber);

    return {
      id: entity.id,
      ownerUserId: entity.ownerUserId,
      legalBusinessName: entity.legalBusinessName,
      tradeName: entity.tradeName,
      businessRegistrationNumber: redactAllSensitive ? null : entity.businessRegistrationNumber,
      entityType: entity.entityType as HostBusiness["entityType"],
      taxIdentifier: redactAllSensitive ? null : entity.taxIdentifier,
      contactEmail: entity.contactEmail,
      contactPhone: entity.contactPhone,
      addressLine1: entity.addressLine1,
      addressLine2: entity.addressLine2,
      city: entity.city,
      postalCode: entity.postalCode,
      countryCode: entity.countryCode,
      payoutBankName: redactPayout ? null : entity.payoutBankName,
      payoutAccountNumber: maskedAccount,
      payoutAccountNumberMasked: maskedAccount,
      payoutAccountName: redactPayout ? null : entity.payoutAccountName,
      payoutBranchCode: redactPayout ? null : entity.payoutBranchCode,
      status: entity.status as HostBusiness["status"],
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      verification: redactAllSensitive ? undefined : verification || undefined
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

  private async assertHostOwnerOrSuperadminForBusiness(
    businessId: string,
    context: HostContext,
    allowSupportRead = false
  ): Promise<typeof schema.hostBusinesses.$inferSelect> {
    const [business] = await db
      .select()
      .from(schema.hostBusinesses)
      .where(eq(schema.hostBusinesses.id, businessId))
      .limit(1);

    if (!business) {
      throw AppError.notFound("Host business not found");
    }

    const isOwner = business.ownerUserId === context.userId;
    const isSuperadmin = context.roles.includes("SUPERADMIN");
    const isSupport = context.roles.includes("SUPPORT");

    if (!isOwner && !isSuperadmin && !(allowSupportRead && isSupport)) {
      await auditService.recordEvent({
        eventType: SecurityEventType.AUTH_ACCESS_DENIED,
        userId: context.userId,
        clientInfo: context.clientInfo,
        metadata: { businessId, reason: "Non-owner attempted host business staff access" }
      });
      throw AppError.forbidden("Access denied: You do not own this host business");
    }

    return business;
  }

  private formatStaffMemberDetail(
    membership: typeof schema.hostStaffMemberships.$inferSelect,
    user: { email: string; displayName: string; status: string }
  ): HostStaffMemberDetail {
    return {
      id: membership.id,
      businessId: membership.businessId,
      userId: membership.userId,
      staffRole: membership.staffRole as HostStaffMemberDetail["staffRole"],
      assignedLocationIds: Array.isArray(membership.assignedLocationIds)
        ? (membership.assignedLocationIds as string[])
        : [],
      isActive: membership.isActive,
      invitedAt: membership.invitedAt.toISOString(),
      acceptedAt: membership.acceptedAt ? membership.acceptedAt.toISOString() : null,
      createdAt: membership.createdAt.toISOString(),
      updatedAt: membership.updatedAt.toISOString(),
      email: user.email,
      displayName: user.displayName,
      userStatus: user.status
    };
  }

  async listBusinessStaff(
    businessId: string,
    context: HostContext
  ): Promise<HostStaffMemberDetail[]> {
    await this.assertHostOwnerOrSuperadminForBusiness(businessId, context, true);

    const rows = await db
      .select({
        membership: schema.hostStaffMemberships,
        email: schema.users.email,
        displayName: schema.users.displayName,
        userStatus: schema.users.status
      })
      .from(schema.hostStaffMemberships)
      .innerJoin(schema.users, eq(schema.hostStaffMemberships.userId, schema.users.id))
      .where(eq(schema.hostStaffMemberships.businessId, businessId))
      .orderBy(desc(schema.hostStaffMemberships.createdAt));

    return rows.map((row) =>
      this.formatStaffMemberDetail(row.membership, {
        email: row.email,
        displayName: row.displayName,
        status: row.userStatus
      })
    );
  }

  async addBusinessStaff(
    businessId: string,
    request: AddHostStaffRequest,
    context: HostContext
  ): Promise<HostStaffMemberDetail> {
    const business = await this.assertHostOwnerOrSuperadminForBusiness(businessId, context, false);

    if (business.status === "SUSPENDED") {
      throw AppError.badRequest("Cannot manage staff on a suspended business");
    }

    const normalizedEmail = request.email.trim().toLowerCase();
    const [targetUser] = await db
      .select()
      .from(schema.users)
      .where(sql`lower(${schema.users.email}) = ${normalizedEmail}`)
      .limit(1);

    if (!targetUser) {
      throw AppError.notFound(
        "No registered user account matches that email address. Ask your staff member to register first."
      );
    }

    if (targetUser.status === "DEACTIVATED") {
      throw AppError.badRequest("Cannot assign a deactivated account as host staff");
    }

    if (targetUser.id === business.ownerUserId) {
      throw AppError.badRequest("The business owner already has full access and cannot be added as staff");
    }

    const locationIds = [...new Set(request.assignedLocationIds ?? [])];
    if (locationIds.length > 0) {
      const ownedLocs = await db
        .select({ id: schema.storageLocations.id })
        .from(schema.storageLocations)
        .where(
          and(
            eq(schema.storageLocations.businessId, businessId),
            inArray(schema.storageLocations.id, locationIds)
          )
        );
      if (ownedLocs.length !== locationIds.length) {
        throw AppError.badRequest("One or more assigned locations do not belong to this host business");
      }
    }

    const membership = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(schema.hostStaffMemberships)
        .where(
          and(
            eq(schema.hostStaffMemberships.businessId, businessId),
            eq(schema.hostStaffMemberships.userId, targetUser.id)
          )
        )
        .limit(1);

      if (existing && existing.isActive) {
        throw AppError.conflict("User is already an active staff member of this host business");
      }

      let savedMembership: typeof schema.hostStaffMemberships.$inferSelect;
      if (existing) {
        const [updated] = await tx
          .update(schema.hostStaffMemberships)
          .set({
            staffRole: request.staffRole,
            assignedLocationIds: locationIds,
            isActive: true,
            acceptedAt: existing.acceptedAt ?? new Date(),
            updatedAt: new Date()
          })
          .where(eq(schema.hostStaffMemberships.id, existing.id))
          .returning();
        savedMembership = updated;
      } else {
        const [inserted] = await tx
          .insert(schema.hostStaffMemberships)
          .values({
            businessId,
            userId: targetUser.id,
            staffRole: request.staffRole,
            assignedLocationIds: locationIds,
            isActive: true,
            acceptedAt: new Date()
          })
          .returning();
        savedMembership = inserted;
      }

      await tx.execute(sql`SELECT set_config('app.current_user_id', ${context.userId}, true)`);
      const assertion = createDatabaseIdentityAssertion({
        actorId: context.userId,
        action: "ASSIGN_HOST_STAFF_ROLE",
        targetId: targetUser.id,
        roleCode: "HOST_STAFF"
      });
      await tx.execute(
        sql`SELECT public.assign_host_staff_role(${businessId}::uuid, ${targetUser.id}::uuid, ${JSON.stringify(assertion)}::jsonb)`
      );

      await auditService.recordEvent({
        eventType: SecurityEventType.HOST_STAFF_INVITED,
        userId: context.userId,
        clientInfo: context.clientInfo,
        tx,
        metadata: {
          businessId,
          membershipId: savedMembership.id,
          staffUserId: targetUser.id,
          staffRole: savedMembership.staffRole,
          assignedLocationIds: locationIds
        }
      });

      return savedMembership;
    });

    return this.formatStaffMemberDetail(membership, {
      email: targetUser.email,
      displayName: targetUser.displayName,
      status: targetUser.status
    });
  }

  async updateBusinessStaff(
    businessId: string,
    membershipId: string,
    request: UpdateHostStaffRequest,
    context: HostContext
  ): Promise<HostStaffMemberDetail> {
    await this.assertHostOwnerOrSuperadminForBusiness(businessId, context, false);

    const [existingRow] = await db
      .select({
        membership: schema.hostStaffMemberships,
        email: schema.users.email,
        displayName: schema.users.displayName,
        userStatus: schema.users.status
      })
      .from(schema.hostStaffMemberships)
      .innerJoin(schema.users, eq(schema.hostStaffMemberships.userId, schema.users.id))
      .where(
        and(
          eq(schema.hostStaffMemberships.id, membershipId),
          eq(schema.hostStaffMemberships.businessId, businessId)
        )
      )
      .limit(1);

    if (!existingRow) {
      throw AppError.notFound("Host staff membership not found");
    }

    let nextLocationIds = Array.isArray(existingRow.membership.assignedLocationIds)
      ? (existingRow.membership.assignedLocationIds as string[])
      : [];

    if (request.assignedLocationIds !== undefined) {
      nextLocationIds = [...new Set(request.assignedLocationIds)];
      if (nextLocationIds.length > 0) {
        const ownedLocs = await db
          .select({ id: schema.storageLocations.id })
          .from(schema.storageLocations)
          .where(
            and(
              eq(schema.storageLocations.businessId, businessId),
              inArray(schema.storageLocations.id, nextLocationIds)
            )
          );
        if (ownedLocs.length !== nextLocationIds.length) {
          throw AppError.badRequest("One or more assigned locations do not belong to this host business");
        }
      }
    }

    const updatedMembership = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(schema.hostStaffMemberships)
        .set({
          staffRole: request.staffRole ?? existingRow.membership.staffRole,
          assignedLocationIds:
            request.assignedLocationIds !== undefined
              ? nextLocationIds
              : existingRow.membership.assignedLocationIds,
          isActive: request.isActive ?? existingRow.membership.isActive,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(schema.hostStaffMemberships.id, membershipId),
            eq(schema.hostStaffMemberships.businessId, businessId)
          )
        )
        .returning();

      if (request.isActive !== undefined) {
        await tx.execute(sql`SELECT set_config('app.current_user_id', ${context.userId}, true)`);
        if (request.isActive === false) {
          const assertion = createDatabaseIdentityAssertion({
            actorId: context.userId,
            action: "REVOKE_HOST_STAFF_ROLE",
            targetId: existingRow.membership.userId,
            roleCode: "HOST_STAFF"
          });
          await tx.execute(
            sql`SELECT public.revoke_host_staff_role_if_unassigned(${businessId}::uuid, ${existingRow.membership.userId}::uuid, ${JSON.stringify(assertion)}::jsonb)`
          );
        } else {
          const assertion = createDatabaseIdentityAssertion({
            actorId: context.userId,
            action: "ASSIGN_HOST_STAFF_ROLE",
            targetId: existingRow.membership.userId,
            roleCode: "HOST_STAFF"
          });
          await tx.execute(
            sql`SELECT public.assign_host_staff_role(${businessId}::uuid, ${existingRow.membership.userId}::uuid, ${JSON.stringify(assertion)}::jsonb)`
          );
        }
      }

      await auditService.recordEvent({
        eventType: SecurityEventType.HOST_STAFF_UPDATED,
        userId: context.userId,
        clientInfo: context.clientInfo,
        tx,
        metadata: {
          businessId,
          membershipId,
          staffUserId: existingRow.membership.userId,
          staffRole: updated.staffRole,
          isActive: updated.isActive,
          assignedLocationIds: nextLocationIds
        }
      });

      return updated;
    });

    return this.formatStaffMemberDetail(updatedMembership, {
      email: existingRow.email,
      displayName: existingRow.displayName,
      status: existingRow.userStatus
    });
  }

  async removeBusinessStaff(
    businessId: string,
    membershipId: string,
    context: HostContext
  ): Promise<void> {
    await this.assertHostOwnerOrSuperadminForBusiness(businessId, context, false);

    const [existing] = await db
      .select()
      .from(schema.hostStaffMemberships)
      .where(
        and(
          eq(schema.hostStaffMemberships.id, membershipId),
          eq(schema.hostStaffMemberships.businessId, businessId)
        )
      )
      .limit(1);

    if (!existing) {
      throw AppError.notFound("Host staff membership not found");
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(schema.hostStaffMemberships)
        .where(
          and(
            eq(schema.hostStaffMemberships.id, membershipId),
            eq(schema.hostStaffMemberships.businessId, businessId)
          )
        );

      await tx.execute(sql`SELECT set_config('app.current_user_id', ${context.userId}, true)`);
      const assertion = createDatabaseIdentityAssertion({
        actorId: context.userId,
        action: "REVOKE_HOST_STAFF_ROLE",
        targetId: existing.userId,
        roleCode: "HOST_STAFF"
      });
      await tx.execute(
        sql`SELECT public.revoke_host_staff_role_if_unassigned(${businessId}::uuid, ${existing.userId}::uuid, ${JSON.stringify(assertion)}::jsonb)`
      );

      await auditService.recordEvent({
        eventType: SecurityEventType.HOST_STAFF_REMOVED,
        userId: context.userId,
        clientInfo: context.clientInfo,
        tx,
        metadata: {
          businessId,
          membershipId,
          staffUserId: existing.userId,
          staffRole: existing.staffRole
        }
      });
    });
  }
}

export const hostsService = new HostsService();
